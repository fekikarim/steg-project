import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { ToastService } from '../../shared/ui/toast.service';
import { TaskDraftsService } from './task-drafts.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { DialogComponent, ConfirmDialogComponent } from '../../shared/ui/dialog.component';
import type { BulkAddDraftsResult, InternshipDetail, TaskDraft } from '../../core/api-models';

/**
 * AI task-draft review workspace (AGENTS.md §7.4 — S10c UI over the S10a
 * backend), reachable from the Tasks workspace.
 *
 * Server-side drafts (never real tasks until bulk-added): upload a specs PDF
 * for one reference student, list drafts, edit manually, revise with AI from
 * a free-text instruction, add manually (works when AI is down), delete, then
 * bulk-add the approved drafts to one or more students atomically with a
 * per-item result.
 *
 * No rule lives here: Admin may use any student while a Supervisor is limited
 * to his own (404 otherwise), validation and atomicity are backend-owned.
 * Every student picker is fed from `GET /api/internships`, which the backend
 * scopes by role — the client sends no scope parameter, so a supervisor's
 * picker shows only his own students.
 */
@Component({
  selector: 'st-draft-review',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    LiveStatusComponent,
    PageHeaderComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    AlertComponent,
    DialogComponent,
    ConfirmDialogComponent,
  ],
  template: `
    <st-page-header [title]="i18n.t('drafts.title')" [subtitle]="i18n.t('drafts.subtitle')">
      <st-live-status />
      <a routerLink="/tasks" class="st-btn">{{ i18n.t('drafts.backToTasks') }}</a>
    </st-page-header>

    @if (loading()) {
      <st-skeleton [rows]="6" />
    } @else if (loadError()) {
      <st-error-state
        [title]="i18n.t('common.error.title')"
        [body]="loadError()!"
        [retryLabel]="i18n.t('common.retry')"
        (retry)="reload()"
      />
    } @else {
      <!-- generate from specs PDF -->
      <section class="st-card" aria-label="generate">
        <h2>{{ i18n.t('drafts.generateTitle') }}</h2>
        <div class="st-row">
          <label class="st-field">
            <span>{{ i18n.t('drafts.pdfLabel') }}</span>
            <input
              type="file"
              class="st-input"
              accept="application/pdf"
              (change)="onFile($event)"
            />
            <small>{{ i18n.t('drafts.pdfHint') }}</small>
          </label>
          <label class="st-field">
            <span>{{ i18n.t('drafts.referenceStudent') }}</span>
            <select class="st-input" [(ngModel)]="genInternship">
              <option value="">{{ i18n.t('drafts.studentRequired') }}</option>
              @for (s of students(); track s.id) {
                <option [value]="s.id">{{ s.candidateFullName }} · {{ s.reference }}</option>
              }
            </select>
          </label>
          <button
            type="button"
            class="st-btn st-btn--primary"
            [disabled]="generating() || !pickedFile() || !genInternship"
            (click)="confirmGenerate()"
          >
            {{ generating() ? i18n.t('drafts.generating') : i18n.t('drafts.generate') }}
          </button>
        </div>
        @if (genError()) {
          <st-alert [tone]="genUnavailable() ? 'warning' : 'error'">{{ genError() }}</st-alert>
        }
      </section>

      <!-- drafts list -->
      <section class="st-card" aria-label="drafts">
        <h2>{{ i18n.t('drafts.listTitle') }} ({{ drafts().length }})</h2>
        @if (drafts().length === 0) {
          <st-empty-state [title]="i18n.t('drafts.empty')" [body]="''" />
        } @else {
          <ul class="st-rows">
            @for (d of drafts(); track d.id) {
              <li class="st-row">
                <input
                  type="checkbox"
                  [checked]="selectedDrafts().has(d.id)"
                  (change)="toggleDraft(d.id)"
                  [attr.aria-label]="d.title"
                />
                <div class="st-row__meta">
                  <strong dir="auto">{{ d.title }}</strong>
                  @if (d.description) {
                    <p dir="auto">{{ d.description }}</p>
                  }
                  <span class="st-row__sub" dir="ltr">
                    {{ studentLabel(d.referenceInternshipId) }}
                    @if (d.dueDate) {
                      <span> · {{ d.dueDate }}</span>
                    }
                  </span>
                </div>
                <div class="st-row__actions">
                  <button type="button" class="st-btn st-btn--sm" (click)="openEdit(d)">
                    {{ i18n.t('drafts.editDraft') }}
                  </button>
                  <button type="button" class="st-btn st-btn--sm" (click)="openRevise(d)">
                    {{ i18n.t('drafts.reviseDraft') }}
                  </button>
                  <button
                    type="button"
                    class="st-btn st-btn--sm st-btn--danger"
                    (click)="askDeleteDraft(d)"
                  >
                    {{ i18n.t('drafts.deleteDraft') }}
                  </button>
                </div>
              </li>
            }
          </ul>
        }
      </section>

      <!-- manual add (works when AI is down) -->
      <section class="st-card" aria-label="manual-add">
        <h2>{{ i18n.t('drafts.addTitle') }}</h2>
        <p>{{ i18n.t('drafts.addHint') }}</p>
        <div class="st-row">
          <label class="st-field">
            <span>{{ i18n.t('drafts.referenceStudent') }}</span>
            <select class="st-input" [(ngModel)]="addInternship">
              <option value="">{{ i18n.t('drafts.studentRequired') }}</option>
              @for (s of students(); track s.id) {
                <option [value]="s.id">{{ s.candidateFullName }} · {{ s.reference }}</option>
              }
            </select>
          </label>
          <label class="st-field">
            <span>{{ i18n.t('drafts.titleLabel') }}</span>
            <input class="st-input" [(ngModel)]="addTitle" dir="auto" />
          </label>
          <label class="st-field">
            <span>{{ i18n.t('drafts.descLabel') }}</span>
            <textarea class="st-input" rows="2" [(ngModel)]="addDesc" dir="auto"></textarea>
          </label>
          <label class="st-field">
            <span>{{ i18n.t('drafts.dueLabel') }}</span>
            <input type="date" class="st-input" [(ngModel)]="addDue" dir="ltr" />
          </label>
          <button
            type="button"
            class="st-btn st-btn--primary"
            [disabled]="saving()"
            (click)="confirmAdd()"
          >
            {{ i18n.t('drafts.add') }}
          </button>
        </div>
        @if (addError()) {
          <st-alert tone="error">{{ addError() }}</st-alert>
        }
      </section>

      <!-- atomic bulk add to several students -->
      <section class="st-card" aria-label="bulk-add">
        <h2>{{ i18n.t('drafts.bulkTitle') }}</h2>
        <p>{{ i18n.t('drafts.bulkHint') }}</p>
        <fieldset class="st-field">
          <legend>{{ i18n.t('drafts.targets') }} ({{ targetInternships().size }})</legend>
          @for (s of students(); track s.id) {
            <label class="st-check">
              <input
                type="checkbox"
                [checked]="targetInternships().has(s.id)"
                (change)="toggleTarget(s.id)"
              />
              {{ s.candidateFullName }} · {{ s.reference }}
            </label>
          }
        </fieldset>
        <button
          type="button"
          class="st-btn st-btn--primary"
          [disabled]="bulking() || selectedDrafts().size === 0"
          (click)="confirmBulkAdd()"
        >
          {{ bulking() ? i18n.t('drafts.bulking') : i18n.t('drafts.bulkAdd') }}
          ({{ selectedDrafts().size }})
        </button>
        @if (bulkError()) {
          <st-alert tone="error">{{ bulkError() }}</st-alert>
        }
        @if (bulkResult()) {
          <st-alert tone="info">{{ bulkSummary() }}</st-alert>
          <ul class="st-rows">
            @for (item of bulkResult()!.items; track item.index) {
              <li class="st-row st-row--slim">
                <span dir="auto"
                  >{{ draftTitle(item.draftId) }} → {{ studentLabel(item.internshipId) }}</span
                >
                <strong>{{ item.status }}</strong>
              </li>
            }
          </ul>
        }
      </section>
    }

    <!-- manual edit dialog -->
    <st-dialog
      [open]="editOpen()"
      [title]="i18n.t('drafts.editTitle')"
      (close)="editOpen.set(false)"
    >
      <label class="st-field">
        <span>{{ i18n.t('drafts.titleLabel') }}</span>
        <input class="st-input" [(ngModel)]="editTitle" dir="auto" />
      </label>
      <label class="st-field">
        <span>{{ i18n.t('drafts.descLabel') }}</span>
        <textarea class="st-input" rows="3" [(ngModel)]="editDesc" dir="auto"></textarea>
      </label>
      <label class="st-field">
        <span>{{ i18n.t('drafts.dueLabel') }}</span>
        <input type="date" class="st-input" [(ngModel)]="editDue" dir="ltr" />
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
          {{ i18n.t('common.save') }}
        </button>
      </div>
    </st-dialog>

    <!-- AI revise dialog -->
    <st-dialog
      [open]="reviseOpen()"
      [title]="i18n.t('drafts.reviseDraft')"
      (close)="reviseOpen.set(false)"
    >
      <p>{{ i18n.t('drafts.instructionHint') }}</p>
      <label class="st-field">
        <span>{{ i18n.t('drafts.instructionLabel') }}</span>
        <textarea class="st-input" rows="3" [(ngModel)]="reviseInstruction" dir="auto"></textarea>
      </label>
      @if (reviseError()) {
        <st-alert [tone]="reviseUnavailable() ? 'warning' : 'error'">{{ reviseError() }}</st-alert>
      }
      <div class="st-dialog__actions">
        <button type="button" class="st-btn" (click)="reviseOpen.set(false)">
          {{ i18n.t('common.cancel') }}
        </button>
        <button
          type="button"
          class="st-btn st-btn--primary"
          [disabled]="saving()"
          (click)="confirmRevise()"
        >
          {{ i18n.t('drafts.revise') }}
        </button>
      </div>
    </st-dialog>

    <!-- delete confirm -->
    <st-confirm-dialog
      [open]="deleteOpen()"
      [title]="i18n.t('drafts.deleteTitle')"
      [body]="i18n.t('drafts.deleteHint')"
      (cancel)="deleteOpen.set(false)"
      (confirmed)="confirmDeleteDraft()"
    />
  `,
  styles: [
    `
      .st-card {
        border: 1px solid var(--st-border, #e3e8ef);
        border-radius: 0.75rem;
        padding: 1rem;
        margin-bottom: 1rem;
        background: var(--bg-surface);
      }
      .st-card h2 {
        font-size: 1rem;
        margin: 0 0 0.75rem;
      }
      .st-row {
        display: flex;
        gap: 0.75rem;
        align-items: flex-end;
        flex-wrap: wrap;
      }
      .st-field {
        display: grid;
        gap: 0.25rem;
        margin-bottom: 0.75rem;
        border: none;
        padding: 0;
        min-inline-size: 10rem;
      }
      .st-field small {
        font-size: 0.72rem;
        color: var(--text-muted);
      }
      .st-check {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        padding: 0.25rem 0;
      }
      .st-rows {
        list-style: none;
        margin: 0.5rem 0 0;
        padding: 0;
        display: grid;
        gap: 0.55rem;
      }
      .st-row--slim {
        align-items: center;
      }
      .st-row__meta {
        display: grid;
        gap: 0.2rem;
        flex: 1;
        min-inline-size: 14rem;
        font-size: 0.85rem;
      }
      .st-row__meta p {
        margin: 0;
      }
      .st-row__sub {
        font-size: 0.75rem;
        color: var(--text-muted);
        overflow-wrap: anywhere;
      }
      .st-row__actions {
        display: flex;
        gap: 0.375rem;
        flex-wrap: wrap;
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
export class DraftReviewComponent implements OnInit {
  private readonly draftsApi = inject(TaskDraftsService);
  readonly i18n = inject(I18nService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly generating = signal(false);
  readonly bulking = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly drafts = signal<readonly TaskDraft[]>([]);
  readonly students = signal<readonly InternshipDetail[]>([]);
  readonly selectedDrafts = signal<Set<string>>(new Set());
  readonly targetInternships = signal<Set<string>>(new Set());
  readonly bulkResult = signal<BulkAddDraftsResult | null>(null);
  readonly bulkSummary = signal<string | null>(null);
  readonly bulkError = signal<string | null>(null);
  private bulkKey = '';

  // generate
  readonly genError = signal<string | null>(null);
  readonly genUnavailable = signal(false);
  genInternship = '';
  private picked: File | null = null;

  // manual add
  addInternship = '';
  addTitle = '';
  addDesc = '';
  addDue = '';
  readonly addError = signal<string | null>(null);

  // manual edit
  readonly editOpen = signal(false);
  readonly editError = signal<string | null>(null);
  private editTarget: TaskDraft | null = null;
  editTitle = '';
  editDesc = '';
  editDue = '';

  // AI revise
  readonly reviseOpen = signal(false);
  readonly reviseError = signal<string | null>(null);
  readonly reviseUnavailable = signal(false);
  private reviseTarget: TaskDraft | null = null;
  reviseInstruction = '';

  // delete
  readonly deleteOpen = signal(false);
  private deleteTarget: TaskDraft | null = null;

  /** "ok/total OK" summary of the last bulk-add result. */
  readonly bulkOkCount = computed(() => {
    const items = this.bulkResult()?.items ?? [];
    return items.filter((i) => i.status === 'OK').length;
  });

  ngOnInit(): void {
    this.crumbs.set([
      { labelKey: 'nav.tasks', labelFallback: 'Tasks' },
      { labelKey: 'drafts.title', labelFallback: 'AI drafts' },
    ]);
    this.reload();
  }

  pickedFile(): File | null {
    return this.picked;
  }

  studentLabel(internshipId: string): string {
    const s = this.students().find((x) => x.id === internshipId);
    return s ? `${s.candidateFullName} · ${s.reference}` : internshipId.slice(0, 8);
  }

  draftTitle(draftId: string): string {
    return this.drafts().find((d) => d.id === draftId)?.title ?? draftId.slice(0, 8);
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.draftsApi.students().subscribe({
      next: (students) => {
        this.students.set(students);
        this.refreshDrafts();
      },
      error: (e) => {
        this.loadError.set(TaskDraftsService.messageOf(e, 'Load failed'));
        this.loading.set(false);
      },
    });
  }

  private refreshDrafts(): void {
    this.draftsApi.list().subscribe({
      next: (drafts) => {
        this.drafts.set(drafts);
        this.selectedDrafts.set(new Set());
        this.loading.set(false);
      },
      error: (e) => {
        this.loadError.set(TaskDraftsService.messageOf(e, 'Load failed'));
        this.loading.set(false);
      },
    });
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.genError.set(null);
    this.genUnavailable.set(false);
    if (!file) {
      this.picked = null;
      return;
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.picked = null;
      this.genError.set(this.i18n.t('drafts.pdfRequired'));
      return;
    }
    this.picked = file;
  }

  confirmGenerate(): void {
    const file = this.picked;
    if (!file || !this.genInternship) return;
    this.generating.set(true);
    this.genError.set(null);
    this.genUnavailable.set(false);
    this.draftsApi.generate(file, this.genInternship).subscribe({
      next: (created) => {
        this.drafts.set([...created, ...this.drafts()]);
        this.toast.show('success', this.i18n.t('drafts.generated', { n: String(created.length) }));
        this.generating.set(false);
      },
      error: (e) => {
        this.genUnavailable.set(TaskDraftsService.isUnavailable(e));
        this.genError.set(TaskDraftsService.messageOf(e, 'Generate failed'));
        this.generating.set(false);
      },
    });
  }

  toggleDraft(id: string): void {
    const next = new Set(this.selectedDrafts());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedDrafts.set(next);
  }

  toggleTarget(id: string): void {
    const next = new Set(this.targetInternships());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.targetInternships.set(next);
  }

  confirmAdd(): void {
    if (!this.addInternship) {
      this.addError.set(this.i18n.t('drafts.studentRequired'));
      return;
    }
    if (!this.addTitle.trim()) {
      this.addError.set(this.i18n.t('drafts.titleRequired'));
      return;
    }
    this.saving.set(true);
    this.addError.set(null);
    this.draftsApi
      .add({
        referenceInternshipId: this.addInternship,
        title: this.addTitle.trim(),
        description: this.addDesc.trim() || undefined,
        dueDate: this.addDue || null,
      })
      .subscribe({
        next: (created) => {
          this.drafts.set([created, ...this.drafts()]);
          this.toast.show('success', this.i18n.t('drafts.added'));
          this.saving.set(false);
          this.addTitle = '';
          this.addDesc = '';
          this.addDue = '';
        },
        error: (e) => {
          this.addError.set(TaskDraftsService.messageOf(e, 'Add failed'));
          this.saving.set(false);
        },
      });
  }

  openEdit(d: TaskDraft): void {
    this.editTarget = d;
    this.editTitle = d.title;
    this.editDesc = d.description ?? '';
    this.editDue = d.dueDate ?? '';
    this.editError.set(null);
    this.editOpen.set(true);
  }

  confirmEdit(): void {
    if (!this.editTarget) return;
    if (!this.editTitle.trim()) {
      this.editError.set(this.i18n.t('drafts.titleRequired'));
      return;
    }
    this.saving.set(true);
    this.editError.set(null);
    this.draftsApi
      .edit(this.editTarget.id, {
        title: this.editTitle.trim(),
        description: this.editDesc.trim() || null,
        dueDate: this.editDue || null,
      })
      .subscribe({
        next: (updated) => {
          this.drafts.set(this.drafts().map((d) => (d.id === updated.id ? updated : d)));
          this.toast.show('success', this.i18n.t('drafts.saved'));
          this.saving.set(false);
          this.editOpen.set(false);
        },
        error: (e) => {
          this.editError.set(TaskDraftsService.messageOf(e, 'Save failed'));
          this.saving.set(false);
        },
      });
  }

  openRevise(d: TaskDraft): void {
    this.reviseTarget = d;
    this.reviseInstruction = '';
    this.reviseError.set(null);
    this.reviseUnavailable.set(false);
    this.reviseOpen.set(true);
  }

  confirmRevise(): void {
    if (!this.reviseTarget) return;
    if (!this.reviseInstruction.trim()) {
      this.reviseError.set(this.i18n.t('drafts.instructionRequired'));
      return;
    }
    this.saving.set(true);
    this.reviseError.set(null);
    this.reviseUnavailable.set(false);
    this.draftsApi.revise(this.reviseTarget.id, this.reviseInstruction.trim()).subscribe({
      next: (updated) => {
        this.drafts.set(this.drafts().map((d) => (d.id === updated.id ? updated : d)));
        this.toast.show('success', this.i18n.t('drafts.revised'));
        this.saving.set(false);
        this.reviseOpen.set(false);
      },
      error: (e) => {
        this.reviseUnavailable.set(TaskDraftsService.isUnavailable(e));
        this.reviseError.set(TaskDraftsService.messageOf(e, 'Revise failed'));
        this.saving.set(false);
      },
    });
  }

  askDeleteDraft(d: TaskDraft): void {
    this.deleteTarget = d;
    this.deleteOpen.set(true);
  }

  confirmDeleteDraft(): void {
    if (!this.deleteTarget) return;
    const id = this.deleteTarget.id;
    this.draftsApi.remove(id).subscribe({
      next: () => {
        this.drafts.set(this.drafts().filter((d) => d.id !== id));
        const selected = new Set(this.selectedDrafts());
        selected.delete(id);
        this.selectedDrafts.set(selected);
        this.toast.show('success', this.i18n.t('drafts.deleted'));
        this.deleteOpen.set(false);
      },
      error: (e) => {
        this.toast.show('error', TaskDraftsService.messageOf(e, 'Delete failed'));
        this.deleteOpen.set(false);
      },
    });
  }

  confirmBulkAdd(): void {
    const draftIds = [...this.selectedDrafts()];
    const internshipIds = [...this.targetInternships()];
    if (draftIds.length === 0) {
      this.bulkError.set(this.i18n.t('drafts.noDrafts'));
      return;
    }
    if (internshipIds.length === 0) {
      this.bulkError.set(this.i18n.t('drafts.noTargets'));
      return;
    }
    // One key per bulk operation, kept across retries of the SAME operation:
    // a retry after a network failure replays instead of duplicating, while
    // every new operation mints a fresh key.
    if (!this.bulkKey) this.bulkKey = TaskDraftsService.newIdempotencyKey();
    this.bulking.set(true);
    this.bulkError.set(null);
    this.draftsApi.bulkAdd({ draftIds, internshipIds }, this.bulkKey).subscribe({
      next: (res) => {
        const ok = res.items?.filter((i) => i.status === 'OK').length ?? 0;
        this.bulkResult.set(res);
        this.bulkSummary.set(`${ok}/${res.items?.length ?? 0} OK`);
        this.toast.show('success', this.i18n.t('drafts.bulkDone'));
        this.bulking.set(false);
        this.bulkKey = '';
      },
      error: (e) => {
        this.bulkError.set(TaskDraftsService.messageOf(e, 'Bulk failed — nothing was written'));
        this.bulking.set(false);
      },
    });
  }
}
