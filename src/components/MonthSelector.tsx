"use client";

interface Props {
  months: string[]; // YYYY-MM (최신 순)
  selected: string[]; // 선택된 YYYY-MM 목록 (빈 배열 = 전체)
  onToggle: (value: string) => void;
  onClear: () => void; // 전체로 초기화
}

// YYYY-MM -> "2026년 6월"
function label(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}년 ${Number(m)}월`;
}

// 월 다중 선택 필터. '전체' + 데이터에 존재하는 월 버튼(여러 개 동시 선택 가능).
export function MonthSelector({ months, selected, onToggle, onClear }: Props) {
  if (months.length === 0) return null;
  const selectedSet = new Set(selected);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {selected.length === 0 ? (
        <button className="rounded-full bg-emerald-600 px-3 py-1 text-xs text-white transition">
          전체 기간
        </button>
      ) : (
        <button
          onClick={onClear}
          className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-300 transition hover:bg-neutral-700"
        >
          ✕ 전체 기간 (필터 해제)
        </button>
      )}
      {months.map((ym) => {
        const active = selectedSet.has(ym);
        return (
          <button
            key={ym}
            onClick={() => onToggle(ym)}
            className={`rounded-full px-3 py-1 text-xs transition ${
              active
                ? "bg-emerald-600 text-white"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            {label(ym)}
          </button>
        );
      })}
    </div>
  );
}
