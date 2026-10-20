import { z } from 'zod';

export const Lang = z.enum(['ar', 'en']);
export const LanguageMode = z.enum(['ar', 'en', 'mixed']);
export const SemVer = z.string().regex(/^\d+\.\d+\.\d+$/, 'expected semver x.y.z');

/** Written text for adults/captions. The child never needs to read it. */
export const LocalizedText = z.object({
  ar: z.string().min(1),
  en: z.string().min(1),
  mixed: z.string().min(1).optional(),
});
export type LocalizedText = z.infer<typeof LocalizedText>;

const CLIP_ID = /^[a-z0-9]+(\.[a-z0-9_]+)+$/;
export const AudioClipId = z.string().regex(CLIP_ID, 'audio clip id like "af01.a1.instruction"');
/** In `ar`/`en` sequences ids resolve in that language. In `mixed` every id pins a language. */
export const PinnedClipId = z
  .string()
  .regex(/^[a-z0-9]+(\.[a-z0-9_]+)+:(ar|en)$/, 'mixed-mode clip ids must end in :ar or :en');
export const AudioSequence = z.array(AudioClipId).min(1).max(4);
export const MixedSequence = z.array(PinnedClipId).min(1).max(4);

export const LocalizedAudioRef = z.object({
  ar: AudioSequence,
  en: AudioSequence,
  mixed: MixedSequence.optional(),
  caption: LocalizedText,
});
export type LocalizedAudioRef = z.infer<typeof LocalizedAudioRef>;

export const SkillId = z
  .string()
  .regex(/^(vocab|math|color|shape|speak|listen)\.[a-z_]+\.[a-z0-9_]+$/, 'skill id like "vocab.animals.cat"');
export const AssetRef = z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, 'asset ref like "animals/cat"');
export const VocabId = z.string().regex(/^[a-z]+\.[a-z0-9_]+$/, 'vocabulary id like "animals.cat"');
export const WorldIdSchema = z.string().regex(/^[a-z]+(-[a-z]+)*$/);
export const LevelIdSchema = z.string().regex(/^[a-z]{2}-\d{2}$/);

export { parsePinnedClip } from './pinned';
