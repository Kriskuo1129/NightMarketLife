import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.localStorage = {
  values: new Map(),
  getItem(key) { return this.values.get(key) ?? null; },
  setItem(key, value) { this.values.set(key, value); },
  removeItem(key) { this.values.delete(key); }
};
globalThis.document = {
  activeElement: null,
  addEventListener() {},
  querySelector() { return null; },
  querySelectorAll() { return []; }
};
globalThis.window = {};

const { CONFIG } = await import("../js/config.js");
const { createStall, cycleStallId, getStallDisplayStatus, getStallViewState, STALL_CONFIG, STALL_DISPLAY_STATUS, STALL_TYPES, INTERACTION_TYPES, TEST_GAME_RESULTS } = await import("../js/stalls.js");
const { createAchievement } = await import("../js/achievements.js");
const { gameState } = await import("../js/state.js");
const { applyActivityResult, clearActivityResultPresentation, completeCharacterSetup, getStallPlaceholderCopy, playTestGame, selectStallAndScroll, setEnvironmentFlag, setInfluencer, setStallClosed } = await import("../js/game.js");
const { createNewGame, startNightMarketFromHome } = await import('./gameplay-fixture.mjs');
const { getEnvironmentStageView } = await import("../js/ui.js");
const { applyBuildToPlayer, createPlayer, getPlayerDisplayName } = await import("../js/character.js");
const { cycleAsset, changeClothes, changeFace, setCustomAppearance } = await import("../js/character-setup.js");
const { FACE_ASSETS, DEFAULT_CLOTHES, SHOP_CLOTHES } = await import("../assets/character-assets.js");
const { validateImageFile, calculateCenterCrop, MAX_UPLOAD_BYTES, CLOTHES_OUTPUT_WIDTH, CLOTHES_OUTPUT_HEIGHT, FACE_OUTPUT_SIZE } = await import("../js/uploads.js");
const { saveCharacterSettings, loadCharacterSettings } = await import("../js/storage.js");

const { CHARACTER_LAYER_NAMES } = await import("../js/character-renderer.js");
assert.deepEqual(CONFIG.characterBuilds.map(({ name, stamina, money }) => ({ name, stamina, money })), [
  { name: "高中生", stamina: 120, money: 600 },
  { name: "大學生", stamina: 110, money: 800 },
  { name: "社會人", stamina: 100, money: 1000 },
  { name: "中年人", stamina: 85, money: 1300 },
  { name: "老年人", stamina: 70, money: 1600 }
]);

createNewGame({ name: "測試者", avatar: "data:image/webp;base64,avatar", buildId: "high-school" });
assert.equal(gameState.session.scene, "NIGHT_MARKET");
assert.equal(gameState.player.profile.avatar, "data:image/webp;base64,avatar");
assert.equal(gameState.player.maxStamina, 120);
assert.equal(gameState.environment.crowdLevel, 3);
assert.ok(gameState.progress.nextEventAt >= 4 && gameState.progress.nextEventAt <= 6);
assert.deepEqual(gameState.statistics.gamePlays, {});
assert.equal(gameState.player.buildId, "high-school");
assert.equal(FACE_ASSETS.length, 5);
assert.equal(DEFAULT_CLOTHES.length, 5);
assert.equal(SHOP_CLOTHES.length, 0);

assert.equal(cycleAsset(FACE_ASSETS, FACE_ASSETS[0].id, -1).id, FACE_ASSETS.at(-1).id);
assert.equal(cycleAsset(FACE_ASSETS, FACE_ASSETS.at(-1).id, 1).id, FACE_ASSETS[0].id);
assert.equal(cycleAsset(DEFAULT_CLOTHES, DEFAULT_CLOTHES[0].id, -1).id, DEFAULT_CLOTHES.at(-1).id);
assert.equal(cycleAsset(DEFAULT_CLOTHES, DEFAULT_CLOTHES.at(-1).id, 1).id, DEFAULT_CLOTHES[0].id);

changeFace(gameState.player, 1);
changeClothes(gameState.player, 1);
assert.equal(gameState.player.appearance.faceId, FACE_ASSETS[1].id);
assert.equal(gameState.player.appearance.clothesId, DEFAULT_CLOTHES[1].id);
setCustomAppearance(gameState.player, "face", "data:image/webp;base64,face");
setCustomAppearance(gameState.player, "clothes", "data:image/webp;base64,clothes");
assert.equal(gameState.player.appearance.customFace, "data:image/webp;base64,face");
assert.equal(gameState.player.appearance.customClothes, "data:image/webp;base64,clothes");

assert.equal(applyBuildToPlayer(gameState.player, "senior"), true);
assert.equal(gameState.player.stamina, 70);
assert.equal(gameState.player.money, 1600);
assert.equal(applyBuildToPlayer(gameState.player, "missing-build"), false);

assert.equal(validateImageFile({ type: "text/plain", size: 10 }).ok, false);
assert.equal(validateImageFile({ type: "image/png", size: MAX_UPLOAD_BYTES + 1 }).ok, false);
assert.equal(validateImageFile({ type: "image/webp", size: 1024 }).ok, true);
assert.equal(CLOTHES_OUTPUT_WIDTH / CLOTHES_OUTPUT_HEIGHT, 25 / 32);
assert.equal(FACE_OUTPUT_SIZE, 512);
assert.equal(createPlayer().profile.avatar, null);
assert.deepEqual(calculateCenterCrop(1000, 1000), { x: 109.375, y: 0, width: 781.25, height: 1000 });
assert.deepEqual(calculateCenterCrop(1600, 900), { x: 448.4375, y: 0, width: 703.125, height: 900 });
assert.deepEqual(calculateCenterCrop(900, 1600), { x: 0, y: 224, width: 900, height: 1152 });
assert.deepEqual(calculateCenterCrop(500, 640), { x: 0, y: 0, width: 500, height: 640 });
assert.deepEqual(calculateCenterCrop(1200, 600, FACE_OUTPUT_SIZE, FACE_OUTPUT_SIZE), { x: 300, y: 0, width: 600, height: 600 });
assert.deepEqual(calculateCenterCrop(600, 1200, FACE_OUTPUT_SIZE, FACE_OUTPUT_SIZE), { x: 0, y: 300, width: 600, height: 600 });
assert.throws(() => calculateCenterCrop(0, 640), /正數/);

const originalSetItem = localStorage.setItem;
localStorage.setItem = () => { throw new Error("quota"); };
assert.equal(saveCharacterSettings(gameState.player).ok, false);
localStorage.setItem = originalSetItem;

saveCharacterSettings(gameState.player);
const storedCharacter = loadCharacterSettings();
assert.equal(storedCharacter.buildId, "senior");
assert.equal(storedCharacter.selectedFaceId, FACE_ASSETS[1].id);
assert.equal(storedCharacter.customClothes, "data:image/webp;base64,clothes");
assert.equal(storedCharacter.avatar, "data:image/webp;base64,avatar");
applyBuildToPlayer(gameState.player, "high-school");

applyActivityResult({ staminaDelta: -25, moneyDelta: 50, scoreDelta: 10, progressCost: 2, sourceId: "test-work" });
assert.equal(gameState.player.stamina, 95);
assert.equal(gameState.player.money, 650);
assert.equal(gameState.player.score, 10);
assert.equal(gameState.progress.actionCount, 2);

applyActivityResult({ scoreDelta: 90, progressCost: 0, sourceId: "score-test" });
const negativeScoreResult = applyActivityResult({ scoreDelta: -50, progressCost: 0, sourceId: "negative-score-test" });
assert.equal(negativeScoreResult.scoreDelta, 0);
assert.equal(gameState.player.score, 100);

applyActivityResult({ staminaDelta: 999, progressCost: 0, sourceId: "food-test" });
assert.equal(gameState.player.stamina, gameState.player.maxStamina);

gameState.activeEvents.push({ id: "temporary" });
gameState.statistics.eventHistory.push("temporary");
createNewGame({ buildId: "worker" });
assert.deepEqual(gameState.activeEvents, []);
assert.deepEqual(gameState.statistics.eventHistory, []);
assert.equal(gameState.player.money, 1000);
assert.equal(getPlayerDisplayName(gameState.player), "-沒輸入名稱-");
assert.equal(gameState.player.buildId, "worker");

startNightMarketFromHome("首頁玩家");
assert.equal(gameState.session.scene, "NIGHT_MARKET");
assert.equal(gameState.player.name, "首頁玩家");
assert.equal(gameState.player.profile.avatar, "data:image/webp;base64,avatar");
assert.equal(gameState.player.buildId, CONFIG.defaults.buildId);
assert.equal(gameState.player.money, 1000);

const stall = createStall({ id: "test", name: "測試攤", type: STALL_TYPES.GAME, interactionType: INTERACTION_TYPES.GAME });
assert.ok(stall.life >= CONFIG.stallLife.min && stall.life <= CONFIG.stallLife.max);
const achievement = createAchievement({ id: "test", name: "測試成就", description: "測試" });
assert.equal(achievement.unlocked, false);

assert.equal(STALL_CONFIG.length, 7);
assert.equal(gameState.stalls.length, 7);
assert.equal(gameState.stalls.filter((item) => item.type === STALL_TYPES.GAME).length, 3);
assert.equal(gameState.stalls.filter((item) => item.type === STALL_TYPES.FOOD).length, 2);
assert.ok(gameState.stalls.some((item) => item.id === "management" && item.isSpecial));
assert.ok(gameState.stalls.some((item) => item.id === "clothing" && item.isSpecial));
assert.equal(gameState.session.selectedStallId, gameState.stalls[0].id);
assert.deepEqual(CHARACTER_LAYER_NAMES, ["clothes", "face", "accessory"]);

const firstStallId = gameState.stalls[0].id;
const lastStallId = gameState.stalls.at(-1).id;
assert.equal(cycleStallId(gameState.stalls, firstStallId, -1), lastStallId);
assert.equal(cycleStallId(gameState.stalls, lastStallId, 1), firstStallId);
assert.equal(selectStallAndScroll("food_01"), true);
assert.equal(gameState.session.selectedStallId, "food_01");
assert.equal(selectStallAndScroll("missing-stall"), false);

const normalView = getStallViewState(gameState.stalls[0], gameState.environment);
assert.equal(normalView.canEnter, true);
assert.equal(normalView.code, STALL_DISPLAY_STATUS.OPEN);
assert.equal(normalView.label, "營業中");
assert.ok(normalView.lifeText.startsWith("剩餘："));
assert.equal(normalView.notice, "");
const specialView = getStallViewState(gameState.stalls.find((item) => item.id === "management"), gameState.environment);
assert.equal(specialView.lifeText, null);

assert.equal(setStallClosed(firstStallId, true), true);
assert.equal(getStallViewState(gameState.stalls[0], gameState.environment).canEnter, false);
assert.equal(getStallDisplayStatus(gameState.stalls[0], gameState.environment).code, STALL_DISPLAY_STATUS.CLOSED);
assert.equal(getStallViewState(gameState.stalls[0], gameState.environment).statusText, "今日公休");
assert.equal(getStallViewState(gameState.stalls[0], gameState.environment).notice, "今天休攤。");
setStallClosed(firstStallId, false);
setInfluencer(true, firstStallId);
assert.equal(getStallViewState(gameState.stalls[0], gameState.environment).isBlocked, true);
assert.equal(getStallViewState(gameState.stalls[0], gameState.environment).canEnter, false);
assert.equal(getStallViewState(gameState.stalls[0], gameState.environment).label, "網紅佔領中");
setInfluencer(false);

assert.equal(setEnvironmentFlag("raining", true), true);
assert.equal(setEnvironmentFlag("mosquito", true), true);
assert.equal(gameState.environment.raining, true);
assert.equal(gameState.environment.mosquito, true);
assert.equal(setEnvironmentFlag("unknown", true), false);
assert.equal(getEnvironmentStageView(gameState.environment).code, "rain");
assert.equal(getEnvironmentStageView(gameState.environment).mosquito, true);

const resourceSnapshot = JSON.stringify({ player: gameState.player, progress: gameState.progress, life: gameState.stalls.map((item) => item.life) });
assert.match(getStallPlaceholderCopy(gameState.stalls[0]).message, /Step 4/);
assert.match(getStallPlaceholderCopy(gameState.stalls.find((item) => item.id === "management")).message, /管理處/);
assert.match(getStallPlaceholderCopy(gameState.stalls.find((item) => item.id === "clothing")).message, /服飾店/);
assert.equal(JSON.stringify({ player: gameState.player, progress: gameState.progress, life: gameState.stalls.map((item) => item.life) }), resourceSnapshot);

assert.equal(completeCharacterSetup(), true);
assert.equal(gameState.session.scene, "NIGHT_MARKET");
assert.equal(gameState.progress.actionCount, 0);
assert.equal(gameState.statistics.totalActions, 0);

createNewGame({ buildId: "worker" });
setStallClosed("game_01", true);
assert.equal(playTestGame("game_01"), false);
setStallClosed("game_01", false);
setInfluencer(true, "game_01");
assert.equal(playTestGame("game_01"), false);
setInfluencer(false);
const startingEnvironment = JSON.stringify(gameState.environment);
const startingLife = Object.fromEntries(gameState.stalls.filter((item) => item.type === STALL_TYPES.GAME).map((item) => [item.id, item.life]));
assert.deepEqual(TEST_GAME_RESULTS.game_01, { staminaDelta: -10, scoreDelta: 20, moneyDelta: 50, completed: true, progressCost: 1, sourceId: "game_01" });
assert.deepEqual(TEST_GAME_RESULTS.game_02, { staminaDelta: -10, scoreDelta: 10, moneyDelta: 100, completed: true, progressCost: 1, sourceId: "game_02" });
assert.deepEqual(TEST_GAME_RESULTS.game_03, { staminaDelta: -10, scoreDelta: 30, moneyDelta: 20, completed: true, progressCost: 1, sourceId: "game_03" });
assert.equal(playTestGame("game_01").sourceId, "game_01");
assert.deepEqual([gameState.player.stamina, gameState.player.score, gameState.player.money], [90, 20, 1050]);
assert.equal(playTestGame("game_02").sourceId, "game_02");
assert.deepEqual([gameState.player.stamina, gameState.player.score, gameState.player.money], [80, 30, 1150]);
assert.equal(playTestGame("game_03").sourceId, "game_03");
assert.deepEqual([gameState.player.stamina, gameState.player.score, gameState.player.money], [70, 60, 1170]);
assert.equal(gameState.progress.actionCount, 3);
assert.equal(gameState.statistics.totalActions, 3);
assert.deepEqual(gameState.statistics.gamePlays, { game_01: 1, game_02: 1, game_03: 1 });
assert.deepEqual(gameState.statistics.stallVisits, { game_01: 1, game_02: 1, game_03: 1 });
for (const id of Object.keys(startingLife)) assert.equal(gameState.stalls.find((item) => item.id === id).life, startingLife[id] - 1);
assert.equal(JSON.stringify(gameState.environment), startingEnvironment);
assert.equal(gameState.session.presentation.type, "ACTIVITY_RESULT");
const gameplaySnapshot = JSON.stringify({ player: gameState.player, progress: gameState.progress, statistics: gameState.statistics, life: gameState.stalls.map((item) => item.life) });
assert.equal(playTestGame("food_01"), false);
assert.equal(playTestGame("management"), false);
assert.equal(playTestGame("clothing"), false);
assert.equal(JSON.stringify({ player: gameState.player, progress: gameState.progress, statistics: gameState.statistics, life: gameState.stalls.map((item) => item.life) }), gameplaySnapshot);
const zeroLifeStall = gameState.stalls.find((item) => item.id === "game_01");
zeroLifeStall.life = 0;
assert.equal(playTestGame("game_01"), false);
assert.equal(zeroLifeStall.life, 0);
saveCharacterSettings(gameState.player);
assert.equal(Object.hasOwn(JSON.parse(localStorage.getItem("nightMarketLife.characterSettings.v1")), "presentation"), false);
clearActivityResultPresentation();
assert.equal(gameState.session.presentation, null);

const nightMarketMarkup = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const nightMarketStyles = readFileSync(new URL("../style.css", import.meta.url), "utf8");
assert.doesNotMatch(nightMarketMarkup, /data-stall-carousel|data-stall-direction|market-character|go-home-button|data-stall-life-row|營業耐久/);
assert.match(nightMarketMarkup, /data-environment-stage/);
assert.match(nightMarketMarkup, /data-stall-grid/);
assert.match(nightMarketMarkup, /id="stall-detail-dialog"/);
assert.match(nightMarketMarkup, /data-selected-stall="stamina"/);
assert.match(nightMarketMarkup, /data-activity-result/);
assert.match(nightMarketMarkup, /data-upload="avatar"/);
assert.match(nightMarketMarkup, /result-identity[\s\S]*data-avatar-image/);
assert.match(nightMarketStyles, /\.stall-grid\s*\{[^}]*overflow-y:auto/s);
assert.match(nightMarketStyles, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(nightMarketStyles, /\.avatar-frame\s*\{[^}]*border-radius:50%/s);

// Step 4B+C: Food, failed entry, actual deltas and automatic closure.
const { buyFood, getStallEntryFailure } = await import("../js/game.js");
const { FOOD_CONFIG, consumeStallLife } = await import("../js/stalls.js");
const { LOW_STAMINA_MESSAGES, NO_MONEY_MESSAGES, pickRandomMessage } = await import("../js/config.js");
assert.deepEqual(FOOD_CONFIG.food_01, { price: 100, staminaRecovery: 15 });
assert.deepEqual(FOOD_CONFIG.food_02, { price: 200, staminaRecovery: 30 });
assert.ok(LOW_STAMINA_MESSAGES.length > 1 && NO_MONEY_MESSAGES.length > 1);
assert.equal(pickRandomMessage(LOW_STAMINA_MESSAGES, () => 0), LOW_STAMINA_MESSAGES[0]);
assert.equal(pickRandomMessage(NO_MONEY_MESSAGES, () => .999), NO_MONEY_MESSAGES.at(-1));
const findStall = (id) => gameState.stalls.find((item) => item.id === id);
let storageWrites = 0;
const failureTestSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = (...args) => { storageWrites += 1; return failureTestSetItem(...args); };
const snapshot = () => JSON.stringify({ player: gameState.player, progress: gameState.progress, statistics: gameState.statistics, stalls: gameState.stalls, environment: gameState.environment, storage: [...localStorage.values], storageWrites });
for (const [id, price, recovery] of [["food_01", 100, 15], ["food_02", 200, 30]]) {
  createNewGame({ buildId: "worker" });
  gameState.player.stamina = 50;
  const life = findStall(id).life;
  const environment = JSON.stringify(gameState.environment);
  const nextEvent = gameState.progress.nextEventAt;
  gameState.progress.actionCount = 0;
  const food = buyFood(id);
  assert.equal(food.appliedDeltas.staminaDelta, recovery);
  assert.equal(gameState.player.stamina, 50 + recovery);
  assert.equal(gameState.player.money, 1000 - price);
  assert.equal(gameState.statistics.foodPurchases, 1);
  assert.equal(gameState.statistics.stallVisits[id], 1);
  assert.equal(gameState.statistics.totalActions, 1);
  assert.equal(gameState.progress.actionCount, 1);
  assert.equal(gameState.progress.nextEventAt, nextEvent);
  assert.equal(JSON.stringify(gameState.environment), environment);
  assert.equal(findStall(id).life, life - 1);
}
createNewGame({ buildId: "worker" });
playTestGame("game_01");
clearActivityResultPresentation();
const clampedFood = buyFood("food_01");
assert.deepEqual([gameState.player.stamina, gameState.player.score, gameState.player.money], [100, 20, 950]);
assert.equal(clampedFood.staminaDelta, 15);
assert.equal(clampedFood.appliedDeltas.staminaDelta, 10);
assert.equal(gameState.session.presentation.staminaDelta, 10);
assert.match(gameState.session.presentation.title, /補充完成/);
assert.equal(buyFood("food_01").appliedDeltas.staminaDelta, 0);
assert.equal(gameState.player.money, 850);
assert.equal(gameState.progress.actionCount, 3);
assert.equal(gameState.statistics.foodPurchases, 2);

for (const [id, action, resource, available, needed, code] of [
  ["game_01", playTestGame, "stamina", 9, 10, "LOW_STAMINA"],
  ["food_01", buyFood, "money", 99, 100, "NO_MONEY"]
]) {
  createNewGame({ buildId: "worker" });
  gameState.player[resource] = available;
  const failure = getStallEntryFailure(findStall(id), () => 0);
  assert.equal(failure.code, code);
  assert.equal(failure.current, available);
  assert.equal(failure.required, needed);
  assert.ok(failure.detail.includes(String(available)) && failure.detail.includes(String(needed)));
  const before = snapshot();
  assert.equal(action(id), false);
  assert.equal(snapshot(), before);
  gameState.player[resource] = needed;
  assert.ok(action(id));
  assert.equal(gameState.player[resource], 0);
}
for (const [id, action] of [["game_01", playTestGame], ["food_01", buyFood]]) {
  createNewGame({ buildId: "worker" });
  const target = findStall(id);
  setInfluencer(true, id);
  const blocked = snapshot();
  assert.equal(action(id), false);
  assert.equal(snapshot(), blocked);
  setInfluencer(false);
  target.life = 1;
  assert.ok(action(id));
  assert.equal(target.life, 0);
  assert.equal(target.isClosed, true);
  setInfluencer(true, id);
  assert.equal(getStallDisplayStatus(target, gameState.environment).code, "CLOSED");
  assert.equal(getStallDisplayStatus(target, gameState.environment).canEnter, false);
  const closed = snapshot();
  assert.equal(action(id), false);
  assert.equal(snapshot(), closed);
  consumeStallLife(target);
  assert.equal(target.life, 0);
}
for (const id of ["management", "clothing"]) {
  const special = findStall(id);
  consumeStallLife(special);
  assert.equal(special.life, null);
  assert.equal(special.isClosed, false);
  assert.equal(getStallDisplayStatus(special, gameState.environment).canEnter, true);
}
clearActivityResultPresentation();
// Step 4D deterministic lifecycle, modifiers and presentation sequencing.
const { createGameState, createProgress } = await import("../js/state.js");
const { getNextEventInterval, getEligibleEnvironmentEvents, pickEnvironmentEvent, pickLevelDelta, prepareEnvironmentEvent, commitPendingEnvironmentEvent, triggerEnvironmentEvent: triggerStateEvent, checkEnvironmentEvent, pickInfluencerTarget, moveInfluencer, getEffectiveGameStaminaCost, getEffectiveFoodPrice, applyRewardModifier } = await import("../js/events.js");
// Existing event-effect regression cases explicitly confirm their prepared event.
const applyEnvironmentEvent = (state, id, randomFn) => {
  const pending = prepareEnvironmentEvent(state, id, randomFn);
  return pending ? commitPendingEnvironmentEvent(state, pending, randomFn) : null;
};
const { advancePresentation, acknowledgeEnvironmentEvent, triggerEnvironmentEvent: debugTriggerEvent } = await import("../js/game.js");
assert.equal(getNextEventInterval(() => 0), 4);
assert.equal(getNextEventInterval(() => .5), 5);
assert.equal(getNextEventInterval(() => .999), 6);
assert.equal(createProgress(() => 0).nextEventAt, 4);
assert.equal(pickLevelDelta(() => 0), 1);
assert.equal(pickLevelDelta(() => .9), 2);
let eventState = createGameState();
eventState.progress.nextEventAt = 4;
eventState.progress.actionCount = 3;
assert.equal(checkEnvironmentEvent(eventState, () => 0), null);
assert.equal(eventState.statistics.eventHistory.length, 0);
eventState.progress.actionCount = 4;
assert.equal(checkEnvironmentEvent(eventState, () => 0).eventId, "RAIN_START");
assert.equal(eventState.environment.raining, false);
assert.equal(eventState.progress.nextEventAt, 4);
assert.equal(eventState.statistics.eventHistory.length, 0);
commitPendingEnvironmentEvent(eventState, eventState.session.pendingEnvironmentEvent, () => 0);
assert.equal(eventState.progress.nextEventAt, 8);
assert.equal(eventState.statistics.eventHistory.length, 1);
assert.equal(eventState.statistics.eventHistory[0].actionCount, 4);
assert.equal(checkEnvironmentEvent(eventState, () => 0), null);
assert.equal(pickEnvironmentEvent(eventState, () => 0), "RAIN_STOP");
assert.ok(!getEligibleEnvironmentEvents(eventState.environment).includes("RAIN_START"));
assert.equal(applyEnvironmentEvent(eventState, "RAIN_START", () => 0), null);
applyEnvironmentEvent(eventState, "RAIN_STOP", () => 0);
assert.equal(eventState.environment.raining, false);
assert.ok(!getEligibleEnvironmentEvents(eventState.environment).includes("RAIN_STOP"));
applyEnvironmentEvent(eventState, "MOSQUITO_START", () => 0);
assert.equal(eventState.environment.mosquito, true);
assert.ok(!getEligibleEnvironmentEvents(eventState.environment).includes("MOSQUITO_START"));
applyEnvironmentEvent(eventState, "MOSQUITO_STOP", () => 0);
assert.equal(eventState.environment.mosquito, false);
for (const [prefix, key, min, max] of [["CROWD", "crowdLevel", 1, 5], ["PRICE", "priceLevel", 0, CONFIG.priceMultipliers.length - 1], ["REWARD", "rewardLevel", 0, CONFIG.rewardMultipliers.length - 1]]) {
  eventState.environment[key] = max - 1;
  applyEnvironmentEvent(eventState, `${prefix}_UP`, () => .99);
  assert.equal(eventState.environment[key], max);
  assert.ok(!getEligibleEnvironmentEvents(eventState.environment).includes(`${prefix}_UP`));
  applyEnvironmentEvent(eventState, `${prefix}_DOWN`, () => 0);
  assert.equal(eventState.environment[key], max - 1);
  eventState.environment[key] = min + 1;
  applyEnvironmentEvent(eventState, `${prefix}_DOWN`, () => .99);
  assert.equal(eventState.environment[key], min);
  assert.ok(!getEligibleEnvironmentEvents(eventState.environment).includes(`${prefix}_DOWN`));
  applyEnvironmentEvent(eventState, `${prefix}_UP`, () => .99);
  assert.equal(eventState.environment[key], min + 2);
}
eventState = createGameState();
eventState.stalls[0].isClosed = true;
applyEnvironmentEvent(eventState, "INFLUENCER", () => 0);
assert.equal(eventState.environment.influencer, true);
assert.equal(eventState.environment.influencerBlockedStallId, "game_02");
assert.ok(!getEligibleEnvironmentEvents(eventState.environment).includes("INFLUENCER"));
moveInfluencer(eventState, () => 0);
assert.equal(eventState.environment.influencerBlockedStallId, "game_03");
for (const s of eventState.stalls) if (s.id !== "game_03") s.isClosed = true;
assert.equal(pickInfluencerTarget(eventState.stalls, "game_03", () => 0), "game_03");
eventState.stalls.find(s => s.id === "game_03").isClosed = true;
assert.equal(pickInfluencerTarget(eventState.stalls, "game_03", () => 0), null);
moveInfluencer(eventState, () => 0);
assert.equal(eventState.environment.influencerBlockedStallId, null);
assert.equal(eventState.environment.influencer, true);
assert.equal(triggerStateEvent(eventState, () => 0).eventId, "INFLUENCER_LEAVE");
assert.equal(eventState.environment.influencer, true);
commitPendingEnvironmentEvent(eventState);
assert.equal(eventState.environment.influencer, false);
assert.equal(eventState.environment.influencerBlockedStallId, null);
eventState = createGameState();
applyEnvironmentEvent(eventState, "INFLUENCER", () => 0);
const remainingEvent = triggerStateEvent(eventState, () => .9);
assert.notEqual(remainingEvent.eventId, "INFLUENCER");
assert.notEqual(remainingEvent.eventId, "INFLUENCER_LEAVE");
assert.equal(eventState.environment.influencer, true);
commitPendingEnvironmentEvent(eventState);
assert.equal(eventState.statistics.eventHistory.length, 2);

createNewGame({ buildId: "worker" });
gameState.environment.raining = true;
assert.equal(getEffectiveGameStaminaCost(findStall("game_01"), gameState.environment), 15);
assert.equal(getEffectiveGameStaminaCost(findStall("food_01"), gameState.environment), 0);
gameState.player.stamina = 14;
gameState.progress.nextEventAt = 0;
const rainFailure = snapshot();
assert.equal(playTestGame("game_01", () => 0), false);
assert.equal(snapshot(), rainFailure);
assert.equal(getStallEntryFailure(findStall("game_01")).required, 15);
gameState.progress.nextEventAt = 100;
gameState.player.stamina = 15;
assert.ok(playTestGame("game_01", () => 0));
assert.equal(gameState.player.stamina, 0);
applyEnvironmentEvent(gameState, "RAIN_STOP", () => 0);
assert.equal(getEffectiveGameStaminaCost(findStall("game_01"), gameState.environment), 10);

createNewGame({ buildId: "worker" });
gameState.environment.mosquito = true;
assert.equal(playTestGame("game_01", () => 0).appliedDeltas.staminaDelta, -15);
assert.equal(gameState.player.stamina, 85);
assert.equal(gameState.session.presentation.staminaDelta, -15);
assert.equal(gameState.statistics.mosquitoActions, 1);
gameState.player.stamina = 10;
assert.ok(playTestGame("game_02", () => 0));
assert.equal(gameState.player.stamina, 0);
const mosquitoFailure = snapshot();
assert.equal(playTestGame("game_03", () => 0), false);
assert.equal(snapshot(), mosquitoFailure);
createNewGame({ buildId: "worker" }); // isolate the resource notification from the next calculation
gameState.environment.mosquito = true;
gameState.player.stamina = 100;
gameState.progress.nextEventAt = 100;
assert.equal(buyFood("food_01", () => 0).appliedDeltas.staminaDelta, -5);
assert.equal(gameState.player.stamina, 95); // recovery clamp first, mosquito afterwards
assert.equal(gameState.statistics.mosquitoActions, 1);

createNewGame({ buildId: "worker" });
gameState.environment.priceLevel = 2;
gameState.environment.rewardLevel = 2;
assert.equal(getEffectiveFoodPrice(findStall("food_01"), gameState.environment), 120);
assert.equal(getEffectiveFoodPrice({ price: 101 }, gameState.environment), 121);
gameState.player.money = 119;
assert.equal(getStallEntryFailure(findStall("food_01")).required, 120);
const priceFailure = snapshot();
assert.equal(buyFood("food_01", () => 0), false);
assert.equal(snapshot(), priceFailure);
gameState.player.money = 120;
gameState.player.stamina = 50;
assert.ok(buyFood("food_01", () => 0));
assert.equal(gameState.player.money, 0);
assert.equal(gameState.player.stamina, 65);
createNewGame({ buildId: "worker" }); // isolate the resource notification from the reward calculation
gameState.environment.rewardLevel = 2;
gameState.player.money = 0;
assert.equal(playTestGame("game_01", () => 0).scoreDelta, 24);
assert.equal(gameState.player.money, 60);
assert.deepEqual(applyRewardModifier({ moneyDelta: -50, scoreDelta: -20 }, gameState.environment), { moneyDelta: -50, scoreDelta: -20 });
assert.deepEqual(applyRewardModifier({ moneyDelta: 11, scoreDelta: 3 }, gameState.environment), { moneyDelta: 13, scoreDelta: 4 });

createNewGame({ buildId: "worker" });
gameState.progress.nextEventAt = 1;
const firstActual = playTestGame("game_01", () => 0);
assert.equal(firstActual.appliedDeltas.staminaDelta, -10); // event affects next action, not this one
assert.equal(gameState.environment.raining, false);
assert.equal(gameState.progress.nextEventAt, 1);
assert.equal(gameState.session.presentation.type, "ACTIVITY_RESULT");
assert.equal(gameState.session.presentationQueue.length, 1);
assert.equal(gameState.session.presentationQueue[0].type, "ENVIRONMENT_EVENT_MODAL");
advancePresentation();
assert.equal(gameState.session.presentation.eventId, "RAIN_START");
assert.equal(gameState.session.presentation.type, "ENVIRONMENT_EVENT_MODAL");
assert.equal(advancePresentation(), false);
acknowledgeEnvironmentEvent();
assert.equal(gameState.session.presentation, null);
assert.equal(gameState.environment.raining, true);
debugTriggerEvent(() => 0);
assert.equal(gameState.environment.raining, true);
assert.equal(gameState.session.presentation.eventId, "RAIN_STOP");
const stalePresentation = gameState.session.presentation;
createNewGame({ buildId: "worker" });
assert.equal(gameState.session.presentation, null);
assert.deepEqual(gameState.session.presentationQueue, []);
assert.equal(advancePresentation(stalePresentation), false);
assert.equal(gameState.session.presentation, null);
setInfluencer(true, "game_01");
gameState.progress.nextEventAt = 100;
let moveRandomCalls = 0;
buyFood("food_01", () => { moveRandomCalls += 1; return 0; });
assert.equal(moveRandomCalls, 1);
assert.equal(gameState.environment.influencerBlockedStallId, "game_02");
assert.equal(gameState.statistics.eventHistory.length, 0);
clearActivityResultPresentation();
// Step 4D UX patch: all event UI data, modal lifecycle and render idempotence.
const { getEnvironmentEventUI, EVENT_MESSAGES } = await import("../js/events.js");
const { render, changeScene } = await import("../js/ui.js");
const modalState = createGameState();
modalState.environment.priceLevel = 2;
modalState.environment.rewardLevel = 2;
modalState.environment.crowdLevel = 4;
modalState.environment.influencerBlockedStallId = "game_02";
const expectedEffects = {
  RAIN_START: "遊戲攤體力需求增加 5", RAIN_STOP: "遊戲攤體力需求恢復正常",
  MOSQUITO_START: "每次成功行動額外消耗 5 體力", MOSQUITO_STOP: "不再受到蚊子額外體力消耗",
  INFLUENCER: "🚫 測試遊戲攤 B 暫時無法進入", INFLUENCER_LEAVE: "網紅封鎖解除",
  CROWD_UP: "人潮增加，目前：熱鬧", CROWD_DOWN: "人潮減少，目前：熱鬧",
  PRICE_UP: "食物價格目前為 ×1.2", PRICE_DOWN: "食物價格目前為 ×1.2",
  REWARD_UP: "遊戲獎勵目前為 ×1.2", REWARD_DOWN: "遊戲獎勵目前為 ×1.2"
};
for (const eventId of Object.keys(EVENT_MESSAGES)) {
  const before = JSON.stringify(modalState);
  const data = getEnvironmentEventUI({ eventId }, modalState);
  assert.ok(data.title && data.description);
  assert.deepEqual(data.effectLines, [expectedEffects[eventId]]);
  assert.equal(JSON.stringify(modalState), before);
}
const originalQuery = document.querySelector;
let modalOpens = 0;
const modalFields = {};
const fakeModal = {
  open: false,
  showModal() { this.open = true; modalOpens += 1; },
  close() { this.open = false; },
  querySelector(selector) { return modalFields[selector] ??= { textContent: "" }; }
};
document.querySelector = selector => selector === "#environment-event-dialog" ? fakeModal : null;
createNewGame();
debugTriggerEvent(() => 0);
const pendingModal = gameState.session.presentation;
assert.equal(pendingModal.type, "ENVIRONMENT_EVENT_MODAL");
assert.equal(pendingModal.title, "突然下大雨！");
advancePresentation();
const modalSnapshot = snapshot();
render(gameState); render(gameState);
assert.equal(modalOpens, 1);
assert.equal(fakeModal.open, true);
assert.equal(advancePresentation(), false);
assert.equal(playTestGame("game_01"), false);
assert.equal(buyFood("food_01"), false);
assert.equal(snapshot(), modalSnapshot);
assert.equal(debugTriggerEvent(() => 0), false); // Pending cannot re-draw or queue a second event.
assert.equal(gameState.session.presentation, pendingModal);
assert.equal(acknowledgeEnvironmentEvent(), true);
assert.equal(fakeModal.open, false);
assert.equal(gameState.session.presentation, null);
assert.equal(modalOpens, 1);
debugTriggerEvent(() => 0);
const oldModal = gameState.session.presentation;
createNewGame();
assert.equal(fakeModal.open, false);
assert.equal(advancePresentation(oldModal), false);
assert.deepEqual(gameState.session.presentationQueue, []);
debugTriggerEvent(() => 0);
const oldEvent = gameState.session.presentation;
changeScene(gameState, "HOME");
assert.equal(advancePresentation(oldEvent), false);
assert.deepEqual(gameState.session.presentationQueue, []);
assert.equal(fakeModal.open, false);
assert.equal(acknowledgeEnvironmentEvent(), false);
clearActivityResultPresentation();
document.querySelector = originalQuery;
// Gameplay Flow Revision: zero transitions notify, never end the night.
const { predictStallAction, isInteractionLocked, getResourceZeroWarning } = await import("../js/gameplay.js");
const { acknowledgeResourceWarning, requestEndGame, enterSelectedStall } = await import("../js/game.js");
const freshFlow = () => { createNewGame({ buildId: "worker" }); gameState.progress.nextEventAt = 100; };
for (const [stamina, rain, mosquito, expected] of [[10, false, false, 0], [15, true, false, 0], [15, false, true, 0], [16, false, true, 1]]) {
  freshFlow();
  Object.assign(gameState.player, { stamina });
  Object.assign(gameState.environment, { raining: rain, mosquito });
  const prediction = predictStallAction(gameState, findStall("game_01"));
  assert.equal(prediction.stamina, expected);
  assert.equal(Object.hasOwn(prediction, "warnings"), false);
  assert.ok(playTestGame("game_01", () => 0));
  assert.equal(gameState.player.stamina, expected);
  advancePresentation();
  if (expected === 0) {
    assert.equal(gameState.session.presentation.title, "體力耗盡！");
    assert.equal(advancePresentation(), false);
    const before = snapshot();
    assert.equal(buyFood("food_01"), false);
    assert.equal(snapshot(), before);
    acknowledgeResourceWarning();
    assert.equal(gameState.session.scene, "NIGHT_MARKET");
    assert.equal(gameState.session.endReason, null);
    assert.equal(isInteractionLocked(gameState), false);
    assert.equal(playTestGame("game_01"), false); // entry restriction still applies
    assert.ok(buyFood("food_01"));
    assert.ok(gameState.player.stamina > 0);
    assert.equal(gameState.session.presentationQueue.length, 0);
  } else assert.equal(gameState.session.presentation, null);
}
for (const [stamina, expected] of [[1, 11], [95, 95]]) {
  freshFlow();
  gameState.player.stamina = stamina;
  gameState.environment.mosquito = true;
  assert.equal(predictStallAction(gameState, findStall("food_01")).stamina, expected);
  buyFood("food_01");
  assert.equal(gameState.player.stamina, expected);
}
for (const money of [119, 120, 121]) {
  freshFlow();
  gameState.environment.priceLevel = 2;
  gameState.player.money = money;
  const before = snapshot();
  const result = buyFood("food_01");
  if (money === 119) { assert.equal(result, false); assert.equal(snapshot(), before); continue; }
  assert.ok(result);
  advancePresentation();
  if (money === 120) {
    assert.equal(gameState.session.presentation.title, "身無分文！");
    acknowledgeResourceWarning();
    assert.equal(gameState.session.scene, "NIGHT_MARKET");
    assert.equal(buyFood("food_01"), false);
    assert.ok(playTestGame("game_01")); // money-free game is still legal
    assert.ok(gameState.player.money > 0);
  } else assert.equal(gameState.session.presentation, null);
}
freshFlow();
const beforeUnfinished = snapshot();
applyActivityResult({ staminaDelta: -999, moneyDelta: -9999, completed: false });
assert.equal(snapshot(), beforeUnfinished);
applyActivityResult({ staminaDelta: -999, moneyDelta: -9999 });
assert.equal(gameState.player.stamina, 0);
assert.equal(gameState.player.money, 0);
assert.equal(gameState.session.presentation.title, "又累又窮");
assert.deepEqual(gameState.session.presentation.effectLines, ["❤️ 體力已歸零", "💰 金錢已歸零"]);
assert.equal(gameState.session.presentationQueue.length, 0);
acknowledgeResourceWarning();
assert.equal(gameState.session.scene, "NIGHT_MARKET");
applyActivityResult({ staminaDelta: 0, moneyDelta: 0 });
assert.equal(gameState.session.presentation, null); // already zero: no repeat
assert.equal(getResourceZeroWarning({ stamina: 0, money: 0 }, { stamina: 0, money: 0 }), null);
applyActivityResult({ staminaDelta: 20, moneyDelta: 0 });
assert.ok(playTestGame("game_01")); // money was already zero, does not warn
assert.equal(gameState.session.presentationQueue.length, 0);

freshFlow();
gameState.player.stamina = 10;
gameState.progress.nextEventAt = 1;
playTestGame("game_01", () => 0);
assert.deepEqual(gameState.session.presentationQueue.map(p => p.type), ["ENVIRONMENT_EVENT_MODAL", "RESOURCE_WARNING_MODAL"]);
const actionPresentation = gameState.session.presentation;
assert.equal(isInteractionLocked(gameState), true);
assert.equal(enterSelectedStall(), false);
advancePresentation();
assert.equal(gameState.session.presentation.type, "ENVIRONMENT_EVENT_MODAL"); // exactly one advance, no Stage timer
assert.equal(advancePresentation(actionPresentation), false);
assert.equal(advancePresentation(), false);
acknowledgeEnvironmentEvent();
assert.equal(gameState.session.presentation.type, "RESOURCE_WARNING_MODAL");
assert.equal(isInteractionLocked(gameState), true);
const staleWarning = gameState.session.presentation;
acknowledgeResourceWarning();
assert.equal(gameState.session.scene, "NIGHT_MARKET");
assert.equal(gameState.session.presentation, null);
assert.equal(isInteractionLocked(gameState), false);
assert.equal(gameState.statistics.eventHistory.length, 1);
assert.ok(buyFood("food_01"));
freshFlow();
assert.equal(advancePresentation(staleWarning), false);
assert.equal(acknowledgeResourceWarning(), false);

freshFlow();
gameState.progress.nextEventAt = 1;
playTestGame("game_01", () => 0);
advancePresentation();
acknowledgeEnvironmentEvent();
assert.equal(gameState.session.presentation, null); // option A: visual returns to environment immediately
assert.equal(isInteractionLocked(gameState), false);
assert.ok(playTestGame("game_02"));
clearActivityResultPresentation();
assert.equal(requestEndGame("STAMINA_EXHAUSTED"), false);
assert.equal(requestEndGame("MONEY_EXHAUSTED"), false);
assert.equal(requestEndGame("HOME"), true);
assert.equal(gameState.session.scene, "RESULT");
window.NMLDebug.changeScene("HOME");
assert.equal(gameState.session.endReason, null);

// New Game and HOME clear both pending notification kinds and stale callbacks.
for (const cleanup of [() => createNewGame(), () => window.NMLDebug.changeScene("HOME")]) {
  freshFlow();
  gameState.player.stamina = 10;
  gameState.progress.nextEventAt = 1;
  playTestGame("game_01", () => 0);
  const stale = gameState.session.presentation;
  cleanup();
  assert.deepEqual(gameState.session.presentationQueue, []);
  assert.equal(gameState.session.presentation, null);
  assert.equal(isInteractionLocked(gameState), false);
  assert.equal(advancePresentation(stale), false);
}
const revisionHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
freshFlow();
gameState.progress.nextEventAt = 4;
playTestGame("game_01", () => 0);
const replacedResult = gameState.session.presentation;
for (let i = 0; i < 3; i += 1) playTestGame("game_01", () => 0);
assert.equal(gameState.progress.actionCount, 4);
assert.equal(gameState.session.presentationQueue.length, 1); // no old result backlog before event
assert.equal(advancePresentation(replacedResult), false);
advancePresentation();
assert.equal(gameState.session.presentation.type, "ENVIRONMENT_EVENT_MODAL");
acknowledgeEnvironmentEvent();
assert.equal(isInteractionLocked(gameState), false);
assert.ok(!revisionHtml.includes("data-entry-warning"));
assert.ok(!revisionHtml.includes("end-reason-dialog"));
assert.ok(revisionHtml.includes("resource-warning-dialog"));
clearActivityResultPresentation();

// Environment transactions: all random decisions are prepared once, effects commit once.
freshFlow();
setInfluencer(true, "game_01");
gameState.progress.nextEventAt = 1;
let transactionDraw = 0;
buyFood("food_01", () => ++transactionDraw === 2 ? .99 : 0);
assert.equal(gameState.environment.influencerBlockedStallId, "game_01");
assert.equal(gameState.session.pendingEnvironmentEvent.projected.influencerBlockedStallId, "game_02");
assert.equal(gameState.session.pendingEnvironmentEvent.eventId, "RAIN_START");
advancePresentation();
acknowledgeEnvironmentEvent();
assert.equal(gameState.environment.influencerBlockedStallId, "game_02");
assert.equal(gameState.environment.raining, true);
for (const [id, before, projected] of [
  ["RAIN_START", { raining: false }, { raining: true }],
  ["RAIN_STOP", { raining: true }, { raining: false }],
  ["MOSQUITO_START", { mosquito: false }, { mosquito: true }],
  ["MOSQUITO_STOP", { mosquito: true }, { mosquito: false }],
  ["PRICE_UP", { priceLevel: 1 }, { priceLevel: 2 }],
  ["PRICE_DOWN", { priceLevel: 2 }, { priceLevel: 1 }],
  ["REWARD_UP", { rewardLevel: 1 }, { rewardLevel: 2 }],
  ["REWARD_DOWN", { rewardLevel: 2 }, { rewardLevel: 1 }],
  ["CROWD_UP", { crowdLevel: 3 }, { crowdLevel: 4 }],
  ["CROWD_DOWN", { crowdLevel: 3 }, { crowdLevel: 2 }],
  ["INFLUENCER", { influencer: false, influencerBlockedStallId: null }, { influencer: true, influencerBlockedStallId: "food_01" }],
  ["INFLUENCER_LEAVE", { influencer: true, influencerBlockedStallId: "food_01" }, { influencer: false, influencerBlockedStallId: null }]
]) {
  freshFlow();
  Object.assign(gameState.environment, before);
  const official = JSON.stringify(gameState.environment);
  const history = JSON.stringify(gameState.statistics.eventHistory);
  const threshold = gameState.progress.nextEventAt;
  const pending = prepareEnvironmentEvent(gameState, id, () => id === "INFLUENCER" ? .65 : 0);
  assert.deepEqual(pending.projected, projected);
  assert.equal(JSON.stringify(gameState.environment), official);
  assert.equal(JSON.stringify(gameState.statistics.eventHistory), history);
  assert.equal(gameState.progress.nextEventAt, threshold);
  assert.equal(isInteractionLocked(gameState), true);
  assert.equal(playTestGame("game_01"), false);
  assert.equal(triggerStateEvent(gameState, () => { throw new Error("Pending event redrawn"); }), pending);
  const stablePending = JSON.stringify(pending);
  render(gameState); render(gameState);
  assert.equal(JSON.stringify(gameState.session.pendingEnvironmentEvent), stablePending);
  if (id === "PRICE_UP") assert.match(pending.ui.effectLines[0], /×1\.2/);
  if (id === "RAIN_START") assert.equal(getEffectiveGameStaminaCost(findStall("game_01"), gameState.environment), 10);
  if (id === "INFLUENCER") {
    assert.match(pending.ui.effectLines[0], /測試小吃攤 A/);
    assert.equal(getStallDisplayStatus(findStall("food_01"), gameState.environment).canEnter, true);
  }
  assert.ok(commitPendingEnvironmentEvent(gameState, pending, () => 0));
  for (const [key, value] of Object.entries(projected)) assert.equal(gameState.environment[key], value);
  assert.equal(gameState.session.pendingEnvironmentEvent, null);
  assert.equal(gameState.statistics.eventHistory.length, 1);
  assert.deepEqual(gameState.statistics.eventHistory[0], { eventId: id, actionCount: 0, details: pending.details });
  assert.equal(gameState.progress.nextEventAt, 4);
  assert.equal(commitPendingEnvironmentEvent(gameState, pending), null);
  assert.equal(gameState.statistics.eventHistory.length, 1);
  if (id === "RAIN_START") assert.equal(playTestGame("game_01", () => 0).staminaDelta, -15);
}
freshFlow();
gameState.player.stamina = 10;
gameState.progress.nextEventAt = 1;
playTestGame("game_01", () => 0);
assert.equal(gameState.player.stamina, 0);
assert.equal(gameState.environment.raining, false);
assert.equal(gameState.statistics.eventHistory.length, 0);
const savedWarning = gameState.session.presentationQueue[1];
advancePresentation();
assert.equal(gameState.environment.raining, false);
const notifiedEvent = gameState.session.presentation;
acknowledgeEnvironmentEvent();
assert.equal(gameState.environment.raining, true);
assert.equal(gameState.session.presentation, savedWarning);
assert.equal(acknowledgeEnvironmentEvent(notifiedEvent), false);
acknowledgeResourceWarning();
assert.equal(gameState.session.scene, "NIGHT_MARKET");
assert.equal(isInteractionLocked(gameState), false);
for (const cleanup of [() => createNewGame(), () => window.NMLDebug.changeScene("HOME"), () => changeScene(gameState, "HOME")]) {
  freshFlow();
  debugTriggerEvent(() => 0);
  const pending = gameState.session.pendingEnvironmentEvent;
  const modal = gameState.session.presentation;
  cleanup();
  assert.equal(gameState.session.pendingEnvironmentEvent, null);
  assert.equal(commitPendingEnvironmentEvent(gameState, pending), null);
  assert.equal(acknowledgeEnvironmentEvent(modal), false);
  assert.equal(gameState.environment.raining, false);
  assert.equal(gameState.statistics.eventHistory.length, 0);
  assert.equal(isInteractionLocked(gameState), false);
}
clearActivityResultPresentation();
// Step 5: the office is a read-only conversation, not an Environment dashboard.
const { collectManagementHints, selectManagementHints, getManagementOfficeDialogue, MANAGEMENT_DIALOGUE_POOLS } = await import("../js/management-office.js");
const { openManagementOffice, askManagementOffice } = await import("../js/game.js");
const hiddenTerms = /[0-9×=+]|crowdLevel|priceLevel|rewardLevel|multiplier|Penalty|nextEventAt|Action|INFLUENCER|RAIN_START|MOSQUITO_START|influencerBlockedStallId|倍率|參數|等級|Buff|Debuff/i;
for (const key of ["rain", "mosquito", "influencer"]) assert.ok(MANAGEMENT_DIALOGUE_POOLS[key].length >= 3);
assert.ok(MANAGEMENT_DIALOGUE_POOLS.normal.length >= 5);
for (const pool of Object.values(MANAGEMENT_DIALOGUE_POOLS)) for (const line of pool) assert.doesNotMatch(line, hiddenTerms);
freshFlow();
const normalEnvironment = { ...gameState.environment };
assert.ok(MANAGEMENT_DIALOGUE_POOLS.normal.includes(getManagementOfficeDialogue(normalEnvironment, gameState.stalls, () => 0)));
for (const [change, semantic] of [
  [{ raining: true }, /雨/], [{ mosquito: true }, /蚊子/],
  [{ influencer: true, influencerBlockedStallId: "food_01" }, /測試小吃攤 A/],
  [{ influencer: true, influencerBlockedStallId: null }, /网紅|網紅/],
  [{ crowdLevel: 1 }, /人/], [{ crowdLevel: 5 }, /人/],
  [{ priceLevel: 0 }, /佛心|價錢/], [{ priceLevel: 3 }, /不便宜|價錢/],
  [{ rewardLevel: 0 }, /小氣|獎品/], [{ rewardLevel: 4 }, /敢送|大方/]
]) {
  const environment = { ...normalEnvironment, ...change };
  const before = JSON.stringify({ environment, stalls: gameState.stalls });
  const dialogue = getManagementOfficeDialogue(environment, gameState.stalls, () => 0);
  assert.match(dialogue, semantic);
  assert.doesNotMatch(dialogue, hiddenTerms);
  assert.equal(JSON.stringify({ environment, stalls: gameState.stalls }), before);
}
const busyEnvironment = { ...normalEnvironment, raining: true, mosquito: true, influencer: true, influencerBlockedStallId: "food_01", crowdLevel: 5, priceLevel: 3, rewardLevel: 4 };
const allHints = collectManagementHints(busyEnvironment, gameState.stalls);
assert.equal(allHints.length, 6);
assert.ok(allHints.find(h => h.key === "rain").weight > allHints.find(h => h.key === "price").weight);
const combinations = new Set();
for (let seed = 1; seed <= 100; seed += 1) {
  let value = seed;
  const rng = () => ((value = (value * 1664525 + 1013904223) >>> 0) / 4294967296);
  const hints = selectManagementHints(allHints, rng);
  assert.ok(hints.length >= 2 && hints.length <= 3);
  assert.equal(new Set(hints.map(h => h.key)).size, hints.length);
  combinations.add(hints.map(h => h.key).join("|"));
  assert.doesNotMatch(getManagementOfficeDialogue(busyEnvironment, gameState.stalls, rng), hiddenTerms);
}
assert.ok(combinations.size > 1);
const officeFields = {};
const officeModal = { open: false, showModal() { this.open = true; }, close() { this.open = false; }, querySelector(selector) { return officeFields[selector] ??= { textContent: "" }; } };
const beforeOfficeQuery = document.querySelector;
document.querySelector = selector => selector === "#management-office-dialog" ? officeModal : null;
freshFlow();
const officeStateSnapshot = JSON.stringify(gameState);
const officeStorageSnapshot = JSON.stringify([...localStorage.values]);
assert.equal(askManagementOffice(), false);
assert.equal(openManagementOffice(), true);
for (let i = 0; i < 20; i += 1) assert.equal(typeof askManagementOffice(() => i / 20), "string");
assert.equal(officeFields['[data-action="ask-management"]'].textContent, "再問問看");
officeModal.close();
assert.equal(JSON.stringify(gameState), officeStateSnapshot);
assert.equal(JSON.stringify([...localStorage.values]), officeStorageSnapshot);
assert.equal(findStall("management").life, null);
assert.equal(openManagementOffice(), true);
debugTriggerEvent(() => 0);
assert.equal(officeModal.open, false);
assert.equal(gameState.environment.raining, false);
assert.ok(MANAGEMENT_DIALOGUE_POOLS.normal.includes(getManagementOfficeDialogue(gameState.environment, gameState.stalls, () => 0)));
const pendingOfficeSnapshot = JSON.stringify(gameState);
assert.equal(openManagementOffice(), false);
assert.equal(askManagementOffice(), false);
assert.equal(JSON.stringify(gameState), pendingOfficeSnapshot);
acknowledgeEnvironmentEvent();
assert.equal(openManagementOffice(), true);
assert.match(askManagementOffice(() => 0), /雨/);
createNewGame();
assert.equal(officeModal.open, false);
assert.equal(openManagementOffice(), true);
window.NMLDebug.changeScene("HOME");
assert.equal(officeModal.open, false);
assert.equal(openManagementOffice(), false);
document.querySelector = beforeOfficeQuery;
clearActivityResultPresentation();
await import("./achievements.test.mjs");
await import("./openings.test.mjs");
console.log("NightMarketLife core tests: PASS");
