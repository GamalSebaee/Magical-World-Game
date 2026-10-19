import { describe, expect, it } from 'vitest';
import { computeViewport, distributeTargets, MIN_CHILD_TARGET_PX, orientationOf, rectInside } from './viewport';

const none = { top: 0, right: 0, bottom: 0, left: 0 };
// The E2E viewport list from 09 §5, plus rotations.
const SIZES: Array<[number, number]> = [
  [360, 780],
  [390, 844],
  [412, 915],
  [768, 1024],
  [1024, 1366],
  [1440, 900],
];

describe('viewport', () => {
  it('derives orientation from aspect', () => {
    expect(orientationOf(390, 844)).toBe('portrait');
    expect(orientationOf(844, 390)).toBe('landscape');
    expect(orientationOf(500, 500)).toBe('landscape');
  });

  it('subtracts safe-area insets and caps the render scale', () => {
    const vp = computeViewport(390, 844, { top: 47, right: 0, bottom: 34, left: 0 }, 3);
    expect(vp.safe).toEqual({ x: 0, y: 47, width: 390, height: 763 });
    expect(vp.scale).toBe(2);
  });

  it.each(SIZES.flatMap(([w, h]) => [[w, h], [h, w]] as Array<[number, number]>))(
    'places 3 child targets inside the safe area at %ix%i, never below the minimum size (T-ORI)',
    (w, h) => {
      const vp = computeViewport(w, h, { top: 24, right: 0, bottom: 24, left: 0 });
      const rects = distributeTargets(vp, 3, 160);
      expect(rects).toHaveLength(3);
      for (const r of rects) {
        expect(r.width).toBeGreaterThanOrEqual(MIN_CHILD_TARGET_PX);
        expect(rectInside(r, vp.safe)).toBe(true);
      }
      // Targets do not overlap.
      const [a, b] = rects;
      if (vp.orientation === 'landscape') expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x);
      else expect(a!.y + a!.height).toBeLessThanOrEqual(b!.y);
    },
  );

  it('returns nothing for zero targets', () => {
    expect(distributeTargets(computeViewport(100, 100, none), 0, 100)).toEqual([]);
  });
});
