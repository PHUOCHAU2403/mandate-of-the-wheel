// Procedural animal art: front-facing chibi hamsters (big glossy eyes, pink cheeks, white belly) and the
// predators that hunt them. Everything faces right and stands upright; the renderer mirrors instead of rotating.

const TAU = Math.PI * 2;

function ell(g, x, y, rx, ry, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
  g.fill();
}

function tri(g, ax, ay, bx, by, cx, cy) {
  g.beginPath();
  g.moveTo(ax, ay);
  g.lineTo(bx, by);
  g.lineTo(cx, cy);
  g.closePath();
  g.fill();
}

// Big glossy eye with two catchlights, like the reference style.
function glossyEye(g, x, y, rx, ry, color = '#140c08', iris = null) {
  g.fillStyle = color;
  ell(g, x, y, rx, ry);
  if (iris) {
    g.fillStyle = iris;
    ell(g, x, y + ry * 0.25, rx * 0.7, ry * 0.55);
    g.fillStyle = color;
    ell(g, x, y + ry * 0.2, rx * 0.42, ry * 0.4);
  }
  g.fillStyle = '#ffffff';
  ell(g, x - rx * 0.32, y - ry * 0.36, rx * 0.36, ry * 0.32);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  ell(g, x + rx * 0.3, y + ry * 0.38, rx * 0.16, ry * 0.14);
}

// ---------- hamster ----------

// Spiky crest for the transformations: more, taller and more swept-back spikes at each form.
function drawCrest(g, r, level, color, dark) {
  const n = [0, 3, 5, 5, 6][level];
  const h = [0, 0.36, 0.62, 0.86, 1.12][level] * r;
  const spread = [0, 0.5, 0.75, 0.9, 1.0][level];
  const sweep = [0, 0, 0.05, 0.14, 0.2][level];
  const cx = 0;
  const cy = -r * 0.42;
  const rx = r * 0.8;
  const ry = r * 0.62;
  const a0 = -Math.PI / 2 - spread;
  const a1 = -Math.PI / 2 + spread;
  const step = (a1 - a0) / n;
  const at = (a, k, sc = 1) => [cx + (rx * sc + k) * Math.cos(a), cy + (ry * sc + k) * Math.sin(a)];
  // Each spike is a lock with curved sides and overlapping roots, so the crest reads as hair, not rays.
  const lock = (i, hh, shrink) => {
    const t = a0 + step * (i + 0.5);
    const w = step * 0.85 * shrink;
    const k = hh * (1 - Math.abs((i + 0.5) / n - 0.5) * 0.8);
    const [blx, bly] = at(t - w, 0, 0.9);
    const [brx, bry] = at(t + w, 0, 0.9);
    const [tx, ty] = at(t + sweep, k);
    const [c1x, c1y] = at(t - w * 0.5 + sweep * 0.4, k * 0.5);
    const [c2x, c2y] = at(t + w * 0.7 + sweep * 0.6, k * 0.42);
    g.beginPath();
    g.moveTo(blx, bly);
    g.quadraticCurveTo(c1x, c1y, tx, ty);
    g.quadraticCurveTo(c2x, c2y, brx, bry);
    g.closePath();
    g.fill();
  };
  // Hair cap over the crown, then the locks: a dark outline layer under a lighter one.
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(cx, cy, rx * 0.92, ry * 0.92, 0, a0 - step * 0.3, a1 + step * 0.3);
  g.closePath();
  g.fill();
  g.fillStyle = dark;
  for (let i = 0; i < n; i++) lock(i, h, 1);
  g.fillStyle = color;
  for (let i = 0; i < n; i++) lock(i, h * 0.86, 0.72);
}

function drawItem(g, r, s, attacking) {
  const hx = attacking ? r * 0.55 : r * 0.38;
  const hy = attacking ? -r * 0.05 : r * 0.18;
  if (s.item === 'acorn') {
    g.fillStyle = '#8a5a2b';
    ell(g, hx + r * 0.12, hy + r * 0.05, r * 0.34, r * 0.4);
    g.fillStyle = '#5a3a1a';
    ell(g, hx + r * 0.12, hy - r * 0.28, r * 0.36, r * 0.16);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    ell(g, hx + r * 0.02, hy - r * 0.02, r * 0.08, r * 0.16);
  } else if (s.item === 'sling') {
    g.strokeStyle = '#7a5a30';
    g.lineWidth = r * 0.1;
    g.beginPath();
    g.moveTo(hx, hy + r * 0.25);
    g.lineTo(hx + r * 0.1, hy - r * 0.15);
    g.moveTo(hx + r * 0.1, hy - r * 0.15);
    g.lineTo(hx - r * 0.05, hy - r * 0.42);
    g.moveTo(hx + r * 0.1, hy - r * 0.15);
    g.lineTo(hx + r * 0.3, hy - r * 0.4);
    g.stroke();
    g.fillStyle = '#3a2a10';
    ell(g, hx + r * 0.13, hy - r * 0.48, r * 0.07, r * 0.1);
  } else if (s.item === 'crossbow') {
    g.fillStyle = '#6b4a2a';
    g.fillRect(hx - r * 0.05, hy - r * 0.06, r * 0.55, r * 0.12);
    g.strokeStyle = '#3a2a10';
    g.lineWidth = r * 0.07;
    g.beginPath();
    g.arc(hx + r * 0.42, hy, r * 0.28, -Math.PI / 2, Math.PI / 2);
    g.stroke();
  } else if (s.item === 'fan') {
    g.fillStyle = '#4a8a3a';
    g.beginPath();
    g.moveTo(hx, hy + r * 0.1);
    g.arc(hx, hy + r * 0.1, r * 0.55, -Math.PI * 0.85, -Math.PI * 0.35);
    g.closePath();
    g.fill();
    g.strokeStyle = '#2f5a24';
    g.lineWidth = r * 0.04;
    for (let k = 0; k < 4; k++) {
      const a = -Math.PI * 0.82 + k * 0.15 * Math.PI;
      g.beginPath();
      g.moveTo(hx, hy + r * 0.1);
      g.lineTo(hx + Math.cos(a) * r * 0.52, hy + r * 0.1 + Math.sin(a) * r * 0.52);
      g.stroke();
    }
  } else if (s.item === 'seed') {
    g.fillStyle = '#3a3330';
    ell(g, hx + r * 0.05, hy, r * 0.12, r * 0.2, 0.4);
    g.fillStyle = '#e8e2d0';
    ell(g, hx + r * 0.05, hy, r * 0.04, r * 0.15, 0.4);
  }
}

export function drawHamster(g, s, phase = 0, attacking = false) {
  const r = s.r;
  const step = Math.sin(phase);
  const bob = -Math.abs(step) * r * 0.08;

  // Feet first: they peek out under the round body and step with the walk cycle.
  g.fillStyle = s.paw;
  ell(g, -r * 0.42, r * 0.98 - Math.max(0, step) * r * 0.14, r * 0.22, r * 0.12);
  ell(g, r * 0.42, r * 0.98 - Math.max(0, -step) * r * 0.14, r * 0.22, r * 0.12);

  g.save();
  g.translate(0, bob);

  if (s.scarf) {
    const sway = Math.sin(phase * 0.8) * r * 0.12;
    g.fillStyle = s.scarf;
    g.beginPath();
    g.moveTo(-r * 0.3, -r * 0.02);
    g.quadraticCurveTo(-r * 1.05, r * 0.05 + sway, -r * 1.25, r * 0.4 + sway);
    g.lineTo(-r * 0.95, r * 0.45 + sway);
    g.quadraticCurveTo(-r * 0.8, r * 0.2, -r * 0.2, r * 0.12);
    g.closePath();
    g.fill();
  }

  // Ears sit behind the head.
  for (const sx of [-1, 1]) {
    g.fillStyle = s.pattern === 'panda' ? s.patch : s.fur;
    ell(g, sx * r * 0.6, -r * 1.0, r * 0.28, r * 0.27);
    g.fillStyle = s.earInner;
    ell(g, sx * r * 0.6, -r * 0.97, r * 0.16, r * 0.15);
  }

  // One round loaf: lower body and head share the fur gradient, no neck.
  const grd = g.createLinearGradient(0, -r * 1.1, 0, r * 1.05);
  grd.addColorStop(0, s.furLight || s.fur);
  grd.addColorStop(0.55, s.fur);
  grd.addColorStop(1, s.furDark || s.fur);
  g.fillStyle = grd;
  ell(g, 0, r * 0.26, r * 0.93, r * 0.8);
  ell(g, 0, -r * 0.38, r * 0.86, r * 0.7);

  if (s.pattern === 'panda') {
    g.fillStyle = s.patch;
    ell(g, -r * 0.72, r * 0.2, r * 0.26, r * 0.42, 0.3);
    ell(g, r * 0.72, r * 0.2, r * 0.26, r * 0.42, -0.3);
    ell(g, -r * 0.33, -r * 0.44, r * 0.25, r * 0.22, -0.4);
    ell(g, r * 0.33, -r * 0.44, r * 0.25, r * 0.22, 0.4);
  } else if (s.pattern === 'stripe') {
    g.fillStyle = s.stripe;
    ell(g, 0, -r * 0.92, r * 0.09, r * 0.24);
  }

  // The crest grows out of the hairline, so it reads as the hamster's own hair standing up.
  if (s.crest) drawCrest(g, r, s.crest, s.crestColor, s.crestDark);

  // White belly and muzzle with puffy cheeks.
  g.fillStyle = s.belly;
  ell(g, 0, r * 0.46, r * 0.62, r * 0.52);
  ell(g, 0, -r * 0.12, r * 0.46, r * 0.28);
  ell(g, -r * 0.4, -r * 0.08, r * 0.3, r * 0.24);
  ell(g, r * 0.4, -r * 0.08, r * 0.3, r * 0.24);

  g.fillStyle = s.blush;
  ell(g, -r * 0.52, -r * 0.16, r * 0.17, r * 0.1);
  ell(g, r * 0.52, -r * 0.16, r * 0.17, r * 0.1);

  if (s.pattern === 'brows') {
    g.fillStyle = '#ffffff';
    ell(g, -r * 0.32, -r * 0.66, r * 0.14, r * 0.05, -0.2);
    ell(g, r * 0.32, -r * 0.66, r * 0.14, r * 0.05, 0.2);
  }

  const eyeRy = attacking ? r * 0.18 : r * 0.22;
  glossyEye(g, -r * 0.33, -r * 0.44, r * 0.19, eyeRy, s.eye || '#140c08', s.iris);
  glossyEye(g, r * 0.33, -r * 0.44, r * 0.19, eyeRy, s.eye || '#140c08', s.iris);
  if (attacking) {
    g.strokeStyle = s.furDark || '#7a4a20';
    g.lineWidth = r * 0.06;
    g.beginPath();
    g.moveTo(-r * 0.46, -r * 0.66);
    g.lineTo(-r * 0.2, -r * 0.6);
    g.moveTo(r * 0.46, -r * 0.66);
    g.lineTo(r * 0.2, -r * 0.6);
    g.stroke();
  }

  g.fillStyle = s.nose;
  ell(g, 0, -r * 0.24, r * 0.08, r * 0.055);
  g.strokeStyle = '#7a4a3a';
  g.lineWidth = r * 0.035;
  g.lineCap = 'round';
  g.beginPath();
  if (attacking) {
    g.fillStyle = '#8a2a2a';
    ell(g, 0, -r * 0.1, r * 0.09, r * 0.08);
    g.fillStyle = '#ffffff';
    g.fillRect(-r * 0.05, -r * 0.18, r * 0.045, r * 0.07);
    g.fillRect(r * 0.005, -r * 0.18, r * 0.045, r * 0.07);
  } else {
    g.moveTo(-r * 0.1, -r * 0.16);
    g.quadraticCurveTo(-r * 0.05, -r * 0.11, 0, -r * 0.17);
    g.quadraticCurveTo(r * 0.05, -r * 0.11, r * 0.1, -r * 0.16);
    g.stroke();
  }
  g.lineCap = 'butt';

  if (s.band) {
    g.strokeStyle = s.band;
    g.lineWidth = r * 0.13;
    g.beginPath();
    g.ellipse(0, -r * 0.42, r * 0.84, r * 0.66, 0, Math.PI * 1.17, Math.PI * 1.83);
    g.stroke();
    g.fillStyle = s.band;
    tri(g, r * 0.62, -r * 0.88, r * 1.05, -r * 1.0 + Math.sin(phase) * r * 0.05, r * 0.95, -r * 0.72);
  }

  // Paws held at the chest; thrown forward when attacking.
  g.fillStyle = s.paw;
  const pw = attacking ? r * 0.3 : r * 0.14;
  const ph = attacking ? -r * 0.02 : r * 0.14;
  ell(g, -pw * 0.7, ph, r * 0.12, r * 0.1);
  ell(g, pw, ph, r * 0.12, r * 0.1);

  if (s.item) drawItem(g, r, s, attacking);
  g.restore();
}

// Wheel Dash: the hamster rolls inside a clear ball whose rim lines turn with the frame.
export function drawHamsterBall(g, s, phase = 0) {
  const r = s.r;
  drawHamster(g, { ...s, r: r * 0.78 }, phase, false);
  g.fillStyle = 'rgba(170,220,255,0.16)';
  ell(g, 0, 0, r * 1.3, r * 1.3);
  g.strokeStyle = 'rgba(200,235,255,0.75)';
  g.lineWidth = r * 0.08;
  g.beginPath();
  g.arc(0, 0, r * 1.3, 0, TAU);
  g.stroke();
  g.strokeStyle = 'rgba(200,235,255,0.35)';
  g.lineWidth = r * 0.05;
  for (let k = 0; k < 3; k++) {
    const a = phase + (k / 3) * Math.PI;
    g.beginPath();
    g.ellipse(0, 0, r * 1.3, r * 0.35, a, 0, TAU);
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.6)';
  ell(g, -r * 0.55, -r * 0.7, r * 0.25, r * 0.12, -0.6);
}

export function drawHamsterPortrait(g, s, r) {
  g.save();
  g.translate(0, r * 0.45);
  drawHamster(g, { ...s, r: r * 0.95 }, 0, false);
  g.restore();
}

const BASE = { belly: '#fff6ea', earInner: '#f4a7a0', blush: 'rgba(255,120,140,0.5)', nose: '#f08f9a', paw: '#f7b8b0' };

export const HAMSTER_ART = {
  zhangfei: { ...BASE, fur: '#e8973f', furLight: '#f6b765', furDark: '#c4732a', band: '#c9372e' },
  zhaoyun: { ...BASE, fur: '#d9b27c', furLight: '#ecd0a2', furDark: '#b08a58', pattern: 'brows', scarf: '#3a8fd8' },
  huangzhong: {
    ...BASE, fur: '#c9ced8', furLight: '#eef1f5', furDark: '#98a0ad', belly: '#ffffff', pattern: 'stripe', stripe: '#5f6673',
    item: 'sling', band: '#2f8f55',
  },
  zhugeliang: { ...BASE, fur: '#f3efe6', furLight: '#ffffff', furDark: '#d6d0c2', pattern: 'panda', patch: '#2b2a30', item: 'fan' },
};

const PUP = { ...BASE, fur: '#efae66', furLight: '#f8c98e', furDark: '#c98a46' };
export const PUP_ART = {
  soldier: { ...PUP, item: 'acorn', upright: true, draw: drawHamster },
  troopArcher: { ...PUP, item: 'sling', upright: true, draw: drawHamster },
  crossbow: { ...PUP, item: 'crossbow', upright: true, draw: drawHamster },
  rider: { ...PUP, upright: true, draw: drawHamsterBall },
};

// ---------- predators ----------

export function drawCat(g, s, phase = 0, attacking = false) {
  const r = s.r;
  const step = Math.sin(phase);
  const bob = -Math.abs(step) * r * 0.06;
  const sway = Math.sin(phase * 0.7) * r * 0.2;

  g.strokeStyle = s.fur;
  g.lineWidth = r * 0.22;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-r * 0.5, r * 0.6);
  g.quadraticCurveTo(-r * 1.25, r * 0.4, -r * 1.05 + sway, -r * 0.35);
  g.stroke();
  g.lineCap = 'butt';

  g.fillStyle = s.furDark;
  ell(g, -r * 0.32, r * 0.92 - Math.max(0, step) * r * 0.12, r * 0.2, r * 0.12);
  ell(g, r * 0.32, r * 0.92 - Math.max(0, -step) * r * 0.12, r * 0.2, r * 0.12);

  g.save();
  g.translate(0, bob);
  g.fillStyle = s.fur;
  ell(g, 0, r * 0.32, r * 0.68, r * 0.62);
  g.fillStyle = s.belly;
  ell(g, 0, r * 0.45, r * 0.38, r * 0.42);

  // Head and pointed ears.
  g.fillStyle = s.fur;
  tri(g, -r * 0.62, -r * 0.62, -r * 0.6, -r * 1.32, -r * 0.18, -r * 0.92);
  tri(g, r * 0.62, -r * 0.62, r * 0.6, -r * 1.32, r * 0.18, -r * 0.92);
  g.fillStyle = s.earInner;
  tri(g, -r * 0.5, -r * 0.72, -r * 0.52, -r * 1.12, -r * 0.27, -r * 0.9);
  tri(g, r * 0.5, -r * 0.72, r * 0.52, -r * 1.12, r * 0.27, -r * 0.9);
  g.fillStyle = s.fur;
  ell(g, 0, -r * 0.5, r * 0.68, r * 0.55);
  g.fillStyle = s.belly;
  ell(g, 0, -r * 0.3, r * 0.36, r * 0.24);

  if (s.stripes) {
    g.fillStyle = s.stripes;
    tri(g, -r * 0.1, -r * 1.02, r * 0.1, -r * 1.02, 0, -r * 0.72);
    tri(g, -r * 0.34, -r * 0.98, -r * 0.2, -r * 1.0, -r * 0.26, -r * 0.76);
    tri(g, r * 0.34, -r * 0.98, r * 0.2, -r * 1.0, r * 0.26, -r * 0.76);
    for (const sx of [-1, 1]) {
      g.fillRect(sx * r * 0.62 - (sx > 0 ? r * 0.16 : 0), -r * 0.52, r * 0.16, r * 0.05);
      g.fillRect(sx * r * 0.62 - (sx > 0 ? r * 0.13 : 0), -r * 0.42, r * 0.13, r * 0.05);
      g.fillRect(sx * r * 0.55 - (sx > 0 ? r * 0.18 : 0), r * 0.15, r * 0.18, r * 0.07);
      g.fillRect(sx * r * 0.55 - (sx > 0 ? r * 0.18 : 0), r * 0.38, r * 0.18, r * 0.07);
    }
  }

  // Slit-pupil eyes; they narrow when the cat strikes.
  for (const sx of [-1, 1]) {
    g.fillStyle = s.eye;
    ell(g, sx * r * 0.27, -r * 0.55, r * 0.15, attacking ? r * 0.08 : r * 0.13, sx * -0.15);
    g.fillStyle = '#0b0b0b';
    ell(g, sx * r * 0.27, -r * 0.55, r * 0.035, attacking ? r * 0.07 : r * 0.11);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    ell(g, sx * r * 0.27 - r * 0.05, -r * 0.6, r * 0.03, r * 0.03);
  }
  g.fillStyle = '#e88a9a';
  tri(g, -r * 0.07, -r * 0.4, r * 0.07, -r * 0.4, 0, -r * 0.32);
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = r * 0.025;
  g.beginPath();
  for (const sx of [-1, 1]) {
    g.moveTo(sx * r * 0.2, -r * 0.3);
    g.lineTo(sx * r * 0.75, -r * 0.38);
    g.moveTo(sx * r * 0.2, -r * 0.26);
    g.lineTo(sx * r * 0.75, -r * 0.24);
  }
  g.stroke();
  if (attacking) {
    g.fillStyle = '#6a1a1a';
    ell(g, 0, -r * 0.2, r * 0.14, r * 0.09);
    g.fillStyle = '#ffffff';
    tri(g, -r * 0.1, -r * 0.27, -r * 0.05, -r * 0.27, -r * 0.075, -r * 0.16);
    tri(g, r * 0.05, -r * 0.27, r * 0.1, -r * 0.27, r * 0.075, -r * 0.16);
  }

  if (s.bandana) {
    g.fillStyle = s.bandana;
    g.beginPath();
    g.ellipse(0, -r * 0.62, r * 0.7, r * 0.5, 0, Math.PI * 1.05, Math.PI * 1.95);
    g.lineTo(r * 0.5, -r * 0.8);
    g.quadraticCurveTo(0, -r * 0.68, -r * 0.5, -r * 0.8);
    g.closePath();
    g.fill();
    tri(g, r * 0.6, -r * 0.82, r * 1.0, -r * 0.95, r * 0.85, -r * 0.6);
  }
  if (s.scar) {
    g.strokeStyle = '#f2d6c0';
    g.lineWidth = r * 0.05;
    g.beginPath();
    g.moveTo(r * 0.12, -r * 0.82);
    g.lineTo(r * 0.42, -r * 0.3);
    g.stroke();
  }
  if (s.scarf) {
    g.fillStyle = s.scarf;
    g.beginPath();
    g.ellipse(0, -r * 0.04, r * 0.55, r * 0.15, 0, 0, TAU);
    g.fill();
    g.fillStyle = s.gem || '#d7a6ff';
    ell(g, 0, -r * 0.02, r * 0.09, r * 0.09);
  }

  // Front paws; a raised, clawed swipe on attack.
  g.fillStyle = s.furDark;
  if (attacking) {
    ell(g, r * 0.6, -r * 0.05, r * 0.16, r * 0.14);
    g.strokeStyle = '#ffffff';
    g.lineWidth = r * 0.03;
    g.beginPath();
    for (let k = -1; k <= 1; k++) {
      g.moveTo(r * 0.68, -r * 0.08 + k * r * 0.06);
      g.lineTo(r * 0.86, -r * 0.14 + k * r * 0.08);
    }
    g.stroke();
  } else {
    ell(g, -r * 0.22, r * 0.62, r * 0.14, r * 0.11);
    ell(g, r * 0.22, r * 0.62, r * 0.14, r * 0.11);
  }
  g.restore();
}

export function drawSnake(g, s, phase = 0, attacking = false) {
  const r = s.r;
  const sway = Math.sin(phase) * r * 0.15;
  g.fillStyle = s.fur;
  ell(g, 0, r * 0.72, r * 0.95, r * 0.3);
  g.fillStyle = s.furDark;
  ell(g, 0, r * 0.5, r * 0.8, r * 0.28);
  g.fillStyle = s.fur;
  ell(g, 0, r * 0.42, r * 0.72, r * 0.24);
  // Rising neck: a thick S curve up to the head.
  g.strokeStyle = s.fur;
  g.lineWidth = r * 0.42;
  g.lineCap = 'round';
  const hx = r * 0.2 + sway + (attacking ? r * 0.3 : 0);
  const hy = attacking ? -r * 0.55 : -r * 0.45;
  g.beginPath();
  g.moveTo(-r * 0.2, r * 0.35);
  g.bezierCurveTo(r * 0.6, r * 0.15, -r * 0.5, -r * 0.2, hx, hy);
  g.stroke();
  g.strokeStyle = s.belly;
  g.lineWidth = r * 0.16;
  g.beginPath();
  g.moveTo(-r * 0.12, r * 0.33);
  g.bezierCurveTo(r * 0.55, r * 0.14, -r * 0.42, -r * 0.18, hx, hy + r * 0.1);
  g.stroke();
  g.lineCap = 'butt';
  g.fillStyle = s.furDark;
  for (let k = 0; k < 4; k++) ell(g, -r * 0.55 + k * r * 0.36, r * 0.72, r * 0.08, r * 0.06);
  // Head with a flicking tongue.
  g.fillStyle = s.fur;
  ell(g, hx, hy, r * 0.42, r * 0.3);
  g.fillStyle = s.furDark;
  ell(g, hx, hy - r * 0.12, r * 0.22, r * 0.1);
  for (const sx of [-1, 1]) {
    g.fillStyle = s.eye;
    ell(g, hx + sx * r * 0.2, hy - r * 0.06, r * 0.09, r * 0.09);
    g.fillStyle = '#0b0b0b';
    ell(g, hx + sx * r * 0.2, hy - r * 0.06, r * 0.025, r * 0.08);
  }
  g.strokeStyle = '#d03040';
  g.lineWidth = r * 0.04;
  const t = attacking ? r * 0.35 : Math.max(0, Math.sin(phase * 2)) * r * 0.25;
  if (t > 0.01) {
    g.beginPath();
    g.moveTo(hx, hy + r * 0.2);
    g.lineTo(hx, hy + r * 0.2 + t);
    g.lineTo(hx - r * 0.06, hy + r * 0.28 + t);
    g.moveTo(hx, hy + r * 0.2 + t);
    g.lineTo(hx + r * 0.06, hy + r * 0.28 + t);
    g.stroke();
  }
}

export function drawOwl(g, s, phase = 0, attacking = false) {
  const r = s.r;
  const flap = Math.sin(phase) * 0.35 + (attacking ? 0.6 : 0);
  g.fillStyle = s.furDark;
  ell(g, -r * 0.72, r * 0.05, r * 0.28, r * 0.6, 0.35 + flap);
  ell(g, r * 0.72, r * 0.05, r * 0.28, r * 0.6, -0.35 - flap);
  g.fillStyle = s.fur;
  ell(g, 0, r * 0.1, r * 0.72, r * 0.9);
  g.fillStyle = s.belly;
  ell(g, 0, r * 0.35, r * 0.48, r * 0.55);
  g.strokeStyle = s.furDark;
  g.lineWidth = r * 0.04;
  g.beginPath();
  for (let k = 0; k < 3; k++) {
    for (let j = -1; j <= 1; j++) {
      const x = j * r * 0.22;
      const y = r * 0.15 + k * r * 0.2;
      g.moveTo(x - r * 0.07, y);
      g.lineTo(x, y + r * 0.06);
      g.lineTo(x + r * 0.07, y);
    }
  }
  g.stroke();
  g.fillStyle = s.fur;
  tri(g, -r * 0.55, -r * 0.6, -r * 0.62, -r * 1.12, -r * 0.25, -r * 0.78);
  tri(g, r * 0.55, -r * 0.6, r * 0.62, -r * 1.12, r * 0.25, -r * 0.78);
  g.fillStyle = s.face;
  ell(g, -r * 0.26, -r * 0.45, r * 0.3, r * 0.3);
  ell(g, r * 0.26, -r * 0.45, r * 0.3, r * 0.3);
  glossyEye(g, -r * 0.26, -r * 0.45, r * 0.17, r * 0.17, '#0b0b0b', s.eye);
  glossyEye(g, r * 0.26, -r * 0.45, r * 0.17, r * 0.17, '#0b0b0b', s.eye);
  if (attacking) {
    g.strokeStyle = s.furDark;
    g.lineWidth = r * 0.07;
    g.beginPath();
    g.moveTo(-r * 0.5, -r * 0.78);
    g.lineTo(-r * 0.1, -r * 0.62);
    g.moveTo(r * 0.5, -r * 0.78);
    g.lineTo(r * 0.1, -r * 0.62);
    g.stroke();
  }
  g.fillStyle = '#e0a030';
  tri(g, -r * 0.08, -r * 0.3, r * 0.08, -r * 0.3, 0, -r * 0.14);
  g.fillStyle = '#e0a030';
  ell(g, -r * 0.2, r * 0.98, r * 0.12, r * 0.06);
  ell(g, r * 0.2, r * 0.98, r * 0.12, r * 0.06);
  if (s.bolts) {
    g.fillStyle = s.bolts;
    g.beginPath();
    g.moveTo(-r * 0.05, r * 0.1);
    g.lineTo(r * 0.12, r * 0.32);
    g.lineTo(0, r * 0.32);
    g.lineTo(r * 0.1, r * 0.6);
    g.lineTo(-r * 0.12, r * 0.28);
    g.lineTo(0, r * 0.28);
    g.closePath();
    g.fill();
  }
}

export function drawFerret(g, s, phase = 0, attacking = false) {
  const r = s.r;
  const step = Math.sin(phase);
  g.fillStyle = s.furDark;
  ell(g, -r * 0.25, r * 0.98 - Math.max(0, step) * r * 0.12, r * 0.16, r * 0.1);
  ell(g, r * 0.25, r * 0.98 - Math.max(0, -step) * r * 0.12, r * 0.16, r * 0.1);
  g.strokeStyle = s.furDark;
  g.lineWidth = r * 0.2;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-r * 0.35, r * 0.75);
  g.quadraticCurveTo(-r * 1.0, r * 0.6 + step * r * 0.1, -r * 1.1, r * 0.1);
  g.stroke();
  g.lineCap = 'butt';
  g.fillStyle = s.fur;
  ell(g, 0, r * 0.25, r * 0.48, r * 0.78);
  g.fillStyle = s.belly;
  ell(g, 0, r * 0.35, r * 0.28, r * 0.55);
  if (s.sash) {
    g.strokeStyle = s.sash;
    g.lineWidth = r * 0.14;
    g.beginPath();
    g.moveTo(-r * 0.42, -r * 0.1);
    g.lineTo(r * 0.4, r * 0.7);
    g.stroke();
    g.strokeStyle = '#7a4a10';
    g.lineWidth = r * 0.04;
    g.beginPath();
    g.arc(0, r * 0.3, r * 0.14, 0, TAU);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI + phase;
      g.moveTo(Math.cos(a) * r * 0.14, r * 0.3 + Math.sin(a) * r * 0.14);
      g.lineTo(-Math.cos(a) * r * 0.14, r * 0.3 - Math.sin(a) * r * 0.14);
    }
    g.stroke();
  }
  g.fillStyle = s.fur;
  ell(g, -r * 0.3, -r * 0.98, r * 0.14, r * 0.13);
  ell(g, r * 0.3, -r * 0.98, r * 0.14, r * 0.13);
  ell(g, 0, -r * 0.7, r * 0.44, r * 0.36);
  g.fillStyle = s.mask;
  ell(g, 0, -r * 0.74, r * 0.4, r * 0.13);
  g.fillStyle = s.belly;
  ell(g, 0, -r * 0.55, r * 0.22, r * 0.15);
  glossyEye(g, -r * 0.18, -r * 0.75, r * 0.08, attacking ? r * 0.05 : r * 0.08, '#0b0b0b');
  glossyEye(g, r * 0.18, -r * 0.75, r * 0.08, attacking ? r * 0.05 : r * 0.08, '#0b0b0b');
  g.fillStyle = '#3a2a2a';
  ell(g, 0, -r * 0.6, r * 0.06, r * 0.04);
  g.fillStyle = s.furDark;
  ell(g, attacking ? r * 0.45 : r * 0.2, attacking ? -r * 0.2 : r * 0.05, r * 0.11, r * 0.09);
  ell(g, -r * 0.2, r * 0.05, r * 0.11, r * 0.09);
}

const CAT = { belly: '#f6e6cf', earInner: '#e8a0a8', eye: '#9ad84a', upright: true, draw: drawCat };
export const PREDATOR_ART = {
  peasant: { ...CAT, fur: '#d98a3a', furDark: '#a85e20', stripes: '#a85e20' },
  spearman: { fur: '#b0703e', furDark: '#7a4422', belly: '#f2dcb0', eye: '#f2d23a', upright: true, draw: drawSnake },
  archer: { fur: '#c39a66', furDark: '#8f6a3e', belly: '#f4e6cc', face: '#f7ecd8', eye: '#2a1a0a', upright: true, draw: drawOwl },
  sorcerer: { ...CAT, fur: '#7a7f8c', furDark: '#545866', stripes: '#545866', eye: '#f2d23a', scarf: '#6b3f8c', gem: '#d7a6ff' },
};

export const HERALD_ART = {
  fur: '#e2b84a', furDark: '#a8822a', belly: '#fff1c6', mask: '#5a3a14', sash: '#ffd166', upright: true, draw: drawFerret,
};

export const PREDATOR_BOSS_ART = {
  zhangbao: { ...CAT, fur: '#d2762e', furDark: '#8f4515', stripes: '#8f4515', eye: '#f2c230', bandana: '#c9372e', scar: true },
  zhangjiao: {
    fur: '#3b3f7a', furDark: '#262a58', belly: '#6f78c0', face: '#9fb5ff', eye: '#ffe066', bolts: '#8ec5ff', upright: true, draw: drawOwl,
  },
};
