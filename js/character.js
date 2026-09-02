import { CONFIG, getBuildById } from "./config.js";
import { DEFAULT_CLOTHES, FACE_ASSETS } from "../assets/character-assets.js";

export const EMPTY_PLAYER_NAME = "-沒輸入名稱-";

export function createPlayer(settings = {}) {
  const { name = "", buildId = CONFIG.defaults.buildId } = settings;
  const build = getBuildById(buildId);
  if (!build) throw new Error(`Unknown character build: ${buildId}`);
  const appearance = {
    faceId: settings.selectedFaceId ?? settings.appearance?.faceId ?? settings.face ?? FACE_ASSETS[0]?.id ?? "",
    clothesId: settings.selectedClothesId ?? settings.appearance?.clothesId ?? settings.clothes ?? DEFAULT_CLOTHES[0]?.id ?? "",
    customFace: settings.customFace ?? settings.appearance?.customFace ?? null,
    customClothes: settings.customClothes ?? settings.appearance?.customClothes ?? null
  };
  return {
    name: String(name).trim(),
    profile: { avatar: settings.avatar ?? settings.profile?.avatar ?? null },
    buildId: build.id,
    stamina: build.stamina,
    maxStamina: build.stamina,
    money: build.money,
    score: 0,
    appearance,
    inventory: { ownedClothes: [] },
    // Step 1 aliases remain available while new code uses appearance.
    face: appearance.faceId,
    clothes: appearance.clothesId
  };
}

export const getPlayerDisplayName = (player) => player.name || EMPTY_PLAYER_NAME;

export function applyBuildToPlayer(player, buildId) {
  const build = getBuildById(buildId);
  if (!build) return false;
  player.buildId = build.id;
  player.maxStamina = build.stamina;
  player.stamina = build.stamina;
  player.money = build.money;
  return true;
}
