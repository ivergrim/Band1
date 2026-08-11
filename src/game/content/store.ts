import type { MemberId } from './cast';
import type { PartDef } from '../../core/assets';

/**
 * Barry's computer (doc 13.3).
 *
 * Three categories, and doc 13.3 asks for in-game names rather than the design
 * words: gear is PROPER KIT, consumables are EMERGENCIES, wearables are LOOKS.
 *
 * Doc 14.2: gear is a gate and never an advantage. Doc 14.3: consumables are never
 * required, and they are where the actual money decision lives. Doc 14.4: wearables
 * have no gameplay effect whatsoever, on purpose, so a player can dress the band
 * however they find funniest without playing badly.
 *
 * Item descriptions are a primary comedy vehicle (doc 3.1, 13.3). They are also the
 * only place in the game where the fiction gets to explain a mechanic, so the joke
 * and the effect have to arrive in the same words (14.3).
 */

export type Category = 'kit' | 'emergency' | 'look';

export const CATEGORY_NAMES: Record<Category, string> = {
  kit: 'PROPER KIT',
  emergency: 'EMERGENCIES',
  look: 'LOOKS',
};

export type ConsumableEffect =
  /** Nudge the room back up (doc 14.3). */
  | { kind: 'energy'; amount: number }
  /** Clear one active problem outright. */
  | { kind: 'clear' }
  /** A window where nothing new fires. */
  | { kind: 'quiet'; seconds: number };

export type StoreItem = {
  id: string;
  category: Category;
  name: string;
  price: number;
  /** Flavour text, which is most of the point of the store existing. */
  desc: string;
  /** Owned once and kept. Gear and looks. */
  once?: boolean;
  /** Doc 13.3: stock arrives progressively, so the catalogue always shows a few
   *  things that are out of reach rather than a wall of meaningless gear. */
  outOfStock?: boolean;
  /** Which tier's venues it belongs to. Used only for the "back soon" note. */
  soon?: string;
  effect?: ConsumableEffect;
  /** For a look: who wears it, and what it does to the drawing. */
  wearable?: {
    member: MemberId;
    part: PartDef;
    src: string;
    /** How much more theatrically they move. Purely cosmetic (14.4). */
    flourish: number;
  };
};

export const STORE: StoreItem[] = [
  // ------------------------------------------------------------------ PROPER KIT
  {
    id: 'spring-reverb',
    category: 'kit',
    name: 'SPRING REVERB TANK',
    price: 60,
    once: true,
    desc:
      'A steel box with three springs in it. Two of them are the original springs. ' +
      'Adds an FX switch to every channel strip. Barry says it fell off a lorry, ' +
      'which is the only part of this you should believe.',
  },
  {
    id: 'vocal-mic',
    category: 'kit',
    name: 'VOCAL MIC, WORKING',
    price: 85,
    once: true,
    outOfStock: true,
    soon: 'tier 2',
    desc:
      'A microphone that a person can sing into and be heard. Revolutionary. ' +
      'Barry has one but it is currently propping up a shelf.',
  },
  {
    id: 'windshields',
    category: 'kit',
    name: 'WINDSHIELDS, PAIR',
    price: 40,
    once: true,
    outOfStock: true,
    soon: 'tier 2',
    desc:
      'Foam. Grey. Smells of somebody. Required for outdoor work, which Barry ' +
      'insists is where the real money is, immediately before it rains.',
  },

  // ----------------------------------------------------------------- EMERGENCIES
  {
    id: 'airhorn',
    category: 'emergency',
    name: 'AIRHORN',
    price: 14,
    effect: { kind: 'energy', amount: 18 },
    desc:
      'Lifts a room instantly and costs you nothing but everyone\'s hearing. ' +
      'One use. Do not aim it at the band, they are already fragile.',
  },
  {
    id: 'gaffer',
    category: 'emergency',
    name: 'GAFFER TAPE',
    price: 18,
    effect: { kind: 'clear' },
    desc:
      'Kills one problem outright, whatever it is, by whatever means the tape ' +
      'finds appropriate. Held this industry together since 1961.',
  },
  {
    id: 'biscuits',
    category: 'emergency',
    name: 'BOX OF DOG BISCUITS',
    price: 22,
    effect: { kind: 'quiet', seconds: 15 },
    desc:
      'Fifteen seconds of absolutely nothing going wrong. Works on the dog. ' +
      'Works, disturbingly, on most of the people who cause problems too.',
  },

  // ----------------------------------------------------------------------- LOOKS
  {
    id: 'shades',
    category: 'look',
    name: 'WRAPAROUND SHADES',
    price: 15,
    once: true,
    desc:
      'Roland has wanted these since he was eleven. He cannot see the fretboard ' +
      'in them and it does not slow him down even slightly.',
    wearable: {
      member: 'guitar',
      src: 'guitarist/parts/acc-shades.svg',
      flourish: 1.6,
      part: {
        name: 'accShades',
        src: 'parts/acc-shades.svg',
        pivot: [11, 5],
        at: [1, -15],
        parent: 'head',
        z: 8,
      },
    },
  },
  {
    id: 'brace',
    category: 'look',
    name: 'SURGICAL NECK BRACE',
    price: 18,
    once: true,
    desc:
      'Bev does not need this. Bev has decided it makes them look like someone ' +
      'who has been in a van crash, which they consider a career milestone.',
    wearable: {
      member: 'drums',
      src: 'drummer/parts/acc-brace.svg',
      flourish: 0.55,
      part: {
        name: 'accBrace',
        src: 'parts/acc-brace.svg',
        pivot: [12, 12],
        at: [1, -2],
        parent: 'head',
        z: 5,
      },
    },
  },
  {
    id: 'stetson',
    category: 'look',
    name: 'NOVELTY STETSON',
    price: 22,
    once: true,
    desc:
      'Clive found this at the gig before last and nobody has asked for it back. ' +
      'He has begun saying "yee" at the end of songs. Only the one syllable.',
    wearable: {
      member: 'bass',
      src: 'bassist/parts/acc-stetson.svg',
      flourish: 1.25,
      part: {
        name: 'accStetson',
        src: 'parts/acc-stetson.svg',
        pivot: [20, 14],
        at: [2, -24],
        parent: 'head',
        z: 8,
      },
    },
  },
];

export function item(id: string): StoreItem {
  const i = STORE.find((x) => x.id === id);
  if (!i) throw new Error(`no item ${id}`);
  return i;
}

export function itemsIn(category: Category): StoreItem[] {
  return STORE.filter((x) => x.category === category);
}
