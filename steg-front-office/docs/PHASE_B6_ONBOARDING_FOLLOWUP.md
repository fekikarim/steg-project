# B6 Follow-up — New-User Onboarding Gap (CLOSED)

## Defect

Registration created an authenticated `User` but no `Candidate` row, and no
UI path existed to `POST /api/candidates`. New users looped
`/profile` (no-profile card) → `/apply` (bootstrap 404 on the missing
profile) with no way forward. Auto-creation at registration was deliberately
rejected: `Candidate` requires `nationalIdHash` (unique, NOT NULL) and
`university_id` (NOT NULL), neither of which registration collects — the
existing `POST /api/candidates` contract (CIN + university + identity) is
sufficient and was reused unchanged. No backend changes were needed.

## Files changed (front office only)

- `src/lib/api/candidate.ts` — `createMyCandidate(token, body)` (POST
  `/api/candidates`, 201). Body type reuses `CandidateProfileUpdate`
  (field-identical to backend `CandidateRequest`).
- `src/lib/api/profile-client.ts` — `createProfile(body)` browser call.
- `src/app/api/profile/route.ts` — `POST` proxy (same session/refresh/error
  contract as GET/PUT); `mapError` now forwards the backend `error` code
  (needed for `CANDIDATE_*` mapping; additive, B5-documents precedent).
- `src/components/profile/ProfileCreateForm.tsx` (new) — creation form
  reusing `PersonalSection` / `AcademicSection` / `SkillsSection` verbatim
  (same fields, validation display, university list, chip editors; CIN goes
  through unmodified `CinField`, so masking/reveal/edit semantics are
  preserved by construction). Creation requires `nationalId` (backend
  NotBlank); maps 400 field errors + 422 `CANDIDATE_NATIONAL_ID_DUPLICATE`
  to a field error; 422 `CANDIDATE_PROFILE_EXISTS` re-reads the profile
  (idempotent retry path).
- `src/components/profile/ProfileWorkspace.tsx` — `noProfile` phase renders
  the form; `onCreated` persists server state and enters the normal
  workspace; `onProfileExists` refetches. Edit/save/conflict flows untouched.
- `src/messages/{fr,en,ar}.json` — `profile.createTitle/createIntro/
  createSubmit/createSuccess/errCinDuplicate`; removed now-unused
  `noProfileTitle/noProfileBody/noProfileApply`. Parity: 660 keys each.

## Backend endpoint / DTO used (unchanged)

`POST /api/candidates` (`@PreAuthorize CANDIDATE`), `CandidateRequest`
(firstName, lastName, email, phone?, birthDate?, address?, speciality?,
diploma?, skills?, languages?, universityId!, nationalId!) →
201 `CandidateDetailResponse`. Business rules honored as returned:
`CANDIDATE_PROFILE_EXISTS` / `CANDIDATE_NATIONAL_ID_DUPLICATE` (422),
Bean Validation (400 + fieldErrors), university existence (404).

## New-user E2E evidence (`steg-intern/qa/onboarding-qa.js`, 45/45)

A–Q mapped: fresh UI registration → session authenticated → `/profile`
shows the creation form (no workspace) → empty submit validates with zero
network → fill (incl. university select + masked CIN edit flow) → POST
`/api/profile` **201** with correct payload → workspace + toast → GET me
200 → reload keeps workspace → edit/save persists (B3 regression) →
logout → anonymous → login → workspace normal → `/apply` bootstrap with
zero API 404s → wizard starts → storage/cookie/DOM leak scan clean (CIN
masked on profile, absent on apply) → duplicate-CIN second user gets 422
`CANDIDATE_NATIONAL_ID_DUPLICATE` with localized field error and stays on
the form → EN + AR-mobile (RTL, no overflow) repeat register/create/apply.

## Regression results

- `npm run lint` / `typecheck` clean; `npm run build` success (57 pages).
- B6 suite (`qa/b6-qa.js`, seeded notifications removed after): **59/59**.
- B5 suite (`qa/b5-qa.js` upload matrix): **47/47**.
- B4 wizard path covered by B6's fresh-user-equivalent submit flow
  (`apply-qa.js` was lost to a temp-dir wipe; noted, not re-derived).

## i18n / responsive / security

- Parity 660/660/660; AR RTL + 375 px overflow checks pass; desktop/mobile
  layouts verified.
- No JWT/token/password/CIN leakage: httpOnly session cookies invisible to
  JS (asserted absent from `document.cookie`), empty token-like storage,
  no JWT/password patterns in DOM, CIN never in body text (masked bullets
  on profile).
- E2E also exposed (and scoped out of) test-only findings: accessible names
  include the visual `*` marker (matched with anchored regexes), and the
  header language `<select>` precedes the university `<select>` in DOM order
  (scoped selectors used).

## Remaining limitations

- `profile.summaryTitle` is a dead key (workspace renders no such heading;
  pre-existing, left untouched); E2E markers use `accountTitle`.
- REJECTED/NEEDS_CORRECTION detail alerts remain covered by design (no staff
  credentials in QA to produce those states live).
- Cleanup verified: seeded notifications deleted, zero live DRAFTs, temp
  probe files/cookies/tokens removed, backend `:8080` + front `:3000`
  healthy.
