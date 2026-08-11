import type { Renderer } from '../../core/renderer';
import type { ChannelColour } from '../../core/palette';
import type { ChannelSnapshot } from '../gig/mixer';
import { FADER_NEUTRAL } from '../../core/config';
import type { ControlKind } from '../content/venues';

/**
 * Sound made visible (doc 6.5).
 *
 * Every channel's current setting is drawn as sound leaving the PA, in that
 * channel's colour. Not a meter, not a HUD element, not a number. This is what turns
 * "which control" from a reasoning step into a perception: the vocalist eats the mic,
 * the sound off the stack turns into round sagging blobs, and the player reaches for
 * the tone knob without ever thinking "muddy means low frequencies means EQ".
 *
 * Four constraints keep it from becoming noise, and all four are implemented here
 * rather than left as intentions:
 *
 * 1. It is anchored to the stacks, which are already on stage and already
 *    established. Nothing new enters the frame.
 * 2. At neutral it is ambient: every pulse is spawned on the beat, so a correct desk
 *    looks calm and even and the eye files it as background within seconds. Pulses
 *    are computed from song time rather than simulated, so they cannot drift out of
 *    time with the band no matter what the frame rate does.
 * 3. It renders state, never events. Events are drawn at the person who caused them.
 * 4. It is subordinate: lower contrast and slower motion than any event visual. A
 *    player who ignores it entirely can still play from the event visuals alone.
 *
 * It arrives one property at a time alongside the controls (doc 6.5, Introduction):
 * venue 1 varies size only, shape comes with the tone knob, tails with the FX
 * toggle, and lateral lean with pan in tier 2.
 */

const TRAVEL = 1.05;
/** One pulse every two beats. Any denser and a full band's worth stops reading. */
const BEATS_PER_PULSE = 2;

export type VizChannel = {
  id: string;
  colour: ChannelColour;
  state: ChannelSnapshot;
  /** Index among the band, used to stagger the lanes so they do not overlap. */
  lane: number;
};

export function drawSoundViz(
  r: Renderer,
  channels: VizChannel[],
  opts: {
    songTime: number;
    beatDur: number;
    paLeft: number;
    paRight: number;
    /** Y of the top of the stacks, where sound leaves the cabinet. */
    emitY: number;
    controls: ControlKind[];
    /** Set false and the whole system goes away, for the doc 19.1 measurement. */
    enabled: boolean;
  },
): void {
  if (!opts.enabled) return;
  const showShape = opts.controls.includes('tone');
  const showTail = opts.controls.includes('fx');
  const showLean = opts.controls.includes('pan');
  const period = opts.beatDur * BEATS_PER_PULSE;

  for (const ch of channels) {
    const lane = ch.lane;
    const y = opts.emitY - lane * 7;
    // Reach: doc 6.5's table. Neutral is roughly a third of the way into the room,
    // a thin channel dies at the cabinet, a loud one crashes over the front row.
    const vol = ch.state.volume;
    const reach = 26 + Math.pow(vol / FADER_NEUTRAL, 1.9) * 112;
    const thickness = 1.4 + Math.min(3.6, Math.pow(vol / FADER_NEUTRAL, 2.4) * 2.3);
    const tone = showShape ? ch.state.tone : 0;
    const pan = showLean ? ch.state.pan : 0;

    for (const side of [-1, 1] as const) {
      const originX = side < 0 ? opts.paLeft + 12 : opts.paRight + 12;
      // Hard pan takes one stack quiet. On a mono speaker this is the only pan
      // information the player gets, which is why doc 6.5 calls it a better answer
      // than the small level drop.
      const lean = side < 0 ? 1 - Math.max(0, pan) : 1 + Math.min(0, pan);
      if (lean <= 0.03) continue;

      const tails = showTail && ch.state.fx ? 2 : 0;
      for (let echo = 0; echo <= tails; echo++) {
        const lag = echo * 0.22;
        const k0 = Math.floor((opts.songTime - lag) / period) - 1;
        for (let k = k0; k <= k0 + 2; k++) {
          const age = opts.songTime - lag - k * period;
          if (age < 0 || age > TRAVEL) continue;
          const t = age / TRAVEL;
          const eased = 1 - (1 - t) * (1 - t);
          const dist = eased * reach * lean;
          const fade = (1 - t * 0.86) * lean * (echo === 0 ? 1 : 0.42 / echo);
          drawPulse(r, originX - side * dist, y, side, tone, thickness, ch.colour, fade * 0.92);
        }
      }
    }
  }
}

/**
 * One pulse. Doc 6.5's shape row: a balanced shape at neutral, round heavy sagging
 * blobs at the bass end, sharp spiky jittering shards at the treble end.
 */
function drawPulse(
  r: Renderer,
  x: number,
  y: number,
  side: -1 | 1,
  tone: number,
  thickness: number,
  colour: ChannelColour,
  alpha: number,
): void {
  if (alpha <= 0.03 || x < -8 || x > 488) return;
  const ctx = r.ctx;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = Math.min(1, alpha);
  const h = Math.round(3 + thickness * 2.2);
  const fat = Math.max(0, -tone);
  const bright = Math.max(0, tone);

  if (bright > 0.28) {
    // Spiky shards. Jitter is quantised to the pixel grid so it reads as sharpness
    // rather than as a wobble.
    ctx.fillStyle = colour.light;
    const spikes = 3;
    const len = Math.max(2, Math.round(3 + bright * 6));
    for (let i = 0; i < spikes; i++) {
      const sy = Math.round(y - h / 2 + (i * h) / (spikes - 1));
      // Shards trail back toward the stack they came from.
      const x0 = side < 0 ? Math.round(x) : Math.round(x) - len;
      ctx.fillRect(x0, sy, len, 1);
      ctx.fillRect(side < 0 ? x0 + len - 1 : x0, sy + (i % 2 ? 1 : -1), 2, 1);
    }
  } else if (fat > 0.28) {
    // Round, heavy, sagging blobs.
    ctx.fillStyle = colour.dark;
    const rw = Math.round(3 + fat * 4);
    const rh = Math.round(h * (1 + fat * 0.8));
    ctx.fillRect(Math.round(x - rw / 2), Math.round(y - rh / 2 + fat * 2), rw, rh);
    ctx.fillStyle = colour.base;
    ctx.fillRect(Math.round(x - rw / 2 + 1), Math.round(y - rh / 2 + fat * 2 + 1), rw - 2, rh - 2);
  } else {
    // Balanced: a short chevron leaning the way it is travelling.
    ctx.fillStyle = colour.base;
    ctx.fillRect(Math.round(x), Math.round(y - h / 2), 2, h);
    ctx.fillStyle = colour.light;
    ctx.fillRect(Math.round(x - side), Math.round(y - h / 2 + 1), 1, Math.max(1, h - 2));
  }
  ctx.globalAlpha = prev;
}
