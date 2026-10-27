import 'package:flutter/material.dart';

import 'steg_colors.dart';
import 'steg_spacing.dart';

/// STEG light/dark themes — futuristic 2026 design system.
///
/// Design language: navy-dark backgrounds, vibrant blue primary,
/// glass-style surfaces, pill shapes, generous radii, deep shadows with glow.
/// Font stack keeps system fonts with broad Arabic coverage.
abstract final class StegTheme {
  static const _fontStack = <String>[
    'Segoe UI',
    'Noto Sans Arabic',
    'Roboto',
    '.SF UI Text',
    'sans-serif',
  ];

  static TextTheme _textTheme(Color primary, Color secondary) => TextTheme(
    displayLarge: TextStyle(
      fontSize: 44,
      height: 1.2,
      fontWeight: FontWeight.w900,
      color: primary,
      fontFamilyFallback: _fontStack,
      letterSpacing: -1,
    ),
    headlineLarge: TextStyle(
      fontSize: 32,
      height: 1.2,
      fontWeight: FontWeight.w900,
      color: primary,
      fontFamilyFallback: _fontStack,
      letterSpacing: -0.5,
    ),
    headlineMedium: TextStyle(
      fontSize: 26,
      height: 1.25,
      fontWeight: FontWeight.w800,
      color: primary,
      fontFamilyFallback: _fontStack,
      letterSpacing: -0.4,
    ),
    titleLarge: TextStyle(
      fontSize: 22,
      height: 1.3,
      fontWeight: FontWeight.w800,
      color: primary,
      fontFamilyFallback: _fontStack,
      letterSpacing: -0.3,
    ),
    titleMedium: TextStyle(
      fontSize: 17,
      height: 1.4,
      fontWeight: FontWeight.w700,
      color: primary,
      fontFamilyFallback: _fontStack,
      letterSpacing: -0.1,
    ),
    bodyLarge: TextStyle(
      fontSize: 16,
      height: 1.55,
      fontWeight: FontWeight.w400,
      color: primary,
      fontFamilyFallback: _fontStack,
    ),
    bodyMedium: TextStyle(
      fontSize: 14,
      height: 1.55,
      fontWeight: FontWeight.w400,
      color: primary,
      fontFamilyFallback: _fontStack,
    ),
    labelLarge: TextStyle(
      fontSize: 14,
      height: 1.4,
      fontWeight: FontWeight.w700,
      color: primary,
      fontFamilyFallback: _fontStack,
      letterSpacing: 0.1,
    ),
    bodySmall: TextStyle(
      fontSize: 12.5,
      height: 1.5,
      fontWeight: FontWeight.w400,
      color: secondary,
      fontFamilyFallback: _fontStack,
    ),
  );

  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: StegColors.brandPrimary,
      primary: StegColors.brandPrimary,
      secondary: StegColors.communityAccent,
      tertiary: StegColors.aiAccent,
      error: StegColors.brandRed,
      surface: StegColors.lightSurface,
    );
    final textTheme = _textTheme(
      StegColors.lightTextPrimary,
      StegColors.lightTextSecondary,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme.copyWith(
        primary: StegColors.brandPrimary,
        onPrimary: Colors.white,
        secondary: StegColors.communityAccent,
        tertiary: StegColors.aiAccent,
        error: StegColors.brandRed,
        surface: StegColors.lightSurface,
        surfaceContainerHighest: const Color(0xFFE8EEF5),
      ),
      scaffoldBackgroundColor: const Color(0xFFF0F4F8),
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: StegColors.brandNavy,
        foregroundColor: Colors.white,
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        titleTextStyle: const TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w800,
          color: Colors.white,
          letterSpacing: -0.3,
        ),
        surfaceTintColor: Colors.transparent,
        shadowColor: StegColors.brandNavy.withValues(alpha: 0.4),
      ),
      cardTheme: CardThemeData(
        color: StegColors.lightSurface,
        elevation: 0,
        shadowColor: StegColors.shadowLight,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
          side: const BorderSide(color: StegColors.lightBorder),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFFEDF2F7),
        hintStyle: const TextStyle(color: StegColors.lightTextSecondary),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
          borderSide: const BorderSide(
            color: StegColors.lightBorder,
            width: 1.5,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
          borderSide: const BorderSide(
            color: StegColors.brandPrimary,
            width: 2,
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
          borderSide: const BorderSide(color: StegColors.brandRed, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: StegSpacing.md,
          vertical: StegSpacing.sm,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: StegColors.brandPrimary,
          foregroundColor: Colors.white,
          elevation: 0,
          shadowColor: Colors.transparent,
          minimumSize: const Size(
            StegSpacing.minTouchTarget,
            StegSpacing.minTouchTarget,
          ),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.1,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: StegColors.brandPrimary,
          minimumSize: const Size(
            StegSpacing.minTouchTarget,
            StegSpacing.minTouchTarget,
          ),
          side: const BorderSide(
            color: StegColors.lightBorder,
            width: 1.5,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: StegColors.brandPrimary,
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(StegSpacing.radiusSm),
          ),
        ),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: StegColors.brandPrimary,
        foregroundColor: Colors.white,
        elevation: 8,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(20)),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: StegColors.brandNavy,
        indicatorColor: StegColors.primaryBright.withValues(alpha: 0.22),
        labelTextStyle: WidgetStatePropertyAll(
          const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: Colors.white,
            fontFamilyFallback: _fontStack,
          ),
        ),
        iconTheme: const WidgetStatePropertyAll(
          IconThemeData(color: Colors.white),
        ),
        surfaceTintColor: Colors.transparent,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: const Color(0xFFEDF2F7),
        selectedColor: StegColors.brandPrimary,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(StegSpacing.radiusFull),
        ),
        side: const BorderSide(color: StegColors.lightBorder),
        labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
      ),
      listTileTheme: const ListTileThemeData(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(14)),
        ),
        contentPadding: EdgeInsets.symmetric(
          horizontal: StegSpacing.md,
          vertical: StegSpacing.xs,
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: StegColors.lightBorder,
        thickness: 1,
        space: 1,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: StegColors.lightSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        showDragHandle: true,
        dragHandleColor: StegColors.lightBorder,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: StegColors.lightSurface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(28)),
        ),
        elevation: 24,
        shadowColor: StegColors.brandNavy.withValues(alpha: 0.3),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: StegColors.brandNavy,
        contentTextStyle: const TextStyle(color: Colors.white),
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        behavior: SnackBarBehavior.floating,
        elevation: 12,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: StegColors.brandPrimary,
        linearMinHeight: 8,
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected)
              ? Colors.white
              : StegColors.lightTextSecondary,
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected)
              ? StegColors.brandPrimary
              : const Color(0xFFCDD5E0),
        ),
      ),
    );
  }

  static ThemeData dark() {
    final scheme = ColorScheme.fromSeed(
      seedColor: StegColors.brandPrimary,
      brightness: Brightness.dark,
      primary: StegColors.primaryBright,
      secondary: StegColors.communityAccentDark,
      tertiary: StegColors.aiAccentDark,
      error: StegColors.brandRed,
      surface: StegColors.darkSurface,
    );
    final textTheme = _textTheme(
      StegColors.darkTextPrimary,
      StegColors.darkTextSecondary,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme.copyWith(
        primary: StegColors.primaryBright,
        onPrimary: StegColors.brandNavy,
        secondary: StegColors.communityAccentDark,
        tertiary: StegColors.aiAccentDark,
        error: StegColors.errorDark,
        surface: StegColors.darkSurface,
        surfaceContainerHighest: StegColors.darkElevated,
      ),
      scaffoldBackgroundColor: const Color(0xFF07141F),
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: const Color(0xFF07141F),
        foregroundColor: StegColors.darkTextPrimary,
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        titleTextStyle: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w800,
          color: StegColors.darkTextPrimary,
          letterSpacing: -0.3,
        ),
        surfaceTintColor: Colors.transparent,
      ),
      cardTheme: CardThemeData(
        color: StegColors.darkSurface,
        elevation: 0,
        shadowColor: Colors.black54,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
          side: const BorderSide(color: StegColors.darkBorder),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: StegColors.darkElevated,
        hintStyle: const TextStyle(color: StegColors.darkTextSecondary),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
          borderSide: const BorderSide(
            color: StegColors.darkBorder,
            width: 1.5,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
          borderSide: const BorderSide(
            color: StegColors.primaryBright,
            width: 2,
          ),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: StegSpacing.md,
          vertical: StegSpacing.sm,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: StegColors.primaryBright,
          foregroundColor: StegColors.brandNavy,
          elevation: 0,
          minimumSize: const Size(
            StegSpacing.minTouchTarget,
            StegSpacing.minTouchTarget,
          ),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.1,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: StegColors.darkTextPrimary,
          minimumSize: const Size(
            StegSpacing.minTouchTarget,
            StegSpacing.minTouchTarget,
          ),
          side: const BorderSide(color: StegColors.darkBorder, width: 1.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: StegColors.primaryBright,
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(StegSpacing.radiusSm),
          ),
        ),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: StegColors.primaryBright,
        foregroundColor: StegColors.brandNavy,
        elevation: 8,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(20)),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: StegColors.darkSurface,
        indicatorColor: StegColors.primaryBright.withValues(alpha: 0.22),
        labelTextStyle: WidgetStatePropertyAll(
          TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: StegColors.darkTextPrimary,
            fontFamilyFallback: _fontStack,
          ),
        ),
        surfaceTintColor: Colors.transparent,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: StegColors.darkElevated,
        selectedColor: StegColors.primaryBright,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(StegSpacing.radiusFull),
        ),
        side: const BorderSide(color: StegColors.darkBorder),
        labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
      ),
      listTileTheme: const ListTileThemeData(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(14)),
        ),
        contentPadding: EdgeInsets.symmetric(
          horizontal: StegSpacing.md,
          vertical: StegSpacing.xs,
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: StegColors.darkBorder,
        thickness: 1,
        space: 1,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: StegColors.darkSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        showDragHandle: true,
        dragHandleColor: StegColors.darkBorder,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: StegColors.darkSurface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(28)),
        ),
        elevation: 32,
        shadowColor: Colors.black.withValues(alpha: 0.5),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: StegColors.darkElevated,
        contentTextStyle: const TextStyle(color: Colors.white),
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        behavior: SnackBarBehavior.floating,
        elevation: 12,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: StegColors.primaryBright,
        linearMinHeight: 8,
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected)
              ? StegColors.brandNavy
              : StegColors.darkTextSecondary,
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected)
              ? StegColors.primaryBright
              : StegColors.darkBorder,
        ),
      ),
    );
  }
}
