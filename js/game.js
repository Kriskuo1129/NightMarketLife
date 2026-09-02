import { CONFIG, getBuildById } from "./config.js";
import { gameState, resetGameState } from "./state.js";
import { clearCharacterSettings, loadCharacterSettings, saveCharacterSettings } from "./storage.js";
import { SCENES, changeScene, getSelectedStall, render, renderBuildOptions, scrollSelectedStallIntoView, selectStall, setStatus } from "./ui.js";
import { cycleStallId, STALL_CONFIG, STALL_TYPES } from "./stalls.js";
import { applyBuildToPlayer } from "./character.js";
import { changeClothes, changeFace, setCustomAppearance } from "./character-setup.js";
import { processCustomClothesImage, processCustomFaceImage } from "./uploads.js";
import { DEFAULT_CLOTHES, FACE_ASSETS, SHOP_CLOTHES } from "../assets/character-assets.js";

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

export function applyActivityResult(result) {
  const activity = normalizeActivityResult(result);
  if (![activity.staminaDelta, activity.moneyDelta, activity.scoreDelta, activity.progressCost].every(Number.isFinite)) {
    throw new TypeError("ActivityResult numeric fields must be finite numbers.");
  }
  if (!activity.completed) return activity;
  const player = gameState.player;
  player.stamina = Math.min(player.maxStamina, Math.max(0, player.stamina + activity.staminaDelta));
  player.money += activity.moneyDelta;
  player.score += activity.scoreDelta;
  gameState.progress.actionCount += activity.progressCost;
  gameState.statistics.totalActions += activity.progressCost;
  gameState.session.lastActivitySourceId = activity.sourceId || null;
  render(gameState);
  return activity;
}

export const handleExternalGameResult = (result) => applyActivityResult(result);

export function createNewGame(characterSettings = loadCharacterSettings() ?? {}) {
  resetGameState(characterSettings);
  changeScene(gameState, SCENES.CHARACTER_SETUP);
  return gameState;
}

function bindUI() {
  document.addEventListener("submit", (event) => {
    if (event.target.id !== "home-form") return;
    event.preventDefault();
    const saved = loadCharacterSettings() ?? {};
    const name = new FormData(event.target).get("playerName") ?? "";
    resetGameState({ ...saved, name });
    setStatus("");
    changeScene(gameState, SCENES.CHARACTER_SETUP);
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
    if (button.dataset.stallDirection) {
      const nextId = cycleStallId(gameState.stalls, gameState.session.selectedStallId, Number(button.dataset.stallDirection));
      if (nextId) selectStallAndScroll(nextId);
    }
    if (button.dataset.action === "enter-stall") showSelectedStallPlaceholder();
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
      setCustomAppearance(gameState.player, kind, dataUrl);
      setStatus(kind === "face" ? "自訂臉已套用。" : "自訂衣服已套用。");
      render(gameState);
    } catch (error) {
      setStatus(error.message || "圖片處理失敗，請重試。");
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
