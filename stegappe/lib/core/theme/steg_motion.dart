import 'package:flutter/material.dart';

/// Motion tokens (UI_UX.md §6): short, purposeful transitions only.
///
/// Screens must use these instead of literal durations so the whole app stays
/// consistent and so reduced-motion handling lives in one place:
/// `MediaQuery.disableAnimations` is honoured by [resolve] and by the widgets
/// that read it (the shell switcher, dialogs, list transitions).
abstract final class StegMotion {
  /// Micro feedback: pressed states, chip selection.
  static const Duration instant = Duration(milliseconds: 100);

  /// Default UI transition (cards appearing, banners, snackbars).
  static const Duration fast = Duration(milliseconds: 150);

  /// Shell tab switch and medium content transitions.
  static const Duration shell = Duration(milliseconds: 180);

  /// Upper bound for an in-page transition (never longer than 250 ms).
  static const Duration medium = Duration(milliseconds: 250);

  /// Indeterminate **loading** loop (the skeleton shimmer).
  ///
  /// Deliberately longer than [medium]: this is not a transition that gates
  /// content, it is a continuous progress signal, and a loop under ~1 s reads
  /// as flicker rather than as "working". The presentation ceiling in
  /// `ux-ui.md` §6 and its guard (`test/ux/performance_probe_test.dart`,
  /// "no presentation animation literal exceeds 250 ms") therefore exempt this
  /// single token **by name**; every transition token above stays capped, and
  /// the shimmer collapses to a static frame under reduce motion.
  static const Duration shimmer = Duration(milliseconds: 1250);

  static const Curve standard = Curves.easeOut;
  static const Curve emphasized = Curves.easeInOutCubic;

  /// Returns [duration] unless the user asked the platform to reduce motion,
  /// in which case animations collapse to zero. Callers keep the widget swap,
  /// they only skip the animation.
  static Duration resolve(BuildContext context, Duration duration) =>
      MediaQuery.of(context).disableAnimations ? Duration.zero : duration;

  /// Whether the platform asked for reduced motion.
  static bool reduceMotion(BuildContext context) =>
      MediaQuery.of(context).disableAnimations;
}
