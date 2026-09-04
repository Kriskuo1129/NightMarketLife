import { createPlayer } from "./character.js";
import { createEnvironment, createActiveEvents, getNextEventInterval } from "./events.js";
import { createInitialAchievements, createAchievementTracking } from "./achievements.js";
import { createInitialStalls } from "./stalls.js";

export function createProgress(randomFn = Math.random) {
  return { gameActionCount: 0, nextIncidentAt: getNextEventInterval(randomFn) };
}

export function createStatistics() {
  return { totalActions: 0, foodPurchases: 0, gamePlays: {}, stallVisits: {}, stallMoneyFlow: {}, incidentHistory: [] };
}

export function createGameState(characterSettings = {}) {
  const stalls = createInitialStalls();
  return {
    player: createPlayer(characterSettings),
    environment: createEnvironment(),
    progress: createProgress(),
    stalls,
    activeEvents: createActiveEvents(),
    statistics: createStatistics(),
    achievements: createInitialAchievements(),
    session: { scene: "HOME", startingMoney: null, buildId: null, nightConditionId: null, lastActivitySourceId: null, selectedStallId: stalls[0]?.id ?? null, presentation: null, presentationQueue: [], pendingIncident: null, endReason: null, achievementTracking: createAchievementTracking() }
  };
}

export const gameState = createGameState();

export function resetGameState(characterSettings = {}) {
  const cleanState = createGameState(characterSettings);
  for (const key of Object.keys(gameState)) delete gameState[key];
  Object.assign(gameState, cleanState);
  return gameState;
}
