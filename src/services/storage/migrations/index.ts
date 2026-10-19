import type { IDBPDatabase, IDBPTransaction } from 'idb';
import { STORES, type StoreName } from '../schema';

export type UpgradeTx = IDBPTransaction<unknown, StoreName[], 'versionchange'>;
export type Migration = (db: IDBPDatabase<unknown>, tx: UpgradeTx) => void;

/** v1: create every store and index from the store table. */
const m001Initial: Migration = (db) => {
  for (const [name, spec] of Object.entries(STORES)) {
    const store = db.createObjectStore(name, { keyPath: spec.keyPath, autoIncrement: spec.autoIncrement ?? false });
    for (const idx of spec.indexes) store.createIndex(idx.name, idx.keyPath);
  }
};

/**
 * Ordered migrations. MIGRATIONS[n] upgrades from version n to n+1. Never edit a shipped
 * migration; add a new one and bump DB_VERSION (08 §7).
 */
export const MIGRATIONS: readonly Migration[] = [m001Initial];
export const DB_VERSION = MIGRATIONS.length;

export function runMigrations(db: IDBPDatabase<unknown>, oldVersion: number, newVersion: number, tx: UpgradeTx) {
  for (let v = oldVersion; v < newVersion; v++) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error(`No migration from version ${v}`);
    m(db, tx);
  }
}
