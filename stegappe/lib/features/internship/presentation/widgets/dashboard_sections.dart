import 'package:flutter/material.dart';

import '../../../../core/l10n/app_localizations.dart';
import '../../../../core/theme/steg_colors.dart';
import '../../../../core/theme/steg_motion.dart';
import '../../../../core/theme/steg_spacing.dart';
import '../../../../core/widgets/steg_card.dart';

/// Offline stale-data notice: honest labeling, never silent.
///
/// Modern finish: tinted rounded strip with icon medallion.
class StaleNotice extends StatelessWidget {
  const StaleNotice({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final dark = Theme.of(context).brightness == Brightness.dark;
    final fg = dark ? StegColors.warningDark : StegColors.warning;
    return Semantics(
      liveRegion: true,
      excludeSemantics: true,
      label: l10n.staleData,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(
          horizontal: StegSpacing.md,
          vertical: StegSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: fg.withValues(alpha: dark ? 0.14 : 0.08),
          borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
          border: Border.all(color: fg.withValues(alpha: 0.35)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    fg.withValues(alpha: 0.3),
                    fg.withValues(alpha: 0.18),
                  ],
                  begin: AlignmentDirectional.topStart,
                  end: AlignmentDirectional.bottomEnd,
                ),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.cloud_off_outlined, size: 15, color: fg),
            ),
            const SizedBox(width: StegSpacing.sm),
            Expanded(
              child: Text(
                l10n.staleData,
                style: Theme.of(context).textTheme.bodySmall
                    ?.copyWith(fontWeight: FontWeight.w700, color: fg),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Dashboard section: titled card with optional action + content.
class DashboardSection extends StatelessWidget {
  const DashboardSection({
    super.key,
    required this.title,
    this.action,
    this.actionLabel,
    this.onAction,
    this.icon,
    required this.child,
  }) : assert(
         (actionLabel == null) == (onAction == null),
         'actionLabel and onAction go together',
       );

  final String title;
  final Widget? action;
  final String? actionLabel;
  final VoidCallback? onAction;
  final IconData? icon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return StegCard(
      title: title,
      icon: icon,
      action:
          action ??
          (actionLabel != null
              ? TextButton(
                  onPressed: onAction,
                  style: TextButton.styleFrom(
                    minimumSize: const Size(
                      StegSpacing.minTouchTarget,
                      StegSpacing.minTouchTarget,
                    ),
                    foregroundColor: Theme.of(context).colorScheme.primary,
                  ),
                  child: Text(
                    actionLabel!,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                )
              : null),
      child: child,
    );
  }
}

/// Linear progress with gradient track, semantic label (never color-only).
class LabeledProgress extends StatelessWidget {
  const LabeledProgress({
    super.key,
    required this.label,
    required this.fraction,
    required this.counter,
    this.gradient,
  });

  final String label;
  final double fraction;
  final String counter;
  final List<Color>? gradient;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final grad = gradient ?? StegColors.brandGradientBright;
    final clamped = fraction.clamp(0.0, 1.0);

    return Semantics(
      label: '$label: $counter',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                label,
                style: Theme.of(context).textTheme.bodyMedium
                    ?.copyWith(fontWeight: FontWeight.w600, fontSize: 13),
              ),
              // Counter is a technical value: keep LTR in RTL layouts.
              Directionality(
                textDirection: TextDirection.ltr,
                child: Text(
                  counter,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: Theme.of(context).colorScheme.primary,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: StegSpacing.xs),
          // Gradient progress track
          Container(
            height: 10,
            decoration: BoxDecoration(
              color: dark ? StegColors.darkTrack : StegColors.lightTrack,
              borderRadius: BorderRadius.circular(StegSpacing.radiusFull),
            ),
            child: LayoutBuilder(
              builder: (context, constraints) => Stack(
                children: [
                  // Track fill
                  AnimatedContainer(
                    duration: StegMotion.fast,
                    curve: StegMotion.standard,
                    width: constraints.maxWidth * clamped,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: grad,
                        begin: AlignmentDirectional.centerStart,
                        end: AlignmentDirectional.centerEnd,
                      ),
                      borderRadius: BorderRadius.circular(
                        StegSpacing.radiusFull,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: grad.first.withValues(alpha: 0.4),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
