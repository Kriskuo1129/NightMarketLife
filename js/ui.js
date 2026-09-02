import { getPlayerDisplayName } from "./character.js";
import { CONFIG, getBuildById } from "./config.js";
import { getAppearanceView } from "./character-setup.js";
import { renderAllCharacters } from "./character-renderer.js";
import { getStallViewState } from "./stalls.js";

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
  renderAllCharacters(gameState.player);
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
  renderNightMarket(gameState);
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

function renderEnvironmentStatuses(environment) {
  const container = document.querySelector("[data-environment-statuses]");
  if (!container) return;
  const statuses = [];
  if (environment.raining) statuses.push("🌧 下雨中");
  if (environment.mosquito) statuses.push("🦟 蚊子很多");
  if (environment.influencer) statuses.push("📱 網紅出沒中");
  if (!statuses.length) statuses.push("今晚一切正常。");
  container.replaceChildren(...statuses.map((text) => {
    const status = document.createElement("span");
    status.className = "environment-chip";
    status.textContent = text;
    return status;
  }));
}

function createStallCard(stall) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "stall-card";
  button.dataset.stallId = stall.id;
  button.setAttribute("role", "listitem");
  const icon = document.createElement("span");
  icon.className = "stall-card-icon";
  icon.setAttribute("aria-hidden", "true");
  const name = document.createElement("span");
  name.className = "stall-card-name";
  const meta = document.createElement("span");
  meta.className = "stall-card-meta";
  const status = document.createElement("span");
  status.className = "stall-card-meta";
  status.dataset.cardStatus = "";
  button.append(icon, name, meta, status);
  return button;
}

function ensureStallCards(gameState, carousel) {
  const existingIds = [...carousel.querySelectorAll("[data-stall-id]")].map((card) => card.dataset.stallId);
  const nextIds = gameState.stalls.map((stall) => stall.id);
  if (existingIds.join("|") !== nextIds.join("|")) {
    carousel.replaceChildren(...gameState.stalls.map(createStallCard));
  }
}

export function getSelectedStall(gameState) {
  return gameState.stalls.find((stall) => stall.id === gameState.session.selectedStallId) ?? gameState.stalls[0] ?? null;
}

export function selectStall(gameState, stallId) {
  if (!gameState.stalls.some((stall) => stall.id === stallId)) return false;
  gameState.session.selectedStallId = stallId;
  renderNightMarket(gameState);
  return true;
}

export function scrollSelectedStallIntoView() {
  document.querySelector('.stall-card[aria-pressed="true"]')?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
}

export function renderNightMarket(gameState) {
  renderEnvironmentStatuses(gameState.environment);
  const carousel = document.querySelector("[data-stall-carousel]");
  if (!carousel) return;
  ensureStallCards(gameState, carousel);
  carousel.querySelectorAll("[data-stall-id]").forEach((card) => {
    const stall = gameState.stalls.find((item) => item.id === card.dataset.stallId);
    const view = getStallViewState(stall, gameState.environment);
    card.setAttribute("aria-pressed", String(stall.id === gameState.session.selectedStallId));
    card.classList.toggle("is-closed", view.isClosed);
    card.classList.toggle("is-blocked", view.isBlocked);
    card.querySelector(".stall-card-icon").textContent = stall.icon;
    card.querySelector(".stall-card-name").textContent = stall.name;
    card.querySelector(".stall-card-meta").textContent = view.typeLabel;
    card.querySelector("[data-card-status]").textContent = view.statusText;
    card.setAttribute("aria-label", stall.name + "，" + view.typeLabel + "，" + view.statusText);
  });
  const stall = getSelectedStall(gameState);
  const view = getStallViewState(stall, gameState.environment);
  if (!stall || !view) return;
  const selectedValues = {
    sceneName: stall.name,
    icon: stall.icon,
    type: view.typeLabel,
    name: stall.name,
    description: stall.description,
    status: view.statusText,
    reason: view.canEnter ? "" : view.notice
  };
  document.querySelectorAll("[data-selected-stall]").forEach((element) => {
    element.textContent = selectedValues[element.dataset.selectedStall] ?? "";
  });
  const reason = document.querySelector('[data-selected-stall="reason"]');
  if (reason) reason.hidden = view.canEnter;
  const enterButton = document.querySelector('#stall-detail-dialog [data-action="enter-stall"]');
  if (enterButton) enterButton.disabled = !view.canEnter;
}
