# MPD Industries – Ujjain Plant · interactive 3D model

A Three.js model of the Ujjain site (laid out from site-plan drawing PP-A-DR-SP-001-2525 R2) that opens in any
modern browser. Orbit, pan and zoom freely, jump between preset views, and open up the buildings.

## Run it

```bash
node serve.mjs          # then open http://127.0.0.1:5173/
```

No `npm install` is needed: Three.js is vendored in `vendor/`. Any static file server works too
(e.g. `python3 -m http.server`, then open `/src/index.html`) — the page must be served over http, not opened as a `file://`.

## Controls

* **Drag** to orbit · **right-drag / two fingers** to pan · **scroll / pinch** to zoom · **double-click** to re-centre on a point.
* **Views**: Aerial, Top plan, Plant 1, Plant 2, Warehouses, QA / QC, Blender + FG, Tank farms, Utilities, PESO pit.
* **Open up**: cut away Plant 1, Plant 2, Warehouse-1/2, the QA/QC building, the blender house, and x-ray the PESO tank pit.
* **Layers**: rooftop solar (0.70 MWp), equipment running (reactor, flaker, pelletiser, cranes), utilities glow.
* **Pipe flows**: thermic oil, cooling water, nitrogen, effluent, resin, solvent.
* **Replay build-up** re-runs the greenfield rise of the buildings.

## Layout

```
serve.mjs          tiny static server
src/index.html     page + control panel
src/main.js        viewer: orbit camera, UI, per-frame state easing
src/scene/         the model — one module per area (site, process, finishing, tanks, utilities, flows, qaqc, warehouse, solar)
  layout.js        site-plan coordinates for every building / tank farm / road
  world.js         renderer, sun + sky, post-processing (bloom, ACES tone map, FXAA)
vendor/three/      Three.js r170 + the few addons used
```

The earlier narrated film pipeline (timeline, HUD, TTS, ffmpeg) lives on the original branches and is not part of this one.
