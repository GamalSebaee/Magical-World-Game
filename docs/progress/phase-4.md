# Phase 4 — 3 worlds / 12 levels: report

Date: 2026-10-20. Plan reference: [10-milestones-and-risks §P4](../planning/10-milestones-and-risks.md), level catalog [05a](../planning/05a-level-catalog.md).

Assumptions are unchanged: **Q3** (voice source) and **Q5** (Arabic reviewer) are still open, so every new line is a labelled placeholder (English: robotic flite; Arabic: a tone with captions). Q4: standard pronunciation for words. Q7: Eastern Arabic digits in Arabic and mixed modes.

## 1. What a child can do now

The map has three real destinations. Each world opens on an overview with its four levels, all open from the start. All 12 levels play from the map to their sticker:

| World | Level | Activities |
|-------|-------|-----------|
| Animal Forest | AF-01 Meet Cat & Dog | tap_discover · listen_choose · speak_repeat (P2) |
| | AF-02 Rabbit & Carrot | tap_discover (sequence) · drag_drop (count to 2) · count_objects (tap 3) |
| | AF-03 Animal Sounds | listen_choose (who says moo/quack/woof) · match_pairs (4 animals ↔ sound cards) · speak_repeat «cow» |
| | AF-04 Forest Adventure | tap_discover (sequence, introduces «bird») · listen_choose · count_objects (how many map pieces) · speak_repeat «dog» |
| Color Town | CT-01 Red, Blue, Yellow | tap_discover (grey things regain their colour) · listen_choose (3 rounds, a different toy shape per colour) |
| | CT-02 Color Matching | drag_drop (3 toys) · drag_drop (6 toys by `color:*` tag) |
| | CT-03 Shapes & Colors | listen_choose (circle/triangle/square) · match_pairs (shape ↔ same-colour window) · speak_repeat «circle» |
| | CT-04 Rainbow Rescue | tap_discover (sequence, adds «green») · drag_drop (4 drops onto 4 rainbow bands) · speak_repeat «red» |
| Number Island | NI-01 Numbers 1–3 | count_objects ×2 · listen_choose (numeral cards) · speak_repeat «three» |
| | NI-02 Numbers 1–5 | count_objects (4 fish) · drag_drop (5 of 6 fish home) · count_objects (5 starfish) |
| | NI-03 More or Less | listen_choose (who has more ×3) · listen_choose (who has fewer ×2) · match_pairs (bananas ↔ numeral) |
| | NI-04 Treasure Counting | tap_discover (rocks 1→2→3 in order) · count_objects (4 coins) · drag_drop (5 jewels into the chest) |

36 activities in total. Every mechanic is used in at least 3 levels (checked by a test) and in at least 2 worlds.

## 2. Built

| Area | What |
|------|------|
| Levels | 11 new level files (`src/content/levels/`), written from the 05a catalog. Story intro/outro, sticker, learning goal, 2–4 activities each. Content version is now 0.2.0 for all content |
| Vocabulary and skills | 20 words (animals, food, colours, shapes, numbers 1–5); 32 skills incl. `math.numeral.1–5`, `math.compare.more_less`, `shape.identify.*`, `listen.sounds.*`, `speak.vocab.*` |
| Engine | Evidence by vocabulary domain (D21); listen_choose rounds can name their skill; counting drags (`count_placed`) give counting evidence; up to 4 drop targets; numeral cards draw their digit in the chosen style (D22); a wrong tap in sequence mode names the item that comes next ("…one!") |
| Art | 83 new placeholder vector files: 4 animals, 11 backgrounds, ~45 objects, 8 shapes/outlines, 11 intro scenes, 11 stickers. All are `placeholder` in the manifest |
| Audio | 150 new clips, 294 language files + 2 animal sounds, generated as labelled placeholders. 236 clips in total; reviewers can find every transcript in the full manifest |
| Runtime manifests | The app ships slim manifests generated from the full ones (D23); `pnpm content:runtime`, run automatically by the manifest scripts |
| World screen | 2×2 grid in portrait, one row in landscape; buttons scale with the screen (120–150 px) |

## 3. Tests

| Suite | Result |
|-------|--------|
| Unit + component (Vitest) | **170 passed** (156 in P3). New: every activity of every level is solved through the real rules by following only the hint target, and must complete and evidence only its declared skills; level/world/mechanic coverage |
| E2E Chromium (3 projects) | **156 passed (52 × 3)** on the final build. Earlier runs found the bugs in §4; one run also had a microphone test misread the fake device as silence under load (desktop only, unrelated to this phase); it passed on re-run and in every other run |
| New E2E | Map shows the three worlds; each overview lists its 4 levels on screen; the sticker book turns its pages; **each of the 12 levels is played in the real app from the map to its sticker** (taps, drags as tap-then-tap, "say it with Nono" for speaking), with no console errors |
| Content validation | Pass. 563 warnings (placeholder audio/art), which become errors with `--release`, as intended until Q3/Q5 |
| Firefox / WebKit | Not run here (only Chromium is installed); CI runs them |

## 4. Bugs found and fixed

1. **Every activity's scene started twice.** The scene restart key included the activity id from the first state update, so each activity restarted once while its art was loading ("Texture key already in use" in the console). The key now comes from the controller.
2. **The world screen overflowed** with four levels on phone screens (both orientations). It now uses a 2×2 grid in portrait and smaller buttons on short screens.
3. **Counting drags recorded no learning evidence** when the items had no word (fish, jewels). Placing exactly *n* now counts for the activity's counting skills.

4. **The sticker book overflowed** with 12 levels. It now has one page per world, turned with big arrows.

## 5. Deviations from the catalog

- **CT-04 free play** (tapping the rainbow to play notes after completion) is not built. It records no evidence, so nothing else depends on it.
- **NI-03 wrong pick:** the picked group says its own count; the catalog asks for both groups to count aloud with highlights. Hint level 2 dims the wrong group (the catalog says level 3).
- **AF-03 prompts** ("who says moo?") are spoken lines that include the sound, not SFX inside the prompt. The match activity uses real SFX cards.
- **Characters** (crab, monkeys, parrot) appear in stories and captions only, not as drawn art yet.
- **NI-01 numeral cards** show the digit plus dots (D22); the catalog's "both glyph styles" art is replaced by drawing the digit at runtime.
- **CT-01:** the catalog mentions balloons; the rounds use distinct toy shapes per colour instead, so colour is never the only cue (its own accessibility note).

## 6. Gate (10 §P4) — honestly

| Item | Status |
|------|--------|
| All level JSON, manifests, assets per world | **Done** (placeholders) |
| World overviews; map with three real destinations | **Done** |
| G2 (every level completable, rewards once) | **Done** in Chromium (unit + E2E) |
| G3/G4 (reviewed scripts, approved audio and art) | **Not done**: waits for Q3/Q5, a native Arabic reviewer and the art pass. Release validation fails until then, by design |
| Full child-usability session (5 children) | **Not done**: needs you (09 §8) |

## 7. Measured

Release-build JavaScript per page (`pnpm size`, gzip): **175–177 KB** for most pages and **186 KB** for play (budget 200). Phase 3 measured 170 and 181.

Adding 11 levels first pushed play to **197 KB**: the full audio manifest (transcripts, review notes) was bundled into every page and grows with each clip. The app now ships slim generated manifests instead (D23, −11 KB). The level files themselves are bundled (D10) and cost about 1 KB gzip each. If many more levels are added, loading them on demand is the next step. Precache: 847 files, 9.8 MB (release build; was 4.4 MB), well within the 35 MB budget.

## 8. Known limitations

- From Phase 3: no tween on rotation; layouts not mirrored for RTL; no visual alternative for sound cards when SFX are muted; idle hint during a long drag.
- The banana groups and shapes are simple placeholders; groups are drawn at equal size and spacing (the catalog's design note), but have not been checked with children.
- Arabic scripts are drafts by the engineer, written to the gender-neutral rule (D8), and **need native review** before any recording.

## 9. How to try it

```
pnpm install
pnpm build && pnpm start        # http://localhost:3000
```
Go through setup, then pick any world on the map. Use the grown-ups area to switch to English to hear the placeholder voice.

## 10. Next approval point

Phase 5 (audio resilience, accessibility; TTS only if a provider is chosen) and Phase 6 (profiles, parent area) can start. To finish Phase 4's gate:
1. **Q3 and Q5** so the ~440 voice files can be produced and reviewed.
2. **A native Arabic review of the scripts.** All lines are in the level files and the audio manifest's transcripts.
3. **A usability session** with children (09 §8).
4. **GitHub push access.** Phases 3 and 4 are committed locally and not yet on GitHub.
