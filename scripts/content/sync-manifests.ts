/**
 * Keeps the manifests in step with content. For every audio clip or asset that content references
 * but the manifests don't list yet, adds a `planned` entry. Also fills missing transcripts from
 * content captions. Never changes review status, files or sources of existing entries.
 * Usage: tsx scripts/content/sync-manifests.ts
 */
import {
  LevelDefinition,
  UiAudioFile,
  VocabularyFile,
  WorldDefinition,
  type AssetManifest,
  type AudioClipEntry,
  type AudioManifest,
} from '../../src/content/schema';
import { rawContent } from '../../src/content/bundle';
import {
  addClip,
  collectLevelRefs,
  collectUiAudioRefs,
  collectWorldRefs,
  emptyRefs,
} from '../../src/services/content/references';
import { readJson, writeJson } from './lib';

const PACK_BY_CODE: Record<string, string> = {
  af: 'pack.animal-forest',
  ct: 'pack.color-town',
  ni: 'pack.number-island',
};

/** "af01.a1.instruction" / "world.af.name" / "sticker.af01.name" → world pack; others → common. */
function packForClip(id: string): string {
  const m = /^(?:world\.|sticker\.)?([a-z]{2})(?:\d{2})?\./.exec(id);
  return (m && PACK_BY_CODE[m[1]!]) ?? 'pack.common';
}

function packForAsset(id: string): string {
  const m = /^(?:scenes|stickers)\/([a-z]{2})-\d{2}/.exec(id);
  if (m) return PACK_BY_CODE[m[1]!] ?? 'pack.common';
  if (id.startsWith('forest/')) return 'pack.animal-forest';
  if (id.startsWith('town/')) return 'pack.color-town';
  if (id.startsWith('island/')) return 'pack.number-island';
  return 'pack.common';
}

/** Transcripts for clips whose captions cover a whole sequence, so they can't be derived. */
const MANUAL_TRANSCRIPTS: Record<string, { ar?: string; en?: string }> = {
  'af01.story.outro_mixed': { ar: 'برافو! عرفنا القطة والكلب…' },
  'af01.a2.where_mixed': { ar: 'فين الـ…' },
};

const refs = emptyRefs();
for (const w of Object.values(rawContent.worlds)) collectWorldRefs(WorldDefinition.parse(w), refs);
for (const l of Object.values(rawContent.levels)) collectLevelRefs(LevelDefinition.parse(l), refs);
collectUiAudioRefs(UiAudioFile.parse(rawContent.uiAudio), refs);
const vocabulary = VocabularyFile.parse(rawContent.vocabulary).entries;
for (const v of vocabulary) {
  addClip(refs, v.audio, 'ar');
  addClip(refs, v.audio, 'en');
  refs.assets.add(v.picture);
}

// Derive transcripts from any single-clip LocalizedAudioRef's caption.
const transcripts = new Map<string, { ar?: string; en?: string }>();
function walk(node: unknown) {
  if (Array.isArray(node)) return node.forEach(walk);
  if (!node || typeof node !== 'object') return;
  const o = node as Record<string, unknown>;
  const caption = o.caption as { ar?: string; en?: string } | undefined;
  if (Array.isArray(o.ar) && Array.isArray(o.en) && caption) {
    for (const lang of ['ar', 'en'] as const) {
      const seq = o[lang] as string[];
      if (seq.length === 1 && caption[lang]) {
        const t = transcripts.get(seq[0]!) ?? {};
        t[lang] ??= caption[lang];
        transcripts.set(seq[0]!, t);
      }
    }
  }
  Object.values(o).forEach(walk);
}
walk([rawContent.worlds, rawContent.levels, rawContent.uiAudio]);
for (const v of vocabulary) transcripts.set(v.audio, { ar: v.written.ar, en: v.written.en });
for (const [id, t] of Object.entries(MANUAL_TRANSCRIPTS)) transcripts.set(id, { ...transcripts.get(id), ...t });

const planned = () => ({ status: 'planned' as const, by: null, date: null, notes: '' });

const audio = readJson<AudioManifest>('audio-manifest.json');
const byId = new Map(audio.clips.map((c) => [c.id, c]));
let addedClips = 0;
let addedSlots = 0;
for (const [id, slots] of [...refs.clipLangs].sort(([a], [b]) => a.localeCompare(b))) {
  const isSfx = slots.has('common');
  let entry = byId.get(id);
  if (!entry) {
    entry = {
      id,
      kind: isSfx ? 'sfx' : 'voice',
      files: {},
      transcript: {},
      source: 'unassigned',
      licence: 'unassigned',
      review: {},
      durationMs: {},
      pack: packForClip(id),
    } satisfies AudioClipEntry;
    audio.clips.push(entry);
    byId.set(id, entry);
    addedClips++;
  }
  for (const slot of slots) {
    if (entry.files[slot]) continue;
    entry.files[slot] = `assets/audio/${slot}/${id}.mp3`;
    entry.review[slot] ??= planned();
    addedSlots++;
  }
  const t = transcripts.get(id);
  if (t) entry.transcript = { ...t, ...entry.transcript };
}
audio.clips.sort((a, b) => a.id.localeCompare(b.id));
writeJson('audio-manifest.json', audio);

const assets = readJson<AssetManifest>('assets-manifest.json');
const knownAssets = new Set(assets.assets.map((a) => a.id));
let addedAssets = 0;
for (const id of [...refs.assets].sort()) {
  if (knownAssets.has(id)) continue;
  assets.assets.push({
    id,
    type: id.startsWith('stickers/') ? 'sticker' : id.startsWith('scenes/') ? 'background' : 'image',
    pack: packForAsset(id),
    files: [],
    displaySize1x: null,
    source: 'unassigned',
    creator: null,
    aiAssisted: false,
    licence: { type: 'unassigned', url: null, attributionRequired: false },
    status: 'planned',
    review: { by: null, date: null, notes: '' },
  });
  addedAssets++;
}
assets.assets.sort((a, b) => a.id.localeCompare(b.id));
writeJson('assets-manifest.json', assets);

console.log(
  `manifests: +${addedClips} clip(s), +${addedSlots} language file slot(s), +${addedAssets} asset(s) marked planned`,
);
