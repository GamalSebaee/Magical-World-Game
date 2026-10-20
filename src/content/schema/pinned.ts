/**
 * Zod-free helpers the app needs at runtime (content is validated at build time, so the app
 * bundle never loads the schema library).
 */

/** Splits "word.animals.cat:en" into its clip id and pinned language. */
export function parsePinnedClip(pinned: string): { id: string; lang: 'ar' | 'en' } {
  const idx = pinned.lastIndexOf(':');
  return { id: pinned.slice(0, idx), lang: pinned.slice(idx + 1) as 'ar' | 'en' };
}
