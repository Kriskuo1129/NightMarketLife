import { CONFIG } from "./config.js";

export const STALL_TYPES = Object.freeze({ GAME: "GAME", FOOD: "FOOD", OFFICE: "OFFICE", CLOTHING: "CLOTHING" });
export const INTERACTION_TYPES = Object.freeze({ GAME: "GAME", FOOD: "FOOD", WORK: "WORK", SERVICE: "SERVICE" });

export const STALL_CONFIG = Object.freeze([]);

const randomInteger = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export function createStall(definition) {
  const isSpecial = Boolean(definition.isSpecial);
  const maxLife = isSpecial ? null : (definition.maxLife ?? randomInteger(CONFIG.stallLife.min, CONFIG.stallLife.max));
  return {
    id: definition.id,
    name: definition.name,
    type: definition.type,
    isSpecial,
    maxLife,
    life: maxLife,
    isClosed: false,
    isBlocked: false,
    price: definition.price ?? 0,
    staminaCost: definition.staminaCost ?? 0,
    interactionType: definition.interactionType
  };
}

export const createInitialStalls = () => STALL_CONFIG.map(createStall);
