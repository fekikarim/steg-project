import 'package:flutter_test/flutter_test.dart';
import 'package:stegappe/core/navigation/app_destination.dart';
import 'package:stegappe/features/auth/domain/entities/app_user.dart';
import 'package:stegappe/features/messaging/domain/entities/notification_item.dart';
import 'package:stegappe/features/messaging/domain/notification_router.dart';

/// A row shaped like the backend wire payload.
NotificationItem row(
  NotificationType type, {
  String? entity,
  String? entityId,
}) => NotificationItem(
  id: 'n-${type.name}',
  title: 'titre',
  message: 'message',
  priority: 'NORMAL',
  createdAt: DateTime(2026, 9, 15, 10),
  isRead: false,
  type: type,
  relatedEntityType: entity,
  relatedEntityId: entityId,
);

const intern = UserRole.intern;
const supervisor = UserRole.supervisor;
const adminSupervisor = UserRole.adminSupervisor;
const unsupported = UserRole.unsupported;

NotificationRoute to(AppDestination destination, {bool? hint}) =>
    NotificationRoute(destination: destination, hint: hint);

void main() {
  group('typed destinations (D11)', () {
    test('the five required student types all resolve (ST-NOT-01)', () {
      // New task · task edited · task deleted · approved documents · welcome.
      const required = [
        NotificationType.taskAssigned,
        NotificationType.taskUpdated,
        NotificationType.taskDeleted,
        NotificationType.documentVerified,
        NotificationType.welcome,
      ];
      for (final type in required) {
        expect(
          resolveNotificationRoute(row(type), intern),
          isNotNull,
          reason: '$type must deep-link for the student',
        );
      }
    });

    test('the task family lands on the task board for both roles', () {
      const tasks = [
        NotificationType.taskAssigned,
        NotificationType.taskUpdated,
        NotificationType.taskDeleted,
        NotificationType.taskStatusChanged,
      ];
      for (final type in tasks) {
        expect(
          resolveNotificationRoute(row(type), intern),
          to(AppDestination.tasks),
        );
        expect(
          resolveNotificationRoute(row(type), supervisor),
          to(AppDestination.tasks),
        );
      }
    });

    test('intern documents and journal reach the journal screen', () {
      for (final type in [
        NotificationType.documentRejected,
        NotificationType.documentVerified,
        NotificationType.journalEntryValidated,
      ]) {
        expect(
          resolveNotificationRoute(row(type), intern),
          to(AppDestination.journal),
        );
      }
    });

    test('supervisor documents and journal reach the validations queue', () {
      for (final type in [
        NotificationType.documentRejected,
        NotificationType.documentVerified,
        NotificationType.journalEntryValidated,
      ]) {
        expect(
          resolveNotificationRoute(row(type), supervisor),
          to(AppDestination.validations),
        );
      }
    });

    test('preparation requests reach the action hub, never a dead end', () {
      // T14/D14: the intern lands on home (journal + deliverables actions);
      // a supervisor lands on the interns list owning the students.
      expect(
        resolveNotificationRoute(
          row(NotificationType.documentsPreparationRequested),
          intern,
        ),
        to(AppDestination.home),
      );
      expect(
        resolveNotificationRoute(
          row(NotificationType.documentsPreparationRequested),
          supervisor,
        ),
        to(AppDestination.interns),
      );
      expect(
        resolveNotificationRoute(
          row(NotificationType.documentsPreparationRequested),
          adminSupervisor,
        ),
        to(AppDestination.interns),
      );
      expect(
        resolveNotificationRoute(
          row(NotificationType.documentsPreparationRequested),
          unsupported,
        ),
        isNull,
      );
    });

    test('messages open the conversation list', () {
      expect(
        resolveNotificationRoute(
          row(NotificationType.messageReceived),
          supervisor,
        ),
        to(AppDestination.messages),
      );
    });

    test('internship lifecycle and the welcome message go home', () {
      for (final type in [
        NotificationType.internshipAssigned,
        NotificationType.internshipStatusChanged,
        NotificationType.internshipReportSubmitted,
        NotificationType.welcome,
      ]) {
        expect(
          resolveNotificationRoute(row(type), intern),
          to(AppDestination.home),
        );
      }
    });

    test('workflow facts without a mobile screen stay in the center', () {
      // No shell destination exists for them: the honest answer is "no route".
      for (final type in [
        NotificationType.applicationSubmitted,
        NotificationType.applicationResubmitted,
        NotificationType.applicationAccepted,
        NotificationType.applicationRejected,
        NotificationType.applicationModificationRequested,
        NotificationType.candidateValidated,
        NotificationType.finalEvaluationRequired,
        NotificationType.paymentApproved,
        NotificationType.certificateAvailable,
        // T08 community rows have no destination either: the center pushes the
        // post detail through onOpenCommunityPost instead (see
        // NotificationsScreen), so the router stays silent.
        NotificationType.communityComment,
        NotificationType.communityPostRemoved,
        NotificationType.communityCommentRemoved,
      ]) {
        expect(
          resolveNotificationRoute(row(type), intern),
          isNull,
          reason: '$type must not fake a destination',
        );
      }
    });

    test('the type wins over a misleading related entity', () {
      // A typed welcome row that carries a Task entity still goes home: the
      // catalogue key is the contract, the entity string is only a fallback.
      expect(
        resolveNotificationRoute(
          row(NotificationType.welcome, entity: 'Task'),
          intern,
        ),
        to(AppDestination.home),
      );
    });

    test('a role without a shell never routes', () {
      for (final type in NotificationType.values) {
        expect(
          resolveNotificationRoute(row(type, entity: 'TASK'), unsupported),
          isNull,
        );
      }
    });

    test('supervisors and admin-supervisors share one destination map', () {
      for (final type in NotificationType.values) {
        expect(
          resolveNotificationRoute(row(type, entity: 'TASK'), adminSupervisor),
          resolveNotificationRoute(row(type, entity: 'TASK'), supervisor),
        );
      }
    });
  });

  group('legacy rows and malformed data', () {
    test('an unknown type falls back to the backend entity vocabulary', () {
      expect(
        resolveNotificationRoute(
          row(NotificationType.unknown, entity: 'TASK'),
          intern,
        ),
        to(AppDestination.tasks),
      );
      expect(
        resolveNotificationRoute(
          row(NotificationType.unknown, entity: 'journalentry'),
          intern,
        ),
        to(AppDestination.journal),
      );
      expect(
        resolveNotificationRoute(
          row(NotificationType.unknown, entity: 'Conversation'),
          intern,
        ),
        to(AppDestination.messages),
      );
      expect(
        resolveNotificationRoute(
          row(NotificationType.unknown, entity: 'deliverable'),
          supervisor,
        ),
        to(AppDestination.validations),
      );
    });

    test('an unknown type with an unknown entity stays in the center', () {
      expect(
        resolveNotificationRoute(row(NotificationType.unknown), intern),
        isNull,
      );
      expect(
        resolveNotificationRoute(
          row(NotificationType.unknown, entity: 'SOMETHING_NEW'),
          intern,
        ),
        isNull,
      );
      expect(
        resolveNotificationRoute(
          row(NotificationType.unknown, entity: ''),
          intern,
        ),
        isNull,
      );
    });

    test('an internship entity only routes for staff roles', () {
      expect(
        resolveNotificationRoute(
          row(NotificationType.unknown, entity: 'INTERNSHIP'),
          supervisor,
        ),
        to(AppDestination.home),
      );
      expect(
        resolveNotificationRoute(
          row(NotificationType.unknown, entity: 'INTERNSHIP'),
          intern,
        ),
        isNull,
      );
    });

    test(
      'equality is by value so a route can be compared in tests and keys',
      () {
        expect(to(AppDestination.tasks), to(AppDestination.tasks));
        expect(
          to(AppDestination.tasks).hashCode,
          to(AppDestination.tasks).hashCode,
        );
        expect(to(AppDestination.tasks), isNot(to(AppDestination.messages)));
        expect(
          to(AppDestination.tasks, hint: true),
          isNot(to(AppDestination.tasks)),
        );
      },
    );
  });
}
