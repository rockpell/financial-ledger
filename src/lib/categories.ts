import type { CostType, Transaction } from "./types";

// 실제 소비가 아닌 '자금 이동/수입/투자' 성격의 대분류.
// 소비 분석(차트/Top5/카테고리 비중)에서 제외한다.
// 06.xlsx 실데이터의 35개 대분류를 기준으로 선별.
export const NON_SPENDING_MAJOR = new Set<string>([
  "내계좌이체",
  "이체",
  "카드대금",
  "현금",
  "투자",
  "저축",
  "금융수입",
  "기타수입",
  "급여",
  "용돈",
  "사업수입",
  "보험금",
  "아르바이트",
  "앱테크",
  "대출",
]);

// 실제 소비 거래인지 판정: 타입이 '지출'이고 자금이동/수입 대분류가 아닌 것.
export function isSpending(tx: Transaction): boolean {
  if (tx.type !== "지출") return false;
  if (NON_SPENDING_MAJOR.has(tx.majorCategory)) return false;
  return true;
}

// 지출 금액(양수)으로 정규화. 뱅샐은 지출을 음수로 기록하므로 절댓값 사용.
export function spendAmount(tx: Transaction): number {
  if (!isSpending(tx)) return 0;
  return Math.abs(tx.amount);
}

// 수입 판정: 타입이 '수입'인 거래(자금이동/이체 제외).
export function isIncome(tx: Transaction): boolean {
  return tx.type === "수입";
}

// 수입 금액(양수)으로 정규화.
export function incomeAmount(tx: Transaction): number {
  return isIncome(tx) ? Math.abs(tx.amount) : 0;
}

// ── 고정비 / 변동비 재분류 ─────────────────────────────────────────────
// 고정비로 간주할 대분류.
const FIXED_MAJOR = new Set<string>(["주거/통신", "보험"]);
// 고정비 성격의 소분류(대분류가 달라도 고정비로 끌어올림).
const FIXED_MINOR = new Set<string>([
  "월세",
  "관리비",
  "휴대폰",
  "통신비",
  "보험",
  "서비스구독", // 온라인쇼핑 > 서비스구독 = 정기구독
  "정기구독",
  "할부/리스", // 자동차 > 할부/리스
  "이자/대출",
]);

export function classifyCostType(tx: Transaction): CostType {
  if (!isSpending(tx)) return "기타";
  if (FIXED_MAJOR.has(tx.majorCategory)) return "고정비";
  if (FIXED_MINOR.has(tx.minorCategory)) return "고정비";
  return "변동비";
}

// ── 대형 카테고리 그룹핑 ───────────────────────────────────────────────
// 35개 세분화 대분류를 6개 대형 카테고리로 재구조화.
export const BIG_CATEGORIES = [
  "식비/디저트",
  "생활/쇼핑",
  "필수 고정비",
  "문화/여가",
  "교통/이동",
  "기타",
] as const;
export type BigCategory = (typeof BIG_CATEGORIES)[number];

const BIG_CATEGORY_MAP: Record<string, BigCategory> = {
  // 식비/디저트
  식비: "식비/디저트",
  "카페/간식": "식비/디저트",
  "술/유흥": "식비/디저트",
  // 생활/쇼핑
  생활: "생활/쇼핑",
  온라인쇼핑: "생활/쇼핑",
  "패션/쇼핑": "생활/쇼핑",
  "뷰티/미용": "생활/쇼핑",
  반려동물: "생활/쇼핑",
  중고거래: "생활/쇼핑",
  // 필수 고정비
  "주거/통신": "필수 고정비",
  보험: "필수 고정비",
  "자녀/육아": "필수 고정비",
  // 문화/여가
  "문화/여가": "문화/여가",
  "여행/숙박": "문화/여가",
  "의료/건강": "문화/여가",
  "경조/선물": "문화/여가",
  "교육/학습": "문화/여가",
  // 교통/이동
  교통: "교통/이동",
  자동차: "교통/이동",
};

export function toBigCategory(tx: Transaction): BigCategory {
  return BIG_CATEGORY_MAP[tx.majorCategory] ?? "기타";
}
