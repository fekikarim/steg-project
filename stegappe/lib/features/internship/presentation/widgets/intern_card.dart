import 'package:flutter/material.dart';

import '../../../../core/l10n/app_localizations.dart';
import '../../../../core/theme/steg_colors.dart';
import '../../../../core/theme/steg_spacing.dart';
import '../../../../core/widgets/steg_fields.dart';
import '../../../../core/widgets/steg_status_chip.dart';
import '../../domain/entities/evaluation.dart';
import '../widgets/status_labels.dart';
import '../screens/intern_detail_screen.dart';

/// Shared supervised-intern row: identity, reference, department,
/// attention badge vs status chip. Tapping opens the intern file.
/// With [onSelectionChanged], the row becomes selectable (T14 multi-select).
///
/// Modern finish: large radius, gradient avatar, brand shadow.
class InternCard extends StatelessWidget {
  const InternCard({
    super.key,
    required this.intern,
    this.selected = false,
    this.onSelectionChanged,
  });

  final SupervisedIntern intern;
  final bool selected;
  final ValueChanged<bool>? onSelectionChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context);
    final selectable = onSelectionChanged != null;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final scheme = Theme.of(context).colorScheme;
    final isSelected = selected && selectable;

    return Padding(
      padding: const EdgeInsets.only(bottom: StegSpacing.sm),
      child: Material(
        color: Colors.transparent,
        child: Card(
          elevation: 0,
          color: Colors.transparent,
          margin: EdgeInsets.zero,
          clipBehavior: Clip.antiAlias,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
          ),
          child: InkWell(
            onTap: selectable
                ? () => onSelectionChanged?.call(!selected)
                : () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) =>
                            InternDetailScreen(internshipId: intern.internshipId),
                      ),
                    ),
            borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
            child: Container(
              decoration: BoxDecoration(
                color: isSelected
                    ? scheme.primary.withValues(alpha: dark ? 0.18 : 0.07)
                    : (dark ? StegColors.darkSurface : Colors.white),
                borderRadius: BorderRadius.circular(StegSpacing.radiusLg),
                border: Border.all(
                  color: isSelected
                      ? scheme.primary.withValues(alpha: 0.4)
                      : (dark ? StegColors.darkBorder : StegColors.lightBorder),
                  width: isSelected ? 1.5 : 1,
                ),
                boxShadow: dark
                    ? [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.25),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ]
                    : [
                        BoxShadow(
                          color: StegColors.brandNavy.withValues(alpha: 0.07),
                          blurRadius: 16,
                          offset: const Offset(0, 5),
                        ),
                      ],
              ),
              padding: const EdgeInsets.symmetric(
                horizontal: StegSpacing.md,
                vertical: StegSpacing.sm,
              ),
              child: Row(
                children: [
                  // Leading: checkbox or gradient avatar
                  if (selectable)
                    Semantics(
                      button: true,
                      label: intern.internName,
                      child: Checkbox(
                        value: selected,
                        onChanged: (v) =>
                            onSelectionChanged?.call(v ?? false),
                      ),
                    )
                  else
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: StegColors.brandGradientBright,
                          begin: AlignmentDirectional.topStart,
                          end: AlignmentDirectional.bottomEnd,
                        ),
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: [
                          BoxShadow(
                            color: StegColors.brandPrimary
                                .withValues(alpha: 0.4),
                            blurRadius: 10,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        intern.internName.isEmpty
                            ? '?'
                            : intern.internName[0].toUpperCase(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 18,
                          height: 1,
                        ),
                      ),
                    ),
                  const SizedBox(width: StegSpacing.sm),
                  // Content
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          intern.internName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                fontWeight: FontWeight.w700,
                                fontSize: 15,
                              ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '${BidiText.isolate(intern.reference)} • ${intern.departmentName} • '
                          '${formatDay(intern.endDate, locale)}',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: StegSpacing.xs),
                  // Trailing chip
                  intern.needsAttention
                      ? StegStatusChip(
                          label: '${intern.pendingJournal + intern.pendingDeliverables}',
                          kind: StegStatusKind.warning,
                        )
                      : StegStatusChip(
                          label: internshipStatusLabel(intern.status, l10n),
                          kind: internshipStatusKind(intern.status),
                        ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
