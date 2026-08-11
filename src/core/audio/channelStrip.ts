import { AUDIO_RAMP } from '../config';
import type { FxRack } from './reverb';

/**
 * One person, one channel (rule 16).
 *
 * The signal path is the design doc's 8.1b made literal. Left to right:
 *
 *   source  -> sourceGain -> eventLow -> eventHigh -> tiltLow -> tiltHigh
 *           -> fader -> panner -> dry out
 *                              \-> send -> board FX rack
 *
 * `sourceGain`, `eventLow` and `eventHigh` are the *world*: a dog on a boost pedal,
 * a jacket over a cabinet, a guitarist turning his own amp down. The player cannot
 * see or touch them. `tilt`, `fader`, `panner` and `send` are the board.
 *
 * That split is the whole reason the fix works. When an event drapes a coat over a
 * cabinet it really does put a lowpass on the signal, and when the player turns the
 * tone knob toward treble a real high shelf really does undo it. Nothing here is
 * faked or scripted, which is what doc 18.1 is asking for.
 */
export class ChannelStrip {
  readonly id: string;
  /** Everything that plays into this channel connects here, event audio included. */
  readonly input: GainNode;

  private sourceGain: GainNode;
  private eventLow: BiquadFilterNode;
  private eventHigh: BiquadFilterNode;
  private tiltLow: BiquadFilterNode;
  private tiltHigh: BiquadFilterNode;
  private fader: GainNode;
  private panner: StereoPannerNode;
  private send: GainNode;
  private soloDuck: GainNode;

  /** Player-facing state, 0..1 for volume, -1..1 for tone and pan. */
  volume = 0;
  tone = 0;
  pan = 0;
  fx = false;

  constructor(
    private ctx: AudioContext,
    id: string,
    destination: AudioNode,
    fx: FxRack,
  ) {
    this.id = id;
    this.input = ctx.createGain();
    this.sourceGain = ctx.createGain();
    this.eventLow = ctx.createBiquadFilter();
    this.eventLow.type = 'lowpass';
    this.eventLow.frequency.value = 20000;
    this.eventLow.Q.value = 0.4;
    this.eventHigh = ctx.createBiquadFilter();
    this.eventHigh.type = 'highpass';
    this.eventHigh.frequency.value = 20;
    this.eventHigh.Q.value = 0.4;

    this.tiltLow = ctx.createBiquadFilter();
    this.tiltLow.type = 'lowshelf';
    this.tiltLow.frequency.value = 320;
    this.tiltHigh = ctx.createBiquadFilter();
    this.tiltHigh.type = 'highshelf';
    this.tiltHigh.frequency.value = 2400;

    this.fader = ctx.createGain();
    this.panner = ctx.createStereoPanner();
    this.send = ctx.createGain();
    this.send.gain.value = 0;
    this.soloDuck = ctx.createGain();

    this.input.connect(this.sourceGain);
    this.sourceGain.connect(this.eventLow);
    this.eventLow.connect(this.eventHigh);
    this.eventHigh.connect(this.tiltLow);
    this.tiltLow.connect(this.tiltHigh);
    this.tiltHigh.connect(this.fader);
    this.fader.connect(this.panner);
    this.panner.connect(this.soloDuck);
    this.soloDuck.connect(destination);
    // The send is post-fader, as on any real console: pulling a channel down takes
    // its reverb with it, which is what makes the multi-step FX fix in doc 8.6 work.
    this.panner.connect(this.send);
    this.send.connect(fx.input);
  }

  /** Player moved the fader. `v` is 0..1 of travel. */
  setVolume(v: number): void {
    this.volume = v;
    // Fader law: roughly quartic so the bottom of the travel is usably fine and
    // the top has headroom to be too loud. Neutral (0.72) lands near unity.
    const g = Math.pow(v, 2.2) * 2.05;
    this.fader.gain.setTargetAtTime(g, this.ctx.currentTime, AUDIO_RAMP * 0.4);
  }

  /**
   * One knob, bassy at one end and bright at the other (doc 5.2). Implemented as a
   * tilt: the two shelves always move in opposite directions, so the knob changes
   * balance rather than overall level, and the range is exaggerated well past real
   * practice because legibility beats realism (rule 12).
   */
  setTone(t: number): void {
    this.tone = t;
    const now = this.ctx.currentTime;
    const bright = Math.max(0, t);
    const fat = Math.max(0, -t);
    const highDb = bright * 13 - fat * 11;
    const lowDb = fat * 13 - bright * 9;
    this.tiltHigh.gain.setTargetAtTime(highDb, now, AUDIO_RAMP);
    this.tiltLow.gain.setTargetAtTime(lowDb, now, AUDIO_RAMP);
  }

  setPan(p: number): void {
    this.pan = p;
    const now = this.ctx.currentTime;
    this.panner.pan.setTargetAtTime(p, now, AUDIO_RAMP);
  }

  setFx(on: boolean): void {
    this.fx = on;
    this.send.gain.setTargetAtTime(on ? 0.62 : 0, this.ctx.currentTime, AUDIO_RAMP);
  }

  /** World side: the source itself got louder or quieter. Invisible to the player. */
  setSourceGain(g: number, seconds = AUDIO_RAMP * 3): void {
    const now = this.ctx.currentTime;
    const p = this.sourceGain.gain;
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.linearRampToValueAtTime(Math.max(0, g), now + seconds);
  }

  /**
   * World side: something is muffling the source. `hz` of 20000 is nothing over it.
   * Covering and muffling lose treble first, which is what makes "brighten it" the
   * physically correct fix (doc 8.8).
   */
  setSourceMuffle(hz: number, seconds = 0.25): void {
    const now = this.ctx.currentTime;
    const p = this.eventLow.frequency;
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.exponentialRampToValueAtTime(Math.max(120, hz), now + seconds);
  }

  /** World side: the source lost its bottom end. A borrowed DI, a mic off-axis. */
  setSourceThin(hz: number, seconds = 0.25): void {
    const now = this.ctx.currentTime;
    const p = this.eventHigh.frequency;
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.exponentialRampToValueAtTime(Math.max(20, hz), now + seconds);
  }

  /** Solo sends one channel to the house, so everything else drops (doc 5.3). */
  setSoloDuck(amount: number): void {
    this.soloDuck.gain.setTargetAtTime(amount, this.ctx.currentTime, 0.05);
  }

  get sourceNode(): AudioNode {
    return this.input;
  }
}
