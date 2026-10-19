import type { StoreName, StoreRecords } from './schema';

export type StorageErrorCode = 'quota' | 'unavailable' | 'version' | 'unknown';

export class StorageError extends Error {
  constructor(
    readonly code: StorageErrorCode,
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export function classifyStorageError(err: unknown): StorageError {
  if (err instanceof StorageError) return err;
  const name = (err as { name?: string } | null)?.name;
  if (name === 'QuotaExceededError') return new StorageError('quota', 'Storage quota exceeded', err);
  if (name === 'VersionError') return new StorageError('version', 'Database is newer than this app', err);
  if (name === 'InvalidStateError' || name === 'SecurityError' || name === 'UnknownError') {
    return new StorageError('unavailable', 'IndexedDB is unavailable', err);
  }
  return new StorageError('unknown', err instanceof Error ? err.message : String(err), err);
}

/**
 * Minimal persistence port. Repositories depend on this, never on IndexedDB directly
 * (02-architecture §3 rule 4). Implemented by IdbBackend and MemoryBackend.
 */
export interface StorageBackend {
  readonly kind: 'indexeddb' | 'memory';
  get<S extends StoreName>(store: S, key: IDBValidKey): Promise<StoreRecords[S] | undefined>;
  getAll<S extends StoreName>(store: S): Promise<StoreRecords[S][]>;
  getAllByIndex<S extends StoreName>(store: S, index: string, key: IDBValidKey): Promise<StoreRecords[S][]>;
  count(store: StoreName): Promise<number>;
  put<S extends StoreName>(store: S, record: StoreRecords[S]): Promise<void>;
  /** Inserts only if the key is absent. Returns false if it already existed (idempotent grants). */
  add<S extends StoreName>(store: S, record: StoreRecords[S]): Promise<boolean>;
  /**
   * Atomic read-modify-write of one record. `fn` must be synchronous. Returning undefined leaves
   * the record unchanged. Resolves to the stored record.
   */
  update<S extends StoreName>(
    store: S,
    key: IDBValidKey,
    fn: (current: StoreRecords[S] | undefined) => StoreRecords[S] | undefined,
  ): Promise<StoreRecords[S] | undefined>;
  delete(store: StoreName, key: IDBValidKey): Promise<void>;
  /** Deletes records older than `before` using a numeric index. Returns how many were removed. */
  deleteOlderThan(store: StoreName, index: string, before: number): Promise<number>;
  /** Removes every record belonging to a profile across all profile-scoped stores, in one transaction. */
  deleteProfile(profileId: string): Promise<void>;
  clearAll(): Promise<void>;
  close(): void;
}
