/**
 * Persistence (doc 15). A browser game that loses a player's run is a browser game
 * they do not come back to, so everything the player earned is written on every
 * change rather than at some tidy checkpoint.
 */

const KEY = 'bandruptcy.save.v1';

export type SaveData = {
  v: 1;
  money: number;
  /** Gear ids owned. Gear gates venues, it never makes them easier (doc 14.2). */
  gear: string[];
  /** Wearable ids owned, and who is wearing what. Cosmetic only (doc 14.4). */
  wearables: string[];
  worn: Record<string, string | null>;
  /** Consumable id to count in the bag (doc 14.3). */
  bag: Record<string, number>;
  /** Best crowd energy achieved per venue, 0..100. */
  best: Record<string, number>;
  cleared: string[];
  /** Side jobs: offered on the machine, one accepted at a time, and finished ones. */
  jobsOffered: string[];
  jobAccepted: string | null;
  jobsDone: string[];
  /** Which manager pitches and one-off beats the player has already sat through. */
  seen: string[];
  masterMix: number;
};

export function freshSave(): SaveData {
  return {
    v: 1,
    money: 0,
    gear: [],
    wearables: [],
    worn: {},
    bag: {},
    best: {},
    cleared: [],
    jobsOffered: [],
    jobAccepted: null,
    jobsDone: [],
    seen: [],
    masterMix: 0.8,
  };
}

export function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.v !== 1) return freshSave();
    // Merge over a fresh save so a save written by an older build that lacked a
    // field still loads instead of crashing on a missing key.
    return { ...freshSave(), ...parsed };
  } catch {
    return freshSave();
  }
}

export function save(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Private browsing, quota, disabled storage. Losing the save is bad but
    // crashing the gig the player is in the middle of is worse.
  }
}

export function wipe(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* see above */
  }
}
