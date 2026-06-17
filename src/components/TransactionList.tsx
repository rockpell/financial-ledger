"use client";

import { useEffect, useMemo, useState } from "react";
import type { Transaction } from "@/lib/types";
import { formatWon } from "@/lib/format";
import { useDebouncedValue } from "@/lib/hooks";

const PAGE_SIZE = 50;

function amountClass(tx: Transaction): string {
  if (tx.type === "수입") return "text-emerald-400";
  if (tx.type === "이체") return "text-neutral-400";
  return "text-rose-400"; // 지출
}

function getCategoryIcon(major: string): string {
  if (major.includes("식비")) return "🍔";
  if (major.includes("교통") || major.includes("자동차")) return "🚌";
  if (major.includes("주거") || major.includes("통신")) return "🏠";
  if (major.includes("마트") || major.includes("편의점")) return "🛒";
  if (major.includes("패션") || major.includes("쇼핑") || major.includes("미용")) return "🛍️";
  if (major.includes("카페") || major.includes("간식")) return "☕";
  if (major.includes("술") || major.includes("유흥")) return "🍻";
  if (major.includes("의료") || major.includes("건강") || major.includes("병원")) return "🏥";
  if (major.includes("금융") || major.includes("보험") || major.includes("세금")) return "🏦";
  if (major.includes("문화") || major.includes("여가") || major.includes("여행")) return "🎬";
  if (major.includes("생활") || major.includes("마트")) return "🧺";
  if (major.includes("교육") || major.includes("학습")) return "📚";
  if (major.includes("경조사") || major.includes("회비")) return "💌";
  if (major.includes("수입") || major.includes("급여")) return "💰";
  if (major.includes("이체")) return "🔄";
  if (major === "미분류") return "❓";
  return "💳";
}

// ---------------------- Modal Component ----------------------
function TransactionModal({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  // 모달 외부 스크롤 방지
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "unset"; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-opacity" onClick={onClose}>
      <div 
        className="w-full max-w-md overflow-hidden rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()} // 내부 클릭 시 안닫히게
      >
        <div className="flex items-center justify-between border-b border-neutral-800 p-4 bg-neutral-900">
          <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <span>{getCategoryIcon(tx.majorCategory)}</span>
            상세 내역
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        
        <div className="p-6 space-y-5">
          <div className="text-center pb-5 border-b border-neutral-800/50">
            <p className="text-neutral-400 text-sm mb-1.5">{tx.content}</p>
            <p className={`text-3xl font-bold ${amountClass(tx)}`}>{formatWon(tx.amount)}</p>
          </div>

          <div className="grid grid-cols-[80px_1fr] gap-y-4 text-sm">
            <div className="text-neutral-500 font-medium">일시</div>
            <div className="text-neutral-200">{tx.date} {tx.time}</div>

            <div className="text-neutral-500 font-medium">유형</div>
            <div>
              <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold bg-neutral-800 ${amountClass(tx)}`}>
                {tx.type}
              </span>
            </div>

            <div className="text-neutral-500 font-medium">카테고리</div>
            <div className="text-neutral-200">
              {tx.majorCategory} {tx.minorCategory ? <span className="text-neutral-500 mx-1">›</span> : ""} {tx.minorCategory}
            </div>

            <div className="text-neutral-500 font-medium">결제수단</div>
            <div className="text-neutral-200">{tx.payment || "-"}</div>

            <div className="text-neutral-500 font-medium">메모</div>
            <div className="text-neutral-200 break-words whitespace-pre-wrap leading-relaxed">{tx.memo || "-"}</div>

            <div className="text-neutral-500 font-medium">태그</div>
            <div className="flex flex-wrap gap-1.5">
              {tx.tags.length > 0 ? tx.tags.map((t) => (
                <span key={t} className="rounded bg-neutral-800 border border-emerald-900/30 px-2 py-0.5 text-[11px] font-medium text-emerald-400">#{t}</span>
              )) : <span className="text-neutral-600">-</span>}
            </div>
          </div>
        </div>

        <div className="p-4 bg-neutral-900/80 border-t border-neutral-800">
          <button onClick={onClose} className="w-full rounded-xl bg-neutral-800 py-3 font-semibold text-neutral-200 hover:bg-neutral-700 active:bg-neutral-600 transition">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------- List Component ----------------------
export function TransactionList({ transactions }: { transactions: Transaction[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  
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
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="내용·카테고리·결제수단·메모·태그 검색"
          className="w-full max-w-xs rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-500 transition"
        />
        <span className="text-xs font-medium text-neutral-500">{filtered.length.toLocaleString()}건</span>
      </div>

      {/* Transaction List (Mobile Friendly) */}
      <div className="border-t border-neutral-800">
        {rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-neutral-500">표시할 거래가 없습니다.</div>
        ) : (
          <div className="flex flex-col">
            {rows.map((tx, i) => {
              // 이전 행과 날짜가 다르면 구분선(헤더) 렌더링
              const showDateDivider = i === 0 || rows[i - 1].date !== tx.date;
              return (
                <div key={`${tx.date}-${tx.time}-${tx.content}-${i}`}>
                  {showDateDivider && (
                    <div className="bg-neutral-900/95 px-5 py-2.5 border-y border-neutral-800 first:border-t-0 flex items-center sticky top-0 z-10 backdrop-blur-md">
                      <span className="text-xs font-bold text-neutral-400 tracking-wide">
                        {tx.date.replace(/-/g, ". ")}
                      </span>
                    </div>
                  )}
                  <div 
                    onClick={() => setSelectedTx(tx)}
                    className="group flex flex-col px-5 py-4 cursor-pointer hover:bg-neutral-800/60 active:bg-neutral-800 transition-colors"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-lg shadow-inner group-hover:bg-neutral-700 transition-colors mt-0.5">
                        {getCategoryIcon(tx.majorCategory)}
                      </div>
                      <div className="min-w-0 flex-1">
                        {/* Main row: Content, Time/Payment, Amount */}
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 pr-3">
                            <p className="truncate text-sm font-semibold text-neutral-200">{tx.content}</p>
                            <p className="truncate text-[11px] font-medium text-neutral-500 mt-0.5">
                              {tx.time} {tx.payment ? `· ${tx.payment}` : ""}
                            </p>
                          </div>
                          <div className={`shrink-0 text-right font-bold text-[15px] ${amountClass(tx)}`}>
                            {formatWon(tx.amount)}
                          </div>
                        </div>

                        {/* Sub row: Memo & Tags */}
                        {(tx.memo || tx.tags.length > 0) && (
                          <div className="mt-2.5 space-y-2">
                            {tx.memo && (
                              <p className="text-xs text-neutral-400 leading-relaxed line-clamp-2">
                                {tx.memo}
                              </p>
                            )}
                            {tx.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {tx.tags.map((t) => (
                                  <span key={t} className="rounded bg-neutral-800 border border-emerald-900/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2 pb-2 text-xs font-medium text-neutral-400 px-5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="rounded-lg border border-neutral-700 px-3.5 py-2 disabled:opacity-30 hover:bg-neutral-800 hover:text-neutral-200 transition-all active:scale-95"
          >
            이전
          </button>
          <span className="tabular-nums">
            {safePage} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="rounded-lg border border-neutral-700 px-3.5 py-2 disabled:opacity-30 hover:bg-neutral-800 hover:text-neutral-200 transition-all active:scale-95"
          >
            다음
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedTx && <TransactionModal tx={selectedTx} onClose={() => setSelectedTx(null)} />}
    </div>
  );
}
