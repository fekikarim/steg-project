import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n.service';
import { RealtimeService } from '../../core/realtime.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../shared/ui/toast.service';
import { CandidatesService } from './candidates.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { DataTableComponent, type SortState } from '../../shared/ui/data-table.component';
import { PaginationComponent } from '../../shared/ui/pagination.component';
import { DateRangeComponent } from '../../shared/ui/date-range.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';

import { BadgeComponent, type BadgeTone } from '../../shared/ui/badge.component';
import { ConfirmDialogComponent } from '../../shared/ui/dialog.component';
import type {
  ApplicationStatus,
  CandidateQueueQuery,
  CandidateQueueRow,
  InternshipType,
} from '../../core/api-models';

/** Column key → backend sort property; the backend whitelists firstName/lastName/email/createdAt/updatedAt. */
const SORT_PROPERTY: Record<string, string> = {
  name: 'firstName',
  email: 'email',
  createdAt: 'createdAt',
};

/**
 * Candidates workspace list (AGENTS.md §5.1 for the Admin, §6.2 for the
 * Supervisor — same screen, server-side scope). Pagination, search, every
 * filter (type, supervisor, validation status, university, date range) and
 * sort run SERVER-side on `GET /api/candidates/manage`; the client renders
 * exactly one page and never filters the whole list locally. Deleting asks for
 * confirmation first and surfaces the backend 409
 * `CANDIDATE_HAS_DEPENDENCIES` (applications/tasks/receipts must go first).
 * The CIN never appears on this screen (absent from the row contract).
 */
@Component({
  selector: 'st-candidate-list',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    LiveStatusComponent,
    PageHeaderComponent,
    DataTableComponent,
    PaginationComponent,
    DateRangeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    BadgeComponent,
    ConfirmDialogComponent,
  ],
  template: `
    <st-page-header [title]="i18n.t('candidates.title')" [subtitle]="i18n.t('candidates.subtitle')">
      <st-live-status />
      <!-- Navigates directly to manual intake /applications/new which adds candidate + application with documents -->
      <a routerLink="/applications/new" class="st-btn st-btn--primary">
        {{ i18n.t('candidates.create') }}
      </a>
    </st-page-header>

    <section class="st-filters" [attr.aria-label]="i18n.t('table.filters')">
      <label class="st-field st-field--grow">
        <span class="st-field__label">{{ i18n.t('table.search') }}</span>
        <input
          type="search"
          class="st-input"
          [(ngModel)]="search"
          (keyup.enter)="onFilter()"
          [placeholder]="i18n.t('candidates.searchPlaceholder')"
          dir="auto"
        />
      </label>
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('table.status') }}</span>
        <select class="st-input" [(ngModel)]="status" (change)="onFilter()">
          <option value="">{{ i18n.t('table.all') }}</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
      </label>
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('candidates.type') }}</span>
        <select class="st-input" [(ngModel)]="type" (change)="onFilter()">
          <option value="">{{ i18n.t('table.all') }}</option>
          @for (t of types; track t) {
            <option [value]="t">{{ t }}</option>
          }
        </select>
      </label>
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('candidates.validationStatus') }}</span>
        <select class="st-input" [(ngModel)]="validation" (change)="onFilter()">
          <option value="">{{ i18n.t('table.all') }}</option>
          <option value="ACTIVE">{{ i18n.t('candidates.validationActive') }}</option>
          <option value="DISABLED">{{ i18n.t('candidates.validationDisabled') }}</option>
        </select>
      </label>
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('applications.university') }}</span>
        <select class="st-input" [(ngModel)]="university" (change)="onFilter()">
          <option value="">{{ i18n.t('table.all') }}</option>
          @for (u of universityOptions(); track u) {
            <option [value]="u">{{ u }}</option>
          }
        </select>
      </label>
      @if (canFilterSupervisors()) {
        <label class="st-field">
          <span class="st-field__label">{{ i18n.t('candidates.supervisor') }}</span>
          <select class="st-input" [(ngModel)]="supervisor" (change)="onFilter()">
            <option value="">{{ i18n.t('table.all') }}</option>
            @for (s of supervisorOptions(); track s.userId) {
              <option [value]="s.userId">{{ s.email }}</option>
            }
          </select>
        </label>
      }
      <st-date-range (apply)="onDates($event)" (reset)="onDates({ from: '', to: '' })" />
    </section>

    @if (error()) {
      <st-error-state
        [title]="i18n.t('common.error.title')"
        [body]="serverMessage() || i18n.t('common.error.body')"
        [retryLabel]="i18n.t('common.retry')"
        (retry)="load()"
      />
    } @else if (loading()) {
      <st-skeleton [rows]="8" />
    } @else if (rows().length === 0) {
      <st-empty-state [title]="i18n.t('common.empty.title')" [body]="i18n.t('common.empty.body')" />
    } @else {
      <st-data-table
        [columns]="columns"
        [sort]="sort()"
        [hasActions]="true"
        (sortChange)="onSort($event)"
      >
        @for (row of rows(); track row.id) {
          <tr>
            <td dir="auto">
              <a [routerLink]="['/candidates', row.id]" class="st-ref"
                >{{ row.firstName }} {{ row.lastName }}</a
              >
            </td>
            <td dir="ltr" data-priority="medium">{{ row.email }}</td>
            <td dir="auto" data-priority="medium">{{ row.universityName }}</td>
            <td data-priority="low">
              @if (row.applicationCount > 0) {
                <st-badge
                  [label]="row.applicationCount + ' · ' + (row.latestApplicationStatus ?? '')"
                  [tone]="statusTone(row.latestApplicationStatus)"
                />
              } @else {
                <st-badge [label]="i18n.t('candidates.notApplied')" tone="neutral" />
              }
            </td>
            <td data-priority="low" dir="ltr">{{ row.supervisorEmail || '—' }}</td>
            <td data-priority="low">
              @if (row.accountEnabled === null) {
                <st-badge [label]="i18n.t('candidates.noAccount')" tone="neutral" />
              } @else if (row.accountEnabled) {
                <st-badge [label]="i18n.t('common.active')" tone="success" />
              } @else {
                <st-badge [label]="i18n.t('common.disabled')" tone="neutral" />
              }
            </td>
            <td data-priority="low" dir="ltr">{{ row.createdAt.slice(0, 10) }}</td>
            <td>
              <span class="st-row__actions">
                <button type="button" class="st-btn st-btn--text" (click)="open(row.id)">
                  {{ i18n.t('common.view') }}
                </button>
                <button
                  type="button"
                  class="st-btn st-btn--text st-btn--danger-text"
                  (click)="askDelete(row)"
                >
                  {{ i18n.t('common.delete') }}
                </button>
              </span>
            </td>
          </tr>
        }
      </st-data-table>
      <st-pagination
        [page]="page()"
        [size]="size()"
        [totalPages]="totalPages()"
        (prev)="setPage(page() - 1)"
        (next)="setPage(page() + 1)"
        (sizeChange)="size.set($event); setPage(0)"
      />
    }


    <!-- Soft delete: confirmation first (§5 list rule), backend guard second. -->
    <st-confirm-dialog
      [open]="deleting() !== null"
      [title]="i18n.t('candidates.deleteTitle')"
      [body]="deleteBody()"
      [consequence]="i18n.t('candidates.deleteConsequence')"
      [confirmLabel]="i18n.t('common.delete')"
      [cancelLabel]="i18n.t('common.cancel')"
      [busy]="busy()"
      (confirmed)="submitDelete()"
      (cancel)="deleting.set(null)"
    />
  `,
  styles: [
    `
      .st-filters {
        display: flex;
        gap: 0.6rem;
        flex-wrap: wrap;
        align-items: flex-end;
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 0.7rem;
        padding: 0.8rem;
        margin-block-end: 0.8rem;
      }
      .st-field--grow {
        flex: 1;
        min-inline-size: 12rem;
      }
      .st-ref {
        font-weight: 600;
        color: var(--action-primary);
        text-decoration: none;
      }
      .st-ref:hover {
        text-decoration: underline;
      }
      .st-row__actions {
        display: flex;
        gap: 0.2rem;
        flex-wrap: wrap;
      }
      .st-btn--danger-text {
        color: var(--action-danger);
      }
    `,
  ],
})
export class CandidateListComponent implements OnInit, OnDestroy {
  readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly toast = inject(ToastService);
  private readonly service = inject(CandidatesService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly columns = [
    { key: 'name', label: 'Name', sortable: true, priority: 'high' as const },
    { key: 'email', label: 'Email', sortable: true, priority: 'high' as const },
    { key: 'universityName', label: 'University', sortable: false, priority: 'medium' as const },
    { key: 'applications', label: 'Applications', sortable: false, priority: 'medium' as const },
    { key: 'supervisor', label: 'Supervisor', sortable: false, priority: 'low' as const },
    { key: 'account', label: 'Account', sortable: false, priority: 'low' as const },
    { key: 'createdAt', label: 'Created', sortable: true, priority: 'low' as const },
  ];
  /** Explicit statuses only (AGENTS.md §4) — no ACCEPTED / NEEDS_CORRECTION. */
  readonly statuses: readonly ApplicationStatus[] = [
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'MODIFICATION_REQUESTED',
    'RESUBMITTED',
    'APPROVED',
    'REJECTED',
    'WITHDRAWN',
  ];
  readonly types: readonly InternshipType[] = ['OBSERVATION', 'PERFECTIONNEMENT', 'PFE'];

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal(false);
  readonly serverMessage = signal('');
  /** The current server-side page — never the whole list. */
  readonly rows = signal<readonly CandidateQueueRow[]>([]);
  readonly totalPages = signal(1);
  readonly universityOptions = signal<readonly string[]>([]);
  readonly supervisorOptions = signal<
    readonly { readonly userId: string; readonly email: string }[]
  >([]);
  readonly canFilterSupervisors = signal(false);

  search = '';
  status = '';
  type = '';
  validation = '';
  university = '';
  supervisor = '';
  readonly page = signal(0);
  readonly size = signal(20);
  readonly sort = signal<SortState | null>({ key: 'createdAt', direction: 'desc' });
  private dates = { from: '', to: '' };

  readonly deleting = signal<CandidateQueueRow | null>(null);

  ngOnInit(): void {
    this.crumbs.set([{ labelKey: 'nav.candidates', labelFallback: 'Candidates' }]);
    this.canFilterSupervisors.set(this.auth.hasPermission('USER_MANAGE'));
    // Dashboard drill-down wins over defaults: /candidates?from=YYYY-MM-DD
    // (new candidates). Malformed dates are ignored (never sent).
    const from = this.route.snapshot.queryParamMap.get('from');
    const to = this.route.snapshot.queryParamMap.get('to');
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) this.dates.from = from;
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) this.dates.to = to;
    this.service.universities().subscribe({
      next: (rows) => {
        this.universityOptions.set(rows.map((u) => u.name).sort());
      },
      error: () => {
        this.universityOptions.set([]);
      },
    });
    if (this.canFilterSupervisors()) {
      this.service.supervisors().subscribe({
        next: (rows) =>
          this.supervisorOptions.set(rows.map((s) => ({ userId: s.userId, email: s.email }))),
        error: () => this.supervisorOptions.set([]),
      });
    }
    this.load();
    this.realtime.candidateUpdates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  ngOnDestroy(): void {}

  /** One server round-trip per page/filter/sort change. */
  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.serverMessage.set('');
    const sort = this.sort();
    const property = sort ? SORT_PROPERTY[sort.key] : undefined;
    const query: CandidateQueueQuery = {
      page: this.page(),
      size: this.size(),
      sort: property ? `${property},${sort?.direction ?? 'desc'}` : undefined,
      q: this.search.trim() || undefined,
      status: (this.status || undefined) as ApplicationStatus | undefined,
      type: (this.type || undefined) as InternshipType | undefined,
      validation: (this.validation || undefined) as 'ACTIVE' | 'DISABLED' | undefined,
      university: this.university || undefined,
      supervisor: this.supervisor || undefined,
      from: this.dates.from || undefined,
      to: this.dates.to || undefined,
    };
    this.service.search(query).subscribe({
      next: (page) => {
        this.rows.set(page.content);
        this.totalPages.set(Math.max(1, page.totalPages));
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.error.set(true);
        this.serverMessage.set(CandidatesService.messageOf(e, ''));
        this.loading.set(false);
      },
    });
  }

  onFilter(): void {
    this.page.set(0);
    this.load();
  }

  onDates(range: { from: string; to: string }): void {
    this.dates = range;
    this.page.set(0);
    this.load();
  }

  onSort(sort: SortState): void {
    this.sort.set(sort);
    this.page.set(0);
    this.load();
  }

  setPage(page: number): void {
    this.page.set(Math.max(0, page));
    this.load();
  }

  open(id: string): void {
    void this.router.navigate(['/candidates', id]);
  }

  statusTone(status: ApplicationStatus | null): BadgeTone {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
      case 'WITHDRAWN':
        return 'error';
      case 'MODIFICATION_REQUESTED':
      case 'DRAFT':
        return 'warning';
      case 'UNDER_REVIEW':
      case 'SUBMITTED':
      case 'RESUBMITTED':
        return 'info';
      default:
        return 'neutral';
    }
  }


  /* ---------------- delete (§5.1 soft delete + confirmation) ---------------- */

  askDelete(row: CandidateQueueRow): void {
    this.deleting.set(row);
  }

  deleteBody(): string {
    const target = this.deleting();
    return this.i18n.t('candidates.deleteBody', {
      name: `${target?.firstName ?? ''} ${target?.lastName ?? ''}`.trim(),
    });
  }

  submitDelete(): void {
    const target = this.deleting();
    if (!target) return;
    this.busy.set(true);
    this.service.remove(target.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.deleting.set(null);
        this.toast.show('success', this.i18n.t('candidates.deleted'));
        this.load();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.deleting.set(null);
        // 409 CANDIDATE_HAS_DEPENDENCIES: applications/tasks/receipts must go first.
        const message = CandidatesService.isDependencyConflict(e)
          ? this.i18n.t('candidates.hasDependencies')
          : CandidatesService.messageOf(e, this.i18n.t('common.error.body'));
        this.toast.show('error', message);
      },
    });
  }
}
