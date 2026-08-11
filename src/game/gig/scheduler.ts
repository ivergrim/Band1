import { Rng } from '../../core/rng';
import { TIER1_EVENTS } from '../content/events';
import { songLength } from '../content/song';
import type { Venue } from '../content/venues';
import type { EventDef } from './eventTypes';

/**
 * The scheduler (doc 8.3).
 *
 * Levels are authored, not random (8.2), but they should feel fresh on replay. So
 * the *shape* of the pressure is fixed -- the slots in the venue data are the same
 * every run -- and only which problem fills which slot is shuffled.
 *
 * That distinction is the whole point of 8.3's last paragraph: without a fixed
 * density budget, two medium events landing three seconds apart instead of thirty
 * makes a run unwinnable through luck alone, and score chasing stops being fair.
 */

/** Seconds after a problem ends that its channel stays reserved for the restore. */
const PAYOFF_RESERVE = 5;

export type Scheduled = { at: number; def: EventDef };

export function buildTimeline(venue: Venue, seed: number): Scheduled[] {
  const rng = new Rng(seed);
  const pool = rng.shuffle([...venue.instances]);

  // Doc 5.2: each control's debut venue opens with an event only the new control
  // can solve, at low pressure, with nothing else active. That beat is not
  // shuffled -- it is the entire tutorial.
  if (venue.debut) {
    const i = pool.indexOf(venue.debut.eventId);
    if (i > 0) {
      pool.splice(i, 1);
      pool.unshift(venue.debut.eventId);
    }
  }

  const placed: Scheduled[] = [];
  const busy = new Map<string, [number, number][]>();
  const usedOnce = new Set<string>();
  const leftovers: string[] = [];

  const canPlace = (def: EventDef, at: number, conc: number): boolean => {
    const end = at + def.duration + PAYOFF_RESERVE;
    for (const [a, b] of busy.get(def.target) ?? []) {
      if (at < b && end > a) return false;
    }
    // Concurrency counts problems in their setup phase only. A channel waiting to be
    // put back is a restore, not a problem (see the note in venues.ts).
    let live = 0;
    for (const p of placed) if (at >= p.at && at < p.at + p.def.duration) live++;
    return live < conc;
  };

  const commit = (def: EventDef, at: number): void => {
    placed.push({ at, def });
    const list = busy.get(def.target) ?? [];
    list.push([at, at + def.duration + PAYOFF_RESERVE]);
    busy.set(def.target, list);
    if (def.frequency === 'once') usedOnce.add(def.id);
  };

  for (const slot of venue.slots) {
    const conc = slot.conc ?? 1;
    let chosen = -1;
    for (let i = 0; i < pool.length; i++) {
      const def = TIER1_EVENTS[pool[i]];
      if (!def) continue;
      if (def.intensity > slot.max) continue;
      if (def.frequency === 'once' && usedOnce.has(def.id)) continue;
      if (!canPlace(def, slot.at, conc)) continue;
      chosen = i;
      break;
    }
    if (chosen < 0) continue;
    const def = TIER1_EVENTS[pool[chosen]];
    pool.splice(chosen, 1);
    commit(def, slot.at);
  }

  // Anything the greedy pass could not fit gets walked forward to the next moment
  // that works. Doc 8.2 promises the same gig always contains the same set of
  // problems, so silently dropping one would break the promise the replay scoring
  // rests on.
  leftovers.push(...pool);
  const end = songLength();
  for (const id of leftovers) {
    const def = TIER1_EVENTS[id];
    if (!def) continue;
    let at = -1;
    for (let t = 4; t < end - def.duration - 2; t += 0.5) {
      if (canPlace(def, t, 2)) {
        at = t;
        break;
      }
    }
    if (at >= 0) commit(def, at);
  }

  placed.sort((a, b) => a.at - b.at);
  return placed;
}

/** Dev-only sanity report, surfaced by the F3 overlay. */
export function describeTimeline(t: Scheduled[]): string[] {
  return t.map(
    (s) =>
      `${s.at.toFixed(0).padStart(3, ' ')}s ${s.def.target.padEnd(7, ' ')} ` +
      `${s.def.expect.padEnd(6, ' ')} i${s.def.intensity} ${s.def.label}`,
  );
}
