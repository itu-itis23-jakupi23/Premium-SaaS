import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Check, X, Loader2, ChevronDown, Printer, Clock } from "lucide-react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HelpHint } from "@/components/HelpHint";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { useToast } from "@/hooks/use-toast";
import { listQuotes, getQuote, respondToQuote, type Quote } from "@/lib/platform-api";
import {
  money,
  daysUntil,
  isQuoteAwaitingResponse,
  isQuoteExpired,
  QUOTE_STATUS_STYLES as STATUS_STYLES,
} from "@/lib/quote-format";

type StatusFilter = "all" | "awaiting" | "decided";

const isAwaiting = (quote: Quote) => isQuoteAwaitingResponse(quote.status);
const hasExpired = (quote: Quote) => isQuoteExpired(quote);

export default function ClientQuotes() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [confirming, setConfirming] = useState<Quote | null>(null);
  const [declining, setDeclining] = useState<Quote | null>(null);
  const [declineNote, setDeclineNote] = useState("");
  // Click two quotes quickly and the first response can arrive last. Without
  // this the slower request lands in the panel of the quote now open.
  const detailRequest = useRef(0);

  /**
   * `withSpinner` is false for the background poll.
   *
   * The spinner replaces the whole list, so a poll that raised it blanked the
   * page every minute - including under the reader's cursor, mid-read. Only a
   * refresh the client asked for should be allowed to do that.
   */
  const refresh = useCallback(async (withSpinner = true) => {
    if (withSpinner) setLoading(true);
    setError("");
    try {
      setQuotes(await listQuotes());
    } catch {
      // Was silent before, which rendered the empty state: a client whose
      // quotes failed to load was told they had none.
      setError(t("experience.failed"));
    } finally {
      if (withSpinner) setLoading(false);
    }
  }, [t]);

  useEffect(() => { void refresh(); }, [refresh]);

  // A quote can be sent while the client has this page open. Not while a
  // decision is in flight - a reload mid-request would race the response.
  useLiveRefresh(() => refresh(false), { intervalMs: 60_000, enabled: !busy && !loading });

  const summary = useMemo(() => {
    const awaiting = quotes.filter((q) => isAwaiting(q) && !hasExpired(q));
    const soonest = awaiting
      .map((q) => q.validUntil)
      .filter((value): value is string => Boolean(value))
      .sort()[0];
    return {
      awaitingCount: awaiting.length,
      awaitingCents: awaiting.reduce((sum, q) => sum + q.totalCents, 0),
      currency: quotes[0]?.currency ?? "USD",
      soonestDeadline: soonest ?? null,
    };
  }, [quotes]);

  const visible = useMemo(() => {
    if (filter === "awaiting") return quotes.filter((q) => isAwaiting(q) && !hasExpired(q));
    if (filter === "decided") return quotes.filter((q) => !isAwaiting(q) || hasExpired(q));
    return quotes;
  }, [quotes, filter]);

  async function open(q: Quote) {
    const request = ++detailRequest.current;
    if (openId === q.id) { setOpenId(null); setDetail(null); setDetailError(""); return; }
    setOpenId(q.id);
    setDetail(null);
    setDetailError("");
    try {
      const full = await getQuote(q.id);
      if (request !== detailRequest.current) return;
      setDetail(full);
      // getQuote marks the quote viewed, so the badge in the list is now stale.
      void refresh(false);
    } catch {
      if (request !== detailRequest.current) return;
      // Fall back to the list row so the totals still render, but say that the
      // line items may be missing rather than showing an empty table as fact.
      setDetail(q);
      setDetailError(t("experience.detailUnavailable"));
    }
  }

  async function respond(q: Quote, decision: "accept" | "reject", note?: string) {
    setBusy(true);
    try {
      const updated = await respondToQuote(q.id, decision, note);
      setDetail(updated);
      toast({ title: decision === "accept" ? t("clientQuotes.toast.accepted") : t("clientQuotes.toast.rejected") });
      void refresh(false);
    } catch (err) {
      toast({
        variant: "destructive",
        title: err instanceof Error ? err.message : t("clientQuotes.error"),
      });
      // The usual failure is a 409 from a quote the server has just moved to
      // `expired`. Reloading replaces the Accept button with the real state
      // instead of leaving a button that can only fail again.
      void refresh(false);
    } finally {
      setBusy(false);
      setConfirming(null);
      setDeclining(null);
      setDeclineNote("");
    }
  }

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t("clientQuotes.filter.all") },
    { key: "awaiting", label: t("clientQuotes.filter.awaiting") },
    { key: "decided", label: t("clientQuotes.filter.decided") },
  ];

  return (
    <DashboardLayout role="client">
      <div className="mb-6 print:hidden">
        <h1 className="text-2xl font-bold tracking-tight">{t("clientQuotes.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("clientQuotes.subtitle")}</p>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-destructive p-3 text-sm">
          {error}
          <Button variant="outline" className="ms-2 min-h-11" disabled={loading} onClick={() => void refresh()}>
            {t("experience.retry")}
          </Button>
        </div>
      )}
      {detailError && <p role="alert" className="mb-4 rounded-lg border p-3 text-sm">{detailError}</p>}

      {!loading && quotes.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3 print:hidden">
          <div className="rounded-lg border bg-card p-4">
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("clientQuotes.summary.awaiting")}
              <HelpHint
                title="help.quotes.awaiting.title"
                body="help.quotes.awaiting.body"
                note="help.quotes.awaiting.note"
              />
            </p>
            <p className="mt-1 text-2xl font-bold">{summary.awaitingCount}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("clientQuotes.summary.value")}
            </p>
            <p className="mt-1 text-2xl font-bold">{money(summary.awaitingCents, summary.currency)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("clientQuotes.summary.deadline")}
              <HelpHint title="help.quotes.validity.title" body="help.quotes.validity.body" />
            </p>
            <p className="mt-1 text-2xl font-bold">
              {summary.soonestDeadline
                ? new Date(summary.soonestDeadline).toLocaleDateString()
                : t("clientQuotes.summary.noDeadline")}
            </p>
          </div>
        </div>
      )}

      {!loading && quotes.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 print:hidden" role="group" aria-label={t("clientQuotes.filter.label")}>
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
      ) : quotes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          <FileText className="mx-auto mb-3 h-8 w-8 opacity-40" />
          {t("clientQuotes.empty")}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          {t("clientQuotes.emptyFilter")}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((q) => {
            const isOpen = openId === q.id;
            const d = isOpen ? detail : null;
            const shown = d ?? q;
            const expired = hasExpired(shown);
            const canRespond = isAwaiting(shown) && !expired;
            const countdown = shown.validUntil && !expired ? daysUntil(shown.validUntil) : null;
            return (
              <div key={q.id} className="rounded-lg border bg-card">
                <button
                  type="button"
                  data-testid={`button-quote-${q.id}`}
                  onClick={() => void open(q)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  aria-expanded={isOpen}
                  aria-controls={`quote-detail-${q.id}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">{q.quoteNumber}</span>
                    <span className="font-semibold">{q.title || t("clientQuotes.untitled")}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {countdown !== null && countdown <= 7 && (
                      <span className="hidden items-center gap-1 text-xs text-amber-600 sm:flex">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("clientQuotes.expiresIn", { count: Math.max(countdown, 0) })}
                      </span>
                    )}
                    <span className="font-semibold">{money(q.totalCents, q.currency)}</span>
                    <Badge className={STATUS_STYLES[expired ? "expired" : q.status]}>
                      {t(`quotes.status.${expired ? "expired" : q.status}`)}
                    </Badge>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {isOpen && (
                  <div id={`quote-detail-${q.id}`} className="border-t px-4 py-4">
                    {!d ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {d.sentAt && <span>{t("clientQuotes.sent")}: {new Date(d.sentAt).toLocaleDateString()}</span>}
                          {d.validUntil && (
                            <span className={expired ? "text-red-600" : ""}>
                              {t("clientQuotes.validUntil")}: {new Date(d.validUntil).toLocaleDateString()}
                            </span>
                          )}
                          {d.respondedAt && <span>{t("clientQuotes.responded")}: {new Date(d.respondedAt).toLocaleDateString()}</span>}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="ml-auto gap-1.5 print:hidden"
                            onClick={() => window.print()}
                          >
                            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                            {t("clientQuotes.print")}
                          </Button>
                        </div>

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

                        {/* Terms are part of what accepting commits to, so they
                            belong in front of the Accept button rather than in
                            the agency's copy only. */}
                        {d.terms && (
                          <div className="mt-3 rounded-md border p-3">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                              {t("clientQuotes.terms")}
                            </p>
                            <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{d.terms}</p>
                          </div>
                        )}

                        {d.responseNote && (
                          <p className="mt-3 rounded-md border p-3 text-xs text-muted-foreground">
                            {t("clientQuotes.yourNote")}: {d.responseNote}
                          </p>
                        )}

                        {canRespond ? (
                          <div className="mt-4 flex flex-wrap items-center justify-end gap-2 print:hidden">
                            <HelpHint
                              title="help.quotes.deciding.title"
                              body="help.quotes.deciding.body"
                              note="help.quotes.deciding.note"
                              className="me-auto"
                            />
                            <Button variant="outline" onClick={() => setDeclining(d)} disabled={busy} data-testid="button-reject-quote">
                              <X className="mr-1.5 h-4 w-4" /> {t("clientQuotes.decline")}
                            </Button>
                            <Button onClick={() => setConfirming(d)} disabled={busy} data-testid="button-accept-quote">
                              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />} {t("clientQuotes.accept")}
                            </Button>
                          </div>
                        ) : (
                          <p className="mt-4 text-right text-xs text-muted-foreground">
                            {expired && isAwaiting(d)
                              ? t("clientQuotes.expiredNote")
                              : d.status === "accepted"
                                ? t("clientQuotes.acceptedNote")
                                : d.status === "rejected"
                                  ? t("clientQuotes.declinedNote")
                                  : d.status === "expired"
                                    ? t("clientQuotes.expiredNote")
                                    : d.status === "revised"
                                      ? t("clientQuotes.revisedNote")
                                      : t("clientQuotes.notRespondableNote")}
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

      {/* Accepting is a commercial commitment the client cannot undo from here,
          so it asks once rather than acting on a single click. */}
      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("clientQuotes.confirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("clientQuotes.confirm.body", {
                amount: confirming ? money(confirming.totalCents, confirming.currency) : "",
                number: confirming?.quoteNumber ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("clientQuotes.confirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-accept"
              onClick={() => confirming && void respond(confirming, "accept")}
            >
              {t("clientQuotes.confirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* The server already stores a response note; nothing sent one, so every
          declined quote reached the agency with no reason attached. */}
      <AlertDialog open={declining !== null} onOpenChange={(open) => !open && (setDeclining(null), setDeclineNote(""))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("clientQuotes.declineDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("clientQuotes.declineDialog.body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <label htmlFor="quote-decline-note" className="sr-only">
            {t("clientQuotes.declineDialog.label")}
          </label>
          <Textarea
            id="quote-decline-note"
            data-testid="input-decline-note"
            value={declineNote}
            onChange={(event) => setDeclineNote(event.target.value)}
            rows={3}
            placeholder={t("clientQuotes.declineDialog.placeholder")}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{t("clientQuotes.confirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-decline"
              disabled={!declineNote.trim()}
              onClick={() => declining && void respond(declining, "reject", declineNote.trim())}
            >
              {t("clientQuotes.declineDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
