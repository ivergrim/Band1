import { AUDIO_RAMP } from '../config';
import { ChannelStrip } from './channelStrip';
import { FxRack } from './reverb';
import { Chrome } from './chrome';

export type StemDef = { channel: string; file: string };
export type SongDef = {
  id: string;
  bpm: number;
  /** Bars per section, in order. Section names are the anchor points for events. */
  sections: { name: string; bars: number }[];
  beatsPerBar: number;
  stems: StemDef[];
};

type Loaded = { def: SongDef; buffers: Map<string, AudioBuffer> };

/**
 * The player is mixing real stems with real processing (doc 18.1). Everything that
 * comes out of the band is a recorded file running through the graph in
 * ChannelStrip; everything that is game chrome is synthesised (doc 18.4), which
 * keeps the two worlds audibly separate for free.
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  chrome: Chrome | null = null;
  private masterFader: GainNode | null = null;
  private outGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private fx: FxRack | null = null;
  private house: GainNode | null = null;
  private houseSource: AudioBufferSourceNode | null = null;

  private strips = new Map<string, ChannelStrip>();
  private cache = new Map<string, AudioBuffer>();
  private song: Loaded | null = null;
  private playing: AudioBufferSourceNode[] = [];
  private injections = new Map<string, AudioBufferSourceNode>();
  private startAt = 0;
  private started = false;
  private paused = false;
  private pausedAt = 0;

  masterVolume = 0.8;

  get ready(): boolean {
    return this.ctx !== null;
  }

  /** Must be called from a user gesture. */
  async init(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor({ latencyHint: 'interactive' });
    this.ctx = ctx;

    this.outGain = ctx.createGain();
    this.outGain.gain.value = this.masterVolume;
    this.limiter = ctx.createDynamicsCompressor();
    // A real front-of-house limiter, set so the player can push a channel into
    // "too loud" and hear it get ugly without it actually clipping the output.
    this.limiter.threshold.value = -7;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 9;
    this.limiter.attack.value = 0.004;
    this.limiter.release.value = 0.16;

    this.masterFader = ctx.createGain();
    this.masterFader.gain.value = 1;

    this.masterFader.connect(this.limiter);
    this.limiter.connect(this.outGain);
    this.outGain.connect(ctx.destination);

    this.fx = new FxRack(ctx);
    this.fx.output.connect(this.masterFader);

    this.house = ctx.createGain();
    this.house.gain.value = 0;
    this.house.connect(this.masterFader);

    this.chrome = new Chrome(ctx, this.outGain);
    if (ctx.state === 'suspended') await ctx.resume();
  }

  /** Player-facing output volume, from settings rather than from the board. */
  setOutputVolume(v: number): void {
    this.masterVolume = v;
    this.outGain?.gain.setTargetAtTime(v, this.ctx!.currentTime, 0.05);
  }

  /** The board's master fader (doc 5.3). 0..1, neutral around 0.72. */
  setMaster(v: number): void {
    if (!this.masterFader || !this.ctx) return;
    const g = Math.pow(v, 1.9) * 1.85;
    this.masterFader.gain.setTargetAtTime(g, this.ctx.currentTime, AUDIO_RAMP * 0.5);
  }

  get rack(): FxRack {
    return this.fx!;
  }

  channel(id: string): ChannelStrip {
    let s = this.strips.get(id);
    if (!s) {
      s = new ChannelStrip(this.ctx!, id, this.masterFader!, this.fx!);
      this.strips.set(id, s);
    }
    return s;
  }

  get channels(): ChannelStrip[] {
    return [...this.strips.values()];
  }

  async buffer(file: string): Promise<AudioBuffer> {
    const hit = this.cache.get(file);
    if (hit) return hit;
    const res = await fetch(`assets/audio/${file}`);
    if (!res.ok) throw new Error(`missing audio: ${file}`);
    const bytes = await res.arrayBuffer();
    const buf = await this.ctx!.decodeAudioData(bytes);
    this.cache.set(file, buf);
    return buf;
  }

  async loadSong(def: SongDef): Promise<void> {
    const buffers = new Map<string, AudioBuffer>();
    await Promise.all(
      def.stems.map(async (s) => {
        buffers.set(s.channel, await this.buffer(s.file));
      }),
    );
    this.song = { def, buffers };
  }

  /** Preload event audio so an injection never arrives late. */
  async preload(files: string[]): Promise<void> {
    await Promise.all(files.map((f) => this.buffer(f).catch(() => null)));
  }

  startSong(): void {
    if (!this.song || !this.ctx) return;
    this.stopSong();
    const t = this.ctx.currentTime + 0.14;
    this.startAt = t;
    this.started = true;
    this.paused = false;
    for (const [channel, buf] of this.song.buffers) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.channel(channel).input);
      src.start(t);
      this.playing.push(src);
    }
  }

  stopSong(): void {
    for (const s of this.playing) {
      try {
        s.stop();
      } catch {
        /* already ended */
      }
    }
    this.playing = [];
    for (const [id] of this.injections) this.stopInject(id);
    this.started = false;
    this.fx?.setRunaway(0, 0.05);
  }

  /**
   * Seconds into the song, corrected for output latency, so what the player sees is
   * aligned with what the player hears. Doc 19.2 flags mobile output latency as a
   * thing to measure rather than assume; this is where the correction lands.
   */
  get songTime(): number {
    if (!this.ctx || !this.started) return 0;
    if (this.paused) return this.pausedAt;
    const latency = (this.ctx.outputLatency || this.ctx.baseLatency || 0);
    return Math.max(0, this.ctx.currentTime - this.startAt - latency);
  }

  get songLength(): number {
    if (!this.song) return 0;
    let buf = 0;
    for (const b of this.song.buffers.values()) buf = Math.max(buf, b.duration);
    return buf;
  }

  get outputLatency(): number {
    if (!this.ctx) return 0;
    return this.ctx.outputLatency || this.ctx.baseLatency || 0;
  }

  get isPlaying(): boolean {
    return this.started && !this.paused;
  }

  async pause(): Promise<void> {
    if (!this.ctx || this.paused) return;
    this.pausedAt = this.songTime;
    this.paused = true;
    await this.ctx.suspend();
  }

  async resume(): Promise<void> {
    if (!this.ctx) return;
    await this.ctx.resume();
    if (this.paused) {
      // currentTime does not advance while suspended, so the anchor stays valid.
      this.paused = false;
    }
  }

  /**
   * Event audio, routed the way it would really arrive (doc 18.2). The snoring goes
   * into the drum channel because the overheads are the mic that would hear it, so
   * the drum fader really does deal with it.
   */
  playInject(
    id: string,
    channelId: string | null,
    file: string,
    opts: { loop?: boolean; gain?: number } = {},
  ): void {
    if (!this.ctx) return;
    const buf = this.cache.get(file);
    if (!buf) return;
    this.stopInject(id);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = opts.loop ?? false;
    const g = this.ctx.createGain();
    g.gain.value = opts.gain ?? 1;
    src.connect(g);
    g.connect(channelId ? this.channel(channelId).input : this.masterFader!);
    src.start();
    this.injections.set(id, src);
    if (!src.loop) src.onended = () => this.injections.delete(id);
  }

  stopInject(id: string): void {
    const src = this.injections.get(id);
    if (!src) return;
    try {
      src.stop();
    } catch {
      /* already ended */
    }
    this.injections.delete(id);
  }

  /** House music (rule 15). Plumbed now, used from tier 2 where dead air begins. */
  async setHouseMusic(on: boolean, file?: string): Promise<void> {
    if (!this.ctx || !this.house) return;
    if (on && file) {
      if (!this.houseSource) {
        const buf = await this.buffer(file).catch(() => null);
        if (!buf) return;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(this.house);
        src.start();
        this.houseSource = src;
      }
      this.house.gain.setTargetAtTime(0.55, this.ctx.currentTime, 0.15);
    } else {
      this.house.gain.setTargetAtTime(0, this.ctx.currentTime, 0.12);
    }
  }

  /** Bar/beat helpers, so events can be authored against song structure (doc 8.4). */
  secondsPerBar(def: SongDef): number {
    return (60 / def.bpm) * def.beatsPerBar;
  }

  sectionBounds(def: SongDef): { name: string; start: number; end: number }[] {
    const spb = this.secondsPerBar(def);
    const out: { name: string; start: number; end: number }[] = [];
    let t = 0;
    for (const s of def.sections) {
      const end = t + s.bars * spb;
      out.push({ name: s.name, start: t, end });
      t = end;
    }
    return out;
  }
}

export const audio = new AudioEngine();
