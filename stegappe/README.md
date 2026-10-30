# STEG Mobile Companion (`stegappe`)

[![Flutter](https://img.shields.io/badge/Flutter-3.19-02569B.svg?logo=flutter&logoColor=white)](https://flutter.dev)
[![Dart](https://img.shields.io/badge/Dart-3.3-0175C2.svg?logo=dart&logoColor=white)](https://dart.dev)
[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS-green.svg)](README.md)
[![Riverpod](https://img.shields.io/badge/State-Riverpod%202.6-blue.svg)](https://riverpod.dev)

The official cross-platform mobile companion application for the STEG platform. Built with **Flutter** and **Dart**, it serves active **Student Interns** (`stagiaires`) and **Field Supervisors** (`encadreurs`) with real-time operational workflows, task tracking, daily logbook authoring, AI assistant queries, supervisor validations, direct chat, and community interaction.

---

## ✨ Features & Capabilities

- **Role-Adaptive Experiences:**
  - *Intern Shell (`stagiaire`):* Daily milestone cards, task checklist, logbook authoring, supervisor direct messaging, community feed, and AI chatbot.
  - *Supervisor Shell (`encadreur`):* Supervised student roster, task review and validation, AI deliverable analyzer, formal evaluation rubric scoring, and schedule view.
- **Daily Logbook & Timeline:**
  - Calendar timeline of logged work hours and activities.
  - One-tap initiation of official **Internship Journal PDF Generation** (`POST /api/companion/journal/generate`).
- **Interactive Task Management & Kanban:**
  - Tasks partitioned into `TODO`, `IN_PROGRESS`, and `COMPLETED`.
  - Supervisor review sheet with deliverable inspection and one-tap approval.
- **On-Device AI Assistant:**
  - Native chat interface with the STEG AI assistant for instant answers on company policies, security guidelines, and internship expectations.
- **AI Task & Deliverable Analyzer:**
  - Field supervisors can analyze student task submissions with AI, getting instant summaries and quality feedback.
- **Real-Time Direct & Group Chat:**
  - Instant STOMP messaging over WebSocket with message history, file attachments, and delivery/read receipts.
- **Community Feed & Peer Discussions:**
  - Channel-based feed for active interns to discuss technical topics, ask questions, and share knowledge with moderation controls.
- **Offline Resilience:**
  - Local caching of drafts, pending write queue for spotty network environments, and automatic resynchronization upon reconnection.

---

## 🛠 Tech Stack & Dependencies

- **Framework:** Flutter 3.13+ (Dart 3.3+)
- **State Management:** Flutter Riverpod (`flutter_riverpod: ^2.6.1`)
- **Secure Storage:** `flutter_secure_storage: ^9.2.4` (KeyStore on Android, Keychain on iOS)
- **HTTP & Real-Time:** `http: ^1.4.0`, STOMP over WebSocket
- **Internationalization:** `flutter_localizations` (Arabic RTL, French, English)
- **File Sharing & PDF Viewing:** `share_plus`, native file openers

---

## 📁 Folder Structure

```
stegappe/
├── lib/
│   ├── main.dart               # App entry point, provider initialization
│   ├── app.dart                # MaterialApp configuration, routing, theme setup
│   ├── core/
│   │   ├── config/             # Environment URLs and backend endpoints
│   │   ├── connectivity/       # Network connectivity listener and banner
│   │   ├── l10n/               # Localization providers and message bundles
│   │   ├── network/            # ApiClient, custom exceptions, interceptors
│   │   ├── offline/            # Pending write store for offline caching
│   │   ├── realtime/           # WebSocket and STOMP sync coordinators
│   │   ├── storage/            # Secure token store and SharedPreferences wrapper
│   │   ├── theme/              # STEG brand colors, typography, spacing, motion
│   │   └── widgets/            # Reusable buttons, cards, status chips, layout shells
│   └── features/
│       ├── auth/               # Login, session refresh, role gating, splash screen
│       ├── community/          # Feed, posts, comment sheets, moderation
│       ├── internship/         # Task boards, logbooks, evaluations, journal generation, AI chat
│       ├── messaging/          # STOMP chat screens, conversation lists, attachments
│       └── shell/              # Intern and supervisor bottom navigation shells
├── assets/                     # Logos, icons, branding assets
├── android/                    # Native Android project configuration
├── ios/                        # Native iOS project configuration
├── test/                       # Unit, widget, and acceptance tests
└── pubspec.yaml                # Flutter dependencies
```

---

## ⚙️ Configuration

Configure backend connection in `lib/core/config/app_config.dart`:

```dart
class AppConfig {
  // Use 10.0.2.2 for Android Emulator, localhost for iOS Simulator, or LAN IP for physical device
  static const String defaultBaseUrl = 'http://10.0.2.2:8080';
  static const String defaultWsUrl = 'ws://10.0.2.2:8080/ws';
}
```

---

## 🚀 Installation & Running

### 1. Prerequisites
- Flutter SDK installed and accessible on `PATH`. Verify with:
  ```bash
  flutter doctor
  ```

### 2. Install Dependencies
```bash
flutter pub get
```

### 3. Launch Development Instance
Ensure an emulator or physical device is connected:
```bash
# Check connected devices
flutter devices

# Run the app
flutter run
```

### 4. Running Tests
```bash
flutter test
```
