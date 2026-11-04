"""Alkyd-resin background texture in skeletal-formula style.

Each strand is an alkyd polyester backbone,
    ...-O-C(=O)-[ring]-C(=O)-O-CH2-CH(-O-C(=O)-fatty chain)-CH2-O-...
(phthalate rings and glycerol, joined by ester links), with oil fatty-acid side chains that carry
a C=C double bond. Strands run across the card at slight angles and past the edges, so the texture
wraps the whole card including the bleed. Output is plain SVG path data (pure vector).
"""
import math
import random

D30 = math.radians(30)


def _v(a):
    return math.cos(a), math.sin(a)


def _add(p, v, k=1.0):
    return p[0] + v[0] * k, p[1] + v[1] * k


def _unit(x, y):
    n = math.hypot(x, y) or 1
    return x / n, y / n


class Mol:
    def __init__(self, b):
        self.b = b
        self.single = []        # (p, q)
        self.inner = []         # second line of double bonds (already offset/shortened)
        self.labels = []        # (x, y, 'O')

    # bond between two points; `short_a` / `short_b` trim the ends next to an atom label
    def bond(self, p, q, order=1, side=None, short_a=0.0, short_b=0.0):
        dx, dy = _unit(q[0] - p[0], q[1] - p[1])
        p2 = (p[0] + dx * short_a, p[1] + dy * short_a)
        q2 = (q[0] - dx * short_b, q[1] - dy * short_b)
        self.single.append((p2, q2))
        if order == 2:
            nx, ny = -dy, dx
            if side is not None and (nx * side[0] + ny * side[1]) < 0:
                nx, ny = -nx, -ny
            off, cut = self.b * 0.2, self.b * 0.16
            a = (p2[0] + nx * off + dx * cut, p2[1] + ny * off + dy * cut)
            c = (q2[0] + nx * off - dx * cut, q2[1] + ny * off - dy * cut)
            if side is None:   # carbonyl: draw the pair centred on the bond line
                a = (p2[0] + nx * off, p2[1] + ny * off)
                c = (q2[0] + nx * off, q2[1] + ny * off)
            self.inner.append((a, c))

    def label(self, p, text='O'):
        self.labels.append((p[0], p[1], text))


def strand(m, start, axis, length, rng):
    """One alkyd strand running along `axis` (radians) for about `length` px."""
    b = m.b
    LS = b * 0.42                       # how far bonds stop short of an 'O' label
    pos, sign = start, 1
    atoms = []                           # (pos, kind)
    seq = ['CO', 'RING', 'CO', 'O', 'C', 'CHR', 'C', 'O']
    k = rng.randrange(len(seq))
    travelled = 0.0
    prev_kind = None
    while travelled < length:
        kind = seq[k % len(seq)]
        k += 1
        if kind == 'RING':
            # para-substituted benzene: enter at C1, leave at C4 along the same heading
            h = axis + sign * D30
            c1 = _add(pos, _v(h), b)             # the ring is bonded to the carbonyl carbon
            m.bond(pos, c1)
            centre = _add(c1, _v(h), b)
            verts = [_add(centre, _v(h + math.pi + i * math.pi / 3), b) for i in range(6)]
            for i in range(6):
                p, q = verts[i], verts[(i + 1) % 6]
                m.bond(p, q, 2 if i % 2 == 0 else 1, side=_unit(centre[0] - (p[0] + q[0]) / 2, centre[1] - (p[1] + q[1]) / 2))
            c4 = verts[3]
            nxt = _add(c4, _v(h), b)
            m.bond(c4, nxt)
            atoms.append((c1, 'C'))
            atoms.append((c4, 'C'))
            travelled += 4 * b * math.cos(h - axis)
            pos = nxt
            sign = -sign
            atoms.append((pos, 'CO'))
            k += 1                       # the atom after the ring (a carbonyl) is placed already
            prev_kind = 'CO'
            continue
        h = axis + sign * D30
        nxt = _add(pos, _v(h), b)
        m.bond(pos, nxt, short_a=LS if prev_kind == 'O' else 0, short_b=LS if kind == 'O' else 0)
        atoms.append((nxt, kind))
        if kind == 'O':
            m.label(nxt)
        pos, sign = nxt, -sign
        travelled += b * math.cos(D30)
        prev_kind = kind

    # substituents: carbonyl oxygens and the fatty-acid side chains
    for i in range(1, len(atoms) - 1):
        p, kind = atoms[i]
        if kind not in ('CO', 'CHR'):
            continue
        a, c = atoms[i - 1][0], atoms[i + 1][0]
        out = _unit((p[0] - a[0]) / b + (p[0] - c[0]) / b, (p[1] - a[1]) / b + (p[1] - c[1]) / b)
        if kind == 'CO':
            o = _add(p, out, b)
            m.bond(p, o, 2, short_b=LS)
            m.label(o)
        else:
            side_chain(m, p, math.atan2(out[1], out[0]), rng)


def side_chain(m, root, axis, rng):
    """-O-C(=O)-CH2-CH2-CH2-CH=CH-CH2-CH2 ... a short drawn piece of a drying-oil fatty acid."""
    b, LS = m.b, m.b * 0.42
    sign = 1
    o = _add(root, _v(axis + sign * D30), b)
    m.bond(root, o, short_b=LS)
    m.label(o)
    sign = -sign
    co = _add(o, _v(axis + sign * D30), b)
    m.bond(o, co, short_a=LS)
    sign = -sign
    # carbonyl oxygen on the ester carbon, pointing away from the chain
    nxt_dir = _v(axis + sign * D30)
    prev_dir = _unit(o[0] - co[0], o[1] - co[1])
    out = _unit(-(nxt_dir[0] + prev_dir[0]), -(nxt_dir[1] + prev_dir[1]))
    oo = _add(co, out, b)
    m.bond(co, oo, 2, short_b=LS)
    m.label(oo)
    pos = co
    n = rng.choice((5, 6, 7))
    dbl = rng.choice((2, 3))
    for j in range(n):
        h = axis + sign * D30
        nxt = _add(pos, _v(h), b)
        side = _v(axis + (math.pi / 2 if sign > 0 else -math.pi / 2))
        m.bond(pos, nxt, 2 if j == dbl else 1, side=side)
        pos, sign = nxt, -sign


def alkyd_texture(width, height, bleed=0, bond=17, rows=None, seed=7):
    """Returns dict(single=..., inner=..., labels=[(x, y, 'O')]) covering the canvas plus bleed."""
    rng = random.Random(seed)
    m = Mol(bond)
    x0, y0, x1, y1 = -bleed - 80, -bleed, width + bleed + 80, height + bleed
    rows = rows or [-40, 172, 388, 604]
    for i, y in enumerate(rows):
        ang = math.radians(rng.uniform(-7, 7))
        start = (x0 - rng.uniform(0, 60), y + rng.uniform(-14, 14))
        strand(m, start, ang, (x1 - x0) / math.cos(ang) + 120, rng)
    f = lambda v: ('%.1f' % v).rstrip('0').rstrip('.')
    single = ''.join(f'M{f(p[0])} {f(p[1])}L{f(q[0])} {f(q[1])}' for p, q in m.single)
    inner = ''.join(f'M{f(p[0])} {f(p[1])}L{f(q[0])} {f(q[1])}' for p, q in m.inner)
    return dict(single=single, inner=inner, labels=m.labels)
