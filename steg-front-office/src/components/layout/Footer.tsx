import Image from 'next/image';
import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {IconMail, IconPhone} from '@/components/ui/icons';

/**
 * Institutional footer (UI_UX §10.3.8): brand + tagline, quick navigation,
 * contact information, and legal/copyright bar. Links use locale-aware router.
 */
export async function Footer() {
  const tf = await getTranslations('footer');
  const tn = await getTranslations('nav');
  const year = new Date().getFullYear();

  const navLinks = [
    {href: '/', label: tf('linkHome')},
    {href: '/about', label: tf('linkAbout')},
    {href: '/history', label: tf('linkHistory')},
    {href: '/internships', label: tf('linkInternships')},
    {href: '/faq', label: tf('linkFaq')},
    {href: '/contact', label: tf('linkContact')},
  ];

  return (
    <footer className="relative overflow-hidden border-t border-zinc-200 bg-navy-950 text-zinc-300 dark:border-navy-800">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute bottom-0 start-1/2 -translate-x-1/2 h-40 w-3/4 rounded-full bg-brand-500/5 blur-3xl" />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-14 sm:px-6 relative z-10">
        {/* Top institutional status bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-8 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-mono text-xs text-zinc-300 uppercase tracking-wider">
              {tf('deptLine')}
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-400" />
            {tf('portalLine')}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          {/* Brand & Mission */}
          <div className="md:col-span-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white shadow-xs">
                <Image
                  src="/logo/logo-steg-1200x327.png"
                  alt="STEG"
                  width={1200}
                  height={327}
                  sizes="120px"
                  className="h-8 w-auto"
                />
              </div>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-zinc-400">
              {tf('tagline')}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-brand-300">
                {tf('foundedBadge')}
              </span>
              <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-emerald-300">
                {tf('zeroPaperBadge')}
              </span>
            </div>
          </div>

          {/* Quick Nav */}
          <nav aria-label={tf('footerNav')} className="md:col-span-3 flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              {tf('navHeading')}
            </h2>
            <ul className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="group inline-flex min-h-6 items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"
                  >
                    <span className="h-1 w-1 rounded-full bg-zinc-600 transition-colors group-hover:bg-brand-400" />
                    <span>{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact */}
          <div className="md:col-span-4 flex flex-col gap-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              {tf('contactHeading')}
            </h2>
            <ul className="flex flex-col gap-3 text-sm text-zinc-400">
              <li>
                <a
                  href={`mailto:${tf('contactEmail')}`}
                  className="group inline-flex min-h-6 items-center gap-2.5 transition-colors hover:text-white"
                  dir="ltr"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 group-hover:border-brand-400/50 group-hover:bg-brand-500/10">
                    <IconMail className="h-4 w-4 text-brand-300" />
                  </div>
                  <span>{tf('contactEmail')}</span>
                </a>
              </li>
              <li>
                <a
                  href={`tel:${tf('contactPhone').replace(/\s+/g, '')}`}
                  className="group inline-flex min-h-6 items-center gap-2.5 transition-colors hover:text-white"
                  dir="ltr"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 group-hover:border-brand-400/50 group-hover:bg-brand-500/10">
                    <IconPhone className="h-4 w-4 text-brand-300" />
                  </div>
                  <span>{tf('contactPhone')}</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="flex flex-col gap-3 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between text-xs text-zinc-500">
          <p>
            © {year} STEG — {tf('rights')}
          </p>
          <p className="font-mono text-[11px] text-zinc-500">
            {tn('home')} · {tn('internships')} · {tn('companion')}
          </p>
        </div>
      </div>
    </footer>
  );
}