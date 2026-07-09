/**
 * PMJoin — Project Manager invitation acceptance page.
 *
 * Accessed via:  /pm/join?token=<invite-token>
 *
 * Flow:
 *  1. On mount, validate the token from the query string.
 *  2. If valid, show a registration form (pre-filled email, set name + password).
 *  3. On submit, call acceptManagerInvitation() to activate the account.
 *  4. On success, redirect to /login with a success notice.
 *  5. If invalid / expired / already used, show a clear error with a contact link.
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { ENSLogo } from "@/components/ENSLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  MailCheck,
  ShieldX,
  UserPlus,
} from "lucide-react";
import {
  validateInviteToken,
  acceptManagerInvitation,
  type InviteTokenPayload,
} from "@/lib/platform-api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTokenFromSearch(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("token")?.trim() ?? "";
}

function PasswordStrength({ password }: { password: string }) {
  const { t } = useTranslation();
  const length  = password.length >= 8;
  const upper   = /[A-Z]/.test(password);
  const number  = /[0-9]/.test(password);
  const special = /[^A-Za-z0-9]/.test(password);
  const score   = [length, upper, number, special].filter(Boolean).length;

  const colours = ["bg-muted", "bg-destructive", "bg-amber-500", "bg-yellow-400", "bg-emerald-500"];
  const labels  = ["", t("pm.join.strength.weak"), t("pm.join.strength.fair"), t("pm.join.strength.good"), t("pm.join.strength.strong")];

  if (!password) return null;
  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i <= score ? colours[score] : "bg-muted"}`}
          />
        ))}
      </div>
      <p className={`text-[11px] font-medium ${score <= 1 ? "text-destructive" : score <= 2 ? "text-amber-500" : score === 3 ? "text-yellow-500" : "text-emerald-500"}`}>
        {labels[score]}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type PageState = "loading" | "valid" | "error" | "submitting" | "done";

export default function PMJoin() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const token = getTokenFromSearch();

  const [pageState,     setPageState]     = useState<PageState>("loading");
  const [invitation,    setInvitation]    = useState<InviteTokenPayload | null>(null);
  const [tokenError,    setTokenError]    = useState("");

  // Form fields
  const [name,          setName]          = useState("");
  const [password,      setPassword]      = useState("");
  const [confirmPwd,    setConfirmPwd]    = useState("");
  const [showPwd,       setShowPwd]       = useState(false);
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [formError,     setFormError]     = useState("");

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setTokenError(t("pm.join.error.noToken"));
      setPageState("error");
      return;
    }

    validateInviteToken(token)
      .then((payload) => {
        setInvitation(payload);
        if (payload.name) setName(payload.name);
        setPageState("valid");
      })
      .catch((err: unknown) => {
        setTokenError(err instanceof Error ? err.message : t("pm.join.error.invalidToken"));
        setPageState("error");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!name.trim()) { setFormError(t("pm.join.error.nameRequired")); return; }
    if (password.length < 8) { setFormError(t("pm.join.error.passwordTooShort")); return; }
    if (password !== confirmPwd) { setFormError(t("pm.join.error.passwordMismatch")); return; }

    setPageState("submitting");

    try {
      await acceptManagerInvitation(token, { name: name.trim(), password });
      setPageState("done");
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : t("pm.join.error.generic"));
      setPageState("valid");
    }
  }

  // After success, auto-redirect to login after 3 s
  useEffect(() => {
    if (pageState !== "done") return;
    const timer = setTimeout(() => navigate("/login", { replace: true }), 3000);
    return () => clearTimeout(timer);
  }, [pageState, navigate]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderLoading() {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-1/2 mx-auto" />
      </div>
    );
  }

  function renderError() {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <ShieldX className="h-7 w-7 text-destructive" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{t("pm.join.error.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tokenError}</p>
        </div>
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {t("pm.join.error.contact")}
          <br />
          <a
            href={`mailto:${t("pm.join.error.adminEmail")}`}
            className="mt-1 inline-block font-medium text-primary hover:underline"
          >
            {t("pm.join.error.adminEmail")}
          </a>
        </div>
        <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
          {t("pm.join.error.goToLogin")}
        </Button>
      </div>
    );
  }

  function renderDone() {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-4"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle className="h-8 w-8 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{t("pm.join.success.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("pm.join.success.body", { name })}
          </p>
        </div>
        <Button className="w-full" onClick={() => navigate("/login", { replace: true })}>
          {t("pm.join.success.goToLogin")}
        </Button>
      </motion.div>
    );
  }

  function renderForm() {
    return (
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Welcome banner */}
        <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <MailCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
          <div className="text-sm">
            <p className="font-medium">{t("pm.join.inviteConfirmed")}</p>
            <p className="text-muted-foreground">
              {t("pm.join.joiningAs", { email: invitation?.email ?? "" })}
            </p>
          </div>
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="full-name">{t("pm.join.form.fullName")} <span className="text-destructive">*</span></Label>
          <Input
            id="full-name"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setFormError(""); }}
            placeholder={t("pm.join.form.fullNamePlaceholder")}
            autoComplete="name"
            required
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("pm.join.form.password")} <span className="text-destructive">*</span></Label>
          <div className="relative">
            <Input
              id="password"
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFormError(""); }}
              placeholder={t("pm.join.form.passwordPlaceholder")}
              autoComplete="new-password"
              className="pr-10"
              required
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPwd ? t("pm.join.form.hidePassword") : t("pm.join.form.showPassword")}
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <PasswordStrength password={password} />
        </div>

        {/* Confirm password */}
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">{t("pm.join.form.confirmPassword")} <span className="text-destructive">*</span></Label>
          <div className="relative">
            <Input
              id="confirm-password"
              type={showConfirm ? "text" : "password"}
              value={confirmPwd}
              onChange={(e) => { setConfirmPwd(e.target.value); setFormError(""); }}
              placeholder={t("pm.join.form.confirmPasswordPlaceholder")}
              autoComplete="new-password"
              className="pr-10"
              required
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showConfirm ? t("pm.join.form.hidePassword") : t("pm.join.form.showPassword")}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {confirmPwd && password !== confirmPwd && (
            <p className="text-[11px] text-destructive">{t("pm.join.form.passwordMismatch")}</p>
          )}
        </div>

        {/* Form error */}
        <AnimatePresence>
          {formError && (
            <motion.p
              key="form-error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {formError}
            </motion.p>
          )}
        </AnimatePresence>

        <Button type="submit" className="w-full" disabled={pageState === "submitting"}>
          {pageState === "submitting"
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("pm.join.form.submitting")}</>
            : <><UserPlus className="mr-2 h-4 w-4" /> {t("pm.join.form.submit")}</>
          }
        </Button>
      </form>
    );
  }

  // ---------------------------------------------------------------------------
  // Shell
  // ---------------------------------------------------------------------------

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="rounded-2xl border bg-card p-8 shadow-xl shadow-black/10">
          {/* Logo */}
          <div className="mb-6 flex justify-center">
            <ENSLogo size="sm" href="/" />
          </div>

          {/* Page title — only shown during form states */}
          {(pageState === "valid" || pageState === "submitting") && (
            <div className="mb-6 text-center">
              <h1 className="text-xl font-bold tracking-tight">{t("pm.join.pageTitle")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("pm.join.pageSubtitle")}
              </p>
            </div>
          )}

          {/* Content */}
          {pageState === "loading"    && renderLoading()}
          {pageState === "error"      && renderError()}
          {pageState === "done"       && renderDone()}
          {(pageState === "valid" || pageState === "submitting") && renderForm()}
        </div>
      </motion.div>
    </div>
  );
}
