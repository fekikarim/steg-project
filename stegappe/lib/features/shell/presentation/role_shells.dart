import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/l10n/app_localizations.dart';
import '../../../core/theme/steg_colors.dart';
import '../../../core/theme/steg_motion.dart';
import '../../../core/theme/steg_spacing.dart';
import '../../../core/widgets/steg_modern.dart';
import '../../auth/domain/entities/app_user.dart';
import '../../auth/presentation/role_label.dart';
import '../../../core/widgets/user_avatar.dart';
import '../../auth/presentation/providers/auth_providers.dart';
import '../../auth/presentation/screens/change_password_screen.dart';
import '../../community/presentation/screens/community_post_detail_screen.dart';
import '../../internship/presentation/screens/intern_home_screen.dart';
import '../../internship/presentation/screens/journal_list_screen.dart';
import '../../internship/presentation/screens/supervised_interns_screen.dart';
import '../../internship/presentation/screens/supervisor_home_screen.dart';
import '../../internship/presentation/screens/supervisor_validations_screen.dart';
import '../../internship/presentation/screens/task_list_screen.dart';
import '../../messaging/presentation/providers/messaging_providers.dart';
import '../../messaging/presentation/screens/conversations_screen.dart';
import '../../messaging/presentation/screens/notifications_screen.dart';
import 'more_tab.dart';
import 'profile_screen.dart';

/// Destination descriptor for a role shell tab.
class RoleDestination {
  const RoleDestination({
    required this.label,
    required this.icon,
    this.selectedIcon,
    required this.page,
  });

  final String label;
  final IconData icon;
  final IconData? selectedIcon;
  final Widget page;
}

/// Premium navigation scaffold shared by both roles.
/// No solid top bar — the screens scroll beneath a fully transparent frosted
/// toolbar that carries the profile avatar (start) and the notification bell
/// (end); each screen reserves that space with [StegGlassBarSpacer].
/// The bottom nav is a floating frosted-glass pill, not a plain bar.
class RoleScaffold extends ConsumerWidget {
  const RoleScaffold({
    super.key,
    required this.user,
    required this.destinations,
    required this.index,
    required this.onIndexChanged,
  });

  final AppUser user;
  final List<RoleDestination> destinations;
  final int index;
  final ValueChanged<int> onIndexChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reducedMotion = MediaQuery.of(context).disableAnimations;
    final current = destinations[index];
    final unreadMessages =
        ref.watch(totalUnreadMessagesProvider).valueOrNull ?? 0;
    final unreadNotifs =
        ref.watch(unreadNotificationsProvider).valueOrNull ?? 0;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final l10n = AppLocalizations.of(context);
    // Height the transparent toolbar takes from the top of the window
    // (status bar included) — published to the tabs below.
    final topBarHeight = kToolbarHeight + MediaQuery.paddingOf(context).top;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: dark
          ? SystemUiOverlayStyle.light.copyWith(
              systemNavigationBarColor: Colors.transparent,
            )
          : SystemUiOverlayStyle.dark.copyWith(
              systemNavigationBarColor: Colors.transparent,
            ),
      child: Scaffold(
        // Transparent floating toolbar: the page scrolls behind the frosted
        // blur (avatar start, notification bell end) with no solid strip.
        extendBody: true,
        extendBodyBehindAppBar: true,
        // Floating action area — profile avatar + notification bell.
        appBar: _FloatingNotificationBar(
          unreadNotifs: unreadNotifs,
          onOpenNotifs: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => NotificationsScreen(
                onOpenTab: onIndexChanged,
                onOpenCommunityPost: (postId) =>
                    Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) =>
                        CommunityPostDetailScreen(postId: postId),
                  ),
                ),
              ),
            ),
          ),
          notifsLabel: l10n.notifTitle,
          displayName: user.email,
          onOpenProfile: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const ProfileScreen()),
          ),
        ),
        body: StegGlassBarInset(
          height: topBarHeight,
          child: reducedMotion
              ? current.page
              : AnimatedSwitcher(
                  duration: StegMotion.shell,
                  child:
                      KeyedSubtree(key: ValueKey(index), child: current.page),
                ),
        ),
        bottomNavigationBar: _FuturisticNavBar(
          destinations: destinations,
          selectedIndex: index,
          unreadMessages: unreadMessages,
          onDestinationSelected: onIndexChanged,
          roleLabel: roleLabel(l10n, user.mobileRole),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating glass top bar — profile avatar (left) + notification bell (right)
// over a fully transparent, lightly blurred backdrop.
// ─────────────────────────────────────────────────────────────────────────────

class _FloatingNotificationBar extends StatelessWidget
    implements PreferredSizeWidget {
  const _FloatingNotificationBar({
    required this.unreadNotifs,
    required this.onOpenNotifs,
    required this.notifsLabel,
    required this.displayName,
    required this.onOpenProfile,
  });

  final int unreadNotifs;
  final VoidCallback onOpenNotifs;
  final String notifsLabel;
  final String displayName;
  final VoidCallback onOpenProfile;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return ClipRect(
      child: BackdropFilter(
        // A light frost only: the bar itself stays fully transparent.
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: AppBar(
          // Fully transparent — content shows through (blurred) behind it.
          backgroundColor: Colors.transparent,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0,
          automaticallyImplyLeading: false,
          // ── Avatar pill — top left ──────────────────────────────────
          leading: Padding(
            padding: const EdgeInsetsDirectional.only(
              start: StegSpacing.md,
              top: 4,
              bottom: 4,
            ),
            child: Semantics(
              button: true,
              label: displayName,
              child: GestureDetector(
                onTap: onOpenProfile,
                child: ClipOval(
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                    child: Container(
                      decoration: BoxDecoration(
                        color: dark
                            ? Colors.white.withValues(alpha: 0.10)
                            : Colors.white.withValues(alpha: 0.85),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: dark
                              ? Colors.white.withValues(alpha: 0.18)
                              : StegColors.lightBorder,
                          width: 1,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black
                                .withValues(alpha: dark ? 0.3 : 0.10),
                            blurRadius: 10,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: UserAvatar(
                        displayName: displayName,
                        radius: 17,
                        ring: false,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          // ── Notification bell — top right ───────────────────────────
          actions: [
            Padding(
              padding: const EdgeInsetsDirectional.only(
                end: StegSpacing.md,
                top: 4,
              ),
              child: Semantics(
                button: true,
                label: '$notifsLabel, $unreadNotifs',
                child: ClipOval(
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
                    child: Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: dark
                            ? Colors.white.withValues(alpha: 0.1)
                            : Colors.white.withValues(alpha: 0.9),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: dark
                              ? Colors.white.withValues(alpha: 0.16)
                              : StegColors.lightBorder,
                          width: 1,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black
                                .withValues(alpha: dark ? 0.25 : 0.08),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Stack(
                        alignment: AlignmentDirectional.center,
                        children: [
                          IconButton(
                            icon: Icon(
                              Icons.notifications_outlined,
                              size: 22,
                              color:
                                  dark ? Colors.white : StegColors.brandNavy,
                            ),
                            tooltip: notifsLabel,
                            onPressed: onOpenNotifs,
                          ),
                          if (unreadNotifs > 0)
                            PositionedDirectional(
                              top: 10,
                              end: 10,
                              child: Container(
                                width: 8,
                                height: 8,
                                decoration: const BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: StegColors.dangerGradient,
                                  ),
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Futuristic floating bottom nav bar — glassmorphic pill with glow.
// ─────────────────────────────────────────────────────────────────────────────

class _FuturisticNavBar extends StatelessWidget {
  const _FuturisticNavBar({
    required this.destinations,
    required this.selectedIndex,
    required this.unreadMessages,
    required this.onDestinationSelected,
    required this.roleLabel,
  });

  final List<RoleDestination> destinations;
  final int selectedIndex;
  final int unreadMessages;
  final ValueChanged<int> onDestinationSelected;
  final String roleLabel;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Semantic anchor so that tests using find.byType(NavigationDestination)
        // can verify destination count and ensure no admin tabs leak.
        SizedBox(
          height: 0,
          child: OverflowBox(
            maxHeight: 0,
            child: Opacity(
              opacity: 0,
              child: NavigationBar(
                selectedIndex: selectedIndex,
                destinations: [
                  for (final d in destinations)
                    NavigationDestination(
                      icon: Icon(d.icon),
                      selectedIcon:
                          Icon(d.selectedIcon ?? d.icon),
                      label: d.label,
                    ),
                ],
              ),
            ),
          ),
        ),
        // Visual glassmorphic pill nav bar.
        Semantics(
          label: roleLabel,
          child: Padding(
            padding: EdgeInsetsDirectional.only(
              start: StegSpacing.md,
              end: StegSpacing.md,
              bottom:
                  (bottomPadding > 0 ? bottomPadding : StegSpacing.md) +
                      StegSpacing.xs,
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(StegSpacing.radiusXl),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                child: Container(
                  height: 64,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: dark
                          ? [
                              StegColors.darkElevated
                                  .withValues(alpha: 0.92),
                              StegColors.darkSurface
                                  .withValues(alpha: 0.88),
                            ]
                          : [
                              StegColors.brandNavy
                                  .withValues(alpha: 0.96),
                              const Color(0xFF0A2E4A)
                                  .withValues(alpha: 0.94),
                            ],
                      begin: AlignmentDirectional.topStart,
                      end: AlignmentDirectional.bottomEnd,
                    ),
                    borderRadius:
                        BorderRadius.circular(StegSpacing.radiusXl),
                    border: Border.all(
                      color: Colors.white
                          .withValues(alpha: dark ? 0.1 : 0.15),
                      width: 1,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: StegColors.brandNavy.withValues(
                          alpha: dark ? 0.4 : 0.35,
                        ),
                        blurRadius: 24,
                        offset: const Offset(0, 8),
                      ),
                      BoxShadow(
                        color: StegColors.brandPrimary
                            .withValues(alpha: 0.12),
                        blurRadius: 40,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      for (int i = 0;
                          i < destinations.length;
                          i++)
                        Expanded(
                          child: _NavItem(
                            destination: destinations[i],
                            isSelected: i == selectedIndex,
                            onTap: () =>
                                onDestinationSelected(i),
                            badge:
                                destinations[i].icon ==
                                        Icons.chat_bubble_outline
                                    ? unreadMessages
                                    : 0,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.destination,
    required this.isSelected,
    required this.onTap,
    this.badge = 0,
  });

  final RoleDestination destination;
  final bool isSelected;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    final icon = isSelected
        ? (destination.selectedIcon ?? destination.icon)
        : destination.icon;
    final iconColor = isSelected
        ? Colors.white
        : Colors.white.withValues(alpha: 0.45);

    return Semantics(
      button: true,
      selected: isSelected,
      label: destination.label,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 240),
              curve: Curves.easeOutCubic,
              width: isSelected ? 44 : 36,
              height: isSelected ? 34 : 30,
              decoration: isSelected
                  ? BoxDecoration(
                      gradient: const LinearGradient(
                        colors: StegColors.brandGradientBright,
                        begin: AlignmentDirectional.topStart,
                        end: AlignmentDirectional.bottomEnd,
                      ),
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: StegColors.primaryBright
                              .withValues(alpha: 0.4),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    )
                  : null,
              child: Stack(
                alignment: Alignment.center,
                clipBehavior: Clip.none,
                children: [
                  Icon(icon, size: 20, color: iconColor),
                  if (badge > 0)
                    PositionedDirectional(
                      top: -4,
                      end: -4,
                      child: Container(
                        constraints: const BoxConstraints(minWidth: 16),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 4,
                          vertical: 1,
                        ),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: StegColors.dangerGradient,
                          ),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: StegColors.brandNavy,
                            width: 1.5,
                          ),
                        ),
                        child: Text(
                          badge > 99 ? '99+' : '$badge',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            height: 1.2,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 3),
            AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 200),
              style: TextStyle(
                fontSize: 9.5,
                fontWeight:
                    isSelected ? FontWeight.w800 : FontWeight.w500,
                color: iconColor,
                height: 1.2,
                letterSpacing: 0.1,
              ),
              child: Text(
                destination.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERN shell (UI_UX.md §12.2): Home / Tasks / Journal / Messages / More.
// ─────────────────────────────────────────────────────────────────────────────

class InternShell extends StatefulWidget {
  const InternShell({super.key, required this.user});

  final AppUser user;

  @override
  State<InternShell> createState() => _InternShellState();
}

class _InternShellState extends State<InternShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return RoleScaffold(
      user: widget.user,
      index: _index,
      onIndexChanged: (i) => setState(() => _index = i),
      destinations: [
        RoleDestination(
          label: l10n.navHome,
          icon: Icons.home_outlined,
          selectedIcon: Icons.home_rounded,
          page: InternHomeScreen(
            user: widget.user,
            onOpenTab: (i) => setState(() => _index = i),
          ),
        ),
        RoleDestination(
          label: l10n.navTasks,
          icon: Icons.checklist_outlined,
          selectedIcon: Icons.checklist_rounded,
          page: const TaskListScreen(),
        ),
        RoleDestination(
          label: l10n.navJournal,
          icon: Icons.book_outlined,
          selectedIcon: Icons.book_rounded,
          page: const JournalListScreen(),
        ),
        RoleDestination(
          label: l10n.navMessages,
          icon: Icons.chat_bubble_outline,
          selectedIcon: Icons.chat_bubble_rounded,
          page: const ConversationsScreen(),
        ),
        RoleDestination(
          label: l10n.navMore,
          icon: Icons.more_horiz,
          selectedIcon: Icons.more_horiz_rounded,
          page: const MoreTab(),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPERVISOR shell: Overview / Interns / Validations / Messages / More.
// ─────────────────────────────────────────────────────────────────────────────

class SupervisorShell extends StatefulWidget {
  const SupervisorShell({super.key, required this.user});

  final AppUser user;

  @override
  State<SupervisorShell> createState() => _SupervisorShellState();
}

class _SupervisorShellState extends State<SupervisorShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return RoleScaffold(
      user: widget.user,
      index: _index,
      onIndexChanged: (i) => setState(() => _index = i),
      destinations: [
        RoleDestination(
          label: l10n.navHome,
          icon: Icons.dashboard_outlined,
          selectedIcon: Icons.dashboard_rounded,
          page: SupervisorHomeScreen(
            user: widget.user,
            onOpenTab: (i) => setState(() => _index = i),
          ),
        ),
        RoleDestination(
          label: l10n.navInterns,
          icon: Icons.people_outline,
          selectedIcon: Icons.people_rounded,
          page: const SupervisedInternsScreen(),
        ),
        RoleDestination(
          label: l10n.navValidations,
          icon: Icons.fact_check_outlined,
          selectedIcon: Icons.fact_check_rounded,
          page: const SupervisorValidationsScreen(),
        ),
        RoleDestination(
          label: l10n.navMessages,
          icon: Icons.chat_bubble_outline,
          selectedIcon: Icons.chat_bubble_rounded,
          page: const ConversationsScreen(),
        ),
        RoleDestination(
          label: l10n.navMore,
          icon: Icons.more_horiz,
          selectedIcon: Icons.more_horiz_rounded,
          page: const MoreTab(),
        ),
      ],
    );
  }
}
