import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorReportingConfigured, reportError } from "./error-reporting";

/**
 * OP-02. The contract that matters here is not "reports get delivered" — it is
 * that the reporting path can never make an incident worse. Every test below
 * is a way this module could turn a handled error into an unhandled one.
 */

const ORIGINAL_URL = process.env.ERROR_WEBHOOK_URL;

describe("error reporting", () => {
  beforeEach(() => {
    delete process.env.ERROR_WEBHOOK_URL;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (ORIGINAL_URL === undefined) delete process.env.ERROR_WEBHOOK_URL;
    else process.env.ERROR_WEBHOOK_URL = ORIGINAL_URL;
  });

  it("reports as unconfigured when no webhook is set", () => {
    expect(errorReportingConfigured()).toBe(false);
  });

  it("treats a blank webhook as unconfigured", () => {
    process.env.ERROR_WEBHOOK_URL = "   ";
    expect(errorReportingConfigured()).toBe(false);
  });

  it("reports as configured once a webhook is set", () => {
    process.env.ERROR_WEBHOOK_URL = "https://collector.example/report";
    expect(errorReportingConfigured()).toBe(true);
  });

  it("does not deliver anything when unconfigured", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    reportError(new Error("boom"), { source: "http" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("delivers a structured payload when configured", async () => {
    process.env.ERROR_WEBHOOK_URL = "https://collector.example/report";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    reportError(new Error("boom"), {
      source: "http",
      method: "POST",
      route: "/api/platform/projects",
      statusCode: 500,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://collector.example/report");

    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.error.message).toBe("boom");
    expect(body.error.stack).toBeTruthy();
    expect(body.context.route).toBe("/api/platform/projects");
    expect(body.context.statusCode).toBe(500);
  });

  it("does not throw when the error is not an Error instance", () => {
    process.env.ERROR_WEBHOOK_URL = "https://collector.example/report";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));

    expect(() => reportError("a bare string", { source: "unhandledRejection" })).not.toThrow();
    expect(() => reportError(undefined, { source: "unhandledRejection" })).not.toThrow();
  });

  it("does not throw when the collector rejects", () => {
    process.env.ERROR_WEBHOOK_URL = "https://collector.example/report";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    // An unreachable collector during an outage must not amplify the outage.
    expect(() => reportError(new Error("boom"), { source: "http" })).not.toThrow();
  });

  it("does not throw when the webhook URL is malformed", () => {
    process.env.ERROR_WEBHOOK_URL = "not a url";
    vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new TypeError("Failed to parse URL");
    });

    expect(() => reportError(new Error("boom"), { source: "http" })).not.toThrow();
  });

  it("never includes request headers or bodies in the payload", async () => {
    process.env.ERROR_WEBHOOK_URL = "https://collector.example/report";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    reportError(new Error("boom"), { source: "http", route: "/api/messages" });

    const body = JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body));
    const serialised = JSON.stringify(body);
    // Credentials and message plaintext live in headers and bodies; the
    // context type has no field for either, and this pins that.
    expect(serialised).not.toContain("authorization");
    expect(serialised).not.toContain("cookie");
    expect(Object.keys(body)).toEqual(
      expect.arrayContaining(["service", "environment", "timestamp", "error", "context"]),
    );
  });
});
