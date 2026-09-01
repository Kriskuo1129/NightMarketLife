import { CONFIG } from "./config.js";
import { createPlayer } from "./character.js";
import { createEnvironment, createActiveEvents } from "./events.js";
import { createInitialAchievements } from "./achievements.js";
import { createInitialStalls } from "./stalls.js";

const randomInteger = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export function createProgress() {
  const { min, max } = CONFIG.environmentEventInterval;
  return { actionCount: 0, nextEventAt: randomInteger(min, max) };
}

export function createStatistics() {
  return { totalActions: 0, foodPurchases: 0, gamePlays: {}, mosquitoActions: 0, stallVisits: {}, eventHistory: [] };
}

export function createGameState(characterSettings = {}) {
  return {
    player: createPlayer(characterSettings),
    environment: createEnvironment(),
    progress: createProgress(),
    stalls: createInitialStalls(),
    activeEvents: createActiveEvents(),
    statistics: createStatistics(),
    achievements: createInitialAchievements(),
    session: { scene: "HOME", lastActivitySourceId: null }
  };
}

export const gameState = createGameState();

export function resetGameState(characterSettings = {}) {
  const cleanState = createGameState(characterSettings);
  for (const key of Object.keys(gameState)) delete gameState[key];
  Object.assign(gameState, cleanState);
  return gameState;
}
