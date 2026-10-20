'use client';

import '@game/registerScenes';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LevelDefinition } from '@content/schema';
import type { AppServices } from '@features/boot/appServices';
import { LevelRunner, type RunnerState } from '@features/levels/LevelRunner';
import { useSession } from '@features/settings/sessionStore';
import { CaptionBubble, useGuardedProfile } from '@features/shell/ChildScreen';
import { SpeechPanel } from '@features/speech/SpeechPanel';
import { speechPort, useAudioStatus } from '@features/voice/voice';
import { logicFor } from '@game/activities/registry';
import { ActivityController, type ActivitySnapshot } from '@game/core/engine/ActivityController';
import { idleHintMs, magnetAllowed } from '@game/core/engine/hintPolicy';
import { GameHost } from '@game/core/GameHost';
import { setActivityProbe } from '@game/core/testHooks';
import type { ActivitySceneData } from '@game/core/sceneTypes';
import { ACTIVITY_SCENE } from '@game/core/scenes/keys';
import type { ChildProfile, Settings } from '@services/storage/records';
import type { MicState } from '@shared/events';
import { primaryLang } from '@shared/i18n/language';
import { t } from '@shared/i18n/uiStrings';
import { BigButton } from '@shared/ui/BigButton';
import { BulbIcon, EarIcon, MapIcon, NextIcon, PauseIcon, PlayIcon, RetryIcon, SpeakerIcon } from '@shared/ui/icons';
import { Nono, type NonoMood } from '@shared/ui/Nono';

export function LevelPlay({ levelId }: { levelId: string }) {
  return (
    <Suspense>
      <PlayGate levelId={levelId} />
    </Suspense>
  );
}

function PlayGate({ levelId }: { levelId: string }) {
  const { services, profile } = useGuardedProfile();
  const resume = useSearchParams().get('resume') === '1';
  const [settings, setSettings] = useState<Settings>();
  useEffect(() => {
    if (services) void services.storage.settings.get().then(setSettings);
  }, [services]);
  if (!services || !profile || !settings) {
    return (
      <main className="child-screen flex items-center justify-center" aria-busy="true">
        <Nono mood="waiting" size={110} />
      </main>
    );
  }
  const r = services.content.level(levelId);
  if (!r.ok) return <main className="child-screen flex items-center justify-center text-xl">{t('levelNotReady', 'ar')}</main>;
  return <Play services={services} profile={profile} level={r.value} settings={settings} resume={resume} />;
}

/** C8 Gameplay shell: the activity canvas plus the HUD, Nono, overlays and captions. */
function Play({
  services,
  profile,
  level,
  settings,
  resume,
}: {
  services: AppServices;
  profile: ChildProfile;
  level: LevelDefinition;
  settings: Settings;
  resume: boolean;
}) {
  const router = useRouter();
  const lang = primaryLang(useSession((s) => s.languageMode));
  const reducedMotion = useSession((s) => s.reducedMotion);
  const digits = useSession((s) => s.digitStyle);
  const setLastResult = useSession((s) => s.setLastResult);
  const runnerRef = useRef<LevelRunner | undefined>(undefined);
  const [state, setState] = useState<RunnerState>();
  const [snap, setSnap] = useState<ActivitySnapshot>();
  const [paused, setPaused] = useState(false);
  const [micState, setMicState] = useState<MicState | 'listening_prompt_only'>();
  const [muted, setMuted] = useState(settings.muted.all);
  const audio = useAudioStatus(services.audio);
  const leaving = useRef(false);

  // One runner per visit. Disposing it stops the controller, audio and (via the panel) the mic.
  useEffect(() => {
    const r = new LevelRunner({
      level,
      profileId: profile.id,
      storage: services.storage,
      events: services.events,
      clock: services.clock,
      ids: services.ids,
      logger: services.logger,
      makeController: (a) => {
        const logic = logicFor(a.def);
        if (!logic) return undefined;
        return new ActivityController({
          ...a,
          logic,
          speech: speechPort(services),
          timers: { setTimeout: (fn, ms) => window.setTimeout(fn, ms), clearTimeout: (h) => window.clearTimeout(h as number) },
          idleHintMs: idleHintMs(profile.ageBand, settings.hintTiming),
        });
      },
    });
    runnerRef.current = r;
    const off = r.subscribe(setState);
    let cancelled = false;
    void (async () => {
      const snapshot = resume ? await services.storage.activeSession.resumable(profile.id, level.id, level.contentVersion).catch(() => undefined) : undefined;
      if (!resume) await services.storage.activeSession.clear(profile.id).catch(() => {});
      if (!cancelled) r.start(snapshot);
    })();
    return () => {
      cancelled = true;
      off();
      r.dispose();
      runnerRef.current = undefined;
      services.audio.stopVoice();
      // Never leave the next screen with a suspended (silent) audio context.
      void services.audio.resumeAll();
    };
  }, [services, profile, level, settings.hintTiming, resume]);

  const controller = state?.controller;
  useEffect(() => controller?.subscribe(setSnap), [controller]);
  useEffect(() => {
    if (!services.flags.testHooks) return;
    setActivityProbe(() => controller?.snapshot);
    return () => setActivityProbe(undefined);
  }, [services, controller]);

  // Finished: hand over to the result screen.
  useEffect(() => {
    const result = state?.result;
    if (!result || leaving.current) return;
    leaving.current = true;
    setLastResult({ levelId: result.levelId, stickerNew: result.stickerNew, firstCompletion: result.firstCompletion });
    router.replace(`/level/${level.id}/result/`);
  }, [state?.result, level.id, router, setLastResult]);

  const pause = useCallback(() => {
    runnerRef.current?.pause();
    void services.audio.pauseAll();
    setPaused(true);
  }, [services, setPaused]);

  const resumePlay = () => {
    setPaused(false);
    void services.audio.resumeAll().then(() => runnerRef.current?.resume());
  };

  // Backgrounding pauses; on return the pause menu is waiting (03 C8, C12).
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') pause();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', pause);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', pause);
    };
  }, [pause]);

  // Browser back opens the pause menu instead of leaving mid-activity (02 §5).
  useEffect(() => {
    history.pushState({ mwgPlay: true }, '');
    const onPop = () => {
      if (leaving.current) return;
      history.pushState({ mwgPlay: true }, '');
      pause();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [pause]);

  const leaveTo = (href: string) => {
    leaving.current = true;
    runnerRef.current?.saveSnapshot();
    void services.audio.resumeAll();
    router.replace(href);
  };

  const sceneData: ActivitySceneData | undefined = useMemo(
    () =>
      controller
        ? {
            ctx: {
              def: controller.definition,
              background: level.background,
              controller,
              assets: services.content.assetTable(),
              reducedMotion,
              digits,
              magnet: magnetAllowed(profile.ageBand),
              vocabPicture: (v) => services.content.vocabulary(v)?.picture,
            },
          }
        : undefined,
    [controller, services, reducedMotion, digits, profile.ageBand, level.background],
  );

  const mood: NonoMood =
    micState === 'recording' || micState === 'listening_prompt_only'
      ? 'listening'
      : audio?.speaking
        ? 'talking'
        : snap?.last?.kind === 'correct' && snap.phase === 'feedback'
          ? 'celebrating'
          : snap?.hintLevel && snap.hintLevel >= 2
            ? 'helping'
            : 'idle';

  const total = state?.total ?? level.activities.length;
  const index = state?.index ?? 0;

  return (
    <main className="relative h-[100dvh] w-full select-none overflow-hidden" data-testid="play" data-activity={snap?.activityId} data-phase={snap?.phase}>
      <div className="absolute inset-0">
        {sceneData && (
          <GameHost scene={ACTIVITY_SCENE} data={sceneData} dataKey={`${state?.runId}:${index}:${controller?.definition.id ?? ''}`} />
        )}
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 pt-[max(12px,var(--safe-top))]">
        <div className="pointer-events-auto flex gap-2">
          <BigButton label={t('listenAgain', lang)} size="target" onPress={() => controller?.replay()} data-testid="hud-ear" className={audio?.blocked && !audio.unlocked ? 'animate-attention' : ''}>
            <EarIcon />
          </BigButton>
          <BigButton label={t('help', lang)} size="target" onPress={() => controller?.help()} data-testid="hud-help">
            <BulbIcon />
          </BigButton>
        </div>
        <ol className="flex items-center gap-2 self-center" aria-label={`${index + 1} / ${total}`} data-testid="progress-dots">
          {Array.from({ length: total }, (_, i) => (
            <li key={i} className={`h-4 w-4 rounded-full border-2 border-ink-700 ${i < index ? 'bg-sun-400' : i === index ? 'bg-cloud-0' : 'bg-cloud-0/50'}`} />
          ))}
        </ol>
        <div className="pointer-events-auto">
          <BigButton label={t('pause', lang)} size="target" onPress={pause} data-testid="hud-pause">
            <PauseIcon />
          </BigButton>
        </div>
      </header>

      <div className="pointer-events-none absolute bottom-0 start-0 z-20 p-3 pb-[max(12px,var(--safe-bottom))]">
        <Nono mood={mood} size={96} />
      </div>

      <div className="pointer-events-none absolute bottom-0 end-0 z-20 p-3 pb-[max(12px,var(--safe-bottom))]">
        <BigButton
          label={t('skip', lang)}
          size="target"
          onPress={() => controller?.skip()}
          data-testid="hud-skip"
          className={`pointer-events-auto ${snap?.offerSkip ? 'animate-attention' : 'opacity-80'}`}
        >
          <NextIcon />
        </BigButton>
      </div>

      {controller && snap && snap.mechanic === 'speak_repeat' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[max(96px,calc(var(--safe-bottom)+96px))] z-30 flex justify-center px-4 landscape:inset-x-auto landscape:bottom-auto landscape:right-6 landscape:top-1/2 landscape:-translate-y-1/2">
          <SpeechPanel
            key={snap.activityId}
            services={services}
            controller={controller}
            snap={snap}
            micEnabled={settings.micEnabled}
            lang={lang}
            onMicState={setMicState}
          />
        </div>
      )}

      {paused && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-ink-700/50 p-4" role="dialog" aria-modal="true" aria-label={t('pause', lang)} data-testid="pause-menu">
          <div className="grid grid-cols-2 gap-5 rounded-[2rem] bg-cloud-0 p-6 shadow-xl landscape:grid-cols-4">
            <BigButton label={t('resume', lang)} size="hero" onPress={resumePlay} data-testid="pause-resume" className="bg-leaf-500">
              <PlayIcon size={64} />
            </BigButton>
            <BigButton
              label={t('restart', lang)}
              size="hero"
              onPress={() => {
                setPaused(false);
                void services.audio.resumeAll().then(() => runnerRef.current?.restartActivity());
              }}
              data-testid="pause-restart"
            >
              <RetryIcon size={56} />
            </BigButton>
            <BigButton label={t('map', lang)} size="hero" onPress={() => leaveTo('/map/')} data-testid="pause-map">
              <MapIcon size={56} />
            </BigButton>
            <BigButton
              label={t('sound', lang)}
              size="hero"
              aria-pressed={!muted}
              onPress={async () => {
                const next = !muted;
                setMuted(next);
                services.audio.setMuted('all', next);
                const cur = await services.storage.settings.get();
                await services.storage.settings.patch({ muted: { ...cur.muted, all: next } });
              }}
              data-testid="pause-sound"
            >
              <SpeakerIcon size={56} muted={muted} />
            </BigButton>
          </div>
        </div>
      )}
      <CaptionBubble services={services} position="top" />
    </main>
  );
}
