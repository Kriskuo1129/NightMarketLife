import assert from "node:assert/strict";

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
const { createStall, STALL_TYPES, INTERACTION_TYPES } = await import("../js/stalls.js");
const { createAchievement, ACHIEVEMENT_RARITIES } = await import("../js/achievements.js");
const { gameState } = await import("../js/state.js");
const { createNewGame, applyActivityResult } = await import("../js/game.js");
const { applyBuildToPlayer, getPlayerDisplayName } = await import("../js/character.js");
const { cycleAsset, changeClothes, changeFace, setCustomAppearance } = await import("../js/character-setup.js");
const { FACE_ASSETS, DEFAULT_CLOTHES, SHOP_CLOTHES } = await import("../assets/character-assets.js");
const { validateImageFile, calculateCenterCrop, MAX_UPLOAD_BYTES, CLOTHES_OUTPUT_WIDTH, CLOTHES_OUTPUT_HEIGHT } = await import("../js/uploads.js");
const { saveCharacterSettings, loadCharacterSettings } = await import("../js/storage.js");

assert.deepEqual(CONFIG.characterBuilds.map(({ name, stamina, money }) => ({ name, stamina, money })), [
  { name: "高中生", stamina: 120, money: 600 },
  { name: "大學生", stamina: 110, money: 800 },
  { name: "社會人", stamina: 100, money: 1000 },
  { name: "中年人", stamina: 85, money: 1300 },
  { name: "老年人", stamina: 70, money: 1600 }
]);

createNewGame({ name: "測試者", buildId: "high-school" });
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
assert.deepEqual(calculateCenterCrop(1000, 1000), { x: 109.375, y: 0, width: 781.25, height: 1000 });
assert.deepEqual(calculateCenterCrop(1600, 900), { x: 448.4375, y: 0, width: 703.125, height: 900 });
assert.deepEqual(calculateCenterCrop(900, 1600), { x: 0, y: 224, width: 900, height: 1152 });
assert.deepEqual(calculateCenterCrop(500, 640), { x: 0, y: 0, width: 500, height: 640 });
assert.throws(() => calculateCenterCrop(0, 640), /正數/);

saveCharacterSettings(gameState.player);
const storedCharacter = loadCharacterSettings();
assert.equal(storedCharacter.buildId, "senior");
assert.equal(storedCharacter.selectedFaceId, FACE_ASSETS[1].id);
assert.equal(storedCharacter.customClothes, "data:image/webp;base64,clothes");
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

const stall = createStall({ id: "test", name: "測試攤", type: STALL_TYPES.GAME, interactionType: INTERACTION_TYPES.GAME });
assert.ok(stall.life >= CONFIG.stallLife.min && stall.life <= CONFIG.stallLife.max);
const achievement = createAchievement({ id: "test", name: "測試成就", rarity: ACHIEVEMENT_RARITIES.COMMON, description: "測試" });
assert.equal(achievement.unlocked, false);

console.log("NightMarketLife core tests: PASS");
