import 'dart:math';

import 'package:flutter/material.dart';

import '../../../../core/l10n/app_localizations.dart';
import '../../../../core/theme/steg_spacing.dart';
import '../../../../core/widgets/steg_modern.dart';
import '../../../auth/domain/entities/app_user.dart';
import '../../../auth/presentation/role_label.dart';
import '../../domain/greeting.dart';

/// First display token of a full name or email (T13 greeting personalizes
/// with it; never sent anywhere, display only).
String homeFirstName(String displayName) {
  final token = displayName.trim().split(RegExp(r'\s+')).firstOrNull ?? '';
  if (token.isEmpty) return '';
  final local = token.split('@').first;
  if (local.isEmpty) return '';
  return local[0].toUpperCase() + (local.length > 1 ? local.substring(1) : '');
}

String greetingFor(AppLocalizations l10n, String displayName, DateTime now) {
  final name = homeFirstName(displayName);
  return switch (greetingBand(now)) {
    DayBand.morning => l10n.homeGreetMorning(name),
    DayBand.afternoon => l10n.homeGreetAfternoon(name),
    DayBand.evening => l10n.homeGreetEvening(name),
    DayBand.night => l10n.homeGreetNight(name),
  };
}

/// Home identity header (T13 ST-HOME-03/04, SU-HOME-04): time-of-day
/// greeting (device clock, display only — BR-53), initials avatar and the
/// localized role label. Shared by both shells.
///
/// Design language: the gradient hero is the screen's single bold moment —
/// everything below it rests on quiet tinted surfaces.
class HomeHeader extends StatelessWidget {
  const HomeHeader({
    super.key,
    required this.displayName,
    required this.role,
    this.now,
    this.trailing,
  });

  final String displayName;
  final UserRole role;
  final DateTime? now;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return StegGradientHeader(
      title: greetingFor(l10n, displayName, now ?? DateTime.now()),
      subtitle: roleLabel(l10n, role),
      displayName: displayName,
      trailing: trailing,
    );
  }
}

/// One tappable quick action (48px target, labelled for screen readers).
class QuickAction {
  const QuickAction({
    required this.icon,
    required this.label,
    required this.onTap,
    this.gradient,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  /// Accent palette for the tile. Rendered *softly* — a faint tinted surface
  /// and a quiet icon medallion — never as a solid gradient square.
  final List<Color>? gradient;
}

/// Four-or-fewer action grid (T13 UX: no more than 4 without "more").
///
/// Design language: soft tinted tiles (the action colour at ~7% over the
/// surface) with a quiet medallion, so four actions read as one calm band
/// instead of four competing mini-buttons. Colour still codes each action.
class QuickActionsGrid extends StatelessWidget {
  const QuickActionsGrid({super.key, required this.actions});

  final List<QuickAction> actions;

  /// Cell height = vertical padding + medallion + gap + the lines the
  /// *longest* label actually needs at this width and text scale.
  ///
  /// The lines are measured with the exact style the label renders with, so
  /// the grid never reserves a second line a one-line label leaves empty —
  /// that reservation used to leave a dead band of background between the
  /// quick actions and the sections around them, and it never clips a long
  /// French/Arabic label either.
  double _cellExtent(BuildContext context, double cellWidth) {
    final style = Theme.of(context)
        .textTheme
        .bodySmall
        ?.copyWith(fontWeight: FontWeight.w700, fontSize: 11.5);
    final scaler = MediaQuery.textScalerOf(context);
    final lineHeight =
        scaler.scale(style?.fontSize ?? 11.5) * (style?.height ?? 1.5);
    final maxLabelWidth = cellWidth - StegSpacing.xs * 2;
    final direction = Directionality.of(context);
    var lines = 1;
    for (final action in actions) {
      final painter = TextPainter(
        text: TextSpan(text: action.label, style: style),
        textDirection: direction,
        textScaler: scaler,
        maxLines: 2,
      )..layout(maxWidth: maxLabelWidth);
      lines = max(lines, painter.computeLineMetrics().length);
      painter.dispose();
    }
    // The tile centres its content, so the grid can never be taller than
    // what it paints; the +1 is rounding slack.
    return StegSpacing.sm * 2 + _medallion + _medallionGap +
        lineHeight * lines + 1;
  }

  static const double _medallion = 40;
  static const double _medallionGap = 8;

  /// One accent per action; the tile renders it as tint + icon, the deep
  /// tone on light surfaces and the bright tone on dark ones.
  static const _defaultGradients = <List<Color>>[
    [Color(0xFF0B61A0), Color(0xFF3E9BDC)],
    [Color(0xFF7C3AED), Color(0xFFA78BFA)],
    [Color(0xFF0E7490), Color(0xFF4FB3C9)],
    [Color(0xFF1B7A3D), Color(0xFF4CC46E)],
  ];

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Semantics(
      header: true,
      label: l10n.homeQuickActions,
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          StegSectionHeader(
              title: l10n.homeQuickActions,
              icon: Icons.bolt_rounded),
          const SizedBox(height: StegSpacing.xs),
          // The cell height follows the real labels, so the grid is always
          // exactly as tall as its tiles — no reserved band above or below.
          LayoutBuilder(builder: (context, constraints) {
            final cellWidth =
                (constraints.maxWidth - StegSpacing.sm * 3) / 4;
            return GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 4,
                mainAxisSpacing: StegSpacing.sm,
                crossAxisSpacing: StegSpacing.sm,
                mainAxisExtent: _cellExtent(context, cellWidth),
              ),
              itemCount: actions.length,
              itemBuilder: (context, i) {
                final a = actions[i];
                final palette = a.gradient ??
                    _defaultGradients[i % _defaultGradients.length];
                // On dark surfaces the deep brand tones disappear, so the
                // tile speaks with the palette's bright tone instead.
                final accent = dark ? palette.last : palette.first;
                // The tile *is* the grid cell: it fills the reserved height
                // and centres its content.
                return SizedBox.expand(
                  child: Semantics(
                    button: true,
                    label: a.label,
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: a.onTap,
                        borderRadius:
                            BorderRadius.circular(StegSpacing.radiusMd),
                        child: Container(
                          decoration: BoxDecoration(
                            color: accent.withValues(alpha: dark ? 0.10 : 0.07),
                            borderRadius:
                                BorderRadius.circular(StegSpacing.radiusMd),
                          ),
                          padding: const EdgeInsets.symmetric(
                            vertical: StegSpacing.sm,
                            horizontal: StegSpacing.xs,
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(
                                width: _medallion,
                                height: _medallion,
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [
                                      accent.withValues(alpha: dark ? 0.30 : 0.16),
                                      accent.withValues(alpha: dark ? 0.18 : 0.09),
                                    ],
                                    begin: AlignmentDirectional.topStart,
                                    end: AlignmentDirectional.bottomEnd,
                                  ),
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: Icon(
                                  a.icon,
                                  size: 20,
                                  color: accent,
                                ),
                              ),
                              const SizedBox(height: _medallionGap),
                              Text(
                                a.label,
                                textAlign: TextAlign.center,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context)
                                    .textTheme
                                    .bodySmall
                                    ?.copyWith(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 11.5,
                                    ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              },
            );
          }),
        ],
      ),
    );
  }
}
