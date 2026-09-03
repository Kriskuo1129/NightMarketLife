// Run against a local server: NODE_PATH=<Playwright installation> node tests/environment-flow.browser.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(process.env.NML_TEST_URL || 'http://127.0.0.1:4173/');
    await page.getByRole('button', { name: '開始遊戲', exact: true }).click();
    const setup = async (id, initial = {}) => page.evaluate(async ({ id, initial }) => {
      const debug = window.NMLDebug;
      debug.newGame({ buildId: 'worker' });
      Object.assign(debug.getState().environment, initial);
      debug.render();
      const { getEligibleEnvironmentEvents } = await import('/js/events.js');
      const pool = getEligibleEnvironmentEvents(debug.getState().environment);
      const hasInfluencer = debug.getState().environment.influencer;
      let calls = 0;
      debug.triggerEnvironmentEvent(() => {
        calls += 1;
        if (hasInfluencer && calls === 1) return id === 'INFLUENCER_LEAVE' ? 0 : .99;
        if (calls === (hasInfluencer ? 2 : 1)) return (pool.indexOf(id) + .1) / pool.length;
        return id === 'INFLUENCER' ? .65 : 0;
      });
    }, { id, initial });
    const state = () => page.evaluate(() => {
      const s = window.NMLDebug.getState();
      return { env: s.environment, pending: s.session.pendingEnvironmentEvent, history: s.statistics.eventHistory,
        next: s.progress.nextEventAt, scene: s.session.scene, presentation: s.session.presentation?.type };
    });
    for (const [id, initial, key, before, after] of [
      ['RAIN_START', {}, 'raining', false, true],
      ['RAIN_STOP', { raining: true }, 'raining', true, false],
      ['MOSQUITO_START', {}, 'mosquito', false, true],
      ['MOSQUITO_STOP', { mosquito: true }, 'mosquito', true, false],
      ['PRICE_UP', {}, 'priceLevel', 1, 2],
      ['REWARD_UP', {}, 'rewardLevel', 1, 2],
      ['CROWD_UP', {}, 'crowdLevel', 3, 4],
      ['INFLUENCER', {}, 'influencerBlockedStallId', null, 'food_01'],
      ['INFLUENCER_LEAVE', { influencer: true, influencerBlockedStallId: 'food_01' }, 'influencerBlockedStallId', 'food_01', null]
    ]) {
      await setup(id, initial);
      await page.locator('#environment-event-dialog').waitFor({ state: 'visible' });
      const prepared = await state();
      assert.equal(prepared.env[key], before);
      assert.equal(prepared.pending.eventId, id);
      assert.equal(prepared.history.length, 0);
      if (id.startsWith('RAIN')) {
        assert.equal(await page.locator('[data-environment-stage]').getAttribute('data-raining'), String(before));
        assert.equal(await page.locator('[data-environment-message]').innerText(), before ? '突然下大雨' : '今晚的夜市十分熱鬧');
      }
      if (id === 'INFLUENCER') assert.match(await page.locator('[data-stall-id="food_01"]').innerText(), /營業中/);
      if (id === 'PRICE_UP') assert.match(await page.locator('[data-event-effects]').innerText(), /×1\.2/);
      await page.evaluate(() => { window.NMLDebug.render(); window.NMLDebug.render(); });
      assert.deepEqual((await state()).pending, prepared.pending);
      await page.locator('#environment-event-dialog button').click();
      const committed = await state();
      assert.equal(committed.env[key], after);
      assert.equal(committed.pending, null);
      assert.equal(committed.history.length, 1);
      assert.ok(committed.next >= 4 && committed.next <= 6);
      if (id === 'INFLUENCER') assert.match(await page.locator('[data-stall-id="food_01"]').innerText(), /網紅佔領中/);
    }
    await page.evaluate(() => {
      window.NMLDebug.newGame({ buildId: 'worker' });
      const s = window.NMLDebug.getState();
      s.player.stamina = 10; s.progress.nextEventAt = 1;
      window.NMLDebug.playTestGame('game_01', () => 0);
    });
    assert.equal((await state()).presentation, 'ACTIVITY_RESULT');
    assert.equal((await state()).env.raining, false);
    await page.locator('#environment-event-dialog').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#resource-warning-dialog').isVisible(), false);
    assert.equal((await state()).env.raining, false);
    await page.locator('#environment-event-dialog button').click();
    await page.locator('#resource-warning-dialog').waitFor({ state: 'visible' });
    assert.equal((await state()).env.raining, true);
    await page.locator('#resource-warning-dialog button').click();
    assert.equal((await state()).scene, 'NIGHT_MARKET');
    const responsive = [];
    for (const [width, height] of [[320,844],[390,844],[390,900],[430,932]]) {
      await page.setViewportSize({ width, height });
      await setup('RAIN_START');
      const bounds = await page.locator('#environment-event-dialog').evaluate(el => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom,
          overflowX: document.documentElement.scrollWidth > innerWidth,
          overflowY: document.documentElement.scrollHeight > innerHeight };
      });
      assert.ok(bounds.left >= 0 && bounds.right <= width && bounds.top >= 0 && bounds.bottom <= height);
      assert.equal(bounds.overflowX, false); assert.equal(bounds.overflowY, false);
      responsive.push({ width, height, ...bounds });
      if (width === 320) await page.screenshot({ path: path.join(os.tmpdir(), 'nml-environment-pending-320.png') });
      await page.locator('#environment-event-dialog button').click();
    }
    await setup('RAIN_START');
    await page.evaluate(() => window.NMLDebug.newGame());
    assert.equal((await state()).pending, null);
    assert.equal(await page.locator('#environment-event-dialog').isVisible(), false);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ result: 'PASS', events: 9, resourceOrdering: 'PASS', responsive, consoleErrors: errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
