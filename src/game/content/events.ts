import type { EventDef } from '../gig/eventTypes';

/**
 * The tier 1 event library.
 *
 * Every entry has been through both tests the doc insists on. The signal path test
 * (8.1b): the cause really changes what arrives at the console, the named control
 * really addresses it, and the direction is physically correct. The animation test
 * (6.6): the cue is a long object rotating, a big shape covering a big shape, a
 * lamp going on or off, a whole body translating, or a break in the ambient loop --
 * because those are the only things that read at this resolution.
 *
 * Tier 1 has no vocalist (doc 11), which means the most comedically loaded channel
 * in the game is unavailable and these have to be funny with instruments only.
 *
 * Every entry is an example, not a fixture (doc 0.1). Replace any of them with
 * something better; what has to survive is the shape.
 */

export const TIER1_EVENTS: Record<string, EventDef> = {
  // ---------------------------------------------------------------- guitar, level
  dogOnPedal: {
    id: 'dogOnPedal',
    target: 'guitar',
    label: 'dog stands on the boost pedal',
    intensity: 1,
    duration: 10,
    frequency: 'recurring',
    // The pedal is a boost. It really does make the amp louder, the mic on the cone
    // really does hear it, and the fader really does deal with it.
    world: { sourceGain: 2.05, oneShot: { file: 'sfx/bark.mp3', gain: 0.5 } },
    demand: { volume: 'compensate' },
    // Doc 6.4.3: the dog is the agent and the joke, the pedal's lamp is the
    // information. The cue survives the player missing the dog entirely.
    visual: 'dogOnPedal',
    expect: 'volume',
  },
  ampTurnedDown: {
    id: 'ampTurnedDown',
    target: 'guitar',
    label: 'Roland turns his own amp down',
    intensity: 1,
    duration: 11,
    frequency: 'recurring',
    // Doc 8.8: as real as events get. The mic hears exactly what he did, and the
    // payoff beat is him turning it back.
    world: { sourceGain: 0.58 },
    demand: { volume: 'compensate' },
    visual: 'ampKnobDown',
    expect: 'volume',
  },
  micStandSwung: {
    id: 'micStandSwung',
    target: 'guitar',
    label: 'mic stand knocked off the cabinet',
    intensity: 2,
    duration: 9,
    frequency: 'once',
    // A long stand rotating about its base is the single most readable animation
    // available (6.6.1). Level only: the tone knob may not exist yet.
    world: { sourceGain: 0.44 },
    demand: { volume: 'compensate' },
    visual: 'micStandSwung',
    expect: 'volume',
  },
  tuningMidSong: {
    id: 'tuningMidSong',
    target: 'guitar',
    label: 'Roland tunes without muting',
    intensity: 2,
    duration: 8,
    frequency: 'recurring',
    // Tuning looks exactly like playing at this resolution, so the tuner carries the
    // cue (6.6.6) and the audio names the channel (2.4).
    world: { inject: { file: 'sfx/tuning.mp3', gain: 0.85 }, sourceGain: 0.9 },
    demand: { volume: 'compensate' },
    visual: 'tuning',
    expect: 'volume',
  },

  // ----------------------------------------------------------------- guitar, tone
  jacketOnCab: {
    id: 'jacketOnCab',
    target: 'guitar',
    label: 'jacket thrown over the cabinet',
    intensity: 2,
    duration: 11,
    frequency: 'recurring',
    // Covering loses treble first, so the physically correct move is to brighten it.
    // A large shape landing over a large object is the clearest event type (6.6.2).
    world: { muffleHz: 900 },
    demand: { tone: 'compensate' },
    visual: 'jacketOnCab',
    expect: 'tone',
  },
  ampDiesToDi: {
    id: 'ampDiesToDi',
    target: 'guitar',
    label: 'amp dies, borrowed DI box',
    intensity: 3,
    duration: 14,
    frequency: 'once',
    // Thin, buzzy, no cabinet. Toward bass, and it is a real engineering move rather
    // than a game convention (8.8).
    world: {
      thinHz: 330,
      sourceGain: 0.86,
      oneShot: { file: 'sfx/amp-die.mp3', gain: 0.9 },
    },
    demand: { tone: 'compensate' },
    visual: 'ampDead',
    expect: 'tone',
  },

  // ------------------------------------------------------------------- guitar, FX
  rackRunaway: {
    id: 'rackRunaway',
    target: 'guitar',
    label: 'FX rack runs away into a howl',
    intensity: 2,
    duration: 9,
    frequency: 'recurring',
    // Originates at the board's own rack, which is the only place an FX event can
    // legitimately come from (doc 8.8: the console cannot undo the band's pedals).
    // The howl is real feedback in the rack, so the toggle genuinely stops it.
    world: { rackRunaway: true },
    demand: { fx: false },
    visual: 'rackRunaway',
    expect: 'fx',
  },

  // ----------------------------------------------------------------- drums, level
  drummerAsleep: {
    id: 'drummerAsleep',
    target: 'drums',
    label: 'Bev falls asleep on the snare',
    intensity: 2,
    duration: 11,
    frequency: 'recurring',
    // Snoring arrives on the drum channel because the overheads are the mic that
    // would hear it (18.2). The kit stops, so the loop break carries it too (6.6.5).
    world: { inject: { file: 'sfx/snore.mp3', gain: 1.0 }, sourceGain: 0.3 },
    demand: { volume: 'compensate' },
    visual: 'asleep',
    expect: 'volume',
  },
  cymbalOnMic: {
    id: 'cymbalOnMic',
    target: 'drums',
    label: 'cymbal knocked against the overhead',
    intensity: 2,
    duration: 9,
    frequency: 'recurring',
    world: { inject: { file: 'sfx/cymbal-rattle.mp3', gain: 0.8 }, sourceGain: 1.5 },
    demand: { volume: 'compensate' },
    visual: 'cymbalOnMic',
    expect: 'volume',
  },

  // ------------------------------------------------------------------ drums, tone
  blanketOnKit: {
    id: 'blanketOnKit',
    target: 'drums',
    label: 'blanket over the kit, overheads with it',
    intensity: 2,
    duration: 11,
    frequency: 'recurring',
    world: { muffleHz: 750 },
    demand: { tone: 'compensate' },
    visual: 'blanketOnKit',
    expect: 'tone',
  },
  cupOnOverhead: {
    id: 'cupOnOverhead',
    target: 'drums',
    label: 'plastic cup lands over the overhead mic',
    intensity: 1,
    duration: 9,
    frequency: 'recurring',
    world: { muffleHz: 1200 },
    demand: { tone: 'compensate' },
    visual: 'cupOnOverhead',
    expect: 'tone',
  },

  // ------------------------------------------------------------------ bass, level
  diPadEngaged: {
    id: 'diPadEngaged',
    target: 'bass',
    label: 'DI pad engaged by a knee',
    intensity: 2,
    duration: 10,
    frequency: 'recurring',
    // He is on a DI, so nothing about where he stands matters (8.1b). What does
    // matter is the pad switch, and a switch is a lamp and a translation (6.6.3).
    world: { sourceGain: 0.32 },
    demand: { volume: 'compensate' },
    visual: 'diPad',
    expect: 'volume',
  },
  jackIntermittent: {
    id: 'jackIntermittent',
    target: 'bass',
    label: 'bass jack half out, crackling',
    intensity: 2,
    duration: 9,
    frequency: 'recurring',
    world: { inject: { file: 'sfx/crackle.mp3', gain: 0.95 }, sourceGain: 0.75 },
    demand: { volume: 'compensate' },
    visual: 'jackLoose',
    expect: 'volume',
  },

  // ---------------------------------------------------------------- master volume
  turnItDown: {
    id: 'turnItDown',
    target: 'master',
    label: 'somebody holds up a TURN IT DOWN sign',
    intensity: 1,
    duration: 11,
    frequency: 'recurring',
    // The cue states a goal, not a control, which is exactly why it is legible
    // (2.4). Nothing has changed in the signal; the demand is on the room.
    world: {},
    demand: { master: [0.3, 0.55] },
    visual: 'turnItDown',
    expect: 'master',
  },
  crowdWantsLouder: {
    id: 'crowdWantsLouder',
    target: 'master',
    label: 'the room chants for it louder',
    intensity: 1,
    duration: 9,
    frequency: 'recurring',
    world: {},
    demand: { master: [0.88, 1.0] },
    visual: 'crowdChant',
    expect: 'master',
  },
};

export type Tier1EventId = keyof typeof TIER1_EVENTS;
