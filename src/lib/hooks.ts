import { useEffect, useState } from "react";

// 값이 일정 시간(delay) 동안 멈춘 뒤에만 갱신되는 디바운스 훅.
export function useDebouncedValue<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
