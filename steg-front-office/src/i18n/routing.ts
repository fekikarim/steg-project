import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  // French is the primary language of the platform.
  locales: ['fr', 'en', 'ar'],
  defaultLocale: 'fr',
  // Always prefix ("/fr", "/en", "/ar") so every URL carries its locale and
  // Arabic RTL can be verified per route. "/" redirects to "/fr".
  localePrefix: {mode: 'always'},
});

export type AppLocale = (typeof routing.locales)[number];

export const RTL_LOCALES: ReadonlySet<string> = new Set(['ar']);

export function directionOf(locale: string): 'rtl' | 'ltr' {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}
