import type {
  ActiveSessionSnapshot,
  ActivityAttempt,
  AudioCacheMeta,
  AvatarConfig,
  ChildProfile,
  ConsentRecord,
  LevelCompletion,
  MetaRecord,
  PlaySession,
  QueuedEvent,
  Settings,
  SkillEvidence,
  SkillState,
  StickerGrant,
} from './records';

export const DB_NAME = 'mwg';

/** Record type per store. */
export interface StoreRecords {
  meta: MetaRecord;
  profiles: ChildProfile;
  avatars: AvatarConfig;
  attempts: ActivityAttempt;
  completions: LevelCompletion;
  evidence: SkillEvidence;
  skillState: SkillState;
  stickers: StickerGrant;
  settings: Settings;
  consents: ConsentRecord;
  sessions: PlaySession;
  activeSession: ActiveSessionSnapshot;
  audioCache: AudioCacheMeta;
  eventQueue: QueuedEvent;
}
export type StoreName = keyof StoreRecords;

export interface IndexSpec {
  name: string;
  keyPath: string | string[];
}

export interface StoreSpec {
  keyPath: string | string[];
  autoIncrement?: boolean;
  indexes: IndexSpec[];
  /** Stores whose records belong to one child; cleared by deleteProfile (08 §7). */
  profileScoped: boolean;
}

/**
 * Store layout for schema version 1. Both the IndexedDB migration and the in-memory backend are
 * driven from this table, so they cannot drift apart.
 */
export const STORES: Record<StoreName, StoreSpec> = {
  meta: { keyPath: 'key', indexes: [], profileScoped: false },
  profiles: { keyPath: 'id', indexes: [], profileScoped: true },
  avatars: { keyPath: 'profileId', indexes: [], profileScoped: true },
  attempts: {
    keyPath: 'id',
    indexes: [
      { name: 'profileId', keyPath: 'profileId' },
      { name: 'profileLevel', keyPath: ['profileId', 'levelId'] },
      { name: 'at', keyPath: 'startedAt' },
    ],
    profileScoped: true,
  },
  completions: { keyPath: 'key', indexes: [{ name: 'profileId', keyPath: 'profileId' }], profileScoped: true },
  evidence: {
    keyPath: 'id',
    indexes: [
      { name: 'profileId', keyPath: 'profileId' },
      { name: 'profileSkill', keyPath: ['profileId', 'skillId'] },
      { name: 'at', keyPath: 'at' },
    ],
    profileScoped: true,
  },
  skillState: {
    keyPath: ['profileId', 'skillId'],
    indexes: [{ name: 'profileId', keyPath: 'profileId' }],
    profileScoped: true,
  },
  stickers: { keyPath: 'key', indexes: [{ name: 'profileId', keyPath: 'profileId' }], profileScoped: true },
  settings: { keyPath: 'scope', indexes: [], profileScoped: false },
  consents: { keyPath: 'id', indexes: [{ name: 'type', keyPath: 'type' }], profileScoped: false },
  sessions: {
    keyPath: 'id',
    indexes: [
      { name: 'profileId', keyPath: 'profileId' },
      { name: 'startedAt', keyPath: 'startedAt' },
    ],
    profileScoped: true,
  },
  activeSession: { keyPath: 'profileId', indexes: [], profileScoped: true },
  audioCache: { keyPath: 'key', indexes: [{ name: 'lastUsedAt', keyPath: 'lastUsedAt' }], profileScoped: false },
  eventQueue: { keyPath: 'seq', autoIncrement: true, indexes: [{ name: 'at', keyPath: 'at' }], profileScoped: false },
};

export const STORE_NAMES = Object.keys(STORES) as StoreName[];

/** Primary key of a record for a store (compound keys become arrays). */
export function keyOf<S extends StoreName>(store: S, record: StoreRecords[S]): IDBValidKey | undefined {
  const kp = STORES[store].keyPath;
  const r = record as unknown as Record<string, IDBValidKey>;
  return Array.isArray(kp) ? kp.map((k) => r[k]!) : r[kp];
}

/** How a profile-scoped store refers to its profile. */
export function profileIdOf(store: StoreName, record: unknown): string | undefined {
  const r = record as Record<string, unknown>;
  if (store === 'profiles') return r.id as string;
  return r.profileId as string | undefined;
}
