// Rasterise trace/logo_paths.json (with glyph boxes) for a visual check.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const j = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const [W, H] = j.size, Z = Number(process.argv[4] || 2);
const tf = `matrix(${j.unit},0,0,${-j.unit},0,${j.height * j.unit})`;
let svg = '';
for (const [k, p] of Object.entries(j.parts)) for (const g of [].concat(p)) {
  svg += `<path fill="${k === 'mark' ? '#ED2E33' : '#111'}" transform="${tf}" d="${g.d}"/>`;
  if (k !== 'mark') svg += `<rect x="${g.box[0]}" y="${g.box[1]}" width="${g.box[2] - g.box[0]}" height="${g.box[3] - g.box[1]}" fill="none" stroke="#0a0" stroke-width="0.3"/>`;
}
const html = `<body style="margin:0;background:#fff"><svg width="${W * Z}" height="${H * Z}" viewBox="0 0 ${W} ${H}">${svg}</svg></body>`;
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: W * Z, height: H * Z } });
await pg.setContent(html); await pg.screenshot({ path: process.argv[3] }); await b.close();
