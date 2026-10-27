import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/app_config.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/storage/token_storage.dart';
import '../../domain/entities/app_user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../../data/datasources/auth_remote_data_source.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../data/repositories/token_refresh_coordinator.dart';
import 'session_refresher.dart';

final tokenStorageProvider = Provider<TokenStorage>(
  (ref) => SecureTokenStorage(),
);

/// Renews sessions, once at a time, for the whole app.
///
/// Lives above the HTTP client so a 401 anywhere in the app can reach it.
final tokenRefreshCoordinatorProvider = Provider<TokenRefreshCoordinator>(
  (ref) => TokenRefreshCoordinator(
    repository: ref.watch(authRepositoryProvider),
    tokens: ref.watch(tokenStorageProvider),
  ),
);

/// Central HTTP client.
///
/// The 401 → refresh → replay path is wired HERE, on the client, because that
/// is the only place that can see every request. Leaving it unwired is what
/// made the app fall off a cliff once the access token expired: nothing
/// renewed it, so the next call 401'd and the user had to sign in again.
///
/// [authRepositoryProvider] is read lazily (inside the callback) so the
/// provider graph stays acyclic.
final Provider<ApiClient> apiClientProvider = Provider<ApiClient>((ref) {
  var base = AppConfig.apiBaseUrl;
  if (base.isEmpty && kDebugMode) {
    base = defaultTargetPlatform == TargetPlatform.android
        ? 'http://10.0.2.2:8080'
        : 'http://localhost:8080';
  }
  return ApiClient(
    baseUrl: base,
    onUnauthorized: () async {
      final coordinator = ref.read(tokenRefreshCoordinatorProvider);
      return coordinator.tokenForRetry();
    },
    onPasswordChangeRequired: () {
      ref.read(authControllerProvider.notifier).requirePasswordChange();
    },
  );
});

final authRemoteDataSourceProvider = Provider<AuthRemoteDataSource>(
  (ref) => AuthRemoteDataSource(ref.watch(apiClientProvider)),
);

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepositoryImpl(
    remote: ref.watch(authRemoteDataSourceProvider),
    tokens: ref.watch(tokenStorageProvider),
  ),
);

/// Auth UI state machine.
sealed class AuthState {
  const AuthState();
}

class AuthInitial extends AuthState {
  const AuthInitial();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthAuthenticated extends AuthState {
  const AuthAuthenticated(this.user);
  final AppUser user;
}

class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated({this.message});
  final String? message;
}

final authControllerProvider = StateNotifierProvider<AuthController, AuthState>(
  (ref) => AuthController(
    ref.watch(authRepositoryProvider),
    ref.watch(sessionRefresherProvider),
  ),
);

class AuthController extends StateNotifier<AuthState> {
  AuthController(AuthRepository repo, [this._refresher])
    : _repo = repo,
      super(const AuthInitial());

  final AuthRepository _repo;

  /// Keeps the access token fresh for the whole session. Optional so tests
  /// (and any caller that does not want background renewal) can omit it.
  final SessionRefresher? _refresher;

  ApiException? lastError;

  Future<void> bootstrap() async {
    state = const AuthLoading();
    try {
      final user = await _repo.restoreSession();
      state = user == null
          ? const AuthUnauthenticated()
          : AuthAuthenticated(user);
      if (user != null) _scheduleRefresh();
    } on ApiException catch (e) {
      lastError = e;
      state = AuthUnauthenticated(message: e.message);
    }
  }

  Future<bool> login({required String email, required String password}) async {
    state = const AuthLoading();
    try {
      final user = await _repo.login(email: email, password: password);
      state = AuthAuthenticated(user);
      _scheduleRefresh();
      return true;
    } on ApiException catch (e) {
      lastError = e;
      state = AuthUnauthenticated(message: e.message);
      return false;
    }
  }

  /// Arms the proactive renewal from the token's real remaining lifetime.
  void _scheduleRefresh() {
    final refresher = _refresher;
    if (refresher == null) return;
    unawaited(refresher.schedule());
  }

  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final current = state;
    if (current is! AuthAuthenticated) return false;
    try {
      await _repo.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
      );
      final restored = await _repo.restoreSession();
      if (restored != null) {
        state = AuthAuthenticated(restored);
      } else {
        state = AuthAuthenticated(
          AppUser(
            id: current.user.id,
            email: current.user.email,
            roles: current.user.roles,
            mustChangePassword: false,
          ),
        );
      }
      return true;
    } on ApiException catch (e) {
      lastError = e;
      return false;
    }
  }

  Future<void> logout() async {
    _refresher?.cancel();
    await _repo.logout();
    state = const AuthUnauthenticated();
  }

  /// T06 §10: sign out after an auth failure during a background flush.
  /// Carries a stable code (not a raw backend string); the login screen
  /// maps it to a localized notice, anything else renders raw as before.
  void signOutExpired() {
    state = const AuthUnauthenticated(message: 'queue-auth-discarded');
  }

  void requirePasswordChange() {
    final current = state;
    if (current is AuthAuthenticated) {
      state = AuthAuthenticated(
        AppUser(
          id: current.user.id,
          email: current.user.email,
          roles: current.user.roles,
          mustChangePassword: true,
        ),
      );
    }
  }
}
