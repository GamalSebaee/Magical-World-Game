import type { ActivityDefinition } from '@content/schema';
import type { MechanicLogic } from '@game/core/engine/types';

type Def = Extract<ActivityDefinition, { mechanic: 'tap_discover' }>;
export interface TapDiscoverState {
  found: string[];
}

/** tap_discover (04 §4.1): each item is revealed once; sequence mode accepts only the next item. */
export const tapDiscoverLogic: MechanicLogic<Def, TapDiscoverState> = {
  mechanic: 'tap_discover',

  init: () => ({ found: [] }),

  apply(def, m, input, ctx) {
    if (input.type !== 'tap') return null;
    const item = def.items.find((i) => i.id === input.targetId);
    if (!item || m.found.includes(item.id)) return null;

    if (def.mode === 'sequence') {
      const next = def.items.find((i) => !m.found.includes(i.id));
      if (next && next.id !== item.id) {
        return {
          m,
          // "Let's start with number 1": name the one that comes next.
          outcome: { kind: 'not_yet', evidence: [], say: [{ ui: 'nono.notyet.02' }, { vocab: next.vocab }], sfx: 'sfx.boop', targetId: item.id, anim: 'wiggle' },
        };
      }
    }

    const found = [...m.found, item.id];
    const skill = ctx.skillForVocab(item.vocab);
    const complete = found.length === def.items.length;
    return {
      m: { found },
      outcome: {
        kind: complete ? 'correct' : 'partial',
        evidence: skill ? [{ skillId: skill, kind: 'exposure' }] : [],
        say: complete ? [{ vocab: item.vocab }, { praise: true }] : [{ vocab: item.vocab }],
        sfx: 'sfx.pop',
        targetId: item.id,
        anim: 'reveal',
      },
    };
  },

  isComplete: (def, m) => m.found.length === def.items.length,
  prompt: (def) => def.instruction,
  hintTarget: (def, m) => def.items.find((i) => !m.found.includes(i.id))?.id,
};
