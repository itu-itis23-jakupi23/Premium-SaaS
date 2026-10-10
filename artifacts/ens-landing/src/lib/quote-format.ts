// Shared formatting for quote UIs (staff + client), so money rendering and
// status colours aren't duplicated across the two pages.

export function money(cents: number, currency: string): string {
  const code = (currency || "USD").toUpperCase();
  // Intl throws a RangeError on a non-ISO currency code; fall back rather than
  // letting one malformed value crash the whole quotes render.
  try {
    return (cents / 100).toLocaleString(undefined, { style: "currency", currency: code });
  } catch {
    return `${(cents / 100).toFixed(2)} ${code}`;
  }
}

export const QUOTE_STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-600",
  viewed: "bg-amber-500/10 text-amber-600",
  accepted: "bg-green-500/10 text-green-600",
  rejected: "bg-red-500/10 text-red-600",
  expired: "bg-muted text-muted-foreground",
  revised: "bg-muted text-muted-foreground",
};

export const INVOICE_STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-blue-500/10 text-blue-600",
  paid: "bg-green-500/10 text-green-600",
  void: "bg-muted text-muted-foreground line-through",
  uncollectible: "bg-red-500/10 text-red-600",
};

/**
 * A quote the server will still accept a decision on.
 *
 * Only `sent` and `viewed` are respondable - POST /respond answers 409
 * `not_respondable` for anything else - so this is the gate on showing the
 * Accept and Decline buttons at all.
 */
export function isQuoteAwaitingResponse(status: string): boolean {
  return status === "sent" || status === "viewed";
}

/**
 * Past its validity date, whatever the stored status says.
 *
 * The server only moves a quote to `expired` when someone tries to respond to
 * it, so a quote can sit in `sent` long after `valid_until`. Deciding this
 * from the date rather than the status keeps the client portal from offering an
 * Accept button whose only possible outcome is a 409.
 *
 * `now` is injectable so the boundary can be pinned in a test rather than
 * depending on the clock the suite happens to run on.
 */
export function isQuoteExpired(
  quote: { status: string; validUntil: string | null },
  now: Date = new Date(),
): boolean {
  if (quote.status === "expired") return true;
  if (!quote.validUntil) return false;
  const until = new Date(quote.validUntil);
  // An unparseable date is not evidence of expiry; treat it as open and let
  // the server be the judge.
  if (Number.isNaN(until.getTime())) return false;
  return until < now;
}

/** Whole days from `now` until `iso`, rounded up. Negative once past. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000);
}
