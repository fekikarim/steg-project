# STEG Platform — Deployment Guide

> Audience: the operator deploying the STEG platform (backend + back office +
> front office + mobile + python-ai). Written 2026-10-04, updated 2026-10-05;
> migration list current through **V53**. All gates green at the time of
> writing: backend 957+, Angular 443+, Flutter 137+1 skipped, Python 28, Next
> green. Secrets live ONLY in `.env` (never committed, never printed, never
> logged).

## 1. Components and prerequisites

| Component | Path | Runtime |
|---|---|---|
| Backend (authoritative) | `steg-backend` | Java 21, Spring Boot 4.1.1, Postgres 17, Flyway V1→V53 |
| Back office (staff) | `steg-back-office` | Node + Angular 22, served same-origin as `/api` |
| Front office (public) | `steg-front-office` | Node + Next 16 |
| Mobile "STEG intern" | `stegappe` | Flutter 3.13, Android APK |
| Document intelligence | `ai-services` | Python 3.12 FastAPI (advisory-only; the backend degrades when it is down) |

The backend degrades, never blocks: Brevo/Resend (mail), Gemini (chatbot/drafts)
and python-ai may be absent — core flows keep working.

## 2. Environment variables

Backend (`.env` next to the compose file or the process environment; see
`steg-backend/.env.example` — every secret EMPTY there):

**Required in production — the boot fails without them:**

| Variable | Meaning |
|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` in production |
| `SPRING_DATASOURCE_URL` / `_USERNAME` / `_PASSWORD` | Postgres 17 connection |
| `STEG_JWT_SECRET` | JWT signing secret — REQUIRED, no default (size ≥ 32 bytes) |
| `CORS_ALLOWED_ORIGINS` | Exact allow-list, e.g. `https://backoffice.steg.tn,https://steg.tn` — **no default in prod; never `localhost`** |

**Strongly recommended in production:**

| Variable | Default | Meaning |
|---|---|---|
| `APP_TIMEZONE` | `Africa/Tunis` | Calendar-day bounds for every date filter |
| `MALWARE_MODE` | `noop` | **`clamav` in production.** `noop` means uploads are accepted UNSCANNED. Run the `clamav` compose service and point `CLAMAV_HOST` at it (`clamav` inside compose, `localhost` for a host-run JVM) |
| `CLAMAV_HOST` / `CLAMAV_PORT` | `127.0.0.1` / `3310` | clamd INSTREAM endpoint (default port 3310, not published in compose) |
| `MALWARE_TIMEOUT_MILLIS` / `MALWARE_MAX_SCAN_BYTES` | 10000 / 26214400 | Per-scan timeout; files above the cap are rejected before scanning |
| `MALWARE_ON_ERROR` | `reject` | **Fail-closed.** Keep `reject` in production: an unreachable clamd then refuses uploads instead of storing unscanned files. `allow` is an emergency degraded mode and leaves the platform open |
| `STEG_BOOTSTRAP_ADMIN_EMAIL` / `STEG_BOOTSTRAP_ADMIN_PASSWORD` | empty | One-time first-run Admin (§6). Set BOTH, boot once, then remove them from `.env` |
| `JWT_ACCESS_EXP_MINUTES` / `JWT_REFRESH_EXP_DAYS` | 15 / 7 | Token lifetimes |
| `RESEND_API_KEY`, `NOTIFICATIONS_MAIL_ENABLED`, `NOTIFICATIONS_MAIL_FROM` | off | Transactional email (credentials, decisions); off = degraded mode |
| `AI_ENABLED`, `AI_API_KEY` (or `GEMINI_API_KEY`), `GEMINI_MODEL` (or `AI_MODEL`) | off | Chatbot + AI task drafts; blank model = friendly "unavailable" |
| `PYTHON_AI_SERVICE_BASE_URL`, `PYTHON_AI_SERVICE_TOKEN` | empty | Document verification; empty = degraded, manual validation still works |
| `PYTHON_AI_TIMEOUT_MS`, `PYTHON_AI_MAX_ATTEMPTS`, `PYTHON_AI_CIRCUIT_THRESHOLD` | 15000 / 2 / 5 | python-ai client policy |
| `LOCKOUT_MAX_ATTEMPTS` / `LOCKOUT_DURATION_MINUTES` | 5 / 30 | Login lockout |
| `STORAGE_PROVIDER` / `STORAGE_LOCAL_ROOT` | local / ./storage/uploads | Where generated PDFs and uploads live — BACK THIS UP with the database |
| `FINANCE_RATE_PER_MONTH` / `_MAX_PAYABLE_MONTHS` / `_MAX_AMOUNT` / `_CURRENCY` | 50 / 3 / 150 / TND | Payment policy |
| `GROUPS_COMPLETED_INTERN_ACCESS` | `retain` | `TODO — STEG VALIDATION REQUIRED`: confirm with STEG policy |
| `DOCUMENTS_GENERATION_LOCATION` | `Tunis` | `TODO — STEG VALIDATION REQUIRED`: printed "Fait à …" |

**Mobile (`stegappe`) — build-time dart-defines, NO dev default exists:**

```
flutter build apk --release --dart-define=API_BASE_URL=https://api.steg.tn
# optional when WS lives elsewhere: --dart-define=WS_BASE_URL=wss://api.steg.tn
```

A release built without `API_BASE_URL` refuses to start (`AppConfig.ensureConfigured`).

**Back office:** `environment.prod.ts` ships `apiBaseUrl: '/api'` — serve the
Angular build from the same origin as the backend (reverse proxy) so no
absolute URL and no localhost ever lands in the bundle. Verify with
`scripts/check-production-hygiene.sh` (fails on any dev address in
`dist/`, `environment.prod.ts`, `application-prod.yml` or `stegappe/lib`).

## 3. Database migrations (Flyway)

Flyway runs automatically on every backend boot (`validate-on-migrate` in
prod). **Never edit an applied migration** — fixes continue as new versions.

- **Fresh install:** V1 → V53 in order. The V15/V27 seed rows are QA-era
  content; the production guard (§6) neutralizes the dangerous part.
- **Upgrading an existing database:** apply everything after your current
  version; the chain from V33 with legacy data is proven by
  `MigrationChainIntegrationTest` (roles, statuses, supervisor backfill).

| Migration | Purpose (V34 → V52) |
|---|---|
| V34 `remove_obsolete_roles` | Drop HR/FINANCE/DIRECTOR; holders → ADMIN |
| V35 `user_supervision_scope` | `supervisor_user_id` on internships + assignments |
| V36 `allow_user_backed_assignments` | Assignments may point directly at IAM users |
| V37 `user_must_change_password` | Forced first-login rotation flag |
| V38 `task_review_state` | Task approve/deny + reason |
| V39 `explicit_application_internship_statuses` | First status mapping |
| V40 `assign_default_admin_to_unsupervised_internships` | Oldest ADMIN backfilled as supervisor |
| V41 `candidate_soft_delete` | `deleted_at` + live index |
| V42 `candidate_live_identity_uniqueness` | CIN uniqueness on live rows only |
| V43 `drop_legacy_status_values` | Final legacy status mapping, APPROVED default |
| V44 `candidate_managed_by_user` | Staff-created profiles |
| V45 `validation_runs_and_decisions` | AI runs + manual per-document decisions |
| V46 `certificate_version_history` | Certificate versions + `certificate_reference_seq` |
| V47 `audit_source` | `audit_logs.source` channel column |
| V48 `ai_task_drafts` | Server-side AI drafts |
| V49 `ai_chatbot_history` | Bounded per-user chatbot history |
| V50 `certificate_issued_means_generated` | Dead ISSUED state collapsed to GENERATED |
| V51 `sequence_backed_references` | Atomic FC-/PAY-/DOC- numbering |
| V52 `backfill_reference_sequences` | **Production-critical:** moves FC/PAY/DOC/CERT sequences above the highest existing numeric suffix, so an upgraded database never re-mints `FC-2026-00001`-style rows (idempotent; empty DB keeps 1) |
| V53 `user_credentials_updated_at` | Credential version per user: access tokens issued before a password reset stop working immediately, not at expiry |

## 4. Rollback advice

1. **Backup BEFORE migrating** — mandatory: `pg_dump -Fc "$DATABASE" > backup-$(date -u +%Y%m%dT%H%M%S).dump`.
2. Flyway has **no automatic rollback**; a failed migration leaves
   `flyway_schema_history` marking the failure. Fix-forward with a NEW
   migration; to abandon a release, restore the dump (which also restores
   the previous schema history) and boot the previous backend build.
3. Sequences (V51/V52) are non-transactional by nature: after a restore, the
   sequence state from the dump is authoritative — do not hand-adjust.
4. Restores must restore `storage/uploads` (file assets) together with the
   database, or PDF links break.
5. Never `ddl-auto` anything but `validate` in prod; schema changes go through
   migrations only.

## 5. Release order

1. **Backup** (§4.1).
2. **Deploy python-ai** (any time; independent, advisory-only).
3. **Deploy the backend** (`prod` profile). Migrations run on boot; they are
   additive/backward-compatible, so already-installed clients keep working
   during the window. Verify: `GET /actuator/health` → 200 (nothing else is
   exposed: `/v3/api-docs`, `/swagger-ui.html`, `/actuator/info`,
   `/actuator/metrics` must all be 404 or 4xx — pinned by
   `ApiExposureProfileTest`).
4. **Deploy the Angular back office and the mobile APK together** (they
   consume the same contracts; releasing them in one window avoids mixed
   versions). Next front-office may follow the same window.
5. Run the smoke test (§7).

## 6. First-run admin creation

**The demo seeder must never be used in production.** It is `integration`-only
(profile-annotated; pinned by `ProductionProfileHygieneTest`), and the V27 QA
accounts carry passwords that are public in this repository
(`admin.steg@steg.tn` / `Admin#2026`). In production those three rows are
disabled **during Flyway migration — before the server accepts its first
request** (`ProdQaSeedAccountCallback`, `AFTER_MIGRATE`, prod profile only,
audited as SYSTEM `PROD_QA_SEED_ACCOUNT_DISABLED`; a failure aborts the boot),
and the login refuses any disabled or INACTIVE account
(`LOGIN_REFUSED_DISABLED_ACCOUNT`).

Create the real first Admin with the dedicated one-time bootstrap:

1. Put BOTH values in `.env` (or the process environment):
   `STEG_BOOTSTRAP_ADMIN_EMAIL=<operator address>` and
   `STEG_BOOTSTRAP_ADMIN_PASSWORD=<operator-chosen>`.
   Rules: both or neither (half-configured = the boot REFUSES), and the
   password needs ≥ 12 characters with uppercase, lowercase, digit and symbol.
   The password is BCrypt-hashed, never logged, never returned and never
   stored in the repository.
2. Boot once (`SPRING_PROFILES_ACTIVE=prod`). If no ADMIN exists, exactly ONE
   account is created with `mustChangePassword=true` — no demo data, nothing
   else. The boot log says `created the initial ADMIN account (id=…)`.
3. **Remove both variables from `.env` right away.** Keeping them is harmless
   (the bootstrap is a no-op once an Admin exists) but they are a standing
   credential in a config file.
4. Log in, let the forced password change happen, then create the real
   Supervisor accounts (Supervisor Management / Intern Accounts — one-time
   credentials, forced change at first login).

The V27 QA rows are deliberately NOT counted as "an Admin already exists":
they are seed artifacts, so they can never suppress this creation. The
bootstrap is proven by `FirstRunAdminBootstrapTest` (creates exactly once /
no-op when an Admin exists / refuses weak passwords / nothing without any
seeder).

## 7. Smoke test after every deploy

`scripts/smoke-test.sh` (24/24 at last full run) drives the real stack:
probes, seeded login, atomic approve, forced password change, validation chain,
receipt guards, audit sources. Requires the stack running (compose: Postgres,
backend `integration` profile + explicit `STEG_SEED_DEMO_*`, python-ai) and
`SMOKE_HR_PASS` exported explicitly — the script fails fast without it and
never embeds a password.

```
docker compose up -d          # postgres + python-ai (+ backend per compose)
cd scripts && SMOKE_HR_PASS=... ./smoke-test.sh
```

**Against a PRODUCTION-profile backend** the seeded QA logins are gone by
design (§6), so point the suite at operator credentials instead. `SMOKE_HR_*`
is the Admin used for approve/validate/receipt steps, `SMOKE_SUP_*` a real
Supervisor (create one in Supervisor Management — its one-time password must
be rotated once through `POST /api/auth/change-password` before the scoped
probes can pass), and `SMOKE_FIN_*` the same Admin: the FINANCE role no longer
exists (V34), finance is Admin-only:

```
SMOKE_HR_EMAIL=<admin>  SMOKE_HR_PASS=… \
SMOKE_SUP_EMAIL=<sup>  SMOKE_SUP_PASS=… \
SMOKE_FIN_EMAIL=<admin> SMOKE_FIN_PASS=… \
./scripts/smoke-test.sh
```

Verified on 2026-10-05: **24/24 probes against a `prod`-profile backend on a
freshly migrated database**, with only the bootstrap Admin and a Supervisor
created through the real Admin API (no demo seeder, no QA account).

Manual replays that stay operator tasks: A18/A19 (credentials dialog + email
status in the UI), B8/B9 (supervisor scoping on screen), C9 (degraded banners).

## 8. What remains manual / open decisions

- **Release signing:** `flutter build apk --release` succeeds but signs with
  the DEBUG key when no release keystore exists (`android/app/build.gradle`
  falls back). Provide the Play keystore + `key.properties` before store
  submission.
- `MALWARE_MODE=clamav` + a clamd host in production (fail-closed otherwise).
  The compose file now ships a `clamav` service (`clamav/clamav:stable`, named
  volume `clamavdb`, no published port) and forwards `MALWARE_MODE`,
  `CLAMAV_HOST`, `CLAMAV_PORT`, `MALWARE_TIMEOUT_MILLIS`,
  `MALWARE_MAX_SCAN_BYTES` and `MALWARE_ON_ERROR` to the backend. Verified
  live: a clean upload is accepted while clamd is up, and an unreachable clamd
  refuses the upload with 422 `MALWARE_SCAN_FAILED` when
  `MALWARE_ON_ERROR=reject`. Still an operator decision: keep `MALWARE_MODE`
  at `clamav` in production and never flip `on-error` to `allow` permanently.
  Note the image tag: `1.4` has no `linux/arm64` manifest and will not start
  on Apple Silicon — keep `stable` or pin a tag that ships an arm64 image.
- `GROUPS_COMPLETED_INTERN_ACCESS` and `DOCUMENTS_GENERATION_LOCATION`:
  `TODO — STEG VALIDATION REQUIRED`.
- Gemini keys/model per §9.5; python-ai `X-Service-Token` (rotate).
- Operator machine hygiene: remove the stray gitignored
  `steg-backend/.env.bak.*` plaintext backup noted in the audit.
- Certificates: an internship must be `VALIDATED` before the certificate and
  receipt flow; the receipt is minted once per case (V51/V52 sequences make
  the numbering race-free).
- Audit retention/export policy is Admin-UI-only today; decide the long-term
  archival process.
