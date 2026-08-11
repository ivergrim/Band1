import { CHANNEL_COLOURS, type ChannelColour } from '../../core/palette';

/**
 * The band, the manager, and the people who turn up.
 *
 * Doc 22 leaves all of this open, so these are proposals. Every name lives here
 * and nowhere else, so renaming anybody is one edit.
 *
 * Doc 11: band members are not neutral channels. Each one has recurring
 * behaviours the player learns to anticipate, because a character-driven problem
 * is funnier and more learnable than a random one. The `recurring` field is a note
 * to whoever authors the next tier, not something the game reads.
 */

export type MemberId = 'guitar' | 'drums' | 'bass' | 'vocals';

export type Member = {
  id: MemberId;
  /** What the hand-lettered channel strip says. Kept short on purpose. */
  strip: string;
  name: string;
  instrument: string;
  /** Pronouns, stated rather than assumed, so nothing in the game guesses. */
  pronouns: 'he/him' | 'she/her' | 'they/them';
  rig: string;
  colour: ChannelColour;
  /** One line the store and the post-gig screens can lean on. */
  blurb: string;
  /** The behaviours this member generates events from (doc 11). */
  recurring: string[];
};

export const BAND_NAME = 'HEAVY PLANT CROSSING';

export const MEMBERS: Record<MemberId, Member> = {
  guitar: {
    id: 'guitar',
    strip: 'ROLAND',
    name: 'Roland Pike',
    instrument: 'guitar',
    pronouns: 'he/him',
    rig: 'guitarist',
    colour: CHANNEL_COLOURS.guitar,
    blurb: 'Believes he is the band. Owns the van, which he thinks is the same thing.',
    recurring: [
      'creeps his own amp louder, then denies it',
      'tunes mid-song without muting, in front of everyone',
      'takes his jacket off onto whatever is nearest',
    ],
  },
  drums: {
    id: 'drums',
    strip: 'BEV',
    name: 'Bev Trundle',
    instrument: 'drums',
    pronouns: 'they/them',
    rig: 'drummer',
    colour: CHANNEL_COLOURS.drums,
    blurb: 'Can fall asleep at 152 beats per minute. Has done. Twice.',
    recurring: [
      'falls asleep, head on the snare, straight into the overheads',
      'knocks a cymbal into the overhead mic and leaves it there',
      'is the reason anything gets draped over the kit',
    ],
  },
  bass: {
    id: 'bass',
    strip: 'CLIVE',
    name: 'Clive Nunn',
    instrument: 'bass',
    pronouns: 'he/him',
    rig: 'bassist',
    colour: CHANNEL_COLOURS.bass,
    blurb: 'Has never once noticed that anything is wrong. A gift, arguably.',
    recurring: [
      'stands on his own cable until the jack gives up',
      'leans on the DI box and engages the pad with his knee',
      'keeps playing through absolutely everything',
    ],
  },
  vocals: {
    id: 'vocals',
    strip: 'SINGER',
    name: 'Marguerite Volt',
    instrument: 'vocals',
    pronouns: 'she/her',
    rig: 'vocalist',
    colour: CHANNEL_COLOURS.vocals,
    blurb: 'Arrives in tier 2 and immediately makes everything worse.',
    recurring: ['eats the mic', 'wanders off it', 'swings it over the wedge'],
  },
};

export const MANAGER = {
  name: 'Barry Loam',
  company: 'BARRY LOAM ARTIST MANAGEMENT & COURIER SERVICES',
  /** Doc 13.1: he is the reason the player ends up in disasters without feeling railroaded. */
  cut: 'takes forty percent and calls it ten',
};
