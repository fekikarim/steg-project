'use client';

import {useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {Card} from '@/components/ui/Card';
import {Button} from '@/components/ui/Button';
import {CardSkeleton} from '@/components/feedback/Skeleton';
import {ErrorState} from '@/components/feedback/ErrorState';
import {formatBytes} from '@/lib/files';
import {IconFileText, IconCheckSquare, IconDownload} from '@/components/ui/icons';
import type {ApplicationDocumentResponse} from '@/lib/api/application';
import {listApplications, getApplicationDocuments} from '@/lib/api/application-client';

interface EnrichedDoc {
  doc: ApplicationDocumentResponse;
  appRef: string;
  appId: string;
}

export function AvailableDocumentsWorkspace() {
  const t = useTranslations('profile');
  const td = useTranslations('apply.documents');
  const ts = useTranslations('states');
  const locale = useLocale();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<EnrichedDoc[]>([]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [retryKey, setRetryKey] = useState(0);

  const units = {b: td('unitB'), kb: td('unitKB'), mb: td('unitMB')};

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) { setLoading(true); setError(null); }
      try {
        const applicationList = await listApplications();
        if (cancelled) return;
        const allDocs: EnrichedDoc[] = [];
        await Promise.all(
          applicationList.map(async (app) => {
            try {
              const appDocs = await getApplicationDocuments(app.id);
              for (const d of appDocs) {
                allDocs.push({ doc: d, appRef: app.reference, appId: app.id });
              }
            } catch { /* Ignore isolated per-dossier errors */ }
          })
        );
        if (cancelled) return;
        allDocs.sort((a, b) => new Date(b.doc.createdAt).getTime() - new Date(a.doc.createdAt).getTime());
        setDocs(allDocs);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error loading documents');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [retryKey]);

  function formatDate(iso: string): string {
    try { return new Intl.DateTimeFormat(locale, {dateStyle: 'medium'}).format(new Date(iso)); }
    catch { return iso; }
  }

  const filteredDocs = docs.filter((item) => filterType === 'ALL' || item.doc.document.type === filterType);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-96 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800/60" />
        </div>
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (error) {
    return <ErrorState title={ts('errorTitle')} hint={error || ts('errorHint')} onRetry={() => setRetryKey((k) => k + 1)} />;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 border-b border-zinc-200 pb-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 dark:text-zinc-50">{t('docsTitle')}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('docsSubtitle')}</p>
        </div>
        {docs.length > 0 && (
          <div className="flex items-center gap-2">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 focus:outline-none dark:border-zinc-800 dark:bg-navy-900 dark:text-zinc-300">
              <option value="ALL">{t('docsFilterAll')}</option>
              <option value="INTERNSHIP_APPLICATION">{t('docsFilterApplication')}</option>
              <option value="ASSIGNMENT_LETTER">{t('docsFilterAssignment')}</option>
              <option value="INTERNSHIP_AGREEMENT">{t('docsFilterConvention')}</option>
              <option value="OTHER">{t('docsFilterOther')}</option>
            </select>
          </div>
        )}
      </div>

      {docs.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
              <IconFileText className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-navy-900 dark:text-zinc-100">{t('docsEmpty')}</h2>
            <p className="mt-1 max-w-md text-sm text-zinc-600 dark:text-zinc-400">{t('docsNoAppBody')}</p>
            <div className="mt-6">
              <Link href="/apply"><Button variant="primary" size="md">{t('docsNoAppCta')}</Button></Link>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {filteredDocs.map(({doc, appRef, appId}) => {
              const isVerified = doc.verificationStatus === 'VERIFIED';
              return (
                <div key={doc.id} className="flex flex-col items-start justify-between gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-3.5">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
                      <IconFileText className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-navy-900 dark:text-zinc-100">{doc.document.originalFileName || doc.document.type}</span>
                        <Link href={`/applications/${appId}`} className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-zinc-600 hover:text-brand-600 dark:bg-zinc-800 dark:text-zinc-300">{appRef}</Link>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>{formatBytes(doc.document.sizeBytes, units)}</span>
                        <span>•</span>
                        <span>{formatDate(doc.createdAt)}</span>
                        <span>•</span>
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400"><IconCheckSquare className="h-3 w-3" />{t('docsVerified')}</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">{t('docsPending')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <a href={`/api/documents/${doc.document.id}/download`} target="_blank" rel="noopener noreferrer">
                      <Button variant="secondary" size="sm" className="flex items-center gap-1.5">
                        <IconDownload className="h-3.5 w-3.5" />
                        <span>{t('docsDownload')}</span>
                      </Button>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card title={t('docsCertTitle')} subtitle={t('docsCertBody')}>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('docsCertBody')}</p>
      </Card>
    </div>
  );
}
