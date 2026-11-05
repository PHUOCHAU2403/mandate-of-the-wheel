// Tests for the Squeekchain layer, against a real /v1/status response captured on 2026-11-04.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseStatus, liveMode, roundAt, WheelFeed, STALE_MS } from '../src/squeek/wheel.js';
import { wheelEffects } from '../src/squeek/effects.js';
import { newWheelState, stepWheel } from '../src/squeek/wheelArt.js';

const real = JSON.parse(readFileSync(new URL('./fixtures/status-2026-11-04.json', import.meta.url), 'utf8'));
const received = Date.parse(real.measurement.receivedAt);
const withStatus = (coreStatus, extra = {}) => ({ ...real, measurement: { ...real.measurement, coreStatus, ...extra } });

test('real IDLE reading parses as resting, with block height and progress', () => {
  const s = parseStatus(real, received + 5000);
  assert.equal(s.mode, 'resting');
  assert.equal(s.height, 8430);
  assert.equal(s.projectedHeight, 8430);
  assert.ok(Math.abs(s.progress - 0.478838171) < 1e-9);
  assert.equal(s.settledRound, 1262);
  assert.equal(s.rpm, 0);
});

test('ACTIVE is running; rpm comes from rpmMilli', () => {
  const s = parseStatus(withStatus('ACTIVE', { rpmMilli: 64250 }), received + 1000);
  assert.equal(s.mode, 'running');
  assert.equal(s.rpm, 64.25);
});

test('unknown is never shown as resting: stale, fault, offline, wrong schema, no reading', () => {
  assert.equal(parseStatus(real, received + STALE_MS + 1000).mode, 'unknown');
  assert.equal(parseStatus(real, received + STALE_MS + 1000).reason, 'stale');
  assert.equal(parseStatus(withStatus('COUNTER_FAULT'), received).mode, 'unknown');
  assert.equal(parseStatus(withStatus('IDLE', { freshness: 'stale' }), received).mode, 'unknown');
  assert.equal(parseStatus({ ...real, schemaVersion: 2 }).mode, 'unknown');
  assert.equal(parseStatus({ ...real, measurement: null }).mode, 'unknown');
});

test('liveMode ages a reading between polls', () => {
  const s = parseStatus(real, received + 1000);
  assert.equal(liveMode(s, received + 60_000), 'resting');
  assert.equal(liveMode(s, received + STALE_MS + 1), 'unknown');
  assert.equal(liveMode(null), 'unknown');
});

test('round math matches SqueekCore: 600 s rounds from the genesis /v1/core reports', () => {
  // The 2026-10-25 installation: genesis 1793022600.
  const s = { genesis: 1793022600, roundSeconds: 600 };
  assert.deepEqual(roundAt(1793022600 * 1000, s), { round: 1, secondsLeft: 600 });
  assert.deepEqual(roundAt((1793022600 + 600) * 1000, s), { round: 2, secondsLeft: 600 });
  assert.equal(roundAt((1793022600 - 5) * 1000, s).round, 0);
  // /v1/economy/state said currentRound 1263 at 2026-11-04T08:16:49Z.
  assert.equal(roundAt(Date.parse('2026-11-04T08:16:49Z'), s).round, 1263);
});

test('no schedule yet means no round, never a guessed one', () => {
  assert.deepEqual(roundAt(Date.now()), { round: 0, secondsLeft: 0 });
  assert.equal(new WheelFeed().round().round, 0);
});

test('a new installation resets the block baseline and the schedule', () => {
  const f = new WheelFeed();
  let coreReads = 0;
  f.pollCore = () => { coreReads++; };
  f.schedule = { genesis: 1793022600, roundSeconds: 600 };
  const seen = [];
  f.onBlocks((d) => seen.push(d));
  f.emit({ mode: 'resting', height: 8430, installationId: 'stream-game-sepolia-test-20261025-01' });
  f.emit({ mode: 'resting', height: 0, installationId: 'sepolia-core-sepolia-20261103' });
  assert.equal(f.schedule, null);
  assert.equal(coreReads, 1);
  f.emit({ mode: 'resting', height: 2, installationId: 'sepolia-core-sepolia-20261103' });
  assert.deepEqual(seen, [2]);
});

test('block listener fires on settled height increases only', () => {
  const f = new WheelFeed();
  const seen = [];
  f.onBlocks((d, h) => seen.push([d, h]));
  f.emit({ mode: 'resting', height: 8430 });
  f.emit({ mode: 'resting', height: 8430 });
  f.emit({ mode: 'running', height: 8471 });
  f.emit({ mode: 'unknown', reason: 'offline' });
  f.emit({ mode: 'running', height: 8470 });
  f.emit({ mode: 'running', height: 8472 });
  assert.deepEqual(seen, [[41, 8471], [1, 8472]]);
});

test('effects: running scales with rpm, resting defends, unknown is neutral', () => {
  const full = wheelEffects('running', 80);
  assert.equal(full.atk, 1.35);
  assert.equal(full.move, 1.18);
  const slow = wheelEffects('running', 0);
  assert.equal(slow.k, 0.3);
  const rest = wheelEffects('resting', 0, 8);
  assert.equal(rest.armor, 6);
  assert.equal(rest.xp, 1.25);
  assert.ok(rest.regenPct > 0);
  const fog = wheelEffects('unknown');
  assert.deepEqual([fog.atk, fog.move, fog.armor, fog.regenPct, fog.xp], [1, 1, 0, 0, 1]);
});

test('the drawn wheel turns at his real rpm, and stops when he rests or the reading is unknown', () => {
  const st = newWheelState();
  for (let i = 0; i < 600; i++) stepWheel(st, 1 / 60, 'running', 60);
  // 60 rpm is one turn per second: 2*pi rad/s once eased in.
  assert.ok(Math.abs(st.speed - 2 * Math.PI) < 0.01, `speed ${st.speed}`);
  for (let i = 0; i < 600; i++) stepWheel(st, 1 / 60, 'resting', 60);
  assert.equal(st.speed, 0);
  for (let i = 0; i < 60; i++) stepWheel(st, 1 / 60, 'running', 120);
  for (let i = 0; i < 600; i++) stepWheel(st, 1 / 60, 'unknown', 120);
  assert.equal(st.speed, 0);
});
