# Vectorise the logo's lettering (the red mark is rebuilt geometrically by build_mark.py):
#   python3 trace/trace.py <logo.jpg> <out.json>
# The source is a small, aliased JPEG, so it is upscaled, lightly blurred, thresholded at the
# midpoint and traced with potrace. Text is split into
# glyph groups (connected components, with dots/matras merged into the glyph they overlap) so it can be
# animated piece by piece.
import json, re, subprocess, sys, tempfile, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SRC, OUT = sys.argv[1], sys.argv[2]
S = 8
src = Image.open(SRC).convert('RGB')
W, H = src.size
up = src.resize((W * S, H * S), Image.LANCZOS)

def field(blur):
    a = np.asarray(up.filter(ImageFilter.GaussianBlur(blur * S))).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return r - (g + b) / 2, 255 - (r + g + b) / 3

def potrace(mask, alpha=1.1, opt=0.6):
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, 'm.pbm')
        Image.fromarray(np.where(mask, 0, 255).astype(np.uint8)).save(p)
        svg = subprocess.run(['potrace', p, '-s', '-o', '-', '--flat', '-t', str(S * S), '-a', str(alpha), '-O', str(opt), '-u', '10'],
                             capture_output=True, text=True, check=True).stdout
    d = ' '.join(re.findall(r' d="([^"]+)"', svg, re.S))
    # potrace emits y-up coordinates in 1/10 px of the upscaled bitmap; the client applies this transform
    return ' '.join(d.split())

def box(m):
    ys, xs = np.where(m)
    return [xs.min() / S, ys.min() / S, (xs.max() + 1) / S, (ys.max() + 1) / S]

def region(mask, x0, y0, x1, y1):
    m = np.zeros_like(mask); m[y0 * S:y1 * S, x0 * S:x1 * S] = mask[y0 * S:y1 * S, x0 * S:x1 * S]; return m

def glyphs(mask, gap):
    """Connected components grouped into glyphs: components whose x-ranges overlap (or sit within
    `gap` source px) belong together, so the i's dot and Devanagari matras stay with their letter."""
    lab, n = ndimage.label(mask)
    comps = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        if (lab[sl] == i).sum() < (S * S * 2): continue
        comps.append([sl[1].start / S, sl[1].stop / S, i])
    comps.sort()
    groups = []
    for x0, x1, i in comps:
        if groups and x0 <= groups[-1][1] + gap: groups[-1][1] = max(groups[-1][1], x1); groups[-1][2].append(i)
        else: groups.append([x0, x1, [i]])
    out = []
    for _, _, ids in groups:
        m = np.isin(lab, ids)
        out.append({'d': potrace(m), 'box': box(m)})
    return out

_, ink_f = field(0.55)
ink = ink_f > 120

parts = {
    'word': glyphs(region(ink, 10, 318, 525, 404), -0.3),
    'reg': {'d': potrace(region(ink, 525, 318, 553, 360)), 'box': box(region(ink, 525, 318, 553, 360))},
    'since': glyphs(region(ink, 280, 405, 540, 442), -0.3),
    'tag': glyphs(region(ink, 5, 460, 545, 515), 3.0),
}
json.dump({'unit': 1 / (S * 10), 'height': H * S * 10, 'size': [W, H], 'parts': parts}, open(OUT, 'w'))
print('word', len(parts['word']), 'since', len(parts['since']), 'tag', len(parts['tag']), [round(g['box'][0]) for g in parts['tag']])
