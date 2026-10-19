export type Lang = 'ar' | 'en';
export type LanguageMode = 'ar' | 'en' | 'mixed';
export type Direction = 'rtl' | 'ltr';
export type DigitStyle = 'eastern' | 'western';

/** Mixed mode is Arabic-first, so it uses RTL (05 §4.1). */
export function directionFor(mode: LanguageMode): Direction {
  return mode === 'en' ? 'ltr' : 'rtl';
}

/** The `lang` attribute for the document in a given mode. */
export function htmlLangFor(mode: LanguageMode): string {
  return mode === 'en' ? 'en' : 'ar-EG';
}

/** Primary language used to pick UI strings and (non-mixed) audio. */
export function primaryLang(mode: LanguageMode): Lang {
  return mode === 'en' ? 'en' : 'ar';
}

const EASTERN = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const;

/** Format a non-negative integer with the chosen digit glyphs. */
export function formatDigits(n: number, style: DigitStyle): string {
  const s = String(Math.trunc(n));
  if (style === 'western') return s;
  return s.replace(/\d/g, (d) => EASTERN[Number(d)] ?? d);
}

/** Default digits: Eastern Arabic in Arabic and mixed modes (12-open-questions Q7). */
export function defaultDigitStyle(mode: LanguageMode): DigitStyle {
  return mode === 'en' ? 'western' : 'eastern';
}
