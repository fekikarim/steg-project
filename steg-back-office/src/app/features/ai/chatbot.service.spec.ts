import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { ApiClient } from '../../core/api-client.service';
import { ChatbotService } from './chatbot.service';

/**
 * ChatbotService facade (AGENTS.md §7.5 — S10c UI): no rule lives here — the
 * backend owns scope, history, rate limiting, degradation and audit. The
 * facade only shapes transport and reads error envelopes.
 */
describe('ChatbotService', () => {
  let service: ChatbotService;
  let api: ApiClient;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(ChatbotService);
    api = TestBed.inject(ApiClient);
  });

  it('asks through the client with the raw message', () => {
    const spy = vi
      .spyOn(api, 'chatbotQuery')
      .mockReturnValue(of({ answer: 'hi', degraded: false, toolsUsed: [] }));
    service.ask('hello').subscribe();
    expect(spy).toHaveBeenCalledWith('hello');
  });

  it('reads and clears history through the client', () => {
    const history = vi.spyOn(api, 'chatbotHistory').mockReturnValue(of({ turns: [] }));
    const clear = vi.spyOn(api, 'clearChatbotHistory').mockReturnValue(of(undefined as void));
    service.history().subscribe();
    service.clear().subscribe();
    expect(history).toHaveBeenCalledWith();
    expect(clear).toHaveBeenCalledWith();
  });

  it('reads the backend error code and message', () => {
    expect(ChatbotService.codeOf({ error: { error: 'AI_UNAVAILABLE' } })).toBe('AI_UNAVAILABLE');
    expect(ChatbotService.codeOf({})).toBeNull();
    expect(ChatbotService.messageOf({ error: { message: 'Boom' } }, 'fb')).toBe('Boom');
    expect(ChatbotService.messageOf({}, 'fb')).toBe('fb');
  });

  it('surfaces backend failures unchanged', () => {
    vi.spyOn(api, 'chatbotQuery').mockReturnValue(
      throwError(() => ({ status: 429, error: { error: 'Too Many', message: 'slow down' } })),
    );
    let seen = '';
    service.ask('hi').subscribe({ error: (e) => (seen = ChatbotService.messageOf(e, 'fb')) });
    expect(seen).toBe('slow down');
  });
});
