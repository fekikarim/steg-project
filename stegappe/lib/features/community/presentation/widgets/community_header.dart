import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/app_localizations.dart';
import '../../../../core/theme/steg_spacing.dart';
import '../../domain/entities/community.dart';
import '../providers/community_providers.dart';
import '../screens/community_candidates_screen.dart';

/// One intern in the cohort list.
class CommunityCandidateTile extends StatelessWidget {
  const CommunityCandidateTile({
    super.key,
    required this.candidate,
    this.onTap,
  });

  final CommunityCandidate candidate;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final initials = _initials(candidate.displayName);

    return ListTile(
      onTap: onTap,
      leading: CircleAvatar(
        backgroundColor: scheme.primary.withValues(alpha: 0.14),
        child: Text(
          initials,
          style: TextStyle(color: scheme.primary, fontWeight: FontWeight.w700),
        ),
      ),
      title: Row(
        children: [
          Flexible(
            child: Text(
              candidate.displayName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleSmall,
            ),
          ),
          if (candidate.isMe) ...[
            const SizedBox(width: StegSpacing.xs),
            _Chip(
              label: l10n.communityCandidatesYou,
              background: scheme.primary,
              foreground: scheme.onPrimary,
            ),
          ],
        ],
      ),
      subtitle: Text(
        [
          if (candidate.statusLabel.isNotEmpty) candidate.statusLabel,
          if (candidate.internshipReference.isNotEmpty)
            candidate.internshipReference,
          l10n.communityCandidatesPosts(candidate.postCount),
        ].join(' · '),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }

  static String _initials(String name) {
    final parts = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) {
      return parts.first.substring(0, 1).toUpperCase();
    }
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
        .toUpperCase();
  }
}

/// The community "group" header: identity, who is in it, and the two
/// actions a student actually came for — see the cohort, or post.
class CommunityGroupHeader extends ConsumerWidget {
  const CommunityGroupHeader({
    super.key,
    required this.canWrite,
    required this.onCompose,
    this.isOnline = true,
    this.showPublishAction = true,
  });

  final bool canWrite;
  final VoidCallback onCompose;
  final bool isOnline;

  /// False on an empty feed, where the empty-state call to action already
  /// says "Publier" — two identical buttons on one screen is noise.
  final bool showPublishAction;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final candidates = ref.watch(communityCandidatesProvider).items.length;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: dark
              ? [scheme.primary.withValues(alpha: 0.55), scheme.surface]
              : [
                  scheme.primary,
                  Color.lerp(scheme.primary, Colors.white, 0.45)!,
                ],
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
        ),
      ),
      padding: const EdgeInsets.fromLTRB(
        StegSpacing.md,
        StegSpacing.md,
        StegSpacing.md,
        StegSpacing.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.groups_rounded,
                  color: Colors.white,
                  size: 26,
                ),
              ),
              const SizedBox(width: StegSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.communityGroupName,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 17,
                      ),
                    ),
                    Text(
                      l10n.communityMembersCount(candidates),
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.88),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: StegSpacing.md),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: scheme.primary,
                  ),
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const CommunityCandidatesScreen(),
                    ),
                  ),
                  icon: const Icon(Icons.badge_outlined, size: 18),
                  label: Text(l10n.communitySeeCandidates),
                ),
              ),
              if (canWrite && showPublishAction) ...[
                const SizedBox(width: StegSpacing.sm),
                Expanded(
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.white.withValues(alpha: 0.18),
                      foregroundColor: Colors.white,
                    ),
                    onPressed: isOnline ? onCompose : null,
                    icon: const Icon(Icons.edit_outlined, size: 18),
                    label: Text(l10n.communityPublish),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.background,
    required this.foreground,
  });

  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: foreground,
          fontSize: 10,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
