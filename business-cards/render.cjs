// Batch SVG -> PNG with Chromium (Playwright). Usage: node render.cjs manifest.json
// manifest: [{svg, png, w, h, scale, transparent?}]. If a screenshot fails (large images can exhaust
// one browser's memory over a long batch), the browser is restarted and the job retried once.
const { chromium } = require('playwright');
const fs = require('fs');

async function renderOne(browser, j) {
  const page = await browser.newPage({ viewport: { width: Math.round(j.w), height: Math.round(j.h) }, deviceScaleFactor: j.scale });
  try {
    await page.setContent(`<html><body style="margin:0;background:transparent">${fs.readFileSync(j.svg, 'utf8')}</body></html>`);
    await page.screenshot({ path: j.png, clip: { x: 0, y: 0, width: j.w, height: j.h }, omitBackground: !!j.transparent });
  } finally {
    await page.close();
  }
}

(async () => {
  const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  let browser = await chromium.launch();
  for (const j of jobs) {
    try {
      await renderOne(browser, j);
    } catch (e) {
      await browser.close().catch(() => {});
      browser = await chromium.launch();
      await renderOne(browser, j);
    }
  }
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
