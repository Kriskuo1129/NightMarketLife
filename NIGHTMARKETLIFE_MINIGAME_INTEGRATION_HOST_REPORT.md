# NightMarketLife Mini Game Integration Host v1 — Preflight Report

## 結論 / Blocker

Phase 2 / Step 1 在「整頁 redirect 後安全恢復同一局」這個前置條件上被阻擋，因此本輪依規格第八、十七節停在設計與報告，沒有建立會把結果套到錯誤新局的半成品 Host。

目前 `gameState` 是 `js/state.js` 內的記憶體單例。唯一正式持久化資料是 `nightMarketLife.characterSettings.v1`，且白名單只有名稱、Avatar、Build 與 Legacy 外觀。Repository 沒有單局 Session save／restore、pagehide／beforeunload checkpoint，亦沒有舊 `nightMarketActiveGame`／`nightMarketGameResult` Runtime。

離開 NightMarketLife 整頁後再返回，Runtime 會從 HOME 的全新預設 State 啟動。只保存 Active Game Contract 無法還原原局的 Player Resources、Night Condition、Environment、Stall Life、Progress、Statistics、Achievements 或 Money Ledger；在此狀態消費 Result 會造成錯局加錢、錯誤 Life／Incident，以及 exactly-once guard 無法和原局一致。直接把整個 GameState 塞進 LocalStorage 又違反本輪明確限制。

## 1. Integration Contract v1（設計）

`CONTRACT_VERSION = 1`。建議後續新增獨立 `js/minigame-integration.js`，只負責 schema、validation、storage、entry／completion transaction；UI handler 不直接存取 Storage。

## 2. Active Game Schema

```js
{
  version: 1,
  sessionId,
  actionId,
  gameId,
  stallId,
  player: { name },
  mode: "nightMarket",
  createdAt,
  startedAt
}
```

不得傳入 money、stamina、rewardLevel、Environment 或 Stall Life。Host 自己需要的 pending transaction 應放在平台的可恢復 Session Capsule，不暴露給小遊戲。

## 3. Result Schema

```js
{
  version: 1,
  resultId,
  sessionId,
  actionId,
  gameId,
  stallId,
  baseMoneyReward,
  termination, // completed | user_exit
  nextAction,  // leave | retry
  details,     // optional plain JSON object
  createdAt
}
```

驗證需涵蓋所有識別欄位、finite `baseMoneyReward`、允許的 termination／nextAction、可解析 createdAt，以及 details 為 plain JSON object。任何 malformed／mismatch 都不可套用或 Crash。

## 4. sessionId / actionId 生命周期

- 每次正式 New Game 產生新的 `sessionId`，HOME Reset 後失效。
- 每次玩家確認正式進場產生新的 `actionId`。
- Retry 必須回平台重新驗證，再由玩家確認並產生不同 actionId。
- 優先使用 `crypto.randomUUID()`；fallback 應結合 timestamp、crypto random bytes（可用時）及單頁 counter，避免僅用 `Math.random()`。

## 5. Storage Keys

- `nightMarketLife.minigame.active.v1`
- `nightMarketLife.minigame.result.v1`
- 建議新增、但須另行確認範圍的單局 Capsule：`nightMarketLife.session.active.v1`
- 建議 exactly-once guard 納入 Capsule，或獨立 `nightMarketLife.minigame.consumed.v1`（至少包含 sessionId、resultId）。

沒有發現舊 `nightMarketActiveGame` 或 `nightMarketGameResult`，因此無 legacy key 需要刪除或 Migration。

## 6. game_01 Config

```js
{
  game_01: {
    gameId: "NML_MoMaJohn",
    path: "/NML_MoMaJohn/",
    integrationEnabled: true
  }
}
```

URL 應集中於 Config。game_02／game_03 維持 Test Game。本輪沒有修改 NML_MoMaJohn。

## 7. Entry 流程（待 Persistence 前置完成後實作）

OPEN／Interaction Lock／有效 Life → effective stamina cost → stamina 足夠 → 新 actionId → 先持久化可恢復 Session Capsule → 透過正式 ActivityResult 只扣一次 Stamina → 保存 pending external transaction 與 Active Contract → redirect。

寫入順序必須能處理 Storage 寫入失敗：在確認 Capsule 與 Active Contract 可恢復以前不可 redirect；不可出現已扣體力但 transaction 未落盤的狀態。

## 8. Completion 流程

回平台後先 restore Capsule，再 load／validate Result，match active sessionId、actionId、gameId、stallId，並檢查 resultId 未消費。

`completed`：baseMoneyReward 經既有 Reward modifier（只放大正數）→ 走正式 ActivityResult／applied delta → stallMoneyFlow → Stall Life -1 → gameActionCount +1 → Statistics → Incident prepare／presentation。完成正式 State transaction 後才記錄 consumed resultId，清 Result 與 Active，最後 Render。

## 9. user_exit 規則

Phase 2 Temporary Integration Rule：已扣 Entry Stamina 不退；不給 Money、不扣 Stall Life、不增加 Game Action、不推 Incident。此分支集中在 Integration completion logic。

## 10. retry 規則

Result 的 `nextAction: "retry"` 只讓平台顯示「再玩一次／先回夜市」。不得自動 redirect。玩家再次確認時重新檢查 Stall、Stamina、Life、Lock，建立全新 actionId 並重新扣 Entry Stamina。

## 11. Exactly-once

正確保證不能只依賴模組記憶體。Consume transaction 至少需要 durable `{ sessionId, lastConsumedResultId }`，且順序要避免「已加錢但 consumed guard 尚未保存」的 reload window。LocalStorage 沒有跨 key 原子交易，因此建議將 restored run state、pending action 與 consumed guard 合併在同一版本化 Session Capsule，以單次 JSON replacement 更新；Active／Result key 再作 transport envelope。

## 12. Reload / Back

Active 存在、Result 不存在時，平台應先成功 restore 同一 Capsule，才顯示「上一場遊戲似乎還沒結束。」並提供「繼續前往遊戲／放棄這次遊戲並回夜市」。放棄不退款、不扣 Life、不增加 Game Action，並以一次 Capsule 更新清除 pending action，再清 Active key。若 Capsule 缺失或不合法，必須顯示不可恢復錯誤並拒絕套用任何 Result。

## 13. State Persistence 分析 / 最小 Session Capsule

為保持回傳後行為與離站前完全一致，最小可恢復資料不是整個 DOM／Presentation State，但仍包含下列正式 Gameplay 子集：

```js
{
  version: 1,
  sessionId,
  savedAt,
  player: { name, buildId, stamina, maxStamina, money, profile, appearance },
  nightConditionId,
  startingMoney,
  environment: { crowdLevel, priceLevel, rewardLevel, temperatureLevel, businessLevel },
  stalls: [{ id, life, maxLife, isClosed, isBlocked }],
  progress: { gameActionCount, nextIncidentAt },
  statistics: { totalActions, foodPurchases, gamePlays, stallVisits, stallMoneyFlow, incidentHistory },
  achievements: [{ id, unlocked }],
  achievementTracking,
  pendingExternalGame: { actionId, gameId, stallId, staminaCost, startedAt },
  lastConsumedResultId
}
```

Config-derived名稱、描述、價格、類型與 UI DOM 不需保存，可由 ID 重建。Presentation Queue、Dialog open state 與 Timer 不應跨 redirect 保存；回復後由 pending transaction／Result 決定正式畫面。

這個 Capsule 涵蓋幾乎所有可變的單局 Gameplay State，需要版本驗證、schema validation、atomic replacement、corrupt／stale recovery、New Game／HOME cleanup、Storage quota failure，以及與 Character Settings 分離的測試。這是獨立且顯著的 Session Persistence 工作，不應在本輪未獲確認時偷偷加入。

可替代方案是改用同頁 iframe／受控 popup，避免主頁 Runtime 卸載；但這會改變既定「整頁 redirect」產品流程，也需要另行決策。

## 14. Tests

因前置 Persistence 未獲實作授權，本輪沒有建立虛假的 Integration Runtime，因此規格所列25項 Integration Tests 尚未執行。後續應先為 Session Capsule 補：round-trip、schema/version、corrupt/stale、quota failure、HOME/New Game cleanup、跨 reload identity；再完成 Active／Result、matching、completed／user_exit／retry、exactly-once、game_02／03 regression 與無 Score 測試。

## 15. Responsive / Browser

本輪沒有新增 Integration UI，故沒有新的 Responsive／Browser 驗收項目可測。完成 Persistence 與 Host 後，需在 320×844、390×844、390×900、430×932 驗證 recovery、invalid-result、completed、user_exit、retry UI，並確認無水平 overflow、Console Error 0。

## 16. Git Status

建立本報告前 Working Tree 為 clean，HEAD `1c069e2 feat: refactor core environment and incident rules`，Branch `main`。本輪預期只有本報告為 untracked；不 Commit、不 Push。

## 17. Git Diff Stat

本報告是唯一變更。由於是新 untracked 文件，普通 `git diff --stat` 不會列出；`git status --short` 應顯示 `?? NIGHTMARKETLIFE_MINIGAME_INTEGRATION_HOST_REPORT.md`。
