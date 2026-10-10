import { describe, expect, it } from "vitest";
import { invoicePaymentStorageKey, isDefinitiveInvoicePaymentFailure, loadInvoicePaymentRequest, parseInvoicePaymentAmount, saveInvoicePaymentRequest, type InvoicePaymentRequest } from "./invoice-payment-request";

const request: InvoicePaymentRequest = {
  version: 1,
  key: "payment-12345678",
  actorUserId: "staff-one",
  organizationSlug: "agency",
  invoice: { id: "invoice-one", invoiceNumber: "INV-001", currency: "USD", totalCents: 10000, amountPaidCents: 0 },
  operation: "payment",
  payload: { amountCents: 2500, method: "bank_transfer", reference: "BANK-5", note: "Deposit" },
};
const storageKey = invoicePaymentStorageKey("agency", "staff-one");

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}

describe("invoice payment amounts", () => {
  it("parses cents exactly with dot or comma decimal separators", () => {
    for (const [input, expected] of [["0.01", 1], [" 25,50 ", 2550], ["9.9", 990], ["123", 12300], ["21474836.47", 2147483647]] as const) {
      expect(parseInvoicePaymentAmount(input)).toBe(expected);
    }
  });
  it("rejects ambiguous amounts, rounding, exponents, nonpositive values and overflow", () => {
    for (const input of ["", "0", "0.00", "-1", "+1", ".50", "1.", "1.005", "1e3", "1,000.00", "1 000", "Infinity", "21474836.48", "9007199254740991"]) {
      expect(parseInvoicePaymentAmount(input)).toBeNull();
    }
  });
});

describe("invoice payment recovery", () => {
  it("preserves the exact submitted payload and key across reload", () => {
    const saved = storage();
    const key = invoicePaymentStorageKey("agency", "staff-one");
    saveInvoicePaymentRequest(saved, key, request);
    expect(loadInvoicePaymentRequest(saved, key)).toEqual(request);
    expect(loadInvoicePaymentRequest(saved, invoicePaymentStorageKey("other-agency", "staff-one"))).toBeNull();
    expect(loadInvoicePaymentRequest(saved, invoicePaymentStorageKey("agency", "staff-two"))).toBeNull();
    saveInvoicePaymentRequest(saved, key, null, request.key);
    expect(loadInvoicePaymentRequest(saved, key)).toBeNull();
  });
  it("preserves the confirmed full balance instead of recalculating it on retry", () => {
    const saved = storage();
    const full: InvoicePaymentRequest = { ...request, operation: "mark-paid", payload: { expectedAmountCents: 10000 } };
    saveInvoicePaymentRequest(saved, storageKey, full);
    expect(loadInvoicePaymentRequest(saved, storageKey)).toEqual(full);
    saveInvoicePaymentRequest(saved, storageKey, null, full.key);
    const zero: InvoicePaymentRequest = { ...full, invoice: { ...full.invoice, totalCents: 0 }, payload: { expectedAmountCents: 0 } };
    saveInvoicePaymentRequest(saved, storageKey, zero);
    expect(loadInvoicePaymentRequest(saved, storageKey)).toEqual(zero);
  });
  it("surfaces corrupt recovery data instead of allowing a fresh payment", () => {
    const saved = storage();
    for (const invalid of ["not json", "null", JSON.stringify({ ...request, key: "bad" }), JSON.stringify({ ...request, payload: { amountCents: 0.5 } }), JSON.stringify({ ...request, operation: "different" })]) {
      saved.setItem(storageKey, invalid);
      expect(() => loadInvoicePaymentRequest(saved, storageKey)).toThrow();
    }
  });
  it("rejects unavailable or silently failed storage before submission", () => {
    const unavailable = { ...storage(), setItem: () => { throw new Error("quota"); } };
    expect(() => saveInvoicePaymentRequest(unavailable, storageKey, request)).toThrow("quota");
    const silent = { ...storage(), setItem: () => {} };
    expect(() => saveInvoicePaymentRequest(silent, storageKey, request)).toThrow("unavailable");
  });
  it("retains uncertain failures and conflicts while allowing validated rejections to be corrected", () => {
    for (const error of [new TypeError("Failed to fetch"), new Error("unexpected response"), { status: 503, code: "server_error" }, { status: 409, code: "idempotency_conflict" }, { status: 409, code: "payment_account_changed" }, { status: 401, code: "auth_required" }, { status: 403, code: "forbidden" }, { status: 404, code: "invoice_not_found" }, { status: 429, code: "rate_limited" }, { status: 400, code: "invalid_idempotency_key" }, { status: 400, code: "invalid_amount" }, { status: 502 }]) {
      expect(isDefinitiveInvoicePaymentFailure(error)).toBe(false);
    }
    for (const error of [{ status: 409, code: "balance_changed" }, { status: 409, code: "amount_exceeds_balance" }, { status: 409, code: "not_payable" }]) {
      expect(isDefinitiveInvoicePaymentFailure(error)).toBe(true);
    }
  });
  it("rejects recovery data copied into another account's storage slot", () => {
    const saved = storage();
    const otherKey = invoicePaymentStorageKey("other-agency", "staff-two");
    expect(() => saveInvoicePaymentRequest(saved, otherKey, request)).toThrow("account changed");
    saved.setItem(otherKey, JSON.stringify(request));
    expect(() => loadInvoicePaymentRequest(saved, otherKey)).toThrow();
  });
  it("keeps a newer pending payment when an old response arrives after remount", () => {
    const saved = storage();
    saveInvoicePaymentRequest(saved, storageKey, request);
    expect(saveInvoicePaymentRequest(saved, storageKey, null, request.key)).toBe(true);
    const newer: InvoicePaymentRequest = { ...request, key: "payment-newer-12345678", payload: { amountCents: 1000 } };
    saveInvoicePaymentRequest(saved, storageKey, newer);
    expect(saveInvoicePaymentRequest(saved, storageKey, null, request.key)).toBe(false);
    expect(loadInvoicePaymentRequest(saved, storageKey)).toEqual(newer);
    expect(() => saveInvoicePaymentRequest(saved, storageKey, request)).toThrow("needs confirmation");
    expect(loadInvoicePaymentRequest(saved, storageKey)).toEqual(newer);
  });
});
