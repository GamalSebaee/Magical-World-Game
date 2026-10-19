import { z } from 'zod';
import { AssetRef, AudioClipId } from './common';

/**
 * Review status. `planned` = referenced by content but no file produced yet (allowed outside
 * release builds); `placeholder` = functional stand-in file; `approved` = passed review.
 */
export const ReviewStatus = z.enum(['planned', 'placeholder', 'draft', 'review', 'approved']);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

const Review = z.object({
  status: ReviewStatus,
  by: z.string().nullable().default(null),
  date: z.string().nullable().default(null),
  notes: z.string().default(''),
});

export const AudioClipEntry = z
  .object({
    id: AudioClipId,
    kind: z.enum(['voice', 'sfx', 'music']),
    /** Paths relative to /public, per language (voice) or `common` (sfx/music). */
    files: z.object({ ar: z.string().optional(), en: z.string().optional(), common: z.string().optional() }),
    transcript: z.object({ ar: z.string().optional(), en: z.string().optional() }).default({}),
    source: z.string().default('unassigned'),
    licence: z.string().default('unassigned'),
    review: z.object({ ar: Review.optional(), en: Review.optional(), common: Review.optional() }),
    durationMs: z.object({ ar: z.number().optional(), en: z.number().optional(), common: z.number().optional() }).default({}),
    pack: z.string().regex(/^pack\.[a-z-]+$/),
  })
  .superRefine((c, ctx) => {
    // Voice clips exist per language (a mixed-mode carrier may be Arabic only); SFX/music are common.
    const keys = c.kind === 'voice' ? (['ar', 'en'] as const).filter((k) => c.files[k]) : (['common'] as const);
    if (keys.length === 0) ctx.addIssue({ code: 'custom', message: `${c.id}: no files` });
    for (const k of keys) {
      if (!c.files[k]) ctx.addIssue({ code: 'custom', message: `${c.id}: missing files.${k}` });
      if (!c.review[k]) ctx.addIssue({ code: 'custom', message: `${c.id}: missing review.${k}` });
    }
  });
export type AudioClipEntry = z.infer<typeof AudioClipEntry>;

export const AudioManifest = z.object({
  schemaVersion: z.literal(1),
  clips: z.array(AudioClipEntry),
});
export type AudioManifest = z.infer<typeof AudioManifest>;

export const AssetEntry = z.object({
  id: AssetRef,
  type: z.enum(['image', 'sprite-atlas-frames', 'background', 'sticker', 'ui-svg']),
  pack: z.string().regex(/^pack\.[a-z-]+$/),
  files: z.array(z.string()),
  displaySize1x: z.object({ w: z.number().positive(), h: z.number().positive() }).nullable().default(null),
  source: z.enum(['custom-vector', 'cc0', 'cc-by', 'ai-assisted', 'commissioned', 'unassigned']),
  creator: z.string().nullable().default(null),
  aiAssisted: z.boolean().default(false),
  licence: z.object({
    type: z.string(),
    url: z.string().nullable().default(null),
    attributionRequired: z.boolean().default(false),
  }),
  status: ReviewStatus,
  review: Review.omit({ status: true }).default({ by: null, date: null, notes: '' }),
});
export type AssetEntry = z.infer<typeof AssetEntry>;

export const AssetManifest = z.object({
  schemaVersion: z.literal(1),
  assets: z.array(AssetEntry),
});
export type AssetManifest = z.infer<typeof AssetManifest>;
