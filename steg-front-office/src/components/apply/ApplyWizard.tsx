'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {ApiError} from '@/lib/api-client';
import type {CandidateProfile, University} from '@/lib/api/candidate';
import {
  classifyInternship,
  DOCUMENT_RULES,
  type ApplicationDocumentResponse,
  type ApplicationResponse,
  type ClassificationResult,
  type DocumentAiValidation,
  type DocumentType,
  validatePublicDocumentAi,
  validateStoredDocumentAiBrowser,
} from '@/lib/api/application';
import {
  attachDocument,
  createDraft,
  getApplication,
  getApplicationDocuments,
  updateDraft,
  submit,
  uploadFileWithProgress,
} from '@/lib/api/application-client';
import {createProfile, fetchUniversities, getProfile, updateProfile} from '@/lib/api/profile-client';
import {validateIdentifiersClient} from '@/lib/api/candidate';
import {extensionsLabel, formatBytes} from '@/lib/files';
import {useToast} from '@/components/ui/Toast';
import {Button} from '@/components/ui/Button';
import {Link} from '@/i18n/navigation';
import {CardSkeleton} from '@/components/feedback/Skeleton';
import {ErrorState} from '@/components/feedback/ErrorState';
import {Stepper, type StepDef} from './Stepper';
import {PersonalStep} from './PersonalStep';
import {EducationStep} from './EducationStep';
import {DatesStep} from './DatesStep';
import {DocumentsStep} from './DocumentsStep';
import {ReviewStep} from './ReviewStep';
import {SubmitStep} from './SubmitStep';
import {Modal} from '@/components/ui/Modal';
import {
  INITIAL_WIZARD_DRAFT,
  STEPS,
  validateStep,
  type StepId,
  type UploadKind,
  type WizardDraft,
} from '@/lib/apply-wizard';
import {idleSlot, type SlotError, type SlotState} from './DocumentSlot';

type Phase = 'loading' | 'ready' | 'error' | 'alreadyApplied';

const STEP_DEFS: StepDef[] = STEPS.map((id) => ({id, key: id}));

// ---- Robust persistence (v3) ----
const STORAGE_KEY_V3 = 'steg_apply_wizard_v3';
const STORAGE_VERSION = 3;
const STORAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const LEGACY_KEYS = ['steg_apply_wizard_draft_v2', 'steg_apply_wizard_step_v2', 'steg_apply_wizard_files_v2'];

type PendingFileMeta = Record<UploadKind, {name: string; size: number} | null>;
const EMPTY_META: PendingFileMeta = {INTERNSHIP_APPLICATION: null, ASSIGNMENT_LETTER: null};

interface StoredWizard {
  v: number;
  ts: number;
  draft: WizardDraft;
  stepIndex: number;
  pendingMeta: PendingFileMeta;
  appId: string | null;
  isAuthenticated: boolean;
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readStoredWizard(): StoredWizard | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V3);
    if (!raw) return null;
    const parsed = safeJsonParse<StoredWizard>(raw);
    if (!parsed || parsed.v !== STORAGE_VERSION || typeof parsed.ts !== 'number') return null;
    if (Date.now() - parsed.ts > STORAGE_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY_V3);
      return null;
    }
    // Basic shape validation
    if (!parsed.draft || typeof parsed.stepIndex !== 'number' || !parsed.pendingMeta) return null;
    if (parsed.stepIndex < 0 || parsed.stepIndex >= STEPS.length) parsed.stepIndex = 0;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredWizard(draft: WizardDraft, stepIndex: number, pendingMeta: PendingFileMeta, appId: string | null, isAuthenticated: boolean) {
  try {
    const payload: StoredWizard = {
      v: STORAGE_VERSION,
      ts: Date.now(),
      draft,
      stepIndex: Math.min(Math.max(stepIndex, 0), STEPS.length - 1),
      pendingMeta,
      appId,
      isAuthenticated,
    };
    localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(payload));
  } catch {
    /* quota or private mode — ignore, backend remains truth */
  }
}

function clearStoredWizard() {
  try {
    localStorage.removeItem(STORAGE_KEY_V3);
    // Clean legacy keys (sessionStorage + localStorage)
    for (const k of LEGACY_KEYS) {
      try {
        sessionStorage.removeItem(k);
      } catch {}
      try {
        localStorage.removeItem(k);
      } catch {}
    }
  } catch {
    /* ignore */
  }
}

function migrateLegacyStorage(): StoredWizard | null {
  try {
    const draftRaw = sessionStorage.getItem('steg_apply_wizard_draft_v2') || localStorage.getItem('steg_apply_wizard_draft_v2');
    const stepRaw = sessionStorage.getItem('steg_apply_wizard_step_v2') || localStorage.getItem('steg_apply_wizard_step_v2');
    const filesRaw = sessionStorage.getItem('steg_apply_wizard_files_v2') || localStorage.getItem('steg_apply_wizard_files_v2');
    if (!draftRaw && !stepRaw && !filesRaw) return null;
    const draft = draftRaw ? safeJsonParse<WizardDraft>(draftRaw) : null;
    const step = stepRaw ? Number.parseInt(stepRaw, 10) : 0;
    const meta = filesRaw ? safeJsonParse<PendingFileMeta>(filesRaw) : null;
    if (!draft && Number.isNaN(step) && !meta) return null;
    const payload: StoredWizard = {
      v: STORAGE_VERSION,
      ts: Date.now(),
      draft: draft || INITIAL_WIZARD_DRAFT,
      stepIndex: Number.isInteger(step) ? Math.min(Math.max(step as number, 0), STEPS.length - 1) : 0,
      pendingMeta: meta || {...EMPTY_META},
      appId: null,
      isAuthenticated: false,
    };
    // Write to new key and clear legacy
    writeStoredWizard(payload.draft, payload.stepIndex, payload.pendingMeta, payload.appId, payload.isAuthenticated);
    for (const k of LEGACY_KEYS) {
      try {
        sessionStorage.removeItem(k);
      } catch {}
      try {
        localStorage.removeItem(k);
      } catch {}
    }
    return payload;
  } catch {
    return null;
  }
}

// Legacy helpers kept for file-meta updates (now backed by v3)
function readPendingMeta(): PendingFileMeta {
  const stored = readStoredWizard() || migrateLegacyStorage();
  if (stored?.pendingMeta) return stored.pendingMeta;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V3);
    if (raw) {
      const p = safeJsonParse<StoredWizard>(raw);
      if (p?.pendingMeta) return p.pendingMeta;
    }
  } catch {}
  return {...EMPTY_META};
}

function writePendingMeta(meta: PendingFileMeta) {
  const stored = readStoredWizard();
  if (stored) {
    writeStoredWizard(stored.draft, stored.stepIndex, meta, stored.appId, stored.isAuthenticated);
  } else {
    // No wizard yet — store minimal for file meta
    writeStoredWizard(INITIAL_WIZARD_DRAFT, 0, meta, null, false);
  }
}

/** File objects cannot survive reloads or locale navigations — only metadata. */
function setPendingMetaKind(kind: UploadKind, value: {name: string; size: number} | null) {
  const next = {...readPendingMeta(), [kind]: value};
  writePendingMeta(next);
  return next;
}

function clearWizardStorage() {
  clearStoredWizard();
}

function docsToUploads(docs: ApplicationDocumentResponse[]) {
  const next = {
    INTERNSHIP_APPLICATION: null,
    ASSIGNMENT_LETTER: null,
  } as Record<UploadKind, ApplicationDocumentResponse | null>;
  for (const d of docs) {
    if (d.document.type === 'INTERNSHIP_APPLICATION') next.INTERNSHIP_APPLICATION = d;
    else if (d.document.type === 'ASSIGNMENT_LETTER') next.ASSIGNMENT_LETTER = d;
  }
  return next;
}

/**
 * 7-step guided Apply wizard.
 *
 * Core Principles:
 * 1. Anonymous candidates are never blocked from completing steps 1 to 6.
 * 2. Authenticated candidates receive intelligent profile prefilling with a notice.
 * 3. Step 3 (Dates) provides live interactive classification preview (backend remains authoritative).
 * 4. Step 5 (Documents) supports client-side queuing for anonymous candidates and live upload for authenticated candidates.
 * 5. Step 7 provides submission tracking or an inline authentication bridge for anonymous candidates.
 */
export function ApplyWizard() {
  const t = useTranslations('apply');
  const tnav = useTranslations('apply.nav');
  const tError = useTranslations('apply.submit');
  const td = useTranslations('apply.documents');
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>('loading');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPrefilled, setIsPrefilled] = useState(false);
  const [app, setApp] = useState<ApplicationResponse | null>(null);
  const [, setProfile] = useState<CandidateProfile | null>(null);
  const [universities, setUniversities] = useState<University[]>([]);
  const [loadingError, setLoadingError] = useState(
    null as null | {title: string; hint: string; traceId?: string | null},
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<WizardDraft>(INITIAL_WIZARD_DRAFT);
  const [pendingMeta, setPendingMeta] = useState<PendingFileMeta>({...EMPTY_META});

  /* AI validation per slot (wizard gate – not the same as backend verification) */
  const [aiValidations, setAiValidations] = useState<Record<UploadKind, DocumentAiValidation | null>>({
    INTERNSHIP_APPLICATION: null,
    ASSIGNMENT_LETTER: null,
  });
  const [aiValidating, setAiValidating] = useState<Record<UploadKind, boolean>>({
    INTERNSHIP_APPLICATION: false,
    ASSIGNMENT_LETTER: false,
  });
  const [aiErrors, setAiErrors] = useState<Record<UploadKind, SlotError | null>>({
    INTERNSHIP_APPLICATION: null,
    ASSIGNMENT_LETTER: null,
  });

  /* documents state */
  const [slots, setSlots] = useState<Record<UploadKind, SlotState>>({
    INTERNSHIP_APPLICATION: idleSlot(),
    ASSIGNMENT_LETTER: idleSlot(),
  });

  const pendingFiles = useRef<Record<UploadKind, File | null>>({
    INTERNSHIP_APPLICATION: null,
    ASSIGNMENT_LETTER: null,
  });

  const aborters = useRef<Record<UploadKind, AbortController | null>>({
    INTERNSHIP_APPLICATION: null,
    ASSIGNMENT_LETTER: null,
  });

  const draftPromise = useRef<Promise<ApplicationResponse> | null>(null);
  const appRef = useRef<ApplicationResponse | null>(null);

  const uploads: Record<UploadKind, ApplicationDocumentResponse | null> = useMemo(
    () => ({
      INTERNSHIP_APPLICATION: slots.INTERNSHIP_APPLICATION.attachment,
      ASSIGNMENT_LETTER: slots.ASSIGNMENT_LETTER.attachment,
    }),
    [slots],
  );

  const uploadingStates: Record<UploadKind, boolean> = useMemo(
    () => ({
      INTERNSHIP_APPLICATION:
        slots.INTERNSHIP_APPLICATION.phase === 'uploading' ||
        slots.INTERNSHIP_APPLICATION.phase === 'attaching',
      ASSIGNMENT_LETTER:
        slots.ASSIGNMENT_LETTER.phase === 'uploading' ||
        slots.ASSIGNMENT_LETTER.phase === 'attaching',
    }),
    [slots],
  );

  const [stepError, setStepError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyAppliedRef, setAlreadyAppliedRef] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedReference, setSubmittedReference] = useState<string | null>(null);
  const [trackingToken, setTrackingToken] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [isValidatingIdentifiers, setIsValidatingIdentifiers] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{duplicateFields: string[]; message: string} | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  const bootstrapDone = useRef(false);

  // Live classification preview
  const classification: ClassificationResult | null = useMemo(() => {
    const s = draft.dates.desiredStartDate;
    const e = draft.dates.desiredEndDate;
    if (!s || !e) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !/^\d{4}-\d{2}-\d{2}$/.test(e)) return null;
    const [sy, sm, sd] = s.split('-').map(Number);
    const [ey, em, ed] = e.split('-').map(Number);
    const sMs = Date.UTC(sy, sm - 1, sd);
    const eMs = Date.UTC(ey, em - 1, ed);
    if (Number.isNaN(sMs) || Number.isNaN(eMs) || eMs < sMs) return null;
    const dtS = new Date(sMs);
    const dtE = new Date(eMs);
    if (dtS.getUTCFullYear() !== sy || dtS.getUTCMonth() !== sm - 1 || dtS.getUTCDate() !== sd) return null;
    if (dtE.getUTCFullYear() !== ey || dtE.getUTCMonth() !== em - 1 || dtE.getUTCDate() !== ed) return null;
    return classifyInternship(s, e);
  }, [draft.dates.desiredStartDate, draft.dates.desiredEndDate]);

  const classificationType = classification?.type ?? null;

  // ---- Robust persistence state ----
  const [recoveryInfo, setRecoveryInfo] = useState<{ts: number; isLegacy?: boolean} | null>(null);
  const hasPersistedRef = useRef(false);
  const isRestoringRef = useRef(false);

  // Immediate restore from localStorage (before backend) — gives instant recovery on refresh
  useEffect(() => {
    const stored = readStoredWizard() || migrateLegacyStorage();
    if (stored) {
      isRestoringRef.current = true;
      // Validate draft shape before restoring
      const isValidDraft = stored.draft && typeof stored.draft.personal?.firstName === 'string';
      const hasData =
        isValidDraft &&
        (stored.stepIndex > 0 ||
          Boolean(
            stored.draft.personal.firstName.trim() ||
              stored.draft.personal.lastName.trim() ||
              stored.draft.personal.email.trim() ||
              stored.draft.personal.phone.trim() ||
              stored.draft.education.speciality.trim() ||
              stored.draft.education.universityId ||
              stored.draft.dates.desiredStartDate ||
              stored.draft.dates.desiredEndDate ||
              stored.pendingMeta?.INTERNSHIP_APPLICATION ||
              stored.pendingMeta?.ASSIGNMENT_LETTER,
          ));
      if (isValidDraft) {
        setDraft(stored.draft);
        setStepIndex(Math.min(Math.max(stored.stepIndex, 0), STEPS.length - 1));
        setPendingMeta(stored.pendingMeta || {...EMPTY_META});
        if (hasData) {
          setRecoveryInfo({ts: stored.ts, isLegacy: false});
        }
        hasPersistedRef.current = true;
      }
      // Defer clearing flag to allow next effect to persist correctly
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 0);
    }
  }, []);

  const saveStepToStorage = useCallback((index: number) => {
    // Unified write — also updates timestamp to keep step and draft in sync
    const currentDraft = draft; // captured via closure, but effect below will also persist
    // Use functional read to avoid stale closure for pendingMeta/app
    const stored = readStoredWizard();
    const meta = stored?.pendingMeta || pendingMeta;
    const appId = appRef.current?.id || app?.id || stored?.appId || null;
    writeStoredWizard(currentDraft, index, meta, appId, isAuthenticated);
    // Also keep in-memory step for immediate UI
  }, [draft, pendingMeta, app, isAuthenticated]);

  const saveDraftToStorage = useCallback((updated: WizardDraft) => {
    // Privacy: for authenticated users, nationalId is re-merged from profile, so omit it to avoid storing PII
    // For anonymous, we must store it to allow recovery (no profile source)
    const draftToStore = isAuthenticated ? {...updated, personal: {...updated.personal, nationalId: ''}} : updated;
    const stored = readStoredWizard();
    const step = stored?.stepIndex ?? stepIndex;
    const meta = stored?.pendingMeta ?? pendingMeta;
    const appId = appRef.current?.id || app?.id || stored?.appId || null;
    writeStoredWizard(draftToStore, step, meta, appId, isAuthenticated);
  }, [isAuthenticated, stepIndex, pendingMeta, app]);

  // Auto-persist any progress change (debounced) — survives refresh, navigation, tab close
  useEffect(() => {
    if (phase !== 'ready' && phase !== 'loading') return;
    if (isRestoringRef.current) return;
    // Don't persist empty initial state on first mount before restore
    if (!hasPersistedRef.current && stepIndex === 0 && draft === INITIAL_WIZARD_DRAFT && pendingMeta === EMPTY_META) return;
    const handler = setTimeout(() => {
      const draftToStore = isAuthenticated ? {...draft, personal: {...draft.personal, nationalId: ''}} : draft;
      writeStoredWizard(draftToStore, stepIndex, pendingMeta, appRef.current?.id || app?.id || null, isAuthenticated);
      hasPersistedRef.current = true;
    }, 400);
    return () => clearTimeout(handler);
  }, [draft, stepIndex, pendingMeta, app, isAuthenticated, phase]);

  // Persist on tab hide / refresh / close for immediate durability
  useEffect(() => {
    const persistNow = () => {
      if (phase !== 'ready') return;
      const draftToStore = isAuthenticated ? {...draft, personal: {...draft.personal, nationalId: ''}} : draft;
      writeStoredWizard(draftToStore, stepIndex, pendingMeta, appRef.current?.id || app?.id || null, isAuthenticated);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persistNow();
    };
    const onPageHide = () => persistNow();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
    };
  }, [draft, stepIndex, pendingMeta, app, isAuthenticated, phase]);

  /* ----- Bootstrap: check auth, profile, universities, drafts ----- */
  const loadAll = useCallback(async () => {
    let unis: University[] = [];
    try {
      unis = await fetchUniversities();
      setUniversities(unis);
    } catch {
      // Universities request fallback
    }

    let prof: CandidateProfile | null = null;
    try {
      prof = await getProfile();
      setProfile(prof);
      setIsAuthenticated(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Anonymous user — not an error! They can continue steps 1-6 seamlessly
        setIsAuthenticated(false);
        // If we already restored local progress, keep it; otherwise stay ready with empty draft
        setPhase('ready');
        return;
      }
      // Network / backend down but we have local progress — stay usable offline
      const hasLocal = !!readStoredWizard();
      if (hasLocal) {
        setIsAuthenticated(false);
        toast.notify({title: t('loadErrorHint'), tone: 'error'});
        setPhase('ready');
        return;
      }
      setLoadingError({
        title: t('loadErrorTitle'),
        hint: t('loadErrorHint'),
        traceId: err instanceof ApiError ? err.traceId : null,
      });
      setPhase('error');
      return;
    }

    // If authenticated, check for any existing *active* application (WITHDRAWN does not block new submission)
    if (prof) {
      try {
        const {listApplications} = await import('@/lib/api/application-client');
        const list = await listApplications();
        const active = list.filter((a) => a.status !== 'WITHDRAWN');
        if (active.length > 0) {
          // Show the most recent active application as blocking (e.g. SUBMITTED, UNDER_REVIEW, etc.)
          const blocking = [...active].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
          setAlreadyAppliedRef(blocking.reference);
          setPhase('alreadyApplied');
          return;
        }
      } catch {
        /* proceed to profile prefill */
      }

      // No existing application: check for DRAFT or prefill from profile
      try {
        const {listApplications} = await import('@/lib/api/application-client');
        const list = await listApplications();
        const drafts = list
          .filter((a) => a.status === 'DRAFT')
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        // If re-applying after WITHDRAWN (no active, no draft, but history has WITHDRAWN), resume at Documents (index 3)
        const hasWithdrawnHistory = list.some((a) => a.status === 'WITHDRAWN');
        if (hasWithdrawnHistory && drafts.length === 0) {
          const storedForWithdraw = readStoredWizard();
          const shouldResumeAtDocuments = storedForWithdraw ? storedForWithdraw.stepIndex >= 3 : true;
          if (shouldResumeAtDocuments) {
            appRef.current = null;
            setApp(null);
            setStepIndex(3);
            // Persist the reset so refresh keeps it at Documents, not at stale Result
            const currentDraft = storedForWithdraw?.draft || INITIAL_WIZARD_DRAFT;
            writeStoredWizard(currentDraft, 3, storedForWithdraw?.pendingMeta || {...EMPTY_META}, null, true);
          }
        }

        if (drafts.length > 0) {
          const a = drafts[0];
          appRef.current = a;
          setApp(a);

          // Merge backend data with locally restored draft — respect timestamps to avoid overwriting newer data
          const storedForMerge = readStoredWizard();
          const backendTs = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const localIsNewer = storedForMerge ? storedForMerge.ts > backendTs : false;
          const localHasDates = Boolean(storedForMerge?.draft.dates.desiredStartDate || storedForMerge?.draft.dates.desiredEndDate);
          setDraft((prev) => {
            // If local is newer and has meaningful data, keep local; otherwise use backend/profile as truth
            const keepLocalPersonal = localIsNewer && Boolean(prev.personal.firstName || prev.personal.lastName || prev.personal.email);
            const keepLocalEducation = localIsNewer && Boolean(prev.education.speciality || prev.education.universityId);
            const keepLocalDates = localIsNewer && localHasDates;
            const next = {
              ...prev,
              personal: keepLocalPersonal
                ? prev.personal
                : {
                    firstName: prev.personal.firstName || prof?.firstName || '',
                    lastName: prev.personal.lastName || prof?.lastName || '',
                    nationalId: prev.personal.nationalId || prof?.nationalId || '',
                    email: prev.personal.email || prof?.email || '',
                    phone: prev.personal.phone || prof?.phone || '',
                    birthDate: prev.personal.birthDate || prof?.birthDate || '',
                  },
              education: keepLocalEducation
                ? prev.education
                : {
                    educationLevel: prev.education.educationLevel !== 'LICENCE' || prev.education.speciality ? prev.education.educationLevel : prof?.diploma || 'LICENCE',
                    speciality: prev.education.speciality || prof?.speciality || '',
                    universityId: prev.education.universityId || prof?.universityId || '',
                  },
              dates: {
                desiredStartDate: keepLocalDates ? prev.dates.desiredStartDate || a.desiredStartDate || '' : a.desiredStartDate || prev.dates.desiredStartDate || '',
                desiredEndDate: keepLocalDates ? prev.dates.desiredEndDate || a.desiredEndDate || '' : a.desiredEndDate || prev.dates.desiredEndDate || '',
              },
            };
            // Don't call saveDraftToStorage here — auto-persist effect will handle it with correct isAuthenticated
            return next;
          });
          setIsPrefilled(true);

          try {
            const docs = await getApplicationDocuments(a.id);
            const byKind = docsToUploads(docs);
            setSlots({
              INTERNSHIP_APPLICATION: idleSlot(byKind.INTERNSHIP_APPLICATION),
              ASSIGNMENT_LETTER: idleSlot(byKind.ASSIGNMENT_LETTER),
            });
          } catch {
            /* ignore document loading failures */
          }

          setPhase('ready');
          return;
        }
      } catch {
        /* proceed to profile prefill */
      }

      // No backend draft: intelligently prefill from candidate profile
      setDraft((prev) => {
        const next = {
          ...prev,
          personal: {
            firstName: prev.personal.firstName || prof?.firstName || '',
            lastName: prev.personal.lastName || prof?.lastName || '',
            nationalId: prev.personal.nationalId || prof?.nationalId || '',
            email: prev.personal.email || prof?.email || '',
            phone: prev.personal.phone || prof?.phone || '',
            birthDate: prev.personal.birthDate || prof?.birthDate || '',
          },
          education: {
            educationLevel: prev.education.speciality
              ? prev.education.educationLevel
              : prof?.diploma || 'LICENCE',
            speciality: prev.education.speciality || prof?.speciality || '',
            universityId: prev.education.universityId || prof?.universityId || '',
          },
        };
        saveDraftToStorage(next);
        return next;
      });
      setIsPrefilled(true);
    }

    setPhase('ready');
  }, [saveDraftToStorage, t, toast]);

  useEffect(() => {
    if (bootstrapDone.current) return;
    bootstrapDone.current = true;
    void loadAll();
  }, [loadAll]);

  /* ----- Dirty tracking guard ----- */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  /* ----- Draft Sync to Backend (if Authenticated) ----- */
  const persistDraft = useCallback(
    async (overrideDraft?: WizardDraft) => {
      if (!isAuthenticated) return;
      const target = overrideDraft ?? draft;
      setSaving(true);
      setStepError(null);
      try {
        const body = {
          desiredStartDate: target.dates.desiredStartDate || null,
          desiredEndDate: target.dates.desiredEndDate || null,
        };
        if (app) {
          const updated = await updateDraft(app.id, body);
          appRef.current = {...app, ...updated};
          setApp((prev) => (prev ? {...prev, ...updated} : prev));
        } else {
          const created = await createDraft(body);
          appRef.current = created;
          setApp(created);
        }
        setDirty(false);
      } catch (err) {
        setStepError(err instanceof ApiError ? err.message : t('loadErrorHint'));
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [app, draft, isAuthenticated, t],
  );

  /* ----- Document Slot Helpers ----- */
  const setSlot = useCallback((kind: UploadKind, patch: Partial<SlotState>) => {
    setSlots((prev) => ({...prev, [kind]: {...prev[kind], ...patch}}));
  }, []);

  const slotErrorFor = useCallback(
    (kind: UploadKind, err: unknown, stage: 'upload' | 'attach'): SlotError => {
      const units = {b: td('unitB'), kb: td('unitKB'), mb: td('unitMB')};
      const rule = DOCUMENT_RULES[kind];
      const maxLabel = formatBytes(rule.maxBytes, units);
      const accepted = extensionsLabel(rule.extensions);
      const traceId = err instanceof ApiError ? err.traceId ?? null : null;
      const fail = (message: string, retryable: boolean): SlotError => ({
        message,
        traceId,
        retryable,
      });
      if (err instanceof ApiError) {
        switch (err.code) {
          case 'UPLOAD_CANCELLED':
            return fail(td('errorCancelled'), true);
          case 'UPLOAD_TIMEOUT':
            return fail(td('errorTimeout'), true);
          case 'UPLOAD_NETWORK':
            return fail(td('errorNetwork'), true);
          case 'FILE_TOO_LARGE':
            return fail(td('errorTooLarge', {size: maxLabel}), false);
          case 'EMPTY_FILE':
            return fail(td('errorEmpty'), false);
          case 'MIME_TYPE_SPOOFING_DETECTED':
            return fail(td('errorSpoofed', {expected: accepted}), false);
          case 'INVALID_FILE_TYPE':
            return fail(td('errorInvalidType', {accepted}), false);
          default:
            break;
        }
        if (err.status === 429) return fail(td('errorRateLimited'), true);
        if (err.status === 401) return fail(td('errorAuth'), false);
        if (err.status === 504) return fail(td('errorTimeout'), true);
        if (err.status === 502 || err.status === 0) return fail(td('errorNetwork'), true);
        if (stage === 'attach') return fail(td('errorAttach'), true);
      }
      return fail(td('errorGeneric'), true);
    },
    [td],
  );

  const fullNameForAi = useCallback(() => {
    const f = draft.personal.firstName.trim();
    const l = draft.personal.lastName.trim();
    if (!f || !l) return null;
    return `${f} ${l}`;
  }, [draft.personal.firstName, draft.personal.lastName]);

  const aiErrorFor = useCallback(
    (err: unknown): SlotError => {
      const traceId = err instanceof ApiError ? err.traceId ?? null : null;
      const fail = (message: string, retryable: boolean): SlotError => ({message, traceId, retryable});
      if (err instanceof ApiError) {
        // Genuine service outage only: backend 503 with AI_* codes (Python down,
        // circuit open, or token misconfigured). Everything else is either a
        // document problem (422/413/FILE_TOO_LARGE/INVALID_DOCUMENT) or a
        // transport timeout — never report those as "service unavailable".
        if (err.code === 'AI_UNAVAILABLE' || err.code === 'AI_TEMPORARILY_UNAVAILABLE' || err.status === 503) {
          return fail(td('aiErrorUnavailable'), true);
        }
        if (err.code === 'UPLOAD_CANCELLED') return fail(td('errorCancelled'), true);
        // Timeout (client abort after 45s or upstream 504): the service may be
        // slow on a large/scanned PDF — retryable, but NOT an outage.
        if (err.code === 'AI_TIMEOUT' || err.code === 'UPSTREAM_TIMEOUT' || err.code === 'UPLOAD_TIMEOUT' || err.status === 504) {
          return fail(td('errorTimeout'), true);
        }
        if (err.code === 'UPSTREAM_UNREACHABLE' || err.status === 502) {
          return fail(td('errorNetwork'), true);
        }
        // Document problems: user must replace the file — show the precise
        // backend message, never the generic "unavailable".
        if (err.code === 'FILE_TOO_LARGE' || err.code === 'INVALID_DOCUMENT' || err.code === 'EMPTY_FILE' || err.status === 413 || err.status === 422) {
          return fail(err.message || td('aiErrorGeneric'), false);
        }
        if (err.status === 429) return fail(td('errorRateLimited'), true);
        if (err.status === 401) return fail(td('errorAuth'), false);
        if (err.status === 0) return fail(td('errorNetwork'), true);
        return fail(err.message || td('aiErrorGeneric'), err.status >= 500);
      }
      return fail(td('aiErrorGeneric'), true);
    },
    [td],
  );

  const runAiValidation = useCallback(
    async (kind: UploadKind, fileForPublic: File | null, storedDocumentId: string | null) => {
      const fullName = fullNameForAi();
      if (!fullName) {
        setAiErrors((prev) => ({
          ...prev,
          [kind]: {message: td('aiErrorNeedName'), traceId: null, retryable: false},
        }));
        return;
      }
      setAiValidating((prev) => ({...prev, [kind]: true}));
      setAiErrors((prev) => ({...prev, [kind]: null}));
      try {
        let result: DocumentAiValidation;
        if (storedDocumentId) {
          result = await validateStoredDocumentAiBrowser(storedDocumentId, {
            expectedType: kind,
            fullName,
          });
        } else if (fileForPublic) {
          result = await validatePublicDocumentAi(fileForPublic, kind as never, fullName);
        } else {
          throw new Error('No document to validate');
        }
        setAiValidations((prev) => ({...prev, [kind]: result}));
        setAiErrors((prev) => ({...prev, [kind]: null}));
      } catch (err) {
        setAiValidations((prev) => ({...prev, [kind]: null}));
        setAiErrors((prev) => ({...prev, [kind]: aiErrorFor(err)}));
      } finally {
        setAiValidating((prev) => ({...prev, [kind]: false}));
      }
    },
    [aiErrorFor, fullNameForAi, td],
  );

  // Name changed after a document was already AI-validated → that validation is stale.
  useEffect(() => {
    // Invalidate so the wizard forces re-validation with the current full name.
    setAiValidations({INTERNSHIP_APPLICATION: null, ASSIGNMENT_LETTER: null});
    setAiErrors({INTERNSHIP_APPLICATION: null, ASSIGNMENT_LETTER: null});
    // Do not clear validating flag – an in-flight call will finish and be discarded.
  }, [draft.personal.firstName, draft.personal.lastName]);

  // Hydrated stored documents (e.g. draft resume) that have attachments but no
  // AI result yet: trigger the gate so Continue stays blocked until verified.
  useEffect(() => {
    if (phase !== 'ready') return;
    const kinds: UploadKind[] = ['INTERNSHIP_APPLICATION', 'ASSIGNMENT_LETTER'];
    for (const k of kinds) {
      const att = slots[k].attachment;
      if (!att || att.id.startsWith('temp-')) continue;
      if (aiValidations[k] || aiValidating[k] || aiErrors[k]) continue;
      const name = fullNameForAi();
      if (!name) continue;
      void runAiValidation(k, null, att.document.id);
    }
  }, [phase, slots, aiValidations, aiValidating, aiErrors, fullNameForAi, runAiValidation]);

  const ensureDraft = useCallback(async (): Promise<ApplicationResponse> => {
    if (appRef.current) return appRef.current;
    if (!draftPromise.current) {
      draftPromise.current = createDraft({
        desiredStartDate: draft.dates.desiredStartDate || null,
        desiredEndDate: draft.dates.desiredEndDate || null,
      })
        .then((created) => {
          appRef.current = created;
          setApp(created);
          return created;
        })
        .finally(() => {
          draftPromise.current = null;
        });
    }
    return draftPromise.current;
  }, [draft.dates.desiredEndDate, draft.dates.desiredStartDate]);

  const startUpload = useCallback(
    async (kind: UploadKind, file: File) => {
      aborters.current[kind]?.abort();
      const controller = new AbortController();
      aborters.current[kind] = controller;
      pendingFiles.current[kind] = file;
      // File objects die on reload/locale navigation — keep metadata so the
      // UI can honestly ask for re-selection instead of failing silently.
      setPendingMeta(setPendingMetaKind(kind, {name: file.name, size: file.size}));

      // If user is anonymous, queue the file locally then run AI validation
      // against the in-memory bytes (Spring Boot → Python, no persistence yet).
      if (!isAuthenticated) {
        // Clear previous AI state before starting a new validation.
        setAiValidations((prev) => ({...prev, [kind]: null}));
        setAiErrors((prev) => ({...prev, [kind]: null}));
        setSlot(kind, {
          phase: 'idle',
          progress: null,
          pendingName: file.name,
          pendingSize: file.size,
          error: null,
          attachment: {
            id: `temp-${kind}`,
            document: {
              id: `temp-${kind}`,
              type: kind as DocumentType,
              fileName: file.name,
              fileSize: file.size,
              contentType: file.type || 'application/pdf',
              createdAt: new Date().toISOString(),
            },
            mandatory: DOCUMENT_RULES[kind].required,
            attachedAt: new Date().toISOString(),
          } as unknown as ApplicationDocumentResponse,
        });
        setDirty(true);
        // Kick off AI validation (non-blocking but gates the Continue button).
        if (!fullNameForAi()) {
          setAiErrors((prev) => ({
            ...prev,
            [kind]: {message: td('aiErrorNeedName'), traceId: null, retryable: false},
          }));
        } else {
          void runAiValidation(kind, file, null);
        }
        return;
      }

      setSlot(kind, {
        phase: 'uploading',
        progress: 0,
        pendingName: file.name,
        pendingSize: file.size,
        error: null,
      });
      setDirty(true);

      const cancelledState = (): SlotState => ({
        phase: 'cancelled',
        progress: null,
        pendingName: file.name,
        pendingSize: file.size,
        error: {message: td('errorCancelled'), traceId: null, retryable: true},
        attachment: slots[kind].attachment,
      });

      let stage: 'upload' | 'attach' = 'upload';
      try {
        const d = await ensureDraft();
        if (controller.signal.aborted) {
          setSlots((prev) => ({...prev, [kind]: cancelledState()}));
          return;
        }
        const doc = await uploadFileWithProgress(file, kind as DocumentType, {
          signal: controller.signal,
          onProgress: (loaded, total) => {
            setSlot(kind, {
              progress: total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : null,
            });
          },
        });
        if (controller.signal.aborted) {
          setSlots((prev) => ({...prev, [kind]: cancelledState()}));
          return;
        }
        stage = 'attach';
        setSlot(kind, {phase: 'attaching'});
        // Reset AI state for this new file; the Continue button stays disabled
        // until the gate passes (loading spinner is shown instead).
        setAiValidations((prev) => ({...prev, [kind]: null}));
        setAiErrors((prev) => ({...prev, [kind]: null}));
        try {
          const attached = await attachDocument(d.id, {
            documentId: doc.id,
            mandatory: DOCUMENT_RULES[kind].required,
          });
          setSlot(kind, {
            phase: 'idle',
            progress: null,
            pendingName: null,
            pendingSize: null,
            error: null,
            attachment: attached,
          });
          pendingFiles.current[kind] = null;
          setPendingMeta(setPendingMetaKind(kind, null));
          setDirty(true);
          void runAiValidation(kind, null, attached.document.id);
        } catch (attachErr) {
          if (attachErr instanceof ApiError && attachErr.status === 409) {
            const docs = await getApplicationDocuments(d.id);
            const latest = docsToUploads(docs)[kind];
            if (latest) {
              setSlot(kind, {
                phase: 'idle',
                progress: null,
                pendingName: null,
                pendingSize: null,
                error: null,
                attachment: latest,
              });
              pendingFiles.current[kind] = null;
              setPendingMeta(setPendingMetaKind(kind, null));
              setDirty(true);
              void runAiValidation(kind, null, latest.document.id);
              return;
            }
          }
          throw attachErr;
        }
      } catch (err) {
        if (controller.signal.aborted) {
          setSlots((prev) => ({...prev, [kind]: cancelledState()}));
          return;
        }
        setSlot(kind, {phase: 'error', progress: null, error: slotErrorFor(kind, err, stage)});
      } finally {
        if (aborters.current[kind] === controller) aborters.current[kind] = null;
      }
    },
    [ensureDraft, fullNameForAi, isAuthenticated, runAiValidation, setSlot, slotErrorFor, slots, td],
  );

  const cancelUpload = useCallback((kind: UploadKind) => {
    aborters.current[kind]?.abort();
    // Cancelling upload also cancels any in-flight AI gate for this slot.
    setAiValidating((prev) => ({...prev, [kind]: false}));
  }, []);

  const retryUpload = useCallback(
    (kind: UploadKind) => {
      const file = pendingFiles.current[kind];
      if (file) void startUpload(kind, file);
    },
    [startUpload],
  );

  const retryAiValidation = useCallback(
    (kind: UploadKind) => {
      const attachment = slots[kind].attachment;
      const file = pendingFiles.current[kind];
      if (attachment && !attachment.id.startsWith('temp-')) {
        void runAiValidation(kind, null, attachment.document.id);
      } else if (file) {
        void runAiValidation(kind, file, null);
      } else if (attachment) {
        // Anonymous slot without bytes left (e.g. after reload). User must re-select.
        setAiErrors((prev) => ({
          ...prev,
          [kind]: {message: td('aiErrorNeedReselect'), traceId: null, retryable: false},
        }));
      }
    },
    [runAiValidation, slots, td],
  );

  const removeUpload = useCallback(
    (kind: UploadKind) => {
      aborters.current[kind]?.abort();
      pendingFiles.current[kind] = null;
      setSlot(kind, idleSlot());
      setPendingMeta(setPendingMetaKind(kind, null));
      setAiValidations((prev) => ({...prev, [kind]: null}));
      setAiErrors((prev) => ({...prev, [kind]: null}));
      setAiValidating((prev) => ({...prev, [kind]: false}));
      setDirty(true);
    },
    [setSlot],
  );

  /* Files queued but never attached (reload / locale switch): ask to re-select. */
  const staleUploads = useMemo(
    () =>
      (Object.keys(EMPTY_META) as UploadKind[])
        .filter((k) => pendingMeta[k] && !slots[k].attachment)
        .map((k) => pendingMeta[k]?.name ?? k),
    [pendingMeta, slots],
  );

  /* ----- Step Navigation ----- */
  const goNext = useCallback(async () => {
    const currentStepId = STEPS[stepIndex] as StepId;
    const validationKey = validateStep(
      currentStepId,
      draft,
      classificationType,
      uploads,
      uploadingStates,
      aiValidations,
      aiValidating,
    );

    if (validationKey) {
      // Guarded lookup: never surface a raw MISSING_MESSAGE key to users.
      const key = validationKey as never;
      setStepError(t.has(key) ? t(key) : t('loadErrorHint'));
      return;
    }

    // Step 1 (personal) — server-side uniqueness check for email/CIN/phone before proceeding to Step 2
    if (currentStepId === 'personal') {
      setIsValidatingIdentifiers(true);
      setStepError(null);
      try {
        const result = await validateIdentifiersClient({
          email: draft.personal.email.trim() || null,
          nationalId: draft.personal.nationalId.trim() || null,
          phone: draft.personal.phone.trim() || null,
        });
        if (!result.valid) {
          setDuplicateInfo({duplicateFields: result.duplicateFields, message: result.message});
          setShowDuplicateDialog(true);
          return;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : t('loadErrorHint');
        setStepError(message);
        toast.notify({title: message, tone: 'error'});
        return;
      } finally {
        setIsValidatingIdentifiers(false);
      }
    }

    setStepError(null);

    // If authenticated, persist draft checkpoint to backend when leaving dates or details
    if (isAuthenticated && (currentStepId === 'dates')) {
      try {
        await persistDraft();
      } catch {
        return;
      }
    }

    const nextIndex = Math.min(stepIndex + 1, STEPS.length - 1);
    setStepIndex(nextIndex);
    saveStepToStorage(nextIndex);
    window.scrollTo({top: 0, behavior: 'smooth'});
  }, [
    aiValidations,
    aiValidating,
    stepIndex,
    draft,
    classificationType,
    uploads,
    uploadingStates,
    isAuthenticated,
    persistDraft,
    saveStepToStorage,
    t,
    toast,
  ]);

  const goBack = useCallback(() => {
    setStepError(null);
    setStepIndex((i) => {
      const next = Math.max(i - 1, 0);
      saveStepToStorage(next);
      return next;
    });
    window.scrollTo({top: 0, behavior: 'smooth'});
  }, [saveStepToStorage]);

  // Kept for programmatic jumps (e.g. deep-link from review) — not used by the new edit dialogs which stay in-place
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleJumpToStep = useCallback(
    (targetIndex: number) => {
      setStepError(null);
      const next = Math.min(Math.max(targetIndex, 0), STEPS.length - 1);
      setStepIndex(next);
      saveStepToStorage(next);
      window.scrollTo({top: 0, behavior: 'smooth'});
    },
    [saveStepToStorage],
  );

  /* ----- Final Submissions ----- */
  // Idempotency key per application: generated once, reused across double-clicks,
  // refreshes and retries so the backend replays one stored submit response.
  const submitKeyFor = useCallback((appId: string) => {
    const storageKey = `steg_submit_key_${appId}`;
    try {
      const existing = localStorage.getItem(storageKey);
      if (existing) return existing;
      const fresh = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(storageKey, fresh);
      return fresh;
    } catch {
      return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }, []);

  const clearSubmitKey = useCallback((appId: string) => {
    try {
      localStorage.removeItem(`steg_submit_key_${appId}`);
    } catch {
      /* ignore */
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!app) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const docs = await getApplicationDocuments(app.id);
      const serverKinds = new Set(docs.map((d) => d.document.type));
      const requiredKinds: UploadKind[] = ['INTERNSHIP_APPLICATION', 'ASSIGNMENT_LETTER'];
      const blocked = requiredKinds.some((k) => !uploads[k] || !serverKinds.has(k));
      if (blocked) {
        const msg = td('submitBlockedDocs');
        setSubmitError(tError('submitError', {message: msg}));
        toast.notify({title: msg, tone: 'error'});
        return;
      }
      const updated = await submit(app.id, submitKeyFor(app.id));
      appRef.current = updated;
      setApp(updated);
      setSubmittedReference(updated.reference);
      setDirty(false);
      clearSubmitKey(app.id);
      clearWizardStorage();
    } catch (err) {
      // Transport failure (timeout/unreachable) is ambiguous: the backend may
      // have committed the SUBMITTED state while the response was lost.
      // Reconcile with server truth — if the dossier is no longer DRAFT, the
      // candidate's intent is satisfied: render success, not failure.
      if (err instanceof ApiError && (err.status === 0 || err.status === 502 || err.status === 504)) {
        try {
          const current = await getApplication(app.id);
          if (current.status !== 'DRAFT') {
            appRef.current = current;
            setApp(current);
            setSubmittedReference(current.reference);
            setDirty(false);
            clearSubmitKey(app.id);
            clearWizardStorage();
            toast.notify({title: tError('submitRecovered'), tone: 'success'});
            return;
          }
        } catch {
          /* reconciliation itself failed — fall through to the error below */
        }
      }
      const msg = err instanceof ApiError ? err.message : t('loadErrorHint');
      setSubmitError(tError('submitError', {message: msg}));
    } finally {
      setSubmitting(false);
    }
  }, [app, t, tError, td, toast, uploads, submitKeyFor, clearSubmitKey]);

  /**
   * Anonymous candidate bridge: creates candidate account or signs in,
   * creates the draft, uploads queued files, and submits the dossier.
   * (For account-less submission see handleAnonymousDirect.)
   */
  const handleAnonymousSubmit = useCallback(
    async (password: string, isNewAccount: boolean) => {
      // 1. Authenticate (register or login)
      const authEndpoint = isNewAccount ? '/api/auth/register' : '/api/auth/login';
      const authBody = isNewAccount
        ? {
            email: draft.personal.email,
            password,
            firstName: draft.personal.firstName,
            lastName: draft.personal.lastName,
            phone: draft.personal.phone,
          }
        : {
            email: draft.personal.email,
            password,
          };

      const res = await fetch(authEndpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(authBody),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({message: 'Authentication failed'}));
        throw new Error(errJson.message || 'Authentication failed');
      }

      setIsAuthenticated(true);

      // 2. Update candidate profile with academic details
      try {
        await updateProfile({
          firstName: draft.personal.firstName,
          lastName: draft.personal.lastName,
          email: draft.personal.email,
          nationalId: draft.personal.nationalId,
          universityId: draft.education.universityId,
          phone: draft.personal.phone,
          birthDate: draft.personal.birthDate,
          diploma: draft.education.educationLevel,
          speciality: draft.education.speciality,
        });
      } catch {
        // Fallback to createProfile if profile doesn't exist yet
        try {
          await createProfile({
            firstName: draft.personal.firstName,
            lastName: draft.personal.lastName,
            email: draft.personal.email,
            nationalId: draft.personal.nationalId,
            universityId: draft.education.universityId,
            phone: draft.personal.phone,
            birthDate: draft.personal.birthDate,
            diploma: draft.education.educationLevel,
            speciality: draft.education.speciality,
          });
        } catch {
          /* ignore profile update fallback errors */
        }
      }

      // 3. Create Draft
      const createdDraft = await createDraft({
        desiredStartDate: draft.dates.desiredStartDate || null,
        desiredEndDate: draft.dates.desiredEndDate || null,
      });
      appRef.current = createdDraft;
      setApp(createdDraft);

      // 4. Upload pending files & attach them
      const kinds: UploadKind[] = [
        'INTERNSHIP_APPLICATION',
        'ASSIGNMENT_LETTER',
      ];
      for (const kind of kinds) {
        const file = pendingFiles.current[kind];
        if (file) {
          const doc = await uploadFileWithProgress(file, kind as DocumentType, {});
          await attachDocument(createdDraft.id, {
            documentId: doc.id,
            mandatory: DOCUMENT_RULES[kind].required,
          });
        }
      }

      // 5. Submit application
      const finalApp = await submit(createdDraft.id);
      appRef.current = finalApp;
      setApp(finalApp);
      setSubmittedReference(finalApp.reference);
      setTrackingToken(null);
      setDirty(false);
      clearWizardStorage();
    },
    [draft],
  );

  /**
   * Account-less submission (E3.1): posts the wizard draft + queued files to the
   * public endpoint. Backend owns validation, CIN-uniqueness and classification.
   * The tracking token is shown once — the only credential for `/track`.
   */
  const handleAnonymousDirect = useCallback(async () => {
    const files: File[] = [];
    for (const kind of ['INTERNSHIP_APPLICATION', 'ASSIGNMENT_LETTER'] as UploadKind[]) {
      const file = pendingFiles.current[kind];
      if (!file) {
        setSubmitError(tError('submitError', {message: td('submitBlockedDocs')}));
        return;
      }
      files.push(file);
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const {submitAnonymous} = await import('@/lib/api/anonymous-client');
      const result = await submitAnonymous(
        {
          firstName: draft.personal.firstName,
          lastName: draft.personal.lastName,
          email: draft.personal.email,
          phone: draft.personal.phone || undefined,
          birthDate: draft.personal.birthDate || undefined,
          nationalId: draft.personal.nationalId,
          universityId: draft.education.universityId,
          speciality: draft.education.speciality || undefined,
          diploma: draft.education.educationLevel || undefined,
          desiredStartDate: draft.dates.desiredStartDate,
          desiredEndDate: draft.dates.desiredEndDate,
        },
        files,
      );
      setSubmittedReference(result.reference);
      setTrackingToken(result.trackingToken);
      setDirty(false);
      clearWizardStorage();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('loadErrorHint');
      setSubmitError(tError('submitError', {message: msg}));
    } finally {
      setSubmitting(false);
    }
  }, [draft, t, tError, td]);

  /* ----- Render Loading / Error ----- */
  if (phase === 'loading') {
    return (
      <div className="flex flex-col gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <ErrorState
        title={loadingError?.title}
        hint={loadingError?.hint}
        traceId={loadingError?.traceId ?? null}
        onRetry={() => {
          setPhase('loading');
          bootstrapDone.current = true;
          setLoadingError(null);
          void loadAll();
        }}
      />
    );
  }

  if (phase === 'alreadyApplied') {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-50/90 p-8 shadow-xl backdrop-blur-sm dark:border-amber-400/30 dark:bg-amber-500/10">
              {/* Icon */}
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/30">
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-amber-950 dark:text-amber-50">
                {t('alreadyAppliedTitle')}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-amber-800/80 dark:text-amber-100/80">
                {t('alreadyAppliedBody')}
              </p>

              {/* Reference badge */}
              {alreadyAppliedRef && (
                <div className="mt-5 flex justify-center">
                  <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-100/80 px-5 py-2.5 text-xs font-mono font-semibold text-amber-900 dark:text-amber-200 dark:border-amber-400/50 dark:bg-amber-400/10">
                    <svg className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M3 8h18M3 16h18" />
                    </svg>
                    {t('alreadyAppliedRef', {reference: alreadyAppliedRef})}
                  </span>
                </div>
              )}

              {/* Info text */}
              <p className="mt-5 text-xs text-amber-700/60 dark:text-amber-300/60">
                {t('alreadyAppliedNext')}
              </p>

              {/* CTA Button */}
              <div className="mt-8 flex justify-center">
                <Link
                  href="/track"
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-8 py-3.5 text-sm font-bold text-amber-950 dark:text-amber-900 shadow-lg shadow-amber-500/30 transition-all duration-300 hover:from-amber-400 hover:to-amber-500 hover:shadow-amber-400/40"
                >
                  <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  {t('trackMyApplication')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const recoveryAge = recoveryInfo ? Date.now() - recoveryInfo.ts : 0;
  const recoveryLabel = recoveryInfo
    ? recoveryAge < 60_000
      ? t('recoveryJustNow')
      : recoveryAge < 3600_000
        ? t('recoveryMinutes', {count: Math.floor(recoveryAge / 60000)})
        : recoveryAge < 86400_000
          ? t('recoveryHours', {count: Math.floor(recoveryAge / 3600000)})
          : t('recoveryDays', {count: Math.floor(recoveryAge / 86400000)})
    : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Recovery banner — appears when we restored from local persistence after refresh/close */}
      {recoveryInfo && phase === 'ready' && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 shadow-sm dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <span aria-hidden="true" className="mt-0.5 text-base">
              ↺
            </span>
            <div className="flex flex-col gap-1">
              <p className="font-semibold leading-tight">{t('recoveryTitle')}</p>
              <p className="text-xs leading-relaxed opacity-80">
                {t('recoveryBody', {time: recoveryLabel || ''})} {t('recoveryHint')}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-stretch sm:self-auto">
            <Button variant="secondary" size="sm" onClick={() => setRecoveryInfo(null)}>
              {t('recoveryDismiss')}
            </Button>
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => {
                clearStoredWizard();
                setDraft(INITIAL_WIZARD_DRAFT);
                setStepIndex(0);
                setPendingMeta({...EMPTY_META});
                setRecoveryInfo(null);
                setDirty(false);
                toast.notify({title: t('recoveryRestarted'), tone: 'info'});
              }}
            >
              {t('recoveryStartOver')}
            </Button>
          </div>
        </div>
      )}

      {/* Progress Stepper */}
      <Stepper steps={STEP_DEFS} current={stepIndex} />

      {/* Global Step Error */}
      {stepError && (
        <div
          role="alert"
          className="rounded-xl border border-accent-200 bg-accent-50/80 px-4 py-3 text-sm text-accent-800 dark:border-accent-800 dark:bg-accent-950/40 dark:text-accent-200"
        >
          {stepError}
        </div>
      )}

      {/* Duplicate identifier warning dialog — shown when email/CIN/phone already has an application */}
      <Modal
        open={showDuplicateDialog}
        onClose={() => {
          setShowDuplicateDialog(false);
          setDuplicateInfo(null);
        }}
        title={t('duplicateDialogTitle')}
        description={duplicateInfo?.message || t('duplicateDialogBody')}
        closeLabel={t('duplicateDialogClose')}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setShowDuplicateDialog(false);
                setDuplicateInfo(null);
              }}
            >
              {t('duplicateDialogClose')}
            </Button>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              onClick={() => {
                setShowDuplicateDialog(false);
                setDuplicateInfo(null);
              }}
            >
              {t('duplicateDialogLogin')}
            </Link>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <span className="text-lg" aria-hidden="true">
              ⚠️
            </span>
            <div className="flex flex-col gap-1">
              <p className="font-semibold">{t('duplicateDialogHintTitle')}</p>
              <p className="text-xs leading-relaxed opacity-90">{t('duplicateDialogHintBody')}</p>
              {duplicateInfo?.duplicateFields && duplicateInfo.duplicateFields.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-xs opacity-90">
                  {duplicateInfo.duplicateFields.map((field) => (
                    <li key={field}>
                      {field === 'email'
                        ? t('duplicateFieldEmail')
                        : field === 'nationalId'
                          ? t('duplicateFieldCin')
                          : field === 'phone'
                            ? t('duplicateFieldPhone')
                            : field}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{t('duplicateDialogFooter')}</p>
        </div>
      </Modal>

      {/* Step 1: Personal Information */}
      {stepIndex === 0 && (
        <PersonalStep
          data={draft.personal}
          isPrefilled={isPrefilled}
          onChange={(patch) => {
            setStepError(null);
            setDraft((prev) => {
              const next = {...prev, personal: {...prev.personal, ...patch}};
              saveDraftToStorage(next);
              return next;
            });
            setDirty(true);
          }}
          errorKey={stepError}
          isValidating={isValidatingIdentifiers}
          onContinue={() => void goNext()}
        />
      )}

      {/* Step 2: Education & University */}
      {stepIndex === 1 && (
        <EducationStep
          data={draft.education}
          universities={universities}
          onChange={(patch) => {
            setStepError(null);
            setDraft((prev) => {
              const next = {...prev, education: {...prev.education, ...patch}};
              saveDraftToStorage(next);
              return next;
            });
            setDirty(true);
          }}
          errorKey={stepError}
          onContinue={() => void goNext()}
        />
      )}

      {/* Step 3: Dates & Interactive Classification */}
      {stepIndex === 2 && (
        <DatesStep
          startDate={draft.dates.desiredStartDate}
          endDate={draft.dates.desiredEndDate}
          classification={classification}
          onChange={(s, e) => {
            setStepError(null);
            setDraft((prev) => {
              const next = {...prev, dates: {desiredStartDate: s, desiredEndDate: e}};
              saveDraftToStorage(next);
              return next;
            });
            setDirty(true);
          }}
          errorKey={stepError}
          onContinue={() => void goNext()}
        />
      )}

      {/* Step 5: Required Documents – gated by AI doc-intel (type + name) */}
      {stepIndex === 3 && (
        <DocumentsStep
          application={slots.INTERNSHIP_APPLICATION}
          assignment={slots.ASSIGNMENT_LETTER}
          disabled={saving}
          staleFileNames={staleUploads}
          aiValidations={aiValidations}
          aiValidating={aiValidating}
          aiErrors={aiErrors}
          fullName={fullNameForAi()}
          onRetryAi={retryAiValidation}
          onSelectFiles={(kind, files) => {
            setStepError(null);
            if (files.length > 0) void startUpload(kind, files[0]);
          }}
          onCancel={(kind) => cancelUpload(kind)}
          onRetry={(kind) => retryUpload(kind)}
          onRemove={(kind) => removeUpload(kind)}
          errorKey={stepError}
          onContinue={() => void goNext()}
        />
      )}

      {/* Step 6: Scannable Review — per-section edit dialogs with strong validation + AI breakdown */}
      {stepIndex === 4 && (
        <ReviewStep
          draft={draft}
          universities={universities}
          classification={classification}
          applicationLetter={uploads.INTERNSHIP_APPLICATION}
          assignmentLetter={uploads.ASSIGNMENT_LETTER}
          aiValidations={aiValidations}
          aiValidating={aiValidating}
          aiErrors={aiErrors}
          fullName={fullNameForAi()}
          slots={slots}
          isValidatingIdentifiers={isValidatingIdentifiers}
          onUpdatePersonal={async (patch) => {
            setStepError(null);
            const nextPersonal = {...draft.personal, ...patch};
            // Shared backend validation — same as Step 1 wizard (email/CIN/phone vs existing applications)
            // Ensures edit dialog and wizard use identical secure rules, allows keeping own values
            setIsValidatingIdentifiers(true);
            try {
              const result = await validateIdentifiersClient({
                email: nextPersonal.email.trim() || null,
                nationalId: nextPersonal.nationalId.trim() || null,
                phone: nextPersonal.phone.trim() || null,
              });
              if (!result.valid) {
                setDuplicateInfo({duplicateFields: result.duplicateFields, message: result.message});
                setShowDuplicateDialog(true);
                throw new Error(result.message);
              }
            } catch (err) {
              // If validation itself fails (network), surface as form error but don't block with duplicate dialog
              if (err instanceof Error && err.message === (duplicateInfo?.message || '')) throw err;
              const msg = err instanceof Error ? err.message : 'Validation failed';
              // Only treat as duplicate if we already showed dialog; otherwise surface as generic error
              if (duplicateInfo) throw err;
              throw new Error(msg);
            } finally {
              setIsValidatingIdentifiers(false);
            }
            // Sync to backend profile if authenticated — keeps AI name check and final submission consistent
            if (isAuthenticated) {
              try {
                await updateProfile({
                  firstName: nextPersonal.firstName,
                  lastName: nextPersonal.lastName,
                  email: nextPersonal.email,
                  nationalId: nextPersonal.nationalId,
                  universityId: draft.education.universityId,
                  phone: nextPersonal.phone,
                  birthDate: nextPersonal.birthDate,
                  diploma: draft.education.educationLevel,
                  speciality: draft.education.speciality,
                });
                setProfile((prev) => (prev ? {...prev, ...nextPersonal} : prev));
              } catch (err) {
                const msg =
                  err instanceof ApiError
                    ? err.fieldErrors[0]?.message || err.message
                    : err instanceof Error
                      ? err.message
                      : 'Update failed';
                throw new Error(msg);
              }
            }
            setDraft((prev) => {
              const next = {...prev, personal: nextPersonal};
              saveDraftToStorage(next);
              return next;
            });
            setDirty(true);
          }}
          onUpdateEducation={async (patch) => {
            setStepError(null);
            const nextEducation = {...draft.education, ...patch};
            if (isAuthenticated) {
              try {
                await updateProfile({
                  firstName: draft.personal.firstName,
                  lastName: draft.personal.lastName,
                  email: draft.personal.email,
                  nationalId: draft.personal.nationalId,
                  universityId: nextEducation.universityId,
                  phone: draft.personal.phone,
                  birthDate: draft.personal.birthDate,
                  diploma: nextEducation.educationLevel,
                  speciality: nextEducation.speciality,
                });
                setProfile((prev) => (prev ? {...prev, universityId: nextEducation.universityId, speciality: nextEducation.speciality, diploma: nextEducation.educationLevel} as CandidateProfile : prev));
              } catch (err) {
                const msg =
                  err instanceof ApiError
                    ? err.fieldErrors[0]?.message || err.message
                    : err instanceof Error
                      ? err.message
                      : 'Update failed';
                throw new Error(msg);
              }
            }
            setDraft((prev) => {
              const next = {...prev, education: nextEducation};
              saveDraftToStorage(next);
              return next;
            });
            setDirty(true);
          }}
          onUpdateDates={async (start, end) => {
            setStepError(null);
            const nextDraft: WizardDraft = {...draft, dates: {desiredStartDate: start, desiredEndDate: end}};
            setDraft((prev) => {
              const next = {...prev, dates: {desiredStartDate: start, desiredEndDate: end}};
              saveDraftToStorage(next);
              return next;
            });
            setDirty(true);
            if (isAuthenticated) {
              await persistDraft(nextDraft);
            }
          }}
          onSelectFiles={(kind, files) => {
            setStepError(null);
            if (files.length > 0) void startUpload(kind, files[0]);
          }}
          onCancel={(kind) => cancelUpload(kind)}
          onRetry={(kind) => retryUpload(kind)}
          onRemove={(kind) => removeUpload(kind)}
          onRetryAi={(kind) => retryAiValidation(kind)}
          onToggleTerms={(val) => {
            setStepError(null);
            setDraft((prev) => {
              const next = {...prev, confirmedTerms: val};
              saveDraftToStorage(next);
              return next;
            });
            setDirty(true);
          }}
          onContinue={() => void goNext()}
          saving={saving}
        />
      )}

      {/* Step 7: Confirmation & Tracking / Anonymous Bridge */}
      {stepIndex === 5 && (
        <SubmitStep
          isAuthenticated={isAuthenticated}
          submitting={submitting}
          submittedReference={submittedReference}
          trackingToken={trackingToken}
          candidateEmail={draft.personal.email}
          errorKey={submitError}
          onSubmit={() => void handleSubmit()}
          onAnonymousSubmit={handleAnonymousSubmit}
          onAnonymousDirect={() => handleAnonymousDirect()}
        />
      )}

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-2">
        {stepIndex > 0 && stepIndex < 6 && (
          <Button variant="secondary" size="md" onClick={goBack} disabled={saving}>
            {tnav('back')}
          </Button>
        )}
      </div>
    </div>
  );
}
