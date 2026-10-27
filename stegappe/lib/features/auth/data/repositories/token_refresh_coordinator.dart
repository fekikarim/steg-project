import 'dart:async';
import 'dart:convert';

import '../../../../core/network/api_exception.dart';
import '../../../../core/storage/token_storage.dart';
import '../../domain/repositories/auth_repository.dart';

/// Renews an expiring session exactly once, no matter how many callers ask.
///
/// The app fires several requests at once on most screens. Without
/// coordination each 401 would start its own refresh, and since the backend
/// ROTATES refresh tokens, the losers would be told their token had been
/// reused — which looks precisely like "your session expired" and logged the
/// user out after a couple of minutes. Sharing one in-flight future collapses
/// that whole class of failure.
class TokenRefreshCoordinator {
  TokenRefreshCoordinator({required this.repository, required this.tokens});

  final AuthRepository repository;

  /// Where the issued pair is read back from. Public so tests can supply an
  /// in-memory store; production always uses secure storage.
  final TokenStorage tokens;

  /// The single refresh currently running, shared by every caller.
  Future<bool>? _inFlight;

  /// True once the server told us the refresh session is genuinely gone.
  /// Only then is it legitimate to sign the user out.
  bool _sessionDead = false;

  bool get sessionDead => _sessionDead;

  /// Called when renewal is impossible for good, so the app can show the
  /// signed-out state. Not fired for transient failures.
  void Function()? onSessionExpired;

  /// Safe to call from anywhere: concurrent calls join the running refresh
  /// instead of starting their own.
  Future<bool> refresh() {
    final running = _inFlight;
    if (running != null) return running;
    final future = _doRefresh().whenComplete(() => _inFlight = null);
    _inFlight = future;
    return future;
  }

  Future<bool> _doRefresh() async {
    try {
      final ok = await repository.refreshSession();
      if (ok) {
        _sessionDead = false;
        return true;
      }
      // refreshSession() only returns false after the server refused the
      // refresh token itself, which IS a real end of session.
      _sessionDead = true;
      onSessionExpired?.call();
      return false;
    } on Object {
      // A transport error, a timeout or a 5xx says nothing about the session.
      // Signing out here is exactly the "random logout" this class exists to
      // prevent, so the tokens are left untouched.
      return false;
    }
  }

  /// Used by the 401 hook: returns the fresh bearer, or null when the session
  /// is genuinely over.
  Future<String?> tokenForRetry() async {
    final ok = await refresh();
    if (!ok) return null;
    // refreshSession() persisted the new pair; read it back so the replay
    // carries exactly what the server just issued, never a stale copy.
    try {
      final token = await tokens.readAccessToken();
      return (token == null || token.isEmpty) ? null : token;
    } on Object {
      return null;
    }
  }

  /// Time left on the stored access token, or null when unknown.
  ///
  /// Read from the token's own `exp` claim — no server round-trip, so it is
  /// cheap enough to consult whenever the session is (re)armed.
  Future<Duration?> timeToLive() async {
    final String? token;
    try {
      token = await tokens.readAccessToken();
    } on Object {
      return null; // storage unavailable: no proactive renewal, no crash
    }
    if (token == null || token.isEmpty) return null;
    final exp = _expiryClaim(token);
    if (exp == null) return null;
    final left = exp.difference(DateTime.now());
    return left.isNegative ? Duration.zero : left;
  }

  static DateTime? _expiryClaim(String jwt) {
    final parts = jwt.split('.');
    if (parts.length < 2) return null;
    try {
      var payload = parts[1].replaceAll('-', '+').replaceAll('_', '/');
      while (payload.length % 4 != 0) {
        payload = payload.padRight(payload.length + 1, '=');
      }
      final decoded = utf8.decode(base64.decode(payload));
      final json = jsonDecode(decoded);
      if (json is Map && json['exp'] is num) {
        return DateTime.fromMillisecondsSinceEpoch(
          (json['exp'] as num).toInt() * 1000,
        );
      }
    } on Object {
      return null;
    }
    return null;
  }

  void reset() {
    _inFlight = null;
    _sessionDead = false;
  }
}

/// True when a refresh failure is a definitive "your session is over".
///
/// Only the server saying so counts. A timeout, a socket error, a 5xx or the
/// 409 that concurrent rotation can produce are all transient: the refresh
/// token is still good, and destroying it would sign the user out for a
/// network hiccup.
bool isTerminalRefreshFailure(Object error) {
  if (error is! ApiException) return false;
  // `kind` is the client's normalised signal and is authoritative here; the
  // raw status code is only a fallback. An UNKNOWN kind (no statusCode at all)
  // still means the credential was rejected.
  if (error.kind == ApiErrorKind.unauthorized) return true;
  if (error.statusCode == 401) return true;
  // 422 is only terminal when the server named the refresh token as the
  // reason; a 422 about anything else (a validation rule) is not a session
  // problem.
  if (error.statusCode == 422) {
    final code = (error.code ?? '').toUpperCase();
    return code.contains('REFRESH_TOKEN') ||
        error.message.toUpperCase().contains('REFRESH_TOKEN');
  }
  return false;
}
