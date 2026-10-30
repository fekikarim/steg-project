# STEG Backend API Core

[![Java 21](https://img.shields.io/badge/Java-21-orange.svg?logo=openjdk&logoColor=white)](https://openjdk.org)
[![Spring Boot 4.1.1](https://img.shields.io/badge/Spring%20Boot-4.1.1-6DB33F.svg?logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791.svg?logo=postgresql&logoColor=white)](https://postgresql.org)
[![Flyway](https://img.shields.io/badge/Migrations-Flyway-CC0200.svg?logo=flyway&logoColor=white)](https://flywaydb.org)

The authoritative transactional core and security anchor for the STEG platform. Built with **Spring Boot 4.1.1** and **Java 21**, it implements strict domain-driven business workflows, role-based and attribute-based security (RBAC/ABAC), STOMP real-time messaging, file storage isolation, and audit logging.

---

## 🏛 Architecture & Security Model

- **Deny-by-Default:** Every API route enforces explicit authorization checks enforced via ArchUnit architecture tests.
- **Roles:**
  - `CANDIDATE`: Candidate undergoing registration and application.
  - `INTERN`: Approved student intern participating in an active internship.
  - `SUPERVISOR`: STEG technical supervisor/mentor.
  - `ADMIN`: Central STEG system administrator.
- **Fine-Grained Permissions:**
  - `DOCUMENT_VIEW_RESTRICTED`: Required to access identity papers (CIN, passport).
- **Authentication Lifecycle:** Short-lived JWT access tokens (15 minutes) paired with rotating opaque refresh tokens stored in PostgreSQL with IP/User-Agent fingerprinting.
- **Brute Force Protection:** IP rate limiting (10 login req/min/IP) and 30-minute account lockout after 5 failed password attempts.
- **WebSocket STOMP Broker:** Authenticated WebSocket channel for direct chats, community feeds, and instant notifications.

---

## ✨ Core Domain Modules

| Domain Module | Package | Description |
| :--- | :--- | :--- |
| **Identity & Access** | `tn.steg.backend.security`, `tn.steg.backend.user` | JWT issuance, password hashing, session refresh, role enforcement. |
| **Candidate Intake** | `tn.steg.backend.candidate` | Pre-validation of identity cards, 6-step application processing, university lookup. |
| **Internship Lifecycle** | `tn.steg.backend.internship` | Status transitions (`SUBMITTED`, `APPROVED`, `ACTIVE`, `COMPLETED`), supervisor assignments. |
| **Companion & Tasks** | `tn.steg.backend.companion` | Task lists, daily logbooks, deliverable submissions, spec PDF parsing. |
| **Real-time Messaging** | `tn.steg.backend.messaging` | Direct conversations, supervisor-intern communication, group chats. |
| **Community Feed** | `tn.steg.backend.community` | Peer-to-peer discussion board with moderation controls. |
| **Evaluation & Rubrics** | `tn.steg.backend.evaluation` | Supervisor grading rubrics, behavioral metrics, technical scoring. |
| **Finance & Stipends** | `tn.steg.backend.finance` | Bank RIB management, supervisor payment approvals, exportable batches. |
| **Certificates** | `tn.steg.backend.certificate` | Tamper-proof certificate generation with embedded verification QR codes. |
| **Document Storage** | `tn.steg.backend.document` | Isolated filesystem storage, MIME checking, virus/size validation. |
| **AI Integration** | `tn.steg.backend.ai` | Resilient HTTP client bridge to internal `ai-services` with circuit-breaking. |
| **Audit & Logging** | `tn.steg.backend.audit` | Comprehensive audit trail logging every administrative or restricted action. |

---

## 🛠 Tech Stack & Dependencies

- **Framework:** Spring Boot 4.1.1
- **Persistence:** Spring Data JPA, Hibernate, PostgreSQL Driver
- **Database Migrations:** Flyway
- **Security:** Spring Security, JJWT (`io.jsonwebtoken:jjwt-api:0.12.6`)
- **Real-Time:** Spring WebSocket (`org.springframework:spring-websocket`), STOMP
- **Observability:** Spring Boot Actuator, Micrometer Prometheus, Logstash Logback Encoder
- **Architecture Validation:** ArchUnit 1.4.1

---

## 📁 Folder Structure

```
steg-backend/
├── src/main/java/tn/steg/backend/
│   ├── ai/             # Python AI microservice integration client
│   ├── audit/          # Administrative audit trail entities and services
│   ├── candidate/      # Candidate profiles and university directories
│   ├── certificate/    # Official certificate generation and QR services
│   ├── community/      # Community feed, posts, and moderation
│   ├── companion/      # Daily logbooks, task boards, and journal documents
│   ├── document/       # Multipart file storage and validation
│   ├── evaluation/     # Supervisor evaluation rubrics
│   ├── finance/        # Stipend tracking, bank RIBs, and payment approval
│   ├── internship/     # Core internship entities and lifecycle state machine
│   ├── messaging/      # STOMP WebSocket controllers and conversation services
│   ├── notification/   # Multi-channel notification dispatchers
│   ├── organization/   # STEG departments, centers, and staff entities
│   ├── reporting/      # Executive metrics and statistical aggregates
│   ├── security/       # JWT token filters, password encoders, rate limiters
│   └── user/           # User accounts, credentials, and profile management
├── src/main/resources/
│   ├── db/migration/   # Versioned Flyway SQL schema migrations
│   ├── messages/       # Localized i18n messages (fr, ar, en)
│   ├── templates/      # Email and certificate templates
│   └── application.yml # Base Spring configuration
├── docs/               # Detailed backend documentation (OpenAPI, WS, Deployment)
├── pom.xml             # Maven dependencies
└── mvnw                # Maven wrapper script
```

---

## ⚙️ Configuration

The backend reads configuration from `application.yml` and environment variables. Key properties:

```yaml
spring:
  datasource:
    url: ${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5432/steg_db}
    username: ${SPRING_DATASOURCE_USERNAME:steg_user}
    password: ${SPRING_DATASOURCE_PASSWORD:steg_password}
  jpa:
    hibernate:
      ddl-auto: validate
  flyway:
    enabled: true

security:
  jwt:
    secret: ${JWT_SECRET:404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970}
    access-token-expiration-minutes: 15
    refresh-token-expiration-days: 30

ai:
  service:
    url: ${AI_SERVICE_URL:http://localhost:8000}
    token: ${PYTHON_AI_SERVICE_TOKEN:steg_shared_internal_ai_token_2026}
```

---

## 🚀 Installation & Running

### 1. Database Setup
```bash
# Ensure PostgreSQL is running and database exists
createdb -U postgres steg_db
```

### 2. Build & Run
```bash
# Run with local profile
./mvnw clean spring-boot:run -Dspring-boot.run.profiles=local
```

### 3. Verify
- **Swagger UI:** `http://localhost:8080/swagger-ui.html`
- **OpenAPI Schema:** `http://localhost:8080/v3/api-docs`
- **Actuator Health:** `http://localhost:8080/actuator/health`

### 4. Running Tests
```bash
./mvnw test
```
*(Runs unit tests, integration slices, and ArchUnit architecture rule checks).*
