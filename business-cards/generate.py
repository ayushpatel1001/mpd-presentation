#!/usr/bin/env python3
"""Generate MPD business-card bundles from a CSV or JSON list of people.

    python3 generate.py                      # reads people.csv
    python3 generate.py staff.csv            # any CSV / JSON file
    python3 generate.py people.json --scale 4 --out my-cards

For every person you get, in output/<name>/ :
    <name>-front.svg / -back.svg   vector masters (text outlined)
    <name>-front.png / -back.png   print-resolution PNGs
and a <name>.zip of the above, plus output/all-cards.zip.
"""
import argparse
import csv
import json
import os
import re
import shutil
import subprocess
import sys
import unicodedata
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

try:
    import card_lib
except ImportError as e:  # missing uharfbuzz / fonttools
    sys.exit(f"Missing dependency ({e}). Run:  pip install -r requirements.txt")

FIELDS = ['name', 'title', 'mobile', 'phone', 'email', 'web1', 'web2', 'address']
COMPANY_FIELDS = ['company', 'tagline', 'certifications', 'certified_label', 'qr']
ALIASES = {
    'full name': 'name', 'fullname': 'name', 'designation': 'title', 'job title': 'title', 'position': 'title',
    'mob': 'mobile', 'cell': 'mobile', 'mobile no': 'mobile', 'mobile number': 'mobile',
    'tel': 'phone', 'telephone': 'phone', 'landline': 'phone', 'office phone': 'phone',
    'e-mail': 'email', 'mail': 'email', 'email id': 'email',
    'web': 'web1', 'website': 'web1', 'website 1': 'web1', 'website1': 'web1', 'url': 'web1',
    'website 2': 'web2', 'website2': 'web2', 'web 2': 'web2', 'web 1': 'web1',
}
HIDE = {'-', '--', 'none', 'n/a', 'na'}  # put one of these in a cell to hide a field the defaults would fill


def norm_key(k):
    k = re.sub(r'\s+', ' ', (k or '').strip().lower().replace('_', ' '))
    return ALIASES.get(k, k.replace(' ', '_'))


def load_people(path):
    ext = os.path.splitext(path)[1].lower()
    extra_defaults = {}
    if ext == '.json':
        data = json.load(open(path, encoding='utf-8-sig'))
        if isinstance(data, dict):
            extra_defaults = data.get('defaults', {})
            data = data.get('people', [])
        rows = [{norm_key(k): ('' if v is None else str(v)) for k, v in r.items()} for r in data]
    else:
        with open(path, newline='', encoding='utf-8-sig') as f:
            sample = f.read(4096)
            f.seek(0)
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=',;\t')
            except csv.Error:
                dialect = csv.excel
            rows = [{norm_key(k): (v or '').strip() for k, v in r.items() if k} for r in csv.DictReader(f, dialect=dialect)]
    return rows, extra_defaults


def merge(person, defaults):
    out = {}
    for k in FIELDS + COMPANY_FIELDS:
        v = (person.get(k) or '').strip()
        if v.lower() in HIDE or (k == 'qr' and v.lower() in ('no', 'false', 'off', '0')):
            out[k] = ''
        elif v:
            out[k] = v
        else:
            out[k] = defaults.get(k, '')
    return out


def slugify(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-') or 'card'


# ------------------------------------------------------------------ PNG rendering
def render_pngs(jobs, scale):
    """jobs: [(svg_path, png_path)]. Tries Chromium (Playwright), then cairosvg / rsvg / inkscape."""
    if not jobs:
        return True
    node = shutil.which('node')
    if node:
        manifest = os.path.join(HERE, '.render_manifest.json')
        json.dump([{'svg': j[0], 'png': j[1], 'w': j[2] if len(j) > 2 else card_lib.W,
                    'h': j[3] if len(j) > 3 else card_lib.H, 'scale': scale} for j in jobs],
                  open(manifest, 'w'))
        env = dict(os.environ)
        try:
            root = subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True).stdout.strip()
            env['NODE_PATH'] = root + os.pathsep + env.get('NODE_PATH', '')
        except OSError:
            pass
        r = subprocess.run([node, os.path.join(HERE, 'render.cjs'), manifest], env=env, capture_output=True, text=True)
        os.remove(manifest)
        if r.returncode == 0 and all(os.path.exists(j[1]) for j in jobs):
            return True
        print('  (Chromium render failed, trying fallbacks)', r.stderr.strip()[:200])
    try:
        import cairosvg
        for s, p, *wh in jobs:
            w, h = wh or (card_lib.W, card_lib.H)
            cairosvg.svg2png(url=s, write_to=p, output_width=w * scale, output_height=h * scale)
        return True
    except ImportError:
        pass
    for tool in ('rsvg-convert', 'inkscape'):
        if shutil.which(tool):
            for s, p, *wh in jobs:
                w = (wh or (card_lib.W,))[0]
                cmd = ([tool, '-w', str(w * scale), '-o', p, s] if tool == 'rsvg-convert'
                       else [tool, s, '-w', str(w * scale), '-o', p])
                subprocess.run(cmd, check=True)
            return True
    return False


# ------------------------------------------------------------------ QR scan test
def verify_qrs(made, side='front'):
    """Decode each card's QR from the rendered logo-side PNG with every decoder available
    (ZXing, plus OpenCV's two readers if installed) and compare with the intended vCard.
    A card passes only if ALL of them read it, at full size and at 300 dpi.
    Returns {slug: True/False}; empty if no decoder is installed (pip install zxing-cpp pillow)."""
    todo = [(s, d, p) for s, d, p in made if card_lib._truthy(p.get('qr'))]
    if not todo:
        return {}
    try:
        import zxingcpp
        import numpy as np
        from PIL import Image
    except ImportError:
        print('  (tip: pip install zxing-cpp pillow numpy  -> the tool will then scan-test every QR code for you)')
        return {}
    readers = [lambda a: (r := zxingcpp.read_barcodes(a)) and r[0].text]
    try:
        import cv2
        for det in (cv2.QRCodeDetector(), cv2.QRCodeDetectorAruco()):
            readers.append(lambda a, det=det: det.detectAndDecode(a[:, :, ::-1].copy())[0])
    except Exception:
        pass
    out = {}
    for slug, d, p in todo:
        img = Image.open(os.path.join(d, f'{slug}-{side}.png')).convert('RGB')
        small = img.resize((card_lib.W, card_lib.H), Image.LANCZOS)     # a 300-dpi copy, closer to a print
        want = card_lib.vcard(p)
        out[slug] = all(rd(np.array(im)) == want for im in (img, small) for rd in readers)
    return out


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('input', nargs='?', default=os.path.join(HERE, 'people.csv'), help='CSV or JSON file (default people.csv)')
    ap.add_argument('--defaults', default=os.path.join(HERE, 'defaults.json'), help='company defaults JSON')
    ap.add_argument('--out', default=os.path.join(HERE, 'output'), help='output folder (default ./output)')
    ap.add_argument('--scale', type=int, default=3, help='PNG scale: 1=1050x600, 3=3150x1800 (default), 4=4200x2400')
    ap.add_argument('--font', choices=list(card_lib.THEMES), help='font theme (default: font_theme in defaults.json, else modern)')
    ap.add_argument('--layout', choices=['bold', 'classic'], help='bold (default): blue logo side + refined details side; classic: the earlier cards')
    ap.add_argument('--texture', action='store_true', help='wrap both sides in an alkyd-molecule background texture')
    ap.add_argument('--no-qr', action='store_true', help='leave the vCard QR code off every card')
    ap.add_argument('--no-png', action='store_true', help='SVG only')
    ap.add_argument('--no-zip', action='store_true', help='skip zip bundles')
    args = ap.parse_args()

    defaults = json.load(open(args.defaults, encoding='utf-8'))
    rows, file_defaults = load_people(args.input)
    defaults.update({k: v for k, v in file_defaults.items()})
    if not rows:
        sys.exit('No people found in ' + args.input)

    card_lib.use_theme(args.font or defaults.get('font_theme') or card_lib.DEFAULT_THEME)
    card_lib.use_layout(args.layout or defaults.get('layout') or 'bold')
    card_lib.use_texture(args.texture or bool(defaults.get('texture')))
    if args.no_qr:
        defaults['qr'] = False

    shutil.rmtree(args.out, ignore_errors=True)
    os.makedirs(args.out)

    used, jobs, made, skipped = {}, [], [], []
    for i, raw in enumerate(rows, start=2 if args.input.lower().endswith('.csv') else 1):
        p = merge(raw, defaults)
        if not p['name']:
            skipped.append(f'row {i}: no name'); continue
        if p['email'] and not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', p['email']):
            print(f'  warning: row {i} ({p["name"]}): email "{p["email"]}" looks invalid')
        slug = slugify(p['name'])
        used[slug] = used.get(slug, 0) + 1
        if used[slug] > 1:
            slug += f'-{used[slug]}'
        d = os.path.join(args.out, slug)
        os.makedirs(d)
        f_svg, b_svg = (os.path.join(d, f'{slug}-{s}.svg') for s in ('front', 'back'))
        card_lib.NOTES.clear()
        if card_lib.LAYOUT['name'] == 'bold':
            front_doc = card_lib.front_bold_svg(p, defaults.get('tagline', ''))
            back_doc = card_lib.back_refined_svg(p)
        else:
            front_doc = card_lib.front_svg(p, defaults.get('tagline', ''))
            back_doc = card_lib.back_svg(p)
        open(f_svg, 'w', encoding='utf-8').write(front_doc)
        open(b_svg, 'w', encoding='utf-8').write(back_doc)
        if card_lib.LAYOUT['name'] == 'bold':
            # printer files: 3 mm (35 px) of bleed on every side - the logo side is full-bleed blue
            BL = 35
            fp, bp = (os.path.join(d, f'{slug}-{s}-print.svg') for s in ('front', 'back'))
            open(fp, 'w', encoding='utf-8').write(card_lib.front_bold_svg(p, defaults.get('tagline', ''), bleed=BL))
            open(bp, 'w', encoding='utf-8').write(card_lib.back_refined_svg(p, bleed=BL))
            bw, bh = card_lib.back_dims()
            jobs += [(fp, fp[:-4] + '.png', card_lib.W + 2 * BL, card_lib.H + 2 * BL), (bp, bp[:-4] + '.png', bw + 2 * BL, bh + 2 * BL)]
        for note in dict.fromkeys(card_lib.NOTES):
            print(f'  note: {p["name"]}: {note}')
        jobs += [(f_svg, f_svg[:-4] + '.png', card_lib.W, card_lib.H), (b_svg, b_svg[:-4] + '.png') + card_lib.back_dims()]
        made.append((slug, d, p))

    if not args.no_png:
        ok = render_pngs(jobs, args.scale)
        args.no_png = not ok
        if not ok:
            print('  ! No PNG renderer found (need Node+Playwright, cairosvg, rsvg-convert or inkscape). SVGs were written.')

    verified = {}
    if not args.no_png:
        verified = verify_qrs(made)

    if not args.no_zip:
        with zipfile.ZipFile(os.path.join(args.out, 'all-cards.zip'), 'w', zipfile.ZIP_DEFLATED) as allz:
            for slug, d, _ in made:
                with zipfile.ZipFile(os.path.join(args.out, slug + '.zip'), 'w', zipfile.ZIP_DEFLATED) as z:
                    for fn in sorted(os.listdir(d)):
                        z.write(os.path.join(d, fn), fn)
                        allz.write(os.path.join(d, fn), f'{slug}/{fn}')

    print(f'\nDone: {len(made)} card set(s) -> {args.out}   (font theme: {args.font or defaults.get("font_theme") or card_lib.DEFAULT_THEME})')
    for slug, d, p in made:
        mark = {True: '  [QR scan-tested OK]', False: '  [QR FAILED scan test!]'}.get(verified.get(slug), '')
        print(f'  {slug:<28} {p["title"] or ""}{mark}')
    for s in skipped:
        print('  skipped', s)


if __name__ == '__main__':
    main()
