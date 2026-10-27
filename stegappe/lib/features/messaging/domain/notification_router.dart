import '../../../core/navigation/app_destination.dart';
import '../../../features/auth/domain/entities/app_user.dart';
import 'entities/notification_item.dart';

/// Where a notification can send the user, expressed as an [AppDestination]
/// so the role shell decides whether that is a tab or a pushed screen.
///
/// The router is a **pure function** (T01: centralized typed routing, never
/// scattered string navigation). It returns null for every notification it
/// cannot resolve safely — an unknown type, a malformed target, or an entity
/// the role has no screen for — and the screen then simply keeps the row open
/// in the center. Fail-safe by construction: no crash, no wrong destination.
class NotificationRoute {
  const NotificationRoute({required this.destination, this.hint});

  /// Screen to open (tab or pushed route, resolved by the role shell).
  final AppDestination destination;

  /// Present when the destination exists but the exact entity may be gone
  /// (e.g. a deleted task): the screen opens the list, not a detail sheet,
  /// and the list renders an honest empty state if nothing is there.
  final bool? hint;

  @override
  bool operator ==(Object other) =>
      other is NotificationRoute &&
      other.destination == destination &&
      other.hint == hint;

  @override
  int get hashCode => Object.hash(destination, hint);
}

/// Type-first, entity-fallback deep-link resolution.
///
/// 1. A **typed** notification (V54 catalogue) routes by its type — stable
///    across refactors and immune to `relatedEntityType` gaps.
/// 2. A **legacy** row (type == unknown) falls back to the backend entity
///    vocabulary (`relatedEntityType`), exactly as the pre-T01 screen did, so
///    old rows keep their behaviour.
/// 3. Anything else → null (stay in the center).
NotificationRoute? resolveNotificationRoute(NotificationItem n, UserRole role) {
  switch (n.type) {
    case NotificationType.taskAssigned:
    case NotificationType.taskUpdated:
    case NotificationType.taskDeleted:
    case NotificationType.taskStatusChanged:
    case NotificationType.scheduledTaskVisible:
      return switch (role) {
        UserRole.intern || UserRole.supervisor || UserRole.adminSupervisor =>
          const NotificationRoute(destination: AppDestination.tasks),
        UserRole.unsupported => null,
      };
    // Journal entries and deliverables belong to the intern's journal; the
    // supervisor reviews them in the validations queue.
    case NotificationType.documentRejected:
    case NotificationType.documentVerified:
    case NotificationType.journalEntryValidated:
      return switch (role) {
        UserRole.intern => const NotificationRoute(
          destination: AppDestination.journal,
        ),
        UserRole.supervisor || UserRole.adminSupervisor =>
          const NotificationRoute(destination: AppDestination.validations),
        UserRole.unsupported => null,
      };
    case NotificationType.messageReceived:
      return switch (role) {
        UserRole.intern || UserRole.supervisor || UserRole.adminSupervisor =>
          const NotificationRoute(destination: AppDestination.messages),
        UserRole.unsupported => null,
      };
    // T14/D14 preparation request: the intern lands on home (the hub for
    // journal + deliverable preparation actions); a supervisor lands on
    // the interns list that owns the students.
    case NotificationType.documentsPreparationRequested:
      return switch (role) {
        UserRole.intern => const NotificationRoute(
          destination: AppDestination.home,
        ),
        UserRole.supervisor || UserRole.adminSupervisor =>
          const NotificationRoute(destination: AppDestination.interns),
        UserRole.unsupported => null,
      };
    case NotificationType.internshipAssigned:
    case NotificationType.internshipStatusChanged:
    case NotificationType.internshipReportSubmitted:
    case NotificationType.welcome:
      return switch (role) {
        UserRole.intern || UserRole.supervisor || UserRole.adminSupervisor =>
          const NotificationRoute(destination: AppDestination.home),
        UserRole.unsupported => null,
      };
    // Application/candidate/payment/certificate events are workflow facts the
    // mobile shells have no dedicated screen for: they stay in the center.
    // Community rows (T08) likewise return null here: the notification center
    // pushes the post detail directly through `onOpenCommunityPost` instead
    // (see NotificationsScreen).
    case NotificationType.communityComment:
    case NotificationType.communityPostRemoved:
    case NotificationType.communityCommentRemoved:
    case NotificationType.applicationSubmitted:
    case NotificationType.applicationResubmitted:
    case NotificationType.applicationAccepted:
    case NotificationType.applicationRejected:
    case NotificationType.applicationModificationRequested:
    case NotificationType.candidateValidated:
    case NotificationType.finalEvaluationRequired:
    case NotificationType.paymentApproved:
    case NotificationType.certificateAvailable:
      return null;
    case NotificationType.unknown:
      // Legacy row: resolve from the entity vocabulary, if any.
      return _routeByEntity(n.relatedEntityType, role);
  }
}

/// Pre-T01 fallback for rows without a stable type (BR-44: legacy values keep
/// working, rendered generically and routed only where the entity is unambiguous).
NotificationRoute? _routeByEntity(String? entity, UserRole role) {
  final t = (entity ?? '').toUpperCase();
  return switch (role) {
    UserRole.intern => switch (t) {
      'TASK' => const NotificationRoute(destination: AppDestination.tasks),
      'JOURNALENTRY' || 'DELIVERABLE' => const NotificationRoute(
        destination: AppDestination.journal,
      ),
      'CONVERSATION' || 'MESSAGE' => const NotificationRoute(
        destination: AppDestination.messages,
      ),
      _ => null,
    },
    UserRole.supervisor || UserRole.adminSupervisor => switch (t) {
      'TASK' => const NotificationRoute(destination: AppDestination.tasks),
      'JOURNALENTRY' || 'DELIVERABLE' => const NotificationRoute(
        destination: AppDestination.validations,
      ),
      'CONVERSATION' || 'MESSAGE' => const NotificationRoute(
        destination: AppDestination.messages,
      ),
      'INTERNSHIP' => const NotificationRoute(destination: AppDestination.home),
      _ => null,
    },
    UserRole.unsupported => null,
  };
}
