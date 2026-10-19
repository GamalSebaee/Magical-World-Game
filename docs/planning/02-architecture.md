# 02 — Architecture

## 1. C4 Level 1: System context

```
                ┌──────────────────────────┐
  Child ───────▶│                          │
  (touch, voice)│  Mariam's Magical World  │──── optional, parent opt-in ───▶ TTS provider (via proxy, roadmap/P5)
                │  PWA in the browser      │──── optional, parent opt-in ───▶ Speech recognition provider (roadmap)
  Parent ──────▶│  (all data on device)    │
  (gated area)  └────────────┬─────────────┘
                             │ HTTPS (first load + updates only)
                             ▼
                   Static host / CDN (HTML, JS, JSON content, sprites, audio)
```

MVP needs only the static host. The two optional providers are not contacted unless a parent turns them on and the build has them configured.

## 2. C4 Level 2: Containers

| Container | Tech | Responsibility |
|-----------|------|----------------|
| App shell | Next.js App Router (static export), React 19, Tailwind 4 | Routes, screens, overlays, parent area, i18n and RTL, error boundaries |
| Game runtime | Phaser 3.90 (client-only) | Map scene and activity scenes, sprite animation, input, layout on resize |
| Activity engine | TypeScript + XState 5, framework-free | Activity lifecycle, evaluation, hints, retry/skip, reward intents. Has no Phaser or React imports |
| Services | TypeScript | Audio playback, asset resolution, microphone, speech, storage repositories, content loading |
| Local database | IndexedDB (via `idb`) | Profiles, avatars, attempts, completions, skill evidence, stickers, settings, cache metadata, event queue |
| Service worker | Serwist `injectManifest` | Precache app shell, content and world asset packs; versioned updates |
| TTS proxy (optional, P5) | Serverless function, deployed separately | Holds provider keys, allowlist, rate limit, cost cap. Not part of the static export |

## 3. C4 Level 3: Components and dependency direction

```
app/ (routes, layouts)                       ← may import anything below
  └─ features/*  (profiles, avatar, learning, progress, rewards, speech, parental, settings)
        └─ game/activities/*   (one folder per mechanic: controller + scene adapter)
              └─ game/core      (engine, registry, event bus, Phaser host, layout solver)
                    └─ services/*  (audio, assets, content, storage, mic, speech, tts)
                          └─ shared/*  (types, ids, i18n primitives, result, logger, flags)
content/ (JSON, validated)  ← read only through services/content
```

Rules (enforced with `eslint-plugin-boundaries` or `import/no-restricted-paths` in Phase 1):

1. Imports point downward only. `shared` imports nothing from the project.
2. `game/core` and `game/activities/*/controller.ts` must not import React. Controllers must not import Phaser; only `*/scene.ts` adapters do.
3. `features/*` must not import each other's internals; they communicate through the typed event bus or exported public `index.ts`.
4. Browser APIs (`indexedDB`, `navigator.mediaDevices`, `AudioContext`, `speechSynthesis`, `localStorage`) are touched only inside `services/*` implementations. Everything else depends on interfaces.
5. `content/*.json` is imported only by `services/content`, which validates it.
6. No module under `app/(child)` may render an external link (`<a href="http…">`) or load third-party scripts. Lint rule + E2E check.

### 3.1 Dependency injection

A single `AppServices` object is built once at client start and provided through React context and passed into the Phaser host:

```ts
interface AppServices {
  audio: AudioPlaybackService;
  assets: AudioAssetResolver & ImageAssetResolver;
  content: ContentRepository;
  mic: MicrophoneRecorderFactory;
  speech: SpeechRecognitionProvider;     // NullSpeechRecognitionProvider by default
  speechFeedback: SpeechFeedbackService;
  tts: TtsProvider;                      // NullTtsProvider by default
  storage: StorageRepositories;          // profiles, progress, stickers, settings, events
  events: EventBus<AppEvent>;
  clock: Clock;                          // injectable for tests
  ids: IdGenerator;
  flags: FeatureFlags;
  logger: Logger;
}
```

Tests build `AppServices` with fakes (`FakeAudio`, `FakeMic`, in-memory storage, fixed clock). No module reaches for a global singleton.

### 3.2 Typed event bus

```ts
type AppEvent =
  | { type: 'activity.started'; profileId: ProfileId; levelId: LevelId; activityId: ActivityId; at: number }
  | { type: 'activity.interaction'; activityId: ActivityId; kind: InteractionKind; targetId?: string; at: number }
  | { type: 'activity.evaluated'; activityId: ActivityId; outcome: EvalOutcome; skillIds: SkillId[]; hintLevel: 0|1|2|3; at: number }
  | { type: 'activity.completed' | 'activity.skipped'; activityId: ActivityId; attemptId: AttemptId; at: number }
  | { type: 'level.completed'; profileId: ProfileId; levelId: LevelId; completionKey: string; at: number }
  | { type: 'reward.granted'; profileId: ProfileId; stickerId: StickerId; grantKey: string; at: number }
  | { type: 'speech.attempt'; activityId: ActivityId; result: SpeechAttemptResult; at: number }
  | { type: 'mic.state'; state: MicState; at: number }
  | { type: 'audio.unavailable'; clipId: AudioClipId; reason: string; at: number }
  | { type: 'app.error'; scope: string; recoverable: boolean; code: string; at: number };
```

The bus is synchronous and in-memory. Persisting subscribers (progress, rewards, event queue) write to IndexedDB. Events carry no free-text child data.

## 4. React and Phaser integration

### 4.1 Client-only mounting

- `GameHost` is a client component loaded with `next/dynamic(() => import('./GameHost'), { ssr: false })`. Phaser is in its own async chunk, so screens without a canvas (profiles, parent area) never download it.
- **One `Phaser.Game` instance for the app's lifetime**, created when first needed and kept in a module-level holder inside `game/core/phaserHost.ts`. Reason: repeatedly creating and destroying WebGL contexts leaks memory and hits context limits on iOS Safari. Routes that need a canvas attach the host's canvas to their container `div`; routes that don't detach it and the game is paused (`game.loop.sleep()`), so it costs no frames.
- Config: `scale.mode = Phaser.Scale.RESIZE`, `parent` set at attach time, `audio.noAudio = true` (all sound goes through `AudioPlaybackService` so React screens and Phaser share one `AudioContext`), `render.antialias = true`, `fps.target = 60`, `fps.min = 30`, `input.activePointers = 2`.
- A `ResizeObserver` on the container plus `visualViewport` resize events drive `game.scale.resize(w, h)`. Safe-area insets (`env(safe-area-inset-*)`) are read from a CSS variable probe and passed to scenes as a `SafeArea` rect.

### 4.2 Scene contract

```ts
interface ActivitySceneAdapter<TDef extends ActivityDefinition> {
  readonly mechanic: TDef['mechanic'];
  mount(ctx: SceneMountContext<TDef>): void;   // create objects from definition + controller snapshot
  layout(viewport: Viewport): void;            // re-anchor objects; must be idempotent and side-effect free on state
  render(snapshot: ActivitySnapshot): void;    // reflect controller state (selected, counted, matched…)
  unmount(): void;                             // remove listeners, tweens, timers, textures it owns
}
```

The controller (XState actor) is the source of truth. Phaser scenes send `INPUT` events to the controller and re-render from its snapshot. Rotation therefore only calls `layout()`; nothing is recreated and no state is lost.

### 4.3 React overlays over the canvas

Pause, help, the speaking panel's record button, the "replay instruction" ear button and the result screen are React components positioned above the canvas. They talk to the controller via the same actor reference held in a React context (`useActivityActor()`). This keeps accessible DOM controls (focus, ARIA, large hit areas) for the parts that most need them.

For the map, an invisible-but-focusable DOM layer mirrors each hotspot's screen rect (synced on `layout()`), so keyboard users, screen readers in the parent's hands and Playwright can target destinations.

## 5. Routing

All routes are client-rendered pages in a static export. Dynamic segments use `generateStaticParams` from bundled content IDs.

| Route | Screen | Notes |
|-------|--------|-------|
| `/` | Splash / loading | Preload, storage open, migrations, SW registration |
| `/profiles` | Child profile selection | First run with no profiles goes to parent setup |
| `/profiles/new`, `/profiles/[id]/edit` | Profile create/edit | Parent-gated |
| `/avatar` | Character creator | For the active profile |
| `/welcome` | Welcome with Nono | |
| `/map` | World map | Phaser `MapScene` |
| `/world/[worldId]` | World overview | |
| `/level/[levelId]` | Level intro | |
| `/level/[levelId]/play` | Gameplay shell | Pause and help are in-route overlays, not routes. `?a=<index>` only for debug |
| `/level/[levelId]/result` | Level result | Reads the completion record; idempotent on refresh |
| `/stickers` | Sticker book | |
| `/parent` | Parent gate | Successful gate sets an in-memory session flag (expires after 10 min idle or on leaving the parent area) |
| `/parent/dashboard`, `/parent/progress`, `/parent/voice`, `/parent/language`, `/parent/session`, `/parent/privacy`, `/parent/content`, `/parent/profiles` | Parent screens | Guarded by `ParentGuard`; redirect to `/parent` if no session |
| `/dev/playground` | Mechanic debug playground (P3) | Excluded from production builds by flag |

Back behaviour: the browser back button follows the route stack above. Within `/level/[id]/play`, browser back opens the pause menu first (via a `popstate` guard) rather than leaving mid-activity. Child screens show a single large "back" (home/map) icon; no screen is a dead end.

## 6. State ownership

| State | Owner | Persistence |
|-------|-------|-------------|
| Active profile id, language mode, mute, reduced motion (resolved) | Zustand `sessionStore` | Settings in IndexedDB; active profile id in `localStorage` (convenience only) |
| Parent session unlocked | Zustand, memory only | Never persisted |
| Current activity state (phase, selections, counts, hint level) | XState activity actor | Snapshot written to IndexedDB `activeSession` at each `feedback`/`completed` boundary and on `visibilitychange: hidden` |
| Audio playback state | XState audio actor inside `AudioPlaybackService` | Not persisted |
| Microphone state | XState mic actor per speaking activity | Not persisted; raw audio never persisted |
| Progress, attempts, completions, skill evidence, stickers | Domain repositories | IndexedDB |
| Content (worlds, levels, activities) | `ContentRepository` | Bundled JSON, precached |

Zustand never holds gameplay truth. React components never hold state that would be lost on rotation; rotation causes only a resize, not an unmount.

## 7. Scene and activity lifecycle

```
route /level/[id]/play mounts
  → LevelRunner (feature) loads LevelDefinition, resumes activeSession if present and same content version
  → for each activity in order:
       registry.get(def.mechanic) → { createController, SceneAdapter }
       controller = createActor(machine, { input: { def, services, resume? } }).start()
       phaserHost.startScene(ActivityScene, { adapter, controller })
       await controller reaches completed | skipped
       adapter.unmount(); controller.stop()
  → level complete → progress.completeLevel(idempotent) → rewards.grant(idempotent) → navigate to /result
route unmounts (back, pause→map, error)
  → LevelRunner.dispose(): stop controller, cancel in-flight audio, mic.cancel() (stops tracks), adapter.unmount()
```

Stale async guards: every async step (asset load, audio `ended`, mic stop) is tagged with the actor's `runId`; results for an old `runId` are dropped. XState's actor stop cancels invoked promises/callbacks.

## 8. Data flow (one interaction)

```
pointerdown on cat sprite (Phaser)
 → adapter.send({ type: 'INPUT.TAP', targetId: 'cat' })
 → controller (interacting) → guard: not already handled, not locked
 → controller → validating → evaluate(def, state) [pure function]
 → emits activity.evaluated on bus  ──▶ progress subscriber appends Attempt + SkillEvidence (IndexedDB)
 → controller → feedback: audio.playVoice('af01.feedback.cat_found') + adapter.render(snapshot) (sparkle)
 → controller → completed when all targets found
 → LevelRunner advances
```

## 9. Deployment

- `next build` with `output: 'export'` produces `out/`. A post-build step runs `serwist injectManifest` to generate `sw.js` with a precache manifest (app shell, content JSON, per-world asset packs).
- Host: any HTTPS static host with correct MIME types and `Cache-Control: no-cache` on `sw.js` and HTML, `immutable` on hashed assets. Default recommendation: Vercel or Cloudflare Pages static (12 Q5).
- Security headers: `Content-Security-Policy` (`default-src 'self'; media-src 'self' blob:; connect-src 'self'` plus the TTS proxy origin only if enabled; no third-party script origins), `Permissions-Policy: microphone=(self)`, `Referrer-Policy: no-referrer`.
- Optional TTS proxy (P5): separate serverless function, its own repo folder `services-server/tts-proxy`, deployed only if keys are configured. Secrets are server-side env vars, never `NEXT_PUBLIC_*`.

## 10. Error boundaries

| Boundary | Catches | Child-facing result |
|----------|---------|---------------------|
| Root (`app/error.tsx`) | Unrecoverable render errors | Nono "Oops" illustration, big "home" button, retry. Logs `app.error` |
| `GameHost` boundary | Phaser boot failure, WebGL loss | Try Canvas renderer fallback once; then a friendly screen with retry and map |
| `LevelRunner` boundary | Content invalid, activity crash | Skip the broken activity (logged), continue the level; if the level cannot run, return to world overview with Nono apology |
| Asset errors | Missing image/audio | Image: placeholder silhouette; audio: visual cue plus on-screen icon; never blocks |
| Storage errors | Quota exceeded, private mode, blocked | Switch to in-memory repository for the session and show a parent-visible banner; child keeps playing |

## 11. Feature flags

Static, build-time flags in `shared/flags.ts` with an optional parent-area override in IndexedDB for flags marked `parentToggle`:

| Flag | Default | Notes |
|------|---------|-------|
| `ttsDynamic` | off | Requires `TTS_PROXY_URL` at build; also needs parent opt-in |
| `speechRecognition` | off | Requires a configured provider; also needs parent consent |
| `devPlayground` | dev only | |
| `worldVisibility.<worldId>` | on | Parent content control (hides a world from the map; does not lock) |
| `testHooks` | dev/test only | Exposes `window.__MWG__` for Playwright (scene object rects, controller snapshots) |
| `rendererCanvasFallback` | auto | |
