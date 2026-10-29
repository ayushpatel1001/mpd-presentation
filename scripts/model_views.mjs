// Renders named model views (custom cameras, cutaway overrides, no HUD) for checking the 3D model
// against the drawings: node scripts/model_views.mjs [name ...]  → build/preview/model_<name>.jpg
import fs from 'node:fs';
import path from 'node:path';
import { serve, resilientRenderer, ROOT } from './browser.mjs';

const BASE = { blueprint: 0, buildingsRise: 1, siteDim: 0, fadeToBlack: 0, cardsBackdrop: 0, plant1Cutaway: 0, plant2Cutaway: 0, blenderCutaway: 0, pesoXray: 0 };
const QA = [6.1, 7, -44.0], P1 = [6.1, 8, -17.6];
const VIEWS = {
  qa_sw: { cam: { target: QA, radius: 42, elev: 16, azim: -38 } },
  qa_ne: { cam: { target: QA, radius: 40, elev: 16, azim: 138 } },
  qa_se: { cam: { target: QA, radius: 40, elev: 20, azim: 55 } },
  qa_cut: { cam: { target: [6.1, 6.0, -44], radius: 30, elev: 15, azim: 165 }, states: { qaCutaway: 1 } },
  qa_cut_top: { cam: { target: [6.1, 4, -44], radius: 34, elev: 58, azim: -20 }, states: { qaCutaway: 1 } },
  p1_sw: { cam: { target: P1, radius: 72, elev: 20, azim: -38 } },
  p1_nw: { cam: { target: P1, radius: 72, elev: 18, azim: -140 } },
  p1_cut: { cam: { target: P1, radius: 52, elev: 30, azim: -40 }, states: { plant1Cutaway: 1, plant2Cutaway: 1 } },
  p1_inside: { cam: { target: [6.1, 6.5, -14], radius: 24, elev: 9, azim: -14 }, states: { plant1Cutaway: 1 } },
  qa_s: { cam: { target: QA, radius: 48, elev: 40, azim: -25 } },
  p1_top: { cam: { target: [6.1, 0, -17.6], radius: 58, elev: 88, azim: 0 }, states: { plant1Cutaway: 1 } },
};
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VIEWS);
const out = path.join(ROOT, 'build', 'preview');
fs.mkdirSync(out, { recursive: true });
const srv = await serve();
const r = await resilientRenderer(srv);
try {
  for (const n of names) {
    const v = VIEWS[n];
    const t0 = Date.now();
    const f = await r.frame(60, { cam: v.cam, states: { ...BASE, ...(v.states || {}) }, noHud: true });
    fs.writeFileSync(path.join(out, `model_${n}.jpg`), f.jpeg);
    console.log(`${n.padEnd(12)} ${Date.now() - t0} ms`);
  }
  if (r.logs.length) console.log(r.logs.slice(0, 10).join('\n'));
} finally {
  await r.close();
  srv.close();
}
