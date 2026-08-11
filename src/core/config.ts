/**
 * Global constants. Anything a playtest might want to argue with lives here.
 *
 * Resolution is deliberately one number in one place: section 19.1 of the design
 * doc says pixel readability at maximum density has to be settled by measurement,
 * and that measurement should cost a config change and a screenshot, not a rewrite.
 */

/** Internal render buffer. 480x270 is 16:9 and integer-scales to 1920x1080 at 4x. */
export const VIEW_W = 480;
export const VIEW_H = 270;

/** Fixed simulation step. */
export const TICK_HZ = 60;
export const TICK_DT = 1 / TICK_HZ;

/**
 * Difficulty dials (doc 12.1). Tier 1 row of the table in 12.2.
 * Concurrency is enforced by the scheduler's density budget, not here.
 */
export const TIER1 = {
  /** Seconds an unresolved problem is free (12.2). */
  gracePeriod: 4.0,
  /** Crowd energy lost per second per unresolved problem past grace (12.2). */
  drainPerSecond: 1.75,
  /** Crowd energy lost per second for a control parked off neutral with no event (12.2). */
  driftDrainPerSecond: 0.25,
  /** Grace before the drift nag starts. Long, because it is a nag not a failure. */
  driftGrace: 2.5,
  /** Awarded for resolving inside the grace window (7.2). Capped by the ceiling of 100. */
  speedBonus: 6,
  /** Awarded for restoring neutral inside the grace window on a payoff beat. */
  payoffBonus: 4,
} as const;

/** Crowd energy (doc 7). One meter, 0..100, threshold fixed at 50 forever. */
export const ENERGY_START = 100;
export const ENERGY_MAX = 100;
export const ENERGY_PASS = 50;

/**
 * Neutral is a range, not a point (rule 9). Widths are in control units.
 * Volume/tone/pan controls are normalised -1..1 around their neutral centre.
 */
export const NEUTRAL_WIDTH = {
  /** Fader: +/- this much of full travel counts as home. */
  volume: 0.09,
  tone: 0.14,
  pan: 0.14,
} as const;

/** Where a fader sits when it is home, as a fraction of travel from the bottom. */
export const FADER_NEUTRAL = 0.72;

/** Cross-fade time for source-side event processing, so nothing clicks. */
export const AUDIO_RAMP = 0.08;
