import {
  ContentIndex,
  LevelDefinition,
  WorldDefinition,
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
}
