import { drawSprite, sprite, type Sprite } from '../../core/assets';
import { ENERGY_PASS, FADER_NEUTRAL, NEUTRAL_WIDTH, VIEW_H, VIEW_W } from '../../core/config';
import { drawText, textWidth } from '../../core/font';
import type { Input } from '../../core/input';
import { UI } from '../../core/palette';
import { hash01 } from '../../core/rng';
import type { Renderer } from '../../core/renderer';
import { MEMBERS, type MemberId } from '../content/cast';
import { GIG } from '../content/copy';
import type { Venue } from '../content/venues';
import type { Director } from './director';
import type { Mixer } from './mixer';

/**
 * The board.
 *
 * Doc 17.5: hand-drawn, not clean vector UI, because a precise modern interface
 * would break the world. Ruled straight lines for fader tracks and strip borders so
 * it reads as a functional object, freehand for knobs and buttons, hand-lettered
 * channel names. Touch targets are larger than the visual, so the imprecision costs
 * nothing.
 *
 * Doc 5.2: controls that have not arrived yet are not greyed out, they are
 * physically not there -- a hole with a scrawled note taped over it. Venue 1's strip
 * has one fader and two holes, and that is the honest state of the equipment.
 *
 * What the board deliberately does NOT show: where a control is *supposed* to be
 * during an event. The neutral mark is printed on the track because a real console
 * has a unity mark and neutral is a physical property of the desk. A demanded range
 * would be a legend, and doc 2.4 is explicit that the cue names the fix.
 */

const FADER_BOTTOM = 258;
const STRIP_W = 54;
const GAP = 3;

export type StripLayout = {
  id: MemberId;
  x: number;
  labelY: number;
  knob: { cx: number; cy: number };
  fx: { x: number; y: number; w: number; h: number };
  fader: { x: number; y: number; w: number; h: number };
};

export type BoardLayout = {
  y0: number;
  meter: { x: number; y: number; w: number; h: number };
  strips: StripLayout[];
  master: { x: number; fader: { x: number; y: number; w: number; h: number }; labelY: number };
  rack: { x: number; y: number } | null;
  sticky: { x: number; y: number };
  bag: { x: number; y: number; w: number; h: number }[];
};

export function boardLayout(venue: Venue, bagSize: number): BoardLayout {
  const y0 = venue.layout.height;
  const faderTop = y0 + 76;
  const strips: StripLayout[] = venue.band.map((id, i) => {
    const x = 10 + i * (STRIP_W + GAP);
    return {
      id,
      x,
      labelY: y0 + 20,
      knob: { cx: x + STRIP_W / 2, cy: y0 + 42 },
      fx: { x: x + STRIP_W / 2 - 7, y: y0 + 56, w: 14, h: 17 },
      fader: { x: x + STRIP_W / 2 - 4, y: faderTop, w: 8, h: FADER_BOTTOM - faderTop },
    };
  });
  // The master strip sits immediately right of the channels rather than at a fixed
  // position, so a one-channel garage desk does not have a hole in the middle of it.
  const masterX = 10 + venue.band.length * (STRIP_W + GAP) + 22;
  return {
    y0,
    meter: { x: 10, y: y0 + 4, w: 460, h: 11 },
    strips,
    master: {
      x: masterX,
      labelY: y0 + 20,
      fader: { x: masterX + STRIP_W / 2 - 4, y: faderTop, w: 8, h: FADER_BOTTOM - faderTop },
    },
    rack: venue.controls.includes('fx') ? { x: masterX + 70, y: y0 + 30 } : null,
    sticky: { x: 340, y: y0 + 54 },
    bag: Array.from({ length: bagSize }, (_, i) => ({
      x: masterX + 68 + i * 24,
      y: 236,
      w: 20,
      h: 22,
    })),
  };
}

type Grab =
  | { kind: 'fader'; id: MemberId; offset: number }
  | { kind: 'master'; offset: number }
  | { kind: 'knob'; id: MemberId; startValue: number; startY: number }
  | { kind: 'wipe' }
  | null;

export class Board {
  private sprites!: {
    cap: Sprite;
    knob: Sprite;
    toggleUp: Sprite;
    toggleDown: Sprite;
    screw: Sprite;
    tape: Sprite;
    sticky: Sprite;
    rack: Sprite;
    lampOn: Sprite;
    lampOff: Sprite;
    beer: Sprite;
    cloth: Sprite;
  };
  private grab: Grab = null;
  /** Remembered so the neutral detent only clicks on the frame it is crossed. */
  private wasNeutral = new Map<string, boolean>();
  layout!: BoardLayout;

  async load(venue: Venue, bagSize: number): Promise<void> {
    this.layout = boardLayout(venue, bagSize);
    const pal = { base: '#7d7460', light: '#b3a893', dark: '#3d372e', ink: '#1b1712' };
    this.sprites = {
      cap: await sprite('board/fader-cap.svg', pal),
      knob: await sprite('board/knob.svg', pal),
      toggleUp: await sprite('board/toggle-up.svg', pal),
      toggleDown: await sprite('board/toggle-down.svg', pal),
      screw: await sprite('board/screw.svg', pal),
      tape: await sprite('board/tape-note.svg', pal),
      sticky: await sprite('board/sticky.svg', pal),
      rack: await sprite('gear/rack.svg', pal),
      lampOn: await sprite('gear/lamp-on.svg', pal),
      lampOff: await sprite('gear/lamp-off.svg', pal),
      beer: await sprite('gear/beer.svg', pal),
      cloth: await sprite('board/cloth.svg', pal),
    };
  }

  // ------------------------------------------------------------------ interaction

  /** Returns true if the pointer did something, so the caller can play a click. */
  handleInput(
    input: Input,
    mixer: Mixer,
    director: Director,
    venue: Venue,
    onDetent: () => void,
    onToggle: (on: boolean) => void,
    onGrab: () => void,
    onWipe: () => void,
    useConsumable: (index: number) => void,
  ): void {
    const L = this.layout;
    const p = input.p;

    if (p.pressed) {
      this.grab = null;
      // Doc 9.4: the obstruction really obstructs. A spill over a fader has to be
      // dealt with before that fader can be used, which is the entire point of the
      // category existing.
      if (director.spill && this.pointInSpill(director, p.x, p.y)) {
        this.grab = { kind: 'wipe' };
        onWipe();
        return;
      }
      for (const s of L.strips) {
        if (!this.blocked(director, s.fader.x - 8, s.fader.y - 8, s.fader.w + 16, s.fader.h + 16)) {
          if (input.pointInRect(p.x, p.y, s.fader.x - 9, s.fader.y - 8, s.fader.w + 18, s.fader.h + 16)) {
            const v = mixer.get(s.id).volume;
            const capY = s.fader.y + (1 - v) * s.fader.h;
            this.grab = { kind: 'fader', id: s.id, offset: p.y - capY };
            onGrab();
            return;
          }
        }
        if (venue.controls.includes('tone')) {
          if (input.pointInRect(p.x, p.y, s.knob.cx - 12, s.knob.cy - 12, 24, 24)) {
            if (this.blocked(director, s.knob.cx - 9, s.knob.cy - 9, 18, 18)) continue;
            this.grab = { kind: 'knob', id: s.id, startValue: mixer.get(s.id).tone, startY: p.y };
            onGrab();
            return;
          }
        }
        if (venue.controls.includes('fx')) {
          if (input.pointInRect(p.x, p.y, s.fx.x - 5, s.fx.y - 4, s.fx.w + 10, s.fx.h + 8)) {
            if (this.blocked(director, s.fx.x, s.fx.y, s.fx.w, s.fx.h)) continue;
            const next = !mixer.get(s.id).fx;
            mixer.set(s.id, 'fx', next);
            onToggle(next);
            return;
          }
        }
      }
      if (
        input.pointInRect(p.x, p.y, L.master.fader.x - 9, L.master.fader.y - 8, L.master.fader.w + 18, L.master.fader.h + 16)
      ) {
        const capY = L.master.fader.y + (1 - mixer.master) * L.master.fader.h;
        this.grab = { kind: 'master', offset: p.y - capY };
        onGrab();
        return;
      }
      for (let i = 0; i < L.bag.length; i++) {
        const b = L.bag[i];
        if (input.pointInRect(p.x, p.y, b.x - 2, b.y - 2, b.w + 4, b.h + 4)) {
          useConsumable(i);
          return;
        }
      }
    }

    if (!p.down) {
      this.grab = null;
      return;
    }

    const g = this.grab;
    if (!g) return;
    if (g.kind === 'wipe') {
      // Wiping is measured in path length, so a scrub across it clears it and a
      // single click does not. Doc 9.4.3: the affordance has to be obvious, and
      // "rub it" is the most obvious gesture there is.
      const moved = Math.hypot(p.dx, p.dy);
      if (moved > 0.4 && this.pointInSpill(director, p.x, p.y)) {
        director.wipe(moved * 0.018);
        if (Math.random() < 0.25) onWipe();
      }
      return;
    }
    if (g.kind === 'fader' || g.kind === 'master') {
      const f = g.kind === 'master' ? L.master.fader : L.strips.find((s) => s.id === g.id)!.fader;
      const v = 1 - (p.y - g.offset - f.y) / f.h;
      const clamped = Math.max(0, Math.min(1, v));
      if (g.kind === 'master') mixer.setMaster(clamped);
      else mixer.set(g.id, 'volume', clamped);
      this.checkDetent(g.kind === 'master' ? 'master' : `${g.id}:volume`, clamped, FADER_NEUTRAL, NEUTRAL_WIDTH.volume, onDetent);
      return;
    }
    if (g.kind === 'knob') {
      // Vertical drag rather than rotation. A knob you have to circle with a mouse is
      // worse than a knob you drag, and doc 19.3 already flags knobs as the worst
      // touch control there is without adding a gesture nobody guesses.
      const delta = (g.startY - p.y) / 52;
      const v = Math.max(-1, Math.min(1, g.startValue + delta));
      mixer.set(g.id, 'tone', v);
      this.checkDetent(`${g.id}:tone`, v, 0, NEUTRAL_WIDTH.tone, onDetent);
    }
  }

  private checkDetent(
    key: string,
    value: number,
    centre: number,
    halfWidth: number,
    onDetent: () => void,
  ): void {
    const inside = Math.abs(value - centre) <= halfWidth;
    if (inside && this.wasNeutral.get(key) === false) onDetent();
    this.wasNeutral.set(key, inside);
  }

  private pointInSpill(d: Director, x: number, y: number): boolean {
    const s = d.spill;
    if (!s) return false;
    return x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h;
  }

  private blocked(d: Director, x: number, y: number, w: number, h: number): boolean {
    return d.spillCovers(x, y, w, h);
  }

  // -------------------------------------------------------------------- rendering

  draw(r: Renderer, mixer: Mixer, director: Director, venue: Venue, bag: string[]): void {
    const L = this.layout;
    const ctx = r.ctx;

    // Chassis. Wobbly top edge so it reads as drawn rather than as a rectangle.
    r.rect_(0, L.y0, VIEW_W, VIEW_H - L.y0, UI.deskFace);
    r.rect_(0, L.y0 + 2, VIEW_W, 3, UI.deskRail);
    for (let x = 0; x < VIEW_W; x += 1) {
      const wob = hash01(x, 11) > 0.72 ? 1 : 0;
      r.px(x, L.y0 + 5 + wob, UI.deskFaceDark);
    }
    r.rect_(0, VIEW_H - 6, VIEW_W, 6, UI.deskFaceDark);
    for (let i = 0; i < 8; i++) {
      drawSprite(ctx, this.sprites.screw, 6 + i * 66, VIEW_H - 4, { pivot: [3.5, 3.5] });
    }

    this.drawMeter(r, director.energy);

    for (const s of L.strips) this.drawStrip(r, s, mixer, venue, director);
    this.drawMaster(r, mixer);
    if (L.rack) this.drawRack(r, director, L.rack.x, L.rack.y);
    this.drawDeskFurniture(r, venue);
    this.drawBag(r, bag);
    if (director.job) this.drawSticky(r, director);
    if (director.spill) this.drawSpill(r, director);
  }

  /** Doc 7.1: one meter, no numeric score, threshold marked so it reads as a place. */
  private drawMeter(r: Renderer, energy: number): void {
    const m = this.layout.meter;
    r.rect_(m.x - 2, m.y - 2, m.w + 4, m.h + 4, UI.deskFaceDark);
    r.stroke(m.x - 2, m.y - 2, m.w + 4, m.h + 4, UI.deskEdge);
    r.rect_(m.x, m.y, m.w, m.h, '#171319');
    const frac = Math.max(0, Math.min(1, energy / 100));
    const w = Math.round(m.w * frac);
    const colour = energy >= 75 ? UI.good : energy >= ENERGY_PASS ? UI.lampOn : UI.danger;
    r.rect_(m.x, m.y, w, m.h, colour);
    r.rect_(m.x, m.y, w, 2, withLight(colour));
    // Ticks, so the bar has a scale without ever printing a number.
    for (let i = 1; i < 10; i++) {
      r.rect_(m.x + (m.w * i) / 10, m.y, 1, i === 5 ? m.h : 3, i === 5 ? UI.chalk : UI.inkFaint);
    }
    const passX = m.x + m.w / 2;
    r.rect_(passX - 1, m.y - 2, 3, m.h + 4, UI.chalk);
    drawText(r.ctx, GIG.passMark, passX + 4, m.y + 2, { colour: UI.ink, jitter: true, scale: 1 });
    drawText(r.ctx, GIG.roomLabel, m.x + 3, m.y + 2, { colour: UI.ink, jitter: true });
  }

  private drawStrip(
    r: Renderer,
    s: StripLayout,
    mixer: Mixer,
    venue: Venue,
    director: Director,
  ): void {
    const ctx = r.ctx;
    const m = MEMBERS[s.id];
    const st = mixer.get(s.id);
    const y0 = this.layout.y0;

    r.rect_(s.x, y0 + 16, STRIP_W, VIEW_H - 8 - (y0 + 16), UI.deskFaceLit);
    r.stroke(s.x, y0 + 16, STRIP_W, VIEW_H - 8 - (y0 + 16), UI.deskEdge);
    // Doc 6.4.5: the channel's colour is on the strip, so "which strip" is matching
    // rather than reasoning.
    r.rect_(s.x + 1, y0 + 17, STRIP_W - 2, 3, m.colour.base);
    const bleeding = director.live.some(
      (e) => e.def.target === s.id && e.escalated && e.phase !== 'done',
    );
    const pulse = bleeding && Math.sin(director.songTime * 11) > -0.1;
    r.rect_(s.x + 1, VIEW_H - 13, STRIP_W - 2, 4, pulse ? UI.danger : m.colour.dark);
    if (pulse) r.stroke(s.x, y0 + 16, STRIP_W, VIEW_H - 8 - (y0 + 16), UI.dangerDim);

    drawText(ctx, m.strip, s.x + STRIP_W / 2, s.labelY, {
      colour: UI.ink,
      jitter: true,
      align: 'center',
    });

    // Tone knob, or the hole where it will be.
    if (venue.controls.includes('tone')) {
      drawKnobWithAxis(r, this.sprites.knob, s.knob.cx, s.knob.cy, st.tone);
    }
    // FX toggle, or the hole where it will be.
    if (venue.controls.includes('fx')) {
      drawSprite(ctx, st.fx ? this.sprites.toggleUp : this.sprites.toggleDown, s.fx.x, s.fx.y);
      r.rect_(s.fx.x + 3, s.fx.y + 18, 8, 2, st.fx ? UI.lampOn : UI.lampOff);
      drawText(ctx, 'FX', s.fx.x - 15, s.fx.y + 5, { colour: UI.ink, jitter: true });
    }
    if (!venue.controls.includes('tone') || !venue.controls.includes('fx')) {
      // The scrawled note taped over the missing controls (doc 5.2). Deliberately
      // not a grey-out: the gear is simply not there yet and the fiction says so.
      const noteY = venue.controls.includes('tone') ? s.fx.y - 4 : s.knob.cy - 12;
      drawSprite(ctx, this.sprites.tape, s.x + 10, noteY);
    }

    this.drawFader(r, s.fader, st.volume, m.colour.base);
  }

  private drawMaster(r: Renderer, mixer: Mixer): void {
    const L = this.layout;
    const y0 = L.y0;
    r.rect_(L.master.x, y0 + 16, STRIP_W, VIEW_H - 8 - (y0 + 16), UI.deskFace);
    r.stroke(L.master.x, y0 + 16, STRIP_W, VIEW_H - 8 - (y0 + 16), UI.deskEdge);
    r.rect_(L.master.x + 1, y0 + 17, STRIP_W - 2, 3, UI.chalkDim);
    drawText(r.ctx, GIG.masterLabel, L.master.x + STRIP_W / 2, L.master.labelY, {
      colour: UI.ink,
      jitter: true,
      align: 'center',
    });
    this.drawFader(r, L.master.fader, mixer.master, UI.chalkDim);
  }

  /** Doc 5.2: every control draws its own axis. The track is thick at the top. */
  private drawFader(
    r: Renderer,
    f: { x: number; y: number; w: number; h: number },
    v: number,
    accent: string,
  ): void {
    const cx = f.x + f.w / 2;
    // Ruled straight track, tapering, so which way is louder needs no legend.
    for (let i = 0; i < f.h; i++) {
      const t = i / f.h;
      const w = 5 - t * 3;
      r.rect_(cx - w / 2, f.y + i, w, 1, UI.deskFaceDark);
    }
    r.rect_(cx - 1, f.y, 2, f.h, '#15120f');
    // The unity mark. A real console has one and neutral is a property of the desk.
    const nY = f.y + (1 - FADER_NEUTRAL) * f.h;
    r.rect_(f.x - 7, nY, 5, 1, UI.chalk);
    r.rect_(f.x + f.w + 2, nY, 5, 1, UI.chalk);
    const bandTop = f.y + (1 - FADER_NEUTRAL - NEUTRAL_WIDTH.volume) * f.h;
    const bandH = Math.max(2, NEUTRAL_WIDTH.volume * 2 * f.h);
    r.rect_(f.x + f.w + 3, bandTop, 2, bandH, UI.inkFaint);
    // Scale scratches down the side.
    for (let i = 0; i <= 5; i++) {
      r.rect_(f.x - 5, f.y + (i * f.h) / 5, 3, 1, UI.inkFaint);
    }
    const capY = f.y + (1 - v) * f.h;
    r.rect_(cx - 8, capY - 1, 16, 3, accent);
    drawSprite(r.ctx, this.sprites.cap, cx, capY, { pivot: [7.5, 5.5] });
  }

  /** The board's own effects rack, bolted to the desk. Doc 8.8's FX events live here. */
  private drawRack(r: Renderer, director: Director, x: number, y: number): void {
    const runaway = director.live.find(
      (e) => e.def.world.rackRunaway && e.phase === 'setup',
    );
    const shake = runaway ? Math.sin(director.songTime * 30) * (runaway.escalated ? 1.6 : 0.7) : 0;
    drawSprite(r.ctx, this.sprites.rack, x + shake, y);
    const lampX = x + 40;
    const lit = runaway
      ? Math.sin(director.songTime * (runaway.escalated ? 20 : 10)) > -0.2
      : false;
    if (runaway && lit) {
      r.disc(lampX, y + 14, 3, UI.danger);
      r.disc(lampX, y + 14, 1, '#ffd0d4');
    } else {
      r.disc(lampX, y + 14, 3, runaway ? UI.dangerDim : UI.good);
    }
    drawText(r.ctx, 'FX', x + 4, y + 22, { colour: UI.chalkDim, jitter: true });
  }

  /** Desk clutter. Doc 3.1: a high rate of small jokes, most of them background. */
  private drawDeskFurniture(r: Renderer, venue: Venue): void {
    const y0 = this.layout.y0;
    // A setlist, taped down, with the songs it does not have.
    r.rect_(408, y0 + 22, 44, 30, UI.paper);
    r.stroke(408, y0 + 22, 44, 30, UI.paperShade);
    r.rect_(404, y0 + 24, 10, 4, UI.metalDark);
    r.rect_(446, y0 + 46, 10, 4, UI.metalDark);
    for (let i = 0; i < 4; i++) {
      r.rect_(412, y0 + 27 + i * 6, 30 - i * 5, 2, UI.inkFaint);
    }
    // A mug that has been there since before the band existed.
    r.disc(462, y0 + 38, 7, UI.deskFaceDark);
    r.disc(462, y0 + 38, 5, '#2a1d12');
    r.rect_(468, y0 + 35, 4, 2, UI.deskFaceDark);
    // Masking tape with the room written on it, because every desk has this.
    const tapeX = this.layout.master.x + 68;
    r.rect_(tapeX, y0 + 20, 118, 11, UI.paperShade);
    r.rect_(tapeX + 2, y0 + 21, 114, 9, UI.paper);
    drawText(r.ctx, venue.name.slice(0, 18), tapeX + 4, y0 + 22, {
      colour: UI.ink,
      jitter: true,
    });
    // A torch, for the walk back to the van.
    r.rect_(tapeX + 6, y0 + 84, 26, 8, '#3d3a33');
    r.rect_(tapeX + 30, y0 + 82, 7, 12, '#8e8677');
    r.rect_(tapeX + 36, y0 + 84, 2, 8, '#c4bba6');
    // A coil of cable nobody will ever wind properly again.
    r.ring(tapeX + 62, y0 + 88, 11, '#2a241d');
    r.ring(tapeX + 62, y0 + 88, 8, '#2a241d');
    r.ring(tapeX + 62, y0 + 88, 5, '#2a241d');
    r.px(tapeX + 73, y0 + 92, UI.metal);
    // Hand-written note about the room, which is flavour and not an instruction.
    if (venue.id === 'sump') {
      drawText(r.ctx, 'DO NOT TOUCH PIPES', tapeX, y0 + 112, {
        colour: UI.inkFaint,
        jitter: true,
      });
    }
  }

  /** Doc 14.3: consumables are objects on the desk, so the name explains the effect. */
  private drawBag(r: Renderer, bag: string[]): void {
    const L = this.layout;
    for (let i = 0; i < bag.length && i < L.bag.length; i++) {
      const b = L.bag[i];
      const id = bag[i];
      if (id === 'airhorn') {
        r.poly([b.x + 2, b.y + 16, b.x + 8, b.y + 4, b.x + 14, b.y + 4, b.x + 18, b.y + 16], UI.danger);
        r.rect_(b.x + 7, b.y + 2, 8, 4, UI.metal);
        r.rect_(b.x + 4, b.y + 16, 14, 4, UI.dangerDim);
      } else if (id === 'gaffer') {
        r.disc(b.x + 10, b.y + 12, 9, '#22201c');
        r.disc(b.x + 10, b.y + 12, 4, UI.deskFaceLit);
        r.ring(b.x + 10, b.y + 12, 9, UI.metalDark);
      } else if (id === 'biscuits') {
        r.rect_(b.x + 1, b.y + 5, 18, 15, '#8d6a3c');
        r.stroke(b.x + 1, b.y + 5, 18, 15, '#5c421f');
        r.rect_(b.x + 4, b.y + 8, 12, 4, '#c9bd94');
      }
    }
  }

  /** Doc 16.4: the note lives on the board, because that is where the player looks. */
  private drawSticky(r: Renderer, director: Director): void {
    const p = director.job!;
    const L = this.layout;
    const flash = p.active && !p.done;
    const lift = flash ? Math.sin(director.songTime * 12) * 1.4 : 0;
    drawSprite(r.ctx, this.sprites.sticky, L.sticky.x, L.sticky.y + lift);
    if (flash) {
      r.stroke(L.sticky.x - 1, L.sticky.y - 1 + lift, 88, 58, UI.danger);
    }
    const lines =
      p.done
        ? ['JOB DONE.', 'HE OWES YOU', 'MONEY NOW.']
        : p.failed
          ? ['MISSED IT.', 'NO MONEY.']
          : flash && p.job.kind === 'hold'
            ? p.job.cue
            : p.job.note;
    lines.forEach((line, i) => {
      drawText(r.ctx, line, L.sticky.x + 5, L.sticky.y + 6 + i * 10 + lift, {
        colour: p.done ? '#2a6b2a' : '#3d3512',
        jitter: true,
      });
    });
    if (p.job.kind === 'hold' && flash) {
      const frac = Math.min(1, p.held / p.job.hold);
      r.rect_(L.sticky.x + 5, L.sticky.y + 48 + lift, 76, 4, '#cbba2a');
      r.rect_(L.sticky.x + 5, L.sticky.y + 48 + lift, Math.round(76 * frac), 4, '#2a6b2a');
    }
  }

  /** Board interference (doc 9). The one category exempt from the signal path test. */
  private drawSpill(r: Renderer, director: Director): void {
    const s = director.spill!;
    const ctx = r.ctx;
    const wet = s.wet;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = 0.55 + 0.35 * wet;
    for (let i = 0; i < 9; i++) {
      const px = s.x + hash01(i, 21) * s.w;
      const py = s.y + hash01(i, 22) * s.h;
      const rad = (2 + hash01(i, 23) * 5) * (0.4 + wet * 0.6);
      r.disc(px, py, rad, '#c98a2a');
    }
    ctx.globalAlpha = 0.8;
    r.disc(s.x + s.w * 0.45, s.y + s.h * 0.5, 11 * (0.45 + wet * 0.55), '#b57a22');
    ctx.globalAlpha = prev;
    drawSprite(ctx, this.sprites.beer, s.x + 2, s.y - 6, { rot: 96 });
    if (s.escalated) r.stroke(s.x - 1, s.y - 1, s.w + 2, s.h + 2, UI.danger);
    // The cloth, so the affordance is a visible object rather than a guess.
    drawSprite(ctx, this.sprites.cloth, 452, this.layout.y0 + 56);
  }
}

/**
 * Doc 5.2 again: the knob draws its own axis. A fat blob at one end and a sharp
 * spike at the other, never the words bass and treble.
 */
function drawKnobWithAxis(r: Renderer, knob: Sprite, cx: number, cy: number, value: number): void {
  // Fat end, left.
  r.disc(cx - 13, cy + 4, 3, UI.inkFaint);
  r.disc(cx - 13, cy + 4, 2, UI.deskFace);
  // Sharp end, right.
  r.poly([cx + 10, cy + 7, cx + 16, cy - 1, cx + 12, cy + 7], UI.inkFaint);
  // Centre notch, which is where flat is.
  r.rect_(cx, cy - 12, 1, 3, UI.chalk);
  drawSprite(r.ctx, knob, cx, cy, { rot: value * 138, pivot: [8.5, 8.5] });
}

function withLight(hex: string): string {
  return hex === UI.good ? '#a6f08f' : hex === UI.lampOn ? '#fff0a8' : '#ff9aa6';
}

export { textWidth };
