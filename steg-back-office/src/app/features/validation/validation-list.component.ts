import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n.service';
import { ToastService } from '../../shared/ui/toast.service';
import { ValidationService } from './validation.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { PaginationComponent } from '../../shared/ui/pagination.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import { BadgeComponent, type BadgeTone } from '../../shared/ui/badge.component';

const STATUS_TONE: Record<string, BadgeTone> = {
  REPORT_SUBMITTED: 'warning',
  UNDER_VALIDATION: 'info',
  VALIDATED: 'success',
  RECEIPT_ISSUED: 'neutral',
};

const STATUSES = ['REPORT_SUBMITTED', 'UNDER_VALIDATION', 'VALIDATED', 'RECEIPT_ISSUED'];

/**
 * Validation queue (AGENTS.md §5.11 step 1, Admin only). Pagination, search
 * and every filter (status, supervisor, university, type) run SERVER-side on
 * `GET /api/internship-validation/queue`; the client renders exactly one page.
 * Each row deep-links to the detail workspace.
 */
@Component({
  selector: 'st-validation-list',
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
  ],
  template: `
    <st-page-header [title]="i18n.t('validation.title')" [subtitle]="i18n.t('validation.subtitle')">
      <st-live-status />
    </st-page-header>

    <div class="st-toolbar" role="search">
      <input
        type="search"
        class="st-input"
        [placeholder]="i18n.t('validation.searchPh')"
        [(ngModel)]="search"
        (ngModelChange)="onFilterChange()"
      />
      <select class="st-input" [(ngModel)]="status" (ngModelChange)="onFilterChange()">
        <option value="">{{ i18n.t('validation.allStatuses') }}</option>
        @for (s of statuses; track s) {
          <option [value]="s">{{ s }}</option>
        }
      </select>
      <select class="st-input" [(ngModel)]="type" (ngModelChange)="onFilterChange()">
        <option value="">{{ i18n.t('validation.allTypes') }}</option>
        <option value="OBSERVATION">OBSERVATION</option>
        <option value="PERFECTIONNEMENT">PERFECTIONNEMENT</option>
        <option value="PFE">PFE</option>
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
      <st-empty-state [title]="i18n.t('validation.empty')" [body]="''" />
    } @else {
      <ul class="st-queue">
        @for (r of rows(); track r.internshipId) {
          <li class="st-row">
            <div class="st-row__body">
              <a [routerLink]="['/validation', r.internshipId]">
                <strong>{{ r.candidateName }}</strong>
              </a>
              <span class="st-row__ref">{{ r.reference }}</span>
              <span class="st-row__meta">{{ r.universityName }} · {{ r.type }}</span>
            </div>
            <st-badge [label]="r.status" [tone]="tone(r.status)" />
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
    `,
  ],
})
export class ValidationListComponent implements OnInit {
  private readonly service = inject(ValidationService);
  private readonly route = inject(ActivatedRoute);
  readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  readonly statuses = STATUSES;
  search = '';
  status = '';
  type = '';

  readonly page = signal(0);
  readonly totalPages = signal(1);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly rows = signal<readonly import('../../core/api-models').ValidationQueueRow[]>([]);

  ngOnInit(): void {
    // Dashboard drill-down wins over defaults: /validation?status=REPORT_SUBMITTED.
    // Unknown values are ignored (never sent) — the backend owns the vocabulary.
    const preset = this.route.snapshot.queryParamMap.get('status');
    if (preset && (this.statuses as readonly string[]).includes(preset)) {
      this.status = preset;
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
      .queue({
        page: this.page(),
        size: 20,
        q: this.search.trim() || undefined,
        statuses: this.status ? [this.status] : undefined,
        type: this.type || undefined,
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.content ?? []);
          this.totalPages.set(Math.max(1, res.totalPages ?? 1));
          this.loading.set(false);
        },
        error: (e) => {
          this.error.set(ValidationService.messageOf(e, 'Load failed'));
          this.loading.set(false);
          this.toast.show('error', ValidationService.messageOf(e, 'Load failed'));
        },
      });
  }
}
