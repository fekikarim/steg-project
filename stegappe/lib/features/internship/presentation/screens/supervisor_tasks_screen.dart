import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/connectivity/connectivity_service.dart';
import '../../../../core/l10n/app_localizations.dart';
import '../../../../core/network/error_messages.dart';
import '../../../../core/offline/pending_writes.dart';
import '../../../../core/realtime/realtime_sync.dart';
import '../../../../core/theme/steg_colors.dart';
import '../../../../core/theme/steg_spacing.dart';
import '../../../../core/widgets/steg_button.dart';
import '../../../../core/widgets/steg_dialog.dart';
import '../../../../core/widgets/steg_fields.dart';
import '../../../../core/widgets/steg_modern.dart';
import '../../../../core/widgets/steg_skeleton.dart';
import '../../../../core/widgets/steg_states.dart';
import '../../../../core/widgets/steg_status_chip.dart';
import '../../domain/entities/evaluation.dart';
import '../../domain/entities/work_items.dart';
import '../../domain/schedule.dart';
import '../providers/supervisor_tasks_providers.dart';
import '../providers/workspace_providers.dart';
import '../widgets/dashboard_sections.dart';
import '../widgets/status_labels.dart';
import 'bulk_task_sheet.dart';
import 'task_drafts_screen.dart';
import 'task_editor_sheet.dart';

/// Status filter for the supervisor board. "To approve" is the review queue.
enum _TaskFilter { all, todo, inProgress, awaitingApproval, approved }

bool _matchesFilter(_TaskFilter filter, TaskStatus status) => switch (filter) {
  _TaskFilter.all => true,
  _TaskFilter.todo => status == TaskStatus.todo,
  _TaskFilter.inProgress => status == TaskStatus.inProgress,
  _TaskFilter.awaitingApproval => status == TaskStatus.awaitingApproval,
  _TaskFilter.approved => status == TaskStatus.approved,
};

/// Supervisor task management (SU-TASK-01/03/04, SU-HOME-01).
///
/// Shows the tasks of every supervised intern, merged from the backend. The
/// search, status filter and intern filter work on that loaded board. Tasks
/// awaiting review can be approved or denied with a required reason; any task
/// can be edited or deleted. Creation and bulk assignment open the existing
/// sheets. The backend enforces scope and transitions on every write.
class SupervisorTasksScreen extends ConsumerStatefulWidget {
  const SupervisorTasksScreen({super.key, this.initialInternshipId});

  final String? initialInternshipId;

  @override
  ConsumerState<SupervisorTasksScreen> createState() =>
      _SupervisorTasksScreenState();
}

class _SupervisorTasksScreenState extends ConsumerState<SupervisorTasksScreen>
    with WidgetsBindingObserver {
  final _searchController = TextEditingController();
  String _query = '';
  _TaskFilter _filter = _TaskFilter.all;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _searchController.dispose();
    super.dispose();
  }

  /// T06 §10: resync the supervised lists when the app returns.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(realtimeSyncProvider).invalidate(RealtimeCategory.tasks);
      _flushQueued();
    }
  }

  /// Best-effort flush; failures stay queued for the next trigger.
  Future<void> _flushQueued() async {
    try {
      await ref.read(pendingWritesProvider.notifier).flushAll();
    } on Exception {
      // Next trigger retries; the queue persists.
    }
  }

  Future<void> _refresh() async {
    ref
      ..invalidate(supervisedInternsProvider)
      ..invalidate(supervisorTasksProvider);
    try {
      await ref.read(supervisorTasksProvider.future);
    } on Exception {
      // Error UI renders from the AsyncValue.
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final internsAsync = ref.watch(supervisedInternsProvider);
    final isOnline = ref.watch(isOnlineProvider);
    final interns = internsAsync.valueOrNull ?? const <SupervisedIntern>[];
    final watched =
        ref.watch(selectedSupervisedInternshipProvider) ??
        widget.initialInternshipId;

    return ColoredBox(
      color: Theme.of(context).scaffoldBackgroundColor,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Space for the transparent frosted top bar of the shell.
          const StegGlassBarSpacer(),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: StegSpacing.md),
            child: _Header(
              isOnline: isOnline,
              interns: interns,
              watchedId: watched,
              onRefreshed: _refresh,
            ),
          ),
          const SizedBox(height: StegSpacing.sm),
          if (!isOnline)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: StegSpacing.md),
              child: Padding(
                padding: EdgeInsets.only(bottom: StegSpacing.sm),
                child: StaleNotice(),
              ),
            ),
          Expanded(
            child: internsAsync.when(
              loading: () => const StegSkeletonList(rows: 5),
              error: (e, _) => StegErrorView(
                message: context.userError(e).message,
                onRetry: () => ref.invalidate(supervisedInternsProvider),
              ),
              data: (list) {
                if (list.isEmpty) {
                  return StegEmptyView(
                    title: l10n.supNoStudents,
                    hint: l10n.supNoStudentsHint,
                    icon: Icons.school_outlined,
                  );
                }
                return _BoardBody(
                  interns: list,
                  watchedId: watched,
                  isOnline: isOnline,
                  query: _query,
                  filter: _filter,
                  searchController: _searchController,
                  onQueryChanged: (v) => setState(() => _query = v),
                  onFilterChanged: (f) => setState(() => _filter = f),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// Title, active-task count and the header actions: AI drafts, bulk add and
/// the new-task button.
class _Header extends ConsumerWidget {
  const _Header({
    required this.isOnline,
    required this.interns,
    required this.watchedId,
    required this.onRefreshed,
  });

  final bool isOnline;
  final List<SupervisedIntern> interns;
  final String? watchedId;
  final Future<void> Function() onRefreshed;

  String? _targetIntern() {
    if (interns.isEmpty) return null;
    if (watchedId != null && interns.any((i) => i.internshipId == watchedId)) {
      return watchedId;
    }
    return interns.first.internshipId;
  }

  Future<void> _newTask(BuildContext context, WidgetRef ref) async {
    String? id = watchedId;
    if (id == null || !interns.any((i) => i.internshipId == id)) {
      id = interns.length == 1
          ? interns.first.internshipId
          : await _pickIntern(context, interns);
    }
    if (id == null || !context.mounted) return;
    await TaskEditorSheet.show(context, internshipId: id, staffMode: true);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final board = ref.watch(supervisorTasksProvider).valueOrNull;
    final active = board?.items
        .where(
          (s) => s.task.isOpen || s.task.awaitsReview || s.task.needsAttention,
        )
        .length;
    final subtitle = active == null ? null : l10n.tasksActiveCount(active);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.tasksManageTitle,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              if (subtitle != null)
                Text(subtitle, style: theme.textTheme.bodySmall),
            ],
          ),
        ),
        _HeaderIcon(
          icon: Icons.auto_awesome_outlined,
          tooltip: l10n.aiDraftTitle,
          onPressed: !isOnline || interns.isEmpty
              ? null
              : () {
                  final id = _targetIntern();
                  if (id == null) return;
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) =>
                          TaskDraftsScreen(referenceInternshipId: id),
                    ),
                  );
                },
        ),
        const SizedBox(width: StegSpacing.xs),
        _HeaderIcon(
          icon: Icons.group_add_outlined,
          tooltip: l10n.supBulkTitle,
          onPressed: !isOnline || interns.isEmpty
              ? null
              : () => BulkTaskSheet.show(context),
        ),
        const SizedBox(width: StegSpacing.xs),
        Semantics(
          button: true,
          label: l10n.supTaskNew,
          enabled: isOnline && interns.isNotEmpty,
          child: Material(
            color: dark ? StegColors.darkElevated : StegColors.brandNavy,
            borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
            child: InkWell(
              borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
              onTap: !isOnline || interns.isEmpty
                  ? null
                  : () => _newTask(context, ref),
              child: const SizedBox(
                width: StegSpacing.minTouchTarget,
                height: StegSpacing.minTouchTarget,
                child: Icon(Icons.add, color: Colors.white),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _HeaderIcon extends StatelessWidget {
  const _HeaderIcon({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Tooltip(
      message: tooltip,
      child: Material(
        color: dark ? StegColors.darkSurface : Colors.white,
        borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
        child: InkWell(
          borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
          onTap: onPressed,
          child: Container(
            width: StegSpacing.minTouchTarget,
            height: StegSpacing.minTouchTarget,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
              border: Border.all(
                color: dark ? StegColors.darkBorder : StegColors.lightBorder,
              ),
            ),
            child: Icon(
              icon,
              size: 20,
              color: onPressed == null
                  ? Theme.of(context).disabledColor
                  : Theme.of(context).colorScheme.primary,
            ),
          ),
        ),
      ),
    );
  }
}

/// Search, filters and the merged task list for the loaded board.
class _BoardBody extends ConsumerWidget {
  const _BoardBody({
    required this.interns,
    required this.watchedId,
    required this.isOnline,
    required this.query,
    required this.filter,
    required this.searchController,
    required this.onQueryChanged,
    required this.onFilterChanged,
  });

  final List<SupervisedIntern> interns;
  final String? watchedId;
  final bool isOnline;
  final String query;
  final _TaskFilter filter;
  final TextEditingController searchController;
  final ValueChanged<String> onQueryChanged;
  final ValueChanged<_TaskFilter> onFilterChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final async = ref.watch(supervisorTasksProvider);
    final last = ref.watch(lastSupervisorTasksProvider);
    final controller = ref.watch(supervisorTaskControllerProvider);

    if (controller.error != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(context.userError(controller.error!).message),
            ),
          );
          ref.read(supervisorTaskControllerProvider.notifier).clearError();
        }
      });
    }

    final board = async.valueOrNull ?? (!isOnline ? last : null);
    final loading = board == null && async.isLoading;
    if (loading) return const StegSkeletonList(rows: 5);
    if (board == null) {
      final error = async.error;
      if (error is StateError && error.message == 'no-internship') {
        return StegEmptyView(
          title: l10n.supNoStudents,
          hint: l10n.supNoStudentsHint,
        );
      }
      return StegErrorView(
        message: context.userError(error ?? Exception('tasks')).message,
        onRetry: () => ref.invalidate(supervisorTasksProvider),
      );
    }

    final counts = {
      for (final f in _TaskFilter.values)
        f: board.items.where((s) => _matchesFilter(f, s.task.status)).length,
    };
    final visible = _visible(board.items);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: StegSpacing.md),
          child: TextField(
            controller: searchController,
            onChanged: onQueryChanged,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: l10n.tasksSearchHint,
              prefixIcon: const Icon(Icons.search),
              filled: true,
              fillColor: Theme.of(context).brightness == Brightness.dark
                  ? StegColors.darkSurface
                  : Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
                borderSide: BorderSide(
                  color: Theme.of(context).brightness == Brightness.dark
                      ? StegColors.darkBorder
                      : StegColors.lightBorder,
                ),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
                borderSide: BorderSide(
                  color: Theme.of(context).brightness == Brightness.dark
                      ? StegColors.darkBorder
                      : StegColors.lightBorder,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: StegSpacing.sm),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: StegSpacing.md),
          child: Row(
            children: [
              for (final f in _TaskFilter.values) ...[
                _FilterPill(
                  label: _filterLabel(f, l10n),
                  count: counts[f] ?? 0,
                  selected: filter == f,
                  onTap: () => onFilterChanged(f),
                ),
                const SizedBox(width: StegSpacing.xs),
              ],
            ],
          ),
        ),
        if (interns.length > 1) ...[
          const SizedBox(height: StegSpacing.xs),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: StegSpacing.md),
            child: Row(
              children: [
                ChoiceChip(
                  materialTapTargetSize: MaterialTapTargetSize.padded,
                  label: Text(l10n.tasksAllInterns),
                  selected: watchedId == null,
                  onSelected: (_) =>
                      ref
                              .read(
                                selectedSupervisedInternshipProvider.notifier,
                              )
                              .state =
                          null,
                ),
                const SizedBox(width: StegSpacing.xs),
                for (final intern in interns) ...[
                  ChoiceChip(
                    materialTapTargetSize: MaterialTapTargetSize.padded,
                    label: Text(intern.internName),
                    selected: intern.internshipId == watchedId,
                    onSelected: (_) =>
                        ref
                            .read(selectedSupervisedInternshipProvider.notifier)
                            .state = intern
                            .internshipId,
                  ),
                  const SizedBox(width: StegSpacing.xs),
                ],
              ],
            ),
          ),
        ],
        if (board.truncated)
          Padding(
            padding: const EdgeInsets.fromLTRB(
              StegSpacing.md,
              StegSpacing.sm,
              StegSpacing.md,
              0,
            ),
            child: _PartialLoadNotice(
              text: l10n.tasksTruncated(
                board.items.length,
                board.totalElements,
              ),
            ),
          ),
        const SizedBox(height: StegSpacing.sm),
        Expanded(
          child: board.items.isEmpty
              ? RefreshIndicator(
                  onRefresh: () async =>
                      ref.invalidate(supervisorTasksProvider),
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      SizedBox(
                        height: 280,
                        child: StegEmptyView(
                          title: l10n.tasksEmpty,
                          hint: l10n.tasksEmptyHint,
                          icon: Icons.checklist_outlined,
                        ),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () async =>
                      ref.invalidate(supervisorTasksProvider),
                  child: visible.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            Padding(
                              padding: const EdgeInsets.all(StegSpacing.lg),
                              child: Text(
                                l10n.tasksNoMatch,
                                textAlign: TextAlign.center,
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                            ),
                          ],
                        )
                      : ListView.builder(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.fromLTRB(
                            StegSpacing.md,
                            0,
                            StegSpacing.md,
                            96,
                          ),
                          itemCount: visible.length,
                          itemBuilder: (context, i) => _SupervisorTaskCard(
                            item: visible[i],
                            isOnline: isOnline,
                          ),
                        ),
                ),
        ),
      ],
    );
  }

  /// Filters by status, then by the search text over title, description and
  /// intern name. Needs-review first, then denied, to do, in progress, rest.
  List<SupervisedTask> _visible(List<SupervisedTask> all) {
    final q = query.trim().toLowerCase();
    final matched = [
      for (final s in all)
        if (_matchesFilter(filter, s.task.status) &&
            (q.isEmpty ||
                s.task.title.toLowerCase().contains(q) ||
                (s.task.description ?? '').toLowerCase().contains(q) ||
                s.internName.toLowerCase().contains(q)))
          s,
    ];
    int rank(TaskStatus status) => switch (status) {
      TaskStatus.awaitingApproval => 0,
      TaskStatus.denied => 1,
      TaskStatus.todo => 2,
      TaskStatus.inProgress => 3,
      _ => 4,
    };
    matched.sort((a, b) {
      final r = rank(a.task.status).compareTo(rank(b.task.status));
      if (r != 0) return r;
      final due = _compareDue(a.task, b.task);
      return due != 0 ? due : a.task.title.compareTo(b.task.title);
    });
    return matched;
  }

  static int _compareDue(InternTask a, InternTask b) {
    if (a.dueDate == null && b.dueDate == null) return 0;
    if (a.dueDate == null) return 1;
    if (b.dueDate == null) return -1;
    return a.dueDate!.compareTo(b.dueDate!);
  }

  static String _filterLabel(_TaskFilter f, AppLocalizations l10n) =>
      switch (f) {
        _TaskFilter.all => l10n.tasksFilterAll,
        _TaskFilter.todo => l10n.tsTodo,
        _TaskFilter.inProgress => l10n.tsInProgress,
        _TaskFilter.awaitingApproval => l10n.tasksFilterReview,
        _TaskFilter.approved => l10n.tsApproved,
      };
}

class _FilterPill extends StatelessWidget {
  const _FilterPill({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final fg = selected
        ? Colors.white
        : (dark ? StegColors.darkTextPrimary : StegColors.lightTextPrimary);
    final bg = selected
        ? (dark ? StegColors.brandPrimary : StegColors.brandNavy)
        : (dark ? StegColors.darkSurface : Colors.white);
    return Semantics(
      button: true,
      selected: selected,
      label: '$label, $count',
      excludeSemantics: true,
      child: Material(
        color: bg,
        shape: StadiumBorder(
          side: BorderSide(
            color: selected
                ? Colors.transparent
                : (dark ? StegColors.darkBorder : StegColors.lightBorder),
          ),
        ),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: onTap,
          child: SizedBox(
            height: StegSpacing.minTouchTarget,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: StegSpacing.md),
              child: Center(
                child: Text(
                  '$label  $count',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: fg,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PartialLoadNotice extends StatelessWidget {
  const _PartialLoadNotice({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final fg = dark ? StegColors.warningDark : StegColors.warning;
    return Container(
      padding: const EdgeInsets.all(StegSpacing.sm),
      decoration: BoxDecoration(
        color: fg.withValues(alpha: dark ? 0.14 : 0.08),
        borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
        border: Border.all(color: fg.withValues(alpha: 0.35)),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodySmall
            ?.copyWith(color: fg, fontWeight: FontWeight.w700),
      ),
    );
  }
}

/// One task. Status and attention chips on top, the title and description,
/// the denial reason when there is one, then the assignee and due date with
/// the review and edit/delete actions below.
class _SupervisorTaskCard extends ConsumerWidget {
  const _SupervisorTaskCard({required this.item, required this.isOnline});

  final SupervisedTask item;
  final bool isOnline;

  InternTask get task => item.task;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final locale = Localizations.localeOf(context);
    final now = DateTime.now();
    final busy = ref.watch(supervisorTaskControllerProvider).busy;
    final scheduled = task.isScheduled(now);
    final denial = task.denialReason;
    final description = task.description?.trim();

    return Semantics(
      label: '${task.title}, ${taskStatusLabel(task.status, l10n)}',
      child: Container(
        margin: const EdgeInsets.only(bottom: StegSpacing.sm),
        padding: const EdgeInsets.all(StegSpacing.md),
        decoration: BoxDecoration(
          color: dark ? StegColors.darkSurface : Colors.white,
          borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
          border: Border.all(
            color: dark ? StegColors.darkBorder : StegColors.lightBorder,
          ),
          boxShadow: StegColors.cardShadow(dark),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Wrap(
                    spacing: StegSpacing.xs,
                    runSpacing: StegSpacing.xxs,
                    children: [
                      if (task.awaitsReview)
                        StegStatusChip(
                          label: l10n.supNeedsReview,
                          kind: StegStatusKind.warning,
                        ),
                      if (scheduled)
                        StegStatusChip(
                          label:
                              '${l10n.supScheduled} • ${l10n.supAppearsOn(_formatAppears(task.visibleFrom!, locale))}',
                          kind: StegStatusKind.info,
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: StegSpacing.xs),
                // Flexible so a long status label ellipsises instead of
                // squeezing the title out of the row at large text scales.
                Flexible(
                  child: StegStatusChip(
                    label: taskStatusLabel(task.status, l10n),
                    kind: taskStatusKind(
                      task.status,
                      overdue: task.isOverdue(now),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: StegSpacing.sm),
            Text(
              task.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            if (description != null && description.isNotEmpty) ...[
              const SizedBox(height: StegSpacing.xxs),
              Text(
                description,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodySmall,
              ),
            ],
            if (denial != null) ...[
              const SizedBox(height: StegSpacing.sm),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(StegSpacing.sm),
                decoration: BoxDecoration(
                  color: StegColors.error.withValues(alpha: dark ? 0.16 : 0.07),
                  borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
                ),
                child: Text(
                  '${l10n.tasksDenialReason} : $denial',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: dark ? StegColors.errorDark : StegColors.error,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
            const SizedBox(height: StegSpacing.sm),
            Row(
              children: [
                _InitialsBadge(name: item.internName),
                const SizedBox(width: StegSpacing.xs),
                Expanded(
                  child: Text(
                    item.internName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall,
                  ),
                ),
              ],
            ),
            const Divider(height: StegSpacing.lg),
            Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: StegSpacing.xs,
              runSpacing: StegSpacing.xxs,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.event_outlined,
                      size: 16,
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                    const SizedBox(width: StegSpacing.xxs),
                    Text(
                      task.dueDate == null
                          ? l10n.tasksNoDueDate
                          : formatDay(task.dueDate!, locale),
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
                Wrap(
                  spacing: StegSpacing.xxs,
                  runSpacing: StegSpacing.xxs,
                  children: [
                    if (task.awaitsReview) ...[
                      StegButton(
                        label: l10n.supReviewApprove,
                        icon: Icons.check,
                        loading: busy,
                        onPressed: !isOnline || busy
                            ? null
                            : () => _review(context, ref, true),
                      ),
                      StegButton(
                        label: l10n.supReviewDeny,
                        variant: StegButtonVariant.secondary,
                        icon: Icons.close,
                        onPressed: !isOnline || busy
                            ? null
                            : () => _review(context, ref, false),
                      ),
                    ],
                    StegButton(
                      label: l10n.supTaskEdit,
                      variant: StegButtonVariant.text,
                      icon: Icons.edit_outlined,
                      onPressed: !isOnline || busy
                          ? null
                          : () => TaskEditorSheet.show(
                              context,
                              internshipId: item.internshipId,
                              existing: task,
                              staffMode: true,
                            ),
                    ),
                    StegButton(
                      label: l10n.supTaskDelete,
                      variant: StegButtonVariant.text,
                      icon: Icons.delete_outline,
                      onPressed: !isOnline || busy
                          ? null
                          : () => _delete(context, ref),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _review(
    BuildContext context,
    WidgetRef ref,
    bool approve,
  ) async {
    final l10n = AppLocalizations.of(context);
    String? reason;
    if (!approve) {
      reason = await showDialog<String>(
        context: context,
        builder: (ctx) {
          final controller = TextEditingController();
          String? error;
          return StatefulBuilder(
            builder: (ctx, setState) => AlertDialog(
              title: Text(l10n.supReviewTitle),
              content: StegTextField(
                controller: controller,
                label: l10n.supDenyReasonLabel,
                hint: l10n.supDenyReasonHint,
                error: error,
                textInputAction: TextInputAction.done,
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: Text(l10n.cancelAction),
                ),
                StegButton(
                  label: l10n.supReviewDeny,
                  variant: StegButtonVariant.destructive,
                  onPressed: () {
                    if (controller.text.trim().isEmpty) {
                      setState(() => error = l10n.errReviewReason);
                      return;
                    }
                    Navigator.of(ctx).pop(controller.text.trim());
                  },
                ),
              ],
            ),
          );
        },
      );
      if (reason == null || !context.mounted) return;
    }
    final decided = await ref
        .read(supervisorTaskControllerProvider.notifier)
        .reviewTask(
          task.id,
          item.internshipId,
          approve: approve,
          comment: reason,
        );
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            decided == null
                ? context
                      .userError(
                        ref.read(supervisorTaskControllerProvider).error ??
                            Exception('review-failed'),
                      )
                      .message
                : (approve ? l10n.supReviewApproved : l10n.supReviewDenied),
          ),
        ),
      );
    }
  }

  Future<void> _delete(BuildContext context, WidgetRef ref) async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showStegConfirmDialog(
      context,
      title: l10n.supTaskDeleteTitle,
      message: l10n.supTaskDeleteConfirm(task.title, item.internName),
      confirmLabel: l10n.supTaskDelete,
      destructive: true,
    );
    if (!confirmed || !context.mounted) return;
    final ok = await ref
        .read(supervisorTaskControllerProvider.notifier)
        .deleteTask(task.id, item.internshipId);
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            ok
                ? l10n.supTaskDeleted
                : context
                      .userError(
                        ref.read(supervisorTaskControllerProvider).error ??
                            Exception('delete-failed'),
                      )
                      .message,
          ),
        ),
      );
    }
  }
}

class _InitialsBadge extends StatelessWidget {
  const _InitialsBadge({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    final initials = name
        .trim()
        .split(RegExp(r'\s+'))
        .take(2)
        .map((p) => p.isEmpty ? '' : p[0].toUpperCase())
        .join();
    return Container(
      width: 28,
      height: 28,
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
          fontSize: 11,
        ),
      ),
    );
  }
}

/// Picks the intern a new task is created for when several are supervised.
Future<String?> _pickIntern(
  BuildContext context,
  List<SupervisedIntern> interns,
) {
  final l10n = AppLocalizations.of(context);
  return showModalBottomSheet<String>(
    context: context,
    showDragHandle: true,
    builder: (ctx) => SafeArea(
      child: ListView(
        shrinkWrap: true,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              StegSpacing.md,
              0,
              StegSpacing.md,
              StegSpacing.sm,
            ),
            child: Text(
              l10n.tasksPickIntern,
              style: Theme.of(ctx).textTheme.titleMedium,
            ),
          ),
          for (final intern in interns)
            ListTile(
              title: Text(intern.internName),
              subtitle: Text(intern.departmentName),
              onTap: () => Navigator.of(ctx).pop(intern.internshipId),
            ),
        ],
      ),
    ),
  );
}

String _formatAppears(DateTime instant, Locale locale) {
  final wall = tunisWallFromInstant(instant);
  final tag = locale.toString();
  return '${formatDay(wall, locale)} ${DateFormat.Hm(tag).format(wall)}';
}
