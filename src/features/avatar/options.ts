import type { AvatarConfig } from '@services/storage/records';

export type AvatarChoice = Omit<AvatarConfig, 'profileId' | 'version' | 'updatedAt'>;
export type AvatarCategory = 'hairStyle' | 'hairColor' | 'skinTone' | 'top' | 'bottom' | 'shoes' | 'accessory';

export interface Option {
  id: string;
  /** Accessible name for adults/screen readers. */
  label: { ar: string; en: string };
  /** Swatch / layer colour. */
  color?: string;
}

/** Minimum slice option set (07 §9); the full set arrives in Phase 6. All free, none locked. */
export const OPTIONS: Record<AvatarCategory, Option[]> = {
  hairStyle: [
    { id: 'curly', label: { ar: 'شعر كيرلي', en: 'Curly hair' } },
    { id: 'short', label: { ar: 'شعر قصير', en: 'Short hair' } },
    { id: 'braids', label: { ar: 'ضفاير', en: 'Braids' } },
    { id: 'hijab', label: { ar: 'طرحة', en: 'Hijab' } },
  ],
  hairColor: [
    { id: 'black', label: { ar: 'أسود', en: 'Black' }, color: '#2b2125' },
    { id: 'brown', label: { ar: 'بني', en: 'Brown' }, color: '#6b3f22' },
    { id: 'auburn', label: { ar: 'بني محمر', en: 'Auburn' }, color: '#a4482a' },
    { id: 'blonde', label: { ar: 'أشقر', en: 'Blonde' }, color: '#e2b34f' },
  ],
  skinTone: [
    { id: 's1', label: { ar: 'فاتح', en: 'Light' }, color: '#f8d9c0' },
    { id: 's2', label: { ar: 'قمحي فاتح', en: 'Light medium' }, color: '#e8b98f' },
    { id: 's3', label: { ar: 'قمحي', en: 'Medium' }, color: '#c98c5e' },
    { id: 's4', label: { ar: 'أسمر', en: 'Medium dark' }, color: '#9a6340' },
    { id: 's5', label: { ar: 'غامق', en: 'Dark' }, color: '#6a4029' },
  ],
  top: [
    { id: 'top-yellow', label: { ar: 'بلوزة صفرا', en: 'Yellow top' }, color: '#ffc93c' },
    { id: 'top-green', label: { ar: 'بلوزة خضرا', en: 'Green top' }, color: '#5dbb63' },
    { id: 'top-blue', label: { ar: 'بلوزة زرقا', en: 'Blue top' }, color: '#2e86de' },
  ],
  bottom: [
    { id: 'skirt-pink', label: { ar: 'جيبة بمبي', en: 'Pink skirt' }, color: '#f78fb3' },
    { id: 'pants-blue', label: { ar: 'بنطلون أزرق', en: 'Blue trousers' }, color: '#3a5a98' },
    { id: 'shorts-green', label: { ar: 'شورت أخضر', en: 'Green shorts' }, color: '#3d9b4f' },
  ],
  shoes: [
    { id: 'shoes-red', label: { ar: 'جزمة حمرا', en: 'Red shoes' }, color: '#e4572e' },
    { id: 'shoes-white', label: { ar: 'جزمة بيضا', en: 'White shoes' }, color: '#ffffff' },
    { id: 'shoes-purple', label: { ar: 'جزمة موف', en: 'Purple shoes' }, color: '#8e5bd0' },
  ],
  accessory: [
    { id: 'none', label: { ar: 'من غير', en: 'None' } },
    { id: 'glasses', label: { ar: 'نضارة', en: 'Glasses' } },
    { id: 'bow', label: { ar: 'فيونكة', en: 'Bow' } },
  ],
};

export const CATEGORY_ORDER: AvatarCategory[] = ['hairStyle', 'hairColor', 'skinTone', 'top', 'bottom', 'shoes', 'accessory'];

/** Spoken name of each category (ui-audio.json); accessory has captions only for now. */
export const CATEGORY_LINE: Partial<Record<AvatarCategory, string>> = {
  hairStyle: 'avatar.hair',
  hairColor: 'avatar.hair_color',
  skinTone: 'avatar.skin',
  top: 'avatar.top',
  bottom: 'avatar.bottom',
  shoes: 'avatar.shoes',
};

export const DEFAULT_AVATAR: AvatarChoice = {
  hairStyle: 'curly',
  hairColor: 'black',
  skinTone: 's3',
  top: 'top-yellow',
  bottom: 'skirt-pink',
  shoes: 'shoes-red',
  accessory: 'none',
};

export function colorOf(cat: AvatarCategory, id: string): string {
  return OPTIONS[cat].find((o) => o.id === id)?.color ?? '#999999';
}

export function randomAvatar(rand = Math.random): AvatarChoice {
  const pick = (c: AvatarCategory) => OPTIONS[c][Math.floor(rand() * OPTIONS[c].length)]!.id;
  return {
    hairStyle: pick('hairStyle'),
    hairColor: pick('hairColor'),
    skinTone: pick('skinTone'),
    top: pick('top'),
    bottom: pick('bottom'),
    shoes: pick('shoes'),
    accessory: pick('accessory'),
  };
}

/** Keeps saved avatars valid if an option is removed in a later version. */
export function normalizeAvatar(a: Partial<AvatarChoice> | undefined): AvatarChoice {
  const out = { ...DEFAULT_AVATAR };
  for (const c of CATEGORY_ORDER) {
    const v = a?.[c];
    if (v && OPTIONS[c].some((o) => o.id === v)) out[c] = v;
  }
  return out;
}
