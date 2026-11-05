import { liveMode } from '../squeek/wheel';
import { wheelEffects } from '../squeek/effects';
import SqueektoshiWheel from './SqueektoshiWheel';

const LABEL = { running: 'Running', resting: 'Resting', unknown: 'Unknown' };

function clock(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

// Squeektoshi's wheel as the battle sees it. In a run, `battle` is the state the game applies
// (it waits 20 s before calling a pause a rest); on the menu it is the live reading itself.
// The picture always shows what Squeektoshi is doing right now, from the live reading.
export default function WheelPanel({ snap, round, battle, compact = false }) {
  const live = liveMode(snap);
  const mode = battle ? battle.mode : live;
  const fx = battle ? { title: battle.title, lines: battle.lines } : wheelEffects(mode, snap.rpm);
  const known = Number.isFinite(snap.rpm);
  const progress = Number.isFinite(snap.progress) ? Math.round(snap.progress * 100) : null;
  const nextBlock = Number.isFinite(snap.projectedHeight) ? snap.projectedHeight + 1 : null;

  return (
    <div className={`wheel-panel mode-${mode} ${compact ? 'compact' : ''}`}>
      <div className="wheel-body">
        <SqueektoshiWheel mode={live} rpm={snap.rpm} width={compact ? 58 : 128} height={compact ? 56 : 120} />
        <div className="wheel-info">
          <div className="wheel-head">
            <span className="wheel-dot" />
            <span className="wheel-name">Squeektoshi</span>
            <span className="wheel-state">{LABEL[mode]}</span>
            {mode === 'running' && known && snap.rpm > 0 && <span className="wheel-rpm">{Math.round(snap.rpm)} rpm</span>}
          </div>
          {mode === 'unknown' && (
            <div className="wheel-why">
              {snap.reason === 'loading' ? 'Reading the wheel…' : `No live reading (${snap.reason || 'offline'})`}
            </div>
          )}
          {battle && battle.pending && battle.pending !== mode && (
            <div className="wheel-why">Turning {LABEL[battle.pending].toLowerCase()}…</div>
          )}
          <div className="wheel-fx">
            <b>{fx.title}</b>
            {!compact && fx.lines.map((l) => <span key={l}>{l}</span>)}
            {compact && <span>{fx.lines.join(' · ')}</span>}
          </div>
          <div className="wheel-block">
            <div className="wheel-bar">
              <div className="fill" style={{ width: `${progress ?? 0}%` }} />
              <span>{nextBlock !== null ? `Squeek block #${nextBlock.toLocaleString()} · ${progress}%` : 'Squeek block: unknown'}</span>
            </div>
          </div>
          {round && round.round > 0 && (
            <div className="wheel-round">
              Round {round.round.toLocaleString()} · next Herald in {clock(round.secondsLeft)}
            </div>
          )}
          {!compact && known && (
            <div className="wheel-today">Today on the wheel: {(snap.distanceM / 1000).toFixed(2)} km</div>
          )}
        </div>
      </div>
    </div>
  );
}
