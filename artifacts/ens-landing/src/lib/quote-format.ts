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
