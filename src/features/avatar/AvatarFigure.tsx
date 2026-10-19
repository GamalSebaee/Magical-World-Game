import type { AvatarChoice } from './options';
import { colorOf } from './options';

const INK = '#2d3047';

/**
 * Layered avatar (07 §5): every layer is drawn on the same 200×300 canvas with the same origin,
 * back → front: hair-back, body/skin, shoes, bottom, top, head, face, hair-front, accessory.
 * Placeholder vector art; final layered sprites replace it without changing AvatarConfig.
 */
export function AvatarFigure({ avatar, size = 200, title, className }: { avatar: AvatarChoice; size?: number; title?: string; className?: string }) {
  const skin = colorOf('skinTone', avatar.skinTone);
  const hair = colorOf('hairColor', avatar.hairColor);
  const top = colorOf('top', avatar.top);
  const bottom = colorOf('bottom', avatar.bottom);
  const shoes = colorOf('shoes', avatar.shoes);
  const isSkirt = avatar.bottom.startsWith('skirt');
  const isShorts = avatar.bottom.startsWith('shorts');
  const hijab = avatar.hairStyle === 'hijab';

  return (
    <svg width={(size * 2) / 3} height={size} viewBox="0 0 200 300" role="img" aria-label={title} data-testid="avatar" data-placeholder="true" className={className}>
      {/* hair-back */}
      {avatar.hairStyle === 'braids' && (
        <g fill={hair} stroke={INK} strokeWidth="4">
          <ellipse cx="52" cy="120" rx="13" ry="36" />
          <ellipse cx="148" cy="120" rx="13" ry="36" />
        </g>
      )}
      {avatar.hairStyle === 'curly' && <circle cx="100" cy="78" r="62" fill={hair} stroke={INK} strokeWidth="4" />}
      {hijab && <path d="M40 92 C40 30 160 30 160 92 L168 170 Q100 196 32 170 Z" fill={hair} stroke={INK} strokeWidth="4" />}
      {/* body (arms, legs) */}
      <g stroke={INK} strokeWidth="4" fill={skin}>
        <rect x="46" y="150" width="20" height="62" rx="10" />
        <rect x="134" y="150" width="20" height="62" rx="10" />
        <rect x="78" y="220" width="18" height={isShorts || isSkirt ? 56 : 30} rx="8" />
        <rect x="104" y="220" width="18" height={isShorts || isSkirt ? 56 : 30} rx="8" />
      </g>
      {/* shoes */}
      <g fill={shoes} stroke={INK} strokeWidth="4">
        <rect x="70" y="270" width="30" height="18" rx="9" />
        <rect x="100" y="270" width="30" height="18" rx="9" />
      </g>
      {/* bottom */}
      <g fill={bottom} stroke={INK} strokeWidth="4" strokeLinejoin="round">
        {isSkirt ? (
          <path d="M70 200 H130 L146 246 H54 Z" />
        ) : isShorts ? (
          <path d="M72 200 H128 L130 240 H104 L100 222 L96 240 H70 Z" />
        ) : (
          <path d="M72 200 H128 L126 276 H104 L100 230 L96 276 H74 Z" />
        )}
      </g>
      {/* top */}
      <path d="M62 150 Q100 134 138 150 L134 210 H66 Z" fill={top} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      {/* head */}
      <rect x="90" y="124" width="20" height="20" fill={skin} stroke={INK} strokeWidth="4" />
      <circle cx="100" cy="90" r="46" fill={skin} stroke={INK} strokeWidth="4" />
      {/* face */}
      <circle cx="84" cy="92" r="6" fill={INK} />
      <circle cx="116" cy="92" r="6" fill={INK} />
      <circle cx="86" cy="90" r="2" fill="#fff" />
      <circle cx="118" cy="90" r="2" fill="#fff" />
      <circle cx="74" cy="106" r="7" fill="#f78fb3" opacity="0.5" />
      <circle cx="126" cy="106" r="7" fill="#f78fb3" opacity="0.5" />
      <path d="M88 112 Q100 122 112 112" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      {/* hair-front */}
      {avatar.hairStyle === 'curly' && (
        <g fill={hair} stroke={INK} strokeWidth="4">
          <circle cx="70" cy="58" r="16" />
          <circle cx="96" cy="46" r="18" />
          <circle cx="124" cy="54" r="17" />
        </g>
      )}
      {avatar.hairStyle === 'short' && <path d="M54 84 C54 34 146 34 146 84 C130 64 110 58 94 66 C80 58 66 66 54 84 Z" fill={hair} stroke={INK} strokeWidth="4" />}
      {avatar.hairStyle === 'braids' && <path d="M54 88 C54 36 146 36 146 88 C132 60 70 60 54 88 Z" fill={hair} stroke={INK} strokeWidth="4" />}
      {hijab && <path d="M50 92 C50 38 150 38 150 92 C140 60 60 60 50 92 Z" fill={hair} stroke={INK} strokeWidth="4" />}
      {/* accessory */}
      {avatar.accessory === 'glasses' && (
        <g fill="none" stroke={INK} strokeWidth="4">
          <circle cx="84" cy="92" r="12" />
          <circle cx="116" cy="92" r="12" />
          <path d="M96 92 H104" />
        </g>
      )}
      {avatar.accessory === 'bow' && (
        <g fill="#e4572e" stroke={INK} strokeWidth="4" strokeLinejoin="round">
          <path d="M120 40 L144 28 L144 54 Z" />
          <path d="M120 40 L96 28 L96 54 Z" />
          <circle cx="120" cy="41" r="6" />
        </g>
      )}
    </svg>
  );
}
