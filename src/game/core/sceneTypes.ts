import type { ActivityDefinition } from '@content/schema';
import type { ActivityController, ActivitySnapshot } from './engine/ActivityController';
import type { Rect, Viewport } from './viewport';

/** Asset id → file and 1× size (from the asset manifest, via ContentRepository.assetTable()). */
export type AssetTable = Record<string, { url: string; w: number; h: number; placeholder: boolean }>;

export interface SceneObjectInfo {
  id: string;
  /** CSS-pixel rect, for layout assertions and taps in tests, and the DOM mirror. */
  rect: Rect;
  state: string;
}

export interface AdapterContext {
  def: ActivityDefinition;
  /** The level's backdrop asset. */
  background?: string;
  controller: ActivityController;
  assets: AssetTable;
  reducedMotion: boolean;
  /** Pictures for vocabulary ids (vocab id → asset id). */
  vocabPicture(vocabId: string): string | undefined;
}

/**
 * One per mechanic (04 §2). Built from the definition and the controller's snapshot; layout() is
 * idempotent and never changes state, so rotation only re-anchors objects (04 §7).
 */
export interface ActivitySceneAdapter {
  /** Asset ids to load before create(). */
  assetIds(ctx: AdapterContext): string[];
  create(ctx: AdapterContext): void;
  layout(vp: Viewport): void;
  render(snap: ActivitySnapshot): void;
  /** Rect (CSS px) of a target, for hint glow and the demo hand. */
  targetRect(id: string): Rect | undefined;
  describe(): SceneObjectInfo[];
  destroy(): void;
}

export interface ActivitySceneData {
  ctx: AdapterContext;
}

export interface MapSceneData {
  worlds: Array<{ id: string; asset: string; x: number; y: number }>;
  assets: AssetTable;
  reducedMotion: boolean;
  onSelect(worldId: string): void;
  onLayout?(objects: SceneObjectInfo[]): void;
}
