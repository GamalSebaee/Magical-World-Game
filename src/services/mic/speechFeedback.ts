import type { SpeechAttemptResult } from '@shared/events';
import type { Recording } from './MicrophoneRecorder';

/** Below this, a recording is too short to have contained a word (06 §5). */
export const MIN_RECORDING_MS = 400;
/** Voice must be detected for at least this long to count as "voice heard" (06 §7). */
export const MIN_VOICED_MS = 300;

export interface SpeechFeedback {
  result: SpeechAttemptResult;
  /** Shared UI line to speak (src/content/ui-audio.json). */
  line: 'speech.heard' | 'speech.silent' | 'speech.hold_longer' | 'speech.together' | 'speech.retry';
  /** Evidence to record. `none` writes nothing. Never claims correctness. */
  evidence: { kind: 'speech_attempt'; voiced: boolean; recognizerAgreed?: boolean } | { kind: 'speech_prompt_only' } | { kind: 'none' };
  /** Whether "hear me" playback is offered. */
  canPlayBack: boolean;
}

/**
 * Honest, encouraging feedback for a speaking try (06 §7). There is no "correct" outcome:
 * recognition, when it exists, only changes which encouraging line plays.
 */
export function speechFeedback(input:
  | { kind: 'recording'; recording: Pick<Recording, 'durationMs' | 'voicedMs'>; recognizerAgreed?: boolean }
  | { kind: 'prompt_only' }
  | { kind: 'unavailable' },
): SpeechFeedback {
  if (input.kind === 'prompt_only') {
    return { result: 'prompt_only', line: 'speech.together', evidence: { kind: 'speech_prompt_only' }, canPlayBack: false };
  }
  if (input.kind === 'unavailable') {
    return { result: 'unavailable', line: 'speech.retry', evidence: { kind: 'none' }, canPlayBack: false };
  }
  const { recording, recognizerAgreed } = input;
  if (recording.durationMs < MIN_RECORDING_MS) {
    return { result: 'recorded_silence', line: 'speech.hold_longer', evidence: { kind: 'speech_attempt', voiced: false }, canPlayBack: false };
  }
  const voiced = recording.voicedMs >= MIN_VOICED_MS;
  if (!voiced) {
    return { result: 'recorded_silence', line: 'speech.silent', evidence: { kind: 'speech_attempt', voiced: false }, canPlayBack: true };
  }
  if (recognizerAgreed === undefined) {
    return { result: 'recorded_voice_detected', line: 'speech.heard', evidence: { kind: 'speech_attempt', voiced: true }, canPlayBack: true };
  }
  return {
    result: recognizerAgreed ? 'recognized_match' : 'recognized_no_match',
    // Identical child-facing feedback either way (06 §7).
    line: 'speech.heard',
    evidence: { kind: 'speech_attempt', voiced: true, recognizerAgreed },
    canPlayBack: true,
  };
}
