// Batch SVG -> PNG with Chromium (Playwright). Usage: node render.cjs manifest.json
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const browser = await chromium.launch();
  for (const j of jobs) {
    const page = await browser.newPage({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: j.scale });
    await page.setContent(`<html><body style="margin:0;background:transparent">${fs.readFileSync(j.svg, 'utf8')}</body></html>`);
    await page.screenshot({ path: j.png, clip: { x: 0, y: 0, width: j.w, height: j.h }, omitBackground: !!j.transparent });
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
