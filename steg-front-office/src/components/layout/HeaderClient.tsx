'use client';

import {useState, useRef, useEffect, type ReactNode} from 'react';
import {Link, usePathname, useRouter} from '@/i18n/navigation';
import {LangSwitcher} from './LangSwitcher';
import {ThemeToggle} from './ThemeToggle';
import {Button} from '@/components/ui/Button';
import {NotificationBell} from '@/components/notifications/NotificationBell';
import {useAuth} from '@/lib/auth';
import {
  IconUser,
  IconFolder,
  IconFileText,
  IconBell,
  IconArrowRight,
} from '@/components/ui/icons';

interface Labels {
  home: string;
  about: string;
  history: string;
  internships: string;
  companion: string;
  apply: string;
  signIn: string;
  createAccount: string;
  profile: string;
  applications: string;
  documents: string;
  notifications: string;
  signOut: string;
  skipToContent: string;
  openMenu: string;
  closeMenu: string;
  nationalBadge: string;
  candidateSpace: string;
  primaryNav: string;
  mobileNav: string;
}

/**
 * Institutional header:
 * - Public discovery navigation: Home, About, History, Internship Types, Internship Companion.
 * - Prominent "Apply" action button.
 * - Authenticated Profile dropdown menu (Profile, Applications tracking, Notifications, Sign out).
 * - Multi-language and dark mode controls.
 * - Responsive mobile menu drawer.
 */
export function HeaderClient({labels, logo}: {labels: Labels; logo: ReactNode}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const {status, logout} = useAuth();
  const signedIn = status === 'authenticated';

  const loginHref = {
    pathname: '/login',
    query: pathname && pathname !== '/login' && pathname !== '/register' ? {returnTo: pathname} : undefined,
  } as const;

  const discoveryLinks = [
    {href: '/', label: labels.home},
    {href: '/about', label: labels.about},
    {href: '/history', label: labels.history},
    {href: '/internships', label: labels.internships},
    {href: '/companion', label: labels.companion},
  ];

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileOpen]);

  async function handleSignOut() {
    setProfileOpen(false);
    setMobileOpen(false);
    await logout();
    router.replace('/');
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white"
      >
        {labels.skipToContent}
      </a>
      <header className="frosted-header sticky top-0 z-40 transition-colors">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          {/* Logo & National Status Indicator */}
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="STEG" className="shrink-0 transition-opacity hover:opacity-90">
              {logo}
            </Link>
            <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 sm:inline-flex dark:border-slate-700 dark:bg-navy-900 dark:text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              {labels.nationalBadge}
            </span>
          </div>

          {/* Desktop Discovery Links */}
          <nav aria-label={labels.primaryNav} className="hidden items-center gap-1 lg:flex">
            {discoveryLinks.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                    active
                      ? 'font-semibold text-brand-700 dark:text-brand-300'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'
                  }`}
                >
                  {l.label}
                  {active && (
                    <span className="absolute bottom-0 start-3 end-3 h-0.5 rounded-full bg-brand-600 dark:bg-brand-400" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Tools */}
          <div className="hidden items-center gap-2.5 lg:flex">
            <LangSwitcher />
            <ThemeToggle />
            {signedIn && <NotificationBell />}

            {/* Profile Dropdown or Sign In */}
            {signedIn ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-900 transition-colors hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-navy-900 dark:text-slate-100 dark:hover:bg-navy-800"
                  aria-expanded={profileOpen}
                  aria-haspopup="true"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-semibold">
                    <IconUser className="h-3.5 w-3.5" />
                  </span>
                  <span>{labels.profile}</span>
                  <span className="text-[10px] text-slate-400">▼</span>
                </button>

                {profileOpen && (
                  <div className="absolute end-0 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg backdrop-blur-xl animate-in fade-in-50 zoom-in-95 dark:border-slate-700 dark:bg-navy-900 dark:shadow-2xl">
                    <div className="mb-1 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-300">
                        {labels.candidateSpace}
                      </span>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
                    >
                      <IconUser className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                      <span>{labels.profile}</span>
                    </Link>
                    <Link
                      href="/applications"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
                    >
                      <IconFolder className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                      <span>{labels.applications}</span>
                    </Link>
                    <Link
                      href="/documents"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
                    >
                      <IconFileText className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                      <span>{labels.documents}</span>
                    </Link>
                    <Link
                      href="/notifications"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
                    >
                      <IconBell className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                      <span>{labels.notifications}</span>
                    </Link>
                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                    <button
                      type="button"
                      onClick={() => void handleSignOut()}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-sm font-medium text-accent-600 transition-colors hover:bg-accent-50 dark:text-accent-100 dark:hover:bg-accent-600/20"
                    >
                      <span>{labels.signOut}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href={loginHref}>
                <Button variant="secondary" size="sm" className="whitespace-nowrap">
                  {labels.signIn}
                </Button>
              </Link>
            )}

            {/* Apply Action Button */}
            <Link href="/apply">
              <Button variant="primary" size="sm">
                {labels.apply}
              </Button>
            </Link>
          </div>

          {/* Mobile hamburger button */}
          <div className="flex items-center gap-2 lg:hidden">
            <LangSwitcher />
            <ThemeToggle />
            {signedIn && <NotificationBell />}
            <button
              type="button"
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/10"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? labels.closeMenu : labels.openMenu}
              onClick={() => setMobileOpen((v) => !v)}
            >
              <span aria-hidden="true" className="text-xl">
                {mobileOpen ? '✕' : '☰'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileOpen && (
              <nav aria-label={labels.mobileNav} className="border-t border-zinc-200 bg-white px-4 py-4 lg:hidden dark:border-zinc-800 dark:bg-navy-950">
            <ul className="flex flex-col gap-1.5">
              {discoveryLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-white/10"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}

              {signedIn && (
                <>
                  <li className="my-1 border-t border-zinc-200 dark:border-zinc-800" />
                  <li>
                    <Link
                      href="/profile"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-white/10"
                    >
                      <IconUser className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                      <span>{labels.profile}</span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/applications"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-white/10"
                    >
                      <IconFolder className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                      <span>{labels.applications}</span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/documents"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-white/10"
                    >
                      <IconFileText className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                      <span>{labels.documents}</span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/notifications"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-white/10"
                    >
                      <IconBell className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                      <span>{labels.notifications}</span>
                    </Link>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => void handleSignOut()}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm font-medium text-accent-600 hover:bg-accent-50 dark:text-accent-100 dark:hover:bg-accent-600/20"
                    >
                      <span>{labels.signOut}</span>
                    </button>
                  </li>
                </>
              )}

              <li className="pt-2">
                <Link href="/apply" onClick={() => setMobileOpen(false)} className="block w-full">
                  <Button variant="primary" size="md" className="w-full justify-center">
                    {labels.apply}
                    <IconArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </Button>
                </Link>
              </li>

              {!signedIn && (
                <li className="pt-1">
                  <Link href={loginHref} onClick={() => setMobileOpen(false)} className="block w-full">
                    <Button variant="secondary" size="md" className="w-full justify-center">
                      {labels.signIn}
                    </Button>
                  </Link>
                </li>
              )}
            </ul>
          </nav>
        )}
      </header>
    </>
  );
}
