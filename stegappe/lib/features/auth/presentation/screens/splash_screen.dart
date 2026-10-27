import 'package:flutter/material.dart';

import '../../../../core/l10n/app_localizations.dart';
import '../../../../core/theme/steg_colors.dart';
import '../../../../core/theme/steg_motion.dart';
import '../../../../core/theme/steg_spacing.dart';

/// Branded first frame, shown while [AuthGate] restores the session.
///
/// Two constraints drive this screen:
///  * the **official** STEG logo is a blue wordmark plus a red/blue emblem.
///    Tinted flat white (the previous treatment) the emblem lost its red flame,
///    and laid directly on the navy hero the unaltered blue measures ~1.6:1 —
///    so the logo sits on a light brand plate, undistorted and un-recoloured;
///  * the sequence is decorative, so it must never *delay* authentication and
///    must collapse to a static frame when the platform asks for reduced
///    motion.
///
/// The matching native launch screen (Android `launch_background`, iOS
/// `LaunchScreen.storyboard`) uses the same navy background and the white
/// wordmark, so the hand-off from the OS window to Flutter is seamless.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final reduceMotion = MediaQuery.of(context).disableAnimations;

    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: StegColors.heroGradient,
            stops: StegColors.heroStops,
          ),
        ),
        child: Stack(
          children: [
            const _HeroOrbs(),
            SafeArea(
              child: LayoutBuilder(
                builder: (context, constraints) => SingleChildScrollView(
                  physics: const ClampingScrollPhysics(),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight: constraints.maxHeight,
                    ),
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: StegSpacing.xl,
                          vertical: StegSpacing.lg,
                        ),
                        child: _SplashContent(
                          l10n: l10n,
                          animated: !reduceMotion,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Two soft orbs that give the flat navy a sense of depth without competing
/// with the logo. Purely decorative and cheap (no blur, no shader).
class _HeroOrbs extends StatelessWidget {
  const _HeroOrbs();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Stack(
        children: [
          PositionedDirectional(
            top: -90,
            end: -70,
            child: _Orb(size: 260, alpha: 0.06),
          ),
          PositionedDirectional(
            bottom: -110,
            start: -80,
            child: _Orb(size: 320, alpha: 0.05),
          ),
        ],
      ),
    );
  }
}

class _Orb extends StatelessWidget {
  const _Orb({required this.size, required this.alpha});

  final double size;
  final double alpha;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white.withValues(alpha: alpha),
      ),
    );
  }
}

class _SplashContent extends StatefulWidget {
  const _SplashContent({required this.l10n, required this.animated});

  final AppLocalizations l10n;
  final bool animated;

  @override
  State<_SplashContent> createState() => _SplashContentState();
}

class _SplashContentState extends State<_SplashContent>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  /// Logo: 0.96 → 1.0 with a gentle fade — the sequence the brand skill asks
  /// for (no bounce, no rotation, no game-intro motion).
  late final Animation<double> _logoScale;
  late final Animation<double> _logoFade;

  /// Wordmark + tagline appear slightly after the logo, so the eye lands on the
  /// emblem first.
  late final Animation<double> _textFade;
  late final Animation<Offset> _textSlide;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: StegMotion.medium);
    _logoScale = Tween<double>(begin: 0.96, end: 1).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0, 0.6, curve: Curves.easeOutCubic),
      ),
    );
    _logoFade = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0, 0.5, curve: Curves.easeOut),
    );
    _textFade = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.3, 1, curve: Curves.easeOut),
    );
    _textSlide = Tween<Offset>(begin: const Offset(0, 0.12), end: Offset.zero)
        .animate(
          CurvedAnimation(
            parent: _controller,
            curve: const Interval(0.3, 1, curve: Curves.easeOutCubic),
          ),
        );
    if (widget.animated) {
      _controller.forward();
    } else {
      _controller.value = 1;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        FadeTransition(
          opacity: _logoFade,
          child: ScaleTransition(scale: _logoScale, child: const _BrandPlate()),
        ),
        const SizedBox(height: StegSpacing.lg),
        FadeTransition(
          opacity: _textFade,
          child: SlideTransition(
            position: _textSlide,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Semantics(
                  header: true,
                  child: Text(
                    widget.l10n.brandName,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      height: 1.3,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.4,
                    ),
                  ),
                ),
                const SizedBox(height: StegSpacing.xs),
                Text(
                  widget.l10n.brandTagline,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.82),
                    fontSize: 14,
                    height: 1.4,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: StegSpacing.xxl),
        const _SplashProgress(),
      ],
    );
  }
}

/// Light plate holding the official logo at its natural 1200×327 ratio.
///
/// The plate exists so the logo keeps its real colours (blue wordmark, red
/// flame) with the clear space the brand requires, on top of the navy hero.
class _BrandPlate extends StatelessWidget {
  const _BrandPlate();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: StegSpacing.lg,
        vertical: StegSpacing.md,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
        boxShadow: const [
          BoxShadow(
            color: StegColors.shadowDark,
            blurRadius: 24,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: ConstrainedBox(
        // 220 dp wide keeps the 3.67:1 lockup legible on a 320 px phone while
        // never stretching it (BoxFit.contain preserves the aspect ratio).
        constraints: const BoxConstraints(maxWidth: 220),
        child: Image.asset(
          'assets/logo-steg-1200x327.png',
          fit: BoxFit.contain,
          height: 56,
          semanticLabel: l10n.appTitle,
          errorBuilder: (_, _, _) => const _FallbackLogo(),
        ),
      ),
    );
  }
}

/// Shown only if the packaged asset is missing: never a broken-image box.
class _FallbackLogo extends StatelessWidget {
  const _FallbackLogo();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: 56,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.bolt_rounded, color: StegColors.brandPrimary, size: 30),
          SizedBox(width: StegSpacing.xs),
          Text(
            'STEG',
            style: TextStyle(
              color: StegColors.brandNavy,
              fontSize: 28,
              fontWeight: FontWeight.w800,
              letterSpacing: 3,
            ),
          ),
        ],
      ),
    );
  }
}

/// Indeterminate brand progress bar. Single `liveRegion` announcement so a
/// screen reader says "loading" once instead of on every frame.
class _SplashProgress extends StatelessWidget {
  const _SplashProgress();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      label: AppLocalizations.of(context).loading,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(StegSpacing.radiusFull),
        child: SizedBox(
          width: 132,
          child: LinearProgressIndicator(
            minHeight: 4,
            color: Colors.white,
            backgroundColor: Colors.white.withValues(alpha: 0.22),
          ),
        ),
      ),
    );
  }
}
