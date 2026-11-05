import { useEffect, useRef, useState } from 'react';
import { TOTAL_WAVES } from '../game/constants';

export function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function Hud({ hud, onPause, isTouch, wheelPanel }) {
  const [killPulse, setKillPulse] = useState(false);
  const lastKills = useRef(0);

  useEffect(() => {
    if (!hud) return;
    if (hud.kills !== lastKills.current) {
      lastKills.current = hud.kills;
      setKillPulse(true);
      const t = setTimeout(() => setKillPulse(false), 180);
      return () => clearTimeout(t);
    }
  }, [hud]);

  if (!hud) return null;
  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const xpPct = Math.max(0, Math.min(100, (hud.xp / hud.xpNeeded) * 100));

  return (
    <div className="hud">
      <div className="hud-top-left">
        <div className="bar hp">
          <div className="fill" style={{ width: `${hpPct}%` }} />
          <span>
            {hud.hp} / {hud.maxHp}
          </span>
        </div>
        <div className="bar xp">
          <div className="fill" style={{ width: `${xpPct}%` }} />
          <span>Lv {hud.level}</span>
        </div>
        {hud.form && (
          <div className={`form-badge form-${hud.form.idx}`}>
            <b>{hud.form.name}</b>
            {hud.form.next && <span>next form at Lv {hud.form.next}</span>}
          </div>
        )}
        {wheelPanel}
      </div>

      <div className="hud-top-center">
        <div className="wave-label">
          Wave {hud.wave} / {TOTAL_WAVES}
        </div>
        <div className="timer">
          <span className={hud.waveActive ? '' : 'dim'}>{formatTime(hud.waveTime)}</span>
          <span className="sep">·</span>
          <span className="dim">{formatTime(hud.time)}</span>
        </div>
        {hud.boss && (
          <div className="boss-bar">
            <div className="fill" style={{ width: `${(hud.boss.hp / hud.boss.maxHp) * 100}%` }} />
            <span>{hud.boss.name}</span>
          </div>
        )}
      </div>

      <div className="hud-top-right">
        <div className={`kills ${killPulse ? 'pulse' : ''}`}>
          <span className="kills-label">Kills</span>
          <span className="kills-num">{hud.kills}</span>
        </div>
        <button className="pause-btn" onClick={onPause} aria-label="Pause">
          II
        </button>
      </div>

      <div className="hud-bottom">
        <div className="sig-slot">
          <div className={`sig-icon ${hud.sig.awakened ? 'awakened' : ''}`}>
            <div className="sig-cd" style={{ height: `${(1 - hud.sig.ready) * 100}%` }} />
            <span>{hud.sig.icon}</span>
            {hud.sig.charges !== null && (
              <b className="sig-charges">
                {hud.sig.charges}/{hud.sig.maxCharges}
              </b>
            )}
          </div>
        </div>
        <div className="upgrade-icons">
          {hud.upgrades.map((u) => (
            <div key={u.id} className={`uicon ${u.unique ? 'unique' : ''}`} title={u.name}>
              <span>{u.icon}</span>
              <b>{u.level}</b>
            </div>
          ))}
        </div>
        <div className="hint">{isTouch ? 'Drag anywhere to move' : 'WASD / Arrows to move · ESC to pause'}</div>
      </div>
    </div>
  );
}
