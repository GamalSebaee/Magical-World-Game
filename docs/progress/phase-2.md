# Phase 2 — AF-01 vertical slice: report

Date: 2026-10-20. Plan reference: [10-milestones-and-risks §P2](../planning/10-milestones-and-risks.md). Defaults used for the open questions: Phaser 3.90, placeholder voice and art (Q3/Q5 unanswered), standard pronunciation for words (Q4), Eastern Arabic digits (Q7).

## 1. What a child can do now

Splash → (first run: grown-up setup with privacy summary, microphone choice, language, child name/age) → avatar creator → Nono's welcome → world map → Animal Forest → **AF-01 "Meet Cat & Dog"**:

1. **tap_discover**: tap the bush and the tree; the cat and the dog pop out and their names are spoken.
2. **listen_choose**: "Where's the dog?" / "Where's the cat?". A wrong pick says its own name and the question repeats.
3. **speak_repeat**: hear the word, record, hear yourself, try again or continue. Or, if the microphone is off or denied, "say it with Nono", which never claims to have listened.

→ result screen with a sticker (granted once) → sticker book. Pause, help (three hint levels, ending with a demonstrating hand), the ear button, skip, resume after refresh, and the grown-ups area (gate, language, microphone, reduced motion, sound, delete all data) all work.

## 2. Built

| Area | What | Where |
|------|------|-------|
| Audio | Web Audio playback (one context, unlock on gesture, one voice at a time, queued sequences, SFX polyphony 4, ducking, mute, pause), manifest resolver for ar/en/mixed, captions for placeholder audio | `src/services/audio/` |
| Microphone | Recorder state machine with all 12 states from 06 §5, MIME selection, 15 s permission timeout, 1 s stop watchdog, auto-stop at 5 s, track cleanup on stop/cancel/error/dispose, URL revocation; on-device voice detection; honest feedback mapping | `src/services/mic/` |
| Engine | Lifecycle controller (intro → ready → feedback → completed/skipped, pause, idle hints max 2, hint escalation after 2 not-yets, skip offer after 4, demo hand at level 3, stale-callback tokens); pure rules for tap_discover, listen_choose, speak_repeat; level runner with evidence, attempts, mid-level snapshot, idempotent completion and sticker | `src/game/core/engine/`, `src/game/activities/`, `src/features/levels/` |
| Scenes | World map (tap vs drag, reduced motion, DOM mirror for keyboards and tests); activity scene with backdrop, hint glow, demo hand; three adapters laid out per orientation below the HUD | `src/game/core/scenes/`, `src/game/activities/*/scene.ts` |
| Screens | C1 splash, P1 setup and gate, C2 profiles, C2a new profile, C3 avatar, C4 welcome, C5 map, C6 world, C7 intro (with Continue), C8 play shell, C9 speech panel, C10 result, C11 sticker book, C12 pause, C13 help (via HUD), minimal parent area | `src/app/`, `src/features/` |
| Content | Shared UI voice lines (30, gender-neutral Arabic), 9 SFX, level backdrop field, per-language clip requirements, transcripts in the manifest | `src/content/ui-audio.json`, manifests |
| Placeholders | 117 generated clips (English with flite; **Arabic as a tone, with captions**; synthesised SFX) and 11 vector placeholder art files, all marked `placeholder` in the manifests | `scripts/audio/gen-placeholders.ts`, `public/assets/` |

## 3. Tests

| Suite | Result |
|-------|--------|
| Unit + component (Vitest) | **120 passed**. New: audio policy (10), resolver (4), microphone state machine and VAD (18), speech feedback, mechanic rules, controller lifecycle (9), level runner end to end with memory storage (3) |
| E2E Chromium (phone portrait, phone landscape, desktop) | **78 passed (26 × 3)**, covering: full AF-01 playthrough; sticker granted once across refresh and replay; skip-everything still celebrates; rapid taps reveal once; rotation mid-activity keeps state, keeps targets on screen and does not replay audio; refresh → Continue resumes at the same step, Start over discards; backgrounding and browser back pause; restart and leave from pause; help to the demo hand; English clips + LTR; mixed mode says Arabic then English; every journey screen keeps child buttons ≥ 64 px and on screen; parent gate (hold + written instruction); map hides worlds with no levels; drag doesn't enter a world; 20 map round-trips reuse one game; axe on splash and setup; **real microphone** with a fake capture device (voice detected, hear-me, tracks stopped after each recording, auto-stop at the limit, tracks stopped when leaving mid-recording, silence → "try again", denied → "say it with Nono", mic off → `getUserMedia` never called); **full AF-01 offline** after caching, with its audio |
| E2E Firefox / WebKit | Not run here (only Chromium is installed in this environment); CI is configured for both. Microphone and offline specs are Chromium-only by design |
| Lint, typecheck, content validation, production build | Pass |

Bugs found by the slice and fixed:
1. **VAD missed children who speak immediately.** The noise floor came from the first 200 ms, so speech starting at the tap raised the threshold above the voice. Now a 10th-percentile floor with a cap; tested.
2. **The mic level meter could measure silence on real devices.** It used a new AudioContext outside a gesture; it now reuses the unlocked app context.
3. **Auto-stopped recordings were lost.** Results now come from an `onFinished` event for every stop.
4. **The home button on the map was unclickable** (a transparent bar covered it).
5. **The landscape avatar screen cropped Save/Cancel; the landscape speech panel covered the picture.**
6. **The activity backdrop showed the "missing asset" placeholder** (it was read from the wrong definition).

## 4. Slice definition of done (10 §P2), honestly

| Item | Status |
|------|--------|
| Every slice screen and interaction works with real input | **Done** (Chromium, touch and mouse) |
| ar/en/mixed audio for AF-01 | **Placeholder**: English is robotic flite; **Arabic is a tone with captions**, because no Arabic voice exists here and a wrong pronunciation would teach the wrong word. Needs Q3 (voice source) and Q5 (reviewer) |
| Real mic capture, fallback, privacy | **Done** in Chromium with fake devices. Not yet verified on a real phone |
| Persistence, resume, idempotent rewards | **Done** |
| Both orientations, offline | **Done** in Chromium |
| Real Android phone and desktop browsers | **Not done**: no physical device in this environment. Desktop Firefox/WebKit not run locally |
| Child-usability pilot with 1–2 children | **Not done**: needs you (supervised, protocol in 09 §8) |
| Final art | **Placeholder** vector art, labelled in the manifest |

## 5. Measured

| Budget (provisional) | Measured | Verdict |
|----------------------|----------|---------|
| App shell JS ≤ 200 KB gzip | 237 KB (`/`), 239 KB (map), 245 KB (play), excluding Phaser | **Over**, up from 223 KB in P1. Likely candidates: Zod at boot, and screens bundled into shared chunks. Proposed for Phase 3: `zod/mini` or lazy validation, plus a bundle analysis |
| Phaser chunk | 315 KB gzip, lazy | As expected |
| Total precache | 4.0 MB, 246 files (AF-01 art/audio placeholders included) | Well within 35 MB |

## 6. Decisions and deviations

- **D4 changed: no XState.** Activity, audio and microphone state machines are small hand-written typed machines with explicit transition tables and tokens for stale callbacks. They are fully unit-tested, framework-free and add no dependency. The plan listed this as the alternative; XState can still be adopted later behind the same interfaces.
- **D15: worlds appear on the map only when they have authored levels.** No locked or empty destinations; Color Town and Number Island appear when their levels exist.
- **D16: Arabic placeholder audio is a tone plus a caption, never synthetic Arabic speech.**
- **D17: VAD noise floor = 10th percentile of the recording, threshold capped at 0.12 RMS.**
- Boot and provider modules moved from `app/_providers` to `features/boot` so features can use services without importing `app/`.
- The temporary language picker left the splash; language is now a grown-up setting (setup and parent area).

## 7. Known limitations

- Only AF-01 exists; the map therefore shows one world.
- The parent area is minimal: no PIN, dashboard, progress, export or per-child management yet (Phase 6).
- Emoji glyphs are used for some icons (avatar tabs, "say it together", "hear me"); they render differently per device and will be replaced with drawn icons.
- An idle hint can, rarely, start while a recording is in progress (if the child waits about 10 s, then records). It's harmless but should be suppressed.
- After leaving the play screen, one extra history entry remains, so browser back from the map can return to the level (which then offers Continue).
- Test hooks are compiled into production bundles but never installed there (the flag is tested); they could be stripped at build time.

## 8. How to demo

```
pnpm install
pnpm build && pnpm start        # http://localhost:3000
```
Use a phone-sized window or device emulation. On first run you'll see the grown-up setup: choose "microphone on" to try real recording. Arabic lines play a tone and show their caption; switch to English in setup or in the grown-ups area (hold the button for 2 s, then follow the written instruction) to hear the robotic placeholder voice.

## 9. Next approval point

Review the slice (ideally on a real phone, and with a child, per 09 §8). Before Phase 3 (the remaining mechanics: drag_drop, match_pairs, count_objects):
1. Any feedback on the slice's flow, layout or tone.
2. Q3 and Q5, so real Arabic and English voice work can start in parallel, since it is the critical path (R1).
3. GitHub push access (still blocked).
