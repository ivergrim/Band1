import type { Renderer } from './renderer';

export type Pointer = {
  x: number;
  y: number;
  /** Movement since the previous frame, in buffer pixels. */
  dx: number;
  dy: number;
  down: boolean;
  pressed: boolean;
  released: boolean;
  /** Where this press began. Used by faders so a drag never jumps. */
  downX: number;
  downY: number;
  /** Total path length of the current press, for wipe gestures (doc 9.1). */
  travel: number;
};

/**
 * Pointer and keyboard. Mouse first (doc 20), but everything goes through
 * PointerEvents so touch works without a second code path.
 */
export class Input {
  readonly p: Pointer = {
    x: -99,
    y: -99,
    dx: 0,
    dy: 0,
    down: false,
    pressed: false,
    released: false,
    downX: -99,
    downY: -99,
    travel: 0,
  };

  private keysDown = new Set<string>();
  private keysPressed = new Set<string>();
  private pendingDown = false;
  private pendingUp = false;
  private nextX = -99;
  private nextY = -99;
  private activeId: number | null = null;

  constructor(private renderer: Renderer) {
    const el = renderer.canvas;
    el.addEventListener('pointerdown', (e) => {
      if (this.activeId !== null) return;
      this.activeId = e.pointerId;
      el.setPointerCapture(e.pointerId);
      const b = renderer.toBuffer(e.clientX, e.clientY);
      this.nextX = b.x;
      this.nextY = b.y;
      this.pendingDown = true;
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (this.activeId !== null && e.pointerId !== this.activeId) return;
      const b = renderer.toBuffer(e.clientX, e.clientY);
      this.nextX = b.x;
      this.nextY = b.y;
    });
    const up = (e: PointerEvent) => {
      if (this.activeId !== null && e.pointerId !== this.activeId) return;
      this.activeId = null;
      this.pendingUp = true;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (!this.keysDown.has(e.code)) this.keysPressed.add(e.code);
      this.keysDown.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keysDown.delete(e.code));
    window.addEventListener('blur', () => {
      this.keysDown.clear();
      this.activeId = null;
      this.pendingUp = true;
    });
    window.addEventListener('scroll', () => renderer.refreshRect(), true);
  }

  /** Call once per frame, before update. */
  beginFrame(): void {
    const p = this.p;
    const prevX = p.x;
    const prevY = p.y;
    p.x = this.nextX;
    p.y = this.nextY;
    p.dx = p.x - prevX;
    p.dy = p.y - prevY;
    p.pressed = false;
    p.released = false;

    if (this.pendingDown) {
      p.down = true;
      p.pressed = true;
      p.downX = p.x;
      p.downY = p.y;
      p.travel = 0;
      p.dx = 0;
      p.dy = 0;
      this.pendingDown = false;
    } else if (p.down) {
      p.travel += Math.hypot(p.dx, p.dy);
    }

    if (this.pendingUp) {
      // Release is reported on the frame after the press is consumed, so a
      // tap that lands and lifts inside one frame still registers as both.
      if (p.pressed) return;
      p.down = false;
      p.released = true;
      this.pendingUp = false;
    }
  }

  endFrame(): void {
    this.keysPressed.clear();
  }

  key(code: string): boolean {
    return this.keysDown.has(code);
  }

  keyPressed(code: string): boolean {
    return this.keysPressed.has(code);
  }

  inRect(x: number, y: number, w: number, h: number): boolean {
    return this.p.x >= x && this.p.x < x + w && this.p.y >= y && this.p.y < y + h;
  }

  pointInRect(px: number, py: number, x: number, y: number, w: number, h: number): boolean {
    return px >= x && px < x + w && py >= y && py < y + h;
  }

  /** Did this press begin inside the rect? Keeps a drag owned by its control. */
  pressBeganIn(x: number, y: number, w: number, h: number): boolean {
    return this.pointInRect(this.p.downX, this.p.downY, x, y, w, h);
  }

  get renderScale(): number {
    return this.renderer.scale;
  }
}
