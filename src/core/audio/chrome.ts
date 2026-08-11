/**
 * Game chrome audio (doc 18.4): menus, stings, score screens, the little noises the
 * desk makes. Synthesised rather than recorded, and deliberately cheap and MIDI-ish
 * in the Roland SC-55 register, because the contrast against real recorded stems is
 * what keeps the game world and the mixing task audibly separate.
 *
 * Nothing in here ever plays through a channel strip. Chrome is not part of the mix.
 */
export class Chrome {
  private bus: GainNode;

  constructor(
    private ctx: AudioContext,
    destination: AudioNode,
  ) {
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.5;
    this.bus.connect(destination);
  }

  private tone(
    freq: number,
    dur: number,
    opts: {
      type?: OscillatorType;
      gain?: number;
      delay?: number;
      sweepTo?: number;
      attack?: number;
      detune?: number;
    } = {},
  ): void {
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const osc = this.ctx.createOscillator();
    osc.type = opts.type ?? 'square';
    if (opts.detune) osc.detune.value = opts.detune;
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.sweepTo) osc.frequency.exponentialRampToValueAtTime(opts.sweepTo, t0 + dur);
    const g = this.ctx.createGain();
    const peak = opts.gain ?? 0.2;
    const atk = opts.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.bus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(
    dur: number,
    opts: { gain?: number; delay?: number; hp?: number; lp?: number; sweep?: number } = {},
  ): void {
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = opts.hp ?? 400;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(opts.lp ?? 7000, t0);
    if (opts.sweep) lp.frequency.exponentialRampToValueAtTime(opts.sweep, t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(opts.gain ?? 0.18, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(hp);
    hp.connect(lp);
    lp.connect(g);
    g.connect(this.bus);
    src.start(t0);
  }

  /** Generic pointer click on anything clickable. */
  blip(): void {
    this.tone(880, 0.05, { type: 'square', gain: 0.1 });
  }

  /** A control being grabbed. */
  grab(): void {
    this.tone(320, 0.04, { type: 'triangle', gain: 0.12 });
  }

  /** Passing through a control's neutral range. Teaches "home" by feel (doc 2.2). */
  detent(): void {
    this.tone(1500, 0.028, { type: 'square', gain: 0.05 });
  }

  /** A toggle switch on the desk. */
  toggle(on: boolean): void {
    this.tone(on ? 620 : 420, 0.05, { type: 'square', gain: 0.13 });
    this.noise(0.03, { gain: 0.08, hp: 2200 });
  }

  confirm(): void {
    this.tone(523, 0.09, { type: 'square', gain: 0.13 });
    this.tone(784, 0.14, { type: 'square', gain: 0.12, delay: 0.06 });
  }

  cancel(): void {
    this.tone(360, 0.09, { type: 'square', gain: 0.12 });
    this.tone(240, 0.14, { type: 'square', gain: 0.1, delay: 0.06 });
  }

  /** The manager's computer swivelling round to face you (doc 13.3). */
  crtSwivel(): void {
    this.noise(0.42, { gain: 0.1, hp: 180, lp: 1400, sweep: 500 });
    this.tone(70, 0.4, { type: 'sawtooth', gain: 0.06, sweepTo: 140 });
  }

  purchase(): void {
    this.tone(1046, 0.07, { type: 'square', gain: 0.14 });
    this.tone(1318, 0.08, { type: 'square', gain: 0.13, delay: 0.05 });
    this.tone(1568, 0.22, { type: 'square', gain: 0.14, delay: 0.1 });
    this.noise(0.06, { gain: 0.08, hp: 3000 });
  }

  denied(): void {
    this.tone(196, 0.22, { type: 'sawtooth', gain: 0.13 });
    this.tone(185, 0.26, { type: 'sawtooth', gain: 0.11, delay: 0.02 });
  }

  /** The answering machine (doc 16.1). */
  machineBeep(): void {
    this.tone(1000, 0.16, { type: 'sine', gain: 0.15 });
  }

  /** Grace has just run out on something. One tick, then the stage takes over. */
  graceTick(): void {
    this.tone(1760, 0.05, { type: 'square', gain: 0.09 });
    this.tone(1244, 0.07, { type: 'square', gain: 0.08, delay: 0.05 });
  }

  /** A side job's moment has arrived and the sticky note is flashing (doc 16.4). */
  jobCue(): void {
    this.tone(1318, 0.08, { type: 'triangle', gain: 0.14 });
    this.tone(1760, 0.1, { type: 'triangle', gain: 0.13, delay: 0.07 });
    this.tone(1318, 0.12, { type: 'triangle', gain: 0.12, delay: 0.16 });
  }

  /** Wiping the desk (doc 9.1). */
  wipe(): void {
    this.noise(0.13, { gain: 0.1, hp: 900, lp: 5200, sweep: 1600 });
  }

  stingPass(): void {
    const notes = [392, 494, 587, 784];
    notes.forEach((n, i) => this.tone(n, 0.34, { type: 'square', gain: 0.13, delay: i * 0.11 }));
  }

  stingPerfect(): void {
    const notes = [523, 659, 784, 1046, 1318];
    notes.forEach((n, i) => this.tone(n, 0.4, { type: 'square', gain: 0.13, delay: i * 0.085 }));
  }

  stingFail(): void {
    const notes = [330, 311, 294, 220];
    notes.forEach((n, i) =>
      this.tone(n, 0.42, { type: 'sawtooth', gain: 0.12, delay: i * 0.14 }),
    );
  }

  /** Title screen flourish. Deliberately too pleased with itself. */
  fanfare(): void {
    const notes = [262, 330, 392, 523, 392, 523, 659];
    notes.forEach((n, i) => this.tone(n, 0.3, { type: 'square', gain: 0.11, delay: i * 0.1 }));
    this.tone(131, 0.9, { type: 'triangle', gain: 0.09, delay: 0.6 });
  }
}
