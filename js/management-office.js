import { CONFIG, pickRandomMessage } from "./config.js";

// Spoken observations only. Internal hint keys and weights never go into the UI.
export const MANAGEMENT_DIALOGUE_POOLS = Object.freeze(Object.fromEntries(Object.entries({
  rain: [
    "外面雨下得不小啦，走來走去會比較累，你自己注意一點。",
    "今天這雨一下就沒完沒了的，鞋子不要等等整雙都是水。",
    "外面濕答答的，今天要到處跑可能會比平常累一點喔。"
  ],
  mosquito: [
    "今天蚊子有夠多，我坐在這邊都被叮好幾包了。",
    "今天蚊子特別兇，連我那支扇子都快揮不動了。",
    "今天蚊子是真的多，你在外面晃太久自己小心啦。"
  ],
  influencer: [
    "剛剛好像有什麼網紅跑來，現在{stall}那邊擠得要命。",
    "{stall}那邊不知道在拍什麼，一堆人圍在那裡，你等等再去啦。",
    "剛才有人說網紅來了，現在大家都堵在{stall}那邊。"
  ],
  influencerUnlocated: [
    "聽說有網紅在夜市裡拍片，我倒是沒看清楚跑去哪了。",
    "剛剛有人扛著鏡頭走過去，說是網紅啦，現在在哪我就不知道了。",
    "今天有網紅來，我這邊沒看到人擠在哪，你自己留意一下。"
  ],
  crowdLow: ["今天人比較少啦，逛起來倒是挺舒服的。", "今晚不知道怎樣，人沒有很多，走路滿輕鬆的。"],
  crowdNormal: ["今天人就差不多啦，沒有特別多也沒有特別少。", "今晚人潮算正常啦，沒有擠到走不動。"],
  crowdHigh: ["今天人滿多的，到處都擠擠的。", "今晚有夠熱鬧，走出去都是人。"],
  crowdExtreme: ["今天不知道大家是不是都不用回家，人多到快沒地方走了。", "外面真的擠得不得了，我想出去買杯茶都嫌麻煩。"],
  priceLow: ["今天有些老闆滿佛心的，吃東西好像比較划算。", "今天吃的價錢滿親切的，有想吃的可以去看看。"],
  priceHigh: ["今天那些老闆價錢都開得滿有自信的，買東西前自己看一下錢包啦。", "今天吃東西好像貴了一點，你買之前先看一下價錢。"],
  priceVeryHigh: ["今天吃的東西看起來都不便宜，你等等不要買太開心才發現沒錢。", "今天小吃攤的價錢看得我都縮手了，你自己斟酌啦。"],
  rewardLow: ["遊戲攤今天好像比較小氣，老闆都沒有很想送東西的樣子。", "今天遊戲攤那些老闆把獎品顧得很緊喔。"],
  rewardHigh: ["今天遊戲攤那邊喊得滿大聲的，好像有在加碼。", "剛剛經過遊戲攤，老闆送東西送得滿起勁的。"],
  rewardVeryHigh: ["今天那幾個遊戲攤是真的滿敢送的，剛剛一直聽到有人在歡呼。", "遊戲攤今天大方得很，獎品一直往外拿，看得我都想去湊熱鬧。"],
  normal: [
    "今天喔？就普通啊。難得什麼怪事都沒有。",
    "今天滿正常的啦，你不要想那麼多，去逛就對了。",
    "沒下雨，人也差不多，今天算好逛啦。",
    "就老樣子啊，吃的吃、玩的玩，你自己去看看。",
    "你每次來都問我，今天真的沒什麼特別的啦。"
  ],
  closing: ["差不多就這樣啦，你自己去看看。", "啊來都來了，去走走啦。", "好啦好啦，我還要顧這邊，你去逛啦。"]
}).map(([key, lines]) => [key, Object.freeze(lines)])));

export function collectManagementHints(environment, stalls) {
  const hints = [];
  const add = (key, weight, poolKey = key, stallName = "") => hints.push({ key, weight, pool: MANAGEMENT_DIALOGUE_POOLS[poolKey], stallName });
  if (environment.raining) add("rain", 4);
  if (environment.mosquito) add("mosquito", 4);
  if (environment.influencer) {
    const target = stalls.find(stall => stall.id === environment.influencerBlockedStallId);
    add("influencer", 4, target ? "influencer" : "influencerUnlocated", target ? `「${target.name}」` : "");
  }
  const crowd = environment.crowdLevel;
  add("crowd", crowd === CONFIG.defaults.crowdLevel ? .5 : 2,
    crowd <= 2 ? "crowdLow" : crowd === 3 ? "crowdNormal" : crowd === 4 ? "crowdHigh" : "crowdExtreme");
  const price = CONFIG.priceMultipliers[environment.priceLevel] ?? 1;
  if (price !== 1) add("price", 2, price < 1 ? "priceLow" : price >= 1.4 ? "priceVeryHigh" : "priceHigh");
  const reward = CONFIG.rewardMultipliers[environment.rewardLevel] ?? 1;
  if (reward !== 1) add("reward", 2, reward < 1 ? "rewardLow" : reward >= 1.5 ? "rewardVeryHigh" : "rewardHigh");
  return hints;
}

export function selectManagementHints(hints, randomFn = Math.random) {
  if (!hints.some(hint => hint.weight > .5)) return [];
  const remaining = [...hints];
  const selected = [];
  const count = Math.min(remaining.length, randomFn() < .5 ? 2 : 3);
  while (selected.length < count) {
    let draw = randomFn() * remaining.reduce((sum, hint) => sum + hint.weight, 0);
    let index = remaining.length - 1;
    for (let i = 0; i < remaining.length; i += 1) {
      draw -= remaining[i].weight;
      if (draw < 0) { index = i; break; }
    }
    selected.push(remaining.splice(index, 1)[0]);
  }
  return selected;
}

export function getManagementOfficeDialogue(environment, stalls, randomFn = Math.random) {
  const hints = selectManagementHints(collectManagementHints(environment, stalls), randomFn);
  if (!hints.length) return pickRandomMessage(MANAGEMENT_DIALOGUE_POOLS.normal, randomFn);
  const sentences = hints.map(hint => pickRandomMessage(hint.pool, randomFn).replace("{stall}", () => hint.stallName));
  let dialogue = `我跟你講啦，${sentences.join(" ")}`;
  if (randomFn() < .4) dialogue += ` ${pickRandomMessage(MANAGEMENT_DIALOGUE_POOLS.closing, randomFn)}`;
  return dialogue;
}
