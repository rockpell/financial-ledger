import { NextResponse } from "next/server";
import { getCachedTransactions } from "@/lib/sheets";
import {
  availableMonths,
  tagCloud,
  filterByTags,
  filterByCategories,
  filterBySearchQuery,
  filterByMonths,
  monthlySpendByYear,
  monthlyIncomeExpense,
  monthlyCostStack,
  categoryBreakdown,
} from "@/lib/analytics";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthsParam = searchParams.get("months");
    const tagsParam = searchParams.get("tags");
    const catsParam = searchParams.get("categories");
    const qParam = searchParams.get("q");

    const selectedMonths = monthsParam ? monthsParam.split(",") : [];
    const selectedTags = tagsParam ? tagsParam.split(",") : [];
    const selectedCategories = catsParam ? catsParam.split(",") : [];
    const searchQuery = qParam || "";

    // 1. 전체 트랜잭션을 캐시에서 가져옴 (매우 빠름)
    const all = await getCachedTransactions();

    // 2. 전체 데이터 기반 메타(태그 클라우드, 월 목록)
    const tags = tagCloud(all);
    const months = availableMonths(all);

    // 3. 차트용 필터링 (다년도 흐름, 스택 등은 선택된 월과 상관없이 보여주므로 월 필터 적용 전 데이터 사용)
    let filtered = filterByTags(all, selectedTags);
    filtered = filterBySearchQuery(filtered, searchQuery);
    
    // 카테고리 필터가 적용되기 전의 월별 필터링 데이터 (카테고리별 지출 차트용)
    const scopedBeforeCats = filterByMonths(filtered, selectedMonths);
    const categoryData = categoryBreakdown(scopedBeforeCats);

    // 카테고리 필터까지 적용
    filtered = filterByCategories(filtered, selectedCategories);

    // 4. 전체 기간 기반 차트 데이터 연산
    const lineData = monthlySpendByYear(filtered);
    const incomeExpense = monthlyIncomeExpense(filtered);
    const costStack = monthlyCostStack(filtered);

    // 5. 최종 브라우저로 내려줄 특정 월(들)의 상세 트랜잭션 데이터
    const scoped = filterByMonths(filtered, selectedMonths);

    return NextResponse.json({
      transactions: scoped,
      totalCount: all.length,
      meta: {
        months,
        tags,
        lineData,
        incomeExpense,
        costStack,
        categoryData,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
