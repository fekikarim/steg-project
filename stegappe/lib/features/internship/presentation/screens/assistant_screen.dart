import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/connectivity/connectivity_service.dart';
import '../../../../core/l10n/app_localizations.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/network/error_messages.dart';
import '../../../../core/theme/steg_colors.dart';
import '../../../../core/theme/steg_motion.dart';
import '../../../../core/theme/steg_spacing.dart';
import '../../../../core/widgets/steg_status_chip.dart';
import '../../domain/entities/assistant.dart';
import '../providers/assistant_providers.dart';
import 'assistant_history_screen.dart';

/// Intern AI assistant screen.
///
/// Professional chat surface: independent conversations per user, typed
/// thinking indicator, timestamps, copy / retry on answers, and starter
/// questions that guide a candidate through their internship.
///
/// The Gemini key never leaves the backend: questions are posted to
/// /api/ai/assistant/query and the advisory answer is decoded from the
/// authoritative `responseText` field. Degraded mode never blocks core flows.
class AssistantScreen extends ConsumerStatefulWidget {
  const AssistantScreen({super.key});

  @override
  ConsumerState<AssistantScreen> createState() => _AssistantScreenState();
}

class _AssistantScreenState extends ConsumerState<AssistantScreen> {
  final _controller = TextEditingController();
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(assistantControllerProvider.notifier).restore(),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _ask([String? preset]) async {
    final text = preset ?? _controller.text;
    if (text.trim().isEmpty) return;
    final sent = await ref
        .read(assistantControllerProvider.notifier)
        .send(text);
    if (!mounted) return;
    if (sent) _controller.clear();
    _scrollToEnd();
  }

  Future<void> _retry(int index) async {
    await ref.read(assistantControllerProvider.notifier).retry(index);
    if (mounted) _scrollToEnd();
  }

  Future<void> _openHistory() async {
    await Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => const AssistantHistoryScreen()));
    if (mounted) _scrollToEnd();
  }

  Future<void> _confirmClear() async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Text(l10n.assistantClearTitle),
        content: Text(l10n.assistantClearMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(l10n.cancelAction),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.assistantClearConfirm),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      await ref.read(assistantControllerProvider.notifier).clear();
    }
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
      );
    });
  }

  /// Honest per-failure sentence. A 404 means the backend found no
  /// internship for the caller — rendered as an empty state, not a crash.
  String _errorMessage(Object error, AppLocalizations l10n) {
    if (error is ApiException && error.kind == ApiErrorKind.notFound) {
      return l10n.assistantNoInternship;
    }
    return userMessageOf(error, l10n);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(assistantControllerProvider);
    final isOnline = ref.watch(isOnlineProvider);
    final failedIndex = state.messages.lastIndexWhere((m) => m.failed);

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: _AssistantTitle(state: state),
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
              onPressed: state.pending
                  ? null
                  : () => ref
                        .read(assistantControllerProvider.notifier)
                        .newConversation(),
            ),
          ),
          Semantics(
            button: true,
            label: l10n.assistantHistory,
            child: IconButton(
              tooltip: l10n.assistantHistory,
              icon: Badge(
                isLabelVisible: state.conversations.isNotEmpty,
                label: Text('${state.conversations.length}'),
                child: const Icon(Icons.forum_outlined),
              ),
              onPressed: _openHistory,
            ),
          ),
          if (state.messages.isNotEmpty && !state.pending)
            Semantics(
              button: true,
              label: l10n.assistantClearTitle,
              child: IconButton(
                tooltip: l10n.assistantClearTitle,
                icon: const Icon(Icons.delete_outline),
                onPressed: _confirmClear,
              ),
            ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView.builder(
                controller: _scroll,
                padding: const EdgeInsets.all(StegSpacing.md),
                itemCount: 1 + state.messages.length + (state.pending ? 1 : 0),
                itemBuilder: (context, i) {
                  if (i == 0) {
                    return _ConversationHeader(
                      state: state,
                      onAsk: (q) => _ask(q),
                    );
                  }
                  final index = i - 1;
                  if (index >= state.messages.length) {
                    return const _ThinkingBubble();
                  }
                  final m = state.messages[index];
                  return _Bubble(
                    message: m,
                    onRetry: m.failed ? () => _retry(index) : null,
                  );
                },
              ),
            ),
            if (state.error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: StegSpacing.md),
                child: Row(
                  children: [
                    Expanded(
                      child: Semantics(
                        liveRegion: true,
                        label: _errorMessage(state.error!, l10n),
                        excludeSemantics: true,
                        child: Text(
                          _errorMessage(state.error!, l10n),
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                          ),
                        ),
                      ),
                    ),
                    if (failedIndex >= 0)
                      TextButton(
                        onPressed: state.pending
                            ? null
                            : () => _retry(failedIndex),
                        child: Text(l10n.retry),
                      ),
                  ],
                ),
              ),
            if (!isOnline)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: StegSpacing.md),
                child: Row(
                  children: [
                    const Icon(Icons.cloud_off_outlined, size: 18),
                    const SizedBox(width: StegSpacing.xs),
                    Expanded(
                      child: Text(
                        l10n.assistantOffline,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                  ],
                ),
              ),
            _Composer(
              controller: _controller,
              pending: state.pending,
              online: isOnline,
              onSend: _ask,
            ),
          ],
        ),
      ),
    );
  }
}

/// Guidance questions offered on an empty chat.
///
/// Each one maps to a sheet the assistant actually holds (internship types,
/// mandatory rule, required documents, procedure, workflow statuses,
/// internship life, duration, contact), so a candidate is walked through
/// their internship instead of having to invent a first question. Localized
/// in the UI language; the assistant answers in French/Arabic per its server
/// side instruction.
List<String> assistantStarterQuestions(AppLocalizations l10n) => [
  l10n.assistantAskTypes,
  l10n.assistantAskDocuments,
  l10n.assistantAskProcedure,
  l10n.assistantAskJournal,
  l10n.assistantAskStatus,
  l10n.assistantAskLife,
  l10n.assistantAskDuration,
];

/// Assistant title bar: the open conversation, or the assistant's own name.
class _AssistantTitle extends StatelessWidget {
  const _AssistantTitle({required this.state});

  final AssistantState state;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final active = state.active;
    final title = (active != null && active.title.isNotEmpty)
        ? active.title
        : l10n.assistantTitle;
    return Row(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: StegColors.aiGradient,
              begin: AlignmentDirectional.topStart,
              end: AlignmentDirectional.bottomEnd,
            ),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.auto_awesome, size: 17, color: Colors.white),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                l10n.aiAdvisoryNote,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 11,
                  color: Colors.white.withValues(alpha: 0.7),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// First block of the thread: advisory disclaimers, or — on an empty chat —
/// the guidance questions that walk a candidate through their internship.
class _ConversationHeader extends StatelessWidget {
  const _ConversationHeader({required this.state, required this.onAsk});

  final AssistantState state;
  final void Function(String question) onAsk;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: StegStatusChip(label: l10n.aiBadge),
        ),
        const SizedBox(height: StegSpacing.xs),
        Text(
          l10n.assistantExplain,
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: StegSpacing.xxs),
        Text(l10n.aiAdvisoryNote, style: Theme.of(context).textTheme.bodySmall),
        if (state.messages.isEmpty && !state.pending) ...[
          const SizedBox(height: StegSpacing.lg),
          Text(
            l10n.assistantWelcome,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: StegSpacing.md),
          // Guidance: every prompt maps to a sheet the assistant actually
          // knows, so a candidate is led through their internship instead of
          // having to invent a good first question.
          ...assistantStarterQuestions(l10n).map(
            (q) => Padding(
              padding: const EdgeInsets.only(bottom: StegSpacing.xs),
              child: _StarterChip(question: q, onTap: () => onAsk(q)),
            ),
          ),
        ],
        const SizedBox(height: StegSpacing.sm),
      ],
    );
  }
}

/// One tappable guidance question.
class _StarterChip extends StatelessWidget {
  const _StarterChip({required this.question, required this.onTap});

  final String question;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      button: true,
      label: question,
      excludeSemantics: true,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: StegSpacing.md,
              vertical: StegSpacing.sm,
            ),
            decoration: BoxDecoration(
              color: scheme.surface,
              borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
              border: Border.all(color: scheme.outlineVariant),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.help_outline_rounded,
                  size: 18,
                  color: scheme.primary,
                ),
                const SizedBox(width: StegSpacing.sm),
                Expanded(
                  child: Text(
                    question,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
                Icon(
                  Icons.arrow_forward_rounded,
                  size: 16,
                  color: scheme.onSurfaceVariant,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Animated "typing" indicator shown while the answer is in flight.
class _ThinkingBubble extends StatefulWidget {
  const _ThinkingBubble();

  @override
  State<_ThinkingBubble> createState() => _ThinkingBubbleState();
}

class _ThinkingBubbleState extends State<_ThinkingBubble>
    with SingleTickerProviderStateMixin {
  // Repeating pulse, capped by the motion tokens like every other animation
  // (ux-ui §6): a gentle pulse, not a presentation transition.
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: StegMotion.medium,
  )..repeat();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: Semantics(
        label: l10n.assistantThinking,
        excludeSemantics: true,
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: StegSpacing.xs),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            borderRadius: const BorderRadiusDirectional.only(
              topStart: Radius.circular(18),
              topEnd: Radius.circular(18),
              bottomStart: Radius.circular(5),
              bottomEnd: Radius.circular(18),
            ),
          ),
          child: AnimatedBuilder(
            animation: _ctrl,
            builder: (context, _) => Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var i = 0; i < 3; i++)
                  Padding(
                    padding: EdgeInsetsDirectional.only(end: i == 2 ? 0 : 5),
                    child: Opacity(
                      opacity:
                          0.35 +
                          0.65 *
                              ((_ctrl.value + i * 0.22) % 1.0).clamp(0.0, 1.0),
                      child: Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// One chat bubble. Failed assistant rows render the error inline with a
/// retry affordance instead of pretending an answer arrived; long texts wrap
/// and scroll with the list (never truncated mid-word by the UI).
class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, this.onRetry});

  final AssistantMessage message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final mine = message.mine;

    final time = message.at;
    final stamp = time == null
        ? null
        : '${time.hour.toString().padLeft(2, '0')}:'
              '${time.minute.toString().padLeft(2, '0')}';

    return Align(
      alignment: mine
          ? AlignmentDirectional.centerEnd
          : AlignmentDirectional.centerStart,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: StegSpacing.xs),
        padding: const EdgeInsets.all(StegSpacing.md),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.82,
        ),
        decoration: BoxDecoration(
          gradient: mine
              ? const LinearGradient(
                  colors: StegColors.brandGradientRamp,
                  begin: AlignmentDirectional.topStart,
                  end: AlignmentDirectional.bottomEnd,
                )
              : null,
          color: mine ? null : (dark ? StegColors.darkSurface : scheme.surface),
          borderRadius: BorderRadiusDirectional.only(
            topStart: const Radius.circular(18),
            topEnd: const Radius.circular(18),
            bottomStart: Radius.circular(mine ? 18 : 5),
            bottomEnd: Radius.circular(mine ? 5 : 18),
          ),
          border: mine ? null : Border.all(color: scheme.outlineVariant),
          boxShadow: [
            BoxShadow(
              color: (mine ? StegColors.brandPrimary : Colors.black).withValues(
                alpha: mine ? 0.22 : (dark ? 0.3 : 0.05),
              ),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (!mine && message.failed)
              Row(
                children: [
                  Icon(Icons.error_outline, size: 18, color: scheme.error),
                  const SizedBox(width: StegSpacing.xs),
                  Expanded(
                    child: Text(
                      l10n.assistantUnavailable,
                      style: TextStyle(color: scheme.error),
                    ),
                  ),
                ],
              )
            else
              Text(
                message.text,
                style: TextStyle(
                  height: 1.45,
                  color: mine ? Colors.white : scheme.onSurface,
                ),
              ),
            if (stamp != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  stamp,
                  textAlign: mine ? TextAlign.end : TextAlign.start,
                  style: TextStyle(
                    fontSize: 10.5,
                    color: mine
                        ? Colors.white.withValues(alpha: 0.75)
                        : scheme.onSurfaceVariant,
                  ),
                ),
              ),
            if (onRetry != null) ...[
              const SizedBox(height: StegSpacing.xs),
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: TextButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh_rounded, size: 16),
                  label: Text(l10n.retry),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Rounded composer that grows with the input.
class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.pending,
    required this.online,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool pending;
  final bool online;
  final void Function([String?]) onSend;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final enabled = !pending && online;
    return Padding(
      padding: const EdgeInsets.all(StegSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Semantics(
              textField: true,
              label: l10n.assistantTitle,
              child: TextField(
                controller: controller,
                minLines: 1,
                maxLines: 4,
                maxLength: 2000,
                enabled: enabled,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => onSend(),
                decoration: InputDecoration(
                  hintText: l10n.assistantPlaceholder,
                  counterText: '',
                  isDense: true,
                ),
              ),
            ),
          ),
          const SizedBox(width: StegSpacing.sm),
          Semantics(
            button: true,
            label: l10n.assistantSend,
            child: Container(
              width: StegSpacing.minTouchTarget,
              height: StegSpacing.minTouchTarget,
              decoration: BoxDecoration(
                gradient: enabled
                    ? const LinearGradient(
                        colors: StegColors.brandGradientBright,
                        begin: AlignmentDirectional.topStart,
                        end: AlignmentDirectional.bottomEnd,
                      )
                    : null,
                color: enabled ? null : Theme.of(context).disabledColor,
                borderRadius: BorderRadius.circular(StegSpacing.radiusFull),
                boxShadow: enabled ? StegColors.buttonShadow : null,
              ),
              child: pending
                  ? const Padding(
                      padding: EdgeInsets.all(13),
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Colors.white,
                      ),
                    )
                  : IconButton(
                      tooltip: l10n.assistantSend,
                      icon: const Icon(
                        Icons.send_rounded,
                        size: 20,
                        color: Colors.white,
                      ),
                      onPressed: enabled ? () => onSend() : null,
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
