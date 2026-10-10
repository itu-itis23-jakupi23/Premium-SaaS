import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markInvoicePaid, recordInvoicePayment } from "./platform-api";
import { resetSessionExpiry } from "./auth-session";
import { isDefinitiveInvoicePaymentFailure } from "./invoice-payment-request";

const key = "payment-12345678";
const actor = { actorUserId: "staff-one", organizationSlug: "agency" };
const payload = { amountCents: 2500, method: "bank_transfer", reference: "BANK-5", note: "Deposit" };
const invoice = { id: "invoice-one", status: "open", amountPaidCents: 2500 };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => { resetSessionExpiry("staff"); vi.stubGlobal("localStorage", { getItem: () => null }); });
afterEach(() => { resetSessionExpiry("staff"); vi.unstubAllGlobals(); });

describe("invoice payment API requests", () => {
  it("sends an explicit request key with the exact reviewed payment", async () => {
    const fetch = vi.fn().mockResolvedValue(json({ invoice, payments: [] }, 201));
    vi.stubGlobal("fetch", fetch);
    expect(await recordInvoicePayment("invoice-one", payload, key, actor)).toEqual({ invoice, payments: [] });
    const init = fetch.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Idempotency-Key")).toBe(key);
    expect(new Headers(init.headers).get("X-Payment-Actor-Id")).toBe(actor.actorUserId);
    expect(new Headers(init.headers).get("X-Payment-Organization")).toBe(actor.organizationSlug);
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });
  it("preserves the same financial request through authentication renewal", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(json({ invoice, payments: [] }, 201));
    vi.stubGlobal("fetch", fetch);
    await recordInvoicePayment("invoice-one", payload, key, actor);
    expect(fetch).toHaveBeenCalledTimes(3);
    for (const index of [0, 2]) {
      const init = fetch.mock.calls[index][1] as RequestInit;
      expect(new Headers(init.headers).get("Idempotency-Key")).toBe(key);
      expect(new Headers(init.headers).get("X-Payment-Actor-Id")).toBe(actor.actorUserId);
      expect(new Headers(init.headers).get("X-Payment-Organization")).toBe(actor.organizationSlug);
      expect(JSON.parse(init.body as string)).toEqual(payload);
    }
  });
  it("includes the reviewed outstanding balance in full payment confirmation", async () => {
    const fetch = vi.fn().mockResolvedValue(json({ invoice }));
    vi.stubGlobal("fetch", fetch);
    expect(await markInvoicePaid("invoice-one", key, actor, 7500)).toEqual(invoice);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ expectedAmountCents: 7500 });
    expect(new Headers(fetch.mock.calls[0][1].headers).get("Idempotency-Key")).toBe(key);
  });
  it("rejects missing or malformed keys before sending financial mutations", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(recordInvoicePayment("invoice-one", payload, "", actor)).rejects.toThrow("request key");
    await expect(markInvoicePaid("invoice-one", "invalid key", actor)).rejects.toThrow("request key");
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    { status: 409, code: "idempotency_conflict", definitive: false },
    { status: 409, code: "balance_changed", definitive: true },
    { status: 503, code: "server_error", definitive: false },
    { status: 409, code: "payment_account_changed", definitive: false },
  ])("preserves structured status and code for safe recovery ($code)", async ({ status, code, definitive }) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: { code, message: "Payment rejected" } }, status)));
    const failure = await recordInvoicePayment("invoice-one", payload, key, actor).catch((error: unknown) => error);
    expect(failure).toMatchObject({ status, code, message: "Payment rejected" });
    expect(isDefinitiveInvoicePaymentFailure(failure)).toBe(definitive);
  });
  it("retains uncertainty when a proxy returns an unstructured rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Gateway response", { status: 409 })));
    const failure = await recordInvoicePayment("invoice-one", payload, key, actor).catch((error: unknown) => error);
    expect(isDefinitiveInvoicePaymentFailure(failure)).toBe(false);
  });
});
