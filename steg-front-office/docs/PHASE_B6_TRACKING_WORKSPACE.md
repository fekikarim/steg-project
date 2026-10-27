# Phase B6 — Application Tracking, History, Notifications & Documents

## Summary

Built the complete authenticated application workspace: upgraded applications
list (mobile cards + desktop table with detail links), new dossier detail
page (`/[locale]/applications/[id]`) with a truthful backend-timestamp
timeline, rejection/correction alerts, verification-aware documents with
authorized streaming downloads, and backend-gated withdrawal with a
consequences dialog — plus a notification bell (desktop + mobile nav),
notification center with read-state persistence, and 7 new proxy routes.
E2E: **59 pass, 0 fail** (fr/en/ar; desktop/mobile/RTL/anonymous).

## Backend changes (`steg-backend/`, live on `:8080`)

- **Workflow-state ownership check** (`WorkflowService` + `WorkflowController`):
  `GET /api/applications/{id}/workflow` previously returned any application's
  workflow state to any authenticated candidate by ID guessing (no ownership
  check; single caller, now takes the actor). Candidates are now scoped to
  their own dossiers (others → 404 without leaking existence); ADMIN/HR
  bypass. Verified live: own → 200, foreign → 404.
- No notification changes needed: list/unread-count/mark-read/mark-all are
  all recipient-scoped server-side (verified in code).

## What changed (front office)

- Proxies: `applications/[id]/withdraw` (POST), `applications/[id]/workflow`
  (GET, 404 = "no workflow yet"), `notifications` (GET, capped paging),
  `notifications/unread-count`, `notifications/[id]/read`,
  `notifications/read-all`, `documents/[id]/download` (streams bytes through
  with content headers; never buffered; same-origin anchor keeps httpOnly
  cookies, no token/storage path in DOM or URL).
- `ApplicationsList` — newest-first; cards on phones, accessible table on
  `md+` (reference/type/dates/status/updated/View); empty state with start
  link; per-card N+1 doc fetch removed (verification lives on the detail).
- `ApplicationDetail` — dossier header (reference + status/type/requirement
  pills), status guidance line, current workflow step when present,
  rejection/correction alert cards, overview grid (localized dates),
  milestone timeline built ONLY from backend timestamps
  (created → submitted → withdrawn/current; skipped when a date is absent;
  `<time dateTime>` carries raw ISO), document checklist with type labels,
  verification pills, reviewer comments and downloads, DRAFT → continue in
  wizard, withdraw button (hidden for ACCEPTED/WITHDRAWN with an explanatory
  note) opening a consequences `Modal`; success toasts + refetch, backend
  rejections surface inline with traceId.
- `NotificationBell` — header (desktop toolbar + mobile drawer), unread
  badge with full-sentence aria-label, 60 s visibility-aware polling + focus
  refetch + `notifications:changed` event refresh; hidden while anonymous.
- `NotificationsCenter` — unread/read grouping, priority pills, relative
  timestamps (localized), deep links only for known
  `InternshipApplication` relations, mark-one/mark-all with server refetch,
  load-more paging, empty/anonymous/error states.
- `lib/notifications.ts` — polling seam: swapping in WebSocket push means
  replacing `startNotificationPolling` internals, no UI changes.
- `Stepper` — fixed pre-existing overflow (8 labeled pills overflowed at
  375/768/desktop widths): number-only pills + visible "Step X of 8 — label"
  caption, labels screen-reader-only.
- i18n: new `tracking` + `notifications` namespaces, `nav.notifications`,
  `LOW/NORMAL/HIGH/URGENT` statuses (~70 keys × fr/en/ar); parity 658 each;
  removed 3 orphaned `apply.*` keys left by the list migration.
- Two front bugs fixed en route: layout-level server `getTranslations` for
  the new namespace returned raw keys in the header, so the bell resolves
  labels client-side (proven path); `notFound()` thrown from an async fetch
  callback never rendered the boundary — detail now flips to a `missing`
  phase and raises it during render.

## Validation

- `npm run lint` / `typecheck` clean; `npm run build` success (57 pages,
  incl. detail, notifications, and all new API routes).
- `steg-intern/qa/b6-qa.js` — **59 pass, 0 fail**: fresh-user
  register → empty state → wizard → submit → list (reference/status/dates/
  table/link) → detail (header/timeline/docs/download-bytes-equal/upload/
  status-help) → timeline `<time dateTime>` equals backend ISO values →
  cross-user detail shows not-found UI with zero data + workflow 404 while
  own workflow stays 200 → withdraw dialog/Esc/confirm → WITHDRAWN + toast +
  button gone + second withdraw rejected (409/422) → notifications center
  (grouping/priority/deep-link) → bell 2 → mark-one persists across reload →
  bell 1 → mark-all persists → count 0 → en/ar layouts, RTL, no overflow,
  anonymous gates. Seeded notifications removed afterwards; zero live DRAFTs.
- REJECTED/NEEDS_CORRECTION alert rendering is covered by design (conditional
  on backend `rejectionReason`/`correctionComment`); no staff credentials
  exist in QA to produce those states live.

## Known follow-ups (out of B6 scope)

1. **New-user onboarding gap (B3 severity, found during B6 QA):** registration
   creates no `Candidate` row (correctly — CIN + university are required and
   not collected at signup), but no UI path exists to `POST /api/candidates`
   either: `/profile` links profile-less users to `/apply`, whose bootstrap
   404s on the missing profile — a dead-end loop for every new registrant. A
   profile-creation form (or wizard-integrated onboarding) is needed.
2. **Application-level generated/admin documents** (certificates, receipts)
   surface once the backend links them to applications; the detail documents
   section is structured to render them when exposed.
3. **Live push** for notifications (WebSocket) can replace the polling seam
   without UI changes.
