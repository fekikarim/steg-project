import { Component, inject, signal, OnInit, OnDestroy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { RealtimeService } from '../../core/realtime.service';
import { DashboardSummaryService } from '../dashboard/dashboard-summary.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import { DistBarsComponent } from '../dashboard/dist-bars.component';
import type { GroupCountDto, SupervisorDashboardSummary } from '../../core/api-models';

/**
 * Supervisor home dashboard (AGENTS.md §8.3 + §6.4, S11): statistics and
 * quick info for the caller's OWN candidates and tasks, rendered from ONE
 * scoped backend call (`GET /api/reports/supervisor-summary`; an Admin caller
 * sees global numbers). The client never computes numbers from paged lists
 * and never re-implements scope — every tile deep-links to the filtered list
 * that the same backend scope would return. Charts stay CSS-only.
 */
@Component({
  selector: 'st-supervisor-home',
  standalone: true,
  imports: [
    RouterLink,
    PageHeaderComponent,
    LiveStatusComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    DistBarsComponent,
  ],
  template: `
    <st-page-header
      [title]="i18n.t('supervisor.dashboardTitle')"
      [subtitle]="i18n.t('supervisor.subtitle')"
    >
      <st-live-status />
    </st-page-header>

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
      <section class="st-kpis" aria-label="kpis">
        <a routerLink="/candidates" class="st-kpi">
          <span class="st-kpi__label">{{ i18n.t('supervisor.myCandidates') }}</span>
          <strong class="st-kpi__value">{{ s.myCandidates }}</strong>
          <span class="st-kpi__link">{{ i18n.t('dashboard.viewQueue') }} →</span>
        </a>
        <a routerLink="/tasks" [queryParams]="{ status: 'COMPLETED' }" class="st-kpi">
          <span class="st-kpi__label">{{ i18n.t('supervisor.tasksAwaitingApproval') }}</span>
          <strong class="st-kpi__value">{{ s.tasksAwaitingApproval }}</strong>
          <span class="st-kpi__link">{{ i18n.t('dashboard.viewQueue') }} →</span>
        </a>
        <a routerLink="/tasks" class="st-kpi">
          <span class="st-kpi__label">{{ i18n.t('supervisor.overdueTasks') }}</span>
          <strong class="st-kpi__value">{{ s.overdueTasks }}</strong>
          <span class="st-kpi__link">{{ i18n.t('dashboard.viewQueue') }} →</span>
        </a>
        <a routerLink="/notifications" class="st-kpi">
          <span class="st-kpi__label">{{ i18n.t('supervisor.unreadNotifications') }}</span>
          <strong class="st-kpi__value">{{ s.unreadNotifications }}</strong>
          @if (s.unreadNotifications > 0) {
            <span class="st-kpi__link">
              <st-badge [label]="i18n.t('dashboard.unread')" tone="info" />
            </span>
          }
        </a>
      </section>

      <div class="st-grid">
        <section class="st-card" [attr.aria-label]="i18n.t('supervisor.candidatesByStatus')">
          <h2 class="st-card__title">{{ i18n.t('supervisor.candidatesByStatus') }}</h2>
          @if (statusGroups(s).length === 0) {
            <p class="st-muted">{{ i18n.t('dashboard.empty') }}</p>
          } @else {
            <st-dist-bars
              [label]="i18n.t('supervisor.candidatesByStatus')"
              [groups]="statusGroups(s)"
            />
          }
          <p class="st-src">{{ i18n.t('dashboard.source', { source: source }) }}</p>
        </section>
        <section class="st-card" [attr.aria-label]="i18n.t('supervisor.recentNotifications')">
          <div class="st-card__head">
            <h2 class="st-card__title">{{ i18n.t('supervisor.recentNotifications') }}</h2>
            <a routerLink="/notifications" class="st-btn st-btn--text">{{
              i18n.t('dashboard.markAllRead')
            }}</a>
          </div>
          @if (s.recentNotifications.length === 0) {
            <p class="st-muted">{{ i18n.t('dashboard.empty') }}</p>
          } @else {
            <ul class="st-activity">
              @for (n of s.recentNotifications; track n.id) {
                <li class="st-activity__row">
                  <strong dir="auto">{{ n.title }}</strong>
                  <span dir="ltr">{{ n.createdAt }}</span>
                </li>
              }
            </ul>
          }
          <p class="st-src">{{ i18n.t('dashboard.source', { source: source }) }}</p>
        </section>
      </div>

      @if (unavailable()) {
        <p class="st-muted">
          <strong>{{ i18n.t('dashboard.unavailable.title') }}</strong
          ><br />
          {{ i18n.t('dashboard.unavailable.body') }}
        </p>
      }
    } @else {
      <st-empty-state [title]="i18n.t('common.empty.title')" [body]="i18n.t('dashboard.empty')" />
    }
  `,
  styles: [
    `
      .st-kpis {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(4, 1fr);
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
      .st-card__head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .st-card__title {
        margin: 0 0 0.6rem;
        font-size: 0.95rem;
      }
      .st-card__head .st-card__title {
        margin-block-end: 0;
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
      .st-activity {
        list-style: none;
        margin: 0.6rem 0 0;
        padding: 0;
        display: grid;
        gap: 0.4rem;
      }
      .st-activity__row {
        display: grid;
        gap: 0.15rem;
        font-size: 0.82rem;
        color: var(--text-secondary);
        padding: 0.5rem 0.65rem;
        border-inline-start: 2px solid var(--border-default);
      }
      .st-activity__row strong {
        color: var(--text-primary);
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
export class SupervisorHomeComponent implements OnInit, OnDestroy {
  readonly i18n = inject(I18nService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly service = inject(DashboardSummaryService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly source = 'GET /api/reports/supervisor-summary';

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly unavailable = signal(false);
  readonly summary = signal<SupervisorDashboardSummary | null>(null);
  readonly refreshedAt = signal<string>('');

  ngOnInit(): void {
    this.crumbs.set([{ labelKey: 'nav.dashboard', labelFallback: 'Dashboard' }]);
    this.load();
    this.realtime.backofficeEvents$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.load();
    });
  }

  ngOnDestroy(): void {}

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.unavailable.set(false);
    this.service.supervisor().subscribe({
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

  statusGroups(s: SupervisorDashboardSummary): readonly GroupCountDto[] {
    return Object.entries(s.candidatesByStatus)
      .filter(([, count]) => count > 0)
      .map(([groupName, count]) => ({ groupName, count }));
  }
}
