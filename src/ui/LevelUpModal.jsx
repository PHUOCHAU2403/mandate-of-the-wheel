import { RARITIES } from '../game/upgrades';

export default function LevelUpModal({ cards, level, onChoose }) {
  return (
    <div className="overlay levelup">
      <div className="levelup-header">
        <h2>Level {level}</h2>
        <p>Choose one upgrade</p>
      </div>
      <div className="cards">
        {cards.map((c) => {
          const r = RARITIES[c.rarity];
          return (
            <button
              key={c.key}
              className={`card rarity-${c.rarity}`}
              style={{ borderColor: r.color }}
              onClick={() => onChoose(c)}
            >
              <div className="card-top">
                <span className="card-rarity" style={{ color: r.color }}>
                  {r.label}
                </span>
                {c.unique && <span className="card-tag">Breed</span>}
              </div>
              <div className="card-icon" style={{ borderColor: r.color }}>
                {c.icon}
              </div>
              <div className="card-name">{c.name}</div>
              <div className="card-level">
                {c.id === 'rations' ? 'Consumable' : (
                  <>
                    Lv {c.level} <span className="arrow">→</span> Lv {c.nextLevel}
                    {c.nextLevel === c.maxLevel && c.unique && c.id.startsWith('sig_') ? <span className="awaken"> Awaken</span> : null}
                  </>
                )}
              </div>
              <div className="card-text">{c.text}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
