import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stegappe/core/l10n/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:stegappe/core/connectivity/connectivity_service.dart';
import 'package:stegappe/core/network/api_exception.dart';
import 'package:stegappe/core/theme/steg_theme.dart';
import 'package:stegappe/features/auth/domain/entities/app_user.dart';
import 'package:stegappe/features/auth/domain/repositories/auth_repository.dart';
import 'package:stegappe/features/auth/presentation/providers/auth_providers.dart';
import 'package:stegappe/features/internship/domain/entities/work_items.dart';
import 'package:stegappe/features/internship/presentation/providers/journal_document_providers.dart';
import 'package:stegappe/features/internship/presentation/providers/workspace_providers.dart';
import 'package:stegappe/features/internship/presentation/screens/journal_ai_generate_screen.dart';
import 'package:stegappe/features/internship/presentation/screens/journal_generation_sheet.dart';
import 'package:stegappe/features/internship/presentation/screens/journal_list_screen.dart';
import 'package:stegappe/features/internship/presentation/services/file_share.dart';

import '../../test_fixtures.dart';

/// Intern account: the generation action is the student's own.
const _intern = AppUser(id: 'u1', email: 'intern@steg.tn', roles: ['INTERN']);

class _FakeAuth implements AuthRepository {
  _FakeAuth(this.user);
  final AppUser user;

  @override
  Future<AppUser> login({required String email, required String password}) =>
      throw UnimplementedError();
  @override
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {}
  @override
  Future<void> logout() async {}
  @override
  Future<bool> refreshSession() async => true;
  @override
  Future<AppUser?> restoreSession() async => user;
}

/// S8 — one workflow, two entry points.
///
/// The point these tests protect is not that a button renders: it is that
/// "Generate Journal with AI" (journal screen) and Tasks → Generate the
/// journal → "From my tasks" reach the SAME backend call and therefore the
/// same document, and that the page never fires twice or pretends a failure
/// did not happen.
void main() {
  group('S8 journal generation — both entry points, one workflow', () {
    late FakeInternshipRepository repo;
    late List<(Uint8List, String)> shared;

    setUp(() {
      repo = FakeInternshipRepository();
      shared = <(Uint8List, String)>[];
    });

    Future<void> pumpScreen(
      WidgetTester tester, {
      required Widget home,
      bool online = true,
      bool settle = true,
    }) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            internshipRepositoryProvider.overrideWithValue(repo),
            isOnlineProvider.overrideWith((ref) => online),
            shareFnProvider.overrideWithValue((bytes, fileName) async {
              shared.add((bytes, fileName));
            }),
            authRepositoryProvider.overrideWithValue(_FakeAuth(_intern)),
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
            home: home,
          ),
        ),
      );
      // The journal screen only shows the action to an authenticated intern.
      final ctx = tester.element(find.byType(MaterialApp));
      await ProviderScope.containerOf(ctx)
          .read(authControllerProvider.notifier)
          .bootstrap();
      if (settle) await tester.pumpAndSettle();
    }

    Widget openPage() =>
        const JournalAiGenerateScreen(internshipId: 'internship-1');

    // -----------------------------------------------------------------------
    // The dedicated page
    // -----------------------------------------------------------------------

    testWidgets(
      'autoStart: opens the page and generates from the entries endpoint',
      (tester) async {
        await pumpScreen(
          tester,
          home: const JournalAiGenerateScreen(
            internshipId: 'internship-1',
            autoStart: true,
          ),
        );

        expect(find.byType(JournalAiGenerateScreen), findsOneWidget);
        expect(repo.journalEntriesGenerations, ['ENTRIES']);
        // The summary tells the student what the document actually holds.
        expect(find.text('Entrées incluses'), findsOneWidget);
        expect(find.text('12'), findsWidgets);
        expect(find.text('Document prêt'), findsOneWidget);
        expect(find.text('05/01/2026 → 30/04/2026'), findsOneWidget);
      },
    );

    testWidgets(
      'without autoStart nothing is generated until the student asks',
      (tester) async {
        await pumpScreen(tester, home: openPage());

        expect(repo.journalEntriesGenerations, isEmpty);
        await tester.tap(find.text('Générer le document'));
        await tester.pumpAndSettle();

        expect(repo.journalEntriesGenerations, ['ENTRIES']);
      },
    );

    testWidgets(
      'a second tap while generating is refused: no duplicate request',
      (tester) async {
        final gate = Completer<void>();
        repo.journalEntriesGate = gate;
        // pump(), not pumpAndSettle(): the progress spinner animates forever
        // while the request is in flight.
        await pumpScreen(
          tester,
          home: const JournalAiGenerateScreen(
            internshipId: 'internship-1',
            autoStart: true,
          ),
          settle: false,
        );
        await tester.pump();

        expect(find.text('Génération du document…'), findsOneWidget);
        expect(repo.journalEntriesGenerations, ['ENTRIES']);

        // Asking again while one is in flight must not reach the backend again.
        final container = ProviderScope.containerOf(
          tester.element(find.byType(JournalAiGenerateScreen)),
        );
        await container
            .read(journalEntriesProvider.notifier)
            .generate('internship-1');
        await tester.pump();
        expect(repo.journalEntriesGenerations, ['ENTRIES']);

        gate.complete();
        await tester.pumpAndSettle();
        expect(repo.journalEntriesGenerations, ['ENTRIES']);
        expect(find.text('Document prêt'), findsOneWidget);
      },
    );

    testWidgets('the generated PDF can be downloaded from the page', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        home: const JournalAiGenerateScreen(
          internshipId: 'internship-1',
          autoStart: true,
        ),
      );

      await tester.tap(find.text('Télécharger le document'));
      await tester.pumpAndSettle();

      expect(shared, isNotEmpty);
      expect(shared.single.$2, 'journal-de-stage-INT-2026-00001.pdf');
    });

    testWidgets('a server failure is explained and can be retried', (
      tester,
    ) async {
      repo.journalEntriesError = const ApiException(
        kind: ApiErrorKind.server,
        statusCode: 503,
        code: 'AI_UNAVAILABLE',
        message: 'provider exploded',
      );
      await pumpScreen(tester, home: openPage());
      await tester.tap(find.text('Générer le document'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Réessayez'), findsOneWidget);
      expect(find.text('Réessayer'), findsOneWidget);
      // The raw provider sentence never reaches the UI.
      expect(find.textContaining('provider exploded'), findsNothing);

      repo.journalEntriesError = null;
      await tester.tap(find.text('Réessayer'));
      await tester.pumpAndSettle();

      expect(repo.journalEntriesGenerations, ['ENTRIES', 'ENTRIES']);
      expect(find.text('Document prêt'), findsOneWidget);
    });

    testWidgets('a shared-token mismatch is named as a configuration fault', (
      tester,
    ) async {
      // The backend and the AI service agreeing on the secret is a
      // configuration property, not an outage. When they drift apart every
      // call is refused with 401, and that used to be surfaced as "the AI
      // assistant is not enabled" — a lie that sent no one to the right fix.
      repo.journalEntriesError = const ApiException(
        kind: ApiErrorKind.server,
        statusCode: 503,
        code: 'AI_SERVICE_TOKEN_MISMATCH',
        message: 'the two services do not share the token',
      );
      await pumpScreen(tester, home: openPage());
      await tester.tap(find.text('Générer le document'));
      await tester.pumpAndSettle();

      // The student is told this is an administrator-side problem, and never
      // the misleading "AI is not enabled" sentence.
      expect(find.textContaining('clé d’accès'), findsOneWidget);
      expect(find.textContaining('administrateur'), findsOneWidget);
      expect(find.textContaining('n’est pas activé'), findsNothing);
      // The raw backend sentence never reaches the UI.
      expect(find.textContaining('do not share the token'), findsNothing);
    });

    testWidgets('offline is stated before any request is attempted', (
      tester,
    ) async {
      await pumpScreen(tester, home: openPage(), online: false);
      await tester.tap(find.text('Générer le document'));
      await tester.pumpAndSettle();

      expect(repo.journalEntriesGenerations, isEmpty);
      expect(
        find.text('Connexion requise pour générer le journal.'),
        findsOneWidget,
      );
    });

    testWidgets(
      'an empty journal is reported honestly, not as a blank success',
      (tester) async {
        repo.journalEntriesResult = const JournalEntriesResult(
          deliverableId: 'd',
          title: 'Journal de stage (journal saisi) — INT-2026-00001',
          status: DeliverableStatus.draft,
          currentVersion: 1,
          fileName: 'j.pdf',
          source: 'JOURNAL_ENTRIES',
          entryCount: 0,
          dayCount: 0,
          firstDate: '',
          lastDate: '',
          pageCount: 1,
          replacedDraft: false,
          previousSubmitted: false,
        );
        await pumpScreen(
          tester,
          home: const JournalAiGenerateScreen(
            internshipId: 'internship-1',
            autoStart: true,
          ),
        );

        expect(find.text('Document prêt'), findsOneWidget);
        expect(find.text('—'), findsOneWidget);
      },
    );

    // -----------------------------------------------------------------------
    // Entry point 1: the journal screen button
    // -----------------------------------------------------------------------

    testWidgets(
      'the journal screen exposes "Generate Journal with AI" and opens the page',
      (tester) async {
        await pumpScreen(
          tester,
          home: const Scaffold(body: JournalListScreen()),
        );

        final button = find.text('Générer le journal avec l’IA');
        expect(button, findsOneWidget);

        await tester.tap(button);
        await tester.pumpAndSettle();

        expect(find.byType(JournalAiGenerateScreen), findsOneWidget);
        expect(repo.journalEntriesGenerations, ['ENTRIES']);
      },
    );

    // -----------------------------------------------------------------------
    // Entry point 2: tasks → generate → "From my tasks"
    // -----------------------------------------------------------------------

    testWidgets(
      'Tasks → "From my tasks" opens the SAME page and hits the SAME endpoint',
      (tester) async {
        await pumpScreen(
          tester,
          home: const JournalGenerationBar(internshipId: 'internship-1'),
        );

        await tester.tap(find.text('Générer le journal de stage'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('À partir de mes tâches'));
        await tester.pumpAndSettle();

        expect(find.byType(JournalAiGenerateScreen), findsOneWidget);
        // Same call as the journal screen button — not the task-list workflow.
        expect(repo.journalEntriesGenerations, ['ENTRIES']);
        expect(repo.journalGenerations, isEmpty);
      },
    );

    testWidgets(
      '"From my tasks" no longer claims the task list is the source',
      (tester) async {
        await pumpScreen(
          tester,
          home: const JournalGenerationBar(internshipId: 'internship-1'),
        );

        await tester.tap(find.text('Générer le journal de stage'));
        await tester.pumpAndSettle();

        expect(find.textContaining('entrées de journal'), findsOneWidget);
        expect(find.textContaining('statuts sont assemblés'), findsNothing);
      },
    );
  });
}
