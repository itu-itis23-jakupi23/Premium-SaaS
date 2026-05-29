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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          {/* Card */}
          <div className="rounded-2xl border bg-card p-8 shadow-xl shadow-black/10">
            {/* Logo */}
            <div className="mb-6 flex justify-center">
              <ENSLogo size="sm" href="/" />
            </div>

            {/* Header */}
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                {isLocked
                  ? <ShieldAlert className="h-6 w-6 text-destructive" />
                  : <Lock className="h-6 w-6 text-primary" />
                }
              </div>
              <h1 className="text-xl font-bold tracking-tight">Staff Portal Access</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                This portal is restricted to ENS team members only.
                Enter the company access code to continue.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="access-code">Access Code</Label>
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
                    className="pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowCode((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                    className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
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
                className="w-full"
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
