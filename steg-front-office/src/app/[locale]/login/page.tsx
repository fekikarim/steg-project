import {getTranslations} from 'next-intl/server';
import {setRequestLocale} from 'next-intl/server';
import type {AppLocale} from '@/i18n/routing';
import {LoginForm} from '@/components/auth/LoginForm';

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{returnTo?: string}>;
}) {
  const {locale} = await params;
  const {returnTo} = await searchParams;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations('auth');
  const v = await getTranslations('validation');

  return (
    <LoginForm
      locale={locale}
      returnTo={returnTo}
      labels={{
        title: t('login_title'),
        subtitle: t('login_subtitle'),
        email: t('login_email'),
        password: t('login_password'),
        submit: t('login_submit'),
        loading: t('login_loading'),
        noAccount: t('login_noAccount'),
        createLink: t('login_createLink'),
        forgotLink: t('login_forgotLink'),
        remember: t('login_remember'),
        rememberHint: t('login_rememberHint'),
        returnToNotice: t('returnToNotice'),
        invalidCredentials: t('server_invalidCredentials'),
        locked: t('server_accountLocked'),
        rateLimited: t('server_rateLimited'),
        generic: t('server_generic'),
        required: v('required'),
        emailInvalid: v('email'),
      }}
    />
  );
}
