import { describe, expect, it } from 'vitest';
import { clearOfCorners, countLayout, gridIn, itemsAndTargets, layoutProblems, pairsLayout } from './layout';
import { belowHud, computeViewport } from './viewport';

const SIZES: Array<[number, number]> = [
  [360, 640],
  [390, 844],
  [640, 360],
  [844, 390],
  [768, 1024],
  [1440, 900],
];
const area = (w: number, h: number) => clearOfCorners(belowHud(computeViewport(w, h, { top: 0, right: 0, bottom: 0, left: 0 })));
const named = (prefix: string, rects: Array<{ x: number; y: number; width: number; height: number }>) => rects.map((rect, i) => ({ id: `${prefix}${i}`, rect }));

describe('layout presets (04 §7)', () => {
  for (const [w, h] of SIZES) {
    const vp = area(w, h);
    it(`${w}×${h}: every preset keeps targets ≥ 64 px and inside the safe area`, () => {
      for (const [items, targets] of [[3, 3], [4, 1], [6, 3], [6, 1]] as const) {
        const l = itemsAndTargets(vp, items, targets);
        expect(layoutProblems([...named('i', l.items), ...named('t', l.targets)], vp), `drag ${items}/${targets}`).toEqual([]);
      }
      for (const n of [2, 3, 4]) {
        const l = pairsLayout(vp, n);
        expect(layoutProblems([...named('l', l.left), ...named('r', l.right)], vp), `pairs ${n}`).toEqual([]);
      }
      for (const n of [2, 3, 5]) {
        const a = countLayout(vp, n, { choices: 3 });
        const b = countLayout(vp, n, { basket: true });
        expect(layoutProblems([...named('o', a.objects), ...named('c', a.side), ...named('b', b.side)], vp), `count ${n}`).toEqual([]);
      }
    });
  }

  it('match pairs: two rows in portrait, two columns in landscape', () => {
    const p = pairsLayout(area(390, 844), 3);
    expect(new Set(p.left.map((r) => r.y)).size).toBe(1);
    expect(p.right[0]!.y).toBeGreaterThan(p.left[0]!.y);
    const l = pairsLayout(area(1440, 900), 4);
    expect(new Set(l.left.map((r) => r.x)).size).toBe(1);
    expect(l.right[0]!.x).toBeGreaterThan(l.left[0]!.x);
  });

  it('gridIn picks the column count that gives the biggest targets and never overlaps', () => {
    const rects = gridIn({ x: 0, y: 0, width: 400, height: 400 }, 4, 300);
    expect(rects[0]!.width).toBeGreaterThan(150);
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!;
        const b = rects[j]!;
        const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlap).toBe(false);
      }
  });
});
