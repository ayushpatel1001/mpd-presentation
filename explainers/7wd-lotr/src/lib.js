// Drawing toolkit: palette, easing, paper texture, Vox-style marks (highlighter, arrows, stamps) and icons.
// Everything is a pure function of its arguments so any frame can be drawn in any order.
'use strict';

const W = 1920, H = 1080;
const C = {
  paper: '#EFE9DB', paper2: '#E4DCC8', ink: '#1C1B19', ink2: '#5A564D', ink3: '#8C877B',
  yellow: '#FFD21F', fell: '#1E7A8C', fellL: '#7CC3CF', saur: '#A3221B', saurL: '#E58A7F',
  grey: '#8A8983', ycard: '#E0A92A', blue: '#2F68C4', green: '#3C8C46', red: '#C63A2E', purple: '#7A4A9E',
  brown: '#8B5A2B', gold: '#C9A227', white: '#FFFDF7', parch: '#E9DDBF', parch2: '#D9C9A0',
};
const DISPLAY = '"Oswald", "Arial Narrow", sans-serif';
const BODY = '"Manrope", "Helvetica Neue", Arial, sans-serif';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOut = (k) => 1 - Math.pow(1 - clamp(k), 3);
const easeInOut = (k) => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const easeBack = (k) => { k = clamp(k); const c1 = 1.6, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };

// deterministic pseudo-random
function rnd(seed) { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

// ------------------------------------------------------------------ paper texture (built once)
let PAPER = null;
function buildPaper() {
  PAPER = [0, 1].map((variant) => {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
    const img = g.getImageData(0, 0, W, H), d = img.data;
    let s = 1234 + variant * 999;
    const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = 0; i < d.length; i += 4) {
      const n = (r() - 0.5) * 16;
      d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.9;
    }
    g.putImageData(img, 0, 0);
    g.globalAlpha = 0.05; g.strokeStyle = '#6b5a3a'; g.lineWidth = 1;
    for (let i = 0; i < 260; i++) {           // paper fibres
      const x = r() * W, y = r() * H, a = r() * Math.PI, l = 8 + r() * 30;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + r() * 6, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    g.globalAlpha = 1;
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(60,40,10,0.22)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    return cv;
  });
}
function paper(ctx, t) { ctx.drawImage(PAPER[Math.floor(t * 8) % 2], 0, 0); }   // texture "boils" at 8 fps

// ------------------------------------------------------------------ text
function font(size, weight = 600, family = DISPLAY) { return `${weight} ${size}px ${family}`; }
function text(ctx, s, x, y, o = {}) {
  ctx.save();
  ctx.font = font(o.size || 40, o.weight || 600, o.family || DISPLAY);
  ctx.fillStyle = o.color || C.ink;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.baseline || 'alphabetic';
  if (o.spacing) ctx.letterSpacing = `${o.spacing}px`;
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.fillText(s, x, y);
  ctx.restore();
}
function measure(ctx, s, o = {}) {
  ctx.save(); ctx.font = font(o.size || 40, o.weight || 600, o.family || DISPLAY);
  if (o.spacing) ctx.letterSpacing = `${o.spacing}px`;
  const w = ctx.measureText(s).width; ctx.restore(); return w;
}
// text that types / slides in: k = 0..1
function textIn(ctx, s, x, y, k, o = {}) {
  if (k <= 0) return;
  const e = easeOut(k);
  text(ctx, s, x, y + (1 - e) * 18, { ...o, alpha: (o.alpha ?? 1) * e });
}

// ------------------------------------------------------------------ Vox marks
// highlighter swipe behind a word/box, growing left to right
function highlight(ctx, x, y, w, h, k, color = C.yellow, seed = 1) {
  if (k <= 0) return;
  const e = easeInOut(k), ww = w * e;
  ctx.save();
  ctx.globalAlpha *= 0.92;
  ctx.fillStyle = color;
  ctx.beginPath();
  const j = (i) => (rnd(seed * 31 + i) - 0.5) * h * 0.12;
  ctx.moveTo(x, y + j(1));
  const n = 8;
  for (let i = 1; i <= n; i++) ctx.lineTo(x + ww * i / n, y + j(i + 2));
  ctx.lineTo(x + ww + j(20), y + h + j(21));
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(x + ww * i / n, y + h + j(i + 30));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
// hand-drawn wobbly line from a to b, drawn up to progress k
function scribble(ctx, x1, y1, x2, y2, k, o = {}) {
  if (k <= 0) return;
  const n = 24, e = easeInOut(k), seed = o.seed || 3;
  ctx.save();
  ctx.strokeStyle = o.color || C.ink; ctx.lineWidth = o.width || 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  const bend = o.bend || 0;
  const nx = -(y2 - y1), ny = x2 - x1, nl = Math.hypot(nx, ny) || 1;
  for (let i = 0; i <= n * e; i++) {
    const u = i / n;
    const b = Math.sin(u * Math.PI) * bend;
    const wob = (rnd(seed + i) - 0.5) * (o.wobble ?? 2.5);
    const x = lerp(x1, x2, u) + nx / nl * (b + wob), y = lerp(y1, y2, u) + ny / nl * (b + wob);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}
function arrow(ctx, x1, y1, x2, y2, k, o = {}) {
  if (k <= 0) return;
  scribble(ctx, x1, y1, x2, y2, k, o);
  if (k < 0.85) return;
  const a = Math.atan2(y2 - y1, x2 - x1) - (o.bend ? Math.sign(o.bend) * 0.35 : 0), s = o.head || 22;
  const e = easeOut((k - 0.85) / 0.15);
  ctx.save();
  ctx.strokeStyle = o.color || C.ink; ctx.lineWidth = o.width || 5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x2 - Math.cos(a - 0.5) * s * e, y2 - Math.sin(a - 0.5) * s * e); ctx.lineTo(x2, y2);
  ctx.lineTo(x2 - Math.cos(a + 0.5) * s * e, y2 - Math.sin(a + 0.5) * s * e);
  ctx.stroke(); ctx.restore();
}
// hand-drawn circle around something
function circleMark(ctx, x, y, rx, ry, k, o = {}) {
  if (k <= 0) return;
  const e = easeInOut(k), n = 60, seed = o.seed || 7;
  ctx.save(); ctx.strokeStyle = o.color || C.red; ctx.lineWidth = o.width || 6; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= n * 1.08 * e; i++) {
    const a = -Math.PI * 0.6 + (i / n) * Math.PI * 2;
    const r = 1 + (rnd(seed + i) - 0.5) * 0.04 + i / n * 0.04;
    const px = x + Math.cos(a) * rx * r, py = y + Math.sin(a) * ry * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke(); ctx.restore();
}
// rubber stamp
function stamp(ctx, s, x, y, k, o = {}) {
  if (k <= 0) return;
  const e = easeBack(clamp(k * 1.4)), sc = lerp(2.2, 1, e), a = clamp(k * 3);
  const size = o.size || 64, col = o.color || C.red;
  ctx.save();
  ctx.translate(x, y); ctx.rotate((o.rot ?? -8) * Math.PI / 180); ctx.scale(sc, sc);
  ctx.globalAlpha = a * 0.9;
  ctx.font = font(size, 700); ctx.letterSpacing = `${size * 0.06}px`;
  const w = ctx.measureText(s).width + size * 0.7, h = size * 1.35;
  ctx.strokeStyle = col; ctx.lineWidth = size * 0.08;
  roundRect(ctx, -w / 2, -h / 2, w, h, size * 0.12); ctx.stroke();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(s, 0, size * 0.04);
  ctx.restore();
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// soft drop shadow under a box (cheap: blurred rect)
function shadowBox(ctx, x, y, w, h, r, blur = 18, alpha = 0.22, dy = 8) {
  ctx.save();
  ctx.shadowColor = `rgba(40,25,5,${alpha})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = dy;
  ctx.fillStyle = '#000'; roundRect(ctx, x, y, w, h, r); ctx.fill();
  ctx.restore();
}
// paper cut-out panel
function panel(ctx, x, y, w, h, o = {}) {
  shadowBox(ctx, x, y, w, h, o.r ?? 10, 20, 0.2, 8);
  ctx.save();
  ctx.fillStyle = o.fill || C.white; roundRect(ctx, x, y, w, h, o.r ?? 10); ctx.fill();
  if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lw || 3; ctx.stroke(); }
  ctx.restore();
}

// ------------------------------------------------------------------ game pieces
// a card. o: {color, back, icon(ctx,cx,cy,s), label, cost:[skill names], chain:true, glow, dim}
function card(ctx, x, y, w, h, o = {}) {
  const r = w * 0.07;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.glow) {
    ctx.save(); ctx.shadowColor = `rgba(255,210,31,${0.9 * o.glow})`; ctx.shadowBlur = 34;
    ctx.fillStyle = C.yellow; roundRect(ctx, x - 6, y - 6, w + 12, h + 12, r + 4); ctx.fill(); ctx.restore();
  }
  shadowBox(ctx, x, y, w, h, r, 14, 0.25, 6);
  if (o.back) {
    ctx.fillStyle = '#3B3329'; roundRect(ctx, x, y, w, h, r); ctx.fill();
    ctx.strokeStyle = 'rgba(233,221,191,0.55)'; ctx.lineWidth = Math.max(2, w * 0.025);
    roundRect(ctx, x + w * 0.1, y + w * 0.1, w * 0.8, h - w * 0.2, r * 0.6); ctx.stroke();
    ringIcon(ctx, x + w / 2, y + h / 2, w * 0.18, 'rgba(201,162,39,0.85)', w * 0.035);
  } else {
    ctx.fillStyle = C.white; roundRect(ctx, x, y, w, h, r); ctx.fill();
    ctx.save(); roundRect(ctx, x, y, w, h, r); ctx.clip();
    ctx.fillStyle = o.color || C.grey; ctx.fillRect(x, y, w, h * 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(x, y + h * 0.3, w, h * 0.02);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; roundRect(ctx, x, y, w, h, r); ctx.stroke();
    if (o.icon) o.icon(ctx, x + w / 2, y + h * 0.63, w * 0.26);
    if (o.label) text(ctx, o.label, x + w / 2, y + h * 0.93, { size: Math.round(w * 0.12), weight: 600, color: C.ink2, align: 'center' });
    if (o.chain) chainIcon(ctx, x + w * 0.8, y + h * 0.15, w * 0.11, C.white);
    if (o.cost) o.cost.forEach((c, i) => { coinOrSkill(ctx, x + w * 0.16, y + h * 0.13 + i * w * 0.22, w * 0.09, c); });
  }
  if (o.dim) { ctx.fillStyle = `rgba(239,233,219,${0.55 * o.dim})`; roundRect(ctx, x, y, w, h, r); ctx.fill(); }
  ctx.restore();
}
function coinOrSkill(ctx, x, y, r, c) {
  if (c === 'coin') return coin(ctx, x, y, r);
  ctx.save(); ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(x, y, r * 1.15, 0, 7); ctx.fill();
  ctx.fillStyle = '#6E6D68'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore();
  (SKILL_ICONS[c] || (() => {}))(ctx, x, y, r * 0.75, C.white);
}
function coin(ctx, x, y, r, o = {}) {
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.fillStyle = '#9C7A14'; ctx.beginPath(); ctx.arc(x, y + r * 0.12, r, 0, 7); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#FFE680'); g.addColorStop(1, '#D9A91E');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(120,85,10,0.6)'; ctx.lineWidth = r * 0.1; ctx.beginPath(); ctx.arc(x, y, r * 0.72, 0, 7); ctx.stroke();
  if (o.n !== undefined) text(ctx, String(o.n), x, y + r * 0.36, { size: Math.round(r * 1.05), weight: 700, color: '#6A4C05', align: 'center' });
  ctx.restore();
}
function ringIcon(ctx, x, y, r, color = C.gold, lw) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw || r * 0.32;
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.86, 0, 0, 7); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = (lw || r * 0.32) * 0.3;
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.86, 0, Math.PI * 1.1, Math.PI * 1.55); ctx.stroke();
  ctx.restore();
}
function chainIcon(ctx, x, y, r, color = C.ink) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = r * 0.32; ctx.lineCap = 'round';
  roundRect(ctx, x - r * 1.1, y - r * 0.45, r * 1.3, r * 0.9, r * 0.45); ctx.stroke();
  roundRect(ctx, x - r * 0.2, y - r * 0.45, r * 1.3, r * 0.9, r * 0.45); ctx.stroke();
  ctx.restore();
}
function eyeIcon(ctx, x, y, r, color = C.saur) {
  ctx.save();
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x - r * 1.5, y); ctx.quadraticCurveTo(x, y - r * 1.2, x + r * 1.5, y); ctx.quadraticCurveTo(x, y + r * 1.2, x - r * 1.5, y); ctx.fill();
  ctx.fillStyle = '#FFB13B'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.55, r * 0.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#1A0A05'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.12, r * 0.45, 0, 0, 7); ctx.fill();
  ctx.restore();
}
function unit(ctx, x, y, side, s = 26, o = {}) {        // shield-shaped unit
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.translate(x, y); ctx.scale(o.scale ?? 1, o.scale ?? 1);
  ctx.fillStyle = 'rgba(30,20,5,0.3)'; shieldPath(ctx, 2, 4, s); ctx.fill();
  ctx.fillStyle = side === 'f' ? C.fell : C.saur; shieldPath(ctx, 0, 0, s); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = s * 0.1; shieldPath(ctx, 0, 0, s * 0.72); ctx.stroke();
  ctx.restore();
}
function shieldPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x - s * 0.7, y - s * 0.75); ctx.lineTo(x + s * 0.7, y - s * 0.75);
  ctx.quadraticCurveTo(x + s * 0.75, y + s * 0.3, x, y + s * 0.95);
  ctx.quadraticCurveTo(x - s * 0.75, y + s * 0.3, x - s * 0.7, y - s * 0.75); ctx.closePath();
}
function fortress(ctx, x, y, side, s = 34, o = {}) {
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.translate(x, y); ctx.scale(o.scale ?? 1, o.scale ?? 1);
  const col = side === 'f' ? C.fell : C.saur;
  ctx.fillStyle = 'rgba(30,20,5,0.3)'; towerPath(ctx, 3, 4, s); ctx.fill();
  ctx.fillStyle = col; towerPath(ctx, 0, 0, s); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; roundRect(ctx, -s * 0.13, s * 0.15, s * 0.26, s * 0.4, s * 0.1); ctx.fill();
  ctx.restore();
}
function towerPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y + s * 0.6); ctx.lineTo(x - s * 0.42, y - s * 0.45);
  for (let i = 0; i < 3; i++) {
    const bx = x - s * 0.5 + i * s * 0.38;
    ctx.lineTo(bx + s * 0.08, y - s * 0.45); ctx.lineTo(bx + s * 0.08, y - s * 0.7); ctx.lineTo(bx + s * 0.22, y - s * 0.7); ctx.lineTo(bx + s * 0.22, y - s * 0.45);
  }
  ctx.lineTo(x + s * 0.42, y - s * 0.45); ctx.lineTo(x + s * 0.5, y + s * 0.6); ctx.closePath();
}
function pawn(ctx, x, y, color, s = 30) {
  ctx.save();
  ctx.fillStyle = 'rgba(30,20,5,0.28)'; ctx.beginPath(); ctx.ellipse(x + 3, y + s * 0.95, s * 0.7, s * 0.22, 0, 0, 7); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y - s * 0.55, s * 0.36, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - s * 0.32, y - s * 0.2); ctx.lineTo(x + s * 0.32, y - s * 0.2); ctx.lineTo(x + s * 0.6, y + s * 0.9); ctx.lineTo(x - s * 0.6, y + s * 0.9); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function hobbitsPiece(ctx, x, y, s = 38) {     // two small pawns side by side (Frodo & Sam)
  pawn(ctx, x - s * 0.32, y, C.fell, s * 0.8);
  pawn(ctx, x + s * 0.34, y + s * 0.06, '#2E9AAE', s * 0.72);
}
function nazgul(ctx, x, y, s = 40) {            // hooded rider silhouette
  ctx.save();
  ctx.fillStyle = 'rgba(30,20,5,0.28)'; ctx.beginPath(); ctx.ellipse(x + 3, y + s * 0.95, s * 0.75, s * 0.22, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#1D1A1A';
  ctx.beginPath();
  ctx.moveTo(x, y - s * 1.05);
  ctx.quadraticCurveTo(x + s * 0.45, y - s * 0.9, x + s * 0.5, y - s * 0.3);
  ctx.lineTo(x + s * 0.75, y + s * 0.9); ctx.lineTo(x - s * 0.75, y + s * 0.9); ctx.lineTo(x - s * 0.5, y - s * 0.3);
  ctx.quadraticCurveTo(x - s * 0.45, y - s * 0.9, x, y - s * 1.05); ctx.fill();
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x + s * 0.08, y - s * 0.55, s * 0.2, s * 0.24, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#E14B32'; ctx.beginPath(); ctx.arc(x + s * 0.02, y - s * 0.56, s * 0.045, 0, 7); ctx.arc(x + s * 0.17, y - s * 0.56, s * 0.045, 0, 7); ctx.fill();
  ctx.restore();
}
function volcano(ctx, x, y, s = 120) {
  ctx.save();
  ctx.fillStyle = '#3A2E2A';
  ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x - s * 0.22, y - s * 0.95); ctx.lineTo(x + s * 0.22, y - s * 0.95); ctx.lineTo(x + s, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#E2542B';
  ctx.beginPath(); ctx.moveTo(x - s * 0.22, y - s * 0.95); ctx.lineTo(x + s * 0.22, y - s * 0.95); ctx.lineTo(x + s * 0.1, y - s * 0.65); ctx.lineTo(x, y - s * 0.75); ctx.lineTo(x - s * 0.12, y - s * 0.55); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(80,70,65,0.45)';
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + Math.sin(i * 1.7) * s * 0.15, y - s * (1.1 + i * 0.16), s * (0.16 + i * 0.05), 0, 7); ctx.fill(); }
  ctx.restore();
}

// ------------------------------------------------------------------ icon sets (drawn at cx,cy within radius s)
function stroke(ctx, color, w) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }
const SKILL_ICONS = {
  Ruse(ctx, x, y, s, col = C.ink) {          // theatre-style mask
    ctx.save(); ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x - s, y - s * 0.55); ctx.quadraticCurveTo(x, y - s * 0.85, x + s, y - s * 0.55);
    ctx.quadraticCurveTo(x + s * 0.95, y + s * 0.5, x, y + s * 0.9); ctx.quadraticCurveTo(x - s * 0.95, y + s * 0.5, x - s, y - s * 0.55); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.ellipse(x - s * 0.4, y - s * 0.12, s * 0.22, s * 0.13, -0.3, 0, 7); ctx.ellipse(x + s * 0.4, y - s * 0.12, s * 0.22, s * 0.13, 0.3, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y + s * 0.3, s * 0.3, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = s * 0.12; ctx.stroke();
    ctx.restore();
  },
  Strength(ctx, x, y, s, col = C.ink) {      // hammer
    ctx.save(); ctx.fillStyle = col; ctx.translate(x, y); ctx.rotate(-0.6);
    roundRect(ctx, -s * 0.12, -s * 0.4, s * 0.24, s * 1.35, s * 0.08); ctx.fill();
    roundRect(ctx, -s * 0.75, -s * 0.85, s * 1.5, s * 0.6, s * 0.12); ctx.fill();
    ctx.restore();
  },
  Courage(ctx, x, y, s, col = C.ink) {       // heart
    ctx.save(); ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(x, y + s * 0.85);
    ctx.bezierCurveTo(x - s * 1.25, y - s * 0.05, x - s * 0.6, y - s * 1.05, x, y - s * 0.35);
    ctx.bezierCurveTo(x + s * 0.6, y - s * 1.05, x + s * 1.25, y - s * 0.05, x, y + s * 0.85); ctx.fill(); ctx.restore();
  },
  Knowledge(ctx, x, y, s, col = C.ink) {     // open book
    ctx.save(); ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x, y - s * 0.45); ctx.quadraticCurveTo(x - s * 0.5, y - s * 0.75, x - s * 1.0, y - s * 0.55);
    ctx.lineTo(x - s * 1.0, y + s * 0.6); ctx.quadraticCurveTo(x - s * 0.5, y + s * 0.4, x, y + s * 0.7); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y - s * 0.45); ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.75, x + s * 1.0, y - s * 0.55);
    ctx.lineTo(x + s * 1.0, y + s * 0.6); ctx.quadraticCurveTo(x + s * 0.5, y + s * 0.4, x, y + s * 0.7); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out'; ctx.fillRect(x - s * 0.04, y - s * 0.5, s * 0.08, s * 1.25);
    ctx.restore();
  },
  Leadership(ctx, x, y, s, col = C.ink) {    // crown
    ctx.save(); ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(x - s, y + s * 0.55); ctx.lineTo(x - s, y - s * 0.55); ctx.lineTo(x - s * 0.5, y - s * 0.05); ctx.lineTo(x, y - s * 0.75);
    ctx.lineTo(x + s * 0.5, y - s * 0.05); ctx.lineTo(x + s, y - s * 0.55); ctx.lineTo(x + s, y + s * 0.55); ctx.closePath(); ctx.fill();
    ctx.restore();
  },
};
const RESOURCE_ICONS = {
  Wood(ctx, x, y, s) { ctx.save(); ctx.fillStyle = '#8B5A2B'; ctx.translate(x, y); ctx.rotate(-0.3); roundRect(ctx, -s, -s * 0.38, s * 2, s * 0.76, s * 0.38); ctx.fill(); ctx.fillStyle = '#C79A62'; ctx.beginPath(); ctx.ellipse(s * 0.82, 0, s * 0.2, s * 0.36, 0, 0, 7); ctx.fill(); ctx.restore(); },
  Clay(ctx, x, y, s) { ctx.save(); ctx.fillStyle = '#B5562E'; roundRect(ctx, x - s, y - s * 0.45, s * 2, s * 0.9, s * 0.1); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.moveTo(x, y - s * 0.45); ctx.lineTo(x, y + s * 0.45); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.stroke(); ctx.restore(); },
  Stone(ctx, x, y, s) { ctx.save(); ctx.fillStyle = '#8D8B86'; ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.5); ctx.lineTo(x - s * 0.6, y - s * 0.55); ctx.lineTo(x + s * 0.3, y - s * 0.7); ctx.lineTo(x + s, y - s * 0.05); ctx.lineTo(x + s * 0.7, y + s * 0.6); ctx.closePath(); ctx.fill(); ctx.restore(); },
  Glass(ctx, x, y, s) { ctx.save(); ctx.fillStyle = '#5FB2C9'; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.75, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.75, y); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.3, y - s * 0.1); ctx.lineTo(x, y); ctx.closePath(); ctx.fill(); ctx.restore(); },
  Papyrus(ctx, x, y, s) { ctx.save(); ctx.fillStyle = '#E2C77E'; roundRect(ctx, x - s * 0.8, y - s * 0.75, s * 1.6, s * 1.5, s * 0.1); ctx.fill(); ctx.fillStyle = '#C4A456'; ctx.beginPath(); ctx.arc(x - s * 0.8, y, s * 0.3, 0, 7); ctx.arc(x + s * 0.8, y, s * 0.3, 0, 7); ctx.fill(); ctx.restore(); },
};
const RACE_ICONS = {
  Elves(ctx, x, y, s, col = C.green) {       // leaf
    ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x + s * 0.95, y - s * 0.1, x, y + s); ctx.quadraticCurveTo(x - s * 0.95, y - s * 0.1, x, y - s); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.moveTo(x, y - s * 0.7); ctx.lineTo(x, y + s * 0.85); ctx.stroke(); ctx.restore();
  },
  Dwarves(ctx, x, y, s, col = C.green) {     // axe
    ctx.save(); ctx.fillStyle = col; ctx.translate(x, y); ctx.rotate(0.5);
    roundRect(ctx, -s * 0.1, -s, s * 0.2, s * 2, s * 0.08); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s * 0.08, -s * 0.85); ctx.quadraticCurveTo(s * 1.0, -s * 0.9, s * 0.8, -s * 0.05); ctx.quadraticCurveTo(s * 0.45, -s * 0.35, s * 0.08, -s * 0.25); ctx.fill();
    ctx.restore();
  },
  Hobbits(ctx, x, y, s, col = C.green) {     // round door
    ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, s * 0.95, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = s * 0.09;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x + i * s * 0.32, y - Math.sqrt(Math.max(0, 0.8 - (i * 0.32) ** 2)) * s); ctx.lineTo(x + i * s * 0.32, y + Math.sqrt(Math.max(0, 0.8 - (i * 0.32) ** 2)) * s); ctx.stroke(); }
    ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.arc(x, y + s * 0.05, s * 0.14, 0, 7); ctx.fill(); ctx.restore();
  },
  Humans(ctx, x, y, s, col = C.green) {      // sword
    ctx.save(); ctx.fillStyle = col; ctx.translate(x, y); ctx.rotate(0.6);
    ctx.beginPath(); ctx.moveTo(0, -s * 1.05); ctx.lineTo(s * 0.16, -s * 0.8); ctx.lineTo(s * 0.13, s * 0.45); ctx.lineTo(-s * 0.13, s * 0.45); ctx.lineTo(-s * 0.16, -s * 0.8); ctx.closePath(); ctx.fill();
    roundRect(ctx, -s * 0.5, s * 0.42, s, s * 0.16, s * 0.06); ctx.fill(); roundRect(ctx, -s * 0.09, s * 0.55, s * 0.18, s * 0.45, s * 0.06); ctx.fill();
    ctx.restore();
  },
  Ents(ctx, x, y, s, col = C.green) {        // tree
    ctx.save(); ctx.fillStyle = col;
    roundRect(ctx, x - s * 0.13, y, s * 0.26, s, s * 0.06); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - s * 0.3, s * 0.55, 0, 7); ctx.arc(x - s * 0.45, y + s * 0.05, s * 0.4, 0, 7); ctx.arc(x + s * 0.45, y + s * 0.05, s * 0.4, 0, 7); ctx.fill();
    ctx.restore();
  },
  Wizards(ctx, x, y, s, col = C.green) {     // staff with a star
    ctx.save(); ctx.fillStyle = col; ctx.translate(x, y); ctx.rotate(0.35);
    roundRect(ctx, -s * 0.08, -s * 0.5, s * 0.16, s * 1.55, s * 0.06); ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * 0.22 : s * 0.5; ctx.lineTo(Math.cos(a) * r, -s * 0.72 + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  },
  Eagle(ctx, x, y, s, col = C.gold) {        // wings
    ctx.save(); ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(x, y + s * 0.35);
    ctx.quadraticCurveTo(x - s * 0.5, y - s * 0.6, x - s * 1.15, y - s * 0.55); ctx.quadraticCurveTo(x - s * 0.7, y - s * 0.1, x - s * 0.85, y + s * 0.15);
    ctx.quadraticCurveTo(x - s * 0.35, y + s * 0.05, x, y + s * 0.6);
    ctx.quadraticCurveTo(x + s * 0.35, y + s * 0.05, x + s * 0.85, y + s * 0.15); ctx.quadraticCurveTo(x + s * 0.7, y - s * 0.1, x + s * 1.15, y - s * 0.55);
    ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.6, x, y + s * 0.35); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - s * 0.1, s * 0.2, 0, 7); ctx.fill(); ctx.restore();
  },
};
const SCIENCE_ICONS = [   // generic stand-ins for 7 Wonders Duel's science symbols
  (ctx, x, y, s, c) => { ctx.save(); stroke(ctx, c, s * 0.16); ctx.beginPath(); ctx.arc(x, y, s * 0.75, 0, 7); ctx.stroke(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * s * 0.75, y + Math.sin(a) * s * 0.75); ctx.stroke(); } ctx.restore(); },
  (ctx, x, y, s, c) => { ctx.save(); stroke(ctx, c, s * 0.16); ctx.beginPath(); ctx.moveTo(x, y - s * 0.9); ctx.lineTo(x - s * 0.6, y + s * 0.85); ctx.moveTo(x, y - s * 0.9); ctx.lineTo(x + s * 0.6, y + s * 0.85); ctx.moveTo(x - s * 0.4, y + s * 0.25); ctx.lineTo(x + s * 0.4, y + s * 0.25); ctx.stroke(); ctx.restore(); },
  (ctx, x, y, s, c) => { ctx.save(); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x + s * 0.8, y - s * 0.9); ctx.quadraticCurveTo(x - s * 0.2, y - s * 0.6, x - s * 0.7, y + s * 0.9); ctx.quadraticCurveTo(x + s * 0.1, y + s * 0.1, x + s * 0.8, y - s * 0.9); ctx.fill(); ctx.restore(); },
  (ctx, x, y, s, c) => { ctx.save(); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - s * 0.35, y - s * 0.9); ctx.lineTo(x + s * 0.35, y - s * 0.9); ctx.lineTo(x + s * 0.2, y - s * 0.1); ctx.lineTo(x + s * 0.8, y + s * 0.85); ctx.lineTo(x - s * 0.8, y + s * 0.85); ctx.lineTo(x - s * 0.2, y - s * 0.1); ctx.closePath(); ctx.fill(); ctx.restore(); },
  (ctx, x, y, s, c) => { ctx.save(); stroke(ctx, c, s * 0.16); ctx.beginPath(); ctx.arc(x, y, s * 0.3, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - s * 0.9, y + s * 0.9); ctx.lineTo(x - s * 0.2, y + s * 0.2); ctx.moveTo(x + s * 0.2, y - s * 0.2); ctx.lineTo(x + s * 0.9, y - s * 0.9); ctx.stroke(); ctx.restore(); },
  (ctx, x, y, s, c) => { ctx.save(); ctx.fillStyle = c; roundRect(ctx, x - s * 0.7, y - s * 0.2, s * 1.4, s * 1.0, s * 0.15); ctx.fill(); ctx.beginPath(); ctx.arc(x, y - s * 0.2, s * 0.55, Math.PI, 0); ctx.fill(); ctx.restore(); },
  (ctx, x, y, s, c) => { ctx.save(); stroke(ctx, c, s * 0.16); ctx.beginPath(); ctx.moveTo(x - s * 0.8, y + s * 0.8); ctx.lineTo(x + s * 0.8, y - s * 0.8); ctx.moveTo(x + s * 0.2, y - s * 0.8); ctx.lineTo(x + s * 0.8, y - s * 0.8); ctx.lineTo(x + s * 0.8, y - s * 0.2); ctx.stroke(); ctx.restore(); },
];
