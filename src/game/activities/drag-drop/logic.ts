import type { ActivityDefinition } from '@content/schema';
import type { MechanicLogic, Outcome, SayItem } from '@game/core/engine/types';
import type { Rect } from '@game/core/viewport';

type Def = Extract<ActivityDefinition, { mechanic: 'drag_drop' }>;
type Draggable = Def['draggables'][number];
type Target = Def['targets'][number];

export interface DragDropState {
  /** draggable id → target id, in placement order. */
  placed: Array<[string, string]>;
  /** Tap-then-tap alternative input: the draggable picked up by a tap. */
  selected?: string;
}

/** A target accepts a draggable by its id or by any of its tags (e.g. `color:red`). */
export function accepts(target: Target, item: Draggable): boolean {
  return target.accepts.includes(item.id) || item.tags.some((t) => target.accepts.includes(t));
}

const placedCount = (m: DragDropState) => m.placed.length;
const isPlaced = (m: DragDropState, id: string) => m.placed.some(([d]) => d === id);

function goal(def: Def): number {
  return def.completion.type === 'count_placed' ? def.completion.n : def.draggables.length;
}

const numberWord = (n: number): SayItem => ({ vocab: `numbers.${n}` });

/** drag_drop (04 §4.3): drag (or tap, then tap) each item onto an accepting target. */
export const dragDropLogic: MechanicLogic<Def, DragDropState> = {
  mechanic: 'drag_drop',

  init: () => ({ placed: [] }),

  apply(def, m, input, ctx) {
    let itemId: string;
    let targetId: string | null;
    if (input.type === 'drop') {
      itemId = input.itemId;
      targetId = input.targetId;
    } else if (input.type === 'tap') {
      const item = def.draggables.find((d) => d.id === input.targetId);
      if (item) {
        // A tap on an item (no movement) says its name and picks it up for tap-then-tap.
        if (isPlaced(m, item.id)) return null;
        return {
          m: { ...m, selected: item.id },
          outcome: { kind: 'partial', evidence: [], say: item.vocab ? [{ vocab: item.vocab }] : [], sfx: 'sfx.tap', targetId: item.id, anim: 'select', inline: 'interrupt' },
        };
      }
      if (!m.selected || !def.targets.some((t) => t.id === input.targetId)) return null;
      itemId = m.selected;
      targetId = input.targetId;
    } else return null;

    const item = def.draggables.find((d) => d.id === itemId);
    if (!item || isPlaced(m, item.id)) return null;
    const cleared: DragDropState = { ...m, selected: undefined };

    // Released nowhere: it slides home. No penalty, no words.
    const target = targetId ? def.targets.find((t) => t.id === targetId) : undefined;
    if (!target) {
      return { m: cleared, outcome: { kind: 'partial', evidence: [], say: [], sfx: 'sfx.boop', targetId: item.id, anim: 'bounce', inline: 'interrupt' } };
    }

    const n = goal(def);
    // Already full: bounce back kindly ("that's 3!"), the count stays.
    if (placedCount(m) >= n) {
      return {
        m: cleared,
        outcome: { kind: 'partial', evidence: [], say: [{ ui: 'play.count.thats' }, numberWord(n)], sfx: 'sfx.boop', targetId: item.id, anim: 'bounce', inline: 'queue' },
      };
    }

    const skill = item.vocab ? ctx.skillForVocab(item.vocab) : undefined;
    if (!accepts(target, item)) {
      // Wrong target: back home, and Nono names the item (e.g. its color) as the hint.
      return {
        m: cleared,
        outcome: {
          kind: 'not_yet',
          evidence: skill ? [{ skillId: skill, kind: 'choice_not_yet' }] : [],
          say: item.vocab ? [{ vocab: item.vocab }] : [{ ui: 'nono.notyet.02' }],
          sfx: 'sfx.boop',
          targetId: item.id,
          anim: 'bounce',
        },
      };
    }

    const placed: DragDropState = { placed: [...m.placed, [item.id, target.id]] };
    const count = placed.placed.length;
    const done = count >= n;
    const counting = def.completion.type === 'count_placed';
    const say: SayItem[] = counting ? [numberWord(count)] : item.vocab ? [{ vocab: item.vocab }] : [];
    const outcome: Outcome = {
      kind: done ? 'correct' : 'partial',
      evidence: skill ? [{ skillId: skill, kind: 'choice_correct', firstTry: true }] : [],
      say: done ? [...say, { praise: true }] : say,
      sfx: done ? 'sfx.sparkle' : 'sfx.pop',
      targetId: item.id,
      targetIds: [item.id, target.id],
      anim: 'place',
    };
    // Counting drops keep the child going; each number waits its turn (04 §4.3 "counting drops").
    if (!done) outcome.inline = counting ? 'queue' : 'interrupt';
    return { m: placed, outcome };
  },

  isComplete: (def, m) => placedCount(m) >= goal(def),
  prompt: (def) => def.instruction,
  hintTarget: (def, m) => (m.selected ? targetFor(def, m.selected) : def.draggables.find((d) => !isPlaced(m, d.id))?.id),
};

function targetFor(def: Def, itemId: string): string | undefined {
  const item = def.draggables.find((d) => d.id === itemId);
  return item ? def.targets.find((t) => accepts(t, item))?.id : undefined;
}

/** The target an item's drag should go to (for the demo hand at hint level 3). */
export function hintDestination(def: Def, m: DragDropState): { itemId: string; targetId: string } | undefined {
  const item = def.draggables.find((d) => !isPlaced(m, d.id));
  const targetId = item && targetFor(def, item.id);
  return item && targetId ? { itemId: item.id, targetId } : undefined;
}

export interface Point {
  x: number;
  y: number;
}

export const DROP_EXPAND = 0.4;
export const DROP_MIN_PX = 120;
export const MAGNET_FRACTION = 0.6;
export const DRAG_START_PX = 6;

/** A target's forgiving drop zone: its bounds grown by 40%, at least 120 px square (04 §4.3). */
export function dropZone(r: Rect): Rect {
  const w = Math.max(DROP_MIN_PX, r.width * (1 + DROP_EXPAND));
  const h = Math.max(DROP_MIN_PX, r.height * (1 + DROP_EXPAND));
  return { x: r.x + r.width / 2 - w / 2, y: r.y + r.height / 2 - h / 2, width: w, height: h };
}

const contains = (r: Rect, p: Point) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
const centre = (r: Rect): Point => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Which target a release lands on, with the child-friendly forgiveness of 04 §4.3:
 * 1. the release point is inside a target's expanded zone (nearest centre wins), else
 * 2. magnet: the item's centre travelled ≥ 60% of the way from home to an accepting target and is
 *    closer to it than to any other target.
 * Returns null when it lands nowhere.
 */
export function resolveDrop(opts: {
  release: Point;
  itemStart: Point;
  itemNow: Point;
  targets: Array<{ id: string; rect: Rect; accepting: boolean }>;
  magnet: boolean;
}): string | null {
  const hits = opts.targets.filter((t) => contains(dropZone(t.rect), opts.release));
  if (hits.length) {
    return hits.reduce((a, b) => (dist(centre(a.rect), opts.release) <= dist(centre(b.rect), opts.release) ? a : b)).id;
  }
  if (!opts.magnet || opts.targets.length === 0) return null;
  const nearest = opts.targets.reduce((a, b) => (dist(centre(a.rect), opts.itemNow) <= dist(centre(b.rect), opts.itemNow) ? a : b));
  if (!nearest.accepting) return null;
  const c = centre(nearest.rect);
  const total = dist(opts.itemStart, c);
  if (total === 0) return nearest.id;
  const travelled = total - dist(opts.itemNow, c);
  return travelled / total >= MAGNET_FRACTION ? nearest.id : null;
}
