// Squeektoshi in the WHEELY9000, drawn from the live reading. The wheel turns at his real rpm,
// a magnet on the rim lights the sensor LED as it passes (one passage = one work unit on Squeekchain),
// he curls up asleep when resting, and the whole device greys out with a "?" when the reading is unknown.

const TAU = Math.PI * 2;

function ell(g, x, y, rx, ry, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
  g.fill();
}

// Side view, facing right. Squeektoshi is a white-orange Syrian hamster.
function drawRunner(g, s, phase, moving) {
  const lift = moving ? Math.abs(Math.sin(phase)) * s * 0.08 : 0;
  g.save();
  g.translate(0, -lift);
  g.rotate(moving ? -0.08 : 0);

  // Legs: a gallop, front and back pairs out of phase.
  g.fillStyle = '#f6a8b0';
  const legs = [
    [0.55, Math.sin(phase)], [0.4, Math.sin(phase + 0.6)],
    [-0.5, Math.sin(phase + Math.PI)], [-0.65, Math.sin(phase + Math.PI + 0.6)],
  ];
  for (const [x, k] of legs) {
    const dx = moving ? k * s * 0.22 : 0;
    const dy = moving ? Math.max(0, -k) * s * 0.12 : 0;
    ell(g, x * s + dx, s * 0.62 - dy, s * 0.14, s * 0.09);
  }

  ell(g, -s * 1.0, s * 0.12, s * 0.1, s * 0.08);
  g.fillStyle = '#fffaf2';
  ell(g, 0, 0, s * 1.0, s * 0.72);
  // Orange saddle over the back, clipped to the body.
  g.save();
  g.beginPath();
  g.ellipse(0, 0, s * 1.0, s * 0.72, 0, 0, TAU);
  g.clip();
  g.fillStyle = '#f0a050';
  ell(g, -s * 0.15, -s * 0.42, s * 0.95, s * 0.5);
  g.restore();

  // Head: white face with an orange cap, ear, big glossy eye, pink nose and cheek.
  g.fillStyle = '#fffaf2';
  ell(g, s * 0.85, -s * 0.12, s * 0.55, s * 0.5);
  g.fillStyle = '#f0a050';
  ell(g, s * 0.72, -s * 0.42, s * 0.42, s * 0.24, -0.3);
  ell(g, s * 0.58, -s * 0.62, s * 0.2, s * 0.2);
  g.fillStyle = '#f4a7a0';
  ell(g, s * 0.58, -s * 0.6, s * 0.11, s * 0.11);
  g.fillStyle = 'rgba(255,120,140,0.45)';
  ell(g, s * 0.98, s * 0.06, s * 0.15, s * 0.09);
  g.fillStyle = '#140c08';
  ell(g, s * 1.02, -s * 0.2, s * 0.11, s * 0.13);
  g.fillStyle = '#ffffff';
  ell(g, s * 0.99, -s * 0.25, s * 0.045, s * 0.045);
  g.fillStyle = '#f08f9a';
  ell(g, s * 1.36, -s * 0.06, s * 0.07, s * 0.06);
  g.strokeStyle = 'rgba(120,90,70,0.55)';
  g.lineWidth = Math.max(0.6, s * 0.03);
  g.beginPath();
  g.moveTo(s * 1.25, 0);
  g.lineTo(s * 1.6, -s * 0.06);
  g.moveTo(s * 1.25, s * 0.05);
  g.lineTo(s * 1.58, s * 0.1);
  g.stroke();
  g.restore();
}

function drawSleeper(g, s, t) {
  const breathe = 1 + Math.sin(t * 2) * 0.03;
  g.save();
  g.scale(breathe, 1 / breathe);
  g.fillStyle = '#fffaf2';
  ell(g, 0, 0, s * 0.95, s * 0.7);
  g.save();
  g.beginPath();
  g.ellipse(0, 0, s * 0.95, s * 0.7, 0, 0, TAU);
  g.clip();
  g.fillStyle = '#f0a050';
  ell(g, -s * 0.1, -s * 0.45, s * 0.95, s * 0.5);
  g.restore();
  g.fillStyle = '#f0a050';
  ell(g, s * 0.5, -s * 0.55, s * 0.18, s * 0.18);
  g.fillStyle = '#f4a7a0';
  ell(g, s * 0.5, -s * 0.53, s * 0.1, s * 0.1);
  g.strokeStyle = '#3a2a20';
  g.lineWidth = Math.max(0.8, s * 0.06);
  g.beginPath();
  g.arc(s * 0.6, -s * 0.05, s * 0.11, 0.2, Math.PI - 0.2);
  g.stroke();
  g.fillStyle = 'rgba(255,120,140,0.45)';
  ell(g, s * 0.68, s * 0.15, s * 0.13, s * 0.08);
  g.fillStyle = '#f08f9a';
  ell(g, s * 0.9, s * 0.08, s * 0.06, s * 0.05);
  g.restore();
}

/**
 * Draw one frame. `st` is the animation state the component keeps:
 * { angle, phase, ledUntil } (mutated here), and the inputs { mode, t }.
 * Returns nothing; width/height are CSS pixels of the drawing area.
 */
export function drawWheelScene(g, w, h, st) {
  const R = Math.min(w * 0.42, h * 0.38);
  const cx = w / 2;
  const cy = h * 0.43;
  const unknown = st.mode === 'unknown';
  g.clearRect(0, 0, w, h);
  g.save();
  if (unknown) g.globalAlpha = 0.45;

  // Stand and base plate.
  g.strokeStyle = '#9aa3b5';
  g.lineWidth = R * 0.08;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx - R * 0.72, cy + R * 1.22);
  g.moveTo(cx, cy);
  g.lineTo(cx + R * 0.72, cy + R * 1.22);
  g.stroke();
  g.fillStyle = '#7c6cf0';
  g.fillRect(cx - R * 1.0, cy + R * 1.18, R * 2.0, R * 0.2);
  if (w >= 90) {
    g.fillStyle = '#ffffff';
    g.font = `bold ${Math.round(R * 0.15)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('WHEELY9000', cx, cy + R * 1.285);
  }

  // Wheel: rim, rungs and spokes turn together.
  const rimColor = unknown ? '#a7abb5' : '#8a74ff';
  g.strokeStyle = rimColor;
  g.lineWidth = R * 0.09;
  g.beginPath();
  g.arc(cx, cy, R, 0, TAU);
  g.stroke();
  g.strokeStyle = 'rgba(138,116,255,0.35)';
  g.lineWidth = R * 0.035;
  g.beginPath();
  g.arc(cx, cy, R * 0.86, 0, TAU);
  g.stroke();
  g.strokeStyle = 'rgba(138,116,255,0.55)';
  g.lineWidth = R * 0.03;
  g.beginPath();
  for (let k = 0; k < 28; k++) {
    const a = st.angle + (k / 28) * TAU;
    g.moveTo(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86);
    g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
  }
  for (let k = 0; k < 6; k++) {
    const a = st.angle + (k / 6) * TAU;
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86);
  }
  g.stroke();
  g.fillStyle = '#ffd166';
  ell(g, cx, cy, R * 0.11, R * 0.11);

  // Magnet on the rim and the sensor on the left leg: the LED lights as the magnet passes.
  const ma = st.angle;
  g.fillStyle = '#e8453a';
  g.save();
  g.translate(cx + Math.cos(ma) * R, cy + Math.sin(ma) * R);
  g.rotate(ma);
  g.fillRect(-R * 0.06, -R * 0.09, R * 0.12, R * 0.18);
  g.restore();
  const sensorA = Math.PI * 0.72;
  const sx = cx + Math.cos(sensorA) * R * 1.13;
  const sy = cy + Math.sin(sensorA) * R * 1.13;
  const d = Math.abs(((ma - sensorA) % TAU + TAU + Math.PI) % TAU - Math.PI);
  if (!unknown && d < 0.22) st.ledUntil = st.t + 0.12;
  g.fillStyle = '#4a4f5c';
  g.fillRect(sx - R * 0.1, sy - R * 0.07, R * 0.2, R * 0.14);
  g.fillStyle = st.t < st.ledUntil ? '#5dff8f' : '#1f5a32';
  ell(g, sx, sy, R * 0.04, R * 0.04);

  // Squeektoshi at the bottom of the wheel, slightly up the curve he climbs.
  const s = R * 0.36;
  if (st.mode === 'resting') {
    g.save();
    g.translate(cx + R * 0.05, cy + R * 0.86 - s * 0.7);
    drawSleeper(g, s, st.t);
    g.restore();
    g.fillStyle = '#7c6cf0';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let k = 0; k < 3; k++) {
      const p = (st.t * 0.5 + k / 3) % 1;
      g.globalAlpha = (unknown ? 0.45 : 1) * (1 - p);
      g.font = `bold ${Math.round(R * (0.16 + k * 0.05))}px sans-serif`;
      g.fillText('z', cx + R * (0.3 + p * 0.35 + k * 0.08), cy + R * (0.2 - p * 0.6));
    }
    g.globalAlpha = unknown ? 0.45 : 1;
  } else {
    const a = Math.PI / 2 - 0.22;
    g.save();
    g.translate(cx + Math.cos(a) * (R * 0.86 - s * 0.72), cy + Math.sin(a) * (R * 0.86 - s * 0.72));
    g.rotate(a - Math.PI / 2);
    drawRunner(g, s, st.phase, st.speed > 0.05);
    g.restore();
    if (st.speed > 0.6) {
      g.strokeStyle = 'rgba(138,116,255,0.45)';
      g.lineWidth = R * 0.03;
      g.beginPath();
      for (let k = 0; k < 3; k++) {
        const y = cy + R * (0.48 + k * 0.1);
        g.moveTo(cx - R * (0.35 + k * 0.05), y);
        g.lineTo(cx - R * (0.6 + k * 0.05), y);
      }
      g.stroke();
    }
  }
  g.restore();

  if (unknown) {
    g.fillStyle = '#ffffff';
    ell(g, cx + R * 0.62, cy - R * 0.62, R * 0.26, R * 0.26);
    g.fillStyle = '#8a8f99';
    g.font = `bold ${Math.round(R * 0.36)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', cx + R * 0.62, cy - R * 0.6);
  }
}

// Advance the animation: the wheel eases toward his real angular speed (rpm/60 turns per second).
export function stepWheel(st, dt, mode, rpm) {
  const target = mode === 'running' ? Math.max(0, rpm || 0) / 60 * TAU : 0;
  st.speed += (target - st.speed) * Math.min(1, dt * 3);
  if (st.speed < 0.01 && target === 0) st.speed = 0;
  st.angle = (st.angle + st.speed * dt) % TAU;
  st.phase += st.speed * dt * 4.5;
  st.t += dt;
  st.mode = mode;
}

export function newWheelState() {
  return { angle: 0, phase: 0, speed: 0, t: 0, ledUntil: 0, mode: 'unknown' };
}
