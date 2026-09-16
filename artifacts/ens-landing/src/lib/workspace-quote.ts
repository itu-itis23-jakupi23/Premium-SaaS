/**
 * How a workspace's cost estimate may be shown to someone.
 *
 * The estimate is the PM workspace's BOM total, and it covers only the items
 * that carry a price. The entire ENS furniture catalogue is currently priced at
 * zero, so a stand full of furniture yields a total for its structure and rooms
 * and nothing else. The PM's own BOM panel has always been honest about that -
 * it reads "$0 + 7 TBD" - but the client portal received the bare figure and
 * printed it under "Est. Cost", which presents a partial number as the price.
 *
 * Pure, and shared by both portals, so the two cannot drift into describing the
 * same number differently.
 */
export interface QuotePresentation {
  /** What to print as the figure. */
  value: string;
  /** What qualifies it, or null when the figure stands on its own. */
  note: string | null;
  /** True when the figure leaves priced-out items on the table. */
  partial: boolean;
}

export function quotePresentation(input: {
  costEstimateCents: number;
  unpricedItemCount?: number | null;
  formatMoney: (cents: number) => string;
  pendingLabel?: string;
}): QuotePresentation {
  const unpriced = Math.max(0, Math.round(Number(input.unpricedItemCount) || 0));
  const cents = Math.max(0, Math.round(Number(input.costEstimateCents) || 0));
  const items = unpriced === 1 ? "item" : "items";
  if (cents <= 0) {
    // Nothing priced at all. "Quote pending" is already the right words; the
    // note says why, so it does not read as "we have not got round to it".
    return {
      value: input.pendingLabel ?? "Quote pending",
      note: unpriced > 0 ? `${unpriced} ${items} still to be priced` : null,
      partial: unpriced > 0,
    };
  }
  if (unpriced > 0) {
    return {
      value: input.formatMoney(cents),
      note: `excludes ${unpriced} unpriced ${items}`,
      partial: true,
    };
  }
  return { value: input.formatMoney(cents), note: null, partial: false };
}
