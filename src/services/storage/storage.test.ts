import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { beforeEach, describe, expect, it } from 'vitest';
import { sequentialIds } from '@shared/ids';
import { fixedClock, localDay, silentLogger } from '@shared/runtime';
import type { StorageBackend } from './backend';
import { IdbBackend } from './IdbBackend';
import { MemoryBackend } from './MemoryBackend';
import { DB_VERSION } from './migrations';
import { openStorage } from './openStorage';
import { createRepositories, MAX_PROFILES } from './repositories';
import { DB_NAME, STORE_NAMES, STORES } from './schema';

beforeEach(() => {
  // Fresh database for every test.
  globalThis.indexedDB = new IDBFactory();
});

let dbCounter = 0;
const backends: Array<[string, () => Promise<StorageBackend>]> = [
  ['IdbBackend', () => IdbBackend.open({ name: `test-${++dbCounter}` })],
  ['MemoryBackend', async () => new MemoryBackend()],
];

describe.each(backends)('%s contract', (_name, make) => {
  async function setup() {
    const backend = await make();
    const clock = fixedClock(Date.UTC(2026, 9, 19, 9));
    const repos = createRepositories(backend, { clock, ids: sequentialIds('p') });
    return { backend, clock, repos };
  }

  it('creates and lists profiles in creation order, trimming the name', async () => {
    const { repos, clock } = await setup();
    const a = await repos.profiles.create({ displayName: '  Mariam  ', ageBand: 4 });
    clock.advance(10);
    const b = await repos.profiles.create({ ageBand: 5 });
    expect(a.displayName).toBe('Mariam');
    expect(b.displayName).toBeUndefined();
    expect((await repos.profiles.list()).map((p) => p.id)).toEqual([a.id, b.id]);
  });

  it(`refuses more than ${MAX_PROFILES} profiles`, async () => {
    const { repos } = await setup();
    for (let i = 0; i < MAX_PROFILES; i++) await repos.profiles.create({ ageBand: 4 });
    await expect(repos.profiles.create({ ageBand: 4 })).rejects.toThrow();
  });

  it('grants a sticker exactly once (T-REW idempotency)', async () => {
    const { repos } = await setup();
    const p = await repos.profiles.create({ ageBand: 4 });
    const results = [];
    for (let i = 0; i < 3; i++) results.push(await repos.rewards.grantSticker(p.id, 'sticker.af-01', 'af-01'));
    expect(results).toEqual([true, false, false]);
    expect(await repos.rewards.stickersFor(p.id)).toHaveLength(1);
  });

  it('counts a level completion once per run, however often it is reported', async () => {
    const { repos } = await setup();
    const p = await repos.profiles.create({ ageBand: 4 });
    expect(await repos.progress.completeLevel(p.id, 'af-01', 'run-1')).toEqual({ first: true });
    expect(await repos.progress.completeLevel(p.id, 'af-01', 'run-1')).toEqual({ first: false });
    expect(await repos.progress.completeLevel(p.id, 'af-01', 'run-2')).toEqual({ first: false });
    const [c] = await repos.progress.completionsFor(p.id);
    expect(c?.timesCompleted).toBe(2);
  });

  it('merges settings over defaults and persists patches', async () => {
    const { repos } = await setup();
    expect((await repos.settings.get()).languageMode).toBe('ar');
    expect((await repos.settings.get()).micEnabled).toBe(false);
    await repos.settings.patch({ languageMode: 'en', digitStyle: 'western' });
    const s = await repos.settings.get();
    expect(s.languageMode).toBe('en');
    expect(s.digitStyle).toBe('western');
    expect(s.sessionReminderMin).toBe(20);
  });

  it('stores evidence and reads it back by profile and skill', async () => {
    const { repos, clock } = await setup();
    const p = await repos.profiles.create({ ageBand: 4 });
    await repos.progress.appendEvidence({
      profileId: p.id,
      skillId: 'vocab.animals.cat',
      activityId: 'af01.a2',
      attemptId: 'att-1',
      kind: 'choice_correct',
      firstTry: true,
      hintLevel: 0,
      at: clock.now(),
      sessionDay: localDay(clock.now()),
    });
    expect(await repos.progress.evidenceFor(p.id, 'vocab.animals.cat')).toHaveLength(1);
    expect(await repos.progress.evidenceFor(p.id, 'vocab.animals.dog')).toHaveLength(0);
  });

  it('resumes an active session only for the same level, content version and within 24 h', async () => {
    const { repos, clock } = await setup();
    const p = await repos.profiles.create({ ageBand: 4 });
    await repos.activeSession.save({
      profileId: p.id,
      levelId: 'af-01',
      contentVersion: '0.1.0',
      activityIndex: 1,
      activityId: 'af01.a2',
      mechanicState: { found: ['cat'] },
      hintLevel: 1,
      seed: 42,
      startedAt: clock.now(),
    });
    expect(await repos.activeSession.resumable(p.id, 'af-01', '0.1.0')).toMatchObject({ activityIndex: 1 });
    expect(await repos.activeSession.resumable(p.id, 'af-01', '0.2.0')).toBeUndefined();
    expect(await repos.activeSession.resumable(p.id, 'af-02', '0.1.0')).toBeUndefined();
    clock.advance(25 * 60 * 60 * 1000);
    expect(await repos.activeSession.resumable(p.id, 'af-01', '0.1.0')).toBeUndefined();
  });

  it('deletes one child completely without touching another (T-PRIV)', async () => {
    const { repos, clock } = await setup();
    const a = await repos.profiles.create({ ageBand: 4 });
    const b = await repos.profiles.create({ ageBand: 5 });
    for (const p of [a, b]) {
      await repos.avatars.save({
        profileId: p.id,
        hairStyle: 'curly',
        hairColor: 'brown',
        skinTone: 's2',
        top: 't1',
        bottom: 'b1',
        shoes: 'sh1',
        accessory: 'none',
      });
      await repos.rewards.grantSticker(p.id, 'sticker.af-01', 'af-01');
      await repos.progress.completeLevel(p.id, 'af-01', 'r');
      await repos.progress.appendEvidence({
        profileId: p.id,
        skillId: 'vocab.animals.cat',
        activityId: 'af01.a1',
        attemptId: 'x',
        kind: 'exposure',
        hintLevel: 0,
        at: clock.now(),
        sessionDay: localDay(clock.now()),
      });
      await repos.settings.patch({ hintTiming: 'slower' }, p.id);
    }

    await repos.deleteProfile(a.id);

    const exportA = await repos.exportAll(a.id);
    expect(exportA.profiles).toHaveLength(0);
    const exportB = await repos.exportAll(b.id);
    expect(exportB.profiles).toHaveLength(1);
    expect(exportB.profiles[0]).toMatchObject({ avatar: { profileId: b.id } });
    expect(exportB.profiles[0]?.stickers).toHaveLength(1);
    expect(exportB.profiles[0]?.evidence).toHaveLength(1);
    const counts = await repos.counts();
    expect(counts.profiles).toBe(1);
    expect(counts.avatars).toBe(1);
    expect(counts.stickers).toBe(1);
    expect(counts.settings).toBe(1); // b's per-profile settings only
  });

  it('exports a single child without other children’s data, and never any audio', async () => {
    const { repos } = await setup();
    const a = await repos.profiles.create({ ageBand: 4 });
    await repos.profiles.create({ ageBand: 5 });
    const file = await repos.exportAll(a.id);
    expect(file.format).toBe('mwg-export');
    expect(file.profiles.map((p) => p.profile.id)).toEqual([a.id]);
    expect(JSON.stringify(file)).not.toMatch(/audio\/|blob:/);
  });

  it('prunes queued analytics events older than 90 days', async () => {
    const { repos, clock } = await setup();
    await repos.events.enqueue({ type: 'session.start' });
    clock.advance(91 * 24 * 60 * 60 * 1000);
    await repos.events.enqueue({ type: 'session.start' });
    expect(await repos.events.count()).toBe(2);
    expect(await repos.backend.deleteOlderThan('eventQueue', 'at', clock.now() - 90 * 24 * 60 * 60 * 1000)).toBe(1);
    expect(await repos.events.count()).toBe(1);
  });
});

describe('IndexedDB schema and migrations', () => {
  it('creates every store and index from the store table', async () => {
    const backend = await IdbBackend.open({ name: 'schema-check' });
    backend.close();
    const db = await openDB('schema-check');
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual([...STORE_NAMES].sort());
    for (const name of STORE_NAMES) {
      const tx = db.transaction(name);
      expect([...tx.store.indexNames].sort()).toEqual(STORES[name].indexes.map((i) => i.name).sort());
    }
    db.close();
  });

  it('keeps existing data when reopened at the same version', async () => {
    const first = await IdbBackend.open({ name: 'reopen' });
    const repos = createRepositories(first, { clock: fixedClock(1), ids: sequentialIds() });
    const p = await repos.profiles.create({ ageBand: 3 });
    first.close();
    const second = await IdbBackend.open({ name: 'reopen' });
    expect(await second.get('profiles', p.id)).toMatchObject({ ageBand: 3 });
    second.close();
  });

  it('refuses to open a newer database version instead of corrupting it', async () => {
    const newer = await openDB(DB_NAME, DB_VERSION + 1, { upgrade() {} });
    newer.close();
    await expect(IdbBackend.open()).rejects.toMatchObject({ code: 'version' });
  });
});

describe('openStorage fallback', () => {
  it('uses IndexedDB when available', async () => {
    const { status } = await openStorage({ clock: fixedClock(0), ids: sequentialIds(), logger: silentLogger });
    expect(status).toEqual({ backend: 'indexeddb' });
  });

  it('falls back to memory when IndexedDB is missing (private mode)', async () => {
    const saved = globalThis.indexedDB;
    // @ts-expect-error simulating a browser without IndexedDB
    delete globalThis.indexedDB;
    try {
      const { status, repos } = await openStorage({ clock: fixedClock(0), ids: sequentialIds(), logger: silentLogger });
      expect(status).toEqual({ backend: 'memory', degradedReason: 'unavailable' });
      await repos.profiles.create({ ageBand: 4 });
      expect(await repos.profiles.list()).toHaveLength(1);
    } finally {
      globalThis.indexedDB = saved;
    }
  });

  it('falls back to memory when the database is a newer version', async () => {
    const newer = await openDB(DB_NAME, DB_VERSION + 1, { upgrade() {} });
    newer.close();
    const { status } = await openStorage({ clock: fixedClock(0), ids: sequentialIds(), logger: silentLogger });
    expect(status).toEqual({ backend: 'memory', degradedReason: 'version' });
  });
});
