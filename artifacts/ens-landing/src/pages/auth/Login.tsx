import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useLocation } from 'wouter';
import { useState } from 'react';
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
import { Shield, User, Briefcase, Eye, EyeOff, Zap } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const QUICK_ACCESS = [
  {
    role: 'chief' as const,
    label: 'Chief Manager',
    desc: 'Full operational control & team oversight',
    icon: Shield,
    color: 'text-primary',
    border: 'border-primary/20 hover:border-primary/40 hover:bg-primary/5',
    path: '/chief',
  },
  {
    role: 'pm' as const,
    label: 'Project Manager',
    desc: '3D design workspace & client delivery',
    icon: Briefcase,
    color: 'text-blue-400',
    border: 'border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/5',
    path: '/pm',
  },
  {
    role: 'client' as const,
    label: 'Client Portal',
    desc: 'Review designs & approve deliverables',
    icon: User,
    color: 'text-cyan-400',
    border: 'border-cyan-500/20 hover:border-cyan-500/40 hover:bg-cyan-500/5',
    path: '/client',
  },
];

export default function Login() {
  const [, navigate] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  async function onSubmit(_values: LoginFormValues) {
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));
    setIsSubmitting(false);
    navigate('/chief');
  }

  return (
    <AuthLayout title="Welcome back" description="Sign in to access your workspace">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    placeholder="name@company.com"
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
                      onClick={() => setShowPassword((v) => !v)}
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
            disabled={isSubmitting}
            data-testid="button-login"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                Signing in…
              </span>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      </Form>

      <div className="relative my-7">
        <div className="absolute inset-0 flex items-center"><Separator /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground flex items-center gap-1.5">
            <Zap className="h-3 w-3" /> Quick Access
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {QUICK_ACCESS.map(({ label, desc, icon: Icon, color, border, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${border}`}
            data-testid={`button-login-${label.toLowerCase().replace(/\s+/g, '-')}`}
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

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don't have an account?{' '}
        <Link href="/signup" className="font-medium text-primary hover:underline" data-testid="link-signup">
          Sign up free
        </Link>
      </p>
    </AuthLayout>
  );
}
