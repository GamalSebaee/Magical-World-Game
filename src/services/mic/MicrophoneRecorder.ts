import type { MicState } from '@shared/events';
import { analyzeLevels, FRAME_MS, rms } from './vad';

/** Capability order from 06 §5. */
export const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus'];

export function pickMimeType(isTypeSupported: (t: string) => boolean): string | undefined {
  return MIME_CANDIDATES.find((t) => {
    try {
      return isTypeSupported(t);
    } catch {
      return false;
    }
  });
}

export interface Recording {
  blob: Blob;
  /** Object URL for "hear me" playback. Revoked by dispose(). */
  url: string;
  mimeType: string;
  durationMs: number;
  voicedMs: number;
  peak: number;
}

export type MicUnsupportedReason = 'insecure_context' | 'no_media_devices' | 'no_media_recorder' | 'no_mime';

/** Browser APIs the recorder needs, injectable so the state machine is testable. */
export interface MicEnvironment {
  isSecureContext: boolean;
  mediaDevices?: Pick<MediaDevices, 'getUserMedia'>;
  MediaRecorder?: {
    new (stream: MediaStream, opts?: MediaRecorderOptions): MediaRecorder;
    isTypeSupported(t: string): boolean;
  };
  queryPermission?: () => Promise<PermissionState | undefined>;
  /** Builds a level meter for a stream: returns a sampler (0..1) and a close function. */
  createMeter?: (stream: MediaStream) => { sample(): number; close(): void };
  createObjectURL: (b: Blob) => string;
  revokeObjectURL: (u: string) => void;
  now: () => number;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (h: unknown) => void;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (h: unknown) => void;
}

/** Allowed transitions (06 §5.1). Anything else is a bug and throws in development. */
const TRANSITIONS: Record<MicState, MicState[]> = {
  unsupported: [],
  permission_unknown: ['requesting_permission', 'ready', 'denied', 'unsupported'],
  requesting_permission: ['ready', 'recording', 'denied', 'timed_out', 'cancelled', 'recoverable_error'],
  ready: ['recording', 'requesting_permission', 'denied', 'recoverable_error'],
  recording: ['stopping', 'cancelled', 'recoverable_error'],
  stopping: ['processing', 'cancelled', 'recoverable_error'],
  processing: ['feedback', 'recoverable_error', 'cancelled'],
  feedback: ['ready'],
  denied: ['requesting_permission'],
  timed_out: ['requesting_permission', 'ready'],
  cancelled: ['ready', 'requesting_permission'],
  recoverable_error: ['ready', 'requesting_permission'],
};

export const PERMISSION_TIMEOUT_MS = 15_000;
export const STOP_WATCHDOG_MS = 1_000;

type Listener = (state: MicState) => void;

/**
 * Real microphone capture with an explicit state machine (06 §5). Tracks are opened only for a
 * recording and stopped as soon as it ends, is cancelled, fails, or the owner disposes.
 * Raw audio stays in memory; dispose() revokes every object URL it created.
 */
export class MicrophoneRecorder {
  private _state: MicState = 'permission_unknown';
  private stream?: MediaStream;
  private recorder?: MediaRecorder;
  private meter?: { sample(): number; close(): void };
  private chunks: Blob[] = [];
  private levels: number[] = [];
  private sampleTimer?: unknown;
  private maxTimer?: unknown;
  private startedAt = 0;
  private urls: string[] = [];
  private stopResult?: { resolve(r: Recording): void; reject(e: unknown): void };
  private disposed = false;
  private readonly listeners = new Set<Listener>();
  private readonly levelListeners = new Set<(l: number) => void>();
  private readonly finishedListeners = new Set<(r: Recording) => void>();
  unsupportedReason?: MicUnsupportedReason;
  mimeType?: string;

  constructor(private readonly env: MicEnvironment) {}

  get state(): MicState {
    return this._state;
  }

  onState(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  /** Fires for every completed recording, whether stopped by the child or by the time limit. */
  onFinished(l: (r: Recording) => void) {
    this.finishedListeners.add(l);
    return () => this.finishedListeners.delete(l);
  }

  onLevel(l: (level: number) => void) {
    this.levelListeners.add(l);
    return () => this.levelListeners.delete(l);
  }

  private go(next: MicState) {
    if (this._state === next) return;
    if (!TRANSITIONS[this._state].includes(next)) {
      throw new Error(`Invalid mic transition ${this._state} → ${next}`);
    }
    this._state = next;
    for (const l of this.listeners) l(next);
  }

  /** Feature detection plus permission state where the browser exposes it. */
  async probe(): Promise<MicState> {
    const e = this.env;
    const reason: MicUnsupportedReason | undefined = !e.isSecureContext
      ? 'insecure_context'
      : !e.mediaDevices?.getUserMedia
        ? 'no_media_devices'
        : !e.MediaRecorder
          ? 'no_media_recorder'
          : undefined;
    const mime = reason ? undefined : pickMimeType((t) => e.MediaRecorder!.isTypeSupported(t));
    if (reason || !mime) {
      this.unsupportedReason = reason ?? 'no_mime';
      this.go('unsupported');
      return this._state;
    }
    this.mimeType = mime;
    const perm = await e.queryPermission?.().catch(() => undefined);
    if (perm === 'granted') this.go('ready');
    else if (perm === 'denied') this.go('denied');
    return this._state;
  }

  /**
   * Starts recording, asking for permission first if needed. Must be triggered by a tap.
   * Resolves once recording has begun (or the request ended in denied/timed_out/error).
   */
  async start(opts: { maxMs: number }): Promise<MicState> {
    if (this.disposed) return this._state;
    if (!['ready', 'permission_unknown', 'denied', 'timed_out', 'cancelled', 'recoverable_error'].includes(this._state)) {
      return this._state;
    }
    if (this._state !== 'ready') this.go('requesting_permission');
    let stream: MediaStream;
    try {
      stream = await this.withTimeout(
        this.env.mediaDevices!.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        }),
        PERMISSION_TIMEOUT_MS,
      );
    } catch (err) {
      const name = (err as { name?: string }).name;
      if (this._state === 'cancelled') return this._state;
      if (name === 'NotAllowedError' || name === 'SecurityError') this.go('denied');
      else if (name === 'TimeoutError') this.go('timed_out');
      else this.go('recoverable_error');
      return this._state;
    }
    if (this.disposed || this._state === 'cancelled') {
      stopTracks(stream);
      return this._state;
    }

    this.stream = stream;
    this.chunks = [];
    this.levels = [];
    try {
      const rec = new this.env.MediaRecorder!(stream, { mimeType: this.mimeType });
      this.recorder = rec;
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) this.chunks.push(ev.data);
      };
      rec.onstop = () => this.finish();
      rec.onerror = () => this.fail();
      for (const t of stream.getTracks()) t.addEventListener('ended', () => this.fail());
      rec.start(250);
    } catch {
      this.fail();
      return this._state;
    }
    this.meter = this.env.createMeter?.(stream);
    this.sampleTimer = this.env.setInterval(() => {
      const level = this.meter?.sample() ?? 0;
      this.levels.push(level);
      for (const l of this.levelListeners) l(level);
    }, FRAME_MS);
    this.maxTimer = this.env.setTimeout(() => void this.stop().catch(() => {}), opts.maxMs);
    this.startedAt = this.env.now();
    this.go('recording');
    return this._state;
  }

  /** Stops and returns the recording. Rejects if nothing usable was captured. */
  stop(): Promise<Recording> {
    if (this._state !== 'recording') return Promise.reject(new Error(`not recording (${this._state})`));
    this.go('stopping');
    const p = new Promise<Recording>((resolve, reject) => (this.stopResult = { resolve, reject }));
    this.release();
    try {
      this.recorder?.stop();
    } catch {
      this.finish();
    }
    // Some browsers never fire `stop`; don't hang the child waiting for it.
    const watchdog = this.env.setTimeout(() => this.finish(), STOP_WATCHDOG_MS);
    void p.finally(() => this.env.clearTimeout(watchdog)).catch(() => {});
    return p;
  }

  /** Discards any recording in progress. Safe to call in any state. */
  cancel() {
    const wasActive = ['requesting_permission', 'recording', 'stopping', 'processing'].includes(this._state);
    this.release();
    this.chunks = [];
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.onstop = null;
      try {
        this.recorder.stop();
      } catch {
        /* already stopped */
      }
    }
    this.recorder = undefined;
    this.stopResult?.reject(new Error('cancelled'));
    this.stopResult = undefined;
    if (wasActive) this.go('cancelled');
  }

  /** Back to ready after feedback, a cancel or an error ("again" button). */
  reset() {
    if (['feedback', 'cancelled', 'recoverable_error', 'timed_out'].includes(this._state)) this.go('ready');
  }

  /** Must be called when the owning activity unmounts. Stops tracks and revokes URLs. */
  dispose() {
    if (this.disposed) return;
    this.cancel();
    this.disposed = true;
    for (const u of this.urls) this.env.revokeObjectURL(u);
    this.urls = [];
    this.listeners.clear();
    this.levelListeners.clear();
    this.finishedListeners.clear();
  }

  /** True while any capture hardware is open (for tests and the privacy indicator). */
  get isCapturing(): boolean {
    return !!this.stream?.getTracks().some((t) => t.readyState === 'live');
  }

  private finish() {
    if (this._state !== 'stopping') return;
    this.go('processing');
    const durationMs = Math.max(0, this.env.now() - this.startedAt);
    const blob = new Blob(this.chunks, { type: this.mimeType });
    this.chunks = [];
    this.recorder = undefined;
    const vad = analyzeLevels(this.levels);
    if (blob.size === 0) {
      this.go('recoverable_error');
      this.stopResult?.reject(new Error('empty recording'));
      this.stopResult = undefined;
      return;
    }
    const url = this.env.createObjectURL(blob);
    this.urls.push(url);
    this.go('feedback');
    const rec: Recording = { blob, url, mimeType: this.mimeType ?? blob.type, durationMs, voicedMs: vad.voicedMs, peak: vad.peak };
    this.stopResult?.resolve(rec);
    this.stopResult = undefined;
    for (const l of this.finishedListeners) l(rec);
  }

  private fail() {
    if (!['recording', 'stopping', 'processing'].includes(this._state)) return;
    this.release();
    this.recorder = undefined;
    this.go('recoverable_error');
    this.stopResult?.reject(new Error('recording failed'));
    this.stopResult = undefined;
  }

  /** Stops timers, the meter and every track. Idempotent. */
  private release() {
    if (this.sampleTimer !== undefined) this.env.clearInterval(this.sampleTimer);
    if (this.maxTimer !== undefined) this.env.clearTimeout(this.maxTimer);
    this.sampleTimer = this.maxTimer = undefined;
    this.meter?.close();
    this.meter = undefined;
    if (this.stream) stopTracks(this.stream);
    this.stream = undefined;
  }

  private withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const h = this.env.setTimeout(() => {
        const err = new Error('permission timed out');
        err.name = 'TimeoutError';
        reject(err);
        // If the prompt is answered later, release that stream immediately.
        void p.then(stopTracks, () => {});
      }, ms);
      p.then(
        (v) => {
          this.env.clearTimeout(h);
          resolve(v);
        },
        (e) => {
          this.env.clearTimeout(h);
          reject(e);
        },
      );
    });
  }
}

function stopTracks(stream: MediaStream | unknown) {
  (stream as MediaStream | undefined)?.getTracks?.().forEach((t) => t.stop());
}

/**
 * The real browser environment. `sharedContext` should be the app's already-unlocked
 * AudioContext: a context created later, outside a user gesture, may stay suspended and would
 * measure silence.
 */
export function browserMicEnvironment(sharedContext?: () => AudioContext | undefined): MicEnvironment {
  const w = window;
  return {
    isSecureContext: w.isSecureContext,
    mediaDevices: navigator.mediaDevices,
    MediaRecorder: typeof MediaRecorder === 'undefined' ? undefined : MediaRecorder,
    queryPermission: async () => {
      try {
        const s = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
        return s?.state;
      } catch {
        return undefined;
      }
    },
    createMeter: (stream) => {
      const shared = sharedContext?.();
      const Ctor = w.AudioContext ?? (w as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!shared && !Ctor) return { sample: () => 0, close: () => {} };
      const ctx = shared ?? new Ctor!();
      void ctx.resume().catch(() => {});
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      return {
        sample: () => {
          analyser.getFloatTimeDomainData(buf);
          return rms(buf);
        },
        close: () => {
          src.disconnect();
          analyser.disconnect();
          if (!shared) void ctx.close().catch(() => {});
        },
      };
    },
    createObjectURL: (b) => URL.createObjectURL(b),
    revokeObjectURL: (u) => URL.revokeObjectURL(u),
    now: () => performance.now(),
    setInterval: (fn, ms) => w.setInterval(fn, ms),
    clearInterval: (h) => w.clearInterval(h as number),
    setTimeout: (fn, ms) => w.setTimeout(fn, ms),
    clearTimeout: (h) => w.clearTimeout(h as number),
  };
}
