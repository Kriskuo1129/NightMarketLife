const stalls = [
  ["摸麻將", "🀄", "遊戲攤", "今晚要不要試試手氣？"], ["彈珠台", "🎮", "遊戲攤", "瞄準高分，再來一局？"],
  ["棒球九宮格", "⚾", "遊戲攤", "九個格子，今晚能打中幾個？"], ["鹹酥雞", "🍗", "小吃攤", "香味從油鍋一路飄過來。"],
  ["飲料攤", "🥤", "小吃攤", "逛累了，來杯冰涼飲料。"], ["刮刮樂", "🎫", "遊戲攤", "刮開今晚的小驚喜。"],
  ["服飾店", "👕", "特殊攤位", "看看今晚適合哪件衣服。"], ["道具店", "🎒", "特殊攤位", "帶件裝備再繼續逛。"],
  ["夾娃娃機", "🧸", "遊戲攤", "試試能不能夾到稀有裝備。"], ["夜市管理處", "📋", "特殊攤位", "有事情可以來這裡問問。"]
].map(([name, icon, type, description]) => ({ name, icon, type, description }));
const equipment = {
  raincoat: { icon: "☔", name: "輕便雨衣", rarity: "稀有度：普通", effect: "下雨時降低負面影響。" },
  slippers: { icon: "🩴", name: "夜市拖鞋", rarity: "稀有度：普通", effect: "部分活動體力消耗降低。" },
  empty: { icon: "－", name: "空裝備格", rarity: "尚未裝備", effect: "可以從服飾店、道具店或遊戲取得裝備。" }
};
let selectedIndex = 0;
const scene = document.querySelector("[data-scene]");

function selectStall(index) {
  selectedIndex = (index + stalls.length) % stalls.length;
  const stall = stalls[selectedIndex];
  document.querySelector("[data-selected-stall]").textContent = stall.name;
  document.querySelector("[data-focused-stall]").textContent = stall.name;
  document.querySelectorAll("[data-scene-stall]").forEach((button) => button.classList.toggle("is-focused", Number(button.dataset.sceneStall) === selectedIndex));
  scene.dataset.focusSide = selectedIndex % 3 === 0 ? "left" : selectedIndex % 3 === 1 ? "center" : "right";
}
function openStall(index = selectedIndex) {
  selectStall(index); const stall = stalls[selectedIndex];
  document.querySelector("[data-stall-icon]").textContent = stall.icon;
  document.querySelector("[data-stall-type]").textContent = stall.type;
  document.querySelector("[data-stall-name]").textContent = stall.name;
  document.querySelector("[data-stall-description]").textContent = stall.description;
  document.querySelector("#stall-dialog").showModal();
}
function showMessage(text) { document.querySelector("[data-message]").textContent = text; document.querySelector("#message-dialog").showModal(); }

document.addEventListener("click", (event) => {
  const button = event.target.closest("button"); if (!button) return;
  if (button.dataset.environment) {
    scene.dataset.environmentState = button.dataset.environment;
    document.querySelectorAll("[data-environment]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  }
  if (button.dataset.equipment) {
    const item = equipment[button.dataset.equipment];
    document.querySelector("[data-equipment-icon]").textContent = item.icon; document.querySelector("[data-equipment-name]").textContent = item.name;
    document.querySelector("[data-equipment-rarity]").textContent = item.rarity; document.querySelector("[data-equipment-effect]").textContent = item.effect;
    document.querySelector("#equipment-dialog").showModal();
  }
  if (button.dataset.cycle) selectStall(selectedIndex + Number(button.dataset.cycle));
  if (button.dataset.sceneStall !== undefined) openStall(Number(button.dataset.sceneStall));
  if (button.hasAttribute("data-go")) openStall();
  if (button.hasAttribute("data-home")) document.querySelector("#home-dialog").showModal();
  if (button.hasAttribute("data-settlement")) document.querySelector("#settlement-dialog").showModal();
  if (button.hasAttribute("data-enter")) { button.closest("dialog").close(); showMessage(`${stalls[selectedIndex].name}：這裡只展示 UI，不會執行正式攤位功能。`); }
  if (button.hasAttribute("data-confirm-home")) { button.closest("dialog").close(); showMessage("回家流程只做確認示意，Prototype 仍留在夜市。"); }
  if (button.hasAttribute("data-close")) button.closest("dialog")?.close();
});
selectStall(0);
