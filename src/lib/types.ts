// 가계부 거래 한 건을 표현하는 도메인 타입.
// 뱅크샐러드 실제 export 스키마(가계부 내역 시트)를 기준으로 한다:
// 날짜 | 시간 | 타입 | 대분류 | 소분류 | 내용 | 금액 | 화폐 | 결제수단 | 메모
// 여기에 커스텀으로 '파싱된 태그' 컬럼을 더해 마스터 시트를 구성한다.
export interface Transaction {
  date: string; // YYYY-MM-DD (A)
  time: string; // HH:mm (B)
  type: TxType; // 지출 / 수입 / 이체 (C)
  majorCategory: string; // 대분류 (D)
  minorCategory: string; // 소분류 (E)
  content: string; // 내용 (F)
  amount: number; // 금액 (G) - 지출은 음수
  currency: string; // 화폐 (H) - 보통 KRW
  payment: string; // 결제수단 (I)
  memo: string; // 메모 (J)
  tags: string[]; // 파싱된 태그 (K)
}

export type TxType = "지출" | "수입" | "이체";

// 마스터 시트의 헤더 순서(A~J). 화폐 컬럼 없음, 태그 열 이름은 "태그".
// append 시 컬럼 순서를 보장하는 단일 진실 공급원.
export const SHEET_HEADERS = [
  "날짜",
  "시간",
  "타입",
  "대분류",
  "소분류",
  "내용",
  "금액",
  "결제수단",
  "메모",
  "태그",
] as const;

// 고정비 / 변동비 재분류 결과.
export type CostType = "고정비" | "변동비" | "기타";
