import TierBadge from './TierBadge';
import Portrait from './Portrait';

export default function MainMenu({ general, highScore, wheelPanel, round, onRoundChallenge, onPlay, onChooseGeneral, onHowToPlay }) {
  return (
    <div className="screen menu-screen">
      <div className="menu-bg" />
      <div className="menu-content">
        <h1 className="title">Mandate of the Wheel</h1>
        <h2 className="subtitle">Hamsters × Squeekchain</h2>
        <p className="tagline">
          Hold the burrow against the predators. Level up to transform, and let Squeektoshi&apos;s real wheel, live on Squeekchain, turn the battle.
        </p>

        {wheelPanel}

        <div className="selected-general">
          <div className="general-avatar">
            <Portrait generalId={general.id} size={60} />
          </div>
          <div>
            <div className="selected-label">Your hamster</div>
            <div className="selected-name">
              {general.name} <TierBadge tier={general.tier} size="sm" />
            </div>
            <div className="selected-title">{general.title}</div>
          </div>
        </div>

        {highScore > 0 && <div className="high-score">Best score: {highScore.toLocaleString()}</div>}

        <div className="menu-buttons">
          <button className="btn btn-primary btn-lg" onClick={onPlay}>
            Play
          </button>
          {round > 0 && (
            <button className="btn btn-round" onClick={onRoundChallenge}>
              Round {round.toLocaleString()} Challenge
              <small>Same battlefield for everyone in this ten-minute round</small>
            </button>
          )}
          <button className="btn" onClick={onChooseGeneral}>
            Choose Hamster
          </button>
          <button className="btn" onClick={onHowToPlay}>
            How to Play
          </button>
        </div>

        <p className="credit">
          Live data from the public{' '}
          <a href="https://docs.squeekchain.com/developers/api/" target="_blank" rel="noreferrer">Squeekchain API</a>{' '}
          (Sepolia). Squeektoshi is never woken or pushed to run: his naps help you too.
        </p>
      </div>
    </div>
  );
}
