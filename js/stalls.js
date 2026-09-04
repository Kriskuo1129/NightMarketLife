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

export const TEST_GAME_RESULTS = Object.freeze({
  game_01: Object.freeze({ staminaDelta: -20, moneyDelta: 50, completed: true, progressCost: 1, sourceId: "game_01" }),
  game_02: Object.freeze({ staminaDelta: -20, moneyDelta: 100, completed: true, progressCost: 1, sourceId: "game_02" }),
  game_03: Object.freeze({ staminaDelta: -20, moneyDelta: 20, completed: true, progressCost: 1, sourceId: "game_03" })
});

export const FOOD_CONFIG = Object.freeze({
  food_01: Object.freeze({ price: 100, staminaRecovery: 15, temperatureType: "NEUTRAL" }),
  food_02: Object.freeze({ price: 200, staminaRecovery: 30, temperatureType: "HOT" })
});

const LIFE_RANGES=Object.freeze({1:[3,3],2:[3,4],3:[4,5],4:[5,6],5:[6,6]});
const randomInteger = (min, max,randomFn=Math.random) => Math.floor(randomFn() * (max - min + 1)) + min;
export function getInitialStallLife(businessLevel,randomFn=Math.random){const [min,max]=LIFE_RANGES[businessLevel]??LIFE_RANGES[3];return randomInteger(min,max,randomFn);}

export function createStall(definition) {
  const isSpecial = Boolean(definition.isSpecial);
  const maxLife = isSpecial ? null : (definition.maxLife ?? getInitialStallLife(CONFIG.defaults.businessLevel));
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
    price: definition.price ?? FOOD_CONFIG[definition.id]?.price ?? 0,
    staminaRecovery: definition.staminaRecovery ?? FOOD_CONFIG[definition.id]?.staminaRecovery ?? 0,
    temperatureType: definition.temperatureType ?? FOOD_CONFIG[definition.id]?.temperatureType ?? "NEUTRAL",
    staminaCost: definition.staminaCost ?? 0,
    interactionType: definition.interactionType
  };
}

export const createInitialStalls = () => STALL_CONFIG.map(createStall);
export function initializeStallLife(stalls,businessLevel,randomFn=Math.random){for(const stall of stalls){if(stall.isSpecial)continue;stall.maxLife=getInitialStallLife(businessLevel,randomFn);stall.life=stall.maxLife;stall.isClosed=false;stall.isBlocked=false;}return stalls;}

export const STALL_DISPLAY_STATUS = Object.freeze({
  OPEN: "OPEN",
  CLOSED: "CLOSED",
  INFLUENCER_BLOCKED: "INFLUENCER_BLOCKED"
});

export function getStallDisplayStatus(stall, environment) {
  if (!stall) return null;
  syncStallClosure(stall);
  const isBlocked = Boolean(stall.isBlocked);
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

export function syncStallClosure(stall) {
  if (!stall.isSpecial && Number.isFinite(stall.life) && stall.life <= 0) {
    stall.life = 0;
    stall.isClosed = true;
  }
}

export function consumeStallLife(stall) {
  if (stall.isSpecial) return;
  stall.life = Math.max(0, stall.life - 1);
  syncStallClosure(stall);
}

// Step 3 compatibility alias. New UI code uses getStallDisplayStatus().
export const getStallViewState = getStallDisplayStatus;

export function cycleStallId(stalls, selectedStallId, direction) {
  if (!stalls.length) return null;
  const currentIndex = stalls.findIndex((stall) => stall.id === selectedStallId);
  const startIndex = currentIndex < 0 ? 0 : currentIndex;
  return stalls[(startIndex + direction + stalls.length) % stalls.length].id;
}
