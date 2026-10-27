'use client';

import {useTranslations} from 'next-intl';
import type {University} from '@/lib/api/candidate';
import {Card} from '@/components/ui/Card';
import {Input} from '@/components/ui/Input';
import {Select} from '@/components/ui/Select';
import {Spinner} from '@/components/feedback/Spinner';
import {ErrorState} from '@/components/feedback/ErrorState';
import type {FieldErrors, SectionProps} from './section-types';

interface AcademicSectionProps extends SectionProps {
  universities: University[];
  universitiesState: 'loading' | 'ready' | 'error';
  errors: FieldErrors;
  onRetryUniversities: () => void;
}

/**
 * Academic information card (B3 task 3): university (from the public STEG
 * reference list), speciality and diploma/education level. `diploma` is the
 * backend-supported field for the education level/degree (CandidateRequest).
 */
export function AcademicSection({
  draft,
  errors,
  update,
  universities,
  universitiesState,
  onRetryUniversities,
  disabled,
}: AcademicSectionProps) {
  const t = useTranslations('profile');

  if (universitiesState === 'error') {
    return (
      <Card title={t('academicTitle')} subtitle={t('academicSubtitle')}>
        <ErrorState hint={t('universityLoadError')} onRetry={onRetryUniversities} />
      </Card>
    );
  }

  return (
    <Card title={t('academicTitle')} subtitle={t('academicSubtitle')}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Select
            label={t('fieldUniversity')}
            required
            value={draft.universityId}
            onChange={(e) => update({universityId: e.target.value})}
            disabled={disabled || universitiesState === 'loading'}
            placeholder={t('universityPlaceholder')}
            options={universities.map((u) => ({value: u.id, label: u.name}))}
            error={errors.universityId}
          />
        </div>
        <Input
          label={t('fieldSpeciality')}
          value={draft.speciality}
          onChange={(e) => update({speciality: e.target.value})}
          error={errors.speciality}
          disabled={disabled}
        />
        <Input
          label={t('fieldDiploma')}
          value={draft.diploma}
          onChange={(e) => update({diploma: e.target.value})}
          error={errors.diploma}
          disabled={disabled}
        />
      </div>
      {universitiesState === 'loading' && (
        <Spinner className="text-sm text-zinc-500 dark:text-zinc-400" />
      )}
    </Card>
  );
}