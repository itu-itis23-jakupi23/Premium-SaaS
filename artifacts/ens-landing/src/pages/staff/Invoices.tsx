import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Send, Trash2, Receipt, Loader2, X, CheckCircle2, Ban, Coins } from "lucide-react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { HelpHint } from "@/components/HelpHint";
import { InvoicePaymentDialog, type InvoicePaymentSelection } from "@/components/InvoicePaymentDialog";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  listInvoices, createInvoice, sendInvoice, voidInvoice, deleteInvoice,
  invoiceAmountDueCents,
  listQuotes, getPlatformClients,
  type Invoice, type Quote,
} from "@/lib/platform-api";
import { money, INVOICE_STATUS_STYLES as STATUS_STYLES } from "@/lib/quote-format";
import { invoicePaymentStorageKey, loadInvoicePaymentRequest, saveInvoicePaymentRequest, type InvoicePaymentRequest } from "@/lib/invoice-payment-request";

interface DraftLine { description: string; sku: string; quantity: string; unitPrice: string; }
interface PaymentDialogView extends InvoicePaymentSelection { focusId: number; focusTarget: HTMLButtonElement | null; }
const emptyLine: DraftLine = { description: "", sku: "", quantity: "1", unitPrice: "" };

export default function Invoices({ role }: { role: "chief" | "pm" }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Array<{ id: string; label: string }>>([]);
  const [acceptedQuotes, setAcceptedQuotes] = useState<Quote[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [paymentSelection, setPaymentSelection] = useState<PaymentDialogView | null>(null);
  const [pendingPayment, setPendingPayment] = useState<InvoicePaymentRequest | null>(null);
  const [paymentStorageError, setPaymentStorageError] = useState(false);
  const pendingPaymentRef = useRef<InvoicePaymentRequest | null>(null);
  const actionInFlight = useRef(false);
  const refreshSequence = useRef(0);
  const invoiceHeading = useRef<HTMLHeadingElement>(null);
  const paymentFocusGeneration = useRef(0);
  const activePaymentView = useRef<number | null>(null);
  const paymentStorageKey = user ? invoicePaymentStorageKey(user.organizationSlug, user.id) : null;
  const activePaymentStorageKey = useRef(paymentStorageKey);
  const mounted = useRef(false);
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useLayoutEffect(() => { activePaymentStorageKey.current = paymentStorageKey; }, [paymentStorageKey]);
  useLayoutEffect(() => { activePaymentView.current = paymentSelection?.focusId ?? null; }, [paymentSelection?.focusId]);
  const selectPayment = useCallback((selection: InvoicePaymentSelection, focusTarget: HTMLButtonElement | null = null) => {
    const focusId = ++paymentFocusGeneration.current;
    setPaymentSelection({ ...selection, focusId, focusTarget });
  }, []);

  // Create-form state
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [fromQuoteId, setFromQuoteId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [lines, setLines] = useState<DraftLine[]>([{ ...emptyLine }]);
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const refresh = useCallback(async (quiet = false) => {
    const sequence = ++refreshSequence.current;
    if (!quiet) setLoading(true);
    try {
      const updated = await listInvoices();
      if (sequence !== refreshSequence.current) return;
      setInvoices(updated);
      setLoadError("");
      setPaymentSelection((current) => {
        if (!current || pendingPaymentRef.current) return current;
        const latest = updated.find((invoice) => invoice.id === current.invoice.id);
        return latest ? { ...current, invoice: latest } : current;
      });
    } catch (error) {
      if (sequence === refreshSequence.current) setLoadError(error instanceof Error ? error.message : t("invoices.form.error"));
    } finally {
      if (sequence === refreshSequence.current) setLoading(false);
    }
  }, [t]);

  useEffect(() => { void refresh(); return () => { refreshSequence.current += 1; }; }, [refresh]);
  const restorePayment = useCallback(() => {
    paymentFocusGeneration.current += 1;
    pendingPaymentRef.current = null;
    setPendingPayment(null);
    setPaymentSelection(null);
    if (!paymentStorageKey) return;
    try {
      const request = loadInvoicePaymentRequest(window.sessionStorage, paymentStorageKey);
      pendingPaymentRef.current = request;
      setPendingPayment(request);
      if (request) selectPayment({ invoice: request.invoice, operation: request.operation });
      setPaymentStorageError(false);
    } catch {
      setPaymentStorageError(true);
    }
  }, [paymentStorageKey, selectPayment]);
  useEffect(restorePayment, [restorePayment]);
  useEffect(() => {
    getPlatformClients({ limit: 100 })
      .then((res) => {
        const list = (Array.isArray(res) ? res : (res as { clients?: unknown[] }).clients ?? []) as Array<Record<string, unknown>>;
        setClients(list.map((c) => ({ id: String(c.id), label: String(c.company || c.name || c.contactEmail || "Client") })));
      })
      .catch(() => setClients([]));
    listQuotes({ status: "accepted" }).then(setAcceptedQuotes).catch(() => setAcceptedQuotes([]));
  }, []);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => sum + Math.round((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) * 100), 0);
    const disc = Math.round((Number(discount) || 0) * 100);
    const taxc = Math.round((Number(tax) || 0) * 100);
    return { subtotal, disc, taxc, total: Math.max(0, subtotal - disc + taxc) };
  }, [lines, discount, tax]);

  function resetForm() {
    setTitle(""); setClientId(""); setFromQuoteId(""); setCurrency("USD"); setLines([{ ...emptyLine }]);
    setDiscount("0"); setTax("0"); setDueAt(""); setNotes(""); setFormError("");
  }

  async function save() {
    setSaving(true); setFormError("");
    try {
      if (fromQuoteId) {
        // Seed the whole invoice from an accepted quote.
        await createInvoice({ quoteId: fromQuoteId });
      } else {
        const items = lines
          .filter((l) => l.description.trim())
          .map((l) => ({ description: l.description.trim(), sku: l.sku.trim() || undefined, quantity: Number(l.quantity) || 0, unitPriceCents: Math.round((Number(l.unitPrice) || 0) * 100) }));
        if (items.length === 0) { setFormError(t("invoices.form.needLine")); setSaving(false); return; }
        await createInvoice({
          clientId: clientId || undefined, title: title.trim() || undefined, currency,
          discountCents: totals.disc, taxCents: totals.taxc, notes: notes.trim() || undefined,
          dueAt: dueAt || undefined, lineItems: items,
        });
      }
      toast({ title: t("invoices.toast.created") });
      setDialogOpen(false); resetForm(); void refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("invoices.form.error"));
    } finally {
      setSaving(false);
    }
  }

  async function act(inv: Invoice, fn: (id: string) => Promise<unknown>, successKey: string) {
    if (actionInFlight.current || pendingPaymentRef.current?.invoice.id === inv.id || (inv.status === "open" && paymentStorageError)) return;
    actionInFlight.current = true;
    setBusyId(inv.id);
    try { await fn(inv.id); toast({ title: t(successKey) }); void refresh(); }
    catch (err) { toast({ title: err instanceof Error ? err.message : t("invoices.form.error") }); }
    finally { actionInFlight.current = false; setBusyId(null); }
  }

  function openPayment(inv: Invoice, operation: InvoicePaymentRequest["operation"], focusTarget: HTMLButtonElement) {
    if (!paymentStorageKey || paymentStorageError || actionInFlight.current) return;
    const pending = pendingPaymentRef.current;
    selectPayment(pending ? { invoice: pending.invoice, operation: pending.operation } : { invoice: inv, operation }, focusTarget);
  }

  function restorePaymentFocus(view: PaymentDialogView) {
    if (!mounted.current || activePaymentStorageKey.current !== paymentStorageKey
      || paymentFocusGeneration.current !== view.focusId || activePaymentView.current !== null) return;
    // A later dialog or deliberate focus move takes priority over this closing dialog.
    if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return;
    const focused = document.activeElement;
    if (focused && focused !== document.body && focused !== document.documentElement
      && !focused.hasAttribute("data-radix-focus-guard")) return;
    const target = view.focusTarget;
    if (target?.isConnected && !target.disabled) target.focus();
    else invoiceHeading.current?.focus();
  }

  function persistPayment(request: InvoicePaymentRequest | null, expectedKey: string): boolean {
    if (!paymentStorageKey) throw new Error("Invoice payment account is unavailable");
    if (request && (!mounted.current || activePaymentStorageKey.current !== paymentStorageKey)) return false;
    try {
      const applied = saveInvoicePaymentRequest(window.sessionStorage, paymentStorageKey, request, expectedKey);
      if (!applied) return false;
      if (!mounted.current || activePaymentStorageKey.current !== paymentStorageKey
        || (!request && pendingPaymentRef.current?.key !== expectedKey)) return false;
      pendingPaymentRef.current = request;
      setPendingPayment(request);
      setPaymentStorageError(false);
      return true;
    } catch (error) {
      if (mounted.current && activePaymentStorageKey.current === paymentStorageKey) setPaymentStorageError(true);
      throw error;
    }
  }

  function paymentRecorded(invoice: Invoice, requestKey: string) {
    if (!mounted.current || activePaymentStorageKey.current !== paymentStorageKey || pendingPaymentRef.current?.key !== requestKey) return;
    // The mutation already succeeded. A later list failure must not turn it into a failed payment.
    refreshSequence.current += 1;
    setLoading(false);
    setInvoices((current) => current.map((existing) => existing.id === invoice.id ? invoice : existing));
    toast({ title: t("invoices.toast.paymentRecorded") });
    void refresh(true);
  }

  return (
    <DashboardLayout role={role}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 ref={invoiceHeading} tabIndex={-1} className="flex items-center gap-2 rounded-sm text-2xl font-bold tracking-tight focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            {t("invoices.title")}
            <HelpHint
              title="help.staffInvoices.flow.title"
              body="help.staffInvoices.flow.body"
              note="help.staffInvoices.flow.note"
              side="bottom"
              align="start"
            />
          </h1>
          <p className="text-sm text-muted-foreground">{t("invoices.subtitle")}</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} data-testid="button-new-invoice">
          <Plus className="mr-2 h-4 w-4" /> {t("invoices.new")}
        </Button>
      </div>

      {loadError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
        <p>{t("invoices.payment.listError")} {loadError}</p>
        <Button variant="outline" size="sm" onClick={() => void refresh(invoices.length > 0)}>{t("invoices.payment.refresh")}</Button>
      </div>}
      {paymentStorageError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
        <p>{t("invoices.payment.storageUnavailable")}</p>
        <Button variant="outline" size="sm" onClick={restorePayment}>{t("invoices.payment.refresh")}</Button>
      </div>}
      {pendingPayment && <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        <p>{t("invoices.payment.pending", { number: pendingPayment.invoice.invoiceNumber })}</p>
        <Button variant="outline" size="sm" data-testid="resume-invoice-payment" onClick={(event) => selectPayment({ invoice: pendingPayment.invoice, operation: pendingPayment.operation }, event.currentTarget)}>{t("invoices.payment.resume")}</Button>
      </div>}

      <div className="rounded-lg border bg-card">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b bg-muted/20 text-left text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-2.5">{t("invoices.col.number")}</th>
                <th className="px-4 py-2.5">{t("invoices.col.title")}</th>
                <th className="px-4 py-2.5">{t("invoices.col.total")}</th>
                <th className="px-4 py-2.5">{t("invoices.col.due")}</th>
                <th className="px-4 py-2.5">{t("invoices.col.status")}</th>
                <th className="px-4 py-2.5 text-right">{t("invoices.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
              ) : invoices.length === 0 && !loadError ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">{t("invoices.empty")}</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">{t("invoices.payment.listError")}</td></tr>
              ) : invoices.map((inv) => (
                <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/10">
                  <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3">{inv.title || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3 font-semibold">
                    {money(inv.totalCents, inv.currency)}
                    {inv.amountPaidCents > 0 && invoiceAmountDueCents(inv) > 0 && (
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        {t("invoices.balanceDue", { amount: money(invoiceAmountDueCents(inv), inv.currency) })}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3"><Badge className={STATUS_STYLES[inv.status]}>{t(`invoices.status.${inv.status}`)}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {inv.status === "draft" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => act(inv, sendInvoice, "invoices.toast.sent")} disabled={busyId === inv.id} data-testid={`send-${inv.invoiceNumber}`}>
                            <Send className="mr-1.5 h-3.5 w-3.5" /> {t("invoices.action.issue")}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => act(inv, deleteInvoice, "invoices.toast.deleted")} disabled={busyId === inv.id} aria-label={t("invoices.action.delete")}>
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </>
                      )}
                      {inv.status === "open" && (
                        <>
                          <Button size="sm" variant="outline" onClick={(event) => openPayment(inv, "payment", event.currentTarget)} disabled={busyId !== null || pendingPayment !== null || paymentStorageError || !paymentStorageKey} data-testid={`partial-${inv.invoiceNumber}`}>
                            <Coins className="mr-1.5 h-3.5 w-3.5 text-amber-600" /> {t("invoices.action.recordPayment")}
                          </Button>
                          <Button size="sm" variant="outline" onClick={(event) => openPayment(inv, "mark-paid", event.currentTarget)} disabled={busyId !== null || pendingPayment !== null || paymentStorageError || !paymentStorageKey} data-testid={`paid-${inv.invoiceNumber}`}>
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-green-600" /> {t("invoices.action.markPaid")}
                          </Button>
                          {(inv.amountPaidCents ?? 0) === 0 && <Button size="sm" variant="ghost" onClick={() => act(inv, voidInvoice, "invoices.toast.voided")} disabled={busyId === inv.id || pendingPayment?.invoice.id === inv.id || paymentStorageError} aria-label={t("invoices.action.void")}>
                            <Ban className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>}
                        </>
                      )}
                      {(inv.status === "paid" || inv.status === "void" || inv.status === "uncollectible") && (
                        <span className="text-[11px] text-muted-foreground">{new Date(inv.updatedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {paymentSelection && user && <InvoicePaymentDialog
        key={`${paymentStorageKey}:${paymentSelection.invoice.id}:${paymentSelection.operation}`}
        selection={paymentSelection}
        pending={pendingPayment}
        actor={{ actorUserId: user.id, organizationSlug: user.organizationSlug }}
        onClose={() => { if (mounted.current && activePaymentStorageKey.current === paymentStorageKey) setPaymentSelection(null); }}
        onRestoreFocus={() => restorePaymentFocus(paymentSelection)}
        onPendingChange={persistPayment}
        onRecorded={paymentRecorded}
        onRejected={() => { if (mounted.current && activePaymentStorageKey.current === paymentStorageKey) void refresh(true); }}
      />}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" /> {t("invoices.form.title")}</DialogTitle>
          </DialogHeader>

          {formError && <p className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-400">{formError}</p>}

          {acceptedQuotes.length > 0 && (
            <div className="space-y-1.5 rounded-lg border border-dashed p-3">
              <Label htmlFor="inv-fromquote" className="text-xs">{t("invoices.form.fromQuote")}</Label>
              <select id="inv-fromquote" value={fromQuoteId} onChange={(e) => setFromQuoteId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="">{t("invoices.form.fromQuoteNone")}</option>
                {acceptedQuotes.map((q) => <option key={q.id} value={q.id}>{q.quoteNumber} — {q.title || t("invoices.form.untitled")} ({money(q.totalCents, q.currency)})</option>)}
              </select>
              {fromQuoteId && <p className="text-[11px] text-muted-foreground">{t("invoices.form.fromQuoteHint")}</p>}
            </div>
          )}

          {!fromQuoteId && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-title" className="text-xs">{t("invoices.form.name")}</Label>
                  <Input id="inv-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Deposit — CES 2027" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-client" className="text-xs">{t("invoices.form.client")}</Label>
                  <select id="inv-client" value={clientId} onChange={(e) => setClientId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="">{t("invoices.form.selectClient")}</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="mt-2">
                <Label className="text-xs">{t("invoices.form.lineItems")}</Label>
                <div className="mt-2 space-y-2">
                  {lines.map((line, i) => (
                    <div key={i} className="grid grid-cols-[1fr_70px_90px_auto] items-center gap-2">
                      <Input aria-label={t("invoices.form.description")} placeholder={t("invoices.form.description")} value={line.description}
                        onChange={(e) => setLines((ls) => ls.map((l, j) => j === i ? { ...l, description: e.target.value } : l))} />
                      <Input aria-label={t("invoices.form.qty")} type="number" min="0" placeholder="1" value={line.quantity}
                        onChange={(e) => setLines((ls) => ls.map((l, j) => j === i ? { ...l, quantity: e.target.value } : l))} />
                      <Input aria-label={t("invoices.form.unitPrice")} type="number" min="0" step="0.01" placeholder="0.00" value={line.unitPrice}
                        onChange={(e) => setLines((ls) => ls.map((l, j) => j === i ? { ...l, unitPrice: e.target.value } : l))} />
                      <Button variant="ghost" size="icon" aria-label={t("invoices.form.removeLine")} disabled={lines.length === 1}
                        onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setLines((ls) => [...ls, { ...emptyLine }])}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> {t("invoices.form.addLine")}
                </Button>
              </div>

              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-discount" className="text-xs">{t("invoices.form.discount")}</Label>
                  <Input id="inv-discount" type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-tax" className="text-xs">{t("invoices.form.tax")}</Label>
                  <Input id="inv-tax" type="number" min="0" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-due" className="text-xs">{t("invoices.form.due")}</Label>
                  <Input id="inv-due" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inv-notes" className="text-xs">{t("invoices.form.notes")}</Label>
                <Textarea id="inv-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <div className="mt-2 rounded-lg border bg-muted/20 p-3 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>{t("invoices.form.subtotal")}</span><span>{money(totals.subtotal, currency)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>{t("invoices.form.discount")}</span><span>-{money(totals.disc, currency)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>{t("invoices.form.tax")}</span><span>+{money(totals.taxc, currency)}</span></div>
                <div className="mt-1 flex justify-between border-t pt-1 font-bold"><span>{t("invoices.form.total")}</span><span>{money(totals.total, currency)}</span></div>
              </div>
            </>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={save} disabled={saving} data-testid="button-save-invoice">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t("invoices.form.saveDraft")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
