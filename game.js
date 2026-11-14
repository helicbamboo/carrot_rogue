(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const canvasFrame = document.getElementById("canvasFrame");
  const ui = {
    waveStat: document.getElementById("waveStat"),
    lifeStat: document.getElementById("lifeStat"),
    carrotHealth: document.getElementById("carrotHealth"),
    coinStat: document.getElementById("coinStat"),
    stageStatus: document.getElementById("stageStatus"),
    enemyCounter: document.getElementById("enemyCounter"),
    statusDot: document.getElementById("statusDot"),
    pauseButton: document.getElementById("pauseButton"),
    pauseOverlay: document.getElementById("pauseOverlay"),
    speedButtons: [...document.querySelectorAll(".speed-button")],
    waveTitle: document.getElementById("waveTitle"),
    waveBadge: document.getElementById("waveBadge"),
    waveTrack: document.getElementById("waveTrack"),
    missionCopy: document.getElementById("missionCopy"),
    waveButton: document.getElementById("waveButton"),
    waveButtonText: document.getElementById("waveButtonText"),
    buildHint: document.getElementById("buildHint"),
    towerList: document.getElementById("towerList"),
    towerCount: document.getElementById("towerCount"),
    towerPicker: document.getElementById("towerPicker"),
    towerPickerClose: document.getElementById("towerPickerClose"),
    towerBuildButton: document.getElementById("towerBuildButton"),
    towerPickerNote: document.getElementById("towerPickerNote"),
    waveBanner: document.getElementById("waveBanner"),
    toast: document.getElementById("toast"),
    soundToggle: document.getElementById("soundToggle"),
    upgradeModal: document.getElementById("upgradeModal"),
    upgradeTargets: document.getElementById("upgradeTargets"),
    upgradeOptions: document.getElementById("upgradeOptions"),
    upgradeResult: document.getElementById("upgradeResult"),
    resultTitle: document.getElementById("resultTitle"),
    resultCopy: document.getElementById("resultCopy"),
    upgradeLaterButton: document.getElementById("upgradeLaterButton"),
    nextWaveButton: document.getElementById("nextWaveButton"),
    nextWaveButtonText: document.getElementById("nextWaveButtonText"),
    endModal: document.getElementById("endModal"),
    endDialog: document.querySelector(".end-dialog"),
    endMark: document.getElementById("endMark"),
    endKicker: document.getElementById("endKicker"),
    endTitle: document.getElementById("endTitle"),
    endCopy: document.getElementById("endCopy"),
    endWave: document.getElementById("endWave"),
    endKills: document.getElementById("endKills"),
    endTowers: document.getElementById("endTowers"),
    restartButton: document.getElementById("restartButton"),
  };

  const WIDTH = 1000;
  const HEIGHT = 640;
  const MAX_LIVES = 10;
  const MAX_WAVES = 8;
  const TOWER_COST = 55;
  const TOWER_RANGE = 180;
  const CELL_SIZE = 50;
  const GRID_COLUMNS = 20;
  const GRID_ROWS = 12;
  const GRID_ORIGIN_X = 0;
  const GRID_ORIGIN_Y = (HEIGHT - GRID_ROWS * CELL_SIZE) / 2;
  const CARROT_CELL = { col: 18, row: 10 };
  const STARTING_TOWER_CELL = { col: 5, row: 5 };

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

  const affixes = [
    {
      id: "heavy-seed",
      name: "重型种核",
      rarity: "精良",
      description: "把每一颗种子压得更紧实，单发伤害显著提升。",
      effectText: (tower) => `伤害 +32%`,
      apply: (tower) => {
        tower.damage *= 1.32;
      },
      icon: "seed",
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
      name: "高倍藤镜",
      rarity: "普通",
      description: "枝条标尺延伸了侦测距离，射程覆盖更远弯道。",
      effectText: () => "射程 +26",
      apply: (tower) => {
        tower.range += 26;
      },
      icon: "scope",
      accent: "#b8db9f",
      tint: "rgba(127, 200, 107, 0.15)",
    },
    {
      id: "crit-lens",
      name: "露珠棱镜",
      rarity: "稀有",
      description: "凝聚晨露折射光线，命中要害时造成双倍伤害。",
      effectText: () => "暴击率 +12%",
      apply: (tower) => {
        tower.critChance = Math.min(0.65, tower.critChance + 0.12);
      },
      icon: "prism",
      accent: "#9ed8de",
      tint: "rgba(84, 169, 200, 0.15)",
    },
    {
      id: "loot-pouch",
      name: "战利品袋",
      rarity: "普通",
      description: "击败怪物时收集更多散落种子，化作额外金币。",
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
      description: "对生命低于三分之一的怪物追加一次精准追击。",
      effectText: () => "残血目标伤害 +40%",
      apply: (tower) => {
        tower.finisher += 0.4;
      },
      icon: "target",
      accent: "#e39c95",
      tint: "rgba(201, 78, 71, 0.12)",
    },
    {
      id: "steady-barrel",
      name: "稳定藤管",
      rarity: "精良",
      description: "藤蔓加固炮管，每次射击都能稳定发挥更高威力。",
      effectText: () => "伤害 +18% · 射程 +12",
      apply: (tower) => {
        tower.damage *= 1.18;
        tower.range += 12;
      },
      icon: "shield",
      accent: "#b5d3a2",
      tint: "rgba(127, 200, 107, 0.14)",
    },
    {
      id: "hunter",
      name: "猎手本能",
      rarity: "精良",
      description: "迅速捕捉轻巧目标的移动轨迹，提升对应伤害。",
      effectText: () => "对疾行怪伤害 +35%",
      apply: (tower) => {
        tower.fastBonus += 0.35;
      },
      icon: "wing",
      accent: "#f0d979",
      tint: "rgba(244, 206, 88, 0.14)",
    },
    {
      id: "armor-breaker",
      name: "裂甲尖刺",
      rarity: "精良",
      description: "尖锐种壳能撬开厚重石甲，专克迟缓的重甲怪物。",
      effectText: () => "对重甲怪伤害 +30%",
      apply: (tower) => {
        tower.tankBonus += 0.3;
      },
      icon: "armor",
      accent: "#c6b7ea",
      tint: "rgba(138, 114, 200, 0.14)",
    },
  ];

  const affixIcons = {
    seed: '<path d="M12 3c3 3 5 6 5 9a5 5 0 0 1-10 0c0-3 2-6 5-9Z"></path><path d="M9 13c2-1 4-1 6 0"></path>',
    bolt: '<path d="m13 2-8 12h6l-1 8 8-12h-6l1-8Z"></path>',
    scope: '<circle cx="12" cy="12" r="7"></circle><path d="M12 2v4M12 18v4M2 12h4M18 12h4"></path><circle cx="12" cy="12" r="2"></circle>',
    prism: '<path d="m12 3 8 15H4L12 3Z"></path><path d="M12 3v15M8 14h8"></path>',
    coin: '<circle cx="12" cy="12" r="8"></circle><path d="M9 9.5h6M9 14.5h6M12 8v8"></path>',
    target: '<circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M22 12h-3M12 22v-3M2 12h3"></path>',
    shield: '<path d="M12 3 5 6v5c0 4.2 2.8 7.6 7 10 4.2-2.4 7-5.8 7-10V6l-7-3Z"></path><path d="M12 8v7M9 11h6"></path>',
    wing: '<path d="M4 17c5-1 8-4 10-9 1 4 3 6 6 7-3 3-7 4-12 3l-4 3v-4Z"></path>',
    armor: '<path d="M12 2 5 5v6c0 5 3 8 7 11 4-3 7-6 7-11V5l-7-3Z"></path><path d="m8 9 3 3-3 3M16 9l-3 3 3 3"></path>',
  };

  const state = {
    mode: "prep",
    wave: 0,
    lives: MAX_LIVES,
    coins: 160,
    kills: 0,
    selectedTowerId: "tower-1",
    buildCellId: null,
    focusedEnemyId: null,
    time: 0,
    spawnQueue: [],
    spawnTimer: 0,
    betweenWaves: false,
    upgradePending: false,
    currentChoices: [],
    selectedAffixId: null,
    upgradeTargetId: "tower-1",
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
  let floatingTexts = [];
  let decorations = [];
  let towerSequence = 1;
  let nextEnemyId = 1;

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
    floatingTexts = [];
    towerSequence = 1;
    nextEnemyId = 1;
    Object.assign(state, {
      mode: "prep",
      wave: 0,
      lives: MAX_LIVES,
      coins: 160,
      kills: 0,
      selectedTowerId: "tower-1",
      buildCellId: null,
      focusedEnemyId: null,
      time: 0,
      spawnQueue: [],
      spawnTimer: 0,
      betweenWaves: false,
      upgradePending: false,
      currentChoices: [],
      selectedAffixId: null,
      upgradeTargetId: "tower-1",
      lastTime: performance.now(),
      runActive: true,
      paused: false,
      speed: 1,
      ambienceSeed: 71,
    });
    addTower(getCellId(STARTING_TOWER_CELL.col, STARTING_TOWER_CELL.row), true);
    makeDecorations();
    closeModal(ui.upgradeModal);
    closeModal(ui.endModal);
    ui.endDialog.classList.remove("is-defeat");
    updateUI();
  }

  function addTower(cellId, free = false) {
    const cell = buildableCells.find((candidate) => candidate.id === cellId);
    if (!cell) return null;
    const tower = {
      id: `tower-${towerSequence}`,
      cellId,
      x: cell.x,
      y: cell.y,
      angle: 0.35,
      damage: 28,
      range: TOWER_RANGE,
      interval: 0.72,
      cooldown: 0.15,
      critChance: 0.05,
      killBonus: 0,
      finisher: 0,
      fastBonus: 0,
      tankBonus: 0,
      level: 1,
      upgrades: [],
      recoil: 0,
      targetId: null,
      builtAt: state.time,
      free,
    };
    towerSequence += 1;
    towers.push(tower);
    state.selectedTowerId = tower.id;
    state.upgradeTargetId = tower.id;
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

  function updateTowerPickerState() {
    const canShow =
      Boolean(state.buildCellId) && state.mode !== "ended" && !state.upgradePending;
    if (!canShow) {
      if (state.buildCellId) state.buildCellId = null;
      ui.towerPicker.hidden = true;
      ui.towerPicker.classList.remove("is-unaffordable");
      return;
    }

    const shortfall = TOWER_COST - state.coins;
    ui.towerPicker.hidden = false;
    ui.towerPicker.classList.toggle("is-unaffordable", shortfall > 0);
    ui.towerBuildButton.disabled = shortfall > 0;
    ui.towerPickerNote.textContent =
      shortfall > 0 ? `金币不足，还差 ${shortfall} 金币` : "点击炮塔完成部署";
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
      state.mode === "ended" ||
      state.upgradePending ||
      pathCellKeys.has(cellId) ||
      isCellOccupied(cellId)
    ) {
      return;
    }

    state.focusedEnemyId = null;
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

  function placeTower(cellId) {
    if (state.buildCellId !== cellId) return;
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
    if (state.coins < TOWER_COST) {
      showToast("金币不足，无法建造");
      closeTowerPicker();
      playSound("error");
      return;
    }

    state.coins -= TOWER_COST;
    const tower = addTower(cellId);
    closeTowerPicker(false);
    burst(tower.x, tower.y, "#b9e38c", 14, 80);
    floatingTexts.push({
      x: tower.x,
      y: tower.y - 30,
      text: `-${TOWER_COST}`,
      color: "#f4ce58",
      life: 0.9,
      maxLife: 0.9,
    });
    showToast("种子炮台部署完成");
    playSound("build");
    updateUI();
  }

  function startNextWave() {
    if (state.mode === "ended" || state.upgradePending) return;
    if (state.wave >= MAX_WAVES) return;
    closeModal(ui.upgradeModal);
    state.betweenWaves = false;
    state.upgradePending = false;
    state.paused = false;
    state.wave += 1;
    state.mode = "wave";
    closeTowerPicker(false);
    state.focusedEnemyId = null;
    state.spawnQueue = buildWaveQueue(state.wave);
    state.spawnTimer = 0.35;
    showWaveBanner(state.wave);
    updateUI();
    playSound("wave");
  }

  function buildWaveQueue(wave) {
    const plan = wavePlans[wave - 1];
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
    let accumulated = 0;
    sequence.forEach((type, index) => {
      const baseGap = type === "tank" ? 1.1 : type === "fast" ? 0.56 : 0.75;
      const wavePace = Math.max(0.72, 1 - (wave - 1) * 0.035);
      accumulated += baseGap * wavePace;
      const clusterGap = index > 0 && index % 6 === 0 ? 0.75 : 0;
      queue.push({ type, delay: accumulated + clusterGap });
    });
    return queue;
  }

  function spawnEnemy(typeKey) {
    const base = enemyTypes[typeKey];
    const waveScale = 1 + (state.wave - 1) * 0.175;
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
      wobble: seededRandom(nextEnemyId * 2.1) * Math.PI * 2,
      dead: false,
      leaked: false,
    });
    nextEnemyId += 1;
  }

  function update(dt) {
    state.time += dt;
    updateParticles(dt);
    updateFloatingTexts(dt);

    if (state.mode !== "wave" || state.upgradePending || state.mode === "ended") {
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

    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      while (state.spawnQueue.length > 0 && state.spawnTimer <= 0) {
        const next = state.spawnQueue.shift();
        state.spawnTimer += Math.max(0.3, next.delay - 0.22);
        spawnEnemy(next.type);
      }
    }

    ui.enemyCounter.textContent = `${enemies.length} 只怪物在场`;
    updateEnemies(dt);
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
      if (enemy.dead) return;
      const oldDistance = enemy.distance;
      enemy.distance += enemy.speed * dt;
      enemy.wobble += dt * (enemy.type === "fast" ? 8 : 4);
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 4.5);
      updateEnemyPosition(enemy);

      if (enemy.distance >= pathLength) {
        enemy.leaked = true;
        enemy.dead = true;
        state.lives = Math.max(0, state.lives - enemy.lifeCost);
        const end = getPointAtDistance(pathLength - 10);
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
          endGame(false);
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
          fireTower(tower, target);
          tower.cooldown = tower.interval;
        }
      }
    });
  }

  function fireTower(tower, target) {
    const crit = Math.random() < tower.critChance;
    let damage = tower.damage;
    if (target.type === "fast") damage *= 1 + tower.fastBonus;
    if (target.type === "tank") damage *= 1 + tower.tankBonus;
    if (target.hp / target.maxHp <= 0.34) damage *= 1 + tower.finisher;
    if (crit) damage *= 2;

    const muzzleX = tower.x + Math.cos(tower.angle) * 30;
    const muzzleY = tower.y + Math.sin(tower.angle) * 30;
    projectiles.push({
      x: muzzleX,
      y: muzzleY,
      targetId: target.id,
      target,
      speed: 520,
      damage,
      crit,
      color: crit ? "#fff0a5" : "#f4a33e",
      trail: [],
      life: 2,
      towerId: tower.id,
    });
    tower.recoil = 1;
    burst(muzzleX, muzzleY, crit ? "#fff0a5" : "#f3b55d", crit ? 7 : 4, 42);
    playSound(crit ? "crit" : "shoot");
  }

  function updateProjectiles(dt) {
    projectiles.forEach((projectile) => {
      projectile.life -= dt;
      const target = projectile.target;
      if (!target || target.dead || !enemies.includes(target)) {
        projectile.life = 0;
        return;
      }
      const dx = target.x - projectile.x;
      const dy = target.y - projectile.y;
      const distance = Math.hypot(dx, dy);
      const step = projectile.speed * dt;
      if (distance <= step + target.radius) {
        projectile.life = 0;
        applyProjectileHit(projectile, target);
        return;
      }
      projectile.trail.unshift({ x: projectile.x, y: projectile.y });
      if (projectile.trail.length > 5) projectile.trail.pop();
      projectile.x += (dx / distance) * step;
      projectile.y += (dy / distance) * step;
    });
    projectiles = projectiles.filter((projectile) => projectile.life > 0);
  }

  function applyProjectileHit(projectile, enemy) {
    enemy.hp -= projectile.damage;
    enemy.hitFlash = 1;
    const hitX = enemy.x;
    const hitY = enemy.y;
    burst(hitX, hitY, projectile.crit ? "#fff0a5" : "#f0a14b", projectile.crit ? 14 : 8, 105);
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
      const tower = getTower(projectile.towerId);
      const bonus = tower ? tower.killBonus : 0;
      const reward = Math.round(enemy.reward * (1 + bonus));
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
    }
  }

  function handleDeaths() {
    const dead = enemies.filter((enemy) => enemy.dead);
    if (dead.length === 0) return;
    const focusedEnemyKilled = dead.some(
      (enemy) => enemy.id === state.focusedEnemyId && !enemy.leaked,
    );
    enemies = enemies.filter((enemy) => !enemy.dead);
    projectiles = projectiles.filter((projectile) => !projectile.target?.dead);
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

    let target = null;
    let bestProgress = -Infinity;
    enemies.forEach((enemy) => {
      if (enemy.dead) return;
      const dist = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
      if (dist <= tower.range + enemy.radius * 0.25 && enemy.distance > bestProgress) {
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
    state.spawnQueue = [];
    enemies = [];
    projectiles = [];
    addWaveCompletionBonus();

    if (state.wave >= MAX_WAVES) {
      window.setTimeout(() => endGame(true), 650);
      return;
    }

    if (towers.length === 0) {
      showToast("没有炮塔可强化，直接进入整备阶段");
      updateUI();
      return;
    }

    state.upgradePending = true;
    state.upgradeTargetId = towers.some((tower) => tower.id === state.selectedTowerId)
      ? state.selectedTowerId
      : towers[0].id;
    state.selectedAffixId = null;
    state.currentChoices = getRandomAffixes(3);
    playSound("clear");
    updateUI();
    window.setTimeout(openUpgradeModal, 420);
  }

  function addWaveCompletionBonus() {
    const bonus = 15 + state.wave * 3;
    state.coins += bonus;
    floatingTexts.push({
      x: WIDTH - 125,
      y: 500,
      text: `波次奖励 +${bonus}`,
      color: "#f7d363",
      life: 1.75,
      maxLife: 1.75,
      size: 17,
    });
  }

  function getRandomAffixes(count) {
    const pool = [...affixes];
    const result = [];
    while (result.length < count && pool.length > 0) {
      const index = Math.floor(Math.random() * pool.length);
      result.push(pool.splice(index, 1)[0]);
    }
    return result;
  }

  function openUpgradeModal() {
    if (!state.upgradePending || state.mode === "ended") return;
    state.selectedAffixId = null;
    ui.upgradeResult.hidden = true;
    ui.upgradeOptions.hidden = false;
    ui.upgradeLaterButton.hidden = false;
    ui.nextWaveButton.hidden = true;
    ui.nextWaveButtonText.textContent = `开始第 ${state.wave + 1} 波`;
    renderUpgradeTargets();
    renderUpgradeOptions();
    openModal(ui.upgradeModal);
    playSound("open");
  }

  function renderUpgradeTargets() {
    ui.upgradeTargets.innerHTML = "";
    towers.forEach((tower, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `target-chip${tower.id === state.upgradeTargetId ? " is-selected" : ""}`;
      button.textContent = `炮台 ${index + 1} · Lv.${tower.level}`;
      button.addEventListener("click", () => {
        state.upgradeTargetId = tower.id;
        state.selectedTowerId = tower.id;
        renderUpgradeTargets();
        renderUpgradeOptions();
        playSound("click");
      });
      ui.upgradeTargets.appendChild(button);
    });
  }

  function renderUpgradeOptions() {
    const target = getTower(state.upgradeTargetId);
    if (!target) return;
    ui.upgradeOptions.innerHTML = "";
    state.currentChoices.forEach((affix) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "upgrade-card";
      button.style.setProperty("--card-accent", affix.accent);
      button.style.setProperty("--card-tint", affix.tint);
      button.innerHTML = `
        <span class="affix-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">${affixIcons[affix.icon]}</svg>
        </span>
        <span class="affix-rarity">${affix.rarity} 词条</span>
        <h3>${affix.name}</h3>
        <p>${affix.description}</p>
        <span class="upgrade-card__effect">${affix.effectText(target)}</span>
      `;
      button.addEventListener("click", () => selectAffix(affix.id));
      ui.upgradeOptions.appendChild(button);
    });
  }

  function selectAffix(affixId) {
    if (state.selectedAffixId || !state.upgradePending) return;
    const affix = state.currentChoices.find((choice) => choice.id === affixId);
    const target = getTower(state.upgradeTargetId);
    if (!affix || !target) return;

    state.selectedAffixId = affixId;
    const before = captureTowerStats(target);
    affix.apply(target);
    target.level += 1;
    target.upgrades.push(affix.name);
    const after = captureTowerStats(target);

    ui.upgradeOptions.hidden = true;
    ui.upgradeLaterButton.hidden = true;
    ui.nextWaveButton.hidden = false;
    ui.upgradeResult.hidden = false;
    ui.resultTitle.textContent = `${affix.name} 已装配到炮台`;
    ui.resultCopy.textContent = describeStatChange(before, after);
    ui.nextWaveButtonText.textContent = `开始第 ${state.wave + 1} 波`;
    burst(target.x, target.y, affix.accent, 22, 100);
    playSound("upgrade");
    updateUI();
  }

  function captureTowerStats(tower) {
    return {
      damage: tower.damage,
      interval: tower.interval,
      range: tower.range,
      critChance: tower.critChance,
      killBonus: tower.killBonus,
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
    return changes.join("  ·  ") || "炮塔属性已提升";
  }

  function continueAfterUpgrade() {
    if (!state.upgradePending) return;
    state.upgradePending = false;
    closeModal(ui.upgradeModal);
    updateUI();
    startNextWave();
  }

  function keepUpgradeForLater() {
    if (!state.upgradePending) return;
    state.upgradePending = false;
    state.currentChoices = [];
    closeModal(ui.upgradeModal);
    updateUI();
    showToast("已跳过本次强化，下一波可随时开始");
  }

  function endGame(won) {
    if (state.mode === "ended") return;
    state.mode = "ended";
    state.paused = false;
    state.focusedEnemyId = null;
    state.runActive = false;
    closeTowerPicker(false);
    closeModal(ui.upgradeModal);
    ui.endDialog.classList.toggle("is-defeat", !won);
    ui.endKicker.textContent = won ? "防线战报" : "防线失守";
    ui.endTitle.textContent = won ? "萝卜守住了" : "萝卜被偷家了";
    ui.endCopy.textContent = won
      ? `你带着 ${towers.length} 座炮台穿过全部 ${MAX_WAVES} 波袭击，夜行防线完整运转。`
      : "怪物还是摸到了萝卜。调整炮塔位置与词条组合，再守一次。";
    ui.endWave.textContent = `${state.wave} / ${MAX_WAVES}`;
    ui.endKills.textContent = state.kills;
    ui.endTowers.textContent = towers.length;
    ui.endMark.textContent = "";
    updateUI();
    openModal(ui.endModal);
    playSound(won ? "victory" : "defeat");
  }

  function updateUI() {
    ui.waveStat.textContent = `${state.wave} / ${MAX_WAVES}`;
    ui.lifeStat.textContent = state.lives;
    ui.carrotHealth.setAttribute("aria-label", `萝卜生命 ${state.lives}`);
    ui.carrotHealth.classList.toggle("is-warning", state.lives <= 6 && state.lives > 3);
    ui.carrotHealth.classList.toggle("is-critical", state.lives <= 3);
    ui.coinStat.textContent = state.coins;
    ui.towerCount.textContent = `${towers.length} 座`;
    ui.waveBadge.textContent = `ROUND ${state.wave}`;
    ui.enemyCounter.textContent = `${enemies.length} 只怪物在场`;

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
      ui.stageStatus.textContent = "本次防线已结束";
      ui.waveTitle.textContent = "战斗结束";
      ui.missionCopy.textContent = "重新整备炮台，尝试守住更多波次。";
      ui.waveButton.disabled = true;
      ui.waveButtonText.textContent = "战斗结束";
      ui.statusDot.classList.remove("is-live");
    } else if (state.upgradePending) {
      ui.stageStatus.textContent = "词条选择中";
      ui.waveTitle.textContent = "波次奖励";
      ui.missionCopy.textContent = "选择一座炮塔装配本次随机词条，然后继续下一波。";
      ui.waveButton.disabled = true;
      ui.waveButtonText.textContent = "等待强化";
      ui.statusDot.classList.remove("is-live");
    } else {
      const nextWave = Math.min(state.wave + 1, MAX_WAVES);
      ui.stageStatus.textContent = state.wave > 0 ? "整备阶段" : "防线准备中";
      ui.waveTitle.textContent = state.wave > 0 ? "下一波来袭" : "整备阶段";
      ui.missionCopy.textContent =
        state.wave > 0
          ? `第 ${nextWave} 波即将抵达。可以建造炮塔或调整防线。`
          : "第 1 波即将抵达。先部署炮塔，再开始守卫萝卜。";
      ui.waveButton.disabled = false;
      ui.waveButtonText.textContent = `开始第 ${nextWave} 波`;
      ui.statusDot.classList.remove("is-live");
    }

    ui.buildHint.textContent = state.buildCellId
      ? "选择炮塔后将部署在当前格子"
      : "点击空闲草地选择炮塔";

    updatePlaybackControls();
    updateTowerPickerState();
    renderWaveTrack();
    renderTowerList();
  }

  function updatePlaybackControls() {
    ui.pauseButton.disabled = state.mode !== "wave" || state.upgradePending;
    ui.pauseButton.classList.toggle("is-paused", state.paused);
    ui.pauseButton.setAttribute("aria-label", state.paused ? "继续游戏" : "暂停游戏");
    ui.pauseButton.title = state.paused ? "继续" : "暂停";
    ui.pauseOverlay.classList.toggle("is-visible", state.paused);
    ui.pauseOverlay.setAttribute("aria-hidden", String(!state.paused));

    ui.speedButtons.forEach((button) => {
      const isActive = Number(button.dataset.speed) === state.speed;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function togglePause() {
    if (state.mode !== "wave" || state.upgradePending) return;
    state.paused = !state.paused;
    updateUI();
    showToast(state.paused ? "战斗已暂停" : "战斗继续");
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
    for (let i = 1; i <= MAX_WAVES; i += 1) {
      const pip = document.createElement("span");
      pip.className = "wave-pip";
      if (i < state.wave) pip.classList.add("is-cleared");
      if (i === state.wave && state.mode !== "prep") pip.classList.add("is-current");
      if (i === state.wave && state.mode === "prep" && state.wave > 0) {
        pip.classList.add("is-cleared");
      }
      ui.waveTrack.appendChild(pip);
    }
  }

  function renderTowerList() {
    ui.towerList.innerHTML = "";
    towers.forEach((tower, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tower-chip${tower.id === state.selectedTowerId ? " is-selected" : ""}`;
      button.dataset.towerId = tower.id;
      button.innerHTML = `
        <span class="tower-chip__icon" data-level="${tower.level}">${index + 1}</span>
        <span class="tower-chip__copy">
          <strong>种子炮台 ${index + 1}</strong>
          <small>${tower.upgrades.length ? tower.upgrades.slice(-2).join(" · ") : "基础单体炮台"}</small>
        </span>
        <span class="tower-chip__damage">${Math.round(tower.damage)}</span>
      `;
      button.addEventListener("click", () => {
        closeTowerPicker(false);
        state.selectedTowerId = tower.id;
        updateUI();
        playSound("click");
      });
      ui.towerList.appendChild(button);
    });
    ui.towerList.hidden = towers.length === 0;
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
    drawCarrotHome();
    drawBuildPreview();
    drawTowers();
    drawEnemies();
    drawProjectiles();
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

  function drawCarrotHome() {
    const { x, y } = getCellCenter(CARROT_CELL.col, CARROT_CELL.row);
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = "rgba(37, 73, 42, 0.22)";
    ctx.beginPath();
    ctx.ellipse(4, 26, 49, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#5a8f4b";
    ctx.beginPath();
    ctx.roundRect(-35, 4, 70, 34, 8);
    ctx.fill();
    ctx.strokeStyle = "#3f6e37";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.strokeStyle = "#e2b67e";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-23, 35);
    ctx.lineTo(-27, 51);
    ctx.moveTo(23, 35);
    ctx.lineTo(28, 51);
    ctx.stroke();

    const pulse = 1 + Math.sin(state.time * 2.2) * 0.025;
    ctx.save();
    ctx.scale(pulse, pulse);
    ctx.fillStyle = "#ec8730";
    ctx.strokeStyle = "#b95723";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-21, -18);
    ctx.quadraticCurveTo(-25, 11, 0, 32);
    ctx.quadraticCurveTo(25, 11, 21, -18);
    ctx.quadraticCurveTo(0, -28, -21, -18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 214, 148, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-11, -14);
    ctx.quadraticCurveTo(-14, 4, -4, 17);
    ctx.stroke();

    ctx.fillStyle = "#17352b";
    ctx.beginPath();
    ctx.arc(-7, -1, 2.7, 0, Math.PI * 2);
    ctx.arc(8, -1, 2.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#7e3b22";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(1, 4, 5, 0.15, Math.PI - 0.15);
    ctx.stroke();

    ctx.fillStyle = "#76bd5d";
    for (let i = 0; i < 5; i += 1) {
      ctx.save();
      ctx.rotate(-0.85 + i * 0.39);
      ctx.beginPath();
      ctx.ellipse(0, -32, 6, 17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    ctx.restore();
  }

  function drawTowers() {
    towers.forEach((tower) => {
      drawTower(tower);
    });
  }

  function drawTower(tower) {
    const selected =
      tower.id === state.selectedTowerId && !state.upgradePending && !state.buildCellId;
    ctx.save();
    ctx.translate(tower.x, tower.y);

    if (selected) {
      ctx.strokeStyle = "rgba(255, 249, 232, 0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, tower.range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(127, 200, 107, 0.09)";
      ctx.beginPath();
      ctx.arc(0, 0, tower.range, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(21, 61, 41, 0.24)";
    ctx.beginPath();
    ctx.ellipse(4, 18, 27, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#315f42";
    ctx.beginPath();
    ctx.arc(0, 7, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#214a32";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#75b452";
    ctx.beginPath();
    ctx.arc(0, 3, 19, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#2a563c";
    ctx.beginPath();
    ctx.arc(0, -1, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.rotate(tower.angle);
    const recoilOffset = -tower.recoil * 4;
    ctx.translate(recoilOffset, 0);

    ctx.fillStyle = "#e28d35";
    ctx.strokeStyle = "#9d5627";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(1, -7, 29, 14, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#f3bb5e";
    ctx.beginPath();
    ctx.roundRect(20, -4.5, 13, 9, 3);
    ctx.fill();

    ctx.fillStyle = "#ffe3a0";
    ctx.beginPath();
    ctx.arc(27, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#b9df78";
    ctx.beginPath();
    ctx.arc(0, -2, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#4a7b45";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#24492f";
    ctx.beginPath();
    ctx.arc(-2.3, -4, 1.6, 0, Math.PI * 2);
    ctx.arc(3.4, -4, 1.6, 0, Math.PI * 2);
    ctx.fill();

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
      drawEnemyFocus(enemy);
      drawEnemyHealth(enemy);
    });
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
      projectile.trail.forEach((point, index) => {
        const alpha = (1 - index / projectile.trail.length) * 0.28;
        ctx.fillStyle = `rgba(244, 155, 56, ${alpha})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4 - index * 0.5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.save();
      ctx.translate(projectile.x, projectile.y);
      ctx.fillStyle = projectile.color;
      ctx.shadowColor = projectile.color;
      ctx.shadowBlur = projectile.crit ? 14 : 8;
      ctx.beginPath();
      ctx.arc(0, 0, projectile.crit ? 5.5 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
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
    if (state.mode === "ended" || state.upgradePending) return;
    const point = screenToCanvas(event);
    const enemy = findEnemyAt(point.x, point.y);
    if (enemy && state.mode === "wave") {
      closeTowerPicker(false);
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

    const cell = findCellAt(point.x, point.y);
    if (!cell) {
      closeTowerPicker(false);
      const hadFocusedEnemy = state.focusedEnemyId !== null;
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
    const cell = findCellAt(point.x, point.y);
    const canBuild =
      Boolean(cell) && !pathCellKeys.has(cell.id) && !isCellOccupied(cell.id);
    canvas.classList.toggle("can-build", canBuild);
    canvas.classList.toggle(
      "can-target-enemy",
      state.mode === "wave" && Boolean(findEnemyAt(point.x, point.y)),
    );
  }

  function handlePointerLeave() {
    canvas.classList.remove("can-build");
    canvas.classList.remove("can-target-enemy");
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
    const dt = Math.min(0.035, Math.max(0, (timestamp - state.lastTime) / 1000));
    state.lastTime = timestamp;
    if (!state.paused) {
      update(dt * state.speed);
    }
    render();
    window.requestAnimationFrame(gameLoop);
  }

  ui.waveButton.addEventListener("click", () => {
    if (state.mode === "prep" && !state.upgradePending) startNextWave();
  });
  ui.towerPickerClose.addEventListener("click", () => {
    closeTowerPicker();
    playSound("click");
  });
  ui.towerBuildButton.addEventListener("click", () => {
    if (state.buildCellId) placeTower(state.buildCellId);
  });
  ui.nextWaveButton.addEventListener("click", continueAfterUpgrade);
  ui.upgradeLaterButton.addEventListener("click", keepUpgradeForLater);
  ui.restartButton.addEventListener("click", resetGame);
  ui.pauseButton.addEventListener("click", togglePause);
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
  window.addEventListener("resize", positionTowerPicker);
  if ("ResizeObserver" in window) {
    new ResizeObserver(positionTowerPicker).observe(canvasFrame);
  }

  window.addEventListener("keydown", (event) => {
    const targetTag = event.target?.tagName;
    const isInteractive = ["BUTTON", "INPUT", "SELECT", "TEXTAREA", "A"].includes(targetTag);
    if (event.code === "Space") {
      if (isInteractive) return;
      event.preventDefault();
      if (state.mode === "wave" && !state.upgradePending) {
        togglePause();
      } else if (state.mode === "prep" && !state.upgradePending) {
        startNextWave();
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
      if (state.buildCellId) {
        event.preventDefault();
        closeTowerPicker();
      }
    }
  });

  resetGame();
  window.requestAnimationFrame(gameLoop);
})();
