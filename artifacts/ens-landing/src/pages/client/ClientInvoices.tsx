import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Receipt, Loader2, ChevronDown } from "lucide-react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { listInvoices, getInvoice, type Invoice } from "@/lib/platform-api";
import { money, INVOICE_STATUS_STYLES as STATUS_STYLES } from "@/lib/quote-format";

export default function ClientInvoices() {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Invoice | null>(null);

  async function refresh() {
    setLoading(true);
    try { setInvoices(await listInvoices()); } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  async function open(inv: Invoice) {
    if (openId === inv.id) { setOpenId(null); setDetail(null); return; }
    setOpenId(inv.id); setDetail(null);
    try { setDetail(await getInvoice(inv.id)); } catch { setDetail(inv); }
  }

  return (
    <DashboardLayout role="client">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("clientInvoices.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("clientInvoices.subtitle")}</p>
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : invoices.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          <Receipt className="mx-auto mb-3 h-8 w-8 opacity-40" />
          {t("clientInvoices.empty")}
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => {
            const isOpen = openId === inv.id;
            const d = isOpen ? detail : null;
            const overdue = inv.status === "open" && inv.dueAt && new Date(inv.dueAt) < new Date();
            return (
              <div key={inv.id} className="rounded-lg border bg-card">
                <button onClick={() => open(inv)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" aria-expanded={isOpen}>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">{inv.invoiceNumber}</span>
                    <span className="font-semibold">{inv.title || t("clientInvoices.untitled")}</span>
                    {overdue && <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-600">{t("clientInvoices.overdue")}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{money(inv.totalCents, inv.currency)}</span>
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
                        <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                          {d.issuedAt && <span>{t("clientInvoices.issued")}: {new Date(d.issuedAt).toLocaleDateString()}</span>}
                          {d.dueAt && <span>{t("clientInvoices.due")}: {new Date(d.dueAt).toLocaleDateString()}</span>}
                          {d.paidAt && <span className="text-green-600">{t("clientInvoices.paidOn")}: {new Date(d.paidAt).toLocaleDateString()}</span>}
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
                        </div>

                        {d.notes && <p className="mt-3 rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">{d.notes}</p>}

                        {d.status === "open" && (
                          <p className="mt-4 rounded-md bg-blue-500/5 p-3 text-right text-xs text-muted-foreground">
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
