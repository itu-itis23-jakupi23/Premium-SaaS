import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  clearConsent,
  consentIsRequired,
  hasConsent,
  readConsent,
  shouldAskForConsent,
  writeConsent,
} from "./consent";

/**
 * The property that matters is that optional things stay off unless someone
 * said yes. Every test here is a way of not having said yes.
 *
 * The suite runs under Node by design (see vitest.config.ts: this module is
 * browser-free logic), so `window` is a small stub rather than jsdom. It needs
 * only the two surfaces consent.ts touches - storage and an event dispatcher -
 * and keeping it that way is a useful constraint on the module.
 */
function createStorageStub() {
  let store = new Map<string, string>();
  let failOn: "get" | "set" | null = null;
  return {
    fail(mode: "get" | "set" | null) { failOn = mode; },
    storage: {
      getItem(key: string) {
        if (failOn === "get") throw new Error("blocked");
        return store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        if (failOn === "set") throw new Error("quota");
        store.set(key, value);
      },
      removeItem(key: string) { store.delete(key); },
      clear() { store = new Map(); },
    },
  };
}

describe("cookie consent gate", () => {
  let stub: ReturnType<typeof createStorageStub>;

  const withProvider = (provider: string | undefined) => {
    vi.stubEnv("VITE_ANALYTICS_PROVIDER", provider ?? "");
  };

  beforeEach(() => {
    stub = createStorageStub();
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: stub.storage,
      dispatchEvent: () => true,
    };
    withProvider("plausible");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("denies analytics before any decision is made", () => {
    expect(readConsent()).toBeNull();
    expect(hasConsent("analytics")).toBe(false);
    expect(shouldAskForConsent()).toBe(true);
  });

  it("allows analytics only after an explicit yes", () => {
    writeConsent(true);
    expect(hasConsent("analytics")).toBe(true);
    expect(shouldAskForConsent()).toBe(false);
  });

  it("treats a decline as a decision, not as undecided", () => {
    writeConsent(false);
    expect(hasConsent("analytics")).toBe(false);
    // Decided: the visitor is not asked again.
    expect(shouldAskForConsent()).toBe(false);
  });

  it("never gates necessary cookies behind a choice", () => {
    expect(hasConsent("necessary")).toBe(true);
    writeConsent(false);
    expect(hasConsent("necessary")).toBe(true);
  });

  it("asks nothing when no optional purpose is configured", () => {
    withProvider(undefined);
    expect(consentIsRequired()).toBe(false);
    expect(shouldAskForConsent()).toBe(false);
    // And analytics stays off even if a stored yes is lying around, because
    // there is nothing it could consent to.
    writeConsent(true);
    expect(hasConsent("analytics")).toBe(false);
  });

  it("re-asks when the categories change under an old decision", () => {
    stub.storage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ analytics: true, decidedAt: new Date().toISOString(), version: CONSENT_VERSION - 1 }),
    );
    expect(readConsent()).toBeNull();
    expect(hasConsent("analytics")).toBe(false);
    expect(shouldAskForConsent()).toBe(true);
  });

  it("denies rather than throws on malformed storage", () => {
    stub.storage.setItem(CONSENT_STORAGE_KEY, "{not json");
    expect(() => readConsent()).not.toThrow();
    expect(hasConsent("analytics")).toBe(false);
  });

  it("denies when storage itself is unavailable", () => {
    stub.fail("get");
    expect(hasConsent("analytics")).toBe(false);
    stub.fail(null);
  });

  it("still records a choice when storage refuses to persist it", () => {
    stub.fail("set");
    expect(() => writeConsent(true)).not.toThrow();
    stub.fail(null);
  });

  it("forgets a decision when cleared", () => {
    writeConsent(true);
    clearConsent();
    expect(readConsent()).toBeNull();
    expect(hasConsent("analytics")).toBe(false);
  });
});
