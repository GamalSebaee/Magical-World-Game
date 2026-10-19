/** Parent gate challenge (P1): a written two-step instruction among six coloured shapes. */
export const GATE_SHAPES = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond'] as const;
export const GATE_COLORS = ['red', 'blue', 'yellow', 'green', 'purple', 'orange'] as const;
export type GateShape = (typeof GATE_SHAPES)[number];
export type GateColor = (typeof GATE_COLORS)[number];

export interface GateTile {
  id: string;
  shape: GateShape;
  color: GateColor;
}

export interface GateChallenge {
  tiles: GateTile[];
  /** Tile ids to tap, in order. */
  answer: [string, string];
}

const NAMES = {
  en: {
    shape: { circle: 'circle', square: 'square', triangle: 'triangle', star: 'star', heart: 'heart', diamond: 'diamond' },
    color: { red: 'red', blue: 'blue', yellow: 'yellow', green: 'green', purple: 'purple', orange: 'orange' },
  },
  ar: {
    shape: { circle: 'الدائرة', square: 'المربع', triangle: 'المثلث', star: 'النجمة', heart: 'القلب', diamond: 'المعيّن' },
    color: { red: 'الحمراء', blue: 'الزرقاء', yellow: 'الصفراء', green: 'الخضراء', purple: 'البنفسجية', orange: 'البرتقالية' },
  },
} as const;

export function tileName(t: GateTile, lang: 'ar' | 'en'): string {
  return lang === 'en' ? `${NAMES.en.color[t.color]} ${NAMES.en.shape[t.shape]}` : `${NAMES.ar.shape[t.shape]} ${NAMES.ar.color[t.color]}`;
}

export function instruction(c: GateChallenge, lang: 'ar' | 'en'): string {
  const [a, b] = c.answer.map((id) => tileName(c.tiles.find((t) => t.id === id)!, lang));
  return lang === 'en' ? `Tap the ${a}, then the ${b}.` : `اضغط على ${a}، ثم على ${b}.`;
}

/** Six tiles with distinct shapes and colours, so every name is unambiguous. */
export function makeChallenge(rand = Math.random): GateChallenge {
  const shuffle = <T,>(xs: readonly T[]) => [...xs].map((x) => [rand(), x] as const).sort((p, q) => p[0] - q[0]).map(([, x]) => x);
  const shapes = shuffle(GATE_SHAPES);
  const colors = shuffle(GATE_COLORS);
  const tiles = shapes.map((shape, i) => ({ id: `t${i}`, shape, color: colors[i]! }));
  const [a, b] = shuffle(tiles.map((t) => t.id));
  return { tiles, answer: [a!, b!] };
}

export const GATE_HOLD_MS = 2000;
export const GATE_MAX_FAILS = 3;
export const GATE_COOLDOWN_MS = 30_000;
export const PARENT_SESSION_MS = 10 * 60 * 1000;
