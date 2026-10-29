// Warehouses. Warehouse-1 follows PP-A-WH-101-2525 R0 (an older issue, adopted as the basis for now):
// 30.0 × 61.35 m PEB shed (grids A–E × 01–11), eaves +10.0, masonry to +3.0, ground windows and high vents,
// turbo ventilators and 300 mm polycarbonate lighting strips per bay, four truck docks on the west wall,
// the lean-phase powder transfer room (bay 06–07), the +4.0 platform with tanks and the toilets (bay 01–02).
// Pallet storage (north, bays 07–11) as drawn — 1,464 pallets:
//   7 double-faced mobile units DFMU 1–7 (type A: 8 bays × 6 levels × 2 pallets per face, 500 kg) on floor
//   rails, and one static type-B row on the north wall (10 bays × 6 levels × 2 pallets, 1,000 kg).
// Added for fast reactor charging: a depalletiser → bag emptying → jumbo-bag (FIBC) filling cell beside a new
// east shutter; filled bags go by forklift across road R3 to Plant 1's crane hoisting bay.
// Warehouse-2 has no drawing yet: an assumed PEB shed on the site-plan footprint with 6 mobile units.
import * as THREE from 'three';
import { Batcher, makeMat } from './materials.js';
import { pebEnvelope } from './peb.js';
import { WAREHOUSE1, WAREHOUSE2 } from './layout.js';
import { forklift, fibc, pallet, truck, placeAt, tube, polyline } from './props.js';
import { riseDelay } from './site.js';
import { hash } from '../lib/util.js';

const FL = 0.2;                                  // floor slab top
const BAY = 2.8, FACE = 1.2, FLUE = 0.2;         // 2700 clear between 100 uprights; 1200 deep faces
const UNIT = 2 * FACE + FLUE, PITCH = UNIT + 0.05;
const LEVEL = 1.4, LEVELS = 6, CARRIAGE = 0.3;

function layerTexture(base, line) {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 32, 64);
  g.fillStyle = line;
  for (let k = 0; k < 5; k++) g.fillRect(0, k * 12.8, 32, 1.6);
  g.fillRect(15, 0, 2, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function rackMats() {
  return {
    upright: makeMat({ color: '#1D4ED8', roughness: 0.5, metalness: 0.3 }),
    beam: makeMat({ color: '#EA580C', roughness: 0.5, metalness: 0.3 }),
    carriage: makeMat({ color: '#334155', roughness: 0.6, metalness: 0.4 }),
    drive: makeMat({ color: '#F59E0B', roughness: 0.5 }),
    rail: makeMat({ color: '#94A3B8', roughness: 0.4, metalness: 0.6 }),
    wood: makeMat({ color: '#A57F4F', roughness: 0.9 }),
    load: makeMat({ color: '#FFFFFF', map: layerTexture('#FFFFFF', '#B8C2CC'), roughness: 0.85 }),
    kraft: makeMat({ color: '#C9A06A', map: layerTexture('#C9A06A', '#9C7748'), roughness: 0.9 }),
    fence: makeMat({ color: '#FBBF24', roughness: 0.6, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
    mesh: makeMat({ color: '#E2E8F0', roughness: 0.6, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
    floor: makeMat({ color: '#AFB8C1', roughness: 0.85 }),
  };
}

// One rack row in local warehouse coordinates. along 'x': bays run along x and the faces stack along y
// (mobile units travel along y); along 'y': swapped. faces 2 = double-faced mobile unit, 1 = static row.
function rackRow(RB, R, F, { a0, c0, bays, faces, along, mobile, kg }, slots) {
  const depth = faces === 2 ? UNIT : FACE;
  const len = bays * BAY + 0.1;
  const base = mobile ? FL + CARRIAGE : FL;
  const top = base + 7.6;
  const bx = (A0, A1, C0, C1, h0, h1, mat, opts) => (along === 'x' ? F.box(RB, mat, A0, C0, A1, C1, h0, h1, -1, opts) : F.box(RB, mat, C0, A0, C1, A1, h0, h1, -1, opts));
  if (mobile) {
    bx(a0 - 0.05, a0 + len + 0.05, c0 + 0.03, c0 + depth - 0.03, FL + 0.02, base, R.carriage);
    bx(a0 - 0.32, a0 - 0.05, c0 + 0.5, c0 + depth - 0.5, FL + 0.3, FL + 1.7, R.drive);       // drive + control panel at the aisle end
  }
  const spans = faces === 2 ? [[c0, c0 + FACE], [c0 + FACE + FLUE, c0 + depth]] : [[c0, c0 + FACE]];
  for (let i = 0; i <= bays; i++) {
    const a = a0 + i * BAY;
    for (const [f0, f1] of spans) for (const c of [f0, f1 - 0.08]) bx(a, a + 0.1, c, c + 0.08, base, top, R.upright);
  }
  for (let k = 1; k < LEVELS; k++) {
    const h = base + k * LEVEL;
    for (const [f0, f1] of spans) for (const c of [f0, f1 - 0.06]) bx(a0, a0 + len, c, c + 0.06, h - 0.13, h, R.beam, { cast: false });
  }
  for (const [f0, f1] of spans) for (const c of [f0, f1 - 0.06]) bx(a0, a0 + len, c, c + 0.06, top - 0.08, top, R.upright, { cast: false });
  for (const [f0, f1] of spans) for (let i = 0; i < bays; i++) for (const off of [0.833, 2.067]) for (let k = 0; k < LEVELS; k++) {
    const a = a0 + i * BAY + off, c = (f0 + f1) / 2;
    slots.push({ x: along === 'x' ? a : c, y: along === 'x' ? c : a, h: base + k * LEVEL, kg, along });
  }
}

// Pallets as two instanced meshes (wooden base + shrink-wrapped bag load) with ~92 % of slots filled.
function palletInstances(group, R, F, slots, seed) {
  const n = slots.length;
  const baseGeo = new THREE.BoxGeometry(1.0, 0.14, 1.2), loadGeo = new THREE.BoxGeometry(0.98, 0.95, 1.16);
  const bases = new THREE.InstancedMesh(baseGeo, R.wood, n), loads = new THREE.InstancedMesh(loadGeo, R.load, n);
  const cols = ['#F8FAFC', '#F1F5F9', '#E2E8F0', '#F1F5F9', '#D9B884', '#CFA972', '#B9CDE6', '#EFE3C2', '#CBD5E1'].map((c) => new THREE.Color(c));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Vector3(0, 0, 0);
  const qAlong = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  slots.forEach((s, i) => {
    const filled = hash(i * 1.37 + seed) < 0.92;
    q.copy(F.qy);
    if (s.along === 'y') q.multiply(qAlong);
    m4.compose(F.world(s.x, s.h + 0.07, s.y), q, filled ? one : zero);
    bases.setMatrixAt(i, m4);
    m4.compose(F.world(s.x, s.h + 0.14 + 0.475, s.y), q, filled ? one : zero);
    loads.setMatrixAt(i, m4);
    loads.setColorAt(i, cols[Math.floor(hash(i * 7.31 + seed * 3) * cols.length)]);
  });
  for (const im of [bases, loads]) { im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; group.add(im); }
}

// ---------------------------------------------------------------------------- Warehouse-1
const WH1_FRAMES = [0, 5, 11.45, 17.9, 24.35, 30.35, 37.35, 43.35, 49.35, 55.35, 61.35];
const WH1_DOCKS = [14.7, 27.35, 40.35, 52.35];
const RS_EAST = { y0: 19.2, y1: 22.8 };

function buildWH1(root, M, R, OB) {
  const mid = WH1_FRAMES.slice(1).map((y, i) => (y + WH1_FRAMES[i]) / 2);
  const env = pebEnvelope(root, M, WAREHOUSE1, {
    eave: 10, ridge: 11.5, baseH: 3.0, windowRows: [[1.2, 2.4]], ventRows: [[7.8, 8.6]], gableRows: [[7.8, 8.6, 'louver']],
    roofColor: '#64748B', roofRib: '#4B5B70', stripe: '#00A3E0', frameLines: WH1_FRAMES, skylights: mid, turbo: mid,
    docks: WH1_DOCKS.map((y) => ({ side: 'W', y, depth: 3.8 })),
    shutters: [{ side: 'E', ...RS_EAST, h: 4.0 }], endDoors: false,
  });
  const F = env.F, W = F.W, D = F.D;
  const inner = new THREE.Group();
  root.add(inner);
  const IB = new Batcher();
  const box = (mat, x0, y0, x1, y1, h0, h1, opts) => F.box(IB, mat, x0, y0, x1, y1, h0, h1, -1, opts);
  const at = (x, h, y, ry = 0) => F.matrix(x, h, y, [0, ry, 0]);
  box(R.floor, 0, 0, W, D, 0, FL, { cast: false });

  // ---- pallet storage (bays 07–11): DFMU 1–4, moving aisle, DFMU 5–7, static type-B row on the north wall
  const slots = [];
  const xr0 = 6.8;
  let y = 38.2;
  const units = [];
  for (let k = 0; k < 7; k++) { if (k === 4) y += 3.0; units.push(y); y += PITCH; }
  for (const c0 of units) rackRow(IB, R, F, { a0: xr0, c0, bays: 8, faces: 2, along: 'x', mobile: true, kg: 500 }, slots);
  rackRow(IB, R, F, { a0: 1.4, c0: 59.85, bays: 10, faces: 1, along: 'x', mobile: false, kg: 1000 }, slots);
  for (let i = 0; i <= 8; i++) box(R.rail, xr0 + i * BAY + 0.015, 37.9, xr0 + i * BAY + 0.085, 59.75, FL, FL + 0.025, { cast: false });
  palletInstances(inner, R, F, slots, 1);
  // reach of the moving aisle: forklift putting a pallet away, floor-staged pallets in the dock aisle
  forklift(IB, M, at(17.0, FL, 50.3), -1, 0.3);
  pallet(IB, M.wood, at(18.65, FL + 0.25, 50.3));
  box(R.load, 18.16, 49.72, 19.14, 50.88, FL + 0.4, FL + 1.35);
  for (const [px, py] of [[2.2, 43.2], [2.2, 44.6], [3.6, 43.2], [3.6, 44.6], [2.2, 33.0], [3.6, 33.0]]) {
    pallet(IB, M.wood, at(px, FL, py));
    box(hash(px * py) > 0.5 ? R.load : R.kraft, px - 0.49, py - 0.58, px + 0.49, py + 0.58, FL + 0.15, FL + 1.1);
  }
  for (const y0 of [37.6, 60.6 - 0.9]) box(M.yellow, 6.4, y0, 29.4, y0 + 0.1, FL, FL + 0.01, { cast: false });

  // ---- lean-phase powder transfer room (18.0 × 6.265, bay 06–07): blower, bag dump station, conveying line
  const partition = (x0, y0, x1, y1) => {
    box(R.mesh, x0, y0, x1, y1, FL, FL + 3.0, { cast: false });
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 3));
    for (let k = 0; k <= n; k++) {
      const px = x0 + (x1 - x0) * k / n, py = y0 + (y1 - y0) * k / n;
      box(M.steelDark, px - 0.05, py - 0.05, px + 0.05, py + 0.05, FL, FL + 3.0);
    }
    box(M.steelDark, Math.min(x0, x1) - 0.03, Math.min(y0, y1) - 0.03, Math.max(x0, x1) + 0.03, Math.max(y0, y1) + 0.03, FL + 2.95, FL + 3.05, { cast: false });
  };
  partition(15.2, 30.35, 29.6, 30.35 + 0.05);
  partition(11.77, 30.35, 11.77 + 0.05, 36.6);
  partition(11.77, 36.6, 29.6, 36.6 + 0.05);
  box(M.bagBlue, 12.5, 32.9, 14.0, 34.1, FL + 0.2, FL + 1.3);                               // roots blower + acoustic hood
  box(M.carDark, 12.3, 32.7, 14.2, 34.3, FL, FL + 0.2);
  for (const sy of [32.95, 34.05]) F.mesh(IB, new THREE.CylinderGeometry(0.2, 0.2, 1.6, 12), M.steel, 12.6, FL + 2.1, sy);
  for (const bx0 of [15.4, 19.6]) {
    for (const [lx, ly] of [[0, 0], [1.2, 0], [0, 1.2], [1.2, 1.2]]) box(M.steelDark, bx0 + lx - 0.04, 32.9 + ly - 0.04, bx0 + lx + 0.04, 32.9 + ly + 0.04, FL, FL + 1.0);
    box(M.steel, bx0, 32.9, bx0 + 1.2, 34.1, FL + 1.0, FL + 1.45);                          // bag dump hopper with grid
    F.mesh(IB, new THREE.ConeGeometry(0.82, 0.5, 4, 1, true), M.steel, bx0 + 0.6, FL + 0.85, 33.5, [Math.PI, Math.PI / 4, 0]);
    box(M.steel, bx0, 34.1, bx0 + 1.2, 34.5, FL + 1.45, FL + 2.5);                          // dust hood
    F.mesh(IB, new THREE.CylinderGeometry(0.38, 0.38, 1.4, 14), M.steel, bx0 + 0.6, FL + 3.2, 34.3);   // reverse-jet filter
    box(M.yellow, bx0 + 0.4, 33.3, bx0 + 0.8, 33.7, FL + 0.33, FL + 0.6);                   // rotary airlock
  }
  box(M.wall, 25.5, 35.9, 27.3, 36.5, FL, FL + 2.0);                                         // MCC / control panel
  // conveying line: blower → under both airlocks → up the east wall → across road R3 at +7.0 into Plant 1
  const line = [[14.0, FL + 0.2, 33.5], [28.9, FL + 0.2, 33.5], [28.9, 7.0, 33.5], [W + 0.4, 7.0, 33.5]].map(([x, h, yy]) => F.world(x, h, yy));
  polyline(IB, M.pipe, line, 0.09);
  const zLine = F.world(0, 0, 33.5).z;
  const p1West = -1.63;
  const rr = riseDelay(-6.5, zLine);
  tube(OB, M.pipe, F.world(W + 0.4, 7.0, 33.5), new THREE.Vector3(p1West, 7.0, zLine), 0.09, rr);
  for (const px of [-9.9, -3.1]) {
    OB.box(M.steelDark, px, 3.6, zLine, 0.25, 7.2, 0.25, rr);
    OB.box(M.steelDark, px, 6.8, zLine, 0.25, 0.2, 1.2, rr);
  }

  // ---- depalletiser → bag emptying → jumbo-bag filling cell (bay 05–06, east)
  const conveyor = (x0, x1, yc, w, top) => {
    for (const s of [-1, 1]) box(M.steelDark, x0, yc + s * w / 2 - 0.05, x1, yc + s * w / 2 + 0.05, top - 0.12, top);
    for (let x = x0 + 0.1; x < x1; x += 0.25) F.mesh(IB, new THREE.CylinderGeometry(0.04, 0.04, w, 6), M.pipe, x, top - 0.06, yc, [Math.PI / 2, 0, 0]);
    for (let x = x0 + 0.2; x < x1; x += 1.6) for (const s of [-1, 1]) box(M.steelDark, x, yc + s * (w / 2 - 0.05) - 0.04, x + 0.08, yc + s * (w / 2 - 0.05) + 0.04, FL, top - 0.12);
  };
  const bagStack = (x, yc, h0, layers) => {
    pallet(IB, M.wood, at(x, h0, yc));
    box(R.kraft, x - 0.5, yc - 0.6, x + 0.5, yc + 0.6, h0 + 0.15, h0 + 0.15 + layers * 0.19);
  };
  const IN_TOP = FL + 0.55, PICK_X = 21.3, CELL_Y = 27.0;
  conveyor(12.6, 22.4, CELL_Y, 1.4, IN_TOP);                                                  // pallet infeed roller conveyor
  bagStack(13.6, CELL_Y, IN_TOP, 5);
  bagStack(16.1, CELL_Y, IN_TOP, 5);
  bagStack(PICK_X, CELL_Y, IN_TOP, 3);                                                      // pallet being depalletised
  // gantry depalletiser with vacuum layer gripper
  const G = { x0: 19.0, x1: 26.4, y0: 25.0, y1: 29.0, h: FL + 4.3 };
  for (const gx of [G.x0, G.x1]) for (const gy of [G.y0, G.y1]) box(M.yellow, gx - 0.11, gy - 0.11, gx + 0.11, gy + 0.11, FL, G.h);
  for (const gy of [G.y0, G.y1]) box(M.yellow, G.x0 - 0.11, gy - 0.13, G.x1 + 0.11, gy + 0.13, G.h - 0.3, G.h);
  box(M.steelDark, PICK_X - 0.15, G.y0, PICK_X + 0.15, G.y1, G.h - 0.5, G.h - 0.3);       // travelling bridge
  box(M.steelDark, PICK_X - 0.3, CELL_Y - 0.3, PICK_X + 0.3, CELL_Y + 0.3, G.h - 0.85, G.h - 0.5);
  const layerTop = IN_TOP + 0.15 + 3 * 0.19, gripLayer = layerTop + 0.35;
  box(M.steel, PICK_X - 0.08, CELL_Y - 0.08, PICK_X + 0.08, CELL_Y + 0.08, gripLayer + 0.4, G.h - 0.85);   // vertical mast
  box(M.yellow, PICK_X - 0.55, CELL_Y - 0.65, PICK_X + 0.55, CELL_Y + 0.65, gripLayer + 0.2, gripLayer + 0.4);
  box(R.kraft, PICK_X - 0.5, CELL_Y - 0.6, PICK_X + 0.5, CELL_Y + 0.6, gripLayer, gripLayer + 0.19);      // lifted bag layer
  // safety fence (open on the infeed side)
  for (const [x0, y0, x1, y1] of [[18.7, 24.7, 26.7, 24.75], [18.7, 29.25, 26.7, 29.3], [26.65, 24.7, 26.7, 29.3], [18.7, 24.7, 18.75, 26.2], [18.7, 27.8, 18.75, 29.3]]) {
    box(R.fence, x0, y0, x1, y1, FL, FL + 2.2, { cast: false });
    box(M.yellow, x0 - 0.02, y0 - 0.02, x1 + 0.02, y1 + 0.02, FL + 2.15, FL + 2.22, { cast: false });
  }
  // empty pallet magazine
  for (let k = 0; k < 7; k++) pallet(IB, M.wood, at(19.9, FL + k * 0.15, 23.4));
  // bag emptying station: slitting table over a hopper, dust hood, empty-bag compactor, dust collector
  const EX = 25.0;
  box(M.steel, EX - 0.75, CELL_Y - 0.75, EX + 0.75, CELL_Y + 0.75, FL + 1.55, FL + 1.75);
  F.mesh(IB, new THREE.ConeGeometry(1.0, 0.9, 4, 1, true), M.steel, EX, FL + 1.1, CELL_Y, [Math.PI, Math.PI / 4, 0]);
  for (const [lx, ly] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) box(M.steelDark, EX + lx - 0.04, CELL_Y + ly - 0.04, EX + lx + 0.04, CELL_Y + ly + 0.04, FL, FL + 1.55);
  box(M.steel, EX - 0.75, CELL_Y + 0.75, EX + 0.75, CELL_Y + 1.1, FL + 1.75, FL + 3.0);
  box(M.steelDark, 23.6, 28.15, 24.4, 28.95, FL, FL + 1.6);                                   // empty-bag compactor
  F.mesh(IB, new THREE.CylinderGeometry(0.45, 0.45, 2.4, 16), M.steel, 27.8, FL + 2.4, 28.4);
  F.mesh(IB, new THREE.ConeGeometry(0.45, 0.6, 16), M.steel, 27.8, FL + 0.9, 28.4, [Math.PI, 0, 0]);
  for (const [lx, ly] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) box(M.steelDark, 27.8 + lx - 0.04, 28.4 + ly - 0.04, 27.8 + lx + 0.04, 28.4 + ly + 0.04, FL, FL + 1.3);
  polyline(IB, M.pipe, [[EX, FL + 3.0, CELL_Y + 0.95], [EX, FL + 3.8, CELL_Y + 0.95], [27.8, FL + 3.8, 28.4], [27.8, FL + 3.6, 28.4]].map(([x, h, yy]) => F.world(x, h, yy)), 0.1);
  // inclined screw conveyor from the hopper up to the FIBC filling head
  const FX = 27.5, FY = 23.75, HEAD = FL + 4.0;
  const s0 = F.world(EX, FL + 0.5, CELL_Y), s1 = F.world(FX, HEAD + 0.5, FY);
  tube(IB, M.steel, s0, s1, 0.15);
  IB.box(M.bagBlue, s1.x, s1.y + 0.1, s1.z, 0.45, 0.45, 0.45);
  // jumbo-bag filling station: frame, filling head with inflatable spout, loop hooks, load-cell platform
  for (const gx of [26.6, 28.4]) for (const gy of [22.9, 24.6]) box(M.yellow, gx - 0.07, gy - 0.07, gx + 0.07, gy + 0.07, FL, FL + 4.4);
  for (const gy of [22.9, 24.6]) box(M.yellow, 26.53, gy - 0.07, 28.47, gy + 0.07, FL + 4.25, FL + 4.4);
  box(M.yellow, FX - 0.07, 22.83, FX + 0.07, 24.67, FL + 4.25, FL + 4.4);
  F.mesh(IB, new THREE.CylinderGeometry(0.17, 0.17, HEAD - (FL + 1.75), 12), M.steel, FX, (HEAD + FL + 1.75) / 2, FY);
  box(M.steelDark, FX - 0.55, FY - 0.55, FX + 0.55, FY + 0.55, FL + 1.95, FL + 2.05);
  box(M.carDark, FX - 0.7, FY - 0.7, FX + 0.7, FY + 0.7, FL, FL + 0.12);                      // load cells
  pallet(IB, M.wood, at(FX, FL + 0.12, FY));
  fibc(IB, M, at(FX, FL + 0.27, FY));
  // out-feed: filled bags staged by the east shutter, forklift taking one out
  for (const [px, py] of [[23.0, 20.3], [24.3, 20.3], [23.0, 21.7], [24.3, 21.7]]) {
    pallet(IB, M.wood, at(px, FL, py));
    fibc(IB, M, at(px, FL + 0.15, py));
  }
  forklift(IB, M, at(27.2, FL, 21.0), -1, 0.3);
  pallet(IB, M.wood, at(28.75, FL + 0.25, 21.0));
  fibc(IB, M, at(28.75, FL + 0.4, 21.0));
  for (const [x0, y0, x1, y1] of [[12.3, 18.8, 29.4, 18.9], [12.3, 29.7, 29.4, 29.8], [12.3, 18.8, 12.4, 29.8]]) box(M.yellow, x0, y0, x1, y1, FL, FL + 0.01, { cast: false });

  // ---- +4.0 platform with tanks, MS stair, toilets (bay 01–02)
  box(M.concreteLight, 0.15, 0.15, 21.9, 4.77, 3.75, 4.0);
  for (const x of [7.5, 15.0, 21.75]) box(M.steelDark, x - 0.15, 4.5, x + 0.15, 4.8, FL, 3.75);
  for (const [x0, x1] of [[0.2, 15.6], [17.2, 21.9]]) {
    box(M.yellow, x0, 4.7, x1, 4.77, 5.0, 5.06, { cast: false });
    for (let x = x0; x <= x1; x += 1.5) box(M.yellow, x, 4.7, x + 0.05, 4.77, 4.0, 5.06, { cast: false });
  }
  for (const tx of [3.7, 11.0]) {
    F.mesh(IB, new THREE.CylinderGeometry(1.2, 1.2, 2.6, 22), M.steel, tx, 4.0 + 0.2 + 1.3, 2.5);
    F.mesh(IB, new THREE.SphereGeometry(1.2, 22, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.steel, tx, 6.8, 2.5, [0, 0, 0], -1);
    box(M.steelDark, tx - 1.0, 1.5, tx + 1.0, 3.5, 4.0, 4.2);
  }
  const run = 4.4, n = 16, sx0 = 15.75, sx1 = 17.05;
  const ang = Math.atan2(4.0 - FL, run);
  F.mesh(IB, new THREE.BoxGeometry(sx1 - sx0, 0.12, Math.hypot(run, 4.0 - FL)), M.steelDark, (sx0 + sx1) / 2, (4.0 + FL) / 2 - 0.1, 4.77 + run / 2, [-ang, 0, 0]);
  for (let i = 0; i < n; i++) {
    const yy = 4.77 + run - (i + 0.5) * run / n, hh = FL + (i + 1) * (4.0 - FL) / n;
    box(M.steel, sx0, yy - run / n / 2, sx1, yy + run / n / 2, hh - 0.04, hh);
  }
  box(M.wall, 22.1, 0.15, 29.8, 0.3, FL, 3.0);
  box(M.wall, 22.1, 4.62, 29.8, 4.77, FL, 3.0);
  box(M.wall, 22.1, 0.15, 22.25, 4.77, FL, 3.0);
  box(M.wall, 24.15, 0.15, 24.3, 4.77, FL, 3.0);
  box(M.concreteLight, 22.05, 0.15, 29.85, 4.82, 3.0, 3.2);
  for (const dx of [23.2, 26.8]) box(M.steelDark, dx - 0.45, 4.77, dx + 0.45, 4.82, FL, 2.3, { cast: false });

  IB.build(inner);

  // ---- outside: trucks reversed onto docks 3 and 4, angled as drawn
  for (const dy of [WH1_DOCKS[0], WH1_DOCKS[1]]) {
    const rear = F.world(-0.115 - 3.8 - 0.75, 0, dy);
    truck(OB, M, placeAt(rear.x, 0, rear.z, Math.PI - 0.52), riseDelay(rear.x, rear.z) + 0.05, dy === WH1_DOCKS[0] ? M.bagBlue : M.wallDark);
  }
  return {
    env, inner, slots, F,
    anchors: {
      wh1: F.world(W / 2, 12.5, D / 2),
      wh1Racks: F.world(W / 2 + 3, 9.2, 49.5),
      depalletiser: F.world(23.0, FL + 4.6, CELL_Y),
      fibcFilling: F.world(FX, FL + 4.6, FY),
    },
  };
}

// ---------------------------------------------------------------------------- Warehouse-2 (assumed)
function buildWH2(root, M, R) {
  const D0 = WAREHOUSE2.d - 0.23;
  const frames = Array.from({ length: 7 }, (_, i) => (i * D0) / 6);
  const mid = frames.slice(1).map((y, i) => (y + frames[i]) / 2);
  const env = pebEnvelope(root, M, WAREHOUSE2, {
    rotY: Math.PI / 2, eave: 10, ridge: 11.2, baseH: 3.0, windowRows: [[1.2, 2.4]], ventRows: [[7.8, 8.6]], gableRows: [[7.8, 8.6, 'louver']],
    roofColor: '#64748B', roofRib: '#4B5B70', stripe: '#00A3E0', frameLines: frames, skylights: mid, turbo: mid,
    shutters: [{ side: 'E', y0: 2.4, y1: 6.0, h: 4.5 }, { side: 'W', y0: 2.4, y1: 6.0, h: 4.5 }],
  });
  const F = env.F, W = F.W, D = F.D;
  const inner = new THREE.Group();
  root.add(inner);
  const IB = new Batcher();
  F.box(IB, R.floor, 0, 0, W, D, 0, FL, -1, { cast: false });
  const slots = [];
  const a0 = 9.2;
  let x = 2.4;
  const units = [];
  for (let k = 0; k < 6; k++) { if (k === 3) x += 3.0; units.push(x); x += PITCH; }
  for (const c0 of units) rackRow(IB, R, F, { a0, c0, bays: 10, faces: 2, along: 'y', mobile: true, kg: 500 }, slots);
  for (let i = 0; i <= 10; i++) F.box(IB, R.rail, 2.2, a0 + i * BAY + 0.015, units[5] + UNIT + 0.2, a0 + i * BAY + 0.085, FL, FL + 0.025, -1, { cast: false });
  palletInstances(inner, R, F, slots, 2);
  // receiving / dispatch bay at the east end
  for (let k = 0; k < 8; k++) {
    const px = 4.0 + (k % 4) * 1.4, py = 3.0 + Math.floor(k / 4) * 1.6;
    pallet(IB, M.wood, F.matrix(px, FL, py, [0, Math.PI / 2, 0]));
    F.box(IB, k % 3 ? R.load : R.kraft, px - 0.58, py - 0.49, px + 0.58, py + 0.49, FL + 0.15, FL + 1.1, -1);
  }
  forklift(IB, M, F.matrix(12.0, FL, 4.6, [0, Math.PI, 0]), -1, 0.15);
  F.box(IB, M.yellow, 0.8, 8.4, W - 0.8, 8.5, FL, FL + 0.01, -1, { cast: false });
  IB.build(inner);
  return { env, inner, slots, F, anchors: { wh2: F.world(W / 2, 12.2, D / 2), wh2Racks: F.world(W / 2, 9.2, 23.0) } };
}

export function buildWarehouses(world, M) {
  const root = new THREE.Group();
  world.scene.add(root);
  const R = rackMats();
  const OB = new Batcher();
  const wh1 = buildWH1(root, M, R, OB);
  const wh2 = buildWH2(root, M, R);
  OB.build(root);
  const tally = (slots) => {
    const by = {};
    for (const s of slots) by[s.kg] = (by[s.kg] || 0) + 1;
    return { pallets: slots.length, byKg: by, tonnes: slots.reduce((a, s) => a + s.kg, 0) / 1000 };
  };
  const storage = { wh1: tally(wh1.slots), wh2: tally(wh2.slots) };
  return {
    storage,
    envs: { wh1: wh1.env, wh2: wh2.env },
    anchors: { ...wh1.anchors, ...wh2.anchors },
    update(t, s) {
      const c1 = s.wh1Cutaway ?? 0, c2 = s.wh2Cutaway ?? 0;
      wh1.inner.visible = c1 > 0.01;
      wh2.inner.visible = c2 > 0.01;
      const a = wh1.env.setCutaway(c1);
      const b = wh2.env.setCutaway(c2);
      return a || b;
    },
  };
}
