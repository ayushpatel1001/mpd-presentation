// Renders the explainer's frames with headless Chromium.
//   node render.mjs                         all frames -> build/frames/f_00000.jpg … (resumable)
//   node render.mjs --stills 12.5,40,95     single frames -> build/stills/t_<sec>.png
//   node render.mjs --workers 4 --from 0 --to 900
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };

const tl = JSON.parse(fs.readFileSync(path.join(HERE, 'build', 'timeline.json'), 'utf8'));
const FPS = tl.fps, TOTAL = Math.ceil(tl.duration * FPS);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  const p = path.join(HERE, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(HERE) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${srv.address().port}/src/index.html`;

const browser = await chromium.launch({ args: ['--disable-gpu-vsync'] });
async function newPage() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL_);
  await page.evaluate(async (t) => { await window.ready; window.setTimeline(t); }, tl);
  return { page, errors };
}
const grab = (page, t, type, q) => page.evaluate(({ t, type, q }) => {
  window.renderFrame(t);
  return document.getElementById('c').toDataURL(type, q).split(',')[1];
}, { t, type, q });

try {
  const stills = arg('stills', null);
  if (stills) {
    const out = path.join(HERE, 'build', 'stills');
    fs.mkdirSync(out, { recursive: true });
    const { page, errors } = await newPage();
    for (const s of stills.split(',').map(Number)) {
      fs.writeFileSync(path.join(out, `t_${s.toFixed(1)}.png`), Buffer.from(await grab(page, s, 'image/png'), 'base64'));
    }
    if (errors.length) console.log('page errors:\n' + [...new Set(errors)].slice(0, 10).join('\n'));
    console.log(`wrote ${stills.split(',').length} stills to ${out}`);
  } else {
    const dir = path.join(HERE, 'build', 'frames');
    fs.mkdirSync(dir, { recursive: true });
    const from = Number(arg('from', 0)), to = Number(arg('to', TOTAL)), workers = Number(arg('workers', 4));
    const name = (i) => path.join(dir, `f_${String(i).padStart(5, '0')}.jpg`);
    const todo = [];
    for (let i = from; i < to; i++) if (!fs.existsSync(name(i))) todo.push(i);
    console.log(`${todo.length} of ${to - from} frames to render (${TOTAL} total) with ${workers} workers`);
    let done = 0;
    const t0 = Date.now();
    const timer = setInterval(() => {
      const el = (Date.now() - t0) / 1000, fps = done / el;
      console.log(`${done}/${todo.length} · ${fps.toFixed(1)} fps · ETA ${((todo.length - done) / Math.max(fps, 0.01) / 60).toFixed(1)} min`);
    }, 30000);
    await Promise.all(Array.from({ length: workers }, async (_, w) => {
      const { page, errors } = await newPage();
      for (let j = w; j < todo.length; j += workers) {
        const i = todo[j];
        const b64 = await grab(page, i / FPS, 'image/jpeg', 0.93);
        fs.writeFileSync(name(i) + '.tmp', Buffer.from(b64, 'base64'));
        fs.renameSync(name(i) + '.tmp', name(i));
        done++;
      }
      if (errors.length) console.log(`worker ${w} page errors:\n` + [...new Set(errors)].slice(0, 10).join('\n'));
    }));
    clearInterval(timer);
    console.log(`rendered ${done} frames in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  }
} finally {
  await browser.close();
  srv.close();
}
