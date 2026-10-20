import type { ActivityDefinition, LocalizedAudioRef } from '@content/schema';
import type { SpeechAttemptResult } from '@shared/events';

/**
 * Activity lifecycle phases (04 §3). `interacting` and `validating` from the plan are transient
 * and synchronous here: a meaningful input in `ready` is evaluated immediately and moves to
 * `feedback`. Pause is a separate flag (the plan's parallel region).
 */
export type Phase = 'loading' | 'intro' | 'ready' | 'feedback' | 'completed' | 'skipped' | 'error';
export type HintLevel = 0 | 1 | 2 | 3;

/** Something to say, resolved by the controller's speech port in the current language mode. */
export type SayItem =
  | { ref: LocalizedAudioRef }
  | { vocab: string }
  | { ui: string }
  | { praise: true };

export type EvidenceKind =
  | 'exposure'
  | 'choice_correct'
  | 'choice_not_yet'
  | 'speech_attempt'
  | 'speech_prompt_only'
  | 'skipped';

export interface EvidenceItem {
  skillId: string;
  kind: EvidenceKind;
  firstTry?: boolean;
  voiced?: boolean;
}

export interface Outcome {
  kind: 'correct' | 'partial' | 'not_yet' | 'speech';
  evidence: EvidenceItem[];
  say: SayItem[];
  sfx?: string;
  /** Scene animation hint: which object(s), and how. */
  targetId?: string;
  targetIds?: string[];
  anim?: 'reveal' | 'celebrate' | 'wiggle' | 'select' | 'place' | 'count' | 'recount' | 'connect' | 'bounce';
  /** After feedback, replay the current prompt (e.g. next listen_choose round). */
  thenPrompt?: boolean;
  /**
   * Inline outcomes skip the feedback phase so the child can keep going (selecting a card,
   * counting taps). `queue` lines wait their turn (counting 1-2-3 in order); `interrupt` lines
   * cut the current line. Not-yet counters are untouched.
   */
  inline?: 'queue' | 'interrupt';
}

export type ActivityInput =
  | { type: 'tap'; targetId: string }
  | { type: 'speech'; result: SpeechAttemptResult; line: string; evidence: { kind: 'speech_attempt'; voiced: boolean } | { kind: 'speech_prompt_only' } | { kind: 'none' } }
  | { type: 'continue' }
  /** drag_drop: a draggable released over a target (already resolved with forgiveness), or nowhere. */
  | { type: 'drop'; itemId: string; targetId: string | null };

export interface LogicContext {
  hintLevel: HintLevel;
  /** Maps a vocabulary id to the skill it evidences, if the activity declares it. */
  skillForVocab(vocabId: string): string | undefined;
}

/**
 * A mechanic's pure rules (04 §4). No timers, audio, Phaser or React: given state and input it
 * returns the next state and what happened. Deterministic and unit-testable.
 */
export interface MechanicLogic<D extends ActivityDefinition = ActivityDefinition, M = unknown> {
  readonly mechanic: D['mechanic'];
  init(def: D, seed: number): M;
  /** Returns null when the input is not meaningful (already handled, wrong kind) and is ignored. */
  apply(def: D, m: M, input: ActivityInput, ctx: LogicContext): { m: M; outcome: Outcome } | null;
  isComplete(def: D, m: M): boolean;
  /** What the ear button replays and what plays after the instruction. */
  prompt(def: D, m: M): LocalizedAudioRef | undefined;
  /** Object the help hand / glow points at (hint levels 2–3). */
  hintTarget(def: D, m: M): string | undefined;
}
