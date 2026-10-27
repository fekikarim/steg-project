import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, catchError, map } from 'rxjs';
import { I18nService } from '../../core/i18n.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { AuthService } from '../../core/auth.service';
import { ApiClient } from '../../core/api-client.service';
import { RealtimeService } from '../../core/realtime.service';
import { InternshipService, activeAssignment } from './internship.service';
import { readRememberedSupervisor, rememberSupervisor } from './supervisor-scope';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { BadgeComponent, type BadgeTone } from '../../shared/ui/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import { StIconComponent } from '../../shared/ui/icon.component';
import { DialogComponent } from '../../shared/ui/dialog.component';
import {
  DataTableComponent,
  type SortState,
  type TableColumn,
} from '../../shared/ui/data-table.component';
import { PaginationComponent } from '../../shared/ui/pagination.component';
import type { CandidateDetail, InternshipDetail } from '../../core/api-models';

interface SupervisedRow extends InternshipDetail {
  supervisorName: string;
  departmentName: string;
  tasksDone: number;
  tasksPending: number;
  journalPending: number;
  journalTotal: number;
  hasFinalEvaluation: boolean;
  /** Finance case id for receipt tracking (null = no case opened yet). */
  financeCaseId: string | null;
  financeStatus: string | null;
  receiptReference: string | null;
  endsSoon: boolean;
  needsAttention: boolean;
}

const ENDS_SOON_DAYS = 14;

/**
 * Supervisor dashboard: assigned interns (candidates) with live progress —
 * tasks done/pending, journal reviews, evaluation state, validation status
 * and third-party receipt status. Scope is the explicitly chosen supervisor
 * name (remembered per device); ADMIN sees every assignment with attention
 * flags. All figures come from backend reads and refresh on realtime
 * domain events — nothing is invented client-side.
 */
@Component({
  selector: 'st-supervisor-dashboard',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    LiveStatusComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    StIconComponent,
    DialogComponent,
    DataTableComponent,
    PaginationComponent,
  ],
  template: `
    <st-page-header [title]="i18n.t('supervisor.title')" [subtitle]="i18n.t('supervisor.subtitle')">
      <st-live-status />
      <a routerLink="/internships" class="st-btn st-btn--secondary">{{
        i18n.t('supervisor.allInternships')
      }}</a>
    </st-page-header>

    <section class="st-filters" [attr.aria-label]="i18n.t('table.filters')">
      <label class="st-field st-field--grow">
        <span class="st-field__label">{{ i18n.t('internships.supervisor') }}</span>
        <select class="st-input" [(ngModel)]="scope" (change)="onScopeChange()">
          @if (!isSupervisorOnly()) {
            <option value="">{{ i18n.t('table.all') }}</option>
          }
          @for (name of supervisorOptions(); track name) {
            <option [value]="name">{{ name }}</option>
          }
        </select>
      </label>
      <div class="st-seg" role="group" [attr.aria-label]="i18n.t('supervisor.triage')">
        <button
          type="button"
          class="st-seg__btn"
          [class.st-seg__btn--on]="view() === 'all'"
          [attr.aria-pressed]="view() === 'all'"
          (click)="setView('all')"
        >
          {{ i18n.t('supervisor.allRows') }}
          <span class="st-seg__n">{{ rows().length }}</span>
        </button>
        <button
          type="button"
          class="st-seg__btn"
          [class.st-seg__btn--on]="view() === 'attention'"
          [attr.aria-pressed]="view() === 'attention'"
          (click)="setView('attention')"
        >
          <st-icon name="alert" [size]="14" />
          {{ i18n.t('supervisor.actionRequired') }}
          <span class="st-seg__n">{{ attention().length }}</span>
        </button>
      </div>
      @if (isSupervisorOnly()) {
        <p class="st-hint">{{ i18n.t('internships.myInternsHint') }}</p>
      }
    </section>

    @if (error()) {
      <st-error-state
        [title]="i18n.t('common.error.title')"
        [body]="i18n.t('common.error.body')"
        [retryLabel]="i18n.t('common.retry')"
        (retry)="load()"
      />
    } @else if (loading()) {
      <st-skeleton [rows]="8" />
    } @else if (rows().length === 0) {
      <st-empty-state [title]="i18n.t('common.empty.title')" [body]="i18n.t('common.empty.body')" />
    } @else {
      <section class="st-kpis" aria-label="kpis">
        <div class="st-kpi">
          <span class="st-kpi__n">{{ rows().length }}</span>
          <span class="st-kpi__l">{{ i18n.t('supervisor.assigned') }}</span>
        </div>
        <div class="st-kpi">
          <span class="st-kpi__n">{{ activeCount() }}</span>
          <span class="st-kpi__l">{{ i18n.t('supervisor.active') }}</span>
        </div>
        <div class="st-kpi">
          <span class="st-kpi__n">{{ pendingTasks() }}</span>
          <span class="st-kpi__l">{{ i18n.t('supervisor.tasksPending') }}</span>
        </div>
        <div class="st-kpi">
          <span class="st-kpi__n">{{ pendingJournal() }}</span>
          <span class="st-kpi__l">{{ i18n.t('supervisor.journalPending') }}</span>
        </div>
        <div class="st-kpi">
          <span class="st-kpi__n">{{ awaitingEvaluation() }}</span>
          <span class="st-kpi__l">{{ i18n.t('supervisor.awaitingEvaluation') }}</span>
        </div>
        <div class="st-kpi">
          <span class="st-kpi__n">{{ endingSoon() }}</span>
          <span class="st-kpi__l">{{ i18n.t('supervisor.endingSoon') }}</span>
        </div>
        <div class="st-kpi">
          <span class="st-kpi__n">{{ receiptsIssued() }}</span>
          <span class="st-kpi__l">{{ i18n.t('supervisor.receiptsIssued') }}</span>
        </div>
        <div class="st-kpi">
          <span class="st-kpi__n">{{ receiptsPending() }}</span>
          <span class="st-kpi__l">{{ i18n.t('supervisor.receiptsPending') }}</span>
        </div>
      </section>

      @if (attention().length > 0) {
        <p class="st-hint">{{ i18n.t('supervisor.attentionHint') }}</p>
      }

      <st-data-table
        [columns]="columns()"
        [sort]="sort()"
        [hasActions]="true"
        (sortChange)="onSort($event)"
      >
        @for (row of paged(); track row.id) {
          <tr [class.st-row--attn]="row.needsAttention">
            <td dir="auto">
              <div class="st-cell">
                <span class="st-cell__name">
                  <button type="button" class="st-ref st-ref--btn" (click)="openCandidate(row)">
                    {{ row.candidateFullName }}
                  </button>
                  <st-badge [label]="row.type" tone="neutral" />
                </span>
                <span class="st-sub2" dir="auto">{{ row.reference }}</span>
                @if (row.needsAttention) {
                  <span class="st-flag" [attr.title]="attentionReason(row)">
                    <st-badge
                      [label]="i18n.t('supervisor.actionRequired')"
                      tone="warning"
                      icon="alert"
                    />
                  </span>
                }
              </div>
            </td>
            <td><st-badge [label]="row.status" [tone]="statusTone(row.status)" /></td>
            <td dir="ltr" data-priority="medium">
              <span class="st-cell st-cell--period">
                <span>{{ row.startDate }}</span>
                <span class="st-sub2">&rarr; {{ row.endDate }}</span>
              </span>
            </td>
            <td>
              <span class="st-ratio"
                >{{ row.tasksDone }} / {{ row.tasksDone + row.tasksPending }}</span
              >
              @if (row.tasksPending > 0) {
                <st-badge [label]="openTasksLabel(row.tasksPending)" tone="info" />
              }
            </td>
            <td>
              <span class="st-ratio"
                >{{ row.journalTotal - row.journalPending }} / {{ row.journalTotal }}</span
              >
              @if (row.journalPending > 0) {
                <st-badge [label]="reviewLabel(row.journalPending)" tone="warning" />
              }
            </td>
            <td>
              @if (row.hasFinalEvaluation) {
                <st-badge [label]="i18n.t('common.yes')" tone="success" />
              } @else if (row.status === 'VALIDATED') {
                <st-badge [label]="i18n.t('supervisor.evaluationMissing')" tone="error" />
              } @else {
                <st-badge [label]="i18n.t('common.no')" tone="neutral" />
              }
            </td>
            <td data-priority="low">
              @if (row.financeCaseId; as caseId) {
                @if (row.receiptReference) {
                  <a [routerLink]="['/finance', caseId]" class="st-ref" dir="ltr">
                    {{ row.receiptReference }}
                  </a>
                  @if (row.financeStatus; as fs) {
                    <span class="st-sub2">
                      <st-badge [label]="fs" [tone]="financeTone(fs)" />
                    </span>
                  }
                } @else {
                  @if (row.financeStatus; as fs) {
                    <a [routerLink]="['/finance', caseId]" class="st-ref" dir="ltr">
                      <st-badge [label]="fs" [tone]="financeTone(fs)" />
                    </a>
                  }
                }
              } @else {
                <span class="st-sub2">{{ i18n.t('supervisor.noReceipt') }}</span>
              }
            </td>
            <td class="st-actions-cell">
              <a [routerLink]="['/internships', row.id]" class="st-btn st-btn--text">{{
                i18n.t('common.view')
              }}</a>
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
        (sizeChange)="setSize($event)"
      />

      <!-- Candidate info (read-only supporting info for validation) -->
      <st-dialog
        [open]="candidateOpen()"
        [title]="i18n.t('supervisor.candidateInfo')"
        (close)="candidateOpen.set(false)"
      >
        @if (candidateLoading()) {
          <st-skeleton [rows]="5" />
        } @else if (candidate(); as c) {
          <dl class="st-defs">
            <div>
              <dt>{{ i18n.t('candidateDetail.identity') }}</dt>
              <dd dir="auto">{{ c.firstName }} {{ c.lastName }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('dossier.email') }}</dt>
              <dd dir="ltr">{{ c.email }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('dossier.phone') }}</dt>
              <dd dir="ltr">{{ c.phone || '—' }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('dossier.birthDate') }}</dt>
              <dd dir="ltr">{{ c.birthDate || '—' }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('dossier.university') }}</dt>
              <dd dir="auto">{{ c.universityName }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('dossier.speciality') }}</dt>
              <dd dir="auto">{{ c.speciality || '—' }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('dossier.diploma') }}</dt>
              <dd dir="auto">{{ c.diploma || '—' }}</dd>
            </div>
            @if (c.skills) {
              <div>
                <dt>{{ i18n.t('candidateDetail.skills') }}</dt>
                <dd dir="auto">{{ c.skills }}</dd>
              </div>
            }
            @if (c.languages) {
              <div>
                <dt>{{ i18n.t('candidateDetail.languages') }}</dt>
                <dd dir="auto">{{ c.languages }}</dd>
              </div>
            }
          </dl>
          <p class="st-hint">{{ i18n.t('supervisor.candidateReadOnly') }}</p>
        } @else {
          <st-empty-state
            [title]="i18n.t('common.empty.title')"
            [body]="i18n.t('common.empty.body')"
          />
        }
        <div slot="footer" class="st-dialog__actions">
          <button type="button" class="st-btn st-btn--secondary" (click)="candidateOpen.set(false)">
            {{ i18n.t('common.close') }}
          </button>
        </div>
      </st-dialog>
    }
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
      .st-hint {
        font-size: 0.78rem;
        color: var(--text-secondary);
        flex-basis: 100%;
        margin: 0;
      }
      .st-kpis {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
        gap: 0.6rem;
        margin-block-end: 0.8rem;
      }
      .st-kpi {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 0.7rem;
        padding: 0.7rem 0.8rem;
        display: grid;
        gap: 0.15rem;
      }
      .st-kpi__n {
        font-size: 1.4rem;
        font-weight: 700;
      }
      .st-kpi__l {
        font-size: 0.75rem;
        color: var(--text-secondary);
      }
      .st-seg {
        display: inline-flex;
        padding: 0.2rem;
        gap: 0.2rem;
        background: var(--bg-subtle);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius);
      }
      .st-seg__btn {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.35rem 0.6rem;
        border: 1px solid transparent;
        border-radius: calc(var(--radius) - 0.15rem);
        background: none;
        color: var(--text-secondary);
        font: inherit;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition:
          background-color 0.15s ease,
          color 0.15s ease,
          box-shadow 0.15s ease;
      }
      .st-seg__btn:hover {
        color: var(--text-primary);
      }
      .st-seg__btn--on {
        background: var(--bg-surface);
        color: var(--text-primary);
        border-color: var(--border-subtle);
        box-shadow: var(--shadow-sm);
      }
      .st-seg__btn--on st-icon {
        color: var(--status-warning);
      }
      .st-seg__btn:focus-visible {
        outline: 2px solid var(--action-primary);
        outline-offset: 1px;
      }
      .st-seg__n {
        min-inline-size: 1.35rem;
        padding: 0.05rem 0.35rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--text-muted) 18%, transparent);
        color: var(--text-secondary);
        font-size: 0.7rem;
        font-variant-numeric: tabular-nums;
        text-align: center;
      }
      .st-seg__btn--on .st-seg__n {
        background: var(--brand-primary-soft);
        color: var(--brand-primary-strong);
      }
      .st-cell {
        display: grid;
        gap: 0.15rem;
        justify-items: start;
        min-inline-size: 9rem;
      }
      .st-cell__name {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.15rem 0.4rem;
        min-inline-size: 0;
      }
      .st-cell__name .st-ref {
        white-space: nowrap;
      }
      .st-cell--period {
        min-inline-size: 0;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
      .st-flag {
        display: inline-flex;
        margin-block-start: 0.15rem;
        cursor: help;
      }
      .st-actions-cell {
        padding-inline: 0.45rem;
        white-space: nowrap;
      }
      .st-ratio {
        display: inline-block;
        min-inline-size: 2.3rem;
        font-variant-numeric: tabular-nums;
      }
      .st-ref {
        font-weight: 600;
        color: var(--action-primary);
        text-decoration: none;
      }
      .st-ref:hover {
        text-decoration: underline;
      }
      .st-ref--btn {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        font: inherit;
        text-align: start;
      }
      .st-defs {
        display: grid;
        gap: 0.5rem;
        margin: 0;
      }
      .st-defs div {
        display: grid;
        grid-template-columns: 9rem 1fr;
        gap: 0.5rem;
        font-size: 0.84rem;
      }
      .st-defs dt {
        color: var(--text-muted);
      }
      .st-defs dd {
        margin: 0;
        overflow-wrap: anywhere;
      }
      .st-dialog__actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
      }
      .st-sub2 {
        display: block;
        font-size: 0.72rem;
        color: var(--text-muted);
      }
      .st-row--attn td {
        background: color-mix(in srgb, var(--status-warning) 8%, transparent);
      }
      .st-row--attn td:first-child {
        border-inline-start: 3px solid var(--status-warning);
      }
      .st-row--attn:hover td,
      .st-table tbody tr.st-row--attn:hover td {
        background: color-mix(in srgb, var(--status-warning) 14%, transparent);
      }
    `,
  ],
})
export class SupervisorDashboardComponent implements OnInit {
  readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly api = inject(ApiClient);
  private readonly service = inject(InternshipService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly scope = signal('');
  readonly supervisorOptions = signal<readonly string[]>([]);
  private readonly all = signal<readonly SupervisedRow[]>([]);
  private readonly candidateCache = new Map<string, CandidateDetail>();

  /** Candidate info dialog (read-only; CIN never rendered here). */
  readonly candidateOpen = signal(false);
  readonly candidateLoading = signal(false);
  readonly candidate = signal<CandidateDetail | null>(null);

  readonly rows = computed(() => {
    const scope = this.scope();
    const rows = [...this.all()];
    if (scope) return rows.filter((r) => r.supervisorName === scope);
    return rows;
  });
  readonly columns = computed<readonly TableColumn[]>(() => [
    { key: 'candidate', label: this.i18n.t('supervisor.intern'), sortable: true, priority: 'high' },
    { key: 'status', label: this.i18n.t('table.status'), sortable: true, priority: 'high' },
    {
      key: 'period',
      label: this.i18n.t('internshipDetail.period'),
      sortable: true,
      priority: 'medium',
    },
    { key: 'tasks', label: this.i18n.t('supervisor.tasks'), sortable: true, priority: 'high' },
    { key: 'journal', label: this.i18n.t('supervisor.journal'), sortable: true, priority: 'high' },
    {
      key: 'evaluation',
      label: this.i18n.t('supervisor.evaluation'),
      sortable: true,
      priority: 'high',
    },
    { key: 'receipt', label: this.i18n.t('supervisor.receipt'), priority: 'low' },
  ]);
  readonly page = signal(0);
  readonly size = signal(20);
  readonly sort = signal<SortState | null>({ key: 'flag', direction: 'desc' });
  readonly view = signal<'all' | 'attention'>('all');
  readonly activeCount = computed(() => this.rows().filter((r) => r.status === 'IN_PROGRESS').length);
  readonly pendingTasks = computed(() => this.rows().reduce((n, r) => n + r.tasksPending, 0));
  readonly pendingJournal = computed(() => this.rows().reduce((n, r) => n + r.journalPending, 0));
  readonly awaitingEvaluation = computed(
    () => this.rows().filter((r) => r.status === 'VALIDATED' && !r.hasFinalEvaluation).length,
  );
  readonly endingSoon = computed(() => this.rows().filter((r) => r.endsSoon).length);
  readonly receiptsIssued = computed(() => this.rows().filter((r) => r.receiptReference).length);
  readonly receiptsPending = computed(
    () => this.rows().filter((r) => r.financeCaseId && !r.receiptReference).length,
  );
  readonly attention = computed(() => this.rows().filter((r) => r.needsAttention));
  readonly filtered = computed(() => {
    const source = this.view() === 'attention' ? this.attention() : this.rows();
    const sort = this.sort();
    if (!sort) return source;
    const dir = sort.direction === 'desc' ? -1 : 1;
    return [...source].sort((a, b) => {
      const primary = compareValues(this.sortValue(a, sort.key), this.sortValue(b, sort.key));
      return primary === 0 ? a.candidateFullName.localeCompare(b.candidateFullName) : primary * dir;
    });
  });
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.size())),
  );
  readonly paged = computed(() => {
    const page = Math.min(this.page(), this.totalPages() - 1);
    return this.filtered().slice(page * this.size(), page * this.size() + this.size());
  });

  setView(view: 'all' | 'attention'): void {
    this.view.set(view);
    this.page.set(0);
  }

  onSort(sort: SortState): void {
    this.sort.set(sort);
    this.page.set(0);
  }

  setPage(page: number): void {
    this.page.set(Math.max(0, Math.min(page, this.totalPages() - 1)));
  }

  setSize(size: number): void {
    this.size.set(size);
    this.page.set(0);
  }

  private sortValue(row: SupervisedRow, key: string): string | number {
    switch (key) {
      case 'flag':
        return row.needsAttention ? 1 : 0;
      case 'candidate':
        return row.candidateFullName;
      case 'status':
        return row.status;
      case 'period':
        return row.endDate;
      case 'tasks':
        return row.tasksPending;
      case 'journal':
        return row.journalPending;
      case 'evaluation':
        return row.hasFinalEvaluation ? 1 : 0;
      default:
        return '';
    }
  }

  isSupervisorOnly(): boolean {
    return this.auth.role() === 'SUPERVISOR';
  }

  ngOnInit(): void {
    this.crumbs.set([{ labelKey: 'nav.supervisor', labelFallback: 'Supervision' }]);
    // Deep link from the supervisor dashboard: /supervisor?view=attention
    if (this.route.snapshot.queryParamMap.get('view') === 'attention') this.setView('attention');
    if (this.isSupervisorOnly()) this.scope.set(readRememberedSupervisor());
    this.load();
    this.realtime.internshipUpdates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
    // Receipt decisions land through finance events — refresh without interaction.
    this.realtime.financeUpdates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  onScopeChange(): void {
    if (this.isSupervisorOnly()) rememberSupervisor(this.scope());
    this.loadSupervision();
  }

  attentionReason(row: SupervisedRow): string {
    const parts: string[] = [];
    if (row.journalPending > 0)
      parts.push(this.i18n.t('supervisor.reasonJournal', { n: String(row.journalPending) }));
    if (row.status === 'VALIDATED' && !row.hasFinalEvaluation)
      parts.push(this.i18n.t('supervisor.reasonEvaluation'));
    if (row.endsSoon && row.status === 'IN_PROGRESS') parts.push(this.i18n.t('supervisor.reasonEnding'));
    if (row.tasksPending > 0 && row.status === 'IN_PROGRESS')
      parts.push(this.i18n.t('supervisor.reasonTasks', { n: String(row.tasksPending) }));
    return parts.join(' · ') || row.status;
  }

  reviewLabel(n: number): string {
    return this.i18n.t('supervisor.toReview', { n: String(n) });
  }

  openTasksLabel(n: number): string {
    return this.i18n.t('supervisor.openTasks', { n: String(n) });
  }

  statusTone(status: string): BadgeTone {
    switch (status) {
      case 'IN_PROGRESS':
        return 'success';
      case 'VALIDATED':
        return 'info';
      case 'CANCELLED':
      case 'ARCHIVED':
        return 'error';
      default:
        return 'warning';
    }
  }

  financeTone(status: string): BadgeTone {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
      case 'CLOSED':
        return 'error';
      case 'READY_FOR_DECISION':
        return 'warning';
      default:
        return 'info';
    }
  }

  /** Opens the candidate info dialog; details are cached per session. */
  openCandidate(row: SupervisedRow): void {
    const cached = this.candidateCache.get(row.candidateId);
    this.candidate.set(cached ?? null);
    this.candidateOpen.set(true);
    if (cached) return;
    this.candidateLoading.set(true);
    this.api.getCandidate(row.candidateId).subscribe({
      next: (c) => {
        this.candidateCache.set(row.candidateId, c);
        this.candidate.set(c);
        this.candidateLoading.set(false);
      },
      error: () => {
        this.candidate.set(null);
        this.candidateLoading.set(false);
      },
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.api.listInternships().subscribe({
      next: (rows) => {
        this.service.loadAssignmentMap(rows.map((r) => r.id)).subscribe({
          next: (map) => {
            const names = new Set<string>();
            const joined = rows.map((r) => {
              const current = map.get(r.id) ? activeAssignment(map.get(r.id) ?? []) : null;
              if (current) names.add(current.supervisorName);
              return {
                ...r,
                supervisorName: current?.supervisorName ?? '',
                departmentName: current?.departmentName ?? '',
              };
            });
            this.supervisorOptions.set([...names].sort((a, b) => a.localeCompare(b)));
            if (this.isSupervisorOnly()) {
              const remembered = this.scope() || readRememberedSupervisor();
              if (remembered && names.has(remembered)) this.scope.set(remembered);
              else if ([...names].length === 1) this.scope.set([...names][0] ?? '');
            }
            // Receipt tracking: one bounded read, backend-scoped for supervisors.
            this.api.listFinanceCases('', 0, 100).subscribe({
              next: (page) => {
                const byInternship = new Map(
                  page.content.map((c) => [
                    c.internshipId,
                    {
                      caseId: c.id,
                      status: c.status,
                      receipt: c.receiptReference,
                    },
                  ]),
                );
                this.all.set(
                  joined.map((r) => {
                    const fin = byInternship.get(r.id);
                    return {
                      ...r,
                      tasksDone: 0,
                      tasksPending: 0,
                      journalPending: 0,
                      journalTotal: 0,
                      hasFinalEvaluation: false,
                      financeCaseId: fin?.caseId ?? null,
                      financeStatus: fin?.status ?? null,
                      receiptReference: fin?.receipt ?? null,
                      endsSoon: endsSoon(r.status, r.endDate),
                      needsAttention: false,
                    };
                  }),
                );
                this.loadSupervision();
              },
              error: () => {
                this.all.set(
                  joined.map((r) => ({
                    ...r,
                    tasksDone: 0,
                    tasksPending: 0,
                    journalPending: 0,
                    journalTotal: 0,
                    hasFinalEvaluation: false,
                    financeCaseId: null,
                    financeStatus: null,
                    receiptReference: null,
                    endsSoon: endsSoon(r.status, r.endDate),
                    needsAttention: false,
                  })),
                );
                this.loadSupervision();
              },
            });
          },
          error: () => {
            this.error.set(true);
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  private loadSupervision(): void {
    const scoped = this.scopedIds();
    if (scoped.length === 0) {
      this.loading.set(false);
      return;
    }
    const capped = scoped.slice(0, 30);
    forkJoin(
      capped.map((id) =>
        forkJoin({
          tasks: this.api.listTasks(id, 0, 100).pipe(
            map((p) => p.content),
            catchError(() => of([])),
          ),
          journal: this.api.listJournalEntries(id, 0, 100).pipe(
            map((p) => p.content),
            catchError(() => of([])),
          ),
          evaluations: this.api.listEvaluations(id, 0, 20).pipe(
            map((p) => p.content),
            catchError(() => of([])),
          ),
        }).pipe(map((s) => ({ id, ...s }))),
      ),
    ).subscribe({
      next: (results) => {
        const byId = new Map(results.map((r) => [r.id, r]));
        this.all.set(
          this.all().map((row) => {
            const s = byId.get(row.id);
            if (!s) return row;
            const tasksDone = s.tasks.filter((t) => t.status === 'COMPLETED').length;
            const tasksPending = s.tasks.filter(
              (t) => t.status === 'TODO' || t.status === 'IN_PROGRESS',
            ).length;
            const journalPending = s.journal.filter((j) => j.status === 'SUBMITTED').length;
            const hasFinalEvaluation = s.evaluations.some((e) => e.type === 'FINAL');
            const needsAttention =
              journalPending > 0 ||
              (row.status === 'VALIDATED' && !hasFinalEvaluation) ||
              (row.endsSoon && row.status === 'IN_PROGRESS');
            return {
              ...row,
              tasksDone,
              tasksPending,
              journalPending,
              journalTotal: s.journal.length,
              hasFinalEvaluation,
              needsAttention,
            };
          }),
        );
        this.loading.set(false);
      },
      error: () => {
        // Supervision reads are best-effort: assignments still render.
        this.loading.set(false);
      },
    });
  }

  private scopedIds(): string[] {
    const scope = this.scope();
    return this.all()
      .filter((r) => !scope || r.supervisorName === scope)
      .map((r) => r.id);
  }
}

function endsSoon(status: string, endDate: string): boolean {
  if (!endDate) return false;
  const end = new Date(endDate + 'T23:59:59');
  if (Number.isNaN(end.getTime())) return false;
  const now = new Date();
  const days = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
  return days >= 0 && days <= ENDS_SOON_DAYS && status === 'ACTIVE';
}

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}
