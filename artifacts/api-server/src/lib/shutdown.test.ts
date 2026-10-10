import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SHUTDOWN_GRACE_MS,
  createShutdownHandler,
  resolveGraceMs,
  type ClosableServer,
} from "./shutdown";

/**
 * The shutdown sequence.
 *
 * There was no signal handler, so SIGTERM - how a platform begins a restart -
 * killed the process at once and dropped every request in flight, payment
 * recording included.
 *
 * It is tested through injection rather than by signalling a real process,
 * because it cannot be signalled on the machine it was written on: Windows has
 * no POSIX signals, `taskkill` without /F cannot reach a detached process, and
 * `process.kill(pid, "SIGTERM")` terminates outright without running handlers.
 * An untestable sequence is how shutdown bugs survive until a deploy, so the
 * dependencies are parameters.
 */

function harness(options: { closeError?: Error; neverCloses?: boolean } = {}) {
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const exit = vi.fn();
  const stopWorkers = vi.fn();
  let closeCallback: ((error?: Error) => void) | null = null;

  const server: ClosableServer = {
    close(callback) {
      closeCallback = callback;
      if (!options.neverCloses) callback(options.closeError);
      return undefined;
    },
  };

  const timers: Array<{ fn: () => void; ms: number; cleared: boolean }> = [];
  const setTimer = ((fn: () => void, ms: number) => {
    const timer = { fn, ms, cleared: false };
    timers.push(timer);
    return { unref: () => undefined, timer } as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof setTimeout;
  const clearTimer = ((handle: { timer?: { cleared: boolean } }) => {
    if (handle?.timer) handle.timer.cleared = true;
  }) as unknown as typeof clearTimeout;

  const shutdown = createShutdownHandler({
    server,
    stopWorkers,
    log,
    graceMs: 5000,
    exit: exit as unknown as (code: number) => void,
    setTimer,
    clearTimer,
  });

  return { shutdown, log, exit, stopWorkers, timers, fireCloseNow: () => closeCallback?.() };
}

describe("createShutdownHandler", () => {
  it("stops the background workers before draining", () => {
    // A sweep that starts mid-drain writes to a database the process is about
    // to leave.
    const { shutdown, stopWorkers } = harness();
    shutdown("SIGTERM");
    expect(stopWorkers).toHaveBeenCalledTimes(1);
  });

  it("exits zero once connections have drained", () => {
    const { shutdown, exit, log } = harness();
    shutdown("SIGTERM");
    expect(exit).toHaveBeenCalledWith(0);
    expect(log.info).toHaveBeenCalledWith({}, "Shutdown complete");
  });

  it("clears the force timer on a clean close, so it cannot fire later", () => {
    // Left armed, it would exit(1) after a successful shutdown had already
    // reported success.
    const { shutdown, timers } = harness();
    shutdown("SIGTERM");
    expect(timers).toHaveLength(1);
    expect(timers[0].cleared).toBe(true);
  });

  it("gives up after the grace period rather than holding a deploy open", () => {
    const { shutdown, timers, exit, log } = harness({ neverCloses: true });
    shutdown("SIGTERM");
    expect(exit).not.toHaveBeenCalled();

    timers[0].fn();
    expect(exit).toHaveBeenCalledWith(1);
    expect(log.error).toHaveBeenCalledWith(
      { graceMs: 5000 },
      "Connections did not drain in time: exiting anyway",
    );
  });

  it("reports a failed close rather than claiming success", () => {
    const { shutdown, exit, log } = harness({ closeError: new Error("still bound") });
    shutdown("SIGTERM");
    expect(exit).toHaveBeenCalledWith(1);
    expect(log.error).toHaveBeenCalledWith({ err: "still bound" }, "Error while closing the server");
  });

  it("obeys a second signal instead of appearing to hang", () => {
    // An operator pressing Ctrl+C twice means it now.
    const { shutdown, exit, log, timers } = harness({ neverCloses: true });
    shutdown("SIGTERM");
    shutdown("SIGINT");
    expect(exit).toHaveBeenLastCalledWith(1);
    expect(log.warn).toHaveBeenCalledWith({ signal: "SIGINT" }, "Second signal during shutdown: exiting now");
    // And it did not start a second drain.
    expect(timers).toHaveLength(1);
  });

  it("does not stop the workers twice on a repeated signal", () => {
    const { shutdown, stopWorkers } = harness({ neverCloses: true });
    shutdown("SIGTERM");
    shutdown("SIGTERM");
    expect(stopWorkers).toHaveBeenCalledTimes(1);
  });

  it("names the signal it is acting on", () => {
    // The log line is how an operator tells a platform restart from a crash.
    const { shutdown, log } = harness();
    shutdown("SIGTERM");
    expect(log.info).toHaveBeenCalledWith(
      { signal: "SIGTERM", graceMs: 5000 },
      "Shutting down: draining connections",
    );
  });
});

describe("resolveGraceMs", () => {
  it("defaults when unset", () => {
    expect(resolveGraceMs(undefined)).toBe(DEFAULT_SHUTDOWN_GRACE_MS);
  });

  it("defaults on a non-numeric value rather than becoming NaN", () => {
    // NaN as a setTimeout delay fires immediately, which would turn a graceful
    // shutdown into an instant one - the bug this is replacing.
    expect(resolveGraceMs("soon")).toBe(DEFAULT_SHUTDOWN_GRACE_MS);
  });

  it("treats a blank value as unset, not as zero", () => {
    // `Number("")` is 0, so an empty `SHUTDOWN_GRACE_MS=` in a .env fell
    // through to the one-second floor and cut every drain short. A key left
    // present but unconfigured is the normal shape of a .env.
    expect(resolveGraceMs("")).toBe(DEFAULT_SHUTDOWN_GRACE_MS);
    expect(resolveGraceMs("   ")).toBe(DEFAULT_SHUTDOWN_GRACE_MS);
  });

  it("keeps a floor, so a grace of zero cannot defeat the point", () => {
    expect(resolveGraceMs("0")).toBe(1000);
    expect(resolveGraceMs("-5000")).toBe(1000);
  });

  it("honours a deliberate value", () => {
    expect(resolveGraceMs("25000")).toBe(25000);
  });

  it("stays below the usual platform grace by default", () => {
    // Above ~30s the platform sends SIGKILL first and the "did not drain"
    // line is never written.
    expect(DEFAULT_SHUTDOWN_GRACE_MS).toBeLessThan(30_000);
  });
});
