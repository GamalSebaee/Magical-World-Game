import { describe, expect, it, vi } from 'vitest';
import { EventBus, type AppEvent } from './events';
import { defaultDigitStyle, directionFor, formatDigits, htmlLangFor, primaryLang } from './i18n/language';
import { t } from './i18n/uiStrings';
import { defaultFlags, fixedClock, localDay } from './runtime';
import { sequentialIds } from './ids';

describe('language helpers', () => {
  it('maps modes to direction, lang and primary language', () => {
    expect(directionFor('ar')).toBe('rtl');
    expect(directionFor('mixed')).toBe('rtl');
    expect(directionFor('en')).toBe('ltr');
    expect(htmlLangFor('en')).toBe('en');
    expect(htmlLangFor('mixed')).toBe('ar-EG');
    expect(primaryLang('mixed')).toBe('ar');
  });

  it('formats digits in Eastern Arabic or Western glyphs', () => {
    expect(formatDigits(1234567890, 'eastern')).toBe('١٢٣٤٥٦٧٨٩٠');
    expect(formatDigits(5, 'western')).toBe('5');
    expect(defaultDigitStyle('ar')).toBe('eastern');
    expect(defaultDigitStyle('en')).toBe('western');
  });

  it('has captions in both languages', () => {
    expect(t('play', 'ar')).toBe('يلا نلعب');
    expect(t('play', 'en')).toBe('Play');
  });
});

describe('EventBus', () => {
  const ev: AppEvent = { type: 'mic.state', state: 'ready', at: 1 };

  it('delivers to typed and catch-all handlers, and unsubscribes', () => {
    const bus = new EventBus();
    const typed = vi.fn();
    const any = vi.fn();
    const off = bus.on('mic.state', typed);
    bus.onAny(any);
    bus.emit(ev);
    bus.emit({ type: 'app.error', scope: 's', recoverable: true, code: 'c', at: 2 });
    expect(typed).toHaveBeenCalledTimes(1);
    expect(any).toHaveBeenCalledTimes(2);
    off();
    bus.emit(ev);
    expect(typed).toHaveBeenCalledTimes(1);
  });

  it('keeps delivering when one handler throws', () => {
    const errors = vi.fn();
    const bus = new EventBus(errors);
    const after = vi.fn();
    bus.on('mic.state', () => {
      throw new Error('boom');
    });
    bus.on('mic.state', after);
    bus.emit(ev);
    expect(after).toHaveBeenCalled();
    expect(errors).toHaveBeenCalledTimes(1);
  });
});

describe('runtime', () => {
  it('fixed clock and sequential ids are deterministic', () => {
    const c = fixedClock(100);
    c.advance(5);
    expect(c.now()).toBe(105);
    const ids = sequentialIds('x');
    expect([ids.next(), ids.next()]).toEqual(['x-1', 'x-2']);
  });

  it('localDay formats a local calendar date', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
  });
});

describe('feature flags', () => {
  it('production builds have test hooks, TTS and recognition off unless explicitly enabled', () => {
    const saved = process.env.NEXT_PUBLIC_TEST_HOOKS;
    delete process.env.NEXT_PUBLIC_TEST_HOOKS;
    try {
      expect(defaultFlags('production')).toEqual({
        ttsDynamic: false,
        speechRecognition: false,
        devPlayground: false,
        testHooks: false,
      });
      expect(defaultFlags('development').testHooks).toBe(true);
    } finally {
      if (saved !== undefined) process.env.NEXT_PUBLIC_TEST_HOOKS = saved;
    }
  });
});
