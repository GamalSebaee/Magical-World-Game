/**
 * Layout presets (04 §7): pure functions from the play area (CSS px, below the HUD) to object
 * rects for portrait and landscape. Spacing shrinks before targets do, and targets never go below
 * the child minimum; `layoutProblems` reports any rect that is too small or off the safe area so
 * tests (and dev builds) can assert it.
 */
import { MIN_CHILD_TARGET_PX, rectInside, type Rect, type Viewport } from './viewport';

const GAP = 16;
/** Nono sits in the bottom-start corner and the skip arrow in the bottom-end corner (03 C8). */
const CORNER_PX = 100;

/**
 * The play area clear of the bottom corners: portrait gives up a bottom strip, landscape gives up
 * both side strips, so no target ever sits under Nono or the skip arrow.
 */
export function clearOfCorners(vp: Viewport): Viewport {
  const s = vp.safe;
  const safe =
    vp.orientation === 'portrait'
      ? { ...s, height: Math.max(0, s.height - CORNER_PX) }
      : { ...s, x: s.x + CORNER_PX, width: Math.max(0, s.width - CORNER_PX * 2) };
  return { ...vp, safe };
}

/** Splits the safe area: portrait top/bottom, landscape start/end (left/right). */
export function splitArea(vp: Viewport, firstShare: number): [Rect, Rect] {
  const s = vp.safe;
  if (vp.orientation === 'portrait') {
    const h = Math.round(s.height * firstShare);
    return [
      { x: s.x, y: s.y, width: s.width, height: h },
      { x: s.x, y: s.y + h, width: s.width, height: s.height - h },
    ];
  }
  const w = Math.round(s.width * firstShare);
  return [
    { x: s.x, y: s.y, width: w, height: s.height },
    { x: s.x + w, y: s.y, width: s.width - w, height: s.height },
  ];
}

/**
 * `count` equal squares in a grid inside `area`, choosing the column count that gives the largest
 * squares (up to `preferred`), centred. `cols` forces a column count (1 = a column, count = a row).
 */
export function gridIn(area: Rect, count: number, preferred: number, opts: { min?: number; cols?: number; gap?: number } = {}): Rect[] {
  if (count <= 0) return [];
  const min = opts.min ?? MIN_CHILD_TARGET_PX;
  const gap = opts.gap ?? GAP;
  const sizeFor = (cols: number) => {
    const rows = Math.ceil(count / cols);
    return Math.min(preferred, (area.width - gap * (cols + 1)) / cols, (area.height - gap * (rows + 1)) / rows);
  };
  let cols = opts.cols ?? 1;
  if (!opts.cols) {
    for (let c = 2; c <= count; c++) if (sizeFor(c) > sizeFor(cols) + 0.5) cols = c;
  }
  const rows = Math.ceil(count / cols);
  const size = Math.max(min, Math.floor(sizeFor(cols)));
  const gx = Math.max(gap / 2, (area.width - size * cols) / (cols + 1));
  const gy = Math.max(gap / 2, (area.height - size * rows) / (rows + 1));
  return Array.from({ length: count }, (_, i) => {
    const r = Math.floor(i / cols);
    const inRow = r === rows - 1 ? count - r * cols : cols;
    // Centre a short last row.
    const rowOffset = ((cols - inRow) * (size + gx)) / 2;
    const c = i % cols;
    return { x: area.x + rowOffset + gx + c * (size + gx), y: area.y + gy + r * (size + gy), width: size, height: size };
  });
}

/** drag_drop "items-and-targets": items first (top / start side), larger targets after. */
export function itemsAndTargets(vp: Viewport, items: number, targets: number): { items: Rect[]; targets: Rect[] } {
  const [a, b] = splitArea(vp, vp.orientation === 'portrait' ? 0.45 : 0.5);
  return { items: gridIn(a, items, 150), targets: gridIn(b, targets, 240, { min: 96 }) };
}

/** match_pairs: portrait two rows (top / bottom), landscape two columns (start / end). */
export function pairsLayout(vp: Viewport, n: number): { left: Rect[]; right: Rect[] } {
  const [a, b] = splitArea(vp, 0.5);
  const pref = 180;
  if (vp.orientation === 'portrait') return { left: gridIn(a, n, pref, { cols: n }), right: gridIn(b, n, pref, { cols: n }) };
  // A single column per side, unless the screen is too short for it (then 2 per row).
  const fits = (a.height - GAP * (n + 1)) / n >= MIN_CHILD_TARGET_PX;
  const cols = fits ? 1 : 2;
  return { left: gridIn(a, n, pref, { cols }), right: gridIn(b, n, pref, { cols }) };
}

/** count_objects: objects first; the numeral cards (how_many) or the basket (tap_n) after. */
export function countLayout(vp: Viewport, objects: number, side: { choices: number } | { basket: true }): { objects: Rect[]; side: Rect[] } {
  const [a, b] = splitArea(vp, vp.orientation === 'portrait' ? 0.62 : 0.6);
  return {
    objects: gridIn(a, objects, 160),
    side: 'basket' in side ? gridIn(b, 1, 220, { min: 120 }) : gridIn(b, side.choices, 150, { min: 80 }),
  };
}

/** Small, non-interactive slots inside a container (placed items in a box, carrots in the basket). */
export function slotsInside(container: Rect, count: number, of: number): Rect[] {
  if (count <= 0) return [];
  const inner = { x: container.x + container.width * 0.12, y: container.y + container.height * 0.3, width: container.width * 0.76, height: container.height * 0.6 };
  const cols = Math.min(of, Math.max(1, Math.ceil(Math.sqrt(of * (inner.width / Math.max(1, inner.height))))));
  const rows = Math.ceil(of / cols);
  const size = Math.min(inner.width / cols, inner.height / rows);
  return Array.from({ length: count }, (_, i) => ({
    x: inner.x + (inner.width - size * cols) / 2 + (i % cols) * size,
    y: inner.y + (inner.height - size * rows) / 2 + Math.floor(i / cols) * size,
    width: size,
    height: size,
  }));
}

/** Problems with interactive rects: smaller than the child minimum, or outside the safe area. */
export function layoutProblems(rects: Array<{ id: string; rect: Rect }>, vp: Viewport, min = MIN_CHILD_TARGET_PX): string[] {
  const out: string[] = [];
  for (const { id, rect } of rects) {
    if (rect.width < min - 0.5 || rect.height < min - 0.5) out.push(`${id}: ${Math.round(rect.width)}×${Math.round(rect.height)} < ${min}px`);
    if (!rectInside(rect, vp.safe, 1)) out.push(`${id}: outside the safe area`);
  }
  return out;
}
