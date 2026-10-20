import type { LocalizedAudioRef } from '@content/schema';
import { parsePinnedClip } from '@content/schema/pinned';
import { clipPath, type RuntimeAudio } from '@services/content/runtimeManifests';
import { primaryLang, type LanguageMode } from '@shared/i18n/language';

export type ClipSlot = 'ar' | 'en' | 'common';

export interface ResolvedClip {
  id: string;
  slot: ClipSlot;
  url: string;
  /** Not yet approved (planned, placeholder, draft…). The UI shows captions for these. */
  placeholder: boolean;
}

export interface ResolvedLine {
  clips: ResolvedClip[];
  /** Caption in the current mode, for adults and for placeholder audio. */
  caption: string;
  placeholder: boolean;
  /** Clip ids that could not be resolved (missing from the manifest or file). */
  missing: string[];
}

/**
 * Turns content audio references into playable URLs for a language mode (06 §4, step 1:
 * bundled clips). Mixed mode uses the author's `mixed` sequence or falls back to Arabic (05 §4.2).
 */
export class AudioResolver {
  constructor(private readonly manifest: RuntimeAudio, private readonly base = '/') {}

  clip(id: string, slot: ClipSlot): ResolvedClip | undefined {
    const status = this.manifest.clips[id]?.[slot];
    if (!status) return undefined;
    return { id, slot, url: this.base + clipPath(id, slot), placeholder: status !== 'approved' };
  }

  sfx(id: string): ResolvedClip | undefined {
    return this.clip(id, 'common');
  }

  line(ref: LocalizedAudioRef, mode: LanguageMode): ResolvedLine {
    const lang = primaryLang(mode);
    const pairs: Array<{ id: string; slot: ClipSlot }> =
      mode === 'mixed' && ref.mixed
        ? ref.mixed.map((p) => {
            const { id, lang: l } = parsePinnedClip(p);
            return { id, slot: l };
          })
        : ref[lang].map((id) => ({ id, slot: lang }));

    const clips: ResolvedClip[] = [];
    const missing: string[] = [];
    for (const p of pairs) {
      const c = this.clip(p.id, p.slot);
      if (c) clips.push(c);
      else missing.push(`${p.id}:${p.slot}`);
    }
    const caption = (mode === 'mixed' ? ref.caption.mixed : undefined) ?? ref.caption[lang];
    return { clips, caption, placeholder: clips.some((c) => c.placeholder) || missing.length > 0, missing };
  }

  /** Every URL a set of lines needs, for preloading. */
  static urls(lines: ResolvedLine[]): string[] {
    return [...new Set(lines.flatMap((l) => l.clips.map((c) => c.url)))];
  }
}
