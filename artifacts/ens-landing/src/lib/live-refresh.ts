/** Refresh after completion so a slow connection cannot build a request backlog. */
export function createRefreshLoop(
  refresh: () => void | Promise<void>,
  intervalMs: number,
  isAvailable: () => boolean,
) {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new RangeError("Refresh interval must be positive");
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let inFlight = false;

  function cancelTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }

  function schedule() {
    if (!stopped && isAvailable()) timer = setTimeout(() => { void trigger(); }, intervalMs);
  }

  async function trigger() {
    cancelTimer();
    if (stopped || inFlight || !isAvailable()) return;
    inFlight = true;
    try {
      await refresh();
    } catch {
      // The page callback owns its error UI. A rejected refresh must not stop
      // subsequent recovery attempts or become an unhandled rejection.
    } finally {
      inFlight = false;
      schedule();
    }
  }

  schedule();
  return {
    trigger,
    stop() { stopped = true; cancelTimer(); },
  };
}
