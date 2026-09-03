import { CONFIG } from "./config.js";
import { TEST_GAME_RESULTS } from "./stalls.js";
import { applyRewardModifier, getEffectiveFoodPrice, getEffectiveGameStaminaCost } from "./events.js";

export function projectResources(player, activity, mosquito = false) {
  const recovered = Math.min(player.maxStamina, Math.max(0, player.stamina + activity.staminaDelta));
  return {
    stamina: Math.max(0, recovered - (mosquito ? CONFIG.mosquitoStaminaPenalty : 0)),
    money: Math.max(0, player.money + activity.moneyDelta),
    score: player.score + Math.max(0, activity.scoreDelta)
  };
}

export function getStallActivity(stall, environment) {
  if (stall?.type === "GAME" && TEST_GAME_RESULTS[stall.id]) {
    return applyRewardModifier({ ...TEST_GAME_RESULTS[stall.id], staminaDelta: -getEffectiveGameStaminaCost(stall, environment) }, environment);
  }
  if (stall?.type === "FOOD") return {
    staminaDelta: stall.staminaRecovery, moneyDelta: -getEffectiveFoodPrice(stall, environment),
    scoreDelta: 0, completed: true, progressCost: 1, sourceId: stall.id
  };
  return null;
}

export function predictStallAction(state, stall) {
  const activity = getStallActivity(stall, state.environment);
  if (!activity) return null;
  return projectResources(state.player, activity, state.environment.mosquito);
}

export function getResourceZeroWarning(before, after) {
  const stamina = before.stamina > 0 && after.stamina === 0;
  const money = before.money > 0 && after.money === 0;
  if (!stamina && !money) return null;
  return {
    type: "RESOURCE_WARNING_MODAL",
    title: stamina && money ? "又累又窮" : stamina ? "體力耗盡！" : "身無分文！",
    description: stamina && money
      ? "你的腳已經不行了，口袋也乾乾淨淨。今晚突然變得有點艱難。"
      : stamina ? "你的腳……真的不行了 QQ。先找點東西補充體力吧。" : "你翻遍了所有口袋，真的一塊錢都沒有了。",
    effectLines: [stamina && "❤️ 體力已歸零", money && "💰 金錢已歸零"].filter(Boolean)
  };
}

export function isInteractionLocked(state) {
  const session = state.session;
  return Boolean(session.endReason || session.pendingEnvironmentEvent ||
    [session.presentation, ...session.presentationQueue].some(item =>
      ["ENVIRONMENT_EVENT_MODAL", "RESOURCE_WARNING_MODAL"].includes(item?.type)));
}
