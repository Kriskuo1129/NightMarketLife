const CHARACTER_SETTINGS_KEY = "nightMarketLife.characterSettings.v1";

export function saveCharacterSettings(settings) {
  const allowed = {
    name: settings.name ?? "",
    buildId: settings.buildId ?? "",
    selectedFaceId: settings.selectedFaceId ?? settings.appearance?.faceId ?? settings.face ?? "",
    selectedClothesId: settings.selectedClothesId ?? settings.appearance?.clothesId ?? settings.clothes ?? "",
    customFace: settings.customFace ?? settings.appearance?.customFace ?? null,
    customClothes: settings.customClothes ?? settings.appearance?.customClothes ?? null
  };
  try {
    localStorage.setItem(CHARACTER_SETTINGS_KEY, JSON.stringify(allowed));
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

export function loadCharacterSettings() {
  try {
    const value = localStorage.getItem(CHARACTER_SETTINGS_KEY);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.warn("Unable to load character settings.", error);
    return null;
  }
}

export const clearCharacterSettings = () => localStorage.removeItem(CHARACTER_SETTINGS_KEY);
