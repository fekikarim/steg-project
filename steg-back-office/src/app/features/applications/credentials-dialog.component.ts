import { Component, EventEmitter, Input, OnChanges, Output, inject, signal } from '@angular/core';
import { DialogComponent } from '../../shared/ui/dialog.component';
import { I18nService } from '../../core/i18n.service';

/**
 * One-time credentials dialog (AGENTS.md §5.3).
 *
 * The plaintext password is received as an input for this display only; the
 * parent clears it when the dialog closes, so it never stays in app state.
 * Copy is best-effort (clipboard may be unavailable in some browsers) and the
 * status of the credentials email is always shown; Resend asks the backend for
 * a NEW password (the old one is never retrievable).
 */
@Component({
  selector: 'st-credentials-dialog',
  standalone: true,
  imports: [DialogComponent],
  template: `
    <st-dialog [open]="open" [title]="i18n.t('credentials.title')" (close)="closed.emit()">
      <p class="st-hint">{{ i18n.t('credentials.shownOnce') }}</p>

      <dl class="st-defs">
        <div>
          <dt>{{ i18n.t('credentials.email') }}</dt>
          <dd dir="ltr">{{ email }}</dd>
        </div>
        <div>
          <dt>{{ i18n.t('credentials.password') }}</dt>
          <dd>
            <code dir="ltr">{{ password }}</code>
            <button
              type="button"
              class="st-btn st-btn--secondary"
              [disabled]="!password"
              (click)="copy()"
            >
              {{ copied() ? i18n.t('credentials.copied') : i18n.t('credentials.copy') }}
            </button>
          </dd>
        </div>
      </dl>

      @if (emailSent) {
        <p class="st-flag st-flag--ok" role="status">{{ i18n.t('credentials.emailSent') }}</p>
      } @else {
        <p class="st-field__error" role="alert">{{ i18n.t('credentials.emailFailed') }}</p>
      }

      <div slot="footer" class="st-dialog__actions">
        <button
          type="button"
          class="st-btn st-btn--secondary"
          [disabled]="resendBusy"
          (click)="resendRequested.emit()"
        >
          {{ i18n.t('credentials.resend') }}
        </button>
        <button type="button" class="st-btn st-btn--primary" (click)="closed.emit()">
          {{ i18n.t('credentials.close') }}
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
      code {
        font-family: var(--font-mono, monospace);
        font-size: 0.95rem;
        overflow-wrap: anywhere;
      }
      dd {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .st-flag--ok {
        color: var(--success-fg, #1b7f4b);
        font-weight: 600;
      }
    `,
  ],
})
export class CredentialsDialogComponent implements OnChanges {
  readonly i18n = inject(I18nService);

  @Input() open = false;
  @Input() email = '';
  @Input() password = '';
  @Input() emailSent = false;
  @Input() resendBusy = false;

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly resendRequested = new EventEmitter<void>();

  readonly copied = signal(false);

  ngOnChanges(): void {
    if (this.open) this.copied.set(false);
  }

  copy(): void {
    const value = this.password;
    if (!value) return;
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (clipboard?.writeText) {
      void clipboard
        .writeText(value)
        .then(() => this.copied.set(true))
        .catch(() => this.copied.set(false));
    }
  }
}
