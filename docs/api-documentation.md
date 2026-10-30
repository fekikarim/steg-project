# Master API & Integration Contracts

This document specifies the authoritative API and communication contracts across the STEG platform.

---

## 1. REST API Specification (`steg-backend`)

The backend is built with Spring Boot 4.1.1 and Java 21, conforming to OpenAPI 3.1.0 specifications. The complete specification is accessible at `/v3/api-docs` and visualized through `/swagger-ui.html`.

### 1.1 Base Conventions
- **Base URL:** `http://localhost:8080` (Development) / `https://api.steg.tn` (Production)
- **Content Type:** `application/json; charset=UTF-8`
- **Error Format:** Standard RFC 7807 Problem Details or custom STEG error envelopes:
  ```json
  {
    "timestamp": "2026-10-30T13:50:00Z",
    "status": 422,
    "error": "UNPROCESSABLE_ENTITY",
    "message": "Validation failed for document",
    "path": "/api/documents/validate",
    "details": ["Document contains illegible text layer"]
  }
  ```

### 1.2 Authentication Endpoints
| HTTP Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Candidate self-registration. |
| `POST` | `/api/auth/login` | Public | Authenticates credentials; returns JWT and sets refresh token. Rate limited to 10 req/min/IP. |
| `POST` | `/api/auth/refresh` | Public (with token) | Rotates refresh token and issues fresh JWT access token. |
| `POST` | `/api/auth/logout` | Authenticated | Revokes current session refresh token. |
| `POST` | `/api/auth/logout-all` | Authenticated | Invalidates all active sessions for current user. |
| `GET` | `/api/auth/me` | Authenticated | Returns profile, active role, and specific fine-grained permissions. |

### 1.3 Candidate & Application Endpoints
| HTTP Method | Path | Required Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/universities` | Public | Returns reference list of supported universities and institutions. |
| `POST` | `/api/public/applications/validate-identifiers` | Public | Validates CIN/Passport and email uniqueness prior to submission. |
| `POST` | `/api/applications` | `CANDIDATE` | Submits a completed 6-step internship application dossier. |
| `GET` | `/api/applications` | `CANDIDATE` / Staff | Returns applications belonging to authenticated candidate or staff query. |
| `GET` | `/api/applications/{id}` | Owner / Staff | Retrieves detailed application dossier including document references. |
| `PUT` | `/api/applications/{id}/status` | `ADMIN` / `SUPERVISOR` | Transitions application workflow (UNDER_REVIEW, APPROVED, REJECTED). |

### 1.4 Internship & Companion Workspace
| HTTP Method | Path | Required Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/internships/active` | `INTERN` / `SUPERVISOR` | Returns active internship context for authenticated user. |
| `GET` | `/api/companion/tasks` | `INTERN` / `SUPERVISOR` | Lists assigned tasks grouped by status and category. |
| `POST` | `/api/companion/tasks` | `SUPERVISOR` / `ADMIN` | Creates new structured internship task. |
| `PUT` | `/api/companion/tasks/{id}/status` | `INTERN` / `SUPERVISOR` | Updates task progress (`TODO` -> `IN_PROGRESS` -> `SUBMITTED` -> `APPROVED`). |
| `GET` | `/api/companion/logbook/entries` | `INTERN` / `SUPERVISOR` | Retrieves calendar entries and daily activities. |
| `POST` | `/api/companion/logbook/entries` | `INTERN` | Creates daily activity record with optional deliverable reference. |
| `POST` | `/api/companion/journal/generate` | `INTERN` / `SUPERVISOR` | Initiates server-side rendering of official internship journal PDF. |

### 1.5 Evaluations, Finance, & Certificates
| HTTP Method | Path | Required Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/evaluations` | `SUPERVISOR` | Submits final supervisor evaluation and performance scores. |
| `GET` | `/api/finance/queue` | `ADMIN` / `SUPERVISOR` | Retrieves pending stipend clearances and payment status. |
| `POST` | `/api/finance/{id}/approve` | `ADMIN` / Assigned `SUPERVISOR`| Approves stipend release after cross-referencing completed deliverables. |
| `POST` | `/api/certificates/generate/{internshipId}` | `ADMIN` | Generates official completion certificate with embedded verification QR. |
| `GET` | `/api/certificates/{id}/download` | `INTERN` / `ADMIN` | Downloads signed certificate PDF. |

---

## 2. STOMP over WebSocket Contract

The real-time messaging and notification system operates using STOMP over SockJS/WebSocket.

- **Broker URL:** `ws://localhost:8080/ws` (or `wss://api.steg.tn/ws`)
- **Handshake Authentication:** Bearer JWT provided in connection headers or query param.

### 2.1 Destination Subscriptions
- **User Notifications:** `/user/queue/notifications`
  - Payloads deliver real-time notifications (status changes, task assignments, approvals).
- **Direct & Group Conversations:** `/topic/conversations/{conversationId}`
  - Payloads deliver incoming chat messages, media attachment links, and delivery/read receipts.
- **Community Feed:** `/topic/community`
  - Real-time broadcast of new posts, replies, and community moderation events.

### 2.2 Client Inbound Destinations
- **Send Message:** `/app/chat.send`
  ```json
  {
    "conversationId": "550e8400-e29b-41d4-a716-446655440000",
    "content": "Bonjour M. l'encadreur, le rapport est prêt.",
    "attachmentId": null
  }
  ```
- **Acknowledge Delivery/Read:** `/app/chat.read`
  ```json
  {
    "conversationId": "550e8400-e29b-41d4-a716-446655440000",
    "messageId": "770e8400-e29b-41d4-a716-446655440001"
  }
  ```

---

## 3. Internal AI Service Contracts (`ai-services`)

The Python AI microservice communicates exclusively with `steg-backend`. All requests must supply the `X-Service-Token` header.

### 3.1 Document Classification & Validation (`POST /api/doc-intel/validate`)
- **Request Body:**
  ```json
  {
    "pdfBase64": "JVBERi0xLjQKJ...",
    "expectedType": "CIN",
    "fullName": "Mohamed Ben Ali",
    "version": "1"
  }
  ```
- **Response Body:**
  ```json
  {
    "version": "1",
    "valid": true,
    "documentTypeValid": true,
    "candidateNameValid": true,
    "confidence": 0.94,
    "reason": "CIN Tunisienne détectée avec nom correspondant.",
    "extractedMetadata": {
      "cinNumber": "09876543",
      "birthDate": "2001-05-14"
    }
  }
  ```

### 3.2 Report & Technical Analysis (`POST /api/report/analyze`)
- **Request Body:**
  ```json
  {
    "pdfBase64": "JVBERi0xLjQKJ...",
    "applicationReference": "STEG-2026-0042",
    "version": "1"
  }
  ```
- **Response Body:**
  ```json
  {
    "version": "1",
    "relevanceScore": 0.88,
    "detectedStegContent": "Étude des transformateurs haute tension",
    "detectedActivities": "Maintenance, analyse des pannes réseau",
    "missingElements": "",
    "summary": "Rapport technique structuré couvrant l'infrastructure électrique de STEG.",
    "explanation": "Le rapport valide les exigences techniques de fin d'études.",
    "confidence": 0.91
  }
  ```

### 3.3 Internship Journal Rendering (`POST /api/journal/render`)
- **Request Body:**
  ```json
  {
    "documentTitle": "Journal de Stage - STEG",
    "internFullName": "Mohamed Ben Ali",
    "internshipReference": "STEG-2026-0042",
    "internshipType": "PFE",
    "supervisorName": "Ing. Ahmed Triki",
    "startDate": "2026-02-01",
    "endDate": "2026-06-30",
    "entries": [
      {
        "date": "2026-02-02",
        "description": "Introduction aux règles de sécurité en poste haute tension",
        "category": "Sécurité",
        "hours": 7,
        "status": "APPROVED"
      }
    ],
    "version": "1"
  }
  ```
- **Response Body:**
  ```json
  {
    "pdfBase64": "JVBERi0xLjQK...",
    "pageCount": 4,
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "renderedAt": "2026-10-30T13:50:00Z"
  }
  ```

