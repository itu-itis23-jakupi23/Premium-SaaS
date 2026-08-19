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

  const response = await fetch(`${apiBaseUrl}${path}`, requestInit);

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
      .then((response) => response.ok)
      .catch(() => false)
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
