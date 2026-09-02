# Stall Grid Night Market Prototype 工作報告

## Prototype 目的

本 Prototype 重新驗證 Night Market 主畫面的資訊分工：HUD 顯示玩家資源、Animation Stage 顯示夜市當下事件、Stall Grid 提供下一步目的地。此版本不延續第一人稱場景導航，也不整合正式遊戲。

## HUD Layout

- 固定於手機畫面最上方。
- 僅顯示體力 70、精彩分數 1300、金錢 900。
- 使用緊湊三欄排列，沒有大頭貼、裝備、名稱、環境狀態、時間或操作按鈕。

## Animation Stage

- 固定在 HUD 下方，不隨攤位清單捲動。
- Prototype Controls 可切換正常、下雨、人潮、網紅、蚊子、事件結果。
- 各狀態使用固定尺寸文字區與輕量 CSS 動畫，避免訊息長度造成版面明顯跳動。

## Fixed Area / Scroll Area 架構

`.game-screen` 使用三列 Grid：HUD、Animation Stage、剩餘空間的 Stall Area。Stall Area 本身鎖定溢出，只有 `.stall-grid` 設定 `overflow-y: auto` 與 `overscroll-behavior: contain`。因此主要 Gameplay 捲動不會帶走 HUD 或 Animation Stage。

## Stall Grid

- 使用兩欄 Grid。
- 共 14 個攤位測試資料與最後一張回家 Card，確保清單需要上下捲動。
- Card 高度兼顧觸控範圍、文字可讀性與同屏資訊量。
- Grid 本身沒有額外大型 Panel 包裝。

## Stall Card 資訊規則

每張 Card 永遠只顯示攤位名稱與狀態，不含價格、體力消耗、攤位類型、說明、生命值、按鈕文字、Emoji、圖片、評分、獎勵或進入提示。

## Status 顯示規則

- 營業中：正常亮度。
- 今日公休：降低亮度與飽和度，Modal 顯示無法進入。
- 網紅佔領中：輕微暖黃 Highlight，Modal 顯示無法進入。
- 準備收攤：稍暗但仍允許進入 Prototype Placeholder。
- 狀態一律以完整文字呈現，顏色只作輔助。

## Background Image 預留方式

`.stall-card::before` 已使用 CSS 自訂變數 `--stall-image` 作為背景層，未來可直接設定 `--stall-image: url(...)`。下半部保留深色漸層覆蓋，確保名稱與狀態在圖片背景上仍可閱讀。本版未加入任何正式攤位圖片。

## 回家 Card

回家使用相同 Stall Card 結構與兩行資訊規則，內容為「回家／結束今晚行程」。它是資料陣列最後一筆並跨滿最後一列，永遠位於所有攤位之後，不另設 Footer Button。

## Modal Interaction

- 營業中或準備收攤：顯示攤位名稱、目前狀態、前往攤位與取消。
- 今日公休或網紅佔領中：顯示目前暫時無法進入與知道了。
- 回家：顯示「今晚就先回家嗎？」以及繼續逛、回家。
- 所有後續動作皆為 Prototype Placeholder，沒有連接正式流程。

## Responsive 測試

設計基準為 390 × 900，沒有寫死 390px 寬或 900px 高。已實際驗證 320 × 844、390 × 844、390 × 900、430 × 932：四種尺寸均維持兩欄且沒有水平 Overflow，390 × 900 同屏可看到多張 Card。從全新頁面實際滑動 Grid 時，Grid `scrollTop` 由 0 移至 543px，body 保持 0，HUD 與 Animation Stage 的位置完全不變；已確認可滑到底及回到頂端。手機直接開啟時，Prototype Controls 位於遊戲畫面之外，外層頁面可捲動，但遊戲畫面內仍只有 Stall Grid 捲動。

## 正式 NightMarketLife 零修改確認

本次只新增 `prototype/stall-grid-night-market/` 下的 `index.html`、`style.css`、`preview.js` 與 `WORK_REPORT.md`。未修改正式 `index.html`、`style.css`、`js/`、`assets/`、`tests/`、GameState、Character Renderer、Stall Model 或 Storage；未刪除舊 Prototype、未開始 Step 4，亦不進行 Commit 或 Push。
