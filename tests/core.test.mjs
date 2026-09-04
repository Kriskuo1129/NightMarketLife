import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
globalThis.localStorage={values:new Map(),getItem(k){return this.values.get(k)??null},setItem(k,v){this.values.set(k,v)},removeItem(k){this.values.delete(k)}};
globalThis.document={activeElement:null,addEventListener(){},querySelector(){return null},querySelectorAll(){return[]}};globalThis.window={};
const {CONFIG,pickRandomBuild}=await import("../js/config.js");
const {NIGHT_CONDITION_CONFIG,applyNightCondition}=await import("../js/openings.js");
const {createEnvironment,getEffectiveGameStaminaCost,getEffectiveFoodPrice,getTemperatureFoodBonus,applyRewardModifier,prepareIncident,commitPendingIncident,getEligibleIncidents}=await import("../js/events.js");
const {createInitialStalls,initializeStallLife,consumeStallLife,FOOD_CONFIG,STALL_TYPES,TEST_GAME_RESULTS}=await import("../js/stalls.js");
const {gameState}=await import("../js/state.js");
const {createNewGame,acknowledgeOpening,playTestGame,buyFood,clearActivityResultPresentation,advancePresentation,applyActivityResult}=await import("../js/game.js");
const builds=CONFIG.characterBuilds;
assert.deepEqual(builds.map(b=>[b.name,b.stamina,b.money]),[["高中生",120,600],["大學生",110,800],["社會人",100,1000],["中年人",85,1300],["老年人",70,1600]]);
assert.deepEqual([0,.2,.4,.6,.8].map(n=>pickRandomBuild(()=>n).id),builds.map(b=>b.id));
assert.equal(NIGHT_CONDITION_CONFIG.length,6);assert.equal(NIGHT_CONDITION_CONFIG.reduce((n,c)=>n+c.weight,0),100);
const expected=[[3,3,3,3,3],[1,4,4,3,1],[5,4,4,3,5],[5,5,4,2,5],[4,2,4,3,5],[4,4,3,4,4]];
for(let i=0;i<6;i++){const env=createEnvironment();applyNightCondition(env,NIGHT_CONDITION_CONFIG[i]);assert.deepEqual(Object.values(env),expected[i]);}
assert.deepEqual(Object.keys(createEnvironment()),["crowdLevel","priceLevel","rewardLevel","temperatureLevel","businessLevel"]);
const stalls=createInitialStalls(),game=stalls.find(s=>s.type===STALL_TYPES.GAME),food=stalls.find(s=>s.id==="food_02"),special=stalls.find(s=>s.isSpecial);
assert.equal(game.staminaCost,20);assert.equal(TEST_GAME_RESULTS.game_01.staminaDelta,-20);
assert.equal(getEffectiveGameStaminaCost(game,{crowdLevel:1,temperatureLevel:1}),19);
assert.equal(getEffectiveGameStaminaCost(game,{crowdLevel:5,temperatureLevel:5}),30);
assert.equal(getEffectiveFoodPrice(food,{priceLevel:1}),160);assert.equal(getEffectiveFoodPrice(food,{priceLevel:5}),280);
assert.equal(getTemperatureFoodBonus("HOT",1),10);assert.equal(getTemperatureFoodBonus("HOT",2),5);assert.equal(getTemperatureFoodBonus("HOT",5),0);assert.equal(getTemperatureFoodBonus("COLD",5),10);assert.equal(getTemperatureFoodBonus("NEUTRAL",1),0);
assert.deepEqual(applyRewardModifier({moneyDelta:100},{rewardLevel:5}),{moneyDelta:150});assert.deepEqual(applyRewardModifier({moneyDelta:-100},{rewardLevel:5}),{moneyDelta:-100});
for(const [level,range] of [[1,[3,3]],[2,[3,4]],[3,[4,5]],[4,[5,6]],[5,[6,6]]]){initializeStallLife(stalls,level,()=>.99);for(const s of stalls.filter(x=>!x.isSpecial))assert.ok(s.life>=range[0]&&s.life<=range[1]);}
const specialLife=special.life;consumeStallLife(special);assert.equal(special.life,specialLife);
createNewGame({},()=>0);assert.equal(gameState.session.scene,"NIGHT_REVEAL");assert.equal(gameState.player.buildId,"high-school");assert.equal(gameState.session.nightConditionId,"NORMAL_NIGHT");assert.equal(gameState.session.startingMoney,600);assert.equal(acknowledgeOpening(),true);assert.equal(gameState.session.scene,"NIGHT_MARKET");
gameState.progress.nextIncidentAt=2;let life=gameState.stalls.find(s=>s.id==="game_01").life;playTestGame("game_01",()=>0);clearActivityResultPresentation();assert.equal(gameState.progress.gameActionCount,1);assert.equal(gameState.stalls.find(s=>s.id==="game_01").life,life-1);
const foodStall=gameState.stalls.find(s=>s.id==="food_01");life=foodStall.life;const count=gameState.progress.gameActionCount;buyFood("food_01",()=>0);clearActivityResultPresentation();assert.equal(foodStall.life,life-1);assert.equal(gameState.progress.gameActionCount,count);assert.equal(gameState.session.pendingIncident,null);
playTestGame("game_02",()=>0);assert.equal(gameState.progress.gameActionCount,2);assert.ok(gameState.session.pendingIncident);assert.equal(gameState.progress.nextIncidentAt,2);advancePresentation(gameState.session.presentation);assert.equal(gameState.session.presentation.type,"INCIDENT_MODAL");const incident=gameState.session.pendingIncident;commitPendingIncident(gameState,incident,()=>0);assert.equal(gameState.progress.nextIncidentAt,4);assert.equal(gameState.statistics.incidentHistory.length,1);
for(const id of ["CROWD_UP","CROWD_DOWN","PRICE_UP","PRICE_DOWN","REWARD_UP","REWARD_DOWN","TEMPERATURE_UP","TEMPERATURE_DOWN","BUSINESS_UP","BUSINESS_DOWN"]){const state={environment:{crowdLevel:3,priceLevel:3,rewardLevel:3,temperatureLevel:3,businessLevel:3},progress:{gameActionCount:2,nextIncidentAt:2},statistics:{incidentHistory:[]},session:{pendingIncident:null}};const item=prepareIncident(state,id);commitPendingIncident(state,item,()=>0);assert.ok(Object.values(state.environment).every(v=>v>=1&&v<=5));}
assert.ok(getEligibleIncidents({crowdLevel:1,priceLevel:1,rewardLevel:1,temperatureLevel:1,businessLevel:1}).every(id=>id.endsWith("UP")));
gameState.player.stamina=0;gameState.player.money=0;for(const s of gameState.stalls.filter(s=>!s.isSpecial)){s.life=0;s.isClosed=true;}assert.equal(gameState.session.scene,"NIGHT_MARKET");
assert.equal(gameState.achievements.length,17);assert.ok(Object.hasOwn(gameState.statistics,"stallMoneyFlow"));
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");assert.doesNotMatch(html,/data-home-build|home-build-dialog|分數|Score/i);assert.equal((html.match(/data-player="(?:stamina|money)"/g)||[]).length>=2,true);
assert.equal(Object.hasOwn(applyActivityResult({scoreDelta:99,completed:false}),"scoreDelta"),false);
console.log("NightMarketLife Step 8.1 core tests: PASS");
