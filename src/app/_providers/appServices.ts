import { rawContent } from '@content/bundle';
import { ContentRepository } from '@services/content/ContentRepository';
import { openStorage, type StorageStatus } from '@services/storage/openStorage';
import type { StorageRepositories } from '@services/storage/repositories';
import { registerServiceWorker } from '@services/offline/serviceWorker';
import { EventBus, type AppEvent } from '@shared/events';
import { cryptoIds, type IdGenerator } from '@shared/ids';
import { consoleLogger, defaultFlags, systemClock, type Clock, type FeatureFlags, type Logger } from '@shared/runtime';

/**
 * Everything screens and the game need, built once per page load (02 §3.1).
 * Phase 2 adds audio, mic, speech and TTS services here.
 */
export interface AppServices {
  content: ContentRepository;
  storage: StorageRepositories;
  storageStatus: StorageStatus;
  events: EventBus<AppEvent>;
  clock: Clock;
  ids: IdGenerator;
  flags: FeatureFlags;
  logger: Logger;
}

export type BootStep = 'storage' | 'settings' | 'content' | 'offline';
export const BOOT_STEPS: readonly BootStep[] = ['storage', 'settings', 'content', 'offline'];

export class BootError extends Error {
  constructor(
    readonly step: BootStep,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function bootApp(onStep: (done: BootStep) => void = () => {}): Promise<AppServices> {
  const clock = systemClock;
  const ids = cryptoIds;
  const logger = consoleLogger;
  const flags = defaultFlags();
  const events = new EventBus<AppEvent>((err, e) => logger.log('error', 'events', `handler failed for ${e.type}`, { err }));

  const { repos, status } = await openStorage({ clock, ids, logger });
  onStep('storage');

  // Settings are read here so the shell renders in the right language straight away.
  await repos.settings.get();
  onStep('settings');

  const content = new ContentRepository(rawContent);
  try {
    const index = content.index();
    if (content.worlds().length !== index.worlds.length) throw new Error('A world failed validation');
  } catch (err) {
    throw new BootError('content', 'content_invalid', err instanceof Error ? err.message : String(err));
  }
  onStep('content');

  // Not awaited: offline caching continues in the background and reports its own status.
  void registerServiceWorker({ enabled: process.env.NODE_ENV === 'production' });
  onStep('offline');

  return { content, storage: repos, storageStatus: status, events, clock, ids, flags, logger };
}
