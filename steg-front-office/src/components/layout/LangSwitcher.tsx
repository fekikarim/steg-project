'use client';

import {useTransition} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useParams} from 'next/navigation';
import {routing, type AppLocale} from '@/i18n/routing';
import {useRouter, usePathname} from '@/i18n/navigation';
import {Select} from '@/components/ui/Select';
import {useAuth} from '@/lib/auth';
import {setPreferredLocale} from '@/lib/api/profile-client';

const LOCALE_LABELS: Record<AppLocale, string> = {
  fr: 'Français',
  en: 'English',
  ar: 'العربية',
};

/**
 * Language selector persisted via the locale-prefixed URL (UI_UX §8).
 *
 * Locale navigation remounts everything under `[locale]` — including an
 * in-progress apply wizard. The switch stays seamless because wizard
 * step/draft/file-meta are restored from sessionStorage, scroll position is
 * preserved (`scroll: false`), and the transition runs non-blocking with a
 * pending state. Authenticated accounts also persist the choice backend-side
 * (`PUT /api/users/me/locale` drives email language + future sessions).
 */
export function LangSwitcher() {
  const t = useTranslations('header');
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const {status} = useAuth();
  const [switching, startSwitch] = useTransition();

  return (
    <Select
      hideLabel
      label={t('language')}
      aria-label={t('language')}
      aria-busy={switching || undefined}
      value={locale}
      disabled={switching}
      onChange={(e) => {
        const next = e.target.value as AppLocale;
        if (next === locale || switching) return;
        startSwitch(() => {
          // @ts-expect-error next-intl types pathname params loosely here
          router.replace({pathname, params}, {locale: next, scroll: false});
        });
        if (status === 'authenticated') {
          void setPreferredLocale(next).catch(() => {
            /* best-effort: URL prefix stays the source of truth */
          });
        }
      }}
      options={routing.locales.map((l) => ({value: l, label: LOCALE_LABELS[l]}))}
      wrapperClassName="w-auto"
      className="!h-9 cursor-pointer pe-8 text-[13px]"
    />
  );
}
