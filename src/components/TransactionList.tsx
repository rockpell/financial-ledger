"use client";

import { useEffect, useMemo, useState } from "react";
import type { Transaction } from "@/lib/types";
import { formatWon } from "@/lib/format";

const PAGE_SIZE = 50;

import { useDebouncedValue } from "@/lib/hooks";

function amountClass(tx: Transaction): string {
  if (tx.type === "수입") return "text-emerald-400";
  if (tx.type === "이체") return "text-neutral-400";
  return "text-rose-400"; // 지출
}

// 세부 거래 리스트. 현재 필터(태그+월)가 적용된 거래를 날짜 내림차순으로 표시.
export function TransactionList({ transactions }: { transactions: Transaction[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  // 입력은 즉시 반영하되, 실제 필터링은 입력이 멈춘 뒤에만 수행해 한글 IME 덜컹임 방지.
  const debouncedQuery = useDebouncedValue(query, 200);

  // 검색어가 확정되면 첫 페이지로 이동.
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const base = q
      ? transactions.filter(
          (t) =>
            t.content.toLowerCase().includes(q) ||
            t.majorCategory.toLowerCase().includes(q) ||
            t.minorCategory.toLowerCase().includes(q) ||
            t.payment.toLowerCase().includes(q) ||
            t.memo.toLowerCase().includes(q) ||
            t.tags.some((tag) => tag.toLowerCase().includes(q)),
        )
      : transactions;
    // 날짜+시간 내림차순(최신 우선).
    return [...base].sort((a, b) =>
      `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`),
    );
  }, [transactions, debouncedQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="내용·카테고리·결제수단·메모·태그 검색"
          className="w-full max-w-xs rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 outline-none focus:border-emerald-500"
        />
        <span className="text-xs text-neutral-500">{filtered.length.toLocaleString()}건</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-800">
        <table className="w-full min-w-[840px] text-left text-xs">
          <thead className="bg-neutral-900 text-neutral-400">
            <tr>
              <th className="px-3 py-2 font-medium">날짜</th>
              <th className="px-3 py-2 font-medium">타입</th>
              <th className="px-3 py-2 font-medium">카테고리</th>
              <th className="px-3 py-2 font-medium">내용</th>
              <th className="px-3 py-2 text-right font-medium">금액</th>
              <th className="px-3 py-2 font-medium">결제수단</th>
              <th className="px-3 py-2 font-medium">메모</th>
              <th className="px-3 py-2 font-medium">태그</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-neutral-500">
                  표시할 거래가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((tx, i) => (
                <tr
                  key={`${tx.date}-${tx.time}-${tx.content}-${i}`}
                  className="border-t border-neutral-800 hover:bg-neutral-800/40"
                >
                  <td className="whitespace-nowrap px-3 py-2 text-neutral-300">
                    {tx.date}
                    {tx.time && <span className="ml-1 text-neutral-600">{tx.time}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-neutral-400">{tx.type}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-neutral-400">
                    {tx.majorCategory}
                    {tx.minorCategory && (
                      <span className="text-neutral-600"> › {tx.minorCategory}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-neutral-200">{tx.content}</td>
                  <td className={`whitespace-nowrap px-3 py-2 text-right font-medium ${amountClass(tx)}`}>
                    {formatWon(tx.amount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-neutral-400">{tx.payment}</td>
                  <td className="max-w-[200px] px-3 py-2 text-neutral-400">{tx.memo}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {tx.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-emerald-300"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-xs text-neutral-400">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="rounded-lg border border-neutral-700 px-2.5 py-1 disabled:opacity-40 hover:bg-neutral-800"
          >
            이전
          </button>
          <span>
            {safePage} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="rounded-lg border border-neutral-700 px-2.5 py-1 disabled:opacity-40 hover:bg-neutral-800"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
