# 11 — Proposed Repository Structure

```
magical-world-game/
├─ .github/workflows/ci.yml           lint, typecheck, content:validate, unit, e2e (chromium/firefox/webkit), build size report
├─ docs/
│  ├─ planning/                       this pack
│  ├─ adr/                            architecture decision records (from D1–D12 onward)
│  └─ deployment.md                   (P7)
├─ licenses/                          archived third-party licence texts for assets
├─ scripts/
│  ├─ content/validate.ts             Zod + cross-ref + file existence + review-status checks
│  ├─ content/gen-json-schema.ts      z.toJSONSchema → src/content/schema/*.schema.json
│  ├─ audio/check.ts                  loudness, true peak, duration, missing files
│  ├─ assets/pack-atlases.ts          free-tex-packer-core → public/assets/atlases
│  ├─ assets/size-report.ts           per-pack and total precache sizes vs budget
│  └─ sw/build.ts                     serwist injectManifest over out/
├─ public/
│  ├─ manifest.webmanifest            name, icons, display: standalone, orientation: any
│  ├─ icons/
│  └─ assets/
│     ├─ atlases/                     common-*.png/json, animal-forest-*.png/json, …
│     ├─ images/                      backgrounds (webp), stickers
│     └─ audio/{ar,en,common}/        <clipId>.mp3
├─ src/
│  ├─ app/                            Next.js App Router (routing and layout only; thin pages)
│  │  ├─ layout.tsx                   <html lang dir>, providers (AppServices, i18n), safe-area CSS vars
│  │  ├─ error.tsx                    root error boundary
│  │  ├─ (child)/
│  │  │  ├─ page.tsx                  C1 splash
│  │  │  ├─ profiles/…                C2, C2a
│  │  │  ├─ avatar/page.tsx           C3
│  │  │  ├─ welcome/page.tsx          C4
│  │  │  ├─ map/page.tsx              C5
│  │  │  ├─ world/[worldId]/page.tsx  C6
│  │  │  ├─ level/[levelId]/{page,play/page,result/page}.tsx   C7, C8–C9, C10
│  │  │  └─ stickers/page.tsx         C11
│  │  ├─ parent/…                     P1–P9 (+ ParentGuard layout)
│  │  └─ dev/playground/page.tsx      P3, excluded from prod by flag
│  ├─ features/                       product features; UI + use-cases; talk via event bus/public index.ts
│  │  ├─ profiles/                    profile list/create/edit, active profile
│  │  ├─ avatar/                      AvatarConfig, layered composer (React preview + Phaser container)
│  │  ├─ levels/                      LevelRunner, level intro/result view-models, resume
│  │  ├─ learning/                    evidence rules v1, skill state derivation
│  │  ├─ progress/                    subscribers persisting attempts/evidence/completions
│  │  ├─ rewards/                     sticker grants (idempotent), sticker book
│  │  ├─ speech/                      SpeechPanel overlay, SpeechFeedbackService
│  │  ├─ parental/                    gate, PIN hash, dashboard, settings screens, export/delete
│  │  └─ session/                     play-time tracking, break reminders
│  ├─ game/
│  │  ├─ core/                        framework-free engine + Phaser integration
│  │  │  ├─ phaserHost.ts             singleton Game, attach/detach, resize, safe area
│  │  │  ├─ GameHost.tsx              client-only React wrapper (dynamic import, ssr:false)
│  │  │  ├─ registry.ts               ActivityRegistry
│  │  │  ├─ lifecycle.machine.ts      base activity state chart (XState)
│  │  │  ├─ hintPolicy.ts, feedbackDirector.ts, layoutSolver.ts, contentResolver.ts
│  │  │  ├─ scenes/MapScene.ts, ActivityScene.ts, BootScene.ts
│  │  │  └─ testHooks.ts              window.__MWG__ (test builds only)
│  │  └─ activities/
│  │     ├─ tap-discover/{definition.ts, machine.ts, evaluate.ts, scene.ts, layouts.ts, *.test.ts}
│  │     ├─ listen-choose/…
│  │     ├─ drag-drop/…
│  │     ├─ match-pairs/…
│  │     ├─ count-objects/…
│  │     └─ speak-repeat/…
│  ├─ services/                       browser-API implementations behind interfaces
│  │  ├─ audio/{AudioPlaybackService.ts, WebAudioPlayback.ts, audio.machine.ts, AudioAssetResolver.ts}
│  │  ├─ tts/{TtsProvider.ts, NullTtsProvider.ts, ProxyTtsProvider.ts}
│  │  ├─ mic/{MicrophoneRecorder.ts, MediaRecorderMic.ts, mic.machine.ts, vad.ts, mime.ts}
│  │  ├─ speech/{SpeechRecognitionProvider.ts, NullSpeechRecognition.ts, WebSpeechRecognition.ts}
│  │  ├─ storage/{db.ts, migrations/, repositories/, MemoryStorage.ts, export.ts}
│  │  ├─ content/{ContentRepository.ts, loader.ts}
│  │  └─ assets/{ImageAssetResolver.ts, packs.ts}
│  ├─ shared/                         no project imports
│  │  ├─ ids.ts (branded types), events.ts (AppEvent), result.ts, logger.ts, flags.ts, clock.ts
│  │  ├─ i18n/{direction.ts, Bdi.tsx, digits.ts, uiStrings.ar.ts, uiStrings.en.ts}
│  │  └─ ui/                          design tokens, BigButton, EarButton, Overlay, focus utils
│  ├─ content/                        validated JSON (the only place content lives)
│  │  ├─ schema/                      Zod schemas (.ts) + generated JSON Schema
│  │  ├─ index.json, skills.json, vocabulary.json
│  │  ├─ worlds/*.world.json
│  │  ├─ levels/*.level.json
│  │  ├─ audio-manifest.json
│  │  └─ assets-manifest.json
│  └─ sw/sw.ts                        service worker source (precache, runtime cache for TTS, update policy)
├─ services-server/tts-proxy/         OPTIONAL (P5): serverless TTS proxy; not part of the static export
├─ tests/
│  ├─ e2e/                            Playwright specs (journeys, rotation, offline, mic, a11y)
│  ├─ fixtures/audio/                 voice.wav, silence.wav for fake mic
│  ├─ fakes/                          FakeAudio, FakeMic, FakeClock, in-memory storage
│  └─ README.md                       GWT → test id mapping
├─ eslint.config.mjs                  incl. import boundaries (02 §3) and child-safety rules
├─ next.config.ts                     output: 'export', images.unoptimized, headers documented for host
├─ playwright.config.ts               projects: chromium/firefox/webkit × portrait/landscape
├─ vitest.config.ts
├─ tsconfig.json                      strict, noUncheckedIndexedAccess, path aliases (@app, @features, @game, @services, @shared, @content)
├─ package.json, pnpm-lock.yaml       pnpm (available in environment)
├─ LICENSE                            (12 Q6)
└─ README.md
```

## Responsibilities and rules

| Folder | Owns | May import |
|--------|------|-----------|
| `src/app` | Routes, layout, error boundaries, wiring | everything |
| `src/features/*` | Feature UI and use-cases | `game`, `services` (interfaces), `shared`; another feature only via its `index.ts` |
| `src/game/core` | Engine, registry, lifecycle, Phaser host | `services` (interfaces), `shared`. No React except `GameHost.tsx` |
| `src/game/activities/*` | One mechanic each | `game/core`, `shared`. Only `scene.ts` imports Phaser |
| `src/services/*` | Browser APIs, storage, content loading | `shared`, `src/content` (content service only) |
| `src/shared` | Types, primitives, UI atoms | nothing in project |
| `src/content` | Data | — |
| `public/assets` | Static binaries referenced by manifests | — |
| `tests` | Cross-cutting tests, fakes, fixtures; unit tests also live beside code | anything |
