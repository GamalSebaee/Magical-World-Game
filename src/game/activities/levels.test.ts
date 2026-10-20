import { describe, expect, it } from 'vitest';
import { rawContent } from '@content/bundle';
import { LevelDefinition, type ActivityDefinition } from '@content/schema';
import { ActivityController, type SpeechPort, type Timers } from '@game/core/engine/ActivityController';
import type { SayItem } from '@game/core/engine/types';
import { logicFor } from './registry';

const levels = Object.values(rawContent.levels).map((l) => LevelDefinition.parse(l));
const timers: Timers = { setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 1)), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };
const tick = () => new Promise((r) => setTimeout(r, 2));

/**
 * Plays an activity the way the hints point: always act on the hint target (tap it; for drags,
 * tap the item then its place). Proves every authored activity can be completed and that the
 * hint target never leads nowhere. Returns what was said and the evidence collected.
 */
async function solve(def: ActivityDefinition) {
  const said: SayItem[][] = [];
  const evidence: string[] = [];
  const speech: SpeechPort = { say: (items) => (said.push(items), { done: Promise.resolve('ended'), stop: () => {} }), sfx: () => {}, stop: () => {} };
  let ended: string | undefined;
  const c = new ActivityController({
    def, logic: logicFor(def), speech, timers, seed: 11, minFeedbackMs: 0, idleHintMs: 60_000,
    onOutcome: (o) => evidence.push(...o.evidence.map((e) => `${e.kind}:${e.skillId}`)),
    onEnd: (r) => (ended = r),
  });
  c.start();
  for (let step = 0; step < 60 && !ended; step++) {
    await tick();
    const s = c.snapshot;
    if (s.phase !== 'ready') continue;
    if (def.mechanic === 'speak_repeat') {
      const m = s.m as { attempts: number };
      if (m.attempts === 0) c.input({ type: 'speech', result: 'prompt_only', line: 'speech.together', evidence: { kind: 'speech_prompt_only' } });
      else c.input({ type: 'continue' });
      continue;
    }
    expect(s.hintTarget, `${def.id}: no hint target while ready`).toBeDefined();
    c.input({ type: 'tap', targetId: s.hintTarget! });
  }
  c.dispose();
  return { ended, said, evidence };
}

describe('every authored level can be played to the end by following the hints', () => {
  for (const lvl of levels) {
    it(`${lvl.id}: ${lvl.activities.map((a) => a.mechanic).join(', ')}`, async () => {
      for (const def of lvl.activities) {
        const r = await solve(def);
        expect(r.ended, def.id).toBe('completed');
        // Evidence only ever names skills the activity declares.
        for (const e of r.evidence) expect(def.skills, `${def.id} ${e}`).toContain(e.split(':')[1]);
        // Non-speaking activities produce evidence for at least one of their skills.
        if (def.mechanic !== 'speak_repeat') expect(r.evidence.length, `${def.id} evidence`).toBeGreaterThan(0);
      }
    });
  }

  it('there are 12 levels, 4 per world, and every mechanic is used in at least 3 levels', () => {
    expect(levels).toHaveLength(12);
    for (const w of ['animal-forest', 'color-town', 'number-island']) expect(levels.filter((l) => l.worldId === w)).toHaveLength(4);
    const uses = new Map<string, Set<string>>();
    for (const l of levels) for (const a of l.activities) uses.set(a.mechanic, (uses.get(a.mechanic) ?? new Set()).add(l.id));
    for (const [m, ls] of uses) expect(ls.size, m).toBeGreaterThanOrEqual(3);
  });
});
