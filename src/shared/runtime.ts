/** Small injectable runtime primitives: clock, logger, feature flags. */

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export function fixedClock(start = 0): Clock & { advance(ms: number): void; set(ms: number): void } {
  let t = start;
  return {
    now: () => t,
    advance: (ms) => {
      t += ms;
    },
    set: (ms) => {
      t = ms;
    },
  };
}

/** Local calendar day (YYYY-MM-DD), used for spacing evidence across days (08 §1). */
export function localDay(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface Logger {
  log(level: LogLevel, scope: string, message: string, data?: Record<string, unknown>): void;
}

export const consoleLogger: Logger = {
  log(level, scope, message, data) {
    if (level === 'debug' && process.env.NODE_ENV === 'production') return;
    // Errors surface through app.error events and error boundaries; the console is for developers.
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
    fn(`[${scope}] ${message}`, data ?? '');
  },
};

export const silentLogger: Logger = { log: () => {} };

export interface FeatureFlags {
  ttsDynamic: boolean;
  speechRecognition: boolean;
  devPlayground: boolean;
  testHooks: boolean;
}

export function defaultFlags(env: string | undefined = process.env.NODE_ENV): FeatureFlags {
  const isProd = env === 'production';
  return {
    ttsDynamic: false,
    speechRecognition: false,
    devPlayground: !isProd,
    testHooks: !isProd || process.env.NEXT_PUBLIC_TEST_HOOKS === '1',
  };
}
