import { getOfflineStatus } from '@services/offline/serviceWorker';
import type { StorageRepositories } from '@services/storage/repositories';
import type { StorageStatus } from '@services/storage/openStorage';
import { phaserHost } from './phaserHost';
import type { SceneObjectInfo } from './sceneTypes';

interface HookDeps {
  storage: StorageRepositories;
  storageStatus: StorageStatus;
  audio: { history: readonly string[]; sfxHistory: readonly string[]; getStatus(): unknown };
}

let activityProbe: (() => unknown) | undefined;
/** The play screen registers a probe for the current activity snapshot (test builds only). */
export function setActivityProbe(p: (() => unknown) | undefined) {
  activityProbe = p;
}

/**
 * `window.__MWG__` for Playwright (09 §1). Installed only when the `testHooks` flag is on
 * (development, or builds made with NEXT_PUBLIC_TEST_HOOKS=1). Read-only views of state.
 */
export function installTestHooks(deps: HookDeps) {
  const hooks = {
    phaser: () => phaserHost.getStats(),
    sceneObjects: (): SceneObjectInfo[] => {
      const game = phaserHost.getGame();
      if (!game) return [];
      return game.scene
        .getScenes(true)
        .flatMap((s) => ('describeObjects' in s ? (s as { describeObjects(): SceneObjectInfo[] }).describeObjects() : []));
    },
    phaserScale: () => {
      const sm = phaserHost.getGame()?.scale;
      if (!sm) return undefined;
      return {
        displayScale: { x: sm.displayScale.x, y: sm.displayScale.y },
        baseSize: { w: sm.baseSize.width, h: sm.baseSize.height },
        canvasBounds: { x: sm.canvasBounds.x, y: sm.canvasBounds.y, w: sm.canvasBounds.width, h: sm.canvasBounds.height },
      };
    },
    activity: () => activityProbe?.() as
      | {
          activityId: string;
          mechanic: string;
          phase: string;
          hintTarget?: string;
          paused: boolean;
          hintLevel: number;
          notYetCount: number;
          m: unknown;
          offerSkip: boolean;
          last?: { seq: number; anim?: string; targetId?: string; kind: string };
        }
      | undefined,
    audioHistory: () => [...deps.audio.history],
    sfxHistory: () => [...deps.audio.sfxHistory],
    audioStatus: () => deps.audio.getStatus(),
    storageStatus: () => deps.storageStatus,
    storageCounts: () => deps.storage.counts(),
    offline: () => getOfflineStatus(),
  };
  (window as unknown as { __MWG__: typeof hooks }).__MWG__ = hooks;
  return hooks;
}

export type MwgTestHooks = ReturnType<typeof installTestHooks>;
