"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Transaction } from "@/lib/types";
import {
  bigCategoryBreakdown,
  costTypeBreakdown,
  filterByTags,
  monthlyCostStack,
  monthlySpendByYear,
  summary,
  tagCloud,
  topMerchants,
} from "@/lib/analytics";
import { formatWon } from "@/lib/format";
import { UploadPanel } from "./UploadPanel";
import { TagFilter } from "./TagFilter";
import {
  BreakdownPie,
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

  // 태그 필터를 적용한 거래 집합 (선택 없으면 전체).
  const filtered = useMemo(() => filterByTags(all, selectedTags), [all, selectedTags]);

  const tags = useMemo(() => tagCloud(all), [all]);
  const sum = useMemo(() => summary(filtered), [filtered]);
  const lineData = useMemo(() => monthlySpendByYear(filtered), [filtered]);
  const costPie = useMemo(() => costTypeBreakdown(filtered), [filtered]);
  const costStack = useMemo(() => monthlyCostStack(filtered), [filtered]);
  const bigCat = useMemo(() => bigCategoryBreakdown(filtered), [filtered]);
  const top5 = useMemo(() => topMerchants(filtered, 5), [filtered]);

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

      {/* 요약 + 태그 필터 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <p className="text-xs text-neutral-500">총 지출 {selectedTags.length > 0 && "(필터)"}</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">{formatWon(sum.totalSpend)}</p>
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <p className="text-xs text-neutral-500">지출 건수</p>
          <p className="mt-1 text-2xl font-bold text-neutral-100">{sum.count.toLocaleString()}건</p>
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <p className="text-xs text-neutral-500">전체 거래(시트)</p>
          <p className="mt-1 text-2xl font-bold text-neutral-100">{all.length.toLocaleString()}건</p>
        </div>
      </div>

      <Card title="태그 필터" subtitle="선택 시 해당 #태그가 포함된 거래만으로 차트가 갱신됩니다.">
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

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="고정비 vs 변동비" subtitle="지출 성격별 비중">
              <BreakdownPie data={costPie} />
            </Card>
            <Card title="대형 카테고리 비중" subtitle="6개 그룹으로 재구조화">
              <BreakdownPie data={bigCat} />
            </Card>
          </div>

          <Card title="월별 고정비/변동비" subtitle="월별 스택 바 차트">
            <MonthlyStackBar data={costStack} />
          </Card>

          <Card title="소비 Top 5" subtitle="결제처 그룹화 기준 지출 상위">
            <TopMerchantsBar data={top5} />
          </Card>
        </>
      )}
    </div>
  );
}
