import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { ToastService } from '../../shared/ui/toast.service';
import { InternAccountsService } from './intern-accounts.service';
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
  CreateInternAccountBody,
  InternAccountQueueQuery,
  InternAccountRow,
  UserStatus,
} from '../../core/api-models';

/** Column key → backend sort property; the backend whitelists email/status/createdAt. */
const SORT_PROPERTY: Record<string, string> = {
  email: 'email',
  status: 'status',
  createdAt: 'createdAt',
};

type AccountRole = CreateInternAccountBody['role'];

interface CredentialsView {
  readonly email: string;
  readonly password: string;
  readonly emailSent: boolean;
}

/**
 * 'STEG intern' accounts workspace (AGENTS.md §5.4), ADMIN-only behind
 * `USER_MANAGE` and a route SEPARATE from Supervisor Management — only the
 * shared `st-credentials-dialog` and the shared list pattern are reused.
 *
 * Search, role/status filters, sort and paging run SERVER-side on
 * `GET /api/intern-accounts/manage`; the client renders exactly one page and
 * never filters the whole list locally. Create and reset return a one-time
 * password shown once in the shared dialog and dropped from state on close
 * (§5.3). A Supervisor account created here is the same user row Supervisor
 * Management operates on (§5.4 no duplicate identities).
 */
@Component({
  selector: 'st-intern-account-list',
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
      [title]="i18n.t('internAccounts.title')"
      [subtitle]="i18n.t('internAccounts.subtitle')"
    >
      <button type="button" class="st-btn st-btn--primary" (click)="openCreate()">
        <st-icon name="plus" [size]="15" /> {{ i18n.t('internAccounts.new') }}
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
          [placeholder]="i18n.t('internAccounts.searchPlaceholder')"
          dir="auto"
        />
      </label>
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('internAccounts.role') }}</span>
        <select class="st-input" [(ngModel)]="role" (change)="onFilter()">
          <option value="">{{ i18n.t('table.all') }}</option>
          <option value="INTERN">{{ i18n.t('internAccounts.roleIntern') }}</option>
          <option value="SUPERVISOR">{{ i18n.t('internAccounts.roleSupervisor') }}</option>
        </select>
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
      <st-empty-state
        [title]="i18n.t('common.empty.title')"
        [body]="i18n.t('internAccounts.empty')"
      />
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
            <td>
              @for (r of row.roles; track r) {
                <st-badge [label]="roleLabel(r)" tone="neutral" />
              }
            </td>
            <td data-priority="medium">
              <st-badge [label]="row.status" [tone]="statusTone(row.status)" />
            </td>
            <td data-priority="low">
              <st-badge
                [label]="row.enabled ? i18n.t('common.active') : i18n.t('common.disabled')"
                [tone]="row.enabled ? 'success' : 'neutral'"
              />
            </td>
            <td data-priority="low">{{ row.fullName || i18n.t('internAccounts.noCandidate') }}</td>
            <td data-priority="low" dir="ltr">{{ row.createdAt?.slice(0, 10) || '—' }}</td>
            <td>
              <span class="st-row__actions">
                <button type="button" class="st-btn st-btn--text" (click)="openEdit(row)">
                  {{ i18n.t('common.edit') }}
                </button>
                <button type="button" class="st-btn st-btn--text" (click)="askReset(row)">
                  {{ i18n.t('internAccounts.reset') }}
                </button>
                @if (row.enabled && row.status === 'ACTIVE') {
                  <button type="button" class="st-btn st-btn--text" (click)="deactivate(row)">
                    {{ i18n.t('internAccounts.deactivate') }}
                  </button>
                } @else {
                  <button type="button" class="st-btn st-btn--text" (click)="activate(row)">
                    {{ i18n.t('internAccounts.activate') }}
                  </button>
                }
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

    <!-- Create account -->
    <st-dialog [open]="createOpen()" [title]="i18n.t('internAccounts.new')" (close)="closeCreate()">
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('internAccounts.email') }} *</span>
        <input type="email" class="st-input" dir="ltr" [(ngModel)]="createEmail" />
      </label>
      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('internAccounts.role') }} *</span>
        <select class="st-input" [(ngModel)]="createRole">
          <option value="">{{ i18n.t('internAccounts.pickRole') }}</option>
          <option value="INTERN">{{ i18n.t('internAccounts.roleIntern') }}</option>
          <option value="SUPERVISOR">{{ i18n.t('internAccounts.roleSupervisor') }}</option>
        </select>
      </label>
      <p class="st-hint">{{ i18n.t('internAccounts.createHint') }}</p>
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
          [disabled]="busy() || !isEmail(createEmail) || !createRole"
          (click)="submitCreate()"
        >
          {{ i18n.t('common.create') }}
        </button>
      </div>
    </st-dialog>

    <!-- Edit status / enabled -->
    <st-dialog
      [open]="editing() !== null"
      [title]="i18n.t('internAccounts.edit')"
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
        <span>{{ i18n.t('internAccounts.enabled') }}</span>
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

    <!-- One-time reset confirmation; the new secret appears in the shared dialog -->
    <st-confirm-dialog
      [open]="resetting() !== null"
      [title]="i18n.t('internAccounts.resetTitle')"
      [body]="resetBody()"
      [consequence]="i18n.t('internAccounts.resetHint')"
      [confirmLabel]="i18n.t('internAccounts.reset')"
      [cancelLabel]="i18n.t('common.cancel')"
      [busy]="busy()"
      (confirmed)="submitReset()"
      (cancel)="resetting.set(null)"
    />

    <st-confirm-dialog
      [open]="deleting() !== null"
      [title]="i18n.t('internAccounts.deleteTitle')"
      [body]="deleteBody()"
      [consequence]="i18n.t('internAccounts.deleteConsequence')"
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
export class InternAccountListComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly toast = inject(ToastService);
  private readonly service = inject(InternAccountsService);

  readonly columns = [
    { key: 'email', label: 'Email', sortable: true, priority: 'high' as const },
    { key: 'role', label: 'Role', sortable: false, priority: 'high' as const },
    { key: 'status', label: 'Status', sortable: true, priority: 'high' as const },
    { key: 'enabled', label: 'Enabled', sortable: false, priority: 'low' as const },
    { key: 'fullName', label: 'Candidate', sortable: false, priority: 'low' as const },
    { key: 'createdAt', label: 'Created', sortable: true, priority: 'low' as const },
  ];
  /** Explicit IAM statuses only. */
  readonly statuses: readonly UserStatus[] = ['ACTIVE', 'INACTIVE', 'LOCKED'];

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal(false);
  readonly serverMessage = signal('');
  readonly actionError = signal('');
  readonly rows = signal<readonly InternAccountRow[]>([]);
  readonly totalPages = signal(1);

  readonly search = signal('');
  readonly role = signal('');
  readonly status = signal('');
  readonly page = signal(0);
  readonly size = signal(20);
  readonly sort = signal<SortState | null>({ key: 'email', direction: 'asc' });

  readonly createOpen = signal(false);
  createEmail = '';
  createRole: AccountRole | '' = '';
  readonly editing = signal<InternAccountRow | null>(null);
  editStatus: UserStatus = 'ACTIVE';
  editEnabled = true;
  readonly resetting = signal<InternAccountRow | null>(null);
  readonly deleting = signal<InternAccountRow | null>(null);
  /** One-time credentials, held only while the dialog is open (§5.3). */
  readonly credentials = signal<CredentialsView | null>(null);

  ngOnInit(): void {
    this.crumbs.set([
      { labelKey: 'nav.section.controle', labelFallback: 'Contrôle' },
      { labelKey: 'nav.internAccounts', labelFallback: 'Comptes mobiles' },
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
    const query: InternAccountQueueQuery = {
      page: this.page(),
      size: this.size(),
      sort: property ? `${property},${sort?.direction ?? 'asc'}` : undefined,
      q: this.search().trim() || undefined,
      role: (this.role() || undefined) as InternAccountQueueQuery['role'],
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
        this.serverMessage.set(InternAccountsService.messageOf(e, ''));
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

  roleLabel(roleCode: string): string {
    return roleCode === 'INTERN'
      ? this.i18n.t('internAccounts.roleIntern')
      : this.i18n.t('internAccounts.roleSupervisor');
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
    this.createRole = '';
    this.actionError.set('');
    this.createOpen.set(true);
  }

  closeCreate(): void {
    this.createOpen.set(false);
    this.createEmail = '';
    this.createRole = '';
    this.actionError.set('');
  }

  submitCreate(): void {
    const email = this.createEmail.trim();
    const role = this.createRole;
    if (!this.isEmail(email) || !role) return;
    this.busy.set(true);
    this.service.create(email, role).subscribe({
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
        this.actionError.set(InternAccountsService.messageOf(e, this.i18n.t('common.error.body')));
      },
    });
  }

  /** The password lives only while the dialog is open; closing drops it (§5.3). */
  closeCredentials(): void {
    this.credentials.set(null);
  }

  /* ---------------- edit ---------------- */

  openEdit(row: InternAccountRow): void {
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
          this.toast.show('success', this.i18n.t('internAccounts.updated'));
          this.load();
        },
        error: (e: unknown) => {
          this.busy.set(false);
          this.actionError.set(
            InternAccountsService.messageOf(e, this.i18n.t('common.error.body')),
          );
        },
      });
  }

  /* ---------------- reset password (§5.4 one-time secret) ---------------- */

  askReset(row: InternAccountRow): void {
    this.actionError.set('');
    this.resetting.set(row);
  }

  resetBody(): string {
    const target = this.resetting();
    return this.i18n.t('internAccounts.resetBody', { email: target?.email ?? '' });
  }

  submitReset(): void {
    const target = this.resetting();
    if (!target) return;
    this.busy.set(true);
    this.service.resetPassword(target.id).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.resetting.set(null);
        this.credentials.set({
          email: result.email,
          password: result.temporaryPassword,
          emailSent: result.emailSent,
        });
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.resetting.set(null);
        this.toast.show(
          'error',
          InternAccountsService.messageOf(e, this.i18n.t('common.error.body')),
        );
      },
    });
  }

  /* ---------------- activate / deactivate ---------------- */

  activate(row: InternAccountRow): void {
    this.service.activate(row.id).subscribe({
      next: () => {
        this.toast.show('success', this.i18n.t('internAccounts.statusUpdated'));
        this.load();
      },
      error: (e: unknown) => {
        this.toast.show(
          'error',
          InternAccountsService.messageOf(e, this.i18n.t('common.error.body')),
        );
      },
    });
  }

  deactivate(row: InternAccountRow): void {
    this.service.deactivate(row.id).subscribe({
      next: () => {
        this.toast.show('success', this.i18n.t('internAccounts.statusUpdated'));
        this.load();
      },
      error: (e: unknown) => {
        this.toast.show(
          'error',
          InternAccountsService.messageOf(e, this.i18n.t('common.error.body')),
        );
      },
    });
  }

  /* ---------------- delete (§5.4 / §5.6 guard) ---------------- */

  askDelete(row: InternAccountRow): void {
    this.actionError.set('');
    this.deleting.set(row);
  }

  deleteBody(): string {
    const target = this.deleting();
    return this.i18n.t('internAccounts.deleteBody', { email: target?.email ?? '' });
  }

  submitDelete(): void {
    const target = this.deleting();
    if (!target) return;
    this.busy.set(true);
    this.service.remove(target.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.deleting.set(null);
        this.toast.show('success', this.i18n.t('internAccounts.deleted'));
        this.load();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.deleting.set(null);
        // 409 SUPERVISOR_HAS_ACTIVE_ASSIGNMENTS: tell the Admin to reassign first.
        const message = InternAccountsService.isActiveAssignmentsConflict(e)
          ? this.i18n.t('internAccounts.hasAssignments')
          : InternAccountsService.messageOf(e, this.i18n.t('common.error.body'));
        this.toast.show('error', message);
      },
    });
  }
}
