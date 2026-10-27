import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/connectivity/connectivity_service.dart';
import '../../../../core/l10n/app_localizations.dart';
import '../../../../core/network/error_messages.dart';
import '../../../../core/theme/steg_colors.dart';
import '../../../../core/theme/steg_motion.dart';
import '../../../../core/theme/steg_spacing.dart';
import '../../domain/entities/work_items.dart';
import '../providers/journal_document_providers.dart';
import '../services/file_share.dart';

/// "From my text" generation — a dedicated, chatbot-style workspace.
///
/// The free-text path is a real authoring task (the student describes the
/// internship in their own words), so it gets its own screen instead of a
/// bare field inside a sheet: a chat-like transcript where the student's
/// descriptions and the generated documents stack up, a generous composer
/// with live guidance, a clear **Start generation** action, and a Download
/// button on the produced document so it can be shared with the supervisor.
class JournalTextGenScreen extends ConsumerStatefulWidget {
  const JournalTextGenScreen({
    super.key,
    required this.internshipId,
    this.onClose,
  });

  final String internshipId;

  /// Pop back to the sheet (used when opened from the chooser).
  final VoidCallback? onClose;

  @override
  ConsumerState<JournalTextGenScreen> createState() =>
      _JournalTextGenScreenState();
}

class _JournalTextGenScreenState extends ConsumerState<JournalTextGenScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();

  /// Everything the student wrote this session, oldest first — the
  /// "conversation" of this generation session.
  final List<_DraftTurn> _turns = [];

  bool _sharing = false;
  int _running = 0;

  @override
  void initState() {
    super.initState();
    // Deferred: the provider must not be mutated during the build phase.
    Future.microtask(
      () => ref.read(journalGenerationProvider.notifier).reset(),
    );
    _input.addListener(_onTyping);
  }

  @override
  void dispose() {
    _input.removeListener(_onTyping);
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _onTyping() {
    // The counter (and the start button) must follow the text immediately.
    setState(() {});
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

  /// Starts a generation from the current composer content.
  Future<void> _generate() async {
    final text = _input.text.trim();
    if (text.isEmpty || _running > 0) return;
    final l10n = AppLocalizations.of(context);
    if (text.length < kJournalTextMinLength) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(l10n.journalGenTextTooShort(kJournalTextMinLength)),
        ),
      );
      return;
    }
    if (text.length > kJournalTextMaxLength) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.errJournalTextInvalid)));
      return;
    }
    final attempt = ++_running;
    setState(() => _turns.add(_DraftTurn(text: text)));
    _input.clear();
    _scrollToEnd();

    await ref
        .read(journalGenerationProvider.notifier)
        .generateFromText(widget.internshipId, text);
    if (!mounted) return;

    if (attempt != _running) return; // superseded / reset
    // On failure the description stays in the transcript, so a retry never
    // loses it and the student never has to retype it.
    _scrollToEnd();
  }

  /// Retries the last failed generation with the same text.
  Future<void> _retryLast() async {
    if (_turns.isEmpty || _running > 0) return;
    final attempt = ++_running;
    await ref
        .read(journalGenerationProvider.notifier)
        .generateFromText(widget.internshipId, _turns.last.text);
    if (!mounted || attempt != _running) return;
    _scrollToEnd();
  }

  /// Downloads the generated PDF and hands it to the platform share sheet so
  /// the student can send it to the supervisor from there.
  Future<void> _download(JournalGenerationResult result) async {
    setState(() => _sharing = true);
    final l10n = AppLocalizations.of(context);
    try {
      await downloadAndShare(
        ref,
        deliverableId: result.deliverableId,
        fileName: result.fileName,
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l10n.journalGenOpenFailed)));
      }
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(journalGenerationProvider);
    final isOnline = ref.watch(isOnlineProvider);
    final used = _input.text.trim().length;
    final tooLong = used > kJournalTextMaxLength;
    final canStart =
        used >= kJournalTextMinLength &&
        !tooLong &&
        !state.isGenerating &&
        isOnline;
    // The newest document wins for the result card.
    final result = state.result;
    final failed = state.status == JournalGenerationStatus.failed;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: StegColors.brandGradientWide,
              begin: AlignmentDirectional.centerStart,
              end: AlignmentDirectional.centerEnd,
            ),
          ),
        ),
        title: Row(
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
              child: const Icon(
                Icons.auto_awesome,
                size: 17,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                l10n.journalTextGenTitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        actions: [
          if (widget.onClose != null)
            Semantics(
              button: true,
              label: l10n.journalGenCancel,
              child: IconButton(
                tooltip: l10n.journalGenCancel,
                icon: const Icon(Icons.close),
                onPressed: widget.onClose,
              ),
            ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                controller: _scroll,
                padding: const EdgeInsets.all(StegSpacing.md),
                children: [
                  _Intro(l10n: l10n),
                  const SizedBox(height: StegSpacing.md),
                  for (final turn in _turns) ...[
                    _UserBubble(text: turn.text),
                    const SizedBox(height: StegSpacing.sm),
                  ],
                  if (state.isGenerating)
                    const _ThinkingCard()
                  else if (failed)
                    _FailureCard(
                      message: _failureMessage(state, l10n),
                      onRetry: _retryLast,
                    )
                  else if (result != null)
                    _ResultCard(
                      result: result,
                      sharing: _sharing,
                      l10n: l10n,
                      onDownload: () => _download(result),
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
              controller: _input,
              hint: l10n.journalTextGenHint,
              used: used,
              needsLengthHelp: used < kJournalTextMinLength,
              canStart: canStart,
              running: state.isGenerating,
              onStart: _generate,
            ),
          ],
        ),
      ),
    );
  }

  String _failureMessage(JournalGenerationState state, AppLocalizations l10n) {
    if (state.offline) return l10n.journalGenOffline;
    return userErrorOf(
      state.error ?? StateError('journal-generation-failed'),
      l10n,
    ).message;
  }
}

/// One student description in the transcript.
class _DraftTurn {
  _DraftTurn({required this.text});

  final String text;
}

class _Intro extends StatelessWidget {
  const _Intro({required this.l10n});

  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          l10n.journalTextGenIntro,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: StegSpacing.xs),
        Row(
          children: [
            const Icon(Icons.auto_awesome, size: 14),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                l10n.aiAdvisoryNote,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _UserBubble extends StatelessWidget {
  const _UserBubble({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: AlignmentDirectional.centerEnd,
      child: Container(
        margin: const EdgeInsets.only(bottom: StegSpacing.xs),
        padding: const EdgeInsets.all(StegSpacing.md),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.85,
        ),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: StegColors.brandGradientRamp,
            begin: AlignmentDirectional.topStart,
            end: AlignmentDirectional.bottomEnd,
          ),
          borderRadius: const BorderRadiusDirectional.only(
            topStart: Radius.circular(18),
            topEnd: Radius.circular(18),
            bottomStart: Radius.circular(18),
            bottomEnd: Radius.circular(5),
          ),
        ),
        child: Text(
          text,
          style: const TextStyle(color: Colors.white, height: 1.45),
        ),
      ),
    );
  }
}

/// Assistant-side "generating" card with animated dots.
class _ThinkingCard extends StatefulWidget {
  const _ThinkingCard();

  @override
  State<_ThinkingCard> createState() => _ThinkingCardState();
}

class _ThinkingCardState extends State<_ThinkingCard>
    with SingleTickerProviderStateMixin {
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
    return Container(
      padding: const EdgeInsets.all(StegSpacing.md),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.auto_awesome, size: 16),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  l10n.journalGenProgress,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
              AnimatedBuilder(
                animation: _ctrl,
                builder: (context, _) => Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (var i = 0; i < 3; i++)
                      Padding(
                        padding: EdgeInsetsDirectional.only(
                          end: i == 2 ? 0 : 4,
                        ),
                        child: Opacity(
                          opacity:
                              0.35 +
                              0.65 *
                                  ((_ctrl.value + i * 0.22) % 1.0).clamp(
                                    0.0,
                                    1.0,
                                  ),
                          child: Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: StegSpacing.sm),
          const LinearProgressIndicator(minHeight: 6),
        ],
      ),
    );
  }
}

/// The generated document, with the explicit Download action the student
/// needs to get the PDF out and send it to the supervisor.
class _ResultCard extends StatelessWidget {
  const _ResultCard({
    required this.result,
    required this.sharing,
    required this.l10n,
    required this.onDownload,
  });

  final JournalGenerationResult result;
  final bool sharing;
  final AppLocalizations l10n;
  final VoidCallback onDownload;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(StegSpacing.md),
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
        border: Border.all(color: scheme.primary.withValues(alpha: 0.4)),
        boxShadow: StegColors.cardShadow(
          Theme.of(context).brightness == Brightness.dark,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: scheme.primary.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  Icons.picture_as_pdf_outlined,
                  color: scheme.primary,
                ),
              ),
              const SizedBox(width: StegSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      result.title.isEmpty
                          ? l10n.journalGenDoneTitle
                          : result.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    Text(
                      l10n.journalGenDone(result.currentVersion),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (result.fileName.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: StegSpacing.xs),
              child: Text(
                result.fileName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          const SizedBox(height: StegSpacing.md),
          // Explicit download — the student sends the PDF to the supervisor
          // from the system share sheet.
          FilledButton.icon(
            onPressed: sharing ? null : onDownload,
            icon: sharing
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.download_rounded, size: 18),
            label: Text(l10n.journalGenDownload),
          ),
          const SizedBox(height: StegSpacing.xxs),
          Text(
            l10n.journalGenDownloadHint,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

/// Failure card: honest, specific reason + retry that keeps the text.
class _FailureCard extends StatelessWidget {
  const _FailureCard({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(StegSpacing.md),
      decoration: BoxDecoration(
        color: scheme.errorContainer.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
        border: Border.all(color: scheme.error.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.error_outline, size: 18, color: scheme.error),
              const SizedBox(width: StegSpacing.xs),
              Expanded(
                child: Text(
                  message,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
            ],
          ),
          const SizedBox(height: StegSpacing.sm),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded, size: 18),
            label: Text(l10n.retry),
          ),
        ],
      ),
    );
  }
}

/// Chat-style composer with a live counter and the Start generation action.
class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.hint,
    required this.used,
    required this.needsLengthHelp,
    required this.canStart,
    required this.running,
    required this.onStart,
  });

  final TextEditingController controller;
  final String hint;
  final int used;
  final bool needsLengthHelp;
  final bool canStart;
  final bool running;
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    return SafeArea(
      top: false,
      child: Container(
        decoration: BoxDecoration(
          color: scheme.surface,
          border: Border(top: BorderSide(color: scheme.outlineVariant)),
        ),
        padding: const EdgeInsets.all(StegSpacing.md),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: controller,
              minLines: 3,
              maxLines: 8,
              maxLength: kJournalTextMaxLength,
              enabled: !running,
              onChanged: (_) {},
              decoration: InputDecoration(
                hintText: hint,
                alignLabelWithHint: true,
                counterText: '$used / $kJournalTextMaxLength',
              ),
            ),
            if (needsLengthHelp)
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: Text(
                  l10n.journalGenTextTooShort(kJournalTextMinLength),
                  // Muted while the field is still empty (guidance), red once
                  // the student has actually typed something too short.
                  style: TextStyle(
                    color: used == 0 ? scheme.onSurfaceVariant : scheme.error,
                    fontSize: 12,
                  ),
                ),
              ),
            const SizedBox(height: StegSpacing.sm),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: canStart ? onStart : null,
                icon: running
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.auto_awesome, size: 18),
                label: Text(l10n.journalTextGenStart),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
