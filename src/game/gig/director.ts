import { ENERGY_MAX, ENERGY_START, FADER_NEUTRAL, NEUTRAL_WIDTH, TIER1 } from '../../core/config';
import type { AudioEngine } from '../../core/audio/engine';
import type { MemberId } from '../content/cast';
import { TIER1_EVENTS } from '../content/events';
import type { ControlKind, Venue } from '../content/venues';
import type { SideJob } from '../content/sidejobs';
import { bandAround, Mixer } from './mixer';
import { buildTimeline, type Scheduled } from './scheduler';
import type { EventDef, LiveEvent, Target } from './eventTypes';

export type DemandKind = ControlKind | 'master';

export type ResolvedDemand = {
  kind: DemandKind;
  /** For continuous controls. */
  lo: number;
  hi: number;
  /** For the FX toggle. */
  fx?: boolean;
  /** Null means this is just the neutral rule, so drift rates apply. */
  owner: LiveEvent | null;
};

/** What the stage animates against. Doc 6.2.1: drawn at the cause, never elsewhere. */
export type Visual = {
  key: string;
  target: Target;
  phase: 'setup' | 'payoff';
  /** Seconds since the problem began. Drives the three-beat animation (6.4.4). */
  age: number;
  /** Grace has expired and it is costing energy. Doc 6.2.4. */
  escalated: boolean;
  /** True while the player has not yet met the demand. */
  unresolved: boolean;
};

export type Spill = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 1 = full, 0 = wiped away. */
  wet: number;
  born: number;
  escalated: boolean;
};

export type JobProgress = {
  job: SideJob;
  /** Continuous seconds the demand has been satisfied inside the window. */
  held: number;
  done: boolean;
  failed: boolean;
  /** True while the window is open, which is when the note flashes (doc 16.4). */
  active: boolean;
  cued: boolean;
};

/**
 * The scoring machine.
 *
 * Doc 2.1 is the load-bearing rule: the game never asks whether the mix sounds
 * good, because taste cannot be evaluated in code. What it evaluates is whether
 * every control is where the situation requires, and it does that the same way in
 * both directions -- when a problem lands and when it passes (2.2).
 *
 * So there is exactly one mechanism here. Every control, at every moment, has a
 * required range and a clock. Under an event the clock is short and the drain is
 * steep. With nothing wrong the required range is neutral, the clock is longer and
 * the drain is a nag. Setup beats, payoff beats and the anti-pre-parking rule are
 * all the same code path, which is why none of them can disagree with each other.
 */
export class Director {
  energy = ENERGY_START;
  live: LiveEvent[] = [];
  timeline: Scheduled[];
  spill: Spill | null = null;
  job: JobProgress | null = null;
  finished = false;
  /** Set when the meter hits zero. Doc 7.3: that is the hard fail. */
  wipedOut = false;

  /** Which kind of demand cost the most energy, for the results screen (doc 7.3). */
  blame = new Map<string, number>();
  bonusesEarned = 0;
  /** Doc 14.3: a consumable can buy a window where nothing new fires. */
  quietUntil = -1;

  private clocks = new Map<string, number>();
  /** Beats not yet fired. Should be empty by the end of the song (doc 8.2). */
  pending: Scheduled[];
  private time = 0;

  constructor(
    private venue: Venue,
    private mixer: Mixer,
    private audio: AudioEngine,
    seed: number,
    job: SideJob | null,
  ) {
    this.timeline = buildTimeline(venue, seed);
    this.pending = [...this.timeline];
    if (job && job.venueId === venue.id) {
      this.job = { job, held: 0, done: false, failed: false, active: false, cued: false };
    }
  }

  get songTime(): number {
    return this.time;
  }

  // ---------------------------------------------------------------- demand lookup

  neutralRange(id: MemberId, kind: ControlKind): { lo: number; hi: number; fx?: boolean } {
    const n = this.mixer.neutralFor(id);
    if (kind === 'volume')
      return { lo: n.volume - NEUTRAL_WIDTH.volume, hi: n.volume + NEUTRAL_WIDTH.volume };
    if (kind === 'tone') return { lo: -NEUTRAL_WIDTH.tone, hi: NEUTRAL_WIDTH.tone };
    if (kind === 'pan') return { lo: -NEUTRAL_WIDTH.pan, hi: NEUTRAL_WIDTH.pan };
    return { lo: 0, hi: 1, fx: n.fx };
  }

  /** The one function that decides what any control is supposed to be doing. */
  demandFor(target: Target, kind: DemandKind): ResolvedDemand {
    if (target === 'master') {
      const owner = this.live.find(
        (e) => e.def.target === 'master' && e.phase !== 'done' && e.def.demand.master,
      );
      if (owner && owner.phase === 'setup') {
        const [lo, hi] = owner.def.demand.master!;
        return { kind: 'master', lo, hi, owner };
      }
      const [lo, hi] = bandAround(FADER_NEUTRAL, NEUTRAL_WIDTH.volume, 0, 1);
      return { kind: 'master', lo, hi, owner: owner ?? null };
    }

    const id = target as MemberId;
    const ck = kind as ControlKind;
    const owner = this.live.find(
      (e) => e.def.target === id && e.phase !== 'done' && demandsKind(e.def, ck),
    );
    if (owner && owner.phase === 'setup') return this.eventDemand(owner, ck);
    const n = this.neutralRange(id, ck);
    return { kind: ck, lo: n.lo, hi: n.hi, fx: n.fx, owner: owner ?? null };
  }

  private eventDemand(e: LiveEvent, kind: ControlKind): ResolvedDemand {
    const id = e.def.target as MemberId;
    const d = e.def.demand;
    if (kind === 'fx') return { kind, lo: 0, hi: 1, fx: d.fx, owner: e };
    if (kind === 'volume') {
      if (d.volume === 'compensate') {
        const target = this.mixer.compensatedVolume(e.def.world.sourceGain ?? 1);
        const [lo, hi] = bandAround(target, NEUTRAL_WIDTH.volume, 0, 1);
        return { kind, lo, hi, owner: e };
      }
      const [lo, hi] = d.volume as [number, number];
      return { kind, lo, hi, owner: e };
    }
    if (kind === 'tone') {
      if (d.tone === 'compensate') {
        const target = this.mixer.compensatedTone(e.def.world);
        const [lo, hi] = bandAround(target, NEUTRAL_WIDTH.tone, -1, 1);
        return { kind, lo, hi, owner: e };
      }
      const [lo, hi] = d.tone as [number, number];
      return { kind, lo, hi, owner: e };
    }
    const n = this.neutralRange(id, kind);
    return { kind, lo: n.lo, hi: n.hi, fx: n.fx, owner: e };
  }

  private met(target: Target, kind: DemandKind, d: ResolvedDemand): boolean {
    if (target === 'master') return this.mixer.master >= d.lo && this.mixer.master <= d.hi;
    const s = this.mixer.get(target as MemberId);
    if (!s) return true;
    if (kind === 'fx') return s.fx === (d.fx ?? false);
    const v = kind === 'volume' ? s.volume : kind === 'tone' ? s.tone : s.pan;
    return v >= d.lo && v <= d.hi;
  }

  // -------------------------------------------------------------------- main loop

  update(dt: number, songTime: number): void {
    this.time = songTime;
    this.startDue(songTime);
    this.advancePhases(songTime);
    this.scoreControls(dt);
    this.scoreSpill(dt, songTime);
    this.trackJob(dt, songTime);

    if (this.energy <= 0) {
      this.energy = 0;
      this.wipedOut = true;
      this.finished = true;
    }
    if (this.energy > ENERGY_MAX) this.energy = ENERGY_MAX;
  }

  private startDue(songTime: number): void {
    while (this.pending.length && this.pending[0].at <= songTime) {
      const next = this.pending[0];
      // Rule 5: never two problems at once on one instrument. If the channel is
      // still occupied, or a consumable has bought quiet, shove this beat later
      // rather than dropping it.
      const busy = this.live.some((e) => e.def.target === next.def.target && e.phase !== 'done');
      if (busy || songTime < this.quietUntil) {
        next.at = songTime + 1;
        this.pending.sort((a, b) => a.at - b.at);
        if (this.pending[0] !== next) continue;
        return;
      }
      this.pending.shift();
      this.begin(next.def, songTime);
    }
  }

  private begin(def: EventDef, songTime: number): void {
    const e: LiveEvent = {
      def,
      phase: 'setup',
      phaseStart: songTime,
      unmet: 0,
      escalated: false,
      claimed: false,
      bornAt: songTime,
      cost: 0,
    };
    this.live.push(e);
    if (def.target !== 'master') {
      this.mixer.applyWorld(def.target as MemberId, def.world);
      if (def.world.inject) {
        this.audio.playInject(`ev-${def.id}`, def.target, def.world.inject.file, {
          loop: true,
          gain: def.world.inject.gain,
        });
      }
    }
    if (def.world.oneShot) {
      const ch = def.world.oneShot.channel ?? (def.target === 'master' ? null : def.target);
      this.audio.playInject(`os-${def.id}-${songTime.toFixed(1)}`, ch as MemberId | null, def.world.oneShot.file, {
        gain: def.world.oneShot.gain,
      });
    }
    if (def.world.rackRunaway) this.audio.rack.setRunaway(1, def.duration * 0.55);
  }

  private advancePhases(songTime: number): void {
    for (const e of this.live) {
      if (e.phase === 'setup' && songTime - e.phaseStart >= e.def.duration) {
        // The payoff beat. The world puts itself back and the board must follow.
        if (e.def.target !== 'master') this.mixer.applyWorld(e.def.target as MemberId, null);
        if (e.def.world.inject) this.audio.stopInject(`ev-${e.def.id}`);
        if (e.def.world.rackRunaway) this.audio.rack.setRunaway(0, 1.4);
        e.phase = 'payoff';
        e.phaseStart = songTime;
        e.claimed = false;
        e.escalated = false;
        e.unmet = 0;
      }
    }
    this.live = this.live.filter((e) => e.phase !== 'done');
  }

  private scoreControls(dt: number): void {
    const targets: { target: Target; kinds: DemandKind[] }[] = this.venue.band.map((id) => ({
      target: id as Target,
      kinds: this.venue.controls as DemandKind[],
    }));
    targets.push({ target: 'master', kinds: ['master'] });

    for (const { target, kinds } of targets) {
      for (const kind of kinds) {
        const d = this.demandFor(target, kind);
        const key = `${target}:${kind}`;
        const met = this.met(target, kind, d);
        const prev = this.clocks.get(key) ?? 0;
        const isEvent = d.owner !== null;
        const grace = isEvent ? TIER1.gracePeriod : TIER1.driftGrace;

        if (met) {
          if (prev > 0 && isEvent && d.owner && !d.owner.claimed && prev <= grace) {
            // Doc 7.2: the speed bonus. Capped by the ceiling of 100, so on a clean
            // run it does nothing and on a bad one it is the way back.
            const bonus = d.owner.phase === 'setup' ? TIER1.speedBonus : TIER1.payoffBonus;
            // Doc 7.2: capped by the ceiling of 100, which gives the bonus a clean
            // role -- it does nothing on a perfect run and is the way back on a bad
            // one. Only what actually landed is reported afterwards.
            const landed = Math.min(bonus, ENERGY_MAX - this.energy);
            this.energy += landed;
            this.bonusesEarned += landed;
            d.owner.claimed = true;
          }
          this.clocks.set(key, 0);
          if (d.owner && d.owner.phase === 'payoff') d.owner.phase = 'done';
          continue;
        }

        const now = prev + dt;
        this.clocks.set(key, now);
        if (now <= grace) continue;

        let rate: number;
        let blameKey: string;
        if (isEvent) {
          rate = TIER1.drainPerSecond;
          blameKey = d.owner!.def.expect;
          d.owner!.escalated = true;
          d.owner!.cost += rate * dt;
        } else {
          // Doc 2.2 / 12.2: a channel parked off neutral with nothing wrong is a
          // nag, not a failure. It scales with how far off it is, so a fader left
          // slightly high is a slow leak and a desk with everything slammed to the
          // top is a real cost -- which is what makes a sabotage side job a
          // decision rather than a free forty pounds.
          const excess =
            target === 'master'
              ? outsideBy(this.mixer.master, d.lo, d.hi)
              : this.mixer.driftExcess(target as MemberId, kind as ControlKind);
          rate = TIER1.driftDrainPerSecond * (1 + 4 * excess);
          blameKey = 'drift';
        }
        this.energy -= rate * dt;
        this.blame.set(blameKey, (this.blame.get(blameKey) ?? 0) + rate * dt);
      }
    }
  }

  // ------------------------------------------------------------------ interference

  /** Doc 9.4: one active interference at a time. Ever. At every tier. */
  spawnSpill(x: number, y: number, songTime: number): void {
    if (this.spill) return;
    this.spill = { x, y, w: 46, h: 30, wet: 1, born: songTime, escalated: false };
    this.audio.playInject('spill', null, 'sfx/beer-spill.mp3', { gain: 0.8 });
  }

  private scoreSpill(dt: number, songTime: number): void {
    const s = this.spill;
    if (!s) return;
    const age = songTime - s.born;
    if (age <= TIER1.gracePeriod) return;
    s.escalated = true;
    const rate = TIER1.drainPerSecond * 0.8;
    this.energy -= rate * dt;
    this.blame.set('board', (this.blame.get('board') ?? 0) + rate * dt);
  }

  /** Doc 9.4.3: clearing it must have an obvious affordance. Wipe across it. */
  wipe(amount: number): void {
    if (!this.spill) return;
    this.spill.wet -= amount;
    if (this.spill.wet <= 0) {
      this.spill = null;
      this.energy = Math.min(ENERGY_MAX, this.energy + 2);
    }
  }

  spillCovers(x: number, y: number, w: number, h: number): boolean {
    const s = this.spill;
    if (!s) return false;
    return x < s.x + s.w && x + w > s.x && y < s.y + s.h && y + h > s.y;
  }

  // --------------------------------------------------------------------- side job

  private trackJob(dt: number, songTime: number): void {
    const p = this.job;
    if (!p || p.done || p.failed) return;
    if (p.job.kind === 'score') return;
    const open = songTime >= p.job.at && songTime <= p.job.at + p.job.hold + 5;
    p.active = open;
    if (!open) {
      if (songTime > p.job.at + p.job.hold + 5) p.failed = true;
      return;
    }
    const channels =
      p.job.channels === 'all' ? this.venue.band : (p.job.channels as MemberId[]);
    let ok = true;
    for (const id of channels) {
      const s = this.mixer.get(id);
      if (!s) continue;
      if (p.job.demand.volume) {
        const [lo, hi] = p.job.demand.volume;
        if (s.volume < lo || s.volume > hi) ok = false;
      }
      if (p.job.demand.tone) {
        const [lo, hi] = p.job.demand.tone;
        if (s.tone < lo || s.tone > hi) ok = false;
      }
    }
    p.held = ok ? p.held + dt : 0;
    if (p.held >= p.job.hold) p.done = true;
  }

  /** Called at the end of a gig for jobs judged on the final number. */
  settleJob(): void {
    const p = this.job;
    if (!p || p.job.kind !== 'score') return;
    if (this.energy >= p.job.target) p.done = true;
    else p.failed = true;
  }

  // ---------------------------------------------------------------------- visuals

  visuals(): Visual[] {
    const out: Visual[] = [];
    for (const e of this.live) {
      if (e.phase === 'done') continue;
      const unresolved = !this.eventSatisfied(e);
      out.push({
        key: e.def.visual,
        target: e.def.target,
        phase: e.phase,
        age: this.time - e.bornAt,
        escalated: e.escalated,
        unresolved,
      });
    }
    return out;
  }

  private eventSatisfied(e: LiveEvent): boolean {
    for (const kind of demandedKinds(e.def)) {
      const d = this.demandFor(e.def.target, kind);
      if (d.owner !== e) continue;
      if (!this.met(e.def.target, kind, d)) return false;
    }
    return true;
  }

  /** Doc 14.3: gaffer tape kills one problem outright, whatever it is. */
  clearOneProblem(): boolean {
    if (this.spill) {
      this.spill = null;
      return true;
    }
    const worst = this.live
      .filter((e) => e.phase === 'setup')
      .sort((a, b) => b.def.intensity - a.def.intensity)[0];
    if (!worst) return false;
    if (worst.def.target !== 'master') this.mixer.applyWorld(worst.def.target as MemberId, null);
    if (worst.def.world.inject) this.audio.stopInject(`ev-${worst.def.id}`);
    if (worst.def.world.rackRunaway) this.audio.rack.setRunaway(0, 0.4);
    worst.phase = 'payoff';
    worst.phaseStart = this.time;
    worst.claimed = true;
    worst.escalated = false;
    return true;
  }

  addEnergy(n: number): void {
    this.energy = Math.min(ENERGY_MAX, this.energy + n);
  }

  /** Stop everything the world is doing. Called when a gig ends for any reason. */
  teardown(): void {
    for (const e of this.live) {
      if (e.def.target !== 'master') this.mixer.applyWorld(e.def.target as MemberId, null);
      if (e.def.world.inject) this.audio.stopInject(`ev-${e.def.id}`);
    }
    this.audio.rack.setRunaway(0, 0.2);
    this.live = [];
  }

  get worstBlame(): string {
    let best = 'none';
    let most = 0.8;
    for (const [k, v] of this.blame) {
      if (v > most) {
        most = v;
        best = k;
      }
    }
    return best;
  }
}

/** How far outside a range a value sits, normalised to 0..1. */
function outsideBy(v: number, lo: number, hi: number): number {
  const d = v < lo ? lo - v : v > hi ? v - hi : 0;
  return Math.min(1, d / Math.max(0.0001, Math.max(lo, 1 - hi) + 0.0001));
}

function demandsKind(def: EventDef, kind: ControlKind): boolean {
  if (kind === 'volume') return def.demand.volume !== undefined;
  if (kind === 'tone') return def.demand.tone !== undefined;
  if (kind === 'fx') return def.demand.fx !== undefined;
  return false;
}

function demandedKinds(def: EventDef): DemandKind[] {
  const out: DemandKind[] = [];
  if (def.demand.volume !== undefined) out.push('volume');
  if (def.demand.tone !== undefined) out.push('tone');
  if (def.demand.fx !== undefined) out.push('fx');
  if (def.demand.master !== undefined) out.push('master');
  return out;
}

export { TIER1_EVENTS };
