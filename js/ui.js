import { getPlayerDisplayName } from "./character.js";
import { CONFIG, getBuildById } from "./config.js";
import { getAppearanceView } from "./character-setup.js";

export const SCENES = Object.freeze({ HOME: "HOME", CHARACTER_SETUP: "CHARACTER_SETUP", NIGHT_MARKET: "NIGHT_MARKET", RESULT: "RESULT" });

export function render(gameState) {
  document.querySelectorAll("[data-scene]").forEach((element) => {
    element.hidden = element.dataset.scene !== gameState.session.scene;
  });
  const values = {
    name: getPlayerDisplayName(gameState.player),
    stamina: `${gameState.player.stamina} / ${gameState.player.maxStamina}`,
    money: gameState.player.money,
    score: gameState.player.score
  };
  document.querySelectorAll("[data-player]").forEach((element) => {
    element.textContent = values[element.dataset.player] ?? "";
  });
  const appearance = getAppearanceView(gameState.player);
  document.querySelectorAll("[data-preview]").forEach((image) => {
    const kind = image.dataset.preview;
    image.src = appearance[`${kind}Src`];
  });
  document.querySelectorAll("[data-asset-name]").forEach((output) => {
    output.textContent = appearance[`${output.dataset.assetName}Name`];
  });
  const build = getBuildById(gameState.player.buildId);
  document.querySelectorAll("[data-build]").forEach((element) => {
    element.textContent = build?.[element.dataset.build] ?? "";
  });
  const nameInput = document.querySelector("#player-name");
  if (nameInput && document.activeElement !== nameInput) nameInput.value = gameState.player.name;
}

export function changeScene(gameState, scene) {
  if (!Object.hasOwn(SCENES, scene)) throw new Error(`Unknown scene: ${scene}`);
  gameState.session.scene = scene;
  render(gameState);
}

export function renderBuildOptions(gameState) {
  const container = document.querySelector("[data-build-options]");
  if (!container) return;
  container.replaceChildren(...CONFIG.characterBuilds.map((build) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "build-option";
    button.dataset.buildId = build.id;
    button.setAttribute("aria-pressed", String(build.id === gameState.player.buildId));
    const name = document.createElement("strong");
    name.textContent = build.name;
    const stats = document.createElement("span");
    stats.textContent = `❤️ ${build.stamina}　💰 ${build.money}`;
    const description = document.createElement("small");
    description.textContent = build.description;
    button.append(name, stats, description);
    return button;
  }));
}

export function setStatus(message = "") {
  const status = document.querySelector("[data-status]");
  if (status) status.textContent = message;
}
