# 01 — Repository Audit

Audit date: 2026-10-19. Method: read-only inspection of the working tree, git metadata and the npm registry.

## 1. Findings

| Item | Observed |
|------|----------|
| Remote | `https://github.com/GamalSebaee/Magical-World-Game` |
| Branch | `claude/new-session-0skzcy` (local, no commits yet) |
| Commit history | None. `git log` reports the branch has no commits |
| Remote refs | `git ls-remote origin` returned no refs: the remote repository is empty |
| Files | None (apart from `.git`) |
| Existing code, configs, CI, licence, README | None |
| Toolchain in the environment | Node 22.22.0, npm 10.9.4, pnpm 10.28.0 |

There is no existing code to audit and no existing constraint from prior work. This planning pack will be the first commit.

## 2. Package version check (npm registry, 2026-10-19)

Checked so the plan names versions that exist, not remembered ones. Exact pins are chosen in Phase 1 and recorded in the lockfile.

| Package | Latest | Planned choice | Notes |
|---------|--------|----------------|-------|
| next | 16.4.2 | 16.4.x | App Router, static export |
| react / react-dom | 19.3.1 | 19.x as required by Next 16 | |
| phaser | 4.2.1 (3.x line ends at 3.90.0, May 2025) | **3.90.0** default; Phaser 4 spike in P1 | Brief says Phaser 3; see 12 Q1 |
| typescript | 7.0.2 (native compiler, July 2026); 5.9.3 last 5.x | 5.9.3 default; evaluate 7.x in P1 | TS 7 is a new compiler; ESLint/Next type-check compatibility to be verified before adopting |
| zustand | 5.0.15 | 5.x | Cross-screen UI state only |
| zod | 4.6.7 | 4.x | `z.toJSONSchema` used to generate JSON Schema for editors |
| xstate | 5.33.3 | 5.x | Activity, audio and microphone state machines |
| idb | 8.0.4 | 8.x | Thin promise wrapper over IndexedDB |
| tailwindcss | 4.3.3 | 4.x | Uses logical properties for RTL |
| serwist / @serwist/cli | 9.5.13 | 9.x, `injectManifest` over the static export | Bundler-agnostic route avoids Turbopack/webpack plugin coupling; verify in P1 |
| vitest | 5.0.5 | 5.x | Unit and component tests |
| @playwright/test | 1.64.1 | **1.56.1** (implemented in P1) | Pinned to match the Chromium build preinstalled in this environment; CI may move up |
| @testing-library/react | 16.3.3 | 16.x | |
| fake-indexeddb | 6.2.6 | 6.x | IndexedDB in unit tests |
| @axe-core/playwright | 4.14.0 | 4.x | Accessibility checks in E2E |
| eslint | 10.13.0 | 10.x | Including boundary rules (02 §3) |
| howler | 2.2.4 (last release Sept 2023) | **Not used** | Inactive; a small Web Audio service is planned instead (06 §3) |

## 3. Constraints identified

1. **Empty repository.** Everything, including licence, README, CI and contribution conventions, needs creating. Recommend adding a licence choice to Phase 1 (12 Q6).
2. **HTTPS is mandatory** for `getUserMedia`, service workers and installability. Local development uses `localhost` (a secure context). Testing on a phone over LAN needs an HTTPS tunnel or a self-signed certificate.
3. **No server for MVP.** Any feature that needs secrets (TTS, external STT) must be optional and off by default, because a static export has no server routes.
4. **Content needs native review.** Arabic scripts and audio cannot be signed off by the engineer or the AI agent alone.
5. **Assets do not exist yet.** The vertical slice needs Nono, the avatar layers, the Animal Forest background, cat and dog sprites and about 40 voice clips (07 §9). Until then, labelled placeholders are used.
6. **Environment limits.** The cloud environment has Chromium for Playwright. A real Android phone and an iOS device are needed for the manual gates (09 §5); these cannot be simulated here.
7. **Phaser version.** The brief's "Phaser 3" now refers to a final line (3.90). It is stable and fit for purpose; Phaser 4 is the actively developed line. Decision needed (12 Q1).
