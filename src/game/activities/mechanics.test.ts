import { describe, expect, it } from 'vitest';
import type { ActivityDefinition } from '@content/schema';
import { playgroundEntries } from '@features/playground/fixtures';
import { ActivityController, type SpeechPort, type Timers } from '@game/core/engine/ActivityController';
import { afterNotYet, idleHintMs, offersSkip, raiseHint } from '@game/core/engine/hintPolicy';
import type { ActivityInput, LogicContext, SayItem } from '@game/core/engine/types';
import { countObjectsLogic, type CountObjectsState } from './count-objects/logic';
import { dragDropLogic, dropZone, resolveDrop, type DragDropState } from './drag-drop/logic';
import { cardId, matchPairsLogic, type MatchPairsState } from './match-pairs/logic';
import { logicFor } from './registry';

type Of<K extends ActivityDefinition['mechanic']> = Extract<ActivityDefinition, { mechanic: K }>;
const fixture = <K extends ActivityDefinition['mechanic']>(id: string) => playgroundEntries().find((e) => e.def.id === id)!.def as Of<K>;
const ctx: LogicContext = { hintLevel: 0, skillForVocab: () => undefined };

const colors = fixture<'drag_drop'>('pg01.a1');
const carrots = fixture<'drag_drop'>('pg02.a1');
const sounds = fixture<'match_pairs'>('pg03.a1');
const colorPairs = fixture<'match_pairs'>('pg04.a1');
const apples = fixture<'count_objects'>('pg05.a1');
const tapN = fixture<'count_objects'>('pg06.a1');

/** Applies inputs in order, skipping ignored ones; returns the final state and every outcome. */
function play<D extends ActivityDefinition, M>(logic: { init(d: D, s: number): M; apply(d: D, m: M, i: ActivityInput, c: LogicContext): { m: M; outcome: import('@game/core/engine/types').Outcome } | null }, def: D, inputs: ActivityInput[], seed = 1) {
  let m = logic.init(def, seed);
  const outcomes = [];
  for (const i of inputs) {
    const r = logic.apply(def, m, i, ctx);
    outcomes.push(r?.outcome ?? null);
    if (r) m = r.m;
  }
  return { m, outcomes };
}
const tap = (targetId: string): ActivityInput => ({ type: 'tap', targetId });
const drop = (itemId: string, targetId: string | null): ActivityInput => ({ type: 'drop', itemId, targetId });

describe('playground fixtures', () => {
  it('parse and cover every mechanic', () => {
    const mechanics = new Set(playgroundEntries().map((e) => e.def.mechanic));
    expect([...mechanics].sort()).toEqual(['count_objects', 'drag_drop', 'listen_choose', 'match_pairs', 'speak_repeat', 'tap_discover']);
    for (const e of playgroundEntries()) expect(logicFor(e.def)).toBeDefined();
  });
});

describe('drag_drop logic (04 §4.3)', () => {
  it('accepts by tag, snaps a wrong target back with the item’s word (acceptance 3)', () => {
    const { m, outcomes } = play(dragDropLogic, colors, [drop('ball-red', 'box-blue')]);
    expect(outcomes[0]).toMatchObject({ kind: 'not_yet', anim: 'bounce', say: [{ vocab: 'colors.red' }] });
    expect((m as DragDropState).placed).toEqual([]);
  });

  it('a drop on nowhere slides home without counting as a try', () => {
    const { outcomes } = play(dragDropLogic, colors, [drop('ball-red', null)]);
    expect(outcomes[0]).toMatchObject({ kind: 'partial', inline: 'interrupt', anim: 'bounce' });
  });

  it('completes when all are placed; a placed item cannot be placed again', () => {
    const { m, outcomes } = play(dragDropLogic, colors, [
      drop('ball-red', 'box-red'),
      drop('ball-red', 'box-red'),
      drop('ball-blue', 'box-blue'),
      drop('ball-yellow', 'box-yellow'),
    ]);
    expect(outcomes[1]).toBeNull();
    expect(outcomes[3]).toMatchObject({ kind: 'correct', anim: 'place' });
    expect(dragDropLogic.isComplete(colors, m)).toBe(true);
  });

  it('count_placed speaks the running count, queued, and completes at n', () => {
    const { m, outcomes } = play(dragDropLogic, carrots, [drop('carrot-1', 'basket'), drop('carrot-2', 'basket')]);
    expect(outcomes[0]).toMatchObject({ kind: 'partial', inline: 'queue', say: [{ vocab: 'numbers.1' }] });
    expect(outcomes[1]).toMatchObject({ kind: 'correct', say: [{ vocab: 'numbers.2' }, { praise: true }] });
    expect(dragDropLogic.isComplete(carrots, m)).toBe(true);
    // A drop after the target bounces kindly and the count stays (AF-02 QA 2).
    const extra = dragDropLogic.apply(carrots, m, drop('carrot-3', 'basket'), ctx)!;
    expect(extra.outcome).toMatchObject({ anim: 'bounce', say: [{ ui: 'play.count.thats' }, { vocab: 'numbers.2' }] });
    expect(extra.m.placed).toHaveLength(2);
  });

  it('tap-then-tap places an item (alternative input)', () => {
    const { m, outcomes } = play(dragDropLogic, colors, [tap('ball-blue'), tap('box-blue')]);
    expect(outcomes[0]).toMatchObject({ anim: 'select', inline: 'interrupt', say: [{ vocab: 'colors.blue' }] });
    expect(m.placed).toEqual([['ball-blue', 'box-blue']]);
    expect(dragDropLogic.hintTarget(colors, { placed: [], selected: 'ball-red' })).toBe('box-red');
  });

  describe('drop forgiveness', () => {
    const basket = { id: 'basket', rect: { x: 400, y: 300, width: 200, height: 150 }, accepting: true };
    const home = { x: 100, y: 100 };

    it('a release 30 px outside the target is accepted (acceptance 1)', () => {
      const release = { x: 400 - 30, y: 375 };
      expect(resolveDrop({ release, itemStart: home, itemNow: release, targets: [basket], magnet: false })).toBe('basket');
    });

    it('the zone is the target grown by 40%, never under 120 px', () => {
      expect(dropZone({ x: 0, y: 0, width: 100, height: 50 })).toEqual({ x: -20, y: -35, width: 140, height: 120 });
    });

    it('magnet: ≥ 60% of the way to an accepting target, and nearest, is accepted; off means off', () => {
      const centre = { x: 500, y: 375 };
      const at = (f: number) => ({ x: home.x + (centre.x - home.x) * f, y: home.y + (centre.y - home.y) * f });
      expect(resolveDrop({ release: at(0.6), itemStart: home, itemNow: at(0.6), targets: [basket], magnet: true })).toBe('basket');
      expect(resolveDrop({ release: at(0.4), itemStart: home, itemNow: at(0.4), targets: [basket], magnet: true })).toBeNull();
      expect(resolveDrop({ release: at(0.6), itemStart: home, itemNow: at(0.6), targets: [basket], magnet: false })).toBeNull();
      const wrong = { ...basket, accepting: false };
      expect(resolveDrop({ release: at(0.6), itemStart: home, itemNow: at(0.6), targets: [wrong], magnet: true })).toBeNull();
    });
  });
});

describe('match_pairs logic (04 §4.4)', () => {
  it('cat selected then its sound card locks the pair (acceptance 1)', () => {
    const { m, outcomes } = play(matchPairsLogic, sounds, [tap(cardId('cat', 'L')), tap(cardId('cat', 'R'))]);
    expect(outcomes[0]).toMatchObject({ anim: 'select', inline: 'interrupt', say: [{ vocab: 'animals.cat' }] });
    expect(outcomes[1]).toMatchObject({ kind: 'partial', anim: 'connect', sfx: 'sfx.sparkle' });
    expect((m as MatchPairsState).matched).toEqual(['cat']);
  });

  it('tapping a locked pair changes nothing (acceptance 2)', () => {
    const { m } = play(matchPairsLogic, sounds, [tap('cat:L'), tap('cat:R')]);
    expect(matchPairsLogic.apply(sounds, m, tap('cat:L'), ctx)).toBeNull();
    expect(matchPairsLogic.apply(sounds, m, tap('cat:R'), ctx)).toBeNull();
  });

  it('a second card on the same side moves the selection without an error (acceptance 3)', () => {
    const { m, outcomes } = play(matchPairsLogic, sounds, [tap('cat:L'), tap('dog:L')]);
    expect(outcomes[1]).toMatchObject({ kind: 'partial', inline: 'interrupt' });
    expect(m.selected).toBe('dog:L');
  });

  it('a sound card plays its sound; tapping the selected card again deselects silently', () => {
    const { m, outcomes } = play(matchPairsLogic, sounds, [tap('dog:R'), tap('dog:R')]);
    expect(outcomes[0]).toMatchObject({ sfx: 'sfx.animal_dog' });
    expect(outcomes[1]).toMatchObject({ say: [], sfx: undefined });
    expect(m.selected).toBeUndefined();
  });

  it('wrong partners wiggle, clear the selection, name both, and the pair loses first-try', () => {
    const { m, outcomes } = play(matchPairsLogic, colorPairs, [tap('red:L'), tap('blue:R'), tap('red:L'), tap('red:R')]);
    expect(outcomes[1]).toMatchObject({ kind: 'not_yet', anim: 'wiggle', targetIds: ['red:L', 'blue:R'], say: [{ vocab: 'colors.red' }, { vocab: 'colors.blue' }] });
    expect(outcomes[3]!.evidence).toEqual([{ skillId: 'color.identify.red', kind: 'choice_correct', firstTry: false }]);
    expect(m.matched).toEqual(['red']);
  });

  it('the right column is shuffled by the seed, never all opposite, and stable for resume', () => {
    for (let seed = 0; seed < 30; seed++) {
      const a = matchPairsLogic.init(colorPairs, seed);
      expect(a.right.every((id, i) => id === a.left[i])).toBe(false);
      expect(matchPairsLogic.init(colorPairs, seed)).toEqual(a);
    }
  });

  it('completes when every pair is matched', () => {
    const { m, outcomes } = play(matchPairsLogic, sounds, [tap('cat:L'), tap('cat:R'), tap('dog:R'), tap('dog:L')]);
    expect(outcomes[3]).toMatchObject({ kind: 'correct' });
    expect(matchPairsLogic.isComplete(sounds, m)).toBe(true);
  });
});

describe('count_objects logic (04 §4.5)', () => {
  it('one apple tapped 4 times counts 1 and says "1" each time (acceptance 1)', () => {
    const { m, outcomes } = play(countObjectsLogic, apples, [tap('apple-1'), tap('apple-1'), tap('apple-1'), tap('apple-1')]);
    expect((m as CountObjectsState).counted).toEqual(['apple-1']);
    for (const o of outcomes) expect(o).toMatchObject({ inline: 'queue', say: [{ vocab: 'numbers.1' }] });
  });

  it('counting the last object asks "how many?" with the numeral cards', () => {
    const { m, outcomes } = play(countObjectsLogic, apples, [tap('apple-2'), tap('apple-3'), tap('apple-1')]);
    expect(outcomes.map((o) => o!.say[0])).toEqual([{ vocab: 'numbers.1' }, { vocab: 'numbers.2' }, { vocab: 'numbers.3' }]);
    expect(outcomes[2]).toMatchObject({ kind: 'partial', say: [{ vocab: 'numbers.3' }, { ref: apples.question }] });
    expect(outcomes[2]!.inline).toBeUndefined();
    expect(m.stage).toBe('choosing');
    expect(countObjectsLogic.hintTarget(apples, m)).toBe('n:3');
  });

  it('picking 2 for 3 apples recounts with highlights, then the child chooses again (acceptance 3)', () => {
    const { m, outcomes } = play(countObjectsLogic, apples, [tap('apple-1'), tap('apple-2'), tap('apple-3'), tap('n:2'), tap('n:3')]);
    expect(outcomes[3]).toMatchObject({
      kind: 'not_yet',
      anim: 'recount',
      targetIds: ['apple-1', 'apple-2', 'apple-3'],
      say: [{ vocab: 'numbers.1' }, { vocab: 'numbers.2' }, { vocab: 'numbers.3' }, { ref: apples.question }],
    });
    expect(outcomes[4]).toMatchObject({ kind: 'correct', evidence: [{ skillId: 'math.count.upto3', kind: 'choice_correct', firstTry: true }] });
    expect(countObjectsLogic.isComplete(apples, m)).toBe(true);
  });

  it('numeral cards do nothing before counting is finished', () => {
    const { outcomes } = play(countObjectsLogic, apples, [tap('n:3')]);
    expect(outcomes[0]).toBeNull();
  });

  it('tap_n completes exactly at the target; extra taps would bounce', () => {
    const { m, outcomes } = play(countObjectsLogic, tapN, [tap('carrot-1'), tap('carrot-4'), tap('carrot-2')]);
    expect(outcomes[2]).toMatchObject({ kind: 'correct', say: [{ vocab: 'numbers.3' }, { praise: true }] });
    expect(countObjectsLogic.isComplete(tapN, m)).toBe(true);
    const extra = countObjectsLogic.apply(tapN, m, tap('carrot-5'), ctx)!;
    expect(extra.m.counted).toHaveLength(3);
    expect(extra.outcome).toMatchObject({ anim: 'bounce', say: [{ ui: 'play.count.thats' }, { vocab: 'numbers.3' }] });
  });
});

describe('hint policy (04 §3.2)', () => {
  it('raises a level after 2 consecutive not-yets, offers skip after 4, idle time by age', () => {
    expect(afterNotYet(0, 0)).toEqual({ level: 0, consecutive: 1 });
    expect(afterNotYet(0, 1)).toEqual({ level: 1, consecutive: 0 });
    expect(afterNotYet(3, 5)).toEqual({ level: 3, consecutive: 6 });
    expect(raiseHint(3)).toBe(3);
    expect(offersSkip(3)).toBe(false);
    expect(offersSkip(4)).toBe(true);
    expect([idleHintMs(3), idleHintMs(4), idleHintMs(6), idleHintMs(4, 'slower')]).toEqual([15_000, 12_000, 10_000, 18_000]);
  });
});

/** Speech whose lines end only when the test says so, to model fast taps outpacing audio. */
function manualSpeech() {
  const lines: Array<{ items: SayItem[]; end(): void; stopped: boolean }> = [];
  const port: SpeechPort = {
    say(items) {
      let end!: () => void;
      const done = new Promise<'ended'>((r) => (end = () => r('ended')));
      const line = { items, end, stopped: false };
      lines.push(line);
      return {
        done,
        stop: () => {
          line.stopped = true;
          end();
        },
      };
    },
    sfx: () => {},
    stop: () => {},
  };
  return { port, lines, spoken: () => lines.map((l) => l.items.map((i) => ('vocab' in i ? i.vocab : 'ref' in i ? 'ref' : 'ui' in i ? i.ui : 'praise')).join('+')) };
}

const timers: Timers = { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

function liveController(def: ActivityDefinition) {
  const speech = manualSpeech();
  const ends: string[] = [];
  const c = new ActivityController({ def, logic: logicFor(def)!, speech: speech.port, timers, seed: 3, minFeedbackMs: 0, idleHintMs: 60_000, onEnd: (r) => ends.push(r) });
  c.start();
  speech.lines[0]!.end(); // the instruction
  return { c, speech, ends };
}

describe('controller: inline outcomes and the counting voice queue', () => {
  it('three rapid taps on three apples speak 1, 2, 3 in order (acceptance 2)', async () => {
    const { c, speech } = liveController(apples);
    await flush();
    expect(c.snapshot.phase).toBe('ready');
    c.input(tap('apple-1'));
    c.input(tap('apple-2'));
    c.input(tap('apple-3'));
    // Counting taps stay in `ready`; the last one asks the question after the numbers.
    for (let i = 1; i < speech.lines.length; i++) {
      await flush();
      speech.lines[i]!.end();
    }
    for (let i = 0; i < 5; i++) {
      await flush();
      const last = speech.lines.at(-1)!;
      last.end();
    }
    expect(speech.spoken().slice(1, 4)).toEqual(['numbers.1', 'numbers.2', 'numbers.3+ref']);
  });

  it('taps that outpace the voice by more than 2 cut lines short but never skip a number', async () => {
    const five = fixture<'count_objects'>('pg07.a1');
    const { c, speech } = liveController(five);
    await flush();
    for (let i = 1; i <= 4; i++) c.input(tap(`apple-${i}`));
    await flush();
    // Line "1" was cut when a third line queued behind it.
    expect(speech.lines[1]!.stopped).toBe(true);
    for (let i = 0; i < 8; i++) {
      await flush();
      speech.lines.at(-1)!.end();
    }
    expect(speech.spoken().slice(1, 5)).toEqual(['numbers.1', 'numbers.2', 'numbers.3', 'numbers.4']);
  });

  it('a counting tap stays in ready and does not raise not-yet counters', async () => {
    const { c } = liveController(tapN);
    await flush();
    c.input(tap('carrot-1'));
    expect(c.snapshot).toMatchObject({ phase: 'ready', notYetCount: 0, m: { counted: ['carrot-1'] } });
    expect(c.snapshot.last).toMatchObject({ anim: 'count', targetId: 'carrot-1' });
  });

  it('selecting a card is inline; a match goes through feedback and completion happens once', async () => {
    const { c, speech, ends } = liveController(sounds);
    await flush();
    c.input(tap('cat:L'));
    expect(c.snapshot.phase).toBe('ready');
    c.input(tap('cat:R'));
    expect(c.snapshot.phase).toBe('feedback');
    c.input(tap('dog:L')); // ignored during feedback
    expect((c.snapshot.m as MatchPairsState).selected).toBeUndefined();
    for (let i = 0; i < 6; i++) {
      await flush();
      speech.lines.at(-1)!.end();
    }
    await new Promise((r) => setTimeout(r, 5));
    expect(c.snapshot.phase).toBe('ready');
    c.input(tap('dog:L'));
    c.input(tap('dog:R'));
    for (let i = 0; i < 6; i++) {
      await flush();
      speech.lines.at(-1)!.end();
    }
    await new Promise((r) => setTimeout(r, 5));
    expect(ends).toEqual(['completed']);
  });

  it('pause clears queued counting lines', async () => {
    const { c, speech } = liveController(apples);
    await flush();
    c.input(tap('apple-1'));
    c.input(tap('apple-2'));
    c.pause();
    expect(speech.lines.at(-1)!.stopped).toBe(true);
    const n = speech.lines.length;
    await flush();
    expect(speech.lines.length).toBe(n);
  });
});
