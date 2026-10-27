import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/l10n/app_localizations.dart';
import '../../../core/network/error_messages.dart';
import '../../../core/theme/steg_colors.dart';
import '../../../core/theme/steg_spacing.dart';
import '../../../core/widgets/steg_card.dart';
import '../../../core/widgets/steg_modern.dart';
import '../../../core/widgets/steg_states.dart';
import '../../../core/widgets/steg_status_chip.dart';
import '../../../core/widgets/user_avatar.dart';
import '../../auth/domain/entities/app_user.dart';
import '../../auth/presentation/providers/auth_providers.dart';
import '../../auth/presentation/role_label.dart';
import '../../auth/presentation/screens/change_password_screen.dart';
import '../../community/presentation/screens/community_feed_screen.dart';
import '../../community/presentation/screens/community_reports_screen.dart';
import '../../internship/presentation/providers/workspace_providers.dart';
import '../../internship/presentation/screens/deliverables_screen.dart';
import '../../internship/presentation/screens/journal_list_screen.dart';
import '../../internship/presentation/screens/supervisor_validations_screen.dart';
import '../../internship/presentation/widgets/status_labels.dart';
import 'about_screen.dart';
import 'account_settings_section.dart';

/// Profile tab (STEG design: "Profil — Compte et préférences").
///
/// Identity is read-only: no backend endpoint lets an intern or supervisor
/// edit their own profile, so editing is never offered. The identity comes
/// from the authenticated session and the scoped internship payload; CIN,
/// passwords and tokens never enter the widget tree (BR-59).
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
    final isIntern = user.mobileRole == UserRole.intern;
    final internship = isIntern
        ? ref.watch(internshipDetailProvider).valueOrNull
        : null;
    final fullName = internship?.candidateFullName;
    final displayName = fullName != null && fullName.isNotEmpty
        ? fullName
        : user.email;

    return ListView(
      padding: StegSpacing.screenPadding.copyWith(
        top: StegSpacing.md + StegGlassBarInset.of(context),
      ),
      children: [
        Text(
          l10n.profileTitle,
          style: Theme.of(context).textTheme.headlineSmall
              ?.copyWith(fontWeight: FontWeight.w800),
        ),
        Text(
          l10n.profileSubtitle,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: StegSpacing.md),
        _ProfileHero(
          displayName: displayName,
          roleText: roleLabel(l10n, user.mobileRole),
        ),
        const SizedBox(height: StegSpacing.md),
        _IdentityCard(email: user.email),
        const SizedBox(height: StegSpacing.md),
        const _ReadOnlyNotice(),
        const SizedBox(height: StegSpacing.md),
        if (isIntern) const _InternshipCard() else const _SupervisedCountCard(),
        const SizedBox(height: StegSpacing.md),
        _MySpaceCard(isIntern: isIntern),
        const SizedBox(height: StegSpacing.md),
        const AccountSettingsSection(),
        const SizedBox(height: StegSpacing.md),
        _ChangePasswordTile(),
        SizedBox(height: 110 + MediaQuery.paddingOf(context).bottom),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Identity hero: initials avatar, name, role and the active-profile status.
// ─────────────────────────────────────────────────────────────────────────────

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({required this.displayName, required this.roleText});

  final String displayName;
  final String roleText;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(StegSpacing.lg),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: StegColors.heroGradientDiagonalLight,
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
        ),
        borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(4),
            decoration: const BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
            ),
            child: UserAvatar(
              displayName: displayName,
              radius: 32,
              ring: false,
            ),
          ),
          const SizedBox(height: StegSpacing.md),
          Text(
            displayName,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            roleText,
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white.withValues(alpha: 0.8)),
          ),
          const SizedBox(height: StegSpacing.sm),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: StegSpacing.md,
              vertical: 5,
            ),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(StegSpacing.radiusFull),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.circle,
                  size: 8,
                  color: StegColors.successDark,
                ),
                const SizedBox(width: StegSpacing.xs),
                Flexible(
                  child: Text(
                    l10n.profileActive,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
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

/// Account identity: the sign-in e-mail (read-only).
class _IdentityCard extends StatelessWidget {
  const _IdentityCard({required this.email});

  final String email;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return StegCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.profileEmail, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 2),
          // E-mail is a technical LTR run even inside an RTL paragraph.
          Directionality(
            textDirection: TextDirection.ltr,
            child: Text(
              email,
              style: Theme.of(context).textTheme.bodyLarge
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

/// Intern's linked internship (reference, period, status): read-only facts
/// from the scoped internship payload. No linked internship renders
/// nothing — the identity above already covers that case.
class _InternshipCard extends ConsumerWidget {
  const _InternshipCard();

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

/// Supervisor's scope at a glance (count only — the Stagiaires tab owns rows).
class _SupervisedCountCard extends ConsumerWidget {
  const _SupervisedCountCard();

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
        child: Text(
          '${interns.length}',
          style: Theme.of(context).textTheme.headlineSmall
              ?.copyWith(fontWeight: FontWeight.w800),
        ),
      ),
    );
  }
}

/// "Mon espace": the screens this role reaches from its profile.
class _MySpaceCard extends StatelessWidget {
  const _MySpaceCard({required this.isIntern});

  final bool isIntern;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return StegCard(
      title: l10n.profileMySpace,
      child: Column(
        children: [
          if (isIntern) ...[
            StegMenuTile(
              icon: Icons.upload_file_outlined,
              title: l10n.deliverablesTitle,
              gradient: StegColors.brandGradientBright,
              onTap: () => _push(context, const DeliverablesScreen()),
            ),
            StegMenuTile(
              icon: Icons.book_outlined,
              title: l10n.qaJournal,
              gradient: StegColors.brandGradientBright,
              onTap: () => _push(context, const JournalListScreen()),
            ),
          ] else ...[
            StegMenuTile(
              icon: Icons.fact_check_outlined,
              title: l10n.validationsTitle,
              gradient: StegColors.brandGradientBright,
              onTap: () => _push(context, const SupervisorValidationsScreen()),
            ),
            StegMenuTile(
              icon: Icons.forum_outlined,
              title: l10n.communityTitle,
              gradient: StegColors.communityGradient,
              onTap: () => _push(context, const CommunityFeedScreen()),
            ),
            StegMenuTile(
              icon: Icons.flag_outlined,
              title: l10n.communityReports,
              gradient: StegColors.dangerGradient,
              onTap: () => _push(context, const CommunityReportsScreen()),
            ),
          ],
          StegMenuTile(
            icon: Icons.help_outline,
            title: l10n.profileSupport,
            subtitle: l10n.profileSupportHint,
            gradient: const [StegColors.journalViolet, StegColors.journalTeal],
            onTap: () => _push(context, const AboutScreen()),
          ),
        ],
      ),
    );
  }

  void _push(BuildContext context, Widget screen) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
}

class _ChangePasswordTile extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return StegCard(
      child: StegMenuTile(
        icon: Icons.lock_outline,
        title: l10n.profileChangePassword,
        gradient: [StegColors.aiAccent, StegColors.primaryBright],
        onTap: () => Navigator.of(
          context,
        ).push(MaterialPageRoute(builder: (_) => const ChangePasswordScreen())),
      ),
    );
  }
}

/// States plainly that identity fields cannot be changed from the app.
class _ReadOnlyNotice extends StatelessWidget {
  const _ReadOnlyNotice();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: StegSpacing.md,
        vertical: StegSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: scheme.primary.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
        border: Border.all(color: scheme.primary.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Icon(Icons.lock_outline, size: 16, color: scheme.primary),
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
    );
  }
}
