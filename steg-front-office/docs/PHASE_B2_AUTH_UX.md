# Phase B2 — Candidate Authentication & Account Recovery UX

> **Status:** ✅ Complete (2026-09-07 — lint, typecheck, build green; QA verified:
> 270 viewport/theme/locale checks, 16 E2E auth checks, 14 interaction/a11y checks)
> **Scope:** Phase B0–B1 front office (Next.js 16 App Router / React 19 / TS strict /
> Tailwind v4 / next-intl) against the real Spring Boot backend
> (`steg-backend` local profile, PostgreSQL 17 on localhost:5432).
> **Design baseline:** `docs/UI_UX.md` §§9–10 (forms, a11y, states) + `docs/PHASE_B0_FOUNDATIONS.md`.

---

## 1. What was built

| B2 task | Deliverable |
|---|---|
| 1. Register form | New real route `src/app/[locale]/register/page.tsx` + `src/components/auth/RegisterForm.tsx`: personal (firstName/lastName/phone) + account (email/password/confirm) fieldsets, required/optional markers, `acceptTerms` checkbox, password strength meter, double-submit protection, values preserved on server-reject. Phones `POST /api/auth/register` via host-route proxy (201 → auto-login session). |
| 2. Login form | `src/app/[locale]/login/page.tsx` (server-rendered, reads `searchParams`) + `LoginForm.tsx`: email/password/remember (informational — httpOnly cookies persist regardless), server `fieldErrors` mapped to fields, incorrect-credentials/locked/rate-limited/generic localized messages, `role=alert` error summary with traceId. |
| 3. Duplicate / invalid / locked / throttled account states | `src/lib/auth-errors.ts` (`mapAuthError`):
  - duplicate email → field error on email (verified: 422 "An account with this email already exists.")
  - invalid credentials → localized invalid-credentials (verified: 422 "Invalid email or password.")
  - locked → ACCOUNT_LOCKED → localized (verified against `AccountLockedException`)
  - rate-limited → "Too many…" / 429 → localized rate-limited (backend: 10 attempts / window, `AuthService`), register 429 via `RateLimitExceededException`
  - unknown/offline → generic (backend down ⇒ 502). Raw backend English never shown in UI. |
| 4. Accessible forms (UI_UX §9.2) | Labels wired via `htmlFor`/`aria-describedby`; Required/optional markers; appropriate input types (`email`, `tel`, `password`, shielded numeric advice); focusable skip-link nav; `role=alert` errors; `aria-valuemin/max/now` strength meter; show/hide password toggle with `aria-label`; keyboard-only verified. |
| 5. Account recovery UX | `src/app/[locale]/forgot-password/page.tsx` + `ForgotPasswordForm.tsx`: **honest pending flow** — explains reset is coming, disabled submit with "coming soon" marker, support/back links. **No fake "email sent" success** and **no `/reset-password/[token]` route** until the backend exposes the endpoints (backend has none; decision recorded in §4). |
| 6. Return-to across auth | Header sign-in CTA (/desktop + /mobile) carries `?returnTo=<currentPath>` via `HeaderClient` (`usePathname`); `src/lib/return-to.ts` `sanitizeReturnTo` blocks open redirects (rejects external `//`, `http(s)://`, >512 chars); login redirects to sanitized returnTo and shows an in-form "you'll be redirected" notice (fr/en/ar). |
| 7. Success feedback + double-submit | Register success → `/fr`; login success → returnTo; submit buttons show loading spinner + are disabled while in-flight; duplicate form POSTs ignored (in-flight guard). |
| 8. Loading skeletons / spinners | Auth submit spinners; existing `loading.tsx` segment skeletons cover the new pages. |
| 9. Keyboard + mobile typing UX | Verified keyboard-only: skip-link → logo → nav → lang → theme → sign-in → apply → firstName…; label association; toggles aria-labelled. Mobile: `email`/`tel` types + autocomplete; **fixed iOS auto-zoom** — control font-size raised 14px→16px across the shared design system (`Input`, `Select`, `DatePicker`, `PasswordInput`), verified ≥16px so no Safari think-on-focus. |
| 10. fr/en/ar + RTL | New `auth` message namespace in `fr/en/ar.json` (all keys present, no untranslated render); `ar` pages render `dir="rtl"` + `lang="ar"` verified on login/register; return-to notice localized per locale. |

## 2. Verification evidence

- QA gate: `npm run lint` ✅ · `npm run typecheck` ✅ · `npm run build` ✅ (login is `ƒ` dynamic for returnTo — required behavior; register/forgot-password SSG). No build warnings.
- Full grid (Playwright Chromium): **270 checks = 5 viewports × 3 locales × light/dark × 9 pages**
  (`/`, about, history, internships, faq, contact, login, register, forgot-password) →
  **0 console errors, 0 overflow, 0 HTTP ≥ 400, 0 empty bodies**; **54 internal links, 0 broken**.
- E2E auth flow vs **real backend** (fresh POSTGRES-backed instance): register 201 → httpOnly cookies set (`steg_access` path `/` + `steg_refresh` path `/api/auth`, both httpOnly) → session probe `{authenticated:true}` → login with `?returnTo=/apply` redirects to `/fr/apply` → bad-login stays on page, email preserved, error shown → duplicate-email stays on register with field error → forgot page shows pending notice and **no** fake sent-message. **16/16 checks pass.**
- Token hygiene: **no JWT/refresh string in localStorage, sessionStorage, document.cookie, or rendered DOM**; access/refresh exposed only as httpOnly cookies. Console noise filtered = Next.js RSC prefetch aborts of the dynamic `/login` (benign; added to QA whitelist).
- Interaction/a11y: keyboard reachability of all form fields, label association, password show/hide, strength meter rises with complexity, confirm-mismatch error, accept-terms required error, mobile input types, ≥16px controls → **all pass**.
- RTL: `lang=ar` pages report `dir="rtl"`; Arabic notice text rendered ("سيتم توجيهك إلى وجهتك بعد تسجيل الدخول.").

## 3. Changes shipped this phase

| File | Change |
|---|---|
| `src/app/[locale]/register/page.tsx` | Real registered-candidate form page (was placeholder) |
| `src/app/[locale]/login/page.tsx` | Real login; reads `searchParams.returnTo` server-side (uses `next/navigation` — next-intl navigation exports no `useSearchParams`) |
| `src/app/[locale]/forgot-password/page.tsx` | Pending recovery flow page (+ `ForgotPasswordForm.tsx`) |
| `src/app/api/auth/register/route.ts` | New proxy route: `RegisterRequest` → backend, maps errors, sets session cookies, 201 `{ok:true}` |
| `src/app/api/auth/login/route.ts` | Now maps backend errors via `mapAuthError` |
| `src/lib/auth.tsx` | `register(payload)` + `AuthResult{ok,reason?,message?,fieldErrors?}` |
| `src/lib/auth-errors.ts`, `src/lib/password.ts`, `src/lib/return-to.ts` | New: error-code mapping, strength estimator, open-redirect-safe returnTo sanitizer |
| `src/components/auth/*` | New: `AuthCard`, `PasswordInput` (toggle+strength), `Checkbox`, `ErrorSummary`, `LoginForm`, `RegisterForm`, `ForgotPasswordForm` |
| `src/components/layout/HeaderClient.tsx` | Sign-in CTA carries sanitized `returnTo` (desktop + mobile) |
| `src/components/ui/{Input,Select,DatePicker}.tsx`, `src/components/auth/PasswordInput.tsx` | Control font-size 14→16px (iOS no-zoom) |
| `src/components/ui/icons.tsx` | `IconEyeOff` added |
| `src/messages/{fr,en,ar}.json` | New `auth` namespace + `acceptTermsRequired`, `returnToNotice`, etc. |

## 4. Known limitations & decisions (for B3+)

- **No backend reset-password / forgot-password endpoints** — the front office ships the honest pending flow only. Onky-to-build when the backend exposes them:
  1. `POST /api/auth/forgot-password` (+ rate-limited, auditable) — then wire `ForgotPasswordForm` to call it and show a real non-committal acknowledgement per UX (no account enumeration, or rate `429` visible per task).
  2. `POST /api/auth/reset-password` + token route (`/[locale]/reset-password/[token]`) gated by expiry/reuse on the backend.
- **Remember-me** checkbox is informational by design: the cookie bridge already persists 7-day refresh httpOnly; no client-side token store exists, so there is nothing for "remember" to branch on. Flag if product wants a *short-lived* alternative.
- `/login` is dynamic (needs `returnTo`), register/forgot remain SSG — acceptable; dynamic route is prefetched via RSC aborts (filtered in QA, no user impact).
- Local QA stack used: backend `local` profile via `mvnw package` + `java -jar` (nohup), prod front office on `:3100` against the fresh build. `.env` carries the local dev secrets (not committed).

## 5. Files QA'd / residual

- Playwright sandbox: `/var/folders/mj/9p01m9996z5gl58h0_h72tzr0000gn/T/opencode/qa/{qa.js,auth-qa.js,interaction-qa.js,rtl*.js,taborder*.js,trace404.js}` — rerun with `BASE_URL=http://localhost:3100 node qa.js` etc.
- No open defects. Remaining roadmap: B3 companion dashboard (session-aware header), B4 applications workspace (`/apply`).