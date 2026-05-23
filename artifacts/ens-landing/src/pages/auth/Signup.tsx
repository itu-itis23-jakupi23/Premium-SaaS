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
import { Spinner } from '@/components/ui/spinner';
import { Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth, getRoleDashboard } from '@/contexts/AuthContext';

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  const colors = ['', 'bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const textColors = ['', 'text-red-500', 'text-yellow-500', 'text-blue-500', 'text-green-500'];
  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? colors[score] : 'bg-muted'}`} />
        ))}
      </div>
      <p className={`text-[11px] font-medium ${textColors[score]}`}>{labels[score]} password</p>
    </div>
  );
}

const signupSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    company: z.string().min(2, 'Company must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    terms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

export default function Signup() {
  const [, navigate] = useLocation();
  const auth = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      company: '',
      email: '',
      password: '',
      confirmPassword: '',
      terms: undefined as unknown as true,
    },
  });

  const passwordValue = form.watch('password');

  async function onSubmit(values: SignupFormValues) {
    setIsSubmitting(true);
    setError('');

    try {
      const user = await auth.signup({
        name: values.name,
        company: values.company,
        email: values.email,
        password: values.password,
      });
      navigate(getRoleDashboard(user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Create client account" description="Client signup creates a review account pending agency approval">
      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Public signup is limited to clients. Project managers and chiefs must be invited by an organization owner.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" autoComplete="name" {...field} data-testid="input-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Exhibits" autoComplete="organization" {...field} data-testid="input-company" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Work Email</FormLabel>
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
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a password"
                      autoComplete="new-password"
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
                      placeholder="Confirm your password"
                      autoComplete="new-password"
                      {...field}
                      className="pr-10"
                      data-testid="input-confirm-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="terms"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="terms"
                    checked={field.value === true}
                    onCheckedChange={(value) => field.onChange(value === true ? true : undefined)}
                    className="mt-0.5"
                    data-testid="checkbox-terms"
                  />
                  <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none">
                    I agree to the{' '}
                    <a href="#" className="text-primary hover:underline font-medium">Terms of Service</a>
                    {' '}and{' '}
                    <a href="#" className="text-primary hover:underline font-medium">Privacy Policy</a>
                  </label>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full rounded-full h-11 font-semibold shadow-[0_0_15px_rgba(109,40,217,0.2)]"
            disabled={isSubmitting}
            data-testid="button-signup"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Spinner className="text-primary-foreground" />
                Creating account...
              </span>
            ) : (
              'Create Client Account'
            )}
          </Button>
        </form>
      </Form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline" data-testid="link-login">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
