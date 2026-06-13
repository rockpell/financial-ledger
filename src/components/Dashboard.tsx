"use client";

import {
  bigCategoryBreakdown,
  costTypeBreakdown,
  summary,
  topMerchants
} from "@/lib/analytics";
import { formatWon } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MonthSelector } from "./MonthSelector";
import { TagFilter } from "./TagFilter";
import { TransactionList } from "./TransactionList";
import { UploadPanel } from "./UploadPanel";
import {
  BreakdownPie,
  MonthlyIncomeExpenseBar,
  MonthlyStackBar,
  MultiYearLineChart,
  TopMerchantsBar,
} from "./charts";

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-neutral-200">{title}</h2>
        {subtitle && <div className="mt-1.5 text-xs text-neutral-500">{subtitle}</div>}
      </div>
      {children}
    </section>
  );
}

export function Dashboard() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [appliedTags, setAppliedTags] = useState<string[]>([]);

  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [appliedMonths, setAppliedMonths] = useState<string[]>([]);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [appliedCategories, setAppliedCategories] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  
  const [isInitialized, setIsInitialized] = useState(false);

  const hasPendingChanges = 
    JSON.stringify(selectedTags) !== JSON.stringify(appliedTags) ||
    JSON.stringify(selectedMonths) !== JSON.stringify(appliedMonths) ||
    JSON.stringify(selectedCategories) !== JSON.stringify(appliedCategories) ||
    searchQuery !== appliedSearchQuery;

  const applyFilters = useCallback(() => {
    setAppliedTags(selectedTags);
    setAppliedMonths(selectedMonths);
    setAppliedCategories(selectedCategories);
    setAppliedSearchQuery(searchQuery);
  }, [selectedTags, selectedMonths, selectedCategories, searchQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (appliedMonths.length) params.set("months", appliedMonths.join(","));
      if (appliedTags.length) params.set("tags", appliedTags.join(","));
      if (appliedCategories.length) params.set("categories", appliedCategories.join(","));
      if (appliedSearchQuery) params.set("q", appliedSearchQuery);

      const res = await fetch(`/api/transactions?${params.toString()}`, { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `조회 실패 (${res.status})`);
      }
      const data = await res.json();
      setTransactions(data.transactions);
      setMeta(data.meta);
      setTotalCount(data.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [router, appliedMonths, appliedTags, appliedCategories, appliedSearchQuery]);

  useEffect(() => {
    const d = new Date();
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setSelectedMonths([ym]);
    setAppliedMonths([ym]);
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      load();
    }
  }, [load, isInitialized]);

  // 클라이언트 측 집계 (선택된 월/태그/카테고리로 완전히 필터링된 결과 기반)
  const sum = useMemo(() => summary(transactions), [transactions]);
  const costPie = useMemo(() => costTypeBreakdown(transactions), [transactions]);
  const bigCat = useMemo(() => bigCategoryBreakdown(transactions), [transactions]);
  const top5 = useMemo(() => topMerchants(transactions, 5), [transactions]);

  // 서버에서 제공하는 메타 데이터 (전체 기간 및 다년도 차트용)
  const tags = meta?.tags || [];
  const months = meta?.months || [];
  const lineData = meta?.lineData || { data: [], years: [] };
  const incomeExpense = meta?.incomeExpense || [];
  const costStack = meta?.costStack || [];
  const categoryData = meta?.categoryData || [];

  const scopeLabel =
    appliedMonths.length === 0
      ? "전체 기간"
      : appliedMonths.length === 1
        ? `${appliedMonths[0].slice(0, 4)}년 ${Number(appliedMonths[0].slice(5, 7))}월`
        : `선택 ${appliedMonths.length}개월`;

  const toggleMonth = (ym: string) =>
    setSelectedMonths((prev) =>
      prev.includes(ym) ? prev.filter((m) => m !== ym) : [...prev, ym],
    );

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );

  const toggleCategory = (cat: string) =>
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">가계부 대시보드</h1>
          <p className="text-sm text-neutral-500">뱅크샐러드 기반 커스텀 소비 분석</p>
        </div>
        <button
          onClick={logout}
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
        >
          로그아웃
        </button>
      </header>

      {hasPendingChanges && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <button
            onClick={applyFilters}
            className="flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-xl hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900 transition-all"
          >
            🚀 필터 적용하기
          </button>
        </div>
      )}

      <UploadPanel onAppended={load} />

      {/* 필터 적용 시 화면 갱신을 알리는 전체 화면 오버레이 */}
      {loading && isInitialized && (meta || totalCount > 0) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 backdrop-blur-[2px] transition-opacity">
          <div className="flex flex-col items-center space-y-3 rounded-2xl bg-neutral-900 p-6 shadow-2xl border border-neutral-800">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-700 border-t-blue-500"></div>
            <div className="text-sm font-medium text-neutral-300">데이터를 갱신하고 있습니다...</div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-300">
          ⚠️ {error}
        </div>
      )}

      {loading && totalCount === 0 && !meta ? (
        <div className="flex flex-col items-center justify-center space-y-4 py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-800 border-t-neutral-400"></div>
          <div className="text-sm font-medium text-neutral-500">데이터를 불러오는 중입니다...</div>
        </div>
      ) : totalCount === 0 ? (
        <div className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-900 p-10 text-center text-sm text-neutral-500">
          아직 데이터가 없습니다. 위에서 뱅크샐러드 엑셀을 업로드해 주세요.
        </div>
      ) : (
        <>
          {/* 요약 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
              <p className="text-xs text-neutral-500">
                총 수입 · {scopeLabel}
                {appliedTags.length > 0 && " (태그)"}
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-400">{formatWon(sum.totalIncome)}</p>
              <p className="mt-0.5 text-xs text-neutral-600">{sum.incomeCount.toLocaleString()}건</p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
              <p className="text-xs text-neutral-500">
                총 지출 · {scopeLabel}
                {appliedTags.length > 0 && " (태그)"}
              </p>
              <p className="mt-1 text-2xl font-bold text-rose-400">{formatWon(sum.totalSpend)}</p>
              <p className="mt-0.5 text-xs text-neutral-600">{sum.count.toLocaleString()}건</p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
              <p className="text-xs text-neutral-500">순수지 (수입−지출) · {scopeLabel}</p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  sum.net >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {formatWon(sum.net)}
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
              <p className="text-xs text-neutral-500">전체 거래(시트)</p>
              <p className="mt-1 text-2xl font-bold text-neutral-100">{totalCount.toLocaleString()}건</p>
            </div>
          </div>

          <Card title="기간 선택" subtitle="여러 달을 동시에 선택할 수 있습니다. 요약·비중·Top5·세부 리스트가 선택한 월 기준으로 갱신됩니다.">
            <MonthSelector
              months={months}
              selected={selectedMonths}
              onToggle={toggleMonth}
              onClear={() => setSelectedMonths([])}
            />
          </Card>

          <Card title="태그 필터" subtitle="선택 시 해당 #태그가 포함된 거래만으로 갱신됩니다.">
            <TagFilter
              tags={tags}
              selected={selectedTags}
              onToggle={toggleTag}
              onClear={() => setSelectedTags([])}
            />
          </Card>

          <Card title="내용 / 메모 검색" subtitle="거래 내용이나 메모에 포함된 단어로 검색합니다.">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
                placeholder="검색어를 입력하고 엔터 또는 필터 적용을 누르세요..."
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-neutral-200 focus:border-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-700"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                >
                  ✕
                </button>
              )}
            </div>
          </Card>
          <Card title="다년도 소비 흐름" subtitle="월별 지출 총액을 연도별로 비교">
            <MultiYearLineChart data={lineData.data} years={lineData.years} />
          </Card>

          <Card title="월별 수입 / 지출" subtitle="월별 수입과 지출 비교 (전체 기간)">
            <MonthlyIncomeExpenseBar data={incomeExpense} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="고정비 vs 변동비" subtitle={`지출 성격별 비중 · ${scopeLabel}`}>
              <BreakdownPie data={costPie} />
            </Card>
            <Card title="대형 카테고리 비중" subtitle={`6개 그룹으로 재구조화 · ${scopeLabel}`}>
              <BreakdownPie data={bigCat} />
            </Card>
          </div>

          <Card title="월별 고정비/변동비" subtitle="월별 스택 바 차트 (전체 기간)">
            <MonthlyStackBar data={costStack} />
          </Card>

          <Card 
            title="카테고리별 지출" 
            subtitle={selectedCategories.length > 0 
              ? `선택됨: ${selectedCategories.join(", ")} (다시 클릭하여 해제)` 
              : `세부 카테고리별 지출 현황 · ${scopeLabel} (클릭하여 필터)`}
          >
            <TopMerchantsBar 
              data={categoryData} 
              onClick={toggleCategory} 
              selectedKeys={selectedCategories} 
            />
          </Card>

          <Card title="소비 Top 5" subtitle={`결제처 그룹화 기준 지출 상위 · ${scopeLabel}`}>
            <TopMerchantsBar data={top5} />
          </Card>

          <Card 
            title="세부 거래 내역" 
            subtitle={
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-neutral-800 px-2 py-1 font-medium text-neutral-300">
                  🗓️ {scopeLabel}
                </span>
                {appliedTags.length > 0 && (
                  <span className="rounded-md border border-emerald-900/50 bg-emerald-950/50 px-2 py-1 font-medium text-emerald-400">
                    🏷️ {appliedTags.join(", ")}
                  </span>
                )}
                {appliedSearchQuery && (
                  <span className="rounded-md border border-purple-900/50 bg-purple-950/50 px-2 py-1 font-medium text-purple-400">
                    🔍 {appliedSearchQuery}
                  </span>
                )}
                {appliedCategories.length > 0 && (
                  <span className="rounded-md border border-blue-900/50 bg-blue-950/50 px-2 py-1 font-medium text-blue-400">
                    📂 {appliedCategories.join(", ")}
                  </span>
                )}
                <span className="ml-1 text-neutral-500">· 검색 및 페이지 탐색 가능</span>
              </div>
            }
          >
            <TransactionList transactions={transactions} />
          </Card>
        </>
      )}
    </div>
  );
}
