/**
 * The shape of an event.
 *
 * Content declares the *physics* and the game derives the correct response from
 * it. An event says "a dog is standing on the boost pedal, the source is twice as
 * loud"; the runtime works out what the fader must therefore do. That ordering is
 * deliberate: it makes doc 8.1b's second and third questions -- does the named
 * control address it, is the direction physically correct -- true by construction
 * rather than by an author remembering to check.
 */

export type Target = 'guitar' | 'drums' | 'bass' | 'vocals' | 'master';

/** What the world does. None of this is under the player's control. */
export type WorldEffect = {
  /** Multiplier on the source arriving at the console. 2 is twice as loud. */
  sourceGain?: number;
  /** Something is over the source or its mic. Covering loses treble first. */
  muffleHz?: number;
  /** The source lost its bottom end: a borrowed DI, a mic off its cone. */
  thinHz?: number;
  /** Looped audio injected into this channel, because that mic would hear it. */
  inject?: { file: string; gain?: number };
  /** A one-off noise. Routed to the channel unless `channel` says otherwise. */
  oneShot?: { file: string; gain?: number; channel?: Target | null };
  /** The board's own effects rack climbing into a howl. */
  rackRunaway?: boolean;
};

/**
 * What the board has to be doing while this is live.
 *
 * 'compensate' means the runtime derives the range from the world effect, which is
 * the normal case. Explicit ranges exist for events with no signal physics behind
 * them, which in tier 1 means the two master-volume gags: somebody wants it
 * quieter, somebody wants it louder, and the cue states a goal rather than a
 * control (doc 2.4).
 */
export type Demand = {
  volume?: 'compensate' | [number, number];
  tone?: 'compensate' | [number, number];
  fx?: boolean;
  master?: [number, number];
};

export type EventDef = {
  id: string;
  target: Target;
  /** Author-facing only. Never shown during a gig; there is no text layer (2.4). */
  label: string;
  /** Doc 8.3. 1 is a nuisance, 3 is a disaster. */
  intensity: 1 | 2 | 3;
  /** Seconds the problem persists before the payoff beat arrives. */
  duration: number;
  /** Doc 8.3: once-only or recurring. */
  frequency: 'once' | 'recurring';
  world: WorldEffect;
  demand: Demand;
  /** Key the stage renderer animates against. */
  visual: string;
  /**
   * Which control the player is expected to reach for. Used only by the dev
   * overlay and by the readability test in tools; the game never tells the player.
   */
  expect: 'volume' | 'tone' | 'fx' | 'master';
};

export type Phase = 'setup' | 'payoff' | 'done';

export type LiveEvent = {
  def: EventDef;
  phase: Phase;
  /** Song time this phase began. */
  phaseStart: number;
  /** Seconds this phase's demand has gone unmet. */
  unmet: number;
  /** True once grace has expired and it is actively costing crowd energy. */
  escalated: boolean;
  /** Whether the speed bonus for this phase has already been paid. */
  claimed: boolean;
  /** Song time the setup began, for the stage's animation phase. */
  bornAt: number;
  /** Total crowd energy this instance has cost. Shown on the results screen. */
  cost: number;
};
