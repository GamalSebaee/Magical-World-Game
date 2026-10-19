# 07 — Art Direction and Asset Pipeline

## 1. Style bible (summary)

- **Look:** soft, rounded, storybook-flat 2D with gentle gradients; friendly, not hyper-saturated; uncluttered backgrounds so interactive objects stand out.
- **Perspective:** straight-on side view for characters; slightly elevated 3/4 for the world map. No dramatic foreshortening.
- **Outlines:** 3–4 px (at 1× design scale) rounded-join outlines in a darker shade of the fill (not pure black). Interactive objects get a slightly thicker outline (5 px) than background props, a subtle affordance.
- **Shading:** one flat shadow tone (fill darkened 15–20%) on the bottom/away side, one soft highlight; no complex lighting. Ground contact shadow ellipse at 20% opacity.
- **Shapes:** big heads, round bodies; eyes large with a highlight; no sharp teeth or scary expressions.
- **Background vs foreground:** backgrounds desaturated 15–25% and lower contrast; interactive items at full saturation.
- **Text in art:** none (localization and AI-artifact risk). Numerals on objects are rendered by the engine, not baked into art.

## 2. Palette

| Token | Hex | Use |
|-------|-----|-----|
| `sky-100` | #E8F6FF | Backgrounds |
| `leaf-500` | #5DBB63 | Animal Forest primary |
| `sun-400` | #FFC93C | Highlights, stars |
| `berry-500` | #E4572E | Accents (never as "wrong") |
| `ocean-500` | #2E86DE | Number Island primary |
| `candy-400` | #F78FB3 | Color Town accent |
| `ink-700` | #2D3047 | Outlines (darkest), parent UI text |
| `cloud-0` | #FFFFFF | Panels |

Teaching colors (Color Town) are chosen to be distinguishable under deuteranopia/protanopia simulation and in grayscale by luminance where possible: red #E53935, blue #1E63D6, yellow #FDD835, green #43A047. Color is never the only difference between choices in non-color activities. Final palette is verified with a colour-vision simulator during P2.

## 3. Resolution, scale and export

- **Design canvas:** 1920×1080 (landscape) and 1080×1920 (portrait) reference frames; scenes compose from layers, not one full image.
- **Sprites:** authored as vector (SVG/Figma) and exported to PNG at **2×** of their 1× display size (1× = size on a 390-px-wide phone); WebP for opaque backgrounds.
- **Backgrounds:** max 2048 px on the long edge, WebP quality 80, split into 2–3 parallax layers only where used.
- **Transparency:** sprites are PNG-32 with trimmed transparent margins; pivots stored in atlas data, not by padding.
- **Atlases:** TexturePacker-compatible JSON Hash (`free-tex-packer-core` in a build script to avoid a paid tool), max 2048×2048 per page (safe for mid-range GPUs), 2 px extrude, padding 2 px, power-of-two not required. One atlas set per world pack + `common` (Nono, UI, avatar layers).

## 4. Animation specifications

Animations are frame-based (atlas frames) for characters and tweened (Phaser tweens) for simple motion (bounce, wiggle, pop).

**Nono** (robot, ~ 220 px tall at 1×):

| State | Frames | FPS | Loop | Notes |
|-------|--------|-----|------|-------|
| idle | 12 | 12 | yes | gentle hover bob, blink every 3–5 s (random) |
| talking | 8 | 12 | yes while voice plays | mouth light flaps; driven by voice envelope |
| pointing | 6 + hold | 12 | hold last | arm points; engine rotates arm toward target (separate arm sprite) |
| celebrating | 16 | 15 | no | spin + sparkles |
| waiting | 12 | 10 | yes | head tilt, antenna glow |
| helping | 10 | 12 | no → idle | leans in, lightbulb antenna |
| listening | 8 | 10 | yes | ear dish rotates/glows; used while recording |

**Animals** (cat, dog, rabbit, cow, duck, bird, crab, fish, monkey, parrot): `idle` (8–12 f), `happy` (10 f), plus one action each (`peek`, `hop`, `eat`, `swim`). Reduced motion: idle loops are replaced by a static frame with blinking only.

**UI motion:** button press scale 0.92 → 1 (120 ms); correct sparkle 600 ms; wiggle 300 ms (±6°); all tweens use ease-out; total screen-transition time ≤ 400 ms.

## 5. Avatar layering (Mariam)

Layer order (back → front): `hair-back` → `body` (skin tone) → `shoes` → `bottom` → `top` → `head` (skin tone) → `face` (eyes, mouth) → `hair-front` → `accessory`.

- Every layer is exported on the **same canvas size (512×768 at 2×) with the same origin** (feet center at 256,740), so composition needs no per-layer offsets. Pivots stored once.
- Hair color and skin tone: base art drawn in neutral grey ramp, tinted at runtime with Phaser `setTint` for hair; skin tones are separate pre-colored layers (tinting skin looks poor). Shadows/highlights remain as a separate untinted overlay layer.
- MVP options (provisional): 6 hairstyles (including covered-hair hijab option, short, curly, braids, ponytail, bun), 8 hair colors, 5 skin tones, 6 tops, 5 bottoms/dresses, 5 shoes, 4 accessories (none, glasses, bow, cap). All options free; none unlockable.
- Animations for the avatar are tween-based (hop, wave, happy wiggle) applied to the composed container, so layers stay in sync.
- Default avatar: shown on profile creation; parent/child can change.

## 6. World map

- Illustrated island-style map, 3 destinations with ambient loops (trees sway, balloons bob, waves).
- Landscape: full map in view. Portrait: camera framed on a 9:16 crop with the three destinations arranged so they all fit at ≥ 120 px hotspot size on a 360-px-wide phone; if they cannot, the camera pans (03 C5).
- No hidden or inaccessible destinations; no decorative fake locks or teaser islands.
- Map decorations unlocked by stickers are placed at fixed, non-interactive spots.

## 7. Asset manifest (`src/content/assets-manifest.json`)

```json
{
  "id": "animals/cat",
  "type": "sprite-atlas-frames",
  "pack": "pack.animal-forest",
  "files": ["assets/atlases/animal-forest-0.png", "assets/atlases/animal-forest-0.json"],
  "frames": ["cat-idle-00", "…", "cat-peek-09"],
  "displaySize1x": { "w": 180, "h": 160 },
  "source": "custom-vector",
  "creator": "studio-artist-01",
  "aiAssisted": false,
  "licence": { "type": "commissioned-full-rights", "url": null, "attributionRequired": false },
  "language": null,
  "status": "placeholder | draft | review | approved",
  "review": { "by": null, "date": null, "notes": "" }
}
```

Statuses: `placeholder` (functional, clearly marked in UI only in dev with a corner tag), `draft`, `review`, `approved`. Release gate: no `placeholder` assets in production unless the release notes list them.

## 8. Sourcing rules (hybrid assets)

| Source | Allowed | Required before use |
|--------|---------|---------------------|
| Custom vector (made for the project) | Yes | Creator recorded; rights assigned to the project |
| CC0 packs (e.g. Kenney) | Yes | URL, licence text archived in `licenses/`, matches style or is restyled |
| CC-BY | Yes, with attribution | Attribution added to the parent "About" page; licence archived |
| CC-BY-NC / -ND / unclear | **No** | — |
| Random web images | **No** | — |
| AI-assisted images | Yes, after review | Tool and its terms recorded (commercial use allowed); prompt recorded; human review for consistency with the style bible, anatomy (paws, fingers), no text artifacts, clean cropping, separable layers; usually re-traced to vector before production |
| Animal sounds | Recorded or CC0/licensed libraries | Licence archived; loudness normalised |

Placeholders: until approved art exists, the slice uses simple vector placeholders (colored rounded shapes with a pictogram) that are functionally complete. They are labelled `placeholder` in the manifest and listed in the slice's demo notes. They are not presented as final art.

## 9. Vertical slice (AF-01) asset list

| Asset | Count | Notes |
|-------|-------|-------|
| Nono, 7 states | 1 atlas | Highest priority; used on every screen |
| Avatar layers (minimum set: 2 hairstyles, 4 hair colors, 3 skin tones, 2 tops, 2 bottoms, 2 shoes) | 1 atlas | Remaining options in P6 |
| Map background + 3 hotspots | 1 bg + 1 atlas | Color Town and Number Island hotspots can be placeholder in the slice (worlds exist as content stubs) |
| Animal Forest clearing bg, bush, tree | 1 bg + frames | |
| Cat, dog (idle, peek/hop, happy) | frames | |
| UI kit (ear, pause, help, mic, play, back, map, tick, cross, arrow) | 1 atlas / SVG | React UI may use inline SVG |
| Sticker AF-01 | 1 | |
| Voice clips ar + en + mixed carriers | ≈ 40 per language | Includes shared Nono lines and screen cues |
| SFX (tap, pop, sparkle, boop, chime, record start/stop, cat, dog) | ≈ 10 | |
| Music bed (forest) | 1 loop | Optional for slice |

## 10. Performance budgets (provisional, to be measured in P1/P2 on the reference device)

| Budget | Provisional target | Measured how |
|--------|-------------------|--------------|
| App shell JS (excluding Phaser) | ≤ 200 KB gzip | build stats |
| Phaser chunk | as shipped (≈ 300 KB gzip expected for the full build; measure, consider a custom build) | build stats |
| Boot pack (splash → profiles usable) | ≤ 1.5 MB transfer | network panel |
| World pack (art + audio, one language pair) | ≤ 8 MB | manifest sizing script |
| Total offline precache (3 worlds, ar + en) | ≤ 35 MB | SW manifest total |
| Texture memory per scene | ≤ 64 MB GPU (≈ 4 atlas pages 2048² RGBA = 64 MB) | Phaser texture manager + Chrome memory tools |
| JS heap during play | ≤ 150 MB | Chrome DevTools on device |
| Frame rate | median ≥ 55 fps, p95 frame time ≤ 33 ms during gameplay | Performance traces on device |
| Cold start to Play button (cached) | ≤ 3 s; first visit on 4G-like throttling ≤ 6 s | Lighthouse + manual |
| Activity load | ≤ 1.5 s from intro Start to interactive (cached) | timestamps in dev log |

These are hypotheses. P1 records a baseline on the reference device and revises the numbers in this table with a note of what was measured.
