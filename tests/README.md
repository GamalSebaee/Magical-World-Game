# Tests

- Unit and component tests live next to the code (`src/**/*.test.ts(x)`); run `pnpm test`.
- E2E specs live in `tests/e2e/`; run `pnpm test:e2e`. They build the static export with test hooks
  (`NEXT_PUBLIC_TEST_HOOKS=1`) and read state through `window.__MWG__` (`src/game/core/testHooks.ts`).

## Acceptance checks → tests (Phase 1 scope)

| Check (planning doc) | Test |
|----------------------|------|
| C1-1 boot reaches Play | `e2e/shell.spec.ts` › boots to a Play button |
| C1-3 offline-ready only when cached | `e2e/offline.spec.ts` |
| G4 language direction (shell) | `e2e/shell.spec.ts` › switching language… |
| G7 rotation keeps state (scene) | `e2e/phaser.spec.ts` › rotation keeps scene state |
| G13 no console errors, no dead ends | `guardPage()` in every E2E spec; `shell.spec.ts` › unknown URLs lead home |
| G14 axe on parent/child screens | `e2e/shell.spec.ts` › no serious accessibility violations |
| 09 §6 no foreign requests | `guardPage()` |
| T-REW idempotent stickers / completions | `src/services/storage/storage.test.ts` |
| T-PER migrations, fallbacks | `src/services/storage/storage.test.ts` |
| T-PRIV delete one child, export | `src/services/storage/storage.test.ts` |
| T-CON content validation | `src/services/content/content.test.ts` |
| T-ORI layout at 12 viewport sizes | `src/game/core/viewport.test.ts` |
| Phaser lifecycle 20× mount/unmount | `e2e/phaser.spec.ts` › 20 route round-trips |
