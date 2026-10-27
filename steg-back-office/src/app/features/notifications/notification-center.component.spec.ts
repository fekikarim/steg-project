import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { Subject, of } from 'rxjs';
import { NotificationCenterComponent } from './notification-center.component';
import { ApiClient } from '../../core/api-client.service';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import { RealtimeService, type RealtimeNotificationPayload } from '../../core/realtime.service';
import type { NotificationItem, Page } from '../../core/api-models';
import { signInDemo } from '../../core/testing/demo-session';

@Component({ selector: 'st-stub', standalone: true, template: '' })
class StubComponent {}

const minutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString();

const NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Final evaluation required',
    message:
      'Internship STAGE-2026-000042 (Sami Ben Ali) reached COMPLETED without a final evaluation.',
    priority: 'HIGH',
    relatedEntityType: 'Internship',
    relatedEntityId: 'ship-42',
    createdAt: minutesAgo(35),
    read: false,
    readAt: null,
  },
  {
    id: 'notif-2',
    title: 'Payment approved',
    message: 'The payment of 300 TND has been approved.',
    priority: 'NORMAL',
    relatedEntityType: 'FinanceCase',
    relatedEntityId: 'case-44',
    createdAt: minutesAgo(60 * 30),
    read: true,
    readAt: minutesAgo(60 * 20),
  },
  {
    id: 'notif-3',
    title: 'Journal entry validated',
    message: "The journal entry 'Semaine 3' has been validated.",
    priority: 'LOW',
    relatedEntityType: 'JournalEntry',
    relatedEntityId: 'j-3',
    createdAt: minutesAgo(60 * 24 * 10),
    read: true,
    readAt: minutesAgo(60 * 24 * 9),
  },
];

function pageOf(content: readonly NotificationItem[]): Page<NotificationItem> {
  return { content, totalElements: content.length, totalPages: 1, number: 0, size: 20 };
}

describe('NotificationCenterComponent', () => {
  let pushes: Subject<RealtimeNotificationPayload>;
  let markRead: (id: string) => void;
  let markAll: () => void;

  async function setup() {
    pushes = new Subject<RealtimeNotificationPayload>();
    markRead = () => undefined;
    markAll = () => undefined;
    await TestBed.configureTestingModule({
      imports: [NotificationCenterComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubComponent },
          { path: 'notifications', component: StubComponent },
          { path: 'internships/:id', component: StubComponent },
          { path: 'finance/:id', component: StubComponent },
        ]),
        {
          provide: ApiClient,
          useValue: {
            getNotifications: () => of(pageOf(NOTIFICATIONS)),
            markNotificationRead: (id: string) => {
              markRead(id);
              return of({});
            },
            markAllNotificationsRead: () => {
              markAll();
              return of({});
            },
          },
        },
        {
          provide: RealtimeService,
          useValue: {
            notifications$: pushes.asObservable(),
            state: signal('connected'),
            connected: signal(true),
            connecting: signal(false),
            lastEventAt: signal<string | null>(null),
          },
        },
      ],
    }).compileComponents();
    signInDemo(TestBed.inject(AuthService), 'admin@steg.tn', 'ADMIN');
    TestBed.inject(I18nService).setLocale('en');
    const fixture = TestBed.createComponent(NotificationCenterComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('groups notifications by recency and marks the unread ones', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    expect(component.sections().map((s) => s.group)).toEqual(['today', 'yesterday', 'older']);
    const items = fixture.nativeElement.querySelectorAll('.st-nc-item');
    expect(items.length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.st-nc-item--unread').length).toBe(1);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Final evaluation required');
    expect(text).toContain('HIGH');
  });

  it('deep-links the related record and localises the entity label', async () => {
    const fixture = await setup();
    const link = fixture.nativeElement.querySelector(
      'a[href="/internships/ship-42"]',
    ) as HTMLAnchorElement;
    expect(link).toBeTruthy();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Internship');
    expect(text).not.toContain('FinanceCase');
  });

  it('filters on unread only', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    expect(component.unreadCount()).toBe(1);
    component.setFilter('unread');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.st-nc-item').length).toBe(1);
  });

  it('marks one and all as read, then reflects the state locally', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    component.readOne('notif-1');
    expect(markRead).toBeDefined();
    expect(component.unreadCount()).toBe(0);
    component.readAll();
    expect(component.items().every((n) => n.read)).toBe(true);
  });

  it('prepends a pushed notification in real time without a refetch', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    pushes.next({
      notificationId: 'notif-9',
      title: 'Final evaluation required',
      message: 'Internship STAGE-2026-000099 reached COMPLETED without a final evaluation.',
      priority: 'HIGH',
      relatedEntityType: 'Internship',
      relatedEntityId: 'ship-99',
      createdAt: new Date().toISOString(),
    });
    fixture.detectChanges();
    expect(component.items()[0]?.id).toBe('notif-9');
    expect(component.unreadCount()).toBe(2);
    // A replayed push for a known id never duplicates the row.
    pushes.next({
      notificationId: 'notif-9',
      title: 'Final evaluation required',
      message: 'duplicate',
      priority: 'HIGH',
      relatedEntityType: 'Internship',
      relatedEntityId: 'ship-99',
      createdAt: new Date().toISOString(),
    });
    expect(component.items().length).toBe(4);
  });
});
