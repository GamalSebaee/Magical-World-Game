import type { ActivityDefinition } from '@content/schema';
import type { EvidenceItem, MechanicLogic, Outcome, SayItem } from '@game/core/engine/types';
import { seededRandom, shuffled } from '@shared/random';

type Def = Extract<ActivityDefinition, { mechanic: 'match_pairs' }>;
type Side = 'L' | 'R';

export interface MatchPairsState {
  /** Card order per side, fixed by the seed so a resume shows the same layout. */
  left: string[];
  right: string[];
  matched: string[];
  /** Selected card id (`<pairId>:L` / `<pairId>:R`). */
  selected?: string;
  /** Pairs that were part of a mismatch (for first-try evidence). */
  missed: string[];
}

export const cardId = (pairId: string, side: Side) => `${pairId}:${side}`;

export function parseCard(id: string): { pairId: string; side: Side } | undefined {
  const i = id.lastIndexOf(':');
  const side = id.slice(i + 1);
  if (i <= 0 || (side !== 'L' && side !== 'R')) return undefined;
  return { pairId: id.slice(0, i), side };
}

/** What a card says when tapped: its sound (SFX) and/or its word. */
function cardVoice(def: Def, id: string): { sfx?: string; say: SayItem[] } {
  const c = parseCard(id)!;
  const pair = def.pairs.find((p) => p.id === c.pairId)!;
  const side = c.side === 'L' ? pair.left : pair.right;
  return { sfx: side.audio, say: side.vocab ? [{ vocab: side.vocab }] : [] };
}

/** match_pairs (04 §4.4): tap a card, then its partner on the other side. Always visible. */
export const matchPairsLogic: MechanicLogic<Def, MatchPairsState> = {
  mechanic: 'match_pairs',

  init(def, seed) {
    const rand = seededRandom(seed);
    const ids = def.pairs.map((p) => p.id);
    const left = ids;
    // Never leave every partner directly opposite: that would make the task trivial.
    let right = shuffled(ids, rand);
    for (let i = 0; i < 4 && ids.length > 1 && right.every((id, k) => id === left[k]); i++) right = shuffled(ids, rand);
    if (ids.length > 1 && right.every((id, k) => id === left[k])) right = [...right.slice(1), right[0]!];
    return { left, right, matched: [], missed: [] };
  },

  apply(def, m, input) {
    if (input.type !== 'tap') return null;
    const card = parseCard(input.targetId);
    const pair = card && def.pairs.find((p) => p.id === card.pairId);
    if (!card || !pair || m.matched.includes(pair.id)) return null;

    const select = (selected: string | undefined, voice = true): { m: MatchPairsState; outcome: Outcome } => {
      const v = voice && selected ? cardVoice(def, selected) : { say: [] };
      return {
        m: { ...m, selected },
        outcome: { kind: 'partial', evidence: [], say: v.say, sfx: v.sfx ?? (voice ? 'sfx.tap' : undefined), targetId: input.targetId, anim: 'select', inline: 'interrupt' },
      };
    };

    if (!m.selected) return select(input.targetId);
    if (m.selected === input.targetId) return select(undefined, false);
    const first = parseCard(m.selected)!;
    if (first.side === card.side) return select(input.targetId);

    const skill = pair.skill && def.skills.includes(pair.skill) ? pair.skill : undefined;
    const ids = [m.selected, input.targetId];
    if (first.pairId === pair.id) {
      const matched = [...m.matched, pair.id];
      const done = matched.length === def.pairs.length;
      const evidence: EvidenceItem[] = skill ? [{ skillId: skill, kind: 'choice_correct', firstTry: !m.missed.includes(pair.id) }] : [];
      const v = cardVoice(def, input.targetId);
      return {
        m: { ...m, matched, selected: undefined },
        outcome: {
          kind: done ? 'correct' : 'partial',
          evidence,
          say: done ? [...v.say, { praise: true }] : v.say,
          sfx: 'sfx.sparkle',
          targetId: input.targetId,
          targetIds: ids,
          anim: 'connect',
        },
      };
    }

    // Not partners: both wiggle, the selection clears, and Nono names both (if they have words).
    const other = def.pairs.find((p) => p.id === first.pairId)!;
    const missed = [...new Set([...m.missed, pair.id, other.id])];
    const say = [...cardVoice(def, m.selected).say, ...cardVoice(def, input.targetId).say];
    const otherSkill = other.skill && def.skills.includes(other.skill) ? other.skill : undefined;
    return {
      m: { ...m, selected: undefined, missed },
      outcome: {
        kind: 'not_yet',
        evidence: otherSkill ? [{ skillId: otherSkill, kind: 'choice_not_yet' }] : [],
        say,
        sfx: 'sfx.boop',
        targetId: input.targetId,
        targetIds: ids,
        anim: 'wiggle',
      },
    };
  },

  isComplete: (def, m) => m.matched.length === def.pairs.length,
  prompt: (def) => def.instruction,
  hintTarget(def, m) {
    if (m.selected) {
      const s = parseCard(m.selected)!;
      return cardId(s.pairId, s.side === 'L' ? 'R' : 'L');
    }
    const next = m.left.find((id) => !m.matched.includes(id));
    return next ? cardId(next, 'L') : undefined;
  },
};
