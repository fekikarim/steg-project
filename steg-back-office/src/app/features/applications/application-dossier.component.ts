import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { AuthService } from '../../core/auth.service';
import { RealtimeService } from '../../core/realtime.service';
import { ToastService } from '../../shared/ui/toast.service';
import { ApplicationReviewService, type DossierBundle } from './application-review.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { BadgeComponent, type BadgeTone } from '../../shared/ui/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import { AlertComponent } from '../../shared/ui/alert.component';
import { TabsComponent } from '../../shared/ui/tabs.component';
import { DialogComponent, ConfirmDialogComponent } from '../../shared/ui/dialog.component';
import { StIconComponent } from '../../shared/ui/icon.component';
import { ApprovalDialogComponent, type ApprovalSelection } from './approval-dialog.component';
import { CredentialsDialogComponent } from './credentials-dialog.component';
import type {
  ApplicationDocumentItem,
  Department,
  DocumentAiValidationResponse,
  SupervisorOption,
} from '../../core/api-models';
import type { AiAnalysisResult } from '../../core/api-models';
import { ApiClient } from '../../core/api-client.service';
import { catchError, forkJoin, of } from 'rxjs';

type ReasonKind = 'reject' | 'correct' | 'verify';

export interface OneTimeCredentials {
  readonly email: string;
  readonly password: string;
  readonly emailSent: boolean;
}

/**
 * Application dossier: candidate data, backend-derived classification,
 * documents with verification, real workflow timeline and review actions.
 * All mutations go through backend workflow endpoints; the client never
 * decides transition legality.
 */
@Component({
  selector: 'st-application-dossier',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    PageHeaderComponent,
    LiveStatusComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    AlertComponent,
    TabsComponent,
    DialogComponent,
    ConfirmDialogComponent,
    ApprovalDialogComponent,
    CredentialsDialogComponent,
    StIconComponent,
  ],
  template: `
    @if (loading()) {
      <st-skeleton [rows]="10" />
    } @else if (error()) {
      <st-error-state
        [title]="i18n.t('common.error.title')"
        [body]="errorMessage() || i18n.t('common.error.body')"
        [retryLabel]="i18n.t('common.retry')"
        (retry)="load()"
      />
      <p>
        <a routerLink="/applications" class="st-btn st-btn--secondary">{{
          i18n.t('common.back')
        }}</a>
      </p>
    } @else if (bundle(); as dossier) {
      <st-page-header
        [title]="dossier.application.reference"
        [subtitle]="dossier.application.candidateName"
      >
        <st-live-status />
        <a routerLink="/applications" class="st-btn st-btn--secondary">{{
          i18n.t('common.back')
        }}</a>
        @if (canAct() && canBeginReview(dossier.application.status)) {
          <button
            type="button"
            class="st-btn st-btn--primary"
            (click)="beginReview()"
            [disabled]="busy()"
          >
            {{ i18n.t('dossier.beginReview') }}
          </button>
        }
        @if (canAct() && canApprove(dossier.application.status)) {
          <button
            type="button"
            class="st-btn st-btn--primary"
            (click)="openApproval()"
            [disabled]="busy() || approvalBusy()"
          >
            {{ i18n.t('dossier.approve') }}
          </button>
          <button
            type="button"
            class="st-btn st-btn--secondary"
            (click)="openReason('correct')"
            [disabled]="busy()"
          >
            {{ i18n.t('dossier.requestCorrection') }}
          </button>
          <button
            type="button"
            class="st-btn st-btn--danger"
            (click)="openReason('reject')"
            [disabled]="busy()"
          >
            {{ i18n.t('dossier.reject') }}
          </button>
        }
        @if (canCreateInternship() && dossier.application.status === 'APPROVED') {
          <a
            [routerLink]="['/internships/new']"
            [queryParams]="{ applicationId: dossier.application.id }"
            class="st-btn st-btn--primary"
          >
            {{ i18n.t('dossier.createInternship') }}
          </a>
        }
      </st-page-header>

      <p class="st-flags">
        <st-badge
          [label]="dossier.application.status"
          [tone]="statusTone(dossier.application.status)"
        />
        <st-badge
          [label]="
            dossier.application.submittedOnline
              ? i18n.t('applications.online')
              : i18n.t('applications.manual')
          "
          tone="neutral"
        />
        @if (dossier.application.calculatedType) {
          <st-badge [label]="dossier.application.calculatedType" tone="info" />
        }
        @if (dossier.application.requirement) {
          <st-badge [label]="dossier.application.requirement" tone="neutral" />
        }
      </p>

      @if (dossier.application.status === 'REJECTED' && dossier.application.rejectionReason) {
        <st-alert tone="error" [title]="i18n.t('dossier.rejectionReason')">
          <span dir="auto">{{ dossier.application.rejectionReason }}</span>
        </st-alert>
      }
      @if (
        dossier.application.status === 'MODIFICATION_REQUESTED' &&
        dossier.application.correctionComment
      ) {
        <st-alert tone="warning" [title]="i18n.t('dossier.correctionComment')">
          <span dir="auto">{{ dossier.application.correctionComment }}</span>
        </st-alert>
      }

      <st-tabs
        [tabs]="tabs(dossier)"
        [activeId]="tab()"
        label="Dossier"
        (select)="tab.set($event)"
      />

      @if (tab() === 'overview') {
        <div class="st-grid">
          <section class="st-card" [attr.aria-label]="i18n.t('dossier.candidate')">
            <h2 class="st-card__title">{{ i18n.t('dossier.candidate') }}</h2>
            @if (dossier.candidate; as c) {
              <dl class="st-defs">
                <div>
                  <dt>{{ i18n.t('dossier.fullName') }}</dt>
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
                @if (c.address) {
                  <div>
                    <dt>{{ i18n.t('dossier.address') }}</dt>
                    <dd dir="auto">{{ c.address }}</dd>
                  </div>
                }
              </dl>
              <div class="st-cin">
                <st-badge [label]="i18n.t('common.sensitive')" tone="restricted" icon="shield" />
                <span class="st-cin__label">{{ i18n.t('dossier.nationalId') }}</span>
                @if (cinRevealed()) {
                  <strong dir="ltr">{{ c.nationalId || '—' }}</strong>
                  <button
                    type="button"
                    class="st-btn st-btn--text"
                    (click)="cinRevealed.set(false)"
                  >
                    {{ i18n.t('dossier.hide') }}
                  </button>
                } @else {
                  <strong aria-label="masked">••••••••</strong>
                  <button type="button" class="st-btn st-btn--text" (click)="cinRevealed.set(true)">
                    {{ i18n.t('dossier.reveal') }}
                  </button>
                }
              </div>
              <p class="st-hint">{{ i18n.t('dossier.cinWarning') }}</p>
              <p>
                <a [routerLink]="['/candidates', c.id]" class="st-btn st-btn--secondary">
                  {{ i18n.t('dossier.openCandidate') }}
                </a>
              </p>
            } @else {
              <st-alert tone="warning">{{ i18n.t('dossier.candidateUnavailable') }}</st-alert>
            }
          </section>

          <section class="st-card" [attr.aria-label]="i18n.t('dossier.internship')">
            <h2 class="st-card__title">{{ i18n.t('dossier.internship') }}</h2>
            <dl class="st-defs">
              <div>
                <dt>{{ i18n.t('dossier.startDate') }}</dt>
                <dd dir="ltr">{{ dossier.application.desiredStartDate }}</dd>
              </div>
              <div>
                <dt>{{ i18n.t('dossier.endDate') }}</dt>
                <dd dir="ltr">{{ dossier.application.desiredEndDate }}</dd>
              </div>
              <div>
                <dt>{{ i18n.t('dossier.computedType') }}</dt>
                <dd>{{ dossier.application.calculatedType ?? '—' }}</dd>
              </div>
              <div>
                <dt>{{ i18n.t('dossier.requirement') }}</dt>
                <dd>{{ dossier.application.requirement ?? '—' }}</dd>
              </div>

              <div>
                <dt>{{ i18n.t('dossier.submittedAt') }}</dt>
                <dd dir="ltr">
                  {{ (dossier.application.submissionDate ?? '').slice(0, 10) || '—' }}
                </dd>
              </div>
            </dl>
            <p class="st-hint">{{ i18n.t('dossier.backendDerivedHint') }}</p>
          </section>
        </div>
      }

      @if (tab() === 'documents') {
        <section class="st-card" [attr.aria-label]="i18n.t('dossier.documents')">
          <h2 class="st-card__title">{{ i18n.t('dossier.documents') }}</h2>
          @if (dossier.documents.length === 0) {
            <st-empty-state
              [title]="i18n.t('common.empty.title')"
              [body]="i18n.t('dossier.noDocuments')"
            />
          } @else {
            <ul class="st-docs">
              @for (item of dossier.documents; track item.id) {
                <li class="st-docrow">
                  <div class="st-docrow__meta">
                    <strong dir="auto">{{ item.document.originalFileName }}</strong>
                    <span class="st-docrow__sub" dir="auto">
                      {{ item.document.type }} · {{ formatSize(item.document.sizeBytes) }} ·
                      {{ item.document.mimeType }}
                    </span>
                    <span class="st-docrow__badges">
                      @if (item.mandatory) {
                        <st-badge [label]="i18n.t('dossier.mandatory')" tone="info" />
                      }
                      <st-badge
                        [label]="item.verificationStatus"
                        [tone]="verifyTone(item.verificationStatus)"
                      />
                      @if (item.document.restrictedAccess) {
                        <st-badge
                          [label]="i18n.t('common.sensitive')"
                          tone="restricted"
                          icon="shield"
                        />
                      }
                    </span>
                    @if (item.verificationComment) {
                      <span class="st-docrow__comment" dir="auto">{{
                        item.verificationComment
                      }}</span>
                    }
                  </div>
                  <div class="st-docrow__actions">
                    <button
                      type="button"
                      class="st-btn st-btn--secondary"
                      [disabled]="isRestrictedBlocked(item)"
                      (click)="download(item, false)"
                    >
                      <st-icon name="download" [size]="14" /> {{ i18n.t('common.download') }}
                    </button>
                    <button
                      type="button"
                      class="st-btn st-btn--secondary"
                      (click)="validateDocWithAi(item)"
                      [disabled]="docAiLoading()[item.document.id]"
                      title="Analyser la conformité par IA"
                    >
                      <st-icon name="sparkles" [size]="14" />
                      {{ docAiLoading()[item.document.id] ? i18n.t('common.loading') : 'Analyse IA' }}
                    </button>
                    @if (canAct()) {
                      <button
                        type="button"
                        class="st-btn st-btn--primary"
                        (click)="openVerify(item, 'VERIFIED')"
                        [disabled]="busy()"
                        title="Vérifier le document et notifier le candidat"
                      >
                        <st-icon name="check" [size]="14" /> {{ i18n.t('dossier.verify') }}
                      </button>
                      <button
                        type="button"
                        class="st-btn st-btn--secondary"
                        (click)="openVerify(item, 'REQUIRES_CORRECTION')"
                        [disabled]="busy()"
                        title="Demander une correction au candidat"
                      >
                        <st-icon name="alert" [size]="14" /> {{ i18n.t('dossier.requestCorrection') }}
                      </button>
                    }
                  </div>
                </li>
              }
            </ul>
          }
          @if (restrictedBlockedNote()) {
            <st-alert tone="warning">{{ i18n.t('dossier.restrictedBlocked') }}</st-alert>
          }
        </section>

        <!-- Intelligence documentaire IA: validation de conformité des documents du candidat -->
        <section class="st-card st-ai-doc-card">
          <div class="st-ai-doc-header">
            <div class="st-ai-doc-header__title">
              <span class="st-ai-icon-badge">
                <st-icon name="sparkles" [size]="20" />
              </span>
              <div>
                <h3 class="st-card__title" style="margin: 0; font-size: 1.05rem;">
                  Validation IA des documents (Intelligence documentaire)
                </h3>
                <p class="st-hint" style="margin: 0.2rem 0 0;">
                  Vérification automatique (Demande de stage & Lettre d'affectation) : conformité du type et identité du candidat
                </p>
              </div>
            </div>
            <button
              type="button"
              class="st-btn st-btn--secondary"
              (click)="validateAllDocsWithAi()"
              [disabled]="isAnyDocAiLoading()"
            >
              <st-icon name="refresh" [size]="14" />
              {{ isAnyDocAiLoading() ? i18n.t('common.loading') : 'Analyser tous les documents' }}
            </button>
          </div>

          @if (dossier.documents.length === 0) {
            <p class="st-hint">Aucun document à analyser.</p>
          } @else {
            <div class="st-ai-doc-grid">
              @for (item of dossier.documents; track item.id) {
                @let docId = item.document.id;
                @let aiVal = docAiValidations()[docId];
                @let aiLoading = docAiLoading()[docId];
                @let aiErr = docAiErrors()[docId];

                <div
                  class="st-ai-doc-item"
                  [class.st-ai-doc-item--valid]="aiVal?.valid"
                  [class.st-ai-doc-item--invalid]="aiVal && !aiVal.valid"
                >
                  <div class="st-ai-doc-item__top">
                    <div class="st-ai-doc-item__info">
                      <span class="st-ai-doc-item__type">
                        <st-icon name="file" [size]="15" />
                        <strong>{{ getExpectedDocLabel(item.document.type) }}</strong>
                      </span>
                      <span class="st-ai-doc-item__filename" dir="auto">
                        {{ item.document.originalFileName }}
                      </span>
                    </div>

                    <div class="st-ai-doc-item__badge-area">
                      @if (aiLoading) {
                        <span class="st-ai-badge st-ai-badge--loading">
                          <st-icon name="refresh" [size]="12" /> Analyse...
                        </span>
                      } @else if (aiVal) {
                        <span
                          class="st-ai-badge"
                          [class.st-ai-badge--valid]="aiVal.valid"
                          [class.st-ai-badge--invalid]="!aiVal.valid"
                        >
                          {{ aiVal.valid ? '✓ Conforme' : '⚠ Non conforme' }}
                          <span class="st-ai-badge__score">{{ formatConfidence(aiVal.confidence) }}</span>
                        </span>
                      } @else if (aiErr) {
                        <span class="st-ai-badge st-ai-badge--error">Échec analyse</span>
                      } @else {
                        <span class="st-ai-badge st-ai-badge--pending">Prêt pour analyse</span>
                      }
                    </div>
                  </div>

                  @if (aiVal) {
                    <div class="st-ai-breakdown">
                      <div class="st-ai-check-row">
                        <span
                          class="st-ai-check-icon"
                          [class.st-ai-check-icon--ok]="aiVal.documentTypeValid"
                          [class.st-ai-check-icon--ko]="!aiVal.documentTypeValid"
                        >
                          {{ aiVal.documentTypeValid ? '✓' : '✗' }}
                        </span>
                        <span class="st-ai-check-text">
                          <strong>Type de document :</strong>
                          {{
                            aiVal.documentTypeValid
                              ? 'Mots-clés requis (' + getExpectedDocLabel(item.document.type) + ') confirmés'
                              : 'Mots-clés attendus non détectés'
                          }}
                        </span>
                      </div>
                      <div class="st-ai-check-row">
                        <span
                          class="st-ai-check-icon"
                          [class.st-ai-check-icon--ok]="aiVal.candidateNameValid"
                          [class.st-ai-check-icon--ko]="!aiVal.candidateNameValid"
                        >
                          {{ aiVal.candidateNameValid ? '✓' : '✗' }}
                        </span>
                        <span class="st-ai-check-text">
                          <strong>Identité du candidat :</strong>
                          {{
                            aiVal.candidateNameValid
                              ? 'Nom détecté : ' + dossier.application.candidateName
                              : 'Nom du candidat introuvable'
                          }}
                        </span>
                      </div>
                      @if (aiVal.reason) {
                        <p class="st-ai-reason" dir="auto">
                          <em>Raison :</em> {{ aiVal.reason }}
                        </p>
                      }
                    </div>
                  } @else if (aiErr) {
                    <p class="st-ai-err-msg">{{ aiErr }}</p>
                  }

                  <div class="st-ai-doc-item__footer">
                    <button
                      type="button"
                      class="st-btn st-btn--secondary"
                      style="padding: 0.35rem 0.75rem; font-size: 0.8rem;"
                      (click)="validateDocWithAi(item)"
                      [disabled]="aiLoading"
                    >
                      <st-icon name="sparkles" [size]="13" />
                      @if (aiVal) {
                        Réanalyser
                      } @else {
                        Analyser
                      }
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </section>
      }

      @if (tab() === 'timeline') {
        <section class="st-card" [attr.aria-label]="i18n.t('dossier.timeline')">
          <h2 class="st-card__title">{{ i18n.t('dossier.timeline') }}</h2>
          @if (dossier.workflow) {
            <p class="st-hint" dir="auto">
              {{ dossier.workflow.definitionName }} · {{ dossier.workflow.currentStepName }} ·
              {{ dossier.workflow.status }}
            </p>
          }
          @if (dossier.actionsRestricted) {
            <st-alert tone="warning">{{ i18n.t('dossier.timelineRestricted') }}</st-alert>
          } @else if (dossier.actions.length === 0) {
            <st-empty-state
              [title]="i18n.t('common.empty.title')"
              [body]="i18n.t('dossier.noActions')"
            />
          } @else {
            <ol class="st-timeline">
              @for (a of dossier.actions; track a.id) {
                <li class="st-timeline__item">
                  <span class="st-timeline__seq" aria-hidden="true">{{ a.sequenceNumber }}</span>
                  <div>
                    <p class="st-timeline__head" dir="auto">
                      <strong>{{ a.stepName }}</strong>
                      <st-badge [label]="a.type" tone="neutral" />
                      <st-badge [label]="a.decision" [tone]="decisionTone(a.decision)" />
                    </p>
                    <p class="st-timeline__meta" dir="auto">
                      {{ a.performedByUsername }} · {{ formatDateTime(a.performedAt) }}
                    </p>
                    @if (a.comment) {
                      <p class="st-timeline__comment" dir="auto">{{ a.comment }}</p>
                    }
                  </div>
                </li>
              }
            </ol>
          }
        </section>
      }



      <!-- Reason dialog (reject / correction / accept note / doc verification) -->
      <st-dialog [open]="reasonKind() !== null" [title]="reasonTitle()" (close)="closeReason()">
        <p class="st-hint">{{ reasonHint() }}</p>
        <label class="st-field">
          <span class="st-field__label">{{ i18n.t('dossier.reasonLabel') }} *</span>
          <textarea
            class="st-input"
            rows="4"
            [(ngModel)]="reasonText"
            dir="auto"
            [attr.aria-describedby]="reasonError() ? 'reason-error' : null"
          ></textarea>
          @if (reasonError()) {
            <span class="st-field__error" role="alert" id="reason-error">{{ reasonError() }}</span>
          }
        </label>
        <div slot="footer" class="st-dialog__actions">
          <button type="button" class="st-btn st-btn--secondary" (click)="closeReason()">
            {{ i18n.t('common.cancel') }}
          </button>
          <button
            type="button"
            class="st-btn"
            [class.st-btn--danger]="reasonKind() === 'reject'"
            [class.st-btn--primary]="reasonKind() !== 'reject'"
            [disabled]="busy()"
            (click)="submitReason()"
          >
            {{ i18n.t('common.confirm') }}
          </button>
        </div>
      </st-dialog>

      <st-confirm-dialog
        [open]="confirmBegin()"
        [title]="i18n.t('dossier.beginReview')"
        [body]="i18n.t('dossier.beginReviewBody')"
        [confirmLabel]="i18n.t('common.confirm')"
        [cancelLabel]="i18n.t('common.cancel')"
        [busy]="busy()"
        (confirmed)="doBeginReview()"
        (cancel)="confirmBegin.set(false)"
      />

      <!-- Supervisor validation then one-time credentials (AGENTS.md §5.2/§5.3) -->
      <st-approval-dialog
        [open]="approvalOpen()"
        [supervisors]="supervisorOptions()"
        [departments]="departmentOptions()"
        [preselectedUserId]="auth.user()?.userId ?? null"
        [busy]="approvalBusy()"
        (confirmed)="confirmApproval($event)"
        (cancelled)="cancelApproval()"
      />

      @if (credentials(); as creds) {
        <st-credentials-dialog
          [open]="true"
          [email]="creds.email"
          [password]="creds.password"
          [emailSent]="creds.emailSent"
          [resendBusy]="resendBusy()"
          (closed)="closeCredentials()"
          (resendRequested)="resendCredentials()"
        />
      }
    }
  `,
  styles: [
    `
      .st-flags {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
        margin: 0 0 0.8rem;
      }
      .st-grid {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: 1fr 1fr;
        margin-block-start: 0.8rem;
      }
      .st-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 0.7rem;
        padding: 1rem;
        margin-block-start: 0.8rem;
      }
      .st-grid .st-card {
        margin-block-start: 0;
      }
      .st-card__title {
        margin: 0 0 0.6rem;
        font-size: 0.95rem;
      }
      .st-defs {
        display: grid;
        gap: 0.5rem;
        margin: 0;
      }
      .st-defs div {
        display: grid;
        grid-template-columns: 10rem 1fr;
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
      .st-hint {
        font-size: 0.78rem;
        color: var(--text-secondary);
      }
      .st-cin {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
        margin-block-start: 0.7rem;
        padding: 0.6rem 0.7rem;
        border: 1px dashed var(--border-default);
        border-radius: 0.55rem;
      }
      .st-docs {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.6rem;
      }
      .st-docrow {
        display: flex;
        gap: 0.7rem;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        border: 1px solid var(--border-subtle);
        border-radius: 0.6rem;
        padding: 0.7rem 0.8rem;
      }
      .st-docrow__meta {
        display: grid;
        gap: 0.25rem;
        flex: 1;
        min-inline-size: 14rem;
      }
      .st-docrow__sub {
        font-size: 0.75rem;
        color: var(--text-muted);
        overflow-wrap: anywhere;
      }
      .st-docrow__badges {
        display: flex;
        gap: 0.35rem;
        flex-wrap: wrap;
      }
      .st-docrow__comment {
        font-size: 0.8rem;
        color: var(--text-secondary);
      }
      .st-docrow__actions {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
      }
      .st-timeline {
        list-style: none;
        margin: 0.6rem 0 0;
        padding: 0;
        display: grid;
        gap: 0.7rem;
      }
      .st-timeline__item {
        display: flex;
        gap: 0.7rem;
      }
      .st-timeline__seq {
        flex: none;
        inline-size: 1.7rem;
        block-size: 1.7rem;
        border-radius: 50%;
        background: var(--bg-page);
        border: 1px solid var(--border-default);
        display: grid;
        place-items: center;
        font-size: 0.75rem;
        font-weight: 700;
      }
      .st-timeline__head {
        display: flex;
        gap: 0.4rem;
        align-items: center;
        flex-wrap: wrap;
        margin: 0;
        font-size: 0.85rem;
      }
      .st-timeline__meta {
        margin: 0.15rem 0 0;
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      .st-timeline__comment {
        margin: 0.25rem 0 0;
        font-size: 0.83rem;
        padding: 0.45rem 0.6rem;
        background: var(--bg-page);
        border-radius: 0.45rem;
        overflow-wrap: anywhere;
      }
      .st-dialog__actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
      }
      @media (max-width: 900px) {
        .st-grid {
          grid-template-columns: 1fr;
        }
      }
      .st-ai-doc-card {
        margin-block-start: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .st-ai-doc-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.75rem;
      }
      .st-ai-doc-header__title {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .st-ai-icon-badge {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 0.5rem;
        background: rgba(0, 82, 204, 0.08);
        color: var(--st-brand, #0052cc);
      }
      .st-ai-doc-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 1rem;
      }
      .st-ai-doc-item {
        border: 1px solid var(--border-default, #e5e7eb);
        border-radius: 0.75rem;
        padding: 1rem;
        background: var(--bg-surface, #ffffff);
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        transition: border-color 0.2s ease;
      }
      .st-ai-doc-item--valid {
        border-color: #a7f3d0;
        background: #f0fdf4;
      }
      .st-ai-doc-item--invalid {
        border-color: #fde68a;
        background: #fffbeb;
      }
      .st-ai-doc-item__top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0.5rem;
      }
      .st-ai-doc-item__info {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }
      .st-ai-doc-item__type {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.9rem;
        color: var(--text-primary);
      }
      .st-ai-doc-item__filename {
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      .st-ai-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.25rem 0.55rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
      }
      .st-ai-badge--valid {
        background: #dcfce7;
        color: #166534;
      }
      .st-ai-badge--invalid {
        background: #fef3c7;
        color: #92400e;
      }
      .st-ai-badge--loading {
        background: #e0f2fe;
        color: #0369a1;
      }
      .st-ai-badge--pending {
        background: var(--bg-muted, #f3f4f6);
        color: var(--text-muted, #6b7280);
      }
      .st-ai-badge--error {
        background: #fee2e2;
        color: #991b1b;
      }
      .st-ai-badge__score {
        padding: 0.1rem 0.35rem;
        border-radius: 0.25rem;
        background: rgba(0, 0, 0, 0.06);
        font-family: monospace;
        font-size: 0.7rem;
      }
      .st-ai-breakdown {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding: 0.6rem 0.75rem;
        background: rgba(255, 255, 255, 0.7);
        border-radius: 0.5rem;
        font-size: 0.8rem;
      }
      .st-ai-check-row {
        display: flex;
        align-items: flex-start;
        gap: 0.45rem;
      }
      .st-ai-check-icon {
        font-weight: bold;
        font-size: 0.85rem;
        line-height: 1.2;
      }
      .st-ai-check-icon--ok {
        color: #16a34a;
      }
      .st-ai-check-icon--ko {
        color: #d97706;
      }
      .st-ai-check-text {
        color: var(--text-secondary);
        line-height: 1.3;
      }
      .st-ai-reason {
        margin: 0.25rem 0 0;
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      .st-ai-err-msg {
        color: #dc2626;
        font-size: 0.8rem;
        margin: 0;
      }
      .st-ai-doc-item__footer {
        display: flex;
        justify-content: flex-end;
      }
    `,
  ],
})
export class ApplicationDossierComponent implements OnInit {
  readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly service = inject(ApplicationReviewService);
  private readonly api = inject(ApiClient);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal(false);
  readonly errorMessage = signal('');
  readonly bundle = signal<DossierBundle | null>(null);
  readonly tab = signal('overview');
  readonly cinRevealed = signal(false);
  readonly aiLoading = signal(false);
  readonly aiError = signal('');
  readonly aiResult = signal<AiAnalysisResult | null>(null);
  readonly docAiValidations = signal<Record<string, DocumentAiValidationResponse>>({});
  readonly docAiLoading = signal<Record<string, boolean>>({});
  readonly docAiErrors = signal<Record<string, string>>({});

  readonly reasonKind = signal<ReasonKind | null>(null);
  readonly confirmBegin = signal(false);
  readonly restrictedBlockedNote = signal(false);
  reasonText = '';
  readonly reasonError = signal('');
  private verifyTarget: ApplicationDocumentItem | null = null;
  private verifyStatus: 'VERIFIED' | 'REQUIRES_CORRECTION' = 'VERIFIED';

  // Approval flow (AGENTS.md §5.2): supervisor dialog then one-time credentials.
  readonly approvalOpen = signal(false);
  readonly approvalBusy = signal(false);
  readonly supervisorOptions = signal<readonly SupervisorOption[]>([]);
  readonly departmentOptions = signal<readonly Department[]>([]);
  /** Holds the one-time password only while the credentials dialog is open. */
  readonly credentials = signal<OneTimeCredentials | null>(null);
  readonly resendBusy = signal(false);

  tabs(dossier: DossierBundle): { id: string; label: string; count?: number }[] {
    return [
      { id: 'overview', label: this.i18n.t('dossier.tabOverview') },
      {
        id: 'documents',
        label: this.i18n.t('dossier.tabDocuments'),
        count: dossier.documents.length,
      },
      { id: 'timeline', label: this.i18n.t('dossier.tabTimeline'), count: dossier.actions.length },
    ];
  }

  /** Advisory report analysis (E2.2): STEG-focus relevance only — never a decision. */
  runAnalysis(): void {
    const id = this.bundle()?.application.id;
    if (!id || this.aiLoading()) return;
    this.aiLoading.set(true);
    this.aiError.set('');
    this.api.analyzeApplication(id).subscribe({
      next: (result) => {
        this.aiResult.set(result);
        this.aiLoading.set(false);
      },
      error: (e: unknown) => {
        this.aiError.set(actionErrorMessage(e, this.i18n));
        this.aiLoading.set(false);
      },
    });
  }

  reviewRecommendation(recId: string, status: 'ACCEPTED_BY_HUMAN' | 'DISMISSED'): void {
    this.api.reviewAiRecommendation(recId, status).subscribe({
      next: () => {
        const current = this.aiResult();
        if (current) {
          this.aiResult.set({
            ...current,
            recommendations: current.recommendations.map((r) =>
              r.id === recId ? { ...r, status } : r,
            ),
          });
        }
        this.toast.show('success', this.i18n.t('dossier.actionDone'));
      },
      error: (e: unknown) => this.toast.show('error', actionErrorMessage(e, this.i18n)),
    });
  }

  formatConfidence(confidence: number): string {
    return Math.round((confidence || 0) * 100) + '%';
  }

  validateDocWithAi(item: ApplicationDocumentItem): void {
    const docId = item.document.id;
    if (this.docAiLoading()[docId]) return;
    this.docAiLoading.update((m) => ({ ...m, [docId]: true }));
    this.docAiErrors.update((m) => {
      const copy = { ...m };
      delete copy[docId];
      return copy;
    });

    const expectedType = item.document.type;
    const fullName = this.bundle()?.application.candidateName;

    this.service.validateStoredDocumentAi(docId, expectedType, fullName).subscribe({
      next: (res) => {
        this.docAiValidations.update((m) => ({ ...m, [docId]: res }));
        this.docAiLoading.update((m) => ({ ...m, [docId]: false }));
        if (res.valid) {
          this.toast.show('success', 'Document vérifié par l\'IA : Conforme (Type et Nom validés)');
        } else {
          this.toast.show('warning', 'Document vérifié par l\'IA : Incohérence détectée');
        }
      },
      error: (e: unknown) => {
        const msg = actionErrorMessage(e, this.i18n);
        this.docAiErrors.update((m) => ({ ...m, [docId]: msg }));
        this.docAiLoading.update((m) => ({ ...m, [docId]: false }));
        this.toast.show('error', msg);
      },
    });
  }

  validateAllDocsWithAi(): void {
    const docs = this.bundle()?.documents ?? [];
    for (const item of docs) {
      this.validateDocWithAi(item);
    }
  }

  isAnyDocAiLoading(): boolean {
    return Object.values(this.docAiLoading()).some(Boolean);
  }

  getExpectedDocLabel(type: string): string {
    if (type === 'INTERNSHIP_APPLICATION') return 'Demande de stage';
    if (type === 'ASSIGNMENT_LETTER') return 'Lettre d\'affectation';
    if (type === 'CV') return 'Curriculum Vitae (CV)';
    if (type === 'CIN_COPY') return 'Copie CIN';
    if (type === 'UNIVERSITY_CONVENTION' || type === 'INTERNSHIP_CONVENTION') return 'Convention de stage';
    return type || 'Document';
  }

  canAct(): boolean {
    return this.auth.hasPermission('APPLICATION_REVIEW');
  }

  canCreateInternship(): boolean {
    return this.auth.hasPermission('INTERNSHIP_ASSIGN');
  }

  canBeginReview(status: string): boolean {
    return status === 'SUBMITTED' || status === 'RESUBMITTED';
  }

  /** AGENTS.md §5.2: SUBMITTED, RESUBMITTED and UNDER_REVIEW are approvable. */
  canApprove(status: string): boolean {
    return status === 'SUBMITTED' || status === 'RESUBMITTED' || status === 'UNDER_REVIEW';
  }

  openApproval(): void {
    if (!this.canAct()) return;
    this.approvalBusy.set(true);
    forkJoin({
      supervisors: this.service.listSupervisors().pipe(catchError(() => of([]))),
      departments: this.api.listDepartments().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ supervisors, departments }) => {
        this.supervisorOptions.set(supervisors);
        this.departmentOptions.set(departments);
        this.approvalBusy.set(false);
        this.approvalOpen.set(true);
      },
      error: (e: unknown) => {
        this.approvalBusy.set(false);
        this.toast.show('error', actionErrorMessage(e, this.i18n));
      },
    });
  }

  confirmApproval(selection: ApprovalSelection): void {
    const id = this.bundle()?.application.id;
    if (!id) return;
    this.approvalBusy.set(true);
    this.service
      .approve(id, selection.supervisorUserId, selection.departmentId)
      .subscribe({
        next: (result) => {
          this.approvalBusy.set(false);
          this.approvalOpen.set(false);
          if (result.temporaryPassword && result.credentialEmail) {
            // Shown once: held only while the dialog is open (AGENTS.md §5.3).
            this.credentials.set({
              email: result.credentialEmail,
              password: result.temporaryPassword,
              emailSent: result.credentialEmailSent,
            });
          }
          this.toast.show('success', this.i18n.t('dossier.actionDone'));
          this.load();
        },
        error: (e: unknown) => {
          this.approvalBusy.set(false);
          this.toast.show('error', actionErrorMessage(e, this.i18n));
        },
      });
  }

  cancelApproval(): void {
    this.approvalOpen.set(false);
  }

  /** Closing the dialog drops the plaintext password from app state. */
  closeCredentials(): void {
    this.credentials.set(null);
  }

  canViewRestrictedDocs(): boolean {
    return this.auth.hasPermission('DOCUMENT_VIEW_RESTRICTED');
  }

  isRestrictedBlocked(item: ApplicationDocumentItem): boolean {
    return item.document.restrictedAccess && !this.canViewRestrictedDocs();
  }

  ngOnInit(): void {
    this.crumbs.set([
      { labelKey: 'nav.section.operations', labelFallback: 'Operations' },
      { labelKey: 'nav.applications', labelFallback: 'Applications', url: '/applications' },
      { labelKey: 'dossier.title', labelFallback: 'Dossier' },
    ]);
    this.load();
    // Real-time: refresh dossier when its application is updated elsewhere (no refresh button needed)
    this.realtime.applicationUpdates$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((e) => {
      const currentId = this.route.snapshot.paramMap.get('id');
      if (!e.entityId || e.entityId === currentId) this.load();
    });
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate(['/applications']);
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    this.errorMessage.set('');
    this.service.loadDossier(id).subscribe({
      next: (bundle) => {
        this.bundle.set(bundle);
        this.cinRevealed.set(false);
        this.loading.set(false);
      },
      error: (e: unknown) => {
        this.error.set(true);
        this.errorMessage.set(extractMessage(e));
        this.loading.set(false);
      },
    });
  }

  beginReview(): void {
    this.confirmBegin.set(true);
  }

  doBeginReview(): void {
    const id = this.bundle()?.application.id;
    if (!id) return;
    this.busy.set(true);
    this.service.beginReview(id).subscribe({
      next: () => {
        this.confirmBegin.set(false);
        this.busy.set(false);
        this.toast.show('success', this.i18n.t('dossier.actionDone'));
        this.load();
      },
      error: (e: unknown) => {
        this.confirmBegin.set(false);
        this.busy.set(false);
        this.toast.show('error', actionErrorMessage(e, this.i18n));
      },
    });
  }

  openReason(kind: ReasonKind): void {
    this.verifyTarget = null;
    this.reasonKind.set(kind);
    this.reasonText = '';
    this.reasonError.set('');
  }

  openVerify(item: ApplicationDocumentItem, status: 'VERIFIED' | 'REQUIRES_CORRECTION'): void {
    this.verifyTarget = item;
    this.verifyStatus = status;
    this.reasonKind.set('verify');
    this.reasonText = '';
    this.reasonError.set('');
  }

  closeReason(): void {
    this.reasonKind.set(null);
    this.reasonText = '';
    this.reasonError.set('');
    this.verifyTarget = null;
  }

  reasonTitle(): string {
    switch (this.reasonKind()) {
      case 'reject':
        return this.i18n.t('dossier.reject');
      case 'verify':
        return this.verifyStatus === 'VERIFIED'
          ? this.i18n.t('dossier.verify')
          : this.i18n.t('dossier.requestCorrection');
      default:
        return this.i18n.t('dossier.requestCorrection');
    }
  }

  reasonHint(): string {
    if (this.reasonKind() === 'verify') return this.i18n.t('dossier.verifyHint');
    return this.i18n.t('dossier.reasonHint');
  }

  submitReason(): void {
    const kind = this.reasonKind();
    const id = this.bundle()?.application.id;
    if (!kind || !id) return;
    const text = this.reasonText.trim();
    // Denial and modification reasons are mandatory and meaningful (§5.2).
    if (kind !== 'verify') {
      if (text.length < 10) {
        this.reasonError.set(this.i18n.t('dossier.reasonTooShort'));
        return;
      }
    }
    if (kind === 'verify' && this.verifyStatus === 'REQUIRES_CORRECTION' && text.length < 10) {
      this.reasonError.set(this.i18n.t('dossier.reasonTooShort'));
      return;
    }
    this.busy.set(true);
    const done = () => {
      this.busy.set(false);
      this.closeReason();
      let successMsg = this.i18n.t('dossier.actionDone');
      if (kind === 'verify') {
        successMsg =
          this.verifyStatus === 'VERIFIED'
            ? 'Document validé avec succès ! Une notification a été envoyée au candidat.'
            : 'Demande de correction enregistrée. Une notification a été envoyée au candidat.';
      }
      this.toast.show('success', successMsg);
      this.load();
    };
    const fail = (e: unknown) => {
      this.busy.set(false);
      this.toast.show('error', actionErrorMessage(e, this.i18n));
    };
    if (kind === 'reject') this.service.reject(id, text).subscribe({ next: done, error: fail });
    else if (kind === 'correct')
      this.service.requestCorrection(id, text).subscribe({ next: done, error: fail });
    else if (this.verifyTarget)
      this.service
        .verifyDocument(id, this.verifyTarget.id, {
          status: this.verifyStatus,
          ...(text ? { comment: text } : {}),
        })
        .subscribe({ next: done, error: fail });
  }

  download(item: ApplicationDocumentItem, _preview: boolean): void {
    if (this.isRestrictedBlocked(item)) {
      this.restrictedBlockedNote.set(true);
      return;
    }
    this.service.downloadDocument(item.document.id, item.document.restrictedAccess).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = item.document.originalFileName || `${item.document.reference}.pdf`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (e: unknown) => {
        if (isForbidden(e)) {
          this.restrictedBlockedNote.set(true);
          this.toast.show('error', this.i18n.t('dossier.restrictedBlocked'));
        } else {
          this.toast.show('error', actionErrorMessage(e, this.i18n));
        }
      },
    });
  }

  statusTone(status: string): BadgeTone {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
      case 'WITHDRAWN':
        return 'error';
      case 'MODIFICATION_REQUESTED':
      case 'DRAFT':
        return 'warning';
      default:
        return 'info';
    }
  }

  /**
   * Resend asks the backend for a NEW one-time password (old one is never
   * retrievable, §5.3) through the §5.4 account reset; the dialog only swaps
   * the displayed secret.
   */
  resendCredentials(): void {
    const current = this.credentials();
    if (!current || this.resendBusy()) return;
    this.resendBusy.set(true);
    this.api.listInternAccounts(current.email).subscribe({
      next: (accounts) => {
        const account = accounts.find(
          (a) => a.email.toLowerCase() === current.email.toLowerCase(),
        );
        if (!account) {
          this.resendBusy.set(false);
          this.toast.show('error', this.i18n.t('credentials.resendFailed'));
          return;
        }
        this.api.resetInternAccountPassword(account.id).subscribe({
          next: (result) => {
            this.resendBusy.set(false);
            this.credentials.set({
              email: result.email,
              password: result.temporaryPassword,
              emailSent: result.emailSent,
            });
          },
          error: () => {
            this.resendBusy.set(false);
            this.toast.show('error', this.i18n.t('credentials.resendFailed'));
          },
        });
      },
      error: () => {
        this.resendBusy.set(false);
        this.toast.show('error', this.i18n.t('credentials.resendFailed'));
      },
    });
  }

  decisionTone(decision: string): BadgeTone {
    switch (decision) {
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'error';
      case 'MODIFICATION_REQUESTED':
      case 'RETURNED':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  verifyTone(status: string): BadgeTone {
    switch (status) {
      case 'VERIFIED':
        return 'success';
      case 'REJECTED':
        return 'error';
      case 'REQUIRES_CORRECTION':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  formatSize(bytes: number): string {
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
  }

  formatDateTime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString(this.i18n.locale());
  }
}

function extractMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const status = (error as { status?: number }).status;
    if (status === 403) return '';
    const envelope = (error as { error?: { message?: string } }).error;
    if (envelope?.message) return envelope.message;
  }
  return '';
}

function isForbidden(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { status?: number }).status === 403
  );
}

function actionErrorMessage(error: unknown, i18n: I18nService): string {
  if (isForbidden(error)) return i18n.t('common.forbidden.body');
  const message = extractMessage(error);
  return message || i18n.t('common.error.body');
}
