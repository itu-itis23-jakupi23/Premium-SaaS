/**
 * Stopping cleanly when the platform asks.
 *
 * There was no signal handler at all, so SIGTERM - how Docker, Kubernetes and
 * most platforms begin a restart - killed the process immediately and dropped
 * every request in flight. For this API that includes recording a payment. The
 * idempotency machinery exists so a client can recover from exactly that, but
 * it is a safety net, not the normal path through a deploy.
 *
 * The logic lives here rather than in index.ts because it cannot be tested on
 * the machine it was written on: Windows has no POSIX signals, `taskkill`
 * without /F cannot reach a detached process, and `process.kill(pid,
 * "SIGTERM")` terminates outright without running handlers. Injecting the
 * server, the clock and `exit` is what makes the sequence verifiable anywhere.
 */

export interface ClosableServer {
  close(callback: (error?: Error) => void): unknown;
}

export interface ShutdownOptions {
  server: ClosableServer;
  /** Timers and workers to stop so none starts while the server drains. */
  stopWorkers: () => void;
  log: {
    info: (fields: Record<string, unknown>, message: string) => void;
    warn: (fields: Record<string, unknown>, message: string) => void;
    error: (fields: Record<string, unknown>, message: string) => void;
  };
  /** Bound on the drain. A request that never returns must not hold a deploy open. */
  graceMs?: number;
  exit?: (code: number) => void;
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
}

/**
 * Default grace period.
 *
 * Below the 30 seconds most platforms allow before SIGKILL, so the "did not
 * drain" line is written before the process is killed from outside - being
 * killed silently is the case that leaves nobody any the wiser.
 */
export const DEFAULT_SHUTDOWN_GRACE_MS = 15_000;

export function resolveGraceMs(raw: string | undefined): number {
  // Blank means unset, not zero. `Number("")` is 0, so without this an empty
  // `SHUTDOWN_GRACE_MS=` in a .env - a common way to leave a key present but
  // unconfigured - fell through to the one-second floor instead of the
  // default, cutting every drain short in production.
  const text = String(raw ?? "").trim();
  if (!text) return DEFAULT_SHUTDOWN_GRACE_MS;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return DEFAULT_SHUTDOWN_GRACE_MS;
  // A grace of zero would defeat the point; a second is the smallest useful one.
  return Math.max(1000, parsed);
}

/**
 * One shutdown sequence: stop listening, stop the workers, let requests finish.
 *
 * Returns a handler safe to attach to several signals. A second signal exits
 * at once rather than restarting the clock, so an impatient operator is
 * obeyed instead of being left looking at an apparently hung process.
 */
export function createShutdownHandler(options: ShutdownOptions) {
  const {
    server,
    stopWorkers,
    log,
    graceMs = DEFAULT_SHUTDOWN_GRACE_MS,
    exit = (code: number) => process.exit(code),
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  } = options;

  let shuttingDown = false;

  return function shutdown(signal: string) {
    if (shuttingDown) {
      log.warn({ signal }, "Second signal during shutdown: exiting now");
      exit(1);
      return;
    }
    shuttingDown = true;
    log.info({ signal, graceMs }, "Shutting down: draining connections");

    stopWorkers();

    const forced = setTimer(() => {
      log.error({ graceMs }, "Connections did not drain in time: exiting anyway");
      exit(1);
    }, graceMs) as ReturnType<typeof setTimeout>;
    // The timer must not itself keep the process alive once draining is done.
    forced.unref?.();

    server.close((error) => {
      clearTimer(forced);
      if (error) {
        log.error({ err: error.message }, "Error while closing the server");
        exit(1);
        return;
      }
      log.info({}, "Shutdown complete");
      exit(0);
    });
  };
}
