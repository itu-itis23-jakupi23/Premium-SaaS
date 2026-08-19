import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Send, Trash2, FileText, Loader2, X } from "lucide-react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  listQuotes, createQuote, sendQuote, deleteQuote, getPlatformClients,
  type Quote,
} from "@/lib/platform-api";
import { money, QUOTE_STATUS_STYLES as STATUS_STYLES } from "@/lib/quote-format";

interface DraftLine { description: string; sku: string; quantity: string; unitPrice: string; }
const emptyLine: DraftLine = { description: "", sku: "", quantity: "1", unitPrice: "" };

export default function Quotes({ role }: { role: "chief" | "pm" }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Array<{ id: string; label: string }>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Create-form state
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [lines, setLines] = useState<DraftLine[]>([{ ...emptyLine }]);
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      setQuotes(await listQuotes());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    getPlatformClients({ limit: 100 })
      .then((res) => {
        const list = (Array.isArray(res) ? res : (res as { clients?: unknown[] }).clients ?? []) as Array<Record<string, unknown>>;
        setClients(list.map((c) => ({ id: String(c.id), label: String(c.company || c.name || c.contactEmail || "Client") })));
      })
      .catch(() => setClients([]));
  }, []);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => sum + Math.round((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) * 100), 0);
    const disc = Math.round((Number(discount) || 0) * 100);
    const taxc = Math.round((Number(tax) || 0) * 100);
    return { subtotal, disc, taxc, total: Math.max(0, subtotal - disc + taxc) };
  }, [lines, discount, tax]);

  function resetForm() {
    setTitle(""); setClientId(""); setCurrency("USD"); setLines([{ ...emptyLine }]);
    setDiscount("0"); setTax("0"); setNotes(""); setFormError("");
  }

  async function save() {
    const items = lines
      .filter((l) => l.description.trim())
      .map((l) => ({ description: l.description.trim(), sku: l.sku.trim() || undefined, quantity: Number(l.quantity) || 0, unitPriceCents: Math.round((Number(l.unitPrice) || 0) * 100) }));
    if (items.length === 0) { setFormError(t("quotes.form.needLine")); return; }
    setSaving(true); setFormError("");
    try {
      await createQuote({
        clientId: clientId || undefined, title: title.trim() || undefined, currency,
        discountCents: totals.disc, taxCents: totals.taxc, notes: notes.trim() || undefined, lineItems: items,
      });
      toast({ title: t("quotes.toast.created") });
      setDialogOpen(false); resetForm(); void refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("quotes.form.error"));
    } finally {
      setSaving(false);
    }
  }

  async function doSend(q: Quote) {
    setBusyId(q.id);
    try { await sendQuote(q.id); toast({ title: t("quotes.toast.sent") }); void refresh(); }
    catch (err) { toast({ title: err instanceof Error ? err.message : t("quotes.form.error") }); }
    finally { setBusyId(null); }
  }
  async function doDelete(q: Quote) {
    setBusyId(q.id);
    try { await deleteQuote(q.id); void refresh(); }
    catch (err) { toast({ title: err instanceof Error ? err.message : t("quotes.form.error") }); }
    finally { setBusyId(null); }
  }

  return (
    <DashboardLayout role={role}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("quotes.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("quotes.subtitle")}</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} data-testid="button-new-quote">
          <Plus className="mr-2 h-4 w-4" /> {t("quotes.new")}
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b bg-muted/20 text-left text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-2.5">{t("quotes.col.number")}</th>
                <th className="px-4 py-2.5">{t("quotes.col.title")}</th>
                <th className="px-4 py-2.5">{t("quotes.col.total")}</th>
                <th className="px-4 py-2.5">{t("quotes.col.status")}</th>
                <th className="px-4 py-2.5 text-right">{t("quotes.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
              ) : quotes.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">{t("quotes.empty")}</td></tr>
              ) : quotes.map((q) => (
                <tr key={q.id} className="border-b last:border-0 hover:bg-muted/10">
                  <td className="px-4 py-3 font-mono text-xs">{q.quoteNumber}</td>
                  <td className="px-4 py-3">{q.title || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3 font-semibold">{money(q.totalCents, q.currency)}</td>
                  <td className="px-4 py-3"><Badge className={STATUS_STYLES[q.status]}>{t(`quotes.status.${q.status}`)}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {q.status === "draft" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => doSend(q)} disabled={busyId === q.id} data-testid={`send-${q.quoteNumber}`}>
                            <Send className="mr-1.5 h-3.5 w-3.5" /> {t("quotes.action.send")}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => doDelete(q)} disabled={busyId === q.id} aria-label={t("quotes.action.delete")}>
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </>
                      )}
                      {q.status !== "draft" && <span className="text-[11px] text-muted-foreground">{new Date(q.updatedAt).toLocaleDateString()}</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> {t("quotes.form.title")}</DialogTitle>
          </DialogHeader>

          {formError && <p className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-400">{formError}</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="q-title" className="text-xs">{t("quotes.form.name")}</Label>
              <Input id="q-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="CES 2027 Booth" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-client" className="text-xs">{t("quotes.form.client")}</Label>
              <select id="q-client" value={clientId} onChange={(e) => setClientId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="">{t("quotes.form.selectClient")}</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-2">
            <Label className="text-xs">{t("quotes.form.lineItems")}</Label>
            <div className="mt-2 space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-[1fr_70px_90px_auto] items-center gap-2">
                  <Input aria-label={t("quotes.form.description")} placeholder={t("quotes.form.description")} value={line.description}
                    onChange={(e) => setLines((ls) => ls.map((l, j) => j === i ? { ...l, description: e.target.value } : l))} />
                  <Input aria-label={t("quotes.form.qty")} type="number" min="0" placeholder="1" value={line.quantity}
                    onChange={(e) => setLines((ls) => ls.map((l, j) => j === i ? { ...l, quantity: e.target.value } : l))} />
                  <Input aria-label={t("quotes.form.unitPrice")} type="number" min="0" step="0.01" placeholder="0.00" value={line.unitPrice}
                    onChange={(e) => setLines((ls) => ls.map((l, j) => j === i ? { ...l, unitPrice: e.target.value } : l))} />
                  <Button variant="ghost" size="icon" aria-label={t("quotes.form.removeLine")} disabled={lines.length === 1}
                    onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setLines((ls) => [...ls, { ...emptyLine }])}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> {t("quotes.form.addLine")}
            </Button>
          </div>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="q-discount" className="text-xs">{t("quotes.form.discount")}</Label>
              <Input id="q-discount" type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-tax" className="text-xs">{t("quotes.form.tax")}</Label>
              <Input id="q-tax" type="number" min="0" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="q-notes" className="text-xs">{t("quotes.form.notes")}</Label>
            <Textarea id="q-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="mt-2 rounded-lg border bg-muted/20 p-3 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>{t("quotes.form.subtotal")}</span><span>{money(totals.subtotal, currency)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>{t("quotes.form.discount")}</span><span>-{money(totals.disc, currency)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>{t("quotes.form.tax")}</span><span>+{money(totals.taxc, currency)}</span></div>
            <div className="mt-1 flex justify-between border-t pt-1 font-bold"><span>{t("quotes.form.total")}</span><span>{money(totals.total, currency)}</span></div>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={save} disabled={saving} data-testid="button-save-quote">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{t("quotes.form.saveDraft")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
