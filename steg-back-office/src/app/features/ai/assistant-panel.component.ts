import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n.service';
import { ToastService } from '../../shared/ui/toast.service';
import { AlertComponent } from '../../shared/ui/alert.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ChatbotService } from './chatbot.service';

interface ChatMessage {
  readonly from: 'user' | 'ai';
  readonly text: string;
  /** True when the backend answered from its degraded fallback (AI down). */
  readonly degraded?: boolean;
}

/**
 * Floating administrative assistant, backed ONLY by the role-scoped S10b
 * chatbot (AGENTS.md §7.5): curated knowledge + scoped live-data tools
 * answer from the backend, history persists server-side per user.
 *
 * The panel shows exactly four states: the chatbot answer, loading, error
 * with retry, or "assistant unavailable". There are no fallback engines here
 * (legacy-removal #31): no legacy `queryAssistant` call, no local rule-based
 * answers — `AiAssistantService` remains in use by the insights view only.
 */
@Component({
  selector: 'st-assistant-panel',
  standalone: true,
  imports: [FormsModule, AlertComponent, SkeletonComponent],
  template: `
    @if (open()) {
      <section
        class="st-assistant"
        role="dialog"
        aria-modal="false"
        [attr.aria-label]="i18n.t('assistant.title')"
      >
        <header class="st-assistant__head">
          <strong>{{ i18n.t('assistant.title') }}</strong>
          <div class="st-assistant__head-actions">
            <button
              type="button"
              class="st-btn st-btn--text"
              (click)="reset()"
              [disabled]="busy() || (messages().length === 0 && !historyLoaded())"
            >
              {{ i18n.t('assistant.newConversation') }}
            </button>
            <button
              type="button"
              class="st-btn st-btn--text"
              (click)="open.set(false)"
              [attr.aria-label]="i18n.t('common.close')"
            >
              ✕
            </button>
          </div>
        </header>
        <p class="st-assistant__welcome">{{ i18n.t('assistant.welcome') }}</p>
        <div class="st-assistant__suggest">
          @for (q of suggestedKeys(); track q) {
            <button type="button" class="st-chip" (click)="ask(i18n.t(q))" [disabled]="busy()">
              {{ i18n.t(q) }}
            </button>
          }
        </div>
        <div class="st-assistant__log" aria-live="polite">
          @if (historyLoading()) {
            <st-skeleton [rows]="3" />
          }
          @for (m of messages(); track $index) {
            <p class="st-msg" [class.st-msg--ai]="m.from === 'ai'" dir="auto">
              {{ m.text }}
            </p>
            @if (m.from === 'ai' && m.degraded) {
              <p class="st-note" dir="auto">{{ i18n.t('assistant.degradedNote') }}</p>
            }
          }
          @if (busy()) {
            <p class="st-msg st-msg--ai" aria-busy="true">…</p>
          }
          @if (error()) {
            <st-alert tone="error">{{ error() }}</st-alert>
            <button type="button" class="st-btn st-btn--sm" (click)="retry()" [disabled]="busy()">
              {{ i18n.t('common.retry') }}
            </button>
          }
        </div>
        <form class="st-assistant__form" (ngSubmit)="send()">
          <label class="st-sr" for="st-assistant-input">{{ i18n.t('assistant.inputLabel') }}</label>
          <input
            id="st-assistant-input"
            type="text"
            class="st-input"
            [(ngModel)]="draft"
            name="draft"
            dir="auto"
            [placeholder]="i18n.t('assistant.inputLabel')"
            maxlength="2000"
          />
          <button type="submit" class="st-btn st-btn--primary" [disabled]="busy() || !draft.trim()">
            {{ i18n.t('assistant.send') }}
          </button>
        </form>
        <p class="st-assistant__note">{{ i18n.t('assistant.ruleBasedNote') }}</p>
      </section>
    } @else {
      <button
        type="button"
        class="st-fab"
        (click)="toggle()"
        [attr.aria-label]="i18n.t('assistant.title')"
      >
        AI
      </button>
    }
  `,
  styles: [
    `
      .st-fab {
        position: fixed;
        inset-block-end: 1.25rem;
        inset-inline-end: 1.25rem;
        inline-size: 3.25rem;
        block-size: 3.25rem;
        border-radius: 50%;
        border: none;
        background: var(--action-primary);
        color: #fff;
        font-weight: 800;
        cursor: pointer;
        box-shadow: var(--shadow-md);
        z-index: 60;
      }
      .st-assistant {
        position: fixed;
        inset-block-end: 1.25rem;
        inset-inline-end: 1.25rem;
        inline-size: min(24rem, calc(100vw - 2rem));
        max-block-size: min(34rem, calc(100dvh - 4rem));
        display: flex;
        flex-direction: column;
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: 0.8rem;
        box-shadow: var(--shadow-md);
        z-index: 60;
        overflow: hidden;
      }
      .st-assistant__head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem 0.8rem;
        border-block-end: 1px solid var(--border-subtle);
        font-size: 0.9rem;
      }
      .st-assistant__head-actions {
        display: flex;
        gap: 0.25rem;
      }
      .st-assistant__welcome {
        margin: 0;
        padding: 0.6rem 0.8rem 0;
        font-size: 0.8rem;
        color: var(--text-secondary);
      }
      .st-assistant__suggest {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        padding: 0.5rem 0.8rem 0;
      }
      .st-chip {
        font-size: 0.72rem;
        border: 1px solid var(--border-default);
        background: var(--bg-page);
        color: inherit;
        border-radius: 999px;
        padding: 0.25rem 0.6rem;
        cursor: pointer;
      }
      .st-chip:disabled {
        opacity: 0.55;
        cursor: default;
      }
      .st-assistant__log {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding: 0.6rem 0.8rem;
        overflow-y: auto;
        min-block-size: 8rem;
      }
      .st-msg {
        margin: 0;
        font-size: 0.82rem;
        padding: 0.45rem 0.6rem;
        border-radius: 0.55rem;
        background: var(--bg-page);
        align-self: flex-end;
        max-inline-size: 100%;
        overflow-wrap: anywhere;
      }
      .st-msg--ai {
        align-self: flex-start;
        background: color-mix(in srgb, var(--action-primary) 10%, var(--bg-page));
      }
      .st-note {
        margin: -0.2rem 0 0;
        font-size: 0.68rem;
        color: var(--text-muted);
        align-self: flex-start;
      }
      .st-assistant__form {
        display: flex;
        gap: 0.4rem;
        padding: 0.6rem 0.8rem;
        border-block-start: 1px solid var(--border-subtle);
      }
      .st-assistant__form .st-input {
        flex: 1;
      }
      .st-assistant__note {
        margin: 0;
        padding: 0 0.8rem 0.6rem;
        font-size: 0.68rem;
        color: var(--text-muted);
      }
      .st-sr {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
      }
    `,
  ],
})
export class AssistantPanelComponent {
  readonly i18n = inject(I18nService);
  private readonly chatbot = inject(ChatbotService);
  private readonly toast = inject(ToastService);

  readonly open = signal(false);
  readonly busy = signal(false);
  readonly historyLoading = signal(false);
  readonly historyLoaded = signal(false);
  readonly messages = signal<readonly ChatMessage[]>([]);
  readonly error = signal<string | null>(null);
  draft = '';
  private lastQuestion: string | null = null;

  suggestedKeys(): readonly string[] {
    return [
      'assistant.suggest.pending',
      'assistant.suggest.ending',
      'assistant.suggest.documents',
      'assistant.suggest.validation',
      'assistant.suggest.progress',
    ];
  }

  toggle(): void {
    const opening = !this.open();
    this.open.set(opening);
    // Server-side history loads lazily on first open — never on shell boot.
    if (opening && !this.historyLoaded() && !this.historyLoading()) this.loadHistory();
  }

  reset(): void {
    if (this.busy()) return;
    // Clear server-side history first so a reload cannot resurrect it; the
    // local log clears with it. A failed clear keeps the log (safe default).
    this.chatbot.clear().subscribe({
      next: () => {
        this.messages.set([]);
        this.error.set(null);
        this.historyLoaded.set(true);
        this.toast.show('success', this.i18n.t('assistant.historyCleared'));
      },
      error: (e) => {
        this.toast.show('error', ChatbotService.messageOf(e, this.i18n.t('assistant.clearFailed')));
      },
    });
  }

  send(): void {
    const text = this.draft.trim();
    if (!text || this.busy()) return;
    this.ask(text);
    this.draft = '';
  }

  retry(): void {
    if (this.lastQuestion && !this.busy()) this.ask(this.lastQuestion);
  }

  ask(question: string): void {
    const text = question.trim().slice(0, 2000);
    if (!text || this.busy()) return;
    this.lastQuestion = text;
    this.messages.set([...this.messages(), { from: 'user', text }]);
    this.error.set(null);
    this.busy.set(true);
    this.chatbot.ask(text).subscribe({
      next: (result) => {
        this.busy.set(false);
        const body = result.answer?.trim() || this.i18n.t('assistant.answer.unavailable');
        this.messages.set([
          ...this.messages(),
          { from: 'ai', text: body, degraded: result.degraded },
        ]);
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(ChatbotService.messageOf(e, this.i18n.t('assistant.answer.unavailable')));
      },
    });
  }

  private loadHistory(): void {
    this.historyLoading.set(true);
    this.chatbot.history().subscribe({
      next: (history) => {
        this.messages.set(
          (history.turns ?? []).map((t) => ({
            from: t.role === 'ASSISTANT' ? ('ai' as const) : ('user' as const),
            text: t.content,
          })),
        );
        this.historyLoading.set(false);
        this.historyLoaded.set(true);
      },
      error: () => {
        // History is a convenience — a failure must not block chatting.
        this.historyLoading.set(false);
        this.historyLoaded.set(true);
      },
    });
  }
}
