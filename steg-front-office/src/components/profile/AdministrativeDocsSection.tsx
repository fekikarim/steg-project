'use client';

import {useLocale, useTranslations} from 'next-intl';
import {Card} from '@/components/ui/Card';
import {Button} from '@/components/ui/Button';
import {formatBytes} from '@/lib/files';
import type {ApplicationDocumentResponse} from '@/lib/api/application';
import {IconFileText, IconCheckSquare} from '@/components/ui/icons';

interface AdministrativeDocsSectionProps {
  documents: ApplicationDocumentResponse[];
}

export function AdministrativeDocsSection({
  documents,
}: AdministrativeDocsSectionProps) {
  const t = useTranslations('profile');
  const td = useTranslations('apply.documents');
  const locale = useLocale();
  const units = {b: td('unitB'), kb: td('unitKB'), mb: td('unitMB')};

  function formatDate(iso: string): string {
    try {
      return new Intl.DateTimeFormat(locale, {dateStyle: 'medium'}).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  return (
    <Card
      title={t('docsTitle')}
      subtitle={t('docsSubtitle')}
    >
      {documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 p-8 text-center dark:border-zinc-800">
          <IconFileText className="mx-auto h-8 w-8 text-zinc-400" />
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t('docsEmpty')}</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {documents.map((doc) => {
            const isVerified = doc.verificationStatus === 'VERIFIED';

            return (
              <div
                key={doc.id}
                className="flex flex-col items-start justify-between gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
                    <IconFileText className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-navy-900 dark:text-zinc-100">
                      {doc.document.originalFileName || doc.document.type}
                    </span>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>{formatBytes(doc.document.sizeBytes, units)}</span>
                      <span>•</span>
                      <span>{formatDate(doc.createdAt)}</span>
                      <span>•</span>
                      {isVerified ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <IconCheckSquare className="h-3 w-3" />
                          {t('docsVerified')}
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">
                          {t('docsPending')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <a
                    href={`/api/documents/${doc.document.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="secondary" size="sm">
                      {t('docsDownload')}
                    </Button>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
