'use client';

import {useCallback, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {ApiError} from '@/lib/api-client';
import type {CandidateProfile, University} from '@/lib/api/candidate';
import {createProfile, fetchUniversities} from '@/lib/api/profile-client';
import {draftToUpdate, type ProfileDraft} from '@/lib/profile-draft';
import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {PersonalSection} from './PersonalSection';
import {AcademicSection} from './AcademicSection';
import {SkillsSection} from './SkillsSection';
import type {FieldErrors} from './section-types';

interface ProfileCreateFormProps {
  onCreated: (profile: CandidateProfile) => void;
  /** Backend reports a profile already exists (e.g. retried creation). */
  onProfileExists: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const blankDraft: ProfileDraft = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  birthDate: '',
  address: '',
  speciality: '',
  diploma: '',
  skills: [],
  languages: [],
  nationalId: '',
  universityId: '',
};

/**
 * First-time candidate profile creation (onboarding gap fix). Reuses the B3
 * section components verbatim — same fields, same CIN masking behavior
 * (nothing pre-loaded, masked display with explicit reveal/edit), same
 * university reference list, same chip editors — so creation and editing can
 * never drift apart. Unlike editing, nationalId is mandatory here because
 * the backend contract requires it at creation time.
 */
export function ProfileCreateForm({onCreated, onProfileExists}: ProfileCreateFormProps) {
  const t = useTranslations('profile');

  const [draft, setDraft] = useState<ProfileDraft>(blankDraft);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formTrace, setFormTrace] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    // async bootstrap on mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUniversities();
  }, [loadUniversities]);

  const update = useCallback((patch: Partial<ProfileDraft>) => {
    setDraft((d) => ({...d, ...patch}));
  }, []);

  function validate(d: ProfileDraft): FieldErrors {
    const errors: FieldErrors = {};
    if (!d.firstName.trim()) errors.firstName = t('errRequired');
    if (!d.lastName.trim()) errors.lastName = t('errRequired');
    if (!d.email.trim()) errors.email = t('errRequired');
    else if (!EMAIL_RE.test(d.email.trim())) errors.email = t('errEmail');
    if (!d.universityId) errors.universityId = t('errRequired');
    const cin = d.nationalId.trim();
    if (!cin) errors.nationalId = t('errRequired');
    else if (cin.length < 5) errors.nationalId = t('errCinLength');
    return errors;
  }

  async function onSubmit() {
    const errors = validate(draft);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError(null);
      setFormTrace(null);
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setFormTrace(null);
    setSaving(true);
    try {
      const created = await createProfile(draftToUpdate(draft));
      onCreated(created);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CANDIDATE_PROFILE_EXISTS') {
        // Lost race or retried submit after a dropped response: the profile
        // is there — re-read it instead of failing.
        onProfileExists();
      } else if (err instanceof ApiError && err.code === 'CANDIDATE_NATIONAL_ID_DUPLICATE') {
        setFieldErrors({nationalId: t('errCinDuplicate')});
        setFormError(t('saveFailed'));
        if (err.traceId) setFormTrace(err.traceId);
      } else if (err instanceof ApiError && err.code === 'CANDIDATE_NATIONAL_ID_REQUIRED') {
        // The backend owns the rule (POST /api/candidates is self-service and
        // requires a CIN); the form already blocks it, so reaching this branch
        // means the value was cleared in another tab or an old draft. Show it
        // on the field instead of leaking the raw backend message.
        setFieldErrors({nationalId: t('errRequired')});
        setFormError(t('saveFailed'));
        if (err.traceId) setFormTrace(err.traceId);
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

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="text-lg font-bold text-navy-900 dark:text-zinc-50">{t('createTitle')}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{t('createIntro')}</p>
      </Card>

      {formError && (
        <Card>
          <div role="alert" className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-accent-700 dark:text-accent-100">{formError}</span>
            {formTrace && (
              <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400" dir="ltr">
                traceId: {formTrace}
              </span>
            )}
          </div>
        </Card>
      )}

      <PersonalSection
        draft={draft}
        errors={fieldErrors}
        cinBase=""
        update={update}
        disabled={saving}
      />

      <AcademicSection
        draft={draft}
        errors={fieldErrors}
        update={update}
        universities={universities}
        universitiesState={universitiesState}
        onRetryUniversities={() => {
          setUniversitiesState('loading');
          void loadUniversities();
        }}
        disabled={saving}
      />

      <SkillsSection draft={draft} errors={fieldErrors} update={update} disabled={saving} />

      <div className="flex justify-end">
        <Button variant="primary" size="md" onClick={() => void onSubmit()} disabled={saving}>
          {saving ? t('saving') : t('createSubmit')}
        </Button>
      </div>
    </div>
  );
}
