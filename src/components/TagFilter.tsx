"use client";

interface Props {
  tags: { tag: string; count: number }[];
  selected: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
}

// 해시태그 멀티 셀렉트 필터. 선택 시 대시보드가 해당 태그 거래만으로 리프레시된다.
export function TagFilter({ tags, selected, onToggle, onClear }: Props) {
  if (tags.length === 0) {
    return (
      <p className="text-xs text-neutral-500">
        메모에 #해시태그가 있는 거래가 아직 없습니다.
      </p>
    );
  }

  const selectedSet = new Set(selected);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {selected.length > 0 && (
        <button
          onClick={onClear}
          className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-700"
        >
          ✕ 필터 해제
        </button>
      )}
      {tags.map(({ tag, count }) => {
        const active = selectedSet.has(tag);
        return (
          <button
            key={tag}
            onClick={() => onToggle(tag)}
            className={`rounded-full px-3 py-1 text-xs transition ${
              active
                ? "bg-emerald-600 text-white"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            #{tag} <span className="opacity-60">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
