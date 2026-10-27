import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/connectivity/connectivity_service.dart';
import '../../../../core/l10n/settings_providers.dart';
import '../../../../core/network/api_exception.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/cache/assistant_history_store.dart';
import '../../domain/entities/assistant.dart';
import 'workspace_providers.dart';

/// Session-scoped assistant (T11 + multi-conversation).
///
/// The candidate assistant path has **no** server history (the back-office
/// `/api/ai/chatbot/history` is staff-only), so every thread lives in the
/// local [AssistantHistoryStore], keyed by user id and wiped on logout. A
/// student can therefore keep many independent chats — journal questions,
/// documents, planning — and each user's set is completely separate.
///
/// Keep-alive by design: the shell gate invalidates this provider on logout.
/// Every answer is server-confirmed through the backend (which holds the
/// Gemini key); a failure renders as a failed row with retry, never as a
/// fabricated answer.
class AssistantState {
  const AssistantState({
    this.conversations = const [],
    this.activeId,
    this.pending = false,
    this.error,
  });

  /// Newest first (history list order).
  final List<AssistantConversation> conversations;

  /// The open thread; null = nothing open yet (the welcome state).
  final String? activeId;

  final bool pending;

  /// Raw failure of the last attempt (transient, never persisted);
  /// screens localize it at the edge via `context.userError`.
  final Object? error;

  AssistantConversation? get active {
    for (final c in conversations) {
      if (c.id == activeId) return c;
    }
    return null;
  }

  /// Messages of the open thread. Kept as a top-level convenience so every
  /// existing consumer (and the shell) reads the same thing.
  List<AssistantMessage> get messages => active?.messages ?? const [];

  AssistantState copyWith({
    List<AssistantConversation>? conversations,
    String? activeId,
    bool clearActive = false,
    bool? pending,
    Object? error = _unset,
  }) => AssistantState(
    conversations: conversations ?? this.conversations,
    activeId: clearActive ? null : (activeId ?? this.activeId),
    pending: pending ?? this.pending,
    error: error == _unset ? this.error : error,
  );

  static const _unset = Object();
}

final assistantHistoryStoreProvider = Provider<AssistantHistoryStore>(
  (ref) => PrefsAssistantHistoryStore(ref.watch(prefsStoreProvider)),
);

final assistantControllerProvider =
    StateNotifierProvider<AssistantController, AssistantState>(
      // Survives navigation within the session; the shell gate resets it
      // on logout so no row leaks into the next session.
      (ref) => AssistantController(ref),
    );

class AssistantController extends StateNotifier<AssistantState> {
  AssistantController(this._ref) : super(const AssistantState());

  final Ref _ref;
  bool _restoredFor = false;
  String? _userId;
  int _seq = 0;

  String? get _currentUserId {
    final auth = _ref.read(authControllerProvider);
    if (auth is AuthAuthenticated) return auth.user.id;
    return null;
  }

  String _newId() {
    _seq++;
    return 'c${DateTime.now().microsecondsSinceEpoch}_$_seq';
  }

  /// Loads every thread of the current user (idempotent per user; the screen
  /// calls it on open). Never mixes two users: the store is keyed by id.
  Future<void> restore() async {
    final id = _currentUserId;
    if (id == null) return;
    if (_restoredFor && _userId == id) return;
    _userId = id;
    _restoredFor = true;
    try {
      final conversations = await _ref
          .read(assistantHistoryStoreProvider)
          .loadConversations(id);
      state = state.copyWith(
        conversations: conversations.items,
        activeId: conversations.activeId,
        clearActive: conversations.activeId == null,
        error: null,
      );
    } on Exception {
      // A corrupt local history never breaks the screen; start empty.
      state = const AssistantState();
    }
  }

  Future<void> _persist() async {
    final id = _userId ?? _currentUserId;
    if (id == null) return;
    try {
      await _ref
          .read(assistantHistoryStoreProvider)
          .saveConversations(
            id,
            AssistantConversations(
              items: state.conversations,
              activeId: state.activeId,
            ),
          );
    } on Exception {
      // Local persistence is best-effort; the server answer already arrived.
    }
  }

  // ── conversation management ───────────────────────────────────────────

  /// Opens a brand-new empty thread (ChatGPT's "New chat").
  Future<void> newConversation() async {
    final id = _userId ?? _currentUserId;
    if (id == null) return;
    _userId = id;
    final now = DateTime.now();
    final conversation = AssistantConversation(
      id: _newId(),
      title: '',
      createdAt: now,
      updatedAt: now,
    );
    state = state.copyWith(
      conversations: [conversation, ...state.conversations],
      activeId: conversation.id,
      error: null,
    );
    await _persist();
  }

  /// Switches the open thread.
  Future<void> selectConversation(String conversationId) async {
    if (state.activeId == conversationId) return;
    state = state.copyWith(activeId: conversationId, error: null);
    await _persist();
  }

  /// Removes one thread. If the open one goes away the most recent remaining
  /// thread opens, so the student is never left on a dead selection.
  Future<void> deleteConversation(String conversationId) async {
    final remaining = [
      for (final c in state.conversations)
        if (c.id != conversationId) c,
    ];
    final wasActive = state.activeId == conversationId;
    state = state.copyWith(
      conversations: remaining,
      clearActive: wasActive,
      activeId: wasActive
          ? (remaining.isEmpty ? null : remaining.first.id)
          : state.activeId,
      pending: wasActive ? false : state.pending,
    );
    await _persist();
  }

  /// Renames a thread (the history list offers it explicitly).
  Future<void> renameConversation(String conversationId, String title) async {
    final clean = title.trim();
    if (clean.isEmpty) return;
    state = state.copyWith(
      conversations: [
        for (final c in state.conversations)
          if (c.id == conversationId) c.copyWith(title: clean) else c,
      ],
    );
    await _persist();
  }

  // ── messaging ─────────────────────────────────────────────────────────

  /// Sends one question into the open thread, creating it if needed.
  /// Guarded against empty text and double-submit; AI is never queued —
  /// offline fails honestly with the connectivity sentence instead of
  /// pretending a response is coming. Returns true when dispatched.
  Future<bool> send(String raw) async {
    final question = raw.trim();
    if (question.isEmpty || state.pending) return false;
    if (!_ref.read(isOnlineProvider)) {
      state = state.copyWith(error: ApiException.network());
      return false;
    }
    final id = _userId ?? _currentUserId;
    if (id == null) return false;
    _userId = id;

    // No thread open (first ever question): open one and name it after the
    // question, like every assistant does.
    var conversations = state.conversations;
    var activeId = state.activeId;
    if (activeId == null || !conversations.any((c) => c.id == activeId)) {
      final now = DateTime.now();
      final conversation = AssistantConversation(
        id: _newId(),
        title: assistantConversationTitle(question, ''),
        createdAt: now,
        updatedAt: now,
      );
      conversations = [conversation, ...conversations];
      activeId = conversation.id;
    }

    final now = DateTime.now();
    final updated = [
      for (final c in conversations)
        if (c.id == activeId)
          c.copyWith(
            // A thread opened with "New chat" is named after its first
            // question, exactly like every assistant does — otherwise the
            // history list would show unnamed rows.
            title: c.title.trim().isEmpty
                ? assistantConversationTitle(question, c.title)
                : c.title,
            messages: [
              ...c.messages,
              AssistantMessage(mine: true, text: question, at: now),
            ],
            updatedAt: now,
          )
        else
          c,
    ];
    state = state.copyWith(
      conversations: _newestFirst(updated),
      activeId: activeId,
      pending: true,
      error: null,
    );
    await _persist();

    try {
      final answer = await _ref
          .read(internshipRepositoryProvider)
          .askAssistant(question);
      if (!mounted) return false;
      state = state.copyWith(
        conversations: _appendToActive(
          state.conversations,
          activeId,
          AssistantMessage(mine: false, text: answer, at: DateTime.now()),
        ),
        pending: false,
      );
    } on Exception catch (e) {
      if (!mounted) return false;
      state = state.copyWith(
        conversations: _appendToActive(
          state.conversations,
          activeId,
          const AssistantMessage(mine: false, text: '', failed: true),
        ),
        pending: false,
        error: e,
      );
    }
    await _persist();
    return true;
  }

  /// Re-asks the question behind a failed answer row, replacing the row on
  /// success (or refreshing its failed state on another failure).
  Future<bool> retry(int failedIndex) async {
    if (state.pending) return false;
    final conversation = state.active;
    final rows = conversation?.messages ?? const [];
    if (failedIndex < 0 || failedIndex >= rows.length) return false;
    final row = rows[failedIndex];
    if (row.mine || !row.failed) return false;
    String question = '';
    for (var i = failedIndex - 1; i >= 0; i--) {
      if (rows[i].mine) {
        question = rows[i].text;
        break;
      }
    }
    if (question.isEmpty) return false;
    if (!_ref.read(isOnlineProvider)) {
      state = state.copyWith(error: ApiException.network());
      return false;
    }
    final id = conversation!.id;
    state = state.copyWith(pending: true, error: null);
    try {
      final answer = await _ref
          .read(internshipRepositoryProvider)
          .askAssistant(question);
      if (!mounted) return false;
      state = state.copyWith(
        conversations: [
          for (final c in state.conversations)
            if (c.id == id)
              c.copyWith(
                messages: [
                  for (var i = 0; i < c.messages.length; i++)
                    if (i == failedIndex)
                      AssistantMessage(
                        mine: false,
                        text: answer,
                        at: DateTime.now(),
                      )
                    else
                      c.messages[i],
                ],
              )
            else
              c,
        ],
        pending: false,
      );
    } on Exception catch (e) {
      if (!mounted) return false;
      state = state.copyWith(pending: false, error: e);
    }
    await _persist();
    return true;
  }

  /// Clears the open thread (the screen owns the confirmation dialog). When
  /// no thread is open, this is a no-op — "new chat" covers that case.
  Future<void> clear() async {
    final active = state.active;
    if (active == null) return;
    await deleteConversation(active.id);
  }

  // ── helpers ───────────────────────────────────────────────────────────

  /// Keeps the history list newest-first after a thread changed.
  List<AssistantConversation> _newestFirst(List<AssistantConversation> items) {
    final sorted = [...items]
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return boundConversations(sorted);
  }

  List<AssistantConversation> _appendToActive(
    List<AssistantConversation> items,
    String conversationId,
    AssistantMessage message,
  ) {
    final now = DateTime.now();
    final updated = [
      for (final c in items)
        if (c.id == conversationId)
          c.copyWith(messages: [...c.messages, message], updatedAt: now)
        else
          c,
    ];
    return _newestFirst(updated);
  }
}
