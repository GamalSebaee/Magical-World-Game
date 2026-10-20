import { rawContent } from '@content/bundle';
import { ActivityDefinition, LevelDefinition, UiAudioFile, type LocalizedAudioRef } from '@content/schema';

/**
 * Activity definitions for the debug playground (04 §9): every activity of every level, plus
 * fixtures that exercise each mechanic's variants before Phase 4 levels exist. Fixtures use only
 * shared lines and vocabulary, so they also prove those are complete.
 */
const ui = UiAudioFile.parse(rawContent.uiAudio).lines;
const line = (id: string): LocalizedAudioRef => {
  const l = ui[id];
  if (!l) throw new Error(`playground: no shared line ${id}`);
  return l;
};

const FIXTURES: unknown[] = [
  {
    id: 'pg01.a1',
    mechanic: 'drag_drop',
    skills: ['color.identify.red', 'color.identify.blue', 'color.identify.yellow'],
    instruction: line('play.drag.instruction'),
    hints: [line('play.drag.hint1'), line('play.drag.hint2')],
    layout: 'items-and-targets',
    allowSkip: true,
    draggables: [
      { id: 'ball-red', asset: 'objects/ball-red', tags: ['color:red'], vocab: 'colors.red' },
      { id: 'ball-blue', asset: 'objects/ball-blue', tags: ['color:blue'], vocab: 'colors.blue' },
      { id: 'ball-yellow', asset: 'objects/ball-yellow', tags: ['color:yellow'], vocab: 'colors.yellow' },
    ],
    targets: [
      { id: 'box-red', asset: 'objects/box-red', accepts: ['color:red'] },
      { id: 'box-blue', asset: 'objects/box-blue', accepts: ['color:blue'] },
      { id: 'box-yellow', asset: 'objects/box-yellow', accepts: ['color:yellow'] },
    ],
    magnetAssist: true,
    completion: { type: 'all_placed' },
  },
  {
    id: 'pg02.a1',
    mechanic: 'drag_drop',
    skills: ['math.count.upto3', 'vocab.food.carrot'],
    instruction: line('play.count.instruction'),
    hints: [line('play.drag.hint1'), line('play.drag.hint2')],
    layout: 'items-and-targets',
    allowSkip: true,
    draggables: [1, 2, 3, 4].map((i) => ({ id: `carrot-${i}`, asset: 'objects/carrot', tags: ['carrot'], vocab: 'food.carrot' })),
    targets: [{ id: 'basket', asset: 'objects/basket', accepts: ['carrot'] }],
    magnetAssist: true,
    completion: { type: 'count_placed', n: 2 },
  },
  {
    id: 'pg03.a1',
    mechanic: 'match_pairs',
    skills: ['listen.sounds.cat', 'listen.sounds.dog'],
    instruction: line('play.match.instruction'),
    hints: [line('play.match.hint1')],
    layout: 'pairs',
    allowSkip: true,
    presentation: 'two-columns',
    pairs: [
      { id: 'cat', left: { asset: 'animals/cat', vocab: 'animals.cat' }, right: { asset: 'ui/sound-card', audio: 'sfx.animal_cat' }, skill: 'listen.sounds.cat' },
      { id: 'dog', left: { asset: 'animals/dog', vocab: 'animals.dog' }, right: { asset: 'ui/sound-card', audio: 'sfx.animal_dog' }, skill: 'listen.sounds.dog' },
    ],
    completion: { type: 'all_matched' },
  },
  {
    id: 'pg04.a1',
    mechanic: 'match_pairs',
    skills: ['color.identify.red', 'color.identify.blue', 'color.identify.yellow'],
    instruction: line('play.match.instruction'),
    hints: [line('play.match.hint1')],
    layout: 'pairs',
    allowSkip: true,
    presentation: 'two-columns',
    pairs: (['red', 'blue', 'yellow'] as const).map((c) => ({
      id: c,
      left: { asset: `objects/ball-${c}`, vocab: `colors.${c}` },
      right: { asset: `objects/box-${c}`, vocab: `colors.${c}` },
      skill: `color.identify.${c}`,
    })),
    completion: { type: 'all_matched' },
  },
  {
    id: 'pg05.a1',
    mechanic: 'count_objects',
    skills: ['math.count.upto3'],
    instruction: line('play.count.instruction'),
    hints: [line('play.count.hint1')],
    layout: 'count',
    allowSkip: true,
    ask: 'how_many',
    objects: [1, 2, 3].map((i) => ({ id: `apple-${i}`, asset: 'objects/apple' })),
    target: 3,
    answerChoices: [2, 3],
    question: line('play.count.how_many'),
    completion: { type: 'answered' },
  },
  {
    id: 'pg06.a1',
    mechanic: 'count_objects',
    skills: ['math.count.upto3', 'vocab.food.carrot'],
    instruction: line('play.count.instruction'),
    hints: [line('play.count.hint1')],
    layout: 'count',
    allowSkip: true,
    ask: 'tap_n',
    objects: [1, 2, 3, 4, 5].map((i) => ({ id: `carrot-${i}`, asset: 'objects/carrot' })),
    target: 3,
    basket: 'objects/basket',
    completion: { type: 'reached_target' },
  },
  {
    id: 'pg07.a1',
    mechanic: 'count_objects',
    skills: ['math.count.upto5'],
    instruction: line('play.count.instruction'),
    hints: [line('play.count.hint1')],
    layout: 'count',
    allowSkip: true,
    ask: 'how_many',
    objects: [1, 2, 3, 4, 5].map((i) => ({ id: `apple-${i}`, asset: 'objects/apple' })),
    target: 5,
    answerChoices: [3, 4, 5],
    completion: { type: 'answered' },
  },
];

export interface PlaygroundEntry {
  def: ActivityDefinition;
  /** Where it comes from: a level id, or "fixture". */
  source: string;
  background?: string;
}

export function playgroundEntries(): PlaygroundEntry[] {
  const fromLevels = Object.values(rawContent.levels).flatMap((raw) => {
    const lvl = LevelDefinition.parse(raw);
    return lvl.activities.map((def) => ({ def, source: lvl.id, background: lvl.background }));
  });
  const fixtures = FIXTURES.map((raw) => ({ def: ActivityDefinition.parse(raw), source: 'fixture' }));
  return [...fromLevels, ...fixtures];
}

/** Raw fixtures (for content tooling: manifests and validation). */
export const playgroundFixtures = (): ActivityDefinition[] => FIXTURES.map((raw) => ActivityDefinition.parse(raw));
