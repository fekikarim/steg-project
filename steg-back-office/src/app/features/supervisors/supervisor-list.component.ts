import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { ToastService } from '../../shared/ui/toast.service';
import { SupervisorManagementService } from './supervisor-management.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { DataTableComponent, type SortState } from '../../shared/ui/data-table.component';
import { PaginationComponent } from '../../shared/ui/pagination.component';
import { BadgeComponent, type BadgeTone } from '../../shared/ui/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { DialogComponent, ConfirmDialogComponent } from '../../shared/ui/dialog.component';
import { StIconComponent } from '../../shared/ui/icon.component';
import { CredentialsDialogComponent } from '../applications/credentials-dialog.component';
import type {
  InternshipDetail,
  SupervisorOption,
  SupervisorQueueQuery,
  SupervisorRow,
  UserStatus,
} from '../../core/api-models';

/** Column key → backend sort property; the backend whitelists email/status/createdAt. */
const SORT_PROPERTY: Record<string, string> = {
  email: 'email',
  status: 'status',
  createdAt: 'createdAt',
};

interface CredentialsView {
  readonly email: string;
  readonly password: string;
  readonly emailSent: boolean;
}

/**
 * Supervisor Management workspace (AGENTS.md §5.6), ADMIN-only behind
 * `USER_MANAGE`. Search, status filter, sort and paging run SERVER-side on
 * `GET /api/supervisors/manage`; the client renders exactly one page and never
 * filters the whole list locally. Create returns a one-time password shown once
 * in the shared credentials dialog and dropped from state on close (§5.3).
 */
@Component({
  selector: 'st-supervisor-list',
  standalone: true,
  imports: [
    FormsModule,
    PageHeaderComponent,
    DataTableComponent,
    PaginationComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    AlertComponent,
    DialogComponent,
    ConfirmDialogComponent,
    StIconComponent,
    CredentialsDialogComponent,
  ],
  template: `
    <st-page-header
      [title]="i18n.t('supervisors.title')"
      [subtitle]="i18n.t('supervisors.subtitle')"
    >
      <button type="button" class="st-btn st-btn--primary" (click)="openCreate()">
        <st-icon name="plus" [size]="15" /> {{ i18n.t('supervisors.new') }}
      </button>
    </st-page-header>

    <section class="st-filters" [attr.aria-label]="i18n.t('table.filters')">
      <label class="st-field st-field--grow">
        <span class="st-field__label">{{ i18n.t('table.search') }}</span>
        <input
          type="search"
          class="st-input"
          [(ngModel)]="search"
          (keyup.enter)="onFilter()"
          [placeholder]="i18n.t('supervisors.searchPlaceholder')"
          dir="ltr"
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
    </section>

    @if (error()) {
      <st-error-state
        [title]="i18n.t('common.error.title')"
        [body]="serverMessage() || i18n.t('common.error.body')"
        [retryLabel]="i18n.t('common.retry')"
        (retry)="load()"
      />
    } @else if (loading()) {
      <st-skeleton [rows]="6" />
    } @else if (rows().length === 0) {
      <st-empty-state [title]="i18n.t('common.empty.title')" [body]="i18n.t('supervisors.empty')" />
    } @else {
      <st-data-table
        [columns]="columns"
        [sort]="sort()"
        [hasActions]="true"
        (sortChange)="onSort($event)"
      >
        @for (row of rows(); track row.id) {
          <tr [class.st-row--inactive]="!row.enabled || row.status !== 'ACTIVE'">
            <td dir="ltr">{{ row.email }}</td>
            <td><st-badge [label]="row.role" tone="neutral" /></td>
            <td data-priority="medium">
              <st-badge [label]="row.status" [tone]="statusTone(row.status)" />
            </td>
            <td data-priority="low">
              <st-badge
                [label]="row.enabled ? i18n.t('common.active') : i18n.t('common.disabled')"
                [tone]="row.enabled ? 'success' : 'neutral'"
              />
            </td>
            <td data-priority="low">{{ row.activeAssignmentsCount }}</td>
            <td data-priority="low" dir="ltr">{{ row.createdAt.slice(0, 10) }}</td>
            <td>
              <span class="st-row__actions">
                <button type="button" class="st-btn st-btn--text" (click)="openEdit(row)">
                  {{ i18n.t('common.edit') }}
                </button>
                <button type="button" class="st-btn st-btn--text" (click)="openAssign(row)">
                  {{ i18n.t('supervisors.assign') }}
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

    <!-- Create supervisor -->
    <st-dialog [open]="createOpen()" [title]="i18n.t('supervisors.new')" (close)="closeCreate()">
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('supervisors.email') }} *</span>
        <input type="email" class="st-input" dir="ltr" [(ngModel)]="createEmail" />
      </label>
      <p class="st-hint">{{ i18n.t('supervisors.createHint') }}</p>
      @if (actionError()) {
        <st-alert tone="error">{{ actionError() }}</st-alert>
      }
      <div slot="footer" class="st-dialog__actions">
        <button type="button" class="st-btn st-btn--secondary" (click)="closeCreate()">
          {{ i18n.t('common.cancel') }}
        </button>
        <button
          type="button"
          class="st-btn st-btn--primary"
          [disabled]="busy() || !isEmail(createEmail)"
          (click)="submitCreate()"
        >
          {{ i18n.t('common.create') }}
        </button>
      </div>
    </st-dialog>

    <!-- Edit status / enabled -->
    <st-dialog
      [open]="editing() !== null"
      [title]="i18n.t('supervisors.edit')"
      (close)="editing.set(null)"
    >
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('table.status') }}</span>
        <select class="st-input" [(ngModel)]="editStatus">
          @for (s of statuses; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
      </label>
      <label class="st-field st-field--inline">
        <input type="checkbox" [(ngModel)]="editEnabled" />
        <span>{{ i18n.t('supervisors.enabled') }}</span>
      </label>
      @if (actionError()) {
        <st-alert tone="error">{{ actionError() }}</st-alert>
      }
      <div slot="footer" class="st-dialog__actions">
        <button type="button" class="st-btn st-btn--secondary" (click)="editing.set(null)">
          {{ i18n.t('common.cancel') }}
        </button>
        <button
          type="button"
          class="st-btn st-btn--primary"
          [disabled]="busy()"
          (click)="submitEdit()"
        >
          {{ i18n.t('common.save') }}
        </button>
      </div>
    </st-dialog>

    <!-- Assign an approved candidate -->
    <st-dialog
      [open]="assignTarget() !== null"
      [title]="i18n.t('supervisors.assign')"
      (close)="closeAssign()"
    >
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('supervisors.internship') }} *</span>
        <select class="st-input" [(ngModel)]="assignInternshipId">
          <option value="">{{ i18n.t('supervisors.pickInternship') }}</option>
          @for (i of internships(); track i.id) {
            <option [value]="i.id">
              {{ i.reference }} — {{ i.candidateFullName }} ({{ i.status }})
            </option>
          }
        </select>
      </label>
      <p class="st-hint">{{ i18n.t('supervisors.assignHint') }}</p>
      @if (actionError()) {
        <st-alert tone="error">{{ actionError() }}</st-alert>
      }
      <div slot="footer" class="st-dialog__actions">
        <button type="button" class="st-btn st-btn--secondary" (click)="closeAssign()">
          {{ i18n.t('common.cancel') }}
        </button>
        <button
          type="button"
          class="st-btn st-btn--primary"
          [disabled]="busy() || !assignInternshipId"
          (click)="submitAssign()"
        >
          {{ i18n.t('supervisors.assign') }}
        </button>
      </div>
    </st-dialog>

    <!-- Change supervisor (Admin selectable) -->
    <st-dialog
      [open]="reassignTarget() !== null"
      [title]="i18n.t('supervisors.reassign')"
      (close)="closeReassign()"
    >
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('supervisors.internship') }} *</span>
        <select class="st-input" [(ngModel)]="reassignInternshipId">
          <option value="">{{ i18n.t('supervisors.pickInternship') }}</option>
          @for (i of internships(); track i.id) {
            <option [value]="i.id">
              {{ i.reference }} — {{ i.candidateFullName }} ({{ i.status }})
            </option>
          }
        </select>
      </label>
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('supervisors.newSupervisor') }} *</span>
        <select class="st-input" [(ngModel)]="reassignSupervisorId">
          <option value="">{{ i18n.t('supervisors.pickSupervisor') }}</option>
          @for (s of directory(); track s.userId) {
            <option [value]="s.userId">{{ s.email }} ({{ s.role }})</option>
          }
        </select>
      </label>
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('supervisors.reason') }}</span>
        <input class="st-input" dir="auto" [(ngModel)]="reassignReason" />
      </label>
      <p class="st-hint">{{ i18n.t('supervisors.reassignHint') }}</p>
      @if (actionError()) {
        <st-alert tone="error">{{ actionError() }}</st-alert>
      }
      <div slot="footer" class="st-dialog__actions">
        <button type="button" class="st-btn st-btn--secondary" (click)="closeReassign()">
          {{ i18n.t('common.cancel') }}
        </button>
        <button
          type="button"
          class="st-btn st-btn--primary"
          [disabled]="busy() || !reassignInternshipId || !reassignSupervisorId"
          (click)="submitReassign()"
        >
          {{ i18n.t('supervisors.reassign') }}
        </button>
      </div>
    </st-dialog>

    <st-confirm-dialog
      [open]="deleting() !== null"
      [title]="i18n.t('supervisors.deleteTitle')"
      [body]="deleteBody()"
      [consequence]="i18n.t('supervisors.deleteConsequence')"
      [confirmLabel]="i18n.t('common.delete')"
      [cancelLabel]="i18n.t('common.cancel')"
      [busy]="busy()"
      (confirmed)="submitDelete()"
      (cancel)="deleting.set(null)"
    />

    <st-credentials-dialog
      [open]="credentials() !== null"
      [email]="credentials()?.email ?? ''"
      [password]="credentials()?.password ?? ''"
      [emailSent]="credentials()?.emailSent ?? false"
      (closed)="closeCredentials()"
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
      .st-field--inline {
        display: flex;
        gap: 0.4rem;
        align-items: center;
      }
      .st-row--inactive td {
        opacity: 0.62;
      }
      .st-row__actions {
        display: flex;
        gap: 0.2rem;
        flex-wrap: wrap;
      }
      .st-hint {
        font-size: 0.78rem;
        color: var(--text-secondary);
        margin: 0.3rem 0 0;
      }
      .st-dialog__actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
      }
      .st-btn--danger-text {
        color: var(--action-danger);
      }
    `,
  ],
})
export class SupervisorListComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly toast = inject(ToastService);
  private readonly service = inject(SupervisorManagementService);

  readonly columns = [
    { key: 'email', label: 'Email', sortable: true, priority: 'high' as const },
    { key: 'role', label: 'Role', sortable: false, priority: 'high' as const },
    { key: 'status', label: 'Status', sortable: true, priority: 'high' as const },
    { key: 'enabled', label: 'Enabled', sortable: false, priority: 'low' as const },
    { key: 'activeAssignmentsCount', label: 'Assigned', sortable: false, priority: 'low' as const },
    { key: 'createdAt', label: 'Created', sortable: true, priority: 'low' as const },
  ];
  /** Explicit IAM statuses only. */
  readonly statuses: readonly UserStatus[] = ['ACTIVE', 'INACTIVE', 'LOCKED'];

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal(false);
  readonly serverMessage = signal('');
  readonly actionError = signal('');
  readonly rows = signal<readonly SupervisorRow[]>([]);
  readonly totalPages = signal(1);
  readonly internships = signal<readonly InternshipDetail[]>([]);
  readonly directory = signal<readonly SupervisorOption[]>([]);

  readonly search = signal('');
  readonly status = signal('');
  readonly page = signal(0);
  readonly size = signal(20);
  readonly sort = signal<SortState | null>({ key: 'email', direction: 'asc' });

  readonly createOpen = signal(false);
  createEmail = '';
  readonly editing = signal<SupervisorRow | null>(null);
  editStatus: UserStatus = 'ACTIVE';
  editEnabled = true;
  readonly assignTarget = signal<SupervisorRow | null>(null);
  assignInternshipId = '';
  readonly reassignTarget = signal<SupervisorRow | null>(null);
  reassignInternshipId = '';
  reassignSupervisorId = '';
  reassignReason = '';
  readonly deleting = signal<SupervisorRow | null>(null);
  /** One-time credentials, held only while the dialog is open (§5.3). */
  readonly credentials = signal<CredentialsView | null>(null);

  readonly canDelete = computed(() => (this.deleting()?.activeAssignmentsCount ?? 0) === 0);

  ngOnInit(): void {
    this.crumbs.set([
      { labelKey: 'nav.section.controle', labelFallback: 'Contrôle' },
      { labelKey: 'nav.supervisors', labelFallback: 'Supervisors' },
    ]);
    this.load();
  }

  /** One server round-trip per page/filter/sort change. */
  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.serverMessage.set('');
    const sort = this.sort();
    const property = sort ? SORT_PROPERTY[sort.key] : undefined;
    const query: SupervisorQueueQuery = {
      page: this.page(),
      size: this.size(),
      sort: property ? `${property},${sort?.direction ?? 'asc'}` : undefined,
      q: this.search().trim() || undefined,
      status: (this.status() || undefined) as UserStatus | undefined,
    };
    this.service.search(query).subscribe({
      next: (page) => {
        this.rows.set(page.content);
        this.totalPages.set(Math.max(1, page.totalPages));
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.error.set(true);
        this.serverMessage.set(SupervisorManagementService.messageOf(e, ''));
        this.loading.set(false);
      },
    });
  }

  onFilter(): void {
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

  statusTone(status: string): BadgeTone {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'LOCKED':
        return 'error';
      case 'INACTIVE':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  /* ---------------- create (§5.3 one-time credentials) ---------------- */

  openCreate(): void {
    this.createEmail = '';
    this.actionError.set('');
    this.createOpen.set(true);
  }

  closeCreate(): void {
    this.createOpen.set(false);
    this.createEmail = '';
    this.actionError.set('');
  }

  submitCreate(): void {
    const email = this.createEmail.trim();
    if (!this.isEmail(email)) return;
    this.busy.set(true);
    this.service.create(email).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.closeCreate();
        this.credentials.set({
          email: result.email,
          password: result.temporaryPassword,
          emailSent: result.emailSent,
        });
        this.load();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.actionError.set(
          SupervisorManagementService.messageOf(e, this.i18n.t('common.error.body')),
        );
      },
    });
  }

  /** The password lives only while the dialog is open; closing drops it (§5.3). */
  closeCredentials(): void {
    this.credentials.set(null);
  }

  /* ---------------- edit ---------------- */

  openEdit(row: SupervisorRow): void {
    this.actionError.set('');
    this.editStatus = row.status;
    this.editEnabled = row.enabled;
    this.editing.set(row);
  }

  submitEdit(): void {
    const target = this.editing();
    if (!target) return;
    this.busy.set(true);
    this.service
      .update(target.id, { status: this.editStatus, enabled: this.editEnabled })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.editing.set(null);
          this.toast.show('success', this.i18n.t('supervisors.updated'));
          this.load();
        },
        error: (e: unknown) => {
          this.busy.set(false);
          this.actionError.set(
            SupervisorManagementService.messageOf(e, this.i18n.t('common.error.body')),
          );
        },
      });
  }

  /* ---------------- delete (§5.6 guard) ---------------- */

  askDelete(row: SupervisorRow): void {
    this.actionError.set('');
    this.deleting.set(row);
  }

  deleteBody(): string {
    const target = this.deleting();
    return this.i18n.t('supervisors.deleteBody', { email: target?.email ?? '' });
  }

  submitDelete(): void {
    const target = this.deleting();
    if (!target) return;
    this.busy.set(true);
    this.service.remove(target.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.deleting.set(null);
        this.toast.show('success', this.i18n.t('supervisors.deleted'));
        this.load();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.deleting.set(null);
        // 409 SUPERVISOR_HAS_ACTIVE_ASSIGNMENTS: tell the Admin to reassign first.
        const message = SupervisorManagementService.isActiveAssignmentsConflict(e)
          ? this.i18n.t('supervisors.hasAssignments')
          : SupervisorManagementService.messageOf(e, this.i18n.t('common.error.body'));
        this.toast.show('error', message);
      },
    });
  }

  /* ---------------- assign / reassign ---------------- */

  openAssign(row: SupervisorRow): void {
    this.actionError.set('');
    this.assignInternshipId = '';
    this.assignTarget.set(row);
    this.loadInternships();
  }

  closeAssign(): void {
    this.assignTarget.set(null);
    this.assignInternshipId = '';
    this.actionError.set('');
  }

  submitAssign(): void {
    const target = this.assignTarget();
    const internshipId = this.assignInternshipId.trim();
    if (!target || !internshipId) return;
    this.busy.set(true);
    this.service.assign(target.id, internshipId).subscribe({
      next: () => {
        this.busy.set(false);
        this.closeAssign();
        this.toast.show('success', this.i18n.t('supervisors.assigned'));
        this.load();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.actionError.set(
          SupervisorManagementService.messageOf(e, this.i18n.t('common.error.body')),
        );
      },
    });
  }

  openReassign(row: SupervisorRow): void {
    this.actionError.set('');
    this.reassignInternshipId = '';
    this.reassignSupervisorId = '';
    this.reassignReason = '';
    this.reassignTarget.set(row);
    this.loadInternships();
    this.service.directory().subscribe({
      next: (options) => this.directory.set(options),
      error: () => this.directory.set([]),
    });
  }

  closeReassign(): void {
    this.reassignTarget.set(null);
    this.reassignInternshipId = '';
    this.reassignSupervisorId = '';
    this.reassignReason = '';
    this.actionError.set('');
  }

  submitReassign(): void {
    const internshipId = this.reassignInternshipId.trim();
    const supervisorId = this.reassignSupervisorId.trim();
    if (!internshipId || !supervisorId) return;
    this.busy.set(true);
    this.service.reassign(supervisorId, internshipId, this.reassignReason || null).subscribe({
      next: () => {
        this.busy.set(false);
        this.closeReassign();
        this.toast.show('success', this.i18n.t('supervisors.reassigned'));
        this.load();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.actionError.set(
          SupervisorManagementService.messageOf(e, this.i18n.t('common.error.body')),
        );
      },
    });
  }

  /** Cached once per dialog: the list is a reference dataset, not a search. */
  private loadInternships(): void {
    if (this.internships().length > 0) return;
    this.service.assignableInternships().subscribe({
      next: (rows) => this.internships.set(rows),
      error: () => this.internships.set([]),
    });
  }
}
