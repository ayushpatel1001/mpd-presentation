// Mehidpurwala logo sting — "हम फर्नीचर बनाते हैं... दिल से." — 5 s, 1920×1080 Canvas 2D.
// Every frame is a pure function of t (window.renderFrame(t)), so the renderer can capture frames in
// any order and the live preview (index.html) can follow the music's clock.
//
// Story: the heart beats in → the ribbon unfurls from it into the M → wordmark, ®, "Since 1885" →
// the tagline is written out, and on "दिल से." the heart winks (its right hump squeezes shut like an
// eyelid and springs back) with a sparkle.

const W = 1920, H = 1080;
const RED = [237, 46, 51], INK = [17, 17, 17];
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const ease = {
  outCubic: (x) => 1 - (1 - x) ** 3,
  outQuint: (x) => 1 - (1 - x) ** 5,
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  outBack: (x, s = 1.70158) => 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2,
};

// --------------------------------------------------------------------------- geometry
let TL, G, P, TXT, CAM;

// polyline with cumulative length, for drawing a path up to a fraction of its length
function poly(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] };
}
function at(pl, u) {
  const s = clamp(u) * pl.len;
  let i = 1;
  while (i < pl.cum.length - 1 && pl.cum[i] < s) i++;
  const a = pl.pts[i - 1], b = pl.pts[i], f = (s - pl.cum[i - 1]) / Math.max(pl.cum[i] - pl.cum[i - 1], 1e-9);
  return { x: lerp(a[0], b[0], f), y: lerp(a[1], b[1], f), i };
}
function partial(pl, u, map) {
  const p = new Path2D(), e = at(pl, u);
  p.moveTo(...map(pl.pts[0]));
  for (let i = 1; i < e.i; i++) p.lineTo(...map(pl.pts[i]));
  p.lineTo(...map([e.x, e.y]));
  return p;
}
// Chaikin corner cutting (endpoints kept)
function chaikin(pts, n = 3) {
  for (let k = 0; k < n; k++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}
// Catmull-Rom through control points → dense polyline
function smooth(ctrl, per = 16) {
  const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(i - 1, 0)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(i + 2, ctrl.length - 1)];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

// paths the ribbon reveal sweeps along (source-image px): from inside each heart lobe outwards
const SWEEP_L = smooth([[205, 60], [172, 92], [138, 128], [112, 166], [101, 204], [114, 238], [148, 258], [196, 250], [246, 232], [302, 204]]);
const SWEEP_R = smooth([[352, 72], [366, 100], [395, 122], [428, 150], [458, 175], [478, 192]]);
// the wink: the right hump folds down towards this line (source px), centred on the hump's crest
// a flat-topped weight across the hump (cosine shoulders) so the crest flattens evenly and blends
// into the cleft on one side and the band's straight edge on the other
const WINK = { pivot: 98, top: 36, x0: 292, x1: 388, fadeL: 24, fadeR: 46, depth: 0.8 };
function winkWeight(x) {
  const up = clamp((x - (WINK.x0 - WINK.fadeL)) / WINK.fadeL), down = clamp(((WINK.x1 + WINK.fadeR) - x) / WINK.fadeR);
  return ease.inOutSine(up) * ease.inOutSine(down);
}

async function load() {
  const j = (f) => fetch(f, { cache: 'no-store' }).then((r) => r.json());
  [TL, G, TXT] = await Promise.all([j('timeline.json'), j('trace/mark.json'), j('trace/text.json')]);
  P = {
    outline: new Path2D(G.outline), foldL: new Path2D(G.foldL), foldR: new Path2D(G.foldR), heart: new Path2D(G.heartClip),
    sweepL: poly(SWEEP_L), sweepR: poly(SWEEP_R),
  };
  const sil = [...chaikin(G.heartLeft), ...chaikin(G.heartRight).reverse()];
  const hx = sil.map((p) => p[0]), hy = sil.map((p) => p[1]);
  P.heartC = [(Math.min(...hx) + Math.max(...hx)) / 2, (Math.min(...hy) + Math.max(...hy)) / 2];
  // lettering: potrace units → source px via this matrix
  const u = TXT.unit, glyph = (g) => ({ path: new Path2D(g.d), box: g.box, cx: (g.box[0] + g.box[2]) / 2, cy: (g.box[1] + g.box[3]) / 2 });
  P.textM = [u, 0, 0, -u, 0, TXT.height * u];
  P.word = TXT.parts.word.map(glyph);
  P.reg = glyph(TXT.parts.reg);
  P.since = TXT.parts.since.map(glyph);
  P.tag = TXT.parts.tag.map(glyph);
  // final framing: whole lockup centred, ~800 px tall
  const xs = [G.box[0], G.box[2], P.reg.box[2], ...P.tag.map((g) => g.box[0])], ys = [G.box[1], ...P.tag.map((g) => g.box[3])];
  CAM = { k0: 2.7, k1: 1.7, c1: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2] };
}

// --------------------------------------------------------------------------- layers
const layers = {};
function layer(name) {
  let c = layers[name];
  if (!c) { c = layers[name] = document.createElement('canvas'); c.width = W; c.height = H; c.ctx = c.getContext('2d'); }
  const g = c.ctx;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; g.shadowColor = 'transparent';
  g.clearRect(0, 0, W, H);
  return c;
}

// camera: source px → screen px. Opens close on the heart, pulls back to the full lockup.
function camera(t) {
  const e = ease.inOutCubic(prog(t, TL.camera[0], TL.camera[1]));
  const hold = 1 + 0.02 * ease.inOutSine(prog(t, TL.camera[1], TL.duration));   // a slow breath on the lockup
  const s = Math.exp(lerp(Math.log(CAM.k0), Math.log(CAM.k1), e)) * hold;
  const f = [lerp(P.heartC[0], CAM.c1[0], e), lerp(P.heartC[1], CAM.c1[1], e)];
  const m = [s, 0, 0, s, W / 2 - f[0] * s, H / 2 - f[1] * s];
  return { s, m, map: (p) => [p[0] * s + m[4], p[1] * s + m[5]] };
}

// heartbeat envelope: fast attack, soft decay; lub + quieter dub
const thump = (x) => (x < 0 ? 0 : x < 0.045 ? x / 0.045 : Math.exp(-(x - 0.045) / 0.15));
const beat = (t, at) => thump(t - at) + 0.6 * thump(t - at - TL.dub);

// wink: 0 open … 1 shut. Closes fast, holds a beat, springs open with a little overshoot.
function wink(t) {
  const x = t - TL.wink;
  if (x < 0) return 0;
  if (x < 0.08) return (x / 0.08) ** 2;
  if (x < 0.15) return 1;
  if (x < 0.45) return 1 - ease.outBack((x - 0.15) / 0.3, 2.4);
  return 0;
}

// --------------------------------------------------------------------------- drawing
function fillMark(g) {
  g.fillStyle = rgb(RED);
  g.fill(P.outline);
  g.globalCompositeOperation = 'destination-out';
  g.fill(P.foldL); g.fill(P.foldR);
  g.globalCompositeOperation = 'source-over';
}

function background(g) {
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  const vg = g.createRadialGradient(W / 2, H / 2, 380, W / 2, H / 2, 1180);
  vg.addColorStop(0, 'rgba(120,80,80,0)'); vg.addColorStop(1, 'rgba(120,80,80,0.07)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
}

// four-pointed glint
function sparkle(g, x, y, r, rot, alpha) {
  if (r < 0.5 || alpha <= 0) return;
  g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = alpha;
  const star = new Path2D(), k = 0.16;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2, b = a + Math.PI / 4;
    star[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    star.quadraticCurveTo(Math.cos(b) * r * k, Math.sin(b) * r * k, Math.cos(a + Math.PI / 2) * r, Math.sin(a + Math.PI / 2) * r);
  }
  g.shadowColor = rgb(RED, 0.55); g.shadowBlur = r * 0.9;
  g.fillStyle = rgb(RED); g.fill(star);
  g.restore();
}

// the red mark: heart beats in, ribbon unfurls from it, sheen, wink
function mark(g, t, cam) {
  const pop = prog(t, TL.heartIn[0], TL.heartIn[1]);
  if (pop <= 0) return;
  const M = layer('mark'), m = M.ctx;
  const uL = ease.inOutCubic(prog(t, TL.ribbonL[0], TL.ribbonL[1])), uR = ease.inOutCubic(prog(t, TL.ribbonR[0], TL.ribbonR[1]));

  // ribbons: the whole mark, revealed through a soft-edged stroke growing along each sweep path
  if (uL > 0 || uR > 0) {
    const R = layer('ribbon'), r = R.ctx;
    r.setTransform(...cam.m); fillMark(r);
    if (uL < 1 || uR < 1) {
      const K = layer('mask'), k = K.ctx;
      k.lineCap = 'round'; k.lineJoin = 'round'; k.strokeStyle = '#000'; k.lineWidth = 132 * cam.s; k.filter = `blur(${(5 * cam.s).toFixed(1)}px)`;
      if (uL > 0) k.stroke(partial(P.sweepL, uL, cam.map));
      if (uR > 0) k.stroke(partial(P.sweepR, uR, cam.map));
      r.setTransform(1, 0, 0, 1, 0, 0);
      r.globalCompositeOperation = 'destination-in'; r.drawImage(K, 0, 0);
      // a shadowed fold travels with the leading edge, as if the ribbon were still curling over
      r.globalCompositeOperation = 'source-atop';
      for (const [pl, u] of [[P.sweepL, uL], [P.sweepR, uR]]) {
        if (u <= 0 || u >= 1) continue;
        const h = at(pl, u), [x, y] = cam.map([h.x, h.y]), rad = 75 * cam.s, a = Math.sin(Math.PI * u) * 0.55;
        const sg = r.createRadialGradient(x, y, 0, x, y, rad);
        sg.addColorStop(0, `rgba(110,0,12,${a})`); sg.addColorStop(0.6, `rgba(150,10,20,${a * 0.4})`); sg.addColorStop(1, 'rgba(150,10,20,0)');
        r.fillStyle = sg; r.fillRect(x - rad, y - rad, 2 * rad, 2 * rad);
      }
    }
    m.drawImage(R, 0, 0);
  }

  // the heart: springs in on the lub, swells again on the dub
  const sc = ease.outBack(pop, 2.2) * (1 + 0.07 * beat(t, TL.heartbeats[0]));
  const Hh = layer('heart'), h = Hh.ctx;
  const [cx, cy] = P.heartC;
  h.setTransform(...cam.m); h.translate(cx, cy + 40); h.scale(sc, sc); h.translate(-cx, -cy - 40);
  h.save(); h.clip(P.heart); fillMark(h); h.restore();
  m.globalAlpha = Math.min(1, pop * 4);
  m.drawImage(Hh, 0, 0);
  m.globalAlpha = 1;

  // a light sheen across the finished mark
  const u = ease.inOutSine(prog(t, TL.sheen[0], TL.sheen[1]));
  if (u > 0 && u < 1) {
    m.globalCompositeOperation = 'source-atop';
    const [bx0, by0] = cam.map([G.box[0] - 90, G.box[1]]), [bx1] = cam.map([G.box[2] + 90, G.box[3]]);
    const x = lerp(bx0, bx1, u), w = 150;
    const sg = m.createLinearGradient(x - w, by0, x + w * 0.6, by0 + w * 1.4);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.4)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    m.fillStyle = sg; m.fillRect(0, 0, W, H);
    m.globalCompositeOperation = 'source-over';
  }

  // depth while it builds, flat brand mark once it settles
  const sh = prog(t, TL.heartIn[0], TL.heartIn[1]) * (1 - prog(t, TL.ribbonL[1], TL.word[0] + 0.5));
  if (sh > 0.01) { g.shadowColor = `rgba(90,0,10,${0.2 * sh})`; g.shadowBlur = 46; g.shadowOffsetY = 20; }

  const w = wink(t);
  if (Math.abs(w) < 0.002) {
    g.drawImage(M, 0, 0);
  } else {
    // the wink: above the pivot line each 1-px column of the mark is squashed down towards it,
    // fully across the right hump, easing out to either side — the hump closes like an eyelid
    const yp = Math.round(cam.map([0, WINK.pivot])[1]), yt = Math.floor(cam.map([0, WINK.top])[1]), hgt = yp - yt;
    g.drawImage(M, 0, yp, W, H - yp, 0, yp, W, H - yp);
    const [x0] = cam.map([G.box[0] - 4, 0]), [x1] = cam.map([G.box[2] + 4, 0]);
    for (let x = Math.floor(x0); x < x1; x++) {
      const xs = (x + 0.5 - cam.m[4]) / cam.s;
      const k = 1 - WINK.depth * w * winkWeight(xs);
      g.drawImage(M, x, yt, 1, hgt, x, yp - hgt * k, 1, hgt * k);
    }
  }
  g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;

  // sparkles as the eye springs open
  for (const [dt, sx, sy, size] of [[0.1, 384, 38, 46], [0.2, 410, 62, 24]]) {
    const v = prog(t, TL.wink + dt, TL.wink + dt + 0.5);
    if (v <= 0 || v >= 1) continue;
    const [x, y] = cam.map([sx, sy]);
    sparkle(g, x, y, size * cam.s / 1.7 * Math.sin(Math.PI * v) ** 0.6, v * Math.PI * 0.5, 1);
  }
}

function glyph(g, cam, gl, color, { dx = 0, dy = 0, scale = 1, alpha = 1, blur = 0 } = {}) {
  if (alpha <= 0.003) return;
  g.save();
  g.setTransform(...cam.m);
  g.translate(gl.cx + dx, gl.cy + dy); g.scale(scale, scale); g.translate(-gl.cx, -gl.cy);
  g.transform(...P.textM);
  g.globalAlpha = alpha;
  if (blur > 0.25) g.filter = `blur(${blur.toFixed(2)}px)`;
  g.fillStyle = color;
  g.fill(gl.path);
  g.restore();
}

function lettering(g, t, cam) {
  // wordmark: each letter rises from behind its baseline
  const [w0, ws, wd] = TL.word;
  g.save(); g.setTransform(...cam.m);
  g.beginPath(); g.rect(-50, 300, 700, 105.5); g.clip();
  P.word.forEach((gl, i) => {
    const e = ease.outQuint(prog(t, w0 + i * ws, w0 + i * ws + wd));
    glyph(g, cam, gl, rgb(INK), { dy: (1 - e) * 82, alpha: Math.min(1, e * 2.2), blur: (1 - e) * 5 });
  });
  g.restore();
  const r = prog(t, TL.reg, TL.reg + 0.4);
  glyph(g, cam, P.reg, rgb(INK), { scale: ease.outBack(r), alpha: Math.min(1, r * 3) });

  // Since 1885: letter-spacing settles in
  const [s0, ss, sd] = TL.since, mid = (P.since[0].cx + P.since[P.since.length - 1].cx) / 2;
  P.since.forEach((gl, i) => {
    const e = ease.outCubic(prog(t, s0 + i * ss, s0 + i * ss + sd));
    glyph(g, cam, gl, rgb(INK), { dx: (gl.cx - mid) * 0.5 * (1 - e), alpha: e, blur: (1 - e) * 6 });
  });

  // tagline, written left to right with a soft pen edge; the ellipsis taps in dot by dot
  const part = (glyphs, u, x0, x1, color, glowA) => {
    if (u <= 0) return;
    const L = layer('tag'), q = L.ctx;
    glyphs.forEach((gl) => glyph(q, cam, gl, color));
    if (u < 1) {
      const xr = cam.map([lerp(x0, x1, u), 0])[0], f = 26 * cam.s;
      const mg = q.createLinearGradient(xr - f, 0, xr, 0);
      mg.addColorStop(0, '#000'); mg.addColorStop(1, 'rgba(0,0,0,0)');
      q.globalCompositeOperation = 'destination-in'; q.setTransform(1, 0, 0, 1, 0, 0); q.fillStyle = mg; q.fillRect(0, 0, W, H);
    }
    if (glowA > 0.01) { g.shadowColor = rgb(RED, glowA); g.shadowBlur = 24; }
    g.drawImage(L, 0, 0);
    g.shadowColor = 'transparent'; g.shadowBlur = 0;
  };
  const t1 = ease.inOutSine(prog(t, TL.tag1[0], TL.tag1[1]));
  part(P.tag.slice(0, 4), t1, P.tag[0].box[0] - 30, P.tag[3].box[2] + 4, rgb(INK), 0);
  [4, 5].forEach((i, k) => {
    const e = prog(t, TL.dots[k], TL.dots[k] + 0.22);
    glyph(g, cam, P.tag[i], rgb(INK), { scale: ease.outBack(e), alpha: Math.min(1, e * 3) });
  });
  // "दिल से." warms to brand red as the heart winks, then settles back
  const fx = t - TL.wink, flash = fx < 0 ? 0 : fx < 0.08 ? fx / 0.08 : Math.exp(-(fx - 0.08) / 0.45);
  const t2 = ease.inOutSine(prog(t, TL.tag2[0], TL.tag2[1]));
  part(P.tag.slice(6), t2, P.tag[6].box[0] - 20, P.tag[7].box[2] + 4, rgb(INK.map((c, i) => lerp(c, RED[i], flash))), 0.5 * flash);
}

function renderFrame(t) {
  const g = window.ctx;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  const cam = camera(t);
  background(g);
  mark(g, t, cam);
  lettering(g, t, cam);
  return { t };
}

window.renderFrame = renderFrame;
window.boot = async (canvas) => {
  window.ctx = canvas.getContext('2d');
  await load();
  window.TL = TL;
};
