import { CONFIG } from "./config.js";

export const STALL_TYPES = Object.freeze({ GAME: "GAME", FOOD: "FOOD", OFFICE: "OFFICE", CLOTHING: "CLOTHING" });
export const INTERACTION_TYPES = Object.freeze({ GAME: "GAME", FOOD: "FOOD", WORK: "WORK", SERVICE: "SERVICE" });

export const STALL_TYPE_LABELS = Object.freeze({ GAME: "遊戲", FOOD: "食物", OFFICE: "管理處", CLOTHING: "服飾" });
export const STALL_CONFIG = Object.freeze([
  Object.freeze({ id: "game_01", name: "測試遊戲攤 A", type: STALL_TYPES.GAME, isSpecial: false, interactionType: INTERACTION_TYPES.GAME, icon: "🎯", description: "今晚要不要試試手氣？", staminaCost: CONFIG.staminaCosts.game }),
  Object.freeze({ id: "game_02", name: "測試遊戲攤 B", type: STALL_TYPES.GAME, isSpecial: false, interactionType: INTERACTION_TYPES.GAME, icon: "🎮", description: "老闆還在調整遊戲規則。", staminaCost: CONFIG.staminaCosts.game }),
  Object.freeze({ id: "game_03", name: "測試遊戲攤 C", type: STALL_TYPES.GAME, isSpecial: false, interactionType: INTERACTION_TYPES.GAME, icon: "🀄", description: "再靠近一點看看今晚玩什麼。", staminaCost: CONFIG.staminaCosts.game }),
  Object.freeze({ id: "food_01", name: "測試小吃攤 A", type: STALL_TYPES.FOOD, isSpecial: false, interactionType: INTERACTION_TYPES.FOOD, icon: "🍢", description: "聞起來好像很好吃。", staminaCost: CONFIG.staminaCosts.food }),
  Object.freeze({ id: "food_02", name: "測試小吃攤 B", type: STALL_TYPES.FOOD, isSpecial: false, interactionType: INTERACTION_TYPES.FOOD, icon: "🍜", description: "熱騰騰的香氣從攤前飄過。", staminaCost: CONFIG.staminaCosts.food }),
  Object.freeze({ id: "management", name: "夜市管理處", type: STALL_TYPES.OFFICE, isSpecial: true, interactionType: INTERACTION_TYPES.SERVICE, icon: "📋", description: "有事情可以來這裡問問。" }),
  Object.freeze({ id: "clothing", name: "服飾店", type: STALL_TYPES.CLOTHING, isSpecial: true, interactionType: INTERACTION_TYPES.SERVICE, icon: "👕", description: "看看今晚有沒有適合你的衣服。" })
]);

const randomInteger = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export function createStall(definition) {
  const isSpecial = Boolean(definition.isSpecial);
  const maxLife = isSpecial ? null : (definition.maxLife ?? randomInteger(CONFIG.stallLife.min, CONFIG.stallLife.max));
  return {
    id: definition.id,
    name: definition.name,
    type: definition.type,
    icon: definition.icon ?? "🏮",
    description: definition.description ?? "老闆還在準備中。",
    isSpecial,
    maxLife,
    life: maxLife,
    isClosed: false,
    isBlocked: false,
    price: definition.price ?? 0,
    staminaCost: definition.staminaCost ?? 0,
    interactionType: definition.interactionType
  };
}

export const createInitialStalls = () => STALL_CONFIG.map(createStall);

export const STALL_DISPLAY_STATUS = Object.freeze({
  OPEN: "OPEN",
  CLOSED: "CLOSED",
  INFLUENCER_BLOCKED: "INFLUENCER_BLOCKED"
});

export function getStallDisplayStatus(stall, environment) {
  if (!stall) return null;
  const isBlocked = Boolean(stall.isBlocked || stall.id === environment.influencerBlockedStallId);
  const code = stall.isClosed
    ? STALL_DISPLAY_STATUS.CLOSED
    : isBlocked
      ? STALL_DISPLAY_STATUS.INFLUENCER_BLOCKED
      : STALL_DISPLAY_STATUS.OPEN;
  return {
    code,
    label: code === STALL_DISPLAY_STATUS.CLOSED
      ? "今日公休"
      : code === STALL_DISPLAY_STATUS.INFLUENCER_BLOCKED
        ? "網紅佔領中"
        : "營業中",
    isClosed: stall.isClosed,
    isBlocked,
    canEnter: !stall.isClosed && !isBlocked,
    typeLabel: STALL_TYPE_LABELS[stall.type] ?? stall.type,
    statusText: code === STALL_DISPLAY_STATUS.CLOSED ? "今日公休" : code === STALL_DISPLAY_STATUS.INFLUENCER_BLOCKED ? "網紅佔領中" : "營業中",
    notice: stall.isClosed ? "今天休攤。" : isBlocked ? "網紅正在拍攝，暫時無法進入。" : "",
    lifeText: stall.isSpecial ? null : "剩餘：" + stall.life
  };
}

// Step 3 compatibility alias. New UI code uses getStallDisplayStatus().
export const getStallViewState = getStallDisplayStatus;

export function cycleStallId(stalls, selectedStallId, direction) {
  if (!stalls.length) return null;
  const currentIndex = stalls.findIndex((stall) => stall.id === selectedStallId);
  const startIndex = currentIndex < 0 ? 0 : currentIndex;
  return stalls[(startIndex + direction + stalls.length) % stalls.length].id;
}
