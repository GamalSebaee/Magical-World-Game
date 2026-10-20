import * as Phaser from 'phaser';
import type { ActivityDefinition } from '@content/schema';
import type { ActivitySnapshot } from '@game/core/engine/ActivityController';
import { clearOfCorners, pairsLayout } from '@game/core/layout';
import type { ActivitySceneAdapter, AdapterContext } from '@game/core/sceneTypes';
import { centreOf, drawCard, fitInto, numberOf, numeralText, placeNumeral, placeZone, sparkle, SUN, textureFor, wiggle } from '@game/core/scenes/common';
import type { Rect, Viewport } from '@game/core/viewport';
import { cardId, parseCard, type MatchPairsState } from './logic';

type Def = Extract<ActivityDefinition, { mechanic: 'match_pairs' }>;

interface Card {
  id: string;
  box: Phaser.GameObjects.Graphics;
  pic: Phaser.GameObjects.Image;
  digit?: { text: Phaser.GameObjects.Text; n: number };
  zone: Phaser.GameObjects.Zone;
  rect: Rect;
}

/**
 * match_pairs scene (04 §4.4): portrait two rows, landscape two columns, every card visible.
 * Matched pairs are joined by a line and dimmed; the selected card has a sun-coloured ring.
 */
export function matchPairsScene(scene: Phaser.Scene): ActivitySceneAdapter {
  let def!: Def;
  let ctx!: AdapterContext;
  let vp: Viewport | undefined;
  let m: MatchPairsState | undefined;
  const cards = new Map<string, Card>();
  let lines!: Phaser.GameObjects.Graphics;
  let lastSeq = 0;
  let live = false;

  const draw = () => {
    if (!vp || !m) return;
    const k = vp.scale;
    const l = pairsLayout(vp, def.pairs.length);
    m.left.forEach((pid, i) => (cards.get(cardId(pid, 'L'))!.rect = l.left[i]!));
    m.right.forEach((pid, i) => (cards.get(cardId(pid, 'R'))!.rect = l.right[i]!));
    for (const c of cards.values()) {
      const done = m.matched.includes(parseCard(c.id)!.pairId);
      drawCard(c.box, c.rect, k, { selected: live && m.selected === c.id, alpha: done ? 0.55 : 1, fill: done ? 0xe8f6e9 : undefined });
      fitInto(c.pic, c.digit ? placeNumeral(c.digit.text, c.digit.n, ctx.digits, c.rect, k) : c.rect, k, 14);
      c.pic.setAlpha(done ? 0.75 : 1);
      c.digit?.text.setAlpha(done ? 0.75 : 1);
      placeZone(c.zone, c.rect, k);
    }
    lines.clear();
    for (const pid of m.matched) {
      const a = centreOf(cards.get(cardId(pid, 'L'))!.rect);
      const b = centreOf(cards.get(cardId(pid, 'R'))!.rect);
      lines.lineStyle(10 * k, SUN, 0.9).lineBetween(a.x * k, a.y * k, b.x * k, b.y * k);
    }
  };

  return {
    assetIds: (c) => (c.def as Def).pairs.flatMap((p) => [p.left.asset, p.right.asset]),

    create(c) {
      ctx = c;
      def = c.def as Def;
      lines = scene.add.graphics().setDepth(4);
      for (const p of def.pairs) {
        for (const side of ['L', 'R'] as const) {
          const id = cardId(p.id, side);
          const box = scene.add.graphics().setDepth(5);
          const sideDef = side === 'L' ? p.left : p.right;
          const pic = scene.add.image(0, 0, textureFor(scene, sideDef.asset)).setDepth(6);
          // Numeral cards show their digit; other pictures of a number (a banana group) do not.
          const n = numberOf(sideDef.vocab);
          const showDigit = n !== undefined && sideDef.asset.startsWith('numerals/');
          const digit = showDigit ? { text: numeralText(scene), n } : undefined;
          const zone = scene.add.zone(0, 0, 10, 10).setInteractive({ useHandCursor: true }).setDepth(20);
          zone.on('pointerup', () => ctx.controller.input({ type: 'tap', targetId: id }));
          cards.set(id, { id, box, pic, digit, zone, rect: { x: 0, y: 0, width: 0, height: 0 } });
        }
      }
    },

    layout(v) {
      vp = clearOfCorners(v);
      draw();
    },

    render(snap: ActivitySnapshot) {
      m = snap.m as MatchPairsState;
      live = !snap.paused && (snap.phase === 'ready' || snap.phase === 'intro');
      draw();
      if (snap.last && snap.last.seq !== lastSeq && vp) {
        lastSeq = snap.last.seq;
        const k = vp.scale;
        const ids = snap.last.targetIds ?? (snap.last.targetId ? [snap.last.targetId] : []);
        for (const id of ids) {
          const c = cards.get(id);
          if (!c) continue;
          if (snap.last.anim === 'connect') sparkle(scene, c.pic.x, c.pic.y, k, ctx.reducedMotion);
          else if (snap.last.anim === 'wiggle') wiggle(scene, c.pic, ctx.reducedMotion);
        }
        if (snap.last.anim === 'select' && snap.last.targetId && !ctx.reducedMotion) {
          const c = cards.get(snap.last.targetId);
          if (c) scene.tweens.add({ targets: c.pic, scale: c.pic.scale * 1.1, duration: 120, yoyo: true });
        }
      }
    },

    targetRect: (id) => cards.get(id)?.rect,

    describe: () =>
      [...cards.values()].map((c) => ({
        id: c.id,
        rect: c.rect,
        state: m?.matched.includes(parseCard(c.id)!.pairId) ? 'matched' : m?.selected === c.id ? 'selected' : 'open',
      })),

    destroy() {
      cards.clear();
    },
  };
}
