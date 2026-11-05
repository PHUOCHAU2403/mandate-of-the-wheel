export default function HowToPlay({ onBack }) {
  return (
    <div className="screen howto-screen">
      <div className="menu-bg" />
      <div className="howto-content">
        <h2 className="screen-title">How to Play</h2>
        <ul className="howto-list">
          <li>
            <b>Move</b> with WASD / arrow keys, or drag anywhere on a touch screen to use the joystick.
          </li>
          <li>
            Your hamster <b>attacks automatically</b> at the nearest predator, and its signature skill fires on its own when ready.
          </li>
          <li>
            Survive <b>10 waves</b> of 45 seconds. Enemies get more numerous, tougher and faster every wave.
          </li>
          <li>
            Collect glowing <b>XP gems</b>. Each level-up offers 3 upgrade cards; pick one. Every upgrade stacks to level 5.
          </li>
          <li>
            Raising the <b>signature skill to level 5</b> awakens it with a stronger, bigger effect.
          </li>
          <li>
            <b>Wave 5</b>: the Warlord Tabby charges at you. <b>Wave 10</b>: the Storm Owl calls lightning on telegraphed circles. Step out of them. Defeat her to win.
          </li>
          <li>
            Press <b>ESC</b> or the pause button to pause.
          </li>
        </ul>
        <h3 className="howto-sub">Transformations</h3>
        <ul className="howto-list">
          <li>
            At <b>Lv 5, 10, 15 and 20</b> your hamster transforms: new fur colour, a taller crest and a stronger aura. Each form
            releases a shockwave and raises damage, then attack speed, move speed, armor and range.
          </li>
          <li>
            <b>Spark Fur</b> (Lv 5) · <b>Golden Wheel</b> (Lv 10) · <b>Crimson Fury</b> (Lv 15) · <b>Azure Ascendant</b> (Lv 20).
          </li>
        </ul>
        <h3 className="howto-sub">Powered by Squeektoshi&apos;s wheel</h3>
        <ul className="howto-list">
          <li>
            The game reads <b>Squeekchain</b>&apos;s public API every 10 seconds: Squeektoshi the hamster runs the WHEELY9000, and his
            wheel work settles on Ethereum (Sepolia) as Squeek blocks.
          </li>
          <li>
            <b>Mandate of the Wheel</b>, while he runs: up to +35% attack speed and +18% move speed, scaled by his real rpm. A golden
            wheel turns around your hamster at his pace.
          </li>
          <li>
            <b>Night Watch</b>, while he rests: extra armor, +0.6% HP per second and +25% experience. A pause only counts as rest after
            20 seconds, so a sprint break doesn&apos;t flip the battle.
          </li>
          <li>
            <b>Fog of War</b>: if the reading is older than 2 minutes or the API can&apos;t be reached, you get no bonus. An unknown wheel is
            never treated as a resting one.
          </li>
          <li>
            Every <b>Squeek block settlement</b> on Ethereum during your run drops an <b>Imperial Treasure</b>: a free level-up, a heal
            and a shower of gems. Gold arrows on the screen edge point to it.
          </li>
          <li>
            Every new <b>ten-minute round</b> sends a <b>Herald of the Wheel</b>. Defeat it for another treasure.
          </li>
          <li>
            <b>Round Challenge</b> seeds the battlefield with the current round number, so everyone who plays in the same ten minutes
            faces the same waves.
          </li>
        </ul>
        <div className="menu-buttons">
          <button className="btn btn-primary" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
