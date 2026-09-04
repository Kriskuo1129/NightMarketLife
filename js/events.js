import { CONFIG } from "./config.js";
export const ENVIRONMENT_KEYS=Object.freeze(["crowdLevel","priceLevel","rewardLevel","temperatureLevel","businessLevel"]);
export const clampEnvironmentLevel=value=>Math.min(5,Math.max(1,Number(value)));
export function createEnvironment(){return Object.fromEntries(ENVIRONMENT_KEYS.map(key=>[key,CONFIG.defaults[key]]));}
export const createActiveEvents=()=>[];
export function getNextIncidentInterval(randomFn=Math.random){const {min,max}=CONFIG.incidentInterval;return min+Math.min(max-min,Math.floor(Math.max(0,Math.min(1,randomFn()))*(max-min+1)));}
export const getNextEventInterval=getNextIncidentInterval;
const RULES=Object.freeze({CROWD:"crowdLevel",PRICE:"priceLevel",REWARD:"rewardLevel",TEMPERATURE:"temperatureLevel",BUSINESS:"businessLevel"});
export const INCIDENT_MESSAGES=Object.freeze({
  CROWD_UP:["人潮又湧進來了！","入口突然來了一大群人，走道一下子熱鬧起來。"],CROWD_DOWN:["人潮稍微散了","大家陸續離開，走起路來輕鬆多了。"],
  PRICE_UP:["老闆們換了價目表","幾個攤位悄悄把今晚的價格往上調了。"],PRICE_DOWN:["大家開始殺價","一陣討價還價後，今晚的價格親切了一點。"],
  REWARD_UP:["遊戲攤開始加碼","歡呼聲此起彼落，老闆們也拿出更多獎金。"],REWARD_DOWN:["遊戲攤收緊獎勵","老闆們突然變得謹慎，獎金沒有剛才大方了。"],
  TEMPERATURE_UP:["夜市越來越熱","人群和爐火讓空氣又升溫了一些。"],TEMPERATURE_DOWN:["晚風變涼了","一陣風吹過來，夜市裡舒服涼快不少。"],
  BUSINESS_UP:["今晚生意興隆","攤商補足貨物，準備多接待幾輪客人。"],BUSINESS_DOWN:["有些攤位快賣完了","今晚買氣太旺，攤商手上的存貨開始吃緊。"]
});
export function getEligibleIncidents(environment){const pool=[];for(const [prefix,key] of Object.entries(RULES)){if(environment[key]<5)pool.push(`${prefix}_UP`);if(environment[key]>1)pool.push(`${prefix}_DOWN`);}return pool;}
export const getEligibleEnvironmentEvents=getEligibleIncidents;
const pick=(items,randomFn)=>items[Math.min(items.length-1,Math.floor(Math.max(0,Math.min(1,randomFn()))*items.length))]??null;
export const pickIncident=(state,randomFn=Math.random)=>pick(getEligibleIncidents(state.environment),randomFn);
export const pickEnvironmentEvent=pickIncident;
export function getIncidentUI(incident){const [title,description]=INCIDENT_MESSAGES[incident.eventId]??["夜市有了新變化","今晚的氣氛悄悄改變了。"];const prefix=incident.eventId.split("_")[0];const natural={CROWD:"逛起來的人潮不同了。",PRICE:"攤位價格跟著改變。",REWARD:"遊戲攤的獎金跟著改變。",TEMPERATURE:"體感溫度有了變化。",BUSINESS:"攤商今晚能接待的客人數有了變化。"};return{title,description,effectLines:[natural[prefix]]};}
export const getEnvironmentEventUI=getIncidentUI;
export function prepareIncident(state,eventId){if(state.session.pendingIncident)return state.session.pendingIncident;if(!getEligibleIncidents(state.environment).includes(eventId))return null;const [prefix,direction]=eventId.split("_");const key=RULES[prefix],before=state.environment[key],after=clampEnvironmentLevel(before+(direction==="UP"?1:-1));const incident={eventId,gameActionCount:state.progress.gameActionCount,details:{key,before,after},projected:{[key]:after}};incident.ui=getIncidentUI(incident);state.session.pendingIncident=incident;return incident;}
export const prepareEnvironmentEvent=prepareIncident;
export function commitPendingIncident(state,expected=state.session.pendingIncident,randomFn=Math.random){if(!expected||expected!==state.session.pendingIncident)return null;Object.assign(state.environment,expected.projected);state.statistics.incidentHistory.push({eventId:expected.eventId,gameActionCount:expected.gameActionCount,details:{...expected.details}});state.progress.nextIncidentAt=state.progress.gameActionCount+getNextIncidentInterval(randomFn);state.session.pendingIncident=null;return expected;}
export const commitPendingEnvironmentEvent=commitPendingIncident;
export function triggerIncident(state,randomFn=Math.random){return prepareIncident(state,pickIncident(state,randomFn));}
export const triggerEnvironmentEvent=triggerIncident;
export const checkIncident=(state,randomFn=Math.random)=>state.progress.gameActionCount>=state.progress.nextIncidentAt?triggerIncident(state,randomFn):null;
export const checkEnvironmentEvent=checkIncident;
export function getEffectiveGameStaminaCost(stall,environment){if(stall.type!=="GAME")return stall.staminaCost;return Math.max(0,stall.staminaCost+(CONFIG.crowdStaminaModifiers[environment.crowdLevel]??0)+(CONFIG.temperatureStaminaModifiers[environment.temperatureLevel]??0));}
export const getEffectiveFoodPrice=(stall,environment)=>Math.round(stall.price*(CONFIG.priceMultipliers[environment.priceLevel]??1));
export function getTemperatureFoodBonus(type,level){if(type==="HOT")return level===1?10:level===2?5:0;if(type==="COLD")return level===5?10:level===4?5:0;return 0;}
export function applyRewardModifier(result,environment){const adjusted={...result};if(adjusted.moneyDelta>0)adjusted.moneyDelta=Math.round(adjusted.moneyDelta*(CONFIG.rewardMultipliers[environment.rewardLevel]??1));return adjusted;}
