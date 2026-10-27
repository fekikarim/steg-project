'use client';

import {useMemo, useState} from 'react';
import {useRouter, Link} from '@/i18n/navigation';
import {useAuth} from '@/lib/auth';
import {estimateStrength} from '@/lib/password';
import {Button} from '../ui/Button';import {Input} from '../ui/Input';
import {PasswordInput} from './PasswordInput';
import {Checkbox} from './Checkbox';
import {ErrorSummary} from './ErrorSummary';
import {AuthCard, AuthHeader} from './AuthCard';

interface RegisterLabels {
  title: string;
  subtitle: string;
  accountSectionTitle: string;
  personalSectionTitle: string;
  firstName: string;
  lastName: string;
  phone: string;
  optionalMarker: string;
  email: string;
  password: string;
  confirmPassword: string;
  passwordHint: string;
  strength: string;
  showPassword: string;
  hidePassword: string;
  strengthWeak: string;
  strengthFair: string;
  strengthGood: string;
  strengthStrong: string;
  acceptTerms: string;
  submit: string;
  loading: string;
  haveAccount: string;
  loginLink: string;
  required: string;
  emailInvalid: string;
  minLength: string;
  passwordMismatch: string;
  acceptTermsRequired: string;
  duplicateEmail: string;
  generic: string;
  locked: string;
  rateLimited: string;
  formErrorSummary: string;
}

export function RegisterForm({labels}: {labels: RegisterLabels}) {
  const {register} = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [values, setValues] = useState({email: '', password: '', confirm: '', firstName: '', lastName: '', phone: ''});
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<{message: string} | null>(null);

  const strength = useMemo(() => estimateStrength(values.password), [values.password]);

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({...v, [key]: e.target.value}));
  };

  function validate(): boolean {
    const next: Record<string, string | undefined> = {};
    const email = values.email.trim();
    if (!values.firstName.trim()) next.firstName = labels.required;
    if (!values.lastName.trim()) next.lastName = labels.required;
    if (!email) next.email = labels.required;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = labels.emailInvalid;
    if (!values.password) next.password = labels.required;
    else if (values.password.length < 8) next.password = labels.minLength;
    if (!values.confirm) next.confirm = labels.required;
    else if (values.confirm !== values.password) next.confirm = labels.passwordMismatch;
    if (!accept) next.accept = labels.acceptTermsRequired;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) {
      setFormError({message: labels.formErrorSummary});
      return;
    }
    setFormError(null);
    setSubmitting(true);
    const res = await register({
      email: values.email.trim(),
      password: values.password,
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phone: values.phone.trim() || undefined,
    });
    setSubmitting(false);
    if (res.ok) {
      router.replace('/');
      return;
    }
    const fieldErrors: Record<string, string | undefined> = {};
    let message = labels.generic;
    if (res.reason === 'duplicate-email') {
      message = labels.duplicateEmail;
      fieldErrors.email = labels.duplicateEmail;
    } else if (res.reason === 'locked') {
      message = labels.locked;
    } else if (res.reason === 'rate-limited') {
      message = labels.rateLimited;
    }
    if (res.fieldErrors) {
      for (const fe of res.fieldErrors) {
        if (fe.field && !fieldErrors[fe.field]) fieldErrors[fe.field] = fe.message;
      }
    }
    setErrors((prev) => ({...prev, ...fieldErrors}));
    setFormError({message});
  }

  return (
    <AuthCard>
      <AuthHeader title={labels.title} subtitle={labels.subtitle} />
      <form onSubmit={onSubmit} noValidate className="flex w-full flex-col gap-6">
        <ErrorSummary message={formError?.message} />
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {labels.personalSectionTitle}
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={labels.firstName}
              name="firstName"
              autoComplete="given-name"
              required
              value={values.firstName}
              onChange={set('firstName')}
              error={errors.firstName}
            />
            <Input
              label={labels.lastName}
              name="lastName"
              autoComplete="family-name"
              required
              value={values.lastName}
              onChange={set('lastName')}
              error={errors.lastName}
            />
          </div>
          <Input
            label={labels.phone}
            name="phone"
            type="tel"
            autoComplete="tel"
            hint={labels.optionalMarker}
            className="mt-4"
            value={values.phone}
            onChange={set('phone')}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {labels.accountSectionTitle}
          </legend>
          <Input
            label={labels.email}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={values.email}
            onChange={set('email')}
            error={errors.email}
          />
          <PasswordInput
            label={labels.password}
            name="password"
            autoComplete="new-password"
            required
            showToggle
            strength={strength}
            strengthLabel={labels.strength}
            hint={labels.passwordHint}
            showLabel={labels.showPassword}
            hideLabel={labels.hidePassword}
            className="mt-4"
            value={values.password}
            onChange={set('password')}
            error={errors.password}
          />
          <PasswordInput
            label={labels.confirmPassword}
            name="confirmPassword"
            autoComplete="new-password"
            required
            showToggle
            showLabel={labels.showPassword}
            hideLabel={labels.hidePassword}
            className="mt-4"
            value={values.confirm}
            onChange={set('confirm')}
            error={errors.confirm}
          />
        </fieldset>

        <div className="flex flex-col gap-2">
          <Checkbox label={labels.acceptTerms} checked={accept} onChange={(e) => setAccept(e.target.checked)} error={errors.accept} />
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

        <p className="text-center text-sm text-zinc-600 dark:text-zinc-300">
          {labels.haveAccount}{' '}
          <Link href="/login" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
            {labels.loginLink}
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
