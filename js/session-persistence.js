import { CONFIG, getBuildById } from "./config.js";
import { ACHIEVEMENT_CONFIG } from "./achievements.js";
import { STALL_CONFIG } from "./stalls.js";
import { createGameState } from "./state.js";
import { INCIDENT_MESSAGES, getIncidentUI } from "./events.js";
import { getNightConditionById } from "./openings.js";

export const SESSION_VERSION = 1;
export const RUN_SESSION_KEY = "nightMarketLife.session.active.v1";
const ENVIRONMENT_KEYS = ["crowdLevel", "priceLevel", "rewardLevel", "temperatureLevel", "businessLevel"];
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const isFiniteNumber = value => typeof value === "number" && Number.isFinite(value);
const isIsoDate = value => typeof value === "string" && Number.isFinite(Date.parse(value));

export function createSessionId(cryptoApi = globalThis.crypto) {
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === "function") cryptoApi.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  const token = [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
  return `nml-${Date.now().toString(36)}-${token}`;
}

export function buildSessionCapsule(state, now = () => new Date()) {
  return {
    version: SESSION_VERSION,
    sessionId: state.session.integrationSessionId,
    savedAt: now().toISOString(),
    player: { name: state.player.name, buildId: state.player.buildId, stamina: state.player.stamina, maxStamina: state.player.maxStamina, money: state.player.money },
    nightConditionId: state.session.nightConditionId,
    startingMoney: state.session.startingMoney,
    environment: Object.fromEntries(ENVIRONMENT_KEYS.map(key => [key, state.environment[key]])),
    stalls: state.stalls.map(({ id, life, maxLife, isClosed, isBlocked }) => ({ id, life, maxLife, isClosed, isBlocked })),
    progress: { gameActionCount: state.progress.gameActionCount, nextIncidentAt: state.progress.nextIncidentAt },
    statistics: structuredClone(state.statistics),
    achievements: state.achievements.map(({ id, unlocked }) => ({ id, unlocked })),
    achievementTracking: structuredClone(state.session.achievementTracking),
    pendingIncident: state.session.pendingIncident ? { eventId: state.session.pendingIncident.eventId, gameActionCount: state.session.pendingIncident.gameActionCount, details: structuredClone(state.session.pendingIncident.details), projected: structuredClone(state.session.pendingIncident.projected) } : null,
    pendingExternalGame: null,
    lastConsumedResultId: null
  };
}

export function validateSessionCapsule(value) {
  if (!isObject(value) || value.version !== SESSION_VERSION || typeof value.sessionId !== "string" || value.sessionId.length < 8 || !isIsoDate(value.savedAt)) return false;
  const p = value.player;
  if (!isObject(p) || typeof p.name !== "string" || !getBuildById(p.buildId) || ![p.stamina,p.maxStamina,p.money,value.startingMoney].every(isFiniteNumber) || p.stamina < 0 || p.maxStamina <= 0 || p.stamina > p.maxStamina || p.money < 0) return false;
  if (!getNightConditionById(value.nightConditionId) || !isObject(value.environment) || !ENVIRONMENT_KEYS.every(key => Number.isInteger(value.environment[key]) && value.environment[key] >= 1 && value.environment[key] <= 5)) return false;
  const expectedStalls = new Set(STALL_CONFIG.map(stall => stall.id));
  if (!Array.isArray(value.stalls) || value.stalls.length !== expectedStalls.size || new Set(value.stalls.map(stall => stall.id)).size !== expectedStalls.size) return false;
  if (!value.stalls.every(stall => isObject(stall) && expectedStalls.has(stall.id) && typeof stall.isClosed === "boolean" && typeof stall.isBlocked === "boolean" && ((stall.life === null && stall.maxLife === null) || (Number.isInteger(stall.life) && Number.isInteger(stall.maxLife) && stall.life >= 0 && stall.maxLife >= stall.life)))) return false;
  if (!isObject(value.progress) || !Number.isInteger(value.progress.gameActionCount) || value.progress.gameActionCount < 0 || !Number.isInteger(value.progress.nextIncidentAt) || value.progress.nextIncidentAt < value.progress.gameActionCount) return false;
  const s=value.statistics;
  if (!isObject(s) || !Number.isInteger(s.totalActions) || s.totalActions<0 || !Number.isInteger(s.foodPurchases) || s.foodPurchases<0 || ![s.gamePlays,s.stallVisits,s.stallMoneyFlow].every(isObject) || !Array.isArray(s.incidentHistory)) return false;
  const numericMapValid=map=>Object.entries(map).every(([id,count])=>expectedStalls.has(id)&&isFiniteNumber(count));
  if (!numericMapValid(s.gamePlays)||!numericMapValid(s.stallVisits)||!numericMapValid(s.stallMoneyFlow) || !s.incidentHistory.every(item=>isObject(item)&&Object.hasOwn(INCIDENT_MESSAGES,item.eventId)&&Number.isInteger(item.gameActionCount)&&isObject(item.details))) return false;
  const achievementIds=new Set(ACHIEVEMENT_CONFIG.map(item=>item.id));
  if (!Array.isArray(value.achievements)||value.achievements.length!==achievementIds.size||new Set(value.achievements.map(item=>item.id)).size!==achievementIds.size||!value.achievements.every(item=>achievementIds.has(item.id)&&typeof item.unlocked==="boolean")) return false;
  const trackingKeys=["staminaZero","moneyZero","bothZero","foodRecovery","foodClosure"];
  if (!isObject(value.achievementTracking)||Object.keys(value.achievementTracking).length!==trackingKeys.length||!trackingKeys.every(key=>typeof value.achievementTracking[key]==="boolean")) return false;
  if(value.pendingIncident!==null&&(!isObject(value.pendingIncident)||!Object.hasOwn(INCIDENT_MESSAGES,value.pendingIncident.eventId)||!Number.isInteger(value.pendingIncident.gameActionCount)||!isObject(value.pendingIncident.details)||!isObject(value.pendingIncident.projected)))return false;
  return value.pendingExternalGame === null && value.lastConsumedResultId === null;
}

export function saveSession(state, storage = localStorage) {
  try { const capsule=buildSessionCapsule(state); if(!validateSessionCapsule(capsule)) return {ok:false,error:new TypeError("Invalid run session")}; storage.setItem(RUN_SESSION_KEY,JSON.stringify(capsule)); return {ok:true,capsule}; }
  catch(error){ return {ok:false,error}; }
}
export function loadSession(storage = localStorage) {
  try { const raw=storage.getItem(RUN_SESSION_KEY); if(!raw)return{status:"empty",capsule:null}; const capsule=JSON.parse(raw); return validateSessionCapsule(capsule)?{status:"valid",capsule}:{status:"corrupt",capsule:null}; }
  catch(error){return{status:"corrupt",capsule:null,error};}
}
export function clearSession(storage = localStorage){storage.removeItem(RUN_SESSION_KEY);}

export function restoreSession(target,capsule,characterSettings={}) {
  if(!validateSessionCapsule(capsule)) return false;
  const clean=createGameState({...characterSettings,name:capsule.player.name,buildId:capsule.player.buildId});
  Object.assign(clean.player,capsule.player);
  Object.assign(clean.environment,capsule.environment);
  const mutableById=new Map(capsule.stalls.map(stall=>[stall.id,stall]));
  clean.stalls.forEach(stall=>Object.assign(stall,mutableById.get(stall.id)));
  clean.progress=structuredClone(capsule.progress); clean.statistics=structuredClone(capsule.statistics);
  const unlocked=new Map(capsule.achievements.map(item=>[item.id,item.unlocked])); clean.achievements.forEach(item=>item.unlocked=unlocked.get(item.id));
  const pending=capsule.pendingIncident?{...structuredClone(capsule.pendingIncident)}:null;if(pending)pending.ui=getIncidentUI(pending);
  Object.assign(clean.session,{scene:"NIGHT_MARKET",integrationSessionId:capsule.sessionId,nightConditionId:capsule.nightConditionId,startingMoney:capsule.startingMoney,achievementTracking:structuredClone(capsule.achievementTracking),pendingExternalGame:null,lastConsumedResultId:null,presentation:pending?{type:"INCIDENT_MODAL",eventId:pending.eventId,pendingIncident:pending,...pending.ui}:null,presentationQueue:[],pendingIncident:pending,endReason:null});
  for(const key of Object.keys(target))delete target[key];Object.assign(target,clean);return true;
}
