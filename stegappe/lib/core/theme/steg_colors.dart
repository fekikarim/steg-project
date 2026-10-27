import 'package:flutter/material.dart';

/// STEG brand + semantic color tokens (UI_UX.md §2).
/// Never use raw hex in widgets — import these tokens.
abstract final class StegColors {
  static const Color brandPrimary = Color(0xFF0B61A0);
  static const Color brandPrimaryDark = Color(0xFF084E82);
  static const Color brandRed = Color(0xFFD32325);
  static const Color brandRedDark = Color(0xFFB02927);
  static const Color brandNavy = Color(0xFF042843);

  // Semantic status colors (always paired with text/icon, never color-only).
  static const Color info = Color(0xFF0B61A0);
  static const Color success = Color(0xFF1B7A3D);
  static const Color warning = Color(0xFF9A6200);
  static const Color error = Color(0xFFD32325);

  /// Lighter error tone for dark surfaces (contrast on the deep-navy theme).
  static const Color errorDark = Color(0xFFE56A6C);

  /// Success/warning on the deep-navy theme. `ux-ui.md` §1 requires a
  /// "success/warning-on-dark pair with verified contrast"; the light values
  /// measure 2.76:1 and 2.92:1 on `darkPage`, i.e. below the 4.5:1 body bar,
  /// so the pair is explicit here rather than reusing the light tokens
  /// (`test/ux/accessibility_test.dart` measures both).
  static const Color successDark = Color(0xFF4CC46E); // 7.84:1 on darkPage
  static const Color warningDark = Color(0xFFE0A64B); // 8.08:1 on darkPage

  // Light surfaces
  static const Color lightPage = Color(0xFFF4F6F9);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightElevated = Color(0xFFFFFFFF);
  static const Color lightBorder = Color(0xFFE2E8F0);
  static const Color lightTextPrimary = Color(0xFF0F2437);
  static const Color lightTextSecondary = Color(0xFF47617A);

  // Dark surfaces — deep navy, never pure black (UI_UX.md §3.2).
  static const Color darkPage = Color(0xFF0A1B2A);
  static const Color darkSurface = Color(0xFF10293F);
  static const Color darkElevated = Color(0xFF16334C);
  static const Color darkBorder = Color(0xFF26465F);
  static const Color darkTextPrimary = Color(0xFFF1F5F9);
  static const Color darkTextSecondary = Color(0xFFB7C9D8);

  static const Color primaryBright = Color(0xFF3E9BDC);

  // ── Modern gradient + surface tokens (2026 refresh) ──
  // Brand gradient used for heroes, primary buttons and avatars.
  static const List<Color> brandGradient = <Color>[
    Color(0xFF042843), // navy
    Color(0xFF0B61A0), // primary
    Color(0xFF3E9BDC), // bright
  ];

  static const List<Color> aiGradient = <Color>[
    Color(0xFF7C3AED),
    Color(0xFF3E9BDC),
  ];

  static const List<Color> successGradient = <Color>[
    Color(0xFF1B7A3D),
    Color(0xFF4CC46E),
  ];

  // ── Shared gradient stops (single source of truth) ──
  // Every screen gradient used to be spelled out inline; the stops live here
  // so splash, auth, heroes and app bars cannot drift apart.

  /// Full-screen brand hero: splash, login, forced-password change, crash
  /// fallback. Stops pair with [heroStops].
  static const List<Color> heroGradient = <Color>[
    brandNavy,
    Color(0xFF073858),
    brandPrimary,
  ];

  /// Stop positions for [heroGradient] (navy dominant, primary at the bottom).
  static const List<double> heroStops = <double>[0.0, 0.45, 1.0];

  /// Middle stop of the full-screen brand hero (navy → this → primary).
  static const Color heroMid = Color(0xFF073858);

  /// Lighter end of the two-stop brand ramp (primary → this).
  static const Color brandRampEnd = Color(0xFF1478C8);

  /// Diagonal hero used by header cards: light theme variant.
  static const List<Color> heroGradientDiagonalLight = <Color>[
    Color(0xFF042843),
    Color(0xFF0B61A0),
    Color(0xFF1478C8),
  ];

  /// Diagonal hero used by header cards: dark theme variant (lifted navy so the
  /// card still separates from `darkPage`).
  static const List<Color> heroGradientDiagonalDark = <Color>[
    Color(0xFF0A2540),
    Color(0xFF123A5E),
    Color(0xFF1B4E7E),
  ];

  /// Horizontal brand gradient used by app bars and solid brand buttons.
  static const List<Color> brandGradientWide = <Color>[brandNavy, brandPrimary];

  /// Secondary horizontal ramp (primary → lighter blue) for filled surfaces
  /// that must not disappear against the navy hero.
  static const List<Color> brandGradientRamp = <Color>[
    brandPrimary,
    Color(0xFF1478C8),
  ];

  /// Two-stop brand ramp for badges and medallions (primary → bright).
  static const List<Color> brandGradientBright = <Color>[
    brandPrimary,
    primaryBright,
  ];

  /// Dark-theme avatar ring (bright → AI violet) and its light counterpart.
  static const List<Color> avatarGradientDark = <Color>[
    primaryBright,
    Color(0xFF7C3AED),
  ];

  /// Connectivity banner fills. `online`/`offline` are the *only* two states
  /// the banner can show, so they get explicit tokens instead of reusing the
  /// flat semantic colours (the gradient needs a lighter partner).
  static const List<Color> connectivityOnlineGradient = <Color>[
    success,
    Color(0xFF2FA35C),
  ];

  static const List<Color> connectivityOfflineGradient = <Color>[
    warning,
    Color(0xFFD99A2B),
  ];

  /// Bright ramp for dark-mode filled controls (primaryBright → lighter).
  static const List<Color> brandGradientRampDark = <Color>[
    primaryBright,
    Color(0xFF6FBDEE),
  ];

  /// Destructive accent gradient (journal-generation call to action, error
  /// cards) — same red family as [brandRed], never a new colour.
  static const List<Color> dangerGradient = <Color>[
    brandRed,
    Color(0xFFFF6B6B),
  ];

  /// Community accent gradient (feed header, community cards).
  static const List<Color> communityGradient = <Color>[
    communityAccent,
    primaryBright,
  ];

  /// Soft brand shadow used behind the navy→bright button ramp (40 % primary).
  static const Color brandGlow = Color(0x400B61A0);

  // ── Presence + chat tokens ──
  /// Supervisor/student availability dot: online.
  static const Color presenceOnline = Color(0xFF23A55A);

  /// Supervisor/student availability dot: offline / unknown. Always paired with
  /// the textual status, never the only signal.
  static const Color presenceOffline = Color(0xFF80848E);

  /// Timestamps, ticks and meta text drawn on top of a brand-filled bubble.
  static const Color onBrandSubtle = Color(0xFF53BDEB);

  // ── Journal accent palette (day strip / calendar accents) ──
  static const Color journalViolet = Color(0xFF7C3AED);
  static const Color journalTeal = Color(0xFF0E7490);
  static const Color journalAmber = Color(0xFFC77700);
  static const Color journalEmerald = Color(0xFF1B7A3D);
  static const Color journalVioletDark = Color(0xFFA78BFA);
  static const Color journalTealDark = Color(0xFF4FB3C9);
  static const Color journalAmberDark = Color(0xFFFFB74D);
  static const Color journalEmeraldDark = Color(0xFF4CC46E);

  /// Neutral "empty track" behind journal/progress chips in dark mode.
  static const Color darkTrack = Color(0xFF0E2233);

  /// Neutral "empty track" behind journal/progress chips in light mode.
  static const Color lightTrack = Color(0xFFEDF1F5);

  /// Soft shadow colors — widgets reference these instead of raw black.
  static const Color shadowLight = Color(0x1A0F2437);
  static const Color shadowDark = Color(0x40000000);

  static List<BoxShadow> cardShadow(bool dark) => dark
      ? const [
          BoxShadow(color: shadowDark, blurRadius: 16, offset: Offset(0, 6)),
        ]
      : const [
          BoxShadow(
            color: Color(0x140F2437),
            blurRadius: 20,
            offset: Offset(0, 8),
          ),
          BoxShadow(
            color: Color(0x080B61A0),
            blurRadius: 40,
            offset: Offset(0, 16),
          ),
        ];

  static List<BoxShadow> buttonShadow = const [
    BoxShadow(color: brandGlow, blurRadius: 16, offset: Offset(0, 6)),
  ];

  // ── New tokens required by T00 (calendar / scheduling / AI / community) ──

  /// "Scheduled task" (visible only from a future date, D8). Indigo, kept
  /// clearly apart from the info blue and the AI violet.
  static const Color scheduledTask = Color(0xFF6D4CA8);
  static const Color scheduledTaskDark = Color(0xFF9B7FD4);

  /// "Awaiting approval" (student marked the task done, review pending, D6).
  /// Amber-orange, distinct from the `warning` token.
  static const Color awaitingApproval = Color(0xFFC77700);
  static const Color awaitingApprovalDark = Color(0xFFFFB74D);

  /// AI features accent (assistant, AI task generation / classification).
  static const Color aiAccent = Color(0xFF7C3AED);
  static const Color aiAccentDark = Color(0xFFA78BFA);

  /// Community feed accent (ST-COM-01).
  static const Color communityAccent = Color(0xFF0E7490);
  static const Color communityAccentDark = Color(0xFF4FB3C9);

  /// Calendar period palette (T12): six fills that (a) sit in the mid-tone band
  /// so they stay visible on both the light page (#F4F6F9) and the dark surface
  /// (#10293F) and (b) have pairwise-distinct greyscale luminance so the periods
  /// remain tellable apart without colour. Always paired with a label/icon — the
  /// palette is never the only signal (UX_UI.md §2.3).
  static const List<Color> calendarPalette = <Color>[
    Color(0xFF0E3A5C), // navy   (greyscale ≈ 49)
    Color(0xFF14708F), // teal   (greyscale ≈ 88)
    Color(0xFF458A3E), // green  (greyscale ≈ 109)
    Color(0xFFAE7E2E), // amber  (greyscale ≈ 131)
    Color(0xFFD88E3A), // orange (greyscale ≈ 155)
    Color(0xFFE0AD3C), // gold   (greyscale ≈ 175)
  ];

  /// Stable period → colour mapping. Wraps for more periods than palette
  /// entries so a long calendar never renders an index error.
  static Color calendarColorFor(int index) =>
      calendarPalette[index.abs() % calendarPalette.length];

  /// Perceived greyscale luminance (0–255) of a token — exposed so the token
  /// test can prove the calendar palette is greyscale-distinguishable.
  static double greyscaleLuminance(Color c) =>
      0.299 * (c.r * 255) + 0.587 * (c.g * 255) + 0.114 * (c.b * 255);
}
