/** Pure viewport/orientation helpers shared by the Phaser host and layout code (04 §7). */

export type Orientation = 'portrait' | 'landscape';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Viewport {
  /** CSS pixels. */
  width: number;
  height: number;
  orientation: Orientation;
  /** Area free of notches/home indicator, in CSS pixels. */
  safe: Rect;
  /** Game units per CSS pixel (device pixel ratio, capped). Scenes multiply CSS sizes by this. */
  scale: number;
}

export const MAX_RENDER_SCALE = 2;
/** Child controls are never smaller than this many CSS pixels (03 §0). */
export const MIN_CHILD_TARGET_PX = 64;

export function orientationOf(width: number, height: number): Orientation {
  return width >= height ? 'landscape' : 'portrait';
}

export function computeViewport(width: number, height: number, insets: Insets, devicePixelRatio = 1): Viewport {
  const w = Math.max(0, Math.round(width));
  const h = Math.max(0, Math.round(height));
  const safe: Rect = {
    x: insets.left,
    y: insets.top,
    width: Math.max(0, w - insets.left - insets.right),
    height: Math.max(0, h - insets.top - insets.bottom),
  };
  return {
    width: w,
    height: h,
    orientation: orientationOf(w, h),
    safe,
    scale: Math.min(MAX_RENDER_SCALE, Math.max(1, devicePixelRatio)),
  };
}

export function rectInside(inner: Rect, outer: Rect, tolerance = 0.5): boolean {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.width <= outer.x + outer.width + tolerance &&
    inner.y + inner.height <= outer.y + outer.height + tolerance
  );
}

/**
 * Places `count` equally sized targets in a row (landscape) or column (portrait) centred in the
 * safe area, shrinking spacing before size and never going below `minSize`.
 */
export function distributeTargets(vp: Viewport, count: number, preferredSize: number, minSize = MIN_CHILD_TARGET_PX): Rect[] {
  if (count <= 0) return [];
  const horizontal = vp.orientation === 'landscape';
  const along = horizontal ? vp.safe.width : vp.safe.height;
  const across = horizontal ? vp.safe.height : vp.safe.width;
  const gapMin = 16;
  const maxByAlong = (along - gapMin * (count + 1)) / count;
  const size = Math.max(minSize, Math.min(preferredSize, maxByAlong, across * 0.6));
  const gap = Math.max(gapMin, (along - size * count) / (count + 1));
  return Array.from({ length: count }, (_, i) => {
    const offset = gap + i * (size + gap);
    const cross = (across - size) / 2;
    return horizontal
      ? { x: vp.safe.x + offset, y: vp.safe.y + cross, width: size, height: size }
      : { x: vp.safe.x + cross, y: vp.safe.y + offset, width: size, height: size };
  });
}
