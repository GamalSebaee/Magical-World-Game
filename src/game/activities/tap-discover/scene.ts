import * as Phaser from 'phaser';
import type { ActivityDefinition } from '@content/schema';
import type { ActivitySnapshot } from '@game/core/engine/ActivityController';
import type { ActivitySceneAdapter, AdapterContext } from '@game/core/sceneTypes';
import { fitInto, sparkle, textureFor, wiggle } from '@game/core/scenes/common';
import { distributeTargets, type Rect, type Viewport } from '@game/core/viewport';
import type { TapDiscoverState } from './logic';

type Def = Extract<ActivityDefinition, { mechanic: 'tap_discover' }>;

/**
 * tap_discover scene (04 §4.1): animals hide behind props; tapping the prop reveals the animal.
 * Hit areas cover the whole slot (≥ the child minimum), larger than the visible art.
 */
export function tapDiscoverScene(scene: Phaser.Scene): ActivitySceneAdapter {
  let def!: Def;
  let ctx!: AdapterContext;
  let vp: Viewport | undefined;
  const slots: Array<{ id: string; hider?: Phaser.GameObjects.Image; item: Phaser.GameObjects.Image; zone: Phaser.GameObjects.Zone; rect: Rect }> = [];
  let found = new Set<string>();
  let lastSeq = 0;

  const place = (slot: (typeof slots)[number]) => {
    if (!vp) return;
    const s = vp.scale;
    const r = slot.rect;
    const isFound = found.has(slot.id);
    if (slot.hider) {
      fitInto(slot.hider, r, s, 4);
      slot.hider.setAlpha(isFound ? 0.35 : 1);
    }
    // The animal sits in the lower part of the slot; peeks out a little before it is found.
    const itemRect = { x: r.x + r.width * 0.15, y: r.y + r.height * 0.3, width: r.width * 0.7, height: r.height * 0.7 };
    fitInto(slot.item, itemRect, s);
    slot.item.setVisible(isFound).setDepth(isFound ? 10 : 1);
    slot.zone.setPosition((r.x + r.width / 2) * s, (r.y + r.height / 2) * s).setSize(r.width * s, r.height * s);
    slot.zone.input?.hitArea.setTo(0, 0, r.width * s, r.height * s);
  };

  return {
    assetIds: (c) => (c.def as Def).items.flatMap((i) => [i.asset, ...(i.hiddenBehind ? [i.hiddenBehind] : [])]),

    create(c) {
      ctx = c;
      def = c.def as Def;
      for (const it of def.items) {
        const hider = it.hiddenBehind ? scene.add.image(0, 0, textureFor(scene, it.hiddenBehind)).setDepth(5) : undefined;
        const item = scene.add.image(0, 0, textureFor(scene, it.asset)).setVisible(false);
        const zone = scene.add.zone(0, 0, 10, 10).setInteractive({ useHandCursor: true }).setDepth(20);
        zone.on('pointerup', () => c.controller.input({ type: 'tap', targetId: it.id }));
        slots.push({ id: it.id, hider, item, zone, rect: { x: 0, y: 0, width: 0, height: 0 } });
      }
    },

    layout(v) {
      vp = v;
      const rects = distributeTargets(v, slots.length, 260, 120);
      slots.forEach((slot, i) => {
        slot.rect = rects[i]!;
        place(slot);
      });
    },

    render(snap: ActivitySnapshot) {
      const m = snap.m as TapDiscoverState;
      found = new Set(m.found);
      for (const slot of slots) place(slot);
      if (snap.last && snap.last.seq !== lastSeq && vp) {
        lastSeq = snap.last.seq;
        const slot = slots.find((sl) => sl.id === snap.last!.targetId);
        if (!slot) return;
        const s = vp.scale;
        if (snap.last.anim === 'reveal') {
          const finalY = slot.item.y;
          const finalScale = slot.item.scale;
          if (!ctx.reducedMotion) {
            slot.item.setY(finalY + 40 * s).setScale(finalScale * 0.6);
            scene.tweens.add({ targets: slot.item, y: finalY, scale: finalScale, duration: 420, ease: 'Back.out' });
          }
          sparkle(scene, slot.item.x, slot.item.y, s, ctx.reducedMotion);
        } else if (snap.last.anim === 'wiggle' && slot.hider) wiggle(scene, slot.hider, ctx.reducedMotion);
      }
    },

    targetRect: (id) => slots.find((s) => s.id === id)?.rect,

    describe: () => slots.map((s) => ({ id: s.id, rect: s.rect, state: found.has(s.id) ? 'found' : 'hidden' })),

    destroy() {
      slots.length = 0;
    },
  };
}
