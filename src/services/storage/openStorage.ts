import type { Clock, Logger } from '@shared/runtime';
import type { IdGenerator } from '@shared/ids';
import { classifyStorageError, type StorageErrorCode } from './backend';
import { IdbBackend } from './IdbBackend';
import { MemoryBackend } from './MemoryBackend';
import { createRepositories, type StorageRepositories } from './repositories';

export interface StorageStatus {
  backend: 'indexeddb' | 'memory';
  /** Why we fell back to memory, if we did. Shown to parents as a banner (08 §4). */
  degradedReason?: StorageErrorCode;
  persisted?: boolean;
}

/**
 * Opens IndexedDB, or falls back to an in-memory store so the child can keep playing
 * (private browsing, blocked storage, a newer database version).
 */
export async function openStorage(deps: {
  clock: Clock;
  ids: IdGenerator;
  logger: Logger;
  timeoutMs?: number;
}): Promise<{ repos: StorageRepositories; status: StorageStatus }> {
  try {
    const backend = await IdbBackend.open({ timeoutMs: deps.timeoutMs });
    return { repos: createRepositories(backend, deps), status: { backend: 'indexeddb' } };
  } catch (err) {
    const e = classifyStorageError(err);
    deps.logger.log('warn', 'storage', `Falling back to memory storage: ${e.message}`, { code: e.code });
    return {
      repos: createRepositories(new MemoryBackend(), deps),
      status: { backend: 'memory', degradedReason: e.code },
    };
  }
}

/** Asks the browser not to evict our data under pressure. Called after the first profile exists. */
export async function requestPersistence(): Promise<boolean | undefined> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return undefined;
  try {
    return await navigator.storage.persist();
  } catch {
    return undefined;
  }
}
