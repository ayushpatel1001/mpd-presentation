// Timeline engine: groups narration beats into scenes, gives each scene timing helpers synced to the voice,
// draws slide transitions between scenes and exposes window.renderFrame(t) for the frame renderer.
'use strict';

const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let TL = null, SEGS = [];
const PRE = 0.15;      // visuals lead the voice slightly
const TR = 0.55;       // scene transition length

function setTimeline(tl) {
  TL = tl;
  SEGS = [];
  for (const b of tl.beats) {
    const last = SEGS[SEGS.length - 1];
    if (!last || last.scene !== b.scene || b.scene === 'chapter') SEGS.push({ scene: b.scene, beats: [b] });
    else last.beats.push(b);
  }
  SEGS.forEach((s, i) => {
    s.start = Math.max(0, s.beats[0].start - (i ? 0.45 : 1.2));
    s.steps = {};
    for (const b of s.beats) if (s.steps[b.step] === undefined) s.steps[b.step] = { t: b.start - PRE, beat: b };
    s.firstStep = Math.min(...s.beats.map((b) => b.step));
  });
  SEGS.forEach((s, i) => { s.end = i + 1 < SEGS.length ? SEGS[i + 1].start : tl.duration; });
}

function segIndexAt(t) {
  let i = 0;
  while (i + 1 < SEGS.length && SEGS[i + 1].start <= t) i++;
  return i;
}

// timing helpers handed to every scene
function makeS(seg, t) {
  const S = { t, seg, lt: t - seg.start, dur: seg.end - seg.start, args: seg.beats[0].args || {} };
  let cur = seg.firstStep;
  for (const k of Object.keys(seg.steps).map(Number).sort((a, b) => a - b)) if (seg.steps[k].t <= t) cur = k;
  S.step = cur;
  S.stepT = (k) => (seg.steps[k] ? seg.steps[k].t : (k < seg.firstStep ? -1e9 : 1e9));
  // progress (0..1) of something that appears `delay` s after step k begins, over `dur` s
  S.P = (k, delay = 0, dur = 0.6) => clamp((t - (S.stepT(k) + delay)) / dur);
  // absolute time a word is spoken within step k's beat (character-proportional estimate)
  S.W = (k, word, occ = 0) => {
    const st = seg.steps[k];
    if (!st) return k < seg.firstStep ? -1e9 : 1e9;
    const b = st.beat, s = b.text.toLowerCase();
    let idx = -1;
    for (let i = 0; i <= occ; i++) idx = s.indexOf(word.toLowerCase(), idx + 1);
    if (idx < 0) idx = 0;
    return b.start + (idx / s.length) * (b.end - b.start) - 0.12;
  };
  S.PW = (k, word, dur = 0.5, delay = 0, occ = 0) => clamp((t - (S.W(k, word, occ) + delay)) / dur);
  S.beatEnd = (k) => (seg.steps[k] ? seg.steps[k].beat.end : 1e9);
  return S;
}

function drawSeg(i, t) {
  const seg = SEGS[i];
  const fn = SCENES[seg.scene];
  const S = makeS(seg, t);
  ctx.save();
  // slow push-in on every scene (Vox-style camera drift)
  const z = 1 + 0.025 * clamp(S.lt / Math.max(S.dur, 1));
  ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
  fn(ctx, S);
  ctx.restore();
}

function sectionTag(t) {
  // small running label of the current chapter, top-left, hidden on chapter cards and the opening
  const i = segIndexAt(t), seg = SEGS[i];
  if (seg.scene === 'chapter' || seg.scene === 'title' || seg.scene === 'outro') return;
  let ch = null;
  for (let j = i; j >= 0; j--) if (SEGS[j].scene === 'chapter') { ch = SEGS[j]; break; }
  if (!ch) return;
  const a = clamp((t - seg.start - 0.4) / 0.4);
  const { num, title } = ch.beats[0].args;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = C.ink; roundRect(ctx, 48, 40, 64, 44, 4); ctx.fill();
  text(ctx, num, 80, 74, { size: 30, weight: 700, color: C.yellow, align: 'center' });
  text(ctx, title.toUpperCase(), 128, 73, { size: 26, weight: 600, color: C.ink, spacing: 2 });
  ctx.restore();
}

function renderFrame(t) {
  const i = segIndexAt(t);
  const seg = SEGS[i];
  const k = (t - seg.start) / TR;
  if (i > 0 && k < 1) {
    const e = easeInOut(k);
    ctx.save(); ctx.translate(-W * e, 0); drawSeg(i - 1, t); ctx.restore();
    ctx.save(); ctx.translate(W * (1 - e), 0); drawSeg(i, t);
    // yellow leading edge on the incoming panel
    ctx.fillStyle = C.yellow; ctx.fillRect(-14, 0, 14, H);
    ctx.restore();
  } else {
    drawSeg(i, t);
  }
  sectionTag(t);
  // fade from black at the start, to black at the end
  const fade = Math.max(clamp(1 - t / 0.8), clamp((t - (TL.duration - 1.6)) / 1.4));
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
}

async function loadFonts() {
  const faces = [
    new FontFace('Oswald', 'url("../fonts/Oswald%5Bwght%5D.ttf")', { weight: '200 700' }),
    new FontFace('Manrope', 'url("../fonts/Manrope%5Bwght%5D.ttf")', { weight: '200 800' }),
  ];
  for (const f of faces) { await f.load(); document.fonts.add(f); }
}

window.ready = (async () => {
  await loadFonts();
  buildPaper();
  return true;
})();
window.setTimeline = setTimeline;
window.renderFrame = renderFrame;
