import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:stegappe/core/theme/steg_theme.dart';
import 'package:stegappe/core/widgets/steg_card.dart';
import 'package:stegappe/core/widgets/steg_status_chip.dart';
import 'package:stegappe/features/auth/domain/entities/app_user.dart';
import 'package:stegappe/features/internship/presentation/screens/intern_home_screen.dart';
import 'package:stegappe/features/internship/presentation/widgets/home_header.dart';

import '../features/internship/home_dashboard_test.dart' as home;

const _intern = AppUser(id: 'u1', email: 'intern@u.tn', roles: ['INTERN']);

/// Design-system gate for the redesigned intern home.
///
/// The screen reads top → bottom as one story: identity (gradient hero),
/// actions (quick grid), context (internship card), work (today → week),
/// progress, then the reference lists. These tests pin that order, the
/// 16 dp section rhythm (no reserved dead bands between cards), full touch
/// targets on every quick action, and clean rendering across phone/tablet
/// widths, the supported text-scale range and the dark theme.
void main() {
  group('intern home composition', () {
    testWidgets(
        'reads identity → actions → internship → today → progress', (tester) async {
      await home.pumpHome(tester, const InternHomeScreen(user: _intern));
      final l10n = await home.loadL10n('fr');

      Rect rectOf(Finder f) => tester.getRect(f.first);

      final hero = rectOf(find.byType(HomeHeader));
      final quickTitle = rectOf(find.text(l10n.homeQuickActions));
      final grid = rectOf(find.byType(GridView));
      final internshipCard = rectOf(find
          .ancestor(
            of: find.byType(StegStatusChip).first,
            matching: find.byType(StegCard),
          )
          .first);
      final today = rectOf(find
          .ancestor(
            of: find.text(l10n.todayTitle),
            matching: find.byType(StegCard),
          )
          .first);
      final progress = rectOf(find
          .ancestor(
            of: find.text(l10n.myProgress),
            matching: find.byType(StegCard),
          )
          .first);

      // The story reads strictly top → bottom.
      expect(hero.bottom, lessThan(quickTitle.top), reason: 'identity first');
      expect(quickTitle.bottom, lessThan(grid.top), reason: 'actions next');
      expect(grid.bottom, lessThanOrEqualTo(internshipCard.top),
          reason: 'then the internship context');
      expect(internshipCard.bottom, lessThan(today.top),
          reason: 'then what needs doing');
      expect(today.bottom, lessThan(progress.top),
          reason: 'progress after the work');

      // The rhythm between the fixed landmarks is the 16 dp section gap.
      expect(quickTitle.top - hero.bottom, lessThanOrEqualTo(20),
          reason: 'no dead band between the hero and the quick actions');
      expect(internshipCard.top - grid.bottom, lessThanOrEqualTo(20),
          reason: 'no dead band between the quick actions and the card');
      expect(today.top - internshipCard.bottom, lessThanOrEqualTo(20),
          reason: 'no dead band between the card and Today');
      expect(tester.takeException(), isNull);
    });

    testWidgets('every card hugs the previous one — no reserved bands',
        (tester) async {
      await home.pumpHome(tester, const InternHomeScreen(user: _intern));

      // Every section on this screen renders inside a StegCard, so walking
      // them by vertical position measures the real painted gaps — a
      // reservation that ever grows again fails here first.
      final cardFinder = find.descendant(
        of: find.byType(InternHomeScreen),
        matching: find.byType(StegCard),
      );
      final cards = [
        for (final e in cardFinder.evaluate())
          tester.getRect(find.byWidget(e.widget)),
      ]..sort((a, b) => a.top.compareTo(b.top));
      expect(cards.length, greaterThanOrEqualTo(4),
          reason: 'identity, Today and progress at the very least');

      for (var i = 1; i < cards.length; i++) {
        expect(cards[i].top - cards[i - 1].bottom, lessThanOrEqualTo(20),
            reason: 'card $i must hug card ${i - 1} — no dead band');
      }
      expect(tester.takeException(), isNull);
    });

    testWidgets('every quick action keeps a full touch target', (tester) async {
      await home.pumpHome(tester, const InternHomeScreen(user: _intern));
      final l10n = await home.loadL10n('fr');
      for (final label in [
        l10n.qaTasks,
        l10n.qaJournal,
        l10n.qaAssistant,
        l10n.qaMessages,
      ]) {
        final tile = tester.getRect(find
            .ancestor(of: find.text(label), matching: find.byType(InkWell))
            .first);
        expect(tile.width, greaterThanOrEqualTo(44), reason: label);
        expect(tile.height, greaterThanOrEqualTo(44), reason: label);
      }
      expect(tester.takeException(), isNull);
    });
  });

  group('intern home rendering', () {
    for (final width in const [393, 600]) {
      for (final scale in const [1.0, 1.6, 2.0]) {
        testWidgets('$width dp @ $scale× renders without overflow',
            (tester) async {
          tester.view.devicePixelRatio = 3.0;
          tester.view.physicalSize = Size(width * 3, 852 * 3);
          addTearDown(tester.view.reset);

          await home.pumpHome(
            tester,
            Builder(
              builder: (context) => MediaQuery(
                data: MediaQuery.of(context)
                    .copyWith(textScaler: TextScaler.linear(scale)),
                child: const InternHomeScreen(user: _intern),
              ),
            ),
          );

          expect(tester.takeException(), isNull);
          expect(find.byType(HomeHeader), findsOneWidget);
          expect(find.byType(GridView), findsOneWidget);
          expect(
            find.byType(StegStatusChip),
            findsWidgets,
            reason: 'identity chips stay visible at every scale',
          );
        });
      }
    }

    testWidgets('dark theme renders the redesigned home', (tester) async {
      await home.pumpHome(
        tester,
        Theme(
          data: StegTheme.dark(),
          child: const InternHomeScreen(user: _intern),
        ),
      );
      expect(tester.takeException(), isNull);
      expect(find.byType(HomeHeader), findsOneWidget);
      expect(find.byType(GridView), findsOneWidget);
      expect(find.byType(StegStatusChip), findsWidgets);
    });
  });
}
