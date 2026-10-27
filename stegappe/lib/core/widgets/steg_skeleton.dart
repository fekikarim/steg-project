import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../theme/steg_colors.dart';
import '../theme/steg_motion.dart';
import '../theme/steg_spacing.dart';

/// Skeleton loading primitives.
///
/// The UI/UX direction (`ux-ui.md` §5) is explicit: lists and cards load with
/// **skeletons shaped like the real content**, and the centred `StegLoading`
/// spinner is the fallback for screens that have no stable shape. Everything
/// here follows that rule.
///
/// Implementation notes:
///  * one [AnimationController] per [StegSkeleton] group — the sweep is shared
///    by every child box through an `InheritedWidget`, so a 6-row skeleton runs
///    a single ticker instead of six;
///  * the sweep is a gradient transform only (no blur, no shader, no extra
///    opacity layer), which keeps it cheap on low-end devices;
///  * reduced motion (`MediaQuery.disableAnimations`) renders the same shapes
///    **static**, and the group is announced once to screen readers
///    ("loading", a live region) rather than once per box;
///  * the composite skeletons are built on `SingleChildScrollView`, *not* on
///    `ListView`: they must survive three very different parents —
///    `Scaffold.body`, `Expanded`, and `SliverFillRemaining(hasScrollBody:
///    false)` (which queries intrinsic dimensions and would abort on a lazy
///    viewport). `SingleChildScrollView` supports both bounded layout and
///    intrinsics, so one shape works in all three.
class StegSkeleton extends StatefulWidget {
  const StegSkeleton({super.key, required this.child});

  final Widget child;

  @override
  State<StegSkeleton> createState() => _StegSkeletonState();
}

class _StegSkeletonState extends State<StegSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: StegMotion.shimmer,
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Decided here (not in initState) because it reads MediaQuery.
    final reduceMotion = StegMotion.reduceMotion(context);
    if (reduceMotion) {
      _controller.stop();
      _controller.value = 0.5;
    } else if (!_controller.isAnimating) {
      _controller.repeat();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      excludeSemantics: true,
      label: AppLocalizations.of(context).loading,
      child: _SkeletonScope(controller: _controller, child: widget.child),
    );
  }
}

class _SkeletonScope extends InheritedWidget {
  const _SkeletonScope({required this.controller, required super.child});

  final AnimationController controller;

  static AnimationController? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<_SkeletonScope>()?.controller;

  @override
  bool updateShouldNotify(_SkeletonScope oldWidget) =>
      oldWidget.controller != controller;
}

/// A single shimmering placeholder block.
///
/// Renders statically when there is no enclosing [StegSkeleton] (so a stray box
/// can never crash or hang a test), which also makes it safe to use inside
/// widgets that are pumped without the group.
class StegSkeletonBox extends StatelessWidget {
  const StegSkeletonBox({
    super.key,
    this.width,
    this.height = 14,
    this.radius = StegSpacing.radiusSm,
  });

  /// `null` stretches to the parent width.
  final double? width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final base = dark ? StegColors.darkElevated : StegColors.lightTrack;
    final highlight = dark
        ? StegColors.darkBorder
        : Color.alphaBlend(
            StegColors.lightSurface.withValues(alpha: 0.9),
            base,
          );
    final controller = _SkeletonScope.maybeOf(context);

    Widget block(double sweep) => SizedBox(
      width: width,
      height: height,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(radius),
          gradient: LinearGradient(
            colors: [base, highlight, base],
            stops: const [0.1, 0.5, 0.9],
            begin: Alignment(-3 + 4 * sweep, -1),
            end: Alignment(-1 + 4 * sweep, 1),
          ),
        ),
      ),
    );

    // Without a group the box renders a static placeholder: a stray box can
    // never spin its own ticker or hang a widget test.
    if (controller == null) return block(0.5);
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) => block(controller.value),
    );
  }
}

/// Non-scrolling container shared by every composite skeleton.
Widget _skeletonColumn({
  required EdgeInsetsGeometry padding,
  required List<Widget> children,
}) {
  return SingleChildScrollView(
    // A placeholder must never steal the drag from the real list's
    // pull-to-refresh, and must never scroll on its own.
    physics: const NeverScrollableScrollPhysics(),
    padding: padding,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: children,
    ),
  );
}

/// List-shaped skeleton: medallion + two text lines, repeated.
class StegSkeletonList extends StatelessWidget {
  const StegSkeletonList({
    super.key,
    this.rows = 4,
    this.showLeading = true,
    this.padding = StegSpacing.screenPadding,
  });

  final int rows;
  final bool showLeading;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return StegSkeleton(
      child: _skeletonColumn(
        padding: padding,
        children: [
          for (var i = 0; i < rows; i++) ...[
            if (i > 0) const SizedBox(height: StegSpacing.sm),
            StegSkeletonCardRow(
              showLeading: showLeading,
              // Width variation reads as content instead of a table.
              titleWidthFactor: i.isEven ? 0.55 : 0.4,
            ),
          ],
        ],
      ),
    );
  }
}

/// One card-shaped row: optional medallion, a title line, a subtitle line and
/// an optional trailing chip.
class StegSkeletonCardRow extends StatelessWidget {
  const StegSkeletonCardRow({
    super.key,
    this.showLeading = true,
    this.trailingWidth = 46,
    this.titleWidthFactor = 0.5,
  });

  final bool showLeading;
  final double? trailingWidth;
  final double titleWidthFactor;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(StegSpacing.md),
      decoration: BoxDecoration(
        color: dark ? StegColors.darkSurface : StegColors.lightSurface,
        borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
        border: Border.all(
          color: dark ? StegColors.darkBorder : StegColors.lightBorder,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (showLeading) ...[
            const StegSkeletonBox(width: 44, height: 44, radius: 14),
            const SizedBox(width: StegSpacing.sm),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                FractionallySizedBox(
                  alignment: AlignmentDirectional.centerStart,
                  widthFactor: titleWidthFactor,
                  child: const StegSkeletonBox(height: 14),
                ),
                const SizedBox(height: StegSpacing.xs),
                const StegSkeletonBox(height: 11),
                const SizedBox(height: StegSpacing.xs),
                FractionallySizedBox(
                  alignment: AlignmentDirectional.centerStart,
                  widthFactor: 0.72,
                  child: const StegSkeletonBox(height: 11),
                ),
              ],
            ),
          ),
          if (trailingWidth != null) ...[
            const SizedBox(width: StegSpacing.sm),
            StegSkeletonBox(
              width: trailingWidth,
              height: 22,
              radius: StegSpacing.radiusFull,
            ),
          ],
        ],
      ),
    );
  }
}

/// Card-grid skeleton (feed posts, intern cards, evaluations).
class StegSkeletonCards extends StatelessWidget {
  const StegSkeletonCards({
    super.key,
    this.count = 3,
    this.lines = 3,
    this.showHeader = true,
    this.padding = StegSpacing.screenPadding,
  });

  final int count;
  final int lines;
  final bool showHeader;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return StegSkeleton(
      child: _skeletonColumn(
        padding: padding,
        children: [
          for (var i = 0; i < count; i++) ...[
            if (i > 0) const SizedBox(height: StegSpacing.sm),
            Container(
              padding: const EdgeInsets.all(StegSpacing.md),
              decoration: BoxDecoration(
                color: dark ? StegColors.darkSurface : StegColors.lightSurface,
                borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
                border: Border.all(
                  color: dark ? StegColors.darkBorder : StegColors.lightBorder,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (showHeader) ...[
                    const Row(
                      children: [
                        StegSkeletonBox(
                          width: 36,
                          height: 36,
                          radius: StegSpacing.radiusFull,
                        ),
                        SizedBox(width: StegSpacing.sm),
                        Expanded(child: StegSkeletonBox(height: 12)),
                        SizedBox(width: StegSpacing.sm),
                        StegSkeletonBox(width: 42, height: 12),
                      ],
                    ),
                    const SizedBox(height: StegSpacing.md),
                  ],
                  for (var line = 0; line < lines; line++) ...[
                    if (line > 0) const SizedBox(height: StegSpacing.xs),
                    FractionallySizedBox(
                      alignment: AlignmentDirectional.centerStart,
                      widthFactor: line == lines - 1 ? 0.6 : 1,
                      child: const StegSkeletonBox(height: 13),
                    ),
                  ],
                  const SizedBox(height: StegSpacing.md),
                  const Row(
                    children: [
                      StegSkeletonBox(width: 64, height: 12),
                      SizedBox(width: StegSpacing.sm),
                      StegSkeletonBox(width: 64, height: 12),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Dashboard skeleton: hero header + a row of stat tiles + a short list. Used by
/// both role home screens so the first paint already shows the real structure.
class StegSkeletonDashboard extends StatelessWidget {
  const StegSkeletonDashboard({super.key, this.statCount = 4, this.rows = 2});

  final int statCount;
  final int rows;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return StegSkeleton(
      child: _skeletonColumn(
        padding: StegSpacing.screenPadding,
        children: [
          const StegSkeletonBox(height: 96, radius: StegSpacing.radiusLg),
          const SizedBox(height: StegSpacing.lg),
          const Align(
            alignment: AlignmentDirectional.centerStart,
            child: StegSkeletonBox(width: 140, height: 14),
          ),
          const SizedBox(height: StegSpacing.sm),
          Row(
            children: [
              for (var i = 0; i < statCount; i++) ...[
                if (i > 0) const SizedBox(width: StegSpacing.sm),
                const Expanded(
                  child: StegSkeletonBox(
                    height: 92,
                    radius: StegSpacing.radiusMd,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: StegSpacing.lg),
          const Align(
            alignment: AlignmentDirectional.centerStart,
            child: StegSkeletonBox(width: 160, height: 14),
          ),
          const SizedBox(height: StegSpacing.sm),
          for (var i = 0; i < rows; i++) ...[
            if (i > 0) const SizedBox(height: StegSpacing.sm),
            Container(
              padding: const EdgeInsets.all(StegSpacing.md),
              decoration: BoxDecoration(
                color: dark ? StegColors.darkSurface : StegColors.lightSurface,
                borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
                border: Border.all(
                  color: dark ? StegColors.darkBorder : StegColors.lightBorder,
                ),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  StegSkeletonBox(height: 13),
                  SizedBox(height: StegSpacing.xs),
                  StegSkeletonBox(height: 11),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Detail-page skeleton: title, meta rows and a paragraph block.
class StegSkeletonDetail extends StatelessWidget {
  const StegSkeletonDetail({super.key, this.paragraphs = 2});

  final int paragraphs;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return StegSkeleton(
      child: _skeletonColumn(
        padding: StegSpacing.screenPadding,
        children: [
          Container(
            padding: const EdgeInsets.all(StegSpacing.md),
            decoration: BoxDecoration(
              color: dark ? StegColors.darkSurface : StegColors.lightSurface,
              borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
              border: Border.all(
                color: dark ? StegColors.darkBorder : StegColors.lightBorder,
              ),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                StegSkeletonBox(width: 180, height: 18),
                SizedBox(height: StegSpacing.sm),
                StegSkeletonBox(height: 12),
                SizedBox(height: StegSpacing.xs),
                StegSkeletonBox(width: 220, height: 12),
              ],
            ),
          ),
          const SizedBox(height: StegSpacing.lg),
          for (var p = 0; p < paragraphs; p++) ...[
            if (p > 0) const SizedBox(height: StegSpacing.md),
            const StegSkeletonBox(height: 12),
            const SizedBox(height: StegSpacing.xs),
            const StegSkeletonBox(height: 12),
            const SizedBox(height: StegSpacing.xs),
            const Align(
              alignment: AlignmentDirectional.centerStart,
              child: StegSkeletonBox(width: 200, height: 12),
            ),
          ],
        ],
      ),
    );
  }
}
