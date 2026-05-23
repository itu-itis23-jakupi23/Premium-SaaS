import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useLocation } from 'wouter';
import { useEffect, useState } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Shield, User, Briefcase, Eye, EyeOff, Zap, Lock, AlertTriangle } from 'lucide-react';
import { useAuth, getRoleDashboard } from '@/contexts/AuthContext';
import { CLIENT_ROLES, getPortalForbiddenMessage, isRoleAllowedInPortal, PORTAL_MODE, STAFF_ROLES } from '@/lib/portal';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LOCK_KEY = 'ens-login-lock';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const WINDOW_MS = 60 * 60 * 1000;
const DEV_PASSWORD = 'EnsDev2026!';

const DEV_ACCOUNTS = [
  { email: 'owner@ens.test', role: 'chief', label: 'Owner / Chief', desc: 'Full organization control', icon: Shield, color: 'text-primary' },
  { email: 'pm@ens.test', role: 'pm', label: 'Project Manager', desc: 'Assigned clients and booth workspace', icon: Briefcase, color: 'text-blue-400' },
  { email: 'client@ens.test', role: 'client', label: 'Client Reviewer', desc: 'Review and approve assigned designs', icon: User, color: 'text-cyan-400' },
] as const;

const PORTAL_DEV_ACCOUNTS = DEV_ACCOUNTS.filter((account) => {
  if (PORTAL_MODE === 'staff') return STAFF_ROLES.includes(account.role);
  if (PORTAL_MODE === 'client') return CLIENT_ROLES.includes(account.role);
  return true;
});

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

export default function Login() {
  const [, navigate] = useLocation();
  const auth = useAuth();
  const { isAuthenticated, isLoading, logout, user } = auth;
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockMessage, setLockMessage] = useState('');
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      if (!isRoleAllowedInPortal(user.role)) {
        void logout();
        setError(getPortalForbiddenMessage(user.role));
        return;
      }
      navigate(getRoleDashboard(user.role));
    }
  }, [isAuthenticated, isLoading, logout, navigate, user]);

  useEffect(() => {
    const state = getLockState();
    if (state.lockedUntil && Date.now() < state.lockedUntil) {
      setTimeLeft(state.lockedUntil - Date.now());
    }
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) {
      setLockMessage('');
      return;
    }

    setLockMessage(`Account temporarily locked. Try again in ${formatTimeLeft(timeLeft)}.`);
    const id = setInterval(() => {
      setTimeLeft((previous) => {
        const next = previous - 1000;
        if (next <= 0) {
          setLockMessage('');
          clearInterval(id);
          return 0;
        }
        setLockMessage(`Account temporarily locked. Try again in ${formatTimeLeft(next)}.`);
        return next;
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
      const user = await auth.login({
        email: values.email,
        password: values.password,
      });
      if (!isRoleAllowedInPortal(user.role)) {
        await auth.logout();
        setError(getPortalForbiddenMessage(user.role));
        return;
      }
      localStorage.removeItem(LOCK_KEY);
      navigate(getRoleDashboard(user.role));
    } catch (err) {
      const newState = recordFailedAttempt();
      if (newState.lockedUntil) setTimeLeft(LOCKOUT_MS);
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function quickAccess(email: string) {
    setIsSubmitting(true);
    setError('');

    try {
      const user = await auth.login({ email, password: DEV_PASSWORD });
      if (!isRoleAllowedInPortal(user.role)) {
        await auth.logout();
        setError(getPortalForbiddenMessage(user.role));
        return;
      }
      localStorage.removeItem(LOCK_KEY);
      navigate(getRoleDashboard(user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const isLocked = timeLeft > 0;

  return (
    <AuthLayout title="Welcome back" description="Sign in to access your workspace">
      {lockMessage && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <Lock className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{lockMessage}</p>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
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
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="name@company.com" autoComplete="email" {...field} data-testid="input-email" />
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
                  <FormLabel className="mb-0">Password</FormLabel>
                  <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      {...field}
                      className="pr-10"
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                <label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer select-none">
                  Keep me signed in for 30 days
                </label>
              </div>
            )}
          />

          <Button
            type="submit"
            className="w-full rounded-full h-11 font-semibold shadow-[0_0_15px_rgba(109,40,217,0.2)]"
            disabled={isSubmitting || isLocked}
            data-testid="button-login"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Spinner className="text-primary-foreground" />
                Signing in...
              </span>
            ) : isLocked ? (
              <span className="flex items-center gap-2"><Lock className="h-4 w-4" /> Locked</span>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      </Form>

      {import.meta.env.DEV && (
        <>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><Separator /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-3 text-muted-foreground flex items-center gap-1.5">
                <Zap className="h-3 w-3" /> Local Test Accounts
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {PORTAL_DEV_ACCOUNTS.map(({ email, label, desc, icon: Icon, color }) => (
              <button
                key={email}
                onClick={() => quickAccess(email)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left border-border/50 hover:border-primary/40"
                data-testid={`button-quick-${email}`}
              >
                <div className={`w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-semibold ${color}`}>{label}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{desc}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {getLockState().attempts > 0 && !isLocked && (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3 w-3 text-yellow-500 flex-shrink-0" />
          {MAX_ATTEMPTS - getLockState().attempts} sign-in attempts remaining before temporary lockout
        </div>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don't have an account?{' '}
        <Link href="/signup" className="font-medium text-primary hover:underline" data-testid="link-signup">
          Sign up free
        </Link>
      </p>
    </AuthLayout>
  );
}
