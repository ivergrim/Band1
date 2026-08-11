/**
 * The art pipeline's game-side half (doc 17.2, steps 3-5).
 *
 * Every drawing on screen is an SVG file on disk. Characters and gear are rigs:
 * a manifest listing named parts, each with its origin at its natural joint pivot,
 * optionally parented to another part. Animation is transforms on those parts and
 * nothing else (doc 17.3) — no part ever has a second drawing.
 *
 * That is the swap boundary. Replace `parts/head.svg` with a photographed,
 * vectorised hand drawing of the same part at the same pivot and every animation
 * in the game keeps working, untouched.
 *
 * Colour tokens: any part may use %BASE%, %LIGHT%, %DARK% and %INK%. They are
 * substituted at rasterise time from the owning channel's colour, which is what
 * makes one asset family serve every channel (doc 6.4.5, 17.3b).
 */

export type PartPalette = { base: string; light: string; dark: string; ink: string };

export type PartDef = {
  name: string;
  src: string;
  /** Joint pivot in part-local pixels. Rotation happens about this point. */
  pivot: [number, number];
  /** Where this part's pivot sits, in parent space (or rig space if unparented). */
  at: [number, number];
  parent?: string;
  z: number;
  /** Optional resting rotation in degrees, so the drawn pose can be off-balance. */
  rest?: number;
};

export type RigDef = {
  id: string;
  /** Rig-local pixel size, for reference and for centring. */
  size: [number, number];
  parts: PartDef[];
};

type Sprite = { canvas: HTMLCanvasElement; w: number; h: number };

export type Rig = {
  def: RigDef;
  /** Parts in draw order. */
  order: PartDef[];
  sprites: Map<string, Sprite>;
};

const svgTextCache = new Map<string, Promise<string>>();
const spriteCache = new Map<string, Sprite>();
const rigCache = new Map<string, Promise<Rig>>();

const ASSET_ROOT = 'assets/art/';

function url(path: string): string {
  return `${ASSET_ROOT}${path}`;
}

async function svgText(path: string): Promise<string> {
  let p = svgTextCache.get(path);
  if (!p) {
    p = fetch(url(path)).then((r) => {
      if (!r.ok) throw new Error(`missing art: ${path}`);
      return r.text();
    });
    svgTextCache.set(path, p);
  }
  return p;
}

function paletteKey(pal: PartPalette | undefined): string {
  return pal ? `${pal.base}${pal.light}${pal.dark}${pal.ink}` : 'raw';
}

function substitute(text: string, pal: PartPalette | undefined): string {
  if (!pal) return text;
  return text
    .replace(/%BASE%/g, pal.base)
    .replace(/%LIGHT%/g, pal.light)
    .replace(/%DARK%/g, pal.dark)
    .replace(/%INK%/g, pal.ink);
}

function intrinsicSize(text: string): [number, number] {
  const vb = /viewBox\s*=\s*"([-\d.\s]+)"/.exec(text);
  if (vb) {
    const nums = vb[1].trim().split(/\s+/).map(Number);
    if (nums.length === 4 && nums[2] > 0 && nums[3] > 0) return [nums[2], nums[3]];
  }
  const w = /\bwidth\s*=\s*"(\d+(?:\.\d+)?)"/.exec(text);
  const h = /\bheight\s*=\s*"(\d+(?:\.\d+)?)"/.exec(text);
  return [w ? Number(w[1]) : 16, h ? Number(h[1]) : 16];
}

function decodeSvg(text: string, w: number, h: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.width = w;
    img.height = h;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('svg decode failed'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
  });
}

/**
 * Rasterise an SVG once, at buffer resolution, into an offscreen canvas.
 * Every subsequent draw is a bitmap blit with a transform, which is what keeps a
 * stage full of animated parts affordable.
 */
export async function sprite(path: string, pal?: PartPalette): Promise<Sprite> {
  const key = `${path}|${paletteKey(pal)}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const raw = await svgText(path);
  const text = substitute(raw, pal);
  const [w, h] = intrinsicSize(text);
  const img = await decodeSvg(text, w, h);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w));
  canvas.height = Math.max(1, Math.ceil(h));
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const s: Sprite = { canvas, w: canvas.width, h: canvas.height };
  spriteCache.set(key, s);
  return s;
}

export async function loadRig(id: string, pal?: PartPalette): Promise<Rig> {
  const key = `${id}|${paletteKey(pal)}`;
  let p = rigCache.get(key);
  if (!p) {
    p = (async () => {
      const res = await fetch(url(`${id}/rig.json`));
      if (!res.ok) throw new Error(`missing rig: ${id}`);
      const def = (await res.json()) as RigDef;
      const sprites = new Map<string, Sprite>();
      await Promise.all(
        def.parts.map(async (part) => {
          sprites.set(part.name, await sprite(`${id}/${part.src}`, pal));
        }),
      );
      const order = [...def.parts].sort((a, b) => a.z - b.z);
      return { def, order, sprites };
    })();
    rigCache.set(key, p);
  }
  return p;
}

/** Per-part transform applied on top of the resting pose. */
export type PartPose = {
  /** Degrees, about the part's pivot. */
  rot?: number;
  tx?: number;
  ty?: number;
  sx?: number;
  sy?: number;
  hidden?: boolean;
  alpha?: number;
};

export type Pose = Record<string, PartPose>;

const EMPTY: PartPose = {};

/**
 * Draw a rig at (x, y) in buffer pixels. `pose` transforms are relative to the
 * part's resting rotation, and parented parts inherit their parent's transform,
 * so rotating the torso carries the arms with it.
 */
export function drawRig(
  ctx: CanvasRenderingContext2D,
  rig: Rig,
  x: number,
  y: number,
  pose: Pose = {},
  flip = false,
): void {
  const byName = new Map<string, PartDef>();
  for (const p of rig.def.parts) byName.set(p.name, p);

  const applyChain = (part: PartDef): void => {
    const parent = part.parent ? byName.get(part.parent) : undefined;
    if (parent) applyChain(parent);
    const ps = pose[part.name] ?? EMPTY;
    ctx.translate(part.at[0] + (ps.tx ?? 0), part.at[1] + (ps.ty ?? 0));
    const rot = (part.rest ?? 0) + (ps.rot ?? 0);
    if (rot) ctx.rotate((rot * Math.PI) / 180);
    if (ps.sx !== undefined || ps.sy !== undefined) ctx.scale(ps.sx ?? 1, ps.sy ?? 1);
  };

  for (const part of rig.order) {
    const ps = pose[part.name] ?? EMPTY;
    if (ps.hidden) continue;
    const spr = rig.sprites.get(part.name);
    if (!spr) continue;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (flip) ctx.scale(-1, 1);
    applyChain(part);
    if (ps.alpha !== undefined) ctx.globalAlpha = ps.alpha;
    ctx.drawImage(spr.canvas, -part.pivot[0], -part.pivot[1]);
    ctx.restore();
  }
}

/** Draw a standalone sprite that is already loaded, with an optional rotation. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  spr: Sprite,
  x: number,
  y: number,
  opts: { rot?: number; pivot?: [number, number]; flip?: boolean; alpha?: number; scale?: number } = {},
): void {
  const pivot = opts.pivot ?? [0, 0];
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (opts.rot) ctx.rotate((opts.rot * Math.PI) / 180);
  if (opts.flip) ctx.scale(-1, 1);
  if (opts.scale && opts.scale !== 1) ctx.scale(opts.scale, opts.scale);
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  ctx.drawImage(spr.canvas, -pivot[0], -pivot[1]);
  ctx.restore();
}

export type { Sprite };
