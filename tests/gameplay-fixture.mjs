// Earlier-step regressions start after a deterministic normal opening.
import { createNewGame as start, startNightMarketFromHome as startHome, acknowledgeOpening } from '../js/game.js';
export function createNewGame(settings) { const state = start(settings, () => 0); acknowledgeOpening(); return state; }
export function startNightMarketFromHome(name) { const state = startHome(name, () => 0); acknowledgeOpening(); return state; }
