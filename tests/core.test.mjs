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
const { createAchievement, ACHIEVEMENT_RARITIES } = await import("../js/achievements.js");
const { gameState } = await import("../js/state.js");
const { createNewGame, applyActivityResult, clearActivityResultPresentation, completeCharacterSetup, getStallPlaceholderCopy, playTestGame, selectStallAndScroll, setEnvironmentFlag, setInfluencer, setStallClosed, startNightMarketFromHome } = await import("../js/game.js");
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
const achievement = createAchievement({ id: "test", name: "測試成就", rarity: ACHIEVEMENT_RARITIES.COMMON, description: "測試" });
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
assert.ok(playTestGame("game_01"));
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

console.log("NightMarketLife core tests: PASS");
