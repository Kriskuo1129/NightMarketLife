import { STALL_CONFIG, STALL_TYPES } from "./stalls.js";

export const INTEGRATION_VERSION = 1;
export const ACTIVE_GAME_KEY = "nightMarket.integration.activeGame.v1";
export const GAME_RESULT_KEY = "nightMarket.integration.gameResult.v1";
export const SUPPORTED_GAMES = Object.freeze({
  NML_MoMaJohn: Object.freeze({ stallIds: Object.freeze(["game_01"]), path: "/NML_MoMaJohn/" })
});
export const INTEGRATION_STATES = Object.freeze({
  IDLE: "IDLE",
  PENDING_NO_RESULT: "PENDING_NO_RESULT",
  INCOMPLETE_LAUNCH: "INCOMPLETE_LAUNCH",
  RESULT_READY: "RESULT_READY",
  RESULT_ALREADY_CONSUMED: "RESULT_ALREADY_CONSUMED",
  STALE: "STALE",
  CORRUPT: "CORRUPT"
});

const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const isNonEmptyString = value => typeof value === "string" && value.trim().length > 0;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const isIsoTimestamp = value => isNonEmptyString(value) && ISO_TIMESTAMP_PATTERN.test(value) && Number.isFinite(Date.parse(value));
const isKnownGame = gameId => Object.hasOwn(SUPPORTED_GAMES, gameId);
const isCompatibleStall = (gameId, stallId) => isKnownGame(gameId) && SUPPORTED_GAMES[gameId].stallIds.includes(stallId) && STALL_CONFIG.some(stall => stall.id === stallId && stall.type === STALL_TYPES.GAME);

export function createActionId(cryptoApi = globalThis.crypto) {
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === "function") cryptoApi.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return `nml-action-${Date.now().toString(36)}-${[...bytes].map(value => value.toString(16).padStart(2, "0")).join("")}`;
}

export function buildActiveGame({ sessionId, actionId = createActionId(), gameId, stallId, playerName = "" }, now = () => new Date()) {
  const timestamp = now().toISOString();
  return { version: INTEGRATION_VERSION, sessionId, actionId, gameId, stallId, mode: "nightMarket", player: { name: playerName }, createdAt: timestamp, startedAt: timestamp };
}

export function validateActiveGame(value) {
  return isObject(value) && value.version === INTEGRATION_VERSION &&
    isNonEmptyString(value.sessionId) && isNonEmptyString(value.actionId) &&
    isKnownGame(value.gameId) && isCompatibleStall(value.gameId, value.stallId) &&
    value.mode === "nightMarket" && isObject(value.player) && typeof value.player.name === "string" &&
    isIsoTimestamp(value.createdAt) && isIsoTimestamp(value.startedAt);
}

export function validateGameResult(value) {
  return isObject(value) && value.version === INTEGRATION_VERSION &&
    isNonEmptyString(value.resultId) && isNonEmptyString(value.sessionId) && isNonEmptyString(value.actionId) &&
    isKnownGame(value.gameId) && isCompatibleStall(value.gameId, value.stallId) &&
    typeof value.baseMoneyReward === "number" && Number.isFinite(value.baseMoneyReward) &&
    ["completed", "user_exit"].includes(value.termination) && ["return", "retry"].includes(value.nextAction) &&
    isObject(value.details) && isIsoTimestamp(value.createdAt);
}

export function validatePendingExternalGame(value) {
  return isObject(value) && isNonEmptyString(value.actionId) && isKnownGame(value.gameId) &&
    isCompatibleStall(value.gameId, value.stallId) && typeof value.staminaCost === "number" &&
    Number.isFinite(value.staminaCost) && value.staminaCost >= 0 && isIsoTimestamp(value.launchedAt);
}

function saveContract(key, value, validator, storage) {
  try {
    if (!validator(value)) return { ok: false, error: new TypeError("Invalid integration contract") };
    storage.setItem(key, JSON.stringify(value));
    return { ok: true, value };
  } catch (error) { return { ok: false, error }; }
}

function loadContract(key, validator, storage) {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return { status: "empty", value: null };
    const value = JSON.parse(raw);
    return validator(value) ? { status: "valid", value } : { status: "corrupt", value: null };
  } catch (error) { return { status: "corrupt", value: null, error }; }
}

export const saveActiveGame = (value, storage = localStorage) => saveContract(ACTIVE_GAME_KEY, value, validateActiveGame, storage);
export const loadActiveGame = (storage = localStorage) => loadContract(ACTIVE_GAME_KEY, validateActiveGame, storage);
function clearContract(key, storage) { try { storage.removeItem(key); return { ok: true }; } catch (error) { return { ok: false, error }; } }
export const clearActiveGame = (storage = localStorage) => clearContract(ACTIVE_GAME_KEY, storage);
export const loadGameResult = (storage = localStorage) => loadContract(GAME_RESULT_KEY, validateGameResult, storage);
export const clearGameResult = (storage = localStorage) => clearContract(GAME_RESULT_KEY, storage);
export function clearIntegrationTransport(storage = localStorage) {
  const active = clearActiveGame(storage), result = clearGameResult(storage);
  return active.ok && result.ok ? { ok: true } : { ok: false, errors: [active.error, result.error].filter(Boolean) };
}

export function classifyIntegrationState({ session, pendingExternalGame = session?.pendingExternalGame ?? null, activeGame = null, gameResult = null, activeStatus, resultStatus, lastConsumedResultId = session?.lastConsumedResultId ?? null } = {}) {
  if (activeStatus === "corrupt" || resultStatus === "corrupt") return INTEGRATION_STATES.CORRUPT;
  if (!isObject(session) || !isNonEmptyString(session.sessionId ?? session.integrationSessionId) ||
      (pendingExternalGame !== null && !validatePendingExternalGame(pendingExternalGame)) ||
      (lastConsumedResultId !== null && !isNonEmptyString(lastConsumedResultId)) ||
      (activeGame !== null && !validateActiveGame(activeGame)) || (gameResult !== null && !validateGameResult(gameResult))) return INTEGRATION_STATES.CORRUPT;
  if (pendingExternalGame === null && activeGame === null && gameResult === null) return INTEGRATION_STATES.IDLE;
  const sessionId = session.sessionId ?? session.integrationSessionId;
  if (gameResult !== null && activeGame !== null && gameResult.resultId === lastConsumedResultId) {
    const completedMatches = gameResult.sessionId === sessionId && gameResult.sessionId === activeGame.sessionId &&
      gameResult.actionId === activeGame.actionId && gameResult.gameId === activeGame.gameId && gameResult.stallId === activeGame.stallId &&
      (pendingExternalGame === null || (gameResult.actionId === pendingExternalGame.actionId && gameResult.gameId === pendingExternalGame.gameId && gameResult.stallId === pendingExternalGame.stallId));
    return completedMatches ? INTEGRATION_STATES.RESULT_ALREADY_CONSUMED : INTEGRATION_STATES.STALE;
  }
  if (pendingExternalGame !== null && activeGame === null && gameResult === null) return INTEGRATION_STATES.INCOMPLETE_LAUNCH;
  if (pendingExternalGame === null || activeGame === null || (gameResult !== null && activeGame === null)) return INTEGRATION_STATES.CORRUPT;

  const activeMatches = activeGame.sessionId === sessionId && activeGame.actionId === pendingExternalGame.actionId && activeGame.gameId === pendingExternalGame.gameId && activeGame.stallId === pendingExternalGame.stallId;
  if (!activeMatches) return INTEGRATION_STATES.STALE;
  if (gameResult === null) return INTEGRATION_STATES.PENDING_NO_RESULT;
  const resultMatches = gameResult.sessionId === sessionId && gameResult.sessionId === activeGame.sessionId && gameResult.actionId === activeGame.actionId && gameResult.actionId === pendingExternalGame.actionId && gameResult.gameId === activeGame.gameId && gameResult.gameId === pendingExternalGame.gameId && gameResult.stallId === activeGame.stallId && gameResult.stallId === pendingExternalGame.stallId;
  if (!resultMatches) return INTEGRATION_STATES.STALE;
  return gameResult.resultId === lastConsumedResultId ? INTEGRATION_STATES.RESULT_ALREADY_CONSUMED : INTEGRATION_STATES.RESULT_READY;
}

export function resolveMiniGameUrl(gameId) {
  const game = SUPPORTED_GAMES[gameId];
  return game ? `${game.path}?context=nightMarket` : null;
}
