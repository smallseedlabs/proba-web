import { useId, useRef, useState, type FormEvent } from 'react';
import { CircleAlert, Eye, EyeOff, ShieldCheck, Activity, CircleCheck } from 'lucide-react';
import { AuthError, AUTH_ERROR_MESSAGES, type AuthClient, type Session } from '../../lib/auth';
import { Logo, LogoMark } from '../brand/Logo';
import { Button } from '../ui/button';
import { Callout } from '../ui/feedback';
import { FieldError, Input, Label } from '../ui/field';
import { validateSignIn } from '../../lib/auth/validation';

const highlights = [
  { icon: CircleCheck, title: 'You approve every plan and every change to spend', body: 'Proba proposes. Nothing launches or changes budget without a decision from your team.' },
  { icon: ShieldCheck, title: 'Guardrails on every action', body: 'Spend caps, limits and a full audit trail are enforced in code, not left to the AI.' },
  { icon: Activity, title: 'Live performance across campaigns', body: 'See spend, conversions and test results the moment they change.' },
];

export function SignInPage({
  auth,
  onSignedIn,
  notice,
}: {
  auth: AuthClient;
  onSignedIn: (session: Session) => void;
  notice?: string | null;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const ids = { email: useId(), password: useId(), emailError: useId(), passwordError: useId() };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    const nextErrors = validateSignIn(email, password);
    setErrors(nextErrors);
    if (nextErrors.email) return emailRef.current?.focus();
    if (nextErrors.password) return passwordRef.current?.focus();

    setSubmitting(true);
    try {
      const session = await auth.signIn({ email: email.trim(), password });
      onSignedIn(session);
    } catch (error) {
      setFormError(error instanceof AuthError ? error.message : AUTH_ERROR_MESSAGES.unknown);
      setSubmitting(false);
      passwordRef.current?.select();
    }
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden bg-sidebar px-12 py-10 text-sidebar-foreground lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(1200px 600px at -10% -10%, hsl(233 64% 45% / 0.55), transparent 60%), radial-gradient(800px 500px at 120% 110%, hsl(172 66% 32% / 0.35), transparent 60%)',
          }}
          aria-hidden="true"
        />
        <div className="relative">
          <Logo inverted />
        </div>
        <div className="relative max-w-md">
          <p className="text-display text-white">Launch and test products with an AI team that answers to you.</p>
          <ul className="mt-10 space-y-6">
            {highlights.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon className="h-5 w-5 text-[#5EEAD4]" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-body font-semibold text-white">{title}</p>
                  <p className="mt-1 text-body text-sidebar-muted">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-caption text-sidebar-muted">© {new Date().getFullYear()} Small Seed Labs. All rights reserved.</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          <div className="mb-8">
            <LogoMark className="mb-6 hidden h-10 w-10 lg:block" />
            <h1 className="text-heading text-foreground">Sign in to Proba</h1>
            <p className="mt-2 text-body text-muted-foreground">Use your work email to access your workspace.</p>
          </div>

          {notice && !formError && (
            <Callout tone="info" role="status" className="mb-6">
              {notice}
            </Callout>
          )}
          {formError && (
            <div role="alert" className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive-subtle px-4 py-3">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              <p className="text-body text-foreground">{formError}</p>
            </div>
          )}

          <form onSubmit={submit} noValidate aria-label="Sign in" className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor={ids.email}>Work email</Label>
              <Input
                ref={emailRef}
                id={ids.email}
                type="email"
                name="email"
                autoComplete="username"
                inputMode="email"
                autoFocus
                placeholder="name@company.com"
                value={email}
                disabled={submitting}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? ids.emailError : undefined}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((x) => ({ ...x, email: undefined }));
                }}
              />
              <FieldError id={ids.emailError}>{errors.email}</FieldError>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={ids.password}>Password</Label>
              <div className="relative">
                <Input
                  ref={passwordRef}
                  id={ids.password}
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  disabled={submitting}
                  className="pr-11"
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? ids.passwordError : undefined}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((x) => ({ ...x, password: undefined }));
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  aria-controls={ids.password}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              <FieldError id={ids.passwordError}>{errors.password}</FieldError>
            </div>

            <Button type="submit" size="lg" className="w-full" loading={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-8 text-center text-body text-muted-foreground">
            Need access or forgotten your password? Contact your workspace administrator.
          </p>
        </div>
      </main>
    </div>
  );
}
