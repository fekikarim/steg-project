import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/app_localizations.dart';
import '../../../../core/theme/steg_colors.dart';
import '../../../../core/theme/steg_spacing.dart';
import '../../../../core/widgets/steg_states.dart';
import '../../domain/entities/assistant.dart';
import '../providers/assistant_providers.dart';

/// ChatGPT/Gemini-style conversation list: every thread of the signed-in
/// student, newest first, each with its own title and last-message preview.
/// Tapping opens the thread; the trailing menu renames or deletes it.
///
/// Conversations are strictly per user — the store is keyed by the account id
/// and wiped on logout, so no student ever sees another's thread.
class AssistantHistoryScreen extends ConsumerWidget {
  const AssistantHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(assistantControllerProvider);
    final controller = ref.read(assistantControllerProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.assistantHistory),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: StegColors.brandGradientWide,
              begin: AlignmentDirectional.centerStart,
              end: AlignmentDirectional.centerEnd,
            ),
          ),
        ),
        actions: [
          Semantics(
            button: true,
            label: l10n.assistantNewChat,
            child: IconButton(
              tooltip: l10n.assistantNewChat,
              icon: const Icon(Icons.add_comment_outlined),
              onPressed: () async {
                await controller.newConversation();
                if (context.mounted) Navigator.of(context).maybePop();
              },
            ),
          ),
        ],
      ),
      body: state.conversations.isEmpty
          ? StegEmptyView(
              title: l10n.assistantHistoryEmpty,
              hint: l10n.assistantHistoryEmptyHint,
              icon: Icons.forum_outlined,
              actionLabel: l10n.assistantNewChat,
              onAction: () async {
                await controller.newConversation();
                if (context.mounted) Navigator.of(context).maybePop();
              },
            )
          : ListView.separated(
              padding: StegSpacing.screenPadding,
              itemCount: state.conversations.length,
              separatorBuilder: (_, _) =>
                  const SizedBox(height: StegSpacing.xs),
              itemBuilder: (context, i) {
                final c = state.conversations[i];
                return _ConversationTile(
                  conversation: c,
                  selected: c.id == state.activeId,
                  onTap: () async {
                    await controller.selectConversation(c.id);
                    if (context.mounted) Navigator.of(context).maybePop();
                  },
                  onRename: () => _rename(context, c),
                  onDelete: () => _confirmDelete(context, c),
                );
              },
            ),
    );
  }

  Future<void> _rename(BuildContext context, AssistantConversation c) async {
    final l10n = AppLocalizations.of(context);
    final controller = ProviderScope.containerOf(context)
        .read(assistantControllerProvider.notifier);
    final field = TextEditingController(text: c.title);
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Text(l10n.assistantRenameTitle),
        content: TextField(
          controller: field,
          autofocus: true,
          maxLength: 60,
          decoration: InputDecoration(hintText: l10n.assistantRenameHint),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(l10n.cancelAction),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(field.text.trim()),
            child: Text(l10n.assistantRenameSave),
          ),
        ],
      ),
    );
    field.dispose();
    if (name != null && name.isNotEmpty) {
      await controller.renameConversation(c.id, name);
    }
  }

  Future<void> _confirmDelete(
    BuildContext context,
    AssistantConversation c,
  ) async {
    final l10n = AppLocalizations.of(context);
    final controller = ProviderScope.containerOf(context)
        .read(assistantControllerProvider.notifier);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Text(l10n.assistantDeleteTitle),
        content: Text(l10n.assistantDeleteMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(l10n.cancelAction),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.assistantDeleteConfirm),
          ),
        ],
      ),
    );
    if (confirmed == true) await controller.deleteConversation(c.id);
  }
}

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({
    required this.conversation,
    required this.selected,
    required this.onTap,
    required this.onRename,
    required this.onDelete,
  });

  final AssistantConversation conversation;
  final bool selected;
  final VoidCallback onTap;
  final VoidCallback onRename;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final dark = Theme.of(context).brightness == Brightness.dark;
    final scheme = Theme.of(context).colorScheme;
    final preview = conversation.preview(l10n.assistantHistoryEmptyHint);
    final updated = conversation.updatedAt;

    return Semantics(
      button: true,
      selected: selected,
      label:
          '${conversation.title.isEmpty ? l10n.assistantNewChat : conversation.title} — $preview',
      excludeSemantics: true,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
          child: Container(
            padding: const EdgeInsets.all(StegSpacing.md),
            decoration: BoxDecoration(
              color: selected
                  ? scheme.primary.withValues(alpha: dark ? 0.18 : 0.08)
                  : (dark ? StegColors.darkSurface : scheme.surface),
              borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
              border: Border.all(
                color: selected
                    ? scheme.primary.withValues(alpha: 0.5)
                    : scheme.outlineVariant,
              ),
            ),
            child: Row(
              children: [
                Icon(
                  selected ? Icons.forum_rounded : Icons.forum_outlined,
                  size: 20,
                  color: scheme.primary,
                ),
                const SizedBox(width: StegSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        conversation.title.isEmpty
                            ? l10n.assistantNewChat
                            : conversation.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyLarge
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        preview,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                Text(
                  _relative(updated),
                  style: Theme.of(context).textTheme.labelSmall,
                ),
                PopupMenuButton<String>(
                  tooltip: l10n.assistantMoreActions,
                  icon: const Icon(Icons.more_vert_outlined),
                  onSelected: (value) {
                    if (value == 'rename') onRename();
                    if (value == 'delete') onDelete();
                  },
                  itemBuilder: (_) => [
                    PopupMenuItem<String>(
                      value: 'rename',
                      child: Row(
                        children: [
                          const Icon(Icons.edit_outlined, size: 20),
                          const SizedBox(width: StegSpacing.xs),
                          Flexible(
                            child: Text(
                              l10n.assistantRenameTitle,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                    PopupMenuItem<String>(
                      value: 'delete',
                      child: Row(
                        children: [
                          Icon(
                            Icons.delete_outline,
                            size: 20,
                            color: scheme.error,
                          ),
                          const SizedBox(width: StegSpacing.xs),
                          Flexible(
                            child: Text(
                              l10n.assistantDeleteTitle,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: scheme.error),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Day-aware relative stamp: Today / Yesterday / date, then time.
  static String _relative(DateTime d) {
    final now = DateTime.now();
    final local = d.toLocal();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(local.year, local.month, local.day);
    final hh = local.hour.toString().padLeft(2, '0');
    final mm = local.minute.toString().padLeft(2, '0');
    if (day == today) return '$hh:$mm';
    if (day == today.subtract(const Duration(days: 1))) return '−1';
    return '${local.day.toString().padLeft(2, '0')}/'
        '${local.month.toString().padLeft(2, '0')}';
  }
}
