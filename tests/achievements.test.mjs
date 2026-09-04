import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ACHIEVEMENT_CONFIG, ACHIEVEMENT_THRESHOLDS as T, evaluateAchievements as evaluate } from "../js/achievements.js";
import { createGameState, gameState } from "../js/state.js";
import { prepareEnvironmentEvent, commitPendingEnvironmentEvent, getEligibleEnvironmentEvents } from "../js/events.js";
import { playTestGame, buyFood, applyActivityResult, clearActivityResultPresentation, acknowledgeResourceWarning, acknowledgeEnvironmentEvent, triggerEnvironmentEvent, requestEndGame } from "../js/game.js";
import { createNewGame } from './gameplay-fixture.mjs';
import { render } from "../js/ui.js";

const unlocked = (s, id) => s.achievements.find(a => a.id === id).unlocked;
const check = (id, setup, expected = true, context = {}) => {
  const s = createGameState(); setup(s); evaluate(s, context);
  assert.equal(unlocked(s, id), expected, id); return s;
};
assert.equal(ACHIEVEMENT_CONFIG.length, 17);
assert.equal(new Set(ACHIEVEMENT_CONFIG.map(a => a.id)).size, 17);
assert.equal(ACHIEVEMENT_CONFIG.some(a => ["HOT_HAND", "NIGHT_MARKET_LEGEND"].includes(a.id)), false);
for (const a of createGameState().achievements) {
  assert.match(a.name, /^[\p{Script=Han}]{4}$/u);
  assert.deepEqual(Object.keys(a), ["id", "name", "description", "unlocked"]);
  assert.equal(a.unlocked, false);
  assert.notEqual(a.name, "關門專家");
}
assert.doesNotMatch(readFileSync(new URL('../js/achievements.js', import.meta.url), 'utf8'), /rarity|COMMON|RARE|EPIC|LEGENDARY/);
for (const [id, limit, field] of [["COME_ALL_THE_WAY", T.games, "games"], ["CANT_STOP", T.manyGames, "games"], ["BIG_EATER", T.foods, "foodPurchases"], ["HUMAN_MOSQUITO_COIL", T.mosquitoActions, "mosquitoActions"]]) {
  for (const value of [limit - 1, limit]) check(id, s => {
    if (field === "games") s.statistics.gamePlays = { a: 1, b: value - 1 };
    else s.statistics[field] = value;
  }, value === limit);
}
check("HERE_TO_EAT", s => { s.statistics.foodPurchases = 1; }, false);
check("HERE_TO_EAT", s => { s.statistics.foodPurchases = 3; s.statistics.gamePlays.a = 3; }, false);
check("HERE_TO_EAT", s => { s.statistics.foodPurchases = 3; s.statistics.gamePlays.a = 2; });
check("THE_USUAL", s => { s.statistics.stallVisits.game_01 = 3; }, false);
check("THE_USUAL", s => { s.statistics.stallVisits.food_01 = 2; }, false);
check("THE_USUAL", s => { s.statistics.stallVisits.food_01 = 3; });
check("EAT_UNTIL_CLOSE", s => { s.stalls.find(a => a.type === 'FOOD').isClosed = true; }, false);
const dynamic = check("TRY_EVERYTHING", s => {
  s.stalls.push({ id:'future_food', type:'FOOD', isSpecial:false });
  for (const stall of s.stalls.filter(a => !a.isSpecial)) s.statistics.stallVisits[stall.id] = 1;
});
dynamic.achievements.forEach(a => a.unlocked = false);
delete dynamic.statistics.stallVisits.future_food;
evaluate(dynamic); assert.equal(unlocked(dynamic, 'TRY_EVERYTHING'), false);

const fresh = () => { createNewGame({ buildId:'worker' }); gameState.progress.nextEventAt = 999; };
fresh();
applyActivityResult({ staminaDelta:-100 });
assert.ok(unlocked(gameState, 'EXHAUSTED')); assert.equal(unlocked(gameState, 'ROCK_BOTTOM'), false);
acknowledgeResourceWarning();
applyActivityResult({ moneyDelta:-1000 });
assert.ok(unlocked(gameState, 'BROKE')); assert.ok(unlocked(gameState, 'ROCK_BOTTOM'));
assert.equal(unlocked(gameState, 'NOTHING_LEFT'), false);
acknowledgeResourceWarning(); requestEndGame('HOME');
assert.ok(unlocked(gameState, 'EMPTY_POCKETS')); assert.ok(unlocked(gameState, 'NOTHING_LEFT'));
fresh(); applyActivityResult({ staminaDelta:-100 }); acknowledgeResourceWarning();
buyFood('food_01'); assert.ok(unlocked(gameState, 'COMEBACK'));
fresh(); applyActivityResult({ staminaDelta:-100 }); acknowledgeResourceWarning();
applyActivityResult({ staminaDelta:100 });
assert.equal(unlocked(gameState, 'COMEBACK'), false, 'non-food recovery is not a comeback');
buyFood('food_01');
assert.equal(unlocked(gameState, 'COMEBACK'), false, 'food at full stamina did not recover stamina');
fresh(); gameState.player.stamina = 0;
applyActivityResult({ moneyDelta:1 });
assert.equal(unlocked(gameState, 'EXHAUSTED'), false, 'requires a positive-to-zero transition');
fresh(); gameState.stalls.find(s => s.id === 'game_01').life = 1;
playTestGame('game_01'); assert.equal(unlocked(gameState, 'EAT_UNTIL_CLOSE'), false);
fresh(); gameState.stalls.find(s => s.id === 'food_01').life = 1;
buyFood('food_01'); assert.ok(unlocked(gameState, 'EAT_UNTIL_CLOSE'));
fresh(); gameState.environment.raining = true;
playTestGame('game_01'); assert.equal(unlocked(gameState, 'WALK_IN_RAIN'), false);
playTestGame('game_02'); assert.ok(unlocked(gameState, 'WALK_IN_RAIN'));
fresh(); gameState.environment.mosquito = true;
for (let i = 0; i < 3; i++) playTestGame('game_01');
assert.ok(unlocked(gameState, 'HUMAN_MOSQUITO_COIL'));
fresh();
const pending = prepareEnvironmentEvent(gameState, 'INFLUENCER', () => 0);
evaluate(gameState); assert.equal(unlocked(gameState, 'WHO_IS_THAT'), false);
assert.equal(playTestGame('game_01'), false);
commitPendingEnvironmentEvent(gameState, pending, () => 0); evaluate(gameState);
assert.ok(unlocked(gameState, 'WHO_IS_THAT'));
fresh();
const pool = getEligibleEnvironmentEvents(gameState.environment);
triggerEnvironmentEvent(() => (pool.indexOf('INFLUENCER') + .1) / pool.length); acknowledgeEnvironmentEvent();
assert.ok(unlocked(gameState, 'WHO_IS_THAT'), 'official confirmation evaluates committed influencer');
fresh(); gameState.progress.nextEventAt = 1;
playTestGame('game_01', () => 0);
assert.equal(gameState.session.pendingEnvironmentEvent.eventId, 'RAIN_START');
assert.equal(gameState.session.achievementTracking.rainActions, 0);
// No action while projected rain is pending; commit alone is not a rain action.
assert.equal(playTestGame('game_01'), false);
const { advancePresentation } = await import('../js/game.js');
advancePresentation(); acknowledgeEnvironmentEvent();
assert.equal(gameState.session.achievementTracking.rainActions, 0);
gameState.progress.nextEventAt = 999;
playTestGame('game_01'); playTestGame('game_02');
assert.ok(unlocked(gameState, 'WALK_IN_RAIN'));

for (const [stamina, money, expected] of [[T.homeStamina,T.homeMoney,true],[T.homeStamina-1,T.homeMoney,false],[T.homeStamina,T.homeMoney-1,false]]) {
  fresh(); Object.assign(gameState.player, { stamina, money });
  evaluate(gameState); assert.equal(unlocked(gameState, 'STILL_WANT_MORE'), false);
  requestEndGame('HOME'); assert.equal(unlocked(gameState, 'STILL_WANT_MORE'), expected);
}
fresh();
const storageBefore = JSON.stringify([...localStorage.values]);
gameState.statistics.gamePlays.a = 8;
const observed = s => JSON.stringify({ player:s.player, environment:s.environment, stalls:s.stalls, progress:s.progress, statistics:s.statistics, queue:s.session.presentationQueue, presentation:s.session.presentation, pending:s.session.pendingEnvironmentEvent });
const before = observed(gameState); evaluate(gameState);
assert.equal(observed(gameState), before);
assert.equal(JSON.stringify([...localStorage.values]), storageBefore);
assert.ok(unlocked(gameState, 'CANT_STOP'));
gameState.session.scene = 'RESULT'; const renderBefore = JSON.stringify(gameState);
render(gameState); render(gameState); assert.equal(JSON.stringify(gameState), renderBefore);
fresh(); assert.ok(gameState.achievements.every(a => !a.unlocked));
assert.deepEqual(gameState.session.achievementTracking, { staminaZero:false,moneyZero:false,bothZero:false,foodRecovery:false,foodClosure:false,rainActions:0 });
const failedBefore = JSON.stringify(gameState);
applyActivityResult({ completed:false, staminaDelta:-100 });
assert.equal(JSON.stringify(gameState), failedBefore);
gameState.player.stamina = 0;
gameState.environment.raining = true;
const deniedTracking = JSON.stringify(gameState.session.achievementTracking);
assert.equal(playTestGame('game_01'), false);
assert.equal(JSON.stringify(gameState.session.achievementTracking), deniedTracking);
clearActivityResultPresentation();
console.log('Step 6 achievements tests: PASS');
