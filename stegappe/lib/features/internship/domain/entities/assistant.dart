import 'package:equatable/equatable.dart';

/// One assistant conversation row. Local-only persistence (T11): the
/// candidate path has **no** server history endpoint (the back-office
/// `/api/ai/chatbot/history` is staff-only), so conversations live in device
/// storage keyed by user id and are wiped on logout. Never sent anywhere
/// except as display state.
class AssistantMessage extends Equatable {
  const AssistantMessage({
    required this.mine,
    required this.text,
    this.failed = false,
    this.at,
  });

  final bool mine;
  final String text;

  /// True when the answer request failed: the row renders with a retry
  /// affordance instead of pretending an answer arrived.
  final bool failed;

  /// Local display timestamp (never sent to the backend).
  final DateTime? at;

  AssistantMessage withAt(DateTime when) =>
      AssistantMessage(mine: mine, text: text, failed: failed, at: when);

  Map<String, dynamic> toJson() => {
    'mine': mine,
    'text': text,
    'failed': failed,
    if (at != null) 'at': at!.toIso8601String(),
  };

  factory AssistantMessage.fromJson(Map<String, dynamic> json) =>
      AssistantMessage(
        mine: json['mine'] == true,
        text: (json['text'] ?? '').toString(),
        failed: json['failed'] == true,
        at: DateTime.tryParse((json['at'] ?? '').toString()),
      );

  @override
  List<Object?> get props => [mine, text, failed, at];
}

/// A named thread, the unit a student switches between (ChatGPT/Gemini style).
///
/// [title] is derived from the first question so the history list reads like
/// real conversations instead of "New chat 1/2/3".
class AssistantConversation extends Equatable {
  const AssistantConversation({
    required this.id,
    required this.title,
    this.messages = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String title;
  final List<AssistantMessage> messages;
  final DateTime createdAt;
  final DateTime updatedAt;

  bool get isEmpty => messages.isEmpty;

  /// Preview line for the history list.
  String preview(String emptyLabel) {
    if (messages.isEmpty) return emptyLabel;
    final last = messages.last;
    if (last.failed) return last.text;
    return last.text;
  }

  AssistantConversation copyWith({
    String? title,
    List<AssistantMessage>? messages,
    DateTime? updatedAt,
  }) => AssistantConversation(
    id: id,
    title: title ?? this.title,
    messages: messages ?? this.messages,
    createdAt: createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    'messages': [for (final m in messages) m.toJson()],
  };

  factory AssistantConversation.fromJson(Map<String, dynamic> json) =>
      AssistantConversation(
        id: (json['id'] ?? '').toString(),
        title: (json['title'] ?? '').toString(),
        createdAt:
            DateTime.tryParse((json['createdAt'] ?? '').toString()) ??
            DateTime.now(),
        updatedAt:
            DateTime.tryParse((json['updatedAt'] ?? '').toString()) ??
            DateTime.now(),
        messages: [
          if (json['messages'] is List)
            for (final e in json['messages'] as List)
              if (e is Map<String, dynamic>) AssistantMessage.fromJson(e),
        ],
      );

  @override
  List<Object?> get props => [id, title, messages, createdAt, updatedAt];
}

/// The full per-user assistant state: every thread plus which one is open.
class AssistantConversations extends Equatable {
  const AssistantConversations({this.items = const [], this.activeId});

  /// Newest first — the history list order.
  final List<AssistantConversation> items;
  final String? activeId;

  AssistantConversation? get active {
    for (final c in items) {
      if (c.id == activeId) return c;
    }
    return null;
  }

  AssistantConversations copyWith({
    List<AssistantConversation>? items,
    String? activeId,
    bool clearActive = false,
  }) => AssistantConversations(
    items: items ?? this.items,
    activeId: clearActive ? null : (activeId ?? this.activeId),
  );

  Map<String, dynamic> toJson() => {
    'activeId': activeId,
    'items': [for (final c in items) c.toJson()],
  };

  factory AssistantConversations.fromJson(Map<String, dynamic> json) =>
      AssistantConversations(
        activeId: json['activeId'] as String?,
        items: [
          if (json['items'] is List)
            for (final e in json['items'] as List)
              if (e is Map<String, dynamic>) AssistantConversation.fromJson(e),
        ],
      );

  @override
  List<Object?> get props => [items, activeId];
}

/// Title derived from the first question, the way every assistant names a
/// thread. Bounded so a long question cannot produce a long list label.
String assistantConversationTitle(String question, String fallback) {
  final flat = question.replaceAll(RegExp(r'\s+'), ' ').trim();
  if (flat.isEmpty) return fallback;
  return flat.length <= 48 ? flat : '${flat.substring(0, 47)}…';
}
