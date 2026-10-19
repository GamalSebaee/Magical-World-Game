import { describe, expect, it } from 'vitest';
import { MicrophoneRecorder, pickMimeType, STOP_WATCHDOG_MS, PERMISSION_TIMEOUT_MS, type MicEnvironment } from './MicrophoneRecorder';
import { speechFeedback } from './speechFeedback';
import { analyzeLevels, rms } from './vad';

class FakeTrack {
  readyState: 'live' | 'ended' = 'live';
  private ended: Array<() => void> = [];
  stop() {
    this.readyState = 'ended';
  }
  addEventListener(_: 'ended', fn: () => void) {
    this.ended.push(fn);
  }
  unplug() {
    this.readyState = 'ended';
    this.ended.forEach((f) => f());
  }
}
class FakeStream {
  tracks = [new FakeTrack()];
  getTracks() {
    return this.tracks;
  }
}

class FakeRecorder {
  static supported = new Set(['audio/webm;codecs=opus']);
  static isTypeSupported(t: string) {
    return FakeRecorder.supported.has(t);
  }
  static silentStop = false;
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public stream: FakeStream) {}
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    if (FakeRecorder.silentStop) return;
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob(['audio-bytes'], { type: 'audio/webm' }) });
      this.onstop?.();
    });
  }
}

/** Deterministic timers: advance() runs everything due. */
function makeEnv(opts: { gum?: () => Promise<FakeStream>; levels?: number[]; perm?: PermissionState } = {}) {
  let now = 0;
  let id = 0;
  const timers = new Map<number, { at: number; fn: () => void; every?: number }>();
  const revoked: string[] = [];
  const created: string[] = [];
  const streams: FakeStream[] = [];
  const levels = [...(opts.levels ?? [])];
  const env: MicEnvironment = {
    isSecureContext: true,
    mediaDevices: {
      getUserMedia: (async () => {
        const s = await (opts.gum ? opts.gum() : Promise.resolve(new FakeStream()));
        streams.push(s);
        return s as unknown as MediaStream;
      }) as MediaDevices['getUserMedia'],
    },
    MediaRecorder: FakeRecorder as unknown as MicEnvironment['MediaRecorder'],
    queryPermission: async () => opts.perm,
    createMeter: () => ({ sample: () => levels.shift() ?? 0, close: () => {} }),
    createObjectURL: () => {
      const u = `blob:${created.length}`;
      created.push(u);
      return u;
    },
    revokeObjectURL: (u) => revoked.push(u),
    now: () => now,
    setInterval: (fn, ms) => (timers.set(++id, { at: now + ms, fn, every: ms }), id),
    clearInterval: (h) => timers.delete(h as number),
    setTimeout: (fn, ms) => (timers.set(++id, { at: now + ms, fn }), id),
    clearTimeout: (h) => timers.delete(h as number),
  };
  const advance = async (ms: number) => {
    const end = now + ms;
    for (;;) {
      const next = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [k, t] = next;
      now = t.at;
      if (t.every) t.at += t.every;
      else timers.delete(k);
      t.fn();
      await Promise.resolve();
    }
    now = end;
    await new Promise((r) => setTimeout(r, 0));
  };
  return { env, advance, revoked, created, streams };
}

describe('MIME selection', () => {
  it('prefers webm/opus, then mp4 (Safari), else none', () => {
    expect(pickMimeType((t) => t.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(pickMimeType((t) => t === 'audio/mp4')).toBe('audio/mp4');
    expect(pickMimeType(() => false)).toBeUndefined();
    expect(pickMimeType(() => {
      throw new Error('boom');
    })).toBeUndefined();
  });
});

describe('MicrophoneRecorder state machine (T-MIC)', () => {
  it('is unsupported without a secure context, mediaDevices, MediaRecorder or a MIME type', async () => {
    for (const patch of [{ isSecureContext: false }, { mediaDevices: undefined }, { MediaRecorder: undefined }]) {
      const { env } = makeEnv();
      const mic = new MicrophoneRecorder({ ...env, ...patch });
      expect(await mic.probe()).toBe('unsupported');
    }
    FakeRecorder.supported = new Set();
    const { env } = makeEnv();
    const mic = new MicrophoneRecorder(env);
    expect(await mic.probe()).toBe('unsupported');
    expect(mic.unsupportedReason).toBe('no_mime');
    FakeRecorder.supported = new Set(['audio/webm;codecs=opus']);
  });

  it('uses the Permissions API when present', async () => {
    expect(await new MicrophoneRecorder(makeEnv({ perm: 'granted' }).env).probe()).toBe('ready');
    expect(await new MicrophoneRecorder(makeEnv({ perm: 'denied' }).env).probe()).toBe('denied');
    expect(await new MicrophoneRecorder(makeEnv({ perm: 'prompt' }).env).probe()).toBe('permission_unknown');
  });

  it('asks for permission on start, records, stops tracks and returns a voiced recording', async () => {
    const levels = [0.005, 0.005, 0.006, 0.005, ...Array(20).fill(0.2)];
    const { env, advance, streams } = makeEnv({ levels });
    const mic = new MicrophoneRecorder(env);
    const states: string[] = [];
    mic.onState((s) => states.push(s));
    await mic.probe();
    expect(await mic.start({ maxMs: 5000 })).toBe('recording');
    expect(mic.isCapturing).toBe(true);
    await advance(1500);
    const rec = await mic.stop();
    expect(rec.url).toBe('blob:0');
    expect(rec.durationMs).toBe(1500);
    expect(rec.voicedMs).toBe(1000);
    expect(streams[0]!.tracks.every((t) => t.readyState === 'ended')).toBe(true);
    expect(states).toEqual(['requesting_permission', 'recording', 'stopping', 'processing', 'feedback']);
    mic.reset();
    expect(mic.state).toBe('ready');
  });

  it('auto-stops at maxMs', async () => {
    const { env, advance } = makeEnv({ perm: 'granted' });
    const mic = new MicrophoneRecorder(env);
    await mic.probe();
    await mic.start({ maxMs: 5000 });
    await advance(5000);
    expect(mic.state).toBe('feedback');
  });

  it('maps a denied prompt to denied, and stays able to ask again', async () => {
    const err = Object.assign(new Error('no'), { name: 'NotAllowedError' });
    const { env } = makeEnv({ gum: () => Promise.reject(err) });
    const mic = new MicrophoneRecorder(env);
    await mic.probe();
    expect(await mic.start({ maxMs: 5000 })).toBe('denied');
    expect(mic.isCapturing).toBe(false);
  });

  it('times out an unanswered permission prompt, and releases a late stream', async () => {
    let resolve!: (s: FakeStream) => void;
    const late = new FakeStream();
    const { env, advance } = makeEnv({ gum: () => new Promise((r) => (resolve = r)) });
    const mic = new MicrophoneRecorder(env);
    await mic.probe();
    const started = mic.start({ maxMs: 5000 });
    await advance(PERMISSION_TIMEOUT_MS);
    expect(await started).toBe('timed_out');
    resolve(late);
    await new Promise((r) => setTimeout(r, 0));
    expect(late.tracks[0]!.readyState).toBe('ended');
  });

  it('cancel during recording discards data and stops tracks', async () => {
    const { env, streams } = makeEnv({ perm: 'granted' });
    const mic = new MicrophoneRecorder(env);
    await mic.probe();
    await mic.start({ maxMs: 5000 });
    mic.cancel();
    expect(mic.state).toBe('cancelled');
    expect(streams[0]!.tracks[0]!.readyState).toBe('ended');
  });

  it('dispose during recording (route exit) stops tracks and revokes every URL (T-MIC-08)', async () => {
    const { env, advance, streams, revoked } = makeEnv({ perm: 'granted' });
    const mic = new MicrophoneRecorder(env);
    await mic.probe();
    await mic.start({ maxMs: 5000 });
    await advance(600);
    const rec = await mic.stop();
    mic.reset();
    await mic.start({ maxMs: 5000 });
    mic.dispose();
    expect(streams.every((s) => s.tracks.every((t) => t.readyState === 'ended'))).toBe(true);
    expect(revoked).toEqual([rec.url]);
    expect(await mic.start({ maxMs: 5000 })).not.toBe('recording');
  });

  it('a track that ends mid-recording (unplugged) is a recoverable error, and can retry', async () => {
    const { env, streams } = makeEnv({ perm: 'granted' });
    const mic = new MicrophoneRecorder(env);
    await mic.probe();
    await mic.start({ maxMs: 5000 });
    streams[0]!.tracks[0]!.unplug();
    expect(mic.state).toBe('recoverable_error');
    expect(mic.isCapturing).toBe(false);
    mic.reset();
    expect(await mic.start({ maxMs: 5000 })).toBe('recording');
  });

  it('the stop watchdog finishes even if MediaRecorder never fires stop', async () => {
    FakeRecorder.silentStop = true;
    try {
      const { env, advance } = makeEnv({ perm: 'granted' });
      const mic = new MicrophoneRecorder(env);
      await mic.probe();
      await mic.start({ maxMs: 5000 });
      const p = mic.stop();
      await advance(STOP_WATCHDOG_MS);
      await expect(p).rejects.toThrow('empty recording');
      expect(mic.state).toBe('recoverable_error');
    } finally {
      FakeRecorder.silentStop = false;
    }
  });

  it('rejects invalid transitions (stop when not recording)', async () => {
    const mic = new MicrophoneRecorder(makeEnv().env);
    await expect(mic.stop()).rejects.toThrow('not recording');
  });
});

describe('VAD', () => {
  it('measures voiced time above an adaptive noise floor', () => {
    expect(analyzeLevels([0.01, 0.01, 0.01, 0.01, 0.1, 0.1, 0.01]).voicedMs).toBe(100);
    expect(analyzeLevels(Array(20).fill(0.004)).voicedMs).toBe(0);
    // A loud room raises the threshold so noise alone doesn't count as voice.
    const noisy = analyzeLevels([0.05, 0.05, 0.05, 0.05, 0.06, 0.06, 0.2]);
    expect(noisy.threshold).toBe(0.12); // 0.05 × 2.5 = 0.125, capped
    expect(noisy.voicedMs).toBe(50);
  });

  it('counts speech that starts in the very first frame (no silent lead-in assumed)', () => {
    const r = analyzeLevels([0.5, 0.6, 0.5, 0.4, 0.2, 0.05, 0.01, 0.01, 0.01, 0.01, 0.01]);
    expect(r.voicedMs).toBe(300);
  });

  it('caps the threshold so a loud room cannot hide a voice', () => {
    const r = analyzeLevels([...Array(10).fill(0.1), 0.4, 0.4]);
    expect(r.threshold).toBe(0.12);
    expect(r.voicedMs).toBe(100);
  });

  it('computes RMS', () => {
    expect(rms([1, -1, 1, -1])).toBe(1);
    expect(rms([])).toBe(0);
  });
});

describe('speech feedback (06 §7, never "correct")', () => {
  it('maps attempts to honest outcomes', () => {
    expect(speechFeedback({ kind: 'recording', recording: { durationMs: 2000, voicedMs: 900 } })).toMatchObject({
      result: 'recorded_voice_detected',
      line: 'speech.heard',
      canPlayBack: true,
    });
    expect(speechFeedback({ kind: 'recording', recording: { durationMs: 2000, voicedMs: 100 } })).toMatchObject({
      result: 'recorded_silence',
      line: 'speech.silent',
    });
    expect(speechFeedback({ kind: 'recording', recording: { durationMs: 200, voicedMs: 200 } }).line).toBe('speech.hold_longer');
    expect(speechFeedback({ kind: 'prompt_only' })).toMatchObject({ result: 'prompt_only', evidence: { kind: 'speech_prompt_only' } });
    expect(speechFeedback({ kind: 'unavailable' }).evidence).toEqual({ kind: 'none' });
  });

  it('recognition agreement or not gives the same child-facing line', () => {
    const yes = speechFeedback({ kind: 'recording', recording: { durationMs: 2000, voicedMs: 900 }, recognizerAgreed: true });
    const no = speechFeedback({ kind: 'recording', recording: { durationMs: 2000, voicedMs: 900 }, recognizerAgreed: false });
    expect(yes.line).toBe(no.line);
    expect(yes.result).toBe('recognized_match');
    expect(no.result).toBe('recognized_no_match');
  });
});
