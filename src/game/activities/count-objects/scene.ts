import * as Phaser from 'phaser';
import type { ActivityDefinition } from '@content/schema';
import type { ActivitySnapshot } from '@game/core/engine/ActivityController';
import { clearOfCorners, countLayout, slotsInside } from '@game/core/layout';
import type { ActivitySceneAdapter, AdapterContext } from '@game/core/sceneTypes';
import { drawCard, fitInto, INK, placeZone, sparkle, SUN, textureFor, wiggle } from '@game/core/scenes/common';
import type { Rect, Viewport } from '@game/core/viewport';
import { formatDigits } from '@shared/i18n/language';
import { choiceId, type CountObjectsState } from './logic';

type Def = Extract<ActivityDefinition, { mechanic: 'count_objects' }>;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

interface Obj {
  id: string;
  img: Phaser.GameObjects.Image;
  zone: Phaser.GameObjects.Zone;
  badge: Phaser.GameObjects.Container;
  home: Rect;
  rect: Rect;
}
interface Choice {
  n: number;
  id: string;
  box: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  dots: Phaser.GameObjects.Graphics;
  zone: Phaser.GameObjects.Zone;
  rect: Rect;
}

/**
 * count_objects scene (04 §4.5). Each counted object hops and gets a numeral badge; how_many shows
 * numeral cards (digit + dot pattern) once everything is counted; tap_n sends each counted object
 * into the basket. A wrong numeral replays the count with highlights.
 */
export function countObjectsScene(scene: Phaser.Scene): ActivitySceneAdapter {
  let def!: Def;
  let ctx!: AdapterContext;
  let vp: Viewport | undefined;
  let m: CountObjectsState = { counted: [], stage: 'counting' };
  const objs: Obj[] = [];
  const choices: Choice[] = [];
  let basket: { img: Phaser.GameObjects.Image; rect: Rect } | undefined;
  let lastSeq = 0;

  const badgeFor = (n: number, k: number) => {
    const g = scene.add.graphics();
    g.fillStyle(SUN).fillCircle(0, 0, 22 * k).lineStyle(4 * k, INK).strokeCircle(0, 0, 22 * k);
    const t = scene.add.text(0, 0, formatDigits(n, ctx.digits), { fontFamily: FONT, fontSize: `${26 * k}px`, fontStyle: 'bold', color: '#2d3047' }).setOrigin(0.5);
    return [g, t];
  };

  const draw = () => {
    if (!vp) return;
    const k = vp.scale;
    const inBasket = def.ask === 'tap_n';
    const l = countLayout(vp, objs.length, inBasket ? { basket: true } : { choices: choices.length });
    objs.forEach((o, i) => (o.home = l.objects[i]!));
    if (basket) {
      basket.rect = l.side[0]!;
      fitInto(basket.img, basket.rect, k, 4);
    }
    const slots = basket ? slotsInside(basket.rect, m.counted.length, def.target) : [];
    for (const o of objs) {
      const at = m.counted.indexOf(o.id);
      o.rect = inBasket && at >= 0 ? slots[at]! : o.home;
      scene.tweens.killTweensOf(o.img);
      fitInto(o.img, o.rect, k, inBasket && at >= 0 ? 2 : 12);
      o.img.setAngle(0).setAlpha(1).setDepth(inBasket && at >= 0 ? 8 : 6);
      placeZone(o.zone, o.rect, k);
      o.badge.removeAll(true);
      if (at >= 0 && !inBasket) {
        o.badge.add(badgeFor(at + 1, k));
        o.badge.setPosition((o.rect.x + o.rect.width - 18) * k, (o.rect.y + 18) * k).setVisible(true);
      } else o.badge.setVisible(false);
    }
    const showChoices = m.stage !== 'counting';
    choices.forEach((c, i) => {
      c.rect = l.side[i]!;
      const r = c.rect;
      drawCard(c.box, r, k);
      c.label.setText(formatDigits(c.n, ctx.digits)).setFontSize(Math.round(r.height * 0.42 * k)).setPosition((r.x + r.width / 2) * k, (r.y + r.height * 0.38) * k);
      c.dots.clear().fillStyle(0x2e86de);
      const dot = Math.min(8, r.width / (c.n * 3));
      for (let d = 0; d < c.n; d++) {
        const x = r.x + r.width / 2 + (d - (c.n - 1) / 2) * dot * 2.6;
        c.dots.fillCircle(x * k, (r.y + r.height * 0.78) * k, dot * k);
      }
      placeZone(c.zone, r, k);
      for (const o of [c.box, c.label, c.dots]) o.setVisible(showChoices);
      if (showChoices) c.zone.setInteractive({ useHandCursor: true });
      else c.zone.disableInteractive();
    });
  };

  const hop = (o: Obj, delay = 0) => {
    if (ctx.reducedMotion) {
      scene.tweens.add({ targets: o.img, alpha: { from: 0.5, to: 1 }, duration: 250, delay });
      return;
    }
    const k = vp!.scale;
    scene.tweens.add({ targets: o.img, y: o.img.y - 24 * k, duration: 150, yoyo: true, ease: 'Quad.out', delay });
  };

  return {
    assetIds: (c) => {
      const d = c.def as Def;
      return [...d.objects.map((o) => o.asset), ...(d.basket ? [d.basket] : [])];
    },

    create(c) {
      ctx = c;
      def = c.def as Def;
      if (def.ask === 'tap_n') {
        basket = { img: scene.add.image(0, 0, textureFor(scene, def.basket ?? '__none')).setDepth(5), rect: { x: 0, y: 0, width: 0, height: 0 } };
      }
      for (const o of def.objects) {
        const img = scene.add.image(0, 0, textureFor(scene, o.asset)).setDepth(6);
        const zone = scene.add.zone(0, 0, 10, 10).setInteractive({ useHandCursor: true }).setDepth(20);
        zone.on('pointerup', () => ctx.controller.input({ type: 'tap', targetId: o.id }));
        const badge = scene.add.container(0, 0).setDepth(12).setVisible(false);
        const empty = { x: 0, y: 0, width: 0, height: 0 };
        objs.push({ id: o.id, img, zone, badge, home: empty, rect: empty });
      }
      if (def.ask === 'how_many') {
        for (const n of def.answerChoices ?? []) {
          const id = choiceId(n);
          const box = scene.add.graphics().setDepth(5);
          const label = scene.add.text(0, 0, '', { fontFamily: FONT, fontStyle: 'bold', color: '#2d3047' }).setOrigin(0.5).setDepth(6);
          const dots = scene.add.graphics().setDepth(6);
          const zone = scene.add.zone(0, 0, 10, 10).setInteractive({ useHandCursor: true }).setDepth(20);
          zone.on('pointerup', () => ctx.controller.input({ type: 'tap', targetId: id }));
          choices.push({ n, id, box, label, dots, zone, rect: { x: 0, y: 0, width: 0, height: 0 } });
        }
      }
    },

    layout(v) {
      vp = clearOfCorners(v);
      draw();
    },

    render(snap: ActivitySnapshot) {
      m = snap.m as CountObjectsState;
      draw();
      if (!snap.last || snap.last.seq === lastSeq || !vp) return;
      lastSeq = snap.last.seq;
      const k = vp.scale;
      const last = snap.last;
      const o = objs.find((x) => x.id === last.targetId);
      if (last.anim === 'count' && o) hop(o);
      else if (last.anim === 'bounce' && o) wiggle(scene, o.img, ctx.reducedMotion);
      else if (last.anim === 'recount') {
        // Highlight each counted object in turn, roughly in time with the spoken numbers.
        (last.targetIds ?? []).forEach((id, i) => {
          const x = objs.find((ob) => ob.id === id);
          if (x) hop(x, i * 700);
        });
        const c = choices.find((ch) => ch.id === last.targetId);
        if (c) wiggle(scene, c.label, ctx.reducedMotion);
      } else if (last.anim === 'celebrate') {
        const c = choices.find((ch) => ch.id === last.targetId);
        if (c) sparkle(scene, c.label.x, c.label.y, k, ctx.reducedMotion);
      }
      if (last.kind === 'correct' && o) sparkle(scene, o.img.x, o.img.y, k, ctx.reducedMotion);
    },

    targetRect: (id) => objs.find((o) => o.id === id)?.rect ?? choices.find((c) => c.id === id)?.rect,

    describe: () => [
      ...objs.map((o) => {
        const at = m.counted.indexOf(o.id);
        return { id: o.id, rect: o.rect, state: at >= 0 ? `counted:${at + 1}` : 'uncounted' };
      }),
      ...(m.stage !== 'counting' ? choices.map((c) => ({ id: c.id, rect: c.rect, state: 'choice' })) : []),
      ...(basket ? [{ id: 'basket', rect: basket.rect, state: `holds:${m.counted.length}` }] : []),
    ],

    destroy() {
      objs.length = 0;
      choices.length = 0;
      basket = undefined;
    },
  };
}
