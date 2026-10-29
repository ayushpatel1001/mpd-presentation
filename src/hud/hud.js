// 2D motion-graphics layer drawn over the 3D render. One drawer per overlay type in
// beat_grid.json; all timing comes from timeline.resolved.json (word-anchored cues).
import { Painter, fmt, icon } from './draw.js';
import { clamp, ease, envelope, inv, lerp } from '../lib/util.js';

export function createHud(canvas, tokens, timeline, assets) {
  const ctx = canvas.getContext('2d');
  const P = new Painter(ctx, tokens);
  const SA = tokens.safeArea;
  const H = tokens.color.hud;
  const W = tokens.canvas.width, HH = tokens.canvas.height;
  const acts = Object.fromEntries(timeline.acts.map((a) => [a.id, a]));
  const COL_W = 560;
  const LEFT = SA.x0, RIGHT = SA.x1 - COL_W;
  const accent = { plant1: '#00A3E0', plant2: '#4ADE80', eco: '#4ADE80', steel: '#CBD5E1', solvent: '#22D3EE', resin: '#FBBF24' };
  const accentText = { plant1: H.plant1Text, plant2: H.plant2Text, eco: '#86EFAC', steel: '#E2E8F0', solvent: '#5EEAD4', resin: '#FBBF24' };
  const LOGO_AR = 1024 / 337;

  const slide = (k, px = -24) => ({ dx: px * (1 - ease.outCubic(k)) });

  // ---------------------------------------------------------------- overlay drawers
  const DRAW = {
    logoCard(ov, t) {
      const kIn = inv(ov.in, ov.in + 0.9, t), kOut = inv(ov.out - 0.75, ov.out, t);
      // scrim behind the card for contrast on top of the glowing blueprint
      P.group(Math.min(1, kIn * 2) * (1 - kOut), () => {
        const g = ctx.createRadialGradient(960, 500, 80, 960, 500, 760);
        g.addColorStop(0, 'rgba(3,10,20,0.78)'); g.addColorStop(1, 'rgba(3,10,20,0.0)');
        ctx.globalAlpha = P.alpha; ctx.fillStyle = g; ctx.fillRect(0, 0, W, HH);
      });
      const cw = 820, ch = 300, cx = 960, cy = 450;
      const bugW = 46 * LOGO_AR + 28;
      const e = ease.inOutCubic(kOut);
      const scale = (0.86 + 0.14 * ease.outBack(kIn)) * lerp(1, bugW / cw, e);
      const px = lerp(cx, SA.x1 - bugW / 2, e), py = lerp(cy, SA.y0 + 32, e);
      P.group(Math.min(1, kIn * 1.6) * (1 - inv(0.7, 1, kOut)), () => {
        P.panel(cx - cw / 2, cy - ch / 2, cw, ch, { fill: '#FFFFFF', alpha: 1, radius: 24, shadow: 46, shadowColor: 'rgba(0,163,224,0.55)' });
        const lw = 720, lh = lw / LOGO_AR;
        P.image(assets.logo, cx - lw / 2, cy - lh / 2, lw, lh);
        // light sweep across the card
        const ks = inv(ov.in + 0.7, ov.in + 1.6, t);
        if (ks > 0 && ks < 1) {
          ctx.save();
          ctx.beginPath(); ctx.roundRect(cx - cw / 2, cy - ch / 2, cw, ch, 24); ctx.clip();
          const sx = cx - cw / 2 - 200 + ks * (cw + 400);
          const g = ctx.createLinearGradient(sx - 120, 0, sx + 120, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(180,230,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalAlpha = P.alpha; ctx.fillStyle = g;
          ctx.transform(1, 0, -0.35, 1, 0, 0);
          ctx.fillRect(sx - 140 + 160, cy - ch / 2, 280, ch);
          ctx.restore();
        }
      }, { px: cx, py: cy, scale, dx: px - cx, dy: py - cy });
      const kE = inv(ov.in + 0.8, ov.in + 1.8, t);
      P.group(Math.min(1, kE * 3) * (1 - kOut), () => {
        const str = ov.props.eyebrow;
        const n = Math.round(str.length * ease.outCubic(kE));
        const full = P.measure(str, { size: 30, weight: 800, family: 'Montserrat', spacing: 6 });
        P.text(str.slice(0, n), 960 - full / 2, cy + ch / 2 + 74, { size: 30, weight: 800, family: 'Montserrat', spacing: 6, color: '#38BDF8' });
        P.rect(960 - full / 2, cy + ch / 2 + 98, full * ease.outCubic(kE), 3, '#F59E0B');
      });
    },

    logoBug(ov, t) {
      const a = envelope(t, ov.in, ov.out, 0.5, 0.4);
      const lh = 46, lw = lh * LOGO_AR, w = lw + 28, h = 64;
      P.group(a, () => {
        P.panel(SA.x1 - w, SA.y0, w, h, { fill: '#FFFFFF', alpha: 0.97, radius: 12 });
        P.image(assets.logo, SA.x1 - w + 14, SA.y0 + 9, lw, lh);
      });
    },

    actTitle(ov, t) {
      const act = acts[ov.act];
      const k = inv(ov.in, ov.in + 0.7, t);
      const a = envelope(t, ov.in, ov.out, 0.3, 0.4);
      const o = { size: 28, weight: 800, family: 'Montserrat', spacing: 3 };
      const lw = P.measure(act.label, o);
      const x = SA.x0, y = SA.y0, h = 64, w = 72 + 22 + lw + 26;
      P.group(a, () => {
        ctx.save();
        ctx.beginPath(); ctx.rect(x - 4, y - 8, (w + 12) * ease.outCubic(k), h + 16); ctx.clip();
        P.panel(x, y, 64, h, { fill: '#00529B', alpha: 0.96, radius: 10 });
        P.text(act.eyebrow, x + 32, y + 43, { size: 30, weight: 900, family: 'Montserrat', align: 'center', color: '#FFFFFF' });
        P.panel(x + 72, y, w - 72, h, { radius: 10 });
        P.text(act.label, x + 72 + 22, y + 42, { ...o, color: '#FFFFFF' });
        P.rect(x + 72, y + h - 4, (w - 72) * clamp((t - act.start) / (act.end - act.start)), 4, '#F59E0B', 0.95);
        ctx.restore();
      });
    },

    statChip(ov, t) {
      const k = inv(ov.in, ov.in + 0.45, t);
      const a = envelope(t, ov.in, ov.out, 0.35, 0.35);
      const o = { size: 24, weight: 700, spacing: 2 };
      const tw = P.measure(ov.props.text, o);
      const x = LEFT, y = 196, h = 52, w = 44 + tw + 26;
      P.group(a, () => {
        P.panel(x, y, w, h, { radius: 26, stroke: '#00A3E0', strokeAlpha: 0.75 });
        P.circle(x + 25, y + 26, 7, '#F59E0B');
        P.text(ov.props.text, x + 44, y + 34, { ...o, color: '#FFFFFF' });
      }, slide(k));
    },

    counter(ov, t) {
      const pr = ov.props;
      const k = inv(ov.in, ov.in + 0.5, t);
      const a = envelope(t, ov.in, ov.out, 0.3, 0.35);
      const y = pr.slot === 'left1' ? 268 : 488;
      const x = LEFT, w = COL_W, h = 202;
      const v = pr.value * ease.outExpo(inv(ov.in + 0.1, ov.in + 1.7, t));
      P.group(a, () => {
        P.panel(x, y, w, h, { radius: 14 });
        P.rect(x, y + 16, 6, h - 32, '#F59E0B');
        let cx = x + 32;
        if (pr.prefix) cx += P.text(pr.prefix, cx, y + 110, { size: 64, weight: 800, family: 'Montserrat', color: '#FFFFFF' }) + 4;
        cx += P.text(fmt(Math.round(v)), cx, y + 110, { size: 100, weight: 900, family: 'Montserrat', color: '#FFFFFF' });
        if (pr.unit) P.text(pr.unit, cx + 6, y + 110, { size: 36, weight: 800, family: 'Montserrat', color: '#38BDF8' });
        P.text(pr.label, x + 32, y + 150, { size: 24, weight: 800, spacing: 3, color: '#F59E0B' });
        P.text(pr.sub, x + 32, y + 184, { size: 26, weight: 500, color: '#C7D5E4' });
      }, slide(k));
    },

    zoneCallouts(ov, t, frame) {
      const placed = [];
      ov.props.items.forEach((it, i) => {
        const tin = ov.in + i * ov.props.stagger;
        const an = frame.anchors[it.anchor];
        if (t < tin || !an || !an.visible) return;
        const a = envelope(t, tin, ov.out, 0.3, 0.35);
        const k = ease.outCubic(inv(tin, tin + 0.5, t));
        const col = accent[it.color];
        const tw = Math.max(P.measure(it.text, { size: 26, weight: 800, family: 'Montserrat', spacing: 1 }), P.measure(it.sub, { size: 24, weight: 500 }));
        const w = tw + 40, h = 70;
        let bx = clamp(an.x - w / 2, SA.x0, SA.x1 - w), by = clamp(an.y - 90 * k - h, SA.y0 + 84, 800 - h);
        // first free spot near the anchor that stays inside the safe area and clear of earlier callouts
        const free = (x, y) => !placed.some((p) => x < p.x1 + 8 && x + w > p.x0 - 8 && y < p.y1 + 8 && y + h > p.y0 - 8);
        search: for (const dy of [0, -80, 80, -160, 160, -240, 240]) {
          for (const dx of [0, -(w / 2 + 24), w / 2 + 24, -(w + 24), w + 24]) {
            const x = clamp(bx + dx, SA.x0, SA.x1 - w), y = clamp(by + dy, SA.y0 + 84, 800 - h);
            if (free(x, y)) { bx = x; by = y; break search; }
          }
        }
        placed.push({ x0: bx, y0: by, x1: bx + w, y1: by + h });
        const lx = clamp(an.x, bx + 12, bx + w - 12), ly = an.y < by ? by : by + h;
        P.group(a, () => {
          const ph = (t * 1.2 + i * 0.27) % 1;
          P.circle(an.x, an.y, 6, col);
          P.circle(an.x, an.y, 7 + 16 * ph, null, 1 - ph, col, 2);
          P.line([[an.x, an.y], [lx, ly]], col, 2, 0.9);
          P.panel(bx, by, w, h, { radius: 10 });
          P.rect(bx, by + 10, 5, h - 20, col);
          P.text(it.text, bx + 20, by + 31, { size: 26, weight: 800, family: 'Montserrat', spacing: 1, color: '#FFFFFF' });
          P.text(it.sub, bx + 20, by + 58, { size: 24, weight: 500, color: '#C7D5E4' });
        });
      });
    },

    tag3d(ov, t, frame) {
      const pr = ov.props;
      const an = frame.anchors[pr.anchor];
      if (!an || !an.visible) return;
      const a = envelope(t, ov.in, ov.out, 0.35, 0.3);
      const k = ease.outCubic(inv(ov.in, ov.in + 0.5, t));
      const o = { size: 24, weight: 700, spacing: 2 };
      const w = P.measure(pr.text, o) + 40, h = 50;
      const left = pr.side === 'left';
      let lx = an.x + pr.dx * k, ly = an.y + pr.dy * k;
      let bx = left ? lx - w : lx;
      bx = clamp(bx, SA.x0, SA.x1 - w);
      const by = clamp(ly - h / 2, SA.y0 + 84, 800 - h);
      lx = left ? bx + w : bx; ly = by + h / 2;
      P.group(a, () => {
        P.circle(an.x, an.y, 5, '#F59E0B');
        P.circle(an.x, an.y, 11, null, 0.7, '#F59E0B', 2);
        P.line([[an.x, an.y], [lerp(an.x, lx, 0.55), ly], [lx, ly]], '#F59E0B', 2, 0.9);
        P.panel(bx, by, w, h, { radius: 8 });
        P.rect(left ? bx + w - 5 : bx, by + 8, 5, h - 16, '#F59E0B');
        P.text(pr.text, bx + 20, by + 33, { ...o, color: '#FFFFFF' });
      });
    },

    callout3d(ov, t, frame) {
      const pr = ov.props;
      const an = frame.anchors[pr.anchor];
      if (!an || !an.visible) return;
      const a = envelope(t, ov.in, ov.out, 0.35, 0.3);
      const k = ease.outCubic(inv(ov.in, ov.in + 0.55, t));
      const tw = Math.max(P.measure(pr.title, { size: 30, weight: 800, family: 'Montserrat', spacing: 1 }), ...pr.lines.map((l) => P.measure(l, { size: 26, weight: 500 })));
      const w = tw + 48, h = 64 + pr.lines.length * 36;
      const left = pr.side === 'left';
      let bx = clamp(left ? an.x + pr.dx * k - w : an.x + pr.dx * k, SA.x0, SA.x1 - w);
      const by = clamp(an.y + pr.dy * k - h / 2, SA.y0 + 84, 800 - h);
      const lx = left ? bx + w : bx, ly = by + 34;
      P.group(a, () => {
        P.circle(an.x, an.y, 6, '#F59E0B');
        P.circle(an.x, an.y, 13, null, 0.7, '#F59E0B', 2);
        P.line([[an.x, an.y], [lerp(an.x, lx, 0.6), ly], [lx, ly]], '#F59E0B', 2, 0.95);
        P.panel(bx, by, w, h, { radius: 12, stroke: '#F59E0B', strokeAlpha: 0.55 });
        P.text(pr.title, bx + 24, by + 46, { size: 30, weight: 800, family: 'Montserrat', spacing: 1, color: '#F59E0B' });
        pr.lines.forEach((l, i) => P.text(l, bx + 24, by + 86 + i * 36, { size: 26, weight: 500, color: '#FFFFFF' }));
      });
    },

    reactorLadder(ov, t) {
      const pr = ov.props;
      const k = inv(ov.in, ov.in + 0.5, t);
      const a = envelope(t, ov.in, ov.out, 0.35, 0.35);
      const x = LEFT, y = 556, w = COL_W, h = 262;
      P.group(a, () => {
        P.panel(x, y, w, h, { radius: 14 });
        P.text(pr.title, x + 28, y + 44, { size: 24, weight: 800, spacing: 3, color: '#38BDF8' });
        const n = pr.sizes.length;
        const base = y + 196;
        pr.sizes.forEach((kl, i) => {
          const ki = ease.outBack(inv(ov.in + 0.15 + i * 0.13, ov.in + 0.6 + i * 0.13, t));
          if (ki <= 0) return;
          const f = Math.cbrt(kl / 16);
          const vw = 26 + 46 * f, vh = 34 + 86 * f;
          const cx = x + 66 + i * ((w - 132) / (n - 1));
          P.group(1, () => {
            const g = ctx.createLinearGradient(cx - vw / 2, 0, cx + vw / 2, 0);
            g.addColorStop(0, '#64748B'); g.addColorStop(0.45, '#E2E8F0'); g.addColorStop(1, '#475569');
            ctx.globalAlpha = P.alpha; ctx.fillStyle = g;
            ctx.beginPath(); ctx.roundRect(cx - vw / 2, base - vh, vw, vh, vw * 0.38); ctx.fill();
            ctx.save(); ctx.clip();
            const lvl = 0.62 * ease.outCubic(inv(ov.in + 0.5 + i * 0.13, ov.in + 1.6 + i * 0.13, t));
            P.rect(cx - vw / 2, base - vh * lvl, vw, vh * lvl, '#F59E0B', 0.85);
            ctx.restore();
          }, { px: cx, py: base, scale: ki });
          P.text(`${kl} KL`, cx, base + 36, { size: 26, weight: 800, family: 'Montserrat', align: 'center', color: '#FFFFFF' });
        });
        P.line([[x + 40, base + 2], [x + w - 40, base + 2]], '#38BDF8', 2, 0.5);
      }, slide(k));
    },

    barSplit(ov, t) { panelWithRows(ov, t, { rowH: 100, headerH: 206, labelSize: 28, valueSize: 30 }); },
    matrix(ov, t) { panelWithRows(ov, t, { rowH: 84, headerH: 198, labelSize: 26, valueSize: 28 }); },

    chips(ov, t) {
      const a = envelope(t, ov.in, ov.out, 0.3, 0.35);
      P.group(a, () => {
        ov.props.items.forEach((it, i) => {
          if (t < it.t) return;
          const k = inv(it.t, it.t + 0.45, t);
          const o = { size: 24, weight: 800, spacing: 1.5 };
          const w = 66 + P.measure(it.text, o) + 26, h = 58;
          const x = LEFT, y = 520 + i * 68;
          P.group(Math.min(1, k * 2), () => {
            P.panel(x, y, w, h, { radius: 29, stroke: '#4ADE80', strokeAlpha: 0.6 });
            P.circle(x + 29, y + 29, 21, '#2E7D32');
            icon(P, it.icon, x + 29, y + 29, 24, '#FFFFFF', 2.4);
            P.text(it.text, x + 62, y + 37, { ...o, color: '#FFFFFF' });
          }, slide(k, -30));
        });
      });
    },

    capacityHud(ov, t) {
      const pr = ov.props;
      const k = inv(ov.in, ov.in + 0.5, t);
      const a = envelope(t, ov.in, ov.out, 0.3, 0.3);
      const x = LEFT, y = 196, w = COL_W;
      const col = accent[pr.color], colT = accentText[pr.color];
      const vizH = { tankGrid: 176, stackedBar: 168, blenderRow: 226 }[pr.viz];
      const h = 236 + vizH + (pr.detail ? 44 : 6);
      P.group(a, () => {
        P.panel(x, y, w, h, { radius: 14 });
        P.rect(x, y + 16, 6, 190, col);
        // value + unit shrink together if a long unit (e.g. PALLETS) would overflow the panel
        let vs = 116;
        while (vs > 72 && P.measure(pr.value, { size: vs, weight: 900, family: 'Montserrat' }) + 10 + P.measure(pr.unit, { size: vs * 0.4, weight: 800, family: 'Montserrat' }) > w - 60) vs -= 4;
        const vw = P.text(pr.value, x + 30, y + 122, { size: vs, weight: 900, family: 'Montserrat', color: '#FFFFFF' });
        P.text(pr.unit, x + 30 + vw + 10, y + 122, { size: Math.round(vs * 0.4), weight: 800, family: 'Montserrat', color: colT });
        P.text(pr.title, x + 30, y + 170, { size: 28, weight: 800, spacing: 3, color: colT });
        P.text(pr.sub, x + 30, y + 210, { size: 28, weight: 500, color: '#C7D5E4' });
        const vy = y + 238;
        if (pr.viz === 'tankGrid') {
          for (let i = 0; i < pr.count; i++) {
            const r = Math.floor(i / 6), c = i % 6;
            const tx = x + 30 + c * 84, ty = vy + r * 82;
            const ki = ease.outBack(inv(ov.in + 0.2 + i * 0.05, ov.in + 0.6 + i * 0.05, t));
            if (ki <= 0) continue;
            P.group(1, () => {
              ctx.globalAlpha = P.alpha;
              ctx.beginPath(); ctx.roundRect(tx, ty, 66, 64, 22);
              ctx.fillStyle = 'rgba(148,163,184,0.18)'; ctx.fill();
              ctx.save(); ctx.clip();
              const lvl = 0.25 + 0.6 * ease.outCubic(inv(ov.in + 0.5 + i * 0.05, ov.in + 2.6, t));
              P.rect(tx, ty + 64 * (1 - lvl), 66, 64 * lvl, col, 0.9);
              ctx.restore();
              ctx.globalAlpha = P.alpha; ctx.strokeStyle = '#CBD5E1'; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.roundRect(tx, ty, 66, 64, 22); ctx.stroke();
            }, { px: tx + 33, py: ty + 32, scale: ki });
          }
        } else {
          const segs = pr.segments;
          const total = segs.reduce((s, g) => s + g.value, 0);
          const pal = pr.viz === 'stackedBar' ? ['#00A3E0', '#F59E0B', '#A78BFA'] : ['#E2E8F0', '#6E86A0', '#3E5670'];
          let bx = x + 30;
          const grow = ease.outCubic(inv(ov.in + 0.3, ov.in + 1.5, t));
          let barY = vy + 4;
          if (pr.viz === 'blenderRow') {
            for (let i = 0; i < pr.count; i++) {
              const ki = ease.outBack(inv(ov.in + 0.2 + i * 0.05, ov.in + 0.55 + i * 0.05, t));
              if (ki <= 0) continue;
              const ix = x + 30 + i * 42, iy = vy + 4;
              const ss = i < 5;
              P.group(1, () => {
                P.panel(ix, iy + 10, 34, 40, { fill: ss ? '#E2E8F0' : '#6E86A0', alpha: 1, radius: 8 });
                P.rect(ix + 14, iy, 6, 10, '#94A3B8');
              }, { px: ix + 17, py: iy + 50, scale: ki });
            }
            barY = vy + 62;
          }
          segs.forEach((sg, i) => {
            const sw = (w - 60) * (sg.value / total) * grow;
            P.rect(bx, barY, Math.max(0, sw - 3), 26, pal[i]);
            bx += sw;
          });
          segs.forEach((sg, i) => {
            const ly = barY + 66 + i * 36;
            P.rect(x + 30, ly - 17, 18, 18, pal[i]);
            P.text(sg.label, x + 60, ly, { size: 24, weight: 600, color: '#FFFFFF' });
            P.text(`${fmt(sg.value)} ${pr.segUnit || 'KL'}`, x + w - 30, ly, { size: 24, weight: 700, color: '#C7D5E4', align: 'right' });
          });
        }
        if (pr.detail) P.text(pr.detail, x + 30, y + h - 22, { size: 24, weight: 500, color: '#9FB3C8' });
      }, slide(k));
    },

    // stacked badge list on the right; props.fill / glow recolour it (green for EHS, MPD blue for the labs),
    // props.compact fits six items above the captions
    ecoBadges(ov, t) {
      const pr = ov.props, c = pr.compact;
      const x = RIGHT, w = COL_W, h = c ? 92 : 112, gap = c ? 10 : 14;
      const fill = pr.fill || '#2E7D32', glow = pr.glow || 'rgba(46,125,50,0.55)';
      pr.items.forEach((it, i) => {
        if (t < it.t) return;
        const k = inv(it.t, it.t + 0.4, t);
        const a = envelope(t, it.t, ov.out, 0.25, 0.3);
        const y = 196 + i * (h + gap), cy = y + h / 2;
        P.group(a, () => {
          P.panel(x, y, w, h, { fill, alpha: 0.96, radius: 16, shadow: 22, shadowColor: glow });
          P.circle(x + 52, cy, c ? 30 : 36, '#FFFFFF', 0.16);
          icon(P, it.icon, x + 52, cy, c ? 32 : 38, '#FFFFFF', 2.8);
          const to = P.fit(it.title, w - 124, { size: c ? 27 : 30, weight: 800, family: 'Montserrat' });
          P.text(it.title, x + 100, cy - 6, { ...to, color: '#FFFFFF' });
          P.text(it.sub, x + 100, cy + (c ? 27 : 30), { ...P.fit(it.sub, w - 124, { size: 24, weight: 500 }), color: '#F0FDF4' });
        }, { px: x + w / 2, py: cy, scale: 0.88 + 0.12 * ease.outBack(k) });
      });
    },

    // right-column summary: one row per store, then a highlighted total line
    storageTotals(ov, t) {
      const pr = ov.props;
      const k = inv(ov.in, ov.in + 0.45, t);
      const a = envelope(t, ov.in, ov.out, 0.3, 0.35);
      const x = RIGHT, y = 196, w = COL_W, rowH = 86;
      // the panel grows as rows and the total are spoken
      const shown = pr.rows.reduce((n, r) => n + ease.outCubic(inv(r.t - 0.1, r.t + 0.3, t)), 0);
      const h = 82 + shown * rowH + 96 * ease.outCubic(inv(pr.total.t - 0.1, pr.total.t + 0.3, t)) + 10;
      P.group(a, () => {
        P.panel(x, y, w, h, { radius: 14, stroke: '#F59E0B', strokeAlpha: 0.6 });
        P.text(pr.title, x + 28, y + 50, { ...P.fit(pr.title, w - 56, { size: 26, weight: 800, spacing: 3 }), color: '#F59E0B' });
        pr.rows.forEach((r, i) => {
          if (t < r.t) return;
          const kr = inv(r.t, r.t + 0.4, t);
          const ry = y + 82 + i * rowH;
          P.group(Math.min(1, kr * 2), () => {
            P.rect(x + 28, ry + 8, 5, rowH - 22, '#38BDF8');
            P.text(r.label, x + 46, ry + 34, { size: 24, weight: 600, color: '#C7D5E4' });
            P.text(r.value, x + 46, ry + 70, { size: 32, weight: 800, family: 'Montserrat', color: '#FFFFFF' });
          }, { dx: 24 * (1 - ease.outCubic(kr)) });
        });
        if (t >= pr.total.t) {
          const kt = inv(pr.total.t, pr.total.t + 0.45, t);
          const ty = y + 82 + pr.rows.length * rowH + 8;
          P.group(Math.min(1, kt * 2), () => {
            P.panel(x + 20, ty, w - 40, 76, { fill: '#F59E0B', alpha: 1, radius: 12 });
            P.text(pr.total.text, x + w / 2, ty + 49, { ...P.fit(pr.total.text, w - 80, { size: 30, weight: 900, family: 'Montserrat' }), align: 'center', color: '#0A1626' });
          }, { px: x + w / 2, py: ty + 38, scale: 0.9 + 0.1 * ease.outBack(kt) });
        }
      }, slide(k, 24));
    },

    partnerCards(ov, t) {
      const items = ov.props.items;
      const cw = 470, gap = 33, ch = 372, total = 3 * cw + 2 * gap;
      const x0 = 960 - total / 2, y = 226;
      const ribbon = timeline.overlays.find((o) => o.type === 'ribbon');
      let active = -1;
      items.forEach((it, i) => { if (t >= it.t) active = i; });
      if (ribbon && t >= ribbon.in) active = -1;
      const aOut = envelope(t, ov.in, ov.out, 0.01, 0.4);
      items.forEach((it, i) => {
        if (t < it.t) return;
        const k = inv(it.t, it.t + 0.65, t);
        const isActive = i === active;
        const lift = isActive ? -16 * ease.outCubic(inv(it.t, it.t + 0.5, t)) : 0;
        const x = x0 + i * (cw + gap);
        P.group(aOut * Math.min(1, k * 2.5), () => {
          P.panel(x, y, cw, ch, { fill: '#FFFFFF', alpha: 1, radius: 18, shadow: isActive ? 44 : 20, shadowColor: isActive ? 'rgba(245,158,11,0.6)' : 'rgba(0,0,0,0.45)' });
          ctx.save();
          ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 18); ctx.clip();
          P.rect(x, y, cw, 10, isActive ? '#F59E0B' : '#00529B');
          ctx.restore();
          P.text(it.n, x + 36, y + 96, { size: 60, weight: 900, family: 'Montserrat', color: '#00529B' });
          P.text(it.title, x + 36, y + 156, { size: 34, weight: 800, family: 'Montserrat', color: '#0B2545' });
          const lines = P.wrap(it.body, cw - 72, { size: 26, weight: 500 });
          lines.forEach((l, j) => P.text(l, x + 36, y + 208 + j * 38, { size: 26, weight: 500, color: '#334155' }));
        }, { px: x + cw / 2, py: y + ch / 2, scale: 1, sx: Math.max(0.02, ease.outBack(k)), dy: lift + 40 * (1 - ease.outCubic(k)) });
      });
    },

    ribbon(ov, t) {
      const k = inv(ov.in, ov.in + 0.5, t);
      const a = envelope(t, ov.in, ov.out, 0.35, 0.4);
      const total = 3 * 470 + 2 * 33, x = 960 - total / 2, y = 626, h = 66;
      P.group(a, () => {
        P.panel(x, y, total, h, { radius: 33, stroke: '#00A3E0', strokeAlpha: 0.7 });
        const eb = P.text('IN EVERY MODEL', x + 32, y + 42, { size: 24, weight: 800, family: 'Montserrat', spacing: 2, color: '#F59E0B' });
        const slotW = (total - 32 - eb - 40) / 3;
        ov.props.items.forEach((s, i) => {
          const ki = inv(ov.in + 0.15 + i * 0.15, ov.in + 0.5 + i * 0.15, t);
          const sx = x + 32 + eb + 40 + i * slotW;
          P.group(ki, () => {
            P.circle(sx + 16, y + 33, 16, '#00A3E0');
            icon(P, 'check', sx + 16, y + 33, 20, '#FFFFFF', 3);
            P.text(s, sx + 42, y + 42, { size: 26, weight: 700, color: '#FFFFFF' });
          });
        });
      }, { dy: 20 * (1 - ease.outCubic(k)) });
    },

    contactCard(ov, t) {
      const pr = ov.props;
      const k = inv(ov.in, ov.in + 0.7, t);
      const a = envelope(t, ov.in, ov.out, 0.45, 0.3);
      const cw = 1000, ch = 470, x = 960 - cw / 2, y = 292;
      P.group(a, () => {
        P.panel(x, y, cw, ch, { fill: '#FFFFFF', alpha: 1, radius: 24, shadow: 52, shadowColor: 'rgba(0,163,224,0.55)' });
        const lw = 380, lh = lw / LOGO_AR;
        P.image(assets.logo, x + 44, y + 40, lw, lh);
        const o = { size: 26, weight: 800, family: 'Montserrat', spacing: 2 };
        const tw = P.measure(pr.cta, o);
        P.panel(x + cw - 48 - tw - 52, y + 78, tw + 52, 54, { fill: '#F59E0B', alpha: 1, radius: 27 });
        P.text(pr.cta, x + cw - 48 - tw - 26, y + 114, { ...o, color: '#0A1626' });
        P.rect(x + 48, y + 196, cw - 96, 2, '#E2E8F0');
        const kk = (d) => ease.outCubic(inv(ov.in + d, ov.in + d + 0.5, t));
        P.group(kk(0.25), () => {
          P.text(pr.name, x + 48, y + 270, { size: 54, weight: 800, family: 'Montserrat', color: '#0B2545' });
          P.text(pr.role, x + 48, y + 312, { size: 30, weight: 600, color: '#00529B' });
        });
        P.group(kk(0.45), () => {
          P.circle(x + 66, y + 372, 22, '#00529B');
          icon(P, 'phone', x + 66, y + 372, 22, '#FFFFFF', 2.4);
          P.text(pr.phone, x + 102, y + 384, { size: 32, weight: 700, color: '#0B2545' });
          P.circle(x + 520, y + 372, 22, '#00529B');
          icon(P, 'mail', x + 520, y + 372, 22, '#FFFFFF', 2.4);
          P.text(pr.email, x + 556, y + 384, { size: 32, weight: 700, color: '#0B2545' });
        });
        P.group(kk(0.65), () => P.text(pr.company, x + 48, y + 438, { size: 26, weight: 500, color: '#475569' }));
      }, { px: 960, py: y + ch / 2, scale: 0.9 + 0.1 * ease.outBack(k) });
    },

    captions(ov, t) {
      const cue = timeline.captions.find((c) => t >= c.start && t <= c.end);
      if (!cue) return;
      const a = envelope(t, cue.start, cue.end, 0.15, 0.2);
      const o = { size: 34, weight: 600 };
      const space = P.measure(' ', o);
      const ws = cue.words.map((w) => ({ ...w, w: P.measure(w.text, o) }));
      const totalW = ws.reduce((s, w) => s + w.w, 0) + space * (ws.length - 1);
      const maxW = 1180;
      let rows = [ws];
      if (totalW > maxW) {
        let best = 1, bestCost = 1e9, acc = 0;
        for (let i = 0; i < ws.length - 1; i++) {
          acc += ws[i].w + space;
          const cost = Math.abs(acc - (totalW - acc));
          if (cost < bestCost) { bestCost = cost; best = i + 1; }
        }
        rows = [ws.slice(0, best), ws.slice(best)];
      }
      const rowW = rows.map((r) => r.reduce((s, w) => s + w.w, 0) + space * (r.length - 1));
      const lh = 48, bw = Math.max(...rowW) + 60, bh = rows.length * lh + 26;
      const bx = 960 - bw / 2, by = SA.y1 - 10 - bh;
      P.group(a, () => {
        P.panel(bx, by, bw, bh, { fill: H.captionBg, alpha: 0.86, radius: 14 });
        rows.forEach((r, ri) => {
          let cx = 960 - rowW[ri] / 2;
          for (const w of r) {
            const color = w.end <= t ? H.captionText : (w.start <= t ? H.captionActive : '#9FB3C8');
            P.text(w.text, cx, by + 13 + (ri + 1) * lh - 13, { ...o, color });
            cx += w.w + space;
          }
        });
      });
    },
  };

  function panelWithRows(ov, t, L) {
    const pr = ov.props;
    const k = inv(ov.in, ov.in + 0.5, t);
    const a = envelope(t, ov.in, ov.out, 0.3, 0.35);
    const x = RIGHT, y = 190, w = COL_W;
    const col = accent[pr.color], colT = accentText[pr.color];
    const maxV = Math.max(...pr.rows.map((r) => r.value));
    const lastT = pr.rows[pr.rows.length - 1].t;
    const footK = pr.footer ? ease.outCubic(inv(lastT + 0.6, lastT + 1.1, t)) : 0;
    // panel grows as rows are spoken
    const grown = pr.rows.reduce((s, r) => s + L.rowH * ease.outCubic(inv(r.t - 0.15, r.t + 0.3, t)), 0);
    const h = L.headerH + grown + 12 + 40 * footK;
    // running total = sum of the rows revealed so far; it lands on the spoken total
    const running = pr.rows.reduce((s, r) => s + r.value * ease.outExpo(inv(r.t, r.t + 1.0, t)), 0);
    const tt = pr.total.t;
    const pulse = t >= tt ? Math.max(0, 1 - (t - tt) / 0.6) : 0;
    P.group(a, () => {
      P.panel(x, y, w, h, { radius: 14, stroke: col, strokeAlpha: 0.35 + 0.5 * pulse });
      const to = P.fit(pr.title, w - 56, { size: 24, weight: 800, spacing: 3 });
      P.text(pr.title, x + 28, y + 46, { ...to, color: colT });
      P.group(1, () => {
        const nw = P.text(fmt(Math.round(running)), x + 28, y + 136, { size: 92, weight: 900, family: 'Montserrat', color: pulse > 0.05 ? '#FDE68A' : '#FFFFFF' });
        P.text('T/month', x + 28 + nw + 12, y + 136, { size: 32, weight: 800, family: 'Montserrat', color: colT });
      }, { px: x + 28, py: y + 110, scale: 1 + 0.07 * Math.sin(pulse * Math.PI) });
      P.text(pr.total.label, x + 28, y + 172, { size: 24, weight: 700, spacing: 3, color: '#9FB3C8' });
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      pr.rows.forEach((row, i) => {
        if (t < row.t - 0.15) return;
        const kr = inv(row.t, row.t + 0.5, t);
        const ry = y + L.headerH + i * L.rowH;
        const v = row.value * ease.outExpo(inv(row.t, row.t + 1.0, t));
        P.group(Math.min(1, kr * 2), () => {
          P.text(row.label, x + 28, ry + 28, { size: L.labelSize, weight: 700, color: '#FFFFFF' });
          P.text(`${fmt(Math.round(v))} T`, x + w - 28, ry + 28, { size: L.valueSize, weight: 800, family: 'Montserrat', color: '#FFFFFF', align: 'right' });
          const bw = (w - 56) * (row.value / maxV) * ease.outCubic(inv(row.t, row.t + 0.9, t));
          P.panel(x + 28, ry + 42, w - 56, 10, { fill: '#FFFFFF', alpha: 0.12, radius: 5 });
          if (bw > 2) {
            const g = ctx.createLinearGradient(x + 28, 0, x + 28 + bw, 0);
            g.addColorStop(0, pr.color === 'plant1' ? '#00529B' : '#1B5E20'); g.addColorStop(1, col);
            ctx.globalAlpha = P.alpha; ctx.fillStyle = g;
            ctx.beginPath(); ctx.roundRect(x + 28, ry + 42, bw, 10, 5); ctx.fill();
          }
          P.text(row.detail, x + 28, ry + 42 + 10 + 28, { size: 24, weight: 500, color: '#9FB3C8' });
        }, { dx: 24 * (1 - ease.outCubic(kr)) });
      });
      ctx.restore();
      if (pr.footer) P.group(footK, () => P.text(pr.footer, x + 28, y + h - 22, { ...P.fit(pr.footer, w - 56, { size: 24, weight: 700, spacing: 2 }), color: '#C7D5E4' }));
    }, { dy: 28 * (1 - ease.outCubic(k)) });
  }

  return {
    setHideText(v) { P.hideText = v; },
    clear() { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, HH); return []; },
    draw(t, frame) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, HH);
      ctx.globalAlpha = 1;
      P.manifest = [];
      P.alphaStack = [1 - frame.fade];
      for (const ov of timeline.overlays) {
        if (t < ov.in - 0.01 || t > ov.out + 0.01) continue;
        P.owner = ov.id;
        const fn = DRAW[ov.type];
        if (fn) fn(ov, t, frame);
      }
      return P.manifest;
    },
  };
}
