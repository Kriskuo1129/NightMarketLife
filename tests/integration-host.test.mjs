import assert from "node:assert/strict";

const storage = { values: new Map(), getItem(key) { return this.values.get(key) ?? null; }, setItem(key, value) { this.values.set(key, value); }, removeItem(key) { this.values.delete(key); } };
globalThis.localStorage = storage;
const host = await import("../js/integration-host.js");

const now = () => new Date("2026-09-05T01:02:03.000Z");
const actionIds = new Set(Array.from({ length: 50 }, () => host.createActionId()));
assert.equal(actionIds.size, 50);
assert.ok([...actionIds].every(id => typeof id === "string" && id.length > 0));

const active = host.buildActiveGame({ sessionId: "session-123", actionId: "action-123", gameId: "NML_MoMaJohn", stallId: "game_01", playerName: "阿夜" }, now);
assert.deepEqual(active.player, { name: "阿夜" }); assert.ok(host.validateActiveGame(active));
assert.equal(host.saveActiveGame(active, storage).ok, true); assert.deepEqual(host.loadActiveGame(storage), { status: "valid", value: active });
host.clearActiveGame(storage); assert.equal(host.loadActiveGame(storage).status, "empty");
for (const mutate of [value => value.version = 2, value => value.sessionId = "", value => value.actionId = "", value => value.gameId = "unknown", value => value.stallId = "game_02", value => value.mode = "practice", value => value.player = null, value => value.createdAt = "bad", value => value.startedAt = "2026-09-05"]) { const value = structuredClone(active); mutate(value); assert.equal(host.validateActiveGame(value), false); }

const result = { version: 1, resultId: "result-123", sessionId: active.sessionId, actionId: active.actionId, gameId: active.gameId, stallId: active.stallId, baseMoneyReward: 100, termination: "completed", nextAction: "return", details: {}, createdAt: now().toISOString() };
for (const reward of [100, 0, -100]) assert.ok(host.validateGameResult({ ...result, baseMoneyReward: reward }));
for (const termination of ["completed", "user_exit"]) assert.ok(host.validateGameResult({ ...result, termination }));
for (const nextAction of ["return", "retry"]) assert.ok(host.validateGameResult({ ...result, nextAction }));
for (const reward of [NaN, Infinity, -Infinity, "100", null]) assert.equal(host.validateGameResult({ ...result, baseMoneyReward: reward }), false);
for (const mutate of [value => value.resultId = "", value => value.version = 9, value => value.details = [], value => value.details = null, value => value.createdAt = "yesterday"]) { const value = structuredClone(result); mutate(value); assert.equal(host.validateGameResult(value), false); }
storage.setItem(host.GAME_RESULT_KEY, JSON.stringify(result)); assert.deepEqual(host.loadGameResult(storage), { status: "valid", value: result });
storage.setItem(host.GAME_RESULT_KEY, "{"); assert.equal(host.loadGameResult(storage).status, "corrupt"); host.clearGameResult(storage); assert.equal(host.loadGameResult(storage).status, "empty");

const pending = { actionId: active.actionId, gameId: active.gameId, stallId: active.stallId, staminaCost: 10, launchedAt: now().toISOString() };
const session = { sessionId: active.sessionId, pendingExternalGame: pending, lastConsumedResultId: null };
const classify = values => host.classifyIntegrationState({ session, pendingExternalGame: pending, activeGame: active, gameResult: result, ...values });
assert.equal(host.classifyIntegrationState({ session: { sessionId: active.sessionId, pendingExternalGame: null, lastConsumedResultId: null } }), "IDLE");
assert.equal(classify({ gameResult: null }), "PENDING_NO_RESULT"); assert.equal(classify({}), "RESULT_READY");
assert.equal(classify({ lastConsumedResultId: result.resultId }), "RESULT_ALREADY_CONSUMED");
for (const [field, value] of [["sessionId", "old-session"], ["actionId", "old-action"], ["gameId", "NML_MoMaJohn"], ["stallId", "game_01"]]) { const stale = structuredClone(result); if (field === "gameId") stale.actionId = "old-action"; else if (field === "stallId") stale.actionId = "old-action"; else stale[field] = value; assert.equal(classify({ gameResult: stale }), "STALE"); }
assert.equal(classify({ activeStatus: "corrupt" }), "CORRUPT"); assert.equal(classify({ resultStatus: "corrupt" }), "CORRUPT");
assert.equal(host.classifyIntegrationState({ session, pendingExternalGame: null, activeGame: active, gameResult: null }), "CORRUPT");
assert.equal(host.classifyIntegrationState({ session, activeGame: null, gameResult: null }), "INCOMPLETE_LAUNCH");
assert.equal(host.resolveMiniGameUrl("NML_MoMaJohn"), "/NML_MoMaJohn/?context=nightMarket"); assert.equal(host.resolveMiniGameUrl("unknown"), null);
console.log("NightMarketLife integration host tests: PASS");
