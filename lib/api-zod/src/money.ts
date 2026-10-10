/**
 * Line-item and document totals, in one place for both sides of the wire.
 *
 * This exists because the staff quote and invoice forms computed a preview
 * total one way and the API stored it another, so the figure a project manager
 * approved was not the figure the client received:
 *
 *   qty   price    PM saw    client got
 *   2.5   10.00     25.00        30.00
 *   0.5   480.00   240.00       480.00   (double)
 *   0.4   100.00    40.00         0.00   (free)
 *
 * Two causes. The API rounded `quantity` to a whole number, which is wrong for
 * this business - carpet is quoted in square metres, fascia in linear metres,
 * labour in part-days. And the two sides multiplied in a different order: the
 * form used `round(qty * price * 100)` while the API used
 * `qty * round(price * 100)`, which disagree whenever a price has a third
 * decimal.
 *
 * So the fix is not only to allow fractions but to have a single function both
 * sides call. Anything mathematically equivalent is not good enough; it has to
 * be the same code, or it drifts again.
 */

/** Largest value a Postgres `integer` column holds, and the cap on any total. */
export const MAX_CENTS = 2_147_483_647;

/**
 * Decimal places kept on a quantity.
 *
 * Three is enough for square metres and hours while keeping the product of
 * quantity and a cent price comfortably inside exact float range. It also
 * stops an absurd input (1e21, or 0.3333333333) becoming a stored value whose
 * rounding nobody can reproduce.
 */
export const QUANTITY_DECIMALS = 3;

/**
 * A quantity that can be stored and multiplied safely.
 *
 * Fractions are kept, which is the point, but the value is clamped to a sane
 * range and its precision fixed so the same input always yields the same
 * total. Anything unusable - NaN, Infinity, negative, a non-number - becomes 0
 * rather than throwing, because a malformed line should price at zero and be
 * visibly wrong, not take down the whole document.
 */
export function normalizeQuantity(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  const factor = 10 ** QUANTITY_DECIMALS;
  // Rounded through a scaled integer so 2.675 does not become 2.67.
  const scaled = Math.round(parsed * factor);
  if (!Number.isSafeInteger(scaled)) return 0;
  return scaled / factor;
}

/** A cent amount that can be stored in an integer column. */
export function normalizeCents(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Math.round(parsed), MAX_CENTS);
}

/**
 * What one line costs, in cents.
 *
 * The only correct order: normalise both inputs first, then multiply, then
 * round once. Rounding the price and the product separately is what made the
 * two sides disagree.
 */
export function lineTotalCents(quantity: unknown, unitPriceCents: unknown): number {
  const qty = normalizeQuantity(quantity);
  const unit = normalizeCents(unitPriceCents);
  if (qty === 0 || unit === 0) return 0;
  return Math.min(Math.round(qty * unit), MAX_CENTS);
}

/**
 * A major-unit price as typed by a person, in cents.
 *
 * Accepts a comma decimal separator, because most of the locales this product
 * ships in use one, and a form that silently dropped the fraction after a
 * comma would understate every price in those markets.
 */
export function priceToCents(value: unknown): number {
  if (typeof value === "number") return normalizeCents(value * 100);
  const text = String(value ?? "").trim().replace(",", ".");
  if (!text) return 0;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return 0;
  return normalizeCents(parsed * 100);
}

export interface DocumentTotalsInput {
  lineItems: Array<{ quantity?: unknown; unitPriceCents?: unknown }>;
  discountCents?: unknown;
  taxCents?: unknown;
}

export interface DocumentTotals {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}

/**
 * The totals for a quote or an invoice.
 *
 * `totalCents` floors at zero: a discount larger than the subtotal is a
 * mistake in the document, not an amount owed back to the customer, and a
 * negative total would be stored and then collected on.
 */
export function documentTotals(input: DocumentTotalsInput): DocumentTotals {
  const subtotalCents = Math.min(
    input.lineItems.reduce(
      (sum, item) => sum + lineTotalCents(item.quantity, item.unitPriceCents),
      0,
    ),
    MAX_CENTS,
  );
  const discountCents = normalizeCents(input.discountCents);
  const taxCents = normalizeCents(input.taxCents);
  return {
    subtotalCents,
    discountCents,
    taxCents,
    totalCents: Math.min(Math.max(0, subtotalCents - discountCents + taxCents), MAX_CENTS),
  };
}
