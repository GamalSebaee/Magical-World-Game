import type {
  AssetManifest,
  AudioManifest,
  LocalizedAudioRef,
  UiAudioFile,
  VocabularyEntry,
  VocabularyFile,
  ContentIndex as ContentIndexT,
  LevelDefinition as LevelDefinitionT,
  WorldDefinition as WorldDefinitionT,
} from '@content/schema';
import type { RawContentBundle } from '@content/bundle';

export type ContentResult<T> = { ok: true; value: T } | { ok: false; error: 'not_found' | 'invalid'; detail?: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Shape check for a level: enough to refuse a truncated or mismatched file from a stale cache. */
function looksLikeLevel(v: unknown, id: string): v is LevelDefinitionT {
  return isObject(v) && v.id === id && typeof v.contentVersion === 'string' && Array.isArray(v.activities) && v.activities.length > 0 &&
    v.activities.every((a) => isObject(a) && typeof a.id === 'string' && typeof a.mechanic === 'string') && isObject(v.sticker);
}

function looksLikeWorld(v: unknown, id: string): v is WorldDefinitionT {
  return isObject(v) && v.id === id && Array.isArray(v.levels) && isObject(v.mapHotspot);
}

/**
 * Read-only access to bundled content. Content is fully validated against the schemas at build
 * time (`content:validate` runs before `next build` and fails it), so the app does not ship the
 * schema library; it only shape-checks the level being opened in case a stale cache served
 * mismatched content (05 §1, decision D18).
 */
export class ContentRepository {
  private readonly levelCache = new Map<string, LevelDefinitionT>();
  private readonly worldCache = new Map<string, WorldDefinitionT>();

  constructor(private readonly raw: RawContentBundle) {}

  index(): ContentIndexT {
    return this.raw.index as ContentIndexT;
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
    if (!looksLikeWorld(raw, id)) return { ok: false, error: 'invalid', detail: `world ${id} has an unexpected shape` };
    this.worldCache.set(id, raw);
    return { ok: true, value: raw };
  }

  level(id: string): ContentResult<LevelDefinitionT> {
    const cached = this.levelCache.get(id);
    if (cached) return { ok: true, value: cached };
    const raw = this.raw.levels[id];
    if (raw === undefined) return { ok: false, error: 'not_found' };
    if (!looksLikeLevel(raw, id)) return { ok: false, error: 'invalid', detail: `level ${id} has an unexpected shape` };
    this.levelCache.set(id, raw);
    return { ok: true, value: raw };
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

  audioManifest(): AudioManifest {
    return this.raw.audioManifest as AudioManifest;
  }

  uiAudio(): UiAudioFile {
    return this.raw.uiAudio as UiAudioFile;
  }

  uiLine(key: string): LocalizedAudioRef | undefined {
    return this.uiAudio().lines[key];
  }

  vocabulary(id: string): VocabularyEntry | undefined {
    return this.once('vocab', () => new Map((this.raw.vocabulary as VocabularyFile).entries.map((v) => [v.id, v]))).get(id);
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
      for (const a of (this.raw.assetsManifest as AssetManifest).assets) {
        const file = a.files[0];
        if (!file || a.status === 'planned') continue;
        out[a.id] = { url: `/${file}`, w: a.displaySize1x?.w ?? 200, h: a.displaySize1x?.h ?? 200, placeholder: a.status !== 'approved' };
      }
      return out;
    });
  }
}
