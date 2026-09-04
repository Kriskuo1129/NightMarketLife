import { CONFIG } from "./config.js";

export const NIGHT_CONDITION_CONFIG = Object.freeze([
  { id:"NORMAL_NIGHT", title:"🌤️ 普普通通的一晚", description:"沒有活動、沒有颱風、沒有連假，今晚就好好逛一圈。", weight:35, levels:[3,3,3,3,3] },
  { id:"AFTER_TYPHOON", title:"🌪️ 颱風剛過", description:"風雨剛走，街上還有點凌亂，敢開攤的老闆都很有精神。", weight:10, levels:[1,4,4,3,1] },
  { id:"CONCERT_NIGHT", title:"🎤 附近有演唱會", description:"散場人潮湧進夜市，今晚每條路都特別熱鬧。", weight:15, levels:[5,4,4,3,5] },
  { id:"NEW_YEAR", title:"🧧 過年期間", description:"大家帶著紅包出門，夜市從入口一路熱鬧到底。", weight:10, levels:[5,5,4,2,5] },
  { id:"ANNIVERSARY", title:"🎆 夜市週年慶", description:"今晚掛滿慶典燈籠，攤商也都拿出看家本領。", weight:15, levels:[4,2,4,3,5] },
  { id:"BUSY_MARKET", title:"💸 老闆發現人很多", description:"人潮比預期更多，老闆們悄悄換上了今晚的價目表。", weight:15, levels:[4,4,3,4,4] }
].map(item=>Object.freeze({...item,levels:Object.freeze(item.levels)})));
export const OPENING_CONFIG = NIGHT_CONDITION_CONFIG;

export const getNightConditionById = id => NIGHT_CONDITION_CONFIG.find(item => item.id === id) ?? null;
export const getOpeningById = getNightConditionById;

export function pickNightCondition(randomFn = Math.random) {
  const total = NIGHT_CONDITION_CONFIG.reduce((sum, opening) => sum + opening.weight, 0);
  let ticket = Math.max(0, Math.min(1, randomFn())) * total;
  for (const opening of NIGHT_CONDITION_CONFIG) {
    ticket -= opening.weight;
    if (ticket < 0) return opening;
  }
  return NIGHT_CONDITION_CONFIG.at(-1);
}
export const pickOpeningCondition = pickNightCondition;

// Called once on a freshly-created default Environment, not on a previous run.
export function applyNightCondition(environment, condition) {
  const keys=["crowdLevel","priceLevel","rewardLevel","temperatureLevel","businessLevel"];
  keys.forEach((key,index)=>environment[key]=condition.levels[index]);
  return environment;
}
export const applyOpeningCondition = applyNightCondition;
