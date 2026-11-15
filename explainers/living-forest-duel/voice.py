"""Synthesizes the narration with Kokoro (neural TTS, voice af_heart) and lays it out on a timeline.

    python3 voice.py

Needs `pip install kokoro-onnx soundfile` and the two model files (kokoro-v1.0.onnx, voices-v1.0.bin from
github.com/thewh1teagle/kokoro-onnx releases) in $KOKORO_DIR (default /home/user/tts).
A line is re-synthesized only if its text changed (cache key in build/vo/<id>.txt).

Outputs:
    build/vo/<id>.wav        processed mono 48 kHz line
    build/timeline.json      every beat with start/end seconds, plus total duration
"""
import json
import os
import subprocess
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from script import BEATS  # noqa: E402

KOKORO_DIR = os.environ.get('KOKORO_DIR', '/home/user/tts')
VOICE, SPEED = 'af_heart', 1.04
SR = 48000
BUILD = os.path.join(HERE, 'build')
VO = os.path.join(BUILD, 'vo')

LEAD_IN, TAIL = 1.4, 4.0
GAP_SAME, GAP_SCENE, GAP_CHAPTER_BEFORE, GAP_CHAPTER_AFTER = 0.32, 0.65, 1.0, 0.75


def synth(k, text):
    s, sr = k.create(text, voice=VOICE, speed=SPEED, lang='en-us')
    x = np.asarray(s, dtype=np.float32)
    return signal.resample_poly(x, SR // 1000 * 1, sr // 1000 * 1).astype(np.float32)   # 24 k -> 48 k


def trim(x, thresh_db=-45.0, pre=0.03, post=0.12):
    hop = int(0.01 * SR)
    n = len(x) // hop
    rms = np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    loud = np.where(20 * np.log10(rms) > thresh_db)[0]
    if not len(loud):
        return x
    return x[max(0, loud[0] * hop - int(pre * SR)): min(len(x), (loud[-1] + 1) * hop + int(post * SR))]


def peaking(f0, gain_db, q):
    a = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / SR
    al = np.sin(w0) / (2 * q)
    b = np.array([1 + al * a, -2 * np.cos(w0), 1 - al * a])
    aa = np.array([1 + al / a, -2 * np.cos(w0), 1 - al / a])
    return b / aa[0], aa / aa[0]


def process(x):
    x = trim(x - np.mean(x))
    x = signal.sosfilt(signal.butter(2, 80, 'highpass', fs=SR, output='sos'), x)
    for f0, g, q in ((180, 1.5, 0.8), (3200, 2.0, 1.0), (7500, -1.5, 0.9)):    # warmth, presence, de-ess
        b, a = peaking(f0, g, q)
        x = signal.lfilter(b, a, x)
    env = np.sqrt(signal.lfilter([0.002], [1, -0.998], x * x) + 1e-12)          # gentle 2:1 compressor
    over = np.maximum(0, 20 * np.log10(env) + 20)
    x = x * 10 ** (-(over / 2) / 20)
    fade = int(0.008 * SR)
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    return (x / (np.max(np.abs(x)) + 1e-9) * 0.7).astype(np.float32)


def main():
    os.makedirs(VO, exist_ok=True)
    k = None
    lines = []
    for b in BEATS:
        text = b.get('say') or b['text']
        wav, key = os.path.join(VO, f"{b['id']}.wav"), os.path.join(VO, f"{b['id']}.txt")
        cached = os.path.exists(wav) and os.path.exists(key) and open(key).read() == f'{VOICE}|{SPEED}|{text}'
        if not cached:
            if k is None:
                from kokoro_onnx import Kokoro
                k = Kokoro(os.path.join(KOKORO_DIR, 'kokoro-v1.0.onnx'), os.path.join(KOKORO_DIR, 'voices-v1.0.bin'))
            x = process(synth(k, text))
            wavfile.write(wav, SR, x)
            open(key, 'w').write(f'{VOICE}|{SPEED}|{text}')
            print('synth', b['id'], f'{len(x) / SR:.2f}s')
        sr, x = wavfile.read(wav)
        lines.append(len(x) / SR)

    t = LEAD_IN
    out = []
    for i, (b, dur) in enumerate(zip(BEATS, lines)):
        if i:
            prev = BEATS[i - 1]
            if b['scene'] == 'chapter':
                t += GAP_CHAPTER_BEFORE
            elif prev['scene'] == 'chapter':
                t += GAP_CHAPTER_AFTER
            elif prev['scene'] != b['scene'] or b.get('new'):
                t += GAP_SCENE
            else:
                t += GAP_SAME
        out.append(dict(b, start=round(t, 3), end=round(t + dur, 3)))
        t += dur
    total = t + TAIL
    json.dump(dict(duration=round(total, 3), fps=30, beats=out), open(os.path.join(BUILD, 'timeline.json'), 'w'), indent=1)
    print(f'{len(out)} beats, {int(total // 60)}:{total % 60:04.1f} total')


if __name__ == '__main__':
    main()
