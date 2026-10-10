import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_SESSION_EXPIRED_EVENT, fetchWithSessionRefresh, resetSessionExpiry } from "./auth-session";

const api = "http://localhost:5000/api";
let expired: ReturnType<typeof vi.fn>;

beforeEach(() => {
  const browser = Object.assign(new EventTarget(), { location: { pathname: "/client", search: "", port: "5173" } });
  vi.stubGlobal("window", browser);
  expired = vi.fn();
  browser.addEventListener(AUTH_SESSION_EXPIRED_EVENT, expired);
  resetSessionExpiry("client");
  resetSessionExpiry("staff");
});
afterEach(() => {
  resetSessionExpiry("client");
  resetSessionExpiry("staff");
  vi.unstubAllGlobals();
});

describe("session renewal recovery", () => {
  it("renews an expired access session and repeats its request", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const response = await fetchWithSessionRefresh(api, "/platform/invoices");
    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(expired).not.toHaveBeenCalled();
    expect(new Headers(fetch.mock.calls[2][1].headers).get("x-ens-portal")).toBe("client");
  });

  it("does not sign the user out when renewal loses its connection", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockRejectedValueOnce(new TypeError("Connection lost"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await expect(fetchWithSessionRefresh(api, "/platform/invoices")).rejects.toThrow("Connection lost");
    expect(expired).not.toHaveBeenCalled();
    expect((await fetchWithSessionRefresh(api, "/platform/invoices")).ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it.each([429, 500, 503])("keeps the session retryable after renewal returns %s", async (status) => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await expect(fetchWithSessionRefresh(api, "/platform/invoices")).rejects.toThrow("temporarily unavailable");
    expect(expired).not.toHaveBeenCalled();
    expect((await fetchWithSessionRefresh(api, "/platform/invoices")).ok).toBe(true);
  });

  it.each([401, 403])("expires a session when renewal is actually denied with %s", async (status) => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status }));
    vi.stubGlobal("fetch", fetch);
    expect((await fetchWithSessionRefresh(api, "/platform/invoices")).status).toBe(401);
    expect(expired).toHaveBeenCalledTimes(1);
    expect((await fetchWithSessionRefresh(api, "/platform/projects")).status).toBe(401);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
