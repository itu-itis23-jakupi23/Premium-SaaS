import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useLocation } from 'wouter';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from '@/components/layouts/AuthLayout';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { Eye, EyeOff, Lock, AlertTriangle, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth, getRoleDashboard, isTwoFactorChallenge, type UserRole } from '@/contexts/AuthContext';
import { getPortalForbiddenMessage, isRoleAllowedInPortal } from '@/lib/portal';

const LOCK_KEY = 'ens-login-lock';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const WINDOW_MS = 60 * 60 * 1000;

interface LockState {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

function getLockState(): LockState {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    return raw ? JSON.parse(raw) : { attempts: 0, firstAttempt: Date.now(), lockedUntil: null };
  } catch {
    return { attempts: 0, firstAttempt: Date.now(), lockedUntil: null };
  }
}

function recordFailedAttempt(): LockState {
  const state = getLockState();
  const now = Date.now();
  const windowExpired = now - state.firstAttempt > WINDOW_MS;
  const newAttempts = windowExpired ? 1 : state.attempts + 1;
  const newState: LockState = {
    attempts: newAttempts,
    firstAttempt: windowExpired ? now : state.firstAttempt,
    lockedUntil: newAttempts >= MAX_ATTEMPTS ? now + LOCKOUT_MS : null,
  };
  localStorage.setItem(LOCK_KEY, JSON.stringify(newState));
  return newState;
}

function formatTimeLeft(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.ceil((ms % 60000) / 1000);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function getPostLoginPath(role: UserRole) {
  const returnTo = new URLSearchParams(window.location.search).get('returnTo');
  if (returnTo && isSafeReturnTo(returnTo, role)) return returnTo;
  return getRoleDashboard(role);
}

function isSafeReturnTo(path: string, role: UserRole) {
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  const pathname = path.split(/[?#]/)[0];
  if (pathname === '/login' || pathname === '/signup') return false;
  if (role === 'chief') return pathname === '/chief' || pathname.startsWith('/chief/');
  if (role === 'pm') return pathname === '/pm' || pathname.startsWith('/pm/');
  return pathname === '/client' || pathname.startsWith('/client/');
}

export default function Login() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const auth = useAuth();
  const { isAuthenticated, isLoading, logout, user } = auth;
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  // Second-factor challenge state — set once the password step reports 2FA is required.
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');

  useEffect(() => {
    document.title = t('auth.login.pageTitle');
  }, [t]);

  // Schema defined inside component so t() is available for validation messages
  const loginSchema = z.object({
    email: z.string().email(t('auth.login.validation.email')),
    password: z.string().min(8, t('auth.login.validation.passwordMin')),
    rememberMe: z.boolean().default(false),
  });
  type LoginFormValues = z.infer<typeof loginSchema>;

  // Derived from timeLeft — no separate lockMessage state needed
  const lockMessage =
    timeLeft > 0 ? t('auth.login.lockMessage', { time: formatTimeLeft(timeLeft) }) : '';

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      if (!isRoleAllowedInPortal(user.role)) {
        void logout();
        setError(getPortalForbiddenMessage(user.role));
        return;
      }
      navigate(getPostLoginPath(user.role));
    }
  }, [isAuthenticated, isLoading, logout, navigate, user]);

  useEffect(() => {
    const state = getLockState();
    if (state.lockedUntil && Date.now() < state.lockedUntil) {
      setTimeLeft(state.lockedUntil - Date.now());
    }
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1000;
        return next <= 0 ? 0 : next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timeLeft]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  async function onSubmit(values: LoginFormValues) {
    const state = getLockState();
    if (state.lockedUntil && Date.now() < state.lockedUntil) {
      setTimeLeft(state.lockedUntil - Date.now());
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await auth.login({
        email: values.email,
        password: values.password,
      });
      // Account has 2FA — switch to the code step instead of completing the login.
      if (isTwoFactorChallenge(result)) {
        localStorage.removeItem(LOCK_KEY);
        setChallengeToken(result.challengeToken);
        setTwoFactorCode('');
        setTwoFactorError('');
        return;
      }
      if (!isRoleAllowedInPortal(result.role)) {
        await auth.logout();
        setError(getPortalForbiddenMessage(result.role));
        return;
      }
      localStorage.removeItem(LOCK_KEY);
      navigate(getPostLoginPath(result.role));
    } catch (err) {
      const newState = recordFailedAttempt();
      if (newState.lockedUntil) setTimeLeft(LOCKOUT_MS);
      setError(err instanceof Error ? err.message : t('auth.login.signInError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSubmitTwoFactor(event: React.FormEvent) {
    event.preventDefault();
    if (!challengeToken) return;
    const code = twoFactorCode.trim();
    if (!code) {
      setTwoFactorError(t('auth.login.twoFactor.required'));
      return;
    }
    setIsSubmitting(true);
    setTwoFactorError('');
    try {
      const loggedInUser = await auth.completeTwoFactorLogin(challengeToken, code);
      if (!isRoleAllowedInPortal(loggedInUser.role)) {
        await auth.logout();
        setChallengeToken(null);
        setError(getPortalForbiddenMessage(loggedInUser.role));
        return;
      }
      navigate(getPostLoginPath(loggedInUser.role));
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : t('auth.login.twoFactor.invalid'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function cancelTwoFactor() {
    setChallengeToken(null);
    setTwoFactorCode('');
    setTwoFactorError('');
    setIsSubmitting(false);
  }

  const isLocked = timeLeft > 0;

  if (challengeToken) {
    return (
      <AuthLayout
        title={t('auth.login.twoFactor.title')}
        description={t('auth.login.twoFactor.description')}
      >
        {twoFactorError && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4"
          >
            <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-red-400">{twoFactorError}</p>
          </div>
        )}

        <form onSubmit={onSubmitTwoFactor} className="space-y-4">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="twofactor-code" className="text-sm font-medium">
              {t('auth.login.twoFactor.codeLabel')}
            </label>
            <Input
              id="twofactor-code"
              inputMode="text"
              autoComplete="one-time-code"
              autoFocus
              placeholder="123456"
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
              className="text-center text-lg tracking-[0.3em]"
              data-testid="input-2fa-code"
            />
            <p className="text-xs text-muted-foreground">{t('auth.login.twoFactor.hint')}</p>
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || !twoFactorCode.trim()}
            data-testid="button-verify-2fa"
          >
            {isSubmitting ? <Spinner className="h-4 w-4" /> : t('auth.login.twoFactor.verify')}
          </Button>
          <button
            type="button"
            onClick={cancelTwoFactor}
            className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            {t('auth.login.twoFactor.back')}
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth.login.title')}
      description={t('auth.login.description')}
    >
      {lockMessage && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4"
        >
          <Lock className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-red-400">{lockMessage}</p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4"
        >
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="login-email">{t('auth.login.emailLabel')}</FormLabel>
                <FormControl>
                  <Input
                    id="login-email"
                    placeholder={t('auth.login.emailPlaceholder')}
                    autoComplete="email"
                    {...field}
                    data-testid="input-email"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between mb-1">
                  <FormLabel htmlFor="login-password" className="mb-0">{t('auth.login.passwordLabel')}</FormLabel>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {t('auth.login.forgotPassword')}
                  </Link>
                </div>
                <FormControl>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t('auth.login.passwordPlaceholder')}
                      autoComplete="current-password"
                      {...field}
                      className="pr-10"
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={
                        showPassword ? t('auth.login.hidePassword') : t('auth.login.showPassword')
                      }
                    >
                      {showPassword
                        ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                        : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rememberMe"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="checkbox-remember"
                />
                <button
                  type="button"
                  onClick={() => field.onChange(!field.value)}
                  className="text-sm text-muted-foreground cursor-pointer select-none"
                >
                  {t('auth.login.rememberMe')}
                </button>
              </div>
            )}
          />

          <Button
            type="submit"
            className="w-full rounded-full h-11 font-semibold shadow-[0_0_15px_rgba(37,99,235,0.2)]"
            disabled={isSubmitting || isLocked}
            data-testid="button-login"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Spinner className="text-primary-foreground" aria-hidden="true" />
                {t('auth.login.submitting')}
              </span>
            ) : isLocked ? (
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4" aria-hidden="true" />
                {t('auth.login.lockedBtn')}
              </span>
            ) : (
              t('auth.login.submit')
            )}
          </Button>
        </form>
      </Form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t('auth.login.noAccount')}{' '}
        <Link
          href="/signup"
          className="font-medium text-primary hover:underline"
          data-testid="link-signup"
        >
          {t('auth.login.signUpFree')}
        </Link>
      </p>
    </AuthLayout>
  );
}
