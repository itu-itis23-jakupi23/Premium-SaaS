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
 * `/signup` used to fall through to the `staff` default in the combined build
 * and render the invitation-only staff form — a visitor arriving from the
 * marketing page got an invitation-code field and no email/password inputs.
 * It now resolves to `client` directly; `?returnTo=/client` still works but is
 * no longer required.
 *
 * The cases below pin every branch of the resolution order, including the ones
 * that must NOT change: the staff invitation route, explicit role opt-in, and
 * the dev-port and build-mode short circuits.
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

  it("resolves a bare /signup to the client portal", () => {
    // Public signup is client signup. This used to fall through to the staff
    // default and render the invitation-only form - an invitation-code field
    // and no email or password input.
    withLocation("/signup");
    expect(getRequestPortal()).toBe("client");
  });

  it("keeps the staff invitation-code entry point on an explicit role", () => {
    // Signup.tsx still offers a staff branch for someone holding a code but
    // not the /pm/join link, so staff can opt back in explicitly.
    withLocation("/signup", "?role=pm");
    expect(getRequestPortal()).toBe("staff");
    withLocation("/signup", "?role=chief");
    expect(getRequestPortal()).toBe("staff");
    withLocation("/signup", "?role=CHIEF");
    expect(getRequestPortal()).toBe("staff");
  });

  it("ignores a client or unknown role on /signup", () => {
    withLocation("/signup", "?role=client");
    expect(getRequestPortal()).toBe("client");
    withLocation("/signup", "?role=banana");
    expect(getRequestPortal()).toBe("client");
  });

  it("leaves the staff invitation route alone", () => {
    // Invitations are emailed as /pm/join?token=..., which must stay staff.
    withLocation("/pm/join", "?token=abc123");
    expect(getRequestPortal()).toBe("staff");
  });

  it("does not treat /signup-like paths as signup", () => {
    withLocation("/signup-complete");
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
