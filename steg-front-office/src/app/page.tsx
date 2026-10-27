import {redirect} from 'next/navigation';
import {routing} from '@/i18n/routing';

/**
 * Locale-less root is handled by middleware (redirect to default locale "/fr").
 * This static fallback keeps the route tree correct when middleware is bypassed
 * (e.g. during static pre-rendering) so the Next.js template is never exposed.
 */
export default function RootPage() {
  redirect(`/${routing.defaultLocale}`);
}