'use client';

import { useEffect, useRef, useState } from 'react';
import type { ActivityDefinition } from '@content/schema';
import type { AppServices } from '@features/boot/appServices';
import type { ActivityController, ActivitySnapshot } from '@game/core/engine/ActivityController';
import type { SpeakRepeatState } from '@game/activities/speak-repeat/logic';
import type { MicrophoneRecorder } from '@services/mic/MicrophoneRecorder';
import { speechFeedback } from '@services/mic/speechFeedback';
import type { MicState } from '@shared/events';
import { t } from '@shared/i18n/uiStrings';
import { BigButton } from '@shared/ui/BigButton';
import { HeadphonesIcon, MicIcon, NextIcon, StopIcon } from '@shared/ui/icons';

type Def = Extract<ActivityDefinition, { mechanic: 'speak_repeat' }>;
const PROMPT_ONLY_LISTEN_MS = 3000;

/**
 * Speaking activity controls (03 C9). Real recording when the parent enabled the microphone and
 * the browser allows it; otherwise "say it with Nono", which never pretends to have listened.
 * The recorder is created for this activity and disposed with it (tracks stop, URLs revoked).
 */
export function SpeechPanel({
  services,
  controller,
  snap,
  micEnabled,
  lang,
  onMicState,
}: {
  services: AppServices;
  controller: ActivityController;
  snap: ActivitySnapshot;
  micEnabled: boolean;
  lang: 'ar' | 'en';
  onMicState?(s: MicState | 'listening_prompt_only'): void;
}) {
  const def = controller.definition as Def;
  const mic = useRef<MicrophoneRecorder | undefined>(undefined);
  const [micState, setMicState] = useState<MicState>();
  const [level, setLevel] = useState(0);
  const [lastUrl, setLastUrl] = useState<string>();
  const [promptOnlyBusy, setPromptOnlyBusy] = useState(false);
  const player = useRef<HTMLAudioElement | null>(null);
  const m = snap.m as SpeakRepeatState;
  const live = snap.phase === 'ready' || snap.phase === 'intro';

  useEffect(() => {
    if (!micEnabled) return;
    const rec = services.createMic();
    mic.current = rec;
    const offState = rec.onState((st) => {
      setMicState(st);
      services.events.emit({ type: 'mic.state', state: st, at: services.clock.now() });
    });
    const offLevel = rec.onLevel(setLevel);
    let wasRecording = false;
    const offErr = rec.onState((st) => {
      if (st === 'recording') wasRecording = true;
      if (st === 'recoverable_error' && wasRecording) {
        wasRecording = false;
        const fb = speechFeedback({ kind: 'unavailable' });
        controller.input({ type: 'speech', result: fb.result, line: fb.line, evidence: fb.evidence });
      }
    });
    const offDone = rec.onFinished((r) => {
      wasRecording = false;
      setLastUrl(r.url);
      const fb = speechFeedback({ kind: 'recording', recording: r });
      controller.input({ type: 'speech', result: fb.result, line: fb.line, evidence: fb.evidence });
    });
    void rec.probe().then(setMicState);
    return () => {
      offState();
      offLevel();
      offErr();
      offDone();
      rec.dispose();
      mic.current = undefined;
    };
  }, [services, micEnabled, controller]);

  // Pausing (or backgrounding) cancels a recording in progress.
  useEffect(() => {
    if (snap.paused) mic.current?.cancel();
  }, [snap.paused]);

  useEffect(() => {
    onMicState?.(promptOnlyBusy ? 'listening_prompt_only' : (micState ?? 'unsupported'));
  }, [micState, promptOnlyBusy, onMicState]);

  const usable = micEnabled && micState !== undefined && micState !== 'unsupported' && micState !== 'denied';
  const recording = micState === 'recording';

  const toggleRecord = async () => {
    const rec = mic.current;
    if (!rec) return;
    if (rec.state === 'recording') {
      services.audio.playSfx(services.resolver.sfx('sfx.record_stop'));
      // The result arrives through onFinished / the error state, same as an automatic stop.
      await rec.stop().catch(() => {});
      return;
    }
    if (!live) return;
    rec.reset();
    services.audio.stopVoice();
    const st = await rec.start({ maxMs: def.maxRecordMs });
    if (st === 'recording') services.audio.playSfx(services.resolver.sfx('sfx.record_start'));
  };

  const sayWithNono = () => {
    if (!live || promptOnlyBusy) return;
    setPromptOnlyBusy(true);
    services.audio.stopVoice();
    // Nono says the word again, then listens (visually) for a moment. Nothing is recorded.
    controller.replay();
    setTimeout(() => {
      setPromptOnlyBusy(false);
      const fb = speechFeedback({ kind: 'prompt_only' });
      controller.input({ type: 'speech', result: fb.result, line: fb.line, evidence: fb.evidence });
    }, PROMPT_ONLY_LISTEN_MS);
  };

  const hearMe = () => {
    if (!lastUrl) return;
    services.audio.stopVoice();
    player.current?.pause();
    player.current = new Audio(lastUrl);
    void player.current.play().catch(() => {});
  };
  useEffect(() => () => player.current?.pause(), []);

  const note = !micEnabled ? t('micOffNote', lang) : micState === 'denied' || micState === 'unsupported' ? t('micDeniedNote', lang) : undefined;

  return (
    <div
      className="pointer-events-auto flex flex-col items-center gap-3 rounded-[2rem] bg-cloud-0/90 p-4 shadow-lg"
      data-testid="speech-panel"
      data-mic-state={micState ?? 'off'}
    >
      {note && (
        <p className="max-w-xs text-center text-sm" data-testid="mic-note">
          {note}
        </p>
      )}
      <div className="flex items-center gap-4">
        <BigButton label={t('listenModel', lang)} size="target" onPress={() => controller.replay()} data-testid="speech-listen">
          <HeadphonesIcon />
        </BigButton>

        {usable ? (
          <div className="relative">
            {recording && <span className="animate-ring absolute inset-0 rounded-full border-8 border-berry-500" aria-hidden="true" />}
            <button
              type="button"
              aria-label={recording ? t('stop', lang) : t('record', lang)}
              aria-pressed={recording}
              data-testid="speech-record"
              onClick={() => void toggleRecord()}
              disabled={!recording && !live}
              className={`relative flex h-[112px] w-[112px] items-center justify-center rounded-full border-4 border-ink-700 shadow-[0_6px_0_var(--color-ink-700)] disabled:opacity-50 ${recording ? 'bg-sun-400' : 'bg-cloud-0'}`}
            >
              {recording ? <StopIcon /> : <MicIcon />}
            </button>
          </div>
        ) : (
          <BigButton label={t('sayTogether', lang)} size="hero" onPress={sayWithNono} disabled={!live || promptOnlyBusy} data-testid="speech-together">
            <span className="text-5xl" aria-hidden="true">🗣️</span>
          </BigButton>
        )}

        {lastUrl && !recording && (
          <BigButton label={t('hearMe', lang)} size="target" onPress={hearMe} data-testid="speech-hear-me">
            <span className="text-3xl" aria-hidden="true">👂</span>
          </BigButton>
        )}
        {m.attempts > 0 && !recording && (
          <BigButton label={t('next', lang)} size="target" onPress={() => controller.input({ type: 'continue' })} data-testid="speech-continue" disabled={!live}>
            <NextIcon />
          </BigButton>
        )}
      </div>
      {recording && (
        <div className="flex h-8 items-end gap-1" role="status" aria-label={t('recording', lang)} data-testid="recording-indicator">
          {[0.6, 1, 0.8, 1, 0.6].map((k, i) => (
            <span key={i} className="w-3 rounded-full bg-berry-500 transition-[height]" style={{ height: `${Math.max(12, Math.min(100, level * 600 * k))}%` }} />
          ))}
        </div>
      )}
    </div>
  );
}
