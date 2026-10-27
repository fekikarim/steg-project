import {getTranslations} from 'next-intl/server';
import {setRequestLocale} from 'next-intl/server';
import type {AppLocale} from '@/i18n/routing';
import {ForgotPasswordForm} from '@/components/auth/ForgotPasswordForm';

export default async function ForgotPasswordPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations('auth');

  return (
    <ForgotPasswordForm
      labels={{
        title: t('forgot_title'),
        subtitle: t('forgot_subtitle'),
        unavailableTitle: t('forgot_unavailableTitle'),
        unavailableBody: t('forgot_unavailableBody'),
        backlink: t('forgot_backlink'),
        contactSupport: t('forgot_contactSupport'),
      }}
    />
  );
}
