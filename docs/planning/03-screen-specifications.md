# 03 — Screen Specifications

## 0. Shared rules for all screens

**Child screens**
- No text needed to act. Text, where shown, is a caption for adults and is never the only cue.
- Every child screen has: the **ear button** (replay the current spoken cue, top-start corner, 72 px), and one **way back** (home/map icon, 72 px). The gameplay shell adds a **pause** button.
- Minimum touch target 64×64 CSS px; primary action 88×88 px; at least 16 px between targets. Hit areas can be larger than the visible art.
- Safe areas: content inside `env(safe-area-inset-*)`; critical controls never in the bottom 24 px (iOS home indicator) or under the browser URL bar (layouts use `100dvh`, not `100vh`).
- Debounce: buttons ignore repeat taps for 400 ms and disable while their action is running.
- Audio: a cue plays on entry only after audio is unlocked (first user gesture on the splash). If autoplay is blocked, the ear button pulses to invite a tap.
- RTL: Arabic mode mirrors layout (start/end, not left/right). Directional art (arrows, "next" chevrons) mirrors; characters and numbers do not.
- Reduced motion: replaces bounces, parallax and screen shakes with fades; keeps essential motion (a demonstration hand) at reduced amplitude.

**Parent screens**
- Behind the parent gate. Plain, readable, keyboard operable, visible focus, WCAG 2.2 AA contrast, 44 px targets, real text labels.
- Every parent screen has a "Back to child mode" button that ends the parent session.

**Notation.** Layout: **P** = portrait, **L** = landscape. Acceptance checks are Given/When/Then and are also listed as test IDs in 09.

---

## Child-facing screens

### C1. Splash / loading — `/`

- **Entry:** app launch, refresh on `/`, PWA start URL. **Exit:** → `/profiles` (profiles exist) or → parent first-run setup (`/parent` with `?setup=1`) when there are none.
- **Hierarchy:** logo with Nono animation (center) → progress ring (below) → large "Play" button that appears when ready → small offline-ready badge (bottom-end) → error card (replaces Play when needed).
- **Actions:** tap Play (also unlocks audio); tap Retry on error.
- **Audio:** none before the first gesture (autoplay rules). On Play tap: short chime, then the next screen's cue.
- **States:**
  - Loading: progress ring shows real progress of the boot pack (app shell critical images, Nono, UI SFX, content index). Steps: open DB → run migrations → validate content index → preload boot pack → register SW.
  - Success: Play button bounces in.
  - Offline-ready: badge "✓ Ready offline" once the SW reports all bundled packs cached; otherwise "Downloading for offline: 45%". Never claims ready early.
  - Error (recoverable): an asset or content fetch failed → card with Nono and Retry; retries only the failed items. If storage is unavailable → continue with an in-memory store and flag for the parent banner.
  - Error (fatal, e.g. content schema invalid in production): Nono "Oops" with Retry and a parent-readable error code.
- **Persistence:** reads settings and profiles; writes `meta.lastLaunchAt`.
- **Layout:** P: stacked center. L: logo start, progress/Play end. Both: Play ≥ 120 px.
- **Back:** browser back exits the app (no in-app back here).
- **Accessibility:** Play has `aria-label` in the current language; progress has `role="progressbar"` with values.

Acceptance:
1. Given a first-ever launch, when boot completes, then the Play button appears and the progress ring reached 100%.
2. Given the network is offline and the app was never cached, when the splash loads, then a retry card appears (not a blank screen) and Retry re-attempts only failed items.
3. Given the SW has cached all bundled packs, when the splash shows, then the "Ready offline" badge is visible; given a partial cache, the badge shows a percentage and not "ready".

### C2. Child profile selection — `/profiles`

- **Entry:** from splash; from map "home" button; after profile create. **Exit:** tap a profile → `/welcome` (or `/avatar` if the avatar was never saved); tap parent icon → `/parent`.
- **Hierarchy:** up to 4 large avatar cards (head-and-shoulders render of each child's avatar + name caption) → "add" card (shows a lock-free "+" with a small parent icon to show it needs a grown-up) → parent corner icon.
- **Actions:** tap profile (selects, plays chime and Nono greeting), tap "+" (opens parent gate), tap parent icon (parent gate).
- **Audio:** on entry: "مين هيلعب النهارده؟ / Who's playing today?" On card tap: the avatar's happy SFX.
- **States:** empty (only on corruption: no profiles but past setup) → Nono asks for a grown-up, "+" card highlighted; loading (skeleton cards ≤ 300 ms, no spinner flash); error (DB read failed) → retry card + in-memory fallback.
- **Persistence:** writes `activeProfileId` to settings.
- **Layout:** P: 2×2 grid. L: 1×4 row (or 1×N). Cards ≥ 140 px.
- **Back:** browser back → splash. No in-app back (this is the home).
- **Accessibility:** cards are buttons with the child's name; parent icon labelled "Grown-ups".

Acceptance:
1. Given two profiles exist, when the screen loads, then two avatar cards render with each child's saved avatar.
2. Given the child taps "+", when the gate appears, then no profile is created until the gate is passed.
3. Given a profile is tapped, when navigation completes, then that profile is active on every following screen (sticker book and progress belong to it).

### C2a. Profile create/edit — `/profiles/new`, `/profiles/[id]/edit` (parent-gated)

- **Hierarchy:** display name field (optional, used as caption only; max 20 chars; no surname prompt), age band (3, 4, 5, 6; used only to tune hint timing), "Arabic address style" not needed (prompts are gender-neutral, see 05 §4.3), Save, Cancel, Delete (edit only, with a confirm dialog).
- **Persistence:** creates `ChildProfile` with a random local id. No birth date, photo, email or location collected.
- Acceptance: (1) Given an empty name, when saved, then the profile is created with a default caption "Mariam"/"مريم". (2) Given Delete is confirmed, then the profile's attempts, evidence, stickers and avatar are removed (verified by store counts = 0). (3) Given the gate session expired, when Save is tapped, then the gate is shown again and no write occurs.

### C3. Character creator — `/avatar`

- **Entry:** first play of a new profile; from the map's avatar button. **Exit:** Save → previous screen (or `/welcome` on first run); Cancel → previous screen without changes.
- **Hierarchy:** live avatar preview (largest element, 50–60% of the short edge) → category tabs as icons (hair style, hair color, top, bottom/dress, shoes, accessory) → option swatches for the active category (6–8 per category, scrollable row) → Save (big tick) and Cancel (big cross).
- **Actions:** tap category, tap swatch (preview updates instantly, avatar does a small happy wiggle), tap Save/Cancel. "Random" dice button.
- **Audio:** entry: "يلا نختار شكلك! / Let's choose your look!" Category tap: category name ("شعر / Hair"). Swatch tap: soft pop. Color swatches say the color name (bonus vocabulary exposure, no evidence recorded).
- **States:** loading (avatar layers atlas, ≤ 1 s on reference device; shows default avatar silhouette); error (a layer fails to load → that option is hidden, others work); unsaved changes on back → Nono asks with two icons (tick = keep, cross = discard).
- **Persistence:** `AvatarConfig` saved on Save only. Draft kept in memory across rotation.
- **Layout:** P: preview top, tabs middle, swatches bottom. L: preview start half, tabs + swatches end half.
- **Back:** browser back = Cancel with the unsaved-changes prompt.
- **Accessibility:** swatches are a `radiogroup` per category; each has a name ("Curly hair", "Red") for adult screen-reader use; selected state shown with a thick outline + checkmark, not color alone.

Acceptance:
1. Given hair color "brown" is selected, when the preview renders, then hair layers use the brown tint and all layers stay aligned at shared pivots (visual snapshot).
2. Given the device rotates while choosing, when the layout changes, then the draft selection is unchanged.
3. Given Cancel, when returning to the map, then the saved avatar is the previous one.

### C4. Welcome — `/welcome`

- **Entry:** after profile selection. **Exit:** Play → `/map`; auto-advance never happens (child decides).
- **Hierarchy:** Nono (talking animation) beside the child's avatar → giant Play button → ear button.
- **Audio:** Nono greeting (≤ 6 s): "أهلاً! أنا نونو. يلا نلعب سوا! / Hi! I'm Nono. Let's play together!" Replays on ear tap.
- **States:** audio blocked → Nono shows a speech bubble with a sound icon and the ear button pulses; audio missing → Nono waves (visual cue) and Play still works.
- **Persistence:** none. **Layout:** P: Nono top, avatar middle, Play bottom. L: Nono and avatar side by side, Play end.
- **Back:** → `/profiles`.

Acceptance:
1. Given audio is unlocked, when the screen opens, then the greeting plays once and Nono's talking animation runs only while audio plays.
2. Given the child taps Play during the greeting, then the greeting stops and the map opens immediately.
3. Given the greeting clip is missing, then no error is shown to the child and Play works.

### C5. Magical world map — `/map`

- **Entry:** from welcome, world overview back, result "map", pause "map". **Exit:** tap a world hotspot → `/world/[id]`; sticker book icon → `/stickers`; avatar icon → `/avatar`; home → `/profiles`.
- **Hierarchy:** illustrated map (Phaser) with three animated destinations (Animal Forest trees sway, Color Town balloons bob, Number Island waves) → child's avatar standing near the last-visited world → small suggested-world sparkle (optional, never blocking) → top bar: home, sticker book, avatar → ear button.
- **Actions:** tap a world (avatar hops toward it, 600 ms, then navigates; second tap during the hop is ignored); drag-pan only when the map is wider than the viewport (P on narrow phones).
- **Tap vs drag:** a pointer that moves more than 12 px or lasts longer than 500 ms is a drag and never triggers a tap. Pan has inertia and clamps to edges; the three destinations are always reachable and initially framed (camera composition per orientation).
- **Audio:** entry: "نروح فين؟ / Where shall we go?" Hotspot tap: the world name, then a world SFX.
- **Content shown:** exactly the three playable worlds. No locked doors, no "coming soon" islands. Worlds hidden by the parent are simply not drawn.
- **States:** loading (map pack) with Nono flying; asset missing → a labelled color block hotspot so the world is still enterable; WebGL lost → Canvas renderer retry.
- **Persistence:** `lastWorldId` in session state.
- **Layout:** L: whole map visible, worlds left-to-right (mirrored order in RTL is not applied to geography; positions are fixed art). P: map scaled to fit height; if too narrow, camera starts centered on the suggested world and pans.
- **Back:** → `/welcome`.
- **Accessibility:** DOM hotspot mirror layer with buttons named by world; reduced motion stops ambient animation.

Acceptance:
1. Given a fresh profile, when the map loads, then all three worlds are tappable and none shows a lock.
2. Given the child drags 30 px starting on a world, when they release, then no navigation happens.
3. Given portrait 360×780 and landscape 780×360, when the map loads, then every hotspot's full hit area is inside the safe viewport or reachable by pan, and none overlaps the top bar.

### C6. World overview — `/world/[worldId]`

- **Entry:** from map; from level intro back; result "more in this world". **Exit:** tap level → `/level/[id]`; back → `/map`.
- **Hierarchy:** world scene banner → 4 level medallions (illustration of the level's main characters) in a gentle path → per-medallion indicators: sticker earned (small sticker badge), played-before (soft check) → suggestion sparkle on one medallion (optional).
- **Actions:** tap any medallion. All four always enabled.
- **Audio:** entry: world welcome line; medallion tap: level name.
- **States:** no progress → no badges (not empty-looking; illustrations carry it). Error loading one level's thumbnail → generic medallion, still playable.
- **Persistence:** reads completions for the active profile.
- **Layout:** P: vertical winding path; L: horizontal path. Medallions ≥ 120 px.
- **Back:** → `/map`.

Acceptance:
1. Given no levels completed, when the overview opens, then all four medallions are enabled and tapping level 4 opens its intro.
2. Given AF-01 was completed, then AF-01 shows the sticker badge and the others do not.
3. Given rotation, then the medallion order (1→4) is preserved and RTL mode reverses the path direction.

### C7. Level intro — `/level/[levelId]`

- **Entry:** from world overview; result "replay". **Exit:** Start → `/level/[id]/play`; back → `/world/[worldId]`.
- **Hierarchy:** illustration of the level's story moment with Nono → big Start (play triangle) → ear button → back.
- **Audio:** the level's narrative intro (≤ 12 s) stating the goal in child terms ("القطة والكلب مستخبيين! يلا ندوّر عليهم / Cat and Dog are hiding! Let's find them").
- **States:** level assets still downloading → Start shows a fill progress; offline and the level pack not cached → Nono shows a cloud icon and suggests another level (parent caption "This level isn't downloaded yet"); a cached level always starts.
- **Persistence:** if an `activeSession` exists for this level and the content version matches, the Start button shows a "continue" icon and resumes; a small "start over" icon is beside it.
- **Layout:** P: illustration top, Start bottom. L: illustration start, Start end.

Acceptance:
1. Given the level pack is cached, when Start is tapped offline, then gameplay begins.
2. Given an unfinished session for this level, when the intro opens, then Start resumes at the same activity and step.
3. Given the intro audio is playing, when Start is tapped, then the intro stops and gameplay audio starts without overlap.

### C8. Gameplay shell — `/level/[levelId]/play`

- **Hierarchy (z-order bottom→top):** Phaser activity scene → Nono (corner, animated state) → React HUD: pause (top-end), ear button (top-start), help (lightbulb, top-start next to ear), activity progress dots (top-center, one dot per activity; no score) → overlays (pause, help, speaking panel, feedback toasts are in-scene).
- **Actions:** activity interactions; pause; help; ear.
- **Audio:** each activity's instruction on entering `ready`; feedback audio; music bed ducked under voice.
- **Consistent feedback:** correct = sparkle + chime + Nono celebrate + spoken praise; not yet = gentle wobble of the tapped item + soft "boop" + Nono "helping" + encouraging line; never a buzzer, red X or sad face.
- **States:** loading activity (≤ 1.5 s target; Nono "thinking"); asset missing (placeholder object labelled with icon, activity still completable); audio unavailable (visual instruction animation plays: a hand demonstrates); recoverable error → skip that activity and continue; backgrounded → auto-pause, resumes into the pause menu.
- **Persistence:** activity snapshot at boundaries and on `visibilitychange`.
- **Layout:** Scene layouts per mechanic define P and L anchor sets (04 §7). HUD stays inside safe areas.
- **Back:** browser back opens pause.

Acceptance:
1. Given an activity is mid-way (2 of 3 items found), when the device rotates, then 2 items stay found, the instruction is not replayed automatically, and all targets are inside the viewport.
2. Given the app is sent to background, when it returns, then the pause menu is shown and no audio played while hidden.
3. Given the activity's instruction audio fails to load, when the activity starts, then the demonstration hand animation plays and the activity is completable.

### C9. Speaking activity panel (inside gameplay)

- **Hierarchy:** target picture (large) → "listen" button (speaker, plays model clip) → record button (big red-free mic button, 112 px; pulsing ring while recording) → recording indicator (animated sound bars driven by live input level + elapsed ring up to the 5 s limit) → after recording: "hear me" button (plays the child's own recording) and "again" button → skip (always visible, arrow icon).
- **Flow:** model plays automatically once → Nono "listening" pose → child taps mic → (first time only, if permission unknown and the parent has enabled the mic) the browser prompt appears after Nono explains with an icon → recording up to 5 s or tap again to stop → processing (≤ 300 ms local VAD) → feedback.
- **Audio:** model clip; "your turn" cue; start/stop record chimes; feedback lines by outcome (06 §7).
- **States (mirrors mic state machine, 06 §5):** unsupported / mic disabled by parent / denied → panel shows "say it out loud with Nono" mode: Nono says the word, pauses 3 s with a listening animation, then praises the try *without* claiming to have heard it; the activity completes as `prompt_only`. Timed out / cancelled / recoverable error → Nono "let's try again" + skip stays available.
- **Privacy:** a red-dot-free but unmistakable recording indicator (pulsing ring + Nono's ear glowing); the browser's own indicator also shows. Recording blob is kept in memory only until the child leaves the activity.
- **Layout:** P: picture top, controls bottom row. L: picture start, controls column end.

Acceptance:
1. Given mic permission is granted, when the child taps mic and speaks, then a real recording plays back on "hear me" (verified with a fake media stream in E2E and manually on device).
2. Given permission is denied, when the activity runs, then no recording UI claims to be listening; the "say it with Nono" mode runs and skip works.
3. Given the child leaves mid-recording (pause → map), then all `MediaStreamTrack`s are stopped (browser indicator off) and the blob URL is revoked.

### C10. Level result — `/level/[levelId]/result`

- **Hierarchy:** celebration animation (confetti, or a gentle glow under reduced motion) → earned sticker flying into a book icon → Nono celebrate → three big buttons: replay (circular arrow), next suggestion (the medallion image of a suggested level), map.
- **Audio:** celebration jingle (≤ 3 s), Nono praise naming what was learned ("عرفنا القطة والكلب! / We met Cat and Dog!").
- **Rules:** same celebration whether activities were skipped or not (no stars-for-score); the sticker is granted on the first completion only, replays show "you have this sticker" with a smaller sparkle; no "you missed" messaging.
- **States:** completion write failed → still celebrate; retry write in background; show parent banner if it fails again. Refresh on this route → re-reads the completion; does not grant again.
- **Layout:** P: stacked; L: celebration start, buttons end.

Acceptance:
1. Given the level is completed for the first time, then exactly one `StickerGrant` exists for that profile and sticker.
2. Given the result page is refreshed twice, then the sticker count is unchanged.
3. Given the child skipped two activities, then the result shows the same celebration and no negative wording.

### C11. Sticker book — `/stickers`

- **Hierarchy:** book with pages per world → earned stickers in full color, unearned shown as a soft outline of the level's medallion (shows where it comes from, not a "missing" scarcity cue) → tap a sticker to enlarge, hear its name, and see a short animation → "play this level" button on the enlarged sticker.
- **Rules:** no counts like "3/12 collected", no rarity, no timers, no purchasing.
- **Audio:** page turn SFX; sticker name.
- **States:** none earned → Nono suggests a world ("let's play to find stickers").
- **Layout:** P: one page; L: two-page spread.

Acceptance:
1. Given 2 stickers earned, then exactly those 2 are in color.
2. Given an enlarged sticker, when "play this level" is tapped, then its level intro opens.
3. Given no stickers, then the empty state is friendly and has a working path to the map.

### C12. Pause menu (overlay)

- **Hierarchy:** dimmed scene → card with 4 large buttons: resume (play), restart activity (circular arrow), map (map icon), sound (speaker; cycles all on → music off → all off).
- **Behaviour:** pausing pauses the controller (`PAUSE` event), audio (`suspend`), Phaser scene, timers, and cancels an in-progress recording. Resume restores state and replays the instruction only if it was interrupted.
- **Opened by:** pause button, browser back, `visibilitychange: hidden`, orientation change mid-drag (drag is cancelled and the item snaps back; the pause is not forced by rotation otherwise).

Acceptance:
1. Given a drag in progress, when the app is backgrounded, then the dragged item returns to its start and the menu shows on return.
2. Given restart activity, then the activity state resets but level progress and earned rewards are unchanged.
3. Given sound is set to "all off", then no clip plays until it is changed, including on the next level.

### C13. Help overlay

- **Hierarchy:** the current target area is spotlighted; an animated hand demonstrates the action (tap, drag path, count each item); Nono repeats the instruction with a simpler phrasing.
- **Progressive hints:** level 1 = repeat instruction; level 2 = point/glow at the correct region; level 3 = hand demonstration on the actual target. Hint level also rises automatically after 2 "not yet" attempts or 12 s of no interaction (age-tuned: 15 s for age 3).
- **Rules:** hints never complete the activity for the child; evidence records the hint level used.

Acceptance:
1. Given help is tapped three times, then hints step 1 → 2 → 3 and the third shows the hand on the correct target.
2. Given no interaction for 12 s, then hint level 1 plays once (not repeatedly every 12 s; next auto-hint after another 12 s at most twice).
3. Given reduced motion, then the hand demonstration still plays at reduced amplitude.

---

## Parent-facing screens

### P1. Parent gate — `/parent`

- **Purpose:** deter children from entering adult settings. It is not security; the plan says so in the parent copy.
- **Design:** step 1 — press and hold a button for 2 s (children often stop early); step 2 — a written instruction in the parent's language, randomized ("Tap the blue circle, then the yellow star") among 6 shapes; or, if a parent PIN is set, enter the 4-digit PIN. Arithmetic is not used alone. After 3 failures, a 30 s cool-down with a neutral message.
- **First run (`?setup=1`):** welcome text, privacy summary, microphone choice (off / record-only-on-device; recognition is not offered unless a provider is configured), language mode, optional PIN, then create the first profile.
- **Exit:** success → requested parent route; cancel → back to the child screen it came from.
- **States:** wrong → shake and a new challenge; cool-down; session expired.

Acceptance:
1. Given a child taps randomly, when 50 random taps are simulated, then the gate does not open (probabilistic test, fixed seed).
2. Given a PIN is set, when the correct PIN is entered, then the dashboard opens and the session expires after 10 min idle.
3. Given the gate is opened from the "+" profile card, when passed, then `/profiles/new` opens (not the dashboard).

### P2. Dashboard summary — `/parent/dashboard`

- **Content:** per-child cards: last played, levels played (count of distinct levels with ≥ 1 completion), recent time played this week (from session records), skills "encountered / practiced / demonstrated" counts, speaking practice tries (attempted, not "correct"), banners (storage fallback, offline cache incomplete).
- **Actions:** open progress, settings sections, switch child.
- **Empty:** "No play yet" with a hint to hand the device to the child.

Acceptance: (1) Given no attempts, then every metric shows "—" or 0 with plain wording, no invented numbers. (2) Given 3 completed levels in 2 worlds, then "levels played" = 3. (3) Given speech attempts with VAD voice detected, then they appear as "speaking tries", never as "correct pronunciations".

### P3. Learning progress — `/parent/progress`

- **Content:** by world → by skill: status (not started / introduced / practicing / demonstrated-hypothesis), needs-review flag, the evidence behind it ("Chose 'cat' correctly 4 of 5 times across 3 days, 1 with a hint"), last practiced date, and a note that the thresholds are estimates.
- **Actions:** expand a skill to see recent evidence; open the related level.

Acceptance: (1) Given one correct answer, then the skill is "practicing", not "demonstrated". (2) Given only speech attempts for a vocabulary skill, then the skill is not "demonstrated". (3) Given evidence across devices is impossible (local only), the page states data is from this device only.

### P4. Voice and microphone — `/parent/voice`

- **Content:** microphone use toggle (default off until the parent chooses at setup), explanation of what is recorded, where it goes (nowhere; memory only), how long (until the child leaves the activity), test-microphone button with live level meter and playback, browser permission status and how to reset it per browser, speech recognition toggle (only shown when a provider is configured; shows the vendor, what is sent and retention).
- **Acceptance:** (1) Given mic off, then speaking activities run in "say it with Nono" mode and `getUserMedia` is never called (spy). (2) Given the parent tests the mic, then a 3 s recording plays back and is discarded. (3) Given recognition is not configured, then no recognition toggle appears.

### P5. Language mode and voice preferences — `/parent/language`

- **Content:** mode (العربية / English / Mixed), mixed-mode ratio preset (Arabic-first with English target words; later presets roadmap), digits style in Arabic mode (Eastern Arabic ١٢٣ or Western 123), Nono voice volume vs music volume, speech rate (normal / slower, uses pre-produced slow variants only where they exist, otherwise playback rate 0.9).
- **Acceptance:** (1) Given English, then UI is LTR and prompts play English clips. (2) Given Mixed, then AF-01 prompts play Arabic carrier + English target word sequences. (3) Given the change, then the child area updates without reload and the current activity keeps its state.

### P6. Session duration and break reminders — `/parent/session`

- **Content:** reminder off / 10 / 15 / 20 / 30 min (default 20); behaviour: at the next activity boundary after the limit, Nono yawns and suggests a break with a "rest" animation; the child can continue (no lock) unless the parent enables "end session at limit", which returns to profiles at a level boundary, never mid-activity.
- **Acceptance:** (1) Given 15 min set, when 15 min of play pass mid-activity, then nothing interrupts until the activity ends. (2) Given "end session" off, then the child can dismiss the break suggestion. (3) Given the app was backgrounded, then background time does not count.

### P7. Privacy and data — `/parent/privacy`

- **Content:** plain-language summary of what is stored on this device, per-store counts, export (JSON file download of the selected child or all; includes no audio because none is stored), delete one child's data, delete everything (double confirm), clear offline cache, versions (app, content, schema).
- **Acceptance:** (1) Given delete-all is confirmed, then all IndexedDB stores are empty and the app returns to first-run setup. (2) Given export, then the file validates against the export schema and contains no audio. (3) Given an export file, then it contains no data for other profiles when a single child is selected.

### P8. Content controls — `/parent/content`

- **Content:** world visibility toggles (hides a world from the child's map; does not lock or gate anything else), reduced motion (system / on / off), music on/off and volume, SFX on/off and volume, hint timing (age-based default / slower / faster), help hand demonstrations on/off.
- **Acceptance:** (1) Given Number Island hidden, then the map shows two worlds and the sticker book still shows earned Number Island stickers. (2) Given reduced motion on, then no parallax/confetti runs (checked through the `prefers-reduced-motion` emulation and the setting). (3) Given all worlds hidden, then the setting refuses to save and explains that at least one world must be visible.

### P9. Manage profiles — `/parent/profiles`

- List, rename, reset avatar, delete; links to C2a. Acceptance follows C2a.
