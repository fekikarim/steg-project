# STEG Smart Internship & Administrative Workflow Platform

[![Spring Boot 4.1.1](https://img.shields.io/badge/Backend-Spring%20Boot%204.1.1-6DB33F.svg?logo=springboot&logoColor=white)](steg-backend)
[![Next.js 16](https://img.shields.io/badge/Front%20Office-Next.js%2016-000000.svg?logo=next.js&logoColor=white)](steg-front-office)
[![Angular 22](https://img.shields.io/badge/Back%20Office-Angular%2022-DD0031.svg?logo=angular&logoColor=white)](steg-back-office)
[![Flutter 3.19](https://img.shields.io/badge/Mobile-Flutter%203.19-02569B.svg?logo=flutter&logoColor=white)](stegappe)
[![FastAPI Python](https://img.shields.io/badge/AI%20Services-FastAPI%20Python%203.11-009688.svg?logo=fastapi&logoColor=white)](ai-services)

The **STEG Smart Internship & Administrative Workflow Platform** is a full-stack digital solution developed for the **Société Tunisienne de l'Électricité et du Gaz (STEG)**. It modernizes the entire lifecycle of student internships across Tunisia—from public application intake, identity verification, and multi-tier administrative review, to day-to-day internship tracking, task supervision, AI-assisted document validation, logbook journal compilation, evaluations, stipend payment tracking, and certificate issuance.

---

## 🏛 Platform Architecture

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

## 📦 Subsystems Overview

| Subsystem | Folder | Technology Stack | Description | Documentation |
| :--- | :--- | :--- | :--- | :--- |
| **Backend API Core** | [`steg-backend/`](steg-backend) | Java 21, Spring Boot 4.1.1, Flyway, PostgreSQL, STOMP | Core transactional backend, security rules (RBAC/ABAC), workflows, and notifications. | [Backend Docs](steg-backend/README.md) |
| **Document AI Services** | [`ai-services/`](ai-services) | Python 3.11, FastAPI, PyMuPDF, ReportLab, Tesseract | Microservice for document validation, OCR, technical report analysis, and PDF journal generation. | [AI Docs](ai-services/README.md) |
| **Public Front Office** | [`steg-front-office/`](steg-front-office) | Next.js 16.3 (React 19), Tailwind CSS, `next-intl` | Candidate portal with a 6-step multilingual intake wizard, status tracking, and document upload. | [Front Office Docs](steg-front-office/README.md) |
| **Administration Back Office** | [`steg-back-office/`](steg-back-office) | Angular 22.1, TypeScript, Tailwind CSS, RxJS | Administrative portal with dossier triage, supervisor assignment, finance, audit, and certificates. | [Back Office Docs](steg-back-office/README.md) |
| **Mobile Companion** | [`stegappe/`](stegappe) | Flutter 3.13+, Dart, Riverpod, Secure Storage | Native mobile app for interns and field supervisors: task tracking, logbooks, chat, and community. | [Mobile Docs](stegappe/README.md) |

---

## ✨ System Features & Capabilities

- **Intelligent Intake & Identifier Uniqueness:** 6-step online application wizard with real-time National ID (CIN)/passport pre-validation.
- **Automated Document Intelligence:** Pre-screens uploaded assignment letters and identity cards, extracting text and computing confidence scores.
- **Role-Based Workflow Automation:** State transitions from `SUBMITTED` -> `UNDER_REVIEW` -> `APPROVED` -> `COMPLETED`, notifying candidates and staff.
- **Field Supervision & Task Management:** Supervisors assign tasks, evaluate submissions, and track student milestones on mobile and web.
- **AI Task Generation from Spec:** Extracts structured tasks directly from internship specification PDFs.
- **Daily Digital Logbook & Journal Compilation:** Interns record daily activities; platform deterministically renders an official signed PDF journal.
- **Stipend & Finance Clearance:** Tracks stipend eligibility, student bank details (RIB), and supervisor verification.
- **Official Certificates with Cryptographic QR Code:** Issues signed internship certificates with instant verification links.
- **Real-Time Messaging & Notifications:** STOMP-powered direct/group messaging between students and mentors, plus push notifications.
- **Collaborative Community Feed:** Peer knowledge-sharing platform for active interns with moderation capabilities.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Java:** JDK 21+
- **Node.js:** 20.x+ (npm 10+)
- **Python:** 3.11+
- **Flutter:** 3.13+ (Dart 3.3+)
- **PostgreSQL:** 15+

### Running the Full Stack Locally

1. **Start PostgreSQL Database:**
   ```bash
   createdb -U postgres steg_db
   ```

2. **Launch AI Microservice (Port 8000):**
   ```bash
   cd ai-services
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn app.main:app --port 8000 --reload
   ```

3. **Launch Spring Boot Backend (Port 8080):**
   ```bash
   cd steg-backend
   ./mvnw clean spring-boot:run -Dspring-boot.run.profiles=local
   ```

4. **Launch Front Office (Port 3000):**
   ```bash
   cd steg-front-office
   npm install && npm run dev
   ```

5. **Launch Back Office (Port 4200):**
   ```bash
   cd steg-back-office
   npm install && npm start
   ```

6. **Launch Mobile Companion App:**
   ```bash
   cd stegappe
   flutter pub get && flutter run
   ```

---

## 📚 Detailed Documentation

Comprehensive platform documentation is available in the [`docs/`](docs/) directory:
- [System Architecture Overview](docs/system-architecture.md)
- [Cross-Part Feature Mapping](docs/cross-part-feature-mapping.md)
- [Master API Documentation & Contracts](docs/api-documentation.md)
- [Complete Setup & Installation Guide](docs/setup-and-installation.md)

---

## 📄 License & Confidentiality
Proprietary software developed for the **Société Tunisienne de l'Électricité et du Gaz (STEG)**. All rights reserved.

