export const ACHIEVEMENT_RARITIES = Object.freeze({
  COMMON: "COMMON", RARE: "RARE", EPIC: "EPIC", LEGENDARY: "LEGENDARY"
});

export const ACHIEVEMENT_CONFIG = Object.freeze([]);

export function createAchievement({ id, name, rarity, description }) {
  if (!Object.hasOwn(ACHIEVEMENT_RARITIES, rarity)) throw new Error(`Unknown achievement rarity: ${rarity}`);
  return { id, name, rarity, description, unlocked: false };
}

export const createInitialAchievements = () => ACHIEVEMENT_CONFIG.map(createAchievement);
