import { Game } from './game/app';

const canvas = document.getElementById('screen') as HTMLCanvasElement | null;
if (!canvas) throw new Error('no canvas');

const game = new Game(canvas);
game.start();

// Handy in the console while playtesting; not used by the game itself.
(window as unknown as { bandruptcy: Game }).bandruptcy = game;
