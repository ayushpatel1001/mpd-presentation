// Render the logo reveal frame by frame in headless Chromium.
//   node render.mjs [--tl timeline.json]                 all frames → build/<name>/frames/f_00000.png …
//   node render.mjs [--tl …] --stills 0.3 1 4.1          single frames → build/<name>/stills/t01.00.png …
// <name> is the timeline's file name without .json (timeline, timeline_reel).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node-tools/node_modules/playwright'); } })();
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };

const srv = http.createServer((req, res) => {
  const file = path.normalize(path.join(ROOT, decodeURIComponent(req.url.split('?')[0])));
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(buf);
  });
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));

const ti = process.argv.indexOf('--tl');
const tlFile = ti > 0 ? process.argv[ti + 1] : 'timeline.json';
const tl = JSON.parse(fs.readFileSync(path.join(ROOT, tlFile), 'utf8'));
const [vw, vh] = tl.size || [1920, 1080];
const si = process.argv.indexOf('--stills');
const stills = si > 0 ? process.argv.slice(si + 1).filter((a) => !Number.isNaN(Number(a))).map(Number) : null;
const workers = stills ? 1 : 4;
const total = Math.round(tl.duration * tl.fps);
const dir = path.join(ROOT, 'build', path.basename(tlFile, '.json'), stills ? 'stills' : 'frames');
fs.mkdirSync(dir, { recursive: true });
const jobs = stills ? stills.map((t) => [t, path.join(dir, `t${t.toFixed(2).padStart(5, '0')}.png`)])
  : Array.from({ length: total }, (_, i) => [i / tl.fps, path.join(dir, `f_${String(i).padStart(5, '0')}.png`)]).filter(([, f]) => !fs.existsSync(f));

const browser = await chromium.launch();
const t0 = Date.now();
let done = 0;
await Promise.all(Array.from({ length: workers }, async (_, w) => {
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?render&tl=${encodeURIComponent(tlFile)}`);
  await page.waitForFunction(() => window.ready || window.bootError);
  const err = await page.evaluate(() => window.bootError);
  if (err) throw new Error(err);
  for (let j = w; j < jobs.length; j += workers) {
    const [t, file] = jobs[j];
    await page.evaluate((tt) => window.renderFrame(tt), t);
    // read the canvas directly (lossless, independent of page layout)
    const b64 = await page.evaluate(() => document.getElementById('c').toDataURL('image/png').split(',')[1]);
    fs.writeFileSync(file + '.tmp', Buffer.from(b64, 'base64')); fs.renameSync(file + '.tmp', file);
    if (++done % 60 === 0) console.log(`${done}/${jobs.length} frames · ${(done / ((Date.now() - t0) / 1000)).toFixed(1)} fps`);
  }
}));
await browser.close();
srv.close();
console.log(`rendered ${done} frame(s) in ${((Date.now() - t0) / 1000).toFixed(1)} s → ${path.relative(ROOT, dir)}`);
