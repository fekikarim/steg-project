'use client';

import {useTranslations} from 'next-intl';
import {Card} from '@/components/ui/Card';
import {ChipsInput} from './ChipsInput';
import type {SectionProps} from './section-types';

/**
 * Skills & languages card (B3 task 4): structured chip editing over the
 * backend's comma-separated string fields. CV-style, keyboard operable.
 */
export function SkillsSection(props: SectionProps) {
  const t = useTranslations('profile');
  const {draft, update, disabled} = props;

  return (
    <Card title={t('skillsTitle')} subtitle={t('skillsSubtitle')}>
      <ChipsInput
        label={t('skillsLabel')}
        placeholder={t('skillsPlaceholder')}
        hint={t('skillsHelper')}
        value={draft.skills}
        onChange={(skills) => update({skills})}
        disabled={disabled}
      />
      <ChipsInput
        label={t('languagesLabel')}
        placeholder={t('languagesPlaceholder')}
        value={draft.languages}
        onChange={(languages) => update({languages})}
        disabled={disabled}
      />
    </Card>
  );
}