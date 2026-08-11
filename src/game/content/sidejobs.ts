import type { MemberId } from './cast';

/**
 * Side jobs (doc 16). Optional, well paid, deliberately difficult, and delivered
 * through the answering machine in the office.
 *
 * Doc 16.2: the point is a second objective that is not "keep the mix clean", and
 * often that means inverting the loop -- being paid to break the thing you have
 * spent the whole game protecting. Doc 16.3's one constraint: during a gig, a side
 * job must be something you *do*. Abstinence is not gameplay, so there is no job
 * here that asks the player to sit on their hands.
 *
 * Doc 16.4: the sticky note removes remembering as the difficulty. What is left is
 * the conflict, which is the better version: the sabotage you were paid for
 * actively fights the gig you are being scored on.
 */

export type SideJob = {
  id: string;
  venueId: string;
  /** Who left the message, for the machine's display. */
  from: string;
  /** The answering machine message. One line per beat, played back in the office. */
  message: string[];
  /** The sticky note on the board. Short, and it has to survive being glanced at. */
  note: string[];
  pay: number;
} & (
  | {
      /**
       * Hold a state for a continuous window. The window is stated in song time so
       * the note can flash when the moment arrives rather than describing a bar
       * number at a player who cannot count bars under load.
       */
      kind: 'hold';
      at: number;
      hold: number;
      /** 'all' means every channel on the board, which is the point of the gag. */
      channels: 'all' | MemberId[];
      demand: { volume?: [number, number]; tone?: [number, number] };
      /** What the note says once the window opens. */
      cue: string[];
    }
  | {
      /** A straight performance challenge. Doc 16.3: "hit a mark". */
      kind: 'score';
      target: number;
    }
);

export const SIDE_JOBS: SideJob[] = [
  {
    id: 'job-mark',
    venueId: 'garage',
    from: 'DEREK LOAM',
    kind: 'score',
    target: 100,
    pay: 35,
    message: [
      "Derek. Barry's cousin. The one he owes money to.",
      'Barry has told me you are, quote, the best young ears in the county.',
      'I have put fifty pounds on you finishing a gig without upsetting anybody.',
      'The garage. Perfect room. No excuses. Send me the numbers.',
    ],
    note: ['DEREK: FINISH', 'THE GARAGE', 'ON 100.', 'NO SLIPS.'],
  },
  {
    id: 'job-thief',
    venueId: 'denise',
    from: 'UNKNOWN CALLER',
    kind: 'hold',
    // Second chorus, a few seconds in. Long enough to hurt, short enough to survive.
    at: 61,
    hold: 6,
    channels: 'all',
    demand: { volume: [0.93, 1.0] },
    pay: 45,
    message: [
      'You do not know me and we have never spoken.',
      'Number 41 Denise Road. Next door but one to the party.',
      'At the second chorus I need everything you have got. Everything. All of it.',
      'Six seconds. Nobody will hear a window. Nobody will hear anything.',
    ],
    note: ['UNKNOWN CALLER:', 'SECOND CHORUS,', 'EVERY FADER', 'FLAT OUT. 6s.'],
    cue: ['NOW', 'ALL FADERS', 'FLAT OUT'],
  },
  {
    id: 'job-rival',
    venueId: 'sump',
    from: 'GAVIN',
    // The solo. Clive is not playing the solo, which is exactly why nobody will
    // suspect the desk when his bass turns into a wasp in a tin.
    at: 66,
    hold: 8,
    kind: 'hold',
    channels: ['bass'],
    demand: { tone: [0.86, 1.0] },
    pay: 55,
    message: [
      'Gavin. Bass. You saw me at the audition. You saw what happened.',
      'Clive Nunn took my seat in that band with four notes and a nice coat.',
      'During the solo I want him sounding like a wasp in a biscuit tin.',
      'Eight seconds of him at his absolute thinnest and I will pay for it gladly.',
    ],
    note: ['GAVIN: DURING', 'THE SOLO, RUIN', "CLIVE'S TONE.", 'ALL TREBLE. 8s.'],
    cue: ['NOW', 'CLIVE TONE', 'FULL TREBLE'],
  },
];

export function sideJob(id: string): SideJob {
  const j = SIDE_JOBS.find((x) => x.id === id);
  if (!j) throw new Error(`no side job ${id}`);
  return j;
}

export function jobsForVenue(venueId: string): SideJob[] {
  return SIDE_JOBS.filter((j) => j.venueId === venueId);
}
