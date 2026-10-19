import type { ActivityDefinition } from '@content/schema';
import type { MechanicLogic } from '@game/core/engine/types';
import { seededRandom, shuffled } from '@shared/random';

type Def = Extract<ActivityDefinition, { mechanic: 'listen_choose' }>;
export interface ListenChooseState {
  round: number;
  /** Choice order per round, fixed by the seed so a resume shows the same layout. */
  order: string[][];
  wrongThisRound: boolean;
}

/** listen_choose (04 §4.2): spoken prompt, picture choices, gentle redirection on a wrong pick. */
export const listenChooseLogic: MechanicLogic<Def, ListenChooseState> = {
  mechanic: 'listen_choose',

  init(def, seed) {
    const rand = seededRandom(seed);
    return {
      round: 0,
      order: def.rounds.map((r) => (def.shuffle ? shuffled(r.choices, rand) : r.choices).map((c) => c.id)),
      wrongThisRound: false,
    };
  },

  apply(def, m, input, ctx) {
    if (input.type !== 'tap') return null;
    const round = def.rounds[m.round];
    if (!round) return null;
    const choice = round.choices.find((c) => c.id === input.targetId);
    if (!choice) return null;
    const answer = round.choices.find((c) => c.id === round.answer)!;
    const skill = ctx.skillForVocab(answer.vocab);

    if (choice.id === round.answer) {
      const next = m.round + 1;
      const done = next >= def.rounds.length;
      return {
        m: { ...m, round: next, wrongThisRound: false },
        outcome: {
          kind: done ? 'correct' : 'partial',
          evidence: skill ? [{ skillId: skill, kind: 'choice_correct', firstTry: !m.wrongThisRound }] : [],
          say: [{ vocab: answer.vocab }, { praise: true }],
          sfx: 'sfx.sparkle',
          targetId: choice.id,
          anim: 'celebrate',
          thenPrompt: !done,
        },
      };
    }

    // Wrong pick: the picture says its own name, then the question repeats (never "wrong").
    return {
      m: { ...m, wrongThisRound: true },
      outcome: {
        kind: 'not_yet',
        evidence: skill ? [{ skillId: skill, kind: 'choice_not_yet' }] : [],
        say: [{ vocab: choice.vocab }],
        sfx: 'sfx.boop',
        targetId: choice.id,
        anim: 'wiggle',
        thenPrompt: true,
      },
    };
  },

  isComplete: (def, m) => m.round >= def.rounds.length,
  prompt: (def, m) => def.rounds[m.round]?.prompt,
  hintTarget: (def, m) => def.rounds[m.round]?.answer,
};
