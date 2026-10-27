import 'dart:ui';

import 'package:flutter/material.dart';

import '../theme/steg_colors.dart';
import '../theme/steg_spacing.dart';
import 'user_avatar.dart';

/// Modern shared surfaces used by every screen.
///
/// [StegGradientHeader]: tall immersive hero with gradient + orbs.
/// [StegSectionHeader]: eyebrow title with optional action.
/// [StegMenuTile]: settings row with gradient icon medallion.
/// [StegStatTile]: KPI mini-card with gradient icon.
/// [StegGlassCard]: frosted-glass surface card.
/// [StegGlassBarInset]: reserved space for the shell's transparent top bar.

// ─────────────────────────────────────────────────────────────────────────────
// Gradient Hero Header
// ─────────────────────────────────────────────────────────────────────────────

class StegGradientHeader extends StatelessWidget {
  const StegGradientHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.displayName,
    this.avatarRadius = 26,
    this.chips,
    this.trailing,
    this.onAvatarTap,
  });

  final String title;
  final String? subtitle;
  final String? displayName;
  final double avatarRadius;
  final List<Widget>? chips;
  final Widget? trailing;
  final VoidCallback? onAvatarTap;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Semantics(
      header: true,
      label: title,
      excludeSemantics: true,
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: dark
                ? [
                    const Color(0xFF0A2540),
                    const Color(0xFF0F3558),
                    const Color(0xFF1A4E7A),
                  ]
                : [
                    StegColors.brandNavy,
                    const Color(0xFF0A3660),
                    StegColors.brandPrimary,
                  ],
            begin: AlignmentDirectional.topStart,
            end: AlignmentDirectional.bottomEnd,
          ),
          borderRadius: BorderRadius.circular(StegSpacing.radiusXl),
          boxShadow: [
            BoxShadow(
              color: StegColors.brandNavy.withValues(alpha: dark ? 0.5 : 0.4),
              blurRadius: 28,
              offset: const Offset(0, 10),
            ),
            BoxShadow(
              color: StegColors.brandPrimary.withValues(alpha: 0.15),
              blurRadius: 50,
              offset: const Offset(0, 20),
            ),
          ],
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            // Decorative orb — top end
            PositionedDirectional(
              top: -50,
              end: -50,
              child: Container(
                width: 200,
                height: 200,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.06),
                ),
              ),
            ),
            // Decorative orb — bottom start
            PositionedDirectional(
              bottom: -70,
              start: -40,
              child: Container(
                width: 220,
                height: 220,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: StegColors.primaryBright.withValues(alpha: 0.08),
                ),
              ),
            ),
            // Decorative ring — center end
            PositionedDirectional(
              top: 10,
              end: 20,
              child: Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.08),
                    width: 1,
                  ),
                ),
              ),
            ),
            // Content
            Padding(
              padding: const EdgeInsets.all(StegSpacing.lg),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  if (displayName != null) ...[
                    GestureDetector(
                      onTap: onAvatarTap,
                      child: Container(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: const LinearGradient(
                            colors: StegColors.brandGradientBright,
                            begin: AlignmentDirectional.topStart,
                            end: AlignmentDirectional.bottomEnd,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: StegColors.primaryBright
                                  .withValues(alpha: 0.5),
                              blurRadius: 14,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        padding: const EdgeInsets.all(2.5),
                        child: UserAvatar(
                          displayName: displayName!,
                          radius: avatarRadius,
                          ring: false,
                        ),
                      ),
                    ),
                    const SizedBox(width: StegSpacing.md),
                  ],
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.5,
                            height: 1.2,
                          ),
                        ),
                        if (subtitle != null) ...[
                          const SizedBox(height: 5),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(
                                StegSpacing.radiusFull,
                              ),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.2),
                                width: 0.5,
                              ),
                            ),
                            child: Text(
                              subtitle!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.9),
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.2,
                              ),
                            ),
                          ),
                        ],
                        if (chips != null && chips!.isNotEmpty) ...[
                          const SizedBox(height: StegSpacing.sm),
                          Wrap(
                            spacing: StegSpacing.xs,
                            runSpacing: StegSpacing.xs,
                            children: chips!,
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (trailing != null) ...[
                    const SizedBox(width: StegSpacing.sm),
                    trailing!,
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Header
// ─────────────────────────────────────────────────────────────────────────────

class StegSectionHeader extends StatelessWidget {
  const StegSectionHeader({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
    this.action,
    this.icon,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;
  final Widget? action;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (icon != null) ...[
          Container(
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Theme.of(context)
                      .colorScheme
                      .primary
                      .withValues(alpha: 0.18),
                  Theme.of(context)
                      .colorScheme
                      .tertiary
                      .withValues(alpha: 0.12),
                ],
                begin: AlignmentDirectional.topStart,
                end: AlignmentDirectional.bottomEnd,
              ),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              icon,
              size: 15,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
          const SizedBox(width: StegSpacing.xs),
        ],
        Expanded(
          child: Text(
            title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontSize: 15,
                  letterSpacing: -0.2,
                  fontWeight: FontWeight.w800,
                ),
          ),
        ),
        if (action != null)
          ConstrainedBox(
            constraints: const BoxConstraints(
              minHeight: StegSpacing.minTouchTarget,
              minWidth: StegSpacing.minTouchTarget,
            ),
            child: action!,
          )
        else if (actionLabel != null)
          TextButton(
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
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.1,
              ),
            ),
          ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu Tile — settings row
// ─────────────────────────────────────────────────────────────────────────────

class StegMenuTile extends StatelessWidget {
  const StegMenuTile({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
    this.trailing,
    this.gradient,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final Widget? trailing;
  final List<Color>? gradient;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final grad = gradient ??
        (dark
            ? [
                StegColors.primaryBright.withValues(alpha: 0.28),
                StegColors.aiAccentDark.withValues(alpha: 0.28),
              ]
            : StegColors.brandGradientBright);

    return Material(
      color: Colors.transparent,
      child: ListTile(
        onTap: onTap,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: StegSpacing.xs,
          vertical: 2,
        ),
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: grad,
              begin: AlignmentDirectional.topStart,
              end: AlignmentDirectional.bottomEnd,
            ),
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                color: (gradient?.first ?? StegColors.brandPrimary)
                    .withValues(alpha: 0.25),
                blurRadius: 8,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Icon(
            icon,
            size: 21,
            color: Colors.white,
          ),
        ),
        title: Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                fontWeight: FontWeight.w700,
                fontSize: 15,
              ),
        ),
        subtitle: subtitle == null
            ? null
            : Text(
                subtitle!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall,
              ),
        trailing: trailing ??
            Icon(
              Icons.arrow_forward_ios_rounded,
              size: 14,
              color: Theme.of(context)
                  .colorScheme
                  .onSurfaceVariant
                  .withValues(alpha: 0.45),
            ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat Tile — KPI mini-card
// ─────────────────────────────────────────────────────────────────────────────

class StegStatTile extends StatelessWidget {
  const StegStatTile({
    super.key,
    required this.icon,
    required this.value,
    required this.label,
    this.gradient,
    this.onTap,
  });

  final IconData icon;
  final String value;
  final String label;
  final List<Color>? gradient;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final grad = gradient ?? StegColors.brandGradient;

    final card = Container(
      padding: const EdgeInsets.all(StegSpacing.md),
      decoration: BoxDecoration(
        color: dark ? StegColors.darkSurface : Colors.white,
        borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
        border: Border.all(
          color: dark ? StegColors.darkBorder : StegColors.lightBorder,
        ),
        boxShadow: dark
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.3),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ]
            : [
                BoxShadow(
                  color: (grad.first).withValues(alpha: 0.18),
                  blurRadius: 24,
                  offset: const Offset(0, 8),
                ),
                BoxShadow(
                  color: StegColors.shadowLight,
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: grad,
                begin: AlignmentDirectional.topStart,
                end: AlignmentDirectional.bottomEnd,
              ),
              borderRadius: BorderRadius.circular(13),
              boxShadow: [
                BoxShadow(
                  color: grad.first.withValues(alpha: 0.45),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Icon(icon, color: Colors.white, size: 20),
          ),
          const SizedBox(height: StegSpacing.sm),
          Text(
            value,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w900,
                  fontSize: 28,
                  letterSpacing: -0.5,
                ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );

    if (onTap == null) return card;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
        child: card,
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Glass App Bar (for secondary screens that still need a back button)
// ─────────────────────────────────────────────────────────────────────────────

class StegGradientAppBar extends StatelessWidget implements PreferredSizeWidget {
  const StegGradientAppBar({
    super.key,
    required this.title,
    this.actions,
    this.leading,
  });

  final String title;
  final List<Widget>? actions;
  final Widget? leading;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: AppBar(
          leading: leading,
          title: Text(
            title,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 18,
              letterSpacing: -0.3,
            ),
          ),
          actions: actions,
          flexibleSpace: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: dark
                    ? [
                        StegColors.darkPage.withValues(alpha: 0.9),
                        StegColors.darkSurface.withValues(alpha: 0.85),
                      ]
                    : StegColors.brandGradientWide,
                begin: AlignmentDirectional.centerStart,
                end: AlignmentDirectional.centerEnd,
              ),
            ),
          ),
          backgroundColor: Colors.transparent,
          foregroundColor: Colors.white,
          elevation: 0,
          scrolledUnderElevation: 0,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Frosted top bar inset — reserved space for the shell's floating glass bar
// ─────────────────────────────────────────────────────────────────────────────

/// Height reserved by the shell's fully transparent frosted top bar (status
/// bar + toolbar). The shell publishes it above every tab page so a screen can
/// keep its first row clear of the bar while its content still scrolls
/// *beneath* the glass.
class StegGlassBarInset extends InheritedWidget {
  const StegGlassBarInset({
    super.key,
    required this.height,
    required super.child,
  });

  final double height;

  /// Reserved height above the current screen. Screens rendered outside the
  /// shell (deep links, tests) fall back to a standard toolbar + status bar.
  static double of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<StegGlassBarInset>()?.height ??
      kToolbarHeight + MediaQuery.paddingOf(context).top;

  @override
  bool updateShouldNotify(StegGlassBarInset oldWidget) =>
      oldWidget.height != height;
}

/// Top spacer for a screen inside the shell. [extra] keeps the screen's own
/// breathing room below the bar (the bar itself is fully transparent, so this
/// is spacing, not a solid header).
class StegGlassBarSpacer extends StatelessWidget {
  const StegGlassBarSpacer({super.key, this.extra = 0});

  final double extra;

  @override
  Widget build(BuildContext context) =>
      SizedBox(height: StegGlassBarInset.of(context) + extra);
}

// ─────────────────────────────────────────────────────────────────────────────
// Frosted Glass Card
// ─────────────────────────────────────────────────────────────────────────────

class StegGlassCard extends StatelessWidget {
  const StegGlassCard({
    super.key,
    required this.child,
    this.padding,
    this.gradient,
    this.borderColor,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final List<Color>? gradient;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return ClipRRect(
      borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          padding: padding ?? const EdgeInsets.all(StegSpacing.md),
          decoration: BoxDecoration(
            gradient: gradient != null
                ? LinearGradient(
                    colors: gradient!,
                    begin: AlignmentDirectional.topStart,
                    end: AlignmentDirectional.bottomEnd,
                  )
                : LinearGradient(
                    colors: dark
                        ? [
                            StegColors.darkElevated.withValues(alpha: 0.7),
                            StegColors.darkSurface.withValues(alpha: 0.6),
                          ]
                        : [
                            Colors.white.withValues(alpha: 0.75),
                            Colors.white.withValues(alpha: 0.55),
                          ],
                    begin: AlignmentDirectional.topStart,
                    end: AlignmentDirectional.bottomEnd,
                  ),
            borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
            border: Border.all(
              color: borderColor ??
                  Colors.white.withValues(alpha: dark ? 0.08 : 0.4),
              width: 1,
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}
