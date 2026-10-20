import { z } from 'zod';
import { AssetRef, AudioClipId, LocalizedAudioRef, SkillId, VocabId } from './common';

const Hints = z
  .array(LocalizedAudioRef)
  .min(1)
  .max(3, 'at most 3 progressive hints');

const ActivityBase = z.object({
  id: z.string().regex(/^[a-z]{2}\d{2}\.a\d$/, 'activity id like "af01.a1"'),
  skills: z.array(SkillId).min(1),
  instruction: LocalizedAudioRef,
  hints: Hints,
  layout: z.string().min(1),
  allowSkip: z.literal(true),
  successFeedback: z.array(LocalizedAudioRef).min(1).optional(),
});

export const TapDiscoverDef = ActivityBase.extend({
  mechanic: z.literal('tap_discover'),
  mode: z.enum(['all', 'sequence']),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        vocab: VocabId,
        asset: AssetRef,
        hiddenBehind: AssetRef.optional(),
        revealAnimation: z.enum(['pop', 'peek', 'hop']),
      }),
    )
    .min(1)
    .max(5),
  completion: z.object({ type: z.literal('all_found') }),
});

const Choice = z.object({ id: z.string().min(1), vocab: VocabId, asset: AssetRef });

export const ListenChooseDef = ActivityBase.extend({
  mechanic: z.literal('listen_choose'),
  shuffle: z.boolean(),
  rounds: z
    .array(
      z
        .object({
          prompt: LocalizedAudioRef,
          choices: z.array(Choice).min(2).max(4),
          answer: z.string(),
        })
        .refine((r) => r.choices.some((c) => c.id === r.answer), 'answer must be one of choices'),
    )
    .min(1)
    .max(4),
  completion: z.object({ type: z.literal('all_rounds') }),
});

export const DragDropDef = ActivityBase.extend({
  mechanic: z.literal('drag_drop'),
  draggables: z
    .array(z.object({ id: z.string(), asset: AssetRef, tags: z.array(z.string()), vocab: VocabId.optional() }))
    .min(1)
    .max(6),
  targets: z
    .array(z.object({ id: z.string(), asset: AssetRef, accepts: z.array(z.string()).min(1) }))
    .min(1)
    .max(3),
  magnetAssist: z.boolean(),
  completion: z.discriminatedUnion('type', [
    z.object({ type: z.literal('all_placed') }),
    z.object({ type: z.literal('count_placed'), n: z.number().int().min(1).max(5) }),
  ]),
}).superRefine((a, ctx) => {
  const ok = (d: (typeof a.draggables)[number]) => a.targets.some((t) => t.accepts.includes(d.id) || d.tags.some((tag) => t.accepts.includes(tag)));
  if (a.completion.type === 'all_placed') {
    for (const d of a.draggables) if (!ok(d)) ctx.addIssue({ code: 'custom', message: `draggable ${d.id} has no accepting target` });
  } else if (a.draggables.filter(ok).length < a.completion.n) {
    ctx.addIssue({ code: 'custom', message: 'count_placed: fewer acceptable draggables than n' });
  }
});

/** A card: its picture, an optional sound (SFX clip, e.g. "moo") and an optional word. */
const PairSide = z.object({ asset: AssetRef, audio: AudioClipId.optional(), vocab: VocabId.optional() });

export const MatchPairsDef = ActivityBase.extend({
  mechanic: z.literal('match_pairs'),
  presentation: z.enum(['two-columns', 'grid']),
  pairs: z
    .array(
      z.object({
        id: z.string(),
        left: PairSide,
        right: PairSide,
        /** Skill a correct match evidences (must be one of the activity's skills). */
        skill: SkillId.optional(),
      }),
    )
    .min(2)
    .max(4),
  completion: z.object({ type: z.literal('all_matched') }),
}).superRefine((a, ctx) => {
  for (const p of a.pairs) {
    if (p.skill && !a.skills.includes(p.skill)) ctx.addIssue({ code: 'custom', message: `pair ${p.id}: skill ${p.skill} is not in the activity's skills` });
  }
  if (new Set(a.pairs.map((p) => p.id)).size !== a.pairs.length) ctx.addIssue({ code: 'custom', message: 'pair ids must be unique' });
});

export const CountObjectsDef = ActivityBase.extend({
  mechanic: z.literal('count_objects'),
  ask: z.enum(['how_many', 'tap_n']),
  objects: z.array(z.object({ id: z.string(), asset: AssetRef })).min(1).max(5),
  target: z.number().int().min(1).max(5),
  answerChoices: z.array(z.number().int().min(1).max(5)).min(2).max(3).optional(),
  basket: AssetRef.optional(),
  /** how_many: the question after counting ("How many?"); defaults to the shared line. */
  question: LocalizedAudioRef.optional(),
  completion: z.object({ type: z.enum(['answered', 'reached_target']) }),
}).superRefine((a, ctx) => {
  if (a.ask === 'how_many' && a.objects.length !== a.target) {
    ctx.addIssue({ code: 'custom', message: 'how_many: target must equal objects.length' });
  }
  if (a.ask === 'how_many' && !a.answerChoices?.includes(a.target)) {
    ctx.addIssue({ code: 'custom', message: 'how_many: answerChoices must include target' });
  }
  if (a.ask === 'tap_n' && a.objects.length < a.target) {
    ctx.addIssue({ code: 'custom', message: 'tap_n: need at least `target` objects' });
  }
});

export const SpeakRepeatDef = ActivityBase.extend({
  mechanic: z.literal('speak_repeat'),
  vocab: VocabId,
  picture: AssetRef,
  model: LocalizedAudioRef,
  maxRecordMs: z.number().int().min(2000).max(8000),
  attemptsBeforeAutoContinue: z.number().int().min(1).max(3),
  recognition: z.enum(['off', 'optional']),
  completion: z.object({ type: z.literal('any_attempt_or_skip') }),
});

export const ActivityDefinition = z.discriminatedUnion('mechanic', [
  TapDiscoverDef,
  ListenChooseDef,
  DragDropDef,
  MatchPairsDef,
  CountObjectsDef,
  SpeakRepeatDef,
]);
export type ActivityDefinition = z.infer<typeof ActivityDefinition>;
export type Mechanic = ActivityDefinition['mechanic'];
export const MECHANICS = [
  'tap_discover',
  'listen_choose',
  'drag_drop',
  'match_pairs',
  'count_objects',
  'speak_repeat',
] as const satisfies readonly Mechanic[];
