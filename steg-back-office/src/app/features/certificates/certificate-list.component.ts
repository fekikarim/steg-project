import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n.service';
import { ToastService } from '../../shared/ui/toast.service';
import { CertificatesService } from './certificates.service';
import { ValidationService } from '../validation/validation.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { PaginationComponent } from '../../shared/ui/pagination.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import { BadgeComponent, type BadgeTone } from '../../shared/ui/badge.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { DialogComponent, ConfirmDialogComponent } from '../../shared/ui/dialog.component';
import type { CertificateRow, CertificateStatus } from '../../core/api-models';

const STATUS_TONE: Record<string, BadgeTone> = {
  GENERATED: 'success',
  REVOKED: 'neutral',
};

/**
 * Certificates workspace list (AGENTS.md §5.7, Admin only). Pagination,
 * search and the status filter run SERVER-side on `GET /api/certificates`;
 * the client renders exactly one page. Generate targets a VALIDATED
 * internship (picked from the validation queue); edit regenerates the PDF
 * as a new version (reference stable); delete is a confirmed REVOKED soft
 * delete; every row links to the detail workspace.
 */
@Component({
  selector: 'st-certificate-list',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    LiveStatusComponent,
    PageHeaderComponent,
    PaginationComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    BadgeComponent,
    AlertComponent,
    DialogComponent,
    ConfirmDialogComponent,
  ],
  template: `
    <st-page-header
      [title]="i18n.t('certificates.title')"
      [subtitle]="i18n.t('certificates.subtitle')"
    >
      <st-live-status />
      <button type="button" class="st-btn st-btn--primary" (click)="openGenerate()">
        {{ i18n.t('certificates.generate') }}
      </button>
    </st-page-header>

    <div class="st-toolbar" role="search">
      <input
        type="search"
        class="st-input"
        [placeholder]="i18n.t('certificates.searchPh')"
        [(ngModel)]="search"
        (ngModelChange)="onFilterChange()"
      />
      <select class="st-input" [(ngModel)]="status" (ngModelChange)="onFilterChange()">
        <option value="">{{ i18n.t('certificates.allStatuses') }}</option>
        @for (s of statuses; track s) {
          <option [value]="s">{{ s }}</option>
        }
      </select>
    </div>

    @if (loading()) {
      <st-skeleton [rows]="6" />
    } @else if (error()) {
      <st-error-state
        [title]="i18n.t('common.error.title')"
        [body]="error()!"
        [retryLabel]="i18n.t('common.retry')"
        (retry)="reload()"
      />
    } @else if (rows().length === 0) {
      <st-empty-state [title]="i18n.t('certificates.empty')" [body]="''" />
    } @else {
      <ul class="st-queue">
        @for (r of rows(); track r.id) {
          <li class="st-row">
            <div class="st-row__body">
              <a [routerLink]="['/certificates', r.id]">
                <strong>{{ r.candidateName }}</strong>
              </a>
              <span class="st-row__ref">{{ r.reference }} · v{{ r.versionNumber }}</span>
              <span class="st-row__meta">{{ r.universityName }} · {{ r.internshipType }}</span>
            </div>
            <st-badge [label]="r.status" [tone]="tone(r.status)" />
            <button type="button" class="st-btn st-btn--sm st-btn--danger" (click)="askDelete(r)">
              {{ i18n.t('certificates.delete') }}
            </button>
          </li>
        }
      </ul>
      <st-pagination
        [page]="page()"
        [size]="20"
        [totalPages]="totalPages()"
        (prev)="onPage(page() - 1)"
        (next)="onPage(page() + 1)"
      />
    }

    <!-- generate for a VALIDATED internship -->
    <st-dialog
      [open]="generateOpen()"
      [title]="i18n.t('certificates.generateTitle')"
      (close)="generateOpen.set(false)"
    >
      <p>{{ i18n.t('certificates.generateHint') }}</p>
      <label class="st-field">
        <span>{{ i18n.t('certificates.internshipLabel') }}</span>
        <select class="st-input" [(ngModel)]="generateInternship">
          <option value="">{{ i18n.t('certificates.pickInternship') }}</option>
          @for (o of eligible(); track o.internshipId) {
            <option [value]="o.internshipId">{{ o.candidateName }} · {{ o.reference }}</option>
          }
        </select>
      </label>
      @if (formError()) {
        <st-alert tone="error">{{ formError() }}</st-alert>
      }
      <div class="st-dialog__actions">
        <button type="button" class="st-btn" (click)="generateOpen.set(false)">
          {{ i18n.t('common.cancel') }}
        </button>
        <button
          type="button"
          class="st-btn st-btn--primary"
          [disabled]="saving()"
          (click)="confirmGenerate()"
        >
          {{ i18n.t('certificates.generate') }}
        </button>
      </div>
    </st-dialog>

    <st-confirm-dialog
      [open]="deleteOpen()"
      [title]="i18n.t('certificates.deleteTitle')"
      [body]="i18n.t('certificates.deleteHint')"
      (cancel)="deleteOpen.set(false)"
      (confirmed)="confirmDelete()"
    />
  `,
  styles: [
    `
      .st-toolbar {
        display: flex;
        gap: 0.75rem;
        margin: 1rem 0;
      }
      .st-queue {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.5rem;
      }
      .st-row {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        border: 1px solid var(--st-border, #e3e8ef);
        border-radius: 0.75rem;
        padding: 0.75rem 1rem;
      }
      .st-row__body {
        flex: 1;
        display: flex;
        gap: 0.75rem;
        align-items: baseline;
        flex-wrap: wrap;
      }
      .st-row__ref {
        font-variant-numeric: tabular-nums;
        opacity: 0.75;
      }
      .st-row__meta {
        opacity: 0.75;
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
export class CertificateListComponent implements OnInit {
  private readonly service = inject(CertificatesService);
  private readonly route = inject(ActivatedRoute);
  private readonly validation = inject(ValidationService);
  readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  readonly statuses: CertificateStatus[] = ['GENERATED', 'REVOKED'];
  search = '';
  status: '' | CertificateStatus = '';

  readonly page = signal(0);
  readonly totalPages = signal(1);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly rows = signal<readonly CertificateRow[]>([]);

  readonly generateOpen = signal(false);
  readonly formError = signal<string | null>(null);
  generateInternship = '';
  readonly eligible = signal<{ internshipId: string; reference: string; candidateName: string }[]>(
    [],
  );

  readonly deleteOpen = signal(false);
  private deleteTarget: CertificateRow | null = null;

  ngOnInit(): void {
    // Dashboard drill-down wins over defaults: /certificates?status=GENERATED.
    // Unknown values are ignored (never sent) — the backend owns the vocabulary.
    const preset = this.route.snapshot.queryParamMap.get('status');
    if (preset && (this.statuses as readonly string[]).includes(preset)) {
      this.status = preset as CertificateStatus;
    }
    this.reload();
  }

  tone(s: string): BadgeTone {
    return STATUS_TONE[s] ?? 'neutral';
  }

  onFilterChange(): void {
    this.page.set(0);
    this.reload();
  }

  onPage(p: number): void {
    this.page.set(p);
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service
      .search({
        page: this.page(),
        size: 20,
        q: this.search.trim() || undefined,
        status: this.status || undefined,
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.content ?? []);
          this.totalPages.set(Math.max(1, res.totalPages ?? 1));
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(CertificatesService.messageOf(e, 'Load failed'));
          this.loading.set(false);
        },
      });
  }

  openGenerate(): void {
    this.generateInternship = '';
    this.formError.set(null);
    this.generateOpen.set(true);
    // Eligible = VALIDATED internships from the validation queue (server-scoped).
    this.validation.queue({ page: 0, size: 50, statuses: ['VALIDATED'] }).subscribe({
      next: (res) =>
        this.eligible.set(
          (res.content ?? []).map((r) => ({
            internshipId: r.internshipId,
            reference: r.reference,
            candidateName: r.candidateName,
          })),
        ),
      error: (e) => this.formError.set(CertificatesService.messageOf(e, 'Load failed')),
    });
  }

  confirmGenerate(): void {
    if (!this.generateInternship) {
      this.formError.set(this.i18n.t('certificates.internshipRequired'));
      return;
    }
    this.saving.set(true);
    this.service.generate(this.generateInternship).subscribe({
      next: () => {
        this.toast.show('success', this.i18n.t('certificates.generated'));
        this.saving.set(false);
        this.generateOpen.set(false);
        this.reload();
      },
      error: (e) => {
        this.formError.set(CertificatesService.messageOf(e, 'Generate failed'));
        this.saving.set(false);
      },
    });
  }

  askDelete(r: CertificateRow): void {
    this.deleteTarget = r;
    this.deleteOpen.set(true);
  }

  confirmDelete(): void {
    if (!this.deleteTarget) return;
    this.service.remove(this.deleteTarget.id).subscribe({
      next: () => {
        this.toast.show('success', this.i18n.t('certificates.deleted'));
        this.deleteOpen.set(false);
        this.reload();
      },
      error: (e) => {
        this.toast.show('error', CertificatesService.messageOf(e, 'Delete failed'));
        this.deleteOpen.set(false);
      },
    });
  }
}
