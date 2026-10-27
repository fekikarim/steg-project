import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/connectivity/connectivity_service.dart';
import '../../../core/l10n/app_localizations.dart';
import '../../../core/l10n/settings_providers.dart';
import '../../../core/theme/steg_colors.dart';
import '../../../core/theme/steg_spacing.dart';
import '../../../core/widgets/steg_button.dart';
import '../../../core/widgets/steg_card.dart';
import '../../../core/widgets/steg_dialog.dart';
import '../../../core/widgets/steg_fields.dart';
import '../../../core/widgets/steg_modern.dart';
import '../../../core/widgets/user_avatar.dart';
import '../../auth/domain/entities/app_user.dart';
import '../../auth/presentation/providers/auth_providers.dart';
import '../../auth/presentation/role_label.dart';
import '../../auth/presentation/screens/change_password_screen.dart';
import '../../community/presentation/screens/community_feed_screen.dart';
import '../../community/presentation/screens/community_reports_screen.dart';
import '../../internship/presentation/providers/workspace_providers.dart';
import 'about_screen.dart';
import 'profile_screen.dart';

/// Settings tab (T14 SH-SET-*): premium profile hero, account, appearance,
/// language, about, logout — sectioned with StegMenuTile rows and gradient
/// icon medallions. Identity shows email and role only (CIN is not exposed
/// by any mobile endpoint, and the raw user id carries no meaning for the
/// user, so neither is rendered).
class MoreTab extends ConsumerWidget {
  const MoreTab({super.key});

  /// Best-effort server sync of the UI locale (T14): local state applies
  /// immediately; a failed sync keeps the local value and never blocks.
  Future<void> _syncLocale(WidgetRef ref, String code) async {
    try {
      await ref.read(internshipRepositoryProvider).syncLocale(code);
    } on Exception {
      // Local preference already applied; the server retry happens on
      // the next switch (never a blocking error).
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final auth = ref.watch(authControllerProvider);
    final user = auth is AuthAuthenticated ? auth.user : null;
    final locale = ref.watch(localeProvider);
    final themeMode = ref.watch(themeModeProvider);
    final dark = Theme.of(context).brightness == Brightness.dark;

    return ListView(
      // Room for the shell's fully transparent frosted top bar: the settings
      // list still scrolls beneath it.
      padding: StegSpacing.screenPadding.copyWith(
        top: StegSpacing.md + StegGlassBarInset.of(context),
      ),
      children: [
        const SizedBox(height: StegSpacing.sm),
        if (user != null) ...[
          _ProfileHeroCard(user: user),
          const SizedBox(height: StegSpacing.md),
        ],

        // ── Community ─────────────────────────────────────────────────
        _SettingsSection(
          title: l10n.communityTitle,
          children: [
            StegMenuTile(
              icon: Icons.forum_outlined,
              title: l10n.communityTitle,
              subtitle: l10n.communityEmptyHint,
              gradient: StegColors.communityGradient,
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const CommunityFeedScreen(),
                ),
              ),
            ),
            if (user != null &&
                (user.mobileRole == UserRole.supervisor ||
                    user.mobileRole == UserRole.adminSupervisor))
              StegMenuTile(
                icon: Icons.flag_outlined,
                title: l10n.communityReports,
                gradient: StegColors.dangerGradient,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const CommunityReportsScreen(),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: StegSpacing.md),

        // ── Account ───────────────────────────────────────────────────
        _SettingsSection(
          title: l10n.accountTitle,
          children: [
            StegMenuTile(
              icon: Icons.person_outline,
              title: l10n.profileTitle,
              gradient: StegColors.brandGradientBright,
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const ProfileScreen()),
              ),
            ),
            StegMenuTile(
              icon: Icons.lock_outline,
              title: l10n.profileChangePassword,
              gradient: [StegColors.aiAccent, StegColors.primaryBright],
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const ChangePasswordScreen(),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: StegSpacing.md),

        // ── Appearance ────────────────────────────────────────────────
        _SettingsSection(
          title: l10n.appearanceTitle,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(
                vertical: StegSpacing.xs,
                horizontal: StegSpacing.xs,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(7),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [
                              Color(0xFF6D4CA8),
                              Color(0xFF3E9BDC),
                            ],
                            begin: AlignmentDirectional.topStart,
                            end: AlignmentDirectional.bottomEnd,
                          ),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(
                          Icons.dark_mode_outlined,
                          size: 16,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(width: StegSpacing.sm),
                      Text(
                        l10n.theme,
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: StegSpacing.sm),
                  Wrap(
                    spacing: StegSpacing.xs,
                    children: [
                      _ThemeChip(
                        label: l10n.themeSystem,
                        icon: Icons.contrast_rounded,
                        selected: themeMode == StegThemeMode.system,
                        dark: dark,
                        onSelected: (_) => ref
                            .read(themeModeProvider.notifier)
                            .setMode(StegThemeMode.system),
                      ),
                      _ThemeChip(
                        label: l10n.themeLight,
                        icon: Icons.light_mode_outlined,
                        selected: themeMode == StegThemeMode.light,
                        dark: dark,
                        onSelected: (_) => ref
                            .read(themeModeProvider.notifier)
                            .setMode(StegThemeMode.light),
                      ),
                      _ThemeChip(
                        label: l10n.themeDark,
                        icon: Icons.dark_mode_outlined,
                        selected: themeMode == StegThemeMode.dark,
                        dark: dark,
                        onSelected: (_) => ref
                            .read(themeModeProvider.notifier)
                            .setMode(StegThemeMode.dark),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: StegSpacing.md),

        // ── Language ──────────────────────────────────────────────────
        _SettingsSection(
          title: l10n.language,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(
                vertical: StegSpacing.sm,
                horizontal: StegSpacing.sm,
              ),
              child: Wrap(
                spacing: StegSpacing.xs,
                runSpacing: StegSpacing.xs,
                children: [
                  for (final loc in StegLocales.supported)
                    _LangChip(
                      label: _localeName(loc.languageCode, l10n),
                      selected: (locale ?? StegLocales.french).languageCode ==
                          loc.languageCode,
                      dark: dark,
                      onSelected: (_) async {
                        await ref.read(localeProvider.notifier).setLocale(loc);
                        await _syncLocale(ref, loc.languageCode);
                      },
                    ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: StegSpacing.md),

        // ── About ─────────────────────────────────────────────────────
        _SettingsSection(
          title: l10n.aboutTitle,
          children: [
            StegMenuTile(
              icon: Icons.info_outline,
              title: l10n.aboutTitle,
              gradient: [StegColors.journalViolet, StegColors.journalTeal],
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const AboutScreen()),
              ),
            ),
          ],
        ),
        const SizedBox(height: StegSpacing.md),

        // ── Logout ────────────────────────────────────────────────────
        StegCard(
          child: StegButton(
            label: l10n.logout,
            variant: StegButtonVariant.secondary,
            icon: Icons.logout_outlined,
            onPressed: () async {
              final confirmed = await showStegConfirmDialog(
                context,
                title: l10n.logoutConfirmTitle,
                message: l10n.logoutConfirmMessage,
                confirmLabel: l10n.logout,
                cancelLabel: l10n.cancelAction,
              );
              if (confirmed && context.mounted) {
                await ref.read(authControllerProvider.notifier).logout();
              }
            },
          ),
        ),
        SizedBox(height: 110 + MediaQuery.paddingOf(context).bottom),
      ],
    );
  }

  String _localeName(String code, AppLocalizations l10n) => switch (code) {
    'fr' => 'Français',
    'en' => 'English',
    'ar' => 'العربية',
    _ => code,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Premium profile hero: gradient banner with large avatar, name, role.
// ─────────────────────────────────────────────────────────────────────────────

class _ProfileHeroCard extends ConsumerWidget {
  const _ProfileHeroCard({required this.user});

  final AppUser user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final isOnline = ref.watch(isOnlineProvider);
    final dark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const ProfileScreen()),
      ),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: dark
                ? StegColors.heroGradientDiagonalDark
                : StegColors.heroGradientDiagonalLight,
            begin: AlignmentDirectional.topStart,
            end: AlignmentDirectional.bottomEnd,
          ),
          borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
          boxShadow: StegColors.cardShadow(dark),
        ),
        child: Stack(
          children: [
            // Decorative orbs
            PositionedDirectional(
              top: -30,
              end: -30,
              child: Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.07),
                ),
              ),
            ),
            PositionedDirectional(
              bottom: -50,
              start: -20,
              child: Container(
                width: 140,
                height: 140,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.04),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(StegSpacing.md),
              child: Row(
                children: [
                  // Avatar with presence dot
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.5),
                            width: 2.5,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.2),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: UserAvatar(
                          displayName: user.email,
                          radius: 28,
                          ring: false,
                        ),
                      ),
                      // Presence dot
                      PositionedDirectional(
                        end: 0,
                        bottom: 0,
                        child: Container(
                          width: 15,
                          height: 15,
                          decoration: BoxDecoration(
                            color: isOnline
                                ? StegColors.presenceOnline
                                : StegColors.presenceOffline,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: Colors.white,
                              width: 2,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: StegSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        BidiText(
                          user.email,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.2,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(
                              StegSpacing.radiusFull,
                            ),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.25),
                            ),
                          ),
                          child: Text(
                            roleLabel(l10n, user.mobileRole),
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.95),
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.arrow_forward_ios_rounded,
                    color: Colors.white.withValues(alpha: 0.6),
                    size: 16,
                  ),
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
// Settings section: title header + children in a rounded card.
// ─────────────────────────────────────────────────────────────────────────────

class _SettingsSection extends StatelessWidget {
  const _SettingsSection({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsetsDirectional.only(
            start: StegSpacing.xs,
            bottom: StegSpacing.xs,
          ),
          child: Text(
            title,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w800,
              fontSize: 12,
              letterSpacing: 0.5,
              color: Theme.of(context).colorScheme.primary.withValues(
                alpha: 0.8,
              ),
            ),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: dark ? StegColors.darkSurface : Colors.white,
            borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
            border: Border.all(
              color: dark ? StegColors.darkBorder : StegColors.lightBorder,
            ),
            boxShadow: StegColors.cardShadow(dark),
          ),
          child: Material(
            color: Colors.transparent,
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: StegSpacing.sm,
                vertical: StegSpacing.xs,
              ),
              child: Column(
                children: [
                  for (int i = 0; i < children.length; i++) ...[
                    children[i],
                    if (i < children.length - 1)
                      Divider(
                        height: 1,
                        indent: 54,
                        color: (dark ? StegColors.darkBorder : StegColors.lightBorder)
                            .withValues(alpha: 0.6),
                      ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Styled ChoiceChip variants
// ─────────────────────────────────────────────────────────────────────────────

class _ThemeChip extends StatelessWidget {
  const _ThemeChip({
    required this.label,
    required this.icon,
    required this.selected,
    required this.dark,
    required this.onSelected,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final bool dark;
  final ValueChanged<bool> onSelected;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 14,
            color: selected
                ? Colors.white
                : Theme.of(context).colorScheme.onSurfaceVariant,
          ),
          const SizedBox(width: 4),
          Text(label),
        ],
      ),
      selected: selected,
      selectedColor: Theme.of(context).colorScheme.primary,
      labelStyle: TextStyle(
        fontWeight: FontWeight.w700,
        fontSize: 12.5,
        color: selected
            ? Colors.white
            : Theme.of(context).textTheme.bodyMedium?.color,
      ),
      onSelected: onSelected,
    );
  }
}

class _LangChip extends StatelessWidget {
  const _LangChip({
    required this.label,
    required this.selected,
    required this.dark,
    required this.onSelected,
  });

  final String label;
  final bool selected;
  final bool dark;
  final ValueChanged<bool> onSelected;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      selectedColor: Theme.of(context).colorScheme.primary,
      labelStyle: TextStyle(
        fontWeight: FontWeight.w700,
        fontSize: 13,
        color: selected
            ? Colors.white
            : Theme.of(context).textTheme.bodyMedium?.color,
      ),
      onSelected: onSelected,
    );
  }
}
