import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/repositories/token_refresh_coordinator.dart';
import 'auth_providers.dart';

/// Renews the session on a timer, BEFORE the access token expires.
///
/// The reactive 401 → refresh path is what makes the app *correct*; this is
/// what makes it *invisible*. Without it the user meets an expired token at
/// least once per window and sees a spinner, a failed request, or an error
/// screen that reads like a bug. Renewing at 80 % of the lifetime means the
/// token is always valid when a request goes out.
///
/// The schedule is self-correcting: one timer, re-armed from the real TTL
/// after every attempt, so a slow or failed refresh can never leave the app
/// permanently unscheduled.
class SessionRefresher {
  SessionRefresher({required this.coordinator});

  /// Public so the timing can be unit-tested without a real clock.
  final TokenRefreshCoordinator coordinator;

  Timer? _timer;
  bool _disposed = false;

  /// Renew once the remaining lifetime drops below this fraction.
  static const double renewAtFraction = 0.8;

  /// Floor so a nearly-dead token is not left to the reactive path.
  static const Duration minLead = Duration(seconds: 30);

  /// (Re)arms the timer from the token's real remaining lifetime.
  ///
  /// Never throws: this runs unattended in the background, and a storage
  /// failure (unavailable keystore, corrupted entry) must leave the reactive
  /// 401 path in charge rather than crash the app or wedge a timer.
  Future<void> schedule() async {
    _timer?.cancel();
    final Duration? remaining;
    try {
      remaining = await coordinator.timeToLive();
    } on Object {
      return;
    }
    if (_disposed || remaining == null) return;

    final target = targetDelay(remaining);
    if (target <= Duration.zero) {
      unawaited(_refreshNow());
      return;
    }
    _timer = Timer(target, () => unawaited(_refreshNow()));
  }

  /// Pure, so the arithmetic is testable on its own.
  @visibleForTesting
  static Duration targetDelay(Duration remaining) {
    var lead = Duration(
      milliseconds: (remaining.inMilliseconds * renewAtFraction).round(),
    );
    if (lead < minLead) lead = minLead;
    final delay = remaining - lead;
    return delay.isNegative ? Duration.zero : delay;
  }

  Future<void> _refreshNow() async {
    if (_disposed) return;
    try {
      await coordinator.refresh();
    } on Object {
      // Swallowed on purpose: see [schedule].
    }
    // Re-arm regardless of the outcome: a transient failure must not leave the
    // app without a scheduler for the rest of the session.
    await schedule();
  }

  void cancel() => _timer?.cancel();

  void dispose() {
    _disposed = true;
    _timer?.cancel();
  }
}

final sessionRefresherProvider = Provider<SessionRefresher>((ref) {
  final refresher = SessionRefresher(
    coordinator: ref.watch(tokenRefreshCoordinatorProvider),
  );
  ref.onDispose(refresher.dispose);
  return refresher;
});
