# 04 — Gameplay and Activities

## 1. Core loop

```
Map → World → Level intro → [Activity 1 → Activity 2 → … (2–4)] → Result (sticker) → suggestion / replay / map
```

Inside each activity: **instruction → try → feedback → (hint) → try → … → success or skip → short celebration → next**.

Principles: one goal per activity; the child can always replay the instruction, ask for help, or skip; wrong tries are information, not failures; no timers end play.

## 2. Engine components (`game/core`)

| Component | Responsibility |
|-----------|----------------|
| `ActivityRegistry` | Maps `mechanic` → `{ machine, createInitialState, evaluate, SceneAdapter, schema }`. Registration is static (no dynamic imports of unknown types) |
| `ActivityController` | An XState 5 actor built from the base lifecycle machine plus the mechanic's interaction sub-machine |
| `LevelRunner` | Sequences activities, handles resume, emits level completion, owns disposal |
| `EventBus<AppEvent>` | Typed pub/sub (02 §3.2) |
| `HintPolicy` | Decides hint level from tries, idle time, age band and help taps |
| `FeedbackDirector` | Maps outcomes to audio clip ids, animations and Nono state; enforces "one voice at a time" |
| `LayoutSolver` | Turns a mechanic's anchor spec + viewport + safe area into object positions/scales for P or L |
| `ContentResolver` | Resolves `LocalizedText`/`LocalizedAudio` for the current language mode |
| `RewardIntent` | Computes the idempotent grant key; actual grants happen in `features/rewards` |

### 2.1 Typed definitions (summary; full Zod in 05)

```ts
type ActivityDefinition =
  | TapDiscoverDef | ListenChooseDef | DragDropDef
  | MatchPairsDef | CountObjectsDef | SpeakRepeatDef;   // discriminated by `mechanic`

interface ActivityBase {
  id: ActivityId;                  // e.g. "af01.a1"
  mechanic: Mechanic;
  skills: SkillId[];               // skills this activity provides evidence for
  instruction: LocalizedAudioRef;  // spoken instruction
  hints: [LocalizedAudioRef, LocalizedAudioRef?, LocalizedAudioRef?];
  layout: LayoutPresetId;          // e.g. "row-3", "two-bins"
  completion: CompletionRule;
  allowSkip: true;                 // always true in MVP; schema literal
}
```

## 3. Base activity lifecycle (state chart)

```
           ┌────────── fatal ◀──────────────(unrecoverable)───────────────┐
           │                                                              │
 idle ─▶ loading ─▶ intro ─▶ ready ─▶ interacting ─▶ validating ─▶ feedback ─┬─▶ completed
           │  ▲        │       ▲          │   ▲                        │     ├─▶ retry ─▶ ready
           │  └retry───┘       │          │   └──────(more to do)──────┘     └─▶ skipped
           ▼                   │          ▼
     recoverableError ─────────┘      (SKIP from intro/ready/interacting/feedback) ─▶ skipped

 Parallel region "pause": running ⇄ paused (PAUSE/RESUME). While paused, input is ignored,
 timers are suspended, audio is suspended, recording is cancelled.
```

| State | Entry actions | Accepts | Exit to |
|-------|---------------|---------|---------|
| `idle` | — | `START` | `loading` |
| `loading` | preload activity assets (resolver), with timeout 8 s | `LOADED`, `LOAD_FAILED` | `intro` / `recoverableError` |
| `intro` | play instruction; Nono `talking` | `INTRO_DONE`, `SKIP`, `INPUT.*` (tapping early ends the intro and is handled) | `ready` |
| `ready` | Nono `waiting`, start idle-hint timer | `INPUT.*`, `HELP`, `SKIP` | `interacting` |
| `interacting` | lock handled targets | `INPUT.*` | `validating` (on a meaningful input) |
| `validating` | run pure `evaluate()` | — (sync) | `feedback` |
| `feedback` | play feedback, animate, emit `activity.evaluated` | `FEEDBACK_DONE` (audio ended or 2.5 s cap) | `completed` / `ready` (partial progress) / `retry` |
| `retry` | raise hint level per policy | — | `ready` |
| `completed` | emit `activity.completed` once (guarded by `emitted` flag) | — | final |
| `skipped` | emit `activity.skipped`; evidence `skipped` | — | final |
| `recoverableError` | Nono apology; show retry + skip | `RETRY`, `SKIP` | `loading` / `skipped` |
| `fatal` | log, emit `app.error` | — | final (LevelRunner skips the activity) |

Guards against common bugs:
- **Duplicate taps:** a target id already in `handledTargets` is ignored; input is ignored outside `ready`/`interacting`; `feedback` drops input (except `SKIP`/`PAUSE`).
- **Duplicate reward grants:** completion events are emitted from final states only, once; grant keys are idempotent in storage (08 §4).
- **Stale async callbacks:** asset loads and audio `ended` callbacks carry the actor's `runId`; old ones are dropped. Actor stop cancels invoked services.
- **Unmount during recording:** `LevelRunner.dispose()` sends `CANCEL` to the mic actor and awaits track stop (with a 500 ms hard stop fallback).
- **Route change:** `dispose()` is called from the route component's cleanup and on `pagehide`.

### 3.1 Evaluation outcomes

```ts
type EvalOutcome =
  | { kind: 'correct'; firstTry: boolean; hintLevel: 0|1|2|3 }
  | { kind: 'partial'; progress: number; total: number }       // e.g. 2 of 3 found
  | { kind: 'not_yet'; reason: 'wrong_choice' | 'wrong_target' | 'miscount' }
  | { kind: 'speech'; result: SpeechAttemptResult };          // never "correct"
```

`evaluate(def, state, input)` is a pure function per mechanic. It is fully unit-tested and deterministic for all non-speech mechanics.

### 3.2 Hint policy (defaults; parent can set slower/faster)

| Trigger | Effect |
|---------|--------|
| Help tapped | hint level +1 (max 3) |
| 2 consecutive `not_yet` | hint level +1 |
| Idle 12 s in `ready` (15 s age 3, 10 s age 6) | play hint at current level (min 1); max 2 auto-hints per activity |
| Hint level 3 | hand demonstrates on the real target; child still performs the action |

### 3.3 Retry and skip

- Retry is automatic and gentle; there is no retry counter shown and no limit.
- After 4 `not_yet` in one activity, the skip arrow pulses and Nono offers: "نجرب حاجة تانية؟ / Shall we try something else?" — the child can keep trying.
- Skip records `skipped` evidence; the level still completes when every activity is completed or skipped. Rewards are the same.

## 4. The six mechanics

For each: definition, loop, evaluation, layouts, edge cases, events, acceptance.

### 4.1 `tap_discover`

- **Definition:** `items[]` (id, sprite, word audio, reveal animation, optional hidden-behind object), `mode: 'all' | 'sequence'`, `completion: { type: 'all_found' }`.
- **Loop:** instruction ("let's find the animals") → child taps an object or a hiding place → reveal animation + word ("قطة! / Cat!") + SFX → item marked found → next.
- **Evaluation:** each item counts once; `sequence` mode accepts only the next item (others wobble with hint "first let's find…"). Taps on background do nothing (no penalty).
- **Layouts:** `scatter-3/4/5` presets with P and L anchor sets; hiding objects have hit areas ≥ 96 px.
- **Edge cases:** a tap on another item during a reveal is ignored (not queued) until the reveal finishes (≤ 1.2 s); rapid taps on the same item → one reveal.
- **Events:** `activity.interaction(kind=tap, targetId)`, `activity.evaluated(correct, skill=vocab.*, introduced)`.
- **Acceptance:** (1) Given 2 items, when the cat is tapped 5 times quickly, then exactly one reveal plays and found=1. (2) Given both found, then the activity completes once. (3) Given rotation after 1 found, then the found item stays revealed at its new position.

### 4.2 `listen_choose`

- **Definition:** `rounds[]` each with `prompt` (audio: "فين الكلب؟ / Where's the dog?"), `choices[]` (2–4 picture ids), `answer`, optional `distractorFeedback` per wrong choice; `shuffle: boolean` (seeded per attempt so a resume shows the same order).
- **Loop:** prompt → child taps a picture → correct: celebrate, next round; wrong: the picture gently shakes and says its own name ("دي قطة / That's the cat"), then the prompt repeats.
- **Evaluation:** correct if `choiceId === answer`. `firstTry` true if no wrong choice in the round. Wrong choices are not disabled after one try (child can learn by trying), but hint level 2 dims non-answers.
- **Layouts:** `row-2`, `row-3`, `grid-4` (P: 2×2, L: 1×4).
- **Edge cases:** tap during prompt → accepted (children often know); two simultaneous touches → first pointer only.
- **Acceptance:** (1) Given round 1 answer "dog", when "cat" then "dog" are tapped, then evidence = correct with firstTry=false. (2) Given resume, then choice order is identical. (3) Given audio unavailable, then the prompt is shown as an animated thought-bubble picture of the target with a "?".

### 4.3 `drag_drop`

- **Definition:** `draggables[]` (id, sprite, home position slot), `targets[]` (id, sprite, accepts: draggable ids or tags such as `color:red`), `completion: { type: 'all_placed' } | { type: 'count_placed', n }`.
- **Loop:** instruction → child drags an item → on release over an accepting target: snap in, confirmation SFX + word; over a non-accepting target or nowhere: tween back home (snapback 250 ms) with a soft "boop" and target-specific hint if over a wrong target.
- **Forgiveness:** drop zone = target bounds expanded by 40% (min 120 px square); if the release point is outside but the item's center moved ≥ 60% of the way to an accepting target and is closer to it than any other, accept ("magnet" assist; off at age 6). Drag starts after 6 px movement; a tap without movement on a draggable plays its name.
- **Input:** Pointer Events (touch, mouse, pen); one active drag at a time; `pointercancel`, pointer leaving the canvas, rotation, `visibilitychange` → cancel drag + snapback.
- **Counting drops:** with `count_placed`, each accepted drop speaks the running count through the same queued counting audio as `count_objects`; drops after `n` bounce back with "that's n!".
- **Alternative input:** tap item then tap target (also used by keyboard/switch users in the parent's hands).
- **Acceptance:** (1) Given a carrot released 30 px outside the bunny's basket, then it is accepted. (2) Given a drag interrupted by rotation, then the item returns home and no placement is recorded. (3) Given a red ball dropped on the blue bin, then it snaps back and Nono says the ball's color.

### 4.4 `match_pairs`

- **Definition:** `pairs[]` of `{ left, right }` (e.g. animal picture ↔ animal sound icon; shape ↔ same-colored shape), `presentation: 'two-columns' | 'grid'`, `revealMode: 'visible'` (MVP: always visible, no memory-flip game for 4-year-olds).
- **Loop:** tap a card (selected glow + its audio) → tap a card on the other side → match: both connect with a sparkle line and lock; no match: both wiggle, selection clears.
- **Evaluation:** pair is correct if ids map; each pair counts once; a selected card tapped again deselects.
- **Layouts:** P: two rows (top/bottom); L: two columns. Max 4 pairs.
- **Acceptance:** (1) Given cat selected then the "meow" card, then the pair locks. (2) Given a locked pair, when tapped, then nothing changes. (3) Given cat selected then the dog picture (same side), then the selection moves to dog (no error).

### 4.5 `count_objects`

- **Definition:** `objects[]` (sprites, positions preset), `target: number` (1–5), `ask: 'how_many' | 'tap_n'`, `answerChoices?` (for `how_many`, 2–3 numeral cards with dot patterns), `countAudio` (per-number clips).
- **Loop (`how_many`):** instruction "نعدّ سوا! / Let's count!" → child taps each object; each first tap: the object hops, a numeral badge appears on it, and the next number is spoken (1, 2, 3…) in sync → after all are counted, Nono asks "كام؟ / How many?" and shows numeral cards → child taps the number.
- **Loop (`tap_n`):** "Give the bunny 3 carrots" → child taps/drag carrots into the basket; the count is spoken as each lands; at the target the basket closes. Extra taps after the target are ignored with a gentle "that's 3!"
- **Count integrity:** each object id is in a `counted` set; second taps on a counted object re-say its number without incrementing. The spoken number is driven by the `counted.size` *after* insertion, with audio queued (not overlapped) so fast tapping still speaks 1-2-3 in order; if taps outpace audio by more than 2, earlier numbers are shortened (cut to the next) instead of skipped.
- **Evaluation:** `how_many` correct if chosen numeral = `objects.length`; `tap_n` complete when `counted.size === target`.
- **Acceptance:** (1) Given 3 apples, when one apple is tapped 4 times, then count = 1 and "1" is said each time. (2) Given 3 rapid taps on 3 apples within 300 ms, then the spoken sequence is 1, 2, 3 in order. (3) Given count 3 and the child picks "2", then feedback recounts with highlights and the child chooses again.

### 4.6 `speak_repeat`

- **Definition:** `word` (vocabulary id), `modelAudio` (per language; mixed mode uses the English target word with an Arabic carrier phrase), `picture`, `maxRecordMs` (default 5000), `attemptsBeforeAutoContinue` (default 2), `recognition: 'off' | 'optional'` (MVP content uses `optional`; runtime decides by consent and availability).
- **Loop:** model plays → Nono "listening" pose → child taps mic → records up to 5 s (or taps to stop) → local voice-activity detection → feedback → "hear me" and "again" buttons → child taps continue (arrow) or does it again; after the second recorded attempt, the activity offers to continue automatically.
- **Evaluation:** produces a `SpeechAttemptResult` (06 §7): `recorded_voice_detected`, `recorded_silence`, `recognized_match` (only if recognition consented and available; still shown as a friendly "I heard you!" not "correct"), `recognized_no_match` (treated exactly like `recorded_voice_detected` for the child), `prompt_only` (no mic), `unavailable`.
- **Completion:** after ≥ 1 attempt of any kind, or skip. The activity never blocks on speech quality.
- **Acceptance:** see 03 C9 and 06 §9.

## 5. Mechanic → level usage (coverage check)

| Mechanic | Levels |
|----------|--------|
| `tap_discover` | AF-01, AF-02, AF-04, CT-01, CT-04, NI-04 |
| `listen_choose` | AF-01, AF-03, AF-04, CT-01, CT-03, NI-01, NI-03 |
| `drag_drop` | AF-02, CT-02, CT-04, NI-02, NI-04 (AF-02, NI-02, NI-04 use `count_placed`) |
| `match_pairs` | AF-03, CT-03, NI-03 |
| `count_objects` | AF-02, AF-04, NI-01, NI-02, NI-04 |
| `speak_repeat` | AF-01, AF-03, CT-03, CT-04, NI-01, AF-04 |

Every mechanic is used in at least three levels and in at least two worlds.

## 6. Rewards

- Each level has exactly one sticker. Grant on the first `level.completed` for (profile, level). Grant key: `sticker:<profileId>:<stickerId>`.
- In-activity micro-rewards: sparkles, Nono dances, a star that flies into the progress dots. No numeric scores.
- Decorations: some stickers unlock a map decoration (e.g. a flower patch near Animal Forest). This is cosmetic and never unlocks content.

## 7. Layout and rotation

Each mechanic declares anchor presets:

```ts
interface LayoutPreset {
  id: LayoutPresetId;
  portrait: AnchorSet;   // normalized positions (0–1) within the safe play rect, plus scale rules
  landscape: AnchorSet;
  minTargetPx: number;   // enforced; solver shrinks spacing before shrinking targets
}
```

- Orientation is `width >= height ? 'landscape' : 'portrait'`, evaluated on every resize (debounced 100 ms); Phaser `scale.resize` → each adapter's `layout()`.
- Objects tween to new anchors over 200 ms (instant under reduced motion). Drags are cancelled on orientation change.
- The solver asserts in dev/test that no target is smaller than `minTargetPx` or outside the safe rect; Playwright reads these rects via `window.__MWG__` (09 §4).

## 8. Pause, background and resume

- `visibilitychange: hidden` / `pagehide` → `PAUSE` to the activity, `suspend()` the `AudioContext`, cancel recording, write the activity snapshot.
- Snapshot: `{ levelId, contentVersion, activityIndex, activityId, mechanicState (serializable), hintLevel, seed, startedAt }`. On reload, the level intro offers continue (03 C7). Snapshots older than 24 h or with a different content version are discarded.
- On return: show the pause menu; resume replays nothing unless the instruction was cut off.

## 9. Debug playground (P3)

`/dev/playground` lists every activity definition, lets you run any one in isolation with language/orientation/reduced-motion toggles, a fake mic (silence / voice / denied / unsupported), audio on/off and a state inspector (XState snapshot). Excluded from production by flag.
