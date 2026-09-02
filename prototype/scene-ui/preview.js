const stalls = [
  { name: "摸麻將", icon: "🀄", type: "遊戲攤", description: "試試今晚的手氣？" },
  { name: "彈珠台", icon: "🎮", type: "遊戲攤", description: "瞄準高分，再來一局？" },
  { name: "棒球九宮格", icon: "⚾", type: "遊戲攤", description: "九個格子，今晚能打中幾個？" },
  { name: "鹹酥雞", icon: "🍗", type: "小吃攤", description: "香味從油鍋一路飄過來。" },
  { name: "飲料攤", icon: "🥤", type: "小吃攤", description: "逛累了，來杯冰涼飲料。" },
  { name: "夜市管理處", icon: "📋", type: "特殊攤位", description: "有事情可以來這裡問問。" },
  { name: "服飾店", icon: "👕", type: "特殊攤位", description: "看看今晚適合哪件衣服。" }
];

let selectedIndex = 0;
const stallDialog = document.querySelector("#stall-dialog");
const messageDialog = document.querySelector("#message-dialog");

function updateSelection() {
  const stall = stalls[selectedIndex];
  document.querySelectorAll("[data-selected-name]").forEach((element) => { element.textContent = stall.name; });
  document.querySelectorAll("[data-world-stall]").forEach((button, index) => { button.classList.toggle("is-selected", index === selectedIndex); });
}

function openStall(index = selectedIndex) {
  selectedIndex = index;
  updateSelection();
  const stall = stalls[selectedIndex];
  document.querySelector("[data-popup-icon]").textContent = stall.icon;
  document.querySelector("[data-popup-type]").textContent = stall.type;
  document.querySelector("[data-popup-name]").textContent = stall.name;
  document.querySelector("[data-popup-description]").textContent = stall.description;
  stallDialog.showModal();
}

document.querySelector("[data-world-stalls]").replaceChildren(...stalls.map((stall, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.worldStall = "";
  button.innerHTML = `<span>${stall.icon}</span><strong>${stall.name}</strong>`;
  button.addEventListener("click", () => openStall(index));
  return button;
}));

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.variantTarget) {
    document.querySelectorAll("[data-variant-target]").forEach((tab) => tab.setAttribute("aria-pressed", String(tab === button)));
    document.querySelectorAll("[data-variant]").forEach((variant) => { const active = variant.dataset.variant === button.dataset.variantTarget; variant.hidden = !active; variant.classList.toggle("is-active", active); });
  }
  if (button.dataset.cycle) { selectedIndex = (selectedIndex + Number(button.dataset.cycle) + stalls.length) % stalls.length; updateSelection(); }
  if (button.hasAttribute("data-open-selected")) openStall();
  if (button.hasAttribute("data-close")) button.closest("dialog")?.close();
  if (button.hasAttribute("data-enter")) { stallDialog.close(); document.querySelector("[data-message]").textContent = `${stalls[selectedIndex].name}：這裡只展示版型，不會執行正式攤位功能。`; messageDialog.showModal(); }
  if (button.hasAttribute("data-home")) { document.querySelector("[data-message]").textContent = "回家流程不在這次 UI Prototype 範圍內。"; messageDialog.showModal(); }
});

updateSelection();
