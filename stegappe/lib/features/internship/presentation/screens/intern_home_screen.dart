import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/connectivity/connectivity_service.dart';
import '../../../../core/navigation/app_destination.dart';
import '../../../../core/l10n/app_localizations.dart';
import '../../../../core/network/error_messages.dart';
import '../../../../core/theme/steg_colors.dart';
import '../../../../core/theme/steg_spacing.dart';
import '../../../../core/widgets/steg_card.dart';
import '../../../../core/widgets/steg_modern.dart';
import '../../../../core/widgets/steg_states.dart';
import '../../../../core/widgets/steg_status_chip.dart';
import '../../../auth/domain/entities/app_user.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../domain/dashboard.dart';
import '../../domain/entities/work_items.dart';
import '../providers/workspace_providers.dart';
import '../widgets/dashboard_sections.dart';
import '../widgets/home_header.dart';
import '../widgets/status_labels.dart';
import '../widgets/task_row.dart';
import '../../../community/presentation/screens/community_feed_screen.dart';
import 'assistant_screen.dart';
import 'deliverables_screen.dart';
import 'my_evaluations_screen.dart';
import 'progress_screen.dart';
import '../../../../core/widgets/steg_skeleton.dart';

/// Intern home dashboard — answers:
/// "what should I do?" (today/overdue/week) /
/// "what did I do?" (pending journal, deliverables) /
/// "how am I progressing?" (task + timeline progress, evaluations).
class InternHomeScreen extends ConsumerWidget {
  const InternHomeScreen({super.key, required this.user, this.onOpen});

  final AppUser user;
  final ValueChanged<AppDestination>? onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final async = ref.watch(dashboardProvider);
    final isOnline = ref.watch(isOnlineProvider);
    final last = ref.watch(lastDashboardProvider);

    return RefreshIndicator(
      onRefresh: () async {
        refreshWorkspace(ref);
        // Wait for the new snapshot (or error) before ending the gesture.
        try {
          await ref.read(dashboardProvider.future);
        } on Exception {
          // Error UI is rendered by the AsyncValue below.
        }
      },
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          // Breathing gap below the fully transparent frosted top bar.
          const SliverToBoxAdapter(child: StegGlassBarSpacer(extra: 8)),
          SliverPadding(
            padding: StegSpacing.screenPadding,
            sliver: async.when(
              loading: () => (last != null && !isOnline)
                  ? SliverToBoxAdapter(
                      child: _StaleBody(data: last, isOnline: false),
                    )
                  : const SliverFillRemaining(
                      hasScrollBody: false,
                      child: StegSkeletonDashboard(),
                    ),
              error: (e, _) {
                if (e is StateError && e.message == 'no-internship') {
                  return SliverFillRemaining(
                    hasScrollBody: false,
                    child: StegEmptyView(
                      title: l10n.noInternshipTitle,
                      hint: l10n.noInternshipHint,
                      icon: Icons.school_outlined,
                    ),
                  );
                }
                if (last != null && !isOnline) {
                  return SliverToBoxAdapter(
                    child: _StaleBody(data: last, isOnline: false),
                  );
                }
                return SliverFillRemaining(
                  hasScrollBody: false,
                  child: StegErrorView(
                    message: context.userError(e).message,
                    onRetry: () => refreshWorkspace(ref),
                  ),
                );
              },
              data: (data) => _DashboardSliver(
                data: data,
                isOnline: isOnline,
                onOpen: onOpen,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StaleBody extends StatelessWidget {
  const _StaleBody({required this.data, required this.isOnline});

  final DashboardData data;
  final bool isOnline;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const StaleNotice(),
        const SizedBox(height: StegSpacing.md),
        _DashboardContent(data: data, isOnline: isOnline),
      ],
    );
  }
}

class _DashboardSliver extends StatelessWidget {
  const _DashboardSliver({
    required this.data,
    required this.isOnline,
    this.onOpen,
  });

  final DashboardData data;
  final bool isOnline;
  final ValueChanged<AppDestination>? onOpen;

  @override
  Widget build(BuildContext context) {
    return SliverToBoxAdapter(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (!isOnline) ...[
            const StaleNotice(),
            const SizedBox(height: StegSpacing.md),
          ],
          _DashboardContent(data: data, isOnline: isOnline, onOpen: onOpen),
          SizedBox(height: 110 + MediaQuery.paddingOf(context).bottom),
        ],
      ),
    );
  }
}

class _DashboardContent extends ConsumerWidget {
  const _DashboardContent({
    required this.data,
    required this.isOnline,
    this.onOpen,
  });

  final DashboardData data;
  final bool isOnline;
  final ValueChanged<AppDestination>? onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context);
    final internship = data.internship;
    final auth = ref.watch(authControllerProvider);
    final role = auth is AuthAuthenticated
        ? auth.user.mobileRole
        : UserRole.unsupported;
    final email = auth is AuthAuthenticated ? auth.user.email : '';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // --- T13 greeting + avatar + role (display only, BR-53) ---
        HomeHeader(
          displayName: data.internship.candidateFullName?.isNotEmpty == true
              ? data.internship.candidateFullName!
              : email,
          role: role,
        ),
        const SizedBox(height: StegSpacing.md),

        // --- T13 quick actions (navigate only, never business logic) ---
        QuickActionsGrid(
          actions: [
            QuickAction(
              icon: Icons.checklist_outlined,
              label: l10n.qaTasks,
              onTap: onOpen == null
                  ? null
                  : () => onOpen!(AppDestination.tasks),
            ),
            QuickAction(
              icon: Icons.book_outlined,
              label: l10n.qaMyJournal,
              onTap: onOpen == null
                  ? null
                  : () => onOpen!(AppDestination.journal),
            ),
            QuickAction(
              icon: Icons.smart_toy_outlined,
              label: l10n.qaAssistantAi,
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const AssistantScreen()),
              ),
            ),
            QuickAction(
              icon: Icons.chat_bubble_outline,
              label: l10n.qaMentor,
              onTap: onOpen == null
                  ? null
                  : () => onOpen!(AppDestination.messages),
            ),
          ],
        ),
        const SizedBox(height: StegSpacing.md),

        // --- Internship identity: status, type, assignment ---
        _InternshipCard(
          reference: internship.reference,
          statusLabel: internshipStatusLabel(internship.status, l10n),
          statusKind: internshipStatusKind(internship.status),
          typeLabel: internshipTypeLabel(internship.type, l10n),
          department: data.activeAssignment?.departmentName,
          supervisor: data.activeAssignment?.supervisorName,
        ),
        const SizedBox(height: StegSpacing.md),

        // --- Action first: what needs doing now (overdue on top) ---
        DashboardSection(
          title: l10n.todayTitle,
          actionLabel: l10n.viewAll,
          onAction: () => onOpen?.call(AppDestination.tasks),
          child: _TaskPreviewList(
            tasks: [...data.overdueTasks, ...data.todayTasks].take(5).toList(),
            emptyHint: l10n.tasksEmpty,
            now: data.now,
          ),
        ),
        const SizedBox(height: StegSpacing.md),

        if (data.weekTasks.isNotEmpty) ...[
          DashboardSection(
            title: l10n.thisWeek,
            actionLabel: l10n.viewAll,
            onAction: () => onOpen?.call(AppDestination.tasks),
            child: _TaskPreviewList(
              tasks: data.weekTasks.take(4).toList(),
              emptyHint: l10n.tasksEmpty,
              now: data.now,
            ),
          ),
          const SizedBox(height: StegSpacing.md),
        ],

        // --- How am I progressing? ---
        DashboardSection(
          title: l10n.myProgress,
          actionLabel: l10n.viewAll,
          onAction: () => Navigator.of(context)
              .push(MaterialPageRoute(builder: (_) => const ProgressScreen())),
          child: Column(
            children: [
              if (data.tasksFraction != null)
                LabeledProgress(
                  label: l10n.tasksProgress,
                  fraction: data.tasksFraction!,
                  counter: '${data.tasksCompleted}/${data.tasksTotal}',
                ),
              if (data.tasksFraction != null)
                const SizedBox(height: StegSpacing.sm),
              LabeledProgress(
                label: l10n.timelineProgress,
                fraction: data.timelineFraction,
                counter:
                    '${formatDay(internship.startDate, locale)} → ${formatDay(internship.endDate, locale)}',
              ),
            ],
          ),
        ),
        const SizedBox(height: StegSpacing.md),

        // --- Progress hero + counts from the same dashboard snapshot ---
        _ProgressHero(data: data),
        const SizedBox(height: StegSpacing.md),

        // --- Pending journal ---
        DashboardSection(
          title: '${l10n.pendingJournalTitle} (${data.pendingJournalTotal})',
          icon: Icons.edit_note_outlined,
          actionLabel: l10n.viewAll,
          onAction: () => onOpen?.call(AppDestination.journal),
          child: data.pendingJournal.isEmpty
              ? _Hint(text: l10n.journalEmpty)
              : Column(
                  children: [
                    for (final j in data.pendingJournal.take(3)) ...[
                      _ModernItemRow(
                        icon: Icons.edit_note_outlined,
                        gradient: StegColors.brandGradientBright,
                        title: j.title.isEmpty ? '—' : j.title,
                        subtitle: formatDay(j.entryDate, locale),
                        trailing: StegStatusChip(
                          label: journalStatusLabel(j.status, l10n),
                          kind: journalStatusKind(j.status),
                        ),
                      ),
                      if (j != data.pendingJournal.take(3).last)
                        const Divider(height: 1, indent: 52),
                    ],
                  ],
                ),
        ),
        const SizedBox(height: StegSpacing.md),

        // --- Deliverables ---
        DashboardSection(
          title: l10n.deliverablesTitle,
          icon: Icons.upload_file_outlined,
          actionLabel: l10n.viewAll,
          onAction: () => Navigator.of(
            context,
          ).push(MaterialPageRoute(builder: (_) => const DeliverablesScreen())),
          child: data.openDeliverables.isEmpty
              ? _Hint(text: l10n.journalEmpty)
              : Column(
                  children: [
                    for (
                      int di = 0;
                      di < data.openDeliverables.length;
                      di++
                    ) ...[
                      _ModernItemRow(
                        icon: Icons.upload_file_outlined,
                        gradient: StegColors.aiGradient,
                        title: data.openDeliverables[di].title,
                        subtitle: l10n.versionLabel(
                          data.openDeliverables[di].currentVersion,
                        ),
                        trailing: StegStatusChip(
                          label: deliverableStatusLabel(
                            data.openDeliverables[di].status,
                            l10n,
                          ),
                          kind: deliverableStatusKind(
                            data.openDeliverables[di].status,
                          ),
                        ),
                      ),
                      if (di < data.openDeliverables.length - 1)
                        const Divider(height: 1, indent: 52),
                    ],
                  ],
                ),
        ),
        const SizedBox(height: StegSpacing.md),

        // --- Community (T08 / ST-COM-01): peer help feed. ---
        DashboardSection(
          title: l10n.communityTitle,
          icon: Icons.forum_outlined,
          actionLabel: l10n.viewAll,
          onAction: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const CommunityFeedScreen()),
          ),
          child: _ModernItemRow(
            icon: Icons.forum_outlined,
            gradient: StegColors.communityGradient,
            title: l10n.communityEmptyHint,
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const CommunityFeedScreen()),
            ),
          ),
        ),
        const SizedBox(height: StegSpacing.md),

        // --- Latest evaluation ---
        if (data.latestEvaluation != null) ...[
          DashboardSection(
            title: l10n.evaluationsTitle,
            icon: Icons.star_outline,
            actionLabel: l10n.viewAll,
            onAction: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const MyEvaluationsScreen()),
            ),
            child: _ModernItemRow(
              icon: Icons.star_outline,
              gradient: [StegColors.journalAmber, StegColors.journalAmberDark],
              title:
                  '${data.latestEvaluation!.type} • ${formatDay(data.latestEvaluation!.evaluationDate, locale)}',
              subtitle: data.latestEvaluation!.totalScore == null
                  ? null
                  : l10n.scoreLabel(
                      data.latestEvaluation!.totalScore!.toStringAsFixed(2),
                    ),
            ),
          ),
          const SizedBox(height: StegSpacing.md),
        ],

        // --- Notifications ---
        _NotificationsCard(data: data),
      ],
    );
  }
}

/// Internship identity card: status + type chips over the assignment meta.
///
/// The internal reference is deliberately *not* shown: it is back-office
/// bookkeeping, it crowds the chips onto a second line, and the student
/// already reaches it from the profile/More screens. It stays as the card's
/// semantics label so screen readers keep it.
class _InternshipCard extends StatelessWidget {
  const _InternshipCard({
    required this.reference,
    required this.statusLabel,
    required this.statusKind,
    required this.typeLabel,
    this.department,
    this.supervisor,
  });

  final String reference;
  final String statusLabel;
  final StegStatusKind statusKind;
  final String typeLabel;
  final String? department;
  final String? supervisor;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Semantics(
      header: true,
      label: reference,
      child: StegCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Wrap(
              spacing: StegSpacing.xs,
              runSpacing: StegSpacing.xs,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                StegStatusChip(label: statusLabel, kind: statusKind),
                StegStatusChip(label: typeLabel),
              ],
            ),
            if (department != null || supervisor != null) ...[
              const SizedBox(height: StegSpacing.sm),
              if (department != null)
                _MetaRow(
                  icon: Icons.apartment_outlined,
                  text: '${l10n.departmentLabel}: $department',
                ),
              if (department != null && supervisor != null)
                const SizedBox(height: StegSpacing.xs),
              if (supervisor != null)
                _MetaRow(
                  icon: Icons.badge_outlined,
                  text: '${l10n.supervisorLabel}: $supervisor',
                ),
            ],
          ],
        ),
      ),
    );
  }
}

/// One meta line of the internship card: quiet tinted icon + wrapping text.
class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          margin: const EdgeInsetsDirectional.only(top: 1),
          padding: const EdgeInsets.all(5),
          decoration: BoxDecoration(
            color: scheme.primary.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 13, color: scheme.primary),
        ),
        const SizedBox(width: StegSpacing.sm),
        Expanded(
          child: Text(
            text,
            style: Theme.of(context).textTheme.bodySmall
                ?.copyWith(fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }
}

class _TaskPreviewList extends StatelessWidget {
  const _TaskPreviewList({
    required this.tasks,
    required this.emptyHint,
    required this.now,
  });

  final List<InternTask> tasks;
  final String emptyHint;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    if (tasks.isEmpty) return _Hint(text: emptyHint);
    return Column(
      children: [for (final t in tasks) TaskRow(task: t, now: now)],
    );
  }
}

class _Hint extends StatelessWidget {
  const _Hint({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: StegSpacing.xs),
        child: Text(
          text,
          style: Theme.of(context).textTheme.bodyMedium
              ?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
        ),
      ),
    );
  }
}

/// Modern item row used in dashboard sections (replaces bare ListTile).
class _ModernItemRow extends StatelessWidget {
  const _ModernItemRow({
    required this.icon,
    required this.gradient,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
  });

  final IconData icon;
  final List<Color> gradient;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    // Soft tinted medallion: the row's colour codes the section without
    // shouting (a solid gradient square per row was visual noise at scale).
    final tint = dark ? gradient.last : gradient.first;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: StegSpacing.sm),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      tint.withValues(alpha: dark ? 0.28 : 0.13),
                      tint.withValues(alpha: dark ? 0.16 : 0.07),
                    ],
                    begin: AlignmentDirectional.topStart,
                    end: AlignmentDirectional.bottomEnd,
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, size: 18, color: tint),
              ),
              const SizedBox(width: StegSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium
                          ?.copyWith(fontWeight: FontWeight.w600),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ],
                ),
              ),
              if (trailing != null) ...[
                const SizedBox(width: StegSpacing.xs),
                trailing!,
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _NotificationsCard extends ConsumerWidget {
  const _NotificationsCard({required this.data});

  final DashboardData data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context);
    return DashboardSection(
      title: '${l10n.notificationsTitle} (${data.unreadNotifications})',
      action: TextButton(
        onPressed: () async {
          try {
            await ref
                .read(internshipRepositoryProvider)
                .markAllNotificationsRead();
            ref.invalidate(dashboardProvider);
          } on Exception catch (e) {
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(context.userError(e).message)),
              );
            }
          }
        },
        child: Text(l10n.markAllRead),
      ),
      child: data.recentNotifications.isEmpty
          ? _Hint(text: l10n.notificationsEmpty)
          : Column(
              children: [
                for (
                  int ni = 0;
                  ni < data.recentNotifications.length;
                  ni++
                ) ...[
                  _ModernItemRow(
                    icon: data.recentNotifications[ni].isRead
                        ? Icons.notifications_outlined
                        : Icons.notifications_active_outlined,
                    gradient: data.recentNotifications[ni].isRead
                        ? [
                            StegColors.lightTextSecondary,
                            StegColors.darkTextSecondary,
                          ]
                        : StegColors.brandGradientBright,
                    title: data.recentNotifications[ni].title.isEmpty
                        ? '—'
                        : data.recentNotifications[ni].title,
                    subtitle:
                        '${formatDay(data.recentNotifications[ni].createdAt, locale)} • '
                        '${priorityLabel(data.recentNotifications[ni].priority, l10n)}',
                  ),
                  if (ni < data.recentNotifications.length - 1)
                    const Divider(height: 1, indent: 52),
                ],
              ],
            ),
    );
  }
}

/// Progress card with the completion percentage and three counts computed from
/// the dashboard snapshot (total, done, remaining). It is a [StegCard] so the
/// home keeps one consistent rhythm between sections.
class _ProgressHero extends StatelessWidget {
  const _ProgressHero({required this.data});

  final DashboardData data;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final total = data.tasksTotal;
    final done = data.tasksCompleted;
    final remaining = (total - done).clamp(0, total);
    final fraction = data.tasksFraction;
    final percent = fraction == null ? null : (fraction * 100).round();
    return StegCard(
      accent: true,
      title: l10n.homeProgressTitle,
      action: percent == null
          ? null
          : Text(
              '$percent%',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(StegSpacing.radiusFull),
            child: LinearProgressIndicator(value: fraction ?? 0, minHeight: 6),
          ),
          const SizedBox(height: StegSpacing.md),
          Row(
            children: [
              Expanded(
                child: _HeroCount(value: '$total', label: l10n.homeKpiTotal),
              ),
              Expanded(
                child: _HeroCount(value: '$done', label: l10n.homeKpiDone),
              ),
              Expanded(
                child: _HeroCount(
                  value: '$remaining',
                  label: l10n.homeKpiRemaining,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroCount extends StatelessWidget {
  const _HeroCount({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.labelSmall,
        ),
      ],
    );
  }
}
