export interface PaymentInvoice {
  id: string;
  invoiceNumber: string;
  currency: string;
  totalCents: number;
  amountPaidCents: number;
}

export interface InvoicePaymentInput {
  amountCents: number;
  method?: string;
  reference?: string;
  note?: string;
}

export interface InvoicePaymentActor {
  actorUserId: string;
  organizationSlug: string;
}

export type InvoicePaymentRequest = {
  version: 1;
  key: string;
  invoice: PaymentInvoice;
} & InvoicePaymentActor & (
  | { operation: "payment"; payload: InvoicePaymentInput }
  | { operation: "mark-paid"; payload: { expectedAmountCents: number } }
);

/** Parse decimal money without rounding away a third decimal or accepting exponents. */
export function parseInvoicePaymentAmount(value: string): number | null {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 2147483647 ? cents : null;
}

export function invoicePaymentStorageKey(organizationSlug: string, userId: string): string {
  return `ens-invoice-payment:v1:${encodeURIComponent(organizationSlug)}:${encodeURIComponent(userId)}`;
}

interface PaymentStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 2147483647;
}

export function loadInvoicePaymentRequest(storage: PaymentStorage, storageKey: string): InvoicePaymentRequest | null {
  const raw = storage.getItem(storageKey);
  if (!raw) return null;
  const value = JSON.parse(raw) as Partial<InvoicePaymentRequest>;
  const invoice = value.invoice;
  const payload = value.payload;
  if (value.version !== 1 || typeof value.key !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/.test(value.key)
    || typeof value.actorUserId !== "string" || !value.actorUserId || typeof value.organizationSlug !== "string" || !value.organizationSlug
    || storageKey !== invoicePaymentStorageKey(value.organizationSlug, value.actorUserId)
    || !invoice || typeof invoice.id !== "string" || !invoice.id || typeof invoice.invoiceNumber !== "string"
    || typeof invoice.currency !== "string" || !/^[A-Z]{3}$/i.test(invoice.currency)
    || !isCents(invoice.totalCents) || !isCents(invoice.amountPaidCents) || !payload) {
    throw new Error("Invalid saved invoice payment request");
  }
  if (value.operation === "payment") {
    if (!("amountCents" in payload) || !isCents(payload.amountCents) || payload.amountCents <= 0
      || (payload.method !== undefined && (typeof payload.method !== "string" || payload.method.length > 40))
      || (payload.reference !== undefined && (typeof payload.reference !== "string" || payload.reference.length > 200))
      || (payload.note !== undefined && (typeof payload.note !== "string" || payload.note.length > 1000))) {
      throw new Error("Invalid saved invoice payment payload");
    }
  } else if (value.operation === "mark-paid") {
    if (!("expectedAmountCents" in payload) || !isCents(payload.expectedAmountCents)) {
      throw new Error("Invalid saved full payment payload");
    }
  } else {
    throw new Error("Invalid saved invoice payment operation");
  }
  return value as InvoicePaymentRequest;
}

/** Storage failure is surfaced before sending, so reload cannot silently forget a submission. */
export function saveInvoicePaymentRequest(storage: PaymentStorage, storageKey: string, request: InvoicePaymentRequest | null, expectedKey?: string): boolean {
  if (request) {
    if (storageKey !== invoicePaymentStorageKey(request.organizationSlug, request.actorUserId)) {
      throw new Error("Invoice payment recovery account changed");
    }
    const serialized = JSON.stringify(request);
    const existing = loadInvoicePaymentRequest(storage, storageKey);
    if (existing && (existing.key !== request.key || JSON.stringify(existing) !== serialized)) {
      throw new Error("Another invoice payment needs confirmation");
    }
    storage.setItem(storageKey, serialized);
    if (storage.getItem(storageKey) !== serialized) throw new Error("Invoice payment recovery storage is unavailable");
  } else {
    if (!expectedKey) throw new Error("The completed invoice payment key is required");
    const existing = loadInvoicePaymentRequest(storage, storageKey);
    if (existing?.key !== expectedKey) return false;
    storage.removeItem(storageKey);
    if (storage.getItem(storageKey) !== null) throw new Error("Invoice payment recovery storage could not be cleared");
  }
  return true;
}

/** Only these 409s occur after saved-success lookup; auth and validation can precede it. */
export function isDefinitiveInvoicePaymentFailure(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("status" in error) || !("code" in error)) return false;
  const { status, code } = error as { status: unknown; code: unknown };
  return status === 409 && typeof code === "string"
    && ["balance_changed", "amount_exceeds_balance", "not_payable"].includes(code);
}
