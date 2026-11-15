// Scenes for the Living Forest Duel explainer. Collage scenes are driven by the `items` in script.py and use
// photos cropped from the rulebook; the other scenes are animated diagrams of the rules.
'use strict';

const COL = (n) => ({ ink: C.ink, ink2: C.ink2, red: C.red, yellow: C.yellow, green: C.green, sum: LF.sum, win: LF.win }[n] || n || C.ink);
const CLEAR_VALS = [4, 3, 2, 2, 2, 3, 4];
const CLEAR_BONUS = ['lotus', 'water', 'sun', 'plant', 'sun', 'water', 'lotus'];

function lotusIcon(ctx, x, y, s, o = {}) {
  ctx.save(); if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill(); ctx.strokeStyle = '#3A352D'; ctx.lineWidth = s * 0.09; ctx.stroke();
  ctx.fillStyle = '#C9A0D8';
  for (let i = -2; i <= 2; i++) { ctx.save(); ctx.translate(x, y + s * 0.35); ctx.rotate(i * 0.42); ctx.beginPath(); ctx.ellipse(0, -s * 0.38, s * 0.16, s * 0.42, 0, 0, 7); ctx.fill(); ctx.restore(); }
  ctx.restore();
}
function bonusIcon(ctx, name, x, y, s, o = {}) { name === 'lotus' ? lotusIcon(ctx, x, y, s, o) : elementIcon(ctx, name, x, y, s, o); }

// ------------------------------------------------------------------ the clearing (abstract)
function clearingCard(ctx, i, x, y, w, h, o = {}) {
  ctx.save(); if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.glow) { ctx.save(); ctx.shadowColor = `rgba(255,120,40,${o.glow})`; ctx.shadowBlur = 40; ctx.fillStyle = '#FF7A2A'; roundRect(ctx, x - 6, y - 6, w + 12, h + 12, 14); ctx.fill(); ctx.restore(); }
  shadowBox(ctx, x, y, w, h, 12, 12, 0.25, 6);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  const warm = i < 3, cold = i > 3;
  g.addColorStop(0, warm ? '#C9D78E' : cold ? '#D7DEE6' : '#D8D9B2'); g.addColorStop(1, warm ? '#6E8A47' : cold ? '#8C99A8' : '#8B9466');
  ctx.fillStyle = g; roundRect(ctx, x, y, w, h, 12); ctx.fill();
  // trunks
  ctx.fillStyle = 'rgba(60,45,30,0.35)'; ctx.fillRect(x + w * 0.18, y + h * 0.05, w * 0.1, h * 0.7); ctx.fillRect(x + w * 0.68, y + h * 0.02, w * 0.08, h * 0.75);
  flame(ctx, x + w / 2, y + h * 0.17, w * 0.13);
  text(ctx, String(CLEAR_VALS[i]), x + w / 2, y + h * 0.4, { size: Math.round(w * 0.24), weight: 700, align: 'center', color: '#7A2410' });
  bonusIcon(ctx, CLEAR_BONUS[i], x + w / 2, y + h * 0.78, w * 0.17);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; roundRect(ctx, x, y, w, h, 12); ctx.stroke();
  ctx.restore();
}
function onibiFigure(ctx, x, y, s, o = {}) {
  ctx.save(); if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.fillStyle = 'rgba(30,20,5,0.3)'; ctx.beginPath(); ctx.ellipse(x + 3, y + s * 0.95, s * 0.6, s * 0.18, 0, 0, 7); ctx.fill();
  const g = ctx.createLinearGradient(x, y - s, x, y + s); g.addColorStop(0, '#FFB23A'); g.addColorStop(1, '#B9261A');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y - s * 1.1);
  ctx.bezierCurveTo(x + s * 0.4, y - s * 0.7, x + s * 0.75, y - s * 0.2, x + s * 0.6, y + s * 0.9); ctx.lineTo(x - s * 0.6, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 0.75, y - s * 0.2, x - s * 0.4, y - s * 0.7, x, y - s * 1.1); ctx.fill();
  ctx.fillStyle = '#2A0E08'; ctx.beginPath(); ctx.arc(x - s * 0.18, y - s * 0.1, s * 0.09, 0, 7); ctx.arc(x + s * 0.18, y - s * 0.1, s * 0.09, 0, 7); ctx.fill();
  ctx.restore();
}
function clearingRow(ctx, x0, y, w, h, gap, o = {}) {
  const pos = [];
  for (let i = 0; i < 7; i++) {
    const x = x0 + i * (w + gap);
    pos.push({ x, cx: x + w / 2, y });
    const k = o.k === undefined ? 1 : clamp(o.k * 1.6 - i * 0.08);
    if (k > 0) clearingCard(ctx, i, x, y + (1 - easeOut(k)) * 40, w, h, { alpha: k, glow: o.glow ? o.glow[i] : 0 });
  }
  return pos;
}

// lanes for the round diagrams
const LANES = {
  help: { x: 360, y: 300, w: 1460, h: 270, label: 'SHARED HELP LINE', col: LF.forest },
  sum: { x: 100, y: 700, w: 820, h: 270, label: 'SUMMER’S PERSONAL LINE', col: LF.sum },
  win: { x: 1000, y: 700, w: 820, h: 270, label: 'WINTER’S PERSONAL LINE', col: LF.win },
};
function lane(ctx, L, k = 1) {
  if (k <= 0) return;
  ctx.save(); ctx.globalAlpha *= k;
  ctx.fillStyle = 'rgba(255,253,247,0.6)'; roundRect(ctx, L.x, L.y, L.w, L.h, 16); ctx.fill();
  ctx.setLineDash([14, 10]); ctx.strokeStyle = L.col; ctx.lineWidth = 4; roundRect(ctx, L.x, L.y, L.w, L.h, 16); ctx.stroke(); ctx.setLineDash([]);
  text(ctx, L.label, L.x + 20, L.y - 16, { size: 34, weight: 700, color: L.col, spacing: 2 });
  ctx.restore();
}
const CW = 150, CH = 220;
function slot(L, i) { return { x: L.x + 30 + i * (CW + 24), y: L.y + (L.h - CH) / 2 }; }
function drawPile(ctx, x, y, k = 1, label = 'SHARED DRAW PILE') {
  if (k <= 0) return;
  ctx.save(); ctx.globalAlpha *= k;
  for (let d = 4; d >= 0; d--) { shadowBox(ctx, x + d * 4, y + d * 4, CW, CH, 12, 8, 0.2, 4); ctx.fillStyle = d ? '#4E5B4A' : '#5E7A58'; roundRect(ctx, x + d * 4, y + d * 4, CW, CH, 12); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3; roundRect(ctx, x + 14, y + 14, CW - 28, CH - 28, 8); ctx.stroke();
  elementIcon(ctx, 'plant', x + CW / 2, y + CH / 2, 30);
  text(ctx, label, x + CW / 2, y + CH + 44, { size: 26, weight: 700, align: 'center', color: C.ink2 });
  ctx.restore();
}
// card flying from (x0,y0) to (x1,y1) with an arc
function flyCard(ctx, k, x0, y0, x1, y1, o) {
  if (k <= 0) return;
  const e = easeInOut(k);
  const x = lerp(x0, x1, e), y = lerp(y0, y1, e) - Math.sin(e * Math.PI) * 120;
  animalCard(ctx, x, y, CW, CH, o);
}
function tokens(ctx, x, y, season, n, o = {}) {   // a player's action tokens (o.lost = how many crossed out)
  for (let i = 0; i < n; i++) actionToken(ctx, x + i * 70, y, 30, season, { crossed: i >= n - (o.lost || 0), alpha: o.alpha });
}
function chip(ctx, s, x, y, k, o = {}) {
  if (k <= 0) return;
  const size = o.size || 38, tw = measure(ctx, s, { size, weight: 700 });
  ctx.save(); ctx.globalAlpha *= clamp(k * 2);
  const sc = easeBack(k); ctx.translate(x, y); ctx.scale(sc, sc);
  ctx.fillStyle = o.fill || C.ink; roundRect(ctx, -tw / 2 - 28, -size * 0.95, tw + 56, size * 1.5, size * 0.75); ctx.fill();
  text(ctx, s, 0, size * 0.25, { size, weight: 700, align: 'center', color: o.color || C.yellow });
  ctx.restore();
}

const SCENES = {
  // ---------------------------------------------------------------- chapter card
  chapter(ctx, S) {
    paper(ctx, S.t);
    const { num, title } = S.args;
    const a = easeBack(clamp(S.lt / 0.5)), x = 300, y = 540;
    ctx.save(); ctx.translate(x + 150, y); ctx.rotate(-0.04); ctx.scale(a, a);
    shadowBox(ctx, -150, -150, 300, 300, 6, 26, 0.25, 12);
    ctx.fillStyle = C.yellow; roundRect(ctx, -150, -150, 300, 300, 6); ctx.fill();
    text(ctx, num, 0, 82, { size: 230, weight: 700, color: C.ink, align: 'center' });
    ctx.restore();
    const k = clamp((S.lt - 0.25) / 0.5), words = title.toUpperCase();
    const size = Math.min(128, Math.floor(128 * 1100 / measure(ctx, words, { size: 128, weight: 700 })));
    textIn(ctx, words, 720, 540 + size * 0.35, k, { size, weight: 700 });
    scribble(ctx, 722, 540 + size * 0.35 + 40, 722 + measure(ctx, words, { size, weight: 700 }), 540 + size * 0.35 + 45, clamp((S.lt - 0.6) / 0.5), { width: 9, seed: 11 });
  },

  // ---------------------------------------------------------------- collage of rulebook crops + marks
  collage(ctx, S) {
    paper(ctx, S.t);
    S.seg.beats.forEach((b) => (b.items || []).forEach((it, j) => drawItem(ctx, S, b, it, j)));
  },

  // ---------------------------------------------------------------- title
  title(ctx, S) {
    paper(ctx, S.t);
    const k = (d, du = 0.6) => clamp((S.lt - d) / du);
    cutout(ctx, IMG.clearing, 160, 640, 1600, { rot: -1, alpha: k(0.1), scale: lerp(0.95, 1, easeOut(k(0.1))) });
    cutout(ctx, IMG.onibi_standee, 1520, 150, 230, { rot: 6, alpha: k(0.5), scale: easeBack(k(0.5)) });
    textIn(ctx, 'LIVING FOREST', 150, 300, k(0.25), { size: 170, weight: 700 });
    textIn(ctx, 'DUEL', 150, 470, k(0.45), { size: 170, weight: 700, color: LF.forest });
    const s = 'the rules, explained';
    const tw = measure(ctx, s, { size: 56, weight: 600, family: BODY });
    highlight(ctx, 550, 410, tw + 40, 80, k(0.9), C.yellow, 3);
    textIn(ctx, s, 570, 466, k(0.9), { size: 56, weight: 600, family: BODY });
    textIn(ctx, 'Unofficial explainer · images from the rulebook', 960, 1010, k(1.3), { size: 28, weight: 500, family: BODY, align: 'center', color: C.ink3 });
  },

  // ---------------------------------------------------------------- reading a card
  anatomy(ctx, S) {
    paper(ctx, S.t);
    const X = 360, Y = 150, Wd = 1200;
    cutout(ctx, IMG.anatomy, X, Y, Wd, { alpha: S.P(0, 0, 0.5), scale: lerp(0.94, 1, easeOut(S.P(0, 0, 0.6))) });
    const p = (fx, fy) => [X + fx * Wd, Y + fy * Wd * 366 / 810];
    if (S.step === 0 || S.step === 1) {
      const [ex, ey] = p(0.085, 0.5);
      const ke = S.PW(0, 'elements', 0.6);
      circleMark(ctx, ex, ey, 70, 150, ke, { color: C.red, width: 7 });
      arrow(ctx, 170, 560, ex - 80, ey + 40, ke, { color: C.red, bend: 30 });
      textIn(ctx, 'ELEMENTS', 70, 620, ke, { size: 56, weight: 700, color: C.red });
    }
    if (S.step >= 1 && S.step < 2) {
      const acts = [['sun', 'RECRUIT', 'sun'], ['water', 'PUT OUT FIRE', 'water'], ['plant', 'PLANT TREES', 'sprouts'], ['spiral', 'MOVE ONIBI', 'spirals']];
      acts.forEach(([n, lab, w], i) => {
        const k = S.PW(1, w, 0.45), x = [170, 600, 1080, 1520][i], y = 860;
        if (k <= 0) return;
        elementIcon(ctx, n, x, y, 58 * easeBack(k));
        textIn(ctx, lab, x + 80, y + 18, k, { size: 44, weight: 700 });
      });
    }
    if (S.step === 2) {
      const marks = [[p(0.165, 0.07), 'none', 'neutral'], [p(0.405, 0.1), 'sol', 'black one'], [p(0.74, 0.17), 'greg', 'white one']];
      marks.forEach(([[x, y], kind, w], i) => {
        const k = S.PW(2, w, 0.5);
        circleMark(ctx, x, y, 48, 48, k, { color: C.red, width: 6, seed: 30 + i });
      });
      const row = [['sol', 'SOLITARY', 'black one'], ['greg', 'GREGARIOUS', 'white one'], ['none', 'NEUTRAL (no symbol)', 'neutral']];
      row.forEach(([kind, lab, w], i) => {
        const k = S.PW(2, w, 0.45), x = 380 + i * 470, y = 860;
        if (k <= 0) return;
        if (kind === 'sol') solitaryIcon(ctx, x, y, 44 * easeBack(k));
        else if (kind === 'greg') gregariousIcon(ctx, x, y, 44 * easeBack(k));
        else { ctx.save(); ctx.strokeStyle = C.ink3; ctx.lineWidth = 5; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.arc(x, y, 44, 0, 7); ctx.stroke(); ctx.restore(); }
        textIn(ctx, lab, x + 66, y + 16, k, { size: 42, weight: 700 });
      });
    }
    if (S.step === 3) {
      const ks = S.PW(3, 'season symbol', 0.5), kc = S.PW(3, 'a cost', 0.5);
      const [sx, sy] = p(0.405, 0.85), [cx, cy] = p(0.93, 0.85);
      circleMark(ctx, sx, sy, 50, 50, ks, { color: C.red, width: 6 });
      circleMark(ctx, cx, cy, 50, 50, kc, { color: C.red, width: 6, seed: 9 });
      seasonHex(ctx, 420, 860, 40 * easeBack(ks), 'win', { alpha: ks }); seasonHex(ctx, 520, 860, 40 * easeBack(ks), 'sum', { alpha: ks });
      textIn(ctx, 'SEASON', 590, 876, ks, { size: 44, weight: 700 });
      ctx.save(); ctx.globalAlpha = kc; ctx.fillStyle = '#F6D44C'; ctx.beginPath(); ctx.arc(1180, 860, 40 * easeBack(kc), 0, 7); ctx.fill(); ctx.restore();
      textIn(ctx, '8', 1180, 876, kc, { size: 44, weight: 700, align: 'center' });
      textIn(ctx, 'COST', 1250, 876, kc, { size: 44, weight: 700 });
    }
  },

  // ---------------------------------------------------------------- the round: where revealed cards go
  lines(ctx, S) {
    paper(ctx, S.t);
    const DP = { x: 110, y: 290 };
    lane(ctx, LANES.help, S.P(0, 0.1)); lane(ctx, LANES.sum, S.P(0, 0.2)); lane(ctx, LANES.win, S.P(0, 0.3));
    drawPile(ctx, DP.x, DP.y, S.P(0, 0));
    const tk = S.PW(0, 'two action tokens', 0.5);
    ctx.save(); ctx.globalAlpha = tk;
    tokens(ctx, 640, 1030, 'sum', 2); tokens(ctx, 1540, 1030, 'win', 2);
    ctx.restore();
    stamp(ctx, 'SUMMER GOES FIRST', 330, 1030, S.PW(0, 'summer goes first', 0.5), { size: 40, rot: -4, color: LF.sumD });
    if (S.step >= 1) {
      chip(ctx, 'REVEAL A CARD', 760, 190, S.PW(1, 'reveal', 0.5));
      textIn(ctx, 'or', 1010, 200, S.PW(1, 'or spend', 0.4), { size: 40, weight: 600, family: BODY, align: 'center', color: C.ink2 });
      chip(ctx, 'SPEND A TOKEN', 1260, 190, S.PW(1, 'spend', 0.5), { fill: LF.forest, color: C.white });
    }
    if (S.step === 2) {
      for (let i = 0; i < 3; i++) {
        const k = clamp((S.t - S.W(2, 'keep revealing') - i * 0.55) / 0.5);
        flyCard(ctx, k * 0.5, DP.x, DP.y, DP.x + 260, DP.y - 40, { season: null, els: [['sun', 1]] });
      }
      stamp(ctx, 'REVEALING IS FREE', 1100, 450, S.PW(2, 'doesn', 0.5), { size: 56, rot: -3, color: LF.forest });
    }
    // cards placed in lines
    const placed = [];
    if (S.step >= 3) {
      placed.push([S.PW(3, 'common animal', 0.9), slot(LANES.help, 0), { season: null, els: [['water', 1], ['sun', 1]], label: 'common' }]);
      placed.push([S.PW(3, 'stag', 0.9), slot(LANES.help, 1), { season: null, els: [['sun', 2]], label: 'stag' }]);
      textIn(ctx, 'both players can use it', 1300, 620, S.PW(3, 'both players', 0.5), { size: 36, weight: 600, family: BODY, color: LF.forest });
    }
    if (S.step >= 4) {
      placed.push([S.PW(4, 'your season', 0.9), slot(LANES.sum, 0), { season: 'sum', els: [['plant', 1], ['water', 1]], cost: 3 }]);
      placed.push([S.PW(4, 'fire varan', 0.9), slot(LANES.sum, 1), { varan: true, season: 'sum' }]);
      placed.push([S.PW(4, 'opponent', 0.9), slot(LANES.win, 0), { season: 'win', els: [['spiral', 1]], cost: 4 }]);
      textIn(ctx, 'only you can use it', 520, 860, S.PW(4, 'only you', 0.5), { size: 36, weight: 700, family: BODY, color: LF.sumD });
    }
    placed.forEach(([k, to, o]) => flyCard(ctx, k, DP.x, DP.y, to.x, to.y, o));
  },

  // ---------------------------------------------------------------- solitary symbols
  solitary(ctx, S) {
    paper(ctx, S.t);
    lane(ctx, LANES.help); lane(ctx, LANES.sum); lane(ctx, LANES.win);
    drawPile(ctx, 110, 290);
    const help = [{ season: null, els: [['sun', 1]], sym: 'sol' }, { season: null, els: [['water', 2]] }];
    const newSol = S.step >= 1 ? S.PW(1, 'third one', 0.8) : 0;
    help.forEach((o, i) => { const p = slot(LANES.help, i); animalCard(ctx, p.x, p.y, CW, CH, o); });
    const p2 = slot(LANES.help, 2);
    if (newSol > 0) flyCard(ctx, newSol, 110, 290, p2.x, p2.y, { season: null, els: [['plant', 1]], sym: 'sol' });
    const ps = slot(LANES.sum, 0); animalCard(ctx, ps.x, ps.y, CW, CH, { season: 'sum', els: [['sun', 2]], sym: 'sol', cost: 4 });
    const pw = slot(LANES.win, 0), pw2 = slot(LANES.win, 1);
    animalCard(ctx, pw.x, pw.y, CW, CH, { season: 'win', els: [['water', 1]], sym: 'sol', cost: 3 });
    animalCard(ctx, pw2.x, pw2.y, CW, CH, { season: 'win', els: [['spiral', 1]], sym: 'greg', cost: 5 });
    // what Summer can see
    const kv = S.PW(0, 'you can see', 0.6) * (S.step === 0 ? 1 : 1 - S.P(1, 0, 0.3));
    if (kv > 0) {
      ctx.save(); ctx.globalAlpha = kv; ctx.strokeStyle = C.yellow; ctx.lineWidth = 10;
      roundRect(ctx, LANES.help.x - 10, LANES.help.y - 10, LANES.help.w + 20, LANES.help.h + 20, 20); ctx.stroke();
      roundRect(ctx, LANES.sum.x - 10, LANES.sum.y - 10, LANES.sum.w + 20, LANES.sum.h + 20, 20); ctx.stroke(); ctx.restore();
      textIn(ctx, 'what Summer can see', 960, 650, kv, { size: 40, weight: 700, align: 'center', color: C.ink });
    }
    // counters
    const solHelp = 1 + (newSol > 0.9 ? 1 : 0);
    const sumSees = solHelp + 1, winSees = solHelp + 1 - 1;
    const counter = (x, n, lab, col, k) => {
      ctx.save(); ctx.globalAlpha = k;
      panel(ctx, x - 150, 120, 300, 140, { fill: C.white });
      solitaryIcon(ctx, x - 90, 190, 34);
      text(ctx, `× ${n}`, x + 10, 212, { size: 60, weight: 700, color: n >= 3 ? C.red : C.ink, align: 'center' });
      text(ctx, lab, x, 245, { size: 26, weight: 700, align: 'center', color: col });
      ctx.restore();
    };
    counter(1160, sumSees, 'SUMMER SEES', LF.sumD, S.P(0, 0.3));
    counter(1560, winSees, S.step >= 2 ? 'WINTER SEES (3 − 1)' : 'WINTER SEES', LF.winD, S.P(0, 0.4));
    // tokens
    const lostS = S.step >= 1 && newSol > 0.95 ? 1 : 0;
    tokens(ctx, 640, 1030, 'sum', 2, { lost: lostS }); tokens(ctx, 1540, 1030, 'win', 2);
    if (S.step === 1) {
      stamp(ctx, '3RD SOLITARY → −1 TOKEN', 640, 860, clamp(newSol * 2 - 1), { size: 40, rot: -4 });
      textIn(ctx, 'a 4th costs another', 640, 945, S.PW(1, 'fourth', 0.5), { size: 38, weight: 600, family: BODY, align: 'center', color: C.red });
    }
    if (S.step >= 2) {
      const kg = S.PW(2, 'cancels', 0.6);
      arrow(ctx, pw2.x + CW * 0.78, pw2.y + CW * 0.2, pw.x + CW * 0.86, pw.y + CW * 0.24, kg, { color: C.green, width: 6, bend: -40 });
      textIn(ctx, 'gregarious cancels', 1620, 820, kg, { size: 32, weight: 700, family: BODY, align: 'center', color: C.green });
      stamp(ctx, 'LOSES 1', 640, 850, S.PW(2, 'cost one player', 0.5), { size: 48, rot: -5 });
      stamp(ctx, 'KEEPS BOTH', 1640, 900, S.PW(2, 'not the other', 0.5), { size: 48, rot: 4, color: LF.forest });
    }
    if (S.step >= 3) {
      const k = S.P(3, 0.1, 0.5);
      ctx.save(); ctx.globalAlpha = k * 0.75; ctx.fillStyle = C.paper; ctx.fillRect(0, 100, W, H); ctx.restore();
      ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = C.ink; roundRect(ctx, 460, 470, 1000, 110, 14); ctx.fill(); ctx.restore();
      textIn(ctx, 'ROUND ENDS WHEN BOTH ARE OUT OF TOKENS', 960, 545, k, { size: 44, weight: 700, align: 'center', color: C.yellow });
    }
  },

  // ---------------------------------------------------------------- counting elements with a token
  count(ctx, S) {
    paper(ctx, S.t);
    const cards = [[['water', 1], ['sun', 2]], [['water', 2]], [['plant', 2], ['sun', 1]], [['water', 1], ['spiral', 1]], [['sun', 2]], [['water', 1], ['plant', 1]], [['water', 2]]];
    const w = 170, h = 250, gap = 30, x0 = 275, y = 210;
    const X = (i) => x0 + i * (w + gap);
    text(ctx, 'SHARED HELP LINE', x0, 180, { size: 34, weight: 700, color: LF.forest, spacing: 2 });
    const used1 = S.step >= 2 ? S.P(2, 0.3, 0.5) : 0;
    cards.forEach((els, i) => {
      if (i === 6 && S.step < 4) return;
      const k = i === 6 ? S.PW(4, 'fresh drop', 0.6) : 1;
      const usedEls = (used1 > 0.5 && [0, 1, 3, 5].includes(i)) ? els.map((e, j) => (e[0] === 'water' ? j : -1)).filter((j) => j >= 0) : [];
      animalCard(ctx, X(i), y + (1 - easeOut(k)) * 60, w, h, { season: null, els, usedEls, alpha: k });
    });
    // token 1 under card 5
    const t1 = S.PW(0, 'points at', 0.6);
    actionToken(ctx, X(5) + w / 2, y + h + 80 + (1 - easeBack(t1)) * 60, 40, 'sum', { alpha: t1 });
    textIn(ctx, 'last water drop', X(5) + w / 2, y + h + 170, t1 * (S.step < 2 ? 1 : 0), { size: 32, weight: 700, family: BODY, align: 'center' });
    // counting
    if (S.step >= 1) {
      const order = [[0, 1], [1, 2], [3, 1], [5, 1]];
      let total = 0;
      order.forEach(([i, n], j) => {
        const k = S.PW(1, 'every water', 0.4, j * 0.45);
        if (k <= 0) return;
        total += n;
        circleMark(ctx, X(i) + w * 0.3, y + h * 0.3 + (cards[i].findIndex((e) => e[0] === 'water')) * w * 0.36, 52, 36, k, { color: C.water || '#2E86DE', width: 5, seed: 40 + j });
      });
      const kt = S.PW(1, 'strength', 0.5);
      panel(ctx, 1560, 560, 280, 150, { fill: C.white });
      elementIcon(ctx, 'water', 1630, 635, 40);
      text(ctx, `= ${Math.max(total, 0)}`, 1730, 660, { size: 70, weight: 700, align: 'center', color: LF.water });
      textIn(ctx, 'help line', 1700, 750, kt, { size: 30, weight: 600, family: BODY, align: 'center', color: C.ink2 });
    }
    if (S.step === 2 || S.step === 3) stamp(ctx, 'USED UP FOR BOTH PLAYERS', 860, 640, S.PW(2, 'used up', 0.5), { size: 48, rot: -3 });
    // personal line + forest
    if (S.step >= 3) {
      const k = S.PW(3, 'personal line', 0.5), kf = S.PW(3, 'your trees', 0.5);
      text(ctx, 'YOUR PERSONAL LINE', 275, 760, { size: 30, weight: 700, color: LF.sumD, alpha: k });
      animalCard(ctx, 275, 780, 150, 220, { season: 'sum', els: [['water', 2]], cost: 4, alpha: k });
      text(ctx, 'YOUR FOREST', 560, 760, { size: 30, weight: 700, color: LF.forest, alpha: kf });
      forestTile(ctx, 560, 800, 260, 170, { bonus: 'sun', els: [['water', 1]], alpha: kf });
      const kt = S.PW(3, 'only yours', 0.5);
      textIn(ctx, '+ 3, yours to reuse', 1010, 900, kt, { size: 44, weight: 700, color: LF.forest });
      if (S.step === 3) { textIn(ctx, '5 + 3 = 8', 1700, 860, S.PW(3, 'again later', 0.5), { size: 60, weight: 700, align: 'center', color: LF.water }); }
    }
    if (S.step >= 4) {
      const k2 = S.PW(4, 'two tokens', 0.6);
      actionToken(ctx, X(6) + w / 2, y + h + 80 + (1 - easeBack(k2)) * 60, 40, 'sum', { alpha: k2 });
      const kb = S.PW(4, 'starts after', 0.6);
      if (kb > 0) {
        ctx.save(); ctx.globalAlpha = kb; stroke(ctx, C.red, 5);
        ctx.beginPath(); ctx.moveTo(X(5) + w + 4, y - 20); ctx.lineTo(X(5) + w + 4, y - 40); ctx.lineTo(X(6) + w, y - 40); ctx.lineTo(X(6) + w, y - 20); ctx.stroke(); ctx.restore();
        textIn(ctx, 'next count starts after the last token', X(6) - 160, y - 56, kb, { size: 30, weight: 700, family: BODY, align: 'center', color: C.red });
      }
      textIn(ctx, '2 + 3 = 5', 1700, 860, S.PW(4, 'fresh drop', 0.5), { size: 60, weight: 700, align: 'center', color: LF.water });
    }
    if (S.step >= 5) {
      const k = S.P(5, 0.1, 0.5);
      ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = C.ink; roundRect(ctx, 960, 960, 860, 90, 12); ctx.fill(); ctx.restore();
      textIn(ctx, 'THE HELP LINE IS A SHARED WELL', 1390, 1020, k, { size: 44, weight: 700, align: 'center', color: C.yellow });
    }
  },

  // ---------------------------------------------------------------- recruiting refills the line with your cards
  refill(ctx, S) {
    paper(ctx, S.t);
    const n = 7, w = 200, h = 290, gap = 24, x0 = (W - (n * w + (n - 1) * gap)) / 2, y = 330;
    const X = (i) => x0 + i * (w + gap);
    text(ctx, 'RECRUITMENT LINE', x0, 300, { size: 34, weight: 700, color: C.ink2, spacing: 2 });
    const base = ['sum', 'sum', 'sum', 'stag', 'win', 'win', 'win'];
    const takeOrder = S.step === 0 ? [4, 5] : [6, 3];
    const kTake = S.step === 0 ? S.PW(0, 'every time', 0.6) : S.PW(1, 'stag', 0.6);
    const kRefill = S.step === 0 ? S.PW(0, 'replace them', 0.8) : S.PW(1, 'recruited too', 0.8);
    const deck = { x: 120, y: 760 };
    text(ctx, 'SUMMER’S DECK', deck.x + 75, deck.y + 280, { size: 26, weight: 700, align: 'center', color: LF.sumD });
    for (let d = 3; d >= 0; d--) { ctx.fillStyle = d ? '#B7923E' : LF.sum; roundRect(ctx, deck.x + d * 4, deck.y + d * 4, 150, 220, 12); ctx.fill(); }
    seasonHex(ctx, deck.x + 75, deck.y + 110, 34, 'sum');
    const state = base.map((s, i) => (S.step >= 1 && [4, 5].includes(i) ? 'sum' : s));
    state.forEach((s, i) => {
      const taken = takeOrder.includes(i);
      const kt = taken ? kTake : 0;
      const o = s === 'stag' ? { season: null, els: [['sun', 2]], label: 'stag (neutral)' } : { season: s, els: [[s === 'sum' ? 'plant' : 'spiral', 1]], cost: 3 + (i % 3) };
      if (kt < 1) animalCard(ctx, X(i), y - easeInOut(kt) * 260, w, h, { ...o, alpha: 1 - kt });
      if (taken) {
        const kr = clamp((kRefill - 0.0) * 1.0);
        if (kr > 0) {
          const e = easeInOut(kr);
          animalCard(ctx, lerp(deck.x, X(i), e), lerp(deck.y, y, e) - Math.sin(e * Math.PI) * 120, w, h, { season: 'sum', els: [['plant', 1]], cost: 4 });
        }
      }
    });
    textIn(ctx, 'recruit their cards…', 1500, 200, kTake, { size: 44, weight: 700, family: BODY, align: 'center', color: LF.winD });
    textIn(ctx, '…refill from YOUR deck', 1500, 255, kRefill, { size: 44, weight: 700, family: BODY, align: 'center', color: LF.sumD });
    if (S.step >= 1) stamp(ctx, 'ALL SUMMER = SUMMER WINS', 1100, 830, clamp(kRefill * 1.5 - 0.5), { size: 60, rot: -4, color: LF.sumD });
  },

  // ---------------------------------------------------------------- the forest
  forest(ctx, S) {
    paper(ctx, S.t);
    const tw = 280, th = 180, gx = 560, gy = 170;
    const G = (c, r) => ({ x: gx + c * tw, y: gy + r * th });
    const lake = [1, 1];
    // tiles: [col,row,bonus,els, step it appears, word]
    const tiles = [
      [1, 1, null, [], 0, null, true],
      [0, 1, 'water', [['water', 1]], 0, 'trace'],
      [1, 0, 'sun', [['sun', 1]], 0, 'river back'],
      [2, 1, 'plant', [['plant', 2]], 1, 'cover'],
      [1, 2, 'sun', [['water', 1]], 2, 'next to'],
      [0, 0, 'plant', [['spiral', 1]], 3, 'every action'],
      [2, 0, 'water', [['sun', 1]], 3, 'every round'],
      [0, 2, 'lotus', [['plant', 1]], 3, 'nine trees'],
      [2, 2, 'water', [['water', 1]], 3, 'three-by-three'],
    ];
    tiles.forEach(([c, r, bonus, els, st, word, start]) => {
      if (S.step < st) return;
      const k = word ? S.PW(st, word, 0.5) : S.P(0, 0, 0.5);
      if (k <= 0) return;
      const p = G(c, r);
      forestTile(ctx, p.x, p.y - (1 - easeOut(k)) * 80, tw - 10, th - 10, { lake: start, bonus, els, alpha: clamp(k * 2), river: start ? null : [c - lake[0], r - lake[1]] });
    });
    if (S.step === 0) {
      const k = S.PW(0, 'starting tree', 0.5);
      // a tile that can't connect
      const bad = { x: 1450, y: 300 };
      forestTile(ctx, bad.x, bad.y, tw - 10, th - 10, { bonus: 'sun', els: [['sun', 1]], river: [0, 0], alpha: k, noRiver: true });
      scribble(ctx, bad.x - 10, bad.y - 10, bad.x + tw, bad.y + th, k, { color: C.red, width: 12 });
      textIn(ctx, 'river must reach your lake', bad.x + tw / 2, bad.y + th + 50, k, { size: 34, weight: 700, family: BODY, align: 'center', color: C.red });
      textIn(ctx, 'STARTING TREE', G(1, 1).x + tw / 2 - 5, G(1, 1).y + th + 40, S.PW(0, 'starting tree', 0.5), { size: 30, weight: 700, align: 'center', color: LF.water });
    }
    if (S.step === 1) {
      const k = S.PW(1, 'upright', 0.5), kc = S.PW(1, 'never your starting', 0.5);
      arrow(ctx, 330, 600, 330, 380, k, { color: LF.forest, width: 8 });
      textIn(ctx, 'crown up', 330, 650, k, { size: 40, weight: 700, align: 'center', color: LF.forest });
      stamp(ctx, 'NEVER THE STARTING TREE', 960, 760, kc, { size: 44, rot: -4 });
      textIn(ctx, 'covered tree loses its effect', 1600, 470, S.PW(1, 'cover', 0.5), { size: 30, weight: 600, family: BODY, align: 'center' });
    }
    if (S.step === 2) {
      const k = S.PW(2, 'trigger', 0.6), a = G(1, 0), b = G(1, 2);
      circleMark(ctx, a.x + tw * 0.8, a.y + th * 0.72, 40, 40, k, { color: C.red, width: 6 });
      circleMark(ctx, b.x + tw * 0.8, b.y + th * 0.72, 40, 40, k, { color: C.red, width: 6, seed: 12 });
      stamp(ctx, 'SAME BONUS → TRIGGER IT', 1560, 640, k, { size: 40, rot: -4, color: LF.forest });
    }
    if (S.step === 3) {
      const k = S.PW(3, 'every action', 0.5);
      textIn(ctx, 'tree elements count for every action, every round', 960, 1000, k, { size: 40, weight: 700, family: BODY, align: 'center' });
      stamp(ctx, '3 × 3 = WIN', 1640, 520, S.PW(3, 'wins the game', 0.5), { size: 70, rot: -6, color: LF.forest });
    }
  },

  // ---------------------------------------------------------------- Onibi
  onibi(ctx, S) {
    paper(ctx, S.t);
    const w = 180, h = 260, gap = 20, x0 = 270, y = 420;
    const pos = clearingRow(ctx, x0, y, w, h, gap);
    // ends
    text(ctx, 'SUMMER’S END', x0 - 40, y + h + 70, { size: 32, weight: 700, color: LF.sumD });
    text(ctx, 'WINTER’S END', x0 + 7 * (w + gap) + 20, y + h + 70, { size: 32, weight: 700, color: LF.winD, align: 'right' });
    // Onibi card holder box
    const holder = (S.step >= 5) ? 'win' : (S.step === 4 ? 'sum' : 'supply');
    const boxes = { supply: { x: 960, y: 150, lab: 'SUPPLY' }, sum: { x: 230, y: 230, lab: 'SUMMER' }, win: { x: 1690, y: 230, lab: 'WINTER' } };
    Object.entries(boxes).forEach(([k, b]) => { ctx.save(); ctx.globalAlpha = 0.6; ctx.setLineDash([8, 8]); ctx.strokeStyle = C.ink3; ctx.lineWidth = 3; roundRect(ctx, b.x - 70, b.y - 70, 140, 140, 12); ctx.stroke(); ctx.restore(); text(ctx, b.lab, b.x, b.y + 100, { size: 24, weight: 700, align: 'center', color: C.ink2 }); });
    let cardAt = boxes[holder];
    if (S.step === 3) { const k = S.PW(3, 'takes it', 0.8); cardAt = { x: lerp(boxes.supply.x, boxes.win.x, easeInOut(k)), y: lerp(boxes.supply.y, boxes.win.y, easeInOut(k)) }; }
    if (S.step === 4) { const k = S.PW(4, 'put it back', 0.8); cardAt = { x: lerp(boxes.sum.x, boxes.supply.x, easeInOut(k)), y: lerp(boxes.sum.y, boxes.supply.y, easeInOut(k)) }; }
    cutout(ctx, IMG.onibi_card, cardAt.x - 60, cardAt.y - 55, 120, { rot: 3 });
    text(ctx, 'ONIBI CARD', cardAt.x, cardAt.y - 80, { size: 22, weight: 700, align: 'center', color: C.red });
    // Onibi position by step
    let o = 3;
    const hop = (from, to, k) => lerp(from, to, easeInOut(k));
    if (S.step === 0) o = hop(3, 6, S.PW(0, 'up to one card', 1.4));
    if (S.step === 1) o = 6;
    if (S.step === 2) o = hop(6, 7.2, S.PW(2, 'runs off', 0.8));
    if (S.step === 3) o = hop(-1.2, 1, S.PW(3, 'carries on', 1.0));
    if (S.step === 4) o = hop(-1.2, 1, S.PW(4, 'carries on', 1.0));
    if (S.step === 5) o = hop(6, 7.4, S.PW(5, 'already', 0.8));
    const ox = x0 + o * (w + gap) + w / 2, oy = y - 70 - Math.abs(Math.sin(o * Math.PI)) * 40;
    if (o > -0.9 && o < 7.1) onibiFigure(ctx, ox, oy, 50);
    if (S.step === 0) {
      [0, 1, 2].forEach((i) => { const k = S.PW(0, 'spiral', 0.4, i * 0.15); elementIcon(ctx, 'spiral', 840 + i * 120, 790, 46 * easeBack(k), { alpha: k }); });
      textIn(ctx, '3 spirals → up to 3 cards toward Winter', 960, 900, S.PW(0, 'toward', 0.5), { size: 38, weight: 700, family: BODY, align: 'center' });
    }
    if (S.step === 1) {
      const k = S.PW(1, 'bonus action', 0.6);
      circleMark(ctx, pos[6].cx, y + h * 0.78, 50, 50, k, { color: C.red, width: 7 });
      textIn(ctx, 'take the bonus action you land on', 960, 860, k, { size: 40, weight: 700, family: BODY, align: 'center' });
    }
    if (S.step >= 2) {
      const opts = ['card in supply → opponent takes it, Onibi continues', 'you hold it → put it back, Onibi continues', 'opponent holds it → YOU WIN'];
      opts.forEach((s, i) => {
        const k = S.P(2, 0.6 + i * 0.25, 0.4), cur = S.step === 3 + i;
        const yy = 800 + i * 70;
        ctx.save(); ctx.globalAlpha = k * (S.step >= 3 && !cur ? 0.45 : 1);
        if (cur) highlight(ctx, 300, yy - 46, measure(ctx, `${i + 1}. ${s}`, { size: 40, weight: 700 }) + 40, 62, S.P(3 + i, 0, 0.5), C.yellow, 20 + i);
        text(ctx, `${i + 1}. ${s}`, 320, yy, { size: 40, weight: 700 });
        ctx.restore();
      });
    }
    if (S.step === 5) stamp(ctx, 'SUMMER WINS', 960, 345, S.PW(5, 'you win', 0.5), { size: 80, rot: -6, color: LF.sumD });
  },

  // ---------------------------------------------------------------- end of round fire check
  fire(ctx, S) {
    paper(ctx, S.t);
    const w = 180, h = 260, gap = 20, x0 = 270, y = 140;
    const burning = [1, 2, 5];
    const glow = CLEAR_VALS.map((_, i) => (burning.includes(i) && S.step <= 2 ? 0.8 * S.PW(0, 'every clearing', 0.6) : 0));
    const pos = clearingRow(ctx, x0, y, w, h, gap, { glow });
    onibiFigure(ctx, pos[2].cx, y - 30, 42);
    const tokOn = [1, 5].concat(S.step >= 3 && S.PW(3, 'gets a fire', 0.5) > 0.5 ? [3] : []);
    tokOn.forEach((i) => fireToken(ctx, pos[i].cx, y + h * 0.58, 34));
    const kf = S.PW(0, 'add up', 0.6);
    if (S.step <= 2) {
      textIn(ctx, 'FIRE  =  3 + 2 + 3  =  8', 960, 500, S.PW(0, 'fire token on it', 0.5), { size: 64, weight: 700, align: 'center', color: LF.fire });
      void kf;
    }
    if (S.step >= 1 && S.step <= 2) {
      const bars = [['WINTER', LF.winD, [2, 3, 2], 7, 'their water'], ['SUMMER', LF.sumD, [4, 3, 2], 9, 'personal line']];
      bars.forEach(([lab, col, parts, tot, w], i) => {
        const k = S.PW(1, w, 0.6), yy = 600 + i * 150;
        if (k <= 0) return;
        ctx.save(); ctx.globalAlpha = k;
        text(ctx, lab, 260, yy + 50, { size: 44, weight: 700, color: col, align: 'right' });
        let x = 300;
        const names = ['help line', 'forest', 'personal'];
        parts.forEach((v, j) => { ctx.fillStyle = ['#7DB6EB', '#3D8FDB', '#1F5FA8'][j]; ctx.fillRect(x, yy, v * 90 * easeOut(k), 70); text(ctx, `${v}`, x + v * 45, yy + 50, { size: 36, weight: 700, color: C.white, align: 'center' }); text(ctx, names[j], x + v * 45, yy + 100, { size: 22, weight: 600, family: BODY, color: C.ink2, align: 'center' }); x += v * 90; });
        elementIcon(ctx, 'water', x + 60, yy + 35, 34);
        text(ctx, `= ${tot}`, x + 110, yy + 55, { size: 56, weight: 700, color: LF.water });
        ctx.restore();
      });
      // fire line marker at 8
      const k8 = S.PW(1, 'compares', 0.5);
      ctx.save(); ctx.globalAlpha = k8; stroke(ctx, LF.fire, 5); ctx.setLineDash([12, 8]); ctx.beginPath(); ctx.moveTo(300 + 8 * 90, 570); ctx.lineTo(300 + 8 * 90, 900); ctx.stroke(); ctx.restore();
      textIn(ctx, 'fire 8', 300 + 8 * 90, 560, k8, { size: 30, weight: 700, align: 'center', color: LF.fire });
    }
    if (S.step === 2) {
      stamp(ctx, '8 > 7 → 3 FIRE VARANS', 1560, 640, S.PW(2, 'strictly higher', 0.5), { size: 44, rot: -4 });
      for (let i = 0; i < 3; i++) { const k = S.PW(2, 'for every burning', 0.7, i * 0.25); flyCard(ctx, k, 1450, 680, 1640 + i * 12, 760 + i * 6, { varan: true, season: 'win' }); }
      textIn(ctx, '→ discard pile, shuffled back in later', 1500, 1030, S.PW(2, 'shuffled back', 0.5), { size: 30, weight: 700, family: BODY, align: 'center' });
      stamp(ctx, 'SUMMER IS SAFE', 1560, 540, S.PW(2, 'burning card', 0.5, 0.6), { size: 36, rot: 3, color: LF.forest });
    }
    if (S.step === 3) {
      const k = S.PW(3, 'spreads', 0.6);
      arrow(ctx, pos[2].cx - 30, y - 70, pos[1].cx + 10, y - 20, k, { color: LF.fire, bend: 30 });
      arrow(ctx, pos[2].cx + 30, y - 70, pos[3].cx - 10, y - 20, k, { color: LF.fire, bend: -30 });
      textIn(ctx, 'already has a token: nothing happens', pos[1].cx, y + h + 60, S.PW(3, "doesn't have", 0.5), { size: 28, weight: 600, family: BODY, align: 'center' });
      textIn(ctx, 'new fire token', pos[3].cx, y + h + 60, S.PW(3, 'gets a fire', 0.5), { size: 28, weight: 700, family: BODY, align: 'center', color: LF.fire });
      // edge rule inset
      const ke = S.PW(3, 'at the edge', 0.6);
      ctx.save(); ctx.globalAlpha = ke;
      panel(ctx, 300, 600, 1320, 330, { fill: C.white });
      text(ctx, 'AT THE EDGE', 340, 660, { size: 40, weight: 700 });
      for (let i = 0; i < 7; i++) { ctx.fillStyle = i === 0 ? '#E8B07A' : '#D8D9B2'; roundRect(ctx, 360 + i * 170, 700, 150, 180, 10); ctx.fill(); }
      onibiFigure(ctx, 435, 690, 32);
      fireToken(ctx, 435 + 170, 800, 28); fireToken(ctx, 435 + 6 * 170, 800, 28);
      ctx.restore();
      arrow(ctx, 470, 690, 435 + 6 * 170, 690, ke, { color: LF.fire, bend: -90, width: 6 });
    }
    if (S.step === 4) {
      const k = S.P(4, 0.2, 0.6);
      ctx.save(); ctx.globalAlpha = k;
      tokens(ctx, 640, 560, 'sum', 2); tokens(ctx, 1240, 560, 'win', 2);
      ctx.fillStyle = C.ink; roundRect(ctx, 460, 720, 1000, 120, 14); ctx.fill();
      ctx.restore();
      textIn(ctx, 'TOKENS BACK · LINES TO THE DISCARD PILE', 960, 798, k, { size: 44, weight: 700, align: 'center', color: C.yellow });
      textIn(ctx, '→ next round', 960, 920, S.PW(4, 'next round', 0.5), { size: 48, weight: 700, family: BODY, align: 'center' });
    }
  },

  // ---------------------------------------------------------------- wrap-up
  wrap(ctx, S) {
    paper(ctx, S.t);
    const panels = [
      ['EVERY REVEAL IS A GAMBLE', (x, y) => { animalCard(ctx, x - 140, y - 110, 130, 190, { season: null, els: [['sun', 2], ['water', 1]] }); animalCard(ctx, x + 10, y - 110, 130, 190, { season: null, els: [['plant', 1]], sym: 'sol' }); }],
      ['EVERY ACTION DRAINS THE WELL', (x, y) => { animalCard(ctx, x - 140, y - 110, 130, 190, { season: null, els: [['water', 2]], usedEls: [0] }); actionToken(ctx, x + 75, y + 20, 50, 'win'); }],
      ['FOUR WAYS TO WIN', (x, y) => { fireToken(ctx, x - 90, y - 50, 40); seasonHex(ctx, x + 90, y - 50, 40, 'sum'); elementIcon(ctx, 'plant', x - 90, y + 60, 40); onibiFigure(ctx, x + 90, y + 60, 40); }],
    ];
    panels.forEach(([t, draw], i) => {
      const k = S.P(i, 0, 0.6), x = 360 + i * 600, y = 470;
      if (k <= 0) return;
      ctx.save(); ctx.globalAlpha = clamp(k * 2);
      ctx.translate(x, y); const sc = easeBack(k); ctx.scale(sc, sc); ctx.translate(-x, -y);
      panel(ctx, x - 260, y - 230, 520, 560, { fill: C.white });
      draw(x, y - 20);
      const words = t.split(' '), half = Math.ceil(words.length / 2);
      text(ctx, words.slice(0, half).join(' '), x, y + 220, { size: 44, weight: 700, align: 'center' });
      text(ctx, words.slice(half).join(' '), x, y + 270, { size: 44, weight: 700, align: 'center' });
      ctx.restore();
    });
    if (S.step >= 2) {
      const ws = [['fight the fire', 'fight the fire'], ['flood the recruitment line', 'flood'], ['grow your forest', 'grow'], ['chase your rival', 'chase']];
      ws.forEach(([s, w], i) => textIn(ctx, s, [260, 720, 1180, 1640][i], 920, S.PW(2, w, 0.5), { size: 38, weight: 700, family: BODY, align: 'center', color: [LF.water, LF.sumD, LF.forest, LF.fire][i] }));
    }
  },

  // ---------------------------------------------------------------- outro
  outro(ctx, S) {
    paper(ctx, S.t);
    cutout(ctx, IMG.setup, 610, 90, 700, { rot: -1, alpha: clamp(S.lt / 0.8) });
    const k = S.PW(0, 'save the forest', 0.5), tw = measure(ctx, 'SAVE THE FOREST FIRST.', { size: 90, weight: 700 });
    highlight(ctx, W / 2 - tw / 2 - 24, 800, tw + 48, 112, k, C.yellow, 21);
    textIn(ctx, 'SAVE THE FOREST FIRST.', W / 2, 888, k, { size: 90, weight: 700, align: 'center' });
    textIn(ctx, 'Unofficial rules explainer for Living Forest Duel. Card, board and component images are cropped from the game’s rulebook.',
      W / 2, 1010, clamp((S.t - S.beatEnd(0) - 0.4) / 0.8), { size: 24, weight: 500, family: BODY, align: 'center', color: C.ink2 });
  },
};

// ------------------------------------------------------------------ forest tile + collage items
function forestTile(ctx, x, y, w, h, o = {}) {
  ctx.save(); if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  shadowBox(ctx, x, y, w, h, 10, 10, 0.22, 5);
  ctx.fillStyle = '#4C9A55'; roundRect(ctx, x, y, w, h, 10); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.arc(x + rnd(i + x) * w, y + rnd(i * 3 + y) * h, 6 + rnd(i * 7) * 10, 0, 7); ctx.fill(); }
  // river toward the lake
  ctx.strokeStyle = '#9FD6F0'; ctx.lineWidth = Math.max(8, w * 0.04); ctx.lineCap = 'round';
  if (o.lake) {
    ctx.fillStyle = '#9FD6F0'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w * 0.36, h * 0.34, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#EDE8F7'; ctx.beginPath(); ctx.arc(x + w / 2 - 14, y + h / 2, 22, 0, 7); ctx.arc(x + w / 2 + 14, y + h / 2 - 6, 24, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
  } else if (o.river && !o.noRiver) {
    const [dx, dy] = o.river;              // direction from lake to this tile -> river runs back toward the lake side
    ctx.beginPath(); ctx.moveTo(x + w / 2, y + h / 2);
    ctx.lineTo(x + w / 2 - dx * w / 2, y + h / 2 - dy * h / 2); ctx.stroke();
  } else if (o.noRiver) {
    ctx.beginPath(); ctx.moveTo(x + w * 0.2, y + h * 0.8); ctx.quadraticCurveTo(x + w / 2, y + h * 0.4, x + w * 0.8, y + h * 0.8); ctx.stroke();
  }
  if (!o.lake) {
    ctx.fillStyle = ['#E5C940', '#2F6D52', '#D9483B', '#C77DC3'][Math.floor(rnd(x + y) * 4)];
    ctx.beginPath(); ctx.arc(x + w * 0.35, y + h * 0.42, h * 0.22, 0, 7); ctx.arc(x + w * 0.45, y + h * 0.34, h * 0.2, 0, 7); ctx.fill();
    (o.els || []).forEach(([n, v], i) => {
      ctx.fillStyle = C.white; roundRect(ctx, x + 8, y + 8 + i * 40, 76, 34, 6); ctx.fill();
      text(ctx, String(v), x + 26, y + 34 + i * 40, { size: 24, weight: 700, align: 'center' });
      elementIcon(ctx, n, x + 60, y + 25 + i * 40, 14, { disc: false });
    });
    if (o.bonus) bonusIcon(ctx, o.bonus, x + w * 0.8, y + h * 0.72, h * 0.15);
  }
  ctx.restore();
}

function drawItem(ctx, S, b, it, j) {
  const t0 = it.at ? S.W(b.step, it.at) : S.stepT(b.step) + 0.05 + j * 0.08;
  const k = clamp((S.t - t0 - (it.d || 0)) / (it.k === 'img' ? 0.6 : 0.5));
  if (k <= 0) return;
  let fade = 1;
  if (['ring', 'circle', 'arrow'].includes(it.k) && !it.keep) fade = 1 - S.P(b.step + 1, 0, 0.35);
  if (it.out !== undefined) fade = Math.min(fade, 1 - S.P(it.out, 0, 0.35));
  if (fade <= 0) return;
  ctx.save(); ctx.globalAlpha *= fade;
  switch (it.k) {
    case 'img': {
      const e = easeBack(k);
      cutout(ctx, IMG[it.src], it.x, it.y + (1 - e) * 30, it.w, { rot: it.rot || 0, alpha: clamp(k * 2), frame: it.frame !== false, scale: lerp(0.9, 1, e) });
      break;
    }
    case 'text': {
      const o = { size: it.size || 48, weight: it.weight || 700, family: it.family === 'body' ? BODY : DISPLAY, align: it.align || 'left', color: COL(it.color) };
      if (it.hl) {
        const tw = measure(ctx, it.s, o);
        const x = o.align === 'center' ? it.x - tw / 2 : o.align === 'right' ? it.x - tw : it.x;
        highlight(ctx, x - 16, it.y - o.size * 0.92, tw + 32, o.size * 1.22, k, C.yellow, j + 3);
      }
      textIn(ctx, it.s, it.x, it.y, k, o);
      break;
    }
    case 'stamp': stamp(ctx, it.s, it.x, it.y, k, { size: it.size || 60, rot: it.rot ?? -6, color: COL(it.color || 'red') }); break;
    case 'arrow': arrow(ctx, it.x1, it.y1, it.x2, it.y2, k, { color: COL(it.color || 'ink'), bend: it.bend || 0, width: 6 }); break;
    case 'circle': circleMark(ctx, it.x, it.y, it.rx, it.ry, k, { color: COL(it.color || 'red'), width: 7 }); break;
    case 'ring': {
      ctx.save(); ctx.globalAlpha *= clamp(k * 2) * (0.85 + 0.15 * Math.sin(S.t * 5));
      ctx.strokeStyle = COL(it.color || 'yellow'); ctx.lineWidth = 9;
      roundRect(ctx, it.x - 6, it.y - 6, (it.w + 12) * easeOut(k), it.h + 12, 12); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'icon': elementIcon(ctx, it.name, it.x, it.y, it.s * easeBack(k), { alpha: clamp(k * 2) }); break;
  }
  ctx.restore();
}
