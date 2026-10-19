'use client';

export type NonoMood = 'idle' | 'talking' | 'listening' | 'celebrating' | 'helping' | 'waiting' | 'sleepy';

/**
 * Nono the robot (placeholder art, marked). Mood drives a simple CSS animation: the mouth light
 * flaps while talking, the ear dish glows while listening (recording), a hop when celebrating.
 */
export function Nono({ mood = 'idle', size = 120, className = '' }: { mood?: NonoMood; size?: number; className?: string }) {
  const mouth =
    mood === 'talking' ? 'nono-talk' : mood === 'celebrating' ? 'nono-smile' : mood === 'sleepy' ? 'nono-flat' : 'nono-smile';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Nono"
      data-mood={mood}
      data-placeholder="true"
      className={`${mood === 'celebrating' ? 'animate-hop' : mood === 'idle' || mood === 'waiting' ? 'animate-bob' : ''} ${className}`}
    >
      <line x1="60" y1="8" x2="60" y2="24" stroke="var(--color-ink-700)" strokeWidth="4" />
      <circle cx="60" cy="8" r="6" fill={mood === 'helping' ? 'var(--color-sun-400)' : 'var(--color-berry-500)'} stroke="var(--color-ink-700)" strokeWidth="3" />
      <circle cx="16" cy="52" r="9" fill={mood === 'listening' ? 'var(--color-sun-400)' : 'var(--color-ocean-500)'} stroke="var(--color-ink-700)" strokeWidth="3" className={mood === 'listening' ? 'animate-pulse' : ''} />
      <circle cx="104" cy="52" r="9" fill={mood === 'listening' ? 'var(--color-sun-400)' : 'var(--color-ocean-500)'} stroke="var(--color-ink-700)" strokeWidth="3" className={mood === 'listening' ? 'animate-pulse' : ''} />
      <rect x="22" y="24" width="76" height="60" rx="22" fill="var(--color-ocean-500)" stroke="var(--color-ink-700)" strokeWidth="4" />
      {mood === 'sleepy' ? (
        <path d="M38 52 Q45 57 52 52 M68 52 Q75 57 82 52" fill="none" stroke="var(--color-ink-700)" strokeWidth="4" strokeLinecap="round" />
      ) : (
        <>
          <circle cx="45" cy="52" r="9" fill="#fff" stroke="var(--color-ink-700)" strokeWidth="3" />
          <circle cx="75" cy="52" r="9" fill="#fff" stroke="var(--color-ink-700)" strokeWidth="3" />
          <circle cx="47" cy="53" r="3.5" fill="var(--color-ink-700)" />
          <circle cx="77" cy="53" r="3.5" fill="var(--color-ink-700)" />
        </>
      )}
      {mouth === 'nono-talk' ? (
        <ellipse cx="60" cy="72" rx="10" ry="6" fill="var(--color-sun-400)" stroke="var(--color-ink-700)" strokeWidth="3" className="nono-mouth" />
      ) : mouth === 'nono-flat' ? (
        <path d="M50 72 H70" stroke="var(--color-ink-700)" strokeWidth="4" strokeLinecap="round" />
      ) : (
        <path d="M48 70 Q60 78 72 70" fill="none" stroke="var(--color-ink-700)" strokeWidth="4" strokeLinecap="round" />
      )}
      <rect x="38" y="86" width="44" height="22" rx="10" fill="var(--color-sun-400)" stroke="var(--color-ink-700)" strokeWidth="4" />
    </svg>
  );
}
