import type { ActivityDefinition } from '@content/schema';
import type { EvidenceItem, MechanicLogic, Outcome, SayItem } from '@game/core/engine/types';

type Def = Extract<ActivityDefinition, { mechanic: 'count_objects' }>;

export interface CountObjectsState {
  /** Object ids in the order they were counted; an object's number is its position + 1. */
  counted: string[];
  /** how_many: after every object is counted, the child picks the numeral. */
  stage: 'counting' | 'choosing' | 'answered';
}

export const choiceId = (n: number) => `n:${n}`;
const parseChoice = (id: string) => (id.startsWith('n:') ? Number(id.slice(2)) : undefined);
const numberWord = (n: number): SayItem => ({ vocab: `numbers.${n}` });
const question = (def: Def): SayItem => (def.question ? { ref: def.question } : { ui: 'play.count.how_many' });

/** Counting skills the activity declares (math.*): what a correct count is evidence for. */
function countEvidence(def: Def, kind: 'choice_correct' | 'choice_not_yet', firstTry?: boolean): EvidenceItem[] {
  return def.skills.filter((s) => s.startsWith('math.')).map((skillId) => (kind === 'choice_correct' ? { skillId, kind, firstTry } : { skillId, kind }));
}

/**
 * count_objects (04 §4.5). Count integrity: each object counts once; tapping a counted object
 * re-says its number; the spoken number comes from the count after insertion and counting lines
 * are queued (inline) so fast taps still say 1-2-3 in order.
 */
export const countObjectsLogic: MechanicLogic<Def, CountObjectsState> = {
  mechanic: 'count_objects',

  init: () => ({ counted: [], stage: 'counting' }),

  apply(def, m, input) {
    if (input.type !== 'tap') return null;
    const goal = def.ask === 'how_many' ? def.objects.length : def.target;

    const chosen = parseChoice(input.targetId);
    if (chosen !== undefined) {
      if (def.ask !== 'how_many' || m.stage !== 'choosing' || !def.answerChoices?.includes(chosen)) return null;
      if (chosen === def.target) {
        return {
          m: { ...m, stage: 'answered' },
          outcome: {
            kind: 'correct',
            evidence: countEvidence(def, 'choice_correct', true),
            say: [numberWord(chosen), { praise: true }],
            sfx: 'sfx.sparkle',
            targetId: input.targetId,
            anim: 'celebrate',
          },
        };
      }
      // Not yet: recount together with highlights, then ask again (04 §4.5 acceptance 3).
      return {
        m,
        outcome: {
          kind: 'not_yet',
          evidence: countEvidence(def, 'choice_not_yet'),
          say: [...m.counted.map((_, i) => numberWord(i + 1)), question(def)],
          sfx: 'sfx.boop',
          targetId: input.targetId,
          targetIds: m.counted,
          anim: 'recount',
        },
      };
    }

    if (!def.objects.some((o) => o.id === input.targetId)) return null;
    const at = m.counted.indexOf(input.targetId);
    if (at >= 0) {
      // Already counted: say its number again, count unchanged.
      return { m, outcome: { kind: 'partial', evidence: [], say: [numberWord(at + 1)], targetId: input.targetId, anim: 'count', inline: 'queue' } };
    }
    if (m.counted.length >= goal) {
      return {
        m,
        outcome: { kind: 'partial', evidence: [], say: [{ ui: 'play.count.thats' }, numberWord(goal)], sfx: 'sfx.boop', targetId: input.targetId, anim: 'bounce', inline: 'queue' },
      };
    }

    const counted = [...m.counted, input.targetId];
    const n = counted.length;
    const base: Outcome = { kind: 'partial', evidence: [], say: [numberWord(n)], sfx: 'sfx.pop', targetId: input.targetId, anim: 'count' };
    if (n < goal) return { m: { ...m, counted }, outcome: { ...base, inline: 'queue' } };
    if (def.ask === 'how_many') {
      return { m: { counted, stage: 'choosing' }, outcome: { ...base, say: [numberWord(n), question(def)] } };
    }
    return {
      m: { ...m, counted },
      outcome: { ...base, kind: 'correct', evidence: countEvidence(def, 'choice_correct', true), say: [numberWord(n), { praise: true }], sfx: 'sfx.sparkle' },
    };
  },

  isComplete: (def, m) => (def.ask === 'tap_n' ? m.counted.length >= def.target : m.stage === 'answered'),
  prompt: (def, m) => (m.stage !== 'counting' && def.question ? def.question : def.instruction),
  hintTarget: (def, m) => (m.stage !== 'counting' ? choiceId(def.target) : def.objects.find((o) => !m.counted.includes(o.id))?.id),
};
