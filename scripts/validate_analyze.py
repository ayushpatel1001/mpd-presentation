"""Analyse validation captures -> build/validation/report.json + report.md.

Checks
  safe_area      every visible text box lies inside the 10%-padding safe area
  min_size       fully visible text is at least type.minSizePx tall (font size)
  contrast       WCAG contrast of text colour vs the rendered pixels behind it
                 (5th-percentile pixel, measured on a text-hidden render of the same frame)
  reading_time   static text stays fully visible >= words / readingWordsPerSec + readingPadSec
  sync_cues      word-anchored cues equal word start + offset, and the HUD actually appears then
  caption_sync   the karaoke highlight is on the word being spoken
  vo_placement   each narration line sits in the mixed VO stem where the timeline says
  loudness       final mixes hit the integrated loudness / true-peak targets
"""
import json
import os
import re
import subprocess
import sys
from collections import defaultdict

import numpy as np
from PIL import Image
from scipy.io import wavfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from timeline_lib import BUILD, load_json  # noqa: E402

OUT = os.path.join(BUILD, "validation")
NUMERIC = re.compile(r"^[~≈]?[\d,.]+(\s?(T|KL|T/month))?$")


def lin(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def luminance(rgb):
    l = lin(rgb)
    return 0.2126 * l[..., 0] + 0.7152 * l[..., 1] + 0.0722 * l[..., 2]


def hex_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64)


def words(s):
    return len(re.findall(r"[\w&'’+]+", s))


def main():
    tok = load_json("style_tokens.json")
    tl = load_json("timeline.resolved.json")
    ts = load_json("whisper_timestamps.json")
    V = tok["validation"]
    SA = tok["safeArea"]
    dense = json.load(open(os.path.join(OUT, "manifest_dense.json")))
    frames = json.load(open(os.path.join(OUT, "frames.json")))
    report = {}

    # ---------------------------------------------------------------- safe area + min size
    sa_viol, size_viol = {}, {}
    for smp in dense:
        for it in smp["items"]:
            if it["a"] < 0.05:
                continue
            x0, y0, x1, y1 = it["b"]
            over = max(SA["x0"] - x0, SA["y0"] - y0, x1 - SA["x1"], y1 - SA["y1"])
            if over > 1.0:
                k = (it["o"], it["s"])
                sa_viol[k] = max(sa_viol.get(k, (0, 0))[0], over), smp["t"]
            if it["a"] >= 0.9 and it["z"] < tok["type"]["minSizePx"] - 0.5:
                k = (it["o"], it["s"])
                size_viol[k] = min(size_viol.get(k, (999, 0))[0], it["z"]), smp["t"]
    report["safe_area"] = {"pass": not sa_viol, "safeArea": SA,
                           "violations": [{"owner": o, "text": s, "overflowPx": round(v[0], 1), "t": v[1]} for (o, s), v in sa_viol.items()]}
    report["min_size"] = {"pass": not size_viol, "minSizePx": tok["type"]["minSizePx"],
                          "violations": [{"owner": o, "text": s, "sizePx": v[0], "t": v[1]} for (o, s), v in size_viol.items()]}

    # ---------------------------------------------------------------- contrast
    worst = {}
    checked = 0
    for fr in frames:
        bg = np.asarray(Image.open(os.path.join(OUT, "frames", fr["id"] + "_bg.jpg")).convert("RGB"), dtype=np.float64)
        H, W = bg.shape[:2]
        for it in fr["manifest"]:
            if it["alpha"] < 0.95 or not it["text"].strip():
                continue
            x0, y0, x1, y1 = it["x0"], it["y0"], it["x1"], it["y1"]
            hpad = (y1 - y0) * 0.15
            xa, xb = int(max(0, x0 + 1)), int(min(W, x1 - 1))
            ya, yb = int(max(0, y0 + hpad)), int(min(H, y1 - hpad))
            if xb - xa < 2 or yb - ya < 2:
                continue
            lb = luminance(bg[ya:yb, xa:xb]).ravel()
            lt = float(luminance(hex_rgb(it["color"])[None, :])[0])
            ratio = (np.maximum(lt, lb) + 0.05) / (np.minimum(lt, lb) + 0.05)
            r5 = float(np.percentile(ratio, 5))
            large = it["size"] >= V["largeTextPx"] or (it["size"] >= 28 and int(it["weight"]) >= 700)
            need = V["minContrastLarge"] if large else V["minContrastBody"]
            key = (it["owner"], it["text"])
            checked += 1
            if key not in worst or r5 < worst[key]["ratio"]:
                worst[key] = {"owner": it["owner"], "text": it["text"], "ratio": round(r5, 2), "required": need,
                              "sizePx": round(it["size"], 1), "color": it["color"], "t": fr["t"]}
    fails = sorted([w for w in worst.values() if w["ratio"] < w["required"]], key=lambda w: w["ratio"])
    allw = sorted(worst.values(), key=lambda w: w["ratio"])
    report["contrast"] = {"pass": not fails, "measurements": checked, "uniqueTexts": len(worst),
                          "minRatio": allw[0]["ratio"] if allw else None, "failures": fails, "lowest10": allw[:10]}

    # ---------------------------------------------------------------- reading time
    vis = defaultdict(float)
    for smp in dense:
        seen = set()
        for it in smp["items"]:
            if it["a"] >= 0.9:
                seen.add((it["o"], it["s"]))
        for k in seen:
            vis[k] += 0.1
    by_owner = defaultdict(set)
    for (o, s) in vis:
        by_owner[o].add(s)
    rt_fail, rt_checked = [], 0
    for (o, s), sec in vis.items():
        if o == "captions" or NUMERIC.match(s.strip()) or not s.strip():
            continue
        if any(other != s and other.startswith(s) for other in by_owner[o]):
            continue  # typing animation prefixes
        need = words(s) / V["readingWordsPerSec"] + V["readingPadSec"]
        rt_checked += 1
        if sec + 1e-6 < need:
            rt_fail.append({"owner": o, "text": s, "visibleSec": round(sec, 1), "requiredSec": round(need, 1)})
    report["reading_time"] = {"pass": not rt_fail, "checkedTexts": rt_checked, "failures": rt_fail}

    # ---------------------------------------------------------------- cue sync
    def first_visible(owner, text=None):
        for smp in dense:
            for it in smp["items"]:
                if it["o"] == owner and it["a"] >= 0.15 and (text is None or it["s"] == text):
                    return smp["t"]
        return None

    ov_by_id = {o["id"]: o for o in tl["overlays"]}
    sync, sync_fail = [], []
    for a in tl["anchors"]:
        err_res = abs(a["cue"] - (a["wordStart"] + a["offset"]))
        owner = a["ctx"].split(".")[0].split("[")[0]
        ov = ov_by_id.get(owner)
        text = None
        m = re.search(r"\.(rows|items)\[(\d+)\]", a["ctx"])
        if ov and m:
            item = ov["props"][m.group(1)][int(m.group(2))]
            text = item.get("label") or item.get("text") or item.get("title")
        elif ov and a["ctx"].endswith(".total"):
            # running total: by ~1.2 s after the spoken total the panel must show exactly that number
            want = f"{ov['props']['total']['value']:,}"
            target = round(a["cue"] + 1.2, 1)
            smp = next((x for x in dense if abs(x["t"] - target) < 0.051), None)
            shown = smp and any(it["o"] == owner and it["s"] == want and it["a"] >= 0.9 for it in smp["items"])
            entry = {"cue": a["ctx"], "word": a["word"], "wordStart": a["wordStart"], "offset": a["offset"], "cueTime": a["cue"],
                     "resolveErrorSec": round(err_res, 4), "totalShown": want if shown else None, "pass": bool(shown) and err_res < 0.0015}
            sync.append(entry)
            if not entry["pass"]:
                sync_fail.append(entry)
            continue
        seen = first_visible(owner, text)
        entry = {"cue": a["ctx"], "word": a["word"], "wordStart": a["wordStart"], "offset": a["offset"], "cueTime": a["cue"],
                 "resolveErrorSec": round(err_res, 4), "firstVisible": seen}
        if seen is not None:
            entry["appearLagSec"] = round(seen - a["cue"], 3)
        ok = err_res < 0.0015 and (seen is None or -0.051 <= seen - a["cue"] <= 0.25)
        entry["pass"] = ok
        sync.append(entry)
        if not ok:
            sync_fail.append(entry)
    report["sync_cues"] = {"pass": not sync_fail, "anchors": len(sync), "failures": sync_fail, "details": sync}

    # ---------------------------------------------------------------- caption highlight sync
    active = tok["color"]["hud"]["captionActive"].lower()
    index = {round(s["t"], 1): s for s in dense}
    hit = tot = 0
    misses = []
    for seg in ts["segments"]:
        for w in seg["words"]:
            ts_ = [round(x / 10, 1) for x in range(int(np.ceil(w["start"] * 10)), int(np.floor(w["end"] * 10)) + 1)]
            ts_ = [x for x in ts_ if w["start"] + 0.02 < x < w["end"] - 0.02]
            if not ts_:
                continue
            tot += 1
            smp = index.get(ts_[len(ts_) // 2])
            ok = smp and any(it["o"] == "captions" and it["s"] == w["word"].strip() and it["c"].lower() == active for it in smp["items"])
            hit += bool(ok)
            if not ok:
                misses.append({"word": w["word"].strip(), "t": ts_[len(ts_) // 2]})
    report["caption_sync"] = {"pass": tot > 0 and hit / tot >= 0.98, "wordsChecked": tot, "highlighted": hit, "misses": misses[:20]}

    # ---------------------------------------------------------------- VO placement in the mixed stem
    sr, stem = wavfile.read(os.path.join(BUILD, "audio", "vo.wav"))
    stem = stem.mean(axis=1) if stem.ndim > 1 else stem
    vo_res = []
    for line in tl["narration"]:
        _, x = wavfile.read(os.path.join(BUILD, "vo", line["id"] + ".wav"))
        x = x.astype(np.float64)[: int(1.5 * sr)]
        lo = int((line["start"] - 0.25) * sr)
        seg = stem[lo: lo + len(x) + int(0.5 * sr)].astype(np.float64)
        corr = np.correlate(seg, x, mode="valid")
        off = (np.argmax(corr) + lo) / sr - line["start"]
        vo_res.append({"line": line["id"], "expected": line["start"], "measuredOffsetSec": round(float(off), 4)})
    report["vo_placement"] = {"pass": all(abs(v["measuredOffsetSec"]) <= V["maxSyncErrorSec"] for v in vo_res), "lines": vo_res}

    # ---------------------------------------------------------------- loudness
    loud = {}
    for name in ("mix_narrated", "mix_music_only"):
        out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", os.path.join(BUILD, "audio", name + ".wav"),
                              "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
        i_lufs = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", out)[-1])
        tp = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", out)[-1])
        loud[name] = {"integratedLufs": i_lufs, "truePeakDbtp": tp,
                      "pass": abs(i_lufs - V["targetLufs"]) <= 1.0 and tp <= V["maxTruePeakDb"]}
    report["loudness"] = {"pass": all(v["pass"] for v in loud.values()), **loud}

    report["summary"] = {k: v["pass"] for k, v in report.items() if isinstance(v, dict) and "pass" in v}
    with open(os.path.join(OUT, "report.json"), "w") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    write_md(report, tok)
    for k, v in report["summary"].items():
        print(f"{'PASS' if v else 'FAIL'}  {k}")
    sys.exit(0 if all(report["summary"].values()) else 1)


def write_md(r, tok):
    L = ["# Validation report", "", "| Check | Result | Detail |", "|---|---|---|"]
    c = r["contrast"]
    L.append(f"| Safe area (10% padding) | {'PASS' if r['safe_area']['pass'] else 'FAIL'} | {len(r['safe_area']['violations'])} violations |")
    L.append(f"| Min type size ≥ {tok['type']['minSizePx']}px | {'PASS' if r['min_size']['pass'] else 'FAIL'} | {len(r['min_size']['violations'])} violations |")
    L.append(f"| Contrast (WCAG, rendered bg) | {'PASS' if c['pass'] else 'FAIL'} | {c['measurements']} measurements, {c['uniqueTexts']} texts, min {c['minRatio']}:1 |")
    L.append(f"| Reading time | {'PASS' if r['reading_time']['pass'] else 'FAIL'} | {r['reading_time']['checkedTexts']} texts, {len(r['reading_time']['failures'])} too short |")
    s = r["sync_cues"]
    lags = [d["appearLagSec"] for d in s["details"] if "appearLagSec" in d]
    L.append(f"| Word-anchored cues | {'PASS' if s['pass'] else 'FAIL'} | {s['anchors']} anchors, appear lag {min(lags):+.2f}…{max(lags):+.2f}s |" if lags else "| Word-anchored cues | ? | |")
    cs = r["caption_sync"]
    L.append(f"| Caption highlight sync | {'PASS' if cs['pass'] else 'FAIL'} | {cs['highlighted']}/{cs['wordsChecked']} words |")
    vp = r["vo_placement"]
    L.append(f"| VO placement in mix | {'PASS' if vp['pass'] else 'FAIL'} | max {max(abs(v['measuredOffsetSec']) for v in vp['lines']) * 1000:.1f} ms |")
    ld = r["loudness"]
    L.append(f"| Loudness | {'PASS' if ld['pass'] else 'FAIL'} | narrated {ld['mix_narrated']['integratedLufs']} LUFS / {ld['mix_narrated']['truePeakDbtp']} dBTP; music-only {ld['mix_music_only']['integratedLufs']} LUFS / {ld['mix_music_only']['truePeakDbtp']} dBTP |")
    L += ["", "## Lowest contrast texts", "", "| Ratio | Required | Text | Owner | t |", "|---|---|---|---|---|"]
    for w in c["lowest10"]:
        L.append(f"| {w['ratio']}:1 | {w['required']}:1 | {w['text']} | {w['owner']} | {w['t']} |")
    for name, key in (("Safe-area violations", "safe_area"), ("Size violations", "min_size")):
        if r[key]["violations"]:
            L += ["", f"## {name}", ""] + [f"- `{v['owner']}` “{v['text']}” @ {v['t']}s" for v in r[key]["violations"]]
    if r["reading_time"]["failures"]:
        L += ["", "## Reading-time failures", ""] + [f"- `{f['owner']}` “{f['text']}”: {f['visibleSec']}s < {f['requiredSec']}s" for f in r["reading_time"]["failures"]]
    if s["failures"]:
        L += ["", "## Cue sync failures", ""] + [f"- {f['cue']} ({f['word']}): cue {f['cueTime']} first visible {f['firstVisible']}" for f in s["failures"]]
    with open(os.path.join(OUT, "report.md"), "w") as f:
        f.write("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
