"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Transaction } from "@/lib/types";
import {
  availableMonths,
  bigCategoryBreakdown,
  costTypeBreakdown,
  filterByMonths,
  filterByTags,
  monthlyCostStack,
  monthlyIncomeExpense,
  monthlySpendByYear,
  summary,
  tagCloud,
  topMerchants,
} from "@/lib/analytics";
import { formatWon } from "@/lib/format";
import { UploadPanel } from "./UploadPanel";
import { TagFilter } from "./TagFilter";
import { MonthSelector } from "./MonthSelector";
import { TransactionList } from "./TransactionList";
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
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-neutral-200">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export function Dashboard() {
  const router = useRouter();
  const [all, setAll] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/transactions", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `조회 실패 (${res.status})`);
      }
      const { transactions } = await res.json();
      setAll(transactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  // 태그 필터를 적용한 거래 집합 (선택 없으면 전체). 추세 차트(라인/월별 스택)는 이 전체 범위를 사용.
  const filtered = useMemo(() => filterByTags(all, selectedTags), [all, selectedTags]);
  // 월 필터까지 적용한 집합. 요약/파이/Top5/세부리스트는 선택 월에 반응.
  const scoped = useMemo(
    () => filterByMonths(filtered, selectedMonths),
    [filtered, selectedMonths],
  );

  const tags = useMemo(() => tagCloud(all), [all]);
  const months = useMemo(() => availableMonths(all), [all]);
  const sum = useMemo(() => summary(scoped), [scoped]);
  const lineData = useMemo(() => monthlySpendByYear(filtered), [filtered]);
  const incomeExpense = useMemo(() => monthlyIncomeExpense(filtered), [filtered]);
  const costPie = useMemo(() => costTypeBreakdown(scoped), [scoped]);
  const costStack = useMemo(() => monthlyCostStack(filtered), [filtered]);
  const bigCat = useMemo(() => bigCategoryBreakdown(scoped), [scoped]);
  const top5 = useMemo(() => topMerchants(scoped, 5), [scoped]);

  const scopeLabel =
    selectedMonths.length === 0
      ? "전체 기간"
      : selectedMonths.length === 1
        ? `${selectedMonths[0].slice(0, 4)}년 ${Number(selectedMonths[0].slice(5, 7))}월`
        : `선택 ${selectedMonths.length}개월`;

  const toggleMonth = (ym: string) =>
    setSelectedMonths((prev) =>
      prev.includes(ym) ? prev.filter((m) => m !== ym) : [...prev, ym],
    );

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
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

      <UploadPanel onAppended={load} />

      {error && (
        <div className="rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-300">
          ⚠️ {error}
        </div>
      )}

      {/* 요약 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <p className="text-xs text-neutral-500">
            총 수입 · {scopeLabel}
            {selectedTags.length > 0 && " (태그)"}
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">{formatWon(sum.totalIncome)}</p>
          <p className="mt-0.5 text-xs text-neutral-600">{sum.incomeCount.toLocaleString()}건</p>
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <p className="text-xs text-neutral-500">
            총 지출 · {scopeLabel}
            {selectedTags.length > 0 && " (태그)"}
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
          <p className="mt-1 text-2xl font-bold text-neutral-100">{all.length.toLocaleString()}건</p>
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

      {loading ? (
        <div className="py-20 text-center text-sm text-neutral-500">불러오는 중…</div>
      ) : all.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-10 text-center text-sm text-neutral-500">
          아직 데이터가 없습니다. 위에서 뱅크샐러드 엑셀을 업로드해 주세요.
        </div>
      ) : (
        <>
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

          <Card title="소비 Top 5" subtitle={`결제처 그룹화 기준 지출 상위 · ${scopeLabel}`}>
            <TopMerchantsBar data={top5} />
          </Card>

          <Card title="세부 거래 내역" subtitle={`${scopeLabel} · 검색 및 페이지 탐색 가능`}>
            <TransactionList transactions={scoped} />
          </Card>
        </>
      )}
    </div>
  );
}
