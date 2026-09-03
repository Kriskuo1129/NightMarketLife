import { CONFIG, getBuildById, LOW_STAMINA_MESSAGES, NO_MONEY_MESSAGES, pickRandomMessage } from "./config.js";
import { gameState, resetGameState } from "./state.js";
import { clearCharacterSettings, loadCharacterSettings, saveCharacterSettings } from "./storage.js";
import { SCENES, changeScene as renderScene, getSelectedStall, render, renderBuildOptions, scrollSelectedStallIntoView, selectStall, setStatus } from "./ui.js";
import { consumeStallLife, FOOD_CONFIG, getStallDisplayStatus, STALL_CONFIG, STALL_TYPES, TEST_GAME_RESULTS } from "./stalls.js";
import { applyBuildToPlayer } from "./character.js";
import { changeClothes, changeFace, setCustomAppearance } from "./character-setup.js";
import { processCustomClothesImage, processCustomFaceImage } from "./uploads.js";
import { DEFAULT_CLOTHES, FACE_ASSETS, SHOP_CLOTHES } from "../assets/character-assets.js";
import { getManagementOfficeDialogue } from "./management-office.js";
import { evaluateAchievements } from "./achievements.js";
import { applyOpeningCondition, pickOpeningCondition } from "./openings.js";
import { getResourceZeroWarning, getStallActivity, isInteractionLocked, predictStallAction, projectResources } from "./gameplay.js";
import { checkEnvironmentEvent, commitPendingEnvironmentEvent, getEffectiveFoodPrice, getEffectiveGameStaminaCost, moveInfluencer, triggerEnvironmentEvent as triggerEvent } from "./events.js";

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

export function applyActivityResult(result, { mosquito = false, deferNotification = false } = {}) {
  if (isInteractionLocked(gameState)) return false;
  const activity = normalizeActivityResult(result);
  if (![activity.staminaDelta, activity.moneyDelta, activity.scoreDelta, activity.progressCost].every(Number.isFinite)) {
    throw new TypeError("ActivityResult numeric fields must be finite numbers.");
  }
  if (!activity.completed) return activity;
  const player = gameState.player;
  const before = { stamina: player.stamina, money: player.money, score: player.score };
  Object.assign(player, projectResources(player, activity, mosquito));
  if (mosquito) {
    gameState.statistics.mosquitoActions += 1;
  }
  gameState.progress.actionCount += activity.progressCost;
  gameState.statistics.totalActions += activity.progressCost;
  gameState.session.lastActivitySourceId = activity.sourceId || null;
  evaluateAchievements(gameState, { before, raining: gameState.environment.raining });
  const resourceWarning = getResourceZeroWarning(before, player);
  if (resourceWarning && !deferNotification) enqueuePresentation(resourceWarning);
  render(gameState);
  return { ...activity, resourceWarning, appliedDeltas: {
    staminaDelta: player.stamina - before.stamina,
    moneyDelta: player.money - before.money,
    scoreDelta: player.score - before.score
  } };
}

export const handleExternalGameResult = (result) => applyActivityResult(result);

const ACTIVITY_PRESENTATION_DURATION = 2400;
let activityPresentationTimer = null;

function changeScene(state, scene) {
  if (scene === SCENES.HOME || scene === SCENES.RESULT) clearActivityResultPresentation();
  renderScene(state, scene);
}

export function clearActivityResultPresentation(presentation = gameState.session.presentation) {
  if (presentation && gameState.session.presentation !== presentation) return false;
  if (activityPresentationTimer !== null) clearTimeout(activityPresentationTimer);
  gameState.session.presentation = null;
  gameState.session.presentationQueue = [];
  gameState.session.pendingEnvironmentEvent = null;
  activityPresentationTimer = null;
  render(gameState);
  return true;
}

export function showActivityResultPresentation(stall, activity) {
  // Rapid successful actions may replace an unfinished visual result, but never a notification.
  // This keeps the next event at most one result-duration away instead of accumulating timers.
  if (gameState.session.presentation?.type === "ACTIVITY_RESULT" && gameState.session.presentationQueue.length === 0) {
    if (activityPresentationTimer !== null) clearTimeout(activityPresentationTimer);
    activityPresentationTimer = null;
    gameState.session.presentation = null;
  }
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
  if (["ENVIRONMENT_EVENT_MODAL", "RESOURCE_WARNING_MODAL"].includes(expected?.type)) return false;
  if (activityPresentationTimer !== null) clearTimeout(activityPresentationTimer);
  const presentation = gameState.session.presentationQueue.shift() ?? null;
  gameState.session.presentation = presentation;
  activityPresentationTimer = null;
  if (presentation && !["ENVIRONMENT_EVENT_MODAL", "RESOURCE_WARNING_MODAL"].includes(presentation.type)) {
    activityPresentationTimer = setTimeout(() => advancePresentation(presentation), ACTIVITY_PRESENTATION_DURATION);
    activityPresentationTimer?.unref?.();
  }
  render(gameState);
  return true;
}

function presentEvent(event) {
  if (!event) return;
  enqueuePresentation({ type: "ENVIRONMENT_EVENT_MODAL", eventId: event.eventId, pendingEvent: event, ...event.ui });
}

export function acknowledgeEnvironmentEvent(expected = gameState.session.presentation) {
  if (expected !== gameState.session.presentation || expected?.type !== "ENVIRONMENT_EVENT_MODAL") return false;
  if (!commitPendingEnvironmentEvent(gameState, expected.pendingEvent)) return false;
  evaluateAchievements(gameState);
  gameState.session.presentation = null;
  return advancePresentation();
}

export function requestEndGame(reason) {
  if (reason !== "HOME" || isInteractionLocked(gameState)) return false;
  gameState.session.endReason = reason;
  evaluateAchievements(gameState, { settlement: true });
  changeScene(gameState, SCENES.RESULT);
  return true;
}

export function acknowledgeResourceWarning() {
  if (gameState.session.presentation?.type !== "RESOURCE_WARNING_MODAL") return false;
  gameState.session.presentation = null;
  return advancePresentation();
}

export function triggerEnvironmentEvent(randomFn = Math.random) {
  if (isInteractionLocked(gameState)) return false;
  const event = triggerEvent(gameState, randomFn);
  presentEvent(event);
  render(gameState);
  return event;
}

function completeStallAction(stall, activity, randomFn) {
  const lifeBefore = stall.life;
  consumeStallLife(stall);
  evaluateAchievements(gameState, {
    foodAction: stall.type === STALL_TYPES.FOOD && activity.appliedDeltas.staminaDelta > 0,
    foodClosed: stall.type === STALL_TYPES.FOOD && lifeBefore > 0 && stall.life === 0 && stall.isClosed
  });
  let event = null;
  if (gameState.progress.actionCount >= gameState.progress.nextEventAt) {
    // Preserve the existing movement-before-event draw order, but stage all
    // environment changes until acknowledgement (including the movement).
    const projectedState = { ...gameState, environment: { ...gameState.environment }, session: { ...gameState.session } };
    moveInfluencer(projectedState, randomFn);
    event = checkEnvironmentEvent(projectedState, randomFn);
    const projectedEnvironment = { ...projectedState.environment, ...event.projected };
    event.projected = Object.fromEntries(Object.entries(projectedEnvironment).filter(([key, value]) => value !== gameState.environment[key]));
    gameState.session.pendingEnvironmentEvent = event;
  } else {
    moveInfluencer(gameState, randomFn);
  }
  showActivityResultPresentation(stall, activity);
  presentEvent(event);
  if (activity.resourceWarning) enqueuePresentation(activity.resourceWarning);
  render(gameState);
}

export function playTestGame(stallId, randomFn = Math.random) {
  if (isInteractionLocked(gameState)) return false;
  const stall = gameState.stalls.find((item) => item.id === stallId);
  const result = TEST_GAME_RESULTS[stallId];
  if (!stall || stall.type !== STALL_TYPES.GAME || !result) return false;
  const failure = getStallEntryFailure(stall);
  if (failure) { showEntryFailure(failure); return false; }
  const environment = gameState.environment;
  const activity = applyActivityResult(getStallActivity(stall, environment), { mosquito: environment.mosquito, deferNotification: true });
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
  if (isInteractionLocked(gameState)) return false;
  const stall = gameState.stalls.find((item) => item.id === stallId);
  if (!stall || stall.type !== STALL_TYPES.FOOD || !FOOD_CONFIG[stallId]) return false;
  const failure = getStallEntryFailure(stall);
  if (failure) { showEntryFailure(failure); return false; }
  const activity = applyActivityResult(getStallActivity(stall, gameState.environment), { mosquito: gameState.environment.mosquito, deferNotification: true });
  gameState.statistics.foodPurchases += 1;
  gameState.statistics.stallVisits[stall.id] = (gameState.statistics.stallVisits[stall.id] ?? 0) + 1;
  completeStallAction(stall, activity, randomFn);
  return activity;
}

export function createNewGame(characterSettings = loadCharacterSettings() ?? {}, randomFn = Math.random) {
  document.querySelector("#management-office-dialog")?.close();
  if (activityPresentationTimer !== null) clearTimeout(activityPresentationTimer);
  activityPresentationTimer = null;
  resetGameState(characterSettings);
  initializeOpening(randomFn);
  changeScene(gameState, SCENES.NIGHT_MARKET);
  resetNightMarketScroll();
  return gameState;
}

function resetNightMarketScroll() {
  const grid = document.querySelector("[data-stall-grid]");
  if (grid) grid.scrollTop = 0;
}

export function startNightMarketFromHome(name = "", randomFn = Math.random) {
  document.querySelector("#management-office-dialog")?.close();
  const legacyAppearance = loadCharacterSettings() ?? {};
  if (activityPresentationTimer !== null) clearTimeout(activityPresentationTimer);
  activityPresentationTimer = null;
  resetGameState({ ...legacyAppearance, name, buildId: gameState.player.buildId });
  const saved = saveCharacterSettings(gameState.player);
  if (!saved.ok) {
    setAvatarStatus("玩家資料無法保存，請更換較小的大頭貼後重試。");
    render(gameState);
    return false;
  }
  setStatus("");
  initializeOpening(randomFn);
  changeScene(gameState, SCENES.NIGHT_MARKET);
  resetNightMarketScroll();
  return gameState;
}

function initializeOpening(randomFn) {
  const opening = pickOpeningCondition(randomFn);
  applyOpeningCondition(gameState.environment, opening);
  gameState.session.openingConditionId = opening.id;
  gameState.session.openingPending = true;
}

export function acknowledgeOpening(expectedId = gameState.session.openingConditionId) {
  if (gameState.session.scene !== SCENES.NIGHT_MARKET || !gameState.session.openingPending || expectedId !== gameState.session.openingConditionId) return false;
  gameState.session.openingPending = false;
  render(gameState);
  return true;
}

export function selectHomeBuild(buildId) {
  if (gameState.session.scene !== SCENES.HOME) return false;
  const build = getBuildById(buildId) ?? getBuildById(CONFIG.defaults.buildId);
  const name = document.querySelector("#player-name")?.value.trim() ?? gameState.player.name;
  const saved = saveCharacterSettings({ ...gameState.player, name, buildId: build.id });
  if (!saved.ok) { setAvatarStatus("身分設定無法保存，請稍後再試。"); return false; }
  gameState.player.buildId = build.id;
  gameState.player.name = name;
  document.querySelector("#home-build-dialog")?.close();
  setAvatarStatus("");
  render(gameState);
  return true;
}

function setAvatarStatus(message = "") {
  const status = document.querySelector("[data-avatar-status]");
  if (status) status.textContent = message;
}

function bindUI() {
  document.querySelector("#opening-dialog")?.addEventListener("cancel", event => event.preventDefault());
  document.querySelector("#environment-event-dialog")?.addEventListener("cancel", event => event.preventDefault());
  document.querySelector("#resource-warning-dialog")?.addEventListener("cancel", event => event.preventDefault());
  document.addEventListener("submit", (event) => {
    if (event.target.id !== "home-form") return;
    event.preventDefault();
    const name = new FormData(event.target).get("playerName") ?? "";
    startNightMarketFromHome(name);
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.action === "acknowledge-opening") { acknowledgeOpening(); return; }
    if (button.dataset.action === "acknowledge-event") { acknowledgeEnvironmentEvent(); return; }
    if (button.dataset.action === "acknowledge-resource") { acknowledgeResourceWarning(); return; }
    if (isInteractionLocked(gameState) && gameState.session.scene === SCENES.NIGHT_MARKET) return;
    if (button.dataset.action === "open-home-build" && gameState.session.scene === SCENES.HOME) {
      renderBuildOptions(gameState, { home: true });
      document.querySelector("#home-build-dialog")?.showModal();
    }
    if (button.dataset.homeBuildId) { selectHomeBuild(button.dataset.homeBuildId); return; }
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
      if (button.dataset.stallId === "management") openManagementOffice();
      else {
        selectStallAndScroll(button.dataset.stallId);
        document.querySelector("#stall-detail-dialog")?.showModal();
      }
    }
    if (button.dataset.action === "ask-management") askManagementOffice();
    if (button.dataset.action === "enter-stall") enterSelectedStall();
    if (button.dataset.action === "go-home") document.querySelector("#home-dialog")?.showModal();
    if (button.dataset.action === "confirm-home") { button.closest("dialog")?.close(); requestEndGame("HOME"); }
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
    if (isInteractionLocked(gameState) && gameState.session.scene === SCENES.NIGHT_MARKET) { event.preventDefault(); return; }
    document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
  });
}

export function selectStallAndScroll(stallId) {
  if (isInteractionLocked(gameState)) return false;
  const selected = selectStall(gameState, stallId);
  if (selected) scrollSelectedStallIntoView();
  return selected;
}

export function openManagementOffice() {
  if (gameState.session.scene !== SCENES.NIGHT_MARKET || isInteractionLocked(gameState)) return false;
  const stall = gameState.stalls.find(item => item.id === "management" && item.type === STALL_TYPES.OFFICE);
  if (!getStallDisplayStatus(stall, gameState.environment)?.canEnter) return false;
  const dialog = document.querySelector("#management-office-dialog");
  if (!dialog) return false;
  document.querySelector("#stall-detail-dialog")?.close();
  dialog.querySelector("[data-management-dialogue]").textContent = "少年仔，今天想問什麼？";
  dialog.querySelector('[data-action="ask-management"]').textContent = "阿伯，今天夜市怎樣？";
  if (!dialog.open) dialog.showModal();
  return true;
}

export function askManagementOffice(randomFn = Math.random) {
  if (gameState.session.scene !== SCENES.NIGHT_MARKET || isInteractionLocked(gameState)) return false;
  const dialog = document.querySelector("#management-office-dialog");
  if (!dialog?.open) return false;
  const dialogue = getManagementOfficeDialogue(gameState.environment, gameState.stalls, randomFn);
  dialog.querySelector("[data-management-dialogue]").textContent = dialogue;
  dialog.querySelector('[data-action="ask-management"]').textContent = "再問問看";
  return dialogue;
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
  if (isInteractionLocked(gameState)) return false;
  const stall = getSelectedStall(gameState);
  if (stall?.id === "management") return openManagementOffice();
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
  predictStallAction: id => predictStallAction(gameState, gameState.stalls.find(stall => stall.id === id)),
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
