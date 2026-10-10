import { describe, expect, it } from "vitest";
import { resolveClientPortalUrl } from "./client-portal-url";

describe("client portal destinations", () => {
  const staff = { currentOrigin: "https://staff.example.test", portalMode: "staff" as const, development: false };

  it("keeps the configured customer origin, base path and selected project", () => {
    expect(resolveClientPortalUrl("/client/workspace?project=stand-1", { ...staff, configuredBaseUrl: "https://clients.example.test/portal/" }))
      .toBe("https://clients.example.test/portal/client/workspace?project=stand-1");
  });

  it("does not invent a client URL for a deployed separate staff portal", () => {
    expect(resolveClientPortalUrl("/forgot-password", staff)).toBeNull();
  });

  it.each(["localhost", "127.0.0.1"])("routes the local %s staff portal to the running client portal", (host) => {
    expect(resolveClientPortalUrl("/forgot-password", { ...staff, currentOrigin: `http://${host}:5174`, development: true }))
      .toBe(`http://${host}:5175/forgot-password`);
  });

  it.each(["client", "all"] as const)("uses the current origin for a %s build", (portalMode) => {
    expect(resolveClientPortalUrl("/client/invoices", { ...staff, portalMode })).toBe("https://staff.example.test/client/invoices");
  });

  it.each(["javascript:alert(1)", "https://secret@clients.test", "https://clients.test/?token=secret", "not a URL"])("rejects an unusable configured base: %s", (configuredBaseUrl) => {
    expect(resolveClientPortalUrl("/login", { ...staff, configuredBaseUrl })).toBeNull();
  });

  it("rejects a destination that can replace the configured origin", () => {
    expect(resolveClientPortalUrl("//other.test/login", { ...staff, configuredBaseUrl: "https://clients.test" })).toBeNull();
  });
});
