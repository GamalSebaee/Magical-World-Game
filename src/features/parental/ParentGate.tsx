'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from '@features/settings/sessionStore';
import {
  GATE_COOLDOWN_MS,
  GATE_HOLD_MS,
  GATE_MAX_FAILS,
  instruction,
  makeChallenge,
  PARENT_SESSION_MS,
  tileName,
  type GateShape,
} from './gateChallenge';

const COLOR_HEX = { red: '#e53935', blue: '#1e63d6', yellow: '#fdd835', green: '#43a047', purple: '#8e5bd0', orange: '#fb8c00' };

function Shape({ shape, fill }: { shape: GateShape; fill: string }) {
  const p = { fill, stroke: '#2d3047', strokeWidth: 3 };
  switch (shape) {
    case 'circle':
      return <circle cx="24" cy="24" r="16" {...p} />;
    case 'square':
      return <rect x="9" y="9" width="30" height="30" rx="3" {...p} />;
    case 'triangle':
      return <path d="M24 7 L41 39 H7 Z" {...p} />;
    case 'star':
      return <path d="M24 5 l5.5 11.5 12.5 1.7 -9.1 8.7 2.2 12.5 L24 33.4 12.9 39.4 15.1 26.9 6 18.2 18.5 16.5 Z" {...p} />;
    case 'heart':
      return <path d="M24 41 C6 28 6 12 16 10 C21 9 24 14 24 14 C24 14 27 9 32 10 C42 12 42 28 24 41 Z" {...p} />;
    case 'diamond':
      return <path d="M24 5 L42 24 L24 43 L6 24 Z" {...p} />;
  }
}

/**
 * Parent gate (03 P1). It keeps young children out of adult settings; it is not security, and
 * says so. Step 1: press and hold. Step 2: follow a written, randomised two-step instruction.
 */
export function ParentGate({ lang, onPass, onCancel }: { lang: 'ar' | 'en'; onPass(): void; onCancel(): void }) {
  const unlockParent = useSession((s) => s.unlockParent);
  const [step, setStep] = useState<'hold' | 'challenge' | 'cooldown'>('hold');
  const [challenge, setChallenge] = useState(makeChallenge);
  const [taps, setTaps] = useState<string[]>([]);
  const [fails, setFails] = useState(0);
  const [hold, setHold] = useState(0);
  const holdStart = useRef<number | undefined>(undefined);
  const raf = useRef<number | undefined>(undefined);
  const en = lang === 'en';

  useEffect(() => () => cancelAnimationFrame(raf.current ?? 0), []);
  useEffect(() => {
    if (step !== 'cooldown') return;
    const h = setTimeout(() => {
      setFails(0);
      setStep('hold');
    }, GATE_COOLDOWN_MS);
    return () => clearTimeout(h);
  }, [step]);

  const tick = (now: number) => {
    if (holdStart.current === undefined) return;
    const p = Math.min(1, (now - holdStart.current) / GATE_HOLD_MS);
    setHold(p);
    if (p >= 1) {
      holdStart.current = undefined;
      setStep('challenge');
      return;
    }
    raf.current = requestAnimationFrame(tick);
  };
  const startHold = () => {
    holdStart.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  };
  const endHold = () => {
    holdStart.current = undefined;
    cancelAnimationFrame(raf.current ?? 0);
    setHold(0);
  };

  const tapTile = (id: string) => {
    const next = [...taps, id];
    if (next.length < 2) return setTaps(next);
    if (next[0] === challenge.answer[0] && next[1] === challenge.answer[1]) {
      unlockParent(PARENT_SESSION_MS);
      onPass();
      return;
    }
    const f = fails + 1;
    setFails(f);
    setTaps([]);
    setChallenge(makeChallenge());
    if (f >= GATE_MAX_FAILS) setStep('cooldown');
  };

  return (
    <section dir={en ? 'ltr' : 'rtl'} lang={en ? 'en' : 'ar'} className="mx-auto flex max-w-md flex-col gap-5 rounded-3xl bg-cloud-0 p-6 shadow" data-testid="parent-gate">
      <h1 className="text-2xl font-bold">{en ? 'For grown-ups' : 'للكبار فقط'}</h1>
      {step === 'hold' && (
        <>
          <p>{en ? 'Press and hold the button for 2 seconds.' : 'اضغط مع الاستمرار على الزر لمدة ثانيتين.'}</p>
          <button
            type="button"
            data-testid="gate-hold"
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onPointerCancel={endHold}
            onContextMenu={(e) => e.preventDefault()}
            className="relative min-h-[64px] overflow-hidden rounded-2xl border-2 border-ink-700 bg-sky-100 text-lg font-semibold"
          >
            <span className="absolute inset-y-0 start-0 bg-leaf-500/50" style={{ width: `${hold * 100}%` }} aria-hidden="true" />
            <span className="relative">{en ? 'Hold' : 'اضغط مطولاً'}</span>
          </button>
        </>
      )}
      {step === 'challenge' && (
        <>
          <p className="text-lg font-semibold" data-testid="gate-instruction">
            {instruction(challenge, lang)}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {challenge.tiles.map((tile) => (
              <button
                key={tile.id}
                type="button"
                aria-label={tileName(tile, lang)}
                aria-pressed={taps.includes(tile.id)}
                onClick={() => tapTile(tile.id)}
                className={`flex min-h-[72px] items-center justify-center rounded-2xl border-2 ${taps.includes(tile.id) ? 'border-ocean-500 bg-sky-100' : 'border-ink-700/30 bg-cloud-0'}`}
              >
                <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
                  <Shape shape={tile.shape} fill={COLOR_HEX[tile.color]} />
                </svg>
              </button>
            ))}
          </div>
          {fails > 0 && <p role="status">{en ? 'Not quite — here is a new one.' : 'مش مظبوط — جرّب ده.'}</p>}
        </>
      )}
      {step === 'cooldown' && (
        <p role="status">{en ? 'Please wait 30 seconds and try again.' : 'من فضلك استنى ٣٠ ثانية وجرّب تاني.'}</p>
      )}
      <p className="text-sm opacity-70">
        {en
          ? 'This check keeps young children out of settings. It is not a password.'
          : 'الخطوة دي بتبعد الأطفال الصغيرين عن الإعدادات، ومش كلمة سر.'}
      </p>
      <button type="button" onClick={onCancel} className="min-h-[48px] rounded-xl border-2 border-ink-700 px-4">
        {en ? 'Back to the game' : 'رجوع للعبة'}
      </button>
    </section>
  );
}

export function useParentUnlocked(): boolean {
  const until = useSession((s) => s.parentUnlockedUntil);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(h);
  }, []);
  return until > now;
}
