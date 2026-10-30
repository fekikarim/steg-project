# STEG Front Office (Candidate & Intern Portal)

[![Next.js 16](https://img.shields.io/badge/Next.js-16.3-black.svg?logo=next.js&logoColor=white)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19.2-blue.svg?logo=react&logoColor=white)](https://react.dev)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind%20CSS-4.0-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![next-intl](https://img.shields.io/badge/i18n-FR%20%7C%20AR%20%7C%20EN-purple.svg)](https://next-intl-docs.vercel.app)

The official public-facing web portal for the STEG platform. Built with **Next.js 16** (App Router) and **React 19**, it provides prospective candidates and active student interns with an intuitive, accessible, and fully multilingual interface.

---

## ✨ Features & Capabilities

- **Multilingual Support (French, Arabic, English):**
  - Seamless language switcher with full Right-to-Left (RTL) styling for Arabic.
  - Localized messages using `next-intl`.
- **6-Step Intelligent Application Wizard (`/apply`):**
  1. *Step 1 — Candidate Identification:* Full name, CIN/Passport, date of birth, contact details.
  2. *Step 2 — Education & University:* University picker, major, academic level (Licence, Master, Ingénieur).
  3. *Step 3 — Internship Preferences:* Start/end dates, desired STEG department, internship type (PFE, ouvrier, technicien).
  4. *Step 4 — Document Upload:* Assignment letter, CV, CIN copy with real-time format validation.
  5. *Step 5 — AI Pre-Screening Feedback:* Instant display of document readability and OCR verification results.
  6. *Step 6 — Review & Confirmation:* Summary confirmation and submission yielding a unique tracking reference.
- **Application Tracking (`/track`):**
  - Public status lookup using reference number and CIN without requiring account creation.
- **Candidate Account Workspace (`/(account)/*`):**
  - Authenticated candidate profile, historical applications, document resubmission, and notifications.
- **Informational Pages:**
  - Company presentation (`/about`), internship categories (`/internships`), FAQ (`/faq`), and contact form (`/contact`).
- **Real-Time Notifications:**
  - Live alerts on dossier status updates via STOMP WebSocket.

---

## 🛠 Tech Stack & Dependencies

- **Framework:** Next.js 16.3.4 (App Router)
- **UI Library:** React 19.2.8 & React DOM
- **Styling:** Tailwind CSS 4, `@tailwindcss/postcss`, `tailwind-merge`
- **Internationalization:** `next-intl` (v4.14.2)
- **Real-Time Client:** `@stomp/stompjs` (v7.1.1)
- **End-to-End Testing:** Playwright 1.63

---

## 📁 Folder Structure

```
steg-front-office/
├── src/
│   ├── app/
│   │   ├── [locale]/           # Localized route tree (fr, ar, en)
│   │   │   ├── (account)/      # Authenticated user routes (profile, applications, docs)
│   │   │   ├── apply/          # 6-step application intake wizard
│   │   │   ├── track/          # Public application tracker
│   │   │   ├── internships/    # Internship catalog
│   │   │   ├── about/          # STEG background and presentation
│   │   │   ├── faq/            # Frequently asked questions
│   │   │   ├── login/          # Candidate login
│   │   │   └── register/       # Candidate registration
│   │   └── api/                # Next.js API route proxies to Spring Boot backend
│   ├── components/
│   │   ├── apply/              # Stepper components (Personal, Education, Dates, Review)
│   │   ├── auth/               # Login, registration, password reset forms
│   │   ├── layout/             # Header, footer, language switcher, theme toggles
│   │   └── ui/                 # Reusable buttons, cards, modals, file dropzones
│   ├── messages/               # i18n JSON dictionaries (en.json, fr.json, ar.json)
│   └── lib/                    # API client utilities, STOMP helpers, auth wrappers
├── public/                     # Static assets, STEG logos, illustrations
├── e2e/                        # Playwright end-to-end test scenarios
├── package.json                # Project dependencies and npm scripts
└── next.config.ts              # Next.js configuration
```

---

## ⚙️ Configuration

Create `.env.local` in the project root:

```bash
# Core backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8080

# Real-time WebSocket gateway
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
```

---

## 🚀 Installation & Running

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the portal.

### 3. Production Build
```bash
npm run build
npm run start
```

### 4. Running Quality Checks & Tests
```bash
# Type check TypeScript
npm run typecheck

# Lint check
npm run lint

# Playwright End-to-End tests
npm run e2e
```
