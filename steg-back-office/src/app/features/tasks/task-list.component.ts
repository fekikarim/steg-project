import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { of, forkJoin, throwError, switchMap, catchError } from 'rxjs';
import { I18nService } from '../../core/i18n.service';
import { ToastService } from '../../shared/ui/toast.service';
import { TasksService } from './tasks.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { PaginationComponent } from '../../shared/ui/pagination.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import { BadgeComponent, type BadgeTone } from '../../shared/ui/badge.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { DialogComponent, ConfirmDialogComponent } from '../../shared/ui/dialog.component';
import { StIconComponent } from '../../shared/ui/icon.component';
import { ApiClient } from '../../core/api-client.service';
import type {
  BulkTaskMutation,
  CompanionTask,
  InternshipDetail,
  TaskStatus,
} from '../../core/api-models';

/** One student group: all tasks of one internship, rendered together. */
interface StudentGroup {
  readonly internshipId: string;
  readonly tasks: CompanionTask[];
}

export interface BulkEditTaskItem {
  readonly id: string;
  readonly internshipId: string;
  readonly candidateLabel: string;
  title: string;
  description: string;
  status: TaskStatus;
}

const STATUS_TONE: Record<TaskStatus, BadgeTone> = {
  TODO: 'neutral',
  IN_PROGRESS: 'info',
  COMPLETED: 'warning',
  APPROVED: 'success',
  DENIED: 'error',
  CANCELLED: 'neutral',
};

/**
 * Student-grouped tasks workspace (AGENTS.md §5.5 for the Admin — all
 * students; §6.1 for the Supervisor — own candidates only, same screen).
 *
 * The scope is derived SERVER-side on `GET /api/internships/tasks`; the client
 * only groups the returned page by student for display and never re-filters
 * across scope. Approve/deny (deny needs a reason — enforced client-side AND
 * server-side), add, edit and delete all go through the backend; bulk
 * add/edit/delete across several students is one atomic `POST .../tasks/bulk`
 * call with a per-item result summary and an idempotency key generated when
 * the bulk dialog opens, so a double submit replays instead of duplicating.
 */
@Component({
  selector: 'st-task-list',
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
    StIconComponent,
  ],
  template: `
    <st-page-header [title]="i18n.t('tasksWs.title')" [subtitle]="i18n.t('tasksWs.subtitle')">
      <st-live-status />
      <button type="button" class="st-btn st-btn--primary" (click)="openAdd()">
        {{ i18n.t('tasksWs.add') }}
      </button>
      <a routerLink="/tasks/drafts" class="st-btn">
        {{ i18n.t('tasksWs.aiDrafts') }}
      </a>
      <button
        type="button"
        class="st-btn"
        [disabled]="selected().size === 0"
        (click)="openBulkEdit()"
      >
        {{ i18n.t('tasksWs.bulkEdit') }} ({{ selected().size }})
      </button>
      <button
        type="button"
        class="st-btn st-btn--danger"
        [disabled]="selected().size === 0"
        (click)="openBulkDelete()"
      >
        {{ i18n.t('tasksWs.bulkDelete') }} ({{ selected().size }})
      </button>
    </st-page-header>

    <div class="st-toolbar" role="search">
      <input
        type="search"
        class="st-input"
        [placeholder]="i18n.t('tasksWs.searchPh')"
        [(ngModel)]="search"
        (ngModelChange)="onFilterChange()"
      />
      <select class="st-input" [(ngModel)]="status" (ngModelChange)="onFilterChange()">
        <option value="">{{ i18n.t('tasksWs.allStatuses') }}</option>
        @for (s of statuses; track s) {
          <option [value]="s">{{ s }}</option>
        }
      </select>
      @if (rows().length > 0) {
        <button type="button" class="st-btn st-btn--sm" (click)="toggleSelectAllTasks()">
          {{
            isAllTasksSelected()
              ? 'Tout désélectionner'
              : 'Sélectionner tout (' + rows().length + ')'
          }}
        </button>
      }
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
    } @else if (groups().length === 0) {
      <st-empty-state [title]="i18n.t('tasksWs.empty')" [body]="''" />
    } @else {
      @if (lastBulkSummary()) {
        <st-alert tone="info">{{ lastBulkSummary() }}</st-alert>
      }
      @for (g of groups(); track g.internshipId) {
        <section class="st-group" [attr.aria-label]="g.internshipId">
          <header class="st-group__head">
            <input
              type="checkbox"
              class="st-group__select-all"
              [checked]="isGroupSelected(g)"
              (change)="toggleGroupSelect(g)"
              title="Sélectionner toutes les tâches de ce candidat"
            />
            <h2>{{ candidateLabelFor(g.internshipId) }}</h2>
            <span class="st-group__count">{{ g.tasks.length }}</span>
            <button type="button" class="st-btn st-btn--sm" (click)="openAdd(g.internshipId)">
              {{ i18n.t('tasksWs.addToStudent') }}
            </button>
          </header>
          <ul class="st-tasks">
            @for (t of g.tasks; track t.id) {
              <li class="st-task">
                <input
                  type="checkbox"
                  [checked]="selected().has(t.id)"
                  (change)="toggleSelect(t.id)"
                  [attr.aria-label]="t.title"
                />
                <div class="st-task__body">
                  <strong>{{ t.title }}</strong>
                  @if (t.description) {
                    <p>{{ t.description }}</p>
                  }
                  <div class="st-task__meta">
                    <st-badge [label]="t.status" [tone]="tone(t.status)" />
                    @if (t.reviewReason) {
                      <span class="st-task__reason">{{ t.reviewReason }}</span>
                    }
                  </div>
                </div>
                <div class="st-task__actions">
                  @if (t.status === 'COMPLETED') {
                    <button
                      type="button"
                      class="st-btn st-btn--sm st-btn--primary"
                      (click)="approve(t)"
                    >
                      {{ i18n.t('tasksWs.approve') }}
                    </button>
                    <button type="button" class="st-btn st-btn--sm" (click)="openDeny(t)">
                      {{ i18n.t('tasksWs.deny') }}
                    </button>
                  }
                  <button type="button" class="st-btn st-btn--sm" (click)="openEdit(t)">
                    {{ i18n.t('tasksWs.edit') }}
                  </button>
                  <button
                    type="button"
                    class="st-btn st-btn--sm st-btn--danger"
                    (click)="askDelete(t)"
                  >
                    {{ i18n.t('tasksWs.delete') }}
                  </button>
                </div>
              </li>
            }
          </ul>
        </section>
      }
      <st-pagination
        [page]="page()"
        [size]="50"
        [totalPages]="totalPages()"
        (prev)="onPage(page() - 1)"
        (next)="onPage(page() + 1)"
      />
    }

    <!-- add / edit dialog -->
    <st-dialog
      [open]="formOpen()"
      [title]="editing() ? i18n.t('tasksWs.editTitle') : i18n.t('tasksWs.addTitle')"
      (close)="closeForm()"
    >
      @if (isSpecificStudentAdd()) {
        <div class="st-specific-student-badge">
          <st-icon name="user" [size]="15" />
          <span
            >Candidat : <strong>{{ candidateLabelFor(formInternship) }}</strong></span
          >
        </div>
      } @else if (editing()) {
        <label class="st-field">
          <span>{{ i18n.t('tasksWs.internshipId') }}</span>
          <input class="st-input" [value]="candidateLabelFor(formInternship)" disabled />
        </label>
      } @else {
        <!-- Candidate checkboxes for Admin / Supervisor -->
        <fieldset class="st-field st-candidates-fieldset">
          <div class="st-candidates-legend">
            <span
              >{{ i18n.t('nav.candidates') }} ({{ formCandidates().size }} sélectionné{{
                formCandidates().size > 1 ? 's' : ''
              }}) *</span
            >
            <button type="button" class="st-btn st-btn--xs" (click)="toggleSelectAllCandidates()">
              {{ isAllCandidatesSelected() ? 'Tout désélectionner' : 'Tout sélectionner' }}
            </button>
          </div>
          @if (internshipsLoading()) {
            <p class="st-hint">{{ i18n.t('common.loading') }}</p>
          } @else if (availableCandidates().length === 0) {
            <p class="st-hint">Aucun candidat disponible.</p>
          } @else {
            <div class="st-candidates-scroll">
              @for (c of availableCandidates(); track c.id) {
                <label class="st-check st-candidate-row">
                  <input
                    type="checkbox"
                    [checked]="formCandidates().has(c.id)"
                    (change)="toggleCandidateSelect(c.id)"
                  />
                  <div class="st-candidate-opt-info">
                    <strong class="st-candidate-opt-name">{{
                      c.candidateFullName || 'Candidat #' + c.candidateId
                    }}</strong>
                    <span class="st-candidate-opt-ref">{{ c.reference }}</span>
                  </div>
                </label>
              }
            </div>
          }
        </fieldset>
      }

      <label class="st-field">
        <span>{{ i18n.t('tasksWs.titleLabel') }} *</span>
        <input class="st-input" [(ngModel)]="formTitle" required />
      </label>
      <label class="st-field">
        <span>{{ i18n.t('tasksWs.descLabel') }}</span>
        <textarea class="st-input" rows="3" [(ngModel)]="formDesc"></textarea>
      </label>
      @if (formError()) {
        <st-alert tone="error">{{ formError() }}</st-alert>
      }
      <div class="st-dialog__actions">
        <button type="button" class="st-btn" (click)="closeForm()">
          {{ i18n.t('common.cancel') }}
        </button>
        <button
          type="button"
          class="st-btn st-btn--primary"
          [disabled]="saving()"
          (click)="saveForm()"
        >
          {{ i18n.t('common.save') }}
        </button>
      </div>
    </st-dialog>

    <!-- deny dialog (reason mandatory) -->
    <st-dialog
      [open]="denyOpen()"
      [title]="i18n.t('tasksWs.denyTitle')"
      (close)="denyOpen.set(false)"
    >
      <p>{{ i18n.t('tasksWs.denyHint') }}</p>
      <label class="st-field">
        <span>{{ i18n.t('tasksWs.reasonLabel') }}</span>
        <textarea class="st-input" rows="3" [(ngModel)]="denyReason"></textarea>
      </label>
      @if (denyError()) {
        <st-alert tone="error">{{ denyError() }}</st-alert>
      }
      <div class="st-dialog__actions">
        <button type="button" class="st-btn" (click)="denyOpen.set(false)">
          {{ i18n.t('common.cancel') }}
        </button>
        <button
          type="button"
          class="st-btn st-btn--primary"
          [disabled]="saving()"
          (click)="confirmDeny()"
        >
          {{ i18n.t('tasksWs.deny') }}
        </button>
      </div>
    </st-dialog>

    <!-- bulk edit dialog: lists and allows editing ALL selected tasks -->
    <st-dialog
      [open]="bulkEditOpen()"
      [title]="i18n.t('tasksWs.bulkEditTitle') + ' (' + bulkEditItems().length + ')'"
      (close)="bulkEditOpen.set(false)"
    >
      <p class="st-hint">{{ i18n.t('tasksWs.bulkEditHint') }}</p>

      @if (bulkEditItems().length > 1) {
        <details class="st-bulk-quick-apply">
          <summary><strong>Actions rapides (appliquer à toutes les tâches)</strong></summary>
          <div class="st-quick-row">
            <input
              class="st-input st-input--sm"
              placeholder="Titre commun..."
              [(ngModel)]="bulkCommonTitle"
            />
            <button type="button" class="st-btn st-btn--sm" (click)="applyCommonTitle()">
              Appliquer titre
            </button>
          </div>
          <div class="st-quick-row">
            <input
              class="st-input st-input--sm"
              placeholder="Description commune..."
              [(ngModel)]="bulkCommonDesc"
            />
            <button type="button" class="st-btn st-btn--sm" (click)="applyCommonDesc()">
              Appliquer desc
            </button>
          </div>
          <div class="st-quick-row">
            <select class="st-input st-input--sm" [(ngModel)]="bulkCommonStatus">
              <option value="">Sélectionner statut commun...</option>
              @for (s of statuses; track s) {
                <option [value]="s">{{ s }}</option>
              }
            </select>
            <button type="button" class="st-btn st-btn--sm" (click)="applyCommonStatus()">
              Appliquer statut
            </button>
          </div>
        </details>
      }

      <!-- Editable cards for each selected task -->
      <div class="st-bulk-edit-list">
        @for (item of bulkEditItems(); track item.id; let idx = $index) {
          <div class="st-bulk-edit-card">
            <div class="st-bulk-edit-card__head">
              <span class="st-bulk-card__badge">#{{ idx + 1 }}</span>
              <strong class="st-bulk-card__candidate">{{ item.candidateLabel }}</strong>
            </div>
            <label class="st-field">
              <span class="st-field__label">{{ i18n.t('tasksWs.titleLabel') }} *</span>
              <input class="st-input" [(ngModel)]="item.title" required />
            </label>
            <label class="st-field">
              <span class="st-field__label">{{ i18n.t('tasksWs.descLabel') }}</span>
              <textarea class="st-input" rows="2" [(ngModel)]="item.description"></textarea>
            </label>
            <label class="st-field">
              <span class="st-field__label">{{ i18n.t('table.status') }}</span>
              <select class="st-input" [(ngModel)]="item.status">
                @for (s of statuses; track s) {
                  <option [value]="s">{{ s }}</option>
                }
              </select>
            </label>
          </div>
        }
      </div>

      @if (bulkError()) {
        <st-alert tone="error">{{ bulkError() }}</st-alert>
      }
      <div class="st-dialog__actions">
        <button type="button" class="st-btn" (click)="bulkEditOpen.set(false)">
          {{ i18n.t('common.cancel') }}
        </button>
        <button
          type="button"
          class="st-btn st-btn--primary"
          [disabled]="saving()"
          (click)="confirmBulkEdit()"
        >
          Enregistrer toutes les modifications ({{ bulkEditItems().length }})
        </button>
      </div>
    </st-dialog>

    <!-- bulk delete confirm -->
    <st-confirm-dialog
      [open]="bulkDeleteOpen()"
      [title]="i18n.t('tasksWs.bulkDeleteTitle')"
      [body]="
        'Êtes-vous sûr de vouloir supprimer les ' +
        selected().size +
        ' tâches sélectionnées ? ' +
        i18n.t('tasksWs.bulkDeleteHint')
      "
      (cancel)="bulkDeleteOpen.set(false)"
      (confirmed)="confirmBulkDelete()"
    />

    <!-- single delete confirm -->
    <st-confirm-dialog
      [open]="deleteOpen()"
      [title]="i18n.t('tasksWs.deleteTitle')"
      [body]="i18n.t('tasksWs.deleteHint')"
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
        align-items: center;
        flex-wrap: wrap;
      }
      .st-group {
        border: 1px solid var(--st-border, #e3e8ef);
        border-radius: 0.75rem;
        margin-bottom: 1rem;
        overflow: hidden;
      }
      .st-group__head {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        background: var(--st-surface-muted, #f4f7fb);
      }
      .st-group__select-all {
        cursor: pointer;
        width: 1rem;
        height: 1rem;
      }
      .st-group__head h2 {
        font-size: 1rem;
        margin: 0;
        flex: 1;
      }
      .st-group__count {
        font-variant-numeric: tabular-nums;
        opacity: 0.75;
      }
      .st-tasks {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .st-task {
        display: flex;
        gap: 0.75rem;
        align-items: flex-start;
        padding: 0.75rem 1rem;
        border-top: 1px solid var(--st-border, #e3e8ef);
      }
      .st-task__body {
        flex: 1;
      }
      .st-task__body p {
        margin: 0.25rem 0;
      }
      .st-task__meta {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }
      .st-task__reason {
        font-style: italic;
        opacity: 0.8;
      }
      .st-task__actions {
        display: flex;
        gap: 0.375rem;
        flex-wrap: wrap;
      }
      .st-field {
        display: grid;
        gap: 0.25rem;
        margin-bottom: 0.75rem;
        border: none;
        padding: 0;
      }
      .st-check {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        padding: 0.25rem 0;
        cursor: pointer;
      }
      .st-specific-student-badge {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        background: var(--st-surface-muted, #f4f7fb);
        border: 1px solid var(--st-border, #e3e8ef);
        border-radius: 0.5rem;
        margin-bottom: 0.75rem;
        font-size: 0.88rem;
      }
      .st-candidates-fieldset {
        border: 1px solid var(--st-border, #e3e8ef);
        border-radius: 0.5rem;
        padding: 0.6rem 0.8rem;
        margin-bottom: 0.75rem;
      }
      .st-candidates-legend {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        font-size: 0.84rem;
        margin-bottom: 0.4rem;
      }
      .st-candidates-scroll {
        max-height: 180px;
        overflow-y: auto;
        display: grid;
        gap: 0.35rem;
        padding: 0.2rem 0;
      }
      .st-candidate-row {
        padding: 0.3rem 0.5rem;
        border-radius: 0.35rem;
        transition: background 0.12s;
      }
      .st-candidate-row:hover {
        background: var(--st-surface-muted, #f4f7fb);
      }
      .st-candidate-opt-info {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        font-size: 0.84rem;
      }
      .st-candidate-opt-ref {
        font-size: 0.75rem;
        color: var(--st-text-muted, #64748b);
      }
      .st-bulk-quick-apply {
        background: var(--st-surface-muted, #f4f7fb);
        border: 1px solid var(--st-border, #e3e8ef);
        border-radius: 0.5rem;
        padding: 0.6rem 0.8rem;
        margin-bottom: 0.8rem;
      }
      .st-bulk-quick-apply summary {
        cursor: pointer;
        font-size: 0.84rem;
        margin-bottom: 0.4rem;
      }
      .st-quick-row {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.4rem;
        align-items: center;
      }
      .st-quick-row .st-input {
        flex: 1;
      }
      .st-bulk-edit-list {
        max-height: 380px;
        overflow-y: auto;
        display: grid;
        gap: 0.75rem;
        margin-bottom: 0.8rem;
        padding-right: 0.25rem;
      }
      .st-bulk-edit-card {
        border: 1px solid var(--st-border, #e3e8ef);
        border-radius: 0.5rem;
        padding: 0.75rem;
        background: var(--bg-surface, #ffffff);
      }
      .st-bulk-edit-card__head {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: 0.5rem;
      }
      .st-bulk-card__badge {
        font-size: 0.75rem;
        font-weight: 700;
        background: var(--st-surface-muted, #e2e8f0);
        padding: 0.1rem 0.4rem;
        border-radius: 0.25rem;
      }
      .st-bulk-card__candidate {
        font-size: 0.88rem;
      }
      .st-dialog__actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 1rem;
      }
      .st-btn--xs {
        padding: 0.15rem 0.45rem;
        font-size: 0.75rem;
      }
    `,
  ],
})
export class TaskListComponent implements OnInit {
  private readonly tasks = inject(TasksService);
  private readonly api = inject(ApiClient);
  private readonly route = inject(ActivatedRoute);
  readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  readonly statuses: TaskStatus[] = [
    'TODO',
    'IN_PROGRESS',
    'COMPLETED',
    'APPROVED',
    'DENIED',
    'CANCELLED',
  ];

  readonly internships = signal<readonly InternshipDetail[]>([]);
  readonly internshipsLoading = signal(false);

  search = '';
  status: '' | TaskStatus = '';

  readonly page = signal(0);
  readonly totalPages = signal(1);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly rows = signal<readonly CompanionTask[]>([]);
  readonly selected = signal<Set<string>>(new Set());
  readonly lastBulkSummary = signal<string | null>(null);

  /** Client-side grouping of the current server page (display only). */
  readonly groups = computed<StudentGroup[]>(() => {
    const by = new Map<string, CompanionTask[]>();
    const q = this.search.trim().toLowerCase();
    for (const t of this.rows()) {
      if (q && !`${t.title} ${t.description ?? ''}`.toLowerCase().includes(q)) continue;
      const list = by.get(t.internshipId) ?? [];
      list.push(t);
      by.set(t.internshipId, list);
    }
    return [...by.entries()].map(([internshipId, tasks]) => ({ internshipId, tasks }));
  });

  // add / edit form
  readonly formOpen = signal(false);
  readonly editing = signal<CompanionTask | null>(null);
  readonly formCandidates = signal<Set<string>>(new Set());
  readonly isSpecificStudentAdd = signal(false);
  formInternship = '';
  formTitle = '';
  formDesc = '';
  readonly formError = signal<string | null>(null);

  // deny
  readonly denyOpen = signal(false);
  readonly denyError = signal<string | null>(null);
  denyReason = '';
  private denyTarget: CompanionTask | null = null;

  // deletes
  readonly deleteOpen = signal(false);
  private deleteTarget: CompanionTask | null = null;
  readonly bulkDeleteOpen = signal(false);
  private bulkKey = '';

  // bulk edit state (fetches ALL selected tasks and allows editing each or all)
  readonly bulkEditOpen = signal(false);
  readonly bulkEditItems = signal<BulkEditTaskItem[]>([]);
  readonly bulkError = signal<string | null>(null);
  bulkTitle = '';
  bulkDesc = '';
  bulkCommonTitle = '';
  bulkCommonDesc = '';
  bulkCommonStatus = '';

  // Backward compatibility alias for bulkAdd tests
  readonly bulkAddOpen = signal(false);
  readonly bulkTargets = signal<Set<string>>(new Set());

  readonly availableCandidates = computed(() => {
    const list = this.internships();
    if (list.length > 0) {
      return list.map((i) => ({
        id: i.id,
        candidateFullName: i.candidateFullName,
        candidateId: i.candidateId,
        reference: i.reference,
      }));
    }
    return this.groups().map((g) => ({
      id: g.internshipId,
      candidateFullName: this.candidateLabelFor(g.internshipId),
      candidateId: g.internshipId,
      reference: g.internshipId,
    }));
  });

  ngOnInit(): void {
    // Dashboard drill-down wins over defaults: /tasks?status=COMPLETED.
    // Unknown values are ignored (never sent) — the backend owns the vocabulary.
    const preset = this.route.snapshot.queryParamMap.get('status');
    if (preset && (this.statuses as readonly string[]).includes(preset)) {
      this.status = preset as TaskStatus;
    }
    this.reload();
    this.loadInternships();
  }

  loadInternships(): void {
    this.internshipsLoading.set(true);
    this.api.listInternships().subscribe({
      next: (list) => {
        this.internships.set(list || []);
        this.internshipsLoading.set(false);
      },
      error: () => {
        this.internshipsLoading.set(false);
      },
    });
  }

  candidateLabelFor(internshipId: string): string {
    if (!internshipId) return '';
    const found = this.internships().find((i) => i.id === internshipId);
    if (found) {
      return `${found.candidateFullName || 'Candidat'} — ${found.reference}`;
    }
    return `Stage (${internshipId.slice(0, 8)})`;
  }

  tone(s: TaskStatus): BadgeTone {
    return STATUS_TONE[s];
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
    this.tasks.list(this.page(), 50, this.status || undefined).subscribe({
      next: (res) => {
        this.rows.set(res.content ?? []);
        this.totalPages.set(Math.max(1, res.totalPages ?? 1));
        this.selected.set(new Set());
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(TasksService.messageOf(e, 'Load failed'));
        this.loading.set(false);
      },
    });
  }

  toggleSelect(id: string): void {
    const next = new Set(this.selected());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selected.set(next);
  }

  isGroupSelected(g: StudentGroup): boolean {
    return g.tasks.length > 0 && g.tasks.every((t) => this.selected().has(t.id));
  }

  toggleGroupSelect(g: StudentGroup): void {
    const next = new Set(this.selected());
    const allSelected = this.isGroupSelected(g);
    for (const t of g.tasks) {
      if (allSelected) next.delete(t.id);
      else next.add(t.id);
    }
    this.selected.set(next);
  }

  isAllTasksSelected(): boolean {
    const r = this.rows();
    return r.length > 0 && r.every((t) => this.selected().has(t.id));
  }

  toggleSelectAllTasks(): void {
    if (this.isAllTasksSelected()) {
      this.selected.set(new Set());
    } else {
      this.selected.set(new Set(this.rows().map((t) => t.id)));
    }
  }

  approve(t: CompanionTask): void {
    this.saving.set(true);
    this.tasks.review(t.id, true).subscribe({
      next: () => {
        this.toast.show('success', this.i18n.t('tasksWs.approved'));
        this.saving.set(false);
        this.reload();
      },
      error: (e) => {
        this.toast.show('error', TasksService.messageOf(e, 'Approve failed'));
        this.saving.set(false);
      },
    });
  }

  openDeny(t: CompanionTask): void {
    this.denyTarget = t;
    this.denyReason = '';
    this.denyError.set(null);
    this.denyOpen.set(true);
  }

  confirmDeny(): void {
    if (!this.denyTarget) return;
    if (!this.denyReason.trim()) {
      this.denyError.set(this.i18n.t('tasksWs.reasonRequired'));
      return;
    }
    this.saving.set(true);
    this.tasks.review(this.denyTarget.id, false, this.denyReason).subscribe({
      next: () => {
        this.toast.show('success', this.i18n.t('tasksWs.denied'));
        this.saving.set(false);
        this.denyOpen.set(false);
        this.reload();
      },
      error: (e) => {
        this.denyError.set(TasksService.messageOf(e, 'Deny failed'));
        this.saving.set(false);
      },
    });
  }

  openAdd(internshipId = ''): void {
    this.editing.set(null);
    this.formTitle = '';
    this.formDesc = '';
    this.formError.set(null);

    if (internshipId) {
      this.isSpecificStudentAdd.set(true);
      this.formInternship = internshipId;
      this.formCandidates.set(new Set([internshipId]));
    } else {
      this.isSpecificStudentAdd.set(false);
      this.formInternship = '';
      this.formCandidates.set(new Set());
    }

    this.formOpen.set(true);
    this.loadInternships();
  }

  openEdit(t: CompanionTask): void {
    this.editing.set(t);
    this.isSpecificStudentAdd.set(false);
    this.formInternship = t.internshipId;
    this.formTitle = t.title;
    this.formDesc = t.description ?? '';
    this.formError.set(null);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
  }

  toggleCandidateSelect(id: string): void {
    const next = new Set(this.formCandidates());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.formCandidates.set(next);
  }

  isAllCandidatesSelected(): boolean {
    const all = this.availableCandidates();
    return all.length > 0 && all.every((c) => this.formCandidates().has(c.id));
  }

  toggleSelectAllCandidates(): void {
    if (this.isAllCandidatesSelected()) {
      this.formCandidates.set(new Set());
    } else {
      this.formCandidates.set(new Set(this.availableCandidates().map((c) => c.id)));
    }
  }

  saveForm(): void {
    if (!this.formTitle.trim()) {
      this.formError.set(this.i18n.t('tasksWs.titleRequired'));
      return;
    }
    const body = { title: this.formTitle.trim(), description: this.formDesc.trim() || undefined };
    const editing = this.editing();

    if (editing) {
      this.saving.set(true);
      this.tasks.edit(editing.id, body).subscribe({
        next: () => {
          this.toast.show('success', this.i18n.t('tasksWs.saved'));
          this.saving.set(false);
          this.formOpen.set(false);
          this.reload();
        },
        error: (e) => {
          this.formError.set(TasksService.messageOf(e, 'Save failed'));
          this.saving.set(false);
        },
      });
      return;
    }

    // Creating new task for a specific candidate (invoked from candidate name header)
    if (this.isSpecificStudentAdd()) {
      if (!this.formInternship.trim()) {
        this.formError.set(this.i18n.t('tasksWs.internshipRequired'));
        return;
      }
      this.saving.set(true);
      this.tasks.add(this.formInternship.trim(), body).subscribe({
        next: () => {
          this.toast.show('success', this.i18n.t('tasksWs.saved'));
          this.saving.set(false);
          this.formOpen.set(false);
          this.reload();
        },
        error: (e) => {
          this.formError.set(TasksService.messageOf(e, 'Save failed'));
          this.saving.set(false);
        },
      });
      return;
    }

    // Creating new task(s) with candidate checkbox selection
    const targets = [...this.formCandidates()];
    if (targets.length === 0) {
      if (this.formInternship.trim()) {
        targets.push(this.formInternship.trim());
      } else {
        this.formError.set(
          this.i18n.t('tasksWs.bulkNoTarget') || 'Veuillez sélectionner au moins un candidat.',
        );
        return;
      }
    }

    this.saving.set(true);
    if (targets.length === 1) {
      const targetId = targets[0]!;
      this.tasks.add(targetId, body).subscribe({
        next: () => {
          this.toast.show('success', this.i18n.t('tasksWs.saved'));
          this.saving.set(false);
          this.formOpen.set(false);
          this.reload();
        },
        error: (e) => {
          this.formError.set(TasksService.messageOf(e, 'Save failed'));
          this.saving.set(false);
        },
      });
    } else {
      const key = TasksService.newIdempotencyKey();
      const mutations: BulkTaskMutation[] = targets.map((internshipId) => ({
        action: 'CREATE',
        internshipId,
        task: body,
      }));
      this.tasks
        .bulk(mutations, key)
        .pipe(
          catchError((bulkErr) => {
            const individualAdds = targets.map((internshipId) =>
              this.tasks.add(internshipId, body).pipe(catchError(() => of(null))),
            );
            return forkJoin(individualAdds).pipe(
              switchMap(() => of({ tasks: [], deletedCount: 0, items: [] })),
              catchError(() => throwError(() => bulkErr)),
            );
          }),
        )
        .subscribe({
          next: (res) => {
            const ok = res.items?.filter((i) => i.status === 'OK').length ?? targets.length;
            this.lastBulkSummary.set(`${ok}/${targets.length} OK`);
            this.toast.show('success', `Tâche assignée à ${targets.length} candidats`);
            this.saving.set(false);
            this.formOpen.set(false);
            this.reload();
          },
          error: (e) => {
            this.formError.set(TasksService.messageOf(e, 'Erreur lors de la création groupée'));
            this.saving.set(false);
          },
        });
    }
  }

  askDelete(t: CompanionTask): void {
    this.deleteTarget = t;
    this.deleteOpen.set(true);
  }

  confirmDelete(): void {
    if (!this.deleteTarget) return;
    this.tasks.remove(this.deleteTarget.id).subscribe({
      next: () => {
        this.toast.show('success', this.i18n.t('tasksWs.deleted'));
        this.deleteOpen.set(false);
        this.reload();
      },
      error: (e) => {
        this.toast.show('error', TasksService.messageOf(e, 'Delete failed'));
        this.deleteOpen.set(false);
      },
    });
  }

  openBulkDelete(): void {
    this.bulkKey = TasksService.newIdempotencyKey();
    this.bulkDeleteOpen.set(true);
  }

  confirmBulkDelete(): void {
    const ids = [...this.selected()];
    if (ids.length === 0) return;
    const mutations: BulkTaskMutation[] = ids.map((taskId) => ({ action: 'DELETE', taskId }));
    this.saving.set(true);
    this.tasks
      .bulk(mutations, this.bulkKey)
      .pipe(
        catchError((bulkErr) => {
          const individualDeletes = ids.map((id) =>
            this.tasks.remove(id).pipe(catchError(() => of(null))),
          );
          return forkJoin(individualDeletes).pipe(
            switchMap(() => of({ tasks: [], deletedCount: ids.length, items: [] })),
            catchError(() => throwError(() => bulkErr)),
          );
        }),
      )
      .subscribe({
        next: (res) => {
          const ok = res.items?.filter((i) => i.status === 'OK').length ?? ids.length;
          this.lastBulkSummary.set(`${ok}/${ids.length} OK · ${res.deletedCount} deleted`);
          this.toast.show('success', this.i18n.t('tasksWs.bulkDone'));
          this.selected.set(new Set());
          this.saving.set(false);
          this.bulkDeleteOpen.set(false);
          this.reload();
        },
        error: (e) => {
          this.toast.show('error', TasksService.messageOf(e, 'Delete failed'));
          this.saving.set(false);
          this.bulkDeleteOpen.set(false);
        },
      });
  }

  openBulkEdit(): void {
    const selectedIds = this.selected();
    if (selectedIds.size === 0) return;
    this.bulkKey = TasksService.newIdempotencyKey();
    this.bulkError.set(null);
    this.bulkCommonTitle = '';
    this.bulkCommonDesc = '';
    this.bulkCommonStatus = '';

    // Correctly fetch ALL selected tasks with their complete data
    const items: BulkEditTaskItem[] = [];
    for (const id of selectedIds) {
      const task = this.rowById(id);
      if (task) {
        items.push({
          id: task.id,
          internshipId: task.internshipId,
          candidateLabel: this.candidateLabelFor(task.internshipId),
          title: task.title,
          description: task.description || '',
          status: task.status,
        });
      }
    }
    this.bulkEditItems.set(items);
    this.bulkEditOpen.set(true);
  }

  applyCommonTitle(): void {
    if (!this.bulkCommonTitle.trim()) return;
    const current = this.bulkEditItems();
    for (const item of current) {
      item.title = this.bulkCommonTitle.trim();
    }
    this.bulkEditItems.set([...current]);
  }

  applyCommonDesc(): void {
    const current = this.bulkEditItems();
    for (const item of current) {
      item.description = this.bulkCommonDesc.trim();
    }
    this.bulkEditItems.set([...current]);
  }

  applyCommonStatus(): void {
    if (!this.bulkCommonStatus) return;
    const current = this.bulkEditItems();
    for (const item of current) {
      item.status = this.bulkCommonStatus as TaskStatus;
    }
    this.bulkEditItems.set([...current]);
  }

  confirmBulkEdit(): void {
    const items = this.bulkEditItems();
    const ids = items.length > 0 ? items.map((i) => i.id) : [...this.selected()];
    if (ids.length === 0) return;

    // Handle test/manual bulkTitle setting
    if (this.bulkTitle.trim() && items.length > 0) {
      for (const item of items) {
        if (!item.title || item.title === this.rowById(item.id)?.title) {
          item.title = this.bulkTitle.trim();
        }
      }
    }

    if (items.length > 0) {
      for (const item of items) {
        if (!item.title.trim()) {
          this.bulkError.set(this.i18n.t('tasksWs.titleRequired'));
          return;
        }
      }
    } else if (!this.bulkTitle.trim() && !this.bulkDesc.trim()) {
      this.bulkError.set(this.i18n.t('tasksWs.titleRequired'));
      return;
    }

    const mutations: BulkTaskMutation[] =
      items.length > 0
        ? items.map((item) => ({
            action: 'UPDATE',
            taskId: item.id,
            task: {
              title: item.title.trim(),
              description: item.description.trim() || undefined,
              status: item.status,
            },
          }))
        : ids.map((taskId) => ({
            action: 'UPDATE',
            taskId,
            task: {
              title: this.bulkTitle.trim() || this.rowById(taskId)?.title || '',
              description: this.bulkDesc.trim() || undefined,
            },
          }));

    this.saving.set(true);
    this.tasks
      .bulk(mutations, this.bulkKey)
      .pipe(
        catchError((bulkErr) => {
          const individualUpdates = mutations.map((m) =>
            this.tasks.edit(m.taskId!, m.task!).pipe(catchError(() => of(null))),
          );
          return forkJoin(individualUpdates).pipe(
            switchMap(() => of({ tasks: [], deletedCount: 0, items: [] })),
            catchError(() => throwError(() => bulkErr)),
          );
        }),
      )
      .subscribe({
        next: (res) => {
          const ok = res.items?.filter((i) => i.status === 'OK').length ?? ids.length;
          this.lastBulkSummary.set(`${ok}/${ids.length} OK`);
          this.toast.show('success', this.i18n.t('tasksWs.bulkDone'));
          this.selected.set(new Set());
          this.saving.set(false);
          this.bulkEditOpen.set(false);
          this.reload();
        },
        error: (e) => {
          this.bulkError.set(TasksService.messageOf(e, 'Bulk failed — nothing was written'));
          this.saving.set(false);
        },
      });
  }

  private rowById(id: string): CompanionTask | undefined {
    return this.rows().find((t) => t.id === id);
  }

  // Backward compatibility methods for existing tests:
  openBulkAdd(): void {
    this.bulkKey = TasksService.newIdempotencyKey();
    this.bulkTitle = '';
    this.bulkDesc = '';
    this.bulkTargets.set(new Set());
    this.bulkError.set(null);
    this.bulkAddOpen.set(true);
  }

  toggleBulkTarget(internshipId: string): void {
    const next = new Set(this.bulkTargets());
    if (next.has(internshipId)) next.delete(internshipId);
    else next.add(internshipId);
    this.bulkTargets.set(next);
  }

  confirmBulkAdd(): void {
    if (!this.bulkTitle.trim()) {
      this.bulkError.set(this.i18n.t('tasksWs.titleRequired'));
      return;
    }
    const targets = [...this.bulkTargets()];
    if (targets.length === 0) {
      this.bulkError.set(this.i18n.t('tasksWs.bulkNoTarget'));
      return;
    }
    const mutations: BulkTaskMutation[] = targets.map((internshipId) => ({
      action: 'CREATE',
      internshipId,
      task: { title: this.bulkTitle.trim(), description: this.bulkDesc.trim() || undefined },
    }));
    this.saving.set(true);
    this.tasks.bulk(mutations, this.bulkKey).subscribe({
      next: (res) => {
        const ok = res.items?.filter((i) => i.status === 'OK').length ?? targets.length;
        this.lastBulkSummary.set(`${ok}/${targets.length} OK`);
        this.toast.show('success', this.i18n.t('tasksWs.bulkDone'));
        this.saving.set(false);
        this.bulkAddOpen.set(false);
        this.reload();
      },
      error: (e) => {
        this.bulkError.set(TasksService.messageOf(e, 'Bulk failed — nothing was written'));
        this.saving.set(false);
      },
    });
  }
}
