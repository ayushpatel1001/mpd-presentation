"""Export the full-size closed assembly as a compact mesh + rig file for the web viewer.
    python3 export_web.py  ->  ../viewer/scene.json
"""
import base64
import json
import math
import os

import numpy as np

import bin_model as M

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "viewer")


def b64(a):
    return base64.b64encode(a.tobytes()).decode()


def mesh(shape, tol, k=1.0):
    v, t = shape.tessellate(tol, 0.35)
    V = np.array([(q.x * k, q.y * k, q.z * k) for q in v], dtype=np.float32)
    T = np.array(t, dtype=np.uint32).reshape(-1)
    idx_dtype = np.uint16 if len(V) < 65536 else np.uint32
    return {"pos": b64(V), "idx": b64(T.astype(idx_dtype)), "idx16": idx_dtype == np.uint16, "n": int(len(T) // 3)}


def rig_for(name, d, shape):
    if name in ("door_+Y", "roller_0", "roller_1", "roller_pin_0", "roller_pin_1"):
        return "door_p"
    if name in ("door_-Y", "roller_2", "roller_3", "roller_pin_2", "roller_pin_3"):
        return "door_n"
    if name.startswith("hook_front"):
        return "hook_f"
    if name.startswith("hook_rear"):
        return "hook_r"
    if name in ("shaft_front", "crank_front") or name.startswith("dog_front"):
        return "shaft_f"
    if name in ("shaft_rear", "crank_rear") or name.startswith("dog_rear"):
        return "shaft_r"
    if name == "lever_A":
        return "lever"
    if name == "link_pin":
        c = shape.Center()
        if abs(c.x) < 1:
            return "lever"
        return "shaft_f" if c.x > 0 else "shaft_r"
    if name in ("shot_bolt_B", "cross_pin_B"):
        return "bolt"
    if name == "release_lever_B":
        return "rl"
    if name in ("link_front", "link_rear"):
        return name
    return "static"


def main(mode="fab"):
    os.makedirs(OUT, exist_ok=True)
    k = 1.0 if mode == "fab" else 1 / M.PRINT_SCALE   # print model is scaled up for display only
    p, d, parts = M.build_assembly(mode, "closed")
    items = []
    tri = 0
    for pt in parts:
        shape = pt.shape.val()
        rig = rig_for(pt.name, d, shape)
        if rig in ("link_front", "link_rear"):
            prof = M.prof_link(p, d) if rig == "link_front" else M.prof_link_rear(p, d)
            shape = M.plate_xz(prof.sketch(), d.ly0, d.ly1).val()
        tol = (1.2 if pt.name in ("tub",) or pt.name.startswith("door") else 0.35) / k
        m = mesh(shape, tol, k)
        tri += m["n"]
        items.append({"name": pt.name, "group": pt.group, "color": pt.color, "rig": rig, **m})
    phi_max = M.phi_for_hook(p, d, 25.0)
    def sc(v):
        return [x * k for x in v] if isinstance(v, (tuple, list)) else v * k
    rig = {
        "hy": d.hy, "hz": d.hz, "sx": d.sx, "sz": d.sz,
        "lev": d.lev, "lev_up": d.lev_up, "lev_dn": d.lev_dn,
        "crank_top": d.crank_top, "Lf": M.link_len(d, True), "Lr": M.link_len(d, False),
        "phi_max": phi_max, "hook_release": 25.0, "door_open": 75.0,
        "bolt_face": (p.lev_t + p.bolt_tip) / p.bolt_travel,
        "bolt_travel": p.bolt_travel, "lobe": d.lobe, "rl_piv": d.rl_piv, "cross_y": d.cross_y,
    }
    for key in ("hy", "hz", "sx", "sz", "lev", "lev_up", "lev_dn", "crank_top", "Lf", "Lr", "bolt_travel", "lobe", "rl_piv", "cross_y"):
        rig[key] = sc(rig[key])
    fname = "scene.json" if mode == "fab" else "scene_print.json"
    with open(os.path.join(OUT, fname), "w") as f:
        json.dump({"parts": items, "rig": rig}, f, separators=(",", ":"))
    print(f"{len(items)} parts, {tri} triangles, {os.path.getsize(os.path.join(OUT, fname)) / 1e6:.2f} MB")


if __name__ == "__main__":
    import sys
    main(sys.argv[1] if len(sys.argv) > 1 else "fab")
