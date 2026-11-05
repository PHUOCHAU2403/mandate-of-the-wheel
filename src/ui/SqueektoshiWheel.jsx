import { useEffect, useRef } from 'react';
import { drawWheelScene, newWheelState, stepWheel } from '../squeek/wheelArt';

// Squeektoshi in the WHEELY9000, animated from the live reading. The loop keeps its own state in a
// ref so new readings never restart the wheel; it just eases to the new speed.
export default function SqueektoshiWheel({ mode, rpm, width = 132, height = 124 }) {
  const ref = useRef(null);
  const input = useRef({ mode, rpm });
  input.current = { mode, rpm };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const g = canvas.getContext('2d');
    const st = newWheelState();
    let raf = 0;
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      stepWheel(st, dt, input.current.mode, input.current.rpm);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawWheelScene(g, width, height, st);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [width, height]);

  const label = mode === 'running'
    ? `Squeektoshi running in the WHEELY9000${rpm ? ` at ${Math.round(rpm)} rpm` : ''}`
    : mode === 'resting' ? 'Squeektoshi asleep beside the WHEELY9000' : 'No live reading from the WHEELY9000';
  return <canvas ref={ref} className="squeektoshi-wheel" role="img" aria-label={label} style={{ width, height }} />;
}
