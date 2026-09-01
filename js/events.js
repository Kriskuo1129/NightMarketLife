import { CONFIG } from "./config.js";

export function createEnvironment() {
  return {
    crowdLevel: CONFIG.defaults.crowdLevel,
    priceLevel: CONFIG.defaults.priceLevel,
    rewardLevel: CONFIG.defaults.rewardLevel,
    raining: false,
    mosquito: false,
    influencer: false,
    influencerBlockedStallId: null
  };
}

export const createActiveEvents = () => [];
