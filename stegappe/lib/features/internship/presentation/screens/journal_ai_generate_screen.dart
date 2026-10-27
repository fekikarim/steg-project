import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/app_localizations.dart';
import '../../../../core/network/error_messages.dart';
import '../../../../core/theme/steg_colors.dart';
import '../../../../core/theme/steg_spacing.dart';
import '../../domain/entities/work_items.dart';
import '../providers/journal_document_providers.dart';
import '../services/file_share.dart';
import 'journal_composer_screen.dart';

/// S8 — the dedicated "Generate Journal with AI" page.
///
/// Both entry points land here ("Generate Journal with AI" on the journal
/// screen and Tasks → Generate the journal → From my tasks), so there is a
/// single place where generation happens and one document the student ends up
/// with. It is a full-screen route on purpose: this is the end of a workflow,
/// not a prompt to dismiss.
///
/// The page owns three guarantees:
///  * **one request at a time** — a second tap while generating is ignored,
///    and leaving the page abandons the in-flight call;
///  * **an honest result** — the summary states what the document actually
///    contains (entries, days, pages) rather than a vague "done";
///  * **the file is reachable** — Download hands the PDF to the platform
///    share sheet, from which the student can send it to their supervisor.
class JournalAiGenerateScreen extends ConsumerStatefulWidget {
  const JournalAiGenerateScreen({
    super.key,
    required this.internshipId,
    this.autoStart = false,
  });

  final String internshipId;

  /// Start generating as soon as the page opens (the "Generate Journal with
  /// AI" button). False when the student first wants to read what will happen.
  final bool autoStart;

  @override
  ConsumerState<JournalAiGenerateScreen> createState() =>
      _JournalAiGenerateScreenState();
}

class _JournalAiGenerateScreenState
    extends ConsumerState<JournalAiGenerateScreen> {
  bool _started = false;

  @override
  void initState() {
    super.initState();
    if (widget.autoStart) {
      // Deferred: a provider must not be mutated during the build phase.
      Future.microtask(_generate);
    }
  }

  Future<void> _generate() async {
    if (_started) return; // duplicate-request guard
    setState(() => _started = true);
    await ref
        .read(journalEntriesProvider.notifier)
        .generate(widget.internshipId);
    if (mounted) setState(() => _started = false);
  }

  Future<void> _download(JournalEntriesResult result) async {
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
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(journalEntriesProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.journalAiGenTitle),
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
      ),
      body: SafeArea(
        child: _started || state.isGenerating
            ? _Progress(l10n: l10n)
            : state.result != null
            ? _Result(
                result: state.result!,
                l10n: l10n,
                onDownload: () => _download(state.result!),
                onRegenerate: _generate,
              )
            : state.status == JournalEntriesStatus.failed
            ? _Failure(
                message: state.offline
                    ? l10n.journalGenOffline
                    : userErrorOf(state.error ?? StateError('x'), l10n).message,
                l10n: l10n,
                onRetry: _generate,
                // Generation is never the only way forward: the
                // student can always write an entry by hand.
                onManualEntry: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => JournalComposerScreen(
                      internshipId: widget.internshipId,
                      day: DateTime.now(),
                    ),
                  ),
                ),
              )
            : _Intro(l10n: l10n, onStart: _generate),
      ),
    );
  }
}

/// What the student is about to get, before asking for it.
class _Intro extends StatelessWidget {
  const _Intro({required this.l10n, required this.onStart});

  final AppLocalizations l10n;
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(StegSpacing.md),
      children: [
        const SizedBox(height: StegSpacing.md),
        Icon(
          Icons.auto_awesome,
          size: 44,
          color: Theme.of(context).colorScheme.primary,
        ),
        const SizedBox(height: StegSpacing.md),
        Text(
          l10n.journalAiGenIntro,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: StegSpacing.md),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(StegSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Point(
                  icon: Icons.checklist_rounded,
                  label: l10n.journalAiGenPointEntries,
                ),
                _Point(
                  icon: Icons.date_range_outlined,
                  label: l10n.journalAiGenPointOrder,
                ),
                _Point(
                  icon: Icons.lock_outline,
                  label: l10n.journalAiGenPointPrivate,
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: StegSpacing.lg),
        FilledButton.icon(
          onPressed: onStart,
          icon: const Icon(Icons.auto_awesome, size: 18),
          label: Text(l10n.journalAiGenStart),
        ),
      ],
    );
  }
}

class _Point extends StatelessWidget {
  const _Point({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: StegSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: Theme.of(context).colorScheme.primary),
          const SizedBox(width: StegSpacing.sm),
          Expanded(
            child: Text(label, style: Theme.of(context).textTheme.bodyMedium),
          ),
        ],
      ),
    );
  }
}

class _Progress extends StatelessWidget {
  const _Progress({required this.l10n});

  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(StegSpacing.lg),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: StegSpacing.md),
            Text(
              l10n.journalAiGenWorking,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: StegSpacing.xs),
            Text(
              l10n.journalAiGenWorkingHint,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

/// The generated document: a summary the student can trust, plus the file.
class _Result extends StatelessWidget {
  const _Result({
    required this.result,
    required this.l10n,
    required this.onDownload,
    required this.onRegenerate,
  });

  final JournalEntriesResult result;
  final AppLocalizations l10n;
  final VoidCallback onDownload;
  final VoidCallback onRegenerate;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ListView(
      padding: const EdgeInsets.all(StegSpacing.md),
      children: [
        const SizedBox(height: StegSpacing.md),
        Icon(Icons.check_circle_outline, size: 48, color: scheme.primary),
        const SizedBox(height: StegSpacing.md),
        Text(
          l10n.journalAiGenDoneTitle,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: StegSpacing.xs),
        Text(
          result.title,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: StegSpacing.md),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(StegSpacing.md),
            child: Column(
              children: [
                _Fact(
                  label: l10n.journalAiGenEntries,
                  value: '${result.entryCount}',
                ),
                _Fact(
                  label: l10n.journalAiGenDays,
                  value: '${result.dayCount}',
                ),
                _Fact(label: l10n.journalAiGenPeriod, value: _period(result)),
                _Fact(
                  label: l10n.journalAiGenPages,
                  value: '${result.pageCount}',
                ),
                if (result.fileName.isNotEmpty)
                  _Fact(label: l10n.journalAiGenFile, value: result.fileName),
              ],
            ),
          ),
        ),
        if (result.previousSubmitted)
          Padding(
            padding: const EdgeInsets.only(top: StegSpacing.sm),
            child: Text(
              l10n.journalAiGenPreviousSubmitted,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        const SizedBox(height: StegSpacing.md),
        FilledButton.icon(
          onPressed: onDownload,
          icon: const Icon(Icons.download_rounded, size: 18),
          label: Text(l10n.journalGenDownload),
        ),
        const SizedBox(height: StegSpacing.xs),
        Text(
          l10n.journalGenDownloadHint,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: StegSpacing.sm),
        // Regeneration replaces the previous draft server-side (or creates a
        // new one once a journal has been submitted) — the student is told
        // which happened by `previousSubmitted` above.
        OutlinedButton.icon(
          onPressed: onRegenerate,
          icon: const Icon(Icons.refresh_rounded, size: 18),
          label: Text(l10n.journalGenRegenerate),
        ),
        const SizedBox(height: StegSpacing.xs),
        Text(
          l10n.journalGenKeepNote,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }

  String _period(JournalEntriesResult r) {
    if (r.firstDate.isEmpty || r.lastDate.isEmpty) return '—';
    if (r.firstDate == r.lastDate) return _pretty(r.firstDate);
    return '${_pretty(r.firstDate)} → ${_pretty(r.lastDate)}';
  }

  /// `2026-01-05` → `05/01/2026`, without pulling in an intl dependency.
  String _pretty(String iso) {
    final parts = iso.split('-');
    if (parts.length != 3) return iso;
    return '${parts[2]}/${parts[1]}/${parts[0]}';
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: StegSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 2,
            child: Text(label, style: Theme.of(context).textTheme.bodySmall),
          ),
          const SizedBox(width: StegSpacing.sm),
          Expanded(
            flex: 3,
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: Theme.of(context).textTheme.bodyMedium
                  ?.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _Failure extends StatelessWidget {
  const _Failure({
    required this.message,
    required this.l10n,
    required this.onRetry,
    required this.onManualEntry,
  });

  final String message;
  final AppLocalizations l10n;
  final VoidCallback onRetry;
  final VoidCallback onManualEntry;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(StegSpacing.lg),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 44, color: scheme.error),
            const SizedBox(height: StegSpacing.md),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: StegSpacing.md),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: Text(l10n.retry),
            ),
            const SizedBox(height: StegSpacing.xs),
            TextButton.icon(
              onPressed: onManualEntry,
              icon: const Icon(Icons.edit_note, size: 18),
              label: Text(l10n.journalGenManualPath),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).maybePop(),
              child: Text(l10n.back),
            ),
          ],
        ),
      ),
    );
  }
}
