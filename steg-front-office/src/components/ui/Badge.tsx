'use client';

import {useTranslations} from 'next-intl';
import {cx} from '@/lib/cx';
import type frMessages from '@/messages/fr.json';

type StatusMessageKey = keyof typeof frMessages.status;

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'brand';

/**
 * Backend status codes mapped to (tone, icon). Never color-only: every badge
 * carries a translated text label and, where useful, a glyph (UI_UX §9.4).
 */
const STATUS_TONE: Record<string, {tone: Tone; glyph: string}> = {
  DRAFT: {tone: 'neutral', glyph: '○'},
  SUBMITTED: {tone: 'info', glyph: '●'},
  UNDER_REVIEW: {tone: 'info', glyph: '◐'},
  MODIFICATION_REQUESTED: {tone: 'warning', glyph: '✎'},
  RESUBMITTED: {tone: 'info', glyph: '↻'},
  APPROVED: {tone: 'success', glyph: '✓'},
  VALIDATED: {tone: 'success', glyph: '✓'},
  VERIFIED: {tone: 'success', glyph: '✓'},
  REQUIRES_CORRECTION: {tone: 'warning', glyph: '✎'},
  LOW: {tone: 'neutral', glyph: '○'},
  NORMAL: {tone: 'info', glyph: '●'},
  HIGH: {tone: 'warning', glyph: '!'},
  URGENT: {tone: 'error', glyph: '!'},
  COMPLETED: {tone: 'success', glyph: '✓'},
  GENERATED: {tone: 'success', glyph: '✓'},
  ISSUED: {tone: 'success', glyph: '✓'},
  DELIVERED: {tone: 'success', glyph: '✓✓'},
  READ: {tone: 'success', glyph: '✓✓'},
  REJECTED: {tone: 'error', glyph: '✕'},
  CANCELLED: {tone: 'error', glyph: '✕'},
  WITHDRAWN: {tone: 'neutral', glyph: '↩'},
  ARCHIVED: {tone: 'neutral', glyph: '▤'},
  PENDING: {tone: 'warning', glyph: '◷'},
  TODO: {tone: 'neutral', glyph: '○'},
  IN_PROGRESS: {tone: 'info', glyph: '◐'},
  ACTIVE: {tone: 'brand', glyph: '●'},
  PLANNED: {tone: 'neutral', glyph: '○'},
  SENT: {tone: 'neutral', glyph: '✓'},
  OPENED: {tone: 'info', glyph: '○'},
  CLOSED: {tone: 'neutral', glyph: '●'},
  OBSERVATION: {tone: 'info', glyph: '◌'},
  PERFECTIONNEMENT: {tone: 'brand', glyph: '◍'},
  PFE: {tone: 'brand', glyph: '●'},
  OBLIGATOIRE: {tone: 'warning', glyph: '!'},
  OPTIONAL: {tone: 'neutral', glyph: '○'},
  REVIEWED: {tone: 'info', glyph: '✓'},
};

const TONES: Record<Tone, string> = {
  neutral: 'bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-300',
  info: 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200',
  success: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  error: 'bg-accent-50 text-accent-800 dark:bg-accent-600/15 dark:text-accent-100',
  brand: 'bg-brand-600 text-white dark:bg-brand-500',
};

interface BadgeProps {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}

export function Badge({tone = 'neutral', children, className}: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

interface StatusPillProps {
  /** Raw backend enum code, e.g. "UNDER_REVIEW". Unknown codes fall back gracefully. */
  code: string;
  className?: string;
}

/** Translated status pill for any backend lifecycle enum (UI_UX §9.4). */
export function StatusPill({code, className}: StatusPillProps) {
  const t = useTranslations('status');
  const mapping = STATUS_TONE[code] ?? {tone: 'neutral' as Tone, glyph: '•'};
  // STATUS_TONE keys mirror the translated `status` namespace exactly; unknown
  // backend codes degrade to their raw (still meaningful) value, never crash.
  const label = code in STATUS_TONE ? t(code as StatusMessageKey) : code;
  return (
    <Badge tone={mapping.tone} className={className}>
      <span aria-hidden="true">{mapping.glyph}</span>
      {label}
    </Badge>
  );
}
