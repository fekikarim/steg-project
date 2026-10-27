# Phase B5 — Secure Document Upload & Dossier Review

## Summary

Turned the B4 upload slots into a production-quality, trustworthy document
experience: backend-confirmed constraints displayed per slot, real accessible
upload progress with cancel, localized backend-error surfacing with retry,
metadata + verification success states, required-vs-optional dossier review,
and a submit gate checked against backend data. All 47 E2E assertions pass
(fr/en/ar), lint/typecheck/build green.

Backend-confirmed rules (authority: `DocumentValidationService` —
`SIZE_LIMITS`, `ALLOWED_MIME_TYPES`):

| Slot | Types | Max | Required |
|---|---|---|---|
| `INTERNSHIP_APPLICATION` | PDF only | 10 MB (default cap) | yes |
| `ASSIGNMENT_LETTER` | PDF only | 10 MB (default cap) | yes |
| `PROJECT_DEMO_IMAGE` | JPEG/PNG/JPG | 15 MB | no |

## What changed

### Front office (`steg-front-office/`)

- `src/lib/api/application.ts` — added `DOCUMENT_RULES` (cited to the Java
  source lines); hardened server `uploadDocument` with a 120 s budget and
  full-envelope errors (preserves backend `code`; 504 upstream-timeout /
  502 upstream-unreachable proxy semantics).
- `src/lib/upload.ts` (new) — XHR transport against same-origin
  `/api/documents`: real `upload.onprogress`, `AbortSignal` cancel,
  configurable timeout; typed `UploadFailure`
  (cancelled/timeout/network/api with status+code+traceId). Never logs
  file names or contents.
- `src/lib/api/application-client.ts` — added `uploadFileWithProgress`,
  normalizing transport failures to `ApiError` codes (`UPLOAD_CANCELLED`,
  `UPLOAD_TIMEOUT`, `UPLOAD_NETWORK`) so the UI localizes through one path.
- `src/app/api/documents/route.ts` — proxy `mapError` now forwards the
  backend error `code` (`error` field); previously it was dropped, making
  localized server-error mapping impossible.
- `src/components/ui/FileDropzone.tsx` — added `managed` mode (pure picker,
  parent owns state display), `allowedExtensions` UX pre-check
  (`dropzone.invalidType`), and `pickerRef` so a Replace button can open
  the picker. Drag/drop + click + keyboard activation retained.
- `src/components/apply/DocumentSlot.tsx` (new) — full B5 slot: required /
  optional badge, exact formats + max size, privacy notice, accessible
  progress (`role=progressbar`, `aria-valuenow/valuetext`, reduced-motion
  safe) with Cancel, error/cancelled states (`role=alert`/`status`) with
  traceId and Retry (retry offered only for transient failures; deterministic
  rejections keep the picker enabled for a different file), success state
  with file name/size/MIME/uploaded date, verification `StatusPill`,
  reviewer comment, restricted-access badge, Replace/Remove. Renders only
  safe metadata — the backend exposes no storage keys/paths at all.
- `src/components/apply/ApplyWizard.tsx` — progress-aware slot state
  machine (`idle/uploading/attaching/error/cancelled`), single-flight DRAFT
  creation across concurrent slots, failed replace keeps the previous
  attachment, cancel preserves the draft, 409-on-attach re-reads backend
  state, demo attaches with `mandatory: false` (was `true`), and
  `handleSubmit` re-reads `getApplicationDocuments` — submission is blocked
  unless every mandatory kind is attached in the wizard AND present
  server-side (`submitBlockedDocs`).
- `src/components/apply/ReviewStep.tsx` — required docs show verification
  pills + file names (missing → error badge), reviewer comments surfaced,
  demo section unchanged in structure.
- `src/components/applications/ApplicationsList.tsx` — each application
  card lazily loads its dossier and shows per-document verification pills
  plus flagged reviewer comments (post-submit NEEDS_CORRECTION visibility).
- `src/components/ui/Badge.tsx` — `STATUS_TONE` gains `VERIFIED`
  (success) and `REQUIRES_CORRECTION` (warning); `StatusPill` reused.
- `src/components/apply/Stepper.tsx` — fixed a pre-existing overflow: the
  8-step labeled milestone row overflowed at 375 px, 768 px, and desktop
  content widths (labels never fit). Pills are now number-only (labels
  screen-reader-only) with a visible "Step X of 8 — label" caption.
- i18n: ~30 new keys × fr/en/ar under `apply.documents` (states, errors,
  privacy, verification), `status` (+2), `dropzone` (+1); parity 584 keys
  each; removed superseded `uploadError`/`attachError`.

### Backend (`steg-backend/`)

The updated backend is **live on `:8080`** (operational closure 2026-09-10):
rebuilt jar from updated source, clean boot
(`Started StegBackendApplication`, zero ERROR lines), verified in-jar
(`application.yml` 25 MB ceiling + `MaxUploadSizeExceededException` mapping
present in `GlobalExceptionHandler`).

1. `application.yml` — `spring.servlet.multipart.max-file-size/max-request-size:
   25MB`. Root cause found by B5 QA: Spring's 1 MB default cap rejected
   every file over 1 MB with an unfriendly 500 before domain validation ran,
   making the documented 10/15 MB limits unreachable. The ceiling sits above
   the largest domain cap (25 MB report); per-type authority stays in
   `DocumentValidationService`.
2. `GlobalExceptionHandler` — `MaxUploadSizeExceededException` → 413 with
   code `FILE_TOO_LARGE` (same code as domain validation) instead of 500.

Live-verified against the actual `:8080` instance:

## Bugs found and fixed during B5 QA

| Bug | Scope | Fix |
|-----|-------|-----|
| Backend 500s any upload > 1 MB (Spring default cap, pre-Tika) | Backend | 25 MB servlet ceiling + 413 `FILE_TOO_LARGE` handler |
| Proxy dropped backend error `code` (no localized mapping possible) | Front proxy | Forward `error: err.code` in `mapError` |
| Server `uploadDocument` hung forever, dropped error code | Front server lib | 120 s timeout, full envelope, 502/504 semantics |
| Demo attached with `mandatory: true` | Wizard | `mandatory: DOCUMENT_RULES[kind].required` |
| Stepper overflowed at 375/768/desktop widths | Stepper | Number-only pills + caption |
| Old attachment hidden during error/cancel phases | DocumentSlot | Success block renders whenever an attachment exists |

## Validation

- `npm run lint` — 0 errors, 0 warnings; `typecheck` — 0 errors;
  `npm run build` — success (51 pages).
- `qa/b5-qa.js` (durable copy at `steg-intern/qa/b5-qa.js`) — **47 pass,
  0 fail on the live `:8080` stack** (browser → front `:3000` → backend
  `:8080` jar → Postgres): slot chrome (required/formats/size/
  privacy), client pre-checks with zero network (wrong extension, oversize),
  valid PDF 201 + Pending pill, response-key allowlist (no storageKey/bucket/
  path patterns), EMPTY_FILE 422 localized, spoofed-MIME 422 + traceId +
  old-attachment preserved, network-abort → localized → retry succeeds,
  throttled-upload progressbar `aria-valuenow/valuetext` → cancel keeps
  previous attachment and draft, direct 11 MB → 422 `FILE_TOO_LARGE` code
  forwarded through proxy, demo upload, review pills + filenames, submit
  through the backend-data gate with reference, EN smoke, AR mobile RTL +
  keyboard-Enter file-chooser upload + no overflow.
- Backend full test suite not re-run (Testcontainers); the multipart +
  handler changes were verified live (2 MB → 201 with correct mime/size,
  11 MB → 422 `FILE_TOO_LARGE` + traceId + detail, 30 MB → 413
  `FILE_TOO_LARGE` + traceId, spoofed PNG-as-PDF → 422
  `MIME_TYPE_SPOOFING_DETECTED` + traceId) and end-to-end through the proxy
  (47/47 above, including `server-oversize-code-forwarded`).

## Operational closure (2026-09-10, `:8080`)

- Previous IDE-run backend was already stopped; rebuilt the jar from updated
  source and started it on `:8080` (local profile, Postgres `steg_db`,
  backend cwd); front dev on `:3000` proxies to it (login 200 verified).
- Live process: backend jar + front dev confirmed on their ports, both
  health checks 200, backend log shows a clean boot with zero ERROR lines.
- Post-run state: zero live DRAFTs, `/tmp` probe files/cookies/tokens
  removed (`qa_email.txt` retained for future runs), no stray processes.
- Note: the OS temp QA sandbox had been wiped between sessions, so
  Playwright/Chromium and `b5-qa.js` were rebuilt; the durable copy now
  lives at `steg-intern/qa/b5-qa.js`.

## Deliberate scope notes

- No backend detach endpoint exists: Remove clears the slot/submit-gate
  locally; the superseded attachment stays stored. Replace supersedes the
  same way (`docsToUploads` last-wins). The pre-submit gate requires slot
  AND server agreement, so divergence blocks rather than corrupts.
- `Map.entry` also rejects nulls — the B4 audit-map lesson from the PUT-500
  fix applies anywhere nullable values are logged.
- Retry is offered only for transient failures (network/timeout/rate-limit/
  attach/generic); deterministic rejections (too large, empty, spoofed,
  wrong type) keep the picker enabled for a different file instead.
