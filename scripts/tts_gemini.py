"""Generate the narration with Gemini TTS via OpenRouter into build/vo_override/.

narration.py picks these files up instead of RHVoice, so the rest of the pipeline
(alignment, captions, HUD cues, SFX, mix) re-derives from the new recording.

  python3 scripts/tts_gemini.py [--voice Charon] [--model google/gemini-3.1-flash-tts-preview]
                                [--only a1_l1,a8_l3] [--force] [--samples Charon,Orus,Kore]

Needs OPENROUTER_API_KEY in the environment or in .env. Existing clips are kept
unless --force is given, so re-runs only pay for missing lines.
"""
import argparse
import os
import sys
import time
import urllib.error
import urllib.request
import json
import wave

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from timeline_lib import BUILD, ROOT, load_json, parse_line  # noqa: E402

URL = "https://openrouter.ai/api/v1/audio/speech"
OVERRIDE_DIR = os.path.join(BUILD, "vo_override")
SAMPLE_DIR = os.path.join(BUILD, "vo_samples")

# The beat grid's respellings were written for RHVoice; Gemini says these words
# correctly from the real spelling, and the respellings only make it sound odd.
NATURAL = {"oo jane": "Ujjain", "dee palletizer": "depalletiser"}


def api_key():
    if os.environ.get("OPENROUTER_API_KEY"):
        return os.environ["OPENROUTER_API_KEY"]
    env = os.path.join(ROOT, ".env")
    if os.path.exists(env):
        for row in open(env):
            k, _, v = row.strip().partition("=")
            if k == "OPENROUTER_API_KEY" and v:
                return v.strip().strip('"').strip("'")
    raise SystemExit("OPENROUTER_API_KEY not set (environment or .env)")


def gemini_text(line):
    _, tts, _ = parse_line(line["text"])
    for k, v in NATURAL.items():
        tts = tts.replace(k, v)
    return tts


def synth(key, model, voice, text, out_path):
    body = json.dumps({"model": model, "input": text, "voice": voice, "response_format": "pcm"}).encode()
    req = urllib.request.Request(URL, data=body, headers={
        "Content-Type": "application/json", "Authorization": f"Bearer {key}"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                ctype = r.headers.get("Content-Type", "")
                pcm = r.read()
            break
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:300]
            if e.code in (429, 500, 502, 503) and attempt < 4:
                time.sleep(2 ** attempt)
                continue
            raise SystemExit(f"{model} {voice}: HTTP {e.code} {msg}")
    if not ctype.startswith("audio/pcm"):
        raise SystemExit(f"unexpected content type {ctype!r}")
    params = dict(p.split("=") for p in ctype.split(";")[1:] if "=" in p)
    with wave.open(out_path, "wb") as w:
        w.setnchannels(int(params.get("channels", 1)))
        w.setsampwidth(2)
        w.setframerate(int(params.get("rate", 24000)))
        w.writeframes(pcm)
    return len(pcm) / 2 / int(params.get("rate", 24000))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="Charon")
    ap.add_argument("--model", default="google/gemini-3.1-flash-tts-preview")
    ap.add_argument("--only", default="")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--samples", default="", help="comma list of voices: render the first line in each to build/vo_samples/")
    a = ap.parse_args()
    key = api_key()
    lines = load_json("beat_grid.json")["narration"]["lines"]

    if a.samples:
        os.makedirs(SAMPLE_DIR, exist_ok=True)
        text = " ".join(gemini_text(l) for l in lines[:2])
        for v in a.samples.split(","):
            out = os.path.join(SAMPLE_DIR, f"{v}.wav")
            print(f"sample {v}: {synth(key, a.model, v, text, out):.2f}s -> {os.path.relpath(out, ROOT)}")
        return

    os.makedirs(OVERRIDE_DIR, exist_ok=True)
    only = set(filter(None, a.only.split(",")))
    for line in lines:
        if only and line["id"] not in only:
            continue
        out = os.path.join(OVERRIDE_DIR, line["id"] + ".wav")
        if os.path.exists(out) and not a.force:
            print(f"{line['id']}: kept existing")
            continue
        text = gemini_text(line)
        print(f"{line['id']}: {synth(key, a.model, a.voice, text, out):5.2f}s  {text}")


if __name__ == "__main__":
    main()
