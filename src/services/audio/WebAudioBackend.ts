import type { AudioBackend, Channel } from './AudioPlaybackService';

/**
 * Web Audio implementation: one AudioContext for the whole app (Phaser runs with noAudio).
 * The context is created and resumed inside `unlock()`, which must run in a user gesture.
 */
export class WebAudioBackend implements AudioBackend {
  private ctx?: AudioContext;
  private gains?: Record<Channel | 'master', GainNode>;
  private pendingGains: Partial<Record<Channel | 'master', number>> = {};

  /** The shared context once unlocked (the mic level meter reuses it). */
  get context(): AudioContext | undefined {
    return this.ctx;
  }

  get unlocked(): boolean {
    return this.ctx?.state === 'running';
  }

  async unlock(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    if (!this.ctx) {
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      const master = this.ctx.createGain();
      master.connect(this.ctx.destination);
      const mk = () => {
        const g = this.ctx!.createGain();
        g.connect(master);
        return g;
      };
      this.gains = { master, voice: mk(), sfx: mk(), music: mk() };
      for (const [ch, v] of Object.entries(this.pendingGains)) this.gains[ch as Channel].gain.value = v;
    }
    if (this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch {
        return false;
      }
    }
    return this.ctx.state === 'running';
  }

  async load(url: string): Promise<AudioBuffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const data = await res.arrayBuffer();
    // Decoding needs a context; before unlock, use a short-lived offline one.
    const ctx = this.ctx ?? new OfflineAudioContext(1, 1, 44100);
    return await ctx.decodeAudioData(data);
  }

  play(buffer: unknown, channel: Channel) {
    const ctx = this.ctx;
    const out = this.gains?.[channel];
    if (!ctx || !out) return { ended: Promise.resolve(), stop: () => {} };
    const src = ctx.createBufferSource();
    src.buffer = buffer as AudioBuffer;
    const g = ctx.createGain();
    src.connect(g).connect(out);
    let resolveEnded!: () => void;
    const ended = new Promise<void>((r) => (resolveEnded = r));
    src.onended = () => {
      src.disconnect();
      g.disconnect();
      resolveEnded();
    };
    src.start();
    return {
      ended,
      stop: (fadeMs = 0) => {
        try {
          const t = ctx.currentTime;
          if (fadeMs > 0) {
            g.gain.setValueAtTime(g.gain.value, t);
            g.gain.linearRampToValueAtTime(0, t + fadeMs / 1000);
            src.stop(t + fadeMs / 1000);
          } else src.stop();
        } catch {
          resolveEnded();
        }
      },
    };
  }

  setGain(channel: Channel | 'master', value: number, rampMs = 0) {
    const g = this.gains?.[channel];
    if (!g || !this.ctx) {
      this.pendingGains[channel] = value;
      return;
    }
    const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    if (rampMs > 0) {
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(value, t + rampMs / 1000);
    } else g.gain.setValueAtTime(value, t);
  }

  async suspend() {
    if (this.ctx?.state === 'running') await this.ctx.suspend();
  }

  async resume() {
    if (this.ctx && this.ctx.state !== 'running') await this.ctx.resume().catch(() => {});
  }
}
