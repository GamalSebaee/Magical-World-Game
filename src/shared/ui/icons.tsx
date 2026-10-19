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
