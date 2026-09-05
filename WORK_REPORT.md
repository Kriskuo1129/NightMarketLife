# Phase 2 / Step 1B — Integration Host Foundation 工作報告

## 1. 修改檔案清單

- `js/session-persistence.js`：正式保存、驗證及恢復 `pendingExternalGame` 與 `lastConsumedResultId`。
- `js/game.js`：New Run 與 Abandon Run 清除 Integration transport keys。
- `tests/session-persistence.test.mjs`：新增 Integration Session schema、validation 與 round-trip 測試。
- `tests/core.test.mjs`：新增 New Run／Abandon cleanup 與 Character Settings 保留測試。

## 2. 新增檔案清單

- `js/integration-host.js`：Integration Contract、validation、storage、state classification 與 URL resolver 的集中模組。
- `tests/integration-host.test.mjs`：Integration Host 單元測試。
- `WORK_REPORT.md`：本報告。

## 3. Integration Host 架構

`js/integration-host.js` 是 transport foundation 的唯一責任模組，集中提供 `createActionId()`、`buildActiveGame()`、`validateActiveGame()`、Active Game save/load/clear、`validateGameResult()`、Result load/clear、`validatePendingExternalGame()`、`classifyIntegrationState()`、`resolveMiniGameUrl()` 與一次清除兩個 transport key 的 `clearIntegrationTransport()`。Gameplay 與 UI 沒有直接操作 Integration localStorage，也沒有加入 redirect、launch 或 consume。

## 4. Storage Keys

- Run Session 保留：`nightMarketLife.session.active.v1`
- Active Game：`nightMarket.integration.activeGame.v1`
- Game Result：`nightMarket.integration.gameResult.v1`
- Character Settings 保留且未修改：`nightMarketLife.characterSettings.v1`

所有 Active／Result JSON parse 與 schema failure 均以 `empty`／`valid`／`corrupt` 狀態回傳，不向 UI throw。Save 與 clear 亦回傳結果物件並攔截 Storage exception。

## 5. Active Game Schema

Version 1 完整支援 `version`、`sessionId`、`actionId`、`gameId`、`stallId`、固定 `mode: "nightMarket"`、僅含 `name` 的 `player`、`createdAt` 與 `startedAt`。Builder 不包含 Money、Stamina、Environment、Night Condition、Achievement、Statistics、Stall Life 或 Reward Multiplier。

目前實際 Stall Config 與歷史 Integration preflight 一致：只將 `game_01` 視為 `NML_MoMaJohn` 的相容攤位；`game_02`、`game_03` 仍是 Phase 1 test games。

## 6. Result Schema

Version 1 驗證 `resultId`、session/action/game/stall identity、finite `baseMoneyReward`、`completed | user_exit`、`return | retry`、non-null non-array `details` 及 ISO timestamp。Reward 合法範圍包含正數、零與負數；NaN、Infinity、-Infinity、numeric string 與 null 均拒絕。NightMarketLife 本輪不建立或 consume Result。

## 7. pendingExternalGame Schema

Session Capsule 正式允許 `null` 或 `{ actionId, gameId, stallId, staminaCost, launchedAt }`。`staminaCost` 必須是 finite number 且 `>= 0`；identity 必須是已知且相容的 game/stall，timestamp 必須為 ISO。Builder、save 與 restore 採白名單 clone，合法資料可完整 round-trip。

## 8. Validation 規則

IDs 必須是 trim 後非空字串；timestamp 必須符合含時區的 ISO date-time 且可解析；object 不接受 null 或 array。Session Capsule 中 invalid pending 或 invalid `lastConsumedResultId` 會令整份 Capsule validation 失敗，restore 不 partial apply、不 crash。`lastConsumedResultId` 只接受 null 或 non-empty string。

## 9. Integration State Classification

純函數輸出 `IDLE`、`PENDING_NO_RESULT`、`RESULT_READY`、`RESULT_ALREADY_CONSUMED`、`STALE`、`CORRUPT`。Storage parse/schema failure 與 impossible combination 分為 `CORRUPT`；合法 Contract 但 session/action/game/stall identity 不屬於目前 transaction 分為 `STALE`；ready 狀態完整 cross-match Session、Active、Pending 與 Result，並以 `lastConsumedResultId` 判斷是否已消費。此輪只分類，不執行 gameplay transaction。

## 10. URL Resolver 做法

URL 設定與 supported game metadata 同置於 Integration Host。`resolveMiniGameUrl("NML_MoMaJohn")` 回傳 `/NML_MoMaJohn/?context=nightMarket`，可同時相容 localhost root 與既有 same-origin GitHub Pages deployment；未知 game 安全回傳 null。本輪未 redirect。

## 11. New Run / Abandon Cleanup

`createNewGame()` 與 HOME 正式開始新局在確認不會覆蓋另一個待恢復 Run 後，清除 Active Game 與 Game Result；`abandonStoredSession()` 在清除 Run Session 時同步清除兩個 transport keys。兩條路徑均不清 Character Settings。Pending Mini Game Abandon 未實作。

## 12. Tests 新增內容

- actionId：50 次產生皆非空且不重複。
- Active Game：build、save/load round-trip、clear、version/ID/game/stall/mode/player/timestamp invalid cases。
- Result：正／零／負 reward、兩種 termination、兩種 nextAction、非法數值、resultId/version/details/timestamp invalid cases、load/clear/corrupt JSON。
- Session：pending null、合法 pending 與 consumed id round-trip；所有指定 invalid pending 與 consumed id 型別。
- Classification：六種 state、identity stale、malformed storage status 與 impossible combination。
- Cleanup：New Run、Abandon Run、Character Settings 隔離。
- Resolver：正式 game URL 與 unknown game。

## 13. Regression Test 結果

Node tests 全部 PASS：`achievements.test.mjs`、`core.test.mjs`、`integration-host.test.mjs`、`openings.test.mjs`、`session-persistence.test.mjs`。

Playwright + Edge headless 全部 PASS：Achievement／RESULT、Incident／Environment、Management Office、Night Condition、Session reload／Continue／Abandon／Corrupt／RESULT 與既有 responsive coverage。Session Persistence、Continue、Abandon、Corrupt Session、Achievement、Incident、Night Condition、Management Office、RESULT、Character Settings 均未退化。

## 14. Console Error

所有既有 Browser suites 回報 Console Error 0；Management Office 同時為 Console Warning 0。

## 15. 尚未實作、留給下一輪

未實作實際 Stall Launch、Stamina transaction、redirect、Result gameplay consumption、Money reward apply、Stall Life -1、Game Action +1、Incident／Achievement integration、Recovery/Pending Abandon/Retry UI、End-to-End integration，也未修改 `NML_MoMaJohn`。沒有 Backend、iframe、postMessage 或 Practice Mode。

## 16. Repository 衝突與最小相容處理

需求中的 `pendingExternalGame.launchedAt` 與舊 preflight 文件草案的 `startedAt` 不同；本輪以最新需求的正式 `launchedAt` 為準。舊報告曾提出其他 storage key 與 `nextAction: leave`，但目前需求明定新 keys 與 `return`，實作依目前需求，未修改歷史報告。

目前只有一個 supported external game 與一個 compatible stall，因此 game/stall mismatch 的合法多遊戲情境要等未來增加第二個 supported mapping 才能自然形成；classifier 已逐欄 cross-match，unknown schema 仍依規格歸 `CORRUPT`，不把未知 game/stall 誤報成合法 stale transaction。

## 17. Git Diff 摘要

Tracked diff（建立報告前）為 4 files changed、16 insertions、7 deletions；另新增 `js/integration-host.js`、`tests/integration-host.test.mjs` 與本報告。`git diff --check` 無 whitespace error，只有 Git 對 Windows checkout 的 LF→CRLF 提示。沒有 Commit、沒有 Push。

---

# Phase 2 / Step 1B 第二輪 — Launch / Mock Result Consumption

## 1–2. 修改與新增檔案

第二輪修改 `js/game.js`、`js/integration-host.js`、`WORK_REPORT.md`，新增 `tests/integration-transactions.test.mjs`。第一輪尚未提交的 Session、cleanup 與 Foundation tests 繼續保留；沒有修改 `NML_MoMaJohn`、HTML、CSS 或其他 Gameplay 模組。

## 3–8. Launch Transaction

`launchExternalGame()` 位於既有 Gameplay coordinator `js/game.js`，依序驗證 supported mapping、interaction lock、Closed／Blocked／Life、pending、Active／Result transport、effective stamina 與 sessionId；全部通過後才建立 actionId。它直接重用 `events.js` 的 `getEffectiveGameStaminaCost()`，沒有複製 Crowd／Temperature 公式。

成功順序為：扣除 stamina → 建立 `{ actionId, gameId, stallId, staminaCost, launchedAt }` → `saveSession()` → 使用第一輪 builder 建立 Active Game → `saveActiveGame()` → 回傳 `launch_ready`、identity、cost 與 URL。Active Contract 仍只含 `player.name`，未加入平台狀態，且沒有 redirect。

Session save 失敗會恢復 Runtime stamina／原 pending 並確保沒有 Active。Active save 失敗會恢復 Runtime、再次保存 rollback Session、再清 Active。若 rollback Session 本身失敗，回傳 `rollback_save_failed`，不假裝成功；Runtime 保持 rollback 後狀態，但 durable Session 可能仍是已扣 stamina＋pending 的版本，transport Active 仍嘗試清除。未來 Recovery UI 必須把這個狀態視為需恢復的 pending transaction，不能猜測或退款。

## 9. Mock Result

Result producer 只存在 `tests/integration-transactions.test.mjs` 的 fixture helper。Production 沒有 fake-result API，也不寫 Result；測試直接將符合正式 Contract 的 JSON 放入 Result storage key，模擬小遊戲回傳。

## 10–17. Result Consumption 與 Phase 1 接線

`consumeExternalGameResult()` 先 load Active／Result，再呼叫第一輪 `classifyIntegrationState()`；只有 `RESULT_READY` 進入交易。Reward 重用 `applyRewardModifier()`，因此正 reward 依既有 Reward Level multiplier 並 `Math.round`，零與負 reward 不放大。Money 更新重用 `projectResources()`，保留 Phase 1 的 Money 最低 0 clamp。

Phase 1 留下的 `handleExternalGameResult(result)` 原本會直接把 caller data 送進 `applyActivityResult()`，可繞過 Contract 與 exactly-once。第二輪保留相容函數名稱，但移除直接套用參數的旁路，統一轉入正式 storage/classification Consume transaction。

`stallMoneyFlow` 記錄 Phase 1 定義的「實際套用後 money delta」；通常等於 Platform-modified reward，但負 reward 遇到 Money 0 clamp 時只記真正扣除額。Statistics 僅更新既有 `totalActions`、`gamePlays[game_01]`、`stallVisits[game_01]`、`stallMoneyFlow[game_01]`，沒有新增 schema。

Stall Life 使用既有 `consumeStallLife()`，包含 Life 0 自動 Closed；`completed` 與 `user_exit` 都扣 Life 1、增加既有 `gameActionCount` 1。之後呼叫既有 `checkIncident()`，若觸發則沿用既有 pending Incident 與 presentation；Achievement 使用既有 `evaluateAchievements()`。沒有 Integration 專用 progression、Incident 或 Achievement。

## 18–23. Exactly-once、Cleanup 與錯誤狀態

成功交易的 durable 邊界是：完整 Gameplay apply → `lastConsumedResultId = resultId` → `pendingExternalGame = null` → 單次 `saveSession()`。只有保存成功才依序 clear Result、clear Active。API 回傳 `actualMoneyReward`、實際套用額、termination、nextAction 與 transport cleanup 結果；`retry` 僅原樣回傳，不 launch。

Consume 使用交易前 `structuredClone(gameState)` 作完整 Runtime snapshot。若 Session save 失敗，一次性原地恢復整份 State，涵蓋 Money、Statistics、Money Flow、Stall、Progress、Incident、Achievement、lastConsumedResultId、pending 與 presentation；Active／Result 保留，回傳 `session_save_failed / consume_rolled_back`。

第一輪 classifier 做了一個必要的最小修正：durable Session 已記錄 consumed 且 pending 已清、但 Active／Result 尚未 cleanup 的 crash window，現在在完整 Session/Active/Result identity match 後正確分類為 `RESULT_ALREADY_CONSUMED`。此狀態只清 transport、不再套 Gameplay。不同 session/action 的合法 contract 回傳 `STALE`；unknown/invalid schema、malformed JSON 或 impossible combination 回傳 `CORRUPT`，兩者都不更動 Gameplay、不猜測或清除不明資料。

## 24. 第二輪 Tests

新增測試涵蓋：正常 launch identity／player name／effective cost／durable pending／Active；insufficient stamina、Closed、Blocked、Life 0、existing pending、unresolved transport、unsupported stall；Session save rollback、Active save rollback 與 rollback-save 極端失敗。

Consume 覆蓋 completed/user_exit × positive/zero/negative reward、Reward Level 1/3/5、Money clamp 與 Money Flow、Statistics、Life、Game Action、Incident、Achievement、retry return、Session round-trip。Exactly-once 覆蓋首次 consume、cleanup crash window、`RESULT_ALREADY_CONSUMED` cleanup-only、duplicate result；另涵蓋 session/action mismatch、invalid game/stall、corrupt Result/Active，以及 save failure 時包含 Incident/Achievement 的完整 Runtime rollback。

## 25–26. Regression 與 Console

Node：`achievements`、`core`、`integration-host`、`integration-transactions`、`openings`、`session-persistence` 全部 PASS。

Playwright + Edge headless：Achievement／RESULT、Incident／Environment、Management Office、Night Condition、Session reload／Continue／Abandon／Corrupt／RESULT 全部 PASS。既有 responsive coverage PASS；Console Error 0，Management Office Console Warning 0。

## 27. 尚未實作

沒有真正 redirect、沒有修改 `NML_MoMaJohn`、沒有 Pending/Back Recovery UI、Pending Abandon UI、Retry eligibility/launch、跨 Repository E2E、Backend、iframe、postMessage、Practice Mode、新 Balance、新 Incident 或新 Achievement。

## 28. Git Diff 摘要

第二輪完成後以最終 `git status`／`git diff --stat`／`git diff --check` 為準。新增檔案不會出現在普通 `git diff --stat`；沒有 Commit、沒有 Push。

---

# Phase 2 / Step 1B 第三輪 — Recovery / Pending Abandon / Retry

## 1–5. 修改檔案、Recovery 架構與 UI

修改 `js/game.js`、`js/integration-host.js`、`index.html`、`style.css`、兩個 Integration unit tests 與本報告；新增 `tests/integration-recovery.browser.cjs`。Recovery 入口 `checkIntegrationRecovery()` 在 Continue restore 與 browser `pageshow` 後 load Active/Result、呼叫既有 classifier，再分流 IDLE、Pending、Incomplete、Ready、Already Consumed、Stale/Corrupt。HOME preview 不修改 Gameplay；只有 Continue restore 後處理。

新增單一 `integration-recovery-dialog`，沿用既有 `dialog-card`、按鈕與 modal CSS。UI open state 不保存，Reload 後完全由 durable Integration State 重建。`PENDING_NO_RESULT` 顯示「回到遊戲／放棄這次遊戲」blocking modal。

## 6–8. Resume 與 Pending Abandon

`resumePendingExternalGame()` 重新驗證完整 Pending/Active identity，只以既有 gameId resolver 導向原 URL；不扣 stamina、不建立 actionId、不重建 pending/Active。`abandonPendingExternalGame()` 只將 pending 清空並先 `saveSession()`，成功後才清 Result/Active；不退款、不改 Money/Life/Action/Statistics/Incident/Achievement。Save failure 會恢復 Runtime pending 並保留 transport，回傳 `session_save_failed`。

## 9–11. Incomplete Launch

Classifier 最小新增 `INCOMPLETE_LAUNCH`，只匹配 valid pending＋Active missing＋Result missing；malformed/unknown 或 Result 存在仍不是此狀態。`recoverIncompleteLaunch()` 使用 Phase 1 `projectResources()` 恢復 `staminaCost`（不超過 maxStamina），同時清 pending，再以一次 Session save 建立 exactly-once durable 邊界。Save 成功才清 transport並顯示「已恢復體力」；失敗完整 rollback stamina/pending，不顯示成功、不清資料。Reload 後 pending 已 null，因此不會二次退款。

## 12–15. Stale/Corrupt、Back、Continue 與 Redirect

一般 STALE/CORRUPT 不套 Gameplay、不退款，顯示最小安全清理 UI；只有使用者按清理才清 transport。正式 `game_01` Stall UI 現在呼叫既有 `launchExternalGame()`，只有 transaction 完整成功才由 `navigateToMiniGame()` redirect。Navigation failure 不退款，因 durable 狀態可由 Pending Recovery 處理。

Browser Back 若頁面被重新載入，先維持 Phase 1 HOME recovery；玩家按 Continue 後 restore 同一 Session，再顯示 Pending modal。若瀏覽器保留 NIGHT_MARKET page，`pageshow` 直接重建 recovery。兩條路徑都不重扣 stamina。

## 16–20. Retry 與 Presentation

Consume 回傳 `nextAction: retry` 後才建立 transient retry decision；舊 Result 已完整 durable consume 且 transport cleanup。若有既有 blocking Incident，先完成 Incident presentation，才顯示 Retry modal。玩家確認後直接重用 `launchExternalGame()`，因此重新讀取最新 Stall/Environment、重新計算 effective stamina、重新驗證 Closed/Blocked/Life/pending/transport，維持同 sessionId、產生新 actionId並再次扣 stamina。失敗留在 NIGHT_MARKET 並顯示原因，不扣資源。`return` 不建立 retry prompt，留在夜市。

Achievement 沿用既有 evaluation；專案目前沒有獨立 Achievement modal queue，因此沒有額外跳過或新增 presentation。Retry intent 不寫 Session；Mini Game 不會自行重開。

## 21–23. Tests 與 Responsive

Unit tests 新增 Pending resume identity/stamina unchanged、Abandon invariants/save rollback、Incomplete classification/refund once/save rollback，以及 Retry same-session/new-action/new-stamina transaction。第二輪的 Result ready/already-consumed/save rollback/identity tests持續通過。

新增 browser suite 使用 route fixture 只模擬目的頁，不產生 Result、不修改小遊戲：正式 Stall click → redirect → Browser Back → Continue/Recovery、Resume same action 不重扣、再次 Back、Pending Abandon不退款。320×844、390×844、390×900、430×932 均驗證 dialog 位於 viewport、按鈕可操作、無 horizontal overflow。

## 24–25. Regression 與 Console

全部 Node suites PASS：Achievement、Core、Integration Foundation、Integration Transaction、Night Condition、Session Persistence。全部 Browser suites PASS：Achievement/RESULT、Incident/Environment、Integration Recovery/Back、Management Office、Night Condition、Session Continue/Abandon/Corrupt/RESULT。Console Error 0；Management Office Console Warning 0。另以 Codex 內建瀏覽器實際確認正式 Stall redirect 與 Browser Back → HOME Continue → Pending Recovery modal。

## 26. 尚未實作

未修改 `NML_MoMaJohn`，未建立 Mini Game Result Producer、真正跨 Repository E2E、Standalone/Practice Mode、Backend、iframe、postMessage、新 Balance、新 Incident 或新 Achievement。

## 27. Git Diff 摘要

最終狀態含前三輪未提交變更；沒有 Commit、沒有 Push。普通 `git diff --stat` 不包含新增的 Integration Host、三份新增 tests 與本報告，完整清單以 `git status --short` 為準。

## Review Edge Case 修正：STALE / CORRUPT Cleanup

Review 發現舊按鈕 handler 會先清 Active/Result、再直接把 Runtime pending 設 null；若 Session save 失敗或根本未建立 durable cleanup，可能留下 persisted valid pending＋missing transport，下一次被誤判為原生 `INCOMPLETE_LAUNCH` 並退款。

已新增集中 `clearInvalidIntegrationTransaction()`：先確認目前確實為 STALE/CORRUPT；若 Session 有 pending，先保存 Runtime snapshot、將 pending 設 null並 `saveSession()`，只有成功後才清 Result/Active。這代表放棄無法安全辨識的 external transaction，進場 stamina 不退，Money、Life、Action、Statistics、Incident、Achievement 均不變。若沒有 pending，直接安全清 transport，不寫 Gameplay。

Save failure 會恢復原 pending、保留 Active/Result並回傳 `session_save_failed / invalid_cleanup_rolled_back`，UI 不會關閉或回報成功。原生 valid pending＋Active missing＋Result missing 的 classifier 與 `recoverIncompleteLaunch()` 未改動，仍只退款一次。

新增 unit coverage：pending＋stale Active cleanup 後為 IDLE而非 INCOMPLETE、pending＋corrupt Active/Result不退款、cleanup save failure rollback且 transport 原樣保留、原生 incomplete refund exactly-once 回歸。全部 Node 與 Browser suites重新執行並 PASS；Integration Recovery Browser responsive 與 Browser Back PASS；Console Error 0，Management Office Console Warning 0。
