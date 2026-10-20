import * as Phaser from 'phaser';
import type { ActivityDefinition } from '@content/schema';
import type { ActivitySnapshot } from '@game/core/engine/ActivityController';
import type { ActivitySceneAdapter, AdapterContext } from '@game/core/sceneTypes';
import { fitInto, numberOf, numeralText, placeNumeral, sparkle, textureFor, wiggle } from '@game/core/scenes/common';
import { distributeTargets, type Rect, type Viewport } from '@game/core/viewport';
import type { ListenChooseState } from './logic';

type Def = Extract<ActivityDefinition, { mechanic: 'listen_choose' }>;

interface Card {
  id: string;
  box: Phaser.GameObjects.Graphics;
  pic: Phaser.GameObjects.Image;
  /** Numeral cards show the digit in the chosen style above their dots. */
  digit?: { text: Phaser.GameObjects.Text; n: number };
  zone: Phaser.GameObjects.Zone;
  rect: Rect;
}

/** listen_choose scene (04 §4.2): large picture cards in a row (landscape) or column (portrait). */
export function listenChooseScene(scene: Phaser.Scene): ActivitySceneAdapter {
  let def!: Def;
  let ctx!: AdapterContext;
  let vp: Viewport | undefined;
  let cards: Card[] = [];
  let round = -1;
  let lastSeq = 0;
  let dimOthers = false;
  let answer: string | undefined;

  const build = (m: ListenChooseState) => {
    for (const c of cards) {
      c.box.destroy();
      c.pic.destroy();
      c.digit?.text.destroy();
      c.zone.destroy();
    }
    cards = [];
    round = m.round;
    const r = def.rounds[m.round];
    if (!r) return;
    answer = r.answer;
    for (const id of m.order[m.round] ?? []) {
      const choice = r.choices.find((ch) => ch.id === id)!;
      const box = scene.add.graphics().setDepth(5);
      const pic = scene.add.image(0, 0, textureFor(scene, choice.asset)).setDepth(6);
      const zone = scene.add.zone(0, 0, 10, 10).setInteractive({ useHandCursor: true }).setDepth(20);
      zone.on('pointerup', () => ctx.controller.input({ type: 'tap', targetId: id }));
      const n = numberOf(choice.vocab);
      // Only numeral cards get a digit (a banana group must be counted, not read).
      const digit = n !== undefined && choice.asset.startsWith('numerals/') ? { text: numeralText(scene), n } : undefined;
      cards.push({ id, box, pic, digit, zone, rect: { x: 0, y: 0, width: 0, height: 0 } });
    }
  };

  const place = () => {
    if (!vp) return;
    const s = vp.scale;
    const rects = distributeTargets(vp, cards.length, 240, 120);
    cards.forEach((c, i) => {
      c.rect = rects[i]!;
      const { x, y, width, height } = c.rect;
      c.box.clear();
      c.box.fillStyle(0xffffff, 0.95).fillRoundedRect(x * s, y * s, width * s, height * s, 28 * s);
      c.box.lineStyle(6 * s, 0x2d3047).strokeRoundedRect(x * s, y * s, width * s, height * s, 28 * s);
      fitInto(c.pic, c.digit ? placeNumeral(c.digit.text, c.digit.n, ctx.digits, c.rect, s) : c.rect, s, 18);
      c.zone.setPosition((x + width / 2) * s, (y + height / 2) * s).setSize(width * s, height * s);
      c.zone.input?.hitArea.setTo(0, 0, width * s, height * s);
      const dim = dimOthers && c.id !== answer;
      c.box.setAlpha(dim ? 0.45 : 1);
      c.pic.setAlpha(dim ? 0.45 : 1);
      c.digit?.text.setAlpha(dim ? 0.45 : 1);
    });
  };

  return {
    assetIds: (c) => (c.def as Def).rounds.flatMap((r) => r.choices.map((ch) => ch.asset)),

    create(c) {
      ctx = c;
      def = c.def as Def;
    },

    layout(v) {
      vp = v;
      place();
    },

    render(snap: ActivitySnapshot) {
      const m = snap.m as ListenChooseState;
      const live = snap.phase === 'ready' || snap.phase === 'intro';
      dimOthers = live && snap.hintLevel >= 2;
      // A new round only appears once the praise for the last one has finished.
      if (m.round !== round && snap.phase !== 'feedback' && m.round < def.rounds.length) build(m);
      if (cards.length === 0 && m.round < def.rounds.length) build(m);
      place();
      if (snap.last && snap.last.seq !== lastSeq && vp) {
        lastSeq = snap.last.seq;
        const card = cards.find((cd) => cd.id === snap.last!.targetId);
        if (!card) return;
        const s = vp.scale;
        if (snap.last.anim === 'celebrate') {
          sparkle(scene, card.pic.x, card.pic.y, s, ctx.reducedMotion);
          if (!ctx.reducedMotion) scene.tweens.add({ targets: card.pic, scale: card.pic.scale * 1.15, duration: 180, yoyo: true });
        } else if (snap.last.anim === 'wiggle') wiggle(scene, card.pic, ctx.reducedMotion);
      }
    },

    targetRect: (id) => cards.find((c) => c.id === id)?.rect,

    describe: () => cards.map((c) => ({ id: c.id, rect: c.rect, state: `round-${round}` })),

    destroy() {
      cards = [];
    },
  };
}
