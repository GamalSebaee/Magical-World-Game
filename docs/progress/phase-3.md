# Phase 3 — Activity engine complete: report

Date: 2026-10-20. Plan reference: [10-milestones-and-risks §P3](../planning/10-milestones-and-risks.md).

Started without the post-Phase-2 review, as agreed. Assumptions for the open questions, unchanged from Phase 2: **Q3** (voice source) recommended default, pre-generated TTS reviewed by a native speaker, not started; **Q5** (Arabic reviewer) unnamed, so Arabic audio stays a labelled placeholder tone; Q4 standard pronunciation for words; Q7 Eastern Arabic digits in Arabic and mixed modes.

## 1. What now exists

All six mechanics run in the game and in the playground. The three new ones:

| Mechanic | What a child does | Key behaviour |
|----------|-------------------|---------------|
| `drag_drop` | Drags each item onto its place (by id or tag, e.g. `color:red`); or taps the item, then the place | Drag starts after 6 px; a tap without movement says the item's name. Drop zone = target + 40% (min 120 px); magnet assist when ≥ 60% of the way and nearest (off at age 6). Wrong place: slides home, Nono names the item (e.g. its colour). Nowhere: slides home, no penalty. `count_placed` says the running count; extra drops bounce with "that's n". One drag at a time; rotation, pause/backgrounding, pointer cancel or leaving the canvas cancel the drag |
| `match_pairs` | Taps a card, then its partner on the other side | Portrait two rows, landscape two columns (2 per row on very short screens). Same side moves the selection; tapping the selected card deselects; mismatch wiggles both and names both. Matched pairs join with a line and lock. Right side shuffled by seed (never all opposite, stable on resume). Sound cards play their sound |
| `count_objects` | `how_many`: taps each object (it hops, gets a number badge, the number is spoken), then picks the numeral card. `tap_n`: taps until the basket holds the target | Each object counts once; re-tapping re-says its number. Numbers come from the count after the tap and are queued, so fast taps still say 1-2-3 in order; if the child gets more than 2 ahead, earlier numbers are cut short, never skipped. A wrong numeral recounts with highlights and asks again. Numeral cards show digit + dots in the chosen digit style |

Shared engine work:

- **Inline outcomes + one voice queue (D19).** Selecting, counting taps and drops that land nowhere stay in `ready`, so children can keep going; feedback and counting lines share one queue. Not-yet counters only move on real tries.
- **Hint policy** extracted into one module (`game/core/engine/hintPolicy.ts`) used by every mechanic: help +1, 2 consecutive not-yets +1, idle hints (age-tuned, max 2), skip offered after 4, demo hand at level 3. For drags the demo hand travels from the item to its place.
- **Layout presets** (`game/core/layout.ts`): items-and-targets, pairs, count; spacing shrinks before targets; every interactive target ≥ 64 px and inside the play area, which also keeps clear of Nono and the skip arrow in the bottom corners. `layoutProblems()` reports violations; the playground shows them live.
- **`/dev/playground`** (R-39): every activity of every level plus 7 fixtures covering each variant; language, orientation (fill / portrait / landscape frame), digits, reduced motion, sound, magnet, microphone (off / real / fake voice / silence / denied / unsupported), restart, ear, help, skip, pause, live state and outcome log, layout check. Development and test builds only (D20).
- **Content for Phase 4:** shared lines (drag, match, count, "how many?", "that's…"), vocabulary (numbers 1–5, red/blue/yellow, rabbit, carrot, apple), 9 skills, 16 placeholder vector images, 42 placeholder clips (English flite, Arabic tone, synthesized cat/dog sounds), all marked placeholder. Schema: pair sides can carry a word and pairs a skill; `count_objects` can carry its own question; new cross-checks (every draggable has an accepting target, pair skills belong to the activity).

## 2. Gate: 04 §4 acceptance checks in the playground, portrait and landscape, touch and mouse

Run on `chromium-portrait` (390×844, touch), `chromium-landscape` (844×390, touch) and `desktop-chromium` (1440×900, mouse). Touch drags use real touch events.

| Check | P touch | L touch | Mouse |
|-------|:-:|:-:|:-:|
| drag 1: carrot released 30 px outside the basket is accepted (magnet off) and "1" is spoken | ✓ | ✓ | ✓ |
| drag 2: rotation mid-drag → item home, nothing recorded, layout still valid | ✓ | ✓ | ✓ |
| drag 3: red ball on blue box → snaps back, Nono says "red", one not-yet | ✓ | ✓ | ✓ |
| drag: drags + tap-then-tap complete the activity | ✓ | ✓ | ✓ |
| match 1+2: cat → its sound card locks; a locked pair ignores taps | ✓ | ✓ | ✓ |
| match 3: same side moves the selection (no not-yet); rotation keeps it | ✓ | ✓ | ✓ |
| match: a sound card plays its sound | ✓ | ✓ | ✓ |
| count 1: one apple tapped 4× → count 1, only "1" spoken | ✓ | ✓ | ✓ |
| count 2: 3 taps on 3 apples within 1 s → spoken 1, 2, 3 in order | ✓ | ✓ | ✓ |
| count 3: "2" for 3 apples → recount 1-2-3 with highlights, then "3" completes | ✓ | ✓ | ✓ |
| count: tap_n fills the basket and completes at the target; numeral cards appear only after counting | ✓ | ✓ | ✓ |
| every activity (AF-01 + 7 fixtures) loads with all targets ≥ 64 px and on screen, no console errors | ✓ | ✓ | ✓ |

## 3. Tests

| Suite | Result |
|-------|--------|
| Unit + component (Vitest) | **156 passed** (120 in P2). New: the three mechanics' rules incl. every 04 §4 case, drop forgiveness and magnet, shuffle stability, hint policy, the voice queue (order, cutting short, pause), inline vs feedback flow, completion once, layout presets at 6 screen sizes, resume mid-count through the level runner |
| E2E Chromium (3 projects) | **117 passed (39 × 3)**: the 26 P2 tests plus 13 playground tests. After the final route change (`page.dev.tsx`) the playground suite was re-run on portrait and desktop (26 passed) |
| E2E Firefox / WebKit | Not run here (only Chromium is installed); CI runs them |
| Lint, typecheck, content validation, production build | Pass |

Found and fixed along the way: release builds still shipped and precached the playground (and the schema library inside it) when it was hidden behind a runtime flag; it is now absent from release builds.

## 4. Code size (the Phase 2 overshoot)

Measured with the new `pnpm size` (gzip -9, JavaScript a modern browser downloads per page):

| Page | P2 report | P3 start, corrected method | Now |
|------|-----------|---------------------------|-----|
| `/` | 237 KB | 202 KB | **170 KB** |
| map | 239 KB | 204 KB | **171 KB** |
| play | 245 KB | 214 KB | **181 KB** |

Two things changed:
1. **Measurement corrected.** The P2 numbers included Next's 38 KB legacy polyfill file, which is `noModule` and never downloaded by browsers that support modules. The budget is now checked by a script, not by hand.
2. **Schema library removed from the app (D18), −33 KB.** Content is fully validated at build time (`pnpm build` fails on invalid content); the app only shape-checks a level before opening it. Schema defaults were removed, so content states every value explicitly (the validator enforces it).

All pages are under the 200 KB budget. Phaser stays a separate lazy chunk (308 KB). Precache: 305 files, 4.35 MB (release build).

## 5. Decisions

- **D18** runtime content is not schema-parsed; build-time validation is the gate.
- **D19** inline outcomes and one voice queue that cuts lines short rather than skipping them.
- **D20** the playground is a `page.dev.tsx` route, present only in development and test builds.

(Recorded in the decision log, 10 §4.)

## 6. Known limitations

- Objects jump to new positions on rotation instead of tweening over 200 ms (04 §7).
- Layouts are not mirrored for RTL: in Arabic mode the items are still on the left in landscape. Harmless for play, but not what 03 intends.
- Sound cards have no visual alternative when SFX are muted (AF-03 QA 3). That's planned for the Phase 5 accessibility pass.
- Two-finger drags are ignored by design (first pointer only), but there is no E2E test for this yet (CT-02 QA 3).
- An idle hint can play while a child is mid-drag for a long time.
- The recount highlight timing is fixed (700 ms per object) rather than following the real audio.
- From Phase 2: idle hint during recording, one extra history entry after leaving play, test hooks compiled into bundles (inactive).
- All new art and audio is placeholder; Arabic remains a tone with captions.

## 7. How to try it

```
pnpm install
pnpm dev                       # http://localhost:3000/dev/playground/
```
Pick an activity (`pg01` colours, `pg02` carrots to 2, `pg03` animal sounds, `pg04` colour pairs, `pg05` count 3 apples, `pg06` give 3 carrots, `pg07` count 5). Use "portrait"/"landscape" to see both layouts, or open the page on a phone.

## 8. Next approval point

Phase 4 (3 worlds / 12 levels) can start on engineering now. Its gate needs reviewed scripts, ~720 voice clips and the art set. The blockers carried over from Phase 2:
1. **Q3 and Q5.** Voice production is the critical path (R1). Without them, Phase 4 levels will be complete and playable, but with placeholder audio.
2. **Your review of the AF-01 slice and the playground,** ideally with a child (09 §8).
3. **GitHub push access** for this repository.
