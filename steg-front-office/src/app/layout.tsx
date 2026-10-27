import type {Metadata} from 'next';

/**
 * Root layout: metadata only. The localized segment layout renders <html>/<body>
 * per locale (lang + dir), so every route carries the correct language context.
 */
export const metadata: Metadata = {
  title: {
    default: 'STEG — Stages & Démarches',
    template: '%s · STEG',
  },
  description:
    "Plateforme intelligente des stages et des flux administratifs de la STEG.",
  icons: {
    icon: '/logo/favicon.ico',
    shortcut: '/logo/favicon.ico',
    apple: '/logo/apple-touch-icon.png',
  },
  manifest: '/logo/site.webmanifest',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return children;
}
