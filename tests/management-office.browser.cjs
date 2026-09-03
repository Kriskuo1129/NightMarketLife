// Run against a local server with Playwright available through NODE_PATH.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    const issues = [];
    page.on('pageerror', error => issues.push(error.message));
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) issues.push(message.text()); });
    await page.goto(process.env.NML_TEST_URL || 'http://127.0.0.1:4173/');
    await page.getByRole('button', { name: '開始遊戲', exact: true }).click();
    const office = page.locator('#management-office-dialog');
    const card = page.locator('[data-stall-id="management"]');
    const snapshot = () => page.evaluate(() => JSON.stringify({ state: window.NMLDebug.getState(), storage: { ...localStorage } }));
    const banned = /[0-9×=+]|crowdLevel|priceLevel|rewardLevel|multiplier|Penalty|nextEventAt|Action|INFLUENCER|RAIN_START|MOSQUITO_START|倍率|參數|等級|Buff|Debuff/i;
    const initial = await snapshot();
    await card.click();
    assert.equal(await page.locator('#stall-detail-dialog').isVisible(), false);
    assert.match(await office.innerText(), /少年仔/);
    await office.getByRole('button', { name: '阿伯，今天夜市怎樣？', exact: true }).click();
    assert.doesNotMatch(await office.innerText(), banned);
    await office.getByRole('button', { name: '再問問看', exact: true }).click();
    await office.getByRole('button', { name: '沒事，我再逛逛', exact: true }).click();
    assert.equal(await snapshot(), initial);

    const cases = [
      ['normal', {}, /普通|正常|老樣子|沒下雨|沒什麼特別/],
      ['rain', { raining: true }, /雨/],
      ['mosquito', { mosquito: true }, /蚊子/],
      ['influencer', { influencer: true, influencerBlockedStallId: 'food_01' }, /測試小吃攤 A/],
      ['crowd', { crowdLevel: 5 }, /人|擠/],
      ['price', { priceLevel: 3 }, /價錢|不便宜/],
      ['reward', { rewardLevel: 4 }, /敢送|大方/]
    ];
    const dialogueResults = [];
    for (const [name, environment, semantic] of cases) {
      await page.evaluate(environment => {
        window.NMLDebug.newGame({ buildId: 'worker' });
        Object.assign(window.NMLDebug.getState().environment, environment);
        window.NMLDebug.render();
      }, environment);
      const before = await snapshot();
      await card.click();
      await office.getByRole('button', { name: '阿伯，今天夜市怎樣？', exact: true }).click();
      const dialogue = await office.locator('[data-management-dialogue]').innerText();
      assert.match(dialogue, semantic);
      assert.doesNotMatch(await office.innerText(), banned);
      for (let i = 0; i < 5; i += 1) {
        await office.getByRole('button', { name: '再問問看', exact: true }).click();
        assert.doesNotMatch(await office.innerText(), banned);
      }
      await office.getByRole('button', { name: '沒事，我再逛逛', exact: true }).click();
      assert.equal(await snapshot(), before);
      dialogueResults.push({ name, dialogue });
    }
    const responsive = [];
    for (const [width, height] of [[320,844],[390,844],[390,900],[430,932]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => {
        window.NMLDebug.newGame({ buildId: 'worker' });
        Object.assign(window.NMLDebug.getState().environment, { raining: true, mosquito: true, influencer: true, influencerBlockedStallId: 'food_01', crowdLevel: 5, priceLevel: 3, rewardLevel: 4 });
        window.NMLDebug.render();
      });
      const before = await snapshot();
      await card.click();
      await office.getByRole('button', { name: '阿伯，今天夜市怎樣？', exact: true }).click();
      for (let i = 0; i < 6; i += 1) {
        await office.getByRole('button', { name: '再問問看', exact: true }).click();
        const bounds = await office.evaluate(el => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom,
            contentOverflowX: el.scrollWidth > el.clientWidth,
            pageOverflowX: document.documentElement.scrollWidth > innerWidth,
            pageOverflowY: document.documentElement.scrollHeight > innerHeight };
        });
        assert.ok(bounds.left >= 0 && bounds.right <= width && bounds.top >= 0 && bounds.bottom <= height);
        assert.equal(bounds.contentOverflowX, false);
        assert.equal(bounds.pageOverflowX, false); assert.equal(bounds.pageOverflowY, false);
        assert.doesNotMatch(await office.innerText(), banned);
        if (i === 0) responsive.push({ width, height, ...bounds });
      }
      if (width === 320) await page.screenshot({ path: path.join(os.tmpdir(), 'nml-management-320.png') });
      await office.getByRole('button', { name: '沒事，我再逛逛', exact: true }).click();
      assert.equal(await snapshot(), before);
    }
    await page.evaluate(() => { window.NMLDebug.newGame(); window.NMLDebug.triggerEnvironmentEvent(() => 0); });
    assert.equal(await card.isDisabled(), true);
    assert.equal(await office.isVisible(), false);
    await page.locator('#environment-event-dialog button').click();
    await card.click();
    await office.getByRole('button', { name: '阿伯，今天夜市怎樣？', exact: true }).click();
    assert.match(await office.locator('[data-management-dialogue]').innerText(), /雨/);
    await page.keyboard.press('Escape');
    assert.equal(await office.isVisible(), false);
    await page.getByRole('button', { name: '回家，結束今晚行程', exact: true }).click();
    await page.locator('[data-action="confirm-home"]').click();
    assert.equal(await page.locator('[data-scene="RESULT"]').isVisible(), true);
    assert.deepEqual(issues, []);
    console.log(JSON.stringify({ result: 'PASS', dialogueResults, responsive, issues }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
