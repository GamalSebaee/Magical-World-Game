/** Branded id types so ids of different kinds cannot be mixed up (05-content-schema §2). */
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type ProfileId = Brand<string, 'ProfileId'>;
export type WorldId = Brand<string, 'WorldId'>;
export type LevelId = Brand<string, 'LevelId'>;
export type ActivityId = Brand<string, 'ActivityId'>;
export type SkillId = Brand<string, 'SkillId'>;
export type StickerId = Brand<string, 'StickerId'>;
export type AttemptId = Brand<string, 'AttemptId'>;
export type AudioClipId = Brand<string, 'AudioClipId'>;

export interface IdGenerator {
  next(): string;
}

export const cryptoIds: IdGenerator = {
  next: () => crypto.randomUUID(),
};

/** Deterministic ids for tests. */
export function sequentialIds(prefix = 'id'): IdGenerator {
  let n = 0;
  return { next: () => `${prefix}-${++n}` };
}
