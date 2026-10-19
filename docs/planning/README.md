# Mariam's Magical World (عالم مريم السحري) — Planning Pack

Status: **Plan approved 2026-10-19. Phase 1 (foundation) implemented**; see [the Phase 1 report](../progress/phase-1.md).

| # | Document | Purpose |
|---|----------|---------|
| 00 | [Executive summary](00-executive-summary.md) | Goals, age suitability, scope, assumptions, success criteria, the fixed decisions |
| 01 | [Repository audit](01-repository-audit.md) | Current repo state, toolchain, version check, constraints |
| 02 | [Architecture](02-architecture.md) | C4 views, boundaries, React and Phaser integration, routing, state, lifecycle, deployment |
| 03 | [Screen specifications](03-screen-specifications.md) | Every child and parent screen, with Given/When/Then checks |
| 04 | [Gameplay and activities](04-gameplay-and-activities.md) | Engine, six mechanics, state charts, hints/retry/skip, events |
| 05 | [Content schema and curriculum](05-content-schema-and-curriculum.md) | Zod schemas, IDs, localization model, skills, outcomes |
| 05a | [Level catalog](05a-level-catalog.md) | All 12 levels as micro-stories with QA scripts |
| 06 | [Audio, speech and privacy](06-audio-speech-and-privacy.md) | Audio policy, TTS, microphone state machine, consent |
| 07 | [Art direction and asset pipeline](07-art-direction-and-asset-pipeline.md) | Style bible, animation specs, atlases, licensing, budgets |
| 08 | [Progress and parent dashboard](08-progress-and-parent-dashboard.md) | IndexedDB model, events, skill evidence, reporting, deletion |
| 09 | [Testing and acceptance](09-testing-and-acceptance.md) | Test matrix, device matrix, gates, child-usability protocol |
| 10 | [Milestones and risks](10-milestones-and-risks.md) | Phases, effort, risk register, vertical slice, decision log |
| 11 | [Repository structure](11-repository-structure.md) | Proposed file tree and responsibilities |
| 12 | [Open questions](12-open-questions.md) | Blocking decisions only, each with a recommended default |
| 13 | [Traceability matrix](13-traceability-matrix.md) | Requirement → component → data → test → milestone |
| ex | [examples/af-01.level.json](examples/af-01.level.json) | Complete sample level definition (AF-01) |

Conventions used throughout:
- **MVP** means committed scope for this release. **Roadmap** means explicitly out of MVP.
- Requirement IDs are `R-xx` (defined in 13). Test IDs are `T-<area>-xx`. Phases are `P0`–`P7`.
- "Provisional" marks a number or threshold that is a hypothesis to be measured, not a promise.
