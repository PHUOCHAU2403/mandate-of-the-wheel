// Predator archetypes (internal ids kept from the original roster) and per-wave scaling.

export const ENEMY_TYPES = {
  peasant: {
    name: 'Stray Kitten',
    hp: 12,
    speed: 100,
    dmg: 6,
    r: 12,
    xp: 1,
    color: '#e0b24a',
  },
  spearman: {
    name: 'Rat Snake',
    hp: 45,
    speed: 58,
    dmg: 14,
    r: 16,
    xp: 3,
    color: '#c9922e',
  },
  archer: {
    name: 'Barn Owl',
    hp: 20,
    speed: 75,
    dmg: 9,
    r: 12,
    xp: 3,
    color: '#d8c060',
    keepMin: 190,
    keepMax: 260,
    shootCd: 2.4,
  },
  sorcerer: {
    name: 'Alley Cat Matriarch',
    hp: 70,
    speed: 50,
    dmg: 8,
    r: 15,
    xp: 8,
    color: '#b57cff',
    keepMin: 230,
    keepMax: 300,
    summonCd: 5,
  },
  // Squeekchain: rides in whenever a new ten-minute round begins; drops an Imperial Treasure.
  herald: {
    name: 'Herald of the Wheel',
    hp: 380,
    speed: 82,
    dmg: 16,
    r: 17,
    xp: 30,
    color: '#ffd166',
    elite: true,
  },
  zhangbao: {
    name: 'Warlord Tabby',
    hp: 1400,
    speed: 72,
    dmg: 28,
    r: 32,
    xp: 60,
    color: '#ff6a3a',
    boss: true,
  },
  zhangjiao: {
    name: 'Storm Owl, Queen of the Night',
    hp: 3800,
    speed: 55,
    dmg: 20,
    r: 36,
    xp: 150,
    color: '#8ec5ff',
    boss: true,
  },
};

export function waveConfig(w) {
  const boss = w === 5 ? 'zhangbao' : w === 10 ? 'zhangjiao' : null;
  return {
    boss,
    rate: (1.1 + w * 0.85) * (boss ? 0.55 : 1),
    cap: Math.min(300, 30 + w * 27),
    hpMult: 1 + (w - 1) * 0.28,
    speedMult: 1 + (w - 1) * 0.035,
    dmgMult: 1 + (w - 1) * 0.1,
    xpMult: 1 + (w - 1) * 0.15,
    weights: {
      peasant: 10,
      spearman: w >= 2 ? 2 + w * 0.5 : 0,
      archer: w >= 3 ? 1.5 + w * 0.3 : 0,
      sorcerer: w >= 4 ? 0.6 + w * 0.15 : 0,
    },
  };
}
