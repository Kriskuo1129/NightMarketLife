import { getAppearanceView } from "./character-setup.js";

export const CHARACTER_LAYER_NAMES = Object.freeze(["clothes", "face", "accessory"]);

function createImageLayer(kind, alt) {
  const layer = document.createElement("div");
  layer.className = "character-layer " + kind + "-layer";
  layer.dataset.characterLayer = kind;
  const image = document.createElement("img");
  image.alt = alt;
  layer.append(image);
  return layer;
}

export function ensureCharacterRenderer(host) {
  if (host.dataset.characterReady === "true") return host;
  host.classList.add("character-renderer");
  host.setAttribute("aria-label", host.dataset.characterLabel || "角色預覽");
  const clothes = createImageLayer("clothes", "目前穿著的衣服");
  const face = createImageLayer("face", "目前使用的臉");
  const accessory = document.createElement("div");
  accessory.className = "character-layer accessory-layer";
  accessory.dataset.characterLayer = "accessory";
  accessory.setAttribute("aria-hidden", "true");
  host.replaceChildren(clothes, face, accessory);
  host.dataset.characterReady = "true";
  return host;
}

export function renderCharacter(host, player) {
  ensureCharacterRenderer(host);
  const appearance = getAppearanceView(player);
  const face = host.querySelector('[data-character-layer="face"] img');
  const clothes = host.querySelector('[data-character-layer="clothes"] img');
  if (face) face.src = appearance.faceSrc;
  if (clothes) clothes.src = appearance.clothesSrc;
}

export function renderAllCharacters(player) {
  document.querySelectorAll("[data-character-host]").forEach((host) => renderCharacter(host, player));
}
