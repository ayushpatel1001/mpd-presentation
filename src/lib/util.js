// Deterministic math helpers shared by the scene and the HUD.
// Everything is a pure function of time so any frame can be rendered in isolation.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const inv = (a, b, x) => clamp((x - a) / (b - a));

export const ease = {
  linear: (t) => t,
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};

// Keyframes [[t, v], ...] with smoothstep blending between neighbours.
export function keyframes(kf, t) {
  if (!kf || kf.length === 0) return 0;
  if (t <= kf[0][0]) return kf[0][1];
  for (let i = 0; i < kf.length - 1; i++) {
    const [t0, v0] = kf[i], [t1, v1] = kf[i + 1];
    if (t <= t1) return lerp(v0, v1, smooth((t - t0) / Math.max(1e-6, t1 - t0)));
  }
  return kf[kf.length - 1][1];
}

// Highest value the keyframed channel has reached up to time t (used for "reveal" progress).
export function keyframesMax(kf, t) {
  let m = keyframes(kf, t);
  for (const [tk, vk] of kf) if (tk <= t) m = Math.max(m, vk);
  return m;
}

// On-screen envelope for an overlay: 0 → 1 over `fin` after tin, 1 → 0 over `fout` before tout.
export function envelope(t, tin, tout, fin = 0.45, fout = 0.35) {
  if (t < tin || t > tout) return 0;
  return Math.min(clamp((t - tin) / fin), clamp((tout - t) / fout));
}

export function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const deg = (d) => (d * Math.PI) / 180;
