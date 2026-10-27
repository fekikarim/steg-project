import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { AuthService } from './auth.service';
import { signInDemo } from './testing/demo-session';
import { RealtimeService } from './realtime.service';
import { TopbarComponent } from '../shell/topbar.component';

/**
 * Pre-check (c) — socket-drop recovery.
 *
 * `@stomp/stompjs` is replaced by a fake Client that records every constructor
 * option and every subscription, so a drop/reconnect cycle can be driven
 * deterministically without a network: the fake never opens a socket, the test
 * invokes `onWebSocketClose` / `onConnect` exactly like the real client would.
 *
 * Proves three things AGENTS.md §8.1 requires:
 *  1. after a drop the service backs off exponentially (1s → 2s → 4s …);
 *  2. the STOMP session re-subscribes every destination on reconnect
 *     (nothing silently stays unsubscribed);
 *  3. `reconnected$` fires only on RE-connect (not first connect) and the
 *     topbar refreshes the unread count so the badge cannot stay stale.
 */
const stomp = vi.hoisted(() => {
  type ClientOptions = {
    webSocketFactory?: () => unknown;
    connectHeaders?: Record<string, string>;
    heartbeatIncoming?: number;
    heartbeatOutgoing?: number;
    reconnectDelay?: number;
    debug?: (message: string) => void;
    onConnect?: () => void;
    onStompError?: (frame: { headers: Record<string, string> }) => void;
    onWebSocketClose?: (event: { code?: number }) => void;
    onWebSocketError?: (event: unknown) => void;
    onDisconnect?: () => void;
  };

  class FakeStompClient {
    static readonly instances: FakeStompClient[] = [];
    options: ClientOptions;
    reconnectDelay: number;
    active = false;
    /** Destinations passed to subscribe(), in call order (reconnects append). */
    subscribed: string[] = [];

    constructor(options: ClientOptions) {
      this.options = options;
      this.reconnectDelay = options.reconnectDelay ?? 0;
      FakeStompClient.instances.push(this);
    }

    activate(): void {
      this.active = true;
    }

    deactivate(): void {
      this.active = false;
    }

    subscribe(destination: string, _handler: (message: unknown) => void): { unsubscribe(): void } {
      this.subscribed.push(destination);
      return { unsubscribe: () => undefined };
    }

    publish(_message: unknown): void {
      /* heartbeat — no network in tests */
    }
  }

  return { FakeStompClient, instances: FakeStompClient.instances };
});

vi.mock('@stomp/stompjs', () => ({
  Client: stomp.FakeStompClient,
  // Type-only imports at runtime if the transform keeps the bindings.
  IMessage: class {},
  StompSubscription: class {},
}));

const BASE = 'http://localhost:8080';
const UNREAD_URL = `${BASE}/api/notifications/unread-count`;

function notificationsSubs(client: { subscribed: string[] }): number {
  return client.subscribed.filter((d) => d === '/user/queue/notifications').length;
}

/** The single client RealtimeService activates in this test (strict TS-safe). */
function clientAt(index: number): (typeof stomp.instances)[number] {
  const client = stomp.instances[index];
  if (!client) throw new Error(`no fake stomp client at index ${index}`);
  return client;
}

describe('pre-check (c) — realtime reconnect', () => {
  let auth: AuthService;
  let realtime: RealtimeService;
  let http: HttpTestingController;

  beforeEach(() => {
    stomp.instances.length = 0;
    vi.spyOn(Math, 'random').mockReturnValue(0); // deterministic jitter = 0
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    signInDemo(auth, 'admin@steg.tn', 'ADMIN');
    realtime = TestBed.inject(RealtimeService);
    http = TestBed.inject(HttpTestingController);
    // Flush the auth effect: connect() with the demo token.
    TestBed.tick();
  });

  afterEach(() => {
    realtime.disconnect();
    http.verify();
    vi.restoreAllMocks();
  });

  it('a socket drop backs off exponentially and the session re-subscribes on reconnect', () => {
    expect(stomp.instances).toHaveLength(1);
    const client = clientAt(0);
    expect(client.active).toBe(true);
    expect(client.reconnectDelay).toBe(1000); // computeReconnectDelay(0, 0)

    let reconnected = 0;
    const sub = realtime.reconnected$.subscribe(() => reconnected++);

    // First (successful) connect: destinations subscribed once, no reconnected$.
    client.options.onConnect?.();
    expect(realtime.state()).toBe('connected');
    expect(notificationsSubs(client)).toBe(1);
    expect(reconnected).toBe(0);

    // Socket drop (plain network loss, token still live) → backoff grows.
    client.options.onWebSocketClose?.({ code: 1006 });
    expect(realtime.state()).toBe('disconnected');
    expect(client.reconnectDelay).toBe(2000); // attempts = 1

    // Second failed attempt with no successful connect between → doubles again.
    client.options.onWebSocketClose?.({ code: 1006 });
    expect(client.reconnectDelay).toBe(4000); // attempts = 2

    // Auto-reconnect succeeds: everything re-subscribed, signal fires once.
    client.options.onConnect?.();
    expect(realtime.state()).toBe('connected');
    expect(notificationsSubs(client)).toBe(2);
    expect(client.subscribed).toContain('/topic/backoffice/applications');
    expect(reconnected).toBe(1);

    sub.unsubscribe();
  });

  it('the topbar refreshes the unread count after a reconnect', () => {
    const fixture = TestBed.createComponent(TopbarComponent);
    fixture.detectChanges();

    // Initial badge load.
    http.expectOne(UNREAD_URL).flush({ unreadCount: 3 });
    expect(fixture.componentInstance.unread).toBe(3);

    const client = clientAt(0);

    // First connect does NOT refetch (nothing was missed yet).
    client.options.onConnect?.();
    expect(http.match(UNREAD_URL)).toHaveLength(0);

    // Drop → reconnect: the badge may have gone stale while offline.
    client.options.onWebSocketClose?.({ code: 1006 });
    client.options.onConnect?.();

    http.expectOne(UNREAD_URL).flush({ unreadCount: 5 });
    expect(fixture.componentInstance.unread).toBe(5);

    fixture.destroy();
  });
});
