# Mariam's Magical World · عالم مريم السحري

A bilingual (Arabic / English / mixed), offline-first, installable web game for children aged 3–6. The child plays by sound and pictures and never needs to read.

**Status: Phase 2 (AF-01 vertical slice) complete with placeholder voice and art.** One level, "Meet Cat & Dog", is playable end to end in Arabic, English and mixed modes, with real microphone practice, offline play and saved progress. See [`docs/progress/phase-2.md`](docs/progress/phase-2.md) (and [phase 1](docs/progress/phase-1.md)) for what exists, what was measured and what's next. The full plan is in [`docs/planning/`](docs/planning/README.md).

## Requirements

- Node.js ≥ 22 (22.22.2+ recommended; `jsdom` asks for it), pnpm 10.

## Commands

| Command | What it does |
|---------|--------------|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Dev server on http://localhost:3000 (no service worker in dev) |
| `pnpm build` | Validate content → static export to `out/` → generate `out/sw.js` |
| `pnpm start` | Serve `out/` on http://localhost:3000 (production, with offline caching) |
| `pnpm check` | Lint + typecheck + content validation + unit tests |
| `pnpm test` | Unit and component tests (Vitest) |
| `pnpm test:e2e` | End-to-end tests (Playwright); builds with test hooks and serves `out/` on port 4173 |
| `pnpm content:validate [--release]` | Validate all content; `--release` also fails on planned or unreviewed audio and art |
| `tsx scripts/content/sync-manifests.ts` | Add `planned` manifest entries for newly referenced audio and assets |
| `pnpm content:schema` | Regenerate JSON Schema for editor autocomplete |
| `tsx scripts/audio/gen-placeholders.ts` | Generate labelled placeholder audio for clips that are only planned |
| `pnpm size` | After a build: JavaScript each page downloads (gzip), against the 200 KB budget |

**Activity playground:** `pnpm dev`, then open http://localhost:3000/dev/playground/ to run any
activity alone with language, orientation, reduced motion, fake microphone, sound and magnet
toggles and a live state view. It exists only in development and test builds.

Only Chromium is installed in the cloud dev environment, so locally run
`pnpm test:e2e --project=chromium-portrait --project=chromium-landscape --project=desktop-chromium`.
CI installs Firefox and WebKit as well.

## Layout

```
src/app        routes and layout (Next.js App Router, static export)
src/features   product features: boot, levels, avatar, parental, speech, voice, shell
src/game       Phaser host, scenes, activity engine and mechanics
src/services   storage (IndexedDB + memory fallback), content, audio, microphone, offline
src/shared     ids, events, i18n, runtime, UI atoms
src/content    versioned JSON content + Zod schemas
src/sw         service worker source
scripts        content validation, manifests, service worker build, icons
tests          e2e specs, setup
docs           planning pack and progress reports
```

Import boundaries are enforced by ESLint (see `eslint.config.mjs` and planning doc 02 §3).
