"""MPD Industries business-card design.

Pure functions: front_svg() and back_svg(person). All text is converted to
outlines, so the SVGs are self-contained (no fonts or images needed to open them).
Card size is 3.5 x 2 in, drawn on a 1050 x 600 canvas (300 dpi).
"""
import json
import os

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1050, 600

with open(os.path.join(HERE, 'assets', 'logo_paths.json')) as _f:
    LOGO = json.load(_f)

BLUE, BLUE_D, BLUE_L = '#1b64ad', '#124a8d', '#2f84d6'
INK, MUTED, GREEN = '#26323f', '#5d6c80', '#4c8a1c'

# Font themes. Each role is (font file in ./fonts, weight or None for static fonts).
#   name = person's name, title = job title (tracked caps), body = contact text,
#   strong = footer / certifications / captions, tag = tagline (condensed, echoes the logo)
THEMES = {
    'classic': dict(name=('CormorantGaramond[wght].ttf', 600), title=('Montserrat[wght].ttf', 600),
                    body=('Montserrat[wght].ttf', 500), strong=('Montserrat[wght].ttf', 600),
                    tag=('Oswald[wght].ttf', 400), name_size=88, body_size=23),
    'modern': dict(name=('Sora[wght].ttf', 600), title=('Sora[wght].ttf', 600),
                   body=('Manrope[wght].ttf', 600), strong=('Manrope[wght].ttf', 800),
                   tag=('Oswald[wght].ttf', 400), name_size=72, body_size=25),
    'industrial': dict(name=('BarlowSemiCondensed-SemiBold.ttf', None), title=('Barlow-SemiBold.ttf', None),
                       body=('Barlow-Medium.ttf', None), strong=('Barlow-SemiBold.ttf', None),
                       tag=('Oswald[wght].ttf', 400), name_size=92, body_size=27),
    'executive': dict(name=('DMSerifDisplay-Regular.ttf', None), title=('DMSans[opsz,wght].ttf', 600),
                      body=('DMSans[opsz,wght].ttf', 500), strong=('DMSans[opsz,wght].ttf', 700),
                      tag=('Oswald[wght].ttf', 400), name_size=80, body_size=25),
    'geometric': dict(name=('Outfit[wght].ttf', 600), title=('Outfit[wght].ttf', 600),
                      body=('Outfit[wght].ttf', 400), strong=('Outfit[wght].ttf', 600),
                      tag=('Oswald[wght].ttf', 400), name_size=80, body_size=26),
}
DEFAULT_THEME = 'modern'
FONT = dict(THEMES[DEFAULT_THEME])


TEXTURE = {'on': False, 'seed': 7}   # alkyd-molecule background (see molecules.py)


def use_texture(on=True, seed=7):
    TEXTURE.update(on=on, seed=seed)


def _texture(colour, opacity=1.0, clip=None, bleed=0, seed=None, holes=(), w=None, h=None, rows=None):
    """The alkyd network as line-art. Empty string when the texture is switched off.
    holes: (cx, cy, rx, ry) ellipses where the texture fades away so text and logo stay clean."""
    if not TEXTURE['on']:
        return ''
    import molecules
    sd = TEXTURE['seed'] if seed is None else seed
    w, h = w or W, h or H
    t = molecules.alkyd_texture(w, h, bleed, seed=sd, rows=rows)
    labels = ''.join(T(*FONT['body'], 'O', 11.5, x, y + 4.1, colour, 'middle') for x, y, _ in t['labels'])
    cp = f' clip-path="url(#{clip})"' if clip else ''
    mask, mk = '', ''
    if holes:
        mid = f'txm{sd}{len(holes)}'
        mask = (f'<defs><radialGradient id="{mid}g"><stop offset=".55" stop-color="#000"/><stop offset="1" stop-color="#fff"/></radialGradient>'
                f'<mask id="{mid}" maskUnits="userSpaceOnUse" x="{-bleed - 10}" y="{-bleed - 10}" width="{w + 2 * bleed + 20}" height="{h + 2 * bleed + 20}">'
                f'<rect x="{-bleed - 10}" y="{-bleed - 10}" width="{w + 2 * bleed + 20}" height="{h + 2 * bleed + 20}" fill="#fff"/>'
                + ''.join(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="url(#{mid}g)"/>' for x, y, rx, ry in holes)
                + '</mask></defs>')
        mk = f' mask="url(#{mid})"'
    return (f'{mask}<g{cp}><g opacity="{opacity}"{mk}><g fill="none" stroke="{colour}" stroke-width="1.5" stroke-linecap="round">'
            f'<path d="{t["single"]}"/><path d="{t["inner"]}"/></g>{labels}</g></g>')


def use_theme(name):
    if name not in THEMES:
        raise SystemExit(f'Unknown font theme "{name}". Choose from: {", ".join(THEMES)}')
    FONT.clear()
    FONT.update(THEMES[name])


# ------------------------------------------------------------------ text -> outlines
_fonts = {}


def _font(name, wght):
    key = (name, wght)
    if key not in _fonts:
        blob = hb.Blob.from_file_path(os.path.join(HERE, 'fonts', name))
        face = hb.Face(blob)
        font = hb.Font(face)
        if wght:
            font.set_variations({'wght': wght})
        _fonts[key] = (font, face.upem)
    return _fonts[key]


def _shape(name, wght, text):
    font, upem = _font(name, wght)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, {'kern': True, 'liga': True})
    return font, upem, buf


def text_width(name, wght, text, size, tracking=0):
    font, upem, buf = _shape(name, wght, text)
    w = sum(p.x_advance for p in buf.glyph_positions) * size / upem
    return w + tracking * size * max(len(buf.glyph_infos) - 1, 0)


def fit_size(name, wght, text, size, max_w, tracking=0, min_size=12):
    """Largest size <= `size` whose rendered width fits `max_w`."""
    w = text_width(name, wght, text, size, tracking)
    if w <= max_w:
        return size
    return max(min_size, size * max_w / w)


def _text_path(name, wght, text, size, x, y, anchor, tracking):
    font, upem, buf = _shape(name, wght, text)
    s = size / upem
    total = text_width(name, wght, text, size, tracking)
    if anchor == 'middle':
        x -= total / 2
    elif anchor == 'end':
        x -= total
    d, cx = '', x
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        pen = SVGPathPen(None, ntos=lambda v: ('%.2f' % v).rstrip('0').rstrip('.'))
        tp = TransformPen(pen, (s, 0, 0, -s, cx + pos.x_offset * s, y - pos.y_offset * s))
        font.draw_glyph_with_pen(info.codepoint, tp)
        d += pen.getCommands()
        cx += pos.x_advance * s + tracking * size
    return d


def T(font, wght, text, size, x, y, fill, anchor='start', tracking=0):
    """Text as a filled <path>. Empty text -> empty string."""
    if not text:
        return ''
    return f'<path d="{_text_path(font, wght, text, size, x, y, anchor, tracking)}" fill="{fill}"/>'


def wrap_balanced(font, wght, text, size, max_w, tracking=0):
    """Like wrap(), but evens out the line lengths (no single word left alone on the last line)."""
    lines = wrap(font, wght, text, size, max_w, tracking)
    best, w = lines, max_w
    while w > max_w * 0.5:
        w -= 6
        trial = wrap(font, wght, text, size, w, tracking)
        if len(trial) != len(lines):
            break
        best = trial
    return best


def wrap(font, wght, text, size, max_w, tracking=0):
    """Greedy word-wrap. A literal '|' in the text forces a line break."""
    lines = []
    for chunk in text.split('|'):
        cur = ''
        for word in chunk.split():
            trial = (cur + ' ' + word).strip()
            if cur and text_width(font, wght, trial, size, tracking) > max_w:
                lines.append(cur)
                cur = word
            else:
                cur = trial
        if cur:
            lines.append(cur)
    return lines


# ------------------------------------------------------------------ logo
def _logo(uid, scale, tx, ty, letters=True, emblem=True, diamond=True):
    dm, L = LOGO['diamond'], LOGO['letters']
    letter_stops = [(0, '#4a9be0'), (.49, '#2f80cf'), (.50, '#1f66b3'), (1, '#124a8d')]
    em_stops = [(0, '#5aa8ec'), (.45, '#2b7ccb'), (.46, '#1f68b4'), (1, '#0f4a8f')]
    stops = lambda s: ''.join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in s)
    defs = f'''
    <linearGradient id="lt{uid}" x1="0" y1="0" x2="0" y2="1">{stops(letter_stops)}</linearGradient>
    <linearGradient id="em{uid}" x1="0.1" y1="0" x2="0.55" y2="1">{stops(em_stops)}</linearGradient>
    <linearGradient id="gd{uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c5e47f"/><stop offset=".5" stop-color="#9ccc4c"/>
      <stop offset=".51" stop-color="#7cb23a"/><stop offset="1" stop-color="#4f8d17"/></linearGradient>
    <clipPath id="ec{uid}"><path d="{LOGO['emblem']}" clip-rule="evenodd"/></clipPath>'''
    gloss = 'M-10,-10H345V150C260,146 130,158 -10,176Z'
    em = f'''
      <path d="{LOGO['emblem']}" fill="url(#em{uid})" fill-rule="evenodd"/>
      <g clip-path="url(#ec{uid})">
        <path d="{gloss}" fill="#ffffff" opacity=".16"/>
        <path d="{LOGO['emblem']}" fill="none" stroke="#ffffff" stroke-opacity=".38" stroke-width="3.2" fill-rule="evenodd"/>
      </g>''' if emblem else ''
    lt = (f'<g fill="url(#lt{uid})" fill-rule="evenodd"><path d="{L["M"]}"/><path d="{L["P"]}"/><path d="{L["D"]}"/></g>'
          if letters else '')
    dia = f'''
      <g transform="translate({dm['cx']:.2f} {dm['cy']:.2f}) rotate(42)">
        <rect x="-26.5" y="-26.5" width="53" height="53" rx="11" fill="url(#gd{uid})"/>
        <rect x="-26.5" y="-26.5" width="53" height="26.5" rx="11" fill="#ffffff" opacity=".12"/>
      </g>''' if (emblem and diamond) else ''
    body = f'''
    <g transform="translate({tx} {ty}) scale({scale})">{em}
      {lt}{dia}
    </g>'''
    return defs, body


# ------------------------------------------------------------------ logo side
PANEL_X = 690        # left edge of the brand-blue QR panel on the logo side
QR_TILE = 270        # white QR tile size on the logo side (px at 300 dpi) - about 19 mm of code
NOTES = []           # human-readable warnings for the current person (generate.py clears it per person)

_SIDE_DEFS = f"""
    <linearGradient id="bgF" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f8f7f3"/><stop offset="1" stop-color="#ecebe5"/></linearGradient>
    <linearGradient id="gLine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#4c8a1c"/><stop offset=".5" stop-color="#9ccc4c"/><stop offset="1" stop-color="#4c8a1c"/></linearGradient>
    <linearGradient id="gLineV" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4c8a1c"/><stop offset=".5" stop-color="#9ccc4c"/><stop offset="1" stop-color="#4c8a1c"/></linearGradient>
    <linearGradient id="tagG" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#4c8a1c"/><stop offset=".5" stop-color="#6fae2c"/><stop offset="1" stop-color="#4c8a1c"/></linearGradient>
    <linearGradient id="bandF" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="{BLUE_D}"/><stop offset=".5" stop-color="{BLUE_L}"/><stop offset="1" stop-color="{BLUE_D}"/></linearGradient>
    <linearGradient id="panelG" x1="0" y1="0" x2=".6" y2="1">
      <stop offset="0" stop-color="#2f84d6"/><stop offset=".55" stop-color="#1b64ad"/><stop offset="1" stop-color="#103f7a"/></linearGradient>"""


def _rings(cx, cy, r0, r1, step, colour, strength, clip):
    return (f'<g clip-path="url(#{clip})">' + ''.join(
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r}" fill="none" stroke="{colour}" '
        f'stroke-opacity="{strength * (1 - r / (r1 + 40)):.3f}" stroke-width="1.1"/>'
        for r in range(r0, r1, step)) + '</g>')


def front_svg(p=None, tagline='WE INNOVATE.  WE SERVE.'):
    """Logo side. With a QR (p given, qr on): big logo + tagline on the left, and a brand-blue
    panel on the right holding the contact QR with the MPD emblem in its centre.
    Without a QR: the logo is centred on its own."""
    if p is None or not _truthy(p.get('qr')):
        return _front_plain(tagline)
    sc = 0.58
    lcx, lcy = PANEL_X / 2, 250
    defs_l, body_l = _logo('f', sc, lcx - 499 * sc, lcy - 168 * sc)
    tag = T(*FONT['tag'], tagline, 30, lcx, 436, 'url(#tagG)', 'middle', 0.30)
    pcx = (PANEL_X + W) / 2
    TS = QR_TILE
    ty = 272 - TS / 2
    tile = _qr_tile(p, pcx - TS / 2, ty, TS, 22)
    cap_y = ty + TS + 46
    cap = T(*FONT['strong'], 'SCAN TO SAVE', 15, pcx, cap_y, '#ffffff', 'middle', 0.28)
    cap_w = text_width(*FONT['strong'], 'SCAN TO SAVE', 15, 0.28)
    for dx in (-(cap_w / 2 + 16), cap_w / 2 + 16):
        cap += (f'<rect x="-3.6" y="-3.6" width="7.2" height="7.2" rx="1.2" fill="#a6d65a" '
                f'transform="translate({pcx + dx:.1f} {cap_y - 5.5:.1f}) rotate(45)"/>')
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <title>MPD Industries - business card (logo side) - {_esc(p['name'])}</title>
  <defs>
    {defs_l}
    {_SIDE_DEFS}
    <radialGradient id="glow" cx="{lcx}" cy="{lcy}" r="380" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff" stop-opacity="1"/><stop offset=".6" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    <clipPath id="leftC"><rect width="{PANEL_X}" height="{H}"/></clipPath>
    <clipPath id="panelC"><rect x="{PANEL_X}" width="{W - PANEL_X}" height="{H}"/></clipPath>
  </defs>
  <rect width="{W}" height="{H}" fill="url(#bgF)"/>
  {_texture('#c3d3e6', 1, 'leftC', holes=((lcx, lcy, 360, 175), (lcx, 428, 330, 60)))}
  {_rings(lcx, lcy, 220, 720, 34, BLUE_L, .10, 'leftC') if not TEXTURE['on'] else ''}
  <rect width="{PANEL_X}" height="{H}" fill="url(#glow)" opacity=".7"/>
  {body_l}
  {tag}
  <rect x="{PANEL_X}" width="{W - PANEL_X}" height="{H}" fill="url(#panelG)"/>
  {_rings(pcx, ty + TS / 2, 150, 560, 30, '#ffffff', .09, 'panelC') if not TEXTURE['on'] else _texture('#ffffff', .16, 'panelC')}
  <rect x="{PANEL_X - 2}" width="4" height="{H}" fill="url(#gLineV)"/>
  {tile}
  {cap}
</svg>"""


def _front_plain(tagline):
    sc = 0.88
    defs_l, body_l = _logo('f', sc, 525 - 499 * sc, 252 - 168 * sc)
    tag = T(*FONT['tag'], tagline, 38, 525, 478, 'url(#tagG)', 'middle', 0.30)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <title>MPD Industries - business card (logo side)</title>
  <defs>
    {defs_l}
    {_SIDE_DEFS}
    <radialGradient id="glow" cx="525" cy="252" r="470" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff" stop-opacity="1"/><stop offset=".6" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    <clipPath id="cv"><rect width="{W}" height="{H}"/></clipPath>
  </defs>
  <rect width="{W}" height="{H}" fill="url(#bgF)"/>
  {_rings(525, 252, 260, 820, 34, BLUE_L, .10, 'cv')}
  <rect width="{W}" height="{H}" fill="url(#glow)" opacity=".7"/>
  {body_l}
  {tag}
  <rect x="0" y="{H-26}" width="{W}" height="26" fill="url(#bandF)"/>
  <rect x="0" y="{H-29}" width="{W}" height="3" fill="url(#gLine)"/>
</svg>"""


# ------------------------------------------------------------------ "bold" layout (default)
# Logo side: full MPD blue, logo reversed out in white (green diamond kept), contact QR on a white tile.
# Details side: landscape, quiet and spacious (line icons, hairline rules, slim brand edge).
LAYOUT = {'name': 'bold'}     # 'bold' or 'classic'


def use_layout(name):
    if name not in ('bold', 'classic'):
        raise SystemExit(f'Unknown layout "{name}". Choose bold or classic.')
    LAYOUT['name'] = name


def back_dims():
    """(width, height) of the details side (landscape)."""
    return (W, H)


def _root(w, h, bleed=0):
    b = bleed
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w + 2 * b}" height="{h + 2 * b}" '
            f'viewBox="{-b} {-b} {w + 2 * b} {h + 2 * b}">')


def _logo_white(uid, sc, tx, ty):
    """The MPD logo reversed out: white emblem and letters with a soft gloss, green diamond kept."""
    defs, body = _logo(uid, sc, tx, ty)
    body = body.replace(f'url(#em{uid})', f'url(#emW{uid})').replace(f'url(#lt{uid})', f'url(#ltW{uid})')
    body = body.replace('stroke-opacity=".38"', 'stroke-opacity="0"')
    defs += (f'<linearGradient id="emW{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/>'
             f'<stop offset=".45" stop-color="#f4f8fd"/><stop offset=".46" stop-color="#e2ecf8"/><stop offset="1" stop-color="#d2e2f4"/></linearGradient>'
             f'<linearGradient id="ltW{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/>'
             f'<stop offset=".49" stop-color="#f6f9fd"/><stop offset=".5" stop-color="#e1ebf7"/><stop offset="1" stop-color="#cfdff2"/></linearGradient>')
    return defs, body


def front_bold_svg(p, tagline='WE INNOVATE.  WE SERVE.', bleed=0):
    B = bleed
    qr_on = _truthy(p.get('qr'))
    lcx = 330 if qr_on else 525
    sc = 0.58 if qr_on else 0.80
    lcy = 245 if qr_on else 262
    defs_l, logo = _logo_white('fb', sc, lcx - 499 * sc, lcy - 168 * sc)
    tag_y = 422 if qr_on else 488
    tag = T(*FONT['tag'], tagline, 25 if qr_on else 32, lcx, tag_y, 'url(#tagB)', 'middle', 0.30)
    holes = [(lcx, lcy, 330 * sc / 0.58, 140 * sc / 0.58), (lcx, tag_y - 8, 300, 40)]
    tile = cap = ''
    if qr_on:
        tile = _qr_tile(p, 770, 150, 236, 20)
        # caption with an add-contact icon, so nobody expects a website
        txt, col, ty = 'SAVE CONTACT', '#c9dcf2', 424
        cw = text_width(*FONT['strong'], txt, 11.5, 0.30)
        icon_w, gap = 14, 8
        x0 = 888 - (icon_w + gap + cw) / 2
        s = icon_w / 24
        cap = (f'<g transform="translate({x0:.1f} {ty - 12:.1f}) scale({s:.3f})" fill="none" stroke="{col}" stroke-width="2.2" '
               f'stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>'
               f'<circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></g>'
               + T(*FONT['strong'], txt, 11.5, x0 + icon_w + gap, ty, col, 'start', 0.30))
        holes.append((888, 285, 175, 200))
    return f"""{_root(W, H, B)}
  <title>MPD Industries - business card (logo side) - {_esc(p.get('name', ''))}</title>
  <defs>
    {defs_l}
    {_SIDE_DEFS}
    <linearGradient id="bgBold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2b80d2"/><stop offset=".5" stop-color="#1b64ad"/><stop offset="1" stop-color="#0e4386"/></linearGradient>
    <radialGradient id="glowBold" cx="{lcx}" cy="{lcy - 15}" r="560" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#63b3f3" stop-opacity=".5"/><stop offset="1" stop-color="#63b3f3" stop-opacity="0"/></radialGradient>
    <linearGradient id="tagB" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a6d65a"/><stop offset=".5" stop-color="#cdec95"/><stop offset="1" stop-color="#a6d65a"/></linearGradient>
  </defs>
  <rect x="{-B}" y="{-B}" width="{W + 2 * B}" height="{H + 2 * B}" fill="url(#bgBold)"/>
  <rect x="{-B}" y="{-B}" width="{W + 2 * B}" height="{H + 2 * B}" fill="url(#glowBold)"/>
  {_texture('#ffffff', .09, None, B, TEXTURE['seed'] + 3, holes=holes)}
  <path d="{LOGO['emblem']}" fill="#ffffff" opacity=".055" fill-rule="evenodd" transform="translate(735 238) scale(1.75)"/>
  {logo}
  {tag}
  {tile}
  {cap}
  <rect x="{-B}" y="{H - 4}" width="{W + 2 * B}" height="{4 + B}" fill="url(#gLine)"/>
</svg>"""


def _line_icon(name, cx, cy, size=20, colour=BLUE):
    """Thin outline icon (no badge) - quieter and more premium than filled circles."""
    s = size / 24
    return (f'<g transform="translate({cx - 12 * s:.2f} {cy - 12 * s:.2f}) scale({s:.4f})" fill="none" stroke="{colour}" '
            f'stroke-width="{1.55 / s * s:.2f}" stroke-linecap="round" stroke-linejoin="round">{ICONS[name]}</g>')


def back_refined_svg(p, bleed=0):
    """Details side, landscape: generous margins, line icons, hairline rules and a slim brand edge."""
    B = bleed
    L, R = 64, W - 64
    parts = []

    # top-right: full logo with the company name set small underneath
    LS = 0.23
    defs_l, logo = _logo('br', LS, R - 994 * LS, 80 - 3 * LS)
    logo_left = R - 994 * LS + 4 * LS
    company = (p.get('company') or '').upper()
    parts.append(T(*FONT['strong'], company, fit_size(*FONT['strong'], company, 12.5, R - logo_left + 20, 0.34, min_size=9),
                   R, 190, MUTED, 'end', 0.34))

    # name + title
    name = p['name']
    NAME_W = logo_left - L - 44
    nsize = fit_size(*FONT['name'], name, 66, NAME_W, min_size=10)
    title_y = 190
    if nsize >= 66 * 0.72 or ' ' not in name.strip():
        nsize = max(nsize, 30)
        parts.append(T(*FONT['name'], name, nsize, L - 2, 146, BLUE))
    else:
        words = name.split()
        best = min(range(1, len(words)),
                   key=lambda i: abs(text_width(*FONT['name'], ' '.join(words[:i]), 50) - text_width(*FONT['name'], ' '.join(words[i:]), 50)))
        l1, l2 = ' '.join(words[:best]), ' '.join(words[best:])
        nsize = min(46, fit_size(*FONT['name'], l1, 46, NAME_W, min_size=24), fit_size(*FONT['name'], l2, 46, NAME_W, min_size=24))
        parts.append(T(*FONT['name'], l1, nsize, L - 2, 104, BLUE))
        parts.append(T(*FONT['name'], l2, nsize, L - 2, 104 + nsize, BLUE))
        title_y = 202
        NOTES.append('long name set on two lines')
    title = (p.get('title') or '').upper()
    tsize = fit_size(*FONT['title'], title, 16.5, logo_left - L - 30, 0.40, min_size=9)
    if tsize < 12:
        NOTES.append(f'title is long and was shrunk to {tsize * 0.24:.1f}pt - consider shortening it')
    parts.append(T(*FONT['title'], title, tsize, L, title_y, GREEN, tracking=0.40))

    # hairline rule with a small green diamond (the logo's diamond)
    parts.append(f'<rect x="-4.5" y="-4.5" width="9" height="9" rx="1.6" fill="#6fae2c" transform="translate({L + 5} 238) rotate(45)"/>')
    parts.append(f'<rect x="{L + 20}" y="237.4" width="{R - L - 20}" height="1.2" fill="url(#hdiv)"/>')

    # contacts (left column)
    rows = [(ic, p.get(k, '')) for ic, k in
            (('mobile', 'mobile'), ('phone', 'phone'), ('mail', 'email'), ('globe', 'web1'), ('globe', 'web2'))]
    rows = [(ic, t) for ic, t in rows if t]
    for i, (ic, txt) in enumerate(rows):
        cy = 300 + i * 44
        size = fit_size(*FONT['body'], txt, 21, 400, 0.01, min_size=10)
        if size < 15:
            NOTES.append(f'"{txt}" was shrunk to {size * 0.24:.1f}pt to fit - consider shortening it')
        parts.append(_line_icon(ic, L + 10, cy))
        parts.append(T(*FONT['body'], txt, size, L + 40, cy + 7, INK, tracking=0.01))

    # right column: address, then certifications
    RX = 560
    parts.append(f'<rect x="{RX - 36}" y="280" width="1.2" height="215" fill="url(#vdiv)"/>')
    addr = p.get('address', '')
    if addr:
        size = 21
        lines = wrap_balanced(*FONT['body'], addr, size, R - RX - 34, 0.01)
        while len(lines) > 3 and size > 12:
            size -= 1
            lines = wrap_balanced(*FONT['body'], addr, size, R - RX - 34, 0.01)
        parts.append(_line_icon('pin', RX + 10, 300))
        for i, ln in enumerate(lines):
            parts.append(T(*FONT['body'], ln, size, RX + 40, 307 + i * size * 1.55, INK, tracking=0.01))
    items = _cert_items(p.get('certifications', ''))
    cert = '  ·  '.join(c if i == 0 else c.replace('ISO ', '', 1) for i, c in enumerate(items))
    label = (p.get('certified_label') or '').upper()
    if cert or label:
        parts.append(T(*FONT['strong'], cert, fit_size(*FONT['strong'], cert, 14.5, R - RX, 0.05, min_size=9), RX, 454, MUTED, tracking=0.05))
        parts.append(T(*FONT['strong'], label, 12, RX, 477, GREEN, tracking=0.32))

    holes = ((300, 165, 330, 85), (840, 140, 210, 80), (260, 388, 280, 130), (775, 388, 270, 130))
    return f"""{_root(W, H, B)}
  <title>MPD Industries - business card (details side) - {_esc(name)}</title>
  <defs>
    {defs_l}
    <linearGradient id="bgB" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#f8f7f3"/><stop offset="1" stop-color="#f0eee8"/></linearGradient>
    <linearGradient id="bandG" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#124a8d"/><stop offset=".5" stop-color="#2f84d6"/><stop offset="1" stop-color="#124a8d"/></linearGradient>
    <linearGradient id="gLine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#4c8a1c"/><stop offset=".5" stop-color="#9ccc4c"/><stop offset="1" stop-color="#4c8a1c"/></linearGradient>
    <linearGradient id="vdiv" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c3ceda" stop-opacity="0"/><stop offset=".5" stop-color="#c3ceda"/><stop offset="1" stop-color="#c3ceda" stop-opacity="0"/></linearGradient>
    <linearGradient id="hdiv" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#b9c4d2"/><stop offset="1" stop-color="#b9c4d2" stop-opacity=".1"/></linearGradient>
  </defs>
  <rect x="{-B}" y="{-B}" width="{W + 2 * B}" height="{H + 2 * B}" fill="url(#bgB)"/>
  {_texture('#dbe4ee', 1, None, B, TEXTURE['seed'] + 11, holes=holes)}
  {logo}
  {''.join(parts)}
  <rect x="{-B}" y="{H - 14}" width="{W + 2 * B}" height="2.5" fill="url(#gLine)"/>
  <rect x="{-B}" y="{H - 11.5}" width="{W + 2 * B}" height="{11.5 + B}" fill="url(#bandG)"/>
</svg>"""


# ------------------------------------------------------------------ details side (personalised)
ICONS = {
    'mobile': '<rect x="5" y="2" width="14" height="20" rx="2.5"/><path d="M12 18h.01"/>',
    'phone': '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    'mail': '<rect x="2" y="4" width="20" height="16" rx="2.5"/><path d="m22 7-10 6L2 7"/>',
    'globe': '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    'pin': '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
}


def _icon(name, cx, cy, r=19):
    s = r * 1.02 / 12 * 0.62
    return (f'<circle cx="{cx}" cy="{cy:.1f}" r="{r}" fill="url(#badge)"/>'
            f'<circle cx="{cx}" cy="{cy:.1f}" r="{r - 0.6}" fill="none" stroke="#ffffff" stroke-opacity=".28" stroke-width="1"/>'
            f'<g transform="translate({cx - 12 * s:.2f} {cy - 12 * s:.2f}) scale({s:.4f})" fill="none" stroke="#ffffff" '
            f'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{ICONS[name]}</g>')


def _cert_items(text):
    """'ISO 9001:2015 · 14001:2015 · 45001:2018' (or '|'-separated) -> ['ISO 9001:2015', 'ISO 14001:2015', ...]"""
    items = [c.strip() for c in text.replace('|', '·').split('·') if c.strip()]
    if items and items[0].upper().startswith('ISO'):
        items = [c if c.upper().startswith('ISO') else 'ISO ' + c for c in items]
    return items


def back_svg(p, bleed=0):
    """Details side of the classic layout. p: dict with keys name, title, mobile, phone, email,
    web1, web2, address, company, certifications, certified_label (empty string = hide)."""
    parts = []

    # top-right: the full MPD logo
    LOGO_SC = 0.27
    defs_l, logo = _logo('b', LOGO_SC, 990 - 994 * LOGO_SC, 76 - 3 * LOGO_SC)
    logo_left = 990 - 994 * LOGO_SC + 4 * LOGO_SC

    # name + title. One line if it fits at a good size, otherwise two balanced lines.
    name = p['name']
    NAME_W = logo_left - 60 - 30
    nsize = fit_size(*FONT['name'], name, FONT['name_size'], NAME_W, min_size=10)
    title_y = 197
    if nsize >= FONT['name_size'] * 0.72 or ' ' not in name.strip():
        nsize = max(nsize, FONT['name_size'] * 0.4)
        parts.append(T(*FONT['name'], name, nsize, 60, 150, BLUE))
        if text_width(*FONT['name'], name, nsize) > NAME_W + 1:
            NOTES.append('name is very long and may touch the logo')
    else:
        words = name.split()
        best = min(range(1, len(words)),
                   key=lambda i: abs(text_width(*FONT['name'], ' '.join(words[:i]), 60) - text_width(*FONT['name'], ' '.join(words[i:]), 60)))
        l1, l2 = ' '.join(words[:best]), ' '.join(words[best:])
        two = FONT['name_size'] * 0.68
        nsize = min(two, fit_size(*FONT['name'], l1, two, NAME_W, min_size=26), fit_size(*FONT['name'], l2, two, NAME_W, min_size=26))
        parts.append(T(*FONT['name'], l1, nsize, 60, 108, BLUE))
        parts.append(T(*FONT['name'], l2, nsize, 60, 108 + nsize * 1.0, BLUE))
        title_y = 208
        NOTES.append('long name set on two lines')
    title = (p.get('title') or '').upper()
    tsize = fit_size(*FONT['title'], title, 21, 860, 0.42, min_size=10)
    if tsize < 15:
        NOTES.append(f'title is long and was shrunk to {tsize * 0.24:.1f}pt - consider shortening it')
    parts.append(T(*FONT['title'], title, tsize, 63, title_y, GREEN, tracking=0.42))

    # contact rows (left column) - empty fields collapse
    rows = [(ic, p.get(k, '')) for ic, k in
            (('mobile', 'mobile'), ('phone', 'phone'), ('mail', 'email'), ('globe', 'web1'), ('globe', 'web2'))]
    rows = [(ic, t) for ic, t in rows if t]
    for i, (ic, txt) in enumerate(rows):
        cy = 292 + i * 46
        size = fit_size(*FONT['body'], txt, FONT['body_size'], 395, 0.01, min_size=9)
        if size < 17:
            NOTES.append(f'"{txt}" was shrunk to {size * 0.24:.1f}pt to fit - consider shortening it')
        parts.append(_icon(ic, 79, cy))
        parts.append(T(*FONT['body'], txt, size, 112, cy + 8, INK, tracking=0.01))

    # address (right column) - wrapped to the column, up to 3 lines
    addr = p.get('address', '')
    if addr:
        size = FONT['body_size']
        lines = wrap(*FONT['body'], addr, size, 378, 0.01)
        while len(lines) > 3 and size > 12:
            size -= 1
            lines = wrap(*FONT['body'], addr, size, 378, 0.01)
        step = size * 1.56
        if size < 17:
            NOTES.append(f'address was shrunk to {size * 0.24:.1f}pt to fit 3 lines - consider shortening it')
        parts.append(_icon('pin', 579, 292))
        for i, ln in enumerate(lines):
            parts.append(T(*FONT['body'], ln, size, 612, 300 + i * step, INK, tracking=0.01))

    # certifications under the address
    cert = '  \u00b7  '.join(c if i == 0 else c.replace('ISO ', '', 1)
                             for i, c in enumerate(_cert_items(p.get('certifications', ''))))
    label = (p.get('certified_label') or '').upper()
    if cert or label:
        parts.append('<rect x="560" y="414" width="430" height="1.3" fill="url(#hdiv)"/>')
        parts.append(T(*FONT['strong'], cert, fit_size(*FONT['strong'], cert, 17.5, 430, 0.06, min_size=11), 560, 452, MUTED, tracking=0.06))
        parts.append(T(*FONT['strong'], label, 15, 560, 481, GREEN, tracking=0.34))

    company = (p.get('company') or '').upper()
    band = T(*FONT['strong'], company, fit_size(*FONT['strong'], company, 22, 900, 0.36, min_size=12),
             525, 577, '#ffffff', 'middle', 0.36)
    B = bleed
    footer = (f'<rect x="{-B}" y="{H - 72}" width="{W + 2 * B}" height="{72 + B}" fill="url(#bandG)"/>'
              f'<rect x="{-B}" y="{H - 72}" width="{W + 2 * B}" height="3.5" fill="url(#gLine)"/>' + band)

    return f"""{_svg_root(B)}
  <title>MPD Industries - business card (details side) - {_esc(name)}</title>
  <defs>
    {defs_l}
    <linearGradient id="bgB" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#f7f5ef"/><stop offset="1" stop-color="#eeebe2"/></linearGradient>
    <linearGradient id="badge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b92e0"/><stop offset="1" stop-color="#1b64ad"/></linearGradient>
    <linearGradient id="bandG" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#124a8d"/><stop offset=".5" stop-color="#2f84d6"/><stop offset="1" stop-color="#124a8d"/></linearGradient>
    <linearGradient id="gLine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#4c8a1c"/><stop offset=".5" stop-color="#9ccc4c"/><stop offset="1" stop-color="#4c8a1c"/></linearGradient>
    <linearGradient id="vdiv" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#b9c4d2" stop-opacity="0"/><stop offset=".5" stop-color="#b9c4d2"/><stop offset="1" stop-color="#b9c4d2" stop-opacity="0"/></linearGradient>
    <linearGradient id="hdiv" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#b9c4d2"/><stop offset="1" stop-color="#b9c4d2" stop-opacity=".15"/></linearGradient>
  </defs>
  <rect x="{-B}" y="{-B}" width="{W + 2 * B}" height="{H + 2 * B}" fill="url(#bgB)"/>
  {_texture('#d0dceb', 1, None, B, TEXTURE['seed'] + 11, holes=((330, 162, 380, 95), (840, 125, 230, 85), (265, 384, 290, 150), (775, 385, 285, 150)))}
  <rect x="{-B}" y="{-B}" width="{W + 2 * B}" height="{6 + B}" fill="url(#bandG)"/>
  {logo}
  <rect x="60" y="233" width="930" height="1.3" fill="url(#hdiv)"/>
  <rect x="60" y="231.6" width="96" height="4" fill="url(#gLine)"/>
  <rect x="524" y="268" width="1.3" height="236" fill="url(#vdiv)"/>
  {''.join(parts)}
  {footer}
</svg>"""


def _svg_root(bleed=0):
    """<svg> opening tag; with bleed the canvas grows by `bleed` px on every side (3 mm = 35 px)."""
    b = bleed
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W + 2 * b}" height="{H + 2 * b}" '
            f'viewBox="{-b} {-b} {W + 2 * b} {H + 2 * b}">')


# ------------------------------------------------------------------ vCard QR
QR_BLUE = '#0f3f7a'   # deep brand blue (the band's dark end): strong contrast for reliable scanning
QR_EYE = '#3d7a12'    # centre of the three corner "eyes": the logo's green, darkened for contrast
QR_ERROR = 'l'        # error-correction level: L keeps the code small so each square stays big
QR_MIN_MODULE_PX = 3.6  # below this (0.30 mm per square) we warn: too small for some phones/printers
_HONORIFICS = {'dr', 'dr.', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'prof', 'prof.', 'shri', 'smt', 'smt.', 'ca', 'er', 'er.'}


def _truthy(v):
    return v not in (None, '', False) and str(v).strip().lower() not in ('-', '--', 'none', 'n/a', 'na', 'no', 'false', 'off', '0')


def vcard(p):
    """Minimal vCard 3.0: name with the post in brackets, company, phone number and email."""
    esc = lambda t: t.replace('\\', '\\\\').replace(';', '\\;').replace(',', '\\,').replace('\n', '\\n')
    words = p['name'].split()
    prefix = ''
    while len(words) > 1 and words[0].lower() in _HONORIFICS:
        prefix = (prefix + ' ' + words.pop(0)).strip()
    family = words[-1] if len(words) > 1 else ''
    given = ' '.join(words[:-1]) if len(words) > 1 else (words[0] if words else '')
    post = f"({p['title']})" if p.get('title') else ''
    display = f"{p['name']} {post}".strip()
    L = ['BEGIN:VCARD', 'VERSION:3.0',
         f'N:{esc(family)};{esc(given)};;{esc(prefix)};{esc(post)}',   # post shows as the name suffix
         f'FN:{esc(display)}']
    if p.get('company'):
        L.append(f'ORG:{esc(p["company"])}')
    phone = p.get('mobile') or p.get('phone')
    if phone:
        L.append(f'TEL:{phone}')
    if p.get('email'):
        L.append(f'EMAIL:{p["email"]}')
    L.append('END:VCARD')
    return '\n'.join(L)


def _rr(x, y, w, h, r):
    """rounded-rect subpath"""
    r = min(r, w / 2, h / 2)
    f = lambda v: ('%.2f' % v).rstrip('0').rstrip('.')
    return (f'M{f(x + r)} {f(y)}H{f(x + w - r)}A{f(r)} {f(r)} 0 0 1 {f(x + w)} {f(y + r)}V{f(y + h - r)}'
            f'A{f(r)} {f(r)} 0 0 1 {f(x + w - r)} {f(y + h)}H{f(x + r)}A{f(r)} {f(r)} 0 0 1 {f(x)} {f(y + h - r)}'
            f'V{f(y + r)}A{f(r)} {f(r)} 0 0 1 {f(x + r)} {f(y)}Z')


def qr_modules(payload, error='l'):
    import segno
    q = segno.make(payload, error=error, encoding='utf-8', boost_error=False, micro=False)
    return [list(row) for row in q.matrix], q.version


def _qr_paths(m, x0, y0, size):
    """QR as plain square modules (merged into row runs) - the most widely readable form.
    Returns (dark_path, eye_centres_path)."""
    n = len(m)
    c = size / n
    eyes = {(ei + a, ej + b) for ei, ej in ((2, 2), (2, n - 5), (n - 5, 2)) for a in range(3) for b in range(3)}
    f = lambda v: ('%.2f' % v).rstrip('0').rstrip('.')
    dark, centres = '', ''
    for i in range(n):
        j = 0
        while j < n:
            if m[i][j] and (i, j) not in eyes:
                k = j
                while k < n and m[i][k] and (i, k) not in eyes:
                    k += 1
                dark += f'M{f(x0 + j * c)} {f(y0 + i * c)}h{f((k - j) * c)}v{f(c + .3)}h{f(-(k - j) * c)}z'
                j = k
            else:
                j += 1
    for ei, ej in ((2, 2), (2, n - 5), (n - 5, 2)):
        centres += f'M{f(x0 + ej * c)} {f(y0 + ei * c)}h{f(3 * c)}v{f(3 * c)}h{f(-3 * c)}z'
    return dark, centres


def _qr_tile(p, x, y, ts, pad):
    """White QR tile (ts x ts) with a soft shadow: plain deep-blue squares with green eye centres."""
    payload = vcard(p)
    m, version = qr_modules(payload, QR_ERROR)
    n = len(m)
    size = ts - 2 * pad
    c = size / n
    NOTES.append(f'QR: {len(payload)} chars, version {version} ({n}x{n}), {size / 300 * 25.4:.1f} mm code, '
                 f'{c / 300 * 25.4:.2f} mm per square')
    if c < QR_MIN_MODULE_PX:
        NOTES.append('QR squares are getting small (name/company/post too long) - shorten them so the code scans easily')
    dark, centres = _qr_paths(m, x + pad, y + pad, size)
    return (f'<rect x="{x:.1f}" y="{y + 6:.1f}" width="{ts}" height="{ts}" rx="13" fill="#06213f" opacity=".22"/>'
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{ts}" height="{ts}" rx="13" fill="#ffffff"/>'
            f'<path d="{dark}" fill="{QR_BLUE}"/><path d="{centres}" fill="{QR_EYE}"/>')


def _esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
