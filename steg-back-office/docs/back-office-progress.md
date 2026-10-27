# STEG Back Office — Progress Ledger

> **Read this file at the start of every slice, together with `todo/AGENTS.md`.**
> Context may be compressed during this long task; this file is how the rules and the plan survive.
> Last updated: 2026-10-05 (hardening slice 2: QA-seed accounts disabled during
> Flyway migration (before the server accepts a request), one-time first-run
> admin bootstrap for production, session revocation on deactivate/delete/
> password reset (V53 credential version), clamd in compose + docs, prod-profile
> live stack with smoke 24/24; backend 964, Angular 443, Flutter 137+1, Python 28,
> Next green, all gates green.)

## (a) Non-negotiable rules (copied verbatim)

- Audit row -> OK only when a passing automated test (or an executed scenario
  you describe) proves that exact requirement. Name the test class and method.
- **Persistence rule (2026-10-02):** an audit row whose behavior depends on
  persistence — queries, joins, unique indexes, flush order, transactions,
  scoping resolved in the database — may only flip to OK with a
  **Testcontainers integration test against a real Postgres**, never with a
  mocked unit test. Rows already OK that only have mocked unit tests must be
  downgraded and re-proven with an integration test. Mocked unit tests are
  fine as complements, never as the sole evidence for these rows.
- Never delete, skip or weaken tests, ArchUnit rules or architecture checks.
  A test of legacy behavior that you intentionally remove may only be deleted
  if you list it in docs/legacy-removal.md with the reason and the replacement.
- Schema changes only through NEW Flyway migrations (current last is V52).
  Never edit an applied migration.
- Application-layer classes depend on domain ports, never on infrastructure
  (CleanArchitecture, AiIsolation, MethodSecurity must stay green; every
  controller method needs method security or an explicit @PublicEndpoint).
- Backend is authoritative: business rules, scoping and transitions live in the
  backend. Angular only renders and calls the API.
- Report only finished-run results. "Running in the background" is not a
  result. If a command is still running, wait for it.
- Do NOT run git commit or push. Leave changes in the working tree.
- When AGENTS.md is silent, use the defaults in AGENTS.md section 13 and
  record the decision in the audit file. Do not stop to ask me.
- Do not add a UI library to Angular. Use shared/ui, signals, standalone
  components, strict TypeScript, the existing SCSS tokens, CSS-only charts.
- Secrets live only in .env (I rotate them myself). Never print, log or
  commit secrets. Keep .env.example current.

## (b) Ordered work plan (one slice at a time)

- [x] **S1a** Backend leftovers: full state-matrix tests for applications AND
      internships; sed-removed assertions verified present; credentials flow
      (response + no-store + no leak) verified by existing tests; controller
      route cleanliness checked. Legacy-behavior corrections logged.
- [x] **S1b** Legacy status removal (done 2026-10-02): mapping recorded FIRST in
      `docs/back-office-audit.md` assumption #15; `V43` migrates the rows (and
      resets the column default); the enums, every backend branch, the AI
      knowledge base and all three clients were swept; the internship
      VALIDATION decision got its own `ValidationDecision` enum. Zero-reference
      greps for all five values are recorded in `docs/legacy-removal.md` #15.
- [x] **S2** Approval flow: Angular approve action -> supervisor validation
      dialog (admin preselected, other supervisors + admin selectable) ->
      one-time credentials dialog (copy, email status, Resend). Modification
      request and denial dialogs with mandatory text. Application
      list/detail/filters per AGENTS.md 5.2. Legacy non-atomic approval path
      removed (`docs/legacy-removal.md` #6).
- [x] **S3** Supervisor Management workspace on `/api/supervisors` (AGENTS.md 5.6).
      Paged server-side list `GET /api/supervisors/manage` (search, status
      filter, sort whitelist, size clamp), create with one-time credentials
      dialog, edit (status/enabled), delete guarded by 409
      `SUPERVISOR_HAS_ACTIVE_ASSIGNMENTS`, assign an approved candidate,
      change supervisor with the Admin selectable. Admin-only route + nav
      (`/supervisors`, `USER_MANAGE`). Route table verified collision-free
      (`/manage` wins over `/{id}`).
- [x] **S4** Intern-accounts workspace on `/api/intern-accounts` (AGENTS.md 5.4):
      paged server-side list `GET /api/intern-accounts/manage` (role/status
      filters, email-or-full-name search, sort whitelist, size clamp), create
      with one-time credentials dialog (shared with S3), edit, reset password
      (shared dialog), activate/deactivate, delete with the 409 guard; Admin-only
      route `/intern-accounts` separate from `/supervisors`, nav item; the
      admin "pending accounts" panel now links to the new workspace; supervisor
      accounts stay ONE identity shared with §5.6.
- [x] **S5** Candidates workspace for Admin (all) and Supervisor (own):
      filters, pagination, detail aggregate (AGENTS.md 5.1 / 6.2). New
      `GET /api/candidates/manage` (`CandidateWorkspaceService.search`: one
      scoped JPQL query with mirrored countQuery + 3 batched enrichment
      queries, sort whitelist, size clamp), `GET /api/candidates/{id}/overview`
      (ONE authorized aggregate replacing the Angular fan-out) and
      `DELETE /api/candidates/{id}` (soft delete via `V41`, 409
      `CANDIDATE_HAS_DEPENDENCIES`); `SupervisionScopeService.supervisesCandidate`
      resolves the scope on the server for list/overview/delete and the legacy
      403-where-404 `AccessDeniedException` is gone. Angular list rebuilt as a
      server-paged workspace and the detail reads the aggregate in one call.
- [x] **S6** Tasks: student-grouped workspace for Admin (all) and Supervisor
      (own), approve/deny with mandatory reason, atomic bulk add/edit/delete
      with per-item results + idempotency (AGENTS.md 5.5 / 6.1). DONE 2026-10-02:
      backend `TaskBulkAtomicityIntegrationTest` (3) + Angular workspace
      (`task-list`, 22 new specs); the `/tasks` AI-assistant placeholder route
      is deleted (legacy-removal #21). The S6b legacy-engine removal inside this
      slice is logged under #19 (incl. the vacuous-ArchUnit-rule fix).
- [x] **S7** Internship Validation + python-ai adapter + receipt (AGENTS.md 5.11,
      7.1–7.3). DONE 2026-10-02: `InternshipValidationService` (Admin-only
      queue/detail, advisory verify with persisted `V45` runs, mandatory manual
      decisions, resubmission return UNDER_VALIDATION → REPORT_SUBMITTED),
      `DocIntelClient.verifyReport/verifyJournal` + resilient adapter,
      `FinanceService.generateValidationReceipt` (idempotent, financial-model
      amounts), submission hook (deliverable submit → REPORT_SUBMITTED + Admin
      fan-out); Angular `features/validation/` workspace (`/validation`,
      `VALIDATION_MANAGE`, 23 new specs); legacy decision path removed
      (legacy-removal #22). Assumptions #17 (certificate VALIDATED gate) + #18
      (document resolution, rejection path, shared done-function, receipt
      amounts).
- [x] **S8** Certificates workspace + PDF content and eligibility tests (5.7).
      DONE 2026-10-03: Admin-only `GET /api/certificates` (paged/search/status)
      + detail with `certificate_versions` history (V46) + PUT regenerate (new
      version, stable reference) + DELETE revoke (soft, audited) + versioned
      download; VALIDATED eligibility (assumption #17); sequence-backed
      references (legacy-removal #25); Angular `features/certificates/`
      (`/certificates`, `CERTIFICATE_MANAGE`, 22 new specs).
- [x] **S9** Notifications (STOMP live, per-recipient read state, reconnect) and
      Audit (append-only, front-office/mobile/system/AI ingestion, filters,
      redaction) (8.1, 8.2). DONE 2026-10-03: per-recipient reads, STOMP
      routing + drop policy, scope-correct recipients incl. reassignment
      (`NotificationCenterIntegrationTest`, `StompRealtimeNotifierTest`);
      `audit_logs.source` (V47) + redaction + combinable search
      (`AuditAppendOnlyFitnessTest`, `AuditRedactionTest`,
      `AuditSearchIntegrationTest`); Angular realtime-protocol specs + audit
      source/entity/date filters. Assumption #20 (channel boundary).
- [x] **S10a** Gemini AI task generation, BACKEND ONLY (AGENTS.md 7.4). DONE
      2026-10-04: specs-PDF upload (Admin any student, Supervisor own only else
      404 before any AI call), PDFBox text extraction (magic bytes, 25 MB cap),
      Gemini behind the `AiCompletionClient` port with a strict JSON schema
      (validated: schema/lengths/dates-in-period, one retry, then 422), V48
      server-side drafts (`ai_task_drafts`), draft lifecycle (list/add/edit/
      revise/delete, owner-only 404s), atomic role-scoped bulk-add to one or
      more students (idempotency key, per-item results, all-or-nothing,
      out-of-scope → 404), prompt-injection neutralisation, degraded 503
      `AI_UNAVAILABLE` (key/API/timeout/quota) with manual fallback, metadata-
      only audit. `AiTaskDraftIntegrationTest` (14, fake Gemini, real API never
      called). No chatbot code started; no Angular draft-review UI yet.
- [x] **S10b** Gemini role-scoped chatbot, BACKEND ONLY (AGENTS.md 7.5). DONE
      2026-10-04: curated `assistant-knowledge.md` (classpath, fail-fast) +
      system prompt with caller role/identity; function-calling loop behind
      the `AiCompletionClient` port (AiIsolation green) with tools executed
      outside ai.* through `SupervisionScopeService` (Admin global, Supervisor
      own scope, out-of-scope → "not found", no leak); read-only whitelisted
      tools (`kb_lookup`, `my_candidates`, `candidate_detail`, `my_tasks`,
      `queue_counts`); per-user server-side history (V49 `ai_chat_messages`,
      latest 20, owner-only); `@RateLimited(ai-chatbot, 20/60)`; input/output
      safety policy; friendly FR unavailable answer (200, `degraded=true`);
      metadata-only audit (`AI_CHATBOT_QUERIED`, `AI_CHATBOT_HISTORY_CLEARED`).
      `ChatbotIntegrationTest` (11, scripted fake Gemini incl. tool-call
      sequences + injection in tool DATA, real API never called) +
      `ChatbotSystemPromptTest` (2) + `ChatbotKnowledgeTest` (3) +
      `AssistantKnowledgeLoaderTest` (3). No Angular chatbot UI yet.
- [x] **S10c** Angular: chatbot UI + draft-review UI for the S10a drafts. DONE
      2026-10-04: `tasks/drafts` route (`TASK_MANAGE` guard, entry button in the
      Tasks header) with PDF upload, draft list, manual edit, AI revise, manual
      add, delete-with-confirm and atomic bulk-add with per-item results —
      every student picker fed from scope-safe `GET /api/internships`
      (supervisor sees only own students, no client scope param);
      `assistant-panel` rewired to the S10b backend (server history on open,
      loading, degraded note, fallback chain chatbot → legacy → local rules →
      error + retry, server clear) for authenticated staff (ADMIN/SUPERVISOR
      login gate). Specs: `api-client-ai` (10), `task-drafts.service` (9),
      `draft-review.component` (15), `chatbot.service` (4),
      `assistant-panel.component` (9), tasks-link (+1) = +48 (387 → 435,
      56 → 61 files). Secrets grep: zero key-pattern hits in `src/app`,
      `src/environments` and `dist/steg-back-office/`.
- [x] **S11** Dashboards on dedicated scoped endpoints (8.3). DONE 2026-10-04:
      backend `GET /api/reports/admin-summary` (ADMIN) + `supervisor-summary`
      (ADMIN/SUPERVISOR, scope via `SupervisionScopeService`) served by
      `DashboardSummaryService` over single GROUP BY/COUNT aggregates
      (soft-deleted excluded, full enum maps, 6-month Tunis-timezone trends);
      Angular dashboards rewritten on one summary call each (CSS `dist-bars`,
      loading/empty/error, every tile deep-links + target screens apply the
      params); legacy reporting dashboard code removed (legacy-removal #32).
      Backend `DashboardSummaryIntegrationTest` (8) + HotPath +2 (caps 20/9);
      Angular +14 net (449, 63 files).
- [x] **S12a** Hardening part 1 (2026-10-04): scenarios A/B/C as automated
      Testcontainers HTTP chains + `docs/acceptance-run.md` (manual steps
      marked NOT YET EXECUTED) + smoke steps 7–9 on the explicit statuses +
      live full-stack run 21/22. Backend 766 → **776** (+10: A 1, B 1, C 8).
- [x] **S12b** Hardening part 2 (2026-10-04): section 10 security review; final
      legacy-removal proof; section 14 checklist with evidence. Backend 776 →
      **926** (+140 matrix, +8 hardening, +2 migration); Angular 449 → **441**
      (62 files: −7 validation mapping spec, −1 workflow probe, −1/+1 service
      spec rewritten).

## (c) Gate counts

| Gate | Previous session | After S2 (2026-10-01, final) | After S3 (2026-10-02, final) | After persistence rule + S4 (2026-10-02, final) | After S5 (2026-10-02, final) | After pre-checks + S1b (2026-10-02, final) | After pre-checks + S1b (2026-10-02, final) |
|---|---|---|---|---|---|---|---|---|
| Backend (`./mvnw test`) | 526 passing | **557 passing**, 0 failures/errors/skipped (BUILD SUCCESS) | **577 passing**, 0 failures/errors/skipped (BUILD SUCCESS); ArchUnit green (AiIsolation 3, MethodSecurity 1, CleanArchitecture 3) | **594 passing**, 0 failures/errors/skipped (BUILD SUCCESS); ArchUnit green (AiIsolation 3, MethodSecurity 1, CleanArchitecture 3); +17 integration tests (supervision persistence 4, candidate scoping 2, intern-accounts API 10, idempotent provisioning 1) | **605 passing**, 0 failures/errors/skipped (BUILD SUCCESS); ArchUnit green (AiIsolation 3, MethodSecurity 1, CleanArchitecture 3); +11 (`CandidateWorkspaceIntegrationTest`) and `StegBackendApplicationTests.flywayMigrationSucceeds` UPDATED 40 → 41 for the new migration | | **611 passing**, 0 failures/errors/skipped (BUILD SUCCESS, clean run); ArchUnit green; +13 (`CandidateSelfServiceLifecycleIntegrationTest`, pre-check a+c) +2 (`LegacyStatusRemovalMigrationIntegrationTest`, V43 data migration). The suite went 620 → 611 because 9 parameterized cases in `StateMatrix409Test` probed status values that no longer exist (logged in `docs/legacy-removal.md` #15); no test method was deleted |
| Angular tests (`npm test`) | 184 passing | **206 passing**, 34 files | **241 passing**, 37 files | **275 passing**, 40 files | **298 passing**, 43 files (+23: `api-client-candidates.spec` 7, `candidate-list.component.spec` 10, `candidate-detail.component.spec` 6) | | **301 passing**, 43 files (+3: the audit viewer now proves it renders historical AND current action codes verbatim; `deriveValidationState` gained an explicit VALIDATED/REJECTED mapping test) |
| Angular build + typecheck | green | **green** (production build + both tsconfigs) | **green** (production build + both tsconfigs, zero extended diagnostics) | **green** (production build + both tsconfigs; new `intern-account-list-component` lazy chunk) | **green** (production build + both tsconfigs, zero extended diagnostics after removing one NG8107) | | **green** (production build + both tsconfigs, zero extended diagnostics) |
| Flutter (`flutter test`) | 133 passing, 1 skipped | **134 passing, 1 skipped** | **134 passing, 1 skipped** | **134 passing, 1 skipped** | **134 passing, 1 skipped** | | **134 passing, 1 skipped** + `flutter build apk --debug` succeeds (the `InternshipStatus` enum was rewritten to the explicit §4 chain and its l10n keys renamed) |
| Python (`pytest ai-services`) | 16 passing | **16 passing** | **16 passing** | **16 passing** | **16 passing** (run with `python3.13 -m pytest`; the system `python3` has no pytest) | | **16 passing** (unchanged; no python-ai contract was touched by S1b) |
| Next front-office `tsc` + `next build` | n/a (not a gate) | **green** (73 static pages; contracts changed: explicit statuses) | **green** (`tsc --noEmit` + build, 73 static pages; re-verified, no shared contract consumed by Next changed) | not re-run: no shared contract changed (the only backend change is the additive `/api/intern-accounts/manage` endpoint, consumed by no other client) | **green** (`tsc --noEmit` + `next build`): re-run because S5 changed a contract Next DOES consume — `CandidateRequest.nationalId` is now optional-on-update and a CIN is required on create (422 `CANDIDATE_NATIONAL_ID_REQUIRED`), which touches `createMyCandidate`/`updateMyCandidate` in `src/lib/api/candidate.ts` | | **green** (`tsc --noEmit` + `next build`): re-run for BOTH the pre-check and S1b — `ApplicationStatus`/`InternshipStatus`/`WorkflowDecision` all changed shape, and the front office's `ApplicationStatus` union and badge map were swept |

**Latest full run — 2026-10-04 (production-hardening slice, clean slice boundary):**

| Gate | Command | Result |
|---|---|---|
| Backend | `cd steg-backend && ./mvnw clean test` | **957 passing**, 0 failures/errors/skipped, BUILD SUCCESS (931 + 26 new: V52 chain + real-service tests 2, NullSafe 5, listener null-safety 8, exposure dev/prod 6, prod hygiene 5). ArchUnit CleanArchitecture + AiIsolation + MethodSecurity green. |
| Angular tests | `cd steg-back-office && npm test` | **443 passing**, 63 files (441 + 2 `environment.spec.ts`) |
| Angular typecheck + build | `npm run typecheck && npm run build` | green / green (+ `scripts/check-production-hygiene.sh` clean incl. dist/) |
| Flutter | `cd stegappe && flutter test` | **137 passing**, 1 skipped (+2 config fail-fast tests); `flutter build apk --release` succeeds (59.1 MB, debug-signing fallback — release keystore is an operator prerequisite) |
| Python | `python3.13 -m pytest ai-services -q` | **28 passed** |
| Next front-office | `npx tsc --noEmit && npm run build` | green / green (73 static pages) |

**Latest full run — 2026-10-05 (hardening slice 2, clean slice boundary):**

| Gate | Command | Result |
|---|---|---|
| Backend | `cd steg-backend && ./mvnw clean test` | **964 passing**, 0 failures/errors/skipped, BUILD SUCCESS (957 + 7: bootstrap 4, session revocation 3). ArchUnit green. |
| Angular tests | `cd steg-back-office && npm test` | **443 passing**, 63 files |
| Angular typecheck + build | `npm run typecheck && npm run build` | green / green (+ `scripts/check-production-hygiene.sh` clean) |
| Flutter | `cd stegappe && flutter test` | **137 passing**, 1 skipped |
| Python | `python3.13 -m pytest ai-services -q` | **28 passed** |
| Next front-office | `npx tsc --noEmit && npm run build` | green / green |
| Live prod stack | local JVM, `SPRING_PROFILES_ACTIVE=prod`, fresh DB, `MALWARE_MODE=clamav` | boot OK; QA accounts disabled 4 s before Tomcat; one Admin bootstrapped; health 200 / api-docs+swagger+info 404; **smoke 24/24**; fail-closed upload probe 422 `MALWARE_SCAN_FAILED` |

Rule: counts must grow. Angular must grow by hundreds over the remaining slices.

Rule: counts must grow. Angular must grow by hundreds over the remaining slices.

## (d) Open blockers / decisions

- ~~**S1b is a cross-client change**~~ **DONE 2026-10-02**: all five legacy
  values are removed from the backend enums, Angular, Flutter and Next, with
  `V43` for the data and zero-reference greps recorded in
  `docs/legacy-removal.md` #15 (mapping in audit assumption #15).
- ~~**Legacy internship workflow engine still reachable**~~ **REMOVED in S6b,
  verified again in S7**: `WorkflowService.spawnInternshipWorkflow`,
  `transitionInternship` and `getInternshipWorkflowState` are gone, the
  `POST /api/internships/{id}/workflow/actions` + `GET .../workflow`
  endpoints are gone (OpenAPI asserts absence), `InternshipWorkflowGuard.java`
  is deleted. What remains is the APPLICATION workflow engine
  (`POST /api/applications/{id}/workflow/actions`, `FINAL_DECISION`) and the
  payment workflow (`transitionPayment`) — live paths, not legacy. The
  authoritative internship lifecycle is `POST /api/internships/{id}/
  status-transitions` plus the S7 decision/receipt endpoints.
- ~~**Staff "create candidate" (§5.1) is still missing**~~ **DONE 2026-10-02 in
  S6a**: the link model is `candidates.managed_by_user_id` (V44) and the rule
  lives only in `SupervisionScopeService`; assumption #16 defines the claim.
  The §3 candidate CRUD row is back to **OK** with 15 Testcontainers tests.
- ~~**Validation decision wire contract**~~ **MOVED in S7**: the UI speaks
  `ValidationDecision` to the dedicated `POST /api/internship-validation/
  {id}/decisions` endpoint; the `ApprovalDecision` translation
  (`Angular InternshipService.recordValidationDecision`) is deleted with the
  legacy internship workflow path (legacy-removal #22). The application
  workflow decision (`FINAL_DECISION` + `ApprovalDecision`) is unchanged.
- **Working tree uncommitted** (earlier sessions + this slice). Do not commit,
  do not revert; treat `git diff` as the record.
- Flutter gate was red at session start (static provider-inference cycle in
  `stegappe/lib/features/auth/presentation/providers/auth_providers.dart`);
  fixed by declaring the provider's type explicitly, gate green again.

## (e) System understanding (verified in code, not from reports)

1. `steg-backend` is a Spring Boot 4.1.1 modular monolith; contexts under
   `tn.steg.backend.*` (ai, application, assignment, audit, candidate,
   certificate, comment, common, companion, document, evaluation, finance,
   iam, internship, messaging, notification, organization, reporting,
   workflow), each split `application/domain/infrastructure/interfaces`.
2. Back-office roles are only `ADMIN` and `SUPERVISOR` (V34). Admin has global
   access **and** can supervise directly, one account, one role.
3. Supervision scope lives in exactly one component:
   `internship/application/SupervisionScopeService` (`hasGlobalAccess`,
   `isAssignedTo`, `canManage`, `assignedInternships`,
   `findSupervisorUserId`), consumed by `CandidateService`,
   `CompanionService`, `InternshipService` and their tests.
4. Supervision is user-backed: `internship.supervisor_user_id` (V35) plus
   `InternshipAssignment.supervisorUser` (V36); legacy `Employee.supervisor`
   fallbacks still exist and must be removed.
5. Approval is one atomic command `POST /api/applications/{id}/approve`
   (`ApplicationApprovalService` + `MobileAccountProvisioningService`); default
   supervisor = approving Admin; provisioning only for obligatory
   PERFECTIONNEMENT/PFE; one-time password, bcrypt, `must_change_password`,
   email status + resend. Cache-Control: no-store verified.
6. Status model (now enforced): application `DRAFT → SUBMITTED →
   MODIFICATION_REQUESTED ↔ RESUBMITTED → APPROVED | REJECTED` (+ WITHDRAWN);
   internship `APPROVED → IN_PROGRESS → REPORT_SUBMITTED → UNDER_VALIDATION →
   VALIDATED → RECEIPT_ISSUED`. Guard matrix lives in
   `ApplicationWorkflowGuard` and `InternshipLifecycleService`; both pinned by
   hand-written matrix tests.
7. Blank denial reason / modification message -> 409
   `INVALID_STATE_TRANSITION` (deliberate, documented in the audit).
8. IAM: JWT filter enforces `mustChangePassword` with 403
   `PASSWORD_CHANGE_REQUIRED`; Angular interceptor and Flutter client react.
9. Notifications use per-user `NotificationDelivery` rows + STOMP `/ws`;
   listeners run `BEFORE_COMMIT`; audit is an append-only context.
10. python-ai (`ai-services`, FastAPI) implements deterministic report/journal
    checks behind `X-Service-Token`; the Spring verification adapter
    (`verifyReport`/`verifyJournal` + persisted runs) is delivered in S7 and
    pinned by `PythonDocIntelVerificationTest` + the shared golden fixture.
11. Angular (`steg-back-office`) is standalone + signals + `shared/ui`, no UI
    library; workspaces exist for dashboard/applications/candidates/
    internships/finance/reports/notifications/tasks/audit/supervisors/admin/
    intern-accounts/validation/certificates. The bare
    `GET /api/intern-accounts` list stays for the credentials Resend flow.
12. Working tree contains the accumulated, uncommitted work of earlier
    sessions; the last Flyway migration is V47 (V46 certificate versions +
    reference sequence, V47 audit source).

## (f) Session log

### 2026-10-02 — Pre-checks (a)(b)(c) + S1b legacy status removal completed

**Pre-check (a) — the CIN rule vs the front office.** The front office sends
`nationalId: ... || null`, so the rule had to be reconciled. Reading the code
first paid off: `POST /api/candidates` is `@authz.hasRole('CANDIDATE')`, i.e.
the **self-service onboarding endpoint only** — there is no staff create route,
so "the rule only applies to Admin/Supervisor creation" is not implementable
today. The front-office `ProfileCreateForm.validate()` ALREADY refuses to submit
without a CIN, so both sides agree and the rule is consistent. Fixes: the
front office now handles `CANDIDATE_NATIONAL_ID_REQUIRED` explicitly instead of
leaking the raw backend message. Tests (new, Testcontainers,
`CandidateSelfServiceLifecycleIntegrationTest`, 13):
`createWithoutCinIsRefused` (omitted / explicit null / blank, and nothing
persisted), `createWithCinSucceedsAndReturnsItToSelf`,
`secondProfileForSameAccountIsRefused`, `duplicateCinIsRefused`,
`staffCannotCreateOnBehalfOfACandidate`, `selfUpdateWithoutCinKeepsStoredValue`,
`selfUpdateCanReplaceTheCin`, `selfProfileReadIsEntitledAndScoped`. Next gate
re-run: green.

**Pre-check (b) — already recorded, re-verified.** Confirmed in this ledger:
Supervisor 403 on `GET /api/supervisors/manage` (`SupervisorManagementApiTest.manageListIsAdminOnly`)
plus the Angular nav/guard tests; the full `@Query` sweep; and the persistence
re-grade (audit assumption #9). The sweep was **re-run** because S5 grew the
repository set from 51 `@Query` in 16 files to **53 in 17**: the two new ones are
`CandidateRepository.searchStaffCandidates` (value + count). Checked field by
field — every multi-hop path uses an EXPLICIT `JOIN` (`ia.supervisorUser`,
`ia.internship`, `i3.supervisorUser`); the rest are equality predicates on
nullable relations, which are safe by definition. **No new finding**, and the
join semantics stay pinned by `filtersNarrowTheQueueServerSide` +
`scopeIsResolvedServerSide`.

**Pre-check (c) — soft delete: two REAL defects found and fixed.** New
`CandidateSelfServiceLifecycleIntegrationTest` exposed:
1. a soft-deleted profile kept owning `candidates.user_id`, so the SAME account
   got **409** on a second `POST /api/candidates` — the opposite of what the
   service comment promised;
2. the same CIN could never be registered again (permanent lockout);
3. worse, `AnonymousApplicationService.resolveOrCreateCandidate` **resurrected**
   the tombstone (rewriting its fields and attaching a new, staff-invisible
   application), and `IdentifierValidationService` reported the CIN as a
   duplicate so the front office refused the person.
Fix: new `V42__candidate_live_identity_uniqueness.sql` (CIN uniqueness moved to
the LIVE rows via `idx_candidates_live_national_id_hash … WHERE deleted_at IS
NULL`), the soft delete now also sets `user_id = NULL`, and all three call sites
use live-only lookups. Audit assumption **#13** supersedes the CIN-reservation
sentence of #12; logged in `docs/legacy-removal.md` **#14**.

**S1b — legacy status removal.**
- *Before coding*, every legacy value, its old meaning and its §4 mapping were
  written into `docs/back-office-audit.md` assumption **#15** (as required).
- `V43__drop_legacy_status_values.sql` migrates the rows and resets the
  `internships.status` DEFAULT from `'PLANNED'` to `'APPROVED'`. Proven by
  `LegacyStatusRemovalMigrationIntegrationTest` (2) which drives Flyway itself:
  migrate to V42 → insert rows carrying EVERY legacy value → migrate to V43 →
  assert nothing legacy survives, the mapped values are present and already
  explicit rows are untouched.
- Removed the values from `ApplicationStatus`, `InternshipStatus` and the
  duplicated `ApprovalDecision.NEEDS_CORRECTION` (now
  `MODIFICATION_REQUESTED`), deleted the dead `ApplicationReviewRequest` DTO
  whose `allowableValues` still advertised the legacy names, and swept the AI
  knowledge base (`StegKnowledgeBase`), the staff-assistant text, the
  user-facing status switches and the OpenAPI descriptions that told users about
  an "ACCEPTED" application.
- **Validation decisions got their own enum**: `ValidationDecision
  { VALIDATED, REJECTED }` in the internship context, distinct from application
  statuses and from the workflow decision. Angular mirrors it, and the
  validation dialog now offers only Validate / Reject per §5.11 step 4 (the
  legacy "request corrections" and "hold" buttons were vocabulary leakage).
  `deriveValidationState` maps the wire decision EXPLICITLY instead of casting,
  so an application-style decision can no longer leak into the validation screen.
- **Audit history was NOT rewritten**: historical rows keep
  `APPLICATION_NEEDS_CORRECTION`; new rows write
  `APPLICATION_MODIFICATION_REQUESTED`, and
  `audit-viewer.component.spec.ts > renders historical and current action codes
  verbatim (append-only audit history)` proves the viewer displays both from the
  raw string.
- Tests of changed behaviour were **updated, never deleted**: 9 parameterized
  cases in `StateMatrix409Test` probed values that no longer exist (explaining
  620 → 611); `ReportControllerTest`, `InternshipIntegrationTest`,
  `AuditCoverageChecklistTest`, `StateMachineRejectionTest`,
  `TransitionValidationAndSideEffectsTest` and
  `StegBackendApplicationTests` (40 → 43) were updated.
- Zero-reference greps for all five values, in all four clients, are recorded
  verbatim in `docs/legacy-removal.md` #15.

**A stale-compile trap worth remembering:** `mvn compile` without `clean`
reported BUILD SUCCESS while `InternshipStatus.ACTIVE` was still referenced
anywhere. Always `mvn clean compile` / `mvn clean test` before trusting a backend
result.


### 2026-10-02 — S5 Candidates workspace completed

- **Backend.** New `V41__candidate_soft_delete.sql` (`candidates.deleted_at` +
  partial index `idx_candidates_live_created_at`); `Candidate.deletedAt`.
  `CandidateRepository` (port + infra) gained
  `searchStaffCandidates(scoped, candidateIds, universityName, searchPattern,
  accountActive, status, type, supervisorUserId, assignmentStatus,
  createdFrom, createdToExclusive, Pageable)` — explicit `LEFT JOIN FETCH` for
  the user/university joins and EXPLICIT joins inside every `EXISTS` subquery
  so no implicit INNER JOIN can drop NULL rows, with the filters mirrored in
  the count query. New `CandidateWorkspaceService` (`search` = one scoped query
  + 3 batched enrichment queries; `overview` = the whole §5.1 aggregate in one
  authorized call, CIN for Admin only and audited; `delete` = soft delete with
  409 `CANDIDATE_HAS_DEPENDENCIES`). New endpoints `GET /api/candidates/manage`
  (declared before `/{id}`), `GET /api/candidates/{id}/overview`,
  `DELETE /api/candidates/{id}`.
- **Scope.** `SupervisionScopeService.supervisesCandidate(actor, candidateId)`
  is new and is now used by the legacy `CandidateService` and the workspace
  service; the legacy `AccessDeniedException` throw was REMOVED so an
  out-of-scope candidate is 404 on every path (`docs/legacy-removal.md` #13,
  pending inventory #7 ticked).
- **CIN.** Required on create (422 `CANDIDATE_NATIONAL_ID_REQUIRED`), optional
  on update (blank keeps the stored value), redacted from Supervisor update
  responses. This is a shared-contract change, so the Next gate was re-run.
- **Tests (new, 11, Testcontainers/Postgres):** `CandidateWorkspaceIntegrationTest`
  — `manageListIsPagedServerSide`, `filtersNarrowTheQueueServerSide`,
  `supervisorFilterSortAndClamp`, `scopeIsResolvedServerSide`,
  `overviewAggregatesEverythingInOneCall`, `deleteIsBlockedWhenApplicationsExist`,
  `deleteIsBlockedWhenTasksExist`, `softDeleteRemovesTheCandidateEverywhere`,
  `deleteIsScopedAndRoleProtected`, `outOfScopeAccessIsNotFound`,
  `supervisorUpdatesOwnCandidateWithoutCin`. Updated (not deleted):
  `CandidateScopingTest` (5, mocks `supervisesCandidate`),
  `StegBackendApplicationTests.flywayMigrationSucceeds` (V40 → V41).
- **Angular.** `core/api-models.ts` gained `CandidateQueueRow`/`Query`/
  `CandidateOverview`; `ApiClient.searchCandidates`/`getCandidateOverview`/
  `deleteCandidate`; new `features/candidates/candidates.service.ts` facade
  (with static `isDependencyConflict`/`messageOf`); `candidate-list.component.ts`
  rebuilt as a server-paged workspace (search/status/type/validation/university/
  supervisor filters + date range, sort mapping, paging, confirm-delete, 409
  toast, realtime reload) and `candidate-detail.component.ts` now reads ONE
  `/overview` call. Legacy client-side `filtered`/`paged` removed
  (`docs/legacy-removal.md` #12).
- **Test-harness defect found and fixed (not a weakening):** the two new
  component specs crashed with `this.auth.isAuthenticated is not a function`
  because the real `RealtimeService` watches auth. The AuthService fakes now
  answer `isAuthenticated()`/`getAccessToken()`. Adding 3 spec files also
  exposed a latent ORDER DEPENDENCY in the S4 `intern-account-list` spec: its
  French assertions inherited `en` from the notification spec's
  `setLocale('en')` through the shared jsdom `localStorage`. Fixed by pinning
  the locale to `fr` in that spec, so it is now deterministic.
- **Gates:** backend 594 → **605**, Angular 275 → **298** (43 files), Flutter
  **134** + 1 skipped, Python **16**, Angular typecheck + production build
  green (one NG8107 removed), Next `tsc` + `next build` green.
- **Audit rows flipped to OK:** §3 "Admin candidate CRUD/search/filter/pagination"
  and §3 "Candidate detail aggregates workflow data" (both were PARTIAL), and
  §3 "Supervisor candidate CRUD restricted to own scope" re-graded with the S5
  evidence. New assumptions #11 (validation status = linked account state) and
  #12 (soft-delete policy).

### 2026-10-02 — Persistence rule + pre-checks + S4 completed

- **Rule added to (a):** an audit row whose behavior depends on persistence
  (queries, joins, unique indexes, flush order, transactions, DB-side scoping)
  may only flip to OK with a **Testcontainers integration test against real
  Postgres**, never with a mocked unit test; rows already OK with only mocked
  evidence were re-graded (see below).
- **Pre-check (a) — Supervisor 403 + hidden/blocked route:** backend pinned by
  `SupervisorManagementApiTest.manageListIsAdminOnly` (Supervisor token on
  `GET /api/supervisors/manage` → 403), `deleteUnassignedSupervisorSucceeds`
  (Supervisor DELETE → 403) and `assignmentCommandsAreAdminOnly` (Supervisor
  assign → 403). Angular had NO test for either the nav hiding or the guard, so
  two were added: `auth.spec.ts > hides the Admin-only /supervisors route from a
  Supervisor and keeps it for an Admin` (nav) and `permissionGuard … redirects a
  Supervisor away from /supervisors to /forbidden` plus `lets an Admin through`
  (route block, `permissionGuard(['USER_MANAGE'])`).
- **Pre-check (b) — implicit-join sweep over every @Query:** all 51 `@Query`
  occurrences in all 16 repository files were read. Only two queries were
  defective (both found and fixed in S3: `InternshipAssignmentRepository`,
  `FinanceCaseRepository`, pinned by Testcontainers tests). The remaining
  multi-hop paths (`i.candidate.user.id`, `a.candidate.user.id`,
  `pr.financeCase`, `fc.internship`, `d.recipient.id`, `m.sender.id`,
  `a.actor.id`, `c.internship.id`, `a.destination`, …) were checked against the
  entity annotations: the relation is either `optional = false`/`nullable =
  false` (FinanceCase.internship, PaymentReceipt.financeCase, Message.sender,
  NotificationDelivery.*, InternshipAssignment.destination) or the path is used
  as an equality predicate whose null rows must not match
  (`Candidate.user`, `Internship.supervisorUser`, `AuditLog.actor`,
  `Conversation.internship`). **No new defect found; no query left unfixed.**
- **Persistence re-proof (new Testcontainers tests, all against real Postgres):**
  - `internship/application/SupervisionPersistenceIntegrationTest` (4):
    `userBackedAssignmentGrantsScopeAndRoutesNotifications` (assignment-only
    scope + task notification + 404 for the other supervisor),
    `adminActsAsSupervisorThroughHisOwnAssignment` (Scenario 1; Admin global
    access but own scope still assignment-based),
    `reassignmentMovesScopeAndNotifiesBoth` (scope move + one ACTIVE assignment
    + both notifications), `directoryListsAdminAndSupervisorsExactlyOnce`
    (Admin selectable, dual-role user not duplicated, disabled excluded).
  - `candidate/interfaces/rest/CandidateScopingIntegrationTest` (2):
    `supervisorListShowsOnlyOwnCandidates` (direct link + user-backed
    assignment shapes), `readingForeignCandidateIsNotFound` (404, CIN hidden,
    Admin global).
  - `iam/interfaces/rest/InternAccountManagementApiTest` (10): paging/filters,
    full-name search through the LEFT JOIN without dropping candidate-less
    supervisors, sort whitelist + clamp, `/manage` route + 403, one-time
    credentials with `no-store`, shared supervisor identity with §5.6, reset
    regenerating the secret, activate/deactivate, delete guard 409 + candidate
    unlink, 403 on delete.
  - `ApplicationStateMatrixTest.approvalReusesExistingInternAccount` (19 total)
    re-proves the §4 idempotent provisioning row against Postgres: approving a
    candidate who already owns an INTERN account mints no second password,
    keeps the existing hash / `mustChangePassword` and adds no duplicate role.
  - Mocked-only rows were re-graded: `SupervisionScopeServiceTest`,
    `SupervisorDirectoryServiceTest`, `CandidateScopingTest` and
    `InternAccountManagementTest` are now complements, with the integration
    tests above as the OK evidence (audit §1/§3/§4 updated). Reassignment and
    the delete guard keep their Testcontainers evidence
    (`SupervisorManagementApiTest`), now reinforced by the scope/notification
    test above. Notification routing via user-backed assignments is now proven
    end-to-end, not only through `TaskScopingIntegrationTest`.
- **S4 backend:** new `GET /api/intern-accounts/manage` (Admin-only) =
  `InternAccountManagementService.searchManagedAccounts` over the new
  `UserRepository.findManagedAccounts` (INTERN/SUPERVISOR only, role/status
  filters, `LOWER(email)` OR `LOWER(CONCAT(firstName,' ',lastName))` search
  through a `LEFT JOIN Candidate c ON c.user = u`, sort whitelist
  {email,status,createdAt}, size clamp 100, fallback email ASC). Literal
  `/manage` declared before `/{id}` and pinned by the test. No schema change
  (no new Flyway migration needed).
- **S4 Angular:** `features/intern-accounts/` (`intern-accounts.service.ts`
  facade, `intern-account-list.component.ts`) with server-side search, role and
  status filters, sort and paging; create → shared `CredentialsDialogComponent`
  (password dropped on close), edit status/enabled, reset password through the
  same shared dialog, activate/deactivate quick actions, delete with the
  reassignment-first 409 message. Route `/intern-accounts` behind
  `permissionGuard(['USER_MANAGE'])` — SEPARATE from `/supervisors`, sharing
  only the UI components. Nav item + `nav.internAccounts` and 29
  `internAccounts.*` keys in fr/en/ar. The admin workspace's legacy "backend
  endpoint pending" panel now links to the workspace (no fake actions remain).
- **Legacy removed:** `docs/legacy-removal.md` #11 (admin pending-accounts
  panel). The related test was updated, not deleted: `admin-workspace
  .component.spec.ts > shows user linkage badges and links the accounts tab to
  the dedicated workspace` (was `…honest pending accounts panel`).
- **Gates (final, full runs):** backend **594** (ArchUnit 3/1/3), Angular
  **275** (40 files), Flutter **134** (+1 skipped), Python **16**; Angular
  typecheck + production build green. Next not re-run (no shared contract
  changed).

### 2026-10-02 — S3 completed (Supervisor Management workspace)

- **Pre-check (S2 dialogs):** (a) the chosen/preselected supervisor is proven by
  `ApprovalDialogComponent > preselects the acting Admin and confirms with the
  selection`, `falls back to the first supervisor when the acting Admin is
  absent from the list`, `ApplicationReviewService > approves through the atomic
  endpoint with the chosen supervisor and department`, `approves as the acting
  Admin when no supervisor is chosen (null is sent)`, `lists selectable
  supervisors from the directory endpoint` and the dossier tests `opening
  approval preselects the Admin, confirming calls the atomic endpoint and shows
  credentials once` / `supports the backend default: approve with no chosen
  supervisor sends null`; (b) password shown once and not retained by
  `CredentialsDialogComponent > copies the one-time password and flips the
  copied flag` / `does not attempt a copy without a password` and the dossier
  test ending in `closeCredentials()` (`credentials()` is null); (c) Resend and
  the email-failed state were only partially asserted, so two tests were added:
  `Resend regenerates a NEW password and swaps the displayed secret (§5.3)`,
  `Resend failure keeps the account, clears busy and shows an error toast`,
  `CredentialsDialogComponent > surfaces the email status and emits a resend
  request` and `renders the email-failed alert when the credentials email did
  not send, and the OK flag when it did`. No test was weakened or deleted.
- **Backend, listing (§5.6 + §5 list rule):** new
  `GET /api/supervisors/manage` (`q`, `status`, `@PageableDefault(size=20,
  sort="email", ASC)`) over `UserRepository.findSupervisorUsers` with
  `SELECT DISTINCT u FROM User u JOIN u.assignedRoles r WHERE r.code='SUPERVISOR'`
  and the `:param IS NULL` pattern (no `LOWER(null)`); `searchSupervisors` +
  `sanitize` clamp size to 100 and drop sort properties outside
  {email, status, createdAt}, falling back to `email ASC`.
- **Backend, conflict model:** new
  `common.domain.exception.ConflictException` (carries its own `errorCode`) and
  `GlobalExceptionHandler.handleConflict` -> **409**. The supervisor delete
  guard (`SUPERVISOR_HAS_ACTIVE_ASSIGNMENTS`) and the
  `InternAccountManagementService.deleteAccount` guard now use it instead of
  `BusinessRuleException` (which is 422) — a 409 is the correct status for a
  state conflict. `assignCandidate` additionally refuses a non-APPROVED linked
  application (`CANDIDATE_NOT_APPROVED`) and CANCELLED/ARCHIVED internships
  (`INTERNSHIP_NOT_ACTIVE`).
- **Three production bugs found while proving the slice (all fixed and proven):**
  1. `InternshipAssignmentRepository.findBySupervisorUserIdAndStatus` used the
     implicit-join JPQL `a.supervisor.user.id`, i.e. an INNER JOIN — every
     user-backed assignment (legacy `supervisor_id` NULL, set since V36) was
     invisible to supervision scope, to the delete guard and to notification
     routing. Now an explicit `LEFT JOIN a.supervisor legacySupervisor` with
     `(a.supervisorUser.id = :supervisorUserId OR legacySupervisor.user.id =
     :supervisorUserId)`.
  2. Hibernate orders INSERTs before UPDATEs on flush, so closing the old ACTIVE
     assignment and inserting the new one violated the partial unique index
     `idx_internship_assignment_active_unique (internship_id) WHERE
     status='ACTIVE'` — every reassignment returned 409. Fixed with
     `saveAndFlush(oldAssignment)` on the closure in both `assignCandidate` and
     `reassignSupervisor`.
  3. Same defect class, found by grepping the remaining
     `a.supervisor.user.id` occurrences: `FinanceCaseRepository
     .findAllForSupervisor` / `findByStatusForSupervisor` also resolved the
     supervisor through the implicit (INNER) join, so **every supervisor's
     finance queue was empty** for V36 user-backed assignments. Fixed the same
     way and pinned with the new
     `finance/application/SupervisorScopedFinanceQueryTest` (3) — verified to
     bite: 3/3 fail when the `LEFT JOIN` is reverted.
- **Route table:** `/manage` is declared before `/{id}`, and
  `SupervisorManagementApiTest.manageRouteIsNotSwallowedByIdPathVariable` proves
  the literal segment wins (a UUID is never parsed as `manage`). No collision
  existed; the test now pins it.
- **Angular workspace:** `features/supervisors/supervisor-management.service.ts`
  (facade, no business rules) + `supervisor-list.component.ts`: server-side
  search/status/sort/paging on one rendered page, create dialog -> the shared
  `CredentialsDialogComponent` (password dropped on close, §5.3), edit
  status/enabled, delete with the reassignment-first message when the 409
  arrives, assign an approved candidate and change supervisor with the Admin
  selectable from `GET /api/supervisors`. Route `/supervisors` behind
  `permissionGuard(['USER_MANAGE'])`, nav item in the Controle section,
  `nav.supervisors` + 28 `supervisors.*` keys in fr/en/ar.
- **Tests (backend):** new `e1/SupervisorManagementApiTest` (13) and
  `finance/application/SupervisorScopedFinanceQueryTest` (3). Updated (not
  deleted) `SupervisorManagementServiceTest` 5 -> 9 and
  `InternAccountManagementTest` 5 -> 7 (delete-guard expectations renamed to
  `...ThrowsConflict`, `CANDIDATE_NOT_APPROVED` / `INTERNSHIP_NOT_ACTIVE` cases
  added, list-supervisors renamed to search).
- **Tests (Angular):** new `core/api-client-supervisors.spec.ts` (10),
  `features/supervisors/supervisor-management.service.spec.ts` (9),
  `features/supervisors/supervisor-list.component.spec.ts` (13).
- Gates (final, all run in full): backend **577** (ArchUnit 3/1/3), Angular
  **241** (37 files), Flutter **134** (+1 skipped), Python **16**; Angular
  typecheck + production build green; Next `tsc --noEmit` + build green.

### 2026-10-01 — S2 completed (Angular approval flow)

- **Pre-checks:** (a) legacy status sweep over Angular/Flutter/Next: Flutter
  clean; Angular display-only branches; Next front-office rewired to
  `MODIFICATION_REQUESTED` / `RESUBMITTED` / `APPROVED` (timeline, badges,
  withdraw eligibility, status help in fr/en/ar) — `tsc` and `next build`
  green; (b) new tests: Angular interceptor no-loop on the change-password
  call itself, Flutter `AuthGate` shows `ChangePasswordScreen` after the
  PASSWORD_CHANGE_REQUIRED callback fires; (c) S7 constraint recorded above.
- **Approval flow:** `ApplicationReviewService.approve()` → atomic
  `POST /api/applications/{id}/approve`; `ApprovalDialogComponent` (Admin
  preselected from `AuthService`, list from `/api/supervisors`, department
  required); `CredentialsDialogComponent` (copy button, email status, Resend
  that regenerates through the §5.4 reset and swaps the displayed secret);
  password held only while the dialog is open, cleared on close.
- **Legacy removal:** `accept()`, the `accept-note` branch and the
  `dossier.accept*` dictionary keys deleted with grep proof in
  `docs/legacy-removal.md` #6.
- **Server-side application list (AGENTS.md §5 list rule + §5.2):** new
  backend `GET /api/applications/manage` = `ApplicationQueueService.search`
  (Admin all / Supervisor own candidates resolved server-side, `q`/
  `status`/`type`/`university`/`from`/`to` filters, sort whitelist + size
  clamp, one paged query), proven by `ApplicationQueueSearchTest` (7).
  Angular queue now renders exactly one server page via
  `ApiClient.searchApplications`; local `filtered`/`paged` computation, the
  dead `getApplications`, `ApplicationRow` and `PageQuery` deleted
  (`docs/legacy-removal.md` #7); dashboard drill-down moved
  `NEEDS_CORRECTION → MODIFICATION_REQUESTED` (#8). New
  `api-client-queue.spec.ts` (4) + rewritten queue spec (10);
  `approvalReturnsOneTimeCredentialsOnce` (matrix test, 18 total) pins the
  §5.3 approve response (credential email + one-time password + no-store).
- **API surface:** `approveApplication`, `listSupervisors`,
  `listInternAccounts`, `resetInternAccountPassword`, `searchApplications`;
  explicit `ApplicationStatus` union (legacy values marked for S1b).
- Gates (final, all run in full): backend **557**, Angular **206** (34 files),
  Flutter **134** (+1 skipped), Python **16**; Angular build/typecheck green;
  Next tsc + build green.

### 2026-10-01 — S2 pre-checks and client-drift fixes

- **(a) S1a client sweep:** Flutter has **zero** references to
  `UNDER_REVIEW`/`NEEDS_CORRECTION`/`ACCEPTED` (`grep` over `stegappe/lib`);
  Next only decorative badge/comment mentions (status model rewired to
  `MODIFICATION_REQUESTED`/`RESUBMITTED`/`APPROVED`, `tsc` + `next build`
  green); Angular had four **functional** dependencies on the retired values,
  now fixed: `internship-create` (`!== 'ACCEPTED'` blocked every approved
  application → `APPROVED`), `internship-list` drill-down
  `?status=ACCEPTED → ?status=APPROVED`, `ai-assistant` insights/answers
  filtered on `NEEDS_CORRECTION → MODIFICATION_REQUESTED`, dashboard
  corrections KPI + drill-down (see `docs/legacy-removal.md` #8/#9).
  No client special-cases HTTP 422 for candidate transitions: Flutter maps
  400/422 generically to validation, Next's 422 handling is for duplicate-CIN
  validation (still 422), Angular surfaces the 409 envelope message. All four
  gates re-run green afterwards.
- **(b) New redirect-loop tests:** Angular
  `error.interceptor.spec.ts → "does not loop when the failing request is the
  change-password call itself"` (no navigate/toast when `/change-password`
  itself returns 403 PASSWORD_CHANGE_REQUIRED); Flutter
  `session_gate_test.dart → "password-change-required callback shows
  ChangePasswordScreen"` (AuthGate shows the screen after the callback,
  exactly once).
- **(c) S7 constraint recorded** in the S7 plan row: `VALIDATED` and
  `RECEIPT_ISSUED` must only be reachable through the validation decision and
  receipt generation, never through the generic
  `POST /api/internships/{id}/status-transitions`.

### 2026-10-01 — S1a completed

- **Application state matrix**: `ApplicationWorkflowGuard` now allows
  `UNDER_REVIEW` only from `SUBMITTED`/`RESUBMITTED` and `FINAL_DECISION` from
  `SUBMITTED`/`RESUBMITTED`/`UNDER_REVIEW`; `ApplicationApprovalService`
  accepts the same three sources. New `ApplicationStateMatrixTest` (17 tests,
  hand-written table from §4) proves 13 allowed pairs with exact audit actions
  and notification recipients, the full 409 complement (including legacy
  statuses), the candidate-only submit/resubmit matrix, and the atomic
  approval of a fresh SUBMITTED application (internship + Admin supervisor).
- **Notifications**: Admin role fan-out on new application
  (`APP_SUBMITTED_ADMIN:<id>`), new `ApplicationResubmittedEvent` → Admin
  fan-out, new `ApplicationModificationRequestedEvent` → candidate (§5.2).
- **Internship lifecycle**: new `InternshipLifecycleService` (hand-written §4
  table), `InternshipStatusChangedEvent` (supervisor + intern recipients),
  Admin-only `POST /api/internships/{id}/status-transitions`; new
  `InternshipLifecycleMatrixTest` (8 tests: allowed pairs + audit +
  notifications, full 409 complement, 403 for supervisor/intern).
- **Legacy corrections** (all logged in `docs/legacy-removal.md`): removed
  `MODIFICATION_REQUESTED → UNDER_REVIEW` skip; removed the "FINAL_DECISION only
  from UNDER_REVIEW" rule; candidate invalid transitions 422 → 409; removed
  `NEEDS_CORRECTION` as a resubmission source. Updated (not deleted)
  `StateMatrix409Test`, `StateMachineRejectionTest`, `IdempotencyTest`,
  `WorkflowControllerIntegrationTest`.
- **S1 items 2/3/6 verified**: the `temporaryPassword()` assertions are present
  in the three named test classes (files are untracked, no sed damage);
  credentials flow proven by `AuditAndSecretsLeakageTest` and
  `AuthPasswordIntegrationTest.credentialsResponsesHaveCacheControlNoStore`;
  controller base mappings are unique and clients do not call wrong paths
  (Angular does not call supervisor/intern-account APIs yet — that is S3/S4).
- **Quality improvement**: `JpaNotificationRepository` gained a scoped
  entity query used by the matrix assertions.
- Gates: backend 526 → **549**, Angular 184, Flutter **133** (fixed red gate),
  Python 16. Audit rows flipped to OK: application states, internship states,
  approval no-reason, approval default supervisor, audit+notifications on
  transitions, new application notification.

### 2026-10-02 — Pre-check (b) + S6a staff candidate create completed

**Pre-check (a) re-verified (no change).** `git diff --stat` for
`StateMatrix409Test` is empty **by construction**: the file is untracked (`??`).
Method inventory instead: **7 test methods present** (`invalidSourceToUnderReview`,
`invalidSourceToFinalDecision`, `validSourceToUnderReview`, `validFinalDecision`,
`invalidSourceToActive`, `invalidSourceToCompleted`, `validInternshipTransition`).
Only parameter lists shrank when S1b removed legacy statuses. **Nothing was
removed, nothing to restore.** The five tracked S1b-touched tests were checked the
same way; the `git diff` hunks that do exist belong to an EARLIER session (the
HR/FINANCE/DIRECTOR retirement, `docs/legacy-removal.md` #6), not to S1b.

**Pre-check (b) — two real defects found and fixed.**
1. *Demo seeding was ON by default with a hard-coded password.*
   `IntegrationDemoSeeder` had `matchIfMissing = true` and
   `${steg.seed.demo-password:Demo#2026}`. Now: `matchIfMissing` removed (OFF
   unless `STEG_SEED_DEMO_ENABLED=true`), no default password — the constructor
   throws `IllegalStateException` when seeding is enabled without one. Same in
   `application-integration.yml` and `.env.example`; `scripts/smoke-test.sh` now
   requires `SMOKE_HR_PASS` instead of defaulting to `Demo#2026`.
   `grep -rn "Demo#2026"` over `steg-backend/src`, `scripts`,
   `steg-back-office/src` → **0 hits**.
2. *`AuthService.signInDemo` shipped in the production bundle* — a "become any
   user" primitive. Extracted to the spec-only fixture
   `core/testing/demo-session.ts`, which drives the real public seams
   (`setAccessToken` + `restoreSession`) instead of private signals. All 32 call
   sites in 16 spec files migrated (mechanical rewrite + import insertion; no
   assertion touched). Proof: `grep -ro signInDemo dist/` = **0** (was 1),
   `demo@` = 0, `Demo#2026` = 0.
   TODO/console.log sweep: no real occurrence left (`console.log` 0,
   `System.out.print` 0; the 2 Flutter `print(` are the crash reporters; every
   TODO hit is the `TaskStatus.TODO` enum value or a documented business caveat).

**Pre-check (b) — secrets half.** `.env` is ignored in all five repos; NEW rules
added to `steg-back-office/.gitignore` and `stegappe/.gitignore` (they had none)
and `!.env.example` added to `steg-front-office/.gitignore` (its `.env*` rule
made the required template untrackable). `steg-backend/.env.example` gained the
3 missing §9.5 variables (`PYTHON_AI_CIRCUIT_THRESHOLD`,
`NOTIFICATIONS_MAIL_ENABLED`, `NOTIFICATIONS_MAIL_FROM`) and lost the tracked
demo password. No hard-coded key in any source (only the synthetic
`re_1234567890abcdef` fixture). The attached `.env` was never opened.

**S6a — staff candidate create.** `V44__candidate_managed_by_user.sql` adds
`candidates.managed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL` +
a partial index on live rows. `SupervisionScopeService` is now the only place
that answers "is this candidate mine" (`supervisesCandidate`,
`supervisedCandidateIds`, `supervisedCandidates`); `CandidateWorkspaceService`
and `CandidateService.listCandidates` were re-pointed at it, which removed a
second, drifting copy of the rule. New `POST /api/candidates/manage`
(Admin + Supervisor) creates a profile with no account, a required CIN and
`managed_by` = acting staff (Admin may pick another; a Supervisor naming anyone
else gets 403, checked BEFORE any business rule so a probe learns nothing).
The queue row's supervisor column falls back to the manager when there is no
internship yet. The owner claims the profile by registering with the same CIN or
the same email (assumption #16); a profile owned by an account is never
claimable; the anonymous intake claims the same way. Angular gained a role-aware
create dialog (manager picker only for Admin) + 15 dictionary keys × 3 locales.
Tests: `StaffCandidateLifecycleIntegrationTest` (15, Testcontainers) and 4 new
Angular specs. Both pre-existing tests that described the old model were
UPDATED, not deleted: `CandidateSelfServiceLifecycleIntegrationTest.
staffCannotCreateOnBehalfOfACandidate` → `selfServiceEndpointStaysCandidateOnly`
(and `CandidateScopingTest.supervisorSeesOnlyOwnCandidates`).

### 2026-10-02 — S6b legacy-engine removal + S6c tasks workspace (all gates green)

**Step 1 gates (real state at session start):** backend `./mvnw clean test`
632 run → 42 failures + 16 errors (S6b half-done: workflow engine deleted but
`CertificateService` still gated on its tables, matrix tests still driving the
deleted `/workflow/actions` endpoint); Angular typecheck green, 305 tests green,
prod build green; Flutter analyze clean, 134 +1 skipped; Python 16;
Next `tsc` + build green. Last proven baseline had been backend 611 /
Angular 301 / Flutter 134 (+1) / Python 16.

**Step 2 root-cause fixes (no test method deleted, no assertion weakened):**
1. `CertificateService.assertAdministrativeValidation` (workflow-table gate that
   could never pass without spawning) deleted — the certificate gate is the
   §4 status `VALIDATED`. Fixed all finance/certificate/hot-path/idempotency
   failures at once.
2. `InternshipLifecycleMatrixTest`: 3 generic pairs stay 200, the 2 reserved
   pairs gained `reservedTransitionsAreRejected` (422
   `INTERNSHIP_STATUS_RESERVED`); the 409-complement loop skips reserved
   targets.
3. `StateMatrix409Test`: internship probes migrated to
   `POST .../status-transitions` (`IN_PROGRESS`/`REPORT_SUBMITTED`/
   `UNDER_VALIDATION`; 7 methods kept, `validInternshipTransition` 2 → 3 cases).
4. `StateMachineRejectionTest` (19 kept): lifecycle endpoint + new
   `InternshipLifecycleFixture` (S7 owns per-document decisions; V6–V8 now
   assert single-authority facts instead of deleted workflow decisions).
5. `AuditCoverageChecklistTest` (legacy `INTERNSHIP_COMPLETED/ACTIVATED` →
   `INTERNSHIP_STATUS_CHANGED`/`INTERNSHIP_CANCELLED` from the authority),
   `OpenApiContractTest` (legacy `/workflow` path asserted ABSENT),
   `CrossModuleIdorTest` (403 → 404, no oracle).
6. `GET /api/internships/{id}` moved to service-side 404 scoping (was 403 via
   method security, leaking existence).
7. **Vacuous ArchUnit rule found + fixed:** `callMethod(Internship.class,
   "setStatus")` without parameter types never matches the Lombok setter, so
   `onlyTheLifecycleAuthorityWritesInternshipStatus` could never fail. It now
   declares the `InternshipStatus` parameter and demonstrably FAILED on a
   temporary out-of-package violator (deleted afterwards); the reverse guard is
   a plain existence test (3 authority methods + setter present).
Backend after fixes: **632 passing**, 0 failures (then 635 with S6c).

**Step 3 pre-checks:** (a) `ReportControllerTest` 9 → 8 — removed
`hrPlanningScope`/`financeTreasuryScope`/`adminAndDirectorFullAccess` (retired
HR/FINANCE/DIRECTOR, legacy-removal #6), replaced by
`supervisorForbiddenEverywhere` + `adminFullAccess`. (b) Prod bundle greps all
0 (`signInDemo`, `installMockApi`, `demo@`, `Demo#2026`); seeder OFF by default
(profile + flag + empty password, exact switch-on in `.env.example`); smoke
script re-run (no live backend: UNREACHABLE probes; password guard is
fail-fast `${SMOKE_HR_PASS:?...}`). (c) Audit rows re-graded with this
evidence.

**Step 4:** S6a proven 15/15 (`StaffCandidateLifecycleIntegrationTest`, names
in audit §3 row); S6b proven — rule name + deliberate-violation run above,
reserved rejections (`reservedTransitionsAreRejected`: UNDER_VALIDATION→
VALIDATED, VALIDATED→RECEIPT_ISSUED), zero-reference greps in legacy-removal
#19.

**Step 5 S6c:** backend `BulkTaskResponse.items` per-item summary + single
`DELETE /tasks/{taskId}`; `TaskBulkAtomicityIntegrationTest` (3, green);
Angular `features/tasks/` workspace on `/tasks` (grouped by student, 22 new
specs); placeholder route deleted with grep proof (legacy-removal #21).

**Final gates (full runs):** backend **635** passing / 0 failures (ArchUnit
green); Angular typecheck green, **327** tests / 46 files green, prod build
green; Flutter 134 +1 skipped, analyze clean; Python 16; Next `tsc` + build
green. Next slice: S7 (validation queue/detail, python-ai adapter, manual
decisions, receipt) on top of the RESERVED enforcement.

### 2026-10-02 — S7 Internship Validation + receipt completed (all gates green)

**Step 1 gates (before any change):** backend **635** / 0 (BUILD SUCCESS);
Angular typecheck green, **327** tests / 46 files, prod build green; Flutter
analyze clean, 134 +1 skipped; Python 16; Next `tsc` + build (73 pages) green.
Exact baseline match — no drift since S6.

**Pre-check (a) — ArchUnit vacuity, all four rules bite.**
Temporary violating classes (deleted afterwards), each failing exactly its rule
on a `clean` run: `candidate.application.TempAuthorityViolatorBean` →
`onlyTheLifecycleAuthorityWritesInternshipStatus` (names the `setStatus` call);
`internship.interfaces.rest.TempUnsecuredController` (bare `@GetMapping`) →
`controllerEndpointsMustBeSecuredOrDefaultDenied`; `internship.application.
TempCleanViolator` (app → infra repo) → `cleanArchitectureLayersRule`;
`ai.application.TempAiViolator` (ai → `InternshipService`) →
`aiMustNotDependOnMutationServices`. After deletion all 4 suites green (9
tests). **Restored check:** S6b had converted the reverse guard
`theAuthorityDoesWriteInternshipStatus` to a plain unit test because the
parameterless `callMethod` never matches a Lombok setter; it is an `@ArchTest`
again with the explicit `InternshipStatus` parameter — green, and it failed
together with the main rule on the temp violator, so the check is strictly
stronger than the plain test (no weakening).

**Pre-check (b) — bulk ADD + EDIT across students.** Backend already executed
all three actions atomically, but only CREATE/DELETE paths were proven and the
workspace only offered bulk delete. Added `TaskBulkAtomicityIntegrationTest.
bulkUpdateAcrossStudentsSucceedsWithPerItemSummary` (UPDATE on two students,
per-item `UPDATE` summary, titles persisted) — which immediately found a REAL
NPE: `CompanionService.updateTask` built its audit map with `Map.of` on a
nullable `assignedToId` (fixed with `LinkedHashMap`, same E2 pattern as
`createTask`). Angular gained bulk-add (one CREATE per checked student) and
bulk-edit (one UPDATE per selected task) dialogs, each with its own
idempotency key + per-item summary (+3 specs). Backend 635 → 636, Angular
327 → 330 at the end of the pre-checks.

**Pre-check (c) — certificate VALIDATED gate.** Kept + documented as audit
assumption #17 (409 `INTERNSHIP_NOT_VALIDATED` for approved-but-not-validated,
replacing the 422 `INTERNSHIP_NOT_COMPLETED`; VALIDATED → 201). Updated
`StateMachineRejectionTest.certificateRequiresApprovedValidation` and the
`FinanceCertificateIntegrationTest` certificate guard — no method deleted.

**S7a backend (V45 `validation_verification_runs` + `validation_decisions`).**
- Submission (A8): `CompanionService.submitDeliverable` moves IN_PROGRESS →
  REPORT_SUBMITTED through the authority on the first submission only, and
  publishes `InternshipReportSubmittedEvent` → Admin role fan-out (supervisor
  + intern come from the lifecycle event itself).
- Queue/detail Admin-only (`InternshipValidationService` + controller,
  Supervisor → 403): paged JPQL with explicit joins, q/status/supervisor/
  university/type, sort whitelist, size clamp; detail = candidate, supervisor,
  tasks + shared `TaskCompletionPolicy` ratio (done = APPROVED, denominator
  excludes CANCELLED), both documents with authorized download.
- AI adapter: `DocIntelClient.verifyReport/verifyJournal` + strict
  `{overall, checks[]}` parsing in `PythonDocIntelClient` (token/timeout/
  retry/circuit unchanged; 401 → `AI_UNAVAILABLE` without tripping the
  circuit). Application code depends only on the `ai.domain.client` port —
  AiIsolation green.
- Runs persisted every time (PASS/FAIL/INCONCLUSIVE + `degraded` flag);
  degraded runs never block manual decisions or receipts.
- Decisions (`ValidationDecision`, comment mandatory on REJECTED else 422):
  first decision REPORT_SUBMITTED → UNDER_VALIDATION; REJECTED returns
  UNDER_VALIDATION → REPORT_SUBMITTED (new explicit table edge, assumption
  #18); both VALIDATED → VALIDATED. The backend never had a
  ValidationDecision → ApprovalDecision translation (verified by grep —
  closed as specified).
- Receipt: `FinanceService.generateValidationReceipt` (VALIDATED only, else
  409; amounts + TND from `PaymentCalculationService` — A7 fallback unneeded;
  NO finance-case approval and NO certificate precondition, unlike the case
  flow), idempotent by existing-receipt return + idempotency scope, unique
  `PAY-…` reference, snapshot persisted, then VALIDATED → RECEIPT_ISSUED via
  the authority. Reprint = same call, same reference.
- Tests (Testcontainers): `PythonDocIntelVerificationTest` (6: pass, fail,
  inconclusive, non-conforming, unreachable, bad-token) +
  `InternshipValidationApiTest` (9: submission + notifications, queue/filters/
  paging + 403s, detail aggregate, AI pass + degraded + ratio inputs,
  first-decision opens, reject-returns + both-validated, idempotent receipt,
  receipt guards, generic-endpoint still 422). Matrix updated for the new edge
  (`UNDER_VALIDATION,REPORT_SUBMITTED` row; one `StateMatrix409Test` probe of
  that pair removed as now-valid). Backend 636 → **651**.

**S7b Angular (`features/validation/`, Admin-only `/validation` +
`/validation/:id`, `VALIDATION_MANAGE` permission + nav, Supervisor hidden and
guard-redirected).** List (server filters/paging), detail (candidate, tasks +
ratio, report/journal preview via blob iframe + download + print, per-check AI
results, degraded banner, per-document verify action, manual decision dialog
with mandatory rejection comment, receipt generate/reprint gated on both
VALIDATED). Legacy decision path removed (`executeInternshipTransition`,
`recordValidationDecision`, detail dialog + logic, `activate/complete` rewired
to `status-transitions`, 9 orphaned `validation.*` keys — legacy-removal #22;
`isValidated()` is now the explicit §4 status). Specs: api-client-validation
(7), validation.service (4), validation-list (3), validation-detail (6),
auth guard/nav (3). One order-flake caught and pinned (French specs pin `fr`
like S5). Angular 330 → **353** (50 files), typecheck + prod build green,
bundle greps still 0.

**Final gates (full runs):** backend **651** / 0 incl. ArchUnit;
Angular **353** / 50 files, typecheck + prod build green; Flutter 134 +1
skipped, analyze clean; Python 16; Next `tsc` + 73-page build green.
Next slice: **S8 certificates** (workspace + PDF content/eligibility on the
VALIDATED gate, assumption #17).

### 2026-10-03 — S8 certificates + S9 notifications/audit (all gates green)

**Step 1 gates (before any change):** backend **651** / 0; Angular typecheck
green, **353** / 50 files, prod build green; Flutter analyze clean, 134 +1
skipped; Python 16; Next `tsc` + 73-page build green. Exact baseline match.

**Pre-check (a) — single receipt path.** Grep found two orchestrations sharing
one renderer: `doApprove → issueReceipt` (finance-case approval) and
`doGenerateValidationReceipt → issueReceipt` (S7). Routed both through the new
`issueOrReuseReceipt` (existing receipt returned, else render + persist), so
exactly ONE core mints receipts — a single `new PaymentReceipt(` site,
`issueReceipt` with one caller, `issueOrReuseReceipt` with two. Recorded as
audit assumption #19 (no finance-case approval precondition) + legacy-removal
#24. No endpoint/status/precondition changed.

**Pre-check (b) — receipt PDF content.** Extended `receiptIsIdempotent`:
downloaded PDF text holds the `PAY-…` reference, candidate name, internship
type, amount and `TND`; a second download returns byte-identical text (same
stored file).

**Pre-check (c) — audit entries.** New `ValidationAuditTrailTest` (5,
Testcontainers): submission (DELIVERABLE_SUBMITTED + INTERNSHIP_STATUS_CHANGED
with the intern as actor), AI runs incl. degraded (AI_VERIFICATION_RUN),
both decision codes with actor/document/comment, VALIDATED + PAYMENT_RECEIPT_
ISSUED + reprint download audit, and a no-secrets sweep over the payloads.

**Pre-check (d) — rejection path.** New `DocumentRejectedEvent` → candidate
notification WITH the comment (`NotificationEventListener.
onDocumentRejected`); backend `rejectionNotifiesCandidateWithComment`
(candidate got "Add week 4", resubmission completes to VALIDATED); Flutter
`messaging_widget_test` gains "document rejection shows the rejection comment
to the intern" (notifications screen renders the comment).

**Pre-check (e) — python real-file contracts.** `analysis.py` gained FR/EN
period tolerance (`_period_candidates`: ISO, FR numeric/long incl. `du/au`,
EN long incl. `from/to`) and order-tolerant names (`name_present`) for the
candidate/supervisor checks — real gaps the new tests pin. New
`tests/test_verification_files.py` (12, all through the live FastAPI app on
generated PDFs): 7/7 pass, each check failing alone, 3-vs-4 pages,
scanned→INCONCLUSIVE, accents + reversed order, FR/EN dates, journal 75 vs 74,
wrong period, missing task table, golden-fixture equality. New shared
`tests/fixtures/verification_contract.json` (generator script beside it) +
backend `sharedFixtureResponsesAreAccepted` replays the same bytes through the
strict parser. Python 16 → **28**.

**S8 backend (V46 `version_number` + `certificate_versions` + reference
sequence).** Admin-only list/detail/regenerate/revoke/versioned download;
VALIDATED eligibility (assumption #17); regeneration appends a version row
(reference stable); revoke = REVOKED + audit (re-generate allowed after).
`CertificateManagementApiTest` (7): PDF fields, eligibility both ways,
version history, delete audit + re-generate, Supervisor 403s, list paging/
search/filter, concurrent unique refs — the last found a REAL race
(count-based cert AND document references), fixed with a sequence +
deterministic `DOC-<ref>-v<n>` (legacy-removal #25, dead port methods
deleted). Backend 651 → 658 here.

**S8 Angular (`features/certificates/`, `/certificates`, `CERTIFICATE_MANAGE`,
Admin-only nav/guard + specs).** List (server paging/search/status), generate
picker over VALIDATED internships, detail (preview/download/print, version
history, per-version download, edit-regenerate, confirmed revoke). Specs:
api-client-certificates (6), certificates.service (4), list (5), detail (4),
auth guard/nav (3). The internship-detail certificate card stays as the entry
point (same live endpoints — complementary, not legacy).

**S9 backend (V47 `audit_logs.source`).** `AuditSource` enum;
`AuditService.log` takes a channel (default BACK_OFFICE) + central recursive
redaction; explicit MOBILE (intern deliverable/journal writes),
FRONT_OFFICE (anonymous intake), AI (verification runs), SYSTEM (dead
letters); combinable `AuditQuery` search (source/entity/date included);
`AuditAppendOnlyFitnessTest` (3 ArchUnit rules + port-vocabulary test);
`AuditRedactionTest` (3, pure); `NotificationCenterIntegrationTest` (4:
independent reads + foreign 404, STOMP routing via recording port,
reassignment recompute, out-of-scope invisibility);
`StompRealtimeNotifierTest` (2, mockito);
`AuditSearchIntegrationTest` (3: combinable filters, Admin-only, source in
detail). Backend 658 → **682**.

**S9 Angular.** `realtime-protocol.ts` extraction (identical behavior) +
`realtime-protocol.spec` (7: mappings, unknown, malformed survival, backoff
caps, socket-drop classification); audit viewer gains source/entity/date
server filters + source display (query spec +2). Angular 375 → **383**
(55 files), typecheck + prod build green, bundle greps 0.

**Final gates (full runs):** backend **682** / 0 incl. ArchUnit;
Angular **383** / 55 files, typecheck + prod build green; Flutter 135 +1
skipped (134 + widget test); Python **28**; Next `tsc` + 73-page build green.
Next slice: **S10 Gemini** (task drafts + chatbot, §7.4–7.5).

### 2026-10-04 — pre-checks (a)–(g) closed, clean slice boundary (all gates green)

**Step 1 gates (before any change):** backend **682** / 0 (clean run), Angular **383** / 55 files +
typecheck + prod build green, Flutter 135 +1 skipped, Python **28**, Next `tsc` + 73-page build green.
Exact baseline match, reported before touching anything.

**Pre-check (a) — no receipt before validation.** New `ReceiptValidationGateTest` (2, Testcontainers):
`financeApproveCannotIssueReceiptBeforeValidation` (finance case READY_FOR_DECISION + full dossier +
payment workflow, internship tampered to UNDER_VALIDATION → `approve` throws **409
`RECEIPT_BEFORE_VALIDATION`**, nothing minted, case not APPROVED) and `noReceiptBeforeValidation`
(VALIDATED → exactly one receipt on that case; tampered to IN_PROGRESS → 409
`INTERNSHIP_NOT_VALIDATED`, same single receipt still there). The old `doApprove` path was NOT deleted:
it routes through the single core `issueOrReuseReceipt`, which now holds the gate, so no path —
today's two or a future third — can mint a receipt below VALIDATED.

**Pre-check (b) — S8/S9 Angular accounting, file by file.** Reconstructed from the live green run
(56 files / 385) with `git status` showing **zero deleted files** in `steg-back-office`:
S8 353→375 = +22 = `api-client-certificates.spec.ts` 6 (NEW) + `certificates.service.spec.ts` 4 (NEW)
+ `certificate-list.component.spec.ts` 5 (NEW) + `certificate-detail.component.spec.ts` 4 (NEW) +
`auth.spec.ts` +3 (certificates guard/nav). S9 375→383 = +8 = `realtime-protocol.spec.ts` 6 (NEW) +
`audit-viewer.component.spec.ts` +3 (source/entity/date filters, source display, append-only history —
the tracked file's `git diff` shows exactly those three added `it()` blocks). The file-level sum is
**+31, one above the ledger's "+30"**: the S9 note had recorded audit-viewer as "+2"; the ledger
number was wrong, no test was deleted (recorded as audit assumption #24).

**Pre-check (c) — socket drop → reconnect → unread refresh.** New Angular `core/realtime-reconnect.spec.ts`
(2). `RealtimeService` gained a `reconnected$` signal that fires only when `reconnectAttempts > 0`, and
`TopbarComponent` refreshes the unread count on it. Fake stomp `Client` (via `vi.hoisted` + `vi.mock`)
proves: drop → `disconnected`, `reconnectDelay` 1000→2000→4000, re-connect → every destination
re-subscribed (`/user/queue/notifications` twice), `reconnected$` fires once and NOT on first connect;
badge refetches 3→5 after a reconnect and does not refetch on the first connect. Angular 383 → **385**.
(Fixed a strict-TS `noUncheckedIndexedAccess` error on `stomp.instances[0]` with a non-null helper.)

**Pre-check (d) — real WebSocket delivery.** New `NotificationWebSocketIntegrationTest` (1):
`@SpringBootTest(RANDOM_PORT)` + real `WebSocketStompClient`, JWT handshake, two supervisors subscribed to
`/user/queue/notifications`. A's internship transition reaches A only (`relatedEntityId` matches); the
out-of-scope supervisor B receives **nothing**; B's own internship transition then DOES arrive on B's
live session and A gets nothing — so the empty inbox is isolation, not a dead socket. Verified first that
`UsernamePasswordAuthenticationToken(UserPrincipal).getName()` resolves to the email (Spring Security 7
falls through to `java.security.Principal.getName()`), which is why the user destination matches the email
`StompRealtimeNotifier` publishes under.

**Pre-check (e) — audit source provenance.** New `AuditSourceOriginIntegrationTest` (3, Testcontainers)
drives the real endpoints and asserts the persisted `audit_logs.source` column (the old evidence only
filtered rows seeded directly through `AuditService.log`): intern deliverable create+submit → MOBILE,
public anonymous intake → FRONT_OFFICE, admin advisory verify → AI.

**Pre-check (f) — §8 recipient row restored, §4 mustChangePassword flipped.** §8 row's full requirement is
restored ("recipients resolved through `SupervisionScopeService` for EVERY event type; OK only with a test per
event type") and every handler is now mapped to a named passing test. Three event types had none — NEW
`NotificationRecipientCoverageIntegrationTest` (3): `assignmentNotifiesInternAndSupervisor`,
`documentVerificationNotifiesTheCandidate`, `validatedWithoutFinalEvaluationAlertsAdmins`.
**That last test exposed a real production bug:** `FinalEvaluationWatchListener` was a
`@TransactionalEventListener(BEFORE_COMMIT)` that published a second transactional event; Spring snapshots
the synchronizations before running the BEFORE_COMMIT callbacks, so `onFinalEvaluationRequired` never ran
and the admin alert only surfaced on the hourly sweep. Now a plain `@EventListener` (assumption #22).
§4 `mustChangePassword` flipped PARTIAL → OK: both client tests exist and pass — Angular
`error.interceptor.spec.ts → does not loop when the failing request is the change-password call itself`,
Flutter `test/session_gate_test.dart → password-change-required callback shows ChangePasswordScreen`.

**Pre-check (g) — rejection → resubmission.** Confirmed in `InternshipValidationApiTest.rejectionNotifiesCandidateWithComment`:
a REJECTED decision returns the internship to **REPORT_SUBMITTED**, notifies only the candidate WITH the
comment ("Add week 4"), and the resubmitted deliverable then completes the flow to VALIDATED.

**Two suite-wide failures found by the full clean run and fixed (not skipped):**
1. `ReceiptValidationGateTest` counted a global `countByReferencePrefix("PAY-")`; the shared Testcontainers
   DB holds receipts from the other finance tests, so it must be scoped to its own case
   (`findByFinanceCaseId`) — the test was wrong, not the code.
2. `CandidateWorkspaceIntegrationTest.filtersNarrowTheQueueServerSide` used JVM-local `LocalDate.now()` while
   `CandidateWorkspaceService` evaluates `from`/`to` with `atStartOfDay(ZoneOffset.UTC)`. Between 00:00 and
   01:00 local (+01:00) "today" local is still "yesterday" UTC, so the window was in the future and the
   count was 0 — a pre-existing latent midnight flake (assumption #23). The test now computes its bounds in
   UTC; the UTC reading of the filter is unchanged.

**Final gates (full runs, this slice):** backend **691** / 0 (clean run; ArchUnit green);
Angular **385** / 56 files + typecheck + prod build green; Flutter 135 +1 skipped; Python **28**;
Next `tsc` + 73-page build green.

**Next slice: S10 Gemini** (§7.4 task-generation drafts behind the AI ports with a V48 migration and an
atomic role-scoped bulk add; §7.5 role-scoped chatbot with curated knowledge, bounded history, rate limit
and an unavailable state) — NOT started in this turn. After S10: **S11 dashboards**.

### 2026-10-04 — Pre-fixes (a)-(c) + S10a AI task drafts backend completed

**Gates first (exact counts, matching the brief baseline):** backend **691**,
Angular **385** (56 files), Flutter **135** (+1 skipped), Python **28**, Next
`tsc` + 73-page build green.

**(a) Time zone.** New `steg.timezone` / `APP_TIMEZONE` (default Africa/Tunis)
+ `common.application.ApplicationTimeZone`; used by candidates (replaces
`ZoneOffset.UTC`), applications (server-stamped `submissionDate`), audit (new
`fromDate`/`toDate`, absolute Instants unchanged), notifications (new
`fromDate`/`toDate` on own deliveries); Angular audit viewer sends calendar
days. UTC probes UPDATED to Tunis probes (legacy-removal #28) + NEW boundary
tests proving a 00:30-Tunis filter returns 00:10 rows
(`tunisDayBoundaryIncludesEarlyMorningRows`, audit + notification twins,
`ApplicationTimeZoneTest` 4). Recorded as audit assumption #25 (supersedes #23).

**(b) Validated-candidate notification.** `CandidateValidatedEvent` published
on self-registration AND staff-profile claim (never on staff creation);
`onCandidateValidated` fans out to ADMIN only with the (`Candidate`, id) deep
link, dedupe `CANDIDATE_VALIDATED:<id>`, audited `CANDIDATE_VALIDATED`.
`CandidateValidatedNotificationIntegrationTest` (2): recipient, deep link, no
duplicate on replay. The shared-DB fan-out lesson is asserted in-test (scope
exactly-once assertions to the test's own admin).

**(c) Foundation re-grade.**
- method-security → OK: rule
  `MethodSecurityFitnessTest.controllerEndpointsMustBeSecuredOrDefaultDenied`,
  deliberate-violation proof (temp `TempSecurityViolatorController.open`
  failed the rule by name, deleted afterwards), 27 controllers covered, 9
  `@PublicEndpoint` methods enumerated.
- exactly-Admin-and-Supervisor → OK: new staff-only
  `POST /api/auth/back-office-login` (403 + audited refusal otherwise),
  `BackOfficeLoginContractTest` (5); Angular posts to it (URL + 403 tests).
  Two-list fix included: `JwtAuthenticationFilter.isPublicEndpoint` needed the
  path too (was 401 before `SecurityConfig`), pinned by
  `PublicEndpointConsistencyTest` + new `everyPublicEndpointAnswersAnonymously`.
- backend-authoritative → OK: full Angular→backend sweep — no bypass found;
  Angular-only items justified (tones/truncation/regex/10-char-UX-minimum with
  backend non-blank 409, preselect/canConfirm, drill-down params, page-level
  finance filter by design, password ephemerality, display TZ).
- client compatibility → OK: the four client gates plus the Next build, all
  green (additive contracts only).

**S10a.** As planned above: V48, `AiTaskDraftService` behind
`AiCompletionClient` (AiIsolation green), `GEMINI_MODEL` from env with NO
hard-coded default (legacy-removal #30; blank model degrades), fake-Gemini
integration tests only (14/14), metadata-only audit (6 new actions in the
checklist). No chatbot, no Angular draft UI started.

**Final gates (full runs, this slice):** backend **720** / 0 (`clean test`;
ArchUnit CleanArchitecture + AiIsolation + MethodSecurity green); Angular
**387** / 56 files + typecheck + prod build green; Flutter 135 +1 skipped;
Python **28**; Next `tsc` + 73-page build green.

**Rows flipped to OK:** §1 exactly-Admin-and-Supervisor, method-security,
backend-authoritative, other-clients-compatible; §3 new-validated-candidate;
§5 AI-drafts-only + draft-bulk-add; §9 Gemini-adapter. **Still not OK:**
dashboards (S11), chatbot (S10b), scenarios A/B/C (S12), Angular draft-review
UI (S10 scope).

**Next slice: S10b chatbot** (§7.5: curated knowledge file, role identity,
live scoped lookups, bounded history, rate limit, unavailable state) + the
Angular draft-review UI for the S10a drafts. Stop: clean slice boundary, no
commit, no push.

### 2026-10-04 — S10b role-scoped chatbot backend completed

**Gates first (exact counts, matching the S10a baseline):** backend **720**,
Angular **387** (56 files) + typecheck + build green, Flutter **135**
(+1 skipped), Python **28**, Next `tsc` + build green (73 pages).

**S10b.** Backend only, per brief (no Angular started):
- Curated `steg-backend/src/main/resources/assistant-knowledge.md` (STEG
  context, roles, capability matrix, workflows, approval/credentials/tasks/
  validation/certificate/notification/audit/AI/security rules; no secrets),
  loaded at startup by `ai.infrastructure.knowledge.AssistantKnowledgeLoader`
  (fail-fast on empty); pure `ai.domain.chatbot.ChatbotSystemPrompt` injects
  knowledge + caller role/identity + tool specs + safety policy.
- Function-calling loop in `ai.application.ChatbotService` behind the SAME
  `AiCompletionClient` port (AiIsolation green, full `clean test`): strict-JSON
  `tool_calls` envelope, max 3 rounds, tool results as delimited DATA.
  Tools run OUTSIDE ai.* (`internship.application.chatbot.
  ScopedChatbotToolRunner` implements the `ai.domain.chatbot.ChatbotToolRunner`
  port) through `SupervisionScopeService` — Admin global, Supervisor own scope,
  out-of-scope answers "not found" with no existence leak. Five read-only
  whitelisted tools, outputs capped, never CIN/credentials/tokens/contacts.
- History per user server-side (V49 `ai_chat_messages`, latest 20 kept,
  10 in prompt, owner-only read/clear, no user-id parameter anywhere).
- `POST /api/ai/chatbot/query` (+ `GET`/`DELETE /history`), ADMIN/SUPERVISOR
  only, `@RateLimited(ai-chatbot, 20/60)`; AI failure → friendly FR unavailable
  answer (HTTP 200, `degraded=true`); every use audited metadata-only
  (`AI_CHATBOT_QUERIED`, clears as `AI_CHATBOT_HISTORY_CLEARED`; never content).
- Tests use a scripted fake Gemini (`FakeGeminiConfig`, `@Primary` mock) with
  scripted tool-call sequences, including hostile text inside tool DATA:
  `ChatbotIntegrationTest` (11) + prompt/knowledge/loader unit tests (8).
  Real API never called.

**Final gates (full runs, this slice):** backend **739** / 0 (`clean test`;
720 + 19 new; ArchUnit CleanArchitecture + AiIsolation + MethodSecurity green);
Angular **387** / 56 files + typecheck + prod build green (untouched);
Flutter 135 +1 skipped; Python **28**; Next `tsc` + 73-page build green.

**Rows flipped to OK:** §9 chatbot knowledge/role-lookups (was MISSING).
**Still not OK:** dashboards (S11), scenarios A/B/C (S12), Angular chatbot UI
+ draft-review UI (S10c).

**Next slice: S10c Angular** (chatbot UI + draft-review UI for the S10a
drafts). Stop: clean slice boundary, no commit, no push.

### 2026-10-04 — S10c Angular draft-review workspace + chatbot panel completed

**Gates first (exact counts, matching the S10b baseline):** backend **739**,
Angular **387** (56 files) + typecheck + build green, Flutter **135**
(+1 skipped), Python **28**, Next `tsc` + build green (73 pages).

**S10c(1) — draft review workspace** (`features/tasks/draft-review.component.ts`,
route `tasks/drafts` behind `permissionGuard(['TASK_MANAGE'])`, entry button
in the Tasks workspace header): PDF upload for one reference student (PDF-type
pre-check, backend enforces magic bytes), draft list with manual edit / AI
revise-from-instruction / delete-with-confirm, manual add (works when AI is
down), student multi-pick and atomic bulk-add with per-item results
(`ok/n OK`) plus same-key reuse when retrying a failed bulk-add (replay, not
duplicate). Every student picker is fed from scope-safe
`GET /api/internships` — Admin sees all, a supervisor's picker shows only his
own students (no client scope parameter exists); scope/validation/atomicity
stay backend-owned. New `TaskDraftsService` facade (transport only +
`AI_UNAVAILABLE` detector + envelope readers); 11 `ApiClient` methods;
`TaskDraft`/`ManualDraftBody`/`UpdateDraftBody`/`ReviseDraftBody`/
`BulkAddDraftsBody`/`DraftBulkItem`/`BulkAddDraftsResult`/`ChatbotResponse`/
`ChatMessage`/`ChatHistory` models; `drafts.*` + `tasksWs.aiDrafts` +
assistant keys in fr/en/ar.

**S10c(2) — chatbot panel** (`features/ai/assistant-panel.component.ts`,
mounted in the shell for authenticated staff — back-office login admits
ADMIN/SUPERVISOR alone): server history on first open (lazy, never on shell
boot; load failure never blocks chatting), send with loading state,
degraded-answer note, layered fallback (S10b chatbot → legacy
`queryAssistant` → deterministic local rules → error state + retry of the
last question) and server-side clear that keeps the log on failure. No second
panel, no dead code: `queryAssistant` stays the middle fallback (still
spec-pinned). New `ChatbotService` facade.

**Specs (+48: 387 → 435, 56 → 61 files):** `api-client-ai.spec.ts` (10:
multipart shape, params, idempotency header, chatbot routes),
`task-drafts.service.spec.ts` (9), `draft-review.component.spec.ts` (15:
scoped pickers, PDF gate, pre-HTTP validation, unavailable flagging, bulk key
reuse, per-item rendering, error states), `chatbot.service.spec.ts` (4),
`assistant-panel.component.spec.ts` (9: history-once, degraded note, fallback
chain, error + retry, clear success/failure, empty-send guard),
`task-list.component.spec.ts` (+1 drafts link; + stub-router provider for the
new RouterLink). Two harness fixes on the way: RouterLink needs a stub router
in component specs; DOM-text specs pin `setLocale('fr')` (other spec files
mutate the shared stored locale).

**Secrets proof (required):** `grep -rniE` for `AIza…`/`GEMINI_API_KEY`/
key patterns → **0 hits** in `src/app`, `src/environments` AND the production
bundle `dist/steg-back-office/`; "Gemini" appears only in two pre-existing doc
comments (no URLs, keys or model names). No backend change, no shared-contract
change, no other client touched.

**Final gates (full runs, this slice):** backend **739** / 0 (re-run,
untouched); Angular **435** / 61 files + typecheck + prod build green
(3 consecutive green runs after the locale pin); Flutter 135 +1 skipped;
Python **28**; Next `tsc` + 73-page build green.

**Rows flipped to OK:** none — S10 rows already OK; S10c evidence appended to
the §5 drafts row and §9 chatbot row. **Still not OK:** dashboards (S11),
scenarios A/B/C (S12). No legacy-removal entry (no test/behavior removed).

**Next slice: S11 dashboards** (dedicated scoped endpoints 8.3). Stop: clean
slice boundary, no commit, no push.

### 2026-10-04 — S11 dashboards completed (after pre-checks (a)–(d))

**Gates first (exact counts, matching the S10c baseline):** backend **739**,
Angular **435** (61 files) + typecheck + build green, Flutter **135**
(+1 skipped), Python **28**, Next `tsc` + build green (73 pages).

**Pre-check (a) — back-office login: contract gap found and closed.**
Angular already posted to `/api/auth/back-office-login` (code + 3
`e9-components.spec.ts` URL pins), but the "staff only" message was dead: the
login screen mapped `error.message === 'BACK_OFFICE_DENIED'`, a literal the
backend never sent (generic 403 envelope instead). Fix (backend-authoritative):
new `iam/domain/exception/BackOfficeAccessDeniedException` (extends Spring
`AccessDeniedException`, constant `ERROR_CODE`) + dedicated handler → 403 with
`error: "BACK_OFFICE_DENIED"`; client mapping extended to the `error` code
field (legacy message-field check kept). `BackOfficeLoginContractTest.
nonStaffRolesRefused` extended with `$.error == BACK_OFFICE_DENIED`; new
`login.component.spec.ts` (5: staff-only URL, CANDIDATE 403 → localized staff
message incl. DOM render, INTERN same, legacy message-field code, 401 mapping
intact). No switch needed (Angular was already on the endpoint). S10a's 2
untracked Angular tests were `api-client-c6 > sends calendar-day audit bounds
as fromDate/toDate…` and `e9-components > a server 403 from the staff-only
login leaves no session behind` (all specs are untracked in this repo).

**Pre-check (b) — legacy assistant fallbacks removed.** The panel showed a
fallback chain (chatbot → legacy endpoint → local rules); now exactly four
states (answer / loading / error + retry / unavailable). Deleted:
`ApiClient.queryAssistant`, one `api-client-supervision.spec.ts` test, the
panel's `askLegacy/askRuleBased` chain, and unrouted/unimported
`task-assistant.component.ts` (legacy-removal #31, grep proof). Rewritten
`assistant-panel.component.spec.ts` (8). `AiAssistantService` stays (insights
view). Full Angular suite + typecheck + build green after.

**Pre-check (c) — Gemini robustness with the fake client.**
- Chatbot envelopes: tolerant extraction added (`parseEnvelope`: full parse,
  else first-`{`/last-`}` substring covering fences + prose; `{"answer":…}`
  unwrapped instead of echoed raw) — truncated JSON still falls back verbatim,
  blank output still degrades (recorded in audit assumption #29 area / S11
  notes). New `ChatbotIntegrationTest` cases (9): `fencedToolCallEnvelopeIsHonored`,
  `proseAroundEnvelopeIsHonored`, `truncatedEnvelopeFallsBackToVerbatimText`,
  `emptyAnswerDegrades`, `malformedToolEnvelopeFallsBackToText`,
  `toolCallWithoutNameIsIgnored`, `answerEnvelopeIsUnwrapped`,
  `unknownToolIsRefusedAndFedBack` (+ no extra action), plus
  `rateLimitBucketsArePerUser` (B exhausted → 429, A still 200).
- Model unset: `GeminiCompletionClientTest.blankModelPerformsNoNetworkCall`
  (clear "model" error, zero requests, blank `AiProperties` default asserted —
  no hard-coded default).
- Timeout: `readTimeoutDegradesGracefully` (3 s hang vs 400 ms budget →
  failure, never throws).
- Specs-PDF caps: NEW 50-page cap (`SPEC_PDF_TOO_LONG`, audit #30) beside the
  existing MB cap; new `PdfBoxSpecPdfTextExtractorTest` (6: valid, non-PDF,
  oversize → TOO_LARGE, textless → EMPTY, 51 pages → TOO_LONG, 50 pages OK).
- Clear history: `historyClear` now also asserts repository row count zero.
- Retention rule documented in audit assumption #30.

**Pre-check (d) — S10a +29/+2 per-file accounting.** Backend (691 → 720):
`AiTaskDraftIntegrationTest` 14 (11 @Test + 1×3 param), `ApplicationTimeZoneTest`
4, `CandidateValidatedNotificationIntegrationTest` 2,
`BackOfficeLoginContractTest` 5 (1 + 2×2 param), `CandidateWorkspaceIntegrationTest`
+1 (`tunisDayBoundaryIncludesEarlyMorningRows`), `AuditSearchIntegrationTest` +1
(`tunisCalendarDayBounds`), `NotificationCenterIntegrationTest` +1
(`tunisCalendarDayBounds`), `PublicEndpointConsistencyTest` +1
(`everyPublicEndpointAnswersAnonymously`) = 29. Angular (385 → 387):
`api-client-c6 > sends calendar-day audit bounds…` + `e9-components > a server
403 … leaves no session behind` (both files untracked, like all specs here).

**S11 backend.** New `DashboardSummaryService` + 10 `ReportQueryRepository`
aggregates + `GET /api/reports/admin-summary` (ADMIN) /
`supervisor-summary` (ADMIN/SUPERVISOR; Admin sees global). Admin: pending
applications, new candidates (30d), tasks awaiting approval (COMPLETED),
reports awaiting validation (full map), receipts + ISSUED certificates,
workload incl. Admin, 6 Tunis-month trends. Supervisor: own candidates/tasks
(awaiting COMPLETED, overdue vs app-zone today on non-terminal), candidates by
internship status, unread + 5 recent IN_APP notifications. New
`DashboardSummaryIntegrationTest` (8, @Transactional rollback): global-vs-own
deltas, B-invisible-to-A, exact per-status maps incl. zeros, admin-in-workload,
soft-delete exclusion via real DELETE, empty-supervisor zeros, ordered trends
with bucket-sum == status-map-sum consistency, role gates (candidate 403×2,
anonymous 401×2, supervisor 403 on admin-summary). `HotPathQueryCountTest` +2
(measured 19/8 statements → caps 20/9). `ReportControllerTest` path lists
extended (supervisor test renamed: supervisor-summary stays open).

**S11 Angular.** `dashboard.component` + `supervisor-home.component` rewritten
on one summary call each (tiles + CSS `dist-bars`, loading/empty/error,
realtime reload); deleted `dashboard.service.ts` + `dashboard.service.spec.ts`
(legacy-removal #32; reports endpoints kept for the rule engine). New
`dashboard-summary.service.ts` (+spec 3). Deep links wired + arrival specs:
tasks status (+unknown-ignored), candidates from/to (+malformed-ignored),
validation status (+unknown-ignored), certificates status (+unknown-ignored),
applications preset (pre-existing); auth.spec +2 (dashboard nav per role,
TASK_MANAGE guard both roles). Angular +14 net (435 → 449, 61 → 63 files;
deleted service spec −5, deleted queryAssistant test −1, panel net −1).

**Final gates (full runs, this slice):** backend **766** / 0 (`clean test`;
739 + 27: chatbot +9, extractor +6, gemini +2, dashboard +8, hotpath +2;
ArchUnit green); Angular **449** / 63 files + typecheck + prod build green
(3 consecutive green runs); Flutter 135 +1 skipped; Python **28**; Next `tsc`
+ 73-page build green.

**Rows flipped to OK:** §9 Admin dashboard + Supervisor dashboard (both were
PARTIAL; persistence rows proven by Testcontainers tests). **Still not OK:**
scenarios A/B/C (S12). **Legacy removed:** #31 (assistant fallbacks +
task-assistant file + 1 spec test), #32 (dashboard service + spec).

**Next slice: S12a** (hardening part 1 — scenarios/suite to be scoped there).
Stop: clean slice boundary, no commit, no push.

### 2026-10-04 — S12a scenarios + acceptance run + live stack completed

**Gates first (exact counts, matching the S11 baseline):** backend **766**,
Angular **449** (63 files) + typecheck + build green, Flutter **135**
(+1 skipped), Python **28**, Next `tsc` + build green (73 pages). Exact
baseline match, reported before touching anything.

**S12a backend (new package `tn.steg.backend.acceptance`, no migration, no
production change except none):**
- `ScenarioAAdminSupervisesChainTest` (1): register → validate → submit →
  atomic approve (Admin preselected, `null` supervisor) → credentials
  no-store + recorded email with the same secret → login forces
  `PASSWORD_CHANGE_REQUIRED` → change → manual bulk-add to 2 students +
  fake-Gemini drafts bulk-added to both → intern completes →
  Admin notified → approve/deny-with-reason → IN_PROGRESS (via
  `status-transitions`) → report+journal → queue → fake python-ai PASS ×2
  → manual VALIDATED ×2 → certificate (while VALIDATED, gate #17) →
  idempotent `PAY-*` receipt → 16 audit codes with sources →
  admin-summary (`APPROVED ≥ 2`, `newCandidates ≥ 2`, `receiptsIssued ≥ 1`,
  workload Admin row ≥ 2) → no secret in audit. Three real defects found
  by the chain and fixed in TEST code (production behavior confirmed
  correct): missing APPROVED→IN_PROGRESS step, missing linked Employee
  for the receipt decider (`requireDecider` → 403 without it), certificate
  must precede receipt (VALIDATED-only gate). One expectation corrected
  with evidence: `COMPANION_TASK_STATUS_CHANGED` is BACK_OFFICE even for
  the intern (shared-endpoint rule, audit #20) — test now asserts that.
- `ScenarioBSeparateSupervisorTest` (1): create S (working login,
  `mustChangePassword`) → approve with S → S sees only own
  candidates/tasks, gets task notifications while Admin gets none →
  S 403 on supervisors-manage/validation-queue/receipt/certificates/
  approve → S 404 on foreign overview → Admin reassigns to himself →
  scope/notifications/`SUPERVISOR_REASSIGNED` follow.
- `ScenarioCFailureModesTest` (8, modal python-ai stub + throwing-mail
  mock): Gemini key missing → `503 AI_UNAVAILABLE` + manual fallback;
  python-ai down → `INCONCLUSIVE` degraded, manual completes; Brevo down
  → approve commits (`credentialEmailSent: false`), resend mints a NEW
  password; duplicate approve → `409` one internship; duplicate bulk →
  identical replay; invalid transitions (`409`/`422`); blank denials
  (`409`/`422`); scanned PDF → `INCONCLUSIVE`, manual completes.
- No test method deleted; no production code changed; no migration.
  Real APIs never called (fake Gemini, stub python-ai, mock mail).

**Smoke steps 7–9 rewritten** (`scripts/smoke-test.sh`): atomic approve,
`APPROVED → IN_PROGRESS`, supervisor-link verification (legacy
`/internships/manual` + `→ ACTIVE` flow gone). Two script bugs fixed:
login probes matched literal `null` (false PASS → `// empty`),
`JOURNAL_ID` unbound under `set -u`.

**Live stack run (this machine, Docker OK):** postgres 17 + backend
(`integration` + temp seed overlay `docker-compose.smoke-tmp.yml` — the
root compose does not forward `STEG_SEED_DEMO_*`, found by the first red
run) + python-ai, all healthy; smoke **21 passed, 1 failed**: step 11
(journal validate `403`) fails on an outdated expectation — the seeded
supervisor supervises nothing (approval defaults to the Admin), so scope
enforcement correctly refuses. Stack left RUNNING for the operator's
manual replays (A18/A19/B8/B9/C9); local-only `.env` (chmod 600, random
dev values, never printed) + tmp overlay are untracked helpers.

**Rows flipped to OK:** §10 scenarios A/B/C (audit evidence named per
test). **Product gaps (not failures, audit #31):** certificate
`GENERATED → ISSUED` never written (dashboard tile 0 by construction);
smoke step 11 expectation outdated.

**Final gates (full runs, this slice):** backend **776** / 0 (`clean
test`; 766 + 10; ArchUnit CleanArchitecture + AiIsolation +
MethodSecurity green); Angular **449** / 63 files + typecheck + prod
build green (re-run at baseline, untouched); Flutter 135 +1 skipped;
Python **28**; Next `tsc` + 73-page build green.

**Next slice: S12b** (security review §10, final legacy-removal proof,
§14 checklist). Stop: clean slice boundary, no commit, no push.

### 2026-10-04 — S12b security review + legacy proof + checklist completed

**Gates first (exact counts, matching the S12a baseline):** backend **776**,
Angular **449** (63 files) + typecheck + build green, Flutter **135**
(+1 skipped) + analyze clean, Python **28**, Next `tsc` clean. Exact
baseline match, reported before touching anything.

**Security review (new `docs/security-review.md` with the 196-row endpoint
table: method + path + authorization + rate limit, parsed from sources):**
- `security/AdminOnlyEndpointSecurityTest` (140 probes): all 70 admin-only
  endpoints → 403 Supervisor / 401 anonymous. Three body-shape misses found
  by the first red run (finance docs attach is JSON not multipart; employees
  need `departmentId`) — test-side fixes, production correct.
- `security/SecurityHardeningTest` (8): spoofed/empty uploads refused, real
  PDF 201, download owner-200/anon-401/foreign-403; CORS grants only
  :3000/:4200; `nosniff` + DENY headers (HSTS is https-only); logout → 204
  with refresh reuse rejected; 11th identifier-validation call → 429;
  seeder off by default (no bean, no profile, property false); log scan
  over a credential-bearing flow finds no password/token/CIN/email.
  The 429 probe initially polluted the shared-JVM anonymous bucket and
  broke `PublicEndpointConsistencyTest` in the full run — fixed by
  per-user isolation + aspect-window reset in `finally`.
- Production fixes: 8 email-carrying log lines redacted to `userId=`;
  `DOC-*` reference minting gained the exists-retry loop (#25 race class);
  root `.env.example` secrets replaced with placeholders.
- New `steg-backend/README.md`: run / test / configure (Gemini,
  python-ai, Brevo, time zone, seeder switch, CORS, uploads).

**Migrations (new `migration/MigrationChainIntegrationTest`, raw Flyway, 2):**
empty DB → V49 clean (49 migrations, slice tables + columns + APPROVED
default); V33 + legacy rows (HR holder, ACCEPTED/NEEDS_CORRECTION apps,
PLANNED/ACTIVE unsupervised internships) → latest with HR→ADMIN,
explicit statuses, supervisor backfilled to the oldest admin (V27 seed),
zero legacy rows. V34..V49 purposes listed in `security-review.md` §3.

**Legacy final proof:** every removal-doc grep re-run green. Two S6a-era
items clarified (not regressions): `nationalId` in the candidate list is
the staff-create CIN field (rows stay CIN-free); the `AccessDeniedException`
in `CandidateService.resolveManager` is the documented 403 probe-guard.
New findings fixed: stale `ACCEPTED`/`ADMIN/HR`/`COMPLETED`-step wording
(fr/en/ar + comments), and **#33** — the internship workflow-history
client path calling the S6b-deleted endpoint (removed method, bundle
branch, `ValidationState`/`deriveValidationState` + 7-test spec file,
timeline tab, 9 orphaned keys; `listWorkflowActions` stays — live
application workflow). Deleted tests logged in #33 with replacements.

**Cross-client:** Next `tsc` + 73-page build green; Flutter analyze clean,
135 +1 skipped, `flutter build apk --debug` → app-debug.apk;
Angular typecheck + prod build green, `dist/` greps 0
(`signInDemo`/`demo@`/`Demo#2026`/key patterns).

**Rows:** audit has zero non-OK rows (grep); §10 scenarios stay OK;
assumption #32 added; stale remediation item 8 closed; §14 checklist with
evidence appended to `docs/acceptance-run.md`.

**Final gates (full runs, this slice):** backend **926** / 0 (`clean
test`; 776 + 150; ArchUnit green); Angular **441** / 62 files +
typecheck + prod build green; Flutter 135 +1 skipped + analyze + APK;
Python **28**; Next `tsc` + 73-page build green. No commit, no push.
Product gaps carried over (audit #31, smoke step 11).

### 2026-10-04 — Follow-up hardening: cert definition, sequences, smoke 24/24

**Gates first:** backend **926**, Angular **441**/62, Flutter **135**
(+1 skipped), Python **28**, Next `tsc` + 73 pages — exact S12b baseline.

1. **Certificate lifecycle (audit #33):** issued = generated + non-revoked.
   `V50` remaps stray `ISSUED` → `GENERATED`; `CertificateStatus` is now
   `GENERATED | REVOKED`; dashboard tile counts `<> REVOKED`; finance
   precondition is `!= REVOKED`; revoke audit logs the actual before-status.
   Angular filter/tone/KPI/spec moved `ISSUED → GENERATED`. Proof:
   `DashboardSummaryIntegrationTest.generatedCountsAsIssuedAndRevokedDropsOut`
   (HTTP generate → tile +1 → HTTP revoke → tile back) + strengthened
   Scenario A tile assertion (`certificatesIssued ≥ 1`).
2. **Endpoint matrix independence:** `AdminOnlyEndpointSecurityTest` rebuilt
   around hand-written §3.3 tables (70 admin-only / 117 supervisor-allowed /
   13 public) + `everyControllerEndpointIsClassified` tripwire over the live
   handler mapping (caught `.../messages/with-attachment` + doc endpoints
   on its first run; 403 probes needed validation-passing bodies and
   enum-valued path vars — test-side fixes). 141/141 green.
3. **Sequences (V51):** `finance_case/payment_receipt/document_reference_seq`
   replace count-then-write for FC-/PAY-/DOC- (readable formats kept);
   count/exists port methods deleted on those three repos.
   `finance/.../ReceiptReferenceConcurrencyTest` (4 threads, distinct
   VALIDATED internships → distinct `PAY-YYYY-NNNNN` + distinct cases).
4. **Live smoke 24/24:** rebuilt-binary blocker (no registry access) worked
   around by running current code locally against a scratch host-DB
   (dropped afterwards); step 11 rewritten to refused-then-reassign-then-
   validate; step 12 asserts the two guards; step 13 asserts
   `INTERNSHIP_NOT_PAYABLE`; all `.id` probes `// empty`-hardened. Live
   run exposed a REAL 500: bare-supervisor review audit `Map.of` NPE —
   fixed via null-safe `reviewAudit` helper (4 paths) + bite-proven
   `ReviewAuditNullSupervisorTest` (500 → 200). Flutter live STOMP
   roundtrip passes (test made configurable via dart-defines).
5. **Cleanup:** seed vars folded into root `docker-compose.yml` (overlay
   deleted); root `.gitignore` added; local `.env` kept (600, dev-only,
   outside all repos) for the operator's manual replays; repo secret scan
   + per-project `git log` clean (details in report).
6. **Audit accuracy:** scripted sweep — 80 OK rows, 153 named-test
   references, 0 broken (one stale name,
   `InvalidStateTransition409Test → StateMatrix409Test`, fixed).

**Final gates (full runs, this slice):** backend **931** / 0 (`clean
test`; 926 + 5: tripwire, tile test, 2 review-audit, concurrency;
ArchUnit green); Angular **441** / 62 files + typecheck + prod build
green; Flutter 135 +1 skipped + analyze clean; Python **28**; Next
`tsc` + 73-page build green. No commit, no push.

### 2026-10-04 — Production hardening: V52 sequence backfill, exposure lockdown, null-safety, prod config, deployment guide

**Gates first (exact counts, matching the stated baseline):** backend **931**,
Angular **441**/62 files + typecheck + build green, Flutter **135** (+1
skipped), Python **28**, Next `tsc` + 73-page build green. Exact match,
reported before touching anything.

**Task 1 — V52 sequence backfill (production-critical).** V51 created the
FC-/PAY-/DOC- sequences at START 1 while every real database minted its
references count-based with the CURRENT year — the first post-upgrade case/
receipt/document would die on the reference UNIQUE constraint. Verified
V51 was applied only to throwaway Testcontainers DBs and a dropped scratch
DB, but per the project rule (never edit an applied migration; the ledger
records V51 through a full green run) the fix continues as NEW **V52
`backfill_reference_sequences`**: `setval(seq, COALESCE(MAX(suffix),0)+1,
false)` per table (regex-restricted to service-minted shapes), next nextval
returns exactly max+1, empty DBs stay at 1; `certificate_reference_seq`
(V46, same defect class) included — decision recorded as audit assumption
#34. Proof, both halves: `MigrationChainIntegrationTest` extended (V33 +
legacy FC-/PAY-/DOC- rows incl. the exact colliding low numbers and high
maxima 87/33/52 → migrate → sequences above every suffix, minted refs collide
with nothing) and NEW `SequenceBackfillServiceIntegrationTest` (raw Flyway to
V50 → seed legacy rows → migrate → REAL `generateValidationReceipt` mints
FC+PAY, REAL `uploadDocument` mints DOC — without V52 the receipt call dies
on `FC-2026-00001`). RED-PROOF: with V52 removed (clean run) the chain test
FAILS exactly on the "greater than legacy max" assertions; first attempt was
invalid (stale target/classes kept V52 on the classpath — why the rule says
ALWAYS `clean test`). Assertions pinning 51 migrations updated to 52
(`StegBackendApplicationTests`, empty-DB chain test + nextval==1 probes).

**Task 2 — prod exposure lockdown.** springdoc was already disabled in prod;
actuator now keeps ONLY health (`application-prod.yml` `management...include:
health`, show-details never). NEW `security/ApiExposureProfileTest` (6, two
Spring contexts): dev/test — api-docs 200 anonymous, swagger-ui exposed,
actuator health/info/metrics/prometheus exposed (metrics ADMIN-only); prod —
api-docs + swagger-ui 404, health 200 without component details, info 404,
metrics/prometheus 404 EVEN FOR AN ADMIN (exposure wins over authorization).
The prod context boots the real `application-prod.yml` over the test profile
with env-style properties (JWT secret + CORS), exactly as production supplies
them.

**Task 3 — null-safety sweep.** The bug class behind `updateTask` and the
review-audit NPE: `List.of(event.…UserId())` in all 12 notification-listener
sites throws the moment an id is null, and `CertificateService`'s publisher
de-referenced `candidate.getUser().getId()` (staff-created profile without an
account → 500 rolling back generation). NEW shared helper
`common/domain/util/NullSafe` (`listOf` drops nulls, `mapOf` omits null
values, keeps insertion order, refuses null keys); listener + publisher +
CompanionService's task/review audit builders converted (`reviewAudit` now
delegates). Tests: `NullSafeTest` (5 — the four named paths: no supervisor,
no assignee, no university, no phone) + `NotificationEventListenerNullSafetyTest`
(8, every nullable handler degrades to an empty fan-out, never NPE).

**Task 4 — production config verified + two real holes closed.** prod profile
exists; seeder integration-only (reflection-pinned); CORS env-only without
default; JWT secret required; timezone default Africa/Tunis — all pinned by
NEW `ProductionProfileHygieneTest` (5). Angular prod env had no localhost
(already `'/api'`) — NEW `environment.spec.ts` (2). Flutter API_BASE_URL was
dart-define-driven but fell back to `10.0.2.2` — dev default REMOVED,
`AppConfig.ensureConfigured()` fail-fast in `main()` (+2 config tests; widget
tests needed the getters to degrade to empty instead of throwing — `boot()`
catches only Exception). NEW `scripts/check-production-hygiene.sh` fails on
any dev address in the Angular dist bundle, environment.prod.ts,
application-prod.yml or stegappe/lib (caught its own first violation in a
comment — fixed). `flutter build apk --release --dart-define=API_BASE_URL=…`
→ app-release.apk 59.1 MB; signing falls back to the DEBUG key without a
release keystore (operator prerequisite). **Two real bugs found by the new
prod tests:** (1) V27 seeds QA accounts with PUBLIC passwords into EVERY
database — `ProductionSeedAccountGuard` (prod-only ApplicationRunner) now
disables the three fixed-seed users at every prod boot (audited SYSTEM);
(2) `AuthService.authenticate` checked only LOCKED — an INACTIVE/disabled
account could still log in with the correct password — now refused with the
generic invalid-credentials message (`LOGIN_REFUSED_DISABLED_ACCOUNT`),
pinned by the prod-context test asserting the guard AND the refused login.

**Task 5 — `docs/deployment.md`** (new, next to the other ledgers): env vars
(required vs recommended), migration order V34→V52, backup-before-migrating
rollback advice, release order (backend first, Angular + mobile together),
first-run admin creation via the documented integration-seeder switch (the
QA accounts are now unusable in prod), smoke-test instructions
(`scripts/smoke-test.sh`, SMOKE_HR_PASS fail-fast, 24/24), and the
still-manual list (release keystore, malware mode, STEG VALIDATION REQUIRED
items, key rotation, audit archival).

**Task 6 — final gates (full runs, this slice):** backend **957** / 0
(`clean test`; ArchUnit green); Angular **443** / 63 files + typecheck +
prod build green + hygiene script clean; Flutter **137** +1 skipped + release
APK; Python **28**; Next `tsc` + 73-page build green. Audit-accuracy sweep
re-run: 80 OK rows, 0 non-OK, 60 named test classes, 0 missing files.
Assumptions #34/#35 recorded. No commit, no push.

**Remaining risks (honest):** release APK is debug-signed until the operator
provides the keystore; `MALWARE_MODE` still defaults to noop in prod unless
the operator sets clamav; chatbot/tile product gaps (#31) unchanged; the
docstrings' `TODO — STEG VALIDATION REQUIRED` items remain operator
decisions; certificate_reference_seq backfill assumes pre-V46 rows used the
`CERT-<year>-<n>` shape (regex-guarded; hand-written fixture refs cannot
poison it).

### 2026-10-05 — Hardening slice 2: QA-seed timing, first-run admin, session revocation, clamd, prod-profile live run

**Gates first (exact counts, matching the stated baseline):** backend **957**,
Angular **443**/63 + typecheck + build green + hygiene clean, Flutter **137**
(+1 skipped), Python **28**, Next `tsc` + build green. Exact match, reported
before touching anything.

1. **QA-seed accounts die before the server accepts a request.** The prod-only
   `ApplicationRunner` guard had a real race (it ran after Tomcat bound), so
   it is replaced by `ProdQaSeedAccountCallback`: a Flyway `AFTER_MIGRATE`
   callback, prod profile only, fail-closed (throws → boot aborts), audited
   SYSTEM `PROD_QA_SEED_ACCOUNT_DISABLED` through the migration connection
   (JPA is not up yet), idempotent (only login-capable rows). **No
   unconditional migration, on purpose** — with the demo seeder restricted to
   `integration` the V27 rows are the only working admin logins for local
   development and `V40` backfills supervision to the seeded admin, so
   disabling them everywhere would break dev for no production gain
   (assumption #36). Bug found while wiring it: the first version closed
   Flyway's own connection (try-with-resources on `context.getConnection()`),
   which broke Flyway's commit — the prod context refused to boot. Proof:
   `ApiExposureProfileTest.v27QaAccountsAreDisabledInProduction` + the live
   prod run below. The three V27 ids moved into `iam/domain/QaSeedAccounts`
   so the callback and the bootstrap share them.
2. **First-run admin for production (no demo seeder).**
   `FirstRunAdminBootstrap` (`ApplicationRunner`): BOTH
   `STEG_BOOTSTRAP_ADMIN_EMAIL`/`_PASSWORD` (half-configured refuses the
   boot), creates exactly ONE `mustChangePassword=true` ADMIN with a BCrypt
   hash when no login-capable ADMIN exists, audits SYSTEM
   `FIRST_RUN_ADMIN_CREATED`, logs the id only, never the password. Weak
   passwords (< 12 chars or missing a character class) refuse the boot through
   the new shared `PasswordPolicy` (also now used by
   `AuthService.changePassword`). The V27 QA rows are excluded from the "an
   Admin exists" gate by id — on a fresh prod database they ARE the only admin
   rows, so counting them would make the bootstrap unreachable (found by the
   test). `FirstRunAdminBootstrapTest` (4) on its own container with
   per-method rollback. `deployment.md` §6 rewritten: the demo seeder is no
   longer part of any production procedure (assumption #38).
3. **Session revocation (V53).** `RefreshTokenRepository.revokeAllForUser`
   (new port + JPQL); `InternAccountManagementService`
   (deleteAccount/resetPassword/updateStatus) and `SupervisorManagementService`
   (updateSupervisor/deleteSupervisor) revoke on every logout-capable state;
   `AuthService.refresh` refuses disabled/INACTIVE; `JwtHandshakeInterceptor`
   checks the account state; `JwtAuthenticationFilter` re-reads the account on
   EVERY request (401 when it is gone or disabled) and, via the new V53
   `users.credentials_updated_at`, refuses tokens issued before a password
   reset. **V53** migration added (the only schema change); migration-count
   assertions 52 → 53 in `StegBackendApplicationTests` +
   `MigrationChainIntegrationTest` (pinned behaviour, updated not deleted).
   `SessionRevocationIntegrationTest` (3, Testcontainers + real HTTP). Three
   test-side defects found and fixed: the account is created with a GENERATED
   one-time password (not a fixed one), `PATCH
   /api/intern-accounts/{id}/status` takes QUERY parameters (a JSON body was
   silently ignored → the deactivation test was asserting nothing), and with
   `mustChangePassword=true` the filter answers 403
   `PASSWORD_CHANGE_REQUIRED` before the account-state check — so each case
   now completes the forced rotation first and only then proves the 401. Two
   ctor updates in the unit tests (new `RefreshTokenRepository` last arg).
   Deliberate non-change (assumption #37): a user changing their OWN password
   does not bump the credential version, so the forced first-login rotation
   keeps working in all three clients.
4. **Malware scanning deployment half.** The adapter + port + tests already
   existed; what was missing was a daemon and the variables. `docker-compose.yml`
   gains a `clamav` service (`clamav/clamav:stable`, `clamavdb` volume, no
   published port, healthcheck, backend `depends_on`) and forwards
   `MALWARE_MODE`, `CLAMAV_HOST`, `CLAMAV_PORT`, `MALWARE_TIMEOUT_MILLIS`,
   `MALWARE_MAX_SCAN_BYTES`, `MALWARE_ON_ERROR` (plus the bootstrap vars).
   **The pinned `1.4` tag has no linux/arm64 manifest** — it cannot start on
   Apple Silicon, so the compose file uses `stable` (the same image
   `ClamAvContainerIntegrationTest` runs). `steg-backend/.env.example` +
   `deployment.md` §2 document all six variables; `docker compose config`
   validates (assumption #39).
5. **Live PRODUCTION-profile stack + smoke.** Registry access for the backend
   image is unavailable, so the backend ran on the local JVM with
   `SPRING_PROFILES_ACTIVE=prod` against a throwaway Postgres 17 container
   (fresh database, all 53 migrations), `MALWARE_MODE=clamav` against a real
   clamd container, python-ai from the existing compose stack. Result: boot OK
   — `ProdQaSeedAccountCallback` disabled the 3 QA accounts at 00:16:22 and
   Tomcat started at 00:16:26 (timing proven in the logs); the bootstrap
   created exactly one Admin; `/actuator/health` 200 while `/v3/api-docs`,
   `/swagger-ui/index.html` and `/actuator/info` are 404; all three published
   QA passwords refused from the first request; **`scripts/smoke-test.sh` 24/24,
   0 failures** with only production credentials (bootstrap Admin, rotated
   forced password, plus a Supervisor created through the real Admin API and
   rotated); upload with clamd up → 201, upload with clamd stopped → **422
   `MALWARE_SCAN_FAILED`** (fail-closed proven live). Throwaway DB, clamd
   container, local helper scripts and all secret files removed afterwards; the
   operator's pre-existing dev stack (`steg-postgres`, `steg-doc-intel`) was
   left untouched. `deployment.md` §7 now documents the prod-profile variant of
   the suite. **Could not run:** the backend *container* (no registry access —
   local JVM instead), the Angular/Flutter/Next UIs against that prod backend
   (same-origin proxy and signing are operator prerequisites), and an
   HTTP-level EICAR rejection (the ClamAV signature is anchored, so a
   PDF-prefixed EICAR is not flagged by `clamdscan` either — detection is
   pinned at daemon + adapter level instead, and this is stated in the docs).
6. **Final gates:** backend **964** / 0 / 0 / 0 (`clean test`; 957 + 7; ArchUnit
   green), Angular **443** / 63 files + typecheck + production build + hygiene
   script clean, Flutter **137** +1 skipped, Python **28**, Next `tsc` + build
   green. Audit sweep re-run: **80 OK rows, 0 non-OK, 56 named test classes, 0
   missing files.** Assumptions #36–#39 recorded; `security-review.md` §1b
   (F6–F9), §2 (fail-closed + EICAR), §3 (V53) updated; `deployment.md` §1/§2/
   §3/§6/§7/§8 updated. No commit, no push.

**Remaining risks (honest):** the release APK is still debug-signed until the
operator provides the keystore; `MALWARE_MODE` still defaults to `noop`, so a
deployment that forgets it accepts unscanned uploads (fail-closed once set);
a user's OWN password change does not bump the credential version
(deliberate, #37); the clamav image is a floating `stable` tag because `1.4`
has no arm64 manifest; chatbot/tile product gaps (#31) and the `TODO — STEG
VALIDATION REQUIRED` operator decisions are unchanged.

**Pre-existing finding found by `scripts/check-contract-drift.sh` (NOT caused
by this slice):** `contracts/openapi-v1.1.0.json` has drifted from the live
spec — 36 paths missing from the frozen contract (back-office-login,
change-password, approve, chatbot, applications/manage, …) and 2 stale paths
still advertised (`/api/internships/{id}/workflow` and
`.../workflow/actions`, deleted in S6b), plus legacy enums (`ACCEPTED`,
`ISSUED`, `PLANNED`) that no longer exist in the code. This slice changed no
wire contract (no DTO gained or lost a field; `credentials_updated_at` is
internal only). Repairing it means bumping the contract version, regenerating
the clients (`scripts/generate-clients.sh`) and updating
`docs/ENDPOINT_INVENTORY.md` — deliberately not done inside the hardening
slice; it belongs in its own change set.
