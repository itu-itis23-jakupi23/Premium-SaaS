import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, CreditCard } from "lucide-react";
import { getClientInvoiceSummary, sendConversationMessage, type ClientInvoiceSummary, type PlatformClient } from "@/lib/platform-api";
import { clientPortalUrl } from "@/lib/client-portal-url";
import { money } from "@/lib/quote-format";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export function PMClientBilling({ client }: { client: PlatformClient }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [summary, setSummary] = useState<ClientInvoiceSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const sending = useRef(false);
  const invoiceUrl = clientPortalUrl("/client/invoices");

  useEffect(() => {
    let current = true;
    setSummary(null);
    setFailed(false);
    getClientInvoiceSummary(client.id).then((data) => {
      if (current) setSummary(data);
    }).catch(() => {
      if (current) setFailed(true);
    });
    return () => { current = false; };
  }, [client.id, attempt]);

  async function sendInvoiceLink() {
    if (sending.current || !client.userId || !invoiceUrl || !summary?.invoiceCount) return;
    sending.current = true;
    setIsSending(true);
    try {
      // Link to the current invoices; an old balance snapshot in a message
      // could remain misleading after a payment is recorded.
      await sendConversationMessage(client.userId, t("pm.clients.detail.billing.live.message", { url: invoiceUrl }));
      toast({ title: t("pm.clients.detail.billing.live.messageSuccess") });
    } catch {
      toast({ variant: "destructive", title: t("pm.clients.detail.billing.live.messageFailed") });
    } finally {
      sending.current = false;
      setIsSending(false);
    }
  }

  return (
    <div className="space-y-5">
      <section aria-busy={!summary && !failed} className="space-y-4 rounded-lg border bg-card/50 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <CreditCard aria-hidden="true" className="h-4 w-4 text-primary" />
          {t("pm.clients.detail.billing.title")}
        </h3>
        {failed ? (
          <div role="alert" data-testid="billing-error" className="space-y-3 text-sm">
            <p>{t("pm.clients.detail.billing.live.loadError")}</p>
            <button type="button" data-testid="retry-billing-summary" onClick={() => setAttempt((value) => value + 1)} className="rounded-md border px-3 py-2 font-semibold">
              {t("pm.clients.detail.billing.live.retry")}
            </button>
          </div>
        ) : !summary ? (
          <div role="status" data-testid="billing-summary-loading" className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("pm.clients.detail.billing.live.loading")}</p>
            <Skeleton className="h-16 w-full" />
          </div>
        ) : summary.invoiceCount === 0 ? (
          <p data-testid="billing-empty" className="text-sm text-muted-foreground">{t("pm.clients.detail.billing.live.empty")}</p>
        ) : (
          <div className="space-y-4">
            {summary.balances.map((balance) => (
              <div key={balance.currency} data-testid="billing-summary-row" data-currency={balance.currency} className="space-y-2 border-b pb-3 last:border-0">
                <p className="text-xs font-semibold">{balance.currency}</p>
                <dl className="space-y-2 text-xs">
                  {([
                    ["billed", balance.billedCents],
                    ["received", balance.receivedCents],
                    ["outstanding", balance.outstandingCents],
                  ] as const).map(([label, cents]) => (
                    <div key={label} className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">{t(`pm.clients.detail.billing.live.${label}`)}</dt>
                      <dd data-testid={`billing-${label}`} className="font-semibold">{money(cents, balance.currency)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-xs text-muted-foreground">{t("pm.clients.detail.billing.live.invoices", { count: balance.invoiceCount })}</p>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">{t("pm.clients.detail.billing.live.source")}</p>
          </div>
        )}
      </section>
      {!invoiceUrl ? <p className="text-xs text-muted-foreground">{t("pm.clients.detail.billing.live.portalUnavailable")}</p> : null}
      <button type="button" data-testid="share-client-invoices-link" onClick={sendInvoiceLink}
        disabled={isSending || !client.userId || !invoiceUrl || !summary?.invoiceCount}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
        {isSending ? t("pm.clients.detail.billing.live.sending") : t("pm.clients.detail.billing.live.messageAction")}
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}
