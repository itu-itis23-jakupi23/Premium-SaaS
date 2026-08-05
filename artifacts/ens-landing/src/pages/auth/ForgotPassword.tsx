import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link } from 'wouter';
import { useState, useEffect } from 'react';
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
import { CheckCircle2, ArrowLeft, MailOpen, RefreshCw, AlertCircle } from 'lucide-react';
import { forgotPassword } from '@/lib/platform-api';

const RESEND_COOLDOWN = 60;

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = t('auth.forgotPassword.pageTitle');
  }, [t]);

  // Schema defined inside component so t() is available for validation messages
  const forgotPasswordSchema = z.object({
    email: z.string().email(t('auth.forgotPassword.validation.email')),
  });
  type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  async function onSubmit(values: ForgotPasswordFormValues) {
    setIsSubmitting(true);
    setError(null);
    try {
      await forgotPassword(values.email);
      setIsSubmitted(true);
      setResendCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.forgotPassword.errorGeneric'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setIsResending(true);
    setError(null);
    try {
      await forgotPassword(form.getValues('email'));
      setResendCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.forgotPassword.errorGeneric'));
    } finally {
      setIsResending(false);
    }
  }

  if (isSubmitted) {
    return (
      <AuthLayout title={t('auth.forgotPassword.sentTitle')}>
        <div className="flex flex-col items-center text-center space-y-4 py-2">
          <div className="h-14 w-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-2">
            <MailOpen className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('auth.forgotPassword.sentTo')}
            </p>
            <p className="text-sm font-semibold text-foreground bg-muted/50 rounded-lg px-4 py-2 border border-border/50">
              {form.getValues('email')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('auth.forgotPassword.checkSpam')}
            </p>
          </div>

          <div className="w-full pt-2 space-y-2">
            <Button
              variant="outline"
              className="w-full rounded-full gap-2"
              onClick={handleResend}
              disabled={resendCooldown > 0 || isResending}
            >
              {isResending ? (
                <span className="flex items-center gap-2">
                  <Spinner aria-hidden="true" />
                  {t('auth.forgotPassword.resending')}
                </span>
              ) : resendCooldown > 0 ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  {t('auth.forgotPassword.resendIn', { seconds: resendCooldown })}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  {t('auth.forgotPassword.resendEmail')}
                </span>
              )}
            </Button>

            <Button
              variant="ghost"
              className="w-full rounded-full gap-2 text-muted-foreground"
              onClick={() => {
                setIsSubmitted(false);
                form.reset();
              }}
            >
              {t('auth.forgotPassword.differentEmail')}
            </Button>
          </div>

          <div className="w-full border-t border-border/50 pt-4">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t('auth.forgotPassword.backToLogin')}
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('auth.forgotPassword.title')}
      description={t('auth.forgotPassword.description')}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.forgotPassword.emailLabel')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('auth.login.emailPlaceholder')}
                    autoComplete="email"
                    autoFocus
                    {...field}
                    data-testid="input-email"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full rounded-full h-11 font-semibold shadow-[0_0_15px_rgba(37,99,235,0.2)]"
            disabled={isSubmitting}
            data-testid="button-reset"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Spinner className="text-primary-foreground" aria-hidden="true" />
                {t('auth.forgotPassword.submitting')}
              </span>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" aria-hidden="true" />
                {t('auth.forgotPassword.submit')}
              </>
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
          {t('auth.forgotPassword.backToLogin')}
        </Link>
      </div>
    </AuthLayout>
  );
}
