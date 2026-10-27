import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/api-client.service';
import type {
  Page,
  ValidationDecision,
  ValidationDetail,
  ValidationDocumentType,
  ValidationQueueQuery,
  ValidationQueueRow,
  ValidationReceipt,
  VerificationResult,
} from '../../core/api-models';

/**
 * Facade over ApiClient for internship validation (AGENTS.md §5.11, Admin
 * only). No rule lives here: the queue scope, the advisory-only AI runs, the
 * mandatory manual decisions (REJECTED needs a comment), the idempotent
 * receipt and the 404/409 guards all live in the backend.
 */
@Injectable({ providedIn: 'root' })
export class ValidationService {
  private readonly api = inject(ApiClient);

  /** Paged validation queue — one server page at a time. */
  queue(query: ValidationQueueQuery): Observable<Page<ValidationQueueRow>> {
    return this.api.searchValidationQueue(query);
  }

  /** Detail aggregate in one call. */
  detail(internshipId: string): Observable<ValidationDetail> {
    return this.api.getValidationDetail(internshipId);
  }

  /** Advisory AI verification on one document (never moves a status). */
  verify(
    internshipId: string,
    documentType: ValidationDocumentType,
  ): Observable<VerificationResult> {
    return this.api.runVerification(internshipId, documentType);
  }

  /** Mandatory manual decision per document. */
  decide(
    internshipId: string,
    documentType: ValidationDocumentType,
    decision: ValidationDecision,
    comment?: string,
  ): Observable<ValidationDetail> {
    return this.api.recordDecision(internshipId, documentType, decision, comment);
  }

  /** Idempotent receipt generation. */
  receipt(internshipId: string): Observable<ValidationReceipt> {
    return this.api.generateReceipt(internshipId);
  }

  /** Report/journal PDF download as a blob (preview + print + save). */
  download(internshipId: string, documentType: ValidationDocumentType): Observable<Blob> {
    return this.api.downloadValidationDocument(internshipId, documentType);
  }

  /** Backend error CODE of a failed validation call, when present. */
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
