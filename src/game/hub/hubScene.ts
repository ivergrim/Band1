import { audio } from '../../core/audio/engine';
import { drawRig, drawSprite, loadRig, sprite, type Rig, type Sprite } from '../../core/assets';
import { VIEW_H, VIEW_W } from '../../core/config';
import { drawText, textWidth, wrapText } from '../../core/font';
import type { Input } from '../../core/input';
import { UI } from '../../core/palette';
import { hash01 } from '../../core/rng';
import type { Renderer } from '../../core/renderer';
import { BAND_NAME, MANAGER, MEMBERS } from '../content/cast';
import { BAND_LINES, GATE_NAG, HUB, PITCHES } from '../content/copy';
import { CATEGORY_NAMES, item, itemsIn, STORE, type Category, type StoreItem } from '../content/store';
import { SIDE_JOBS, type SideJob } from '../content/sidejobs';
import { VENUES, venue as findVenue, type Venue } from '../content/venues';
import type { Game } from '../app';
import type { GigOutcome } from '../gig/gigScene';
import { money } from '../gig/gigScene';

type Mode = 'pitch' | 'office' | 'map' | 'store' | 'machine';

/**
 * The hub (doc 13). One screen, visited between gigs (rule 21).
 *
 * Doc 13.4: full walkable point-and-click scenes would roughly double the art
 * workload and turn the project into two games. A single screen gives the same
 * comedic real estate at a fraction of the cost, so everything -- the map, the store,
 * the answering machine -- is an object on Barry's desk rather than a menu.
 */
export class HubScene {
  private mode: Mode = 'office';
  private manager!: Rig;
  private bg!: Sprite;
  private crt!: Sprite;
  private machine!: Sprite;
  private sticky!: Sprite;
  private loaded = false;
  private time = 0;

  private pitchVenue: Venue | null = null;
  private pitchLine = 0;
  private pitchChars = 0;

  private storeCat: Category = 'kit';
  private storeSwivel = 0;
  private flash = '';
  private flashUntil = 0;

  private machineJob: SideJob | null = null;
  /** What the pointer is over in the office, for the hover label. */
  private hover: { label: string; x: number; y: number; w: number; h: number } | null = null;
  private machineLine = 0;
  private mapNag: string[] | null = null;

  constructor(
    private game: Game,
    private lastOutcome: GigOutcome | null,
  ) {
    void this.load();
  }

  private async load(): Promise<void> {
    this.bg = await sprite('venue/office.svg');
    this.crt = await sprite('gear/crt.svg');
    this.machine = await sprite('gear/machine.svg');
    this.sticky = await sprite('board/sticky.svg');
    this.manager = await loadRig('manager', {
      base: '#5a3f6b',
      light: '#6c4d80',
      dark: '#48325a',
      ink: '#1a0f22',
    });
    this.loaded = true;
    // Doc 13.2: he pitches the newest available gig on entry, every time, which is
    // how the story gets delivered without needing new art per beat.
    const next = this.nextUnseenVenue();
    if (next) {
      this.pitchVenue = next;
      this.mode = 'pitch';
    }
  }

  private nextUnseenVenue(): Venue | null {
    for (const v of VENUES) {
      if (!this.unlocked(v)) continue;
      if (!this.game.save.seen.includes(`pitch:${v.id}`)) return v;
    }
    return null;
  }

  /** A venue is offered once the one before it has been passed (doc 14.5). */
  private unlocked(v: Venue): boolean {
    const i = VENUES.indexOf(v);
    if (i === 0) return true;
    return this.game.save.cleared.includes(VENUES[i - 1].id);
  }

  private gearOk(v: Venue): boolean {
    return !v.requiresGear || this.game.save.gear.includes(v.requiresGear);
  }

  private offeredJobs(): SideJob[] {
    const s = this.game.save;
    return SIDE_JOBS.filter((j) => {
      if (s.jobsDone.includes(j.id)) return false;
      if (s.jobAccepted === j.id) return false;
      const v = findVenue(j.venueId);
      return this.unlocked(v) && this.gearOk(v);
    });
  }

  // ----------------------------------------------------------------------- update

  update(dt: number, input: Input): void {
    this.time += dt;
    if (!this.loaded) return;
    if (this.mode === 'store') this.storeSwivel = Math.min(1, this.storeSwivel + dt * 3.4);
    else this.storeSwivel = Math.max(0, this.storeSwivel - dt * 4.2);

    switch (this.mode) {
      case 'pitch':
        this.updatePitch(dt, input);
        break;
      case 'office':
        this.updateOffice(input);
        break;
      case 'map':
        this.updateMap(input);
        break;
      case 'store':
        this.updateStore(input);
        break;
      case 'machine':
        this.updateMachine(input);
        break;
    }
  }

  private updatePitch(dt: number, input: Input): void {
    const lines = PITCHES[this.pitchVenue!.id] ?? [];
    this.pitchChars += dt * 58;
    const line = lines[this.pitchLine] ?? '';
    if (input.keyPressed('Escape')) {
      this.finishPitch();
      return;
    }
    if (input.p.pressed || input.keyPressed('Space')) {
      if (this.pitchChars < line.length) {
        this.pitchChars = line.length;
      } else if (this.pitchLine < lines.length - 1) {
        this.pitchLine++;
        this.pitchChars = 0;
        audio.chrome?.blip();
      } else {
        this.finishPitch();
      }
    }
  }

  private finishPitch(): void {
    this.game.save.seen.push(`pitch:${this.pitchVenue!.id}`);
    this.game.persist();
    this.pitchVenue = null;
    this.pitchLine = 0;
    this.pitchChars = 0;
    this.mode = 'office';
    audio.chrome?.confirm();
  }

  private updateOffice(input: Input): void {
    const p = input.p;
    this.hover = null;
    for (const h of OFFICE_HOTSPOTS) {
      if (input.pointInRect(p.x, p.y, h.x, h.y, h.w, h.h)) {
        this.hover = h;
        break;
      }
    }
    if (!p.pressed) return;
    if (input.pointInRect(p.x, p.y, 186, 118, 112, 96)) {
      this.mode = 'store';
      audio.chrome?.crtSwivel();
      return;
    }
    if (input.pointInRect(p.x, p.y, 316, 176, 70, 40)) {
      this.mode = 'machine';
      this.machineJob = null;
      this.machineLine = 0;
      audio.chrome?.machineBeep();
      return;
    }
    if (input.pointInRect(p.x, p.y, 34, 200, 76, 46)) {
      this.mode = 'map';
      this.mapNag = null;
      audio.chrome?.blip();
      return;
    }
  }

  private updateMap(input: Input): void {
    const p = input.p;
    if (input.keyPressed('Escape')) {
      this.mode = 'office';
      return;
    }
    if (!p.pressed) return;
    if (this.mapNag) {
      this.mapNag = null;
      return;
    }
    if (input.pointInRect(p.x, p.y, 12, 240, 60, 22)) {
      this.mode = 'office';
      audio.chrome?.cancel();
      return;
    }
    for (const [i, v] of VENUES.entries()) {
      const pin = MAP_PINS[i];
      if (!input.pointInRect(p.x, p.y, pin.x - 16, pin.y - 16, 32, 32)) continue;
      if (!this.unlocked(v)) {
        audio.chrome?.denied();
        return;
      }
      if (!this.gearOk(v)) {
        // Doc 14.2: attempting a locked gig tells you exactly what you are missing,
        // which is what turns the map into a set of visible goals.
        this.mapNag = GATE_NAG[v.id] ?? ['You are missing something.'];
        audio.chrome?.denied();
        return;
      }
      audio.chrome?.confirm();
      this.game.toGig(v);
      return;
    }
  }

  private updateStore(input: Input): void {
    const p = input.p;
    if (input.keyPressed('Escape')) {
      this.mode = 'office';
      audio.chrome?.cancel();
      return;
    }
    if (!p.pressed) return;
    const cats: Category[] = ['kit', 'emergency', 'look'];
    for (const [i, c] of cats.entries()) {
      if (input.pointInRect(p.x, p.y, 52, 78 + i * 16, 76, 14)) {
        this.storeCat = c;
        audio.chrome?.blip();
        return;
      }
    }
    if (input.pointInRect(p.x, p.y, 52, 214, 76, 16)) {
      this.mode = 'office';
      audio.chrome?.cancel();
      return;
    }
    const list = itemsIn(this.storeCat);
    for (const [i, it] of list.entries()) {
      const y = 78 + i * 40;
      if (!input.pointInRect(p.x, p.y, 140, y, 296, 38)) continue;
      this.act(it);
      return;
    }
  }

  private act(it: StoreItem): void {
    const s = this.game.save;
    if (it.outOfStock) {
      this.say(HUB.storeClosed);
      audio.chrome?.denied();
      return;
    }
    const owned = s.gear.includes(it.id) || s.wearables.includes(it.id);
    if (it.wearable && owned) {
      // Buying and equipping live in the same place (doc 13.2).
      const m = it.wearable.member;
      s.worn[m] = s.worn[m] === it.id ? null : it.id;
      this.say(s.worn[m] ? `${MEMBERS[m].name.toUpperCase()} IS WEARING IT` : 'TAKEN OFF');
      audio.chrome?.toggle(!!s.worn[m]);
      this.game.persist();
      return;
    }
    if (it.once && owned) {
      this.say('YOU HAVE ONE');
      audio.chrome?.denied();
      return;
    }
    if (s.money < it.price) {
      this.say(HUB.cantAfford);
      audio.chrome?.denied();
      return;
    }
    s.money -= it.price;
    if (it.category === 'kit') s.gear.push(it.id);
    else if (it.category === 'look') s.wearables.push(it.id);
    else s.bag[it.id] = (s.bag[it.id] ?? 0) + 1;
    this.say('BOUGHT');
    audio.chrome?.purchase();
    this.game.persist();
  }

  private updateMachine(input: Input): void {
    const p = input.p;
    if (input.keyPressed('Escape')) {
      this.mode = 'office';
      return;
    }
    if (!p.pressed) return;
    if (input.pointInRect(p.x, p.y, 12, 240, 60, 22)) {
      this.mode = 'office';
      audio.chrome?.cancel();
      return;
    }
    if (this.machineJob) {
      const lines = this.machineJob.message;
      if (this.machineLine < lines.length - 1) {
        this.machineLine++;
        audio.chrome?.machineBeep();
        return;
      }
      if (input.pointInRect(p.x, p.y, 300, 218, 96, 20)) {
        this.game.save.jobAccepted = this.machineJob.id;
        this.game.persist();
        this.say(HUB.machineAccepted);
        audio.chrome?.confirm();
        this.machineJob = null;
        return;
      }
      if (input.pointInRect(p.x, p.y, 190, 218, 96, 20)) {
        this.machineJob = null;
        audio.chrome?.cancel();
        return;
      }
      return;
    }
    const jobs = this.offeredJobs();
    for (const [i, j] of jobs.entries()) {
      if (input.pointInRect(p.x, p.y, 60, 84 + i * 30, 360, 26)) {
        this.machineJob = j;
        this.machineLine = 0;
        audio.chrome?.machineBeep();
        return;
      }
    }
  }

  private say(msg: string): void {
    this.flash = msg;
    this.flashUntil = this.time + 1.6;
  }

  // ------------------------------------------------------------------------- draw

  draw(r: Renderer): void {
    if (!this.loaded) {
      r.clear(UI.black);
      drawText(r.ctx, 'OPENING THE OFFICE', VIEW_W / 2, VIEW_H / 2, {
        colour: UI.chalkDim,
        align: 'center',
        jitter: true,
      });
      return;
    }
    if (this.mode === 'map') {
      this.drawMap(r);
      return;
    }
    if (this.mode === 'store' && this.storeSwivel > 0.55) {
      this.drawStore(r);
      return;
    }
    this.drawOffice(r);
    if (this.mode === 'machine') this.drawMachine(r);
    if (this.mode === 'pitch') this.drawPitch(r);
    if (this.time < this.flashUntil) {
      drawText(r.ctx, this.flash, VIEW_W / 2, 8, {
        colour: UI.lampOn,
        align: 'center',
        jitter: true,
        shadow: UI.black,
      });
    }
  }

  private drawOffice(r: Renderer): void {
    const ctx = r.ctx;
    drawSprite(ctx, this.bg, 0, 0);

    // Him, behind the desk, breathing. One drawing, used every time the player
    // comes back, which is doc 13.1's whole economic argument.
    const sway = Math.sin(this.time * 0.9) * 1.8;
    drawRig(ctx, this.manager, 116, 216, {
      torso: { rot: sway * 0.4 },
      head: { rot: -sway * 0.7 },
      armNear: { rot: Math.sin(this.time * 1.4) * 6 },
      armFar: { rot: -4 },
      facePitch: { hidden: this.mode !== 'pitch' },
      faceShifty: { hidden: this.mode === 'pitch' },
      faceAlarm: { hidden: true },
    });

    // The computer, facing him, because of course it faces him (doc 13.3).
    drawSprite(ctx, this.crt, 186, 118);
    r.rect_(200, 132, 82, 48, '#1d2420');
    for (let i = 0; i < 48; i += 3) r.rect_(200, 132 + i, 82, 1, '#232c27');
    drawText(ctx, 'LOAM', 214, 148, { colour: '#4f6b56', jitter: true });
    drawText(ctx, 'RETAIL', 214, 158, { colour: '#4f6b56', jitter: true });

    drawSprite(ctx, this.machine, 318, 178);
    // The machine's light has always been flashing.
    if (Math.sin(this.time * 4) > 0) r.disc(372, 192, 2.4, UI.danger);
    if (this.game.save.jobAccepted) {
      drawSprite(ctx, this.sticky, 300, 150, { scale: 0.6 });
      drawText(ctx, 'JOB ON', 306, 158, { colour: '#3d3512', jitter: true });
    }

    // The clipboard of gigs, which is the map.
    r.rect_(34, 200, 76, 46, '#5a4a30');
    r.stroke(34, 200, 76, 46, '#2a2114');
    r.rect_(38, 204, 68, 38, UI.paper);
    r.rect_(60, 197, 24, 7, UI.metal);
    drawText(ctx, 'GIGS', 72, 210, { colour: UI.ink, align: 'center', jitter: true });
    for (const [i, v] of VENUES.entries()) {
      const ok = this.unlocked(v);
      drawText(ctx, ok ? v.name.slice(0, 11) : '???????', 42, 221 + i * 8, {
        colour: ok ? UI.inkFaint : '#a89b7c',
      });
    }

    // Money and the state of the band, at the top where it cannot be missed.
    r.veil(0, 0, VIEW_W, 16, UI.black, 0.55);
    drawText(ctx, 'BARRY LOAM ARTIST MANAGEMENT', 6, 4, { colour: UI.chalkDim, jitter: true });
    drawText(ctx, money(this.game.save.money), VIEW_W - 6, 4, {
      colour: UI.lampOn,
      align: 'right',
      jitter: true,
    });

    if (this.mode === 'office' && this.hover) {
      const h = this.hover;
      r.stroke(h.x - 2, h.y - 2, h.w + 4, h.h + 4, UI.lampOn);
      const w = textWidth(h.label) + 6;
      const lx = Math.max(2, Math.min(VIEW_W - w - 2, h.x + h.w / 2 - w / 2));
      r.rect_(lx, h.y - 14, w, 10, UI.black);
      drawText(ctx, h.label, lx + 3, h.y - 12, { colour: UI.lampOn, jitter: true });
    }

    if (this.mode === 'office') {
      const lines = this.lastOutcome && !this.lastOutcome.passed ? BAND_LINES.bad : BAND_LINES.good;
      const idx = Math.floor(this.time / 4) % lines.length;
      drawText(ctx, lines[idx], VIEW_W / 2, 254, {
        colour: UI.chalkDim,
        align: 'center',
        jitter: true,
      });
      drawText(ctx, BAND_NAME, VIEW_W / 2, 242, {
        colour: UI.inkFaint,
        align: 'center',
        jitter: true,
      });
    }
  }

  private drawPitch(r: Renderer): void {
    const lines = PITCHES[this.pitchVenue!.id] ?? [];
    const boxY = 186;
    r.rect_(20, boxY, 440, 80, '#12100e');
    r.stroke(20, boxY, 440, 80, UI.deskRail);
    r.stroke(22, boxY + 2, 436, 76, UI.inkFaint);
    drawText(r.ctx, `${MANAGER.name.toUpperCase()}:`, 30, boxY + 8, {
      colour: UI.lampOn,
      jitter: true,
    });
    for (let i = 0; i <= this.pitchLine && i < lines.length; i++) {
      const full = lines[i];
      const shown = i === this.pitchLine ? full.slice(0, Math.floor(this.pitchChars)) : full;
      drawText(r.ctx, shown, 30, boxY + 22 + i * 11, { colour: UI.chalk, jitter: true });
    }
    if (Math.sin(this.time * 6) > 0) {
      drawText(r.ctx, '>', 444, boxY + 66, { colour: UI.chalkDim });
    }
    drawText(r.ctx, 'ESC skips him', 450, boxY + 8, { colour: UI.inkFaint, align: 'right' });
  }

  /** Doc 13.2: the map shows progression, shows what is locked and why. */
  private drawMap(r: Renderer): void {
    const ctx = r.ctx;
    drawSprite(ctx, mapSprite!, 0, 0);
    drawText(ctx, 'GIGS GOING', 20, 16, { colour: UI.ink, jitter: true, scale: 2 });
    drawText(ctx, money(this.game.save.money), 460, 18, {
      colour: UI.ink,
      align: 'right',
      jitter: true,
    });

    for (const [i, v] of VENUES.entries()) {
      const pin = MAP_PINS[i];
      const unlocked = this.unlocked(v);
      const gated = unlocked && !this.gearOk(v);
      const best = this.game.save.best[v.id];
      const col = !unlocked ? '#8d8156' : gated ? UI.danger : best ? UI.good : UI.lampOn;
      const bob = unlocked && !gated ? Math.sin(this.time * 3 + i) * 1.2 : 0;
      r.line(pin.x, pin.y + bob, pin.x, pin.y - 10 + bob, UI.ink);
      r.disc(pin.x, pin.y - 12 + bob, 4, col);
      r.ring(pin.x, pin.y - 12 + bob, 4, UI.ink);
      const label = unlocked ? v.name : '?????';
      const w = textWidth(label) + 6;
      r.rect_(pin.x - w / 2, pin.y + 4, w, 10, UI.paper);
      r.stroke(pin.x - w / 2, pin.y + 4, w, 10, UI.paperShade);
      drawText(ctx, label, pin.x, pin.y + 6, { colour: UI.ink, align: 'center', jitter: true });
      if (best !== undefined) {
        drawText(ctx, `BEST ${best}`, pin.x, pin.y + 16, {
          colour: '#4a4230',
          align: 'center',
          jitter: true,
        });
      }
      if (gated) {
        drawText(ctx, 'NEEDS GEAR', pin.x, pin.y + 16, {
          colour: '#8d2028',
          align: 'center',
          jitter: true,
        });
      }
    }

    r.rect_(12, 240, 60, 22, UI.paper);
    r.stroke(12, 240, 60, 22, UI.paperShade);
    drawText(ctx, 'BACK', 42, 247, { colour: UI.ink, align: 'center', jitter: true });

    if (this.mapNag) {
      r.veil(0, 0, VIEW_W, VIEW_H, UI.black, 0.72);
      r.rect_(60, 74, 360, 122, '#12100e');
      r.stroke(60, 74, 360, 122, UI.danger);
      this.mapNag.forEach((line, i) => {
        drawText(ctx, line, 74, 86 + i * 12, {
          colour: i === 0 ? UI.danger : UI.chalk,
          jitter: true,
        });
      });
      drawText(ctx, 'CLICK', 240, 178, { colour: UI.chalkDim, align: 'center', jitter: true });
    }
  }

  /**
   * The store: a 90s shopping website on a beige CRT (doc 13.3). Table layouts,
   * visited-link purple, categories down the left. It keeps the store inside the
   * fiction instead of bolting a UI onto the hub, and it costs one drawn object.
   */
  private drawStore(r: Renderer): void {
    const ctx = r.ctx;
    r.clear('#0d0c10');
    // Bezel, drawn big, because the point of the swivel is that you can read it.
    r.rect_(8, 8, 464, 254, '#b8b2a0');
    r.stroke(8, 8, 464, 254, '#3d3a33');
    r.rect_(16, 16, 448, 226, '#8d8878');
    r.rect_(22, 22, 436, 214, '#c9c6b4');
    r.rect_(22, 22, 436, 214, '#d8d5c2');
    drawText(ctx, 'LOAM RETAIL 3000', 240, 248, {
      colour: '#3d3a33',
      align: 'center',
      jitter: true,
    });

    // Page header, animated GIF included, obviously.
    r.rect_(22, 22, 436, 26, '#2c2c6e');
    drawText(ctx, 'LOAM RETAIL', 32, 30, { colour: '#f2e14c', jitter: true, scale: 2 });
    const spin = Math.floor(this.time * 6) % 4;
    r.rect_(400 + spin, 26, 18 - spin * 2, 18, '#c8352f');
    r.rect_(404 + spin, 30, 10 - spin, 10, '#f2e14c');
    drawText(ctx, 'NEW!', 428, 30, { colour: '#f2e14c', jitter: true });

    drawText(ctx, `YOU HAVE ${money(this.game.save.money)}`, 32, 56, { colour: '#2c2c6e' });
    drawText(ctx, 'ALL SALES FINAL · NO REFUNDS · NO POST', 208, 56, {
      colour: '#7a2c24',
    });

    const cats: Category[] = ['kit', 'emergency', 'look'];
    cats.forEach((c, i) => {
      const on = this.storeCat === c;
      r.rect_(52, 78 + i * 16, 76, 14, on ? '#2c2c6e' : '#b0ada0');
      drawText(ctx, CATEGORY_NAMES[c], 56, 82 + i * 16, {
        colour: on ? '#f2e14c' : '#551a8b',
      });
    });
    r.rect_(52, 214, 76, 16, '#b0ada0');
    drawText(ctx, 'CLOSE', 90, 218, { colour: '#551a8b', align: 'center' });

    const list = itemsIn(this.storeCat);
    list.forEach((it, i) => {
      const y = 78 + i * 40;
      const owned =
        this.game.save.gear.includes(it.id) || this.game.save.wearables.includes(it.id);
      const held = this.game.save.bag[it.id] ?? 0;
      r.rect_(140, y, 296, 38, i % 2 ? '#c4c1b0' : '#cecbba');
      r.stroke(140, y, 296, 38, '#a8a596');
      drawText(ctx, it.name, 145, y + 3, { colour: it.outOfStock ? '#8d8878' : '#2c2c6e' });
      const right = it.outOfStock
        ? HUB.storeClosed
        : owned && it.wearable
          ? this.game.save.worn[it.wearable.member] === it.id
            ? 'WORN'
            : 'WEAR IT'
          : owned
            ? 'OWNED'
            : held
              ? `${money(it.price)} (${held})`
              : money(it.price);
      drawText(ctx, right, 431, y + 3, { colour: '#7a2c24', align: 'right' });
      const desc = wrapText(it.desc, 278);
      const room = it.outOfStock ? 2 : 3;
      desc.slice(0, room).forEach((line, k) => {
        drawText(ctx, line, 145, y + 14 + k * 9, { colour: '#4a4438' });
      });
      if (it.outOfStock && it.soon) {
        drawText(ctx, `back in stock: ${it.soon}`, 145, y + 23, { colour: '#8d8878' });
      }
    });
  }

  /** The answering machine. Side jobs arrive here and nowhere else (doc 16.1). */
  private drawMachine(r: Renderer): void {
    const ctx = r.ctx;
    r.veil(0, 0, VIEW_W, VIEW_H, UI.black, 0.86);
    r.rect_(40, 40, 400, 200, '#12100e');
    r.stroke(40, 40, 400, 200, UI.deskRail);
    drawText(ctx, 'ANSWERING MACHINE', 240, 50, {
      colour: UI.lampOn,
      align: 'center',
      jitter: true,
    });

    if (this.machineJob) {
      const j = this.machineJob;
      drawText(ctx, `FROM: ${j.from}`, 60, 68, { colour: UI.chalkDim, jitter: true });
      drawText(ctx, `PAYS: ${money(j.pay)}`, 380, 68, {
        colour: UI.stickyNote,
        align: 'right',
        jitter: true,
      });
      let my = 86;
      for (let i = 0; i <= this.machineLine && i < j.message.length; i++) {
        for (const line of wrapText(j.message[i], 356)) {
          drawText(ctx, line, 60, my, {
            colour: i === this.machineLine ? UI.chalk : UI.chalkDim,
            jitter: true,
          });
          my += 11;
        }
        my += 2;
      }
      drawText(ctx, `AT: ${findVenue(j.venueId).name}`, 60, 196, {
        colour: UI.good,
        jitter: true,
      });
      if (this.machineLine >= j.message.length - 1) {
        r.rect_(190, 218, 96, 20, UI.deskFace);
        r.stroke(190, 218, 96, 20, UI.deskEdge);
        drawText(ctx, 'DELETE', 238, 224, { colour: UI.chalk, align: 'center', jitter: true });
        r.rect_(300, 218, 96, 20, '#2a5a2a');
        r.stroke(300, 218, 96, 20, UI.good);
        drawText(ctx, 'TAKE IT', 348, 224, { colour: UI.chalk, align: 'center', jitter: true });
      } else {
        drawText(ctx, 'CLICK TO KEEP LISTENING', 240, 224, {
          colour: UI.chalkDim,
          align: 'center',
          jitter: true,
        });
      }
      return;
    }

    const jobs = this.offeredJobs();
    if (!jobs.length) {
      HUB.machineEmpty.forEach((line, i) => {
        drawText(ctx, line, 240, 96 + i * 13, {
          colour: i === 0 ? UI.chalkDim : UI.inkFaint,
          align: 'center',
          jitter: true,
        });
      });
    }
    jobs.forEach((j, i) => {
      const y = 84 + i * 30;
      r.rect_(60, y, 360, 26, UI.deskFace);
      r.stroke(60, y, 360, 26, UI.deskEdge);
      if (Math.sin(this.time * 5 + i) > 0) r.disc(70, y + 13, 3, UI.danger);
      drawText(ctx, j.from, 82, y + 4, { colour: UI.chalk, jitter: true });
      drawText(ctx, findVenue(j.venueId).name, 82, y + 15, {
        colour: UI.chalkDim,
        jitter: true,
      });
      drawText(ctx, money(j.pay), 410, y + 9, {
        colour: UI.stickyNote,
        align: 'right',
        jitter: true,
      });
    });
    if (this.game.save.jobAccepted) {
      drawText(ctx, `ON THE BOOKS: ${sideJobName(this.game.save.jobAccepted)}`, 240, 200, {
        colour: UI.good,
        align: 'center',
        jitter: true,
      });
    }
    r.rect_(12, 240, 60, 22, UI.deskFace);
    r.stroke(12, 240, 60, 22, UI.deskEdge);
    drawText(ctx, 'BACK', 42, 247, { colour: UI.chalk, align: 'center', jitter: true });
  }
}

function sideJobName(id: string): string {
  return SIDE_JOBS.find((j) => j.id === id)?.from ?? id;
}

/**
 * The three things on Barry's desk you can use. Doc 13.2: buying, gigs and side jobs
 * all live on one screen, so they are objects rather than menu items -- which means
 * they have to announce that they are objects.
 */
const OFFICE_HOTSPOTS = [
  { label: 'HIS COMPUTER', x: 186, y: 118, w: 112, h: 96 },
  { label: 'MESSAGES', x: 316, y: 176, w: 70, h: 40 },
  { label: 'GIGS GOING', x: 34, y: 200, w: 76, h: 46 },
];

/** Pin positions on the drawn map, one per venue. */
const MAP_PINS = [
  { x: 84, y: 150 },
  { x: 252, y: 108 },
  { x: 366, y: 176 },
];

let mapSprite: Sprite | null = null;
export async function preloadHubArt(): Promise<void> {
  mapSprite = await sprite('venue/map.svg');
}

export { item, STORE, hash01 };
