/**
 * Service worker registration and honest offline-ready reporting (03 C1, 08 §7).
 *
 * Precaching is atomic: a service worker only reaches `activated` after every precached file was
 * stored. So "ready offline" means an activated worker controls (or will control) this page. While
 * a worker is installing we report `installing`; we never claim ready early.
 */
export type OfflineStatus =
  | { state: 'dev' }
  | { state: 'unsupported' }
  | { state: 'installing' }
  | { state: 'ready'; updateWaiting: boolean }
  | { state: 'error'; message: string };

type Listener = (s: OfflineStatus) => void;

let status: OfflineStatus = { state: 'installing' };
let registration: ServiceWorkerRegistration | undefined;
const listeners = new Set<Listener>();
let started = false;

function set(next: OfflineStatus) {
  status = next;
  for (const l of listeners) l(status);
}

export function getOfflineStatus(): OfflineStatus {
  return status;
}

export function subscribeOfflineStatus(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function refresh(reg: ServiceWorkerRegistration) {
  if (reg.active) set({ state: 'ready', updateWaiting: !!reg.waiting });
  else if (reg.installing || reg.waiting) set({ state: 'installing' });
}

function track(worker: ServiceWorker | null, reg: ServiceWorkerRegistration) {
  worker?.addEventListener('statechange', () => {
    if (worker.state === 'redundant' && !reg.active) set({ state: 'error', message: 'Offline caching failed' });
    else refresh(reg);
  });
}

export async function registerServiceWorker(opts: { enabled: boolean; url?: string }): Promise<void> {
  if (started) return;
  started = true;
  if (!opts.enabled) return set({ state: 'dev' });
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return set({ state: 'unsupported' });
  try {
    const reg = await navigator.serviceWorker.register(opts.url ?? '/sw.js', { scope: '/' });
    registration = reg;
    refresh(reg);
    track(reg.installing, reg);
    track(reg.waiting, reg);
    reg.addEventListener('updatefound', () => {
      track(reg.installing, reg);
      refresh(reg);
    });
  } catch (err) {
    set({ state: 'error', message: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Activates a waiting update. Only call where no level is in progress (splash, profiles, map);
 * the page reloads once the new worker takes control.
 */
export function applyUpdateIfWaiting(): boolean {
  const waiting = registration?.waiting;
  if (!waiting) return false;
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  waiting.postMessage({ type: 'SKIP_WAITING' });
  return true;
}
