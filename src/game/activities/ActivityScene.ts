import * as Phaser from 'phaser';
import type { ActivitySnapshot } from '@game/core/engine/ActivityController';
import { VIEWPORT_EVENT, VIEWPORT_REGISTRY_KEY } from '@game/core/phaserHost';
import type { ActivitySceneAdapter, ActivitySceneData, AdapterContext, SceneObjectInfo } from '@game/core/sceneTypes';
import { cover, queueTextures, textureFor } from '@game/core/scenes/common';
import { ACTIVITY_SCENE } from '@game/core/scenes/keys';
import { belowHud, type Viewport } from '@game/core/viewport';
import { countObjectsScene } from './count-objects/scene';
import { dragDropScene } from './drag-drop/scene';
import { listenChooseScene } from './listen-choose/scene';
import { matchPairsScene } from './match-pairs/scene';
import { speakRepeatScene } from './speak-repeat/scene';
import { tapDiscoverScene } from './tap-discover/scene';

const ADAPTERS: Record<string, (scene: Phaser.Scene) => ActivitySceneAdapter> = {
  tap_discover: tapDiscoverScene,
  listen_choose: listenChooseScene,
  speak_repeat: speakRepeatScene,
  drag_drop: dragDropScene,
  match_pairs: matchPairsScene,
  count_objects: countObjectsScene,
};

/**
 * Hosts one activity's adapter (02 §4.2). The controller is the source of truth: the adapter
 * sends inputs and re-renders from snapshots. This scene adds what every mechanic shares: the
 * backdrop, the hint glow (level 2) and the demonstrating hand (level 3).
 */
export class ActivityScene extends Phaser.Scene {
  private ctx!: AdapterContext;
  private adapter?: ActivitySceneAdapter;
  private bg?: Phaser.GameObjects.Image;
  private glow?: Phaser.GameObjects.Arc;
  private hand?: Phaser.GameObjects.Container;
  private handTween?: Phaser.Tweens.TweenChain | Phaser.Tweens.Tween;
  private viewport?: Viewport;
  private snap?: ActivitySnapshot;
  private unsubscribe?: () => void;
  private readonly onViewport = (vp: Viewport) => this.layout(vp);

  constructor() {
    super(ACTIVITY_SCENE);
  }

  init(data: ActivitySceneData) {
    this.ctx = data.ctx;
    const make = ADAPTERS[data.ctx.def.mechanic];
    this.adapter = make?.(this);
  }

  preload() {
    const bgId = this.ctx.background;
    queueTextures(this, this.ctx.assets, [...(bgId ? [bgId] : []), ...(this.adapter?.assetIds(this.ctx) ?? [])]);
  }

  create() {
    if (this.ctx.background) this.bg = this.add.image(0, 0, textureFor(this, this.ctx.background)).setDepth(-10);
    this.adapter?.create(this.ctx);
    this.glow = this.add.circle(0, 0, 10, 0xffc93c, 0.35).setStrokeStyle(6, 0xffc93c).setDepth(40).setVisible(false);
    this.hand = this.buildHand().setDepth(60).setVisible(false);

    this.unsubscribe = this.ctx.controller.subscribe((s) => {
      this.snap = s;
      this.adapter?.render(s);
      this.updateHints();
    });
    this.game.events.on(VIEWPORT_EVENT, this.onViewport);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(VIEWPORT_EVENT, this.onViewport);
      this.unsubscribe?.();
      this.adapter?.destroy();
    });
    const vp = this.registry.get(VIEWPORT_REGISTRY_KEY) as Viewport | undefined;
    if (vp) this.layout(vp);
  }

  private layout(vp: Viewport) {
    this.viewport = vp;
    if (this.bg) cover(this.bg, vp);
    this.adapter?.layout(belowHud(vp));
    if (this.snap) this.adapter?.render(this.snap);
    this.updateHints();
  }

  /** Hint level 2: glow on the target. Level 3: a hand demonstrates (the child still acts). */
  private updateHints() {
    const s = this.snap;
    const vp = this.viewport;
    if (!s || !vp || !this.glow || !this.hand) return;
    const live = s.phase === 'ready' || s.phase === 'intro';
    const rect = s.hintTarget ? this.adapter?.targetRect(s.hintTarget) : undefined;
    const k = vp.scale;
    if (live && rect && s.hintLevel >= 2) {
      const cx = (rect.x + rect.width / 2) * k;
      const cy = (rect.y + rect.height / 2) * k;
      this.glow.setPosition(cx, cy).setRadius((Math.max(rect.width, rect.height) / 2 + 12) * k).setVisible(true);
      if (s.demo) {
        this.handTween?.remove();
        const path = this.adapter?.demoPath?.(s);
        const amp = this.ctx.reducedMotion ? 0.4 : 1;
        if (path) {
          // Drags: the hand travels from the item to where it goes, then starts again.
          const from = { x: (path.from.x + path.from.width / 2) * k, y: (path.from.y + path.from.height / 2) * k };
          const to = { x: (path.to.x + path.to.width / 2) * k, y: (path.to.y + path.to.height / 2) * k };
          this.hand.setVisible(true).setScale(k).setPosition(from.x + 20 * k, from.y + 30 * k).setAlpha(1);
          this.handTween = this.tweens.add({
            targets: this.hand,
            x: from.x + 20 * k + (to.x - from.x) * amp,
            y: from.y + 30 * k + (to.y - from.y) * amp,
            duration: 1200,
            hold: 300,
            repeatDelay: 400,
            repeat: -1,
            ease: 'Sine.inOut',
          });
        } else {
          this.hand.setVisible(true).setScale(k).setPosition(cx + 70 * k, cy + 90 * k).setAlpha(1);
          this.handTween = this.tweens.add({
            targets: this.hand,
            x: cx + 70 * k * (1 - amp) + 10 * k * amp,
            y: cy + 90 * k * (1 - amp) + 20 * k * amp,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.inOut',
          });
        }
      } else this.hideHand();
    } else {
      this.glow.setVisible(false);
      this.hideHand();
    }
  }

  private hideHand() {
    this.handTween?.remove();
    this.handTween = undefined;
    this.hand?.setVisible(false);
  }

  private buildHand() {
    const g = this.add.graphics();
    g.fillStyle(0xffffff).lineStyle(5, 0x2d3047);
    g.fillRoundedRect(-14, -46, 28, 60, 14).strokeRoundedRect(-14, -46, 28, 60, 14);
    g.fillRoundedRect(-30, -4, 60, 50, 22).strokeRoundedRect(-30, -4, 60, 50, 22);
    return this.add.container(0, 0, [g]);
  }

  describeObjects(): SceneObjectInfo[] {
    return this.adapter?.describe() ?? [];
  }
}
