import type { ZodType } from 'zod';
import {
  AssetManifest,
  AudioManifest,
  ContentIndex,
  LevelDefinition,
  SkillsFile,
  UiAudioFile,
  VocabularyFile,
  WorldDefinition,
  type ReviewStatus,
} from '@content/schema';
import type { RawContentBundle } from '@content/bundle';
import { addClip, collectLevelRefs, collectUiAudioRefs, collectWorldRefs, emptyRefs } from './references';

export interface ValidateOptions {
  /** Release builds require every clip/asset to exist and be approved. */
  release: boolean;
  /** Checks a path relative to /public. Omit to skip file-existence checks (e.g. in the browser). */
  fileExists?: (publicPath: string) => boolean;
  /** Content files found on disk, so files missing from the bundle are reported. */
  filesOnDisk?: { worlds: string[]; levels: string[] };
}

export interface ValidationReport {
  errors: string[];
  warnings: string[];
}

function check<T>(schema: ZodType<T>, value: unknown, label: string, errors: string[]): T | undefined {
  const r = schema.safeParse(value);
  if (r.success) return r.data;
  for (const issue of r.error.issues) {
    errors.push(`${label}: ${issue.path.join('.') || '(root)'} — ${issue.message}`);
  }
  return undefined;
}

const SHIPPABLE: ReviewStatus[] = ['approved'];

/**
 * Validates the whole content bundle: schemas, cross-references, manifests and (optionally) files.
 * Pure apart from the injected `fileExists`, so it runs in tests, in the CLI and at build time.
 */
export function validateContent(raw: RawContentBundle, opts: ValidateOptions): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  // Problems that block a release but are expected while content is being produced.
  const releaseOnly = (msg: string) => (opts.release ? errors : warnings).push(msg);

  const index = check(ContentIndex, raw.index, 'index.json', errors);
  const skills = check(SkillsFile, raw.skills, 'skills.json', errors);
  const vocab = check(VocabularyFile, raw.vocabulary, 'vocabulary.json', errors);
  const uiAudio = check(UiAudioFile, raw.uiAudio, 'ui-audio.json', errors);
  const audio = check(AudioManifest, raw.audioManifest, 'audio-manifest.json', errors);
  const assets = check(AssetManifest, raw.assetsManifest, 'assets-manifest.json', errors);

  const refs = emptyRefs();
  if (uiAudio) collectUiAudioRefs(uiAudio, refs);
  const worlds = new Map<string, WorldDefinition>();
  for (const [key, value] of Object.entries(raw.worlds)) {
    const w = check(WorldDefinition, value, `worlds/${key}`, errors);
    if (!w) continue;
    if (w.id !== key) errors.push(`worlds/${key}: id "${w.id}" does not match its key`);
    worlds.set(w.id, w);
    collectWorldRefs(w, refs);
  }

  const levels = new Map<string, LevelDefinition>();
  for (const [key, value] of Object.entries(raw.levels)) {
    const l = check(LevelDefinition, value, `levels/${key}`, errors);
    if (!l) continue;
    if (l.id !== key) errors.push(`levels/${key}: id "${l.id}" does not match its key`);
    levels.set(l.id, l);
    collectLevelRefs(l, refs);
  }

  if (index) {
    for (const wid of index.worlds) {
      if (!worlds.has(wid)) errors.push(`index.json: world "${wid}" is not in the bundle`);
    }
    for (const wid of worlds.keys()) {
      if (!index.worlds.includes(wid)) errors.push(`index.json: bundled world "${wid}" is not listed`);
    }
  }

  // World ↔ level consistency. Levels not yet authored are expected during production.
  for (const w of worlds.values()) {
    for (const lid of w.levels) {
      const l = levels.get(lid);
      if (!l) {
        releaseOnly(`worlds/${w.id}: level "${lid}" is not authored yet`);
      } else if (l.worldId !== w.id) {
        errors.push(`levels/${lid}: worldId "${l.worldId}" but listed by world "${w.id}"`);
      }
    }
  }
  for (const l of levels.values()) {
    const w = worlds.get(l.worldId);
    if (!w) errors.push(`levels/${l.id}: unknown world "${l.worldId}"`);
    else if (!w.levels.includes(l.id)) errors.push(`levels/${l.id}: not listed in world "${w.id}"`);
    else if (w.levels.indexOf(l.id) + 1 !== l.order) {
      errors.push(`levels/${l.id}: order ${l.order} does not match its position in world "${w.id}"`);
    }
    if (l.assetPack !== w?.assetPack) {
      errors.push(`levels/${l.id}: assetPack "${l.assetPack}" differs from world's "${w?.assetPack}"`);
    }
  }
  const allWorldLevels = new Set([...worlds.values()].flatMap((w) => w.levels));
  for (const lid of refs.levels) {
    if (!allWorldLevels.has(lid)) errors.push(`reference to unknown level "${lid}"`);
  }

  if (skills) {
    const known = new Set(skills.skills.map((s) => s.id));
    for (const s of refs.skills) if (!known.has(s)) errors.push(`skill "${s}" is not defined in skills.json`);
  }

  if (vocab) {
    const known = new Map(vocab.entries.map((v) => [v.id, v]));
    for (const v of refs.vocab) if (!known.has(v)) errors.push(`vocabulary "${v}" is not defined in vocabulary.json`);
    for (const v of vocab.entries) {
      addClip(refs, v.audio, 'ar');
      addClip(refs, v.audio, 'en');
      refs.assets.add(v.picture);
    }
  }

  if (audio) {
    const byId = new Map<string, (typeof audio.clips)[number]>();
    for (const c of audio.clips) {
      if (byId.has(c.id)) errors.push(`audio-manifest: duplicate clip "${c.id}"`);
      byId.set(c.id, c);
    }
    for (const [id, slots] of refs.clipLangs) {
      const entry = byId.get(id);
      if (!entry) {
        errors.push(`audio clip "${id}" is referenced but not in audio-manifest.json`);
        continue;
      }
      for (const slot of slots) {
        if (!entry.files[slot]) errors.push(`audio clip "${id}" is needed in "${slot}" but has no file for it`);
      }
    }
    for (const c of audio.clips) {
      for (const slot of ['ar', 'en', 'common'] as const) {
        const file = c.files[slot];
        const review = c.review[slot];
        if (!file || !review) continue;
        if (review.status === 'planned') {
          releaseOnly(`audio "${c.id}" (${slot}) is planned; no file yet`);
          continue;
        }
        if (opts.fileExists && !opts.fileExists(file)) errors.push(`audio "${c.id}" (${slot}): file missing: ${file}`);
        if (!SHIPPABLE.includes(review.status)) releaseOnly(`audio "${c.id}" (${slot}) is "${review.status}", not approved`);
      }
    }
  }

  if (assets) {
    const byId = new Map<string, (typeof assets.assets)[number]>();
    for (const a of assets.assets) {
      if (byId.has(a.id)) errors.push(`assets-manifest: duplicate asset "${a.id}"`);
      byId.set(a.id, a);
    }
    for (const id of refs.assets) {
      if (!byId.has(id)) errors.push(`asset "${id}" is referenced but not in assets-manifest.json`);
    }
    for (const a of assets.assets) {
      if (a.status === 'planned') {
        releaseOnly(`asset "${a.id}" is planned; no file yet`);
        continue;
      }
      for (const f of a.files) {
        if (opts.fileExists && !opts.fileExists(f)) errors.push(`asset "${a.id}": file missing: ${f}`);
      }
      if (!SHIPPABLE.includes(a.status)) releaseOnly(`asset "${a.id}" is "${a.status}", not approved`);
      if (a.licence.type === 'unassigned' || a.source === 'unassigned') {
        releaseOnly(`asset "${a.id}" has no licence/source recorded`);
      }
    }
  }

  if (opts.filesOnDisk) {
    for (const w of opts.filesOnDisk.worlds) {
      if (!(w in raw.worlds)) errors.push(`worlds/${w}.world.json exists but is not imported in bundle.ts`);
    }
    for (const l of opts.filesOnDisk.levels) {
      if (!(l in raw.levels)) errors.push(`levels/${l}.level.json exists but is not imported in bundle.ts`);
    }
  }

  return { errors, warnings };
}
