import { CONSENT_EVENT, hasConsent } from "@/lib/consent";

/**
 * Product analytics seam (CS-05).
 *
 * The signup funnel was unmeasurable: there was no instrumentation at all, so
 * nobody could say how many people reached the quote form and how many finished
 * it. This is the seam that makes that answerable without committing the
 * product to a vendor — `VITE_ANALYTICS_PROVIDER` picks one, and with none set
 * the whole thing is inert.
 *
 * Consent is not a flag checked once at startup. Every call goes through
 * `hasConsent('analytics')`, which denies unless the visitor said yes, so a
 * tracked event cannot outlive a withdrawal (see lib/consent.ts).
 *
 * Constraints, matching the error-reporting seam:
 *
 *   - Never throws. A failed send is swallowed.
 *   - Never blocks. Delivery is `sendBeacon`, falling back to keepalive fetch.
 *   - Sends the URL path only, never the query string or hash, which carry
 *     invitation and reset tokens.
 *   - Carries no names, emails or free text — only the event name and small
 *     scalar properties the caller chose.
 */

const PROVIDER = (import.meta.env.VITE_ANALYTICS_PROVIDER as string | undefined) ?? "";
const ENDPOINT = (import.meta.env.VITE_ANALYTICS_URL as string | undefined) ?? "";

/** The funnel this exists to measure. A closed set, so typos cannot invent events. */
export type AnalyticsEvent =
  | "landing_viewed"
  | "quote_form_opened"
  | "quote_submitted"
  | "signup_opened"
  | "signup_completed"
  | "login_completed";

type EventProps = Record<string, string | number | boolean>;

/** Events fired before consent arrived, replayed if and when it does. */
const pending: { name: AnalyticsEvent; props?: EventProps }[] = [];
const MAX_PENDING = 20;

function analyticsEnabled(): boolean {
  return PROVIDER.length > 0 && ENDPOINT.length > 0;
}

/** Path only — a query string here would leak reset and invitation tokens. */
function currentPath(): string {
  try {
    return window.location.pathname;
  } catch {
    return "";
  }
}

function deliver(name: AnalyticsEvent, props?: EventProps): void {
  const payload = JSON.stringify({
    event: name,
    path: currentPath(),
    provider: PROVIDER,
    at: new Date().toISOString(),
    ...(props ? { props } : {}),
  });

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Analytics must never make a page worse than it would have been.
  }
}

/**
 * Record one funnel step.
 *
 * Safe to call anywhere: without a provider, or without consent, it does
 * nothing except remember the event in case consent arrives later in the
 * session.
 */
export function trackEvent(name: AnalyticsEvent, props?: EventProps): void {
  if (!analyticsEnabled()) return;

  if (!hasConsent("analytics")) {
    // Hold a bounded number, so a visitor who accepts after reading the notice
    // is not missing the page view that brought them there. Dropped entirely if
    // they decline.
    if (pending.length < MAX_PENDING) pending.push({ name, props });
    return;
  }

  flushPending();
  deliver(name, props);
}

function flushPending(): void {
  if (!hasConsent("analytics")) {
    pending.length = 0;
    return;
  }
  while (pending.length > 0) {
    const next = pending.shift();
    if (next) deliver(next.name, next.props);
  }
}

/**
 * Start listening for a consent decision.
 *
 * Called once at startup. On acceptance the held events are sent; on refusal
 * they are discarded rather than kept around for a later change of mind.
 */
export function initAnalytics(): void {
  if (!analyticsEnabled()) return;
  try {
    window.addEventListener(CONSENT_EVENT, () => {
      if (hasConsent("analytics")) flushPending();
      else pending.length = 0;
    });
  } catch {
    // No event target: the seam simply stays inert.
  }
}
