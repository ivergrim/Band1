// Scripted competent player: reads each control's demand and moves it there after a
// human-ish reaction delay. Verifies that the whole scoring loop is winnable and that
// the setup/payoff structure and speed bonus behave.
import { chromium } from 'playwright';
const REACT = Number(process.argv[2] ?? 1.2);  // seconds of "reaction time"
const VENUE = process.argv[3] ?? 'garage';
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://127.0.0.1:4173/');
await page.evaluate(() => localStorage.setItem('bandruptcy.save.v1', JSON.stringify({
  v: 1, money: 300, gear: ['spring-reverb'], wearables: [], worn: {}, bag: {},
  best: {}, cleared: ['garage', 'denise'], jobsOffered: [], jobAccepted: null,
  jobsDone: [], seen: ['pitch:garage', 'pitch:denise', 'pitch:sump'], masterMix: 0.0,
})));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const B = (x, y) => [x * 3 / 3 * 2, y * 2];
const clickB = async (x, y, w = 250) => { await page.mouse.click(x * 2, y * 2); await page.waitForTimeout(w); };
await clickB(240, 135, 1400);
await clickB(72, 222, 600);
const pin = { garage: [84, 138], denise: [252, 108], sump: [366, 176] }[VENUE];
await clickB(pin[0], pin[1], 3500);
await clickB(240, 200, 800);

const result = await page.evaluate(async (react) => {
  const g = window.bandruptcy;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const seen = new Map();
  let ticks = 0;
  for (;;) {
    const s = g.scene;
    if (!s.probe) return { err: 'no probe' };
    const p = s.probe();
    if (p.phase === 'results') return { energy: p.energy, done: true, ticks };
    if (p.phase !== 'playing') { await sleep(100); continue; }
    for (const d of p.demands) {
      const key = `${d.target}:${d.kind}`;
      const want = d.kind === 'fx' ? (d.fx ? 1 : 0) : (d.lo + d.hi) / 2;
      const prev = seen.get(key);
      if (!prev || prev.want !== want) {
        seen.set(key, { want, at: p.songTime });
        continue;
      }
      // Act only after the reaction delay has elapsed, like a person would.
      if (p.songTime - prev.at >= react && !prev.acted) {
        prev.acted = true;
        s.poke(d.target, d.kind, d.kind === 'fx' ? !!d.fx : want);
      }
    }
    ticks++;
    await sleep(80);
  }
}, REACT);
console.log(JSON.stringify({ venue: VENUE, react: REACT, ...result, errs }));
await browser.close();
