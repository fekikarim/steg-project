import {twMerge} from 'tailwind-merge';

/**
 * Class-names joiner: drops falsy parts, then resolves conflicting Tailwind
 * utilities so later classes win deterministically (B7: variant defaults no
 * longer fight caller overrides in an unspecified stylesheet order — e.g. a
 * white CTA button keeps its intended `text-brand-700` over `text-white`).
 */
export function cx(
  ...parts: Array<string | false | null | undefined>
): string {
  return twMerge(parts.filter(Boolean).join(' '));
}
