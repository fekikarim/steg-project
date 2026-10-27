import type {CandidateProfile, CandidateProfileUpdate} from './api/candidate';

/**
 * Editable form state for the profile workspace plus pure conversions between
 * it and the backend DTO. Kept out of React files so the QA scripts can share
 * the exact same split/join logic the UI uses (skills & languages are stored
 * as comma strings by the backend and edited as chips in the UI — B3 task 4).
 */
export interface ProfileDraft {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
  address: string;
  speciality: string;
  diploma: string;
  skills: string[];
  languages: string[];
  nationalId: string;
  universityId: string;
}

export function splitList(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function profileToDraft(p: CandidateProfile): ProfileDraft {
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    phone: p.phone ?? '',
    birthDate: p.birthDate ?? '',
    address: p.address ?? '',
    speciality: p.speciality ?? '',
    diploma: p.diploma ?? '',
    skills: splitList(p.skills),
    languages: splitList(p.languages),
    nationalId: p.nationalId,
    universityId: p.universityId,
  };
}

export function draftToUpdate(d: ProfileDraft): CandidateProfileUpdate {
  return {
    email: d.email.trim(),
    firstName: d.firstName.trim(),
    lastName: d.lastName.trim(),
    nationalId: d.nationalId.trim(),
    universityId: d.universityId,
    phone: d.phone.trim() || null,
    birthDate: d.birthDate || null,
    address: d.address.trim() || null,
    speciality: d.speciality.trim() || null,
    diploma: d.diploma.trim() || null,
    skills: d.skills.length ? d.skills.join(', ') : null,
    languages: d.languages.length ? d.languages.join(', ') : null,
  };
}