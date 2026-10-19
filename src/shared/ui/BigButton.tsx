'use client';

import { useCallback, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

/** Repeat taps within this window are ignored (03 §0). */
export const TAP_DEBOUNCE_MS = 400;

type Size = 'target' | 'primary' | 'hero';
const SIZE: Record<Size, string> = {
  target: 'min-h-[64px] min-w-[64px]',
  primary: 'min-h-[88px] min-w-[88px]',
  hero: 'min-h-[120px] min-w-[120px]',
};

export interface BigButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  /** Accessible name in the current language; children are usually just an icon. */
  label: string;
  size?: Size;
  onPress?: () => void;
  children: ReactNode;
  now?: () => number;
}

/**
 * Large, debounced child button. Icon-first; `label` gives it a name for adults and assistive
 * technology because the child is not expected to read.
 */
export function BigButton({ label, size = 'primary', onPress, children, className = '', now = Date.now, ...rest }: BigButtonProps) {
  const last = useRef(-Infinity);
  const handle = useCallback(() => {
    const t = now();
    if (t - last.current < TAP_DEBOUNCE_MS) return;
    last.current = t;
    onPress?.();
  }, [onPress, now]);

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={handle}
      className={`${SIZE[size]} inline-flex items-center justify-center rounded-[var(--radius-blob)] border-4 border-ink-700 bg-cloud-0 shadow-[0_6px_0_var(--color-ink-700)] transition-transform active:translate-y-[4px] active:shadow-[0_2px_0_var(--color-ink-700)] disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
