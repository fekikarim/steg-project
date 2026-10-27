'use client';

import {useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {useAuth} from '@/lib/auth';
import {cx} from '@/lib/cx';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface AssistantPayload {
  displayText?: string;
  message?: string;
}

/**
 * STEG candidate assistant (E3.1/E5): RAG chatbot over the controlled backend
 * knowledge base. The browser only posts questions to our own
 * `/api/ai/assistant/query` proxy — the Gemini key never leaves Spring Boot,
 * which retrieves the official STEG sheets before calling the model.
 * Every answer is advisory; staff decisions remain authoritative.
 */
export function ChatAssistant({className}: {className?: string}) {
  const t = useTranslations('assistant');
  const {status} = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const ask = async () => {
    const question = input.trim();
    if (!question || pending) return;
    setError(null);
    setMessages((m) => [...m, {role: 'user', text: question}]);
    setInput('');
    setPending(true);
    try {
      const res = await fetch('/api/ai/assistant/query', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        credentials: 'same-origin',
        body: JSON.stringify({question}),
      });
      const data = (await res.json()) as AssistantPayload;
      if (!res.ok) throw new Error(data.message || t('errorGeneric'));
      const text = data.displayText?.trim() || t('emptyAnswer');
      setMessages((m) => [...m, {role: 'assistant', text}]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
    } finally {
      setPending(false);
      requestAnimationFrame(() => listRef.current?.scrollTo({top: listRef.current.scrollHeight}));
    }
  };

  if (status !== 'authenticated') {
    return (
      <section aria-label={t('title')} className={cx('rounded-2xl border p-5', className)}>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{t('loginRequired')}</p>
      </section>
    );
  }

  return (
    <section
      aria-label={t('title')}
      className={cx(
        'flex flex-col rounded-2xl border border-zinc-200/80 bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-navy-900/70',
        className,
      )}
    >
      <header className="border-b border-zinc-100 px-5 py-4 dark:border-white/5">
        <h2 className="text-base font-bold text-navy-900 dark:text-white">{t('title')}</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t('advisory')}</p>
      </header>

      <div ref={listRef} role="log" aria-live="polite" className="flex max-h-96 min-h-48 flex-col gap-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('empty')}</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cx(
              'max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed',
              m.role === 'user'
                ? 'self-end bg-brand-600 text-white'
                : 'self-start bg-zinc-100 text-zinc-800 dark:bg-white/10 dark:text-zinc-100',
            )}
          >
            {m.text}
          </div>
        ))}
        {pending && (
          <div className="self-start rounded-xl bg-zinc-100 px-3.5 py-2.5 text-sm text-zinc-500 dark:bg-white/10 dark:text-zinc-300">
            {t('thinking')}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="px-5 pb-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <form
        className="flex gap-2 border-t border-zinc-100 p-4 dark:border-white/5"
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <label htmlFor="assistant-input" className="sr-only">
          {t('inputLabel')}
        </label>
        <input
          id="assistant-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('placeholder')}
          maxLength={2000}
          disabled={pending}
          className="h-11 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 disabled:opacity-60 dark:border-white/10 dark:bg-navy-800 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={pending || input.trim().length === 0}
          className="h-11 shrink-0 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          {pending ? t('sending') : t('send')}
        </button>
      </form>
    </section>
  );
}
