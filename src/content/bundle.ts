/**
 * The single place that imports content JSON (02-architecture §3 rule 5).
 * Adding a level or world means adding one import line here; `content:validate` fails if a
 * file in levels/ or worlds/ is not listed.
 */
import index from './index.json';
import skills from './skills.json';
import vocabulary from './vocabulary.json';
import uiAudio from './ui-audio.json';
import audioManifest from './audio-manifest.json';
import assetsManifest from './assets-manifest.json';

import animalForest from './worlds/animal-forest.world.json';
import colorTown from './worlds/color-town.world.json';
import numberIsland from './worlds/number-island.world.json';

import af01 from './levels/af-01.level.json';

export interface RawContentBundle {
  index: unknown;
  skills: unknown;
  vocabulary: unknown;
  uiAudio: unknown;
  audioManifest: unknown;
  assetsManifest: unknown;
  worlds: Record<string, unknown>;
  levels: Record<string, unknown>;
}

export const rawContent: RawContentBundle = {
  index,
  skills,
  vocabulary,
  uiAudio,
  audioManifest,
  assetsManifest,
  worlds: {
    'animal-forest': animalForest,
    'color-town': colorTown,
    'number-island': numberIsland,
  },
  levels: {
    'af-01': af01,
  },
};
