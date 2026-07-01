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
import { Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth, getRoleDashboard, type UserRole } from '@/contexts/AuthContext';
import { PORTAL_MODE } from '@/lib/portal';

function PasswordStrength({ password }: { password: string }) {
  const { t } = useTranslation();
  if (!password) return null;
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  const colors = ['', 'bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
  const labels = [
    '',
    t('auth.signup.strength.weak'),
    t('auth.signup.strength.fair'),
    t('auth.signup.strength.good'),
    t('auth.signup.strength.strong'),
  ];
  const textColors = ['', 'text-red-500', 'text-yellow-500', 'text-blue-500', 'text-green-500'];
  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex gap-1" role="presentation">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? colors[score] : 'bg-muted'}`}
            aria-hidden="true"
          />
        ))}
      </div>
      <p className={`text-[11px] font-medium ${textColors[score]}`} aria-live="polite">
        {labels[score]} {t('auth.signup.strength.suffix')}
      </p>
    </div>
  );
}

export default function Signup() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const auth = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isStaffPortal = PORTAL_MODE === 'staff';
  const [selectedRole, setSelectedRole] = useState<UserRole>(isStaffPortal ? 'pm' : 'client');

  useEffect(() => {
    document.title = t('auth.signup.pageTitle');
  }, [t]);

  // Schema defined inside component so t() is available for validation messages
  const needsCompany = selectedRole !== 'pm';
  const signupSchema = z
    .object({
      name: z.string().min(2, t('auth.signup.validation.nameMin')),
      company: needsCompany
        ? z.string().min(2, t('auth.signup.validation.companyMin'))
        : z.string().default(''),
      exhibition: selectedRole === 'client'
        ? z.string().min(2, 'Exhibition is required')
        : z.string().default(''),
      boothWidthM: selectedRole === 'client'
        ? z.coerce.number().min(1, 'Width is required').max(50)
        : z.coerce.number().optional(),
      boothDepthM: selectedRole === 'client'
        ? z.coerce.number().min(1, 'Depth is required').max(50)
        : z.coerce.number().optional(),
      preferredSystem: z.string().default('octanorm'),
      venueCity: z.string().default(''),
      targetDate: z.string().default(''),
      intakeNotes: z.string().max(1000).default(''),
      email: z.string().email(t('auth.signup.validation.email')),
      password: z
        .string()
        .min(8, t('auth.signup.validation.passwordMin'))
        .regex(/[A-Z]/, t('auth.signup.validation.passwordUpper'))
        .regex(/[0-9]/, t('auth.signup.validation.passwordNumber')),
      confirmPassword: z.string().min(1, t('auth.signup.validation.confirmRequired')),
      terms: z.literal(true, {
        errorMap: () => ({ message: t('auth.signup.validation.termsRequired') }),
      }),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('auth.signup.validation.passwordsMismatch'),
      path: ['confirmPassword'],
    });

  type SignupFormValues = z.infer<typeof signupSchema>;

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      company: '',
      exhibition: '',
      boothWidthM: 6,
      boothDepthM: 3,
      preferredSystem: 'octanorm',
      venueCity: '',
      targetDate: '',
      intakeNotes: '',
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
      const createdUser = await auth.signup({
        name: values.name,
        company: values.company,
        exhibition: values.exhibition,
        boothWidthM: values.boothWidthM,
        boothDepthM: values.boothDepthM,
        preferredSystem: values.preferredSystem,
        venueCity: values.venueCity,
        targetDate: values.targetDate,
        intakeNotes: values.intakeNotes,
        email: values.email,
        password: values.password,
        role: selectedRole,
      });
      navigate(getRoleDashboard(createdUser.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.signup.createError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title={isStaffPortal ? 'Create staff account' : t('auth.signup.title')}
      description={isStaffPortal ? 'Create a real PM or Chief Manager login for this staff portal.' : t('auth.signup.description')}
    >
      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4"
        >
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          {isStaffPortal
            ? 'Staff signup creates a real account with access to the PM or Chief Manager portal.'
            : t('auth.signup.clientOnlyNote')}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {isStaffPortal && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Account role
              </p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['pm', 'Project Manager', 'Workspace, clients, tasks'],
                  ['chief', 'Chief Manager', 'Full team oversight'],
                ] as const).map(([role, label, description]) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRole(role)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      selectedRole === role
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border bg-background/40 text-muted-foreground hover:border-primary/50'
                    }`}
                    data-testid={`button-role-${role}`}
                  >
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="mt-1 block text-[11px]">{description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('auth.signup.fullNameLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('auth.signup.fullNamePlaceholder')}
                      autoComplete="name"
                      {...field}
                      data-testid="input-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {needsCompany && (
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {selectedRole === 'client' ? t('auth.signup.companyLabel') : t('auth.signup.companyLabel')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={selectedRole === 'client' ? t('auth.signup.companyPlaceholder') : t('auth.signup.companyPlaceholder')}
                        autoComplete="organization"
                        {...field}
                        data-testid="input-company"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          {selectedRole === 'client' && (
            <div className="space-y-3 rounded-xl border border-border/70 bg-background/35 p-3">
              <div>
                <p className="text-sm font-semibold">Exhibition request</p>
                <p className="text-xs text-muted-foreground">This helps Chief assign the right project manager.</p>
              </div>
              <FormField
                control={form.control}
                name="exhibition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registered Exhibition</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. AutoShow Istanbul 2026"
                        autoComplete="off"
                        {...field}
                        data-testid="input-exhibition"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="boothWidthM"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Width (m)</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" max="50" step="1" {...field} data-testid="input-booth-width" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="boothDepthM"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Depth (m)</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" max="50" step="1" {...field} data-testid="input-booth-depth" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="preferredSystem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred System</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          data-testid="select-preferred-system"
                        >
                          <option value="octanorm">Octanorm</option>
                          <option value="maxima">Maxima</option>
                          <option value="custom">Custom / unsure</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="targetDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-target-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="venueCity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City / Venue</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Istanbul Tuyap" {...field} data-testid="input-venue-city" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="intakeNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <textarea
                        rows={3}
                        placeholder="Branding, deadline, booth type, or special requirements"
                        {...field}
                        className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        data-testid="input-intake-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.signup.workEmailLabel')}</FormLabel>
                <FormControl>
                  <Input
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
                <FormLabel htmlFor="signup-password">{t('auth.signup.passwordLabel')}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t('auth.signup.passwordPlaceholder')}
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
                        showPassword ? t('auth.signup.hidePassword') : t('auth.signup.showPassword')
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
                <FormLabel htmlFor="signup-confirm-password">{t('auth.signup.confirmPasswordLabel')}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      id="signup-confirm-password"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder={t('auth.signup.confirmPasswordPlaceholder')}
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
                          ? t('auth.signup.hideConfirmPassword')
                          : t('auth.signup.showConfirmPassword')
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

          <FormField
            control={form.control}
            name="terms"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="terms"
                    checked={field.value === true}
                    onCheckedChange={(value) =>
                      field.onChange(value === true ? true : undefined)
                    }
                    className="mt-0.5"
                    data-testid="checkbox-terms"
                  />
                  <div className="text-xs text-muted-foreground leading-relaxed select-none">
                    {t('auth.signup.termsLabel')}{' '}
                    <a href="#" className="text-primary hover:underline font-medium">
                      {t('auth.signup.termsOfService')}
                    </a>
                    {' '}{t('auth.signup.and')}{' '}
                    <a href="#" className="text-primary hover:underline font-medium">
                      {t('auth.signup.privacyPolicy')}
                    </a>
                  </div>
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
                <Spinner className="text-primary-foreground" aria-hidden="true" />
                {t('auth.signup.submitting')}
              </span>
            ) : (
              isStaffPortal ? `Create ${selectedRole === 'chief' ? 'Chief Manager' : 'PM'} Account` : t('auth.signup.submit')
            )}
          </Button>
        </form>
      </Form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        {t('auth.signup.haveAccount')}{' '}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
          data-testid="link-login"
        >
          {t('auth.signup.signIn')}
        </Link>
      </p>
    </AuthLayout>
  );
}
