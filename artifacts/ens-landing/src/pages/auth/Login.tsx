import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useLocation } from 'wouter';
import { useState, useEffect } from 'react';
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
import { Shield, User, Briefcase, Eye, EyeOff, Zap, Lock, AlertTriangle } from 'lucide-react';
import { useAuth, UserRole, getRoleDashboard } from '@/contexts/AuthContext';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const ROLES: { value: UserRole; label: string; desc: string; icon: React.ElementType; color: string; border: string; activeBg: string }[] = [
  {
    value: 'chief',
    label: 'Chief Manager',
    desc: 'Full operational control & team oversight',
    icon: Shield,
    color: 'text-primary',
    border: 'border-primary/20 hover:border-primary/40',
    activeBg: 'bg-primary/10 border-primary text-primary',
  },
  {
    value: 'pm',
    label: 'Project Manager',
    desc: '3D design workspace & client delivery',
    icon: Briefcase,
    color: 'text-blue-400',
    border: 'border-blue-500/20 hover:border-blue-500/40',
    activeBg: 'bg-blue-500/10 border-blue-500 text-blue-400',
  },
  {
    value: 'client',
    label: 'Client Portal',
    desc: 'Review designs & approve deliverables',
    icon: User,
    color: 'text-cyan-400',
    border: 'border-cyan-500/20 hover:border-cyan-500/40',
    activeBg: 'bg-cyan-500/10 border-cyan-500 text-cyan-400',
  },
];

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
  const m = Math.floor(ms / 60000);
  const s = Math.ceil((ms % 60000) / 1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function Login() {
  const [, navigate] = useLocation();
  const auth = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('chief');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockMessage, setLockMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      navigate(getRoleDashboard(auth.user.role));
    }
  }, [auth.isAuthenticated, auth.user, navigate]);

  useEffect(() => {
    const state = getLockState();
    if (state.lockedUntil && Date.now() < state.lockedUntil) {
      setTimeLeft(state.lockedUntil - Date.now());
    }
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) { setLockMessage(''); return; }
    setLockMessage(`Account temporarily locked. Try again in ${formatTimeLeft(timeLeft)}.`);
    const id = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1000;
        if (next <= 0) { setLockMessage(''); clearInterval(id); return 0; }
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
    await new Promise(r => setTimeout(r, 900));

    const newState = recordFailedAttempt();
    if (newState.lockedUntil) {
      setTimeLeft(LOCKOUT_MS);
      setIsSubmitting(false);
      return;
    }

    localStorage.removeItem(LOCK_KEY);
    const name = values.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    auth.login({
      id: crypto.randomUUID(),
      name,
      email: values.email,
      company: 'ENS Platform',
      role: selectedRole,
    });
    navigate(getRoleDashboard(selectedRole));
  }

  function quickAccess(role: UserRole) {
    localStorage.removeItem(LOCK_KEY);
    auth.login({
      id: crypto.randomUUID(),
      name: role === 'chief' ? 'Chief Manager' : role === 'pm' ? 'Project Manager' : 'Client User',
      email: `${role}@ens-demo.com`,
      company: 'ENS Demo',
      role,
    });
    navigate(getRoleDashboard(role));
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
                      placeholder="••••••••"
                      autoComplete="current-password"
                      {...field}
                      className="pr-10"
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <p className="text-sm font-medium mb-2">Signing in as</p>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map(({ value, label, icon: Icon, activeBg, border, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedRole(value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center ${
                    selectedRole === value ? activeBg : `border-border/50 ${border} text-muted-foreground`
                  }`}
                >
                  <Icon className={`h-4 w-4 ${selectedRole === value ? '' : color}`} />
                  <span className="text-[11px] font-semibold leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>

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
                <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                Signing in…
              </span>
            ) : isLocked ? (
              <span className="flex items-center gap-2"><Lock className="h-4 w-4" /> Locked</span>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      </Form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center"><Separator /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground flex items-center gap-1.5">
            <Zap className="h-3 w-3" /> Demo Access
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {ROLES.map(({ value, label, desc, icon: Icon, color, border }) => (
          <button
            key={value}
            onClick={() => quickAccess(value)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${border}`}
            data-testid={`button-quick-${value}`}
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
