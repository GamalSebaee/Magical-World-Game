# 09 — Testing and Acceptance

## 1. Test strategy

| Layer | Tool | What | When |
|-------|------|------|------|
| Content validation | Vitest + `content:validate` script | Zod schemas, cross-references, audio/image file existence, review status, pack sizes | Every commit (CI) |
| Unit | Vitest | `evaluate()` per mechanic, hint policy, layout solver, evidence rules, resolver chain, idempotency, migrations (fake-indexeddb), mic/audio state machines with fakes | Every commit |
| Component | Vitest + Testing Library (jsdom) | React screens/overlays: states, RTL, a11y roles, debounce | Every commit |
| E2E | Playwright | Journeys across Chromium/Firefox/WebKit, portrait/landscape viewports, offline, mic fakes, rotation | PR + nightly |
| Accessibility | `@axe-core/playwright` | Parent screens (full rules), child screens (contrast, names, target size) | PR |
| Visual | Playwright screenshots | Avatar composition, key screens P/L, RTL/LTR | PR (diff review) |
| Performance | Lighthouse CI + manual device traces | Budgets in 07 §10 | Per milestone |
| Manual device | Checklists | Android Chrome (real device), iOS Safari (required before claiming cross-platform), desktop browsers | Per milestone |
| Child usability | Supervised protocol §8 | Can a 4-year-old play without reading | P2 and P4 |

Mic in E2E: Chromium `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream` (and `--use-file-for-fake-audio-capture=<wav>` for voice vs silence); Firefox `media.navigator.streams.fake`; WebKit: mic tests run as "unsupported/denied" paths plus manual iOS checks. Permission denied via `context.grantPermissions([])` / browser flags.

Test hooks: in test builds `window.__MWG__` exposes `getSceneObjects()` (id, screen rect, state), `getActivitySnapshot()`, `getMicState()`, `getAudioLog()` (clip ids played), and `setClock()`. Not present in production builds (checked by a build test).

## 2. Global MVP gates (measurable)

| # | Gate | Pass criterion | Evidence |
|---|------|----------------|----------|
| G1 | Play without reading | In the child-usability protocol, ≥ 4 of 5 supervised children aged 3.5–5 enter a world and complete ≥ 1 level with no reading help (adult help limited to "you can tap"), or the plan documents the fixes and re-tests | Session notes |
| G2 | 12 playable levels, 6 mechanics | E2E plays each level to the result screen using real interactions (no debug skip); mechanic coverage table (04 §5) satisfied | T-LVL-01..12 |
| G3 | Open exploration | Fresh profile: each of 12 level intros reachable and startable; no element has disabled state tied to progress | T-NAV-03 |
| G4 | Languages | For each mode, AF-01/CT-01/NI-01: direction, captions and played clip ids match the mode | T-I18N-01..03 |
| G5 | Real mic | Chromium + Firefox fake stream records non-empty blob; Android device manual; denial/unsupported paths complete | T-MIC-* |
| G6 | Offline audio | After install, offline playthrough of all 12 levels plays all expected clip ids (audio log) with zero `audio.unavailable` events; with TTS proxy blocked, no level blocks | T-OFF-01..02 |
| G7 | Orientation | Every screen at 360×780, 390×844, 768×1024, 780×360, 844×390, 1024×768, 1440×900: no critical control outside safe viewport; mid-activity rotation preserves snapshot | T-ORI-* |
| G8 | Input integrity | Touch + mouse E2E per mechanic; count-twice, double-reward tests | T-MECH-*, T-REW-* |
| G9 | Persistence | Refresh/relaunch keeps profile, avatar, completions, stickers; migration test v0→v1 (and each later version) | T-PER-* |
| G10 | Parent and privacy | Delete/export/consent tests; no audio in IDB/Cache Storage after play | T-PAR-*, T-PRIV-* |
| G11 | Test coverage of areas | Content, evaluation, lifecycle, persistence, voice states, rotation, navigation, fallbacks each have tests; line coverage ≥ 80% for `game/core`, `game/activities/*/controller`, `features/learning`, `services/storage` | CI report |
| G12 | Devices | Manual checklists pass on ≥ 1 Android phone (Chrome) and desktop Chromium/Firefox/WebKit; iOS Safari pass recorded before any cross-platform claim | Signed checklists |
| G13 | Clean run | Zero console errors/warnings (allowlist for known browser noise) during E2E; zero missing critical assets; every screen has a working exit; text audit finds no "score", "correct pronunciation", "AI evaluated" in speech copy | E2E console listener, link crawler, copy lint |
| G14 | Accessibility | axe: 0 serious/critical on parent screens; parent flows keyboard-only E2E; child targets ≥ 64 px (layout solver assertion); reduced motion and mute verified | T-A11Y-* |
| G15 | Performance | Measured values recorded against 07 §10 on the reference device; any miss has an accepted, written exception | Perf report |

## 3. Automated test inventory (by area)

- **Content (T-CON):** every JSON validates; missing audio/image fails; `how_many` target mismatch fails; duplicate activity id fails; release build rejects unreviewed audio.
- **Evaluation (T-EVAL):** table-driven tests per mechanic; `firstTry`/hint level recorded correctly.
- **Lifecycle (T-LIFE):** state chart transitions; input ignored outside allowed states; `completed` emitted once; pause/resume; stale callback dropped (fake async with old runId); dispose during loading/recording.
- **Persistence (T-PER):** idempotent completion/sticker; quota error path; memory fallback; migrations; snapshot resume; content version mismatch discards snapshot only.
- **Voice (T-MIC, T-SPEECH):** every mic transition including timeout, cancel, unmount; MIME selection; VAD voiced/silent; feedback mapping; no "correct" wording.
- **Audio (T-AUD):** unlock flow; one-voice policy; ducking; missing clip resolves handle; sequence cancel.
- **Rotation (T-ORI):** layout solver min target size; Playwright `setViewportSize` swap mid-activity; drag cancelled on rotation.
- **Navigation (T-NAV):** every route reachable; back behaviours; no dead ends (crawler that clicks every child control from every screen); no external links in child routes.
- **Fallbacks (T-FALL):** offline first-load, missing asset, autoplay blocked (no `unlock()`), WebGL context loss (forced via `WEBGL_lose_context`), storage unavailable.

## 4. Given/When/Then catalog

Screen checks are in 03 (3+ per screen), mechanics in 04 §4, speech in 06 §10, levels' QA scripts in 05a. Each is mapped to a test ID; the mapping table lives in `tests/README.md` (created in P1) and in 13.

Example E2E (rotation, AF-01):

```
Given a fresh profile in portrait 390×844 at AF-01 activity 1
When the child taps the bush (cat revealed)
And the viewport changes to 844×390
Then __MWG__.getActivitySnapshot().found equals ["cat"]
And every object rect from getSceneObjects() lies inside the safe viewport
And the instruction clip is not replayed (audio log unchanged)
When the child taps the tree
Then the activity completes and activity 2 starts
```

## 5. Device / browser / orientation matrix

| Platform | Browser | Portrait | Landscape | Offline | Mic granted | Mic denied | Install (PWA) | Status |
|----------|---------|----------|-----------|---------|-------------|------------|---------------|--------|
| Android phone (reference, mid-range) | Chrome | Manual + E2E emulation | Manual + E2E | Manual | Manual (real voice) | Manual | Manual | Required |
| Android tablet | Chrome | Manual | Manual | Spot | Spot | Spot | Spot | Desired |
| iPhone (iOS 17+) | Safari | Manual | Manual | Manual | Manual | Manual | Add to Home Screen | **Required before cross-platform claim** |
| iPad | Safari | Manual | Manual | Spot | Spot | Spot | Spot | Desired |
| Desktop | Chromium (Playwright) | E2E | E2E | E2E | E2E (fake) | E2E | E2E check of manifest | Required |
| Desktop | Firefox (Playwright) | E2E | E2E | E2E | E2E (fake) | E2E | n/a | Required |
| Desktop | WebKit (Playwright) | E2E | E2E | E2E | not automatable reliably | E2E | n/a | Required (not a substitute for iOS) |
| Desktop | Edge / Safari macOS | Spot | Spot | Spot | Spot | Spot | Spot | Desired |

Viewports for E2E: 360×780, 390×844, 412×915, 768×1024, 1024×1366 and their rotations, plus 1440×900.

## 6. Child-safety checks (automated)

- Lint rule: no `<a href="http…">` or `window.open` under `app/(child)` and `features/*/child`.
- E2E crawler records all requests during a full playthrough: only same-origin (plus TTS proxy origin when enabled) allowed.
- Copy lint: child-facing strings and clip transcripts contain none of: "wrong", "fail", "غلط", "خطأ", "lose", streak or purchase words.

## 7. Failure-mode matrix

| Failure | Expected behaviour | Test |
|---------|-------------------|------|
| Loading error | Retry card; retries failed items | T-FALL-01 |
| No internet (never cached) | Splash explains + retry | T-FALL-02 |
| No internet (cached) | Fully playable; offline badge | T-OFF-01 |
| Missing asset | Placeholder; activity completable | T-FALL-03 |
| Autoplay blocked | Ear button pulses; tap unlocks | T-AUD-02 |
| Mic denied | Prompt-only mode; skip | T-MIC-04 |
| No recording MIME | `unsupported` → prompt-only | T-MIC-05 |
| TTS unavailable | Bundled fallback | T-AUD-06 |
| Speech not recognized | Same encouraging feedback as voiced | T-SPEECH-03 |
| Rapid repeated taps | One action per target | T-MECH-02 |
| App backgrounded | Pause menu on return; audio suspended | T-LIFE-07 |
| Refresh mid-level | Resume offer | T-PER-05 |
| Route exit mid-recording | Tracks stopped, blob revoked | T-MIC-08 |
| Rotation mid-activity | State kept; drag cancelled | T-ORI-03 |
| Interrupted drag (`pointercancel`) | Snapback | T-MECH-11 |
| Storage quota exceeded | Prune → memory fallback + banner | T-PER-07 |
| Incomplete cached assets | Badge shows % not "ready"; level intro shows not-downloaded state | T-OFF-03 |

## 8. Manual child-usability protocol (supervised)

- **Who:** children of consenting parents/guardians, aged 3.5–5, with the parent present throughout. No recordings of the child (video/audio) are made for the study; the observer takes written notes only. No data leaves the device; the device's data is deleted after the session.
- **Setup:** reference phone, full brightness, volume ≈ 60%, language the child speaks at home.
- **Tasks (≤ 15 min total, stop if the child loses interest):**
  1. From the map, "go wherever you like" (observe: does the child find a tappable world?).
  2. Play one level to the sticker.
  3. In a speaking activity, see whether the child understands the mic button (parent enables mic beforehand).
  4. Find the sticker in the book (prompted by the adult: "where did your sticker go?").
- **Observe and record (tally sheet):** taps on non-interactive areas; times the child looks to the adult for help; whether help came from Nono's hints; any distress; any confusion at the result screen; rotation if the child rotates naturally.
- **Pass signal:** see G1. Every observed blocker becomes an issue with a fix before P4 ends.
- **Ethics:** the child can stop at any time; no rewards outside the game are tied to performance.
