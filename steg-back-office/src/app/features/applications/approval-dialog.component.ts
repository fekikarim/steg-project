import { Component, EventEmitter, Input, OnChanges, Output, inject, signal } from '@angular/core';
import { DialogComponent } from '../../shared/ui/dialog.component';
import { I18nService } from '../../core/i18n.service';
import type { Department, SupervisorOption } from '../../core/api-models';

export interface ApprovalSelection {
  readonly supervisorUserId: string | null;
  readonly departmentId: string;
}

/**
 * Supervisor validation step of the approval flow (AGENTS.md §5.2 step 2).
 *
 * The acting Admin is preselected ("I will supervise this candidate"); the
 * list comes from GET /api/supervisors and includes the Admin himself. The
 * backend still owns the rule: a missing supervisorUserId defaults to the
 * approving Admin, so this dialog can never produce an orphan approval.
 */
@Component({
  selector: 'st-approval-dialog',
  standalone: true,
  imports: [DialogComponent],
  template: `
    <st-dialog [open]="open" [title]="i18n.t('approval.title')" (close)="cancelled.emit()">
      <p class="st-hint">{{ i18n.t('approval.hint') }}</p>

      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('approval.supervisor') }} *</span>
        <select
          class="st-input"
          [value]="supervisorId()"
          [disabled]="busy"
          (change)="onSupervisor($event)"
        >
          @for (s of supervisors; track s.userId) {
            <option [value]="s.userId">{{ supervisorLabel(s) }}</option>
          }
        </select>
      </label>

      <label class="st-field">
        <span class="st-field__label">{{ i18n.t('approval.department') }} *</span>
        <select
          class="st-input"
          [value]="departmentId()"
          [disabled]="busy"
          (change)="onDepartment($event)"
        >
          @for (d of departments; track d.id) {
            <option [value]="d.id">{{ d.name || d.code || d.id }}</option>
          }
        </select>
      </label>

      @if (supervisors.length === 0 || departments.length === 0) {
        <p class="st-field__error" role="alert">{{ i18n.t('approval.missingOptions') }}</p>
      }

      <div slot="footer" class="st-dialog__actions">
        <button type="button" class="st-btn st-btn--secondary" (click)="cancelled.emit()">
          {{ i18n.t('common.cancel') }}
        </button>
        <button
          type="button"
          class="st-btn st-btn--primary"
          [disabled]="busy || !canConfirm()"
          (click)="confirm()"
        >
          {{ i18n.t('approval.confirm') }}
        </button>
      </div>
    </st-dialog>
  `,
  styles: [
    `
      .st-dialog__actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
      }
    `,
  ],
})
export class ApprovalDialogComponent implements OnChanges {
  readonly i18n = inject(I18nService);

  @Input() open = false;
  @Input() supervisors: readonly SupervisorOption[] = [];
  @Input() departments: readonly Department[] = [];
  /** The acting Admin: preselected when present in the supervisor list. */
  @Input() preselectedUserId: string | null = null;
  @Input() busy = false;

  @Output() readonly confirmed = new EventEmitter<ApprovalSelection>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly supervisorId = signal('');
  readonly departmentId = signal('');

  ngOnChanges(): void {
    if (!this.open) return;
    if (!this.supervisorId() || !this.supervisors.some((s) => s.userId === this.supervisorId())) {
      const preferred =
        this.preselectedUserId && this.supervisors.some((s) => s.userId === this.preselectedUserId)
          ? this.preselectedUserId
          : (this.supervisors[0]?.userId ?? '');
      this.supervisorId.set(preferred);
    }
    const firstDepartment = this.departments[0];
    if (!this.departmentId() && firstDepartment) {
      this.departmentId.set(firstDepartment.id);
    }
  }

  supervisorLabel(s: SupervisorOption): string {
    const role =
      s.role === 'ADMIN'
        ? this.i18n.t('approval.roleAdmin')
        : this.i18n.t('approval.roleSupervisor');
    return `${s.email} — ${role}`;
  }

  onSupervisor(event: Event): void {
    this.supervisorId.set((event.target as HTMLSelectElement).value);
  }

  onDepartment(event: Event): void {
    this.departmentId.set((event.target as HTMLSelectElement).value);
  }

  canConfirm(): boolean {
    return Boolean(this.supervisorId()) && Boolean(this.departmentId());
  }

  confirm(): void {
    if (!this.canConfirm()) return;
    this.confirmed.emit({
      supervisorUserId: this.supervisorId(),
      departmentId: this.departmentId(),
    });
  }
}
