import {getTranslations} from 'next-intl/server';
import {setRequestLocale} from 'next-intl/server';
import type {AppLocale} from '@/i18n/routing';
import {ResetPasswordForm} from '@/components/auth/ResetPasswordForm';

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{token?: string}>;
}) {
  const {locale} = await params;
  const {token} = await searchParams;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations('auth');

  return (
    <ResetPasswordForm
      token={token}
      labels={{
        title: t('reset_title'),
        subtitle: t('reset_subtitle'),
        newPassword: t('reset_newPassword'),
        confirmPassword: t('reset_confirmPassword'),
        submit: t('reset_submit'),
        loading: t('reset_loading'),
        passwordSaved: t('reset_passwordSaved'),
      }}
    />
  );
}
