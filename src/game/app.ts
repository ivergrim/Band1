import { audio } from '../core/audio/engine';
import { TICK_DT, VIEW_H, VIEW_W } from '../core/config';
import { drawText } from '../core/font';
import { Input } from '../core/input';
import { UI } from '../core/palette';
import { Renderer } from '../core/renderer';
import { hash01 } from '../core/rng';
import { load as loadSave, save as writeSave, wipe, type SaveData } from '../core/save';
import { BAND_NAME } from './content/cast';
import { TITLE } from './content/copy';
import type { Venue } from './content/venues';
import { GigScene, type GigOutcome } from './gig/gigScene';
import { HubScene, preloadHubArt } from './hub/hubScene';

export type Scene = {
  update(dt: number, input: Input): void;
  draw(r: Renderer): void;
};

export class Game {
  save: SaveData;
  /** Current scene. Exposed for playtest scripting via window.bandruptcy. */
  scene: Scene;
  private renderer: Renderer;
  private input: Input;
  private acc = 0;
  private last = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.save = loadSave();
    this.renderer = new Renderer(canvas);
    this.input = new Input(this.renderer);
    this.scene = new TitleScene(this);
    audio.setOutputVolume(this.save.masterMix);
  }

  start(): void {
    document.getElementById('boot')?.classList.add('gone');
    this.last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.acc += dt;
      this.input.beginFrame();
      // Fixed step, so the scoring clocks and the drain rates in doc 12.2 mean the
      // same thing on every machine.
      let steps = 0;
      while (this.acc >= TICK_DT && steps < 6) {
        this.scene.update(TICK_DT, this.input);
        this.acc -= TICK_DT;
        steps++;
      }
      if (steps === 0) this.scene.update(0, this.input);
      this.scene.draw(this.renderer);
      this.input.endFrame();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  persist(): void {
    writeSave(this.save);
  }

  toHub(outcome: GigOutcome | null = null): void {
    this.scene = new HubScene(this, outcome);
  }

  toGig(venue: Venue): void {
    this.scene = new GigScene(this, venue);
  }

  resetSave(): void {
    wipe();
    this.save = loadSave();
    this.scene = new TitleScene(this);
  }
}

/** Title card. Also the user gesture that unlocks the audio context. */
class TitleScene implements Scene {
  private t = 0;
  private armed = false;

  constructor(private game: Game) {
    void preloadHubArt();
  }

  update(dt: number, input: Input): void {
    this.t += dt;
    if (input.keyPressed('KeyR') && input.key('ShiftLeft')) {
      this.game.resetSave();
      return;
    }
    if (this.t < 0.4) return;
    if (input.p.pressed || input.keyPressed('Space')) {
      if (this.armed) return;
      this.armed = true;
      void audio.init().then(() => {
        audio.chrome?.fanfare();
        this.game.toHub();
      });
    }
  }

  draw(r: Renderer): void {
    r.clear(UI.black);
    // A drawn backdrop: cables, a stack, the suggestion of a room.
    for (let i = 0; i < 90; i++) {
      const x = hash01(i, 41) * VIEW_W;
      const y = hash01(i, 42) * VIEW_H;
      r.px(x, y, hash01(i, 43) > 0.6 ? '#1d1a22' : '#161320');
    }
    r.rect_(0, 214, VIEW_W, 56, '#14111a');
    r.rect_(0, 212, VIEW_W, 2, '#241f2e');
    for (let i = 0; i < 5; i++) {
      const x = 30 + i * 108;
      r.rect_(x, 178, 22, 36, '#241f1a');
      r.rect_(x + 2, 180, 18, 15, '#332c24');
      r.disc(x + 11, 187, 5, '#15110d');
      r.rect_(x, 194, 22, 3, i % 2 ? '#f0801c' : '#57c94a');
    }
    const wob = Math.sin(this.t * 1.4) * 2;
    drawText(r.ctx, TITLE.name, VIEW_W / 2, 74 + wob, {
      colour: UI.lampOn,
      align: 'center',
      jitter: true,
      scale: 4,
      shadow: '#5a3a06',
    });
    drawText(r.ctx, TITLE.tag, VIEW_W / 2, 118, {
      colour: UI.chalkDim,
      align: 'center',
      jitter: true,
      scale: 1,
    });
    drawText(r.ctx, BAND_NAME, VIEW_W / 2, 140, {
      colour: '#f0801c',
      align: 'center',
      jitter: true,
    });
    if (Math.floor(this.t * 1.6) % 2 === 0) {
      drawText(r.ctx, TITLE.prompt, VIEW_W / 2, 164, {
        colour: UI.chalk,
        align: 'center',
        jitter: true,
      });
    }
    drawText(r.ctx, TITLE.footer, VIEW_W / 2, 252, {
      colour: UI.inkFaint,
      align: 'center',
    });
    drawText(r.ctx, 'SHIFT+R wipes the save', 6, 6, { colour: UI.inkFaint });
  }
}
