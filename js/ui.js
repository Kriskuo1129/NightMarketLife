import { getPlayerDisplayName } from "./character.js";
import { CONFIG, getBuildById } from "./config.js";
import { getAppearanceView } from "./character-setup.js";
import { renderAllCharacters } from "./character-renderer.js";
import { getStallDisplayStatus } from "./stalls.js";
import { getEffectiveFoodPrice, getEffectiveGameStaminaCost } from "./events.js";
import { isInteractionLocked } from "./gameplay.js";
import { getNightConditionById } from "./openings.js";
import { loadSession } from "./session-persistence.js";

export const SCENES = Object.freeze({ HOME: "HOME", CHARACTER_SETUP: "CHARACTER_SETUP", NIGHT_REVEAL: "NIGHT_REVEAL", NIGHT_MARKET: "NIGHT_MARKET", RESULT: "RESULT" });

export function render(gameState) {
  const office = document.querySelector("#management-office-dialog");
  if (office?.open && (gameState.session.scene !== SCENES.NIGHT_MARKET || isInteractionLocked(gameState))) office.close();
  // Close the previous notification before opening the next, in either queue order.
  for (const [id, type] of [["environment-event-dialog", "INCIDENT_MODAL"], ["resource-warning-dialog", "RESOURCE_WARNING_MODAL"]]) {
    const dialog = document.querySelector(`#${id}`);
    if (dialog?.open && gameState.session.presentation?.type !== type) dialog.close();
  }
  renderEnvironmentEventModal(gameState);
  renderResourceWarningModal(gameState);
  document.querySelectorAll("[data-scene]").forEach((element) => {
    element.hidden = element.dataset.scene !== gameState.session.scene;
  });
  renderSessionRecovery(gameState);
  const values = {
    name: getPlayerDisplayName(gameState.player),
    stamina: `${gameState.player.stamina} / ${gameState.player.maxStamina}`,
    money: gameState.player.money
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
  const condition=getNightConditionById(gameState.session.nightConditionId);
  document.querySelectorAll("[data-night-condition]").forEach(element=>element.textContent=condition?.[element.dataset.nightCondition]??"");
  document.querySelectorAll("[data-reveal-build]").forEach(element=>element.textContent=build?.[element.dataset.revealBuild]??"");
  renderResult(gameState);
  const nameInput = document.querySelector("#player-name");
  if (nameInput && document.activeElement !== nameInput) nameInput.value = gameState.player.name;
}

function renderSessionRecovery(gameState) {
  const panel=document.querySelector("[data-session-recovery]"); if(!panel)return;
  const loaded=loadSession(),onHome=gameState.session.scene===SCENES.HOME;
  const isCurrent=loaded.status==="valid"&&loaded.capsule.sessionId===gameState.session.integrationSessionId;
  panel.hidden=!onHome||loaded.status==="empty"||isCurrent;
  const message=panel.querySelector("[data-session-recovery-message]");
  if(message)message.textContent=loaded.status==="corrupt"?"上次的夜市紀錄似乎壞掉了。":"今晚還沒逛完";
  const resume=panel.querySelector('[data-action="continue-session"]');if(resume)resume.hidden=loaded.status!=="valid";
}

export function renderResult(gameState) {
  const list = document.querySelector("[data-result-achievements]");
  if (!list) return;
  const unlocked = gameState.achievements.filter(item => item.unlocked);
  list.replaceChildren(...unlocked.map(achievement => {
    const item = document.createElement("li");
    const title = document.createElement("h4");
    title.textContent = `🏆 ${achievement.name}`;
    const description = document.createElement("p");
    description.textContent = achievement.description;
    item.append(title, description);
    return item;
  }));
  const empty = document.querySelector("[data-result-empty]");
  if (empty) empty.hidden = unlocked.length > 0;
  const starting = gameState.session.startingMoney ?? gameState.player.money;
  const moneyValues = {
    final: formatMoney(gameState.player.money),
    starting: formatMoney(starting),
    delta: formatMoneyDelta(gameState.player.money - starting)
  };
  document.querySelectorAll("[data-result-money]").forEach(element => {
    element.textContent = moneyValues[element.dataset.resultMoney] ?? "";
  });
  const flow = document.querySelector("[data-money-flow]");
  if (flow) {
    const rows = gameState.stalls
      .map(stall => ({ stall, amount: gameState.statistics.stallMoneyFlow[stall.id] ?? 0 }))
      .filter(item => item.amount !== 0);
    flow.replaceChildren(...rows.map(({ stall, amount }) => {
      const item = document.createElement("li");
      const name = document.createElement("span");
      const value = document.createElement("strong");
      name.textContent = stall.name;
      value.textContent = formatMoneyDelta(amount);
      item.append(name, value);
      return item;
    }));
    const flowEmpty = document.querySelector("[data-money-flow-empty]");
    if (flowEmpty) flowEmpty.hidden = rows.length > 0;
  }
}

const formatMoney = value => `$${Number(value).toLocaleString("en-US")}`;
export const formatMoneyDelta = value => value > 0
  ? `+$${Number(value).toLocaleString("en-US")}`
  : value < 0 ? `-$${Math.abs(Number(value)).toLocaleString("en-US")}` : "$0";

export function changeScene(gameState, scene) {
  if (!Object.hasOwn(SCENES, scene)) throw new Error(`Unknown scene: ${scene}`);
  if (scene === SCENES.HOME || scene === SCENES.RESULT) {
    gameState.session.presentation = null;
    gameState.session.presentationQueue = [];
    gameState.session.pendingIncident = null;
    if (scene === SCENES.HOME) gameState.session.nightConditionId = null;
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
  const primary=environment.crowdLevel>=4?{code:"crowd",message:"今天的人潮特別熱鬧"}:environment.crowdLevel<=2?{code:"quiet",message:"今晚逛起來格外悠閒"}:{code:"normal",message:"今晚的夜市十分熱鬧"};
  return {
    ...primary,
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
  stage.dataset.presentation = showingResult ? "activity-result" : "environment";
  stage.dataset.environmentStage = view.code;
  stage.dataset.crowded = String(view.crowded);
  const kicker = stage.querySelector("[data-stage-kicker]");
  const message = stage.querySelector("[data-environment-message]");
  const result = stage.querySelector("[data-activity-result]");
  if (kicker) kicker.textContent = showingResult ? "挑戰結果" : "今晚的夜市";
  if (message) message.textContent = showingResult ? presentation.title : view.message;
  if (result) {
    result.hidden = !showingResult;
    if (showingResult) result.textContent = [["❤️", presentation.staminaDelta], ["💰", presentation.moneyDelta]]
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
  if (enterButton) {
    enterButton.disabled = locked || !view.canEnter;
    enterButton.textContent = stall.type === "FOOD" ? "購買" : "前往攤位";
  }
}

function renderEnvironmentEventModal(gameState) {
  const dialog = document.querySelector("#environment-event-dialog");
  if (!dialog) return;
  const presentation = gameState.session.presentation;
  if (presentation?.type !== "INCIDENT_MODAL") {
    if (dialog.open) dialog.close();
    return;
  }
  dialog.querySelector("[data-event-title]").textContent = presentation.title;
  dialog.querySelector("[data-event-description]").textContent = presentation.description;
  dialog.querySelector("[data-event-effects]").textContent = presentation.effectLines.join("\n");
  if (!dialog.open) dialog.showModal();
}

function renderResourceWarningModal(gameState) {
  const dialog = document.querySelector("#resource-warning-dialog");
  if (!dialog) return;
  const presentation = gameState.session.presentation;
  if (presentation?.type !== "RESOURCE_WARNING_MODAL") {
    if (dialog.open) dialog.close();
    return;
  }
  dialog.querySelector("[data-resource-title]").textContent = presentation.title;
  dialog.querySelector("[data-resource-description]").textContent = presentation.description;
  dialog.querySelector("[data-resource-effects]").textContent = presentation.effectLines.join("\n");
  if (!dialog.open) dialog.showModal();
}
