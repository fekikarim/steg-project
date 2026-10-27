'use client';

import {useTranslations} from 'next-intl';
import {Card} from '@/components/ui/Card';
import {Input} from '@/components/ui/Input';
import {DatePicker} from '@/components/ui/DatePicker';
import {CinField} from './CinField';
import type {FieldErrors, SectionProps} from './section-types';

interface PersonalSectionProps extends SectionProps {
  cinBase: string;
  errors: FieldErrors;
}

/**
 * Personal information card (B3 task 2): name, contact details, birth date —
 * and the national ID with masking/reveal/edit (B3 tasks 5–6).
 */
export function PersonalSection({draft, errors, update, cinBase, disabled}: PersonalSectionProps) {
  const t = useTranslations('profile');

  return (
    <Card title={t('personalTitle')} subtitle={t('personalSubtitle')}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label={t('fieldFirstName')}
          required
          value={draft.firstName}
          onChange={(e) => update({firstName: e.target.value})}
          error={errors.firstName}
          disabled={disabled}
          autoComplete="given-name"
        />
        <Input
          label={t('fieldLastName')}
          required
          value={draft.lastName}
          onChange={(e) => update({lastName: e.target.value})}
          error={errors.lastName}
          disabled={disabled}
          autoComplete="family-name"
        />
        <Input
          label={t('fieldEmail')}
          required
          type="email"
          value={draft.email}
          onChange={(e) => update({email: e.target.value})}
          error={errors.email}
          disabled={disabled}
          autoComplete="email"
        />
        <Input
          label={t('fieldPhone')}
          type="tel"
          value={draft.phone}
          onChange={(e) => update({phone: e.target.value})}
          error={errors.phone}
          disabled={disabled}
          autoComplete="tel"
        />
        <DatePicker
          label={t('fieldBirthDate')}
          value={draft.birthDate}
          onChange={(e) => update({birthDate: e.target.value})}
          error={errors.birthDate}
          disabled={disabled}
        />
        <Input
          label={t('fieldAddress')}
          value={draft.address}
          onChange={(e) => update({address: e.target.value})}
          error={errors.address}
          disabled={disabled}
          autoComplete="street-address"
        />
        <div className="sm:col-span-2">
          <CinField value={draft.nationalId} baseValue={cinBase} onChange={(v) => update({nationalId: v})} error={errors.nationalId} disabled={disabled} />
        </div>
      </div>
    </Card>
  );
}