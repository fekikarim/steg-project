import type {ProfileDraft} from '@/lib/profile-draft';

export type FieldErrors = Record<string, string>;

export interface SectionProps {
  draft: ProfileDraft;
  errors?: FieldErrors;
  update: (patch: Partial<ProfileDraft>) => void;
  disabled?: boolean;
}