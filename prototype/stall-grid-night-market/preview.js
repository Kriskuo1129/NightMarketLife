const stalls = [
  { name: "摸麻將", status: "營業中", tone: "open" },
  { name: "彈珠台", status: "網紅佔領中", tone: "blocked" },
  { name: "棒球九宮格", status: "營業中", tone: "open" },
  { name: "鹹酥雞", status: "今日公休", tone: "closed" },
  { name: "飲料攤", status: "營業中", tone: "open" },
  { name: "刮刮樂", status: "營業中", tone: "open" },
  { name: "服飾店", status: "營業中", tone: "open" },
  { name: "道具店", status: "準備收攤", tone: "closing" },
  { name: "夾娃娃機", status: "營業中", tone: "open" },
  { name: "夜市管理處", status: "營業中", tone: "open" },
  { name: "套圈圈", status: "營業中", tone: "open" },
  { name: "糖葫蘆攤", status: "準備收攤", tone: "closing" },
  { name: "射氣球", status: "營業中", tone: "open" },
  { name: "章魚燒", status: "今日公休", tone: "closed" },
  { name: "回家", status: "結束今晚行程", tone: "home", home: true }
];

const stageMessages = {
  normal: "今晚的夜市十分熱鬧",
  rain: "突然下大雨",
  crowd: "今天的人潮特別多",
  influencer: "網紅出現在夜市！",
  mosquito: "附近的蚊子變多了...",
  result: "雨停了！"
};

const grid = document.querySelector("#stall-grid");
const stage = document.querySelector(".event-stage");
const stageMessage = document.querySelector("#stage-message");
const modal = document.querySelector("#stall-modal");
const modalTitle = document.querySelector("#modal-title");
const modalStatus = document.querySelector("#modal-status");
const modalMessage = document.querySelector("#modal-message");
const modalActions = document.querySelector("#modal-actions");

function makeButton(label, className, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", action);
  return button;
}

function closeModal() {
  modal.close();
}

function openStall(stall) {
  modalTitle.textContent = stall.name;
  modalStatus.textContent = stall.status;
  modalActions.replaceChildren();

  if (stall.home) {
    modalMessage.textContent = "今晚就先回家嗎？";
    modalActions.append(
      makeButton("繼續逛", "button-secondary", closeModal),
      makeButton("回家", "button-primary", () => {
        modalMessage.textContent = "Prototype：此處未連接正式結算流程。";
        modalActions.replaceChildren(makeButton("知道了", "button-primary", closeModal));
      })
    );
  } else if (stall.tone === "open" || stall.tone === "closing") {
    modalMessage.textContent = "目前狀態：可以前往這個攤位。";
    modalActions.append(
      makeButton("取消", "button-secondary", closeModal),
      makeButton("前往攤位", "button-primary", () => {
        modalMessage.textContent = "Prototype：攤位遊戲尚未連接。";
        modalActions.replaceChildren(makeButton("知道了", "button-primary", closeModal));
      })
    );
  } else {
    modalMessage.textContent = "目前暫時無法進入。";
    modalActions.append(makeButton("知道了", "button-primary", closeModal));
  }
  modal.showModal();
}

stalls.forEach((stall, index) => {
  const card = document.createElement("button");
  card.type = "button";
  card.className = `stall-card stall-card--${stall.tone}`;
  card.style.setProperty("--stall-shade", `${22 + (index % 5) * 5}%`);
  card.setAttribute("aria-label", `${stall.name}，${stall.status}`);
  card.innerHTML = `<span class="stall-card-copy"><strong>${stall.name}</strong><span>${stall.status}</span></span>`;
  card.addEventListener("click", () => openStall(stall));
  grid.append(card);
});

document.querySelectorAll("[data-event]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-event]").forEach((item) => item.setAttribute("aria-pressed", "false"));
    button.setAttribute("aria-pressed", "true");
    stage.dataset.stageState = button.dataset.event;
    stageMessage.textContent = stageMessages[button.dataset.event];
  });
});

modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});
