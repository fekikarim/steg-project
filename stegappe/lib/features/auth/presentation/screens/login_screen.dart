import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/app_localizations.dart';
import '../../../../core/theme/steg_colors.dart';
import '../../../../core/theme/steg_motion.dart';
import '../../../../core/theme/steg_spacing.dart';
import '../../domain/entities/app_user.dart';
import '../providers/auth_providers.dart';

/// Which space the user signs into. The backend decides the actual role; this
/// choice only guards against signing into the wrong space by mistake.
enum LoginAudience { intern, supervisor }

/// STEG sign-in (design: navy brand hero, white rounded form sheet).
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _emailFocus = FocusNode();
  final _passwordFocus = FocusNode();
  LoginAudience _audience = LoginAudience.intern;
  bool _obscure = true;
  bool _submitting = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _emailFocus.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  String? _emailError(AuthState state) {
    if (state is! AuthUnauthenticated) return null;
    return ref
        .read(authControllerProvider.notifier)
        .lastError
        ?.fieldMessage('email');
  }

  String? _passwordError(AuthState state) {
    if (state is! AuthUnauthenticated) return null;
    return ref
        .read(authControllerProvider.notifier)
        .lastError
        ?.fieldMessage('password');
  }

  bool _matchesAudience(UserRole role) => switch (_audience) {
    LoginAudience.intern => role == UserRole.intern,
    LoginAudience.supervisor =>
      role == UserRole.supervisor || role == UserRole.adminSupervisor,
  };

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    final email = _email.text.trim();
    if (!email.contains('@')) {
      _showSnack(l10n.emailRequired);
      return;
    }
    if (_password.text.isEmpty) {
      _showSnack(l10n.passwordRequired);
      return;
    }
    setState(() => _submitting = true);
    try {
      final notifier = ref.read(authControllerProvider.notifier);
      await notifier.login(email: email, password: _password.text);
      final state = ref.read(authControllerProvider);
      if (!mounted || state is! AuthAuthenticated) return;
      if (!_matchesAudience(state.user.mobileRole)) {
        await notifier.logout();
        if (!mounted) return;
        _showSnack(
          _audience == LoginAudience.intern
              ? l10n.loginWrongAudienceIntern
              : l10n.loginWrongAudienceSupervisor,
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: StegColors.brandNavy,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  void _showHelp(String title, String body) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(AppLocalizations.of(ctx).cancelAction),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(authControllerProvider);
    final rawError = state is AuthUnauthenticated ? state.message : null;
    final topError = rawError == 'queue-auth-discarded'
        ? l10n.queueAuthDiscarded
        : rawError;
    final emailError = _emailError(state);
    final passwordError = _passwordError(state);
    final isLoading = _submitting || state is AuthLoading;
    final dark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      // Same colour as the form sheet, so any space below it blends in.
      backgroundColor: dark ? StegColors.darkPage : StegColors.lightSurface,
      resizeToAvoidBottomInset: true,
      body: _pasteShortcuts(
        target: () => _passwordFocus.hasFocus ? _password : _email,
        child: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _LoginHero(l10n: l10n),
              Container(
                padding: EdgeInsets.fromLTRB(
                  StegSpacing.lg,
                  StegSpacing.lg,
                  StegSpacing.lg,
                  StegSpacing.lg + MediaQuery.viewInsetsOf(context).bottom,
                ),
                decoration: BoxDecoration(
                  color: dark ? StegColors.darkPage : StegColors.lightSurface,
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(32),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _AudienceSwitch(
                      value: _audience,
                      onChanged: isLoading
                          ? null
                          : (a) => setState(() => _audience = a),
                      internLabel: l10n.roleIntern,
                      supervisorLabel: l10n.roleSupervisor,
                    ),
                    const SizedBox(height: StegSpacing.md),
                    _InfoNote(text: l10n.loginHint),
                    if (topError != null) ...[
                      const SizedBox(height: StegSpacing.md),
                      _ErrorNote(text: topError),
                    ],
                    const SizedBox(height: StegSpacing.lg),
                    _FieldLabel(text: l10n.email),
                    const SizedBox(height: StegSpacing.xs),
                    TextField(
                      controller: _email,
                      focusNode: _emailFocus,
                      enabled: !isLoading,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      textInputAction: TextInputAction.next,
                      autocorrect: false,
                      onSubmitted: (_) => _passwordFocus.requestFocus(),
                      decoration: _fieldDecoration(
                        context,
                        hint: l10n.emailHint,
                        icon: Icons.mail_outline,
                        errorText: emailError,
                      ),
                    ),
                    const SizedBox(height: StegSpacing.md),
                    Row(
                      children: [
                        Expanded(child: _FieldLabel(text: l10n.password)),
                        TextButton(
                          onPressed: () => _showHelp(
                            l10n.loginForgotTitle,
                            l10n.loginForgotBody,
                          ),
                          child: Text(l10n.loginForgot),
                        ),
                      ],
                    ),
                    TextField(
                      controller: _password,
                      focusNode: _passwordFocus,
                      enabled: !isLoading,
                      obscureText: _obscure,
                      autofillHints: const [AutofillHints.password],
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) => isLoading ? null : _submit(),
                      contextMenuBuilder: (ctx, editable) =>
                          _adaptiveContextMenu(ctx, editable, _password),
                      decoration: _fieldDecoration(
                        context,
                        hint: l10n.password,
                        icon: Icons.lock_outline,
                        errorText: passwordError,
                        suffix: TextButton(
                          onPressed: () => setState(() => _obscure = !_obscure),
                          child: Text(
                            _obscure ? l10n.showPassword : l10n.hidePassword,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: StegSpacing.lg),
                    _SubmitButton(
                      label: l10n.loginAction,
                      isLoading: isLoading,
                      onPressed: isLoading ? null : _submit,
                    ),
                    const SizedBox(height: StegSpacing.md),
                    Wrap(
                      alignment: WrapAlignment.center,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          l10n.loginNeedHelp,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        TextButton(
                          onPressed: () => _showHelp(
                            l10n.aboutSupport,
                            l10n.aboutSupportBody,
                          ),
                          child: Text(l10n.loginContactSupport),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _fieldDecoration(
    BuildContext context, {
    required String hint,
    required IconData icon,
    String? errorText,
    Widget? suffix,
  }) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
      borderSide: BorderSide(
        color: dark ? StegColors.darkBorder : StegColors.lightBorder,
      ),
    );
    return InputDecoration(
      hintText: hint,
      prefixIcon: Icon(icon, size: 20),
      suffixIcon: suffix,
      errorText: errorText,
      filled: true,
      fillColor: dark ? StegColors.darkSurface : StegColors.lightPage,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: StegSpacing.md,
        vertical: 14,
      ),
      border: border,
      enabledBorder: border,
      focusedBorder: border.copyWith(
        borderSide: const BorderSide(
          color: StegColors.brandPrimary,
          width: 1.6,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand hero: logo mark, product name, eyebrow and welcome headline.
// ─────────────────────────────────────────────────────────────────────────────

class _LoginHero extends StatelessWidget {
  const _LoginHero({required this.l10n});

  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: StegColors.heroGradient,
          stops: StegColors.heroStops,
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            StegSpacing.lg,
            StegSpacing.lg,
            StegSpacing.lg,
            StegSpacing.xl,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Image.asset(
                      'assets/android-chrome-192x192.png',
                      semanticLabel: 'STEG',
                      errorBuilder: (_, _, _) => const SizedBox.shrink(),
                    ),
                  ),
                  const SizedBox(width: StegSpacing.md),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text.rich(
                        TextSpan(
                          children: [
                            const TextSpan(text: 'STEG '),
                            TextSpan(
                              text: 'Intern',
                              style: TextStyle(color: StegColors.primaryBright),
                            ),
                          ],
                        ),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        l10n.loginBrandTagline,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.75),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: StegSpacing.xl),
              Text(
                l10n.loginEyebrow.toUpperCase(),
                style: TextStyle(
                  color: StegColors.primaryBright,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.4,
                ),
              ),
              const SizedBox(height: StegSpacing.xs),
              Text(
                l10n.loginWelcome,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 40,
                  fontWeight: FontWeight.w800,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: StegSpacing.sm),
              Text(
                l10n.loginSubtitle,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.78),
                  fontSize: 15,
                  height: 1.45,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Two-option audience switch (Stagiaire / Encadrant), a segmented control.
class _AudienceSwitch extends StatelessWidget {
  const _AudienceSwitch({
    required this.value,
    required this.onChanged,
    required this.internLabel,
    required this.supervisorLabel,
  });

  final LoginAudience value;
  final ValueChanged<LoginAudience>? onChanged;
  final String internLabel;
  final String supervisorLabel;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: dark ? StegColors.darkSurface : StegColors.lightTrack,
        borderRadius: BorderRadius.circular(StegSpacing.radiusFull),
      ),
      child: Row(
        children: [
          for (final option in LoginAudience.values)
            Expanded(
              child: _AudienceOption(
                label: option == LoginAudience.intern
                    ? internLabel
                    : supervisorLabel,
                selected: option == value,
                onTap: onChanged == null ? null : () => onChanged!(option),
              ),
            ),
        ],
      ),
    );
  }
}

class _AudienceOption extends StatelessWidget {
  const _AudienceOption({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: StegMotion.fast,
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected
                ? (dark ? StegColors.darkElevated : Colors.white)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(StegSpacing.radiusFull),
            boxShadow: selected ? StegColors.cardShadow(dark) : null,
          ),
          child: Text(
            label,
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: selected
                  ? (dark ? Colors.white : StegColors.brandNavy)
                  : (dark
                        ? StegColors.darkTextSecondary
                        : StegColors.lightTextSecondary),
            ),
          ),
        ),
      ),
    );
  }
}

class _InfoNote extends StatelessWidget {
  const _InfoNote({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(StegSpacing.md),
      decoration: BoxDecoration(
        color: StegColors.primaryBright.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.info_outline,
            size: 18,
            color: StegColors.brandPrimary,
          ),
          const SizedBox(width: StegSpacing.sm),
          Expanded(
            child: Text(text, style: Theme.of(context).textTheme.bodySmall),
          ),
        ],
      ),
    );
  }
}

class _ErrorNote extends StatelessWidget {
  const _ErrorNote({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final tone = dark ? StegColors.errorDark : StegColors.error;
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.all(StegSpacing.md),
        decoration: BoxDecoration(
          color: tone.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
          border: Border.all(color: tone.withValues(alpha: 0.4)),
        ),
        child: Row(
          children: [
            Icon(Icons.error_outline, size: 18, color: tone),
            const SizedBox(width: StegSpacing.sm),
            Expanded(
              child: Text(
                text,
                style: TextStyle(color: tone, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(context).textTheme.labelLarge
          ?.copyWith(fontWeight: FontWeight.w700),
    );
  }
}

class _SubmitButton extends StatelessWidget {
  const _SubmitButton({
    required this.label,
    required this.isLoading,
    required this.onPressed,
  });

  final String label;
  final bool isLoading;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 56,
      child: FilledButton(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: StegColors.brandNavy,
          foregroundColor: Colors.white,
          disabledBackgroundColor: StegColors.brandNavy.withValues(alpha: 0.6),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(StegSpacing.radiusMd),
          ),
        ),
        child: isLoading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.4,
                  color: Colors.white,
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(width: StegSpacing.sm),
                  const Icon(Icons.arrow_forward, size: 18),
                ],
              ),
      ),
    );
  }
}

/// Cmd+V / Ctrl+V paste into whichever login field has focus. Some platforms
/// do not route the paste shortcut into secure/custom fields, so it is handled
/// here, with the text field's own shortcuts still taking precedence.
Widget _pasteShortcuts({
  required TextEditingController Function() target,
  required Widget child,
}) {
  return Actions(
    actions: <Type, Action<Intent>>{
      PasteTextIntent: CallbackAction<PasteTextIntent>(
        onInvoke: (PasteTextIntent intent) async {
          await _pasteIntoController(target());
          return null;
        },
      ),
    },
    child: Shortcuts(
      shortcuts: <ShortcutActivator, Intent>{
        LogicalKeySet(LogicalKeyboardKey.meta, LogicalKeyboardKey.keyV):
            const PasteTextIntent(SelectionChangedCause.keyboard),
        LogicalKeySet(LogicalKeyboardKey.control, LogicalKeyboardKey.keyV):
            const PasteTextIntent(SelectionChangedCause.keyboard),
      },
      child: child,
    ),
  );
}

/// Paste-aware text selection menu: iOS sometimes omits "Paste" from the
/// system toolbar for secure fields, so it is always offered first.
Widget _adaptiveContextMenu(
  BuildContext context,
  EditableTextState editableTextState,
  TextEditingController controller,
) {
  final buttonItems = editableTextState.contextMenuButtonItems;
  final hasPaste = buttonItems.any(
    (item) => item.type == ContextMenuButtonType.paste,
  );
  if (!hasPaste) {
    buttonItems.insert(
      0,
      ContextMenuButtonItem(
        type: ContextMenuButtonType.paste,
        onPressed: () {
          _pasteIntoController(controller);
          editableTextState.hideToolbar();
        },
      ),
    );
  }
  return AdaptiveTextSelectionToolbar.buttonItems(
    anchors: editableTextState.contextMenuAnchors,
    buttonItems: buttonItems,
  );
}

Future<void> _pasteIntoController(TextEditingController controller) async {
  try {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final text = data?.text?.trim();
    if (text != null && text.isNotEmpty) {
      final selection = controller.selection;
      if (selection.isValid &&
          selection.start >= 0 &&
          selection.end >= selection.start) {
        final old = controller.text;
        final newText = old.replaceRange(selection.start, selection.end, text);
        controller.value = TextEditingValue(
          text: newText,
          selection: TextSelection.collapsed(
            offset: selection.start + text.length,
          ),
        );
      } else {
        controller.value = TextEditingValue(
          text: text,
          selection: TextSelection.collapsed(offset: text.length),
        );
      }
    }
  } catch (_) {}
}
