# 10 — Milestones, Risks and Decision Log

Effort ranges assume one developer working with an AI coding agent (A1), in focused working days, and exclude waiting time for art, voice recording and native review, which run as parallel tracks. Each phase ends at an approval point; nothing is called complete until its features run and its tests pass.

## 1. Phases

### P0 — Planning (this pack)
- **Objective:** approved plan. **Files:** `docs/planning/**`. **Gate:** explicit approval. **Status:** awaiting approval.

### P1 — Foundation (4–7 days) — implemented, see [phase-1 report](../progress/phase-1.md)
- **Objectives:** Next.js + TS + Tailwind scaffold with static export; lint/format/boundary rules; Vitest + Playwright + axe in CI; design tokens; bilingual app shell (RTL/LTR switch, `<bdi>` helpers); `AppServices` DI; event bus; Zod content schemas + `content:validate`; IndexedDB repositories + migration framework + memory fallback; Phaser host (client-only, singleton, resize/safe-area); Serwist `injectManifest` skeleton with offline-ready reporting; Phaser 3 vs 4 spike (half day); performance baseline on the reference device.
- **Files:** root configs, `src/app/layout.tsx`, `src/shared/**`, `src/services/{storage,content}/**`, `src/game/core/phaserHost.ts`, `src/content/schema/**`, `scripts/content/**`, `tests/**`, `.github/workflows/ci.yml`.
- **Dependencies:** answers to 12 Q1, Q2, Q5, Q6.
- **Risks:** Next 16 static export + Serwist integration; TS 7 tooling compatibility (mitigate: TS 5.9).
- **Tests:** schema tests, repository + migration tests, Phaser host mount/unmount, RTL shell component tests, one E2E smoke per orientation.
- **Gate:** CI green; empty Phaser scene mounts/unmounts 20× without leaked canvases or listeners; app shell works offline after first load; baseline perf numbers recorded in 07 §10.
- **Demo:** `pnpm dev`, switch language, rotate in device emulation, go offline and reload.
- **Known limitations:** no gameplay yet.

### P2 — Vertical slice AF-01 (8–12 days + asset/voice track)
- **Objectives:** splash → (first-run parent setup minimal) → profile → avatar (minimum options) → welcome → map → Animal Forest overview → AF-01 intro → 3 activities (`tap_discover`, `listen_choose`, `speak_repeat`) → result with sticker → sticker book (minimal). Real audio playback service, real mic recorder with VAD, permission/denied/unsupported paths, pause/help overlays, resume after refresh, persistence, both orientations, offline after cache.
- **Vertical-slice definition of done:** every item above works with real interactions on a real Android phone and desktop browsers; ar/en/mixed audio for AF-01 exists (placeholder-labelled if not yet approved, disclosed in demo notes); slice-scoped G3–G10, G13, G14 checks pass; child-usability pilot with 1–2 children done.
- **Files:** `src/app/(child)/**` for the slice screens, `src/features/{profiles,avatar,progress,rewards,speech}/**`, `src/game/activities/{tap-discover,listen-choose,speak-repeat}/**`, `src/services/{audio,mic,speech}/**`, `src/content/levels/af-01.level.json`, `public/assets/audio/**`, `public/assets/atlases/**`.
- **Risks:** iOS audio/mic interplay; art not ready (use labelled placeholders).
- **Gate:** **review and approval before P3.**

### P3 — Activity engine complete (6–10 days)
- **Objectives:** remaining mechanics (`drag_drop`, `match_pairs`, `count_objects`), shared hint policy, layout presets, `/dev/playground`, full unit coverage of evaluators and lifecycle.
- **Gate:** each mechanic passes its 04 §4 acceptance checks in the playground in P and L, touch and mouse.

### P4 — 3 worlds / 12 levels (10–18 days + content/voice/art track)
- **Objectives:** all level JSON, audio manifests, assets per world; world overviews; map with three real destinations; reviewed scripts.
- **Gate:** G2, G3, G4 for all levels; full child-usability session (5 children).

### P5 — Audio resilience, TTS (optional), accessibility (4–8 days)
- **Objectives:** resolver chain hardening, cache metadata, TTS proxy only if provider/keys supplied (else document as not enabled), speech recognition adapter behind consent (if a provider is chosen), reduced-motion/mute/visual alternatives audit.
- **Gate:** G6, G14; TTS/STT off-paths proven; if enabled, network audit matches consent.

### P6 — Profiles, sticker book, parent area (6–10 days)
- **Objectives:** full avatar options, sticker book polish, parent gate with optional PIN, dashboard, progress, voice/consent, language, session reminders, privacy (export/delete), content controls.
- **Gate:** G9, G10, parent a11y.

### P7 — PWA reliability, performance, QA, deployment (6–10 days)
- **Objectives:** SW update safety, cache completeness reporting, performance work to budgets, cross-device matrix, deployment guide, release checklist.
- **Gate:** all 15 global gates; iOS verification recorded or the release notes state that iOS is unverified.

**Total:** roughly 44–75 working days of engineering, plus parallel production of ≈ 360 voice clips per language and the art set.

## 2. Dependencies (critical path)

```
P0 approval → P1 → P2 (needs: Nono + cat/dog art, AF-01 voice) → approval → P3 → P4 (needs: all art + ~720 clips + native review)
                                                                          ↘ P5, P6 can overlap late P4
                                                                                     → P7
```

## 3. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Voice production (≈ 720 clips + review) is slower than engineering | High | High | Start scripts in P1; record AF-01 first; batch by world; automate loudness checks; allow labelled TTS drafts in dev only |
| R2 | Consistent art across hybrid sources | High | High | Style bible; one lead artist or one restyle pass; vector re-trace of AI concepts; review status in manifest |
| R3 | iOS Safari audio/mic quirks (unlock, earpiece routing, `MediaRecorder` MIME `audio/mp4`) | High | Medium | Single `AudioContext`, close stream after each recording, device testing before claiming iOS support |
| R4 | Arabic child speech recognition unreliable | Certain | Low (by design) | Recognition optional and never gates; VAD-based honest feedback |
| R5 | WebGL context loss / memory on low-end phones | Medium | High | Singleton Phaser game, atlas page limits, texture unloading per world, Canvas fallback, budgets |
| R6 | Rotation bugs (cropping, lost drags) | Medium | Medium | Layout solver with assertions; controller-owned state; E2E rotation suite |
| R7 | Service worker update corrupts a session or serves mixed versions | Medium | High | Activate only when idle; versioned packs; content version check on level load |
| R8 | IndexedDB unavailable/evicted (private mode, storage pressure) | Medium | Medium | Memory fallback, `storage.persist()`, parent banner, export |
| R9 | Next.js 16 / Serwist / TS 7 compatibility churn | Medium | Medium | Pin versions; TS 5.9; `injectManifest` via CLI rather than a bundler plugin |
| R10 | Phaser 3 line is final (3.90) | Medium | Low–Medium | Thin adapter layer; P1 spike on Phaser 4; scene adapters isolate Phaser APIs |
| R11 | Children tap the parent gate open | Low | Medium | Hold + reading challenge + optional PIN; gate is labelled as a deterrent |
| R12 | Dialect choices displease parents | Medium | Medium | 12 Q4 decision; native reviewer; consistent policy |
| R13 | Scope creep (extra worlds, features) | Medium | High | Roadmap list; phase gates; traceability matrix |
| R14 | Performance budgets unrealistic | Medium | Medium | Measure baseline in P1 and revise before P2 |
| R15 | Licensing gaps in assets | Low | High | Manifest with licence per asset; release gate blocks unknown licences |

## 4. Decision log

| # | Decision | Rationale | Alternatives considered |
|---|----------|-----------|-------------------------|
| D1 | Next.js App Router with `output: 'export'` | Offline-first PWA needs no server; deploy anywhere; meets brief | Vite SPA (simpler, but brief specifies Next.js) |
| D2 | Phaser 3.90 default, spike Phaser 4 in P1 | Honours brief; stable; isolate via adapters | Phaser 4 now (active line, newer API) |
| D3 | One persistent `Phaser.Game` | Avoid WebGL context churn on iOS | Create/destroy per route |
| D4 | Gameplay truth in XState actors, not scenes or Zustand | Survives rotation; testable without rendering; avoids boolean soup | Hand-written reducers (lighter, less tooling) |
| D5 | Single Web Audio service; Phaser `noAudio` | One unlock, one context, shared by React and Phaser | Phaser sound manager; Howler (inactive since 2023) |
| D6 | MP3 for all audio | One universally decodable format → one file per clip in the precache | Opus + AAC dual (better quality/size, doubles management) |
| D7 | Recognition off by default; VAD-based feedback | Honest, private, works offline | Web Speech API on by default (privacy and accuracy problems) |
| D8 | Prompts in first-person plural Arabic | One clip serves every child regardless of gender | Gendered clip variants (doubles Arabic audio) |
| D9 | Parent gate = hold + reading challenge, optional PIN | Arithmetic alone is weak; deterrent, honestly labelled | Math question; mandatory PIN |
| D10 | Static content JSON bundled; no CMS | MVP scope; build-time validation | Headless CMS |
| D11 | Mastery wording "demonstrated through activities"; evidence rule v1 is versioned | Avoids overclaiming; adjustable | Percent scores |
| D12 | Serwist via `injectManifest` over `out/` (via `@serwist/build` in `scripts/sw/build.ts`) | Bundler-agnostic; avoids Turbopack plugin issues | `@serwist/next` plugin; hand-written SW |
| D13 | Phaser `Scale.NONE` with manual CSS sizing, device-pixel-ratio cap 2 and explicit `displayScale` (P1) | One canvas moves between route containers; crisp on phones; correct pointer mapping | `Scale.RESIZE` (bound to one parent) |
| D14 | Storage behind a small `StorageBackend` port with IndexedDB and memory implementations sharing one store table (P1) | Same contract tests for both; memory fallback cannot drift | Repositories written directly against `idb` |
