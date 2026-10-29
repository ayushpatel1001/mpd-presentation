"""Step 3: resolve beat_grid.json + whisper_timestamps.json -> data/timeline.resolved.json.

* Every `anchor: {line, word, offset}` becomes an absolute time (word start + offset),
  so HUD pops land on the spoken word.
* Overlays sharing a screen slot are trimmed so they never overlap.
* SFX cues are derived from the same resolved times (pops -> click/thump, camera
  shots -> whoosh), so audio and picture cannot drift apart.
* Narration is chunked into caption cues with per-word timings.
"""
import copy
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from timeline_lib import load_json, norm_word, save_json  # noqa: E402


class Resolver:
    def __init__(self, ts):
        self.words = {}
        for seg in ts["segments"]:
            self.words[seg["line_id"]] = seg["words"]
        self.used = []

    def time(self, spec, ctx):
        if spec is None:
            return None
        if "at" in spec:
            return float(spec["at"])
        if "anchor" in spec:
            return self.anchor(spec["anchor"], ctx)
        raise SystemExit(f"{ctx}: timing needs 'at' or 'anchor': {spec}")

    def anchor(self, a, ctx):
        words = self.words.get(a["line"])
        if words is None:
            raise SystemExit(f"{ctx}: unknown narration line {a['line']}")
        key = norm_word(a["word"])
        hits = [w for w in words if w["key"] == key]
        occ = a.get("occurrence", 0)
        if len(hits) <= occ:
            raise SystemExit(f"{ctx}: word '{a['word']}' not found in {a['line']} "
                             f"({[w['key'] for w in words]})")
        w = hits[occ]
        t = w["start"] + a.get("offset", 0.0)
        self.used.append({"ctx": ctx, "line": a["line"], "word": a["word"], "wordStart": w["start"],
                          "offset": a.get("offset", 0.0), "cue": round(t, 4)})
        return round(t, 4)


def resolve_nested(obj, res, ctx):
    """Replace any nested {'anchor': ...} timing inside overlay props with 't'."""
    if isinstance(obj, dict):
        if "anchor" in obj and isinstance(obj["anchor"], dict) and "line" in obj["anchor"]:
            obj["t"] = res.anchor(obj["anchor"], ctx)
            del obj["anchor"]
        for k, v in list(obj.items()):
            resolve_nested(v, res, f"{ctx}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            resolve_nested(v, res, f"{ctx}[{i}]")


SLOTTED = {"capacityHud": "leftPanel", "barSplit": "rightPanel", "matrix": "rightPanel", "storageTotals": "rightPanel"}


def split_balanced(words, n):
    """Split words into n chunks of similar character length, preferring punctuation breaks."""
    texts = [w["word"].strip() for w in words]
    total = sum(len(t) + 1 for t in texts)
    chunks, start = [], 0
    for k in range(1, n):
        target = total * k / n
        best, best_cost, acc = None, 1e9, 0
        for i in range(start, len(words) - (n - k)):
            acc_i = sum(len(t) + 1 for t in texts[:i + 1])
            cost = abs(acc_i - target)
            if re.search(r"[.?!:]$", texts[i]):
                cost -= 14
            elif texts[i].endswith(","):
                cost -= 8
            if cost < best_cost:
                best, best_cost = i, cost
        chunks.append(words[start:best + 1])
        start = best + 1
    chunks.append(words[start:])
    return chunks


def caption_cues(ts, max_chars, max_rows):
    cues = []
    cap = max_chars * max_rows * 0.9   # leave slack for word-wrap raggedness
    for seg in ts["segments"]:
        words = seg["words"]
        length = sum(len(w["word"].strip()) + 1 for w in words)
        n = max(1, -(-int(length) // int(cap)))
        for chunk in split_balanced(words, n):
            cues.append({"line": seg["line_id"], "words": [
                {"text": w["word"].strip(), "start": w["start"], "end": w["end"]} for w in chunk]})
    for i, c in enumerate(cues):
        c["start"] = round(c["words"][0]["start"] - 0.12, 3)
        end = c["words"][-1]["end"] + 0.55
        if i + 1 < len(cues) and cues[i + 1]["line"] == c["line"]:
            end = min(end, cues[i + 1]["words"][0]["start"] - 0.13)
        c["end"] = round(end, 3)
        c["text"] = " ".join(w["text"] for w in c["words"])
    return cues


def main():
    grid = load_json("beat_grid.json")
    ts = load_json("whisper_timestamps.json")
    layout = load_json("narration_layout.json")
    res = Resolver(ts)

    overlays = []
    for ov in grid["overlays"]:
        o = copy.deepcopy(ov)
        o["in"] = res.time(ov["in"], o["id"] + ".in")
        o["out"] = res.time(ov["out"], o["id"] + ".out")
        resolve_nested(o.get("props", {}), res, o["id"])
        overlays.append(o)

    # keep slotted panels from overlapping: trim the earlier one
    for slot in set(SLOTTED.values()):
        group = sorted([o for o in overlays if SLOTTED.get(o["type"]) == slot], key=lambda o: o["in"])
        for a, b in zip(group, group[1:]):
            if a["out"] > b["in"] - 0.1:
                a["out"] = round(b["in"] - 0.1, 4)
    for o in overlays:
        if o["out"] <= o["in"] + 0.5:
            raise SystemExit(f"overlay {o['id']} is on screen for only {o['out'] - o['in']:.2f}s")

    # ---- SFX cues derived from picture events -------------------------------------
    sfx = [dict(c) for c in grid["sfx"]["cues"]]
    for o in overlays:
        if o.get("sfx"):
            sfx.append({"type": o["sfx"], "at": o["in"], "src": o["id"]})
        props = o.get("props", {})
        nested = props.get("rows", []) + props.get("items", []) if isinstance(props.get("items", []), list) else []
        for it in nested:
            if isinstance(it, dict) and "t" in it and abs(it["t"] - o["in"]) > 0.08:
                sfx.append({"type": "click", "at": it["t"], "src": o["id"]})
        if isinstance(props.get("total"), dict) and "t" in props["total"]:
            sfx.append({"type": "thump", "at": props["total"]["t"], "src": o["id"] + ".total"})
        if o["type"] == "counter":
            sfx.append({"type": "ticks", "at": o["in"] + 0.15, "dur": 1.35, "src": o["id"]})
        if o["type"] in ("logoCard", "contactCard", "partnerCards", "matrix", "barSplit", "capacityHud"):
            sfx.append({"type": "swoosh", "at": max(0, o["in"] - 0.12), "src": o["id"]})
    for shot in grid["camera"]["shots"]:
        if shot.get("whoosh"):
            sfx.append({"type": "whoosh", "at": shot.get("whooshAt", shot["start"]), "src": shot["id"]})
    sfx.sort(key=lambda c: c["at"])

    out = {
        "meta": grid["meta"],
        "acts": grid["acts"],
        "camera": grid["camera"]["shots"],
        "sceneStates": {k: v for k, v in grid["sceneStates"].items() if not k.startswith("$")},
        "overlays": overlays,
        "narration": [{"id": l["id"], "start": l["start"], "end": l["end"], "text": l["display"]}
                      for l in layout["lines"]],
        "captions": caption_cues(ts, grid_caption_prop(grid, "maxChars", 58), grid_caption_prop(grid, "maxRows", 2)),
        "sfx": sfx,
        "music": grid["music"],
        "anchors": res.used,
    }
    save_json("timeline.resolved.json", out)
    print(f"{len(overlays)} overlays, {len(res.used)} word anchors, {len(sfx)} sfx cues, "
          f"{len(out['captions'])} caption cues")


def grid_caption_prop(grid, key, default):
    for o in grid["overlays"]:
        if o["type"] == "captions":
            return o.get("props", {}).get(key, default)
    return default


if __name__ == "__main__":
    main()
