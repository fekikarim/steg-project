# Complete Setup & Installation Guide

This guide covers setting up, configuring, and running all five platform components in local development and production environments.

---

## 1. Prerequisites & Version Requirements

| Dependency | Minimum Version | Verified Version | Notes |
| :--- | :--- | :--- | :--- |
| **Java Development Kit (JDK)** | OpenJDK 21 | Eclipse Temurin 21.0.2 | Required for `steg-backend`. |
| **Node.js & npm** | Node.js 20.x, npm 10+ | Node.js 20.18.0, npm 11.19.0 | Required for `steg-front-office` and `steg-back-office`. |
| **Python** | Python 3.11+ | Python 3.11.8 | Required for `ai-services`. |
| **Flutter SDK** | Flutter 3.13+ | Flutter 3.19+ (Dart 3.3+) | Required for `stegappe`. |
| **PostgreSQL** | PostgreSQL 15+ | PostgreSQL 16.2 | Main relational database. |
| **Tesseract OCR (Optional)** | 5.x | tesseract 5.3.4 | Enables OCR fallback on scanned PDF documents. |

---

## 2. Environment Configuration & Shared Secrets

Create `.env` or application profile configuration files for each component:

### 2.1 Backend (`steg-backend`)
Create `steg-backend/src/main/resources/application-local.yml` or export environment variables:
```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/steg_db
    username: steg_user
    password: steg_password
  jpa:
    hibernate:
      ddl-auto: validate
  flyway:
    enabled: true

# Security & AI Service Bridge
security:
  jwt:
    secret: "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970"
    access-token-expiration-minutes: 15
    refresh-token-expiration-days: 30

ai:
  service:
    url: "http://localhost:8000"
    token: "steg_shared_internal_ai_token_2026"
```

### 2.2 Python AI Services (`ai-services`)
Create `ai-services/.env`:
```bash
PYTHON_AI_SERVICE_TOKEN=steg_shared_internal_ai_token_2026
PYTHON_AI_MAX_BYTES=26214400  # 25 MB
PYTHON_AI_MAX_PAGES=50
```

### 2.3 Front Office (`steg-front-office`)
Create `steg-front-office/.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
```

### 2.4 Back Office (`steg-back-office`)
Check `steg-back-office/src/environments/environment.ts`:
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
  wsUrl: 'ws://localhost:8080/ws'
};
```

### 2.5 Mobile Companion (`stegappe`)
In `stegappe/lib/core/config/app_config.dart`:
```dart
const String defaultBaseUrl = 'http://10.0.2.2:8080'; // Android Emulator
// const String defaultBaseUrl = 'http://localhost:8080'; // iOS Simulator
```

---

## 3. Step-by-Step Installation & Run Instructions

### Step 1: Database Initialization
Start PostgreSQL and create database:
```bash
createdb -U postgres steg_db
```

### Step 2: Launch `ai-services` (Python FastAPI)
```bash
cd ai-services

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run server with Uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*Verification:* Run `curl http://localhost:8000/health` (returns `{"status":"UP"}`).

### Step 3: Launch `steg-backend` (Spring Boot)
```bash
cd steg-backend

# Flyway automatically runs database migrations on startup
./mvnw clean spring-boot:run -Dspring-boot.run.profiles=local
```
*Verification:* Open `http://localhost:8080/swagger-ui.html` or `http://localhost:8080/actuator/health`.

### Step 4: Launch `steg-front-office` (Next.js)
```bash
cd steg-front-office

npm install
npm run dev
```
*Verification:* Open `http://localhost:3000` to view the public portal.

### Step 5: Launch `steg-back-office` (Angular)
```bash
cd steg-back-office

npm install
npm start
```
*Verification:* Open `http://localhost:4200` to access the administrative dashboard.

### Step 6: Launch `stegappe` (Flutter Mobile)
```bash
cd stegappe

flutter pub get

# Launch on connected device or simulator
flutter run
```

---

## 4. Troubleshooting & Common Issues

1. **AI Token Mismatch (`401 Unauthorized` / `AI_UNAVAILABLE`):**
   - Check `tokenFingerprint` returned by `curl http://localhost:8000/health`. Ensure `ai.service.token` in backend matches `PYTHON_AI_SERVICE_TOKEN` in Python service.
2. **CORS Restrictions:**
   - Development origins (`localhost:3000`, `localhost:4200`) are pre-configured in `steg-backend/src/main/resources/application.yml`.
3. **Database Migration Failures:**
   - If Flyway reports checksum differences, inspect schema version with `SELECT * FROM flyway_schema_history;` or run `./mvnw flyway:repair`.

