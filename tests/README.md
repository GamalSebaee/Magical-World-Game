# Tests

- Unit and component tests live next to the code (`src/**/*.test.ts(x)`); run `pnpm test`.
- E2E specs live in `tests/e2e/`; run `pnpm test:e2e`. They build the static export with test hooks
  (`NEXT_PUBLIC_TEST_HOOKS=1`) and read state through `window.__MWG__` (`src/game/core/testHooks.ts`).

## Acceptance checks → tests (Phases 1–2)

| Check (planning doc) | Test |
|----------------------|------|
| C1-1 boot reaches Play | `e2e/shell.spec.ts` › boots to a Play button |
| C1-3 offline-ready only when cached; G6 level plays offline | `e2e/offline.spec.ts` |
| G4 language direction (shell) | `e2e/shell.spec.ts` › first run goes to grown-up setup… |
| G7 rotation keeps state (map, activity) | `e2e/phaser.spec.ts`, `e2e/slice.spec.ts` › rotating mid-activity |
| G13 no console errors, no dead ends | `guardPage()` in every E2E spec; `shell.spec.ts` › unknown URLs lead home |
| G14 axe on parent/child screens | `e2e/shell.spec.ts` › no serious accessibility violations |
| 09 §6 no foreign requests | `guardPage()` |
| T-REW idempotent stickers / completions | `src/services/storage/storage.test.ts` |
| T-PER migrations, fallbacks | `src/services/storage/storage.test.ts` |
| T-PRIV delete one child, export | `src/services/storage/storage.test.ts` |
| T-CON content validation | `src/services/content/content.test.ts` |
| T-ORI layout at 12 viewport sizes | `src/game/core/viewport.test.ts` |
| Phaser lifecycle 20× mount/unmount | `e2e/phaser.spec.ts` › 20 route round-trips |
| C5-2 drag does not enter a world | `e2e/phaser.spec.ts` › a drag starting on a world |
| C10-1/2 sticker once, refresh grants nothing | `e2e/slice.spec.ts` › full playthrough |
| C10-3 skipped activities, same celebration | `e2e/slice.spec.ts` › full playthrough (replay by skipping) |
| C7-2 resume after refresh | `e2e/slice.spec.ts` › refreshing mid-level |
| C8-2, C12 background/back pause | `e2e/slice.spec.ts` › backgrounding pauses |
| C13-1 hints to demo hand | `e2e/slice.spec.ts` › help steps through hint levels |
| G4 en / mixed audio | `e2e/slice.spec.ts` › English mode, mixed mode |
| G14 child targets ≥ 64 px, on screen | `e2e/slice.spec.ts` › every child screen… |
| P1 parent gate | `e2e/shell.spec.ts` › the parent gate… |
| C9, G5, 06 §10 microphone | `e2e/mic-voice`, `mic-silence`, `mic-denied`, `mic-off` specs; `src/services/mic/mic.test.ts` |
| T-LIFE controller lifecycle | `src/game/core/engine/engine.test.ts` |
| T-AUD playback policy | `src/services/audio/audio.test.ts` |
