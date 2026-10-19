'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { phaserHost } from './phaserHost';

/**
 * Client-only mount point for the shared Phaser game (02 §4.1). Phaser itself is loaded lazily on
 * first attach, so it never runs during static prerendering and never ships to screens without a
 * canvas.
 */
export function GameHost({
  scene,
  data,
  dataKey,
  className = '',
}: {
  scene: string;
  data?: object;
  /** Changing this restarts the scene with the current `data` without detaching the canvas. */
  dataKey?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dataRef = useRef(data);
  const mounted = useRef(false);
  // Keep the latest scene data for attach/restart without re-running those effects.
  useLayoutEffect(() => {
    dataRef.current = data;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    mounted.current = false;
    phaserHost
      .attach(el, scene, dataRef.current)
      .then(() => (mounted.current = true))
      .catch((err: unknown) => console.error('[game] attach failed', err));
    return () => {
      mounted.current = false;
      phaserHost.detach(el);
    };
  }, [scene]);

  useEffect(() => {
    if (mounted.current) phaserHost.start(scene, dataRef.current);
    // Only `dataKey` signals a restart; `scene` changes are handled by the attach effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey]);

  return <div ref={ref} data-testid="game-host" className={`relative h-full w-full overflow-hidden ${className}`} />;
}
