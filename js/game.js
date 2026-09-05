import { CONFIG, getBuildById, LOW_STAMINA_MESSAGES, NO_MONEY_MESSAGES, pickRandomBuild, pickRandomMessage } from "./config.js";
import { gameState, resetGameState } from "./state.js";
import { clearCharacterSettings, loadCharacterSettings, saveCharacterSettings } from "./storage.js";
import { SCENES, changeScene as renderScene, getSelectedStall, render, renderBuildOptions, scrollSelectedStallIntoView, selectStall, setStatus } from "./ui.js";
import { consumeStallLife, FOOD_CONFIG, getStallDisplayStatus, initializeStallLife, STALL_CONFIG, STALL_TYPES, TEST_GAME_RESULTS } from "./stalls.js";
import { applyBuildToPlayer } from "./character.js";
import { changeClothes, changeFace, setCustomAppearance } from "./character-setup.js";
import { processCustomClothesImage, processCustomFaceImage } from "./uploads.js";
import { DEFAULT_CLOTHES, FACE_ASSETS, SHOP_CLOTHES } from "../assets/character-assets.js";
import { getManagementOfficeDialogue } from "./management-office.js";
import { evaluateAchievements } from "./achievements.js";
import { applyNightCondition, pickNightCondition } from "./openings.js";
import { getResourceZeroWarning, getStallActivity, isInteractionLocked, predictStallAction, projectResources } from "./gameplay.js";
import { applyRewardModifier, checkIncident, commitPendingIncident, getEffectiveFoodPrice, getEffectiveGameStaminaCost, triggerIncident } from "./events.js";
import { clearSession, createSessionId, loadSession, restoreSession, saveSession } from "./session-persistence.js";
import { buildActiveGame, classifyIntegrationState, clearActiveGame, clearGameResult, clearIntegrationTransport, createActionId, INTEGRATION_STATES, loadActiveGame, loadGameResult, resolveMiniGameUrl, saveActiveGame, SUPPORTED_GAMES } from "./integration-host.js";

let storedRunStatus = loadSession();
let pendingRetry = null;
export const getStoredRunStatus = () => storedRunStatus;

export function navigateToMiniGame(url) { window.location.href = url; return true; }
function showIntegrationDialog({title,message,actions=[]}){const dialog=document.querySelector("#integration-recovery-dialog");if(!dialog)return false;dialog.querySelector("[data-integration-recovery-title]").textContent=title;dialog.querySelector("[data-integration-recovery-message]").textContent=message;const container=dialog.querySelector("[data-integration-recovery-actions]");container.replaceChildren(...actions.map(({label,action,primary=false})=>{const button=document.createElement("button");button.type="button";button.dataset.action=action;button.className=primary?"primary-button":"modal-secondary-button";button.textContent=label;return button;}));if(!dialog.open)dialog.showModal();return true;}
function closeIntegrationDialog(){const dialog=document.querySelector("#integration-recovery-dialog");if(dialog?.open)dialog.close();}

export function normalizeActivityResult(result = {}) {
  return {
    staminaDelta: Number(result.staminaDelta ?? 0),
    moneyDelta: Number(result.moneyDelta ?? 0),
    completed: result.completed ?? true,
    progressCost: Math.max(0, Number(result.progressCost ?? 1)),
    sourceId: String(result.sourceId ?? "")
  };
}

export function applyActivityResult(result, { deferNotification = false, trackStallMoney = false } = {}) {
  if (isInteractionLocked(gameState)) return false;
  const activity = normalizeActivityResult(result);
  if (![activity.staminaDelta, activity.moneyDelta, activity.progressCost].every(Number.isFinite)) {
    throw new TypeError("ActivityResult numeric fields must be finite numbers.");
  }
  if (!activity.completed) return activity;
  const player = gameState.player;
  const before = { stamina: player.stamina, money: player.money };
  Object.assign(player, projectResources(player, activity));
  gameState.statistics.totalActions += activity.progressCost;
  gameState.session.lastActivitySourceId = activity.sourceId || null;
  if (trackStallMoney && activity.sourceId && gameState.stalls.some(stall => stall.id === activity.sourceId && ["GAME", "FOOD"].includes(stall.type))) {
    gameState.statistics.stallMoneyFlow[activity.sourceId] =
      (gameState.statistics.stallMoneyFlow[activity.sourceId] ?? 0) + (player.money - before.money);
  }
  evaluateAchievements(gameState, { before });
  const resourceWarning = getResourceZeroWarning(before, player);
  if (resourceWarning && !deferNotification) enqueuePresentation(resourceWarning);
  render(gameState);
  if (gameState.session.integrationSessionId) saveSession(gameState);
  return { ...activity, resourceWarning, appliedDeltas: {
    staminaDelta: player.stamina - before.stamina,
    moneyDelta: player.money - before.money
  } };
}

// Compatibility entry point: external results must always use the validated,
// exactly-once transport transaction rather than applying caller data directly.
export const handleExternalGameResult = () => consumeExternalGameResult();

const replaceRuntimeState = snapshot => {
  for (const key of Object.keys(gameState)) delete gameState[key];
  Object.assign(gameState, snapshot);
};

export function launchExternalGame(stallId, {
  gameId = "NML_MoMaJohn", now = () => new Date(), createActionIdFn = createActionId,
  saveSessionFn = saveSession, saveActiveGameFn = saveActiveGame,
  loadActiveGameFn = loadActiveGame, loadGameResultFn = loadGameResult, clearActiveGameFn = clearActiveGame
} = {}) {
  const fail = (status, reason, extra = {}) => ({ ok: false, status, reason, ...extra });
  const stall = gameState.stalls.find(item => item.id === stallId);
  if (!stall || !SUPPORTED_GAMES[gameId]?.stallIds.includes(stallId) || stall.type !== STALL_TYPES.GAME) return fail("ineligible", "unsupported_stall");
  if (isInteractionLocked(gameState)) return fail("ineligible", "interaction_locked");
  if (stall.isClosed || stall.life <= 0) return fail("ineligible", "stall_closed");
  if (stall.isBlocked) return fail("ineligible", "stall_blocked");
  if (gameState.session.pendingExternalGame !== null) return fail("ineligible", "pending_external_game");
  const activeStored = loadActiveGameFn(), resultStored = loadGameResultFn();
  if (activeStored.status !== "empty" || resultStored.status !== "empty") return fail("ineligible", "unresolved_transport", { activeStatus: activeStored.status, resultStatus: resultStored.status });
  const staminaCost = getEffectiveGameStaminaCost(stall, gameState.environment);
  if (gameState.player.stamina < staminaCost) return fail("ineligible", "insufficient_stamina", { staminaCost });
  const sessionId = gameState.session.integrationSessionId;
  if (typeof sessionId !== "string" || sessionId.trim() === "") return fail("ineligible", "missing_session");

  const actionId = createActionIdFn(), launchedAt = now().toISOString();
  const previousStamina = gameState.player.stamina, previousPending = gameState.session.pendingExternalGame;
  gameState.player.stamina -= staminaCost;
  gameState.session.pendingExternalGame = { actionId, gameId, stallId, staminaCost, launchedAt };
  const sessionSaved = saveSessionFn(gameState);
  if (!sessionSaved?.ok) {
    gameState.player.stamina = previousStamina; gameState.session.pendingExternalGame = previousPending;
    clearActiveGameFn();
    return fail("session_save_failed", "launch_session_not_saved", { error: sessionSaved?.error });
  }
  const activeGame = buildActiveGame({ sessionId, actionId, gameId, stallId, playerName: gameState.player.name }, () => new Date(launchedAt));
  const activeSaved = saveActiveGameFn(activeGame);
  if (!activeSaved?.ok) {
    gameState.player.stamina = previousStamina; gameState.session.pendingExternalGame = previousPending;
    const rollback = saveSessionFn(gameState); clearActiveGameFn();
    return fail(rollback?.ok ? "active_save_failed" : "rollback_save_failed", "active_game_not_saved", { error: activeSaved?.error, rollbackError: rollback?.error });
  }
  render(gameState);
  return { ok: true, status: "launch_ready", actionId, gameId, stallId, staminaCost, url: resolveMiniGameUrl(gameId), activeGame };
}

export function consumeExternalGameResult({
  randomFn = Math.random, saveSessionFn = saveSession, loadActiveGameFn = loadActiveGame,
  loadGameResultFn = loadGameResult, clearActiveGameFn = clearActiveGame, clearGameResultFn = clearGameResult,
  afterSessionSave
} = {}) {
  const activeStored = loadActiveGameFn(), resultStored = loadGameResultFn();
  const activeGame = activeStored.status === "valid" ? activeStored.value : null;
  const result = resultStored.status === "valid" ? resultStored.value : null;
  const classification = classifyIntegrationState({ session: gameState.session, activeGame, gameResult: result, activeStatus: activeStored.status, resultStatus: resultStored.status });
  if (classification === INTEGRATION_STATES.RESULT_ALREADY_CONSUMED) {
    const resultCleanup = clearGameResultFn(), activeCleanup = clearActiveGameFn();
    return { ok: true, status: "already_consumed", resultId: result.resultId, nextAction: result.nextAction, transportCleanupOk: resultCleanup?.ok !== false && activeCleanup?.ok !== false };
  }
  if (classification !== INTEGRATION_STATES.RESULT_READY) return { ok: false, status: classification.toLowerCase(), reason: "integration_state_not_ready" };

  const stall = gameState.stalls.find(item => item.id === result.stallId);
  if (!stall || stall.type !== STALL_TYPES.GAME || stall.isClosed || stall.isBlocked || stall.life <= 0) return { ok: false, status: "stale", reason: "stall_no_longer_consumable" };
  const snapshot = structuredClone(gameState), before = { stamina: gameState.player.stamina, money: gameState.player.money };
  const actualMoneyReward = applyRewardModifier({ moneyDelta: result.baseMoneyReward }, gameState.environment).moneyDelta;
  Object.assign(gameState.player, projectResources(gameState.player, { staminaDelta: 0, moneyDelta: actualMoneyReward }));
  const appliedMoneyReward = gameState.player.money - before.money;
  gameState.statistics.totalActions += 1;
  gameState.statistics.gamePlays[stall.id] = (gameState.statistics.gamePlays[stall.id] ?? 0) + 1;
  gameState.statistics.stallVisits[stall.id] = (gameState.statistics.stallVisits[stall.id] ?? 0) + 1;
  gameState.statistics.stallMoneyFlow[stall.id] = (gameState.statistics.stallMoneyFlow[stall.id] ?? 0) + appliedMoneyReward;
  gameState.session.lastActivitySourceId = stall.id;
  consumeStallLife(stall);
  gameState.progress.gameActionCount += 1;
  const incident = checkIncident(gameState, randomFn);
  evaluateAchievements(gameState, { before });
  if (incident) presentEvent(incident);
  gameState.session.lastConsumedResultId = result.resultId;
  gameState.session.pendingExternalGame = null;
  const saved = saveSessionFn(gameState);
  if (!saved?.ok) {
    replaceRuntimeState(snapshot); render(gameState);
    return { ok: false, status: "session_save_failed", reason: "consume_rolled_back", error: saved?.error };
  }
  afterSessionSave?.({ gameState, activeGame, result });
  const resultCleanup = clearGameResultFn(), activeCleanup = clearActiveGameFn(); render(gameState);
  if(result.nextAction==="retry"){pendingRetry={gameId:result.gameId,stallId:result.stallId};if(!isInteractionLocked(gameState))showPendingRetry();}
  return { ok: true, status: "consumed", resultId: result.resultId, baseMoneyReward: result.baseMoneyReward, actualMoneyReward, appliedMoneyReward, termination: result.termination, nextAction: result.nextAction, transportCleanupOk: resultCleanup?.ok !== false && activeCleanup?.ok !== false };
}

function showPendingRetry(){if(!pendingRetry)return false;return showIntegrationDialog({title:"要再玩一次嗎？",message:"遊戲結果已記錄。重新遊玩會再次檢查攤位與體力。",actions:[{label:"回夜市",action:"integration-retry-return"},{label:"再玩一次",action:"integration-retry",primary:true}]});}

export function abandonPendingExternalGame({saveSessionFn=saveSession,clearActiveGameFn=clearActiveGame,clearGameResultFn=clearGameResult}={}){const active=loadActiveGame(),result=loadGameResult(),classification=classifyIntegrationState({session:gameState.session,activeGame:active.status==="valid"?active.value:null,gameResult:result.status==="valid"?result.value:null,activeStatus:active.status,resultStatus:result.status});if(classification!==INTEGRATION_STATES.PENDING_NO_RESULT)return{ok:false,status:classification.toLowerCase()};const pending=gameState.session.pendingExternalGame;gameState.session.pendingExternalGame=null;const saved=saveSessionFn(gameState);if(!saved?.ok){gameState.session.pendingExternalGame=pending;return{ok:false,status:"session_save_failed",reason:"abandon_rolled_back"};}clearGameResultFn();clearActiveGameFn();closeIntegrationDialog();render(gameState);return{ok:true,status:"abandoned"};}

export function recoverIncompleteLaunch({saveSessionFn=saveSession,clearActiveGameFn=clearActiveGame,clearGameResultFn=clearGameResult}={}){const active=loadActiveGame(),result=loadGameResult(),classification=classifyIntegrationState({session:gameState.session,activeGame:active.status==="valid"?active.value:null,gameResult:result.status==="valid"?result.value:null,activeStatus:active.status,resultStatus:result.status});if(classification!==INTEGRATION_STATES.INCOMPLETE_LAUNCH)return{ok:false,status:classification.toLowerCase()};const pending=gameState.session.pendingExternalGame,stamina=gameState.player.stamina;gameState.player.stamina=projectResources(gameState.player,{staminaDelta:pending.staminaCost,moneyDelta:0}).stamina;gameState.session.pendingExternalGame=null;const saved=saveSessionFn(gameState);if(!saved?.ok){gameState.player.stamina=stamina;gameState.session.pendingExternalGame=pending;return{ok:false,status:"session_save_failed",reason:"refund_rolled_back"};}clearGameResultFn();clearActiveGameFn();render(gameState);return{ok:true,status:"incomplete_recovered",staminaRefund:gameState.player.stamina-stamina};}

export function clearInvalidIntegrationTransaction({saveSessionFn=saveSession,clearActiveGameFn=clearActiveGame,clearGameResultFn=clearGameResult}={}){const active=loadActiveGame(),result=loadGameResult(),classification=classifyIntegrationState({session:gameState.session,activeGame:active.status==="valid"?active.value:null,gameResult:result.status==="valid"?result.value:null,activeStatus:active.status,resultStatus:result.status});if(![INTEGRATION_STATES.STALE,INTEGRATION_STATES.CORRUPT].includes(classification))return{ok:false,status:classification.toLowerCase(),reason:"not_invalid_transport"};const pending=gameState.session.pendingExternalGame;if(pending!==null){gameState.session.pendingExternalGame=null;const saved=saveSessionFn(gameState);if(!saved?.ok){gameState.session.pendingExternalGame=pending;return{ok:false,status:"session_save_failed",reason:"invalid_cleanup_rolled_back"};}}const resultCleanup=clearGameResultFn(),activeCleanup=clearActiveGameFn();closeIntegrationDialog();render(gameState);return{ok:true,status:"invalid_transport_cleared",transportCleanupOk:resultCleanup?.ok!==false&&activeCleanup?.ok!==false};}

export function resumePendingExternalGame({navigateFn=navigateToMiniGame}={}){const active=loadActiveGame(),result=loadGameResult(),classification=classifyIntegrationState({session:gameState.session,activeGame:active.status==="valid"?active.value:null,gameResult:result.status==="valid"?result.value:null,activeStatus:active.status,resultStatus:result.status});if(classification!==INTEGRATION_STATES.PENDING_NO_RESULT)return{ok:false,status:classification.toLowerCase()};const stamina=gameState.player.stamina,url=resolveMiniGameUrl(active.value.gameId);navigateFn(url);return{ok:true,status:"resumed",sessionId:active.value.sessionId,actionId:active.value.actionId,url,staminaUnchanged:gameState.player.stamina===stamina};}

export function checkIntegrationRecovery(){const active=loadActiveGame(),result=loadGameResult(),classification=classifyIntegrationState({session:gameState.session,activeGame:active.status==="valid"?active.value:null,gameResult:result.status==="valid"?result.value:null,activeStatus:active.status,resultStatus:result.status});if(classification===INTEGRATION_STATES.IDLE){closeIntegrationDialog();return{status:"idle"};}if(classification===INTEGRATION_STATES.RESULT_READY||classification===INTEGRATION_STATES.RESULT_ALREADY_CONSUMED)return consumeExternalGameResult();if(classification===INTEGRATION_STATES.PENDING_NO_RESULT){showIntegrationDialog({title:"剛剛的遊戲還沒結束",message:"你可以回到遊戲繼續，或放棄這次遊戲。",actions:[{label:"放棄這次遊戲",action:"integration-abandon"},{label:"回到遊戲",action:"integration-resume",primary:true}]});return{status:"pending"};}if(classification===INTEGRATION_STATES.INCOMPLETE_LAUNCH){const recovered=recoverIncompleteLaunch();showIntegrationDialog(recovered.ok?{title:"遊戲沒有完整開始",message:"剛剛啟動遊戲時發生異常，已恢復這次消耗的體力。",actions:[{label:"返回夜市",action:"integration-close",primary:true}]}:{title:"暫時無法恢復",message:"遊戲紀錄尚未變更，請稍後再試。",actions:[{label:"知道了",action:"integration-close",primary:true}]});return recovered;}showIntegrationDialog({title:"上次的遊戲紀錄無法正確恢復",message:"為避免錯誤套用獎勵，這筆資料不會影響目前遊戲。",actions:[{label:"清除異常資料並返回夜市",action:"integration-clear-corrupt",primary:true}]});return{status:classification.toLowerCase()};}

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
  gameState.session.pendingIncident = null;
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
  if (["INCIDENT_MODAL", "RESOURCE_WARNING_MODAL"].includes(expected?.type)) return false;
  if (activityPresentationTimer !== null) clearTimeout(activityPresentationTimer);
  const presentation = gameState.session.presentationQueue.shift() ?? null;
  gameState.session.presentation = presentation;
  activityPresentationTimer = null;
  if (presentation && !["INCIDENT_MODAL", "RESOURCE_WARNING_MODAL"].includes(presentation.type)) {
    activityPresentationTimer = setTimeout(() => advancePresentation(presentation), ACTIVITY_PRESENTATION_DURATION);
    activityPresentationTimer?.unref?.();
  }
  render(gameState);
  return true;
}

function presentEvent(event) {
  if (!event) return;
  enqueuePresentation({ type: "INCIDENT_MODAL", eventId: event.eventId, pendingIncident: event, ...event.ui });
}

export function acknowledgeEnvironmentEvent(expected = gameState.session.presentation) {
  if (expected !== gameState.session.presentation || expected?.type !== "INCIDENT_MODAL") return false;
  if (!commitPendingIncident(gameState, expected.pendingIncident)) return false;
  evaluateAchievements(gameState);
  gameState.session.presentation = null;
  saveSession(gameState);
  const advanced=advancePresentation();if(!isInteractionLocked(gameState))showPendingRetry();return advanced;
}

export function requestEndGame(reason) {
  if (reason !== "HOME" || isInteractionLocked(gameState)) return false;
  gameState.session.endReason = reason;
  evaluateAchievements(gameState, { settlement: true });
  changeScene(gameState, SCENES.RESULT);
  saveSession(gameState);
  return true;
}

export function acknowledgeResourceWarning() {
  if (gameState.session.presentation?.type !== "RESOURCE_WARNING_MODAL") return false;
  gameState.session.presentation = null;
  return advancePresentation();
}

export function triggerEnvironmentEvent(randomFn = Math.random) {
  if (isInteractionLocked(gameState)) return false;
  const event = triggerIncident(gameState, randomFn);
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
  if (stall.type === STALL_TYPES.GAME) {
    gameState.progress.gameActionCount += 1;
    event = checkIncident(gameState, randomFn);
  }
  showActivityResultPresentation(stall, activity);
  presentEvent(event);
  if (activity.resourceWarning) enqueuePresentation(activity.resourceWarning);
  saveSession(gameState);
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
  const activity = applyActivityResult(getStallActivity(stall, environment), { deferNotification: true, trackStallMoney: true });
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
  const activity = applyActivityResult(getStallActivity(stall, gameState.environment), { deferNotification: true, trackStallMoney: true });
  gameState.statistics.foodPurchases += 1;
  gameState.statistics.stallVisits[stall.id] = (gameState.statistics.stallVisits[stall.id] ?? 0) + 1;
  completeStallAction(stall, activity, randomFn);
  return activity;
}

export function createNewGame(characterSettings = loadCharacterSettings() ?? {}, randomFn = Math.random) {
  const stored = loadSession();
  if (stored.status === "valid" && stored.capsule.sessionId !== gameState.session.integrationSessionId) { storedRunStatus = stored; render(gameState); return false; }
  clearIntegrationTransport();
  document.querySelector("#management-office-dialog")?.close();
  if (activityPresentationTimer !== null) clearTimeout(activityPresentationTimer);
  activityPresentationTimer = null;
  const build = pickRandomBuild(randomFn);
  resetGameState({ ...characterSettings, buildId: build.id });
  gameState.session.integrationSessionId = createSessionId();
  gameState.session.buildId = build.id;
  gameState.session.startingMoney = gameState.player.money;
  initializeNightCondition(randomFn);
  changeScene(gameState, SCENES.NIGHT_REVEAL);
  saveSession(gameState); storedRunStatus = loadSession();
  resetNightMarketScroll();
  return gameState;
}

function resetNightMarketScroll() {
  const grid = document.querySelector("[data-stall-grid]");
  if (grid) grid.scrollTop = 0;
}

export function startNightMarketFromHome(name = "", randomFn = Math.random) {
  const stored = loadSession();
  if (stored.status === "valid" && stored.capsule.sessionId !== gameState.session.integrationSessionId) { storedRunStatus = stored; setAvatarStatus("今晚還沒逛完，可以先繼續上一晚或放棄紀錄。"); render(gameState); return false; }
  clearIntegrationTransport();
  document.querySelector("#management-office-dialog")?.close();
  const legacyAppearance = loadCharacterSettings() ?? {};
  if (activityPresentationTimer !== null) clearTimeout(activityPresentationTimer);
  activityPresentationTimer = null;
  const build = pickRandomBuild(randomFn);
  resetGameState({ ...legacyAppearance, name, buildId: build.id });
  gameState.session.integrationSessionId = createSessionId();
  gameState.session.buildId = build.id;
  gameState.session.startingMoney = gameState.player.money;
  const saved = saveCharacterSettings(gameState.player);
  if (!saved.ok) {
    setAvatarStatus("玩家資料無法保存，請更換較小的大頭貼後重試。");
    render(gameState);
    return false;
  }
  setStatus("");
  initializeNightCondition(randomFn);
  changeScene(gameState, SCENES.NIGHT_REVEAL);
  saveSession(gameState); storedRunStatus = loadSession();
  resetNightMarketScroll();
  return gameState;
}

function initializeNightCondition(randomFn) {
  const condition = pickNightCondition(randomFn);
  applyNightCondition(gameState.environment, condition);
  gameState.session.nightConditionId = condition.id;
  initializeStallLife(gameState.stalls, gameState.environment.businessLevel, randomFn);
}

export function acknowledgeOpening(expectedId = gameState.session.nightConditionId) {
  if (gameState.session.scene !== SCENES.NIGHT_REVEAL || expectedId !== gameState.session.nightConditionId) return false;
  changeScene(gameState, SCENES.NIGHT_MARKET);
  saveSession(gameState);
  return true;
}

export function continueStoredSession() {
  const loaded = loadSession();
  if (loaded.status !== "valid" || !restoreSession(gameState, loaded.capsule, loadCharacterSettings() ?? {})) { storedRunStatus = { status: "corrupt", capsule: null }; render(gameState); return false; }
  storedRunStatus = loaded; setAvatarStatus(""); render(gameState); checkIntegrationRecovery(); return true;
}

export function abandonStoredSession() {
  clearSession(); clearIntegrationTransport(); storedRunStatus = { status: "empty", capsule: null };
  if (gameState.session.scene !== SCENES.HOME) resetGameState(loadCharacterSettings() ?? {});
  setAvatarStatus(""); render(gameState); return true;
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
    if (button.dataset.action === "continue-session") { continueStoredSession(); return; }
    if (button.dataset.action === "abandon-session") { abandonStoredSession(); return; }
    if (button.dataset.action === "integration-resume") { resumePendingExternalGame(); return; }
    if (button.dataset.action === "integration-abandon") { abandonPendingExternalGame(); return; }
    if (button.dataset.action === "integration-close") { closeIntegrationDialog(); return; }
    if (button.dataset.action === "integration-clear-corrupt") { clearInvalidIntegrationTransaction();return; }
    if (button.dataset.action === "integration-retry-return") { pendingRetry=null;closeIntegrationDialog();return; }
    if (button.dataset.action === "integration-retry") { const request=pendingRetry;pendingRetry=null;closeIntegrationDialog();const launched=launchExternalGame(request?.stallId,{gameId:request?.gameId});if(launched.ok)navigateToMiniGame(launched.url);else showIntegrationDialog({title:"暫時不能再玩一次",message:launched.reason==="insufficient_stamina"?"體力不足，沒辦法再玩一次。":"攤位目前無法進入，請留在夜市繼續逛逛。",actions:[{label:"返回夜市",action:"integration-close",primary:true}]});return; }
    if (button.dataset.action === "acknowledge-event") { acknowledgeEnvironmentEvent(); return; }
    if (button.dataset.action === "acknowledge-resource") { acknowledgeResourceWarning(); return; }
    if (isInteractionLocked(gameState) && gameState.session.scene === SCENES.NIGHT_MARKET) return;
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
    if (button.dataset.action === "toggle-money-flow") {
      const details = document.querySelector("[data-money-flow-details]");
      if (details) details.hidden = !details.hidden;
    }
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
    if(stall.id==="game_01"){const launched=launchExternalGame(stall.id);if(launched.ok)navigateToMiniGame(launched.url);else showEntryFailure({message:"目前無法進入遊戲",detail:launched.reason});return launched;}
    return playTestGame(stall.id);
  }
  return showSelectedStallPlaceholder();
}

export function setStallClosed(stallId, isClosed) {
  const stall = gameState.stalls.find((item) => item.id === stallId);
  if (!stall) return false;
  stall.isClosed = Boolean(isClosed);
  if (gameState.session.integrationSessionId) saveSession(gameState);
  render(gameState);
  return true;
}

export function setEnvironmentLevel(key, level) {
  if (!["crowdLevel","priceLevel","rewardLevel","temperatureLevel","businessLevel"].includes(key)) return false;
  gameState.environment[key] = Math.min(5, Math.max(1, Number(level)));
  if (gameState.session.integrationSessionId) saveSession(gameState);
  render(gameState); return true;
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
  storedRunStatus = loadSession();
  bindUI();
  render(gameState);
  return gameState;
}

window.addEventListener?.("pageshow",()=>{if(gameState.session.scene===SCENES.NIGHT_MARKET)checkIntegrationRecovery();});

window.NMLDebug = Object.freeze({
  getState: () => gameState,
  newGame: createNewGame,
  builds: CONFIG.characterBuilds,
  stallConfig: STALL_CONFIG,
  getCharacterAssets: () => ({ faces: FACE_ASSETS, defaultClothes: DEFAULT_CLOTHES, shopClothes: SHOP_CLOTHES }),
  getCharacterSettings: loadCharacterSettings,
  clearCharacterSettings,
  getRunSession: () => loadSession(),
  continueRunSession: continueStoredSession,
  abandonRunSession: abandonStoredSession,
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
  setEnvironmentLevel,
  render: () => render(gameState)
});

initializeGame();
