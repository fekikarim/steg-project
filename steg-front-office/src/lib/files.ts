/**
 * File-size formatting with localized unit labels (UI_UX §8.1: file sizes
 * must be localized). Callers pass the translated unit strings.
 */
export function formatBytes(
  bytes: number,
  units: {b: string; kb: string; mb: string},
): string {
  if (!Number.isFinite(bytes) || bytes < 0) return `0 ${units.b}`;
  if (bytes < 1024) return `${bytes} ${units.b}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${units.kb}`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ${units.mb}`;
}

/** Lowercase extension with leading dot ('' when none). */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

/** Display list of extensions, e.g. ['.pdf'] → 'PDF', ['.jpg','.png'] → 'JPG, PNG'. */
export function extensionsLabel(extensions: readonly string[]): string {
  return extensions.map((e) => e.replace(/^\./, '').toUpperCase()).join(', ');
}
