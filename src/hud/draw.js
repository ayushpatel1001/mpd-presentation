// Canvas 2D drawing primitives for the HUD. Every text draw is recorded in a manifest
// (screen-space box, size, colour, alpha) that scripts/validate.mjs checks for contrast,
// minimum size, safe-area containment and reading time.

export class Painter {
  constructor(ctx, tokens) {
    this.ctx = ctx;
    this.T = tokens;
    this.manifest = [];
    this.hideText = false;
    this.owner = '';
    this.alphaStack = [1];
  }

  get alpha() { return this.alphaStack[this.alphaStack.length - 1]; }

  // Run fn with a multiplied alpha and an optional scale about (px, py).
  group(alpha, fn, { px = 0, py = 0, scale = 1, dx = 0, dy = 0, sx = null } = {}) {
    if (alpha <= 0.002) return;
    const { ctx } = this;
    ctx.save();
    this.alphaStack.push(this.alpha * alpha);
    ctx.translate(px + dx, py + dy);
    ctx.scale(sx ?? scale, scale);
    ctx.translate(-px, -py);
    try { fn(); } finally { this.alphaStack.pop(); ctx.restore(); }
  }

  font(size, weight = 600, family = 'Inter') { return `${weight} ${size}px "${family}"`; }

  measure(str, { size, weight = 600, family = 'Inter', spacing = 0 }) {
    const { ctx } = this;
    ctx.font = this.font(size, weight, family);
    ctx.letterSpacing = `${spacing}px`;
    return ctx.measureText(str).width;
  }

  text(str, x, y, o) {
    const { ctx } = this;
    const { size, weight = 600, family = 'Inter', color = '#fff', align = 'left', spacing = 0, alpha = 1 } = o;
    ctx.font = this.font(size, weight, family);
    ctx.letterSpacing = `${spacing}px`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText(str);
    const a = this.alpha * alpha;
    if (a > 0.002) {
      const w = m.width;
      const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
      const tr = ctx.getTransform();
      const p0 = tr.transformPoint({ x: x0, y: y - size * 0.76 });
      const p1 = tr.transformPoint({ x: x0 + w, y: y + size * 0.24 });
      this.manifest.push({
        owner: this.owner, text: str, x0: Math.min(p0.x, p1.x), y0: Math.min(p0.y, p1.y), x1: Math.max(p0.x, p1.x), y1: Math.max(p0.y, p1.y),
        size: size * Math.abs(tr.d), weight, color, alpha: a,
      });
      if (!this.hideText) {
        ctx.globalAlpha = a;
        ctx.fillStyle = color;
        ctx.fillText(str, x, y);
      }
    }
    return m.width;
  }

  panel(x, y, w, h, { fill = this.T.color.hud.panel, alpha = this.T.color.hud.panelAlpha, radius = this.T.shape.radius, stroke = null, strokeAlpha = 0.6, lineWidth = 2, shadow = 0, shadowColor = 'rgba(0,0,0,0.5)' } = {}) {
    const { ctx } = this;
    ctx.globalAlpha = this.alpha * alpha;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    if (shadow) { ctx.shadowColor = shadowColor; ctx.shadowBlur = shadow; ctx.shadowOffsetY = shadow * 0.25; }
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    if (stroke) {
      ctx.globalAlpha = this.alpha * strokeAlpha;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  rect(x, y, w, h, color, alpha = 1) {
    this.ctx.globalAlpha = this.alpha * alpha;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  line(pts, color, width = 2, alpha = 1, dash = null) {
    const { ctx } = this;
    ctx.globalAlpha = this.alpha * alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash || []);
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  circle(x, y, r, fill, alpha = 1, stroke = null, lw = 2) {
    const { ctx } = this;
    ctx.globalAlpha = this.alpha * alpha;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }

  image(img, x, y, w, h, alpha = 1) {
    this.ctx.globalAlpha = this.alpha * alpha;
    this.ctx.drawImage(img, x, y, w, h);
  }

  // Shrink letter-spacing, then size (never below minSize), until str fits maxWidth.
  fit(str, maxWidth, o, minSize = 24) {
    const f = { ...o };
    while (this.measure(str, f) > maxWidth && (f.spacing ?? 0) > 0.5) f.spacing = Math.max(0, (f.spacing ?? 0) - 0.5);
    while (this.measure(str, f) > maxWidth && f.size > minSize) f.size -= 1;
    return f;
  }

  wrap(str, maxWidth, o) {
    const words = str.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (this.measure(test, o) > maxWidth && cur) { lines.push(cur); cur = w; } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }
}

export const fmt = (v, decimals = 0) => v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// Simple line icons, drawn in a size×size box centred on (x, y).
export function icon(p, name, x, y, size, color, lw = 2.6) {
  const { ctx } = p;
  const s = size / 2;
  ctx.save();
  ctx.globalAlpha = p.alpha;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.translate(x, y);
  ctx.beginPath();
  switch (name) {
    case 'flame':
      ctx.moveTo(0, s * 0.9);
      ctx.bezierCurveTo(-s * 0.8, s * 0.8, -s * 0.8, -s * 0.1, -s * 0.1, -s * 0.9);
      ctx.bezierCurveTo(0, -s * 0.3, s * 0.35, -s * 0.35, s * 0.3, -s * 0.6);
      ctx.bezierCurveTo(s * 0.9, 0, s * 0.8, s * 0.8, 0, s * 0.9);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, s * 0.7); ctx.bezierCurveTo(-s * 0.35, s * 0.6, -s * 0.3, s * 0.15, 0, -s * 0.1); ctx.bezierCurveTo(s * 0.3, s * 0.2, s * 0.35, s * 0.6, 0, s * 0.7); ctx.stroke();
      break;
    case 'n2':
      ctx.arc(-s * 0.42, 0, s * 0.38, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(s * 0.42, 0, s * 0.38, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.05, -s * 0.12); ctx.lineTo(s * 0.05, -s * 0.12); ctx.moveTo(-s * 0.05, s * 0.12); ctx.lineTo(s * 0.05, s * 0.12); ctx.stroke();
      break;
    case 'drop':
      ctx.moveTo(0, -s * 0.95);
      ctx.bezierCurveTo(s * 0.2, -s * 0.5, s * 0.75, 0, s * 0.75, s * 0.3);
      ctx.arc(0, s * 0.3, s * 0.75, 0, Math.PI);
      ctx.bezierCurveTo(-s * 0.75, 0, -s * 0.2, -s * 0.5, 0, -s * 0.95);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(0, s * 0.3, s * 0.38, Math.PI * 0.15, Math.PI * 0.75); ctx.stroke();
      break;
    case 'fan':
      for (let k = 0; k < 3; k++) {
        ctx.save(); ctx.rotate((k * Math.PI * 2) / 3);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(s * 0.2, -s * 0.7, s * 0.75, -s * 0.6, s * 0.55, -s * 0.15); ctx.closePath(); ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath(); ctx.arc(0, 0, s * 0.12, 0, Math.PI * 2); ctx.fill();
      break;
    case 'flaker':
      ctx.moveTo(-s * 0.9, -s * 0.2); ctx.lineTo(s * 0.5, -s * 0.2); ctx.moveTo(-s * 0.9, s * 0.05); ctx.lineTo(s * 0.5, s * 0.05); ctx.stroke();
      for (const [fx, fy] of [[s * 0.65, s * 0.3], [s * 0.85, s * 0.6], [s * 0.45, s * 0.75], [s * 0.75, s * 0.95]]) { ctx.beginPath(); ctx.rect(fx - 4, fy - 3, 8, 6); ctx.fill(); }
      break;
    case 'pellet':
      for (const [px, py] of [[-s * 0.5, s * 0.35], [0, s * 0.35], [s * 0.5, s * 0.35], [-s * 0.25, -s * 0.1], [s * 0.25, -s * 0.1], [0, -s * 0.55]]) { ctx.beginPath(); ctx.arc(px, py, s * 0.2, Math.PI, 0); ctx.closePath(); ctx.fill(); }
      break;
    case 'crusher':
      ctx.arc(-s * 0.38, 0, s * 0.36, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(s * 0.38, 0, s * 0.36, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.6, -s * 0.85); ctx.lineTo(0, -s * 0.45); ctx.lineTo(s * 0.6, -s * 0.85); ctx.stroke();
      break;
    case 'tray':
      for (const yy of [-s * 0.55, 0, s * 0.55]) { ctx.beginPath(); ctx.moveTo(-s * 0.85, yy - s * 0.15); ctx.lineTo(-s * 0.75, yy + s * 0.15); ctx.lineTo(s * 0.75, yy + s * 0.15); ctx.lineTo(s * 0.85, yy - s * 0.15); ctx.stroke(); }
      break;
    case 'check':
      ctx.moveTo(-s * 0.5, 0); ctx.lineTo(-s * 0.12, s * 0.38); ctx.lineTo(s * 0.55, -s * 0.4); ctx.stroke();
      break;
    case 'phone':
      ctx.roundRect(-s * 0.45, -s * 0.85, s * 0.9, s * 1.7, s * 0.18); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, s * 0.6, s * 0.09, 0, Math.PI * 2); ctx.fill();
      break;
    case 'mail':
      ctx.roundRect(-s * 0.9, -s * 0.6, s * 1.8, s * 1.2, s * 0.12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.85, -s * 0.5); ctx.lineTo(0, s * 0.1); ctx.lineTo(s * 0.85, -s * 0.5); ctx.stroke();
      break;
    default:
      ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
