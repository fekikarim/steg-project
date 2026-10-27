do this task:
# STEG Internship Management Platform — Complete Flutter Mobile App Redesign, Recreation & Engineering Audit

## 1. Mission and Expected Outcome

You are acting as a **Senior Flutter Engineer, Mobile UI/UX Architect, Software Quality Engineer, and Backend Integration Specialist**.

Your mission is to completely inspect, redesign, recreate, improve, and validate the Flutter mobile application of the STEG internship management platform.

This is **NOT a simple visual redesign, a cosmetic update, or a partial UI improvement**. It is a comprehensive mobile application engineering task involving:

- Full UI/UX recreation based on the provided reference screenshots.
- A consistent, premium, modern, and production-quality design system.
- Complete implementation of all screens and user journeys for both user roles.
- Reliable integration with the existing backend and database.
- Functional authentication, navigation, messaging, tasks, profiles, document verification, and AI features.
- A deep audit of the entire mobile application, including bugs, architecture, state management, error handling, and performance.
- Actual execution and verification of the available tests and application workflows.

**Final objective:** Deliver a polished, stable, fully functional Flutter application that accurately follows the supplied screenshots while remaining correctly connected to the existing STEG backend.

Do not stop after analyzing the code, producing a plan, or updating a few screens. Inspect the project, implement the necessary changes, run the available validation commands, fix the issues you discover, and provide a factual final report.

## 2. Mandatory First Step: Inspect the Existing Project

Before changing any code, carefully inspect the repository and understand its current architecture.

Identify:

- The Flutter application root and `pubspec.yaml`.
- The existing `lib/` directory structure.
- All screens, widgets, routes, navigation flows, and layouts.
- Authentication and role-management logic.
- State management solution currently used.
- API clients, repositories, services, models, and serialization logic.
- Backend base URLs, request headers, authentication tokens, and session handling.
- WebSocket or other real-time communication integrations, if present.
- AI chatbot, document verification, and task-analysis integrations.
- Image, icon, font, and other asset usage.
- Environment configuration and platform-specific settings.
- Existing tests, lint rules, and known issues.
- Existing backend endpoints and their actual request/response contracts.

Inspect the relevant backend implementation and API documentation whenever necessary. Do not assume that the mobile application's current implementation accurately reflects backend behavior.

### Reference screenshot discovery

The reference screenshots are located in the project's existing `app` folder. Find and inspect the actual image files before implementation.

The screenshots are authoritative visual references for the intended mobile application. Study their layout, hierarchy, spacing, navigation, components, colors, content, and role-specific behavior.

Do not replace the supplied design with an unrelated generic dashboard template.

Do not guess the appearance of a screen when its screenshot is available.

If the existing implementation differs from the screenshots, determine the appropriate changes while preserving correct business logic and backend contracts.

## 3. Reference Screenshots — Required Coverage

Recreate and validate every applicable screen represented by these 17 reference images.

### A. Encadrant (Supervisor) Interface

1. `encadrent-login.png` — Supervisor authentication.
2. `encadrent-home-screen.png` — Supervisor home dashboard.
3. `encadrent-mes-stagiaire.png` — Intern management and intern list.
4. `encadrent-taches.png` — Task management and task tracking.
5. `encadrent-messages.png` — Supervisor messaging interface.
6. `encadrent-profile.png` — Supervisor profile and account information.
7. `encadrent-verification-docs-ia.png` — AI-assisted document verification workflow.
8. `encadrent-verif-docs-ia-result.png` — Document verification results and associated actions.
9. `encadrent-analyser-taches-ia.png` — AI-powered task analysis.

### B. Stagiaire (Intern) Interface

1. `stagiaire-login.png` — Intern authentication.
2. `stagiaire-home-screen.png` — Intern home dashboard.
3. `stagiaire-mes-taches.png` — Assigned tasks and progress tracking.
4. `stagiaire-messages-screen.png` — Intern messaging overview.
5. `stagiaire-message-enc-chat.png` — Conversation with the supervisor.
6. `stagiaire-profil.png` — Intern profile and account information.
7. `stagiaire-communaute.png` — Community and interaction interface.
8. `stagiaire-ia-chatbot.png` — AI chatbot interface.

**Important:** Preserve the distinction between `encadrent` and `stagiaire` screens. They represent different roles, permissions, information, and workflows. Do not merge them into one generic interface or accidentally expose supervisor-only features to interns.

Use the existing filenames exactly when locating the references.

## 4. UI/UX Redesign and Complete Recreation

Redesign the application with a coherent, premium, modern, professional visual identity suitable for an enterprise application used within STEG.

The result should feel intentionally designed, not like a collection of disconnected Flutter screens.

### 4.1 Establish a reusable design system

Inspect the reference screenshots and derive a consistent design system from them.

Centralize reusable design decisions, including:

- Primary and secondary brand colors.
- Background, surface, card, border, and divider colors.
- Typography hierarchy and font weights.
- Spacing and layout conventions.
- Border radii and component dimensions.
- Elevation and shadows.
- Iconography and icon sizes.
- Input fields and validation states.
- Primary, secondary, outlined, and destructive buttons.
- Cards, badges, status indicators, and progress indicators.
- Loading, empty, success, error, and offline states.
- App bars, bottom navigation, drawers, dialogs, and bottom sheets.

Create or improve centralized theme configuration, reusable widgets, and design tokens where appropriate.

Avoid scattering arbitrary colors, padding values, text styles, and component definitions throughout the codebase.

Use consistent visual patterns while preserving the specific layouts and interactions shown in the screenshots.

### 4.2 Professional visual quality

The redesigned application must feature:

- Clear visual hierarchy and readable typography.
- Balanced whitespace and consistent alignment.
- Attractive, well-structured cards and information sections.
- Modern form fields with meaningful labels and validation.
- Professional task status indicators and progress visualization.
- Clear visual distinctions between primary and secondary actions.
- Consistent icons and carefully selected visual emphasis.
- Subtle, purposeful animations and transitions.
- Appropriate feedback for successful and unsuccessful actions.
- Accessible contrast, legible text, and sufficiently large touch targets.

Use Flutter-native components intelligently and customize them where necessary.

Avoid excessive gradients, decorative effects, oversized cards, unnecessary animations, and visual clutter. Premium design means clarity, consistency, and precision—not adding effects everywhere.

### 4.3 Accurate screenshot recreation

For every referenced screen:

1. Inspect the original screenshot.
2. Identify its major sections, proportions, layout, and components.
3. Recreate the structure in Flutter.
4. Implement the actual interactions and data bindings.
5. Compare the resulting screen against the reference.
6. Correct significant visual discrepancies.
7. Test the screen at different viewport sizes.

Preserve recognizable visual details and intended information hierarchy from the supplied references.

Do not omit difficult screens, simplify complex layouts without justification, or replace reference-specific elements with generic placeholders.

Where the screenshots contain static sample information, determine which information should be replaced with live backend data. Preserve realistic fallback states only where appropriate.

### 4.4 Responsive layouts

The application must remain visually correct and usable across supported mobile screen sizes.

Handle:

- Small and large smartphones.
- Different screen aspect ratios.
- Safe areas, status bars, and system navigation areas.
- Portrait layouts and any existing supported orientations.
- Keyboard appearance and text input.
- Scrolling and long content.
- Large text settings where practical.
- Network-dependent loading and content changes.

Prevent:

- Render overflow errors.
- `RenderFlex` overflow warnings.
- Clipped buttons or form fields.
- Text overlapping icons.
- Unusable bottom navigation.
- Content hidden behind the keyboard.
- Fixed-height containers that break with longer content.
- Excessive nested scrolling.
- Layouts that work only on one emulator size.

Use `SafeArea`, `LayoutBuilder`, `MediaQuery`, flexible constraints, and appropriate scrolling patterns where needed.

Do not introduce unnecessary complexity merely to claim responsiveness.

## 5. Functional Requirements by Screen

Every screen must be implemented as a functional part of the application, not merely as a static visual recreation.

### 5.1 Authentication

For both supervisors and interns:

- Implement the login interface according to the reference.
- Validate required fields and input formats.
- Show and hide passwords where applicable.
- Display meaningful loading and error states.
- Prevent repeated submissions while a request is in progress.
- Connect authentication to the existing backend.
- Handle valid credentials, invalid credentials, network failures, and server errors.
- Store and manage authentication tokens using an appropriate secure mechanism.
- Restore valid sessions according to existing application requirements.
- Support logout and proper session cleanup.
- Route authenticated users to the correct role-specific interface.
- Prevent unauthorized access to protected screens.

Do not hardcode successful login responses or fake authenticated sessions.

Do not invent a second authentication system when the backend already provides one.

### 5.2 Supervisor Home Dashboard

Implement the reference dashboard with functional data, including applicable statistics, assigned interns, tasks, activity summaries, and shortcuts.

All displayed statistics must reflect actual backend data or be clearly represented by legitimate empty states.

Verify that tapping dashboard elements opens the correct screen and that refreshes update the displayed information.

### 5.3 Intern Management

Implement the supervisor's intern list and associated details.

Verify:

- Correct loading of assigned or managed interns.
- Search and filtering where supported.
- Correct navigation to intern details.
- Accurate loading, empty, and error states.
- Proper handling of missing profile information.
- Correct role-based access and data visibility.

Do not add fake records to make the screen appear populated.

### 5.4 Task Management

Implement the supervisor's task management and the intern's assigned-task interface.

Verify:

- Fetching tasks from the backend.
- Correct task titles, descriptions, statuses, deadlines, and assignments.
- Task detail views and supported editing or creation actions.
- Status updates and progress tracking.
- Validation of required task fields.
- Correct authorization for every operation.
- Refreshing affected screens after successful mutations.
- Consistent task status presentation across roles.

Only implement operations supported by the existing backend. If a required workflow is missing, determine whether it can be completed using existing endpoints or whether a backend change is necessary.

### 5.5 Messaging and Real-Time Communication

Implement both messaging overviews and the supervisor–intern conversation interface.

Audit the existing communication mechanism and preserve the established backend contract.

Verify:

- Correct conversation loading.
- Correct sender and recipient identification.
- Message ordering and timestamps.
- Message composition and validation.
- Sending and receiving messages.
- Loading previous messages where supported.
- Appropriate behavior when no conversation exists.
- Loading and error feedback.
- Message list updates after successful sends.
- Duplicate-send prevention.
- WebSocket connection, reconnection, and lifecycle management if real-time communication is supported.
- Graceful fallback behavior when the connection is unavailable.

Do not claim that messages are real-time if the existing backend only supports polling or ordinary HTTP requests.

Do not simulate successful delivery without an actual backend response.

### 5.6 Profile Management

Implement the correct supervisor and intern profile layouts.

Verify:

- Fetching the authenticated user's actual profile.
- Correct display of available information.
- Profile editing where supported.
- Input validation.
- Saving changes through the backend.
- Refreshing profile information after updates.
- Safe handling of missing or optional fields.
- Logout and account-related actions.

Never display another user's profile data because of stale state or incorrect caching.

### 5.7 AI Document Verification

Recreate both the document verification screen and the results screen.

Audit the existing AI integration, backend endpoints, upload workflow, and supported document formats.

Verify, where supported:

- Document selection or upload.
- File-type and size validation.
- Upload progress and processing states.
- Correct submission to the backend.
- Display of actual verification results.
- Clear presentation of detected issues, warnings, and recommendations when returned by the backend.
- Handling of rejected documents and processing failures.
- Retry behavior where appropriate.
- Correct navigation between submission and result screens.
- Safe handling of sensitive document information.

Do not fabricate verification results, confidence scores, or AI explanations.

Do not represent an unverified document as verified.

### 5.8 AI Task Analysis

Recreate the supervisor's AI task-analysis screen and its intended workflow.

Verify that:

- The user can select or provide the relevant task information.
- Required input validation works.
- The analysis is submitted through the correct backend integration.
- Loading and processing states are clear.
- Results are rendered according to the actual response structure.
- Errors and timeouts are handled gracefully.
- The user can recover from failed requests without restarting the application.

Preserve the existing AI provider, prompts, and API contracts unless a verified issue requires a change.

Never expose AI provider secrets or API keys in Flutter client code.

### 5.9 Community

Recreate the intern community screen according to its reference.

Inspect the backend to determine the supported community operations.

Implement the available features correctly, including applicable content loading, interaction, navigation, and refresh behavior.

Do not add imaginary social features or fake activity simply to fill the interface.

### 5.10 AI Chatbot

Recreate the intern's AI chatbot screen.

Verify:

- Correct conversation interface.
- Message input and submission.
- Loading and response states.
- Rendering of actual AI responses.
- Error and timeout handling.
- Message ordering and scrolling.
- Input clearing and retry behavior.
- Keyboard and safe-area handling.
- Conversation persistence where supported by the backend.

Do not hardcode chatbot replies or simulate an AI conversation when the backend request fails.

## 6. Backend Integration and Data Consistency

**Backend correctness is as important as visual quality.**

Audit every API call made by the Flutter application.

### 6.1 API architecture

Verify that the application uses a coherent and maintainable approach to network communication.

Where appropriate, centralize:

- Base URL and environment configuration.
- Request and response handling.
- Authentication headers.
- Token refresh behavior if supported.
- JSON serialization and deserialization.
- Request timeouts.
- Error normalization.
- Logging that excludes sensitive information.
- Network connectivity and retry policies.

Respect the repository's existing architecture and avoid introducing a new framework without a concrete reason.

### 6.2 API contract validation

Compare mobile models, request payloads, and response parsing against the actual backend implementation.

Check for:

- Incorrect endpoint paths.
- Incorrect HTTP methods.
- Missing or incorrect request fields.
- Incorrect field names or data types.
- Nullability mismatches.
- Incorrect date and time parsing.
- Invalid enum or status mappings.
- Missing authorization headers.
- Incorrect token handling.
- Unhandled non-success HTTP responses.
- Incorrect assumptions about response wrappers.
- Inconsistent pagination or filtering.
- Incorrect multipart uploads.
- Silent JSON parsing failures.

Fix verified issues at the appropriate layer.

Do not blindly modify the backend contract to accommodate a faulty client implementation.

### 6.3 Dynamic synchronization

Ensure that all backend-dependent screens reflect current data.

For example:

- A task update must be reflected in the relevant task views.
- A profile update must be visible after saving.
- A sent message must appear according to the actual delivery response.
- Dashboard statistics must refresh when their underlying data changes.
- AI results must be rendered from the real response.
- Logout must clear protected data from the active session.

Use the existing state management solution correctly. Avoid stale state, duplicate requests, unnecessary full-screen refreshes, and race conditions.

Where optimistic UI updates are appropriate, implement rollback or error recovery if the backend rejects the operation.

Ensure that asynchronous operations do not update disposed widgets or leave the interface stuck in a loading state.

### 6.4 Environment and security

Audit development, staging, and production configuration.

- Never hardcode production secrets or credentials.
- Never expose private AI keys in the mobile application.
- Do not disable TLS certificate validation.
- Do not weaken authentication or authorization checks.
- Do not log passwords, access tokens, or sensitive document contents.
- Use secure token storage where appropriate.
- Handle expired sessions and unauthorized responses safely.
- Keep role-based authorization enforced by the backend.
- Verify that production configuration does not accidentally use a local development URL.
- Avoid insecure workarounds to make emulator testing pass.

Preserve existing security controls and improve them where verified issues are discovered.

## 7. Deep Mobile Application Audit

Perform a systematic audit of the entire Flutter application, not just the screens listed above.

### 7.1 Functional audit

Inspect every screen, button, form, menu, navigation action, dialog, bottom sheet, and interactive component.

For every action, determine:

1. What should happen?
2. Is the action connected to a real implementation?
3. Does it call the correct service or state-management operation?
4. Is the result reflected in the UI?
5. What happens when the request fails?
6. Can the action be triggered repeatedly or cause duplicate operations?
7. Is the action available only to authorized roles?

Identify and fix:

- Buttons with no action.
- Placeholder screens and unfinished flows.
- Incorrect navigation destinations.
- Broken back navigation.
- Incorrect role-based routing.
- Forms that accept invalid data.
- Silent failures.
- Infinite loading states.
- Duplicate network requests.
- State that fails to refresh.
- Missing empty, loading, and error states.
- Incorrect handling of null or missing data.
- Broken keyboard interactions.
- Unexpected application crashes.

### 7.2 Architecture and code quality

Inspect:

- Widget responsibilities and excessive widget complexity.
- Duplicate UI and business logic.
- State management consistency.
- Service and repository boundaries.
- Model definitions and serialization.
- Error propagation.
- Dependency lifecycle and disposal.
- Unnecessary rebuilds.
- Memory leaks and asynchronous lifecycle issues.
- Unused dependencies, assets, and dead code.
- Inconsistent naming and folder organization.
- Testability and maintainability.

Refactor where it improves correctness, clarity, or long-term maintainability.

Prefer small, controlled changes that preserve existing working functionality over unnecessary rewrites of the entire architecture.

Do not introduce redundant abstractions or packages just to make the code look sophisticated.

### 7.3 Performance and smoothness

Check:

- Excessive widget rebuilds.
- Unnecessary API calls.
- Inefficient list rendering.
- Expensive operations on the main isolate.
- Large image and asset loading.
- Unnecessary animation work.
- Repeated parsing or calculations.
- Memory and controller disposal.
- Scrolling performance.
- Startup and screen-transition behavior.

Use efficient Flutter practices such as lazy list construction, appropriate state isolation, and image optimization where beneficial.

Animations must remain smooth and purposeful, particularly on lower-powered supported devices.

Do not claim measured performance improvements without actual measurements.

## 8. Required Implementation Workflow

Follow this workflow from beginning to end.

### Phase 1 — Repository and reference audit

- Inspect the project structure and current implementation.
- Locate all 17 screenshots in the `app` folder.
- Review every reference image.
- Map each screenshot to its corresponding Flutter screen and route.
- Inspect the existing backend contracts.
- Identify the most important functional and visual issues.

Create a concise internal checklist or repository document if helpful, but do not stop at documentation.

### Phase 2 — Design system and architecture

- Establish the reusable theme and design tokens.
- Identify shared widgets and role-specific layouts.
- Confirm navigation and authentication flows.
- Preserve the existing backend integration.
- Define a safe implementation sequence.

### Phase 3 — Complete UI recreation

Implement and refine every supervisor and intern screen.

Prioritize reusable components, consistency, screenshot fidelity, responsive behavior, and accessibility.

Do not leave one role unfinished while polishing only the other.

### Phase 4 — Functional and backend integration

Connect each screen to the correct services, repositories, and backend operations.

Fix request/response mismatches and state synchronization problems.

Ensure every visible action has a clear, valid outcome.

### Phase 5 — Full audit and bug fixing

Inspect the entire application for visual, functional, architectural, security, and performance issues.

Fix discovered issues rather than simply listing them in a report.

### Phase 6 — Automated validation

Run the applicable project checks, including:

- `flutter pub get`
- `dart format --output=none --set-exit-if-changed lib test`
- `flutter analyze`
- `flutter test`

Run additional relevant test commands if the project uses integration tests, code generation, or other validation tools.

If formatting changes are required, apply them and rerun the formatting check.

If the project does not contain a `test/` directory or has no tests, adapt the commands to the actual project configuration rather than reporting an unexplained failure.

Do not remove lint rules, skip tests, suppress warnings globally, or weaken analysis settings merely to obtain a green result.

### Phase 7 — Device and visual validation

Where the environment permits, launch the application on an available emulator or device.

Verify:

- Login and role-specific navigation.
- Every recreated screen.
- Representative forms and interactions.
- Network-dependent workflows.
- Loading, empty, and error states.
- Scrolling, keyboard handling, and responsive layouts.
- Messaging and AI workflows.
- Correct behavior after logout and session restoration.

Capture screenshots of implemented screens when possible and compare them with the supplied references.

Fix significant visual mismatches and functional defects discovered during this process.

If a real backend, device, emulator, or required external service is unavailable, distinguish what was verified locally from what remains unverified. Never claim an end-to-end workflow succeeded without executing it.

## 9. Testing Requirements

Add or update meaningful tests wherever appropriate.

### Unit tests

Cover relevant:

- Model serialization and parsing.
- Input validation.
- Repository behavior.
- Service error handling.
- State transitions.
- Role and permission handling.
- Task status mapping.
- AI response parsing.

### Widget tests

Cover representative:

- Login form validation.
- Dashboard rendering.
- Task list states.
- Profile rendering.
- Message composition.
- AI result presentation.
- Loading and error feedback.
- Navigation behavior.

### Integration tests

Where the environment supports them, test critical user journeys using the actual application and an appropriate backend or controlled test environment.

Do not use tests that merely assert that a widget exists while ignoring whether its core functionality works.

Do not fabricate test results, coverage percentages, successful API calls, or device validation.

## 10. Strict Engineering Rules

These rules are mandatory.

1. **Inspect before modifying.** Never rewrite files blindly.
2. **Read the screenshots.** Do not guess what the reference screens look like.
3. **Preserve working functionality.** A redesign must not break existing features.
4. **Do not fake integrations.** No mocked production behavior, fabricated records, or hardcoded successful responses.
5. **Do not invent backend endpoints.** Inspect the actual API and backend implementation first.
6. **Do not expose secrets.** Keep private credentials on the appropriate server side.
7. **Do not hide errors.** Handle them properly and report unresolved failures.
8. **Do not leave dead controls.** Every visible interactive element must have a defined behavior.
9. **Do not skip screens.** All 17 reference images must be addressed.
10. **Do not weaken security or linting.** Fix the underlying problems.
11. **Do not make unsupported claims.** Report only work and tests actually completed.
12. **Do not stop after planning.** Continue through implementation and verification.
13. **Avoid unnecessary dependencies.** Prefer the existing stack unless a change is justified.
14. **Keep changes maintainable.** Use consistent architecture, reusable components, and readable code.
15. **Do not overwrite unrelated work.** Inspect Git status and existing changes before editing. Preserve user modifications and avoid destructive Git operations.
16. **Respect the backend as the source of truth.** Mobile-side presentation must not bypass server-side permissions or business rules.

If an issue requires a backend change, investigate the smallest safe correction and implement it only if the repository and task scope permit it. Otherwise, document the precise dependency and avoid inventing a client-side workaround.

## 11. Definition of Done

The task is complete only when all applicable requirements below have been addressed.

### Design and visual quality

- All 17 reference screenshots have been inspected.
- Every referenced screen has been recreated.
- Supervisor and intern experiences are distinct and coherent.
- A reusable design system is implemented.
- Layouts adapt correctly to supported mobile screen sizes.
- Visual discrepancies have been reviewed and corrected where possible.
- No obvious overflow, clipping, or broken layout remains in verified configurations.

### Functionality

- Authentication and role-based navigation work.
- All implemented task, profile, intern, messaging, community, and AI workflows function according to the existing backend capabilities.
- Every visible control has a defined behavior.
- Loading, empty, success, and error states are handled.
- Backend-driven data is correctly displayed and refreshed.
- No known critical functional defects remain unaddressed.

### Engineering quality

- Code is formatted.
- Static analysis is clean, or any remaining issues are explicitly documented and justified.
- Available tests pass, or failures are explained accurately.
- No newly introduced critical security issues are knowingly left unresolved.
- Existing functionality and configuration are preserved where appropriate.
- Performance-sensitive areas have been reviewed and tested where possible.

### Validation

- The application launches successfully in the verified environment.
- Critical user journeys have been tested to the extent permitted by the environment.
- Screenshot comparisons have been performed where possible.
- Unavailable services, untested workflows, and remaining limitations are explicitly identified.

## 12. Final Report

After completing the work, provide a concise but detailed engineering report containing:

**A. Implementation summary**
- What was redesigned and recreated.
- Which reusable design-system elements were introduced or improved.
- Which screens and workflows were implemented.

**B. Backend integration**
- Which integrations were audited and corrected.
- Which API contracts or synchronization issues were fixed.
- Which features were verified against the actual backend.

**C. Audit findings and fixes**
- The important issues discovered.
- The fixes implemented.
- Any remaining defects, dependencies, or limitations.

**D. Validation results**
- Exact commands executed.
- Actual results of formatting, analysis, and tests.
- Device or emulator validation performed.
- Screenshot comparison results, if available.

**E. Changed files**
- The main files created, modified, or removed, with a brief explanation.

**F. Remaining work**
- Any unresolved issues, blocked workflows, missing backend capabilities, or unverified integrations.
- Why each item remains unresolved and what is needed to finish it.

Use clear statuses such as `PASS`, `FAIL`, `BLOCKED`, and `NOT RUN` where appropriate.

Never label an item `PASS` unless the relevant validation was actually performed.

## Final Instruction

Begin by inspecting the repository, finding and reviewing the 17 reference screenshots, and mapping the current mobile implementation to the intended screens.

Then execute the complete redesign, implementation, backend integration audit, bug fixing, and validation process.

**Deliver working code, not just recommendations.** Prioritize screenshot fidelity, professional UI/UX, functional completeness, secure backend integration, responsive behavior, and verified engineering quality.

The expected result is a coherent, premium-quality STEG Flutter application that is ready for a serious internship project demonstration, with all implemented features functioning correctly and any remaining limitations documented honestly.