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
import { ArrowRight, Eye, EyeOff, CheckCircle2, AlertTriangle, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth, getRoleDashboard, type UserRole } from '@/contexts/AuthContext';
import { getRequestPortal } from '@/lib/portal';
import { invitationTokenFromInput } from '@/lib/platform-api';

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
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const roleQuery = searchParams.get('role') as UserRole | null;
  const organizationQuery = searchParams.get('organization') ?? searchParams.get('agency') ?? '';
  const activePortal = getRequestPortal();
  const isStaffPortal = activePortal === 'staff';

  const initialRole: UserRole = roleQuery && (isStaffPortal ? (roleQuery === 'pm' || roleQuery === 'chief') : roleQuery === 'client')
    ? roleQuery
    : (isStaffPortal ? 'pm' : 'client');
  const [selectedRole, setSelectedRole] = useState<UserRole>(initialRole);
  const [inviteInput, setInviteInput] = useState('');
  const [inviteInputError, setInviteInputError] = useState('');

  useEffect(() => {
    document.title = t('auth.signup.pageTitle');
  }, [t]);

  useEffect(() => {
    if (!isStaffPortal) return;
    const params = new URLSearchParams(window.location.search);
    const legacyInvite = params.get('invite') ?? params.get('token');
    if (!legacyInvite) return;

    const token = invitationTokenFromInput(legacyInvite);
    if (token) navigate(`/pm/join?token=${encodeURIComponent(token)}`, { replace: true });
  }, [isStaffPortal, navigate]);

  // Schema defined inside component so t() is available for validation messages
  const needsCompany = selectedRole !== 'pm';
  const signupSchema = z
    .object({
      name: z.string().min(2, t('auth.signup.validation.nameMin')),
      company: needsCompany
        ? z.string().min(2, t('auth.signup.validation.companyMin'))
        : z.string().default(''),
      organizationSlug: selectedRole === 'client'
        ? z.string().trim().min(2, 'Enter the agency code supplied by your Chief Manager.')
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
      setupKey: selectedRole === 'chief'
        ? z.string().min(8, 'Enter the organization setup code provided by ENS.')
        : z.string().default(''),
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
      organizationSlug: organizationQuery,
      exhibition: '',
      boothWidthM: 6,
      boothDepthM: 3,
      preferredSystem: 'octanorm',
      venueCity: '',
      targetDate: '',
      intakeNotes: '',
      setupKey: '',
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
        organizationSlug: values.organizationSlug.trim().toLowerCase(),
        exhibition: values.exhibition,
        boothWidthM: values.boothWidthM,
        boothDepthM: values.boothDepthM,
        preferredSystem: values.preferredSystem,
        venueCity: values.venueCity,
        targetDate: values.targetDate,
        intakeNotes: values.intakeNotes,
        setupKey: values.setupKey,
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

  function continueWithInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = invitationTokenFromInput(inviteInput);
    if (!token) {
      setInviteInputError('Enter the invitation code or paste the invitation link sent by your Chief Manager.');
      return;
    }

    setInviteInputError('');
    navigate(`/pm/join?token=${encodeURIComponent(token)}`);
  }

  if (isStaffPortal && selectedRole === 'pm') {
    return (
      <AuthLayout
        title="Join as a Project Manager"
        description="Use the invitation from your Chief Manager. Your company and access are assigned automatically."
      >
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Account path
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-lg border border-primary bg-primary/10 p-3 text-left text-foreground"
              data-testid="button-role-pm"
            >
              <span className="block text-sm font-semibold">Project Manager</span>
              <span className="mt-1 block text-[11px] text-muted-foreground">Join an existing company</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedRole('chief');
                setInviteInputError('');
              }}
              className="rounded-lg border border-border bg-background/40 p-3 text-left text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              data-testid="button-role-chief"
            >
              <span className="block text-sm font-semibold">Chief Manager</span>
              <span className="mt-1 block text-[11px]">Create a new company</span>
            </button>
          </div>
        </div>

        <div className="mb-5 flex items-start gap-3 border-l-2 border-primary bg-primary/5 px-4 py-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">Invitation-only team access</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              The invitation identifies your company, work email, and Project Manager role. You cannot be assigned to the wrong organization by typing a company name.
            </p>
          </div>
        </div>

        <form onSubmit={continueWithInvitation} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="manager-invitation" className="text-sm font-medium">
              Invitation link or code
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="manager-invitation"
                name="managerInvitation"
                value={inviteInput}
                onChange={(event) => {
                  setInviteInput(event.target.value);
                  setInviteInputError('');
                }}
                placeholder="Paste the link or invitation code"
                autoComplete="one-time-code"
                autoFocus
                className="pl-10"
                aria-describedby="manager-invitation-help"
                aria-invalid={Boolean(inviteInputError)}
                data-testid="input-manager-invitation"
              />
            </div>
            <p id="manager-invitation-help" className="text-xs leading-relaxed text-muted-foreground">
              You can paste the complete email link or only the code copied by your Chief Manager.
            </p>
            {inviteInputError && (
              <p role="alert" className="text-xs text-red-400" data-testid="manager-invitation-error">
                {inviteInputError}
              </p>
            )}
          </div>

          <Button type="submit" className="h-11 w-full rounded-full font-semibold" data-testid="button-continue-invitation">
            Verify invitation
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already activated your account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline" data-testid="link-login">
            Sign in
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={selectedRole === 'chief' ? 'Create Chief Manager account' : selectedRole === 'pm' ? 'Join as Project Manager' : t('auth.signup.title')}
      description={selectedRole === 'chief' ? 'Create a new agency workspace and become its Chief Manager.' : selectedRole === 'pm' ? 'Join an existing agency team using an invitation code.' : t('auth.signup.description')}
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
          {selectedRole === 'chief'
            ? 'Chief signup creates a new agency organization workspace.'
            : selectedRole === 'pm'
            ? 'Project Managers join an existing agency organization via a Chief invitation code.'
            : t('auth.signup.clientOnlyNote')}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {isStaffPortal && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Staff Account Role
              </p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['pm', 'Project Manager', 'Join with invitation code'],
                  ['chief', 'Chief Manager', 'Create agency workspace'],
                ] as const).map(([role, label, description]) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRole(role as UserRole)}
                    className={`rounded-lg border p-2.5 text-left transition-colors ${
                      selectedRole === role
                        ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary'
                        : 'border-border bg-background/40 text-muted-foreground hover:border-primary/50'
                    }`}
                    data-testid={`button-role-${role}`}
                  >
                    <span className="block text-xs font-semibold">{label}</span>
                    <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">{description}</span>
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

          {isStaffPortal && selectedRole === 'chief' && (
            <FormField
              control={form.control}
              name="setupKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization setup code</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                      <Input
                        type="text"
                        placeholder="Enter 12345678"
                        autoComplete="one-time-code"
                        className="pl-10"
                        {...field}
                        data-testid="input-setup-key"
                      />
                    </div>
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    This code authorizes creation of a new company. Dev code: <code className="font-mono text-primary font-semibold">12345678</code>
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {selectedRole === 'client' && (
            <div className="space-y-3 rounded-xl border border-border/70 bg-background/35 p-3">
              <div>
                <p className="text-sm font-semibold">Exhibition request</p>
                <p className="text-xs text-muted-foreground">Your agency code routes this request to the correct Chief Manager.</p>
              </div>
              <FormField
                control={form.control}
                name="organizationSlug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agency code</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <Input
                          placeholder="Code from your Chief Manager"
                          autoComplete="organization"
                          className="pl-10"
                          {...field}
                          data-testid="input-organization-code"
                        />
                      </div>
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Use the registration link sent by your agency, or enter its code here.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                      data-testid="link-terms"
                    >
                      {t('auth.signup.termsOfService')}
                    </a>
                    {' '}{t('auth.signup.and')}{' '}
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                      data-testid="link-privacy"
                    >
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
            className="w-full rounded-full h-11 font-semibold shadow-[0_0_15px_rgba(37,99,235,0.2)]"
            disabled={isSubmitting}
            data-testid="button-signup"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Spinner className="text-primary-foreground" aria-hidden="true" />
                {t('auth.signup.submitting')}
              </span>
            ) : (
              isStaffPortal ? 'Create Chief Manager Account' : t('auth.signup.submit')
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
