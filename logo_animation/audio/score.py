"""Original 5-second score for the Mehidpurwala logo sting, synthesized from timeline.json.

    python3 audio/score.py [timeline.json] build/score.wav

The timeline picks the cut (timeline.json: 5 s landscape; timeline_reel.json: 4.5 s reel end card).

D major. Every hit sits on a timestamp the picture uses:
  0.1 s      the heart beats in: lub-dub + a soft bell
  0.6–1.5    ribbon whooshes panned with each ribbon; strings + music-box arpeggio enter (G)
  1.6–2.4    wordmark on D, a bell on the ® pop, glint on the sheen
  2.5–3.95   tagline on A, ticks on the ellipsis, Asus4 lift + short riser into "दिल से."
  4.0 s      the wink: D major chord resolves, sparkle "ting" with each glint, tail fades by 5.0 s
"""
import json
import os
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARGS = [a for a in sys.argv[1:] if a.endswith('.json')]
TL = json.load(open(os.path.join(ROOT, ARGS[0] if ARGS else 'timeline.json')))
DUR = TL['duration']
RNG = np.random.default_rng(1885)
N = int(DUR * SR)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


NOTE = {n: i for i, n in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}


def m(name):
    """'F#4' → MIDI number"""
    return 12 * (int(name[-1]) + 1) + NOTE[name[:-1]]


class Bus:
    def __init__(self):
        self.x = np.zeros((N + SR * 4, 2))

    def add(self, sig, t0, gain=1.0, pan=0.0):
        i = int(round(t0 * SR))
        if sig.ndim == 1:
            l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            sig = np.c_[sig * l, sig * r] * np.sqrt(2)
        j = min(i + len(sig), len(self.x))
        if j > i >= 0:
            self.x[i:j] += sig[: j - i] * gain


def lp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, 'low', fs=SR, output='sos'), x, axis=0)


def hp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, 'high', fs=SR, output='sos'), x, axis=0)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x, axis=0)


def sweep_bp(x, f0, f1, q=1.5, block=256, curve=1.0):
    """band-pass whose centre glides f0 → f1 (geometric), block-wise with carried state"""
    out = np.zeros_like(x)
    zi = None
    nb = int(np.ceil(len(x) / block))
    for k in range(nb):
        u = (k / max(nb - 1, 1)) ** curve
        fc = f0 * (f1 / f0) ** u
        lo, hi = fc / (1 + 1 / (2 * q)), fc * (1 + 1 / (2 * q))
        sos = signal.butter(1, [lo, min(hi, SR / 2 - 100)], 'band', fs=SR, output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        out[k * block:(k + 1) * block], zi = signal.sosfilt(sos, x[k * block:(k + 1) * block], zi=zi)
    return out


def tt(sec):
    return np.arange(int(sec * SR)) / SR


# ----------------------------------------------------------------------------- instruments
def piano(midi, vel=0.7, length=None):
    """additive piano: stretched partials, two slightly detuned strings, hammer noise"""
    f = hz(midi)
    T0 = float(np.clip(3.2 * (220 / f) ** 0.45, 0.9, 7.0))
    length = length or min(T0 * 2.2, 8.0)
    t = tt(length)
    y = np.zeros_like(t)
    bright = 0.55 + 0.6 * vel
    for n in range(1, 14):
        fn = n * f * np.sqrt(1 + 0.00035 * n * n)
        if fn > 15000:
            break
        amp = (1 / n ** 1.15) * bright ** (n - 1) * 0.9
        tau = T0 / (1 + 0.55 * (n - 1))
        env = 0.65 * np.exp(-t / (tau * 0.18)) + 0.35 * np.exp(-t / tau)
        for det in (-0.5, 0.5):
            y += 0.5 * amp * env * np.sin(2 * np.pi * fn * 2 ** (det / 1200) * t + RNG.uniform(0, 6.28))
    ham = lp(RNG.standard_normal(int(0.012 * SR)), 2500 + 2500 * vel) * np.exp(-np.arange(int(0.012 * SR)) / (0.003 * SR))
    y[: len(ham)] += 0.25 * ham * vel
    y *= np.minimum(1, t / 0.002)
    y[-int(0.08 * SR):] *= np.linspace(1, 0, int(0.08 * SR))
    return y * vel


def bell(midi, vel=0.5, length=3.0):
    """glassy celesta / bell: inharmonic sine partials"""
    f = hz(midi)
    t = tt(length)
    y = np.zeros_like(t)
    for ratio, amp, tau in ((1, 1, 1.6), (2.76, 0.45, 0.6), (5.4, 0.25, 0.25), (8.93, 0.12, 0.12)):
        if f * ratio < 16000:
            y += amp * np.exp(-t / tau) * np.sin(2 * np.pi * f * ratio * t)
    return y * vel * np.minimum(1, t / 0.001)


def strings(midis, length, attack=0.9, release=1.2, cutoff=1900, vel=0.2):
    """warm ensemble pad: three detuned band-limited saws per note, slow vibrato, low-passed"""
    t = tt(length + release)
    y = np.zeros((len(t), 2))
    for k, mm in enumerate(midis):
        f = hz(mm)
        for v, det in enumerate((-7, 0, 7)):
            vib = 1 + 0.0025 * np.sin(2 * np.pi * (5.1 + 0.3 * v) * t + k)
            ph = np.cumsum(f * 2 ** (det / 1200) * vib) / SR + RNG.uniform()
            saw = 2 * (ph % 1) - 1
            pan = (v - 1) * 0.6
            y[:, 0] += saw * np.cos((pan + 1) * np.pi / 4)
            y[:, 1] += saw * np.sin((pan + 1) * np.pi / 4)
    env = np.minimum(1, t / attack) ** 2
    env *= np.where(t > length, np.clip(1 - (t - length) / release, 0, 1), 1)
    return lp(y, cutoff, 2) * env[:, None] * vel / len(midis) ** 0.6


def heartbeat(gain=1.0):
    """lub: pitched sub thump with a soft knock"""
    t = tt(0.45)
    f = 52 + 90 * np.exp(-t / 0.022)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.11) * np.minimum(1, t / 0.003)
    y = np.tanh(2.2 * y) / np.tanh(2.2)          # soft saturation: harmonics that small speakers can play
    knock = lp(RNG.standard_normal(len(t)), 420, 2) * np.exp(-t / 0.018) * 1.8
    return lp(y + knock, 900, 2) * gain


def sub_boom(length=2.4):
    t = tt(length)
    f = 30 + 45 * np.exp(-t / 0.35)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.75) * np.minimum(1, t / 0.004)


def reverse_swell(length, lo=3500):
    """reverse cymbal: bright noise swelling up to a hard stop"""
    t = tt(length)
    n = hp(RNG.standard_normal((len(t), 2)), lo, 2)
    return n * ((t / length) ** 3)[:, None]


def whoosh(length, f0, f1, pan_from, pan_to):
    t = tt(length)
    n = RNG.standard_normal(len(t))
    y = sweep_bp(n, f0, f1, q=1.2)
    env = np.sin(np.pi * np.clip(t / length, 0, 1)) ** 1.6
    y = y * env
    pan = np.linspace(pan_from, pan_to, len(t))
    return np.c_[y * np.cos((pan + 1) * np.pi / 4), y * np.sin((pan + 1) * np.pi / 4)] * np.sqrt(2)


def glint(length=1.1):
    """airy shimmer for the light sheen"""
    t = tt(length)
    y = sweep_bp(RNG.standard_normal(len(t)), 3000, 9000, q=3)
    return y * np.sin(np.pi * t / length) ** 2


def reverb(x, rt60=2.6, predelay=0.018, wet=0.35):
    n = int(rt60 * SR)
    t = np.arange(n) / SR
    ir = RNG.standard_normal((n, 2)) * np.exp(-6.9 * t / rt60)[:, None]
    ir = lp(ir, 7000, 1)
    ir[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))[:, None]
    ir = np.r_[np.zeros((int(predelay * SR), 2)), ir]
    ir /= np.sqrt((ir ** 2).sum(0))
    w = np.c_[signal.fftconvolve(x[:, 0], ir[:, 0])[: len(x)], signal.fftconvolve(x[:, 1], ir[:, 1])[: len(x)]]
    return x * (1 - wet) + w * wet * 1.6


# ----------------------------------------------------------------------------- the score
def build():
    dry, verb, fx = Bus(), Bus(), Bus()   # fx: dry-ish hits (sub, heartbeat)
    beat0 = TL['heartbeats'][0]

    # the heart beats in
    fx.add(heartbeat(1.0), beat0)
    fx.add(heartbeat(0.6), beat0 + TL['dub'])
    fx.add(sub_boom(1.2), beat0, 0.35)
    verb.add(bell(m('D6'), 0.16, 2.0), beat0 + 0.02, pan=0.1)

    # harmony: (start, end, string voicing, bass, arpeggio)
    w0, t0, t2, wk = TL['word'][0], TL['tag1'][0], TL['tag2'][0], TL['wink']
    prog = [
        (0.5, w0, ['G2', 'D3', 'G3', 'B3', 'D4'], 'G2', ['D4', 'G4', 'B4', 'A5', 'B4', 'G4']),
        (w0, t0, ['D3', 'A3', 'D4', 'F#4', 'A4'], 'D2', ['A4', 'D5', 'F#5', 'E5', 'F#5', 'D5']),
        (t0, t2 - 0.05, ['A2', 'E3', 'A3', 'C#4', 'E4'], 'A2', ['E4', 'A4', 'C#5', 'B4', 'C#5', 'A4']),
        (t2 - 0.05, wk, ['A2', 'E3', 'A3', 'D4', 'E4'], 'A2', ['E5', 'A5', 'D6', 'E6']),   # Asus4 lift
    ]
    step = 0.16   # music-box arpeggio
    for k, (a, z, tones, bass, arp) in enumerate(prog):
        verb.add(strings([m(x) for x in tones], z - a + 0.1, attack=0.35, release=0.6, cutoff=1500 + 250 * k, vel=0.16 + 0.03 * k), a)
        dry.add(lp(piano(m(bass), 0.45, z - a + 1.0), 900), a, 0.45)
        for e in range(int(round((z - a) / step))):
            verb.add(piano(m(arp[e % len(arp)]), 0.2 * (1.0 if e % 2 == 0 else 0.75) * (0.7 if k == 0 else 1)),
                     a + e * step, pan=-0.3 + 0.6 * (e % 3) / 2)
    # melody
    for ts, nm, v in [(w0, 'F#5', 0.4), (TL['reg'], 'A5', 0.34), (t0, 'E5', 0.36), (t0 + 0.4, 'F#5', 0.32)]:
        verb.add(piano(m(nm), v), ts, pan=0.1)

    # picture accents
    for (s0, s1), pan in ((TL['ribbonL'], -0.6), (TL['ribbonR'], 0.6)):
        dry.add(whoosh(s1 - s0 + 0.15, 220, 2600, pan * 0.3, pan), s0 - 0.05, 0.10)
    verb.add(glint(0.6), TL['sheen'][0], 0.03)
    verb.add(bell(m('A6'), 0.12, 1.6), TL['reg'], pan=0.5)                     # ® pop
    for k, nm in enumerate(['D6', 'F#6', 'A6']):                              # Since 1885: a little run
        verb.add(piano(m(nm), 0.14), TL['since'][0] + k * 0.06, pan=0.3 + 0.1 * k)
    for ts, nm in zip([TL['tag1'][1]] + TL['dots'], ['A5', 'D6', 'E6']):      # the ellipsis
        verb.add(piano(m(nm), 0.24), ts, pan=0.2)

    # lift into the wink
    rl = wk - (t2 - 0.15)
    rt = tt(rl)
    dry.add(sweep_bp(RNG.standard_normal(len(rt)), 400, 7000, q=1.4, curve=1.4) * (rt / rl) ** 2.2, t2 - 0.15, 0.05)
    dry.add(reverse_swell(0.6, 3000), wk - 0.6, 0.05)

    # the wink: D major resolves, a sparkle "ting" with each glint
    ring = TL['duration'] - wk + 0.5
    for k, nm in enumerate(['D2', 'D3', 'A3', 'D4', 'F#4', 'A4', 'D5']):
        verb.add(piano(m(nm), 0.5 - 0.03 * k, ring + 0.6), wk + 0.01 * k, 0.8, pan=-0.3 + 0.1 * k)
    verb.add(piano(m('F#5'), 0.42, ring + 0.6), wk + 0.03, 0.85)
    verb.add(strings([m(x) for x in ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5']], ring - 0.3, attack=0.12, release=0.8, cutoff=2600, vel=0.24), wk)
    fx.add(sub_boom(1.4), wk, 0.4)
    verb.add(bell(m('D7'), 0.22, 2.0), TL['sparkles'][0], pan=0.45)
    verb.add(bell(m('A7'), 0.14, 1.5), TL['sparkles'][1], pan=0.6)
    verb.add(glint(0.5), TL['sparkles'][0] - 0.02, 0.035)

    out = reverb(verb.x, 2.2, wet=0.38) + dry.x + reverb(fx.x, 1.0, wet=0.12)
    out = hp(out, 34, 2)
    out = out[:N]
    fade = int(0.6 * SR)
    out[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5
    return out / np.max(np.abs(out)) * 0.9


if __name__ == '__main__':
    outs = [a for a in sys.argv[1:] if not a.endswith('.json')]
    dst = outs[0] if outs else os.path.join(ROOT, 'build', 'score.wav')
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    wavfile.write(dst, SR, build().astype(np.float32))
    print('wrote', dst)
