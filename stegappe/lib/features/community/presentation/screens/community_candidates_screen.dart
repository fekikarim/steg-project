import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/connectivity/connectivity_service.dart';
import '../../../../core/l10n/app_localizations.dart';
import '../../../../core/network/error_messages.dart';
import '../../../../core/theme/steg_colors.dart';
import '../../../../core/theme/steg_spacing.dart';
import '../../../../core/widgets/steg_states.dart';
import '../providers/community_providers.dart';
import '../widgets/community_header.dart';
import '../../../../core/widgets/steg_skeleton.dart';

/// The cohort directory: "who else is on an internship right now?".
///
/// A student reads it to find the colleague who already hit the same wall.
/// Search is debounced and executed SERVER-side, so the list stays honest and
/// cheap no matter how many interns STEG has.
class CommunityCandidatesScreen extends ConsumerStatefulWidget {
  const CommunityCandidatesScreen({super.key});

  @override
  ConsumerState<CommunityCandidatesScreen> createState() =>
      _CommunityCandidatesScreenState();
}

class _CommunityCandidatesScreenState
    extends ConsumerState<CommunityCandidatesScreen> {
  final _search = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(communityCandidatesProvider.notifier).load(),
    );
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    // Debounced: one request per pause, not one per keystroke.
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      ref.read(communityCandidatesProvider.notifier).load(query: value);
    });
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(communityCandidatesProvider);
    final isOnline = ref.watch(isOnlineProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.communityCandidatesTitle),
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
      body: Column(
        children: [
          if (!isOnline)
            Padding(
              padding: const EdgeInsets.all(StegSpacing.md),
              child: Text(l10n.offline),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              StegSpacing.md,
              StegSpacing.sm,
              StegSpacing.md,
              StegSpacing.sm,
            ),
            child: TextField(
              controller: _search,
              onChanged: _onChanged,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: l10n.communityCandidatesSearchHint,
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _search.text.isEmpty
                    ? null
                    : IconButton(
                        tooltip: l10n.communityCandidatesClear,
                        icon: const Icon(Icons.close),
                        onPressed: () {
                          _search.clear();
                          _onChanged('');
                        },
                      ),
              ),
            ),
          ),
          if (state.items.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: StegSpacing.md),
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: Text(
                  l10n.communityCandidatesResultCount(state.total),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            ),
          Expanded(
            child: state.loading && state.items.isEmpty
                ? const StegSkeletonList(rows: 6)
                : state.error != null && state.items.isEmpty
                ? StegErrorView(
                    message: userMessageOf(state.error!, l10n),
                    onRetry: () => ref
                        .read(communityCandidatesProvider.notifier)
                        .load(refresh: true),
                  )
                : state.items.isEmpty
                ? StegEmptyView(
                    icon: Icons.groups_outlined,
                    title: _search.text.trim().isEmpty
                        ? l10n.communityCandidatesEmpty
                        : l10n.communityCandidatesNoResult,
                  )
                : RefreshIndicator(
                    onRefresh: () => ref
                        .read(communityCandidatesProvider.notifier)
                        .load(refresh: true),
                    child: ListView.separated(
                      padding: const EdgeInsets.only(bottom: StegSpacing.md),
                      itemCount: state.items.length,
                      separatorBuilder: (_, _) => const Divider(height: 1),
                      itemBuilder: (context, i) =>
                          CommunityCandidateTile(candidate: state.items[i]),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
