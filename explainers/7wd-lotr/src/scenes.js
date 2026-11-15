// One drawing function per scene. Each receives the timing helper S (see app.js):
//   S.step current step · S.P(step, delay, dur) eased-in progress · S.PW(step, word) progress from a spoken word
// Illustrations are original diagrams (no game artwork).
'use strict';

const CARD_COLS = [C.grey, C.ycard, C.blue, C.green, C.red, C.grey, C.blue, C.green, C.ycard, C.red];
const SKILLS = ['Ruse', 'Strength', 'Courage', 'Knowledge', 'Leadership'];
const RACES = ['Elves', 'Dwarves', 'Hobbits', 'Humans', 'Ents', 'Wizards'];

// icon for a card face by colour
function faceIcon(col) {
  return (ctx, x, y, s) => {
    if (col === C.blue) { ringIcon(ctx, x - s * 0.55, y, s * 0.45, C.blue, s * 0.18); ringIcon(ctx, x + s * 0.55, y, s * 0.45, C.blue, s * 0.18); }
    else if (col === C.ycard) coin(ctx, x, y, s * 0.7);
    else if (col === C.green) RACE_ICONS[RACES[Math.floor(x + y) % 6]](ctx, x, y, s * 0.75);
    else if (col === C.red) { unit(ctx, x - s * 0.45, y, 'f', s * 0.55); unit(ctx, x + s * 0.45, y, 'f', s * 0.55); }
    else if (col === C.purple) { ctx.save(); stroke(ctx, C.purple, s * 0.2); ctx.beginPath(); ctx.moveTo(x - s * 0.7, y); ctx.lineTo(x + s * 0.6, y); ctx.moveTo(x + s * 0.2, y - s * 0.4); ctx.lineTo(x + s * 0.65, y); ctx.lineTo(x + s * 0.2, y + s * 0.4); ctx.stroke(); ctx.restore(); }
    else SKILL_ICONS[SKILLS[Math.floor(x * 7 + y) % 5]](ctx, x, y, s * 0.7, '#6E6D68');
  };
}

// ------------------------------------------------------------------ the card pyramid (7 Wonders Duel age layout)
const PYR = (() => {
  const rows = [2, 3, 4, 5, 6], cw = 110, ch = 160, gap = 10, out = [];
  rows.forEach((n, r) => {
    for (let i = 0; i < n; i++) {
      const x = W / 2 - (n * cw + (n - 1) * gap) / 2 + i * (cw + gap), y = 150 + r * ch * 0.56;
      out.push({ r, i, x, y, cw, ch, back: r % 2 === 1, col: CARD_COLS[(r * 7 + i * 3) % CARD_COLS.length] });
    }
  });
  return out;
})();
function drawPyramid(ctx, S, o = {}) {
  PYR.forEach((c, n) => {
    const k = o.dropStep !== undefined ? S.P(o.dropStep, n * 0.07, 0.45) : 1;
    if (k <= 0) return;
    const e = easeBack(k);
    const avail = c.r === 4;
    let x = c.x, y = c.y - (1 - e) * 120;
    let glow = o.glow ? o.glow * (avail ? 1 : 0) : 0;
    let dim = o.dim && !avail ? o.dim : 0;
    if (o.lift && c.r === 4 && c.i === 2) { y -= 260 * easeInOut(o.lift); x += 520 * easeInOut(o.lift); glow = 0; }
    card(ctx, x, y, c.cw, c.ch, { back: c.back && !(o.reveal), color: c.col, icon: faceIcon(c.col), alpha: clamp(k * 2), glow, dim });
  });
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
    const k = clamp((S.lt - 0.25) / 0.5);
    const words = title.toUpperCase();
    const size = Math.min(128, Math.floor(128 * 1100 / measure(ctx, words, { size: 128, weight: 700 })));
    textIn(ctx, words, 720, 540 + size * 0.35, k, { size, weight: 700 });
    scribble(ctx, 722, 540 + size * 0.35 + 40, 722 + measure(ctx, words, { size, weight: 700 }), 540 + size * 0.35 + 45, clamp((S.lt - 0.6) / 0.5), { width: 9, seed: 11, color: C.ink });
  },

  // ---------------------------------------------------------------- pyramid (open + turn)
  pyramid(ctx, S) {
    paper(ctx, S.t);
    if (S.seg.firstStep <= 2 && S.step >= 2) {        // Middle-earth tint in the cold open
      ctx.save(); ctx.globalAlpha = 0.55 * S.P(2, 0.2, 1.2);
      ctx.fillStyle = C.parch; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    if (S.seg.firstStep === 0) {
      drawPyramid(ctx, S, { dropStep: 0, glow: S.step >= 1 ? 0.6 * S.PW(1, 'overlapping', 0.4) * (1 - S.PW(1, 'three rounds', 0.4)) : 0 });
      text(ctx, '7 WONDERS DUEL', W / 2, 105, { size: 44, weight: 600, align: 'center', spacing: 8, color: C.ink2, alpha: S.P(0, 0.4) * (1 - S.P(2, 0.2, 0.5)) });
      const labels = [['PYRAMID DRAFT', 'pyramid', 420], ['3 ROUNDS', 'three rounds', 960], ['SUDDEN WINS', 'win suddenly', 1500]];
      labels.forEach(([s, w, x], j) => {
        const k = S.PW(1, w, 0.45);
        const fade = 1 - S.P(2, 0, 0.4);
        const tw = measure(ctx, s, { size: 64, weight: 700 });
        ctx.save(); ctx.globalAlpha = fade;
        highlight(ctx, x - tw / 2 - 18, 800, tw + 36, 78, k, C.yellow, 4 + j);
        textIn(ctx, s, x, 862, k, { size: 64, weight: 700, align: 'center' });
        ctx.restore();
      });
      if (S.step >= 2) {
        const k1 = S.PW(2, 'antoine', 0.5), k2 = S.PW(2, 'middle-earth', 0.6);
        textIn(ctx, 'ANTOINE BAUZA  ·  BRUNO CATHALA  ·  2024', W / 2, 870, k1, { size: 46, weight: 600, align: 'center', spacing: 4 });
        ringIcon(ctx, W / 2, 410, 330 * easeBack(k2), `rgba(201,162,39,${0.85 * k2})`, 26);
        textIn(ctx, '→ MIDDLE-EARTH', W / 2, 960, S.PW(2, 'changed what', 0.5), { size: 54, weight: 700, align: 'center', color: C.saur });
      }
    } else {
      // the turn: only uncovered cards can be taken
      const lift = S.PW(3, 'take a card', 0.9);
      drawPyramid(ctx, S, { glow: S.PW(3, 'only take', 0.5) * (1 - lift * 0.6), dim: S.PW(3, 'covering', 0.5), lift });
      const k = S.PW(3, 'only take', 0.5);
      const tw = measure(ctx, 'AVAILABLE = UNCOVERED', { size: 58, weight: 700 });
      highlight(ctx, W / 2 - tw / 2 - 18, 815, tw + 36, 74, k, C.yellow, 9);
      textIn(ctx, 'AVAILABLE = UNCOVERED', W / 2, 873, k, { size: 58, weight: 700, align: 'center' });
      textIn(ctx, 'covered cards wait their turn', W / 2, 940, S.PW(3, 'covering', 0.5), { size: 34, weight: 500, family: BODY, align: 'center', color: C.ink2 });
    }
  },

  // ---------------------------------------------------------------- title
  title(ctx, S) {
    paper(ctx, S.t);
    ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = C.parch; ctx.fillRect(0, 0, W, H); ctx.restore();
    const k = clamp(S.lt / 0.8);
    ctx.save(); ctx.translate(W / 2, 520); ctx.rotate(S.t * 0.05);
    ringIcon(ctx, 0, 0, 380 * easeOut(k), `rgba(201,162,39,${0.35 * k})`, 34); ctx.restore();
    textIn(ctx, 'THE LORD OF THE RINGS', W / 2, 330, clamp((S.lt - 0.2) / 0.6), { size: 58, weight: 500, align: 'center', spacing: 14, color: C.ink2 });
    textIn(ctx, 'DUEL FOR', W / 2, 470, clamp((S.lt - 0.45) / 0.6), { size: 120, weight: 700, align: 'center', spacing: 6 });
    textIn(ctx, 'MIDDLE-EARTH', W / 2, 640, clamp((S.lt - 0.65) / 0.6), { size: 196, weight: 700, align: 'center', spacing: 4 });
    const k2 = S.PW(0, 'took away', 0.6);
    const s = 'explained for 7 Wonders Duel players';
    const tw = measure(ctx, s, { size: 52, weight: 500, family: BODY });
    highlight(ctx, W / 2 - tw / 2 - 20, 712, tw + 40, 76, clamp((S.lt - 1.2) / 0.6), C.yellow, 2);
    textIn(ctx, s, W / 2, 765, clamp((S.lt - 1.2) / 0.6), { size: 52, weight: 500, family: BODY, align: 'center' });
    textIn(ctx, 'Unofficial fan explainer', W / 2, 960, clamp((S.lt - 1.6) / 0.6), { size: 30, weight: 500, family: BODY, align: 'center', color: C.ink3 });
    void k2;
  },

  // ---------------------------------------------------------------- the scoreboard that no longer exists
  score(ctx, S) {
    paper(ctx, S.t);
    const x = 560, y = 170, w = 800, h = 690;
    panel(ctx, x, y, w, h, { fill: C.white });
    text(ctx, '7 WONDERS DUEL · FINAL SCORE', x + w / 2, y + 80, { size: 44, weight: 700, align: 'center', spacing: 3 });
    scribble(ctx, x + 60, y + 108, x + w - 60, y + 108, 1, { width: 3, color: C.ink3 });
    const rows = [['Blue cards', 14, C.blue, 'blue cards'], ['Wonders', 9, C.ink2, 'wonders'], ['Guilds', 5, C.purple, 'guilds'], ['Coins', 4, C.ycard, 'coins']];
    rows.forEach(([lab, n, col, w2], i) => {
      const k = S.PW(0, w2, 0.4), yy = y + 190 + i * 92;
      ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = col; roundRect(ctx, x + 70, yy - 36, 18, 44, 4); ctx.fill(); ctx.restore();
      textIn(ctx, lab, x + 110, yy, k, { size: 50, weight: 500, family: BODY });
      textIn(ctx, String(n), x + w - 80, yy, k, { size: 58, weight: 700, align: 'right' });
    });
    const kt = S.PW(0, 'highest', 0.5);
    scribble(ctx, x + 60, y + 560, x + w - 60, y + 560, kt, { width: 4 });
    textIn(ctx, 'TOTAL', x + 110, y + 630, kt, { size: 58, weight: 700 });
    highlight(ctx, x + w - 210, y + 578, 150, 72, kt, C.yellow, 5);
    textIn(ctx, '32', x + w - 80, y + 635, kt, { size: 70, weight: 700, align: 'right' });
    if (S.step >= 1) {
      const k1 = S.P(1, 0.2, 0.5), k2 = S.P(1, 0.5, 0.5);
      scribble(ctx, x - 20, y - 10, x + w + 20, y + h + 10, k1, { width: 16, color: C.red, wobble: 6, seed: 2 });
      scribble(ctx, x + w + 20, y - 10, x - 20, y + h + 10, k2, { width: 16, color: C.red, wobble: 6, seed: 5 });
      stamp(ctx, 'NO VICTORY POINTS', W / 2, 520, S.PW(1, 'victory points', 0.5), { size: 92, rot: -9 });
    }
  },

  // ---------------------------------------------------------------- three ways to win
  three(ctx, S) {
    paper(ctx, S.t);
    const items = [
      ['THE QUEST', 'of the Ring', (x, y) => { volcano(ctx, x + 70, y + 80, 90); ringIcon(ctx, x - 70, y + 10, 70, C.gold, 20); }],
      ['THE RACES', 'support of six races', (x, y) => { RACES.forEach((r, i) => { const a = -Math.PI / 2 + i * Math.PI / 3; RACE_ICONS[r](ctx, x + Math.cos(a) * 95, y + 10 + Math.sin(a) * 95, 36); }); }],
      ['CONQUEST', 'of Middle-earth', (x, y) => { miniMap(ctx, x - 150, y - 115, 300, 240, { tint: true }); }],
    ];
    const tw = measure(ctx, '3 WAYS TO WIN', { size: 84, weight: 700 });
    highlight(ctx, W / 2 - tw / 2 - 24, 104, tw + 48, 104, S.P(0, 0.1, 0.5), C.yellow, 3);
    text(ctx, '3 WAYS TO WIN', W / 2, 186, { size: 84, weight: 700, align: 'center', alpha: S.P(0, 0.1, 0.4) });
    items.forEach(([t1, t2, draw], i) => {
      const k = S.PW(0, 'three of them', 0.5, i * 0.35), x = 420 + i * 540, y = 470;
      if (k <= 0) return;
      ctx.save(); ctx.globalAlpha = clamp(k * 2); ctx.translate(x, y); const sc = easeBack(k); ctx.scale(sc, sc); ctx.translate(-x, -y);
      panel(ctx, x - 230, y - 190, 460, 520, { fill: C.white });
      draw(x, y - 10);
      text(ctx, t1, x, y + 220, { size: 60, weight: 700, align: 'center' });
      text(ctx, t2, x, y + 270, { size: 32, weight: 500, family: BODY, align: 'center', color: C.ink2 });
      ctx.restore();
    });
    stamp(ctx, 'INSTANT WIN', W / 2, 935, S.PW(0, 'instant', 0.5), { size: 70, rot: -4 });
    if (S.step >= 1) {
      const k = S.PW(1, 'piece by piece', 0.6);
      textIn(ctx, '…so let\'s build it, piece by piece', W / 2, 1035, k, { size: 36, weight: 500, family: BODY, align: 'center', color: C.ink2 });
    }
  },

  // ---------------------------------------------------------------- Fellowship vs Sauron
  sides(ctx, S) {
    paper(ctx, S.t);
    const kL = S.PW(0, 'fellowship', 0.6), kR = S.PW(0, 'sauron', 0.6);
    ctx.save(); ctx.globalAlpha = 0.16 * kL; ctx.fillStyle = C.fell; ctx.fillRect(0, 0, W / 2, H); ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.16 * kR; ctx.fillStyle = C.saur; ctx.fillRect(W / 2, 0, W / 2, H); ctx.restore();
    scribble(ctx, W / 2, 120, W / 2, 960, S.P(0, 0, 0.6), { width: 5, color: C.ink, wobble: 3 });
    if (kL > 0) {
      ctx.save(); ctx.globalAlpha = kL;
      hobbitsPiece(ctx, 400, 420, 150 * easeBack(kL));
      text(ctx, 'THE FELLOWSHIP', 400, 680, { size: 76, weight: 700, align: 'center', color: C.fell });
      ctx.restore();
    }
    if (kR > 0) {
      ctx.save(); ctx.globalAlpha = kR;
      eyeIcon(ctx, 1520, 400, 110 * easeBack(kR));
      text(ctx, 'SAURON', 1520, 680, { size: 76, weight: 700, align: 'center', color: C.saur });
      ctx.restore();
    }
    if (S.step >= 1) {
      stamp(ctx, 'GOES FIRST', 1520, 210, S.PW(1, 'first turn', 0.5), { size: 56, rot: 6, color: C.saur });
      for (let i = 0; i < 3; i++) { const k = S.PW(1, 'three coins', 0.45, i * 0.15); if (k > 0) coin(ctx, 320 + i * 80, 820 - (1 - easeBack(k)) * 200, 34, { alpha: clamp(k * 3) }); }
      for (let i = 0; i < 2; i++) { const k = S.PW(1, 'with two', 0.45, i * 0.15); if (k > 0) coin(ctx, 1480 + i * 80, 820 - (1 - easeBack(k)) * 200, 34, { alpha: clamp(k * 3) }); }
      textIn(ctx, '3 COINS', 400, 920, S.PW(1, 'three coins', 0.5, 0.3), { size: 46, weight: 600, align: 'center' });
      textIn(ctx, '2 COINS', 1520, 920, S.PW(1, 'with two', 0.5, 0.3), { size: 46, weight: 600, align: 'center' });
    }
    if (S.step >= 2) {
      const k = S.PW(2, 'same cards', 0.6);
      ctx.save(); ctx.globalAlpha = k;
      panel(ctx, W / 2 - 140, 330, 280, 290, { fill: C.paper2 });
      for (let i = 0; i < 4; i++) card(ctx, W / 2 - 60 + i * 6 - 10, 355 + i * 5, 110, 160, { back: true });
      text(ctx, 'SAME CARDS', W / 2, 595, { size: 38, weight: 700, align: 'center' });
      ctx.restore();
      const k2 = S.PW(2, 'what the ring', 0.6);
      ringIcon(ctx, W / 2, 780, 60 * easeBack(k2), `rgba(201,162,39,${k2})`, 16);
      textIn(ctx, '?', W / 2, 805, k2, { size: 70, weight: 700, align: 'center', color: C.ink });
    }
  },

  // ---------------------------------------------------------------- the three options
  turn(ctx, S) {
    paper(ctx, S.t);
    const tw = measure(ctx, 'ON YOUR TURN', { size: 76, weight: 700 });
    highlight(ctx, W / 2 - tw / 2 - 20, 92, tw + 40, 96, S.P(0, 0.1, 0.5), C.yellow, 8);
    text(ctx, 'ON YOUR TURN', W / 2, 168, { size: 76, weight: 700, align: 'center' });
    const xs = [380, 960, 1540];
    const titles = ['PLAY IT', 'DISCARD IT', 'TAKE A LANDMARK'];
    xs.forEach((x, i) => {
      const k = S.P(i + 1, 0, 0.55);
      if (k <= 0) { ctx.save(); ctx.globalAlpha = 0.25 * S.P(0, 0.2); panel(ctx, x - 250, 250, 500, 640, { fill: C.paper2 }); text(ctx, String(i + 1), x, 620, { size: 160, weight: 700, align: 'center', color: C.ink3 }); ctx.restore(); return; }
      ctx.save(); ctx.globalAlpha = clamp(k * 2);
      ctx.translate(x, 570); const sc = lerp(0.8, 1, easeBack(k)); ctx.scale(sc, sc); ctx.translate(-x, -570);
      panel(ctx, x - 250, 250, 500, 640, { fill: C.white, stroke: i === 2 && S.step >= 3 ? C.yellow : null, lw: 8 });
      text(ctx, titles[i], x, 335, { size: 54, weight: 700, align: 'center' });
      if (i === 0) {
        card(ctx, x - 80, 400, 160, 235, { color: C.green, icon: faceIcon(C.green), cost: ['Knowledge', 'coin'] });
        textIn(ctx, 'pay its cost,', x, 720, S.P(1, 0.5), { size: 36, weight: 500, family: BODY, align: 'center' });
        textIn(ctx, 'get its effect', x, 768, S.P(1, 0.7), { size: 36, weight: 500, family: BODY, align: 'center' });
      } else if (i === 1) {
        card(ctx, x - 80, 400, 160, 235, { back: false, color: C.red, icon: faceIcon(C.red), dim: 0.6 });
        scribble(ctx, x - 95, 420, x + 95, 620, S.P(2, 0.2, 0.4), { width: 10, color: C.red });
        [['chapter one', 1], ['chapter two', 2], ['chapter three', 3]].forEach(([w, n], j) => {
          const kk = S.PW(2, w, 0.4);
          const yy = 700 + j * 62;
          textIn(ctx, `CH.${n}`, x - 140, yy + 14, kk, { size: 40, weight: 600 });
          for (let c = 0; c < n; c++) if (kk > 0) coin(ctx, x - 10 + c * 58, yy, 24, { alpha: kk });
        });
      } else {
        landmarkTile(ctx, x - 190, 410, 380, 240, "HELM'S DEEP", 'ROHAN', 'f');
        textIn(ctx, "= this game's wonder", x, 730, S.PW(3, 'wonder', 0.5), { size: 38, weight: 600, family: BODY, align: 'center' });
        const kp = S.PW(3, 'hold that thought', 0.5);
        if (kp > 0) {
          ctx.save(); ctx.translate(x + 120, 810); ctx.rotate(0.06); ctx.scale(easeBack(kp), easeBack(kp));
          shadowBox(ctx, -150, -45, 300, 90, 4, 12, 0.25, 6);
          ctx.fillStyle = C.yellow; ctx.fillRect(-150, -45, 300, 90);
          text(ctx, 'HOLD THAT THOUGHT', 0, 14, { size: 36, weight: 700, align: 'center' });
          ctx.restore();
        }
      }
      ctx.restore();
    });
  },

  // ---------------------------------------------------------------- resources become skills
  skills(ctx, S) {
    paper(ctx, S.t);
    const res = ['Wood', 'Clay', 'Stone', 'Glass', 'Papyrus'];
    const fadeTop = S.step >= 1 ? 1 - 0.55 * S.P(1, 0.2, 0.6) : 1;
    text(ctx, '7 WONDERS DUEL · RESOURCES', 260, 190, { size: 40, weight: 600, spacing: 3, color: C.ink2, alpha: S.P(0, 0, 0.4) * fadeTop });
    res.forEach((r, i) => {
      const k = S.PW(0, r.toLowerCase(), 0.45), x = 470 + i * 270, y = 330;
      if (k <= 0) return;
      ctx.save(); ctx.globalAlpha = fadeTop * clamp(k * 2);
      panel(ctx, x - 95, y - 95, 190, 190, { fill: C.white });
      RESOURCE_ICONS[r](ctx, x, y - 10, 58 * easeBack(k));
      text(ctx, r.toUpperCase(), x, y + 72, { size: 30, weight: 600, align: 'center', color: C.ink2 });
      ctx.restore();
    });
    if (S.step >= 1) {
      const k = S.P(1, 0.3, 0.9), e = easeInOut(k);
      // a brown and a grey card slide together into one grey card
      const bx = lerp(140, 190, e), gx = lerp(270, 190, e), y = lerp(250, 610, e);
      if (k < 1) card(ctx, bx, y, 110, 160, { color: C.brown, icon: (c, x, yy, s) => RESOURCE_ICONS.Wood(c, x, yy, s * 0.8), alpha: 1 - k });
      card(ctx, gx, y, 110, 160, { color: C.grey, icon: faceIcon(C.grey) });
      textIn(ctx, 'BROWN + GREY', 245, 830, S.PW(1, 'single grey', 0.5), { size: 36, weight: 700, align: 'center' });
      textIn(ctx, '→ ONE GREY', 245, 876, S.PW(1, 'single grey', 0.5, 0.15), { size: 36, weight: 700, align: 'center' });
      text(ctx, 'DUEL FOR MIDDLE-EARTH · SKILLS', 610, 560, { size: 40, weight: 600, spacing: 3, color: C.ink2, alpha: S.PW(1, 'skills', 0.5) });
    }
    if (S.step >= 2) {
      SKILLS.forEach((s, i) => {
        const k = S.PW(2, s.toLowerCase(), 0.45), x = 680 + i * 255, y = 720;
        if (k <= 0) return;
        ctx.save(); ctx.globalAlpha = clamp(k * 2);
        ctx.fillStyle = '#6E6D68'; ctx.beginPath(); ctx.arc(x, y, 88 * easeBack(k), 0, 7); ctx.fill();
        SKILL_ICONS[s](ctx, x, y, 46 * easeBack(k), C.white);
        text(ctx, s.toUpperCase(), x, y + 140, { size: 38, weight: 700, align: 'center' });
        ctx.restore();
      });
    }
  },

  // ---------------------------------------------------------------- the price of a missing skill
  price(ctx, S) {
    paper(ctx, S.t);
    const L = { x: 110, y: 230, w: 800, h: 600 }, R = { x: 1010, y: 230, w: 800, h: 600 };
    // right panel first: the new rule
    panel(ctx, R.x, R.y, R.w, R.h, { fill: C.white });
    text(ctx, 'DUEL FOR MIDDLE-EARTH', R.x + R.w / 2, R.y + 70, { size: 42, weight: 700, align: 'center', spacing: 2 });
    const k0 = S.PW(0, 'pay one coin', 0.6);
    if (S.step < 2) {
      ctx.fillStyle = '#6E6D68'; ctx.beginPath(); ctx.arc(R.x + 230, R.y + 300, 80, 0, 7); ctx.fill();
      SKILL_ICONS.Courage(ctx, R.x + 230, R.y + 300, 42, C.white);
      ctx.save(); stroke(ctx, C.red, 10); ctx.beginPath(); ctx.moveTo(R.x + 160, R.y + 230); ctx.lineTo(R.x + 300, R.y + 370); ctx.stroke(); ctx.restore();
      text(ctx, 'missing skill', R.x + 230, R.y + 430, { size: 34, weight: 600, family: BODY, align: 'center' });
      arrow(ctx, R.x + 340, R.y + 300, R.x + 480, R.y + 300, k0, { width: 7 });
      if (k0 > 0) coin(ctx, R.x + 590, R.y + 300, 80 * easeBack(k0), { n: 1 });
      textIn(ctx, '= 1 COIN', R.x + 590, R.y + 450, k0, { size: 56, weight: 700, align: 'center' });
    } else {
      barChart(ctx, R, [1, 1, 1, 1], S.P(2, 0.1, 0.8), C.fell);
      const tw = measure(ctx, 'ALWAYS 1', { size: 64, weight: 700 });
      highlight(ctx, R.x + R.w / 2 - tw / 2 - 16, R.y + 100, tw + 32, 74, S.PW(2, 'flat', 0.5), C.yellow, 6);
      text(ctx, 'ALWAYS 1', R.x + R.w / 2, R.y + 160, { size: 64, weight: 700, align: 'center', alpha: S.PW(2, 'flat', 0.4) });
    }
    // left panel: 7 Wonders Duel's trade price
    const kL = S.P(1, 0, 0.5);
    if (kL > 0) {
      ctx.save(); ctx.globalAlpha = kL;
      panel(ctx, L.x, L.y, L.w, L.h, { fill: C.white });
      text(ctx, '7 WONDERS DUEL', L.x + L.w / 2, L.y + 70, { size: 42, weight: 700, align: 'center', spacing: 2 });
      text(ctx, '2 + copies your opponent makes', L.x + L.w / 2, L.y + 140, { size: 34, weight: 600, family: BODY, align: 'center', color: C.saur });
      barChart(ctx, L, [2, 3, 4, 5], S.P(1, 0.4, 1.4), C.saur);
      ctx.restore();
    }
    if (S.step >= 3) {
      const k = S.P(3, 0.1, 0.5);
      ctx.save(); ctx.globalAlpha = k;
      ctx.fillStyle = C.ink; roundRect(ctx, 210, 880, 1500, 120, 10); ctx.fill();
      text(ctx, 'GREY = CHEAPER TURNS FOR YOU', 600, 960, { size: 50, weight: 700, color: C.white, align: 'center' });
      card(ctx, 1120, 868, 70, 100, { color: C.ycard, icon: faceIcon(C.ycard), alpha: S.PW(3, 'yellow', 0.4) });
      text(ctx, 'YELLOW = COINS NOW', 1440, 960, { size: 46, weight: 700, color: C.yellow, align: 'center', alpha: S.PW(3, 'yellow', 0.4) });
      ctx.restore();
    }
  },

  // ---------------------------------------------------------------- the colour map
  colours(ctx, S) {
    paper(ctx, S.t);
    const rows = [
      [[C.brown, C.grey], 'Resources', [C.grey], 'Skills', 0, 'grey'],
      [[C.ycard], 'Coins & trade', [C.ycard], 'Coins', 0, 'yellow'],
      [[C.blue], 'Victory points', [C.blue], 'Quest of the Ring', 1, 'quest'],
      [[C.green], 'Science', [C.green], 'Races', 2, 'races'],
      [[C.red], 'Military track', [C.red], 'Units on the map', 3, 'armies'],
      [[C.purple], 'Guilds (Age III)', [C.purple], 'Chapter 3 tricks', 4, 'final chapter'],
    ];
    text(ctx, '7 WONDERS DUEL', 470, 150, { size: 46, weight: 700, align: 'center', color: C.ink2, spacing: 2 });
    text(ctx, 'DUEL FOR MIDDLE-EARTH', 1390, 150, { size: 46, weight: 700, align: 'center', spacing: 2 });
    rows.forEach(([lc, lt, rc, rt, step, word], i) => {
      const k = S.PW(step, word, 0.5), y = 200 + i * 128;
      if (k <= 0) return;
      ctx.save(); ctx.globalAlpha = clamp(k * 2);
      lc.forEach((c, j) => card(ctx, 180 + j * 34, y + 8, 64, 92, { color: c }));
      text(ctx, lt, 300, y + 72, { size: 46, weight: 500, family: BODY, color: C.ink2 });
      arrow(ctx, 790, y + 55, 970, y + 55, k, { width: 6, color: C.ink3 });
      rc.forEach((c, j) => card(ctx, 1040 + j * 34, y + 8, 64, 92, { color: c }));
      const cur = S.step === step;
      const tw = measure(ctx, rt, { size: 50, weight: 700 });
      if (cur) highlight(ctx, 1144, y + 22, tw + 32, 66, k, C.yellow, 10 + i);
      text(ctx, rt, 1160, y + 74, { size: 50, weight: 700 });
      ctx.restore();
    });
  },

  // ---------------------------------------------------------------- chaining
  chain(ctx, S) {
    paper(ctx, S.t);
    const k1 = S.P(0, 0.1, 0.5), k2 = S.PW(0, 'new card', 0.6);
    ctx.save(); ctx.globalAlpha = k1;
    text(ctx, 'CHAPTER 1', 560, 230, { size: 50, weight: 700, align: 'center', color: C.ink2 });
    card(ctx, 420, 270, 280, 410, { color: C.blue, icon: faceIcon(C.blue), chain: true, label: 'already played' });
    ctx.restore();
    const kc = S.PW(0, 'chain symbol', 0.5);
    circleMark(ctx, 420 + 280 * 0.8, 270 + 410 * 0.15, 55, 45, kc, { color: C.red, width: 7 });
    arrow(ctx, 760, 480, 1120, 480, k2, { width: 8, bend: -40 });
    ctx.save(); ctx.globalAlpha = k2;
    text(ctx, 'CHAPTER 2', 1360, 230, { size: 50, weight: 700, align: 'center', color: C.ink2 });
    card(ctx, 1220, 270, 280, 410, { color: C.blue, icon: faceIcon(C.blue), cost: ['Knowledge', 'Ruse', 'coin'] });
    chainIcon(ctx, 1220 + 280 * 0.82, 270 + 410 * 0.15, 30, C.white);
    ctx.restore();
    stamp(ctx, 'FREE', 1360, 520, S.PW(0, 'for free', 0.5), { size: 110, rot: -12 });
    const t2 = 'from chapter two on';
    const tw = measure(ctx, t2, { size: 54, weight: 600, family: BODY });
    highlight(ctx, W / 2 - tw / 2 - 18, 810, tw + 36, 76, S.PW(0, 'chapter two', 0.5), C.yellow, 12);
    textIn(ctx, t2, W / 2, 866, S.PW(0, 'chapter two', 0.5), { size: 54, weight: 600, family: BODY, align: 'center' });
  },

  // ---------------------------------------------------------------- the quest of the ring
  quest(ctx, S) {
    paper(ctx, S.t);
    const N = 16, x0 = 190, dx = 86, y = 600;
    const sx = (i) => x0 + i * dx;
    // frodo position f and gap g, animated between steps
    const plan = [[3, 3], [3, 3], [6, 3], [6, 2], [9, 2], [9, 1], [9, 1]];
    const at = (k) => plan[Math.min(k, plan.length - 1)];
    let [f, g] = at(S.step);
    if (S.step > 0) {
      const [pf, pg] = at(S.step - 1);
      const mk = S.step === 2 ? S.PW(2, 'head for', 1.2) : S.step === 3 ? S.PW(3, 'closing in', 1.0) : S.step === 4 ? S.PW(4, 'whenever', 1.4) : S.step === 5 ? S.PW(5, 'only ever shrinks', 1.0) : 1;
      const e = easeInOut(mk);
      f = lerp(pf, f, e); g = lerp(pg, g, e);
    }
    const kTrack = S.P(0, 0, 0.8);
    // track
    for (let i = 0; i < N; i++) {
      const k = clamp(kTrack * 1.6 - i / N);
      if (k <= 0) continue;
      ctx.save(); ctx.globalAlpha = k;
      shadowBox(ctx, sx(i) - 36, y - 36, 72, 72, 10, 8, 0.15, 4);
      ctx.fillStyle = C.parch; roundRect(ctx, sx(i) - 36, y - 36, 72, 72, 10); ctx.fill();
      ctx.strokeStyle = C.parch2; ctx.lineWidth = 3; roundRect(ctx, sx(i) - 36, y - 36, 72, 72, 10); ctx.stroke();
      if ([4, 8, 12].includes(i)) {
        const pulse = S.step >= 6 ? 1 + 0.12 * Math.sin(S.t * 6) * S.P(6, 0.2) : 1;
        coin(ctx, sx(i), y, 22 * pulse);
      }
      ctx.restore();
    }
    volcano(ctx, sx(N) + 60, y + 60, 120 * easeOut(kTrack));
    textIn(ctx, 'MOUNT DOOM', sx(N) + 60, y + 120, S.PW(0, 'mount doom', 0.5), { size: 38, weight: 700, align: 'center', color: C.saur });
    // the hobbits' piece: a slider from the Nazgûl to Frodo & Sam
    const kp = S.PW(0, 'frodo', 0.5), kn = S.PW(0, 'nazg', 0.5);
    const fx = sx(f), nx = sx(f - g);
    const ride = S.step >= 4 ? S.PW(4, 'ride on top', 0.6) : 0;
    if (kp > 0) {
      ctx.save(); ctx.globalAlpha = 0.25 + 0.5 * ride;
      ctx.fillStyle = C.fell; roundRect(ctx, nx - 46, y - 150, fx - nx + 92, 34, 17); ctx.fill(); ctx.restore();
      ctx.save(); ctx.globalAlpha = kp; hobbitsPiece(ctx, fx, y - 90, 44); ctx.restore();
    }
    if (kn > 0) { ctx.save(); ctx.globalAlpha = kn; nazgul(ctx, nx, y - 98, 44); ctx.restore(); }
    textIn(ctx, 'FRODO & SAM', fx, y - 210, kp * (S.step < 3 ? 1 : 0.0), { size: 34, weight: 700, align: 'center', color: C.fell });
    textIn(ctx, 'NAZGÛL', nx, y - 210, kn * (S.step < 3 ? 1 : 0.0), { size: 34, weight: 700, align: 'center', color: C.ink });
    // gap bracket
    if (S.step >= 4) {
      const kg = S.PW(4, 'come with them', 0.5);
      ctx.save(); ctx.globalAlpha = kg; stroke(ctx, C.red, 5);
      ctx.beginPath(); ctx.moveTo(nx, y + 64); ctx.lineTo(nx, y + 80); ctx.lineTo(fx, y + 80); ctx.lineTo(fx, y + 64); ctx.stroke();
      text(ctx, `GAP ${Math.round(g)}`, (nx + fx) / 2, y + 128, { size: 40, weight: 700, align: 'center', color: C.red });
      ctx.restore();
    }
    // blue card with ring symbols
    if (S.step >= 1) {
      const k = S.PW(1, 'ring symbols', 0.5);
      ctx.save(); ctx.globalAlpha = k;
      card(ctx, 180, 130, 140, 205, { color: C.blue, icon: faceIcon(C.blue) });
      text(ctx, '1 RING SYMBOL = 1 SPACE', 360, 245, { size: 46, weight: 700 });
      ctx.restore();
    }
    if (S.step === 2 || S.step === 3) {
      const kw = S.step === 2 ? S.PW(2, 'wins on the spot', 0.5) : 0;
      if (kw > 0) {
        scribble(ctx, fx + 60, y - 90, sx(N) + 10, y - 60, kw, { width: 4, color: C.fell, bend: -60, seed: 4 });
        stamp(ctx, 'FELLOWSHIP WINS', sx(N) - 40, 300, kw, { size: 50, rot: -6, color: C.fell });
      }
      const ks = S.step === 3 ? S.PW(3, 'catch', 0.5) : 0;
      if (ks > 0) stamp(ctx, 'CAUGHT = SAURON WINS', W / 2 + 200, 300, ks, { size: 50, rot: 5, color: C.saur });
    }
    if (S.step >= 2 && S.step <= 4) {
      const out = 1 - S.P(5, 0, 0.4);
      const kf = S.PW(2, 'fellowship plays', 0.5) * out, ks = S.PW(3, 'sauron plays', 0.5) * out;
      ctx.save(); ctx.globalAlpha = kf; hobbitsPiece(ctx, 560, 810, 30); ctx.restore();
      textIn(ctx, 'Fellowship plays a Ring symbol → Frodo & Sam move', 610, 830, kf, { size: 40, weight: 600, family: BODY });
      ctx.save(); ctx.globalAlpha = ks; nazgul(ctx, 560, 905, 30); ctx.restore();
      textIn(ctx, 'Sauron plays a Ring symbol → the Nazgûl close in', 610, 925, ks, { size: 40, weight: 600, family: BODY });
    }
    if (S.step >= 5) {
      const out = 1 - S.P(6, 0, 0.4);
      const k = S.PW(5, 'race for one', 0.5) * out, k2 = S.PW(5, 'hunt', 0.5) * out;
      textIn(ctx, 'THE GAP ONLY SHRINKS', W / 2, 860, S.PW(5, 'only ever shrinks', 0.5) * out, { size: 64, weight: 700, align: 'center' });
      textIn(ctx, 'a race', W / 2 - 220, 950, k, { size: 52, weight: 600, family: BODY, align: 'center', color: C.fell });
      textIn(ctx, 'vs', W / 2, 950, k2, { size: 44, weight: 500, family: BODY, align: 'center', color: C.ink2 });
      textIn(ctx, 'a hunt', W / 2 + 220, 950, k2, { size: 52, weight: 600, family: BODY, align: 'center', color: C.saur });
    }
    if (S.step >= 6) {
      const k = S.PW(6, 'one-time bonus', 0.5);
      [4, 8, 12].forEach((i, j) => circleMark(ctx, sx(i), y, 56, 56, clamp(k - j * 0.15), { color: C.ycard, width: 6, seed: 20 + j }));
      textIn(ctx, 'ONE-TIME BONUS when you reach or pass it', W / 2, 900, k, { size: 40, weight: 600, family: BODY, align: 'center' });
    }
  },

  // ---------------------------------------------------------------- six races
  races(ctx, S) {
    paper(ctx, S.t);
    const up = S.step >= 1 ? S.P(1, 0, 0.6) : 0;
    const y0 = lerp(450, 260, easeInOut(up)), sc0 = lerp(1, 0.6, easeInOut(up));
    text(ctx, '7 WONDERS DUEL · SCIENCE', W / 2, y0 - 120 * sc0, { size: Math.round(44 * sc0), weight: 600, align: 'center', color: C.ink2, spacing: 3, alpha: S.P(0, 0, 0.4) });
    for (let i = 0; i < 6; i++) {
      const k = S.PW(0, 'six different', 0.4, i * 0.12), x = W / 2 + (i - 2.5) * 220 * sc0;
      if (k <= 0) continue;
      ctx.save(); ctx.globalAlpha = clamp(k * 2) * (1 - 0.45 * up);
      ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(x, y0, 80 * sc0, 0, 7); ctx.fill();
      SCIENCE_ICONS[i](ctx, x, y0, 46 * sc0 * easeBack(k), C.green);
      ctx.restore();
    }
    textIn(ctx, '6 different symbols = instant win', W / 2, y0 + 150 * sc0, S.PW(0, 'win you the game', 0.5) * (1 - up), { size: 44, weight: 600, family: BODY, align: 'center' });
    if (S.step >= 1) {
      text(ctx, 'DUEL FOR MIDDLE-EARTH · RACES', W / 2, 520, { size: 44, weight: 700, align: 'center', spacing: 3, alpha: S.P(1, 0.3, 0.5) });
      RACES.forEach((r, i) => {
        const k = S.PW(1, r.toLowerCase(), 0.45), x = W / 2 + (i - 2.5) * 250, y = 680;
        if (k <= 0) return;
        const filled = S.step >= 2 ? S.PW(2, 'gather', 0.35, i * 0.22) : 0;
        ctx.save(); ctx.globalAlpha = clamp(k * 2);
        ctx.fillStyle = filled > 0 ? C.green : C.white; ctx.beginPath(); ctx.arc(x, y, 96 * easeBack(k), 0, 7); ctx.fill();
        ctx.strokeStyle = C.green; ctx.lineWidth = 6; ctx.stroke();
        RACE_ICONS[r](ctx, x, y, 52 * easeBack(k), filled > 0 ? C.white : C.green);
        text(ctx, r.toUpperCase(), x, y + 150, { size: 38, weight: 700, align: 'center' });
        ctx.restore();
      });
    }
    if (S.step >= 2) stamp(ctx, 'SUPPORT OF THE RACES · INSTANT WIN', W / 2, 960, S.PW(2, 'support', 0.5), { size: 56, rot: -3, color: C.green });
  },

  // ---------------------------------------------------------------- alliance tokens
  alliance(ctx, S) {
    paper(ctx, S.t);
    // 7 Wonders Duel analogy box
    const k0 = S.P(0, 0.1, 0.5), dim0 = S.step >= 1 ? 0.45 : 1;
    ctx.save(); ctx.globalAlpha = k0 * dim0;
    panel(ctx, 70, 120, 520, 330, { fill: C.white });
    text(ctx, '7 WONDERS DUEL', 330, 180, { size: 36, weight: 700, align: 'center', color: C.ink2 });
    [0, 1].forEach((j) => { ctx.fillStyle = C.paper2; ctx.beginPath(); ctx.arc(170 + j * 120, 300, 52, 0, 7); ctx.fill(); SCIENCE_ICONS[1](ctx, 170 + j * 120, 300, 30, C.green); });
    const kt = S.PW(0, 'progress token', 0.5);
    arrow(ctx, 360, 300, 430, 300, kt, { width: 6 });
    if (kt > 0) { ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(500, 300, 54 * easeBack(kt), 0, 7); ctx.fill(); ctx.strokeStyle = C.white; ctx.lineWidth = 5; ctx.stroke(); }
    text(ctx, 'pair → progress token', 330, 410, { size: 30, weight: 600, family: BODY, align: 'center', alpha: kt });
    ctx.restore();
    // alliance token stacks, one per race
    const sx = (i) => 790 + i * 190, sy = 210, py = 720;
    const stackPos = (race) => ({ x: sx(RACES.indexOf(race)), y: sy });
    if (S.step >= 1) {
      text(ctx, 'ALLIANCE TOKENS · one stack per race', 1265, 110, { size: 34, weight: 700, align: 'center', alpha: S.P(1, 0, 0.5) });
      RACES.forEach((r, i) => {
        const k = S.P(1, i * 0.06, 0.4);
        if (k <= 0) return;
        ctx.save(); ctx.globalAlpha = k;
        for (let d = 3; d >= 0; d--) hexToken(ctx, sx(i), sy + d * 6, 64, { back: r });
        ctx.restore();
      });
    }
    // lower area: one panel of content per step, crossfading
    const inK = (k) => S.P(k, 0, 0.4) * (S.step === k ? 1 : 1 - S.P(k + 1, 0, 0.35));
    if (S.step === 1 || S.step === 2) {
      const a = S.step === 1 ? S.P(1, 0, 0.4) : 1;
      ctx.save(); ctx.globalAlpha = a * (1 - S.P(3, 0, 0.35));
      text(ctx, 'YOUR CARDS', 330, 560, { size: 36, weight: 700, align: 'center', color: C.ink2 });
      const kc = S.PW(1, 'two matching', 0.5);
      [0, 1].forEach((j) => { if (kc > 0) card(ctx, 190 + j * 150, py - 90 + (1 - easeBack(kc)) * 60, 120, 175, { color: C.green, icon: (c, x, y, s) => RACE_ICONS.Dwarves(c, x, y, s * 0.8), alpha: kc }); });
      circleMark(ctx, 330, py, 210, 130, S.PW(1, 'two matching', 0.6, 0.3), { color: C.red, width: 6 });
      const kr = S.PW(1, 'reveal the top two', 0.6), kk = S.PW(1, 'keep one', 0.7);
      const o = stackPos('Dwarves');
      if (kr > 0) {
        const e = easeInOut(kr), ek = easeInOut(kk);
        const ax = lerp(lerp(o.x, o.x - 90, e), 760, ek), ay = lerp(lerp(o.y, o.y + 210, e), py, ek);
        const bx = lerp(o.x + 90 * e, o.x, ek), by = lerp(o.y + 210 * e, o.y - 4, ek);
        hexToken(ctx, bx, by, 64, { face: kk < 0.6, back: kk >= 0.6 ? 'Dwarves' : null, glyph: 1 });
        hexToken(ctx, ax, ay, 64, { face: true, glyph: 0 });
        textIn(ctx, 'reveal 2 · keep 1 · the other goes back', 1265, 470, kk, { size: 34, weight: 600, family: BODY, align: 'center' });
      }
      if (S.step === 2) {
        const k = S.PW(2, 'lasting ability', 0.5);
        ctx.save(); ctx.globalAlpha *= k;
        ctx.fillStyle = C.ink; roundRect(ctx, 850, py - 40, 340, 80, 40); ctx.fill();
        text(ctx, '∞  LASTING ABILITY', 1020, py + 14, { size: 36, weight: 700, color: C.yellow, align: 'center' });
        ctx.restore();
        textIn(ctx, 'every pair = an engine piece', 1020, py + 110, S.PW(2, 'engine piece', 0.5), { size: 36, weight: 600, family: BODY, align: 'center' });
      }
      ctx.restore();
    }
    if (S.step === 3) {
      ctx.save(); ctx.globalAlpha = inK(3);
      text(ctx, 'YOUR CARDS', 330, 560, { size: 36, weight: 700, align: 'center', color: C.ink2 });
      const kc = S.PW(3, 'three different', 0.5);
      ['Elves', 'Ents', 'Wizards'].forEach((r, j) => { if (kc > 0) card(ctx, 140 + j * 135, py - 80, 115, 170, { color: C.green, icon: (c, x, y, s) => RACE_ICONS[r](c, x, y, s * 0.8), alpha: kc }); });
      const kr = S.PW(3, 'top token', 0.6), kk = S.PW(3, 'keep one', 0.6);
      ['Elves', 'Ents', 'Wizards'].forEach((r, j) => {
        if (kr <= 0) return;
        const o = stackPos(r), e = easeInOut(kr), keep = j === 1;
        let x = o.x, y = lerp(o.y, o.y + 230, e);
        if (keep) { x = lerp(x, 760, easeInOut(kk)); y = lerp(y, py, easeInOut(kk)); }
        else y = lerp(y, o.y - 4, easeInOut(kk));
        hexToken(ctx, x, y, 60, { face: keep || kk < 0.6, back: !keep && kk >= 0.6 ? r : null, glyph: j + 2 });
      });
      ctx.restore();
      stamp(ctx, 'ONCE PER GAME', 1350, 760, S.PW(3, 'once-per-game', 0.5), { size: 60, rot: -5 });
    }
    if (S.step >= 4) {
      ctx.save(); ctx.globalAlpha = S.P(4, 0, 0.4);
      const ke = S.PW(4, 'eagle', 0.6);
      hexToken(ctx, 330, 740, 90 * easeBack(ke), { face: true, eagle: true, alpha: ke });
      textIn(ctx, 'THE EAGLE', 330, 900, ke, { size: 46, weight: 700, align: 'center', color: C.gold });
      const ks = S.PW(4, 'one of the six', 0.5);
      [...RACES.slice(0, 5), 'Eagle'].forEach((r, i) => {
        const x = 760 + i * 180, y = 740;
        ctx.save(); ctx.globalAlpha *= clamp(ks * 2 - i * 0.15);
        ctx.fillStyle = r === 'Eagle' ? C.gold : C.green; ctx.beginPath(); ctx.arc(x, y, 70, 0, 7); ctx.fill();
        RACE_ICONS[r](ctx, x, y, 38, C.white);
        ctx.restore();
      });
      circleMark(ctx, 760 + 5 * 180, 740, 95, 95, S.PW(4, 'one of the six', 0.6, 0.6), { color: C.red, width: 6 });
      textIn(ctx, 'counts as one of the six', 1210, 880, ks, { size: 40, weight: 600, family: BODY, align: 'center' });
      ctx.restore();
    }
  },

  // ---------------------------------------------------------------- the map
  map(ctx, S) {
    paper(ctx, S.t);
    const M = { x: 330, y: 120, w: 1260, h: 800 };
    const k0 = S.P(0, 0, 0.8);
    drawMap(ctx, M, { k: k0, names: (r) => S.PW(0, r.toLowerCase(), 0.4), tint: mapTint(S), t: S.t });
    const st = S.step;
    const units = [];
    if (st >= 1) { units.push({ r: 'Arnor', s: 'f', n: 2, k: S.PW(1, 'arnor', 0.5) }); units.push({ r: 'Mordor', s: 's', n: 2, k: S.PW(1, 'mordor', 0.5) }); }
    let rohanF = 0, rohanS = 0;
    const flying = [];
    if (st >= 2) rohanF = 2;
    if (st >= 3) {
      const t0 = S.W(3, 'conflict');
      rohanS = S.t > t0 - 0.6 ? 3 : 0;
      const r1 = clamp((S.t - (t0 + 1.4)) / 0.5), r2 = clamp((S.t - (t0 + 2.6)) / 0.5);
      const removed = (r1 >= 1 ? 1 : 0) + (r2 >= 1 ? 1 : 0);
      rohanF -= removed; rohanS -= removed;
      [r1, r2].forEach((r) => { if (r > 0 && r < 1) flying.push(r); });
    }
    if (st >= 2) {
      const kc = st === 2 ? S.PW(2, 'red card', 0.5) : 0;
      if (kc > 0) redCard(ctx, 90, 560, kc, ['ROHAN', 'GONDOR'], 0, 'f', S.PW(2, 'place all', 0.4));
      const kc3 = st === 3 ? clamp((S.t - S.stepT(3)) / 0.5) * (1 - S.PW(3, 'you repeat', 0.5)) : 0;
      if (kc3 > 0) redCard(ctx, 1660, 560, kc3, ['ROHAN', 'MORDOR'], 0, 's', 1);
      units.push({ r: 'Rohan', s: 'f', n: rohanF, k: st === 2 ? S.PW(2, 'place all', 0.5) : 1 });
      units.push({ r: 'Rohan', s: 's', n: rohanS, k: 1 });
    }
    units.forEach((u) => drawUnits(ctx, M, u.r, u.s, u.n, u.k));
    flying.forEach((k) => {
      const c = regionCenter(M, 'Rohan'), e = easeInOut(k);
      unit(ctx, lerp(c.x - 40, 90, e), lerp(c.y, 990, e), 'f', 30, { alpha: 1 - e * 0.5 });
      unit(ctx, lerp(c.x + 40, W - 90, e), lerp(c.y, 990, e), 's', 30, { alpha: 1 - e * 0.5 });
      textIn(ctx, '−1 each', c.x, c.y - 120, 1 - Math.abs(k - 0.5) * 2, { size: 44, weight: 700, align: 'center', color: C.red });
    });
    if (st === 3) stamp(ctx, 'CONFLICT', W / 2, 110, S.PW(3, 'conflict', 0.5), { size: 64, rot: -4 });
    if (st === 4) {
      const k = S.P(4, 0.1, 0.5);
      ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = C.ink; roundRect(ctx, W / 2 - 430, 945, 860, 100, 12); ctx.fill(); ctx.restore();
      textIn(ctx, '3  vs  2   →   1 LEFT STANDING', W / 2, 1013, k, { size: 54, weight: 700, align: 'center', color: C.yellow });
    }
    if (st >= 5) {
      const kf = S.PW(5, 'fortress', 0.5), g = regionCenter(M, 'Gondor');
      if (kf > 0) fortress(ctx, g.x, g.y - 10, 'f', 60, { scale: easeBack(kf) });
    }
    if (st === 5) {
      textIn(ctx, 'PRESENCE = a unit or a fortress', W / 2, 1010, S.PW(5, 'present', 0.5), { size: 44, weight: 700, align: 'center' });
      stamp(ctx, 'PRESENT IN ALL 7 = CONQUEST', W / 2, 105, S.PW(5, 'all seven', 0.5), { size: 56, rot: -3, color: C.ink });
    }
    if (st >= 6) {
      const k = S.P(6, 0.1, 0.6);
      ctx.save(); ctx.globalAlpha = k;
      panel(ctx, 1360, 50, 500, 160, { fill: C.white });
      text(ctx, 'OLD: one pawn, one track', 1610, 100, { size: 32, weight: 600, family: BODY, align: 'center', color: C.ink2 });
      scribble(ctx, 1410, 160, 1810, 160, 1, { width: 5, color: C.ink3 });
      ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(1610 + Math.sin(S.t * 2) * 120, 160, 16, 0, 7); ctx.fill();
      ctx.restore();
      textIn(ctx, 'NEW: seven plates spinning', W / 2, 1010, S.PW(6, 'seven plates', 0.5), { size: 48, weight: 700, align: 'center' });
      REGIONS.forEach((r, i) => {
        const c = regionCenter(M, r.name), kk = S.PW(6, 'seven plates', 0.4, i * 0.08);
        if (kk <= 0) return;
        ctx.save(); ctx.globalAlpha = kk * 0.85; ctx.translate(c.x + 70, c.y - 40);
        ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 0, 40, 12, Math.sin(S.t * 4 + i) * 0.25, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, 54); ctx.stroke(); ctx.restore();
      });
    }
  },

  // ---------------------------------------------------------------- landmarks
  landmarks(ctx, S) {
    paper(ctx, S.t);
    const tiles = [["HELM'S DEEP", 'ROHAN'], ['MINAS TIRITH', 'GONDOR'], ['BARAD-DÛR', 'MORDOR']];
    const tx = (i) => 520 + i * 450;
    const k0 = S.P(0, 0, 0.6);
    ctx.save(); ctx.globalAlpha = k0;
    for (let d = 3; d >= 0; d--) landmarkTile(ctx, 70 + d * 6, 140 + d * 6, 300, 190, null, null, null, true);
    text(ctx, '7 LANDMARKS', 222, 395, { size: 38, weight: 700, align: 'center' });
    text(ctx, '1 per region', 222, 438, { size: 30, weight: 500, family: BODY, align: 'center', color: C.ink2 });
    ctx.restore();
    tiles.forEach(([name, reg], i) => {
      const k = S.PW(0, 'three of them', 0.5, i * 0.2);
      if (k <= 0) return;
      const lift = i === 0 && S.step === 2 ? easeInOut(S.PW(2, 'place a fortress', 0.6)) * 20 : 0;
      ctx.save(); ctx.globalAlpha = clamp(k * 2);
      landmarkTile(ctx, tx(i), 140 - lift + (1 - easeBack(k)) * 40, 380, 230, name, reg, 'f');
      ctx.restore();
    });
    textIn(ctx, '3 FACE UP', 1160, 430, S.PW(0, 'face up', 0.5) * (1 - S.P(3, 0, 0.3)), { size: 40, weight: 700, align: 'center' });
    // lower area: one idea per step
    const vis = (k) => (S.step === k ? S.P(k, 0, 0.4) : 0);
    if (S.step === 1) {
      const a = vis(1), k = S.PW(1, 'coin cost', 0.5), kf = S.PW(1, 'every fortress', 0.5);
      const bx = 330, by = 640, bw = 1260;
      ctx.save(); ctx.globalAlpha = a;
      panel(ctx, bx, by - 120, bw, 330, { fill: C.white });
      text(ctx, 'LANDMARK COST', bx + 60, by - 40, { size: 44, weight: 700, color: C.ink2 });
      textIn(ctx, 'printed coins', bx + 60, by + 70, k, { size: 56, weight: 700, family: BODY });
      textIn(ctx, '+ 1 coin per fortress', bx + 470, by + 70, kf, { size: 56, weight: 700, family: BODY, color: C.saur });
      textIn(ctx, 'you already have on the board', bx + 470, by + 125, kf, { size: 36, weight: 500, family: BODY, color: C.ink2 });
      for (let j = 0; j < 3; j++) { const kk = clamp(kf * 3 - j); if (kk > 0) fortress(ctx, bx + 1060 + j * 60, by + 60, 'f', 44, { scale: easeBack(kk) }); }
      textIn(ctx, 'so your first Landmark costs no extra', bx + 470, by + 180, kf, { size: 32, weight: 500, family: BODY, color: C.ink2 });
      ctx.restore();
    }
    if (S.step === 2) {
      const a = vis(2);
      const M = { x: 330, y: 470, w: 700, h: 470 };
      ctx.save(); ctx.globalAlpha = a;
      drawMap(ctx, M, { k: 1, names: () => 1, small: true });
      const c = regionCenter(M, 'Rohan');
      const kf = S.PW(2, 'place a fortress', 0.6);
      if (kf > 0) fortress(ctx, c.x - 20, lerp(c.y - 320, c.y - 52, easeOut(kf)), 'f', 50);
      const ku = S.PW(2, 'only remove units', 0.6);
      if (ku > 0) unit(ctx, c.x + 60 + 40 * Math.sin(clamp(ku * 1.4) * Math.PI), c.y - 52, 's', 26);
      textIn(ctx, 'Conflicts remove units only.', 1100, 650, ku, { size: 50, weight: 700 });
      textIn(ctx, 'A fortress stays put.', 1100, 720, ku, { size: 50, weight: 700, color: C.fell });
      ctx.restore();
    }
    if (S.step >= 3) {
      const fx = [["helm's deep", ['+ fortress', '+ 3 units in Rohan']], ['minas tirith', ['+ fortress, + 1 unit', '+ 2 quest spaces']], ['barad', ['+ fortress', 'play a discarded', 'card for free']]];
      fx.forEach(([w, lines], i) => {
        const k = S.PW(3, w, 0.5, 0.2), x = tx(i) + 190;
        lines.forEach((l, j) => textIn(ctx, l, x, 450 + j * 54, k, { size: 38, weight: 600, family: BODY, align: 'center' }));
      });
    }
    if (S.step >= 4) {
      const k = S.P(4, 0.1, 0.5);
      ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = C.ink; roundRect(ctx, 260, 800, 1400, 130, 12); ctx.fill(); ctx.restore();
      textIn(ctx, 'FORTRESS  +  BONUS  +  ANOTHER FRONT', W / 2, 885, k, { size: 58, weight: 700, align: 'center', color: C.yellow });
    }
  },

  // ---------------------------------------------------------------- end of chapter 3
  endgame(ctx, S) {
    paper(ctx, S.t);
    const M = { x: 120, y: 120, w: 1060, h: 700 };
    const tie = S.step >= 1 && S.PW(1, 'tied', 0.4) > 0.5;
    const pres = tie
      ? { Lindon: 'f', Arnor: 'f', Gondor: 'f', Rhovanion: 's', Rohan: 's', Mordor: 's' }
      : { Lindon: 'f', Arnor: 'f', Enedwaith: 'f', Gondor: 'f', Rhovanion: 's', Rohan: 's', Mordor: 's' };
    const k = S.PW(0, 'count regions', 0.6);
    drawMap(ctx, M, { k: 1, names: () => 1, presence: pres, presenceK: k, small: true });
    const nf = Object.values(pres).filter((v) => v === 'f').length, ns = Object.values(pres).filter((v) => v === 's').length;
    const bx = 1300;
    ctx.save(); ctx.globalAlpha = k;
    panel(ctx, bx, 200, 500, 200, { fill: C.white });
    text(ctx, 'FELLOWSHIP', bx + 40, 270, { size: 44, weight: 700, color: C.fell });
    text(ctx, String(nf), bx + 450, 290, { size: 96, weight: 700, color: C.fell, align: 'right' });
    text(ctx, 'regions', bx + 40, 320, { size: 30, weight: 500, family: BODY, color: C.ink2 });
    panel(ctx, bx, 440, 500, 200, { fill: C.white });
    text(ctx, 'SAURON', bx + 40, 510, { size: 44, weight: 700, color: C.saur });
    text(ctx, String(ns), bx + 450, 530, { size: 96, weight: 700, color: C.saur, align: 'right' });
    text(ctx, 'regions', bx + 40, 560, { size: 30, weight: 500, family: BODY, color: C.ink2 });
    ctx.restore();
    if (!tie) stamp(ctx, 'MOST REGIONS WINS', 1550, 790, S.PW(0, 'most regions', 0.5), { size: 52, rot: -5, color: C.fell });
    else stamp(ctx, 'SHARED VICTORY', 1550, 790, S.PW(1, 'share', 0.5), { size: 60, rot: -5, color: C.ink });
    textIn(ctx, 'no points, even at the end', 650, 960, S.P(0, 0.4), { size: 42, weight: 600, family: BODY, align: 'center', color: C.ink2 });
  },

  // ---------------------------------------------------------------- why it plays differently
  fronts(ctx, S) {
    paper(ctx, S.t);
    if (S.step === 0) {
      const k = S.P(0, 0, 0.5);
      ctx.save(); ctx.globalAlpha = k;
      text(ctx, '7 WONDERS DUEL', W / 2, 170, { size: 54, weight: 700, align: 'center', color: C.ink2, spacing: 3 });
      const g = clamp((S.t - S.stepT(0)) / 7);
      [[C.fell, 0.92], [C.saur, 0.8]].forEach(([col, m], i) => {
        const y = 330 + i * 200;
        ctx.fillStyle = C.paper2; roundRect(ctx, 300, y, 1320, 90, 45); ctx.fill();
        ctx.fillStyle = col; roundRect(ctx, 300, y, 1320 * g * m + 90, 90, 45); ctx.fill();
        text(ctx, 'POINTS', 330, y + 62, { size: 40, weight: 700, color: C.white });
      });
      const kt = S.PW(0, 'sudden wins', 0.5);
      for (let i = 0; i < 3; i++) { const x = 760 + i * 200; ctx.save(); ctx.globalAlpha *= kt * (0.6 + 0.4 * Math.sin(S.t * 5 + i)); ctx.fillStyle = C.red; ctx.beginPath(); ctx.moveTo(x, 760); ctx.lineTo(x + 40, 840); ctx.lineTo(x - 40, 840); ctx.closePath(); ctx.fill(); text(ctx, '!', x, 832, { size: 50, weight: 700, color: C.white, align: 'center' }); ctx.restore(); }
      textIn(ctx, 'sudden wins: threats to defend against', W / 2, 930, kt, { size: 42, weight: 600, family: BODY, align: 'center' });
      ctx.restore();
      return;
    }
    text(ctx, 'DUEL FOR MIDDLE-EARTH', W / 2, 140, { size: 54, weight: 700, align: 'center', spacing: 3, alpha: S.P(1, 0, 0.5) });
    const lanes = [['QUEST', 0.62, 0.48], ['RACES', 0.5, 0.67], ['MAP', 0.57, 0.71]];
    const ys = [290, 520, 750];
    lanes.forEach(([lab, f, s], i) => {
      const k = S.P(1, 0.15 * i, 0.5), y = ys[i];
      if (k <= 0) return;
      ctx.save(); ctx.globalAlpha = k;
      text(ctx, lab, 330, y + 18, { size: 54, weight: 700, align: 'right' });
      scribble(ctx, 380, y, 1500, y, 1, { width: 6, color: C.ink3, seed: 30 + i });
      ctx.fillStyle = C.ink; ctx.fillRect(1520, y - 70, 6, 90);
      for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) { ctx.fillStyle = (a + b) % 2 ? C.ink : C.white; ctx.fillRect(1526 + a * 22, y - 70 + b * 22, 22, 22); }
      const wob = 0.03 * Math.sin(S.t * 0.8 + i);
      pawn(ctx, lerp(380, 1500, f + wob), y - 46, C.fell, 34); pawn(ctx, lerp(380, 1500, s - wob), y - 46, C.saur, 34);
      ctx.restore();
    });
    textIn(ctx, 'FINISH', 1560, 210, S.PW(1, 'finish lines', 0.5), { size: 30, weight: 700, align: 'center', color: C.ink2 });
    if (S.step >= 2) {
      const chips = [[405, 'Landmarks → fortresses on the map, steps on the quest', 'landmarks'], [635, 'Quest spaces → bonuses', 'quest spaces'], [865, 'Races → alliances that bend the rules', 'races unlock']];
      chips.forEach(([y, lab, w], i) => {
        const k = S.PW(2, w, 0.5);
        if (k <= 0) return;
        const tw = measure(ctx, lab, { size: 34, weight: 700, family: BODY });
        ctx.save(); ctx.globalAlpha = clamp(k * 2);
        ctx.fillStyle = C.red; roundRect(ctx, 940 - tw / 2 - 26, y - 34, tw + 52, 58, 29); ctx.fill();
        text(ctx, lab, 940, y + 7, { size: 34, weight: 700, family: BODY, align: 'center', color: C.white });
        ctx.restore();
        void i;
      });
    }
    if (S.step >= 3) {
      const k = S.PW(3, 'which one', 0.6);
      const s = 'Which race is your opponent about to win?';
      const tw = measure(ctx, s, { size: 56, weight: 700 });
      highlight(ctx, W / 2 - tw / 2 - 20, 935, tw + 40, 86, k, C.yellow, 15);
      textIn(ctx, s, W / 2, 1000, k, { size: 56, weight: 700, align: 'center' });
    }
  },

  // ---------------------------------------------------------------- outro
  outro(ctx, S) {
    paper(ctx, S.t);
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = C.parch; ctx.fillRect(0, 0, W, H); ctx.restore();
    ctx.save(); ctx.translate(0, -40); ctx.globalAlpha = clamp(S.lt / 0.8);
    drawPyramid(ctx, S, { dropStep: 0, reveal: true });
    ctx.restore();
    const k1 = S.PW(0, 'same pyramid', 0.5), k2 = S.PW(0, 'completely different', 0.5);
    ringIcon(ctx, W / 2, 380, 300 * easeBack(k2), `rgba(201,162,39,${0.8 * k2})`, 24);
    const tw = measure(ctx, 'SAME PYRAMID.', { size: 84, weight: 700 });
    highlight(ctx, W / 2 - tw / 2 - 20, 720, tw + 40, 100, k1, C.yellow, 21);
    textIn(ctx, 'SAME PYRAMID.', W / 2, 800, k1, { size: 84, weight: 700, align: 'center' });
    textIn(ctx, 'DIFFERENT GAME.', W / 2, 910, k2, { size: 84, weight: 700, align: 'center', color: C.saur });
    textIn(ctx, 'Unofficial fan explainer. The Lord of the Rings: Duel for Middle-earth is published by Repos Production; all names belong to their owners.',
      W / 2, 1030, clamp((S.t - S.beatEnd(0) - 0.4) / 0.8), { size: 22, weight: 500, family: BODY, align: 'center', color: C.ink2 });
  },
};

// ------------------------------------------------------------------ shared illustrations
function barChart(ctx, R, vals, k, col) {
  const bx = R.x + 120, by = R.y + R.h - 110, bw = 110, gap = (R.w - 240 - bw * 4) / 3;
  vals.forEach((v, i) => {
    const kk = clamp(k * 1.6 - i * 0.2);
    const x = bx + i * (bw + gap);
    for (let c = 0; c < v; c++) if (kk * v > c) coin(ctx, x + bw / 2, by - 30 - c * 52, 25, { alpha: clamp(kk * v - c) });
    text(ctx, String(i), x + bw / 2, by + 50, { size: 38, weight: 700, align: 'center', color: C.ink2 });
    text(ctx, `${v}`, x + bw / 2, by - 40 - v * 52, { size: 40, weight: 700, align: 'center', color: col, alpha: kk });
  });
  text(ctx, "opponent's copies of that resource / skill", R.x + R.w / 2, by + 95, { size: 26, weight: 500, family: BODY, align: 'center', color: C.ink2 });
}

function hexToken(ctx, x, y, r, o = {}) {
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  const path = () => { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); };
  ctx.save(); ctx.shadowColor = 'rgba(40,25,5,0.3)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  ctx.fillStyle = o.eagle ? '#F3E3B0' : o.back ? '#2F5E36' : C.white; path(); ctx.fill(); ctx.restore();
  ctx.strokeStyle = o.eagle ? C.gold : o.back ? '#1F4024' : C.green; ctx.lineWidth = r * 0.08; path(); ctx.stroke();
  if (o.back) RACE_ICONS[o.back](ctx, x, y, r * 0.45, 'rgba(255,255,255,0.85)');
  else if (o.eagle) RACE_ICONS.Eagle(ctx, x, y, r * 0.55, C.gold);
  else {
    // generic ability glyph (not a real token)
    ctx.fillStyle = C.green;
    const g = (o.glyph || 0) % 4;
    if (g === 0) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.2 : r * 0.45; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.fill(); }
    else if (g === 1) { ctx.fillRect(x - r * 0.38, y - r * 0.1, r * 0.76, r * 0.2); ctx.fillRect(x - r * 0.1, y - r * 0.38, r * 0.2, r * 0.76); }
    else if (g === 2) { ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, 7); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(x, y - r * 0.4); ctx.lineTo(x + r * 0.38, y + r * 0.3); ctx.lineTo(x - r * 0.38, y + r * 0.3); ctx.closePath(); ctx.fill(); }
  }
  ctx.restore();
}

function landmarkTile(ctx, x, y, w, h, name, region, side, back = false) {
  shadowBox(ctx, x, y, w, h, 10, 14, 0.25, 6);
  ctx.save();
  ctx.fillStyle = back ? '#4A4036' : C.parch; roundRect(ctx, x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = back ? 'rgba(233,221,191,0.4)' : C.parch2; ctx.lineWidth = 4; roundRect(ctx, x + 8, y + 8, w - 16, h - 16, 6); ctx.stroke();
  if (!back) {
    // skyline
    ctx.fillStyle = 'rgba(90,70,40,0.35)';
    ctx.beginPath(); ctx.moveTo(x + 16, y + h * 0.7);
    for (let i = 0; i <= 10; i++) ctx.lineTo(x + 16 + (w - 32) * i / 10, y + h * (0.45 + 0.2 * rnd(i + w)));
    ctx.lineTo(x + w - 16, y + h * 0.7); ctx.closePath(); ctx.fill();
    fortress(ctx, x + w / 2, y + h * 0.48, side || 'f', h * 0.32);
    text(ctx, name, x + w / 2, y + h * 0.86, { size: Math.round(h * 0.15), weight: 700, align: 'center' });
    text(ctx, region, x + w / 2, y + h * 0.22, { size: Math.round(h * 0.1), weight: 600, align: 'center', color: C.ink2, spacing: 3 });
  } else {
    ringIcon(ctx, x + w / 2, y + h / 2, h * 0.18, 'rgba(201,162,39,0.7)', 6);
  }
  ctx.restore();
}

function redCard(ctx, x, y, k, banners, chosen, side, kChoose) {
  ctx.save(); ctx.globalAlpha = clamp(k * 2);
  const w = 160, h = 240, yy = y + (1 - easeBack(k)) * 80;
  card(ctx, x, yy, w, h, { color: C.red, icon: (c, cx, cy, s) => { unit(c, cx - s * 0.6, cy, side, s * 0.5); unit(c, cx, cy, side, s * 0.5); if (side === 's') unit(c, cx + s * 0.6, cy, side, s * 0.5); else unit(c, cx + s * 0.6, cy, side, s * 0.5, { alpha: 0 }); } });
  banners.forEach((b, i) => {
    const bx = x - 10, by = yy + h + 20 + i * 54, on = i === chosen && kChoose > 0.5;
    ctx.fillStyle = on ? C.yellow : C.white; roundRect(ctx, bx, by, w + 20, 44, 6); ctx.fill();
    ctx.strokeStyle = C.ink3; ctx.lineWidth = 2; roundRect(ctx, bx, by, w + 20, 44, 6); ctx.stroke();
    text(ctx, b, bx + (w + 20) / 2, by + 33, { size: 28, weight: 700, align: 'center' });
  });
  text(ctx, 'pick one', x + w / 2, yy - 18, { size: 26, weight: 600, family: BODY, align: 'center', color: C.ink2 });
  ctx.restore();
}

// ---- stylised map of the seven regions (not to scale; for explanation only)
const REGIONS = [
  { name: 'Lindon', pts: [[0.00, 0.08], [0.13, 0.05], [0.16, 0.36], [0.12, 0.66], [0.02, 0.70]] },
  { name: 'Arnor', pts: [[0.13, 0.05], [0.45, 0.00], [0.48, 0.32], [0.30, 0.40], [0.16, 0.36]] },
  { name: 'Rhovanion', pts: [[0.45, 0.00], [0.95, 0.03], [0.99, 0.37], [0.68, 0.40], [0.48, 0.32]] },
  { name: 'Enedwaith', pts: [[0.16, 0.36], [0.30, 0.40], [0.37, 0.66], [0.20, 0.86], [0.12, 0.66]] },
  { name: 'Rohan', pts: [[0.30, 0.40], [0.48, 0.32], [0.68, 0.40], [0.63, 0.65], [0.37, 0.66]] },
  { name: 'Gondor', pts: [[0.37, 0.66], [0.63, 0.65], [0.68, 0.94], [0.30, 1.00], [0.20, 0.86]] },
  { name: 'Mordor', pts: [[0.68, 0.40], [0.99, 0.37], [1.00, 0.92], [0.68, 0.94], [0.63, 0.65]] },
];
const REGION_FILL = { Lindon: '#E6DDBF', Arnor: '#DED3B0', Rhovanion: '#E3D9B8', Enedwaith: '#DCD0AA', Rohan: '#E8DFC0', Gondor: '#DDD2AE', Mordor: '#CBBFA0' };
function regionCenter(M, name) {
  const r = REGIONS.find((q) => q.name === name);
  const cx = r.pts.reduce((a, p) => a + p[0], 0) / r.pts.length, cy = r.pts.reduce((a, p) => a + p[1], 0) / r.pts.length;
  return { x: M.x + cx * M.w, y: M.y + cy * M.h };
}
function regionPath(ctx, M, r, seed) {
  ctx.beginPath();
  const P = r.pts.map(([x, y]) => [M.x + x * M.w, M.y + y * M.h]);
  P.forEach(([x, y], i) => {
    const [nx, ny] = P[(i + 1) % P.length];
    if (!i) ctx.moveTo(x, y);
    for (let s = 1; s <= 6; s++) {
      const u = s / 6;
      // shared edges get the same jitter from both sides: key the noise on the edge's endpoints
      const key = Math.round((x + nx) * 0.37 + (y + ny) * 0.53);
      const j = s < 6 ? (rnd(key + s * 13) - 0.5) * M.w * 0.012 : 0;
      ctx.lineTo(lerp(x, nx, u) + j, lerp(y, ny, u) - j);
    }
  });
  ctx.closePath();
  void seed;
}
function mapTint(S) {
  if (S.step < 5) return null;
  const all = S.PW(5, 'all seven', 0.6);
  const base = { Arnor: 'f', Gondor: 'f', Mordor: 's', Rohan: 's' };
  return { pres: base, k: S.PW(5, 'present', 0.5), allK: S.step === 5 ? all : 0 };
}
function drawMap(ctx, M, o = {}) {
  const k = o.k ?? 1;
  REGIONS.forEach((r, i) => {
    const kk = clamp(k * 1.5 - i * 0.07);
    if (kk <= 0) return;
    ctx.save(); ctx.globalAlpha = kk;
    regionPath(ctx, M, r, i);
    ctx.fillStyle = REGION_FILL[r.name]; ctx.fill();
    let tint = null, tk = 0;
    if (o.tint) {
      const t = o.tint;
      if (t.base && t.baseK) { tint = t.base[r.name]; tk = 1; }
      if (t.pres[r.name] && t.k > 0) { tint = t.pres[r.name]; tk = t.k; }
    }
    if (o.presence && o.presence[r.name]) { tint = o.presence[r.name]; tk = o.presenceK ?? 1; }
    if (tint && tk > 0) { ctx.globalAlpha = kk * 0.38 * tk; ctx.fillStyle = tint === 'f' ? C.fell : C.saur; ctx.fill(); ctx.globalAlpha = kk; }
    ctx.strokeStyle = '#6B5B3E'; ctx.lineWidth = o.small ? 3 : 4; ctx.stroke();
    if (o.tint && o.tint.allK > 0) {
      ctx.globalAlpha = kk * o.tint.allK * (0.75 + 0.25 * Math.sin(i * 1.3 + (o.t || 0) * 6));
      ctx.strokeStyle = C.yellow; ctx.lineWidth = 12; ctx.stroke();
    }
    ctx.restore();
  });
  REGIONS.forEach((r) => {
    const kn = o.names ? o.names(r.name) : 1;
    if (kn <= 0 || k <= 0) return;
    const c = regionCenter(M, r.name);
    textIn(ctx, r.name.toUpperCase(), c.x, c.y + (o.small ? 10 : 60), kn, { size: o.small ? 22 : 40, weight: 700, align: 'center', color: '#4A3E2A', spacing: 2 });
  });
}
function miniMap(ctx, x, y, w, h, o = {}) {
  drawMap(ctx, { x, y, w, h }, { k: 1, names: () => 0, small: true, presence: o.tint ? { Arnor: 'f', Lindon: 'f', Mordor: 's', Rohan: 's' } : null });
}
function drawUnits(ctx, M, region, side, n, k) {
  if (n <= 0 || k <= 0) return;
  const c = regionCenter(M, region);
  for (let i = 0; i < n; i++) {
    const kk = clamp(k * 1.6 - i * 0.2);
    if (kk <= 0) continue;
    const ox = (side === 'f' ? -1 : 1) * (36 + Math.floor(i / 2) * 56), oy = (i % 2) * 56 - 92;
    unit(ctx, c.x + ox, c.y + oy - (1 - easeBack(kk)) * 80, side, 30, { alpha: clamp(kk * 2) });
  }
}
