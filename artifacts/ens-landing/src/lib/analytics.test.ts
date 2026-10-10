import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The property under test is that nothing is sent unless the visitor said yes.
 *
 * The module reads its provider from import.meta.env at load time, so each case
 * stubs the env and then imports it fresh — a module-level constant captured by
 * an earlier import would make every later assertion meaningless.
 */
describe("analytics seam", () => {
  const sent: unknown[] = [];

  async function load({ provider, url }: { provider?: string; url?: string }) {
    vi.resetModules();
    vi.stubEnv("VITE_ANALYTICS_PROVIDER", provider ?? "");
    vi.stubEnv("VITE_ANALYTICS_URL", url ?? "");
    return import("./analytics");
  }

  function grantConsent(granted: boolean | null) {
    const store = new Map<string, string>();
    if (granted !== null) {
      store.set(
        "ens-cookie-consent",
        JSON.stringify({ analytics: granted, decidedAt: new Date().toISOString(), version: 1 }),
      );
    }
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, v); },
        removeItem: (k: string) => { store.delete(k); },
      },
      addEventListener: () => {},
      location: { pathname: "/pricing" },
    };
  }

  // `navigator` is a getter-only global under Node, so it has to be defined
  // rather than assigned.
  function setNavigator(value: unknown) {
    Object.defineProperty(globalThis, "navigator", {
      value, configurable: true, writable: true,
    });
  }

  beforeEach(() => {
    sent.length = 0;
    setNavigator({
      sendBeacon: (_url: string, body: unknown) => { sent.push(body); return true; },
    });
    (globalThis as unknown as { Blob: unknown }).Blob = class {
      constructor(public parts: string[]) {}
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete (globalThis as unknown as { window?: unknown }).window;
    setNavigator(undefined);
  });

  it("sends nothing when no provider is configured", async () => {
    grantConsent(true);
    const { trackEvent } = await load({});
    trackEvent("landing_viewed");
    expect(sent).toHaveLength(0);
  });

  it("sends nothing when the visitor has not decided", async () => {
    grantConsent(null);
    const { trackEvent } = await load({ provider: "plausible", url: "https://example.test/e" });
    trackEvent("landing_viewed");
    expect(sent).toHaveLength(0);
  });

  it("sends nothing when the visitor declined", async () => {
    grantConsent(false);
    const { trackEvent } = await load({ provider: "plausible", url: "https://example.test/e" });
    trackEvent("quote_submitted");
    expect(sent).toHaveLength(0);
  });

  it("sends once the visitor has accepted", async () => {
    grantConsent(true);
    const { trackEvent } = await load({ provider: "plausible", url: "https://example.test/e" });
    trackEvent("quote_submitted");
    expect(sent).toHaveLength(1);
  });

  it("carries the path but never the query string", async () => {
    grantConsent(true);
    (globalThis as unknown as { window: { location: { pathname: string } } }).window.location = {
      pathname: "/reset-password",
    };
    const { trackEvent } = await load({ provider: "plausible", url: "https://example.test/e" });
    trackEvent("login_completed");

    const body = JSON.parse((sent[0] as { parts: string[] }).parts[0]) as Record<string, unknown>;
    expect(body.path).toBe("/reset-password");
    expect(JSON.stringify(body)).not.toContain("?");
    expect(JSON.stringify(body)).not.toContain("token");
  });

  it("never throws when delivery fails", async () => {
    grantConsent(true);
    setNavigator({ sendBeacon: () => { throw new Error("blocked"); } });
    const { trackEvent } = await load({ provider: "plausible", url: "https://example.test/e" });
    expect(() => trackEvent("landing_viewed")).not.toThrow();
  });

  it("holds events raised before a decision and sends them on acceptance", async () => {
    grantConsent(null);
    const mod = await load({ provider: "plausible", url: "https://example.test/e" });
    mod.trackEvent("landing_viewed");
    expect(sent).toHaveLength(0);

    // The visitor accepts; the page view that brought them here is not lost.
    grantConsent(true);
    mod.trackEvent("quote_form_opened");
    expect(sent).toHaveLength(2);
  });

  it("discards held events when the visitor declines", async () => {
    grantConsent(null);
    const mod = await load({ provider: "plausible", url: "https://example.test/e" });
    mod.trackEvent("landing_viewed");

    grantConsent(false);
    mod.trackEvent("quote_form_opened");
    expect(sent).toHaveLength(0);
  });
});
