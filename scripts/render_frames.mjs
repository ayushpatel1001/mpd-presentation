// Renders every frame of the film to build/frames/f_00000.jpg … (resumable: existing frames are skipped).
//   node scripts/render_frames.mjs [--workers 2] [--from 0] [--to 5400] [--quality 93]
//   draft: node scripts/render_frames.mjs --fps 8 --scale 0.5 --dir frames_draft
// Each worker renders one contiguous block so per-worker state (shadow map refreshes) stays deterministic.
import fs from 'node:fs';
import path from 'node:path';
import { serve, resilientRenderer, ROOT } from './browser.mjs';

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? Number(process.argv[i + 1]) : def; };
const sarg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : def; };
const tl = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'timeline.resolved.json'), 'utf8'));
const FPS = arg('fps', tl.meta.fps);
const scale = arg('scale', 0);
const TOTAL = Math.round(tl.meta.durationSec * FPS);
const workers = arg('workers', 2), from = arg('from', 0), to = arg('to', TOTAL), quality = arg('quality', 93);
const dir = path.join(ROOT, 'build', sarg('dir', 'frames'));
fs.mkdirSync(dir, { recursive: true });
const name = (i) => path.join(dir, `f_${String(i).padStart(5, '0')}.jpg`);

const todo = [];
for (let i = from; i < to; i++) if (!fs.existsSync(name(i))) todo.push(i);
console.log(`${todo.length} of ${to - from} frames to render with ${workers} worker(s)`);
if (!todo.length) process.exit(0);

const chunk = Math.ceil(todo.length / workers);
const blocks = Array.from({ length: workers }, (_, w) => todo.slice(w * chunk, (w + 1) * chunk)).filter((b) => b.length);
const srv = await serve();
let done = 0;
const t0 = Date.now();
const timer = setInterval(() => {
  const el = (Date.now() - t0) / 1000, fps = done / Math.max(el, 1e-3);
  console.log(`${done}/${todo.length} frames · ${fps.toFixed(2)} fps · elapsed ${(el / 60).toFixed(1)} min · ETA ${((todo.length - done) / Math.max(fps, 1e-3) / 60).toFixed(1)} min`);
}, 60000);

try {
  await Promise.all(blocks.map(async (block) => {
    const r = await resilientRenderer(srv, { quality, query: scale ? `?scale=${scale}` : '' });
    try {
      for (const i of block) {
        const f = await r.frame(i / FPS);
        const tmp = name(i) + '.tmp';
        fs.writeFileSync(tmp, f.jpeg);
        fs.renameSync(tmp, name(i));
        done++;
      }
      if (r.logs.length) console.log(r.logs.slice(0, 10).join('\n'));
    } finally {
      await r.close();
    }
  }));
} finally {
  clearInterval(timer);
  srv.close();
}
console.log(`rendered ${done} frames in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
