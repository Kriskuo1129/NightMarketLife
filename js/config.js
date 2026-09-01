export const CONFIG = Object.freeze({
  characterBuilds: Object.freeze([
    { id: "high-school", name: "高中生", stamina: 120, money: 600, description: "體力充沛、預算較少。" },
    { id: "college", name: "大學生", stamina: 110, money: 800, description: "體力與預算均衡。" },
    { id: "worker", name: "社會人", stamina: 100, money: 1000, description: "穩定的一般起點。" },
    { id: "middle-aged", name: "中年人", stamina: 85, money: 1300, description: "體力較少、資金充裕。" },
    { id: "senior", name: "老年人", stamina: 70, money: 1600, description: "體力有限、起始資金最多。" }
  ]),
  stallLife: Object.freeze({ min: 10, max: 20 }),
  staminaCosts: Object.freeze({ game: 10, food: 0, testWork: 25 }),
  foodMaxRecovery: 30,
  environmentEventInterval: Object.freeze({ min: 4, max: 6 }),
  crowdLevels: Object.freeze({ 1: "冷清", 2: "稀少", 3: "普通", 4: "熱鬧", 5: "爆滿" }),
  priceMultipliers: Object.freeze([0.9, 1.0, 1.2, 1.4]),
  rewardMultipliers: Object.freeze([0.8, 1.0, 1.2, 1.5, 2.0]),
  defaults: Object.freeze({ buildId: "worker", crowdLevel: 3, priceLevel: 1, rewardLevel: 1 })
});

export const getBuildById = (buildId) =>
  CONFIG.characterBuilds.find((build) => build.id === buildId) ?? null;
