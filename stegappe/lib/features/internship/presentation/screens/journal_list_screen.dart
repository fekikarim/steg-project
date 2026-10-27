import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/connectivity/connectivity_service.dart';
import '../../../../core/l10n/app_localizations.dart';
import '../../../../core/network/error_messages.dart';
import '../../../../core/network/paged.dart';
import '../../../../core/theme/steg_colors.dart';
import '../../../../core/theme/steg_motion.dart';
import '../../../../core/theme/steg_spacing.dart';
import '../../../../core/widgets/steg_dialog.dart';
import '../../../../core/widgets/steg_modern.dart';
import '../../../../core/widgets/steg_states.dart';
import '../../../../core/widgets/steg_status_chip.dart';
import '../../../auth/domain/entities/app_user.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../domain/entities/work_items.dart';
import '../providers/journal_calendar_providers.dart';
import '../providers/journal_document_providers.dart';
import '../providers/workspace_providers.dart';
import '../widgets/dashboard_sections.dart';
import '../widgets/journal_calendar_view.dart';
import '../widgets/status_labels.dart';
import 'journal_ai_generate_screen.dart';
import 'journal_composer_screen.dart';
import 'journal_detail_sheet.dart';
import '../../../../core/widgets/steg_skeleton.dart';

/// Journal tab: what the intern ACTUALLY did (never a substitute for
/// planned tasks). Day navigation filters server-side; status chips
/// refine; FAB opens the composer for the selected day.
class JournalListScreen extends ConsumerStatefulWidget {
  const JournalListScreen({super.key});

  @override
  ConsumerState<JournalListScreen> createState() => _JournalListScreenState();
}

class _JournalListScreenState extends ConsumerState<JournalListScreen> {
  /// Month currently painted by the calendar (independent from the selected
  /// day so the student can browse ahead without changing the list).
  late DateTime _month;

  /// The calendar is the screen's main surface; it can be folded away when a
  /// student just wants to read the day.
  bool _calendarOpen = true;

  @override
  void initState() {
    super.initState();
    final today = DateTime.now();
    _month = DateTime(today.year, today.month);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final async = ref.watch(journalListProvider);
    final isOnline = ref.watch(isOnlineProvider);
    final last = ref.watch(lastJournalProvider);
    final auth = ref.watch(authControllerProvider);
    final isIntern =
        auth is AuthAuthenticated && auth.user.mobileRole == UserRole.intern;
    final internshipId = ref.watch(myInternshipIdProvider).valueOrNull;
    final selected = ref.watch(selectedDayProvider);
    final accent = ref.watch(journalAccentProvider);
    final internship = ref.watch(internshipDetailProvider).valueOrNull;
    final monthEntries = ref.watch(journalMonthProvider(_month)).valueOrNull;

    void selectDay(DateTime day) =>
        ref.read(selectedDayProvider.notifier).state = DateTime(
          day.year,
          day.month,
          day.day,
        );

    return Stack(
      children: [
        RefreshIndicator(
          onRefresh: () async {
            ref
              ..invalidate(journalListProvider)
              ..invalidate(journalMonthProvider(_month));
            try {
              await ref.read(journalListProvider.future);
            } on Exception {
              // Error UI renders via the AsyncValue.
            }
          },
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              // Space for the fully transparent frosted top bar; the journal
              // scrolls beneath it.
              const SliverToBoxAdapter(
                child: StegGlassBarSpacer(extra: StegSpacing.sm),
              ),
              if (internship != null)
                SliverToBoxAdapter(
                  child: _JournalCalendarCard(
                    month: _month,
                    selected: selected,
                    start: internship.startDate,
                    end: internship.endDate,
                    accent: accent,
                    entries: monthEntries?.items ?? const [],
                    onSelect: selectDay,
                    onMonthChanged: (m) => setState(() => _month = m),
                    onToggleCalendar: () =>
                        setState(() => _calendarOpen = !_calendarOpen),
                    open: _calendarOpen,
                    onAccentChanged: (a) =>
                        ref.read(journalAccentProvider.notifier).set(a),
                  ),
                ),
              if (isIntern && internshipId != null)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      StegSpacing.md,
                      StegSpacing.sm,
                      StegSpacing.md,
                      0,
                    ),
                    child: _GenerateJournalWithAiButton(
                      internshipId: internshipId,
                    ),
                  ),
                ),
              const SliverToBoxAdapter(child: _StatusFilter()),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(
                  StegSpacing.md,
                  StegSpacing.sm,
                  StegSpacing.md,
                  StegSpacing.md,
                ),
                sliver: async.when(
                  loading: () => (last != null && !isOnline)
                      ? _JournalBody(page: last, showStale: true)
                      : const SliverFillRemaining(
                          hasScrollBody: false,
                          child: StegSkeletonList(rows: 5),
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
                    if (last != null) {
                      return _JournalBody(page: last, showStale: true);
                    }
                    return SliverFillRemaining(
                      hasScrollBody: false,
                      child: StegErrorView(
                        message: context.userError(e).message,
                        onRetry: () => ref.invalidate(journalListProvider),
                      ),
                    );
                  },
                  data: (page) {
                    if (page.items.isEmpty) {
                      if (last != null && !isOnline) {
                        return _JournalBody(page: last, showStale: true);
                      }
                      return SliverFillRemaining(
                        hasScrollBody: false,
                        child: StegEmptyView(
                          title: l10n.journalEmpty,
                          hint: l10n.journalWhatDid,
                          icon: Icons.book_outlined,
                        ),
                      );
                    }
                    return _JournalBody(page: page, showStale: !isOnline);
                  },
                ),
              ),
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 100 + MediaQuery.paddingOf(context).bottom,
                ),
              ),
            ],
          ),
        ),
        if (isIntern && internshipId != null)
          PositionedDirectional(
            end: StegSpacing.md,
            bottom: (MediaQuery.paddingOf(context).bottom > 0
                ? MediaQuery.paddingOf(context).bottom + 80
                : 96),
            child: Semantics(
              button: true,
              label: l10n.journalNew,
              child: FloatingActionButton(
                tooltip: l10n.journalNew,
                onPressed: () {
                  final day = ref.read(selectedDayProvider);
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => JournalComposerScreen(
                        internshipId: internshipId,
                        day: day,
                      ),
                    ),
                  );
                },
                child: const Icon(Icons.add),
              ),
            ),
          ),
      ],
    );
  }
}

/// Calendar surface: the month grid, the internship-period band and the
/// personalisation entry point, in one card.
class _JournalCalendarCard extends StatelessWidget {
  const _JournalCalendarCard({
    required this.month,
    required this.selected,
    required this.start,
    required this.end,
    required this.accent,
    required this.entries,
    required this.onSelect,
    required this.onMonthChanged,
    required this.onToggleCalendar,
    required this.open,
    required this.onAccentChanged,
  });

  final DateTime month;
  final DateTime selected;
  final DateTime start;
  final DateTime end;
  final JournalAccent accent;
  final List<JournalEntry> entries;
  final void Function(DateTime) onSelect;
  final void Function(DateTime) onMonthChanged;
  final VoidCallback onToggleCalendar;
  final bool open;
  final void Function(JournalAccent) onAccentChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final palette = JournalPalette.of(accent, Theme.of(context).brightness);

    // Days that already carry work → the calendar shows accomplishment at a
    // glance (one bounded month request, never one request per day).
    final marked = <DateTime>{
      for (final e in entries)
        DateTime(e.entryDate.year, e.entryDate.month, e.entryDate.day),
    };

    final total = end.difference(start).inDays + 1;
    final elapsed = DateTime.now().isBefore(start)
        ? 0
        : (DateTime.now().difference(start).inDays + 1).clamp(0, total);

    return Padding(
      // Horizontal padding is tight on purpose: 7 columns × 48 dp must fit a
      // 400 dp phone without shaving the touch targets.
      padding: const EdgeInsets.fromLTRB(
        StegSpacing.sm,
        StegSpacing.md,
        StegSpacing.sm,
        StegSpacing.sm,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: scheme.surface,
          borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
          border: Border.all(
            color: dark2(scheme)
                ? StegColors.darkBorder
                : StegColors.lightBorder,
          ),
          boxShadow: [
            BoxShadow(
              color: palette.seed.withValues(alpha: 0.12),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: StegSpacing.sm,
          vertical: StegSpacing.sm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(colors: palette.legendGradient),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.calendar_month_rounded,
                    color: Colors.white,
                    size: 20,
                  ),
                ),
                const SizedBox(width: StegSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        l10n.journalCalendar,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      Text(
                        l10n.journalPeriodOverview('$elapsed', '$total'),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                Semantics(
                  button: true,
                  label: l10n.journalAccent,
                  child: IconButton(
                    tooltip: l10n.journalAccent,
                    onPressed: () => _showAccentSheet(context),
                    icon: Container(
                      width: 20,
                      height: 20,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: palette.legendGradient,
                        ),
                      ),
                    ),
                  ),
                ),
                IconButton(
                  tooltip: open
                      ? l10n.journalCalendarHide
                      : l10n.journalCalendarShow,
                  onPressed: onToggleCalendar,
                  icon: Icon(
                    open
                        ? Icons.expand_less_rounded
                        : Icons.expand_more_rounded,
                  ),
                ),
              ],
            ),
            AnimatedSize(
              duration: StegMotion.fast,
              curve: StegMotion.standard,
              alignment: AlignmentDirectional.topCenter,
              child: open
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(height: StegSpacing.sm),
                        JournalMonthCalendar(
                          month: month,
                          selected: selected,
                          start: start,
                          end: end,
                          accent: accent,
                          markedDays: marked,
                          onSelect: onSelect,
                          onMonthChanged: onMonthChanged,
                        ),
                      ],
                    )
                  : const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }

  static bool dark2(ColorScheme scheme) => scheme.brightness == Brightness.dark;

  /// Personalisation sheet: the period colour is a stored preference, kept
  /// out of the card so the calendar stays compact and the day list keeps its
  /// room.
  void _showAccentSheet(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    showStegSheet<void>(
      context,
      title: l10n.journalAccent,
      builder: (ctx) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.journalAccentHint,
            style: Theme.of(ctx).textTheme.bodyMedium,
          ),
          const SizedBox(height: StegSpacing.md),
          for (final a in JournalAccent.values)
            Padding(
              padding: const EdgeInsets.only(bottom: StegSpacing.sm),
              child: Semantics(
                button: true,
                selected: a == accent,
                label: l10n.journalAccent,
                excludeSemantics: true,
                child: InkWell(
                  onTap: () {
                    Navigator.of(ctx).pop();
                    onAccentChanged(a);
                  },
                  borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      vertical: StegSpacing.sm,
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 34,
                          height: 34,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: LinearGradient(colors: [a.seed, a.tint]),
                          ),
                        ),
                        const SizedBox(width: StegSpacing.sm),
                        Expanded(
                          child: Text(
                            a.name,
                            style: Theme.of(ctx).textTheme.bodyLarge,
                          ),
                        ),
                        if (a == accent)
                          Icon(
                            Icons.check_circle,
                            color: Theme.of(ctx).colorScheme.primary,
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Status refinement on top of the day selection (server-side `?status=`).
class _GenerateJournalWithAiButton extends ConsumerWidget {
  const _GenerateJournalWithAiButton({required this.internshipId});

  final String internshipId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: () {
          ref.read(journalEntriesProvider.notifier).reset();
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => JournalAiGenerateScreen(
                internshipId: internshipId,
                autoStart: true,
              ),
            ),
          );
        },
        icon: const Icon(Icons.auto_awesome, size: 18),
        label: Text(l10n.journalAiGenTitle),
      ),
    );
  }
}

class _StatusFilter extends ConsumerWidget {
  const _StatusFilter();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final filter = ref.watch(journalStatusFilterProvider);
    final options = <JournalStatus?>[
      null,
      JournalStatus.draft,
      JournalStatus.submitted,
      JournalStatus.validated,
      JournalStatus.rejected,
    ];
    String label(JournalStatus? s) =>
        s == null ? l10n.filterAll : journalStatusLabel(s, l10n);
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: StegSpacing.md),
      child: Row(
        children: [
          for (final o in options) ...[
            ChoiceChip(
              label: Text(label(o)),
              selected: filter == o,
              onSelected: (_) =>
                  ref.read(journalStatusFilterProvider.notifier).state = o,
            ),
            const SizedBox(width: StegSpacing.xs),
          ],
        ],
      ),
    );
  }
}

/// Cached list body with explicit stale labeling (offline audit).
class _JournalBody extends StatelessWidget {
  const _JournalBody({required this.page, required this.showStale});

  final Paged<JournalEntry> page;
  final bool showStale;

  @override
  Widget build(BuildContext context) {
    return SliverMainAxisGroup(
      slivers: [
        if (showStale)
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.only(bottom: StegSpacing.sm),
              child: StaleNotice(),
            ),
          ),
        SliverList(
          delegate: SliverChildBuilderDelegate((ctx, i) {
            final j = page.items[i];
            return _EntryCard(entry: j);
          }, childCount: page.items.length),
        ),
      ],
    );
  }
}

class _EntryCard extends StatelessWidget {
  const _EntryCard({required this.entry});

  final JournalEntry entry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context);
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      margin: const EdgeInsetsDirectional.only(bottom: StegSpacing.sm),
      decoration: BoxDecoration(
        color: dark ? StegColors.darkSurface : StegColors.lightSurface,
        borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
        border: Border.all(
          color: dark ? StegColors.darkBorder : StegColors.lightBorder,
          width: 1,
        ),
        boxShadow: dark
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.25),
                  blurRadius: 14,
                  offset: const Offset(0, 4),
                ),
              ]
            : [
                BoxShadow(
                  color: StegColors.brandNavy.withValues(alpha: 0.05),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
        child: InkWell(
          borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
          onTap: () => showJournalDetailSheet(context, entry),
          child: Padding(
            padding: const EdgeInsets.all(StegSpacing.md),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: StegColors.brandGradientBright,
                      begin: AlignmentDirectional.topStart,
                      end: AlignmentDirectional.bottomEnd,
                    ),
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: StegColors.brandPrimary.withValues(alpha: 0.35),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.edit_note_outlined,
                    color: Colors.white,
                    size: 20,
                  ),
                ),
                const SizedBox(width: StegSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        entry.title.isEmpty ? '—' : entry.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${formatDay(entry.entryDate, locale)}'
                        '${entry.description?.isNotEmpty == true ? ' • ${entry.description!}' : ''}',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: dark
                              ? StegColors.darkTextSecondary
                              : StegColors.lightTextSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: StegSpacing.sm),
                StegStatusChip(
                  label: journalStatusLabel(entry.status, l10n),
                  kind: journalStatusKind(entry.status),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
