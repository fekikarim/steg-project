import 'dart:convert';

import '../../../../core/storage/prefs_store.dart';
import '../../domain/entities/assistant.dart';

/// Local assistant conversation history, keyed by user id (T11).
///
/// The candidate assistant path has **no** server history endpoint — the
/// back-office `/api/ai/chatbot/history` is staff-only — so every thread is
/// stored on the device, keyed by user id, and wiped on logout. One user's
/// questions must never leak into the next session on a shared device.
///
/// Conversations survive restarts here. They are bounded (see
/// [AssistantHistoryStore]) so a long chat cannot grow storage without limit.
/// Question/answer text is user content, never a secret, but it stays local.
abstract class AssistantHistoryStore {
  static const int maxRows = 100;

  /// Newest threads kept per user.
  static const int maxConversations = 30;

  /// Flat, single-thread API (kept for the legacy format + tests).
  Future<List<AssistantMessage>> load(String userId);
  Future<void> save(String userId, List<AssistantMessage> messages);
  Future<void> clear(String userId);

  /// Every thread of one user plus the open one.
  Future<AssistantConversations> loadConversations(String userId);
  Future<void> saveConversations(
    String userId,
    AssistantConversations conversations,
  );
}

String assistantHistoryKey(String userId) => 'steg.assistant_history.$userId';

/// New key for the multi-conversation format. The legacy flat key is left
/// in place until the first successful save, then cleared.
String assistantConversationsKey(String userId) =>
    'steg.assistant_conversations.$userId';

List<AssistantMessage> boundAssistantRows(List<AssistantMessage> messages) =>
    messages.length <= AssistantHistoryStore.maxRows
    ? messages
    : messages.sublist(messages.length - AssistantHistoryStore.maxRows);

List<AssistantConversation> boundConversations(
  List<AssistantConversation> items,
) => items.length <= AssistantHistoryStore.maxConversations
    ? items
    : items.sublist(0, AssistantHistoryStore.maxConversations);

class PrefsAssistantHistoryStore implements AssistantHistoryStore {
  PrefsAssistantHistoryStore(this._prefs);

  final PrefsStore _prefs;

  // ── flat (legacy) ────────────────────────────────────────────────────────

  @override
  Future<List<AssistantMessage>> load(String userId) async {
    final raw = _prefs.readRaw(assistantHistoryKey(userId));
    if (raw == null || raw.isEmpty) return const [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return const [];
      return [
        for (final e in decoded)
          if (e is Map<String, dynamic>) AssistantMessage.fromJson(e),
      ];
    } on Exception {
      return const [];
    }
  }

  @override
  Future<void> save(String userId, List<AssistantMessage> messages) =>
      _prefs.writeRaw(
        assistantHistoryKey(userId),
        jsonEncode([for (final m in boundAssistantRows(messages)) m.toJson()]),
      );

  @override
  Future<void> clear(String userId) async {
    await _prefs.removeRaw(assistantHistoryKey(userId));
    await _prefs.removeRaw(assistantConversationsKey(userId));
  }

  // ── conversations ───────────────────────────────────────────────────────

  @override
  Future<AssistantConversations> loadConversations(String userId) async {
    final raw = _prefs.readRaw(assistantConversationsKey(userId));
    if (raw != null && raw.isNotEmpty) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map<String, dynamic>) {
          return AssistantConversations.fromJson(decoded);
        }
      } on Exception {
        // Fall through to the legacy migration rather than losing history.
      }
    }
    // Migration: the pre-multi-chat format was a single flat thread. Adopt it
    // as one conversation instead of dropping the student's history.
    final legacy = await load(userId);
    if (legacy.isEmpty) return const AssistantConversations();
    final now = DateTime.now();
    final conversation = AssistantConversation(
      id: 'legacy',
      title: assistantConversationTitle(legacy.first.text, 'Conversation'),
      messages: legacy,
      createdAt: now,
      updatedAt: now,
    );
    final migrated = AssistantConversations(
      items: [conversation],
      activeId: conversation.id,
    );
    await saveConversations(userId, migrated);
    await _prefs.removeRaw(assistantHistoryKey(userId));
    return migrated;
  }

  @override
  Future<void> saveConversations(
    String userId,
    AssistantConversations conversations,
  ) => _prefs.writeRaw(
    assistantConversationsKey(userId),
    jsonEncode(
      conversations
          .copyWith(items: boundConversations(conversations.items))
          .toJson(),
    ),
  );
}

/// In-memory fake for tests.
class MemoryAssistantHistoryStore implements AssistantHistoryStore {
  final _map = <String, List<AssistantMessage>>{};
  final _conversations = <String, AssistantConversations>{};

  @override
  Future<List<AssistantMessage>> load(String userId) async =>
      List.of(_map[userId] ?? const []);

  @override
  Future<void> save(String userId, List<AssistantMessage> messages) async {
    _map[userId] = List.of(boundAssistantRows(messages));
  }

  @override
  Future<void> clear(String userId) async {
    _map.remove(userId);
    _conversations.remove(userId);
  }

  @override
  Future<AssistantConversations> loadConversations(String userId) async {
    final existing = _conversations[userId];
    if (existing != null) return existing;
    final legacy = _map[userId];
    if (legacy == null || legacy.isEmpty) {
      return const AssistantConversations();
    }
    final now = DateTime.now();
    final conversation = AssistantConversation(
      id: 'legacy',
      title: assistantConversationTitle(legacy.first.text, 'Conversation'),
      messages: List.of(legacy),
      createdAt: now,
      updatedAt: now,
    );
    final migrated = AssistantConversations(
      items: [conversation],
      activeId: conversation.id,
    );
    _conversations[userId] = migrated;
    return migrated;
  }

  @override
  Future<void> saveConversations(
    String userId,
    AssistantConversations conversations,
  ) async {
    _conversations[userId] = conversations.copyWith(
      items: boundConversations(conversations.items),
    );
    // Keep the flat mirror in step so the legacy view stays coherent.
    _map[userId] = List.of(conversations.active?.messages ?? const []);
  }

  Map<String, List<AssistantMessage>> get snapshot => _map;

  Map<String, AssistantConversations> get conversationSnapshot =>
      _conversations;
}
