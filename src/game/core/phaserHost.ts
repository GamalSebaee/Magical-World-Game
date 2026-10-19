import type * as PhaserNS from 'phaser';
import { computeViewport, type Insets, type Viewport } from './viewport';

/** Event emitted on `game.events` whenever the viewport changes. Scenes re-run their layout. */
export const VIEWPORT_EVENT = 'mwg:viewport';
/** Game registry key holding the latest Viewport. */
export const VIEWPORT_REGISTRY_KEY = 'mwg:viewport';

export interface HostStats {
  gamesCreated: number;
  attached: boolean;
  sleeping: boolean;
  canvasesInDocument: number;
  attachCount: number;
  detachCount: number;
  viewport?: Viewport;
}

type SceneClass = new () => PhaserNS.Scene;
/** Scene modules import Phaser, so they are loaded lazily, after Phaser itself. */
type SceneLoader = () => Promise<SceneClass>;

/**
 * Owns the single Phaser.Game for the app's lifetime (02 §4.1, decision D3). Routes attach the
 * canvas to their container and detach it on unmount; the game sleeps while detached so
 * WebGL contexts are never created and destroyed repeatedly.
 */
class PhaserHost {
  private game?: PhaserNS.Game;
  private booting?: Promise<PhaserNS.Game>;
  private container?: HTMLElement;
  private parking?: HTMLElement;
  private resizeObserver?: ResizeObserver;
  private viewport?: Viewport;
  private readonly sceneLoaders = new Map<string, SceneLoader>();
  private stats = { gamesCreated: 0, attachCount: 0, detachCount: 0 };
  private readonly onWindowResize = () => this.measure();

  /** Scenes must be registered before the first attach. Re-registering a key is a no-op. */
  registerScene(key: string, load: SceneLoader) {
    if (this.game && !this.sceneLoaders.has(key)) {
      throw new Error(`Scene "${key}" registered after Phaser booted`);
    }
    this.sceneLoaders.set(key, load);
  }

  async attach(container: HTMLElement, sceneKey: string, data?: object): Promise<void> {
    this.stats.attachCount++;
    this.container = container;
    const game = await this.ensureGame(container);
    // The route may have unmounted (or another route attached) while Phaser was booting.
    if (this.container !== container) return;

    if (game.canvas.parentElement !== container) container.appendChild(game.canvas);
    game.loop.wake();
    this.observe(container);
    this.measure();

    for (const s of game.scene.getScenes(true)) {
      if (s.scene.key !== sceneKey) s.scene.stop();
    }
    const scene = game.scene.getScene(sceneKey);
    if (!scene) throw new Error(`Scene "${sceneKey}" is not registered`);
    if (scene.scene.isActive()) scene.scene.restart(data);
    else game.scene.start(sceneKey, data);
  }

  detach(container: HTMLElement) {
    if (this.container !== container) return;
    this.stats.detachCount++;
    this.container = undefined;
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.onWindowResize);
    window.visualViewport?.removeEventListener('resize', this.onWindowResize);
    const game = this.game;
    if (!game) return;
    for (const s of game.scene.getScenes(true)) s.scene.stop();
    game.loop.sleep();
    this.parkingLot().appendChild(game.canvas);
  }

  getViewport(): Viewport | undefined {
    return this.viewport;
  }

  getGame(): PhaserNS.Game | undefined {
    return this.game;
  }

  getStats(): HostStats {
    return {
      ...this.stats,
      attached: !!this.container,
      sleeping: !!this.game && !this.game.loop.running,
      canvasesInDocument: document.querySelectorAll('canvas').length,
      viewport: this.viewport,
    };
  }

  private ensureGame(container: HTMLElement): Promise<PhaserNS.Game> {
    if (this.game) return Promise.resolve(this.game);
    this.booting ??= (async () => {
      const mod = await import('phaser');
      const Phaser = ((mod as { default?: typeof PhaserNS }).default ?? mod) as typeof PhaserNS;
      const scenes = await Promise.all(
        [...this.sceneLoaders].map(async ([key, load]) => [key, await load()] as const),
      );
      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: container,
        backgroundColor: '#e8f6ff',
        // Manual sizing: the canvas moves between route containers, so we size it ourselves.
        scale: { mode: Phaser.Scale.NONE, width: 1, height: 1 },
        // All sound goes through the app's AudioPlaybackService (06 §3, decision D5).
        audio: { noAudio: true },
        render: { antialias: true, roundPixels: false },
        fps: { target: 60, min: 30 },
        input: { activePointers: 2 },
        banner: false,
      });
      await new Promise<void>((resolve) => {
        if (game.isBooted) resolve();
        else game.events.once(Phaser.Core.Events.READY, () => resolve());
      });
      // Added explicitly (not via config) under their registered keys, none auto-started.
      for (const [key, SceneClass] of scenes) game.scene.add(key, SceneClass, false);
      // SceneManager may queue additions until its next step; wait until every key resolves.
      for (let frame = 0; scenes.some(([key]) => !game.scene.getScene(key)); frame++) {
        if (frame > 120) throw new Error('Phaser scenes failed to register');
        await new Promise<void>((resolve) => game.events.once(Phaser.Core.Events.POST_STEP, () => resolve()));
      }
      this.game = game;
      this.stats.gamesCreated++;
      return game;
    })();
    return this.booting;
  }

  private observe(container: HTMLElement) {
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.measure());
    this.resizeObserver.observe(container);
    window.addEventListener('resize', this.onWindowResize);
    window.visualViewport?.addEventListener('resize', this.onWindowResize);
  }

  private measure() {
    const game = this.game;
    const container = this.container;
    if (!game || !container) return;
    const rect = container.getBoundingClientRect();
    const vp = computeViewport(rect.width, rect.height, readSafeAreaInsets(container), window.devicePixelRatio);
    const prev = this.viewport;
    if (prev && prev.width === vp.width && prev.height === vp.height && prev.scale === vp.scale &&
        prev.safe.x === vp.safe.x && prev.safe.y === vp.safe.y &&
        prev.safe.width === vp.safe.width && prev.safe.height === vp.safe.height) {
      return;
    }
    this.viewport = vp;
    // Render at device resolution (capped), display at CSS size. In Scale.NONE Phaser does not
    // style the canvas, so we do, then refresh its bounds so pointer coordinates map correctly.
    game.scale.resize(Math.max(1, vp.width * vp.scale), Math.max(1, vp.height * vp.scale));
    const style = game.canvas.style;
    style.width = `${vp.width}px`;
    style.height = `${vp.height}px`;
    style.display = 'block';
    game.scale.updateBounds();
    // NONE mode never recomputes displayScale; input maps CSS → game pixels through it.
    game.scale.displayScale.set(vp.scale, vp.scale);
    // Scenes started later read the current viewport from the registry in create().
    game.registry.set(VIEWPORT_REGISTRY_KEY, vp);
    game.events.emit(VIEWPORT_EVENT, vp);
  }

  private parkingLot(): HTMLElement {
    if (!this.parking) {
      this.parking = document.createElement('div');
      this.parking.id = 'mwg-phaser-parking';
      this.parking.hidden = true;
      this.parking.setAttribute('aria-hidden', 'true');
      document.body.appendChild(this.parking);
    }
    return this.parking;
  }
}

/** Reads env(safe-area-inset-*) as numbers via a probe element. */
export function readSafeAreaInsets(within: HTMLElement): Insets {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
  within.appendChild(probe);
  const cs = getComputedStyle(probe);
  const insets = {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
  probe.remove();
  return insets;
}

export const phaserHost = new PhaserHost();
