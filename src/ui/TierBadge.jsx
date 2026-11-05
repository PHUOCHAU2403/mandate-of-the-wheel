import { TIER_COLORS } from '../game/generals';

export default function TierBadge({ tier, size = 'md' }) {
  const color = TIER_COLORS[tier] || '#888';
  const rainbow = color === 'rainbow';
  return (
    <span
      className={`tier-badge tier-${size} ${rainbow ? 'tier-rainbow' : ''}`}
      style={rainbow ? undefined : { background: color, color: tier === 'S' ? '#2a1d00' : '#fff' }}
    >
      {tier}
    </span>
  );
}
