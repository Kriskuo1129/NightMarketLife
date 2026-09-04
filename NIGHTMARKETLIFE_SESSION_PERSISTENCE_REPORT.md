# Phase 2 / Step 1A — NightMarketLife Run Session Persistence

## 1. Legacy 架構映射

沿用 `NML_LEGACY_INTEGRATION_HANDOFF.md` 已實際驗證的 same-origin GitHub Pages＋localStorage＋full-page redirect 模式。本輪只恢復 Platform Session：NightMarketLife 保存並恢復自己的 Run，未建立 Active Game、Result、redirect、retry 或 consume。

舊 `nightMarketLifeSession` 升級為版本化 Capsule；舊 points／remainingMinutes／startPoints／Score 均未帶回。Character Settings 繼續是長期名稱、Avatar 與 Appearance；Run Session 是目前這一晚的 Gameplay State，兩者使用不同 Key 與 API。

## 2. Session Schema

`version: 1` Capsule 白名單保存：sessionId、savedAt；player 的 name／buildId／stamina／maxStamina／money；nightConditionId、startingMoney；五項 Environment Level；Stall 的 id／life／maxLife／isClosed／isBlocked；gameActionCount／nextIncidentAt；Statistics／stallMoneyFlow／incidentHistory；Achievement id／unlocked；achievementTracking；pendingIncident 的純 Gameplay transaction；以及預留且本輪固定 null 的 pendingExternalGame／lastConsumedResultId。

不保存 DOM、Scene animation、Timer、callback、一般 Presentation Queue、Modal open state；不複製 Stall 名稱／描述／價格、Night Condition 文案或 Environment 文案。Avatar／Appearance Restore 仍取自 Character Settings。若 Reload 時有尚未 Commit 的 Incident，只保存 eventId／projected gameplay transaction，Restore 後由 Config 文案重建 Modal，不序列化 Presentation。

## 3. Storage Key

正式 Key：`nightMarketLife.session.active.v1`。未與 `nightMarketLife.characterSettings.v1` 混用。Repository 中未發現需要 Migration 或刪除的 legacy Session key。

## 4. Session API

新增 `js/session-persistence.js`，集中提供 `createSessionId()`、`buildSessionCapsule()`、`validateSessionCapsule()`、`saveSession()`、`loadSession()`、`restoreSession()`、`clearSession()`。sessionId 優先使用 `crypto.randomUUID()`；fallback 使用 timestamp 與 random bytes。每次正式 New Game 產生一次，同一 Run Restore／Gameplay 不更換。

## 5. Save Timing

正式 New Game 建立 Build／Night Condition／Stall Life 與 sessionId 後保存。進入 NIGHT_MARKET、ActivityResult 資源改變、完整 Game／Food transaction（Life／Statistics／Game Action／Money Flow）、Incident Commit、Debug 正式 Environment／Closed State 變更、Achievement 評估及玩家確認回家進 RESULT 後保存。Render、Resize、Modal open、Animation 與 Timer 不保存。

## 6. Restore Flow / Serialization

啟動只檢查 Capsule，不自動覆蓋 HOME。玩家選擇「繼續逛夜市」後才 restore：先完整 validation，再用目前 Config 與 Character Settings 建立 clean State，最後一次性替換 Runtime 的白名單可變欄位並進 NIGHT_MARKET。靜態 Stall／Condition 資料由 Config 重建；Presentation 預設清空。合法 pending Incident 則由保存的 gameplay transaction 重建單一 Blocking 通知。

## 7. Validation / Corrupt Handling

驗證 version、sessionId、ISO savedAt、合法 Build／Night Condition、finite 且非負資源、stamina 範圍、五項 Level 1～5、完整且唯一的 Stall IDs、Life／Closed／Blocked 型別、Progress 整數、Statistics 結構與 Stall key、Incident History、完整唯一 Achievement IDs／boolean unlocked、精確 Achievement Tracking fields，以及兩個 Integration reserved fields 必須為 null。

JSON parse failure、wrong version、未知 Stall、非法數值／Environment／Statistics／Achievement／reserved field 一律回傳 corrupt，不 partial restore、不 Crash。HOME 顯示「上次的夜市紀錄似乎壞掉了。」並只允許放棄清除。

## 8. HOME Continue / Abandon

合法 Active Run 顯示「今晚還沒逛完」、繼續與放棄。Fresh page 上直接按開始遊戲不會靜默覆蓋不同 sessionId 的 Active Run。Continue 恢復同一 sessionId 與 NIGHT_MARKET；Abandon 只清 Run Session，不清 Character Settings，回 HOME。

## 9. RESULT Lifecycle

主動回家仍是唯一進 RESULT 的方式。進 RESULT 後保存且不清 Run Session，因此 Money、Money Flow、Achievements 與 Statistics 仍完整。玩家下一次正式建立 New Run 才以新 sessionId 替換舊 Run；若是重新載入的 HOME，必須先明確 Continue 或 Abandon。

## 10. Integration Reserved Fields

Runtime Session 與 Capsule 均已有 `pendingExternalGame: null`、`lastConsumedResultId: null`。Step 1A 永遠不使用它們；未建立 Active Game／Result Contract，未 redirect NML_MoMaJohn，未實作 retry 或 result consume。

## 11. Tests

- `tests/session-persistence.test.mjs`：PASS。覆蓋 sessionId 唯一性、build／save／load／round trip、Player／Environment／Stalls／Closed／Blocked／Progress／Statistics／Money Flow／Achievements／Tracking、Character Settings 隔離、Presentation 不序列化、malformed／wrong version／非法欄位拒絕、non-partial restore、clear。
- `tests/session-persistence.browser.cjs`：PASS。實際 HOME→Reveal→NIGHT_MARKET→Game／Food／Closed／Blocked／Environment／Achievement→Reload→Continue；完整 State snapshot 相同且 sessionId 不變。涵蓋 Fresh HOME 防靜默覆蓋、RESULT 保留、Abandon、Corrupt UI。
- 既有 `core`、`achievements`、`night condition` 單元測試：全部 PASS。
- 既有 Achievement／RESULT、Incident、Management Office、Night Condition Browser suites：全部 PASS。

## 12. Responsive

320×844、390×844、390×900、430×932 的 HOME recovery／corrupt panel 均可見可操作、無水平 overflow。所有 Browser suites Console Error 0。

## 13. Git

本輪沒有修改 NML_MoMaJohn、Balance、Incident／Night Condition／Achievement Content、Equipment、Backend 或 transport。沒有 Commit、沒有 Push。

最終 tracked `git diff --stat`：`index.html`、`js/game.js`、`js/state.js`、`js/ui.js`、`style.css`，合計 5 files changed、52 insertions、1 deletion。另有本輪新增 `js/session-persistence.js`、兩個 session persistence tests、本報告，以及上一輪保留的 Integration Host report；參考文件 `NML_LEGACY_INTEGRATION_HANDOFF.md` 亦維持 untracked，未擅自更動或刪除。`git diff --check` 無 whitespace error，只有 Windows checkout 的 LF→CRLF 提示。
