import type { AudioBackend, Channel } from './AudioPlaybackService';

/** Test double: records what played; clips end when the test says so (or immediately). */
export class FakeAudioBackend implements AudioBackend {
  unlocked = false;
  allowUnlock = true;
  failUrls = new Set<string>();
  autoEnd = true;
  readonly played: Array<{ url: string; channel: Channel; stopped: boolean }> = [];
  readonly gains: Partial<Record<Channel | 'master', number>> = {};
  suspended = false;
  private enders: Array<() => void> = [];

  async unlock() {
    this.unlocked = this.allowUnlock;
    return this.unlocked;
  }

  async load(url: string) {
    if (this.failUrls.has(url)) throw new Error(`404 ${url}`);
    return { url };
  }

  play(buffer: unknown, channel: Channel) {
    const rec = { url: (buffer as { url: string }).url, channel, stopped: false };
    this.played.push(rec);
    let end!: () => void;
    const ended = new Promise<void>((r) => (end = r));
    if (this.autoEnd) queueMicrotask(end);
    else this.enders.push(end);
    return {
      ended,
      stop: () => {
        rec.stopped = true;
        end();
      },
    };
  }

  /** Ends the oldest still-playing clip (when autoEnd is off). */
  endNext() {
    this.enders.shift()?.();
  }

  setGain(channel: Channel | 'master', value: number) {
    this.gains[channel] = value;
  }

  async suspend() {
    this.suspended = true;
  }

  async resume() {
    this.suspended = false;
  }
}
