import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/l10n/app_localizations.dart';
import '../../../core/network/error_messages.dart';
import '../../../core/theme/steg_colors.dart';
import '../../../core/theme/steg_spacing.dart';
import '../../../core/widgets/steg_card.dart';
import '../../../core/widgets/steg_states.dart';
import '../../../core/widgets/steg_status_chip.dart';
import '../../../core/widgets/user_avatar.dart';
import '../../auth/domain/entities/app_user.dart';
import '../../auth/presentation/providers/auth_providers.dart';
import '../../auth/presentation/role_label.dart';
import '../../auth/presentation/screens/change_password_screen.dart';
import '../../internship/presentation/providers/workspace_providers.dart';
import '../../internship/presentation/widgets/status_labels.dart';
import '../../../core/widgets/steg_modern.dart';

/// Read-only identity screen (T14 SH-SET-01/SH-PRO-01).
///
/// There is no server-side profile update capability for any field
/// (no intern/supervisor self-service endpoint exists), so every field
/// renders explicitly read-only — editability is never faked. Identity
/// comes from JWT claims plus the internship payload; CIN, passwords and
/// tokens never enter the widget tree (BR-59).
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final auth = ref.watch(authControllerProvider);
    final user = auth is AuthAuthenticated ? auth.user : null;
    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.profileTitle)),
        body: StegErrorView(
          message: l10n.errSessionExpired,
          onRetry: () => ref.invalidate(authControllerProvider),
        ),
      );
    }
    return Scaffold(
      // Gradient app bar so the hero blends into the app bar
      appBar: AppBar(
        title: Text(l10n.profileTitle),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: StegColors.brandGradientWide,
              begin: AlignmentDirectional.centerStart,
              end: AlignmentDirectional.centerEnd,
            ),
          ),
        ),
      ),
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          // ── Full-bleed gradient hero ──────────────────────────────────
          _ProfileHero(user: user),
          // ── Content cards ─────────────────────────────────────────────
          Padding(
            padding: StegSpacing.screenPadding,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (user.mobileRole == UserRole.intern)
                  _InternshipCard()
                else
                  _SupervisedCountCard(),
                const SizedBox(height: StegSpacing.md),
                _AccountCard(l10n: l10n),
                const SizedBox(height: StegSpacing.md),
                // Read-only notice card
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: StegSpacing.md,
                    vertical: StegSpacing.sm,
                  ),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primary.withValues(
                      alpha: Theme.of(context).brightness == Brightness.dark
                          ? 0.12
                          : 0.06,
                    ),
                    borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
                    border: Border.all(
                      color: Theme.of(
                        context,
                      ).colorScheme.primary.withValues(alpha: 0.25),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.lock_outline,
                        size: 16,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                      const SizedBox(width: StegSpacing.sm),
                      Expanded(
                        child: Text(
                          l10n.profileReadOnly,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gradient hero with large avatar, name, role — extends the app bar gradient.
// ─────────────────────────────────────────────────────────────────────────────

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({required this.user});

  final AppUser user;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: dark
              ? StegColors.heroGradientDiagonalDark
              : StegColors.heroGradientDiagonalLight,
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
        ),
      ),
      child: Stack(
        children: [
          // Decorative orbs
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
          PositionedDirectional(
            bottom: -60,
            start: -40,
            child: Container(
              width: 180,
              height: 180,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.04),
              ),
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                StegSpacing.xl,
                StegSpacing.xl,
                StegSpacing.xl,
                StegSpacing.xxl,
              ),
              child: Column(
                children: [
                  // Large bordered avatar
                  Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.6),
                        width: 3,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.25),
                          blurRadius: 20,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: UserAvatar(
                      displayName: user.email,
                      radius: 40,
                      ring: false,
                    ),
                  ),
                  const SizedBox(height: StegSpacing.md),
                  // Email — isolated LTR technical run inside RTL paragraph.
                  Directionality(
                    textDirection: TextDirection.ltr,
                    child: Text(
                      user.email,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                      ),
                    ),
                  ),
                  const SizedBox(height: StegSpacing.xs),
                  // Role pill
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: StegSpacing.md,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(
                        StegSpacing.radiusFull,
                      ),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Text(
                      roleLabel(l10n, user.mobileRole),
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.95),
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
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

// ─────────────────────────────────────────────────────────────────────────────
// Account actions card
// ─────────────────────────────────────────────────────────────────────────────

class _AccountCard extends StatelessWidget {
  const _AccountCard({required this.l10n});

  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      decoration: BoxDecoration(
        color: dark ? StegColors.darkSurface : Colors.white,
        borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
        border: Border.all(
          color: dark ? StegColors.darkBorder : StegColors.lightBorder,
        ),
        boxShadow: StegColors.cardShadow(dark),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: StegSpacing.sm,
          vertical: StegSpacing.xs,
        ),
        child: Column(
          children: [
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
      ),
    );
  }
}

/// Intern's linked internship (reference, period, status): read-only facts
/// from the scoped internship payload. No linked internship renders
/// nothing — the identity above already covers that case.
class _InternshipCard extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context);
    final detailAsync = ref.watch(internshipDetailProvider);
    return detailAsync.when(
      loading: () => const StegLoading(),
      error: (e, _) {
        if (e is StateError && e.message == 'no-internship') {
          return const SizedBox.shrink();
        }
        return Text(
          context.userError(e).message,
          style: TextStyle(color: Theme.of(context).colorScheme.error),
        );
      },
      data: (internship) => StegCard(
        title: l10n.profileInternship,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Wrap(
              spacing: StegSpacing.xs,
              runSpacing: StegSpacing.xs,
              children: [
                StegStatusChip(
                  label: internshipStatusLabel(internship.status, l10n),
                  kind: internshipStatusKind(internship.status),
                ),
                // Standalone LTR value: renders LTR-visual in RTL as-is
                // (measured), so no invisible isolate characters.
                StegStatusChip(label: internship.reference),
              ],
            ),
            const SizedBox(height: StegSpacing.xs),
            Text(
              '${formatDay(internship.startDate, locale)} → '
              '${formatDay(internship.endDate, locale)}',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}

/// Supervisor's scope at a glance (count only — the Interns tab owns rows).
class _SupervisedCountCard extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final async = ref.watch(supervisedInternsProvider);
    return async.when(
      loading: () => const StegLoading(),
      error: (e, _) => Text(
        context.userError(e).message,
        style: TextStyle(color: Theme.of(context).colorScheme.error),
      ),
      data: (interns) => StegCard(
        title: l10n.myInterns,
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: StegColors.brandGradientBright,
                  begin: AlignmentDirectional.topStart,
                  end: AlignmentDirectional.bottomEnd,
                ),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(
                Icons.people_outline,
                color: Colors.white,
                size: 22,
              ),
            ),
            const SizedBox(width: StegSpacing.md),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${interns.length}',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
