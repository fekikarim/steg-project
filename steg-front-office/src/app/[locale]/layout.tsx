import {IBM_Plex_Mono, IBM_Plex_Sans_Arabic} from 'next/font/google';
import {NextIntlClientProvider, hasLocale} from 'next-intl';
import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import Script from 'next/script';
import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import {routing, directionOf, type AppLocale} from '@/i18n/routing';
import {ThemeProvider, THEME_INIT_SCRIPT} from '@/lib/theme';
import {AuthProvider} from '@/lib/auth';
import {ToastProvider} from '@/components/ui/Toast';
import {Header} from '@/components/layout/Header';
import {Footer} from '@/components/layout/Footer';
import '../globals.css';

// Latin + French accents + Arabic in one family (UI_UX §4).
const sans = IBM_Plex_Sans_Arabic({
  subsets: ['latin', 'arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

/** Localized document metadata (title/description follow the active locale). */
export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({locale, namespace: 'app'});
  return {title: {default: t('name'), template: '%s · STEG'}, description: t('tagline')};
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale as AppLocale);

  return (
    <html
      lang={locale}
      dir={directionOf(locale)}
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      {/*
        Blocking theme script as the first body node (Next docs pattern for
        root layouts). `beforeInteractive` inlines it into the initial HTML
        <head> pre-hydration (no theme flash). It intentionally lives outside
        <head>: React 19 warns (dev-only) for script elements rendered inside
        <head> on client navigations such as locale switches, while a
        body-placed beforeInteractive script loads exactly once.
      */}
      <body className="flex min-h-full flex-col bg-white font-sans text-zinc-900 dark:bg-navy-950 dark:text-zinc-100">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{__html: THEME_INIT_SCRIPT}}
        />
        <ThemeProvider>
          <NextIntlClientProvider>
            <AuthProvider>
              <ToastProvider>
                <Header />
                <main id="main-content" className="flex flex-1 flex-col">
                  {children}
                </main>
                <Footer />
              </ToastProvider>
            </AuthProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
