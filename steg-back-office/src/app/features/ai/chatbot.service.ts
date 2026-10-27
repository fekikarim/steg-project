import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/api-client.service';
import type { ChatHistory, ChatbotResponse } from '../../core/api-models';

/**
 * Facade over ApiClient for the role-scoped back-office chatbot
 * (AGENTS.md §7.5 — S10c UI over the S10b backend).
 *
 * No rule lives here: the backend answers from curated knowledge plus
 * scoped live-data tools (Admin global, Supervisor own scope), keeps history
 * server-side per user, and degrades to a friendly unavailable answer
 * (`degraded: true`) when the model is unreachable. This class only shapes
 * transport and reads backend error envelopes.
 */
@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private readonly api = inject(ApiClient);

  /** Ask the assistant (history persists server-side, per user). */
  ask(message: string): Observable<ChatbotResponse> {
    return this.api.chatbotQuery(message);
  }

  /** My own conversation history (bounded server-side, oldest first). */
  history(): Observable<ChatHistory> {
    return this.api.chatbotHistory();
  }

  /** Clear my own conversation history. */
  clear(): Observable<void> {
    return this.api.clearChatbotHistory();
  }

  /** Backend error CODE of a failed chatbot call, when present. */
  static codeOf(error: unknown): string | null {
    const envelope = (error as { error?: { error?: string } } | null)?.error;
    return envelope?.error ?? null;
  }

  /** Backend error envelope message, when present. */
  static messageOf(error: unknown, fallback: string): string {
    if (typeof error === 'object' && error !== null) {
      const envelope = (error as { error?: { message?: string } }).error;
      if (envelope?.message) return envelope.message;
    }
    return fallback;
  }
}
