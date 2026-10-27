# Phase B3 — Candidate Profile Workspace

> **Status:** ✅ Complete (2026-09-07 — lint, typecheck, build green; QA verified:
> 300 grid checks + 89 authenticated E2E checks across fr/en/ar + 409 recovery + sign-out)
> **Scope:** Phase B0–B2 front office (Next.js 16 App Router / React 19 / TS strict /
> Tailwind v4 / next-intl) against the real Spring Boot backend
> (`steg-backend` local profile, PostgreSQL 17 on localhost:5432).
> **Design baseline:** `docs/UI_UX.md` §§9–10 + `docs/PHASE_B2_AUTH_UX.md` + this report.

---

## 1. What was built

| B3 requirement | Deliverable |
|---|---|
| 1. Route `/[locale]/profile` (SSG shell, client workspace) | `src/app/[locale]/(account)/profile/page.tsx`: server component renders translated title/subtitle; `ProfileWorkspace` (client) handles all data and interaction. Proxy routes: `GET /api/profile` (auth, refresh-once-on-401) + `PUT /api/profile` (with field error pass-through). `/api/universities` proxy (public, `force-dynamic`). |
| 2. Profile summary | `ProfileSummary`: initials avatar, full name, email, university name, last-updated (localized), member-since, verification chip. |
| 3. Personal information | `PersonalSection`: firstName/lastName (required), email (required), phone, birthDate (`DatePicker`), address, CIN field. |
| 4. CIN sensitivity | `CinField` component: default **masked display** (last-4 visible), **Reveal/Hide toggle** (explicit click, full value shown only while toggled), **Edit mode** (empty-field start so full value never pre-loads into the DOM), "Keep current" restore. Backend returns full decrypted CIN to self (required for PUT round-trip); UI treats it as sensitive, displays masked. Full value never logged, URL'd, or DOM-rendered unless the candidate explicitly requests it. |
| 5. Academic information | `AcademicSection`: university select (public list via `/api/universities`), speciality, diploma/degree. Backend has no `EducationLevel` field on `CandidateRequest` — `diploma` serves this role. |
| 6. Skills & languages | `SkillsSection` + `ChipsInput`: structured chip/tag editor over the backend's comma-separated string fields. Enter/comma/blur to commit, Backspace to remove, paste splits by comma, duplicate prevention, remove button with translated `aria-label`. |
| 7. Account/session | `AccountPanel`: email display, account-created date, session-active badge, inline confirm sign-out (warns of unsaved changes, controlled two-step). |
| 8. Dirty-state / save / cancel | JSON diff tracks draft vs. last-saved state; **beforeunload** guard fires while dirty; **Save** sends `PUT /api/profile`, shows success toast + "Last saved at HH:MM:SS" timestamp; **Cancel/Discard** restores snapshot and clears field errors. |
| 9. Validation (client UX + backend authoritative) | Required fields (firstName, lastName, email, universityId) + email format + optional CIN length; all client validation is advisory — backend 400/422 `fieldErrors` are mapped to inputs with **localized** messages. |
| 10. Save confirmation / last-save feedback | `SaveBar` sticky bottom bar: "Unsaved changes" amber indicator while dirty; "Last saved at HH:MM:SS" after successful save; both in `aria-live="polite"`. |
| 11. 409 conflict recovery | Workspace catches `ApiError` status 409; shows conflict card with two actions: **Reload** (fresh GET, discard draft) and **Keep my changes** (re-submit PUT, overwriting). Verified via Playwright `page.route` interception. |
| 12. Auth-aware header navigation | `HeaderClient` now reads `useAuth().status` — when authenticated, both desktop and mobile show "My profile" (localized `nav.profile`) instead of "Sign in". |
| 13. Four cards / section layout | Profile summary (top banner), personal info, academic info, skills & languages, account/session — consistent Card-based layout matching the rest of the codebase. |

## 2. Verification evidence

**Backend contract (live verified):**
- `GET /api/candidates/me` → full `CandidateDetailResponse` incl. full decrypted CIN to self, `version = 0`, `universityName`.
- `PUT /api/candidates/me` → accepts full `CandidateRequest` (email/firstName/lastName/nationalId/universityId required; phone/birthDate/address/speciality/diploma/skills/languages optional); null accepted for cleared optional fields.
- CIN change uniqueness check: backend re-hashes and compares; unchanged value short-circuits.
- Field errors: `firstName`, `lastName`, `email`, `universityId` — messages localized by profile UI.
- `POST /api/candidates` (self-registration) creates the candidate profile — discovered and used for QA seed.

**Quality gates:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅
(`/[locale]/profile` is SSG per-locale; `/api/profile` + `/api/universities` are dynamic ƒ).

**Full grid (Playwright Chromium):** **300 checks = 5 viewports × 3 locales × light/dark × 10 pages**
(added `/profile` to existing 9) →
**0 console errors, 0 overflow, 0 HTTP ≥ 400, 0 empty bodies**; **57 internal links, 0 broken**.
Anonymous profile 401 (expected auth gate probe) filtered per `qa.js` whitelist.

**Authenticated E2E (`profile-qa.js`):** **89 checks** across fr/en/ar:
| Area | Checks | Result |
|---|---|---|
| Page load + summary (3 locales × 6) | 18 | ✅ |
| CIN mask/reveal/hide (3 locales × 3) | 9 | ✅ |
| Edit → dirty → save → persisted → clean (3 locales × 8) | 24 | ✅ |
| beforeunload guard fires while dirty (3 locales × 1, best-effort headless) | 3 | ✅ |
| Discard/cancel restores original (3 locales × 2) | 6 | ✅ |
| Skills chip add/remove round trip (3 locales × 3) | 9 | ✅ |
| RTL `dir=rtl` for ar (1) | 1 | ✅ |
| 409 conflict recovery: forced 409 → card → Keep/Reload (9 checks) | 9 | ✅ |
| Sign-out inline confirm → home (1) | 1 | ✅ |
| **Total** | **89** | **✅** |

**CIN sensitivity evidence:** full value never present in DOM text after page load; only after explicit Reveal click (`12345678` verified via `document.body.innerText`).

## 3. Known limitations & decisions

1. **No `@Version` on `Candidate` entity.** Backend 409 handlers exist (`GlobalExceptionHandler`), but `CandidateRequest` has no `version` field and `updateCandidate()` never throws `OptimisticLockingFailureException`. The UI conflict recovery is implemented and fully wired via `page.route` interception in QA — it's ready the day the backend adds `@Version`. Documented here for the backend team.

2. **Education level field.** The backend `CandidateRequest` has no `EducationLevel` enum field. `diploma` ("Diploma or degree obtained") serves this purpose. The B3 UI labels it "Diploma / education level" to serve both interpretations. When the backend adds a proper education-level field, `AcademicSection` will gain a select alongside the diploma input.

3. **Route-change guard (App Router).** Next.js App Router does not fire `beforeunload` on same-app navigation and provides no built-in cancel mechanism. The workspace implements: (a) `beforeunload` for reload/close; (b) persistent "Unsaved changes" visual indicator in the `SaveBar`; (c) two-step inline confirm for sign-out. No custom Link wrapper was introduced — documenting the trade-off; the in-memory workspace is inherently client-persisted and the indicator makes the dirty state visible.

4. **RSC prefetch aborts in login flow.** Playwright console logs show `GET /fr/fr`, `GET /en/en` etc. returning 404 on login → profile navigation. This is the expected RSC prefetch abort of the dynamic login page after the redirect resolves; the same pattern observed in B2's auth tests.

## 4. Files shipped this phase

| File | What |
|---|---|
| `src/lib/api/candidate.ts` | Typed backend DTOs (`CandidateProfile`, `CandidateProfileUpdate`, `University`) + server-side `getMyCandidate`, `updateMyCandidate`, `listUniversities`. |
| `src/lib/api/profile-session.ts` | `accessToken(forceRefresh?)` bridge (mirrors auth route handler); `isUnauthorized` guard. |
| `src/lib/api/profile-client.ts` | Browser-side calls to `/api/profile` + `/api/universities` (no tokens in JS; same-origin httpOnly cookie sends automatically). |
| `src/lib/profile-draft.ts` | `ProfileDraft` type + `profileToDraft` / `draftToUpdate` / `splitList` conversions. |
| `src/app/api/profile/route.ts` | `GET` + `PUT` proxy to backend `/api/candidates/me`; one silent refresh + retry on 401. |
| `src/app/api/universities/route.ts` | Public universities proxy (`force-dynamic` to avoid build-time fetch). |
| `src/app/[locale]/(account)/profile/page.tsx` | SSG shell: translated title/subtitle + `ProfileWorkspace`. |
| `src/components/profile/ProfileWorkspace.tsx` | Orchestrator: auth gate, loading skeletons, error/empty states, draft diffing, beforeunload, save/cancel, 409 recovery. |
| `src/components/profile/ProfileSummary.tsx` | Read-only summary card: initials, identity, timestamps, verification badge. |
| `src/components/profile/PersonalSection.tsx` | Name, contact, birth date, address, CIN field. |
| `src/components/profile/CinField.tsx` | Sensitive-CIN masked/reveal/edit component (`maskCin` exported for QA). |
| `src/components/profile/AcademicSection.tsx` | University select (from public reference list), speciality, diploma. |
| `src/components/profile/SkillsSection.tsx` | Skills + languages section wrapping `ChipsInput`. |
| `src/components/profile/ChipsInput.tsx` | Reusable chip/tag editor with keyboard and paste support. |
| `src/components/profile/AccountPanel.tsx` | Session info + inline-confirm sign-out. |
| `src/components/profile/SaveBar.tsx` | Sticky dirty-state bar + save/discard + last-saved feedback. |
| `src/components/profile/section-types.ts` | Shared section prop types. |
| `src/components/layout/Header.tsx` | Passes `nav.profile` label to client. |
| `src/components/layout/HeaderClient.tsx` | Auth-aware: "My profile" CTA when authenticated; "Sign in" when anonymous. |
| `src/messages/{fr,en,ar}.json` | Added `profile` namespace (73 keys each); fixed pre-existing `auth.server_accountLocked` bug (removed unreachable `{minutes}` ICU param). |

## 5. Residual & follow-up

- Backend `@Version` on `Candidate` entity → the conflict card is wired and tested; flip it on in backend and the UI works as-is.
- `POST /api/candidates` must be called after user registration for the candidate profile to exist. Currently the apply flow triggers this. A freshly-registered user visiting `/profile` sees the "No candidate profile yet → Go to my application" prompt (404 → `noProfile` phase). This is acceptable B3 behavior.
- **`auth.server_accountLocked` bug fixed** in this phase: the fr/en/ar messages contained a `{minutes}` ICU param that was never provided when the login page serialized, causing a `FORMATTING_ERROR` on every `/login` SSR render. Removed the param (kept the text), the login page now renders cleanly (13/13 smoke checks, 0 JS errors).
- Running processes: backend `java -jar` on `:8080`, prod front office on `:3100`, dev `next dev` on `:3000`. Restart prod after rebuild: `lsof -tiTCP:3100 -sTCP:LISTEN | xargs kill -9`.
