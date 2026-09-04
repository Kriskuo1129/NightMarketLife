import assert from "node:assert/strict";
import {NIGHT_CONDITION_CONFIG,pickNightCondition,applyNightCondition,getNightConditionById} from "../js/openings.js";
import {createEnvironment} from "../js/events.js";
assert.equal(NIGHT_CONDITION_CONFIG.length,6);assert.equal(NIGHT_CONDITION_CONFIG.reduce((n,c)=>n+c.weight,0),100);
let edge=0;for(const condition of NIGHT_CONDITION_CONFIG){assert.equal(pickNightCondition(()=>edge/100).id,condition.id);edge+=condition.weight;assert.equal(getNightConditionById(condition.id),condition);const env=createEnvironment();applyNightCondition(env,condition);assert.deepEqual(Object.values(env),condition.levels);assert.ok(Object.values(env).every(level=>level>=1&&level<=5));}
assert.equal(pickNightCondition(()=>1).id,"BUSY_MARKET");
console.log("Step 8.1 night condition tests: PASS");
