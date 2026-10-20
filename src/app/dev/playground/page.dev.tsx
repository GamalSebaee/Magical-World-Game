'use client';

import { Suspense } from 'react';
import { useServices } from '@features/boot/AppProvider';
import { Playground } from '@features/playground/Playground';

/**
 * `/dev/playground` (04 §9). The `.dev.tsx` extension makes this a route only in development and
 * test builds (see `pageExtensions` in next.config.ts); release builds have no such page, emit
 * none of its code, and the service worker never precaches it (D20).
 */
export default function PlaygroundPage() {
  const services = useServices();
  if (!services) return <main className="child-screen" aria-busy="true" />;
  return (
    <Suspense>
      <Playground services={services} />
    </Suspense>
  );
}
