import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value` that only updates after
 * `delayMs` milliseconds have elapsed since the last change.
 *
 * Usage:
 *   const debouncedSearch = useDebounce(search, 250);
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
