import { describe, expect, it, vi } from 'vitest';
import { rawContent } from '@content/bundle';
import { AudioManifest, LevelDefinition, UiAudioFile } from '@content/schema';
import { runtimeAudio } from '@services/content/runtimeManifests';
import { AudioPlaybackService } from './AudioPlaybackService';
import { FakeAudioBackend } from './FakeAudioBackend';
import { AudioResolver, type ResolvedLine } from './resolver';

const manifest = AudioManifest.parse(rawContent.audioManifest);
const resolver = new AudioResolver(runtimeAudio(manifest));
const level = LevelDefinition.parse(rawContent.levels['af-01']);
const ui = UiAudioFile.parse(rawContent.uiAudio);
const noWait = () => Promise.resolve();

function setup() {
  const backend = new FakeAudioBackend();
  const unavailable = vi.fn();
  const audio = new AudioPlaybackService(backend, unavailable, noWait);
  return { backend, audio, unavailable };
}

describe('AudioResolver', () => {
  it('resolves a line per language mode, marking placeholders and giving the caption', () => {
    const intro = level.story.intro;
    const ar = resolver.line(intro, 'ar');
    expect(ar.clips.map((c) => c.url)).toEqual(['/assets/audio/ar/af01.story.intro.mp3']);
    expect(ar.caption).toBe(intro.caption.ar);
    expect(ar.placeholder).toBe(true);
    expect(resolver.line(intro, 'en').clips[0]?.url).toBe('/assets/audio/en/af01.story.intro.mp3');
  });

  it('uses the mixed sequence with pinned languages, or falls back to Arabic', () => {
    const speak = level.activities[2]!;
    if (speak.mechanic !== 'speak_repeat') throw new Error('expected speak_repeat');
    const mixed = resolver.line(speak.model, 'mixed');
    expect(mixed.clips.map((c) => `${c.id}:${c.slot}`)).toEqual(['word.animals.cat:ar', 'word.animals.cat:en']);
    const noMixed = resolver.line(level.story.intro, 'mixed');
    expect(noMixed.clips[0]?.slot).toBe('ar');
  });

  it('reports clips that are only planned as missing', () => {
    const planned = new AudioResolver(
      runtimeAudio({ schemaVersion: 1, clips: [{ ...manifest.clips[0]!, review: { ar: { status: 'planned', by: null, date: null, notes: '' } } }] }),
    );
    const line = planned.line({ ar: [manifest.clips[0]!.id], en: [manifest.clips[0]!.id], caption: { ar: 'x', en: 'x' } }, 'ar');
    expect(line.clips).toEqual([]);
    expect(line.missing).toHaveLength(1);
  });

  it('every shared UI line and SFX resolves', () => {
    for (const line of Object.values(ui.lines)) {
      expect(resolver.line(line, 'ar').missing).toEqual([]);
      expect(resolver.line(line, 'en').missing).toEqual([]);
    }
    for (const id of ui.sfx) expect(resolver.sfx(id)).toBeDefined();
  });
});

const line = (...urls: string[]): ResolvedLine => ({
  clips: urls.map((u, i) => ({ id: `c${i}`, slot: 'en', url: u, placeholder: false })),
  caption: 'hello',
  placeholder: false,
  missing: [],
});

describe('AudioPlaybackService', () => {
  it('reports blocked (not an error) when audio is still locked', async () => {
    const { audio } = setup();
    expect(await audio.playVoice(line('/a.mp3')).done).toBe('failed');
    expect(audio.getStatus().blocked).toBe(true);
    await audio.unlock();
    expect(audio.getStatus().blocked).toBe(false);
  });

  it('plays a sequence in order and marks speaking only while playing', async () => {
    const { audio, backend } = setup();
    await audio.unlock();
    const seen: boolean[] = [];
    audio.subscribe((s) => seen.push(s.speaking));
    expect(await audio.playVoice(line('/a.mp3', '/b.mp3')).done).toBe('ended');
    expect(backend.played.map((p) => p.url)).toEqual(['/a.mp3', '/b.mp3']);
    expect(seen).toContain(true);
    expect(audio.getStatus().speaking).toBe(false);
  });

  it('one voice at a time: a new line interrupts the current one', async () => {
    const { audio, backend } = setup();
    await audio.unlock();
    backend.autoEnd = false;
    const first = audio.playVoice(line('/a.mp3'));
    await vi.waitFor(() => expect(backend.played).toHaveLength(1));
    const second = audio.playVoice(line('/b.mp3'));
    expect(await first.done).toBe('stopped');
    expect(backend.played[0]!.stopped).toBe(true);
    await vi.waitFor(() => expect(backend.played).toHaveLength(2));
    backend.endNext();
    backend.endNext();
    expect(await second.done).toBe('ended');
  });

  it('queues instead of interrupting when asked', async () => {
    const { audio, backend } = setup();
    await audio.unlock();
    backend.autoEnd = false;
    const first = audio.playVoice(line('/a.mp3'));
    const second = audio.playVoice(line('/b.mp3'), { interrupt: false });
    await vi.waitFor(() => expect(backend.played).toHaveLength(1));
    backend.endNext();
    expect(await first.done).toBe('ended');
    await vi.waitFor(() => expect(backend.played).toHaveLength(2));
    backend.endNext();
    expect(await second.done).toBe('ended');
  });

  it('a missing file never blocks: resolves failed and reports unavailable', async () => {
    const { audio, backend, unavailable } = setup();
    await audio.unlock();
    backend.failUrls.add('/missing.mp3');
    expect(await audio.playVoice(line('/missing.mp3')).done).toBe('failed');
    expect(unavailable).toHaveBeenCalledWith('c0', expect.stringContaining('404'));
  });

  it('skips a missing clip inside a sequence but plays the rest', async () => {
    const { audio, backend } = setup();
    await audio.unlock();
    backend.failUrls.add('/b.mp3');
    expect(await audio.playVoice(line('/a.mp3', '/b.mp3', '/c.mp3')).done).toBe('ended');
    expect(backend.played.map((p) => p.url)).toEqual(['/a.mp3', '/c.mp3']);
  });

  it('mute silences gains and stops the current voice; music ducks under voice', async () => {
    const { audio, backend } = setup();
    await audio.unlock();
    expect(backend.gains.music).toBe(0.5);
    backend.autoEnd = false;
    const h = audio.playVoice(line('/a.mp3'));
    await vi.waitFor(() => expect(backend.played).toHaveLength(1));
    expect(backend.gains.music).toBeCloseTo(0.15);
    audio.setMuted('all', true);
    expect(await h.done).toBe('stopped');
    expect(backend.gains.voice).toBe(0);
    expect(backend.gains.sfx).toBe(0);
  });

  it('caps SFX polyphony at 4', async () => {
    const { audio, backend } = setup();
    await audio.unlock();
    backend.autoEnd = false;
    const sfx = (u: string) => ({ id: 's', slot: 'common' as const, url: u, placeholder: false });
    for (let i = 0; i < 6; i++) audio.playSfx(sfx(`/s${i}.mp3`));
    await vi.waitFor(() => expect(backend.played).toHaveLength(6));
    expect(backend.played.filter((p) => p.stopped)).toHaveLength(2);
  });

  it('pauseAll suspends output and stops speech', async () => {
    const { audio, backend } = setup();
    await audio.unlock();
    backend.autoEnd = false;
    const h = audio.playVoice(line('/a.mp3'));
    await vi.waitFor(() => expect(backend.played).toHaveLength(1));
    await audio.pauseAll();
    expect(backend.suspended).toBe(true);
    expect(await h.done).toBe('stopped');
    await audio.resumeAll();
    expect(backend.suspended).toBe(false);
  });
});
