import { VIEW_H, VIEW_W } from './config';

/**
 * One low-resolution buffer for the whole screen, stage and board alike, scaled up
 * with hard pixel edges (doc 17.4). The board is inside the pixel grid on purpose:
 * a clean vector UI would break the world (rule 17.5 / rejected in 23).
 */
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** Integer scale factor currently in use. */
  scale = 1;
  /** Canvas bounding rect, cached for input mapping. */
  private rect: DOMRect;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
    this.rect = canvas.getBoundingClientRect();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.resize());
  }

  resize(): void {
    const availW = window.innerWidth;
      const availH = window.innerHeight;
    // Prefer whole-number scaling so pixels stay square. Fall back to fractional
    // only when the window is smaller than one full buffer.
    let s = Math.min(availW / VIEW_W, availH / VIEW_H);
    if (s >= 1) s = Math.floor(s);
    this.scale = s;
    this.canvas.style.width = `${Math.round(VIEW_W * s)}px`;
    this.canvas.style.height = `${Math.round(VIEW_H * s)}px`;
    this.rect = this.canvas.getBoundingClientRect();
  }

  /** Client coordinates to buffer coordinates. */
  toBuffer(clientX: number, clientY: number): { x: number; y: number } {
    // getBoundingClientRect on every pointer move is measurable on low-end
    // hardware, so the rect is cached and refreshed on resize only.
    return {
      x: (clientX - this.rect.left) / this.scale,
      y: (clientY - this.rect.top) / this.scale,
    };
  }

  refreshRect(): void {
    this.rect = this.canvas.getBoundingClientRect();
  }

  clear(colour: string): void {
    this.ctx.fillStyle = colour;
    this.ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  rect_(x: number, y: number, w: number, h: number, colour: string): void {
    this.ctx.fillStyle = colour;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /** One-pixel outline, snapped to the grid. */
  stroke(x: number, y: number, w: number, h: number, colour: string): void {
    const c = this.ctx;
    c.fillStyle = colour;
    const rx = Math.round(x);
    const ry = Math.round(y);
    const rw = Math.round(w);
    const rh = Math.round(h);
    c.fillRect(rx, ry, rw, 1);
    c.fillRect(rx, ry + rh - 1, rw, 1);
    c.fillRect(rx, ry, 1, rh);
    c.fillRect(rx + rw - 1, ry, 1, rh);
  }

  px(x: number, y: number, colour: string): void {
    this.ctx.fillStyle = colour;
    this.ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }

  /** Bresenham, because a 1px diagonal from canvas lineTo is a blurry mess. */
  line(x0: number, y0: number, x1: number, y1: number, colour: string): void {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const xe = Math.round(x1);
    const ye = Math.round(y1);
    const dx = Math.abs(xe - x);
    const dy = Math.abs(ye - y);
    const sx = x < xe ? 1 : -1;
    const sy = y < ye ? 1 : -1;
    let err = dx - dy;
    this.ctx.fillStyle = colour;
    for (;;) {
      this.ctx.fillRect(x, y, 1, 1);
      if (x === xe && y === ye) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  disc(cx: number, cy: number, r: number, colour: string): void {
    const c = this.ctx;
    c.fillStyle = colour;
    const ri = Math.max(1, Math.round(r));
    const x0 = Math.round(cx);
    const y0 = Math.round(cy);
    for (let dy = -ri; dy <= ri; dy++) {
      const span = Math.floor(Math.sqrt(ri * ri - dy * dy) + 0.35);
      if (span < 0) continue;
      c.fillRect(x0 - span, y0 + dy, span * 2 + 1, 1);
    }
  }

  ring(cx: number, cy: number, r: number, colour: string): void {
    const c = this.ctx;
    c.fillStyle = colour;
    const steps = Math.max(10, Math.round(r * 7));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      c.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
    }
  }

  /** Filled polygon. Points are flat [x,y,x,y,...]. */
  poly(points: number[], colour: string): void {
    const c = this.ctx;
    c.fillStyle = colour;
    c.beginPath();
    c.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
    c.closePath();
    c.fill();
  }

  /** Alpha-blended rect. Used sparingly: dimmers, shadows, grace flashes. */
  veil(x: number, y: number, w: number, h: number, colour: string, alpha: number): void {
    const c = this.ctx;
    const prev = c.globalAlpha;
    c.globalAlpha = alpha;
    c.fillStyle = colour;
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    c.globalAlpha = prev;
  }

  save(): void {
    this.ctx.save();
  }

  restore(): void {
    this.ctx.restore();
  }

  clip(x: number, y: number, w: number, h: number): void {
    const c = this.ctx;
    c.beginPath();
    c.rect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    c.clip();
  }
}
