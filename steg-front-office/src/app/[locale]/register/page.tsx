import {getTranslations} from 'next-intl/server';
import {setRequestLocale} from 'next-intl/server';
import type {AppLocale} from '@/i18n/routing';
import {RegisterForm} from '@/components/auth/RegisterForm';

export default async function RegisterPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations('auth');
  const v = await getTranslations('validation');
  const c = await getTranslations('common');

  return (
    <RegisterForm
      labels={{
        title: t('register_title'),
        subtitle: t('register_subtitle'),
        accountSectionTitle: t('accountSectionTitle'),
        personalSectionTitle: t('personalSectionTitle'),
        firstName: t('firstName'),
        lastName: t('lastName'),
        phone: t('phone'),
        optionalMarker: c('optional'),
        email: t('email'),
        password: t('password'),
        confirmPassword: t('confirmPassword'),
        passwordHint: t('passwordHint', {min: 8}),
        strength: t('strength'),
        showPassword: t('showPassword'),
        hidePassword: t('hidePassword'),
        strengthWeak: t('strengthWeak'),
        strengthFair: t('strengthFair'),
        strengthGood: t('strengthGood'),
        strengthStrong: t('strengthStrong'),
        acceptTerms: t('acceptTerms'),
        submit: t('register_submit'),
        loading: t('register_loading'),
        haveAccount: t('register_haveAccount'),
        loginLink: t('register_loginLink'),
        required: v('required'),
        emailInvalid: v('email'),
        minLength: v('minLength', {min: 8}),
        passwordMismatch: v('passwordMismatch'),
        acceptTermsRequired: t('server_generic'),
        duplicateEmail: t('server_duplicateEmail'),
        generic: t('server_generic'),
        locked: t('server_accountLocked'),
        rateLimited: t('server_rateLimited'),
        formErrorSummary: t('formErrorSummary'),
      }}
    />
  );
}
