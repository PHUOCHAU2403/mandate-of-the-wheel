// Transformations: at fixed levels the hamster's fur, crest and aura change and its stats climb.
// Each form's numbers are absolute (not stacked on the previous form).

export const FORMS = [
  { level: 1, name: 'Base', dmg: 1, atk: 1, move: 1, armor: 0, range: 1 },
  {
    level: 5, name: 'Spark Fur', short: 'Spark', aura: '#ffd98a',
    dmg: 1.1, atk: 1, move: 1, armor: 0, range: 1,
    look: { fur: '#f3b94d', furLight: '#ffe08a', furDark: '#d08a2a', crest: 1, crestColor: '#ffe28a', crestDark: '#d89a30' },
  },
  {
    level: 10, name: 'Golden Wheel', short: 'Golden', aura: '#ffd23a',
    dmg: 1.2, atk: 1.08, move: 1, armor: 0, range: 1,
    look: { fur: '#ffcf3a', furLight: '#fff3a0', furDark: '#e09a10', crest: 2, crestColor: '#fff07a', crestDark: '#e0a020', iris: '#3a8fd8' },
  },
  {
    level: 15, name: 'Crimson Fury', short: 'Crimson', aura: '#ff5a3a',
    dmg: 1.32, atk: 1.12, move: 1.08, armor: 4, range: 1,
    look: {
      fur: '#e0453a', furLight: '#ff8a6a', furDark: '#a8221c', belly: '#ffe6dc', crest: 3, crestColor: '#ff7a5a', crestDark: '#a8221c',
      iris: '#2ac8a8',
    },
  },
  {
    level: 20, name: 'Azure Ascendant', short: 'Azure', aura: '#7ad0ff',
    dmg: 1.47, atk: 1.22, move: 1.12, armor: 6, range: 1.1,
    look: {
      fur: '#6ec8ff', furLight: '#d6f2ff', furDark: '#2f86c8', belly: '#f2fbff', crest: 4, crestColor: '#c8eeff', crestDark: '#3a90d0',
      iris: '#ffd166', blush: 'rgba(255,150,200,0.55)',
    },
  },
];

export function formForLevel(level) {
  let f = 0;
  for (let i = 1; i < FORMS.length; i++) if (level >= FORMS[i].level) f = i;
  return f;
}

export function formLook(base, form) {
  const look = FORMS[form] && FORMS[form].look;
  return look ? { ...base, ...look } : base;
}
