// Site gates (layout.js GATES): each is a portal of two stone-clad piers carrying a deep-blue beam with an illuminated
// sign on both faces — MPD logo, "UNIT 1 · GATE n" and the gate's role. Entry gates 1 and 2 (on the 30 m road) get
// feature wing walls, planters, sliding gates parked open and a boom barrier; the material exit (gate 3) stands on
// the floor of the sunken ash-silo yard with its sliding gates closed. Gate design is not on the drawings — assumed.
import * as THREE from 'three';
import { makeMat, patchRise, withRise } from './materials.js';
import { riseDelay } from './site.js';
import { GATES } from './layout.js';

const PIER = 1.3;                                   // pier section; piers stop under the beam so the whole sign shows
const BEAM_Y0 = 5.7, BEAM_Y1 = 7.8, BEAM_D = 1.2;   // above the gate's base level

// MPD logo for the signs; the film renderer awaits logoReady before building the gates so frames are deterministic.
const LOGO = new Image();
export const logoReady = new Promise((res) => { LOGO.onload = res; LOGO.onerror = res; });
LOGO.src = new URL('../assets/mpd-logo.png', import.meta.url).href;

// Sign artwork: white panel, MPD logo on the left, the gate name and role on the right, a green accent rule
function signTexture(title, sub) {
  const W = 2048, H = 300;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const draw = (logo) => {
    g.fillStyle = '#F8FAFC'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#00529B'; g.fillRect(0, 0, W, 10); g.fillRect(0, H - 10, W, 10);
    const lh = 220, lw = logo ? (logo.width / logo.height) * lh : 650;
    if (logo) g.drawImage(logo, 70, (H - lh) / 2, lw, lh);
    g.fillStyle = '#5DA831'; g.fillRect(70 + lw + 60, 60, 10, H - 120);
    // text right-aligned, shrunk to fit between the divider and the right edge
    const room = W - 80 - (70 + lw + 120);
    const fit = (text, weight, px) => {
      for (; px > 20; px -= 2) { g.font = `${weight} ${px}px system-ui, -apple-system, "Segoe UI", sans-serif`; if (g.measureText(text).width <= room) break; }
    };
    g.textAlign = 'right'; g.textBaseline = 'middle';
    g.fillStyle = '#00529B'; fit(title, 'bold', 132);
    g.fillText(title, W - 80, H / 2 - 22);
    g.fillStyle = '#475569'; fit(sub, '600', 46);
    g.fillText(sub, W - 84, H / 2 + 86);
    tex.needsUpdate = true;
  };
  draw(LOGO.complete && LOGO.naturalWidth ? LOGO : null);   // main.js awaits logoReady first, so frame capture never sees a logo-less sign
  if (!LOGO.complete) LOGO.addEventListener('load', () => draw(LOGO), { once: true });
  return { tex, aspect: W / H };
}

let MATS = null;
function gateMats() {
  if (MATS) return MATS;
  const mk = (p) => patchRise(makeMat(p));
  MATS = {
    stone: mk({ color: '#556070', roughness: 0.85 }),
    stoneLight: mk({ color: '#9AA3AE', roughness: 0.8 }),
    steel: mk({ color: '#1F2937', roughness: 0.45, metalness: 0.6 }),
    lamp: mk({ color: '#FFF7D6', emissive: '#FDE68A', emissiveIntensity: 1.6 }),
    green: mk({ color: '#5DA831', emissive: '#5DA831', emissiveIntensity: 0.5, roughness: 0.5 }),
    red: mk({ color: '#DC2626', roughness: 0.5 }),
    white: mk({ color: '#F8FAFC', roughness: 0.5 }),
  };
  return MATS;
}

function buildGate(root, M, B, G) {
  const K = gateMats();
  const { x: gx, z: gz, ry, open: OPEN } = G;
  const y0 = G.base ?? 0;
  // a gate standing below ground (the material exit, on the sunken yard floor) gets taller piers so its beam and sign
  // clear the boundary wall
  const lift = y0 < 0 ? -y0 + 2.8 - BEAM_Y0 : 0;
  const BY0 = BEAM_Y0 + Math.max(0, lift), BY1 = BEAM_Y1 + Math.max(0, lift);
  const c = Math.cos(ry), s = Math.sin(ry);
  const W = (lx, lz) => [gx + lx * c + lz * s, gz - lx * s + lz * c];
  const r = riseDelay(gx, gz);
  const L = (mat, lx, y, lz, w, h, d, rise = r, opts) => { const [x, z] = W(lx, lz); B.box(mat, x, y0 + y, z, w, h, d, rise, opts, ry); };

  // ---- piers: stone shafts with a light plinth band and green accent strips (logo colour), carrying the beam
  const px = OPEN / 2 + PIER / 2;
  for (const sx of [-1, 1]) {
    L(K.stoneLight, sx * px, 0.3, 0, PIER + 0.3, 0.6, PIER + 0.3);
    L(K.stone, sx * px, BY0 / 2, 0, PIER, BY0, PIER);
    for (const f of [-1, 1]) L(K.green, sx * px, 2.4, f * (PIER / 2 + 0.01), 0.12, 3.2, 0.02, r, { cast: false });
  }
  // ---- portal beam (deep blue) on the piers, light coping, lanterns at the ends, downlights over the carriageway
  const beamW = OPEN + 2 * PIER + 2.4;
  L(M.roof, 0, (BY0 + BY1) / 2, 0, beamW, BY1 - BY0, BEAM_D);
  L(K.stoneLight, 0, BY1 + 0.08, 0, beamW + 0.2, 0.16, BEAM_D + 0.2);
  for (const sx of [-1, 1]) {
    L(K.steel, sx * px, BY1 + 0.46, 0, 0.5, 0.6, 0.5);
    L(K.lamp, sx * px, BY1 + 0.46, 0, 0.36, 0.46, 0.52, r, { cast: false });
  }
  for (const lx of [-OPEN / 3, 0, OPEN / 3]) L(K.lamp, lx, BY0 - 0.03, 0, 0.6, 0.06, 0.4, r, { cast: false });

  // ---- sign panels on both faces of the beam
  const { tex, aspect } = signTexture(`UNIT 1 · GATE ${G.no}`, `${G.role} · MPD INDUSTRIES PVT LTD`);
  const signH = (BY1 - BY0) - 0.3, signW = Math.min(beamW - 0.6, signH * aspect);
  const signMat = patchRise(makeMat({ color: '#FFFFFF', map: tex, emissive: '#FFFFFF', emissiveMap: tex, emissiveIntensity: 0.35, roughness: 0.4 }));
  for (const face of [-1, 1]) {
    const m = new THREE.Mesh(withRise(new THREE.PlaneGeometry(signW, signH), r), signMat);
    const [x, z] = W(0, face * (BEAM_D / 2 + 0.02));
    m.position.set(x, y0 + (BY0 + BY1) / 2, z);
    m.rotation.y = ry + (face < 0 ? Math.PI : 0);
    root.add(m);
  }

  // ---- feature wing walls along the boundary either side, with planters inside
  if (G.wings) {
    for (const sx of [-1, 1]) {
      const x0 = OPEN / 2 + PIER, x1 = x0 + 6.0, xm = sx * (x0 + x1) / 2;
      L(K.stone, xm, 1.3, 0, x1 - x0, 2.6, 0.45);
      L(K.stoneLight, xm, 2.68, 0, x1 - x0 + 0.1, 0.16, 0.6);
      L(K.green, xm, 2.2, -0.24, x1 - x0 - 0.6, 0.08, 0.02, r, { cast: false });
      L(K.stoneLight, xm, 0.3, 1.0, x1 - x0 - 0.4, 0.6, 1.2);
      L(M.lawn, xm, 0.62, 1.0, x1 - x0 - 0.7, 0.04, 0.9, r, { cast: false });
      for (let k = 0; k < 4; k++) L(M.treeDark, sx * (x0 + 0.9 + k * 1.4), 0.85, 1.0, 0.8, 0.5, 0.7);   // clipped shrubs
    }
  }

  // ---- twin sliding gates: parked open behind the wing walls, or closed across the opening as solid sheet leaves
  // a closed gate in the sunken yard runs full height up to ground level (the yard is 5.4 m below the site)
  const GH = G.closed && y0 < 0 ? Math.min(-y0, BY0 - 0.2) : 2.4, lz = 0.55;
  for (const sx of [-1, 1]) {
    const leaf = G.closed ? OPEN / 2 : OPEN / 2 + 0.3;
    const lc = G.closed ? sx * (OPEN / 4) : sx * (OPEN / 2 + PIER + leaf / 2 + 0.2);
    L(K.steel, sx * (OPEN / 2 + PIER / 2), 0.03, lz, OPEN + 2 * PIER, 0.04, 0.12, -1, { cast: false });                     // track
    for (const y of [0.15, GH, GH * 0.55]) L(K.steel, lc, y, lz, leaf, 0.1, 0.1);
    if (G.closed) {
      L(K.stone, lc, GH / 2 + 0.05, lz, leaf - 0.05, GH - 0.1, 0.05);
      for (let k = 0; k < 5; k++) L(k % 2 ? M.yellow : K.steel, lc - leaf / 2 + (k + 0.5) * (leaf / 5), 0.5, lz - 0.04, leaf / 5, 0.3, 0.02, r, { cast: false });   // hazard band
    } else {
      for (let k = 0; k <= 12; k++) L(K.steel, lc - leaf / 2 + (k * leaf) / 12, GH / 2 + 0.05, lz, 0.05, GH - 0.1, 0.05);
    }
    L(M.roof, lc, GH * 0.78, lz - 0.06, leaf * 0.5, 0.42, 0.04, r, { cast: false });   // blue name plate
  }

  // ---- boom barrier just inside the entry gates (pedestal on the kerb, boom across the carriageway) and a stop line
  if (!G.closed) {
    const zb = 6.0, pb = OPEN / 2 - 0.6;
    L(M.yellow, pb, 0.55, zb, 0.5, 1.1, 0.5);
    L(M.carDark, pb, 1.12, zb, 0.56, 0.06, 0.56, r, { cast: false });
    const n = Math.ceil((OPEN - 1.6) / 1.1);
    for (let k = 0; k < n; k++) L(k % 2 ? K.white : K.red, pb - 0.8 - k * 1.1, 1.0, zb, 1.1, 0.1, 0.1, r, { cast: false });
    L(M.marking, 0, 0.075, zb + 0.8, OPEN - 2.4, 0.02, 0.25, -1, { cast: false });
  }
}

export function buildGates(world, M, B) {
  const root = new THREE.Group();
  world.scene.add(root);
  for (const G of GATES) buildGate(root, M, B, G);
  return { update() {} };
}
