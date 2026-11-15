"""Builds the soundtrack: narration + a synthesized lo-fi score (ducked under the voice) + transition SFX.

    python3 audio.py      ->  build/mix.wav (48 kHz stereo), build/captions.srt

Everything is synthesized in numpy from build/timeline.json; no samples or third-party music.
"""
import json
import os

import numpy as np
from scipy import signal
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, 'build')
SR = 48000
BPM = 88
BEAT = 60 / BPM
rng = np.random.default_rng(7)

tl = json.load(open(os.path.join(BUILD, 'timeline.json')))
D = tl['duration']
N = int(D * SR) + SR


def env_ad(n, a=0.008, d=1.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)


def place(buf, x, t, gain=1.0):
    i = int(t * SR)
    if i >= len(buf) or i + len(x) <= 0:
        return
    a, b = max(0, i), min(len(buf), i + len(x))
    buf[a:b] += x[a - i: b - i] * gain


def midi(m):
    return 440 * 2 ** ((m - 69) / 12)


# ------------------------------------------------------------------ instruments
def epiano(freq, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * freq * 2 * t) * 0.9 * np.exp(-t / 0.35)          # FM bell-ish tine
    x = np.sin(2 * np.pi * freq * t + mod) * env_ad(n, 0.006, 1.6)
    x += 0.25 * np.sin(2 * np.pi * freq * 2 * t) * env_ad(n, 0.004, 0.5)
    return x * (1 + 0.08 * np.sin(2 * np.pi * 4.5 * t))                        # gentle tremolo


def bass(freq, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * freq * 2 * t)
    return np.tanh(1.4 * x) * env_ad(n, 0.01, dur * 0.8)


def kick():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 48 + 90 * np.exp(-t / 0.04)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)


def snare():
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    noise = signal.sosfilt(signal.butter(2, [900, 6000], 'bandpass', fs=SR, output='sos'), rng.standard_normal(n))
    return (0.7 * noise + 0.4 * np.sin(2 * np.pi * 190 * t)) * np.exp(-t / 0.07)


def hat():
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    noise = signal.sosfilt(signal.butter(2, 7000, 'highpass', fs=SR, output='sos'), rng.standard_normal(n))
    return noise * np.exp(-t / 0.018)


def whoosh(dur=0.6):
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    # sweep a band-pass up then down, in blocks
    blocks = 24
    for b in range(blocks):
        a, z = b * n // blocks, (b + 1) * n // blocks
        fc = 400 + 3800 * np.sin(np.pi * (b + 0.5) / blocks)
        sos = signal.butter(2, [fc * 0.6, min(fc * 1.6, 20000)], 'bandpass', fs=SR, output='sos')
        out[a:z] = signal.sosfilt(sos, noise[a:z])
    return out * np.sin(np.pi * t) ** 2


def thump():
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 70 + 60 * np.exp(-t / 0.03)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12)
    click = signal.sosfilt(signal.butter(2, 2500, 'highpass', fs=SR, output='sos'), rng.standard_normal(n)) * np.exp(-t / 0.006)
    return x + 0.25 * click


def pop():
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f = 900 * np.exp(-t / 0.05) + 500
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.03)


# ------------------------------------------------------------------ score
def score():
    L, R = np.zeros(N), np.zeros(N)
    # Am9 - Fmaj7 - Cmaj7 - G6, one chord per bar
    prog = [(57, [60, 64, 67, 71]), (53, [57, 60, 64, 69]), (48, [55, 59, 64, 67]), (55, [59, 62, 64, 67])]
    bar = 4 * BEAT
    nbars = int(D / bar) + 2
    for b in range(nbars):
        t0 = b * bar
        root, chord = prog[b % 4]
        for j, m in enumerate(chord):                     # strummed chord
            x = epiano(midi(m), bar * 1.1) * 0.11
            place(L, x, t0 + j * 0.018, 0.9 if j % 2 else 1.1)
            place(R, x, t0 + j * 0.018, 1.1 if j % 2 else 0.9)
        for j, m in enumerate([chord[2] + 12, chord[1] + 12]):   # off-beat answer
            x = epiano(midi(m), bar * 0.5) * 0.05
            place(L, x, t0 + (2.5 + j * 0.5) * BEAT, 0.8); place(R, x, t0 + (2.5 + j * 0.5) * BEAT, 1.2)
        for beat_i, m in ((0, root - 12), (2, root - 12), (3.5, root - 5)):
            x = bass(midi(m), BEAT * 1.4) * 0.22
            place(L, x, t0 + beat_i * BEAT); place(R, x, t0 + beat_i * BEAT)
        for k in range(4):
            if k in (0, 2):
                place(L, kick() * 0.32, t0 + k * BEAT); place(R, kick() * 0.32, t0 + k * BEAT)
            else:
                place(L, snare() * 0.09, t0 + k * BEAT); place(R, snare() * 0.11, t0 + k * BEAT)
        for k in range(8):                                # swung hats
            tt = t0 + k * BEAT / 2 + (0.06 if k % 2 else 0)
            g = 0.035 if k % 2 else 0.05
            place(L, hat() * g, tt, 1.1); place(R, hat() * g, tt, 0.9)
    vinyl = signal.sosfilt(signal.butter(2, [300, 4000], 'bandpass', fs=SR, output='sos'), rng.standard_normal(N)) * 0.004
    L += vinyl; R += vinyl
    sos = signal.butter(2, 9000, 'lowpass', fs=SR, output='sos')        # warm it up
    return signal.sosfilt(sos, L), signal.sosfilt(sos, R)


# ------------------------------------------------------------------ voice + ducking
def voice():
    v = np.zeros(N)
    for b in tl['beats']:
        sr, x = wavfile.read(os.path.join(BUILD, 'vo', f"{b['id']}.wav"))
        place(v, x.astype(np.float64), b['start'])
    return v


def duck_curve(v):
    # 1 when silent, ~0.3 (-10 dB) under speech, with 80 ms attack / 600 ms release
    lvl = np.abs(v)
    hop = 480
    frames = lvl[: len(lvl) // hop * hop].reshape(-1, hop).max(axis=1)
    speaking = (frames > 0.02).astype(float)
    g = np.ones_like(speaking)
    cur = 1.0
    for i, s in enumerate(speaking):
        target = 0.3 if s else 1.0
        rate = 0.12 if target < cur else 0.016
        cur += (target - cur) * rate
        g[i] = cur
    g = np.repeat(g, hop)
    return np.pad(g, (0, len(v) - len(g)), constant_values=1.0)


def segments():
    segs, last = [], None
    for b in tl['beats']:
        if b['scene'] != last or b['scene'] == 'chapter' or b.get('new'):
            segs.append(b)
        last = b['scene']
    return [(max(0, s['start'] - (0.45 if i else 1.2)), s['scene']) for i, s in enumerate(segs)]


def main():
    mL, mR = score()
    v = voice()
    duck = duck_curve(v)
    # overall music shape: fade in, gentle level, swell at the end, fade out
    t = np.arange(N) / SR
    shape = np.clip(t / 1.5, 0, 1) * np.clip((D - t) / 3.0, 0, 1)
    end_swell = 1 + 0.4 * np.clip((t - (tl['beats'][-1]['end'] - 0.2)) / 1.0, 0, 1)
    music_gain = 0.55 * duck * shape * end_swell
    sL, sR = np.zeros(N), np.zeros(N)
    for i, (st, scene) in enumerate(segments()):
        if i:
            w = whoosh() * 0.09
            place(sL, w, st - 0.05, 1.1); place(sR, w, st - 0.05, 0.9)
        if scene == 'chapter':
            place(sL, thump() * 0.22, st + 0.18); place(sR, thump() * 0.22, st + 0.18)
    for b in tl['beats']:                                  # soft pop when a new idea appears
        if b['scene'] not in ('chapter', 'title'):
            place(sL, pop() * 0.03, b['start'] - 0.12, 0.9); place(sR, pop() * 0.03, b['start'] - 0.12, 1.1)
    L = mL * music_gain + v * 0.95 + sL
    R = mR * music_gain + v * 0.95 + sR
    out = np.stack([L, R], 1)[: int(D * SR)]
    out = out / np.max(np.abs(out)) * 0.89
    wavfile.write(os.path.join(BUILD, 'mix_raw.wav'), SR, out.astype(np.float32))

    # captions
    def ts(x):
        h, m, s = int(x // 3600), int(x % 3600 // 60), x % 60
        return f'{h:02d}:{m:02d}:{int(s):02d},{int((s % 1) * 1000):03d}'
    with open(os.path.join(BUILD, 'captions.srt'), 'w') as f:
        for i, b in enumerate(tl['beats'], 1):
            f.write(f"{i}\n{ts(b['start'])} --> {ts(b['end'] + 0.2)}\n{b['text']}\n\n")
    print(f'mix_raw.wav {D:.1f}s, captions.srt {len(tl["beats"])} cues')


if __name__ == '__main__':
    main()
