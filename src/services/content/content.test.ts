import { describe, expect, it } from 'vitest';
import { rawContent, type RawContentBundle } from '@content/bundle';
import { ActivityDefinition, LevelDefinition } from '@content/schema';
import { ContentRepository } from './ContentRepository';
import { validateContent } from './validateContent';

const clone = <T>(v: T): T => structuredClone(v);
const af01 = () => clone(rawContent.levels['af-01']) as Record<string, any>;
const withLevel = (lvl: unknown): RawContentBundle => ({ ...clone(rawContent), levels: { 'af-01': lvl } });

describe('bundled content (T-CON)', () => {
  it('validates with no errors outside release mode', () => {
    const r = validateContent(rawContent, { release: false });
    expect(r.errors).toEqual([]);
  });

  it('fails release validation while audio and art are placeholders', () => {
    const r = validateContent(rawContent, { release: true });
    expect(r.errors.some((e) => e.includes('not approved'))).toBe(true);
    expect(r.errors.some((e) => e.includes('not authored yet'))).toBe(true);
  });

  it('parses AF-01 into the typed definition with all three mechanics', () => {
    const lvl = LevelDefinition.parse(rawContent.levels['af-01']);
    expect(lvl.activities.map((a) => a.mechanic)).toEqual(['tap_discover', 'listen_choose', 'speak_repeat']);
  });

  it('the planning example and the bundled AF-01 are identical', async () => {
    const example = await import('../../../docs/planning/examples/af-01.level.json');
    expect(example.default).toEqual(rawContent.levels['af-01']);
  });
});

describe('schema rules', () => {
  it('rejects a listen_choose answer that is not one of the choices', () => {
    const lvl = af01();
    lvl.activities[1].rounds[0].answer = 'rabbit';
    expect(LevelDefinition.safeParse(lvl).success).toBe(false);
  });

  it('rejects duplicate activity ids', () => {
    const lvl = af01();
    lvl.activities[1].id = 'af01.a1';
    const r = LevelDefinition.safeParse(lvl);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('duplicate activity id');
  });

  it('rejects an activity skill not declared on the level', () => {
    const lvl = af01();
    lvl.activities[0].skills.push('vocab.animals.rabbit');
    expect(LevelDefinition.safeParse(lvl).success).toBe(false);
  });

  it('rejects mixed-mode sequences without a pinned language', () => {
    const lvl = af01();
    lvl.activities[2].model.mixed = ['word.animals.cat'];
    expect(LevelDefinition.safeParse(lvl).success).toBe(false);
  });

  it('rejects allowSkip: false (skip is always available)', () => {
    const lvl = af01();
    lvl.activities[0].allowSkip = false;
    expect(LevelDefinition.safeParse(lvl).success).toBe(false);
  });

  it('rejects more than 3 hints', () => {
    const lvl = af01();
    const h = lvl.activities[0].hints[0];
    lvl.activities[0].hints = [h, h, h, h];
    expect(LevelDefinition.safeParse(lvl).success).toBe(false);
  });

  it('count_objects how_many: target must equal the number of objects and be a choice', () => {
    const base = {
      id: 'ni01.a1',
      mechanic: 'count_objects',
      skills: ['math.count.upto3'],
      instruction: { ar: ['x.y'], en: ['x.y'], caption: { ar: 'ع', en: 'e' } },
      hints: [{ ar: ['x.y'], en: ['x.y'], caption: { ar: 'ع', en: 'e' } }],
      layout: 'row-3',
      allowSkip: true,
      ask: 'how_many',
      objects: [
        { id: 'a', asset: 'objects/shell' },
        { id: 'b', asset: 'objects/shell' },
      ],
      target: 2,
      answerChoices: [1, 2],
      completion: { type: 'answered' },
    };
    expect(ActivityDefinition.safeParse(base).success).toBe(true);
    expect(ActivityDefinition.safeParse({ ...base, target: 3, answerChoices: [2, 3] }).success).toBe(false);
    expect(ActivityDefinition.safeParse({ ...base, answerChoices: [1, 3] }).success).toBe(false);
  });

  it('defaults speak_repeat limits', () => {
    const lvl = af01();
    delete lvl.activities[2].maxRecordMs;
    const parsed = LevelDefinition.parse(lvl);
    const speak = parsed.activities[2];
    expect(speak?.mechanic === 'speak_repeat' && speak.maxRecordMs).toBe(5000);
  });
});

describe('cross-reference validation', () => {
  it('reports an audio clip referenced but missing from the manifest', () => {
    const lvl = af01();
    lvl.activities[0].instruction.ar = ['af01.a1.does_not_exist'];
    const r = validateContent(withLevel(lvl), { release: false });
    expect(r.errors).toContain('audio clip "af01.a1.does_not_exist" is referenced but not in audio-manifest.json');
  });

  it('reports unknown vocabulary, skills and suggested levels', () => {
    const lvl = af01();
    lvl.activities[0].items[0].vocab = 'animals.unicorn';
    lvl.suggestedNext = ['zz-01'];
    const r = validateContent(withLevel(lvl), { release: false });
    expect(r.errors).toContain('vocabulary "animals.unicorn" is not defined in vocabulary.json');
    expect(r.errors).toContain('reference to unknown level "zz-01"');
  });

  it('reports a level whose order does not match its world', () => {
    const lvl = af01();
    lvl.order = 2;
    const r = validateContent(withLevel(lvl), { release: false });
    expect(r.errors.some((e) => e.includes('order 2'))).toBe(true);
  });

  it('reports content files that are not imported in bundle.ts', () => {
    const r = validateContent(rawContent, {
      release: false,
      filesOnDisk: { worlds: ['animal-forest', 'color-town', 'number-island'], levels: ['af-01', 'af-02'] },
    });
    expect(r.errors).toContain('levels/af-02.level.json exists but is not imported in bundle.ts');
  });

  it('checks files exist for non-planned clips', () => {
    const raw = clone(rawContent) as RawContentBundle & { audioManifest: any };
    const clip = raw.audioManifest.clips[0];
    clip.review.ar.status = 'placeholder';
    const r = validateContent(raw, { release: false, fileExists: () => false });
    expect(r.errors.some((e) => e.includes('file missing'))).toBe(true);
  });
});

describe('ContentRepository', () => {
  const repo = new ContentRepository(rawContent);

  it('lists the three worlds in index order', () => {
    expect(repo.worlds().map((w) => w.id)).toEqual(['animal-forest', 'color-town', 'number-island']);
  });

  it('returns not_found and invalid results instead of throwing', () => {
    expect(repo.level('zz-99')).toEqual({ ok: false, error: 'not_found' });
    const broken = new ContentRepository({ ...rawContent, levels: { 'af-01': { id: 'af-01' } } });
    expect(broken.level('af-01')).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('no level is gated by progress: every authored level loads (R-03)', () => {
    for (const id of repo.authoredLevelIds()) expect(repo.level(id).ok).toBe(true);
  });
});
