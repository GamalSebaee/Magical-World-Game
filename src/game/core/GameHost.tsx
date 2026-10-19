'use client';

import { useEffect, useRef } from 'react';
import { phaserHost } from './phaserHost';
import { FOUNDATION_SCENE } from './scenes/keys';

phaserHost.registerScene(FOUNDATION_SCENE, () => import('./scenes/FoundationScene').then((m) => m.FoundationScene));

/**
 * Client-only mount point for the shared Phaser game (02 §4.1). Phaser itself is loaded lazily on
 * first attach, so it never runs during static prerendering and never ships to screens without a
 * canvas.
 */
export function GameHost({ scene, data, className = '' }: { scene: string; data?: object; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    phaserHost.attach(el, scene, data).catch((err: unknown) => {
      console.error('[game] attach failed', err);
    });
    return () => phaserHost.detach(el);
    // `data` is start data for the scene; changing it mid-mount is not supported.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  return <div ref={ref} data-testid="game-host" className={`relative h-full w-full overflow-hidden ${className}`} />;
}
