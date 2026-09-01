# NightMarketLife Step 1 工作報告

## 1. 本次工作目標

完成《NightMarketLife 夜市人生》第一階段 Step 1「主程式核心骨架整理」。本次以乾淨、可擴充的資料流為優先，建立純前端、可由一般靜態網站或 GitHub Pages 提供的原生 ES Modules 架構，未引入框架、套件、後端或正式遊戲內容。

開始工作時專案目錄為空，沒有既有程式碼、資產、技術文件或 Git 工作樹可保留，因此本次從最小可運作骨架建立。

## 2. 修改 / 新增的檔案

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 靜態網站入口與四個最小 Scene 容器 |
| `style.css` | 僅供骨架辨識與操作的簡單樣式 |
| `js/config.js` | 平衡參數、Build Config 與 Config 查詢 |
| `js/state.js` | 唯一 GameState、各子狀態初始化及重設 |
| `js/game.js` | 啟動流程、New Game、ActivityResult 與外部遊戲接口 |
| `js/character.js` | Player Model、Build 套用與玩家名稱顯示規則 |
| `js/stalls.js` | Stall Model、型別常數、一般／特殊攤位初始化 |
| `js/events.js` | Environment Model 與 Active Events 空骨架 |
| `js/achievements.js` | Achievement Model、稀有度與空 Config |
| `js/ui.js` | Scene Manager 與由 GameState 驅動的基本 Render |
| `js/storage.js` | 僅保存角色建立／外觀設定的 LocalStorage 接口 |
| `tests/core.test.mjs` | 無第三方依賴的核心行為驗證 |
| `NIGHTMARKETLIFE_WORK_REPORT.md` | 本工作報告 |

## 3. 各模組用途

- `config.js`：集中所有目前已知且可能調整的平衡參數，避免 Magic Number 分散。
- `state.js`：建立並持有唯一、穩定參照的 `gameState`；New Game 以原地清除及重建方式確保匯入方不會保留舊 State 參照。
- `game.js`：協調初始化、New Game、ActivityResult 套用、UI 更新與第二階段外部結果入口。
- `character.js`：由 `buildId` 取得 Build 並建立 Player，不保存 `player.age`。
- `stalls.js`：建立可支援遊戲、食物、管理處、服飾店的通用 Stall Model；一般攤位有隨機 Life，特殊攤位不使用一般 Life。
- `events.js`：只建立環境初始資料與活動事件陣列，未實作事件邏輯。
- `achievements.js`：提供 Achievement Model 與四種稀有度，未實作條件。
- `storage.js`：限定保存 name、buildId、face、clothes，不保存本局狀態。
- `ui.js`：集中 Scene 切換與 Render，HTML 不反向成為資料來源。

## 4. GameState 結構

```js
{
  player: {
    name, buildId, stamina, maxStamina,
    money, score, face, clothes
  },
  environment: {
    crowdLevel, priceLevel, rewardLevel,
    raining, mosquito, influencer,
    influencerBlockedStallId
  },
  progress: { actionCount, nextEventAt },
  stalls: [],
  activeEvents: [],
  statistics: {
    totalActions, foodPurchases, gamePlays,
    mosquitoActions, stallVisits, eventHistory
  },
  achievements: [],
  session: { scene, lastActivitySourceId }
}
```

`gameState` 是唯一真實資料來源。UI 只讀取它並 Render，不會解析 HTML 顯示文字來計算遊戲資料。

## 5. Config 結構

已集中預留：

- 五種 Character Build：高中生 120／600、大學生 110／800、社會人 100／1000、中年人 85／1300、老年人 70／1600。
- 一般攤位 Life：10～20。
- 活動體力基準：game 10、food 0、testWork 25。
- 食物單次最大恢復：30。
- 環境事件間隔：4～6。
- 人潮等級：1 冷清、2 稀少、3 普通、4 熱鬧、5 爆滿。
- 物價倍率：0.9、1.0、1.2、1.4。
- 獎勵倍率：0.8、1.0、1.2、1.5、2.0。
- 預設 Build 及環境 Level。

## 6. ActivityResult 設計

`normalizeActivityResult(result)` 將輸入統一為：

```js
{
  staminaDelta: 0,
  moneyDelta: 0,
  scoreDelta: 0,
  completed: true,
  progressCost: 1,
  sourceId: ""
}
```

`applyActivityResult(result)` 是唯一套用活動結果的核心接口：

- 驗證數值欄位為有限數字。
- `completed: false` 時不改變遊戲資料。
- `scoreDelta` 若為負數，normalize/apply 流程會將其視為 0，確保精彩分數只增加、不扣除。
- 體力限制於 0 到 `maxStamina`。
- 更新 money、score、進度與 totalActions。
- 記錄最後活動來源並觸發 Render。

## 7. 初始化流程

載入頁面時，`initializeGame()` 依序：

1. 讀取角色設定（若有）。
2. 透過 `resetGameState()` 建立乾淨 GameState。
3. 初始化 Player、Environment、Progress、Statistics、Achievements、Stalls、Active Events 與 Session。
4. 綁定單一 UI click handler。
5. Render HOME Scene。

`createNewGame()` 使用相同重設流程，再切換到 CHARACTER_SETUP。`nextEventAt` 每局會在 Config 的 4～6 間重新隨機產生。temporary state、事件及統計不會沿用上一局。

## 8. Storage 設計

提供：

- `saveCharacterSettings(settings)`
- `loadCharacterSettings()`
- `clearCharacterSettings()`

Storage Key 已版本化為 `nightMarketLife.characterSettings.v1`。白名單僅包含角色 name、buildId、face、clothes；New Game 不清除此設定。體力、金錢、分數、夜市進度、攤位 Life、事件與成就均不保存。

## 9. 為第二階段預留的接口

`handleExternalGameResult(result)` 已建立，現在直接轉交 `applyActivityResult(result)`。未來 NML_MoMaJohn 或其他獨立遊戲只需轉成統一 ActivityResult，無須改寫 NightMarketLife 核心資料流程。

本次沒有實作 iframe、redirect、postMessage、Query、跨頁 Session 或任何串接通訊方式。

## 10. Debug 支援與測試結果

瀏覽器 Console 可使用 `window.NMLDebug`：

- `NMLDebug.getState()`：查看當前 GameState。
- `NMLDebug.newGame(settings?)`：建立新遊戲。
- `NMLDebug.builds`：查看五種 Build Config。
- `NMLDebug.stallConfig`：查看 Stall Config（目前依規格保持空陣列）。
- `NMLDebug.applyActivityResult(result)`：測試活動結果。
- `NMLDebug.handleExternalGameResult(result)`：測試第二階段 Wrapper。
- `NMLDebug.changeScene(scene)`：測試 Scene 切換。

驗證結果：

| 驗證項目 | 結果 |
| --- | --- |
| 靜態網站由 HTTP 開啟 | PASS |
| 首頁 ES Modules 載入 | PASS |
| Console error / warning | PASS（0 筆） |
| HOME → CHARACTER_SETUP → NIGHT_MARKET | PASS |
| 無名稱顯示 `-沒輸入名稱-` | PASS |
| 五種 Build 數值 | PASS |
| Environment 初始狀態 | PASS |
| nextEventAt 介於 4～6 | PASS |
| Statistics 初始化 | PASS |
| Stall Model / Life 範圍 | PASS |
| Achievement Model | PASS |
| ActivityResult 更新體力、金錢、分數、進度 | PASS |
| 負數 scoreDelta 不降低既有 Score | PASS |
| 體力上下限 | PASS |
| 第二次 New Game 清除 temporary state | PASS |

核心測試指令使用工作環境既有 Node 執行 `tests/core.test.mjs`，結果為 `NightMarketLife core tests: PASS`。Node 僅作開發測試工具，網站執行與部署不依賴 Node，也沒有 `package.json` 或第三方依賴。

## 11. 目前仍未實作的功能

依本次範圍，尚未實作正式角色建立 UI、正式夜市／攤位 UI、正式 7 個攤位、遊戲與食物活動、打工內容、環境事件、開局事件、成就條件、正式結算、Carousel、圖片上傳、遊戲進度存檔，以及 NML_MoMaJohn／其他頁面的任何串接方式。亦未加入 Backend、Database、Login 或真正的 PRO 會員系統。

## 12. 建議下一步工作

目前主程式建構的正確開發順序如下：

- Step 1：主程式核心骨架（本次已完成）。
- Step 2：首頁＋角色建立，包含名稱、預設臉、上傳臉、預設衣服、上傳衣服、Build 浮動選擇視窗、即時角色預覽及 Character Settings LocalStorage。
- Step 3：夜市主畫面，包含 HUD、夜市展示區、玩家角色、攤位 Carousel 及回家按鈕。

下一步應等待新指令後開始主程式建構 Step 2。「外部遊戲通訊／NML_MoMaJohn 串接」屬於 NightMarketLife 專案第二大階段，不是主程式建構的 Step 2。

---

# NightMarketLife Step 2 工作報告

## 13. 本次工作目標

完成主程式建構 Step 2「首頁＋角色建立」的完整玩家流程：HOME 輸入名稱、CHARACTER_SETUP 選擇或上傳臉與衣服、動態選擇 Build、即時預覽、保存 Character Settings，最後進入 NIGHT_MARKET Placeholder。Step 1 核心架構保留，未實作任何 Step 3 夜市主畫面功能。

## 14. 首頁 UI

首頁已加入「夜市人生」標題、副標題、遊戲引言、可留空的玩家名稱輸入及主要「開始遊戲」按鈕。名稱會傳入新 GameState 並切換至 CHARACTER_SETUP；若留空，後續統一顯示 `-沒輸入名稱-`。練習模式與自訂環境按鈕只開啟「僅限 PRO 會員使用」玩笑提示，沒有會員、登入或付款系統。

## 15. Character Setup UI

角色建立頁顯示首頁傳入的名稱、大型 Paper Doll 預覽、臉與衣服循環選擇器、兩個圖片上傳入口、Build 摘要按鈕、狀態訊息及「完成」按鈕。互動元件使用語意化 `button`、`input`、`fieldset` 與原生 `dialog`。

## 16. Character Layer 設計

預覽使用三個獨立 Layer：`clothes-layer`、`face-layer` 與空的 `accessory-layer`。衣服及臉各自載入圖片；臉使用置中 cover 顯示，衣服則統一填滿窄長 Body Layer。未來配件或事件效果可放入 accessory layer，不需重組角色圖片。

### Paper Doll Face / Clothes 相對位置修正

Face 與 Clothes 採用 Character Preview 的統一 CSS 尺寸及定位，不依素材 ID 設定個別 offset。預覽容器的高寬比為 `1.35`，以容納完整的長身體。`face-layer` 寬度為容器的 `74%`，使用 `aspect-ratio: 1` 維持 1:1 正圓，垂直定位為 `top: 7%`，並以 `left: 50%` 搭配 `translateX(-50%)` 水平置中、`z-index: 2` 顯示在前方。`clothes-layer` 寬度為容器的 `70%`，使用 `aspect-ratio: 25 / 32`（Body 高度為寬度的 1.28 倍）；固定視覺高度為約 89.6% 容器寬度。Body 垂直定位為 `top: 30%`，同樣水平置中並以 `z-index: 1` 顯示在後方；Clothes 圖片統一填滿此 Body Layer。Body 上端持續伸入 Face 後方，且上方圓角與領口透明區由頭部完整遮住。`accessory-layer` 維持 `z-index: 3`。`FACE_ASSETS`、`DEFAULT_CLOTHES`、Custom Face 與 Custom Clothes 均套用相同規格。

### Paper Doll 頭身接縫重疊修正

Placeholder Clothes 素材本身具有領口透明區；Body `top` 由 `32%` 上移至 `30%`，只增加 Face 與 Body 的垂直重疊量，使透明領口與上方圓角完整進入 Face 遮蓋範圍。Face `74%`、Body `70%`、兩層高度比例、水平定位及 Layer z-index 均保持不變，未使用額外遮罩。

## 17. Asset Directory

```text
assets/
├─ faces/
│  ├─ face_01.png ... face_05.png
├─ clothes/
│  ├─ default/
│  │  ├─ default_01.png ... default_05.png
│  └─ shop/
└─ character-assets.js
```

五張 Face 與五張 Default Clothes 均為 512×512 透明背景 PNG，採固定座標、純色極簡 Placeholder。預設衣服與未來 Shop Clothes 已分開保存。

## 18. Asset Manifest

`assets/character-assets.js` 統一匯出 `FACE_ASSETS`、`DEFAULT_CLOTHES` 及空的 `SHOP_CLOTHES`。角色 UI 只讀 Manifest，不硬編碼素材檔名。Shop 註解預留 `price`、`rarity`、`effectId` 與 `description` 欄位，但未實作購買或效果。

## 19. Asset Generator 工具

`tools/generate-character-assets.py` 掃描 faces、clothes/default、clothes/shop，支援 PNG、JPG、JPEG、WEBP，依不分大小寫檔名排序後重建 Manifest。Python 只用於開發流程，正式網站及 GitHub Pages 不依賴 Python。另提供 `tools/create-placeholder-character-assets.py`，可重現本次固定尺寸的極簡測試素材。

## 20. Face 系統

Face Picker 完全由 `FACE_ASSETS` 驅動，左右按鈕可首尾循環。選擇預設臉會清除自訂臉，並立即更新 Face Layer；上傳成功後顯示「自訂臉」並即時替換預覽。

## 21. Clothes 系統

Clothes Picker 只讀 `DEFAULT_CLOTHES` 並支援首尾循環，不載入 `SHOP_CLOTHES`。選擇預設衣服會清除自訂衣服，並立即更新 Clothes Layer；上傳成功後顯示「自訂衣服」。

## 22. Upload 圖片處理

上傳只接受 PNG、JPEG、WEBP，原始檔案上限為 5 MB。非圖片、過大檔案、讀取失敗、解碼失敗均會顯示友善頁面訊息。成功圖片以 Canvas 等比例縮放至最大 512×512，輸出品質 0.82 的 WEBP Data URL 後再預覽與保存，避免直接將手機原始大圖放入 LocalStorage。若仍遇到儲存容量不足，完成按鈕會顯示提示且不離開角色建立頁。

## 23. LocalStorage 設計

Character Settings 保存欄位為 `name`、`buildId`、`selectedFaceId`、`selectedClothesId`、`customFace`、`customClothes`。重新整理後首頁帶入上次名稱；再次開始時，Build、預設素材 ID 與自訂圖片均會還原。本局體力、金錢、分數、事件、進度、攤位與成就仍不保存。

## 24. Character Appearance Model

Player 新增：

```js
appearance: {
  faceId,
  clothesId,
  customFace,
  customClothes
},
inventory: { ownedClothes: [] }
```

`faceId`／`clothesId` 明確代表 Manifest Asset ID，自訂圖片則只放在 custom 欄位。Step 1 的 `player.face`、`player.clothes` 暫留為 ID 相容別名；新程式以 `appearance` 為準。Inventory 僅為空結構，沒有購買流程。

## 25. Build Modal

Build 使用原生浮動 `dialog`，可由按鈕開啟、關閉按鈕或 ESC 關閉；Modal 開啟時原生 backdrop 會阻止背景誤操作，選擇 Build 後自動關閉。

## 26. Build Config Render

Modal 選項由 `CONFIG.characterBuilds` 動態建立，沒有硬編碼五顆固定按鈕。每個選項顯示名稱、體力、金錢及描述。切換 Build 會立即更新 `buildId`、`maxStamina`、`stamina`、`money` 與畫面摘要；這是角色初始值重設，不經 ActivityResult。無舊設定時仍預設社會人 100／1000。

## 27. 完成角色建立流程

按下完成後先驗證 Build 存在，再將 Player 的 Character Settings 寫入 LocalStorage，保留 Build 初始體力與金錢，最後透過 Scene Manager 切換到 NIGHT_MARKET。保存失敗時停留原頁並顯示原因。

## 28. NIGHT_MARKET Placeholder

NIGHT_MARKET 本次只顯示「夜市主畫面將於 Step 3 實作」、玩家名稱與返回首頁按鈕。沒有 HUD、夜市場景、玩家站位、攤位或 Carousel。

## 29. 測試結果

| 驗證項目 | 結果 |
| --- | --- |
| Step 1 Core Tests 保持通過 | PASS |
| HOME 顯示與名稱傳遞 | PASS |
| 空白名稱顯示 `-沒輸入名稱-` | PASS |
| HOME → CHARACTER_SETUP | PASS |
| 五種 Build 由 Config 動態顯示 | PASS |
| Build 切換更新體力與金錢 | PASS |
| 預設 Build 為社會人 | PASS |
| FACE_ASSETS 首尾循環 | PASS |
| DEFAULT_CLOTHES 首尾循環 | PASS |
| SHOP_CLOTHES 不出現在角色建立 | PASS |
| Face／Clothes 上傳即時預覽 | PASS |
| 非圖片與超過 5 MB 圖片拒絕 | PASS |
| Character Settings 保存及重新整理還原 | PASS |
| New Game 不保存本局 GameState | PASS |
| 完成後進入 NIGHT_MARKET Placeholder | PASS |
| 練習模式／自訂環境 PRO 提示 | PASS |
| 320px 無水平捲動 | PASS（clientWidth 320 / scrollWidth 320） |
| 瀏覽器 Console | PASS（0 Error / Warning） |

實際瀏覽器已依規格完成流程 A～G。`tests/core.test.mjs` 同時涵蓋素材數量、循環、Build 初始值重設、上傳檔案驗證、Character Settings 保存與所有 Step 1 行為。

## 30. 已知限制

Paper Doll 目前是純色 Placeholder；上傳圖片沒有裁切、拖曳、縮放控制或自動去背。LocalStorage 容量依瀏覽器而異，即使圖片已縮放壓縮，兩張高細節圖片仍可能觸發容量限制，此時 UI 會要求更換較小圖片。原生 dialog 需要現代瀏覽器。

## 31. Step 3 尚未實作內容與建議下一步

Step 3 的 HUD、夜市展示區、玩家角色在夜市場景中的配置、攤位 Carousel 與回家按鈕均尚未實作。其他攤位 Life、環境／開局事件、成就條件、正式服飾店、服裝效果及外部遊戲串接也未提前製作。下一步應先由專案負責人檢查 Step 2 流程、Appearance Model、素材規格與報告，再依新指令開始 Step 3。
