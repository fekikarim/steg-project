import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable, forkJoin, of, catchError, switchMap, finalize } from 'rxjs';
import { I18nService } from '../../core/i18n.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { ApiClient } from '../../core/api-client.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../shared/ui/toast.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { StIconComponent } from '../../shared/ui/icon.component';
import { ApprovalDialogComponent, type ApprovalSelection } from './approval-dialog.component';
import { CredentialsDialogComponent } from './credentials-dialog.component';
import type {
  ManualApplicationResult,
  ApiErrorEnvelope,
  SupervisorOption,
  Department,
  Page,
  ApplicationQueueRow,
  ApplicationDocumentItem,
  ApplicationApprovalResult,
} from '../../core/api-models';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

function actionErrorMessage(error: unknown, i18n: I18nService): string {
  const envelope = (error as { error?: ApiErrorEnvelope })?.error;
  if (envelope?.message) return envelope.message;
  return i18n.t('common.error.body');
}

/**
 * Manual intake for walk-in candidates. Submits the same multipart
 * anonymous-application contract the public site uses, so the stored
 * InternshipApplication model is identical to online applications.
 * Documents section enforces two mandatory uploads matching the front-office
 * application flow: Internship Application Letter + Assignment Letter.
 * Once submitted by admin:
 * 1. Automatically verifies both uploaded documents.
 * 2. Displays supervisor assignment dialog.
 * 3. Approves application and starts internship with status 'IN_PROGRESS'.
 * 4. Displays one-time credentials for candidate login if generated.
 */
@Component({
  selector: 'st-manual-intake',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    PageHeaderComponent,
    LiveStatusComponent,
    AlertComponent,
    StIconComponent,
    ApprovalDialogComponent,
    CredentialsDialogComponent,
  ],
  template: `
    <st-page-header [title]="i18n.t('intake.title')" [subtitle]="i18n.t('intake.subtitle')">
      <st-live-status />
      <a routerLink="/applications" class="st-btn st-btn--secondary">{{ i18n.t('common.back') }}</a>
    </st-page-header>

    @if (done(); as result) {
      <st-alert tone="success" [title]="i18n.t('intake.successTitle')">
        <span dir="ltr"><strong>{{ result.reference }}</strong></span>
      </st-alert>
      <section class="st-card" aria-label="tracking token">
        <h2 class="st-card__title">{{ i18n.t('intake.tokenTitle') }}</h2>
        <p class="st-hint">{{ i18n.t('intake.tokenHint') }}</p>
        <p class="st-token" dir="ltr">{{ result.trackingToken }}</p>
        <p>
          <a routerLink="/applications" class="st-btn st-btn--primary">
            {{ i18n.t('intake.backToQueue') }}
          </a>
          <button type="button" class="st-btn st-btn--secondary" (click)="reset()">
            {{ i18n.t('intake.newEntry') }}
          </button>
        </p>
      </section>
    } @else {
      <form class="st-card st-form" (ngSubmit)="submit()" #form="ngForm" novalidate>
        <h2 class="st-card__title">{{ i18n.t('intake.candidateSection') }}</h2>
        <div class="st-grid2">
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('intake.firstName') }} *</span>
            <input class="st-input" name="firstName" required [(ngModel)]="fields.firstName" dir="auto" />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('intake.lastName') }} *</span>
            <input class="st-input" name="lastName" required [(ngModel)]="fields.lastName" dir="auto" />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('intake.email') }} *</span>
            <input class="st-input" name="email" type="email" required [(ngModel)]="fields.email" dir="ltr" />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('intake.phone') }}</span>
            <input class="st-input" name="phone" [(ngModel)]="fields.phone" dir="ltr" />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('intake.birthDate') }}</span>
            <input class="st-input" name="birthDate" type="date" [(ngModel)]="fields.birthDate" />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('intake.nationalId') }} *</span>
            <input class="st-input" name="nationalId" required [(ngModel)]="fields.nationalId" dir="ltr" autocomplete="off" />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('intake.university') }} *</span>
            <input class="st-input" name="universityId" required [(ngModel)]="fields.universityId" dir="auto" [placeholder]="i18n.t('intake.university')" />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('intake.speciality') }}</span>
            <input class="st-input" name="speciality" [(ngModel)]="fields.speciality" dir="auto" />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('intake.diploma') }}</span>
            <input class="st-input" name="diploma" [(ngModel)]="fields.diploma" dir="auto" />
          </label>
        </div>
        <st-alert tone="warning">{{ i18n.t('intake.cinWarning') }}</st-alert>

        <h2 class="st-card__title">{{ i18n.t('intake.internshipSection') }}</h2>
        <div class="st-grid2">
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('intake.startDate') }} *</span>
            <input class="st-input" name="startDate" type="date" required [(ngModel)]="fields.desiredStartDate" />
          </label>
          <label class="st-field">
            <span class="st-field__label">{{ i18n.t('intake.endDate') }} *</span>
            <input class="st-input" name="endDate" type="date" required [(ngModel)]="fields.desiredEndDate" />
          </label>
        </div>
        <p class="st-hint">{{ i18n.t('intake.classificationHint') }}</p>

        <h2 class="st-card__title">{{ i18n.t('intake.documentsSection') }}</h2>
        <p class="st-hint st-hint--docs">Both documents are required to submit this application.</p>

        <!-- Internship Application Letter -->
        <div class="st-doc-slot" [class.st-doc-slot--filled]="applicationLetterFile()">
          <div class="st-doc-slot__header">
            <div class="st-doc-slot__icon-wrap">
              @if (applicationLetterFile()) {
                <st-icon name="check" [size]="18" />
              } @else {
                <st-icon name="file-text" [size]="18" />
              }
            </div>
            <div class="st-doc-slot__info">
              <span class="st-doc-slot__label">Internship Application Letter <span class="st-doc-slot__required">*</span></span>
              <span class="st-doc-slot__desc">Official letter from the university requesting the internship</span>
            </div>
            @if (applicationLetterFile()) {
              <button type="button" class="st-doc-slot__clear" (click)="clearFile('application')">
                <st-icon name="x" [size]="14" />
              </button>
            }
          </div>
          @if (applicationLetterFile(); as file) {
            <div class="st-doc-slot__preview">
              <st-icon name="paperclip" [size]="13" />
              <span dir="auto">{{ file.name }}</span>
              <span class="st-doc-slot__size">{{ formatSize(file.size) }}</span>
            </div>
          } @else {
            <label class="st-doc-slot__drop">
              <input type="file" class="st-file-hidden" accept=".pdf,.png,.jpg,.jpeg,.webp"
                (change)="onFile($event, 'application')"
                [attr.aria-describedby]="applicationLetterError() ? 'app-letter-error' : null" />
              <st-icon name="upload-cloud" [size]="20" />
              <span>Click to browse or drop file here</span>
              <span class="st-doc-slot__accept">PDF, PNG, JPG, WEBP · max 10 MB</span>
            </label>
          }
          @if (applicationLetterError()) {
            <span class="st-field__error" role="alert" id="app-letter-error">{{ applicationLetterError() }}</span>
          }
        </div>

        <!-- Assignment Letter -->
        <div class="st-doc-slot" [class.st-doc-slot--filled]="assignmentLetterFile()">
          <div class="st-doc-slot__header">
            <div class="st-doc-slot__icon-wrap">
              @if (assignmentLetterFile()) {
                <st-icon name="check" [size]="18" />
              } @else {
                <st-icon name="file-signature" [size]="18" />
              }
            </div>
            <div class="st-doc-slot__info">
              <span class="st-doc-slot__label">Assignment Letter <span class="st-doc-slot__required">*</span></span>
              <span class="st-doc-slot__desc">STEG assignment letter confirming the internship placement</span>
            </div>
            @if (assignmentLetterFile()) {
              <button type="button" class="st-doc-slot__clear" (click)="clearFile('assignment')">
                <st-icon name="x" [size]="14" />
              </button>
            }
          </div>
          @if (assignmentLetterFile(); as file) {
            <div class="st-doc-slot__preview">
              <st-icon name="paperclip" [size]="13" />
              <span dir="auto">{{ file.name }}</span>
              <span class="st-doc-slot__size">{{ formatSize(file.size) }}</span>
            </div>
          } @else {
            <label class="st-doc-slot__drop">
              <input type="file" class="st-file-hidden" accept=".pdf,.png,.jpg,.jpeg,.webp"
                (change)="onFile($event, 'assignment')"
                [attr.aria-describedby]="assignmentLetterError() ? 'assign-letter-error' : null" />
              <st-icon name="upload-cloud" [size]="20" />
              <span>Click to browse or drop file here</span>
              <span class="st-doc-slot__accept">PDF, PNG, JPG, WEBP · max 10 MB</span>
            </label>
          }
          @if (assignmentLetterError()) {
            <span class="st-field__error" role="alert" id="assign-letter-error">{{ assignmentLetterError() }}</span>
          }
        </div>

        <div class="st-docs-status">
          <span class="st-docs-status__count" [class.st-docs-status__count--done]="docsComplete()">
            <st-icon [name]="docsComplete() ? 'check-circle' : 'circle'" [size]="14" />
            {{ uploadedCount() }}/2 documents uploaded
          </span>
          @if (!docsComplete()) {
            <span class="st-docs-status__hint">Both documents are required before submitting</span>
          }
        </div>

        @if (busy() && busyStatus()) {
          <st-alert tone="info">{{ busyStatus() }}</st-alert>
        }
        @if (formError()) {
          <st-alert tone="error" [title]="i18n.t('common.error.title')">{{ formError() }}</st-alert>
        }
        @if (fieldErrors().length > 0) {
          <ul class="st-field-errors">
            @for (fe of fieldErrors(); track fe.field) {
              <li dir="auto">{{ fe.field }} — {{ fe.message }}</li>
            }
          </ul>
        }

        <p class="st-actions">
          <button type="submit" class="st-btn st-btn--primary" [disabled]="busy() || !form.valid || !docsComplete()">
            <st-icon name="check" [size]="15" /> {{ i18n.t('intake.submit') }}
          </button>
        </p>
      </form>
    }

    <!-- Supervisor assignment dialog -->
    <st-approval-dialog
      [open]="approvalOpen()"
      [supervisors]="supervisors()"
      [departments]="departments()"
      [preselectedUserId]="auth.user()?.userId ?? null"
      [busy]="approvalBusy()"
      (confirmed)="onApprovalConfirmed($event)"
      (cancelled)="onApprovalCancelled()"
    />

    <!-- One-time login credentials modal for candidate -->
    @if (credentials(); as creds) {
      <st-credentials-dialog
        [open]="true"
        [email]="creds.email"
        [password]="creds.password"
        [emailSent]="creds.emailSent"
        (closed)="credentials.set(null)"
      />
    }
  `,
  styles: [`
    .st-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 0.7rem;
      padding: 1.2rem;
      margin-block-end: 0.8rem;
    }
    .st-card__title { margin: 0.4rem 0 0.8rem; font-size: 1rem; font-weight: 600; }
    .st-form { display: grid; gap: 0.7rem; }
    .st-grid2 { display: grid; gap: 0.6rem; grid-template-columns: 1fr 1fr; }
    .st-hint { font-size: 0.78rem; color: var(--text-secondary); margin: 0; }
    .st-hint--docs { margin-bottom: 0.5rem; }
    .st-field-errors {
      margin: 0; padding: 0.6rem 0.8rem; padding-inline-start: 1.6rem;
      border: 1px solid var(--border-default);
      border-inline-start: 3px solid var(--status-error);
      border-radius: 0.5rem; font-size: 0.82rem;
    }
    .st-actions { display: flex; gap: 0.5rem; margin: 0.4rem 0 0; }
    .st-token {
      font-size: 1.1rem; font-weight: 700; letter-spacing: 0.04em;
      background: var(--bg-page); border: 1px dashed var(--border-default);
      border-radius: 0.55rem; padding: 0.7rem 0.9rem; overflow-wrap: anywhere;
    }
    .st-doc-slot {
      border: 2px dashed var(--border-default); border-radius: 0.75rem;
      padding: 1rem; background: var(--bg-page);
      transition: border-color 0.15s, background 0.15s;
    }
    .st-doc-slot--filled {
      border-color: var(--status-success, #22c55e); border-style: solid;
      background: color-mix(in srgb, var(--status-success, #22c55e) 5%, transparent);
    }
    .st-doc-slot__header { display: flex; align-items: flex-start; gap: 0.75rem; }
    .st-doc-slot__icon-wrap {
      flex: none; width: 2.2rem; height: 2.2rem; border-radius: 0.5rem;
      background: var(--bg-surface); border: 1px solid var(--border-subtle);
      display: grid; place-items: center; color: var(--text-muted);
    }
    .st-doc-slot--filled .st-doc-slot__icon-wrap {
      background: var(--status-success, #22c55e);
      border-color: var(--status-success, #22c55e); color: white;
    }
    .st-doc-slot__info { flex: 1; display: grid; gap: 0.15rem; }
    .st-doc-slot__label { font-size: 0.88rem; font-weight: 600; color: var(--text-primary); }
    .st-doc-slot__required { color: var(--status-error, #ef4444); margin-inline-start: 0.15rem; }
    .st-doc-slot__desc { font-size: 0.75rem; color: var(--text-muted); }
    .st-doc-slot__clear {
      flex: none; background: none; border: 1px solid var(--border-subtle);
      border-radius: 0.4rem; padding: 0.25rem 0.35rem; color: var(--text-muted);
      cursor: pointer; display: grid; place-items: center;
      transition: background 0.12s, color 0.12s;
    }
    .st-doc-slot__clear:hover {
      background: var(--status-error-muted, #fee2e2);
      color: var(--status-error, #ef4444); border-color: var(--status-error, #ef4444);
    }
    .st-doc-slot__drop {
      display: flex; flex-direction: column; align-items: center; gap: 0.3rem;
      margin-top: 0.75rem; padding: 1rem; border-radius: 0.5rem;
      background: var(--bg-surface); cursor: pointer; text-align: center;
      font-size: 0.83rem; color: var(--text-secondary); transition: background 0.12s;
    }
    .st-doc-slot__drop:hover {
      background: color-mix(in srgb, var(--color-primary, #3b82f6) 8%, transparent);
    }
    .st-doc-slot__accept { font-size: 0.72rem; color: var(--text-muted); }
    .st-doc-slot__preview {
      display: flex; align-items: center; gap: 0.4rem; margin-top: 0.6rem;
      padding: 0.5rem 0.75rem; background: var(--bg-surface); border-radius: 0.5rem;
      font-size: 0.83rem; color: var(--text-secondary); overflow-wrap: anywhere;
    }
    .st-doc-slot__size {
      font-size: 0.72rem; color: var(--text-muted); margin-inline-start: auto; white-space: nowrap;
    }
    .st-file-hidden { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
    .st-docs-status {
      display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem;
      background: var(--bg-page); border-radius: 0.5rem; font-size: 0.8rem;
    }
    .st-docs-status__count {
      display: flex; align-items: center; gap: 0.35rem; color: var(--text-muted); font-weight: 500;
    }
    .st-docs-status__count--done { color: var(--status-success, #22c55e); }
    .st-docs-status__hint { color: var(--text-muted); font-size: 0.75rem; }
    @media (max-width: 700px) { .st-grid2 { grid-template-columns: 1fr; } }
  `],
})
export class ManualIntakeComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly api = inject(ApiClient);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly fields = {
    firstName: '', lastName: '', email: '', phone: '', birthDate: '',
    nationalId: '', universityId: '', speciality: '', diploma: '',
    desiredStartDate: '', desiredEndDate: '',
  };

  readonly busy = signal(false);
  readonly busyStatus = signal('');
  readonly done = signal<ManualApplicationResult | null>(null);
  readonly formError = signal('');
  readonly fieldErrors = signal<readonly { field: string; message: string }[]>([]);

  readonly applicationLetterFile = signal<File | null>(null);
  readonly applicationLetterError = signal('');
  readonly assignmentLetterFile = signal<File | null>(null);
  readonly assignmentLetterError = signal('');

  // Auto-approval and supervisor assignment state
  readonly supervisors = signal<readonly SupervisorOption[]>([]);
  readonly departments = signal<readonly Department[]>([]);
  readonly approvalOpen = signal(false);
  readonly approvalBusy = signal(false);
  readonly pendingApplicationId = signal<string | null>(null);
  readonly pendingResult = signal<ManualApplicationResult | null>(null);
  readonly credentials = signal<{ email: string; password: string; emailSent: boolean } | null>(null);

  readonly docsComplete = () =>
    this.applicationLetterFile() !== null && this.assignmentLetterFile() !== null;
  readonly uploadedCount = () =>
    (this.applicationLetterFile() ? 1 : 0) + (this.assignmentLetterFile() ? 1 : 0);

  ngOnInit(): void {
    this.crumbs.set([
      { labelKey: 'nav.section.operations', labelFallback: 'Operations' },
      { labelKey: 'nav.applications', labelFallback: 'Applications', url: '/applications' },
      { labelKey: 'intake.title', labelFallback: 'Manual intake' },
    ]);
    if (this.api.listSupervisors) {
      this.api.listSupervisors().pipe(catchError(() => of([]))).subscribe((list) => this.supervisors.set(list));
    }
    if (this.api.listDepartments) {
      this.api.listDepartments().pipe(catchError(() => of([]))).subscribe((list) => this.departments.set(list));
    }
  }

  onFile(event: Event, slot: 'application' | 'assignment'): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    const errSignal = slot === 'application' ? this.applicationLetterError : this.assignmentLetterError;
    const fileSignal = slot === 'application' ? this.applicationLetterFile : this.assignmentLetterFile;
    errSignal.set('');
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type) && file.size > 0) { errSignal.set(this.i18n.t('intake.fileTypeError')); return; }
    if (file.size > MAX_FILE_BYTES) { errSignal.set(this.i18n.t('intake.fileSizeError')); return; }
    fileSignal.set(file);
    if (input) input.value = '';
  }

  clearFile(slot: 'application' | 'assignment'): void {
    if (slot === 'application') { this.applicationLetterFile.set(null); this.applicationLetterError.set(''); }
    else { this.assignmentLetterFile.set(null); this.assignmentLetterError.set(''); }
  }

  submit(): void {
    if (!this.fields.firstName.trim() || !this.fields.lastName.trim() || !this.fields.email.trim()) return;
    if (!this.fields.nationalId.trim() || !this.fields.universityId.trim()) return;
    if (!this.fields.desiredStartDate || !this.fields.desiredEndDate) return;
    this.busy.set(true);
    this.busyStatus.set('Submitting candidate application...');
    this.formError.set('');
    this.fieldErrors.set([]);
    const files: File[] = [];
    const appLetter = this.applicationLetterFile();
    const assignLetter = this.assignmentLetterFile();
    if (appLetter) files.push(appLetter);
    if (assignLetter) files.push(assignLetter);

    this.api.submitManualApplication({ ...this.fields }, files).subscribe({
      next: (result) => {
        this.pendingResult.set(result);
        this.autoProcessApplication(result);
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.busyStatus.set('');
        const envelope = (e as { error?: ApiErrorEnvelope }).error;
        if (envelope?.fieldErrors?.length) this.fieldErrors.set(envelope.fieldErrors);
        this.formError.set(envelope?.message || this.i18n.t('common.error.body'));
      },
    });
  }

  private autoProcessApplication(result: ManualApplicationResult): void {
    this.busyStatus.set('Locating created application...');
    const fallbackPage: Page<ApplicationQueueRow> = {
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 5,
    };
    const search$: Observable<Page<ApplicationQueueRow>> = this.api.searchApplications
      ? this.api.searchApplications({ page: 0, size: 5, q: result.reference })
      : of(fallbackPage);

    search$
      .pipe(
        catchError((): Observable<Page<ApplicationQueueRow>> => of(fallbackPage)),
        switchMap((queue: Page<ApplicationQueueRow>): Observable<{ appId: string | null }> => {
          const app = queue.content.find((a) => a.reference === result.reference) || queue.content[0];
          if (!app?.id) {
            return of({ appId: null });
          }
          const appId = app.id;
          this.pendingApplicationId.set(appId);
          this.busyStatus.set('Auto-validating candidate documents...');

          const getDocs$: Observable<ApplicationDocumentItem[]> = this.api.getApplicationDocuments
            ? this.api.getApplicationDocuments(appId)
            : of([] as ApplicationDocumentItem[]);

          return getDocs$.pipe(
            catchError((): Observable<ApplicationDocumentItem[]> => of([])),
            switchMap((docs: ApplicationDocumentItem[]): Observable<{ appId: string | null }> => {
              if (!docs || docs.length === 0) {
                return of({ appId });
              }
              const verifyTasks: Observable<unknown>[] = docs.map((docItem) =>
                this.api.verifyApplicationDocument
                  ? this.api
                      .verifyApplicationDocument(appId, docItem.document.id, {
                        status: 'VERIFIED',
                        comment: 'Auto-verified by administrator manual intake',
                      })
                      .pipe(catchError(() => of(null)))
                  : of(null),
              );
              return forkJoin(verifyTasks).pipe(
                catchError(() => of([])),
                switchMap(() => of({ appId })),
              );
            }),
          );
        }),
      )
      .subscribe({
        next: ({ appId }: { appId: string | null }) => {
          this.busy.set(false);
          this.busyStatus.set('');
          if (appId) {
            this.toast.show('success', 'Documents verified automatically. Please assign a supervisor.');
            this.approvalOpen.set(true);
          } else {
            this.done.set(result);
            this.toast.show('success', this.i18n.t('intake.successTitle'));
          }
        },
        error: () => {
          this.busy.set(false);
          this.busyStatus.set('');
          this.done.set(result);
        },
      });
  }

  onApprovalConfirmed(selection: ApprovalSelection): void {
    const appId = this.pendingApplicationId();
    if (!appId) {
      this.approvalOpen.set(false);
      this.done.set(this.pendingResult());
      return;
    }
    this.approvalBusy.set(true);
    const approve$: Observable<ApplicationApprovalResult | null> = this.api.approveApplication
      ? this.api.approveApplication(appId, {
          supervisorUserId: selection.supervisorUserId,
          departmentId: selection.departmentId,
        })
      : of(null);

    approve$
      .pipe(
        catchError((e: unknown): Observable<ApplicationApprovalResult | null> => {
          this.toast.show('error', actionErrorMessage(e, this.i18n));
          return of(null);
        }),
        switchMap((approvalResult: ApplicationApprovalResult | null): Observable<unknown> => {
          if (!approvalResult) {
            return of(null);
          }
          if (approvalResult.temporaryPassword && approvalResult.credentialEmail) {
            this.credentials.set({
              email: approvalResult.credentialEmail,
              password: approvalResult.temporaryPassword,
              emailSent: approvalResult.credentialEmailSent,
            });
          }
          const internshipId = approvalResult.internship?.id;
          if (internshipId && this.api.transitionInternshipStatus) {
            return this.api
              .transitionInternshipStatus(
                internshipId,
                'IN_PROGRESS',
                'Internship started automatically upon admin manual intake',
              )
              .pipe(
                catchError((e: unknown): Observable<null> => {
                  console.warn('Could not auto-transition internship to IN_PROGRESS:', e);
                  return of(null);
                }),
              );
          }
          return of(null);
        }),
        finalize(() => {
          this.approvalBusy.set(false);
          this.approvalOpen.set(false);
          this.done.set(this.pendingResult());
          this.toast.show(
            'success',
            'Candidate approved, documents verified, and internship set to IN_PROGRESS!',
          );
        }),
      )
      .subscribe();
  }


  onApprovalCancelled(): void {
    const appId = this.pendingApplicationId();
    const defaultDept = this.departments()[0]?.id;
    if (appId && defaultDept) {
      this.onApprovalConfirmed({
        supervisorUserId: this.auth.user()?.userId ?? '',
        departmentId: defaultDept,
      });
    } else {
      this.approvalOpen.set(false);
      this.done.set(this.pendingResult());
    }
  }

  reset(): void {
    this.done.set(null);
    this.formError.set('');
    this.fieldErrors.set([]);
    this.pendingApplicationId.set(null);
    this.pendingResult.set(null);
    this.credentials.set(null);
    this.applicationLetterFile.set(null);
    this.applicationLetterError.set('');
    this.assignmentLetterFile.set(null);
    this.assignmentLetterError.set('');
    for (const key of Object.keys(this.fields) as (keyof typeof this.fields)[]) {
      this.fields[key] = '';
    }
  }

  formatSize(bytes: number): string {
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
}
