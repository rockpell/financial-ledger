import * as XLSX from "xlsx";
import type { Transaction, TxType } from "./types";

// 메모에서 해시태그를 추출하는 정규식 (한글 자모/완성형 + 영숫자/_).
const TAG_REGEX = /#[\wㄱ-ㅎㅏ-ㅣ가-힣]+/g;

export function extractTags(memo: string): string[] {
  if (!memo) return [];
  const matches = memo.match(TAG_REGEX);
  if (!matches) return [];
  // 중복 제거하면서 '#' 제거한 순수 태그명으로 정규화.
  return Array.from(new Set(matches.map((t) => t.slice(1))));
}

// 중복 판별용 고유 키: 날짜 + 내용 + 금액 + 결제수단.
export function uniqueKey(tx: Pick<Transaction, "date" | "content" | "amount" | "payment">): string {
  return `${tx.date}|${tx.content}|${tx.amount}|${tx.payment}`;
}

// 노이즈 필터: 대분류가 '미분류'이면서 금액 절댓값이 100원 이하인 소액 내역.
export function isNoise(tx: Transaction): boolean {
  return tx.majorCategory === "미분류" && Math.abs(tx.amount) <= 100;
}

function normalizeType(value: unknown): TxType {
  const s = String(value ?? "").trim();
  if (s === "수입") return "수입";
  if (s === "이체") return "이체";
  return "지출";
}

// 다양한 헤더 표기를 표준 키로 매핑하기 위한 별칭 테이블.
// 키 순서 = 뱅샐 실제 export 컬럼 순서.
const HEADER_ALIASES: Record<keyof Transaction, string[]> = {
  date: ["날짜", "date"],
  time: ["시간", "time"],
  type: ["타입", "type", "구분"],
  majorCategory: ["대분류", "category"],
  minorCategory: ["소분류", "subcategory"],
  content: ["내용", "content", "거래처"],
  amount: ["금액", "amount"],
  currency: ["화폐", "통화", "currency"],
  payment: ["결제수단", "payment", "자산"],
  memo: ["메모", "memo", "비고"],
  tags: ["파싱된 태그", "태그", "tags"],
};

function buildHeaderIndex(headerRow: unknown[]): Partial<Record<keyof Transaction, number>> {
  const index: Partial<Record<keyof Transaction, number>> = {};
  headerRow.forEach((cell, i) => {
    const name = String(cell ?? "").trim();
    (Object.keys(HEADER_ALIASES) as (keyof Transaction)[]).forEach((key) => {
      if (index[key] === undefined && HEADER_ALIASES[key].includes(name)) {
        index[key] = i;
      }
    });
  });
  return index;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "").replace(/[,\s₩원]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export interface ParseResult {
  transactions: Transaction[];
  droppedNoise: number; // 노이즈 필터로 제거된 건수
}

// 뱅크샐러드 엑셀(ArrayBuffer)을 Transaction[]로 파싱한다.
// 한 파일에 '뱅샐현황' 등 여러 시트가 있으므로 '가계부 내역' 시트를 우선 선택한다.
export function parseWorkbook(data: ArrayBuffer): ParseResult {
  const wb = XLSX.read(data, { type: "array" });
  const sheetName =
    wb.SheetNames.find((n) => n.includes("가계부") || n.includes("내역")) ?? wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  // raw:false 로 뱅샐이 표시하는 형식 그대로(날짜 "2026-06-05", 시간 "18:50") 읽는다.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    blankrows: false,
  });
  if (rows.length === 0) return { transactions: [], droppedNoise: 0 };

  // 헤더 행 탐색: '날짜'/'금액' 등이 포함된 첫 행을 헤더로 간주.
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = rows[i].map((c) => String(c ?? "").trim());
    if (cells.includes("날짜") && cells.includes("금액")) {
      headerRowIdx = i;
      break;
    }
  }

  const headerIndex = buildHeaderIndex(rows[headerRowIdx]);
  const transactions: Transaction[] = [];
  let droppedNoise = 0;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const get = (key: keyof Transaction) => {
      const idx = headerIndex[key];
      return idx === undefined ? undefined : row[idx];
    };

    const date = String(get("date") ?? "").trim().slice(0, 10);
    const amount = toNumber(get("amount"));
    const content = String(get("content") ?? "").trim();
    if (!date && !content && amount === 0) continue;

    const memo = String(get("memo") ?? "").trim();
    const tx: Transaction = {
      date,
      time: String(get("time") ?? "").trim(),
      type: normalizeType(get("type")),
      majorCategory: String(get("majorCategory") ?? "").trim(),
      minorCategory: String(get("minorCategory") ?? "").trim(),
      content,
      amount,
      currency: String(get("currency") ?? "KRW").trim() || "KRW",
      payment: String(get("payment") ?? "").trim(),
      memo,
      tags: extractTags(memo),
    };

    if (isNoise(tx)) {
      droppedNoise++;
      continue;
    }
    transactions.push(tx);
  }

  return { transactions, droppedNoise };
}

// 기존 마스터 데이터와 비교해 신규 거래만 골라낸다.
export function diffNewTransactions(
  incoming: Transaction[],
  existingKeys: Set<string>,
): Transaction[] {
  const seen = new Set(existingKeys);
  const result: Transaction[] = [];
  for (const tx of incoming) {
    const key = uniqueKey(tx);
    if (seen.has(key)) continue;
    seen.add(key); // 업로드 파일 내부의 중복도 함께 제거
    result.push(tx);
  }
  return result;
}
