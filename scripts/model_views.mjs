// Renders named model views (custom cameras, cutaway overrides, no HUD) for checking the 3D model
// against the drawings: node scripts/model_views.mjs [name ...]  → build/preview/model_<name>.jpg
import fs from 'node:fs';
import path from 'node:path';
import { serve, resilientRenderer, ROOT } from './browser.mjs';

const BASE = { blueprint: 0, buildingsRise: 1, siteDim: 0, fadeToBlack: 0, cardsBackdrop: 0, plant1Cutaway: 0, plant2Cutaway: 0, blenderCutaway: 0, pesoXray: 0, wh1Cutaway: 0, wh2Cutaway: 0, qaCutaway: 0, modelLabels: 0 };
const QA = [6.1, 7, -44.0], P1 = [6.1, 8, -17.6], WH1 = [-26.2, 4, -17.6], WH2 = [-25.2, 4, 35.8];
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
  // warehouses, depalletiser → jumbo bag → crane, rooftop solar (labels on)
  site_sun: { cam: { target: [-5, 0, -5], radius: 215, elev: 42, azim: -28 }, states: { modelLabels: 1 }, labels: ['wh1', 'wh2', 'solarWh1'] },
  wh_ext: { cam: { target: [-26, 4, -5], radius: 95, elev: 30, azim: -62 } },
  wh1_cut: { cam: { target: WH1, radius: 74, elev: 46, azim: 58 }, states: { wh1Cutaway: 1, modelLabels: 1 }, labels: ['wh1Racks', 'depalletiser'] },
  wh1_racks: { cam: { target: [-22.0, 4, -35.5], radius: 19, elev: 17, azim: 86, fov: 48 }, states: { wh1Cutaway: 1 } },
  wh1_depal: { cam: { target: [-19.0, 1.8, -10.5], radius: 21, elev: 30, azim: 62 }, states: { wh1Cutaway: 1 } },
  wh2_cut: { cam: { target: WH2, radius: 56, elev: 42, azim: 28 }, states: { wh2Cutaway: 1, modelLabels: 1 }, labels: ['wh2Racks'] },
  p1_hoist: { t: 6.5, cam: { target: [4.0, 6.5, -31.8], radius: 12.5, elev: 6, azim: -78, fov: 58 }, states: { plant1Cutaway: 1, modelLabels: 1 }, labels: ['p1Hoist'] },
  p1_discharge: { t: 21, cam: { target: [5.2, 8.6, -31.5], radius: 11, elev: 14, azim: -66, fov: 50 }, states: { plant1Cutaway: 1 } },
};
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VIEWS);
const out = path.join(ROOT, 'build', 'preview');
fs.mkdirSync(out, { recursive: true });
const srv = await serve();
const r = await resilientRenderer(srv);
try {
  console.log(JSON.stringify(await r.page.evaluate(() => window.__model)));
  for (const n of names) {
    const v = VIEWS[n];
    const t0 = Date.now();
    const f = await r.frame(v.t ?? 60, { cam: v.cam, states: { ...BASE, ...(v.states || {}) }, noHud: true, labels: v.labels });
    fs.writeFileSync(path.join(out, `model_${n}.jpg`), f.jpeg);
    console.log(`${n.padEnd(12)} ${Date.now() - t0} ms`);
  }
  if (r.logs.length) console.log(r.logs.slice(0, 10).join('\n'));
} finally {
  await r.close();
  srv.close();
}
