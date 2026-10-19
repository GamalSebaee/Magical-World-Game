# 13 — Traceability Matrix

Scope column: **MVP** = committed; **Road** = roadmap (designed, not delivered in MVP).

| ID | Requirement | Scope | Components | Data definitions | Tests | Milestone |
|----|-------------|-------|------------|------------------|-------|-----------|
| R-01 | Play without reading; every action has voice + visual cue | MVP | `shared/ui` (EarButton, BigButton), `FeedbackDirector`, Nono animations | `LocalizedAudioRef`, hints | 03 per-screen checks, G1 protocol, T-AUD-02 | P2, P4 |
| R-02 | Explorable world map, tap-to-enter, tap/drag disambiguation | MVP | `MapScene`, DOM hotspot mirror | `WorldDefinition.mapHotspot` | C5 checks, T-NAV-01 | P2, P4 |
| R-03 | Open exploration: all levels available, suggestions never block | MVP | world overview, `LevelRunner` | `suggestedNext` (data only) | T-NAV-03, G3 | P2, P4 |
| R-04 | Portrait + landscape, adaptive layout, state kept on rotation | MVP | `phaserHost` resize, `LayoutSolver`, adapters `layout()`, XState controllers | `LayoutPreset` | T-ORI-*, G7 | P1–P4 |
| R-05 | Customizable avatar (name, hair style/color, clothes, shoes), layered sprites | MVP | `features/avatar`, composer | `AvatarConfig` | C3 checks, visual snapshots | P2 (min), P6 (full) |
| R-06 | Nono companion with 7 states | MVP | Nono sprite controller | atlas frames | visual + state tests | P2 |
| R-07 | Arabic RTL, English LTR, mixed mode with bidi isolation | MVP | `shared/i18n`, `ContentResolver` | `LocalizedText`, `MixedSequence` | T-I18N-01..03, G4 | P1, P2, P4 |
| R-08 | Egyptian-friendly spoken Arabic, accurate written vocabulary, gender-neutral prompts | MVP | review workflow | audio manifest `review` | review checklist, copy lint | P2, P4 |
| R-09 | Bundled reviewed audio for all core content, offline | MVP | `AudioPlaybackService`, SW precache | `audio-manifest.json` | T-OFF-01, G6, `audio:check` | P2, P4, P7 |
| R-10 | Optional dynamic TTS, server-proxied, allowlisted, cannot block play | Road (adapter MVP-ready, off) | `TtsProvider`, `tts-proxy` | TTS templates | T-AUD-06, network audit | P5 |
| R-11 | Real microphone capture with permissions, indicator, cancel, skip | MVP | `MicrophoneRecorder`, `mic.machine`, SpeechPanel | `SpeechAttemptResult` | T-MIC-*, 06 §10, G5 | P2 |
| R-12 | Optional speech recognition, consent-gated, no false claims | Road (adapter + consent UI MVP-ready, off) | `SpeechRecognitionProvider`, `SpeechFeedbackService` | consents | T-SPEECH-*, copy lint | P5 |
| R-13 | No pronunciation scores; honest speech feedback | MVP | `SpeechFeedbackService`, dashboard copy | evidence `speech_attempt` | T-SPEECH-02, G13 copy lint | P2, P6 |
| R-14 | 3 worlds × 4 levels, 2–4 activities each, micro-stories | MVP | content + `LevelRunner` | `LevelDefinition`, `WorldDefinition` | T-LVL-01..12, G2 | P2, P4 |
| R-15 | Six reusable mechanics via registry, typed union | MVP | `ActivityRegistry`, `game/activities/*` | `ActivityDefinition` | T-EVAL-*, T-MECH-*, 04 §4 checks | P2, P3 |
| R-16 | Lifecycle state chart with pause/error paths; guards (duplicate taps, stale callbacks, unmount) | MVP | `lifecycle.machine`, `LevelRunner.dispose` | snapshot | T-LIFE-* | P2, P3 |
| R-17 | Hints, retry, skip; no punitive timers | MVP | `HintPolicy`, help overlay | `hints` | C13 checks, T-LIFE-05 | P2, P3 |
| R-18 | Forgiving drag, touch + mouse, alternative tap-tap input | MVP | drag-drop adapter | `DragDropDef` | T-MECH-10..12 | P3 |
| R-19 | Counting integrity and synced spoken count | MVP | count-objects controller, audio queue | `CountObjectsDef` | T-MECH-20..22 | P3 |
| R-20 | Idempotent completion and sticker rewards | MVP | `features/rewards`, `ProgressRepo` | `LevelCompletion`, `StickerGrant` | T-REW-*, C10 checks | P2 |
| R-21 | Sticker book, bounded non-manipulative rewards | MVP | `features/rewards` UI | stickers | C11 checks, copy lint | P2 (min), P6 |
| R-22 | IndexedDB, versioned schema, migrations, fallbacks (quota, private mode) | MVP | `services/storage` | 08 §1 stores | T-PER-*, G9 | P1, P2 |
| R-23 | Skill evidence separate from completion; no mastery from single answer/speech/time | MVP | `features/learning` | `SkillEvidence`, `SkillState`, rule v1 | T-LEARN-* | P2, P6 |
| R-24 | Parent gate (not arithmetic alone) | MVP | `features/parental/gate` | PIN hash | P1 checks | P2 (min), P6 |
| R-25 | Parent dashboard: encountered / practiced / demonstrated, no fabricated metrics | MVP | dashboard, progress screens | derived from stores | P2/P3 checks | P6 |
| R-26 | Voice/mic settings and consent | MVP | `/parent/voice` | `consents` | P4 checks | P2 (min), P6 |
| R-27 | Language mode and voice preferences | MVP | `/parent/language` | settings | P5 checks | P2 (min), P6 |
| R-28 | Session length and break reminders | MVP | `features/session` | `sessions`, settings | P6 checks | P6 |
| R-29 | Privacy: export, delete, no raw audio retained | MVP | `services/storage/export`, privacy screen | `ExportFileV1` | T-PRIV-*, G10 | P6 |
| R-30 | Content controls: world visibility, reduced motion, music/SFX | MVP | `/parent/content`, flags | settings | P8 checks | P6 |
| R-31 | Schema-validated versioned JSON content | MVP | `scripts/content/validate`, Zod | 05 §3 | T-CON-* | P1 |
| R-32 | Hybrid assets with style bible, provenance and licensing | MVP | asset scripts | `assets-manifest.json` | release gate (no unknown licence) | P2, P4 |
| R-33 | Installable PWA, offline-first, explicit offline-ready status, safe SW upgrades | MVP | `sw.ts`, splash badge | precache manifest | T-OFF-*, T-SW-* | P1, P7 |
| R-34 | Child safety: no ads, external links, chat, purchases, streaks | MVP | lint rules, CSP | — | 09 §6 | P1 onward |
| R-35 | Accessibility: keyboard parent UI, large child targets, reduced motion, mute, replayable prompts | MVP | `shared/ui`, `LayoutSolver` assertions | — | T-A11Y-*, G14 | P2–P6 |
| R-36 | Failure modes handled (17 listed) | MVP | error boundaries, resolvers | — | 09 §7 matrix | P2–P7 |
| R-37 | Performance budgets measured on a real device | MVP | — | 07 §10 | G15 | P1 (baseline), P7 |
| R-38 | Cross-device verification (Android, desktop; iOS before claiming) | MVP | — | — | 09 §5, G12 | P2, P7 |
| R-39 | Debug playground for mechanics | MVP (dev only) | `/dev/playground` | — | — | P3 |
| R-40 | Future worlds (Alphabet Castle, Story Village, Speaking Station, Friendship Garden, Little Life City) | Road | — | schema supports more worlds | — | after MVP |
| R-41 | Cloud sync / accounts / analytics upload | Road | — | — | — | after MVP |
| R-42 | Spoken personalization with child's name | Road | TTS templates | — | — | P5+ (if TTS enabled) |
