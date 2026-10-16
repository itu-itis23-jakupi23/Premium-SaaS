import { describe, expect, it } from "vitest";
import {
  DEFAULT_KEEP_ALIVE_MS,
  applyConnectionTimeouts,
  resolveKeepAliveMs,
} from "./connection-timeouts";

describe("resolveKeepAliveMs", () => {
  it("defaults when the variable is absent", () => {
    expect(resolveKeepAliveMs(undefined)).toBe(DEFAULT_KEEP_ALIVE_MS);
  });

  it("treats a blank value as unset rather than zero", () => {
    // `KEEP_ALIVE_MS=` with nothing after it is a normal way to leave a key
    // present but unconfigured. Number("") is 0, which would switch keep-alive
    // off completely - the opposite of what this setting is for.
    for (const blank of ["", "   ", "\t"]) {
      expect(resolveKeepAliveMs(blank), JSON.stringify(blank)).toBe(DEFAULT_KEEP_ALIVE_MS);
    }
  });

  it("ignores a value that is not a number", () => {
    expect(resolveKeepAliveMs("soon")).toBe(DEFAULT_KEEP_ALIVE_MS);
  });

  it("takes a configured value", () => {
    expect(resolveKeepAliveMs("90000")).toBe(90_000);
  });

  it("will not accept a timeout short enough to recreate the fault", () => {
    expect(resolveKeepAliveMs("0")).toBe(1_000);
    expect(resolveKeepAliveMs("-5")).toBe(1_000);
  });
});

describe("applyConnectionTimeouts", () => {
  it("holds connections open longer than the proxies in front of it", () => {
    const server = { keepAliveTimeout: 5_000, headersTimeout: 60_000 };
    applyConnectionTimeouts(server);
    // Node's 5s default is below the 60s idle timeout of every common proxy,
    // which is what makes the server the side that closes.
    expect(server.keepAliveTimeout).toBeGreaterThan(60_000);
  });

  it("keeps headersTimeout strictly above keepAliveTimeout", () => {
    // The load-bearing one. If headersTimeout is the smaller, a connection can
    // be dropped while its headers are still arriving, which is the same
    // unexplained reset by another route.
    for (const ms of [1_000, 30_000, 65_000, 120_000]) {
      const server = { keepAliveTimeout: 0, headersTimeout: 0 };
      const applied = applyConnectionTimeouts(server, ms);
      expect(applied.headersTimeout, `keepAlive=${ms}`).toBeGreaterThan(applied.keepAliveTimeout);
      expect(server.headersTimeout).toBe(applied.headersTimeout);
    }
  });
});
