#!/usr/bin/env python3
"""Builds the MPD brand-identity kit from the vectorised logo and the card design library.

    python3 brand-identity/build_brand.py

Writes, next to this script:
    logo/      every logo variant as SVG + transparent PNG (4096 px and 1024 px wide)
    colour/    palette.json, palette.css, palette.svg/.png (swatch sheet)
    pattern/   the alkyd-molecule pattern (blue on white, white on transparent)
    brand-board.svg/.png   one-page overview
Everything is pure vector; text is converted to outlines.
"""
import base64
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CARDS = os.path.join(os.path.dirname(HERE), 'business-cards')
sys.path.insert(0, CARDS)
import card_lib as C        # noqa: E402
import molecules as M       # noqa: E402

C.use_theme('modern')

# ------------------------------------------------------------------ palette
PALETTE = [
    # name, hex, role
    ('MPD Blue', '#1b64ad', 'Primary. The logo letters and emblem, headings, the logo side of the card.'),
    ('Deep Blue', '#124a8d', 'Dark end of gradients, footer bands, QR squares on light grounds.'),
    ('Bright Blue', '#2f84d6', 'Light end of gradients and highlights.'),
    ('Ink Blue', '#0f3f7a', 'Darkest blue: QR codes, small text on light grounds.'),
    ('MPD Green', '#6fae2c', 'Accent. The diamond in the emblem, rules and small markers.'),
    ('Leaf Green', '#4c8a1c', 'Green for text (job titles, labels) - passes contrast on white.'),
    ('Lime Green', '#a6d65a', 'Green on blue backgrounds (tagline on the blue card side).'),
    ('Ink', '#26323f', 'Body text.'),
    ('Slate', '#5d6c80', 'Secondary text, captions, certifications.'),
    ('Pearl', '#f8f7f3', 'Warm off-white background for light surfaces.'),
]


def _rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def _cmyk(h):
    """Simple RGB->CMYK estimate (no ICC profile). A starting point only - match on a printed proof."""
    r, g, b = (v / 255 for v in _rgb(h))
    k = 1 - max(r, g, b)
    if k >= 1:
        return (0, 0, 0, 100)
    c, m, y = ((1 - v - k) / (1 - k) for v in (r, g, b))
    return tuple(round(v * 100) for v in (c, m, y, k))


# ------------------------------------------------------------------ helpers
def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)


def svg(w, h, body, defs='', title='', vb=None):
    vb = vb or f'0 0 {w} {h}'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{vb}">'
            f'<title>{title}</title><defs>{defs}</defs>{body}</svg>')


def flat(body, colour):
    """A logo body in one flat colour (for one-colour printing, stamps, engraving, fax)."""
    s = re.sub(r'<g clip-path="url\(#ec[^"]*\)">.*?</g>', '', body, flags=re.S)   # drop the gloss
    s = re.sub(r'fill="url\(#[^)]+\)"', f'fill="{colour}"', s)
    s = re.sub(r'<rect x="-26.5" y="-26.5" width="53" height="26.5"[^>]*/>', '', s)  # diamond highlight
    return s


# logo-unit geometry (see business-cards/assets/logo_paths.json)
FULL_VB = (0, 0, 1000, 337)          # emblem + wordmark
EMB_VB = (0, 0, 312, 337)            # emblem only
WORD_VB = (326, 86, 676, 180)        # wordmark only
TAG_VB = (0, 0, 1000, 420)           # with the tagline underneath


ORIG_VB = (0, 0, 1024, 337)          # the original artwork's own canvas


def _path_bounds(d):
    """Bounds of an absolute SVG path (M, L, H, V, C, Q, Z), control points included."""
    xs, ys, cx, cy = [], [], 0.0, 0.0
    for cmd, args in re.findall(r'([MLHVCQZ])([^MLHVCQZ]*)', d):
        v = [float(t) for t in re.findall(r'-?\d+(?:\.\d+)?', args)]
        if cmd == 'H':
            for x in v:
                cx = x; xs.append(cx); ys.append(cy)
        elif cmd == 'V':
            for y in v:
                cy = y; xs.append(cx); ys.append(cy)
        elif cmd != 'Z':
            for i in range(0, len(v) - 1, 2):
                cx, cy = v[i], v[i + 1]; xs.append(cx); ys.append(cy)
    return min(xs), min(ys), max(xs), max(ys)


def _emblem_parts():
    """Split the emblem into its outer contour and its two windows (largest subpath = outer)."""
    subs = ['M' + x for x in C.LOGO['emblem'].split('M') if x.strip()]
    area = lambda d: (lambda b: (b[2] - b[0]) * (b[3] - b[1]))(_path_bounds(d))
    subs.sort(key=area, reverse=True)
    return subs[0], ''.join(subs[1:])


def original_logo():
    """The original MPD artwork, redrawn as vectors and matched to it: its colours (sampled from the
    original image), its gloss splits, and its tagline (Saira Condensed, olive green, same position)."""
    L, dm = C.LOGO['letters'], C.LOGO['diamond']
    em = C.LOGO['emblem']
    defs = (
        # letters: flat light blue on top, hard gloss split, then deepening blue (sampled row by row)
        '<linearGradient id="oLt" x1="0" y1="0" x2="0" y2="1">'
        '<stop offset="0" stop-color="#5e99c4"/><stop offset=".38" stop-color="#5c97c2"/>'
        '<stop offset=".385" stop-color="#2d76ab"/><stop offset=".55" stop-color="#226ca3"/>'
        '<stop offset=".8" stop-color="#1b5a90"/><stop offset="1" stop-color="#185288"/></linearGradient>'
        # emblem: dark base, with the light upper part laid over it along the original's curved split
        '<linearGradient id="oEmD" gradientUnits="userSpaceOnUse" x1="0" y1="140" x2="0" y2="334">'
        '<stop offset="0" stop-color="#1f6ca4"/><stop offset=".5" stop-color="#175a91"/><stop offset="1" stop-color="#12508a"/></linearGradient>'
        '<linearGradient id="oEmL" gradientUnits="userSpaceOnUse" x1="0" y1="3" x2="0" y2="160">'
        '<stop offset="0" stop-color="#3f7fb3"/><stop offset=".12" stop-color="#4c8dbc"/><stop offset="1" stop-color="#5897c3"/></linearGradient>'
        # diamond: light green over dark green, split level through its middle
        f'<linearGradient id="oDi" gradientUnits="userSpaceOnUse" x1="0" y1="{dm["cy"] - 34:.1f}" x2="0" y2="{dm["cy"] + 34:.1f}">'
        '<stop offset="0" stop-color="#b2d077"/><stop offset=".47" stop-color="#9dbc62"/>'
        '<stop offset=".5" stop-color="#6e9a2f"/><stop offset="1" stop-color="#557e22"/></linearGradient>'
        f'<clipPath id="oEc"><path d="{em}" clip-rule="evenodd"/></clipPath>')
    split = 'M-10,-10H345V150C262,148 132,151 -10,166Z'
    outer, windows = _emblem_parts()
    # emblem: dark base + light upper part, a dark rim on the outside and a pale line around the windows
    body = (f'<path d="{em}" fill="url(#oEmD)" fill-rule="evenodd"/>'
            f'<g clip-path="url(#oEc)"><path d="{split}" fill="url(#oEmL)"/>'
            f'<path d="{outer}" fill="none" stroke="#1d5890" stroke-width="7"/>'
            f'<path d="{windows}" fill="none" stroke="#e3eef8" stroke-opacity=".9" stroke-width="4"/></g>'
            # letters with a thin darker outline
            f'<g fill="url(#oLt)" fill-rule="evenodd" stroke="#2f6aa0" stroke-width="2" stroke-linejoin="round">'
            f'<path d="{L["M"]}"/><path d="{L["P"]}"/><path d="{L["D"]}"/></g>')
    # the diamond: a rotated rounded square used as a clip, so its light/dark split stays level
    dia_shape = (f'<path d="M-26.5 -15.5V15.5A11 11 0 0 0 -15.5 26.5H15.5A11 11 0 0 0 26.5 15.5V-15.5A11 11 0 0 0 15.5 -26.5H-15.5'
                 f'A11 11 0 0 0 -26.5 -15.5Z" transform="translate({dm["cx"]:.2f} {dm["cy"]:.2f}) rotate(42)"/>')
    defs += f'<clipPath id="oDc">{dia_shape}</clipPath>'
    body += (f'<rect x="{dm["cx"] - 40:.1f}" y="{dm["cy"] - 40:.1f}" width="80" height="80" fill="url(#oDi)" clip-path="url(#oDc)"/>')
    # tagline, fitted to the original's position (x 336-1017, y 280-332 in the original artwork)
    raw = C._text_path('SairaCondensed-Regular.ttf', None, 'WE INNOVATE.  WE SERVE.', 100, 0, 0, 'start', 0)
    bx0, by0, bx1, by1 = _path_bounds(raw)
    sx, sy = (1017 - 336) / (bx1 - bx0), (332 - 280) / (by1 - by0)
    body += (f'<path d="{raw}" fill="#586e3e" transform="translate({336 - bx0 * sx:.3f} {280 - by0 * sy:.3f}) '
             f'scale({sx:.5f} {sy:.5f})"/>')
    return svg(1024, 337, body, defs, 'MPD logo - original artwork, vectorised', ' '.join(map(str, ORIG_VB)))


def logo_variants():
    out = {}
    d_c, b_c = C._logo('c', 1, 0, 0)
    d_w, b_w = C._logo_white('w', 1, 0, 0)
    d_e, b_e = C._logo('e', 1, 0, 0, letters=False)
    d_ew, b_ew = C._logo_white('ew', 1, 0, 0)
    b_ew = re.sub(r'<g fill="url\(#ltWew\)".*?</g>', '', b_ew, flags=re.S)
    d_m, b_m = C._logo('m', 1, 0, 0, emblem=False)
    tag = C.T(*C.FONT['tag'], 'WE INNOVATE.  WE SERVE.', 64, 664, 392, '#4c8a1c', 'middle', 0.10)
    vb = lambda v: ' '.join(str(x) for x in v)
    out['mpd-logo-original'] = (original_logo(), ORIG_VB)
    out['mpd-logo'] = (svg(1000, 337, b_c, d_c, 'MPD logo - full colour', vb(FULL_VB)), FULL_VB)
    out['mpd-logo-tagline'] = (svg(1000, 420, b_c + tag, d_c, 'MPD logo with tagline - full colour', vb(TAG_VB)), TAG_VB)
    out['mpd-logo-white'] = (svg(1000, 337, b_w, d_w, 'MPD logo - reversed, for blue or dark backgrounds', vb(FULL_VB)), FULL_VB)
    out['mpd-logo-mono-blue'] = (svg(1000, 337, flat(b_c, C.BLUE), '', 'MPD logo - one colour, blue', vb(FULL_VB)), FULL_VB)
    out['mpd-logo-mono-black'] = (svg(1000, 337, flat(b_c, '#000000'), '', 'MPD logo - one colour, black', vb(FULL_VB)), FULL_VB)
    out['mpd-emblem'] = (svg(312, 337, b_e, d_e, 'MPD emblem - full colour', vb(EMB_VB)), EMB_VB)
    out['mpd-emblem-white'] = (svg(312, 337, b_ew, d_ew, 'MPD emblem - reversed', vb(EMB_VB)), EMB_VB)
    out['mpd-wordmark'] = (svg(676, 180, b_m, d_m, 'MPD wordmark - full colour', vb(WORD_VB)), WORD_VB)
    return out


def render(jobs):
    man = os.path.join(HERE, '.jobs.json')
    json.dump(jobs, open(man, 'w'))
    env = dict(os.environ)
    env['NODE_PATH'] = subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True).stdout.strip()
    subprocess.run(['node', os.path.join(CARDS, 'render.cjs'), man], env=env, check=True)
    os.remove(man)


# ------------------------------------------------------------------ build
def main():
    jobs = []
    # logos
    tmp = os.path.join(HERE, '.tmp')
    os.makedirs(tmp, exist_ok=True)
    for name, (doc, (x, y, w, h)) in logo_variants().items():
        p = os.path.join(HERE, 'logo', f'{name}.svg')
        write(p, doc)
        for width in (4096, 1024):
            # render from a copy sized to the target pixels (huge zoom factors break the screenshot)
            ph = round(h * width / w)
            sized = re.sub(r'^<svg([^>]*?) width="[^"]+" height="[^"]+"', f'<svg\\1 width="{width}" height="{ph}"', doc, count=1)
            sp = os.path.join(tmp, f'{name}-{width}.svg')
            write(sp, sized)
            jobs.append(dict(svg=sp, png=os.path.join(HERE, 'logo', f'{name}-{width}.png'), w=width, h=ph,
                             scale=1, transparent=True))

    # palette
    pal = [dict(name=n, hex=hx, rgb=list(_rgb(hx)), cmyk_estimate=list(_cmyk(hx)), use=u) for n, hx, u in PALETTE]
    write(os.path.join(HERE, 'colour', 'palette.json'), json.dumps(dict(
        note='CMYK values are simple estimates without a colour profile. Match blue and green to the logo on a printed proof.',
        colours=pal), indent=2))
    css = ':root {\n' + ''.join(f'  --mpd-{n.lower().replace(" ", "-")}: {hx};   /* {u} */\n' for n, hx, u in PALETTE) + '}\n'
    write(os.path.join(HERE, 'colour', 'palette.css'), css)
    sw, cols = 300, 5
    body = '<rect width="1600" height="760" fill="#ffffff"/>'
    for i, c in enumerate(pal):
        x, y = 60 + (i % cols) * sw, 60 + (i // cols) * 340
        light = sum(c['rgb']) > 600
        body += (f'<rect x="{x}" y="{y}" width="{sw - 30}" height="180" rx="12" fill="{c["hex"]}"'
                 + (' stroke="#d6dee7" stroke-width="2"' if light else '') + '/>')
        body += C.T(*C.FONT['strong'], c['name'].upper(), 20, x, y + 220, C.INK, 'start', 0.12)
        body += C.T(*C.FONT['body'], f'{c["hex"].upper()}   RGB {" ".join(map(str, c["rgb"]))}', 17, x, y + 250, C.MUTED)
        body += C.T(*C.FONT['body'], f'CMYK ~ {" ".join(map(str, c["cmyk_estimate"]))}', 17, x, y + 276, C.MUTED)
    p = os.path.join(HERE, 'colour', 'palette.svg')
    write(p, svg(1600, 760, body, title='MPD colour palette'))
    jobs.append(dict(svg=p, png=p[:-4] + '.png', w=1600, h=760, scale=1.5))

    # pattern
    t = M.alkyd_texture(1600, 900, 0, bond=22, rows=[-40, 200, 440, 680, 920], seed=21)
    def pattern(colour, bg):
        lab = ''.join(C.T(*C.FONT['body'], 'O', 15, x, y + 5.3, colour, 'middle') for x, y, _ in t['labels'])
        bgr = f'<rect width="1600" height="900" fill="{bg}"/>' if bg else ''
        return (bgr + f'<g fill="none" stroke="{colour}" stroke-width="2" stroke-linecap="round">'
                f'<path d="{t["single"]}"/><path d="{t["inner"]}"/></g>{lab}')
    for name, colour, bg, transparent in (('alkyd-pattern-blue', '#c3d3e6', '#f8f7f3', False),
                                         ('alkyd-pattern-white', '#ffffff', None, True)):
        p = os.path.join(HERE, 'pattern', f'{name}.svg')
        write(p, svg(1600, 900, pattern(colour, bg), title='MPD alkyd-molecule pattern'))
        jobs.append(dict(svg=p, png=p[:-4] + '.png', w=1600, h=900, scale=1.5, transparent=transparent))
    render(jobs)
    import shutil
    shutil.rmtree(tmp, ignore_errors=True)

    # brand board (uses the rendered card preview)
    board = brand_board(pal)
    p = os.path.join(HERE, 'brand-board.svg')
    write(p, board)
    render([dict(svg=p, png=p[:-4] + '.png', w=2400, h=1700, scale=1)])
    print('brand identity kit ->', HERE)


def brand_board(pal):
    W2, H2 = 2400, 1700
    d_c, b_c = C._logo('bc', 0.9, 120 - 4 * 0.9, 220)
    d_w, b_w = C._logo_white('bw', 0.6, 1330, 250)
    d_m, b_m = C._logo('bm', 0.32, 1340, 590)
    mono = flat(b_m, C.BLUE)
    d_e, b_e = C._logo('be', 0.56, 2034, 598, letters=False)
    h = lambda txt, x, y: C.T(*C.FONT['strong'], txt, 18, x, y, C.MUTED, 'start', 0.3)
    body = f'<rect width="{W2}" height="{H2}" fill="#f8f7f3"/>'
    body += C.T(*C.FONT['name'], 'MPD Industries', 64, 120, 130, C.INK)
    body += C.T(*C.FONT['strong'], 'BRAND IDENTITY', 20, 124, 172, C.GREEN, 'start', 0.4)
    # logos
    body += h('PRIMARY LOGO', 120, 210) + b_c
    body += f'<rect x="1260" y="190" width="1020" height="330" rx="20" fill="url(#bgBoard)"/>' + b_w
    body += h('REVERSED, ON MPD BLUE', 1270, 560)
    body += f'<rect x="1260" y="575" width="660" height="160" rx="20" fill="#ffffff" stroke="#d6dee7" stroke-width="2"/>' + mono
    body += h('ONE COLOUR', 1270, 770)
    body += f'<rect x="1960" y="575" width="320" height="250" rx="20" fill="#ffffff" stroke="#d6dee7" stroke-width="2"/>' + b_e
    body += h('EMBLEM', 1970, 860)
    # palette
    body += h('COLOUR', 120, 590)
    for i, c in enumerate(pal):
        x, y = 120 + (i % 5) * 220, 610 + (i // 5) * 200
        body += (f'<rect x="{x}" y="{y}" width="196" height="110" rx="12" fill="{c["hex"]}"'
                 + (' stroke="#d6dee7" stroke-width="2"' if sum(c['rgb']) > 600 else '') + '/>')
        body += C.T(*C.FONT['strong'], c['name'].upper(), 15, x, y + 138, C.INK, 'start', 0.1)
        body += C.T(*C.FONT['body'], c['hex'].upper(), 15, x, y + 162, C.MUTED)
    # typography
    body += h('TYPOGRAPHY', 120, 1060)
    body += C.T(*C.FONT['name'], 'Sora', 72, 120, 1150, C.BLUE) + C.T(*C.FONT['body'], 'Names and headings', 20, 120, 1186, C.MUTED)
    body += C.T(*C.FONT['body'], 'Manrope', 64, 420, 1150, C.INK) + C.T(*C.FONT['body'], 'Text and contact details', 20, 420, 1186, C.MUTED)
    body += C.T(*C.FONT['tag'], 'WE INNOVATE.  WE SERVE.', 30, 790, 1144, C.GREEN, 'start', 0.22) + C.T(*C.FONT['body'], 'Oswald, the tagline', 20, 790, 1186, C.MUTED)
    # pattern strip
    body += h('PATTERN', 120, 1270)
    t = M.alkyd_texture(1100, 300, 0, bond=17, rows=[-20, 140, 300], seed=5)
    lab = ''.join(C.T(*C.FONT['body'], 'O', 11.5, x, y + 4.1, '#9fb6d2', 'middle') for x, y, _ in t['labels'])
    body += (f'<clipPath id="pc"><rect x="120" y="1290" width="1100" height="300" rx="20"/></clipPath>'
             f'<g clip-path="url(#pc)"><rect x="120" y="1290" width="1100" height="300" fill="#ffffff"/>'
             f'<g transform="translate(120 1290)"><g fill="none" stroke="#9fb6d2" stroke-width="1.5" stroke-linecap="round">'
             f'<path d="{t["single"]}"/><path d="{t["inner"]}"/></g>{lab}</g></g>')
    # business card
    body += h('BUSINESS CARD', 1270, 960)
    mock = os.path.join(CARDS, 'examples', 'preview-mockup.png')
    if os.path.exists(mock):
        b64 = base64.b64encode(open(mock, 'rb').read()).decode()
        body += (f'<clipPath id="mc"><rect x="1260" y="980" width="1020" height="638" rx="20"/></clipPath>'
                 f'<image x="1260" y="980" width="1020" height="638" clip-path="url(#mc)" href="data:image/png;base64,{b64}"/>')
    defs = (d_c + d_w + d_e +
            '<linearGradient id="bgBoard" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b80d2"/>'
            '<stop offset=".5" stop-color="#1b64ad"/><stop offset="1" stop-color="#0e4386"/></linearGradient>')
    return svg(W2, H2, body, defs, 'MPD brand board')


if __name__ == '__main__':
    main()
