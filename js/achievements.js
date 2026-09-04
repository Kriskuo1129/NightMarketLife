// Phase 1 Temporary Balance: revisit thresholds when integrating the real games.
export const ACHIEVEMENT_THRESHOLDS = Object.freeze({ games: 3, manyGames: 8, foods: 3, usualVisits: 3, rainActions: 2, mosquitoActions: 3, homeStamina: 50, homeMoney: 500 });
export const ACHIEVEMENT_CONFIG = Object.freeze([
  ["COME_ALL_THE_WAY", "來都來了", "都走到攤位前面了，不玩一下說不過去吧。"],
  ["CANT_STOP", "欲罷不能", "說好最後一次，通常都不是最後一次。"],
  ["BIG_EATER", "大吃特吃", "來夜市不吃東西，不然要幹嘛？"],
  ["HERE_TO_EAT", "專程來吃", "說是來逛夜市，其實只是換個地方吃飯。"],
  ["THE_USUAL", "老闆照舊", "老闆已經懶得問你要吃什麼了。"],
  ["EAT_UNTIL_CLOSE", "吃到收攤", "老闆不是賣完，是被你吃完的。"],
  ["EXHAUSTED", "精疲力盡", "你的腳已經正式提出抗議。"],
  ["BROKE", "身無分文", "翻遍所有口袋，真的什麼都沒有。"],
  ["ROCK_BOTTOM", "山窮水盡", "沒力、沒錢，但至少人還在夜市。"],
  ["COMEBACK", "東山再起", "一口下去，又覺得自己可以了。"],
  ["WALK_IN_RAIN", "雨中漫步", "別人在躲雨，你還在逛。"],
  ["HUMAN_MOSQUITO_COIL", "人體蚊香", "今晚最飽的可能不是你。"],
  ["WHO_IS_THAT", "那到底誰", "大家都在看，你到最後還是不知道他是誰。"],
  ["TRY_EVERYTHING", "雨露均霑", "吃的、玩的，一攤都不能少。"],
  ["STILL_WANT_MORE", "意猶未盡", "明明還能繼續，你居然真的回家了。"],
  ["EMPTY_POCKETS", "兩袖清風", "今天帶回家的，主要是回憶。"],
  ["NOTHING_LEFT", "一乾二淨", "體力沒有了，錢也沒有了。非常完整。"]
].map(([id, name, description]) => Object.freeze({ id, name, description })));

export function createAchievement({ id, name, description }) {
  return { id, name, description, unlocked: false };
}
export const createInitialAchievements = () => ACHIEVEMENT_CONFIG.map(createAchievement);
export const createAchievementTracking = () => ({ staminaZero: false, moneyZero: false, bothZero: false, foodRecovery: false, foodClosure: false, rainActions: 0 });

// Successful action/commit/confirmed-home boundaries only; never called by render.
// Only achievements and their minimal per-run history may be mutated here.
export function evaluateAchievements(state, { before, raining = false, foodAction = false, foodClosed = false, settlement = false } = {}) {
  const { player: p, statistics: s, session } = state;
  const t = session.achievementTracking;
  const limits = ACHIEVEMENT_THRESHOLDS;
  if (before) {
    t.staminaZero ||= before.stamina > 0 && p.stamina === 0;
    t.moneyZero ||= before.money > 0 && p.money === 0;
    t.bothZero ||= p.stamina === 0 && p.money === 0;
    if (raining) t.rainActions += 1;
  }
  t.foodRecovery ||= foodAction && t.staminaZero && p.stamina > 0;
  t.foodClosure ||= foodClosed;
  const games = Object.values(s.gamePlays).reduce((sum, count) => sum + count, 0);
  const ordinary = state.stalls.filter(stall => stall.isSpecial === false && ["GAME", "FOOD"].includes(stall.type));
  const conditions = {
    COME_ALL_THE_WAY: games >= limits.games,
    CANT_STOP: games >= limits.manyGames,
    BIG_EATER: s.foodPurchases >= limits.foods,
    HERE_TO_EAT: s.foodPurchases >= limits.foods && s.foodPurchases > games,
    THE_USUAL: state.stalls.some(stall => stall.type === "FOOD" && (s.stallVisits[stall.id] ?? 0) >= limits.usualVisits),
    EAT_UNTIL_CLOSE: t.foodClosure,
    EXHAUSTED: t.staminaZero,
    BROKE: t.moneyZero,
    ROCK_BOTTOM: t.bothZero,
    COMEBACK: t.foodRecovery,
    WALK_IN_RAIN: t.rainActions >= limits.rainActions,
    HUMAN_MOSQUITO_COIL: s.mosquitoActions >= limits.mosquitoActions,
    WHO_IS_THAT: s.eventHistory.some(event => event.eventId === "INFLUENCER"),
    TRY_EVERYTHING: ordinary.length > 0 && ordinary.every(stall => (s.stallVisits[stall.id] ?? 0) > 0),
    STILL_WANT_MORE: settlement && p.stamina >= limits.homeStamina && p.money >= limits.homeMoney,
    EMPTY_POCKETS: settlement && p.money === 0,
    NOTHING_LEFT: settlement && p.stamina === 0 && p.money === 0
  };
  for (const achievement of state.achievements) achievement.unlocked ||= Boolean(conditions[achievement.id]);
  return state.achievements;
}
