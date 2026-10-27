import { Component, inject, signal, computed, DestroyRef, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n.service';
import { BreadcrumbService } from '../../core/breadcrumb.service';
import { ApiClient } from '../../core/api-client.service';
import { RealtimeService, type RealtimeNotificationPayload } from '../../core/realtime.service';
import { ToastService } from '../../shared/ui/toast.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { BadgeComponent, type BadgeTone } from '../../shared/ui/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui/states.component';
import { LiveStatusComponent } from '../../shared/ui/live-status.component';
import { StIconComponent } from '../../shared/ui/icon.component';
import { dayGroup, formatDateTime, formatRelative } from '../../core/format';
import type { NotificationItem } from '../../core/api-models';

type DayBucket = 'today' | 'yesterday' | 'week' | 'older';
type Filter = 'all' | 'unread';

interface NotificationRow {
  readonly item: NotificationItem;
  readonly group: DayBucket;
}

interface NotificationSection {
  readonly group: DayBucket;
  readonly label: string;
  readonly rows: readonly NotificationRow[];
}

const GROUP_ORDER: readonly DayBucket[] = ['today', 'yesterday', 'week', 'older'];

/** relatedEntityType -> Back Office route (undefined = informational only). */
const ENTITY_ROUTES: Record<string, (id: string) => readonly string[]> = {
  Internship: (id) => ['/internships', id],
  InternshipApplication: (id) => ['/applications', id],
  FinanceCase: (id) => ['/finance', id],
  Candidate: (id) => ['/candidates', id],
};

const ENTITY_ICONS: Record<string, string> = {
  Internship: 'briefcase',
  InternshipAssignment: 'briefcase',
  InternshipApplication: 'file',
  ApplicationDocument: 'file',
  JournalEntry: 'file',
  Candidate: 'users',
  FinanceCase: 'wallet',
  PaymentApproval: 'wallet',
  Task: 'check',
  Certificate: 'shield',
  Conversation: 'link',
};

/**
 * Staff notification center: own deliveries only (backend-scoped), grouped by
 * recency, severity-coloured, deep-linked to the related record and refreshed
 * live on every push. Unread state drives both the accent and the bell badge,
 * so triage never needs a manual refresh.
 */
@Component({
  selector: 'st-notification-center',
  standalone: true,
  imports: [
    RouterLink,
    PageHeaderComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LiveStatusComponent,
    StIconComponent,
  ],
  template: `
    <st-page-header
      [title]="i18n.t('notifications.title')"
      [subtitle]="i18n.t('notifications.subtitle')"
    >
      <st-live-status />
      <button
        type="button"
        class="st-btn st-btn--secondary"
        [disabled]="busy() || unreadCount() === 0"
        (click)="readAll()"
      >
        <st-icon name="check" [size]="15" />
        {{ i18n.t('notifications.readAll') }}
      </button>
    </st-page-header>

    <div class="st-nc-bar">
      <div class="st-seg" role="group" [attr.aria-label]="i18n.t('notifications.filter')">
        <button
          type="button"
          class="st-seg__btn"
          [class.st-seg__btn--on]="filter() === 'all'"
          [attr.aria-pressed]="filter() === 'all'"
          (click)="setFilter('all')"
        >
          {{ i18n.t('notifications.filterAll') }}
          <span class="st-seg__n">{{ items().length }}</span>
        </button>
        <button
          type="button"
          class="st-seg__btn"
          [class.st-seg__btn--on]="filter() === 'unread'"
          [attr.aria-pressed]="filter() === 'unread'"
          (click)="setFilter('unread')"
        >
          <st-icon name="bell" [size]="14" />
          {{ i18n.t('notifications.filterUnread') }}
          <span class="st-seg__n">{{ unreadCount() }}</span>
        </button>
      </div>
      <span class="st-nc-bar__spacer"></span>
      <p class="st-nc-summary" role="status">
        <st-icon name="info" [size]="14" />
        {{
          i18n.t('notifications.unreadSummary', {
            n: unreadCount().toString(),
            total: items().length.toString(),
          })
        }}
      </p>
    </div>

    @if (loading()) {
      <st-skeleton [rows]="6" />
    } @else if (error()) {
      <st-error-state
        [title]="i18n.t('common.error.title')"
        [body]="i18n.t('common.error.body')"
        [retryLabel]="i18n.t('common.retry')"
        (retry)="load()"
      />
    } @else if (sections().length === 0) {
      <st-empty-state
        [title]="
          i18n.t(
            filter() === 'unread' ? 'notifications.unreadEmptyTitle' : 'notifications.emptyTitle'
          )
        "
        [body]="
          i18n.t(
            filter() === 'unread' ? 'notifications.unreadEmptyBody' : 'notifications.emptyBody'
          )
        "
      />
    } @else {
      @for (section of sections(); track section.group) {
        <section class="st-nc-section" [attr.aria-label]="section.label">
          <h2 class="st-nc-section__title">
            {{ section.label }}
            <span class="st-nc-section__n">{{ section.rows.length }}</span>
          </h2>
          <ul class="st-nc-list">
            @for (row of section.rows; track row.item.id) {
              <li
                class="st-nc-item"
                [class.st-nc-item--unread]="!row.item.read"
                [attr.data-priority]="row.item.priority"
              >
                <span class="st-nc-item__icon" aria-hidden="true">
                  <st-icon [name]="icon(row.item)" [size]="17" />
                </span>
                <div class="st-nc-item__body">
                  <p class="st-nc-item__head">
                    <span class="st-nc-item__title" dir="auto">{{ row.item.title }}</span>
                    @if (row.item.priority === 'URGENT' || row.item.priority === 'HIGH') {
                      <st-badge
                        [label]="row.item.priority"
                        [tone]="priorityTone(row.item.priority)"
                      />
                    }
                    @if (!row.item.read) {
                      <span class="st-nc-item__dot" aria-hidden="true"></span>
                      <span class="st-sr-only">{{ i18n.t('notifications.unreadLabel') }}</span>
                    }
                  </p>
                  <p class="st-nc-item__msg" dir="auto">{{ row.item.message }}</p>
                  <p class="st-nc-item__meta">
                    <time [attr.datetime]="row.item.createdAt" [attr.title]="absolute(row.item)">
                      {{ relative(row.item) }}
                    </time>
                    <span class="st-nc-item__sep" aria-hidden="true">·</span>
                    <span dir="auto">{{ entityLabel(row.item) }}</span>
                    @if (entityLink(row.item); as link) {
                      <span class="st-nc-item__sep" aria-hidden="true">·</span>
                      <a [routerLink]="link" class="st-ref" (click)="readOne(row.item.id)">
                        {{ i18n.t('notifications.openRelated') }}
                      </a>
                    }
                  </p>
                </div>
                @if (!row.item.read) {
                  <button
                    type="button"
                    class="st-btn st-btn--text st-nc-item__action"
                    [disabled]="busy()"
                    (click)="readOne(row.item.id)"
                  >
                    {{ i18n.t('notifications.markRead') }}
                  </button>
                }
              </li>
            }
          </ul>
        </section>
      }
      @if (hasMore()) {
        <button type="button" class="st-btn st-btn--secondary" [disabled]="busy()" (click)="more()">
          {{ i18n.t('common.more') }}
        </button>
      }
    }
  `,
  styles: [
    `
      .st-nc-bar {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-block-end: 1rem;
      }
      .st-nc-bar__spacer {
        flex: 1;
      }
      .st-nc-summary {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        margin: 0;
        font-size: 0.8rem;
        color: var(--text-secondary);
      }
      .st-seg {
        display: inline-flex;
        padding: 0.2rem;
        gap: 0.2rem;
        background: var(--bg-subtle);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius);
      }
      .st-seg__btn {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.35rem 0.6rem;
        border: 1px solid transparent;
        border-radius: calc(var(--radius) - 0.15rem);
        background: none;
        color: var(--text-secondary);
        font: inherit;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition:
          background-color 0.15s ease,
          color 0.15s ease,
          box-shadow 0.15s ease;
      }
      .st-seg__btn:hover {
        color: var(--text-primary);
      }
      .st-seg__btn--on {
        background: var(--bg-surface);
        color: var(--text-primary);
        border-color: var(--border-subtle);
        box-shadow: var(--shadow-sm);
      }
      .st-seg__btn:focus-visible {
        outline: 2px solid var(--action-primary);
        outline-offset: 1px;
      }
      .st-seg__n {
        min-inline-size: 1.35rem;
        padding: 0.05rem 0.35rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--text-muted) 18%, transparent);
        color: var(--text-secondary);
        font-size: 0.7rem;
        font-variant-numeric: tabular-nums;
        text-align: center;
      }
      .st-seg__btn--on .st-seg__n {
        background: var(--brand-primary-soft);
        color: var(--brand-primary-strong);
      }
      .st-nc-section {
        margin-block-end: 1.1rem;
      }
      .st-nc-section__title {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        margin: 0 0 0.45rem;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
      }
      .st-nc-section__n {
        padding: 0.05rem 0.4rem;
        border-radius: 999px;
        background: var(--bg-subtle);
        border: 1px solid var(--border-subtle);
        color: var(--text-secondary);
        font-size: 0.68rem;
        letter-spacing: 0;
      }
      .st-nc-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.5rem;
      }
      .st-nc-item {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: start;
        gap: 0.75rem;
        padding: 0.8rem 0.9rem;
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius);
        border-inline-start: 3px solid var(--border-default);
        transition:
          border-color 0.15s ease,
          background-color 0.15s ease;
      }
      .st-nc-item:hover {
        border-color: color-mix(in srgb, var(--action-primary) 35%, var(--border-subtle));
      }
      .st-nc-item--unread {
        background: var(--brand-primary-soft);
        border-inline-start-color: var(--action-primary);
      }
      .st-nc-item[data-priority='HIGH'] {
        border-inline-start-color: var(--status-warning);
      }
      .st-nc-item[data-priority='URGENT'] {
        border-inline-start-color: var(--status-error);
      }
      .st-nc-item__icon {
        display: grid;
        place-items: center;
        inline-size: 2rem;
        block-size: 2rem;
        border-radius: 0.55rem;
        background: var(--bg-subtle);
        border: 1px solid var(--border-subtle);
        color: var(--text-secondary);
      }
      .st-nc-item[data-priority='HIGH'] .st-nc-item__icon {
        background: color-mix(in srgb, var(--status-warning) 12%, var(--bg-surface));
        border-color: color-mix(in srgb, var(--status-warning) 32%, transparent);
        color: var(--status-warning);
      }
      .st-nc-item[data-priority='URGENT'] .st-nc-item__icon {
        background: color-mix(in srgb, var(--status-error) 12%, var(--bg-surface));
        border-color: color-mix(in srgb, var(--status-error) 32%, transparent);
        color: var(--status-error);
      }
      .st-nc-item__body {
        min-inline-size: 0;
        display: grid;
        gap: 0.2rem;
      }
      .st-nc-item__head {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex-wrap: wrap;
        margin: 0;
      }
      .st-nc-item__title {
        font-weight: 600;
        color: var(--text-primary);
      }
      .st-nc-item--unread .st-nc-item__title {
        font-weight: 700;
      }
      .st-nc-item__dot {
        inline-size: 0.45rem;
        block-size: 0.45rem;
        border-radius: 999px;
        background: var(--action-primary);
      }
      .st-nc-item__msg {
        margin: 0;
        font-size: 0.85rem;
        line-height: 1.5;
        color: var(--text-secondary);
        overflow-wrap: anywhere;
      }
      .st-nc-item__meta {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        flex-wrap: wrap;
        margin: 0.1rem 0 0;
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      .st-nc-item__sep {
        opacity: 0.6;
      }
      .st-nc-item__action {
        align-self: center;
        white-space: nowrap;
      }
      .st-ref {
        font-weight: 600;
        color: var(--action-primary);
        text-decoration: none;
      }
      .st-ref:hover {
        text-decoration: underline;
      }
      .st-sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
      @media (max-width: 599px) {
        .st-nc-item {
          grid-template-columns: auto 1fr;
        }
        .st-nc-item__action {
          grid-column: 2;
          justify-self: start;
        }
      }
    `,
  ],
})
export class NotificationCenterComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private readonly api = inject(ApiClient);
  private readonly realtime = inject(RealtimeService);
  private readonly toast = inject(ToastService);
  private readonly crumbs = inject(BreadcrumbService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal(false);
  readonly items = signal<readonly NotificationItem[]>([]);
  readonly hasMore = signal(false);
  readonly filter = signal<Filter>('all');
  private page = 0;
  private readonly size = 20;

  readonly unreadCount = computed(() => this.items().filter((n) => !n.read).length);
  readonly sections = computed<readonly NotificationSection[]>(() => {
    const rows = (this.filter() === 'unread' ? this.items().filter((n) => !n.read) : this.items())
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item): NotificationRow => ({ item, group: dayGroup(item.createdAt) }));
    return GROUP_ORDER.map((group) => ({
      group,
      label: this.i18n.t(`notifications.group.${group}`),
      rows: rows.filter((r) => r.group === group),
    })).filter((section) => section.rows.length > 0);
  });

  ngOnInit(): void {
    this.crumbs.set([{ labelKey: 'nav.notifications', labelFallback: 'Notifications' }]);
    this.load();
    // Live: prepend the pushed item instantly, then reconcile with the server.
    this.realtime.notifications$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((payload) => this.onPush(payload));
  }

  setFilter(filter: Filter): void {
    this.filter.set(filter);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.api.getNotifications(false, 0, this.size).subscribe({
      next: (page) => {
        this.items.set(page.content);
        this.hasMore.set((page.number + 1) * page.size < page.totalElements);
        this.page = 0;
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  more(): void {
    this.busy.set(true);
    this.api.getNotifications(false, this.page + 1, this.size).subscribe({
      next: (page) => {
        this.items.update((rows) => [...rows, ...page.content]);
        this.hasMore.set((page.number + 1) * page.size < page.totalElements);
        this.page += 1;
        this.busy.set(false);
      },
      error: () => {
        this.busy.set(false);
        this.toast.show('error', this.i18n.t('common.error.body'));
      },
    });
  }

  readOne(id: string): void {
    this.busy.set(true);
    this.api.markNotificationRead(id).subscribe({
      next: () => {
        this.items.update((rows) =>
          rows.map((n) =>
            n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n,
          ),
        );
        this.busy.set(false);
      },
      error: () => {
        this.busy.set(false);
        this.toast.show('error', this.i18n.t('common.error.body'));
      },
    });
  }

  readAll(): void {
    this.busy.set(true);
    this.api.markAllNotificationsRead().subscribe({
      next: () => {
        this.items.update((rows) => rows.map((n) => ({ ...n, read: true })));
        this.busy.set(false);
        this.toast.show('success', this.i18n.t('notifications.allRead'));
      },
      error: () => {
        this.busy.set(false);
        this.toast.show('error', this.i18n.t('common.error.body'));
      },
    });
  }

  /** Optimistic prepend: the row is usable before the reconcile round-trip lands. */
  private onPush(payload: RealtimeNotificationPayload): void {
    const id = payload.notificationId;
    if (!id || this.items().some((n) => n.id === id)) return;
    const item: NotificationItem = {
      id,
      title: payload.title || this.i18n.t('notifications.title'),
      message: payload.message,
      priority: (payload.priority as NotificationItem['priority']) || 'NORMAL',
      relatedEntityType: payload.relatedEntityType || '',
      relatedEntityId: payload.relatedEntityId || '',
      createdAt: payload.createdAt || new Date().toISOString(),
      read: false,
      readAt: null,
    };
    this.items.update((rows) => [item, ...rows]);
    this.loading.set(false);
  }

  icon(item: NotificationItem): string {
    return ENTITY_ICONS[item.relatedEntityType] ?? 'bell';
  }

  priorityTone(priority: NotificationItem['priority']): BadgeTone {
    if (priority === 'URGENT') return 'error';
    if (priority === 'HIGH') return 'warning';
    if (priority === 'NORMAL') return 'info';
    return 'neutral';
  }

  entityLabel(item: NotificationItem): string {
    const type = item.relatedEntityType;
    if (!type) return '';
    const translated = this.i18n.t(`notifications.entity.${type}`);
    return translated.startsWith('notifications.entity.') ? type : translated;
  }

  entityLink(item: NotificationItem): readonly string[] | null {
    const build = ENTITY_ROUTES[item.relatedEntityType];
    return item.relatedEntityId && build ? build(item.relatedEntityId) : null;
  }

  relative(item: NotificationItem): string {
    return formatRelative(item.createdAt, this.i18n.locale());
  }

  absolute(item: NotificationItem): string {
    return formatDateTime(item.createdAt, this.i18n.locale());
  }
}
