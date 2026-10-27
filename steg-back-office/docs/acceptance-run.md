# STEG Back Office — Acceptance Run (S12a)

> How to read this file: each scenario step has the automated Testcontainers
> test (or the manual click path), the expected result, and a pass/fail
> column. **Manual steps are marked NOT YET EXECUTED** — they are for the
> operator (Karim) to execute against the running stack.

Stack for manual runs: `docker compose up -d` (seed vars forwarded by the
root compose; set `STEG_SEED_DEMO_ENABLED=true` + a self-chosen
`STEG_SEED_DEMO_PASSWORD` in `.env`), backend `:8080`, python-ai `:8000`,
Angular `:4200` (`npm start` in `steg-back-office/`), Next `:3000`.
The demo password is the local value in `.env`
(`grep '^STEG_SEED_DEMO_PASSWORD=' .env`); demo accounts:
`hr.demo@demo.steg.tn` (ADMIN), `supervisor.demo@demo.steg.tn`
(SUPERVISOR), `candidate.demo@demo.steg.tn` (CANDIDATE).

## Scenario A — Admin supervises an obligatory PFE

Automated: `steg-backend/src/test/java/tn/steg/backend/acceptance/ScenarioAAdminSupervisesChainTest.java`
→ `adminSupervisesObligatoryPfeEndToEnd` — **PASS** (2026-10-04, part of the
`./mvnw clean test` gate: 776 passing).

| # | Step | Automated test / manual click path | Expected | Result |
|---|---|---|---|---|
| A1 | Candidate registers + validates (front office) | chain: `POST /api/auth/register` → `POST /api/candidates` (×2) | Admin notified (`Candidate` delivery); both visible in `GET /api/candidates/manage` | PASS |
| A2 | Obligatory PFE application submitted | chain: `POST /api/applications` (Jan→Jun ⇒ PFE OBLIGATOIRE) → `POST …/submit` (×2) | `SUBMITTED`; Admin notified (`InternshipApplication` delivery) | PASS |
| A3 | Approve, Admin preselected as supervisor | chain: `POST /api/applications/{id}/approve` (`supervisorUserId: null`) | `supervisorUserId` = approving Admin; `credentialEmail` + `temporaryPassword` in body; `Cache-Control: no-store` | PASS |
| A4 | Credentials emailed with the same secret | chain: recording `EmailSender` fake | email to the candidate address contains the same temp password | PASS |
| A5 | Student login forces password change | chain: `POST /api/auth/login` → `mustChangePassword: true` → other endpoint `403 PASSWORD_CHANGE_REQUIRED` → `POST /api/auth/change-password` → login `mustChangePassword: false` | forced change enforced, then cleared | PASS |
| A6 | Admin bulk-adds tasks to two students (manual) | chain: `POST /api/internships/tasks/bulk` + `X-Idempotency-Key`, 1 task × 2 internships | `items[].status = OK`, per-item results | PASS |
| A7 | AI drafts from specs PDF → bulk-add to both | chain: fake Gemini `POST …/drafts/generate` (multipart PDF) → `POST …/drafts/bulk-add` (`draftIds` × `internshipIds`) | 2 drafts, 4 pairs created, audit metadata-only | PASS |
| A8 | Student completes tasks → Admin notified | chain: `PATCH …/tasks/{id}/status?status=COMPLETED` (intern token) | `Task` deliveries to the supervising Admin | PASS |
| A9 | Admin approves/denies | chain: `POST …/tasks/{id}/review` approve / deny-with-reason | `APPROVED` / `DENIED` (`TASK_APPROVED`/`TASK_DENIED` audited) | PASS |
| A10 | Report + journal submitted → validation queue | chain: multipart `POST …/deliverables` + `POST …/submit` (×2); `GET /api/internship-validation/queue` | `REPORT_SUBMITTED`, queue row present | PASS |
| A11 | AI verification (fake python-ai) | chain: stub `POST …/verify` REPORT + JOURNAL | `overall: PASS`, 7 checks | PASS |
| A12 | Manual decisions → VALIDATED | chain: `POST …/decisions` REPORT + JOURNAL `VALIDATED` | `VALIDATED` (AI never auto-validates) | PASS |
| A13 | Receipt (idempotent) | chain: `POST …/receipt` twice | `PAY-*`, `TND`, same reference both calls → `RECEIPT_ISSUED` | PASS |
| A14 | Certificate | chain: `POST /api/internships/{id}/certificates` **while VALIDATED** (gate, see note) | `CERT-*`, listed in `GET /api/certificates` | PASS |
| A15 | Audit rows + sources | chain: `findByAction` per code | all 16 codes present; `CANDIDATE_VALIDATED` BACK_OFFICE, `DELIVERABLE_SUBMITTED` MOBILE, `AI_VERIFICATION_RUN` AI, task writes BACK_OFFICE (assumption #20) | PASS |
| A16 | Dashboard reflects data | chain: `GET /api/reports/admin-summary` | `applicationsByStatus.APPROVED ≥ 2`, `newCandidates ≥ 2`, `receiptsIssued ≥ 1`, workload Admin row `candidateCount ≥ 2` | PASS |
| A17 | No secret in audit | chain: scan `newValues`/`oldValues` of the chain's rows | temp password absent everywhere | PASS |
| A18 | Back-office UI replay (manual) | Login `:4200` as Admin → Candidates → Applications → approve with "I supervise" → credentials dialog → Tasks → Validation → receipt → Certificates | same states as A1–A14 | NOT YET EXECUTED |
| A19 | Mobile replay (manual) | `stegappe` login with emailed credentials → forced change → complete a task → denied task shows reason → submit report + journal | mirrors A5/A8/A10 | NOT YET EXECUTED |

**Note (certificate order):** the certificate eligibility gate is exactly
`VALIDATED` (audit assumption #17), so the chain generates the certificate
*before* the receipt moves the internship to `RECEIPT_ISSUED`. The brief's
narrative lists the receipt first; behavior is unchanged, only the test
order respects the gate.

**Definition (audit #33):** issued = generated + non-revoked. The dead
`ISSUED` state is removed (`V50`); the dashboard tile counts non-revoked
certificates, proven by
`DashboardSummaryIntegrationTest.generatedCountsAsIssuedAndRevokedDropsOut`.

## Scenario B — Separate supervisor

Automated: `steg-backend/src/test/java/tn/steg/backend/acceptance/ScenarioBSeparateSupervisorTest.java`
→ `separateSupervisorIsScopedAndReassignable` — **PASS** (2026-10-04).

| # | Step | Automated test / manual click path | Expected | Result |
|---|---|---|---|---|
| B1 | Admin creates Supervisor S | chain: `POST /api/supervisors` | `201`, `temporaryPassword`, `no-store`, `mustChangePassword` login | PASS |
| B2 | Approve with S selected | chain: `POST …/approve` (`supervisorUserId: S`) | `supervisorUserId = S` | PASS |
| B3 | S sees only own candidates/tasks | chain: `GET /api/candidates/manage`, `GET /api/internships/tasks` as S | own email present, foreign absent | PASS |
| B4 | Task notification routing | chain: intern completes task | S notified, Admin NOT notified; Admin global pages still show everything; `supervisor-summary.myCandidates = 1` | PASS |
| B5 | S blocked on Admin-only surface | chain: `GET /api/supervisors/manage`, `GET /api/internship-validation/queue`, `POST …/receipt`, `POST …/certificates`, `POST …/approve` as S | `403` everywhere | PASS |
| B6 | S blocked on another supervisor's data | chain: `GET /api/candidates/{foreign}/overview` as S | `404` (no existence leak) | PASS |
| B7 | Admin reassigns S → himself | chain: `PUT /api/supervisors/{s}/reassign/{internship}` (`newSupervisorUserId: admin`) | S list loses candidate; next completion notifies Admin not S; `SUPERVISOR_REASSIGNED` audit with new id | PASS |
| B8 | Back-office UI replay (manual) | Login as S `:4200` → only own candidates/tasks visible; admin-only nav hidden; direct URL to `/supervisors` redirects to `/forbidden` | mirrors B3/B5 | NOT YET EXECUTED |
| B9 | Reassignment UI replay (manual) | Admin → Supervisors → change supervisor to self | scope + notifications follow (mirrors B7) | NOT YET EXECUTED |

## Scenario C — Failure modes

Automated: `steg-backend/src/test/java/tn/steg/backend/acceptance/ScenarioCFailureModesTest.java`
(8 tests, fake Gemini + throwing-mail mock + `AI_MODE` python-ai stub) —
**ALL PASS** (2026-10-04).

| # | Case | Automated test | Documented error | Result |
|---|---|---|---|---|
| C1 | Gemini key missing | `geminiKeyMissingGives503AndManualFallbackWorks` | `503 AI_UNAVAILABLE` ("AI unavailable"); manual draft `201` + bulk-add `200`, 1 real task | PASS |
| C2 | python-ai down | `pythonAiDownDegradesAndManualDecisionStillCompletes` | verify → `INCONCLUSIVE` + `degraded: true`; status stays `REPORT_SUBMITTED`; manual decisions still reach `VALIDATED` | PASS |
| C3 | Brevo down | `brevoDownDoesNotRollBackApproval` | approve `200` with `credentialEmailSent: false`; account exists (`mustChangePassword`); `POST /api/intern-accounts/{id}/reset-password` issues a NEW password; internship intact | PASS |
| C4 | Duplicate approve | `duplicateApproveIsRejectedWithoutSideEffects` | second call `409 INVALID_STATE_TRANSITION`; internship count unchanged | PASS |
| C5 | Duplicate bulk | `duplicateBulkWithSameKeyDoesNotDuplicate` | same `X-Idempotency-Key` replay returns identical ids, no new rows | PASS |
| C6 | Invalid transitions | `invalidTransitionsReturnDocumentedErrors` | double submit `409`; approve DRAFT `409`; generic `VALIDATED` `422 INTERNSHIP_STATUS_RESERVED`; early certificate `409 INTERNSHIP_NOT_VALIDATED` | PASS |
| C7 | Denial without reason | `denialWithoutReasonIsRejected` | workflow reject blank `409 INVALID_STATE_TRANSITION`; validation reject blank `422 DECISION_COMMENT_REQUIRED`; reasoned denial applies | PASS |
| C8 | Scanned PDF | `scannedPdfReturnsInconclusive` | verify `INCONCLUSIVE` (never false `FAILED`); status unchanged; manual decisions complete to `VALIDATED` | PASS |
| C9 | Degraded banners (manual) | Trigger each outage in the UI (`:4200`): stop python-ai / blank key / failing mail | "AI unavailable / email not sent — retry" states, core flows still complete | NOT YET EXECUTED |

## Real stack run (2026-10-04, re-run after scope fixes)

`scripts/smoke-test.sh` steps 7–9 rewritten to the explicit statuses (atomic
`POST …/approve`, `APPROVED → IN_PROGRESS` via `status-transitions`,
supervisor-link verification; legacy `/internships/manual` + `→ ACTIVE`
assignment flow deleted). Step 11 rewritten to the correct scope behavior
(refused-then-reassign-then-validate); step 12 asserts the Admin-only +
VALIDATED guards; step 13 asserts the `INTERNSHIP_NOT_PAYABLE` gate; all
`.id` extractions use `// empty` (no vacuous `null`-string passes).
Full stack (postgres 17 + backend `integration` profile + python-ai; seed
vars now forwarded by the root compose itself, overlay deleted).

Result: **24 passed, 0 failed** (`./scripts/smoke-test.sh`, live run
against current code on a scratch database).

| Step | Probe | Result |
|---|---|---|
| 1 health, 2 register, 3 login+profile, 4 create+submit, 5 admin login | — | PASS |
| 6 review → UNDER_REVIEW | live application workflow | PASS |
| 7 atomic approve → APPROVED + internship + supervisor set | updated S12a | PASS |
| 8 APPROVED → IN_PROGRESS | updated S12a | PASS |
| 9 supervisor link non-empty | updated S12a | PASS |
| 10 journal create+submit | live journal channel | PASS |
| 11a unassigned supervisor refused → 403 | scope enforcement, no leak | PASS |
| 11b assigned supervisor validates → VALIDATED | after admin reassignment | PASS |
| 12a supervisor refused on certificate route → 403 | Admin-only | PASS |
| 12b admin gated until VALIDATED → INTERNSHIP_NOT_VALIDATED | documented gate | PASS |
| 13 finance refused for non-obligatory → INTERNSHIP_NOT_PAYABLE | documented gate | PASS |
| 14–15 accepted gaps, 16 AI health | — | PASS |

Live-run bug found and fixed: an assigned supervisor **without an
Employee row** validating a journal/deliverable blew up with a 500
(`Map.of` rejects the null `validatedBy` in the review audit payload).
Fixed with a null-safe `reviewAudit` helper (all four review paths);
regression tests `ReviewAuditNullSupervisorTest` (bite-proven: 500 without
the fix, 200 with it). Flutter live STOMP roundtrip
(`test/live/stomp_roundtrip_test.dart`, now configurable via
`LIVE_EMAIL`/`LIVE_PASSWORD` dart-defines) also passes against the same
stack: handshake + STOMP echo + REST echo + 403/error-frame guards.

## Manual UI checklist (operator)

- [ ] A18 back-office replay of Scenario A
- [ ] A19 mobile replay of Scenario A
- [ ] B8 supervisor-scoped UI replay
- [ ] B9 reassignment UI replay
- [ ] C9 degraded-banner UI replay

## S12b — AGENTS.md §14 final checklist with evidence (2026-10-04)

- [x] `docs/back-office-audit.md` has every requirement marked `OK`
      (zero `PARTIAL|MISSING|BROKEN` rows — verified by grep), assumptions
      #1–#32 recorded.
- [x] Backend tests + ArchUnit green (**931**/0 `clean test`:
      CleanArchitecture + AiIsolation + MethodSecurity); Angular build/tests
      green (**441**/62 files, typecheck + prod build); python-ai green
      (**28**); Flutter green (**135** +1 skipped, analyze clean, debug APK
      built, live STOMP roundtrip passes); Next `tsc` + 73-page build green.
- [x] Scenarios A, B, C executed via automated E2E and pass (S12a:
      `acceptance/ScenarioA*`, `ScenarioB*`, `ScenarioCFailureModesTest*);
      manual UI replays (above) remain for the operator.
- [x] Admin holds a single account/role yet can do everything a Supervisor
      can (`SupervisionScopeServiceTest` + `SupervisionPersistenceIntegrationTest`
      `adminActsAsSupervisorThroughHisOwnAssignment`); "my candidates" logic
      exists in exactly one place (`SupervisionScopeService` — no second copy
      since #18).
- [x] Supervisors cannot reach anything outside their own candidates, UI and
      API (row-level 404s per module + hand-reviewed tables in
      `AdminOnlyEndpointSecurityTest`: 70 admin-only → 403 Supervisor / 401
      anonymous, 117 supervisor-allowed, 13 public, plus the classification
      tripwire that fails on any unlisted endpoint; Angular guards + hidden
      nav, `auth.spec` guard/nav tests).
- [x] Gemini key and all secrets only in `.env` (example files: backend
      exemplary, root fixed to placeholders in S12b); none in client bundles
      (`dist/` greps: `signInDemo`/`demo@`/`Demo#2026`/key patterns → 0) or
      logs (`logsNeverCarrySecretsOrPii` + `AuditRedactionTest` +
      `AuditAndSecretsLeakageTest`).
- [x] No mocks, TODOs, dead code, console logs, or unused dependencies
      (S12b #33 removal + full grep re-proof in `legacy-removal.md`;
      hygiene sweeps: only documented items — realtime `console.warn`s,
      test-scope `System.out`, crash-reporter `debugPrint`s, `TODO — STEG
      VALIDATION REQUIRED` business caveats; no `@Disabled`; no new
      dependencies added in S12b).

Known product gaps (documented, not gate failures): none open — the
certificate-issued gap (audit #31) is closed by the #33 definition; the
smoke step-11 expectation is fixed to the scope-correct flow.
