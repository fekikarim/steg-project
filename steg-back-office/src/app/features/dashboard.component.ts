import { Component, inject, signal, computed, OnInit, OnDestroy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { I18nService } from '../core/i18n.service';
import { AuthService } from '../core/auth.service';
import { BreadcrumbService } from '../core/breadcrumb.service';
import { DashboardSummaryService } from './dashboard/dashboard-summary.service';
import { RealtimeService } from '../core/realtime.service';
import { PageHeaderComponent } from '../shared/ui/page-header.component';
import { SkeletonComponent } from '../shared/ui/skeleton.component';
import { ErrorStateComponent } from '../shared/ui/states.component';
import { DistBarsComponent } from './dashboard/dist-bars.component';
import { LiveStatusComponent } from '../shared/ui/live-status.component';
import { AiInsightsComponent } from './ai/ai-insights.component';
import type { AdminDashboardSummary, GroupCountDto } from '../core/api-models';

/**
 * Admin operational dashboard (AGENTS.md §8.3, S11): global statistics and
 * quick actions for every module, rendered from ONE scoped backend call
 * (`GET /api/reports/admin-summary`). The client never computes numbers from
 * paged lists — every tile deep-links to the filtered list that the same
 * backend scope would return. Charts stay CSS-only (`st-dist-bars`).
 */
@Component({
  selector: 'st-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    PageHeaderComponent,
    SkeletonComponent,
    ErrorStateComponent,
    DistBarsComponent,
    LiveStatusComponent,
    AiInsightsComponent,
  ],
  template: `
    <st-page-header [title]="i18n.t('dashboard.title')" [subtitle]="i18n.t('dashboard.subtitle')">
      <st-live-status />
    </st-page-header>

    @if (refreshedAt()) {
      <p class="st-updated" aria-live="polite">
        {{ i18n.t('dashboard.updatedAt', { time: refreshedAt() }) }}
      </p>
    }

    @if (loading()) {
      <div class="st-kpis" aria-busy="true">
        <st-skeleton [rows]="4" />
        <st-skeleton [rows]="4" />
      </div>
    } @else if (error()) {
      <st-error-state
        [title]="i18n.t('common.error.title')"
        [body]="error()!"
        [retryLabel]="i18n.t('common.retry')"
        (retry)="load()"
      />
    } @else if (summary(); as s) {
      <section class="st-kpis" aria-label="Operations">
        <a routerLink="/applications" [queryParams]="{ status: 'SUBMITTED' }" class="st-kpi">
          <span class="st-kpi__label">{{ i18n.t('dashboard.kpi.pendingApplications') }}</span>
          <strong class="st-kpi__value">{{ pendingApplications(s) }}</strong>
          <span class="st-kpi__link">{{ i18n.t('dashboard.viewQueue') }} →</span>
        </a>
        <a routerLink="/candidates" [queryParams]="{ from: newCandidatesFrom() }" class="st-kpi">
          <span class="st-kpi__label">{{ i18n.t('dashboard.tiles.newCandidates') }}</span>
          <strong class="st-kpi__value">{{ s.newCandidates }}</strong>
          <span class="st-kpi__link">{{ i18n.t('dashboard.viewQueue') }} →</span>
        </a>
        <a routerLink="/tasks" [queryParams]="{ status: 'COMPLETED' }" class="st-kpi">
          <span class="st-kpi__label">{{ i18n.t('dashboard.tiles.tasksAwaitingApproval') }}</span>
          <strong class="st-kpi__value">{{ s.tasksAwaitingApproval }}</strong>
          <span class="st-kpi__link">{{ i18n.t('dashboard.viewQueue') }} →</span>
        </a>
        <a routerLink="/validation" [queryParams]="{ status: 'REPORT_SUBMITTED' }" class="st-kpi">
          <span class="st-kpi__label">{{
            i18n.t('dashboard.tiles.reportsAwaitingValidation')
          }}</span>
          <strong class="st-kpi__value">{{ pendingReports(s) }}</strong>
          <span class="st-kpi__link">{{ i18n.t('dashboard.viewQueue') }} →</span>
        </a>
        <a routerLink="/finance" class="st-kpi">
          <span class="st-kpi__label">{{ i18n.t('dashboard.tiles.receiptsIssued') }}</span>
          <strong class="st-kpi__value">{{ s.receiptsIssued }}</strong>
          <span class="st-kpi__link">{{ i18n.t('dashboard.viewQueue') }} →</span>
        </a>
        <a routerLink="/certificates" [queryParams]="{ status: 'GENERATED' }" class="st-kpi">
          <span class="st-kpi__label">{{ i18n.t('dashboard.tiles.certificatesIssued') }}</span>
          <strong class="st-kpi__value">{{ s.certificatesIssued }}</strong>
          <span class="st-kpi__link">{{ i18n.t('dashboard.viewQueue') }} →</span>
        </a>
      </section>

      <div class="st-grid">
        <section class="st-card" [attr.aria-label]="i18n.t('dashboard.section.applications')">
          <h2 class="st-card__title">{{ i18n.t('dashboard.section.applications') }}</h2>
          @if (appGroups(s).length === 0) {
            <p class="st-muted">{{ i18n.t('dashboard.empty') }}</p>
          } @else {
            <st-dist-bars
              [label]="i18n.t('dashboard.section.applications')"
              [groups]="appGroups(s)"
            />
          }
          <p class="st-src">{{ i18n.t('dashboard.source', { source: source }) }}</p>
        </section>
        <section class="st-card" [attr.aria-label]="i18n.t('dashboard.section.reportStages')">
          <h2 class="st-card__title">{{ i18n.t('dashboard.section.reportStages') }}</h2>
          @if (reportGroups(s).length === 0) {
            <p class="st-muted">{{ i18n.t('dashboard.empty') }}</p>
          } @else {
            <st-dist-bars
              [label]="i18n.t('dashboard.section.reportStages')"
              [groups]="reportGroups(s)"
            />
          }
          <p class="st-src">{{ i18n.t('dashboard.source', { source: source }) }}</p>
        </section>
      </div>

      <section class="st-card" [attr.aria-label]="i18n.t('dashboard.section.workload')">
        <h2 class="st-card__title">{{ i18n.t('dashboard.section.workload') }}</h2>
        @if (s.supervisorWorkload.length === 0) {
          <p class="st-muted">{{ i18n.t('dashboard.empty') }}</p>
        } @else {
          <ul class="st-queue">
            @for (row of s.supervisorWorkload; track row.supervisorUserId) {
              <li>
                <a
                  routerLink="/candidates"
                  [queryParams]="{ supervisor: row.supervisorUserId }"
                  class="st-queue__row"
                >
                  <span dir="auto">{{ row.email }}</span>
                  <strong>{{ row.candidateCount }}</strong>
                </a>
              </li>
            }
          </ul>
        }
        <p class="st-src">{{ i18n.t('dashboard.source', { source: source }) }}</p>
      </section>

      <div class="st-grid">
        <section class="st-card" [attr.aria-label]="i18n.t('dashboard.section.trendsApplications')">
          <h2 class="st-card__title">{{ i18n.t('dashboard.section.trendsApplications') }}</h2>
          <st-dist-bars
            [label]="i18n.t('dashboard.section.trendsApplications')"
            [groups]="trendGroups(s, 'applications')"
          />
          <p class="st-src">{{ i18n.t('dashboard.source', { source: source }) }}</p>
        </section>
        <section class="st-card" [attr.aria-label]="i18n.t('dashboard.section.trendsInternships')">
          <h2 class="st-card__title">{{ i18n.t('dashboard.section.trendsInternships') }}</h2>
          <st-dist-bars
            [label]="i18n.t('dashboard.section.trendsInternships')"
            [groups]="trendGroups(s, 'internships')"
          />
          <p class="st-src">{{ i18n.t('dashboard.source', { source: source }) }}</p>
        </section>
      </div>

      <st-ai-insights />

      @if (unavailable()) {
        <p class="st-muted">
          <strong>{{ i18n.t('dashboard.unavailable.title') }}</strong
          ><br />
          {{ i18n.t('dashboard.unavailable.body') }}
        </p>
      }
    }
  `,
  styles: [
    `
      .st-updated {
        font-size: 0.75rem;
        color: var(--text-muted);
        margin: 0 0 0.75rem;
      }
      .st-kpis {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(3, 1fr);
        margin-block-end: 1rem;
      }
      .st-kpi {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 0.7rem;
        padding: 0.9rem;
        display: grid;
        gap: 0.25rem;
        text-decoration: none;
        color: inherit;
      }
      a.st-kpi:hover {
        border-color: var(--action-primary);
      }
      .st-kpi__label {
        font-size: 0.75rem;
        color: var(--text-secondary);
      }
      .st-kpi__value {
        font-size: 1.6rem;
        color: var(--text-primary);
        font-variant-numeric: tabular-nums;
      }
      .st-kpi__link {
        font-size: 0.72rem;
        color: var(--action-primary);
      }
      .st-grid {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        margin-block-end: 0.75rem;
      }
      .st-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 0.7rem;
        padding: 1rem;
        margin-block-end: 0.75rem;
      }
      .st-card__title {
        margin: 0 0 0.6rem;
        font-size: 0.95rem;
      }
      .st-src {
        font-size: 0.7rem;
        color: var(--text-muted);
        margin: 0.6rem 0 0;
        overflow-wrap: anywhere;
      }
      .st-muted {
        font-size: 0.82rem;
        color: var(--text-secondary);
        margin: 0;
      }
      .st-queue {
        list-style: none;
        margin: 0.6rem 0 0;
        padding: 0;
        display: grid;
        gap: 0.4rem;
      }
      .st-queue__row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
        padding: 0.55rem 0.65rem;
        border: 1px solid var(--border-subtle);
        border-radius: 0.55rem;
        text-decoration: none;
        color: inherit;
        font-size: 0.85rem;
        font-variant-numeric: tabular-nums;
      }
      .st-queue__row:hover {
        border-color: var(--action-primary);
      }
      @media (max-width: 1023px) {
        .st-kpis {
          grid-template-columns: repeat(2, 1fr);
        }
        .st-grid {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      @media (max-width: 480px) {
        .st-kpis {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly service = inject(DashboardSummaryService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly source = 'GET /api/reports/admin-summary';

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly unavailable = signal(false);
  readonly summary = signal<AdminDashboardSummary | null>(null);
  readonly refreshedAt = signal<string>('');

  /** Lower bound of the "new candidates" window (last 30 days), yyyy-MM-dd. */
  readonly newCandidatesFrom = computed(() => {
    const d = new Date(Date.now() - 30 * 86_400_000);
    return d.toISOString().slice(0, 10);
  });

  ngOnInit(): void {
    this.crumbs.set([{ labelKey: 'nav.dashboard', labelFallback: 'Dashboard' }]);
    // Supervisors land on their dashboard; the global summary is ADMIN-only.
    if (this.auth.role() === 'SUPERVISOR') {
      void this.router.navigate(['/supervisor-dashboard']);
      return;
    }
    this.load();
    // Real-time: dashboard reacts to domain events (no refresh button needed).
    this.realtime.backofficeEvents$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.load();
    });
  }

  ngOnDestroy(): void {}

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.unavailable.set(false);
    this.service.admin().subscribe({
      next: (res) => {
        if (res.state === 'ok' && res.data) {
          this.summary.set(res.data);
          this.refreshedAt.set(
            new Date().toLocaleTimeString(this.i18n.locale(), {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          );
        } else if (res.state === 'unavailable') {
          this.unavailable.set(true);
        } else {
          this.error.set(this.i18n.t('common.error.body'));
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.i18n.t('common.error.body'));
        this.loading.set(false);
      },
    });
  }

  pendingApplications(s: AdminDashboardSummary): number {
    return s.applicationsByStatus['SUBMITTED'] ?? 0;
  }

  pendingReports(s: AdminDashboardSummary): number {
    return s.reportsAwaitingValidation['REPORT_SUBMITTED'] ?? 0;
  }

  appGroups(s: AdminDashboardSummary): readonly GroupCountDto[] {
    return toGroups(s.applicationsByStatus);
  }

  reportGroups(s: AdminDashboardSummary): readonly GroupCountDto[] {
    return toGroups(s.reportsAwaitingValidation);
  }

  trendGroups(
    s: AdminDashboardSummary,
    key: 'applications' | 'internships',
  ): readonly GroupCountDto[] {
    return s.trends.map((t) => ({ groupName: t.month, count: t[key] }));
  }
}

function toGroups(map: Readonly<Record<string, number>>): readonly GroupCountDto[] {
  return Object.entries(map)
    .filter(([, count]) => count > 0)
    .map(([groupName, count]) => ({ groupName, count }));
}
