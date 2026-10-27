# Phase B0 — Front Office Design Foundations

> **Status:** ✅ Complete (2026-09-06 — lint, typecheck, build green; shell verified
> in fr/en/ar; auth bridge verified end-to-end against the containerized backend)
> **Stack:** Next.js 16.3.4 (App Router) / React 19 / TypeScript (strict) /
> Tailwind CSS v4 / next-intl 4.14.2 / Node 24.20.0
> **Design baseline:** `docs/UI_UX.md` (STEG palette, themes, i18n/RTL, a11y,
> component vocabulary). No feature pages yet — B1–B3 build on this shell.

---

## 1. What was built

| B0 task | Deliverable |
|---|---|
| App Router + metadata | `src/app/layout.tsx` (icons `/logo/*`, title template, manifest) + `src/app/[locale]/layout.tsx` rendering `<html lang dir>` per locale; `/` → `/fr` |
| i18n (fr default, en, ar) | next-intl with always-prefixed routing, `fr/en/ar.json` (nav, header, home, states, errors, validation, backend status codes, dropzone), full RTL (`dir="rtl"`, logical CSS properties throughout) |
| Design system | Tailwind v4 `@theme` STEG tokens (brand `#0B61A0` scale, navy `#042843` scale, red accent, IBM Plex Sans Arabic + Plex Mono); class-driven dark mode with persisted system/light/dark + no-flash init script |
| UI kit (10 required) | `Button` (6 variants, loading, icon-only labels), `Input`, `Select`, `DatePicker` (native, browser-localized), `FileDropzone` (drag + keyboard browse, client pre-checks, backend authoritative), `Card`, `Badge` + `StatusPill` (translated backend enums, never color-only), `Table` (semantic, responsive), `Modal` (aria-modal, Esc, focus trap/restore), `Toast` (aria-live, auto-dismiss) |
| API client | `lib/api-client.ts` (`backendFetch` + `ApiError` parsed from the standard envelope: message/fieldErrors/traceId) + hand-typed `lib/api/auth.ts` from `openapi.json`; single rule — no ad-hoc fetch per page, tokens never reach the browser |
| Auth bridge | `/api/auth/{login,refresh,logout,session}` route handlers proxy the backend JWT flow into httpOnly cookies (`steg_access` 15 min `/`, `steg_refresh` 7 d `/api/auth`); `AuthProvider` exposes session state only — **verified**: login sets cookies with `{ok:true}` body, refresh rotates both tokens, logout expires both path-correct slots, bad login surfaces the envelope message + traceId |
| Conventions | `loading.tsx` skeletons, per-segment `error.tsx` + `global-error.tsx`, localized `not-found.tsx`, `EmptyState`/`ErrorState`/`Spinner`/`Skeleton` primitives |

## 2. Verification evidence

- `npm run lint` ✅ · `npm run typecheck` ✅ · `npm run build` ✅ (fr/en/ar prerendered, API routes dynamic)
- `GET /fr|/en|/ar` → 200 with correct `lang`/`dir` (`ar` → `rtl`), translated hero, STEG logo, theme script, skip link; no missing-message markers
- Auth flow against compose backend: register 201 → proxy login 200 (no tokens in body) → session true → refresh rotates both → logout clears both slots → session false
- Two real bugs found by verification and fixed: path-scoped refresh cookie survived logout (now expired per-path), and a stale dev server masked the fix (EADDRINUSE — since added to the checklist below)

## 3. Known B0 limitations (for B1+)

- Header Apply/Sign-in links target future routes (graceful localized 404 until B1).
- No test framework yet (B0 requires lint/typecheck/build only); add Vitest + Playwright with B1 journeys.
- No CI workflow file: `steg-front-office/` is not a git repo — when it becomes one, wire `lint → typecheck → build`.
- `POSTGRES_*`/backend env for local dev: document `API_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL` in B1 when feature calls land.
