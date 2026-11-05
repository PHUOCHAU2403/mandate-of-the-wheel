import { GENERALS } from '../game/generals';
import TierBadge from './TierBadge';
import Portrait from './Portrait';

export default function GeneralSelect({ selectedId, onSelect, seed, onSeedChange, onStart, onBack }) {
  return (
    <div className="screen select-screen">
      <div className="menu-bg" />
      <div className="select-content">
        <h2 className="screen-title">Choose Your Hamster</h2>
        <div className="general-grid">
          {GENERALS.map((g) => (
            <button
              key={g.id}
              className={`general-card ${g.id === selectedId ? 'selected' : ''}`}
              onClick={() => onSelect(g.id)}
            >
              <div className="general-card-top">
                <div className="general-avatar">
                  <Portrait generalId={g.id} size={56} />
                </div>
                <TierBadge tier={g.tier} />
              </div>
              <div className="general-name">{g.name}</div>
              <div className="general-title">{g.title}</div>
              <div className="general-row">
                <span className="label">Troops</span>
                <span>{g.troopType}</span>
              </div>
              <div className="general-row">
                <span className="label">Signature</span>
                <span>
                  <span className="skill-icon">{g.signatureSkill.icon}</span> {g.signatureSkill.name}
                </span>
              </div>
              <div className="general-desc">{g.signatureSkill.desc}</div>
              <div className="general-desc troop">{g.troopDesc}</div>
              <div className="general-stats">
                <span>HP {g.baseStats.maxHp}</span>
                <span>DMG {g.baseStats.damage}</span>
                <span>SPD {g.baseStats.moveSpeed}</span>
                <span>ARM {g.baseStats.armor}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="seed-row">
          <label htmlFor="seed-input">Seed (optional)</label>
          <input
            id="seed-input"
            type="text"
            value={seed}
            placeholder="Leave empty for a random seed"
            onChange={(e) => onSeedChange(e.target.value.toUpperCase())}
            maxLength={24}
          />
        </div>
        <div className="menu-buttons row">
          <button className="btn" onClick={onBack}>
            Back
          </button>
          <button className="btn btn-primary btn-lg" onClick={onStart}>
            Start Battle
          </button>
        </div>
      </div>
    </div>
  );
}
