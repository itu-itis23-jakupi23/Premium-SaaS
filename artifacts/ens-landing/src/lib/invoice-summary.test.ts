import { describe, expect, it } from "vitest";
import { invoiceOutstandingBalances } from "./invoice-summary";

describe("outstanding invoice balances", () => {
  it("keeps different currencies separate and accounts for partial payments", () => {
    expect(invoiceOutstandingBalances([
      { status: "open", currency: "USD", totalCents: 10000, amountPaidCents: 2500 },
      { status: "open", currency: "EUR", totalCents: 20000, amountPaidCents: 0 },
      { status: "open", currency: "usd", totalCents: 5000, amountPaidCents: 0 },
    ])).toEqual([{ currency: "EUR", totalCents: 20000 }, { currency: "USD", totalCents: 12500 }]);
  });

  it("excludes paid, draft, void and uncollectible invoices", () => {
    expect(invoiceOutstandingBalances([
      { status: "paid", currency: "USD", totalCents: 10000, amountPaidCents: 10000 },
      { status: "draft", currency: "USD", totalCents: 10000, amountPaidCents: 0 },
      { status: "void", currency: "USD", totalCents: 10000, amountPaidCents: 0 },
      { status: "uncollectible", currency: "USD", totalCents: 10000, amountPaidCents: 0 },
    ])).toEqual([]);
  });

  it("does not show negative balances for an overpaid invoice", () => {
    expect(invoiceOutstandingBalances([{ status: "open", currency: "USD", totalCents: 10000, amountPaidCents: 12000 }])).toEqual([{ currency: "USD", totalCents: 0 }]);
  });
});
