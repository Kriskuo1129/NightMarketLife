import { getPlayerDisplayName } from "./character.js";
import { CONFIG, getBuildById } from "./config.js";
import { getAppearanceView } from "./character-setup.js";
import { renderAllCharacters } from "./character-renderer.js";
import { getStallDisplayStatus } from "./stalls.js";
import { getEffectiveFoodPrice, getEffectiveGameStaminaCost } from "./events.js";
import { isInteractionLocked, predictStallAction } from "./gameplay.js";

export const SCENES = Object.freeze({ HOME: "HOME", CHARACTER_SETUP: "CHARACTER_SETUP", NIGHT_MARKET: "NIGHT_MARKET", RESULT: "RESULT" });

export function render(gameState) {
  renderEnvironmentEventModal(gameState);
  renderEndReasonModal(gameState);
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
  const avatar = gameState.player.profile?.avatar || "";
  document.querySelectorAll("[data-avatar-image]").forEach((image) => {
    if (avatar) image.src = avatar;
    else image.removeAttribute("src");
    image.hidden = !avatar;
  });
  document.querySelectorAll("[data-avatar-fallback]").forEach((fallback) => {
    fallback.hidden = Boolean(avatar);
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
  if (scene === SCENES.HOME || scene === SCENES.RESULT) {
    gameState.session.presentation = null;
    gameState.session.presentationQueue = [];
    gameState.session.exhaustionPending = false;
    if (scene === SCENES.HOME) gameState.session.endReason = null;
  }
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

export function getEnvironmentStageView(environment) {
  const primary = environment.raining
    ? { code: "rain", message: "突然下大雨" }
    : environment.influencer
      ? { code: "influencer", message: "網紅出現在夜市！" }
      : environment.mosquito
        ? { code: "mosquito", message: "附近的蚊子變多了..." }
        : environment.crowdLevel >= 4
          ? { code: "crowd", message: "今天的人潮特別多" }
          : { code: "normal", message: "今晚的夜市十分熱鬧" };
  return {
    ...primary,
    raining: Boolean(environment.raining),
    mosquito: Boolean(environment.mosquito),
    influencer: Boolean(environment.influencer),
    crowded: environment.crowdLevel >= 4
  };
}

function formatSignedDelta(value) {
  return value > 0 ? `+${value}` : String(value);
}

function renderEnvironmentStage(gameState) {
  const stage = document.querySelector("[data-environment-stage]");
  if (!stage) return;
  const presentation = gameState.session.presentation;
  const view = getEnvironmentStageView(gameState.environment);
  const showingResult = presentation?.type === "ACTIVITY_RESULT";
  const showingEvent = ["ENVIRONMENT_EVENT", "ENVIRONMENT_EVENT_MODAL"].includes(presentation?.type);
  stage.dataset.presentation = showingResult ? "activity-result" : showingEvent ? "environment-event" : "environment";
  stage.dataset.environmentStage = view.code;
  stage.dataset.raining = String(view.raining);
  stage.dataset.mosquito = String(view.mosquito);
  stage.dataset.influencer = String(view.influencer);
  stage.dataset.crowded = String(view.crowded);
  const kicker = stage.querySelector("[data-stage-kicker]");
  const message = stage.querySelector("[data-environment-message]");
  const result = stage.querySelector("[data-activity-result]");
  if (kicker) kicker.textContent = showingResult ? "挑戰結果" : showingEvent ? "夜市新鮮事" : "今晚的夜市";
  if (message) message.textContent = showingResult || showingEvent ? presentation.title : view.message;
  if (result) {
    result.hidden = !showingResult;
    if (showingResult) result.textContent = [["❤️", presentation.staminaDelta], ["⭐", presentation.scoreDelta], ["💰", presentation.moneyDelta]]
      .filter(([, delta]) => delta !== 0).map(([icon, delta]) => `${icon} ${formatSignedDelta(delta)}`).join("　");
  }
}

function createStallCard(stall) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "stall-card";
  button.dataset.stallId = stall.id;
  const copy = document.createElement("span");
  copy.className = "stall-card-copy";
  const name = document.createElement("strong");
  name.className = "stall-card-name";
  const status = document.createElement("span");
  status.className = "stall-card-status";
  copy.append(name, status);
  button.append(copy);
  return button;
}

function createHomeCard() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "stall-card stall-card--home";
  button.dataset.action = "go-home";
  button.setAttribute("aria-label", "回家，結束今晚行程");
  const copy = document.createElement("span");
  copy.className = "stall-card-copy";
  const name = document.createElement("strong");
  name.textContent = "回家";
  const status = document.createElement("span");
  status.textContent = "結束今晚行程";
  copy.append(name, status);
  button.append(copy);
  return button;
}

function ensureStallCards(gameState, grid) {
  const existingIds = [...grid.querySelectorAll("[data-stall-id]")].map((card) => card.dataset.stallId);
  const nextIds = gameState.stalls.map((stall) => stall.id);
  if (existingIds.join("|") !== nextIds.join("|")) {
    grid.replaceChildren(...gameState.stalls.map(createStallCard), createHomeCard());
  }
}

export function getSelectedStall(gameState) {
  return gameState.stalls.find((stall) => stall.id === gameState.session.selectedStallId) ?? gameState.stalls[0] ?? null;
}

export function selectStall(gameState, stallId) {
  if (isInteractionLocked(gameState)) return false;
  if (!gameState.stalls.some((stall) => stall.id === stallId)) return false;
  gameState.session.selectedStallId = stallId;
  const grid = document.querySelector("[data-stall-grid]");
  if (grid) grid.dataset.selectedStallId = stallId;
  renderNightMarket(gameState);
  return true;
}

export function scrollSelectedStallIntoView() {
  const grid = document.querySelector("[data-stall-grid]");
  const stallId = grid?.dataset.selectedStallId;
  if (stallId) document.querySelector(`[data-stall-id="${CSS.escape(stallId)}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

export function renderNightMarket(gameState) {
  renderEnvironmentStage(gameState);
  const grid = document.querySelector("[data-stall-grid]");
  if (!grid) return;
  ensureStallCards(gameState, grid);
  const locked = isInteractionLocked(gameState);
  grid.inert = locked;
  grid.setAttribute("aria-busy", String(locked));
  grid.querySelectorAll("button").forEach(button => { button.disabled = locked; });
  grid.querySelectorAll("[data-stall-id]").forEach((card) => {
    const stall = gameState.stalls.find((item) => item.id === card.dataset.stallId);
    const view = getStallDisplayStatus(stall, gameState.environment);
    card.classList.toggle("stall-card--closed", view.isClosed);
    card.classList.toggle("stall-card--blocked", view.isBlocked && !view.isClosed);
    card.querySelector(".stall-card-name").textContent = stall.name;
    card.querySelector(".stall-card-status").textContent = view.label;
    card.setAttribute("aria-label", stall.name + "，" + view.label);
  });
  const stall = getSelectedStall(gameState);
  const view = getStallDisplayStatus(stall, gameState.environment);
  if (!stall || !view) return;
  const selectedValues = {
    name: stall.name,
    status: view.label,
    reason: view.canEnter ? "" : view.notice,
    stamina: stall.type === "GAME" ? `❤️ 體力 ${getEffectiveGameStaminaCost(stall, gameState.environment)}` : "",
    price: `💰 ${getEffectiveFoodPrice(stall, gameState.environment)}`,
    recovery: `❤️ +${stall.staminaRecovery}`
  };
  document.querySelectorAll("[data-selected-stall]").forEach((element) => {
    element.textContent = selectedValues[element.dataset.selectedStall] ?? "";
  });
  const reason = document.querySelector('[data-selected-stall="reason"]');
  if (reason) reason.hidden = view.canEnter;
  const stamina = document.querySelector('[data-selected-stall="stamina"]');
  if (stamina) stamina.closest(".stall-entry-cost").hidden = stall.type !== "GAME";
  document.querySelectorAll("[data-food-info]").forEach((element) => { element.hidden = stall.type !== "FOOD"; });
  const enterButton = document.querySelector('#stall-detail-dialog [data-action="enter-stall"]');
  const warning = document.querySelector("[data-entry-warning]");
  if (warning) {
    const prediction = predictStallAction(gameState, stall);
    warning.textContent = prediction?.warnings.join("\n") ?? "";
    warning.hidden = !warning.textContent || !view.canEnter;
  }
  if (enterButton) {
    enterButton.disabled = locked || !view.canEnter;
    enterButton.textContent = stall.type === "FOOD" ? "購買" : "前往攤位";
  }
}

function renderEnvironmentEventModal(gameState) {
  const dialog = document.querySelector("#environment-event-dialog");
  if (!dialog) return;
  const presentation = gameState.session.presentation;
  if (presentation?.type !== "ENVIRONMENT_EVENT_MODAL") {
    if (dialog.open) dialog.close();
    return;
  }
  dialog.querySelector("[data-event-title]").textContent = presentation.title;
  dialog.querySelector("[data-event-description]").textContent = presentation.description;
  dialog.querySelector("[data-event-effects]").textContent = presentation.effectLines.join("\n");
  if (!dialog.open) dialog.showModal();
}

function renderEndReasonModal(gameState) {
  const dialog = document.querySelector("#end-reason-dialog");
  if (!dialog) return;
  const presentation = gameState.session.presentation;
  if (presentation?.type !== "END_REASON_MODAL") {
    if (dialog.open) dialog.close();
    return;
  }
  dialog.querySelector("[data-end-title]").textContent = presentation.title;
  dialog.querySelector("[data-end-description]").textContent = presentation.description;
  if (!dialog.open) dialog.showModal();
}
