import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:stegappe/core/network/api_client.dart';
import 'package:stegappe/core/network/api_exception.dart';
import 'package:stegappe/core/storage/token_storage.dart';
import 'package:stegappe/features/auth/data/repositories/token_refresh_coordinator.dart';
import 'package:stegappe/features/auth/domain/entities/app_user.dart';
import 'package:stegappe/features/auth/domain/repositories/auth_repository.dart';
import 'package:stegappe/features/auth/presentation/providers/session_refresher.dart';

/// In-memory token store.
class _Tokens implements TokenStorage {
  String? access;
  String? refresh;
  bool failReads = false;

  @override
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    bool mustChangePassword = false,
  }) async {
    access = accessToken;
    refresh = refreshToken;
  }

  @override
  Future<bool> readMustChangePassword() async => false;
  @override
  Future<String?> readAccessToken() async {
    if (failReads) throw StateError('keystore unavailable');
    return access;
  }

  @override
  Future<String?> readRefreshToken() async => refresh;
  @override
  Future<void> clear() async {
    access = null;
    refresh = null;
  }
}

class _Repo implements AuthRepository {
  _Repo(this.tokens);

  final _Tokens tokens;
  int refreshCalls = 0;
  bool refreshOk = true;
  Object? refreshError;
  int issued = 0;

  @override
  Future<bool> refreshSession() async {
    refreshCalls++;
    if (refreshError != null) throw refreshError!;
    if (!refreshOk) {
      await tokens.clear();
      return false;
    }
    issued++;
    await tokens.saveTokens(
      accessToken: _jwt('access-$issued', ttl: const Duration(minutes: 15)),
      refreshToken: 'refresh-$issued',
    );
    return true;
  }

  @override
  Future<AppUser> login({required String email, required String password}) =>
      throw UnimplementedError();
  @override
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {}
  @override
  Future<void> logout() async => tokens.clear();
  @override
  Future<AppUser?> restoreSession() async => null;
}

/// Minimal unsigned JWT with the given expiry, enough for TTL maths.
String _jwt(String tag, {Duration ttl = const Duration(minutes: 15)}) {
  String seg(Map<String, dynamic> m) =>
      base64Url.encode(utf8.encode(jsonEncode(m))).replaceAll('=', '');
  final exp = DateTime.now().add(ttl).millisecondsSinceEpoch ~/ 1000;
  return '${seg({'alg': 'none'})}.${seg({'sub': tag, 'exp': exp})}.sig';
}

void main() {
  group('S1 — token refresh coordinator', () {
    test(
      'concurrent callers share ONE refresh (rotation race impossible)',
      () async {
        final tokens = _Tokens()..access = _jwt('old');
        final repo = _Repo(tokens);
        final coordinator = TokenRefreshCoordinator(
          repository: repo,
          tokens: tokens,
        );

        final results = await Future.wait([
          coordinator.refresh(),
          coordinator.refresh(),
          coordinator.refresh(),
          coordinator.refresh(),
          coordinator.refresh(),
        ]);

        expect(results, everyElement(isTrue));
        // Five callers, ONE network refresh: the backend never sees a race.
        expect(repo.refreshCalls, 1);
      },
    );

    test('a later call refreshes again once the first finished', () async {
      final tokens = _Tokens()..access = _jwt('old');
      final repo = _Repo(tokens);
      final coordinator = TokenRefreshCoordinator(
        repository: repo,
        tokens: tokens,
      );

      await coordinator.refresh();
      await coordinator.refresh();
      expect(repo.refreshCalls, 2);
    });

    test('a transient failure keeps the session alive', () async {
      final tokens = _Tokens()..access = _jwt('old');
      final repo = _Repo(tokens)
        ..refreshError = const ApiException(
          kind: ApiErrorKind.network,
          message: 'connection reset',
        );
      final coordinator = TokenRefreshCoordinator(
        repository: repo,
        tokens: tokens,
      );

      final ok = await coordinator.refresh();

      expect(ok, isFalse, reason: 'the renewal did not succeed');
      // Crucially: no logout, and the tokens survive for the next attempt.
      expect(coordinator.sessionDead, isFalse);
      expect(tokens.access, isNotNull);
      expect(tokens.refresh, isNull); // nothing was stored by a failed refresh
    });

    test('a server-refused refresh is terminal and reports it', () async {
      final tokens = _Tokens()
        ..access = _jwt('old')
        ..refresh = 'r1';
      final repo = _Repo(tokens)..refreshOk = false;
      var expired = 0;
      final coordinator = TokenRefreshCoordinator(
        repository: repo,
        tokens: tokens,
      )..onSessionExpired = () => expired++;

      expect(await coordinator.refresh(), isFalse);
      expect(coordinator.sessionDead, isTrue);
      expect(expired, 1, reason: 'the app must be able to show signed-out');
      expect(tokens.access, isNull);
    });

    test('tokenForRetry returns the freshly issued token', () async {
      final tokens = _Tokens()..access = _jwt('old');
      final repo = _Repo(tokens);
      final coordinator = TokenRefreshCoordinator(
        repository: repo,
        tokens: tokens,
      );

      final retry = await coordinator.tokenForRetry();

      expect(retry, tokens.access);
      expect(retry, isNot(contains('old')));
    });

    test('tokenForRetry is null when the session is really over', () async {
      final tokens = _Tokens()..access = _jwt('old');
      final repo = _Repo(tokens)..refreshOk = false;
      final coordinator = TokenRefreshCoordinator(
        repository: repo,
        tokens: tokens,
      );

      expect(await coordinator.tokenForRetry(), isNull);
    });

    test('a broken keystore degrades instead of crashing', () async {
      final tokens = _Tokens()..failReads = true;
      final repo = _Repo(tokens);
      final coordinator = TokenRefreshCoordinator(
        repository: repo,
        tokens: tokens,
      );

      expect(await coordinator.timeToLive(), isNull);
      expect(await coordinator.tokenForRetry(), isNull);
    });

    test('timeToLive is derived from the token exp claim', () async {
      final tokens = _Tokens()
        ..access = _jwt('soon', ttl: const Duration(minutes: 10));
      final coordinator = TokenRefreshCoordinator(
        repository: _Repo(tokens),
        tokens: tokens,
      );

      final ttl = await coordinator.timeToLive();
      expect(ttl, isNotNull);
      expect(ttl!.inMinutes, inInclusiveRange(9, 10));
    });
  });

  group('S1 — terminal vs transient refresh failures', () {
    test('401 and a refresh-token 422 are terminal', () {
      expect(
        isTerminalRefreshFailure(
          const ApiException(
            kind: ApiErrorKind.unauthorized,
            statusCode: 401,
            message: 'expired',
          ),
        ),
        isTrue,
      );
      expect(
        isTerminalRefreshFailure(
          const ApiException(
            kind: ApiErrorKind.validation,
            statusCode: 422,
            code: 'INVALID_REFRESH_TOKEN',
            message: 'invalid refresh token',
          ),
        ),
        isTrue,
      );
    });

    test('an unauthorized kind with no status code is still terminal', () {
      expect(
        isTerminalRefreshFailure(
          const ApiException(
            kind: ApiErrorKind.unauthorized,
            message: 'expired',
          ),
        ),
        isTrue,
      );
    });

    test('network, timeout, 5xx and 409 are NOT terminal', () {
      for (final failure in [
        const ApiException(kind: ApiErrorKind.network, message: 'offline'),
        const ApiException(
          kind: ApiErrorKind.unknown,
          statusCode: 500,
          message: 'boom',
        ),
        const ApiException(
          kind: ApiErrorKind.server,
          statusCode: 409,
          message: 'conflict',
        ),
        const ApiException(
          kind: ApiErrorKind.server,
          statusCode: 503,
          message: 'down',
        ),
      ]) {
        expect(
          isTerminalRefreshFailure(failure),
          isFalse,
          reason: 'must not log the user out: $failure',
        );
      }
    });

    test('a 422 about something else is not terminal', () {
      expect(
        isTerminalRefreshFailure(
          const ApiException(
            kind: ApiErrorKind.validation,
            statusCode: 422,
            code: 'POST_TOO_LONG',
            message: 'too long',
          ),
        ),
        isFalse,
      );
    });
  });

  group('S1 — proactive renewal schedule', () {
    test('renews before the token expires', () {
      // A 15-minute token renews with 20 % of its life left = ~3 min before.
      final delay = SessionRefresher.targetDelay(const Duration(minutes: 15));
      expect(delay.inMinutes, 3);
    });

    test('a nearly-dead token is renewed immediately', () {
      expect(
        SessionRefresher.targetDelay(const Duration(seconds: 5)),
        Duration.zero,
      );
    });

    test('never schedules in the past', () {
      expect(SessionRefresher.targetDelay(Duration.zero), Duration.zero);
    });
  });

  group('S1 — ApiClient replays a request after refreshing', () {
    /// Answers 401 until the bearer changes, then 200 — exactly what the real
    /// backend does once the session is renewed.
    test(
      'a 401 is refreshed and the SAME request replayed with the new token',
      () async {
        final tokens = _Tokens()..access = 'stale';
        final repo = _Repo(tokens);
        var refreshCalls = 0;
        final client = ApiClient(
          baseUrl: 'http://api.test',
          // Behaves like the real backend: the stale bearer is refused, the
          // freshly issued one is accepted.
          httpClient: MockClient((request) async {
            final auth = request.headers['Authorization'];
            if (auth != null && auth != 'Bearer stale') {
              return http.Response(
                '{"ok":true}',
                200,
                headers: {'content-type': 'application/json'},
              );
            }
            return http.Response(
              '{}',
              401,
              headers: {'content-type': 'application/json'},
            );
          }),
          onUnauthorized: () async {
            refreshCalls++;
            await repo.refreshSession();
            return tokens.access;
          },
        );

        final result = await client.get<Map<String, dynamic>>(
          '/protected',
          bearer: tokens.access,
          decode: (json) => (json as Map).cast<String, dynamic>(),
        );

        expect(refreshCalls, 1, reason: 'refresh happens exactly once');
        expect(repo.refreshCalls, 1, reason: 'not one refresh per request');
        expect(
          result['ok'],
          isTrue,
          reason: 'the replay carried the new token',
        );
      },
    );

    test('a second call also succeeds (the session keeps working)', () async {
      final tokens = _Tokens()..access = 'stale';
      final repo = _Repo(tokens);
      final client = ApiClient(
        baseUrl: 'http://api.test',
        httpClient: MockClient((request) async {
          final auth = request.headers['Authorization'];
          if (auth != null && auth != 'Bearer stale') {
            return http.Response(
              '{"ok":true}',
              200,
              headers: {'content-type': 'application/json'},
            );
          }
          return http.Response(
            '{}',
            401,
            headers: {'content-type': 'application/json'},
          );
        }),
        onUnauthorized: () async {
          await repo.refreshSession();
          return tokens.access;
        },
      );

      for (var i = 0; i < 3; i++) {
        final result = await client.get<Map<String, dynamic>>(
          '/protected',
          bearer: tokens.access,
          decode: (json) => (json as Map).cast<String, dynamic>(),
        );
        expect(result['ok'], isTrue);
      }
      // Three calls across two tokens: two refreshes at most, never a loop.
      expect(repo.refreshCalls, lessThanOrEqualTo(2));
    });

    test(
      'when renewal is impossible the 401 surfaces (no infinite retry)',
      () async {
        var calls = 0;
        final client = ApiClient(
          baseUrl: 'http://api.test',
          httpClient: MockClient((request) async {
            calls++;
            return http.Response(
              '{}',
              401,
              headers: {'content-type': 'application/json'},
            );
          }),
          onUnauthorized: () async => null,
        );

        await expectLater(
          client.get<Map<String, dynamic>>(
            '/protected',
            bearer: 'stale',
            decode: (json) => (json as Map).cast<String, dynamic>(),
          ),
          throwsA(
            isA<ApiException>().having(
              (e) => e.kind,
              'kind',
              ApiErrorKind.unauthorized,
            ),
          ),
        );
        // Exactly one attempt: the client never spins on a dead session.
        expect(calls, 1);
      },
    );

    test('a live token is never refreshed (no needless rotation)', () async {
      var calls = 0;
      var refreshCalls = 0;
      final client = ApiClient(
        baseUrl: 'http://api.test',
        httpClient: MockClient((request) async {
          calls++;
          return http.Response(
            '{"ok":true}',
            200,
            headers: {'content-type': 'application/json'},
          );
        }),
        onUnauthorized: () async {
          refreshCalls++;
          return 'x';
        },
      );

      await client.get<Map<String, dynamic>>(
        '/protected',
        bearer: 'valid',
        decode: (json) => (json as Map).cast<String, dynamic>(),
      );

      expect(calls, 1);
      expect(refreshCalls, 0);
    });
  });
}
