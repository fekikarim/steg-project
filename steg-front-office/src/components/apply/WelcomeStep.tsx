'use client';

import {useTranslations} from 'next-intl';
import {Card} from '@/components/ui/Card';
import {Button} from '@/components/ui/Button';
import {StepShell} from './StepShell';
import {FieldError} from '@/components/ui/FieldError';
import {cx} from '@/lib/cx';

interface WelcomeStepProps {
  confirmed: boolean;
  onChange: (value: boolean) => void;
  errorKey: string | null;
  onContinue: () => void;
}

/**
 * Step 1 — Welcome & eligibility. The candidate confirms they meet the
 * eligibility criteria before the wizard proceeds.
 */
export function WelcomeStep({confirmed, onChange, errorKey, onContinue}: WelcomeStepProps) {
  const t = useTranslations('apply.welcome');
  const tn = useTranslations('apply.nav');

  return (
    <StepShell eyebrow={t('eyebrow')} title={t('title')} intro={t('intro')}>
      <Card title={t('criteriaTitle')}>
        <ul className="list-disc space-y-2 ps-5 text-sm text-zinc-700 dark:text-zinc-200">
          <li>{t('criterion1')}</li>
          <li>{t('criterion2')}</li>
          <li>{t('criterion3')}</li>
          <li>{t('criterion4')}</li>
        </ul>
      </Card>

      <Card title={t('howTitle')}>
        <ol className="list-decimal space-y-2 ps-5 text-sm text-zinc-700 dark:text-zinc-200">
          <li>{t('how1')}</li>
          <li>{t('how2')}</li>
          <li>{t('how3')}</li>
          <li>{t('how4')}</li>
          <li>{t('how5')}</li>
          <li>{t('how6')}</li>
        </ol>
      </Card>

      <div className="flex flex-col gap-2">
        <label className="flex items-start gap-3 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => onChange(e.target.checked)}
            aria-invalid={errorKey ? true : undefined}
            className={cx(
              'mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-zinc-300 accent-brand-600 dark:accent-brand-500',
              errorKey && 'border-accent-600',
            )}
          />
          <span>{t('confirmLabel')}</span>
        </label>
        <FieldError message={errorKey ?? undefined} />
      </div>

      <div className="flex justify-end">
        <Button variant="primary" size="md" onClick={onContinue} disabled={!confirmed}>
          {tn('continue')}
        </Button>
      </div>
    </StepShell>
  );
}
