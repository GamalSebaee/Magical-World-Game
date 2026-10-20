'use client';

import '@game/registerScenes';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { AppServices } from '@features/boot/appServices';
import { useSession } from '@features/settings/sessionStore';
import { CaptionBubble } from '@features/shell/ChildScreen';
import { SpeechPanel } from '@features/speech/SpeechPanel';
import { speechPort } from '@features/voice/voice';
import { logicFor } from '@game/activities/registry';
import { ActivityController, type ActivitySnapshot } from '@game/core/engine/ActivityController';
import { GameHost } from '@game/core/GameHost';
import { layoutProblems } from '@game/core/layout';
import type { ActivitySceneData } from '@game/core/sceneTypes';
import { ACTIVITY_SCENE } from '@game/core/scenes/keys';
import { phaserHost, VIEWPORT_REGISTRY_KEY } from '@game/core/phaserHost';
import { setActivityProbe } from '@game/core/testHooks';
import { belowHud, type Viewport } from '@game/core/viewport';
import { fakeMicEnvironment, type FakeMicMode } from '@services/mic/fakeMicEnvironment';
import { MicrophoneRecorder } from '@services/mic/MicrophoneRecorder';
import type { MicState } from '@shared/events';
import { primaryLang, type LanguageMode } from '@shared/i18n/language';
import { playgroundEntries } from './fixtures';

type Orientation = 'fill' | 'portrait' | 'landscape';
type Mic = 'off' | 'real' | FakeMicMode;
const FRAME: Record<Exclude<Orientation, 'fill'>, { width: number; height: number }> = {
  portrait: { width: 390, height: 720 },
  landscape: { width: 800, height: 390 },
};

interface LogLine {
  at: number;
  text: string;
}

/**
 * Debug playground (04 §9): run any activity alone with language, orientation, reduced motion,
 * fake microphone, sound and magnet toggles, and watch the controller state. Adults only; it is
 * not part of release builds (the route is a `page.dev.tsx`, D20).
 */
export function Playground({ services }: { services: AppServices }) {
  const router = useRouter();
  const params = useSearchParams();
  const entries = useMemo(() => playgroundEntries(), []);
  const selectedId = params.get('a') ?? entries[0]!.def.id;
  const orientation = (params.get('o') as Orientation | null) ?? 'fill';
  // `bare=1`: the stage fills the window (as on a phone) with a minimal adult toolbar; used by E2E.
  const bare = params.get('bare') === '1';
  const entry = entries.find((e) => e.def.id === selectedId) ?? entries[0]!;

  const mode = useSession((s) => s.languageMode);
  const setLanguage = useSession((s) => s.setLanguage);
  const reducedMotion = useSession((s) => s.reducedMotion);
  const setReducedMotion = useSession((s) => s.setReducedMotion);
  const digits = useSession((s) => s.digitStyle);
  const [mic, setMic] = useState<Mic>((params.get('mic') as Mic | null) ?? 'voice');
  const [muted, setMuted] = useState(false);
  const [magnet, setMagnet] = useState(params.get('magnet') !== '0');
  const [run, setRun] = useState(0);
  const [snap, setSnap] = useState<ActivitySnapshot>();
  const [problems, setProblems] = useState<string[]>([]);
  const [, setMicState] = useState<MicState | 'listening_prompt_only'>();

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(k, v);
    router.replace(`/dev/playground/?${next.toString()}`);
  };

  // A fresh controller per activity or restart. Created in the effect so StrictMode's
  // mount/unmount/mount never reuses a disposed controller.
  const [{ controller, log }, setRunState] = useState<{ controller?: ActivityController; log: LogLine[] }>({ log: [] });
  useEffect(() => {
    const push = (text: string): void =>
      setRunState((st) => (st.controller === c ? { ...st, log: [{ at: Date.now(), text }, ...st.log].slice(0, 30) } : st));
    const c: ActivityController = new ActivityController({
      def: entry.def,
      logic: logicFor(entry.def),
      speech: speechPort(services),
      timers: { setTimeout: (fn, ms) => window.setTimeout(fn, ms), clearTimeout: (h) => window.clearTimeout(h as number) },
      seed: 1234 + run,
      onOutcome: (o) => push(`${o.kind}${o.inline ? ` (inline ${o.inline})` : ''} ${o.targetIds?.join('+') ?? o.targetId ?? ''} ${o.evidence.map((e) => `${e.kind}:${e.skillId}`).join(' ')}`),
      onEnd: (r) => push(`END ${r}`),
    });
    // Publishing the new controller is the point of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRunState({ controller: c, log: [] });
    const off = c.subscribe(setSnap);
    c.start();
    if (services.flags.testHooks) setActivityProbe(() => c.snapshot);
    return () => {
      off();
      c.dispose();
      setActivityProbe(undefined);
      services.audio.stopVoice();
    };
  }, [entry, services, run]);

  useEffect(() => services.audio.setMuted('all', muted), [services, muted]);

  // Layout assertions (04 §7): interactive objects ≥ 64 px and inside the play area.
  useEffect(() => {
    const id = window.setInterval(() => {
      const game = phaserHost.getGame();
      const vp = game?.registry.get(VIEWPORT_REGISTRY_KEY) as Viewport | undefined;
      const scene = game?.scene.getScene(ACTIVITY_SCENE) as unknown as { describeObjects?(): Array<{ id: string; rect: Viewport['safe']; state: string }> } | undefined;
      if (!vp || !scene?.describeObjects) return;
      const interactive = scene.describeObjects().filter((o) => !o.state.startsWith('placed') && !(o.state.startsWith('counted') && entry.def.mechanic === 'count_objects' && entry.def.ask === 'tap_n'));
      setProblems(layoutProblems(interactive, belowHud(vp)));
    }, 500);
    return () => window.clearInterval(id);
  }, [entry]);

  const sceneData: ActivitySceneData | undefined = useMemo(
    () =>
      controller && {
      ctx: {
        def: controller.definition,
        background: entry.background,
        controller,
        assets: services.content.assetTable(),
        reducedMotion,
        digits,
        magnet,
        vocabPicture: (v) => services.content.vocabulary(v)?.picture,
      },
    },
    [controller, entry, services, reducedMotion, digits, magnet],
  );

  const micServices: AppServices = useMemo(
    () => (mic === 'real' || mic === 'off' ? services : { ...services, createMic: () => new MicrophoneRecorder(fakeMicEnvironment(mic)) }),
    [services, mic],
  );
  const frame = orientation === 'fill' ? undefined : FRAME[orientation];
  const lang = primaryLang(mode);
  const stage = (
    <div
      className={bare ? 'fixed inset-0 overflow-hidden bg-sky-100' : 'relative overflow-hidden rounded-xl border-4 border-ink-700 bg-sky-100'}
      style={bare ? undefined : frame ? { width: frame.width, height: frame.height } : { width: '100%', height: 'calc(100dvh - 24px)' }}
      data-testid="play"
      data-activity={snap?.activityId}
      data-phase={snap?.phase}
      data-problems={problems.join(' | ')}
      dir={mode === 'en' ? 'ltr' : 'rtl'}
    >
      {sceneData && <GameHost scene={ACTIVITY_SCENE} data={sceneData} dataKey={`${snap?.activityId}:${run}:${magnet}:${digits}:${reducedMotion}`} />}
      {controller && snap?.mechanic === 'speak_repeat' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <SpeechPanel key={`${snap.activityId}:${run}:${mic}`} services={micServices} controller={controller} snap={snap} micEnabled={mic !== 'off'} lang={lang} onMicState={setMicState} />
        </div>
      )}
      {bare && (
        <div className="absolute bottom-2 start-2 z-40 flex gap-1 text-xs" dir="ltr">
          <Btn onClick={() => controller?.help()} testId="pg-help">Help</Btn>
          <Btn onClick={() => setRun((r) => r + 1)} testId="pg-restart">Restart</Btn>
        </div>
      )}
      <CaptionBubble services={services} position="top" />
    </div>
  );
  if (bare) return <main data-testid="playground">{stage}</main>;

  return (
    <main className="flex min-h-[100dvh] flex-col gap-3 bg-cloud-0 p-3 text-ink-700 lg:flex-row" dir="ltr" data-testid="playground">
      <aside className="flex flex-col gap-3 text-sm lg:w-80 lg:shrink-0">
        <h1 className="text-lg font-bold">Activity playground</h1>
        <label className="flex flex-col gap-1">
          Activity
          <select className="rounded border-2 border-ink-700 p-2" value={entry.def.id} onChange={(e) => setParam('a', e.target.value)} data-testid="pg-activity">
            {entries.map((e) => (
              <option key={e.def.id} value={e.def.id}>
                {e.def.id} · {e.def.mechanic} · {e.source}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Select label="Language" value={mode} options={['ar', 'en', 'mixed']} onChange={(v) => setLanguage(v as LanguageMode)} testId="pg-language" />
          <Select label="Orientation" value={orientation} options={['fill', 'portrait', 'landscape']} onChange={(v) => setParam('o', v)} testId="pg-orientation" />
          <Select label="Microphone" value={mic} options={['off', 'real', 'voice', 'silence', 'denied', 'unsupported']} onChange={(v) => setMic(v as Mic)} testId="pg-mic" />
          <Select label="Digits" value={digits} options={['eastern', 'western']} onChange={(v) => setLanguage(mode, v as 'eastern' | 'western')} testId="pg-digits" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Check label="Reduced motion" checked={reducedMotion} onChange={setReducedMotion} testId="pg-reduced" />
          <Check label="Sound" checked={!muted} onChange={(v) => setMuted(!v)} testId="pg-sound" />
          <Check label="Magnet" checked={magnet} onChange={setMagnet} testId="pg-magnet" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => setRun((r) => r + 1)} testId="pg-restart">Restart</Btn>
          <Btn onClick={() => controller?.replay()} testId="pg-ear">Ear</Btn>
          <Btn onClick={() => controller?.help()} testId="pg-help">Help</Btn>
          <Btn onClick={() => controller?.skip()} testId="pg-skip">Skip</Btn>
          <Btn onClick={() => (snap?.paused ? controller?.resume() : controller?.pause())} testId="pg-pause">{snap?.paused ? 'Resume' : 'Pause'}</Btn>
        </div>
        <section aria-label="Layout check" data-testid="pg-problems" data-count={problems.length} className={problems.length ? 'text-berry-500' : ''}>
          {problems.length ? problems.map((p) => <div key={p}>⚠ {p}</div>) : 'Layout: all targets ≥ 64 px and on screen'}
        </section>
        <details open className="rounded border-2 border-ink-700 p-2">
          <summary className="font-bold">State</summary>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs" data-testid="pg-state">
            {snap && JSON.stringify({ phase: snap.phase, paused: snap.paused, hintLevel: snap.hintLevel, notYet: snap.notYetCount, offerSkip: snap.offerSkip, hintTarget: snap.hintTarget, last: snap.last, m: snap.m }, null, 1)}
          </pre>
        </details>
        <details className="rounded border-2 border-ink-700 p-2">
          <summary className="font-bold">Outcomes</summary>
          <ol className="max-h-48 overflow-auto text-xs" data-testid="pg-log">
            {log.map((l) => (
              <li key={`${l.at}-${l.text}`}>{l.text}</li>
            ))}
          </ol>
        </details>
      </aside>

      <section className="relative flex flex-1 items-start justify-center">
        {stage}
      </section>
    </main>
  );
}

function Select({ label, value, options, onChange, testId }: { label: string; value: string; options: string[]; onChange(v: string): void; testId: string }) {
  return (
    <label className="flex flex-col gap-1">
      {label}
      <select className="rounded border-2 border-ink-700 p-2" value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function Check({ label, checked, onChange, testId }: { label: string; checked: boolean; onChange(v: boolean): void; testId: string }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
      {label}
    </label>
  );
}

function Btn({ onClick, children, testId }: { onClick(): void; children: string; testId: string }) {
  return (
    <button type="button" onClick={onClick} className="min-h-11 rounded border-2 border-ink-700 bg-sun-400 px-3 font-bold" data-testid={testId}>
      {children}
    </button>
  );
}
