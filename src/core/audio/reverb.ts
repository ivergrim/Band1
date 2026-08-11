/**
 * The board's effects rack (doc 5.2: "the console's effects rack, not the band's
 * pedals, which the player cannot touch").
 *
 * A plate-ish reverb built from a generated impulse, plus a separate feedback delay
 * line that exists so the rack can genuinely run away into a rising howl when an
 * event tells it to (doc 8.8, "Resolved with FX"). The howl is real feedback, not a
 * recording of feedback, which means the FX toggle actually stops it.
 */
export class FxRack {
  readonly input: GainNode;
  readonly output: GainNode;
  private convolver: ConvolverNode;
  private tone: BiquadFilterNode;
  private runawayDelay: DelayNode;
  private runawayFeedback: GainNode;
  private runawayTilt: BiquadFilterNode;

  constructor(private ctx: AudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.output.gain.value = 0.9;

    this.convolver = ctx.createConvolver();
    this.convolver.buffer = buildImpulse(ctx, 1.7, 2.6);

    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.frequency.value = 5200;

    // Feedback path. Delay time is deliberately short so the runaway rings rather
    // than repeats; the tilt filter is what makes it climb toward a howl.
    this.runawayDelay = ctx.createDelay(1.0);
    this.runawayDelay.delayTime.value = 0.11;
    this.runawayFeedback = ctx.createGain();
    this.runawayFeedback.gain.value = 0;
    this.runawayTilt = ctx.createBiquadFilter();
    this.runawayTilt.type = 'peaking';
    this.runawayTilt.frequency.value = 1750;
    this.runawayTilt.Q.value = 3.2;
    this.runawayTilt.gain.value = 9;

    this.input.connect(this.convolver);
    this.convolver.connect(this.tone);
    this.tone.connect(this.output);

    this.input.connect(this.runawayDelay);
    this.runawayDelay.connect(this.runawayTilt);
    this.runawayTilt.connect(this.runawayFeedback);
    this.runawayFeedback.connect(this.runawayDelay);
    this.runawayFeedback.connect(this.convolver);
  }

  /** 0 = behaving, 1 = climbing into a howl. */
  setRunaway(amount: number, seconds = 0.6): void {
    const t = this.ctx.currentTime;
    const g = this.runawayFeedback.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(Math.min(0.93, amount * 0.93), t + seconds);
  }

  /** Detune the delay so it audibly fights the song's tempo (doc 8.8). */
  setDelayTime(seconds: number): void {
    this.runawayDelay.delayTime.setTargetAtTime(seconds, this.ctx.currentTime, 0.05);
  }
}

/**
 * Exponentially decaying noise burst with a short pre-delay and a slow attack, so
 * it reads as a room rather than as a gate. Generated rather than shipped, because
 * a 300KB impulse file is a lot of download for a garage.
 */
function buildImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  const preDelay = Math.floor(rate * 0.012);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      if (i < preDelay) {
        data[i] = 0;
        continue;
      }
      const t = (i - preDelay) / (len - preDelay);
      // One-pole lowpass on the noise keeps the tail from sounding like static.
      const noise = Math.random() * 2 - 1;
      last = last * 0.72 + noise * 0.28;
      const build = Math.min(1, t * 26);
      data[i] = last * build * Math.pow(1 - t, decay);
    }
  }
  return buf;
}
