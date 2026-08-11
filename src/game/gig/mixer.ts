import { FADER_NEUTRAL, NEUTRAL_WIDTH } from '../../core/config';
import type { AudioEngine } from '../../core/audio/engine';
import type { MemberId } from '../content/cast';
import type { ControlKind, Venue } from '../content/venues';
import type { WorldEffect } from './eventTypes';

export type ChannelSnapshot = { volume: number; tone: number; pan: number; fx: boolean };

/** Fader law, kept in one place so the derived demands cannot drift from the audio. */
export const faderGain = (v: number): number => Math.pow(Math.max(0, v), 2.2) * 2.05;
export const faderFor = (g: number): number =>
  Math.min(1, Math.max(0, Math.pow(Math.max(0, g) / 2.05, 1 / 2.2)));
export const NEUTRAL_GAIN = faderGain(FADER_NEUTRAL);

/**
 * The board's state, and the only thing that writes to the audio graph.
 *
 * Two halves, kept strictly apart because doc 8.1b depends on the distinction:
 * `channels` is what the player has done, `world` is what has happened to the band.
 * The player can see and touch the first and neither see nor touch the second.
 */
export class Mixer {
  readonly channels = new Map<MemberId, ChannelSnapshot>();
  master = FADER_NEUTRAL;
  private world = new Map<MemberId, WorldEffect>();
  private venue: Venue;

  constructor(
    venue: Venue,
    private audio: AudioEngine,
  ) {
    this.venue = venue;
    for (const id of venue.band) {
      const n = this.neutralFor(id);
      this.channels.set(id, { ...n });
    }
  }

  /** Doc 2.2: every channel has a neutral resting position. This is it. */
  neutralFor(id: MemberId): ChannelSnapshot {
    return {
      volume: FADER_NEUTRAL,
      tone: 0,
      pan: 0,
      fx: this.venue.fxOnAtNeutral.includes(id),
    };
  }

  /** Push the whole current state at the audio graph. Called once after setup. */
  flush(): void {
    for (const [id, s] of this.channels) {
      const strip = this.audio.channel(id);
      strip.setVolume(s.volume);
      strip.setTone(s.tone);
      strip.setPan(s.pan);
      strip.setFx(s.fx);
    }
    this.audio.setMaster(this.master);
  }

  get(id: MemberId): ChannelSnapshot {
    return this.channels.get(id)!;
  }

  set(id: MemberId, kind: ControlKind, value: number | boolean): void {
    const s = this.channels.get(id);
    if (!s) return;
    const strip = this.audio.channel(id);
    switch (kind) {
      case 'volume':
        s.volume = clamp01(value as number);
        strip.setVolume(s.volume);
        break;
      case 'tone':
        s.tone = clampBi(value as number);
        strip.setTone(s.tone);
        break;
      case 'pan':
        s.pan = clampBi(value as number);
        strip.setPan(s.pan);
        break;
      case 'fx':
        s.fx = value as boolean;
        strip.setFx(s.fx);
        break;
    }
  }

  setMaster(v: number): void {
    this.master = clamp01(v);
    this.audio.setMaster(this.master);
  }

  /** World side. At most one per channel, because of rule 5. */
  applyWorld(id: MemberId, w: WorldEffect | null): void {
    const strip = this.audio.channel(id);
    if (!w) {
      this.world.delete(id);
      strip.setSourceGain(1);
      strip.setSourceMuffle(20000);
      strip.setSourceThin(20);
      return;
    }
    this.world.set(id, w);
    strip.setSourceGain(w.sourceGain ?? 1);
    strip.setSourceMuffle(w.muffleHz ?? 20000);
    strip.setSourceThin(w.thinHz ?? 20);
  }

  worldOn(id: MemberId): WorldEffect | undefined {
    return this.world.get(id);
  }

  /**
   * The correct fader position given what the world has done to the source.
   *
   * This is why events declare physics rather than declaring a target: the demand
   * falls out of the fader law, so doc 8.1b's "is the direction physically correct"
   * cannot be got wrong by an author, and retuning the fader law cannot silently
   * break twenty events.
   */
  compensatedVolume(sourceGain: number): number {
    return faderFor(NEUTRAL_GAIN / Math.max(0.02, sourceGain));
  }

  /**
   * The correct tone position given what is over the source.
   *
   * Covering and muffling lose treble first, so covering asks for treble. A source
   * that lost its bottom end asks for bass. Both directions are the real ones, which
   * is the entire lesson in doc 2.7 and it never needs stating.
   */
  compensatedTone(w: WorldEffect): number {
    if (w.muffleHz && w.muffleHz < 6000) {
      const sev = clamp01((3200 - w.muffleHz) / 2600);
      return 0.32 + 0.55 * sev;
    }
    if (w.thinHz && w.thinHz > 90) {
      const sev = clamp01((w.thinHz - 80) / 420);
      return -(0.32 + 0.55 * sev);
    }
    return 0;
  }

  /** How far outside its neutral band a control is sitting, 0..1. */
  driftExcess(id: MemberId, kind: ControlKind): number {
    const s = this.channels.get(id);
    if (!s) return 0;
    const n = this.neutralFor(id);
    if (kind === 'volume') return excess(s.volume, n.volume, NEUTRAL_WIDTH.volume, 1);
    if (kind === 'tone') return excess(s.tone, n.tone, NEUTRAL_WIDTH.tone, 1);
    if (kind === 'pan') return excess(s.pan, n.pan, NEUTRAL_WIDTH.pan, 1);
    return s.fx === n.fx ? 0 : 1;
  }
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function clampBi(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}

function excess(value: number, centre: number, halfWidth: number, span: number): number {
  const d = Math.abs(value - centre) - halfWidth;
  return d <= 0 ? 0 : clamp01(d / Math.max(0.0001, span - halfWidth));
}

/**
 * Build a demanded range of fixed width around a target, nudged inside 0..1 so the
 * range never collapses at the ends of the travel. A demand the player physically
 * cannot satisfy would be unfair, and at the extremes of the fader it is easy to
 * write one by accident.
 */
export function bandAround(target: number, halfWidth: number, lo: number, hi: number): [number, number] {
  let a = target - halfWidth;
  let b = target + halfWidth;
  if (a < lo) {
    b += lo - a;
    a = lo;
  }
  if (b > hi) {
    a -= b - hi;
    b = hi;
  }
  return [Math.max(lo, a), Math.min(hi, b)];
}
