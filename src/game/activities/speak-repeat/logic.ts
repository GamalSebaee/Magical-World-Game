import type { ActivityDefinition } from '@content/schema';
import type { MechanicLogic } from '@game/core/engine/types';
import type { SpeechAttemptResult } from '@shared/events';

type Def = Extract<ActivityDefinition, { mechanic: 'speak_repeat' }>;
export interface SpeakRepeatState {
  attempts: number;
  results: SpeechAttemptResult[];
  continued: boolean;
}

/**
 * speak_repeat (04 §4.6): real practice, never scored. Any attempt (including "say it with Nono"
 * when there is no microphone) lets the child continue; after `attemptsBeforeAutoContinue`
 * tries the activity continues on its own.
 */
export const speakRepeatLogic: MechanicLogic<Def, SpeakRepeatState> = {
  mechanic: 'speak_repeat',

  init: () => ({ attempts: 0, results: [], continued: false }),

  apply(def, m, input) {
    if (input.type === 'continue') {
      if (m.attempts === 0 || m.continued) return null;
      return { m: { ...m, continued: true }, outcome: { kind: 'correct', evidence: [], say: [{ praise: true }], sfx: 'sfx.sparkle', anim: 'celebrate' } };
    }
    if (input.type !== 'speech') return null;

    // A failed recorder attempt is not a try: offer again, record nothing.
    if (input.evidence.kind === 'none') {
      return { m, outcome: { kind: 'speech', evidence: [], say: [{ ui: input.line }] } };
    }
    const attempts = m.attempts + 1;
    const auto = attempts >= def.attemptsBeforeAutoContinue;
    const evidence = def.skills.map((skillId) =>
      input.evidence.kind === 'speech_attempt'
        ? { skillId, kind: 'speech_attempt' as const, voiced: input.evidence.voiced }
        : { skillId, kind: 'speech_prompt_only' as const },
    );
    return {
      m: { attempts, results: [...m.results, input.result], continued: auto },
      outcome: {
        kind: 'speech',
        evidence,
        say: auto ? [{ ui: input.line }, { praise: true }] : [{ ui: input.line }],
        sfx: auto ? 'sfx.sparkle' : undefined,
        anim: auto ? 'celebrate' : undefined,
      },
    };
  },

  isComplete: (_def, m) => m.continued,
  prompt: (def) => def.model,
  hintTarget: () => 'mic',
};
