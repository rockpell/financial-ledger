import type { Transaction } from "./types";
import {
  BIG_CATEGORIES,
  type BigCategory,
  classifyCostType,
  incomeAmount,
  isIncome,
  isSpending,
  spendAmount,
  toBigCategory,
} from "./categories";

// ── 태그 필터 ──────────────────────────────────────────────────────────
// 선택된 태그가 있으면 해당 태그를 포함한 거래만 남긴다(OR, 기존 카테고리 필터 오버라이드).
export function filterByTags(txs: Transaction[], selectedTags: string[]): Transaction[] {
  if (selectedTags.length === 0) return txs;
  const set = new Set(selectedTags);
  return txs.filter((tx) => tx.tags.some((t) => set.has(t)));
}

// ── 월 필터 ────────────────────────────────────────────────────────────
// 데이터에 존재하는 YYYY-MM 목록(최신 순).
export function availableMonths(txs: Transaction[]): string[] {
  const set = new Set<string>();
  for (const tx of txs) {
    const ym = tx.date.slice(0, 7);
    if (ym.length === 7) set.add(ym);
  }
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

// 선택된 월(YYYY-MM) 목록으로 필터. 빈 배열이면 전체 반환.
export function filterByMonths(txs: Transaction[], yms: string[]): Transaction[] {
  if (yms.length === 0) return txs;
  const set = new Set(yms);
  return txs.filter((tx) => set.has(tx.date.slice(0, 7)));
}

// 전체 태그와 사용 빈도(많은 순).
export function tagCloud(txs: Transaction[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const tx of txs) {
    for (const t of tx.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

// ── 다년도 소비 흐름 (월별, 연도별 시리즈) ─────────────────────────────
export interface MonthlyYearPoint {
  month: number; // 1~12
  monthLabel: string; // "1월"
  [year: string]: number | string; // 연도별 지출 총액
}

export function monthlySpendByYear(txs: Transaction[]): {
  data: MonthlyYearPoint[];
  years: string[];
} {
  const years = new Set<string>();
  // [month][year] = sum
  const grid: Record<number, Record<string, number>> = {};
  for (let m = 1; m <= 12; m++) grid[m] = {};

  for (const tx of txs) {
    const amt = spendAmount(tx);
    if (amt === 0) continue;
    const [y, m] = tx.date.split("-");
    const month = Number(m);
    if (!y || !month) continue;
    years.add(y);
    grid[month][y] = (grid[month][y] ?? 0) + amt;
  }

  const yearList = Array.from(years).sort();
  const data: MonthlyYearPoint[] = [];
  for (let m = 1; m <= 12; m++) {
    const point: MonthlyYearPoint = { month: m, monthLabel: `${m}월` };
    for (const y of yearList) point[y] = grid[m][y] ?? 0;
    data.push(point);
  }
  return { data, years: yearList };
}

// ── 고정비 vs 변동비 ───────────────────────────────────────────────────
export function costTypeBreakdown(txs: Transaction[]): { name: string; value: number }[] {
  let fixed = 0;
  let variable = 0;
  for (const tx of txs) {
    const amt = spendAmount(tx);
    if (amt === 0) continue;
    if (classifyCostType(tx) === "고정비") fixed += amt;
    else variable += amt;
  }
  return [
    { name: "고정비", value: fixed },
    { name: "변동비", value: variable },
  ];
}

// 월별 고정비/변동비 스택 (해당 데이터에 존재하는 YYYY-MM 키 기준).
export interface MonthlyCostStack {
  ym: string; // "2026-06"
  고정비: number;
  변동비: number;
}

export function monthlyCostStack(txs: Transaction[]): MonthlyCostStack[] {
  const map = new Map<string, MonthlyCostStack>();
  for (const tx of txs) {
    const amt = spendAmount(tx);
    if (amt === 0) continue;
    const ym = tx.date.slice(0, 7);
    if (!ym) continue;
    if (!map.has(ym)) map.set(ym, { ym, 고정비: 0, 변동비: 0 });
    const bucket = map.get(ym)!;
    if (classifyCostType(tx) === "고정비") bucket.고정비 += amt;
    else bucket.변동비 += amt;
  }
  return Array.from(map.values()).sort((a, b) => a.ym.localeCompare(b.ym));
}

// ── 대형 카테고리 비중 ─────────────────────────────────────────────────
export function bigCategoryBreakdown(txs: Transaction[]): { name: BigCategory; value: number }[] {
  const totals = new Map<BigCategory, number>();
  for (const c of BIG_CATEGORIES) totals.set(c, 0);
  for (const tx of txs) {
    const amt = spendAmount(tx);
    if (amt === 0) continue;
    const big = toBigCategory(tx);
    totals.set(big, (totals.get(big) ?? 0) + amt);
  }
  return BIG_CATEGORIES.map((name) => ({ name, value: totals.get(name) ?? 0 })).filter(
    (d) => d.value > 0,
  );
}

// ── 소비처 Top N ───────────────────────────────────────────────────────
// 프랜차이즈 지점명("...판교테크노밸리점")을 제거해 결제처를 그룹화.
function normalizeMerchant(content: string): string {
  const stripped = content.replace(/\s+\S*점$/, "").trim();
  return stripped || content;
}

export function topMerchants(
  txs: Transaction[],
  n = 5,
): { name: string; value: number; count: number }[] {
  const map = new Map<string, { value: number; count: number }>();
  for (const tx of txs) {
    const amt = spendAmount(tx);
    if (amt === 0) continue;
    const name = normalizeMerchant(tx.content) || "(미상)";
    const cur = map.get(name) ?? { value: 0, count: 0 };
    cur.value += amt;
    cur.count += 1;
    map.set(name, cur);
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, value: v.value, count: v.count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

// 총 지출/수입 및 건수 요약. 순수지(net) = 수입 - 지출.
export interface Summary {
  totalSpend: number;
  count: number; // 지출 건수
  totalIncome: number;
  incomeCount: number;
  net: number;
}

export function summary(txs: Transaction[]): Summary {
  let totalSpend = 0;
  let count = 0;
  let totalIncome = 0;
  let incomeCount = 0;
  for (const tx of txs) {
    if (isSpending(tx)) {
      totalSpend += spendAmount(tx);
      count += 1;
    } else if (isIncome(tx)) {
      totalIncome += incomeAmount(tx);
      incomeCount += 1;
    }
  }
  return { totalSpend, count, totalIncome, incomeCount, net: totalIncome - totalSpend };
}

// 월별 수입/지출 비교 (데이터에 존재하는 YYYY-MM 기준, 오름차순).
export interface MonthlyIncomeExpense {
  ym: string;
  수입: number;
  지출: number;
}

export function monthlyIncomeExpense(txs: Transaction[]): MonthlyIncomeExpense[] {
  const map = new Map<string, MonthlyIncomeExpense>();
  for (const tx of txs) {
    const ym = tx.date.slice(0, 7);
    if (ym.length !== 7) continue;
    const spend = spendAmount(tx);
    const income = incomeAmount(tx);
    if (spend === 0 && income === 0) continue;
    if (!map.has(ym)) map.set(ym, { ym, 수입: 0, 지출: 0 });
    const bucket = map.get(ym)!;
    bucket.수입 += income;
    bucket.지출 += spend;
  }
  return Array.from(map.values()).sort((a, b) => a.ym.localeCompare(b.ym));
}
