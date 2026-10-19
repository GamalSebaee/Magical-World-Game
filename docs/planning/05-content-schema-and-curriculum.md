# 05 — Content Schema and Curriculum

## 1. Content model

```
src/content/
  index.json                      ContentIndex: version, worlds[], skills[], stickers[]
  skills.json                     SkillDefinition[]
  vocabulary.json                 VocabularyEntry[] (word id → ar/en written forms, audio ids, picture asset)
  worlds/<worldId>.world.json     WorldDefinition
  levels/<levelId>.level.json     LevelDefinition (activities inline)
  audio-manifest.json             AudioClip[] (id → file per language, transcript, review status)
  assets-manifest.json            image/sprite/atlas provenance (07 §7)
```

- Every file has `schemaVersion` (integer, the schema) and `contentVersion` (semver, the content). The build fails if any file fails validation, any referenced id is missing, or any audio/image file is absent from the manifests and disk.
- Runtime loading in production trusts build validation but still runs a cheap `safeParse` on the level being opened (guards against a stale SW cache serving mismatched content). Failure → that level shows the friendly error and other levels keep working.
- JSON Schema for editors is generated from the Zod schemas with `z.toJSONSchema()` into `src/content/schema/*.schema.json`, so JSON files get autocomplete.

## 2. ID conventions

| Kind | Pattern | Example |
|------|---------|---------|
| World | `[a-z]{2}` short code + name | `animal-forest` (code `af`) |
| Level | `<code>-<nn>` | `af-01` |
| Activity | `<code><nn>.a<n>` | `af01.a2` |
| Skill | `<domain>.<topic>.<item>` | `vocab.animals.cat`, `math.count.upto3`, `color.identify.red`, `shape.identify.circle`, `math.compare.more_less`, `speak.vocab.cat` |
| Vocabulary | `<topic>.<item>` | `animals.cat` |
| Audio clip | `<scope>.<purpose>.<detail>.<lang>` (lang appended in files, not ids) | `af01.prompt.where_dog`, `word.animals.cat`, `num.3`, `nono.praise.03` |
| Sticker | `sticker.<levelId>` | `sticker.af-01` |
| Asset | `<category>/<name>` | `animals/cat`, `ui/ear-button` |

Branded TypeScript types (`LevelId`, `ActivityId`, `SkillId`, `AudioClipId`…) prevent mixing ids.

## 3. Zod schemas (core excerpts)

```ts
import { z } from 'zod';

export const Lang = z.enum(['ar', 'en']);
export const LanguageMode = z.enum(['ar', 'en', 'mixed']);

/** Written text for adults/captions. Child never needs to read it. */
export const LocalizedText = z.object({
  ar: z.string().min(1),
  en: z.string().min(1),
  mixed: z.string().min(1).optional(),     // default: compose from ar with en target words isolated
});

/** Spoken content. Either a clip per language, or a sequence of clip ids (used for mixed mode). */
export const AudioClipId = z.string().regex(/^[a-z0-9]+(\.[a-z0-9_]+)+$/).brand<'AudioClipId'>();
/** In `ar`/`en` sequences ids resolve in that language. In `mixed` every id must pin a language: "word.animals.cat:en". */
export const PinnedClipId = z.string().regex(/^[a-z0-9]+(\.[a-z0-9_]+)+:(ar|en)$/);
export const AudioSequence = z.array(AudioClipId).min(1).max(4);
export const MixedSequence = z.array(PinnedClipId).min(1).max(4);
export const LocalizedAudioRef = z.object({
  ar: AudioSequence,
  en: AudioSequence,
  mixed: MixedSequence.optional(),          // default rule in §4.2
  caption: LocalizedText,                   // shown in parent/debug views and as subtitle option
});

export const SkillId = z.string().regex(/^(vocab|math|color|shape|speak|listen)\.[a-z_]+\.[a-z0-9_]+$/).brand<'SkillId'>();
export const AssetRef = z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/);

const Hints = z.tuple([LocalizedAudioRef]).rest(LocalizedAudioRef).refine(h => h.length <= 3);

const ActivityBase = z.object({
  id: z.string().regex(/^[a-z]{2}\d{2}\.a\d$/),
  skills: z.array(SkillId).min(1),
  instruction: LocalizedAudioRef,
  hints: Hints,
  layout: z.string(),
  allowSkip: z.literal(true),
  successFeedback: z.array(LocalizedAudioRef).min(1).optional(),  // falls back to Nono's praise pool
});

const TapDiscover = ActivityBase.extend({
  mechanic: z.literal('tap_discover'),
  mode: z.enum(['all', 'sequence']),
  items: z.array(z.object({
    id: z.string(),
    vocab: z.string(),                 // VocabularyEntry id → word audio + picture
    asset: AssetRef,
    hiddenBehind: AssetRef.optional(),
    revealAnimation: z.enum(['pop', 'peek', 'hop']),
  })).min(1).max(5),
  completion: z.object({ type: z.literal('all_found') }),
});

const ListenChoose = ActivityBase.extend({
  mechanic: z.literal('listen_choose'),
  shuffle: z.boolean(),
  rounds: z.array(z.object({
    prompt: LocalizedAudioRef,
    choices: z.array(z.object({ id: z.string(), vocab: z.string(), asset: AssetRef })).min(2).max(4),
    answer: z.string(),
  }).refine(r => r.choices.some(c => c.id === r.answer), 'answer must be one of choices')).min(1).max(4),
  completion: z.object({ type: z.literal('all_rounds') }),
});

const DragDrop = ActivityBase.extend({
  mechanic: z.literal('drag_drop'),
  draggables: z.array(z.object({ id: z.string(), asset: AssetRef, tags: z.array(z.string()), vocab: z.string().optional() })).min(1).max(6),
  targets: z.array(z.object({ id: z.string(), asset: AssetRef, accepts: z.array(z.string()) /* ids or tags */ })).min(1).max(3),
  magnetAssist: z.boolean().default(true),
  completion: z.discriminatedUnion('type', [
    z.object({ type: z.literal('all_placed') }),
    z.object({ type: z.literal('count_placed'), n: z.number().int().min(1).max(5) }),
  ]),
});

const MatchPairs = ActivityBase.extend({
  mechanic: z.literal('match_pairs'),
  presentation: z.enum(['two-columns', 'grid']),
  pairs: z.array(z.object({
    id: z.string(),
    left: z.object({ asset: AssetRef, audio: AudioClipId.optional() }),
    right: z.object({ asset: AssetRef, audio: AudioClipId.optional() }),
  })).min(2).max(4),
  completion: z.object({ type: z.literal('all_matched') }),
});

const CountObjects = ActivityBase.extend({
  mechanic: z.literal('count_objects'),
  ask: z.enum(['how_many', 'tap_n']),
  objects: z.array(z.object({ id: z.string(), asset: AssetRef })).min(1).max(5),
  target: z.number().int().min(1).max(5),
  answerChoices: z.array(z.number().int().min(1).max(5)).min(2).max(3).optional(),
  basket: AssetRef.optional(),                       // tap_n destination
  completion: z.object({ type: z.enum(['answered', 'reached_target']) }),
}).superRefine((a, ctx) => {
  if (a.ask === 'how_many' && a.objects.length !== a.target) ctx.addIssue({ code: 'custom', message: 'how_many: target must equal objects.length' });
  if (a.ask === 'how_many' && !a.answerChoices?.includes(a.target)) ctx.addIssue({ code: 'custom', message: 'answerChoices must include target' });
  if (a.ask === 'tap_n' && a.objects.length < a.target) ctx.addIssue({ code: 'custom', message: 'tap_n: need at least target objects' });
});

const SpeakRepeat = ActivityBase.extend({
  mechanic: z.literal('speak_repeat'),
  vocab: z.string(),
  picture: AssetRef,
  model: LocalizedAudioRef,
  maxRecordMs: z.number().int().min(2000).max(8000).default(5000),
  attemptsBeforeAutoContinue: z.number().int().min(1).max(3).default(2),
  recognition: z.enum(['off', 'optional']),
  completion: z.object({ type: z.literal('any_attempt_or_skip') }),
});

export const ActivityDefinition = z.discriminatedUnion('mechanic', [
  TapDiscover, ListenChoose, DragDrop, MatchPairs, CountObjects, SpeakRepeat,
]);

export const LevelDefinition = z.object({
  schemaVersion: z.literal(1),
  contentVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  id: z.string().regex(/^[a-z]{2}-\d{2}$/),
  worldId: z.string(),
  order: z.number().int().min(1).max(4),
  title: LocalizedText,
  learningGoal: LocalizedText,                    // parent-facing
  story: z.object({ intro: LocalizedAudioRef, outro: LocalizedAudioRef, illustration: AssetRef }),
  skills: z.array(SkillId).min(1),
  activities: z.array(ActivityDefinition).min(2).max(4),
  sticker: z.object({ id: z.string(), asset: AssetRef, name: LocalizedAudioRef }),
  assetPack: z.string(),                          // world pack id; preload unit
  estimatedMinutes: z.tuple([z.number(), z.number()]),
  suggestedNext: z.array(z.string()).max(2),      // optional hints; never gates
}).superRefine((lvl, ctx) => {
  const ids = new Set<string>();
  for (const a of lvl.activities) {
    if (ids.has(a.id)) ctx.addIssue({ code: 'custom', message: `duplicate activity id ${a.id}` });
    ids.add(a.id);
    for (const s of a.skills) if (!lvl.skills.includes(s)) ctx.addIssue({ code: 'custom', message: `${a.id} skill ${s} not declared on level` });
  }
});

export const WorldDefinition = z.object({
  schemaVersion: z.literal(1),
  contentVersion: z.string(),
  id: z.string(), code: z.string().length(2),
  name: LocalizedText, nameAudio: LocalizedAudioRef, welcome: LocalizedAudioRef,
  mapHotspot: z.object({ asset: AssetRef, position: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }) }),
  levels: z.array(z.string()).length(4),
  assetPack: z.string(),
});

export const SkillDefinition = z.object({
  id: SkillId,
  domain: z.enum(['vocab', 'math', 'color', 'shape', 'speak', 'listen']),
  label: LocalizedText,
  outcome: LocalizedText,                         // "Recognizes the spoken word 'cat' and picks its picture"
  evidenceRule: z.string(),                       // id of a rule in features/learning/evidenceRules.ts
});
```

Cross-file checks (build script `content:validate`):
1. Every `vocab`, `AudioClipId`, `AssetRef`, `skill`, `sticker` reference resolves.
2. Every audio clip referenced for each language exists on disk and has `review.status === 'approved'` in release builds (placeholders allowed in dev with a visible "placeholder audio" flag).
3. Each world lists exactly its 4 levels; each level's `worldId` matches.
4. No `suggestedNext` value creates any gate (it is just data; checked that the UI code has no completion-based disabled state, see T-NAV-03).
5. Total precache size per asset pack is within budget (07 §10).

## 4. Localization model

### 4.1 Language modes

| Mode | UI direction | Spoken prompts | Target words |
|------|--------------|----------------|--------------|
| `ar` | RTL | Arabic (Egyptian-friendly carrier phrases) | Arabic |
| `en` | LTR | English | English |
| `mixed` | RTL (Arabic-first) | Arabic carrier phrase | Arabic word, then English word ("دي قطة… Cat!") |

### 4.2 Mixed-mode composition rule

If `mixed` is not given for a `LocalizedAudioRef`, the resolver uses `ar`. For vocabulary moments (tap_discover reveals, listen_choose praise, speak_repeat model) the level author supplies an explicit `mixed` sequence like `["af01.say.this_is:ar", "word.animals.cat:ar", "word.animals.cat:en"]`. Mixed mode introduces English gradually: in a level's first activity the English word follows the Arabic; in later activities `listen_choose` prompts may use the English word alone after the Arabic carrier ("فين الـ Dog؟"). Captions use `<bdi>`/`dir="auto"` isolation for embedded English inside Arabic text.

### 4.3 Dialect and register policy

- **Spoken carrier phrases** (instructions, praise, story) use warm, simple Egyptian-friendly Arabic ("يلا نلعب", "فين القطة؟", "برافو!", "شاطر/ة" avoided, see below).
- **Written vocabulary** uses accurate standard spelling (قِطّة، كَلْب، أَرْنَب، جَزَرة، أَحْمَر، أَزْرَق، أَصْفَر، دائِرة، مُرَبَّع، مُثَلَّث). Optional tashkeel on captions.
- **Vocabulary word clips** — pronunciation choice (Egyptian /ʔoṭṭa/ vs standard /qiṭṭa/) is open question 12 Q4; default: standard pronunciation for the isolated word (matches the written form and school use), Egyptian register for carrier phrases.
- **Gender-neutral address.** Arabic imperatives are gendered (المِسي / المِس). All prompts use first-person plural ("يلا نلمس", "نعدّ سوا") or neutral praise ("برافو!", "هايل!", "جميل!") so one clip serves every child. Review checklist item.
- **Numbers.** Spoken counting in carrier style ("واحد، اتنين، تلاتة، أربعة، خمسة") is an open decision bundled with Q4. Digit glyphs follow the parent setting (Eastern Arabic ١٢٣ default in Arabic mode; 12 Q7).
- **No machine translation shipped unreviewed.** Every script line has `review: { by, date, status }` in the audio manifest.

## 5. Curriculum and outcomes

Outcomes are written as observable behaviours. "Demonstrated" means observed through activities on this device, per the evidence rules in 08 §5; it is not a formal assessment.

| World | Skill ids | Outcome (observable) |
|-------|-----------|----------------------|
| Animal Forest | `vocab.animals.{cat,dog,rabbit,cow,duck,bird}` | Hears the word (ar/en) and picks the right animal picture |
| | `listen.sounds.{cat,dog,cow,duck}` | Matches an animal sound to the animal |
| | `math.count.upto3` | Counts up to 3 objects, one tap per object, and gives the total |
| | `speak.vocab.{cat,dog,cow}` | Tries saying the word after the model (practice only) |
| Color Town | `color.identify.{red,blue,yellow,green}` | Picks or sorts objects by a spoken color |
| | `shape.identify.{circle,square,triangle}` | Picks a spoken shape; matches same shape |
| | `speak.vocab.{red,circle}` | Tries saying the word |
| Number Island | `math.count.upto3`, `math.count.upto5` | Counts objects and selects the matching numeral |
| | `math.numeral.{1..5}` | Recognizes numerals 1–5 (Eastern or Western glyph per setting) |
| | `math.compare.more_less` | Chooses the group with more / fewer (differences ≥ 2 at first) |
| | `speak.vocab.num3` | Tries saying a number word |

Progression without gating: levels in a world move from introduce → practice → combine → story review. The order is suggested by `order` and `suggestedNext`, shown as a sparkle only. A child who starts with NI-04 gets the same help: every level re-introduces its words in its first activity.

## 6. World and level example

World excerpt:

```json
{
  "schemaVersion": 1,
  "contentVersion": "0.1.0",
  "id": "animal-forest",
  "code": "af",
  "name": { "ar": "غابة الحيوانات", "en": "Animal Forest" },
  "nameAudio": { "ar": ["world.af.name"], "en": ["world.af.name"], "caption": { "ar": "غابة الحيوانات", "en": "Animal Forest" } },
  "welcome":   { "ar": ["world.af.welcome"], "en": ["world.af.welcome"], "caption": { "ar": "أهلاً في غابة الحيوانات!", "en": "Welcome to Animal Forest!" } },
  "mapHotspot": { "asset": "map/animal-forest", "position": { "x": 0.22, "y": 0.58 } },
  "levels": ["af-01", "af-02", "af-03", "af-04"],
  "assetPack": "pack.animal-forest"
}
```

(Audio clip ids are language-neutral; the resolver appends the language to find `/assets/audio/ar/world.af.name.mp3` or `/assets/audio/en/world.af.name.mp3`.)

The complete AF-01 level is in [`examples/af-01.level.json`](examples/af-01.level.json) and is described in [05a](05a-level-catalog.md#af-01-meet-cat--dog).

## 7. Versioning

- `schemaVersion` bumps on breaking schema changes; a migration function upgrades older content during the build only (content is bundled, so runtime never sees mixed schema versions).
- `contentVersion` bumps when a level's content changes. Saved activity snapshots are keyed to it; a changed version discards the mid-activity snapshot but never the completion or stickers (they are keyed by level id, not content version).
