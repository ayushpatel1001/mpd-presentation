# MPD Industries – Ujjain Plant · 3-minute 3D/2D showcase

> “From 2 KL pilot trials to 82,800 tons/year commercial output — MPD Industries' greenfield Ujjain
> plant is a high-capacity, technology-driven manufacturing partner for global chemical brands.”

A 180-second, 1920×1080 / 30 fps hybrid motion-graphics film for B2B jobwork partners, built entirely
in code: a Three.js model of the Ujjain site (laid out from site-plan drawing PP-A-DR-SP-001-2525 R2)
with a Canvas 2D HUD on top, rendered frame-by-frame in headless Chromium and muxed with FFmpeg.

| Output | |
|---|---|
| `out/mpd_ujain_3min_3d2d_showcase.mp4` | narrated master (H.264 + AAC, −14 LUFS) |
| `out/mpd_ujain_3min_3d2d_showcase_music_only.mp4` | same picture, score + SFX only (built locally, not committed) |
| `out/validation_report.md` | automated contrast / legibility / safe-area / sync / loudness report |
| `out/contact_sheet_*.jpg` | stills across the film |

## Structure of the film (beat grid)

128 BPM; eight sections follow the material flow through the plant, with short shots (3–7 s), quick
whoosh cuts and a slightly faster voice. Camera moves and section changes land on bar lines; HUD pops land
on the narrated word they illustrate (resolved from word timestamps).

| # | Section | Time | 3D | 2D |
|---|---|---|---|---|
| 01 | Greenfield site | 0:00–0:15 | blueprint → plant rises, aerial descent | logo, 22 reactors / ~6,900 T/month, zone callouts |
| 02 | Storage & material handling | 0:15–0:39 | Warehouse-1 cut away (mobile compact racking), depalletiser → jumbo-bag cell, PESO x-ray | 2,904 pallets ≈ 1,500 t (WH-1 1,464 + WH-2 1,440), 600 KL solvents |
| 03 | Plant 1 – liquid resins | 0:39–1:04 | EOT crane hoisting a jumbo bag to the charging deck, wedge-cut 16 KL reactor | 4,373 T/month split |
| 04 | Plant 2 – solid & specialty | 1:04–1:24 | flaker, pelletiser | finishing chips, 2,530 T/month matrix |
| 05 | QC & application labs | 1:24–1:41 | QA/QC building cut away floor by floor | QC lab, application lab, weathering/physical tests, central control room |
| 06 | Blending & finished goods | 1:41–2:00 | blender house, FG tank farm, storage wide | 380 KL blending, ~1,045 KL FG, **total storage: 1,500 t packed + 1,645 KL bulk** |
| 07 | Green utilities & EHS | 2:00–2:30 | thermic heaters, covered agro-waste fuel shed, 50 KLD ETP, rooftop solar wide | heaters, fuel shed, 2,200 TR cooling, N₂, 50 KLD ETP, 0.70 MWp solar |
| 08 | Partnership | 2:30–3:00 | isometric orbit | toll / full-service / dedicated cards, closing logo card |

## Pipeline

```
data/beat_grid.json ─┐                                     ┌─ src/ (Three.js scene + Canvas HUD)
data/style_tokens.json┤                                    │        │ window.renderFrame(t)
                      ├─ scripts/narration.py  → build/vo/*.wav, data/narration_layout.json
                      ├─ scripts/align.py      → data/whisper_timestamps.json
                      ├─ scripts/resolve_timeline.py → data/timeline.resolved.json ─┤
                      ├─ scripts/audio.py      → build/audio/mix_*.wav             │
                      ├─ scripts/validate.mjs + validate_analyze.py → report      ─┤
                      └─ scripts/render_frames.mjs → build/frames → scripts/encode.sh → out/*.mp4
```

Run everything with `scripts/build.sh` (needs Node 22, Python 3 with numpy/scipy/Pillow/pocketsphinx,
FFmpeg, Playwright's Chromium, and the `rhvoice rhvoice-english` apt packages).
`node scripts/preview_stills.mjs 12 40 95` renders individual frames to `build/preview/` for quick looks.

* **Deterministic rendering.** Every animation (camera, liquid level, flakes, pellets, plumes, flow
  pulses) is a pure function of `t`, so frames can be rendered in any order or in parallel.
* **Renderer.** Headless Chromium + SwiftShader WebGL. The 3D layer renders at 1600×900 into an HDR
  target with depth, then quarter-res bloom, a depth-of-field gather, ACES tone mapping and FXAA
  upscale to 1080p; the HUD is a native-resolution 2D canvas on top. Lambert/Phong shading keeps it
  around one second per frame on CPU.
* **Audio.** The score (pads, pulsing bass, arpeggio, drums, bell lead), UI clicks, pneumatic
  whooshes, risers/impacts and sub-bass thumps are synthesized in numpy from the same resolved
  timeline the renderer uses. Music ducks under the voice and both mixes are loudness-normalized.

## Narration and timestamps

Hugging Face and the Whisper model host are not reachable from the build environment, so:

* **Voice** is RHVoice (`bdl`, offline, apt), driven by phonetic respellings in the beat grid
  (`{Ujjain|oo jane}`, `{MPD|M P D}`, numbers written out) while captions show the real text.
  It is intelligible but clearly synthetic. To use a professional voice-over, drop one WAV per line
  into `build/vo_override/<line id>.wav` (ids in `data/beat_grid.json`) and re-run `scripts/build.sh`;
  timing, captions, HUD cues and SFX all re-derive from the new recording.
* **`data/whisper_timestamps.json`** uses Whisper's word-timestamp schema but is produced by
  PocketSphinx forced alignment against the known script (word posteriors 0.85–0.99), which is
  more exact than free ASR for a fixed script.

## 3D model sources

| Model | Source drawings |
|---|---|
| Site layout, roads, tank farms, utilities | PP-A-DR-SP-001-2525 R2 site plan (survey grid → world: X = E − 85, Z = 95 − N) |
| QA & QC / control room (`src/scene/qaqc.js`) | PP-A-DR-QC-101/102/103 (GF/FF/SF plans), QC-201 elevations, QC-301 sections — grids A–D × 01–03, floors 0/+4.5/+9.0, terrace +13.5, stair cabin +16.6 with glass curtain wall, emergency stair, every room's partitions, benches and equipment |
| Plant 1 (`src/scene/process.js`, `layout.js`) | PP-A-DR-PB1-102 (MEZZ-1 +3.40), PB1-104 (MEZZ-2 +7.50), PB1-301 sections — P1-R-101…110, P1-CLT-101…110, P1-REC-101…110, P1-SILO-101…110 at drawing positions, decks +3.40/+7.50/+11.50, reactor lugs +5.00, 3 t EOT crane +14.00, PEB gable + monitor roof (eaves +16.0) |
| Plant 2 | same PEB envelope and deck levels as Plant 1 (no Plant 2 drawings yet) |
| Warehouse-1 (`src/scene/warehouse.js`) | PP-A-WH-101-2525 **R0** (older issue, adopted for now): 30.0 × 61.35 m PEB, eaves +10.0, turbo vents + 300 mm polycarbonate strips per bay, 4 west truck docks, lean-phase powder transfer room, +4.0 platform with tanks, toilets. Storage as drawn: 7 double-faced mobile units (8 bays × 6 levels × 2 pallets per face, 500 kg) + static north row (10 bays × 6 levels × 2, 1 t) = **1,464 pallets ≈ 792 t**. The drawing is 5 m wider than the site plan, so the shed grows west towards road R2 |
| Depalletiser → jumbo bag → crane | WH-1 bay 05–06 (planned): pallet infeed, gantry layer depalletiser, bag-emptying station with dust collector, screw conveyor, FIBC filling station on load cells, new east shutter; bags go by forklift over road R3 to Plant 1's west shutter, where the 3 t EOT crane hoists them through the cut-out to a bag discharger on MEZZ-2 feeding P1-R-101 (animated cycle, timed to the film's crane shot). The top deck's hoisting opening is extended east so the rope can travel |
| Warehouse-2 | site-plan footprint (detailed drawing to follow): PEB shed, 6 mobile units × 10 bays × 6 levels × 2 pallets per face = **1,440 pallets ≈ 720 t** |
| Rooftop solar (`src/scene/solar.js`) | planned layout: 545 Wp modules flush on every PEB slope (between the lighting strips) and tilted 12° south on the flat roofs and canopies; trimmed to **1,285 modules = 700 kWp (0.70 MWp)**, inverter skid beside the substation |
| Utilities (`src/scene/utilities.js`) | agro-waste fuel yard under a covered, open-fronted portal-frame shed (bunker walls west/south, open to the boiler house and the north road); 50 KLD ETP: oil & grease trap + equalisation, flash mixer / primary settler, MBBR aeration, secondary clarifier, PSF + ACF, treated-water tank, filter press, sludge drying beds |

`node scripts/model_views.mjs` renders closed and cut-away views of these buildings to `build/preview/model_*.jpg`
(`renderFrame(t, { cam, states, noHud })` accepts any camera and scene-state override). Extra states for model
reviews (not keyed in the film yet): `wh1Cutaway`, `wh2Cutaway`, `modelLabels` (storage / solar / depalletiser /
crane call-outs) and `solarPanels`.

The scene is lit as a sunny day (bright sky, warm sun, light site pad and roads); colours live in
`data/style_tokens.json` → `color.scene`.

## Content notes

All figures come from the capabilities deck (slides 1–16). Two wording choices to review:

* Act 2 narration says Plant 1 is "driven by 16 KL commercial powerhouses, on a site that scales
  from 2 KL pilot trials". The 2 KL R&D reactor sits in Plant 2 (Plant 1 runs 6–16 KL), so the
  brief's line was adjusted to stay accurate.
* "Saturated Polyester" (from the brief) is used where the deck says "Polyester chemistry".
