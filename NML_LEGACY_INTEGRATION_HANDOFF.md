# NML_LEGACY_INTEGRATION_HANDOFF.md

> 文件用途：保存舊版 `NightMarketLife ↔ NML_MoMaJohn` **曾經實際完成並驗證成功的跨 Repository / GitHub Pages 串接技術**，供新版 NightMarketLife 與 Codex 重新實作時參考。
>
> 本文件 **不是新版遊戲規格**。凡出現舊版資源欄位、時間欄位、入場費、局數或結算數值，均只代表歷史 Runtime。
>
> **Legacy Example，僅用於說明當時資料流，不代表新版規格。**

---

## 0. 歷史實作結論

舊版最終真正跑通的整合方案不是 iframe / postMessage，而是：

**Same-Origin GitHub Pages + localStorage + 整頁 redirect**

核心模式為：

```text
NightMarketLife
    ↓
Platform 先保存自己的 Session
    ↓
建立 nightMarketActiveGame
    ↓
redirect 到 NML_MoMaJohn/?context=nightMarket
    ↓
NML_MoMaJohn 驗證 Active Game
    ↓
遊戲正常完成或主動離場
    ↓
建立 nightMarketGameResult
    ↓
redirect 回 NightMarketLife
    ↓
Platform reload 後恢復自己的 Session
    ↓
驗證 Active Game + Game Result
    ↓
Platform 套用 Result
    ↓
保存 Session
    ↓
刪除 Result + Active Game
```

當時曾在早期技術分析階段提出 iframe / `window.postMessage`、ACK、resultId 等較完整協定設計，但那不是最後已驗證的 Runtime。真正完成的版本採上述 localStorage + redirect。

---

# 一、當時採用的整體架構

## 1. Platform 準備進入小遊戲

NightMarketLife 是全局狀態的擁有者。玩家由 Platform 進入 `NML_MoMaJohn` 前，Platform 先完成自己應處理的主程式動作，然後把 Platform Session 存進 localStorage。

舊版 Runtime 的重要責任邊界是：

```text
Platform：
- 擁有並修改 Platform Session
- 準備進場資料
- 建立 Active Game
- 接收 Result
- 最終套用 Result

Mini Game：
- 不直接修改 Platform Session
- 只驗證自己是否由合法 Night Market 流程進入
- 執行自己的遊戲
- 最後產生 Result
```

## 2. redirect 前保存 Platform Session

Platform 在跳轉至小遊戲前，先呼叫自己的 Session 保存流程。

歷史版本中，Platform Session 放在：

```text
nightMarketLifeSession
```

因此整頁離開 NightMarketLife 後，主程式 JavaScript 雖然全部被卸載，但資料仍存在瀏覽器 localStorage。

這是整套跨頁串接能成立的關鍵。

## 3. 建立 Active Game

Platform 在 redirect 前建立：

```text
nightMarketActiveGame
```

它不是 Platform Session 的副本，而是一張「目前有一個合法小遊戲遊程正在進行」的通行證／關聯資料。

當時實際使用的 schema：

```js
{
  version: 1,
  gameId: "NML_MoMaJohn",
  playContext: "nightMarket",
  startedAt: "ISO 8601 timestamp"
}
```

## 4. redirect 到 NML_MoMaJohn

正式 GitHub Pages 使用：

```text
/NML_MoMaJohn/?context=nightMarket
```

也就是：

```text
https://kriskuo1129.github.io/NML_MoMaJohn/?context=nightMarket
```

`?context=nightMarket` 用來讓遊戲知道這次不是 standalone 直接開啟。

## 5. NML_MoMaJohn 辨識 Night Market Context

NML_MoMaJohn 原本保留：

```js
PLAY_CONTEXT = {
  STANDALONE: "standalone",
  NIGHT_MARKET: "nightMarket",
  PRACTICE: "practice"
}
```

實際整合後：

- 沒有 `?context=nightMarket` → 維持 standalone。
- 有 `?context=nightMarket` → 嘗試進入 Night Market Context。

單靠 URL parameter 不足以視為合法啟動。

遊戲還必須再讀取並驗證：

```text
nightMarketActiveGame
```

## 6. NML_MoMaJohn 驗證 Active Game

當時驗證至少包含：

```text
version === 1
gameId === "NML_MoMaJohn"
playContext === "nightMarket"
```

若 Active Game 缺少、格式不符或 gameId/context 不符：

```text
不開始 Night Market 遊戲
→ 顯示「夜市人生遊戲資料無效」
→ 提供返回 Platform 的按鈕
```

因此：

```text
?context=nightMarket
```

只是 context selector，不是完整的授權／遊程資料。

## 7. 遊戲結束建立 Result

正常 GAME OVER 與 Night Market 主動離場，最後都收斂到：

```js
finalizeNightMarketGame(termination)
```

並透過單一 Result Builder 建立結果。

舊版 Result key：

```text
nightMarketGameResult
```

實際 schema 見第五節。

## 8. 保存 Result

Mini Game 將 Result 寫入：

```text
nightMarketGameResult
```

Mini Game **不直接更新 `nightMarketLifeSession`**。

這是歷史版本最重要的責任邊界之一。

## 9. redirect 回 Platform

正式環境返回：

```text
/NightMarketLife/
```

即：

```text
https://kriskuo1129.github.io/NightMarketLife/
```

這是一個真正的整頁 navigation，不是 iframe 關閉或 postMessage callback。

## 10. Platform 恢復 Session

回到 NightMarketLife 時，頁面重新載入。

Platform 重新執行自己的啟動流程，透過：

```js
loadSession()
```

從：

```text
nightMarketLifeSession
```

恢復 redirect 前保存的遊程。

## 11. Platform 驗證 Result

Platform 載入時會檢查：

```text
Platform Session
Active Game
Game Result
```

有效 Result 必須和目前 Active Game 對得上；無效或沒有對應 Active Game 的 Result 不套用。

## 12. 避免 Reload 重複結算

成功套用 Result 後：

```text
保存 Platform Session
→ 刪除 nightMarketGameResult
→ 刪除 nightMarketActiveGame
```

因此使用者在回到 Platform 後再 Reload，不會再次找到同一個 Result，也就不會再次套用。

這是舊版的 exactly-once-like 防重複策略。

它不是完整交易式 exactly-once；限制見第六節。

## 13. Active / Result 清除

正常消費 Result 後：

```text
nightMarketGameResult → remove
nightMarketActiveGame → remove
```

Platform 另外有集中遊程重設函式：

```js
resetNightMarketRun()
```

舊版會清除：

```text
nightMarketLifeSession
nightMarketActiveGame
nightMarketGameResult
```

而不清除其他無關 localStorage。

---

# 二、localStorage 架構

舊版串接正式使用三個主要 Key。

| Key | 角色 | 主要建立者 | 主要讀取者 | 主要修改者 | 主要刪除者 |
|---|---|---|---|---|---|
| `nightMarketLifeSession` | Platform 持久 Session | NightMarketLife | NightMarketLife | NightMarketLife | NightMarketLife |
| `nightMarketActiveGame` | 當前跨頁小遊戲遊程識別 | NightMarketLife | NML_MoMaJohn、NightMarketLife | 原則上建立後不由 Mini Game 修改 | NightMarketLife |
| `nightMarketGameResult` | Mini Game 單次回傳結果 | NML_MoMaJohn | NightMarketLife | NML_MoMaJohn 建立一次 | NightMarketLife |

## 2.1 Session

責任：

```text
保存 Platform 自己的全局遊程狀態
```

生命週期：

```text
Platform 建立
→ Platform 每次必要狀態變更後保存
→ redirect 前已保存
→ Mini Game 期間保持不動
→ 返回 Platform 後 load
→ Platform 套用 Result 後再 save
→ 正式遊程 reset 時清除
```

Mini Game 不直接修改 Session。

## 2.2 Active Game

責任：

```text
證明「Platform 目前確實啟動了一次 NML_MoMaJohn Night Market 遊程」
```

生命週期：

```text
Platform redirect 前建立
→ Mini Game 啟動時讀取與驗證
→ Result 返回 Platform 時再次作為關聯驗證資料
→ Result 成功消費後由 Platform 清除
```

舊版沒有把整份 Platform Session 複製進 Active Game。

## 2.3 Game Result

責任：

```text
Mini Game → Platform 的一次性回傳 payload
```

生命週期：

```text
Mini Game finalize
→ 寫入 nightMarketGameResult
→ redirect 回 Platform
→ Platform load / validate
→ apply
→ save Platform Session
→ remove Result
```

Game Result 是一次性 envelope，不是另一份 Session。

---

# 三、Session Persistence

## 3.1 createSession()

Platform 負責建立新的正式 Session。

舊版 Session schema 曾包含：

```js
{
  version: 1,
  mode: "nightMarket",
  points: 1000,
  remainingMinutes: 300,
  startPoints: 1000,
  started: true,
  createdAt: "ISO 8601 timestamp",
  updatedAt: "ISO 8601 timestamp"
}
```

> **Legacy Example，僅用於說明當時資料流，不代表新版規格。**
>
> 上述 `points`、`remainingMinutes`、`startPoints` 等都屬於舊遊戲模型，不應帶入新版。

串接角度真正值得保留的概念只有：

```text
Platform 建立自己的 Session
→ Session 有版本
→ Session 可序列化
→ Session 放進 localStorage
```

## 3.2 saveSession(session)

`saveSession()` 集中負責：

```text
更新必要 metadata
→ JSON 序列化
→ 寫入 nightMarketLifeSession
```

重要歷史流程：

```text
Platform 即將 redirect
→ 先把最新 Platform 狀態 saveSession()
→ 再建立 Active Game
→ 再 redirect
```

因此 redirect 不會讓主程式遊程消失。

## 3.3 loadSession()

Platform 每次整頁載入時：

```text
讀取 nightMarketLifeSession
→ JSON parse
→ 驗證
→ 有效則恢復 Runtime
→ 無效則清除
```

這也是 Mini Game 返回 Platform 後的恢復機制。

不是 Mini Game 把完整 Session 傳回來。

而是：

```text
Session 一直留在 shared localStorage
```

## 3.4 clearSession()

只清除 Platform Session：

```text
nightMarketLifeSession
```

由 Platform 控制。

## 3.5 resetNightMarketRun()

舊版正式存在的集中 reset：

```js
resetNightMarketRun()
```

清除：

```text
nightMarketLifeSession
nightMarketActiveGame
nightMarketGameResult
```

它的意義是清除「目前這一整次 Night Market 遊程與跨頁 pending 狀態」。

當時特別要求不要順手清掉：

```text
玩家名稱
未來自訂設定
其他不屬於正式遊程的 localStorage
```

## 3.6 為什麼 redirect 後還能恢復？

因為 localStorage 的生命週期不跟 JavaScript page instance 綁定。

實際發生的是：

```text
NightMarketLife Runtime memory
        │
        │ saveSession()
        ▼
browser localStorage
nightMarketLifeSession
        │
        │ location redirect
        ▼
NightMarketLife JavaScript 被卸載
        │
        ▼
NML_MoMaJohn 執行
        │
        │ redirect back
        ▼
NightMarketLife 全新 page load
        │
        │ loadSession()
        ▼
從 localStorage 還原 Platform Runtime
```

因此舊版並沒有做 SPA 跨頁保活，也沒有 server-side Session。

---

# 四、Active Game Contract

## 4.1 當時實際 Schema

```js
{
  version: 1,
  gameId: "NML_MoMaJohn",
  playContext: "nightMarket",
  startedAt: "ISO 8601 timestamp"
}
```

## 4.2 建立位置

由：

```text
NightMarketLife
```

建立。

NML_MoMaJohn 不自行建立 Active Game。

## 4.3 寫入時機

在 Platform 已經完成自己的進場前處理、保存 Platform Session，準備正式 redirect 到 Mini Game 時寫入。

## 4.4 NML_MoMaJohn 驗證

Night Market context 啟動時至少驗證：

```js
active.version === 1
active.gameId === "NML_MoMaJohn"
active.playContext === "nightMarket"
```

驗證失敗則拒絕啟動 Night Market 遊戲。

## 4.5 gameId

舊版最終技術識別名稱：

```text
NML_MoMaJohn
```

早期曾使用 `MoMaJohnNML`，但 Repository / Pages / gameId 正式重新命名後，最終對齊為 `NML_MoMaJohn`。

## 4.6 playContext

實際值：

```text
nightMarket
```

與 Mini Game 內部 `PLAY_CONTEXT.NIGHT_MARKET` 對應。

## 4.7 startedAt

由 Platform 建立 Active Game 時寫入：

```text
ISO 8601 timestamp
```

舊版文件沒有證據顯示它被拿來做安全 timeout、租約過期或 retry 判斷；它主要是 Active Game metadata。

## 4.8 玩家名稱

當時真正完成的 Active Game schema **沒有 playerName 欄位**。

NML_MoMaJohn standalone 本身另有自己的玩家名稱 localStorage：

```text
momajohnNMLPlayerName
```

但舊版串接文件沒有證據顯示 Platform 透過 Active Game 把玩家名稱正式傳給 Mini Game。

因此新版不能把「playerName 曾是 Active Game Contract 的一部分」當成歷史事實。

---

# 五、Game Result Contract

## 5.1 當時實際 Schema

NML_MoMaJohn 最終 Result Builder 寫入：

```js
{
  version: 1,
  gameId: "NML_MoMaJohn",
  earnedPoints: game.score,
  consumedMinutes: (completedRounds + abandonedStartedRound) * 5,
  completedRounds,
  termination: "completed" | "user_exit",
  createdAt: "ISO 8601 timestamp"
}
```

> **Legacy Example，僅用於說明當時資料流，不代表新版規格。**
>
> `earnedPoints`、`consumedMinutes`、舊時間算法、舊收益算法均屬歷史遊戲規則。

串接層真正值得保存的是：

```text
version
gameId
一組 Mini Game 自己算好的 result payload
termination
createdAt
```

以及：

```text
Mini Game 只產 Result，不直接寫 Platform Session
```

## 5.2 正常完成

正常整場結束（GAME OVER）：

```js
finalizeNightMarketGame("completed")
```

建立：

```text
termination = "completed"
```

然後：

```text
write nightMarketGameResult
→ redirect Platform
```

## 5.3 中途離場

Night Market Context 中的「離開遊戲」：

```js
finalizeNightMarketGame("user_exit")
```

建立：

```text
termination = "user_exit"
```

舊遊戲規則中，未結算當局如何計算屬於 legacy business rule；新版不應沿用。

## 5.4 尚未開始就離場

舊版曾實際測試：

```text
進入 NML_MoMaJohn
→ 尚未開始正式局
→ 直接離開
```

仍會產生 Night Market Result 並返回 Platform。

當時 payload 的舊規則例：

```js
{
  earnedPoints: 0,
  consumedMinutes: 0,
  termination: "user_exit"
}
```

> **Legacy Example，僅用於說明當時資料流，不代表新版規格。**

技術重點是：

```text
「尚未開始」仍可以走同一 finalize / Result / redirect 管線
```

而不是直接用 browser back 當作正常離場協定。

## 5.5 retry

舊版整合 Runtime **沒有證據顯示 Result schema 有 `retry` termination 或 `nextAction: "retry"`**。

NML_MoMaJohn standalone 的「再玩一次」被明確保留為 standalone 行為。

Night Market 整合文件只記錄：

```text
正常完成 → completed
主動離場 → user_exit
```

因此：

- 不應宣稱舊版已完成 Platform-controlled retry contract。
- 不應自行補 `nextAction`。
- 新版 retry / 再玩一次若需要跨頁協議，必須重新設計。

## 5.6 leave

舊版的 leave 是：

```text
Mini Game 決定目前玩家觸發「離開遊戲」
→ Mini Game 用 user_exit finalize
→ Mini Game 回傳 Result
→ Platform 最終處理自己的 Session
```

Mini Game 並沒有直接修改 Platform 全局帳本。

## 5.7 nextAction

舊版實際 Result schema **沒有 `nextAction` 欄位**。

如果新版需要：

```text
nextAction
retry
returnToLobby
...
```

必須視為新 Contract 設計，不是 legacy 相容欄位。

---

# 六、Exactly-once / 防重複結算

## 6.1 舊版 Runtime 順序

依當時 Platform 規格，概念流程為：

```text
Platform page load
    ↓
load Platform Session
    ↓
load / inspect Active Game
    ↓
load / inspect Game Result
    ↓
validate Session + Active + Result
    ↓
apply Result to Platform Session
    ↓
saveSession(updatedSession)
    ↓
remove nightMarketGameResult
    ↓
remove nightMarketActiveGame
    ↓
render restored / updated Platform
```

文件明確記錄：

```text
保存成功後立即刪除 Result 與 Active Game
```

無效或沒有對應 Active Game 的 Result：

```text
清除
→ 不套用
```

## 6.2 為什麼 Reload 不會重複？

第一次回 Platform：

```text
Result 存在
→ apply
→ save
→ remove Result
```

再次 Reload：

```text
Result 已不存在
→ 沒有東西可再次 apply
```

因此通過了舊版「返回後 Reload 不重複加算」測試。

## 6.3 這是不是完整 exactly-once？

不是。

它比較準確的描述是：

> **consume-and-delete 的一次性 Result 防重複策略。**

它當時足以處理正常 browser reload，但沒有完整交易機制。

## 6.4 舊方案的限制

舊版尚未實作：

```text
resultId
sessionId
idempotency key
transaction log
server acknowledgement
atomic storage transaction
```

因此理論上如果執行順序發生：

```text
Platform 已 save 套用後的 Session
→ 但尚未 remove Result
→ 頁面意外中止
```

下一次啟動仍可能看到 Result。

舊文件沒有記錄為這個 crash window 建立額外保護。

另外 localStorage 可由使用者 DevTools 修改，因此它不是安全或防作弊邊界。

---

# 七、Navigation / URL Resolver

## 7.1 NightMarketLife → NML_MoMaJohn

Platform 使用集中 resolver：

```js
resolveGameUrls()
```

### 舊本機開發環境

當時舊 workspace 實體資料夾名稱仍是：

```text
Platform
MoMaJohnNML
```

所以本機路徑是：

```text
../MoMaJohnNML/?context=nightMarket
```

### GitHub Pages

正式路徑：

```text
/NML_MoMaJohn/?context=nightMarket
```

解析為：

```text
https://kriskuo1129.github.io/NML_MoMaJohn/?context=nightMarket
```

## 7.2 NML_MoMaJohn → NightMarketLife

Mini Game 使用：

```js
resolvePageUrls()
```

### 舊本機開發環境

```text
../Platform/
```

### GitHub Pages

```text
/NightMarketLife/
```

解析為：

```text
https://kriskuo1129.github.io/NightMarketLife/
```

## 7.3 環境判斷

舊版 resolver 使用：

```text
location.hostname
```

辨識：

```text
localhost
127.0.0.1
```

本機走相鄰資料夾路徑。

其餘部署環境走正式 Pages path。

## 7.4 context=nightMarket

正式進場 URL：

```text
/NML_MoMaJohn/?context=nightMarket
```

Mini Game 解析 URL 後才切換：

```text
PLAY_CONTEXT.NIGHT_MARKET
```

無該參數時保持 standalone。

---

# 八、Same-Origin 原理

## 8.1 當時正式 Pages 架構

Platform：

```text
https://kriskuo1129.github.io/NightMarketLife/
```

Mini Game：

```text
https://kriskuo1129.github.io/NML_MoMaJohn/
```

雖然原始碼來自兩個不同 GitHub Repository，但瀏覽器判斷 Origin 不看 Repository 名稱。

Origin 主要由：

```text
scheme + host + port
```

組成。

兩者都是：

```text
scheme = https
host = kriskuo1129.github.io
port = 443（HTTPS 預設）
```

所以：

```text
Same Origin
```

path：

```text
/NightMarketLife/
/NML_MoMaJohn/
```

不同不影響 localStorage 共用。

因此兩個 Repository 的 GitHub Pages 可以共同讀取：

```text
nightMarketLifeSession
nightMarketActiveGame
nightMarketGameResult
```

## 8.2 Repository URL ≠ Pages URL

當時實際踩過一次觀念混淆：

原始碼 Repository：

```text
https://github.com/Kriskuo1129/...
```

不是玩家執行網頁的地址。

Runtime 必須使用 GitHub Pages：

```text
https://kriskuo1129.github.io/...
```

只有 Pages runtime 才涉及上述 same-origin localStorage 行為。

## 8.3 本機測試限制

本機若希望共用 localStorage，兩頁也必須 same-origin。

當時採用：

```text
從共同父資料夾啟動同一個 HTTP server
```

例如概念上：

```text
http://localhost:8000/Platform/
http://localhost:8000/MoMaJohnNML/
```

兩者 protocol / host / port 相同，因此可共享 localStorage。

若兩個專案各自在不同 port：

```text
localhost:8000
localhost:8001
```

就是不同 Origin，localStorage 不共用。

當時也明確不以：

```text
file://
```

作為正式跨頁整合測試方式。

---

# 九、NML_MoMaJohn Context 分流

## 9.1 Context 設計

舊版保留三種：

```js
const PLAY_CONTEXT = Object.freeze({
  STANDALONE: "standalone",
  NIGHT_MARKET: "nightMarket",
  PRACTICE: "practice"
});
```

這個設計的重點是：

```text
「遊戲玩法本體」與「由誰啟動 / 結果送去哪裡」分開。
```

## 9.2 standalone

直接開：

```text
/NML_MoMaJohn/
```

時：

```text
standalone
```

行為：

```text
不讀 Active Game
不產生 Night Market Result
不 redirect Platform
保留原本主選單
保留原本再玩一次
```

這讓 Platform 串接沒有破壞獨立遊戲能力。

## 9.3 nightMarket

只有：

```text
?context=nightMarket
```

且 Active Game 驗證通過時才進入。

Night Market 額外加入：

```text
Active Game validation
Night Market 專用離場
Result Builder
finalizeNightMarketGame()
redirect Platform
```

核心牌局流程仍盡量沿用既有遊戲。

## 9.4 practice

舊版只預留：

```text
PLAY_CONTEXT.PRACTICE
```

但當時文件明確寫著 Practice 跨頁整合尚未完成。

因此 Practice 不應被描述為已驗證過的串接路徑。

---

# 十、離開 / Retry

## 10.1 離開遊戲

Night Market Context 把 standalone 的：

```text
回主選單
```

調整成：

```text
離開遊戲
```

此按鈕不是單純 `history.back()`。

它會進入 Night Market finalize 流程。

## 10.2 中途離場

舊版會根據遊戲自己的 Runtime state 判斷應如何建立 Result。

這些局內判斷屬於 Mini Game 責任。

最後統一：

```js
finalizeNightMarketGame("user_exit")
```

Platform 不需要知道 Mini Game 局內 state 如何推導結果，只接收 Result。

## 10.3 GAME OVER

正常結束：

```js
finalizeNightMarketGame("completed")
```

Mini Game 建 Result、存 localStorage、redirect Platform。

Platform 才負責把 Result 套用到自己的全局 Session。

## 10.4 再來一次 / Retry

當時有明確證據的只有：

```text
Standalone 的「再玩一次」維持原行為
```

Night Market Runtime 沒有完成獨立的 retry contract、`nextAction`、retry Result 或 Platform 再授權協定。

因此不能把 standalone retry 當成 Night Market legacy API。

## 10.5 哪些由 Mini Game 決定？

舊版 Mini Game 決定：

```text
自己的 play state
正常結束或玩家離開
如何把局內狀態整理成 Result
termination = completed / user_exit
```

## 10.6 哪些由 Platform 決定？

Platform 決定：

```text
是否建立合法 Active Game
Platform Session 如何改變
Result 是否有效
Result 是否可套用
套用後如何保存
何時清除 Active / Result
```

## 10.7 哪些只是「回傳意圖」？

`termination` 是最接近「Mini Game 回傳這次如何結束」的欄位。

舊版沒有更一般化的：

```text
nextAction
retry
leave
continue
```

action contract。

---

# 十一、當時踩過的坑

以下只列舊對話／工作報告實際討論過的問題。

## 11.1 Repository URL 與 GitHub Pages URL 混淆

曾一度把：

```text
github.com/Kriskuo1129/...
```

與：

```text
kriskuo1129.github.io/...
```

混在一起討論。

最後明確定義：

```text
Repository URL = 原始碼
GitHub Pages URL = Runtime
```

正式 redirect 必須用 Pages path。

## 11.2 本機相對路徑與正式 Pages path 不同

舊本機工作區：

```text
Platform
MoMaJohnNML
```

但正式 Repository 最後重新命名成：

```text
NightMarketLife
NML_MoMaJohn
```

因此不能把：

```text
../Platform/
../MoMaJohnNML/
```

直接視為正式網址。

最後用：

```js
resolveGameUrls()
resolvePageUrls()
```

集中分環境處理。

## 11.3 localStorage Origin

曾特別釐清：

```text
不同 Repository 不等於不同 Origin
```

GitHub Pages 只要仍位於同一：

```text
https://kriskuo1129.github.io
```

即可共享 localStorage。

本機則必須同 protocol / host / port。

## 11.4 Reload 重複 Result

設計與測試明確要求：

```text
Result 套用成功後立即 remove
```

避免：

```text
回 Platform
→ 套用一次
→ Reload
→ 再套用一次
```

實際工作報告記錄此案例已通過。

## 11.5 無效 Result / 沒有對應 Active Game

Platform 對：

```text
無效 Result
缺少對應 Active Game 的 Result
```

採：

```text
清除
不套用
```

而不是盲目相信 Mini Game localStorage payload。

## 11.6 Active Game stale

舊版沒有完整 lease / expiry 系統。

當時可確認的處理只有：

- Result 成功後清 Active。
- `resetNightMarketRun()` 清 Active。
- Mini Game 啟動時若 Active 無效則拒絕 Night Market 啟動。

`startedAt` 沒有被記錄為 stale timeout 判斷依據。

## 11.7 中途離場

當時特別處理：

```text
不要讓 browser navigation 直接繞過 Result
```

Night Market 離場走正式 finalize pipeline，回傳 `user_exit`。

## 11.8 尚未開始就離開

有獨立測試案例。

技術上仍走：

```text
finalize
→ Result
→ redirect Platform
```

而不是當作「什麼都沒發生所以不用回報」。

## 11.9 返回路徑

早期固定：

```text
../Platform/
```

後來發現 GitHub Pages Repository 改名與 path 不一致，因此新增 `resolvePageUrls()`。

## 11.10 本機資料夾名稱與正式 Repository 名稱不同

命名整理後：

正式：

```text
NightMarketLife
NML_MoMaJohn
```

但舊本機工作區暫時仍是：

```text
Platform
MoMaJohnNML
```

所以當時 resolver 必須同時理解：

```text
本機實體 folder path
正式 Pages repository path
```

這也是為什麼沒有直接把一個相對 URL 硬寫死。

## 11.11 Back

舊對話曾關注「返回」流程，但現有 legacy 文件 **沒有證據顯示曾完整設計／驗證 browser Back button 的一致性策略**。

因此不能聲稱舊版已解決：

```text
瀏覽器上一頁
多頁 history
Back 後 Active / Result 狀態
```

新版若在意 browser Back，需重新設計與測試。

---

# 十二、哪些技術值得新版沿用

## A. 已實際驗證成功、值得沿用的技術

### A1. Platform Session 與 Mini Game Result 分權

```text
Platform 擁有全局 Session
Mini Game 只產生 Result
```

這個責任邊界值得保留。

### A2. Redirect 前持久化 Platform Session

```text
save Platform state
→ 才離開頁面
```

曾實際證明可以讓整頁跨 Repository navigation 後恢復遊程。

### A3. Active Game 作為跨頁遊程關聯

不用把整份 Session 傳給 Mini Game。

Platform 建立一份小型 Active Game：

```text
version
gameId
playContext
startedAt
```

Mini Game 用它驗證合法 Context。

### A4. Mini Game 單一 finalize 出口

```js
finalizeNightMarketGame(termination)
```

正常完成與主動離場都收斂到同一條 Result pipeline，降低漏寫回傳邏輯的風險。

### A5. Result consume-and-delete

```text
validate
→ apply
→ save
→ clear Result
→ clear Active
```

曾通過 Reload 不重複套用測試。

### A6. URL resolver 集中化

```js
resolveGameUrls()
resolvePageUrls()
```

將本機與 GitHub Pages 路徑差異集中處理，而不是散落在 UI handlers。

### A7. Context 分流不破壞 standalone

```text
standalone
nightMarket
practice（預留）
```

讓小遊戲能同時維持：

```text
直接網址可玩
Platform context 可串接
```

這個方向值得沿用。

### A8. Same-Origin GitHub Pages

不同 Repository：

```text
/NightMarketLife/
/NML_MoMaJohn/
```

但共用同一 `kriskuo1129.github.io` Origin，以 localStorage 完成純前端跨 repo 資料交接，曾實際跑通。

---

## B. 當時只是暫時方案的技術

### B1. localStorage 作為整個 Integration Bus

它非常適合第一版純前端驗證，但不是強一致、高安全或跨裝置方案。

### B2. 只有 `context=nightMarket` 的 URL selector

它本身只負責 Context 選擇；真正關聯仍靠 localStorage Active Game。

如果新版需要更完整 session routing，應重新設計。

### B3. hostname 判斷 localhost / production

當時足夠，但不是完整 environment configuration system。

### B4. Result 刪除作為唯一 idempotency

可防一般 Reload，但不等於完整 exactly-once。

---

## C. 當時尚未解決的限制

### C1. 沒有 resultId / idempotency key

舊版沒有：

```text
resultId
sessionId
requestId
transactionId
```

### C2. 沒有 atomic transaction

Platform Session save 與 Result remove 不是單一原子交易。

### C3. 沒有 server-side trust

localStorage 可以被 DevTools 修改。

### C4. 沒有跨裝置 Session

資料只在同一 browser origin。

### C5. 沒有完整 stale Active expiry

`startedAt` 有記錄，但沒有已完成的 timeout / lease contract。

### C6. Browser Back 沒有完整驗證

舊文件沒有證據可證明已完整處理。

### C7. Practice 串接沒完成

只有 context 預留。

### C8. Retry contract 沒完成

Night Market 沒有正式的 retry / nextAction protocol。

### C9. postMessage / iframe 未落地

早期分析曾建議，但最後 Runtime 沒使用。

---

## D. 新版重新實作時必須重新設計的部分

以下只能重新設計，不能拿 legacy business fields 直接套：

### D1. Platform Session Schema

新版主程式資料模型已大改。

舊：

```text
points
remainingMinutes
startPoints
...
```

全部只可當 legacy example。

### D2. Active Game 是否需要更多欄位

例如新版是否需要：

```text
session identity
stall identity
character data
environment snapshot
modifiers
launch params
```

本文件不替新版決定。

### D3. Result Schema

舊：

```text
earnedPoints
consumedMinutes
completedRounds
```

屬舊遊戲規則。

新版必須依新 NightMarketLife Contract 重新定義。

### D4. Retry / nextAction

舊版未完成，需要新規格。

### D5. Exactly-once 強化

若新版需要比 legacy 更可靠，可重新評估：

```text
resultId
processed-result registry
transaction state
recovery marker
```

但這屬新版設計。

### D6. stale Active recovery

新版應重新決定：

```text
重新整理 Mini Game
直接關閉 tab
browser Back
Platform 被再次打開
Active Game 過期
```

如何恢復。

---

# 十三、最終摘要

舊版真正完成的核心 Runtime：

```text
NightMarketLife Runtime
        ↓
saveSession()
        ↓
localStorage:
nightMarketLifeSession
        ↓
Create Active Game
nightMarketActiveGame
        ↓
Redirect
/NML_MoMaJohn/?context=nightMarket
        ↓
NML_MoMaJohn
        ↓
Detect PLAY_CONTEXT.NIGHT_MARKET
        ↓
Validate nightMarketActiveGame
        ↓
Play / Complete / User Exit
        ↓
finalizeNightMarketGame(termination)
        ↓
Create Result
nightMarketGameResult
        ↓
Redirect Back
/NightMarketLife/
        ↓
NightMarketLife new page load
        ↓
loadSession()
        ↓
Load Active + Result
        ↓
Validate
        ↓
Apply Result to Platform Runtime
        ↓
saveSession()
        ↓
Clear nightMarketGameResult
        ↓
Clear nightMarketActiveGame
```

一句話保存：

> **舊版成功串接的關鍵不是把兩個 Repository 變成同一個專案，而是讓兩個 GitHub Pages 保持 Same-Origin；Platform 先把自己的 Session 持久化，再用 Active Game 標記合法跨頁遊程，Mini Game 只產一次性 Result，最後由 Platform reload 後恢復 Session、驗證並消費 Result。**

---

# 附錄 A：舊版正式 Storage Key

```text
nightMarketLifeSession
nightMarketActiveGame
nightMarketGameResult
```

NML_MoMaJohn standalone 玩家名稱另使用：

```text
momajohnNMLPlayerName
```

後者不是 Platform ↔ Mini Game integration contract。

---

# 附錄 B：舊版 Active Game Schema

```js
{
  version: 1,
  gameId: "NML_MoMaJohn",
  playContext: "nightMarket",
  startedAt: "ISO 8601 timestamp"
}
```

---

# 附錄 C：舊版 Game Result Schema

```js
{
  version: 1,
  gameId: "NML_MoMaJohn",
  earnedPoints: game.score,
  consumedMinutes: (completedRounds + abandonedStartedRound) * 5,
  completedRounds,
  termination: "completed" | "user_exit",
  createdAt: "ISO 8601 timestamp"
}
```

> **Legacy Example，僅用於說明當時資料流，不代表新版規格。**

舊 Runtime 中沒有已確認的：

```text
nextAction
retry termination
resultId
sessionId
ACK
```

請勿在新版實作時誤認為 legacy contract 已包含這些欄位。
