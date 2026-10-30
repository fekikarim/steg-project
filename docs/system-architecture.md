# System Architecture Overview

## 1. Executive Summary

The **STEG Smart Internship & Administrative Workflow Platform** is an enterprise-grade digital solution designed for the **Société Tunisienne de l'Électricité et du Gaz (STEG)**. It modernizes the entire lifecycle of student internships across Tunisia—from public application intake, identity verification, and multi-tier administrative review, to day-to-day internship tracking, task supervision, AI-assisted document validation, logbook journal compilation, evaluations, stipend payment tracking, and certificate issuance.

The platform unifies 5 core components into a cohesive, secure, and distributed ecosystem:

```
                                  +---------------------------------------+
                                  |       Public Candidates & Interns     |
                                  |         (Next.js Front Office)        |
                                  |         Web Browser (Desktop/Mobile)  |
                                  +-------------------+-------------------+
                                                      |
                                                      | HTTPS / REST / WS
                                                      v
+-------------------------------+  HTTPS / REST / WS  +---------------------------------------+  Private HTTP (Token)  +-------------------------------+
|      STEG Mobile Companion    | ------------------> |              STEG Backend             | ---------------------> |      Python AI Services       |
|            (Flutter)          |                     |             (Spring Boot)             |                        |           (FastAPI)           |
|    Interns & Supervisors      |                     |   Port: 8080 (REST + STOMP WebSocket) |                        |    Port: 8000 (Internal Only) |
+-------------------------------+                     +-------------------+-------------------+                        +-------------------------------+
                                                      ^                   |
                                                      |                   | PostgreSQL / Flyway
                                                      | HTTPS / REST / WS v
                                  +-------------------+-------------------+
                                  |          STEG Back Office             |
                                  |              (Angular)                |
                                  |        Admins & Supervisors           |
                                  +---------------------------------------+
```

---

## 2. High-Level Subsystem Topology

| Subsystem | Technology Stack | Primary Audience | Operational Scope |
| :--- | :--- | :--- | :--- |
| **`steg-backend`** | Java 21, Spring Boot 4.1.1, Spring Security, Spring Data JPA, Flyway, PostgreSQL, STOMP WebSocket | Platform Core | Central source of truth. Handles business workflows, RBAC/ABAC authorization, audit logging, STOMP messaging, document storage, and notification dispatch. |
| **`ai-services`** | Python 3.11+, FastAPI, Pydantic, PyMuPDF, ReportLab, Tesseract OCR | Internal Backend Only | Sandboxed microservice for deterministic & heuristic document parsing, CIN/assignment letter validation, report analysis, finance verification, and PDF journal generation. |
| **`steg-front-office`** | Next.js 16.3 (React 19), TypeScript, Tailwind CSS, `next-intl` | Candidates & Interns | Public portal for browsing internship catalogs, 6-step application submission, application tracking, profile management, and document uploads. |
| **`steg-back-office`** | Angular 22.1, TypeScript, Tailwind CSS, RxJS, NgRx Signals | Admins & Supervisors | Administrative portal featuring dossier queues, document approvals, supervisor assignment, task management, finance/stipend review, audit logs, and certificates. |
| **`stegappe`** | Flutter 3.13+, Dart, Flutter Riverpod, `flutter_secure_storage` | Interns & Field Supervisors | Native Android & iOS mobile app providing real-time chat, task boards, AI companion suggestions, daily logbooks, supervisor validations, evaluations, and community feed. |

---

## 3. Communication Protocols & Security Boundaries

```mermaid
flowchart TD
    subgraph Public Internet
        Candidate["Candidate / Public User"]
        StudentIntern["Active Intern (Mobile/Web)"]
        Supervisor["Supervisor (Mobile/Web)"]
        Admin["Administrator (Back Office)"]
    end

    subgraph Security Boundary: Ingress & Gateway
        Nginx["Reverse Proxy / SSL Termination"]
    end

    subgraph Internal Network: Demilitarized Zone
        FO["Next.js Front Office (:3000)"]
        BO["Angular Back Office (:4200)"]
        APP["Flutter Mobile Client"]
        SB["Spring Boot Core Backend (:8080)"]
    end

    subgraph Isolated Internal Subnet: Non-Exposed
        AI["FastAPI AI Services (:8000)"]
        DB[(PostgreSQL Database :5432)]
        FS[("Storage System (Uploads & PII)")]
    end

    Candidate -->|HTTPS| FO
    StudentIntern -->|HTTPS / WSS| APP
    StudentIntern -->|HTTPS| FO
    Supervisor -->|HTTPS / WSS| APP
    Supervisor -->|HTTPS| BO
    Admin -->|HTTPS| BO

    FO -->|REST / JWT| SB
    BO -->|REST / WSS / JWT| SB
    APP -->|REST / STOMP / JWT| SB

    SB -->|JDBC / Flyway| DB
    SB -->|Protected Filesystem| FS
    SB -->|HTTP + X-Service-Token| AI
```

### 3.1 Network Isolation Rules
1. **`ai-services` is strictly internal:** Browsers and mobile clients never invoke FastAPI endpoints directly. Every call to `/api/*` on `ai-services` requires the `X-Service-Token` header.
2. **Spring Boot is the single domain authority:** All business rules, access control checks (RBAC/ABAC), state transitions, database writes, and audit entries are executed exclusively within `steg-backend`.
3. **Database and File Storage:** Direct access to PostgreSQL and the underlying physical storage (`storage/uploads`) is restricted exclusively to the Spring Boot application container.

---

## 4. Cross-System Architectural Decisions (ADRs)

### 4.1 Authentication & Token Rotation Model
- **Access Tokens:** Standard JWT tokens signed with HMAC-SHA256, carrying user ID, role, and fine-grained permissions (15-minute default expiration).
- **Refresh Tokens:** High-entropy opaque UUID strings stored in the database, bound to client IP and User-Agent, with automatic one-time rotation upon every invocation (`POST /api/auth/refresh`).
- **Account Lockout:** Enforced on `steg-backend`—5 consecutive invalid password attempts lock the account for 30 minutes.

### 4.2 Role-Based and Attribute-Based Access Control (RBAC / ABAC)
The platform establishes 4 canonical system roles:
- `CANDIDATE`: Registered prospective intern. Restricted to viewing their own applications and draft submissions.
- `INTERN`: Approved candidate whose internship has commenced. Has access to the companion workspace, logbook entries, task progress, STOMP messaging, and community channels.
- `SUPERVISOR`: STEG staff engineer/mentor. Authorized to oversee assigned interns, validate deliverables, rate evaluations, review stipend requests, and manage task drafts.
- `ADMIN`: STEG central administration. Full administrative authority over users, supervisors, applications, internships, finance records, certificates, and system audit logs.

*Fine-grained permission:* `DOCUMENT_VIEW_RESTRICTED` is required to stream or download identity documents (CIN, sensitive academic records), audited with client IP and user metadata prior to streaming.

### 4.3 Real-Time Architecture (STOMP over WebSocket)
- **Broker Endpoint:** `/ws` with SockJS fallback.
- **Security:** Authenticated via `JwtHandshakeInterceptor` and `StompAuthChannelInterceptor`.
- **Topologies:**
  - Topic Subscriptions: `/topic/conversations/{conversationId}`, `/topic/community`
  - User-Scoped Queues: `/user/queue/notifications`, `/user/queue/messages`
- Clients (`stegappe`, `steg-front-office`, `steg-back-office`) leverage resilient client libraries (`@stomp/stompjs` and Dart `stomp_dart_client`) with automatic reconnect backoff and offline reconciliation.

---

## 5. End-to-End Core Data Workflows

### Workflow 1: Public Intake to Internship Assignment
```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate (Next.js)
    participant FO as Front Office API Proxy
    participant Backend as Spring Boot Backend
    participant AI as Python AI Service
    actor Admin as Admin (Angular BO)

    Candidate->>FO: Submits 6-Step Dossier (Personal, University, Dates, Documents)
    FO->>Backend: POST /api/applications (Multipart/form-data)
    Backend->>Backend: Validate National ID / Passport uniqueness
    Backend->>AI: POST /api/doc-intel/validate (CIN / Assignment Letter base64)
    AI-->>Backend: Result {valid: true, confidence: 0.94, detectedType: "CIN"}
    Backend->>Backend: Persist Application (Status: SUBMITTED, AI status: VALIDATED)
    Backend-->>Candidate: Application Reference (e.g., STEG-2026-0042)
    
    Admin->>Backend: GET /api/admin/applications?status=SUBMITTED
    Backend-->>Admin: Dossier details & AI verification badges
    Admin->>Backend: POST /api/admin/applications/{id}/approve (Assign Department & Supervisor)
    Backend->>Backend: Transition to APPROVED -> Create Internship & Provision INTERN account
    Backend-->>Candidate: Transactional Notification & Access Credentials
```

### Workflow 2: Daily Internship Tracking & Task Verification
```mermaid
sequenceDiagram
    autonumber
    actor Intern as Intern (Flutter App)
    participant Backend as Spring Boot Backend
    participant AI as Python AI Service
    actor Supervisor as Supervisor (Mobile / Back Office)

    Intern->>Backend: POST /api/companion/logbook/entries (Daily summary & deliverables)
    Intern->>Backend: PUT /api/companion/tasks/{id}/status (IN_PROGRESS -> SUBMITTED)
    Backend-->>Supervisor: Push Notification / WebSocket Alert
    
    Supervisor->>Backend: GET /api/companion/tasks/{id}
    Supervisor->>AI: POST /api/verification/report (Spec validation)
    AI-->>Supervisor: Verification Report (Keywords, Structure, Completion %)
    Supervisor->>Backend: POST /api/companion/tasks/{id}/approve
    Backend->>Backend: Mark task APPROVED & recalculate internship completion progress
```

### Workflow 3: Completion, Journal Generation & Certificate Issuance
```mermaid
sequenceDiagram
    autonumber
    actor Intern as Intern (Flutter App)
    participant Backend as Spring Boot Backend
    participant AI as Python AI Service
    actor Admin as Admin (Angular Back Office)

    Intern->>Backend: POST /api/companion/journal/generate
    Backend->>Backend: Query all approved tasks & validated logbook entries
    Backend->>AI: POST /api/journal/render (Deterministic JSON payload)
    AI->>AI: Render ReportLab PDF with official STEG formatting & signatures
    AI-->>Backend: Base64 PDF Stream
    Backend->>Backend: Store Journal Document & mark ELIGIBLE_FOR_COMPLETION
    
    Admin->>Backend: POST /api/certificates/generate/{internshipId}
    Backend->>Backend: Verify supervisor evaluation & finance clearance
    Backend->>Backend: Generate official signed Certificate with cryptographic QR Code
    Backend-->>Intern: Download Available (Front Office / Mobile App)
```

