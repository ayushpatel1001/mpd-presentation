"""Step 4: procedural score + synthesized SFX + narration mix.

Everything is generated from data/timeline.resolved.json, so every whoosh,
click and sub-bass thump sits on the same timestamps the renderer uses.

Outputs (build/audio/):
  music.wav, sfx.wav, vo.wav       stems (48 kHz stereo float)
  mix_narrated.wav                 VO + ducked music + SFX, -14 LUFS / -1 dBTP
  mix_music_only.wav               music + SFX (no VO), -14 LUFS / -1 dBTP
"""
import json
import os
import subprocess
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from timeline_lib import BUILD, load_json  # noqa: E402

SR = 48000
OUT = os.path.join(BUILD, "audio")
RNG = np.random.default_rng(20261029)


# ----------------------------------------------------------------------------- utils
def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def saw(f, n, detune_cents=0.0, phase=0.0):
    """PolyBLEP band-limited sawtooth."""
    f = f * 2 ** (detune_cents / 1200)
    dt = f / SR
    ph = (phase + dt * np.arange(n)) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    t = ph[m] / dt
    y[m] -= t + t - t * t - 1
    m = ph > 1 - dt
    t = (ph[m] - 1) / dt
    y[m] -= t * t + t + t + 1
    return y


def sine(f, n, phase=0.0):
    return np.sin(2 * np.pi * (phase + f * np.arange(n) / SR))


def env_adsr(n, a, d, s, r, hold=None):
    """Attack/decay/sustain then release over the last r seconds of n samples."""
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel_start = n / SR - r
    e = np.where(t > rel_start, e * np.clip((n / SR - t) / max(r, 1e-4), 0, 1), e)
    return e


def env_exp(n, tau, attack=0.002):
    t = np.arange(n) / SR
    return np.minimum(t / attack, 1.0) * np.exp(-t / tau)


def lp(x, fc, order=2):
    fc = min(fc, SR * 0.45)
    return signal.sosfilt(signal.butter(order, fc, "lowpass", fs=SR, output="sos"), x)


def hp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, "highpass", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, min(hi, SR * 0.45)], "bandpass", fs=SR, output="sos"), x)


def sweep_bp(x, f_curve, q=1.4, block=256):
    """Band-pass with a time-varying centre frequency (block-wise biquad, state carried)."""
    y = np.zeros_like(x)
    zi = np.zeros(2)
    for i in range(0, len(x), block):
        fc = float(np.clip(f_curve[min(i, len(f_curve) - 1)], 40, SR * 0.42))
        w0 = 2 * np.pi * fc / SR
        alpha = np.sin(w0) / (2 * q)
        b = np.array([alpha, 0, -alpha]) / (1 + alpha)
        a = np.array([1, -2 * np.cos(w0) / (1 + alpha), (1 - alpha) / (1 + alpha)])
        y[i:i + block], zi = signal.lfilter(b, a, x[i:i + block], zi=zi)
    return y


def noise(n):
    return RNG.standard_normal(n)


def pink(n):
    w = noise(n)
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, w) * 8


class Bus:
    def __init__(self, seconds):
        self.n = int(seconds * SR)
        self.buf = np.zeros((2, self.n))

    def add(self, x, t0, gain=1.0, pan=0.0):
        """Add mono (n,) or stereo (2,n) signal at time t0 with equal-power pan."""
        i = int(round(t0 * SR))
        if x.ndim == 1:
            p = (pan + 1) * np.pi / 4
            x = np.vstack([x * np.cos(p), x * np.sin(p)])
        if i < 0:
            x = x[:, -i:]
            i = 0
        j = min(self.n, i + x.shape[1])
        if j > i:
            self.buf[:, i:j] += gain * x[:, : j - i]


def db(g):
    return 10 ** (g / 20)


# ----------------------------------------------------------------------------- music
CHORDS = {
    "Bm": {"pad": [50, 54, 59, 62], "root": 35, "arp": [71, 74, 78, 83]},
    "G":  {"pad": [50, 55, 59, 62], "root": 31, "arp": [67, 71, 74, 79]},
    "D":  {"pad": [50, 54, 57, 62], "root": 38, "arp": [69, 74, 78, 81]},
    "A":  {"pad": [49, 52, 57, 61], "root": 33, "arp": [69, 73, 76, 81]},
}
LEAD_MOTIF = [(0.0, 78, 1.0), (1.5, 81, 0.5), (3.0, 83, 1.0), (4.0, 81, 1.0), (5.5, 78, 0.5), (6.0, 76, 2.0)]


def build_music(tl):
    meta = tl["meta"]
    beat, bar = meta["beatSec"], meta["barSec"]
    total = meta["durationSec"] + 4
    music = tl["music"]
    prog = music["progression"]
    sections = music["sections"]

    pad, bass, arp, drums, lead, air = (Bus(total) for _ in range(6))
    kick_times = []

    def section_at(b):
        for s in sections:
            if s["bars"][0] <= b < s["bars"][1]:
                return s
        return sections[-1]

    act_downbeats = {16, 32, 52, 64, 80}
    drop_bars = {15, 31, 47, 63, 79}

    for b in range(96):
        s = section_at(b)
        layers, energy = set(s["layers"]), s["energy"]
        chord = CHORDS[prog[(b // 2) % 4]]
        t_bar = b * bar

        # ---- pads (one event per 2-bar chord)
        if b % 2 == 0 and ({"pad", "pad_dark"} & layers):
            dur = 2 * bar + 1.4
            n = int(dur * SR)
            dark = "pad_dark" in layers
            notes = chord["pad"][:3] if dark else chord["pad"]
            sig = np.zeros((2, n))
            for k, m in enumerate(notes):
                f = midi(m)
                for dc, pan in ((-7, -0.7), (0, 0.0), (7, 0.7)):
                    v = saw(f, n, dc, phase=RNG.random())
                    p = (pan + 1) * np.pi / 4
                    sig[0] += v * np.cos(p)
                    sig[1] += v * np.sin(p)
            fc = 520 if dark else 700 + 2600 * energy
            sig = np.vstack([hp(lp(sig[0], fc), 140), hp(lp(sig[1], fc), 140)])
            e = env_adsr(n, 0.55, 1.5, 0.82, 1.4)
            pad.add(sig * e, t_bar, gain=0.055 if not dark else 0.06)
        if b == 92:
            # final open D-major chord, long and soft
            dur = 4 * bar + 3.5
            n = int(dur * SR)
            sig = np.zeros((2, n))
            for m in (38, 45, 50, 54, 57, 62, 66):
                for dc, pan in ((-6, -0.6), (6, 0.6)):
                    v = saw(midi(m), n, dc, phase=RNG.random())
                    p = (pan + 1) * np.pi / 4
                    sig[0] += v * np.cos(p)
                    sig[1] += v * np.sin(p)
            fc_curve = 2400
            sig = np.vstack([lp(sig[0], fc_curve), lp(sig[1], fc_curve)])
            e = env_adsr(n, 0.25, 3.0, 0.6, 4.2)
            pad.add(sig * e, t_bar, gain=0.05)

        # ---- sub drone
        if "sub" in layers and b % 2 == 0:
            root = 38 if b >= 92 else chord["root"]
            dur = (4 if b >= 92 else 2) * bar + 0.8
            n = int(dur * SR)
            v = sine(midi(root + 12 if root < 33 else root), n)
            bass.add(v * env_adsr(n, 0.4, 2.0, 0.9, 0.8), t_bar, gain=0.09)

        # ---- pulsing bass (8ths)
        if "bass" in layers:
            for k in range(8):
                t = t_bar + k * beat / 2
                m = chord["root"] + (12 if k in (2, 5, 7) else 0)
                n = int(0.24 * SR)
                f = midi(m + 12)
                v = 0.6 * saw(f, n) + 0.8 * sine(f / 2, n)
                v = lp(v, 380 + 500 * energy) * env_exp(n, 0.11, 0.004)
                bass.add(v, t, gain=0.14)

        # ---- arpeggio (16ths, up-down)
        if {"arp", "arp_filtered"} & layers:
            filtered = "arp_filtered" in layers and "arp" not in layers
            order = [0, 1, 2, 3, 2, 1, 2, 3]
            for k in range(16):
                t = t_bar + k * beat / 4
                m = chord["arp"][order[(b * 16 + k) % 8]]
                n = int(0.32 * SR)
                f = midi(m)
                v = 0.55 * saw(f, n) + 0.45 * sine(f, n)
                bright = 900 if filtered else 1800 + 3000 * energy
                v = lp(v, bright) * env_exp(n, 0.13, 0.002)
                vel = 1.0 if k % 4 == 0 else 0.72
                arp.add(v, t, gain=(0.035 if filtered else 0.05) * vel, pan=0.35 * np.sin(k * 0.9))

        # ---- drums
        drop = b in drop_bars
        if "kick" in layers or "kick_soft" in layers:
            soft = "kick" not in layers
            beats = (0, 2) if soft else (0, 1, 2, 3)
            for k in beats:
                if drop and k >= 2:
                    continue
                t = t_bar + k * beat
                n = int(0.42 * SR)
                tt = np.arange(n) / SR
                f = 46 + 95 * np.exp(-tt / 0.045)
                ph = 2 * np.pi * np.cumsum(f) / SR
                v = np.sin(ph) * env_exp(n, 0.17, 0.001)
                v += 0.25 * hp(noise(n), 3000) * env_exp(n, 0.004)
                drums.add(np.tanh(1.6 * v), t, gain=0.22 if soft else 0.30)
                kick_times.append(t)
        if "clap" in layers:
            for k in (1, 3):
                if drop and k == 3:
                    continue
                t = t_bar + k * beat
                n = int(0.3 * SR)
                nz = bp(noise(n), 900, 2600)
                e = np.zeros(n)
                for off in (0.0, 0.011, 0.022):
                    i = int(off * SR)
                    e[i:] += env_exp(n - i, 0.012 if off < 0.02 else 0.11)
                drums.add(nz * e, t, gain=0.10, pan=0.05)
        if "hats" in layers:
            for k in range(16):
                if drop and k >= 8:
                    continue
                t = t_bar + k * beat / 4
                open_hat = k % 4 == 2
                n = int((0.16 if open_hat else 0.05) * SR)
                v = hp(noise(n), 7500) * env_exp(n, 0.07 if open_hat else 0.014)
                vel = [0.55, 0.25, 0.9, 0.3][k % 4]
                drums.add(v, t, gain=0.05 * vel * (0.6 + 0.6 * energy), pan=0.25)
        if b in act_downbeats:
            n = int(2.2 * SR)
            v = hp(noise(n), 4200) * env_exp(n, 0.55, 0.003)
            drums.add(np.vstack([v, np.roll(v, 240)]), t_bar, gain=0.07)

        # ---- lead bell motif
        if "lead" in layers and b % 2 == 0:
            for off, m, length in LEAD_MOTIF:
                t = t_bar + off * beat
                n = int((length * beat + 0.9) * SR)
                f = midi(m)
                tt = np.arange(n) / SR
                index = 2.2 * np.exp(-tt / 0.25)
                v = np.sin(2 * np.pi * f * tt + index * np.sin(2 * np.pi * 3.5 * f * tt))
                lead.add(v * env_exp(n, 0.55, 0.004), t, gain=0.05, pan=-0.2)

        # ---- shimmer / air
        if "shimmer" in layers and b % 2 == 0:
            dur = 2 * bar + 1.0
            n = int(dur * SR)
            sig = np.zeros(n)
            for m in chord["arp"][1:]:
                sig += sine(midi(m + 12), n, RNG.random()) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.5 * np.arange(n) / SR + m))
            sig += 0.3 * hp(pink(n), 6000)
            air.add(sig * env_adsr(n, 0.9, 2.0, 0.8, 1.0), t_bar, gain=0.012, pan=0.0)

    # sidechain pump on bass/pad from the kick
    pump = np.ones(bass.n)
    for t in kick_times:
        i = int(t * SR)
        n = int(0.32 * SR)
        j = min(bass.n, i + n)
        curve = 1 - 0.55 * np.exp(-np.arange(j - i) / SR / 0.09)
        pump[i:j] = np.minimum(pump[i:j], curve)
    bass.buf *= pump
    pad.buf *= 0.6 + 0.4 * pump

    # delay on arp + lead (dotted eighth, ping-pong)
    d = int(beat * 0.75 * SR)
    for bus, fb, mix in ((arp, 0.38, 0.45), (lead, 0.42, 0.5)):
        wet = np.zeros_like(bus.buf)
        src = bus.buf.copy()
        for k in range(1, 6):
            shift = d * k
            ch = k % 2
            wet[ch, shift:] += (fb ** k) * src[(1 - ch), :-shift] if shift < bus.n else 0
        bus.buf += mix * wet

    dry = pad.buf + bass.buf + arp.buf + drums.buf + lead.buf + air.buf
    send = 0.55 * pad.buf + 0.6 * arp.buf + 0.7 * lead.buf + 0.25 * drums.buf + 0.8 * air.buf
    wet = reverb(send, 2.6)
    mix = dry + 0.32 * wet
    # tame the low end: -4 dB shelf below ~90 Hz (keeps the kick, removes boom)
    low = np.vstack([lp(mix[0], 90), lp(mix[1], 90)])
    mix = mix - (1 - db(-4)) * low

    # fade the tail to silence by 180 s
    n180 = int(meta["durationSec"] * SR)
    fade = np.ones(mix.shape[1])
    i0 = int((meta["durationSec"] - 3.0) * SR)
    fade[i0:n180] = np.linspace(1, 0, n180 - i0) ** 1.5
    fade[n180:] = 0
    return mix * fade


def reverb(x, rt60):
    n = int(rt60 * SR)
    t = np.arange(n) / SR
    irs = []
    for ch in range(2):
        nz = noise(n) * np.exp(-6.9 * t / rt60)
        nz = lp(nz, 6500)
        nz[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
        irs.append(nz / np.sqrt(np.sum(nz ** 2)))
    return np.vstack([signal.fftconvolve(x[ch], irs[ch])[: x.shape[1]] for ch in range(2)])


# ----------------------------------------------------------------------------- sfx
def sfx_click(pitch=1.0):
    n = int(0.08 * SR)
    v = sine(2300 * pitch, n) * env_exp(n, 0.009, 0.0005)
    v += 0.6 * sine(950 * pitch, n) * env_exp(n, 0.02, 0.0008)
    v += 0.5 * hp(noise(n), 4000) * env_exp(n, 0.0025, 0.0002)
    return v


def sfx_thump():
    n = int(1.0 * SR)
    tt = np.arange(n) / SR
    f = 36 + 44 * np.exp(-tt / 0.09)
    v = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.32, 0.003)
    v = np.tanh(2.2 * v) * 0.9
    v += 0.3 * lp(noise(n), 260) * env_exp(n, 0.08)
    v += 0.25 * hp(noise(n), 2500) * env_exp(n, 0.003)
    return v


def sfx_whoosh(dur=1.5, lo=260, hi=2900, peak=0.55):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    u = tt / dur
    pk = peak
    f_curve = np.where(u < pk, lo * (hi / lo) ** (u / pk), hi * ((lo * 1.8) / hi) ** ((u - pk) / (1 - pk)))
    body = sweep_bp(pink(n) + 0.4 * noise(n), f_curve, q=1.1)
    amp = np.where(u < pk, (u / pk) ** 2.2, np.exp(-(u - pk) / (1 - pk) * 3.2))
    body *= amp
    # pneumatic release: bright hiss blooming at the peak
    hiss = hp(noise(n), 3500) * np.where(u < pk, 0, np.exp(-(u - pk) * dur / 0.22)) * np.minimum(1, np.maximum(0, (u - pk) * dur / 0.01))
    v = body / (np.max(np.abs(body)) + 1e-9) + 0.35 * hiss
    pan = np.clip(-0.8 + 1.6 * u, -1, 1)
    p = (pan + 1) * np.pi / 4
    return np.vstack([v * np.cos(p), v * np.sin(p)])


def sfx_riser(dur):
    n = int(dur * SR)
    u = np.arange(n) / n
    v = sweep_bp(noise(n), 400 * (15 ** u), q=2.0) * u ** 2.4
    tt = np.arange(n) / SR
    f = 180 * 4 ** u
    v += 0.25 * np.sin(2 * np.pi * np.cumsum(f) / SR) * u ** 3
    v /= np.max(np.abs(v)) + 1e-9
    return np.vstack([v, np.roll(v, 300)])


def sfx_impact():
    n = int(2.0 * SR)
    v = np.zeros(n)
    th = sfx_thump()
    v[: len(th)] += th
    v += 0.35 * hp(noise(n), 3000) * env_exp(n, 0.5, 0.002)
    return v


def sfx_ticks(dur, count=14):
    n = int((dur + 0.1) * SR)
    v = np.zeros(n)
    for k in range(count):
        u = k / (count - 1)
        t = dur * (1 - (1 - u) ** 1.8)  # decelerating, like the counter ease
        c = sfx_click(0.9 + 0.5 * u) * 0.5
        i = int(t * SR)
        j = min(n, i + len(c))
        v[i:j] += c[: j - i]
    return v


def sfx_swoosh():
    return sfx_whoosh(0.55, 900, 5200, 0.6)


def sfx_sting():
    n = int(3.2 * SR)
    v = np.zeros(n)
    th = sfx_thump()
    v[: len(th)] += th
    tt = np.arange(n) / SR
    for k, m in enumerate((74, 78, 81, 86)):
        i = int(k * 0.06 * SR)
        f = midi(m)
        tone = np.sin(2 * np.pi * f * tt[: n - i] + 1.4 * np.exp(-tt[: n - i] / 0.3) * np.sin(2 * np.pi * 3.5 * f * tt[: n - i]))
        v[i:] += 0.22 * tone * env_exp(n - i, 0.9, 0.003)
    return v


def sfx_build(dur):
    n = int(dur * SR)
    u = np.arange(n) / n
    rumble = lp(noise(n), 140) * 3
    tone = np.sin(2 * np.pi * np.cumsum(70 + 50 * u) / SR)
    env = np.sin(np.pi * u) ** 1.2
    return (rumble + 0.4 * tone) * env


def sfx_hiss(dur):
    n = int(dur * SR)
    u = np.arange(n) / n
    return bp(noise(n), 2500, 9000) * np.sin(np.pi * u) ** 2


def sfx_steam(dur):
    n = int(dur * SR)
    v = np.zeros(n)
    for k in range(3):
        i = int(k * 0.55 * SR)
        m = n - i
        v[i:] += bp(noise(m), 900, 5000) * env_exp(m, 0.35, 0.03)
    return v


def build_sfx(tl):
    total = tl["meta"]["durationSec"] + 4
    bus = Bus(total)
    for c in tl["sfx"]:
        t, kind = c["at"], c["type"]
        if kind == "click":
            bus.add(sfx_click(1.0 + 0.08 * RNG.standard_normal()), t, gain=db(-17), pan=0.15 * RNG.standard_normal())
        elif kind == "thump":
            bus.add(sfx_thump(), t, gain=db(-7))
        elif kind == "whoosh":
            bus.add(sfx_whoosh(), t - 0.55 * 1.5 + 0.1, gain=db(-15))
        elif kind == "swoosh":
            bus.add(sfx_swoosh(), t - 0.3, gain=db(-22))
        elif kind == "riser":
            bus.add(sfx_riser(c["dur"]), t, gain=db(-21))
        elif kind == "impact":
            bus.add(sfx_impact(), t, gain=db(-9))
        elif kind == "ticks":
            bus.add(sfx_ticks(c["dur"]), t, gain=db(-15))
        elif kind == "sting":
            bus.add(sfx_sting(), t, gain=db(-8))
        elif kind == "rise_build":
            bus.add(sfx_build(c["dur"]), t, gain=db(-20))
        elif kind == "hiss":
            bus.add(sfx_hiss(c["dur"]), t, gain=db(-27), pan=-0.2)
        elif kind == "steam":
            bus.add(sfx_steam(c["dur"]), t, gain=db(-24), pan=0.3)
        else:
            raise SystemExit(f"unknown sfx type {kind}")
    return bus.buf


# ----------------------------------------------------------------------------- vo + mix
def build_vo(tl):
    total = tl["meta"]["durationSec"] + 4
    bus = Bus(total)
    for line in tl["narration"]:
        sr, x = wavfile.read(os.path.join(BUILD, "vo", line["id"] + ".wav"))
        assert sr == SR
        bus.add(x.astype(np.float64), line["start"])
    # short room tone so the synthetic voice sits in the mix
    room = reverb(bus.buf, 0.6)
    return bus.buf + 0.07 * room


def duck_curve(vo):
    mono = np.abs(vo).mean(axis=0)
    a = np.exp(-1 / (0.03 * SR))
    env = np.sqrt(signal.lfilter([1 - a], [1, -a], mono ** 2))
    active = (env > db(-40)).astype(float)
    # smooth: fast attack (80 ms), slow release (450 ms)
    out = np.zeros_like(active)
    att, rel = np.exp(-1 / (0.08 * SR)), np.exp(-1 / (0.45 * SR))
    level = 0.0
    # vectorised in blocks for speed
    for i in range(0, len(active), 480):
        target = active[i:i + 480].max()
        coef = att if target > level else rel
        level = target + (level - target) * coef ** 480
        out[i:i + 480] = level
    return out


def write(path, x):
    wavfile.write(path, SR, x.T.astype(np.float32))


def loudnorm(src, dst, lufs=-14.0, tp=-1.6):
    probe = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-af",
                            f"loudnorm=I={lufs}:TP={tp}:LRA=11:print_format=json", "-f", "null", "-"],
                           capture_output=True, text=True).stderr
    js = json.loads(probe[probe.rindex("{"):probe.rindex("}") + 1])
    af = (f"loudnorm=I={lufs}:TP={tp}:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:"
          f"measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:"
          f"linear=true,aresample=48000")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-af", af, "-t", "180", "-c:a", "pcm_s24le", dst],
                   check=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    tl = load_json("timeline.resolved.json")
    n = int(tl["meta"]["durationSec"] * SR)
    print("music…")
    music = build_music(tl)[:, :n]
    print("sfx…")
    sfx = build_sfx(tl)[:, :n]
    print("vo…")
    vo = build_vo(tl)[:, :n]
    write(os.path.join(OUT, "music.wav"), music)
    write(os.path.join(OUT, "sfx.wav"), sfx)
    write(os.path.join(OUT, "vo.wav"), vo)

    duck = duck_curve(vo)
    music_ducked = music * (1 - 0.66 * duck)
    narrated = 1.0 * vo + 0.5 * music_ducked + 0.6 * sfx
    music_only = 0.8 * music + 0.7 * sfx
    for name, x in (("narrated", narrated), ("music_only", music_only)):
        x = np.tanh(x * 1.1) / 1.1
        tmp = os.path.join(OUT, f"_pre_{name}.wav")
        write(tmp, x)
        loudnorm(tmp, os.path.join(OUT, f"mix_{name}.wav"))
        os.remove(tmp)
        print(f"wrote mix_{name}.wav")


if __name__ == "__main__":
    main()
