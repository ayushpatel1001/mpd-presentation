# Rebuild the red mark as clean geometry fitted to the supplied (aliased) logo:
#   python3 trace/build_mark.py <logo.jpg> <out.json>
# straight edges by least squares (snapped to the mark's two edge angles), fillets tangent to them,
# a fitted cubic for the big bottom-left curve, and the two white fold lines as tapered crescents.
# Output paths are SVG path strings in source-image pixels.
import json, sys
import numpy as np
from shapely.geometry import Polygon
from PIL import Image, ImageFilter
from scipy import ndimage
from scipy.optimize import minimize
from scipy.spatial import cKDTree

S = 8
src = Image.open(sys.argv[1]).convert('RGB')
W, H = src.size
up = src.resize((W * S, H * S), Image.LANCZOS)

def red_mask(blur):
    a = np.asarray(up.filter(ImageFilter.GaussianBlur(blur * S))).astype(float)
    return (a[..., 0] - (a[..., 1] + a[..., 2]) / 2) > 95

red = red_mask(0.8)
ys, xs = np.where(red & ~ndimage.binary_erosion(red))
P = np.c_[(xs + 0.5) / S, (ys + 0.5) / S]

# Outline edges in drawing order (clockwise on screen), each seeded with two rough points.
# The third value groups edges that the design draws parallel; they share one fitted angle.
EDGES = [
    ('band_outer',   (113, 140), (203, 55),  'A'),
    ('lobeL_down',   (250, 55),  (278, 75),  'C'),
    ('cleft_up',     (288, 74),  (320, 48),  None),
    ('right_upper',  (360, 52),  (460, 132), 'B'),
    ('end',          (460, 137), (405, 190), 'A'),
    ('right_lower',  (395, 190), (350, 150), 'B'),
    ('heart_right',  (347, 150), (297, 188), None),
    ('tri_right',    (283, 187), (228, 150), 'C'),
    ('tri_left',     (223, 152), (187, 187), 'A'),
    ('tri_bottom',   (190, 197), (282, 197), 'H'),
    ('bottom_right', (283, 202), (220, 262), 'A'),
    ('bottom',       (217, 263), (160, 263), 'H'),
]
# corner fillet radii (source px), measured against the logo; 'curve' is the fitted cubic
RADII = [36.25, 10.5, 38.25, 3.25, 4.5, 2.0, 9.0, 2.0, 4.25, 1.75, 12.25, 'curve']

fits = []
for name, p0, p1, grp in EDGES:
    p0, p1 = np.array(p0, float), np.array(p1, float)
    l = np.linalg.norm(p1 - p0); u = (p1 - p0) / l; n = np.array([-u[1], u[0]])
    s, dist = (P - p0) @ u, (P - p0) @ n
    Q = P[(s > 0.15 * l) & (s < 0.85 * l) & (np.abs(dist) < 4)]
    c = Q.mean(0)
    d = np.linalg.svd(Q - c)[2][0]
    fits.append([c, d if d @ u > 0 else -d, grp, len(Q)])

def axis_angle(d):  # direction modulo 180°, in degrees
    return np.degrees(np.arctan2(d[1], d[0])) % 180

for grp in ('A', 'B', 'C', 'H'):
    members = [f for f in fits if f[2] == grp]
    if grp == 'H': ang = 0.0
    else: ang = np.average([axis_angle(f[1]) for f in members], weights=[f[3] for f in members])
    for f in members:
        d = np.array([np.cos(np.radians(ang)), np.sin(np.radians(ang))])
        f[1] = d if d @ f[1] > 0 else -d

def isect(a, b):
    (c1, u1), (c2, u2) = a[:2], b[:2]
    t = np.linalg.solve(np.c_[u1, -u2], c2 - c1)
    return c1 + u1 * t[0]

# big bottom-left curve: cubic between the bottom edge and the band's outer edge
ib, io = len(EDGES) - 1, 0
Xc = isect(fits[ib], fits[io]); ub, uo = fits[ib][1], fits[io][1]
Q = P[(P[:, 0] < 172) & (P[:, 1] > 125)]
Q = Q[::3]
def bez(p, n=600):
    a, b, k1, k2 = p
    P0 = Xc - ub * a; P3 = Xc + uo * b
    P1 = P0 + ub * k1 * a; P2 = P3 - uo * k2 * b
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 3 * P0 + 3 * (1 - t) ** 2 * t * P1 + 3 * (1 - t) * t ** 2 * P2 + t ** 3 * P3, (P0, P1, P2, P3)
def cost(p):
    return np.mean(cKDTree(bez(p)[0]).query(Q)[0] ** 2)
best = min((minimize(cost, [a0, b0, .55, .55], method='Nelder-Mead', options={'maxiter': 2000}) for a0 in (70, 100) for b0 in (70, 100)), key=lambda r: r.fun)
curve = bez(best.x)[1]
print(f'curve fit rms {np.sqrt(best.fun):.2f}px  params {np.round(best.x, 3)}')

# assemble the outline: each corner is a fillet arc (A) or the cubic
f2 = lambda p: f'{p[0]:.3f} {p[1]:.3f}'
segs = []
for i in range(len(EDGES)):
    a, b = fits[i], fits[(i + 1) % len(EDGES)]
    r = RADII[i]
    if r == 'curve':
        segs.append(('C', curve)); continue
    X = isect(a, b); v1, v2 = -a[1], b[1]
    th = np.arccos(np.clip(v1 @ v2, -1, 1)); tl = r / np.tan(th / 2)
    T1, T2 = X + v1 * tl, X + v2 * tl
    sweep = 1 if (a[1][0] * b[1][1] - a[1][1] * b[1][0]) > 0 else 0
    segs.append(('A', T1, T2, r, sweep))
start = segs[-1][1][3]  # end of the cubic
d = f'M{f2(start)}'
pts = []
for s in segs:
    if s[0] == 'A':
        d += f' L{f2(s[1])} A{s[3]} {s[3]} 0 0 {s[4]} {f2(s[2])}'
        # arc samples: centre is r away from both tangent points, on the inside of the turn
        T1, T2, r = s[1], s[2], s[3]
        m = (T1 + T2) / 2; h = np.linalg.norm(T2 - T1) / 2
        nrm = np.array([-(T2 - T1)[1], (T2 - T1)[0]]) / (2 * h)
        ctr = m + nrm * np.sqrt(max(r * r - h * h, 0)) * (1 if s[4] else -1)
        a0, a1 = np.arctan2(*(T1 - ctr)[::-1]), np.arctan2(*(T2 - ctr)[::-1])
        da = (a1 - a0 + np.pi) % (2 * np.pi) - np.pi
        pts += [ctr + r * np.array([np.cos(a0 + da * k), np.sin(a0 + da * k)]) for k in np.linspace(0, 1, 24)]
    else:
        d += f' L{f2(s[1][0])} C{f2(s[1][1])} {f2(s[1][2])} {f2(s[1][3])}'
        B = s[1]; t = np.linspace(0, 1, 80)[:, None]
        pts += list((1 - t) ** 3 * B[0] + 3 * (1 - t) ** 2 * t * B[1] + 3 * (1 - t) * t ** 2 * B[2] + t ** 3 * B[3])
d += ' Z'
outline_poly = Polygon(pts).buffer(0)

# white fold lines: centre x(y) and horizontal width w(y) fitted from the lightly blurred logo
fine = red_mask(0.4)
def fold(x0, x1, y0, y1, apex):
    rows = []
    for Y in range(y0 * S, y1 * S, 2):
        row = fine[Y, x0 * S:x1 * S]
        edges = np.flatnonzero(np.diff(row.astype(int)))
        runs = [(edges[k] + 1, edges[k + 1] + 1) for k in range(len(edges) - 1) if not row[edges[k] + 1]]
        if runs:
            s, e = max(runs, key=lambda r: r[1] - r[0])
            rows.append(((Y + .5) / S, x0 + (s + e) / 2 / S, (e - s) / S))
    R = np.array(rows)
    top = R[0, 0]
    cx = np.polyfit(R[:, 0], R[:, 1], 2)
    cw = np.polyfit(R[:, 0] - top, R[:, 2], 1, w=np.ones(len(R)))
    yy = np.linspace(top, apex[1], 24)
    xc = np.polyval(cx, yy); xc += (apex[0] - xc[-1]) * ((yy - top) / (apex[1] - top)) ** 2  # land on the corner
    w = np.clip(np.polyval(cw, yy - top), 0, None); w[0] = 0
    left = [(x - ww / 2, y) for x, y, ww in zip(xc, yy, w)]
    right = [(x + ww / 2, y) for x, y, ww in zip(xc, yy, w)][::-1]
    # extend past the corner so the cut opens cleanly into the triangle/notch
    ext = [(apex[0] - 4, apex[1] + 6), (apex[0] + 4, apex[1] + 6)]
    poly = left + ext + right
    centre = list(zip(xc, yy))
    return 'M' + ' L'.join(f2(p) for p in poly) + ' Z', centre, Polygon(poly).buffer(0)

apexL = isect(fits[7], fits[8]); apexR = isect(fits[5], fits[6])
foldL, cL, RL = fold(180, 240, 95, 150, apexL)
foldR, cR, RR = fold(340, 385, 95, 150, apexR)

# heart = region inside the folds: fold centrelines extended straight out past the mark, a loop above it
def extend(c, k=60):
    (x0, y0), (x1, y1) = c[0], c[2]
    v = np.array([x0 - x1, y0 - y1]); v /= np.linalg.norm(v)
    return (x0 + v[0] * k, y0 + v[1] * k)
tip = isect(fits[6], fits[7])
hl = [extend(cL)] + cL + [tuple(apexL), tuple(tip + np.array([0, 2])), tuple(apexR)] + cR[::-1] + [extend(cR)]
heart = 'M' + ' L'.join(f2(p) for p in hl) + f' L{f2((hl[-1][0] + 40, -40))} L{f2((hl[0][0] - 40, -40))} Z'

# heart silhouette (for the glowing outline that is drawn first), starting at the cleft, as two halves
hp = Polygon(hl + [(hl[-1][0] + 40, -40), (hl[0][0] - 40, -40)]).buffer(0)
sil = outline_poly.difference(RL).difference(RR).intersection(hp)
sil = max(getattr(sil, 'geoms', [sil]), key=lambda g: g.area).simplify(0.05)
ring = np.array(sil.exterior.coords)[:-1]
if Polygon(ring).exterior.is_ccw: ring = ring[::-1]
cleft = isect(fits[1], fits[2]) + np.array([0, 3])
k = int(np.argmin(np.linalg.norm(ring - cleft, axis=1))); ring = np.roll(ring, -k, axis=0)
j = int(np.argmin(np.linalg.norm(ring - tip, axis=1)))
halfR = ring[:j + 1]; halfL = np.vstack([ring[j:], ring[:1]])[::-1]
geo = {
    'heartLeft': np.round(halfR, 2).tolist(), 'heartRight': np.round(halfL, 2).tolist(),
    'outline': d, 'foldL': foldL, 'foldR': foldR, 'heartClip': heart,
    'points': {'apexL': apexL.round(2).tolist(), 'apexR': apexR.round(2).tolist(), 'tip': tip.round(2).tolist(),
               'foldTopL': list(map(float, cL[0])), 'foldTopR': list(map(float, cR[0]))},
    'box': [float(P[:, 0].min()), float(P[:, 1].min()), float(P[:, 0].max()), float(P[:, 1].max())],
}
json.dump(geo, open(sys.argv[2], 'w'), indent=1)
for (name, *_), f in zip(EDGES, fits):
    print(f'{name:>12}  angle {np.degrees(np.arctan2(f[1][1], f[1][0])):7.2f}')
