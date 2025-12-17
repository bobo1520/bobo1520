// Game canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const hudScore = document.getElementById('hudScore');
const hudCoins = document.getElementById('hudCoins');
const hudLives = document.getElementById('hudLives');
const btnPause = document.getElementById('btnPause');
const btnRestart = document.getElementById('btnRestart');
const btnSound = document.getElementById('btnSound');
const btnStart = document.getElementById('btnStart');
const btnResume = document.getElementById('btnResume');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalText = document.getElementById('modalText');
const touchLeft = document.getElementById('touchLeft');
const touchRight = document.getElementById('touchRight');
const touchJump = document.getElementById('touchJump');

// Game state
const state = {
    gravity: 1500,
    keys: {},
    paused: true,
    soundOn: true,
    lives: 3,
    score: 0,
    coins: 0,
    won: false,
    dead: false,
    time: 0
};

const V = (x = 0, y = 0) => ({ x, y });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sign = (n) => (n < 0 ? -1 : 1);

const TILE = 24;
const VIEW_W = canvas.width;
const VIEW_H = canvas.height;
const WORLD_H_TILES = 18;

const COLORS = {
    skyTop: '#74b9ff',
    skyBottom: '#5b7cfa',
    cloud: 'rgba(255,255,255,0.85)',
    dirt: '#7b4f2b',
    dirtDark: '#603b1f',
    grass: '#2ecc71',
    grassDark: '#1eaf58',
    brick: '#d9885b',
    brickDark: '#b46d45',
    coin: '#f5c542',
    coinDark: '#dbad2c',
    enemy: '#ff6b6b',
    enemyDark: '#e25252',
    flag: '#f1f2f6',
    pole: 'rgba(255,255,255,0.75)',
    uiShadow: 'rgba(0,0,0,0.25)'
};

let audioCtx = null;
function ensureAudio() {
    if (!state.soundOn) return null;
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function beep(type, freq, dur, gainValue) {
    const ac = ensureAudio();
    if (!ac) return;

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ac.destination);

    const t0 = ac.currentTime;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(gainValue, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
}

function sfxJump() {
    beep('square', 440, 0.10, 0.08);
    beep('square', 660, 0.08, 0.06);
}

function sfxCoin() {
    beep('triangle', 880, 0.07, 0.08);
    beep('triangle', 1320, 0.05, 0.06);
}

function sfxStomp() {
    beep('sawtooth', 180, 0.09, 0.10);
}

function sfxHurt() {
    beep('square', 120, 0.18, 0.10);
}

function sfxWin() {
    beep('triangle', 784, 0.12, 0.07);
    beep('triangle', 988, 0.12, 0.07);
    beep('triangle', 1175, 0.16, 0.07);
}

// Level
function buildLevel() {
    const width = 160;
    const height = WORLD_H_TILES;
    const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => 0));

    for (let x = 0; x < width; x++) {
        grid[height - 2][x] = 1;
        grid[height - 1][x] = 1;
    }

    const holes = [18, 19, 48, 49, 50, 78, 79, 120, 121];
    holes.forEach((x) => {
        if (x >= 0 && x < width) {
            grid[height - 2][x] = 0;
            grid[height - 1][x] = 0;
        }
    });

    const platforms = [
        { x: 10, y: 12, w: 6 },
        { x: 24, y: 10, w: 5 },
        { x: 34, y: 8, w: 4 },
        { x: 44, y: 12, w: 7 },
        { x: 58, y: 9, w: 6 },
        { x: 70, y: 7, w: 5 },
        { x: 90, y: 11, w: 7 },
        { x: 106, y: 9, w: 6 },
        { x: 130, y: 10, w: 8 }
    ];

    platforms.forEach((p) => {
        for (let dx = 0; dx < p.w; dx++) {
            grid[p.y][p.x + dx] = 2;
        }
    });

    const bricks = [
        { x: 14, y: 9 },
        { x: 15, y: 9 },
        { x: 16, y: 9 },
        { x: 35, y: 5 },
        { x: 36, y: 5 },
        { x: 37, y: 5 },
        { x: 60, y: 6 },
        { x: 61, y: 6 },
        { x: 92, y: 8 },
        { x: 93, y: 8 },
        { x: 94, y: 8 }
    ];
    bricks.forEach((b) => (grid[b.y][b.x] = 3));

    const coins = [];
    function addCoin(tx, ty) {
        coins.push({ id: `${tx}:${ty}`, x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, r: 7, taken: false });
    }

    for (let x = 12; x < 20; x += 2) addCoin(x, 11);
    for (let x = 26; x < 34; x += 2) addCoin(x, 9);
    for (let x = 46; x < 54; x += 2) addCoin(x, 11);
    for (let x = 60; x < 68; x += 2) addCoin(x, 8);
    for (let x = 72; x < 78; x += 2) addCoin(x, 6);
    for (let x = 92; x < 100; x += 2) addCoin(x, 10);
    for (let x = 108; x < 116; x += 2) addCoin(x, 8);
    for (let x = 132; x < 140; x += 2) addCoin(x, 9);

    const enemies = [
        { x: 34 * TILE, y: (height - 3) * TILE, w: 20, h: 20, vx: 55, alive: true, stompedTimer: 0 },
        { x: 64 * TILE, y: (height - 3) * TILE, w: 20, h: 20, vx: -55, alive: true, stompedTimer: 0 },
        { x: 96 * TILE, y: (height - 3) * TILE, w: 20, h: 20, vx: 65, alive: true, stompedTimer: 0 },
        { x: 122 * TILE, y: (height - 3) * TILE, w: 20, h: 20, vx: -65, alive: true, stompedTimer: 0 }
    ];

    const flag = {
        x: (width - 8) * TILE,
        y: (height - 2) * TILE,
        h: 10 * TILE
    };

    return { width, height, grid, coins, enemies, flag };
}

let level = buildLevel();
let particles = [];
let cameraX = 0;

function resetLevel(full) {
    level = buildLevel();
    particles = [];
    cameraX = 0;
    if (full) {
        state.lives = 3;
        state.score = 0;
        state.coins = 0;
    }
    state.won = false;
    state.dead = false;
    playerReset();
    updateHud();
}

function spawnParticle(x, y, vx, vy, life, color) {
    particles.push({ x, y, vx, vy, life, age: 0, color });
}

function spawnBurst(x, y, color) {
    for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 * i) / 10;
        const sp = 60 + Math.random() * 140;
        spawnParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.45 + Math.random() * 0.25, color);
    }
}

function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function tileAt(tx, ty) {
    if (ty < 0 || ty >= level.height || tx < 0 || tx >= level.width) return 0;
    return level.grid[ty][tx];
}

function isSolidTile(t) {
    return t === 1 || t === 2 || t === 3;
}

function worldToTile(v) {
    return Math.floor(v / TILE);
}

function resolveCollisions(entity, dt) {
    const nextX = entity.x + entity.vx * dt;
    const nextY = entity.y + entity.vy * dt;
    const w = entity.w;
    const h = entity.h;

    entity.onGround = false;

    entity.x = nextX;
    let left = worldToTile(entity.x);
    let right = worldToTile(entity.x + w - 0.001);
    let top = worldToTile(entity.y);
    let bottom = worldToTile(entity.y + h - 0.001);

    if (entity.vx !== 0) {
        const dir = sign(entity.vx);
        const checkX = dir > 0 ? right : left;
        for (let ty = top; ty <= bottom; ty++) {
            const t = tileAt(checkX, ty);
            if (isSolidTile(t)) {
                const tileWorldX = checkX * TILE;
                if (dir > 0) entity.x = tileWorldX - w;
                else entity.x = tileWorldX + TILE;
                entity.vx = 0;
                break;
            }
        }
    }

    entity.y = nextY;
    left = worldToTile(entity.x);
    right = worldToTile(entity.x + w - 0.001);
    top = worldToTile(entity.y);
    bottom = worldToTile(entity.y + h - 0.001);

    if (entity.vy !== 0) {
        const dir = sign(entity.vy);
        const checkY = dir > 0 ? bottom : top;
        for (let tx = left; tx <= right; tx++) {
            const t = tileAt(tx, checkY);
            if (isSolidTile(t)) {
                const tileWorldY = checkY * TILE;
                if (dir > 0) {
                    entity.y = tileWorldY - h;
                    entity.onGround = true;
                } else {
                    entity.y = tileWorldY + TILE;
                }
                entity.vy = 0;

                if (dir < 0 && t === 3) {
                    level.grid[checkY][tx] = 0;
                    state.score += 20;
                    spawnBurst((tx + 0.5) * TILE, (checkY + 0.5) * TILE, COLORS.brick);
                    sfxCoin();
                }
                break;
            }
        }
    }
}

// Player object
const player = {
    x: 3 * TILE,
    y: 10 * TILE,
    w: 18,
    h: 22,
    vx: 0,
    vy: 0,
    face: 1,
    onGround: false,
    jumpBuffer: 0,
    coyote: 0,
    invuln: 0,
    anim: 0
};

function playerReset() {
    player.x = 3 * TILE;
    player.y = 10 * TILE;
    player.vx = 0;
    player.vy = 0;
    player.face = 1;
    player.onGround = false;
    player.jumpBuffer = 0;
    player.coyote = 0;
    player.invuln = 0.8;
    player.anim = 0;
}

function killPlayer() {
    if (state.dead || state.won) return;
    if (player.invuln > 0) return;
    state.lives -= 1;
    updateHud();
    sfxHurt();
    spawnBurst(player.x + player.w / 2, player.y + player.h / 2, '#ff7675');
    player.invuln = 1.2;

    if (state.lives <= 0) {
        state.dead = true;
        openModal('Game Over', `Score: ${state.score}. Press Restart.`);
    } else {
        playerReset();
    }
}

function winGame() {
    if (state.won) return;
    state.won = true;
    sfxWin();
    openModal('You Win!', `Final Score: ${state.score} · Coins: ${state.coins}`);
}

function updateHud() {
    hudScore.textContent = String(state.score);
    hudCoins.textContent = String(state.coins);
    hudLives.textContent = String(state.lives);
}

function openModal(title, text, showResume) {
    modalTitle.textContent = title;
    modalText.textContent = text;
    modal.setAttribute('aria-hidden', 'false');
    btnStart.style.display = showResume ? 'none' : 'inline-block';
    btnResume.style.display = showResume ? 'inline-block' : 'none';
}

function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
}

function setPaused(v) {
    state.paused = v;
    btnPause.textContent = state.paused ? 'Resume' : 'Pause';
    if (state.paused) openModal('Paused', 'Press Resume or hit P.', true);
    else closeModal();
}

function setSound(on) {
    state.soundOn = on;
    btnSound.textContent = state.soundOn ? 'Sound: On' : 'Sound: Off';
    if (!state.soundOn && audioCtx) {
        audioCtx.suspend();
    }
}

function inputDown(k) {
    return !!state.keys[k];
}

function handlePlayer(dt) {
    const accel = 900;
    const maxSpd = 220;
    const friction = 10;
    const jumpSpeed = 520;

    player.anim += dt;
    if (player.invuln > 0) player.invuln = Math.max(0, player.invuln - dt);

    const left = inputDown('ArrowLeft') || inputDown('a');
    const right = inputDown('ArrowRight') || inputDown('d');
    const jumpPressed = inputDown(' ') || inputDown('ArrowUp') || inputDown('w');

    if (jumpPressed) player.jumpBuffer = 0.10;
    else player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);

    if (player.onGround) player.coyote = 0.12;
    else player.coyote = Math.max(0, player.coyote - dt);

    if (left && !right) {
        player.vx -= accel * dt;
        player.face = -1;
    } else if (right && !left) {
        player.vx += accel * dt;
        player.face = 1;
    } else {
        const dec = friction * dt;
        player.vx = lerp(player.vx, 0, dec);
        if (Math.abs(player.vx) < 4) player.vx = 0;
    }

    player.vx = clamp(player.vx, -maxSpd, maxSpd);

    if (player.jumpBuffer > 0 && player.coyote > 0) {
        player.vy = -jumpSpeed;
        player.jumpBuffer = 0;
        player.coyote = 0;
        sfxJump();
        spawnParticle(player.x + player.w / 2, player.y + player.h, -player.face * 40, 30, 0.25, 'rgba(255,255,255,0.75)');
    }

    player.vy += state.gravity * dt;
    player.vy = Math.min(player.vy, 1200);

    resolveCollisions(player, dt);

    if (player.y > (level.height + 2) * TILE) {
        killPlayer();
    }
}

function handleCoins() {
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    for (const coin of level.coins) {
        if (coin.taken) continue;
        const dx = px - coin.x;
        const dy = py - coin.y;
        if (dx * dx + dy * dy <= (coin.r + 12) * (coin.r + 12)) {
            coin.taken = true;
            state.coins += 1;
            state.score += 10;
            updateHud();
            sfxCoin();
            spawnBurst(coin.x, coin.y, COLORS.coin);
        }
    }
}

function handleEnemies(dt) {
    for (const e of level.enemies) {
        if (!e.alive) {
            e.stompedTimer -= dt;
            continue;
        }

        e.vy = (e.vy || 0) + state.gravity * dt;
        e.vy = Math.min(e.vy, 1200);

        const ent = { x: e.x, y: e.y, w: e.w, h: e.h, vx: e.vx, vy: e.vy, onGround: false };
        resolveCollisions(ent, dt);
        e.x = ent.x;
        e.y = ent.y;
        e.vy = ent.vy;

        if (ent.vx === 0) {
            e.vx *= -1;
        }

        if (aabb(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h)) {
            const playerBottom = player.y + player.h;
            const enemyTop = e.y;
            const falling = player.vy > 80;
            if (falling && playerBottom - enemyTop < 14) {
                e.alive = false;
                e.stompedTimer = 0.4;
                player.vy = -420;
                state.score += 30;
                updateHud();
                sfxStomp();
                spawnBurst(e.x + e.w / 2, e.y + e.h / 2, COLORS.enemy);
            } else {
                killPlayer();
            }
        }
    }
}

function updateCamera(dt) {
    const worldW = level.width * TILE;
    const target = player.x + player.w / 2 - VIEW_W / 2;
    cameraX = lerp(cameraX, target, 1 - Math.exp(-6 * dt));
    cameraX = clamp(cameraX, 0, Math.max(0, worldW - VIEW_W));
}

function updateParticles(dt) {
    particles = particles.filter((p) => p.age < p.life);
    for (const p of particles) {
        p.age += dt;
        p.vy += 900 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
    }
}

function checkFlag() {
    const flag = level.flag;
    const poleX = flag.x;
    const poleY = flag.y - flag.h;
    if (aabb(player.x, player.y, player.w, player.h, poleX - 6, poleY, 12, flag.h)) {
        winGame();
    }
}

function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, COLORS.skyTop);
    g.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const cloudLayer = (par, yBase, alpha) => {
        const t = state.time * 0.04;
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        for (let i = 0; i < 10; i++) {
            const cx = ((i * 220 + (t * 160 * par)) % (VIEW_W + 260)) - 120;
            const cy = yBase + (i % 3) * 26;
            ctx.beginPath();
            ctx.ellipse(cx, cy, 46, 18, 0, 0, Math.PI * 2);
            ctx.ellipse(cx + 30, cy + 6, 40, 16, 0, 0, Math.PI * 2);
            ctx.ellipse(cx - 30, cy + 8, 34, 14, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    };

    cloudLayer(0.2, 70, 0.20);
    cloudLayer(0.35, 110, 0.14);

    const hillsY = VIEW_H - 120;
    const base = 60;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H);
    for (let x = 0; x <= VIEW_W; x += 40) {
        const k = (x + cameraX * 0.35) * 0.004;
        const y = hillsY + Math.sin(k) * base;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(VIEW_W, VIEW_H);
    ctx.closePath();
    ctx.fill();
}

function drawTile(tx, ty, t) {
    const x = tx * TILE - cameraX;
    const y = ty * TILE;
    if (x < -TILE || x > VIEW_W + TILE) return;

    if (t === 1) {
        ctx.fillStyle = COLORS.dirt;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = COLORS.dirtDark;
        ctx.fillRect(x, y + TILE - 6, TILE, 6);
        ctx.fillStyle = COLORS.grass;
        ctx.fillRect(x, y, TILE, 6);
        ctx.fillStyle = COLORS.grassDark;
        ctx.fillRect(x, y + 4, TILE, 2);
    } else if (t === 2) {
        ctx.fillStyle = '#3d3d55';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#2e2e44';
        ctx.fillRect(x, y + TILE - 4, TILE, 4);
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(x + 2, y + 3, TILE - 4, 2);
    } else if (t === 3) {
        ctx.fillStyle = COLORS.brick;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = COLORS.brickDark;
        ctx.fillRect(x, y + TILE - 4, TILE, 4);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(x + 2, y + 2, TILE - 4, 2);
    }
}

function drawCoins() {
    for (const coin of level.coins) {
        if (coin.taken) continue;
        const x = coin.x - cameraX;
        const y = coin.y;
        const bob = Math.sin(state.time * 7 + coin.x * 0.01) * 2;
        ctx.save();
        ctx.translate(x, y + bob);
        const squash = 0.65 + 0.35 * Math.sin(state.time * 7 + coin.x * 0.02 + 1.2) ** 2;
        ctx.scale(squash, 1);
        ctx.fillStyle = COLORS.coinDark;
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.coin;
        ctx.beginPath();
        ctx.ellipse(-1, -1, 6, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(-2, -6, 2, 8);
        ctx.restore();
    }
}

function drawFlag() {
    const f = level.flag;
    const poleX = f.x - cameraX;
    const topY = f.y - f.h;
    ctx.fillStyle = COLORS.pole;
    ctx.fillRect(poleX - 2, topY, 4, f.h);
    ctx.fillStyle = COLORS.flag;
    const flutter = Math.sin(state.time * 4) * 4;
    ctx.beginPath();
    ctx.moveTo(poleX + 2, topY + 30);
    ctx.lineTo(poleX + 2 + 56, topY + 30 + flutter);
    ctx.lineTo(poleX + 2 + 42, topY + 64 + flutter);
    ctx.lineTo(poleX + 2, topY + 64);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(poleX + 2, topY + 30, 2, 34);
}

function drawEnemy(e) {
    const x = e.x - cameraX;
    const y = e.y;
    if (!e.alive && e.stompedTimer <= 0) return;
    const alive = e.alive;
    const squish = alive ? 1 : 0.45;

    ctx.save();
    ctx.translate(x + e.w / 2, y + e.h);
    ctx.scale(1, squish);
    ctx.translate(-(x + e.w / 2), -(y + e.h));
    ctx.fillStyle = COLORS.enemy;
    ctx.fillRect(x, y, e.w, e.h);
    ctx.fillStyle = COLORS.enemyDark;
    ctx.fillRect(x, y + e.h - 5, e.w, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x + 5, y + 6, 4, 4);
    ctx.fillRect(x + e.w - 9, y + 6, 4, 4);
    ctx.restore();
}

function drawPlayer() {
    const x = Math.floor(player.x - cameraX);
    const y = Math.floor(player.y);

    if (player.invuln > 0 && Math.floor(state.time * 12) % 2 === 0) {
        ctx.globalAlpha = 0.55;
    }

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + player.w / 2, y + player.h + 4, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    const run = Math.abs(player.vx) > 10 && player.onGround;
    const phase = run ? Math.floor(player.anim * 14) % 2 : 0;

    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(x, y + 6, player.w, player.h - 6);
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(x, y + 6, player.w, 8);
    ctx.fillStyle = '#f5f6fa';
    ctx.fillRect(x + 6, y + 16, player.w - 12, 10);
    ctx.fillStyle = '#1e272e';
    const eyeX = player.face > 0 ? x + player.w - 7 : x + 5;
    ctx.fillRect(eyeX, y + 19, 3, 3);

    ctx.fillStyle = '#2d3436';
    const footY = y + player.h - 4 + (phase === 0 ? 0 : 2);
    ctx.fillRect(x + 3, footY, 7, 4);
    ctx.fillRect(x + player.w - 10, footY - (phase === 0 ? 2 : 0), 7, 4);

    ctx.globalAlpha = 1;
}

function drawParticles() {
    for (const p of particles) {
        const t = p.age / p.life;
        const alpha = 1 - t;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(Math.floor(p.x - cameraX), Math.floor(p.y), 2, 2);
    }
    ctx.globalAlpha = 1;
}

function drawWorld() {
    drawBackground();

    const startTx = Math.floor(cameraX / TILE) - 2;
    const endTx = startTx + Math.ceil(VIEW_W / TILE) + 4;
    for (let ty = 0; ty < level.height; ty++) {
        for (let tx = startTx; tx <= endTx; tx++) {
            const t = tileAt(tx, ty);
            if (t) drawTile(tx, ty, t);
        }
    }

    drawFlag();
    drawCoins();

    for (const e of level.enemies) drawEnemy(e);
    drawPlayer();
    drawParticles();
}

function update(dt) {
    state.time += dt;
    handlePlayer(dt);
    handleCoins();
    handleEnemies(dt);
    checkFlag();
    updateCamera(dt);
    updateParticles(dt);
}

let last = performance.now();
let acc = 0;
const FIXED = 1 / 120;

function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (!state.paused && !state.dead && !state.won) {
        acc += dt;
        while (acc >= FIXED) {
            update(FIXED);
            acc -= FIXED;
        }
    }

    drawWorld();
    requestAnimationFrame(frame);
}

// Input handling
document.addEventListener('keydown', (e) => {
    state.keys[e.key] = true;

    if (e.key === 'p' || e.key === 'P') {
        setPaused(!state.paused);
    }
    if ((e.key === 'r' || e.key === 'R') && (state.dead || state.won)) {
        resetLevel(true);
        state.paused = false;
        closeModal();
    }
    if (e.key === 'Enter' && state.paused && modal.getAttribute('aria-hidden') === 'false') {
        setPaused(false);
    }
});

document.addEventListener('keyup', (e) => {
    state.keys[e.key] = false;
});

function bindHoldButton(btn, key) {
    if (!btn) return;
    const down = (ev) => {
        ev.preventDefault();
        state.keys[key] = true;
        ensureAudio();
    };
    const up = (ev) => {
        ev.preventDefault();
        state.keys[key] = false;
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
}

bindHoldButton(touchLeft, 'ArrowLeft');
bindHoldButton(touchRight, 'ArrowRight');
bindHoldButton(touchJump, ' ');

btnPause.addEventListener('click', () => setPaused(!state.paused));
btnRestart.addEventListener('click', () => {
    resetLevel(true);
    state.paused = false;
    closeModal();
});
btnSound.addEventListener('click', () => setSound(!state.soundOn));
btnStart.addEventListener('click', () => {
    ensureAudio();
    resetLevel(true);
    setPaused(false);
});
btnResume.addEventListener('click', () => setPaused(false));

// Prevent scrolling on mobile
document.addEventListener(
    'touchmove',
    (e) => {
        e.preventDefault();
    },
    { passive: false }
);

resetLevel(true);
updateHud();
openModal('Super Mario Mini', 'Collect coins, stomp enemies, reach the flag.', false);
requestAnimationFrame(frame);
