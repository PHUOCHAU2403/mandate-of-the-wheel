// Live feed from Squeekchain's public API: Squeektoshi's wheel, Squeek blocks and ten-minute rounds.
// Unknown is never dressed up as resting: a failed, stale or faulted reading is mode 'unknown'.

const API = 'https://api.squeekchain.com';
const STATUS_EVERY = 10_000;
const CORE_EVERY = 5 * 60_000;
export const STALE_MS = 120_000;              // the API's own staleAfterSeconds
const BLOCK_UNITS = 1_000_000_000;
// SqueekCore configuration on Sepolia, used until /v1/core answers.
const DEFAULT_SCHEDULE = { genesis: 1793022600, roundSeconds: 600 };

export function roundAt(nowMs, schedule = DEFAULT_SCHEDULE) {
  const t = Math.floor(nowMs / 1000) - schedule.genesis;
  if (t < 0) return { round: 0, secondsLeft: -t };
  return { round: Math.floor(t / schedule.roundSeconds) + 1, secondsLeft: schedule.roundSeconds - (t % schedule.roundSeconds) };
}

// /v1/status (schemaVersion 1) → the few numbers the game uses.
export function parseStatus(j, nowMs = Date.now()) {
  if (!j || j.schemaVersion !== 1) return { mode: 'unknown', reason: 'schema' };
  const m = j.measurement;
  const out = { mode: 'unknown', reason: 'no reading', rpm: null, speedMs: null, distanceM: null };
  if (m) {
    const receivedAt = Date.parse(m.receivedAt);
    out.receivedAt = receivedAt;
    out.rpm = m.rpmMilli / 1000;
    out.speedMs = m.speedMmPerSecond / 1000;
    out.distanceM = m.distanceMm / 1000;
    out.provenance = m.provenance;
    if (m.coreStatus === 'COUNTER_FAULT') out.reason = 'sensor fault';
    else if (m.freshness !== 'online' || !(nowMs - receivedAt < STALE_MS)) out.reason = 'stale';
    else if (m.coreStatus === 'ACTIVE') { out.mode = 'running'; out.reason = null; }
    else if (m.coreStatus === 'IDLE') { out.mode = 'resting'; out.reason = null; }
    else out.reason = 'device ' + m.coreStatus;
  }
  const a = j.builder && j.builder.status === 'available' ? j.builder.anchor : null;
  const pr = j.builder && j.builder.status === 'available' ? j.builder.projected : null;
  if (a) {
    out.height = Number(a.blockHeight);
    out.settledRound = Number(a.settledThroughRound);
  }
  if (pr) {
    out.projectedHeight = Number(pr.blockHeight);
    out.progress = Number(pr.blockProgress) / BLOCK_UNITS;
  }
  return out;
}

// Same rule the game applies every frame: a reading older than STALE_MS is unknown, even between polls.
export function liveMode(snap, nowMs = Date.now()) {
  if (!snap || snap.mode === 'unknown') return 'unknown';
  if (!(nowMs - snap.receivedAt < STALE_MS)) return 'unknown';
  return snap.mode;
}

export class WheelFeed {
  constructor() {
    this.snap = { mode: 'unknown', reason: 'loading' };
    this.schedule = { ...DEFAULT_SCHEDULE };
    this.listeners = new Set();
    this.blockListeners = new Set();
    this.lastHeight = null;
    this.etag = null;
    this.timer = 0;
    this.coreTimer = 0;
    this.backoffUntil = 0;
  }

  subscribe(fn) { this.listeners.add(fn); fn(this.snap); return () => this.listeners.delete(fn); }
  onBlocks(fn) { this.blockListeners.add(fn); return () => this.blockListeners.delete(fn); }

  start() {
    if (this.timer) return;
    const tick = () => { this.poll(); this.timer = setTimeout(tick, STATUS_EVERY); };
    const coreTick = () => { this.pollCore(); this.coreTimer = setTimeout(coreTick, CORE_EVERY); };
    tick();
    coreTick();
  }

  stop() { clearTimeout(this.timer); clearTimeout(this.coreTimer); this.timer = 0; this.coreTimer = 0; }

  async get(path, headers = {}) {
    const r = await fetch(API + path, { headers, signal: AbortSignal.timeout(8000), cache: 'no-store' });
    if (r.status === 429 || r.status === 503) {
      const wait = Number(r.headers.get('retry-after')) || 15;
      this.backoffUntil = Date.now() + wait * 1000;
      throw new Error('busy ' + r.status);
    }
    return r;
  }

  async poll() {
    if (Date.now() < this.backoffUntil) return;
    try {
      const r = await this.get('/v1/status', this.etag ? { 'If-None-Match': this.etag } : {});
      let json;
      if (r.status === 304 && this.lastJson) json = this.lastJson;   // unchanged: re-judge its age now
      else if (!r.ok) throw new Error('http ' + r.status);
      else { json = await r.json(); this.lastJson = json; this.etag = r.headers.get('etag'); }
      const snap = parseStatus(json);
      snap.fetchedAt = Date.now();
      this.emit(snap);
    } catch (e) {
      // Keep the last numbers for display, but the reading itself is no longer trusted.
      this.emit({ ...this.snap, mode: 'unknown', reason: 'offline', error: String(e.message || e) });
    }
  }

  async pollCore() {
    try {
      const r = await this.get('/v1/core');
      if (!r.ok) return;
      const j = await r.json();
      const c = j && j.configuration;
      if (c && Number(c.genesisTimestamp) > 0 && Number(c.roundDuration) > 0) {
        this.schedule = { genesis: Number(c.genesisTimestamp), roundSeconds: Number(c.roundDuration) };
      }
    } catch { /* keep the default schedule */ }
  }

  emit(snap) {
    this.snap = snap;
    if (Number.isFinite(snap.height)) {
      if (this.lastHeight !== null && snap.height > this.lastHeight) {
        const delta = snap.height - this.lastHeight;
        for (const fn of this.blockListeners) fn(delta, snap.height);
      }
      if (this.lastHeight === null || snap.height > this.lastHeight) this.lastHeight = snap.height;
    }
    for (const fn of this.listeners) fn(snap);
  }

  round(nowMs = Date.now()) { return roundAt(nowMs, this.schedule); }
}

export const wheelFeed = new WheelFeed();
