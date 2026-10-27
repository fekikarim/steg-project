import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { I18nService } from '../../core/i18n.service';
import { ToastService } from '../../shared/ui/toast.service';
import { ValidationService } from './validation.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ErrorStateComponent } from '../../shared/ui/states.component';
import { BadgeComponent, type BadgeTone } from '../../shared/ui/badge.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { DialogComponent } from '../../shared/ui/dialog.component';
import type {
  ValidationDetail,
  ValidationDocumentRef,
  ValidationDocumentType,
} from '../../core/api-models';

const CHECK_TONE: Record<string, BadgeTone> = {
  PASSED: 'success',
  FAILED: 'error',
  INCONCLUSIVE: 'warning',
};

/**
 * Validation detail (AGENTS.md §5.11 steps 2–7, Admin only): candidate info,
 * tasks with statuses (+ the shared done/total ratio), the report and journal
 * PDFs (preview/download/print), per-check AI results, a "run AI verification"
 * action per document with a degraded "AI unavailable, validate manually"
 * banner, a manual decision control per document (rejection comment
 * mandatory), and receipt generate/preview/print.
 *
 * <p>The AI is advisory only: running verification never changes the
 * internship status — only the manual decisions do (backend-enforced).
 */
@Component({
  selector: 'st-validation-detail',
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
      [title]="i18n.t('validation.detailTitle')"
      [subtitle]="detail()?.reference ?? ''"
    >
      <st-live-status />
      <a class="st-btn" routerLink="/validation">{{ i18n.t('validation.backToQueue') }}</a>
    </st-page-header>

    @if (loading()) {
      <st-skeleton [rows]="8" />
    } @else if (error()) {
      <st-error-state
        [title]="i18n.t('common.error.title')"
        [body]="error()!"
        [retryLabel]="i18n.t('common.retry')"
        (retry)="reload()"
      />
    } @else if (detail(); as d) {
      <section class="st-card" aria-label="candidate">
        <h2>{{ d.candidate.fullName }}</h2>
        <p>{{ d.candidate.email }} · {{ d.candidate.universityName }}</p>
        <p>
          {{ d.type }} · {{ d.requirement }} · {{ d.startDate }} → {{ d.endDate }} ·
          {{ i18n.t('validation.supervisor') }}:
          {{ d.supervisor.displayName ?? d.supervisor.email }}
        </p>
        <p>{{ i18n.t('validation.tasksDone') }}: {{ d.tasks.done }}/{{ d.tasks.total }}</p>
        <ul class="st-tasks">
          @for (t of d.tasks.items; track t.id) {
            <li>{{ t.title }} — {{ t.status }}</li>
          }
        </ul>
      </section>

      @for (doc of docs(d); track doc.key) {
        <section class="st-card" [attr.aria-label]="doc.key">
          <h2>
            {{
              i18n.t(doc.key === 'REPORT' ? 'validation.reportTitle' : 'validation.journalTitle')
            }}
          </h2>
          @if (doc.ref) {
            <p>{{ doc.ref.title }} · v{{ doc.ref.version }} · {{ doc.ref.submittedAt }}</p>
            <div class="st-actions">
              <button type="button" class="st-btn st-btn--sm" (click)="preview(doc.ref!)">
                {{ i18n.t('validation.preview') }}
              </button>
              <button type="button" class="st-btn st-btn--sm" (click)="download(doc.ref!)">
                {{ i18n.t('validation.download') }}
              </button>
              <button
                type="button"
                class="st-btn st-btn--sm st-btn--primary"
                [disabled]="verifying() === doc.key"
                (click)="runAi(doc.key)"
              >
                {{ i18n.t('validation.runAi') }}
              </button>
              <button
                type="button"
                class="st-btn st-btn--sm st-btn--primary"
                (click)="openDecide(doc.key, true)"
              >
                {{ i18n.t('validation.validate') }}
              </button>
              <button type="button" class="st-btn st-btn--sm" (click)="openDecide(doc.key, false)">
                {{ i18n.t('validation.deny') }}
              </button>
            </div>
            @if (previewUrl() && previewing() === doc.ref!.fileAssetId) {
              <iframe title="preview" [src]="previewUrl()" class="st-preview"></iframe>
              <div class="st-actions">
                <button type="button" class="st-btn st-btn--sm" (click)="printPreview()">
                  {{ i18n.t('validation.print') }}
                </button>
              </div>
            }
            @if (runFor(doc.key); as run) {
              @if (run.degraded) {
                <st-alert tone="warning">{{ i18n.t('validation.aiUnavailable') }}</st-alert>
              }
              <p>
                {{ i18n.t('validation.aiOverall') }}: <strong>{{ run.overall }}</strong>
              </p>
              <ul class="st-checks">
                @for (c of run.checks; track c.key) {
                  <li>
                    <st-badge [label]="c.status" [tone]="checkTone(c.status)" />
                    <strong>{{ c.label }}</strong>
                    <span>{{ c.evidence }}</span>
                  </li>
                }
              </ul>
            }
            @if (decisionFor(doc.key); as dec) {
              <p>
                {{ i18n.t('validation.decision') }}: <strong>{{ dec.decision }}</strong>
                @if (dec.comment) {
                  <span> — {{ dec.comment }}</span>
                }
              </p>
            }
          } @else {
            <st-alert tone="info">{{ i18n.t('validation.docPending') }}</st-alert>
          }
        </section>
      }

      <section class="st-card" aria-label="receipt">
        <h2>{{ i18n.t('validation.receiptTitle') }}</h2>
        @if (detail()?.receipt; as r) {
          <p>{{ r.reference }} · {{ r.amount }} {{ r.currency }}</p>
          <div class="st-actions">
            <button type="button" class="st-btn st-btn--sm st-btn--primary" (click)="makeReceipt()">
              {{ i18n.t('validation.reprint') }}
            </button>
          </div>
        } @else {
          <p>{{ i18n.t('validation.receiptHint') }}</p>
          <button
            type="button"
            class="st-btn st-btn--primary"
            [disabled]="saving() || !canReceipt()"
            (click)="makeReceipt()"
          >
            {{ i18n.t('validation.generateReceipt') }}
          </button>
          @if (!canReceipt()) {
            <st-alert tone="info">{{ i18n.t('validation.receiptBlocked') }}</st-alert>
          }
        }
        @if (receiptError()) {
          <st-alert tone="error">{{ receiptError() }}</st-alert>
        }
      </section>
    }

    <st-dialog
      [open]="decideOpen()"
      [title]="i18n.t('validation.decideTitle')"
      (close)="decideOpen.set(false)"
    >
      <p>{{ i18n.t('validation.decideHint') }}</p>
      <label class="st-field">
        <span>{{ i18n.t('validation.commentLabel') }}</span>
        <textarea class="st-input" rows="3" [(ngModel)]="decideComment"></textarea>
      </label>
      @if (decideError()) {
        <st-alert tone="error">{{ decideError() }}</st-alert>
      }
      <div class="st-dialog__actions">
        <button type="button" class="st-btn" (click)="decideOpen.set(false)">
          {{ i18n.t('common.cancel') }}
        </button>
        <button
          type="button"
          class="st-btn st-btn--primary"
          [disabled]="saving()"
          (click)="confirmDecide()"
        >
          {{ i18n.t('common.save') }}
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
      .st-tasks,
      .st-checks {
        list-style: none;
        margin: 0.5rem 0 0;
        padding: 0;
        display: grid;
        gap: 0.375rem;
      }
      .st-checks li {
        display: flex;
        gap: 0.5rem;
        align-items: baseline;
        flex-wrap: wrap;
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
export class ValidationDetailComponent implements OnInit {
  private readonly service = inject(ValidationService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly verifying = signal<ValidationDocumentType | null>(null);
  readonly error = signal<string | null>(null);
  readonly receiptError = signal<string | null>(null);
  readonly detail = signal<ValidationDetail | null>(null);

  readonly previewUrl = signal<SafeResourceUrl | null>(null);
  readonly previewing = signal<string | null>(null);
  private previewObjectUrl: string | null = null;

  readonly decideOpen = signal(false);
  readonly decideError = signal<string | null>(null);
  decideComment = '';
  private decideTarget: { doc: ValidationDocumentType; approve: boolean } | null = null;

  private id(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  ngOnInit(): void {
    this.reload();
  }

  docs(d: ValidationDetail): { key: ValidationDocumentType; ref: ValidationDocumentRef | null }[] {
    return [
      { key: 'REPORT', ref: d.report },
      { key: 'JOURNAL', ref: d.journal },
    ];
  }

  runFor(doc: ValidationDocumentType) {
    const d = this.detail();
    if (!d) return null;
    return doc === 'REPORT' ? d.latestReportRun : d.latestJournalRun;
  }

  decisionFor(doc: ValidationDocumentType) {
    const d = this.detail();
    if (!d) return null;
    return doc === 'REPORT' ? d.reportDecision : d.journalDecision;
  }

  checkTone(s: string): BadgeTone {
    return CHECK_TONE[s] ?? 'neutral';
  }

  /** Receipt CTA is enabled only once both documents are manually validated. */
  canReceipt(): boolean {
    const d = this.detail();
    return (
      !!d &&
      (d.status === 'VALIDATED' || d.status === 'RECEIPT_ISSUED') &&
      d.reportDecision?.decision === 'VALIDATED' &&
      d.journalDecision?.decision === 'VALIDATED'
    );
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
        this.error.set(ValidationService.messageOf(e, 'Load failed'));
        this.loading.set(false);
      },
    });
  }

  runAi(doc: ValidationDocumentType): void {
    this.verifying.set(doc);
    this.service.verify(this.id(), doc).subscribe({
      next: (res) => {
        this.verifying.set(null);
        if (res.degraded) this.toast.show('warning', this.i18n.t('validation.aiUnavailable'));
        else this.toast.show('success', this.i18n.t('validation.aiDone'));
        this.reload();
      },
      error: (e) => {
        this.verifying.set(null);
        this.toast.show('error', ValidationService.messageOf(e, 'AI run failed'));
      },
    });
  }

  openDecide(doc: ValidationDocumentType, approve: boolean): void {
    this.decideTarget = { doc, approve };
    this.decideComment = '';
    this.decideError.set(null);
    this.decideOpen.set(true);
  }

  confirmDecide(): void {
    if (!this.decideTarget) return;
    const { doc, approve } = this.decideTarget;
    if (!approve && !this.decideComment.trim()) {
      this.decideError.set(this.i18n.t('validation.commentRequired'));
      return;
    }
    this.saving.set(true);
    this.service
      .decide(this.id(), doc, approve ? 'VALIDATED' : 'REJECTED', this.decideComment)
      .subscribe({
        next: (d) => {
          this.detail.set(d);
          this.saving.set(false);
          this.decideOpen.set(false);
          this.toast.show('success', this.i18n.t('validation.decisionSaved'));
        },
        error: (e) => {
          this.decideError.set(ValidationService.messageOf(e, 'Decision failed'));
          this.saving.set(false);
        },
      });
  }

  preview(ref: ValidationDocumentRef): void {
    this.service.download(this.id(), ref.documentType).subscribe({
      next: (blob) => {
        if (this.previewObjectUrl) URL.revokeObjectURL(this.previewObjectUrl);
        this.previewObjectUrl = URL.createObjectURL(blob);
        this.previewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.previewObjectUrl));
        this.previewing.set(ref.fileAssetId);
      },
      error: (e) => this.toast.show('error', ValidationService.messageOf(e, 'Download failed')),
    });
  }

  download(ref: ValidationDocumentRef): void {
    this.service.download(this.id(), ref.documentType).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = ref.title ?? `${ref.documentType}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      },
      error: (e) => this.toast.show('error', ValidationService.messageOf(e, 'Download failed')),
    });
  }

  printPreview(): void {
    if (!this.previewObjectUrl) return;
    const w = window.open(this.previewObjectUrl, '_blank');
    w?.addEventListener('load', () => w.print());
  }

  makeReceipt(): void {
    this.saving.set(true);
    this.receiptError.set(null);
    this.service.receipt(this.id()).subscribe({
      next: (r) => {
        this.saving.set(false);
        this.toast.show('success', `${this.i18n.t('validation.receiptDone')} · ${r.reference}`);
        this.reload();
      },
      error: (e) => {
        this.receiptError.set(ValidationService.messageOf(e, 'Receipt failed'));
        this.saving.set(false);
      },
    });
  }
}
