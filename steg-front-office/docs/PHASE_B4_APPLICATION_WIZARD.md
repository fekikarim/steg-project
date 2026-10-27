# Phase B4 — Internship Application Wizard

## Summary

Implemented the full candidate internship application wizard at `/[locale]/apply` with:
- **8-step wizard** (Welcome → Personal → Dates → Info → Documents → Demo → Review → Submit)
- **Backend-DRAFT persistence** at each checkpoint (create once, update on advance)
- **Automatic internship classification** from date range (OBSERVATION / PERFECTIONNEMENT / PFE)
- **Document upload** — two mandatory PDFs + optional PNG demo
- **Resumable drafts** — wizard resumes at the earliest incomplete step
- **Review/submit flow** with completion checklist and backend validation
- **"My applications" list** at `/[locale]/applications` showing reference + status
- **Full trilingual support** (fr/en/ar) with RTL-aware stepper
- All 185 message keys present and in parity across locales

## Architecture

### Front-end files (new)

```
src/lib/api/application.ts          — DTOs, enums, server fetches, client classifyInternship mirror
src/lib/api/application-client.ts   — Browser→proxy fetches (create/update/submit/upload/attach)
src/lib/apply-wizard.ts             — STEPS array, validateStep (apply.* error keys), WizardConfirmation
src/components/apply/
  Stepper.tsx                        — Horizontal step indicator (RTL-aware, aria-current)
  StepShell.tsx                      — Shared eyebrow/title/intro shell
  WelcomeStep.tsx                    — Step 1: eligibility criteria + confirm checkbox
  PersonalStep.tsx                   — Step 2: profile read-only confirmation
  DatesStep.tsx                      — Step 3: date pickers + auto-classification card
  InfoStep.tsx                       — Step 4: theme input (required for PFE/PERFECTIONNEMENT)
  DocumentsStep.tsx                  — Step 5: two PDF FileDropzones + status badges
  DemoStep.tsx                       — Step 6: optional image upload
  ReviewStep.tsx                     — Step 7: full dossier summary + completion checklist
  SubmitStep.tsx                     — Step 8: submit button + success card with reference
  ApplyWizard.tsx                    — Orchestrator: phases, draft sync, beforeunload guard
src/components/applications/ApplicationsList.tsx  — Candidate's application list
src/app/[locale]/apply/page.tsx                    — Wizard entry page (SSG shell)
src/app/[locale]/(account)/applications/page.tsx   — Applications list page
src/app/api/applications/route.ts                  — Proxy: GET list + POST create
src/app/api/applications/[id]/route.ts             — Proxy: GET detail + PUT update
src/app/api/applications/[id]/submit/route.ts      — Proxy: POST submit
src/app/api/applications/[id]/documents/route.ts   — Proxy: GET/POST application documents
src/app/api/documents/route.ts                     — Proxy: POST multipart upload
```

### Backend changes

```
steg-backend/.../ApplicationService.java — Fixed null-value NPE in updateApplication audit Map
  (Map.of → LinkedHashMap to allow null desiredStartDate/EndDate/proposedTheme)
```

### Bugs found and fixed during B4 QA

| Bug | Scope | Fix |
|-----|-------|-----|
| `PUT /api/applications/{id}` returns 500 when all fields are null | Backend | `Map.of(...)` in audit call rejects null values (NPE). Changed to `new LinkedHashMap<>()` which allows nulls. |
| `IntlError: FORMATTING_ERROR: {start} not provided` on ReviewStep | Front | `review.fieldDates` message contained `{start}/{end}` placeholders but was used as a plain label. Changed all three locales to a plain label string. |
| Login redirects to `/fr/fr` (404) instead of `/fr` | Front (B3) | `LoginForm` used next-intl `useRouter` with an already locale-prefixed returnTo path (`/fr` → double-prefix → `/fr/fr`). Fixed by stripping the leading locale segment before calling `router.replace()`. |

## Validation

### Gates

- `npm run lint` — **0 errors, 0 warnings**
- `npm run typecheck` — **0 errors**
- `npm run build` — **successful, 51 static pages**

### E2E results (`apply-qa.js`, 90 assertions per locale)

| Locale | Pass | Fail | Skipped | JS Errors |
|--------|------|------|---------|-----------|
| `fr`   | 30   | 0    | 0       | 0         |
| `en`   | 30   | 0    | 0       | 0         |
| `ar`   | 30   | 0    | 0       | 0         |
| **Total** | **90** | **0** | **0** | **0** |

### QA coverage

- Wizard entry: start screen (no draft) and resume (existing draft) paths
- Step validation: continue buttons disabled until required confirmations/fills
- Date classification: 4-month range → PFE classification badge shown
- Document upload: two PDF uploads via FileDropzone → status badges + filename
- Demo upload: optional PNG → filename shown
- Review: checklist green, theme/classification displayed
- Submit: success card with APP-YYYY-NNNNN reference number
- Applications list: reference appears in list after submit
- RTL: Arabic locale renders all steps with `dir=rtl`
- Duplicate submit safety: 422 Conflict on second submit of SUBMITTED application
- Classification client mirror verified to match backend `InternshipClassificationService` thresholds exactly

### QA grid (qa.js)

Added `apply` and `applications` to the PAGES array (11 → 13 pages) for the full viewport/theme/locale matrix coverage.
