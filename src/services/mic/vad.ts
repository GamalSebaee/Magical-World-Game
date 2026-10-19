/**
 * On-device voice activity detection from RMS level frames (06 §7). No audio leaves memory;
 * this only answers "did we hear a voice, and for how long", never "was it correct".
 */
export const FRAME_MS = 50;
const MIN_THRESHOLD = 0.02;
/** The threshold never rises above this, so a noisy room can't hide a voice entirely. */
const MAX_THRESHOLD = 0.12;
const NOISE_FACTOR = 2.5;
/** Noise floor = this percentile of all frames. Children often speak the instant they tap, so the
 * opening frames cannot be assumed silent. */
const FLOOR_PERCENTILE = 0.1;

export interface VadResult {
  voicedMs: number;
  peak: number;
  noiseFloor: number;
  threshold: number;
}

export function analyzeLevels(levels: readonly number[], frameMs = FRAME_MS): VadResult {
  const sorted = [...levels].sort((a, b) => a - b);
  const noiseFloor = sorted.length ? sorted[Math.floor((sorted.length - 1) * FLOOR_PERCENTILE)]! : 0;
  const threshold = Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, noiseFloor * NOISE_FACTOR));
  let voiced = 0;
  let peak = 0;
  for (const l of levels) {
    if (l > threshold) voiced++;
    if (l > peak) peak = l;
  }
  return { voicedMs: voiced * frameMs, peak, noiseFloor, threshold };
}

/** Root-mean-square of a time-domain frame, 0..1. */
export function rms(frame: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i]! * frame[i]!;
  return frame.length ? Math.sqrt(sum / frame.length) : 0;
}
