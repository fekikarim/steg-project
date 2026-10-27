import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stegappe/features/community/domain/entities/community.dart';
import 'package:stegappe/features/community/presentation/screens/community_candidates_screen.dart';
import 'package:stegappe/features/community/presentation/screens/community_feed_screen.dart';
import 'package:stegappe/core/widgets/steg_button.dart';
import 'package:stegappe/core/widgets/steg_states.dart';
import 'package:stegappe/features/community/presentation/widgets/community_cards.dart';

import 'community_test_support.dart';

/// The overflow menu of the card carrying [marker].
///
/// Addressing the card BY ITS CONTENT matters: the feed is newest-first, so
/// tapping "the first menu icon" would open whichever post happens to sort
/// first — here the other student's.
Finder menuOf(String marker) => find.descendant(
  of: find.ancestor(
    of: find.text(marker),
    matching: find.byType(CommunityPostCard),
  ),
  matching: find.byIcon(Icons.more_vert_outlined),
);

/// The community screen after the rework: it loads for a current intern, it
/// offers a group-style entry point, the cohort is browsable, and a post can
/// be edited or deleted by its author.
void main() {
  group('community screen — group header + cohort', () {
    testWidgets('shows the group identity and the two entry points', (
      tester,
    ) async {
      final repo = FakeCommunityRepository()
        ..pages = [
          CommunityFeedPage(
            items: [communityPost('p1', body: 'Bonjour la communauté')],
            hasMore: false,
          ),
        ];
      await pumpCommunity(tester, const CommunityFeedScreen(), repo: repo);

      expect(find.text('Communauté des stagiaires STEG'), findsOneWidget);
      expect(find.text('Voir les stagiaires'), findsOneWidget);
      expect(find.text('Publier'), findsWidgets);
      // The always-visible composer entry, not only a FAB.
      expect(find.text('Partagez une question ou un conseil…'), findsOneWidget);
    });

    testWidgets('"Voir les stagiaires" opens the cohort directory', (
      tester,
    ) async {
      final repo = FakeCommunityRepository()
        ..pages = [const CommunityFeedPage(items: [], hasMore: false)]
        ..candidateFixture = const [
          CommunityCandidate(
            userId: 'u1',
            displayName: 'Amine Trabelsi',
            internshipReference: 'INT-2026-00001',
            statusLabel: 'En cours de stage',
            postCount: 3,
            isMe: true,
          ),
          CommunityCandidate(
            userId: 'u2',
            displayName: 'Yasmine Haddad',
            internshipReference: 'INT-2026-00002',
            statusLabel: 'En cours de stage',
            postCount: 1,
            isMe: false,
          ),
        ];
      await pumpCommunity(tester, const CommunityFeedScreen(), repo: repo);

      await tester.tap(find.text('Voir les stagiaires'));
      await tester.pumpAndSettle();

      expect(find.byType(CommunityCandidatesScreen), findsOneWidget);
      expect(find.text('Stagiaires STEG'), findsOneWidget);
      expect(find.text('Amine Trabelsi'), findsOneWidget);
      expect(find.text('Yasmine Haddad'), findsOneWidget);
      // The caller is labelled, the colleague is not.
      expect(find.text('vous'), findsOneWidget);
    });

    testWidgets('the directory filters through the server, not on-device', (
      tester,
    ) async {
      final repo = FakeCommunityRepository()
        ..pages = [const CommunityFeedPage(items: [], hasMore: false)]
        ..candidateFixture = const [
          CommunityCandidate(
            userId: 'u1',
            displayName: 'Amine Trabelsi',
            internshipReference: 'INT-2026-00001',
            statusLabel: 'En cours',
            postCount: 0,
            isMe: true,
          ),
          CommunityCandidate(
            userId: 'u2',
            displayName: 'Yasmine Haddad',
            internshipReference: 'INT-2026-00002',
            statusLabel: 'En cours',
            postCount: 0,
            isMe: false,
          ),
        ];
      await pumpCommunity(tester, const CommunityFeedScreen(), repo: repo);
      await tester.tap(find.text('Voir les stagiaires'));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), 'Yasmine');
      // Debounced: the request is not fired per keystroke.
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();

      expect(repo.candidateQueries.last, 'Yasmine');
      expect(find.text('Yasmine Haddad'), findsOneWidget);
      expect(find.text('Amine Trabelsi'), findsNothing);
    });

    testWidgets(
      'a directory failure is stated, never an empty list pretending',
      (tester) async {
        final repo = FakeCommunityRepository()
          ..pages = [const CommunityFeedPage(items: [], hasMore: false)]
          ..failCandidates = true;
        await pumpCommunity(tester, const CommunityFeedScreen(), repo: repo);
        await tester.tap(find.text('Voir les stagiaires'));
        await tester.pumpAndSettle();

        // A localized, actionable sentence — never the raw exception text.
        expect(find.byType(StegErrorView), findsOneWidget);
        expect(find.textContaining('candidates failed'), findsNothing);
      },
    );
  });

  group('community screen — edit and delete my post', () {
    /// A repository holding one post of mine, wired the way the real one is
    /// (the page items and the by-id index describe the same rows).
    FakeCommunityRepository repoWithMine(
      String id,
      String body, {
      bool failEdit = false,
    }) {
      final post = communityPost(id, mine: true, body: body);
      return FakeCommunityRepository()
        ..postsById = {id: post}
        ..failNextEdit = failEdit
        ..pages = [
          CommunityFeedPage(items: [post], hasMore: false),
        ];
    }

    testWidgets('my post offers Edit and Delete, and never Report', (
      tester,
    ) async {
      final repo = FakeCommunityRepository()
        ..pages = [
          CommunityFeedPage(
            items: [
              communityPost('mine', mine: true, body: 'Texte à corriger'),
              communityPost('other', body: 'Question de quelqu’un d’autre'),
            ],
            hasMore: false,
          ),
        ];
      await pumpCommunity(tester, const CommunityFeedScreen(), repo: repo);
      // Open the overflow of MY post.
      await tester.tap(menuOf('Texte à corriger'));
      await tester.pumpAndSettle();
      expect(find.text('Modifier'), findsOneWidget);
      expect(find.text('Supprimer'), findsOneWidget);
      expect(find.text('Signaler'), findsNothing);

      // …and of someone else's.
      await tester.tapAt(const Offset(5, 5));
      await tester.pumpAndSettle();
      await tester.tap(menuOf('Question de quelqu’un d’autre'));
      await tester.pumpAndSettle();
      expect(find.text('Signaler'), findsOneWidget);
      expect(find.text('Modifier'), findsNothing);
    });

    testWidgets('editing a post sends the new body and updates the feed', (
      tester,
    ) async {
      final repo = repoWithMine('mine', 'Ancien texte');
      await pumpCommunity(tester, const CommunityFeedScreen(), repo: repo);

      await tester.tap(menuOf('Ancien texte'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Modifier'));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).last, 'Texte corrigé');
      await tester.tap(find.text('Enregistrer'));
      await tester.pumpAndSettle();

      expect(repo.editedPosts['mine'], 'Texte corrigé');
      expect(find.text('Texte corrigé'), findsOneWidget);
      expect(find.text('Ancien texte'), findsNothing);
    });

    testWidgets('an unchanged edit sends nothing', (tester) async {
      final repo = repoWithMine('mine', 'Identique');
      await pumpCommunity(tester, const CommunityFeedScreen(), repo: repo);

      await tester.tap(menuOf('Identique'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Modifier'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Enregistrer'));
      await tester.pumpAndSettle();

      expect(repo.editedPosts, isEmpty);
    });

    testWidgets('a refused edit rolls the feed back and says why', (
      tester,
    ) async {
      final repo = repoWithMine('mine', 'Avant', failEdit: true);
      await pumpCommunity(tester, const CommunityFeedScreen(), repo: repo);

      await tester.tap(menuOf('Avant'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Modifier'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).last, 'Après');
      await tester.tap(find.text('Enregistrer'));
      await tester.pumpAndSettle();

      // The optimistic text is reverted: the feed never shows a lie.
      expect(find.text('Avant'), findsOneWidget);
      expect(find.text('Après'), findsNothing);
      // The failure is surfaced as a localized sentence, never the raw error.
      expect(find.textContaining('edit failed'), findsNothing);
      expect(find.byType(SnackBar), findsOneWidget);
    });

    testWidgets('deleting a post removes it after confirmation', (
      tester,
    ) async {
      final repo = repoWithMine('mine', 'À supprimer');
      await pumpCommunity(tester, const CommunityFeedScreen(), repo: repo);

      await tester.tap(menuOf('À supprimer'));
      await tester.pumpAndSettle();
      // Menu item opens the confirmation, the dialog performs the delete.
      await tester.tap(find.text('Supprimer').last);
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(StegButton, 'Supprimer'));
      await tester.pumpAndSettle();
      await tester.pumpAndSettle();

      expect(repo.deletedPosts, contains('mine'));
      expect(find.text('À supprimer'), findsNothing);
    });
  });
}
