# STEG Back Office (Administration & Supervision)

[![Angular 22](https://img.shields.io/badge/Angular-22.1-DD0031.svg?logo=angular&logoColor=white)](https://angular.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.x-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Role-Based](https://img.shields.io/badge/Access-ADMIN%20%7C%20SUPERVISOR-green.svg)](README.md)

The mission-critical administrative and operational portal for STEG administrators, HR officers, and department supervisors. Built with **Angular 22** and **TypeScript**, it powers dossier triage, document approvals, supervisor workload balancing, AI-assisted task extraction, stipend clearance, and cryptographic certificate issuance.

---

## ✨ Features & Capabilities

- **Executive & Departmental Dashboards:**
  - Real-time KPIs (Active Internships, Pending Applications, Department Distribution).
  - Dedicated scoped view for Supervisors showing assigned students and pending deliverables.
  - Multilingual support with native RTL layout for Arabic.
- **Application Triage & Dossier Management:**
  - Searchable, filterable queue of submitted applications.
  - Side-by-side document inspection with AI OCR confidence badges and mismatch alerts.
  - One-click approvals, rejections with reason codes, and department routing.
- **Supervisor Assignment & Workload Management:**
  - Balance active students across qualified engineers and mentors.
  - Real-time visibility into supervisor capacity and current intern counts.
- **AI Administrative Assistant Copilot:**
  - Natural-language querying of administrative data, guidelines, and candidate statistics.
- **Task Repository & AI Task Generator:**
  - Central repository of approved departmental tasks and deliverable categories.
  - Automated extraction of structured tasks directly from uploaded internship convention documents.
- **Finance & Stipend Queue:**
  - Review student bank RIB details and attendance records.
  - AI-assisted cross-referencing between completion certificates and final technical reports.
  - Batch export for financial processing.
- **Certificate Issuance & Preview:**
  - Cryptographic QR code generation and printable certificate preview.
- **System Audit Trail & Observability:**
  - Comprehensive immutable log of every administrative action, login event, and restricted document download.

---

## 🛠 Tech Stack & Dependencies

- **Framework:** Angular 22.1.0
- **Language:** TypeScript 5.x
- **State & Architecture:** Signals, RxJS 7.8, Standalone Components
- **Styling:** Tailwind CSS, PostCSS, Custom Design System
- **Real-Time Client:** `@stomp/stompjs` (v7.0.0)
- **Icons & Formatting:** Lucide-Angular / Custom SVG icons, Date-Fns
- **Testing:** Jasmine/Karma for unit tests, Playwright for E2E testing

---

## 📁 Folder Structure

```
steg-back-office/
├── src/
│   ├── app/
│   │   ├── core/               # Auth guards, HTTP interceptors, API client, session management
│   │   ├── shell/              # Layout shell, sidebar, topbar, breadcrumbs
│   │   ├── features/
│   │   │   ├── admin/          # Admin workspace, system audit viewer
│   │   │   ├── ai/             # AI assistant copilot, AI insight widgets
│   │   │   ├── applications/   # Dossier queues, approval modals, manual intake
│   │   │   ├── candidates/     # Candidate directory and detailed academic profile
│   │   │   ├── certificates/   # Certificate generation, QR verification, PDF preview
│   │   │   ├── dashboard/      # Executive charts, distribution bars, metrics
│   │   │   ├── finance/        # Stipend payment approval queue, RIB audits
│   │   │   ├── intern-accounts/# Student account provisioning and password resets
│   │   │   ├── internships/    # Internship queues, supervisor assignments, detail views
│   │   │   ├── notifications/  # Notification center
│   │   │   ├── reports/        # Administrative reporting and export tables
│   │   │   ├── supervisors/    # Supervisor directory and workload balancing
│   │   │   ├── tasks/          # Task drafts, category management, task review
│   │   │   └── validation/     # Document validation queue with AI inspection
│   │   └── shared/ui/          # Data tables, drawers, dialogs, badges, pagination
│   └── environments/           # Environment configurations (dev, staging, prod)
├── docs/                       # Security reviews, QA audits, deployment guides
├── e2e/                        # Playwright automated test suites
├── package.json                # Dependencies and npm scripts
└── angular.json                # Angular CLI configuration
```

---

## ⚙️ Configuration

Configure backend endpoints in `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
  wsUrl: 'ws://localhost:8080/ws'
};
```

For production builds, verify settings in `src/environments/environment.prod.ts`.

---

## 🚀 Installation & Running

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm start
# Equivalent to: ng serve
```
Navigate to [http://localhost:4200](http://localhost:4200). The app will automatically reload on source changes.

### 3. Production Build
```bash
npm run build
```
Build output is saved to the `dist/steg-back-office/` directory.

### 4. Running Quality Checks & Tests
```bash
# Run unit tests
npm test

# Type checking
npm run typecheck

# Run Playwright E2E tests
npm run e2e
```
