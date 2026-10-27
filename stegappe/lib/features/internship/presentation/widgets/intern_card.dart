import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/app_localizations.dart';
import '../../../../core/theme/steg_colors.dart';
import '../../../../core/theme/steg_spacing.dart';
import '../../../../core/widgets/steg_fields.dart';
import '../../../../core/widgets/steg_status_chip.dart';
import '../../../messaging/presentation/providers/messaging_providers.dart';
import '../../../messaging/presentation/screens/chat_screen.dart';
import '../../domain/entities/evaluation.dart';
import '../screens/intern_detail_screen.dart';
import '../widgets/status_labels.dart';

/// Supervised-intern card (STEG design): identity, attention chip, three
/// stats (tasks, progress, end of internship), a progress bar and two actions.
///
/// "Contacter" opens the existing conversation with this intern. The app has
/// no endpoint that creates conversations, so when none exists the card says
/// so instead of inventing one. With [onSelectionChanged] the card becomes a
/// selectable row for the notify-preparation multi-select.
class InternCard extends ConsumerWidget {
  const InternCard({
    super.key,
    required this.intern,
    this.selected = false,
    this.onSelectionChanged,
  });

  final SupervisedIntern intern;
  final bool selected;
  final ValueChanged<bool>? onSelectionChanged;

  void _openFile(BuildContext context) => Navigator.of(context).push(
    MaterialPageRoute(
      builder: (_) => InternDetailScreen(internshipId: intern.internshipId),
    ),
  );

  Future<void> _contact(BuildContext context, WidgetRef ref) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final conversations = await ref.read(conversationsProvider.future);
    if (!context.mounted) return;
    final matches = conversations.where(
      (c) => c.internshipId == intern.internshipId,
    );
    if (matches.isEmpty) {
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.internCardNoConversation)),
      );
      return;
    }
    final match = matches.first;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) =>
            ChatScreen(conversationId: match.id, title: intern.internName),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context);
    final dark = Theme.of(context).brightness == Brightness.dark;
    final selectable = onSelectionChanged != null;
    final isSelected = selected && selectable;
    final theme = Theme.of(context);
    final progress = intern.tasksTotal == 0
        ? 0.0
        : (intern.tasksCompleted / intern.tasksTotal).clamp(0.0, 1.0);
    final percent = (progress * 100).round();
    final toProcess = intern.pendingJournal + intern.pendingDeliverables;

    return Padding(
      padding: const EdgeInsets.only(bottom: StegSpacing.md),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
          onTap: selectable
              ? () => onSelectionChanged?.call(!selected)
              : () => _openFile(context),
          child: Container(
            padding: const EdgeInsets.all(StegSpacing.md),
            decoration: BoxDecoration(
              color: isSelected
                  ? theme.colorScheme.primary.withValues(
                      alpha: dark ? 0.18 : 0.07,
                    )
                  : (dark ? StegColors.darkSurface : Colors.white),
              borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
              border: Border.all(
                color: isSelected
                    ? theme.colorScheme.primary.withValues(alpha: 0.4)
                    : (dark ? StegColors.darkBorder : StegColors.lightBorder),
                width: isSelected ? 1.5 : 1,
              ),
              boxShadow: StegColors.cardShadow(dark),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    if (selectable)
                      Checkbox(
                        value: selected,
                        onChanged: (v) => onSelectionChanged?.call(v ?? false),
                      )
                    else
                      _InitialsTile(name: intern.internName),
                    const SizedBox(width: StegSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            intern.internName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            '${BidiText.isolate(intern.reference)} • '
                            '${intern.departmentName}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.bodySmall,
                          ),
                          const SizedBox(height: StegSpacing.xs),
                          intern.needsAttention
                              ? StegStatusChip(
                                  label:
                                      '$toProcess ${l10n.internCardToProcess}',
                                  kind: StegStatusKind.warning,
                                )
                              : StegStatusChip(
                                  label: internshipStatusLabel(
                                    intern.status,
                                    l10n,
                                  ),
                                  kind: internshipStatusKind(intern.status),
                                ),
                        ],
                      ),
                    ),
                    if (!selectable)
                      Icon(
                        Icons.chevron_right,
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                  ],
                ),
                const SizedBox(height: StegSpacing.md),
                Row(
                  children: [
                    Expanded(
                      child: _Stat(
                        value: '${intern.tasksTotal}',
                        label: l10n.internCardTasks,
                      ),
                    ),
                    Expanded(
                      child: _Stat(
                        value: '$percent%',
                        label: l10n.internCardProgress,
                      ),
                    ),
                    Expanded(
                      child: _Stat(
                        value: formatDay(intern.endDate, locale),
                        label: l10n.internCardEnd,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: StegSpacing.sm),
                ClipRRect(
                  borderRadius: BorderRadius.circular(StegSpacing.radiusFull),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 6,
                    backgroundColor: dark
                        ? StegColors.darkTrack
                        : StegColors.lightTrack,
                    color: StegColors.brandPrimary,
                  ),
                ),
                if (!selectable) ...[
                  const SizedBox(height: StegSpacing.md),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size.fromHeight(44),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(
                                StegSpacing.radiusMd,
                              ),
                            ),
                          ),
                          onPressed: () => _contact(context, ref),
                          icon: const Icon(Icons.chat_bubble_outline, size: 18),
                          label: Text(l10n.internCardContact),
                        ),
                      ),
                      const SizedBox(width: StegSpacing.sm),
                      Expanded(
                        child: TextButton(
                          style: TextButton.styleFrom(
                            minimumSize: const Size.fromHeight(44),
                          ),
                          onPressed: () => _openFile(context),
                          child: Text(l10n.internCardFollow),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _InitialsTile extends StatelessWidget {
  const _InitialsTile({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final initials = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .take(2)
        .map((p) => p[0].toUpperCase())
        .join();
    return Container(
      width: 52,
      height: 52,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: StegColors.brandPrimary.withValues(alpha: dark ? 0.25 : 0.12),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(
        initials.isEmpty ? '?' : initials,
        style: TextStyle(
          color: dark ? Colors.white : StegColors.brandNavy,
          fontWeight: FontWeight.w800,
          fontSize: 16,
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});

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
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: theme.textTheme.titleSmall?.copyWith(
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
