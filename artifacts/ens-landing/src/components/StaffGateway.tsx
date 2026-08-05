/**
 * StaffGateway — company access-code gate for the staff portal.
 *
 * Only activates when VITE_STAFF_ACCESS_CODE is set in the environment.
 * When active, the user must enter the correct passphrase before they can
 * reach the login page.  The granted state is stored in sessionStorage so
 * it survives page refreshes within the same browser tab but is cleared
 * when the tab is closed.
 *
 * Security properties:
 *  - 3 wrong attempts → 30-second lockout (persisted to sessionStorage so
 *    a hard-reload does not bypass the lockout window).
 *  - The env-var value is never sent to the server; comparison is purely
 *    client-side.  This is a *discretion* layer, not a cryptographic
 *    authentication system.  Pair it with server-level IP restrictions or
 *    an SSO layer for production deployments.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ENSLogo } from "@/components/ENSLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, ShieldAlert, Eye, EyeOff } from "lucide-react";

const STORAGE_KEY_GRANTED   = "ens-staff-access-granted";
const STORAGE_KEY_ATTEMPTS  = "ens-staff-access-attempts";
const STORAGE_KEY_LOCKED_UNTIL = "ens-staff-access-locked-until";

const MAX_ATTEMPTS   = 3;
const LOCKOUT_MS     = 30_000; // 30 seconds
const CORRECT_CODE   = (import.meta.env.VITE_STAFF_ACCESS_CODE ?? "").trim();

// When the env var is absent / empty we skip the gate entirely.
const GATE_ENABLED = CORRECT_CODE.length > 0;

function isGranted(): boolean {
  return sessionStorage.getItem(STORAGE_KEY_GRANTED) === "1";
}

function getAttempts(): number {
  return parseInt(sessionStorage.getItem(STORAGE_KEY_ATTEMPTS) ?? "0", 10);
}

function getLockedUntil(): number {
  return parseInt(sessionStorage.getItem(STORAGE_KEY_LOCKED_UNTIL) ?? "0", 10);
}

function setGranted() {
  sessionStorage.setItem(STORAGE_KEY_GRANTED, "1");
  sessionStorage.removeItem(STORAGE_KEY_ATTEMPTS);
  sessionStorage.removeItem(STORAGE_KEY_LOCKED_UNTIL);
}

function recordFailure() {
  const attempts = getAttempts() + 1;
  sessionStorage.setItem(STORAGE_KEY_ATTEMPTS, String(attempts));
  if (attempts >= MAX_ATTEMPTS) {
    sessionStorage.setItem(STORAGE_KEY_LOCKED_UNTIL, String(Date.now() + LOCKOUT_MS));
  }
  return attempts;
}

// ---------------------------------------------------------------------------

export function StaffGateway({ children }: { children: ReactNode }) {
  const [granted,    setGrantedState] = useState(() => !GATE_ENABLED || isGranted());
  const [code,       setCode]         = useState("");
  const [error,      setError]        = useState("");
  const [showCode,   setShowCode]     = useState(false);
  const [lockedFor,  setLockedFor]    = useState(0);
  const [attempts,   setAttempts]     = useState(getAttempts);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Countdown timer while locked
  useEffect(() => {
    function tick() {
      const remaining = Math.ceil((getLockedUntil() - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockedFor(0);
        sessionStorage.removeItem(STORAGE_KEY_LOCKED_UNTIL);
        sessionStorage.removeItem(STORAGE_KEY_ATTEMPTS);
        setAttempts(0);
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      } else {
        setLockedFor(remaining);
      }
    }

    const until = getLockedUntil();
    if (until > Date.now()) {
      tick();
      timerRef.current = setInterval(tick, 1000);
    }

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [attempts]);

  // Auto-focus code input
  useEffect(() => {
    if (!granted) setTimeout(() => inputRef.current?.focus(), 100);
  }, [granted]);

  if (granted) return <>{children}</>;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lockedFor > 0) return;

    if (code.trim() === CORRECT_CODE) {
      setGranted();
      setGrantedState(true);
      return;
    }

    const newAttempts = recordFailure();
    setAttempts(newAttempts);
    setError(
      newAttempts >= MAX_ATTEMPTS
        ? `Too many incorrect attempts. Please wait ${LOCKOUT_MS / 1000} seconds.`
        : `Incorrect access code. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts !== 1 ? "s" : ""} remaining.`
    );
    setCode("");

    // Start the countdown timer if we just hit the limit
    if (newAttempts >= MAX_ATTEMPTS) {
      setLockedFor(Math.ceil(LOCKOUT_MS / 1000));
      timerRef.current = setInterval(() => {
        const remaining = Math.ceil((getLockedUntil() - Date.now()) / 1000);
        if (remaining <= 0) {
          setLockedFor(0);
          sessionStorage.removeItem(STORAGE_KEY_LOCKED_UNTIL);
          sessionStorage.removeItem(STORAGE_KEY_ATTEMPTS);
          setAttempts(0);
          setError("");
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        } else {
          setLockedFor(remaining);
        }
      }, 1000);
    }
  }

  const isLocked = lockedFor > 0;

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden bg-background">
      {/* Ambient glow layers — matching hero aesthetic */}
      <div className="absolute inset-0 grid-pattern opacity-[0.06] dark:opacity-[0.12] pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-primary/15 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-cyan-500/8 blur-[90px] rounded-full pointer-events-none" />

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm relative z-10"
        >
          {/* Card — dark, on-brand */}
          <div className="rounded-2xl border border-primary/20 bg-card/90 backdrop-blur-xl p-8 shadow-[0_0_60px_rgba(37,99,235,0.15),0_0_0_1px_rgba(37,99,235,0.08)]">
            {/* Logo */}
            <div className="mb-6 flex justify-center">
              <ENSLogo size="sm" href="/" />
            </div>

            {/* Header */}
            <div className="mb-6 text-center">
              {/* Glowing lock icon ring */}
              <div className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-primary/10 border border-primary/25 shadow-[0_0_20px_rgba(37,99,235,0.3)]" />
                <motion.div
                  animate={{ opacity: isLocked ? [1, 0.4, 1] : 1 }}
                  transition={{ duration: 1.5, repeat: isLocked ? Infinity : 0 }}
                >
                  {isLocked
                    ? <ShieldAlert className="h-6 w-6 text-destructive relative z-10" />
                    : <Lock className="h-6 w-6 text-primary relative z-10" />
                  }
                </motion.div>
              </div>
              <h1 className="text-xl font-bold tracking-tight">Staff Portal Access</h1>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                This portal is restricted to ENS team members only.
                Enter the company access code to continue.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="access-code" className="text-foreground/80 text-xs font-semibold uppercase tracking-wider">Access Code</Label>
                <div className="relative">
                  <Input
                    ref={inputRef}
                    id="access-code"
                    type={showCode ? "text" : "password"}
                    value={code}
                    onChange={(e) => { setCode(e.target.value); setError(""); }}
                    placeholder="Enter company access code"
                    disabled={isLocked}
                    autoComplete="off"
                    spellCheck={false}
                    className="pr-10 bg-background/50 border-border/60 focus:border-primary/50 focus:ring-primary/20 placeholder:text-muted-foreground/50"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowCode((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showCode ? "Hide access code" : "Show access code"}
                  >
                    {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Error / lockout message */}
              <AnimatePresence>
                {error && (
                  <motion.p
                    key="error"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs text-destructive"
                  >
                    {isLocked
                      ? `Account temporarily locked. Try again in ${lockedFor}s.`
                      : error
                    }
                  </motion.p>
                )}
              </AnimatePresence>

              <Button
                type="submit"
                className="w-full shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] transition-all"
                disabled={isLocked || code.trim().length === 0}
              >
                {isLocked ? `Locked (${lockedFor}s)` : "Enter Portal"}
              </Button>
            </form>

            {/* Footer */}
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Don&apos;t have the access code?{" "}
              <a
                href="mailto:admin@ens-agency.com"
                className="font-medium text-primary hover:underline"
              >
                Contact your administrator
              </a>
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
