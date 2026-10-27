'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Link, usePathname, useRouter} from '@/i18n/navigation';
import {ApiError} from '@/lib/api-client';
import type {CandidateProfile, University} from '@/lib/api/candidate';
import {getProfile, updateProfile, fetchUniversities} from '@/lib/api/profile-client';
import {draftToUpdate, profileToDraft, type ProfileDraft} from '@/lib/profile-draft';
import {useAuth} from '@/lib/auth';
import {useToast} from '@/components/ui/Toast';
import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {CardSkeleton} from '@/components/feedback/Skeleton';
import {ErrorState} from '@/components/feedback/ErrorState';
import {ProfileSummary} from './ProfileSummary';
import {ActiveSituationBanner} from './ActiveSituationBanner';
import {AdministrativeDocsSection} from './AdministrativeDocsSection';
import {PersonalSection} from './PersonalSection';
import {AcademicSection} from './AcademicSection';
import {SkillsSection} from './SkillsSection';
import {AccountPanel} from './AccountPanel';
import {SaveBar} from './SaveBar';
import {ProfileCreateForm} from './ProfileCreateForm';
import type {FieldErrors} from './section-types';
import type {ApplicationDocumentResponse, ApplicationResponse} from '@/lib/api/application';

type Phase = 'loading' | 'anonymous' | 'noProfile' | 'ready' | 'error';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Authenticated candidate profile workspace (B3): pulls the candidate's own
 * record from `GET/PUT /api/candidates/me` (via our server-side proxy), edits
 * it behind local draft state, and treats the backend as the source of truth.
 * Sensitive CIN handling, structured skills/languages editing, dirty-state
 * save/cancel with unsaved-change signalling, last-save feedback, and graceful
 * 409 conflict recovery all live here.
 */
export function ProfileWorkspace() {
  const t = useTranslations('profile');
  const {logout} = useAuth();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const [phase, setPhase] = useState<Phase>('loading');
  const [conflict, setConflict] = useState(false);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formTrace, setFormTrace] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [activeApp, setActiveApp] = useState<ApplicationResponse | null>(null);
  const [adminDocs, setAdminDocs] = useState<ApplicationDocumentResponse[]>([]);

  const [universities, setUniversities] = useState<University[]>([]);
  const [universitiesState, setUniversitiesState] = useState<'loading' | 'ready' | 'error'>('loading');

  const loadUniversities = useCallback(async () => {
    try {
      setUniversities(await fetchUniversities());
      setUniversitiesState('ready');
    } catch {
      setUniversitiesState('error');
    }
  }, []);

  const retryUniversities = useCallback(() => {
    setUniversitiesState('loading');
    void loadUniversities();
  }, [loadUniversities]);

  const loadApplications = useCallback(async () => {
    try {
      const {listApplications, getApplicationDocuments} = await import(
        '@/lib/api/application-client'
      );
      const apps = await listApplications();
      if (apps.length > 0) {
        const sorted = [...apps].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        const active =
          sorted.find(
            (a) =>
              a.status === 'APPROVED' ||
              a.status === 'MODIFICATION_REQUESTED' ||
              a.status === 'RESUBMITTED' ||
              a.status === 'UNDER_REVIEW' ||
              a.status === 'SUBMITTED',
          ) ?? sorted[0];
        setActiveApp(active);
        try {
          const docs = await getApplicationDocuments(active.id);
          setAdminDocs(docs);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const applyServerProfile = useCallback((p: CandidateProfile) => {
    setProfile(p);
    setDraft(profileToDraft(p));
    setFieldErrors({});
    setFormError(null);
    setFormTrace(null);
    setSavedAt(p.updatedAt ? new Date(p.updatedAt) : null);
  }, []);

  const loadProfile = useCallback(
    async (phaseOnOk: Phase) => {
      try {
        applyServerProfile(await getProfile());
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setPhase('anonymous');
          return;
        }
        if (err instanceof ApiError && err.status === 404) {
          setPhase('noProfile');
          return;
        }
        setPhase('error');
        return;
      }
      setPhase(phaseOnOk);
    },
    [applyServerProfile],
  );

  const loadAll = useCallback(async () => {
    await Promise.all([loadUniversities(), loadProfile('ready'), loadApplications()]);
  }, [loadUniversities, loadProfile, loadApplications]);

  useEffect(() => {
    // Async data bootstrap on mount. Each loader awaits its fetch before any
    // setState, so the effect body never sets state synchronously — the one
    // exception to the rule in this codebase (see auth.tsx).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAll();
  }, [loadAll]);

  const dirty = useMemo(() => {
    if (!draft || !profile) return false;
    return JSON.stringify(draft) !== JSON.stringify(profileToDraft(profile));
  }, [draft, profile]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = useCallback((patch: Partial<ProfileDraft>) => {
    setDraft((d) => (d ? {...d, ...patch} : d));
  }, []);

  const validate = useCallback(
    (d: ProfileDraft): FieldErrors => {
      const errors: FieldErrors = {};
      if (!d.firstName.trim()) errors.firstName = t('errRequired');
      if (!d.lastName.trim()) errors.lastName = t('errRequired');
      if (!d.email.trim()) errors.email = t('errRequired');
      else if (!EMAIL_RE.test(d.email.trim())) errors.email = t('errEmail');
      if (!d.universityId) errors.universityId = t('errRequired');
      const cin = d.nationalId.trim();
      if (cin && cin.length < 5) errors.nationalId = t('errCinLength');
      return errors;
    },
    [t],
  );

  async function onSave() {
    if (!draft) return;
    const errors = validate(draft);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError(null);
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setFormTrace(null);
    setSaving(true);
    setConflict(false);
    try {
      const updated = await updateProfile(draftToUpdate(draft));
      applyServerProfile(updated);
      toast.notify({title: t('savedToast'), tone: 'success'});
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflict(true);
      } else if (err instanceof ApiError && err.fieldErrors.length > 0) {
        const localized: Record<string, string> = {
          firstName: t('errRequired'),
          lastName: t('errRequired'),
          email: t('errEmail'),
          nationalId: t('errRequired'),
          universityId: t('errRequired'),
        };
        const mapped: FieldErrors = {};
        for (const fe of err.fieldErrors) {
          if (fe.field) mapped[fe.field] = localized[fe.field] ?? fe.message ?? t('errRequired');
        }
        setFieldErrors(mapped);
        setFormError(t('saveFailed'));
        if (err.traceId) setFormTrace(err.traceId);
      } else {
        setFormError(err instanceof ApiError ? err.message : t('saveFailed'));
        if (err instanceof ApiError && err.traceId) setFormTrace(err.traceId);
      }
    } finally {
      setSaving(false);
    }
  }

  function conflictKeep() {
    setConflict(false);
    void onSave();
  }

  function conflictReload() {
    setConflict(false);
    void loadProfile('ready');
  }

  function discard() {
    if (!profile) return;
    setDraft(profileToDraft(profile));
    setFieldErrors({});
    setFormError(null);
    setFormTrace(null);
  }

  async function onSignOut() {
    await logout();
    router.replace('/');
  }

  if (phase === 'loading') {
    return (
      <div className="flex flex-col gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (phase === 'anonymous') {
    return (
      <Card className="mx-auto max-w-md items-center text-center">
        <h2 className="text-lg font-bold text-navy-900 dark:text-zinc-50">{t('anonymousTitle')}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">{t('anonymousBody')}</p>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Link href={{pathname: '/login', query: pathname ? {returnTo: pathname} : undefined}} className="flex-1">
            <Button variant="primary" size="md" className="w-full">
              {t('anonymousSignIn')}
            </Button>
          </Link>
          <Link href="/register" className="flex-1">
            <Button variant="secondary" size="md" className="w-full">
              {t('anonymousCreate')}
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  if (phase === 'noProfile') {
    return (
      <ProfileCreateForm
        onCreated={(p) => {
          applyServerProfile(p);
          setPhase('ready');
          toast.notify({title: t('createSuccess'), tone: 'success'});
        }}
        onProfileExists={() => {
          void loadProfile('ready');
        }}
      />
    );
  }

  if (phase === 'error') {
    return (
      <ErrorState
        title={t('loadErrorTitle')}
        hint={t('loadErrorHint')}
        onRetry={() => {
          setPhase('loading');
          void loadAll();
        }}
      />
    );
  }

  if (!profile || !draft) return null;

  return (
    <div className="flex flex-col gap-4">
      {conflict && (
        <Card>
          <div className="flex flex-col items-start gap-3">
            <h2 className="text-base font-bold text-navy-900 dark:text-zinc-50">{t('saveConflictTitle')}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{t('saveConflictBody')}</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={conflictKeep}>
                {t('saveConflictKeep')}
              </Button>
              <Button variant="primary" onClick={conflictReload}>
                {t('saveConflictReload')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {formError && (
        <Card>
          <div role="alert" className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-accent-700 dark:text-accent-100">{formError}</span>
            {formTrace && <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{formTrace}</span>}
          </div>
        </Card>
      )}

      <ActiveSituationBanner application={activeApp} />

      <ProfileSummary profile={profile} />

      <PersonalSection
        draft={draft}
        errors={fieldErrors}
        cinBase={profile.nationalId}
        update={update}
        disabled={saving}
      />

      <AcademicSection
        draft={draft}
        errors={fieldErrors}
        update={update}
        universities={universities}
        universitiesState={universitiesState}
        onRetryUniversities={retryUniversities}
        disabled={saving}
      />

      <AdministrativeDocsSection documents={adminDocs} />

      <SkillsSection draft={draft} errors={fieldErrors} update={update} disabled={saving} />

      <AccountPanel profile={profile} hasUnsavedChanges={dirty} onSignOut={() => void onSignOut()} />

      {!conflict && (
        <SaveBar
          dirty={dirty}
          saving={saving}
          savedAt={savedAt}
          onSave={() => void onSave()}
          onDiscard={discard}
        />
      )}
    </div>
  );
}