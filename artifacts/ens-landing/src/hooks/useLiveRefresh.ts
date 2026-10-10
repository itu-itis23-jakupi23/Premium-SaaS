import { useEffect, useRef } from "react";
import { createRefreshLoop } from "@/lib/live-refresh";

/**
 * Keep something in step with the server while the tab is actually being looked at.
 *
 * Three behaviours, because a plain setInterval gets all three wrong:
 *
 *  - It pauses while the tab is hidden. A backgrounded tab polling every few
 *    seconds costs the server and the laptop battery for an answer nobody reads.
 *  - It refreshes immediately when the tab comes back, rather than waiting out
 *    the rest of the interval. Returning to a stale screen is the case users
 *    notice, and it is exactly the case a bare interval handles worst.
 *  - It reads the callback through a ref, so a caller passing an inline closure
 *    does not restart the timer on every render.
 *  - It waits for each request to finish, pauses offline, and catches up when
 *    connectivity returns. Repeated focus events cannot overlap requests.
 */
export function useLiveRefresh(
  refresh: () => void | Promise<void>,
  { intervalMs, enabled = true }: { intervalMs: number; enabled?: boolean },
) {
  const latest = useRef(refresh);
  latest.current = refresh;

  useEffect(() => {
    if (!enabled) return;

    const loop = createRefreshLoop(
      () => latest.current(), intervalMs,
      () => !document.hidden && navigator.onLine,
    );
    const run = () => { void loop.trigger(); };
    document.addEventListener("visibilitychange", run);
    window.addEventListener("focus", run);
    window.addEventListener("online", run);
    window.addEventListener("offline", run);

    return () => {
      loop.stop();
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("focus", run);
      window.removeEventListener("online", run);
      window.removeEventListener("offline", run);
    };
  }, [intervalMs, enabled]);
}
