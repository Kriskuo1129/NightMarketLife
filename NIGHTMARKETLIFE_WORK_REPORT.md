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
