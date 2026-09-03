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

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const pick = (items, randomFn) => items[Math.min(items.length - 1, Math.floor(randomFn() * items.length))] ?? null;
export function getNextEventInterval(randomFn = Math.random) {
  const { min, max } = CONFIG.environmentEventInterval;
  return min + Math.min(max - min, Math.floor(randomFn() * (max - min + 1)));
}
export const pickLevelDelta = (randomFn = Math.random) => randomFn() < 0.5 ? 1 : 2;
export const EVENT_MESSAGES = Object.freeze({
  RAIN_START: "下雨啦！夜市突然變成水上樂園。",
  RAIN_STOP: "雨終於停了，拖鞋可以停止吸水了。",
  MOSQUITO_START: "蚊子大軍抵達戰場。", MOSQUITO_STOP: "蚊子終於放過你了。",
  INFLUENCER: "網紅來拍片了，又有人把路堵住。",
  INFLUENCER_LEAVE: "網紅終於拍完了，大家可以走路了。",
  CROWD_UP: "人突然多了起來，大家到底從哪冒出來的？",
  CROWD_DOWN: "人潮散了一點，終於不用一直說借過。",
  PRICE_UP: "老闆們默契十足地一起漲價了。", PRICE_DOWN: "今晚突然開始佛心營業。",
  REWARD_UP: "今晚手氣好像有點東西。", REWARD_DOWN: "今天的運氣似乎請假了。"
});
const EVENT_TITLES = {
  RAIN_START: "突然下大雨！", RAIN_STOP: "雨停了！",
  MOSQUITO_START: "蚊子來了！", MOSQUITO_STOP: "蚊子散去了！",
  INFLUENCER: "網紅來了！", INFLUENCER_LEAVE: "網紅離開了！",
  CROWD_UP: "人潮增加了！", CROWD_DOWN: "人潮減少了！",
  PRICE_UP: "食物漲價了！", PRICE_DOWN: "食物降價了！",
  REWARD_UP: "遊戲獎勵提高！", REWARD_DOWN: "遊戲獎勵降低！"
};
// Snapshot presentation data immediately after the event, never mutate gameplay here.
export function getEnvironmentEventUI(event, state) {
  const env = state.environment;
  const blocked = state.stalls.find(stall => stall.id === env.influencerBlockedStallId);
  const effects = {
    RAIN_START: `遊戲攤體力需求增加 ${CONFIG.rainGameStaminaPenalty}`,
    RAIN_STOP: "遊戲攤體力需求恢復正常",
    MOSQUITO_START: `每次成功行動額外消耗 ${CONFIG.mosquitoStaminaPenalty} 體力`,
    MOSQUITO_STOP: "不再受到蚊子額外體力消耗",
    INFLUENCER: blocked ? `🚫 ${blocked.name} 暫時無法進入` : "目前沒有可封鎖的攤位",
    INFLUENCER_LEAVE: "網紅封鎖解除",
    CROWD_UP: `人潮增加，目前：${CONFIG.crowdLevels[env.crowdLevel]}`,
    CROWD_DOWN: `人潮減少，目前：${CONFIG.crowdLevels[env.crowdLevel]}`,
    PRICE_UP: `食物價格目前為 ×${CONFIG.priceMultipliers[env.priceLevel]}`,
    PRICE_DOWN: `食物價格目前為 ×${CONFIG.priceMultipliers[env.priceLevel]}`,
    REWARD_UP: `遊戲獎勵目前為 ×${CONFIG.rewardMultipliers[env.rewardLevel]}`,
    REWARD_DOWN: `遊戲獎勵目前為 ×${CONFIG.rewardMultipliers[env.rewardLevel]}`
  };
  return { title: EVENT_TITLES[event.eventId], description: EVENT_MESSAGES[event.eventId], effectLines: [effects[event.eventId]] };
}
const LEVEL_RULES = {
  CROWD: { key: "crowdLevel", min: 1, max: 5 },
  PRICE: { key: "priceLevel", min: 0, max: CONFIG.priceMultipliers.length - 1 },
  REWARD: { key: "rewardLevel", min: 0, max: CONFIG.rewardMultipliers.length - 1 }
};
export function getEligibleEnvironmentEvents(environment) {
  const pool = [environment.raining ? "RAIN_STOP" : "RAIN_START", environment.mosquito ? "MOSQUITO_STOP" : "MOSQUITO_START"];
  if (!environment.influencer) pool.push("INFLUENCER");
  for (const [prefix, { key, min, max }] of Object.entries(LEVEL_RULES)) {
    if (environment[key] < max) pool.push(`${prefix}_UP`);
    if (environment[key] > min) pool.push(`${prefix}_DOWN`);
  }
  return pool;
}
export const pickEnvironmentEvent = (state, randomFn = Math.random) => pick(getEligibleEnvironmentEvents(state.environment), randomFn);
export function pickInfluencerTarget(stalls, currentId, randomFn = Math.random) {
  const legal = stalls.filter((stall) => !stall.isSpecial && ["GAME", "FOOD"].includes(stall.type) && !stall.isClosed && stall.life > 0);
  const candidates = legal.length > 1 ? legal.filter((stall) => stall.id !== currentId) : legal;
  return pick(candidates, randomFn)?.id ?? null;
}
export function moveInfluencer(state, randomFn = Math.random) {
  if (state.environment.influencer) state.environment.influencerBlockedStallId = pickInfluencerTarget(state.stalls, state.environment.influencerBlockedStallId, randomFn);
}
export function applyEnvironmentEvent(state, eventId, randomFn = Math.random) {
  const env = state.environment;
  if (eventId === "INFLUENCER_LEAVE") {
    if (!env.influencer) return null;
  } else if (!getEligibleEnvironmentEvents(env).includes(eventId)) return null;
  const details = {};
  if (eventId === "RAIN_START" || eventId === "RAIN_STOP") env.raining = eventId === "RAIN_START";
  else if (eventId === "MOSQUITO_START" || eventId === "MOSQUITO_STOP") env.mosquito = eventId === "MOSQUITO_START";
  else if (eventId === "INFLUENCER") {
    env.influencer = true;
    env.influencerBlockedStallId = pickInfluencerTarget(state.stalls, null, randomFn);
    details.targetStallId = env.influencerBlockedStallId;
  } else if (eventId === "INFLUENCER_LEAVE") {
    env.influencer = false;
    env.influencerBlockedStallId = null;
  } else {
    const [prefix, direction] = eventId.split("_");
    const { key, min, max } = LEVEL_RULES[prefix];
    const before = env[key];
    env[key] = clamp(before + pickLevelDelta(randomFn) * (direction === "UP" ? 1 : -1), min, max);
    details.delta = env[key] - before;
    details.level = env[key];
  }
  const event = { eventId, actionCount: state.progress.actionCount, details };
  state.statistics.eventHistory.push(event);
  return event;
}
export function triggerEnvironmentEvent(state, randomFn = Math.random) {
  // A departure consumes this event slot; otherwise draw one normal event.
  const eventId = state.environment.influencer && randomFn() < CONFIG.influencerLeaveChance
    ? "INFLUENCER_LEAVE" : pickEnvironmentEvent(state, randomFn);
  const event = applyEnvironmentEvent(state, eventId, randomFn);
  state.progress.nextEventAt = state.progress.actionCount + getNextEventInterval(randomFn);
  return event;
}
export function checkEnvironmentEvent(state, randomFn = Math.random) {
  return state.progress.actionCount >= state.progress.nextEventAt ? triggerEnvironmentEvent(state, randomFn) : null;
}
export function getEffectiveGameStaminaCost(stall, environment) {
  return stall.staminaCost + (stall.type === "GAME" && environment.raining ? CONFIG.rainGameStaminaPenalty : 0);
}
export const getEffectiveFoodPrice = (stall, environment) => Math.round(stall.price * (CONFIG.priceMultipliers[environment.priceLevel] ?? 1));
export function applyRewardModifier(result, environment) {
  const multiplier = CONFIG.rewardMultipliers[environment.rewardLevel] ?? 1;
  const adjusted = { ...result };
  for (const key of ["moneyDelta", "scoreDelta"]) if (adjusted[key] > 0) adjusted[key] = Math.round(adjusted[key] * multiplier);
  return adjusted;
}
