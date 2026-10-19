import {
  parsePinnedClip,
  type LevelDefinition,
  type LocalizedAudioRef,
  type WorldDefinition,
} from '@content/schema';

/** Everything a piece of content points at, collected so cross-references can be checked. */
export interface ContentReferences {
  clips: Set<string>;
  assets: Set<string>;
  vocab: Set<string>;
  skills: Set<string>;
  levels: Set<string>;
}

export function emptyRefs(): ContentReferences {
  return { clips: new Set(), assets: new Set(), vocab: new Set(), skills: new Set(), levels: new Set() };
}

function addAudioRef(refs: ContentReferences, a: LocalizedAudioRef | undefined) {
  if (!a) return;
  for (const id of [...a.ar, ...a.en]) refs.clips.add(id);
  for (const pinned of a.mixed ?? []) refs.clips.add(parsePinnedClip(pinned).id);
}

export function collectWorldRefs(w: WorldDefinition, refs = emptyRefs()): ContentReferences {
  addAudioRef(refs, w.nameAudio);
  addAudioRef(refs, w.welcome);
  refs.assets.add(w.mapHotspot.asset);
  for (const l of w.levels) refs.levels.add(l);
  return refs;
}

export function collectLevelRefs(lvl: LevelDefinition, refs = emptyRefs()): ContentReferences {
  addAudioRef(refs, lvl.story.intro);
  addAudioRef(refs, lvl.story.outro);
  refs.assets.add(lvl.story.illustration);
  refs.assets.add(lvl.sticker.asset);
  addAudioRef(refs, lvl.sticker.name);
  for (const s of lvl.skills) refs.skills.add(s);
  for (const l of lvl.suggestedNext) refs.levels.add(l);

  for (const a of lvl.activities) {
    addAudioRef(refs, a.instruction);
    a.hints.forEach((h) => addAudioRef(refs, h));
    a.successFeedback?.forEach((f) => addAudioRef(refs, f));
    for (const s of a.skills) refs.skills.add(s);

    switch (a.mechanic) {
      case 'tap_discover':
        for (const it of a.items) {
          refs.vocab.add(it.vocab);
          refs.assets.add(it.asset);
          if (it.hiddenBehind) refs.assets.add(it.hiddenBehind);
        }
        break;
      case 'listen_choose':
        for (const r of a.rounds) {
          addAudioRef(refs, r.prompt);
          for (const c of r.choices) {
            refs.vocab.add(c.vocab);
            refs.assets.add(c.asset);
          }
        }
        break;
      case 'drag_drop':
        for (const d of a.draggables) {
          refs.assets.add(d.asset);
          if (d.vocab) refs.vocab.add(d.vocab);
        }
        for (const t of a.targets) refs.assets.add(t.asset);
        break;
      case 'match_pairs':
        for (const p of a.pairs) {
          refs.assets.add(p.left.asset);
          refs.assets.add(p.right.asset);
          if (p.left.audio) refs.clips.add(p.left.audio);
          if (p.right.audio) refs.clips.add(p.right.audio);
        }
        break;
      case 'count_objects':
        for (const o of a.objects) refs.assets.add(o.asset);
        if (a.basket) refs.assets.add(a.basket);
        break;
      case 'speak_repeat':
        refs.vocab.add(a.vocab);
        refs.assets.add(a.picture);
        addAudioRef(refs, a.model);
        break;
    }
  }
  return refs;
}
