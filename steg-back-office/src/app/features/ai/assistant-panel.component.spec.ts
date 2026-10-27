import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AssistantPanelComponent } from './assistant-panel.component';
import { I18nService } from '../../core/i18n.service';
import { ChatbotService } from './chatbot.service';
import { ToastService } from '../../shared/ui/toast.service';

/**
 * AssistantPanelComponent (S10c chatbot UI over the S10b backend): the panel
 * shows exactly four states — chatbot answer, loading, error with retry, or
 * "assistant unavailable". No fallback engines (legacy-removal #31).
 */
describe('AssistantPanelComponent (chatbot)', () => {
  async function setup(overrides: Record<string, unknown> = {}) {
    const calls: { asked: unknown[]; cleared: number } = { asked: [], cleared: 0 };
    const chatbot: Record<string, unknown> = {
      ask: (message: string) => {
        calls.asked.push(message);
        return of({ answer: 'AI answer', degraded: false, toolsUsed: [] });
      },
      history: () => of({ turns: [] }),
      clear: () => {
        calls.cleared += 1;
        return of(undefined as void);
      },
      ...((overrides['chatbot'] as Record<string, unknown> | undefined) ?? {}),
    };
    const toasts: unknown[][] = [];
    await TestBed.configureTestingModule({
      imports: [AssistantPanelComponent],
      providers: [
        { provide: ChatbotService, useValue: chatbot },
        { provide: ToastService, useValue: { show: (...a: unknown[]) => toasts.push(a) } },
      ],
    }).compileComponents();
    // Pin French: other spec files mutate the shared stored locale.
    TestBed.inject(I18nService).setLocale('fr');
    const fixture = TestBed.createComponent(AssistantPanelComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, component: fixture.componentInstance, calls, toasts };
  }

  it('loads server history on first open only', async () => {
    let historyCalls = 0;
    const { component } = await setup({
      chatbot: {
        history: () => {
          historyCalls += 1;
          return of({
            turns: [{ role: 'USER', content: 'past question', createdAt: '2026-06-01T00:00:00Z' }],
          });
        },
      },
    });
    expect(historyCalls).toBe(0);
    component.toggle();
    expect(historyCalls).toBe(1);
    expect(component.messages()).toHaveLength(1);
    component.toggle();
    component.toggle();
    expect(historyCalls).toBe(1);
  });

  it('keeps chatting when history fails to load', async () => {
    const { component } = await setup({
      chatbot: {
        history: () => throwError(() => ({ status: 500 })),
        ask: () => of({ answer: 'ok', degraded: false, toolsUsed: [] }),
      },
    });
    component.toggle();
    component.ask('hello');
    expect(component.messages().map((m) => m.text)).toEqual(['hello', 'ok']);
  });

  it('sends through the chatbot and flags degraded answers', async () => {
    const { component, calls, fixture } = await setup({
      chatbot: {
        ask: (message: string) => {
          calls.asked.push(message);
          return of({ answer: 'fallback figures', degraded: true, toolsUsed: [] });
        },
      },
    });
    component.toggle();
    component.ask('pending?');
    expect(calls.asked).toEqual(['pending?']);
    expect(component.busy()).toBe(false);
    const last = component.messages()[component.messages().length - 1];
    expect(last?.degraded).toBe(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent as string).toContain('de secours');
  });

  it('shows error with retry when the chatbot call fails', async () => {
    const { component, calls, fixture } = await setup({
      chatbot: {
        ask: (message: string) => {
          calls.asked.push(message);
          return throwError(() => ({ status: 500, error: { message: 'boom' } }));
        },
      },
    });
    component.toggle();
    component.ask('anything');
    expect(calls.asked).toEqual(['anything']);
    expect(component.error()).toBe('boom');
    expect(component.messages().map((m) => m.text)).toEqual(['anything']);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent as string).toContain('boom');
  });

  it('retries the last question from the error state', async () => {
    let attempts = 0;
    const { component, calls } = await setup({
      chatbot: {
        ask: (message: string) => {
          attempts += 1;
          calls.asked.push(message);
          return attempts === 1
            ? throwError(() => ({ status: 500 }))
            : of({ answer: 'recovered', degraded: false, toolsUsed: [] });
        },
      },
    });
    component.ask('q1');
    expect(component.error()).toBeTruthy();
    component.retry();
    expect(attempts).toBe(2);
    expect(component.messages().map((m) => m.text)).toEqual(['q1', 'q1', 'recovered']);
    expect(component.error()).toBeNull();
  });

  it('resets by clearing server history, then the local log', async () => {
    const { component, calls, toasts } = await setup();
    component.toggle();
    component.ask('hi');
    expect(component.messages()).toHaveLength(2);
    component.reset();
    expect(calls.cleared).toBe(1);
    expect(component.messages()).toHaveLength(0);
    expect(toasts[0]?.[0]).toBe('success');
  });

  it('keeps the log when the server clear fails', async () => {
    const { component, calls, toasts } = await setup({
      chatbot: {
        clear: () => {
          calls.cleared += 1;
          return throwError(() => ({ status: 500 }));
        },
      },
    });
    component.ask('hi');
    component.reset();
    expect(calls.cleared).toBe(1);
    expect(component.messages()).toHaveLength(2);
    expect(toasts[0]?.[0]).toBe('error');
  });

  it('ignores empty sends but sends real text', async () => {
    const { component, calls } = await setup();
    component.draft = '   ';
    component.send();
    component.draft = 'real question';
    component.send();
    expect(calls.asked).toEqual(['real question']);
    expect(component.draft).toBe('');
  });
});
