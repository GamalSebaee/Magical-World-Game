import {
  AssetManifest,
  AudioManifest,
  ContentIndex,
  LevelDefinition,
  UiAudioFile,
  VocabularyFile,
  WorldDefinition,
  type LocalizedAudioRef,
  type VocabularyEntry,
  type ContentIndex as ContentIndexT,
  type LevelDefinition as LevelDefinitionT,
  type WorldDefinition as WorldDefinitionT,
} from '@content/schema';
import type { RawContentBundle } from '@content/bundle';

export type ContentResult<T> = { ok: true; value: T } | { ok: false; error: 'not_found' | 'invalid'; detail?: string };

/**
 * Read-only access to bundled content. The build already validated everything; the level being
 * opened is re-checked cheaply in case a stale cache served mismatched content (05 §1).
 */
export class ContentRepository {
  private readonly levelCache = new Map<string, LevelDefinitionT>();
  private readonly worldCache = new Map<string, WorldDefinitionT>();

  constructor(private readonly raw: RawContentBundle) {}

  index(): ContentIndexT {
    return ContentIndex.parse(this.raw.index);
  }

  /** Worlds in index order, skipping any that fail validation (they are reported, not fatal). */
  worlds(): WorldDefinitionT[] {
    return this.index()
      .worlds.map((id) => this.world(id))
      .flatMap((r) => (r.ok ? [r.value] : []));
  }

  world(id: string): ContentResult<WorldDefinitionT> {
    const cached = this.worldCache.get(id);
    if (cached) return { ok: true, value: cached };
    const raw = this.raw.worlds[id];
    if (raw === undefined) return { ok: false, error: 'not_found' };
    const r = WorldDefinition.safeParse(raw);
    if (!r.success) return { ok: false, error: 'invalid', detail: r.error.message };
    this.worldCache.set(id, r.data);
    return { ok: true, value: r.data };
  }

  level(id: string): ContentResult<LevelDefinitionT> {
    const cached = this.levelCache.get(id);
    if (cached) return { ok: true, value: cached };
    const raw = this.raw.levels[id];
    if (raw === undefined) return { ok: false, error: 'not_found' };
    const r = LevelDefinition.safeParse(raw);
    if (!r.success) return { ok: false, error: 'invalid', detail: r.error.message };
    this.levelCache.set(id, r.data);
    return { ok: true, value: r.data };
  }

  /** Level ids authored in this build (worlds may list levels not yet authored). */
  authoredLevelIds(): string[] {
    return Object.keys(this.raw.levels);
  }

  /** Authored levels of a world, in world order. */
  levelsOf(worldId: string): LevelDefinitionT[] {
    const w = this.world(worldId);
    if (!w.ok) return [];
    return w.value.levels.flatMap((id) => {
      const l = this.level(id);
      return l.ok ? [l.value] : [];
    });
  }

  /** Worlds a child can enter: those with at least one authored level (no empty or locked worlds). */
  playableWorlds(hidden: readonly string[] = []): WorldDefinitionT[] {
    return this.worlds().filter((w) => !hidden.includes(w.id) && this.levelsOf(w.id).length > 0);
  }

  private memo = new Map<string, unknown>();
  private once<T>(key: string, f: () => T): T {
    if (!this.memo.has(key)) this.memo.set(key, f());
    return this.memo.get(key) as T;
  }

  audioManifest() {
    return this.once('audio', () => AudioManifest.parse(this.raw.audioManifest));
  }

  uiAudio() {
    return this.once('ui', () => UiAudioFile.parse(this.raw.uiAudio));
  }

  uiLine(key: string): LocalizedAudioRef | undefined {
    return this.uiAudio().lines[key];
  }

  vocabulary(id: string): VocabularyEntry | undefined {
    return this.once('vocab', () => new Map(VocabularyFile.parse(this.raw.vocabulary).entries.map((v) => [v.id, v]))).get(id);
  }

  /** A vocabulary word as a spoken line; mixed mode says Arabic then English (05 §4.2). */
  vocabLine(id: string): LocalizedAudioRef | undefined {
    const v = this.vocabulary(id);
    if (!v) return undefined;
    return {
      ar: [v.audio],
      en: [v.audio],
      mixed: [`${v.audio}:ar`, `${v.audio}:en`],
      caption: { ar: v.written.ar, en: v.written.en, mixed: `${v.written.ar} · ${v.written.en}` },
    };
  }

  /** Asset id → URL and 1× display size, for the game (07 §7). Planned assets are absent. */
  assetTable(): Record<string, { url: string; w: number; h: number; placeholder: boolean }> {
    return this.once('assets', () => {
      const out: Record<string, { url: string; w: number; h: number; placeholder: boolean }> = {};
      for (const a of AssetManifest.parse(this.raw.assetsManifest).assets) {
        const file = a.files[0];
        if (!file || a.status === 'planned') continue;
        out[a.id] = { url: `/${file}`, w: a.displaySize1x?.w ?? 200, h: a.displaySize1x?.h ?? 200, placeholder: a.status !== 'approved' };
      }
      return out;
    });
  }
}
