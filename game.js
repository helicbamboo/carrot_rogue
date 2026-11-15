(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const canvasFrame = document.getElementById("canvasFrame");
  const ui = {
    waveStat: document.getElementById("waveStat"),
    lifeStat: document.getElementById("lifeStat"),
    houseHealth: document.getElementById("houseHealth"),
    coinStat: document.getElementById("coinStat"),
    stageStatus: document.getElementById("stageStatus"),
    enemyCounter: document.getElementById("enemyCounter"),
    statusDot: document.getElementById("statusDot"),
    upgradeUndoButton: document.getElementById("upgradeUndoButton"),
    upgradeDockButton: document.getElementById("upgradeDockButton"),
    pauseButton: document.getElementById("pauseButton"),
    speedButtons: [...document.querySelectorAll(".speed-button")],
    waveTitle: document.getElementById("waveTitle"),
    waveBadge: document.getElementById("waveBadge"),
    waveTrack: document.getElementById("waveTrack"),
    missionCopy: document.getElementById("missionCopy"),
    waveButton: document.getElementById("waveButton"),
    waveButtonText: document.getElementById("waveButtonText"),
    buildHint: document.getElementById("buildHint"),
    towerCount: document.getElementById("towerCount"),
    towerInspector: document.getElementById("towerInspector"),
    towerInspectorContent: document.getElementById("towerInspectorContent"),
    towerHeadCard: document.getElementById("towerHeadCard"),
    towerHeadCardContent: document.getElementById("towerHeadCardContent"),
    towerPicker: document.getElementById("towerPicker"),
    towerPickerClose: document.getElementById("towerPickerClose"),
    towerBuildButtons: [...document.querySelectorAll("[data-tower-type]")],
    towerPickerNote: document.getElementById("towerPickerNote"),
    waveBanner: document.getElementById("waveBanner"),
    toast: document.getElementById("toast"),
    soundToggle: document.getElementById("soundToggle"),
    upgradeModal: document.getElementById("upgradeModal"),
    upgradeTargetSection: document.getElementById("upgradeTargetSection"),
    upgradeTargets: document.getElementById("upgradeTargets"),
    upgradeOptions: document.getElementById("upgradeOptions"),
    upgradeResult: document.getElementById("upgradeResult"),
    resultTitle: document.getElementById("resultTitle"),
    resultCopy: document.getElementById("resultCopy"),
    upgradeHideButton: document.getElementById("upgradeHideButton"),
    upgradeLaterButton: document.getElementById("upgradeLaterButton"),
    nextWaveButton: document.getElementById("nextWaveButton"),
    nextWaveButtonText: document.getElementById("nextWaveButtonText"),
  };

  const WIDTH = 1000;
  const HEIGHT = 640;
  const MAX_LIVES = 10;
  const WAVE_TRACK_LENGTH = 8;
  const AUTO_START_DELAY = 3;
  const WAVE_REFRESH_CHARGES = 1;
  const REFRESH_AFFIX_GRANT = 2;
  const TOWER_BASE_COST = 150;
  const TOWER_COST_STEP = 50;
  const WAVE_HEALTH_LINEAR_GROWTH = 0.175;
  const WAVE_HEALTH_QUADRATIC_GROWTH = 0.01;
  const TOWER_RANGE = 140;
  const FROST_TOWER_RANGE = 145;
  const PROJECTILE_SCREEN_MARGIN = 20;
  const FROST_SLOW_DURATION = 3;
  const FROST_FREEZE_DURATION = 0.4;
  const COLD_PRIORITY_ATTACK_SPEED_BONUS = 0.2;
  const CELL_SIZE = 50;
  const GRID_COLUMNS = 20;
  const GRID_ROWS = 12;
  const GRID_ORIGIN_X = 0;
  const GRID_ORIGIN_Y = (HEIGHT - GRID_ROWS * CELL_SIZE) / 2;
  const HOUSE_CELL = { col: 18, row: 10 };

  const towerTypes = {
    sentry: {
      key: "sentry",
      name: "守夜炮塔",
      description: "单体攻击",
      damage: 28,
      range: TOWER_RANGE,
      interval: 0.9,
      projectileSpeed: 520,
      projectileColor: "#ffad3d",
      muzzleColor: "#ffbd55",
      frostSlowFactor: 1,
    },
    frost: {
      key: "frost",
      name: "冰冻炮台",
      description: "单体减速",
      damage: 12,
      range: FROST_TOWER_RANGE,
      interval: 1.4,
      projectileSpeed: 480,
      projectileColor: "#7fe7f2",
      muzzleColor: "#c9fbff",
      frostSlowFactor: 0.75,
    },
  };

  function getTowerType(tower) {
    return towerTypes[tower?.type] || towerTypes.sentry;
  }

  function isEnemySlowed(enemy) {
    return Boolean(enemy && enemy.frostSlowRemaining > 0);
  }

  function isEnemyFrozen(enemy) {
    return Boolean(enemy && enemy.freezeRemaining > 0);
  }

  function isEnemyFrostAffected(enemy) {
    return isEnemySlowed(enemy) || isEnemyFrozen(enemy);
  }

  function getCellId(col, row) {
    return `cell-${col}-${row}`;
  }

  function getCellCenter(col, row) {
    return {
      x: GRID_ORIGIN_X + col * CELL_SIZE + CELL_SIZE / 2,
      y: GRID_ORIGIN_Y + row * CELL_SIZE + CELL_SIZE / 2,
    };
  }

  function isCellInsideGrid(col, row) {
    return col >= 0 && col < GRID_COLUMNS && row >= 0 && row < GRID_ROWS;
  }

  const gridPathWaypoints = [
    { col: -1, row: 1 },
    { col: 5, row: 1 },
    { col: 5, row: 4 },
    { col: 2, row: 4 },
    { col: 2, row: 7 },
    { col: 9, row: 7 },
    { col: 9, row: 3 },
    { col: 13, row: 3 },
    { col: 13, row: 10 },
    { col: 20, row: 10 },
  ];

  const pathPoints = gridPathWaypoints.map(({ col, row }) => getCellCenter(col, row));

  function createPathCellKeys() {
    const keys = new Set();
    for (let i = 1; i < gridPathWaypoints.length; i += 1) {
      const start = gridPathWaypoints[i - 1];
      const end = gridPathWaypoints[i];
      const stepCol = Math.sign(end.col - start.col);
      const stepRow = Math.sign(end.row - start.row);
      let col = start.col;
      let row = start.row;
      while (true) {
        if (isCellInsideGrid(col, row)) keys.add(getCellId(col, row));
        if (col === end.col && row === end.row) break;
        col += stepCol;
        row += stepRow;
      }
    }
    return keys;
  }

  const pathCellKeys = createPathCellKeys();
  const pathCells = [];
  const buildableCells = [];
  const cellsById = new Map();
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLUMNS; col += 1) {
      const id = getCellId(col, row);
      const cell = { id, col, row, ...getCellCenter(col, row) };
      cellsById.set(id, cell);
      if (pathCellKeys.has(id)) {
        pathCells.push(cell);
      } else {
        buildableCells.push(cell);
      }
    }
  }

  const pathSegments = [];
  let pathLength = 0;
  for (let i = 1; i < pathPoints.length; i += 1) {
    const start = pathPoints[i - 1];
    const end = pathPoints[i];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    pathSegments.push({ start, end, length, from: pathLength });
    pathLength += length;
  }

  function getClosestPathDistance(x, y) {
    let closestDistance = 0;
    let bestDistanceSquared = Infinity;
    pathSegments.forEach((segment) => {
      const dx = segment.end.x - segment.start.x;
      const dy = segment.end.y - segment.start.y;
      const t = Math.max(
        0,
        Math.min(1, ((x - segment.start.x) * dx + (y - segment.start.y) * dy) / segment.length ** 2),
      );
      const pointX = segment.start.x + dx * t;
      const pointY = segment.start.y + dy * t;
      const distanceSquared = (x - pointX) ** 2 + (y - pointY) ** 2;
      if (distanceSquared < bestDistanceSquared) {
        bestDistanceSquared = distanceSquared;
        closestDistance = segment.from + segment.length * t;
      }
    });
    return closestDistance;
  }

  const houseCenter = getCellCenter(HOUSE_CELL.col, HOUSE_CELL.row);
  const HOUSE_ENTRY_DISTANCE = Math.max(
    0,
    getClosestPathDistance(houseCenter.x, houseCenter.y) - CELL_SIZE * 0.55,
  );

  const enemyTypes = {
    normal: {
      key: "normal",
      name: "团子怪",
      hp: 72,
      speed: 58,
      radius: 18,
      reward: 9,
      lifeCost: 1,
      color: "#55abc9",
      dark: "#28758f",
      eye: "#173c47",
    },
    fast: {
      key: "fast",
      name: "风铃怪",
      hp: 38,
      speed: 102,
      radius: 14,
      reward: 8,
      lifeCost: 1,
      color: "#f2ce58",
      dark: "#b98d29",
      eye: "#5e4611",
    },
    tank: {
      key: "tank",
      name: "石甲怪",
      hp: 230,
      speed: 33,
      radius: 25,
      reward: 18,
      lifeCost: 2,
      color: "#8d77c8",
      dark: "#5d4b92",
      eye: "#30254d",
    },
  };

  const wavePlans = [
    { normal: 8 },
    { normal: 7, fast: 5 },
    { normal: 8, fast: 7, tank: 3 },
    { normal: 9, fast: 9, tank: 3 },
    { normal: 8, fast: 11, tank: 5 },
    { normal: 10, fast: 12, tank: 6 },
    { normal: 12, fast: 14, tank: 8 },
    { normal: 12, fast: 16, tank: 10 },
  ];

  function getWavePlan(wave) {
    if (wave <= wavePlans.length) return wavePlans[wave - 1];

    const endlessIndex = wave - wavePlans.length;
    return {
      normal: Math.min(24, 12 + Math.floor(endlessIndex * 0.75)),
      fast: Math.min(32, 16 + Math.floor(endlessIndex * 1.1)),
      tank: Math.min(18, 10 + Math.floor(endlessIndex * 0.6)),
    };
  }

  const affixes = [
    {
      id: "heavy-core",
      name: "重型弹芯",
      rarity: "精良",
      description: "换装高密度弹芯，使每一次命中造成更高伤害。",
      effectText: (tower) => `伤害 +32%`,
      apply: (tower) => {
        tower.damage *= 1.32;
      },
      icon: "core",
      accent: "#f3b968",
      tint: "rgba(244, 155, 56, 0.14)",
    },
    {
      id: "quick-trigger",
      name: "疾速扳机",
      rarity: "精良",
      description: "缩短装填行程，让炮台更快锁定下一个目标。",
      effectText: () => "攻击间隔 -18%",
      apply: (tower) => {
        tower.interval *= 0.82;
      },
      icon: "bolt",
      accent: "#efd468",
      tint: "rgba(244, 206, 88, 0.16)",
    },
    {
      id: "long-scope",
      name: "高倍瞄具",
      rarity: "普通",
      description: "加长侦测标尺，让射程覆盖更远的道路弯角。",
      effectText: () => "射程 +35",
      apply: (tower) => {
        tower.range += 35;
      },
      icon: "scope",
      accent: "#b8db9f",
      tint: "rgba(127, 200, 107, 0.15)",
    },
    {
      id: "crit-lens",
      name: "精准棱镜",
      rarity: "稀有",
      description: "校准折射镜片，命中要害时造成双倍伤害。",
      effectText: () => "暴击率 +18%",
      apply: (tower) => {
        tower.critChance = Math.min(0.65, tower.critChance + 0.18);
      },
      icon: "prism",
      accent: "#9ed8de",
      tint: "rgba(84, 169, 200, 0.15)",
    },
    {
      id: "critical-blast",
      name: "震荡弹芯",
      rarity: "稀有",
      description: "暴击时引爆弹芯，以命中点为圆心造成小范围冲击伤害。",
      effectText: () => "暴击附带半径 20 的范围伤害",
      apply: (tower) => {
        tower.critSplashRadius = 20;
      },
      unique: true,
      icon: "blast",
      accent: "#f0be78",
      tint: "rgba(240, 165, 78, 0.15)",
    },
    {
      id: "piercing-round",
      name: "贯穿弹头",
      rarity: "稀有",
      description: "弹头有概率在命中首个敌人后继续飞行，最多再命中一个敌人。",
      effectText: () => "50% 概率穿透 1 次",
      apply: (tower) => {
        tower.pierceChance = 0.5;
      },
      unique: true,
      icon: "pierce",
      accent: "#9ed8c9",
      tint: "rgba(84, 200, 167, 0.14)",
    },
    {
      id: "loot-pouch",
      name: "战利品袋",
      rarity: "普通",
      description: "击败怪物时回收散落零件，换取额外金币。",
      effectText: () => "击杀金币 +30%",
      apply: (tower) => {
        tower.killBonus += 0.3;
      },
      icon: "coin",
      accent: "#f3d275",
      tint: "rgba(244, 206, 88, 0.16)",
    },
    {
      id: "finisher",
      name: "终结协议",
      rarity: "稀有",
      description: "对生命值不超过 40% 的怪物提高伤害。",
      effectText: () => "生命值不超过 40% 时伤害 +50%",
      apply: (tower) => {
        tower.finisher += 0.5;
      },
      icon: "target",
      accent: "#e39c95",
      tint: "rgba(201, 78, 71, 0.12)",
    },
    {
      id: "deep-freeze",
      name: "深寒压缩",
      rarity: "精良",
      description: "强化冰冻炮台的制冷核心，使减速效果覆盖普通冰冻。",
      effectText: () => "移动速度降至 60%",
      apply: (tower) => {
        tower.frostSlowFactor = 0.6;
      },
      requiredTowerType: "frost",
      unique: true,
      icon: "snow",
      accent: "#83dce8",
      tint: "rgba(75, 186, 205, 0.17)",
    },
    {
      id: "frost-lock",
      name: "霜锁脉冲",
      rarity: "稀有",
      description: "攻击已经处于冰冻减速中的敌人时，冰塔必定暴击。",
      effectText: () => "攻击已减速目标时必定暴击",
      apply: (tower) => {
        tower.freezeOnSlowed = true;
      },
      requiredTowerType: "frost",
      unique: true,
      icon: "freeze",
      accent: "#9cecff",
      tint: "rgba(96, 205, 231, 0.18)",
    },
    {
      id: "cold-priority",
      name: "冷点排序",
      rarity: "精良",
      description: "优先处理尚未受到冰冻影响的敌人，并加快对这些目标的开火速度。",
      effectText: () => "优先攻击未受冰冻目标，攻速 +20%",
      apply: (tower) => {
        tower.prioritizeUnfrozen = true;
      },
      unique: true,
      icon: "priority",
      accent: "#a9d5c4",
      tint: "rgba(109, 192, 164, 0.15)",
    },
    {
      id: "refresh-supply",
      name: "备用方案",
      rarity: "精良",
      description: "重新整理本轮候选方案，立即获得额外刷新机会。",
      effectText: () => "刷新机会 +2",
      apply: () => {
        state.bonusRefreshCharges += REFRESH_AFFIX_GRANT;
      },
      icon: "refresh",
      accent: "#94d4c0",
      tint: "rgba(88, 184, 154, 0.15)",
      global: true,
    },
  ];

  const affixIcons = {
    core: '<circle cx="12" cy="12" r="5"></circle><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"></path>',
    bolt: '<path d="m13 2-8 12h6l-1 8 8-12h-6l1-8Z"></path>',
    scope: '<circle cx="12" cy="12" r="7"></circle><path d="M12 2v4M12 18v4M2 12h4M18 12h4"></path><circle cx="12" cy="12" r="2"></circle>',
    prism: '<path d="m12 3 8 15H4L12 3Z"></path><path d="M12 3v15M8 14h8"></path>',
    coin: '<circle cx="12" cy="12" r="8"></circle><path d="M9 9.5h6M9 14.5h6M12 8v8"></path>',
    target: '<circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M22 12h-3M12 22v-3M2 12h3"></path>',
    blast: '<circle cx="12" cy="12" r="3"></circle><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"></path>',
    pierce: '<path d="M3 12h15"></path><path d="m14 7 5 5-5 5"></path><path d="M7 7v10M11 7v10"></path>',
    snow: '<path d="M12 2v20M4 7l16 10M20 7 4 17"></path><path d="m9 4 3 3 3-3M9 20l3-3 3 3"></path>',
    freeze: '<path d="M7 3h10M8 3v5l4 4 4-4V3M12 12v9"></path><path d="M8 16h8"></path>',
    priority: '<path d="M4 6h9M4 12h6M4 18h9"></path><path d="m16 8 3 4-3 4"></path><circle cx="19" cy="12" r="2"></circle>',
    refresh: '<path d="M20 7v5h-5"></path><path d="M4 17v-5h5"></path><path d="M6.1 8.5a7 7 0 0 1 11.4-1.7L20 9.5M4 14.5l2.5 2.7a7 7 0 0 0 11.4-1.7"></path>',
  };

  const state = {
    mode: "prep",
    wave: 0,
    lives: MAX_LIVES,
    coins: 290,
    kills: 0,
    selectedTowerId: null,
    buildCellId: null,
    focusedEnemyId: null,
    time: 0,
    spawnQueue: [],
    waveElapsed: 0,
    autoStartRemaining: 0,
    autoStartActive: false,
    countdownSecond: null,
    betweenWaves: false,
    upgradePending: false,
    upgradePanelMinimized: false,
    selectingUpgradeTarget: false,
    currentChoices: [],
    waveRefreshCharges: WAVE_REFRESH_CHARGES,
    bonusRefreshCharges: 0,
    selectedAffixId: null,
    upgradeTargetId: null,
    lastTime: 0,
    runActive: true,
    soundEnabled: true,
    paused: false,
    speed: 1,
    bannerTimer: null,
    toastTimer: null,
    ambienceSeed: 71,
  };

  let audioContext = null;
  let towers = [];
  let enemies = [];
  let projectiles = [];
  let particles = [];
  let splashWaves = [];
  let floatingTexts = [];
  let decorations = [];
  let towerSequence = 1;
  let nextEnemyId = 1;

  function getTowerCost(typeKey = "sentry") {
    const typeCount = towers.filter((tower) => tower.type === typeKey).length;
    return TOWER_BASE_COST + typeCount * TOWER_COST_STEP;
  }

  function getRefreshCharges() {
    return state.waveRefreshCharges + state.bonusRefreshCharges;
  }

  function spendRefreshCharge() {
    if (state.waveRefreshCharges > 0) {
      state.waveRefreshCharges -= 1;
    } else if (state.bonusRefreshCharges > 0) {
      state.bonusRefreshCharges -= 1;
    }
  }

  function getWaveHealthScale(wave) {
    const completedWaves = Math.max(0, wave - 1);
    return (
      1 +
      completedWaves * WAVE_HEALTH_LINEAR_GROWTH +
      completedWaves ** 2 * WAVE_HEALTH_QUADRATIC_GROWTH
    );
  }

  function seededRandom(seed) {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  function makeDecorations() {
    decorations = [];
    const seedBase = 411;
    buildableCells.forEach((cell, i) => {
      if (seededRandom(seedBase + i * 1.73) > 0.28) return;
      const x = cell.x + (seededRandom(seedBase + i * 2.91) - 0.5) * CELL_SIZE * 0.46;
      const y = cell.y + (seededRandom(seedBase + i * 4.17) - 0.5) * CELL_SIZE * 0.4;
      const typeRoll = seededRandom(seedBase + i * 5.47);
      const type = typeRoll < 0.68 ? "flower" : typeRoll < 0.84 ? "stone" : "sprout";
      decorations.push({
        x,
        y,
        type,
        size: 3 + seededRandom(seedBase + i * 8.12) * 5,
        color:
          typeRoll < 0.28
            ? "#f6c95b"
            : typeRoll < 0.48
              ? "#f1a56f"
              : typeRoll < 0.68
                ? "#f5efe0"
                : "#7ab66d",
        phase: seededRandom(seedBase + i * 3.33) * Math.PI * 2,
      });
    });
  }

  function resetGame() {
    towers = [];
    enemies = [];
    projectiles = [];
    particles = [];
    splashWaves = [];
    floatingTexts = [];
    towerSequence = 1;
    nextEnemyId = 1;
    Object.assign(state, {
      mode: "prep",
      wave: 0,
      lives: MAX_LIVES,
      coins: 290,
      kills: 0,
      selectedTowerId: null,
      buildCellId: null,
      focusedEnemyId: null,
      time: 0,
      spawnQueue: [],
      waveElapsed: 0,
      autoStartRemaining: 0,
      autoStartActive: false,
      countdownSecond: null,
      betweenWaves: false,
      upgradePending: false,
      upgradePanelMinimized: false,
      selectingUpgradeTarget: false,
      currentChoices: [],
      waveRefreshCharges: WAVE_REFRESH_CHARGES,
      bonusRefreshCharges: 0,
      selectedAffixId: null,
      upgradeTargetId: null,
      lastTime: performance.now(),
      runActive: true,
      paused: false,
      speed: 1,
      ambienceSeed: 71,
    });
    makeDecorations();
    closeModal(ui.upgradeModal);
    updateUI();
  }

  function addTower(cellId, free = false, typeKey = "sentry") {
    const cell = buildableCells.find((candidate) => candidate.id === cellId);
    if (!cell) return null;
    const towerType = towerTypes[typeKey] || towerTypes.sentry;
    const tower = {
      id: `tower-${towerSequence}`,
      type: towerType.key,
      typeName: towerType.name,
      cellId,
      x: cell.x,
      y: cell.y,
      angle: 0.35,
      damage: towerType.damage,
      range: towerType.range,
      interval: towerType.interval,
      projectileSpeed: towerType.projectileSpeed,
      projectileColor: towerType.projectileColor,
      muzzleColor: towerType.muzzleColor,
      cooldown: 0.15,
      critChance: 0.05,
      pierceChance: 0,
      critSplashRadius: 0,
      killBonus: 0,
      finisher: 0,
      frostSlowFactor: towerType.frostSlowFactor,
      freezeOnSlowed: false,
      prioritizeUnfrozen: false,
      level: 1,
      upgrades: [],
      upgradeIds: [],
      kills: 0,
      damageDealt: 0,
      recoil: 0,
      targetId: null,
      builtAt: state.time,
      free,
    };
    towerSequence += 1;
    towers.push(tower);
    state.selectedTowerId = tower.id;
    return tower;
  }

  function getTower(id) {
    return towers.find((tower) => tower.id === id);
  }

  function isCellOccupied(cellId) {
    return towers.some((tower) => tower.cellId === cellId);
  }

  function getBuildCell() {
    return state.buildCellId ? cellsById.get(state.buildCellId) || null : null;
  }

  function canUseBuildTools() {
    if (state.mode === "ended") return false;
    if (!state.upgradePending) return true;
    return state.upgradePanelMinimized && !state.selectingUpgradeTarget;
  }

  function updateTowerPickerState() {
    const canShow = Boolean(state.buildCellId) && canUseBuildTools();
    if (!canShow) {
      if (state.buildCellId) state.buildCellId = null;
      ui.towerPicker.hidden = true;
      ui.towerPicker.classList.remove("is-unaffordable");
      return;
    }

    let hasAffordableTower = false;
    let lowestShortfall = Infinity;
    ui.towerBuildButtons.forEach((button) => {
      const towerCost = getTowerCost(button.dataset.towerType);
      const shortfall = towerCost - state.coins;
      const price = button.querySelector("[data-tower-price]");
      if (price) price.textContent = String(towerCost);
      button.disabled = shortfall > 0;
      if (shortfall <= 0) {
        hasAffordableTower = true;
      } else {
        lowestShortfall = Math.min(lowestShortfall, shortfall);
      }
    });
    ui.towerPicker.hidden = false;
    ui.towerPicker.classList.toggle("is-unaffordable", !hasAffordableTower);
    ui.towerPickerNote.textContent = hasAffordableTower
      ? "点击可建造的炮塔完成部署"
      : `金币不足，最低还差 ${lowestShortfall} 金币`;
  }

  function positionTowerPicker() {
    const cell = getBuildCell();
    if (!cell || ui.towerPicker.hidden) return;

    const frameRect = canvasFrame.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const cellTop =
      canvasRect.top -
      frameRect.top +
      ((GRID_ORIGIN_Y + cell.row * CELL_SIZE) / HEIGHT) * canvasRect.height;
    const cellBottom = cellTop + (CELL_SIZE / HEIGHT) * canvasRect.height;
    const cellCenterX =
      canvasRect.left -
      frameRect.left +
      (cell.x / WIDTH) * canvasRect.width;
    const panelWidth = ui.towerPicker.offsetWidth;
    const panelHeight = ui.towerPicker.offsetHeight;
    const inset = 8;
    const gap = 12;
    const spaceAbove = cellTop - gap - inset;
    const spaceBelow = frameRect.height - cellBottom - gap - inset;
    const placeAbove =
      spaceAbove >= panelHeight || (spaceBelow < panelHeight && spaceAbove >= spaceBelow);
    const preferredTop = placeAbove ? cellTop - gap - panelHeight : cellBottom + gap;
    const maxTop = Math.max(inset, frameRect.height - panelHeight - inset);
    const top = Math.max(inset, Math.min(maxTop, preferredTop));
    const maxLeft = Math.max(inset, frameRect.width - panelWidth - inset);
    const left = Math.max(inset, Math.min(maxLeft, cellCenterX - panelWidth / 2));
    const arrowLeft = Math.max(14, Math.min(panelWidth - 14, cellCenterX - left));

    ui.towerPicker.style.top = `${Math.round(top)}px`;
    ui.towerPicker.style.left = `${Math.round(left)}px`;
    ui.towerPicker.style.setProperty("--arrow-left", `${Math.round(arrowLeft)}px`);
    ui.towerPicker.classList.toggle("is-above", placeAbove);
    ui.towerPicker.classList.toggle("is-below", !placeAbove);
  }

  function openTowerPicker(cellId) {
    if (state.buildCellId) {
      closeTowerPicker();
      return;
    }

    const cell = cellsById.get(cellId);
    if (
      !cell ||
      !canUseBuildTools() ||
      pathCellKeys.has(cellId) ||
      isCellOccupied(cellId)
    ) {
      return;
    }

    state.focusedEnemyId = null;
    state.selectedTowerId = null;
    state.buildCellId = cellId;
    ui.towerPicker.style.visibility = "hidden";
    updateUI();
    positionTowerPicker();
    ui.towerPicker.style.visibility = "";
    playSound("open");
  }

  function closeTowerPicker(shouldUpdate = true) {
    if (!state.buildCellId) {
      ui.towerPicker.hidden = true;
      return;
    }
    state.buildCellId = null;
    ui.towerPicker.hidden = true;
    ui.towerPicker.classList.remove("is-above", "is-below", "is-unaffordable");
    ui.towerPicker.style.removeProperty("visibility");
    if (shouldUpdate) updateUI();
  }

  function placeTower(cellId, typeKey = "sentry") {
    if (state.buildCellId !== cellId) return;
    const towerType = towerTypes[typeKey];
    if (!towerType) return;
    const towerCost = getTowerCost(towerType.key);
    const cell = buildableCells.find((candidate) => candidate.id === cellId);
    if (!cell) {
      showToast("这里不能建造");
      playSound("error");
      return;
    }
    if (isCellOccupied(cellId)) {
      showToast("这个格子已经有守卫了");
      playSound("error");
      return;
    }
    if (state.coins < towerCost) {
      showToast("金币不足，无法建造");
      closeTowerPicker();
      playSound("error");
      return;
    }

    state.coins -= towerCost;
    const tower = addTower(cellId, false, towerType.key);
    closeTowerPicker(false);
    burst(tower.x, tower.y, "#b9e38c", 14, 80);
    floatingTexts.push({
      x: tower.x,
      y: tower.y - 30,
      text: `-${towerCost}`,
      color: "#f4ce58",
      life: 0.9,
      maxLife: 0.9,
    });
    showToast(`${tower.typeName}部署完成`);
    playSound("build");
    updateUI();
  }

  function startNextWave() {
    if (state.mode !== "prep" || state.upgradePending) return;
    closeModal(ui.upgradeModal);
    state.autoStartActive = false;
    state.autoStartRemaining = 0;
    state.countdownSecond = null;
    state.betweenWaves = false;
    state.upgradePending = false;
    state.upgradePanelMinimized = false;
    state.selectingUpgradeTarget = false;
    state.currentChoices = [];
    state.selectedAffixId = null;
    state.upgradeTargetId = null;
    state.paused = false;
    state.wave += 1;
    state.mode = "wave";
    closeTowerPicker(false);
    state.focusedEnemyId = null;
    state.spawnQueue = buildWaveQueue(state.wave);
    state.waveElapsed = 0;
    showWaveBanner(state.wave);
    updateUI();
    playSound("wave");
  }

  function beginAutoStartCountdown() {
    if (state.mode !== "prep" || state.upgradePending) return;
    state.autoStartActive = true;
    state.autoStartRemaining = AUTO_START_DELAY;
    state.countdownSecond = null;
    updateUI();
  }

  function buildWaveQueue(wave) {
    const plan = getWavePlan(wave);
    const sequence = [];
    Object.entries(plan).forEach(([type, count]) => {
      for (let i = 0; i < count; i += 1) {
        sequence.push(type);
      }
    });

    if (wave > 1) {
      for (let i = sequence.length - 1; i > 0; i -= 1) {
        const roll = seededRandom(state.ambienceSeed + wave * 97 + i * 5.17);
        const target = Math.floor(roll * (i + 1));
        [sequence[i], sequence[target]] = [sequence[target], sequence[i]];
      }
    }

    const queue = [];
    const minGroupSize = wave <= 2 ? 2 : wave <= 5 ? 3 : 4;
    const maxGroupSize = wave <= 2 ? 3 : wave <= 5 ? 4 : 5;
    const wavePace = Math.max(0.78, 1 - (wave - 1) * 0.025);
    const memberGap = Math.max(0.1, 0.22 - (wave - 1) * 0.008);
    let groupStart = 0.35;
    let sequenceIndex = 0;

    // Enemies arrive in small squads instead of being spread into a long trickle.
    while (sequenceIndex < sequence.length) {
      const sizeRoll = seededRandom(state.ambienceSeed + wave * 211 + sequenceIndex * 7.31);
      const remaining = sequence.length - sequenceIndex;
      let groupSize = Math.min(
        remaining,
        minGroupSize + Math.floor(sizeRoll * (maxGroupSize - minGroupSize + 1)),
      );
      const trailing = remaining - groupSize;
      if (trailing > 0 && trailing < minGroupSize) {
        groupSize = remaining >= minGroupSize * 2 ? remaining - minGroupSize : remaining;
      }
      const gapRoll = seededRandom(state.ambienceSeed + wave * 307 + sequenceIndex * 11.73);
      const squadGap = (2.8 + gapRoll * 1.2) * wavePace;

      for (let memberIndex = 0; memberIndex < groupSize; memberIndex += 1) {
        queue.push({
          type: sequence[sequenceIndex + memberIndex],
          delay: groupStart + memberIndex * memberGap,
        });
      }

      groupStart += (groupSize - 1) * memberGap + squadGap;
      sequenceIndex += groupSize;
    }
    return queue;
  }

  function spawnEnemy(typeKey) {
    const base = enemyTypes[typeKey];
    const waveScale = getWaveHealthScale(state.wave);
    const hp = Math.round(base.hp * waveScale);
    enemies.push({
      id: nextEnemyId,
      type: typeKey,
      name: base.name,
      distance: 0,
      hp,
      maxHp: hp,
      speed: base.speed * (1 + (state.wave - 1) * 0.012),
      radius: base.radius,
      reward: base.reward,
      lifeCost: base.lifeCost,
      color: base.color,
      dark: base.dark,
      eye: base.eye,
      hitFlash: 0,
      frostSlowFactor: 1,
      frostSlowRemaining: 0,
      freezeRemaining: 0,
      wobble: seededRandom(nextEnemyId * 2.1) * Math.PI * 2,
      dead: false,
      leaked: false,
    });
    nextEnemyId += 1;
  }

  function updateAutoStartCountdown(realDt) {
    if (state.mode !== "prep" || state.upgradePending || !state.autoStartActive) return;
    state.autoStartRemaining = Math.max(0, state.autoStartRemaining - realDt);
    const nextSecond = Math.max(0, Math.ceil(state.autoStartRemaining));
    if (nextSecond !== state.countdownSecond) {
      state.countdownSecond = nextSecond;
      updateCountdownUI();
    }
    if (state.autoStartRemaining <= 0) startNextWave();
  }

  function update(dt, realDt) {
    updateAutoStartCountdown(realDt);
    state.time += dt;
    updateParticles(dt);
    updateSplashWaves(dt);
    updateFloatingTexts(dt);

    if (state.mode === "ended") {
      return;
    }

    if (state.mode !== "wave" || state.upgradePending) {
      if (state.mode === "prep") {
        towers.forEach((tower) => {
          tower.cooldown = Math.min(tower.interval, tower.cooldown + dt);
          const target = findNearestTarget(tower);
          if (target) {
            const desired = Math.atan2(target.y - tower.y, target.x - tower.x);
            tower.angle = rotateToward(tower.angle, desired, dt * 2.8);
          }
        });
      }
      return;
    }

    state.waveElapsed += dt;
    while (
      state.spawnQueue.length > 0 &&
      state.spawnQueue[0].delay <= state.waveElapsed
    ) {
      const next = state.spawnQueue.shift();
      spawnEnemy(next.type);
    }

    ui.enemyCounter.textContent = `${enemies.length} 只怪物在场`;
    updateEnemies(dt);
    if (state.mode === "ended") return;
    updateTowers(dt);
    updateProjectiles(dt);
    handleDeaths();
    ui.enemyCounter.textContent = `${enemies.length} 只怪物在场`;

    const enemiesRemaining = enemies.length + state.spawnQueue.length;
    if (enemiesRemaining === 0) {
      finishWave();
    }
  }

  function updateEnemies(dt) {
    enemies.forEach((enemy) => {
      if (state.mode === "ended") return;
      if (enemy.dead) return;
      enemy.freezeRemaining = Math.max(0, enemy.freezeRemaining - dt);
      enemy.frostSlowRemaining = Math.max(0, enemy.frostSlowRemaining - dt);
      if (enemy.frostSlowRemaining <= 0) enemy.frostSlowFactor = 1;

      const oldDistance = enemy.distance;
      const movementMultiplier = isEnemyFrozen(enemy)
        ? 0
        : enemy.frostSlowRemaining > 0
          ? enemy.frostSlowFactor
          : 1;
      enemy.distance += enemy.speed * movementMultiplier * dt;
      enemy.distance = Math.min(enemy.distance, HOUSE_ENTRY_DISTANCE);
      enemy.wobble += dt * (enemy.type === "fast" ? 8 : 4);
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 4.5);
      updateEnemyPosition(enemy);

      if (enemy.distance >= HOUSE_ENTRY_DISTANCE) {
        enemy.leaked = true;
        enemy.dead = true;
        state.lives = Math.max(0, state.lives - enemy.lifeCost);
        updateUI();
        const end = getPointAtDistance(HOUSE_ENTRY_DISTANCE);
        floatingTexts.push({
          x: end.x,
          y: end.y - 28,
          text: `-${enemy.lifeCost} 生命`,
          color: "#f7d6ce",
          life: 1.1,
          maxLife: 1.1,
        });
        burst(end.x, end.y, "#d86458", 12, 85);
        playSound("hurt");
        shakeCanvas(6);
        if (state.lives <= 0) {
          endGame();
        }
      }

      if (enemy.distance - oldDistance > 0 && !enemy.dead) {
        addEnemyDust(enemy);
      }
    });

  }

  function updateTowers(dt) {
    towers.forEach((tower) => {
      tower.cooldown -= dt;
      tower.recoil = Math.max(0, tower.recoil - dt * 5.8);
      const target = findNearestTarget(tower);
      tower.targetId = target ? target.id : null;

      if (target) {
        const desired = Math.atan2(target.y - tower.y, target.x - tower.x);
        tower.angle = rotateToward(tower.angle, desired, dt * 8.5);
        if (tower.cooldown <= 0) {
          const coldPriorityBonus =
            tower.prioritizeUnfrozen &&
            !isEnemyFrostAffected(target);
          fireTower(tower, target);
          tower.cooldown = coldPriorityBonus
            ? tower.interval / (1 + COLD_PRIORITY_ATTACK_SPEED_BONUS)
            : tower.interval;
        }
      }
    });
  }

  function fireTower(tower, target) {
    const towerType = getTowerType(tower);
    const guaranteedCrit =
      tower.type === "frost" &&
      tower.freezeOnSlowed &&
      isEnemySlowed(target);
    const crit = guaranteedCrit || Math.random() < tower.critChance;
    const piercingShot = Math.random() < tower.pierceChance;
    let damage = tower.damage;
    if (target.hp / target.maxHp <= 0.4) damage *= 1 + tower.finisher;
    if (crit) damage *= 2;

    const muzzleX = tower.x + Math.cos(tower.angle) * 30;
    const muzzleY = tower.y + Math.sin(tower.angle) * 30;
    const directionX = Math.cos(tower.angle);
    const directionY = Math.sin(tower.angle);
    const projectileColor = crit
      ? tower.type === "frost"
        ? "#eaffff"
        : "#fff0a5"
      : piercingShot
        ? tower.type === "frost"
          ? "#8ff8ff"
          : "#78f0cf"
        : towerType.projectileColor;
    projectiles.push({
      x: muzzleX,
      y: muzzleY,
      angle: tower.angle,
      targetId: target.id,
      target,
      speed: tower.projectileSpeed,
      damage,
      crit,
      type: tower.type,
      pierceRemaining: piercingShot ? 1 : 0,
      piercing: false,
      directionX,
      directionY,
      hitEnemyIds: new Set(),
      color: projectileColor,
      trail: [],
      active: true,
      towerId: tower.id,
    });
    tower.recoil = 1;
    burst(
      muzzleX,
      muzzleY,
      crit
        ? tower.type === "frost"
          ? "#eaffff"
          : "#fff0a5"
        : piercingShot
          ? tower.type === "frost"
            ? "#8ff8ff"
            : "#78f0cf"
          : tower.muzzleColor,
      crit ? 9 : 6,
      54,
    );
    playSound(crit ? "crit" : "shoot");
  }

  function updateProjectiles(dt) {
    projectiles.forEach((projectile) => {
      if (!projectile.active) return;

      if (projectile.piercing) {
        updatePiercingProjectile(projectile, dt);
        return;
      }

      const target = projectile.target;
      if (!target || target.dead || !enemies.includes(target)) {
        moveProjectileStraight(projectile, dt);
        return;
      }
      const dx = target.x - projectile.x;
      const dy = target.y - projectile.y;
      const distance = Math.hypot(dx, dy);
      const step = projectile.speed * dt;
      if (distance <= step + target.radius) {
        const directionX =
          distance > 0.001 ? dx / distance : Math.cos(projectile.angle);
        const directionY =
          distance > 0.001 ? dy / distance : Math.sin(projectile.angle);
        applyProjectileHit(projectile, target);
        if (projectile.pierceRemaining > 0) {
          projectile.pierceRemaining -= 1;
          projectile.piercing = true;
          projectile.directionX = directionX;
          projectile.directionY = directionY;
          projectile.hitEnemyIds.add(target.id);
          projectile.target = null;
          projectile.targetId = null;
          return;
        }
        projectile.active = false;
        return;
      }
      moveProjectile(projectile, dx / distance, dy / distance, step);
    });
    projectiles = projectiles.filter((projectile) => projectile.active);
  }

  function updatePiercingProjectile(projectile, dt) {
    const startX = projectile.x;
    const startY = projectile.y;
    const travelDistance = projectile.speed * dt;
    const endX = startX + projectile.directionX * travelDistance;
    const endY = startY + projectile.directionY * travelDistance;
    const enemy = findFirstEnemyOnSegment(
      startX,
      startY,
      endX,
      endY,
      projectile.hitEnemyIds,
    );

    if (enemy) {
      projectile.hitEnemyIds.add(enemy.id);
      applyProjectileHit(projectile, enemy);
      projectile.active = false;
      return;
    }

    moveProjectile(
      projectile,
      projectile.directionX,
      projectile.directionY,
      travelDistance,
    );
  }

  function moveProjectileStraight(projectile, dt) {
    moveProjectile(
      projectile,
      projectile.directionX,
      projectile.directionY,
      projectile.speed * dt,
    );
  }

  function moveProjectile(projectile, directionX, directionY, distance) {
    projectile.directionX = directionX;
    projectile.directionY = directionY;
    projectile.angle = Math.atan2(directionY, directionX);
    projectile.trail.unshift({ x: projectile.x, y: projectile.y });
    if (projectile.trail.length > 5) projectile.trail.pop();
    projectile.x += directionX * distance;
    projectile.y += directionY * distance;
    const margin = PROJECTILE_SCREEN_MARGIN;
    if (
      projectile.x < -margin ||
      projectile.x > WIDTH + margin ||
      projectile.y < -margin ||
      projectile.y > HEIGHT + margin
    ) {
      projectile.active = false;
    }
  }

  function findFirstEnemyOnSegment(startX, startY, endX, endY, excludedIds) {
    const segmentX = endX - startX;
    const segmentY = endY - startY;
    const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;
    if (segmentLengthSquared <= 0.0001) return null;

    let closestEnemy = null;
    let closestProgress = Infinity;
    enemies.forEach((enemy) => {
      if (enemy.dead || excludedIds.has(enemy.id)) return;
      const relativeX = enemy.x - startX;
      const relativeY = enemy.y - startY;
      const progress = Math.max(
        0,
        Math.min(
          1,
          (relativeX * segmentX + relativeY * segmentY) / segmentLengthSquared,
        ),
      );
      const nearestX = startX + segmentX * progress;
      const nearestY = startY + segmentY * progress;
      const hitRadius = enemy.radius + 4;
      if (Math.hypot(enemy.x - nearestX, enemy.y - nearestY) > hitRadius) return;
      if (progress < closestProgress) {
        closestProgress = progress;
        closestEnemy = enemy;
      }
    });
    return closestEnemy;
  }

  function applyProjectileHit(projectile, enemy, applySplash = true) {
    const tower = getTower(projectile.towerId);
    applyFrostHit(tower, enemy, projectile.crit);
    if (tower) {
      tower.damageDealt += Math.max(0, Math.min(enemy.hp, projectile.damage));
    }
    enemy.hp -= projectile.damage;
    enemy.hitFlash = 1;
    const hitX = enemy.x;
    const hitY = enemy.y;
    const hitColor =
      projectile.type === "frost"
        ? projectile.crit
          ? "#eaffff"
          : "#7fe7f2"
        : projectile.crit
          ? "#fff0a5"
          : "#f0a14b";
    burst(hitX, hitY, hitColor, projectile.crit ? 14 : 8, 105);
    floatingTexts.push({
      x: hitX + (Math.random() - 0.5) * 12,
      y: hitY - enemy.radius - 6,
      text: `${Math.round(projectile.damage)}${projectile.crit ? "!" : ""}`,
      color: projectile.crit ? "#fff0a5" : "#fff9e8",
      life: 0.66,
      maxLife: 0.66,
      size: projectile.crit ? 15 : 12,
    });
    if (projectile.crit) {
      playSound("hit");
      shakeCanvas(2.5);
    }
    if (enemy.hp <= 0) {
      enemy.dead = true;
      const bonus = tower ? tower.killBonus : 0;
      const reward = Math.round(enemy.reward * (1 + bonus));
      if (tower) tower.kills += 1;
      state.coins += reward;
      state.kills += 1;
      burst(enemy.x, enemy.y, enemy.color, 18, 120);
      floatingTexts.push({
        x: enemy.x,
        y: enemy.y - 20,
        text: `+${reward}`,
        color: "#f7d363",
        life: 0.9,
        maxLife: 0.9,
      });
      playSound("pop");
      updateUI();
    } else if (tower && tower.id === state.selectedTowerId) {
      renderTowerHeadCard(tower);
    }
    if (applySplash) {
      applyCriticalSplash(projectile, hitX, hitY, enemy.id, tower);
    }
  }

  function applyFrostHit(tower, enemy, crit) {
    if (!tower || tower.type !== "frost" || !enemy) return;

    const nextSlowFactor = tower.frostSlowFactor;
    enemy.frostSlowFactor = isEnemySlowed(enemy)
      ? Math.min(enemy.frostSlowFactor, nextSlowFactor)
      : nextSlowFactor;
    enemy.frostSlowRemaining = Math.max(
      enemy.frostSlowRemaining,
      FROST_SLOW_DURATION,
    );

    if (crit) {
      enemy.freezeRemaining = Math.max(
        enemy.freezeRemaining,
        FROST_FREEZE_DURATION,
      );
    }
  }

  function applyCriticalSplash(projectile, x, y, primaryEnemyId, tower) {
    const radius = tower?.critSplashRadius || 0;
    if (!projectile.crit || radius <= 0) return;

    splashWaves.push({
      x,
      y,
      radius,
      life: 0.38,
      maxLife: 0.38,
    });
    burst(x, y, "#ef4444", 16, 178);
    burst(x, y, "#ff8a80", 9, 125);

    const splashTargets = enemies.filter(
      (enemy) =>
        enemy.id !== primaryEnemyId &&
        !enemy.dead &&
        Math.hypot(enemy.x - x, enemy.y - y) <= radius,
    );
    splashTargets.forEach((enemy) => {
      applyProjectileHit(projectile, enemy, false);
    });
  }

  function handleDeaths() {
    const dead = enemies.filter((enemy) => enemy.dead);
    if (dead.length === 0) return;
    const focusedEnemyKilled = dead.some(
      (enemy) => enemy.id === state.focusedEnemyId && !enemy.leaked,
    );
    enemies = enemies.filter((enemy) => !enemy.dead);
    if (focusedEnemyKilled) {
      state.focusedEnemyId = null;
      updateUI();
    }
  }

  function findNearestTarget(tower) {
    const focused = enemies.find(
      (enemy) => enemy.id === state.focusedEnemyId && !enemy.dead,
    );
    if (focused) {
      const focusedDistance = Math.hypot(focused.x - tower.x, focused.y - tower.y);
      if (focusedDistance <= tower.range + focused.radius * 0.25) return focused;
    }

    const candidates = enemies.filter((enemy) => {
      if (enemy.dead) return false;
      const distance = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
      return distance <= tower.range + enemy.radius * 0.25;
    });
    if (tower.prioritizeUnfrozen) {
      const unfrozenCandidates = candidates.filter(
        (enemy) => !isEnemyFrostAffected(enemy),
      );
      if (unfrozenCandidates.length > 0) {
        return unfrozenCandidates.reduce((best, enemy) =>
          enemy.distance > best.distance ? enemy : best,
        );
      }
    }

    let target = null;
    let bestProgress = -Infinity;
    candidates.forEach((enemy) => {
      if (enemy.distance > bestProgress) {
        bestProgress = enemy.distance;
        target = enemy;
      }
    });
    return target;
  }

  function finishWave() {
    if (state.mode !== "wave") return;
    if (state.upgradePending) return;
    state.mode = "prep";
    state.paused = false;
    state.focusedEnemyId = null;
    closeTowerPicker(false);
    state.betweenWaves = true;
    state.autoStartActive = false;
    state.autoStartRemaining = AUTO_START_DELAY;
    state.countdownSecond = null;
    state.spawnQueue = [];
    enemies = [];
    projectiles = [];
    state.waveRefreshCharges = WAVE_REFRESH_CHARGES;

    const choices = getRandomAffixes(3);
    if (choices.length === 0) {
      showToast("暂无可选强化，3 秒后自动开始下一波");
      beginAutoStartCountdown();
      return;
    }

    state.upgradePending = true;
    state.upgradePanelMinimized = false;
    state.selectingUpgradeTarget = false;
    state.upgradeTargetId = null;
    state.selectedTowerId = null;
    state.selectedAffixId = null;
    state.currentChoices = choices;
    playSound("clear");
    updateUI();
    window.setTimeout(openUpgradeModal, 420);
  }

  function getRandomAffixes(count) {
    const pool = affixes.filter(hasEligibleTowerForAffix);
    const result = [];
    while (result.length < count && pool.length > 0) {
      const index = Math.floor(Math.random() * pool.length);
      result.push(pool.splice(index, 1)[0]);
    }
    return result;
  }

  function towerHasAffix(tower, affixId) {
    if (!tower) return false;
    if (Array.isArray(tower.upgradeIds) && tower.upgradeIds.includes(affixId)) {
      return true;
    }
    const affix = affixes.find((candidate) => candidate.id === affixId);
    return Boolean(
      affix && Array.isArray(tower.upgrades) && tower.upgrades.includes(affix.name),
    );
  }

  function canApplyAffixToTower(affix, tower) {
    if (!affix) return false;
    if (
      affix.requiredTowerType &&
      tower &&
      tower.type !== affix.requiredTowerType
    ) {
      return false;
    }
    return !tower || !affix.unique || !towerHasAffix(tower, affix.id);
  }

  function hasEligibleTowerForAffix(affix) {
    if (!affix) return false;
    if (affix.global) return true;
    return towers.some((tower) => canApplyAffixToTower(affix, tower));
  }

  function openUpgradeModal() {
    if (
      !state.upgradePending ||
      state.selectingUpgradeTarget ||
      state.mode === "ended"
    ) {
      return;
    }
    state.upgradePanelMinimized = false;
    ui.upgradeResult.hidden = true;
    ui.upgradeTargetSection.hidden = false;
    ui.upgradeOptions.hidden = false;
    ui.upgradeLaterButton.hidden = false;
    ui.nextWaveButton.hidden = true;
    ui.nextWaveButton.disabled = true;
    ui.nextWaveButtonText.textContent = `下一波将在 ${AUTO_START_DELAY} 秒后开始`;
    renderUpgradeTargets();
    renderUpgradeOptions();
    openModal(ui.upgradeModal);
    updateUI();
    playSound("open");
  }

  function minimizeUpgradePanel() {
    if (!state.upgradePending || state.selectingUpgradeTarget) return;
    state.upgradePanelMinimized = true;
    closeTowerPicker(false);
    closeModal(ui.upgradeModal);
    updateUI();
    showToast("词条面板已收起，可点击地图上的炮塔查看属性");
    playSound("click");
  }

  function restoreUpgradePanel() {
    if (!state.upgradePending || state.selectingUpgradeTarget) return;
    openUpgradeModal();
    showToast("已展开待选词条");
  }

  function renderUpgradeTargets() {
    ui.upgradeTargets.innerHTML = "";
    ui.upgradeTargetSection.hidden = towers.length === 0;
    if (towers.length === 0) return;
    const target = getTower(state.upgradeTargetId);
    const targetIndex = target ? towers.findIndex((tower) => tower.id === target.id) : -1;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "target-picker-button";
    button.innerHTML = `
      <span class="target-picker-button__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="7"></circle>
          <circle cx="12" cy="12" r="2"></circle>
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4"></path>
        </svg>
      </span>
      <span class="target-picker-button__copy">
        <strong>${target ? "更换强化目标" : "选择强化目标"}</strong>
        <small>${
          target
            ? `${getTowerType(target).name} ${targetIndex + 1} · Lv.${target.level}`
            : "面板会暂时收起，请回到地图点击一座炮塔"
        }</small>
      </span>
      <span class="target-picker-button__action">
        地图选择
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 6 6 6-6 6"></path>
        </svg>
      </span>
    `;
    button.addEventListener("click", beginUpgradeTargetSelection);
    ui.upgradeTargets.appendChild(button);
  }

  function renderUpgradeOptions() {
    const target = getTower(state.upgradeTargetId);
    ui.upgradeOptions.innerHTML = "";
    const refreshButton = document.createElement("button");
    refreshButton.type = "button";
    refreshButton.className = "refresh-upgrade-button";
    const refreshCharges = getRefreshCharges();
    refreshButton.disabled = refreshCharges <= 0;
    refreshButton.title = refreshCharges > 0
      ? "消耗 1 次刷新机会，替换本轮三个词条"
      : "暂无刷新机会";
    refreshButton.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">${affixIcons.refresh}</svg>
      <span>刷新词条</span>
      <b>${refreshCharges}</b>
    `;
    refreshButton.addEventListener("click", refreshUpgradeChoices);
    ui.upgradeOptions.appendChild(refreshButton);

    state.currentChoices
      .filter((affix) => canApplyAffixToTower(affix, target))
      .forEach((affix) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "upgrade-card";
        button.style.setProperty("--card-accent", affix.accent);
        button.style.setProperty("--card-tint", affix.tint);
        button.innerHTML = `
          <span class="affix-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">${affixIcons[affix.icon]}</svg>
          </span>
          <span class="affix-kind">${affix.global ? "全局词条" : "词条"}</span>
          <h3>${affix.name}</h3>
          <p>${affix.description}</p>
          <span class="upgrade-card__effect">${affix.effectText(target || null)}</span>
        `;
        button.addEventListener("click", () => selectAffix(affix.id));
        ui.upgradeOptions.appendChild(button);
      });
  }

  function refreshUpgradeChoices() {
    if (
      !state.upgradePending ||
      state.selectingUpgradeTarget ||
      getRefreshCharges() <= 0
    ) {
      return;
    }
    spendRefreshCharge();
    state.selectedAffixId = null;
    state.currentChoices = getRandomAffixes(3);
    renderUpgradeOptions();
    showToast(`词条已刷新，剩余 ${getRefreshCharges()} 次`);
    playSound("click");
  }

  function selectAffix(affixId) {
    if (!state.upgradePending) return;
    const affix = state.currentChoices.find((choice) => choice.id === affixId);
    if (!affix) return;

    state.selectedAffixId = affixId;
    if (affix.global) {
      applyUpgradeAffix(affixId);
      return;
    }
    if (!getTower(state.upgradeTargetId)) {
      beginUpgradeTargetSelection();
      return;
    }
    applyUpgradeAffix(affixId);
  }

  function beginUpgradeTargetSelection() {
    if (!state.upgradePending || state.mode === "ended") return;
    state.upgradePanelMinimized = false;
    state.selectingUpgradeTarget = true;
    state.focusedEnemyId = null;
    closeTowerPicker(false);
    closeModal(ui.upgradeModal);
    updateUI();
    showToast(
      state.selectedAffixId
        ? "词条已暂存，请在地图上点击一座炮塔"
        : "请在地图上点击一座炮塔",
    );
    playSound("open");
  }

  function cancelUpgradeTargetSelection() {
    if (!state.selectingUpgradeTarget) return;
    const hadSelectedAffix = Boolean(state.selectedAffixId);
    state.selectingUpgradeTarget = false;
    state.selectedAffixId = null;
    updateUI();
    openUpgradeModal();
    showToast(hadSelectedAffix ? "已撤回词条，请重新选择" : "已返回强化面板");
    playSound("click");
  }

  function chooseUpgradeTarget(tower) {
    if (!state.selectingUpgradeTarget || !state.upgradePending) return;
    const selectedAffix = state.currentChoices.find(
      (affix) => affix.id === state.selectedAffixId,
    );
    if (selectedAffix && !canApplyAffixToTower(selectedAffix, tower)) {
      showToast(
        selectedAffix.requiredTowerType &&
          tower.type !== selectedAffix.requiredTowerType
          ? `该词条仅能装配到${towerTypes[selectedAffix.requiredTowerType].name}`
          : "该炮塔已经拥有这个唯一词条，请选择其他炮塔",
      );
      playSound("error");
      return;
    }
    state.upgradeTargetId = tower.id;
    state.selectedTowerId = tower.id;
    state.selectingUpgradeTarget = false;

    if (state.selectedAffixId) {
      applyUpgradeAffix(state.selectedAffixId);
      return;
    }

    updateUI();
    openUpgradeModal();
    showToast("强化目标已锁定");
    playSound("click");
  }

  function applyUpgradeAffix(affixId) {
    if (!state.upgradePending) return;
    const affix = state.currentChoices.find((choice) => choice.id === affixId);
    const target = getTower(state.upgradeTargetId);
    if (!affix || (!target && !affix.global)) return;

    state.selectedAffixId = affixId;
    let resultTitle;
    let resultCopy;
    let upgradedTarget = target;

    if (affix.global) {
      const previousCharges = getRefreshCharges();
      affix.apply(null);
      upgradedTarget = null;
      resultTitle = `${affix.name} 已生效`;
      resultCopy = `刷新机会 ${previousCharges} → ${getRefreshCharges()}`;
    } else {
      const before = captureTowerStats(target);
      affix.apply(target);
      target.level += 1;
      target.upgrades.push(affix.name);
      if (!Array.isArray(target.upgradeIds)) target.upgradeIds = [];
      target.upgradeIds.push(affix.id);
      const after = captureTowerStats(target);
      resultTitle = `${affix.name} 已装配到炮台`;
      resultCopy = describeStatChange(before, after);
    }

    ui.upgradeOptions.hidden = true;
    ui.upgradeTargetSection.hidden = true;
    ui.upgradeLaterButton.hidden = true;
    ui.nextWaveButton.hidden = false;
    ui.nextWaveButton.disabled = true;
    ui.upgradeResult.hidden = false;
    ui.resultTitle.textContent = resultTitle;
    ui.resultCopy.textContent = resultCopy;
    ui.upgradeTargets.innerHTML = "";
    state.upgradePending = false;
    state.upgradePanelMinimized = false;
    state.selectingUpgradeTarget = false;
    renderUpgradeTargets();
    openModal(ui.upgradeModal);
    beginAutoStartCountdown();
    if (upgradedTarget) burst(upgradedTarget.x, upgradedTarget.y, affix.accent, 22, 100);
    showToast(
      upgradedTarget
        ? `${affix.name} 已装配，${AUTO_START_DELAY} 秒后自动开始下一波`
        : `${affix.name} 已生效，${AUTO_START_DELAY} 秒后自动开始下一波`,
    );
    playSound("upgrade");
    updateUI();
    window.setTimeout(() => closeModal(ui.upgradeModal), 1000);
  }

  function captureTowerStats(tower) {
    return {
      damage: tower.damage,
      interval: tower.interval,
      range: tower.range,
      critChance: tower.critChance,
      killBonus: tower.killBonus,
      pierceChance: tower.pierceChance,
      critSplashRadius: tower.critSplashRadius,
      frostSlowFactor: tower.frostSlowFactor,
      freezeOnSlowed: tower.freezeOnSlowed,
      prioritizeUnfrozen: tower.prioritizeUnfrozen,
    };
  }

  function describeStatChange(before, after) {
    const changes = [];
    if (Math.abs(after.damage - before.damage) > 0.01) {
      changes.push(`伤害 ${Math.round(before.damage)} → ${Math.round(after.damage)}`);
    }
    if (Math.abs(after.interval - before.interval) > 0.001) {
      changes.push(`间隔 ${before.interval.toFixed(2)}s → ${after.interval.toFixed(2)}s`);
    }
    if (Math.abs(after.range - before.range) > 0.01) {
      changes.push(`射程 ${Math.round(before.range)} → ${Math.round(after.range)}`);
    }
    if (Math.abs(after.critChance - before.critChance) > 0.001) {
      changes.push(
        `暴击 ${Math.round(before.critChance * 100)}% → ${Math.round(after.critChance * 100)}%`,
      );
    }
    if (Math.abs(after.killBonus - before.killBonus) > 0.001) {
      changes.push(
        `击杀金币 ${Math.round(before.killBonus * 100)}% → ${Math.round(after.killBonus * 100)}%`,
      );
    }
    if (after.pierceChance > before.pierceChance) {
      changes.push(
        `穿透概率 ${Math.round(before.pierceChance * 100)}% → ${Math.round(after.pierceChance * 100)}%`,
      );
    }
    if (after.critSplashRadius > before.critSplashRadius) {
      changes.push(
        `暴击范围 ${Math.round(before.critSplashRadius)} → ${Math.round(after.critSplashRadius)}`,
      );
    }
    if (after.frostSlowFactor < before.frostSlowFactor - 0.001) {
      changes.push(
        `减速 ${Math.round((1 - before.frostSlowFactor) * 100)}% → ${Math.round((1 - after.frostSlowFactor) * 100)}%`,
      );
    }
    if (after.freezeOnSlowed && !before.freezeOnSlowed) {
      changes.push("新增攻击已减速目标时必定暴击");
    }
    if (after.prioritizeUnfrozen && !before.prioritizeUnfrozen) {
      changes.push("自动索敌优先未受冰冻影响的敌人，对其攻速 +20%");
    }
    return changes.join("  ·  ") || "炮塔属性已提升";
  }

  function keepUpgradeForLater() {
    if (!state.upgradePending) return;
    state.upgradePending = false;
    state.upgradePanelMinimized = false;
    state.selectingUpgradeTarget = false;
    state.selectedAffixId = null;
    state.upgradeTargetId = null;
    state.currentChoices = [];
    closeModal(ui.upgradeModal);
    beginAutoStartCountdown();
    showToast("已跳过本次强化，3 秒后自动开始下一波");
  }

  function endGame() {
    if (state.mode === "ended") return;
    state.mode = "ended";
    state.paused = false;
    state.spawnQueue = [];
    projectiles = [];
    state.autoStartActive = false;
    state.autoStartRemaining = 0;
    state.focusedEnemyId = null;
    state.runActive = false;
    state.selectingUpgradeTarget = false;
    state.upgradePending = false;
    state.upgradePanelMinimized = false;
    state.currentChoices = [];
    state.selectedAffixId = null;
    state.upgradeTargetId = null;
    closeTowerPicker(false);
    closeModal(ui.upgradeModal);
    updateUI();
    playSound("defeat");
  }

  function updateUI() {
    ui.waveStat.textContent = state.wave;
    ui.lifeStat.textContent = state.lives;
    ui.houseHealth.setAttribute("aria-label", `小屋生命 ${state.lives}`);
    ui.houseHealth.classList.toggle("is-warning", state.lives <= 6 && state.lives > 3);
    ui.houseHealth.classList.toggle("is-critical", state.lives <= 3);
    ui.coinStat.textContent = state.coins;
    ui.towerCount.textContent = `${towers.length} 座`;
    ui.waveBadge.textContent = `ROUND ${state.wave} · ∞`;
    ui.enemyCounter.textContent = `${enemies.length} 只怪物在场`;
    const upgradePanelCollapsed =
      state.upgradePending &&
      state.upgradePanelMinimized &&
      !state.selectingUpgradeTarget;
    ui.upgradeUndoButton.hidden = !(
      state.upgradePending &&
      state.selectingUpgradeTarget &&
      state.selectedAffixId
    );
    ui.upgradeDockButton.hidden = !upgradePanelCollapsed;
    ui.upgradeDockButton.setAttribute("aria-expanded", String(!upgradePanelCollapsed));
    ui.upgradeHideButton.hidden =
      !state.upgradePending || state.selectingUpgradeTarget;
    ui.enemyCounter.hidden = upgradePanelCollapsed;

    if (state.mode === "wave") {
      const remaining = enemies.length + state.spawnQueue.length;
      const focusedEnemy = enemies.find(
        (enemy) => enemy.id === state.focusedEnemyId && !enemy.dead,
      );
      if (state.paused) {
        ui.stageStatus.textContent = "战斗已暂停";
        ui.waveTitle.textContent = "战斗暂停";
        ui.missionCopy.textContent = `剩余 ${remaining} 只怪物。继续战斗后会从当前进度恢复。`;
        ui.waveButtonText.textContent = "已暂停";
      } else {
        ui.stageStatus.textContent = focusedEnemy
          ? `优先攻击：${focusedEnemy.name}`
          : `第 ${state.wave} 波交战中`;
        ui.waveTitle.textContent = `第 ${state.wave} 波 · 来袭`;
        ui.missionCopy.textContent = focusedEnemy
          ? `剩余 ${remaining} 只怪物。已点击锁定目标，射程内的炮台会优先集火。`
          : `剩余 ${remaining} 只怪物。点击怪物可优先集火，点击空地取消锁定。`;
        ui.waveButtonText.textContent = "交战中";
      }
      ui.waveButton.disabled = true;
      ui.statusDot.classList.toggle("is-live", !state.paused);
    } else if (state.mode === "ended") {
      ui.stageStatus.textContent = `坚守至第 ${state.wave} 波`;
      ui.waveTitle.textContent = "小屋已失守";
      ui.missionCopy.textContent = "战场已冻结，点击右侧按钮重新开始。";
      ui.waveButton.disabled = false;
      ui.waveButtonText.textContent = "重新开始";
      ui.statusDot.classList.remove("is-live");
    } else if (state.upgradePending) {
      ui.stageStatus.textContent = state.selectingUpgradeTarget
        ? "选择强化目标"
        : state.upgradePanelMinimized
          ? "词条待选已收起"
          : "词条选择中";
      ui.waveTitle.textContent = state.selectingUpgradeTarget
        ? "回到地图选择炮塔"
        : state.upgradePanelMinimized
          ? "查看战场"
          : "炮塔强化";
      ui.missionCopy.textContent = state.selectingUpgradeTarget
        ? "点击地图上的一座炮塔完成锁定，点击空地不会建造或触发攻击。"
        : state.upgradePanelMinimized
          ? "可点击空地建造炮塔，或点击炮塔查看属性；点击上方“词条待选”继续选择强化。"
          : towers.length === 0
            ? "当前可生效的是全局词条；选择后 3 秒自动开始下一波。"
            : "先选择词条或强化目标；也可以隐藏面板后查看战场。";
      ui.waveButton.disabled = true;
      ui.waveButtonText.textContent = state.selectingUpgradeTarget
        ? "等待强化目标"
        : state.upgradePanelMinimized
          ? "词条待选"
          : "等待强化";
      ui.statusDot.classList.remove("is-live");
    } else {
      const nextWave = state.wave + 1;
      if (state.wave === 0 && !state.autoStartActive) {
        ui.stageStatus.textContent = "防线准备中";
        ui.waveTitle.textContent = "整备阶段";
        ui.missionCopy.textContent = "部署炮塔后，点击下方按钮开始第 1 波。";
        ui.waveButton.disabled = false;
        ui.waveButtonText.textContent = "开始第 1 波";
      } else if (state.paused) {
        ui.stageStatus.textContent = "整备倒计时已暂停";
        ui.waveTitle.textContent = "倒计时暂停";
        ui.missionCopy.textContent = `第 ${nextWave} 波倒计时已冻结，可以继续建造炮塔。`;
        ui.waveButton.disabled = true;
        ui.waveButtonText.textContent = "下一波倒计时已暂停";
      } else {
        ui.stageStatus.textContent = "整备倒计时";
        ui.waveTitle.textContent = "下一波来袭";
        ui.missionCopy.textContent = `第 ${nextWave} 波将在 ${AUTO_START_DELAY} 秒后自动抵达。可以继续建造炮塔。`;
        ui.waveButton.disabled = true;
        ui.waveButtonText.textContent = `第 ${nextWave} 波将在 ${AUTO_START_DELAY} 秒后开始`;
        updateCountdownUI();
      }
      ui.statusDot.classList.toggle(
        "is-live",
        state.autoStartActive && !state.upgradePending && !state.paused,
      );
    }

    ui.buildHint.textContent = state.selectingUpgradeTarget
      ? "请点击地图上的炮塔作为强化目标"
      : state.upgradePending
        ? state.upgradePanelMinimized
          ? "点击空地建造炮塔，点击炮塔查看属性"
          : towers.length === 0
            ? "请选择全局词条，或隐藏面板后部署炮塔"
            : "请选择词条或强化目标"
        : state.buildCellId
          ? "选择炮塔后将部署在当前格子"
          : "点击空闲草地选择炮塔";

    canvas.classList.toggle("is-upgrade-targeting", state.selectingUpgradeTarget);
    if (!state.selectingUpgradeTarget) {
      canvas.classList.remove("can-upgrade-target");
    }
    updatePlaybackControls();
    updateTowerPickerState();
    renderWaveTrack();
    renderTowerInspector();
    renderTowerHeadCard();
  }

  function updateCountdownUI() {
    if (state.mode !== "prep" || state.upgradePending || !state.autoStartActive) return;
    const nextWave = state.wave + 1;
    const seconds = Math.max(0, Math.ceil(state.autoStartRemaining));
    state.countdownSecond = seconds;
    if (state.paused) {
      ui.waveButtonText.textContent = "下一波倒计时已暂停";
      ui.missionCopy.textContent = `第 ${nextWave} 波倒计时已冻结，可以继续建造炮塔。`;
      if (!ui.nextWaveButton.hidden) {
        ui.nextWaveButtonText.textContent = "下一波倒计时已暂停";
      }
      return;
    }
    const countdownText =
      seconds > 0
        ? `第 ${nextWave} 波将在 ${seconds} 秒后开始`
        : `第 ${nextWave} 波正在开始`;
    ui.waveButtonText.textContent = countdownText;
    ui.missionCopy.textContent =
      seconds > 0
        ? `第 ${nextWave} 波将在 ${seconds} 秒后自动抵达。可以继续建造炮塔。`
        : `第 ${nextWave} 波正在抵达。`;
    if (!ui.nextWaveButton.hidden) {
      ui.nextWaveButtonText.textContent = countdownText;
    }
  }

  function canPauseGame() {
    if (state.upgradePending) return false;
    if (state.mode === "wave") return true;
    return (
      state.mode === "prep" &&
      state.wave > 0 &&
      state.autoStartActive
    );
  }

  function updatePlaybackControls() {
    ui.pauseButton.disabled = !canPauseGame();
    ui.pauseButton.classList.toggle("is-paused", state.paused);
    ui.pauseButton.setAttribute("aria-label", state.paused ? "继续游戏" : "暂停游戏");
    ui.pauseButton.title = state.paused ? "继续" : "暂停";

    ui.speedButtons.forEach((button) => {
      const isActive = Number(button.dataset.speed) === state.speed;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function togglePause() {
    if (!canPauseGame()) return;
    state.paused = !state.paused;
    updateUI();
    const isPrepPause = state.mode === "prep";
    if (state.paused) {
      showToast(isPrepPause ? "下一波倒计时已暂停" : "战斗已暂停");
    } else {
      showToast(isPrepPause ? "整备倒计时继续" : "战斗继续");
    }
    playSound("click");
  }

  function setSpeed(speed) {
    if (![1, 2, 4, 8].includes(speed) || state.speed === speed) return;
    state.speed = speed;
    updatePlaybackControls();
    showToast(`游戏速度 ${speed}×`);
    playSound("click");
  }

  function renderWaveTrack() {
    ui.waveTrack.innerHTML = "";
    const firstVisibleWave = Math.max(1, state.wave - WAVE_TRACK_LENGTH + 1);
    for (let offset = 0; offset < WAVE_TRACK_LENGTH; offset += 1) {
      const waveNumber = firstVisibleWave + offset;
      const pip = document.createElement("span");
      pip.className = "wave-pip";
      pip.title = `第 ${waveNumber} 波`;
      if (
        waveNumber < state.wave ||
        (waveNumber === state.wave && state.mode === "prep")
      ) {
        pip.classList.add("is-cleared");
      }
      if (waveNumber === state.wave && state.mode === "wave") {
        pip.classList.add("is-current");
      }
      ui.waveTrack.appendChild(pip);
    }
  }

  function renderTowerInspector() {
    const tower = getTower(state.selectedTowerId);
    if (!tower) {
      ui.towerInspector.hidden = true;
      ui.towerInspectorContent.innerHTML = "";
      return;
    }

    const towerIndex = towers.indexOf(tower);
    const towerType = getTowerType(tower);
    const learnedAffixes = [];
    const groupedAffixes = new Map();
    const affixIds = Array.isArray(tower.upgradeIds) ? tower.upgradeIds : [];

    if (affixIds.length > 0) {
      affixIds.forEach((affixId) => {
        const affix = affixes.find((candidate) => candidate.id === affixId);
        if (affix) learnedAffixes.push(affix);
      });
    } else {
      (tower.upgrades || []).forEach((upgradeName) => {
        const affix = affixes.find((candidate) => candidate.name === upgradeName);
        if (affix) learnedAffixes.push(affix);
      });
    }

    learnedAffixes.forEach((affix) => {
      const current = groupedAffixes.get(affix.id);
      if (current) {
        current.count += 1;
      } else {
        groupedAffixes.set(affix.id, { affix, count: 1 });
      }
    });

    const bonusEntries = [
      {
        label: "冰冻减速",
        value: 1 - tower.frostSlowFactor,
        format: (value) => `移动速度 ${Math.round((1 - value) * 100)}%`,
      },
      {
        label: "霜锁脉冲",
        value: tower.freezeOnSlowed ? 1 : 0,
        format: () => "攻击已减速目标必暴",
      },
      {
        label: "冰霜暴击",
        value: tower.type === "frost" ? 1 : 0,
        format: () => "冻结 0.4 秒",
      },
      {
        label: "冷点排序",
        value: tower.prioritizeUnfrozen ? 1 : 0,
        format: () => "未冰冻目标攻速 +20%",
      },
      {
        label: "击杀金币",
        value: tower.killBonus,
        format: (value) => `+${Math.round(value * 100)}%`,
      },
      {
        label: "残血追击",
        value: tower.finisher,
        format: (value) => `+${Math.round(value * 100)}%`,
      },
      {
        label: "暴击范围",
        value: tower.critSplashRadius || 0,
        format: (value) => `半径 ${Math.round(value)}`,
      },
    ].filter(({ value }) => value > 0.001);

    const bonusesMarkup = bonusEntries.length
      ? `
        <div class="tower-inspector__section">
          <span class="tower-inspector__label">额外效果</span>
          <div class="tower-bonus-list">
            ${bonusEntries
              .map(
                ({ label, value, format }) => `
                  <span><b>${label}</b><strong>${format(value)}</strong></span>
                `,
              )
              .join("")}
          </div>
        </div>
      `
      : "";

    const affixesMarkup = groupedAffixes.size
      ? [...groupedAffixes.values()]
          .map(
            ({ affix, count }) => `
              <div class="tower-affix-row">
                <i style="--affix-accent: ${affix.accent}"></i>
                <span>
                  <strong>${affix.name}${count > 1 ? ` ×${count}` : ""}</strong>
                  <small>${affix.effectText(tower)}</small>
                </span>
              </div>
            `,
          )
          .join("")
      : '<p class="tower-inspector__empty">尚未装配词条</p>';

    ui.towerInspectorContent.innerHTML = `
      <div class="tower-inspector__head">
        <div>
          <span class="tower-inspector__label">选中炮塔</span>
          <strong>${towerType.name} ${towerIndex + 1}</strong>
        </div>
        <span class="tower-inspector__level">Lv.${tower.level}</span>
      </div>
      <div class="tower-inspector__stats">
        <div><span>单发伤害</span><strong>${formatTowerStat(tower.damage)}</strong></div>
        <div><span>攻击间隔</span><strong>${tower.interval.toFixed(2)}s</strong></div>
        <div><span>射程</span><strong>${formatTowerStat(tower.range)}</strong></div>
        <div><span>暴击率</span><strong>${Math.round(tower.critChance * 100)}%</strong></div>
        ${
          tower.type === "frost"
            ? `<div><span>冰冻减速</span><strong>移动速度 ${Math.round(tower.frostSlowFactor * 100)}%</strong></div>`
            : ""
        }
        <div><span>击杀数</span><strong>${tower.kills || 0}</strong></div>
        <div><span>累计伤害</span><strong>${Math.round(tower.damageDealt || 0).toLocaleString("zh-CN")}</strong></div>
      </div>
      ${bonusesMarkup}
      <div class="tower-inspector__section">
        <span class="tower-inspector__label">已有词条</span>
        <div class="tower-affix-list">${affixesMarkup}</div>
      </div>
    `;
    ui.towerInspector.hidden = false;
  }

  function formatTowerStat(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function renderTowerHeadCard(tower = getTower(state.selectedTowerId)) {
    if (!tower || state.buildCellId) {
      ui.towerHeadCard.hidden = true;
      return;
    }

    const towerIndex = towers.indexOf(tower);
    const towerType = getTowerType(tower);
    ui.towerHeadCardContent.innerHTML = `
      <div class="tower-head-card__head">
        <strong>${towerType.name} ${towerIndex + 1}</strong>
        <span>Lv.${tower.level}</span>
      </div>
      <div class="tower-head-card__stats">
        <div><span>伤害</span><b>${formatTowerStat(tower.damage)}</b></div>
        <div><span>间隔</span><b>${tower.interval.toFixed(2)}s</b></div>
        <div><span>射程</span><b>${formatTowerStat(tower.range)}</b></div>
        <div><span>暴击</span><b>${Math.round(tower.critChance * 100)}%</b></div>
        ${
          tower.type === "frost"
            ? `<div><span>冰冻减速</span><b>移速 ${Math.round(tower.frostSlowFactor * 100)}%</b></div>`
            : ""
        }
        <div><span>击杀</span><b>${tower.kills || 0}</b></div>
        <div class="is-accent"><span>累计伤害</span><b>${Math.round(tower.damageDealt || 0).toLocaleString("zh-CN")}</b></div>
      </div>
    `;
    ui.towerHeadCard.hidden = false;
    positionTowerHeadCard(tower);
  }

  function positionTowerHeadCard(tower) {
    if (!tower || ui.towerHeadCard.hidden) return;
    const frameWidth = canvasFrame.clientWidth;
    const frameHeight = canvasFrame.clientHeight;
    const cardWidth = ui.towerHeadCard.offsetWidth;
    const cardHeight = ui.towerHeadCard.offsetHeight;
    const anchorX = (tower.x / WIDTH) * frameWidth;
    const anchorY = (tower.y / HEIGHT) * frameHeight;
    const edge = 8;
    const gap = 38;
    const cardLeft = Math.max(
      cardWidth / 2 + edge,
      Math.min(frameWidth - cardWidth / 2 - edge, anchorX),
    );
    const aboveTop = anchorY - cardHeight - gap;
    const belowTop = anchorY + gap;
    let cardTop;

    if (aboveTop >= edge) {
      cardTop = aboveTop;
    } else if (belowTop + cardHeight <= frameHeight - edge) {
      cardTop = belowTop;
    } else {
      cardTop = Math.max(
        edge,
        Math.min(frameHeight - cardHeight - edge, aboveTop),
      );
    }

    const arrowLeft = Math.max(
      18,
      Math.min(cardWidth - 18, anchorX - (cardLeft - cardWidth / 2)),
    );
    ui.towerHeadCard.style.left = `${cardLeft}px`;
    ui.towerHeadCard.style.top = `${cardTop}px`;
    ui.towerHeadCard.style.setProperty("--arrow-left", `${arrowLeft}px`);
    ui.towerHeadCard.classList.toggle("is-above", cardTop + cardHeight <= anchorY - 8);
    ui.towerHeadCard.classList.toggle(
      "is-below",
      cardTop >= anchorY + 8 && cardTop + cardHeight <= frameHeight - edge,
    );
    ui.towerHeadCard.classList.toggle(
      "is-near",
      !ui.towerHeadCard.classList.contains("is-above") &&
        !ui.towerHeadCard.classList.contains("is-below"),
    );
  }

  function showWaveBanner(wave) {
    const number = String(wave).padStart(2, "0");
    ui.waveBanner.querySelector("strong").textContent = number;
    ui.waveBanner.classList.remove("is-visible");
    void ui.waveBanner.offsetWidth;
    ui.waveBanner.classList.add("is-visible");
    window.clearTimeout(state.bannerTimer);
    state.bannerTimer = window.setTimeout(() => {
      ui.waveBanner.classList.remove("is-visible");
    }, 1450);
  }

  function showToast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add("is-visible");
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => {
      ui.toast.classList.remove("is-visible");
    }, 1900);
  }

  function openModal(modal) {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal(modal) {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  function updateEnemyPosition(enemy) {
    const point = getPointAtDistance(enemy.distance);
    enemy.x = point.x;
    enemy.y = point.y + Math.sin(enemy.wobble) * (enemy.type === "fast" ? 2 : 1);
    enemy.angle = point.angle;
  }

  function getPointAtDistance(distance) {
    const clamped = Math.max(0, Math.min(pathLength, distance));
    for (let i = 0; i < pathSegments.length; i += 1) {
      const segment = pathSegments[i];
      if (clamped <= segment.from + segment.length) {
        const t = (clamped - segment.from) / segment.length;
        return {
          x: segment.start.x + (segment.end.x - segment.start.x) * t,
          y: segment.start.y + (segment.end.y - segment.start.y) * t,
          angle: Math.atan2(segment.end.y - segment.start.y, segment.end.x - segment.start.x),
        };
      }
    }
    const last = pathPoints[pathPoints.length - 1];
    return { x: last.x, y: last.y, angle: 0 };
  }

  function distanceToPath(x, y) {
    let best = Infinity;
    pathSegments.forEach((segment) => {
      best = Math.min(best, pointToSegmentDistance(x, y, segment.start, segment.end));
    });
    return best;
  }

  function pointToSegmentDistance(x, y, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((x - start.x) * dx + (y - start.y) * dy) / lengthSquared));
    const px = start.x + dx * t;
    const py = start.y + dy * t;
    return Math.hypot(x - px, y - py);
  }

  function rotateToward(current, target, maxStep) {
    let difference = ((target - current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    difference = Math.max(-maxStep, Math.min(maxStep, difference));
    return current + difference;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (0.3 + Math.random() * 0.85);
      const life = 0.35 + Math.random() * 0.45;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        size: 2 + Math.random() * 4,
        color,
        life,
        maxLife: life,
        gravity: 80 + Math.random() * 90,
      });
    }
  }

  function addEnemyDust(enemy) {
    if (Math.random() > 0.08) return;
    particles.push({
      x: enemy.x - Math.cos(enemy.angle) * enemy.radius,
      y: enemy.y - Math.sin(enemy.angle) * enemy.radius,
      vx: -Math.cos(enemy.angle) * 12 + (Math.random() - 0.5) * 8,
      vy: -12 - Math.random() * 10,
      size: 2 + Math.random() * 2,
      color: enemy.type === "tank" ? "#c8bb94" : "#d7d0b3",
      life: 0.45,
      maxLife: 0.45,
      gravity: -4,
    });
  }

  function updateParticles(dt) {
    particles.forEach((particle) => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += particle.gravity * dt;
      particle.vx *= 0.985;
    });
    particles = particles.filter((particle) => particle.life > 0);
  }

  function updateSplashWaves(dt) {
    splashWaves.forEach((wave) => {
      wave.life -= dt;
    });
    splashWaves = splashWaves.filter((wave) => wave.life > 0);
  }

  function updateFloatingTexts(dt) {
    floatingTexts.forEach((text) => {
      text.life -= dt;
      text.y -= dt * 24;
    });
    floatingTexts = floatingTexts.filter((text) => text.life > 0);
  }

  let shakeAmount = 0;
  function shakeCanvas(amount) {
    shakeAmount = Math.max(shakeAmount, amount);
  }

  function render() {
    ctx.save();
    if (shakeAmount > 0.1) {
      ctx.translate((Math.random() - 0.5) * shakeAmount, (Math.random() - 0.5) * shakeAmount);
      shakeAmount *= 0.9;
    }
    drawWorld();
    drawPath();
    drawDecorations();
    drawHouse();
    drawBuildPreview();
    drawTowers();
    drawEnemies();
    drawProjectiles();
    drawSplashWaves();
    drawParticles();
    drawFloatingTexts();
    ctx.restore();
  }

  function drawWorld() {
    ctx.fillStyle = "#4e7758";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLUMNS; col += 1) {
        const x = GRID_ORIGIN_X + col * CELL_SIZE;
        const y = GRID_ORIGIN_Y + row * CELL_SIZE;
        ctx.fillStyle = (col + row) % 2 === 0 ? "#a7d481" : "#a0ce7a";
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

        const tint = seededRandom(1200 + row * GRID_COLUMNS + col) * 0.035;
        ctx.fillStyle = `rgba(255, 249, 220, ${tint})`;
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
      }
    }

    const grassShade = ctx.createLinearGradient(0, GRID_ORIGIN_Y, 0, HEIGHT - GRID_ORIGIN_Y);
    grassShade.addColorStop(0, "rgba(239, 248, 202, 0.2)");
    grassShade.addColorStop(1, "rgba(47, 112, 65, 0.12)");
    ctx.fillStyle = grassShade;
    ctx.fillRect(
      GRID_ORIGIN_X,
      GRID_ORIGIN_Y,
      GRID_COLUMNS * CELL_SIZE,
      GRID_ROWS * CELL_SIZE,
    );

    ctx.save();
    ctx.strokeStyle = "rgba(53, 104, 61, 0.2)";
    ctx.lineWidth = 1;
    for (let col = 1; col < GRID_COLUMNS; col += 1) {
      const x = GRID_ORIGIN_X + col * CELL_SIZE + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, GRID_ORIGIN_Y);
      ctx.lineTo(x, GRID_ORIGIN_Y + GRID_ROWS * CELL_SIZE);
      ctx.stroke();
    }
    for (let row = 1; row < GRID_ROWS; row += 1) {
      const y = GRID_ORIGIN_Y + row * CELL_SIZE + 0.5;
      ctx.beginPath();
      ctx.moveTo(GRID_ORIGIN_X, y);
      ctx.lineTo(GRID_ORIGIN_X + GRID_COLUMNS * CELL_SIZE, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(44, 89, 52, 0.34)";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      GRID_ORIGIN_X + 1,
      GRID_ORIGIN_Y + 1,
      GRID_COLUMNS * CELL_SIZE - 2,
      GRID_ROWS * CELL_SIZE - 2,
    );
    ctx.restore();
  }

  function drawPath() {
    ctx.save();
    pathCells.forEach((cell, index) => {
      const x = GRID_ORIGIN_X + cell.col * CELL_SIZE;
      const y = GRID_ORIGIN_Y + cell.row * CELL_SIZE;
      ctx.fillStyle = index % 2 === 0 ? "#e5d291" : "#dfca87";
      ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
      ctx.fillStyle = "rgba(255, 249, 219, 0.22)";
      ctx.fillRect(x + 4, y + 4, CELL_SIZE - 8, CELL_SIZE - 8);

      const pebble = seededRandom(3100 + cell.row * 97 + cell.col * 13);
      if (pebble > 0.44) {
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = pebble > 0.72 ? "#9a8257" : "#fff8dc";
        ctx.beginPath();
        ctx.ellipse(
          x + 14 + seededRandom(4100 + cell.col + cell.row * 5) * 23,
          y + 14 + seededRandom(5100 + cell.col * 3 + cell.row) * 23,
          2.4,
          1.2,
          pebble,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });

    ctx.strokeStyle = "rgba(109, 88, 49, 0.24)";
    ctx.lineWidth = 1;
    pathCells.forEach((cell) => {
      const x = GRID_ORIGIN_X + cell.col * CELL_SIZE;
      const y = GRID_ORIGIN_Y + cell.row * CELL_SIZE;
      ctx.strokeRect(x + 0.5, y + 0.5, CELL_SIZE - 1, CELL_SIZE - 1);
    });
    ctx.restore();
  }

  function drawDecorations() {
    decorations.forEach((item) => {
      if (item.type === "stone") {
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.fillStyle = "rgba(69, 92, 61, 0.16)";
        ctx.beginPath();
        ctx.ellipse(2, 4, item.size * 1.1, item.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#b9b89e";
        ctx.beginPath();
        ctx.ellipse(0, 0, item.size, item.size * 0.68, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      if (item.type === "sprout") {
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.strokeStyle = "#4e8d50";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, item.size);
        ctx.quadraticCurveTo(-1, 0, 0, -item.size);
        ctx.stroke();
        ctx.fillStyle = "#74aa58";
        ctx.beginPath();
        ctx.ellipse(-3, -item.size, 4, 2, -0.5, 0, Math.PI * 2);
        ctx.ellipse(3, -item.size + 2, 4, 2, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      const sway = Math.sin(state.time * 1.2 + item.phase) * 1.4;
      ctx.save();
      ctx.translate(item.x + sway, item.y);
      ctx.strokeStyle = "#4f8b4f";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, item.size + 4);
      ctx.lineTo(0, 1);
      ctx.stroke();
      for (let petal = 0; petal < 5; petal += 1) {
        const angle = (petal / 5) * Math.PI * 2;
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.ellipse(
          Math.cos(angle) * item.size * 0.65,
          Math.sin(angle) * item.size * 0.65,
          item.size * 0.55,
          item.size * 0.34,
          angle,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.fillStyle = "#f4cb54";
      ctx.beginPath();
      ctx.arc(0, 0, item.size * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawHouse() {
    const { x, y } = getCellCenter(HOUSE_CELL.col, HOUSE_CELL.row);
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = "rgba(37, 73, 42, 0.25)";
    ctx.beginPath();
    ctx.ellipse(3, 30, 54, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#b9a578";
    ctx.strokeStyle = "#756244";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-39, 27, 78, 10, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#9a5339";
    ctx.strokeStyle = "#613b2d";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(19, -42, 14, 30, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#6b4031";
    ctx.fillRect(17, -44, 18, 5);

    const wallGradient = ctx.createLinearGradient(-34, -4, 34, 31);
    wallGradient.addColorStop(0, "#f8e8c1");
    wallGradient.addColorStop(1, "#e4c991");
    ctx.fillStyle = wallGradient;
    ctx.strokeStyle = "#78583b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-34, -5, 68, 36, 4);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(126, 88, 54, 0.3)";
    ctx.lineWidth = 1.2;
    for (const lineY of [4, 13, 22]) {
      ctx.beginPath();
      ctx.moveTo(-31, lineY);
      ctx.lineTo(31, lineY);
      ctx.stroke();
    }

    ctx.fillStyle = "#76c2ca";
    ctx.strokeStyle = "#4b7273";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-22, 5, 16, 15, 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 249, 224, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-14, 6);
    ctx.lineTo(-14, 19);
    ctx.moveTo(-21, 12.5);
    ctx.lineTo(-7, 12.5);
    ctx.stroke();

    ctx.fillStyle = "#45745c";
    ctx.strokeStyle = "#674b34";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(5, 31);
    ctx.lineTo(5, 16);
    ctx.quadraticCurveTo(5, 7, 15, 7);
    ctx.quadraticCurveTo(25, 7, 25, 16);
    ctx.lineTo(25, 31);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#edc967";
    ctx.beginPath();
    ctx.arc(21, 20, 1.7, 0, Math.PI * 2);
    ctx.fill();

    const lampGlow = ctx.createRadialGradient(31, 10, 1, 31, 10, 9);
    lampGlow.addColorStop(0, "rgba(255, 220, 118, 0.7)");
    lampGlow.addColorStop(1, "rgba(255, 220, 118, 0)");
    ctx.fillStyle = lampGlow;
    ctx.beginPath();
    ctx.arc(31, 10, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f6d77d";
    ctx.strokeStyle = "#6d5134";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(31, 10, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const roofGradient = ctx.createLinearGradient(0, -49, 0, -2);
    roofGradient.addColorStop(0, "#e57a53");
    roofGradient.addColorStop(1, "#bd4f3d");
    ctx.fillStyle = roofGradient;
    ctx.strokeStyle = "#793c31";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-47, -3);
    ctx.lineTo(0, -49);
    ctx.lineTo(47, -3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 217, 177, 0.36)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i += 1) {
      const lineY = -10 - i * 10;
      const halfWidth = 39 - i * 9;
      ctx.beginPath();
      ctx.moveTo(-halfWidth, lineY);
      ctx.lineTo(halfWidth, lineY);
      ctx.stroke();
    }

    ctx.strokeStyle = "#71372e";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-47, -3);
    ctx.lineTo(47, -3);
    ctx.stroke();

    const smokeDrift = Math.sin(state.time * 1.8) * 2;
    ctx.fillStyle = "rgba(241, 240, 221, 0.34)";
    ctx.beginPath();
    ctx.arc(26 + smokeDrift, -50, 4.5, 0, Math.PI * 2);
    ctx.arc(31 + smokeDrift * 1.4, -59, 6, 0, Math.PI * 2);
    ctx.arc(25 + smokeDrift * 1.8, -69, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawTowers() {
    towers.forEach((tower) => {
      drawTower(tower);
    });
  }

  function drawTower(tower) {
    const selected =
      tower.id === state.selectedTowerId &&
      !state.buildCellId &&
      (!state.upgradePending ||
        state.selectingUpgradeTarget ||
        state.upgradePanelMinimized);
    const isFrost = tower.type === "frost";
    const palette = isFrost
      ? {
          base: "#285c67",
          baseStroke: "#173f48",
          platform: "#6fc3cc",
          hub: "#173f49",
          barrel: "#3b98a4",
          barrelStroke: "#24616b",
          barrelTip: "#c8f9fb",
          muzzle: "#ecffff",
          core: "#d8fbff",
          coreStroke: "#4b8f99",
          eye: "#163c46",
          rangeFill: "rgba(76, 191, 207, 0.11)",
          rangeStroke: "rgba(206, 250, 255, 0.86)",
        }
      : {
          base: "#315f42",
          baseStroke: "#214a32",
          platform: "#75b452",
          hub: "#2a563c",
          barrel: "#e28d35",
          barrelStroke: "#9d5627",
          barrelTip: "#f3bb5e",
          muzzle: "#ffe3a0",
          core: "#b9df78",
          coreStroke: "#4a7b45",
          eye: "#24492f",
          rangeFill: "rgba(127, 200, 107, 0.09)",
          rangeStroke: "rgba(255, 249, 232, 0.8)",
        };
    ctx.save();
    ctx.translate(tower.x, tower.y);

    if (state.selectingUpgradeTarget) {
      const pulse = 1.5 + Math.sin(state.time * 4.8) * 1.5;
      ctx.strokeStyle = "rgba(255, 242, 166, 0.92)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -state.time * 16;
      ctx.beginPath();
      ctx.arc(0, 0, 30 + pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }

    if (selected) {
      ctx.strokeStyle = palette.rangeStroke;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, tower.range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = palette.rangeFill;
      ctx.beginPath();
      ctx.arc(0, 0, tower.range, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(21, 61, 41, 0.24)";
    ctx.beginPath();
    ctx.ellipse(4, 18, 27, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.base;
    ctx.beginPath();
    ctx.arc(0, 7, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.baseStroke;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = palette.platform;
    ctx.beginPath();
    ctx.arc(0, 3, 19, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.hub;
    ctx.beginPath();
    ctx.arc(0, -1, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.rotate(tower.angle);
    const recoilOffset = -tower.recoil * 4;
    ctx.translate(recoilOffset, 0);

    ctx.fillStyle = palette.barrel;
    ctx.strokeStyle = palette.barrelStroke;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(1, -7, 29, 14, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = palette.barrelTip;
    ctx.beginPath();
    ctx.roundRect(20, -4.5, 13, 9, 3);
    ctx.fill();

    ctx.fillStyle = palette.muzzle;
    ctx.beginPath();
    ctx.arc(27, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = palette.core;
    ctx.beginPath();
    ctx.arc(0, -2, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.coreStroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = palette.eye;
    ctx.beginPath();
    ctx.arc(-2.3, -4, 1.6, 0, Math.PI * 2);
    ctx.arc(3.4, -4, 1.6, 0, Math.PI * 2);
    ctx.fill();

    if (isFrost) {
      ctx.strokeStyle = "rgba(226, 254, 255, 0.82)";
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      for (let index = 0; index < 3; index += 1) {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 4, -2 + Math.sin(angle) * 4);
        ctx.lineTo(Math.cos(angle) * 8, -2 + Math.sin(angle) * 8);
        ctx.stroke();
      }
    }

    if (tower.level > 1) {
      ctx.fillStyle = "#f5cf58";
      ctx.strokeStyle = "#8d681e";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(19, -19, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#493311";
      ctx.font = '900 9px "Microsoft YaHei UI", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tower.level, 19, -18.5);
    }

    ctx.restore();
  }

  function drawEnemies() {
    const sortedEnemies = [...enemies].sort((a, b) => a.y - b.y);
    sortedEnemies.forEach((enemy) => {
      if (enemy.type === "fast") {
        drawFastEnemy(enemy);
      } else if (enemy.type === "tank") {
        drawTankEnemy(enemy);
      } else {
        drawNormalEnemy(enemy);
      }
      drawEnemyFrostStatus(enemy);
      drawEnemyFocus(enemy);
      drawEnemyHealth(enemy);
    });
  }

  function drawEnemyFrostStatus(enemy) {
    if (!isEnemyFrostAffected(enemy)) return;

    const frozen = isEnemyFrozen(enemy);
    const deepFrozen = enemy.frostSlowFactor <= 0.65;
    const radius = enemy.radius + (frozen ? 10 : deepFrozen ? 8 : 6);
    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    ctx.shadowColor = frozen ? "#deffff" : "#8feaf6";
    ctx.shadowBlur = frozen ? 20 : deepFrozen ? 16 : 12;
    ctx.fillStyle = frozen
      ? "rgba(137, 224, 239, 0.32)"
      : deepFrozen
        ? "rgba(124, 218, 235, 0.24)"
        : "rgba(124, 218, 235, 0.16)";
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius + 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = frozen
      ? "rgba(185, 241, 250, 0.28)"
      : "rgba(163, 235, 246, 0.14)";
    ctx.beginPath();
    ctx.ellipse(
      0,
      enemy.radius * 0.55,
      radius + 7,
      Math.max(5, enemy.radius * 0.55),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    if (frozen) {
      ctx.shadowColor = "#d8fbff";
      ctx.shadowBlur = 16;
      ctx.strokeStyle = "rgba(222, 253, 255, 0.98)";
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowBlur = 8;
      ctx.fillStyle = "rgba(194, 246, 255, 0.9)";
      for (let index = 0; index < 10; index += 1) {
        const angle = (Math.PI * 2 * index) / 10;
        const innerRadius = enemy.radius + 2;
        const outerRadius = radius + 9 + (index % 2) * 2;
        ctx.beginPath();
        ctx.moveTo(
          Math.cos(angle) * innerRadius,
          Math.sin(angle) * innerRadius,
        );
        ctx.lineTo(
          Math.cos(angle - 0.11) * outerRadius,
          Math.sin(angle - 0.11) * outerRadius,
        );
        ctx.lineTo(
          Math.cos(angle + 0.11) * outerRadius,
          Math.sin(angle + 0.11) * outerRadius,
        );
        ctx.closePath();
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(241, 255, 255, 0.86)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-enemy.radius * 0.52, -enemy.radius * 0.2);
      ctx.lineTo(-enemy.radius * 0.12, -enemy.radius * 0.46);
      ctx.lineTo(enemy.radius * 0.18, -enemy.radius * 0.12);
      ctx.lineTo(enemy.radius * 0.5, -enemy.radius * 0.3);
      ctx.moveTo(-enemy.radius * 0.08, enemy.radius * 0.5);
      ctx.lineTo(enemy.radius * 0.08, enemy.radius * 0.16);
      ctx.lineTo(enemy.radius * 0.42, enemy.radius * 0.05);
      ctx.stroke();
    } else {
      ctx.shadowColor = "#8feaf6";
      ctx.shadowBlur = 12;
      ctx.strokeStyle = deepFrozen
        ? "rgba(190, 250, 255, 0.96)"
        : "rgba(166, 239, 250, 0.86)";
      ctx.lineWidth = deepFrozen ? 2.8 : 2.4;
      ctx.setLineDash([7, 4]);
      ctx.lineDashOffset = -state.time * 18;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      if (deepFrozen) {
        ctx.strokeStyle = "rgba(139, 231, 246, 0.62)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.shadowBlur = 6;
      ctx.fillStyle = "rgba(220, 251, 255, 0.92)";
      for (let index = 0; index < 6; index += 1) {
        const angle = -state.time * 0.55 + (Math.PI * 2 * index) / 6;
        const innerRadius = enemy.radius + 1;
        const outerRadius = radius + (index % 2 === 0 ? 6 : 3);
        ctx.beginPath();
        ctx.moveTo(
          Math.cos(angle - 0.09) * innerRadius,
          Math.sin(angle - 0.09) * innerRadius,
        );
        ctx.lineTo(
          Math.cos(angle) * outerRadius,
          Math.sin(angle) * outerRadius,
        );
        ctx.lineTo(
          Math.cos(angle + 0.09) * innerRadius,
          Math.sin(angle + 0.09) * innerRadius,
        );
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.shadowBlur = 0;
    const snowflakeCount = frozen ? 4 : 3;
    const snowflakeRadius = radius + (frozen ? 7 : 5);
    const snowflakeSize = frozen ? 4.4 : deepFrozen ? 3.8 : 3.2;
    for (let index = 0; index < snowflakeCount; index += 1) {
      const angle =
        state.time * (frozen ? 1.3 : 0.8) +
        (Math.PI * 2 * index) / snowflakeCount;
      drawFrostSnowflake(
        Math.cos(angle) * snowflakeRadius,
        Math.sin(angle) * snowflakeRadius,
        snowflakeSize,
        angle + Math.PI / 2,
        frozen ? "#f2ffff" : "#c5f9ff",
        frozen ? 0.96 : 0.82,
      );
    }

    ctx.restore();
  }

  function drawFrostSnowflake(x, y, size, rotation, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    for (let index = 0; index < 3; index += 1) {
      const angle = (Math.PI * index) / 3;
      const armX = Math.cos(angle) * size;
      const armY = Math.sin(angle) * size;
      ctx.beginPath();
      ctx.moveTo(-armX, -armY);
      ctx.lineTo(armX, armY);
      ctx.stroke();

      const branchX = Math.cos(angle) * size * 0.52;
      const branchY = Math.sin(angle) * size * 0.52;
      const sideX = Math.cos(angle + Math.PI / 2) * size * 0.32;
      const sideY = Math.sin(angle + Math.PI / 2) * size * 0.32;
      ctx.beginPath();
      ctx.moveTo(branchX, branchY);
      ctx.lineTo(branchX - armX * 0.22 + sideX, branchY - armY * 0.22 + sideY);
      ctx.moveTo(branchX, branchY);
      ctx.lineTo(branchX - armX * 0.22 - sideX, branchY - armY * 0.22 - sideY);
      ctx.moveTo(-branchX, -branchY);
      ctx.lineTo(-branchX + armX * 0.22 + sideX, -branchY + armY * 0.22 + sideY);
      ctx.moveTo(-branchX, -branchY);
      ctx.lineTo(-branchX + armX * 0.22 - sideX, -branchY + armY * 0.22 - sideY);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemyFocus(enemy) {
    if (enemy.id !== state.focusedEnemyId || enemy.dead) return;
    const pulse = 0.5 + Math.sin(state.time * 7) * 0.12;
    const radius = enemy.radius + 9 + pulse * 2;
    const labelY = enemy.y - enemy.radius - 29;

    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.strokeStyle = "#fff2a6";
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 5]);
    ctx.lineDashOffset = -state.time * 22;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(18, 63, 49, 0.94)";
    ctx.strokeStyle = "rgba(255, 242, 166, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-25, labelY - enemy.y - 10, 50, 17, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fff2a6";
    ctx.font = '800 10px "Microsoft YaHei UI", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("优先目标", 0, labelY - enemy.y - 1.5);
    ctx.restore();
  }

  function drawEnemyBase(enemy, shape) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.fillStyle = "rgba(32, 62, 43, 0.2)";
    ctx.beginPath();
    ctx.ellipse(3, enemy.radius * 0.75, enemy.radius * 0.9, enemy.radius * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    shape();
    if (enemy.hitFlash > 0) {
      ctx.globalCompositeOperation = "source-atop";
      ctx.globalAlpha = enemy.hitFlash * 0.72;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawNormalEnemy(enemy) {
    drawEnemyBase(enemy, () => {
      const bob = Math.sin(enemy.wobble) * 1.3;
      ctx.fillStyle = enemy.color;
      ctx.strokeStyle = enemy.dark;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-16, -17 + bob, 32, 33, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
      ctx.beginPath();
      ctx.ellipse(-6, -9 + bob, 5, 3.5, -0.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = enemy.eye;
      ctx.beginPath();
      ctx.arc(-5.5, -1 + bob, 2.4, 0, Math.PI * 2);
      ctx.arc(6, -1 + bob, 2.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = enemy.dark;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 5 + bob, 4.2, 0.15, Math.PI - 0.15);
      ctx.stroke();
    });
  }

  function drawFastEnemy(enemy) {
    ctx.save();
    ctx.globalAlpha = 0.2;
    for (let i = 1; i <= 3; i += 1) {
      const point = getPointAtDistance(Math.max(0, enemy.distance - i * 10));
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(3, enemy.radius - i * 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    drawEnemyBase(enemy, () => {
      const bob = Math.sin(enemy.wobble) * 2;
      ctx.fillStyle = enemy.color;
      ctx.strokeStyle = enemy.dark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, bob, 12, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 0.38)";
      ctx.beginPath();
      ctx.ellipse(-3.5, -8 + bob, 3.5, 5, -0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = enemy.eye;
      ctx.beginPath();
      ctx.arc(-3, -1 + bob, 1.7, 0, Math.PI * 2);
      ctx.arc(4, -1 + bob, 1.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = enemy.dark;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-5, 7 + bob);
      ctx.quadraticCurveTo(0, 9 + bob, 5, 7 + bob);
      ctx.stroke();
    });
  }

  function drawTankEnemy(enemy) {
    drawEnemyBase(enemy, () => {
      const stomp = Math.sin(enemy.wobble) * 0.7;
      ctx.fillStyle = enemy.color;
      ctx.strokeStyle = enemy.dark;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-22, -22 + stomp, 44, 43, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#a999d6";
      ctx.beginPath();
      ctx.roundRect(-15, -26 + stomp, 30, 12, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.beginPath();
      ctx.roundRect(-16, -14 + stomp, 8, 25, 3);
      ctx.fill();

      ctx.fillStyle = enemy.eye;
      ctx.beginPath();
      ctx.roundRect(-10, -4 + stomp, 7, 4, 2);
      ctx.roundRect(4, -4 + stomp, 7, 4, 2);
      ctx.fill();

      ctx.strokeStyle = enemy.dark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-7, 8 + stomp);
      ctx.lineTo(8, 8 + stomp);
      ctx.stroke();

      ctx.fillStyle = "#d9cef0";
      ctx.beginPath();
      ctx.arc(-16, -16 + stomp, 2, 0, Math.PI * 2);
      ctx.arc(16, -16 + stomp, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawEnemyHealth(enemy) {
    if (enemy.hp >= enemy.maxHp && enemy.distance < 28) return;
    const width = enemy.type === "tank" ? 42 : 31;
    const y = enemy.y - enemy.radius - 13;
    ctx.save();
    ctx.fillStyle = "rgba(24, 53, 41, 0.58)";
    ctx.beginPath();
    ctx.roundRect(enemy.x - width / 2, y, width, 5, 2.5);
    ctx.fill();
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = ratio > 0.5 ? "#8bcf62" : ratio > 0.24 ? "#f4c551" : "#e05b50";
    ctx.beginPath();
    ctx.roundRect(enemy.x - width / 2 + 1, y + 1, (width - 2) * ratio, 3, 1.5);
    ctx.fill();
    ctx.restore();
  }

  function drawProjectiles() {
    projectiles.forEach((projectile) => {
      if (projectile.type === "frost") {
        drawFrostProjectile(projectile);
        return;
      }

      const previous = projectile.trail[0];
      const directionX = previous
        ? projectile.x - previous.x
        : Math.cos(projectile.angle);
      const directionY = previous
        ? projectile.y - previous.y
        : Math.sin(projectile.angle);
      const directionLength = Math.hypot(directionX, directionY) || 1;
      const unitX = directionX / directionLength;
      const unitY = directionY / directionLength;

      projectile.trail.forEach((point, index) => {
        const alpha = (1 - index / projectile.trail.length) * 0.42;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = projectile.color;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5 - index * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      const tracerLength = projectile.crit ? 22 : 17;
      const tailX = projectile.x - unitX * tracerLength;
      const tailY = projectile.y - unitY * tracerLength;

      ctx.save();

      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(35, 28, 18, 0.62)";
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(projectile.x, projectile.y);
      ctx.stroke();

      ctx.strokeStyle = projectile.color;
      ctx.shadowColor = projectile.color;
      ctx.shadowBlur = 18;
      ctx.lineWidth = projectile.crit ? 5.5 : 4.5;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(projectile.x, projectile.y);
      ctx.stroke();

      ctx.fillStyle = projectile.color;
      ctx.shadowColor = projectile.color;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, projectile.crit ? 7 : 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fffbe8";
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, projectile.crit ? 3.2 : 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawFrostProjectile(projectile) {
    const scale = projectile.crit ? 1.22 : 1;

    projectile.trail.forEach((point, index) => {
      const alpha = (1 - index / projectile.trail.length) * 0.5;
      const size = Math.max(1.5, (4.6 - index * 0.55) * scale);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(point.x, point.y);
      ctx.rotate(projectile.angle + index * 0.42);
      ctx.fillStyle = index % 2 === 0 ? "#d8fcff" : "#7fe7f2";
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(0, -size * 0.52);
      ctx.lineTo(-size * 0.72, 0);
      ctx.lineTo(0, size * 0.52);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.rotate(projectile.angle);

    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(162, 244, 252, 0.42)";
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(-22 * scale, 0);
    ctx.lineTo(-9 * scale, 0);
    ctx.stroke();

    ctx.shadowColor = projectile.color;
    ctx.shadowBlur = projectile.crit ? 22 : 16;
    ctx.fillStyle = projectile.crit ? "#f4ffff" : "#b9faff";
    ctx.strokeStyle = "#55cbd9";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(15 * scale, 0);
    ctx.lineTo(4 * scale, -5.5 * scale);
    ctx.lineTo(-3 * scale, -4.2 * scale);
    ctx.lineTo(-13 * scale, -7 * scale);
    ctx.lineTo(-9 * scale, 0);
    ctx.lineTo(-13 * scale, 7 * scale);
    ctx.lineTo(-3 * scale, 4.2 * scale);
    ctx.lineTo(4 * scale, 5.5 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 8;
    ctx.strokeStyle = "#edffff";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-7 * scale, 0);
    ctx.lineTo(9 * scale, 0);
    ctx.moveTo(-1 * scale, -5 * scale);
    ctx.lineTo(-5 * scale, 0);
    ctx.lineTo(-1 * scale, 5 * scale);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(3.5 * scale, 0);
    ctx.lineTo(-1.5 * scale, -2.3 * scale);
    ctx.lineTo(-5 * scale, 0);
    ctx.lineTo(-1.5 * scale, 2.3 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    particles.forEach((particle) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawSplashWaves() {
    splashWaves.forEach((wave) => {
      const progress = 1 - wave.life / wave.maxLife;
      const easedProgress = 1 - (1 - progress) ** 3;
      const alpha = Math.max(0, wave.life / wave.maxLife);
      const currentRadius = Math.max(1, wave.radius * easedProgress);

      ctx.save();
      ctx.translate(wave.x, wave.y);
      ctx.globalCompositeOperation = "lighter";

      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, wave.radius);
      glow.addColorStop(0, `rgba(255, 115, 96, ${0.58 * alpha})`);
      glow.addColorStop(0.42, `rgba(244, 63, 94, ${0.3 * alpha})`);
      glow.addColorStop(0.72, `rgba(255, 72, 64, ${0.16 * alpha})`);
      glow.addColorStop(1, "rgba(220, 38, 38, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, wave.radius * easedProgress, 0, Math.PI * 2);
      ctx.fill();

      const coreRadius = Math.max(0, (1 - progress) * 9);
      if (coreRadius > 0) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ff3b30";
        ctx.shadowColor = "#ff2d20";
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffe1de";
        ctx.beginPath();
        ctx.arc(0, 0, coreRadius * 0.38, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#ff4b3e";
      ctx.shadowColor = "#ef2b24";
      ctx.shadowBlur = 16;
      ctx.lineWidth = 4.8 - progress * 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = alpha * 0.92;
      ctx.strokeStyle = "#ffb0aa";
      ctx.shadowColor = "#ff4b3e";
      ctx.shadowBlur = 10;
      ctx.lineWidth = 1.8 - progress * 0.6;
      ctx.beginPath();
      ctx.arc(0, 0, currentRadius * 0.66, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = alpha * 0.95;
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ff6b5f";
      for (let index = 0; index < 12; index += 1) {
        const angle = (Math.PI * 2 * index) / 12 + progress * 0.24;
        const innerRadius = currentRadius * 0.38;
        const outerRadius = currentRadius * (index % 2 === 0 ? 1.04 : 0.82);
        ctx.beginPath();
        ctx.moveTo(
          Math.cos(angle) * innerRadius,
          Math.sin(angle) * innerRadius,
        );
        ctx.lineTo(
          Math.cos(angle) * outerRadius,
          Math.sin(angle) * outerRadius,
        );
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  function drawFloatingTexts() {
    floatingTexts.forEach((text) => {
      ctx.save();
      ctx.globalAlpha = Math.min(1, text.life / Math.min(0.3, text.maxLife));
      ctx.fillStyle = text.color;
      ctx.strokeStyle = "rgba(24, 53, 41, 0.55)";
      ctx.lineWidth = 3;
      ctx.font = `900 ${text.size || 12}px "Microsoft YaHei UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.strokeText(text.text, text.x, text.y);
      ctx.fillText(text.text, text.x, text.y);
      ctx.restore();
    });
  }

  function drawBuildPreview() {
    const cell = getBuildCell();
    if (!cell) return;

    const x = GRID_ORIGIN_X + cell.col * CELL_SIZE;
    const y = GRID_ORIGIN_Y + cell.row * CELL_SIZE;
    const pulse = 0.72 + Math.sin(state.time * 5.5) * 0.12;
    ctx.save();

    ctx.fillStyle = "rgba(127, 200, 107, 0.14)";
    ctx.strokeStyle = `rgba(255, 253, 236, ${pulse})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(cell.x, cell.y, TOWER_RANGE, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = "#fffbe8";
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 3.5, y + 3.5, CELL_SIZE - 7, CELL_SIZE - 7);
    ctx.globalAlpha = 0.64 + Math.sin(state.time * 5.5) * 0.08;
    ctx.translate(cell.x, cell.y);
    ctx.fillStyle = "#75b452";
    ctx.beginPath();
    ctx.arc(0, 3, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e28d35";
    ctx.strokeStyle = "#9d5627";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(1, -6, 26, 12, 5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function screenToCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  }

  function findCellAt(x, y) {
    const col = Math.floor((x - GRID_ORIGIN_X) / CELL_SIZE);
    const row = Math.floor((y - GRID_ORIGIN_Y) / CELL_SIZE);
    if (!isCellInsideGrid(col, row)) return null;
    return cellsById.get(getCellId(col, row)) || null;
  }

  function findTowerAt(x, y) {
    return [...towers]
      .reverse()
      .find((tower) => Math.hypot(tower.x - x, tower.y - y) <= 32);
  }

  function findEnemyAt(x, y) {
    return [...enemies]
      .reverse()
      .find(
        (enemy) =>
          !enemy.dead && Math.hypot(enemy.x - x, enemy.y - y) <= enemy.radius + 10,
      );
  }

  function handleCanvasClick(event) {
    const point = screenToCanvas(event);

    if (state.selectingUpgradeTarget) {
      const target =
        findTowerAt(point.x, point.y) ||
        (() => {
          const cell = findCellAt(point.x, point.y);
          return cell
            ? towers.find((candidate) => candidate.cellId === cell.id) || null
            : null;
        })();
      if (target) {
        chooseUpgradeTarget(target);
      } else {
        showToast("请选择一座炮塔");
        playSound("error");
      }
      return;
    }

    if (state.upgradePending && !canUseBuildTools()) return;
    const enemy = findEnemyAt(point.x, point.y);
    if (enemy && state.mode === "wave") {
      closeTowerPicker(false);
      state.selectedTowerId = null;
      state.focusedEnemyId = enemy.id;
      updateUI();
      showToast(`已锁定 ${enemy.name}`);
      playSound("click");
      return;
    }

    const tower = findTowerAt(point.x, point.y);
    if (tower) {
      closeTowerPicker(false);
      state.selectedTowerId = tower.id;
      updateUI();
      playSound("click");
      return;
    }

    if (state.mode === "ended") {
      closeTowerPicker(false);
      state.selectedTowerId = null;
      state.focusedEnemyId = null;
      updateUI();
      return;
    }

    const cell = findCellAt(point.x, point.y);
    if (!cell) {
      closeTowerPicker(false);
      const hadFocusedEnemy = state.focusedEnemyId !== null;
      state.selectedTowerId = null;
      state.focusedEnemyId = null;
      updateUI();
      if (hadFocusedEnemy) {
        showToast("已取消目标锁定");
        playSound("click");
      }
      return;
    }

    const towerInCell = towers.find((candidate) => candidate.cellId === cell.id);
    if (towerInCell) {
      closeTowerPicker(false);
      state.selectedTowerId = towerInCell.id;
      updateUI();
      playSound("click");
      return;
    }

    if (pathCellKeys.has(cell.id)) {
      closeTowerPicker(false);
      state.selectedTowerId = null;
      state.focusedEnemyId = null;
      updateUI();
      showToast("道路格不能建造");
      playSound("error");
      return;
    }

    openTowerPicker(cell.id);
  }

  function handlePointerMove(event) {
    const point = screenToCanvas(event);
    if (state.selectingUpgradeTarget) {
      const canUpgradeTarget = Boolean(findTowerAt(point.x, point.y));
      canvas.classList.remove("can-build", "can-target-enemy");
      canvas.classList.toggle("can-upgrade-target", canUpgradeTarget);
      return;
    }
    if (state.upgradePending && !canUseBuildTools()) {
      canvas.classList.remove("can-build", "can-target-enemy", "can-upgrade-target");
      canvas.classList.toggle("can-inspect-tower", Boolean(findTowerAt(point.x, point.y)));
      return;
    }
    const cell = findCellAt(point.x, point.y);
    const canBuild =
      state.mode !== "ended" &&
      Boolean(cell) &&
      !pathCellKeys.has(cell.id) &&
      !isCellOccupied(cell.id);
    canvas.classList.remove("can-upgrade-target");
    canvas.classList.toggle("can-build", canBuild);
    canvas.classList.toggle(
      "can-target-enemy",
      state.mode === "wave" && Boolean(findEnemyAt(point.x, point.y)),
    );
  }

  function handlePointerLeave() {
    canvas.classList.remove(
      "can-build",
      "can-target-enemy",
      "can-upgrade-target",
      "can-inspect-tower",
    );
  }

  function ensureAudio() {
    if (!state.soundEnabled) return null;
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      audioContext = new AudioCtx();
    }
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  }

  function tone(frequency, duration, type = "sine", volume = 0.035, delay = 0, slide = 0) {
    const audio = ensureAudio();
    if (!audio) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const now = audio.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slide) oscillator.frequency.linearRampToValueAtTime(frequency + slide, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  function playSound(name) {
    if (!state.soundEnabled) return;
    switch (name) {
      case "shoot":
        tone(270, 0.07, "triangle", 0.018, 0, -60);
        break;
      case "hit":
        tone(530, 0.1, "square", 0.02, 0, 90);
        break;
      case "crit":
        tone(760, 0.12, "triangle", 0.026, 0, 170);
        break;
      case "pop":
        tone(180, 0.09, "sine", 0.018, 0, 90);
        break;
      case "build":
        tone(280, 0.1, "triangle", 0.026);
        tone(420, 0.13, "triangle", 0.024, 0.06);
        break;
      case "upgrade":
        tone(330, 0.16, "sine", 0.03);
        tone(495, 0.18, "sine", 0.026, 0.1);
        tone(660, 0.22, "sine", 0.022, 0.2);
        break;
      case "wave":
        tone(220, 0.2, "triangle", 0.024);
        tone(330, 0.24, "triangle", 0.022, 0.16);
        break;
      case "clear":
        tone(392, 0.12, "sine", 0.022);
        tone(523, 0.16, "sine", 0.02, 0.1);
        break;
      case "hurt":
        tone(130, 0.22, "sawtooth", 0.018, 0, -35);
        break;
      case "error":
        tone(145, 0.14, "square", 0.014);
        break;
      case "open":
        tone(420, 0.1, "sine", 0.018);
        break;
      case "click":
        tone(310, 0.045, "sine", 0.012);
        break;
      case "victory":
        [392, 523, 659, 784].forEach((frequency, index) => {
          tone(frequency, 0.28, "triangle", 0.024, index * 0.12);
        });
        break;
      case "defeat":
        [260, 220, 174].forEach((frequency, index) => {
          tone(frequency, 0.32, "triangle", 0.022, index * 0.16);
        });
        break;
      default:
        break;
    }
  }

  function gameLoop(timestamp) {
    const realDt = Math.max(0, (timestamp - state.lastTime) / 1000);
    const dt = Math.min(0.035, realDt);
    state.lastTime = timestamp;
    if (!state.paused) {
      update(dt * state.speed, realDt);
    }
    render();
    window.requestAnimationFrame(gameLoop);
  }

  ui.towerPickerClose.addEventListener("click", () => {
    closeTowerPicker();
    playSound("click");
  });
  ui.towerBuildButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.buildCellId) return;
      placeTower(state.buildCellId, button.dataset.towerType);
    });
  });
  ui.upgradeHideButton.addEventListener("click", minimizeUpgradePanel);
  ui.upgradeDockButton.addEventListener("click", restoreUpgradePanel);
  ui.upgradeUndoButton.addEventListener("click", cancelUpgradeTargetSelection);
  ui.upgradeLaterButton.addEventListener("click", keepUpgradeForLater);
  ui.pauseButton.addEventListener("click", togglePause);
  ui.waveButton.addEventListener("click", () => {
    if (state.mode === "ended") {
      resetGame();
      return;
    }
    if (state.mode === "prep" && state.wave === 0 && !state.autoStartActive) {
      startNextWave();
    }
  });
  ui.speedButtons.forEach((button) => {
    button.addEventListener("click", () => setSpeed(Number(button.dataset.speed)));
  });
  ui.soundToggle.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    ui.soundToggle.classList.toggle("is-muted", !state.soundEnabled);
    ui.soundToggle.setAttribute("aria-label", state.soundEnabled ? "关闭音效" : "开启音效");
    if (state.soundEnabled) playSound("click");
  });
  canvas.addEventListener("click", handleCanvasClick);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerleave", handlePointerLeave);
  document.addEventListener("pointerdown", (event) => {
    if (!state.buildCellId) return;
    if (ui.towerPicker.contains(event.target) || canvas.contains(event.target)) return;
    closeTowerPicker();
  });
  window.addEventListener("resize", () => {
    positionTowerPicker();
    positionTowerHeadCard(getTower(state.selectedTowerId));
  });
  if ("ResizeObserver" in window) {
    new ResizeObserver(() => {
      positionTowerPicker();
      positionTowerHeadCard(getTower(state.selectedTowerId));
    }).observe(canvasFrame);
  }

  window.addEventListener("keydown", (event) => {
    const targetTag = event.target?.tagName;
    const isInteractive = ["BUTTON", "INPUT", "SELECT", "TEXTAREA", "A"].includes(targetTag);
    if (event.code === "Space") {
      if (isInteractive) return;
      if (canPauseGame()) {
        event.preventDefault();
        togglePause();
      }
    }
    if (event.key.toLowerCase() === "p") {
      event.preventDefault();
      togglePause();
    }
    if (["Digit1", "Digit2", "Digit3", "Digit4"].includes(event.code)) {
      const shortcutSpeed = { Digit1: 1, Digit2: 2, Digit3: 4, Digit4: 8 }[event.code];
      setSpeed(shortcutSpeed);
    }
    if (event.key === "Escape") {
      if (state.selectingUpgradeTarget) {
        event.preventDefault();
        cancelUpgradeTargetSelection();
        return;
      }
      if (state.buildCellId) {
        event.preventDefault();
        closeTowerPicker();
      }
    }
  });

  resetGame();
  window.requestAnimationFrame(gameLoop);
})();
