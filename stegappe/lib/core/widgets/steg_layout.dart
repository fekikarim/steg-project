import 'package:flutter/material.dart';

import '../theme/steg_spacing.dart';

/// Adaptive layout helpers — the shared answer to "what does this screen look
/// like on a narrow phone, a large phone, a tablet and a desktop window?".
///
/// Rules encoded here (mirroring the responsive-layout skill):
///  * respond to the **available width**, never to a device name;
///  * on large windows, cap the readable width and centre it instead of letting
///    cards stretch edge to edge;
///  * keep the content order identical at every width — only the framing and
///    column count change.
abstract final class StegBreakpoints {
  /// Narrow phone (≤ 380 dp): single column, compact paddings.
  static bool isCompact(double width) => width < StegSpacing.compactWidth;

  /// Typical phone (≤ 600 dp).
  static bool isPhone(double width) => width < StegSpacing.mediumWidth;

  /// Tablet / large window (≥ 900 dp): rail navigation territory.
  static bool isExpanded(double width) => width >= StegSpacing.expandedWidth;

  /// Number of equal-width columns that fit comfortably at [width].
  ///
  /// 1 column on phones, 2 on small tablets, 3 on wide windows — derived from a
  /// comfortable card width, not from the device.
  static int columnsFor(double width, {double minTile = 220}) {
    if (width < StegSpacing.mediumWidth) return 1;
    final usable = width - StegSpacing.md * 2;
    final count = (usable / minTile).floor();
    return count.clamp(1, 3);
  }
}

/// Padding that shrinks on narrow phones and grows on tablets.
EdgeInsetsGeometry stegAdaptivePadding(
  double width, {
  EdgeInsetsGeometry? base,
}) {
  final fallback = base ?? StegSpacing.screenPadding;
  if (StegBreakpoints.isCompact(width)) {
    return const EdgeInsets.symmetric(
      horizontal: StegSpacing.sm,
      vertical: StegSpacing.md,
    );
  }
  return fallback;
}

/// Centres a bounded column of content, so a phone layout stays readable on a
/// tablet or a desktop browser window instead of stretching to 1400 px.
///
/// Pass [maxWidth] explicitly when the screen has a stricter reading measure
/// (`StegSpacing.maxReadingWidth`, `StegSpacing.maxFormWidth`).
class StegContentFrame extends StatelessWidget {
  const StegContentFrame({
    super.key,
    required this.child,
    this.maxWidth = StegSpacing.maxDashboardWidth,
    this.padding,
    this.alignment = AlignmentDirectional.topCenter,
  });

  final Widget child;
  final double maxWidth;

  /// Applied *inside* the width cap, so it never fights the outer padding.
  final EdgeInsetsGeometry? padding;
  final AlignmentGeometry alignment;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final content = padding == null
            ? child
            : Padding(padding: padding!, child: child);
        if (width <= maxWidth) return content;
        return Align(
          alignment: alignment,
          child: SizedBox(
            width: maxWidth,
            // `stretch` height keeps scrollables filling the viewport.
            height: constraints.hasBoundedHeight ? constraints.maxHeight : null,
            child: content,
          ),
        );
      },
    );
  }
}
