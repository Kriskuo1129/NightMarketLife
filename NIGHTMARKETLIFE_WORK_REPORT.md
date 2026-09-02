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

Face 與 Clothes 採用 Character Preview 的統一 Layer Mask，不依素材 ID 或圖片透明 Padding 設定外框。預覽容器高寬比為 `1.35`。`face-layer` 寬度為容器的 `63.74%`、`aspect-ratio: 1`、`top: 10.85%`，以 `left: 50%` 搭配 `translateX(-50%)` 水平置中，使用 `border-radius: 50%`、`overflow: hidden` 與 `z-index: 2`。`clothes-layer` 寬度為 `46.07%`、高度為 `52.24%`、`top: 43.48%`，同樣水平置中，使用 `border-radius: 25% / 21%`、`overflow: hidden` 與 `z-index: 1`。`accessory-layer` 維持 `z-index: 3`。Face 在前、Body 在後且上端伸入 Face 下方，接縫沒有空洞、突出、背景縫或領口。

### Character Asset 顯示規格統一

舊 Default PNG 以透明 Padding 控制可見大小，但 Custom 圖片直接填滿 74%／70% Layer，造成切換後角色外框改變。量測舊素材後，Default Face 的 512×512 Canvas 非透明 Bounding Box 為 `(36, 36)–(477, 477)`，實際 `441×441`；Default Clothes 的非透明 Bounding Box 為 `(88, 104)–(425, 507)`，實際 `337×403`，並含領口透明洞。依舊 Layer 與 Bounding Box 換算，將當時 Default 的實際可見大小轉為目前正式 Layer：Face `63.74%` 正圓，Body `46.07% × 52.24%` 圓角長方形。Default 與 Custom 現在都以 `width: 100%`、`height: 100%`、`object-fit: cover`、`object-position: center` 填入相同 Layer，由 Layer Mask 決定最終角色外框。

Placeholder Generator 已改為產生滿版 512×512 純色 PNG：Face 不再自帶透明圓形 Padding，圓形完全由 Face Layer 負責；Clothes 不再包含領口、凹槽或透明外框，Body 圓角完全由 Clothes Layer 負責。Face Upload 會以 Center Crop 取 1:1 並輸出 512×512；Clothes Upload 維持 Center Crop 25:32 並輸出 500×640。圖片 Crop 只決定內容取樣，Layer Mask 獨立決定角色形狀。

四種瀏覽器組合 Default Face＋Default Clothes、Custom Face＋Default Clothes、Default Face＋Custom Clothes、Custom Face＋Custom Clothes 的外框實測完全一致：Face 約 `174.27×174.27px`，Body 約 `125.95×193.53px`，top、left、接縫、圓角與 z-index 均相同。Storage v1 不升版；舊 `customFace`／`customClothes` Data URL 可由新的 `object-fit: cover` 與 Layer Mask 安全相容，保留既有 name、build、預設素材選擇與 Custom 圖片，不讓舊圖片改變角色外框。

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

五張 Face 與五張 Default Clothes 均為滿版 512×512 純色 PNG，非透明 Bounding Box 為完整 Canvas。圖片不再包含角色外框或領口；圓形 Face 與圓角 Body 由 CSS Layer Mask 統一負責。預設衣服與未來 Shop Clothes 已分開保存。

## 18. Asset Manifest

`assets/character-assets.js` 統一匯出 `FACE_ASSETS`、`DEFAULT_CLOTHES` 及空的 `SHOP_CLOTHES`。角色 UI 只讀 Manifest，不硬編碼素材檔名。Shop 註解預留 `price`、`rarity`、`effectId` 與 `description` 欄位，但未實作購買或效果。

## 19. Asset Generator 工具

`tools/generate-character-assets.py` 掃描 faces、clothes/default、clothes/shop，支援 PNG、JPG、JPEG、WEBP，依不分大小寫檔名排序後重建 Manifest。Python 只用於開發流程，正式網站及 GitHub Pages 不依賴 Python。另提供 `tools/create-placeholder-character-assets.py`，可重現本次固定尺寸的極簡測試素材。

## 20. Face 系統

Face Picker 完全由 `FACE_ASSETS` 驅動，左右按鈕可首尾循環。選擇預設臉會清除自訂臉，並立即更新 Face Layer；上傳成功後顯示「自訂臉」並即時替換預覽。

## 21. Clothes 系統

Clothes Picker 只讀 `DEFAULT_CLOTHES` 並支援首尾循環，不載入 `SHOP_CLOTHES`。選擇預設衣服會清除自訂衣服，並立即更新 Clothes Layer；上傳成功後顯示「自訂衣服」。

## 22. Upload 圖片處理

上傳只接受 PNG、JPEG、WEBP，原始檔案上限為 5 MB。非圖片、過大檔案、讀取失敗、解碼失敗均會顯示友善頁面訊息。Custom Face 經 1:1 Center Crop 後輸出 512×512；Custom Clothes 經 25:32 Center Crop 後輸出 500×640。兩者優先輸出品質 0.82 的 WEBP Data URL 後再預覽與保存，避免將手機原始大圖放入 LocalStorage。若仍遇到儲存容量不足，完成按鈕會顯示提示且不離開角色建立頁。

### Custom Clothes 自動裁切

Custom Clothes 使用獨立的 `processCustomClothesImage(file)` 處理流程。圖片經格式與 5 MB 大小驗證、瀏覽器解碼後，依正式 Body 比例 `25:32` 執行水平及垂直置中的 Center Crop，再縮放至固定 `500×640` Canvas。太寬的來源裁掉左右兩側，太高的來源裁掉上下兩側；方向以瀏覽器完成 EXIF Orientation 解碼後的影像尺寸為準。

Canvas 不填入背景色，因此 PNG／WEBP 的透明 Alpha 會保留；優先以 WEBP quality `0.82` 編碼，瀏覽器不支援 WEBP 時 fallback PNG。裁切或編碼失敗會顯示友善錯誤訊息。LocalStorage 的 `customFace`／`customClothes` 只保存裁切、縮放及編碼後的 Data URL，不保存原始檔案。Custom 與 Default 圖片共用相同 Face／Body Layer、尺寸、定位、z-index 與接縫重疊規格。

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
| Custom Face 正方形／橫向／直向 1:1 Center Crop | PASS（全部輸出 512×512） |
| Custom Clothes 正方形／橫向／直向／25:32 Center Crop | PASS（全部輸出 500×640） |
| Custom Clothes PNG／透明 PNG／WEBP／JPEG | PASS（WEBP 0.82，透明 Alpha 保留） |
| Custom Clothes 保存後重新整理還原 | PASS（500×640 Data URL） |
| Default／Custom Face × Default／Custom Clothes 四種組合外框 | PASS（Face／Body 尺寸、位置、Mask、接縫完全一致） |
| 非圖片與超過 5 MB 圖片拒絕 | PASS |
| Character Settings 保存及重新整理還原 | PASS |
| New Game 不保存本局 GameState | PASS |
| 完成後進入 NIGHT_MARKET Placeholder | PASS |
| 練習模式／自訂環境 PRO 提示 | PASS |
| 320px 無水平捲動 | PASS（innerWidth 320，無水平 overflow） |
| 瀏覽器 Console | PASS（0 Error / Warning） |

實際瀏覽器已依規格完成流程 A～G。`tests/core.test.mjs` 同時涵蓋素材數量、循環、Build 初始值重設、上傳檔案驗證、Character Settings 保存與所有 Step 1 行為。

## 30. 已知限制

Paper Doll 目前是純色 Placeholder；上傳圖片會自動 Center Crop，但沒有手動裁切編輯器、拖曳、縮放控制或自動去背。LocalStorage 容量依瀏覽器而異，即使圖片已縮放壓縮，兩張高細節圖片仍可能觸發容量限制，此時 UI 會要求更換較小圖片。原生 dialog 需要現代瀏覽器。

## 31. Step 3 尚未實作內容與建議下一步

Step 3 的 HUD、夜市展示區、玩家角色在夜市場景中的配置、攤位 Carousel 與回家按鈕均尚未實作。其他攤位 Life、環境／開局事件、成就條件、正式服飾店、服裝效果及外部遊戲串接也未提前製作。下一步應先由專案負責人檢查 Step 2 流程、Appearance Model、素材規格與報告，再依新指令開始 Step 3。

---

# NightMarketLife Step 3 工作報告

## 32. Step 3 目標

完成主程式建構 Step 3「夜市主畫面」：玩家完成角色建立後可進入 NIGHT_MARKET，查看 HUD、自己的角色、環境狀態與 7 個攤位，瀏覽攤位資訊、開啟功能 Placeholder，並經回家確認前往 RESULT Placeholder。本次沒有實作任何 Step 4 資源變化或正式攤位活動。

## 33. Night Market Layout

夜市畫面採手機直式優先，由 HUD、環境狀態、夜市展示區、攤位 Carousel、選中攤位資訊與回家按鈕依序構成。桌面維持置中的手機遊戲版型；HTML 與 CSS 使用暖黃、深棕、米色、燈泡、棚架與招牌 Placeholder，沒有導入 Canvas、Framework 或正式美術資產。

## 34. HUD

HUD 直接從 `gameState.player` Render `stamina / maxStamina`、`score` 與 `money`，不從 HTML 文字反推狀態，也沒有重做 Step 1 的分數或資源規則。後續 ActivityResult 更新 Player 後可沿用同一 Render 流程刷新。

## 35. Environment Status

環境區直接讀取 `gameState.environment`。正常時只顯示「今晚一切正常」；實際為 true 的 Major Status 才顯示下雨、蚊子或網紅訊息。`crowdLevel`、`priceLevel`、`rewardLevel` 保留於 Environment Model，但不在正常狀態下塞滿 HUD，也沒有套用 Gameplay Effect。

## 36. Night Market Scene Area

展示區以 HTML + CSS 建立夜空、暖色燈泡、遠景攤棚、地面與方向招牌。方向招牌會隨 `selectedStallId` 顯示目前面對的攤位，角色位於畫面偏下中央；本次沒有角色移動、方向鍵或正式環境動畫。

## 37. Reusable Character Renderer

新增 `js/character-renderer.js`，以普通 JS Helper 建立並更新 `clothes-layer`、`face-layer`、`accessory-layer`。CHARACTER_SETUP 與 NIGHT_MARKET 都使用相同 Renderer 與 Appearance Model，未導入 React、Vue、Web Component Framework。

## 38. Character Asset Standard 重用方式

角色的 Face／Body 尺寸、top、水平置中、Mask、圓角與 z-index 仍由 Step 2 的同一組 CSS 規格控制。夜市場景只縮放整個 `.character-renderer` 容器，不另算 Face 或 Body 比例；Default 與 Custom Face／Clothes 因此沿用相同外框。

## 39. Stall Config

`js/stalls.js` 正式加入資料驅動的 Stall Config。每筆包含 `id`、`name`、`type`、`isSpecial`、`interactionType`、`icon`、`description` 與既有 Model 所需欄位。Icon 目前使用 Emoji Placeholder，沒有放入 Character Asset Manifest。

## 40. 7 個 Stall

目前共 7 攤：3 個 Game（`game_01`～`game_03`）、2 個 Food（`food_01`～`food_02`）、管理處與服飾店。一般攤位依既有規則初始化 10～20 Life；管理處與服飾店為 Special Stall，不使用一般 Life。

## 41. Carousel

Carousel 支援點擊 Card、原生橫向 Touch Scroll、CSS Scroll Snap，以及首尾循環的左右箭頭。Card 顯示 Icon、名稱、類型與營業狀態；箭頭切換會更新選中狀態並將對應 Card 捲入視野。直接 Swipe 後需點擊 Card 才同步 Selected，符合本階段允許的簡化範圍。

## 42. Selected Stall

選中攤位保存於 `gameState.session.selectedStallId`，New Game 預設為 `stalls[0]`。Selected Card 使用邊框、背景與小幅位移區隔；夜市招牌和詳細資訊區都由同一 State Render，不只存在 DOM。

## 43. Stall View State

新增 `getStallViewState(stall, environment)`，集中產生 `isClosed`、`isBlocked`、`canEnter`、類型、狀態、提示與 Life 文案。一般攤位顯示剩餘 Life；特殊攤位隱藏一般 Life。選擇或切換攤位不增加 `actionCount` 或 `statistics.totalActions`。

## 44. Closed / Blocked 顯示

`stall.isClosed === true` 時顯示「休攤」並停用進入按鈕。攤位 ID 等於 `environment.influencerBlockedStallId` 時顯示「網紅正在拍攝，暫時無法進入」並停用按鈕。兩者都只處理 View State，不實作事件生命週期。

## 45. Placeholder Enter

可進入攤位按下後只開啟原生 dialog。一般攤位顯示 Step 4 準備中訊息；管理處與服飾店顯示各自的後續 Step Placeholder。此操作不改變體力、金錢、分數、進度、Statistics 或 Stall Life。

## 46. Home / Return Flow

夜市內主要離開操作為「回家」。第一次按下會開啟「今晚就先回家嗎？」Confirmation；「繼續逛」關閉 dialog 並留在 NIGHT_MARKET，「回家」才切換 RESULT。CHARACTER_SETUP 的返回首頁流程仍保留。

## 47. RESULT Placeholder

RESULT 顯示「結算功能將於後續 Step 實作」、玩家名稱及目前 score、money、stamina / maxStamina，並提供「回首頁」。本次沒有成就、排名、評語、活動統計、Game Over 或正式 Settlement。

## 48. Responsive

主畫面於 320、390、430px 實測均無 body／整頁水平 Overflow；Carousel 自己保留橫向捲動。桌面採限制寬度後置中，觸控操作使用原生 `overflow-x: auto` 與 Scroll Snap。輕微角色 Idle 動畫支援 `prefers-reduced-motion`。

## 49. Debug

`window.NMLDebug` 新增 `selectStall(id)`、`closeStall(id)`、`openStall(id)`、`setRain(value)`、`setMosquito(value)`、`setInfluencer(value, stallId?)` 與 `render()`。Debug 只修改指定 Model 欄位並 Render，不會執行正式事件或 Gameplay。

## 50. Tests

| 驗證項目 | 結果 |
| --- | --- |
| Step 1／Step 2 核心行為保持通過 | PASS |
| CHARACTER_SETUP → NIGHT_MARKET | PASS |
| HUD 讀取 stamina、maxStamina、score、money | PASS |
| 共用 Character Renderer／三層結構 | PASS |
| 7 個 Stall（3 Game、2 Food、Management、Clothing） | PASS |
| Carousel 首尾循環與 selectedStallId | PASS |
| 一般 Stall Life／Special Stall 不顯示 Life | PASS |
| Closed／Influencer Blocked 停用進入 | PASS |
| Rain／Mosquito／Influencer Debug View State | PASS |
| 進入 Placeholder 不改資源、進度、Statistics、Life | PASS |
| 回家取消／確認／RESULT／回首頁流程 | PASS |
| 320／390／430px 無整頁水平 Scroll | PASS |
| 瀏覽器 Console Error / Warning | PASS（0 筆） |

實際瀏覽器完成 HOME → CHARACTER_SETUP → NIGHT_MARKET、7 攤顯示與切換、特殊攤位資訊、進入 Placeholder、HUD 不變、回家取消與確認、RESULT 數值顯示，以及三種手機寬度檢查。`tests/core.test.mjs` 完整執行結果為 `NightMarketLife core tests: PASS`。

## 51. 已知限制

目前攤位圖示與夜市場景都是 Emoji／CSS Placeholder；Swipe 後不自動計算最近 Card，使用者需點擊 Card 才更新 Selected。環境狀態只顯示 Major Status，沒有事件觸發、動畫或效果。RESULT、管理處、服飾店及所有攤位內容仍是 Placeholder。

## 52. Step 4 尚未實作內容

本次未實作正式 Game／Food／Work 活動、ActivityResult 資源變化、體力不足、價格、食物恢復、攤位 Life 扣除、夜市 Action 進度、4～6 Action 事件觸發、Rain／Mosquito／Influencer Gameplay、倍率效果、成就、服飾購買／效果、管理處功能、正式結算、NML_MoMaJohn、iframe 或 postMessage。下一步必須等待新指令後才可開始 Step 4。

---

# NightMarketLife Step 3 UI 收斂修改

## 53. Night Market Header 移除

NIGHT_MARKET 已移除最上方的 `Night Market`／`今晚的夜市` 標題區。畫面現在直接從體力、精彩分數與金錢 HUD 開始，Scene 仍以 `aria-label="夜市主畫面"` 保留可存取名稱。

## 54. HUD 與 Environment 壓縮

HUD 的上下 padding、欄位間距、數值 margin 與圓角均縮小。Environment Status 改成單行緊湊 Status Bar；正常只顯示「今晚一切正常」，事件仍以小型 Chip 顯示，資料來源與 Debug 行為未改。

## 55. 16:9 Scene 與 Character 整體縮小

Night Market Scene Area 改為完整主內容寬度的 `aspect-ratio: 16 / 9`。夜市角色由原本 9.5rem 縮為 6.2rem（320px 時 5.4rem），只改整個 Character Renderer Container 寬度；Face／Body 比例、top、Mask、Border Radius 與 z-index 完全沿用 Step 2 Character Asset Standard。

## 56. 「下一攤去哪？」與 Stall Card 壓縮

攤位標題由「今晚逛哪一攤？」改成「下一攤去哪？」。Carousel Card 從大型直式資訊卡改為扁平橫向選單，縮小 Icon、padding、行距與卡片寬高，保留合理觸控高度、Scroll Snap、Swipe、點擊及首尾循環箭頭。

## 57. 固定 Stall Detail 移除與 Modal

Carousel 下方原本長期佔位的 Selected Stall Detail 區已完全移除。點擊 Stall Card 現在會依序更新 `gameState.session.selectedStallId`、更新 Scene 方向招牌、將 Card 捲入視野，再開啟 Stall Detail Modal。左右箭頭只更新 Selected 並 Scroll，不會自動開 Modal；Swipe 後仍由玩家點擊 Card 開啟。

## 58. Life UI 隱藏與提示簡化

Modal 顯示 Icon、名稱、類型、簡短描述、營業狀態、進入與取消按鈕，不顯示 `life`、`maxLife`、營業耐久或剩餘次數。Stall Model 與 View State 的 Life 資料完整保留供 Step 4 使用。正常攤位不再顯示「可以進入看看」；只有 Closed 顯示「今天休攤。」、Influencer Blocked 顯示「網紅正在拍攝，暫時無法進入。」並停用進入按鈕。

## 59. 手機畫面高度 Before / After

390×844 實際量測：修改前 `document.body.scrollHeight = 1137`、`window.innerHeight = 844`；修改後 `document.body.scrollHeight = 844`、`window.innerHeight = 844`。頁面高度縮為原本約 74%，主要 HUD、Environment、16:9 Scene、Carousel 與回家操作可在單一 Viewport 內完成，不再需要頻繁上下滑動。

## 60. Responsive 與 Console Test

| Viewport | body scrollHeight | Scene Ratio | 整頁水平 Scroll | 結果 |
| --- | ---: | ---: | --- | --- |
| 320×844 | 844 | 16:9 | 無 | PASS |
| 390×844 | 844 | 16:9 | 無 | PASS |
| 430×932 | 932 | 16:9 | 無 | PASS |

瀏覽器另確認：最上方直接為 HUD、舊標題不存在、Card 明顯變扁、固定 Detail 不存在、點 Card 開啟 Modal、Modal 不顯示 Life、正常攤位沒有可進入提示、箭頭不自動開 Modal、Enter Placeholder 不改資源、回家與 RESULT／HOME 流程正常。Console Error／Warning 為 0。核心測試新增 UI 結構防回歸檢查並完整 PASS。

本次只進行 Step 3 UI 收斂；未開始 Step 4，未改變資源消耗、Action、Stall Life、事件、成就或正式結算邏輯。

---

# 390 × 900 UI 基準調整

## 61. 設計基準

NIGHT_MARKET 與 CHARACTER_SETUP 的主要手機設計基準由 390×844 調整為 390×900。此尺寸只作為 UI 配置與驗收基準，沒有將網站寫死為固定寬高；主容器仍使用響應式寬度與 Viewport 高度，320px、390px、430px 均可正常使用。

## 62. NIGHT_MARKET 尺寸調整

390×900 與其他高度至少 880px 的畫面會適度增加 HUD 欄位、Environment Status、Carousel、Stall Card 與回家按鈕的上下 padding，並讓 NIGHT_MARKET 使用最高 608px 的主畫面容器，以 `justify-content: space-between` 將額外高度分配為區塊呼吸空間。Carousel 仍保持扁平卡片，Stall Detail 仍使用 Modal，Life UI 仍隱藏；較矮畫面沿用緊湊配置，不使用 `transform: scale()` 或 `zoom`。

## 63. CHARACTER_SETUP 尺寸調整

390×900 下 Character Setup 的所有主要內容可完整顯示。320px 不再將 Face／Clothes Picker 強制改成單欄，而是保留可操作的雙欄排列、縮小欄間距與 fieldset padding，避免額外增加垂直高度。390×844 允許 56px 的少量捲動，不為了較矮螢幕犧牲 390×900 的主要視覺比例；Touch Target 與文字尺寸維持合理大小。

## 64. Character Renderer 與 16:9 Scene

Character Setup 與 Night Market 仍共用 `character-renderer.js` 及同一套 Face／Body／Accessory Layer。此次沒有修改 Face／Body 比例、top、Mask、Border Radius 或 z-index，也沒有再縮小夜市角色。Night Market Scene 的實測比例在所有尺寸均為 16:9。

## 65. Responsive 實測

| Viewport | Character Setup scrollHeight | Night Market scrollHeight | Night Market Scene | 水平 Overflow |
| --- | ---: | ---: | --- | --- |
| 320×844 | 844 | 844 | 16:9 | 無 |
| 390×844 | 900 | 844 | 16:9 | 無 |
| 390×900 | 900 | 900 | 16:9 | 無 |
| 430×932 | 932 | 932 | 16:9 | 無 |

390×900 的 Character Setup Scene 實際高度為 868.11px，Night Market Scene 容器為 608px；兩者主要操作均完整位於單一 Viewport。390×844 的 Character Setup 僅需約 56px 的少量垂直 Scroll，Night Market 不需額外 Scroll。

## 66. 驗證結果

- NIGHT_MARKET 最上方直接顯示 HUD，Environment、16:9 Scene、角色、Carousel、回家與 Stall Modal 均正常。
- CHARACTER_SETUP 的名稱、Preview、Face／Clothes Picker、Upload、Build 與完成按鈕均正常顯示及操作。

---

# Core UI Revision：Stall Grid Night Market

## Revision 目的與 Paper Doll 主流程調整

正式 NIGHT_MARKET 已採用 `prototype/stall-grid-night-market/` 驗證通過的資訊架構，改為固定 HUD、固定 Animation Stage、可獨立捲動的 Stall Grid。Paper Doll 不再是正式 Gameplay 的核心，也不再出現在 NIGHT_MARKET；此調整讓「玩家資源」、「夜市目前事件」與「下一步目的地」三種資訊各自擁有明確區域。

`CHARACTER_SETUP` Scene、`character-renderer.js`、Face／Clothes Assets、Upload 與 Storage 欄位均保留作為 Legacy 實作，沒有刪除、Migration 或清除玩家既有 LocalStorage。Character Renderer 只在 Legacy Character Setup 仍有對應 Host 時運作，不再阻擋正常 Gameplay Flow。

## HOME → NIGHT_MARKET 新流程與 Default Build

正常流程由 `HOME → CHARACTER_SETUP → NIGHT_MARKET` 改為 `HOME → NIGHT_MARKET`。玩家名稱仍由 HOME 表單取得，空白名稱仍透過既有顯示規則呈現 `-沒輸入名稱-`。

HOME 開始時會以 `CONFIG.defaults.buildId` 初始化玩家；目前值為 `worker`（社會人），初始體力 100、金錢 1000。舊 Character Settings 的 Appearance 欄位可繼續存在，但 Build 暫時固定使用 Default，不新增 Build Picker。`createNewGame(settings)` 亦直接進入 NIGHT_MARKET，仍允許測試或 Debug 明確傳入合法 Build。

## 新 HUD

HUD 沿用 Prototype 的緊湊三欄 Layout，只讀取並顯示正式 `player.stamina / player.maxStamina`、`player.score`、`player.money`。沒有玩家名稱、Avatar、Paper Doll、裝備、Build、環境文字、時間或設定按鈕，也沒有大型資源 Card。

## Animation Stage

Animation Stage 正式接入既有 Environment。主要訊息採穩定優先序：下雨、網紅、蚊子、人潮、正常；多個環境可同時存在時，只顯示一個 Primary Message，但雨線、人潮、網紅閃光與蚊子等 CSS Layer 可依正式 Boolean 狀態同時疊加。本輪沒有建立新的 Event System，也沒有產生任何 Gameplay Effect。

## Stall Grid 與 Stall Status Abstraction

Stall Grid 完全由 `gameState.stalls` 產生，目前仍是 Config 既有的 7 個正式攤位，沒有因 Prototype 加入刮刮樂、道具店或夾娃娃機。每張 Card 僅顯示攤位名稱與可直接閱讀的狀態，沒有 Icon、Emoji、類型、描述、Life、價格、體力、獎勵或進入提示。

新增 `getStallDisplayStatus(stall, environment)` 作為統一顯示入口，回傳 `code`、`label`、`canEnter` 與既有相容欄位。目前正式狀態為：

- `OPEN` → `營業中`，可進入 Placeholder。
- `CLOSED` → `今日公休`，不可進入。
- `INFLUENCER_BLOCKED` → `網紅佔領中`，不可進入。

`getStallViewState` 保留為相容 Alias，避免舊測試或後續程式立即失效。Card DOM 已預留 `--stall-image` Background Image Layer，並以單一 Bottom Gradient 保持未來圖片上的文字可讀性，沒有 Card inside Card。

## Home Card 與既有回家流程

「回家／結束今晚行程」由 UI 層額外產生，不加入 `gameState.stalls`，固定放在 Stall Grid 最後並跨滿一列。點擊後沿用既有 Confirmation；「繼續逛」停留 NIGHT_MARKET，「回家」前往既有 RESULT Placeholder，沒有重新設計結算。

## Scroll Architecture

正式 `.market-scene` 使用垂直 Flex Layout。HUD 與 Animation Stage 設為不可壓縮的固定區；`.stall-browser` 與 `.stall-grid` 使用 `min-height: 0`、`flex: 1`，只有 `.stall-grid` 設定 `overflow-y: auto` 與 `overscroll-behavior: contain`。主畫面高度依 `100dvh` 與可用空間計算，不依賴 390×900 Magic Pixel，也不使用 Body Scroll 完成 Gameplay 捲動。

## Debug 相容策略

`window.NMLDebug` 的 `closeStall`、`openStall`、`setRain`、`setMosquito`、`setInfluencer` 與 `render` 均保留，修改後會立即反映 Card Status 或 Animation Stage。`selectStall` 保留為 Legacy Debug 行為，不再驅動 Carousel，也不會因 Carousel 淘汰而產生錯誤。

## 本輪明確未實作

- 該輪尚未實作 Avatar Upload；後續已由「HOME UI Revision + Player Avatar」補上。
- 未實作 Equipment System。
- 未新增刮刮樂、道具店或夾娃娃機正式功能。
- 未執行任何攤位 Gameplay 資源變化。
- 未修改 Storage Schema。
- 未開始 Step 4 Resource／Stall Life。

## Responsive 與 Regression 測試結果

- `tests/core.test.mjs`：`NightMarketLife core tests: PASS`。
- HOME 直接進 NIGHT_MARKET、Default Build、統一 Stall Status、Environment Stage View、負數 scoreDelta 保護及既有 Step 1～3 核心測試：PASS。
- 瀏覽器尺寸 320×844、390×844、390×900、430×932：全部維持兩欄、無水平 Overflow、Body 不產生 Gameplay Scroll，且同屏可看到 7～8 張 Card。390×900 實際滑動 Stall Grid 時 `scrollTop` 由 0 移至 139，Body 保持 0，HUD 與 Animation Stage 座標完全不變。
- 瀏覽器流程 HOME → NIGHT_MARKET（未經 CHARACTER_SETUP）、正常攤位 Modal、Home Confirmation → RESULT → HOME：PASS。
- Gameplay 資源回歸：進入攤位 Modal 與回家前後維持體力 100/100、分數 0、金錢 1000，未增加 Action、未扣 Stall Life；Console 無 Error／Warning。
- 專案中不存在 `NIGHTMARKETLIFE_TECHNICAL_FUNCTIONAL_SPEC.md`，因此本輪沒有可同步更新的技術規格檔案。
- 四種指定 Viewport 均無 body 水平 Overflow。
- 瀏覽器 Console Error／Warning：0。
- `tests/core.test.mjs`：`NightMarketLife core tests: PASS`。

本次只修改尺寸、間距與 Responsive 基準；未修改 GameState、ActivityResult、Stall、Carousel／Modal 行為、Environment、Debug、Storage、Upload、Build、Appearance、回家或 RESULT 邏輯，亦未開始 Step 4。

---

# HOME UI Revision + Player Avatar

## 實機上方留白與 Safe Area / Viewport 修正

HOME 與 NIGHT_MARKET 原本共用 `main { min-height: 100vh; display: grid; align-items: center; }`，導致 Scene 在手機可用 Viewport 內垂直置中；NIGHT_MARKET 同時使用固定外層 padding 與 `calc(100dvh - 2rem)`，在 Safari／Chrome Browser UI 與 Safe Area 情境下會疊加上方空白。現在 `main` 改為自然由上往下排列，使用 `100dvh`，頂部與底部只保留 `env(safe-area-inset-*) + 0.5rem` 的小間距；320px 時為 `safe-area + 0.35rem`。NIGHT_MARKET 高度同步扣除 Safe Area 與這 1rem 小間距，HUD 從可用畫面頂端約 5.6～9px 開始。

NIGHT_MARKET 的 HUD、Animation Stage 與 Stall Grid Layout 未重新設計。Body 不負責 Gameplay 捲動；HUD 與 Stage 固定，只有 `.stall-grid` 維持 `overflow-y: auto`、`overscroll-behavior: contain` 與可用高度內的獨立捲動。

## HOME 視覺統一

HOME 改用與新版 NIGHT_MARKET 相同的黑褐／深咖啡 Surface、暖橘細邊框、暖黃燈光、米白文字與緊湊間距。大型紅色實心招牌改為小型夜市標題區與燈泡列；介紹文案內容未修改，只調整字級、行距與寬度。Input 改為深色 Surface，Primary 與 Secondary Button 改用同系暖色 Border／Highlight，不再使用亮紅與大塊淺黃色。共用色彩整理為 `--nml-bg`、`--nml-surface`、`--nml-surface-dark`、`--nml-border`、`--nml-gold`、`--nml-orange`、`--nml-text`、`--nml-muted`，沒有大規模重構其他 Scene。

## Player Profile Avatar Model 與 Storage

Player 新增獨立的 `profile.avatar`，不與 `appearance.faceId` 或 `customFace` 混用。`nightMarketLife.characterSettings.v1` 新增向後相容的 `avatar` 欄位；舊資料缺少欄位時使用 `null` 並顯示 CSS 人像剪影。Avatar 屬於玩家設定，HOME 上傳成功後立即保存，開始遊戲時與名稱再次保存；New Game 會從 Settings 保留 Avatar，但體力、金錢、分數、事件與其他本局狀態仍重新初始化。Storage Quota Failure 會保留前一張 Avatar 並在 HOME 顯示友善訊息。

## Avatar Upload 與共用圖片處理

HOME 的圓形 Avatar 與「更換大頭貼」共用同一個 file input，接受 PNG、JPEG、WEBP，原檔上限 5 MB。Avatar 直接重用 Legacy Custom Face 的 `processCustomFaceImage()`：格式／大小驗證、瀏覽器 Decode、1:1 Center Crop、512×512 Canvas、WEBP quality 0.82 與 PNG fallback 均只有一份底層實作。圖片資料保持正方形；HOME 與 RESULT 以 `border-radius: 50%`、`overflow: hidden`、`object-fit: cover` 的 UI Mask 顯示，不把 Data URL 實際裁成透明圓形。非圖片、超過 5 MB、Decode Failure、Canvas／Encode Failure 與 Storage Quota Failure 都透過頁面 Status 顯示，不使用 alert。

Legacy CHARACTER_SETUP、`character-renderer.js`、Face／Clothes Assets、Upload UI 與 Paper Doll 流程均保留。Legacy Custom Face 與 HOME Avatar 共用處理器後仍可正常輸出 512×512；Custom Clothes 仍維持既有 25:32 處理。

## 正式流程與 RESULT Avatar

正式流程維持 HOME → NIGHT_MARKET，不恢復 CHARACTER_SETUP。開始時取得名稱、保留 Avatar、套用 `CONFIG.defaults.buildId` 並初始化 New Game。NIGHT_MARKET HUD 仍只顯示體力、精彩分數與金錢，沒有加入 Avatar。既有 RESULT Placeholder 只在玩家名稱附近加入圓形 Avatar，用於驗證 HOME Upload → Game → RESULT 的持續性；結算內容與規則未重新設計。

## Responsive 與 Regression

| Viewport | HOME top | HOME 水平 Overflow | NIGHT_MARKET HUD top | Body Gameplay Scroll | Stall Grid Scroll |
| --- | ---: | --- | ---: | --- | --- |
| 320×844 | 5.6px | 無 | 6.6px | 無 | 正常 |
| 390×844 | 8px | 無 | 9px | 無 | 正常 |
| 390×900 | 8px | 無 | 9px | 無 | 正常 |
| 430×932 | 8px | 無 | 9px | 無 | 正常 |

四個 Viewport 的 Avatar 都保持正圓；Input 高度 48px、開始按鈕約 48px，沒有溢出或縮小 Touch Area。Avatar 實際上傳測試涵蓋 JPEG、PNG、透明 PNG、WEBP、橫圖、直圖與正方形圖，全部輸出 512×512 WEBP 並以圓形 Mask 顯示。重新整理後 Avatar 與名稱可正常還原；HOME → NIGHT_MARKET → RESULT 顯示相同 Avatar。非圖片、5 MB 超限與破損 PNG 均顯示對應友善訊息。Console Error／Warning 為 0。

`tests/core.test.mjs` 保留 Step 1 Core、Step 2 Legacy 與 Step 3 Core UI Revision，並新增空 Avatar fallback、Avatar Settings 保存、New Game 保留、1:1 Crop 規格、HOME → NIGHT_MARKET 與 RESULT Avatar Render 防回歸驗證，完整 PASS。專案仍不存在 `NIGHTMARKETLIFE_TECHNICAL_FUNCTIONAL_SPEC.md`，因此沒有建立或同步額外技術規格檔案。

本次未開始 Step 4，未修改 Stall Gameplay、ActivityResult、Environment Gameplay、Build、裝備、刮刮樂、道具店、排行榜或 PK，也未刪除 Legacy Paper Doll。
