import * as Phaser from 'phaser';
import type { ActivityDefinition } from '@content/schema';
import type { ActivitySnapshot } from '@game/core/engine/ActivityController';
import { clearOfCorners, itemsAndTargets, slotsInside } from '@game/core/layout';
import type { ActivitySceneAdapter, AdapterContext } from '@game/core/sceneTypes';
import { centreOf, fitInto, placeZone, sparkle, SUN, textureFor } from '@game/core/scenes/common';
import type { Rect, Viewport } from '@game/core/viewport';
import { accepts, DRAG_START_PX, hintDestination, resolveDrop, type DragDropState } from './logic';

type Def = Extract<ActivityDefinition, { mechanic: 'drag_drop' }>;
const SNAPBACK_MS = 250;

interface Item {
  id: string;
  img: Phaser.GameObjects.Image;
  zone: Phaser.GameObjects.Zone;
  home: Rect;
  /** Where it is drawn now (home, or a slot in its target). */
  rect: Rect;
}
interface Target {
  id: string;
  img: Phaser.GameObjects.Image;
  zone: Phaser.GameObjects.Zone;
  rect: Rect;
}
interface Drag {
  id: string;
  pointerId: number;
  start: { x: number; y: number };
  moved: boolean;
}

/**
 * drag_drop scene (04 §4.3). Pointer Events through Phaser: one active drag (the first pointer),
 * a drag starts after 6 px, a tap without movement says the item's name and picks it up for
 * tap-then-tap. Rotation, pause/backgrounding, pointer cancel or leaving the canvas cancel the
 * drag and the item slides home; only the controller's state decides what is placed.
 */
export function dragDropScene(scene: Phaser.Scene): ActivitySceneAdapter {
  let def!: Def;
  let ctx!: AdapterContext;
  let vp: Viewport | undefined;
  const items: Item[] = [];
  const targets: Target[] = [];
  let ring!: Phaser.GameObjects.Graphics;
  let placed = new Map<string, string>();
  let selected: string | undefined;
  let live = false;
  let drag: Drag | undefined;
  let lastSeq = 0;
  const s = () => vp?.scale ?? 1;

  const itemCentre = (it: Item) => ({ x: it.img.x / s(), y: it.img.y / s() });

  const slotFor = (id: string): Rect | undefined => {
    const t = targets.find((tg) => tg.id === placed.get(id));
    if (!t) return undefined;
    const onTarget = [...placed.entries()].filter(([, tid]) => tid === t.id).map(([iid]) => iid);
    const capacity = Math.max(onTarget.length, def.draggables.filter((d) => accepts(def.targets.find((x) => x.id === t.id)!, d)).length);
    return slotsInside(t.rect, onTarget.length, capacity)[onTarget.indexOf(id)];
  };

  const place = () => {
    if (!vp) return;
    const k = s();
    for (const t of targets) {
      fitInto(t.img, t.rect, k, 4);
      placeZone(t.zone, t.rect, k);
    }
    for (const it of items) {
      const slot = placed.has(it.id) ? slotFor(it.id) : undefined;
      it.rect = slot ?? it.home;
      if (drag?.id === it.id && drag.moved) continue;
      scene.tweens.killTweensOf(it.img);
      fitInto(it.img, it.rect, k, slot ? 2 : 10);
      it.img.setDepth(slot ? 8 : 10);
      placeZone(it.zone, it.home, k);
      if (slot) it.zone.disableInteractive();
      else if (!it.zone.input?.enabled) it.zone.setInteractive({ useHandCursor: true });
    }
    ring.clear();
    const sel = items.find((i) => i.id === selected);
    if (sel && live) {
      const r = sel.rect;
      ring.lineStyle(8 * k, SUN).strokeRoundedRect((r.x - 4) * k, (r.y - 4) * k, (r.width + 8) * k, (r.height + 8) * k, 24 * k);
    }
  };

  const slideHome = (it: Item) => {
    const k = s();
    const { x, y } = centreOf(it.home);
    it.img.setDepth(10);
    scene.tweens.killTweensOf(it.img);
    if (ctx.reducedMotion) it.img.setPosition(x * k, y * k);
    else scene.tweens.add({ targets: it.img, x: x * k, y: y * k, duration: SNAPBACK_MS, ease: 'Back.out' });
  };

  const cancelDrag = () => {
    const d = drag;
    drag = undefined;
    const it = d && items.find((i) => i.id === d.id);
    if (it && d.moved && !placed.has(it.id)) slideHome(it);
  };

  const onMove = (p: Phaser.Input.Pointer) => {
    if (!drag || p.id !== drag.pointerId) return;
    const it = items.find((i) => i.id === drag!.id)!;
    const dx = p.x / s() - drag.start.x;
    const dy = p.y / s() - drag.start.y;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_START_PX) return;
      drag.moved = true;
      scene.tweens.killTweensOf(it.img);
      it.img.setDepth(30);
    }
    const home = centreOf(it.home);
    it.img.setPosition((home.x + dx) * s(), (home.y + dy) * s());
  };

  const onUp = (p: Phaser.Input.Pointer) => {
    if (!drag || p.id !== drag.pointerId) return;
    const d = drag;
    drag = undefined;
    const it = items.find((i) => i.id === d.id)!;
    if (p.wasCanceled) return slideHome(it);
    if (!d.moved) return ctx.controller.input({ type: 'tap', targetId: d.id });
    const release = { x: p.x / s(), y: p.y / s() };
    const targetId = resolveDrop({
      release,
      itemStart: centreOf(it.home),
      itemNow: itemCentre(it),
      targets: targets.map((t) => ({ id: t.id, rect: t.rect, accepting: accepts(def.targets.find((x) => x.id === t.id)!, def.draggables.find((x) => x.id === it.id)!) })),
      magnet: ctx.magnet && def.magnetAssist,
    });
    ctx.controller.input({ type: 'drop', itemId: it.id, targetId });
    // Ignored (e.g. during feedback) or not accepted: back home.
    const m = ctx.controller.snapshot.m as DragDropState;
    if (!m.placed.some(([iid]) => iid === it.id)) slideHome(it);
  };

  const onLost = () => cancelDrag();

  return {
    assetIds: (c) => {
      const d = c.def as Def;
      return [...d.draggables.map((x) => x.asset), ...d.targets.map((x) => x.asset)];
    },

    create(c) {
      ctx = c;
      def = c.def as Def;
      ring = scene.add.graphics().setDepth(12);
      for (const t of def.targets) {
        const img = scene.add.image(0, 0, textureFor(scene, t.asset)).setDepth(5);
        const zone = scene.add.zone(0, 0, 10, 10).setInteractive().setDepth(15);
        zone.on('pointerup', () => {
          if (!drag && live) ctx.controller.input({ type: 'tap', targetId: t.id });
        });
        targets.push({ id: t.id, img, zone, rect: { x: 0, y: 0, width: 0, height: 0 } });
      }
      for (const d of def.draggables) {
        const img = scene.add.image(0, 0, textureFor(scene, d.asset)).setDepth(10);
        const zone = scene.add.zone(0, 0, 10, 10).setInteractive({ useHandCursor: true }).setDepth(20);
        zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
          // One drag at a time: a second finger is ignored.
          if (!live || drag || placed.has(d.id)) return;
          drag = { id: d.id, pointerId: p.id, start: { x: p.x / s(), y: p.y / s() }, moved: false };
        });
        const empty = { x: 0, y: 0, width: 0, height: 0 };
        items.push({ id: d.id, img, zone, home: empty, rect: empty });
      }
      scene.input.on(Phaser.Input.Events.POINTER_MOVE, onMove);
      scene.input.on(Phaser.Input.Events.POINTER_UP, onUp);
      scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, onLost);
      scene.input.on(Phaser.Input.Events.GAME_OUT, onLost);
    },

    layout(v) {
      // Rotation or resize mid-drag: cancel, the item goes home (04 §4.3 acceptance 2).
      cancelDrag();
      vp = clearOfCorners(v);
      const l = itemsAndTargets(vp, items.length, targets.length);
      items.forEach((it, i) => (it.home = l.items[i]!));
      targets.forEach((t, i) => (t.rect = l.targets[i]!));
      place();
    },

    render(snap: ActivitySnapshot) {
      const m = snap.m as DragDropState;
      placed = new Map(m.placed);
      selected = m.selected;
      live = !snap.paused && (snap.phase === 'ready' || snap.phase === 'intro');
      if (!live && drag) cancelDrag();
      place();
      if (snap.last && snap.last.seq !== lastSeq && vp) {
        lastSeq = snap.last.seq;
        const it = items.find((i) => i.id === snap.last!.targetId);
        if (it && snap.last.anim === 'place') {
          sparkle(scene, it.img.x, it.img.y, s(), ctx.reducedMotion);
          if (!ctx.reducedMotion) scene.tweens.add({ targets: it.img, scale: it.img.scale * 1.2, duration: 140, yoyo: true });
        } else if (it && snap.last.anim === 'select' && !ctx.reducedMotion) {
          scene.tweens.add({ targets: it.img, scale: it.img.scale * 1.12, duration: 120, yoyo: true });
        }
      }
    },

    targetRect: (id) => items.find((i) => i.id === id)?.rect ?? targets.find((t) => t.id === id)?.rect,

    demoPath(snap) {
      const dest = hintDestination(def, snap.m as DragDropState);
      const from = dest && items.find((i) => i.id === dest.itemId)?.home;
      const to = dest && targets.find((t) => t.id === dest.targetId)?.rect;
      return from && to ? { from, to } : undefined;
    },

    describe: () => [
      ...items.map((i) => ({ id: i.id, rect: i.rect, state: placed.has(i.id) ? `placed:${placed.get(i.id)}` : selected === i.id ? 'selected' : 'home' })),
      ...targets.map((t) => ({ id: t.id, rect: t.rect, state: 'target' })),
    ],

    destroy() {
      scene.input.off(Phaser.Input.Events.POINTER_MOVE, onMove);
      scene.input.off(Phaser.Input.Events.POINTER_UP, onUp);
      scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, onLost);
      scene.input.off(Phaser.Input.Events.GAME_OUT, onLost);
      drag = undefined;
      items.length = 0;
      targets.length = 0;
    },
  };
}
