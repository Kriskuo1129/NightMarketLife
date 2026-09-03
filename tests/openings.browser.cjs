const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:390,height:900}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(process.env.NML_TEST_URL || 'http://127.0.0.1:4173/');
    const home=page.locator('[data-scene="HOME"]');
    const opening=page.locator('#opening-dialog');
    const picker=page.locator('[data-action="open-home-build"]');
    const choose=async id=>{await picker.click(); await page.locator(`[data-home-build-id="${id}"]`).click();};
    const start=async seed=>{
      await page.evaluate(seed=>{
        document.addEventListener('submit',()=>{const original=Math.random;Math.random=()=>seed;setTimeout(()=>Math.random=original,0);},{capture:true,once:true});
      },seed);
      await home.getByRole('button',{name:'開始遊戲',exact:true}).click();
      await opening.waitFor({state:'visible'});
    };
    const state=()=>page.evaluate(()=>window.NMLDebug.getState());
    const acknowledge=()=>page.locator('[data-action="acknowledge-opening"]').click();
    assert.equal(await home.locator('[data-home-build="name"]').innerText(),'社會人');
    const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d');ctx.fillStyle='#d3833b';ctx.fillRect(0,0,32,32);return c.toDataURL();});
    await page.locator('[data-upload="avatar"]').setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:Buffer.from(png.split(',')[1],'base64')});
    await page.waitForFunction(()=>!!window.NMLDebug.getState().player.profile.avatar);
    await page.locator('#player-name').fill('夜市同學');
    const before=(await state()).progress;
    await picker.click();
    assert.equal(await page.locator('[data-home-build-id]').count(),5);
    assert.doesNotMatch(await page.locator('#home-build-dialog').innerText(),/Build|技能|Buff/);
    await page.locator('[data-home-build-id="college"]').click();
    assert.deepEqual((await state()).progress,before);
    assert.equal((await state()).session.scene,'HOME');
    assert.equal((await state()).session.openingConditionId,null);
    await page.reload();
    assert.equal(await home.locator('[data-home-build="name"]').innerText(),'大學生');
    assert.equal(await page.locator('#player-name').inputValue(),'夜市同學');
    assert.ok(await home.locator('[data-avatar-image]').isVisible());
    await start(.75);
    let s=await state();
    assert.deepEqual([s.player.stamina,s.player.maxStamina,s.player.money,s.player.score],[110,110,800,0]);
    assert.equal(s.session.openingConditionId,'ANNIVERSARY');
    assert.deepEqual([s.environment.crowdLevel,s.environment.priceLevel,s.environment.rewardLevel],[4,0,2]);
    assert.equal(s.progress.actionCount,0); assert.equal(s.statistics.totalActions,0);
    assert.ok(s.achievements.every(a=>!a.unlocked)); assert.deepEqual(s.statistics.eventHistory,[]);
    const locked=JSON.stringify(s);
    assert.deepEqual(await page.evaluate(()=>{const d=window.NMLDebug;return [d.playTestGame('game_01'),d.buyFood('food_01'),d.applyActivityResult({moneyDelta:20}),d.triggerEnvironmentEvent(),d.selectStall('management')];}),[false,false,false,false,false]);
    assert.ok(await page.locator('[data-action="go-home"]').isDisabled());
    assert.ok(await page.locator('[data-stall-id="management"]').isDisabled());
    await page.keyboard.press('Escape');
    await page.waitForTimeout(2700);
    assert.ok(await opening.isVisible()); assert.equal(JSON.stringify(await state()),locked);
    await acknowledge();
    assert.equal((await state()).session.openingPending,false);
    await page.locator('[data-stall-id="management"]').click();
    await page.locator('[data-action="ask-management"]').click();
    assert.doesNotMatch(await page.locator('[data-management-dialogue]').innerText(),/ANNIVERSARY|你抽到|openingConditionId|priceLevel/);
    await page.getByRole('button',{name:'沒事，我再逛逛',exact:true}).click();
    await page.evaluate(()=>window.NMLDebug.getState().progress.nextEventAt=999);
    for(const id of ['game_01','food_01']) {
      await page.locator(`[data-stall-id="${id}"]`).click();
      await page.locator('[data-action="enter-stall"]').click();
      await page.evaluate(async()=>{(await import('/js/game.js?v=core-ui-stall-grid')).clearActivityResultPresentation();});
    }
    s=await state(); assert.equal(s.player.score,24); assert.equal(s.player.money,770);
    await page.evaluate(()=>window.NMLDebug.triggerEnvironmentEvent(()=>0));
    assert.equal((await state()).environment.raining,false);
    await page.locator('[data-action="acknowledge-event"]').click();
    assert.equal((await state()).environment.raining,true);
    await page.locator('[data-action="go-home"]').click();
    await page.locator('[data-action="confirm-home"]').click();
    const result=page.locator('[data-scene="RESULT"]');
    assert.ok(await result.isVisible());
    assert.doesNotMatch(await result.innerText(),/週年慶|今晚的身分|Environment|Build/);
    await result.getByRole('button',{name:'回首頁',exact:true}).click();
    assert.equal((await state()).session.openingConditionId,null);
    assert.equal(await home.locator('[data-home-build="name"]').innerText(),'大學生');
    await start(.99); assert.equal((await state()).session.openingConditionId,'BUSY_MARKET');
    assert.deepEqual([(await state()).player.stamina,(await state()).player.money,(await state()).player.score],[110,800,0]);
    await acknowledge();

    for(const [id,stamina,money] of [['high-school',120,600],['college',110,800],['worker',100,1000],['middle-aged',85,1300],['senior',70,1600]]) {
      await page.evaluate(()=>window.NMLDebug.changeScene('HOME'));
      await choose(id); await start(.1);
      const player=(await state()).player;
      assert.deepEqual([player.buildId,player.stamina,player.maxStamina,player.money,player.score],[id,stamina,stamina,money,0]);
      await acknowledge();
    }
    const sizes=[[320,844],[390,844],[390,900],[430,932]];
    for(const [width,height] of sizes) {
      await page.setViewportSize({width,height});
      await page.evaluate(()=>window.NMLDebug.changeScene('HOME'));
      await page.evaluate(()=>scrollTo(0,0));
      const homeMetrics=await home.evaluate(el=>{const a=el.querySelector('.avatar-frame').getBoundingClientRect();const b=el.querySelector('[type="submit"]').getBoundingClientRect();return {w:a.width,h:a.height,bottom:b.bottom,overflow:document.documentElement.scrollWidth>innerWidth};});
      assert.equal(homeMetrics.w,homeMetrics.h); assert.equal(homeMetrics.overflow,false); assert.ok(homeMetrics.bottom<=height,JSON.stringify(homeMetrics));
      await page.screenshot({path:path.join(os.tmpdir(),`nml-step7-home-${width}x${height}.png`),fullPage:true});
      await picker.click();
      const buildBounds=await page.locator('#home-build-dialog').evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,overflow:el.scrollWidth>el.clientWidth};});
      assert.ok(buildBounds.top>=0&&buildBounds.bottom<=height);assert.equal(buildBounds.overflow,false);
      await page.locator('[data-home-build-id="senior"]').click();
      for(const seed of [.1,.4,.5,.65,.75,.95]) {
        await page.evaluate(seed=>window.NMLDebug.newGame({buildId:'senior'},()=>seed),seed);
        const snap=JSON.stringify(await state());
        await page.evaluate(()=>window.NMLDebug.render());
        await page.setViewportSize({width,height:height-1}); await page.setViewportSize({width,height});
        assert.equal(JSON.stringify(await state()),snap);
        const metrics=await opening.evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,inner:el.scrollWidth>el.clientWidth,page:document.documentElement.scrollWidth>innerWidth};});
        assert.ok(metrics.left>=0&&metrics.right<=width&&metrics.top>=0&&metrics.bottom<=height);assert.equal(metrics.inner,false);assert.equal(metrics.page,false);
        if(seed===.95) await page.screenshot({path:path.join(os.tmpdir(),`nml-step7-opening-${width}x${height}.png`)});
        await acknowledge();
        assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1));
        assert.equal(await page.locator('[data-stall-grid]').evaluate(el=>getComputedStyle(el).overflowY),'auto');
      }
    }
    await page.setViewportSize({width:320,height:480});
    await page.evaluate(()=>window.NMLDebug.newGame({},()=>.4));
    assert.equal(await opening.evaluate(el=>getComputedStyle(el).overflowY),'auto');
    await acknowledge();
    await page.evaluate(()=>{window.NMLDebug.changeScene('HOME');const key='nightMarketLife.characterSettings.v1';const setting=JSON.parse(localStorage.getItem(key));setting.buildId='removed';localStorage.setItem(key,JSON.stringify(setting));});
    await page.reload(); assert.equal(await home.locator('[data-home-build="name"]').innerText(),'社會人');
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('nightMarketLife.characterSettings.v1')));
    for(const key of ['openingConditionId','openingPending','stamina','money','score'])assert.equal(Object.hasOwn(stored,key),false);
    assert.deepEqual(errors,[]);
    console.log('Step 7 browser PASS: build/avatar persistence, weighted opening flow, blocking, gameplay/event/management/result, six openings x four mobile sizes; console errors 0');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
