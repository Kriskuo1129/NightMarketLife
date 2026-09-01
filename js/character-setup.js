import { DEFAULT_CLOTHES, FACE_ASSETS } from "../assets/character-assets.js";

export function cycleAsset(assets, currentId, direction) {
  if (!assets.length) return null;
  const currentIndex = assets.findIndex((asset) => asset.id === currentId);
  const startIndex = currentIndex < 0 ? 0 : currentIndex;
  return assets[(startIndex + direction + assets.length) % assets.length];
}

export function changeFace(player, direction) {
  const asset = cycleAsset(FACE_ASSETS, player.appearance.faceId, direction);
  if (!asset) return null;
  player.appearance.faceId = asset.id;
  player.appearance.customFace = null;
  player.face = asset.id;
  return asset;
}

export function changeClothes(player, direction) {
  const asset = cycleAsset(DEFAULT_CLOTHES, player.appearance.clothesId, direction);
  if (!asset) return null;
  player.appearance.clothesId = asset.id;
  player.appearance.customClothes = null;
  player.clothes = asset.id;
  return asset;
}

export function setCustomAppearance(player, kind, dataUrl) {
  if (kind === "face") player.appearance.customFace = dataUrl;
  if (kind === "clothes") player.appearance.customClothes = dataUrl;
}

export function getAppearanceView(player) {
  const face = FACE_ASSETS.find((asset) => asset.id === player.appearance.faceId) ?? FACE_ASSETS[0] ?? null;
  const clothes = DEFAULT_CLOTHES.find((asset) => asset.id === player.appearance.clothesId) ?? DEFAULT_CLOTHES[0] ?? null;
  return {
    faceSrc: player.appearance.customFace || face?.src || "",
    faceName: player.appearance.customFace ? "自訂臉" : face?.name || "無可用素材",
    clothesSrc: player.appearance.customClothes || clothes?.src || "",
    clothesName: player.appearance.customClothes ? "自訂衣服" : clothes?.name || "無可用素材"
  };
}
