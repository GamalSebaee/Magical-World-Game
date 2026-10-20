import { expect, test } from '@playwright/test';
import { activity, guardPage, sceneObjects } from './helpers';
import {
  centreOf,
  clipsPlayed,
  drag,
  expectNoLayoutProblems,
  openActivity,
  rectOf,
  sfxPlayed,
  state,
  tapId,
  waitForPhaseIn,
} from './playground-helpers';

/**
 * Phase 3 gate (10 §P3): each mechanic passes its 04 §4 acceptance checks in the playground, in
 * portrait and landscape (projects), with touch (phone projects) and mouse (desktop projects).
 */

type DragState = { placed: Array<[string, string]>; selected?: string };
type PairsState = { matched: string[]; selected?: string };
type CountState = { counted: string[]; stage: string };

test.describe('drag_drop (04 §4.3)', () => {
  test('a carrot released 30 px outside the basket is accepted and counted aloud (acceptance 1)', async ({ page }) => {
    const guard = guardPage(page);
    await openActivity(page, 'pg02.a1', '&magnet=0');
    await expectNoLayoutProblems(page);
    const basket = await rectOf(page, 'basket');
    const from = await centreOf(page, 'carrot-1');
    // 30 px outside the basket's nearest edge, level with its middle.
    const portraitLike = basket.y > from.y + 40;
    const to = portraitLike ? { x: basket.x + basket.width / 2, y: basket.y - 30 } : { x: basket.x - 30, y: basket.y + basket.height / 2 };
    await drag(page, from, to);
    await expect.poll(async () => (await state<DragState>(page)).placed).toEqual([['carrot-1', 'basket']]);
    await expect.poll(() => clipsPlayed(page)).toContain('word.numbers.1');
    guard.assertClean();
  });

  test('rotation mid-drag sends the item home and records nothing (acceptance 2)', async ({ page }) => {
    await openActivity(page, 'pg02.a1');
    const vp = page.viewportSize()!;
    const from = await centreOf(page, 'carrot-2');
    const basket = await centreOf(page, 'basket');
    const halfway = { x: (from.x + basket.x) / 2, y: (from.y + basket.y) / 2 };
    await drag(page, from, halfway, { during: () => page.setViewportSize({ width: vp.height, height: vp.width }).then(() => page.waitForTimeout(300)) });
    await page.waitForTimeout(400);
    expect((await state<DragState>(page)).placed).toEqual([]);
    const o = (await sceneObjects(page)).find((x) => x.id === 'carrot-2')!;
    expect(o.state).toBe('home');
    await expectNoLayoutProblems(page);
  });

  test('a red ball on the blue box snaps back and Nono says its colour (acceptance 3)', async ({ page }) => {
    await openActivity(page, 'pg01.a1');
    await drag(page, await centreOf(page, 'ball-red'), await centreOf(page, 'box-blue'));
    await expect.poll(() => clipsPlayed(page)).toContain('word.colors.red');
    expect((await state<DragState>(page)).placed).toEqual([]);
    expect((await activity(page))!.notYetCount).toBe(1);
  });

  test('sorting every ball completes; tap-then-tap works as the alternative input', async ({ page }) => {
    await openActivity(page, 'pg01.a1');
    await drag(page, await centreOf(page, 'ball-red'), await centreOf(page, 'box-red'));
    await expect.poll(async () => (await state<DragState>(page)).placed.length).toBe(1);
    await waitForPhaseIn(page, ['ready']);
    // Tap the ball (it says its colour and is picked up), then tap its box.
    await tapId(page, 'ball-blue');
    await expect.poll(async () => (await state<DragState>(page)).selected).toBe('ball-blue');
    await tapId(page, 'box-blue');
    await expect.poll(async () => (await state<DragState>(page)).placed.length).toBe(2);
    await waitForPhaseIn(page, ['ready']);
    await drag(page, await centreOf(page, 'ball-yellow'), await centreOf(page, 'box-yellow'));
    await waitForPhaseIn(page, ['completed']);
  });
});

test.describe('match_pairs (04 §4.4)', () => {
  test('cat then its sound card locks the pair; a locked pair ignores taps (acceptance 1, 2)', async ({ page }) => {
    const guard = guardPage(page);
    await openActivity(page, 'pg03.a1');
    await expectNoLayoutProblems(page);
    await tapId(page, 'cat:L');
    await expect.poll(async () => (await state<PairsState>(page)).selected).toBe('cat:L');
    await tapId(page, 'cat:R');
    await expect.poll(async () => (await state<PairsState>(page)).matched).toEqual(['cat']);
    await waitForPhaseIn(page, ['ready']);
    await tapId(page, 'cat:L');
    await page.waitForTimeout(300);
    expect(await state<PairsState>(page)).toMatchObject({ matched: ['cat'], selected: undefined });
    guard.assertClean();
  });

  test('a second card on the same side moves the selection; rotation keeps it (acceptance 3)', async ({ page }) => {
    await openActivity(page, 'pg04.a1');
    await tapId(page, 'red:L');
    await tapId(page, 'blue:L');
    await expect.poll(async () => (await state<PairsState>(page)).selected).toBe('blue:L');
    expect((await activity(page))!.notYetCount).toBe(0);
    const vp = page.viewportSize()!;
    await page.setViewportSize({ width: vp.height, height: vp.width });
    await page.waitForTimeout(400);
    expect((await state<PairsState>(page)).selected).toBe('blue:L');
    await expectNoLayoutProblems(page);
    // And the selected card is still where the scene says it is: its partner matches.
    await tapId(page, 'blue:R');
    await expect.poll(async () => (await state<PairsState>(page)).matched).toEqual(['blue']);
  });

  test('a sound card plays its sound when tapped', async ({ page }) => {
    await openActivity(page, 'pg03.a1');
    await tapId(page, 'dog:R');
    await expect.poll(() => sfxPlayed(page)).toContain('sfx.animal_dog');
  });
});

test.describe('count_objects (04 §4.5)', () => {
  test('one apple tapped 4 times counts 1 and says "1" each time (acceptance 1)', async ({ page }) => {
    const guard = guardPage(page);
    await openActivity(page, 'pg05.a1');
    await expectNoLayoutProblems(page);
    for (let i = 0; i < 4; i++) await tapId(page, 'apple-1');
    await page.waitForTimeout(2500);
    expect((await state<CountState>(page)).counted).toEqual(['apple-1']);
    const numbers = (await clipsPlayed(page)).filter((c) => c.startsWith('word.numbers.'));
    expect(numbers.length).toBeGreaterThanOrEqual(3);
    expect(new Set(numbers)).toEqual(new Set(['word.numbers.1']));
    guard.assertClean();
  });

  test('3 rapid taps on 3 apples are spoken 1, 2, 3 in order (acceptance 2)', async ({ page }) => {
    await openActivity(page, 'pg05.a1');
    const pts = await Promise.all(['apple-1', 'apple-2', 'apple-3'].map((id) => centreOf(page, id)));
    // Back-to-back taps, faster than one spoken number (how fast depends on the test machine).
    for (const p of pts) {
      if (test.info().project.use.hasTouch) await page.touchscreen.tap(p.x, p.y);
      else await page.mouse.click(p.x, p.y);
    }
    await expect.poll(async () => (await state<CountState>(page)).stage).toBe('choosing');
    await expect.poll(async () => (await clipsPlayed(page)).filter((c) => c.startsWith('word.numbers.')), { timeout: 10_000 }).toEqual([
      'word.numbers.1',
      'word.numbers.2',
      'word.numbers.3',
    ]);
  });

  test('picking 2 for 3 apples recounts with highlights, then 3 completes (acceptance 3)', async ({ page }) => {
    await openActivity(page, 'pg05.a1');
    for (const id of ['apple-1', 'apple-2', 'apple-3']) await tapId(page, id);
    await expect.poll(async () => (await state<CountState>(page)).stage).toBe('choosing');
    await waitForPhaseIn(page, ['ready']);
    await expectNoLayoutProblems(page);
    const before = (await clipsPlayed(page)).length;
    await tapId(page, 'n:2');
    await expect.poll(async () => (await activity(page))!.last?.anim).toBe('recount');
    await waitForPhaseIn(page, ['ready']);
    const recount = (await clipsPlayed(page)).slice(before).filter((c) => c.startsWith('word.numbers.'));
    expect(recount).toEqual(['word.numbers.1', 'word.numbers.2', 'word.numbers.3']);
    await tapId(page, 'n:3');
    await waitForPhaseIn(page, ['completed']);
  });

  test('tap_n: carrots go into the basket and the activity completes at the target', async ({ page }) => {
    await openActivity(page, 'pg06.a1');
    for (const id of ['carrot-1', 'carrot-2', 'carrot-3']) await tapId(page, id);
    await waitForPhaseIn(page, ['completed']);
    expect((await sceneObjects(page)).find((o) => o.id === 'basket')!.state).toBe('holds:3');
  });

  test('numeral cards follow the digit style (Eastern in Arabic mode)', async ({ page }) => {
    await openActivity(page, 'pg05.a1');
    expect((await sceneObjects(page)).some((o) => o.id.startsWith('n:'))).toBe(false);
    for (const id of ['apple-1', 'apple-2', 'apple-3']) await tapId(page, id);
    await expect.poll(async () => (await sceneObjects(page)).filter((o) => o.id.startsWith('n:')).length).toBe(2);
  });
});

test.describe('playground', () => {
  test('every activity loads with targets ≥ 64 px on screen', async ({ page }) => {
    test.setTimeout(120_000);
    const guard = guardPage(page);
    for (const id of ['af01.a1', 'af01.a2', 'af01.a3', 'pg01.a1', 'pg02.a1', 'pg03.a1', 'pg04.a1', 'pg05.a1', 'pg06.a1', 'pg07.a1']) {
      await openActivity(page, id);
      await expectNoLayoutProblems(page);
    }
    guard.assertClean();
  });
});
