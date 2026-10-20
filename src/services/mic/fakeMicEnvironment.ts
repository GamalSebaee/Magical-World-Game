import type { MicEnvironment } from './MicrophoneRecorder';

export type FakeMicMode = 'voice' | 'silence' | 'denied' | 'unsupported';

/** A short silent WAV, so "hear me" has something real to play. */
function silentWav(ms = 600, rate = 8000): Blob {
  const n = Math.round((rate * ms) / 1000);
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, 'data');
  v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return new Blob([buf], { type: 'audio/wav' });
}

class FakeStream {
  private readonly tracks = [{ readyState: 'live', stop() { this.readyState = 'ended'; }, addEventListener() {} }];
  getTracks() {
    return this.tracks;
  }
}

class FakeMediaRecorder {
  static isTypeSupported = (t: string) => t.startsWith('audio/webm');
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  mimeType = 'audio/webm';
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    setTimeout(() => {
      this.ondataavailable?.({ data: silentWav() });
      this.onstop?.();
    }, 30);
  }
}

/**
 * A microphone for the debug playground (04 §9): no device, no permission prompt. `voice` meters a
 * child-like speech envelope, `silence` meters nothing, `denied` refuses permission, and
 * `unsupported` has no recording API at all. Timers are real.
 */
export function fakeMicEnvironment(mode: FakeMicMode): MicEnvironment {
  let t0 = 0;
  return {
    isSecureContext: true,
    mediaDevices:
      mode === 'unsupported'
        ? undefined
        : {
            getUserMedia: (async () => {
              if (mode === 'denied') throw new DOMException('Permission denied', 'NotAllowedError');
              t0 = performance.now();
              return new FakeStream() as unknown as MediaStream;
            }) as MediaDevices['getUserMedia'],
          },
    MediaRecorder: mode === 'unsupported' ? undefined : (FakeMediaRecorder as unknown as MicEnvironment['MediaRecorder']),
    queryPermission: async () => (mode === 'denied' ? 'denied' : 'prompt'),
    createMeter: () => ({
      sample: () => {
        if (mode !== 'voice') return 0.004;
        // Quiet lead-in, then about a second of syllable-shaped energy.
        const t = (performance.now() - t0) / 1000;
        return t > 0.25 && t < 1.3 ? 0.18 + 0.1 * Math.abs(Math.sin(t * 9)) : 0.004;
      },
      close: () => {},
    }),
    createObjectURL: (b) => URL.createObjectURL(b),
    revokeObjectURL: (u) => URL.revokeObjectURL(u),
    now: () => performance.now(),
    setInterval: (fn, ms) => window.setInterval(fn, ms),
    clearInterval: (h) => window.clearInterval(h as number),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (h) => window.clearTimeout(h as number),
  };
}
