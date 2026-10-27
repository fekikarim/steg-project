import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stegappe/core/l10n/app_localizations.dart';
import 'package:stegappe/features/auth/domain/entities/app_user.dart';
import 'package:stegappe/features/auth/domain/repositories/auth_repository.dart';
import 'package:stegappe/features/auth/presentation/providers/auth_providers.dart';
import 'package:stegappe/features/auth/presentation/screens/login_screen.dart';

Future<AppLocalizations> loadL10n(String code) =>
    AppLocalizations.delegate.load(Locale(code));

/// Signs in as a fixed user; records sign-outs so the guard can be asserted.
class _LoginRepo implements AuthRepository {
  _LoginRepo(this.user);

  final AppUser user;
  int logoutCalls = 0;

  @override
  Future<AppUser> login({
    required String email,
    required String password,
  }) async => user;

  @override
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {}

  @override
  Future<void> logout() async => logoutCalls++;

  @override
  Future<bool> refreshSession() async => false;

  @override
  Future<AppUser?> restoreSession() async => null;
}

Future<void> _pumpLogin(WidgetTester tester, _LoginRepo repo) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [authRepositoryProvider.overrideWithValue(repo)],
      child: const MaterialApp(
        locale: Locale('fr'),
        localizationsDelegates: [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: [Locale('fr'), Locale('en'), Locale('ar')],
        home: LoginScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _signIn(WidgetTester tester, {required String audience}) async {
  // The sheet is taller than the test viewport: bring each control into view.
  Future<void> reach(Finder finder) async {
    await tester.ensureVisible(finder);
    await tester.pumpAndSettle();
  }

  await reach(find.text(audience));
  await tester.tap(find.text(audience));
  await tester.pumpAndSettle();
  await reach(find.byType(TextField).first);
  await tester.enterText(find.byType(TextField).first, 'user@steg.tn');
  await reach(find.byType(TextField).last);
  await tester.enterText(find.byType(TextField).last, 'secret-pass');
  await reach(find.text('Se connecter'));
  await tester.tap(find.text('Se connecter'));
  await tester.pumpAndSettle();
}

void main() {
  const intern = AppUser(id: 'i1', email: 'user@steg.tn', roles: ['INTERN']);
  const supervisor = AppUser(
    id: 's1',
    email: 'user@steg.tn',
    roles: ['SUPERVISOR'],
  );

  testWidgets(
    'an intern account signed into the Encadrant space is signed out',
    (tester) async {
      final l10n = await loadL10n('fr');
      final repo = _LoginRepo(intern);
      await _pumpLogin(tester, repo);

      await _signIn(tester, audience: l10n.roleSupervisor);

      expect(repo.logoutCalls, 1);
      expect(find.text(l10n.loginWrongAudienceSupervisor), findsOneWidget);
    },
  );

  testWidgets(
    'a supervisor account signed into the Stagiaire space is signed out',
    (tester) async {
      final l10n = await loadL10n('fr');
      final repo = _LoginRepo(supervisor);
      await _pumpLogin(tester, repo);

      await _signIn(tester, audience: l10n.roleIntern);

      expect(repo.logoutCalls, 1);
      expect(find.text(l10n.loginWrongAudienceIntern), findsOneWidget);
    },
  );

  testWidgets('a matching account stays signed in', (tester) async {
    final repo = _LoginRepo(intern);
    await _pumpLogin(tester, repo);

    final l10n = await loadL10n('fr');
    await _signIn(tester, audience: l10n.roleIntern);

    expect(repo.logoutCalls, 0);
  });
}
