import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:stegappe/core/l10n/app_localizations.dart';
import 'package:stegappe/core/l10n/settings_providers.dart';
import 'package:stegappe/core/storage/prefs_store.dart';
import 'package:stegappe/core/theme/steg_theme.dart';
import 'package:stegappe/core/widgets/steg_card.dart';
import 'package:stegappe/core/widgets/steg_status_chip.dart';
import 'package:stegappe/features/auth/domain/entities/app_user.dart';
import 'package:stegappe/features/internship/presentation/providers/journal_calendar_providers.dart';
import 'package:stegappe/features/internship/presentation/providers/workspace_providers.dart';
import 'package:stegappe/features/internship/presentation/screens/intern_home_screen.dart';
import 'package:stegappe/features/internship/presentation/widgets/journal_calendar_view.dart';

import '../features/internship/home_dashboard_test.dart' as home;
import '../test_fixtures.dart';

/// T15 · dead-band gate.
///
/// Two surfaces had a real, visible layout defect: a reserved band of empty
/// background between the quick-actions section and the content around it,
/// and a reserved band between the calendar's weekday header and its first
/// week. Both came from a widget reserving *more* height than it paints.
///
/// These tests measure the painted geometry instead of trusting the formula,
/// across phone/tablet widths and the whole supported text-scale range, so a
/// reservation that ever grows again fails here first. The home measurements
/// follow the redesigned composition: quick actions → internship identity
/// card.
const _intern = AppUser(id: 'u1', email: 'intern@u.tn', roles: ['INTERN']);

/// Renders [child] under a fixed text scale on top of the real theme.
Widget _scaled(double scale, Widget child) => Builder(
  builder: (context) => MediaQuery(
    data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale)),
    child: child,
  ),
);

void main() {
  group('T15 quick actions: no reserved band around the grid', () {
    for (final width in const [393, 600]) {
      for (final scale in const [1.0, 1.6, 2.0]) {
        testWidgets('$width dp @ $scale×', (tester) async {
          tester.view.devicePixelRatio = 3.0;
          tester.view.physicalSize = Size(width * 3, 852 * 3);
          addTearDown(tester.view.reset);

          await home.pumpHome(
            tester,
            _scaled(scale, const InternHomeScreen(user: _intern)),
          );
          final l10n = await home.loadL10n('fr');

          final title = tester.getRect(find.text(l10n.homeQuickActions));
          final grid = tester.getRect(find.byType(GridView).first);
          final tile = tester.getRect(
            find
                .ancestor(
                  of: find.text(l10n.qaTasks),
                  matching: find.byType(InkWell),
                )
                .first,
          );
          final chips = tester.getRect(
            find
                .ancestor(
                  of: find.byType(StegStatusChip).first,
                  matching: find.byType(Wrap),
                )
                .first,
          );
          final card = tester.getRect(
            find
                .ancestor(
                  of: find.byType(StegStatusChip).first,
                  matching: find.byType(StegCard),
                )
                .first,
          );

          expect(
            tile.height,
            closeTo(grid.height, 1),
            reason:
                'the tiles fill their cells: the grid can never be '
                'taller than what it paints',
          );
          expect(
            tile.top - title.bottom,
            lessThanOrEqualTo(20),
            reason: 'no dead band between the section title and the buttons',
          );
          expect(
            card.top - grid.bottom,
            lessThanOrEqualTo(20),
            reason: 'no dead band between the buttons and the identity card',
          );
          expect(
            chips.top - card.top,
            lessThanOrEqualTo(20),
            reason:
                'the chips sit at the top of the card, not in a reserved band',
          );
          expect(tester.takeException(), isNull);
        });
      }
    }
  });

  group('T15 journal calendar: whole weeks, no reserved band', () {
    // Different month lengths *and* different starting weekdays, including
    // the 28-day February that used to leave a whole dead row.
    const months = [
      2026 * 12 + 2,
      2026 * 12 + 3,
      2026 * 12 + 9,
      2026 * 12 + 10,
    ];
    for (final encoded in months) {
      final month = DateTime(encoded ~/ 12, encoded % 12);
      testWidgets('${month.year}-${month.month.toString().padLeft(2, '0')}: '
          'the grid ends exactly at its last week', (tester) async {
        await _pumpCalendar(tester, month, 1.0);

        final grid = find.byType(GridView);
        final box = tester
            .getRect(
              find.ancestor(of: grid, matching: find.byType(SizedBox)).first,
            )
            .deflate(1);
        final cellFinder = find.descendant(
          of: grid,
          matching: find.byType(InkWell),
        );
        final cells = [
          for (final e in cellFinder.evaluate())
            tester.getRect(find.byWidget(e.widget)),
        ];

        expect(cells, isNotEmpty);
        final top = cells.map((r) => r.top).reduce((a, b) => a < b ? a : b);
        final bottom = cells
            .map((r) => r.bottom)
            .reduce((a, b) => a > b ? a : b);

        expect(
          top - box.top,
          lessThanOrEqualTo(2),
          reason: 'the first week starts at the top of the reserved box',
        );
        expect(
          box.bottom - bottom,
          lessThanOrEqualTo(2),
          reason: 'no reserved band under the last week',
        );
        expect(tester.takeException(), isNull);
      });
    }

    testWidgets('day 1 lands under its own weekday', (tester) async {
      final month = DateTime(2026, 10); // 1 October 2026 is a Thursday
      await _pumpCalendar(tester, month, 1.0);

      final monday = JournalMonthCalendar.shortWeekday(
        const Locale('fr'),
        DateTime(2026, 10, 5),
      );
      expect(
        find.text(monday),
        findsOneWidget,
        reason: 'the weekday header must be on screen to stay honest',
      );

      final grid = find.byType(GridView);
      final box = tester.getRect(grid);
      final dayOne = tester.getRect(
        find.descendant(of: grid, matching: find.text('1')).first,
      );
      final column = box.width / 7;
      // Thursday is the 4th Monday-first column → its centre sits inside it.
      final index = ((dayOne.center.dx - box.left) / column).floor();
      expect(
        index,
        3,
        reason: '1 October 2026 is a Thursday: the 4th Monday-first column',
      );
    });
  });
}

Future<void> _pumpCalendar(
  WidgetTester tester,
  DateTime month,
  double scale,
) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await PrefsStore.load();
  await tester.pumpWidget(
    _scaled(
      scale,
      ProviderScope(
        overrides: [
          prefsStoreProvider.overrideWithValue(prefs),
          internshipRepositoryProvider.overrideWithValue(
            FakeInternshipRepository(),
          ),
          journalAccentProvider.overrideWith(
            (ref) => JournalAccentController(null),
          ),
        ],
        child: MaterialApp(
          locale: const Locale('fr'),
          supportedLocales: StegLocales.supported,
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          theme: StegTheme.light(),
          home: Scaffold(
            body: JournalMonthCalendar(
              month: month,
              selected: DateTime(month.year, month.month, 15),
              start: DateTime(month.year, month.month, 1),
              end: DateTime(month.year, month.month, 28),
              accent: JournalAccent.brand,
              onSelect: (_) {},
              onMonthChanged: (_) {},
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}
