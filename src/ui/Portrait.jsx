import { useEffect, useRef } from 'react';
import { drawHamsterPortrait, HAMSTER_ART } from '../game/animalArt';
import { formLook } from '../game/forms';

// Head-and-shoulders portrait of a hamster, drawn with the same procedural art as the in-game sprite.
// `form` shows a transformation (0 = base).
export default function Portrait({ generalId, size = 60, form = 0 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size, size);
    const spec = formLook(HAMSTER_ART[generalId] || HAMSTER_ART.zhangfei, form);
    g.save();
    g.translate(size / 2, size / 2);
    drawHamsterPortrait(g, spec, size * 0.4);
    g.restore();
  }, [generalId, size, form]);

  return <canvas ref={ref} style={{ width: size, height: size, display: 'block' }} />;
}
