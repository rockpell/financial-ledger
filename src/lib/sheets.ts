import { google } from "googleapis";
import type { Transaction } from "./types";
import { SHEET_HEADERS } from "./types";
import { extractTags } from "./parse";

// 구글 서비스 계정으로 시트 클라이언트 생성.
// 키는 Vercel 환경변수에서만 읽으며 클라이언트로 전송하지 않는다.
function getSheetsClient() {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  // private key는 환경변수 저장 시 줄바꿈이 \n 문자열로 들어오므로 복원.
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error("GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY 환경변수가 필요합니다.");
  }
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function getConfig() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID 환경변수가 필요합니다.");
  const sheetName = process.env.GOOGLE_SHEET_NAME || "가계부 내역";
  return { spreadsheetId, sheetName };
}

let headersChecked = false;

async function ensureHeaders() {
  if (headersChecked) return;
  const sheets = getSheetsClient();
  const { spreadsheetId, sheetName } = getConfig();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:Z1`,
  });

  const existingHeaders = (res.data.values?.[0] ?? []) as string[];

  // 1. 기존 헤더가 코드 상의 헤더와 앞에서부터 순서대로 정확히 일치하는지 검증
  for (let i = 0; i < existingHeaders.length; i++) {
    if (existingHeaders[i] !== SHEET_HEADERS[i]) {
      throw new Error(
        `구글 시트 스키마 불일치: ${i + 1}번째 열이 '${SHEET_HEADERS[i]}'여야 하지만 '${existingHeaders[i]}'입니다. 시트 포맷이 망가졌습니다.`
      );
    }
  }

  // 2. 순서는 모두 맞으나 뒷부분에 새로운 헤더가 누락된 경우 자동 추가
  if (existingHeaders.length < SHEET_HEADERS.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`, // A1부터 시작해서 전달된 배열 길이만큼 덮어씌움
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[...SHEET_HEADERS]] },
    });
  }

  headersChecked = true;
}

function normalizeType(value: string): Transaction["type"] {
  if (value === "수입") return "수입";
  if (value === "이체") return "이체";
  return "지출";
}

// 마스터 시트 스키마(A~L, 화폐 컬럼 없음):
// 날짜 | 시간 | 타입 | 대분류 | 소분류 | 내용 | 금액 | 결제수단 | 메모 | 태그 | 생성일시 | 수정일시
// 시트 한 행을 Transaction으로 변환.
function rowToTransaction(row: string[]): Transaction {
  const memo = row[8] ?? "";
  const tagCell = row[9] ?? "";
  // J열(태그)이 있으면 사용, 없으면 메모에서 재추출.
  const tags = tagCell
    ? tagCell.split(/[,\s]+/).map((t) => t.replace(/^#/, "")).filter(Boolean)
    : extractTags(memo);
  return {
    date: row[0] ?? "",
    time: row[1] ?? "",
    type: normalizeType(row[2] ?? ""),
    majorCategory: row[3] ?? "",
    minorCategory: row[4] ?? "",
    content: row[5] ?? "",
    amount: Number(String(row[6] ?? "0").replace(/[,\s]/g, "")) || 0,
    currency: "KRW", // 마스터 시트엔 화폐 컬럼이 없으므로 기본값
    payment: row[7] ?? "",
    memo,
    tags,
    createdAt: row[10] || undefined,
    updatedAt: row[11] || undefined,
  };
}

// Transaction을 마스터 시트 행(A~L) 배열로 변환. 화폐는 저장하지 않는다.
function transactionToRow(tx: Transaction): (string | number)[] {
  const now = new Date().toISOString();
  return [
    tx.date,
    tx.time,
    tx.type,
    tx.majorCategory,
    tx.minorCategory,
    tx.content,
    tx.amount,
    tx.payment,
    tx.memo,
    tx.tags.map((t) => `#${t}`).join(" "),
    tx.createdAt || now,
    tx.updatedAt || now,
  ];
}

import { cacheTag } from "next/cache";

// 마스터 시트의 모든 거래를 읽어온다(헤더 행 제외).
export async function readTransactions(): Promise<Transaction[]> {
  await ensureHeaders();
  const sheets = getSheetsClient();
  const { spreadsheetId, sheetName } = getConfig();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A2:L`,
  });
  const rows = (res.data.values ?? []) as string[][];
  return rows.filter((r) => r.length > 0).map(rowToTransaction);
}

export async function getCachedTransactions(): Promise<Transaction[]> {
  "use cache";
  cacheTag("transactions");
  return await readTransactions();
}

// 신규 거래를 마스터 시트 최하단에 누적 append.
export async function appendTransactions(txs: Transaction[]): Promise<number> {
  if (txs.length === 0) return 0;
  await ensureHeaders();
  const sheets = getSheetsClient();
  const { spreadsheetId, sheetName } = getConfig();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:L`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: txs.map(transactionToRow) },
  });
  return txs.length;
}
