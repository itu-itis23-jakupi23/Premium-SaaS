import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { invoiceAmountDueCents, markInvoicePaid, recordInvoicePayment, type Invoice } from "@/lib/platform-api";
import { isDefinitiveInvoicePaymentFailure, parseInvoicePaymentAmount, type InvoicePaymentActor, type InvoicePaymentRequest, type PaymentInvoice } from "@/lib/invoice-payment-request";
import { money } from "@/lib/quote-format";

export interface InvoicePaymentSelection {
  invoice: PaymentInvoice;
  operation: InvoicePaymentRequest["operation"];
}

interface Props {
  selection: InvoicePaymentSelection;
  pending: InvoicePaymentRequest | null;
  actor: InvoicePaymentActor;
  onClose: () => void;
  onRestoreFocus: () => void;
  onPendingChange: (request: InvoicePaymentRequest | null, expectedKey: string) => boolean;
  onRecorded: (invoice: Invoice, requestKey: string) => void;
  onRejected: () => void;
}

export function InvoicePaymentDialog({ selection, pending, actor, onClose, onRestoreFocus, onPendingChange, onRecorded, onRejected }: Props) {
  const { t } = useTranslation();
  const { invoice, operation } = selection;
  const dueCents = invoiceAmountDueCents(invoice);
  const initialPayload = pending?.operation === "payment" ? pending.payload : null;
  const [amount, setAmount] = useState(() => ((initialPayload?.amountCents ?? dueCents) / 100).toFixed(2));
  const [method, setMethod] = useState(initialPayload?.method ?? "manual");
  const [reference, setReference] = useState(initialPayload?.reference ?? "");
  const [note, setNote] = useState(initialPayload?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const reviewedCents = pending
    ? pending.operation === "payment" ? pending.payload.amountCents : pending.payload.expectedAmountCents
    : operation === "mark-paid" ? dueCents : parseInvoicePaymentAmount(amount);

  async function submit() {
    if (submitting.current) return;
    setError("");
    let request = pending;
    if (!request) {
      if (reviewedCents === null || reviewedCents < 0 || (operation === "payment" && reviewedCents === 0)) {
        setError(t("invoices.payment.invalidAmount"));
        return;
      }
      if (reviewedCents > dueCents) {
        setError(t("invoices.payment.exceedsBalance"));
        return;
      }
      const base = { version: 1 as const, key: crypto.randomUUID(), ...actor, invoice: {
        id: invoice.id, invoiceNumber: invoice.invoiceNumber, currency: invoice.currency,
        totalCents: invoice.totalCents, amountPaidCents: invoice.amountPaidCents,
      } };
      request = operation === "payment"
        ? { ...base, operation, payload: { amountCents: reviewedCents, method, reference: reference.trim(), note: note.trim() } }
        : { ...base, operation, payload: { expectedAmountCents: reviewedCents } };
    }
    submitting.current = true;
    setBusy(true);
    let sent = false;
    try {
      // Persist before fetch, including the payload. Reload can only replay this request.
      if (!onPendingChange(request, request.key)) throw new Error("The invoice payment account changed");
      sent = true;
      const updated = request.operation === "payment"
        ? (await recordInvoicePayment(request.invoice.id, request.payload, request.key, request)).invoice
        : await markInvoicePaid(request.invoice.id, request.key, request, request.payload.expectedAmountCents);
      onRecorded(updated, request.key);
      if (onPendingChange(null, request.key)) onClose();
    } catch (failure) {
      if (!sent) {
        setError(t("invoices.payment.storageUnavailable"));
      } else if (isDefinitiveInvoicePaymentFailure(failure)) {
        try {
          if (onPendingChange(null, request.key)) {
            setError(failure instanceof Error ? failure.message : t("invoices.form.error"));
            onRejected();
          }
        } catch {
          setError(t("invoices.payment.storageUnavailable"));
        }
      } else {
        setError(failure instanceof Error ? failure.message : t("invoices.form.error"));
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !submitting.current) onClose(); }}>
      <DialogContent className="max-h-[88vh] overflow-y-auto" data-testid="invoice-payment-dialog"
        onCloseAutoFocus={(event) => { event.preventDefault(); onRestoreFocus(); }}>
        <DialogHeader>
          <DialogTitle>{t(operation === "payment" ? "invoices.payment.title" : "invoices.payment.fullTitle")}</DialogTitle>
          <DialogDescription>{t("invoices.payment.description", { number: invoice.invoiceNumber })}</DialogDescription>
        </DialogHeader>
        <p className="rounded-md border bg-muted/20 p-3 text-sm">
          {t("invoices.payment.outstanding", { amount: money(dueCents, invoice.currency) })}
        </p>
        {pending && !busy && (
          <p role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            {t("invoices.payment.uncertain")}
          </p>
        )}
        {error && <p role="alert" data-testid="payment-error" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p>}
        <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="space-y-4">
          {operation === "payment" ? (
            <fieldset disabled={busy || pending !== null} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="payment-amount">{t("invoices.payment.amount", { currency: invoice.currency })}</Label>
                <Input id="payment-amount" data-testid="payment-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} maxLength={30} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payment-method">{t("invoices.payment.method")}</Label>
                <select id="payment-method" data-testid="payment-method" value={method} onChange={(event) => setMethod(event.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  {["manual", "bank_transfer", "cash", "card", "other"].map((value) => <option key={value} value={value}>{t(`invoices.payment.methods.${value}`)}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payment-reference">{t("invoices.payment.reference")}</Label>
                <Input id="payment-reference" data-testid="payment-reference" value={reference} onChange={(event) => setReference(event.target.value)} maxLength={200} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payment-note">{t("invoices.payment.note")}</Label>
                <Textarea id="payment-note" data-testid="payment-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={2} />
              </div>
            </fieldset>
          ) : <p>{t("invoices.payment.fullReview", { amount: money(reviewedCents ?? dueCents, invoice.currency) })}</p>}
          {operation === "payment" && reviewedCents !== null && <p className="text-sm font-semibold">{t("invoices.payment.review", { amount: money(reviewedCents, invoice.currency) })}</p>}
          <p className="text-xs text-muted-foreground">{t("invoices.payment.manualNotice")}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>{t(pending ? "invoices.payment.close" : "common.cancel")}</Button>
            <Button type="submit" disabled={busy} data-testid="confirm-invoice-payment">
              {busy && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
              {t(busy ? "invoices.payment.saving" : pending ? "invoices.payment.retry" : "invoices.payment.confirm")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
