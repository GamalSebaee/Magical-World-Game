'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import { bootProgress, useApp } from '../_providers/AppProvider';
import { useSession } from '@features/settings/sessionStore';
import { applyUpdateIfWaiting, getOfflineStatus, subscribeOfflineStatus } from '@services/offline/serviceWorker';
import { primaryLang, type LanguageMode } from '@shared/i18n/language';
import { t } from '@shared/i18n/uiStrings';
import { BigButton } from '@shared/ui/BigButton';
import { CheckIcon, NonoPlaceholder, PlayIcon, RetryIcon } from '@shared/ui/icons';

/** C1 Splash / loading (03-screen-specifications). */
export default function SplashPage() {
  const router = useRouter();
  const { boot, retry } = useApp();
  const mode = useSession((s) => s.languageMode);
  const lang = primaryLang(mode);
  const offline = useSyncExternalStore(subscribeOfflineStatus, getOfflineStatus, getOfflineStatus);
  const progress = bootProgress(boot);
  const services = boot.phase === 'ready' ? boot.services : undefined;

  // The splash is a safe place to apply a waiting update: no level is in progress (08 §7).
  useEffect(() => {
    if (offline.state === 'ready' && offline.updateWaiting) applyUpdateIfWaiting();
  }, [offline]);

  return (
    <main className="child-screen flex flex-col items-center justify-center gap-8 landscape:flex-row landscape:gap-16">
      <section className="flex flex-col items-center gap-4">
        <div className="animate-bob">
          <NonoPlaceholder size={150} />
        </div>
        <h1 className="text-center text-3xl font-bold">{t('appName', lang)}</h1>
      </section>

      <section className="flex flex-col items-center gap-6">
        {boot.phase === 'error' ? (
          <div role="alert" className="flex flex-col items-center gap-4 rounded-3xl bg-cloud-0 p-6 text-center shadow">
            <p className="text-xl font-semibold">{t('bootError', lang)}</p>
            <p className="text-sm opacity-70" dir="ltr">
              {boot.code}
            </p>
            <BigButton label={t('retry', lang)} size="primary" onPress={retry}>
              <RetryIcon />
            </BigButton>
          </div>
        ) : services ? (
          <BigButton label={t('play', lang)} size="hero" onPress={() => router.push('/map/')} data-testid="play">
            <PlayIcon size={72} />
          </BigButton>
        ) : (
          <div
            role="progressbar"
            aria-label={t('loading', lang)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            className="h-6 w-56 overflow-hidden rounded-full border-4 border-ink-700 bg-cloud-0"
          >
            <div className="h-full bg-leaf-500 transition-[width]" style={{ width: `${progress * 100}%` }} />
          </div>
        )}

        {services && <LanguagePicker lang={lang} />}

        {services?.storageStatus.backend === 'memory' && (
          <p role="status" className="max-w-xs rounded-xl bg-sun-400/40 px-3 py-2 text-center text-sm">
            {t('storageFallback', lang)}
          </p>
        )}

        <OfflineBadge state={offline.state} lang={lang} />
      </section>
    </main>
  );
}

function OfflineBadge({ state, lang }: { state: ReturnType<typeof getOfflineStatus>['state']; lang: 'ar' | 'en' }) {
  const text =
    state === 'ready'
      ? t('offlineReady', lang)
      : state === 'dev'
        ? t('offlineDev', lang)
        : state === 'unsupported' || state === 'error'
          ? t('offlineUnavailable', lang)
          : t('offlineInstalling', lang);
  return (
    <p role="status" data-testid="offline-status" data-state={state} className="flex items-center gap-1 text-sm opacity-80">
      {state === 'ready' && <CheckIcon />}
      {text}
    </p>
  );
}

/**
 * Temporary: language switching lives here until the parent area exists (Phase 6, P5 screen).
 * Kept small and below the Play button so a child is unlikely to need it.
 */
function LanguagePicker({ lang }: { lang: 'ar' | 'en' }) {
  const { boot } = useApp();
  const mode = useSession((s) => s.languageMode);
  const setLanguage = useSession((s) => s.setLanguage);
  const options: Array<[LanguageMode, Parameters<typeof t>[0]]> = [
    ['ar', 'langAr'],
    ['en', 'langEn'],
    ['mixed', 'langMixed'],
  ];
  const choose = (m: LanguageMode) => {
    setLanguage(m);
    if (boot.phase === 'ready') {
      const digits = useSession.getState().digitStyle;
      void boot.services.storage.settings.patch({ languageMode: m, digitStyle: digits });
    }
  };
  return (
    <fieldset className="flex items-center gap-2" aria-label={t('language', lang)}>
      {options.map(([m, key]) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => choose(m)}
          data-testid={`lang-${m}`}
          className={`min-h-[48px] rounded-full border-2 border-ink-700 px-4 text-base ${mode === m ? 'bg-ink-700 text-cloud-0' : 'bg-cloud-0'}`}
        >
          {t(key, lang)}
        </button>
      ))}
    </fieldset>
  );
}
