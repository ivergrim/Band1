// Grabs a set of screenshots from a running preview server, for eyeballing changes
// and for the doc 19.1 readability measurement.
//
//   npm run build && npx vite preview --port 4173 &
//   node tools/screenshots.mjs [outDir]
import { chromium } from 'playwright';

const OUT = process.argv[2] ?? 'shots';
const EXE = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const errs = [];
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
page.on('pageerror', (e) => errs.push(e.message));

const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const clickB = async (x, y, w = 260) => {
  await page.mouse.click(x * 3, y * 3);
  await page.waitForTimeout(w);
};

await page.goto('http://127.0.0.1:4173/');
// Seed a save that has seen the whole tier, so every screen is reachable.
await page.evaluate(() =>
  localStorage.setItem(
    'bandruptcy.save.v1',
    JSON.stringify({
      v: 1,
      money: 240,
      gear: ['spring-reverb'],
      wearables: ['shades', 'stetson', 'brace'],
      worn: { guitar: 'shades', bass: 'stetson', drums: 'brace' },
      bag: { airhorn: 1, gaffer: 1, biscuits: 1 },
      best: { garage: 88, denise: 74 },
      cleared: ['garage', 'denise'],
      jobsOffered: [],
      jobAccepted: 'job-rival',
      jobsDone: [],
      seen: ['pitch:garage', 'pitch:denise', 'pitch:sump'],
      masterMix: 0.8,
    }),
  ),
);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await shot('title');
await clickB(240, 135, 1600);
await shot('office');
await clickB(240, 165, 900);
await shot('store');
await clickB(270, 218, 500);
await clickB(72, 222, 700);
await shot('map');
await clickB(366, 176, 4000);
await shot('gig-ready');
await clickB(240, 200, 900);
for (const t of [10, 24, 40, 58, 74, 88]) {
  await page.waitForTimeout(t === 10 ? 10000 : 14000);
  await shot(`gig-${t}s`);
}
console.log(errs.length ? JSON.stringify(errs, null, 1) : 'no console errors');
await browser.close();
