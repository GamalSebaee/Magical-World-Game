/**
 * All content, for tooling and tests: the app's content (`app.ts`) plus skills and the full audio
 * and asset manifests (transcripts, licences, review state). The app itself imports `app.ts` only.
 */
import skills from './skills.json';
import audioManifest from './audio-manifest.json';
import assetsManifest from './assets-manifest.json';
import { appContent, type AppContentBundle } from './app';

export interface RawContentBundle extends AppContentBundle {
  skills: unknown;
  audioManifest: unknown;
  assetsManifest: unknown;
}

export const rawContent: RawContentBundle = { ...appContent, skills, audioManifest, assetsManifest };
