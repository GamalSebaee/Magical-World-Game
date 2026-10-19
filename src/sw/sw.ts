/// <reference lib="webworker" />
import { Serwist, type PrecacheEntry } from 'serwist';

declare const self: ServiceWorkerGlobalScope & { __SW_MANIFEST: (PrecacheEntry | string)[] };

/**
 * Offline-first service worker (02 §9, 08 §7).
 * - Precaches the whole static export: app shell, content and bundled assets. Install is atomic,
 *   so an activated worker means everything is cached.
 * - Never skips waiting on its own: an update activates only when the app asks (on a screen with
 *   no level in progress), so a running game is never served mixed versions.
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    cleanupOutdatedCaches: true,
    // Static export with trailingSlash: "/map/" is stored as "map/index.html".
    directoryIndex: 'index.html',
    ignoreURLParametersMatching: [/^utm_/, /^_rsc$/],
  },
  skipWaiting: false,
  clientsClaim: false,
  navigationPreload: false,
  fallbacks: {
    entries: [{ url: '/404.html', matcher: ({ request }) => request.destination === 'document' }],
  },
});

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});

serwist.addEventListeners();
