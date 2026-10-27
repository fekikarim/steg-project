'use client';

import {useTranslations} from 'next-intl';
import {Card} from '@/components/ui/Card';
import {Input} from '@/components/ui/Input';
import {Button} from '@/components/ui/Button';
import {FieldError} from '@/components/ui/FieldError';
import {StepShell} from './StepShell';
import type {EducationDraft} from '@/lib/apply-wizard';
import type {University} from '@/lib/api/candidate';

interface EducationStepProps {
  data: EducationDraft;
  universities: University[];
  onChange: (patch: Partial<EducationDraft>) => void;
  errorKey: string | null;
  onContinue: () => void;
}

/**
 * Step 2 — Education & University.
 * Collects degree level, field of study / major, and university institution.
 */
export function EducationStep({
  data,
  universities,
  onChange,
  errorKey,
  onContinue,
}: EducationStepProps) {
  const t = useTranslations('apply.education');
  const tn = useTranslations('apply.nav');

  const levels = [
    {value: 'LICENCE', label: t('levelLicence')},
    {value: 'MASTER', label: t('levelMaster')},
    {value: 'INGENIEUR', label: t('levelEngineer')},
    {value: 'DOCTORAT', label: t('levelDoctorate')},
    {value: 'AUTRE', label: t('levelOther')},
  ];

  return (
    <StepShell eyebrow={t('eyebrow')} title={t('title')} intro={t('intro')}>
      <Card>
        <div className="flex flex-col gap-4">
          {/* Degree Level */}
          <div className="flex flex-col gap-1">
            <label htmlFor="education-level" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {t('level')} <span className="text-accent-600">*</span>
            </label>
            <select
              id="education-level"
              value={data.educationLevel}
              onChange={(e) => onChange({educationLevel: e.target.value})}
              className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-navy-900 dark:text-zinc-100"
              required
            >
              {levels.map((lvl) => (
                <option key={lvl.value} value={lvl.value}>
                  {lvl.label}
                </option>
              ))}
            </select>
          </div>

          {/* Major / Speciality */}
          <Input
            id="speciality"
            label={t('speciality')}
            type="text"
            value={data.speciality}
            onChange={(e) => onChange({speciality: e.target.value})}
            placeholder={t('specialityPlaceholder')}
            required
            minLength={2}
            maxLength={100}
            autoComplete="off"
          />

          {/* University Input */}
          <Input
            id="university"
            label={t('university')}
            type="text"
            value={data.universityId}
            onChange={(e) => onChange({universityId: e.target.value})}
            placeholder={t('university')}
            required
            autoComplete="off"
          />
        </div>

        {errorKey && <FieldError message={errorKey} />}

        <div className="mt-4 flex justify-end">
          <Button size="md" onClick={onContinue}>
            {tn('continue')}
          </Button>
        </div>
      </Card>
    </StepShell>
  );
}
