"""Step 1: synthesize narration lines and lay them out on the beat grid.

Engine: RHVoice (offline, apt package `rhvoice-english`). Each line is rendered
from its phonetic `spoken` text, then cleaned up (trim, HPF, presence EQ,
compression, level match) at 48 kHz.

A drop-in voice-over can replace the TTS: put `build/vo_override/<line id>.wav`
(any rate, mono or stereo) and it is used instead of synthesizing that line.

Outputs:
  build/vo/<id>.wav            processed mono 48 kHz line
  data/narration_layout.json   start/end of every line on the 180 s timeline
"""
import os
import subprocess
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from timeline_lib import BUILD, load_json, parse_line, save_json, snap_up  # noqa: E402

SR = 48000
VO_DIR = os.path.join(BUILD, "vo")
RAW_DIR = os.path.join(BUILD, "vo_raw")
OVERRIDE_DIR = os.path.join(BUILD, "vo_override")


def read_any(path):
    """Decode any audio file to mono float32 at 48 kHz via ffmpeg."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def synth_rhvoice(text, voice, out_path):
    subprocess.run(["RHVoice-test", "-p", voice["profile"], "-r", str(voice.get("rate", 100)),
                    "-t", str(voice.get("pitch", 100)), "-o", out_path],
                   input=text.encode(), check=True, capture_output=True)


def trim(x, thresh_db=-42.0, pre=0.04, post=0.14):
    hop = int(0.01 * SR)
    frames = len(x) // hop
    rms = np.sqrt(np.mean(x[: frames * hop].reshape(frames, hop) ** 2, axis=1) + 1e-12)
    loud = np.where(20 * np.log10(rms) > thresh_db)[0]
    if len(loud) == 0:
        return x
    a = max(0, loud[0] * hop - int(pre * SR))
    b = min(len(x), (loud[-1] + 1) * hop + int(post * SR))
    return x[a:b]


def peaking(f0, gain_db, q):
    a = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / SR
    alpha = np.sin(w0) / (2 * q)
    b = [1 + alpha * a, -2 * np.cos(w0), 1 - alpha * a]
    aa = [1 + alpha / a, -2 * np.cos(w0), 1 - alpha / a]
    return np.array(b) / aa[0], np.array(aa) / aa[0]


def compress(x, thresh_db=-22.0, ratio=2.6, window=0.012):
    # RMS detector (one-pole on x^2, ~12 ms) drives a static 2.6:1 curve
    a = np.exp(-1 / (window * SR))
    env = np.sqrt(signal.lfilter([1 - a], [1, -a], x * x) + 1e-12)
    lvl_db = 20 * np.log10(env)
    over = np.maximum(0, lvl_db - thresh_db)
    gain = 10 ** (-(over - over / ratio) / 20)
    return x * gain


def process(x):
    x = x - np.mean(x)
    x = trim(x)
    sos = signal.butter(2, 85, "highpass", fs=SR, output="sos")
    x = signal.sosfilt(sos, x)
    for f0, g, q in ((280, -2.0, 1.1), (3300, 2.5, 0.9), (8500, 1.5, 0.7)):
        b, a = peaking(f0, g, q)
        x = signal.lfilter(b, a, x)
    x = compress(x)
    # level-match on voiced RMS so every line sits at the same loudness
    hop = int(0.02 * SR)
    frames = len(x) // hop
    rms = np.sqrt(np.mean(x[: frames * hop].reshape(frames, hop) ** 2, axis=1))
    voiced = rms[rms > np.percentile(rms, 40)]
    target = 10 ** (-19 / 20)
    x = x * (target / (np.sqrt(np.mean(voiced ** 2)) + 1e-9))
    # 6 ms fades to avoid clicks
    f = int(0.006 * SR)
    ramp = np.linspace(0, 1, f)
    x[:f] *= ramp
    x[-f:] *= ramp[::-1]
    return np.clip(x, -0.98, 0.98).astype(np.float32)


def main():
    os.makedirs(VO_DIR, exist_ok=True)
    os.makedirs(RAW_DIR, exist_ok=True)
    grid = load_json("beat_grid.json")
    nar = grid["narration"]
    voice = nar["voice"]
    half_beat = grid["meta"]["beatSec"] / 2
    acts = {a["id"]: a for a in grid["acts"]}

    layout, prev_end = [], 0.0
    for line in nar["lines"]:
        display, tts, tokens = parse_line(line["text"])
        override = os.path.join(OVERRIDE_DIR, line["id"] + ".wav")
        if os.path.exists(override):
            source = "override"
            x = read_any(override)
        else:
            source = f"rhvoice:{voice['profile']}"
            raw_path = os.path.join(RAW_DIR, line["id"] + ".wav")
            synth_rhvoice(tts, voice, raw_path)
            x = read_any(raw_path)
        y = process(x)
        wavfile.write(os.path.join(VO_DIR, line["id"] + ".wav"), SR, y)
        dur = len(y) / SR
        start = snap_up(max(line["start"], prev_end + nar["minGapSec"]), half_beat)
        end = start + dur
        act_end = acts[line["act"]]["end"]
        if end > act_end - 0.25:
            raise SystemExit(f"{line['id']} runs to {end:.2f}s, past the end of {line['act']} ({act_end}s)")
        layout.append({"id": line["id"], "act": line["act"], "start": round(start, 5), "end": round(end, 5),
                       "duration": round(dur, 5), "source": source, "display": display, "tts": tts,
                       "tokens": tokens})
        shift = start - line["start"]
        print(f"{line['id']}: {start:7.3f} → {end:7.3f}s ({dur:4.2f}s){'  shifted +%.2fs' % shift if shift > 0.01 else ''}")
        prev_end = end

    speech = sum(item["duration"] for item in layout)
    save_json("narration_layout.json", {"sampleRate": SR, "voice": voice, "speechSec": round(speech, 2),
                                        "lines": layout})
    print(f"total speech {speech:.1f}s of {grid['meta']['durationSec']}s")


if __name__ == "__main__":
    main()
