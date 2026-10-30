#!/usr/bin/env node
// Serve the Three.js scene for interactive browser preview.
// Usage: npm run view   →  http://127.0.0.1:5173/src/index.html
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 5173;
const HOST = process.env.HOST || '127.0.0.1';
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.css': 'text/css',
};

const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = path.normalize(path.join(ROOT, rel === '/' ? '/src/index.html' : rel));
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end(`Not found: ${rel}`); return; }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(buf);
  });
});

srv.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}/src/index.html`;
  console.log(`MPD showcase preview → ${url}`);
  console.log('Play/Pause + scrubber appear after the scene boots. Ctrl+C to stop.');
});
