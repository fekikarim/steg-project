import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/connectivity/connectivity_service.dart';
import '../../../../core/format/steg_format.dart';
import '../../../../core/l10n/app_localizations.dart';
import '../../../../core/navigation/app_destination.dart';
import '../../../../core/network/error_messages.dart';
import '../../../../core/theme/steg_colors.dart';
import '../../../../core/theme/steg_spacing.dart';
import '../../../../core/widgets/steg_modern.dart';
import '../../../../core/widgets/steg_states.dart';
import '../../../../core/widgets/steg_status_chip.dart';
import '../../../auth/domain/entities/app_user.dart';
import '../../../auth/presentation/role_label.dart';
import '../../../community/presentation/screens/community_post_detail_screen.dart';
import '../../../messaging/domain/entities/notification_item.dart';
import '../../../messaging/presentation/providers/messaging_providers.dart';
import '../../../messaging/presentation/screens/notifications_screen.dart';
import '../../../messaging/presentation/widgets/notification_type_visuals.dart';
import '../../domain/entities/evaluation.dart';
import '../../domain/entities/internship.dart';
import '../providers/notify_providers.dart';
import '../providers/supervisor_tasks_providers.dart';
import '../providers/workspace_providers.dart';
import '../widgets/dashboard_sections.dart';
import '../widgets/home_header.dart';
import 'intern_detail_screen.dart';
import 'task_drafts_screen.dart';

/// Supervisor dashboard, rebuilt from the reference design: a date and
/// greeting, a navy overview hero with the team's average progress, four
/// workload tiles, a document-verification alert, quick actions, the interns
/// to follow and the recent activity feed.
///
/// Every number comes from the T12 supervised rows (one scoped call) or from
/// the backend notification feed; nothing is invented. Tiles that the backend
/// does not provide per intern are left out rather than estimated.
class SupervisorHomeScreen extends ConsumerWidget {
  const SupervisorHomeScreen({super.key, required this.user, this.onOpen});

  final AppUser user;
  final ValueChanged<AppDestination>? onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final async = ref.watch(supervisedInternsProvider);
    final isOnline = ref.watch(isOnlineProvider);
    final last = ref.watch(lastSupervisedProvider);

    return RefreshIndicator(
      onRefresh: () async {
        refreshSupervisor(ref);
        ref.invalidate(notificationsProvider);
        try {
          await ref.read(supervisedInternsProvider.future);
        } on Exception {
          // Error UI renders via the AsyncValue.
        }
      },
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          // Space for the fully transparent frosted top bar; the dashboard
          // scrolls beneath it.
          const SliverToBoxAdapter(child: StegGlassBarSpacer()),
          SliverPadding(
            padding: StegSpacing.screenPadding,
            sliver: async.when(
              loading: () => (last != null && !isOnline)
                  ? SliverToBoxAdapter(
                      child: _HomeBody(
                        interns: last,
                        showStale: true,
                        user: user,
                        onOpen: onOpen,
                      ),
                    )
                  : const SliverFillRemaining(
                      hasScrollBody: false,
                      child: StegLoading(),
                    ),
              error: (e, _) {
                if (last != null && !isOnline) {
                  return SliverToBoxAdapter(
                    child: _HomeBody(
                      interns: last,
                      showStale: true,
                      user: user,
                      onOpen: onOpen,
                    ),
                  );
                }
                return SliverFillRemaining(
                  hasScrollBody: false,
                  child: StegErrorView(
                    message: context.userError(e).message,
                    onRetry: () => refreshSupervisor(ref),
                  ),
                );
              },
              data: (interns) {
                if (interns.isEmpty) {
                  return SliverFillRemaining(
                    hasScrollBody: false,
                    child: StegEmptyView(
                      title: l10n.noSupervised,
                      hint: l10n.noSupervisedHint,
                      icon: Icons.people_outline,
                    ),
                  );
                }
                return SliverToBoxAdapter(
                  child: _HomeBody(
                    interns: interns,
                    showStale: !isOnline,
                    user: user,
                    onOpen: onOpen,
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// Aggregates shown in the hero and tiles, derived from the supervised rows.
class _TeamStats {
  _TeamStats(List<SupervisedIntern> interns)
    : activeCount = interns
          .where((i) => i.status == InternshipStatus.inProgress)
          .length,
      assigned = interns.fold(0, (s, i) => s + i.tasksTotal),
      done = interns.fold(0, (s, i) => s + i.tasksCompleted),
      evaluations = interns.fold(0, (s, i) => s + i.evaluationsCount),
      journalToReview = interns.fold(0, (s, i) => s + i.submittedJournal),
      documentsToVerify = interns.fold(0, (s, i) => s + i.pendingDeliverables),
      averageFraction = _average(interns),
      department = _dominantDepartment(interns);

  final int activeCount;
  final int assigned;
  final int done;
  final int evaluations;
  final int journalToReview;
  final int documentsToVerify;

  /// Mean of the per-intern completion share, over interns with tasks only.
  final double? averageFraction;
  final String? department;

  int get actionsToday => journalToReview + documentsToVerify;

  static double? _average(List<SupervisedIntern> interns) {
    final fractions = [
      for (final i in interns)
        if (i.tasksFraction != null) i.tasksFraction!,
    ];
    if (fractions.isEmpty) return null;
    return fractions.reduce((a, b) => a + b) / fractions.length;
  }

  static String? _dominantDepartment(List<SupervisedIntern> interns) {
    final counts = <String, int>{};
    for (final i in interns) {
      if (i.departmentName.isEmpty) continue;
      counts[i.departmentName] = (counts[i.departmentName] ?? 0) + 1;
    }
    if (counts.isEmpty) return null;
    return counts.entries.reduce((a, b) => a.value >= b.value ? a : b).key;
  }
}

class _HomeBody extends ConsumerWidget {
  const _HomeBody({
    required this.interns,
    required this.showStale,
    required this.user,
    this.onOpen,
  });

  final List<SupervisedIntern> interns;
  final bool showStale;
  final AppUser user;
  final ValueChanged<AppDestination>? onOpen;

  void _openInternsInSelectMode(WidgetRef ref) {
    ref.read(supervisedViewProvider.notifier).state = SupervisedView.list;
    ref.read(notifySelectModeProvider.notifier).state = true;
    onOpen?.call(AppDestination.interns);
  }

  void _openInternsList(WidgetRef ref) {
    ref.read(supervisedViewProvider.notifier).state = SupervisedView.list;
    onOpen?.call(AppDestination.interns);
  }

  void _openCalendar(WidgetRef ref) {
    ref.read(supervisedViewProvider.notifier).state = SupervisedView.calendar;
    onOpen?.call(AppDestination.interns);
  }

  /// AI task drafts need one reference internship: the watched intern when
  /// there is one, otherwise the first supervised intern.
  void _openAiAnalysis(BuildContext context, WidgetRef ref) {
    if (interns.isEmpty) return;
    final watched = ref.read(selectedSupervisedInternshipProvider);
    final id = watched != null && interns.any((i) => i.internshipId == watched)
        ? watched
        : interns.first.internshipId;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => TaskDraftsScreen(referenceInternshipId: id),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final stats = _TeamStats(interns);
    final now = DateTime.now();
    final locale = Localizations.localeOf(context).languageCode;
    final dateLabel = StegFormat.formatLongDate(now, locale).toUpperCase();
    final follow = _followList(interns);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (showStale) ...[
          const StaleNotice(),
          const SizedBox(height: StegSpacing.sm),
        ],
        _Greeting(
          dateLabel: dateLabel,
          name: greetingFor(l10n, user.email, now),
          summary: l10n.homeActionsSummary(stats.actionsToday),
          roleText: roleLabel(l10n, user.mobileRole),
        ),
        const SizedBox(height: StegSpacing.md),
        _OverviewHero(stats: stats),
        const SizedBox(height: StegSpacing.sm),
        _StatGrid(stats: stats, l10n: l10n),
        const SizedBox(height: StegSpacing.sm),
        _DocumentsAlert(
          count: stats.documentsToVerify,
          onTap: onOpen == null
              ? null
              : () => onOpen!(AppDestination.validations),
        ),
        const SizedBox(height: StegSpacing.lg),
        _SectionTitle(title: l10n.homeQuickActions),
        const SizedBox(height: StegSpacing.sm),
        _QuickActionsList(
          tiles: [
            _QuickTileData(
              icon: Icons.add_task_outlined,
              label: l10n.qaAssignTask,
              color: StegColors.brandPrimary,
              onTap: onOpen == null
                  ? null
                  : () => onOpen!(AppDestination.tasks),
            ),
            _QuickTileData(
              icon: Icons.groups_outlined,
              label: l10n.qaSeeInterns,
              color: const Color(0xFF7C3AED),
              onTap: onOpen == null ? null : () => _openInternsList(ref),
            ),
            _QuickTileData(
              icon: Icons.fact_check_outlined,
              label: l10n.qaVerifyDocs,
              color: StegColors.brandRed,
              onTap: onOpen == null
                  ? null
                  : () => onOpen!(AppDestination.validations),
            ),
            _QuickTileData(
              icon: Icons.auto_awesome_outlined,
              label: l10n.homeQaAi,
              color: const Color(0xFF0E7490),
              onTap: () => _openAiAnalysis(context, ref),
            ),
          ],
        ),
        const SizedBox(height: StegSpacing.xs),
        Wrap(
          spacing: StegSpacing.xs,
          children: [
            TextButton.icon(
              icon: const Icon(Icons.campaign_outlined, size: 18),
              label: Text(l10n.notifyPrepareAsk),
              onPressed: onOpen == null
                  ? null
                  : () => _openInternsInSelectMode(ref),
            ),
            TextButton.icon(
              icon: const Icon(Icons.calendar_month_outlined, size: 18),
              label: Text(l10n.qaCalendar),
              onPressed: onOpen == null ? null : () => _openCalendar(ref),
            ),
          ],
        ),
        const SizedBox(height: StegSpacing.lg),
        _SectionTitle(
          title: l10n.homeFollowUp,
          actionLabel: l10n.viewAll,
          onAction: onOpen == null ? null : () => _openInternsList(ref),
        ),
        const SizedBox(height: StegSpacing.sm),
        for (final intern in follow) ...[
          _FollowCard(intern: intern),
          const SizedBox(height: StegSpacing.sm),
        ],
        const SizedBox(height: StegSpacing.lg),
        _SectionTitle(
          title: l10n.homeRecentActivity,
          actionLabel: l10n.viewAll,
          onAction: () => _openNotifications(context),
        ),
        const SizedBox(height: StegSpacing.sm),
        const _ActivityFeed(),
        // Clears the floating bottom navigation pill.
        const SizedBox(height: 96),
      ],
    );
  }

  /// Interns needing action first; when none do, the first few by name so
  /// the section never reads as empty.
  static List<SupervisedIntern> _followList(List<SupervisedIntern> interns) {
    final attention = interns.where((i) => i.needsAttention).toList();
    final source = attention.isEmpty ? interns : attention;
    return source.take(3).toList();
  }

  void _openNotifications(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => NotificationsScreen(
          onOpen: onOpen,
          onOpenCommunityPost: (postId) => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => CommunityPostDetailScreen(postId: postId),
            ),
          ),
        ),
      ),
    );
  }
}

class _Greeting extends StatelessWidget {
  const _Greeting({
    required this.dateLabel,
    required this.name,
    required this.summary,
    required this.roleText,
  });

  final String dateLabel;
  final String name;
  final String summary;
  final String roleText;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                dateLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.8,
                  color: theme.colorScheme.primary,
                ),
              ),
            ),
            StegStatusChip(label: roleText),
          ],
        ),
        const SizedBox(height: StegSpacing.xs),
        Text(
          name,
          style: theme.textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 2),
        Text(summary, style: theme.textTheme.bodyMedium),
      ],
    );
  }
}

/// Navy overview hero: active interns, department and the team's average
/// completion ring. Kept as the screen's single bold surface.
class _OverviewHero extends StatelessWidget {
  const _OverviewHero({required this.stats});

  final _TeamStats stats;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final fraction = stats.averageFraction;
    final percent = fraction == null ? '—' : '${(fraction * 100).round()}%';

    return Container(
      padding: const EdgeInsets.all(StegSpacing.md),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: StegColors.heroGradientDiagonalLight,
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
        ),
        borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
        boxShadow: StegColors.cardShadow(false),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.homeOverview.toUpperCase(),
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: Colors.white70,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: StegSpacing.xs),
                Text(
                  l10n.homeActiveCount(stats.activeCount),
                  style: theme.textTheme.titleLarge?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                if (stats.department != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    stats.department!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: Colors.white70,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: StegSpacing.sm),
          SizedBox(
            width: 84,
            height: 84,
            child: Semantics(
              label: '$percent ${l10n.homeAverage}',
              excludeSemantics: true,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  CircularProgressIndicator(
                    value: fraction?.clamp(0.0, 1.0) ?? 0,
                    strokeWidth: 6,
                    backgroundColor: Colors.white.withValues(alpha: 0.18),
                    valueColor: const AlwaysStoppedAnimation(Colors.white),
                  ),
                  FittedBox(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          percent,
                          style: theme.textTheme.titleMedium?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          l10n.homeAverage,
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: Colors.white70,
                            fontSize: 9,
                          ),
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

/// Two-by-two workload tiles. Each value is a sum of backend row counts.
class _StatGrid extends StatelessWidget {
  const _StatGrid({required this.stats, required this.l10n});

  final _TeamStats stats;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final tiles = [
      _StatTileData(
        icon: Icons.assignment_outlined,
        value: stats.assigned,
        label: l10n.homeStatAssigned,
        color: StegColors.brandPrimary,
      ),
      _StatTileData(
        icon: Icons.rate_review_outlined,
        value: stats.actionsToday,
        label: l10n.homeStatToReview,
        color: StegColors.warning,
      ),
      _StatTileData(
        icon: Icons.check_circle_outline,
        value: stats.done,
        label: l10n.homeStatDone,
        color: StegColors.success,
      ),
      _StatTileData(
        icon: Icons.workspace_premium_outlined,
        value: stats.evaluations,
        label: l10n.homeStatEvaluations,
        color: const Color(0xFF7C3AED),
      ),
    ];
    return Column(
      children: [
        Row(
          children: [
            Expanded(child: _StatTile(data: tiles[0])),
            const SizedBox(width: StegSpacing.sm),
            Expanded(child: _StatTile(data: tiles[1])),
          ],
        ),
        const SizedBox(height: StegSpacing.sm),
        Row(
          children: [
            Expanded(child: _StatTile(data: tiles[2])),
            const SizedBox(width: StegSpacing.sm),
            Expanded(child: _StatTile(data: tiles[3])),
          ],
        ),
      ],
    );
  }
}

class _StatTileData {
  const _StatTileData({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final int value;
  final String label;
  final Color color;
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.data});

  final _StatTileData data;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    return Semantics(
      label: '${data.label}: ${data.value}',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.all(StegSpacing.sm),
        decoration: _surfaceDecoration(dark),
        child: Row(
          children: [
            _Medallion(icon: data.icon, color: data.color, size: 34),
            const SizedBox(width: StegSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${data.value}',
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    data.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall,
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

/// Amber strip for documents awaiting verification; calm when there are none.
class _DocumentsAlert extends StatelessWidget {
  const _DocumentsAlert({required this.count, this.onTap});

  final int count;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final pending = count > 0;
    final color = pending ? StegColors.warning : StegColors.success;
    final tint = dark
        ? color.withValues(alpha: 0.16)
        : color.withValues(alpha: 0.08);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
        onTap: pending ? onTap : null,
        child: Container(
          padding: const EdgeInsets.all(StegSpacing.md),
          decoration: BoxDecoration(
            color: tint,
            borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Row(
            children: [
              _Medallion(
                icon: pending
                    ? Icons.description_outlined
                    : Icons.verified_outlined,
                color: color,
                size: 40,
              ),
              const SizedBox(width: StegSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      pending ? l10n.homeDocsCount(count) : l10n.homeNoDocs,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    if (pending)
                      Text(
                        l10n.homeDocsHint,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: dark
                              ? StegColors.warningDark
                              : StegColors.warning,
                        ),
                      ),
                  ],
                ),
              ),
              if (pending) Icon(Icons.chevron_right_rounded, color: color),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, this.actionLabel, this.onAction});

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        if (actionLabel != null && onAction != null)
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(
              foregroundColor: theme.colorScheme.primary,
              padding: const EdgeInsets.symmetric(horizontal: StegSpacing.xs),
              minimumSize: const Size(
                StegSpacing.minTouchTarget,
                StegSpacing.minTouchTarget,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  actionLabel!,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const Icon(Icons.chevron_right_rounded, size: 18),
              ],
            ),
          ),
      ],
    );
  }
}

class _QuickTileData {
  const _QuickTileData({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;
}

/// Quick actions as a two-by-two grid of list-style tiles.
class _QuickActionsList extends StatelessWidget {
  const _QuickActionsList({required this.tiles});

  final List<_QuickTileData> tiles;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < tiles.length; i += 2) {
      final left = tiles[i];
      final right = i + 1 < tiles.length ? tiles[i + 1] : null;
      rows.add(
        IntrinsicHeight(
          child: Row(
            children: [
              Expanded(child: _QuickTile(data: left)),
              const SizedBox(width: StegSpacing.sm),
              Expanded(
                child: right == null
                    ? const SizedBox.shrink()
                    : _QuickTile(data: right),
              ),
            ],
          ),
        ),
      );
      if (i + 2 < tiles.length) {
        rows.add(const SizedBox(height: StegSpacing.sm));
      }
    }
    return Column(children: rows);
  }
}

class _QuickTile extends StatelessWidget {
  const _QuickTile({required this.data});

  final _QuickTileData data;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final enabled = data.onTap != null;
    return Semantics(
      button: true,
      enabled: enabled,
      label: data.label,
      excludeSemantics: true,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
          onTap: data.onTap,
          child: Container(
            constraints: const BoxConstraints(minHeight: 64),
            padding: const EdgeInsets.all(StegSpacing.sm),
            decoration: _surfaceDecoration(dark),
            child: Row(
              children: [
                _Medallion(icon: data.icon, color: data.color, size: 36),
                const SizedBox(width: StegSpacing.sm),
                Expanded(
                  child: Text(
                    data.label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// One intern to follow: identity, attention chip and completion progress.
/// Tapping opens the intern's file.
class _FollowCard extends StatelessWidget {
  const _FollowCard({required this.intern});

  final SupervisedIntern intern;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final left = intern.tasksTotal - intern.tasksCompleted;
    final fraction = (intern.tasksFraction ?? 0).clamp(0.0, 1.0);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) =>
                InternDetailScreen(internshipId: intern.internshipId),
          ),
        ),
        child: Container(
          padding: const EdgeInsets.all(StegSpacing.md),
          decoration: _surfaceDecoration(dark),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  _InitialsAvatar(name: intern.internName),
                  const SizedBox(width: StegSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          intern.internName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          l10n.homeTasksLeftCount(left < 0 ? 0 : left),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall,
                        ),
                        const SizedBox(height: StegSpacing.xs),
                        Align(
                          alignment: AlignmentDirectional.centerStart,
                          child: intern.needsAttention
                              ? StegStatusChip(
                                  label: l10n.homeActionRequired,
                                  kind: StegStatusKind.warning,
                                )
                              : StegStatusChip(
                                  label: l10n.homeOnTrack,
                                  kind: StegStatusKind.success,
                                ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: StegSpacing.sm),
              LabeledProgress(
                label: l10n.homeStatDone,
                fraction: fraction,
                counter: '${intern.tasksCompleted}/${intern.tasksTotal}',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Recent backend notifications, newest first. Tapping opens the full feed.
class _ActivityFeed extends ConsumerWidget {
  const _ActivityFeed();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final async = ref.watch(notificationsProvider);

    return async.when(
      // Quiet placeholder: an endless spinner would keep the home busy.
      loading: () => const SizedBox(height: StegSpacing.xl),
      error: (e, _) => Padding(
        padding: const EdgeInsets.symmetric(vertical: StegSpacing.sm),
        child: Text(
          context.userError(e).message,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ),
      data: (page) {
        final items = page.items.take(4).toList();
        if (items.isEmpty) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: StegSpacing.sm),
            child: Text(
              l10n.homeNoActivity,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          );
        }
        return Column(
          children: [
            for (final item in items) ...[
              _ActivityRow(item: item),
              const SizedBox(height: StegSpacing.sm),
            ],
          ],
        );
      },
    );
  }
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.item});

  final NotificationItem item;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final color = theme.colorScheme.primary;

    return Container(
      padding: const EdgeInsets.all(StegSpacing.sm),
      decoration: _surfaceDecoration(dark),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Medallion(
            icon: notificationTypeIcon(item.type),
            color: color,
            size: 36,
          ),
          const SizedBox(width: StegSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: item.isRead ? FontWeight.w600 : FontWeight.w800,
                  ),
                ),
                if (item.message.isNotEmpty)
                  Text(
                    item.message,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall,
                  ),
                const SizedBox(height: 2),
                Text(
                  _relativeTime(
                    l10n,
                    Localizations.localeOf(context).languageCode,
                    item.createdAt,
                    DateTime.now(),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.labelSmall,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _relativeTime(
    AppLocalizations l10n,
    String locale,
    DateTime then,
    DateTime now,
  ) {
    final diff = now.difference(then);
    if (diff.inMinutes < 1) return l10n.homeTimeJustNow;
    if (diff.inMinutes < 60) return l10n.homeTimeMinutesAgo(diff.inMinutes);
    if (diff.inHours < 24) return l10n.homeTimeHoursAgo(diff.inHours);
    return StegFormat.formatDate(then.toIso8601String(), locale);
  }
}

class _Medallion extends StatelessWidget {
  const _Medallion({
    required this.icon,
    required this.color,
    required this.size,
  });

  final IconData icon;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color.withValues(alpha: dark ? 0.18 : 0.10),
        borderRadius: BorderRadius.circular(size * 0.32),
      ),
      child: Icon(icon, size: size * 0.5, color: color),
    );
  }
}

class _InitialsAvatar extends StatelessWidget {
  const _InitialsAvatar({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    final parts = name.trim().split(RegExp(r'\s+'));
    final initials = parts
        .take(2)
        .map((p) => p.isEmpty ? '' : p[0].toUpperCase())
        .join();
    return Container(
      width: 40,
      height: 40,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        gradient: LinearGradient(colors: StegColors.brandGradient),
        shape: BoxShape.circle,
      ),
      child: Text(
        initials,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w800,
          fontSize: 14,
        ),
      ),
    );
  }
}

/// Shared card surface for home tiles: white or navy-elevated, hairline
/// border and the house card shadow.
BoxDecoration _surfaceDecoration(bool dark) => BoxDecoration(
  color: dark ? StegColors.darkSurface : StegColors.lightSurface,
  borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
  border: Border.all(
    color: dark ? StegColors.darkBorder : StegColors.lightBorder,
  ),
  boxShadow: StegColors.cardShadow(dark),
);
