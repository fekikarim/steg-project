'use client';

import {useState} from 'react';
import {useRouter, Link} from '@/i18n/navigation';
import {useAuth} from '@/lib/auth';
import {sanitizeReturnTo} from '@/lib/return-to';
import {Button} from '../ui/Button';
import {Input} from '../ui/Input';
import {Checkbox} from './Checkbox';
import {ErrorSummary} from './ErrorSummary';
import {AuthCard, AuthHeader} from './AuthCard';

interface LoginLabels {
  title: string;
  subtitle: string;
  email: string;
  password: string;
  submit: string;
  loading: string;
  noAccount: string;
  createLink: string;
  forgotLink: string;
  remember: string;
  rememberHint: string;
  returnToNotice: string;
  invalidCredentials: string;
  locked: string;
  rateLimited: string;
  generic: string;
  required: string;
  emailInvalid: string;
}

export function LoginForm({labels, locale, returnTo: rawReturnTo}: {labels: LoginLabels; locale: string; returnTo?: string}) {
  const {login} = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<{email?: string; password?: string}>({});
  const [formError, setFormError] = useState<{message: string} | null>(null);

  function validate(): boolean {
    const next: {email?: string; password?: string} = {};
    const trimmed = email.trim();
    if (!trimmed) next.email = labels.required;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) next.email = labels.emailInvalid;
    if (!password) next.password = labels.required;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const returnTo: string = sanitizeReturnTo(rawReturnTo ?? undefined, `/${locale}`);
  // The next-intl router prefixes the current locale itself, so hand it the
  // locale-less remainder. Callers pass next-intl pathnames, which are
  // locale-less already (/apply); the fallback and any prefixed value
  // (/fr/apply) are normalized the same way — strip one leading locale
  // segment when present, never touching real paths like /api/… .
  const returnToPath: string = (() => {
    const stripped = returnTo.replace(/^\/[a-z]{2}(?=\/|$)/, '');
    return stripped === '' ? '/' : stripped;
  })();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) return;
    setFormError(null);
    setSubmitting(true);
    const res = await login(email.trim(), password);
    setSubmitting(false);
    if (res.ok) {
      router.replace(returnToPath);
      return;
    }
    let message = labels.generic;
    const fieldErrors: {email?: string; password?: string} = {};
    if (res.reason === 'invalid-credentials') {
      message = labels.invalidCredentials;
      fieldErrors.email = labels.invalidCredentials;
    } else if (res.reason === 'locked') {
      message = labels.locked;
    } else if (res.reason === 'rate-limited') {
      message = labels.rateLimited;
    }
    if (res.fieldErrors) {
      for (const fe of res.fieldErrors) {
        if (fe.field === 'email' && !fieldErrors.email) fieldErrors.email = fe.message;
        if (fe.field === 'password' && !fieldErrors.password) fieldErrors.password = fe.message;
      }
    }
    setErrors(fieldErrors);
    setFormError({message});
  }

  return (
    <AuthCard>
      <AuthHeader title={labels.title} subtitle={labels.subtitle} />
      <form onSubmit={onSubmit} noValidate className="flex w-full flex-col gap-5">
        <ErrorSummary message={formError?.message} />
        {returnTo !== `/${locale}` && (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-navy-900 dark:text-zinc-300">
            {labels.returnToNotice}
          </p>
        )}
        <div className="flex flex-col gap-4">
          <Input
            label={labels.email}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          <Input
            label={labels.password}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Checkbox label={labels.remember} checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{labels.rememberHint}</p>
        </div>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={submitting}
          loadingLabel={labels.loading}
          disabled={submitting}
        >
          {labels.submit}
        </Button>
        <div className="flex flex-col items-center gap-1 text-sm">
          <Link href="/forgot-password" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
            {labels.forgotLink}
          </Link>
          <p className="text-zinc-600 dark:text-zinc-300">
            {labels.noAccount}{' '}
            <Link href="/register" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
              {labels.createLink}
            </Link>
          </p>
        </div>
      </form>
    </AuthCard>
  );
}
