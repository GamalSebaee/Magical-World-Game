# 00 — Executive Summary

## 1. Product in one paragraph

Mariam's Magical World (عالم مريم السحري) is a bilingual (Arabic/English, plus a parent-set mixed mode), mobile-first, installable web game for children aged 3–6, tuned for a four-year-old. The child plays as a customizable avatar ("Mariam" by default) guided by Nono, a friendly robot who speaks every instruction. The child taps destinations on an illustrated world map and plays short voice-led adventures (2–5 minutes each) that teach early vocabulary, colors, shapes and numbers. Nothing needs to be read by the child. It works offline after first load, keeps all data on the device by default, and has no ads, purchases, external links, chat, timers that punish or streak pressure.

## 2. Understanding of the fixed decisions

These are taken as settled and are not reopened in this plan, except where a version check changes a technical detail (noted).

| Area | Decision | How the plan honours it |
|------|----------|-------------------------|
| Game form | Polished 2D, touch-first. React for app UI, Phaser for gameplay scenes | React (Next.js App Router) owns screens and overlays; Phaser owns the world map and gameplay canvases (02 §4) |
| Navigation | Tap-to-enter world map, no free-roam controls | `MapScene` with large hotspots; drag-pan only if the map is wider than the viewport, with tap/drag disambiguation (03 C5) |
| Orientation | Portrait and landscape, adaptive layouts, state preserved on rotation | Layout solver re-anchors scene objects on resize; gameplay state lives in controllers, not scene objects (02 §6, 04 §7) |
| Character | Mariam, customizable name, hairstyle, hair color, clothes, shoes; layered sprites | `AvatarConfig` record + layered sprite composer with shared pivots (07 §5) |
| Companion | Nono robot, voice and nonverbal cues | 7 animation states (idle, talking, pointing, celebrating, waiting, helping, listening) |
| Languages | Arabic RTL, English LTR, mixed mode; Egyptian-friendly spoken prompts; accurate written vocabulary | `LocalizedText` / `LocalizedAudio` with `ar`, `en`, `mixed`; bidi isolation; dialect policy (05 §4, 06 §2) |
| Audio | Hybrid: pre-produced reviewed clips plus optional dynamic TTS, cached, offline fallback | `AudioAssetResolver` chain; MVP ships 100% of core audio as bundled files; TTS off by default (06) |
| Microphone | Real recording from MVP, honest feedback, optional recognition | `MicrophoneRecorder` state machine, local voice-activity detection, recognition consent-gated and off by default (06 §5–7) |
| Exploration | Open: every implemented level available at first launch | No gating code path exists; "suggested next" is a visual hint only (R-03, T-NAV-03) |
| Art | Hybrid licensed / custom vector / AI-assisted, unified style, provenance inventory | Style bible + `assets-manifest.json` with rights and review status (07) |
| Platform | Responsive web + installable PWA, offline-first, no mandatory backend | Static export + service worker precache; no server needed for MVP (02 §9) |
| Content | Schema-validated, versioned JSON | Zod 4 schemas, build-time validation, generated JSON Schema (05) |
| Child safety | No ads, dark patterns, external links, chat, punitive timers, social feeds | Enforced by lint rule + E2E check on child routes (09 §6) |

Version note: the brief says Phaser 3. Phaser 4 is now stable (4.0.0 April 2026, 4.2.1 current). The plan keeps **Phaser 3.90** as the default to honour the brief and use its mature documentation, and adds a half-day Phase 1 spike to check Phaser 4 (see 12, Q1).

## 3. Age suitability

Target: 4-year-old. Supported range: 3–6.

Design constraints derived from that age:
- No reading needed. Every instruction is spoken and has a visual cue (Nono pointing, a pulsing target, an animated hand).
- Touch targets ≥ 64 CSS px for child controls (above the 44–48 px adult guidelines; small hands, low motor precision). Primary actions ≥ 88 px.
- One instruction at a time, ≤ 8 spoken words where possible. Instructions can be replayed with a single, always-visible "ear" button.
- 2–4 choices per question at most. Activities are 2–5 minutes. Levels are 5–12 minutes.
- No failure states. Wrong answers get gentle redirection and a hint. Every activity can be skipped.
- No timers that end play. Session-length reminders are adult-set and gentle (Nono yawns, suggests a break) and never cut off mid-activity.

## 4. Scope

### 4.1 Committed MVP scope

- 3 worlds: Animal Forest, Color Town, Number Island.
- 12 levels (4 per world), each a playable micro-story with 2–4 activities, a narrative intro/outro, help, retry, skip and a sticker reward.
- 6 reusable mechanics: `tap_discover`, `listen_choose`, `drag_drop`, `match_pairs`, `count_objects`, `speak_repeat`.
- 13 child screens and 8 parent screens (03).
- Arabic, English and mixed language modes, with bundled reviewed audio for all core prompts and vocabulary.
- Real microphone capture with permission handling, visible recording state, playback of the child's own voice, local voice-activity detection, cancel and skip. No raw audio stored or uploaded by default.
- Local profiles (up to 4), avatar customization, progress, skill evidence, sticker book, parent dashboard, consent, export and deletion.
- Installable PWA, offline after first full cache, explicit "offline-ready" indicator.
- Automated tests (unit, component, E2E across orientations) and a supervised child-usability checklist.

### 4.2 Out of MVP (roadmap)

- Worlds: Alphabet Castle, Story Village, Speaking Station (standalone world), Friendship Garden, Little Life City. Speaking mechanics are in MVP; only the dedicated world is not.
- Cloud accounts, cross-device sync, backend storage.
- Dynamic TTS in the child experience by default (the adapter and server route are designed; enabling it is a Phase 5 decision that depends on a provider and keys being supplied).
- Third-party speech recognition by default (designed, consent-gated, off by default).
- Spoken personalization with the child's own name (needs dynamic TTS; name is shown visually only in MVP).
- Native app-store builds, multiplayer, user-generated content, any chat.
- Content authoring UI (content is edited as JSON in the repo).

## 5. Assumptions

| # | Assumption | If wrong |
|---|-----------|----------|
| A1 | Solo developer working with an AI coding agent; one product owner/parent reviewer | Effort ranges in 10 scale down with more people |
| A2 | A native Egyptian-Arabic speaker can review scripts and audio | Without review, Arabic audio cannot pass the content gate (06 §2.4) |
| A3 | Voice clips will be produced by (a) a recorded voice actor or (b) commercial TTS whose licence permits redistribution of generated audio, then human-reviewed | See 12 Q3 |
| A4 | Art: custom SVG/vector made for the project plus CC0/permissively licensed packs; AI-assisted art only after review | Functional placeholders are used and labelled until final art lands (07 §8) |
| A5 | Hosting on a static host with HTTPS (needed for microphone and service worker) | Any HTTPS static host works; see 02 §9 |
| A6 | Reference test device: a mid-range Android phone (about 4 GB RAM, 2022–2024 chipset) on Chrome, plus desktop Chromium/Firefox/WebKit. iOS Safari device available before claiming cross-platform readiness | Performance budgets are recalibrated against whatever device is used (09 §5) |
| A7 | No analytics leave the device in MVP | If remote analytics are wanted later, they need a separate privacy review |

## 6. Success criteria

The MVP is complete only when all 15 global gates in 09 §2 pass. Summary:

1. A four-year-old, supervised, can choose a world and finish a level using only audio and visual cues (child-usability protocol, 09 §8).
2. 12 genuinely playable levels using all 6 mechanics; no mock interactions counted.
3. Every level selectable from first launch.
4. Arabic, English and mixed modes show and speak the right content.
5. Real microphone capture with permission, recording indicator, cancel and skip; honest feedback.
6. All core audio plays offline after caching; TTS failure never blocks play.
7. Portrait and landscape everywhere; rotation mid-activity keeps state.
8. Touch and mouse work; forgiving drag; no double count, no double reward.
9. Profiles, avatar and progress survive refresh and relaunch; schema migration tested.
10. Parent controls, consent, export and deletion work; no raw voice retained by default.
11. Automated tests cover the required areas (09 §3).
12. Manual tests pass on one Android phone and desktop browsers; iOS Safari listed as required before claiming cross-platform.
13. No console errors, missing critical assets, dead ends or misleading speech claims.
14. Accessibility gates for parent UI and child controls.
15. Measured performance against documented budgets.

## 7. What the plan deliberately avoids

- A backend, monorepo, microservices or a CMS for the MVP.
- Scoring pronunciation, or treating a transcript match as "correct".
- Mastery from a single answer, from recognition alone, or from time spent.
- Locked content, "coming soon" teasers for unbuilt worlds, scarcity or streak mechanics.
- Presenting placeholder art as final.
