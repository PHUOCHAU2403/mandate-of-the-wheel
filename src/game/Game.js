// Core simulation: fixed-timestep survivors engine with object pools, waves,
// signature skills, troops, bosses and level-ups. All randomness comes from this.rng.

import { RNG } from './rng.js';
import { TIERS } from './generals.js';
import { generateCards, findUpgrade } from './upgrades.js';
import { ENEMY_TYPES, waveConfig } from './enemies.js';
import { FORMS, formForLevel } from './forms.js';
import { liveMode } from '../squeek/wheel.js';
import { wheelEffects } from '../squeek/effects.js';
import { ARENA, WAVE_DURATION, TOTAL_WAVES } from './constants.js';
import { Input } from './Input.js';
import { Renderer } from './Renderer.js';

const STEP = 1 / 60;
const MAX_ENEMIES = 300;
const MAX_PROJECTILES = 600;
const MAX_GEMS = 400;
const MAX_PARTICLES = 180;
const MAX_NUMBERS = 70;
const CELL = 80;
const GRID_N = ARENA / CELL;
const TAU = Math.PI * 2;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

function closestOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
  return { x: x1 + dx * t, y: y1 + dy * t };
}

export function xpForLevel(l) {
  return Math.floor(8 + l * 6 + l * l * 0.5);
}

function makePool(n, factory) {
  const items = [];
  const free = [];
  for (let i = 0; i < n; i++) {
    const o = factory();
    o.active = false;
    o.idx = i;
    items.push(o);
    free.push(i);
  }
  return { items, free };
}

const enemyFactory = () => ({
  type: 'peasant', id: 0, x: 0, y: 0, r: 12, hp: 1, maxHp: 1, speed: 0, dmg: 0, xp: 1,
  flash: 0, stun: 0, kx: 0, ky: 0, hitCd: 0, shootCd: 0, summonCd: 0,
  burnDps: 0, burnTime: 0, dotAcc: 0, dotTimer: 0, slow: 1, boss: false, inFire: false, ai: null,
});
const projectileFactory = () => ({
  x: 0, y: 0, vx: 0, vy: 0, r: 5, dmg: 0, crit: false, kind: 'arrow', owner: 'player', pierce: 0, burn: 0, life: 0, hits: [],
});
const gemFactory = () => ({ x: 0, y: 0, vx: 0, vy: 0, value: 1, pulled: false, seed: 0 });
const particleFactory = () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, color: '#fff', size: 3 });
const numberFactory = () => ({ x: 0, y: 0, text: '', color: '#fff', size: 14, life: 0, maxLife: 0.8 });

export function defaultMods() {
  return {
    maxHp: 0, armor: 0, damageMult: 1, attackSpeedMult: 1, moveSpeedMult: 1, crit: 0, lifesteal: 0,
    pickupRange: 0, regen: 0, rangeMult: 1,
    sigDmgMult: 1, sigCdReduce: 0,
    roarRadius: 0, roarStun: 0, roarDmgMult: 1, soldiers: 0, taunt: 0,
    dashCharges: 0, dashDmgMult: 1, dashHeal: 0, riders: 0, trample: 0,
    arrows: 0, pierce: 0, fireArrows: 0, archers: 0,
    burnDuration: 0, fireSpread: 0, eastWind: 0, crossbowRate: 1, trigrams: 0, slowField: 0,
  };
}

export class Game {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.cb = callbacks;
    this.input = new Input(canvas);
    this.renderer = new Renderer(canvas, this);
    this.state = 'idle';
    this.player = null;
    this.raf = 0;
    this.lastTime = performance.now();
    this.acc = 0;
    this.hudTimer = 0;
    this.shake = 0;
    this.grid = [];
    for (let i = 0; i < GRID_N * GRID_N; i++) this.grid.push([]);
    // Squeekchain: the live wheel reading (pushed by App), the state the battle shows, and its effects.
    this.wheelSnap = { mode: 'unknown', reason: 'loading' };
    this.wheelShown = 'unknown';
    this.wheelPending = null;
    this.wheelPendingT = 0;
    this.fx = wheelEffects('unknown');
    this.roundSource = () => ({ round: 0, secondsLeft: 0 });
    this.treasures = [];
    this.form = 0;
    this.pendingForm = 0;
    this.loop = this.loop.bind(this);
    this.onResize = () => this.renderer.resize();
    this.onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.togglePause();
      }
    };
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKey);
    this.renderer.resize();
  }

  // ---------- lifecycle ----------

  start(general, seed) {
    this.general = general;
    this.seed = seed;
    this.rng = new RNG(seed);
    this.renderer.prepare(this.rng, general);

    const tierMult = TIERS[general.tier] || 1;
    const bs = general.baseStats;
    this.base = {
      maxHp: bs.maxHp * tierMult,
      damage: bs.damage * tierMult,
      attackSpeed: bs.attackSpeed * (1 + (tierMult - 1) * 0.5),
      moveSpeed: bs.moveSpeed * (1 + (tierMult - 1) * 0.3),
      armor: bs.armor * tierMult,
      crit: bs.crit,
      range: bs.range,
    };
    this.mods = defaultMods();
    this.levels = { [general.signatureSkill.id]: 1 };
    this.totals = {};
    this.build = [];

    this.player = {
      x: ARENA / 2, y: ARENA / 2, r: 16, hp: 0, facing: 0, flash: 0, invuln: 0,
      dashing: 0, dashVx: 0, dashVy: 0, dashRest: 0, attackCd: 0.4,
      level: 1, xp: 0, xpNeeded: xpForLevel(1), trail: [], moving: false,
    };
    this.player.hp = this.maxHp;
    this.sig = { cd: 0, charges: 1 };
    this.dashHit = new Set();
    this.troops = { angle: 0, soldiers: [], archers: [], crossbows: [], riders: [] };

    this.enemies = makePool(MAX_ENEMIES, enemyFactory);
    this.projectiles = makePool(MAX_PROJECTILES, projectileFactory);
    this.gems = makePool(MAX_GEMS, gemFactory);
    this.particles = makePool(MAX_PARTICLES, particleFactory);
    this.numbers = makePool(MAX_NUMBERS, numberFactory);
    this.fireZones = [];
    this.rainArrows = [];
    this.telegraphs = [];
    this.slashes = [];
    this.rings = [];
    this.flashes = [];

    this.wave = 1;
    this.waveTime = 0;
    this.wavesCleared = 0;
    this.waveActive = false;
    this.spawnAcc = 0;
    this.banner = 2.5;
    this.kills = 0;
    this.time = 0;
    this.boss = null;
    this.pendingLevelUps = 0;
    this.slowmo = 0;
    this.shake = 0;
    this.enemySeq = 1;
    this.results = null;
    this.cards = null;
    this.prevState = 'playing';

    this.treasures = [];
    this.form = 0;
    this.pendingForm = 0;
    this.runStats = { running: 0, resting: 0, unknown: 0, treasures: 0, blocks: 0, rounds: 0, heralds: 0, forms: 0 };
    this.runRound = this.roundSource().round;
    this.wheelShown = liveMode(this.wheelSnap);
    this.wheelPending = null;
    this.fx = wheelEffects(this.wheelShown, this.wheelSnap.rpm, this.base.armor);

    this.rebuildTroops();
    this.renderer.cam.x = this.player.x;
    this.renderer.cam.y = this.player.y;
    if (this.cb.onBanner) this.cb.onBanner('Wave 1', 'The predators close in');
    this.state = 'playing';
    this.lastTime = performance.now();
    this.acc = 0;
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
    this.emitHud();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.state = 'destroyed';
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    this.input.destroy();
  }

  loop() {
    if (this.state === 'destroyed') return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const frame = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;

    if (this.state === 'playing' || this.state === 'slowmo') {
      let scale = 1;
      if (this.state === 'slowmo') {
        scale = 0.18;
        this.slowmo -= frame;
        if (this.slowmo <= 0) this.openLevelUp();
      }
      this.acc += frame * scale;
      let steps = 0;
      while (this.acc >= STEP && steps < 5) {
        this.step(STEP);
        this.acc -= STEP;
        steps++;
        if (this.state !== 'playing' && this.state !== 'slowmo') break;
      }
      this.hudTimer += frame;
      if (this.hudTimer > 0.1) {
        this.hudTimer = 0;
        this.emitHud();
      }
    }
    this.renderer.render(frame);
  }

  step(dt) {
    this.time += dt;
    this.updateWave(dt);
    this.updateWheel(dt);
    this.updatePlayer(dt);
    this.buildGrid();
    this.updateCombat(dt);
    if (this.state === 'ended') return;
    this.updateEnemies(dt);
    if (this.state === 'ended') return;
    this.updateProjectiles(dt);
    this.updateZones(dt);
    if (this.state === 'ended') return;
    this.updateGems(dt);
    this.updateTreasures(dt);
    if (this.pendingForm > this.form) this.transform(this.pendingForm);
    this.updateFx(dt);
    if (this.player.hp <= 0) {
      this.endGame(false);
      return;
    }
    if (this.pendingLevelUps > 0 && this.state === 'playing') {
      this.state = 'slowmo';
      this.slowmo = 0.55;
    }
  }

  // ---------- derived stats ----------

  get maxHp() { return Math.round(this.base.maxHp + this.mods.maxHp); }
  get formFx() { return FORMS[this.form]; }
  get damage() { return this.base.damage * this.mods.damageMult * this.formFx.dmg; }
  get attackSpeed() { return this.base.attackSpeed * this.mods.attackSpeedMult * this.fx.atk * this.formFx.atk; }
  get moveSpeed() { return this.base.moveSpeed * this.mods.moveSpeedMult * this.fx.move * this.formFx.move; }
  get armor() { return this.base.armor + this.mods.armor + this.fx.armor + this.formFx.armor; }
  get critChance() { return Math.min(1, this.base.crit + this.mods.crit); }
  get pickupRange() { return 70 + this.mods.pickupRange; }
  get range() { return this.base.range * this.mods.rangeMult * this.formFx.range; }
  get sigLevel() { return this.levels[this.general.signatureSkill.id] || 1; }
  get awakened() { return this.sigLevel >= 5; }
  get sigCooldown() { return Math.max(1.5, this.general.signatureSkill.cooldown - this.mods.sigCdReduce); }
  get aliveEnemies() { return MAX_ENEMIES - this.enemies.free.length; }

  // ---------- pools & spatial grid ----------

  alloc(pool) {
    const idx = pool.free.pop();
    if (idx === undefined) return null;
    const o = pool.items[idx];
    o.active = true;
    return o;
  }

  release(pool, o) {
    if (!o.active) return;
    o.active = false;
    pool.free.push(o.idx);
  }

  buildGrid() {
    const g = this.grid;
    for (let i = 0; i < g.length; i++) g[i].length = 0;
    const items = this.enemies.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active) continue;
      const cx = clamp(Math.floor(e.x / CELL), 0, GRID_N - 1);
      const cy = clamp(Math.floor(e.y / CELL), 0, GRID_N - 1);
      g[cy * GRID_N + cx].push(e);
    }
  }

  forNeighbors(x, y, r, fn) {
    const x0 = clamp(Math.floor((x - r) / CELL), 0, GRID_N - 1);
    const x1 = clamp(Math.floor((x + r) / CELL), 0, GRID_N - 1);
    const y0 = clamp(Math.floor((y - r) / CELL), 0, GRID_N - 1);
    const y1 = clamp(Math.floor((y + r) / CELL), 0, GRID_N - 1);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const b = this.grid[cy * GRID_N + cx];
        for (let i = 0; i < b.length; i++) {
          const e = b[i];
          if (e.active) fn(e);
        }
      }
    }
  }

  nearestEnemy(x, y, range = Infinity) {
    let best = null;
    let bestD = range * range;
    const items = this.enemies.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) {
        bestD = d2;
        best = e;
      }
    }
    return best;
  }

  countWithin(x, y, r) {
    let n = 0;
    const r2 = r * r;
    this.forNeighbors(x, y, r, (e) => {
      const dx = e.x - x;
      const dy = e.y - y;
      if (dx * dx + dy * dy < r2) n++;
    });
    return n;
  }

  // ---------- waves & spawning ----------

  updateWave(dt) {
    if (this.banner > 0) {
      this.banner -= dt;
      if (this.banner <= 0) {
        this.waveActive = true;
        this.waveTime = 0;
        this.spawnAcc = 0;
        const cfg = waveConfig(this.wave);
        if (cfg.boss) this.spawnBoss(cfg.boss);
      }
      return;
    }
    if (!this.waveActive) return;
    this.waveTime += dt;
    const cfg = waveConfig(this.wave);
    if (this.waveTime < WAVE_DURATION) {
      this.spawnAcc += cfg.rate * dt;
      while (this.spawnAcc >= 1) {
        this.spawnAcc -= 1;
        if (this.aliveEnemies < cfg.cap) this.spawnEnemy(this.pickEnemyType(cfg));
      }
    }
    const bossAlive = this.boss && this.boss.active;
    if (this.waveTime >= WAVE_DURATION && !bossAlive) {
      if (this.wave >= TOTAL_WAVES) return; // wave 10 ends only when the Storm Owl falls
      this.waveActive = false;
      this.wavesCleared++;
      this.wave++;
      this.banner = 2.5;
      const healAmt = Math.round(this.maxHp * 0.3);
      if (healAmt > 0) {
        this.heal(healAmt);
        this.spawnNumber(this.player.x, this.player.y - 34, `+${healAmt}`, '#5dff8f', 20);
        this.burst(this.player.x, this.player.y, 10, '#5dff8f', 90);
      }
      const next = waveConfig(this.wave);
      const sub = next.boss ? `Boss: ${ENEMY_TYPES[next.boss].name}` : '';
      if (this.cb.onBanner) this.cb.onBanner(`Wave ${this.wave}`, sub);
    }
  }

  pickEnemyType(cfg) {
    const w = cfg.weights;
    const total = w.peasant + w.spearman + w.archer + w.sorcerer;
    let r = this.rng.next() * total;
    if ((r -= w.peasant) < 0) return 'peasant';
    if ((r -= w.spearman) < 0) return 'spearman';
    if ((r -= w.archer) < 0) return 'archer';
    return 'sorcerer';
  }

  spawnPosition(dist = 720) {
    const p = this.player;
    for (let i = 0; i < 6; i++) {
      const a = this.rng.range(0, TAU);
      const x = p.x + Math.cos(a) * dist;
      const y = p.y + Math.sin(a) * dist;
      if (x > 30 && x < ARENA - 30 && y > 30 && y < ARENA - 30) return { x, y };
    }
    const a = this.rng.range(0, TAU);
    return {
      x: clamp(p.x + Math.cos(a) * dist, 30, ARENA - 30),
      y: clamp(p.y + Math.sin(a) * dist, 30, ARENA - 30),
    };
  }

  spawnEnemy(type, x, y) {
    const e = this.alloc(this.enemies);
    if (!e) return null;
    const t = ENEMY_TYPES[type];
    const cfg = waveConfig(this.wave);
    const boss = !!t.boss;
    e.type = type;
    e.id = this.enemySeq++;
    e.boss = boss;
    e.elite = !!t.elite;
    e.r = t.r;
    e.maxHp = Math.round(t.hp * (boss ? 1 : cfg.hpMult));
    e.hp = e.maxHp;
    e.speed = t.speed * (boss ? 1 : cfg.speedMult);
    e.dmg = t.dmg * (boss ? 1 : cfg.dmgMult);
    e.xp = Math.max(1, Math.round(t.xp * cfg.xpMult));
    e.flash = 0;
    e.stun = 0;
    e.kx = 0;
    e.ky = 0;
    e.hitCd = 0;
    e.shootCd = t.shootCd ? this.rng.range(0.6, t.shootCd) : 0;
    e.summonCd = t.summonCd || 0;
    e.burnDps = 0;
    e.burnTime = 0;
    e.dotAcc = 0;
    e.dotTimer = 0;
    e.slow = 1;
    e.inFire = false;
    e.ai = boss ? { phase: 'chase', timer: 3, summon: 6, ang: 0 } : null;
    if (x === undefined) {
      const pos = this.spawnPosition();
      e.x = pos.x;
      e.y = pos.y;
    } else {
      e.x = clamp(x, 20, ARENA - 20);
      e.y = clamp(y, 20, ARENA - 20);
    }
    return e;
  }

  spawnBoss(type) {
    const pos = this.spawnPosition(520);
    const e = this.spawnEnemy(type, pos.x, pos.y);
    if (e) {
      this.boss = e;
      this.shake = 10;
      this.burst(e.x, e.y, 30, ENEMY_TYPES[type].color, 220);
    }
  }

  summonAround(src, n, type) {
    const cfg = waveConfig(this.wave);
    for (let i = 0; i < n; i++) {
      if (this.aliveEnemies >= cfg.cap) return;
      const a = this.rng.range(0, TAU);
      const d = this.rng.range(40, 75);
      const e = this.spawnEnemy(type, src.x + Math.cos(a) * d, src.y + Math.sin(a) * d);
      if (e) this.burst(e.x, e.y, 4, '#b57cff', 80);
    }
  }

  // ---------- player ----------

  updatePlayer(dt) {
    const p = this.player;
    p.flash = Math.max(0, p.flash - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.dashRest = Math.max(0, p.dashRest - dt);
    for (let i = p.trail.length - 1; i >= 0; i--) {
      p.trail[i].life -= dt;
      if (p.trail[i].life <= 0) p.trail.splice(i, 1);
    }
    if (p.dashing > 0) {
      p.dashing -= dt;
      p.x += p.dashVx * dt;
      p.y += p.dashVy * dt;
      p.trail.push({ x: p.x, y: p.y, life: 0.35 });
      this.dashHits();
      p.moving = true;
      if (p.dashing <= 0) p.dashRest = 0.3;
    } else {
      const a = this.input.getAxis();
      if (a.x || a.y) {
        const sp = this.moveSpeed;
        p.x += a.x * sp * dt;
        p.y += a.y * sp * dt;
        p.facing = Math.atan2(a.y, a.x);
        p.moving = true;
      } else {
        p.moving = false;
      }
    }
    p.x = clamp(p.x, p.r + 8, ARENA - p.r - 8);
    p.y = clamp(p.y, p.r + 8, ARENA - p.r - 8);
    const totalRegen = 0.5 + this.mods.regen + this.fx.regenPct * this.maxHp;
    if (totalRegen > 0) p.hp = Math.min(this.maxHp, p.hp + totalRegen * dt);
  }

  dashHits() {
    const p = this.player;
    const radius = this.awakened ? 52 : 36;
    const dmg = this.damage * 1.8 * this.mods.dashDmgMult * this.mods.sigDmgMult;
    const dirx = Math.cos(p.facing);
    const diry = Math.sin(p.facing);
    this.forNeighbors(p.x, p.y, radius + 20, (e) => {
      if (this.dashHit.has(e.id)) return;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy > (radius + e.r) * (radius + e.r)) return;
      this.dashHit.add(e.id);
      const crit = this.rng.chance(this.critChance);
      const side = dx * -diry + dy * dirx > 0 ? 1 : -1;
      e.kx += -diry * side * 260;
      e.ky += dirx * side * 260;
      if (this.mods.dashHeal > 0) this.heal(this.mods.dashHeal);
      this.damageEnemy(e, dmg * (crit ? 2 : 1), crit, true);
    });
  }

  heal(amount) {
    const p = this.player;
    p.hp = Math.min(this.maxHp, p.hp + amount);
  }

  damagePlayer(raw) {
    const p = this.player;
    if (p.invuln > 0 || p.dashing > 0) return;
    const red = this.armor / (this.armor + 25);
    const trig = Math.min(0.5, this.mods.trigrams);
    const dmg = Math.max(1, Math.round(raw * (1 - red) * (1 - trig)));
    p.hp -= dmg;
    p.flash = 0.18;
    this.shake = Math.max(this.shake, 3);
    this.spawnNumber(p.x, p.y - 26, `-${dmg}`, '#ff5555', 16);
    this.burst(p.x, p.y, 4, '#ff6a6a', 90);
  }

  // ---------- combat ----------

  updateCombat(dt) {
    const p = this.player;
    p.attackCd -= dt;
    if (p.attackCd <= 0) {
      const target = this.nearestEnemy(p.x, p.y, this.range);
      if (target) {
        p.attackCd = 1 / this.attackSpeed;
        this.basicAttack(target);
      }
    }
    this.updateSignature(dt);
    this.updateTroops(dt);
  }

  basicAttack(target) {
    const p = this.player;
    const bs = this.general.baseStats;
    const ang = Math.atan2(target.y - p.y, target.x - p.x);
    p.facing = ang;
    const crit = this.rng.chance(this.critChance);
    const dmg = this.damage * (crit ? 2 : 1);
    if (bs.attackType === 'melee') {
      const range = this.range;
      this.slashes.push({ x: p.x, y: p.y, ang, r: range, life: 0.16, max: 0.16 });
      this.forNeighbors(p.x, p.y, range + 20, (e) => {
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d > range + e.r) return;
        const a = Math.atan2(dy, dx);
        if (Math.abs(angleDiff(a, ang)) > Math.PI / 3 && d > 34) return;
        e.kx += Math.cos(a) * 110;
        e.ky += Math.sin(a) * 110;
        this.damageEnemy(e, dmg, crit, true);
      });
    } else {
      this.fireProjectile({
        x: p.x, y: p.y, ang, speed: bs.projectileSpeed, dmg, crit, kind: bs.projectile,
        pierce: this.mods.pierce, burn: this.mods.fireArrows, range: this.range + 80, r: 6,
      });
    }
  }

  fireProjectile(o) {
    const pr = this.alloc(this.projectiles);
    if (!pr) return null;
    pr.x = o.x;
    pr.y = o.y;
    pr.vx = Math.cos(o.ang) * o.speed;
    pr.vy = Math.sin(o.ang) * o.speed;
    pr.r = o.r || 5;
    pr.dmg = o.dmg;
    pr.crit = !!o.crit;
    pr.kind = o.kind;
    pr.owner = o.owner || 'player';
    pr.pierce = o.pierce || 0;
    pr.burn = o.burn || 0;
    pr.life = o.range / o.speed;
    pr.hits.length = 0;
    return pr;
  }

  damageEnemy(e, amount, crit = false, fromPlayer = false, color = null, size = 0) {
    if (!e.active) return false;
    const dmg = Math.max(1, Math.round(amount));
    e.hp -= dmg;
    e.flash = 0.1;
    this.spawnNumber(
      e.x + this.rng.range(-8, 8), e.y - e.r - 4, String(dmg),
      crit ? '#ff9a2e' : color || '#ffffff', size || (crit ? 22 : 14),
    );
    if (fromPlayer && this.mods.lifesteal > 0) this.heal(dmg * this.mods.lifesteal);
    if (e.hp <= 0) {
      this.killEnemy(e);
      return true;
    }
    return false;
  }

  killEnemy(e) {
    this.kills++;
    const t = ENEMY_TYPES[e.type];
    this.burst(e.x, e.y, e.boss ? 40 : 6, t.color, e.boss ? 260 : 120);
    this.dropGem(e.x, e.y, e.xp);
    this.release(this.enemies, e);
    if (e.elite) {
      this.runStats.heralds++;
      this.spawnTreasure(e.x, e.y, 'herald', 0);
    }
    if (e.boss) {
      this.boss = null;
      this.shake = 14;
      if (e.type === 'zhangjiao') {
        this.wavesCleared = TOTAL_WAVES;
        this.endGame(true);
      }
    }
  }

  dropGem(x, y, value) {
    const g = this.alloc(this.gems);
    if (!g) {
      // Pool full: merge into a random existing gem so no XP is lost.
      const items = this.gems.items;
      const o = items[this.rng.int(0, items.length - 1)];
      o.value += value;
      return;
    }
    g.x = x;
    g.y = y;
    const a = this.rng.range(0, TAU);
    const sp = this.rng.range(30, 90);
    g.vx = Math.cos(a) * sp;
    g.vy = Math.sin(a) * sp;
    g.value = value;
    g.pulled = false;
    g.seed = this.rng.range(0, TAU);
  }

  // ---------- signature skills ----------

  updateSignature(dt) {
    const id = this.general.signatureSkill.id;
    const s = this.sig;
    const p = this.player;
    const cdMax = this.sigCooldown;
    if (id === 'sig_dash') {
      const max = 1 + this.mods.dashCharges;
      if (s.charges < max) {
        s.cd -= dt;
        if (s.cd <= 0) {
          s.charges++;
          s.cd = cdMax;
        }
      }
      if (s.charges > 0 && p.dashing <= 0 && p.dashRest <= 0) {
        const target = this.nearestEnemy(p.x, p.y, 360);
        if (target) {
          if (s.charges === max) s.cd = cdMax;
          s.charges--;
          this.castDash(target);
        }
      }
      return;
    }
    s.cd -= dt;
    if (s.cd > 0) return;
    if (id === 'sig_roar') {
      const radius = this.roarRadius;
      if (this.countWithin(p.x, p.y, radius * 0.85) >= 1) {
        s.cd = cdMax;
        this.castRoar();
      }
    } else if (id === 'sig_rain') {
      if (this.aliveEnemies > 0) {
        s.cd = cdMax;
        this.castRain();
      }
    } else if (id === 'sig_fire') {
      if (this.nearestEnemy(p.x, p.y, 420)) {
        s.cd = cdMax;
        this.castFire();
      }
    }
  }

  get roarRadius() {
    return (130 + this.mods.roarRadius) * (this.awakened ? 1.35 : 1);
  }

  castRoar() {
    const p = this.player;
    const radius = this.roarRadius;
    const dmg = this.damage * 2.5 * this.mods.roarDmgMult * this.mods.sigDmgMult;
    const stun = 1 + this.mods.roarStun + (this.awakened ? 0.5 : 0);
    const r2 = radius * radius;
    this.forNeighbors(p.x, p.y, radius + 30, (e) => {
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) return;
      const d = Math.sqrt(d2) || 1;
      const kb = e.boss ? 120 : 460;
      e.kx += (dx / d) * kb;
      e.ky += (dy / d) * kb;
      e.stun = Math.max(e.stun, e.boss ? stun * 0.4 : stun);
      this.damageEnemy(e, dmg, false, true);
    });
    this.rings.push({ x: p.x, y: p.y, max: radius, life: 0.5, maxLife: 0.5, color: '#ffd166', width: 7 });
    if (this.awakened) this.rings.push({ x: p.x, y: p.y, max: radius * 1.15, life: 0.75, maxLife: 0.75, color: '#ff7b2e', width: 10 });
    this.shake = Math.max(this.shake, this.awakened ? 9 : 5);
    this.burst(p.x, p.y, 16, '#ffd166', 240);
  }

  castDash(target) {
    const p = this.player;
    let dx = 0;
    let dy = 0;
    let n = 0;
    this.forNeighbors(p.x, p.y, 350, (e) => {
      const ex = e.x - p.x;
      const ey = e.y - p.y;
      if (ex * ex + ey * ey < 350 * 350) {
        dx += ex;
        dy += ey;
        n++;
      }
    });
    if (n === 0) {
      dx = target.x - p.x;
      dy = target.y - p.y;
    }
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    const length = this.awakened ? 400 : 290;
    const dur = 0.28;
    p.facing = Math.atan2(dy, dx);
    p.dashVx = (dx * length) / dur;
    p.dashVy = (dy * length) / dur;
    p.dashing = dur;
    p.invuln = dur + 0.12;
    this.dashHit.clear();
    this.burst(p.x, p.y, 8, '#9fe8ff', 160);
    this.spawnRiders(dx, dy);
  }

  spawnRiders(dirx, diry) {
    const n = 2 + this.mods.riders;
    const px = -diry;
    const py = dirx;
    const p = this.player;
    const dmg = this.damage * 1.5 * this.mods.sigDmgMult;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 42;
      this.troops.riders.push({
        x: p.x - dirx * 520 + px * off,
        y: p.y - diry * 520 + py * off,
        vx: dirx * 680,
        vy: diry * 680,
        ang: Math.atan2(diry, dirx),
        life: 1.9,
        hit: new Set(),
        dmg,
      });
    }
  }

  castRain() {
    const p = this.player;
    const items = this.enemies.items;
    const alive = this.aliveEnemies;
    const stride = Math.max(1, Math.floor(alive / 80));
    let best = null;
    let bestN = -1;
    let seen = 0;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active) continue;
      if (seen++ % stride !== 0) continue;
      const n = this.countWithin(e.x, e.y, 110) + (e.boss ? 3 : 0);
      if (n > bestN) {
        bestN = n;
        best = e;
      }
    }
    if (!best) best = p;
    const count = Math.round((8 + this.mods.arrows) * (this.awakened ? 1.5 : 1));
    const spread = this.awakened ? 130 : 95;
    const dmg = this.damage * 1.2 * this.mods.sigDmgMult;
    for (let i = 0; i < count; i++) {
      const a = this.rng.range(0, TAU);
      const d = Math.sqrt(this.rng.next()) * spread;
      this.rainArrows.push({
        x: best.x + Math.cos(a) * d,
        y: best.y + Math.sin(a) * d,
        delay: this.rng.range(0, 0.9),
        t: 0,
        dmg,
      });
    }
    this.rings.push({ x: best.x, y: best.y, max: spread + 20, life: 1.0, maxLife: 1.0, color: '#ffe9a0', width: 2 });
  }

  castFire() {
    const p = this.player;
    const lines = 2 + this.mods.fireSpread;
    const width = 28 + this.mods.fireSpread * 6 + (this.awakened ? 10 : 0);
    const duration = 4 + this.mods.burnDuration;
    const dps = this.damage * 0.9 * this.mods.sigDmgMult * (this.awakened ? 1.3 : 1);
    const length = this.awakened ? 380 : 260;
    const near = [];
    this.forNeighbors(p.x, p.y, 420, (e) => {
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy < 420 * 420) near.push(e);
    });
    for (let i = 0; i < lines; i++) {
      let ang;
      if (near.length) {
        const e = this.rng.pick(near);
        ang = Math.atan2(e.y - p.y, e.x - p.x) + this.rng.range(-0.15, 0.15);
      } else {
        ang = this.rng.range(0, TAU);
      }
      const x1 = p.x + Math.cos(ang) * 30;
      const y1 = p.y + Math.sin(ang) * 30;
      this.fireZones.push({
        x1, y1, x2: x1 + Math.cos(ang) * length, y2: y1 + Math.sin(ang) * length,
        w: width, time: duration, maxTime: duration, dps, seed: this.rng.range(0, 100),
      });
    }
    this.burst(p.x, p.y, 10, '#ff8c3a', 140);
  }

  // ---------- troops ----------

  rebuildTroops() {
    const g = this.general.id;
    const t = this.troops;
    const want = g === 'zhangfei' ? 2 + this.mods.soldiers : 0;
    while (t.soldiers.length < want) t.soldiers.push({ x: this.player.x, y: this.player.y, hitCd: 0 });
    t.soldiers.length = want;
    const wantA = g === 'huangzhong' ? 2 + this.mods.archers : 0;
    while (t.archers.length < wantA) t.archers.push({ x: this.player.x, y: this.player.y, cd: this.rng.range(0.2, 1), ang: 0 });
    t.archers.length = wantA;
    const wantC = g === 'zhugeliang' ? 2 : 0;
    while (t.crossbows.length < wantC) t.crossbows.push({ x: this.player.x, y: this.player.y, cd: 0, ang: 0 });
    t.crossbows.length = wantC;
  }

  updateTroops(dt) {
    const p = this.player;
    const t = this.troops;
    t.angle += dt * 0.9;

    // Shield infantry: orbit, block and bash.
    const ns = t.soldiers.length;
    for (let i = 0; i < ns; i++) {
      const s = t.soldiers[i];
      const a = t.angle + (i / ns) * TAU;
      s.x = p.x + Math.cos(a) * 52;
      s.y = p.y + Math.sin(a) * 52;
      s.hitCd -= dt;
      let bashed = false;
      this.forNeighbors(s.x, s.y, 40, (e) => {
        const dx = e.x - s.x;
        const dy = e.y - s.y;
        const d = Math.hypot(dx, dy) || 1;
        const min = e.r + 12;
        if (d < min) {
          const push = (min - d) * (e.boss ? 0.2 : 1);
          e.x += (dx / d) * push;
          e.y += (dy / d) * push;
          if (s.hitCd <= 0) {
            this.damageEnemy(e, this.damage * 0.35, false, true);
            bashed = true;
          }
        }
      });
      if (bashed) s.hitCd = 0.5;
    }

    // Archers: orbit and shoot nearest.
    const na = t.archers.length;
    for (let i = 0; i < na; i++) {
      const s = t.archers[i];
      const a = -t.angle * 0.6 + (i / na) * TAU;
      s.x = p.x + Math.cos(a) * 46;
      s.y = p.y + Math.sin(a) * 46;
      s.cd -= dt;
      if (s.cd <= 0) {
        const target = this.nearestEnemy(s.x, s.y, 300 * this.mods.rangeMult);
        if (target) {
          s.cd = 1.1 / this.mods.attackSpeedMult;
          s.ang = Math.atan2(target.y - s.y, target.x - s.x);
          const crit = this.rng.chance(this.critChance);
          this.fireProjectile({
            x: s.x, y: s.y, ang: s.ang, speed: 520, dmg: this.damage * 0.6 * (crit ? 2 : 1), crit,
            kind: 'arrow', pierce: this.mods.pierce, burn: this.mods.fireArrows, range: 360 * this.mods.rangeMult, r: 5,
          });
        }
      }
    }

    // Crossbow squad: flank the general and fire rapid bolts.
    const nc = t.crossbows.length;
    for (let i = 0; i < nc; i++) {
      const s = t.crossbows[i];
      const side = i === 0 ? -1 : 1;
      s.x += (p.x + side * 30 - s.x) * Math.min(1, dt * 10);
      s.y += (p.y + 22 - s.y) * Math.min(1, dt * 10);
      s.cd -= dt;
      if (s.cd <= 0) {
        const target = this.nearestEnemy(s.x, s.y, 280);
        if (target) {
          s.cd = 0.32 / this.mods.crossbowRate;
          s.ang = Math.atan2(target.y - s.y, target.x - s.x);
          const crit = this.rng.chance(this.critChance);
          this.fireProjectile({
            x: s.x, y: s.y, ang: s.ang, speed: 600, dmg: this.damage * 0.4 * (crit ? 2 : 1), crit,
            kind: 'bolt', range: 320, r: 4,
          });
        }
      }
    }

    // Riders: charge in a line, trample everything on the way.
    const stunTime = this.mods.trample > 0 ? 0.5 + 0.3 * (this.mods.trample - 1) : 0;
    for (let i = t.riders.length - 1; i >= 0; i--) {
      const r = t.riders[i];
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.life -= dt;
      this.forNeighbors(r.x, r.y, 40, (e) => {
        if (r.hit.has(e.id)) return;
        const dx = e.x - r.x;
        const dy = e.y - r.y;
        if (dx * dx + dy * dy > (e.r + 16) * (e.r + 16)) return;
        r.hit.add(e.id);
        const vlen = Math.hypot(r.vx, r.vy) || 1;
        const nx = -r.vy / vlen;
        const ny = r.vx / vlen;
        const side = dx * nx + dy * ny > 0 ? 1 : -1;
        e.kx += nx * side * 220;
        e.ky += ny * side * 220;
        if (stunTime > 0) e.stun = Math.max(e.stun, e.boss ? stunTime * 0.3 : stunTime);
        this.damageEnemy(e, r.dmg, false, true);
      });
      if (r.life <= 0 || r.x < -100 || r.x > ARENA + 100 || r.y < -100 || r.y > ARENA + 100) t.riders.splice(i, 1);
    }
  }

  // ---------- enemies ----------

  updateEnemies(dt) {
    const p = this.player;
    const m = this.mods;
    const tauntRange = m.taunt > 0 ? 80 + 40 * m.taunt : 0;
    const slowF = 1 - Math.min(0.6, m.slowField);
    const soldiers = this.troops.soldiers;
    const items = this.enemies.items;

    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active) continue;
      const t = ENEMY_TYPES[e.type];
      e.flash = Math.max(0, e.flash - dt);
      e.hitCd -= dt;

      // Damage over time (burn + fire ground), flushed every 0.4s.
      if (e.burnTime > 0) {
        e.burnTime -= dt;
        e.dotAcc += e.burnDps * dt;
        if (e.burnTime <= 0) e.burnDps = 0;
      }
      if (e.dotAcc > 0) {
        e.dotTimer += dt;
        if (e.dotTimer >= 0.4) {
          e.dotTimer = 0;
          const d = e.dotAcc;
          e.dotAcc = 0;
          if (this.damageEnemy(e, d, false, true, '#ff8c3a', 12)) continue;
        }
      }

      // Knockback velocity.
      if (e.kx || e.ky) {
        e.x += e.kx * dt;
        e.y += e.ky * dt;
        const f = Math.max(0, 1 - 7 * dt);
        e.kx *= f;
        e.ky *= f;
        if (Math.abs(e.kx) < 2 && Math.abs(e.ky) < 2) {
          e.kx = 0;
          e.ky = 0;
        }
      }

      const pdx = p.x - e.x;
      const pdy = p.y - e.y;
      const pdist = Math.hypot(pdx, pdy) || 1;
      e.slow = m.slowField > 0 && pdist < 160 ? slowF : 1;

      if (e.stun > 0) {
        e.stun -= dt;
      } else {
        let tx = p.x;
        let ty = p.y;
        if (tauntRange > 0 && !e.boss && soldiers.length) {
          let best = tauntRange * tauntRange;
          for (let k = 0; k < soldiers.length; k++) {
            const s = soldiers[k];
            const dx = s.x - e.x;
            const dy = s.y - e.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < best) {
              best = d2;
              tx = s.x;
              ty = s.y;
            }
          }
        }
        const dx = tx - e.x;
        const dy = ty - e.y;
        const dist = Math.hypot(dx, dy) || 1;
        const sp = e.speed * e.slow;

        if (e.boss) {
          this.updateBoss(e, dt, pdist, pdx, pdy, sp);
        } else if (t.keepMin) {
          if (dist < t.keepMin) {
            e.x -= (dx / dist) * sp * dt;
            e.y -= (dy / dist) * sp * dt;
          } else if (dist > t.keepMax) {
            e.x += (dx / dist) * sp * dt;
            e.y += (dy / dist) * sp * dt;
          }
          if (t.shootCd) {
            e.shootCd -= dt;
            if (e.shootCd <= 0 && pdist < 460) {
              e.shootCd = t.shootCd;
              this.fireProjectile({
                x: e.x, y: e.y, ang: Math.atan2(pdy, pdx), speed: 300, dmg: e.dmg,
                kind: 'earrow', owner: 'enemy', range: 540, r: 5,
              });
            }
          }
          if (t.summonCd) {
            e.summonCd -= dt;
            if (e.summonCd <= 0) {
              e.summonCd = t.summonCd;
              this.summonAround(e, 3, 'peasant');
              this.rings.push({ x: e.x, y: e.y, max: 60, life: 0.4, maxLife: 0.4, color: '#b57cff', width: 3 });
            }
          }
        } else {
          e.x += (dx / dist) * sp * dt;
          e.y += (dy / dist) * sp * dt;
        }
        this.separate(e);
      }

      // Contact damage.
      if (pdist < e.r + p.r && e.hitCd <= 0) {
        e.hitCd = 0.8;
        this.damagePlayer(e.dmg);
      }
      e.x = clamp(e.x, e.r, ARENA - e.r);
      e.y = clamp(e.y, e.r, ARENA - e.r);
    }
  }

  separate(e) {
    let n = 0;
    this.forNeighbors(e.x, e.y, e.r + 18, (o) => {
      if (o === e || n > 8) return;
      const dx = e.x - o.x;
      const dy = e.y - o.y;
      const d2 = dx * dx + dy * dy;
      const min = e.r + o.r;
      if (d2 < min * min && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (min - d) * (o.boss ? 1 : 0.5);
        e.x += (dx / d) * push;
        e.y += (dy / d) * push;
        n++;
      }
    });
  }

  updateBoss(e, dt, pdist, pdx, pdy, sp) {
    const ai = e.ai;
    const p = this.player;
    ai.summon -= dt;
    if (ai.summon <= 0) {
      ai.summon = e.type === 'zhangbao' ? 8 : 7;
      this.summonAround(e, e.type === 'zhangbao' ? 4 : 5, 'peasant');
      if (e.type === 'zhangjiao' && e.hp < e.maxHp * 0.5) this.summonAround(e, 2, 'archer');
    }
    if (e.type === 'zhangbao') {
      ai.timer -= dt;
      if (ai.phase === 'chase') {
        e.x += (pdx / pdist) * sp * dt;
        e.y += (pdy / pdist) * sp * dt;
        if (ai.timer <= 0) {
          ai.phase = 'telegraph';
          ai.timer = 0.7;
          ai.ang = Math.atan2(pdy, pdx);
        }
      } else if (ai.phase === 'telegraph') {
        if (ai.timer > 0.3) ai.ang = Math.atan2(pdy, pdx);
        if (ai.timer <= 0) {
          ai.phase = 'charge';
          ai.timer = 0.5;
          e.hitCd = 0;
          this.shake = Math.max(this.shake, 7);
        }
      } else {
        e.x += Math.cos(ai.ang) * 560 * dt;
        e.y += Math.sin(ai.ang) * 560 * dt;
        this.burst(e.x, e.y, 1, '#ff6a3a', 60);
        if (ai.timer <= 0) {
          ai.phase = 'chase';
          ai.timer = 4;
        }
      }
    } else {
      if (pdist < 160) {
        e.x -= (pdx / pdist) * sp * dt;
        e.y -= (pdy / pdist) * sp * dt;
      } else if (pdist > 280) {
        e.x += (pdx / pdist) * sp * dt;
        e.y += (pdy / pdist) * sp * dt;
      }
      ai.timer -= dt;
      if (ai.timer <= 0) {
        const enraged = e.hp < e.maxHp * 0.5;
        ai.timer = enraged ? 2.4 : 3.4;
        const n = enraged ? 6 : 4;
        for (let i = 0; i < n; i++) {
          const ox = i === 0 ? 0 : this.rng.range(-180, 180);
          const oy = i === 0 ? 0 : this.rng.range(-180, 180);
          this.telegraphs.push({
            kind: 'lightning', x: clamp(p.x + ox, 40, ARENA - 40), y: clamp(p.y + oy, 40, ARENA - 40),
            r: 72, time: 1.25, max: 1.25, dmg: 36,
          });
        }
        this.rings.push({ x: e.x, y: e.y, max: 90, life: 0.5, maxLife: 0.5, color: '#8ec5ff', width: 4 });
      }
    }
  }

  // ---------- projectiles, zones, gems, fx ----------

  updateProjectiles(dt) {
    const p = this.player;
    const items = this.projectiles.items;
    const soldiers = this.troops.soldiers;
    for (let i = 0; i < items.length; i++) {
      const pr = items[i];
      if (!pr.active) continue;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      if (pr.life <= 0 || pr.x < 0 || pr.x > ARENA || pr.y < 0 || pr.y > ARENA) {
        this.release(this.projectiles, pr);
        continue;
      }
      if (pr.owner === 'enemy') {
        let blocked = false;
        for (let k = 0; k < soldiers.length; k++) {
          const s = soldiers[k];
          if (Math.hypot(s.x - pr.x, s.y - pr.y) < 13) {
            blocked = true;
            break;
          }
        }
        if (blocked) {
          this.burst(pr.x, pr.y, 3, '#cfcfcf', 70);
          this.release(this.projectiles, pr);
          continue;
        }
        if (Math.hypot(p.x - pr.x, p.y - pr.y) < p.r + pr.r) {
          this.damagePlayer(pr.dmg);
          this.release(this.projectiles, pr);
        }
        continue;
      }
      let dead = false;
      this.forNeighbors(pr.x, pr.y, pr.r + 36, (e) => {
        if (dead || pr.hits.includes(e.id)) return;
        const dx = e.x - pr.x;
        const dy = e.y - pr.y;
        if (dx * dx + dy * dy > (e.r + pr.r) * (e.r + pr.r)) return;
        pr.hits.push(e.id);
        if (pr.burn > 0) {
          e.burnTime = Math.max(e.burnTime, 2);
          e.burnDps = Math.max(e.burnDps, pr.burn);
        }
        this.damageEnemy(e, pr.dmg, pr.crit, true);
        if (pr.pierce > 0) pr.pierce--;
        else dead = true;
      });
      if (dead) this.release(this.projectiles, pr);
    }
  }

  updateZones(dt) {
    const p = this.player;

    // Fire ground + East Wind.
    for (let i = this.fireZones.length - 1; i >= 0; i--) {
      this.fireZones[i].time -= dt;
      if (this.fireZones[i].time <= 0) this.fireZones.splice(i, 1);
    }
    if (this.fireZones.length) {
      const wind = this.mods.eastWind;
      const items = this.enemies.items;
      for (let i = 0; i < items.length; i++) {
        const e = items[i];
        if (!e.active) continue;
        let inFire = false;
        let nearest = null;
        let nd = Infinity;
        for (let k = 0; k < this.fireZones.length; k++) {
          const z = this.fireZones[k];
          const q = closestOnSegment(e.x, e.y, z.x1, z.y1, z.x2, z.y2);
          const d = Math.hypot(q.x - e.x, q.y - e.y);
          if (d < z.w / 2 + e.r * 0.5) {
            inFire = true;
            e.dotAcc += z.dps * dt;
            if (this.awakened) {
              e.burnTime = Math.max(e.burnTime, 1.5);
              e.burnDps = Math.max(e.burnDps, z.dps * 0.35);
            }
          } else if (d < nd) {
            nd = d;
            nearest = q;
          }
        }
        e.inFire = inFire;
        if (!inFire && wind > 0 && nearest && nd < 240 && e.stun <= 0 && !e.boss) {
          const str = 50 * (1 + 0.5 * (wind - 1));
          e.x += ((nearest.x - e.x) / nd) * str * dt;
          e.y += ((nearest.y - e.y) / nd) * str * dt;
        }
      }
    }

    // Arrow Rain impacts.
    for (let i = this.rainArrows.length - 1; i >= 0; i--) {
      const a = this.rainArrows[i];
      a.delay -= dt;
      if (a.delay > 0) continue;
      a.t += dt;
      if (a.t >= 0.45) {
        const crit = this.rng.chance(this.critChance);
        this.forNeighbors(a.x, a.y, 40, (e) => {
          const dx = e.x - a.x;
          const dy = e.y - a.y;
          if (dx * dx + dy * dy > (30 + e.r) * (30 + e.r)) return;
          if (this.mods.fireArrows > 0) {
            e.burnTime = Math.max(e.burnTime, 2);
            e.burnDps = Math.max(e.burnDps, this.mods.fireArrows);
          }
          this.damageEnemy(e, a.dmg * (crit ? 2 : 1), crit, true);
        });
        this.burst(a.x, a.y, 3, '#ffe9a0', 90);
        this.rainArrows.splice(i, 1);
      }
    }

    // Lightning telegraphs.
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const tg = this.telegraphs[i];
      tg.time -= dt;
      if (tg.time <= 0) {
        if (Math.hypot(p.x - tg.x, p.y - tg.y) < tg.r + p.r * 0.5) this.damagePlayer(tg.dmg);
        this.shake = Math.max(this.shake, 9);
        this.burst(tg.x, tg.y, 10, '#bfe0ff', 220);
        this.flashes.push({ x: tg.x, y: tg.y, r: tg.r, life: 0.32, maxLife: 0.32 });
        this.telegraphs.splice(i, 1);
      }
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].life -= dt;
      if (this.rings[i].life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      this.slashes[i].life -= dt;
      if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].life -= dt;
      if (this.flashes[i].life <= 0) this.flashes.splice(i, 1);
    }
  }

  updateGems(dt) {
    const p = this.player;
    const range = this.pickupRange;
    const items = this.gems.items;
    for (let i = 0; i < items.length; i++) {
      const g = items[i];
      if (!g.active) continue;
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < range) g.pulled = true;
      if (g.pulled) {
        g.vx += (dx / d) * 2600 * dt;
        g.vy += (dy / d) * 2600 * dt;
        const sp = Math.hypot(g.vx, g.vy);
        if (sp > 900) {
          g.vx = (g.vx / sp) * 900;
          g.vy = (g.vy / sp) * 900;
        }
      } else {
        g.vx *= 0.9;
        g.vy *= 0.9;
      }
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (d < 18) {
        this.collectXp(g.value);
        this.burst(p.x, p.y - 10, 3, '#8dffb0', 80);
        this.release(this.gems, g);
      }
    }
  }

  collectXp(value) {
    const p = this.player;
    p.xp += value * this.fx.xp;
    while (p.xp >= p.xpNeeded) {
      p.xp -= p.xpNeeded;
      p.level++;
      p.xpNeeded = xpForLevel(p.level);
      this.pendingLevelUps++;
    }
    const f = formForLevel(p.level);
    if (f > this.pendingForm) this.pendingForm = f;
  }

  // Lv 5 / 10 / 15 / 20: fur, crest and aura change, stats climb, and a shockwave clears space.
  transform(f) {
    this.form = f;
    this.pendingForm = f;
    const def = FORMS[f];
    const p = this.player;
    this.renderer.setForm(f);
    this.renderer.transformT = 1;
    p.invuln = Math.max(p.invuln, 1.5);
    this.heal(Math.round(this.maxHp * 0.25));
    const R = 260;
    const dmg = this.damage * 3;
    this.forNeighbors(p.x, p.y, R, (e) => {
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > R) return;
      const kb = e.boss ? 140 : 520;
      e.kx += (dx / d) * kb;
      e.ky += (dy / d) * kb;
      e.stun = Math.max(e.stun, e.boss ? 0.3 : 0.8);
      this.damageEnemy(e, dmg, false, true, def.aura, 20);
    });
    this.rings.push({ x: p.x, y: p.y, max: R, life: 1, maxLife: 1, color: def.aura, width: 10 });
    this.burst(p.x, p.y, 40, def.aura, 320);
    this.shake = 14;
    this.runStats.forms = f;
    if (this.cb.onBanner) {
      const next = FORMS[f + 1];
      this.cb.onBanner(`${def.name}!`, next ? `Transformation ${f} of ${FORMS.length - 1} · next at Lv ${next.level}` : 'Final transformation');
    }
  }

  burst(x, y, n, color, speed) {
    for (let i = 0; i < n; i++) {
      const pt = this.alloc(this.particles);
      if (!pt) return;
      const a = this.rng.range(0, TAU);
      const sp = this.rng.range(speed * 0.3, speed);
      pt.x = x;
      pt.y = y;
      pt.vx = Math.cos(a) * sp;
      pt.vy = Math.sin(a) * sp;
      pt.maxLife = this.rng.range(0.3, 0.6);
      pt.life = pt.maxLife;
      pt.color = color;
      pt.size = this.rng.range(2, 4.5);
    }
  }

  spawnNumber(x, y, text, color, size) {
    const n = this.alloc(this.numbers);
    if (!n) return;
    n.x = x;
    n.y = y;
    n.text = text;
    n.color = color;
    n.size = size;
    n.maxLife = 0.8;
    n.life = 0.8;
  }

  updateFx(dt) {
    const ps = this.particles.items;
    for (let i = 0; i < ps.length; i++) {
      const pt = ps[i];
      if (!pt.active) continue;
      pt.life -= dt;
      if (pt.life <= 0) {
        this.release(this.particles, pt);
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.92;
      pt.vy *= 0.92;
    }
    const ns = this.numbers.items;
    for (let i = 0; i < ns.length; i++) {
      const n = ns[i];
      if (!n.active) continue;
      n.life -= dt;
      n.y -= 42 * dt;
      if (n.life <= 0) this.release(this.numbers, n);
    }
  }

  // ---------- Squeekchain: wheel state, round heralds, Imperial Treasures ----------

  setWheel(snap) {
    this.wheelSnap = snap || { mode: 'unknown', reason: 'offline' };
  }

  // A Squeek block settled on Ethereum while this run is live: one treasure per settlement,
  // however many blocks it completed (a busy round can settle about 40 at once).
  onSqueekBlocks(delta) {
    if (!this.player || (this.state !== 'playing' && this.state !== 'slowmo' && this.state !== 'levelup' && this.state !== 'paused')) return;
    this.runStats.blocks += delta;
    const p = this.player;
    const a = this.rng.range(0, TAU);
    const d = this.rng.range(170, 260);
    this.spawnTreasure(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 'block', delta);
    if (this.cb.onBanner) this.cb.onBanner('Squeek block settled', `${delta} block${delta > 1 ? 's' : ''} on Ethereum · an Imperial Treasure appears`);
  }

  updateWheel(dt) {
    const target = liveMode(this.wheelSnap);
    if (target !== this.wheelShown) {
      if (this.wheelPending !== target) {
        this.wheelPending = target;
        this.wheelPendingT = 0;
      }
      this.wheelPendingT += dt;
      // A hamster pauses between sprints: only call it a rest after 20 s of stillness.
      const need = target === 'resting' ? 20 : 1.5;
      if (this.wheelPendingT >= need) {
        this.wheelShown = target;
        this.wheelPending = null;
        this.announceWheel();
      }
    } else {
      this.wheelPending = null;
    }
    this.fx = wheelEffects(this.wheelShown, this.wheelSnap.rpm, this.base.armor);
    this.runStats[this.wheelShown] += dt;

    const r = this.roundSource().round;
    if (this.runRound > 0 && r > this.runRound) {
      this.runStats.rounds += r - this.runRound;
      this.spawnHerald(r);
    }
    if (r > 0) this.runRound = r;
  }

  announceWheel() {
    const p = this.player;
    const fx = wheelEffects(this.wheelShown, this.wheelSnap.rpm, this.base.armor);
    const sub = this.wheelShown === 'running'
      ? 'Squeektoshi takes to the wheel'
      : this.wheelShown === 'resting' ? 'Squeektoshi rests. The camp keeps watch' : 'The wheel cannot be seen';
    if (this.cb.onBanner) this.cb.onBanner(fx.title, sub);
    const color = this.wheelShown === 'running' ? '#ffd166' : this.wheelShown === 'resting' ? '#8ec5ff' : '#9aa39c';
    this.rings.push({ x: p.x, y: p.y, max: 180, life: 0.8, maxLife: 0.8, color, width: 6 });
    this.burst(p.x, p.y, 18, color, 200);
  }

  spawnHerald(round) {
    const pos = this.spawnPosition(560);
    const e = this.spawnEnemy('herald', pos.x, pos.y);
    if (!e) return;
    this.burst(e.x, e.y, 24, ENEMY_TYPES.herald.color, 220);
    this.shake = Math.max(this.shake, 5);
    if (this.cb.onBanner) this.cb.onBanner(`Round ${round} begins`, 'A Herald of the Wheel rides in. Defeat it for an Imperial Treasure');
  }

  spawnTreasure(x, y, kind, blocks) {
    this.treasures.push({
      x: clamp(x, 40, ARENA - 40), y: clamp(y, 40, ARENA - 40),
      kind, blocks, t: 0, seed: this.rng.range(0, TAU),
    });
  }

  updateTreasures(dt) {
    const p = this.player;
    const range = this.pickupRange * 1.4;
    for (let i = this.treasures.length - 1; i >= 0; i--) {
      const tr = this.treasures[i];
      tr.t += dt;
      const dx = p.x - tr.x;
      const dy = p.y - tr.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < range) {
        const pull = Math.min(d, 420 * dt);
        tr.x += (dx / d) * pull;
        tr.y += (dy / d) * pull;
      }
      if (d > 30) continue;
      this.treasures.splice(i, 1);
      this.runStats.treasures++;
      this.pendingLevelUps++;
      const healAmt = Math.round(this.maxHp * 0.2);
      this.heal(healAmt);
      this.spawnNumber(p.x, p.y - 34, `+${healAmt}`, '#5dff8f', 20);
      for (let k = 0; k < 8; k++) this.dropGem(tr.x, tr.y, 2 + this.wave);
      this.rings.push({ x: p.x, y: p.y, max: 200, life: 0.9, maxLife: 0.9, color: '#ffd166', width: 8 });
      this.burst(tr.x, tr.y, 30, '#ffd166', 260);
      if (this.cb.onBanner) {
        this.cb.onBanner('Imperial Treasure', tr.kind === 'block' ? `Minted by ${tr.blocks} Squeek block${tr.blocks > 1 ? 's' : ''}` : 'Spoils of the Herald');
      }
    }
  }

  // ---------- level-up, pause, end ----------

  openLevelUp() {
    this.state = 'levelup';
    this.cards = generateCards(this.rng, this.general, this.levels, this.totals);
    if (this.cb.onLevelUp) this.cb.onLevelUp(this.cards, this.player.level);
  }

  chooseCard(card) {
    if (this.state !== 'levelup') return;
    const def = card.def;
    const p = this.player;
    if (def.id === 'rations') {
      this.heal(card.value);
      this.spawnNumber(p.x, p.y - 30, `+${card.value}`, '#8dffb0', 18);
    } else {
      const oldMax = this.maxHp;
      this.levels[def.id] = (this.levels[def.id] || 0) + 1;
      this.totals[def.id] = Math.round(((this.totals[def.id] || 0) + card.value) * 10) / 10;
      def.apply(this.mods, card.value);
      const newMax = this.maxHp;
      if (newMax > oldMax) p.hp = Math.min(newMax, p.hp + (newMax - oldMax));
      this.build.push({
        id: def.id, name: def.name, icon: def.icon, rarity: card.rarity,
        level: this.levels[def.id], unique: def.pool === 'unique', text: card.text,
      });
      if (def.id === this.general.signatureSkill.id && this.levels[def.id] >= 5) {
        if (this.cb.onBanner) this.cb.onBanner('Awakened!', this.general.signatureSkill.name);
        this.rings.push({ x: p.x, y: p.y, max: 220, life: 0.9, maxLife: 0.9, color: '#ffd166', width: 8 });
        this.burst(p.x, p.y, 30, '#ffd166', 260);
      }
    }
    this.rebuildTroops();
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
    if (this.pendingLevelUps > 0) {
      this.openLevelUp();
    } else {
      this.cards = null;
      this.state = 'playing';
      this.acc = 0;
      if (this.cb.onLevelUp) this.cb.onLevelUp(null, p.level);
    }
    this.emitHud();
  }

  togglePause() {
    if (this.state === 'playing' || this.state === 'slowmo') {
      this.prevState = this.state;
      this.state = 'paused';
      if (this.cb.onPause) this.cb.onPause(true);
    } else if (this.state === 'paused') {
      this.state = this.prevState;
      this.acc = 0;
      if (this.cb.onPause) this.cb.onPause(false);
    }
  }

  endGame(victory) {
    if (this.state === 'ended') return;
    this.state = 'ended';
    const p = this.player;
    const hpPct = victory ? Math.round((100 * Math.max(0, p.hp)) / this.maxHp) : 0;
    const score = this.kills * 10 + this.wavesCleared * 1000 + (victory ? hpPct * 10 : 0);
    this.results = {
      victory,
      score,
      wave: this.wave,
      wavesCleared: this.wavesCleared,
      kills: this.kills,
      time: this.time,
      hpPct,
      level: p.level,
      build: this.build.slice(),
      seed: this.seed,
      general: this.general,
      wheel: { ...this.runStats },
      form: { idx: this.form, name: FORMS[this.form].name },
    };
    if (victory) this.burst(p.x, p.y, 40, '#ffd166', 300);
    this.emitHud();
    if (this.cb.onEnd) this.cb.onEnd(this.results);
  }

  emitHud() {
    if (!this.cb.onHud || !this.player) return;
    const p = this.player;
    const sigDef = this.general.signatureSkill;
    const cdMax = this.sigCooldown;
    const isDash = sigDef.id === 'sig_dash';
    const upgrades = Object.keys(this.levels).map((id) => {
      const def = findUpgrade(this.general, id);
      return { id, icon: def ? def.icon : '?', name: def ? def.name : id, level: this.levels[id], unique: def ? def.pool === 'unique' : false };
    });
    this.cb.onHud({
      hp: Math.max(0, Math.ceil(p.hp)),
      maxHp: this.maxHp,
      xp: p.xp,
      xpNeeded: p.xpNeeded,
      level: p.level,
      wave: this.wave,
      waveTime: this.waveActive ? Math.max(0, WAVE_DURATION - this.waveTime) : WAVE_DURATION,
      waveActive: this.waveActive,
      time: this.time,
      kills: this.kills,
      upgrades,
      form: { idx: this.form, name: FORMS[this.form].name, next: FORMS[this.form + 1] ? FORMS[this.form + 1].level : null },
      wheel: {
        mode: this.wheelShown,
        pending: this.wheelPending,
        title: this.fx.title,
        lines: this.fx.lines,
        treasures: this.treasures.length,
      },
      boss: this.boss && this.boss.active ? { name: ENEMY_TYPES[this.boss.type].name, hp: Math.max(0, this.boss.hp), maxHp: this.boss.maxHp } : null,
      sig: {
        name: sigDef.name,
        icon: sigDef.icon,
        ready: isDash ? (this.sig.charges > 0 ? 1 : 1 - Math.max(0, this.sig.cd) / cdMax) : 1 - Math.max(0, this.sig.cd) / cdMax,
        charges: isDash ? this.sig.charges : null,
        maxCharges: isDash ? 1 + this.mods.dashCharges : null,
        awakened: this.awakened,
      },
    });
  }
}
