import { RARITIES } from '../game/upgrades';
import { formatTime } from './Hud';
import Portrait from './Portrait';

// How Squeektoshi's wheel shaped this run: share of time under each state, and what it dropped.
function WheelReport({ w }) {
  const total = w.running + w.resting + w.unknown || 1;
  const pct = (v) => Math.round((100 * v) / total);
  return (
    <div className="wheel-report">
      <h3>The wheel in this battle</h3>
      <div className="wheel-split">
        <div className="seg running" style={{ width: `${pct(w.running)}%` }} />
        <div className="seg resting" style={{ width: `${pct(w.resting)}%` }} />
        <div className="seg unknown" style={{ width: `${pct(w.unknown)}%` }} />
      </div>
      <div className="wheel-legend">
        <span className="running">Mandate {pct(w.running)}%</span>
        <span className="resting">Night Watch {pct(w.resting)}%</span>
        <span className="unknown">Fog {pct(w.unknown)}%</span>
      </div>
      <div className="wheel-counts">
        {w.blocks} Squeek block{w.blocks === 1 ? '' : 's'} settled · {w.rounds} round{w.rounds === 1 ? '' : 's'} turned ·{' '}
        {w.heralds} Herald{w.heralds === 1 ? '' : 's'} defeated · {w.treasures} treasure{w.treasures === 1 ? '' : 's'} claimed
      </div>
    </div>
  );
}

export default function ResultsScreen({ results, highScore, onPlayAgain, onChangeGeneral }) {
  const r = results;
  return (
    <div className="overlay results">
      <div className="results-panel">
        <div className={`results-title ${r.victory ? 'victory' : 'defeat'}`}>
          <h2>{r.victory ? 'Victory' : 'Defeated'}</h2>
          <p>
            {r.general.name} · {r.general.title}
          </p>
        </div>

        {r.form && (
          <div className={`results-form form-${r.form.idx}`}>
            <Portrait generalId={r.general.id} size={64} form={r.form.idx} />
            <div>
              <div className="results-form-label">Highest form</div>
              <div className="results-form-name">{r.form.name}</div>
            </div>
          </div>
        )}

        <div className="score-box">
          <div className="score-label">Score</div>
          <div className="score-value">{r.score.toLocaleString()}</div>
          {highScore > 0 && (
            <div className={`score-best ${r.score >= highScore ? 'new' : ''}`}>
              {r.score >= highScore ? 'New best!' : `Best: ${highScore.toLocaleString()}`}
            </div>
          )}
          <div className="score-breakdown">
            {r.kills} kills × 10 + {r.wavesCleared} waves × 1000
            {r.victory ? ` + ${r.hpPct}% HP × 10` : ''}
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat">
            <span className="stat-label">Wave reached</span>
            <span className="stat-value">{r.wave}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Kills</span>
            <span className="stat-value">{r.kills}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Time survived</span>
            <span className="stat-value">{formatTime(r.time)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Level</span>
            <span className="stat-value">{r.level}</span>
          </div>
        </div>

        {r.wheel && <WheelReport w={r.wheel} />}

        <div className="build-section">
          <h3>Build ({r.build.length} picks)</h3>
          {r.build.length === 0 ? (
            <p className="dim">No upgrades were picked.</p>
          ) : (
            <ol className="build-list">
              {r.build.map((b, i) => (
                <li key={`${b.id}-${i}`} className={b.unique ? 'unique' : ''}>
                  <span className="build-icon" style={{ borderColor: RARITIES[b.rarity].color }}>
                    {b.icon}
                  </span>
                  <span className="build-name">{b.name}</span>
                  <span className="build-rarity" style={{ color: RARITIES[b.rarity].color }}>
                    {RARITIES[b.rarity].label}
                  </span>
                  <span className="build-level">Lv {b.level}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="seed-line">
          Seed: <code>{r.seed}</code>
        </div>

        <div className="menu-buttons row">
          <button className="btn btn-primary btn-lg" onClick={onPlayAgain}>
            Play again
          </button>
          <button className="btn" onClick={onChangeGeneral}>
            Change hamster
          </button>
        </div>
      </div>
    </div>
  );
}
