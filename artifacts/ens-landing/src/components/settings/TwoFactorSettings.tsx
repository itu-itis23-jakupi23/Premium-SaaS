import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { ShieldCheck, Lock, Copy, Check, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  getTwoFactorStatus,
  startTwoFactorSetup,
  enableTwoFactor,
  disableTwoFactor,
  type TwoFactorStatus,
} from "@/lib/platform-api";

type Phase = "idle" | "enrolling" | "showingCodes";

/**
 * Self-contained two-factor (TOTP) management panel. Handles its own status,
 * enrollment, verification, backup-code display, and disabling, so it can drop
 * into any settings page without threading state through the parent.
 */
export function TwoFactorSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [secret, setSecret] = useState("");
  const [otpauthUri, setOtpauthUri] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const [disarm, setDisarm] = useState(false);
  const [disableCode, setDisableCode] = useState("");

  useEffect(() => {
    let active = true;
    getTwoFactorStatus()
      .then((next) => active && setStatus(next))
      .catch(() => active && setStatus({ enabled: false, pending: false, backupCodesRemaining: 0 }));
    return () => {
      active = false;
    };
  }, []);

  async function beginSetup() {
    setBusy(true);
    setError("");
    try {
      const { secret: nextSecret, otpauthUri: uri } = await startTwoFactorSetup();
      setSecret(nextSecret);
      setOtpauthUri(uri);
      // Render a scannable QR for the otpauth URI; the manual key stays as a fallback.
      setQrDataUrl(await QRCode.toDataURL(uri, { margin: 1, width: 176 }).catch(() => ""));
      setCode("");
      setPhase("enrolling");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.twoFactor.genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable() {
    if (!code.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { backupCodes: codes } = await enableTwoFactor(code.trim());
      setBackupCodes(codes);
      setPhase("showingCodes");
      setStatus({ enabled: true, pending: false, backupCodesRemaining: codes.length });
      toast({ title: t("settings.twoFactor.enabledToast") });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.twoFactor.invalidCode"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDisable() {
    if (!disableCode.trim()) return;
    setBusy(true);
    setError("");
    try {
      await disableTwoFactor(disableCode.trim());
      setStatus({ enabled: false, pending: false, backupCodesRemaining: 0 });
      setDisarm(false);
      setDisableCode("");
      setPhase("idle");
      toast({ title: t("settings.twoFactor.disabledToast") });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.twoFactor.invalidCode"));
    } finally {
      setBusy(false);
    }
  }

  function copyBackupCodes() {
    void navigator.clipboard?.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const formattedSecret = secret.replace(/(.{4})/g, "$1 ").trim();

  return (
    <div className="border-t pt-6" data-testid="settings-two-factor">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            <p className="text-sm font-medium">{t("settings.twoFactor.title")}</p>
            <Badge variant={status?.enabled ? "default" : "outline"}>
              {status?.enabled ? t("settings.twoFactor.on") : t("settings.twoFactor.off")}
            </Badge>
          </div>
          <p className="max-w-md text-xs text-muted-foreground">{t("settings.twoFactor.description")}</p>
          {status?.enabled && (
            <p className="text-xs text-muted-foreground">
              {t("settings.twoFactor.backupRemaining", { count: status.backupCodesRemaining })}
            </p>
          )}
        </div>

        {status && phase === "idle" && (
          <div className="flex flex-wrap gap-2">
            {status.enabled ? (
              <Button variant="outline" size="sm" onClick={() => setDisarm((v) => !v)} data-testid="button-disable-2fa">
                <Lock className="mr-2 h-4 w-4" aria-hidden="true" /> {t("settings.twoFactor.disable")}
              </Button>
            ) : (
              <Button size="sm" onClick={beginSetup} disabled={busy} data-testid="button-enable-2fa">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />}
                {t("settings.twoFactor.enable")}
              </Button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" aria-hidden="true" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Enrollment: show the secret for manual entry + verify a first code */}
      {phase === "enrolling" && (
        <div className="mt-4 space-y-4 rounded-lg border bg-background/40 p-4">
          <p className="text-sm font-medium">{t("settings.twoFactor.setupTitle")}</p>
          <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            <li>{t("settings.twoFactor.step1")}</li>
            <li>{t("settings.twoFactor.step2")}</li>
            <li>{t("settings.twoFactor.step3")}</li>
          </ol>
          {qrDataUrl && (
            <div className="flex flex-col items-center gap-2">
              <img
                src={qrDataUrl}
                alt={t("settings.twoFactor.qrAlt")}
                width={176}
                height={176}
                className="rounded-lg border bg-white p-2"
              />
              <span className="text-[11px] text-muted-foreground">{t("settings.twoFactor.scanHint")}</span>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">{t("settings.twoFactor.manualKey")}</Label>
            <code className="block select-all rounded-md bg-muted px-3 py-2 font-mono text-sm tracking-wider">{formattedSecret}</code>
            <a href={otpauthUri} className="text-[11px] text-primary hover:underline">
              {t("settings.twoFactor.openInApp")}
            </a>
          </div>
          <div className="space-y-2">
            <Label htmlFor="enroll-code" className="text-xs">{t("settings.twoFactor.codeLabel")}</Label>
            <Input
              id="enroll-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="max-w-[200px] tracking-[0.3em]"
              data-testid="input-enroll-code"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={confirmEnable} disabled={busy || !code.trim()} data-testid="button-confirm-2fa">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("settings.twoFactor.verifyEnable")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setPhase("idle"); setError(""); }}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* One-time backup codes */}
      {phase === "showingCodes" && (
        <div className="mt-4 space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t("settings.twoFactor.backupTitle")}</p>
            <Button variant="outline" size="sm" onClick={copyBackupCodes}>
              {copied ? <Check className="mr-2 h-3 w-3" /> : <Copy className="mr-2 h-3 w-3" />}
              {copied ? t("settings.twoFactor.copied") : t("settings.twoFactor.copyAll")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("settings.twoFactor.backupWarning")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {backupCodes.map((c) => (
              <code key={c} className="rounded-md bg-muted px-3 py-2 text-center font-mono text-xs">{c}</code>
            ))}
          </div>
          <Button size="sm" onClick={() => setPhase("idle")}>{t("settings.twoFactor.done")}</Button>
        </div>
      )}

      {/* Disable confirmation */}
      {disarm && status?.enabled && phase === "idle" && (
        <div className="mt-4 space-y-3 rounded-lg border bg-background/40 p-4">
          <p className="text-sm font-medium">{t("settings.twoFactor.disableTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("settings.twoFactor.disableHint")}</p>
          <Input
            inputMode="text"
            autoComplete="one-time-code"
            placeholder="123456"
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value)}
            className="max-w-[200px] tracking-[0.3em]"
            data-testid="input-disable-code"
          />
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={confirmDisable} disabled={busy || !disableCode.trim()} data-testid="button-confirm-disable-2fa">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("settings.twoFactor.confirmDisable")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setDisarm(false); setDisableCode(""); setError(""); }}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
