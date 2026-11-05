// Canvas 2D renderer: everything is drawn procedurally (no image assets).
// Hamsters and predators are pre-rendered as 4-frame walk cycles + an attack
// frame into offscreen canvases, then blitted each frame for speed.

import { ARENA } from './constants.js';
import { ENEMY_TYPES } from './enemies.js';
import {
  drawHamster,
  drawHamsterBall,
  HAMSTER_ART,
  PUP_ART,
  PREDATOR_ART,
  PREDATOR_BOSS_ART,
  HERALD_ART,
} from './animalArt.js';
import { FORMS, formLook } from './forms.js';

const TAU = Math.PI * 2;
const RES = 2.5;
const LOD_DIST = 680;
const LOD_DIST2 = LOD_DIST * LOD_DIST;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Pixel radii for each archetype: the hero hamster is about 2x its pups, bosses about 3x a soldier.
const SOLDIER_R = 15;
const GENERAL_R = 33;
const RIDER_R = 17;
const ENEMY_R = { peasant: 15, spearman: 19, archer: 16, sorcerer: 19 };
const BOSS_R = 54;

function makeSprite(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(size * RES);
  const g = c.getContext('2d');
  g.scale(RES, RES);
  g.translate(size / 2, size / 2);
  draw(g);
  return { canvas: c, size };
}

function tintVariant(sprite, rgba) {
  const c = document.createElement('canvas');
  c.width = c.height = sprite.canvas.width;
  const g = c.getContext('2d');
  g.drawImage(sprite.canvas, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = rgba;
  g.fillRect(0, 0, c.width, c.height);
  return { canvas: c, size: sprite.size, upright: sprite.upright };
}

function flashVariant(sprite) {
  return tintVariant(sprite, 'rgba(255,255,255,0.85)');
}

function drawSprite(ctx, s, x, y, angle = 0, alpha = 1) {
  if (!s) return;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (s.upright) {
    // Front-facing animals never rotate: they face right, and mirror when heading left.
    if (Math.cos(angle) < 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      ctx.drawImage(s.canvas, -s.size / 2, -s.size / 2, s.size, s.size);
      ctx.restore();
    } else {
      ctx.drawImage(s.canvas, x - s.size / 2, y - s.size / 2, s.size, s.size);
    }
  } else if (angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(s.canvas, -s.size / 2, -s.size / 2, s.size, s.size);
    ctx.restore();
  } else {
    ctx.drawImage(s.canvas, x - s.size / 2, y - s.size / 2, s.size, s.size);
  }
  if (alpha !== 1) ctx.globalAlpha = 1;
}

// A "walk set": 4 walk frames + 1 attack frame, each with a hit-flash variant.
// spec.draw is the animal's drawing function; upright specs mirror instead of rotating.
function buildWalkSet(pixelR, spec, canvasSize) {
  const size = canvasSize || pixelR * 4.6;
  const full = { ...spec, r: pixelR };
  const draw = spec.draw;
  const frames = [];
  for (let i = 0; i < 4; i++) frames.push(makeSprite(size, (g) => draw(g, full, (i / 4) * TAU, false)));
  const attack = makeSprite(size, (g) => draw(g, full, 0, true));
  if (spec.upright) for (const f of [...frames, attack]) f.upright = true;
  return {
    frames,
    attack,
    flashFrames: frames.map(flashVariant),
    flashAttack: flashVariant(attack),
    size,
  };
}

function pickFrame(obj, x, y) {
  if (obj._px === undefined) {
    obj._px = x;
    obj._py = y;
    obj._acc = 0;
    obj._fi = 0;
  }
  const dx = x - obj._px;
  const dy = y - obj._py;
  const d = Math.hypot(dx, dy);
  obj._px = x;
  obj._py = y;
  if (d > 0.05) {
    obj._acc += d;
    obj._fi = Math.floor(obj._acc / 15) % 4;
  }
  return obj._fi;
}

function frameFor(set, idx, attacking, flashed) {
  if (!set) return null;
  if (flashed) return attacking ? set.flashAttack : set.flashFrames[idx];
  return attacking ? set.attack : set.frames[idx];
}

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.ctx = canvas.getContext('2d');
    this.w = 1;
    this.h = 1;
    this.dpr = 1;
    this.scale = 1;
    this.t = 0;
    this.cam = { x: ARENA / 2, y: ARENA / 2 };
    this.pattern = null;
    this.sprites = {};
    this.generalId = null;
    this.seenRings = new Set();
    this.seenZones = new Set();
    this.buildSprites();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = w;
    this.h = h;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.scale = clamp(Math.max(w, h) / 1200, 0.65, 1.5);
  }

  prepare(rng, general) {
    this.buildGround(rng);
    this.seenRings = new Set();
    this.seenZones = new Set();
    this.generalId = general.id;
    const base = HAMSTER_ART[general.id] || HAMSTER_ART.zhangfei;
    // One walk set per transformation, built up front so a transformation is a sprite swap.
    this.sprites.playerForms = FORMS.map((_, f) =>
      buildWalkSet(GENERAL_R, { ...formLook(base, f), upright: true, draw: drawHamster }, GENERAL_R * 5.6),
    );
    if (general.id === 'zhaoyun') {
      this.sprites.mountedForms = FORMS.map((_, f) =>
        buildWalkSet(GENERAL_R, { ...formLook(base, f), upright: true, draw: drawHamsterBall }, GENERAL_R * 3.4),
      );
    } else {
      this.sprites.mountedForms = null;
    }
    this.setForm(0);
  }

  setForm(f) {
    this.form = f;
    this.sprites.playerSet = this.sprites.playerForms[f];
    this.sprites.mountedSet = this.sprites.mountedForms ? this.sprites.mountedForms[f] : null;
    this.sprites.mountedTrail = this.sprites.mountedSet
      ? tintVariant(this.sprites.mountedSet.frames[0], 'rgba(150,210,255,0.55)')
      : null;
  }

  // A sunny meadow tile: fresh grass, soft light patches, little flowers and seeds (kept off the tile
  // edges so the repeat has no seams).
  buildGround(rng) {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = '#a3dc7e';
    g.fillRect(0, 0, size, size);
    for (let i = 0; i < 10; i++) {
      const x = rng.range(0, size);
      const y = rng.range(0, size);
      const rx = rng.range(18, 46);
      const ry = rng.range(10, 26);
      const rot = rng.range(0, Math.PI);
      g.fillStyle = `rgba(${196 + rng.int(0, 20)},${236 + rng.int(0, 12)},${150 + rng.int(0, 20)},${rng.range(0.22, 0.4)})`;
      for (const [ox, oy] of [[0, 0], [-size, 0], [size, 0], [0, -size], [0, size]]) {
        g.beginPath();
        g.ellipse(x + ox, y + oy, rx, ry, rot, 0, TAU);
        g.fill();
      }
    }
    for (let i = 0; i < 110; i++) {
      const x = rng.range(4, size - 4);
      const y = rng.range(8, size - 2);
      g.strokeStyle = `rgba(${96 + rng.int(0, 30)},${170 + rng.int(0, 30)},${70},${rng.range(0.3, 0.55)})`;
      g.lineWidth = 1.4;
      for (let k = -1; k <= 1; k++) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + k * 2.5 + rng.range(-1, 1), y - rng.range(4, 8));
        g.stroke();
      }
    }
    const petals = ['#ffffff', '#fff3a6', '#ffc6d9', '#d9ecff'];
    for (let i = 0; i < 6; i++) {
      const x = rng.range(10, size - 10);
      const y = rng.range(10, size - 10);
      const pr = rng.range(2.2, 3.4);
      g.fillStyle = petals[rng.int(0, petals.length - 1)];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU;
        g.beginPath();
        g.arc(x + Math.cos(a) * pr, y + Math.sin(a) * pr, pr * 0.8, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#ffc93c';
      g.beginPath();
      g.arc(x, y, pr * 0.7, 0, TAU);
      g.fill();
    }
    for (let i = 0; i < 4; i++) {
      const x = rng.range(8, size - 8);
      const y = rng.range(8, size - 8);
      g.fillStyle = '#5a4a3e';
      g.beginPath();
      g.ellipse(x, y, 1.6, 3, rng.range(0, Math.PI), 0, TAU);
      g.fill();
    }
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(246,240,222,${rng.range(0.5, 0.85)})`;
      g.beginPath();
      g.arc(rng.range(6, size - 6), rng.range(6, size - 6), rng.range(1.2, 2.6), 0, TAU);
      g.fill();
    }
    this.pattern = this.ctx.createPattern(c, 'repeat');
  }

  buildSprites() {
    const s = this.sprites;
    for (const type of Object.keys(PREDATOR_ART)) {
      s[type] = buildWalkSet(ENEMY_R[type], PREDATOR_ART[type]);
    }
    s.herald = buildWalkSet(ENEMY_R.spearman * 1.25, HERALD_ART);
    s.zhangbao = buildWalkSet(BOSS_R, PREDATOR_BOSS_ART.zhangbao, BOSS_R * 5.4);
    s.zhangjiao = buildWalkSet(BOSS_R, PREDATOR_BOSS_ART.zhangjiao, BOSS_R * 5.4);

    s.soldier = buildWalkSet(SOLDIER_R, PUP_ART.soldier);
    s.troopArcher = buildWalkSet(SOLDIER_R, PUP_ART.troopArcher);
    s.crossbow = buildWalkSet(SOLDIER_R, PUP_ART.crossbow);
    s.rider = buildWalkSet(RIDER_R, PUP_ART.rider, RIDER_R * 3.4);

    const gem = (size, r, color, glow) =>
      makeSprite(size, (g) => {
        const grd = g.createRadialGradient(0, 0, r * 0.5, 0, 0, size / 2);
        grd.addColorStop(0, glow);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.beginPath();
        g.arc(0, 0, size / 2, 0, TAU);
        g.fill();
        g.fillStyle = color;
        g.beginPath();
        g.moveTo(0, -r);
        g.lineTo(r * 0.8, 0);
        g.lineTo(0, r);
        g.lineTo(-r * 0.8, 0);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.9)';
        g.lineWidth = 1.2;
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.7)';
        g.beginPath();
        g.moveTo(0, -r * 0.7);
        g.lineTo(r * 0.3, -r * 0.1);
        g.lineTo(-r * 0.3, -r * 0.1);
        g.closePath();
        g.fill();
      });
    s.gemS = gem(28, 5, '#2ec5ff', 'rgba(46,197,255,0.55)');
    s.gemM = gem(34, 7, '#5a6bff', 'rgba(90,107,255,0.55)');
    s.gemL = gem(40, 9, '#c45cff', 'rgba(196,92,255,0.55)');
    s.gemXL = gem(52, 12, '#ffd166', 'rgba(255,209,102,0.6)');
  }

  gemSprite(v) {
    if (v >= 40) return this.sprites.gemXL;
    if (v >= 8) return this.sprites.gemL;
    if (v >= 3) return this.sprites.gemM;
    return this.sprites.gemS;
  }

  drawNameTag(ctx, x, y, text, color = '#ffe9a0') {
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const w = ctx.measureText(text).width + 10;
    ctx.fillStyle = 'rgba(74,47,31,0.72)';
    ctx.fillRect(x - w / 2, y, w, 14);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y + 1);
  }

  // ---------- main render ----------

  render(frame) {
    const g = this.game;
    const ctx = this.ctx;
    const { w, h, dpr, scale } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#86c765';
    ctx.fillRect(0, 0, w, h);
    const p = g.player;
    if (!p) return;

    const live = g.state === 'playing' || g.state === 'slowmo';
    this.t += frame;
    this.frameDt = live ? frame : 0;
    this.realDt = frame;
    const k = 1 - Math.pow(0.002, frame);
    this.cam.x += (p.x - this.cam.x) * k;
    this.cam.y += (p.y - this.cam.y) * k;
    const vw = w / scale;
    const vh = h / scale;
    this.cam.x = vw < ARENA ? clamp(this.cam.x, vw / 2, ARENA - vw / 2) : ARENA / 2;
    this.cam.y = vh < ARENA ? clamp(this.cam.y, vh / 2, ARENA - vh / 2) : ARENA / 2;

    if (g.shake > 0 && live) g.shake = Math.max(0, g.shake - frame * 28);
    const sx = live ? Math.sin(this.t * 71) * g.shake : 0;
    const sy = live ? Math.cos(this.t * 57) * g.shake : 0;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (w / 2 - this.cam.x * scale + sx), dpr * (h / 2 - this.cam.y * scale + sy));

    const vx0 = this.cam.x - vw / 2 - 60;
    const vy0 = this.cam.y - vh / 2 - 60;
    const vx1 = this.cam.x + vw / 2 + 60;
    const vy1 = this.cam.y + vh / 2 + 60;

    this.drawGround(ctx, vx0, vy0, vx1, vy1);
    this.drawFields(ctx);
    this.drawFire(ctx);
    this.drawTelegraphs(ctx);
    this.drawGems(ctx, vx0, vy0, vx1, vy1);
    this.drawTreasures(ctx);
    this.drawRings(ctx);
    this.drawSlashes(ctx);
    this.drawTroops(ctx);
    this.drawTrail(ctx);
    this.drawEnemies(ctx, vx0, vy0, vx1, vy1);
    this.drawPlayer(ctx);
    this.drawProjectiles(ctx, vx0, vy0, vx1, vy1);
    this.drawRain(ctx);
    this.drawRiders(ctx);
    this.drawParticles(ctx);
    this.drawFlashes(ctx);
    this.drawNumbers(ctx);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawOverlay(ctx);
    this.drawJoystick(ctx);
  }

  drawGround(ctx, vx0, vy0, vx1, vy1) {
    if (this.pattern) {
      const x0 = Math.max(vx0, 0);
      const y0 = Math.max(vy0, 0);
      ctx.fillStyle = this.pattern;
      ctx.fillRect(x0, y0, Math.min(vx1, ARENA) - x0, Math.min(vy1, ARENA) - y0);
    }
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#3b2d1a';
    ctx.strokeRect(0, 0, ARENA, ARENA);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#7d5a2c';
    ctx.strokeRect(8, 8, ARENA - 16, ARENA - 16);
  }

  drawFields(ctx) {
    const g = this.game;
    const p = g.player;
    if (g.mods.slowField > 0) {
      ctx.fillStyle = 'rgba(70,110,170,0.16)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 160, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,170,230,0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (g.mods.trigrams > 0) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(this.t * 0.4);
      ctx.strokeStyle = 'rgba(226,184,74,0.55)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        const x = Math.cos(a) * 130;
        const y = Math.sin(a) * 130;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(226,184,74,0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + Math.PI / 8;
        const x = Math.cos(a) * 100;
        const y = Math.sin(a) * 100;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  drawFire(ctx) {
    const zones = this.game.fireZones;
    ctx.lineCap = 'round';
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      if (!this.seenZones.has(z) && z.time === z.maxTime) {
        this.seenZones.add(z);
      }
      const fade = Math.min(1, z.time / 0.6);
      const flicker = 0.8 + Math.sin(this.t * 24 + z.seed) * 0.2;
      // Smoke drifting upward.
      const len = Math.hypot(z.x2 - z.x1, z.y2 - z.y1);
      const n = Math.floor(len / 26);
      for (let k = 0; k < n; k++) {
        const tt = (k + 0.5) / n;
        const fx = z.x1 + (z.x2 - z.x1) * tt;
        const fy = z.y1 + (z.y2 - z.y1) * tt;
        const drift = (this.t * 18 + k * 13) % 40;
        ctx.globalAlpha = 0.18 * fade * (1 - drift / 40);
        ctx.fillStyle = '#2a2a2a';
        ctx.beginPath();
        ctx.arc(fx + Math.sin(k + this.t) * 4, fy - 10 - drift, 5 + drift * 0.15, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.lineWidth = z.w;
      ctx.strokeStyle = `rgba(255,90,20,${0.45 * fade})`;
      ctx.beginPath();
      ctx.moveTo(z.x1, z.y1);
      ctx.lineTo(z.x2, z.y2);
      ctx.stroke();
      ctx.lineWidth = z.w * 0.45 * flicker;
      ctx.strokeStyle = `rgba(255,200,80,${0.6 * fade})`;
      ctx.stroke();
      ctx.fillStyle = `rgba(255,150,40,${0.6 * fade})`;
      for (let k = 0; k < n; k++) {
        const tt = (k + 0.5) / n;
        const fx = z.x1 + (z.x2 - z.x1) * tt;
        const fy = z.y1 + (z.y2 - z.y1) * tt;
        const hgt = 8 + Math.abs(Math.sin(this.t * 10 + k * 1.7 + z.seed)) * 12;
        ctx.beginPath();
        ctx.moveTo(fx - 5, fy + 2);
        ctx.lineTo(fx, fy - hgt);
        ctx.lineTo(fx + 5, fy + 2);
        ctx.closePath();
        ctx.fill();
      }
      // Embers.
      ctx.fillStyle = `rgba(255,220,120,${0.7 * fade})`;
      for (let k = 0; k < 4; k++) {
        const tt = ((this.t * 0.7 + k / 4 + z.seed * 0.01) % 1);
        const fx = z.x1 + (z.x2 - z.x1) * ((k + 0.5) / 4);
        const fy = z.y1 + (z.y2 - z.y1) * ((k + 0.5) / 4) - tt * 30;
        ctx.globalAlpha = (1 - tt) * fade;
        ctx.beginPath();
        ctx.arc(fx, fy, 1.6, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.lineCap = 'butt';
  }

  drawTelegraphs(ctx) {
    const g = this.game;
    for (const tg of g.telegraphs) {
      const prog = 1 - tg.time / tg.max;
      const imminent = prog > 0.82;
      const flash = imminent ? 0.5 + Math.abs(Math.sin(this.t * 40)) * 0.5 : 0;
      ctx.fillStyle = imminent ? `rgba(220,240,255,${0.25 + flash * 0.3})` : 'rgba(90,140,255,0.2)';
      ctx.beginPath();
      ctx.arc(tg.x, tg.y, tg.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = imminent ? `rgba(255,255,255,${0.7 + flash * 0.3})` : 'rgba(150,190,255,0.9)';
      ctx.lineWidth = imminent ? 3 : 2;
      ctx.stroke();
      ctx.fillStyle = `rgba(160,200,255,${0.25 + prog * 0.35})`;
      ctx.beginPath();
      ctx.arc(tg.x, tg.y, tg.r * prog, 0, TAU);
      ctx.fill();
      if (imminent) {
        // Jagged lightning bolt striking down from the sky.
        ctx.strokeStyle = `rgba(230,245,255,${0.6 + flash * 0.4})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        let x = tg.x + 26;
        let y = tg.y - 420;
        ctx.moveTo(x, y);
        for (let s = 0; s < 7; s++) {
          x = tg.x + Math.sin(s * 3.1 + tg.r + this.t * 30) * 24 * (1 - s / 7);
          y = tg.y - 420 + ((s + 1) / 7) * 420;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.strokeStyle = `rgba(140,200,255,${0.4 + flash * 0.3})`;
        ctx.lineWidth = 8;
        ctx.stroke();
      }
    }
    const b = g.boss;
    if (b && b.active && b.type === 'zhangbao' && b.ai.phase === 'telegraph') {
      const pulse = 0.4 + Math.abs(Math.sin(this.t * 20)) * 0.4;
      ctx.strokeStyle = `rgba(255,80,60,${pulse})`;
      ctx.lineWidth = b.r * 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + Math.cos(b.ai.ang) * 300, b.y + Math.sin(b.ai.ang) * 300);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }

  drawGems(ctx, vx0, vy0, vx1, vy1) {
    const items = this.game.gems.items;
    for (let i = 0; i < items.length; i++) {
      const gm = items[i];
      if (!gm.active || gm.x < vx0 || gm.x > vx1 || gm.y < vy0 || gm.y > vy1) continue;
      const bob = Math.sin(this.t * 4 + gm.seed) * 2;
      drawSprite(ctx, this.gemSprite(gm.value), gm.x, gm.y + bob);
    }
  }

  // Imperial Treasure: a lacquered chest stamped with a wheel, bobbing in a gold glow.
  drawTreasures(ctx) {
    for (const tr of this.game.treasures) {
      const bob = Math.sin(this.t * 3 + tr.seed) * 3;
      const x = tr.x;
      const y = tr.y + bob;
      const glow = 0.3 + Math.abs(Math.sin(this.t * 2.5 + tr.seed)) * 0.25;
      const grd = ctx.createRadialGradient(x, y, 4, x, y, 46);
      grd.addColorStop(0, `rgba(255,209,102,${glow})`);
      grd.addColorStop(1, 'rgba(255,209,102,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, 46, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#6b1f1a';
      ctx.fillRect(x - 15, y - 8, 30, 18);
      ctx.fillStyle = '#8f2a22';
      ctx.fillRect(x - 15, y - 14, 30, 8);
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 15, y - 14, 30, 24);
      ctx.beginPath();
      ctx.moveTo(x - 15, y - 6);
      ctx.lineTo(x + 15, y - 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y + 2, 5, 0, TAU);
      ctx.stroke();
      for (let k = 0; k < 4; k++) {
        const a = this.t * 1.5 + (k / 4) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 5, y + 2 + Math.sin(a) * 5);
        ctx.lineTo(x - Math.cos(a) * 5, y + 2 - Math.sin(a) * 5);
        ctx.stroke();
      }
      this.drawNameTag(ctx, x, y + 16, tr.kind === 'block' ? 'Imperial Treasure' : 'Herald\'s spoils', '#ffd166');
    }
  }

  drawRings(ctx) {
    for (const r of this.game.rings) {
      if (!this.seenRings.has(r) && r.life === r.maxLife) {
        this.seenRings.add(r);
        if (r.color === '#ffd166') {
          this.popText(r.x, r.y - r.max * 0.3, 'ROAR!', '#ffe066', 30);
        }
      }
      const k = 1 - r.life / r.maxLife;
      const rad = r.max * (0.2 + 0.8 * k);
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  popText(x, y, text, color, size) {
    if (!this.popups) this.popups = [];
    this.popups.push({ x, y, text, color, size, life: 0.9, maxLife: 0.9 });
  }

  drawSlashes(ctx) {
    for (const s of this.game.slashes) {
      const k = s.life / s.max;
      ctx.fillStyle = `rgba(255,255,255,${0.35 * k})`;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.arc(s.x, s.y, s.r, s.ang - Math.PI / 3, s.ang + Math.PI / 3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * k})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, s.ang - Math.PI / 3, s.ang + Math.PI / 3);
      ctx.stroke();
    }
  }

  drawTroops(ctx) {
    const t = this.game.troops;
    const s = this.sprites;
    for (const u of t.soldiers) {
      const ang = Math.atan2(u.y - this.game.player.y, u.x - this.game.player.x);
      const idx = pickFrame(u, u.x, u.y);
      this.shadow(ctx, u.x, u.y, 14);
      drawSprite(ctx, frameFor(s.soldier, idx, false, false), u.x, u.y, ang);
    }
    for (const u of t.archers) {
      const idx = pickFrame(u, u.x, u.y);
      this.shadow(ctx, u.x, u.y, 14);
      drawSprite(ctx, frameFor(s.troopArcher, idx, false, false), u.x, u.y, u.ang);
    }
    for (const u of t.crossbows) {
      const idx = pickFrame(u, u.x, u.y);
      this.shadow(ctx, u.x, u.y, 14);
      drawSprite(ctx, frameFor(s.crossbow, idx, false, false), u.x, u.y, u.ang);
    }
  }

  drawRiders(ctx) {
    for (const r of this.game.troops.riders) {
      const idx = pickFrame(r, r.x, r.y);
      this.shadow(ctx, r.x, r.y, 20);
      drawSprite(ctx, frameFor(this.sprites.rider, idx, false, false), r.x, r.y, r.ang);
      ctx.fillStyle = 'rgba(120,100,70,0.3)';
      ctx.beginPath();
      ctx.arc(r.x - Math.cos(r.ang) * 24, r.y - Math.sin(r.ang) * 24 + 6, 10, 0, TAU);
      ctx.fill();
    }
  }

  drawTrail(ctx) {
    const p = this.game.player;
    if (!p.trail.length) return;
    const spr = this.sprites.mountedTrail || this.sprites.playerSet.frames[0];
    for (let i = 0; i < p.trail.length; i += 2) {
      const tr = p.trail[i];
      drawSprite(ctx, spr, tr.x, tr.y, p.facing, (tr.life / 0.35) * 0.5);
    }
  }

  shadow(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.85, r * 0.85, r * 0.34, 0, 0, TAU);
    ctx.fill();
  }

  drawEnemies(ctx, vx0, vy0, vx1, vy1) {
    const g = this.game;
    const items = g.enemies.items;
    const s = this.sprites;
    const camx = this.cam.x;
    const camy = this.cam.y;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active || e.x < vx0 || e.x > vx1 || e.y < vy0 || e.y > vy1) continue;
      const ddx = e.x - camx;
      const ddy = e.y - camy;
      const near = e.boss || e.elite || ddx * ddx + ddy * ddy < LOD_DIST2;

      if (e.elite) {
        const pulse = 0.22 + Math.abs(Math.sin(this.t * 4)) * 0.18;
        ctx.strokeStyle = `rgba(255,209,102,${pulse + 0.25})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 12, this.t * 3, this.t * 3 + TAU * 0.8);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,209,102,${pulse * 0.5})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 10, 0, TAU);
        ctx.fill();
      }
      if (e.boss) {
        const pulse = 0.25 + Math.abs(Math.sin(this.t * 3)) * 0.15;
        ctx.fillStyle = e.type === 'zhangjiao' ? `rgba(140,197,255,${pulse})` : `rgba(255,106,58,${pulse})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 18, 0, TAU);
        ctx.fill();
      }
      this.shadow(ctx, e.x, e.y, e.r);
      const ang = Math.atan2(g.player.y - e.y, g.player.x - e.x);
      const idx = near ? pickFrame(e, e.x, e.y) : 0;
      const spr = frameFor(s[e.type], idx, false, e.flash > 0);
      drawSprite(ctx, spr, e.x, e.y, ang);

      if (!near) continue;

      if (e.burnTime > 0 || e.inFire) {
        ctx.fillStyle = `rgba(255,140,40,${0.5 + Math.sin(this.t * 20 + i) * 0.2})`;
        ctx.beginPath();
        ctx.moveTo(e.x - 5, e.y - e.r * 0.3);
        ctx.lineTo(e.x, e.y - e.r - 6 - Math.abs(Math.sin(this.t * 14 + i)) * 5);
        ctx.lineTo(e.x + 5, e.y - e.r * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = `rgba(255,200,90,${0.4 + Math.sin(this.t * 22 + i + 1) * 0.2})`;
        ctx.beginPath();
        ctx.arc(e.x - e.r * 0.3, e.y - e.r * 0.2, 2.5, 0, TAU);
        ctx.fill();
      }
      if (e.stun > 0) {
        ctx.fillStyle = '#ffe066';
        for (let k = 0; k < 3; k++) {
          const a = this.t * 6 + (k / 3) * TAU;
          ctx.beginPath();
          ctx.arc(e.x + Math.cos(a) * 10, e.y - e.r - 6 + Math.sin(a) * 3, 2.2, 0, TAU);
          ctx.fill();
        }
      }
      if (!e.boss && !e.elite && e.hp < e.maxHp && e.maxHp >= 35) {
        const bw = 26;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(e.x - bw / 2, e.y - e.r - 11, bw, 4);
        ctx.fillStyle = '#e04040';
        ctx.fillRect(e.x - bw / 2, e.y - e.r - 11, bw * Math.max(0, e.hp / e.maxHp), 4);
      }
      if (e.boss || e.elite) {
        this.drawNameTag(ctx, e.x, e.y - e.r - 24, ENEMY_TYPES[e.type].name, e.elite ? '#ffd166' : undefined);
      }
      if (e.elite && e.hp < e.maxHp) {
        const bw = 40;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(e.x - bw / 2, e.y - e.r - 9, bw, 5);
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(e.x - bw / 2, e.y - e.r - 9, bw * Math.max(0, e.hp / e.maxHp), 5);
      }
    }
  }

  drawPlayer(ctx) {
    const g = this.game;
    const p = g.player;
    this.drawFormAura(ctx, p);
    this.shadow(ctx, p.x, p.y, p.r);
    this.drawWheelAura(ctx, p);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, g.pickupRange, 0, TAU);
    ctx.stroke();

    const mounted = this.sprites.mountedSet && p.dashing > 0;
    const set = mounted ? this.sprites.mountedSet : this.sprites.playerSet;
    const cdMax = 1 / g.attackSpeed;
    const attacking = !mounted && p.attackCd > cdMax - 0.12 && p.attackCd > 0 && cdMax > 0.12;
    const idx = pickFrame(p, p.x, p.y);
    const flashed = p.flash > 0;
    const spr = frameFor(set, idx, attacking, flashed);
    const alpha = p.invuln > 0 && p.dashing <= 0 ? 0.6 : 1;
    const bob = p.moving ? Math.sin(this.t * 14) * 1.5 : 0;
    drawSprite(ctx, spr, p.x, p.y + bob, p.facing, alpha);
    this.drawNameTag(ctx, p.x, p.y + p.r + 10, g.general.name, '#bdf5c8');

    if (g.awakened) {
      const pulse = Math.abs(Math.sin(this.t * 4));
      ctx.strokeStyle = `rgba(255,209,102,${0.4 + pulse * 0.35})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 30 + pulse * 4, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,209,102,${0.06 + pulse * 0.05})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 40, 0, TAU);
      ctx.fill();
    }
  }

  // Transformation aura: flickering flame tongues around the body, taller at each form; Azure adds sparks.
  drawFormAura(ctx, p) {
    const f = this.game.form || 0;
    if (!f) return;
    const color = FORMS[f].aura;
    const cx = p.x;
    const cy = p.y - 8;
    const n = 10 + f * 3;
    const base = 26 + f * 3;
    const tall = 10 + f * 7;
    const boost = this.transformT > 0 ? 1 + this.transformT * 1.5 : 1;
    const grd = ctx.createRadialGradient(cx, cy, base * 0.4, cx, cy, (base + tall) * boost);
    grd.addColorStop(0, `${color}55`);
    grd.addColorStop(1, `${color}00`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, (base + tall) * boost, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `${color}99`;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const flick = Math.abs(Math.sin(this.t * (7 + (i % 3)) + i * 1.7));
      // Flames lick upward: longer above the hamster than below it.
      const up = 0.55 + 0.45 * Math.max(0, -Math.sin(a));
      const rr = (base + tall * flick * up) * boost;
      const x = cx + Math.cos(a) * rr * 0.85;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else {
        const am = ((i - 0.5) / n) * TAU;
        ctx.quadraticCurveTo(cx + Math.cos(am) * base * 0.85, cy + Math.sin(am) * base, x, y);
      }
    }
    ctx.closePath();
    ctx.fill();
    if (f >= 4) {
      ctx.strokeStyle = 'rgba(220,245,255,0.9)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 2; k++) {
        const a = this.t * 5 + k * Math.PI + Math.sin(this.t * 13) * 0.6;
        let x = cx + Math.cos(a) * 18;
        let y = cy + Math.sin(a) * 22;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 0; j < 3; j++) {
          x += Math.cos(a) * 9 + Math.sin(this.t * 31 + j) * 6;
          y += Math.sin(a) * 9 + Math.cos(this.t * 29 + j) * 6;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
  }

  // Running: a golden wheel turning at Squeektoshi's real pace. Resting: a lantern's glow.
  drawWheelAura(ctx, p) {
    const g = this.game;
    if (g.wheelShown === 'running') {
      const rpm = Math.max(10, g.wheelSnap.rpm || 0);
      // Half his real revolutions per second, so the spokes stay readable.
      this.wheelAngle = (this.wheelAngle || 0) + (rpm / 60) * TAU * this.frameDt * 0.5;
      const R = 36;
      ctx.strokeStyle = `rgba(255,209,102,${0.35 + g.fx.k * 0.35})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 8; k++) {
        const a = this.wheelAngle + (k / 8) * TAU;
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(a) * (R - 8), p.y + Math.sin(a) * (R - 8));
        ctx.lineTo(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R);
        ctx.stroke();
      }
    } else if (g.wheelShown === 'resting') {
      const pulse = 0.12 + Math.abs(Math.sin(this.t * 1.5)) * 0.08;
      const grd = ctx.createRadialGradient(p.x, p.y, 6, p.x, p.y, 70);
      grd.addColorStop(0, `rgba(142,197,255,${pulse + 0.1})`);
      grd.addColorStop(1, 'rgba(142,197,255,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 70, 0, TAU);
      ctx.fill();
    }
  }

  drawProjectiles(ctx, vx0, vy0, vx1, vy1) {
    const items = this.game.projectiles.items;
    for (let i = 0; i < items.length; i++) {
      const pr = items[i];
      if (!pr.active || pr.x < vx0 || pr.x > vx1 || pr.y < vy0 || pr.y > vy1) continue;
      const sp = Math.hypot(pr.vx, pr.vy) || 1;
      const nx = pr.vx / sp;
      const ny = pr.vy / sp;
      if (pr.kind === 'arrow' || pr.kind === 'earrow') {
        const len = 16;
        ctx.strokeStyle = pr.kind === 'earrow' ? '#3a2a14' : pr.burn ? '#ff9a3a' : '#e8dcc0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pr.x - nx * len, pr.y - ny * len);
        ctx.lineTo(pr.x + nx * 4, pr.y + ny * 4);
        ctx.stroke();
        ctx.fillStyle = pr.kind === 'earrow' ? '#d9b545' : '#ffffff';
        ctx.beginPath();
        ctx.arc(pr.x + nx * 4, pr.y + ny * 4, 2.2, 0, TAU);
        ctx.fill();
      } else if (pr.kind === 'bolt') {
        ctx.strokeStyle = '#c9d6e0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(pr.x - nx * 9, pr.y - ny * 9);
        ctx.lineTo(pr.x + nx * 3, pr.y + ny * 3);
        ctx.stroke();
      } else {
        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.rotate(Math.atan2(ny, nx) + this.t * 12);
        ctx.fillStyle = '#f4f1e6';
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 4, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#8ec5ff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawRain(ctx) {
    for (const a of this.game.rainArrows) {
      if (a.delay > 0) {
        const imminent = a.delay < 0.4;
        ctx.strokeStyle = imminent ? 'rgba(255,90,70,0.55)' : 'rgba(255,233,160,0.3)';
        ctx.lineWidth = imminent ? 2 : 1;
        ctx.beginPath();
        ctx.arc(a.x, a.y, 6, 0, TAU);
        ctx.stroke();
        continue;
      }
      const k = a.t / 0.45;
      const y = a.y - 260 * (1 - k);
      const x = a.x + 50 * (1 - k);
      ctx.strokeStyle = 'rgba(232,220,192,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 4, y - 20);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(a.x, a.y, 5 * k + 2, 2.5 * k + 1, 0, 0, TAU);
      ctx.fill();
    }
  }

  drawParticles(ctx) {
    const items = this.game.particles.items;
    for (let i = 0; i < items.length; i++) {
      const pt = items[i];
      if (!pt.active) continue;
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawFlashes(ctx) {
    for (const f of this.game.flashes) {
      const k = f.life / f.maxLife;
      ctx.fillStyle = `rgba(200,225,255,${0.7 * k})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (1.1 - k * 0.3), 0, TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${k})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      let x = f.x + 30;
      let y = f.y - 320;
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x = f.x + Math.sin(s * 2.3 + f.r) * 22 * (1 - s / 6);
        y = f.y - 320 + ((s + 1) / 6) * 320;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  drawNumbers(ctx) {
    const items = this.game.numbers.items;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < items.length; i++) {
      const n = items[i];
      if (!n.active) continue;
      const k = n.life / n.maxLife;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.font = `bold ${n.size}px sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(n.text, n.x, n.y);
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, n.x, n.y);
    }
    ctx.globalAlpha = 1;

    if (this.popups && this.popups.length) {
      for (let i = this.popups.length - 1; i >= 0; i--) {
        const pu = this.popups[i];
        pu.life -= 1 / 60;
        if (pu.life <= 0) {
          this.popups.splice(i, 1);
          continue;
        }
        const k = pu.life / pu.maxLife;
        const y = pu.y - (1 - k) * 30;
        ctx.globalAlpha = Math.min(1, k * 1.8);
        ctx.font = `bold ${pu.size}px sans-serif`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeText(pu.text, pu.x, y);
        ctx.fillStyle = pu.color;
        ctx.fillText(pu.text, pu.x, y);
      }
      ctx.globalAlpha = 1;
    }
  }

  drawOverlay(ctx) {
    const g = this.game;
    const { w, h } = this;
    const grd = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(110,80,30,0.12)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    if (g.wheelShown === 'resting') {
      ctx.fillStyle = 'rgba(120,110,230,0.13)';
      ctx.fillRect(0, 0, w, h);
    } else if (g.wheelShown === 'running') {
      const edge = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.8);
      edge.addColorStop(0, 'rgba(255,200,80,0)');
      edge.addColorStop(1, `rgba(255,200,80,${0.06 + g.fx.k * 0.08})`);
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, w, h);
    }
    this.drawTreasureArrows(ctx);
    if (this.transformT > 0) {
      const c = FORMS[g.form] ? FORMS[g.form].aura : '#ffffff';
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, this.transformT * 0.8)})`;
      ctx.fillRect(0, 0, w, h);
      const sx = (g.player.x - this.cam.x) * this.scale + w / 2;
      const sy = (g.player.y - this.cam.y) * this.scale + h / 2;
      ctx.strokeStyle = c;
      ctx.globalAlpha = Math.min(1, this.transformT * 1.4);
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * TAU + this.t;
        ctx.moveTo(sx + Math.cos(a) * 40, sy + Math.sin(a) * 40);
        ctx.lineTo(sx + Math.cos(a) * Math.max(w, h), sy + Math.sin(a) * Math.max(w, h));
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      this.transformT = Math.max(0, this.transformT - (this.realDt || 0.016) * 1.2);
    }
    if (g.player.flash > 0) {
      ctx.fillStyle = `rgba(200,30,30,${g.player.flash * 1.4})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (g.state === 'slowmo') {
      ctx.fillStyle = 'rgba(255,250,240,0.2)';
      ctx.fillRect(0, 0, w, h);
    }
  }

  // Screen-edge arrows toward treasures that are off camera.
  drawTreasureArrows(ctx) {
    const { w, h, scale } = this;
    for (const tr of this.game.treasures) {
      const sx = (tr.x - this.cam.x) * scale + w / 2;
      const sy = (tr.y - this.cam.y) * scale + h / 2;
      if (sx > 20 && sx < w - 20 && sy > 20 && sy < h - 20) continue;
      const a = Math.atan2(sy - h / 2, sx - w / 2);
      const m = 34;
      const ex = clamp(w / 2 + Math.cos(a) * w, m, w - m);
      const ey = clamp(h / 2 + Math.sin(a) * h, m, h - m);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = `rgba(255,209,102,${0.65 + Math.abs(Math.sin(this.t * 4)) * 0.3})`;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -10);
      ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawJoystick(ctx) {
    const j = this.game.input.joy;
    if (!j.active) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(j.cx, j.cy, j.radius, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(79,210,127,0.7)';
    ctx.beginPath();
    ctx.arc(j.cx + j.dx * j.radius, j.cy + j.dy * j.radius, 26, 0, TAU);
    ctx.fill();
  }
}
