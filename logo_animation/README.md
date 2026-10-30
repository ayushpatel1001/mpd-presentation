# Mehidpurwala — logo sting · “हम फर्नीचर बनाते हैं... दिल से.”

A 5-second, 1920×1080 / 60 fps logo animation with an original score, built entirely in code.

| Output | |
|---|---|
| `out/mehidpurwala_logo_sting.mp4` | the film (H.264 CRF 15 + AAC 256k, ≈ −14 LUFS, −1 dBTP) |
| `out/mehidpurwala_logo_score.m4a` | the score alone |
| `out/contact_sheet.jpg` | stills from the encoded film |

## The concept — “we make furniture with heart”

| Time | Picture | Sound |
|---|---|---|
| 0.0–0.5 | The heart springs in at the centre of a white frame: lub-dub | two heartbeats, a soft bell |
| 0.5–1.5 | The camera pulls back while the ribbon unfurls out of the heart's lobes into the M | panned whooshes; strings and a music-box arpeggio enter on G |
| 1.5–2.6 | Light sheen across the mark; *Mehidpurwala* rises letter by letter, ® pops, *Since 1885* tracks in | D chord, bell on the ® |
| 2.5–3.5 | *हम फर्नीचर बनाते हैं...* is written out with a soft pen edge; the dots tap in one by one | A chord, three ticks on the ellipsis |
| 3.55–4.0 | *दिल से.* | Asus4 lift and a short riser |
| 4.0–4.5 | **The heart winks**: its right hump squeezes shut like an eyelid and springs back, with two red ✦ glints; *दिल से.* warms to brand red | D major resolves, a sparkle “ting” with each glint |
| 4.5–5.0 | Hold on the clean logo | tail fades out |

## How it is made

* **Artwork.** The supplied logo (`assets/mehidpurwala_logo.jpg`) is a small, aliased JPEG, so the red mark is
  *rebuilt as geometry* rather than traced: `trace/build_mark.py` least-squares fits its twelve straight edges
  (snapped to the mark's shared angles), adds fillets tangent to them, fits a cubic to the big bottom-left curve
  and models the two white fold lines as tapered crescents. The heart is the region between the folds, so it can
  move independently of the ribbon. `node trace/compare.mjs <logo> trace/mark.json <out.png>` overlays the rebuild
  on the original. The lettering (wordmark, ®, Since 1885, the Devanagari tagline) is traced with potrace by
  `trace/trace_text.py` and split into glyphs.
* **Picture.** `anim.js` draws each frame on a Canvas 2D as a pure function of time (`renderFrame(t)`);
  `timeline.json` holds every cue and is shared with the score so sound and picture stay locked.
  `render.mjs` captures the frames losslessly in headless Chromium.
* **Music.** `audio/score.py` synthesises the score in numpy/scipy: additive piano, detuned-saw strings, bells,
  heartbeats, whooshes and risers, with a convolution reverb. It's an original composition, so no licensing applies.

Run `./build.sh`; it needs Python 3 with numpy/scipy/Pillow/shapely, Node 22 + Playwright's Chromium and FFmpeg.
`RETRACE=1 ./build.sh` also rebuilds the vector artwork, which needs potrace.
`node render.mjs --stills 0.3 1.0 4.1` renders single frames to `build/stills/`. To watch it live with
music, serve this folder (for example `python3 -m http.server`), open `index.html` and press play.
