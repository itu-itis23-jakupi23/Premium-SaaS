/**
 * Cookie consent (CS-03).
 *
 * This is a gate, not a banner. The point is that no non-essential cookie or
 * analytics tag can fire without a recorded choice — so the check lives here,
 * in one function every caller must go through, rather than in the component
 * that happens to draw the notice.
 *
 * What the app sets today is all strictly necessary or an explicit preference:
 * the auth cookies, the language the visitor picked, and the sidebar state
 * inside the authenticated app. None of those need prior consent, and asking
 * about them would be noise. The notice therefore appears only when something
 * genuinely optional is configured — see consentIsRequired().
 */

export type ConsentCategory = "necessary" | "analytics";

export interface ConsentState {
  analytics: boolean;
  /** ISO timestamp of the decision, so a stale choice can be re-asked later. */
  decidedAt: string;
  /** Bumped when the categories change, which invalidates an old decision. */
  version: number;
}

export const CONSENT_STORAGE_KEY = "ens-cookie-consent";
export const CONSENT_VERSION = 1;

/** Fired when consent changes, so a listener can start or stop a tag. */
export const CONSENT_EVENT = "ens:consent-changed";

/**
 * Whether anything on this deployment actually needs consent.
 *
 * With no analytics provider configured there is no optional cookie to ask
 * about, and a notice would be asking permission for something that never
 * happens. Configure the provider and the notice appears.
 */
export function consentIsRequired(): boolean {
  return Boolean(import.meta.env.VITE_ANALYTICS_PROVIDER);
}

export function readConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    // A decision made against a different set of categories is not a decision
    // about these ones.
    if (parsed.version !== CONSENT_VERSION) return null;
    if (typeof parsed.analytics !== "boolean") return null;
    return {
      analytics: parsed.analytics,
      decidedAt: typeof parsed.decidedAt === "string" ? parsed.decidedAt : new Date().toISOString(),
      version: CONSENT_VERSION,
    };
  } catch {
    // Private mode, blocked storage, or malformed JSON: treat as undecided,
    // which denies everything optional.
    return null;
  }
}

export function writeConsent(analytics: boolean): ConsentState {
  const state: ConsentState = {
    analytics,
    decidedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage refused. The choice still applies to this page view through the
    // event below; the visitor will be asked again next time, which is the
    // safe direction to fail.
  }
  try {
    window.dispatchEvent(new CustomEvent<ConsentState>(CONSENT_EVENT, { detail: state }));
  } catch { /* no CustomEvent in this environment */ }
  return state;
}

/** Forget the decision, so the visitor is asked again. */
export function clearConsent(): void {
  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch { /* nothing to clear */ }
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: null }));
  } catch { /* no CustomEvent in this environment */ }
}

/**
 * The gate. Nothing optional may run without passing through here.
 *
 * Undecided is not the same as allowed: an absent decision denies, which is
 * what makes a missing or broken banner fail closed rather than open.
 */
export function hasConsent(category: ConsentCategory): boolean {
  if (category === "necessary") return true;
  if (!consentIsRequired()) return false;
  return readConsent()?.analytics === true;
}

/** Whether the notice should be on screen right now. */
export function shouldAskForConsent(): boolean {
  return consentIsRequired() && readConsent() === null;
}
