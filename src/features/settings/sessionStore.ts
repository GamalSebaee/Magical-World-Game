import { create } from 'zustand';
import { defaultDigitStyle, type DigitStyle, type LanguageMode } from '@shared/i18n/language';

/**
 * Cross-screen UI state only (02 §6). Gameplay truth lives in controllers and storage; this
 * store mirrors persisted settings so every screen re-renders when they change.
 */
export interface SessionState {
  languageMode: LanguageMode;
  digitStyle: DigitStyle;
  activeProfileId?: string;
  /** Parent area unlocked; memory only, never persisted. */
  parentUnlocked: boolean;
  setLanguage(mode: LanguageMode, digits?: DigitStyle): void;
  setActiveProfile(id: string | undefined): void;
}

export const useSession = create<SessionState>()((set) => ({
  languageMode: 'ar',
  digitStyle: 'eastern',
  parentUnlocked: false,
  setLanguage: (languageMode, digits) => set({ languageMode, digitStyle: digits ?? defaultDigitStyle(languageMode) }),
  setActiveProfile: (activeProfileId) => set({ activeProfileId }),
}));
