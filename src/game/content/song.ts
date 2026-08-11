import type { SongDef } from '../../core/audio/engine';

/**
 * Tier 1's song. One song per tier (doc 18.3), and the arrangement grows with the
 * band: venue 1 loads the guitar stem alone, venue 2 adds drums, venue 3 adds bass.
 *
 * These numbers mirror tools/make_audio.py. If you change one, change both.
 */
export const TIER1_SONG: SongDef = {
  id: 'tier1',
  bpm: 152,
  beatsPerBar: 4,
  sections: [
    { name: 'intro', bars: 8 },
    { name: 'verse1', bars: 8 },
    { name: 'chorus1', bars: 8 },
    { name: 'verse2', bars: 8 },
    { name: 'chorus2', bars: 8 },
    { name: 'solo', bars: 8 },
    { name: 'verse3', bars: 8 },
    { name: 'chorus3', bars: 8 },
    { name: 'outro', bars: 4 },
  ],
  stems: [
    { channel: 'guitar', file: 'stems/t1-guitar.mp3' },
    { channel: 'drums', file: 'stems/t1-drums.mp3' },
    { channel: 'bass', file: 'stems/t1-bass.mp3' },
  ],
};

export const SEC_PER_BAR = (60 / TIER1_SONG.bpm) * TIER1_SONG.beatsPerBar;

/** All event audio, preloaded before a gig so an injection is never late. */
export const EVENT_AUDIO = [
  'sfx/snore.mp3',
  'sfx/tuning.mp3',
  'sfx/crackle.mp3',
  'sfx/cymbal-rattle.mp3',
  'sfx/bark.mp3',
  'sfx/amp-die.mp3',
  'sfx/beer-spill.mp3',
];

/** Arrangement for a given band size: which stems actually play. */
export function arrangementFor(channels: string[]): SongDef {
  return {
    ...TIER1_SONG,
    stems: TIER1_SONG.stems.filter((s) => channels.includes(s.channel)),
  };
}

export function sectionSpans(): { name: string; start: number; end: number }[] {
  const out: { name: string; start: number; end: number }[] = [];
  let t = 0;
  for (const s of TIER1_SONG.sections) {
    const end = t + s.bars * SEC_PER_BAR;
    out.push({ name: s.name, start: t, end });
    t = end;
  }
  return out;
}

export function songLength(): number {
  return sectionSpans().at(-1)!.end;
}

export function sectionAt(time: number): string {
  for (const s of sectionSpans()) if (time < s.end) return s.name;
  return 'outro';
}
