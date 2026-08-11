import { drawRig, drawSprite, loadRig, sprite, type Pose, type Rig, type Sprite } from '../../core/assets';
import { drawText } from '../../core/font';
import { hash01 } from '../../core/rng';
import type { Renderer } from '../../core/renderer';
import { CHANNEL_COLOURS, UI, type ChannelColour } from '../../core/palette';
import { MEMBERS, type MemberId } from '../content/cast';
import { STORE } from '../content/store';
import type { Venue } from '../content/venues';
import type { Visual } from './director';
import type { Mixer } from './mixer';
import { drawSoundViz, type VizChannel } from '../render/soundViz';

/**
 * The stage: the player's primary information channel (doc 6.1), and where all the
 * comedy lives. Those two jobs are compatible, because a problem that is funny is a
 * problem that is memorable and a memorable problem is one the player recognises
 * faster next time.
 *
 * The readability rules in 6.2 are not style preferences here, they are the reason
 * anything works:
 *
 * - Every event visual is drawn at the location of its cause, always.
 * - Ambient motion is one rhythmic loop locked to the song, so the brain files it as
 *   background and any deviation reads as new. That also makes doc 6.6.5's free cue
 *   available: a character whose loop stops or speeds up is instantly legible with
 *   no new art at all, which is how the drummer falling asleep and the guitarist
 *   tuning are both drawn with nothing but transforms.
 * - The moment grace runs out, the visual escalates. Doc 6.2.4 calls this the single
 *   most important piece of feedback in the game.
 * - Event objects are on stage from the opening beat with a visible resting state,
 *   because an object introduced at the moment it breaks is unreadable (6.4.2).
 */

type GearSprites = {
  amp: Sprite;
  ampKnob: Sprite;
  lampOn: Sprite;
  lampOff: Sprite;
  pedal: Sprite;
  micStand: Sprite;
  tuner: Sprite;
  tunerLit: Sprite;
  kit: Sprite;
  cymbal: Sprite;
  cymbalStand: Sprite;
  overhead: Sprite;
  di: Sprite;
  diSwitch: Sprite;
  stack: Sprite;
  jacket: Sprite;
  blanket: Sprite;
  cup: Sprite;
};

export class Stage {
  private rigs = new Map<string, Rig>();
  private bg!: Sprite;
  private gear!: GearSprites;
  private crowdShapes: Sprite[] = [];
  private venue!: Venue;
  /** Extra parts bolted on by wearables, so a look really changes the drawing. */
  private flourish = new Map<MemberId, number>();

  async load(venue: Venue, worn: Record<string, string | null>): Promise<void> {
    this.venue = venue;
    const neutralPal: ChannelColour = {
      base: '#7d7460',
      light: '#b3a893',
      dark: '#3d372e',
      ink: '#1b1712',
    };
    // Stands are the objects that carry cues, so they are lit brighter than the
    // gear around them. Doc 6.2.2: event visuals must be distinguishable at a glance.
    const standPal: ChannelColour = {
      base: '#a89b7c',
      light: '#d8cdb0',
      dark: '#5c5546',
      ink: '#1b1712',
    };
    this.bg = await sprite(venue.layout.bg);
    this.sign = await sprite('neighbour/parts/sign.svg', standPal);
    this.gear = {
      amp: await sprite('gear/amp.svg', CHANNEL_COLOURS.guitar),
      ampKnob: await sprite('gear/amp-knob.svg', neutralPal),
      lampOn: await sprite('gear/lamp-on.svg', neutralPal),
      lampOff: await sprite('gear/lamp-off.svg', neutralPal),
      pedal: await sprite('gear/pedal.svg', neutralPal),
      micStand: await sprite('gear/mic-stand.svg', standPal),
      tuner: await sprite('gear/tuner.svg', neutralPal),
      tunerLit: await sprite('gear/tuner-lit.svg', neutralPal),
      kit: await sprite('gear/kit-shell.svg', CHANNEL_COLOURS.drums),
      cymbal: await sprite('gear/cymbal.svg', neutralPal),
      cymbalStand: await sprite('gear/cymbal-stand.svg', standPal),
      overhead: await sprite('gear/overhead.svg', standPal),
      di: await sprite('gear/di-box.svg', CHANNEL_COLOURS.bass),
      diSwitch: await sprite('gear/di-switch.svg', neutralPal),
      stack: await sprite('gear/stack.svg', neutralPal),
      jacket: await sprite('gear/jacket.svg', neutralPal),
      blanket: await sprite('gear/blanket.svg', neutralPal),
      cup: await sprite('gear/cup.svg', neutralPal),
    };
    for (const id of venue.band) {
      const m = MEMBERS[id];
      const rig = await loadRig(m.rig, m.colour);
      this.rigs.set(id, rig);
      this.flourish.set(id, 1);
    }
    // Doc 14.4: a look changes how a character looks and how they animate, and
    // nothing else. It is an extra part appended to the rig, so every existing
    // animation carries it for free.
    for (const [memberId, itemId] of Object.entries(worn)) {
      if (!itemId) continue;
      const def = STORE.find((s) => s.id === itemId);
      if (!def?.wearable) continue;
      const rig = this.rigs.get(memberId as MemberId);
      if (!rig) continue;
      const m = MEMBERS[memberId as MemberId];
      const spr = await sprite(def.wearable.src, m.colour);
      rig.def.parts.push(def.wearable.part);
      rig.sprites.set(def.wearable.part.name, spr);
      rig.order = [...rig.def.parts].sort((a, b) => a.z - b.z);
      this.flourish.set(memberId as MemberId, def.wearable.flourish);
    }
    this.crowdShapes = [
      await sprite('crowd/a.svg', crowdPal(0)),
      await sprite('crowd/b.svg', crowdPal(1)),
      await sprite('crowd/c.svg', crowdPal(2)),
      await sprite('crowd/d.svg', crowdPal(3)),
      await sprite('crowd/a.svg', crowdPal(4)),
      await sprite('crowd/d.svg', crowdPal(5)),
    ];
    this.neighbourRig = await loadRig('neighbour', {
      base: '#4a5a4a',
      light: '#5d6f5d',
      dark: '#33402f',
      ink: '#141a12',
    });
    this.dogRig = await loadRig('dog', {
      base: '#8a6a3a',
      light: '#a2814a',
      dark: '#6d5228',
      ink: '#1a1208',
    });
  }

  private neighbourRig!: Rig;
  private dogRig!: Rig;
  private sign!: Sprite;

  draw(
    r: Renderer,
    opts: {
      mixer: Mixer;
      visuals: Visual[];
      songTime: number;
      beatDur: number;
      energy: number;
      /** Doc 19.4's haze check: hide the stage and see how much still reads. */
      hidden: boolean;
      vizEnabled: boolean;
    },
  ): void {
    const L = this.venue.layout;
    const ctx = r.ctx;
    r.save();
    r.clip(0, 0, 480, L.height);

    if (opts.hidden) {
      // The haze check (doc 19.4). Not a pass/fail gate: it is the fastest way to
      // hear whether an event's audio cue is doing its job.
      r.rect_(0, 0, 480, L.height, '#0b0a0d');
      for (let i = 0; i < 60; i++) {
        const x = (hash01(i, 1) * 480) | 0;
        const y = (hash01(i, 2) * L.height) | 0;
        r.veil(x, y, 14, 9, '#2a2833', 0.25);
      }
      r.restore();
      return;
    }

    drawSprite(ctx, this.bg, 0, 0);

    const beat = opts.songTime / opts.beatDur;
    const active = new Map<string, Visual>();
    for (const v of opts.visuals) active.set(`${v.target}:${v.key}`, v);
    const on = (target: string, key: string): Visual | undefined => active.get(`${target}:${key}`);

    // PA stacks. Established from the opening beat, oversized, and the anchor the
    // whole visible-sound system hangs off (doc 6.5).
    drawSprite(ctx, this.gear.stack, L.paLeft, L.floorY - 44);
    drawSprite(ctx, this.gear.stack, L.paRight, L.floorY - 44);

    // Sound made visible, drawn under the band so it can never win against an event
    // visual (doc 6.5, constraint 4).
    const viz: VizChannel[] = this.venue.band.map((id, i) => ({
      id,
      colour: MEMBERS[id].colour,
      state: opts.mixer.get(id),
      lane: i,
    }));
    drawSoundViz(r, viz, {
      songTime: opts.songTime,
      beatDur: opts.beatDur,
      paLeft: L.paLeft,
      paRight: L.paRight,
      emitY: L.floorY - 34,
      controls: this.venue.controls,
      enabled: opts.vizEnabled,
    });

    for (const id of this.venue.band) {
      if (id === 'guitar') this.drawGuitarRig(r, beat, on);
      if (id === 'drums') this.drawDrumsRig(r, beat, on);
      if (id === 'bass') this.drawBassRig(r, beat, on);
    }

    const chant = on('master', 'crowdChant');
    this.drawCrowd(r, beat, opts.energy, !!chant);
    const quiet = on('master', 'turnItDown');
    if (quiet) this.drawNeighbour(r, quiet, beat);
    if (chant) this.drawCrowdSign(r, chant);

    r.restore();
    // A drawn lip where the stage meets the desk, so the two halves read as two
    // places rather than as one picture cut in half.
    r.rect_(0, L.height - 2, 480, 2, '#0a080c');
    r.rect_(0, L.height, 480, 2, UI.deskRail);
  }

  // ------------------------------------------------------------------- guitar side

  private drawGuitarRig(
    r: Renderer,
    beat: number,
    on: (t: string, k: string) => Visual | undefined,
  ): void {
    const L = this.venue.layout;
    const spot = L.spots.guitar!;
    const ctx = r.ctx;
    const rig = this.rigs.get('guitar')!;
    const fl = this.flourish.get('guitar') ?? 1;

    const tuning = on('guitar', 'tuning');
    const knobDown = on('guitar', 'ampKnobDown');
    const dead = on('guitar', 'ampDead');
    const jacket = on('guitar', 'jacketOnCab');
    const stand = on('guitar', 'micStandSwung');
    const dog = on('guitar', 'dogOnPedal');

    // The amp. Its one dinner-plate knob with a painted pointer is what makes
    // "somebody turned this down" a visible event at all (doc 6.6.6).
    const ampX = spot.gearX;
    const ampY = L.floorY - 36;
    drawSprite(ctx, this.gear.amp, ampX, ampY);
    const knobRot = knobDown && knobDown.phase === 'setup' ? -118 * ease(knobDown.age, 0.55) : 0;
    drawSprite(ctx, this.gear.ampKnob, ampX + 33, ampY + 6, {
      rot: knobRot,
      pivot: [6.5, 6.5],
    });
    const ampLit = !(dead && dead.phase === 'setup');
    drawSprite(ctx, ampLit ? this.gear.lampOn : this.gear.lampOff, ampX + 40, ampY + 2, {
      pivot: [4.5, 4.5],
    });
    if (dead && dead.phase === 'setup') {
      // Smoke: three shapes rising and fading. The dead lamp is the actual cue; this
      // is the joke on top of it.
      for (let i = 0; i < 4; i++) {
        const t = (dead.age * 0.7 + i * 0.28) % 1;
        r.veil(ampX + 14 + i * 4 - t * 6, ampY - 4 - t * 20, 7 + t * 8, 5 + t * 6, '#8d8878', 0.42 * (1 - t));
      }
      // The spare DI he plugs into. On stage from the opening beat (6.4.2) as a box
      // by the amp; the event is the cable moving to it, not the box appearing.
      drawSprite(ctx, this.gear.di, ampX - 26, L.floorY - 14);
      r.line(ampX - 14, L.floorY - 12, ampX + 6, L.floorY - 6, CHANNEL_COLOURS.guitar.dark);
    } else if (this.venue.id === 'sump') {
      drawSprite(ctx, this.gear.di, ampX - 26, L.floorY - 14);
    }

    // Mic on a stand, pointed at the cone. A long object rotating about its base.
    const standRot = stand && stand.phase === 'setup' ? 38 * ease(stand.age, 0.5) : 0;
    drawSprite(ctx, this.gear.micStand, ampX + 36, L.floorY, {
      rot: standRot,
      pivot: [16, 34],
    });

    // Him. Ambient loop is a torso sway and a strumming arm, both locked to the beat.
    // Tuning stops the loop, which is the cue that costs no art at all (6.6.5).
    const loop = tuning && tuning.phase === 'setup' ? 0 : 1;
    const sway = Math.sin(beat * Math.PI) * 3.2 * fl * loop;
    const strum = Math.sin(beat * Math.PI * 2) * 15 * fl * loop;
    const pose: Pose = {
      torso: { rot: sway },
      armNear: { rot: strum - (tuning && tuning.phase === 'setup' ? 26 : 0) },
      armFar: { rot: -sway * 0.5 },
      head: { rot: -sway * 0.6 + (tuning && tuning.phase === 'setup' ? 16 : 0) },
      facePlay: { hidden: true },
      faceStrain: { hidden: true },
      faceOops: { hidden: true },
    };
    if (knobDown && knobDown.phase === 'setup') {
      // Doc 6.6.7: no event may need a new full-body drawing. He reaches with an arm
      // rotation, not a crouch.
      pose.armFar = { rot: 96 };
      pose.faceOops = { hidden: false };
    } else if (dead && dead.phase === 'setup') {
      pose.faceOops = { hidden: false };
    } else if (this.section(beat) === 'solo') {
      pose.faceStrain = { hidden: false };
    } else {
      pose.facePlay = { hidden: false };
    }
    drawRig(ctx, rig, spot.x, L.floorY, pose);

    // The boost pedal. Downstage of him and drawn after him, because it is nearer the
    // audience than he is and because behind a guitarist is exactly where an object
    // cannot be read from (6.4.2 in practice).
    const pedalX = spot.x - 56;
    const pedalY = L.floorY - 13;
    drawSprite(ctx, this.gear.pedal, pedalX, pedalY);
    const pedalOn = !!(dog && dog.phase === 'setup');
    const blink = pedalOn && dog!.escalated ? (Math.sin(dog!.age * 16) > -0.2 ? 1 : 0) : 1;
    drawSprite(ctx, pedalOn && blink ? this.gear.lampOn : this.gear.lampOff, pedalX + 12, pedalY + 2, {
      pivot: [4.5, 4.5],
    });
    if (pedalOn && blink) r.ring(pedalX + 12, pedalY + 2, 6, withAlpha(UI.lampOn, 0.4));

    // The tuner on the headstock: drawn huge, flashing hard red (6.6.6).
    const tunerX = spot.x - 28;
    const tunerY = L.floorY - 37;
    drawSprite(ctx, this.gear.tuner, tunerX, tunerY);
    if (tuning && tuning.phase === 'setup' && Math.sin(tuning.age * (tuning.escalated ? 18 : 9)) > -0.1) {
      drawSprite(ctx, this.gear.tunerLit, tunerX, tunerY);
    }

    // Three beats, and the third one holds (6.4.4): the jacket approaches, lands, and
    // then sits there animating for as long as the problem is live.
    if (jacket && jacket.phase === 'setup') {
      const t = ease(jacket.age, 0.42);
      const settle = jacket.escalated ? Math.sin(jacket.age * 7) * 0.7 : 0;
      drawSprite(ctx, this.gear.jacket, ampX - 3, ampY - 30 + t * 28 + settle);
    }

    if (dog) this.drawDog(r, dog, pedalX, L.floorY + 1, beat);
  }

  private drawDog(r: Renderer, v: Visual, pedalX: number, floorY: number, beat: number): void {
    // Approach, contact, result. He walks in, gets up on the pedal, and stays until
    // he is bored, which is the payoff beat.
    const walkIn = Math.min(1, v.age / 1.5);
    const leaving = v.phase === 'payoff' ? Math.min(1, (v.age - 0) / 1.2) : 0;
    const x = pedalX - 46 + walkIn * 44 + leaving * 52;
    const bob = Math.sin(beat * Math.PI * 2) * 1.2;
    const up = v.phase === 'setup' && walkIn >= 1 ? -6 : 0;
    drawRig(r.ctx, this.dogRig, x, floorY + up + bob * 0.4, {
      tail: { rot: Math.sin(beat * Math.PI * 3) * 24 },
      head: { rot: up ? -12 : Math.sin(beat) * 4 },
      legs: { ty: up ? -1 : 0 },
    });
  }

  // -------------------------------------------------------------------- drums side

  private drawDrumsRig(
    r: Renderer,
    beat: number,
    on: (t: string, k: string) => Visual | undefined,
  ): void {
    const L = this.venue.layout;
    const spot = L.spots.drums!;
    const ctx = r.ctx;
    const rig = this.rigs.get('drums')!;
    const fl = this.flourish.get('drums') ?? 1;

    const asleep = on('drums', 'asleep');
    const blanket = on('drums', 'blanketOnKit');
    const cymbal = on('drums', 'cymbalOnMic');
    const cup = on('drums', 'cupOnOverhead');
    const sleeping = !!(asleep && asleep.phase === 'setup');

    const ohX = spot.x + 20;
    const loop = sleeping ? 0 : 1;
    const sway = Math.sin(beat * Math.PI) * 2.4 * fl * loop;
    const armA = Math.sin(beat * Math.PI * 2) * 26 * fl * loop;
    const armB = Math.sin(beat * Math.PI * 2 + Math.PI) * 26 * fl * loop;
    const pose: Pose = {
      torso: { rot: sway },
      armNear: { rot: armA },
      armFar: { rot: armB },
      stickNear: { rot: -armA * 0.5 },
      stickFar: { rot: -armB * 0.5 },
      head: { rot: -sway * 0.4 },
      facePlay: { hidden: sleeping },
      faceAsleep: { hidden: !sleeping },
      faceStartle: { hidden: true },
    };
    if (sleeping) {
      // Head down onto the snare, arms dropped, sticks fallen. All transforms; doc
      // 17.3 promised this and it holds.
      const t = ease(asleep!.age, 0.7);
      pose.head = { rot: 62 * t, ty: 6 * t };
      pose.torso = { rot: 16 * t };
      pose.armNear = { rot: 78 * t };
      pose.armFar = { rot: -12 * t };
      pose.stickNear = { rot: 40 * t, ty: 8 * t };
      pose.stickFar = { rot: -70 * t, ty: 10 * t };
    } else if (asleep && asleep.phase === 'payoff' && asleep.age < 2.4) {
      pose.faceStartle = { hidden: false };
      pose.facePlay = { hidden: true };
      pose.faceAsleep = { hidden: true };
    }

    drawRig(ctx, rig, spot.x + 2, L.floorY - 6, pose);
    drawSprite(ctx, this.gear.kit, spot.x - 28, L.floorY - 34);

    // Cymbal on a stand. A long thing rotating: readable from anywhere on screen.
    const cymX = spot.x + 34;
    const cymY = L.floorY - 30;
    drawSprite(ctx, this.gear.cymbalStand, cymX, cymY);
    let cymRot = Math.sin(beat * Math.PI) * 3;
    if (cymbal && cymbal.phase === 'setup') {
      const t = ease(cymbal.age, 0.4);
      cymRot = -34 * t + (cymbal.escalated ? Math.sin(cymbal.age * 22) * 4 : Math.sin(cymbal.age * 11) * 2);
    }
    drawSprite(ctx, this.gear.cymbal, cymX + 5, cymY - 22, { rot: cymRot, pivot: [15, 4] });

    // The overhead boom: the drum channel's only ear, which is what makes anything
    // laid over the kit a real tone event (8.1b). Downstage of the kit so it reads.
    drawSprite(ctx, this.gear.overhead, ohX, L.floorY - 44);

    if (sleeping) {
      // A slow expanding ring at his head. No text, no letters, just a thing
      // breathing out of the man's face at 40 beats per minute.
      const t = (asleep!.age * 0.55) % 1;
      r.ring(spot.x + 14, L.floorY - 26, 3 + t * 9, withAlpha(UI.chalkDim, 0.5 * (1 - t)));
    }
    if (cup && cup.phase === 'setup') {
      // Upside down over the capsule, which is the only thing on stage that can make
      // a cup a drum-channel event at all (8.1b).
      const t = ease(cup.age, 0.35);
      drawSprite(ctx, this.gear.cup, ohX + 3, L.floorY - 50 + t * 18, {
        rot: 172,
        pivot: [8, 2],
      });
    }
    if (blanket && blanket.phase === 'setup') {
      const t = ease(blanket.age, 0.45);
      const settle = blanket.escalated ? Math.sin(blanket.age * 6) * 0.8 : 0;
      drawSprite(ctx, this.gear.blanket, spot.x - 32, L.floorY - 62 + t * 26 + settle);
    }
  }

  // --------------------------------------------------------------------- bass side

  private drawBassRig(
    r: Renderer,
    beat: number,
    on: (t: string, k: string) => Visual | undefined,
  ): void {
    const L = this.venue.layout;
    const spot = L.spots.bass!;
    const ctx = r.ctx;
    const rig = this.rigs.get('bass')!;
    const fl = this.flourish.get('bass') ?? 1;

    const pad = on('bass', 'diPad');
    const jack = on('bass', 'jackLoose');
    const padOn = !!(pad && pad.phase === 'setup');
    const jackOut = !!(jack && jack.phase === 'setup');

    const diX = spot.gearX;
    const diY = L.floorY - 18;
    drawSprite(ctx, this.gear.di, diX, diY);
    // The pad switch. On and off beats gradual (6.6.3): the switch translates and its
    // lamp goes out, both of which are two-frame changes.
    drawSprite(ctx, this.gear.diSwitch, diX + 3, diY + 8 + (padOn ? 2 : 0), { pivot: [0, 0] });
    drawSprite(ctx, padOn ? this.gear.lampOff : this.gear.lampOn, diX + 19, diY + 9, {
      pivot: [4.5, 4.5],
    });

    // His cable, drawn as a rope rather than a wire (6.4.1), running to the DI.
    const jackOffset = jackOut ? 3 : 0;
    r.line(spot.x + 6, L.floorY - 22, diX + 4 - jackOffset, diY + 4, MEMBERS.bass.colour.dark);
    r.line(spot.x + 6, L.floorY - 21, diX + 4 - jackOffset, diY + 5, MEMBERS.bass.colour.base);
    if (jackOut) {
      const n = jack!.escalated ? 4 : 2;
      for (let i = 0; i < n; i++) {
        const t = (jack!.age * 9 + i * 0.4) % 1;
        if (t > 0.5) continue;
        r.px(diX + 2 - jackOffset + (hash01(i, 3) * 4 - 2), diY + 3 + (hash01(i, 4) * 4 - 2), UI.lampOn);
      }
    }

    // He has never noticed anything is wrong and his loop never breaks, which is the
    // joke and also makes him a useful rhythmic reference for everyone else.
    const sway = Math.sin(beat * Math.PI * 0.5) * 2.6 * fl;
    const nod = Math.sin(beat * Math.PI) * 5 * fl;
    drawRig(ctx, rig, spot.x, L.floorY, {
      torso: { rot: sway },
      head: { rot: nod * 0.7 },
      armNear: { rot: Math.sin(beat * Math.PI * 2) * 8 * fl },
      armFar: { rot: -sway },
      facePlay: { hidden: false },
      faceBlank: { hidden: true },
      legs: { rot: padOn ? 4 : 0 },
    });
  }

  // ------------------------------------------------------------------------- crowd

  /** Doc 6.3 / 7.1: the crowd is a readable meter and it expresses energy diegetically. */
  private drawCrowd(r: Renderer, beat: number, energy: number, chanting: boolean): void {
    const L = this.venue.layout;
    const ctx = r.ctx;
    const n = L.crowd.count;
    const span = L.crowd.x1 - L.crowd.x0;
    const life = Math.max(0, Math.min(1, (energy - 12) / 78));
    for (let i = 0; i < n; i++) {
      const x = L.crowd.x0 + (span * i) / Math.max(1, n - 1) + (hash01(i, 7) * 10 - 5);
      const shape = this.crowdShapes[i % this.crowdShapes.length];
      const phase = beat * Math.PI + hash01(i, 8) * 1.4;
      const bob = Math.sin(phase) * (0.6 + life * 3.2);
      const lean = Math.sin(phase * 0.5) * (1 + life * 4);
      const surge = chanting ? 3 : 0;
      const y = L.height + 17 + surge * 0.5 - Math.abs(bob);
      drawSprite(ctx, shape, x, y, {
        rot: lean * 0.6,
        pivot: [8, shape.h],
        flip: i % 3 === 0,
        scale: 1.4,
      });
      if (chanting || life > 0.82) {
        // Arms up. One raised shape per person rather than a second drawing.
        r.rect_(x - 8, y - shape.h * 1.4 - 4 - surge, 2, 8, UI.crowdLit);
        r.rect_(x + 7, y - shape.h * 1.4 - 5 - surge, 2, 9, UI.crowdLit);
      }
    }
  }

  private drawNeighbour(r: Renderer, v: Visual, beat: number): void {
    const L = this.venue.layout;
    // Comes in from the side of the stage, holds the sign up, and does not move
    // otherwise. The cue states a goal, not a control (2.4).
    const inFrom = v.phase === 'setup' ? Math.min(1, v.age / 1.1) : Math.max(0, 1 - v.age / 1.1);
    const x = 460 - inFrom * 62;
    const shake = v.escalated ? Math.sin(v.age * 14) * 2.5 : Math.sin(beat) * 0.6;
    drawRig(r.ctx, this.neighbourRig, x, L.floorY + 2, {
      body: { rot: shake * 0.3 },
      arm: { rot: shake },
      head: { rot: -shake * 0.4 },
    });
    // Held up square to the camera, so it can be read. The sign states a goal and
    // leaves the player to pick the control, which is exactly what makes it legal
    // under the derivability rule (2.4).
    this.drawSign(r, x - 24 + shake, L.floorY - 74 + shake * 0.5, ['TURN', 'IT', 'DOWN']);
  }

  /** The other half of the master-volume tug of war (doc 5.3, 8.8). */
  private drawCrowdSign(r: Renderer, v: Visual): void {
    const L = this.venue.layout;
    const rise = v.phase === 'setup' ? Math.min(1, v.age / 0.9) : Math.max(0, 1 - v.age / 0.9);
    const wave = v.escalated ? Math.sin(v.age * 13) * 2.2 : Math.sin(v.age * 3) * 1;
    const x = L.crowd.x0 + (L.crowd.x1 - L.crowd.x0) * 0.62;
    this.drawSign(r, x + wave, L.height - 6 - rise * 30, ['LOUDER']);
  }

  private drawSign(r: Renderer, x: number, y: number, lines: string[]): void {
    drawSprite(r.ctx, this.sign, x, y);
    lines.forEach((line, i) => {
      drawText(r.ctx, line, x + 23, y + 5 + i * (lines.length > 2 ? 7 : 8), {
        colour: '#22201c',
        align: 'center',
        jitter: true,
      });
    });
  }

  private section(beat: number): string {
    const bar = beat / 4;
    if (bar < 8) return 'intro';
    if (bar < 40) return bar >= 32 && bar < 40 ? 'chorus2' : 'body';
    if (bar < 48) return 'solo';
    return 'body';
  }

  get layout() {
    return this.venue.layout;
  }
}

function ease(age: number, over: number): number {
  return Math.max(0, Math.min(1, age / over));
}

function withAlpha(hex: string, a: number): string {
  const v = Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${v}`;
}

/** Crowd colours are not channel colours: nothing out there owns a strip. */
function crowdPal(i: number): ChannelColour {
  const sets: ChannelColour[] = [
    { base: '#584a72', light: '#7a6896', dark: '#31284a', ink: '#150f22' },
    { base: '#6b4a58', light: '#8f6878', dark: '#3d2833', ink: '#1c1218' },
    { base: '#455a68', light: '#627d8d', dark: '#26343d', ink: '#101a20' },
    { base: '#5d5440', light: '#7d7358', dark: '#332e20', ink: '#161409' },
    { base: '#4f4f5e', light: '#6d6d80', dark: '#2b2b36', ink: '#131318' },
    { base: '#63483c', light: '#856454', dark: '#382720', ink: '#18100c' },
  ];
  return sets[i % sets.length];
}
