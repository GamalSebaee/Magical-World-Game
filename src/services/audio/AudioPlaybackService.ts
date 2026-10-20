import type { ResolvedClip, ResolvedLine } from './resolver';

export type Channel = 'voice' | 'sfx' | 'music';
export type VoiceEnd = 'ended' | 'stopped' | 'failed';

export interface VoiceHandle {
  readonly done: Promise<VoiceEnd>;
  stop(): void;
}

export interface AudioStatus {
  unlocked: boolean;
  /** A voice line is audible right now (drives Nono's talking animation). */
  speaking: boolean;
  /** Caption of the current/last voice line, and whether its audio is a placeholder. */
  caption?: string;
  placeholder: boolean;
  /** The last voice line could not play because audio is still locked (autoplay rules). */
  blocked: boolean;
  muted: { all: boolean; voice: boolean; sfx: boolean; music: boolean };
}

/**
 * Low-level sound output. The real one wraps Web Audio; tests use a fake. Keeping this seam
 * small lets the playback policy (one voice at a time, sequencing, ducking) be unit-tested.
 */
export interface AudioBackend {
  /** Must be called from a user gesture. Resolves true when sound can play. */
  unlock(): Promise<boolean>;
  readonly unlocked: boolean;
  load(url: string): Promise<unknown>;
  play(buffer: unknown, channel: Channel): { ended: Promise<void>; stop(fadeMs?: number): void };
  setGain(channel: Channel | 'master', value: number, rampMs?: number): void;
  suspend(): Promise<void>;
  resume(): Promise<void>;
}

const GAP_MS = 120;
const SFX_POLYPHONY = 4;
const DUCK_LEVEL = 0.3;

type Listener = (s: AudioStatus) => void;

/**
 * App-wide audio playback (06 §3). Shared by React screens and Phaser scenes.
 * - One voice at a time: a new line interrupts (default) or waits for the current one.
 * - Missing or undecodable clips never block: the handle resolves `failed` at once and the
 *   caller falls back to visual cues.
 * - SFX polyphony is capped; music ducks while a voice plays.
 */
export class AudioPlaybackService {
  private status: AudioStatus = {
    unlocked: false,
    speaking: false,
    placeholder: false,
    blocked: false,
    muted: { all: false, voice: false, sfx: false, music: false },
  };
  private readonly listeners = new Set<Listener>();
  private readonly buffers = new Map<string, Promise<unknown>>();
  private current?: { stop(): void; done: Promise<VoiceEnd> };
  private sfxPlaying: Array<{ stop(fadeMs?: number): void }> = [];
  private volumes: Record<Channel, number> = { voice: 1, sfx: 0.8, music: 0.5 };
  private paused = false;
  /** Recently played voice clip URLs (newest last), for test hooks and diagnostics. */
  readonly history: string[] = [];
  /** Sound effects started (URLs), kept apart from voice lines; for tests. */
  readonly sfxHistory: string[] = [];

  constructor(
    private readonly backend: AudioBackend,
    private readonly onUnavailable: (clipId: string, reason: string) => void = () => {},
    private readonly wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  get unlocked() {
    return this.backend.unlocked;
  }

  getStatus(): AudioStatus {
    return this.status;
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private set(patch: Partial<AudioStatus>) {
    this.status = { ...this.status, ...patch };
    for (const l of this.listeners) l(this.status);
  }

  async unlock(): Promise<boolean> {
    const ok = await this.backend.unlock();
    this.applyGains();
    this.set({ unlocked: ok, blocked: ok ? false : this.status.blocked });
    return ok;
  }

  /** Fetches and decodes clips ahead of time. Returns the ids that failed. */
  async preload(clips: ResolvedClip[]): Promise<{ missing: string[] }> {
    const results = await Promise.all(
      clips.map(async (c) => ((await this.buffer(c)) === undefined ? `${c.id}:${c.slot}` : null)),
    );
    return { missing: results.filter((x): x is string => x !== null) };
  }

  private buffer(c: ResolvedClip): Promise<unknown | undefined> {
    let p = this.buffers.get(c.url);
    if (!p) {
      p = this.backend.load(c.url).catch((err: unknown) => {
        this.buffers.delete(c.url); // allow a later retry (e.g. once back online)
        this.onUnavailable(c.id, err instanceof Error ? err.message : String(err));
        return undefined;
      });
      this.buffers.set(c.url, p);
    }
    return p;
  }

  playVoice(line: ResolvedLine, opts: { interrupt?: boolean } = {}): VoiceHandle {
    const interrupt = opts.interrupt ?? true;
    const previous = this.current;
    if (previous && interrupt) previous.stop();

    let stopped = false;
    let active: { stop(fadeMs?: number): void } | undefined;
    const stop = () => {
      stopped = true;
      active?.stop(80);
    };

    for (const m of line.missing) this.onUnavailable(m, 'not in manifest');

    const handle: { stop(): void; done: Promise<VoiceEnd> } = { stop, done: Promise.resolve('stopped') };
    this.current = handle;
    handle.done = (async (): Promise<VoiceEnd> => {
      if (previous && !interrupt) await previous.done;
      if (stopped) return 'stopped';
      this.set({ caption: line.caption, placeholder: line.placeholder });
      if (!this.backend.unlocked) {
        this.set({ blocked: true });
        return 'failed';
      }
      if (line.clips.length === 0 || this.isMuted('voice')) return line.clips.length === 0 ? 'failed' : 'ended';

      let played = 0;
      this.set({ speaking: true });
      this.duck(true);
      try {
        for (const [i, clip] of line.clips.entries()) {
          if (stopped) return 'stopped';
          const buf = await this.buffer(clip);
          if (stopped) return 'stopped';
          if (buf === undefined) continue;
          const h = this.backend.play(buf, 'voice');
          this.history.push(clip.url);
          if (this.history.length > 50) this.history.shift();
          active = h;
          await h.ended;
          played++;
          if (stopped) return 'stopped';
          if (i < line.clips.length - 1) await this.wait(GAP_MS);
        }
        return played > 0 ? 'ended' : 'failed';
      } finally {
        if (this.current === handle) {
          this.current = undefined;
          this.set({ speaking: false });
          this.duck(false);
        }
      }
    })();
    return handle;
  }

  stopVoice() {
    this.current?.stop();
  }

  playSfx(clip: ResolvedClip | undefined) {
    if (!clip || !this.backend.unlocked || this.isMuted('sfx') || this.paused) return;
    void this.buffer(clip).then((buf) => {
      if (buf === undefined) return;
      if (this.sfxPlaying.length >= SFX_POLYPHONY) this.sfxPlaying.shift()?.stop();
      const h = this.backend.play(buf, 'sfx');
      this.sfxPlaying.push(h);
      this.sfxHistory.push(clip.url);
      if (this.sfxHistory.length > 50) this.sfxHistory.shift();
      void h.ended.then(() => {
        this.sfxPlaying = this.sfxPlaying.filter((x) => x !== h);
      });
    });
  }

  /** Background/pause: everything stops making sound but state is kept. */
  async pauseAll() {
    this.paused = true;
    this.stopVoice();
    await this.backend.suspend();
  }

  async resumeAll() {
    this.paused = false;
    await this.backend.resume();
  }

  setMuted(channel: 'all' | Channel, muted: boolean) {
    this.set({ muted: { ...this.status.muted, [channel]: muted } });
    if (muted && (channel === 'all' || channel === 'voice')) this.stopVoice();
    this.applyGains();
  }

  setVolume(channel: Channel, v: number) {
    this.volumes[channel] = Math.max(0, Math.min(1, v));
    this.applyGains();
  }

  private isMuted(channel: Channel) {
    return this.status.muted.all || this.status.muted[channel];
  }

  private applyGains() {
    for (const ch of ['voice', 'sfx', 'music'] as const) {
      this.backend.setGain(ch, this.isMuted(ch) ? 0 : this.volumes[ch]);
    }
  }

  private duck(on: boolean) {
    if (this.isMuted('music')) return;
    this.backend.setGain('music', on ? this.volumes.music * DUCK_LEVEL : this.volumes.music, 150);
  }
}
