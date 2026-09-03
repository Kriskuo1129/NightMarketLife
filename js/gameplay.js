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
  const after = projectResources(state.player, activity, state.environment.mosquito);
  const warnings = [];
  if (after.stamina <= 0) warnings.push("⚠️ 完成這次行動後體力將歸零，今晚會直接結束。");
  if (after.money <= 0) warnings.push(stall.type === "FOOD"
    ? "⚠️ 買完之後你會身無分文，今晚將直接結束。"
    : "⚠️ 完成這次行動後你會身無分文，今晚會直接結束。");
  return { ...after, warnings };
}

export const getExhaustionReason = player => player.stamina <= 0 ? "STAMINA_EXHAUSTED" : player.money <= 0 ? "MONEY_EXHAUSTED" : null;
export const END_MESSAGES = {
  STAMINA_EXHAUSTED: { title: "眼前一黑", description: "你的腳步越來越沉，下一秒眼前一黑。今晚看來只能到這裡了。" },
  MONEY_EXHAUSTED: { title: "口袋比臉還乾淨", description: "你摸了摸口袋，連最後一個銅板都沒有。再逛下去也只能幫老闆顧攤，今晚還是回家吧。" }
};

export function isInteractionLocked(state) {
  const session = state.session;
  return Boolean(session.endReason || session.exhaustionPending ||
    [session.presentation, ...session.presentationQueue].some(item =>
      ["ENVIRONMENT_EVENT", "ENVIRONMENT_EVENT_MODAL", "END_REASON_MODAL"].includes(item?.type)));
}
