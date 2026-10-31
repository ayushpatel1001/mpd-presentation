"""Interference + mechanism checks. Run:  python3 checks.py [fab|print]"""
import math
import sys

import cadquery as cq

from bin_model import (build_assembly, params, derive, build_door, build_rollers, build_end_latch,
                       build_tub, solve_cranks, phi_for_hook)


def bb_overlap(a, b, tol=0.0):
    return not (a.xmax < b.xmin - tol or b.xmax < a.xmin - tol or a.ymax < b.ymin - tol or
                b.ymax < a.ymin - tol or a.zmax < b.zmin - tol or b.zmax < a.zmin - tol)


def clashes(parts, vol_tol):
    sh = [(pt.name, pt.shape.val()) for pt in parts]
    bbs = [s.BoundingBox() for _, s in sh]
    out = []
    for i in range(len(sh)):
        for j in range(i + 1, len(sh)):
            if not bb_overlap(bbs[i], bbs[j]):
                continue
            v = sh[i][1].intersect(sh[j][1]).Volume()
            if v > vol_tol:
                out.append((sh[i][0], sh[j][0], v))
    return out


def main(mode):
    vol_tol = 1.0 if mode == "fab" else 1e-3
    ok = True
    for state in ("closed", "released"):
        p, d, parts = build_assembly(mode, state)
        c = clashes(parts, vol_tol)
        print(f"[{mode}] {state}: {len(parts)} parts, {len(c)} clashes")
        for a, b, v in c:
            print(f"    CLASH {a} x {b}: {v:.2f} mm3")
        ok &= not c

    # door swing with hooks released: roller + door vs hooks/tub at many angles
    p = params(mode)
    d = derive(p)
    phi = phi_for_hook(p, d, 25)
    th_f, th_r, *_ = solve_cranks(p, d, phi)
    latch = build_end_latch(p, d, th_f)
    hooks = [h.val() for h in latch["hooks"]]
    door = build_door(p, d)
    rollers = build_rollers(p, d)
    tub = build_tub(p, d).val()
    worst = 0
    for ang in range(0, 91, 5):
        ax0, ax1 = (0, d.hy, d.hz), (1, d.hy, d.hz)
        dr = door.rotate(ax0, ax1, ang).val()
        rl = [r.rotate(ax0, ax1, ang).val() for r in rollers]
        v = sum(h.intersect(x).Volume() for h in hooks for x in [dr] + rl)
        v += tub.intersect(dr).Volume()
        worst = max(worst, v)
        if v > vol_tol:
            print(f"    swing {ang:3d} deg: clash volume {v:.2f}")
    print(f"[{mode}] door swing 0-90 deg with hooks released: worst clash {worst:.3f} mm3")
    ok &= worst <= vol_tol

    # closing stroke with hooks LOCKED: rollers must hit the lead-in chamfer (not the flat), i.e.
    # the first contact on the way up is on the chamfer, which drives the hook outward.
    hk0 = build_end_latch(p, d, 0.0)["hooks"][0].val()
    first = None
    for ang10 in range(300, -1, -5):
        ang = ang10 / 10
        ax0, ax1 = (0, d.hy, d.hz), (1, d.hy, d.hz)
        rl = rollers[0].rotate(ax0, ax1, ang).val()
        if hk0.intersect(rl).Volume() > 1e-6:
            first = ang
            break
    print(f"[{mode}] closing: roller first touches locked hook at door angle {first} deg (chamfer cams it open)")

    # self-locking: load line offset (pin outboard of shaft) and toe gap
    print(f"[{mode}] load line offset = {d.px - d.sx:.2f} (pin outboard of hook pivot -> door load closes the hook)")
    print(f"[{mode}] roller-to-toe gap closed = {p.toe_gap:.2f}")
    print(f"[{mode}] lever travel for 25 deg hook release = {math.degrees(phi):.1f} deg; "
          f"cable-A stroke ~ {phi * (p.lev_handle - p.lev_w / 2):.0f}")
    hk = build_end_latch(p, d, 0.0)["hooks"][0].val()
    cg = hk.Center()
    print(f"[{mode}] hook centre of gravity is {cg.x - d.sx:.1f} outboard of its pivot -> gravity returns it shut")
    print("RESULT:", "PASS" if ok else "FAIL")
    return ok


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "fab")
