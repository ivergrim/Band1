import type { MemberId } from './cast';

/**
 * The three tier 1 venues.
 *
 * Doc 11: tier 1 is the tutorial and there is no other tutorial. It runs two ramps
 * at once, one new band member per venue and one new control per venue, and each
 * control's debut venue opens with a low-pressure event only that control can solve
 * (5.2), with nothing else active.
 *
 * Doc 14.2: venue 1 does not gate and venue 2 does not either. The first gear gate
 * in the game is venue 3, by which point the player has earned money twice and seen
 * the store.
 */

export type ControlKind = 'volume' | 'tone' | 'pan' | 'fx';

/** Where things stand. Authored per venue; explicit beats generic here. */
export type StageLayout = {
  /** Pixel height of the stage half. Doc 5.7: the split is tunable per venue. */
  height: number;
  /** Background art, drawn from the top of the screen. */
  bg: string;
  /** Y of the floor the band stands on, matching the background's floor line. */
  floorY: number;
  /** The two PA stacks. Each channel's sound is drawn coming out of both (6.5). */
  paLeft: number;
  paRight: number;
  /** Per member: where they stand and where their gear sits. */
  spots: Partial<Record<MemberId, { x: number; gearX: number }>>;
  /** How many crowd figures, and how wide a span they fill. */
  crowd: { count: number; x0: number; x1: number };
};

/** One authored beat in the intensity curve. Doc 8.3. */
export type Slot = {
  /** Song time in seconds. Identical every run: the shape of the pressure is fixed. */
  at: number;
  /** Highest intensity allowed to land here, so the curve rises. */
  max: 1 | 2 | 3;
  /**
   * How many setup-phase problems may be live at this moment. Doc 12.2's tier 1
   * row: sustained one, peak two, and the peak only in venue 3. Never 5, anywhere,
   * ever. A problem waiting to be put back does not count -- that is a restore, not
   * a problem, and being asked to restore one channel while another breaks is the
   * pressure the payoff rule exists to create.
   */
  conc?: 1 | 2;
};

export type Venue = {
  id: string;
  /** What the map and the results screen call it. */
  name: string;
  /** Barry's version of what it is. */
  pitch: string;
  band: MemberId[];
  controls: ControlKind[];
  /** Which control debuts here, and the event that teaches it. */
  debut?: { control: ControlKind; eventId: string };
  /** Channels whose neutral FX state is on, because the mix uses the rack. */
  fxOnAtNeutral: MemberId[];
  /** Gear that must be owned before this can be played (14.2). */
  requiresGear?: string;
  /** Maximum payout, scaled by final crowd energy (14.5). */
  payout: number;
  layout: StageLayout;
  slots: Slot[];
  /** The set of problems this gig contains. Always the same set (8.2); shuffled. */
  instances: string[];
  /** Board interference, if any. Doc 9.2: exactly one, at the end of tier 1. */
  interferenceAt?: number;
};

// Song is 107.4s. Slots are spaced so that at tier 1's concurrency of one, a new
// setup does not land on top of another setup. A setup landing while a previous
// event is merely waiting to be put back is allowed and wanted: that is the
// "restore it while the next thing starts" pressure the payoff rule exists for.

export const VENUES: Venue[] = [
  {
    id: 'garage',
    name: 'PIKE FAMILY GARAGE',
    pitch: 'Intimate showcase. Industry people. Very hush hush.',
    band: ['guitar'],
    controls: ['volume'],
    debut: { control: 'volume', eventId: 'dogOnPedal' },
    fxOnAtNeutral: [],
    payout: 45,
    layout: {
      height: 132,
      bg: 'venue/garage.svg',
      floorY: 112,
      paLeft: 30,
      paRight: 438,
      spots: { guitar: { x: 170, gearX: 236 } },
      crowd: { count: 5, x0: 96, x1: 372 },
    },
    slots: [
      { at: 10, max: 1 },
      { at: 24, max: 1 },
      { at: 38, max: 1 },
      { at: 52, max: 1 },
      { at: 66, max: 2 },
      { at: 80, max: 2 },
      { at: 94, max: 2 },
    ],
    instances: [
      'dogOnPedal',
      'turnItDown',
      'ampTurnedDown',
      'crowdWantsLouder',
      'tuningMidSong',
      'turnItDown',
      'micStandSwung',
    ],
  },
  {
    id: 'denise',
    name: "DENISE'S 40TH",
    pitch: 'Festival slot, effectively. Big crowd. Catering.',
    band: ['guitar', 'drums'],
    controls: ['volume', 'tone'],
    debut: { control: 'tone', eventId: 'jacketOnCab' },
    fxOnAtNeutral: [],
    payout: 70,
    layout: {
      height: 126,
      bg: 'venue/house.svg',
      floorY: 112,
      paLeft: 26,
      paRight: 442,
      spots: {
        guitar: { x: 128, gearX: 182 },
        drums: { x: 300, gearX: 300 },
      },
      crowd: { count: 8, x0: 60, x1: 420 },
    },
    slots: [
      { at: 7, max: 2 },
      { at: 19, max: 1 },
      { at: 31, max: 1 },
      { at: 43, max: 2 },
      { at: 55, max: 2 },
      { at: 66, max: 2 },
      { at: 77, max: 2 },
      { at: 88, max: 2 },
      { at: 98, max: 2 },
    ],
    instances: [
      'jacketOnCab',
      'drummerAsleep',
      'turnItDown',
      'cupOnOverhead',
      'dogOnPedal',
      'blanketOnKit',
      'tuningMidSong',
      'cymbalOnMic',
      'crowdWantsLouder',
    ],
  },
  {
    id: 'sump',
    name: 'THE SUMP',
    pitch: 'Proper venue this. Well, proper-ish. Under a house.',
    band: ['guitar', 'drums', 'bass'],
    controls: ['volume', 'tone', 'fx'],
    debut: { control: 'fx', eventId: 'rackRunaway' },
    // The board's plate is on the guitar all night, which is what gives the FX
    // toggle a home position to return to and makes the payoff beat mean something.
    fxOnAtNeutral: ['guitar'],
    requiresGear: 'spring-reverb',
    payout: 110,
    layout: {
      height: 120,
      bg: 'venue/basement.svg',
      floorY: 112,
      paLeft: 22,
      paRight: 446,
      spots: {
        guitar: { x: 112, gearX: 160 },
        drums: { x: 246, gearX: 246 },
        bass: { x: 352, gearX: 396 },
      },
      crowd: { count: 11, x0: 40, x1: 440 },
    },
    // The last four slots deliberately pair up into the peak of two concurrent
    // problems the tier 1 row of 12.2 allows only here. Doc 8.3: the climax is
    // usually final beats, plural.
    slots: [
      { at: 6, max: 2 },
      { at: 17, max: 1 },
      { at: 28, max: 2 },
      { at: 39, max: 2 },
      { at: 49, max: 2 },
      { at: 59, max: 2 },
      { at: 69, max: 2 },
      { at: 78, max: 3 },
      { at: 85, max: 2 },
      { at: 89, max: 3, conc: 2 },
      { at: 96, max: 2 },
      { at: 100, max: 3, conc: 2 },
    ],
    instances: [
      'rackRunaway',
      'diPadEngaged',
      'drummerAsleep',
      'jackIntermittent',
      'turnItDown',
      'blanketOnKit',
      'dogOnPedal',
      'ampDiesToDi',
      'cymbalOnMic',
      'rackRunaway',
      'crowdWantsLouder',
      'jackIntermittent',
    ],
    // Doc 9.2: a single beer spill, once, near the close. Not repeated anywhere
    // else in tier 1. It is the tier's punchline and it gets the whole
    // interference system built and tested during tier 1 production.
    interferenceAt: 82,
  },
];

export function venue(id: string): Venue {
  const v = VENUES.find((x) => x.id === id);
  if (!v) throw new Error(`no venue ${id}`);
  return v;
}

export function venueIndex(id: string): number {
  return VENUES.findIndex((x) => x.id === id);
}
