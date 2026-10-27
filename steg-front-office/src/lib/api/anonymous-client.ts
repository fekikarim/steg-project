/**
 * Anonymous (account-less) application client (E3.1).
 * Browser code talks to our own `/api/public/*` proxies; the backend owns
 * validation, CIN-uniqueness, classification and the tracking token.
 */

export interface AnonymousApplicationFields {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  birthDate?: string;
  nationalId: string;
  universityId: string;
  speciality?: string;
  diploma?: string;
  desiredStartDate: string;
  desiredEndDate: string;
}

export interface AnonymousSubmissionResult {
  reference: string;
  status: string;
  trackingToken: string;
}

export interface TrackedApplication {
  reference: string;
  status: string;
  calculatedType?: string | null;
  requirement?: string | null;
  statusExplanation?: string | null;
  nextStep?: string | null;
  timeline?: string[];
  documentsSummary?: string[];
}

async function readError(res: Response, fallback: string): Promise<never> {
  const data = (await res.json().catch(() => null)) as {message?: string} | null;
  throw new Error(data?.message || fallback);
}

/** Submit without an account. Files are sent as `documents` parts. */
export async function submitAnonymous(
  fields: AnonymousApplicationFields,
  files: File[],
): Promise<AnonymousSubmissionResult> {
  const form = new FormData();
  form.append(
    'application',
    new Blob([JSON.stringify(fields)], {type: 'application/json'}),
  );
  for (const file of files) form.append('documents', file, file.name);
  const res = await fetch('/api/public/applications', {method: 'POST', body: form});
  if (!res.ok) await readError(res, 'Submission failed.');
  return (await res.json()) as AnonymousSubmissionResult;
}

/** Track without an account using the one-time tracking token. */
export async function trackApplication(trackingToken: string): Promise<TrackedApplication> {
  const res = await fetch('/api/public/applications/track', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({trackingToken}),
  });
  if (!res.ok) await readError(res, 'Tracking failed.');
  return (await res.json()) as TrackedApplication;
}
