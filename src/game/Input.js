// Keyboard (WASD / arrows) and dynamic touch joystick.

const KEY_CODES = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.joy = { active: false, id: null, cx: 0, cy: 0, dx: 0, dy: 0, radius: 60 };
    this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    this.onKeyDown = (e) => {
      this.keys.add(e.code);
      if (KEY_CODES.includes(e.code)) e.preventDefault();
    };
    this.onKeyUp = (e) => this.keys.delete(e.code);
    this.onBlur = () => this.keys.clear();

    this.onTouchStart = (e) => {
      for (const t of e.changedTouches) {
        if (!this.joy.active) {
          this.joy.active = true;
          this.joy.id = t.identifier;
          this.joy.cx = t.clientX;
          this.joy.cy = t.clientY;
          this.joy.dx = 0;
          this.joy.dy = 0;
        }
      }
      e.preventDefault();
    };
    this.onTouchMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this.joy.id) continue;
        let dx = t.clientX - this.joy.cx;
        let dy = t.clientY - this.joy.cy;
        const d = Math.hypot(dx, dy);
        const R = this.joy.radius;
        if (d > R) {
          dx = (dx / d) * R;
          dy = (dy / d) * R;
        }
        this.joy.dx = dx / R;
        this.joy.dy = dy / R;
      }
      e.preventDefault();
    };
    this.onTouchEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) {
          this.joy.active = false;
          this.joy.id = null;
          this.joy.dx = 0;
          this.joy.dy = 0;
        }
      }
      e.preventDefault();
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', this.onTouchEnd, { passive: false });
  }

  getAxis() {
    let x = 0;
    let y = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (x || y) {
      const d = Math.hypot(x, y);
      return { x: x / d, y: y / d };
    }
    if (this.joy.active) {
      const d = Math.hypot(this.joy.dx, this.joy.dy);
      if (d < 0.12) return { x: 0, y: 0 };
      const mag = Math.min(1, d / 0.7);
      return { x: (this.joy.dx / d) * mag, y: (this.joy.dy / d) * mag };
    }
    return { x: 0, y: 0 };
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
    this.canvas.removeEventListener('touchcancel', this.onTouchEnd);
  }
}
