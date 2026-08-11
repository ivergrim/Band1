import { audio } from '../../core/audio/engine';
import { ENERGY_PASS, VIEW_H, VIEW_W } from '../../core/config';
import { drawText, wrapText } from '../../core/font';
import type { Input } from '../../core/input';
import { UI } from '../../core/palette';
import type { Renderer } from '../../core/renderer';
import { BAND_NAME, MEMBERS } from '../content/cast';
import { BLAME, GIG, RESULTS } from '../content/copy';
import { arrangementFor, EVENT_AUDIO, SEC_PER_BAR, songLength, TIER1_SONG } from '../content/song';
import { item } from '../content/store';
import type { Venue } from '../content/venues';
import { sideJob } from '../content/sidejobs';
import type { Game } from '../app';
import { Board } from './board';
import { Director } from './director';
import { Mixer } from './mixer';
import { Stage } from './stage';
import { describeTimeline } from './scheduler';

type Phase = 'loading' | 'ready' | 'playing' | 'results';

export type GigOutcome = {
  venueId: string;
  energy: number;
  payout: number;
  jobPay: number;
  jobDone: boolean;
  passed: boolean;
};

/**
 * One gig. Doc 8.4: a gig is one song, and its structure provides the anchor points
 * for everything the scheduler does.
 *
 * Doc 7.4: gigs can be failed and replayed immediately with no run-loss and no
 * progress penalty, and replaying earlier gigs is always available, so money always
 * has a route and the worst case is slow rather than stuck.
 */
export class GigScene {
  private phase: Phase = 'loading';
  private stage = new Stage();
  private board = new Board();
  private mixer!: Mixer;
  private director!: Director;
  private venue: Venue;
  private bag: string[] = [];
  private outcome: GigOutcome | null = null;
  private resultLines: string[] = [];
  private spillFired = false;
  private ready = 0;
  /** Dev toggles, which are the doc 19 measurements rather than debug cruft. */
  private devOverlay = false;
  private hazeCheck = false;
  private vizEnabled = true;

  constructor(
    private game: Game,
    venue: Venue,
  ) {
    this.venue = venue;
    void this.load();
  }

  private async load(): Promise<void> {
    const save = this.game.save;
    this.bag = [];
    for (const [id, n] of Object.entries(save.bag)) {
      for (let i = 0; i < n; i++) this.bag.push(id);
    }
    this.bag = this.bag.slice(0, 4);

    await audio.init();
    await audio.loadSong(arrangementFor(this.venue.band));
    await audio.preload(EVENT_AUDIO);
    await this.stage.load(this.venue, save.worn);
    await this.board.load(this.venue, this.bag.length);

    this.mixer = new Mixer(this.venue, audio);
    this.mixer.flush();
    const job = save.jobAccepted ? sideJob(save.jobAccepted) : null;
    // The seed changes per attempt, which is what makes the order fresh on replay
    // while the authored density curve stays identical (doc 8.3).
    this.director = new Director(this.venue, this.mixer, audio, (Date.now() & 0x7fffffff) >>> 0, job);
    this.phase = 'ready';
  }

  /** Playtest hook: lets a script read demands and drive controls. Not used in play. */
  probe(): {
    scheduled: number;
    unfired: number;
    phase: Phase;
    energy: number;
    songTime: number;
    demands: { target: string; kind: string; lo: number; hi: number; fx?: boolean; event: boolean }[];
  } {
    const demands: { target: string; kind: string; lo: number; hi: number; fx?: boolean; event: boolean }[] = [];
    if (this.director) {
      for (const id of this.venue.band) {
        for (const k of this.venue.controls) {
          const d = this.director.demandFor(id, k);
          demands.push({ target: id, kind: k, lo: d.lo, hi: d.hi, fx: d.fx, event: !!d.owner });
        }
      }
      const dm = this.director.demandFor('master', 'master');
      demands.push({ target: 'master', kind: 'master', lo: dm.lo, hi: dm.hi, event: !!dm.owner });
    }
    return {
      scheduled: this.director ? this.director.timeline.length : 0,
      unfired: this.director ? this.director.pending.length : 0,
      phase: this.phase,
      energy: this.director ? this.director.energy : 0,
      songTime: this.director ? this.director.songTime : 0,
      demands,
    };
  }

  /** Playtest hook: put a control exactly where the demand wants it. */
  poke(target: string, kind: string, value: number | boolean): void {
    if (target === 'master') this.mixer.setMaster(value as number);
    else this.mixer.set(target as never, kind as never, value);
  }

  update(dt: number, input: Input): void {
    if (input.keyPressed('F3')) this.devOverlay = !this.devOverlay;
    if (input.keyPressed('KeyH')) this.hazeCheck = !this.hazeCheck;
    if (input.keyPressed('KeyV')) this.vizEnabled = !this.vizEnabled;

    if (this.phase === 'loading') return;

    if (this.phase === 'ready') {
      this.ready += dt;
      if (input.p.pressed && this.ready > 0.35) {
        this.phase = 'playing';
        audio.startSong();
        audio.chrome?.confirm();
      }
      if (input.keyPressed('Escape')) this.quit();
      return;
    }

    if (this.phase === 'results') {
      if (input.p.pressed || input.keyPressed('Space')) this.finish();
      return;
    }

    // playing
    if (input.keyPressed('Escape')) {
      this.abandon();
      return;
    }

    const t = audio.songTime;
    this.director.update(dt, t);

    // Doc 9.2: the single beer spill, near the close of venue 3.
    if (
      this.venue.interferenceAt !== undefined &&
      !this.spillFired &&
      t >= this.venue.interferenceAt
    ) {
      this.spillFired = true;
      const strip = this.board.layout.strips[Math.min(1, this.board.layout.strips.length - 1)];
      this.director.spawnSpill(strip.x - 4, this.board.layout.y0 + 88, t);
    }

    this.board.handleInput(
      input,
      this.mixer,
      this.director,
      this.venue,
      () => audio.chrome?.detent(),
      (on) => audio.chrome?.toggle(on),
      () => audio.chrome?.grab(),
      () => audio.chrome?.wipe(),
      (i) => this.useConsumable(i),
    );

    const job = this.director.job;
    if (job && job.active && !job.cued) {
      job.cued = true;
      audio.chrome?.jobCue();
    }
    for (const e of this.director.live) {
      if (e.escalated && !e.claimed && !(e as { ticked?: boolean }).ticked) {
        (e as { ticked?: boolean }).ticked = true;
        audio.chrome?.graceTick();
      }
    }

    if (this.director.finished || t >= songLength()) this.endGig();
  }

  private useConsumable(index: number): void {
    const id = this.bag[index];
    if (!id) return;
    const def = item(id);
    if (!def.effect) return;
    let used = false;
    if (def.effect.kind === 'energy') {
      this.director.addEnergy(def.effect.amount);
      used = true;
    } else if (def.effect.kind === 'clear') {
      used = this.director.clearOneProblem();
    } else if (def.effect.kind === 'quiet') {
      this.director.quietUntil = this.director.songTime + def.effect.seconds;
      used = true;
    }
    if (!used) {
      audio.chrome?.denied();
      return;
    }
    audio.chrome?.purchase();
    this.bag.splice(index, 1);
    const save = this.game.save;
    save.bag[id] = Math.max(0, (save.bag[id] ?? 1) - 1);
    if (save.bag[id] === 0) delete save.bag[id];
    this.game.persist();
    void this.board.load(this.venue, this.bag.length);
  }

  private endGig(): void {
    if (this.phase !== 'playing') return;
    this.director.settleJob();
    this.director.teardown();
    audio.stopSong();
    const energy = Math.round(this.director.energy);
    const passed = energy >= ENERGY_PASS;
    const jobDone = !!this.director.job?.done;
    const jobPay = jobDone ? this.director.job!.job.pay : 0;
    const payout = passed ? Math.round((this.venue.payout * energy) / 100) : 0;
    this.outcome = { venueId: this.venue.id, energy, payout, jobPay, jobDone, passed };
    this.resultLines = this.composeResults(energy, passed);
    this.phase = 'results';
    if (energy >= 100) audio.chrome?.stingPerfect();
    else if (passed) audio.chrome?.stingPass();
    else audio.chrome?.stingFail();
  }

  /** Doc 7.3: failure is explained diegetically, and it points at what went wrong. */
  private composeResults(energy: number, passed: boolean): string[] {
    const band =
      energy >= 100
        ? RESULTS.perfect
        : energy >= 80
          ? RESULTS.great
          : passed
            ? RESULTS.pass
            : this.director.wipedOut
              ? RESULTS.wipeout
              : RESULTS.fail;
    const blame = BLAME[this.director.worstBlame] ?? BLAME.none;
    return [...band, '', ...blame];
  }

  private abandon(): void {
    this.director.teardown();
    audio.stopSong();
    this.game.toHub();
  }

  private quit(): void {
    audio.stopSong();
    this.game.toHub();
  }

  private finish(): void {
    const o = this.outcome!;
    const save = this.game.save;
    save.money += o.payout + o.jobPay;
    save.best[o.venueId] = Math.max(save.best[o.venueId] ?? 0, o.energy);
    if (o.passed && !save.cleared.includes(o.venueId)) save.cleared.push(o.venueId);
    if (o.jobDone && save.jobAccepted) {
      save.jobsDone.push(save.jobAccepted);
      save.jobAccepted = null;
    } else if (this.director.job?.failed && save.jobAccepted) {
      // A failed job goes back on the machine rather than being lost, because doc 7.4
      // is clear that nothing about a bad gig should cost the player progress.
      save.jobAccepted = null;
    }
    this.game.persist();
    this.game.toHub(o);
  }

  // -------------------------------------------------------------------- rendering

  draw(r: Renderer): void {
    if (this.phase === 'loading') {
      r.clear(UI.black);
      drawText(r.ctx, 'SETTING UP', VIEW_W / 2, VIEW_H / 2 - 4, {
        colour: UI.chalkDim,
        align: 'center',
        jitter: true,
      });
      return;
    }

    r.clear(UI.night);
    const t = this.phase === 'playing' ? audio.songTime : 0;
    const beatDur = SEC_PER_BAR / TIER1_SONG.beatsPerBar;
    this.stage.draw(r, {
      mixer: this.mixer,
      visuals: this.phase === 'playing' ? this.director.visuals() : [],
      songTime: t,
      beatDur,
      energy: this.director.energy,
      hidden: this.hazeCheck,
      vizEnabled: this.vizEnabled,
    });
    this.board.draw(r, this.mixer, this.director, this.venue, this.bag);

    if (this.phase === 'ready') this.drawReady(r);
    if (this.phase === 'results') this.drawResults(r);
    if (this.devOverlay) this.drawDev(r);
  }

  private drawReady(r: Renderer): void {
    r.veil(0, 0, VIEW_W, VIEW_H, UI.black, 0.68);
    const cx = VIEW_W / 2;
    drawText(r.ctx, BAND_NAME, cx, 62, { colour: UI.chalkDim, align: 'center', jitter: true });
    drawText(r.ctx, this.venue.name, cx, 78, {
      colour: UI.lampOn,
      align: 'center',
      jitter: true,
      scale: 2,
      shadow: UI.black,
    });
    const line = this.venue.band.map((id) => MEMBERS[id].name).join('  ·  ');
    drawText(r.ctx, line, cx, 108, { colour: UI.chalk, align: 'center', jitter: true });
    if (this.venue.debut) {
      drawText(r.ctx, `NEW ON THE DESK: ${this.venue.debut.control.toUpperCase()}`, cx, 132, {
        colour: UI.good,
        align: 'center',
        jitter: true,
      });
    }
    const job = this.director.job;
    if (job) {
      drawText(r.ctx, `SIDE JOB ACCEPTED — ${job.job.from}`, cx, 152, {
        colour: UI.stickyNote,
        align: 'center',
        jitter: true,
      });
    }
    if (Math.floor(this.ready * 1.6) % 2 === 0) {
      drawText(r.ctx, GIG.ready, cx, 200, { colour: UI.chalkDim, align: 'center', jitter: true });
    }
    drawText(r.ctx, 'ESC to walk out · H hides the stage · V toggles drawn sound', cx, 246, {
      colour: UI.inkFaint,
      align: 'center',
    });
  }

  private drawResults(r: Renderer): void {
    const o = this.outcome!;
    r.veil(0, 0, VIEW_W, VIEW_H, UI.black, 0.93);
    const cx = VIEW_W / 2;
    drawText(r.ctx, this.venue.name, cx, 26, { colour: UI.chalkDim, align: 'center', jitter: true });
    const head = o.energy >= 100 ? 'FLAWLESS' : o.passed ? 'THAT WILL DO' : 'NO';
    drawText(r.ctx, head, cx, 40, {
      colour: o.passed ? UI.lampOn : UI.danger,
      align: 'center',
      jitter: true,
      scale: 2,
      shadow: UI.black,
    });

    // The number, once, at the end. Never during the gig (doc 23).
    drawText(r.ctx, `ROOM ${o.energy}`, cx, 70, {
      colour: o.energy >= ENERGY_PASS ? UI.good : UI.danger,
      align: 'center',
      jitter: true,
      scale: 2,
    });

    let y = 100;
    for (const line of this.resultLines) {
      drawText(r.ctx, line, cx, y, { colour: UI.chalk, align: 'center', jitter: true });
      y += 11;
    }

    y += 8;
    drawText(r.ctx, `FEE  ${money(o.payout)}`, cx, y, {
      colour: UI.paper,
      align: 'center',
      jitter: true,
    });
    y += 11;
    if (o.jobPay) {
      drawText(r.ctx, `SIDE JOB  ${money(o.jobPay)}`, cx, y, {
        colour: UI.stickyNote,
        align: 'center',
        jitter: true,
      });
      y += 11;
    }
    if (this.director.bonusesEarned > 0) {
      drawText(r.ctx, `caught ${Math.round(this.director.bonusesEarned)} points back on the night`, cx, y, {
        colour: UI.inkFaint,
        align: 'center',
        jitter: true,
      });
    }
    drawText(r.ctx, 'CLICK TO GO AND SEE BARRY', cx, 250, {
      colour: UI.chalkDim,
      align: 'center',
      jitter: true,
    });
  }

  /** The doc 19 instruments: timeline, live demands, and real output latency. */
  private drawDev(r: Renderer): void {
    r.veil(0, 0, 300, VIEW_H, UI.black, 0.86);
    let y = 4;
    const put = (s: string, c: string = UI.chalkDim) => {
      drawText(r.ctx, s, 4, y, { colour: c });
      y += 8;
    };
    put(`t=${audio.songTime.toFixed(1)} / ${songLength().toFixed(0)}`, UI.lampOn);
    put(`out latency ${(audio.outputLatency * 1000).toFixed(1)}ms`, UI.lampOn);
    put(`energy ${this.director.energy.toFixed(1)}  bonus ${this.director.bonusesEarned}`);
    put(
      `live ${this.director.live.length}  unfired ${this.director.pending.length}/` +
        `${this.director.timeline.length}  spill ${this.director.spill ? 'yes' : 'no'}`,
    );
    put('--- demands ---', UI.good);
    for (const id of this.venue.band) {
      for (const k of this.venue.controls) {
        const d = this.director.demandFor(id, k);
        const s = this.mixer.get(id);
        const cur = k === 'volume' ? s.volume : k === 'tone' ? s.tone : k === 'pan' ? s.pan : s.fx ? 1 : 0;
        const okStr = d.owner ? '*' : ' ';
        put(
          `${okStr}${id.padEnd(6)} ${k.padEnd(6)} ${fmt(cur)} want ${
            k === 'fx' ? String(d.fx) : `${fmt(d.lo)}..${fmt(d.hi)}`
          }`,
        );
      }
    }
    const dm = this.director.demandFor('master', 'master');
    put(`${dm.owner ? '*' : ' '}master        ${fmt(this.mixer.master)} want ${fmt(dm.lo)}..${fmt(dm.hi)}`);
    put('--- timeline ---', UI.good);
    for (const line of describeTimeline(this.director.timeline).slice(0, 14)) put(line.slice(0, 48));
  }
}

function fmt(v: number): string {
  return (v >= 0 ? ' ' : '') + v.toFixed(2);
}

export function money(n: number): string {
  return `£${n}`;
}

export { wrapText };
