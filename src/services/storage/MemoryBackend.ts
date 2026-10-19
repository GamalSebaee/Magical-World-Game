import type { StorageBackend } from './backend';
import { STORE_NAMES, STORES, keyOf, profileIdOf, type StoreName, type StoreRecords } from './schema';

const k = (key: IDBValidKey) => JSON.stringify(key);
const clone = <T>(v: T): T => structuredClone(v);

function indexValue(record: unknown, keyPath: string | string[]): unknown {
  const r = record as Record<string, unknown>;
  return Array.isArray(keyPath) ? keyPath.map((p) => r[p]) : r[keyPath];
}

/**
 * In-memory backend with IndexedDB-like semantics (records are cloned in and out).
 * Used as the fallback when IndexedDB is unavailable (private mode, blocked) and in tests.
 */
export class MemoryBackend implements StorageBackend {
  readonly kind = 'memory' as const;
  private stores = new Map<StoreName, Map<string, unknown>>(STORE_NAMES.map((s) => [s, new Map()]));
  private seq = 0;

  private map(store: StoreName) {
    return this.stores.get(store)!;
  }

  private withKey<S extends StoreName>(store: S, record: StoreRecords[S]): [string, StoreRecords[S]] {
    let rec = clone(record);
    if (STORES[store].autoIncrement && keyOf(store, rec) === undefined) {
      rec = { ...rec, [STORES[store].keyPath as string]: ++this.seq };
    }
    return [k(keyOf(store, rec)!), rec];
  }

  async get<S extends StoreName>(store: S, key: IDBValidKey) {
    const v = this.map(store).get(k(key));
    return v === undefined ? undefined : (clone(v) as StoreRecords[S]);
  }

  async getAll<S extends StoreName>(store: S) {
    return [...this.map(store).values()].map((v) => clone(v) as StoreRecords[S]);
  }

  async getAllByIndex<S extends StoreName>(store: S, index: string, key: IDBValidKey) {
    const spec = STORES[store].indexes.find((i) => i.name === index);
    if (!spec) throw new Error(`No index ${index} on ${store}`);
    const want = k(key);
    return (await this.getAll(store)).filter((r) => k(indexValue(r, spec.keyPath) as IDBValidKey) === want);
  }

  async count(store: StoreName) {
    return this.map(store).size;
  }

  async put<S extends StoreName>(store: S, record: StoreRecords[S]) {
    const [key, rec] = this.withKey(store, record);
    this.map(store).set(key, rec);
  }

  async add<S extends StoreName>(store: S, record: StoreRecords[S]) {
    const [key, rec] = this.withKey(store, record);
    if (this.map(store).has(key)) return false;
    this.map(store).set(key, rec);
    return true;
  }

  async update<S extends StoreName>(
    store: S,
    key: IDBValidKey,
    fn: (current: StoreRecords[S] | undefined) => StoreRecords[S] | undefined,
  ) {
    const current = await this.get(store, key);
    const next = fn(current);
    if (next !== undefined) await this.put(store, next);
    return next ?? current;
  }

  async delete(store: StoreName, key: IDBValidKey) {
    this.map(store).delete(k(key));
  }

  async deleteOlderThan(store: StoreName, index: string, before: number) {
    const spec = STORES[store].indexes.find((i) => i.name === index);
    if (!spec) throw new Error(`No index ${index} on ${store}`);
    let removed = 0;
    for (const [key, rec] of this.map(store)) {
      const v = indexValue(rec, spec.keyPath);
      if (typeof v === 'number' && v < before) {
        this.map(store).delete(key);
        removed++;
      }
    }
    return removed;
  }

  async deleteProfile(profileId: string) {
    for (const s of STORE_NAMES) {
      if (!STORES[s].profileScoped) continue;
      for (const [key, rec] of this.map(s)) {
        if (profileIdOf(s, rec) === profileId) this.map(s).delete(key);
      }
    }
  }

  async clearAll() {
    for (const m of this.stores.values()) m.clear();
  }

  close() {}
}
