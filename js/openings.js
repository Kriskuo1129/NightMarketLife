import { CONFIG } from "./config.js";

export const OPENING_CONFIG = Object.freeze([
  { id: "NORMAL_NIGHT", title: "🌤️ 普普通通的一晚", description: "沒有活動、沒有颱風、沒有連假，老闆正常上班，你也正常來亂。", weight: 35, modifiers: {}, effectLines: ["今晚一切正常。"] },
  { id: "AFTER_TYPHOON", title: "🌪️ 颱風剛過", description: "颱風昨天才剛走，路邊還有幾塊招牌不知道是誰家的。敢出來擺攤的老闆都是真的勇。", weight: 10, modifiers: { crowdLevel: -2, priceLevel: 1, rewardLevel: 1 }, effectLines: ["今晚人潮明顯比較少。", "東西好像貴了一點。", "遊戲攤老闆今天似乎比較敢給。"] },
  { id: "CONCERT_NIGHT", title: "🎤 今天附近有演唱會", description: "附近今晚有大型演唱會。你還沒看到歌手，已經先看到一大群不知道要去哪裡吃飯的人。", weight: 15, modifiers: { crowdLevel: 1, priceLevel: 1, rewardLevel: 1 }, effectLines: ["今晚人潮特別熱鬧。", "攤位價格似乎跟著漲了一點。", "遊戲攤今晚也比較敢加碼。"] },
  { id: "NEW_YEAR", title: "🧧 過年期間", description: "大家領完紅包都來逛夜市了。老闆知道你有錢，你也知道老闆知道你有錢。", weight: 10, modifiers: { crowdLevel: 2, priceLevel: 2, rewardLevel: 1 }, effectLines: ["今晚夜市擠得水洩不通。", "價目表看起來非常有年味。", "遊戲攤的獎勵也比平常大方一些。"] },
  { id: "ANNIVERSARY", title: "🎆 夜市週年慶", description: "今天是夜市週年慶！沒有人知道到底第幾週年，但老闆說有優惠就先相信他。", weight: 15, modifiers: { crowdLevel: 1, priceLevel: -1, rewardLevel: 1 }, effectLines: ["今晚人潮相當熱鬧。", "不少攤位正在做優惠。", "遊戲攤似乎也開始加碼了。"] },
  { id: "BUSY_MARKET", title: "💸 老闆們發現今天人很多", description: "今天人潮好像特別旺。幾個老闆互看一眼，默默把昨天的價目表收了起來。", weight: 15, modifiers: { crowdLevel: 1, priceLevel: 1 }, effectLines: ["今晚人潮比平常多。", "不知道為什麼，東西也跟著貴了。"] }
].map(opening => Object.freeze({ ...opening, modifiers: Object.freeze(opening.modifiers), effectLines: Object.freeze(opening.effectLines) })));

export const getOpeningById = id => OPENING_CONFIG.find(opening => opening.id === id) ?? null;

export function pickOpeningCondition(randomFn = Math.random) {
  const total = OPENING_CONFIG.reduce((sum, opening) => sum + opening.weight, 0);
  let ticket = Math.max(0, Math.min(1, randomFn())) * total;
  for (const opening of OPENING_CONFIG) {
    ticket -= opening.weight;
    if (ticket < 0) return opening;
  }
  return OPENING_CONFIG.at(-1);
}

// Called once on a freshly-created default Environment, not on a previous run.
export function applyOpeningCondition(environment, opening) {
  const bounds = { crowdLevel: [1, 5], priceLevel: [0, CONFIG.priceMultipliers.length - 1], rewardLevel: [0, CONFIG.rewardMultipliers.length - 1] };
  for (const [key, [min, max]] of Object.entries(bounds)) {
    environment[key] = Math.max(min, Math.min(max, environment[key] + (opening.modifiers[key] ?? 0)));
  }
  return environment;
}
