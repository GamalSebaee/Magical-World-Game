import type { Lang } from './language';

/**
 * Captions and accessible names. The child never needs to read these; they label controls for
 * adults and assistive technology. Arabic is gender-neutral (05 §4.3). Drafts pending native review.
 */
const strings = {
  appName: { ar: 'عالم مريم السحري', en: "Mariam's Magical World" },
  play: { ar: 'يلا نلعب', en: 'Play' },
  retry: { ar: 'نجرب تاني', en: 'Try again' },
  back: { ar: 'رجوع', en: 'Back' },
  home: { ar: 'البداية', en: 'Home' },
  loading: { ar: 'بنجهّز اللعبة…', en: 'Getting the game ready…' },
  offlineReady: { ar: 'جاهزة من غير إنترنت', en: 'Ready offline' },
  offlineInstalling: { ar: 'بنحفظ اللعبة علشان تشتغل من غير إنترنت…', en: 'Saving the game for offline play…' },
  offlineUnavailable: { ar: 'اللعب من غير إنترنت مش متاح في المتصفح ده', en: 'Offline play is not available in this browser' },
  offlineDev: { ar: 'وضع التطوير: الحفظ من غير إنترنت متوقف', en: 'Development mode: offline caching is off' },
  storageFallback: {
    ar: 'التقدّم مش هيتحفظ في وضع المتصفح ده',
    en: "Progress won't be saved in this browser mode",
  },
  bootError: { ar: 'حصلت مشكلة صغيرة', en: 'Something went wrong' },
  language: { ar: 'اللغة', en: 'Language' },
  langAr: { ar: 'العربية', en: 'Arabic' },
  langEn: { ar: 'الإنجليزية', en: 'English' },
  langMixed: { ar: 'مزيج', en: 'Mixed' },
  map: { ar: 'الخريطة', en: 'Map' },
  foundationNotice: {
    ar: 'دي نسخة الأساس (المرحلة ١). العوالم الحقيقية جاية في المرحلة ٢.',
    en: 'This is the foundation build (Phase 1). Real worlds arrive in Phase 2.',
  },
  notFound: { ar: 'الصفحة دي مش موجودة', en: "This page doesn't exist" },
} as const satisfies Record<string, Record<Lang, string>>;

export type UiStringKey = keyof typeof strings;

export function t(key: UiStringKey, lang: Lang): string {
  return strings[key][lang];
}
