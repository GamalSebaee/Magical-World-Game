import { describe, expect, it, vi } from 'vitest';
import { rawContent } from '@content/bundle';
import { LevelDefinition, type ActivityDefinition } from '@content/schema';
import { logicFor } from '@game/activities/registry';
import { tapDiscoverLogic } from '@game/activities/tap-discover/logic';
import { listenChooseLogic } from '@game/activities/listen-choose/logic';
import { speakRepeatLogic } from '@game/activities/speak-repeat/logic';
import { LevelRunner } from '@features/levels/LevelRunner';
import { MemoryBackend } from '@services/storage/MemoryBackend';
import { createRepositories } from '@services/storage/repositories';
import { EventBus, type AppEvent } from '@shared/events';
import { sequentialIds } from '@shared/ids';
import { fixedClock, silentLogger } from '@shared/runtime';
import { ActivityController, type SpeechPort, type Timers } from './ActivityController';
import type { SayItem } from './types';

const level = LevelDefinition.parse(rawContent.levels['af-01']);
type Of<K extends ActivityDefinition['mechanic']> = Extract<ActivityDefinition, { mechanic: K }>;
const tap = level.activities[0] as Of<'tap_discover'>;
const listen = level.activities[1] as Of<'listen_choose'>;
const speak = level.activities[2] as Of<'speak_repeat'>;
const ctx = (skills: string[]) => ({ hintLevel: 0 as const, skillForVocab: (v: string) => (skills.includes(`vocab.${v}`) ? `vocab.${v}` : undefined) });

/** Speech that finishes on the next microtask; records what was said. */
function fakeSpeech() {
  const said: SayItem[][] = [];
  const sfx: string[] = [];
  let stops = 0;
  const port: SpeechPort = {
    say: (items) => {
      said.push(items);
      return { done: Promise.resolve('ended'), stop: () => {} };
    },
    sfx: (id) => sfx.push(id),
    stop: () => {
      stops++;
    },
  };
  return { port, said, sfx, stops: () => stops };
}

/** Manual timers: run(ms) fires everything due. */
function fakeTimers() {
  let now = 0;
  let id = 0;
  const pending = new Map<number, { at: number; fn: () => void }>();
  const timers: Timers = {
    setTimeout: (fn, ms) => (pending.set(++id, { at: now + ms, fn }), id),
    clearTimeout: (h) => pending.delete(h as number),
  };
  const run = async (ms: number) => {
    const end = now + ms;
    for (;;) {
      await flush();
      const due = [...pending.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      pending.delete(due[0]);
      now = due[1].at;
      due[1].fn();
    }
    now = end;
    await flush();
  };
  return { timers, run };
}
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

function controllerFor(def: ActivityDefinition, opts: Partial<ConstructorParameters<typeof ActivityController>[0]> = {}) {
  const speech = fakeSpeech();
  const t = fakeTimers();
  const outcomes: unknown[] = [];
  const ends: string[] = [];
  const c = new ActivityController({
    def,
    logic: logicFor(def)!,
    speech: speech.port,
    timers: t.timers,
    seed: 7,
    onOutcome: (o) => outcomes.push(o),
    onEnd: (r) => ends.push(r),
    ...opts,
  });
  return { c, speech, ...t, outcomes, ends };
}

describe('tap_discover logic (04 §4.1)', () => {
  it('reveals each item once and completes when all are found', () => {
    let m = tapDiscoverLogic.init(tap, 1);
    const r1 = tapDiscoverLogic.apply(tap, m, { type: 'tap', targetId: 'cat' }, ctx(tap.skills))!;
    expect(r1.outcome).toMatchObject({ kind: 'partial', anim: 'reveal', evidence: [{ skillId: 'vocab.animals.cat', kind: 'exposure' }] });
    m = r1.m;
    expect(tapDiscoverLogic.apply(tap, m, { type: 'tap', targetId: 'cat' }, ctx(tap.skills))).toBeNull();
    expect(tapDiscoverLogic.apply(tap, m, { type: 'tap', targetId: 'nothing' }, ctx(tap.skills))).toBeNull();
    m = tapDiscoverLogic.apply(tap, m, { type: 'tap', targetId: 'dog' }, ctx(tap.skills))!.m;
    expect(tapDiscoverLogic.isComplete(tap, m)).toBe(true);
  });

  it('sequence mode accepts only the next item', () => {
    const seq = { ...tap, mode: 'sequence' as const };
    const m = tapDiscoverLogic.init(seq, 1);
    const r = tapDiscoverLogic.apply(seq, m, { type: 'tap', targetId: 'dog' }, ctx(seq.skills))!;
    expect(r.outcome.kind).toBe('not_yet');
    expect(r.m.found).toEqual([]);
  });
});

describe('listen_choose logic (04 §4.2)', () => {
  it('records firstTry=false after a wrong pick, then advances rounds', () => {
    let m = listenChooseLogic.init(listen, 1);
    const wrong = listenChooseLogic.apply(listen, m, { type: 'tap', targetId: 'cat' }, ctx(listen.skills))!;
    expect(wrong.outcome).toMatchObject({ kind: 'not_yet', anim: 'wiggle', thenPrompt: true, say: [{ vocab: 'animals.cat' }] });
    m = wrong.m;
    const right = listenChooseLogic.apply(listen, m, { type: 'tap', targetId: 'dog' }, ctx(listen.skills))!;
    expect(right.outcome.evidence).toEqual([{ skillId: 'vocab.animals.dog', kind: 'choice_correct', firstTry: false }]);
    m = right.m;
    expect(listenChooseLogic.prompt(listen, m)).toBe(listen.rounds[1]!.prompt);
    const second = listenChooseLogic.apply(listen, m, { type: 'tap', targetId: 'cat' }, ctx(listen.skills))!;
    expect(second.outcome.evidence[0]).toMatchObject({ firstTry: true });
    expect(listenChooseLogic.isComplete(listen, second.m)).toBe(true);
  });

  it('the same seed gives the same choice order (resume shows the same layout)', () => {
    expect(listenChooseLogic.init(listen, 42).order).toEqual(listenChooseLogic.init(listen, 42).order);
  });
});

describe('speak_repeat logic (04 §4.6)', () => {
  const heard = { type: 'speech' as const, result: 'recorded_voice_detected' as const, line: 'speech.heard', evidence: { kind: 'speech_attempt' as const, voiced: true } };

  it('needs one attempt before continue, and auto-continues after the configured number', () => {
    let m = speakRepeatLogic.init(speak, 1);
    expect(speakRepeatLogic.apply(speak, m, { type: 'continue' }, ctx([]))).toBeNull();
    m = speakRepeatLogic.apply(speak, m, heard, ctx([]))!.m;
    expect(speakRepeatLogic.isComplete(speak, m)).toBe(false);
    const cont = speakRepeatLogic.apply(speak, m, { type: 'continue' }, ctx([]))!;
    expect(speakRepeatLogic.isComplete(speak, cont.m)).toBe(true);
    const twice = speakRepeatLogic.apply(speak, m, heard, ctx([]))!;
    expect(speakRepeatLogic.isComplete(speak, twice.m)).toBe(true);
  });

  it('records practice evidence, never correctness; a failed recorder records nothing', () => {
    const m = speakRepeatLogic.init(speak, 1);
    const r = speakRepeatLogic.apply(speak, m, heard, ctx([]))!;
    expect(r.outcome.evidence).toEqual([{ skillId: 'speak.vocab.cat', kind: 'speech_attempt', voiced: true }]);
    const fail = speakRepeatLogic.apply(speak, m, { ...heard, result: 'unavailable', line: 'speech.retry', evidence: { kind: 'none' } }, ctx([]))!;
    expect(fail.outcome.evidence).toEqual([]);
    expect(fail.m.attempts).toBe(0);
    const prompt = speakRepeatLogic.apply(speak, m, { type: 'speech', result: 'prompt_only', line: 'speech.together', evidence: { kind: 'speech_prompt_only' } }, ctx([]))!;
    expect(prompt.outcome.evidence[0]?.kind).toBe('speech_prompt_only');
  });
});

describe('ActivityController lifecycle (T-LIFE)', () => {
  it('intro → ready → feedback → completed, emitting completion exactly once', async () => {
    const { c, run, ends } = controllerFor(tap);
    c.start();
    expect(c.snapshot.phase).toBe('intro');
    await run(0);
    expect(c.snapshot.phase).toBe('ready');
    c.input({ type: 'tap', targetId: 'cat' });
    expect(c.snapshot.phase).toBe('feedback');
    c.input({ type: 'tap', targetId: 'dog' }); // ignored during feedback
    await run(1000);
    expect(c.snapshot.phase).toBe('ready');
    c.input({ type: 'tap', targetId: 'dog' });
    await run(1000);
    expect(c.snapshot.phase).toBe('completed');
    c.skip();
    expect(ends).toEqual(['completed']);
  });

  it('rapid repeated taps on one item produce one outcome (T-MECH-02)', async () => {
    const { c, run, outcomes } = controllerFor(tap);
    c.start();
    await run(0);
    for (let i = 0; i < 5; i++) c.input({ type: 'tap', targetId: 'cat' });
    await run(1000);
    for (let i = 0; i < 5; i++) c.input({ type: 'tap', targetId: 'cat' });
    expect(outcomes).toHaveLength(1);
  });

  it('a tap during the intro stops the instruction and is handled', async () => {
    const { c, speech } = controllerFor(tap);
    c.start();
    c.input({ type: 'tap', targetId: 'cat' });
    expect(c.snapshot.phase).toBe('feedback');
    expect(speech.stops()).toBeGreaterThan(0);
  });

  it('two not-yets raise the hint level; four offer skip; hint 3 shows the demo hand', async () => {
    const { c, run } = controllerFor(listen);
    c.start();
    await run(0);
    for (let i = 0; i < 4; i++) {
      c.input({ type: 'tap', targetId: 'cat' });
      await run(1000);
    }
    expect(c.snapshot.hintLevel).toBe(2);
    expect(c.snapshot.offerSkip).toBe(true);
    c.help();
    expect(c.snapshot.hintLevel).toBe(3);
    expect(c.snapshot.demo).toBe(true);
    expect(c.snapshot.hintTarget).toBe('dog');
  });

  it('a correct answer at hint level 2+ does not count as first try', async () => {
    const { c, run, outcomes } = controllerFor(listen);
    c.start();
    await run(0);
    c.help();
    c.help();
    c.input({ type: 'tap', targetId: 'dog' });
    expect((outcomes[0] as { evidence: Array<{ firstTry?: boolean }> }).evidence[0]?.firstTry).toBe(false);
  });

  it('idle time plays at most two automatic hints', async () => {
    const { c, run, speech } = controllerFor(tap, { idleHintMs: 12_000 });
    c.start();
    await run(0);
    const before = speech.said.length;
    await run(12_000);
    expect(speech.said.length).toBe(before + 1);
    expect(c.snapshot.hintLevel).toBe(1);
    await run(60_000);
    expect(speech.said.length).toBe(before + 2);
  });

  it('pause drops in-flight callbacks; resume finishes the interrupted feedback', async () => {
    const { c, run } = controllerFor(tap);
    c.start();
    await run(0);
    c.input({ type: 'tap', targetId: 'cat' });
    c.pause();
    await run(5000);
    expect(c.snapshot.phase).toBe('feedback');
    c.input({ type: 'tap', targetId: 'dog' });
    expect(c.snapshot.m).toEqual({ found: ['cat'] });
    c.resume();
    expect(c.snapshot.phase).toBe('ready');
  });

  it('skip ends the activity from any live phase; dispose silences everything', async () => {
    const { c, ends, run } = controllerFor(speak);
    c.start();
    c.skip();
    expect(ends).toEqual(['skipped']);
    const other = controllerFor(tap);
    other.c.start();
    other.c.dispose();
    await run(20_000);
    other.c.input({ type: 'tap', targetId: 'cat' });
    expect(other.outcomes).toHaveLength(0);
  });

  it('resumes saved mechanic state', async () => {
    const { c, run } = controllerFor(tap, { resume: { m: { found: ['cat'] }, hintLevel: 1 } });
    c.start();
    await run(0);
    expect(c.snapshot.hintLevel).toBe(1);
    c.input({ type: 'tap', targetId: 'dog' });
    await run(1000);
    expect(c.snapshot.phase).toBe('completed');
  });
});

describe('LevelRunner (AF-01 end to end, memory storage)', () => {
  function makeRunner(repos = createRepositories(new MemoryBackend(), { clock: fixedClock(Date.UTC(2026, 9, 20)), ids: sequentialIds('r') })) {
    const events = new EventBus<AppEvent>();
    const seen: AppEvent[] = [];
    events.onAny((e) => seen.push(e));
    const t = fakeTimers();
    const controllers: ActivityController[] = [];
    const runner = new LevelRunner({
      level,
      profileId: 'kid',
      storage: repos,
      events,
      clock: fixedClock(Date.UTC(2026, 9, 20)),
      ids: sequentialIds('run'),
      logger: silentLogger,
      random: () => 0.5,
      makeController: (a) => {
        const logic = logicFor(a.def);
        if (!logic) return undefined;
        const c = new ActivityController({ ...a, logic, speech: fakeSpeech().port, timers: t.timers });
        controllers.push(c);
        return c;
      },
    });
    return { runner, repos, seen, run: t.run, current: () => runner.state().controller! };
  }

  async function playThrough(r: ReturnType<typeof makeRunner>) {
    r.runner.start();
    await r.run(0);
    r.current().input({ type: 'tap', targetId: 'cat' });
    await r.run(1000);
    r.current().input({ type: 'tap', targetId: 'dog' });
    await r.run(1000);
    expect(r.current().snapshot.activityId).toBe('af01.a2');
    await r.run(0);
    r.current().input({ type: 'tap', targetId: 'dog' });
    await r.run(1000);
    r.current().input({ type: 'tap', targetId: 'cat' });
    await r.run(1000);
    expect(r.current().snapshot.activityId).toBe('af01.a3');
    await r.run(0);
    r.current().input({ type: 'speech', result: 'prompt_only', line: 'speech.together', evidence: { kind: 'speech_prompt_only' } });
    await r.run(1000);
    r.current().input({ type: 'continue' });
    await r.run(1000);
    await vi.waitFor(() => expect(r.runner.state().result).toBeDefined());
  }

  it('completes the level, writes evidence and attempts, and grants the sticker once', async () => {
    const r = makeRunner();
    await playThrough(r);
    expect(r.runner.state().result).toMatchObject({ firstCompletion: true, stickerNew: true, skipped: 0 });
    expect(await r.repos.rewards.stickersFor('kid')).toHaveLength(1);
    const counts = await r.repos.counts();
    expect(counts.attempts).toBe(3);
    expect(counts.evidence).toBeGreaterThanOrEqual(5);
    expect(counts.activeSession).toBe(0);
    expect(r.seen.filter((e) => e.type === 'reward.granted')).toHaveLength(1);
    expect(r.seen.filter((e) => e.type === 'level.completed')).toHaveLength(1);

    // Replaying the level: completion counted again, sticker not granted twice.
    const again = makeRunner(r.repos);
    await playThrough(again);
    expect(again.runner.state().result).toMatchObject({ firstCompletion: false, stickerNew: false });
    expect(await r.repos.rewards.stickersFor('kid')).toHaveLength(1);
    expect(again.seen.filter((e) => e.type === 'reward.granted')).toHaveLength(0);
  });

  it('skipping every activity still completes the level with the same reward', async () => {
    const r = makeRunner();
    r.runner.start();
    for (let i = 0; i < 3; i++) {
      await r.run(0);
      r.current().skip();
      await r.run(0);
    }
    await vi.waitFor(() => expect(r.runner.state().result).toMatchObject({ stickerNew: true, skipped: 3 }));
  });

  it('saves a snapshot mid-level and resumes at the same activity and state', async () => {
    const r = makeRunner();
    r.runner.start();
    await r.run(0);
    r.current().input({ type: 'tap', targetId: 'cat' });
    await r.run(1000);
    r.runner.pause();
    await vi.waitFor(async () =>
      expect(await r.repos.activeSession.resumable('kid', 'af-01', level.contentVersion)).toMatchObject({ mechanicState: { found: ['cat'] } }),
    );
    const snap = (await r.repos.activeSession.resumable('kid', 'af-01', level.contentVersion))!;
    r.runner.dispose();

    const r2 = makeRunner(r.repos);
    r2.runner.start(snap);
    expect(r2.current().snapshot.m).toEqual({ found: ['cat'] });
  });
});
