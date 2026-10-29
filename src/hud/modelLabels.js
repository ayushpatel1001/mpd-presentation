// Model call-outs for review stills (state `modelLabels` > 0.5; hidden in the film by default): a leader line from a
// projected 3D anchor to a small panel with a title and detail lines. Drawn on the HUD canvas at 1920×1080.
export function drawModelLabels(ctx, items, anchors, tokens) {
  const H = tokens.color.hud;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const it of items) {
    const a = anchors[it.anchor];
    if (!a || !a.visible) continue;
    const [dx, dy] = it.offset || [60, -110];
    ctx.font = '800 22px Montserrat';
    let w = ctx.measureText(it.title).width;
    ctx.font = '500 18px Inter';
    for (const l of it.lines) w = Math.max(w, ctx.measureText(l).width);
    const pw = w + 32, ph = 44 + it.lines.length * 26;
    let x = a.x + dx, y = a.y + dy;
    if (dx < 0) x -= pw;
    x = Math.min(Math.max(x, 24), 1920 - pw - 24);
    y = Math.min(Math.max(y, 24), 1080 - ph - 24);
    const lx = Math.min(Math.max(a.x, x), x + pw), ly = Math.min(Math.max(a.y, y), y + ph);
    ctx.strokeStyle = it.color || H.panelStroke;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(lx, ly); ctx.stroke();
    ctx.fillStyle = it.color || H.panelStroke;
    ctx.beginPath(); ctx.arc(a.x, a.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = H.panelAlpha;
    ctx.fillStyle = H.panel;
    ctx.fillRect(x, y, pw, ph);
    ctx.globalAlpha = 1;
    ctx.strokeRect(x + 1, y + 1, pw - 2, ph - 2);
    ctx.fillRect(x, y, 6, ph);
    ctx.fillStyle = H.textPrimary;
    ctx.font = '800 22px Montserrat';
    ctx.textBaseline = 'top';
    ctx.fillText(it.title, x + 18, y + 12);
    ctx.font = '500 18px Inter';
    ctx.fillStyle = H.textSecondary;
    it.lines.forEach((l, i) => ctx.fillText(l, x + 18, y + 44 + i * 26));
  }
  ctx.restore();
}
