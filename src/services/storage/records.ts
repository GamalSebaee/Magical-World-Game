import type { LanguageMode, DigitStyle } from '@shared/i18n/language';

/** Persisted record shapes (08-progress §1). Ids are plain strings at the storage boundary. */

export interface MetaRecord {
  key: string;
  value: unknown;
}

export interface ChildProfile {
  id: string;
  displayName?: string;
  ageBand: 3 | 4 | 5 | 6;
  createdAt: number;
  updatedAt: number;
}

export interface AvatarConfig {
  profileId: string;
  version: 1;
  hairStyle: string;
  hairColor: string;
  skinTone: string;
  top: string;
  bottom: string;
  shoes: string;
  accessory: string;
  updatedAt: number;
}

export interface ActivityAttempt {
  id: string;
  profileId: string;
  levelId: string;
  activityId: string;
  contentVersion: string;
  runId: string;
  startedAt: number;
  endedAt?: number;
  outcome?: 'completed' | 'skipped' | 'abandoned';
  hintMax: 0 | 1 | 2 | 3;
  notYetCount: number;
}

export interface LevelCompletion {
  key: string; // `${profileId}:${levelId}`
  profileId: string;
  levelId: string;
  firstCompletedAt: number;
  lastCompletedAt: number;
  timesCompleted: number;
  /** LevelRunner run ids already counted, so a double emit cannot double count (08 §4). */
  countedRunIds: string[];
}

export type EvidenceKind =
  | 'exposure'
  | 'choice_correct'
  | 'choice_not_yet'
  | 'placement_correct'
  | 'placement_not_yet'
  | 'count_correct'
  | 'count_not_yet'
  | 'match_correct'
  | 'match_not_yet'
  | 'speech_attempt'
  | 'speech_prompt_only'
  | 'skipped';

export interface SkillEvidence {
  id: string;
  profileId: string;
  skillId: string;
  activityId: string;
  attemptId: string;
  kind: EvidenceKind;
  firstTry?: boolean;
  hintLevel: 0 | 1 | 2 | 3;
  voiced?: boolean;
  recognizerAgreed?: boolean;
  at: number;
  sessionDay: string;
}

export interface SkillState {
  profileId: string;
  skillId: string;
  status: 'not_started' | 'introduced' | 'practicing' | 'demonstrated';
  needsReview: boolean;
  evidenceSummary: string;
  ruleVersion: number;
  updatedAt: number;
}

export interface StickerGrant {
  key: string; // `${profileId}:${stickerId}`
  profileId: string;
  stickerId: string;
  levelId: string;
  grantedAt: number;
}

export interface Settings {
  scope: string; // 'global' or a profile id
  languageMode: LanguageMode;
  digitStyle: DigitStyle;
  volumes: { voice: number; sfx: number; music: number };
  muted: { all: boolean; music: boolean; sfx: boolean };
  reducedMotion: 'system' | 'on' | 'off';
  hintTiming: 'age' | 'slower' | 'faster';
  sessionReminderMin: 0 | 10 | 15 | 20 | 30;
  endSessionAtLimit: boolean;
  hiddenWorlds: string[];
  micEnabled: boolean;
  recognitionEnabled: boolean;
  parentPin?: { hash: string; salt: string };
  updatedAt: number;
}

export interface ConsentRecord {
  id: string;
  type: 'microphone' | 'recognition' | 'tts';
  granted: boolean;
  at: number;
  policyVersion: string;
}

export interface PlaySession {
  id: string;
  profileId: string;
  startedAt: number;
  activeMs: number;
  endedAt?: number;
}

export interface ActiveSessionSnapshot {
  profileId: string;
  levelId: string;
  contentVersion: string;
  activityIndex: number;
  activityId: string;
  mechanicState: unknown;
  hintLevel: 0 | 1 | 2 | 3;
  seed: number;
  startedAt: number;
  savedAt: number;
}

export interface AudioCacheMeta {
  key: string;
  lastUsedAt: number;
  bytes: number;
}

export interface QueuedEvent {
  seq?: number; // auto-increment key
  at: number;
  event: { type: string } & Record<string, unknown>;
}

export const DEFAULT_SETTINGS: Omit<Settings, 'scope' | 'updatedAt'> = {
  languageMode: 'ar',
  digitStyle: 'eastern',
  volumes: { voice: 1, sfx: 0.8, music: 0.5 },
  muted: { all: false, music: false, sfx: false },
  reducedMotion: 'system',
  hintTiming: 'age',
  sessionReminderMin: 20,
  endSessionAtLimit: false,
  hiddenWorlds: [],
  micEnabled: false,
  recognitionEnabled: false,
};
