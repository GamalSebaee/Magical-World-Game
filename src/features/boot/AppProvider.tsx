'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { readStoredProfile, useSession } from '@features/settings/sessionStore';
import { directionFor, htmlLangFor } from '@shared/i18n/language';
import { installTestHooks } from '@game/core/testHooks';
import { bootApp, BOOT_STEPS, type AppServices, type BootStep } from './appServices';

export type BootState =
  | { phase: 'booting'; done: BootStep[] }
  | { phase: 'ready'; services: AppServices }
  | { phase: 'error'; message: string; code: string };

interface Ctx {
  boot: BootState;
  retry(): void;
}

const AppContext = createContext<Ctx | null>(null);

// One boot per page load, shared across route changes and React strict-mode double effects.
let bootPromise: Promise<AppServices> | undefined;
let bootedServices: AppServices | undefined;
let doneSteps: BootStep[] = [];

export function AppProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<BootState>(() =>
    bootedServices ? { phase: 'ready', services: bootedServices } : { phase: 'booting', done: doneSteps },
  );
  const [attempt, setAttempt] = useState(0);
  const setLanguage = useSession((s) => s.setLanguage);

  useEffect(() => {
    let cancelled = false;
    bootPromise ??= bootApp((step) => {
      doneSteps = [...doneSteps, step];
      if (!cancelled) setBoot({ phase: 'booting', done: doneSteps });
    });
    bootPromise.then(
      async (services) => {
        bootedServices = services;
        const settings = await services.storage.settings.get();
        setLanguage(settings.languageMode, settings.digitStyle);
        applyReducedMotion(settings.reducedMotion);
        services.audio.setMuted('all', settings.muted.all);
        const stored = readStoredProfile();
        if (stored && (await services.storage.profiles.get(stored))) useSession.getState().setActiveProfile(stored);
        if (services.flags.testHooks) installTestHooks(services);
        if (!cancelled) setBoot({ phase: 'ready', services });
      },
      (err: unknown) => {
        bootPromise = undefined;
        doneSteps = [];
        const code = (err as { code?: string }).code ?? 'boot_failed';
        if (!cancelled) setBoot({ phase: 'error', message: err instanceof Error ? err.message : String(err), code });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt, setLanguage]);

  const retry = useCallback(() => {
    setBoot({ phase: 'booting', done: [] });
    setAttempt((a) => a + 1);
  }, []);

  // Browsers only allow sound after a gesture: unlock on the first tap anywhere (06 §3).
  useEffect(() => {
    if (boot.phase !== 'ready') return;
    const audio = boot.services.audio;
    const onTap = () => {
      if (!audio.unlocked) void audio.unlock();
    };
    window.addEventListener('pointerdown', onTap, { capture: true });
    return () => window.removeEventListener('pointerdown', onTap, { capture: true });
  }, [boot]);

  return (
    <AppContext.Provider value={{ boot, retry }}>
      <LocaleSync />
      {children}
    </AppContext.Provider>
  );
}

/** Resolves the reduced-motion setting against the system preference (P8). */
export function applyReducedMotion(setting: 'system' | 'on' | 'off') {
  const system = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  useSession.getState().setReducedMotion(setting === 'on' || (setting === 'system' && system));
}

/** Keeps <html lang dir> and the reduced-motion flag in step with settings. */
function LocaleSync() {
  const mode = useSession((s) => s.languageMode);
  const reduced = useSession((s) => s.reducedMotion);
  useEffect(() => {
    const el = document.documentElement;
    el.lang = htmlLangFor(mode);
    el.dir = directionFor(mode);
  }, [mode]);
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reduced);
  }, [reduced]);
  return null;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp outside AppProvider');
  return ctx;
}

/** Services once booted, otherwise undefined. */
export function useServices(): AppServices | undefined {
  const { boot } = useApp();
  return boot.phase === 'ready' ? boot.services : undefined;
}

export const bootProgress = (s: BootState) =>
  s.phase === 'ready' ? 1 : s.phase === 'booting' ? s.done.length / BOOT_STEPS.length : 0;
