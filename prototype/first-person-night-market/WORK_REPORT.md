# First-person Night Market UI Prototype 工作報告

## Prototype 目的

驗證《NightMarketLife 夜市人生》改採「玩家本人走進夜市」的第一人稱場景式 UI 是否比既有 Card-based UI 更像遊戲。此 Prototype 不使用角色建立或 Paper Doll，也不代表正式功能已決定整合。

## 版型

以 390×900 為主要手機基準。桌面將 Prototype Controls 與 390px 手機預覽並排，手機則把 Controls 排在遊戲預覽上方。夜市場景直接成為主要遊戲區域，不被大型圓角 Scene Card 包覆。

## HUD

HUD 浮在場景頂部，以 Icon + Value 顯示體力 100／100、精彩分數 0、金錢 1000。三組資源共用一條深色漸層 HUD Strip，沒有三張獨立 Card，也不顯示正常環境文字。

## Equipment

HUD 下方提供三格裝備：輕便雨衣、夜市拖鞋與空裝備格。主畫面只顯示 Icon；點擊才以小型 Popup 顯示名稱、稀有度與效果。Prototype 只驗證 UI，不實作取得、裝備或效果運算。

## First-person Scene

場景以夜空、暖黃燈泡、近距離左右攤棚、中間透視道路、遠方攤位、路人與招牌構成。畫面不顯示玩家 Paper Doll 或 Avatar，使視角代表玩家本人正站在夜市街道上。

## Scene Layers

場景分為 `.scene-base`、`.scene-crowd`、`.scene-weather`、`.scene-event`、`.scene-fx`。Base 負責固定夜市；Crowd 增減人物；Weather 疊加雨線、雨傘、暗色與濕地；Event 顯示網紅拍攝群；FX 只放少量前景蚊子。

## Environment State 切換

Prototype Controls 提供正常、下雨、人潮爆滿、網紅、蚊子、混合狀態。正常狀態完全由場景表達；Rain、Crowded、Influencer、Mosquito 各自改變對應 Layer；Mixed 同時疊加雨、人潮與網紅，以測試多個 Modifier 的可讀性。

## Stall Selection

下方 Command Area 以左右箭頭循環 10 個 Prototype 攤位。選擇時更新攤位名稱、場景焦點方向及可見招牌 Highlight。場景內可直接點擊摸麻將、鹹酥雞或遠方彈珠台，其餘攤位仍可透過 Stepper 選擇。這些名稱只存在 Prototype，沒有修改正式 Stall Config。

## Stall Modal

按「前往」或直接點場景攤位後開啟小型 Modal，顯示 Icon、類型、名稱、簡短描述、進入與取消。進入按鈕只顯示 Prototype 提示，不會執行活動、資源變化或正式導航。

## Settlement Avatar Preview

Avatar 不出現在 Night Market Scene，只在「查看結算示意」Modal 中以圓形 Placeholder 搭配 Kris、精彩分數 850 與「夜市冒險家」成就呈現，用來驗證身份圖像在結算層級中的存在感。

## 390×900 Layout

手機預覽由 HUD／Equipment、約 640px 的第一人稱 Scene 與精簡 Command Area 組成。Prototype Controls 在手機上會額外增加頁面高度，但正式遊戲預覽本身仍依 390×900 配置；沒有把內容固定鎖死為 390×900。

## Responsive

桌面採 Controls + 手機預覽雙欄，720px 以下轉為單欄；320px 會縮短場景及近景攤棚，仍保留可操作按鈕。沒有使用整頁 `transform: scale()` 或 `zoom`。所有輕量動畫在 `prefers-reduced-motion` 下停用。

## 正式專案零修改確認

本次只新增 `prototype/first-person-night-market/` 下的 `index.html`、`style.css`、`preview.js`、`WORK_REPORT.md`。未修改正式 `index.html`、`style.css`、`js/`、`assets/`、`tests/`、GameState、Character Renderer、Stall Model、Storage 或任何 Gameplay；未刪除 Paper Doll，未開始 Step 4，亦未 Commit 或 Push。
