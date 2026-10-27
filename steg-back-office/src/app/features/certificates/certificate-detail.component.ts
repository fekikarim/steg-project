import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { I18nService } from '../../core/i18n.service';
import { ToastService } from '../../shared/ui/toast.service';
import { CertificatesService } from './certificates.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ErrorStateComponent } from '../../shared/ui/states.component';
import { BadgeComponent, type BadgeTone } from '../../shared/ui/badge.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { DialogComponent } from '../../shared/ui/dialog.component';
import type { CertificateDetail } from '../../core/api-models';

/**
 * Certificate detail (AGENTS.md §5.7, Admin only): current PDF
 * (preview/download/print), the append-only version history with per-version
 * download, edit-and-regenerate (reference stable, version bumped), and the
 * confirmed REVOKED soft delete.
 */
@Component({
  selector: 'st-certificate-detail',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    LiveStatusComponent,
    PageHeaderComponent,
    SkeletonComponent,
    ErrorStateComponent,
    BadgeComponent,
    AlertComponent,
    DialogComponent,
  ],
  template: `
    <st-page-header
      [title]="i18n.t('certificates.detailTitle')"
      [subtitle]="detail()?.certificate.reference ?? ''"
    >
      <st-live-status />
      <a class="st-btn" routerLink="/certificates">{{ i18n.t('certificates.backToList') }}</a>
    </st-page-header>

    @if (loading()) {
      <st-skeleton [rows]="6" />
    } @else if (error()) {
      <st-error-state
        [title]="i18n.t('common.error.title')"
        [body]="error()!"
        [retryLabel]="i18n.t('common.retry')"
        (retry)="reload()"
      />
    } @else if (detail(); as d) {
      <section class="st-card" aria-label="certificate">
        <h2>{{ d.certificate.candidateName }}</h2>
        <p>{{ d.certificate.universityName }} · {{ d.certificate.internshipType }}</p>
        <p>
          {{ d.certificate.reference }} · v{{ d.certificate.versionNumber }} ·
          {{ d.certificate.issueDate }}
          <st-badge [label]="d.certificate.status" [tone]="tone(d.certificate.status)" />
        </p>
        <div class="st-actions">
          <button type="button" class="st-btn st-btn--sm" (click)="preview()">
            {{ i18n.t('certificates.preview') }}
          </button>
          <button type="button" class="st-btn st-btn--sm" (click)="download()">
            {{ i18n.t('certificates.download') }}
          </button>
          <button type="button" class="st-btn st-btn--sm st-btn--primary" (click)="openEdit()">
            {{ i18n.t('certificates.edit') }}
          </button>
        </div>
        @if (previewUrl()) {
          <iframe title="preview" [src]="previewUrl()" class="st-preview"></iframe>
          <div class="st-actions">
            <button type="button" class="st-btn st-btn--sm" (click)="printPreview()">
              {{ i18n.t('certificates.print') }}
            </button>
          </div>
        }
      </section>

      <section class="st-card" aria-label="versions">
        <h2>{{ i18n.t('certificates.versionsTitle') }}</h2>
        <ul class="st-versions">
          @for (v of d.versions; track v.versionNumber) {
            <li>
              v{{ v.versionNumber }} · {{ v.generatedAt }}
              <button
                type="button"
                class="st-btn st-btn--sm"
                (click)="downloadVersion(v.versionNumber)"
              >
                {{ i18n.t('certificates.download') }}
              </button>
            </li>
          }
        </ul>
      </section>
    }

    <st-dialog
      [open]="editOpen()"
      [title]="i18n.t('certificates.editTitle')"
      (close)="editOpen.set(false)"
    >
      <p>{{ i18n.t('certificates.editHint') }}</p>
      <label class="st-field">
        <span>{{ i18n.t('certificates.issueDateLabel') }}</span>
        <input class="st-input" type="date" [(ngModel)]="issueDate" />
      </label>
      @if (editError()) {
        <st-alert tone="error">{{ editError() }}</st-alert>
      }
      <div class="st-dialog__actions">
        <button type="button" class="st-btn" (click)="editOpen.set(false)">
          {{ i18n.t('common.cancel') }}
        </button>
        <button
          type="button"
          class="st-btn st-btn--primary"
          [disabled]="saving()"
          (click)="confirmEdit()"
        >
          {{ i18n.t('certificates.regenerate') }}
        </button>
      </div>
    </st-dialog>
  `,
  styles: [
    `
      .st-card {
        border: 1px solid var(--st-border, #e3e8ef);
        border-radius: 0.75rem;
        padding: 1rem;
        margin-bottom: 1rem;
      }
      .st-card h2 {
        margin: 0 0 0.5rem;
        font-size: 1.05rem;
      }
      .st-actions {
        display: flex;
        gap: 0.375rem;
        flex-wrap: wrap;
        margin: 0.5rem 0;
      }
      .st-versions {
        list-style: none;
        margin: 0.5rem 0 0;
        padding: 0;
        display: grid;
        gap: 0.375rem;
      }
      .st-versions li {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }
      .st-preview {
        width: 100%;
        min-height: 480px;
        border: 1px solid var(--st-border, #e3e8ef);
        border-radius: 0.5rem;
      }
      .st-field {
        display: grid;
        gap: 0.25rem;
        margin-bottom: 0.75rem;
      }
      .st-dialog__actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 1rem;
      }
    `,
  ],
})
export class CertificateDetailComponent implements OnInit {
  private readonly service = inject(CertificatesService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly detail = signal<CertificateDetail | null>(null);

  readonly previewUrl = signal<SafeResourceUrl | null>(null);
  private previewObjectUrl: string | null = null;

  readonly editOpen = signal(false);
  readonly editError = signal<string | null>(null);
  issueDate = '';

  private id(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  ngOnInit(): void {
    this.reload();
  }

  tone(s: string): BadgeTone {
    return s === 'REVOKED' ? 'neutral' : 'success';
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.detail(this.id()).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(CertificatesService.messageOf(e, 'Load failed'));
        this.loading.set(false);
      },
    });
  }

  private blobToPreview(blob: Blob): void {
    if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl);
    this.previewObjectUrl = URL.createObjectURL(blob);
    this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.previewObjectUrl));
  }

  preview(): void {
    this.service.download(this.id()).subscribe({
      next: (blob) => this.blobToPreview(blob),
      error: (e) => this.toast.show('error', CertificatesService.messageOf(e, 'Download failed')),
    });
  }

  download(): void {
    this.service.download(this.id()).subscribe({
      next: (blob) =>
        this.saveBlob(blob, `${this.detail()?.certificate.reference ?? 'certificate'}.pdf`),
      error: (e) => this.toast.show('error', CertificatesService.messageOf(e, 'Download failed')),
    });
  }

  downloadVersion(version: number): void {
    this.service.downloadVersion(this.id(), version).subscribe({
      next: (blob) =>
        this.saveBlob(
          blob,
          `${this.detail()?.certificate.reference ?? 'certificate'}-v${version}.pdf`,
        ),
      error: (e) => this.toast.show('error', CertificatesService.messageOf(e, 'Download failed')),
    });
  }

  private saveBlob(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  printPreview(): void {
    if (!this.previewObjectUrl) return;
    const w = window.open(this.previewObjectUrl, '_blank');
    w?.addEventListener('load', () => w.print());
  }

  openEdit(): void {
    this.issueDate = this.detail()?.certificate.issueDate ?? '';
    this.editError.set(null);
    this.editOpen.set(true);
  }

  confirmEdit(): void {
    this.saving.set(true);
    this.service.regenerate(this.id(), this.issueDate || undefined).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.saving.set(false);
        this.editOpen.set(false);
        this.toast.show('success', this.i18n.t('certificates.regenerated'));
      },
      error: (e) => {
        this.editError.set(CertificatesService.messageOf(e, 'Regenerate failed'));
        this.saving.set(false);
      },
    });
  }
}
