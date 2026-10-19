/**
 * Simple inline SVG icons for the shell. Navigation arrows mirror in RTL (`rtl:-scale-x-100`);
 * media symbols such as Play do not, by convention.
 */
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function PlayIcon({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path d="M16 10 L38 24 L16 38 Z" fill="var(--color-leaf-500)" stroke="var(--color-ink-700)" strokeWidth={3} strokeLinejoin="round" />
    </svg>
  );
}

export function HomeIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" {...base}>
      <path d="M8 22 L24 8 L40 22" />
      <path d="M13 19 V39 H35 V19" fill="var(--color-sun-400)" />
      <path d="M21 39 V29 H27 V39" />
    </svg>
  );
}

export function RetryIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" {...base}>
      <path d="M38 24 A14 14 0 1 1 33 13" />
      <path d="M34 5 V14 H25" />
    </svg>
  );
}

export function CheckIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base}>
      <path d="M5 12 L10 17 L19 7" />
    </svg>
  );
}

/** Placeholder Nono (robot) until real art lands in Phase 2; marked as a placeholder. */
export function NonoPlaceholder({ size = 140 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="Nono (placeholder art)" data-placeholder="true">
      <line x1="60" y1="8" x2="60" y2="24" stroke="var(--color-ink-700)" strokeWidth="4" />
      <circle cx="60" cy="8" r="6" fill="var(--color-berry-500)" stroke="var(--color-ink-700)" strokeWidth="3" />
      <rect x="22" y="24" width="76" height="60" rx="22" fill="var(--color-ocean-500)" stroke="var(--color-ink-700)" strokeWidth="4" />
      <circle cx="45" cy="52" r="9" fill="#fff" stroke="var(--color-ink-700)" strokeWidth="3" />
      <circle cx="75" cy="52" r="9" fill="#fff" stroke="var(--color-ink-700)" strokeWidth="3" />
      <circle cx="47" cy="53" r="3.5" fill="var(--color-ink-700)" />
      <circle cx="77" cy="53" r="3.5" fill="var(--color-ink-700)" />
      <path d="M48 70 Q60 78 72 70" fill="none" stroke="var(--color-ink-700)" strokeWidth="4" strokeLinecap="round" />
      <rect x="38" y="86" width="44" height="22" rx="10" fill="var(--color-sun-400)" stroke="var(--color-ink-700)" strokeWidth="4" />
    </svg>
  );
}

export function EarIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" {...base}>
      <path d="M16 20 C16 10 34 8 34 20 C34 28 26 28 26 36 C26 42 18 42 17 37" fill="var(--color-candy-400)" />
      <path d="M22 20 C22 16 28 16 28 21" />
      <path d="M38 14 Q42 20 38 26 M42 10 Q48 20 42 30" stroke="var(--color-ocean-500)" />
    </svg>
  );
}

export function PauseIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="12" y="10" width="9" height="28" rx="3" fill="var(--color-ocean-500)" stroke="var(--color-ink-700)" strokeWidth={3} />
      <rect x="27" y="10" width="9" height="28" rx="3" fill="var(--color-ocean-500)" stroke="var(--color-ink-700)" strokeWidth={3} />
    </svg>
  );
}

export function BulbIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" {...base}>
      <path d="M24 6 C14 6 10 14 12 21 C13 25 17 27 17 32 H31 C31 27 35 25 36 21 C38 14 34 6 24 6 Z" fill="var(--color-sun-400)" />
      <path d="M18 37 H30 M20 42 H28" />
    </svg>
  );
}

/** Forward/next arrow; mirrors in RTL because it points in reading direction. */
export function NextIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="rtl:-scale-x-100" {...base}>
      <path d="M8 24 H36 M26 12 L38 24 L26 36" stroke="var(--color-ink-700)" strokeWidth={5} />
    </svg>
  );
}

export function BackIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="rtl:-scale-x-100" {...base}>
      <path d="M40 24 H12 M22 12 L10 24 L22 36" stroke="var(--color-ink-700)" strokeWidth={5} />
    </svg>
  );
}

export function MapIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" {...base}>
      <path d="M6 12 L18 7 L30 12 L42 7 V36 L30 41 L18 36 L6 41 Z" fill="var(--color-leaf-500)" />
      <path d="M18 7 V36 M30 12 V41" />
    </svg>
  );
}

export function BookIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" {...base}>
      <path d="M8 10 Q16 6 24 11 Q32 6 40 10 V38 Q32 34 24 39 Q16 34 8 38 Z" fill="var(--color-candy-400)" />
      <path d="M24 11 V39" />
      <path d="M31 17 l2 4 4 .5 -3 3 .8 4 -3.8 -2 -3.8 2 .8 -4 -3 -3 4 -.5 Z" fill="var(--color-sun-400)" strokeWidth={2} />
    </svg>
  );
}

export function MicIcon({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" {...base}>
      <rect x="17" y="6" width="14" height="24" rx="7" fill="var(--color-ocean-500)" />
      <path d="M11 22 C11 38 37 38 37 22 M24 34 V42 M17 42 H31" />
    </svg>
  );
}

export function StopIcon({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="12" y="12" width="24" height="24" rx="6" fill="var(--color-berry-500)" stroke="var(--color-ink-700)" strokeWidth={3} />
    </svg>
  );
}

export function SpeakerIcon({ size = 40, muted = false }: { size?: number; muted?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" {...base}>
      <path d="M8 19 H16 L26 10 V38 L16 29 H8 Z" fill="var(--color-sun-400)" />
      {muted ? <path d="M32 18 L42 30 M42 18 L32 30" /> : <path d="M32 18 Q36 24 32 30 M37 13 Q44 24 37 35" />}
    </svg>
  );
}

export function HeadphonesIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" {...base}>
      <path d="M8 30 V24 C8 6 40 6 40 24 V30" />
      <rect x="6" y="28" width="9" height="13" rx="4" fill="var(--color-candy-400)" />
      <rect x="33" y="28" width="9" height="13" rx="4" fill="var(--color-candy-400)" />
    </svg>
  );
}

export function GrownUpIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" {...base}>
      <circle cx="18" cy="14" r="6" />
      <path d="M8 40 C8 26 28 26 28 40" />
      <rect x="28" y="22" width="14" height="12" rx="3" fill="var(--color-sun-400)" />
      <path d="M31 22 V18 C31 13 39 13 39 18 V22" />
    </svg>
  );
}

export function PlusIcon({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 10 V38 M10 24 H38" stroke="var(--color-ink-700)" strokeWidth={6} strokeLinecap="round" />
    </svg>
  );
}
