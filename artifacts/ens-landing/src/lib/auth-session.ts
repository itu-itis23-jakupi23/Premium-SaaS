import i18next from "i18next";
import { getRequestPortal, type RequestPortal } from "@/lib/portal";

export const AUTH_SESSION_EXPIRED_EVENT = "ens-auth-session-expired";

export interface AuthSessionExpiredDetail {
  portal: RequestPortal;
}

const refreshPromises: Record<RequestPortal, Promise<boolean> | null> = {
  staff: null,
  client: null,
};

const expiredPortals = new Set<RequestPortal>();

const NON_REFRESHABLE_AUTH_PATHS = new Set([
  "/auth/login",
  "/auth/signup",
  "/auth/signup-staff",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/logout",
  "/auth/refresh",
]);

export async function fetchWithSessionRefresh(
  apiBaseUrl: string,
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<Response> {
  const portal = getRequestPortal();
  const requestInit = withPortalHeaders(init, portal);
  const requestPath = path.split(/[?#]/, 1)[0];

  // Once the session is known-expired, stop hitting protected endpoints: each
  // real request would return 401 (which the browser logs as a console error)
  // and trigger another failed refresh. Short-circuit with a synthetic 401 so
  // the caller still handles it, but without the network noise. Auth endpoints
  // (login/refresh/…) must still go through so the user can sign back in.
  if (expiredPortals.has(portal) && !NON_REFRESHABLE_AUTH_PATHS.has(requestPath)) {
    return new Response(null, { status: 401, statusText: "Session expired" });
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, requestInit);
  } catch (reason) {
    /**
     * A request that never reached the server.
     *
     * `fetch` rejects with the browser's own `TypeError: Failed to fetch` (or
     * a localized variant of its choosing), and this is the only choke point
     * every API call passes through - so without this, that English string
     * travelled all the way to the screen. Eighty-eight call sites render
     * `reason.message` with a translated string as a fallback that a rejected
     * fetch never reaches, which left every one of them showing browser text
     * in all eleven languages.
     *
     * The original is kept as `cause` and logged, so the network detail a
     * developer needs is not lost in making the message readable.
     */
    console.error(`[api] request to ${path} did not complete:`, reason);
    throw new ApiConnectionError(connectionFailedMessage(), reason);
  }

  if (response.status !== 401) {
    if (response.ok && requestPath === "/auth/me") resetSessionExpiry(portal);
    return response;
  }

  if (retried || NON_REFRESHABLE_AUTH_PATHS.has(requestPath) || expiredPortals.has(portal)) {
    if (retried) markSessionExpired(portal);
    return response;
  }

  const refreshed = await refreshSession(apiBaseUrl, portal);
  if (!refreshed) {
    markSessionExpired(portal);
    return response;
  }

  resetSessionExpiry(portal);
  return fetchWithSessionRefresh(apiBaseUrl, path, requestInit, true);
}

/**
 * A request that did not complete, as opposed to one the server refused.
 *
 * Separated so a caller can tell "you are offline" from "the server said no":
 * the first is worth a retry button, the second is worth reading.
 */
export class ApiConnectionError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ApiConnectionError";
    this.cause = cause;
  }
}

/**
 * The connection message in the reader's language.
 *
 * i18next is a singleton, so this works outside React. It can be called
 * before the catalogue has loaded, though - an API call during boot, for
 * instance - and `t` then returns the key itself, so the English text is the
 * fallback rather than letting `experience.connectionFailed` reach the screen.
 */
function connectionFailedMessage(): string {
  const key = "experience.connectionFailed";
  const fallback = "Could not reach the server. Check your connection and try again.";
  if (!i18next.isInitialized) return fallback;
  const translated = i18next.t(key);
  return !translated || translated === key ? fallback : translated;
}

export function resetSessionExpiry(portal: RequestPortal = getRequestPortal()) {
  expiredPortals.delete(portal);
}

export function subscribeToSessionExpiry(
  handler: (detail: AuthSessionExpiredDetail) => void,
) {
  if (typeof window === "undefined") return () => undefined;

  const listener = (event: Event) => {
    handler((event as CustomEvent<AuthSessionExpiredDetail>).detail);
  };
  window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, listener);
  return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, listener);
}

function withPortalHeaders(init: RequestInit, portal: RequestPortal): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("x-ens-portal", portal);
  return {
    ...init,
    credentials: init.credentials ?? "include",
    headers,
  };
}

function refreshSession(apiBaseUrl: string, portal: RequestPortal) {
  if (!refreshPromises[portal]) {
    refreshPromises[portal] = fetch(`${apiBaseUrl}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-ens-portal": portal,
      },
    })
      .then((response) => {
        if (response.ok) return true;
        if (response.status === 401 || response.status === 403) return false;
        // A temporary service failure is not proof that the session expired.
        // Keep the user and their drafts in place so they can retry later.
        throw new Error(`Session renewal temporarily unavailable (${response.status}). Please try again.`);
      })
      .finally(() => {
        refreshPromises[portal] = null;
      });
  }

  return refreshPromises[portal];
}

function markSessionExpired(portal: RequestPortal) {
  if (expiredPortals.has(portal)) return;
  expiredPortals.add(portal);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<AuthSessionExpiredDetail>(AUTH_SESSION_EXPIRED_EVENT, {
      detail: { portal },
    }));
  }
}
