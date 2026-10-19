import { phaserHost } from './core/phaserHost';
import { ACTIVITY_SCENE, MAP_SCENE } from './core/scenes/keys';

/**
 * Registers every scene with the shared Phaser host. Scene modules import Phaser, so they are
 * loaded lazily the first time a canvas is shown. Imported by pages that render a GameHost.
 */
phaserHost.registerScene(MAP_SCENE, () => import('./core/scenes/MapScene').then((m) => m.MapScene));
phaserHost.registerScene(ACTIVITY_SCENE, () => import('./activities/ActivityScene').then((m) => m.ActivityScene));
