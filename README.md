# BANDRUPTCY

You are the live sound engineer for a band that should not be allowed near a stage.
The stage is the top of the screen, your desk is the bottom. Things go wrong. Notice
what went wrong, work out which channel it hit, fix it before the room notices, and
put it back when the moment passes.

This repository contains **tier 1, complete**: three gigs, the hub, the economy, and
three side jobs. The design bible is [`docs/BANDRUPTCY_MASTER.md`](docs/BANDRUPTCY_MASTER.md)
and it is the authority — this README only says how the code implements it.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + static build into dist/
```

**Cloudflare Pages**: build command `npm run build`, output directory `dist`, no
environment variables. Everything is static and all asset paths are relative
(`vite.config.ts` sets `base: './'`), so it also works from a subpath.

Audio is required (doc 20). The game needs one click to start, because browsers will
not open an AudioContext without a gesture; the title screen is that click.

### Keys while playing

| Key | What it does |
|---|---|
| `F3` | Dev overlay: song clock, **real output latency**, live demands per control, the scheduled timeline |
| `H` | The haze check (doc 19.4) — hides the stage so you can hear whether an event's audio cue is doing its job |
| `V` | Toggles the drawn-sound system (doc 6.5) so it can be measured against 19.1 |
| `Esc` | Walk out of the gig |
| `Shift+R` | On the title screen: wipe the save |

---

## What is built

**Three venues**, running two ramps at once, because tier 1 is the tutorial and there
is no other tutorial (doc 11):

| Venue | Band | New control | Also |
|---|---|---|---|
| PIKE FAMILY GARAGE | Roland (guitar) | fader, master | 8 problems, concurrency 1 |
| DENISE'S 40TH | + Bev (drums) | tone | 9 problems |
| THE SUMP | + Clive (bass) | FX toggle | 12 problems, peak concurrency 2, the beer spill, first gear gate |

**15 event types** in `src/game/content/events.ts`, every one run through the signal
path test (8.1b) and the animation test (6.6). **The hub**: Barry pitching, the map,
the store as a 90s website on his CRT, the answering machine. **The economy**: gear as
a pure gate, three consumables as physical objects on the desk, three wearables that
change the drawing and nothing else. **Three side jobs**, one per venue, including one
that pays you to wreck the mix you are being scored on.

---

## How the doc's rules became code

A few places where the implementation is the argument, not just the result:

**Events declare physics; the game derives the correct answer.** An event does not say
"the fader should be at 0.52". It says `sourceGain: 2.05` — a dog is standing on a
boost pedal — and `demand: { volume: 'compensate' }`. The runtime inverts the fader law
to work out where the fader must therefore be. That makes 8.1b's second and third
questions (does the named control address it, is the direction physically correct)
true by construction rather than by an author remembering to check, and it means
retuning the fader law cannot silently break twenty events.
See `Mixer.compensatedVolume` / `compensatedTone` in `src/game/gig/mixer.ts`.

**The world and the board are different halves of the audio graph.** `ChannelStrip`
puts the event's cause (source gain, a lowpass for something draped over a cabinet, a
highpass for a borrowed DI) *upstream* of the player's tilt EQ, fader, panner and send.
So when a jacket lands on the cabinet a real filter really dulls the signal, and when
the player turns the tone knob toward treble a real shelf really undoes it. Nothing is
scripted (doc 18.1).

**Scoring is one mechanism, not three.** Every control, at every moment, has a required
range and a clock. Under an event the clock is short (4s) and the drain is steep
(1.75/s); with nothing wrong the required range is neutral, the clock is longer and the
drain is a nag that scales with how far off it is. Setup beats, payoff beats and the
anti-pre-parking rule are all that same code path, which is why none of them can
disagree with each other (doc 2.2). See `Director.scoreControls`.

**Concurrency counts problems, not restores.** A channel waiting to be put back is a
restore, not a problem, so it does not occupy a concurrency slot. Being asked to
restore one channel while another breaks is the pressure the payoff rule exists to
create; if payoffs counted, the tier 1 budget of one would forbid it.

**The scheduler fixes the shape and shuffles the contents.** Slots are authored per
venue with a fixed time and a maximum intensity, so the pressure curve is identical
every run; only which problem lands in which slot is shuffled by seed. Without that,
two medium events landing three seconds apart instead of thirty makes a run unwinnable
through luck and score chasing stops being fair (doc 8.3).

**Sound made visible.** `src/game/render/soundViz.ts` draws each channel's current
setting as sound leaving the PA in that channel's colour: size from the fader, shape
from the tone knob, a tail from the FX toggle, lean from pan. Pulses are computed from
song time rather than simulated, so a correct desk is a calm rhythmic pattern locked to
the band and deviation is the only thing that reads as new. It arrives one property at
a time alongside the controls.

**What the board deliberately does not show.** There is no marker for where a control
*should* be during an event. The unity mark is printed on the fader track because a real
console has one and neutral is a physical property of the desk. A demanded range would
be a legend, and 2.4 is explicit that the cue names the fix.

---

## Measured, not argued (doc 19)

`tools/playtest.mjs` drives a scripted competent player: it reads each control's demand
and moves it there after a fixed reaction delay. Run it against a preview server with
the delay in seconds:

```bash
npm run build && npx vite preview --port 4173 &
node tools/playtest.mjs 1.5 garage
node tools/playtest.mjs 4.5 sump
```

Final crowd energy by reaction time, on the current numbers (pass mark is 50):

| Reaction | PIKE FAMILY GARAGE | THE SUMP |
|---|---|---|
| ≤ 2.5s | 100 | — |
| 1.5s | 100 | 86 |
| 4.5s | 87 | 46 |
| 6s | 62 | — |
| 8s | 14 | — |

So the tutorial forgives and the tier closer does not, which is the curve the doc asks
for. The Sump never reaches 100 for this player because the scripted player does not
wipe the beer spill — interference is not a fader move, which is the point of the
category (doc 9).

**Output latency** is measured live rather than assumed: the `F3` overlay reports
`AudioContext.outputLatency`, and `AudioEngine.songTime` subtracts it so what the
player sees is aligned with what the player hears (doc 19.2). It reads ~32ms on desktop
Chromium here; the number that matters is on a mid-range Android device, and that
measurement has not been taken yet.

`tools/screenshots.mjs` grabs a pass over every screen for eyeballing changes.

---

## Swapping the placeholder assets

Both the art and the audio are stand-ins, built so that replacing them is a file swap.

### Art

Every drawing is an SVG file under `public/assets/art/`. Characters and gear are rigs:
`rig.json` lists named parts, each with its origin at its natural joint pivot and
optionally parented to another part. Animation is transforms on those parts and nothing
else, so **no part ever needs a second drawing** (doc 17.2, 17.3).

```
public/assets/art/guitarist/
  rig.json            names, pivots, parent chain, z order
  parts/head.svg      one part, one file
  parts/torso.svg
  parts/face-play.svg   the face sheet that swaps in
  ...
```

To drop in a photographed, vectorised hand drawing: replace the `.svg`, keep the same
pivot in `rig.json`, and every animation in the game keeps working untouched. If the
new drawing's proportions differ, the pivot is the only number to retune.

Any part may use the colour tokens `%BASE%`, `%LIGHT%`, `%DARK%` and `%INK%`. They are
substituted at rasterise time from the owning channel's colour, which is what lets one
asset family serve every channel (doc 6.4.5). The palette is in
`src/core/palette.ts` and was picked before anything was drawn, as 17.3 asks.

### Audio

`tools/make_audio.py` renders the tier 1 song as one mono stem per band member plus the
event audio. It needs `pip install numpy soundfile`.

```
public/assets/audio/stems/t1-guitar.mp3    68 bars, 152bpm, 107.4s
public/assets/audio/stems/t1-drums.mp3
public/assets/audio/stems/t1-bass.mp3
public/assets/audio/sfx/*.mp3              snoring, tuning, crackle, ...
```

To drop in DAW bounces: keep the filenames, keep them **mono** (pan is a control the
player operates, so a pre-panned stem gives the panner nothing honest to do), and keep
the length and tempo. If the tempo or structure changes, change it in both
`tools/make_audio.py` and `src/game/content/song.ts` — they are the same numbers in two
places and the code says so.

Game chrome (menus, stings, the noises the desk makes) is synthesised live in the
SC-55 register and is never routed through a channel strip (doc 18.4). It needs no
files and nothing to swap.

---

## Where the writing lives

All of it is in `src/game/content/`, none of it inline:

- `cast.ts` — the band, the manager, names and pronouns, and each member's recurring behaviours
- `copy.ts` — Barry's pitches, the gear-gate refusals, results and blame lines
- `store.ts` — item names and descriptions, which are a primary comedy vehicle (doc 3.1)
- `sidejobs.ts` — answering machine messages and the sticky notes
- `venues.ts` — venue names and Barry's version of what each one is

**Names are proposals** (doc 22 leaves all of them open). The band is HEAVY PLANT
CROSSING; Roland Pike on guitar, Bev Trundle on drums, Clive Nunn on bass, managed by
Barry Loam, who takes forty percent and calls it ten. Renaming anybody is one edit
because nothing else in the codebase hardcodes a name.

---

## Two readings of the doc worth flagging

**House music is not in tier 1.** Doc 5.3 makes it a global control and rule 15 says it
exists to solve dead air, but 5.2's table gives tier 1 exactly three additions — fader
and master, then tone, then FX. Rather than smuggle a fourth control in, tier 1 has no
dead-air events and house music arrives with the vocalist in tier 2, where the events
that stop the band dead live anyway. The plumbing is built (`AudioEngine.setHouseMusic`)
and unused.

**The vertical split is fixed per venue but does not change the board layout.** Doc 5.7
wants the split tunable, so the three venues use 132 / 126 / 120 pixels of stage and
the fader travel absorbs the difference. It is a small escalation signal rather than a
dramatic one, because the board has to stay usable at every setting.

---

## Not built yet

Tier 1 only, deliberately. Pan, vocals, board interference beyond the single beer
spill, talkback, lighting and pyro are tiers 2–5. The audio engine has a stereo panner
and a house-music bus already wired up; `MEMBERS.vocals` reserves red so nothing else
claims it.
