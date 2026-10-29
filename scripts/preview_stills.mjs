// Renders individual frames for visual QA: node scripts/preview_stills.mjs 3 12.5 40 ...
// Writes build/preview/t<time>.jpg and reports per-frame render time.
import fs from 'node:fs';
import path from 'node:path';
import { serve, openRenderer, ROOT } from './browser.mjs';

const times = process.argv.slice(2).map(Number);
if (!times.length) { console.error('usage: preview_stills.mjs <t> [t...]'); process.exit(1); }
const out = path.join(ROOT, 'build', 'preview');
fs.mkdirSync(out, { recursive: true });
const srv = await serve();
const r = await openRenderer(srv);
try {
  for (const t of times) {
    const t0 = Date.now();
    const f = await r.frame(t);
    const file = path.join(out, `t${t.toFixed(2).padStart(6, '0')}.jpg`);
    fs.writeFileSync(file, f.jpeg);
    console.log(`${t.toFixed(2)}s  ${f.shot.padEnd(12)} ${Date.now() - t0} ms  ${f.manifest.length} text items → ${path.relative(ROOT, file)}`);
  }
  if (r.logs.length) console.log(r.logs.slice(0, 20).join('\n'));
} finally {
  await r.close();
  srv.close();
}
