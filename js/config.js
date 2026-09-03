export const CONFIG = Object.freeze({
  characterBuilds: Object.freeze([
    { id: "high-school", name: "高中生", stamina: 120, money: 600, description: "體力充沛、預算較少。" },
    { id: "college", name: "大學生", stamina: 110, money: 800, description: "體力與預算均衡。" },
    { id: "worker", name: "社會人", stamina: 100, money: 1000, description: "穩定的一般起點。" },
    { id: "middle-aged", name: "中年人", stamina: 85, money: 1300, description: "體力較少、資金充裕。" },
    { id: "senior", name: "老年人", stamina: 70, money: 1600, description: "體力有限、起始資金最多。" }
  ]),
  stallLife: Object.freeze({ min: 10, max: 20 }),
  staminaCosts: Object.freeze({ game: 10, food: 0, testWork: 25 }),
  foodMaxRecovery: 30,
  environmentEventInterval: Object.freeze({ min: 4, max: 6 }),
  influencerLeaveChance: 0.5,
  rainGameStaminaPenalty: 5,
  mosquitoStaminaPenalty: 5,
  crowdLevels: Object.freeze({ 1: "冷清", 2: "稀少", 3: "普通", 4: "熱鬧", 5: "爆滿" }),
  priceMultipliers: Object.freeze([0.9, 1.0, 1.2, 1.4]),
  rewardMultipliers: Object.freeze([0.8, 1.0, 1.2, 1.5, 2.0]),
  defaults: Object.freeze({ buildId: "worker", crowdLevel: 3, priceLevel: 1, rewardLevel: 1 })
});

export const getBuildById = (buildId) =>
  CONFIG.characterBuilds.find((build) => build.id === buildId) ?? null;

export const LOW_STAMINA_MESSAGES = Object.freeze([
  "我的腳已經不是我的腳了。", "不行，我的靈魂想玩，但肉體拒絕。",
  "再走一步，我可能就要住在這攤了。", "老闆等等，我先找張椅子投胎。",
  "我的體力條比我的人生規劃還空。", "年輕人逛夜市，我在夜市復健。",
  "這不是累，這是身體正式提出離職。", "我可以進去，但等等可能要叫救護車出來。"
]);
export const NO_MONEY_MESSAGES = Object.freeze([
  "老闆，我用眼神付款可以嗎？", "錢包打開了，裡面只有風。",
  "我不是不想買，是我的錢不允許。", "很好，現在連鹹酥雞都比我有錢。",
  "等等，我的錢包好像先回家了。", "我跟這攤的緣分，差了幾張鈔票。",
  "吃不起，但我可以站在旁邊聞。", "原來逛夜市也是一種財力測驗。"
]);
export function pickRandomMessage(messages, randomFn = Math.random) {
  if (!messages.length) return "";
  return messages[Math.min(messages.length - 1, Math.max(0, Math.floor(randomFn() * messages.length)))];
}
