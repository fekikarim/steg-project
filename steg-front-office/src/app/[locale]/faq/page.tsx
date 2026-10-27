import {Link} from '@/i18n/navigation';
import {getTranslations} from 'next-intl/server';
import {setRequestLocale} from 'next-intl/server';
import type {AppLocale} from '@/i18n/routing';
import {Button} from '@/components/ui/Button';
import {ChatAssistant} from '@/components/ai/ChatAssistant';

export default async function FaqPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale as AppLocale);
  const t = await getTranslations('faq');

  const faqs = [
    {q: t('faqQuestion1'), a: t('faqAnswer1'), tag: t('tag1')},
    {q: t('faqQuestion2'), a: t('faqAnswer2'), tag: t('tag2')},
    {q: t('faqQuestion3'), a: t('faqAnswer3'), tag: t('tag3')},
    {q: t('faqQuestion4'), a: t('faqAnswer4'), tag: t('tag4')},
    {q: t('faqQuestion5'), a: t('faqAnswer5'), tag: t('tag5')},
    {q: t('faqQuestion6'), a: t('faqAnswer6'), tag: t('tag6')},
  ];

  return (
    <div className="relative overflow-hidden py-12 sm:py-20">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -top-24 start-1/2 -translate-x-1/2 h-96 w-[600px] ambient-glow-cyan blur-[120px]" />
      <div className="pointer-events-none absolute bottom-10 start-10 h-72 w-72 ambient-glow-blue blur-[100px]" />

      <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-300">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            {t('badge')}
          </div>
          <h1 className="mt-4 text-3xl sm:text-5xl font-extrabold tracking-tight text-navy-900 dark:text-white">
            <span className="gradient-heading block">{t('title')}</span>
          </h1>
          <p className="mt-3 max-w-xl text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {t('intro')}
          </p>
        </div>

        {/* FAQ Accordion List */}
        <div className="flex flex-col gap-4">
          {faqs.map((faq, index) => (
            <details
              key={index}
              className="group rounded-2xl border border-zinc-200/80 bg-white/80 p-5 shadow-xs backdrop-blur-md transition-all duration-200 hover:border-cyan-500/40 dark:border-white/10 dark:bg-navy-900/70"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-navy-900 dark:text-zinc-100 select-none">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-700 dark:text-cyan-300">
                    {faq.tag}
                  </span>
                  <span className="text-sm sm:text-base">{faq.q}</span>
                </div>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-xs transition-transform duration-200 group-open:rotate-180 dark:border-white/10 dark:bg-navy-800 text-zinc-500 dark:text-zinc-400">
                  ▼
                </span>
              </summary>
              <div className="mt-4 border-t border-zinc-100 pt-4 text-sm leading-relaxed text-zinc-600 dark:border-white/5 dark:text-zinc-300">
                {faq.a}
              </div>
            </details>
          ))}
        </div>

        {/* STEG RAG assistant (E3.1): knowledge-base answers via Spring Boot → Gemini */}
        <ChatAssistant />

        {/* Need more help CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 rounded-2xl border border-brand-500/20 bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 p-6 text-white backdrop-blur-lg">
          <div>
            <h3 className="font-bold text-base">{t('ctaTitle')}</h3>
            <p className="text-xs text-zinc-400 mt-0.5">{t('ctaDesc')}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/contact">
              <Button variant="cyber" size="sm">
                {t('ctaSupport')}
              </Button>
            </Link>
            <Link href="/">
              <Button variant="secondary" size="sm">
                {t('backToHome')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}