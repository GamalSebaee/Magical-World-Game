# 05a — Level Catalog (12 MVP levels)

Common to every level (not repeated below):
- **Open access:** selectable from first launch; `suggestedNext` only adds a sparkle.
- **Success:** every activity reaches `completed` or `skipped`. **Skip:** always available per activity; a skipped activity records `skipped` evidence and does not change the reward.
- **Events:** `activity.started/interaction/evaluated/completed/skipped` per activity, `speech.attempt` for speaking, `level.completed` once per completion, `reward.granted` once per profile and sticker.
- **Reward:** one sticker `sticker.<levelId>`; first completion only.
- **Common QA steps** (run in addition to the level's own script): play in `ar`, `en`, `mixed`; rotate once mid-activity; background and return once; skip one activity; replay the level and confirm no second sticker; play offline after caching.
- Arabic lines are gender-neutral (first-person plural or neutral praise; 05 §4.3). English lines are shown as their equivalents, not literal translations. All lines are drafts pending native review.

Asset keys: `animals/*`, `forest/*`, `town/*`, `island/*`, `objects/*`, `shapes/*`, `numerals/*`, `scenes/*`, `stickers/*`. Audio counts are per language.

---

## Animal Forest (غابة الحيوانات)

### AF-01 Meet Cat & Dog

- **Story:** Cat and Dog are playing hide-and-seek; Nono and the child find them, learn their names and say hello.
- **Goal:** hear and recognise «قطة / cat» and «كلب / dog»; try saying "cat".
- **Skills:** `vocab.animals.cat`, `vocab.animals.dog`, `speak.vocab.cat`.
- **Activities:**
  1. `tap_discover` — cat behind a bush, dog behind a tree. Reveal says the word.
  2. `listen_choose` — 2 rounds: "فين الكلب؟ / Where's the dog?", "فين القطة؟ / Where's the cat?" (2 choices).
  3. `speak_repeat` — model «قطة / cat», record, hear yourself.
- **Key dialogue:** intro "القطة والكلب بيلعبوا استغماية… يلا ندوّر عليهم! / Cat and Dog are playing hide-and-seek… let's find them!"; reveal "دي قطة! / It's a cat!"; praise "برافو! / Well done!"; outro "عرفنا القطة والكلب! / We met Cat and Dog!".
- **Assets:** `scenes/af-01-intro`, `forest/bg-clearing`, `forest/bush`, `forest/tree`, `animals/cat` (idle, peek, happy), `animals/dog` (idle, hop, happy), `stickers/af-01-cat-dog`. Audio ≈ 20 clips.
- **Full definition:** [`examples/af-01.level.json`](examples/af-01.level.json).
- **QA script:** (1) Tap the bush 5× fast → one reveal, cat word once. (2) Tap the tree → dog revealed → activity completes. (3) Round 1: tap cat → cat says "that's the cat", prompt repeats → tap dog → praise. (4) Speaking: deny mic → "say it with Nono" mode → complete. (5) Repeat with mic allowed → record 2 s of speech → "hear me" plays it → continue. (6) Result shows the sticker; refresh result → still one sticker.

### AF-02 Rabbit & Carrot

- **Story:** Rabbit is hungry; the child feeds Rabbit carrots from the garden.
- **Goal:** «أرنب / rabbit», «جزرة / carrot»; count 1–3 by dragging.
- **Skills:** `vocab.animals.rabbit`, `vocab.food.carrot`, `math.count.upto3`.
- **Activities:**
  1. `tap_discover` (sequence) — rabbit pops out of a burrow; carrots pop from soil. (Introduces both words.)
  2. `drag_drop` (`count_placed`, n = 2) — "نِدّي الأرنب جزرتين / Let's give Rabbit 2 carrots"; each carrot dragged into Rabbit's basket is counted aloud.
  3. `count_objects` (`tap_n`, target 3) — tap carrots in the garden to send them to the basket; 5 available.
- **Key dialogue:** "الأرنب جعان! / Rabbit is hungry!"; counting "واحد… اتنين… / one… two…"; "كده تلاتة! / That's three!"; outro "الأرنب شبعان! شكراً! / Rabbit is full! Thank you!".
- **Assets:** `forest/bg-garden`, `forest/burrow`, `animals/rabbit` (idle, eat, happy), `objects/carrot`, `objects/basket`, `stickers/af-02-rabbit`. Audio ≈ 22.
- **Success:** basket has exactly the target; extra carrots after the target bounce off gently.
- **QA:** (1) Drop a carrot 30 px outside the basket → accepted (magnet). (2) Drop a 4th carrot when target 3 is reached → rejected kindly, count stays 3. (3) Rotate mid-drag → carrot returns home, count unchanged.

### AF-03 Animal Sounds

- **Story:** The forest choir has mixed up its voices; the child helps each animal find its sound.
- **Goal:** link sounds to animals (cat, dog, cow, duck); new words «بقرة / cow», «بطة / duck».
- **Skills:** `listen.sounds.{cat,dog,cow,duck}`, `vocab.animals.{cow,duck}`, `speak.vocab.cow`.
- **Activities:**
  1. `listen_choose` — plays a sound ("مين بيقول موو؟ / Who says moo?"), 3 animal choices; 3 rounds.
  2. `match_pairs` — 4 animals ↔ 4 sound-icon cards (each card plays its sound when tapped).
  3. `speak_repeat` (optional feel; skip is prominent) — «بقرة / cow».
- **Key dialogue:** "نسمع! / Let's listen!"; "البطة بتقول كواك كواك! / Duck says quack quack!".
- **Assets:** `forest/bg-stage`, `animals/cow`, `animals/duck` (+ cat, dog), `ui/sound-card`, SFX `sfx/animal-{cat,dog,cow,duck}` (licensed or recorded, see 07), `stickers/af-03-choir`. Audio ≈ 24 + 4 animal SFX.
- **QA:** (1) Tap each sound card → its sound plays, no overlap (new tap stops previous). (2) Match cow ↔ moo → locked. (3) Mute SFX in parent settings → sound cards show an animated sound-wave and the animal mouth animation instead (visual alternative); activity still completable.

### AF-04 Forest Adventure

- **Story:** Nono's map blew away; the child walks the forest path, meeting the animals, who each help find a piece of the map.
- **Goal:** mixed review of AF-01..03 vocabulary, sounds and counting to 3.
- **Skills:** `vocab.animals.{cat,dog,rabbit,cow,duck,bird}`, `listen.sounds.dog`, `math.count.upto3`, `speak.vocab.dog`.
- **Activities:**
  1. `tap_discover` (sequence) — follow footprints; tap the animal that appears (introduces `bird` «عصفورة»).
  2. `listen_choose` — "مين بيقول هو هو؟ / Who says woof?" then "فين الأرنب؟ / Where's the rabbit?" (3 choices).
  3. `count_objects` `how_many` — count 3 map pieces in the bird's nest; choose 2 / 3.
  4. `speak_repeat` — «كلب / dog» to thank Dog.
- **Assets:** `forest/bg-path` (parallax 2 layers), `animals/bird`, `objects/map-piece`, `objects/nest`, `stickers/af-04-map`. Audio ≈ 26.
- **QA:** (1) Complete with all four activities skipped → result celebrates, sticker granted. (2) Resume after refresh in activity 3 → same objects, counted ones still counted. (3) Mixed mode: prompts use Arabic carrier and English target word.

---

## Color Town (مدينة الألوان)

### CT-01 Red, Blue, Yellow

- **Story:** The painter's paint pots have lost their colors; touching things in town brings colors back.
- **Goal:** «أحمر / red», «أزرق / blue», «أصفر / yellow».
- **Skills:** `color.identify.{red,blue,yellow}`.
- **Activities:**
  1. `tap_discover` — tap a grey apple, sea, and sun; each fills with its color and Nono says the color.
  2. `listen_choose` — "فين الحاجة الحمرا؟ / Where's something red?" 3 rounds, 3 choices (balloon colors).
- **Assets:** `town/bg-square`, `objects/{apple,sea,sun,balloon-red,balloon-blue,balloon-yellow}`, `stickers/ct-01-paint`. Audio ≈ 18.
- **Accessibility note:** colors are never the only cue in feedback (shapes/objects differ too); choices use distinct objects, and colorblind-safe hues (07 §2).
- **QA:** (1) Grayscale emulation: each choice remains distinguishable by object shape. (2) Wrong pick → that balloon says its color. (3) English mode uses LTR layout and English color clips.

### CT-02 Color Matching

- **Story:** The toy shop's toys fell out of their color boxes.
- **Goal:** sort objects into same-color containers.
- **Skills:** `color.identify.{red,blue,yellow}`.
- **Activities:**
  1. `drag_drop` — 3 toys into 3 colored boxes (one each).
  2. `drag_drop` — 6 toys (2 per color) into 3 boxes; accepts by tag `color:*`.
- **Assets:** `town/bg-toyshop`, `objects/{ball,car,block,duck-toy,star,cup}-{red,blue,yellow}`, `objects/box-{red,blue,yellow}`, `stickers/ct-02-toys`. Audio ≈ 16.
- **QA:** (1) Drop red ball in blue box → snapback, "الكورة دي حمرا / This ball is red". (2) Tap-then-tap alternative input completes the activity. (3) Two-finger simultaneous drags → only the first is active.

### CT-03 Shapes & Colors

- **Story:** The town's windows are shaped like circles, squares and triangles; help the shapes find their windows.
- **Goal:** «دائرة / circle», «مربع / square», «مثلث / triangle», combined with color.
- **Skills:** `shape.identify.{circle,square,triangle}`, `color.identify.{red,blue,yellow}`, `speak.vocab.circle`.
- **Activities:**
  1. `listen_choose` — "فين الدايرة؟ / Where's the circle?" (3 shapes, same color).
  2. `match_pairs` — 3 colored shapes ↔ matching outlines (same shape and color).
  3. `speak_repeat` (optional) — «دائرة / circle».
- **Assets:** `town/bg-street`, `shapes/{circle,square,triangle}-{red,blue,yellow}`, `shapes/outline-*`, `stickers/ct-03-shapes`. Audio ≈ 18.
- **QA:** (1) Match a red circle to the blue circle outline → no match (both color and shape must match), hint names both. (2) Speaking skipped → level still completes. (3) Rotation in match_pairs → selection state preserved.

### CT-04 Rainbow Rescue

- **Story:** A storm washed the rainbow out; the child brings each color back, adding green.
- **Goal:** review red/blue/yellow; introduce «أخضر / green»; creative arranging.
- **Skills:** `color.identify.{red,blue,yellow,green}`, `speak.vocab.red`.
- **Activities:**
  1. `tap_discover` (sequence) — tap clouds to release color drops in rainbow order.
  2. `drag_drop` — drag 4 color drops onto the rainbow's matching bands.
  3. `speak_repeat` — «أحمر / red» to "turn on" the rainbow.
- **Creative element:** after completion, the child can tap the rainbow to make it play notes (no evaluation). This is free play and records no evidence.
- **Assets:** `town/bg-sky`, `objects/{cloud,drop-*,rainbow-band-*}`, `stickers/ct-04-rainbow`. Audio ≈ 20.
- **QA:** (1) All four bands filled → rainbow animation (fade under reduced motion). (2) Free-play taps do not create attempts (store count unchanged). (3) Offline: plays fully after caching.

---

## Number Island (جزيرة الأرقام)

### NI-01 Numbers 1–3

- **Story:** Shells wash up on the beach; the child counts them for Crab.
- **Goal:** count 1–3; hear and recognise numerals 1–3.
- **Skills:** `math.count.upto3`, `math.numeral.{1,2,3}`, `speak.vocab.num3`.
- **Activities:**
  1. `count_objects` `how_many` — 2 shells; choose 1 / 2.
  2. `count_objects` `how_many` — 3 shells; choose 2 / 3.
  3. `listen_choose` — "فين رقم تلاتة؟ / Where's number 3?" (numeral cards 1/2/3 with dot patterns).
  4. `speak_repeat` — «تلاتة / three».
- **Assets:** `island/bg-beach`, `animals/crab`, `objects/shell`, `numerals/{1,2,3}` (both glyph styles), `stickers/ni-01-shells`. Audio ≈ 22 (numbers 1–5 shared).
- **QA:** (1) Tap one shell 4× → count stays 1. (2) Arabic mode with Eastern digits → cards show ١ ٢ ٣; switch to Western → 1 2 3 without reload. (3) Picking 2 for 3 shells → recount with highlights.

### NI-02 Numbers 1–5

- **Story:** Fish in the lagoon need to go home to their coral.
- **Goal:** count to 5; drag a specified number.
- **Skills:** `math.count.upto5`, `math.numeral.{4,5}`.
- **Activities:**
  1. `count_objects` `how_many` — 4 fish; choose 3 / 4 / 5.
  2. `drag_drop` (`count_placed`, n = 5) — "ندخّل ٥ سمكات البيت / Let's put 5 fish in their home" from 6.
  3. `count_objects` `how_many` — 5 starfish; choose 4 / 5.
- **Assets:** `island/bg-lagoon`, `animals/fish`, `objects/{coral-home,starfish}`, `numerals/{4,5}`, `stickers/ni-02-fish`. Audio ≈ 18.
- **QA:** (1) Rapid taps on 5 fish in under 1 s → spoken 1–5 in order, no skipped number. (2) 6th fish rejected after target. (3) Background mid-count → resume restores the counted set.

### NI-03 More or Less

- **Story:** Two monkeys share bananas; the child spots who has more and who has fewer.
- **Goal:** compare small groups; «أكتر / more», «أقل / fewer».
- **Skills:** `math.compare.more_less`, `math.count.upto5`.
- **Activities:**
  1. `listen_choose` — "مين عنده موز أكتر؟ / Who has more bananas?" 3 rounds (differences 3, 2, 2; e.g. 1 vs 4, 2 vs 4, 3 vs 5).
  2. `listen_choose` — "مين عنده أقل؟ / Who has fewer?" 2 rounds.
  3. `match_pairs` — group of n bananas ↔ numeral n (n = 1, 3, 5).
- **Assets:** `island/bg-palms`, `animals/monkey-{a,b}`, `objects/banana`, `stickers/ni-03-monkeys`. Audio ≈ 18.
- **Design note:** groups use the same banana size and spacing so area does not cue "more" incorrectly.
- **QA:** (1) Wrong choice → both groups count aloud with highlights. (2) Layout P/L keeps both groups fully visible. (3) Hint level 3 dims the wrong group.

### NI-04 Treasure Counting

- **Story:** Pirate Parrot hid a treasure chest; the child follows numbered clues to open it.
- **Goal:** integrated review: counting, numerals, dragging, finding.
- **Skills:** `math.count.upto5`, `math.numeral.{1..5}`, `math.compare.more_less`.
- **Activities:**
  1. `tap_discover` (sequence) — tap 3 clue rocks in order 1→2→3 (numerals on rocks).
  2. `count_objects` `how_many` — count gold coins (4); choose 3/4/5.
  3. `drag_drop` (`count_placed`, n = 5) — put 5 jewels in the chest to unlock it.
- **Assets:** `island/bg-cove`, `animals/parrot`, `objects/{rock-numeral-*,coin,jewel,chest}`, `stickers/ni-04-treasure`. Audio ≈ 24.
- **QA:** (1) Tap rock 3 before rock 1 → rock 3 wiggles, "نبدأ برقم واحد / Let's start with number 1". (2) Chest opens only at 5. (3) Full playthrough in landscape, rotate to portrait in activity 3 → jewels in chest stay.

---

## Totals and production estimate

| | Levels | Activities | Distinct vocabulary/skills | Voice clips per language (approx.) |
|-|--------|------------|----------------------------|-------------------------------------|
| Animal Forest | 4 | 13 | 7 words, 4 sounds, count to 3 | ≈ 92 |
| Color Town | 4 | 10 | 4 colors, 3 shapes | ≈ 72 |
| Number Island | 4 | 13 | numbers 1–5, more/less | ≈ 82 |
| Shared (Nono praise/hints, UI, screens, numbers) | | | | ≈ 60 |
| **Total** | **12** | **36** | | **≈ 300 per language, plus mixed-mode carriers ≈ 60** |
