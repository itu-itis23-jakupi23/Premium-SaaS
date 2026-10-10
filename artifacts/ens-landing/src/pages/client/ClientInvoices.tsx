import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Receipt, Loader2, ChevronDown, Printer } from "lucide-react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  listInvoices,
  getInvoice,
  listInvoicePayments,
  invoiceAmountDueCents,
  type Invoice,
  type InvoicePayment,
} from "@/lib/platform-api";
import { money, INVOICE_STATUS_STYLES as STATUS_STYLES } from "@/lib/quote-format";
import { HelpHint } from "@/components/HelpHint";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { invoiceOutstandingBalances } from "@/lib/invoice-summary";

type StatusFilter = "all" | "open" | "paid";

function isOverdue(inv: Invoice): boolean {
  return inv.status === "open" && !!inv.dueAt && new Date(inv.dueAt) < new Date();
}

export default function ClientInvoices() {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const detailRequest = useRef(0);
  const listRequest = useRef(0);
  const activeInvoice = useRef<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");

  const refresh = useCallback(async (withLoading = true) => {
    const request = ++listRequest.current;
    if (withLoading) setLoading(true);
    setError("");
    try {
      const latest = await listInvoices();
      if (request === listRequest.current) setInvoices(latest);
    } catch {
      if (request === listRequest.current) setError(t("experience.failed"));
    } finally {
      if (request === listRequest.current && withLoading) setLoading(false);
    }
  }, [t]);
  const cancelPending = useCallback(() => { listRequest.current++; detailRequest.current++; }, []);
  useEffect(() => {
    void refresh();
    return cancelPending;
  }, [refresh, cancelPending]);

  useLiveRefresh(async () => {
    const invoiceId = activeInvoice.current;
    const detailVersion = detailRequest.current;
    await refresh(false);
    if (!invoiceId || invoiceId !== activeInvoice.current || detailVersion !== detailRequest.current) return;
    const request = ++detailRequest.current;
    const [invoiceResult, paymentResult] = await Promise.allSettled([getInvoice(invoiceId), listInvoicePayments(invoiceId)]);
    if (request !== detailRequest.current) return;
    if (invoiceResult.status === "fulfilled") setDetail(invoiceResult.value);
    if (paymentResult.status === "fulfilled") setPayments(paymentResult.value);
    setDetailError(invoiceResult.status === "rejected" || paymentResult.status === "rejected" ? t("experience.detailUnavailable") : "");
  }, { intervalMs: 60_000, enabled: !loading });

  // The balance across everything still owed, so the client does not have to add
  // up rows by hand. Void and uncollectible invoices are not money due.
  const summary = useMemo(() => {
    const payable = invoices.filter((inv) => inv.status === "open");
    return {
      balances: invoiceOutstandingBalances(invoices),
      overdueCount: payable.filter(isOverdue).length,
      currency: invoices[0]?.currency ?? "USD",
      openCount: payable.length,
    };
  }, [invoices]);

  const visible = useMemo(
    () => (filter === "all" ? invoices : invoices.filter((inv) => inv.status === filter)),
    [invoices, filter],
  );

  async function open(inv: Invoice) {
    const request = ++detailRequest.current;
    if (openId === inv.id) { activeInvoice.current = null; setOpenId(null); setDetail(null); setPayments([]); setDetailError(""); return; }
    activeInvoice.current = inv.id;
    setOpenId(inv.id);
    setDetail(null);
    setPayments([]);
    setDetailError("");
    const [invoiceResult, paymentResult] = await Promise.allSettled([getInvoice(inv.id), listInvoicePayments(inv.id)]);
    if (request !== detailRequest.current) return;
    setDetail(invoiceResult.status === "fulfilled" ? invoiceResult.value : inv);
    setPayments(paymentResult.status === "fulfilled" ? paymentResult.value : []);
    if (invoiceResult.status === "rejected" || paymentResult.status === "rejected") setDetailError(t("experience.detailUnavailable"));
  }

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t("clientInvoices.filter.all") },
    { key: "open", label: t("clientInvoices.filter.open") },
    { key: "paid", label: t("clientInvoices.filter.paid") },
  ];

  return (
    <DashboardLayout role="client">
      <div className="mb-6 print:hidden">
        <h1 className="text-2xl font-bold tracking-tight">{t("clientInvoices.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("clientInvoices.subtitle")}</p>
      </div>

      {error && <div role="alert" className="mb-4 rounded-lg border border-destructive p-3 text-sm">{error} <Button variant="outline" className="ms-2 min-h-11" disabled={loading} onClick={() => void refresh()}>{t("experience.retry")}</Button></div>}
      {detailError && <p role="alert" className="mb-4 rounded-lg border p-3 text-sm">{detailError}</p>}

      {!loading && invoices.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3 print:hidden">
          <div className="rounded-lg border bg-card p-4">
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("clientInvoices.summary.outstanding")}
              <HelpHint
                title="help.invoices.outstanding.title"
                body="help.invoices.outstanding.body"
                note="help.invoices.outstanding.note"
              />
            </p>
            <div className="mt-1 space-y-1" data-testid="invoice-outstanding-balances">
              {(summary.balances.length ? summary.balances : [{ currency: summary.currency, totalCents: 0 }]).map((balance) => (
                <p key={balance.currency} className="flex flex-wrap items-baseline gap-2 text-2xl font-bold">
                  {money(balance.totalCents, balance.currency)}
                  <span className="font-mono text-xs font-normal text-muted-foreground">{balance.currency}</span>
                </p>
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("clientInvoices.summary.openCount")}
            </p>
            <p className="mt-1 text-2xl font-bold">{summary.openCount}</p>
          </div>
          <div className={`rounded-lg border p-4 ${summary.overdueCount ? "border-red-500/30 bg-red-500/5" : "bg-card"}`}>
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("clientInvoices.summary.overdue")}
              <HelpHint title="help.invoices.overdue.title" body="help.invoices.overdue.body" />
            </p>
            <p className={`mt-1 text-2xl font-bold ${summary.overdueCount ? "text-red-600" : ""}`}>
              {summary.overdueCount}
            </p>
          </div>
        </div>
      )}

      {!loading && invoices.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 print:hidden" role="group" aria-label={t("clientInvoices.filter.label")}>
          {filters.map((entry) => (
            <Button
              key={entry.key}
              type="button"
              size="sm"
              variant={filter === entry.key ? "default" : "outline"}
              aria-pressed={filter === entry.key}
              onClick={() => setFilter(entry.key)}
            >
              {entry.label}
            </Button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : invoices.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          <Receipt className="mx-auto mb-3 h-8 w-8 opacity-40" />
          {t("clientInvoices.empty")}
        </div>
      ) : error && invoices.length === 0 ? null : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          {t("clientInvoices.noneMatchFilter")}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((inv) => {
            const isOpen = openId === inv.id;
            const d = isOpen ? detail : null;
            const overdue = isOverdue(inv);
            const dueCents = invoiceAmountDueCents(inv);
            const partlyPaid = inv.amountPaidCents > 0 && dueCents > 0;
            return (
              <div
                key={inv.id}
                className={`rounded-lg border bg-card ${openId && !isOpen ? "print:hidden" : ""}`}
              >
                <button onClick={() => open(inv)} className="flex w-full flex-col items-stretch gap-3 px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between" aria-expanded={isOpen}>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{inv.invoiceNumber}</span>
                    <span className="min-w-0 break-words font-semibold">{inv.title || t("clientInvoices.untitled")}</span>
                    {overdue && <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-600">{t("clientInvoices.overdue")}</span>}
                    {partlyPaid && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-600">{t("clientInvoices.partlyPaid")}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="font-semibold">{money(inv.totalCents, inv.currency)}</span>
                      {partlyPaid && (
                        <span className="block text-[11px] text-muted-foreground">
                          {t("clientInvoices.amountDue")}: {money(dueCents, inv.currency)}
                        </span>
                      )}
                    </div>
                    <Badge className={STATUS_STYLES[inv.status]}>{t(`invoices.status.${inv.status}`)}</Badge>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t px-4 py-4">
                    {!d ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
                          {d.issuedAt && <span>{t("clientInvoices.issued")}: {new Date(d.issuedAt).toLocaleDateString()}</span>}
                          {d.dueAt && <span>{t("clientInvoices.due")}: {new Date(d.dueAt).toLocaleDateString()}</span>}
                          {d.paidAt && <span className="text-green-600">{t("clientInvoices.paidOn")}: {new Date(d.paidAt).toLocaleDateString()}</span>}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="ml-auto gap-1.5 print:hidden"
                            onClick={() => window.print()}
                          >
                            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                            {t("clientInvoices.print")}
                          </Button>
                        </div>
                        <div className="w-full overflow-x-auto">
                          <table className="w-full text-sm min-w-[480px]">
                            <thead>
                              <tr className="border-b text-left text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                                <th className="py-2">{t("clientInvoices.item")}</th>
                                <th className="py-2 text-right">{t("clientInvoices.qty")}</th>
                                <th className="py-2 text-right">{t("clientInvoices.unit")}</th>
                                <th className="py-2 text-right">{t("clientInvoices.lineTotal")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {d.lineItems.map((li, i) => (
                                <tr key={i} className="border-b last:border-0">
                                  <td className="py-2">{li.description}{li.sku ? <span className="ml-2 font-mono text-[10px] text-muted-foreground">{li.sku}</span> : null}</td>
                                  <td className="py-2 text-right">{li.quantity}</td>
                                  <td className="py-2 text-right">{money(li.unitPriceCents, d.currency)}</td>
                                  <td className="py-2 text-right">{money(li.totalCents, d.currency)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="ml-auto mt-3 max-w-xs space-y-1 text-sm">
                          <div className="flex justify-between text-muted-foreground"><span>{t("invoices.form.subtotal")}</span><span>{money(d.subtotalCents, d.currency)}</span></div>
                          {d.discountCents > 0 && <div className="flex justify-between text-muted-foreground"><span>{t("invoices.form.discount")}</span><span>-{money(d.discountCents, d.currency)}</span></div>}
                          {d.taxCents > 0 && <div className="flex justify-between text-muted-foreground"><span>{t("invoices.form.tax")}</span><span>+{money(d.taxCents, d.currency)}</span></div>}
                          <div className="flex justify-between border-t pt-1 text-base font-bold"><span>{t("invoices.form.total")}</span><span>{money(d.totalCents, d.currency)}</span></div>
                          {d.amountPaidCents > 0 && (
                            <>
                              <div className="flex justify-between text-green-600"><span>{t("clientInvoices.amountPaid")}</span><span>-{money(d.amountPaidCents, d.currency)}</span></div>
                              <div className="flex justify-between border-t pt-1 font-bold">
                                <span>{t("clientInvoices.amountDue")}</span>
                                <span>{money(invoiceAmountDueCents(d), d.currency)}</span>
                              </div>
                            </>
                          )}
                        </div>

                        {payments.length > 0 && (
                          <div className="mt-4">
                            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                              {t("clientInvoices.paymentHistory")}{" "}
                            <HelpHint
                              title="help.invoices.history.title"
                              body="help.invoices.history.body"
                              side="right"
                            />
                            </p>
                            <ul className="space-y-1 text-xs">
                              {payments.map((payment) => (
                                <li key={payment.id} className="flex justify-between gap-3 border-b pb-1 last:border-0">
                                  <span className="text-muted-foreground">
                                    {new Date(payment.createdAt).toLocaleDateString()}
                                    {payment.reference ? <span className="ml-2 font-mono">{payment.reference}</span> : null}
                                  </span>
                                  <span className="font-semibold">{money(payment.amountCents, d.currency)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {d.notes && <p className="mt-3 rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">{d.notes}</p>}

                        {d.status === "open" && (
                          <p className="mt-4 rounded-md bg-blue-500/5 p-3 text-right text-xs text-muted-foreground print:hidden">
                            {t("clientInvoices.payNote")}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
