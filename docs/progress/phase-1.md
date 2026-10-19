# Phase 1 — Foundation: report

Date: 2026-10-19. Plan reference: [10-milestones-and-risks §P1](../planning/10-milestones-and-risks.md).

## 1. What was built

| Objective (from the plan) | Status | Where |
|---------------------------|--------|-------|
| Next.js + TypeScript + Tailwind scaffold, static export | Done | `next.config.ts`, `src/app/` |
| Lint, boundary rules, child-safety lint | Done; each rule checked with deliberate violations | `eslint.config.mjs` |
| Vitest + Playwright + axe, CI workflow | Done | `vitest.config.ts`, `playwright.config.ts`, `.github/workflows/ci.yml` |
| Design tokens | Done (palette, target sizes, safe-area variables, reduced motion) | `src/app/globals.css` |
| Bilingual shell: RTL/LTR switching, `<bdi>` helper, digit styles, captions | Done | `src/shared/i18n/`, `AppProvider.tsx` |
| `AppServices` dependency injection and typed event bus | Done (audio, mic, speech services arrive in Phase 2) | `src/app/_providers/appServices.ts`, `src/shared/events.ts` |
| Zod content schemas + `content:validate` | Done: all six mechanics, level, world, skills, vocabulary, audio and asset manifests, cross-reference checks | `src/content/schema/`, `src/services/content/` |
| IndexedDB repositories, migration framework, memory fallback | Done: all 14 stores from doc 08, idempotent stickers and completions, export, delete one child or everything | `src/services/storage/` |
| Phaser host: client-only, singleton, resize, safe area | Done | `src/game/core/phaserHost.ts`, `GameHost.tsx` |
| Serwist `injectManifest` with offline-ready reporting | Done | `src/sw/sw.ts`, `scripts/sw/build.ts`, `src/services/offline/` |
| Phaser 3 vs 4 spike | Done (see §5) | — |
| Performance baseline on the reference device | **Not done.** Needs a real Android phone. Build-size numbers are in §4 | — |

Screens in this phase: the splash (C1, functional) and a placeholder `/map` that hosts a Phaser scene with three placeholder targets. The scene is labelled "PLACEHOLDER" and is replaced by the real world map in Phase 2. Nono is a simple SVG placeholder, marked as such.

## 2. Tests

| Suite | Result |
|-------|--------|
| Unit + component (Vitest) | **71 passed**: storage contract run against both IndexedDB (fake-indexeddb) and memory backends, migrations, newer-DB refusal, fallbacks, content schema rules, cross-reference validation, viewport layout at 12 sizes, event bus, i18n, debounce, flags |
| E2E (Playwright, Chromium: phone portrait, phone landscape, desktop) | **27 passed**: boot, RTL default, language switch persisting across reload, axe (no serious or critical issues), large Play target, 404 leads home, canvas mount, rotation keeps scene state, 20 route round-trips reuse one game with no leaked canvas, offline-ready only after caching, full offline reload and deep link, no console errors, no foreign requests |
| E2E Firefox / WebKit | **Not run here.** Only Chromium is installed in this environment; CI is configured to run them |
| Lint, typecheck, content validation, production build | Pass |

Bugs the tests caught and that are now fixed:
1. On phones (device pixel ratio > 1) taps on the canvas missed their targets, because Phaser's `Scale.NONE` mode never updates `displayScale`. Fixed in `phaserHost.measure()`; tested at pixel ratios 1 and 2.625, with touch and mouse.
2. Scenes started after the first resize laid out with the wrong scale. Fixed by sharing the viewport through the game registry.
3. The canvas kept a 1×1 CSS size in `Scale.NONE`. Fixed by sizing it explicitly.
4. ESLint flat-config overrides silently disabled the import-boundary rules. Restructured and verified with deliberate violations.

## 3. Phase 1 gate (from the plan)

| Gate | Result |
|------|--------|
| CI green | Local equivalents all pass. CI has not run yet: **the push to GitHub is blocked** (403, no app access) |
| Empty Phaser scene mounts/unmounts 20× with no leaked canvases or listeners | Pass: one game instance, one canvas, attach/detach balanced, game sleeps when detached |
| App shell works offline after first load | Pass in Chromium: reload and an unvisited deep link both work offline |
| Baseline performance numbers recorded | Partial: build sizes only (§4). Device measurements still needed |

## 4. Measured (build output, not device)

| Budget (07 §10, provisional) | Measured | Verdict |
|------------------------------|----------|---------|
| App shell JS ≤ 200 KB gzip | **223 KB** gzip initial JS on `/` | Over by 23 KB. Likely Zod plus the content bundle at boot. Options: `zod/mini`, or lazy-validating content. Revisit in Phase 2 |
| Phaser chunk (measure) | 315 KB gzip (3.90), loaded only when a canvas is first shown | As expected |
| Total precache | 2.0 MB, 40 files (no art or audio yet) | Fine |

## 5. Phaser 3 vs 4 spike (open question Q1)

Phaser 4.2.1 was installed in an isolated copy. The host and scene code typechecked unchanged, and all Phaser E2E tests passed (mount, rotation, 20 round-trips) on phone and desktop Chromium. The gzipped chunk grows from 315 KB to 354 KB (+12%).

Recommendation: either works for our architecture. I've kept **3.90** (the plan's default). Switching to 4.x now is cheap and gives an actively maintained line; switching later costs more as scene code grows. **Decision needed from you before Phase 2 scene work.**

## 6. Deviations from the plan

- `@playwright/test` is pinned to **1.56.1** to match the browsers preinstalled in this environment (the plan named 1.64). CI can move up.
- The event bus lives in `src/shared/events.ts` (the plan placed it in `game/core`), because services also emit events and may not import `game/`.
- The Phaser host uses `Scale.NONE` with manual device-pixel-ratio sizing (capped at 2), not `Scale.RESIZE`, because one canvas moves between route containers.
- Hints are an array of 1–3 rather than a tuple; same rule, simpler errors.
- `AGENTS.md` is generated by `next dev` (Next.js 16) and is committed so the tree stays clean.

## 7. Known limitations

- No gameplay, audio, microphone, profiles or parent area yet (Phases 2–6).
- The language switch is temporarily on the splash; it moves to the parent area (P5 screen).
- The offline badge shows "saving…" during install without a percentage (precaching is atomic, so it is honest but coarse).
- No real-device testing yet (Android or iOS).

## 8. How to demo

```
pnpm install
pnpm build && pnpm start        # http://localhost:3000
```
1. The splash shows a progress bar, then a large Play button. Switch العربية / English / Mixed and see the layout direction change; reload and it is kept.
2. Wait for "Ready offline", then turn the network off (DevTools → Network → Offline) and reload: it still works.
3. Press Play: a canvas with three placeholder targets. Tap one, then rotate the device or emulator: the tapped state is kept and the targets re-arrange.
4. Home and Play repeatedly: still one canvas (see `window.__MWG__.phaser()` in a test-hooks build: `NEXT_PUBLIC_TEST_HOOKS=1 pnpm build`).

## 9. Next approval point

Phase 2 (vertical slice AF-01) needs:
1. Your Phaser decision (§5).
2. The blocking answers in [12-open-questions](../planning/12-open-questions.md) that affect the slice: Q3 voice source, Q4 Arabic pronunciation, Q5 Arabic reviewer, Q8 test phone. Without them I'll use the recommended defaults and **labelled placeholder** audio and art.
3. GitHub push access, so the work and CI are on the remote.
