# STEG Back Office — Security Review (S12b)

> Source: controller sources parsed 2026-10-04 (`/tmp/parse_ep.py`: class
> `@RequestMapping` + method mappings + trailing/leading `@PreAuthorize`,
> `@PublicEndpoint`, `@RateLimited`). 196 product mappings + 4 springdoc
> mappings, every one annotated —
> enforced at build time by ArchUnit
> `MethodSecurityFitnessTest.controllerEndpointsMustBeSecuredOrDefaultDenied`.
> Behavioral proof: `security/AdminOnlyEndpointSecurityTest` (140 probes:
> all 70 admin-only endpoints → 403 Supervisor / 401 anonymous, plus the
> classification tripwire) and
> `security/SecurityHardeningTest` (8).

## 1. Findings (fixed in this slice)

| # | Finding | Fix | Proof |
|---|---|---|---|
| F1 | Log lines carried emails (PII): `AuthService` register/login/back-office-login/refresh/lockout, `InternAccountManagementService` reset warn, `AnonymousApplicationService` user reuse, `StegUserDetailsService` not-found | All redacted to `userId=` (audit rows keep the address — Admin-only store) | `SecurityHardeningTest.logsNeverCarrySecretsOrPii` scans a full credential-bearing flow (register → profile+CIN → submit → approve → temp-password login): no temp password, access/refresh token, CIN or email in any log record |
| F2 | `FinanceService.createLinkedDocument` minted `DOC-*` references count-then-write with no exists-retry (same race class as certificate #25) | Exists-retry loop added (UNIQUE backstop unchanged) | Code review + full suite green; residual cross-row concurrency fails safe on the unique constraint, never duplicates |
| F3 | Root `.env.example` shipped filled secrets (`STEG_JWT_SECRET`, `PYTHON_AI_SERVICE_TOKEN`, weak `postgres/postgres`) | Placeholders only (fail-fast compose `?` guards preserved) | File content; backend `.env.example` already exemplary (all secrets empty) |
| F4 | Angular user-facing + comment wording referenced removed `ACCEPTED` status and `ADMIN/HR` roles | `APPROVED` wording (fr/en/ar), `ADMIN only`, VALIDATED-gate comments | `internship-create.component.spec` updated; suite green |
| F5 | S12b #33: internship workflow-history client path called the S6b-deleted endpoint (always 404 → swallowed) with eternally-empty decision/history/timeline UI | Removed `getInternshipWorkflow`, bundle workflow branch, `ValidationState`/`deriveValidationState`, timeline tab, orphan keys | `legacy-removal.md` #33 with zero-reference greps; Angular 441 green |

### 1b. Production hardening slice (2026-10-05)

| # | Finding | Fix | Proof |
|---|---|---|---|
| F6 | **RACE: the QA-seed guard ran too late.** A prod-only `ApplicationRunner` disabled the three V27 accounts (passwords published in this repository) only AFTER Tomcat was already accepting requests — a live window where the published passwords worked | `ProdQaSeedAccountCallback`: Flyway `AFTER_MIGRATE` callback, prod profile only, fail-closed (aborts the boot on error), audited as SYSTEM `PROD_QA_SEED_ACCOUNT_DISABLED`; the V27 ids now live in one place (`QaSeedAccounts`) | `ApiExposureProfileTest.v27QaAccountsAreDisabledInProduction` (real prod context) + live prod boot: 3 disables logged 4 s before `Tomcat started`, all three public passwords refused from the first request |
| F7 | **Sessions survived account lifecycle events.** Deactivate/delete revoked nothing and an already-issued access token kept working until its 15-minute expiry; `AuthService.refresh` only knew about `revoked_at` | Deactivate/delete/password-reset revoke every refresh token (`revokeAllForUser`); the JWT filter re-reads the account state on every request (401 when it is gone/disabled); V53 `credentials_updated_at` versions the credential so a reset kills the old access token immediately; refresh and the WS handshake check the same state | `SessionRevocationIntegrationTest` (3, Testcontainers + real HTTP): deactivation, deletion, password reset — each from a fully usable session (forced rotation completed first, else the filter answers 403 `PASSWORD_CHANGE_REQUIRED` and the 401 is unobservable) |
| F8 | **No production path to the first Admin**: the documented one required booting the demo seeder in a non-prod profile, which seeds extra demo data into a real database | `FirstRunAdminBootstrap`: `STEG_BOOTSTRAP_ADMIN_EMAIL`+`_PASSWORD`, one Admin with `mustChangePassword=true`, no demo data, never logs the password, refuses weak/half-configured values, strict no-op afterwards; `deployment.md` §6 rewritten (the demo seeder is no longer mentioned for production) | `FirstRunAdminBootstrapTest` (4) on its own container; live prod boot created exactly one Admin from the environment and the suite logged in as it |
| F9 | **Uploads unscanned in production by default**: the ClamAV adapter existed but nothing ran a daemon, and the six `MALWARE_*`/`CLAMAV_*` variables were documented only as a sentence | `clamav` compose service (`clamav/clamav:stable`, named volume, unpublished port — the pinned `1.4` tag has no arm64 manifest), variables forwarded to the backend, `MALWARE_MODE`/`MALWARE_ON_ERROR` semantics in `deployment.md` §2 + `steg-backend/.env.example` | Live prod run with `MALWARE_MODE=clamav`: clean upload 201; clamd stopped → 422 `MALWARE_SCAN_FAILED` (fail-closed); `ClamAvContainerIntegrationTest` + `ClamAvMalwareScannerTest` pin EICAR detection at daemon and adapter level |

No passwords, tokens, CINs or keys were found in any log statement
(`log.*(password|token|nationalId|api-key)` sweep: only an 8-char hash
prefix, exception messages, and token-shape validation notes). No
`@Disabled` tests. Pre-existing documented items kept: `console.warn` ×3 in
`realtime.service.ts` (STOMP error reporting), `System.out` in the opt-in
`GeminiLiveVerificationIT` + A11 QA artifact paths (test scope only),
Flutter crash-reporter `debugPrint`s, `TODO — STEG VALIDATION REQUIRED`
business caveats (Intentional, recorded per slice).

## 2. Input limits & upload policy (from code, pinned by tests)

- Bean Validation on every mutating DTO (`@NotNull/@NotBlank/@Email/@Size`);
  unknown sort keys fall back, page sizes clamp (workspace `sanitize`).
- Uploads: 25 MB servlet cap + 25 MB app cap (`uploadSizeCapsAreConfigured`
  asserts both from the Environment); PDF magic bytes + Tika inspection +
  spoof detection + malware scan (`uploadsAreValidatedAndDownloadsAreAuthorized`:
  spoofed `.pdf` → 4xx, empty → 422 `EMPTY_FILE`, real PDF → 201).
- Malware scanning in production: `MALWARE_MODE=clamav` + a reachable clamd.
  **Fail-closed** (`MALWARE_ON_ERROR=reject`, the default): an unreachable or
  timing-out daemon answers 422 `MALWARE_SCAN_FAILED` and the file is NOT
  stored — verified live, not only in tests. EICAR handling: the signature is
  anchored, so detection is only meaningful for a file that matches it (a
  `.txt`/PDF-prefixed EICAR never reaches the scanner — it dies on the
  file-type/magic-byte gate first, or, when prefixed with PDF magic, is not
  flagged even by `clamdscan`). Adapter-level proof uses the exact EICAR
  string; `MALWARE_MAX_SCAN_BYTES` refuses oversized files before scanning.
- Downloads are owner-or-staff: owner 200, anonymous 401, unrelated
  candidate 403 (same test).
- Rate limits (`@RateLimited`, sliding window `<endpoint>|<principal>`,
  429 + `Retry-After`): ai-analyze 20/60, ai-finance-analyze 20/60,
  ai-logbook-generate 10/60, ai-assistant 20/60, ai-review 20/60,
  ai-chatbot 20/60, identifier-validation 10/60, ai-task-generate 10/60,
  ai-task-revise 20/60, document-upload 10/60, public-doc-validation 20/60 —
  plus login lockout (5 attempts → 30 min, `AuthIntegrationTest`) and
  chatbot `@RateLimited(ai-chatbot, 20/60)`. Proven: `rateLimitIsEnforced`
  (11th call → 429, windows cleared in `finally` so no suite pollution).
- CORS: `steg.cors.allowed-origins` default exactly
  `http://localhost:3000,http://localhost:4200` (`corsAllowsOnlyTheTwoFrontEnds`:
  preflight grants both, evil origin gets no `Access-Control-Allow-Origin`;
  credentials allowed, `X-Trace-Id` exposed). **PRODUCTION (2026-10-04):
  env-only, no default** — `application-prod.yml` takes
  `${CORS_ALLOWED_ORIGINS}` with no fallback (pinned by
  `ProductionProfileHygieneTest`).
- Headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
  (`securityHeadersArePresent`); HSTS (1y, subdomains) is https-only by
  Spring default; CSRF disabled with justification (stateless JWT);
  actuator internals ADMIN-only or unexposed.
- **Profile-dependent exposure (2026-10-04):** dev/test expose the OpenAPI
  contract + health/info/metrics/prometheus (metrics ADMIN-only); PROD
  disables springdoc entirely and keeps ONLY `health` on the actuator
  (info/metrics/prometheus 404 even for an ADMIN — exposure wins over
  authorization; health hides component details). Proven per profile by
  `security/ApiExposureProfileTest` (6, real `application-prod.yml` boot):
  api-docs 200/dev vs 404/prod, health 200 both, info 200/dev vs 404/prod,
  metrics/prometheus ADMIN-200/dev vs 404/prod.
- **QA seed accounts (V27) carry public passwords** (`Admin#2026` et al.) —
  unfixable in the applied migration, so
  `iam/infrastructure/security/ProdQaSeedAccountCallback` (a Flyway
  `AFTER_MIGRATE` callback, prod profile only — see F6) disables the three
  fixed-seed users at every prod boot (audited
  `PROD_QA_SEED_ACCOUNT_DISABLED`), and `AuthService` refuses ANY
  disabled/INACTIVE account at login (it previously checked only `LOCKED`)
  with the generic invalid-credentials message, audited
  `LOGIN_REFUSED_DISABLED_ACCOUNT`. Pinned by the prod-context test in
  `ApiExposureProfileTest` and `ProductionProfileHygieneTest`.
- JWT: short-lived access (15 min) + rotating refresh (7 d);
  `logoutRevokesTheRefreshToken` (logout → 204, reuse → 4xx);
  `mustChangePassword` enforced with 403 `PASSWORD_CHANGE_REQUIRED`
  (S12a chain); lockout after 5 failures (`AuthIntegrationTest`).
- Demo seeder OFF by default: `demoSeederIsOffByDefault` (no bean in the
  default profile, `integration` profile inactive,
  `steg.seed.demo-enabled` false; fail-fast when enabled without password).

## 3. Migration list V34 → V53 (Flyway, latest marker asserted by
`StegBackendApplicationTests.flywayMigrationSucceeds` + new
`migration/MigrationChainIntegrationTest`: empty DB → V53 clean (53
migrations; reference sequences stay at 1 on an empty DB);
V33 + legacy rows → latest with HR→ADMIN, ACCEPTED→APPROVED,
NEEDS_CORRECTION→MODIFICATION_REQUESTED, PLANNED→APPROVED,
ACTIVE→IN_PROGRESS, supervisor backfilled, zero legacy rows left;
V33 + count-based FC-/PAY-/DOC- rows → sequences above every existing
numeric suffix, minted references collide with nothing — proven both raw
and through the real receipt/document services)

| Migration | Purpose |
|---|---|
| V34 `remove_obsolete_roles` | Drop HR/FINANCE/DIRECTOR; holders reassigned to ADMIN (never orphaned) |
| V35 `user_supervision_scope` | `supervisor_user_id` on internships + assignments (one IAM identity); backfill from employee link |
| V36 `allow_user_backed_assignments` | Assignments may point directly at Admin/Supervisor users; legacy employee refs nullable |
| V37 `user_must_change_password` | `must_change_password` flag for forced rotation |
| V38 `task_review_state` | Task review state (approve/deny + reason) |
| V39 `explicit_application_internship_statuses` | First status migration (ACCEPTED→APPROVED, NEEDS_CORRECTION→MODIFICATION_REQUESTED, linked PLANNED→APPROVED) |
| V40 `assign_default_admin_to_unsupervised_internships` | Oldest ADMIN backfilled as supervisor + ACTIVE assignment (never unsupervised) |
| V41 `candidate_soft_delete` | `deleted_at` + live-rows partial index |
| V42 `candidate_live_identity_uniqueness` | CIN uniqueness on live rows only; soft delete releases account + CIN |
| V43 `drop_legacy_status_values` | Final legacy mapping (ACTIVE→IN_PROGRESS, COMPLETED→VALIDATED…), `internships.status` default → APPROVED |
| V44 `candidate_managed_by_user` | `managed_by_user_id` (S6a staff-created profiles) |
| V45 `validation_runs_and_decisions` | AI verification runs + manual per-document decisions |
| V46 `certificate_version_history` | Version rows + `certificate_reference_seq` (race fix #25) |
| V47 `audit_source` | `audit_logs.source` channel column |
| V48 `ai_task_drafts` | Server-side AI draft rows |
| V49 `ai_chatbot_history` | Bounded per-user chatbot history |
| V50 `certificate_issued_means_generated` | Collapse dead `ISSUED` state: any stray `ISSUED` row → `GENERATED` (audit #33) |
| V51 `sequence_backed_references` | `finance_case/payment_receipt/document_reference_seq`: atomic FC-/PAY-/DOC- numbering (race fix) |
| V52 `backfill_reference_sequences` | Sequences moved above the highest existing numeric suffix (upgraded DBs never re-mint count-based FC-/PAY-/DOC-/CERT- rows; empty DBs keep 1) |
| V53 `user_credentials_updated_at` | Per-user credential version: an access token issued before a password reset is refused immediately instead of living out its 15-minute TTL (F7) |

## 4. Endpoint table (200 mappings — Authorization | Rate limit)

ADMIN-ONLY endpoints (70) are all covered by
`AdminOnlyEndpointSecurityTest` (403 Supervisor, 401 anonymous). The three
tables in that test are HAND-WRITTEN against AGENTS.md §3.3 (70 admin-only,
117 supervisor-allowed, 13 public incl. OpenAPI docs) — not derived from the
annotations — and the `everyControllerEndpointIsClassified` tripwire
enumerates the live `RequestMappingHandlerMapping` and FAILS on any
endpoint missing from all three tables (it caught a real omission the
first time it ran: `POST .../messages/with-attachment`).
`@PublicEndpoint` methods: 4 auth paths + universities + identifier
validation + anonymous intake ×2 + public document validation (pinned by
`PublicEndpointConsistencyTest`, incl. `everyPublicEndpointAnswersAnonymously`).
Row-level 404 scoping (layer 2) is proven per module (see audit §1/§3/§5);
`hasAuthority('DOCUMENT_VIEW_RESTRICTED')` gates restricted downloads.

### AiController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| POST | `/api/ai/applications/{id}/analyze` | hasRole('ADMIN') | "ai-analyze", limit = 20, windowSeconds = 60 |
| POST | `/api/ai/finance-cases/{id}/analyze` | hasRole('ADMIN') | "ai-finance-analyze", limit = 20, windowSeconds = 60 |
| POST | `/api/ai/internships/{id}/logbook/generate` | hasRole('ADMIN') or @authz.isParticipantOf(#id) | "ai-logbook-generate", limit = 10, windowSeconds = 60 |
| POST | `/api/ai/assistant/query` | hasAnyRole('CANDIDATE', 'INTERN', 'SUPERVISOR', 'ADMIN') | "ai-assistant", limit = 20, windowSeconds = 60 |
| POST | `/api/ai/recommendations/{id}/review` | hasAnyRole('ADMIN', 'SUPERVISOR') | "ai-review", limit = 20, windowSeconds = 60 |
### ChatbotController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| POST | `/api/ai/chatbot/query` | hasAnyRole('ADMIN', 'SUPERVISOR') | "ai-chatbot", limit = 20, windowSeconds = 60 |
| GET | `/api/ai/chatbot/history` | hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| DELETE | `/api/ai/chatbot/history` | hasAnyRole('ADMIN', 'SUPERVISOR') | — |
### ApplicationController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| POST | `/api/applications` | @authz.hasRole('CANDIDATE') | — |
| GET | `/api/applications` | @authz.hasAnyRole('CANDIDATE', 'ADMIN') | — |
| GET | `/api/applications/manage` | @authz.hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| GET | `/api/applications/{id}` | @authz.hasAnyRole('CANDIDATE', 'ADMIN') | — |
| PUT | `/api/applications/{id}` | @authz.hasRole('CANDIDATE') | — |
| POST | `/api/applications/{id}/submit` | @authz.hasRole('CANDIDATE') | — |
| POST | `/api/applications/{id}/withdraw` | @authz.hasRole('CANDIDATE') | — |
| POST | `/api/applications/{id}/resubmit` | @authz.hasRole('CANDIDATE') | — |
### anonymous/AnonymousApplicationController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| POST | `/api/public/applications` | PUBLIC | — |
| POST | `/api/public/applications/track` | PUBLIC | — |
### AuditController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| GET | `/api/audit` | hasRole('ADMIN') | — |
| GET | `/api/audit/{id}` | hasRole('ADMIN') | — |
### CandidateController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| POST | `/api/candidates` | @authz.hasRole('CANDIDATE') | — |
| GET | `/api/candidates/me` | @authz.hasRole('CANDIDATE') | — |
| PUT | `/api/candidates/me` | @authz.hasRole('CANDIDATE') | — |
| GET | `/api/candidates` | @authz.hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| GET | `/api/candidates/manage` | @authz.hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| POST | `/api/candidates/manage` | @authz.hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| GET | `/api/candidates/{id}` | @authz.hasAnyRole('CANDIDATE', 'ADMIN', 'SUPERVISOR') | — |
| GET | `/api/candidates/{id}/overview` | @authz.hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| DELETE | `/api/candidates/{id}` | @authz.hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| PUT | `/api/candidates/{id}` | @authz.hasAnyRole('CANDIDATE', 'ADMIN', 'SUPERVISOR') | — |
| GET | `/api/universities` | PUBLIC | — |
### IdentifierValidationController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| POST | `/api/public/applications/validate-identifiers` | PUBLIC | "identifier-validation", limit = 10, windowSeconds = 60 |
### CertificateController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| POST | `/api/internships/{id}/certificates` | hasRole('ADMIN') | — |
| GET | `/api/certificates/{id}` | isAuthenticated() | — |
| GET | `/api/certificates` | @authz.hasRole('ADMIN') | — |
| GET | `/api/certificates/{id}/detail` | @authz.hasRole('ADMIN') | — |
| PUT | `/api/certificates/{id}` | @authz.hasRole('ADMIN') | — |
| DELETE | `/api/certificates/{id}` | @authz.hasRole('ADMIN') | — |
| GET | `/api/certificates/{id}/versions/{version}/download` | isAuthenticated() | — |
### CommentController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| POST | `/api/journal/entries/{entryId}/comments` | hasRole('ADMIN') or @authz.isParticipantOf(#entryId) | — |
| GET | `/api/journal/entries/{entryId}/comments` | hasRole('ADMIN') or @authz.isParticipantOf(#entryId) | — |
| POST | `/api/deliverables/{deliverableId}/comments` | hasRole('ADMIN') or @authz.isParticipantOf(#deliverableId) | — |
| GET | `/api/deliverables/{deliverableId}/comments` | hasRole('ADMIN') or @authz.isParticipantOf(#deliverableId) | — |
| POST | `/api/evaluations/{evaluationId}/comments` | hasRole('ADMIN') or @authz.isParticipantOf(#evaluationId) | — |
| GET | `/api/evaluations/{evaluationId}/comments` | hasRole('ADMIN') or @authz.isParticipantOf(#evaluationId) | — |
### CompanionController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| POST | `/api/internships/{id}/tasks` | hasAnyRole('ADMIN', 'SUPERVISOR', 'INTERN', 'CANDIDATE') | — |
| GET | `/api/internships/{id}/tasks` | hasAnyRole('ADMIN', 'SUPERVISOR', 'INTERN', 'CANDIDATE') | — |
| GET | `/api/internships/tasks` | hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| GET | `/api/internships/tasks/{taskId}` | hasAnyRole('ADMIN', 'SUPERVISOR', 'INTERN', 'CANDIDATE') | — |
| PUT | `/api/internships/tasks/{taskId}` | hasAnyRole('ADMIN', 'SUPERVISOR', 'INTERN', 'CANDIDATE') | — |
| PATCH | `/api/internships/tasks/{taskId}/status` | hasAnyRole('ADMIN', 'SUPERVISOR', 'INTERN', 'CANDIDATE') | — |
| POST | `/api/internships/tasks/{taskId}/review` | hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| POST | `/api/internships/tasks/bulk` | hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| DELETE | `/api/internships/tasks/{taskId}` | hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| GET | `/api/internships/{id}/journal/entries` | hasRole('ADMIN') or @authz.isParticipantOf(#id) | — |
| POST | `/api/internships/{id}/journal/entries` | hasRole('ADMIN') or @authz.isInternOf(#id) | — |
| POST | `/api/internships/journal/entries/{entryId}/submit` | hasRole('ADMIN') or @authz.isInternOf(#entryId) | — |
| POST | `/api/internships/journal/entries/{entryId}/validate` | hasRole('ADMIN') or @authz.isSupervisorOf(#entryId) | — |
| POST | `/api/internships/journal/entries/{entryId}/reject` | hasRole('ADMIN') or @authz.isSupervisorOf(#entryId) | — |
| GET | `/api/internships/{id}/deliverables` | hasRole('ADMIN') or @authz.isParticipantOf(#id) | — |
| GET | `/api/internships/deliverables/{deliverableId}` | hasRole('ADMIN') or @authz.isParticipantOf(#deliverableId) | — |
| POST | `/api/internships/{id}/deliverables` | hasRole('ADMIN') or @authz.isInternOf(#id) | — |
| POST | `/api/internships/deliverables/{deliverableId}/versions` | hasRole('ADMIN') or @authz.isInternOf(#deliverableId) | — |
| GET | `/api/internships/deliverables/{deliverableId}/versions` | hasRole('ADMIN') or @authz.isParticipantOf(#deliverableId) | — |
| POST | `/api/internships/deliverables/{deliverableId}/submit` | hasRole('ADMIN') or @authz.isInternOf(#deliverableId) | — |
| POST | `/api/internships/deliverables/{deliverableId}/validate` | hasRole('ADMIN') or @authz.isSupervisorOf(#deliverableId) | — |
| POST | `/api/internships/deliverables/{deliverableId}/reject` | hasRole('ADMIN') or @authz.isSupervisorOf(#deliverableId) | — |
| GET | `/api/internships/deliverables/{deliverableId}/download` | hasRole('ADMIN') or @authz.isParticipantOf(#deliverableId) | — |
### LogbookController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| POST | `/api/internships/{internshipId}/logbook/submit` | @authz.isParticipantOf(#internshipId) | — |
| POST | `/api/internships/{internshipId}/logbook/{logbookId}/validate` | hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| POST | `/api/internships/{internshipId}/logbook/{logbookId}/reject` | hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| POST | `/api/internships/{internshipId}/logbook/{logbookId}/official` | hasRole('ADMIN') | — |
| GET | `/api/internships/{internshipId}/logbook` | hasAnyRole('ADMIN', 'SUPERVISOR') or @authz.isParticipantOf(#internshipId) | — |
### TaskDraftController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| POST | `/api/internships/tasks/drafts/generate` | hasAnyRole('ADMIN', 'SUPERVISOR') | "ai-task-generate", limit = 10, windowSeconds = 60 |
| GET | `/api/internships/tasks/drafts` | hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| POST | `/api/internships/tasks/drafts` | hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| PUT | `/api/internships/tasks/drafts/{id}` | hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| POST | `/api/internships/tasks/drafts/{id}/revise` | hasAnyRole('ADMIN', 'SUPERVISOR') | "ai-task-revise", limit = 20, windowSeconds = 60 |
| DELETE | `/api/internships/tasks/drafts/{id}` | hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| POST | `/api/internships/tasks/drafts/bulk-add` | hasAnyRole('ADMIN', 'SUPERVISOR') | — |
### DocumentController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| POST | `/api/documents` | isAuthenticated() | "document-upload", limit = 10, windowSeconds = 60 |
| GET | `/api/documents/{id}` | isAuthenticated() | — |
| GET | `/api/documents/{id}/download` | isAuthenticated() | — |
| GET | `/api/documents/{id}/download-restricted` | hasAuthority('DOCUMENT_VIEW_RESTRICTED') or hasRole('ADMIN') | — |
| GET | `/api/applications/{id}/documents` | hasAnyRole('ADMIN', 'CANDIDATE') | — |
| POST | `/api/applications/{id}/documents` | hasAnyRole('ADMIN', 'CANDIDATE') | — |
| PUT | `/api/applications/{id}/documents/{documentId}/verify` | hasRole('ADMIN') | — |
| GET | `/api/internships/{id}/documents` | hasAnyRole('ADMIN', 'CANDIDATE', 'SUPERVISOR') | — |
| POST | `/api/internships/{id}/documents` | hasRole('ADMIN') | — |
| POST | `/api/documents/{id}/validation` | isAuthenticated() | — |
### PublicDocumentValidationController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| POST | `/api/public/documents/validation` | PUBLIC | "public-doc-validation", limit = 20, windowSeconds = 60 |
### EvaluationController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| POST | `/api/internships/{internshipId}/evaluations` | hasRole('ADMIN') or @authz.isSupervisorOf(#internshipId) | — |
| GET | `/api/internships/{internshipId}/evaluations` | hasRole('ADMIN') or @authz.isParticipantOf(#internshipId) | — |
| GET | `/api/evaluations/{evaluationId}` | hasRole('ADMIN') or @authz.isParticipantOf(#evaluationId) | — |
| POST | `/api/evaluations/{evaluationId}/scores` | hasRole('ADMIN') or @authz.isSupervisorOf(#evaluationId) | — |
| GET | `/api/evaluations/{evaluationId}/scores` | hasRole('ADMIN') or @authz.isParticipantOf(#evaluationId) | — |
| POST | `/api/evaluations/{evaluationId}/task-reviews` | hasRole('ADMIN') or @authz.isSupervisorOf(#evaluationId) | — |
| GET | `/api/evaluations/{evaluationId}/task-reviews` | hasRole('ADMIN') or @authz.isParticipantOf(#evaluationId) | — |
### EvaluationTemplateController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| GET | `/api/evaluation-templates` | hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| GET | `/api/evaluation-templates/{templateId}` | hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| POST | `/api/evaluation-templates` | hasRole('ADMIN') | — |
| PUT | `/api/evaluation-templates/{templateId}` | hasRole('ADMIN') | — |
| DELETE | `/api/evaluation-templates/{templateId}` | hasRole('ADMIN') | — |
| GET | `/api/evaluation-templates/{templateId}/criteria` | hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| POST | `/api/evaluation-templates/{templateId}/criteria` | hasRole('ADMIN') | — |
| PUT | `/api/evaluation-templates/criteria/{criterionId}` | hasRole('ADMIN') | — |
### FinanceController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| POST | `/api/finance-cases` | hasRole('ADMIN') | — |
| GET | `/api/finance-cases` | hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| GET | `/api/finance-cases/{id}` | hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| POST | `/api/finance-cases/{id}/documents` | hasRole('ADMIN') | — |
| PATCH | `/api/finance-cases/{id}/documents/{documentId}` | hasRole('ADMIN') | — |
| POST | `/api/finance-cases/{id}/recalculate` | hasRole('ADMIN') | — |
| POST | `/api/finance-cases/{id}/approve` | hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| POST | `/api/finance-cases/{id}/reject` | hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| GET | `/api/finance-cases/{id}/receipt` | isAuthenticated() | — |
### AuthController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| POST | `/api/auth/register` | PUBLIC | — |
| POST | `/api/auth/login` | PUBLIC | — |
| POST | `/api/auth/back-office-login` | PUBLIC | — |
| POST | `/api/auth/refresh` | PUBLIC | — |
| POST | `/api/auth/logout` | isAuthenticated() | — |
| POST | `/api/auth/logout-all` | isAuthenticated() | — |
| POST | `/api/auth/change-password` | isAuthenticated() | — |
### InternAccountController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| GET | `/api/intern-accounts` | hasRole('ADMIN') | — |
| GET | `/api/intern-accounts/manage` | hasRole('ADMIN') | — |
| GET | `/api/intern-accounts/{id}` | hasRole('ADMIN') | — |
| POST | `/api/intern-accounts` | hasRole('ADMIN') | — |
| PUT | `/api/intern-accounts/{id}` | hasRole('ADMIN') | — |
| DELETE | `/api/intern-accounts/{id}` | hasRole('ADMIN') | — |
| POST | `/api/intern-accounts/{id}/reset-password` | hasRole('ADMIN') | — |
| PATCH | `/api/intern-accounts/{id}/status` | hasRole('ADMIN') | — |
### UserPreferencesController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| PUT | `/api/users/me/locale` | isAuthenticated() | — |
### InternshipController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| GET | `/api/internships` | @authz.hasAnyRole('ADMIN', 'SUPERVISOR') | — |
| GET | `/api/internships/{id}` | isAuthenticated() | — |
| POST | `/api/internships/from-application` | @authz.hasRole('ADMIN') | — |
| POST | `/api/internships/manual` | @authz.hasRole('ADMIN') | — |
| POST | `/api/internships/{id}/status-transitions` | @authz.hasRole('ADMIN') | — |
| PUT | `/api/internships/{id}/dates` | @authz.hasRole('ADMIN') | — |
| POST | `/api/internships/{id}/cancel` | @authz.hasRole('ADMIN') | — |
| POST | `/api/internships/{id}/assignments` | @authz.hasRole('ADMIN') | — |
| GET | `/api/internships/{id}/assignments` | @authz.hasRole('ADMIN') or @authz.isSupervisorOf(#id) | — |
| GET | `/api/internships/{id}/classification` | @authz.hasRole('ADMIN') or @authz.isSupervisorOf(#id) or @authz.isInternOf(#id) | — |
### InternshipValidationController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| GET | `/api/internship-validation/queue` | @authz.hasRole('ADMIN') | — |
| GET | `/api/internship-validation/{internshipId}` | @authz.hasRole('ADMIN') | — |
| POST | `/api/internship-validation/{internshipId}/verify` | @authz.hasRole('ADMIN') | — |
| POST | `/api/internship-validation/{internshipId}/decisions` | @authz.hasRole('ADMIN') | — |
| POST | `/api/internship-validation/{internshipId}/receipt` | @authz.hasRole('ADMIN') | — |
| GET | `/api/internship-validation/{internshipId}/documents/{documentType}/download` | @authz.hasRole('ADMIN') | — |
### SupervisorController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| GET | `/api/supervisors` | hasRole('ADMIN') | — |
| GET | `/api/supervisors/manage` | hasRole('ADMIN') | — |
| GET | `/api/supervisors/{id}` | hasRole('ADMIN') | — |
| POST | `/api/supervisors` | hasRole('ADMIN') | — |
| PUT | `/api/supervisors/{id}` | hasRole('ADMIN') | — |
| DELETE | `/api/supervisors/{id}` | hasRole('ADMIN') | — |
| POST | `/api/supervisors/{id}/assign-candidate` | hasRole('ADMIN') | — |
| PUT | `/api/supervisors/{id}/reassign/{internshipId}` | hasRole('ADMIN') | — |
### ConversationController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| GET | `/api/conversations` | isAuthenticated() | — |
| POST | `/api/conversations/group` | isAuthenticated() | — |
| GET | `/api/conversations/{conversationId}` | @authz.isOwnConversation(#conversationId) | — |
| POST | `/api/conversations/{conversationId}/members` | @authz.isOwnConversation(#conversationId) | — |
| POST | `/api/conversations/{conversationId}/leave` | @authz.isOwnConversation(#conversationId) | — |
| GET | `/api/conversations/{conversationId}/messages` | @authz.isOwnConversation(#conversationId) | — |
| POST | `/api/conversations/{conversationId}/messages` | @authz.isOwnConversation(#conversationId) | — |
| POST | `/api/conversations/{conversationId}/messages/with-attachment` | @authz.isOwnConversation(#conversationId) | — |
| PATCH | `/api/conversations/messages/{messageId}` | isAuthenticated() | — |
| DELETE | `/api/conversations/messages/{messageId}` | isAuthenticated() | — |
| POST | `/api/conversations/{conversationId}/delivered` | @authz.isOwnConversation(#conversationId) | — |
| POST | `/api/conversations/{conversationId}/read` | @authz.isOwnConversation(#conversationId) | — |
| GET | `/api/conversations/unread/counts` | isAuthenticated() | — |
| GET | `/api/conversations/messages/{messageId}/attachments` | isAuthenticated() | — |
| GET | `/api/conversations/attachments/{attachmentId}/download` | isAuthenticated() | — |
### steg-backend/src/main/java/tn/steg/backend/messaging/interfaces/ws/MessagingStompController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
### NotificationController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| GET | `/api/notifications` | isAuthenticated() | — |
| GET | `/api/notifications/unread-count` | isAuthenticated() | — |
| POST | `/api/notifications/{id}/read` | isAuthenticated() | — |
| POST | `/api/notifications/read-all` | isAuthenticated() | — |
### OrganizationController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| GET | `/api/departments` | @authz.hasRole('ADMIN') | — |
| GET | `/api/departments/{id}` | @authz.hasRole('ADMIN') | — |
| POST | `/api/departments` | @authz.hasRole('ADMIN') | — |
| PUT | `/api/departments/{id}` | @authz.hasRole('ADMIN') | — |
| DELETE | `/api/departments/{id}` | @authz.hasRole('ADMIN') | — |
| GET | `/api/employees` | @authz.hasRole('ADMIN') | — |
| GET | `/api/employees/{id}` | @authz.hasRole('ADMIN') | — |
| POST | `/api/employees` | @authz.hasRole('ADMIN') | — |
| PUT | `/api/employees/{id}` | @authz.hasRole('ADMIN') | — |
| DELETE | `/api/employees/{id}` | @authz.hasRole('ADMIN') | — |
### ReportController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| GET | `/api/reports/applications-by-status` | hasRole('ADMIN') | — |
| GET | `/api/reports/internships-by-type` | hasRole('ADMIN') | — |
| GET | `/api/reports/internships-by-status` | hasRole('ADMIN') | — |
| GET | `/api/reports/internships-by-department` | hasRole('ADMIN') | — |
| GET | `/api/reports/finance-cases-by-status` | hasRole('ADMIN') | — |
| GET | `/api/reports/payment-totals` | hasRole('ADMIN') | — |
| GET | `/api/reports/admin-summary` | hasRole('ADMIN') | — |
| GET | `/api/reports/supervisor-summary` | hasAnyRole('ADMIN', 'SUPERVISOR') | — |
### steg-backend/src/main/java/tn/steg/backend/workflow/interfaces/WorkflowController.java

| Method | Path | Authorization | Rate limit |
|---|---|---|---|
| POST | `/api/applications/{id}/approve` | hasRole('ADMIN') | — |
| GET | `/api/applications/{id}/workflow` | hasAnyRole('ADMIN', 'CANDIDATE') | — |
| POST | `/api/applications/{id}/workflow/actions` | hasRole('ADMIN') | — |
| GET | `/api/workflows/{instanceId}/actions` | hasRole('ADMIN') | — |

*TOTAL_MAPPINGS: 196*
