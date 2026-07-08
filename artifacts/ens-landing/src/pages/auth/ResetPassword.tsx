import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useLocation } from 'wouter';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
import { CheckCircle2, Eye, EyeOff, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';
import { resetPassword } from '@/lib/platform-api';

function PasswordStrength({ password }: { password: string }) {
  const { t } = useTranslation();
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const labels = [
    '',
    t('auth.resetPassword.strength.weak'),
    t('auth.resetPassword.strength.fair'),
    t('auth.resetPassword.strength.good'),
    t('auth.resetPassword.strength.strong'),
  ];
  const colors = ['', 'bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
  const textColors = ['', 'text-red-500', 'text-yellow-500', 'text-blue-500', 'text-green-500'];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1" role="presentation">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= score ? colors[score] : 'bg-muted'
            }`}
            aria-hidden="true"
          />
        ))}
      </div>
      {score > 0 && (
        <p className={`text-[11px] font-medium ${textColors[score]}`} aria-live="polite">
          {labels[score]} {t('auth.resetPassword.strength.suffix')}
        </p>
      )}
    </div>
  );
}

export default function ResetPassword() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useMemo(() => new URLSearchParams(window.location.search).get('token'), []);

  useEffect(() => {
    document.title = t('auth.resetPassword.pageTitle');
  }, [t]);

  // Schema defined inside component so t() is available for validation messages
  const resetSchema = z
    .object({
      password: z
        .string()
        .min(8, t('auth.resetPassword.validation.passwordMin'))
        .regex(/[A-Z]/, t('auth.resetPassword.validation.passwordUpper'))
        .regex(/[0-9]/, t('auth.resetPassword.validation.passwordNumber')),
      confirmPassword: z.string().min(1, t('auth.resetPassword.validation.confirmRequired')),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: t('auth.resetPassword.validation.passwordsMismatch'),
      path: ['confirmPassword'],
    });

  type ResetFormValues = z.infer<typeof resetSchema>;

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const passwordValue = form.watch('password');

  async function onSubmit(values: ResetFormValues) {
    if (!token) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await resetPassword(token, values.password);
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.resetPassword.errorGeneric'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout title={t('auth.resetPassword.invalidLinkTitle', { defaultValue: 'Invalid link' })}>
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="h-14 w-14 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-2">
            <AlertCircle className="h-7 w-7 text-destructive" aria-hidden="true" />
          </div>
          <p className="text-muted-foreground leading-relaxed">
            {t('auth.resetPassword.invalidLinkMessage', { defaultValue: 'This password reset link is invalid or has expired. Please request a new one.' })}
          </p>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t('auth.resetPassword.requestNewLink', { defaultValue: 'Request new reset link' })}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (isSuccess) {
    return (
      <AuthLayout title={t('auth.resetPassword.successTitle')}>
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="h-14 w-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-2">
            <ShieldCheck className="h-7 w-7 text-green-500" aria-hidden="true" />
          </div>
          <p className="text-muted-foreground leading-relaxed">
            {t('auth.resetPassword.successMessage')}
          </p>
          <Button
            className="w-full mt-2 rounded-full gap-2"
            onClick={() => navigate('/login')}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {t('auth.resetPassword.continueToSignIn')}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth.resetPassword.title')}
      description={t('auth.resetPassword.description')}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.resetPassword.newPasswordLabel')}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t('auth.resetPassword.passwordPlaceholder')}
                      autoComplete="new-password"
                      {...field}
                      className="pr-10"
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={
                        showPassword
                          ? t('auth.resetPassword.hidePassword')
                          : t('auth.resetPassword.showPassword')
                      }
                    >
                      {showPassword
                        ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                        : <Eye className="h-4 w-4" aria-hidden="true" />}
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
                <FormLabel>{t('auth.resetPassword.confirmPasswordLabel')}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showConfirm ? 'text' : 'password'}
                      placeholder={t('auth.resetPassword.passwordPlaceholder')}
                      autoComplete="new-password"
                      {...field}
                      className="pr-10"
                      data-testid="input-confirm-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={
                        showConfirm
                          ? t('auth.resetPassword.hideConfirmPassword')
                          : t('auth.resetPassword.showConfirmPassword')
                      }
                    >
                      {showConfirm
                        ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                        : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg p-3 space-y-1">
            {[
              { key: 'requirements.length' as const, ok: passwordValue.length >= 8 },
              { key: 'requirements.uppercase' as const, ok: /[A-Z]/.test(passwordValue) },
              { key: 'requirements.number' as const, ok: /[0-9]/.test(passwordValue) },
            ].map(({ key, ok }) => (
              <div
                key={key}
                className={`flex items-center gap-2 transition-colors ${ok ? 'text-green-500' : ''}`}
              >
                <CheckCircle2
                  className={`h-3 w-3 ${ok ? 'text-green-500' : 'text-muted-foreground/40'}`}
                  aria-hidden="true"
                />
                {t(`auth.resetPassword.${key}`)}
              </div>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full rounded-full"
            disabled={isSubmitting}
            data-testid="button-reset"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Spinner className="text-primary-foreground" aria-hidden="true" />
                {t('auth.resetPassword.submitting')}
              </span>
            ) : (
              t('auth.resetPassword.submit')
            )}
          </Button>
        </form>
      </Form>

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('auth.resetPassword.backToLogin')}
        </Link>
      </div>
    </AuthLayout>
  );
}
