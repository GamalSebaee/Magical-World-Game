/**
 * Adds a `planned` entry to the audio and asset manifests for every id that content references but
 * the manifests don't list yet. Never changes or removes existing entries.
 * Usage: tsx scripts/content/sync-manifests.ts
 */
import { LevelDefinition, VocabularyFile, WorldDefinition, type AssetManifest, type AudioManifest } from '../../src/content/schema';
import { rawContent } from '../../src/content/bundle';
import { collectLevelRefs, collectWorldRefs, emptyRefs } from '../../src/services/content/references';
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

const refs = emptyRefs();
for (const w of Object.values(rawContent.worlds)) collectWorldRefs(WorldDefinition.parse(w), refs);
for (const l of Object.values(rawContent.levels)) collectLevelRefs(LevelDefinition.parse(l), refs);
for (const v of VocabularyFile.parse(rawContent.vocabulary).entries) {
  refs.clips.add(v.audio);
  refs.assets.add(v.picture);
}

const planned = { status: 'planned', by: null, date: null, notes: '' } as const;

const audio = readJson<AudioManifest>('audio-manifest.json');
const knownClips = new Set(audio.clips.map((c) => c.id));
let addedClips = 0;
for (const id of [...refs.clips].sort()) {
  if (knownClips.has(id)) continue;
  audio.clips.push({
    id,
    kind: 'voice',
    files: { ar: `assets/audio/ar/${id}.mp3`, en: `assets/audio/en/${id}.mp3` },
    transcript: {},
    source: 'unassigned',
    licence: 'unassigned',
    review: { ar: { ...planned }, en: { ...planned } },
    pack: packForClip(id),
  });
  addedClips++;
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

console.log(`manifests: +${addedClips} audio clip(s), +${addedAssets} asset(s) marked planned`);
