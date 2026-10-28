import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/supervisor_tasks.dart';
import '../../domain/entities/work_items.dart';
import '../../domain/repositories/internship_repository.dart';
import 'workspace_providers.dart';

/// T04 supervisor task management (SU-TASK-01/03/04, SU-HOME-01).
///
/// The backend owns scope (out-of-scope → 404), transitions and validation;
/// providers render state and send intents. REST stays authoritative — no new
/// socket subscription (T06 owns realtime); mutations invalidate the
/// supervised lists so the next open reconciles with server state.

/// Currently selected student (internship id) in the supervisor tasks
/// screen. Null = first supervised internship once loaded.
final selectedSupervisedInternshipProvider = StateProvider<String?>(
  (ref) => null,
);

/// A task together with the supervised intern it belongs to. The backend
/// task has a single assignee, so the intern is the assignee shown on a card.
class SupervisedTask extends Equatable {
  const SupervisedTask({
    required this.task,
    required this.internshipId,
    required this.internName,
  });

  final InternTask task;
  final String internshipId;
  final String internName;

  @override
  List<Object?> get props => [task, internshipId, internName];
}

/// Tasks of the supervisor's supervised interns, read in one backend call
/// (staff scope; scheduled tasks included). [totalElements] is the backend
/// count, so the screen can say when the first page is not the whole list.
class SupervisorTaskBoard {
  const SupervisorTaskBoard({required this.items, required this.totalElements});

  final List<SupervisedTask> items;
  final int totalElements;

  bool get truncated => totalElements > items.length;
}

/// The supervisor's tasks, each paired with the intern it belongs to. Throws
/// `StateError('no-internship')` when the supervisor has no interns.
final supervisorTasksProvider = FutureProvider<SupervisorTaskBoard>((
  ref,
) async {
  final repo = ref.watch(internshipRepositoryProvider);
  final interns = await ref.watch(supervisedInternsProvider.future);
  if (interns.isEmpty) throw StateError('no-internship');
  final page = await repo.listSupervisorTasks(size: 100);
  final names = {for (final i in interns) i.internshipId: i.internName};
  final board = SupervisorTaskBoard(
    items: [
      for (final task in page.items)
        SupervisedTask(
          task: task,
          internshipId: task.internshipId ?? '',
          internName: names[task.internshipId] ?? '',
        ),
    ],
    totalElements: page.totalElements,
  );
  ref.read(lastSupervisorTasksProvider.notifier).state = board;
  return board;
});

/// Last successfully loaded board (stale/offline rendering).
final lastSupervisorTasksProvider = StateProvider<SupervisorTaskBoard?>(
  (ref) => null,
);

/// Supervisor mutation state: one in-flight guard across create/update/
/// delete/review/bulk (double-tap protection), the last error, and the last
/// bulk result for the summary screen.
class SupervisorTaskState {
  const SupervisorTaskState({this.busy = false, this.error, this.lastBulk});

  final bool busy;
  final Object? error;
  final SupervisorBulkResult? lastBulk;

  SupervisorTaskState copyWith({
    bool? busy,
    Object? error,
    bool clearError = false,
    SupervisorBulkResult? lastBulk,
  }) => SupervisorTaskState(
    busy: busy ?? this.busy,
    error: clearError ? null : (error ?? this.error),
    lastBulk: lastBulk ?? this.lastBulk,
  );
}

class SupervisorTaskController extends StateNotifier<SupervisorTaskState> {
  SupervisorTaskController(this._ref) : super(const SupervisorTaskState());

  final Ref _ref;

  InternshipRepository get _repo => _ref.read(internshipRepositoryProvider);

  String _bulkKey(String action, int count) =>
      '$action-${DateTime.now().microsecondsSinceEpoch}-$count';

  void _touch(String? internshipId) {
    _ref
      ..invalidate(supervisorTasksProvider)
      ..invalidate(supervisedInternsProvider);
    if (internshipId != null) {
      _ref.invalidate(supervisedInternDetailProvider(internshipId));
    }
  }

  Future<T?> _guarded<T>(Future<T> Function() call) async {
    if (state.busy) return null;
    state = state.copyWith(busy: true, clearError: true);
    try {
      final result = await call();
      state = state.copyWith(busy: false);
      return result;
    } on Exception catch (e) {
      state = state.copyWith(busy: false, error: e);
      return null;
    }
  }

  /// Create one task for one student (optional due date + schedule).
  /// Returns true when the server confirmed it.
  Future<bool> createTask(
    String internshipId, {
    required String title,
    String? description,
    DateTime? dueDate,
    DateTime? visibleFrom,
  }) async {
    final ok = await _guarded(
      () => _repo.createTask(
        internshipId,
        title: title,
        description: description,
        dueDate: dueDate,
        visibleFrom: visibleFrom,
      ),
    );
    if (ok != null) _touch(internshipId);
    return ok != null;
  }

  /// Edit content fields + schedule. Null schedule = leave unchanged
  /// (send a past instant to make a scheduled task immediate).
  Future<bool> updateTask(
    String taskId,
    String internshipId, {
    required String title,
    String? description,
    DateTime? dueDate,
    DateTime? visibleFrom,
  }) async {
    final ok = await _guarded(
      () => _repo.updateTask(
        taskId,
        title: title,
        description: description,
        dueDate: dueDate,
        visibleFrom: visibleFrom,
      ),
    );
    if (ok != null) _touch(internshipId);
    return ok != null;
  }

  Future<bool> deleteTask(String taskId, String internshipId) async {
    final ok = await _guarded(() async {
      await _repo.deleteTask(taskId);
      return true;
    });
    if (ok != null) _touch(internshipId);
    return ok != null;
  }

  /// Review a COMPLETED task. Returns the decided task, or null on
  /// failure/guard (error is in state for the localized UI).
  Future<InternTask?> reviewTask(
    String taskId,
    String internshipId, {
    required bool approve,
    String? comment,
  }) async {
    final decided = await _guarded(
      () => _repo.reviewTask(taskId, approve: approve, comment: comment),
    );
    if (decided != null) _touch(internshipId);
    return decided;
  }

  /// Atomic bulk with a fresh idempotency key per submit. The key is
  /// regenerated by the caller after a corrected payload (the backend
  /// replays identical keys instead of re-executing).
  Future<SupervisorBulkResult?> bulkTasks(
    List<Map<String, dynamic>> mutations,
  ) async {
    final result = await _guarded(
      () => _repo.bulkTasks(
        mutations: mutations,
        idempotencyKey: _bulkKey('bulk', mutations.length),
      ),
    );
    if (result != null) {
      state = state.copyWith(lastBulk: result);
      _ref
        ..invalidate(supervisorTasksProvider)
        ..invalidate(supervisedInternsProvider);
    }
    return result;
  }

  void clearError() => state = state.copyWith(clearError: true);
}

final supervisorTaskControllerProvider =
    StateNotifierProvider<SupervisorTaskController, SupervisorTaskState>(
      (ref) => SupervisorTaskController(ref),
    );
