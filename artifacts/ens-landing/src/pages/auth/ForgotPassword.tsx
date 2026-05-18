import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link } from 'wouter';
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
import { CheckCircle2, ArrowLeft, MailOpen, RefreshCw } from 'lucide-react';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

const RESEND_COOLDOWN = 60;

export default function ForgotPassword() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  async function onSubmit(_values: ForgotPasswordFormValues) {
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 1000));
    setIsSubmitting(false);
    setIsSubmitted(true);
    setResendCooldown(RESEND_COOLDOWN);
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setIsResending(true);
    await new Promise((r) => setTimeout(r, 800));
    setIsResending(false);
    setResendCooldown(RESEND_COOLDOWN);
  }

  if (isSubmitted) {
    return (
      <AuthLayout title="Check your inbox">
        <div className="flex flex-col items-center text-center space-y-4 py-2">
          <div className="h-14 w-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-2">
            <MailOpen className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              We sent a password reset link to
            </p>
            <p className="text-sm font-semibold text-foreground bg-muted/50 rounded-lg px-4 py-2 border border-border/50">
              {form.getValues('email')}
            </p>
            <p className="text-xs text-muted-foreground">
              Check your spam folder if you don't see it within a few minutes.
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
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Sending…
                </span>
              ) : resendCooldown > 0 ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Resend in {resendCooldown}s
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Resend email
                </span>
              )}
            </Button>

            <Button
              variant="ghost"
              className="w-full rounded-full gap-2 text-muted-foreground"
              onClick={() => { setIsSubmitted(false); form.reset(); }}
            >
              Use a different email
            </Button>
          </div>

          <div className="w-full border-t border-border/50 pt-4">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to login
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset password"
      description="Enter your email and we'll send you a reset link"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email address</FormLabel>
                <FormControl>
                  <Input
                    placeholder="name@company.com"
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

          <Button
            type="submit"
            className="w-full rounded-full h-11 font-semibold shadow-[0_0_15px_rgba(109,40,217,0.2)]"
            disabled={isSubmitting}
            data-testid="button-reset"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                Sending link…
              </span>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Send Reset Link
              </>
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
