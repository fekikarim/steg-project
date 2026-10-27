import 'package:flutter/material.dart';

import '../../../../core/l10n/app_localizations.dart';
import '../../../../core/theme/steg_spacing.dart';
import '../../domain/entities/community.dart';

/// Edit sheet for one of my posts. Returns the new body, or null.
///
/// Owns its [TextEditingController]: disposing it from the caller right after
/// `showModalBottomSheet` returns races the sheet's exit animation (the
/// TextField rebuilds against a dead controller), so the lifetime is tied to
/// the widget instead.
///
/// The attachment is immutable by server contract — the sheet says so rather
/// than letting the student think they can replace it.
class CommunityEditPostSheet extends StatefulWidget {
  const CommunityEditPostSheet({super.key, required this.post});

  final CommunityPost post;

  /// Shows the sheet and resolves to the edited body (null when dismissed or
  /// when nothing actually changed).
  static Future<String?> show(BuildContext context, CommunityPost post) async {
    final body = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (_) => CommunityEditPostSheet(post: post),
    );
    if (body == null) return null;
    final trimmed = body.trim();
    if (trimmed.isEmpty || trimmed == post.body) return null;
    return trimmed;
  }

  @override
  State<CommunityEditPostSheet> createState() => _CommunityEditPostSheetState();
}

class _CommunityEditPostSheetState extends State<CommunityEditPostSheet> {
  late final TextEditingController _text = TextEditingController(
    text: widget.post.body,
  );

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(StegSpacing.md),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                l10n.communityEditTitle,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: StegSpacing.md),
              TextField(
                controller: _text,
                autofocus: true,
                maxLines: 6,
                minLines: 3,
                maxLength: CommunityContentRules.maxPostLength,
                decoration: InputDecoration(hintText: l10n.communityEditHint),
              ),
              if (widget.post.attachment != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: StegSpacing.sm),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, size: 14),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          l10n.communityAttachmentImmutable,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                    ],
                  ),
                ),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(_text.text),
                child: Text(l10n.communityEditSave),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
