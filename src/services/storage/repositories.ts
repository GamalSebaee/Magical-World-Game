import type { Clock } from '@shared/runtime';
import type { IdGenerator } from '@shared/ids';
import { classifyStorageError, type StorageBackend } from './backend';
import {
  DEFAULT_SETTINGS,
  type ActiveSessionSnapshot,
  type ActivityAttempt,
  type AvatarConfig,
  type ChildProfile,
  type ConsentRecord,
  type LevelCompletion,
  type QueuedEvent,
  type Settings,
  type SkillEvidence,
  type StickerGrant,
} from './records';
import { STORE_NAMES, type StoreName } from './schema';
import { DB_VERSION } from './migrations';

export const MAX_PROFILES = 4;
const EVENT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const completionKey = (profileId: string, levelId: string) => `${profileId}:${levelId}`;
export const stickerKey = (profileId: string, stickerId: string) => `${profileId}:${stickerId}`;

export interface ExportFileV1 {
  format: 'mwg-export';
  version: 1;
  exportedAt: number;
  app: { schemaVersion: number };
  profiles: Array<{
    profile: ChildProfile;
    avatar?: AvatarConfig;
    settings?: Settings;
    attempts: ActivityAttempt[];
    completions: LevelCompletion[];
    evidence: SkillEvidence[];
    stickers: StickerGrant[];
  }>;
  globalSettings?: Settings;
  consents: ConsentRecord[];
}

/**
 * Domain repositories over a StorageBackend (08-progress §2). Rewards and completions are
 * idempotent; nothing here touches IndexedDB directly.
 */
export function createRepositories(backend: StorageBackend, deps: { clock: Clock; ids: IdGenerator }) {
  const { clock, ids } = deps;

  const profiles = {
    list: () => backend.getAll('profiles').then((ps) => ps.sort((a, b) => a.createdAt - b.createdAt)),
    get: (id: string) => backend.get('profiles', id),
    async create(input: { displayName?: string; ageBand: ChildProfile['ageBand'] }): Promise<ChildProfile> {
      if ((await backend.count('profiles')) >= MAX_PROFILES) {
        throw new Error(`At most ${MAX_PROFILES} profiles`);
      }
      const now = clock.now();
      const name = input.displayName?.trim().slice(0, 20);
      const profile: ChildProfile = { id: ids.next(), ageBand: input.ageBand, createdAt: now, updatedAt: now };
      if (name) profile.displayName = name;
      await backend.put('profiles', profile);
      return profile;
    },
    async update(id: string, patch: Partial<Pick<ChildProfile, 'displayName' | 'ageBand'>>) {
      return backend.update('profiles', id, (cur) => (cur ? { ...cur, ...patch, updatedAt: clock.now() } : undefined));
    },
  };

  const avatars = {
    get: (profileId: string) => backend.get('avatars', profileId),
    save: (a: Omit<AvatarConfig, 'updatedAt' | 'version'>) =>
      backend.put('avatars', { ...a, version: 1, updatedAt: clock.now() }),
  };

  const settings = {
    async get(scope = 'global'): Promise<Settings> {
      const s = await backend.get('settings', scope);
      return { ...DEFAULT_SETTINGS, ...s, scope, updatedAt: s?.updatedAt ?? 0 };
    },
    async patch(patch: Partial<Omit<Settings, 'scope' | 'updatedAt'>>, scope = 'global'): Promise<Settings> {
      const next = await backend.update('settings', scope, (cur) => ({
        ...DEFAULT_SETTINGS,
        ...cur,
        ...patch,
        scope,
        updatedAt: clock.now(),
      }));
      return next!;
    },
  };

  const progress = {
    upsertAttempt: (a: ActivityAttempt) => backend.put('attempts', a),
    appendEvidence: (e: Omit<SkillEvidence, 'id'>) => backend.put('evidence', { ...e, id: ids.next() }),
    evidenceFor: (profileId: string, skillId: string) =>
      backend.getAllByIndex('evidence', 'profileSkill', [profileId, skillId]),
    completionsFor: (profileId: string) => backend.getAllByIndex('completions', 'profileId', profileId),
    /**
     * Records a level completion. Idempotent per `runId`: repeating the call for the same run
     * (double emit, result page refresh) never increments the count. Returns whether this was
     * the first-ever completion of the level for the profile.
     */
    async completeLevel(profileId: string, levelId: string, runId: string): Promise<{ first: boolean }> {
      const key = completionKey(profileId, levelId);
      const now = clock.now();
      let first = false;
      await backend.update('completions', key, (cur) => {
        if (!cur) {
          first = true;
          return {
            key,
            profileId,
            levelId,
            firstCompletedAt: now,
            lastCompletedAt: now,
            timesCompleted: 1,
            countedRunIds: [runId],
          };
        }
        if (cur.countedRunIds.includes(runId)) return undefined;
        return {
          ...cur,
          lastCompletedAt: now,
          timesCompleted: cur.timesCompleted + 1,
          countedRunIds: [...cur.countedRunIds, runId].slice(-50),
        };
      });
      return { first };
    },
  };

  const rewards = {
    /** Grants a sticker once per profile. Returns true only when newly granted. */
    grantSticker: (profileId: string, stickerId: string, levelId: string) =>
      backend.add('stickers', {
        key: stickerKey(profileId, stickerId),
        profileId,
        stickerId,
        levelId,
        grantedAt: clock.now(),
      }),
    stickersFor: (profileId: string) => backend.getAllByIndex('stickers', 'profileId', profileId),
  };

  const consents = {
    record: (type: ConsentRecord['type'], granted: boolean, policyVersion: string) =>
      backend.put('consents', { id: ids.next(), type, granted, at: clock.now(), policyVersion }),
    async latest(type: ConsentRecord['type']): Promise<ConsentRecord | undefined> {
      const all = await backend.getAllByIndex('consents', 'type', type);
      return all.sort((a, b) => b.at - a.at)[0];
    },
  };

  const activeSession = {
    save: (s: Omit<ActiveSessionSnapshot, 'savedAt'>) => backend.put('activeSession', { ...s, savedAt: clock.now() }),
    /** Returns the snapshot only if it is for this level, this content version and recent (04 §8). */
    async resumable(profileId: string, levelId: string, contentVersion: string) {
      const s = await backend.get('activeSession', profileId);
      if (!s) return undefined;
      const fresh = clock.now() - s.savedAt <= SNAPSHOT_MAX_AGE_MS;
      if (s.levelId !== levelId || s.contentVersion !== contentVersion || !fresh) return undefined;
      return s;
    },
    clear: (profileId: string) => backend.delete('activeSession', profileId),
  };

  const events = {
    async enqueue(event: QueuedEvent['event']) {
      try {
        await backend.put('eventQueue', { at: clock.now(), event });
      } catch (err) {
        if (classifyStorageError(err).code !== 'quota') throw err;
        // Local analytics are the first thing to give up under storage pressure (08 §4).
        await backend.deleteOlderThan('eventQueue', 'at', clock.now() - 30 * 24 * 60 * 60 * 1000);
      }
    },
    prune: () => backend.deleteOlderThan('eventQueue', 'at', clock.now() - EVENT_RETENTION_MS),
    count: () => backend.count('eventQueue'),
  };

  async function exportAll(profileId?: string): Promise<ExportFileV1> {
    const all = await profiles.list();
    const chosen = profileId ? all.filter((p) => p.id === profileId) : all;
    return {
      format: 'mwg-export',
      version: 1,
      exportedAt: clock.now(),
      app: { schemaVersion: DB_VERSION },
      profiles: await Promise.all(
        chosen.map(async (profile) => ({
          profile,
          avatar: await backend.get('avatars', profile.id),
          settings: await backend.get('settings', profile.id),
          attempts: await backend.getAllByIndex('attempts', 'profileId', profile.id),
          completions: await backend.getAllByIndex('completions', 'profileId', profile.id),
          evidence: await backend.getAllByIndex('evidence', 'profileId', profile.id),
          stickers: await backend.getAllByIndex('stickers', 'profileId', profile.id),
        })),
      ),
      globalSettings: await backend.get('settings', 'global'),
      consents: await backend.getAll('consents'),
    };
  }

  async function deleteProfile(profileId: string) {
    await backend.deleteProfile(profileId);
    await backend.delete('settings', profileId);
  }

  async function counts(): Promise<Record<StoreName, number>> {
    const entries = await Promise.all(STORE_NAMES.map(async (s) => [s, await backend.count(s)] as const));
    return Object.fromEntries(entries) as Record<StoreName, number>;
  }

  return {
    backend,
    profiles,
    avatars,
    settings,
    progress,
    rewards,
    consents,
    activeSession,
    events,
    exportAll,
    deleteProfile,
    deleteAll: () => backend.clearAll(),
    counts,
  };
}

export type StorageRepositories = ReturnType<typeof createRepositories>;
