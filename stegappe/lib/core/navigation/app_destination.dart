/// Screens a notification or a home shortcut can open.
///
/// Five of these are shell tabs (see the role shells in
/// `features/shell/presentation/role_shells.dart`). `journal` (interns) and
/// `validations` (supervisors) are reached as pushed routes on top of the
/// shell, so they never occupy a tab slot.
enum AppDestination {
  home,
  tasks,
  interns,
  community,
  journal,
  validations,
  messages,
  profile,
}
