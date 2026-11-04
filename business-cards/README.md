# MPD business-card generator

Put people in a CSV (or JSON), run one command, get a card bundle for each person.

```bash
pip install -r requirements.txt     # one-off (uharfbuzz + fonttools)
python3 generate.py                 # reads people.csv  ->  output/
python3 generate.py staff.csv       # or any other CSV / JSON file
```

## Finished cards

The current cards for everyone in `people.csv` are committed in `cards/` (rebuilt with
`python3 generate.py --out cards --no-zip`). The brand kit (logo files, colours, fonts) is in `../brand-identity/`.

## What you get

```
output/
  ayush-patel/
    ayush-patel-front.svg / .png         logo side, landscape 89 x 51 mm (MPD blue, white logo, QR)
    ayush-patel-back.svg  / .png         details side, landscape 89 x 51 mm (name, contacts, address)
    ayush-patel-front-print.svg / .png   the same with 3 mm bleed on every side: SEND THESE TO THE PRINTER
    ayush-patel-back-print.svg  / .png
  ayush-patel.zip                        that person's bundle
  all-cards.zip                          everyone, one folder each
```

Everyone gets the same design; only the details and the QR code change. `output/` is wiped and rebuilt on every run.
`--layout classic` brings back the earlier design.

## Ordering from the printer

Standard printing, no special finishes. Ask for:

- **Size** 89 x 51 mm, landscape, printed both sides, full colour (CMYK).
- **Files**: the two `-print` files per person (they include 3 mm bleed).
- **Stock**: the heaviest matte board they offer as standard (400 gsm or more).
- **Corners**: rounded, 3 mm radius (a cheap standard option at most printers; the preview shows it).
- **A printed proof first**: check the blue and green against the logo, and scan the QR with a phone.

## The CSV

One row per person. Only `name` is required; the header row is case-insensitive.

| column | example | notes |
|---|---|---|
| `name` | Ayush Patel | long names wrap to two lines automatically |
| `title` | Director | shown in capitals |
| `mobile` | +91-9131797159 | |
| `phone` | +91-731-2973326 | blank = company default |
| `email` | ayush@mpdyechem.com | |
| `web1`, `web2` | www.mpdyechem.com | blank = company default |
| `address` | Plot No. 59 ... | blank = company default; wraps to the column, use `\|` to force a line break |
| `qr` | `-` | optional. `-` = no QR code on this person's card (the small logo goes back in its place) |

Common alternative headers also work (`Full Name`, `Designation`, `Mob`, `Tel`, `E-mail`, `Website`, ...).

- **Blank cell** -> the company default from `defaults.json`.
- **A single `-` in a cell** -> hide that field (the row collapses, no gap). For example `phone` = `-` for someone with no landline.
- Comma, semicolon or tab separated all work; Excel's "CSV UTF-8" is fine, so accented names are OK.

## vCard QR code ("scan to save contact")

The **logo side** carries the QR: the big MPD logo and tagline on the left, and a brand-blue panel on the right with a white QR tile labelled "SCAN TO SAVE". (So the logo side is personalised too: each person gets their own.) The **details side** has the name, the full MPD logo, contacts, address and ISO certifications.

Scanning the code with a phone camera offers to **add a contact** (captioned "SAVE CONTACT" with a small add-contact icon) containing:

- **Name with the post in brackets**, e.g. `Ayush Patel (Director)`
- **Company**, e.g. `MPD Industries Pvt. Ltd.`
- **Phone number**: the person's mobile (or the office phone if they have no mobile)
- **Email address**

Details:

- Built from the same fields as the card, so it can never disagree with the printed text.
- Made to scan easily: about **19 mm** wide, plain square modules (the most widely readable form; rounded/stylised dots and logos in the middle are what trip up some phones), deep brand-blue squares, green corner centres, and nothing inside the code.
- Every code is **scan-tested** after rendering with every decoder installed: ZXing (`zxing-cpp`) and, if `opencv-python-headless` is installed, OpenCV's two QR readers. It must read in all of them, at full size and at 300 dpi, and match the intended contact exactly. The result shows as `[QR scan-tested OK]` in the summary.
- A longer name, company or post makes a denser code with smaller squares; the tool prints a `note:` when they get too small to scan comfortably.
- Turn it off for everyone with `--no-qr` (or `"qr": false` in `defaults.json`), or for one person with `-` in the `qr` column; the logo side then shows the logo on its own, centred.
- Always print a proof and scan it with a phone before a full run.

## Molecule texture

`--texture` draws a light line-art network of alkyd resin behind both sides, in skeletal-formula style: polyester backbones of phthalate rings and glycerol joined by ester links, with drying-oil fatty-acid side chains (C=C double bonds). It fades out behind the logo and every block of text so they stay clean, and runs into the bleed. It is drawn by `molecules.py` and is pure vector.

## Fonts

Pick a theme with `--font NAME`, or set `"font_theme"` in `defaults.json`:

| theme | look |
|---|---|
| `modern` (default) | Sora headings + Manrope text: clean and contemporary |
| `industrial` | Barlow: sturdy, engineered, close to the logo's squared feel |
| `executive` | DM Serif Display + DM Sans: classic and premium |
| `geometric` | Outfit: friendly, rounded geometric |
| `classic` | Cormorant Garamond + Montserrat (the first version) |

Themes live in `THEMES` at the top of `card_lib.py`; to add your own, drop a font into `fonts/` and add a block there.

## JSON instead

See `people.example.json`. It is a list of people (or `{"defaults": {...}, "people": [...]}`) using the same field names. Anything under `defaults` overrides `defaults.json` for that run.

## Company-wide settings: `defaults.json`

Company name (footer band), tagline, default phone/websites/address, and the ISO certifications (separate them with `|`; they are stacked beside the QR code).
Change it once and every card picks it up. Set an entry to `""` to leave it off.

## Options

```
--out DIR     output folder (default ./output)
--scale N     PNG size multiplier: 1 = 1050x600, 3 = 3150x1800 (default), 4 = 4200x2400
--font NAME   font theme (modern, industrial, executive, geometric, classic)
--texture     wrap both sides in an alkyd-resin molecule background (set "texture": true in defaults.json to make it the default)
--no-qr       leave the QR code off every card
--no-png      SVG only (faster)
--no-zip      skip the zip bundles
--defaults F  use a different defaults file
```

## Notes

- The tool prints a `note:` when it had to shrink something (long email, long title or address) so you can shorten it. Text below about 4 pt is hard to read in print.
- PNGs are rendered with Chromium via Playwright (Node). If that is missing it falls back to `cairosvg`, `rsvg-convert` or `inkscape`; with none of those you still get the SVGs.
- Card size is 3.5 x 2 in with **no bleed**. If your printer needs 3 mm bleed, ask for it to be added.
- Files: `generate.py` = the batch tool, `card_lib.py` = the card design (both layouts, the QR code, the vCard), `molecules.py` = the alkyd-molecule texture, `render.cjs` = Chromium PNG renderer, `assets/logo_paths.json` = the vectorised MPD logo, `fonts/` = the typefaces with their SIL Open Font Licence files (`OFL-*.txt`), `examples/preview-mockup.png` = a preview of the finished card.
