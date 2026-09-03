import { CONFIG, getBuildById, LOW_STAMINA_MESSAGES, NO_MONEY_MESSAGES, pickRandomMessage } from "./config.js";
import { gameState, resetGameState } from "./state.js";
import { clearCharacterSettings, loadCharacterSettings, saveCharacterSettings } from "./storage.js";
import { SCENES, changeScene, getSelectedStall, render, renderBuildOptions, scrollSelectedStallIntoView, selectStall, setStatus } from "./ui.js";
import { consumeStallLife, FOOD_CONFIG, getStallDisplayStatus, STALL_CONFIG, STALL_TYPES, TEST_GAME_RESULTS } from "./stalls.js";
import { applyBuildToPlayer } from "./character.js";
import { changeClothes, changeFace, setCustomAppearance } from "./character-setup.js";
import { processCustomClothesImage, processCustomFaceImage } from "./uploads.js";
import { DEFAULT_CLOTHES, FACE_ASSETS, SHOP_CLOTHES } from "../assets/character-assets.js";
import { applyRewardModifier, checkEnvironmentEvent, EVENT_MESSAGES, getEffectiveFoodPrice, getEffectiveGameStaminaCost, moveInfluencer, triggerEnvironmentEvent as triggerEvent } from "./events.js";

export function normalizeActivityResult(result = {}) {
  return {
    staminaDelta: Number(result.staminaDelta ?? 0),
    moneyDelta: Number(result.moneyDelta ?? 0),
    scoreDelta: Math.max(0, Number(result.scoreDelta ?? 0)),
    completed: result.completed ?? true,
    progressCost: Math.max(0, Number(result.progressCost ?? 1)),
    sourceId: String(result.sourceId ?? "")
  };
}

export function applyActivityResult(result, { mosquito = false } = {}) {
  const activity = normalizeActivityResult(result);
  if (![activity.staminaDelta, activity.moneyDelta, activity.scoreDelta, activity.progressCost].every(Number.isFinite)) {
    throw new TypeError("ActivityResult numeric fields must be finite numbers.");
  }
  if (!activity.completed) return activity;
  const player = gameState.player;
  const before = { stamina: player.stamina, money: player.money, score: player.score };
  player.stamina = Math.min(player.maxStamina, Math.max(0, player.stamina + activity.staminaDelta));
  if (mosquito) {
    player.stamina = Math.max(0, player.stamina - CONFIG.mosquitoStaminaPenalty);
    gameState.statistics.mosquitoActions += 1;
  }
  player.money += activity.moneyDelta;
  player.score += activity.scoreDelta;
  gameState.progress.actionCount += activity.progressCost;
  gameState.statistics.totalActions += activity.progressCost;
  gameState.session.lastActivitySourceId = activity.sourceId || null;
  render(gameState);
  return { ...activity, appliedDeltas: {
    staminaDelta: player.stamina - before.stamina,
    moneyDelta: player.money - before.money,
    scoreDelta: player.score - before.score
  } };
}

export const handleExternalGameResult = (result) => applyActivityResult(result);

const ACTIVITY_PRESENTATION_DURATION = 2400;
let activityPresentationTimer = null;

export function clearActivityResultPresentation(presentation = gameState.session.presentation) {
  if (presentation && gameState.session.presentation !== presentation) return false;
  if (activityPresentationTimer !== null) clearTimeout(activityPresentationTimer);
  gameState.session.presentation = null;
  gameState.session.presentationQueue = [];
  activityPresentationTimer = null;
  render(gameState);
  return true;
}

export function showActivityResultPresentation(stall, activity) {
  const presentation = {
    type: "ACTIVITY_RESULT",
    title: `${stall.name} ${stall.type === STALL_TYPES.FOOD ? "補充完成" : "挑戰完成"}！`,
    staminaDelta: (activity.appliedDeltas ?? activity).staminaDelta,
    scoreDelta: (activity.appliedDeltas ?? activity).scoreDelta,
    moneyDelta: (activity.appliedDeltas ?? activity).moneyDelta
  };
  enqueuePresentation(presentation);
  return presentation;
}

function enqueuePresentation(presentation) {
  gameState.session.presentationQueue.push(presentation);
  if (!gameState.session.presentation) advancePresentation();
}

export function advancePresentation(expected = gameState.session.presentation) {
  if (expected !== gameState.session.presentation) return false;
  if (activityPresentationTimer !== null) clearTimeout(activityPresentationTimer);
  const presentation = gameState.session.presentationQueue.shift() ?? null;
  gameState.session.presentation = presentation;
  activityPresentationTimer = null;
  if (presentation) {
    activityPresentationTimer = setTimeout(() => advancePresentation(presentation), ACTIVITY_PRESENTATION_DURATION);
    activityPresentationTimer?.unref?.();
  }
  render(gameState);
  return true;
}

function presentEvent(event) {
  if (event) enqueuePresentation({ type: "ENVIRONMENT_EVENT", eventId: event.eventId, title: EVENT_MESSAGES[event.eventId] });
}

export function triggerEnvironmentEvent(randomFn = Math.random) {
  const event = triggerEvent(gameState, randomFn);
  presentEvent(event);
  render(gameState);
  return event;
}

function completeStallAction(stall, activity, randomFn) {
  consumeStallLife(stall);
  moveInfluencer(gameState, randomFn);
  const event = checkEnvironmentEvent(gameState, randomFn);
  showActivityResultPresentation(stall, activity);
  presentEvent(event);
  render(gameState);
}

export function playTestGame(stallId, randomFn = Math.random) {
  const stall = gameState.stalls.find((item) => item.id === stallId);
  const result = TEST_GAME_RESULTS[stallId];
  if (!stall || stall.type !== STALL_TYPES.GAME || !result) return false;
  const failure = getStallEntryFailure(stall);
  if (failure) { showEntryFailure(failure); return false; }
  const environment = gameState.environment;
  const activity = applyActivityResult(applyRewardModifier({ ...result, staminaDelta: -getEffectiveGameStaminaCost(stall, environment) }, environment), { mosquito: environment.mosquito });
  gameState.statistics.gamePlays[stall.id] = (gameState.statistics.gamePlays[stall.id] ?? 0) + 1;
  gameState.statistics.stallVisits[stall.id] = (gameState.statistics.stallVisits[stall.id] ?? 0) + 1;
  completeStallAction(stall, activity, randomFn);
  return activity;
}

export function getStallEntryFailure(stall, randomFn = Math.random) {
  const status = getStallDisplayStatus(stall, gameState.environment);
  if (!status?.canEnter) return { code: status?.code ?? "UNAVAILABLE", message: status?.label ?? "老闆還沒準備好。", detail: status?.notice ?? "" };
  const cost = getEffectiveGameStaminaCost(stall, gameState.environment);
  const price = getEffectiveFoodPrice(stall, gameState.environment);
  if (stall.type === STALL_TYPES.GAME && gameState.player.stamina < cost) {
    return { code: "LOW_STAMINA", message: pickRandomMessage(LOW_STAMINA_MESSAGES, randomFn), current: gameState.player.stamina, required: cost, detail: `❤️ 目前體力 ${gameState.player.stamina}　需要 ${cost}` };
  }
  if (stall.type === STALL_TYPES.FOOD && gameState.player.money < price) {
    return { code: "NO_MONEY", message: pickRandomMessage(NO_MONEY_MESSAGES, randomFn), current: gameState.player.money, required: price, detail: `💰 目前金錢 ${gameState.player.money}　需要 ${price}` };
  }
  return null;
}

function showEntryFailure(failure) {
  document.querySelector("#stall-detail-dialog")?.close();
  const dialog = document.querySelector("#entry-failure-dialog");
  if (!dialog) return;
  dialog.querySelector("[data-failure-message]").textContent = failure.message;
  dialog.querySelector("[data-failure-detail]").textContent = failure.detail;
  dialog.showModal();
}

export function buyFood(stallId, randomFn = Math.random) {
  const stall = gameState.stalls.find((item) => item.id === stallId);
  if (!stall || stall.type !== STALL_TYPES.FOOD || !FOOD_CONFIG[stallId]) return false;
  const failure = getStallEntryFailure(stall);
  if (failure) { showEntryFailure(failure); return false; }
  const activity = applyActivityResult({ staminaDelta: stall.staminaRecovery, moneyDelta: -getEffectiveFoodPrice(stall, gameState.environment), scoreDelta: 0, completed: true, progressCost: 1, sourceId: stall.id }, { mosquito: gameState.environment.mosquito });
  gameState.statistics.foodPurchases += 1;
  gameState.statistics.stallVisits[stall.id] = (gameState.statistics.stallVisits[stall.id] ?? 0) + 1;
  completeStallAction(stall, activity, randomFn);
  return activity;
}

export function createNewGame(characterSettings = loadCharacterSettings() ?? {}) {
  if (activityPresentationTimer !== null) clearTimeout(activityPresentationTimer);
  activityPresentationTimer = null;
  resetGameState(characterSettings);
  changeScene(gameState, SCENES.NIGHT_MARKET);
  resetNightMarketScroll();
  return gameState;
}

function resetNightMarketScroll() {
  const grid = document.querySelector("[data-stall-grid]");
  if (grid) grid.scrollTop = 0;
}

export function startNightMarketFromHome(name = "") {
  const legacyAppearance = loadCharacterSettings() ?? {};
  if (activityPresentationTimer !== null) clearTimeout(activityPresentationTimer);
  activityPresentationTimer = null;
  resetGameState({ ...legacyAppearance, name, buildId: CONFIG.defaults.buildId });
  const saved = saveCharacterSettings(gameState.player);
  if (!saved.ok) {
    setAvatarStatus("玩家資料無法保存，請更換較小的大頭貼後重試。");
    render(gameState);
    return false;
  }
  setStatus("");
  changeScene(gameState, SCENES.NIGHT_MARKET);
  resetNightMarketScroll();
  return gameState;
}

function setAvatarStatus(message = "") {
  const status = document.querySelector("[data-avatar-status]");
  if (status) status.textContent = message;
}

function bindUI() {
  document.addEventListener("submit", (event) => {
    if (event.target.id !== "home-form") return;
    event.preventDefault();
    const name = new FormData(event.target).get("playerName") ?? "";
    startNightMarketFromHome(name);
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.action === "show-pro") document.querySelector("#pro-dialog")?.showModal();
    if (button.dataset.action === "open-build") {
      renderBuildOptions(gameState);
      document.querySelector("#build-dialog")?.showModal();
    }
    if (button.dataset.closeDialog !== undefined) button.closest("dialog")?.close();
    if (button.dataset.buildId) {
      applyBuildToPlayer(gameState.player, button.dataset.buildId);
      button.closest("dialog")?.close();
      render(gameState);
    }
    if (button.dataset.cycle === "face") changeFace(gameState.player, Number(button.dataset.direction));
    if (button.dataset.cycle === "clothes") changeClothes(gameState.player, Number(button.dataset.direction));
    if (button.dataset.cycle) { setStatus(""); render(gameState); }
    if (button.dataset.action === "complete-character") completeCharacterSetup();
    if (button.dataset.stallId) {
      selectStallAndScroll(button.dataset.stallId);
      document.querySelector("#stall-detail-dialog")?.showModal();
    }
    if (button.dataset.action === "enter-stall") enterSelectedStall();
    if (button.dataset.action === "go-home") document.querySelector("#home-dialog")?.showModal();
    if (button.dataset.action === "confirm-home") { button.closest("dialog")?.close(); changeScene(gameState, SCENES.RESULT); }
    if (button.dataset.sceneTarget) changeScene(gameState, button.dataset.sceneTarget);
  });
  document.addEventListener("change", async (event) => {
    const kind = event.target.dataset.upload;
    if (!kind) return;
    try {
      const file = event.target.files?.[0];
      const dataUrl = kind === "clothes" ? await processCustomClothesImage(file) : await processCustomFaceImage(file);
      if (kind === "avatar") {
        const previousAvatar = gameState.player.profile.avatar;
        gameState.player.name = document.querySelector("#player-name")?.value.trim() ?? gameState.player.name;
        gameState.player.profile.avatar = dataUrl;
        const saved = saveCharacterSettings(gameState.player);
        if (!saved.ok) {
          gameState.player.profile.avatar = previousAvatar;
          throw new Error("大頭貼資料太大，無法保存。請更換較小圖片後重試。");
        }
        setAvatarStatus("大頭貼已更新並保存。");
        render(gameState);
        return;
      }
      setCustomAppearance(gameState.player, kind, dataUrl);
      setStatus(kind === "face" ? "自訂臉已套用。" : "自訂衣服已套用。");
      render(gameState);
    } catch (error) {
      if (kind === "avatar") setAvatarStatus(error.message || "大頭貼處理失敗，請重試。");
      else setStatus(error.message || "圖片處理失敗，請重試。");
    } finally {
      event.target.value = "";
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
  });
}

export function selectStallAndScroll(stallId) {
  const selected = selectStall(gameState, stallId);
  if (selected) scrollSelectedStallIntoView();
  return selected;
}

export function getStallPlaceholderCopy(stall) {
  if (!stall) return { title: "老闆還在準備中！", message: "攤位功能將於 Step 4 實作。" };
  if (stall.type === STALL_TYPES.OFFICE) return { title: stall.name, message: "管理處功能將於後續 Step 實作。" };
  if (stall.type === STALL_TYPES.CLOTHING) return { title: stall.name, message: "服飾店功能將於後續 Step 實作。" };
  return { title: stall.name, message: "老闆還在準備中！攤位功能將於 Step 4 實作。" };
}

export function showSelectedStallPlaceholder() {
  const stall = getSelectedStall(gameState);
  const copy = getStallPlaceholderCopy(stall);
  const dialog = document.querySelector("#stall-dialog");
  document.querySelector("#stall-detail-dialog")?.close();
  if (!dialog) return copy;
  dialog.querySelector("[data-stall-dialog-title]").textContent = copy.title;
  dialog.querySelector("[data-stall-dialog-message]").textContent = copy.message;
  dialog.showModal();
  return copy;
}

export function enterSelectedStall() {
  const stall = getSelectedStall(gameState);
  const failure = getStallEntryFailure(stall);
  if (failure) { showEntryFailure(failure); return false; }
  if (stall?.type === STALL_TYPES.FOOD) {
    document.querySelector("#stall-detail-dialog")?.close();
    return buyFood(stall.id);
  }
  if (stall?.type === STALL_TYPES.GAME && TEST_GAME_RESULTS[stall.id]) {
    document.querySelector("#stall-detail-dialog")?.close();
    return playTestGame(stall.id);
  }
  return showSelectedStallPlaceholder();
}

export function setStallClosed(stallId, isClosed) {
  const stall = gameState.stalls.find((item) => item.id === stallId);
  if (!stall) return false;
  stall.isClosed = Boolean(isClosed);
  render(gameState);
  return true;
}

export function setEnvironmentFlag(flag, active) {
  if (!["raining", "mosquito", "influencer"].includes(flag)) return false;
  gameState.environment[flag] = Boolean(active);
  if (flag === "influencer" && !active) gameState.environment.influencerBlockedStallId = null;
  render(gameState);
  return true;
}

export function setInfluencer(active, stallId = null) {
  gameState.environment.influencer = Boolean(active);
  gameState.environment.influencerBlockedStallId = active ? stallId : null;
  render(gameState);
}
export function completeCharacterSetup() {

  if (!getBuildById(gameState.player.buildId)) {

    setStatus("請選擇有效的角色 Build。");
    return false;
  }
  const saved = saveCharacterSettings(gameState.player);
  if (!saved.ok) {
    setStatus("角色圖片資料太大，無法保存。請改用較小圖片後再試。");
    return false;
  }
  setStatus("");
  if (!gameState.session.selectedStallId) gameState.session.selectedStallId = gameState.stalls[0]?.id ?? null;
  changeScene(gameState, SCENES.NIGHT_MARKET);
  return true;
}

export function initializeGame() {
  resetGameState(loadCharacterSettings() ?? {});
  bindUI();
  render(gameState);
  return gameState;
}

window.NMLDebug = Object.freeze({
  getState: () => gameState,
  newGame: createNewGame,
  builds: CONFIG.characterBuilds,
  stallConfig: STALL_CONFIG,
  getCharacterAssets: () => ({ faces: FACE_ASSETS, defaultClothes: DEFAULT_CLOTHES, shopClothes: SHOP_CLOTHES }),
  getCharacterSettings: loadCharacterSettings,
  clearCharacterSettings,
  applyActivityResult,
  handleExternalGameResult,
  playTestGame,
  buyFood,
  triggerEnvironmentEvent,
  changeScene: (scene) => changeScene(gameState, scene),
  selectStall: selectStallAndScroll,
  closeStall: (id) => setStallClosed(id, true),
  openStall: (id) => setStallClosed(id, false),
  setRain: (active) => setEnvironmentFlag("raining", active),
  setMosquito: (active) => setEnvironmentFlag("mosquito", active),
  setInfluencer,
  render: () => render(gameState)
});

initializeGame();
