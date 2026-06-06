// 원화 포맷 (₩1,234,567)
const won = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

export function formatWon(value: number): string {
  return won.format(value);
}

// 축/툴팁용 축약 표기 (1.2만, 3.4억 등)
export function formatWonShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e8) return `${(value / 1e8).toFixed(1)}억`;
  if (abs >= 1e4) return `${Math.round(value / 1e4).toLocaleString("ko-KR")}만`;
  return value.toLocaleString("ko-KR");
}

// 차트 시리즈용 색상 팔레트.
export const CHART_COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ef4444", // rose
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
];
