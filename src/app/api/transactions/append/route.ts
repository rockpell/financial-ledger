import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { appendTransactions, readTransactions } from "@/lib/sheets";
import { diffNewTransactions, uniqueKey } from "@/lib/parse";
import type { Transaction } from "@/lib/types";

// 업로드된 파싱 결과 중 마스터에 없는 신규 거래만 시트에 누적한다.
export async function POST(req: NextRequest) {
  let candidates: Transaction[] = [];
  try {
    const body = await req.json();
    candidates = Array.isArray(body?.transactions) ? body.transactions : [];
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  if (candidates.length === 0) {
    return NextResponse.json({ appended: 0, skipped: 0 });
  }

  try {
    // 서버에서 마스터를 다시 읽어 권위 있는 중복 제거를 수행.
    const existing = await readTransactions();
    const existingKeys = new Set(existing.map(uniqueKey));
    const newOnes = diffNewTransactions(candidates, existingKeys);
    const appended = await appendTransactions(newOnes);
    if (appended > 0) {
      revalidateTag("transactions", "default");
    }
    return NextResponse.json({
      appended,
      skipped: candidates.length - appended,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
