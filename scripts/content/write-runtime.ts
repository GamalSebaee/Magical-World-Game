/**
 * Writes the slim runtime manifests the app ships (D23) from the full manifests.
 * Usage: tsx scripts/content/write-runtime.ts   (sync-manifests and gen-placeholders run it too)
 */
import type { AssetManifest, AudioManifest } from '../../src/content/schema';
import { runtimeAssets, runtimeAudio } from '../../src/services/content/runtimeManifests';
import { readJson, writeJson } from './lib';

export function writeRuntimeManifests() {
  writeJson('runtime/audio.json', runtimeAudio(readJson<AudioManifest>('audio-manifest.json')));
  writeJson('runtime/assets.json', runtimeAssets(readJson<AssetManifest>('assets-manifest.json')));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeRuntimeManifests();
  console.log('runtime manifests written');
}
