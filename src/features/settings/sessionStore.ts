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
  /** Parent area unlocked until this time (ms); memory only, never persisted. */
  parentUnlockedUntil: number;
  /** Result of the level just finished, for the result screen (a refresh shows the replay view). */
  lastResult?: { levelId: string; stickerNew: boolean; firstCompletion: boolean };
  reducedMotion: boolean;
  setLanguage(mode: LanguageMode, digits?: DigitStyle): void;
  setActiveProfile(id: string | undefined): void;
  unlockParent(ms: number): void;
  lockParent(): void;
  setLastResult(r: SessionState['lastResult']): void;
  setReducedMotion(on: boolean): void;
}

const PROFILE_KEY = 'mwg.activeProfile';

/** The active profile id is a per-device convenience (02 §6); losing it only re-shows profile choice. */
export function readStoredProfile(): string | undefined {
  try {
    return localStorage.getItem(PROFILE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export const useSession = create<SessionState>()((set) => ({
  languageMode: 'ar',
  digitStyle: 'eastern',
  parentUnlockedUntil: 0,
  reducedMotion: false,
  setLanguage: (languageMode, digits) => set({ languageMode, digitStyle: digits ?? defaultDigitStyle(languageMode) }),
  setActiveProfile: (activeProfileId) => {
    try {
      if (activeProfileId) localStorage.setItem(PROFILE_KEY, activeProfileId);
      else localStorage.removeItem(PROFILE_KEY);
    } catch {
      /* private mode: memory only */
    }
    set({ activeProfileId });
  },
  unlockParent: (ms) => set({ parentUnlockedUntil: Date.now() + ms }),
  lockParent: () => set({ parentUnlockedUntil: 0 }),
  setLastResult: (lastResult) => set({ lastResult }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}));
