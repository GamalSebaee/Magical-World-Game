# 08 — Progress, Learning Evidence and Parent Dashboard

## 1. IndexedDB database `mwg` (schema version 1)

| Store | Key | Indexes | Record |
|-------|-----|---------|--------|
| `meta` | `key` | — | `{ key: 'schema' | 'install' | 'lastLaunchAt', value }` |
| `profiles` | `id` | — | `ChildProfile { id, displayName?, ageBand: 3|4|5|6, createdAt, updatedAt }` |
| `avatars` | `profileId` | — | `AvatarConfig { profileId, version, hairStyle, hairColor, skinTone, top, bottom, shoes, accessory, updatedAt }` |
| `attempts` | `id` | `profileId`, `[profileId+levelId]`, `at` | `ActivityAttempt { id, profileId, levelId, activityId, contentVersion, startedAt, endedAt?, outcome: 'completed'|'skipped'|'abandoned', hintMax, notYetCount }` |
| `completions` | `key` = `${profileId}:${levelId}` | `profileId` | `LevelCompletion { key, profileId, levelId, firstCompletedAt, lastCompletedAt, timesCompleted }` |
| `evidence` | `id` | `[profileId+skillId]`, `at` | `SkillEvidence { id, profileId, skillId, activityId, attemptId, kind, firstTry?, hintLevel, at, sessionDay }` |
| `skillState` | `[profileId+skillId]` | `profileId` | `SkillState { profileId, skillId, status, needsReview, evidenceSummary, updatedAt, ruleVersion }` (derived cache, rebuildable from `evidence`) |
| `stickers` | `key` = `${profileId}:${stickerId}` | `profileId` | `StickerGrant { key, profileId, stickerId, levelId, grantedAt }` |
| `settings` | `scope` (`global` or profileId) | — | language mode, digits, volumes, mutes, reduced motion, hint timing, session reminder, world visibility, mic enabled, recognition enabled, parent PIN hash + salt |
| `consents` | `id` | `type` | `{ id, type: 'microphone'|'recognition'|'tts', granted, at, policyVersion }` |
| `sessions` | `id` | `profileId`, `startedAt` | `{ id, profileId, startedAt, activeMs, endedAt? }` (foreground play time only) |
| `activeSession` | `profileId` | — | mid-level snapshot (04 §8) |
| `audioCache` | `key` | `lastUsedAt` | metadata for TTS-synthesized clips (blobs live in Cache Storage) |
| `eventQueue` | `seq` (auto) | `at` | local analytics events (§3), rolling 90 days |

Evidence `kind`: `exposure` (heard/seen in tap_discover or reveal), `choice_correct`, `choice_not_yet`, `placement_correct`, `placement_not_yet`, `count_correct`, `count_not_yet`, `match_correct`, `match_not_yet`, `speech_attempt` (with `voiced: boolean`, `recognizerAgreed?: boolean`), `speech_prompt_only`, `skipped`.

`sessionDay` is a local calendar date string (YYYY-MM-DD) used to judge spacing across days, without storing precise times beyond the event's own `at`.

## 2. Repository abstraction

```ts
interface StorageRepositories {
  profiles: ProfileRepo;   avatars: AvatarRepo;
  progress: ProgressRepo;  // attempts, completions, evidence, skillState
  rewards: RewardRepo;     // stickers
  settings: SettingsRepo;  consents: ConsentRepo;
  sessions: SessionRepo;   activeSession: ActiveSessionRepo;
  events: EventQueueRepo;
  exportAll(profileId?: ProfileId): Promise<ExportFileV1>;
  deleteProfile(profileId: ProfileId): Promise<void>;   // single transaction across stores
  deleteAll(): Promise<void>;
}
```

Implementations: `IdbStorage` (production), `MemoryStorage` (fallback and tests). All writes go through repositories; React and Phaser never touch IndexedDB directly.

## 3. Event semantics

Events in `eventQueue` mirror the bus (02 §3.2) with these meanings:

| Event | Fired when | Not fired when |
|-------|-----------|----------------|
| `activity.started` | activity enters `intro` the first time in an attempt | resume after pause/rotation |
| `activity.evaluated` | a meaningful input is evaluated | taps on background, taps on already-handled items |
| `activity.completed` | final `completed` | replays of feedback |
| `activity.skipped` | final `skipped` | — |
| `level.completed` | all activities completed or skipped; written with the completion upsert | result page refresh |
| `reward.granted` | first insert of a sticker key | key already exists |
| `speech.attempt` | recorder produced a result | permission dialogs, cancels |
| `session.start/end` | profile selected / app hidden > 5 min or profile switched | — |

No event contains free text from the child, audio, or precise location.

## 4. Idempotency and persistence boundaries

- **Level completion:** `completions.put` inside a transaction that first reads the key; `firstCompletedAt` set only if absent; `timesCompleted` incremented once per `LevelRunner` run id (stored on the attempt) so a double emit cannot double count.
- **Sticker grant:** `stickers.add(key)` (not `put`): a second add fails with `ConstraintError`, which is treated as "already granted". Event `reward.granted` is emitted only on a successful add.
- **Attempts:** id generated at activity start; writes are upserts by id.
- **Persist points:** activity evaluated (evidence append), activity end (attempt), level end (completion + sticker), `visibilitychange: hidden` (active session snapshot), settings change (immediate).
- **Quota exceeded:** catch `QuotaExceededError` → prune `eventQueue` older than 30 days and `audioCache` LRU → retry once → on failure switch to `MemoryStorage` for non-critical stores and show the parent banner; completions and stickers are tried first (they are tiny).
- **Private browsing / IndexedDB unavailable:** detect at boot (open with a 3 s timeout); use `MemoryStorage`; parent banner "Progress won't be saved in this browser mode".
- **Persistent storage:** after first profile creation, call `navigator.storage.persist()` (where supported) to reduce eviction; report result on the privacy page.

## 5. Skill lifecycle and evidence rules (hypotheses, adjustable)

Statuses: `not_started` → `introduced` → `practicing` → `demonstrated` (the dashboard word for the brief's `mastered`). `needsReview` is an independent flag.

Rule set v1 (`features/learning/evidenceRules.ts`, versioned; changing it recomputes `skillState` from `evidence`):

| Transition | Rule |
|-----------|------|
| → `introduced` | ≥ 1 `exposure` or any evaluated evidence for the skill |
| → `practicing` | ≥ 1 evaluated non-speech evidence (`*_correct` or `*_not_yet`) |
| → `demonstrated` | ≥ 4 `*_correct` with `hintLevel ≤ 1`, of which ≥ 3 are `firstTry`, across ≥ 2 distinct `sessionDay`s and ≥ 2 distinct activities; and correct ratio ≥ 0.8 over the last 5 evaluated non-speech items |
| `needsReview = true` | status was `demonstrated` and 2 of the last 3 evaluated items are `not_yet`; or ≥ 21 days since the last evaluated item (parent sees "may need a refresh") |
| `needsReview = false` | 2 consecutive `firstTry` correct after being flagged |

Explicitly excluded from mastery: speech evidence of any kind (counts only towards "speaking tries"); time spent; a single answer; answers at hint level 3 (the hand showed the answer); skipped activities.

`speak.*` skills have only `not_started` → `introduced` → `practicing` (tried saying it). They never reach `demonstrated` in MVP.

## 6. Parent dashboard reporting

Labels shown to parents (no other wording for these concepts):

| Label | Definition |
|-------|-----------|
| **Encountered** | skill status ≥ `introduced` |
| **Practiced** | skill status ≥ `practicing` |
| **Demonstrated through activities** | skill status = `demonstrated`; shown with "based on N answers over M days; this is an estimate, not a test" |
| **May need a refresh** | `needsReview` |
| **Speaking tries** | count of `speech_attempt` (and how many had voice detected); never accuracy |

Other metrics: levels played (distinct completions), stickers earned, play time this week (sum of `sessions.activeMs` for foreground time), last played. Every number traces to stored records; nothing is estimated or invented. Where there is no data, show "—".

Uncertainty: each "demonstrated" entry has an info button explaining the rule and that young children's performance varies day to day.

## 7. Export, deletion and migration

- **Export:** JSON `ExportFileV1 { format: 'mwg-export', version: 1, exportedAt, app: { version, contentVersion }, profiles: [...] }` including profile, avatar, attempts, completions, evidence, stickers, settings, consents. Contains no audio (none is stored). Download via `Blob` + `a[download]` in the parent area only.
- **Import:** roadmap (not MVP).
- **Delete one child:** single readwrite transaction over all stores filtered by `profileId`; then verify counts = 0.
- **Delete everything:** `indexedDB.deleteDatabase('mwg')`, clear `localStorage` keys, clear TTS Cache Storage; app restarts into first-run.
- **Migrations:** `openDB('mwg', N, { upgrade(db, oldVersion, newVersion, tx) { … } })` with one step function per version (`migrations/001_initial.ts`, `002_*.ts`, …). Each migration has a unit test that seeds a database at the old version (fake-indexeddb), upgrades, and asserts data. Records carry their own `version` where shape may evolve (avatar). Downgrades are not supported; the app refuses to open a newer DB version with a parent-readable message instead of corrupting data.
- **Service worker upgrades:** new SW installs in the background, waits, and activates only when no level is in progress (`clients.claim` is not used mid-game); the app shows "update ready" in the parent area and applies it on the next launch or when the child is on the map/profiles screens.
