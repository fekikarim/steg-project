'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {trackApplication, type TrackedApplication} from '@/lib/api/anonymous-client';
import {Button} from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';
import {Card} from '@/components/ui/Card';
import {FieldError} from '@/components/ui/FieldError';
import {StatusPill} from '@/components/ui/Badge';

/**
 * Public application tracking (E3.1): reference display + tracking-token lookup.
 * No account required; the backend scopes everything to the token holder.
 * Covers loading / error / empty / success states (E3.4).
 */
export function TrackForm({initialToken}: {initialToken?: string}) {
  const t = useTranslations('track');
  const [token, setToken] = useState(initialToken ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackedApplication | null>(null);

  async function onTrack(e: React.FormEvent) {
    e.preventDefault();
    const value = token.trim();
    if (!value) {
      setError(t('tokenRequired'));
      return;
    }
    setError(null);
    setResult(null);
    setPending(true);
    try {
      setResult(await trackApplication(value));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <form onSubmit={(e) => void onTrack(e)} className="flex flex-col gap-4">
          <Input
            id="track-token"
            label={t('tokenLabel')}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t('tokenPlaceholder')}
            dir="ltr"
            required
            disabled={pending}
            autoComplete="off"
          />
          {error && <FieldError message={error} />}
          <div>
            <Button type="submit" variant="primary" size="lg" loading={pending} loadingLabel={t('tracking')}>
              {t('trackButton')}
            </Button>
          </div>
        </form>
      </Card>

      {result && (
        <Card>
          <div className="flex flex-col gap-4" role="status" aria-live="polite">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-lg font-extrabold tracking-wider" dir="ltr">
                {result.reference}
              </span>
              <StatusPill code={result.status} />
            </div>
            {(result.calculatedType || result.requirement) && (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                {[result.calculatedType, result.requirement].filter(Boolean).join(' · ')}
              </p>
            )}
            {result.statusExplanation && (
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">{result.statusExplanation}</p>
            )}
            {result.nextStep && (
              <p className="text-sm text-brand-700 dark:text-brand-300">{result.nextStep}</p>
            )}
            {result.timeline && result.timeline.length > 0 && (
              <ol className="flex flex-col gap-2 border-t border-zinc-100 pt-4 dark:border-white/10">
                {result.timeline.map((entry, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-300">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
                    <span>{entry}</span>
                  </li>
                ))}
              </ol>
            )}
            {result.documentsSummary && result.documentsSummary.length > 0 && (
              <ul className="flex flex-col gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                {result.documentsSummary.map((doc, i) => (
                  <li key={i}>• {doc}</li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
