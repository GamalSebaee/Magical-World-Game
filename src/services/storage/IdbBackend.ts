import { openDB, deleteDB, type IDBPDatabase } from 'idb';
import { classifyStorageError, StorageError, type StorageBackend } from './backend';
import { DB_NAME, STORE_NAMES, STORES, keyOf, profileIdOf, type StoreName, type StoreRecords } from './schema';
import { DB_VERSION, runMigrations } from './migrations';

type Db = IDBPDatabase<unknown>;

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw classifyStorageError(err);
  }
}

export class IdbBackend implements StorageBackend {
  readonly kind = 'indexeddb' as const;
  private constructor(
    private readonly db: Db,
    private readonly name: string,
  ) {}

  /** Opens (and migrates) the database. Rejects with StorageError if IndexedDB can't be used. */
  static async open(opts: { name?: string; timeoutMs?: number } = {}): Promise<IdbBackend> {
    const name = opts.name ?? DB_NAME;
    // `idb` uses the global indexedDB; tests install fake-indexeddb as that global.
    if (typeof indexedDB === 'undefined') throw new StorageError('unavailable', 'IndexedDB is not available');
    const opening = openDB(name, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, tx) {
        runMigrations(db, oldVersion, newVersion ?? DB_VERSION, tx as never);
      },
      blocking() {
        // A newer version of the app (another tab) wants to upgrade: release the connection.
        // This tab will see errors on its next write and recover on reload.
        void opening.then((db) => db.close());
      },
    });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new StorageError('unavailable', 'Opening IndexedDB timed out')), opts.timeoutMs ?? 3000),
    );
    try {
      const db = await Promise.race([opening, timeout]);
      return new IdbBackend(db as Db, name);
    } catch (err) {
      throw classifyStorageError(err);
    }
  }

  get<S extends StoreName>(store: S, key: IDBValidKey) {
    return guard(() => this.db.get(store, key) as Promise<StoreRecords[S] | undefined>);
  }

  getAll<S extends StoreName>(store: S) {
    return guard(() => this.db.getAll(store) as Promise<StoreRecords[S][]>);
  }

  getAllByIndex<S extends StoreName>(store: S, index: string, key: IDBValidKey) {
    return guard(() => this.db.getAllFromIndex(store, index, key) as Promise<StoreRecords[S][]>);
  }

  count(store: StoreName) {
    return guard(() => this.db.count(store));
  }

  put<S extends StoreName>(store: S, record: StoreRecords[S]) {
    return guard(async () => {
      await this.db.put(store, record);
    });
  }

  add<S extends StoreName>(store: S, record: StoreRecords[S]) {
    return guard(async () => {
      const tx = this.db.transaction(store, 'readwrite');
      const key = keyOf(store, record);
      const exists = key !== undefined && (await tx.store.getKey(key)) !== undefined;
      if (!exists) await tx.store.add(record);
      await tx.done;
      return !exists;
    });
  }

  update<S extends StoreName>(
    store: S,
    key: IDBValidKey,
    fn: (current: StoreRecords[S] | undefined) => StoreRecords[S] | undefined,
  ) {
    return guard(async () => {
      const tx = this.db.transaction(store, 'readwrite');
      const current = (await tx.store.get(key)) as StoreRecords[S] | undefined;
      const next = fn(current);
      if (next !== undefined) await tx.store.put(next);
      await tx.done;
      return next ?? current;
    });
  }

  delete(store: StoreName, key: IDBValidKey) {
    return guard(() => this.db.delete(store, key));
  }

  deleteOlderThan(store: StoreName, index: string, before: number) {
    return guard(async () => {
      const tx = this.db.transaction(store, 'readwrite');
      let removed = 0;
      let cursor = await tx.store.index(index).openCursor(IDBKeyRange.upperBound(before, true));
      while (cursor) {
        await cursor.delete();
        removed++;
        cursor = await cursor.continue();
      }
      await tx.done;
      return removed;
    });
  }

  deleteProfile(profileId: string) {
    return guard(async () => {
      const scoped = STORE_NAMES.filter((s) => STORES[s].profileScoped);
      const tx = this.db.transaction(scoped, 'readwrite');
      await Promise.all(
        scoped.map(async (s) => {
          const store = tx.objectStore(s);
          const spec = STORES[s];
          if (spec.indexes.some((i) => i.name === 'profileId')) {
            let cursor = await store.index('profileId').openCursor(profileId);
            while (cursor) {
              await cursor.delete();
              cursor = await cursor.continue();
            }
          } else {
            // Keyed directly by profile id (profiles, avatars, activeSession).
            const rec = await store.get(profileId);
            if (rec && profileIdOf(s, rec) === profileId) await store.delete(profileId);
          }
        }),
      );
      await tx.done;
    });
  }

  clearAll() {
    return guard(async () => {
      this.db.close();
      await deleteDB(this.name);
    });
  }

  close() {
    this.db.close();
  }
}
