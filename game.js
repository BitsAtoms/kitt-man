/* KITT-MAN — a Pac-Man style game starring KITT (Knight Rider). */

const CELL = 26;

const MAZE = [
  "###################",
  "#o...............o#",
  "#.##..##...##..##.#",
  "#.##..##...##..##.#",
  "#.................#",
  "#.##..##...##..##.#",
  "#.##..##...##..##.#",
  "#.....##...##.....#",
  "#.................#",
  "#.###..## ##..###.#",
  "#......#   #......#",
  "#.###..#####..###.#",
  "#.................#",
  "#.##..##...##..##.#",
  "#.##..##...##..##.#",
  "#.................#",
  "#.................#",
  "#.##..##...##..##.#",
  "#.##..##...##..##.#",
  "#o...............o#",
  "###################",
];

const ROWS = MAZE.length;
const COLS = MAZE[0].length;

const DOOR = { row: 9, col: 9 };
const PLAYER_START = { row: 15, col: 9 };

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  none: { x: 0, y: 0 },
};

function isWall(row, col) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true;
  return MAZE[row][col] === '#';
}

function canMove(row, col, dir) {
  return !isWall(row + dir.y, col + dir.x);
}

function isOpposite(a, b) { return a.x === -b.x && a.y === -b.y; }

function tileCenter(row, col) {
  return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

// --- collectibles ---
const hasDot = [];
const hasPellet = [];
let dotsRemaining = 0;

function resetCollectibles() {
  dotsRemaining = 0;
  for (let r = 0; r < ROWS; r++) {
    hasDot[r] = [];
    hasPellet[r] = [];
    for (let c = 0; c < COLS; c++) {
      hasDot[r][c] = MAZE[r][c] === '.';
      hasPellet[r][c] = MAZE[r][c] === 'o';
      if (hasDot[r][c] || hasPellet[r][c]) dotsRemaining++;
    }
  }
  // clear the tiles where player/ghosts start so nothing looks odd
  hasDot[PLAYER_START.row][PLAYER_START.col] = false;
}

// --- entities ---
function makePlayer() {
  const p = tileCenter(PLAYER_START.row, PLAYER_START.col);
  return {
    x: p.x, y: p.y,
    row: PLAYER_START.row, col: PLAYER_START.col,
    dir: DIRS.none,
    speed: CELL * 8.2,
    facingLeft: true,
    // KITT special abilities
    turboTimer: 0,
    turboCooldown: 0,
    jumpTimer: 0,
    jumpReadyTimer: 0,
    jumpAutoTimer: JUMP_AUTO_INTERVAL,
    jumping: false,
    jumpFrom: null,
    jumpTo: null,
  };
}

const TURBO_DURATION = 1.6;
const TURBO_COOLDOWN = 5;
const TURBO_MULT = 1.9;
const JUMP_DURATION = 0.75;
const JUMP_READY_WINDOW = 4;
const JUMP_AUTO_INTERVAL = 8;

// KITT: Super Pursuit Mode — is there a wall exactly one tile thick, with open
// space right on the other side, that KITT could leap clean over from here?
function findJumpLaneFrom(row, col, preferredDir) {
  const candidates = [preferredDir, DIRS.up, DIRS.down, DIRS.left, DIRS.right];
  for (const d of candidates) {
    if (!d || (d.x === 0 && d.y === 0)) continue;
    const midRow = row + d.y, midCol = col + d.x;
    const farRow = row + d.y * 2, farCol = col + d.x * 2;
    if (isWall(midRow, midCol) && !isWall(farRow, farCol)) {
      return { row: farRow, col: farCol, dir: d };
    }
  }
  return null;
}

function hasJumpLaneAt(row, col) {
  return !!findJumpLaneFrom(row, col, null);
}

const GHOST_DEFS = [
  { name: 'blinky', color: '#ff0000', start: { row: 8, col: 9 }, scatter: { row: 1, col: 17 }, startsInside: false, releaseDelay: 0 },
  { name: 'pinky', color: '#ffb8ff', start: { row: 10, col: 9 }, scatter: { row: 1, col: 1 }, startsInside: true, releaseDelay: 0.5 },
  { name: 'inky', color: '#00ffff', start: { row: 10, col: 8 }, scatter: { row: 19, col: 17 }, startsInside: true, releaseDelay: 3 },
  { name: 'clyde', color: '#ffb852', start: { row: 10, col: 10 }, scatter: { row: 19, col: 1 }, startsInside: true, releaseDelay: 6 },
];

function makeGhosts() {
  return GHOST_DEFS.map((def) => {
    const p = tileCenter(def.start.row, def.start.col);
    return {
      name: def.name,
      color: def.color,
      scatterTarget: def.scatter,
      x: p.x, y: p.y,
      row: def.start.row, col: def.start.col,
      dir: DIRS.up,
      state: def.startsInside ? 'waiting' : 'scatter',
      releaseTimer: def.releaseDelay,
      frightTimer: 0,
    };
  });
}

let player = makePlayer();
let ghosts = makeGhosts();

// --- game state ---
let score = 0;
let lives = 3;
let comboCount = 0;
let globalMode = 'scatter';
let globalModeTimer = 7;
let state = 'ready'; // ready | playing | dying | gameover | win
let readyTimer = 0.9;
let dyingTimer = 0;
let endScreenTimer = 0;
const END_SCREEN_SECONDS = 4;

// demo aids: this is an unattended demo, so make sure a first-time viewer
// actually gets to see KITT's special moves without having to wait around
let firstPelletEaten = false;
let turboShown = false;
const TURBO_FORCE_DEADLINE = 6; // seconds into a life before we force a turbo burst
let turboForceTimer = TURBO_FORCE_DEADLINE;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
canvas.width = COLS * CELL;
canvas.height = ROWS * CELL;

const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const readyOverlay = document.getElementById('readyOverlay');
const gameoverOverlay = document.getElementById('gameoverOverlay');
const winOverlay = document.getElementById('winOverlay');
const pacmanTheme = document.getElementById('pacmanTheme');
const pacmanChomp = document.getElementById('pacmanChomp');
let pacmanThemeStopTimer = null;
const INTRO_MUSIC_SECONDS = 9;

function stopPacmanTheme() {
  if (!pacmanTheme) return;
  pacmanTheme.pause();
  pacmanTheme.currentTime = 0;
  if (pacmanThemeStopTimer !== null) {
    clearTimeout(pacmanThemeStopTimer);
    pacmanThemeStopTimer = null;
  }
}

function startPacmanTheme({ restart = false } = {}) {
  if (!pacmanTheme) return;
  if (restart) stopPacmanTheme();
  // Interaction events only unblock autoplay; they must not restart music
  // that is already playing during the same READY screen.
  if (!restart && !pacmanTheme.paused) return;
  pacmanTheme.volume = 0.34;
  const playback = pacmanTheme.play();
  if (playback && typeof playback.catch === 'function') playback.catch(() => {});
  pacmanThemeStopTimer = setTimeout(stopPacmanTheme, INTRO_MUSIC_SECONDS * 1000);
}

function playPacmanChomp() {
  if (!pacmanChomp) return;
  pacmanChomp.currentTime = 0;
  pacmanChomp.volume = 0.28;
  const playback = pacmanChomp.play();
  if (playback && typeof playback.catch === 'function') playback.catch(() => {});
}

// Browsers can defer media autoplay until the first interaction.
window.addEventListener('pointerdown', startPacmanTheme, { passive: true });
window.addEventListener('keydown', startPacmanTheme, { passive: true });
startPacmanTheme();

const kittImg = new Image();
kittImg.src = 'assets/kitt.png';

function renderLives() {
  livesEl.innerHTML = '';
  for (let i = 0; i < lives; i++) {
    const dot = document.createElement('span');
    dot.className = 'life-icon';
    livesEl.appendChild(dot);
  }
}

function updateHud() {
  scoreEl.textContent = String(score).padStart(2, '0');
  renderLives();
}

// --- autopilot brain: this is a self-playing simulation, nobody drives KITT ---
function bfsFirstStep(startRow, startCol, isTarget) {
  const visited = new Set([startRow + ',' + startCol]);
  const queue = [{ row: startRow, col: startCol, firstDir: null }];
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++];
    for (const key of ['up', 'down', 'left', 'right']) {
      const d = DIRS[key];
      const nr = cur.row + d.y, nc = cur.col + d.x;
      if (isWall(nr, nc)) continue;
      const k = nr + ',' + nc;
      if (visited.has(k)) continue;
      visited.add(k);
      const firstDir = cur.firstDir || d;
      if (isTarget(nr, nc)) return firstDir;
      queue.push({ row: nr, col: nc, firstDir });
    }
  }
  return null;
}

let lastDecisionWasFlee = false;

function chooseAutoDir(row, col) {
  lastDecisionWasFlee = false;

  // pass the CURRENT direction, not its negation — availableDirs excludes
  // whatever is opposite of this value, i.e. it excludes reversing course
  const noReverse = player.dir;

  const dangerGhosts = ghosts.filter((g) => g.state === 'chase' || g.state === 'scatter' || g.state === 'leaving');
  let nearestDanger = null, nearestDangerDist = Infinity;
  for (const g of dangerGhosts) {
    const d = Math.abs(g.row - row) + Math.abs(g.col - col);
    if (d < nearestDangerDist) { nearestDangerDist = d; nearestDanger = { row: g.row, col: g.col }; }
  }

  // imminent danger: flee toward whichever open direction increases distance from the ghost
  if (nearestDanger && nearestDangerDist <= 1) {
    lastDecisionWasFlee = true;
    let opts = availableDirs(row, col, noReverse);
    if (opts.length === 0) opts = availableDirs(row, col, null);
    let best = opts[0], bestD = -Infinity;
    for (const d of opts) {
      const nr = row + d.y, nc = col + d.x;
      const dd = Math.abs(nr - nearestDanger.row) + Math.abs(nc - nearestDanger.col);
      if (dd > bestD) { bestD = dd; best = d; }
    }
    return best;
  }

  // demo aid: make a beeline for a power pellet first thing, so the jump has
  // something to trigger from almost right away
  if (!firstPelletEaten) {
    const pelletDir = bfsFirstStep(row, col, (r, c) => hasPellet[r][c]);
    if (pelletDir) return pelletDir;
  }

  // KITT: Super Pursuit Mode armed — head for the nearest wall it can leap over
  if (player.jumpReadyTimer > 0) {
    const jumpDir = bfsFirstStep(row, col, (r, c) => hasJumpLaneAt(r, c));
    if (jumpDir) return jumpDir;
  }

  // hunt a frightened ghost if one is around, for bonus points
  const frightGhosts = ghosts.filter((g) => g.state === 'frightened');
  if (frightGhosts.length) {
    let target = null, bestDist = Infinity;
    for (const g of frightGhosts) {
      const d = Math.abs(g.row - row) + Math.abs(g.col - col);
      if (d < bestDist) { bestDist = d; target = { row: g.row, col: g.col }; }
    }
    const dir = bfsFirstStep(row, col, (r, c) => r === target.row && c === target.col);
    if (dir) return dir;
  }

  // otherwise, head for the nearest dot or pellet
  const dotDir = bfsFirstStep(row, col, (r, c) => hasDot[r][c] || hasPellet[r][c]);
  if (dotDir) return dotDir;

  // nothing left to chase: wander
  let opts = availableDirs(row, col, noReverse);
  if (opts.length === 0) opts = availableDirs(row, col, null);
  return opts.length ? opts[Math.floor(Math.random() * opts.length)] : DIRS.none;
}

function activateTurbo() {
  player.turboTimer = TURBO_DURATION;
  player.turboCooldown = TURBO_COOLDOWN;
  turboShown = true;
  SFX.turbo();
}

function maybeActivateTurbo() {
  if (lastDecisionWasFlee && player.turboCooldown <= 0) activateTurbo();
}

function launchJump(lane) {
  player.jumping = true;
  player.jumpTimer = JUMP_DURATION;
  player.jumpReadyTimer = 0;
  player.jumpFrom = { x: player.x, y: player.y };
  player.row = lane.row; player.col = lane.col;
  player.jumpTo = tileCenter(lane.row, lane.col);
  player.dir = lane.dir;
  SFX.jump();
}

function updatePlayer(dt) {
  player.turboTimer = Math.max(0, player.turboTimer - dt);
  player.turboCooldown = Math.max(0, player.turboCooldown - dt);
  player.jumpReadyTimer = Math.max(0, player.jumpReadyTimer - dt);

  // demo aid: guarantee a visible turbo burst early on, in case no ghost
  // happens to get close enough to trigger the real flee-response in time
  if (!turboShown && player.turboTimer <= 0) {
    turboForceTimer -= dt;
    if (turboForceTimer <= 0) activateTurbo();
  }

  // KITT: Super Pursuit Mode — make sure the jump actually gets used during
  // a session even if KITT never reaches a power pellet
  if (!player.jumping) {
    player.jumpAutoTimer -= dt;
    if (player.jumpAutoTimer <= 0) {
      player.jumpAutoTimer = JUMP_AUTO_INTERVAL;
      player.jumpReadyTimer = JUMP_READY_WINDOW;
    }
  }

  // KITT: Super Pursuit Mode — mid-air, interpolate straight across the wall
  if (player.jumping) {
    player.jumpTimer -= dt;
    if (player.jumpTimer <= 0) {
      player.jumping = false;
      player.x = player.jumpTo.x; player.y = player.jumpTo.y;
      eatAt(player.row, player.col);
      player.dir = DIRS.none;
    } else {
      const progress = 1 - Math.max(0, player.jumpTimer) / JUMP_DURATION;
      player.x = player.jumpFrom.x + (player.jumpTo.x - player.jumpFrom.x) * progress;
      player.y = player.jumpFrom.y + (player.jumpTo.y - player.jumpFrom.y) * progress;
    }
    if (player.dir.x > 0) player.facingLeft = false;
    else if (player.dir.x < 0) player.facingLeft = true;
    return;
  }

  const speed = player.turboTimer > 0 ? player.speed * TURBO_MULT : player.speed;
  let remaining = speed * dt;
  let guard = 0;

  if (player.dir === DIRS.none) {
    player.dir = chooseAutoDir(player.row, player.col);
    maybeActivateTurbo();
    if (!canMove(player.row, player.col, player.dir)) player.dir = DIRS.none;
  }

  while (remaining > 1e-9 && guard++ < 40 && player.dir !== DIRS.none) {
    const nextRow = player.row + player.dir.y;
    const nextCol = player.col + player.dir.x;
    const nextCenter = tileCenter(nextRow, nextCol);
    const distToNext = Math.hypot(player.x - nextCenter.x, player.y - nextCenter.y);

    if (distToNext <= remaining + 1e-9) {
      player.x = nextCenter.x; player.y = nextCenter.y;
      player.row = nextRow; player.col = nextCol;
      remaining -= distToNext;
      eatAt(player.row, player.col);

      if (player.jumpReadyTimer > 0) {
        const lane = findJumpLaneFrom(player.row, player.col, player.dir);
        if (lane) { launchJump(lane); break; }
      }

      const newDir = chooseAutoDir(player.row, player.col);
      maybeActivateTurbo();
      if (canMove(player.row, player.col, newDir)) {
        player.dir = newDir;
      } else {
        player.dir = DIRS.none;
      }
    } else {
      player.x += player.dir.x * remaining;
      player.y += player.dir.y * remaining;
      remaining = 0;
    }
  }

  if (player.dir.x > 0) player.facingLeft = false;
  else if (player.dir.x < 0) player.facingLeft = true;
}

function eatAt(row, col) {
  if (hasDot[row][col]) {
    hasDot[row][col] = false;
    dotsRemaining--;
    score += 10;
    updateHud();
    playPacmanChomp();
    checkWin();
  } else if (hasPellet[row][col]) {
    hasPellet[row][col] = false;
    dotsRemaining--;
    score += 50;
    comboCount = 0;
    firstPelletEaten = true;
    updateHud();
    playPacmanChomp();
    frightenGhosts();
    // KITT: Super Pursuit Mode — look out for a wall to leap over for a few seconds
    player.jumpReadyTimer = JUMP_READY_WINDOW;
    checkWin();
  }
}

function frightenGhosts() {
  ghosts.forEach((g) => {
    if (g.state === 'scatter' || g.state === 'chase') {
      g.state = 'frightened';
      g.frightTimer = 7;
      g.dir = { x: -g.dir.x, y: -g.dir.y };
    }
  });
}

function checkWin() {
  if (dotsRemaining <= 0) {
    state = 'win';
    endScreenTimer = END_SCREEN_SECONDS;
    document.getElementById('finalScoreWin').textContent = score;
    winOverlay.classList.remove('hidden');
    SFX.win();
  }
}

// --- ghost AI ---
function availableDirs(row, col, excludeReverse) {
  const dirs = [DIRS.up, DIRS.down, DIRS.left, DIRS.right];
  return dirs.filter((d) => canMove(row, col, d) && !(excludeReverse && isOpposite(d, excludeReverse)));
}

function chaseTarget(g) {
  const pt = { row: player.row, col: player.col };
  if (g.name === 'blinky') return pt;
  if (g.name === 'pinky') {
    return { row: pt.row + player.dir.y * 4, col: pt.col + player.dir.x * 4 };
  }
  if (g.name === 'inky') {
    return { row: pt.row + player.dir.y * 2, col: pt.col + player.dir.x * 2 };
  }
  // clyde: chase unless close, then flee to its corner
  const d2 = dist2(g.col, g.row, pt.col, pt.row);
  return d2 > 36 ? pt : g.scatterTarget;
}

function ghostTargetTile(g) {
  if (g.state === 'frightened') return null;
  if (g.state === 'eaten' || g.state === 'leaving') return DOOR;
  if (g.state === 'scatter') return g.scatterTarget;
  return chaseTarget(g);
}

// the ghost house interior/door — off-limits to roaming ghosts so they don't
// loiter through the middle of the maze; only 'leaving'/'eaten' may use it
function isHouseTile(row, col) {
  return (row === DOOR.row && col === DOOR.col) || (row === 10 && col >= 8 && col <= 10);
}

function decideGhostDir(g, row, col) {
  // pass the CURRENT direction, not its negation — availableDirs excludes
  // whatever is opposite of this value, i.e. it excludes reversing course
  const noReverse = g.dir;
  const allowHouse = g.state === 'leaving' || g.state === 'eaten';

  let options = availableDirs(row, col, noReverse);
  if (!allowHouse) {
    const noHouse = options.filter((d) => !isHouseTile(row + d.y, col + d.x));
    if (noHouse.length) options = noHouse;
  }
  if (options.length === 0) {
    options = availableDirs(row, col, null);
    if (!allowHouse) {
      const noHouse = options.filter((d) => !isHouseTile(row + d.y, col + d.x));
      if (noHouse.length) options = noHouse;
    }
  }

  if (g.state === 'frightened') {
    g.dir = options[Math.floor(Math.random() * options.length)];
    return;
  }

  const target = ghostTargetTile(g);
  let best = options[0];
  let bestD = Infinity;
  for (const d of options) {
    const nr = row + d.y, nc = col + d.x;
    const dd = dist2(nc, nr, target.col, target.row);
    if (dd < bestD) { bestD = dd; best = d; }
  }
  g.dir = best;

  if ((g.state === 'eaten' || g.state === 'leaving') && row === DOOR.row && col === DOOR.col) {
    g.state = globalMode;
  }
}

function updateGhost(g, dt) {
  if (g.state === 'waiting') {
    g.releaseTimer -= dt;
    if (g.releaseTimer <= 0) g.state = 'leaving';
    return;
  }

  if (g.state === 'frightened') {
    g.frightTimer -= dt;
    if (g.frightTimer <= 0) g.state = globalMode;
  }

  const speed = g.state === 'frightened' ? CELL * 3.2 : g.state === 'eaten' ? CELL * 9 : CELL * 5.2;
  let remaining = speed * dt;
  let guard = 0;

  if (g.dir === DIRS.none) {
    decideGhostDir(g, g.row, g.col);
  }

  while (remaining > 1e-9 && guard++ < 40) {
    if (!canMove(g.row, g.col, g.dir)) {
      decideGhostDir(g, g.row, g.col);
      if (!canMove(g.row, g.col, g.dir)) break; // truly boxed in: stay put this frame
    }

    const nextRow = g.row + g.dir.y;
    const nextCol = g.col + g.dir.x;
    const nextCenter = tileCenter(nextRow, nextCol);
    const distToNext = Math.hypot(g.x - nextCenter.x, g.y - nextCenter.y);

    if (distToNext <= remaining + 1e-9) {
      g.x = nextCenter.x; g.y = nextCenter.y;
      g.row = nextRow; g.col = nextCol;
      remaining -= distToNext;
      decideGhostDir(g, g.row, g.col);
    } else {
      g.x += g.dir.x * remaining;
      g.y += g.dir.y * remaining;
      remaining = 0;
    }
  }
}

function updateGlobalMode(dt) {
  globalModeTimer -= dt;
  if (globalModeTimer <= 0) {
    globalMode = globalMode === 'scatter' ? 'chase' : 'scatter';
    globalModeTimer = globalMode === 'scatter' ? 9 : 12;
    ghosts.forEach((g) => {
      if (g.state === 'scatter' || g.state === 'chase') g.state = globalMode;
    });
  }
}

function checkCollisions() {
  const threshold = CELL * 0.6;
  for (const g of ghosts) {
    const d = Math.hypot(g.x - player.x, g.y - player.y);
    if (d < threshold) {
      if (g.state === 'frightened') {
        g.state = 'eaten';
        comboCount++;
        score += Math.min(200 * comboCount, 1600);
        updateHud();
        SFX.ghostEaten();
      } else if (g.state !== 'eaten') {
        loseLife();
        return;
      }
    }
  }
}

function loseLife() {
  lives--;
  updateHud();
  SFX.lifeLost();
  if (lives <= 0) {
    SFX.gameOver();
    state = 'gameover';
    endScreenTimer = END_SCREEN_SECONDS;
    document.getElementById('finalScoreLose').textContent = score;
    gameoverOverlay.classList.remove('hidden');
    return;
  }
  resetPositions();
  state = 'ready';
  readyTimer = 0.9;
  readyOverlay.classList.remove('hidden');
}

function resetPositions() {
  player = makePlayer();
  ghosts = makeGhosts();
  globalMode = 'scatter';
  globalModeTimer = 7;
  turboForceTimer = TURBO_FORCE_DEADLINE;
}

// --- rendering ---
function drawMaze() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // collect the wall skeleton once so it can be stroked twice (hollow "tube" look)
  const segments = [];
  const dots = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAZE[r][c] !== '#') continue;
      const center = tileCenter(r, c);
      let connected = false;
      if (c + 1 < COLS && MAZE[r][c + 1] === '#') {
        connected = true;
        segments.push([center, tileCenter(r, c + 1)]);
      }
      if (r + 1 < ROWS && MAZE[r + 1][c] === '#') {
        connected = true;
        segments.push([center, tileCenter(r + 1, c)]);
      }
      const hasAnyNeighbor = connected ||
        (c - 1 >= 0 && MAZE[r][c - 1] === '#') ||
        (r - 1 >= 0 && MAZE[r - 1][c] === '#');
      if (!hasAnyNeighbor) dots.push(center);
    }
  }

  function strokeSkeleton(width) {
    ctx.lineWidth = width;
    for (const [a, b] of segments) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const p of dots) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, width / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // classic Pac-Man look: thin double-line hollow walls with rounded ends —
  // draw a thick blue "pipe" then hollow out its middle with a black stroke on top
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#2545ff';
  ctx.fillStyle = '#2545ff';
  strokeSkeleton(9);
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#000';
  strokeSkeleton(4.5);

  const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 150);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const center = tileCenter(r, c);
      if (hasDot[r][c]) {
        ctx.fillStyle = '#ffdf8c';
        ctx.beginPath();
        ctx.arc(center.x, center.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (hasPellet[r][c]) {
        ctx.fillStyle = '#ffdf8c';
        ctx.globalAlpha = pulse;
        ctx.beginPath();
        ctx.arc(center.x, center.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
}

function drawPlayer() {
  const size = CELL * 2.1;

  // KITT: Turbo Boost — fading speed trail behind the car
  if (player.turboTimer > 0 && (player.dir.x !== 0 || player.dir.y !== 0)) {
    const back = { x: -player.dir.x, y: -player.dir.y };
    for (let i = 1; i <= 3; i++) {
      const alpha = 0.22 - i * 0.06;
      const dist = i * CELL * 0.5;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = '#ff3b1a';
      ctx.beginPath();
      ctx.ellipse(player.x + back.x * dist, player.y + back.y * dist, size * 0.32, size * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // KITT: Super Pursuit Mode — big, unmistakable supersonic jump arc
  let jumpOffset = 0, jumpScale = 1, jumpArc = 0;
  if (player.jumpTimer > 0) {
    const progress = 1 - player.jumpTimer / JUMP_DURATION;
    jumpArc = Math.sin(progress * Math.PI);
    jumpOffset = -jumpArc * CELL * 2.6;
    jumpScale = 1 + jumpArc * 0.7;

    // shrinking ground shadow sells how high KITT is off the tarmac
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.4 * (1 - jumpArc * 0.8)})`;
    ctx.beginPath();
    ctx.ellipse(player.x, player.y, size * 0.4 * (1 - jumpArc * 0.5), size * 0.14 * (1 - jumpArc * 0.5), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(player.x, player.y + jumpOffset);
  if (!player.facingLeft) ctx.scale(-1, 1);
  ctx.scale(jumpScale, jumpScale);
  if (kittImg.complete && kittImg.naturalWidth) {
    ctx.drawImage(kittImg, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = '#ff2b2b';
    ctx.beginPath();
    ctx.arc(0, 0, CELL / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // KITT's scanner light, mounted right at the front of the car, sweeping side to side.
  // The sprite always faces left before any flip, so the front sits at the -x edge —
  // placing the light there keeps it at the nose regardless of facing direction.
  const frontX = -size * 0.34;
  const sweepX = frontX + Math.sin(Date.now() / 180) * size * 0.1;
  ctx.fillStyle = 'rgba(255,30,10,0.9)';
  ctx.beginPath();
  ctx.ellipse(sweepX, -size * 0.1, size * 0.055, size * 0.02, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGhost(g) {
  const r = CELL * 0.4;
  const x = g.x, y = g.y - 1;
  let color = g.color;
  if (g.state === 'frightened') {
    color = g.frightTimer < 2 && Math.floor(Date.now() / 200) % 2 === 0 ? '#ffffff' : '#2323ff';
  }

  if (g.state === 'eaten') {
    drawEyes(x, y, g.dir, r);
    return;
  }

  const bottom = y + r * 0.82;
  const legs = 4;
  const legW = (2 * r) / legs;

  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI, 0, false);
  ctx.lineTo(x + r, bottom - legW / 2);
  for (let i = 0; i < legs; i++) {
    const cx = x + r - legW * (i + 0.5);
    ctx.arc(cx, bottom - legW / 2, legW / 2, 0, Math.PI, false);
  }
  ctx.lineTo(x - r, y);
  ctx.closePath();

  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(0,0,0,.45)';
  ctx.stroke();

  // subtle top highlight for definition
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.32, y - r * 0.4, r * 0.32, r * 0.18, -0.4, 0, Math.PI * 2);
  ctx.fill();

  drawEyes(x, y, g.dir, r);
}

function drawEyes(x, y, dir, r) {
  const eyeOffsetX = r * 0.42;
  const eyeOffsetY = -r * 0.12;
  const eyeR = r * 0.32;
  const pupilR = r * 0.16;
  [-1, 1].forEach((side) => {
    const ex = x + side * eyeOffsetX;
    const ey = y + eyeOffsetY;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.3)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = '#1a1a3d';
    ctx.beginPath();
    ctx.arc(ex + dir.x * pupilR * 0.9, ey + dir.y * pupilR * 0.9, pupilR, 0, Math.PI * 2);
    ctx.fill();
  });
}

function render() {
  drawMaze();
  drawPlayer();
  ghosts.forEach(drawGhost);
}

// --- main loop ---
let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  try {
    if (state === 'ready') {
      readyTimer -= dt;
      if (readyTimer <= 0) {
        state = 'playing';
        readyOverlay.classList.add('hidden');
      }
    } else if (state === 'playing') {
      updatePlayer(dt);
      ghosts.forEach((g) => updateGhost(g, dt));
      updateGlobalMode(dt);
      checkCollisions();
    } else if (state === 'gameover' || state === 'win') {
      endScreenTimer -= dt;
      if (endScreenTimer <= 0) restartGame();
    }
  } catch (err) {
    console.error('KITT-MAN update error (recovered):', err);
  }

  render();
  requestAnimationFrame(loop);
}

function restartGame() {
  score = 0;
  lives = 3;
  comboCount = 0;
  firstPelletEaten = false;
  turboShown = false;
  resetCollectibles();
  resetPositions();
  state = 'ready';
  readyTimer = 0.9;
  startPacmanTheme({ restart: true });
  updateHud();
  gameoverOverlay.classList.add('hidden');
  winOverlay.classList.add('hidden');
  readyOverlay.classList.remove('hidden');
}

document.getElementById('retryBtnLose').addEventListener('click', restartGame);
document.getElementById('retryBtnWin').addEventListener('click', restartGame);

resetCollectibles();
updateHud();
requestAnimationFrame(loop);
