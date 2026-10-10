import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiConnectionError, AUTH_SESSION_EXPIRED_EVENT, fetchWithSessionRefresh, resetSessionExpiry } from "./auth-session";

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

/**
 * A request that never reached the server.
 *
 * `fetch` rejects with the browser's own `TypeError: Failed to fetch`, and
 * this function is the single choke point every API call passes through — so
 * that English string used to travel all the way to the screen. Eighty-eight
 * call sites across the app render `reason.message` with a translated string
 * as a fallback that a rejected fetch never reaches, so every one of them
 * showed browser text in all eleven languages.
 */
describe("a request that does not complete", () => {
  it("rejects with a readable message instead of the browser's", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(fetchWithSessionRefresh(api, "/platform/projects")).rejects.toThrow(
      /could not reach the server/i,
    );
  });

  it("is distinguishable from a response the server refused", async () => {
    // A caller that wants to offer a retry button needs to tell "you are
    // offline" from "the server said no" — the second is worth reading, the
    // first is worth retrying.
    const fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(fetchWithSessionRefresh(api, "/platform/projects")).rejects.toBeInstanceOf(
      ApiConnectionError,
    );
  });

  it("keeps the original failure as the cause", async () => {
    // Readability must not cost debuggability: the network detail is still
    // there for whoever has to work out why.
    const original = new TypeError("NetworkError when attempting to fetch resource.");
    const fetch = vi.fn().mockRejectedValue(original);
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const failure = await fetchWithSessionRefresh(api, "/platform/projects").catch((r) => r);
    expect(failure).toBeInstanceOf(ApiConnectionError);
    expect((failure as ApiConnectionError).cause).toBe(original);
  });

  it("does not turn a refused response into a connection error", async () => {
    // A 500 is a response. It carries the server's own message and must keep
    // flowing to the caller rather than being replaced.
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetch);

    const response = await fetchWithSessionRefresh(api, "/platform/projects");
    expect(response.status).toBe(500);
  });
});
