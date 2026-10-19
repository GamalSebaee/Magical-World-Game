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
  listenAgain: { ar: 'نسمع تاني', en: 'Listen again' },
  pause: { ar: 'استراحة', en: 'Pause' },
  help: { ar: 'مساعدة', en: 'Help' },
  resume: { ar: 'نكمّل', en: 'Resume' },
  restart: { ar: 'من الأول', en: 'Start again' },
  sound: { ar: 'الصوت', en: 'Sound' },
  skip: { ar: 'نعدّي', en: 'Skip' },
  next: { ar: 'اللي بعده', en: 'Next' },
  start: { ar: 'يلا نبدأ', en: 'Start' },
  continueGame: { ar: 'نكمّل', en: 'Continue' },
  startOver: { ar: 'نبدأ من الأول', en: 'Start over' },
  replay: { ar: 'نلعب تاني', en: 'Play again' },
  stickers: { ar: 'كتاب الملصقات', en: 'Sticker book' },
  avatar: { ar: 'شكلي', en: 'My look' },
  grownUps: { ar: 'الكبار', en: 'Grown-ups' },
  addChild: { ar: 'طفل جديد (للكبار)', en: 'Add a child (grown-ups)' },
  save: { ar: 'حفظ', en: 'Save' },
  cancel: { ar: 'إلغاء', en: 'Cancel' },
  random: { ar: 'مفاجأة', en: 'Surprise me' },
  record: { ar: 'نسجّل', en: 'Record' },
  stop: { ar: 'خلاص', en: 'Stop' },
  hearMe: { ar: 'نسمع صوتنا', en: 'Hear my voice' },
  again: { ar: 'تاني', en: 'Again' },
  listenModel: { ar: 'نسمع نونو', en: 'Listen to Nono' },
  sayTogether: { ar: 'نقولها مع نونو', en: 'Say it with Nono' },
  recording: { ar: 'بنسجّل…', en: 'Recording…' },
  micOffNote: { ar: 'الميكروفون مقفول من الكبار — نقول الكلمة بصوت عالي!', en: 'The microphone is off — let’s say the word out loud!' },
  micDeniedNote: { ar: 'المتصفح منع الميكروفون — نقول الكلمة بصوت عالي!', en: 'The browser blocked the microphone — let’s say it out loud!' },
  newSticker: { ar: 'ملصق جديد!', en: 'New sticker!' },
  haveSticker: { ar: 'الملصق ده عندنا', en: 'You have this sticker' },
  levelNotReady: { ar: 'المستوى ده مش جاهز في النسخة دي', en: 'This level is not in this build' },
  notFound: { ar: 'الصفحة دي مش موجودة', en: "This page doesn't exist" },
} as const satisfies Record<string, Record<Lang, string>>;

export type UiStringKey = keyof typeof strings;

export function t(key: UiStringKey, lang: Lang): string {
  return strings[key][lang];
}
