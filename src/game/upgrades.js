// Shared upgrade pool, rarity tables and the level-up card generator.

export const RARITIES = {
  common: { label: 'Common', mult: 1, color: '#b9c2b4' },
  rare: { label: 'Rare', mult: 1.5, color: '#4aa3ff' },
  epic: { label: 'Epic', mult: 2, color: '#c45cff' },
};

const S = (o) => ({ pool: 'shared', maxLevel: 5, flat: false, decimals: 0, ...o });

export const SHARED_UPGRADES = [
  S({
    id: 'max_hp',
    name: 'Hardy Constitution',
    icon: '❤️',
    value: 20,
    text: (v, t) => `+${v} max HP (total +${t})`,
    apply: (m, v) => {
      m.maxHp += v;
    },
  }),
  S({
    id: 'armor',
    name: 'Fluffy Coat',
    icon: '🦺',
    value: 2,
    text: (v, t) => `+${v} armor (total +${t})`,
    apply: (m, v) => {
      m.armor += v;
    },
  }),
  S({
    id: 'damage',
    name: 'Sharp Incisors',
    icon: '🦷',
    value: 12,
    text: (v, t) => `+${v}% damage (total +${t}%)`,
    apply: (m, v) => {
      m.damageMult += v / 100;
    },
  }),
  S({
    id: 'attack_speed',
    name: 'Quick Paws',
    icon: '⚡',
    value: 12,
    text: (v, t) => `+${v}% attack speed (total +${t}%)`,
    apply: (m, v) => {
      m.attackSpeedMult += v / 100;
    },
  }),
  S({
    id: 'move_speed',
    name: 'Springy Feet',
    icon: '👢',
    value: 8,
    text: (v, t) => `+${v}% move speed (total +${t}%)`,
    apply: (m, v) => {
      m.moveSpeedMult += v / 100;
    },
  }),
  S({
    id: 'crit',
    name: 'Keen Nose',
    icon: '🎯',
    value: 6,
    text: (v, t) => `+${v}% crit chance (total +${t}%)`,
    apply: (m, v) => {
      m.crit += v / 100;
    },
  }),
  S({
    id: 'lifesteal',
    name: 'Snack Steal',
    icon: '🍪',
    value: 3,
    text: (v, t) => `+${v}% lifesteal (total +${t}%)`,
    apply: (m, v) => {
      m.lifesteal += v / 100;
    },
  }),
  S({
    id: 'pickup',
    name: 'Pouch Magnet',
    icon: '🧲',
    value: 30,
    text: (v, t) => `+${v} pickup range (total +${t})`,
    apply: (m, v) => {
      m.pickupRange += v;
    },
  }),
  S({
    id: 'regen',
    name: 'Dandelion Tea',
    icon: '💚',
    value: 0.8,
    decimals: 1,
    text: (v, t) => `+${v} HP/s regen (total ${t}/s)`,
    apply: (m, v) => {
      m.regen += v;
    },
  }),
];

// Fallback card offered when every pool is maxed out.
export const RATIONS = {
  id: 'rations',
  name: 'Seed Stash',
  icon: '🌰',
  pool: 'shared',
  maxLevel: Infinity,
  flat: false,
  decimals: 0,
  value: 40,
  text: (v) => `Heal ${v} HP immediately`,
  apply: () => {},
};

export function findUpgrade(general, id) {
  return general.uniqueUpgrades.find((u) => u.id === id) || SHARED_UPGRADES.find((u) => u.id === id) || (id === 'rations' ? RATIONS : null);
}

function roundTo(v, d) {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}

export function rollRarity(rng) {
  const r = rng.next() * 100;
  if (r < 10) return 'epic';
  if (r < 40) return 'rare';
  return 'common';
}

// Draw 3 cards. At least one comes from the general's unique pool while any remain.
export function generateCards(rng, general, levels, totals) {
  const lvl = (id) => levels[id] || 0;
  const uniq = general.uniqueUpgrades.filter((u) => lvl(u.id) < u.maxLevel);
  const shared = SHARED_UPGRADES.filter((u) => lvl(u.id) < u.maxLevel);
  const picked = [];
  if (uniq.length) picked.push(rng.pick(uniq));
  let pool = [...uniq, ...shared].filter((u) => !picked.includes(u));
  while (picked.length < 3 && pool.length) {
    const u = rng.pick(pool);
    picked.push(u);
    pool = pool.filter((x) => x !== u);
  }
  while (picked.length < 3) picked.push(RATIONS);
  rng.shuffle(picked);

  return picked.map((def, i) => {
    const rarity = def.flat ? 'common' : rollRarity(rng);
    const value = roundTo(def.value * RARITIES[rarity].mult, def.decimals || 0);
    const level = lvl(def.id);
    const total = roundTo((totals[def.id] || 0) + value, def.decimals || 0);
    return {
      key: `${def.id}-${i}`,
      def,
      id: def.id,
      name: def.name,
      icon: def.icon,
      rarity,
      value,
      level,
      nextLevel: level + 1,
      maxLevel: def.maxLevel,
      unique: def.pool === 'unique',
      text: def.text(value, total, level + 1),
    };
  });
}
