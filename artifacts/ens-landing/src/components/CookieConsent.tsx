import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  CONSENT_EVENT,
  shouldAskForConsent,
  writeConsent,
} from "@/lib/consent";

/**
 * The cookie notice (CS-03).
 *
 * Draws nothing unless there is a genuinely optional purpose configured and the
 * visitor has not yet decided — see lib/consent.ts. Accept and Decline are
 * given equal weight on purpose: a notice where refusing is harder than
 * accepting is not a free choice, and regulators treat it as no consent at all.
 */
export function CookieConsent() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(() => shouldAskForConsent());

  // Another tab deciding, or consent being cleared from the cookie policy page,
  // should settle this one too.
  useEffect(() => {
    const sync = () => setOpen(shouldAskForConsent());
    window.addEventListener(CONSENT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CONSENT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const decide = useCallback((analytics: boolean) => {
    writeConsent(analytics);
    setOpen(false);
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t("consent.title")}
      data-testid="cookie-consent"
      className="fixed inset-x-0 bottom-0 z-[120] p-3 sm:p-4"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center">
        <div className="flex-1 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">{t("consent.title")}</p>
          <p className="mt-1 leading-relaxed">
            {t("consent.body")}{" "}
            <Link href="/cookies" className="underline underline-offset-2 hover:text-foreground">
              {t("consent.policyLink")}
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={() => decide(false)}
            data-testid="cookie-consent-decline"
          >
            {t("consent.decline")}
          </Button>
          <Button
            className="flex-1 sm:flex-none"
            onClick={() => decide(true)}
            data-testid="cookie-consent-accept"
          >
            {t("consent.accept")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CookieConsent;
