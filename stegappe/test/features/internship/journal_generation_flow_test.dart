// T09/B6 — the student's journal generation flow (ST-JRN-04/05/06).
//
// The backend owns the AI call, the strict schema, the PDF and the deliverable;
// these tests pin the app's half: the chooser, the cancellable progress, the
// result actions (preview / regenerate with confirm / keep), the bounded text
// path, and the degraded AI state that keeps the manual path one tap away.
import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stegappe/core/connectivity/connectivity_service.dart';
import 'package:stegappe/core/l10n/app_localizations.dart';
import 'package:stegappe/core/network/api_exception.dart';
import 'package:stegappe/core/theme/steg_theme.dart';
import 'package:stegappe/features/internship/domain/entities/work_items.dart';
import 'package:stegappe/features/internship/presentation/providers/workspace_providers.dart';
import 'package:stegappe/features/internship/presentation/screens/journal_generation_sheet.dart';
import 'package:stegappe/features/internship/presentation/providers/journal_document_providers.dart';
import 'package:stegappe/features/internship/presentation/screens/journal_ai_generate_screen.dart';
import 'package:stegappe/features/internship/presentation/screens/journal_text_gen_screen.dart';
import 'package:stegappe/features/internship/presentation/services/file_share.dart';

import '../../test_fixtures.dart';

const _eligible = JournalEligibility(
  eligible: true,
  reason: 'ELIGIBLE_WINDOW',
  daysUntilOpen: 0,
  windowDays: 30,
  taskCount: 4,
  approvedTasks: 4,
  belowThreshold: false,
);

class _Workspace {
  _Workspace(this.repo, this.shared);
  final FakeInternshipRepository repo;
  final List<(Uint8List, String)> shared;
}

Future<_Workspace> _pumpSheet(
  WidgetTester tester, {
  FakeInternshipRepository? fake,
  JournalEligibility eligibility = _eligible,
}) async {
  final repo = fake ?? FakeInternshipRepository();
  repo.journalEligibilityFixture = eligibility;
  final shared = <(Uint8List, String)>[];
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        internshipRepositoryProvider.overrideWithValue(repo),
        isOnlineProvider.overrideWith((ref) => true),
        shareFnProvider.overrideWithValue((bytes, fileName) async {
          shared.add((bytes, fileName));
        }),
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
        home: const Scaffold(
          body: JournalGenerationBar(internshipId: 'internship-1'),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('Générer le journal de stage'));
  await tester.pumpAndSettle();
  return _Workspace(repo, shared);
}

ButtonStyleButton _actionLabelled(WidgetTester tester, String label) =>
    tester.widget<ButtonStyleButton>(find.widgetWithText(FilledButton, label));

void main() {
  group('journal generation flow (ST-JRN-04/06, AC2/AC5)', () {
    testWidgets(
      'from my tasks: opens the dedicated page, progress then a real result',
      (tester) async {
        final repo = FakeInternshipRepository();
        final gate = Completer<void>();
        repo.journalEntriesGate = gate;
        final ws = await _pumpSheet(tester, fake: repo);

        // S8: the chooser no longer generates in the sheet, it routes to the
        // dedicated page that owns the shared entries workflow.
        await tester.tap(find.text('À partir de mes tâches'));
        await tester.pump();
        await tester.pump();

        expect(find.byType(JournalAiGenerateScreen), findsOneWidget);
        expect(find.text('Génération du document…'), findsOneWidget);

        gate.complete();
        await tester.pumpAndSettle();

        expect(ws.repo.journalEntriesGenerations, ['ENTRIES']);
        expect(ws.repo.journalGenerations, isEmpty);
        expect(find.text('Document prêt'), findsOneWidget);
        expect(find.text('Entrées incluses'), findsOneWidget);
        expect(find.text('Télécharger le document'), findsOneWidget);
        // Keeping notifies nobody (ST-JRN-06) — stated, not implied. It sits
        // below the fold, so the list is scrolled before asserting.
        await tester.scrollUntilVisible(
          find.textContaining('personne n’est notifié'),
          200,
          scrollable: find.byType(Scrollable).first,
        );
        expect(find.textContaining('personne n’est notifié'), findsOneWidget);
        expect(find.text('Régénérer'), findsOneWidget);
      },
    );

    testWidgets('preview downloads the authenticated artifact and shares it', (
      tester,
    ) async {
      final ws = await _pumpSheet(tester);
      await tester.tap(find.text('À partir de mes tâches'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Télécharger le document'));
      await tester.pumpAndSettle();

      expect(ws.repo.downloads.single.$1, 'del-journal-entries');
      expect(ws.shared.single.$2, 'journal-de-stage-INT-2026-00001.pdf');
      expect(ws.shared.single.$1, Uint8List.fromList([0x25, 0x50, 0x44, 0x46]));
    });

    testWidgets('regenerating from the result runs the same workflow again', (
      tester,
    ) async {
      final ws = await _pumpSheet(tester);
      await tester.tap(find.text('À partir de mes tâches'));
      await tester.pumpAndSettle();
      expect(ws.repo.journalEntriesGenerations, ['ENTRIES']);

      await tester.scrollUntilVisible(
        find.text('Régénérer'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.ensureVisible(find.text('Régénérer'));
      await tester.pumpAndSettle();
      expect(
        tester.getCenter(find.text('Régénérer')),
        isNot(equals(tester.getCenter(find.byType(Scaffold)))),
      );
      await tester.tap(find.text('Régénérer'), warnIfMissed: true);
      await tester.pumpAndSettle();

      expect(ws.repo.journalEntriesGenerations, ['ENTRIES', 'ENTRIES']);
      expect(find.text('Document prêt'), findsOneWidget);
    });

    testWidgets('leaving the page submits nothing and notifies nobody', (
      tester,
    ) async {
      final ws = await _pumpSheet(tester);
      await tester.tap(find.text('À partir de mes tâches'));
      await tester.pumpAndSettle();

      // No submit call is made by the generation flow itself.
      expect(ws.repo.submitted, isEmpty);
      await tester.scrollUntilVisible(
        find.textContaining('n’envoie rien'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.textContaining('n’envoie rien'), findsOneWidget);
    });

    testWidgets('abandoning the wait never shows a late success', (
      tester,
    ) async {
      final repo = FakeInternshipRepository();
      final gate = Completer<void>();
      repo.journalEntriesGate = gate;
      await _pumpSheet(tester, fake: repo);

      await tester.tap(find.text('À partir de mes tâches'));
      await tester.pump();
      await tester.pump();

      // Leaving the page abandons the wait; the server may still finish.
      final ctx = tester.element(find.byType(JournalAiGenerateScreen));
      ProviderScope.containerOf(ctx)
          .read(journalEntriesProvider.notifier)
          .cancel();
      await tester.pump();

      gate.complete();
      await tester.pumpAndSettle();

      expect(find.text('Document prêt'), findsNothing);
      expect(find.text('Génération du document…'), findsNothing);
    });

    testWidgets('degraded AI: localized message, manual path one tap away', (
      tester,
    ) async {
      final repo = FakeInternshipRepository()
        ..journalEntriesError = const ApiException(
          kind: ApiErrorKind.server,
          statusCode: 503,
          code: 'AI_UNAVAILABLE',
          message: 'AI unavailable',
        );
      await _pumpSheet(tester, fake: repo);

      await tester.tap(find.text('À partir de mes tâches'));
      await tester.pumpAndSettle();

      expect(
        find.text(
          "L’assistant IA n’est pas activé sur le serveur pour le moment. "
          "Réessayez plus tard ou écrivez votre journal manuellement.",
        ),
        findsOneWidget,
      );
      // The manual escape hatch is still one tap away.
      expect(
        find.text('Écrire une entrée de journal manuellement'),
        findsOneWidget,
      );
      expect(find.text('Réessayer'), findsOneWidget);
      // The raw provider message is never rendered.
      expect(find.text('AI unavailable'), findsNothing);
    });

    testWidgets(
      'text path: own screen, counter, bounded start, same pipeline',
      (tester) async {
        final ws = await _pumpSheet(tester);
        // "From my text" no longer opens a bare field in the sheet: it opens
        // the dedicated chatbot-style generation screen.
        await tester.tap(find.text('À partir de mon texte'));
        await tester.pumpAndSettle();
        expect(find.byType(JournalTextGenScreen), findsOneWidget);
        expect(find.text('Génération IA du journal'), findsOneWidget);

        final field = find.byType(TextField);
        expect(field, findsOneWidget);
        expect(find.text('0 / 8000'), findsOneWidget);
        // Too short → the action is honestly disabled with the reason.
        expect(
          _actionLabelled(tester, 'Démarrer la génération').onPressed,
          isNull,
        );
        expect(
          find.text('Au moins 40 caractères sont requis.'),
          findsOneWidget,
        );

        await tester.enterText(field, 'x' * 60);
        await tester.pumpAndSettle();
        expect(find.text('60 / 8000'), findsOneWidget);
        expect(
          _actionLabelled(tester, 'Démarrer la génération').onPressed,
          isNotNull,
        );

        await tester.tap(find.text('Démarrer la génération'));
        await tester.pumpAndSettle();

        // Same server pipeline as before, and the document is downloadable.
        expect(ws.repo.journalGenerations.single, 'TEXT:${'x' * 60}');
        expect(find.text('Télécharger le document'), findsOneWidget);
      },
    );

    testWidgets('generated document can be downloaded from the text screen', (
      tester,
    ) async {
      final ws = await _pumpSheet(tester);
      await tester.tap(find.text('À partir de mon texte'));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), 'y' * 60);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Démarrer la génération'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Télécharger le document'));
      await tester.pumpAndSettle();
      // The PDF left the backend and reached the platform share sheet.
      expect(ws.shared, isNotEmpty);
    });

    testWidgets('a failed generation keeps the text and offers retry', (
      tester,
    ) async {
      final repo = FakeInternshipRepository()
        ..journalGenerationError = const ApiException(
          kind: ApiErrorKind.server,
          statusCode: 503,
          code: 'AI_GENERATION_FAILED',
          message: 'schema mismatch',
        );
      await _pumpSheet(tester, fake: repo);
      await tester.tap(find.text('À partir de mon texte'));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), 'z' * 60);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Démarrer la génération'));
      await tester.pumpAndSettle();

      // A format failure is NO LONGER reported as "service unavailable":
      // it keeps its own, actionable sentence.
      expect(find.textContaining('format'), findsWidgets);
      expect(
        find.textContaining('Le service IA est indisponible'),
        findsNothing,
      );
      expect(find.text('Réessayer'), findsWidgets);
      // The description is never lost.
      expect(find.text('z' * 60), findsOneWidget);
    });

    testWidgets('a warning from the backend is repeated on the result', (
      tester,
    ) async {
      final repo = FakeInternshipRepository()
        ..journalEntriesResult = const JournalEntriesResult(
          deliverableId: 'del-journal-entries',
          title: 'Journal de stage (journal saisi) — INT-2026-00001',
          status: DeliverableStatus.draft,
          currentVersion: 2,
          fileName: 'journal-de-stage-INT-2026-00001.pdf',
          source: 'JOURNAL_ENTRIES',
          entryCount: 3,
          dayCount: 2,
          firstDate: '2026-01-05',
          lastDate: '2026-01-09',
          pageCount: 2,
          replacedDraft: true,
          previousSubmitted: false,
        );
      await _pumpSheet(tester, fake: repo, eligibility: _eligible);

      await tester.tap(find.text('À partir de mes tâches'));
      await tester.pumpAndSettle();

      // S8: the document reports what it actually holds. The old task-ratio
      // warning is gone on purpose — tasks no longer describe this PDF.
      expect(find.text('Entrées incluses'), findsOneWidget);
      expect(find.text('Jours documentés'), findsOneWidget);
      expect(find.text('05/01/2026 → 09/01/2026'), findsOneWidget);
      expect(find.textContaining('Seulement 1 sur 3 tâches'), findsNothing);
    });

    testWidgets('a submitted journal stays immutable and the student is told', (
      tester,
    ) async {
      final repo = FakeInternshipRepository()
        ..journalEntriesResult = const JournalEntriesResult(
          deliverableId: 'del-journal-entries-2',
          title: 'Journal de stage (journal saisi) — INT-2026-00001 (nouveau)',
          status: DeliverableStatus.draft,
          currentVersion: 1,
          fileName: 'journal-de-stage-INT-2026-00001.pdf',
          source: 'JOURNAL_ENTRIES',
          entryCount: 7,
          dayCount: 4,
          firstDate: '2026-01-05',
          lastDate: '2026-02-02',
          pageCount: 2,
          replacedDraft: false,
          previousSubmitted: true,
        );
      await _pumpSheet(tester, fake: repo);

      await tester.tap(find.text('À partir de mes tâches'));
      await tester.pumpAndSettle();

      expect(
        find.text(
          'Un journal avait déjà été soumis : cette version est un nouveau brouillon.',
        ),
        findsOneWidget,
      );
    });

    testWidgets('the flow is localized (en)', (tester) async {
      final repo = FakeInternshipRepository();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            internshipRepositoryProvider.overrideWithValue(repo),
            isOnlineProvider.overrideWith((ref) => true),
            shareFnProvider.overrideWithValue((_, _) async {}),
          ],
          child: MaterialApp(
            locale: const Locale('en'),
            supportedLocales: StegLocales.supported,
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            theme: StegTheme.light(),
            home: const Scaffold(
              body: JournalGenerationBar(internshipId: 'internship-1'),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Generate the internship journal'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('From my tasks'));
      await tester.pumpAndSettle();

      // S8: the English flow routes to the dedicated page and reports the
      // entry-based facts, fully localized.
      expect(find.byType(JournalAiGenerateScreen), findsOneWidget);
      expect(find.text('Your document is ready'), findsOneWidget);
      expect(find.text('Entries included'), findsOneWidget);
      expect(find.text('Download the document'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
