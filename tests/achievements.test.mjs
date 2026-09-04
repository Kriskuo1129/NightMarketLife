import assert from "node:assert/strict";
import {ACHIEVEMENT_CONFIG,createInitialAchievements,createAchievementTracking,evaluateAchievements} from "../js/achievements.js";
assert.equal(ACHIEVEMENT_CONFIG.length,17);assert.equal(new Set(ACHIEVEMENT_CONFIG.map(a=>a.id)).size,17);
assert.ok(ACHIEVEMENT_CONFIG.every(a=>a.name.length===4));assert.ok(!ACHIEVEMENT_CONFIG.some(a=>["HOT_HAND","NIGHT_MARKET_LEGEND","WALK_IN_RAIN","HUMAN_MOSQUITO_COIL","WHO_IS_THAT"].includes(a.id)));
const state={player:{stamina:80,money:700},statistics:{gamePlays:{game_01:3},foodPurchases:0,stallVisits:{game_01:3},incidentHistory:[],stallMoneyFlow:{game_01:150}},stalls:[{id:"game_01",type:"GAME",isSpecial:false}],achievements:createInitialAchievements(),session:{achievementTracking:createAchievementTracking()}};
evaluateAchievements(state);assert.equal(state.achievements.find(a=>a.id==="COME_ALL_THE_WAY").unlocked,true);assert.equal(state.statistics.stallMoneyFlow.game_01,150);
evaluateAchievements(state,{settlement:true});assert.equal(state.achievements.find(a=>a.id==="STILL_WANT_MORE").unlocked,true);
console.log("Step 8.1 achievements tests: PASS");
