import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useLocation } from 'wouter';
import { useState } from 'react';
import { AuthLayout } from '@/components/layouts/AuthLayout';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Eye, EyeOff, ArrowLeft, ShieldCheck } from 'lucide-react';

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type ResetFormValues = z.infer<typeof resetSchema>;

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', 'bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
  const textColors = ['', 'text-red-500', 'text-yellow-500', 'text-blue-500', 'text-green-500'];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= score ? colors[score] : 'bg-muted'
            }`}
          />
        ))}
      </div>
      {score > 0 && (
        <p className={`text-[11px] font-medium ${textColors[score]}`}>{labels[score]} password</p>
      )}
    </div>
  );
}

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const passwordValue = form.watch('password');

  async function onSubmit(_values: ResetFormValues) {
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 1200));
    setIsSubmitting(false);
    setIsSuccess(true);
  }

  if (isSuccess) {
    return (
      <AuthLayout title="Password updated">
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="h-14 w-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-2">
            <ShieldCheck className="h-7 w-7 text-green-500" />
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Your password has been updated successfully. You can now sign in with your new credentials.
          </p>
          <Button className="w-full mt-2 rounded-full gap-2" onClick={() => navigate('/login')}>
            <CheckCircle2 className="h-4 w-4" /> Continue to Sign In
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set new password"
      description="Choose a strong password for your account"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
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
                <PasswordStrength password={passwordValue} />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="••••••••"
                      {...field}
                      className="pr-10"
                      data-testid="input-confirm-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg p-3 space-y-1">
            {[
              { label: 'At least 8 characters', ok: passwordValue.length >= 8 },
              { label: 'One uppercase letter', ok: /[A-Z]/.test(passwordValue) },
              { label: 'One number', ok: /[0-9]/.test(passwordValue) },
            ].map(({ label, ok }) => (
              <div key={label} className={`flex items-center gap-2 transition-colors ${ok ? 'text-green-500' : ''}`}>
                <CheckCircle2 className={`h-3 w-3 ${ok ? 'text-green-500' : 'text-muted-foreground/40'}`} />
                {label}
              </div>
            ))}
          </div>

          <Button type="submit" className="w-full rounded-full" disabled={isSubmitting} data-testid="button-reset">
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Spinner className="text-primary-foreground" />
                Updating password…
              </span>
            ) : (
              'Update Password'
            )}
          </Button>
        </form>
      </Form>

      <div className="mt-6 text-center">
        <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>
      </div>
    </AuthLayout>
  );
}
