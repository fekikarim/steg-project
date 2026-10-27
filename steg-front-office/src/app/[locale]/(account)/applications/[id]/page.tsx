import {setRequestLocale} from 'next-intl/server';
import type {AppLocale} from '@/i18n/routing';
import {ApplicationDetail} from '@/components/applications/ApplicationDetail';

/**
 * Candidate dossier detail at `/[locale]/applications/[id]`. The reference
 * is known only after the authenticated fetch, so the server renders the
 * shell and the client renders the dossier (header, timeline, documents,
 * withdraw) against our server-side proxies.
 */
export default async function ApplicationDetailPage({params}: {params: Promise<{locale: string; id: string}>}) {
  const {locale, id} = await params;
  setRequestLocale(locale as AppLocale);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <ApplicationDetail id={id} />
    </div>
  );
}
