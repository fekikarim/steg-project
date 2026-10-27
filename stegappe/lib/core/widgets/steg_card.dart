import 'package:flutter/material.dart';

import '../theme/steg_colors.dart';
import '../theme/steg_spacing.dart';

/// Grouping card with title, optional action, consistent padding.
///
/// Modern finish: large radius, colored shadow, soft border.
/// Never fixed height — grows with content + text scaling (UI_UX.md §9.5).
class StegCard extends StatelessWidget {
  const StegCard({
    super.key,
    this.title,
    this.action,
    this.icon,
    required this.child,
    this.semanticsLabel,
    this.accent = false,
  });

  final String? title;
  final Widget? action;
  final IconData? icon;
  final Widget child;
  final String? semanticsLabel;

  /// Renders a subtle brand-tinted surface for hero/featured cards.
  final bool accent;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final scheme = Theme.of(context).colorScheme;
    final bg = accent
        ? Color.alphaBlend(
            scheme.primary.withValues(alpha: dark ? 0.14 : 0.06),
            dark ? StegColors.darkSurface : StegColors.lightSurface,
          )
        : (dark ? StegColors.darkSurface : StegColors.lightSurface);

    final card = DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
        border: Border.all(
          color: dark ? StegColors.darkBorder : StegColors.lightBorder,
          width: 1,
        ),
        boxShadow: dark
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.28),
                  blurRadius: 18,
                  offset: const Offset(0, 6),
                ),
              ]
            : [
                BoxShadow(
                  color: StegColors.brandNavy.withValues(alpha: 0.07),
                  blurRadius: 20,
                  offset: const Offset(0, 6),
                ),
                BoxShadow(
                  color: StegColors.brandPrimary.withValues(alpha: 0.05),
                  blurRadius: 40,
                  offset: const Offset(0, 14),
                ),
              ],
      ),
      child: Material(
        color: bg,
        borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
        clipBehavior: Clip.antiAlias,
        child: Padding(
          padding: const EdgeInsets.all(StegSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (title case final t?) ...[
                LayoutBuilder(
                  builder: (context, constraints) => Row(
                    children: [
                      if (icon != null) ...[
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                scheme.primary.withValues(alpha: 0.18),
                                scheme.tertiary.withValues(alpha: 0.12),
                              ],
                              begin: AlignmentDirectional.topStart,
                              end: AlignmentDirectional.bottomEnd,
                            ),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(icon, size: 15, color: scheme.primary),
                        ),
                        const SizedBox(width: StegSpacing.xs),
                      ],
                      Expanded(
                        child: Text(
                          t,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                letterSpacing: -0.2,
                                fontWeight: FontWeight.w800,
                                fontSize: 15,
                              ),
                        ),
                      ),
                      if (action case final Widget a)
                        ConstrainedBox(
                          constraints: BoxConstraints(
                            maxWidth: constraints.maxWidth * 0.45,
                          ),
                          child: SizedBox(
                            height: StegSpacing.minTouchTarget,
                            child: a,
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: StegSpacing.sm),
              ],
              child,
            ],
          ),
        ),
      ),
    );

    final String? label = semanticsLabel ?? title;
    if (label == null) return card;
    return Semantics(
      container: true,
      header: title != null,
      label: label,
      child: card,
    );
  }
}
