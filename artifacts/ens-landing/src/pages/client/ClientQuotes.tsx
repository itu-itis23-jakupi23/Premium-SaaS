import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Check, X, Loader2, ChevronDown } from "lucide-react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { listQuotes, getQuote, respondToQuote, type Quote } from "@/lib/platform-api";
import { money, QUOTE_STATUS_STYLES as STATUS_STYLES } from "@/lib/quote-format";

export default function ClientQuotes() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    try { setQuotes(await listQuotes()); } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  async function open(q: Quote) {
    if (openId === q.id) { setOpenId(null); setDetail(null); return; }
    setOpenId(q.id); setDetail(null);
    try { setDetail(await getQuote(q.id)); void refresh(); } // getQuote marks viewed
    catch { setDetail(q); }
  }

  async function respond(q: Quote, decision: "accept" | "reject") {
    setBusy(true);
    try {
      const updated = await respondToQuote(q.id, decision);
      setDetail(updated);
      toast({ title: decision === "accept" ? t("clientQuotes.toast.accepted") : t("clientQuotes.toast.rejected") });
      void refresh();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : t("clientQuotes.error") });
    } finally { setBusy(false); }
  }

  return (
    <DashboardLayout role="client">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("clientQuotes.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("clientQuotes.subtitle")}</p>
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : quotes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          <FileText className="mx-auto mb-3 h-8 w-8 opacity-40" />
          {t("clientQuotes.empty")}
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map((q) => {
            const isOpen = openId === q.id;
            const d = isOpen ? detail : null;
            const canRespond = (d?.status ?? q.status) === "sent" || (d?.status ?? q.status) === "viewed";
            return (
              <div key={q.id} className="rounded-lg border bg-card">
                <button
                  onClick={() => open(q)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">{q.quoteNumber}</span>
                    <span className="font-semibold">{q.title || t("clientQuotes.untitled")}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{money(q.totalCents, q.currency)}</span>
                    <Badge className={STATUS_STYLES[q.status]}>{t(`quotes.status.${q.status}`)}</Badge>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t px-4 py-4">
                    {!d ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <div className="w-full overflow-x-auto">
                          <table className="w-full text-sm min-w-[480px]">
                            <thead>
                              <tr className="border-b text-left text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                                <th className="py-2">{t("clientQuotes.item")}</th>
                                <th className="py-2 text-right">{t("clientQuotes.qty")}</th>
                                <th className="py-2 text-right">{t("clientQuotes.unit")}</th>
                                <th className="py-2 text-right">{t("clientQuotes.lineTotal")}</th>
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
                          <div className="flex justify-between text-muted-foreground"><span>{t("quotes.form.subtotal")}</span><span>{money(d.subtotalCents, d.currency)}</span></div>
                          {d.discountCents > 0 && <div className="flex justify-between text-muted-foreground"><span>{t("quotes.form.discount")}</span><span>-{money(d.discountCents, d.currency)}</span></div>}
                          {d.taxCents > 0 && <div className="flex justify-between text-muted-foreground"><span>{t("quotes.form.tax")}</span><span>+{money(d.taxCents, d.currency)}</span></div>}
                          <div className="flex justify-between border-t pt-1 text-base font-bold"><span>{t("quotes.form.total")}</span><span>{money(d.totalCents, d.currency)}</span></div>
                        </div>

                        {d.notes && <p className="mt-3 rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">{d.notes}</p>}

                        {canRespond ? (
                          <div className="mt-4 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => respond(q, "reject")} disabled={busy} data-testid="button-reject-quote">
                              <X className="mr-1.5 h-4 w-4" /> {t("clientQuotes.decline")}
                            </Button>
                            <Button onClick={() => respond(q, "accept")} disabled={busy} data-testid="button-accept-quote">
                              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />} {t("clientQuotes.accept")}
                            </Button>
                          </div>
                        ) : (
                          <p className="mt-4 text-right text-xs text-muted-foreground">
                            {d.status === "accepted" ? t("clientQuotes.acceptedNote") : d.status === "rejected" ? t("clientQuotes.declinedNote") : ""}
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
