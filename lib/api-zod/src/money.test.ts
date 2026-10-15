import { describe, expect, it } from "vitest";
import {
  MAX_CENTS,
  documentTotals,
  lineTotalCents,
  normalizeCents,
  normalizeQuantity,
  priceToCents,
} from "./money";

/**
 * Money arithmetic for quotes and invoices.
 *
 * This exists because the staff forms and the API disagreed on what a line
 * cost, so a project manager approved one figure and the client received
 * another:
 *
 *   qty   price    PM saw    client got
 *   2.5   10.00     25.00        30.00
 *   0.5   480.00   240.00       480.00
 *   0.4   100.00    40.00         0.00
 *
 * The API rounded `quantity` to a whole number, and the two sides multiplied
 * in a different order. Both now call this module, so the cases below are the
 * contract that keeps them together.
 */

/** The old API behaviour, kept here as the thing that must never come back. */
function legacyServerLineTotal(quantity: number, unitPriceCents: number): number {
  const toInt = (value: unknown) => {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? n : 0;
  };
  return Math.max(0, toInt(quantity)) * Math.max(0, toInt(unitPriceCents));
}

describe("lineTotalCents", () => {
  it("keeps a fractional quantity instead of rounding it to a whole one", () => {
    // Carpet is quoted by the square metre; this is an ordinary line item.
    expect(lineTotalCents(2.5, 1000)).toBe(2500);
    expect(lineTotalCents(0.5, 48000)).toBe(24000);
    expect(lineTotalCents(12.75, 4000)).toBe(51000);
  });

  it("does not price a part-unit line at zero", () => {
    // 0.4 rounded to 0, which made the line free.
    expect(lineTotalCents(0.4, 10000)).toBe(4000);
    expect(lineTotalCents(0.001, 100000)).toBe(100);
  });

  it("fixes each case where the old behaviour overcharged or undercharged", () => {
    for (const [quantity, unitPriceCents, expected] of [
      [2.5, 1000, 2500],
      [0.4, 10000, 4000],
      [1.5, 20000, 30000],
      [0.5, 48000, 24000],
      [12.75, 4000, 51000],
    ] as const) {
      expect(lineTotalCents(quantity, unitPriceCents)).toBe(expected);
      // And confirm the legacy formula really did differ, so this test cannot
      // quietly stop covering a regression.
      expect(legacyServerLineTotal(quantity, unitPriceCents)).not.toBe(expected);
    }
  });

  it("agrees with the old behaviour on whole quantities", () => {
    // The fix must not move prices that were already correct.
    for (const [quantity, unitPriceCents] of [[1, 1000], [3, 1010], [12, 45], [200, 999]] as const) {
      expect(lineTotalCents(quantity, unitPriceCents)).toBe(
        legacyServerLineTotal(quantity, unitPriceCents),
      );
    }
  });

  it("rounds a part-cent product once, to the nearest cent", () => {
    // 0.333 x 1000 = 333.0 exactly; 0.3335 x 1000 would be 333.5 -> 334.
    expect(lineTotalCents(0.333, 1000)).toBe(333);
    expect(lineTotalCents(1.005, 1000)).toBe(1005);
  });

  it("prices an unusable line at zero rather than throwing", () => {
    // A malformed line should be visibly wrong, not take down the document.
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1, "abc", null, undefined, {}]) {
      expect(lineTotalCents(bad, 1000), String(bad)).toBe(0);
      expect(lineTotalCents(2, bad), String(bad)).toBe(0);
    }
  });

  it("cannot exceed what an integer column holds", () => {
    expect(lineTotalCents(1000000, MAX_CENTS)).toBe(MAX_CENTS);
  });
});

describe("normalizeQuantity", () => {
  it("keeps three decimals and rounds beyond that", () => {
    expect(normalizeQuantity(2.5)).toBe(2.5);
    expect(normalizeQuantity(0.333)).toBe(0.333);
    expect(normalizeQuantity(0.3333)).toBe(0.333);
    expect(normalizeQuantity(2.6755)).toBe(2.676);
  });

  it("reads a numeric string, as a form supplies it", () => {
    expect(normalizeQuantity("2.5")).toBe(2.5);
    expect(normalizeQuantity("  3 ")).toBe(3);
  });

  it("treats nothing, zero and negatives as zero", () => {
    for (const bad of ["", null, undefined, 0, -2, Number.NaN, "abc"]) {
      expect(normalizeQuantity(bad), String(bad)).toBe(0);
    }
  });

  it("refuses a quantity too large to multiply exactly", () => {
    // 1e21 x 1000 leaves exact float range, where a stored total would be
    // unreproducible.
    expect(normalizeQuantity(1e21)).toBe(0);
  });
});

describe("priceToCents", () => {
  it("converts a typed major-unit price", () => {
    expect(priceToCents("10")).toBe(1000);
    expect(priceToCents("10.10")).toBe(1010);
    expect(priceToCents("0.01")).toBe(1);
  });

  it("accepts a comma decimal separator", () => {
    // Most of the eleven locales this ships in use one; dropping the fraction
    // after a comma would understate every price in those markets.
    expect(priceToCents("10,50")).toBe(1050);
  });

  it("rounds a third decimal to the nearest cent", () => {
    expect(priceToCents("10.105")).toBe(1011);
    expect(priceToCents("10.104")).toBe(1010);
  });

  it("is zero for anything unusable", () => {
    for (const bad of ["", "abc", null, undefined, "-5", Number.NaN]) {
      expect(priceToCents(bad), String(bad)).toBe(0);
    }
  });
});

describe("documentTotals", () => {
  const lineItems = [
    { quantity: 2.5, unitPriceCents: 1000 },
    { quantity: 1, unitPriceCents: 25000 },
  ];

  it("sums the lines, then applies discount and tax", () => {
    expect(documentTotals({ lineItems, discountCents: 500, taxCents: 1000 })).toEqual({
      subtotalCents: 27500,
      discountCents: 500,
      taxCents: 1000,
      totalCents: 28000,
    });
  });

  it("floors the total at zero when a discount exceeds the subtotal", () => {
    // A discount larger than the subtotal is a mistake in the document, not
    // money owed back; a negative total would be stored and then collected on.
    const totals = documentTotals({ lineItems, discountCents: 999999, taxCents: 0 });
    expect(totals.totalCents).toBe(0);
    // The subtotal is still reported honestly, so the error is visible.
    expect(totals.subtotalCents).toBe(27500);
  });

  it("is zero for a document with no lines", () => {
    expect(documentTotals({ lineItems: [] })).toEqual({
      subtotalCents: 0,
      discountCents: 0,
      taxCents: 0,
      totalCents: 0,
    });
  });

  it("ignores a line whose quantity or price is unusable", () => {
    const totals = documentTotals({
      lineItems: [{ quantity: 2, unitPriceCents: 1000 }, { quantity: "x", unitPriceCents: 5000 }],
    });
    expect(totals.subtotalCents).toBe(2000);
  });

  it("keeps every amount inside an integer column", () => {
    const totals = documentTotals({
      lineItems: [{ quantity: 1000, unitPriceCents: MAX_CENTS }],
      taxCents: MAX_CENTS,
    });
    expect(totals.subtotalCents).toBeLessThanOrEqual(MAX_CENTS);
    expect(totals.totalCents).toBeLessThanOrEqual(MAX_CENTS);
  });
});

describe("normalizeCents", () => {
  it("rounds to a whole cent and clamps to the column ceiling", () => {
    expect(normalizeCents(1000.4)).toBe(1000);
    expect(normalizeCents(1000.5)).toBe(1001);
    expect(normalizeCents(MAX_CENTS + 1000)).toBe(MAX_CENTS);
  });

  it("is zero for a negative or unusable amount", () => {
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, "abc", null]) {
      expect(normalizeCents(bad), String(bad)).toBe(0);
    }
  });
});

/**
 * The round trip, which is what the agreement actually rests on.
 *
 * The staff form normalises, previews a total, and sends the normalised values;
 * the API normalises again and recomputes. So the two only agree if
 * normalising is idempotent and the recomputation reproduces the preview
 * exactly. Sharing one module makes that likely, not certain - these pin it.
 */
describe("form preview and stored document", () => {
  /** What the staff form shows while composing. */
  function preview(lines: Array<{ quantity: string; unitPrice: string }>, discount: string, tax: string) {
    return documentTotals({
      lineItems: lines.map((l) => ({ quantity: l.quantity, unitPriceCents: priceToCents(l.unitPrice) })),
      discountCents: priceToCents(discount),
      taxCents: priceToCents(tax),
    });
  }

  /** What the API recomputes from the payload the form sends. */
  function stored(lines: Array<{ quantity: string; unitPrice: string }>, discount: string, tax: string) {
    const sent = lines.map((l) => ({
      quantity: normalizeQuantity(l.quantity),
      unitPriceCents: priceToCents(l.unitPrice),
    }));
    return documentTotals({
      lineItems: sent.map((item) => ({
        quantity: normalizeQuantity(item.quantity),
        unitPriceCents: normalizeCents(item.unitPriceCents),
      })),
      discountCents: normalizeCents(priceToCents(discount)),
      taxCents: normalizeCents(priceToCents(tax)),
    });
  }

  it("match on the quantities that used to disagree", () => {
    for (const lines of [
      [{ quantity: "2.5", unitPrice: "10" }],
      [{ quantity: "0.4", unitPrice: "100" }],
      [{ quantity: "0.5", unitPrice: "480" }],
      [{ quantity: "12.75", unitPrice: "40" }],
      [{ quantity: "1.5", unitPrice: "200" }],
    ]) {
      expect(stored(lines, "0", "0"), JSON.stringify(lines)).toEqual(preview(lines, "0", "0"));
    }
  });

  it("match on a multi-line document with a discount and tax", () => {
    const lines = [
      { quantity: "2.5", unitPrice: "10.10" },
      { quantity: "0.333", unitPrice: "999.99" },
      { quantity: "12", unitPrice: "0.01" },
    ];
    expect(stored(lines, "12.50", "7.25")).toEqual(preview(lines, "12.50", "7.25"));
  });

  it("match on a comma decimal, as a European locale supplies it", () => {
    const lines = [{ quantity: "2,5", unitPrice: "10,50" }];
    expect(stored(lines, "1,25", "0")).toEqual(preview(lines, "1,25", "0"));
  });

  it("normalises idempotently, which is why the recomputation agrees", () => {
    for (const value of [2.5, 0.333, 0.3335, 12.75, 1, 0.001, "2,5", "0.4"]) {
      const once = normalizeQuantity(value);
      expect(normalizeQuantity(once), String(value)).toBe(once);
    }
    for (const value of [1000, 1010.5, 0, MAX_CENTS]) {
      const once = normalizeCents(value);
      expect(normalizeCents(once), String(value)).toBe(once);
    }
  });
});

/**
 * The integer ceiling, which is a database constraint rather than a nicety.
 *
 * Every money column is `integer`, so 2,147,483,647 cents - about 21.5 million
 * in the major unit - is the most any single field holds. Values above it do
 * not round or saturate: Postgres raises "integer out of range" and the insert
 * fails, which reached the user as a 500.
 *
 * Quote and invoice line totals were already clamped through documentTotals,
 * but the discount, the tax and a CRM lead value were written from a bare
 * `Math.max(0, ...)` straight into those columns. A mistyped figure with a few
 * extra zeros was enough.
 */
describe("integer column ceiling", () => {
  it("is the largest value a Postgres integer holds", () => {
    expect(MAX_CENTS).toBe(2 ** 31 - 1);
  });

  it("saturates rather than letting an over-range value reach the column", () => {
    expect(normalizeCents(3_000_000_000)).toBe(MAX_CENTS);
    expect(normalizeCents(Number.MAX_SAFE_INTEGER)).toBe(MAX_CENTS);
  });

  it("keeps a document's stored discount equal to the one its total used", () => {
    // The subtler half: the total was computed from a clamped discount while
    // the raw one was stored, so even had the column accepted it the document
    // would not have added up.
    const totals = documentTotals({
      lineItems: [{ quantity: 1, unitPriceCents: MAX_CENTS }],
      discountCents: 3_000_000_000,
      taxCents: 3_000_000_000,
    });
    expect(totals.discountCents).toBe(MAX_CENTS);
    expect(totals.taxCents).toBe(MAX_CENTS);
    expect(totals.subtotalCents - totals.discountCents + totals.taxCents).toBe(totals.totalCents);
  });

  it("leaves ordinary amounts untouched", () => {
    // 21.5 million is far above any real stand, so the clamp must be invisible
    // in practice.
    for (const cents of [0, 1, 125_050, 1_200_000, 500_000_000]) {
      expect(normalizeCents(cents), String(cents)).toBe(cents);
    }
  });
});
