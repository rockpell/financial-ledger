import { NextResponse } from "next/server";
import { readTransactions } from "@/lib/sheets";

export const runtime = "nodejs"; // googleapis는 Node 런타임 필요
export const dynamic = "force-dynamic";

// 마스터 시트의 전체 거래 조회 (대시보드 데이터 소스).
export async function GET() {
  try {
    const transactions = await readTransactions();
    return NextResponse.json({ transactions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
