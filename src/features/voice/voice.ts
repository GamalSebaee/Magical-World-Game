'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { LocalizedAudioRef } from '@content/schema';
import type { AudioPlaybackService, AudioStatus } from '@services/audio/AudioPlaybackService';
import type { AudioResolver, ResolvedLine } from '@services/audio/resolver';
import type { ContentRepository } from '@services/content/ContentRepository';
import { useSession } from '@features/settings/sessionStore';
import type { SpeechPort } from '@game/core/engine/ActivityController';
import type { SayItem } from '@game/core/engine/types';

export interface VoiceServices {
  audio: AudioPlaybackService;
  resolver: AudioResolver;
  content: ContentRepository;
}
const PRAISE = ['nono.praise.01', 'nono.praise.02', 'nono.praise.03', 'nono.praise.04'];

/** Resolves say-items into one voice line in the current language mode (read at call time). */
export function resolveSay(s: VoiceServices, items: SayItem[], random: () => number = Math.random): ResolvedLine {
  const mode = useSession.getState().languageMode;
  const refs: LocalizedAudioRef[] = items.flatMap((it) => {
    const ref =
      'ref' in it
        ? it.ref
        : 'vocab' in it
          ? s.content.vocabLine(it.vocab)
          : 'ui' in it
            ? s.content.uiLine(it.ui)
            : s.content.uiLine(PRAISE[Math.floor(random() * PRAISE.length)]!);
    return ref ? [ref] : [];
  });
  const lines = refs.map((r) => s.resolver.line(r, mode));
  return {
    clips: lines.flatMap((l) => l.clips),
    caption: lines.map((l) => l.caption).join(' … '),
    placeholder: lines.some((l) => l.placeholder),
    missing: lines.flatMap((l) => l.missing),
  };
}

export function say(s: VoiceServices, items: SayItem[]) {
  return s.audio.playVoice(resolveSay(s, items));
}

/** The controller's speech port: voice lines in the current language mode, SFX, stop. */
export function speechPort(s: VoiceServices): SpeechPort {
  return {
    say: (items) => say(s, items),
    sfx: (id) => s.audio.playSfx(s.resolver.sfx(id)),
    stop: () => s.audio.stopVoice(),
  };
}

export function useAudioStatus(audio: AudioPlaybackService | undefined): AudioStatus | undefined {
  const sub = useCallback((cb: () => void) => audio?.subscribe(cb) ?? (() => {}), [audio]);
  return useSyncExternalStore(sub, () => audio?.getStatus(), () => undefined);
}

/**
 * A screen's spoken cue (03 §0): plays once on entry when audio is unlocked, and returns a replay
 * function for the ear button. Stops when the screen unmounts.
 */
export function useScreenCue(s: VoiceServices | undefined, items: SayItem[] | undefined) {
  const key = JSON.stringify(items ?? null);
  const handle = useRef<{ stop(): void }>(undefined);
  const play = useCallback(() => {
    if (!s || !items?.length) return;
    handle.current?.stop();
    handle.current = say(s, items);
    // `key` captures items by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, key]);
  useEffect(() => {
    if (s?.audio.unlocked) play();
    return () => handle.current?.stop();
  }, [s, play]);
  return play;
}
