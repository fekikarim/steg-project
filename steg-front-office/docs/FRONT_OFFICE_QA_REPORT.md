# Front Office QA Report — Phase B7

## Scope and method

Product-quality closure pass over every public and authenticated screen
(Home, About, History, Internships, FAQ, Contact, Login, Register, Profile,
Apply, Applications, Application Detail, Notifications) against UI_UX §§1–21:
screenshot review (desktop 1280 + mobile 375, light + dark), an automated
viewport/locale/theme grid, axe scans (light + dark, fr + ar), keyboard and
screen-reader paths inside the E2E suites, Lighthouse on the production
build, font/image/client-component/API audits, a live OpenAPI contract
check, a consolidated user journey, and a clean-install full-suite run.

## Tested matrix

- **Viewports:** xs 375, sm 430, md 768, lg 1280, xl 1536 (grid); mobile
  375 + desktop 1280 for journey/a11y/perf spot checks.
- **Locales/themes:** fr, en, ar × light, dark — 546 grid checks (anonymous
  all viewports; authenticated lg + xs), all green, zero overflows, zero
  console/network issues after fixes.
- **E2E flows:** public navigation (18 checks), register → profile-create →
  profile-update → protected returnTo round-trip → wizard (classification,
  resume, uploads, submit) → tracking → withdraw (+double-withdraw 4xx) →
  notifications (badge → read persists → read-all) → logout → RTL smoke:
  **43/43** (`qa/b7-journey.js`). Regression: onboarding **45/45**, B6
  **59/59**, B5 **47/47**, contract **101/101**.

## Accessibility findings

- axe-core: **0 violations** across 12 page scans (fr + ar, home/login/
  profile/apply/applications/notifications) plus 4 dark-mode scans.
- Keyboard paths verified in-suite: dropzone Enter-to-browse, withdraw
  dialog Esc, chip inputs, native date/select controls, skip link.
- Real defects fixed: **4 content pages had no `<h1>`** (title was `<h2>` —
  now promoted, styling unchanged); register page now interpolates hint
  variables server-side (was throwing `FORMATTING_ERROR` on every render).
- Contrast verified by axe in both themes; status never color-only (pills
  carry glyph + translated text); reduced-motion respected on progress and
  spinners; live regions (`alert`/`status`/progressbar) asserted in E2E.

## Performance measurements (production build, `:3100`)

- Lighthouse desktop: **100 / 100 / 100 / 100**, LCP 794 ms, CLS 0.
- Lighthouse mobile (simulated Moto G4): **88** / 100 / 100 / 100,
  LCP ~4.0 s (font-bound text hero under extreme throttling; payload lean:
  ~120 KB JS, ~140 KB self-hosted fonts, SSG HTML ~26 KB).
- Fonts self-hosted via `next/font` (`display: swap`, latin+arabic); zero
  raw `<img>` (all `next/image`, explicit dimensions); 4 zero-hook
  components de-cliented (`Card`, `FieldError`, `Skeleton`, `StepShell`);
  per-route splitting automatic; all content pages SSG, only login + APIs
  dynamic; N+1 list fetch removed in B6; notification polling merges instead
  of resetting; theme init script prevents theme flash.

## Fixed issues (this phase)

1. White-on-white final CTA — root cause: plain-concat `cx()` let variant
   classes fight caller overrides. `cx` now uses `tailwind-merge`.
2. Internships "Candidater ▸" arrow wrapping alone — single nowrap anchor
   with logical spacing and mirrored RTL arrow.
3. Home step-3 copy advertised a CIN upload that does not exist — aligned to
   the real 2-PDF requirement (×3 locales); also fixed an English "optional"
   inside French copy and a French fragment inside Arabic copy.
4. Header auth buttons wrapping at 1280 — `whitespace-nowrap`.
5. Application reference wrapping in the tracking table — `whitespace-nowrap`.
6. Unbounded applications list (42 rows observed) — incremental show-more
   paging (notifications pattern), new `tracking.showMore` key ×3.
7. Server `FORMATTING_ERROR` spam on `/register` — `passwordHint`/`minLength`
   interpolated at the page, client `.replace` hacks removed.
8. CIN action buttons overflowed at 375 px — wrapping row.
9. Missing `<h1>` on About/Internships/FAQ/Contact.
10. `returnTo=/apply` (locale-less, as built by next-intl callers) landed on
    home — `LoginForm` now normalizes prefixed and bare paths.
11. Footer logo stretched (flex-column stretch + inexact attrs) — natural
    dimensions + `self-start`; Lighthouse best-practices 96 → **100**.
12. Notification polls reset paged lists — merge-by-id refresh.

## Remaining validated TODOs

- Mobile Lighthouse 88 under simulated throttling: no further action
  (lean payload, nothing actionable in opportunities beyond 27 KiB unused
  JS); re-measure on real devices before optimizing further.
- REJECTED/NEEDS_CORRECTION alert rendering is covered by design (no staff
  credentials in QA to produce those states live).
- The floating "N" disc seen in dev screenshots is a dev-overlay artifact:
  absent from production DOM and screenshots.
- Backend OpenAPI error responses reuse success schemas cosmetically; the
  runtime envelope is asserted live by `qa/contract-check.js` instead.

## Addendum — trilingual completeness sweep (post-B7)

User screenshots showed Arabic pages rendering French eyebrows/captions,
English badges and garbled mixed-script titles. A static scan
(`qa/literal-scan2.js`) plus per-locale runtime script detection found the
cause: the parallel apply-wizard/B7-page refactor had introduced ~120
hardcoded French literals bypassing the message files (message parity held
at 931 keys throughout, which is why key-count checks never caught it).

Fixed, with key parity (fr/en/ar, now 1077 keys each, zero missing/extra):
About (10: eyebrows, image alt/caption, translated tier badges, video meta
and fallback, impact badge; platform parentheticals removed from facet
titles since badges now carry that identity), Review/Submit/Dates/Documents/
Personal wizard steps (edit button, CIN/phone/birth/education/detail labels,
localized duration via existing ICU keys, rule descriptions via existing
type keys instead of raw English mirror text, privacy note, locale-appropriate
placeholders, anonymous-bridge strings), ActiveSituationBanner (6 keys +
locale-aware dates replacing browser-locale `toLocaleDateString`),
AdministrativeDocsSection subtitle (+ locale-aware date), Footer/Header/
not-found strings, nav landmark labels, stepper progress label, and full
content translation of Home (20), Internships matrix + sections (19), Apply
landing (15), History (11), FAQ (11), Contact (4) and Companion (5) pages,
plus localized document `<title>`/description via `generateMetadata` in the
locale layout.

Deliberate terminology (documented, consistent): `STEG`, `PFE`,
`Perfectionnement`, `CIN`, `Internship Companion`, `1080p`/`Full HD`,
`SHA-256`, native language names and reference numbers stay invariant;
backend/university proper nouns and user-typed data render verbatim.
Claims fix: the home "QR code" certificate claim was removed (no backend QR
support); "SHA-256 Chiffré" corrected to fingerprint wording.

Bidi: translated badges/titles eliminated the garbled parentheticals
(verified by screenshot); mixed-script cells verified visually (ar matrix,
ar wizard); technical tokens use `dir="ltr"` spans.

Verification: `qa/b7-i18n.js` — **63/63** (en: zero French across 13 pages;
ar: Arabic content + zero French + zero unapproved Latin across 15 pages
incl. dossier detail; fr: zero Arabic leakage; locale switch preserves path,
flips `dir`, swaps content fr→ar→en). Onboarding suite **46/46** against the
refactored wizard, incl. a CIN-privacy assertion.

Security finding fixed en route: the refactored wizard persisted the full
draft — including the national ID — to `sessionStorage` on every keystroke.
`saveDraftToStorage` now strips `nationalId` (empty string, type-safe); the
existing profile-merge on load restores it, so resume behavior is identical
(E2E asserts the stored draft carries no CIN value). Tokens/passwords/JWTs
were verified absent from storage, cookies-visible-to-JS and DOM.

Remaining notes: B5/B6/journey suites encode the pre-refactor wizard flow
(the refactor is in-progress parallel work); the new wizard was verified
end-to-end instead (prefill → 7 steps → submit reference, 5/5, no JS
errors). `profile.summaryTitle` is a dead key (untouched). Grid re-run:
**546/546, zero issues**. Lint/typecheck/build green.
