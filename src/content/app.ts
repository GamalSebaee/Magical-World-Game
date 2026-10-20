/**
 * The content the app ships (02-architecture §3 rule 5): levels, worlds, shared lines, vocabulary
 * and the slim runtime manifests (D23). This is the single place that imports level and world
 * files: adding one means adding one import line here; `content:validate` fails if a file in
 * levels/ or worlds/ is not listed. Tooling uses `bundle.ts`, which adds skills and the full
 * manifests.
 */
import index from './index.json';
import vocabulary from './vocabulary.json';
import uiAudio from './ui-audio.json';
import runtimeAudio from './runtime/audio.json';
import runtimeAssets from './runtime/assets.json';

import animalForest from './worlds/animal-forest.world.json';
import colorTown from './worlds/color-town.world.json';
import numberIsland from './worlds/number-island.world.json';

import af01 from './levels/af-01.level.json';
import af02 from './levels/af-02.level.json';
import af03 from './levels/af-03.level.json';
import af04 from './levels/af-04.level.json';
import ct01 from './levels/ct-01.level.json';
import ct02 from './levels/ct-02.level.json';
import ct03 from './levels/ct-03.level.json';
import ct04 from './levels/ct-04.level.json';
import ni01 from './levels/ni-01.level.json';
import ni02 from './levels/ni-02.level.json';
import ni03 from './levels/ni-03.level.json';
import ni04 from './levels/ni-04.level.json';

export interface AppContentBundle {
  index: unknown;
  vocabulary: unknown;
  uiAudio: unknown;
  runtimeAudio: unknown;
  runtimeAssets: unknown;
  worlds: Record<string, unknown>;
  levels: Record<string, unknown>;
}

export const appContent: AppContentBundle = {
  index,
  vocabulary,
  uiAudio,
  runtimeAudio,
  runtimeAssets,
  worlds: {
    'animal-forest': animalForest,
    'color-town': colorTown,
    'number-island': numberIsland,
  },
  levels: {
    'af-01': af01,
    'af-02': af02,
    'af-03': af03,
    'af-04': af04,
    'ct-01': ct01,
    'ct-02': ct02,
    'ct-03': ct03,
    'ct-04': ct04,
    'ni-01': ni01,
    'ni-02': ni02,
    'ni-03': ni03,
    'ni-04': ni04,
  },
};
