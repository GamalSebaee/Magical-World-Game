import * as Phaser from 'phaser';
import type { AssetTable } from '../sceneTypes';
import { formatDigits, type DigitStyle } from '@shared/i18n/language';
import type { Rect, Viewport } from '../viewport';

export const textureKey = (assetId: string) => `asset:${assetId}`;
const FALLBACK = 'asset:__missing';

/**
 * Queues SVG/PNG textures for assets (rasterised at 2× their 1× size, enough for DPR ≤ 2).
 * Missing files fall back to a labelled placeholder texture so play continues (03 C8).
 */
export function queueTextures(scene: Phaser.Scene, table: AssetTable, ids: string[]) {
  for (const id of new Set(ids)) {
    const a = table[id];
    const key = textureKey(id);
    if (!a || scene.textures.exists(key)) continue;
    if (a.url.endsWith('.svg')) scene.load.svg(key, a.url, { width: a.w * 2, height: a.h * 2 });
    else scene.load.image(key, a.url);
  }
  scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
}

function onLoadError(file: Phaser.Loader.File) {
  console.warn(`[game] asset failed to load: ${file.key}`);
}

/** Texture key to use for an asset, falling back to a visible placeholder. */
export function textureFor(scene: Phaser.Scene, assetId: string | undefined): string {
  const key = assetId ? textureKey(assetId) : FALLBACK;
  if (assetId && scene.textures.exists(key)) return key;
  if (!scene.textures.exists(FALLBACK)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff).fillRoundedRect(0, 0, 200, 200, 36);
    g.lineStyle(10, 0x2d3047).strokeRoundedRect(5, 5, 190, 190, 32);
    g.fillStyle(0xf78fb3).fillCircle(100, 100, 46);
    g.generateTexture(FALLBACK, 200, 200);
    g.destroy();
  }
  return FALLBACK;
}

/** Scales an image to cover the viewport (backgrounds). */
export function cover(img: Phaser.GameObjects.Image, vp: Viewport) {
  const s = vp.scale;
  const k = Math.max((vp.width * s) / img.width, (vp.height * s) / img.height);
  img.setScale(k).setPosition((vp.width * s) / 2, (vp.height * s) / 2);
}

/** Fits an image inside a CSS rect (contain), centred; `pad` shrinks the box. */
export function fitInto(img: Phaser.GameObjects.Image, rect: Rect, s: number, pad = 0) {
  const w = (rect.width - pad * 2) * s;
  const h = (rect.height - pad * 2) * s;
  img.setScale(Math.min(w / img.width, h / img.height));
  img.setPosition((rect.x + rect.width / 2) * s, (rect.y + rect.height / 2) * s);
}

export function sparkle(scene: Phaser.Scene, x: number, y: number, s: number, reducedMotion: boolean) {
  const colors = [0xffc93c, 0xf78fb3, 0x5dbb63, 0x2e86de];
  const n = reducedMotion ? 4 : 10;
  for (let i = 0; i < n; i++) {
    const dot = scene.add.star(x, y, 5, 5 * s, 11 * s, colors[i % colors.length]).setDepth(50);
    const angle = (i / n) * Math.PI * 2;
    const dist = (reducedMotion ? 40 : 90) * s;
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      duration: reducedMotion ? 500 : 700,
      ease: 'Cubic.out',
      onComplete: () => dot.destroy(),
    });
  }
}

export function wiggle(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, reducedMotion: boolean) {
  if (reducedMotion) {
    scene.tweens.add({ targets: target, alpha: { from: 0.5, to: 1 }, duration: 300 });
    return;
  }
  scene.tweens.add({ targets: target, angle: { from: -6, to: 6 }, duration: 75, yoyo: true, repeat: 2, onComplete: () => target.setAngle(0) });
}

export function rectOf(o: { x: number; y: number; displayWidth: number; displayHeight: number }, s: number): Rect {
  return { x: (o.x - o.displayWidth / 2) / s, y: (o.y - o.displayHeight / 2) / s, width: o.displayWidth / s, height: o.displayHeight / s };
}

export const INK = 0x2d3047;
export const SUN = 0xffc93c;

/** A white rounded card with an ink outline; `selected` adds a thick sun-coloured ring. */
export function drawCard(g: Phaser.GameObjects.Graphics, r: Rect, s: number, opts: { selected?: boolean; alpha?: number; fill?: number } = {}) {
  g.clear();
  const radius = Math.min(28, r.width / 5) * s;
  g.fillStyle(opts.fill ?? 0xffffff, 0.95 * (opts.alpha ?? 1)).fillRoundedRect(r.x * s, r.y * s, r.width * s, r.height * s, radius);
  g.lineStyle((opts.selected ? 10 : 6) * s, opts.selected ? SUN : INK, opts.alpha ?? 1).strokeRoundedRect(r.x * s, r.y * s, r.width * s, r.height * s, radius);
}

/** Places a zone over a CSS rect (hit area = the whole rect). */
export function placeZone(zone: Phaser.GameObjects.Zone, r: Rect, s: number) {
  zone.setPosition((r.x + r.width / 2) * s, (r.y + r.height / 2) * s).setSize(r.width * s, r.height * s);
  zone.input?.hitArea.setTo(0, 0, r.width * s, r.height * s);
}

export const centreOf = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

const NUMERAL_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** The number a vocabulary word stands for (`numbers.3` → 3), if any. */
export const numberOf = (vocab: string | undefined) => (vocab?.startsWith('numbers.') ? Number(vocab.slice(8)) : undefined);

/**
 * Numeral cards: the digit (in the chosen digit style, 12 Q7) in the top part of the card, the
 * picture (a dot pattern) below. Returns the rect left for the picture.
 */
export function placeNumeral(text: Phaser.GameObjects.Text, n: number, digits: DigitStyle, r: Rect, s: number): Rect {
  text
    .setText(formatDigits(n, digits))
    .setFontSize(Math.round(r.height * 0.42 * s))
    .setPosition((r.x + r.width / 2) * s, (r.y + r.height * 0.3) * s)
    .setVisible(true);
  return { x: r.x, y: r.y + r.height * 0.52, width: r.width, height: r.height * 0.46 };
}

export function numeralText(scene: Phaser.Scene): Phaser.GameObjects.Text {
  return scene.add.text(0, 0, '', { fontFamily: NUMERAL_FONT, fontStyle: 'bold', color: '#2d3047' }).setOrigin(0.5).setDepth(7).setVisible(false);
}
