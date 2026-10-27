import 'package:flutter/material.dart';

/// Spacing / radius / touch-target scale (UI_UX.md §4–5).
/// Touch targets must be >= 44x44 logical px (we use 48 for comfort).
abstract final class StegSpacing {
  static const double xxs = 4;
  static const double xs = 8;
  static const double sm = 12;
  static const double md = 16;
  static const double lg = 20;
  static const double xl = 24;
  static const double xxl = 32;

  static const double radiusSm = 12;
  static const double radiusMd = 18;
  static const double radiusLg = 24;
  static const double radiusXl = 32;
  static const double radiusFull = 999;

  static const double minTouchTarget = 48;

  static const EdgeInsets screenPadding = EdgeInsets.symmetric(
    horizontal: md,
    vertical: md,
  );
  static const EdgeInsets cardPadding = EdgeInsets.all(md);

  // ── Adaptive layout scale ──
  // Widths are *available space*, not device names (see the responsive skill).

  /// Below this the layout is a narrow phone: single column, no side-by-side
  /// controls, compact paddings.
  static const double compactWidth = 380;

  /// Typical phone ceiling — the default comfort zone.
  static const double mediumWidth = 600;

  /// Tablet / large window: content is centred and capped instead of stretched.
  static const double expandedWidth = 900;

  /// Maximum reading width for text-heavy screens (journal, articles).
  static const double maxReadingWidth = 720;

  /// Maximum width for a single-column form (auth, editors).
  static const double maxFormWidth = 480;

  /// Maximum width for a dashboard/grid body on large windows.
  static const double maxDashboardWidth = 1080;
}
