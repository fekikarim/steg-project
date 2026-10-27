'use client';

import {useTranslations} from 'next-intl';
import {useTheme, type ThemeMode} from '@/lib/theme';
import {Select} from '@/components/ui/Select';

/** Theme selector: light / dark / system, persisted (UI_UX §3). */
export function ThemeToggle() {
  const t = useTranslations('header');
  const {mode, setMode} = useTheme();
  return (
    <Select
      hideLabel
      label={t('theme')}
      aria-label={t('theme')}
      value={mode}
      onChange={(e) => setMode(e.target.value as ThemeMode)}
      options={[
        {value: 'light', label: t('themeLight')},
        {value: 'dark', label: t('themeDark')},
        {value: 'system', label: t('themeSystem')},
      ]}
      wrapperClassName="w-auto"
      className="!h-9 cursor-pointer pe-8 text-[13px]"
    />
  );
}
