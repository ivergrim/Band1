/**
 * The writing.
 *
 * Doc 2.6: nobody in this game ever comments on how ridiculous anything is. The
 * player character never speaks and is never on screen. Everything below is either
 * Barry talking, a client talking, or a room reacting.
 *
 * Doc 7.3: when a player fails they have to understand why, and it is said
 * diegetically rather than as a stats screen. So the results copy is built from
 * whatever actually cost the most crowd energy, and the room complains about that.
 */

export const TITLE = {
  name: 'BANDRUPTCY',
  tag: 'somebody has to mix this',
  prompt: 'CLICK ANYWHERE',
  footer: 'headphones recommended · landscape · sound required',
};

/** Barry's pitch on arriving in the office, per venue. Doc 13.1. */
export const PITCHES: Record<string, string[]> = {
  garage: [
    'There he is. Sit down, do not touch the plant.',
    'Right. I have got you something. Intimate showcase, industry people,',
    'very hush hush. Roland has, ah, secured the venue personally.',
    'It is his mother\'s garage. Do not make that face at me.',
    'One guitar, one fader. Even you cannot ruin one fader.',
  ],
  denise: [
    'Good. Good numbers. I have shown them to nobody.',
    'Next one is a festival slot, effectively. Big crowd. Catering.',
    'It is Denise\'s fortieth. Denise is a lovely woman and she has',
    'specifically asked for no death metal, so we are ahead there.',
    'Bev is coming. Bev has a kit now. I have put knobs on your desk for it.',
  ],
  sump: [
    'Now this is a proper venue. Well. Proper-ish. It is under a house.',
    'They call it The Sump. Affectionately, I am told, by the people who live',
    'above it. Clive is in. Bass. He owns a DI box, which makes him management.',
    'One thing. They have got a reverb on the guitar all night and no unit.',
    'So you will be needing a unit. I happen to have a unit.',
  ],
};

/** What the map says when the player picks a venue they cannot yet play. Doc 14.2. */
export const GATE_NAG: Record<string, string[]> = {
  sump: [
    'THE SUMP SAYS NO.',
    '',
    'They want the guitar wet all night and you have',
    'nothing to do it with. There is a hole in every',
    'channel strip where the FX switch should be.',
    '',
    'Barry has a spring reverb tank on his computer.',
    'Of course he does.',
  ],
};

/** Post-gig reaction lines, by outcome. Doc 7.3: the room says it, not a stats box. */
export const RESULTS = {
  perfect: [
    'Nobody noticed anything all night.',
    'Which is, and Barry will never once say this out loud, the whole job.',
  ],
  great: [
    'They are still in the room. Some of them are talking about the band.',
    'Barry is telling somebody it was his idea.',
  ],
  pass: [
    'You got away with it.',
    'Two people mentioned a noise. Roland has decided they meant the drums.',
  ],
  fail: [
    'The room emptied before the outro.',
    'Barry is explaining to somebody that the sound is not his department.',
  ],
  wipeout: [
    'Somebody has turned the lights on.',
    'Barry is already in the van. Barry is very good at being already in the van.',
  ],
};

/**
 * The diegetic pointer at what went wrong, chosen by whichever control cost the
 * most. Doc 7.3: the specific feedback should point at what went wrong so the
 * player learns rather than just losing.
 */
export const BLAME: Record<string, string[]> = {
  volume: [
    '"It kept going quiet," says a man who paid nothing to get in.',
    '"And then loud. And then quiet."',
  ],
  tone: [
    '"It sounded like it was under something," somebody says.',
    'It was. You could see it from where you were standing.',
  ],
  fx: [
    '"There was a noise like a swimming pool," says Denise\'s brother-in-law.',
    'He is describing your reverb. He is not wrong.',
  ],
  master: [
    'Somebody upstairs has written a letter. It is already written.',
    'The letter says "at all hours" twice.',
  ],
  drift: [
    'Nothing went wrong, exactly. It just never sounded right for long.',
    'Half the desk spent the night somewhere it should not have been.',
  ],
  board: [
    'There is beer in your desk.',
    'There is beer in your desk and it is going to be there for years.',
  ],
  none: ['Nobody has anything to say about the sound.', 'Take the win.'],
};

/** Band reactions in the office, keyed loosely to how the last gig went. */
export const BAND_LINES = {
  good: [
    'Roland thinks the guitar was quiet.',
    'Bev is asleep in the van and will not be woken for this.',
    'Clive has not registered that a gig happened.',
  ],
  bad: [
    'Roland thinks the guitar was quiet.',
    'Roland always thinks the guitar was quiet.',
    'Clive is asking whether we get paid either way.',
  ],
};

export const HUB = {
  machineEmpty: ['NO NEW MESSAGES', '', 'The light is still flashing.', 'It has always been flashing.'],
  machineAccepted: 'JOB ACCEPTED',
  storeClosed: 'BACK SOON',
  cantAfford: 'NOT ENOUGH MONEY',
  jobDone: 'PAID',
  wornBy: 'WORN BY',
};

export const GIG = {
  ready: 'CLICK TO START THE SONG',
  soundcheck: 'SOUNDCHECK',
  roomLabel: 'ROOM',
  masterLabel: 'MASTER',
  passMark: 'PASS',
};
