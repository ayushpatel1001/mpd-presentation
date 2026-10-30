// Overlay the rebuilt mark (trace/mark.json) on the original logo: original in grey, rebuilt outline in blue.
//   node trace/compare.mjs <logo.jpg> <mark.json> <out.png> [zoom]
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const [img, geoPath, out, zoom = '4'] = process.argv.slice(2);
const g = JSON.parse(fs.readFileSync(geoPath, 'utf8'));
const Z = Number(zoom), [x0, y0, x1, y1] = [80, 30, 475, 275];
const b64 = fs.readFileSync(img).toString('base64');
const html = `<body style="margin:0"><canvas id=c width=${(x1 - x0) * Z} height=${(y1 - y0) * Z}></canvas><script>
const c=document.getElementById('c').getContext('2d'); const im=new Image(); im.onload=()=>{
 c.imageSmoothingEnabled=false; c.setTransform(${Z},0,0,${Z},${-x0 * Z},${-y0 * Z}); c.globalAlpha=.35; c.drawImage(im,0,0); c.globalAlpha=1;
 const o=new Path2D(${JSON.stringify(g.outline)}); c.fillStyle='rgba(237,46,51,.45)'; c.fill(o);
 c.globalCompositeOperation='destination-out'; c.fill(new Path2D(${JSON.stringify(g.foldL)})); c.fill(new Path2D(${JSON.stringify(g.foldR)})); c.globalCompositeOperation='source-over';
 c.lineWidth=0.25; c.strokeStyle='#06f'; c.stroke(o); c.strokeStyle='#0a0'; c.stroke(new Path2D(${JSON.stringify(g.heartClip)}));
 document.title='done'};
 im.src='data:image/jpeg;base64,${b64}';</script></body>`;
const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: (x1 - x0) * Z, height: (y1 - y0) * Z } });
await pg.setContent(html); await pg.waitForFunction(() => document.title === 'done'); await pg.screenshot({ path: out }); await br.close();
