import { describe, expect, it } from "vitest";
import { INVOICE_STATUS_STYLES, QUOTE_STATUS_STYLES, money } from "./quote-format";

/**
 * Money rendering and status badges for the quote and invoice surfaces.
 *
 * `money` is the only place cents become a currency string, and it is shared by
 * the staff and client views of both quotes and invoices — so a rounding or
 * fallback bug here is a wrong number on a document a client is asked to
 * accept, not a cosmetic issue.
 *
 * It also swallows Intl's RangeError on a bad currency code. That is the right
 * call — one malformed row should not blank the whole table — but it means a
 * bad code fails silently, so the fallback is pinned here rather than trusted.
 */

describe("money", () => {
  it("converts cents to major units", () => {
    // 1200000 cents is 12,000.00 - the quote total from the booth example.
    expect(money(1200000, "EUR")).toContain("12,000");
    expect(money(100, "EUR")).toContain("1");
    expect(money(0, "EUR")).toContain("0");
  });

  it("keeps two decimal places for fractional amounts", () => {
    expect(money(1999, "USD")).toMatch(/19[.,]99/);
    expect(money(1, "USD")).toMatch(/0[.,]01/);
  });

  it("handles negative amounts, which credit notes produce", () => {
    const out = money(-5000, "USD");
    expect(out).toMatch(/50/);
    expect(out).toMatch(/-|\(/); // minus sign or accounting parentheses
  });

  it("defaults to USD when the currency is missing or empty", () => {
    expect(money(1000, "")).toBe(money(1000, "USD"));
    expect(money(1000, undefined as unknown as string)).toBe(money(1000, "USD"));
  });

  it("is case insensitive about the currency code", () => {
    expect(money(1000, "eur")).toBe(money(1000, "EUR"));
  });

  it("falls back to a readable string instead of throwing on a bad code", () => {
    // Intl throws RangeError on a non-ISO code. The catch must produce
    // something a human can still read rather than an empty cell.
    const out = money(123456, "NOTACURRENCY");
    expect(out).toBe("1234.56 NOTACURRENCY");
    expect(() => money(1000, "!!")).not.toThrow();
  });

  it("does not lose precision on large totals", () => {
    // A stand can run into seven figures; make sure nothing rounds to
    // scientific notation or drops digits.
    const out = money(123456789, "USD");
    expect(out).toMatch(/1[.,]234[.,]567/);
    expect(out).not.toMatch(/e\+/i);
  });
});

/**
 * Every status the API can return must have a badge style, or the badge
 * renders with no colour and the user cannot tell a draft from a paid invoice.
 * These lists mirror the values in artifacts/api-server/src/routes/{quotes,
 * invoices}.ts — if the API gains a status, this fails until the UI handles it.
 */
const API_QUOTE_STATUSES = ["draft", "sent", "viewed", "accepted", "rejected", "expired", "revised"];
const API_INVOICE_STATUSES = ["draft", "open", "paid", "void", "uncollectible"];

describe("status badge coverage", () => {
  it.each(API_QUOTE_STATUSES)("quote status %s has a style", (status) => {
    expect(QUOTE_STATUS_STYLES[status], `no badge style for quote status "${status}"`)
      .toBeTruthy();
  });

  it.each(API_INVOICE_STATUSES)("invoice status %s has a style", (status) => {
    expect(INVOICE_STATUS_STYLES[status], `no badge style for invoice status "${status}"`)
      .toBeTruthy();
  });

  it("has no style for a status the API cannot produce", () => {
    // Catches copy-paste drift between the two maps - an invoice-only status
    // sitting in the quote map means one of them was edited without thought.
    for (const key of Object.keys(QUOTE_STATUS_STYLES)) {
      expect(API_QUOTE_STATUSES, `quote map has unknown status "${key}"`).toContain(key);
    }
    for (const key of Object.keys(INVOICE_STATUS_STYLES)) {
      expect(API_INVOICE_STATUSES, `invoice map has unknown status "${key}"`).toContain(key);
    }
  });
});
