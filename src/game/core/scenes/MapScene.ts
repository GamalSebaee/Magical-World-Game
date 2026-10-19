import * as Phaser from 'phaser';
import { VIEWPORT_EVENT, VIEWPORT_REGISTRY_KEY } from '../phaserHost';
import type { MapSceneData, SceneObjectInfo } from '../sceneTypes';
import type { Rect, Viewport } from '../viewport';
import { cover, fitInto, queueTextures, textureFor } from './common';
import { MAP_SCENE } from './keys';

/** A press that moves further or lasts longer than this is a drag, never a tap (03 C5). */
export const TAP_MAX_MOVE_PX = 12;
export const TAP_MAX_MS = 500;
const HOTSPOT_PX = 180;

/**
 * World map (C5): illustrated islands, one per playable world. Tap enters a world; drags never
 * do. Only worlds with playable levels are drawn, so there are no locked or empty destinations.
 */
export class MapScene extends Phaser.Scene {
  private data0!: MapSceneData;
  private bg?: Phaser.GameObjects.Image;
  private spots: Array<{ id: string; img: Phaser.GameObjects.Image; rect: Rect; bob?: Phaser.Tweens.Tween }> = [];
  private viewport?: Viewport;
  private selected = false;
  private readonly onViewport = (vp: Viewport) => this.layout(vp);

  constructor() {
    super(MAP_SCENE);
  }

  init(data: MapSceneData) {
    this.data0 = data;
    this.spots = [];
    this.selected = false;
  }

  preload() {
    queueTextures(this, this.data0.assets, ['map/background', ...this.data0.worlds.map((w) => w.asset)]);
  }

  create() {
    this.bg = this.add.image(0, 0, textureFor(this, 'map/background'));
    for (const w of this.data0.worlds) {
      const img = this.add.image(0, 0, textureFor(this, w.asset)).setInteractive({ useHandCursor: true });
      let down: { x: number; y: number; t: number } | undefined;
      img.on('pointerdown', (p: Phaser.Input.Pointer) => (down = { x: p.x, y: p.y, t: this.time.now }));
      img.on('pointerup', (p: Phaser.Input.Pointer) => {
        const s = this.viewport?.scale ?? 1;
        const moved = down ? Math.hypot(p.x - down.x, p.y - down.y) / s : Infinity;
        const held = down ? this.time.now - down.t : Infinity;
        down = undefined;
        if (moved > TAP_MAX_MOVE_PX || held > TAP_MAX_MS || this.selected) return;
        this.selected = true;
        this.tweens.add({ targets: img, scale: img.scale * 1.12, duration: 160, yoyo: true });
        this.data0.onSelect(w.id);
      });
      img.on('pointerout', () => (down = undefined));
      this.spots.push({ id: w.id, img, rect: { x: 0, y: 0, width: 0, height: 0 } });
    }
    this.game.events.on(VIEWPORT_EVENT, this.onViewport);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(VIEWPORT_EVENT, this.onViewport));
    const vp = this.registry.get(VIEWPORT_REGISTRY_KEY) as Viewport | undefined;
    if (vp) this.layout(vp);
  }

  layout(vp: Viewport) {
    this.viewport = vp;
    const s = vp.scale;
    if (this.bg) cover(this.bg, vp);
    const size = Math.max(120, Math.min(HOTSPOT_PX, vp.safe.width * 0.42, vp.safe.height * 0.42));
    for (const [i, spot] of this.spots.entries()) {
      const w = this.data0.worlds[i]!;
      // Keep the top bar (88 px) clear and every hotspot fully inside the safe area.
      const top = vp.safe.y + 96;
      const usableH = vp.safe.height - 96 - 24;
      const cx = vp.safe.x + size / 2 + (vp.safe.width - size) * w.x;
      const cy = top + size / 2 + Math.max(0, usableH - size) * w.y;
      spot.rect = { x: cx - size / 2, y: cy - size / 2, width: size, height: size };
      spot.bob?.remove();
      fitInto(spot.img, spot.rect, s);
      if (!this.data0.reducedMotion) {
        spot.bob = this.tweens.add({ targets: spot.img, y: spot.img.y - 8 * s, duration: 1400 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
    }
    this.data0.onLayout?.(this.describeObjects());
  }

  describeObjects(): SceneObjectInfo[] {
    return this.spots.map((s) => ({ id: s.id, rect: s.rect, state: this.selected ? 'selected' : 'idle' }));
  }
}
