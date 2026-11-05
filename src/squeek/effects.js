// What Squeektoshi's wheel does to the battle. Both of his states help: running is offence,
// resting is defence. Nothing here rewards waking him or punishes a nap (Squeekchain care policy).

export const WHEEL_RPM_FULL = 80;   // rpm at which the Mandate is at full strength

export function wheelEffects(mode, rpm = 0, baseArmor = 0) {
  if (mode === 'running') {
    const k = Math.min(1, Math.max(0.3, (rpm || 0) / WHEEL_RPM_FULL));
    return {
      mode, k,
      atk: 1 + 0.35 * k,
      move: 1 + 0.18 * k,
      armor: 0,
      regenPct: 0,
      xp: 1,
      title: 'Mandate of the Wheel',
      lines: [`+${Math.round(35 * k)}% attack speed`, `+${Math.round(18 * k)}% move speed`],
    };
  }
  if (mode === 'resting') {
    const armor = Math.round(4 + baseArmor * 0.25);
    return {
      mode, k: 1,
      atk: 1,
      move: 1,
      armor,
      regenPct: 0.006,
      xp: 1.25,
      title: 'Night Watch',
      lines: [`+${armor} armor`, '+0.6% HP per second', '+25% experience'],
    };
  }
  return { mode: 'unknown', k: 0, atk: 1, move: 1, armor: 0, regenPct: 0, xp: 1, title: 'Fog of War', lines: ['No live reading: no bonus'] };
}
