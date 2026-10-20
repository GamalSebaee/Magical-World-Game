import type { HintLevel } from './types';

/**
 * Shared hint policy (04 §3.2, §3.3). Pure: the controller owns the counters and timers, this
 * module decides what they mean. Every mechanic gets the same rules.
 */
export const HINT_POLICY = {
  /** Automatic (idle) hints per activity. */
  maxAutoHints: 2,
  /** Consecutive not-yets that raise the hint level by one. */
  notYetBeforeHint: 2,
  /** Not-yets in one activity before the skip arrow is offered (the child can keep trying). */
  notYetBeforeSkipOffer: 4,
  /** From this level the hand demonstrates on the real target. */
  demoLevel: 3,
} as const;

export type AgeBand = 3 | 4 | 5 | 6;
export type HintTiming = 'age' | 'slower' | 'faster';

/** Idle time before an automatic hint, by age and the parent's timing preference. */
export function idleHintMs(age: AgeBand, timing: HintTiming = 'age'): number {
  const base = age <= 3 ? 15_000 : age >= 6 ? 10_000 : 12_000;
  return timing === 'slower' ? base * 1.5 : timing === 'faster' ? base * 0.7 : base;
}

/** Help tapped: one level up, capped. */
export function raiseHint(level: HintLevel): HintLevel {
  return Math.min(3, level + 1) as HintLevel;
}

/** After a not-yet: the next hint level and the consecutive counter to carry forward. */
export function afterNotYet(level: HintLevel, consecutive: number): { level: HintLevel; consecutive: number } {
  const n = consecutive + 1;
  if (n >= HINT_POLICY.notYetBeforeHint && level < 3) return { level: raiseHint(level), consecutive: 0 };
  return { level, consecutive: n };
}

/** An idle hint plays at the current level, but never below 1. */
export function idleHintLevel(level: HintLevel): HintLevel {
  return level === 0 ? 1 : level;
}

export const offersSkip = (notYetCount: number) => notYetCount >= HINT_POLICY.notYetBeforeSkipOffer;
export const demonstrates = (level: HintLevel) => level >= HINT_POLICY.demoLevel;

/** Magnet assist for drags is for younger children (04 §4.3: off at age 6). */
export const magnetAllowed = (age: AgeBand) => age < 6;
