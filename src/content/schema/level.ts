import { z } from 'zod';
import { ActivityDefinition } from './activity';
import {
  AssetRef,
  LevelIdSchema,
  LocalizedAudioRef,
  LocalizedText,
  SemVer,
  SkillId,
  WorldIdSchema,
} from './common';

export const LevelDefinition = z
  .object({
    schemaVersion: z.literal(1),
    contentVersion: SemVer,
    id: LevelIdSchema,
    worldId: WorldIdSchema,
    order: z.number().int().min(1).max(4),
    title: LocalizedText,
    learningGoal: LocalizedText,
    story: z.object({ intro: LocalizedAudioRef, outro: LocalizedAudioRef, illustration: AssetRef }),
    /** Scene backdrop for activities. */
    background: AssetRef,
    skills: z.array(SkillId).min(1),
    activities: z.array(ActivityDefinition).min(2).max(4),
    sticker: z.object({ id: z.string().regex(/^sticker\.[a-z]{2}-\d{2}$/), asset: AssetRef, name: LocalizedAudioRef }),
    assetPack: z.string().regex(/^pack\.[a-z-]+$/),
    estimatedMinutes: z.tuple([z.number().positive(), z.number().positive()]),
    /** Optional hints only. Never used to gate access (R-03). */
    suggestedNext: z.array(LevelIdSchema).max(2),
  })
  .superRefine((lvl, ctx) => {
    const ids = new Set<string>();
    for (const a of lvl.activities) {
      if (ids.has(a.id)) ctx.addIssue({ code: 'custom', message: `duplicate activity id ${a.id}` });
      ids.add(a.id);
      const expectedPrefix = lvl.id.replace('-', '') + '.';
      if (!a.id.startsWith(expectedPrefix)) {
        ctx.addIssue({ code: 'custom', message: `${a.id} should start with ${expectedPrefix}` });
      }
      for (const s of a.skills) {
        if (!lvl.skills.includes(s)) {
          ctx.addIssue({ code: 'custom', message: `${a.id} skill ${s} not declared on level` });
        }
      }
    }
    if (lvl.sticker.id !== `sticker.${lvl.id}`) {
      ctx.addIssue({ code: 'custom', message: `sticker id must be sticker.${lvl.id}` });
    }
    const [min, max] = lvl.estimatedMinutes;
    if (min > max) ctx.addIssue({ code: 'custom', message: 'estimatedMinutes: min > max' });
  });
export type LevelDefinition = z.infer<typeof LevelDefinition>;

export const WorldDefinition = z.object({
  schemaVersion: z.literal(1),
  contentVersion: SemVer,
  id: WorldIdSchema,
  code: z.string().regex(/^[a-z]{2}$/),
  name: LocalizedText,
  nameAudio: LocalizedAudioRef,
  welcome: LocalizedAudioRef,
  mapHotspot: z.object({
    asset: AssetRef,
    position: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
  }),
  levels: z.array(LevelIdSchema).length(4),
  assetPack: z.string().regex(/^pack\.[a-z-]+$/),
});
export type WorldDefinition = z.infer<typeof WorldDefinition>;

export const SkillDefinition = z.object({
  id: SkillId,
  domain: z.enum(['vocab', 'math', 'color', 'shape', 'speak', 'listen']),
  label: LocalizedText,
  outcome: LocalizedText,
  evidenceRule: z.string().min(1),
});
export type SkillDefinition = z.infer<typeof SkillDefinition>;

export const VocabularyEntry = z.object({
  id: z.string().regex(/^[a-z]+\.[a-z0-9_]+$/),
  written: z.object({ ar: z.string().min(1), en: z.string().min(1) }),
  audio: z.string().regex(/^[a-z0-9]+(\.[a-z0-9_]+)+$/),
  picture: AssetRef,
});
export type VocabularyEntry = z.infer<typeof VocabularyEntry>;

export const ContentIndex = z.object({
  schemaVersion: z.literal(1),
  contentVersion: SemVer,
  worlds: z.array(WorldIdSchema).min(1),
});
export type ContentIndex = z.infer<typeof ContentIndex>;

/** Shared spoken lines (screen cues, Nono's praise, speech feedback) and SFX ids used by code. */
export const UiAudioFile = z.object({
  schemaVersion: z.literal(1),
  lines: z.record(z.string().regex(/^[a-z0-9]+(\.[a-z0-9_]+)+$/), LocalizedAudioRef),
  sfx: z.array(z.string().regex(/^sfx\.[a-z0-9_]+$/)),
});
export type UiAudioFile = z.infer<typeof UiAudioFile>;

export const SkillsFile = z.object({ schemaVersion: z.literal(1), skills: z.array(SkillDefinition) });
export const VocabularyFile = z.object({ schemaVersion: z.literal(1), entries: z.array(VocabularyEntry) });
