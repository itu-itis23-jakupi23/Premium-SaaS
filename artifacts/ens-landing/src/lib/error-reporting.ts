/**
 * Frontend error reporting seam (OP-02).
 *
 * `ErrorBoundary` previously called `console.error` and stopped there, so a
 * render crash in a customer's browser was invisible to the team. Errors that
 * never reach a boundary — event handlers, async callbacks, rejected promises
 * — were not captured at all.
 *
 * Delivery defaults to the first-party collector (`/client-errors` on the API,
 * derived from `VITE_API_BASE_URL`), so browser crashes reach the team's logs
 * with no external monitoring vendor. Set `VITE_ERROR_REPORT_URL` to override
 * the destination (e.g. a Sentry ingest URL).
 *
 * Constraints, because monitoring must never make a bad page worse:
 *
 *   - Never throws. Reporting failures are swallowed.
 *   - Never blocks rendering. Delivery uses `sendBeacon` where available and
 *     falls back to a keepalive fetch.
 *   - Sends the URL path only, never the query string or hash, which can
 *     carry invitation and reset tokens.
 *   - Rate limited, so a render loop cannot flood the collector.
 */

const EXPLICIT_REPORT_URL = import.meta.env.VITE_ERROR_REPORT_URL as string | undefined;
const API_BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:5000/api"
).replace(/\/+$/, "");
// Default to the app's own collector; an explicit env var overrides it.
const REPORT_URL =
  EXPLICIT_REPORT_URL && EXPLICIT_REPORT_URL.length > 0
    ? EXPLICIT_REPORT_URL
    : `${API_BASE_URL}/client-errors`;

/** Maximum reports per page load. A render loop can produce thousands. */
const MAX_REPORTS_PER_SESSION = 20;
let reportsSent = 0;

/** Suppress duplicates: identical messages in a loop add no information. */
const seen = new Set<string>();

export type FrontendErrorContext = {
  /** Where the failure was caught, e.g. "react" or "unhandledrejection". */
  source: string;
  /** React component stack, when the error came from an error boundary. */
  componentStack?: string;
};

export function errorReportingConfigured(): boolean {
  return typeof REPORT_URL === "string" && REPORT_URL.length > 0;
}

function safePath(): string {
  try {
    // Path only: query strings carry invitation and password-reset tokens.
    return window.location.pathname;
  } catch {
    return "unknown";
  }
}

export function reportError(error: unknown, context: FrontendErrorContext): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  // Always surface locally, whether or not a collector is configured.
  try {
    console.error(`[${context.source}]`, error);
  } catch {
    // Ignore: some embedded webviews restrict console access.
  }

  if (!errorReportingConfigured()) return;

  const fingerprint = `${context.source}:${message}`;
  if (seen.has(fingerprint)) return;
  if (reportsSent >= MAX_REPORTS_PER_SESSION) return;
  seen.add(fingerprint);
  reportsSent += 1;

  const payload = JSON.stringify({
    service: "ens-frontend",
    timestamp: new Date().toISOString(),
    path: safePath(),
    userAgent: typeof navigator === "undefined" ? undefined : navigator.userAgent,
    error: { message, stack },
    context,
  });

  try {
    // sendBeacon survives the page being torn down by the same crash.
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(REPORT_URL!, new Blob([payload], { type: "application/json" }));
      return;
    }

    void fetch(REPORT_URL!, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // An unreachable collector must not surface to the user.
    });
  } catch {
    // Never let reporting throw into the caller.
  }
}

/**
 * Capture errors that never reach a React error boundary: event handlers,
 * async callbacks, and rejected promises. Call once during startup.
 */
export function installGlobalErrorHandlers(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    reportError(event.error ?? event.message, { source: "window.onerror" });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, { source: "unhandledrejection" });
  });
}
