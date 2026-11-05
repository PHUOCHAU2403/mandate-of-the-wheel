// Hamster heroes (internal ids kept from the general roster). Each breed has its own signature skill, pup squad and upgrade pool.

export const TIERS = {
  F: 0.8,
  E: 0.85,
  D: 0.9,
  C: 1.0,
  B: 1.1,
  A: 1.2,
  S: 1.35,
  SS: 1.5,
  SSS: 1.7,
};

export const TIER_ORDER = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];

export const TIER_COLORS = {
  F: '#8a8a8a',
  E: '#9fb09a',
  D: '#6fae6f',
  C: '#4aa3df',
  B: '#8e6be0',
  A: '#e07be0',
  S: '#f2c230',
  SS: '#e03a3a',
  SSS: 'rainbow',
};

// Unique upgrade helper. text(value, totalAfter, nextLevel) returns a one-line effect.
const U = (o) => ({ pool: 'unique', maxLevel: 5, flat: false, decimals: 0, ...o });

export const GENERALS = [
  {
    id: 'zhangfei',
    name: 'Bao',
    char: 'B',
    breed: 'Golden Syrian',
    title: 'Golden Syrian · Thunder Cheeks',
    troopType: 'Acorn Guards',
    tier: 'C',
    baseStats: {
      maxHp: 160,
      damage: 16,
      attackSpeed: 0.95,
      moveSpeed: 150,
      armor: 4,
      crit: 0.05,
      range: 85,
      attackType: 'melee',
    },
    signatureSkill: {
      id: 'sig_roar',
      name: 'Squeak Roar',
      icon: '📣',
      cooldown: 6,
      desc: 'Every 6s, a squeak so loud it damages, knocks back and stuns nearby predators.',
    },
    troopDesc: 'Pup guards with acorn shields circle you, block predators and bash anything that touches them.',
    uniqueUpgrades: [
      U({
        id: 'sig_roar',
        name: 'Squeak Roar',
        icon: '📣',
        flat: true,
        value: 25,
        text: (v, t, l) =>
          l >= 5
            ? `AWAKEN: +${v}% roar damage, -0.4s cooldown, double shockwave`
            : `+${v}% roar damage (total +${t}%), -0.4s cooldown`,
        apply: (m, v) => {
          m.sigDmgMult += v / 100;
          m.sigCdReduce += 0.4;
        },
      }),
      U({
        id: 'roar_radius',
        name: 'Booming Cheeks',
        icon: '📢',
        value: 25,
        text: (v, t) => `+${v} roar radius (total +${t})`,
        apply: (m, v) => {
          m.roarRadius += v;
        },
      }),
      U({
        id: 'roar_stun',
        name: 'Beady Glare',
        icon: '💫',
        value: 0.4,
        decimals: 1,
        text: (v, t) => `+${v}s roar stun (total ${(1 + t).toFixed(1)}s)`,
        apply: (m, v) => {
          m.roarStun += v;
        },
      }),
      U({
        id: 'roar_damage',
        name: 'Fluffed-Up Fury',
        icon: '💢',
        value: 40,
        text: (v, t) => `+${v}% roar damage (total +${t}%)`,
        apply: (m, v) => {
          m.roarDmgMult += v / 100;
        },
      }),
      U({
        id: 'shield_soldier',
        name: 'Acorn Wall',
        icon: '🛡️',
        flat: true,
        value: 1,
        maxLevel: 4,
        text: (v, t) => `+1 acorn guard (${2 + t} total)`,
        apply: (m, v) => {
          m.soldiers += v;
        },
      }),
      U({
        id: 'taunt',
        name: 'Rally Squeak',
        icon: '📣',
        flat: true,
        value: 1,
        text: (v, t, l) =>
          l === 1 ? 'Guards taunt predators within 120 range' : `+40 taunt range (total ${80 + 40 * l})`,
        apply: (m, v) => {
          m.taunt += v;
        },
      }),
      U({
        id: 'armor_zf',
        name: 'Thick Fur',
        icon: '🧶',
        value: 3,
        text: (v, t) => `+${v} armor (total +${t})`,
        apply: (m, v) => {
          m.armor += v;
        },
      }),
    ],
  },
  {
    id: 'zhaoyun',
    name: 'Zoom',
    char: 'Z',
    breed: 'Roborovski',
    title: 'Roborovski · Fastest Paws',
    troopType: 'Ball Rollers',
    tier: 'C',
    baseStats: {
      maxHp: 120,
      damage: 15,
      attackSpeed: 1.1,
      moveSpeed: 175,
      armor: 2,
      crit: 0.1,
      range: 80,
      attackType: 'melee',
    },
    signatureSkill: {
      id: 'sig_dash',
      name: 'Wheel Dash',
      icon: '💨',
      cooldown: 5,
      desc: 'Roll through a line of predators in a hamster ball. Invulnerable while rolling.',
    },
    troopDesc: 'Pups in hamster balls roll across the screen in a line with every dash.',
    uniqueUpgrades: [
      U({
        id: 'sig_dash',
        name: 'Wheel Dash',
        icon: '💨',
        flat: true,
        value: 25,
        text: (v, t, l) =>
          l >= 5
            ? `AWAKEN: +${v}% dash damage, -0.5s cooldown, longer dash with a wider strike`
            : `+${v}% dash damage (total +${t}%), -0.5s cooldown`,
        apply: (m, v) => {
          m.sigDmgMult += v / 100;
          m.sigCdReduce += 0.5;
        },
      }),
      U({
        id: 'dash_charge',
        name: 'Endless Zoomies',
        icon: '🌀',
        flat: true,
        value: 1,
        maxLevel: 4,
        text: (v, t) => `+1 dash charge (${1 + t} total)`,
        apply: (m, v) => {
          m.dashCharges += v;
        },
      }),
      U({
        id: 'dash_damage',
        name: 'Ball Bash',
        icon: '⚔️',
        value: 50,
        text: (v, t) => `+${v}% dash damage (total +${t}%)`,
        apply: (m, v) => {
          m.dashDmgMult += v / 100;
        },
      }),
      U({
        id: 'dash_heal',
        name: 'Snack Break',
        icon: '🥜',
        value: 3,
        text: (v, t) => `Dash heals ${v} HP per enemy hit (total ${t})`,
        apply: (m, v) => {
          m.dashHeal += v;
        },
      }),
      U({
        id: 'rider',
        name: 'Roller Pups',
        icon: '⚪',
        flat: true,
        value: 1,
        text: (v, t) => `+1 roller per dash (${2 + t} total)`,
        apply: (m, v) => {
          m.riders += v;
        },
      }),
      U({
        id: 'trample',
        name: 'Run Over',
        icon: '🐾',
        flat: true,
        value: 1,
        text: (v, t, l) =>
          l === 1 ? 'Rollers stun predators for 0.5s' : `+0.3s roll stun (total ${(0.5 + 0.3 * (l - 1)).toFixed(1)}s)`,
        apply: (m, v) => {
          m.trample += v;
        },
      }),
      U({
        id: 'speed_zy',
        name: 'Light Paws',
        icon: '👟',
        value: 8,
        text: (v, t) => `+${v}% move speed (total +${t}%)`,
        apply: (m, v) => {
          m.moveSpeedMult += v / 100;
        },
      }),
    ],
  },
  {
    id: 'huangzhong',
    name: 'Snow',
    char: 'S',
    breed: 'Winter White',
    title: 'Winter White · Seed Sniper',
    troopType: 'Seed Slingers',
    tier: 'C',
    baseStats: {
      maxHp: 130,
      damage: 13,
      attackSpeed: 1.3,
      moveSpeed: 150,
      armor: 2,
      crit: 0.15,
      range: 330,
      attackType: 'ranged',
      projectile: 'arrow',
      projectileSpeed: 560,
    },
    signatureSkill: {
      id: 'sig_rain',
      name: 'Seed Storm',
      icon: '🌻',
      cooldown: 7,
      desc: 'A storm of sunflower seeds falls on the densest pack of predators.',
    },
    troopDesc: 'Seed slingers stand around you and shoot the nearest predator.',
    uniqueUpgrades: [
      U({
        id: 'sig_rain',
        name: 'Seed Storm',
        icon: '🌻',
        flat: true,
        value: 20,
        text: (v, t, l) =>
          l >= 5
            ? `AWAKEN: +${v}% volley damage, -0.6s cooldown, 50% more seeds over a wider area`
            : `+${v}% volley damage (total +${t}%), -0.6s cooldown`,
        apply: (m, v) => {
          m.sigDmgMult += v / 100;
          m.sigCdReduce += 0.6;
        },
      }),
      U({
        id: 'arrows',
        name: 'Stuffed Cheek Pouches',
        icon: '🏹',
        flat: true,
        value: 4,
        text: (v, t) => `+${v} seeds per storm (${8 + t} total)`,
        apply: (m, v) => {
          m.arrows += v;
        },
      }),
      U({
        id: 'pierce',
        name: 'Husk Breaker',
        icon: '🗡️',
        flat: true,
        value: 1,
        text: (v, t) => `Seeds pierce +1 predator (${t} total)`,
        apply: (m, v) => {
          m.pierce += v;
        },
      }),
      U({
        id: 'fire_arrows',
        name: 'Spicy Seeds',
        icon: '🌶️',
        value: 3,
        text: (v, t) => `Seeds burn for ${v} dmg/s over 2s (total ${t}/s)`,
        apply: (m, v) => {
          m.fireArrows += v;
        },
      }),
      U({
        id: 'range_hz',
        name: 'Keen Whiskers',
        icon: '🔭',
        value: 15,
        text: (v, t) => `+${v}% attack range (total +${t}%)`,
        apply: (m, v) => {
          m.rangeMult += v / 100;
        },
      }),
      U({
        id: 'crit_hz',
        name: 'Deadly Aim',
        icon: '🎯',
        value: 8,
        text: (v, t) => `+${v}% crit chance (total +${t}%)`,
        apply: (m, v) => {
          m.crit += v / 100;
        },
      }),
      U({
        id: 'archer',
        name: 'Slinger Pup',
        icon: '🥏',
        flat: true,
        value: 1,
        text: (v, t) => `+1 slinger (${2 + t} total)`,
        apply: (m, v) => {
          m.archers += v;
        },
      }),
    ],
  },
  {
    id: 'zhugeliang',
    name: 'Ink',
    char: 'I',
    breed: 'Panda Hamster',
    title: 'Panda Hamster · Chili Strategist',
    troopType: 'Seed Crossbows',
    tier: 'C',
    baseStats: {
      maxHp: 115,
      damage: 12,
      attackSpeed: 1.2,
      moveSpeed: 155,
      armor: 1,
      crit: 0.05,
      range: 280,
      attackType: 'ranged',
      projectile: 'fan',
      projectileSpeed: 450,
    },
    signatureSkill: {
      id: 'sig_fire',
      name: 'Chili Blaze',
      icon: '🌶️',
      cooldown: 8,
      desc: 'Lines of chili-fire ground that burn predators over time.',
    },
    troopDesc: 'A seed-crossbow squad fires rapid husks at the nearest predator.',
    uniqueUpgrades: [
      U({
        id: 'sig_fire',
        name: 'Chili Blaze',
        icon: '🌶️',
        flat: true,
        value: 25,
        text: (v, t, l) =>
          l >= 5
            ? `AWAKEN: +${v}% fire damage, -0.7s cooldown, longer lines that ignite enemies`
            : `+${v}% fire damage (total +${t}%), -0.7s cooldown`,
        apply: (m, v) => {
          m.sigDmgMult += v / 100;
          m.sigCdReduce += 0.7;
        },
      }),
      U({
        id: 'burn_duration',
        name: 'Lingering Flames',
        icon: '⏳',
        value: 1,
        decimals: 1,
        text: (v, t) => `+${v}s fire duration (${(4 + t).toFixed(1)}s total)`,
        apply: (m, v) => {
          m.burnDuration += v;
        },
      }),
      U({
        id: 'fire_spread',
        name: 'Wildfire',
        icon: '🌋',
        flat: true,
        value: 1,
        text: (v, t) => `+1 fire line and +6 width (${2 + t} lines)`,
        apply: (m, v) => {
          m.fireSpread += v;
        },
      }),
      U({
        id: 'east_wind',
        name: 'Whisker Wind',
        icon: '🌬️',
        flat: true,
        value: 1,
        text: (v, t, l) =>
          l === 1 ? 'Wind pushes nearby predators into your chili fire' : `+50% wind strength (total ${100 + 50 * (l - 1)}%)`,
        apply: (m, v) => {
          m.eastWind += v;
        },
      }),
      U({
        id: 'crossbow_rate',
        name: 'Rapid Crossbow',
        icon: '🔁',
        value: 20,
        text: (v, t) => `+${v}% crossbow fire rate (total +${t}%)`,
        apply: (m, v) => {
          m.crossbowRate += v / 100;
        },
      }),
      U({
        id: 'trigrams',
        name: 'Burrow Formation',
        icon: '🏠',
        value: 10,
        text: (v, t, l) =>
          l === 1 ? `Burrow zone: -${v}% damage taken` : `-${v}% damage taken (total -${Math.min(50, t)}%)`,
        apply: (m, v) => {
          m.trigrams += v / 100;
        },
      }),
      U({
        id: 'slow_field',
        name: 'Sticky Bedding',
        icon: '🌾',
        value: 12,
        text: (v, t) => `Predators near you slowed ${v}% (total ${Math.min(60, t)}%)`,
        apply: (m, v) => {
          m.slowField += v / 100;
        },
      }),
    ],
  },
];

export function getGeneral(id) {
  return GENERALS.find((g) => g.id === id) || GENERALS[0];
}
