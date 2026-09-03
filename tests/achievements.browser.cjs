// NODE_PATH=<Playwright installation> node tests/achievements.browser.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const os = require('node:os');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel:'msedge', headless:true });
  try {
    const page = await browser.newPage({ viewport:{ width:390, height:900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(process.env.NML_TEST_URL || 'http://127.0.0.1:4173/');
    await require('./gameplay-fixture.browser.cjs')(page);
    const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 32; const ctx = c.getContext('2d'); ctx.fillStyle='#d3833b'; ctx.fillRect(0,0,32,32); return c.toDataURL(); });
    await page.locator('[data-upload="avatar"]').setInputFiles({ name:'avatar.png', mimeType:'image/png', buffer:Buffer.from(png.split(',')[1], 'base64') });
    await page.waitForFunction(() => !!window.NMLDebug.getState().player.profile.avatar);
    await page.locator('#player-name').fill('夜市旅人');
    await page.getByRole('button', { name:'開始遊戲', exact:true }).click();
    await page.locator('[data-action="acknowledge-opening"]').click();
    assert.equal(await page.evaluate(() => window.NMLDebug.getState().session.scene), 'NIGHT_MARKET', JSON.stringify(errors));
    await page.evaluate(() => { window.NMLDebug.getState().progress.nextEventAt = 999; });
    const goHome = async () => {
      await page.locator('[data-action="go-home"]').click();
      await page.locator('[data-action="confirm-home"]').click();
      await page.locator('[data-scene="RESULT"]').waitFor({ state:'visible' });
    };
    const finishPresentation = () => page.evaluate(async () => { (await import('/js/game.js?v=core-ui-stall-grid')).clearActivityResultPresentation(); });
    for (const id of ['food_01','food_01','food_01','game_01','game_02','game_03']) {
      await page.locator(`[data-stall-id="${id}"]`).click();
      await page.locator('[data-action="enter-stall"]').click();
      await finishPresentation();
    }
    await goHome();
    const result = page.locator('[data-scene="RESULT"]');
    const text = await result.innerText();
    for (const name of ['夜市旅人','大吃特吃','專程來吃','老闆照舊','來都來了','今晚精彩分數']) assert.ok(text.includes(name), name);
    assert.equal(await result.locator('[data-player="score"]').innerText(), '60');
    assert.equal(await result.locator('[data-player="money"], [data-player="stamina"]').count(), 0);
    assert.ok(await result.locator('[data-avatar-image]').isVisible());
    assert.ok(await result.locator('[data-avatar-image]').evaluate(img => img.complete && img.naturalWidth > 0));
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    assert.doesNotMatch(storage, /achievement|unlocked|rainActions/);
    await result.getByRole('button', { name:'回首頁', exact:true }).click();
    await page.reload();
    await require('./gameplay-fixture.browser.cjs')(page);
    assert.ok(await page.locator('[data-scene="HOME"] [data-avatar-image]').isVisible());
    await page.getByRole('button', { name:'開始遊戲', exact:true }).click();
    await page.locator('[data-action="acknowledge-opening"]').click();
    assert.ok(await page.evaluate(() => window.NMLDebug.getState().achievements.every(a => !a.unlocked)));

    // Fixed-state resource boundaries still use the real successful-action path.
    for (const [label, deltas, names] of [
      ['stamina', { staminaDelta:-100 }, ['精疲力盡']],
      ['money', { moneyDelta:-1000 }, ['身無分文','兩袖清風']],
      ['both', { staminaDelta:-100,moneyDelta:-1000 }, ['精疲力盡','身無分文','山窮水盡','一乾二淨']]
    ]) {
      await page.evaluate(deltas => { window.NMLDebug.newGame({ buildId:'worker' }); window.NMLDebug.applyActivityResult(deltas); }, deltas);
      await page.locator('[data-action="acknowledge-resource"]').click();
      await goHome();
      const story = await result.innerText();
      for (const name of names) assert.ok(story.includes(name), `${label}: ${name}`);
    }
    await page.evaluate(() => { window.NMLDebug.newGame({ buildId:'worker' }); const s = window.NMLDebug.getState(); s.progress.nextEventAt=999; s.environment.raining=true; s.environment.mosquito=true; });
    for (const id of ['game_01','game_02','game_03','food_01','food_02']) {
      await page.evaluate(id => id.startsWith('food') ? window.NMLDebug.buyFood(id) : window.NMLDebug.playTestGame(id), id);
      await finishPresentation();
    }
    await page.evaluate(async () => {
      const d = window.NMLDebug; const { getEligibleEnvironmentEvents } = await import('/js/events.js');
      const pool = getEligibleEnvironmentEvents(d.getState().environment);
      d.triggerEnvironmentEvent(() => (pool.indexOf('INFLUENCER') + .1) / pool.length);
    });
    assert.equal(await page.evaluate(() => window.NMLDebug.getState().achievements.find(a => a.id === 'WHO_IS_THAT').unlocked), false);
    await page.locator('[data-action="acknowledge-event"]').click();
    assert.equal(await page.evaluate(() => window.NMLDebug.getState().achievements.find(a => a.id === 'WHO_IS_THAT').unlocked), true);
    await goHome();
    for (const name of ['雨中漫步','人體蚊香','那到底誰','雨露均霑']) assert.ok((await result.innerText()).includes(name), name);

    // Empty result and blank name, with resources below the voluntary-home threshold.
    await page.evaluate(() => { window.NMLDebug.newGame({ name:'',buildId:'worker' }); Object.assign(window.NMLDebug.getState().player,{stamina:20,money:100}); window.NMLDebug.render(); });
    await goHome();
    assert.ok((await result.innerText()).includes('-沒輸入名稱-'));
    assert.ok(await result.locator('[data-result-empty]').isVisible());
    assert.equal(await result.locator('li').count(), 0);
    assert.doesNotMatch(await result.innerText(), /0\s*\/\s*19|未解鎖|Placeholder|完成率/);

    // Dense recap fixture: gameplay achievements via evaluator, settlement via confirmation.
    await page.evaluate(async () => {
      window.NMLDebug.newGame({name:'夜市旅人', buildId:'worker'});
      const s = window.NMLDebug.getState();
      s.player.score=860;
      s.statistics.gamePlays={game_01:8}; s.statistics.foodPurchases=9; s.statistics.mosquitoActions=3;
      for (const stall of s.stalls.filter(a => !a.isSpecial)) s.statistics.stallVisits[stall.id]=3;
      s.statistics.eventHistory.push({eventId:'INFLUENCER'});
      Object.assign(s.session.achievementTracking,{staminaZero:true,moneyZero:true,bothZero:true,foodRecovery:true,foodClosure:true,rainActions:2});
      (await import('/js/achievements.js')).evaluateAchievements(s);
      window.NMLDebug.render();
    });
    await goHome();
    assert.equal(await result.locator('li').count(), 17);
    const beforeRender = await page.evaluate(() => JSON.stringify(window.NMLDebug.getState()));
    for (const [width,height] of [[320,844],[390,844],[390,900],[430,932]]) {
      await page.setViewportSize({width,height});
      await page.evaluate(() => window.NMLDebug.render());
      const metrics = await result.evaluate(el => {
        const avatar = el.querySelector('.avatar-frame').getBoundingClientRect();
        return { overflow:document.documentElement.scrollWidth > innerWidth, vertical:document.documentElement.scrollHeight > innerHeight, w:avatar.width,h:avatar.height, radius:getComputedStyle(el.querySelector('.avatar-frame')).borderRadius, font:getComputedStyle(el.querySelector('li p')).fontSize };
      });
      assert.equal(metrics.overflow,false); assert.equal(metrics.vertical,true); assert.equal(metrics.w,metrics.h); assert.equal(metrics.radius,'50%'); assert.ok(parseFloat(metrics.font)>=14);
      await result.getByRole('button',{name:'回首頁',exact:true}).scrollIntoViewIfNeeded();
      await page.screenshot({ path:path.join(os.tmpdir(),`nml-step6-result-${width}x${height}.png`), fullPage:true });
    }
    assert.equal(await page.evaluate(() => JSON.stringify(window.NMLDebug.getState())),beforeRender);
    await result.getByRole('button',{name:'回首頁',exact:true}).click();
    await page.getByRole('button',{name:'開始遊戲',exact:true}).click();
    await page.locator('[data-action="acknowledge-opening"]').click();
    assert.ok(await page.evaluate(() => window.NMLDebug.getState().achievements.every(a=>!a.unlocked)));
    assert.deepEqual(errors,[]);
    console.log('Step 6 browser: real game/food/home/result, avatar storage, resource/environment stories, empty/dense result, four mobile sizes PASS; console errors 0');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
