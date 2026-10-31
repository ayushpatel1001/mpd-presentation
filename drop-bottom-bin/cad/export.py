"""Build every deliverable.   python3 export.py   (takes a few minutes)

  ../fab/step/      full-size STEP assemblies (closed + released) and one STEP per unique part
  ../fab/dxf/       1:1 DXF cutting profiles (laser / plasma / waterjet) for every profiled plate
  ../fab/cut_list.csv, ../fab/bom.csv
  ../print/stl/     1:8 printable STLs, already in print orientation
  ../renders/       PNG renders
"""
import csv
import math
import os

import cadquery as cq
import numpy as np

import bin_model as M

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
STEEL = 7.85e-6  # kg / mm^3


def mk(*parts):
    path = os.path.join(ROOT, *parts)
    os.makedirs(path, exist_ok=True)
    return path


# --------------------------------------------------------------------------------------
# FAB
# --------------------------------------------------------------------------------------
def export_fab():
    step_dir = mk("fab", "step")
    dxf_dir = mk("fab", "dxf")
    p = M.params("fab")
    d = M.derive(p)

    masses = {}
    for state in ("closed", "released"):
        _, _, parts = M.build_assembly("fab", state)
        asm = cq.Assembly(name=f"drop_bottom_bin_{state}")
        for i, pt in enumerate(parts):
            asm.add(pt.shape, name=f"{pt.name}_{i}", color=cq.Color(pt.color))
            if state == "closed":
                masses[pt.name] = masses.get(pt.name, 0) + pt.shape.val().Volume() * STEEL
        asm.save(os.path.join(step_dir, f"drop_bottom_bin_assembly_{state}.step"))
    tare = sum(masses.values())

    # unique parts as individual STEP files
    singles = {
        "tub_weldment": M.build_tub(p, d),
        "door_weldment_RH(+Y)": M.build_door(p, d),
        "door_weldment_LH(-Y)": M.build_door(p, d).mirror("XZ"),
    }
    latch = M.build_end_latch(p, d)
    singles["latch_hook"] = latch["hooks"][0]
    singles["drive_dog_with_pin"] = latch["dogs"][0]
    singles["crank"] = latch["crank"]
    singles["cross_shaft"] = latch["shaft"]
    for name, wp in singles.items():
        cq.exporters.export(wp, os.path.join(step_dir, f"{name}.step"))

    # DXF cutting profiles
    profiles = [
        ("hook_12mm_x4", M.prof_hook(p, d), 12, 4, "S355 plate, flame/laser cut; bore 42 reamed, grease nipple"),
        ("drive_dog_12mm_x4", M.prof_dog(p, d), 12, 4, "S355; weld to shaft; press dia-16 pin through, weld"),
        ("crank_12mm_x2", M.prof_crank(p, d), 12, 2, "S355; weld to shaft end"),
        ("central_lever_A_12mm_x1", M.prof_lever(p, d), 12, 1, "S355; input A lever"),
        ("link_front_10mm_x1", M.prof_link(p, d), 10, 1, "S355 flat bar 50x10 or cut"),
        ("link_rear_10mm_x1", M.prof_link_rear(p, d), 10, 1, "S355 flat bar 50x10 or cut"),
        ("release_lever_B_12mm_x1", M.prof_release_lever(p, d), 12, 1, "S355; input B lever"),
        ("door_lug_12mm_x4", M.prof_lug(p, d), 12, 4, "S355; weld to door frame ends"),
        ("bearing_gusset_12mm_x8", M.prof_bearing(p, d), 12, 8, "S355; 4 per end wall, line-bore 42 after welding"),
    ]
    plate_rows = []
    for name, pr, t, qty, note in profiles:
        sk = pr.sketch()
        face = sk._faces
        bb = face.BoundingBox()
        wp = cq.Workplane("XY").add(face.moved(cq.Location(cq.Vector(-bb.xmin, -bb.ymin, 0))))
        cq.exporters.export(wp, os.path.join(dxf_dir, f"{name}.dxf"), exportType="DXF")
        area = face.Area()
        plate_rows.append([name, t, qty, round(bb.xlen), round(bb.ylen), round(area * t * STEEL, 2), note])
    # simple rectangular plates
    X, Y = d.X, d.Y
    rects = [
        ("side_wall_3mm_x2", 3, 2, 2 * X, p.H - d.z0, "S275 sheet; ends 3 mm over end-wall edge"),
        ("end_wall_3mm_x2", 3, 2, 2 * Y - 2 * p.tw, p.H - d.z0, "S275 sheet; fits between side walls"),
        ("door_plate_6mm_x2", 6, 2, 2 * (X + p.door_ext), Y - p.gap / 2, "S355 plate (or Hardox 400 for abrasive loads)"),
        ("pocket_gusset_10mm_x8", 10, 8, p.pk_len / 2 - Y, p.pk_g_drop, "S355 right-angle triangle"),
    ]
    for name, t, qty, a, b, note in rects:
        wp = cq.Workplane("XY").rect(a, b, centered=False)
        if "gusset" in name:
            wp = cq.Workplane("XY").polyline([(0, 0), (a, 0), (0, b)]).close()
        cq.exporters.export(wp, os.path.join(dxf_dir, f"{name}.dxf"), exportType="DXF")
        plate_rows.append([name, t, qty, round(a), round(b), round(a * b * t * STEEL * (0.5 if "gusset" in name else 1), 2), note])

    with open(os.path.join(ROOT, "fab", "plate_list.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["dxf_file", "thickness_mm", "qty", "bbox_x_mm", "bbox_y_mm", "mass_each_kg", "note"])
        w.writerows(plate_rows)

    # sections cut list
    a = p.ang
    zr = p.H - a
    door_len = 2 * (X + p.door_ext)
    inner = (Y - p.gap / 2) - 2 * 50
    rows = [
        ["50x50x5 equal angle", "top rim, long sides", 2, 2 * X + 2 * a, "45 deg mitre corners"],
        ["50x50x5 equal angle", "top rim, ends", 2, 2 * Y, ""],
        ["50x50x5 equal angle", "mid band (z=480-530), long sides", 2, 2 * X + 2 * a, ""],
        ["50x50x5 equal angle", "mid band, ends", 2, 2 * Y, ""],
        ["50x50x5 equal angle", "side wall vertical stiffeners", 4, zr - p.stiff_side_z0, "stop 130 above ground (door swing)"],
        ["50x50x5 equal angle", "end wall vertical stiffeners", 4, zr - p.stiff_end_z0, "stop above cross shaft"],
        ["50x50x5 equal angle", "corner posts", 4, zr - p.stiff_side_z0, ""],
        ["50x8 flat bar", "end wall bottom edge", 2, 2 * Y, "door seats against it"],
        ["150x75x5 RHS", "fork pockets", 2, p.pk_len, "multi-pass fillet to rim + gussets"],
        ["50x50x5 SHS", "door frame, long members", 4, door_len, "2 per door"],
        ["50x50x5 SHS", "door frame, end + cross members", 10, inner, "5 per door"],
        ["CHS / thick tube 40 OD x 21 ID", "hinge knuckles (tub 12, door 6)", 18, 80, "or machined from 40 bar"],
        ["Bright bar dia 20 (EN8)", "hinge pins", 6, 2 * p.tk_out + 10, "with grease nipples, R-clip / weld collar"],
        ["Bright bar dia 40 (EN8)", "end cross shafts", 2, round(d.shaft_y1 + 1 - p.shaft_y0), ""],
        ["Bright bar dia 25 (EN19/EN8 HT)", "roller pins", 4, 74, "washer + split pin outer end"],
        ["Tube / bush 40 OD x 26 ID", "rollers", 4, p.roller_len, "machined, greased"],
        ["Bright bar dia 16", "dog drive pins", 4, round(d.dog_y + p.dog_t / 2 - (d.hook_y - p.hook_t / 2)), "pressed + welded into dog"],
        ["Bright bar dia 20", "link pins", 4, 30, "head + R-clip"],
        ["Bright bar dia 30", "central lever pivot pin", 1, 88, ""],
        ["Bright bar dia 25 (EN19, hardened)", "SHOT BOLT (input B)", 1, p.bolt_len, "chamfer tip 3x45"],
        ["Bright bar dia 8", "shot-bolt cross pin", 1, 81, ""],
        ["Bright bar dia 16", "release-lever pivot pin", 1, 40, ""],
        ["Solid/fabricated block", "lever pivot post, bolt housing + stop, release-lever bracket, 2 spring anchors", 1, 0, "see STEP tub_weldment; bore 26 in housing"],
    ]
    with open(os.path.join(ROOT, "fab", "cut_list.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["section", "use", "qty", "length_mm", "note"])
        w.writerows(rows)

    bought = [
        ["Extension spring, ~150 N preload, 200 mm extended", "crank returns (input A)", 2],
        ["Compression spring OD 24, wire 3, free length 55, ~6 N/mm", "shot bolt (input B), inside housing bore", 1],
        ["Light torsion/extension spring (optional)", "hook return (hooks are gravity-biased already)", 4],
        ["Release cable, 6 mm galvanised wire rope + T-handle", "input A to cab (red handle)", 1],
        ["Release cable, 6 mm galvanised wire rope + T-handle", "input B to cab (yellow handle)", 1],
        ["Cable guide sheave 75 mm", "redirect cable A upward", 1],
        ["Grease nipple M6", "hinges, hooks, rollers, lever", 16],
        ["Safety chain, grade 80, 8 mm + hook", "to forklift mast", 1],
    ]
    with open(os.path.join(ROOT, "fab", "bought_out.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["item", "use", "qty"])
        w.writerows(bought)
    return tare, masses


# --------------------------------------------------------------------------------------
# PRINT (1:8)
# --------------------------------------------------------------------------------------
def export_print():
    out = mk("print", "stl")
    p = M.params("print")
    d = M.derive(p)

    def save(name, wp):
        wp = wp.translate((0, 0, 0))
        bb = wp.val().BoundingBox()
        wp = wp.translate((-(bb.xmin + bb.xmax) / 2, -(bb.ymin + bb.ymax) / 2, -bb.zmin))
        cq.exporters.export(wp, os.path.join(out, f"{name}.stl"), tolerance=0.02, angularTolerance=0.1)
        return wp

    files = {}
    files["01_tub_x1"] = save("01_tub_x1", M.build_tub(p, d))
    door = M.build_door(p, d)
    files["02_door_RH_x1"] = save("02_door_RH_x1", door)
    files["03_door_LH_x1"] = save("03_door_LH_x1", door.mirror("XZ"))

    flat = lambda pr, t: M.plate_xy(pr.sketch(), t)
    files["04_hook_x4"] = save("04_hook_x4", flat(M.prof_hook(p, d), p.hook_t))
    pin_h = (d.hook_y - p.hook_t / 2)
    pc = M.dog_pin_pos(p, d)
    pin_len = d.dog_y + p.dog_t / 2 - (d.hook_y - p.hook_t / 2)
    dog = flat(M.prof_dog(p, d), p.dog_t).union(
        cq.Workplane("XY").center(*pc).circle(p.dog_pin_d / 2).extrude(pin_len))
    files["05_dog_R_x2"] = save("05_dog_R_x2", dog)
    files["06_dog_L_x2"] = save("06_dog_L_x2", dog.mirror("YZ"))
    files["07_crank_x2"] = save("07_crank_x2", flat(M.prof_crank(p, d), p.crank_t))
    files["08_lever_A_x1"] = save("08_lever_A_x1", flat(M.prof_lever(p, d), p.lev_t))
    files["09_link_front_x1"] = save("09_link_front_x1", flat(M.prof_link(p, d), p.link_t))
    files["10_link_rear_x1"] = save("10_link_rear_x1", flat(M.prof_link_rear(p, d), p.link_t))
    files["11_release_lever_B_x1"] = save("11_release_lever_B_x1", flat(M.prof_release_lever(p, d), p.rl_t))
    sl = d.shaft_y1 + 1 - p.shaft_y0
    files["12_square_shaft_x2"] = save("12_square_shaft_x2", M.box(0, sl, 0, p.shaft_d, 0, p.shaft_d))
    roller = (cq.Workplane("XY").circle(d.rr).extrude(p.roller_len)
              .cut(cq.Workplane("XY").circle((p.pin_d + p.clr) / 2).extrude(p.roller_len)))
    files["13_roller_x4"] = save("13_roller_x4", roller)
    bolt = (cq.Workplane("XY").circle(p.bolt_d / 2).extrude(p.bolt_len)
            .cut(M.cyl_x(0, p.cross_back, (p.cross_d + p.clr) / 2, -5, 5))
            .edges(">Z").chamfer(0.4))
    files["14_shot_bolt_B_x1"] = save("14_shot_bolt_B_x1", bolt)
    return p, d, files


# --------------------------------------------------------------------------------------
# RENDERS
# --------------------------------------------------------------------------------------
def tess(shape, tol):
    v, t = shape.tessellate(tol, 0.3)
    V = np.array([(q.x, q.y, q.z) for q in v])
    return V, np.array(t)


def render(parts, fname, elev, azim, lims=None, tol=1.0, title=None, size=(12, 9), labels=None):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection
    from matplotlib.colors import to_rgb

    tris, cols = [], []
    e, a = math.radians(elev), math.radians(azim)
    view = np.array([math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)])
    light = view + np.array([0.3, -0.2, 0.6])
    light /= np.linalg.norm(light)
    for shape, color in parts:
        V, T = tess(shape, tol)
        if len(T) == 0:
            continue
        P = V[T]
        if lims is not None:
            c = P.mean(axis=1)
            (x0, x1), (y0, y1), (z0, z1) = lims
            m = (c[:, 0] > x0) & (c[:, 0] < x1) & (c[:, 1] > y0) & (c[:, 1] < y1) & (c[:, 2] > z0) & (c[:, 2] < z1)
            P = P[m]
        if len(P) == 0:
            continue
        n = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0])
        n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
        sh = 0.35 + 0.65 * np.abs(n @ light)
        rgb = np.array(to_rgb(color))
        tris.append(P)
        cols.append(np.clip(rgb[None, :] * sh[:, None], 0, 1))
    P = np.concatenate(tris)
    C = np.concatenate(cols)
    fig = plt.figure(figsize=size, dpi=110)
    ax = fig.add_subplot(111, projection="3d")
    pc = Poly3DCollection(P, facecolors=C, edgecolors=C * 0.85, linewidths=0.15)
    ax.add_collection3d(pc)
    if lims is None:
        mn, mx = P.reshape(-1, 3).min(0), P.reshape(-1, 3).max(0)
    else:
        mn = np.array([l[0] for l in lims]); mx = np.array([l[1] for l in lims])
    ax.set_xlim(mn[0], mx[0]); ax.set_ylim(mn[1], mx[1]); ax.set_zlim(mn[2], mx[2])
    ax.set_box_aspect(mx - mn)
    ax.view_init(elev=elev, azim=azim)
    ax.set_axis_off()
    if title:
        ax.set_title(title, fontsize=14)
    if labels:
        for (x, y, z, txt, c) in labels:
            ax.text(x, y, z, txt, color=c, fontsize=11, weight="bold")
    fig.tight_layout()
    fig.savefig(fname, facecolor="white", bbox_inches="tight")
    plt.close(fig)


def export_renders():
    out = mk("renders")
    _, d0, closed = M.build_assembly("fab", "closed")
    _, _, rel = M.build_assembly("fab", "released")

    def sp(parts):
        return [(pt.shape.val(), pt.color) for pt in parts]

    render(sp(closed), os.path.join(out, "01_closed_iso.png"), 22, 35, tol=2.0,
           title="Closed & locked - 1 t drop-bottom bin (forklift side)")
    render(sp(rel), os.path.join(out, "02_released_iso.png"), -12, 35, tol=2.0,
           title="Inputs A + B pulled - doors released (view from below)")
    lims = ((-260, 760), (380, 640), (40, 700))
    render(sp(closed), os.path.join(out, "03_side_mechanism_locked.png"), 8, 75, lims=lims, tol=0.6,
           title="Side mechanism, locked: shot bolt (red, B) pins lever (yellow, A)",
           labels=[(0, 600, 660, "A: cable eye", "#806000"), (150, 600, 480, "B: release lever", "#a00000")])
    render(sp(rel), os.path.join(out, "04_side_mechanism_released.png"), 8, 75, lims=lims, tol=0.6,
           title="Side mechanism, A + B pulled: bolt withdrawn, lever rotated 31 deg")
    lims2 = ((560, 760), (-140, 140), (-20, 290))
    render(sp(closed), os.path.join(out, "05_end_latch_locked.png"), 10, 20, lims=lims2, tol=0.4,
           title="End latch, locked: hooks under door rollers")
    render(sp(rel), os.path.join(out, "06_end_latch_released.png"), 10, 20, lims=lims2, tol=0.4,
           title="End latch, released: hooks swung 25 deg clear")


def export_print_sheet():
    """2-D sheet of every printed part at true 1:8 size, labelled with quantity."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.collections import PolyCollection

    p = M.params("print")
    d = M.derive(p)
    sx = lambda w, h: M.Prof().poly([(0, 0), (w, 0), (w, h), (0, h)])
    roll = M.Prof().circle((0, 0), d.rr).circle((0, 0), (p.pin_d + p.clr) / 2, hole=True)
    sheet = [
        ("04 hook x4", M.prof_hook(p, d), "#f28c28"),
        ("05/06 dog R x2 + L x2\n(pin printed upright)", M.prof_dog(p, d), "#f2b028"),
        ("07 crank x2", M.prof_crank(p, d), "#f2b028"),
        ("08 lever A x1", M.prof_lever(p, d), "#e8c21a"),
        ("11 release\nlever B x1", M.prof_release_lever(p, d), "#d62828"),
        ("13 roller x4", roll, "#9aa0a8"),
        ("14 shot bolt B\nx1, upright", M.Prof().circle((0, 0), p.bolt_d / 2), "#d62828"),
        ("09 link front x1", M.prof_link(p, d), "#9aa0a8"),
        ("10 link rear x1", M.prof_link_rear(p, d), "#9aa0a8"),
        ("12 square shaft 4x4 x2", sx(d.shaft_y1 + 1 - p.shaft_y0, p.shaft_d), "#9aa0a8"),
    ]
    fig, ax = plt.subplots(figsize=(13, 8.5), dpi=120)
    x, y, row_h = 0.0, 0.0, 0.0
    for i, (label, pr, col) in enumerate(sheet):
        face = pr.sketch()._faces
        bb = face.BoundingBox()
        if i == 7:
            x, y, row_h = 0.0, y - 20, 0.0
        tris = []
        for f in face.Faces():
            V, T = f.tessellate(0.02, 0.2)
            for t in T:
                tris.append([(V[k].x - bb.xmin + x, V[k].y - bb.ymin + y) for k in t])
        ax.add_collection(PolyCollection(tris, facecolors=col, edgecolors=col, linewidths=0.2))
        ax.text(x, y - 3, label, fontsize=8.5, va="top", linespacing=1.2)
        if i >= 7:
            y -= bb.ylen + 12
        else:
            x += max(bb.xlen, 22) + 10
            row_h = max(row_h, bb.ylen)
    ax.plot([0, 20], [y - 6, y - 6], color="k", lw=2)
    ax.text(0, y - 8, "20 mm (true print size, 1:8)", fontsize=9, va="top")
    ax.set_aspect("equal")
    ax.autoscale()
    ax.axis("off")
    ax.set_title("1:8 printable mechanism parts (tub 01 and doors 02/03 not shown)", fontsize=12)
    fig.savefig(os.path.join(mk("renders"), "10_print_parts_sheet.png"), bbox_inches="tight", facecolor="white")
    plt.close(fig)


if __name__ == "__main__":
    tare, masses = export_fab()
    print(f"fab exported; steel tare from model = {tare:.0f} kg")
    with open(os.path.join(ROOT, "fab", "mass_summary.txt"), "w") as f:
        f.write(f"Total steel mass from the CAD model (closed assembly): {tare:.1f} kg\n")
        for k, v in sorted(masses.items(), key=lambda kv: -kv[1]):
            f.write(f"{k:24s} {v:8.2f} kg\n")
    p, d, files = export_print()
    print("print STLs exported")
    for name, wp in files.items():
        bb = wp.val().BoundingBox()
        print(f"  {name:26s} {bb.xlen:6.1f} x {bb.ylen:6.1f} x {bb.zlen:6.1f} mm")
    export_print_sheet()
    print("renders done")
