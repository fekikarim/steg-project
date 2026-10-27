import {setRequestLocale} from 'next-intl/server';
import type {AppLocale} from '@/i18n/routing';
import {AvailableDocumentsWorkspace} from '@/components/documents/AvailableDocumentsWorkspace';

export default async function DocumentsPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale as AppLocale);

  return <AvailableDocumentsWorkspace />;
}
