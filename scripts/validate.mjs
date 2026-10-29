// Validation capture: (A) dense HUD text manifests every 0.1 s (HUD-only, fast);
// (B) full frames + text-hidden background frames at key moments for contrast checks.
// Then runs scripts/validate_analyze.py which writes build/validation/report.{json,md}.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { serve, openRenderer, ROOT } from './browser.mjs';

const OUT = path.join(ROOT, 'build', 'validation');
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
const tl = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'timeline.resolved.json'), 'utf8'));
const D = tl.meta.durationSec;

const srv = await serve();
const r = await openRenderer(srv, { quality: 96 });
try {
  // (A) dense manifests
  const dense = [];
  const t0 = Date.now();
  for (let i = 0; i <= D * 10; i++) {
    const t = i / 10;
    const m = await r.page.evaluate((tt) => window.renderFrame(tt, { hudOnly: true }).manifest, t);
    dense.push({ t, items: m.map((x) => ({ o: x.owner, s: x.text, b: [x.x0, x.y0, x.x1, x.y1].map((v) => Math.round(v * 10) / 10), z: Math.round(x.size * 10) / 10, w: x.weight, c: x.color, a: Math.round(x.alpha * 1000) / 1000 })) });
  }
  fs.writeFileSync(path.join(OUT, 'manifest_dense.json'), JSON.stringify(dense));
  console.log(`dense manifests: ${dense.length} samples in ${((Date.now() - t0) / 1000).toFixed(0)} s`);

  // (B) sampled frames: every overlay (and nested item) shortly after it lands, mid-way, and before exit
  const times = new Set();
  const add = (t) => { if (t >= 0 && t <= D - 0.05) times.add(Math.round(t * 10) / 10); };
  for (const ov of tl.overlays) {
    if (ov.type === 'captions') continue;
    add(ov.in + 0.8); add((ov.in + ov.out) / 2); add(Math.min(ov.out, D) - 0.5);
    const p = ov.props || {};
    for (const it of [...(p.rows || []), ...(Array.isArray(p.items) ? p.items : [])]) if (typeof it === 'object' && it.t) add(it.t + 0.9);
    if (p.total?.t) add(p.total.t + 1.2);
  }
  for (const c of tl.captions) add((c.start + c.end) / 2);
  for (let t = 1; t < D; t += 4) add(t);
  const list = [...times].sort((a, b) => a - b);
  const t1 = Date.now();
  const frames = [];
  for (const [i, t] of list.entries()) {
    const full = await r.frame(t);
    const bg = await r.frame(t, { hideText: true });
    const id = `t${t.toFixed(1).padStart(5, '0')}`;
    fs.writeFileSync(path.join(OUT, 'frames', `${id}_full.jpg`), full.jpeg);
    fs.writeFileSync(path.join(OUT, 'frames', `${id}_bg.jpg`), bg.jpeg);
    frames.push({ t, id, shot: full.shot, manifest: full.manifest });
    if (i % 20 === 0) console.log(`frames ${i + 1}/${list.length} (${((Date.now() - t1) / 1000).toFixed(0)} s)`);
  }
  fs.writeFileSync(path.join(OUT, 'frames.json'), JSON.stringify(frames));
  if (r.logs.length) fs.writeFileSync(path.join(OUT, 'browser_log.txt'), r.logs.join('\n'));
} finally {
  await r.close();
  srv.close();
}

const res = spawnSync('python3', [path.join(ROOT, 'scripts', 'validate_analyze.py')], { stdio: 'inherit' });
process.exit(res.status ?? 1);
