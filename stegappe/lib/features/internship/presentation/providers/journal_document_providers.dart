import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/connectivity/connectivity_service.dart';
import '../../domain/entities/work_items.dart';
import 'workspace_providers.dart';

/// T09/B5 — server-computed journal eligibility for the student's internship.
///
/// The window, the remaining days and the <75 % warning are the BACKEND's
/// facts (BR-21: computed in `Africa/Tunis`, never from the phone clock); this
/// provider only reads them and is invalidated after every generation so the
/// state stays live.
final journalEligibilityProvider =
    FutureProvider.family<JournalEligibility, String>(
      (ref, internshipId) => ref
          .watch(internshipRepositoryProvider)
          .journalEligibility(internshipId),
    );

enum JournalGenerationStatus { idle, generating, done, failed }

class JournalGenerationState {
  const JournalGenerationState({
    this.status = JournalGenerationStatus.idle,
    this.source,
    this.result,
    this.error,
    this.offline = false,
    this.abandoned = false,
  });

  final JournalGenerationStatus status;

  /// `TASKS` or `TEXT` (null while idle).
  final String? source;
  final JournalGenerationResult? result;

  /// Raw failure (mapped to a localized sentence by the screen, never shown
  /// as-is). Null unless [status] is failed.
  final Object? error;

  /// D12: generation needs connectivity; the flow says so instead of failing
  /// with a transport error.
  final bool offline;

  /// The student left the progress state; a late result is displayed as a
  /// notice (the server does not cancel a completed generation) but never
  /// reopens the flow.
  final bool abandoned;

  bool get isGenerating => status == JournalGenerationStatus.generating;

  JournalGenerationState copyWith({
    JournalGenerationStatus? status,
    String? source,
    JournalGenerationResult? result,
    Object? error,
    bool clearError = false,
    bool? offline,
    bool? abandoned,
  }) => JournalGenerationState(
    status: status ?? this.status,
    source: source ?? this.source,
    result: result ?? this.result,
    error: clearError ? null : (error ?? this.error),
    offline: offline ?? this.offline,
    abandoned: abandoned ?? this.abandoned,
  );
}

/// T09/B6 — generation flow (ST-JRN-04/05/06).
///
/// The backend owns the window, the AI call, the strict schema, the PDF and the
/// deliverable; the app sends an intent and renders state. Cancelling abandons
/// the WAIT only: the server may already have persisted the draft, so the
/// eligibility and the documents lists are refreshed to tell the truth instead
/// of pretending nothing happened.
class JournalGenerationController extends Notifier<JournalGenerationState> {
  int _attempt = 0;

  @override
  JournalGenerationState build() => const JournalGenerationState();

  Future<void> generateFromTasks(String internshipId) =>
      _run(internshipId, fromText: null);

  Future<void> generateFromText(String internshipId, String text) =>
      _run(internshipId, fromText: text);

  /// Abandons the current wait; a late result is not shown as a success.
  void cancel() {
    if (!state.isGenerating) return;
    _attempt++;
    state = state.copyWith(
      status: JournalGenerationStatus.idle,
      abandoned: true,
    );
  }

  void reset() {
    if (state.isGenerating) cancel();
    state = const JournalGenerationState();
  }

  Future<void> _run(String internshipId, {required String? fromText}) async {
    if (!ref.read(isOnlineProvider)) {
      state = const JournalGenerationState(
        status: JournalGenerationStatus.failed,
        offline: true,
      );
      return;
    }
    final attempt = ++_attempt;
    final source = fromText == null ? 'TASKS' : 'TEXT';
    state = JournalGenerationState(
      status: JournalGenerationStatus.generating,
      source: source,
    );
    final repo = ref.read(internshipRepositoryProvider);
    try {
      final result = fromText == null
          ? await repo.generateJournalFromTasks(internshipId)
          : await repo.generateJournalFromText(internshipId, fromText);
      if (attempt != _attempt) {
        // Abandoned while the server worked: converge silently.
        _refresh(internshipId);
        return;
      }
      state = JournalGenerationState(
        status: JournalGenerationStatus.done,
        source: source,
        result: result,
      );
      _refresh(internshipId);
    } catch (error) {
      if (attempt != _attempt) {
        _refresh(internshipId);
        return;
      }
      state = JournalGenerationState(
        status: JournalGenerationStatus.failed,
        source: source,
        error: error,
      );
    }
  }

  /// The generated journal is a deliverable draft and changes the task facts
  /// only through explicit actions — refresh what the student can see.
  void _refresh(String internshipId) {
    ref.invalidate(journalEligibilityProvider(internshipId));
    ref.invalidate(deliverablesListProvider);
    ref.invalidate(pendingDeliverableReviewsProvider);
    ref.invalidate(dashboardProvider);
  }
}

final journalGenerationProvider =
    NotifierProvider<JournalGenerationController, JournalGenerationState>(
      JournalGenerationController.new,
    );

// ---------------------------------------------------------------------------
// S8 — journal compiled from the student's own submitted entries
// ---------------------------------------------------------------------------

enum JournalEntriesStatus { idle, generating, done, failed }

/// State of the entries-compiled journal. Separate from [JournalGenerationState]
/// because the payload is entry-shaped (counts, page count) rather than
/// task-shaped.
class JournalEntriesState {
  const JournalEntriesState({
    this.status = JournalEntriesStatus.idle,
    this.result,
    this.error,
    this.offline = false,
  });

  final JournalEntriesStatus status;
  final JournalEntriesResult? result;
  final Object? error;
  final bool offline;

  bool get isGenerating => status == JournalEntriesStatus.generating;

  JournalEntriesState copyWith({
    JournalEntriesStatus? status,
    JournalEntriesResult? result,
    Object? error,
    bool? offline,
  }) => JournalEntriesState(
    status: status ?? this.status,
    result: result ?? this.result,
    error: error ?? this.error,
    offline: offline ?? this.offline,
  );

  @override
  String toString() =>
      'JournalEntriesState(${status.name}, ${result?.deliverableId}, offline=$offline)';
}

/// Drives the S8 workflow.
///
/// Two guards matter here: a second call while one is in flight is refused
/// outright (the button is the duplicate-request path, and the backend would
/// otherwise store two drafts), and abandoning the wait bumps the attempt
/// counter so a late answer is never rendered as a success.
class JournalEntriesController extends Notifier<JournalEntriesState> {
  int _attempt = 0;

  @override
  JournalEntriesState build() => const JournalEntriesState();

  Future<void> generate(String internshipId) async {
    if (state.isGenerating) return; // duplicate-request guard
    if (!ref.read(isOnlineProvider)) {
      state = const JournalEntriesState(
        status: JournalEntriesStatus.failed,
        offline: true,
      );
      return;
    }
    final attempt = ++_attempt;
    state = const JournalEntriesState(status: JournalEntriesStatus.generating);
    final repo = ref.read(internshipRepositoryProvider);
    try {
      final result = await repo.generateJournalFromEntries(internshipId);
      if (attempt != _attempt) {
        _refresh(internshipId);
        return;
      }
      state = JournalEntriesState(
        status: JournalEntriesStatus.done,
        result: result,
      );
      _refresh(internshipId);
    } catch (error) {
      if (attempt != _attempt) {
        _refresh(internshipId);
        return;
      }
      state = JournalEntriesState(
        status: JournalEntriesStatus.failed,
        error: error,
      );
    }
  }

  /// Abandons the wait; the server may already have stored the draft, so the
  /// lists are refreshed rather than pretending nothing happened.
  void cancel() {
    if (!state.isGenerating) return;
    _attempt++;
    state = const JournalEntriesState();
  }

  void reset() {
    if (state.isGenerating) cancel();
    state = const JournalEntriesState();
  }

  void _refresh(String internshipId) {
    ref.invalidate(journalEligibilityProvider(internshipId));
    ref.invalidate(deliverablesListProvider);
    ref.invalidate(pendingDeliverableReviewsProvider);
    ref.invalidate(dashboardProvider);
  }
}

final journalEntriesProvider =
    NotifierProvider<JournalEntriesController, JournalEntriesState>(
      JournalEntriesController.new,
    );
