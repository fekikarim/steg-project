import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/api-client.service';
import type {
  CertificateDetail,
  CertificateQuery,
  CertificateRow,
  Page,
} from '../../core/api-models';

/**
 * Facade over ApiClient for the certificates workspace (AGENTS.md §5.7,
 * Admin only). No rule lives here: VALIDATED eligibility, stable references,
 * versioned regeneration, REVOKED soft delete and Admin-only scope are all
 * backend-owned.
 */
@Injectable({ providedIn: 'root' })
export class CertificatesService {
  private readonly api = inject(ApiClient);

  /** Paged workspace list — one server page at a time. */
  search(query: CertificateQuery): Observable<Page<CertificateRow>> {
    return this.api.searchCertificates(query);
  }

  /** Detail with the append-only version history. */
  detail(id: string): Observable<CertificateDetail> {
    return this.api.getCertificateDetail(id);
  }

  /** Generate for a VALIDATED internship (409 INTERNSHIP_NOT_VALIDATED otherwise). */
  generate(internshipId: string) {
    return this.api.generateCertificate(internshipId);
  }

  /** Edit-and-regenerate as a new version (reference stable). */
  regenerate(id: string, issueDate?: string): Observable<CertificateDetail> {
    return this.api.regenerateCertificate(id, issueDate);
  }

  /** Soft delete (confirmation is the caller's job). */
  remove(id: string): Observable<void> {
    return this.api.revokeCertificate(id);
  }

  /** Latest PDF download. */
  download(id: string) {
    return this.api.downloadCertificate(id);
  }

  /** One history version download. */
  downloadVersion(id: string, version: number) {
    return this.api.downloadCertificateVersion(id, version);
  }

  /** Backend error CODE of a failed call, when present. */
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
