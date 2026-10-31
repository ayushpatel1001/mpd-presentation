"""
Parametric model of the 1-tonne drop-bottom forklift bin with a TWO-INPUT
(dual-action) door release.

One geometry definition, two outputs:

  mode="fab"    full size, millimetres, real steel thicknesses  -> STEP + DXF + cut list
  mode="print"  1:8 scale, thicknesses floored to printable minimums,
                pins replaced by 1.75 mm filament, shafts made square so
                the keyed parts can be printed flat              -> STL

Coordinate system (fab):  X = 1200 mm length (front end +X, rear end -X)
                          Y = 1000 mm width  (+Y = operator / forklift side)
                          Z = up, Z=0 is the ground (underside of the closed doors)

Mechanism summary (see README for the full explanation):
  * Two bottom doors hinged on the long sides, free edges meeting on the centre line.
  * Each door carries a roller pin at both ends; a gravity-biased hook on a cross
    shaft at each end wall sits under the roller.  The load line passes 3 mm outboard
    of the hook pivot, so door weight drives the hook further SHUT (self-locking).
  * The two end shafts are tied to one central lever on the +Y side wall.
  * INPUT A  - pull cable A on the central lever  -> rotates both shafts, hooks swing out.
  * INPUT B  - pull cable B on the release lever  -> withdraws a spring-loaded shot bolt
               that otherwise pins the central lever.
  * Doors open only with A AND B.  Releasing both re-arms automatically: springs
    return the linkage to its stop, the shot bolt snaps back into the lever, and
    when the bin is set down on the ground the rollers cam the (free-pivoting)
    hooks aside and the hooks drop back under them.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import cadquery as cq

PRINT_SCALE = 1 / 8

# --------------------------------------------------------------------------------------
# Parameters (full size, mm)
# --------------------------------------------------------------------------------------
FAB = dict(
    # tub
    L=1200, W=1000, H=900, tw=3,
    # doors
    fh=50, tp=6, shs_t=5, gap=10, door_ext=15, door_cross_x=(-300, 0, 300),
    # hinges (3 per door)
    hinge_dy=22, hinge_dz=20, hinge_od=40, hinge_pin=20, hinge_xc=(-450, 0, 450),
    dk_half=40, tk_in=45, tk_out=125, tab_top=115, leaf_dy=35,
    # stiffening
    ang=50, ang_t=5, band_z=480, stiff_x=(-300, 300), stiff_y=(-330, 330),
    stiff_side_z0=130, stiff_end_z0=260, end_bar_h=50, end_bar_t=8,
    # fork pockets (top mounted, forks enter along Y)
    pk_w=150, pk_h=75, pk_t=5, pk_x=300, pk_len=1300, pk_g_t=10, pk_g_drop=150, pk_g_dx=50,
    # door latch pins / rollers
    pin_dx=70, pin_z=90, pin_d=25, roller_d=40, roller_len=40,
    lug_t=12, lug_y=40, lug_top=115, lug_x1=100,
    # end cross shafts + hooks
    shaft_d=40, shaft_in=3, shaft_dz=110, shaft_y0=-230,
    hook_t=12, hook_y=75, hub_r=40, arm_w=40, toe_h=22, toe_tip=20, toe_gap=1, arm_gap=3,
    lead_x=50, lead_dz=5,
    dog_t=12, dog_gap=2, dog_r=35, dog_w=30, dog_pin_d=16, dog_pin_dz=50,
    brg_t=12, brg_y=(-200, 0, 200, 420), brg_top=30, brg_reach=38,
    # side mechanism (+Y wall)
    mech_off=75, mgap=2, crank_t=12, crank_len=120, crank_tail=70, crank_w=50, crank_hub=35,
    link_t=10, link_w=50, link_pin=20,
    lev_t=12, lev_z=350, lev_link_r=100, lev_handle=290, lev_lobe=110, lev_w=60, lev_hub=40,
    lev_pin=30, post_hw=20,
    spring_x=440, spring_z=225, anchor_hw=10, anchor_top=240, spring_hole=12,
    # input-B shot bolt
    bolt_d=25, bolt_len=60, bolt_tip=8, bolt_travel=30, bolt_hw=30, cross_d=8, cross_back=40,
    rl_t=12, rl_w=36, rl_piv_dz=50, rl_top_dz=105, rl_piv_dy=-7, rlb_t=12,
    # misc
    eye_x=(-150, 150), eye_t=12, chain_t=12,
    clr=1.0,           # clearance added to pin holes
    plate_min=0, sheet_min=0, gap_min=0,
)

# keys grouped for the printable floors
_PLATES = ["lug_t", "hook_t", "dog_t", "brg_t", "crank_t", "link_t", "lev_t", "rl_t", "rlb_t",
           "eye_t", "chain_t", "pk_g_t"]
_SHEETS = ["tw", "shs_t", "ang_t", "pk_t", "end_bar_t"]
_GAPS = ["mgap", "dog_gap", "arm_gap", "toe_gap", "gap"]
_PINS = ["hinge_pin", "link_pin", "lev_pin", "pin_d", "spring_hole"]


class P(dict):
    __getattr__ = dict.__getitem__


def params(mode: str = "fab") -> P:
    p = P(FAB)
    p["mode"] = mode
    p["door_solid"] = False
    p["square_shaft"] = False
    if mode == "fab":
        return p
    s = PRINT_SCALE
    q = P()
    for k, v in FAB.items():
        if isinstance(v, (int, float)):
            q[k] = v * s
        elif isinstance(v, tuple):
            q[k] = tuple(x * s for x in v)
        else:
            q[k] = v
    q["mode"] = mode
    for k in _PLATES:
        q[k] = max(q[k], 2.4)
    for k in _SHEETS:
        q[k] = max(q[k], 1.2)
    q["tw"] = max(q["tw"], 1.6)
    for k in _GAPS:
        q[k] = max(q[k], 0.4)
    q["arm_gap"] = max(q["arm_gap"], 0.6)
    # all pivots become 1.75 mm filament pins, holes 2.0 mm
    for k in _PINS:
        q[k] = 1.75
    q["clr"] = 0.25
    q["spring_hole"] = 1.75     # rubber-band / spring anchor holes
    q["dog_pin_d"] = 2.4        # printed integral with the dog plate
    q["bolt_d"] = 4.0
    q["cross_d"] = 1.75
    q["shaft_d"] = 4.0          # 4 mm SQUARE printed shaft
    q["square_shaft"] = True
    q["door_solid"] = True
    q["hinge_od"] = max(q["hinge_od"], 5.0)
    q["bolt_travel"] = max(q["bolt_travel"], 4.0)
    q["bolt_tip"] = max(q["bolt_tip"], 1.2)
    q["bolt_len"] = 8.5
    q["shaft_in"] = 1.0         # bigger self-locking offset at model scale (friction is relatively higher)
    q["roller_len"] = q["roller_len"]
    return q


# --------------------------------------------------------------------------------------
# Derived positions
# --------------------------------------------------------------------------------------
def derive(p: P) -> P:
    d = P()
    d.X = p.L / 2                      # end wall outer face
    d.Y = p.W / 2                      # side wall outer face
    d.z0 = p.fh + p.tp                 # floor level / tub bottom edge
    d.hy = d.Y + p.hinge_dy            # hinge axis (for +Y door)
    d.hz = d.z0 + p.hinge_dz
    d.px = d.X + p.pin_dx              # roller pin centre (front end)
    d.pz = p.pin_z
    d.sx = d.px - p.shaft_in           # end cross-shaft centre
    d.sz = d.pz + p.shaft_dz
    d.rr = p.roller_d / 2
    # hook plane / dog plane (Y centres, +Y door side)
    d.hook_y = p.hook_y
    d.dog_y = p.hook_y + p.hook_t / 2 + p.dog_gap + p.dog_t / 2
    # roller occupies hook plane +- roller_len/2
    d.roll_y0 = p.hook_y - p.roller_len / 2
    d.roll_y1 = p.hook_y + p.roller_len / 2
    # side mechanism planes
    d.my0 = d.Y + p.mech_off
    d.my1 = d.my0 + p.crank_t          # crank + lever plane
    d.ly0 = d.my1 + p.mgap             # link plane
    d.ly1 = d.ly0 + p.link_t
    d.shaft_y1 = d.my1 + p.mgap
    d.crank_top = (d.sx, d.sz + p.crank_len)
    d.crank_tail = (d.sx, d.sz - p.crank_tail)
    d.lev = (0.0, p.lev_z)
    d.lev_up = (0.0, p.lev_z + p.lev_link_r)
    d.lev_dn = (0.0, p.lev_z - p.lev_link_r)
    d.lev_eye = (0.0, p.lev_z + p.lev_handle - p.lev_w / 2)
    d.lobe = (p.lev_lobe, p.lev_z)
    # shot bolt (input B)
    d.bolt_tip_y = d.my1 + p.bolt_tip
    d.bolt_y0 = d.bolt_tip_y - p.bolt_len
    d.cross_y = d.bolt_tip_y - p.cross_back
    d.rl_x0 = p.lev_lobe + p.bolt_hw + p.mgap + (1 if p.mode == "fab" else 0)
    d.rl_x1 = d.rl_x0 + p.rl_t
    d.rl_piv = (d.cross_y + p.rl_piv_dy, p.lev_z + p.rl_piv_dz)
    d.rl_eye = (d.cross_y + p.rl_piv_dy, p.lev_z + p.rl_top_dz)
    return d


# --------------------------------------------------------------------------------------
# Geometry helpers
# --------------------------------------------------------------------------------------
def box(x0, x1, y0, y1, z0, z1) -> cq.Workplane:
    return cq.Workplane("XY").box(x1 - x0, y1 - y0, z1 - z0, centered=False).translate((x0, y0, z0))


def plane_xz(y1):   # local (u,v) = (x,z); extrude goes toward -Y
    return cq.Plane(origin=(0, y1, 0), xDir=(1, 0, 0), normal=(0, -1, 0))


def plane_yz(x0):   # local (u,v) = (y,z); extrude goes toward +X
    return cq.Plane(origin=(x0, 0, 0), xDir=(0, 1, 0), normal=(1, 0, 0))


def plate_xz(sk: cq.Sketch, y0, y1) -> cq.Workplane:
    return cq.Workplane(plane_xz(y1)).placeSketch(sk).extrude(y1 - y0)


def plate_yz(sk: cq.Sketch, x0, x1) -> cq.Workplane:
    return cq.Workplane(plane_yz(x0)).placeSketch(sk).extrude(x1 - x0)


def plate_xy(sk: cq.Sketch, t) -> cq.Workplane:
    return cq.Workplane("XY").placeSketch(sk).extrude(t)


def cyl_y(x, z, r, y0, y1) -> cq.Workplane:
    return cq.Workplane(plane_xz(y1)).center(x, z).circle(r).extrude(y1 - y0)


def cyl_x(y, z, r, x0, x1) -> cq.Workplane:
    return cq.Workplane(plane_yz(x0)).center(y, z).circle(r).extrude(x1 - x0)


class Prof:
    """2-D profile = union of shapes minus holes; becomes a cq.Sketch (true arcs, DXF ready)."""

    def __init__(self):
        self.add, self.sub = [], []

    def circle(self, c, r, hole=False):
        (self.sub if hole else self.add).append(("c", c, r)); return self

    def poly(self, pts, hole=False):
        (self.sub if hole else self.add).append(("p", list(pts))); return self

    def cap(self, a, b, w, hole=False):
        (self.sub if hole else self.add).append(("k", a, b, w)); return self

    def square(self, c, a, hole=True):
        (self.sub if hole else self.add).append(("s", c, a)); return self

    @staticmethod
    def _emit(sk, item, mode):
        kind = item[0]
        if kind == "c":
            _, c, r = item
            return sk.push([c]).circle(r, mode=mode).reset()
        if kind == "p":
            pts = item[1]
            return sk.polygon(pts + [pts[0]], mode=mode).reset()
        if kind == "s":
            _, c, a = item
            return sk.push([c]).rect(a, a, mode=mode).reset()
        _, a, b, w = item
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy)
        ang = math.degrees(math.atan2(dy, dx))
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        sk = sk.push([mid]).rect(ln, w, angle=ang, mode=mode).reset()
        if mode == "s":
            return sk.push([a, b]).circle(w / 2, mode=mode).reset()
        return sk.push([a]).circle(w / 2, mode=mode).reset().push([b]).circle(w / 2, mode=mode).reset()

    def sketch(self) -> cq.Sketch:
        sk = cq.Sketch()
        for it in self.add:
            sk = self._emit(sk, it, "a")
        sk = sk.clean()
        for it in self.sub:
            sk = self._emit(sk, it, "s")
        return sk.clean()


def bore(p, prof, c, pin_d):
    """Round clearance hole for a pin of diameter pin_d."""
    prof.circle(c, (pin_d + p.clr) / 2, hole=True)


def shaft_hole(p, prof, c, keyed: bool):
    """Hole for the end cross-shaft. keyed=True: part is fixed to the shaft."""
    if p.square_shaft:
        if keyed:
            prof.square(c, p.shaft_d + 0.2)
        else:
            prof.circle(c, (p.shaft_d * math.sqrt(2) + 0.35) / 2, hole=True)
    else:
        prof.circle(c, (p.shaft_d + (0.0 if keyed else 2.0)) / 2, hole=True)


# --------------------------------------------------------------------------------------
# 2-D profiles (front end, +Y door; all in the local plane of the plate)
# --------------------------------------------------------------------------------------
def prof_hook(p, d) -> Prof:
    """Gravity-biased hook, free on the shaft. Profile in XZ."""
    sx, sz, px, pz, rr = d.sx, d.sz, d.px, d.pz, d.rr
    ax0 = px + rr + p.arm_gap
    ax1 = ax0 + p.arm_w
    zt = pz - rr - p.toe_gap
    zb = zt - p.toe_h
    tip = px - p.toe_tip
    lead_end = tip + p.lead_x
    pr = Prof()
    pr.poly([(tip, zt), (ax0, zt), (ax0, sz), (ax1, sz), (ax1, zb), (lead_end, zb),
             (tip, zt - p.lead_dz)])
    pr.circle((sx, sz), p.hub_r)
    pr.circle(((ax0 + ax1) / 2, sz), p.arm_w / 2)
    pr.poly([(sx, sz - p.hub_r * 0.8), (ax0 + 1e-3, sz - p.hub_r * 0.8 - (ax0 - sx) * 0.3),
             (ax0 + 1e-3, sz), (sx, sz)])
    shaft_hole(p, pr, (sx, sz), keyed=False)
    pr.circle(((ax0 + ax1) / 2, sz), p.spring_hole / 2 + p.clr / 2, hole=True)   # return-spring eye
    return pr


def dog_pin_pos(p, d):
    ax0 = d.px + d.rr + p.arm_gap
    return (ax0 - p.dog_pin_d / 2, d.sz - p.dog_pin_dz)


def prof_dog(p, d) -> Prof:
    """Drive dog: keyed to the shaft, its pin pushes the hook arm open (one-way)."""
    pc = dog_pin_pos(p, d)
    pr = Prof()
    pr.circle((d.sx, d.sz), p.dog_r)
    pr.cap((d.sx, d.sz), pc, p.dog_w)
    shaft_hole(p, pr, (d.sx, d.sz), keyed=True)
    if p.mode == "fab":
        pr.circle(pc, p.dog_pin_d / 2, hole=True)    # pin pressed / welded in
    return pr


def prof_crank(p, d) -> Prof:
    pr = Prof()
    pr.circle((d.sx, d.sz), p.crank_hub)
    pr.cap((d.sx, d.sz), d.crank_top, p.crank_w)
    pr.cap((d.sx, d.sz), d.crank_tail, p.crank_w * 0.8)
    shaft_hole(p, pr, (d.sx, d.sz), keyed=True)
    bore(p, pr, d.crank_top, p.link_pin)
    pr.circle(d.crank_tail, (p.spring_hole + p.clr) / 2, hole=True)
    return pr


def prof_lever(p, d) -> Prof:
    """Central lever (input A). Profile in XZ."""
    top = (0.0, p.lev_z + p.lev_handle - p.lev_w / 2)
    pr = Prof()
    pr.circle(d.lev, p.lev_hub)
    pr.cap(d.lev, top, p.lev_w)
    pr.cap(d.lev, d.lev_dn, p.lev_w)
    pr.cap(d.lev, d.lobe, p.lev_w)
    bore(p, pr, d.lev, p.lev_pin)
    bore(p, pr, d.lev_up, p.link_pin)
    bore(p, pr, d.lev_dn, p.link_pin)
    bore(p, pr, top, p.link_pin)                       # cable-A eye
    pr.circle(d.lobe, (p.bolt_d + 2 * p.clr) / 2, hole=True)   # shot-bolt hole (input B)
    return pr


def link_len(d, front=True):
    a = d.crank_top if front else (-d.crank_top[0], d.crank_top[1])
    b = d.lev_up if front else d.lev_dn
    return math.dist(a, b)


def prof_link(p, d) -> Prof:
    """Straight link, drawn along +X from the origin (placed later)."""
    ln = link_len(d, True)
    pr = Prof()
    pr.cap((0, 0), (ln, 0), p.link_w)
    bore(p, pr, (0, 0), p.link_pin)
    bore(p, pr, (ln, 0), p.link_pin)
    return pr


def prof_link_rear(p, d) -> Prof:
    ln = link_len(d, False)
    pr = Prof()
    pr.cap((0, 0), (ln, 0), p.link_w)
    bore(p, pr, (0, 0), p.link_pin)
    bore(p, pr, (ln, 0), p.link_pin)
    return pr


def prof_release_lever(p, d) -> Prof:
    """Input-B release lever, profile in YZ. Lower fork slot drives the bolt cross-pin."""
    piv, eye = d.rl_piv, d.rl_eye
    fork = (d.cross_y, p.lev_z)
    pr = Prof()
    pr.cap(fork, eye, p.rl_w)
    pr.circle(piv, p.rl_w / 2)
    bore(p, pr, piv, p.cross_d if p.mode != "fab" else 16)
    bore(p, pr, eye, p.cross_d if p.mode != "fab" else 16)
    # slot for the cross pin, along the lever axis
    ux, uz = fork[0] - piv[0], fork[1] - piv[1]
    n = math.hypot(ux, uz)
    ux, uz = ux / n, uz / n
    w = p.cross_d + 2 * p.clr
    a = (fork[0] - ux * w * 0.6, fork[1] - uz * w * 0.6)
    b = (fork[0] + ux * w * 0.6, fork[1] + uz * w * 0.6)
    pr.cap(a, b, w, hole=True)
    return pr


def prof_lug(p, d) -> Prof:
    """Door end lug carrying the roller pin. Profile in XZ."""
    X = d.X
    pr = Prof()
    xs = X + p.door_ext
    pr.poly([(X, 0), (X + p.lug_x1, 0), (X + p.lug_x1, p.lug_top), (xs, p.lug_top),
             (xs, d.z0), (X, d.z0)])
    bore(p, pr, (d.px, d.pz), p.pin_d)
    return pr


def prof_bearing(p, d) -> Prof:
    """End-wall bearing gusset for the cross shaft. Profile in XZ (45 deg underside)."""
    X = d.X
    xr = d.sx + p.brg_reach
    top = d.sz + p.brg_top
    bot_out = d.sz - p.brg_top
    pr = Prof()
    pr.poly([(X, top), (xr, top), (xr, bot_out), (X, bot_out - (xr - X))])
    shaft_hole(p, pr, (d.sx, d.sz), keyed=False)
    return pr


# --------------------------------------------------------------------------------------
# Kinematics: lever angle phi (CCW, rad) -> crank angles
# --------------------------------------------------------------------------------------
def rot(c, pt, a):
    x, z = pt[0] - c[0], pt[1] - c[1]
    return (c[0] + x * math.cos(a) - z * math.sin(a), c[1] + x * math.sin(a) + z * math.cos(a))


def solve_cranks(p, d, phi):
    up = rot(d.lev, d.lev_up, phi)
    dn = rot(d.lev, d.lev_dn, phi)
    Lf, Lr = link_len(d, True), link_len(d, False)
    S_f = (d.sx, d.sz)
    S_r = (-d.sx, d.sz)
    top_f = d.crank_top
    top_r = (-d.crank_top[0], d.crank_top[1])

    def bis(f, lo, hi):
        flo = f(lo)
        if abs(flo) < 1e-9:
            return lo
        for _ in range(80):
            mid = (lo + hi) / 2
            if (f(mid) > 0) == (flo > 0):
                lo, flo = mid, f(mid)
            else:
                hi = mid
        return (lo + hi) / 2

    th_f = bis(lambda t: math.dist(rot(S_f, top_f, t), up) - Lf, 0.0, 1.2)
    th_r = bis(lambda t: math.dist(rot(S_r, top_r, t), dn) - Lr, 0.0, -1.2)
    return th_f, th_r, up, dn


def phi_for_hook(p, d, hook_deg):
    target = math.radians(hook_deg)
    lo, hi = 0.0, 1.2
    for _ in range(60):
        mid = (lo + hi) / 2
        if solve_cranks(p, d, mid)[0] < target:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


# --------------------------------------------------------------------------------------
# Parts
# --------------------------------------------------------------------------------------
@dataclass
class Part:
    name: str
    shape: cq.Workplane
    color: str
    group: str            # tub | door | inputA | inputB | latch | hw
    note: str = ""


def angle_x(p, x0, x1, y_face, z_top, sign):
    """Horizontal angle along X on a wall whose outer face is at y=y_face; leg outward in sign*Y.
    Toe-up (horizontal leg at the top). In print mode the leg is supported by a 45 deg chamfer."""
    a, t = p.ang, p.ang_t
    if p.mode == "fab":
        pts = [(0, -a), (t, -a), (t, -t), (a, -t), (a, 0), (0, 0)]
    else:
        pts = [(0, -a), (t, -a), (a, -t), (a, 0), (0, 0)]
    pts = [(y_face + sign * u, z_top + v) for u, v in pts]
    if sign < 0:
        pts = pts[::-1]
    return plate_yz(Prof().poly(pts).sketch(), x0, x1)


def angle_y(p, y0, y1, x_face, z_top, sign):
    a, t = p.ang, p.ang_t
    if p.mode == "fab":
        pts = [(0, -a), (t, -a), (t, -t), (a, -t), (a, 0), (0, 0)]
    else:
        pts = [(0, -a), (t, -a), (a, -t), (a, 0), (0, 0)]
    pts = [(x_face + sign * u, z_top + v) for u, v in pts]
    if sign < 0:
        pts = pts[::-1]
    return plate_xz(Prof().poly(pts).sketch(), y0, y1)


def vert_angle(p, x0, x1, y0, y1, z0, z1):
    """Two boxes forming a vertical angle (already positioned by caller)."""
    return box(x0, x1, y0, y1, z0, z1)


def wedge_y(p, x0, x1, y_wall, y_out, z_top, depth):
    """Bracket block standing off the +Y wall, with a 45 deg underside (YZ profile)."""
    pts = [(y_wall, z_top), (y_out, z_top), (y_out, z_top - depth),
           (y_wall, z_top - depth - (y_out - y_wall))]
    return plate_yz(Prof().poly(pts).sketch(), x0, x1)


def build_tub(p, d) -> cq.Workplane:
    X, Y, z0, H, tw = d.X, d.Y, d.z0, p.H, p.tw
    tub = box(-X, X, -Y, Y, z0, H).cut(box(-X + tw, X - tw, -Y + tw, Y - tw, z0, H + 1))
    a, t = p.ang, p.ang_t
    # top rim + mid band, all four sides
    for zt in (H, p.band_z + a):
        tub = tub.union(angle_x(p, -X - a, X + a, Y, zt, +1))
        tub = tub.union(angle_x(p, -X - a, X + a, -Y, zt, -1))
        tub = tub.union(angle_y(p, -Y, Y, X, zt, +1))
        tub = tub.union(angle_y(p, -Y, Y, -X, zt, -1))
    # vertical stiffeners: side walls
    zr = H - a
    for xs in p.stiff_x:
        for sg in (1, -1):
            yf = sg * Y
            y_out = yf + sg * a
            tub = tub.union(box(xs - a / 2, xs + a / 2, min(yf, yf + sg * t), max(yf, yf + sg * t), p.stiff_side_z0, zr))
            tub = tub.union(box(xs - a / 2, xs - a / 2 + t, min(yf, y_out), max(yf, y_out), p.stiff_side_z0, zr))
    # vertical stiffeners: end walls (start above the cross shafts)
    for ys in p.stiff_y:
        for sg in (1, -1):
            xf = sg * X
            x_out = xf + sg * a
            tub = tub.union(box(min(xf, xf + sg * t), max(xf, xf + sg * t), ys - a / 2, ys + a / 2, p.stiff_end_z0, zr))
            tub = tub.union(box(min(xf, x_out), max(xf, x_out), ys - a / 2, ys - a / 2 + t, p.stiff_end_z0, zr))
    # corner angles
    for sx_ in (1, -1):
        for sy_ in (1, -1):
            xf, yf = sx_ * X, sy_ * Y
            tub = tub.union(box(min(xf, xf + sx_ * t), max(xf, xf + sx_ * t),
                                min(yf - sy_ * a, yf + sy_ * t), max(yf - sy_ * a, yf + sy_ * t), p.stiff_side_z0, zr))
            tub = tub.union(box(min(xf - sx_ * a, xf + sx_ * t), max(xf - sx_ * a, xf + sx_ * t),
                                min(yf, yf + sy_ * t), max(yf, yf + sy_ * t), p.stiff_side_z0, zr))
    # end-wall bottom flat bars (door seal edge)
    for sg in (1, -1):
        xf = sg * X
        tub = tub.union(box(min(xf, xf + sg * p.end_bar_t), max(xf, xf + sg * p.end_bar_t), -Y, Y, z0, z0 + p.end_bar_h))
    # fork pockets (RHS) + end gussets
    for xc in (-p.pk_x, p.pk_x):
        outer = box(xc - p.pk_w / 2, xc + p.pk_w / 2, -p.pk_len / 2, p.pk_len / 2, H, H + p.pk_h)
        inner = box(xc - p.pk_w / 2 + p.pk_t, xc + p.pk_w / 2 - p.pk_t, -p.pk_len / 2 - 1, p.pk_len / 2 + 1,
                    H + p.pk_t, H + p.pk_h - p.pk_t)
        tub = tub.union(outer.cut(inner))
        for gx in (xc - p.pk_g_dx, xc + p.pk_g_dx):
            for sg in (1, -1):
                yo = sg * p.pk_len / 2
                pts = [(sg * Y, H), (yo, H), (sg * Y, H - p.pk_g_drop)]
                if sg < 0:
                    pts = pts[::-1]
                tub = tub.union(plate_yz(Prof().poly(pts).sketch(), gx - p.pk_g_t / 2, gx + p.pk_g_t / 2))
    # hinge knuckles (tub side) with weld tabs
    r = p.hinge_od / 2
    for sg in (1, -1):
        hy = sg * d.hy
        for xc in p.hinge_xc:
            for (k0, k1) in ((xc - p.tk_out, xc - p.tk_in), (xc + p.tk_in, xc + p.tk_out)):
                kn = cyl_x(hy, d.hz, r, k0, k1).cut(cyl_x(hy, d.hz, (p.hinge_pin + p.clr) / 2, k0 - 1, k1 + 1))
                tab = box(k0, k1, min(sg * Y, hy), max(sg * Y, hy), z0, p.tab_top)
                tab = tab.cut(cyl_x(hy, d.hz, r - 0.01, k0 - 1, k1 + 1))
                tub = tub.union(kn).union(tab)
    # end-shaft bearing gussets (both ends)
    for sg in (1, -1):
        for yb in p.brg_y:
            g = plate_xz(prof_bearing(p, d).sketch(), yb - p.brg_t / 2, yb + p.brg_t / 2)
            if sg < 0:
                g = g.mirror("YZ")
            tub = tub.union(g)
    # ---- +Y side mechanism mounts ----
    gapy = d.my0 - p.mgap
    # central lever pivot post
    post = wedge_y(p, -p.post_hw, p.post_hw, Y, gapy, p.lev_z + p.post_hw * 1.25, p.post_hw * 2.5)
    post = post.cut(cyl_y(0, p.lev_z, (p.lev_pin + p.clr) / 2, Y - 1, gapy + 1))
    tub = tub.union(post)
    # shot-bolt housing (input B) with lever rest stop beneath
    lx, lz = d.lobe
    hw = p.bolt_hw
    housing = box(lx - hw, lx + hw, Y, gapy, lz - hw, lz + hw)
    housing = housing.cut(cyl_y(lx, lz, (p.bolt_d + p.clr) / 2, Y + p.tw * 0, gapy + 1))
    # slot through the housing along X for the cross pin
    slot_y0 = d.cross_y - p.bolt_travel - p.cross_d
    slot_y1 = d.cross_y + p.cross_d
    housing = housing.cut(box(lx - hw - 1, lx + hw + 1, slot_y0, slot_y1, lz - p.cross_d / 2 - p.clr, lz + p.cross_d / 2 + p.clr))
    stop_top = lz - p.lev_w / 2
    stop = wedge_y(p, lx - hw * 0.66, lx + hw * 0.66, Y, d.my1, stop_top, hw * 0.66)
    under = wedge_y(p, lx - hw, lx + hw, Y, gapy, lz - hw, 0.01)
    tub = tub.union(housing).union(stop).union(under)
    # release-lever pivot bracket
    bx0 = d.rl_x1 + p.mgap + (3 if p.mode == "fab" else 0.6)
    piv_y, piv_z = d.rl_piv
    br = wedge_y(p, bx0, bx0 + p.rlb_t, Y, piv_y + p.rl_w / 2, piv_z + p.rl_w / 2, p.rl_w)
    br = br.cut(cyl_x(piv_y, piv_z, (p.cross_d + p.clr) / 2 if p.mode != "fab" else 8.5, bx0 - 1, bx0 + p.rlb_t + 1))
    tub = tub.union(br)
    # return-spring anchors
    for sg in (1, -1):
        ax = sg * p.spring_x
        an = wedge_y(p, ax - p.anchor_hw, ax + p.anchor_hw, Y, d.my1 - p.mgap, p.anchor_top, p.anchor_hw * 3)
        an = an.cut(cyl_y(ax, p.spring_z, (p.spring_hole + p.clr) / 2, Y, d.my1 + 1))
        tub = tub.union(an)
    # cable guide eyes + safety-chain lug on the top rim (+Y)
    for ex in p.eye_x:
        e = plate_xz(Prof().cap((ex - p.ang * 0.4, H + p.ang * 0.2), (ex + p.ang * 0.4, H + p.ang * 0.2), p.ang * 0.8)
                     .circle((ex, H + p.ang * 0.4), p.ang * 0.2, hole=True).sketch(),
                     Y + p.ang * 0.6 - p.eye_t / 2, Y + p.ang * 0.6 + p.eye_t / 2)
        tub = tub.union(e.intersect(box(-X, X, -Y, Y + p.ang * 2, H, H + p.ang * 2)))
    cl = plate_xz(Prof().poly([(-p.ang * 0.8, H), (p.ang * 0.8, H), (p.ang * 0.8, H + p.ang * 0.8),
                               (0, H + p.ang * 1.2), (-p.ang * 0.8, H + p.ang * 0.8)])
                  .circle((0, H + p.ang * 0.7), p.pin_d / 2 + p.clr, hole=True).sketch(),
                  Y + p.ang * 0.4 - p.chain_t / 2, Y + p.ang * 0.4 + p.chain_t / 2)
    tub = tub.union(cl)
    return tub


def build_door(p, d) -> cq.Workplane:
    """+Y door, closed position."""
    X, Y = d.X + p.door_ext, d.Y
    y0 = p.gap / 2
    if p.door_solid:
        door = box(-X, X, y0, Y, 0, d.z0)
    else:
        s, t = p.shs_t * 10, p.shs_t
        fh = p.fh
        door = box(-X, X, y0, Y, fh, d.z0)   # plate

        def shs(x0, x1, ya, yb):
            o = box(x0, x1, ya, yb, 0, fh)
            if x1 - x0 > yb - ya:
                i = box(x0 - 1, x1 + 1, ya + t, yb - t, t, fh - t)
            else:
                i = box(x0 + t, x1 - t, ya - 1, yb + 1, t, fh - t)
            return o.cut(i)
        door = door.union(shs(-X, X, y0, y0 + s)).union(shs(-X, X, Y - s, Y))
        for xe in (-X, X - s):
            door = door.union(shs(xe, xe + s, y0 + s, Y - s))
        for xc in p.door_cross_x:
            door = door.union(shs(xc - s / 2, xc + s / 2, y0 + s, Y - s))
    # hinge leaves + knuckles
    r = p.hinge_od / 2
    for xc in p.hinge_xc:
        k0, k1 = xc - p.dk_half, xc + p.dk_half
        leaf = box(k0, k1, Y - (5 if p.mode == "fab" else 0.6), d.hy + p.leaf_dy - r + 2, 0, d.z0)
        leaf = leaf.union(box(k0, k1, Y + p.mgap * 0.5, d.hy + p.leaf_dy - r + 2, d.z0 - 0.01, d.hz))
        kn = cyl_x(d.hy, d.hz, r, k0, k1)
        door = door.union(leaf).union(kn)
        door = door.cut(cyl_x(d.hy, d.hz, (p.hinge_pin + p.clr) / 2, k0 - 1, k1 + 1))
    # latch lugs (both ends)
    for sg in (1, -1):
        lug = plate_xz(prof_lug(p, d).sketch(), p.lug_y - p.lug_t / 2, p.lug_y + p.lug_t / 2)
        if sg < 0:
            lug = lug.mirror("YZ")
        door = door.union(lug)
    return door


def build_rollers(p, d):
    """Roller pins (fab: pin + roller sleeve; print: roller only, filament axle)."""
    out = []
    for sx_ in (1, -1):
        x = sx_ * d.px
        roller = cyl_y(x, d.pz, d.rr, d.roll_y0, d.roll_y1)
        roller = roller.cut(cyl_y(x, d.pz, (p.pin_d + p.clr) / 2, d.roll_y0 - 1, d.roll_y1 + 1))
        out.append(roller)
    return out


def build_pins(p, d):
    """Roller pins through the lugs (only meaningful in fab)."""
    out = []
    for sx_ in (1, -1):
        x = sx_ * d.px
        out.append(cyl_y(x, d.pz, p.pin_d / 2, p.lug_y - p.lug_t / 2 - 5, d.roll_y1 + 8))
    return out


def build_end_latch(p, d, theta_shaft=0.0, theta_hook=None):
    """Front-end latch set (shaft, 2 dogs, 2 hooks, crank). Rotations about the shaft (CCW +)."""
    if theta_hook is None:
        theta_hook = theta_shaft
    S = (d.sx, d.sz)
    parts = {}
    if p.square_shaft:
        a = p.shaft_d
        sh = box(d.sx - a / 2, d.sx + a / 2, p.shaft_y0, d.shaft_y1 + 1, d.sz - a / 2, d.sz + a / 2)
    else:
        sh = cyl_y(d.sx, d.sz, p.shaft_d / 2, p.shaft_y0, d.shaft_y1 + 1)
    parts["shaft"] = sh
    hooks = []
    dogs = []
    for sg in (1, -1):
        hk = plate_xz(prof_hook(p, d).sketch(), d.hook_y - p.hook_t / 2, d.hook_y + p.hook_t / 2)
        dg = plate_xz(prof_dog(p, d).sketch(), d.dog_y - p.dog_t / 2, d.dog_y + p.dog_t / 2)
        pc = dog_pin_pos(p, d)
        pin = cyl_y(pc[0], pc[1], p.dog_pin_d / 2, d.hook_y - p.hook_t / 2, d.dog_y + p.dog_t / 2)
        dg = dg.union(pin)
        if sg < 0:
            hk, dg = hk.mirror("XZ"), dg.mirror("XZ")
        hooks.append(hk)
        dogs.append(dg)
    crank = plate_xz(prof_crank(p, d).sketch(), d.my0, d.my1)
    axis0, axis1 = (d.sx, 0, d.sz), (d.sx, 1, d.sz)
    # rotation about +Y: CadQuery positive = right-hand about +Y = moves +Z toward +X? we want CCW in (x,z) view
    # In our (x,z) convention CCW (z up, x right) == rotation about -Y.
    deg_s = -math.degrees(theta_shaft)
    deg_h = -math.degrees(theta_hook)
    parts["shaft"] = parts["shaft"].rotate(axis0, axis1, deg_s)
    parts["hooks"] = [h.rotate(axis0, axis1, deg_h) for h in hooks]
    parts["dogs"] = [g.rotate(axis0, axis1, deg_s) for g in dogs]
    parts["crank"] = crank.rotate(axis0, axis1, deg_s)
    return parts


def place_link(p, d, prof, a, b):
    """Place a link profile (drawn from origin along +X) between points a and b in XZ."""
    sk = prof.sketch()
    wp = plate_xz(sk, d.ly0, d.ly1)
    ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
    wp = wp.rotate((0, 0, 0), (0, 1, 0), -ang).translate((a[0], 0, a[1]))
    return wp


def build_assembly(mode="fab", state="closed", door_deg=75.0, hook_deg=25.0):
    """state: closed | released (A+B pulled, doors open) | blocked (A pulled, B not: nothing moves)"""
    p = params(mode)
    d = derive(p)
    parts: list[Part] = []
    released = state == "released"
    phi = phi_for_hook(p, d, hook_deg) if released else 0.0
    th_f, th_r, up, dn = solve_cranks(p, d, phi)

    parts.append(Part("tub", build_tub(p, d), "#7b3fa0", "tub"))

    door = build_door(p, d)
    rollers = build_rollers(p, d)
    pins = build_pins(p, d) if mode == "fab" else []
    ang = door_deg if released else 0.0
    ax0, ax1 = (0, d.hy, d.hz), (1, d.hy, d.hz)
    dA = door
    rA = rollers
    pA = pins
    if ang:
        dA = door.rotate(ax0, ax1, ang)
        rA = [r.rotate(ax0, ax1, ang) for r in rollers]
        pA = [q.rotate(ax0, ax1, ang) for q in pins]
    dB = door.mirror("XZ")
    rB = [r.mirror("XZ") for r in rollers]
    pB = [q.mirror("XZ") for q in pins]
    if ang:
        bx0, bx1 = (0, -d.hy, d.hz), (1, -d.hy, d.hz)
        dB = dB.rotate(bx0, bx1, -ang)
        rB = [r.rotate(bx0, bx1, -ang) for r in rB]
        pB = [q.rotate(bx0, bx1, -ang) for q in pB]
    parts.append(Part("door_+Y", dA, "#3a3f44", "door"))
    parts.append(Part("door_-Y", dB, "#3a3f44", "door"))
    for i, r in enumerate(rA + rB):
        parts.append(Part(f"roller_{i}", r, "#c9ced6", "latch"))
    for i, q in enumerate(pA + pB):
        parts.append(Part(f"roller_pin_{i}", q, "#9aa0a8", "latch"))

    # hinge pins
    if mode == "fab":
        for sg in (1, -1):
            for xc in p.hinge_xc:
                parts.append(Part(f"hinge_pin_{'p' if sg > 0 else 'n'}{xc}",
                                  cyl_x(sg * d.hy, d.hz, p.hinge_pin / 2, xc - p.tk_out - 5, xc + p.tk_out + 5),
                                  "#9aa0a8", "hw"))

    # front latch (+X) and rear latch (-X, mirrored)
    front = build_end_latch(p, d, th_f)
    rear = build_end_latch(p, d, -th_r)     # build as a front set, then mirror

    def add_set(s, tag, mirror):
        def m(w):
            return w.mirror("YZ") if mirror else w
        parts.append(Part(f"shaft_{tag}", m(s["shaft"]), "#9aa0a8", "inputA"))
        for i, h in enumerate(s["hooks"]):
            parts.append(Part(f"hook_{tag}{i}", m(h), "#f28c28", "latch"))
        for i, g in enumerate(s["dogs"]):
            parts.append(Part(f"dog_{tag}{i}", m(g), "#f2b028", "inputA"))
        parts.append(Part(f"crank_{tag}", m(s["crank"]), "#f2b028", "inputA"))
    add_set(front, "front", False)
    add_set(rear, "rear", True)

    # central lever
    lev = plate_xz(prof_lever(p, d).sketch(), d.my0, d.my1)
    lev = lev.rotate((0, 0, p.lev_z), (0, 1, p.lev_z), -math.degrees(phi))
    parts.append(Part("lever_A", lev, "#e8c21a", "inputA"))
    # links
    cf = rot((d.sx, d.sz), d.crank_top, th_f)
    cr = rot((-d.sx, d.sz), (-d.crank_top[0], d.crank_top[1]), th_r)
    parts.append(Part("link_front", place_link(p, d, prof_link(p, d), up, cf), "#d9d9d9", "inputA"))
    parts.append(Part("link_rear", place_link(p, d, prof_link_rear(p, d), dn, cr), "#d9d9d9", "inputA"))
    if mode == "fab":
        for c in (up, dn, cf, cr):
            parts.append(Part("link_pin", cyl_y(c[0], c[1], p.link_pin / 2, d.my0 - 2, d.ly1 + 4), "#9aa0a8", "hw"))
        parts.append(Part("lever_pin", cyl_y(0, p.lev_z, p.lev_pin / 2, d.Y + 5, d.my1 + 6), "#9aa0a8", "hw"))

    # input B: shot bolt + release lever
    shift = -p.bolt_travel if released else 0.0
    lx, lz = d.lobe
    bolt = cyl_y(lx, lz, p.bolt_d / 2, d.bolt_y0 + shift, d.bolt_tip_y + shift)
    bolt = bolt.cut(cyl_x(d.cross_y + shift, lz, (p.cross_d + p.clr) / 2, lx - p.bolt_d, lx + p.bolt_d))
    parts.append(Part("shot_bolt_B", bolt, "#d62828", "inputB"))
    cross = cyl_x(d.cross_y + shift, lz, p.cross_d / 2, lx - p.bolt_hw - 3, d.rl_x1 + (1.5 if p.mode == "fab" else 0.3))
    parts.append(Part("cross_pin_B", cross, "#9aa0a8", "hw" if mode == "fab" else "filament"))
    rl = plate_yz(prof_release_lever(p, d).sketch(), d.rl_x0, d.rl_x1)
    if released:
        piv = d.rl_piv
        a0 = math.atan2(lz - piv[1], d.cross_y - piv[0])
        a1 = math.atan2(lz - piv[1], d.cross_y + shift - piv[0])
        rl = rl.rotate((0, piv[0], piv[1]), (1, piv[0], piv[1]), math.degrees(a1 - a0))
    parts.append(Part("release_lever_B", rl, "#d62828", "inputB"))
    return p, d, parts


if __name__ == "__main__":
    p, d, parts = build_assembly("fab", "closed")
    for pt in parts:
        bb = pt.shape.val().BoundingBox()
        print(f"{pt.name:18s} {bb.xmin:8.1f}{bb.xmax:8.1f}{bb.ymin:8.1f}{bb.ymax:8.1f}{bb.zmin:8.1f}{bb.zmax:8.1f}")
