# Legacy / Wrong Functionality Removal Log

> Rule (from the task): a test of legacy behavior may only be deleted if it is
> listed here with the reason and the replacement. Removal is proven by grep
> (zero references), a green build and green tests.

## S1 — Backend state model (2026-10-01)

### 1. Legacy transition skip `MODIFICATION_REQUESTED | NEEDS_CORRECTION → UNDER_REVIEW`

- **Where it lived:** `workflow/domain/guard/ApplicationWorkflowGuard`.
- **Why it was wrong:** AGENTS.md §4 requires the candidate to resubmit after a
  modification request (`MODIFICATION_REQUESTED → RESUBMITTED`); staff could
  previously ignore that wait and re-open the review directly.
- **Replacement:** the guard allows `UNDER_REVIEW` only from `SUBMITTED` and
  `RESUBMITTED`.
- **Proof:** `ApplicationStateMatrixTest.nonAllowedStaffPairsReturn409` and the
  updated (not deleted) `StateMatrix409Test.invalidSourceToUnderReview`, which
  now includes `MODIFICATION_REQUESTED` and `NEEDS_CORRECTION`.
- **Grep:** no production call site allowed the pair (guard-only policy).

### 2. Legacy two-step requirement `FINAL_DECISION only from UNDER_REVIEW`

- **Where it lived:** `ApplicationWorkflowGuard` + `ApplicationApprovalService`.
- **Why it was wrong:** Scenario A approves a freshly submitted application;
  the brief's review actions (approve / deny / request modification) are
  available on `SUBMITTED`.
- **Replacement:** `FINAL_DECISION` is allowed from `SUBMITTED`,
  `RESUBMITTED`, `UNDER_REVIEW`; `UNDER_REVIEW` remains valid.
- **Proof:** `ApplicationStateMatrixTest.allowedTransitionSucceeds` (13 rows)
  and `ApplicationStateMatrixTest.atomicApprovalAcceptsFreshSubmission`
  (SUBMITTED → `/approve` → internship + Admin supervisor + audit).
- **Updated tests:** `StateMatrix409Test.invalidSourceToFinalDecision` no longer
  lists `SUBMITTED`/`RESUBMITTED` as invalid;
  `WorkflowControllerIntegrationTest.illegalTransitionRejectedByGuard` now
  probes an `APPROVED` application (the legacy probe asserted the removed rule).

### 3. Legacy error shape `422 INVALID_STATUS_TRANSITION` for candidate transitions

- **Where it lived:** `ApplicationService.validateTransition` and
  `ApplicationService.resubmitApplication`.
- **Why it was wrong:** AGENTS.md §4 states invalid transitions must be
  `409 INVALID_STATE_TRANSITION`.
- **Replacement:** both now throw `InvalidStateTransitionException` (409).
- **Proof:** `ApplicationStateMatrixTest.submitOnlyFromDraft`,
  `...resubmitOnlyFromModificationRequested`.
- **Updated tests:** `StateMachineRejectionTest.submitTwiceRefused` and
  `IdempotencyTest.submitReplay` (expectation changed 422 → 409, same intent:
  the duplicate submit is refused).

### 4. Legacy status `NEEDS_CORRECTION` as a resubmission source

- **Where it lived:** `ApplicationService.resubmitApplication`.
- **Why it was wrong:** V39 migrated `NEEDS_CORRECTION` → `MODIFICATION_REQUESTED`;
  the explicit model has no `NEEDS_CORRECTION` state.
- **Replacement:** only `MODIFICATION_REQUESTED → RESUBMITTED`.
- **Proof:** `ApplicationStateMatrixTest.resubmitOnlyFromModificationRequested`.
- The enum value itself is still listed in `ApplicationStatus` (kept as a probe
  source and for legacy rows); removing the enum values from the model is part
  of the pending status cleanup below.

### 5. Legacy internship lifecycle `PLANNED → ACTIVE → COMPLETED`

- **Status:** still present (the workflow engine's `internship-lifecycle`
  definition), used only by manually created internships.
- **Replacement (new, live):** `InternshipLifecycleService`
  (`APPROVED → IN_PROGRESS → REPORT_SUBMITTED → UNDER_VALIDATION → VALIDATED
  → RECEIPT_ISSUED`), audit + notifications, Admin-only endpoint
  `POST /api/internships/{id}/status-transitions`.
- **Proof:** `InternshipLifecycleMatrixTest` (8 tests; allowed pairs, full 409
  complement, 403 for supervisor/intern).
- **Pending:** migrate the remaining clients off `PLANNED/ACTIVE/COMPLETED`
  and delete the legacy engine arms in the status-cleanup slice.

## S2 — Angular legacy approval/review path (2026-10-01)

### 6. Non-atomic approve action

- **Where it lived:** `features/applications/application-review.service.ts`
  (`accept()` → `executeApplicationTransition(FINAL_DECISION/APPROVED)`),
  `application-dossier.component.ts` (`accept-note` reason branch and its
  optional-note button), `core/dictionaries.ts` (`dossier.accept` /
  `dossier.acceptHint`).
- **Why it was wrong:** AGENTS.md §5.2 requires the atomic approval endpoint
  plus the supervisor dialog and the one-time credentials dialog; the workflow
  transition only flipped the application status — no internship, no
  assignment, no provisioning, no credentials.
- **Replacement:** `ApplicationReviewService.approve()` →
  `POST /api/applications/{id}/approve` (supervisor + department), then
  `ApprovalDialogComponent` (Admin preselected, supervisors from
  `/api/supervisors`) and `CredentialsDialogComponent` (copy, email status,
  Resend through the §5.4 password reset). The password lives only while the
  dialog is open and is cleared on close.
- **Proof:** zero references to `accept(`, `accept-note`, `dossier.accept`:
  `grep -rn "accept-note\|dossier.accept\b" steg-back-office/src` returns
  nothing outside this document. Tests: `ApplicationReviewService` approve
  specs (sup vs, chosen supervisor, null = acting Admin, supervisor list),
  `ApprovalDialogComponent` (3), `CredentialsDialogComponent` (3),
  `ApplicationDossierComponent` (approve → credentials once → cleared,
  backend-default null supervisor).
- `reject` and `requestCorrection` keep the workflow `FINAL_DECISION`
  endpoint: that is the decision path for those decisions, not the removed
  non-atomic approval.

### 7. Client-side list filtering/paging on the application queue

- **Where it lived:** `features/applications/application-queue.component.ts`
  (`filtered`/`paged` computed over the whole fetched list, local sort,
  client-side pagination), `ApiClient.getApplications` (a method pretending
  `GET /api/applications` was paged — the backend endpoint returns a bare
  array and ignores paging params), plus the orphan types `ApplicationRow`
  and `PageQuery`.
- **Why it was wrong:** AGENTS.md §5 requires every list screen to provide
  **server-side** pagination, search, filters and sort. The old path pulled
  every application into the browser, and a Supervisor could not use it at
  all (`GET /api/applications` is CANDIDATE/ADMIN only).
- **Replacement:** backend `GET /api/applications/manage`
  (`ApplicationQueueService.search`: scope + filters + sort + page in one
  query), `ApiClient.searchApplications`, and a queue component that renders
  exactly one server page. Dashboard drill-down moved off the legacy status
  (see #8).
- **Proof (grep, zero references):**
  `grep -rn "getApplications\\b\|ApplicationRow\|PageQuery" steg-back-office/src` → 0;
  `grep -rn "paged()\|filtered" steg-back-office/src/app/features/applications` → 0.
- **Tests:** backend `ApplicationQueueSearchTest` (7: paging metadata + order,
  sort whitelist + clamp, search by reference/name/email, status/type/
  university/date filters, Supervisor scope incl. ignored client scope hints,
  403 for candidates); Angular `api-client-queue.spec.ts` (4: full query
  string, omitted params, size clamp, Spring-4 envelope normalization) and
  `application-queue.component.spec.ts` (11: server page rendering, drill-down
  preset as a server filter, legacy preset ignored, explicit-only status
  options, filter/paging/sort requests, store persistence, empty state).

### 8. Dashboard drill-down on the legacy status `NEEDS_CORRECTION`

- **Where it lived:** `features/dashboard.component.ts` (corrections KPI link
  `[queryParams]="{ status: 'NEEDS_CORRECTION' }"` and `corrections()`
  counting that group) and its spec.
- **Why it was wrong:** V39 migrated applications to
  `MODIFICATION_REQUESTED`; the link landed on a status filter that no longer
  exists in the queue, silently showing "empty".
- **Replacement:** the KPI links to `?status=MODIFICATION_REQUESTED` and
  counts that group.
- **Proof:** `grep -rn "NEEDS_CORRECTION" steg-back-office/src/app/features/dashboard`
  → 0; `DashboardComponent` spec asserts the link carries
  `MODIFICATION_REQUESTED`.

### 9. Client code depending on retired application statuses (pre-check a)

- **Where it lived:** `internship-create.component.ts` (create button and
  guard `app.status !== 'ACCEPTED'` — blocked every application since
  approvals now end in `APPROVED`), `internship-list.component.ts`
  (drill-down `?status=ACCEPTED`), `ai-assistant.service.ts` (missing-
  documents insight, corrections count and the "missing documents" answer
  filtered on `NEEDS_CORRECTION`, so they always reported 0).
- **Why it was wrong:** V39 + S1a made the explicit statuses authoritative
  (`APPROVED`, `MODIFICATION_REQUESTED`); these clients only worked against
  the retired values.
- **Replacement:** the three call sites now test `APPROVED` /
  `MODIFICATION_REQUESTED`; the create-flow spec fixture moved with them
  (`APPROVED_PFE`).
- **Proof (grep):** `grep -rn "'ACCEPTED'" steg-back-office/src/app` → only
  legacy display branches (`candidate-detail` tone, dossier `statusTone`
  legacy-row case) and `shared-ui.spec` (arbitrary badge label);
  `grep -rn "NEEDS_CORRECTION" steg-back-office/src/app/features/ai` → 0.
  Remaining `NEEDS_CORRECTION` occurrences in `internship-detail` are the
  **workflow VALIDATION decision vocabulary** (`ApprovalDecision`), not the
  application status — kept deliberately. Flutter and Next carry no retired
  application-status value in logic (`grep` → 0 for `stegappe/lib`; Next
  `NEEDS_CORRECTION`/`ACCEPTED` appear only in a decorative badge fallback
  and comments).
- **Tests:** `internship-create.component.spec.ts` (fixture now `APPROVED`),
  `ai-assistant.service.spec.ts`, full Angular suite 206 green.

## S3 — Supervisor Management (2026-10-02)

### 10. Implicit-join supervisor queries (`a.supervisor.user.id`)

- **Legacy item:** supervisor scoping, the delete guard and notification routing
  resolved the supervisor through the **legacy employee link**
  (`InternshipAssignment.supervisor.user.id`) via an implicit join path. An
  implicit join in JPQL compiles to an INNER JOIN, so since assignments became
  user-backed (V35/V36, legacy `supervisor_id` NULL) the row was silently
  filtered out: `InternshipAssignmentRepository.findBySupervisorUserIdAndStatus`
  returned nothing for every supervisor, and
  `FinanceCaseRepository.findAllForSupervisor` /
  `findByStatusForSupervisor` returned an EMPTY finance queue.
- **Removal:** both queries now match the **user-backed link** with an explicit
  `LEFT JOIN a.supervisor legacySupervisor` plus
  `(a.supervisorUser.id = :supervisorUserId OR legacySupervisor.user.id = :supervisorUserId)`.
  The legacy employee link is no longer the only entry point, so supervision
  scope can never silently drop a V36 assignment.
- **Proof (grep):** `grep -rn "a.supervisor.user.id" --include=*.java src/main`
  → 0 query occurrences (the two remaining strings are the javadoc that names
  the removed pattern).
- **Tests (new):** `finance/application/SupervisorScopedFinanceQueryTest` (3) —
  `supervisorSeesOwnCaseThroughUserBackedAssignment`,
  `statusFilteredListKeepsUserBackedScope`,
  `supervisorCannotSeeAnotherSupervisorsCase`. Verified to bite: with the
  `LEFT JOIN` reverted to an inner join all 3 fail (empty page), with the fix
  all 3 pass. The assignment-entity fix is pinned by
  `SupervisorManagementApiTest.deleteWithAssignmentsReturns409`,
  `reassignMovesSupervisionAndKeepsHistory` and
  `SupervisionScopeServiceTest`.
- **Reassignment flush ordering (related):** closing the old ACTIVE assignment
  and inserting the new one in one flush violates the partial unique index
  `idx_internship_assignment_active_unique (internship_id) WHERE status='ACTIVE'`
  (Hibernate orders INSERTs before UPDATEs). Both `assignCandidate` and
  `reassignSupervisor` now `saveAndFlush` the closure; proven by
  `SupervisorManagementApiTest.reassignMovesSupervisionAndKeepsHistory` (which
  returned 409 "Concurrent Modification Conflict" before the fix).
- **Error model:** the supervisor delete guard moved from
  `BusinessRuleException` (422) to the new
  `common.domain.exception.ConflictException` (409,
  `SUPERVISOR_HAS_ACTIVE_ASSIGNMENTS`) — a state conflict is not a validation
  error. `InternAccountManagementService.deleteAccount` shares the guard.
  `GlobalExceptionHandler.handleConflict` maps it with its own `errorCode`.

## S4 — Intern accounts workspace (2026-10-02)

### 11. "Account management pending on the backend" panel in `/admin`

- **Where it lived:** `features/admin/admin-workspace.component.ts` (Accounts
  tab): a warning alert claiming the backend exposes no administration API for
  accounts, plus three dictionary strings (`admin.accountsPendingTitle`,
  `admin.accountsPendingBody`, `admin.accountsScopeHint`) and a comment saying
  the panel is deliberately empty.
- **Why it was wrong:** the backend HAS had
  `GET/POST/PUT/DELETE /api/intern-accounts`,
  `POST /{id}/reset-password` and `PATCH /{id}/status` since before S4, and S4
  added the paged `GET /api/intern-accounts/manage`. A "pending" panel next to
  real endpoints is dead UX.
- **Replacement:** the Accounts tab now explains that mobile accounts live in
  the dedicated Admin-only workspace and links there (`routerLink="/intern-accounts"`);
  the panel itself offers no mutation. The workspace
  (`features/intern-accounts/`) is a SEPARATE route from Supervisor Management,
  sharing only `shared/ui` components and the S3 credentials dialog.
- **Updated test (not deleted):**
  `admin-workspace.component.spec.ts` `shows user linkage badges and an honest
  pending accounts panel` → `shows user linkage badges and links the accounts
  tab to the dedicated workspace`, which now asserts the link href and that no
  account action is faked.
- **Grep proof:**
  `grep -rn "backend endpoint pending\|TODO" steg-back-office/src/app/features/admin steg-back-office/src/app/core/dictionaries.ts`
  → 0 (the "pending" claim and its TODO text are gone). The three i18n KEYS
  remain (`admin.accountsPendingTitle/Body`, `admin.accountsOpen`,
  `admin.accountsScopeHint`) because they are referenced by the Accounts tab;
  their values were rewritten to point at the real `/intern-accounts`
  workspace. No "pending" wording survives in any locale.

### Pre-check (b) — implicit-join sweep (2026-10-02, no removal needed)

- Swept all 51 `@Query` occurrences across all 16 repository files. The two
  defective queries (`a.supervisor.user.id`) were already removed in #10; the
  remaining multi-hop paths were checked field-by-field against the entity
  annotations and are either non-nullable (`FinanceCase.internship`,
  `PaymentReceipt.financeCase`, `Message.sender`, `NotificationDelivery.*`,
  `InternshipAssignment.destination`) or equality predicates where NULL rows
  must not match by definition (`Candidate.user`, `Internship.supervisorUser`,
  `AuditLog.actor`, `Conversation.internship`). No compatibility branch, no
  dead query and no unfixed implicit join was found.

## S5 — Candidates workspace (2026-10-02)

### 12. Client-side list filtering/paging on the candidate queue

- **Where it lived:** `features/candidates/candidate-list.component.ts` computed
  `filtered`/`paged` signals over the whole `ApiClient.listCandidates()`
  result (a bare-array endpoint with no paging, no search and no server
  filters), then sorted and paginated the whole list in the browser. The
  screen also showed every candidate to a Supervisor, because the scope was
  whatever the CANDIDATE/ADMIN-only endpoint returned.
- **Why it was wrong:** AGENTS.md §5 requires **server-side** pagination,
  search, filters and sort on every list screen, and §5.1/§6.2 require the
  Admin and the Supervisor to share one screen whose scope is resolved on the
  server. Client-side paging also meant the CIN-free row list grew without
  bound and that no filter could be trusted.
- **Replacement:** backend `GET /api/candidates/manage`
  (`CandidateWorkspaceService.search`: one scoped JPQL query with the filters
  mirrored in the countQuery, sort whitelist and size clamp, then 3 batched
  enrichment queries) + `ApiClient.searchCandidates` and a queue component
  that renders exactly one server page. The CIN is absent from the row
  contract, so the list can no longer leak it. The `listCandidates()` method
  itself is KEPT because `application-queue`, `internship-create` and
  `supervisor-dashboard` still need a plain directory list.
- **Proof (grep):**
  `grep -rn "paged()\|filtered\b" steg-back-office/src/app/features/candidates` → 0;
  `grep -c nationalId steg-back-office/src/app/features/candidates/candidate-list.component.ts` → 0.
- **Tests:** backend `CandidateWorkspaceIntegrationTest`
  (`manageListIsPagedServerSide`, `filtersNarrowTheQueueServerSide`,
  `supervisorFilterSortAndClamp`, `scopeIsResolvedServerSide`); Angular
  `api-client-candidates.spec.ts` (7: full query string, omitted params,
  size clamp, envelope normalization) and `candidate-list.component.spec.ts`
  (10: server page rendering, filters reset the page, supervisor filter only
  for `USER_MANAGE`, next page requested from the server, sort-key mapping,
  confirm-then-delete, 409 dependency message, error and empty states).

### 13. "Supervisor sees all candidates" / 403-where-404 on candidate paths

- **Where it lived:** `CandidateService.getCandidate`/`updateCandidate` threw
  `AccessDeniedException` when a Supervisor touched a candidate outside their
  scope, so the backend answered **403 with an existence leak**, and the list
  screen offered a Supervisor whatever the unrestricted endpoint returned.
- **Why it was wrong:** §1 requires a row-level authorization failure to
  return **404** so a Supervisor cannot learn that a foreign candidate exists,
  and §5.1/§6.2 require the scope to be resolved in the query.
- **Replacement:** `SupervisionScopeService.supervisesCandidate(actor,
  candidateId)` (Admin global, otherwise derived from the candidate's
  assigned internships) is consulted by the legacy service AND the workspace
  service, which resolves the scope server-side in the list query, the
  overview and the delete command. The `AccessDeniedException` throw is gone.
- **Proof (grep):** `grep -rn "AccessDeniedException"
  steg-backend/src/main/java/tn/steg/backend/candidate` → 0.
- **Tests:** backend `CandidateWorkspaceIntegrationTest`
  (`scopeIsResolvedServerSide`, `deleteIsScopedAndRoleProtected`,
  `outOfScopeAccessIsNotFound`, `supervisorUpdatesOwnCandidateWithoutCin`)
  plus `CandidateScopingIntegrationTest.readingForeignCandidateIsNotFound`;
  Angular `candidate-list.component.spec.ts` (supervisor filter hidden for a
  Supervisor and the directory never fetched) and
  `candidate-detail.component.spec.ts` (404 error state, CIN never rendered
  when the backend redacted it).

### 14. A soft-deleted profile kept reserving the account and the CIN (pre-check (c))

- **Where it lived:** `CandidateService.createCandidate` filtered
  `deletedAt == null` in its "one profile per account" check and carried the
  comment *"soft-deleted profiles do not block a new one"*, but the V4 schema
  still had `candidates.user_id UNIQUE` and `candidates.national_id_hash
  UNIQUE`. Reality contradicted the intent: a second `POST /api/candidates`
  from the same account died on the DB constraint with **409**, and the same
  person's CIN could never be registered again. The same check also loaded the
  whole table with `candidateRepository.findAll().stream()`.
- **Why it was wrong:** a CIN is a permanent national identity number, so
  holding it on a deleted profile locks out the legitimate owner forever while
  reserving it for nobody; and a permanently reserved account made a deleted
  person unable to re-register at all.
- **Replacement:** `V42__candidate_live_identity_uniqueness.sql` drops the
  `national_id_hash` UNIQUE constraint for the partial index
  `idx_candidates_live_national_id_hash … WHERE deleted_at IS NULL`; the
  soft-delete command now also sets `user_id = NULL`; every identity lookup
  became live-only (`existsByUserIdAndDeletedAtIsNull`,
  `existsByNationalIdHashAndDeletedAtIsNull`,
  `findByNationalIdHashAndDeletedAtIsNull`), which also removes the
  full-table scan from the profile-exists check. `user_id` keeps its plain
  UNIQUE (many NULLs allowed), so one LIVE profile per account is still a
  database guarantee.
- **Two further call sites were fixed by the same sweep** — they would have
  resurrected or blocked a deleted person:
  `AnonymousApplicationService.resolveOrCreateCandidate` reused the tombstone
  (overwriting its fields and attaching a new, staff-invisible application),
  and `IdentifierValidationService` reported the CIN as a duplicate so the
  front office refused the person.
- **Proof (grep):** `grep -rn "findByNationalIdHash(\|existsByNationalIdHash("
  steg-backend/src/main/java --include=*.java | grep -v Repository.java` → 0
  business call sites left (only the repository declarations). The legacy bare
  `listCandidates` still streams `findAll()`; that is a separate legacy list
  path (kept for the application queue / internship pickers), not this defect.
- **Tests:** `CandidateSelfServiceLifecycleIntegrationTest` (13,
  Testcontainers/Postgres) — this pre-check is what FOUND the defect:
  `sameCinCanBeRegisteredAgainAfterSoftDelete`,
  `applicationSubmissionDoesNotResurrectASoftDeletedProfile`,
  `softDeletedLoginReachesNoData`, `sameEmailCanRegisterAgain`,
  `softDeletedProfileIsInvisibleToStaff`, plus the self-service CIN cases
  (`createWithoutCinIsRefused`, `createWithCinSucceedsAndReturnsItToSelf`,
  `staffCannotCreateOnBehalfOfACandidate`, …). Recorded as audit
  assumption #13.

### 15. Legacy status values everywhere (S1b) + the dead review DTO

- **Where they lived:** `ApplicationStatus.ACCEPTED` / `NEEDS_CORRECTION`,
  `InternshipStatus.PLANNED` / `ACTIVE` / `COMPLETED`, the duplicated
  `ApprovalDecision.NEEDS_CORRECTION`, the internship column DEFAULT `'PLANNED'`,
  the user-facing status switches in `AnonymousApplicationController`, the OpenAPI
  `allowableValues` of the dead `ApplicationReviewRequest`, the AI knowledge base
  (`StegKnowledgeBase`) and the staff assistant text, plus client branches in
  Angular, Flutter and Next.
- **Why it was wrong:** §4 defines ONE explicit status model; a second set of
  names for the same states meant every screen, report and AI answer had to
  carry both vocabularies, and a client sending a legacy value silently landed in
  a state the Admin cannot reason about.
- **Replacement:** the explicit §4 enums + `ValidationDecision` for the manual
  per-document decision (§5.11 step 4, its own enum and NOT an application
  status), `V43` for the data, and `ApprovalDecision.MODIFICATION_REQUESTED`
  for the decision behind `MODIFICATION_REQUESTED`.
- **Deleted (with reason):** `ApplicationReviewRequest` — **dead code** (zero
  references in main and test) whose `allowableValues` still advertised
  `ACCEPTED`/`NEEDS_CORRECTION`. Replaced by nothing: staff transitions go
  through the workflow action / the explicit approval endpoint.
- **Removed test cases (not whole tests):** 9 parameterized invocations in
  `StateMatrix409Test` probed status values that no longer exist or became valid
  sources: `invalidSourceToUnderReview` lost `NEEDS_CORRECTION`+`ACCEPTED`,
  `invalidSourceToFinalDecision` lost `NEEDS_CORRECTION`+`ACCEPTED`,
  `invalidSourceToActive` lost `ACTIVE`+`COMPLETED` (and `APPROVED`, which is now
  the VALID source because `PLANNED → APPROVED`),
  `invalidSourceToCompleted` lost `PLANNED`+`IN_PROGRESS` (`IN_PROGRESS` is now
  the valid source). Every remaining case still runs; the suite went
  620 → **611** purely because 9 legacy probes no longer have an enum to probe.
  No test method was deleted.
- **Audit history is append-only and was NOT rewritten:** historical audit rows
  keep the code `APPLICATION_NEEDS_CORRECTION`; NEW rows are written as
  `APPLICATION_MODIFICATION_REQUESTED`. The audit viewer must therefore display
  both codes without depending on a removed enum value.
- **Proof (greps, zero references).** Run from the monorepo root
  `/Users/karimfeki/Documents/steg-intern`:

  ```bash
  # backend — legacy status values used as CODE (audit/action codes and
  # migration-history comments are intentionally excluded)
  grep -rnE "\b(ACCEPTED|NEEDS_CORRECTION)\b" steg-backend/src/main --include=*.java \
    | grep -vE "ACCEPTED_BY_HUMAN|APPLICATION_ACCEPTED|APPLICATION_NEEDS_CORRECTION|was REMOVED|legacy|APPLICATION_MODIFICATION_REQUESTED|historical|kept in the audit"
  → 0

  grep -rnE "InternshipStatus\.(PLANNED|ACTIVE|COMPLETED)" steg-backend/src --include=*.java
  → 0

  grep -rn "ApprovalDecision\.NEEDS_CORRECTION" steg-backend/src --include=*.java
  → 0

  # the enums themselves no longer declare a legacy constant
  grep -cE "^\s+(ACCEPTED|NEEDS_CORRECTION|PLANNED|ACTIVE|COMPLETED)," \
    steg-backend/src/main/java/tn/steg/backend/application/domain/model/ApplicationStatus.java \
    steg-backend/src/main/java/tn/steg/backend/internship/domain/model/InternshipStatus.java
  → 0, 0

  # Angular (production code; specs are listed separately)
  grep -rnE "'(ACCEPTED|NEEDS_CORRECTION)'" steg-back-office/src/app --include=*.ts | grep -v ".spec.ts"
  → 0

  # Flutter
  grep -rnE "InternshipStatus\.(planned|active|completed)\b" stegappe/lib --include=*.dart
  → 0

  # Next front-office
  grep -rnE "\b(ACCEPTED|NEEDS_CORRECTION)\b" steg-front-office/src --include=*.ts --include=*.tsx \
    | grep -vE "ACCEPTED_BY_HUMAN|legacy|migrated|V39|V43|just approved"
  → 0
  ```

  What is deliberately NOT zero, and why:
  - `APPLICATION_ACCEPTED` / `APPLICATION_NEEDS_CORRECTION` in the backend: the
    append-only audit history (new rows use `APPLICATION_MODIFICATION_REQUESTED`).
  - Comments in `ApplicationStatus`/`ApprovalDecision` and in the Next client
    that NAME the removed values to document the migration.
  - `TaskStatus.COMPLETED`, `WorkflowStatus.COMPLETED`, `AssignmentStatus.ACTIVE`,
    `AssignmentStatus.PLANNED`, `UserStatus.ACTIVE`, `AiRecommendationStatus.ACCEPTED_BY_HUMAN`:
    different enums whose values merely share a name.

## Pending inventory (from the task; each will be removed in its slice)

| # | Legacy item | Where | Replacement | Slice |
|---|---|---|---|---|
| 1 | ~~Legacy status values `ACCEPTED`, `NEEDS_CORRECTION`, `PLANNED`, `ACTIVE`, `COMPLETED`~~ **removed in S1b** (#15): mapping recorded in audit assumption #15, data migrated by `V43` (proven by `LegacyStatusRemovalMigrationIntegrationTest`), enums + every backend/Angular/Flutter/Next branch swept. | backend enums + Angular/Flutter/Next branches + AI knowledge base | explicit statuses of §4 + `V43` data migration | S1b done |
| 2 | ~~Angular legacy approval/review path not calling the atomic approve endpoint~~ **removed in S2** | `steg-back-office/src/app/features/applications` | supervisor dialog + credentials dialog + `POST /approve` | S2 done |
| 3 | ~~`/tasks` routed to the AI assistant placeholder~~ **removed in S6c** (below #21): `/tasks` now lazy-loads `features/tasks/task-list.component` (student-grouped workspace); zero references to the AI assistant from the route or any workspace component. | `steg-back-office/src/app/app.routes.ts` | student-grouped task workspace | S6 done |
| 4 | Demo credentials on the login screen; demo/mock IAM fallbacks | ~~removed before this slice~~ demo credentials already gone (`grep -rn "demo@\|admin@steg" steg-back-office/src/app` → 0); `e2e/mock-backend.ts` proven test-only by the production build (`grep -rl installMockApi dist` → 0, `grep -rl searchApplications dist` → hits); `signInDemo` is a test-only auth helper | live IAM only | done, verified 2026-10-01 |
| 5 | `Employee.supervisor` dereferences with fallbacks | certificate/finance code + `SupervisionScopeService` | user-backed supervisor only | S8/S1 |
| 6 | Removed roles (HR, FINANCE, DIRECTOR) remnants | Angular roles/nav, seeds, tests, docs | Admin/Supervisor only | S2 done; S3 verified (nav/roles carry only ADMIN/SUPERVISOR, no reference added). **S6b: `ReportControllerTest` 9 → 8** — the retired-role scopes `hrPlanningScope` (HR), `financeTreasuryScope` (FINANCE) and `adminAndDirectorFullAccess` (DIRECTOR) were removed; replaced by `supervisorForbiddenEverywhere` (SUPERVISOR 403 on all six report endpoints) and `adminFullAccess` (ADMIN 200 everywhere). Net −1 because the HR-vs-FINANCE split collapsed into one SUPERVISOR-forbidden probe. |
| 7 | ~~"Supervisor sees all candidates" paths / 403-where-404~~ **removed in S5** (#13): the candidate list/overview/delete resolve the scope server-side through `SupervisionScopeService.supervisesCandidate` and an out-of-scope candidate is 404 everywhere | backend queries + UI | `SupervisionScopeService` everywhere | S5 done |

## Verified-clean in S1

- No duplicate or colliding controller base mappings:
  `grep -rhoE '@RequestMapping\("[^"]+"'` shows one `/api/supervisors`, one
  `/api/intern-accounts`, one `/api/applications`, one `/api/internships`
  (plus the companion/logbook sub-resources), one `/api/audit`, one `/api/ai`.
- Credential responses keep `Cache-Control: no-store`
  (`AuthPasswordIntegrationTest.credentialsResponsesHaveCacheControlNoStore`).
- One-time passwords are returned once and never stored in audit or
  notification rows (`AuditAndSecretsLeakageTest.testNoSecretsInAuditOrNotifications`).

## S6a / pre-check (b) — 2026-10-02

**#16 — `AuthService.signInDemo` removed from the production code.**
- *Removed:* the `signInDemo(email, role)` method on `AuthService` (it set the
  private session signal, minted a fake token and navigated — a "become any
  user" primitive that shipped in `dist/`).
- *Replacement:* `src/app/core/testing/demo-session.ts`, a SPEC-ONLY fixture
  that uses the production seams (`setAccessToken()` + `restoreSession()`).
  `tsconfig.app.json` excludes `*.spec.ts`, and nothing outside a spec imports
  the fixture, so the Angular build never emits it.
- *Tests:* the 32 call sites in 16 spec files were rewritten to
  `signInDemo(auth, email, role)`; **no assertion was changed or dropped**
  (301 → 305 passing, the 4 new ones being S6a's own).
- *Proof:*
  - `grep -rn signInDemo src/app --include=*.ts | grep -v spec` → only the
    `DEMO_TOKEN_PREFIX` reference in `auth.service.ts`;
  - `grep -ro signInDemo dist/ | wc -l` → **0** (was 1);
  - `grep -ro "demo@" dist/ | wc -l` → 0; `grep -ro "Demo#2026" dist/` → 0.

**#17 — the default demo password `Demo#2026` deleted from the repository.**
- *Removed:* `${steg.seed.demo-password:Demo#2026}` (Java),
  `${STEG_SEED_DEMO_PASSWORD:Demo#2026}` (`application-integration.yml`),
  `STEG_SEED_DEMO_PASSWORD=Demo#2026` (`.env.example`),
  `${SMOKE_HR_PASS:-Demo#2026}` (`scripts/smoke-test.sh`).
- *Replacement:* an **empty** default everywhere plus a fail-fast guard —
  `IntegrationDemoSeeder` now throws `IllegalStateException("Demo seeding is
  enabled but STEG_SEED_DEMO_PASSWORD is empty…")`; `smoke-test.sh` uses
  `${SMOKE_HR_PASS:?…}`. Demo seeding also stopped defaulting ON
  (`@ConditionalOnProperty(..., matchIfMissing = true)` → no `matchIfMissing`,
  and `STEG_SEED_DEMO_ENABLED:false` in the profile).
- *Tests:* the integration profile is not used by the test suite, so no test
  change; the backend gate (629) covers the startup path.
- *Proof:* `grep -rn "Demo#2026" steg-backend/src scripts steg-back-office/src`
  → **0 hits**.

**#18 — a second, drifting copy of the supervision-scope rule deleted.**
- *Removed:* the local re-derivation in `CandidateService.listCandidates`
  (`assignedInternships(actor).stream()…`) and in
  `CandidateWorkspaceService.search` (same inline derivation), which could only
  see *internship assignments* and therefore would have hidden every
  staff-created candidate from its own supervisor.
- *Replacement:* `SupervisionScopeService.supervisedCandidateIds(actor)` /
  `supervisedCandidates(actor)` — the single rule (assignment **or**
  `managed_by_user_id`).
- *Tests:* `CandidateScopingTest.supervisorSeesOnlyOwnCandidates` UPDATED to
  assert the module asks the scope service (and never `assignedInternships`);
  + `CandidateScopingTest.adminSeesAllCandidatesWithoutAskingForAScope`;
  the real behaviour is proven by `StaffCandidateLifecycleIntegrationTest.
  supervisorCreatesInOwnScopeAndOthersAreOutOfScope` and
  `supervisorFilterMatchesStaffCreatedProfiles`.
- *Proof:* `grep -rn "assignedInternships(actor)" src/main/java` returns only
  `SupervisionScopeService` itself plus three callers that legitimately scope
  **internships** (`InternshipService`, `CompanionService`,
  `ApplicationQueueService` — the tasks/applications queue). No caller in the
  candidate module derives the rule any more.

## S6b — legacy internship workflow engine removal (2026-10-02)

**#19 — the second internship status engine is deleted; `InternshipLifecycleService` is the only writer.**
- *Removed:*
  - `WorkflowService.spawnInternshipWorkflow` (no internship workflow instance
    is ever spawned — creation goes through
    `InternshipLifecycleService.initializeStatus`);
  - `WorkflowService.transitionInternship` + `getInternshipWorkflowState`
    (the `POST /api/internships/{id}/workflow/actions` and
    `GET /api/internships/{id}/workflow` endpoints are gone from
    `WorkflowController`; the OpenAPI contract asserts the legacy path stays
    absent);
  - `workflow/domain/guard/InternshipWorkflowGuard.java` (file deleted; the
    `ACTIVE`/`COMPLETED` step codes die with it);
  - `CertificateService.assertAdministrativeValidation` + its
    `WorkflowInstanceRepository`/`WorkflowActionRepository` wiring (the
    certificate gate is the explicit §4 status `VALIDATED`, not a workflow
    action table — the gate could never pass once spawning stopped);
  - `InternshipService`'s direct `internship.setStatus(...)` writes
    (creation, assignment auto-start and cancellation all delegate to the
    authority).
- *Replacement:* `InternshipLifecycleService` (`initializeStatus`,
  `transition`, `cancel`) + the ArchUnit rule
  `InternshipStatusAuthorityFitnessTest.onlyTheLifecycleAuthorityWritesInternshipStatus`.
  The generic `POST /api/internships/{id}/status-transitions` additionally
  refuses `VALIDATED`/`RECEIPT_ISSUED` with 422 `INTERNSHIP_STATUS_RESERVED`
  (S7 owns those steps: manual per-document decision + receipt generation).
- *Tests UPDATED, none deleted:* `StateMatrix409Test` internship probes moved
  from `/workflow/actions`+`ACTIVE`/`COMPLETED` to
  `/status-transitions`+`IN_PROGRESS`/`REPORT_SUBMITTED`/`UNDER_VALIDATION`
  (7 methods kept; `validInternshipTransition` 2 → 3 cases);
  `InternshipLifecycleMatrixTest` keeps 3 succeeding pairs and gains
  `reservedTransitionsAreRejected` (UNDER_VALIDATION→VALIDATED,
  VALIDATED→RECEIPT_ISSUED = 422); `StateMachineRejectionTest` (19 methods
  kept) drives the lifecycle endpoint/fixture instead of the engine;
  `AuditCoverageChecklistTest` expects `INTERNSHIP_STATUS_CHANGED` +
  `INTERNSHIP_CANCELLED` from the authority;
  `CrossModuleIdorTest.internshipCrossCandidateReadBlocked` strengthened
  403 → 404.
- *Proof (zero references, from `steg-backend/`):*
  `spawnInternshipWorkflow` → 0; `transitionInternship`/`getInternshipWorkflowState`
  → 0; `InternshipWorkflowGuard` → 0 (file gone);
  `api/internships.*workflow` → 0; `"ACTIVE"`/`"COMPLETED"` step codes → 0;
  `assertAdministrativeValidation` → 0. `Internship.setStatus` writers in main:
  only `InternshipLifecycleService` (3 call sites), enforced by the ArchUnit
  rule (which was itself fixed: `callMethod` without parameter types never
  matches a Lombok setter, so the rule was vacuous — it now declares the
  `InternshipStatus` parameter and demonstrably FAILED on a deliberate
  out-of-package violator before the temp files were deleted).
- *ArchUnit deliberate-violation proof:* with a temporary
  `candidate.application.TempAuthorityViolatorBean.cheat()` calling
  `internship.setStatus(CANCELLED)`, `clean test` failed exactly on
  `onlyTheLifecycleAuthorityWritesInternshipStatus` naming the violator;
  after deleting the temp bean + temp test, the gate is green.

## S6c — student-grouped tasks workspace (2026-10-02)

**#20 — bulk response without a per-item summary replaced.**
- *Removed:* the 2-field `BulkTaskResponse(tasks, deletedCount)`.
- *Replacement:* `BulkTaskResponse(tasks, deletedCount, items)` with the new
  `BulkTaskItemResult(index, action, taskId, internshipId, status)` — one entry
  per mutation in request order. Added `DELETE /api/internships/tasks/{taskId}`
  (single delete; the bulk endpoint already covered it, the UI calls the single
  route for one task).
- *Tests (new, Testcontainers):* `TaskBulkAtomicityIntegrationTest` (3):
  `failingItemRollsBackEverything`, `resubmittingSameKeyDoesNotDuplicate`,
  `supervisorBulkWithOutOfScopeStudentFails404`.

**#21 — `/tasks` placeholder route deleted.**
- *Removed:* the `path: 'tasks'` route loading
  `features/ai/task-assistant.component` (the AI assistant stays in
  `features/ai/` for the S10 generation work; it is simply no longer the tasks
  workspace).
- *Replacement:* the same path lazy-loads
  `features/tasks/task-list.component` (grouped by student, approve/deny with
  mandatory reason, add/edit/delete, atomic bulk delete with idempotency key).
- *Proof:* `grep -rn "task-assistant\|TaskAssistant" src/app --include=*.ts`
  outside `features/ai/task-assistant` and specs → 0; prod-bundle greps stay 0
  (`signInDemo`, `installMockApi`, `demo@`, `Demo#2026`).

## S7 — internship validation (2026-10-02)

**#22 — legacy validation-decision path removed (S7 item 6).**
- *Removed:*
  - `ApiClient.executeInternshipTransition` (`POST /api/internships/{id}/workflow/actions`,
    the deleted S6b engine endpoint) — replaced by
    `ApiClient.transitionInternshipStatus` (`POST .../status-transitions`, §4
    statuses only; VALIDATED/RECEIPT_ISSUED never sent — backend 422s them);
  - `Angular InternshipService.recordValidationDecision` (the
    ValidationDecision → ApprovalDecision translation);
  - `Angular InternshipService.activate/complete` rewired onto the new endpoint
    (APPROVED → IN_PROGRESS, IN_PROGRESS → REPORT_SUBMITTED — the only valid
    successors; the tail end now belongs to the validation workspace);
  - the internship-detail decision dialog + `openDecision/submitDecision/
    decisionBlocked/decisionTarget/decisionComment/decisionError/canValidate`
    (the detail tab now links to `/validation/:id` for Admins);
  - orphaned `validation.*` dictionary keys (`approve`, `reject`, `correct`,
    `hold`, `evaluationRequired`, `reasonLabel`, `reasonRequired`, `auditNote`,
    `adminOnly`) × fr/en/ar. `decisionTitle/decisionHint/decisionSaved/history`
    stay (reused by the workspace link card and toasts).
- *Verified absent (no removal needed):* the backend never had a
  ValidationDecision → ApprovalDecision translation — `grep ApprovalDecision`
  in `internship/` matches only the `ValidationDecision` javadoc that names the
  distinction. Closed as specified.
- *Tests UPDATED, none deleted:* `api-client-c3.spec` (exact new body),
  `internship.service.spec` (new payloads), `internship-detail.component.spec`
  (certificate gating now status-based: APPROVED → hint, VALIDATED → button).
- *Proof:* `grep -rn "executeInternshipTransition\|recordValidationDecision"
  steg-back-office/src/app --include=*.ts | grep -v spec` → 0;
  `grep -rn "api/internships/.*workflow" steg-back-office/src/app --include=*.ts
  | grep -v spec` → 0 (the remaining `workflow/actions` hits are the live
  APPLICATION workflow `POST /api/applications/{id}/workflow/actions`, kept).


**#23 — `UNDER_VALIDATION → REPORT_SUBMITTED` becomes a legal transition.**
- *Where it lived:* the §4 table (forward-only) plus two matrix probes that
  asserted the pair is 409.
- *Why it changed:* a REJECTED manual document decision must return the
  internship for resubmission instead of stranding it in validation (audit
  assumption #18) — an intentional behavior change, not a regression.
- *Replacement:* explicit `UNDER_VALIDATION → REPORT_SUBMITTED` table edge
  (Admin-only like every validation step);
  `InternshipLifecycleMatrixTest` gains the pair in ALLOWED +
  `allowedTransitionSucceeds` (3 → 4 cases);
  `StateMatrix409Test.invalidSourceToCompleted` drops `UNDER_VALIDATION` from
  its invalid-source probe (7 → 6 cases). No test method deleted.

## S8 pre-checks (2026-10-03)

**#24 — finance-case approval no longer mints receipts directly.**
- *Where it lived:* `FinanceService.doApprove` called the `issueReceipt`
  renderer straight after recording the payment approval — a second,
  independent receipt-issuing path beside the S7 validation receipt.
- *Why it was wrong:* pre-check (a) requires exactly ONE receipt-issuing
  core, entered from a VALIDATED internship with no finance-case approval
  precondition (audit assumption #19).
- *Replacement:* new `FinanceService.issueOrReuseReceipt` (returns the case's
  existing receipt when present, else renders + persists via `issueReceipt`).
  Both callers route through it: `doApprove` (keeps its dossier
  READY_FOR_DECISION + payment-workflow + approval-record preconditions) and
  `doGenerateValidationReceipt` (VALIDATED + eligibility only). No endpoint,
  status model, or approval precondition changed — a duplicate receipt for one
  case previously died on the `finance_case_id` unique constraint; now it is
  returned as-is.
- *Proof (from `steg-backend/`):* a single `new PaymentReceipt(` site
  (`FinanceService.java:791`); `issueReceipt` has exactly one caller
  (`issueOrReuseReceipt`); `issueOrReuseReceipt` has exactly two callers
  (`doApprove`, `doGenerateValidationReceipt`). No test deleted; the finance
  concurrency/notification suites re-prove the approve flow unchanged.

## S8 — certificates (2026-10-03)

**#25 — count-based reference allocators removed (race under concurrency).**
- *Where they lived:* `CertificateService.nextReference` (count + exists-check
  loop over `certificates.reference`) with port methods `existsByReference` /
  `countByReferencePrefix`, and `nextDocumentReference` (same pattern over
  `documents.reference`).
- *Why they were wrong:* parallel generations for distinct internships read the
  same count, minted the same candidate reference, and died on the unique
  constraint (proven by `CertificateManagementApiTest.
  concurrentGenerationsAreUnique` failing 3/4 with 409 before the fix).
- *Replacement:* `certificate_reference_seq` (V46) via
  `CertificateRepository.nextReferenceSequence` — atomic, no retry loop;
  linked certificate documents derive `DOC-<cert-ref>-v<n>` deterministically
  from the unique certificate reference. The unique constraints stay as
  backstops. The unused port methods were deleted with them.
- *Proof:* `grep -rn "countByReferencePrefix\|existsByReference"
  steg-backend/src/main/java/tn/steg/backend/certificate` → 0;
  `grep -rn "nextDocumentReference" steg-backend/src/main` → 0; the
  concurrency test (4 threads, distinct internships) yields 4 distinct `CERT-`
  references, green twice in a row.

## 2026-10-04 — pre-fixes (a)–(c) + S10a (this slice)

No test method was deleted in this slice. Assertions were UPDATED where the
behaviour they pin changed deliberately (each noted below); every other new
test is additive.

**#28 — UTC day-boundary interpretation removed (pre-fix (a)).**
- *Where:* `CandidateWorkspaceService` (`from.atStartOfDay(ZoneOffset.UTC)`),
  Angular `audit-viewer.component.ts` (`toInstantStart/End` sending
  `T00:00:00Z`/`T23:59:59Z`), `ApplicationService` (`LocalDate.now()` on the
  JVM default zone for `submissionDate`).
- *Why it was wrong:* a Tunis user filtering "today" at 00:30 missed rows
  created at 00:10 the same day (23:10 UTC the previous day) — the brief
  requires an application time zone (default Africa/Tunis) for every
  date-range filter.
- *Replacement:* `steg.timezone` / `APP_TIMEZONE` (`application.yml` +
  `.env.example`) + `common.application.ApplicationTimeZone`; candidates and
  the new audit/notification `fromDate`/`toDate` resolve bounds through it;
  submission stamping uses `today()`; the viewer sends calendar days.
- *Tests UPDATED, none deleted:* `CandidateWorkspaceIntegrationTest.
  filtersNarrowTheQueueServerSide` UTC probes → Tunis probes (same intent:
  covering window matches, outside windows match nothing) + NEW
  `tunisDayBoundaryIncludesEarlyMorningRows` (fails under the UTC reading,
  passes under Tunis); NEW `AuditSearchIntegrationTest.tunisCalendarDayBounds`,
  `NotificationCenterIntegrationTest.tunisCalendarDayBounds`,
  `ApplicationTimeZoneTest` (4); Angular `audit-viewer.component.spec.ts`
  date-filter expectation (`fromDate`/`toDate`) + NEW `api-client-c6.spec.ts`
  calendar-day param test.
- *Proof:* full `clean test` → 720 passing; Angular 387 passing.

**#29 — shared `/login` as the back-office entry replaced (pre-fix (c)).**
- *Where:* Angular `AuthService.login` posted to `POST /api/auth/login`
  (shared with front-office/mobile); any authenticated role received tokens
  and only individual endpoints refused non-staff roles.
- *Why it changed:* audit §1 requires the back-office login contract
  server-side: login of any other role to the back office is refused.
- *Replacement:* `POST /api/auth/back-office-login` (staff-only; 403 + audited
  `BACK_OFFICE_LOGIN_REFUSED` otherwise), `/login` unchanged for the other
  clients; Angular posts to the staff endpoint (+ interceptor skip-list).
  The anonymous surface now lives in three lists (`@PublicEndpoint`,
  `SecurityConfig` permitAll, `JwtAuthenticationFilter.isPublicEndpoint`) —
  pinned by the extended `PublicEndpointConsistencyTest` (incl. the new
  `everyPublicEndpointAnswersAnonymously` probes).
- *Tests UPDATED, none deleted:* `e9-components.spec.ts` login URLs (2) +
  NEW 403-leaves-no-session test; `PublicEndpointConsistencyTest` gains the
  back-office-login 400 probe + 2 anonymous-surface probes. New:
  `BackOfficeLoginContractTest` (5).
- *Proof:* full `clean test` → 720 passing; Angular 387 passing.

**#30 — hard-coded Gemini model default removed (S10a).**
- *Where:* `AiProperties.model = "gemini-3.8-flash"` and
  `application.yml model: ${AI_MODEL:gemini-3.8-flash}`.
- *Why it was wrong:* the brief requires `GEMINI_API_KEY` and `GEMINI_MODEL`
  from `.env` with no hard-coded model name; a baked-in default calls the API
  under a name nobody configured.
- *Replacement:* `model: ${AI_MODEL:${GEMINI_MODEL:}}`, blank default, blank
  model degrades to `AI_UNAVAILABLE` in `GeminiCompletionClient` (never
  blocking); `.env.example` documents `GEMINI_MODEL` (primary) + `AI_MODEL`
  (override). The key never leaves the backend (unchanged).
- *Tests:* no test pinned the default (only the opt-in live probe, which reads
  `AI_MODEL` from the environment first); the degraded path is proven by
  `AiTaskDraftIntegrationTest.degradedAiIsUnavailable` + `manualCreationWorksWhileAiIsDown`.
- *Proof:* full `clean test` → 720 passing (AiIsolation green).

## 2026-10-04 — S11 pre-checks (a)–(c) (this slice)

No test method was deleted except where listed below with reason and
replacement. All other new tests are additive.

**#31 — legacy assistant fallbacks removed from the panel (pre-check (b)).**
- *Removed:*
  - `ApiClient.queryAssistant` (`POST /api/ai/assistant/query`) — its only
    caller was the floating panel; the S10b chatbot endpoint is the live path.
    The backend endpoint itself is untouched (still a live, tested contract).
  - the panel's `askLegacy`/`askRuleBased`/`reply` chain plus the `ApiClient`,
    `AiAssistantService` and `AuthService` injections it needed;
  - `features/ai/task-assistant.component.ts` (263 lines, unrouted since S6c
    #21, imported by nothing, superseded by the tasks workspace + draft
    review) — deleted file, no spec existed for it;
  - one spec test: `api-client-supervision.spec.ts > queries the assistant
    through the secured backend endpoint` (pinned the deleted method; its
    intent — secured AI access — is covered by the chatbot contract tests).
- *Replacement:* the panel shows exactly four states off the S10b backend —
  chatbot answer, loading, error with retry, "assistant unavailable".
  `AiAssistantService` stays (still used by `ai-insights` + its spec).
- *Proof (grep, zero code references):*
  `grep -rn "queryAssistant" steg-back-office/src/app --include=*.ts` → only
  the removal note in the panel doc comment;
  `grep -rn "task-assistant\|TaskAssistant" steg-back-office/src/app
  --include=*.ts` → 0;
  `grep -rn "askLegacy\|askRuleBased" steg-back-office/src/app/features/ai`
  → 0.
- *Tests:* rewritten `assistant-panel.component.spec.ts` (8: history-once,
  history-failure still chats, degraded flag + note, error + retry, reset,
  clear-failure keeps log, empty-send guard); full Angular suite green.

## 2026-10-04 — S11 dashboards (this slice)

**#32 — legacy reporting-based dashboard code removed.**
- *Removed:*
  - `features/dashboard/dashboard.service.ts` (forkJoin over six
    `/api/reports/*` group-count endpoints + finance queue + notifications) —
    replaced by `dashboard-summary.service.ts` (one scoped summary call per
    dashboard);
  - `features/dashboard/dashboard.service.spec.ts` in full (5 tests:
    ADMIN-loads-everything, SUPERVISOR-loads-nothing, 403→unavailable,
    payment/queue normalization, overview sources) — superseded by
    `dashboard-summary.service.spec.ts` (3), which pins the same
    ok/unavailable/error contract on the summary endpoints.
- *Kept deliberately:* the six `/api/reports/*` group-count endpoints (still
  consumed by `AiAssistantService` rule engine + task-assistant insights),
  `dist-bars.component.ts` (CSS-only charts, reused by both new dashboards),
  `ai-insights.component.ts`.
- *Proof (grep, zero references):*
  `grep -rn "DashboardService\|dashboard.service" steg-back-office/src/app
  --include=*.ts | grep -v dashboard-summary` → 0.
- *Tests:* new `dashboard-summary.service.spec.ts` (3), rewritten
  `dashboard.component.spec.ts` (7), new `supervisor-home.component.spec.ts`
  (3); `ReportControllerTest` path lists extended (not deleted) for the two
  new summary endpoints; full Angular suite green.

## 2026-10-04 — S12b hardening (this slice)

**#33 — internship workflow-history client path removed (S6b residue).**
- *Missed earlier:* S6b deleted the backend internship workflow engine
  (`GET /api/internships/{id}/workflow` gone, #19) and S7 removed the
  decision path (#22), but the Angular detail bundle still fetched
  `ApiClient.getInternshipWorkflow` (always 404 → swallowed) and derived a
  validation state from actions that can never exist; the detail rendered an
  eternally-"awaiting" decision card, an empty history list and an empty
  timeline tab. Stale comments/docs named `ACCEPTED`, `ADMIN/HR` and the
  removed `COMPLETED`-step vocabulary.
- *Removed:*
  - `ApiClient.getInternshipWorkflow` (the only caller of the deleted
    endpoint) — `listWorkflowActions` stays: the endpoint is live and the
    application-review workspace uses it;
  - `InternshipService.loadBundle` workflow fetch + `workflow`/`actions`/
    `actionsRestricted`/action-derived-`validation` bundle fields (live
    tasks/journal/deliverables/evaluations fetching unchanged);
  - `api-models.ValidationState` + `deriveValidationState` (mapped the
    removed VALIDATION/COMPLETED-step vocabulary; the `ValidationDecision`
    `VALIDATED|REJECTED` type used by the S7 workspace stays);
  - `internship-detail` `validationHistory()`, `validationTone()`,
    `decisionTone()`, the decision/history card, the timeline tab + tab
    entry (the `/validation/:id` workspace link card stays);
  - orphaned dictionary keys `internshipDetail.tabTimeline`,
    `internshipDetail.timelineRestricted`, `validation.history` (fr/en/ar);
    `dossier.*` timeline keys stay (live application-workflow timeline);
  - stale wording fixed in place (not legacy, no entry needed beyond this
    line): `ACCEPTED → APPROVED` in `notAccepted*` strings (fr/en/ar),
    `ADMIN/HR → ADMIN` + `COMPLETED → VALIDATED` in client comments.
- *Deleted tests (with reason + replacement):*
  - `api-models.validation.spec.ts` in full (7: empty/non-validation/PENDING/
    REJECTED/APPROVED→VALIDATED/PENDING-wins/unknown-ignored) — pinned the
    removed mapping; replaced by the S7 `validation.service` + detail specs
    on the decisions endpoint;
  - `api-client-c3.spec.ts > getInternshipWorkflow` probe (1) — pinned the
    removed call; the file's transition/assign/certificate probes stay;
  - `internship.service.spec.ts > marks history restricted on 403` — pinned
    the removed fetch; replaced by `assembles the bundle from live endpoints
    only (no workflow fetch)`;
  - `internship-create.component.spec.ts > blocks creation from a
    non-accepted application` UPDATED (not deleted) to the APPROVED wording.
- *Proof (grep, zero references, from the monorepo root):*
  `getInternshipWorkflow` → 0; `deriveValidationState|ValidationState` → 0;
  `validationHistory` → 0; `api/internships/.*workflow` → 0 (remaining
  `workflow/actions` hits are the live APPLICATION workflow kept in #22);
  `internshipDetail.tabTimeline|internshipDetail.timelineRestricted|
  validation.history` → 0 (`dossier.*` timeline keys + the application
  review's own `actionsRestricted` stay — that workflow is live).
- *Tests:* full Angular suite green (441, 62 files); backend untouched by
  this entry.

**#34 — dead certificate `ISSUED` state removed (audit #33).**
- *Where it lived:* `CertificateStatus.ISSUED` (backend enum), the dashboard
  `countIssuedCertificates` query (`= ISSUED`), the finance
  `GENERATED||ISSUED` precondition, Angular `CertificateStatus` unions +
  list filter + tone map + dashboard `?status=ISSUED` drill-down.
- *Why it was wrong:* no code path ever wrote `ISSUED` (generation mints
  `GENERATED`, revoke mints `REVOKED`), so the dashboard tile counted a
  status nothing produces (always 0). Definition adopted per AGENTS.md §13:
  issued = generated + non-revoked.
- *Replacement:* `CertificateStatus` is `GENERATED | REVOKED`;
  `V50__certificate_issued_means_generated.sql` remaps any stray `ISSUED`
  row to `GENERATED`; tile counts `status <> REVOKED`; finance checks
  `!= REVOKED`; Angular filter/tone/drill-down use `GENERATED`.
- *Tests UPDATED, none deleted:* `DashboardSummaryIntegrationTest` fixture
  drops the synthetic `setStatus(ISSUED)` (default `GENERATED` now counts)
  + NEW `generatedCountsAsIssuedAndRevokedDropsOut` (HTTP generate → tile
  +1 → HTTP revoke → tile back); `ScenarioAAdminSupervisesChainTest`
  asserts `certificatesIssued ≥ 1`; certificate-list + dashboard specs move
  `ISSUED → GENERATED`.
- *Proof (grep, zero references):* `CertificateStatus.ISSUED` → 0 in
  backend main; `'ISSUED'` → 0 in Angular production code (remaining
  `ISSUED` hits are `RECEIPT_ISSUED` / `PAYMENT_RECEIPT_ISSUED`, different
  enums and actions).

## 2026-10-04 — pre-checks (a)–(g) (earlier slice, kept below)

No legacy behaviour, endpoint, status or test was removed in this slice. Two entries are recorded
because they change what an existing test asserts (assertions may only be UPDATED when the behaviour
they pin changes; a DELETION would need its own entry — there is none).

**#26 — clock-dependent date-filter assertion made deterministic.**
- *Where:* `CandidateWorkspaceIntegrationTest.filtersNarrowTheQueueServerSide` — the "profile creation
  date range" probes passed JVM-local `LocalDate.now()` as `from`/`to`.
- *Why it was wrong:* `CandidateWorkspaceService` evaluates the bounds with
  `from.atStartOfDay(ZoneOffset.UTC)` / `to.plusDays(1).atStartOfDay(ZoneOffset.UTC)`, but the test
  computed "today" in the JVM zone. In UTC+01:00 the suite run at 00:19 local used
  `from=2026-10-04` → `2026-10-04T00:00Z`, which is still in the future (UTC was 2026-10-03T23:19Z), so
  the count came back 0 instead of 5. A latent midnight flake, independent of this slice's changes.
- *Replacement:* the same three probes now compute `utcToday = LocalDate.now(ZoneOffset.UTC)` and use
  `from = utcToday.minusDays(1)` (window contains every row seeded by the fixture → still expects 5),
  `from = utcToday.plusDays(2)` → 0 and `to = utcToday.minusDays(2)` → 0. The assertions keep their
  intent (a window that covers the fixtures matches them all; a window outside matches none) and no
  longer depend on the hour of day. The service's UTC reading of the filter is unchanged (audit
  assumption #23 flags the user-facing consequence as a possible follow-up).
- *Proof:* full clean run `./mvnw clean test` → 691 passing, 0 failures, including this test.

**#27 — receipt-gate test scoped to its own finance case.**
- *Where:* the new `ReceiptValidationGateTest.noReceiptBeforeValidation` (added this slice, so no
  pre-existing test changed) asserted a global `receiptRepository.countByReferencePrefix("PAY-") == 1`.
- *Why it was wrong:* the Testcontainers database is shared by the whole suite, so receipts minted by the
  other finance/validation tests made the global count 3 instead of 1 — the test failed in the full run
  while passing alone.
- *Replacement:* assert on `receiptRepository.findByFinanceCaseId(<this case>)` — the reference returned
  by `generateValidationReceipt` is minted once and is unchanged after the refused call. Same intent
  (no second receipt), no dependence on unrelated rows.
