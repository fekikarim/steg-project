# Cross-Part Feature Mapping

This matrix maps user workflows, platform capabilities, and administrative operations across all five subsystems of the STEG platform. It establishes the authoritative cross-reference between frontend views, mobile screens, backend API routes, and background AI processing.

---

## 1. Comprehensive System Capabilities Matrix

| Domain / Feature Capability | Front Office (`steg-front-office`) | Back Office (`steg-back-office`) | Mobile App (`stegappe`) | Backend Service (`steg-backend`) | AI Service (`ai-services`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Public Application Intake** | 6-step multi-lingual wizard (`/apply`) | Manual intake dialog & view (`/applications/new`) | N/A (Candidate intake via Web) | `POST /api/applications`, `POST /api/public/applications` | `/api/doc-intel/validate` (pre-screening) |
| **Identity & Reference Check** | Real-time uniqueness lookup (`/api/public/applications/validate-identifiers`) | Identity audit card on candidate dossier | N/A | `IdentifierValidationController` (`POST /api/public/applications/validate-identifiers`) | Name & OCR regex extraction |
| **Dossier & Application Review** | Application tracking page (`/track`) & History (`/history`) | Application triage queue, status filters, bulk actions | N/A | `ApplicationController` (`GET /api/applications`, `PUT /api/applications/{id}/status`) | Flag discrepancies & confidence scoring |
| **Supervisor Assignment** | Display assigned department/supervisor in portal | Supervisor assignment modal, workload stats bar | Supervisor profile screen | `InternshipController` (`POST /api/internships/{id}/assign-supervisor`) | Workload balance metrics |
| **Daily Logbook & Work Items** | View logbook summary on portal dashboard | Supervisor & Admin read-only audit of journal entries | Daily composer sheet, calendar view, task association | `LogbookController` (`GET/POST /api/companion/logbook/entries`) | N/A |
| **Task Management & Kanban** | N/A | Task list, category management, task reordering | Interactive Kanban board, task status update sheet | `TaskDraftController`, `TaskCategoryController` | Task category suggestions |
| **AI Task Generation from Spec** | N/A | "Generate Tasks from Document" panel | "Générer des tâches avec l'IA" bottom sheet | `POST /api/companion/tasks/drafts/ai-generate` | Extract tasks & deliverables from PDF spec |
| **Deliverable & Report Verification** | Upload internship report (`/documents`) | Inspect document validation results & confidence badge | Upload deliverable sheet, view verification checkmarks | `DocumentValidationController`, `ReportController` | `/api/verification/report`, `/api/report/analyze` |
| **Internship Journal Generation** | Download generated PDF journal | Preview & download generated journal PDF | One-tap "Générer Journal de Stage", PDF preview | `JournalDocumentController` (`POST /api/companion/journal/generate`) | `/api/journal/render` (ReportLab engine) |
| **Intern Evaluations** | View completed evaluation rating & remarks | Administrative inspection of internship marks | Comprehensive evaluation form screen with rubrics | `EvaluationController` (`GET/POST /api/evaluations`) | N/A |
| **Finance & Stipend Payments** | View payment status & RIB submission | Finance queue, payment clearance, bank batch exports | View stipend validation status in profile | `FinanceController` (`GET/POST /api/finance/*`) | `/api/finance/verify` (cross-check cert + report) |
| **Certificate Issuance & QR** | Download verified certificate (`/profile`) | Certificate generation panel, preview, QR verification | View/share certificate PDF directly | `CertificateController` (`POST /api/certificates/generate`) | Cryptographic checksum generation |
| **Real-Time Direct & Group Chat** | Notification tray | Real-time alerts banner | Full STOMP chat with text, attachments, read receipts | `MessagingStompController`, `ConversationController` | N/A |
| **Community Feed & Moderation** | N/A | Administrative moderation sheet, flag inappropriate posts | Multi-channel social feed, post creation, reactions | `CommunityController` (`GET/POST /api/community/*`) | Content screening flags |
| **Administrative Audit & Observability** | N/A | System audit trail viewer, login attempts, IP filtering | N/A | `AuditLogController`, Spring Actuator, Micrometer | Health check & token fingerprint |

---

## 2. Screenshot-Verified Key Features

Based on the verified screenshots from `screenshots/` directory, the following primary user journeys and visual workflows are confirmed:

### 2.1 Front Office User Interface
- **Multilingual Support (AR, FR, EN):** Verified by `home-page-ar.png`, `home-page-fr.png`, and `home-page-eng.png`. Full RTL support for Arabic, clean localized typography.
- **Multi-Step Application Wizard:**
  - `intern-apply-step1-candidate-info.png`: Personal info, CIN/passport, date of birth, contact details.
  - `intern-apply-step2-education.png`: University selection, field of study, diploma level, academic transcripts.
  - `intern-apply-step3-intern-dates.png`: Desired dates, department choices, internship category.
  - `confirmation-application-info-step6.png`: Dossier summary, legal consent, submit action.
  - `msg-application-succee-page.png`: Submission success screen displaying unique tracking reference number.
- **Application Tracking & Status Notifications:**
  - `my-applications-page.png`: Status timeline (Submitted -> Under Review -> Accepted -> Completed).
  - `notification-page.png`: Direct notifications on status updates.
  - `mail-candidature-soumise.png`: Transactional confirmation email with instructions.
- **Document Intelligence Analysis:**
  - `ia-validation-document-analyse.png`: Real-time feedback showing document validity, confidence score, and extracted metadata.

### 2.2 Back Office Administrative Interface
- **Executive & Supervisor Dashboards:**
  - `admin-dashboard-ar.png`: Arabic RTL dashboard showing active internships, pending applications, and distribution graphs.
  - `admin-ia-assistant-et-dashboard-stats.png`: Embedded AI assistant copilot with natural-language querying of administrative data.
  - `enc-ia-assistant-et-dashboard-stats.png`: Supervisor-scoped dashboard with intern progress tracking.
- **Dossier & Document Intelligence:**
  - `admin-applications-page.png`: Filterable application queue with search and bulk actions.
  - `admin-candidate-view-page.png` & `admin-stage-view-page.png`: Detailed dossier view with uploaded files, identity documents, and supervisor notes.
  - `admin-ia-validation-document-analyse.png`: Detailed AI analysis inspector showing OCR confidence, document classification, and field matching.
- **Task Management & AI Task Generation:**
  - `admin-tasks-page.png`: Task repository categorized by departments and skills.
  - `admin-ia-tasks-generator-from-document.png`: Automatic extraction and creation of structured internship tasks directly from an uploaded internship agreement/specification.
- **Finance, Audit, & Certification:**
  - `admin-finance-payments-page.png`: Stipend clearance, RIB confirmation, and payment dispatch.
  - `admin-audit-page.png`: Full audit log of all administrative actions, logins, and document downloads.
  - `admin-certif-page.png` & `admin-certif-preview-page.png`: Certificate generation with live PDF preview and printable QR code.

### 2.3 Mobile Companion Application (`stegappe`)
- **Role-Based Authentication:**
  - `stagiaire-login.png` & `encadrent-login.png`: Dedicated login experiences for Interns (`stagiaire`) and Supervisors (`encadreur`).
- **Intern Workspace:**
  - `stagiaire-home-screen.png`: Daily greeting, quick metrics, pending deliverables, and calendar timeline.
  - `stagiaire-mes-taches.png`: Interactive task checklist with status toggles (To Do, In Progress, Submitted).
  - `stagiaire-ia-chatbot.png`: Integrated AI assistant answering STEG policy, company history, and internship guidance.
  - `stagiaire-communaute.png`: Community knowledge sharing and peer discussion feed.
  - `stagiaire-messages-screen.png` & `stagiaire-message-enc-chat.png`: Instant messaging and direct chat with assigned supervisor.
- **Supervisor Workspace:**
  - `encadrent-home-screen.png`: Overview of active supervised interns, pending validations, and workload alerts.
  - `encadrent-mes-stagiaire.png`: List of supervised interns with real-time progress indicators.
  - `encadrent-taches.png`: Reviewing tasks submitted by students.
  - `encadrent-analyser-taches-ia.png`: AI-assisted task analysis evaluating student deliverable quality and completeness.
  - `encadrent-verification-docs-ia.png` & `encadrent-verif-docs-ia-result.png`: Automated AI validation checks on student documents.

