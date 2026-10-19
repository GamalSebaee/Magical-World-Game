import * as Phaser from 'phaser';
import { VIEWPORT_EVENT, VIEWPORT_REGISTRY_KEY } from '../phaserHost';
import { distributeTargets, type Rect, type Viewport } from '../viewport';
import { FOUNDATION_SCENE } from './keys';

export interface SceneObjectInfo {
  id: string;
  /** CSS-pixel rect, for layout assertions in tests. */
  rect: Rect;
  state: string;
}

const PLACEHOLDER_COLORS = [0x5dbb63, 0xf78fb3, 0x2e86de];

/**
 * Phase 1 placeholder scene. Proves the Phaser lifecycle: mount, adaptive layout on resize and
 * rotation, state kept across re-layout, tap input, and clean shutdown. It is replaced by the real
 * MapScene in Phase 2. Shapes are clearly placeholders, not final art.
 */
export class FoundationScene extends Phaser.Scene {
  private hotspots: Phaser.GameObjects.Arc[] = [];
  private nono?: Phaser.GameObjects.Arc;
  private bg?: Phaser.GameObjects.Rectangle;
  private label?: Phaser.GameObjects.Text;
  /** Survives re-layout: proves rotation does not reset state. */
  private readonly tapped = new Set<number>();
  private viewport?: Viewport;
  private readonly onViewport = (vp: Viewport) => this.layout(vp);

  constructor() {
    super(FOUNDATION_SCENE);
  }

  create() {
    this.tapped.clear();
    this.bg = this.add.rectangle(0, 0, 1, 1, 0xe8f6ff).setOrigin(0);
    this.hotspots = PLACEHOLDER_COLORS.map((color, i) => {
      const c = this.add.circle(0, 0, 10, color).setStrokeStyle(6, 0x2d3047);
      c.setInteractive({
        hitArea: new Phaser.Geom.Circle(10, 10, 10),
        hitAreaCallback: Phaser.Geom.Circle.Contains,
        useHandCursor: true,
      });
      c.on('pointerup', () => this.onTap(i));
      return c;
    });
    this.nono = this.add.circle(0, 0, 10, 0xffc93c).setStrokeStyle(5, 0x2d3047);
    this.label = this.add
      .text(0, 0, 'PLACEHOLDER', { fontFamily: 'system-ui, sans-serif', color: '#2d3047' })
      .setOrigin(0.5, 0)
      .setAlpha(0.5);

    this.tweens.add({ targets: this.nono, y: '-=12', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    this.game.events.on(VIEWPORT_EVENT, this.onViewport);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(VIEWPORT_EVENT, this.onViewport));

    const vp = this.registry.get(VIEWPORT_REGISTRY_KEY) as Viewport | undefined;
    if (vp) this.layout(vp);
  }

  private onTap(i: number) {
    const spot = this.hotspots[i];
    if (!spot || this.tapped.has(i)) return;
    this.tapped.add(i);
    spot.setFillStyle(0xffffff).setStrokeStyle(10, PLACEHOLDER_COLORS[i]);
    this.tweens.add({ targets: spot, scale: { from: 1.15, to: 1 }, duration: 220, ease: 'Back.out' });
  }

  /** Idempotent: positions everything from the viewport; never changes state. */
  layout(vp: Viewport) {
    this.viewport = vp;
    const s = vp.scale;
    this.bg?.setSize(vp.width * s, vp.height * s);

    const rects = distributeTargets(vp, this.hotspots.length, 160);
    rects.forEach((r, i) => {
      const spot = this.hotspots[i];
      if (!spot) return;
      spot.setPosition((r.x + r.width / 2) * s, (r.y + r.height / 2) * s);
      const radius = (r.width / 2) * s;
      spot.setRadius(radius);
      // Hit area is in local coordinates (top-left of the shape's bounds).
      (spot.input?.hitArea as Phaser.Geom.Circle | undefined)?.setTo(radius, radius, radius);
    });

    const nonoR = 36;
    this.nono?.setRadius(nonoR * s).setPosition((vp.safe.x + 24 + nonoR) * s, (vp.safe.y + vp.safe.height - 24 - nonoR) * s);
    this.label
      ?.setPosition((vp.width / 2) * s, (vp.safe.y + 8) * s)
      .setFontSize(14 * s);
  }

  /** Test hook data: object rects in CSS pixels. */
  describeObjects(): SceneObjectInfo[] {
    const s = this.viewport?.scale ?? 1;
    return this.hotspots.map((h, i) => ({
      id: `hotspot-${i}`,
      rect: { x: (h.x - h.radius) / s, y: (h.y - h.radius) / s, width: (h.radius * 2) / s, height: (h.radius * 2) / s },
      state: this.tapped.has(i) ? 'tapped' : 'idle',
    }));
  }
}
