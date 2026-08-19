import { afterEach, describe, expect, it } from "vitest";
import {
  PORTAL_MODE,
  getPortalHomePath,
  getRequestPortal,
  isRoleAllowedInPortal,
} from "./portal";

/**
 * `getRequestPortal` decides which authentication cookie namespace a request
 * belongs to, so its behaviour is security-relevant and easy to change by
 * accident.
 *
 * It is also the cause of a live defect: `/signup` is not under `/client/`, so
 * in the combined ("all") build it falls through to the `staff` default and
 * renders the invitation-only staff form — a visitor arriving from the
 * marketing page got an invitation-code field and no email/password inputs.
 * The current workaround is `?returnTo=/client` on every public signup link.
 *
 * These tests pin the behaviour that workaround depends on, so the planned fix
 * (resolving `client` for `/signup` directly) can be made with the blast radius
 * visible rather than guessed at.
 */

const originalWindow = (globalThis as { window?: unknown }).window;

function withLocation(pathname: string, search = "", port = "") {
  (globalThis as unknown as { window: unknown }).window = {
    location: { pathname, search, port },
  };
}

afterEach(() => {
  if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
  else (globalThis as { window?: unknown }).window = originalWindow;
});

describe("getRequestPortal", () => {
  it("defaults to staff for the marketing root", () => {
    withLocation("/");
    expect(getRequestPortal()).toBe("staff");
  });

  it("resolves client for /client paths", () => {
    withLocation("/client");
    expect(getRequestPortal()).toBe("client");
    withLocation("/client/workspace");
    expect(getRequestPortal()).toBe("client");
  });

  it("does not resolve client for a path merely starting with the word", () => {
    withLocation("/clients");
    expect(getRequestPortal()).toBe("staff");
  });

  it("resolves by dev port", () => {
    withLocation("/", "", "5174");
    expect(getRequestPortal()).toBe("staff");
    withLocation("/", "", "5175");
    expect(getRequestPortal()).toBe("client");
  });

  it("honours ?returnTo=/client — the current signup workaround", () => {
    // Public signup links carry this so /signup reaches the client form.
    withLocation("/signup", "?returnTo=/client");
    expect(getRequestPortal()).toBe("client");
    withLocation("/signup", "?returnTo=/client/workspace");
    expect(getRequestPortal()).toBe("client");
  });

  it("documents the defect: a bare /signup still resolves to staff", () => {
    // Not the desired behaviour — this asserts the bug so the fix that changes
    // it is deliberate and this test is updated alongside it.
    withLocation("/signup");
    expect(getRequestPortal()).toBe("staff");
  });

  it("falls back to staff when there is no window", () => {
    delete (globalThis as { window?: unknown }).window;
    expect(getRequestPortal()).toBe("staff");
  });
});

describe("role gating", () => {
  it("allows every role in the combined build", () => {
    // The unit run has no VITE_PORTAL, so PORTAL_MODE is the combined "all".
    expect(PORTAL_MODE).toBe("all");
    for (const role of ["chief", "pm", "client"] as const) {
      expect(isRoleAllowedInPortal(role)).toBe(true);
    }
  });

  it("sends the combined build home to the marketing root", () => {
    expect(getPortalHomePath()).toBe("/");
  });
});
