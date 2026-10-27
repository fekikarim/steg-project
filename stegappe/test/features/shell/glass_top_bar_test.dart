import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stegappe/core/widgets/steg_modern.dart';
import 'package:stegappe/core/widgets/user_avatar.dart';
import 'package:stegappe/features/auth/domain/entities/app_user.dart';

import '../../support/shell_harness.dart';

/// UI · the shell's top bar.
///
/// The bar is a *fully transparent* frosted overlay: no tint strip across the
/// top, a light blur, the profile avatar at the start (top-left) and the
/// notification bell at the end. Each tab keeps its first row clear of the bar
/// with [StegGlassBarSpacer] while its content still scrolls beneath the glass.
const _intern = AppUser(id: 'me', email: 'intern@steg.tn', roles: ['INTERN']);

void main() {
  testWidgets('transparent, lightly blurred bar with the avatar top-right', (
    tester,
  ) async {
    await pumpAuthGate(tester, user: _intern);

    final appBar = tester.widget<AppBar>(find.byType(AppBar).first);
    // Fully transparent: no background tint anywhere in the bar.
    expect(appBar.backgroundColor, Colors.transparent);
    expect(appBar.elevation, 0);
    expect(appBar.scrolledUnderElevation, 0);
    expect(appBar.automaticallyImplyLeading, isFalse);

    // A light frost wraps the bar — a *little* blur, not a heavy fog.
    final frost = tester.widget<BackdropFilter>(
      find
          .ancestor(
            of: find.byType(AppBar).first,
            matching: find.byType(BackdropFilter),
          )
          .first,
    );
    expect(frost.filter, ImageFilter.blur(sigmaX: 10, sigmaY: 10));

    // Profile avatar at the top-right (end) of the bar; the brand mark leads.
    final avatar = find.descendant(
      of: find.byType(AppBar).first,
      matching: find.byType(UserAvatar),
    );
    expect(avatar, findsOneWidget);
    final width = tester.view.physicalSize.width / tester.view.devicePixelRatio;
    expect(
      tester.getCenter(avatar).dx,
      greaterThan(width / 2),
      reason: 'the profile avatar sits at the end (top-right) of the bar',
    );
    expect(
      tester.getTopLeft(avatar).dy,
      lessThan(kToolbarHeight),
      reason: 'the avatar lives inside the bar, not below it',
    );

    // The page extends behind the bar, so the frost has content to blur.
    final scaffold = tester.widget<Scaffold>(find.byType(Scaffold).first);
    expect(
      scaffold.extendBodyBehindAppBar,
      isTrue,
      reason: 'the tab content must scroll beneath the transparent bar',
    );
    expect(
      tester.getTopLeft(find.byType(CustomScrollView).first).dy,
      0,
      reason: 'the scroll view starts at the top of the window',
    );
  });

  testWidgets('each tab reserves exactly the bar height for its first row', (
    tester,
  ) async {
    await pumpAuthGate(tester, user: _intern);

    final barHeight = tester.getSize(find.byType(AppBar).first).height;
    final inset = tester.widget<StegGlassBarInset>(
      find.byType(StegGlassBarInset),
    );
    expect(
      inset.height,
      barHeight,
      reason: 'the space reserved below the bar matches the real bar',
    );

    final spacer = find.byType(StegGlassBarSpacer);
    expect(spacer, findsWidgets);
    expect(
      tester.getSize(spacer.first).height,
      greaterThanOrEqualTo(barHeight),
      reason: 'the first row is pushed clear of the bar',
    );
    expect(
      tester.getTopLeft(spacer.first).dy,
      0,
      reason:
          'the reservation lives inside the scroll view, so content '
          'still scrolls beneath the bar',
    );
  });
}
