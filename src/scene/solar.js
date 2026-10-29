// 0.70 MWp rooftop solar (assumed layout): 545 Wp mono-PERC modules (2278 × 1134 mm) flush-mounted in portrait
// on every PEB roof slope, between the polycarbonate lighting strips and clear of ridge vents and monitors,
// plus south-facing rows tilted 12° on the flat RCC roofs and the canopies. Candidate positions are generated
// for every roof, then trimmed (eave rows at the gable ends of Warehouse-1 first) to the module count that
// first reaches 700 kWp. Panels hide while their building is cut away and until the buildings have risen.
import * as THREE from 'three';
import { makeMat } from './materials.js';
import { BUILDINGS, BLENDER, BOILER, ETP } from './layout.js';

export const MODULE = { L: 2.278, W: 1.134, T: 0.04, wp: 545 };
export const TARGET_KWP = 700;
const GAP = 0.02, TILT = (12 * Math.PI) / 180, ROW_PITCH = 2.6;

function cellTexture() {
  const c = document.createElement('canvas');
  c.width = 192; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#C7D2DE'; g.fillRect(0, 0, 192, 96);                 // aluminium frame
  g.fillStyle = '#0E2748'; g.fillRect(3, 3, 186, 90);
  g.fillStyle = '#1B3D6B';
  const nx = 12, ny = 6, cw = 186 / nx, ch = 90 / ny;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) g.fillRect(3 + i * cw + 0.8, 3 + j * ch + 0.8, cw - 1.6, ch - 1.6);
  g.fillStyle = 'rgba(190,210,235,0.22)';
  for (let j = 1; j < ny; j++) g.fillRect(3, 3 + j * ch - 0.4, 186, 0.8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Portrait modules on both slopes of a PEB envelope. r0 = clear distance from the ridge line to the first row.
function slopePanels(env, { r0, skylights = [], yMargin = 0.5 }) {
  const { F, half, pitch, roofTop } = env;
  const cp = Math.cos(pitch), step = (MODULE.L + 0.03) * cp;
  const cuts = [...skylights].sort((a, b) => a - b);
  const segs = [];
  let ya = yMargin;
  for (const c of cuts) { segs.push([ya, c - 0.3]); ya = c + 0.3; }
  segs.push([ya, F.D - yMargin]);
  const out = [];
  for (const s of [-1, 1]) {
    for (let k = 0; r0 + (k + 1) * step <= half + 0.15; k++) {
      const off = r0 + (k + 0.5) * step, x = half + s * off;
      for (const [y0, y1] of segs) {
        const n = Math.floor((y1 - y0 + GAP) / (MODULE.W + GAP));
        const start = (y0 + y1) / 2 - (n * (MODULE.W + GAP) - GAP) / 2 + MODULE.W / 2;
        for (let i = 0; i < n; i++) {
          const y = start + i * (MODULE.W + GAP);
          out.push({ m: F.matrix(x, roofTop(x) + 0.12, y, [0, 0, -s * pitch]), row: k, end: Math.abs(y - F.D / 2) });
        }
      }
    }
  }
  return out;
}

// South-facing tilted rows on a flat roof (world rectangle), skipping `avoid` rectangles [x0, x1, z0, z1].
function flatPanels({ x0, x1, z0, z1, h, avoid = [], pitch = ROW_PITCH }) {
  const out = [];
  const depth = MODULE.L * Math.cos(TILT), rise = MODULE.L * Math.sin(TILT);
  const n = Math.floor((x1 - x0 + GAP) / (MODULE.W + GAP));
  const xs = (x0 + x1) / 2 - (n * (MODULE.W + GAP) - GAP) / 2 + MODULE.W / 2;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(TILT, Math.PI / 2, 0, 'XYZ'));
  for (let zs = z1 - depth; zs >= z0 - 1e-6; zs -= pitch) {             // first row on the south (+Z) edge
    const zc = zs + depth / 2;
    for (let i = 0; i < n; i++) {
      const x = xs + i * (MODULE.W + GAP);
      if (avoid.some(([a0, a1, b0, b1]) => x + MODULE.W / 2 > a0 && x - MODULE.W / 2 < a1 && zs + depth > b0 && zs < b1)) continue;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, h + 0.25 + rise / 2, zc), q, new THREE.Vector3(1, 1, 1));
      out.push({ m, leg: new THREE.Vector3(x, h + (0.25 + rise) / 2, zs + 0.05), legH: 0.25 + rise, row: 0, end: 0 });
    }
  }
  return out;
}

// roofs: [{ name, key (cut-away state that hides it), peb: { env, r0, skylights } | flat: {...}, trim }]
export function buildSolar(world, M, roofs, B) {
  const root = new THREE.Group();
  world.scene.add(root);
  const mat = makeMat({ color: '#9FB0C8', map: cellTexture(), metalness: 0.3, roughness: 0.28 });
  const legMat = makeMat({ color: '#94A3B8', metalness: 0.5, roughness: 0.4 });
  const target = Math.ceil((TARGET_KWP * 1000) / MODULE.wp);
  const sets = roofs.map((r) => ({ ...r, panels: r.peb ? slopePanels(r.peb.env, r.peb) : flatPanels(r.flat) }));
  const available = sets.reduce((a, s) => a + s.panels.length, 0);
  let excess = available - target;
  for (const s of sets.filter((r) => r.trim)) {
    if (excess <= 0) break;
    s.panels.sort((a, b) => (b.row - a.row) || (b.end - a.end));
    const cut = Math.min(excess, Math.floor(s.panels.length * 0.4));
    s.panels.splice(0, cut);
    excess -= cut;
  }
  const geo = new THREE.BoxGeometry(MODULE.L, MODULE.T, MODULE.W);
  const legGeo = new THREE.BoxGeometry(MODULE.W * 0.9, 1, 0.05);
  const groups = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (const s of sets) {
    const g = new THREE.Group();
    root.add(g);
    const im = new THREE.InstancedMesh(geo, mat, s.panels.length);
    s.panels.forEach((p, i) => im.setMatrixAt(i, p.m));
    im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
    g.add(im);
    const legs = s.panels.filter((p) => p.leg);
    if (legs.length) {
      const lm = new THREE.InstancedMesh(legGeo, legMat, legs.length);
      legs.forEach((p, i) => lm.setMatrixAt(i, m4.compose(p.leg, q, new THREE.Vector3(1, p.legH, 1))));
      lm.frustumCulled = false;
      g.add(lm);
    }
    groups.push({ g, key: s.key });
  }
  const count = sets.reduce((a, s) => a + s.panels.length, 0);
  const kwp = (count * MODULE.wp) / 1000;
  const perRoof = Object.fromEntries(sets.map((s) => [s.name, s.panels.length]));
  // string inverters + ACDB on a skid beside the electrical substation
  B.box(M.wall, 53.0, 1.3, -19.5, 2.6, 2.4, 4.6, -1);
  B.box(M.roof, 53.0, 2.6, -19.5, 3.0, 0.2, 5.0, -1);
  for (let k = 0; k < 4; k++) B.box(M.steelDark, 51.66, 1.4, -21.2 + k * 1.1, 0.06, 1.1, 0.8, -1, { cast: false });
  return {
    count, kwp, available, perRoof,
    anchors: {},
    update(t, s) {
      const show = (s.buildingsRise ?? 1) > 0.97 && (s.solarPanels ?? 1) > 0.5;
      for (const { g, key } of groups) g.visible = show && !(key && (s[key] ?? 0) > 0.02);
    },
  };
}

// Every roof on site: PEB slopes from their envelopes, flat roofs from the layout (rooftop units avoided).
export function siteRoofs(envs) {
  const roofs = [
    { name: 'Warehouse-1', key: 'wh1Cutaway', peb: { env: envs.wh1, r0: 0.45, skylights: envs.wh1.skylights }, trim: true },
    { name: 'Warehouse-2', key: 'wh2Cutaway', peb: { env: envs.wh2, r0: 0.45, skylights: envs.wh2.skylights } },
    { name: 'Plant 1', key: 'plant1Cutaway', peb: { env: envs.p1, r0: 1.55 } },
    { name: 'Plant 2', key: 'plant2Cutaway', peb: { env: envs.p2, r0: 1.55 } },
    { name: 'QA & QC terrace', key: 'qaCutaway', flat: { x0: 2.1, x1: 13.35, z0: -48.0, z1: -40.05, h: 13.8, pitch: 2.85, avoid: [[4.7, 6.1, -47.5, -46.0]] } },
    { name: 'Blender house', key: 'blenderCutaway', flat: { x0: BLENDER.x - BLENDER.w / 2 + 0.6, x1: BLENDER.x + BLENDER.w / 2 - 0.6, z0: BLENDER.z - BLENDER.d / 2 + 0.6, z1: BLENDER.z + BLENDER.d / 2 - 0.6, h: BLENDER.h + 0.4 } },
    { name: 'Boiler house', flat: { x0: BOILER.x + 1.5, x1: BOILER.x + 14.5, z0: BOILER.z - BOILER.d / 2 + 0.2, z1: BOILER.z + BOILER.d / 2, h: 11.4 } },
    { name: 'ETP', flat: { x0: ETP.x + 4.0, x1: ETP.x + 9.0, z0: ETP.z + 8.3, z1: ETP.z + 11.7, h: 3.9, pitch: 3 } },
    { name: 'PESO pump house', flat: { x0: -70.0, x1: -63.0, z0: 62.4, z1: 69.6, h: 4.8 } },
  ];
  for (const b of BUILDINGS) {
    const top = b.style === 'canopy' ? b.h + 0.2 : b.h + 0.4, inset = b.style === 'canopy' ? 0.2 : 0.45;
    const avoid = b.style === 'office' && b.w > 8 ? [[b.x - b.w / 4 - 1.3, b.x - b.w / 4 + 1.3, b.z - 1.0, b.z + 1.0], [b.x + b.w / 5 - 1.0, b.x + b.w / 5 + 1.0, b.z + b.d / 5 - 1.0, b.z + b.d / 5 + 1.0]] : [];
    roofs.push({ name: `${b.label} ${b.no}`, flat: { x0: b.x - b.w / 2 + inset, x1: b.x + b.w / 2 - inset, z0: b.z - b.d / 2 + inset, z1: b.z + b.d / 2 - inset, h: top, avoid } });
  }
  return roofs;
}
