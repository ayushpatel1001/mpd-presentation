// Shared static server + headless Chromium (SwiftShader WebGL) renderer used by the
// preview, render and validation scripts.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadPlaywright() {
  try { return require('playwright'); } catch { /* fall through to the preinstalled copy */ }
  return require('/opt/node-tools/node_modules/playwright');
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf' };

export function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]);
      const file = path.normalize(path.join(ROOT, rel));
      if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
        res.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout: ${what}`)), ms))]);

export async function openRenderer(srv, { quality = 94, frameTimeoutMs = 90000 } = {}) {
  const { chromium } = loadPlaywright();
  // launchServer gives a kill handle for wedged SwiftShader GPU processes
  const server = await chromium.launchServer({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
  const browser = await chromium.connect(server.wsEndpoint());
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  await page.goto(`http://127.0.0.1:${srv.address().port}/src/index.html`);
  await page.waitForFunction(() => window.ready || window.bootError, null, { timeout: 180000 });
  const err = await page.evaluate(() => window.bootError);
  if (err) throw new Error(`renderer failed to boot:\n${err}\n${logs.join('\n')}`);
  const cdp = await page.context().newCDPSession(page);
  return {
    browser, page, logs,
    // Rejects with "timeout" if SwiftShader stalls; callers relaunch the browser and retry.
    async frame(t, opts = {}) {
      return withTimeout((async () => {
        const info = await page.evaluate(async ([tt, o]) => {
          const r = window.renderFrame(tt, o);
          if (!o.noWait) await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
          return r;
        }, [t, opts]);
        const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality, optimizeForSpeed: true });
        return { jpeg: Buffer.from(shot.data, 'base64'), ...info };
      })(), frameTimeoutMs, `frame ${t}`);
    },
    async png(t, opts = {}) {
      const info = await page.evaluate(async ([tt, o]) => {
        const r = window.renderFrame(tt, o);
        await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
        return r;
      }, [t, opts]);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      return { png: Buffer.from(shot.data, 'base64'), ...info };
    },
    close: async () => {
      await withTimeout(browser.close(), 10000, 'browser close').catch(() => {});
      await server.kill().catch(() => {});
    },
  };
}

// A renderer that transparently relaunches Chromium when a frame stalls or the page crashes.
export async function resilientRenderer(srv, opts = {}) {
  let r = await openRenderer(srv, opts);
  const wrap = (fn) => async (t, o) => {
    for (let attempt = 1; ; attempt++) {
      try { return await r[fn](t, o); } catch (e) {
        if (attempt >= 3) throw e;
        console.log(`[renderer] ${e.message} — relaunching (attempt ${attempt + 1})`);
        await r.close();
        r = await openRenderer(srv, opts);
      }
    }
  };
  return {
    get page() { return r.page; },
    get logs() { return r.logs; },
    frame: wrap('frame'),
    png: wrap('png'),
    close: () => r.close(),
  };
}
