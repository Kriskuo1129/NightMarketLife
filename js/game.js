import { CONFIG, getBuildById } from "./config.js";
import { gameState, resetGameState } from "./state.js";
import { clearCharacterSettings, loadCharacterSettings, saveCharacterSettings } from "./storage.js";
import { SCENES, changeScene, render, renderBuildOptions, setStatus } from "./ui.js";
import { STALL_CONFIG } from "./stalls.js";
import { applyBuildToPlayer } from "./character.js";
import { changeClothes, changeFace, setCustomAppearance } from "./character-setup.js";
import { prepareUploadedImage, processCustomClothesImage } from "./uploads.js";
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
    if (button.dataset.sceneTarget) changeScene(gameState, button.dataset.sceneTarget);
  });
  document.addEventListener("change", async (event) => {
    const kind = event.target.dataset.upload;
    if (!kind) return;
    try {
      const file = event.target.files?.[0];
      const dataUrl = kind === "clothes" ? await processCustomClothesImage(file) : await prepareUploadedImage(file);
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
  changeScene: (scene) => changeScene(gameState, scene)
});

initializeGame();
