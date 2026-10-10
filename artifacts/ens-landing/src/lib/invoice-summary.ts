import { invoiceAmountDueCents, type Invoice } from "./platform-api";

type InvoiceBalanceInput = Pick<Invoice, "status" | "currency" | "totalCents" | "amountPaidCents">;

/** Unconverted balances must remain in their own currency. */
export function invoiceOutstandingBalances(invoices: readonly InvoiceBalanceInput[]) {
  const totals = new Map<string, number>();
  for (const invoice of invoices) {
    if (invoice.status !== "open") continue;
    const currency = (invoice.currency || "USD").toUpperCase();
    totals.set(currency, (totals.get(currency) ?? 0) + invoiceAmountDueCents(invoice));
  }
  return [...totals].sort(([first], [second]) => first.localeCompare(second)).map(([currency, totalCents]) => ({ currency, totalCents }));
}
