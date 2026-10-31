// Renders PNG views of the full-size model through the web viewer (real z-buffer, same rig as the
// interactive page).  Run from the repo root after `npm install`:
//   node drop-bottom-bin/cad/render_views.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const repo = path.resolve(root, "..");
const viewer = path.join(root, "viewer");
const out = path.join(root, "renders");
fs.mkdirSync(out, { recursive: true });

const page_html = "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width'></head><body>" +
  fs.readFileSync(path.join(viewer, "index.html"), "utf8") + "</body></html>";

let SCENE = "scene.json";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1 });
page.on("console", m => { if (m.type() === "error") console.log("console:", m.text()); });
page.on("pageerror", e => console.log("pageerror:", e.message));
await page.route("**/*", route => {
  const url = route.request().url();
  if (url.startsWith("https://cdn.jsdelivr.net/npm/three@0.170.0/")) {
    const rel = url.replace("https://cdn.jsdelivr.net/npm/three@0.170.0/", "");
    return route.fulfill({ path: path.join(repo, "node_modules", "three", rel), contentType: "text/javascript" });
  }
  if (url.startsWith("http://bin.local/scene.json")) return route.fulfill({ path: path.join(viewer, SCENE), contentType: "application/json" });
  if (url.startsWith("http://bin.local/")) return route.fulfill({ body: page_html, contentType: "text/html" });
  if (url.includes("fonts.g")) return route.abort();
  return route.continue();
});
async function load() {
  await page.goto("http://bin.local/index.html");
  await page.waitForFunction(() => window.binApi && window.binApi.ready, null, { timeout: 60000 });
}
await load();
const shots = [
  ["01_closed_iso", "all", false, false],
  ["02_released_underside", "under", true, true],
  ["03_side_mechanism_locked", "side", false, false],
  ["04_side_mechanism_A_only_blocked", "side", true, false],
  ["05_side_mechanism_A_and_B_released", "side", true, true],
  ["06_end_latch_locked", "end", false, false],
  ["07_end_latch_released", "end", true, true],
];
for (const [name, v, a, b] of shots) {
  await page.evaluate(([v, a, b]) => { window.binApi.set(false, false); window.binApi.settle(300);
    if (window.__open) { window.binApi.ground(); window.binApi.settle(300); }
    window.binApi.set(a, b); window.binApi.settle(400); window.__open = a && b; window.binApi.view(v); window.binApi.settle(5); }, [v, a, b]);
  await page.waitForTimeout(300);
  const el = await page.$(".app");
  await el.screenshot({ path: path.join(out, name + ".png") });
  console.log("wrote", name);
}
// 1:8 printable model, scaled x8 for display
SCENE = "scene_print.json";
await load();
for (const [name, v, a, b] of [["08_print_model_locked", "all", false, false], ["09_print_model_released", "under", true, true]]) {
  await page.evaluate(([v, a, b]) => { window.binApi.set(a, b); window.binApi.settle(400); window.binApi.view(v); window.binApi.settle(5); }, [v, a, b]);
  await page.waitForTimeout(300);
  await (await page.$(".stage")).screenshot({ path: path.join(out, name + ".png") });
  console.log("wrote", name);
}
await browser.close();
