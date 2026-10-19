import * as Phaser from 'phaser';
import type { ActivityDefinition } from '@content/schema';
import type { ActivitySnapshot } from '@game/core/engine/ActivityController';
import type { ActivitySceneAdapter } from '@game/core/sceneTypes';
import { fitInto, sparkle, textureFor } from '@game/core/scenes/common';
import type { Rect, Viewport } from '@game/core/viewport';

type Def = Extract<ActivityDefinition, { mechanic: 'speak_repeat' }>;

/**
 * speak_repeat scene (04 §4.6): the picture of the word, large. The listen/record/hear-me
 * controls are an accessible React overlay (03 C9), laid out in the space this leaves free:
 * the bottom of the screen in portrait, the physical right in landscape (in both directions,
 * so picture and controls can never overlap).
 */
export function speakRepeatScene(scene: Phaser.Scene): ActivitySceneAdapter {
  let pic!: Phaser.GameObjects.Image;
  let card!: Phaser.GameObjects.Graphics;
  let rect: Rect = { x: 0, y: 0, width: 0, height: 0 };
  let vp: Viewport | undefined;
  let lastSeq = 0;
  let reducedMotion = false;

  return {
    assetIds: (c) => [(c.def as Def).picture],

    create(c) {
      reducedMotion = c.reducedMotion;
      card = scene.add.graphics().setDepth(4);
      pic = scene.add.image(0, 0, textureFor(scene, (c.def as Def).picture)).setDepth(5);
    },

    layout(v) {
      vp = v;
      const s = v.scale;
      const { safe } = v;
      // `safe` already excludes the HUD row.
      if (v.orientation === 'portrait') {
        const size = Math.min(safe.width - 48, safe.height * 0.5);
        rect = { x: safe.x + (safe.width - size) / 2, y: safe.y + 8, width: size, height: size };
      } else {
        const size = Math.min((safe.width - 48) * 0.5, safe.height - 24);
        rect = { x: safe.x + 24, y: safe.y + (safe.height - size) / 2, width: size, height: size };
      }
      card.clear();
      card.fillStyle(0xffffff, 0.95).fillRoundedRect(rect.x * s, rect.y * s, rect.width * s, rect.height * s, 36 * s);
      card.lineStyle(6 * s, 0x2d3047).strokeRoundedRect(rect.x * s, rect.y * s, rect.width * s, rect.height * s, 36 * s);
      fitInto(pic, rect, s, 20);
    },

    render(snap: ActivitySnapshot) {
      if (snap.last && snap.last.seq !== lastSeq && vp && snap.last.anim === 'celebrate') {
        lastSeq = snap.last.seq;
        sparkle(scene, pic.x, pic.y, vp.scale, reducedMotion);
      }
    },

    targetRect: () => rect,
    describe: () => [{ id: 'picture', rect, state: 'shown' }],
    destroy() {},
  };
}
