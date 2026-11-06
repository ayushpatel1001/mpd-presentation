// Boiler house (15) and fuel storage area (23) from PP-A-DR-UT-101 (basement), 102 (ground floor) and 301 (sections),
// R2 22.10.2026. One building on grids 01→12 × A→F:
//   fuel store 01→04 × A→F: agro-waste bunker, masonry to +3.50, sheeted to the +7.00 truss bottom, asymmetric gable
//     roof with its ridge on row C (+9.25), 4500 × 5000 rolling shutter + canopy on the north wall.
//   boiler area 04→12 × A→E: PEB shed, truss bottom +19.25, ridge on row C with a louvred monitor, polycarbonate
//     lighting strips, brick dado to +2.50 with 1500 × 1500 windows, a 2 m canopy at +5.0 and full-length louvres
//     above it on both long walls. The floor is a pit at LVL -2.70 (RL 96.40) with +300 heater platforms north and
//     south of an open centre bay; the west 12.6 m (04 → 06) is at ±0 with the heater MCC / control room, the T.F.
//     storage + expansion tank tower and the two fuel-feed pits (LVL -1.945). The north wall is open between 05 and
//     07 for the thermic-fluid circulation pumps.
//   two agro-waste fired thermic fluid heaters (Thermax, drg PZ LU40 DB01-1-ALT.2) on lines 12.2 m apart: fuel pit +
//     screw → bucket elevator → day hopper → screw → ram feeder → furnace → heater coil → convective pass → air
//     preheater → multicyclone (E9) → bag filter (E3) → fans (E4) → common flue to a chimney east of grid 12.
//   ash handling (Decon, drg 061B.2K26-R4): drag-chain conveyors on the pit floor → bucket elevator at grid 12 → ash
//     silo on a steel frame in the sunken yard (LVL -5.40, RL 93.70) with a truck bay to the material exit gate.
// Equipment outlines follow the plans and sections; supplier internals (and the chimney height) are assumed.
import * as THREE from 'three';
import { Batcher, makeMat, patchRise } from './materials.js';
import { ribTexture, ribbedBox } from './peb.js';
import { riseDelay } from './site.js';
import { plume } from './utilities.js';
import { BH, FUEL, BOILER, ASH_YARD, GATES } from './layout.js';
import { polyline, tube } from './props.js';
import { MODULE } from './solar.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const { gx, gz, lv } = BH;
const X01 = gx(1), X04 = gx(4), X12 = gx(12);
const ZA = gz('A'), ZC = gz('C'), ZE = gz('E'), ZF = gz('F');
const X = (o) => X04 + o;                     // boiler-area chainage east of grid 04
const T = 0.23, OUT = 0.17, IN = T - OUT;     // wall thickness; outer face 0.17 outside the grid line
const DECK_X = 12.6;                          // ±0 floor (04 → 06) | pit with +300 platforms (06 → 12)
const LINES = [gz('A', 6.6), gz('A', 18.8)];  // heater line centres (north, south)
const VOID = [gz('A', 9.3), gz('A', 14.6)];   // open centre bay between the +300 platforms
const DECK_END = 28.5;                        // east end of the +300 platforms

// ---- small geometry helpers (world coordinates)
function boxR(B, mat, x0, x1, y0, y1, z0, z1, rise = -1, opts) {
  B.box(mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), rise, opts);
}
// box from a to b (centre line) with cross-section w (horizontal) × h
function beam(B, mat, a, b, w, h, rise = -1, opts) {
  const dir = b.clone().sub(a), len = dir.length();
  dir.normalize();
  let side = new THREE.Vector3().crossVectors(dir, V(0, 1, 0));
  if (side.lengthSq() < 1e-6) side = V(0, 0, 1);
  side.normalize();
  const up = new THREE.Vector3().crossVectors(side, dir);
  const m = new THREE.Matrix4().makeBasis(dir, up, side).setPosition(a.clone().add(b).multiplyScalar(0.5));
  B.add(new THREE.BoxGeometry(len, h, w), mat, m, rise, opts);
}
function cyl(B, mat, x, y, z, r, h, axis = 'y', rise = -1, rTop = r, seg = 20, opts) {
  const rot = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  B.mesh(new THREE.CylinderGeometry(rTop, r, h, seg), mat, [x, y, z], rot, [1, 1, 1], rise, opts);
}
// square-bottomed hopper (inverted pyramid) of plan size w × d, from yBot to yTop
function hopper(B, mat, x, z, w, d, yBot, yTop, rise) {
  B.mesh(new THREE.CylinderGeometry(Math.SQRT1_2, 0.12, 1, 4, 1).rotateY(Math.PI / 4), mat, [x, (yBot + yTop) / 2, z], [0, 0, 0], [w, yTop - yBot, d], rise);
}
function legs(B, mat, x0, x1, z0, z1, y0, y1, rise, s = 0.22) {
  for (const x of [x0, x1]) for (const z of [z0, z1]) boxR(B, mat, x - s / 2, x + s / 2, y0, y1, z - s / 2, z + s / 2, rise);
}
// handrail (top + mid rail, posts) along a straight line at deck level y
function rail(B, mat, x0, z0, x1, z1, y, rise) {
  const a = V(x0, 0, z0), b = V(x1, 0, z1), len = a.distanceTo(b);
  for (const h of [1.05, 0.55]) beam(B, mat, V(x0, y + h, z0), V(x1, y + h, z1), 0.05, 0.05, rise, { cast: false });
  const n = Math.max(1, Math.round(len / 1.6));
  for (let k = 0; k <= n; k++) {
    const p = a.clone().lerp(b, k / n);
    boxR(B, mat, p.x - 0.03, p.x + 0.03, y, y + 1.08, p.z - 0.03, p.z + 0.03, rise, { cast: false });
  }
}
// straight stair flight from a (bottom) to b (top), width w, with treads and handrails
function stair(B, M, a, b, w, rise) {
  beam(B, M.steelDark, a, b, w, 0.12, rise);
  const n = Math.max(2, Math.round((b.y - a.y) / 0.19));
  const run = b.clone().sub(a);
  const flat = V(run.x, 0, run.z).normalize();
  const side = V(-flat.z, 0, flat.x);
  for (let k = 1; k < n; k++) {
    const p = a.clone().lerp(b, k / n);
    const tread = p.clone().add(V(0, 0.08, 0));
    beam(B, M.grating, tread.clone().addScaledVector(side, -w / 2), tread.clone().addScaledVector(side, w / 2), 0.26, 0.04, rise, { cast: false });
  }
  for (const s of [-1, 1]) beam(B, M.yellow, a.clone().addScaledVector(side, s * w / 2).add(V(0, 0.95, 0)), b.clone().addScaledVector(side, s * w / 2).add(V(0, 0.95, 0)), 0.05, 0.05, rise, { cast: false });
}
// grating deck with toe edge
function deck(B, M, x0, x1, z0, z1, y, rise) {
  boxR(B, M.grating, x0, x1, y - 0.05, y, z0, z1, rise, { cast: false });
  for (const [a0, a1, b0, b1] of [[x0, x1, z0, z0 + 0.08], [x0, x1, z1 - 0.08, z1], [x0, x0 + 0.08, z0, z1], [x1 - 0.08, x1, z0, z1]]) boxR(B, M.steelDark, a0, a1, y - 0.18, y, b0, b1, rise);
}
// polygon wall in the z/y plane (gables): pts [[z, y], ...], centred on plane x, thickness t
function polyWall(B, mat, x, pts, t, rise, holes = []) {
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([z, y]) => new THREE.Vector2(z, y))));
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
  g.translate(0, 0, -t / 2);
  B.add(g, mat, new THREE.Matrix4().makeRotationY(-Math.PI / 2).setPosition(x, 0, 0), rise);
}

// Straight wall with horizontal material bands and rectangular openings.
// axis 'x': runs along X at outer face `face` (inside towards `inward` = ±1 in Z); axis 'z': runs along Z.
// bands: [[y0, y1, mat]]; openings: [[s0, s1, y0, y1]] (s = position along the wall)
function wall(B, axis, face, inward, s0, s1, bands, openings, rise) {
  const ys = new Set();
  for (const [a, b] of bands) { ys.add(a); ys.add(b); }
  for (const [, , a, b] of openings) { ys.add(a); ys.add(b); }
  const yl = [...ys].sort((a, b) => a - b);
  const c = face + inward * T / 2;
  for (let i = 0; i < yl.length - 1; i++) {
    const ya = yl[i], yb = yl[i + 1], ym = (ya + yb) / 2;
    const band = bands.find(([a, b]) => ym > a && ym < b);
    if (!band) continue;
    const cuts = openings.filter(([, , a, b]) => a < yb - 1e-6 && b > ya + 1e-6).map(([a, b]) => [Math.min(a, b), Math.max(a, b)]).sort((p, q) => p[0] - q[0]);
    let s = s0;
    const segs = [];
    for (const [a, b] of cuts) { if (a > s) segs.push([s, Math.min(a, s1)]); s = Math.max(s, b); }
    if (s < s1) segs.push([s, s1]);
    for (const [a, b] of segs) {
      if (b - a < 0.01) continue;
      const len = b - a, h = yb - ya, mid = (a + b) / 2;
      const ribbed = band[3];
      const geo = ribbed ? (axis === 'x' ? ribbedBox(len, h, T) : ribbedBox(T, h, len)) : (axis === 'x' ? new THREE.BoxGeometry(len, h, T) : new THREE.BoxGeometry(T, h, len));
      B.mesh(geo, band[2], axis === 'x' ? [mid, ym, c] : [c, ym, mid], [0, 0, 0], [1, 1, 1], rise);
    }
  }
}

// Louvre band on a wall face: dark backing plus inclined blades and mullions, projecting outward.
function louvres(B, mats, axis, face, inward, s0, s1, y0, y1, rise, mullions = []) {
  const out = -inward, c = face + inward * 0.06;
  const len = s1 - s0, mid = (s0 + s1) / 2;
  if (axis === 'x') boxR(B, mats.louverBack, s0, s1, y0, y1, c - 0.03, c + 0.03, rise);
  else boxR(B, mats.louverBack, c - 0.03, c + 0.03, y0, y1, s0, s1, rise);
  const pc = face + out * 0.2;
  for (let y = y0 + 0.28; y < y1 - 0.1; y += 0.5) {
    if (axis === 'x') B.mesh(new THREE.BoxGeometry(len, 0.035, 0.44), mats.blade, [mid, y, pc], [out * 0.62, 0, 0], [1, 1, 1], rise, { cast: false });
    else B.mesh(new THREE.BoxGeometry(0.44, 0.035, len), mats.blade, [pc, y, mid], [0, 0, -out * 0.62], [1, 1, 1], rise, { cast: false });
  }
  const frame = (sa, sb, ya, yb) => (axis === 'x' ? boxR(B, mats.trim, sa, sb, ya, yb, face + out * 0.42, face, rise, { cast: false }) : boxR(B, mats.trim, face + out * 0.42, face, ya, yb, sa, sb, rise, { cast: false }));
  frame(s0, s1, y0 - 0.12, y0);
  frame(s0, s1, y1, y1 + 0.12);
  for (const s of [s0, s1, ...mullions]) frame(s - 0.06, s + 0.06, y0, y1);
}

// glazed window / door / rolling shutter in an opening on a wall face
function windowAt(B, mats, axis, face, inward, s, y0, y1, w, rise) {
  const out = -inward;
  const box = (sa, sb, ya, yb, d0, d1, mat) => (axis === 'x' ? boxR(B, mat, sa, sb, ya, yb, face + out * d0, face + out * d1, rise, { cast: false }) : boxR(B, mat, face + out * d0, face + out * d1, ya, yb, sa, sb, rise, { cast: false }));
  box(s - w / 2, s + w / 2, y0, y1, -0.08, 0.0, mats.glass);
  box(s - w / 2 - 0.06, s + w / 2 + 0.06, y0 - 0.06, y0, 0, 0.12, mats.trim);
  box(s - w / 2 - 0.06, s + w / 2 + 0.06, y1, y1 + 0.06, 0, 0.06, mats.trim);
  box(s - 0.025, s + 0.025, y0, y1, 0, 0.04, mats.trim);
}
function shutterAt(B, mats, axis, face, inward, s0, s1, y0, y1, rise) {
  const out = -inward;
  const box = (sa, sb, ya, yb, d0, d1, mat) => (axis === 'x' ? boxR(B, mat, sa, sb, ya, yb, face + out * d0, face + out * d1, rise, { cast: false }) : boxR(B, mat, face + out * d0, face + out * d1, ya, yb, sa, sb, rise, { cast: false }));
  box(s0, s1, y0, y1, -0.1, 0, mats.door);
  for (let h = y0 + 0.3; h < y1; h += 0.3) box(s0, s1, h, h + 0.04, 0, 0.02, mats.trim);
  box(s0 - 0.1, s1 + 0.1, y1, y1 + 0.45, 0, 0.35, mats.trim);   // shutter box
}

export function buildBoilerHouse(world, M0, B) {
  // grating that rises with the building (the shared one does not, and would hang in the air during the build-up)
  const M = { ...M0, grating: patchRise(M0.grating.clone()) };
  const root = new THREE.Group();
  world.scene.add(root);
  const rb = riseDelay(BOILER.x, BOILER.z), rf = riseDelay(FUEL.x, FUEL.z);

  // ---- materials: envelope (fades for the cut-away) and equipment
  const mk = (p) => patchRise(makeMat(p));
  const env = {
    base: mk({ color: '#C9D2DC', roughness: 0.9 }),
    clad: mk({ color: '#FFFFFF', map: ribTexture('#DCE3EA', '#B9C4D0', true), roughness: 0.6 }),
    roof: mk({ color: '#FFFFFF', map: ribTexture('#00529B', '#003F7A', true), roughness: 0.5, metalness: 0.3 }),
    trim: mk({ color: '#94A3B8', roughness: 0.5, metalness: 0.4 }),
    glass: mk({ color: '#4C87B2', emissive: '#0E3A5A', emissiveIntensity: 0.45, roughness: 0.15, metalness: 0.3 }),
    louverBack: mk({ color: '#1E293B', roughness: 0.8 }),
    blade: mk({ color: '#7A8A9C', roughness: 0.5, metalness: 0.4 }),
    door: mk({ color: '#64748B', roughness: 0.5, metalness: 0.5 }),
    sky: mk({ color: '#E0F2FE', emissive: '#7DD3FC', emissiveIntensity: 0.25, roughness: 0.2 }),
  };
  const E = {
    shell: mk({ color: '#B8C4D0', roughness: 0.35, metalness: 0.6 }),        // aluminium-cladded heater
    casing: mk({ color: '#5A6472', roughness: 0.55, metalness: 0.4 }),       // furnace casing
    convective: mk({ color: '#8C9BAA', map: ribTexture('#8C9BAA', '#748392', true), roughness: 0.5, metalness: 0.4 }),
    hotPipe: mk({ color: '#B45309', roughness: 0.45, metalness: 0.4 }),       // thermic fluid lines
    conveyor: mk({ color: '#3F6B4E', roughness: 0.55, metalness: 0.35 }),    // ash conveyors (Decon)
    feed: mk({ color: '#8A6D3B', roughness: 0.6, metalness: 0.3 }),          // fuel-feed elevators / screws
    motor: mk({ color: '#1D4E89', roughness: 0.45, metalness: 0.4 }),
    panel: mk({ color: '#CBD5E1', roughness: 0.5, metalness: 0.2 }),
    chimney: mk({ color: '#9AA5B1', roughness: 0.4, metalness: 0.6 }),
    red: mk({ color: '#B91C1C', roughness: 0.5 }),
  };
  const pitFloor = makeMat({ color: '#7D8792', roughness: 0.95 });   // sunken floors read darker than the ±0 / +300 decks
  const SB = new Batcher();   // envelope

  // =====================================================================================================
  // civil: ±0 floor, fuel-feed pits, boiler pit, retaining walls, +300 platforms, ash-silo yard (always present)
  // =====================================================================================================
  const pitZ = LINES.map((zl) => [zl + 0.7 - 1.5, zl + 0.7 + 1.5]);
  // ±0 slab (04 → 06) around the two feed pits
  const zs = [ZA - OUT, pitZ[0][0], pitZ[0][1], pitZ[1][0], pitZ[1][1], ZE + OUT];
  for (let i = 0; i < zs.length - 1; i++) {
    const x1 = i % 2 === 0 ? X(DECK_X) : X(2.4);
    boxR(B, M.concreteLight, X04 - OUT, x1, -0.3, 0, zs[i], zs[i + 1], -1, { cast: false });
  }
  for (const [z0, z1] of pitZ) {
    // feed pit LVL -1.945 with a sump (-3.153) at the elevator boot
    boxR(B, pitFloor, X(2.4), X(6.6), lv.feedPit - 0.2, lv.feedPit, z0, z1, -1, { cast: false });
    boxR(B, pitFloor, X(8.6), X(DECK_X), lv.feedPit - 0.2, lv.feedPit, z0, z1, -1, { cast: false });
    boxR(B, pitFloor, X(6.6), X(8.6), lv.sump - 0.2, lv.sump, z0, z1, -1, { cast: false });
    for (const xs of [6.6, 8.6]) boxR(B, M.concrete, X(xs) - 0.1, X(xs) + 0.1, lv.sump, lv.feedPit, z0, z1, -1);
    for (const z of [z0, z1]) boxR(B, M.concrete, X(2.4), X(DECK_X), lv.sump, 0, z - 0.1, z + 0.1, -1);
    boxR(B, M.concrete, X(2.3), X(2.5), lv.feedPit, 0, z0, z1, -1);
    stair(B, M, V(X(11.9), lv.feedPit, z1 - 0.5), V(X(10.0), -0.05, z1 - 0.5), 0.8, rb);   // DN into the pit
  }
  // boiler pit floor and its retaining walls (east wall drops to the ash-yard level outside)
  boxR(B, pitFloor, X(DECK_X), X12 + OUT, lv.pit - 0.3, lv.pit, ZA - OUT, ZE + OUT, -1, { cast: false });
  boxR(B, M.concrete, X(DECK_X), X12 + OUT, lv.pit, 0, ZA - OUT, ZA + IN, -1);
  boxR(B, M.concrete, X(DECK_X), X12 + OUT, lv.pit, 0, ZE - IN, ZE + OUT, -1);
  boxR(B, M.concrete, X12 - IN, X12 + OUT, lv.yard, 0, ZA - OUT, ZE + OUT, -1);
  boxR(B, M.concrete, X(DECK_X) - 0.25, X(DECK_X), lv.pit, -0.3, ZA, ZE, -1);
  // +300 heater platforms (RCC on columns) either side of the open centre bay
  const decks = [[ZA + IN, VOID[0]], [VOID[1], ZE - IN]];
  for (const [z0, z1] of decks) boxR(B, M.concreteLight, X(DECK_X), X(DECK_END), lv.deck - 0.2, lv.deck, z0, z1, -1);
  for (let k = 0; k <= 4; k++) for (const z of VOID) {
    const x = X(DECK_X + 0.4 + k * (DECK_END - DECK_X - 0.8) / 4);
    boxR(B, M.concrete, x - 0.17, x + 0.17, lv.pit, lv.deck - 0.2, z - 0.17, z + 0.17, -1);
  }
  for (const z of [gz('A', 3), gz('A', 7.5), gz('A', 16.5), gz('A', 21)]) boxR(B, M.concrete, X(DECK_END) - 0.34, X(DECK_END), lv.pit, lv.deck - 0.2, z - 0.17, z + 0.17, -1);
  // handrails on the deck edges over the pit, and the M.S. stairs down
  rail(B, M.yellow, X(DECK_X), VOID[0], X(14.6), VOID[0], lv.deck, rb);
  rail(B, M.yellow, X(19.0), VOID[0], X(DECK_END), VOID[0], lv.deck, rb);
  rail(B, M.yellow, X(DECK_X), VOID[1], X(19.0), VOID[1], lv.deck, rb);
  rail(B, M.yellow, X(23.8), VOID[1], X(DECK_END), VOID[1], lv.deck, rb);
  rail(B, M.yellow, X(DECK_X), VOID[0], X(DECK_X), VOID[1], 0, rb);
  for (const [z0, z1] of decks) rail(B, M.yellow, X(DECK_END), z0 + 0.3, X(DECK_END), z1 - 0.3, lv.deck, rb);
  stair(B, M, V(X(14.8), lv.pit, gz('A', 9.85)), V(X(18.8), lv.deck, gz('A', 9.85)), 1.0, rb);
  stair(B, M, V(X(23.6), lv.pit, gz('A', 14.05)), V(X(19.4), lv.deck, gz('A', 14.05)), 1.0, rb);
  stair(B, M, V(X(31.0), lv.pit, gz('A', 3.3)), V(X(27.2), lv.deck, gz('A', 3.3)), 1.0, rb);
  stair(B, M, V(X(31.0), lv.pit, gz('A', 21.6)), V(X(27.2), lv.deck, gz('A', 21.6)), 1.0, rb);

  // ash-silo yard: floor at -5.40, retaining walls with a parapet rail, truck bay and the gate in the east wall
  const yardPts = [[ASH_YARD.x0, ASH_YARD.z0], [ASH_YARD.east(ASH_YARD.z0), ASH_YARD.z0], [ASH_YARD.east(ASH_YARD.z1), ASH_YARD.z1], [ASH_YARD.x0, ASH_YARD.z1]];
  const yardShape = new THREE.Shape(yardPts.map(([x, z]) => new THREE.Vector2(x, -z)));
  B.mesh(new THREE.ShapeGeometry(yardShape), pitFloor, [0, lv.yard, 0], [-Math.PI / 2, 0, 0], [1, 1, 1], -1, { cast: false });
  const yardWall = (ax, az, bx, bz) => {
    const a = V(ax, 0, az), b = V(bx, 0, bz), dir = b.clone().sub(a).normalize();
    const n = V(-dir.z, 0, dir.x);   // points into the yard
    beam(B, M.concrete, V(a.x + n.x * 0.15, lv.yard / 2, a.z + n.z * 0.15), V(b.x + n.x * 0.15, lv.yard / 2, b.z + n.z * 0.15), 0.3, -lv.yard, -1);
    rail(B, M.steelDark, a.x + n.x * 0.15, a.z + n.z * 0.15, b.x + n.x * 0.15, b.z + n.z * 0.15, 0, rb);
  };
  yardWall(...yardPts[0], ...yardPts[1]);
  // east wall: open where gate 3 (material exit, gate.js) stands on the yard floor
  const g3 = GATES.find((G) => G.closed), g3h = (g3.open / 2 + 1.3) * Math.abs(Math.cos(g3.ry - Math.PI / 2));
  yardWall(...yardPts[1], ASH_YARD.east(g3.z - g3h), g3.z - g3h);
  yardWall(ASH_YARD.east(g3.z + g3h), g3.z + g3h, ...yardPts[2]);
  yardWall(...yardPts[2], ...yardPts[3]);
  boxR(B, M.concrete, ASH_YARD.x0, ASH_YARD.x0 + 0.3, lv.yard, 0, ZE + OUT, ASH_YARD.z1, -1);
  {
    // truck-bay apron in front of gate 3 (the material exit itself is built in gate.js)
    const zg0 = gz('A', 15.6), zg1 = gz('A', 21.2);
    boxR(B, M.concreteLight, ASH_YARD.x0 + 9.0, ASH_YARD.east(gz('A', 18.4)), lv.yard, lv.yard + 0.04, zg0, zg1, -1, { cast: false });
  }

  // =====================================================================================================
  // envelope (SB, fades with the cut-away)
  // =====================================================================================================
  const { eave, ridge, dado, canopy } = lv;
  const LOUV = [5.4, 18.2];
  const winN = [2.1, 4.9, 26.7, 29.3, 32.1, 34.8, 37.8, 40.6, 43.8, 46.5];
  const winS = [2.2, 4.7, 8.2, 10.8, 15.1, 17.7, 26.6, 29.2, 32.1, 34.8, 37.8, 40.6, 43.8, 46.5];
  const RS1 = [X(20.8), X(23.8)];
  const PUMP_BAY = [X(7.2), X(19.3)];
  const gridXs = Array.from({ length: 9 }, (_, i) => gx(i + 4));
  const longBands = [[0, dado, env.base], [dado, eave, env.clad, true]];
  for (const [face, inward, wins] of [[ZA - OUT, 1, winN], [ZE + OUT, -1, winS]]) {
    const ops = [[X04 - OUT, X12 + OUT, LOUV[0], LOUV[1]], [RS1[0], RS1[1], 0, 5.0], ...wins.map((o) => [X(o) - 0.75, X(o) + 0.75, 1.0, 2.5])];
    if (inward > 0) ops.push([PUMP_BAY[0], PUMP_BAY[1], lv.deck, canopy]);
    wall(SB, 'x', face, inward, X04 - OUT, X12 + OUT, longBands, ops, rb);
    louvres(SB, env, 'x', face, inward, X04 - OUT, X12 + OUT, LOUV[0], LOUV[1], rb, gridXs.slice(1, -1));
    for (const o of wins) windowAt(SB, env, 'x', face, inward, X(o), 1.0, 2.5, 1.5, rb);
    shutterAt(SB, env, 'x', face, inward, RS1[0], RS1[1], lv.deck, 5.0, rb);
    // 2 m canopy at +5.0 with brackets, and a ramp up to the +300 deck at the shutter
    const out = -inward, z1 = face + out * 2.0;
    SB.mesh(ribbedBox(X12 - X04 + 0.6, 0.12, 2.0), env.roof, [(X04 + X12) / 2, canopy + 0.06 + 0.08, (face + z1) / 2], [out * 0.08, 0, 0], [1, 1, 1], rb);
    boxR(SB, env.trim, X04 - 0.3, X12 + 0.3, canopy - 0.05, canopy + 0.2, z1, z1 + out * 0.12, rb, { cast: false });
    for (const x of gridXs) beam(SB, env.trim, V(x, canopy - 0.9, face), V(x, canopy, z1), 0.12, 0.18, rb);
    beam(B, M.concreteLight, V((RS1[0] + RS1[1]) / 2, 0.08, face + out * 2.0), V((RS1[0] + RS1[1]) / 2, lv.deck - 0.04, face), RS1[1] - RS1[0] + 0.6, 0.16, -1, { cast: false });
  }
  // pump-bay sill (wall up to plinth / +300 between 05 and 07)
  // west gable (grid 04, shared with the fuel store): masonry to +3.50, sheeting above, louvres over the fuel roof
  {
    const zA0 = ZA + IN, zE0 = ZE - IN, c = X04;
    const ops = [[gz('A', 4.15), gz('A', 5.65), 0, 2.5], [gz('A', 7.15), gz('A', 10.15), 0, 3.0], [gz('A', 3.0), gz('E', -3.0), 9.8, LOUV[1]]];
    wall(SB, 'z', c - T / 2, 1, zA0, zE0, [[0, 3.5, env.base], [3.5, eave, env.clad, true]], ops, rb);
    louvres(SB, env, 'z', c - T / 2, 1, gz('A', 3.0), gz('E', -3.0), 9.8, LOUV[1], rb, [ZC]);
    shutterAt(SB, env, 'z', c - T / 2, 1, gz('A', 7.15), gz('A', 10.15), 0, 3.0, rf);
    shutterAt(SB, env, 'z', c - T / 2, 1, gz('A', 4.15), gz('A', 5.65), 0, 2.5, rf);
    polyWall(SB, env.clad, c, [[ZA - OUT, eave], [ZE + OUT, eave], [ZC, ridge]], T, rb);
  }
  // east gable (grid 12): dado with eight windows over the ash yard, sheeting, a louvre band under the eave
  {
    const face = X12 + OUT, zw = [1.9, 4.6, 7.9, 10.6, 13.1, 15.7, 18.7, 22.4];
    const ops = [[gz('A', 4.0), gz('E', -4.0), 15.8, LOUV[1]], ...zw.map((o) => [gz('A', o) - 0.75, gz('A', o) + 0.75, 1.0, 2.5])];
    wall(SB, 'z', face, -1, ZA + IN, ZE - IN, [[0, dado, env.base], [dado, eave, env.clad, true]], ops, rb);
    louvres(SB, env, 'z', face, -1, gz('A', 4.0), gz('E', -4.0), 15.8, LOUV[1], rb, [ZC]);
    for (const o of zw) windowAt(SB, env, 'z', face, -1, gz('A', o), 1.0, 2.5, 1.5, rb);
    polyWall(SB, env.clad, X12 + OUT - T / 2, [[ZA - OUT, eave], [ZE + OUT, eave], [ZC, ridge]], T, rb);
  }
  // boiler roof: two slopes, gutters, louvred monitor along the ridge, polycarbonate lighting strips
  const half = ZC - (ZA - OUT), pitch = Math.atan2(ridge - eave, half);
  const roofLen = X12 - X04 + 2 * OUT + 0.9, roofX = (X04 + X12) / 2;
  const slope = Math.hypot(half, ridge - eave) + 0.55;
  const STRIPS = [3.2, 9.8, 16.2, 22.15, 28.15, 34.3, 40.1, 46.2];
  const roofTopB = (d) => ridge - d * Math.tan(pitch) + 0.2;       // top of sheeting at horizontal distance d from the ridge
  for (const s of [-1, 1]) {
    const cz = ZC + s * (half / 2 - 0.25), cy = (eave + ridge) / 2 + 0.12;
    SB.mesh(ribbedBox(roofLen, 0.14, slope, 0.6), env.roof, [roofX, cy, cz], [s * pitch, 0, 0], [1, 1, 1], rb);
    const zg = ZC + s * (half + 0.45);
    boxR(SB, env.trim, X04 - 0.45, X12 + 0.45, eave - 0.25, eave + 0.05, zg - 0.15, zg + 0.15, rb);
    const d0 = 2.3, d1 = half - 0.7, dm = (d0 + d1) / 2;
    for (const o of STRIPS) {
      SB.mesh(new THREE.BoxGeometry(0.9, 0.05, (d1 - d0) / Math.cos(pitch)), env.sky, [X(o), roofTopB(dm) - 0.02, ZC + s * dm], [s * pitch, 0, 0], [1, 1, 1], rb, { cast: false });
    }
  }
  boxR(SB, env.louverBack, X04 + 0.6, X12 - 0.6, ridge - 0.3, ridge + 0.85, ZC - 1.6, ZC + 1.6, rb);
  for (const y of [ridge + 0.25, ridge + 0.6]) for (const s of [-1, 1]) boxR(SB, env.blade, X04 + 0.6, X12 - 0.6, y - 0.03, y + 0.03, ZC + s * 1.6 - 0.12, ZC + s * 1.6 + 0.12, rb, { cast: false });
  for (const s of [-1, 1]) SB.mesh(ribbedBox(X12 - X04 - 0.6, 0.1, 2.15, 0.6), env.roof, [roofX, ridge + 1.06, ZC + s * 0.95], [s * 0.3, 0, 0], [1, 1, 1], rb);

  // ---- fuel store envelope: masonry to +3.50, sheeting to +7.00, asymmetric gable (ridge on row C at +9.25)
  const fe = lv.fuelEave, fr = lv.fuelRidge;
  const halfN = ZC - (ZA - OUT), halfS = ZF + OUT - ZC;
  const pN = Math.atan2(fr - fe, halfN), pS = Math.atan2(fr - fe, halfS);
  const fuelRoofH = (z) => (z < ZC ? fr - (ZC - z) * Math.tan(pN) : fr - (z - ZC) * Math.tan(pS));
  const fuelBands = [[0, 3.5, env.base], [3.5, fe, env.clad, true]];
  const RS = [FUEL.x - 2.25, FUEL.x + 2.25];
  wall(SB, 'x', ZA - OUT, 1, X01 - OUT, X04 - T / 2, fuelBands, [[RS[0], RS[1], 0, 5.0]], rf);
  shutterAt(SB, env, 'x', ZA - OUT, 1, RS[0], RS[1], 0, 5.0, rf);
  SB.mesh(ribbedBox(6.2, 0.12, 2.2), env.roof, [FUEL.x, 5.62, ZA - OUT - 1.1], [-0.08, 0, 0], [1, 1, 1], rf);
  for (const x of [RS[0] - 0.7, RS[1] + 0.7]) beam(SB, env.trim, V(x, 4.7, ZA - OUT), V(x, 5.5, ZA - OUT - 2.1), 0.12, 0.18, rf);
  wall(SB, 'x', ZF + OUT, -1, X01 - OUT, X04 + OUT, fuelBands, [], rf);
  const fuelWin = [1.5, 4.0, 6.8, 9.3];
  wall(SB, 'z', X01 - OUT, 1, ZA + IN, ZF - IN, fuelBands, fuelWin.map((o) => [gz('A', o) - 0.75, gz('A', o) + 0.75, 1.0, 2.5]), rf);
  for (const o of fuelWin) windowAt(SB, env, 'z', X01 - OUT, 1, gz('A', o), 1.0, 2.5, 1.5, rf);
  polyWall(SB, env.clad, X01 - OUT + T / 2, [[ZA - OUT, fe], [ZF + OUT, fe], [ZC, fr]], T, rf);
  wall(SB, 'z', X04 - T / 2, 1, ZE + OUT, ZF - IN, fuelBands, [], rf);              // grid 04, rows E → F
  polyWall(SB, env.clad, X04, [[ZE + OUT, fe], [ZF + OUT, fe], [ZE + OUT, fuelRoofH(ZE + OUT)]], T, rf);
  {
    const len = X04 - X01 + OUT + 0.45, cx = (X01 - OUT - 0.45 + X04) / 2;
    for (const [s, hs, p] of [[-1, halfN, pN], [1, halfS, pS]]) {
      const sl = Math.hypot(hs, fr - fe) + 0.55;
      SB.mesh(ribbedBox(len, 0.14, sl, 0.6), env.roof, [cx, (fe + fr) / 2 + 0.12, ZC + s * (hs / 2 - 0.25)], [s * p, 0, 0], [1, 1, 1], rf);
      const zg = ZC + s * (hs + 0.45);
      boxR(SB, env.trim, X01 - 0.6, X04, fe - 0.25, fe + 0.05, zg - 0.15, zg + 0.15, rf);
    }
    boxR(SB, env.trim, X01 - 0.6, X04, fr + 0.1, fr + 0.3, ZC - 0.3, ZC + 0.3, rf);
  }
  const envGroup = new THREE.Group();
  root.add(envGroup);
  SB.build(envGroup);

  // ---- portal frames (static, so the structure stays when the cladding is cut away)
  for (const x of gridXs) {
    const y0 = x === X04 ? 0 : lv.pit;
    for (const z of [ZA + IN + 0.25, ZE - IN - 0.25]) boxR(B, M.steelDark, x - 0.2, x + 0.2, y0, eave, z - 0.25, z + 0.25, rb);
    for (const [za, zb] of [[ZA + IN, ZC], [ZE - IN, ZC]]) beam(B, M.steelDark, V(x, eave - 0.45, za), V(x, ridge - 0.45, zb), 0.22, 0.7, rb);
  }
  for (const x of [X04 + 0.25, X12 - IN - 0.2]) for (const r of ['B', 'C', 'D']) {
    const z = gz(r), top = ridge - Math.abs(z - ZC) * Math.tan(pitch) - 0.5;
    boxR(B, M.steelDark, x - 0.18, x + 0.18, x === X04 + 0.25 ? 0 : lv.pit, top, z - 0.2, z + 0.2, rb);
  }
  for (let i = 1; i <= 4; i++) {
    const x = gx(i);
    for (const z of [ZA + IN + 0.2, ZF - IN - 0.2]) if (!(i === 4 && z < ZC)) boxR(B, M.steelDark, x - 0.16, x + 0.16, 0, fe, z - 0.2, z + 0.2, rf);
    if (i < 4) for (const [za, zb] of [[ZA + IN, ZC], [ZF - IN, ZC]]) beam(B, M.steelDark, V(x, fe - 0.35, za), V(x, fr - 0.35, zb), 0.18, 0.5, rf);
  }
  boxR(B, M.concreteLight, X01 - OUT, X04 - IN, 0, 0.05, ZA - OUT, ZF + OUT, -1, { cast: false });

  // =====================================================================================================
  // ±0 zone: control room, T.F. storage + expansion tank tower, circulation pumps and thermic-fluid headers
  // =====================================================================================================
  {
    const x0 = X(1.9), x1 = X(12.0), z0 = gz('A', 9.6), z1 = gz('A', 16.6), h = 3.6;
    for (const [a0, a1, b0, b1] of [[x0, x1, z0, z0 + 0.2], [x0, x1, z1 - 0.2, z1], [x0, x0 + 0.2, z0, z1], [x1 - 0.2, x1, z0, z1]]) boxR(B, M.wall, a0, a1, 0, h, b0, b1, rb);
    boxR(SB, env.base, x0 - 0.1, x1 + 0.1, h, h + 0.2, z0 - 0.1, z1 + 0.1, rb);
    for (const z of [z0 + 1.6, z0 + 3.5, z0 + 5.4]) boxR(B, M.glass, x1, x1 + 0.04, 1.1, 2.3, z - 0.7, z + 0.7, rb, { cast: false });
    boxR(B, M.steelDark, x0 - 0.04, x0, 0, 2.2, gz('A', 12.6) - 0.5, gz('A', 12.6) + 0.5, rb, { cast: false });
    // heater MCC panels 1–3, boiler PLC panels, bag-filter panels
    for (const [a0, a1, b0, b1] of [[2.6, 4.2, 9.9, 10.4], [4.6, 7.8, 9.9, 10.4], [2.6, 4.2, 16.0, 16.5], [4.6, 7.8, 16.0, 16.5], [8.6, 10.0, 16.0, 16.5], [5.5, 8.5, 12.7, 13.2], [2.3, 2.8, 11.5, 14.8]]) boxR(B, E.panel, X(a0), X(a1), 0, 2.1, gz('A', b0), gz('A', b1), rb);
    SB.build(envGroup);
  }
  {
    // T.F. storage (dump) tank at grade, a platform over it, and the expansion tank on a braced tower at +12.5
    const zc = gz('A', 2.25), xa = X(3.8), xb = X(7.0), za = gz('A', 0.6), zb = gz('A', 3.9);
    cyl(B, M.steel, X(5.4), 1.15, zc, 0.85, 5.0, 'x', rb);
    for (const s of [-1, 1]) B.mesh(new THREE.SphereGeometry(0.85, 16, 8), M.steel, [X(5.4) + s * 2.5, 1.15, zc], [0, 0, 0], [0.3, 1, 1], rb);
    for (const x of [X(3.8), X(7.0)]) boxR(B, M.steelDark, x - 0.3, x + 0.3, 0, 0.4, zc - 0.7, zc + 0.7, rb);
    legs(B, M.steelDark, xa, xb, za, zb, 0, 12.5, rb, 0.3);
    legs(B, M.steelDark, X(0.6), X(7.8), gz('A', 0.4), gz('A', 4.2), 0, 2.6, rb, 0.18);
    deck(B, M, X(0.6), X(7.8), gz('A', 0.4), gz('A', 4.2), 2.6, rb);
    for (const y of [6.5, 12.5]) {
      beam(B, M.steelDark, V(xa, y, za), V(xb, y, za), 0.2, 0.3, rb); beam(B, M.steelDark, V(xa, y, zb), V(xb, y, zb), 0.2, 0.3, rb);
      beam(B, M.steelDark, V(xa, y, za), V(xa, y, zb), 0.2, 0.3, rb); beam(B, M.steelDark, V(xb, y, za), V(xb, y, zb), 0.2, 0.3, rb);
    }
    for (const [y0, y1] of [[2.6, 6.5], [6.5, 12.5]]) {
      for (const z of [za, zb]) { beam(B, M.steelDark, V(xa, y0, z), V(xb, y1, z), 0.1, 0.12, rb); beam(B, M.steelDark, V(xb, y0, z), V(xa, y1, z), 0.1, 0.12, rb); }
      for (const x of [xa, xb]) { beam(B, M.steelDark, V(x, y0, za), V(x, y1, zb), 0.1, 0.12, rb); beam(B, M.steelDark, V(x, y0, zb), V(x, y1, za), 0.1, 0.12, rb); }
    }
    deck(B, M, xa - 0.4, xb + 0.4, za - 0.3, zb + 0.3, 12.5, rb);
    rail(B, M.yellow, xa - 0.4, zb + 0.3, xb + 0.4, zb + 0.3, 12.5, rb);
    rail(B, M.yellow, xb + 0.4, za - 0.3, xb + 0.4, zb + 0.3, 12.5, rb);
    cyl(B, M.steel, X(5.4), 13.45, zc, 0.8, 4.2, 'x', rb);
    for (const s of [-1, 1]) B.mesh(new THREE.SphereGeometry(0.8, 16, 8), M.steel, [X(5.4) + s * 2.1, 13.45, zc], [0, 0, 0], [0.3, 1, 1], rb);
    for (const x of [X(4.4), X(6.4)]) boxR(B, M.steelDark, x - 0.15, x + 0.15, 12.5, 12.9, zc - 0.6, zc + 0.6, rb);
    polyline(B, E.hotPipe, [V(X(6.9), 13.0, zc), V(X(7.6), 13.0, zc), V(X(7.6), 2.8, zc), V(X(7.6), 2.8, gz('A', 3.4))], 0.09, rb);
    beam(B, M.steelDark, V(X(7.25), 2.6, gz('A', 4.4)), V(X(7.25), 12.5, gz('A', 4.4)), 0.5, 0.06, rb);   // cage ladder
  }
  {
    // thermic-fluid circulation pumps (north wall bay 05 → 07) on two headers that feed both heaters
    const zH1 = gz('A', 3.0), zH2 = gz('A', 3.4);
    const pumps = [[8.8, 0], [10.0, 0], [11.2, 0], [12.2, 0], [14.6, lv.deck], [15.95, lv.deck], [17.3, lv.deck], [18.6, lv.deck]];
    for (const [o, y] of pumps) {
      const x = X(o);
      boxR(B, M.steelDark, x - 0.35, x + 0.35, y, y + 0.25, gz('A', 0.5), gz('A', 2.4), rb);
      cyl(B, E.motor, x, y + 0.6, gz('A', 0.95), 0.3, 0.85, 'z', rb);
      cyl(B, E.hotPipe, x, y + 0.6, gz('A', 1.7), 0.34, 0.4, 'z', rb);
      polyline(B, E.hotPipe, [V(x, y + 0.9, gz('A', 1.7)), V(x, 2.4, gz('A', 1.7)), V(x, 2.4, zH1)], 0.08, rb);
      polyline(B, E.hotPipe, [V(x + 0.2, y + 0.55, gz('A', 2.0)), V(x + 0.2, y + 0.55, zH2), V(x + 0.2, 2.8, zH2)], 0.08, rb);
    }
    tube(B, E.hotPipe, V(X(8.3), 2.4, zH1), V(X(19.0), 2.4, zH1), 0.13, rb);
    tube(B, E.hotPipe, V(X(8.3), 2.8, zH2), V(X(19.0), 2.8, zH2), 0.13, rb);
    // branches along z (between the day hoppers and the ram feeders) to each heater, risers to the coil
    const southEnd = LINES[1];
    polyline(B, E.hotPipe, [V(X(12.35), 2.4, zH1), V(X(12.35), 2.4, southEnd - 2.3)], 0.13, rb);
    polyline(B, E.hotPipe, [V(X(12.7), 2.8, zH2), V(X(12.7), 2.8, southEnd - 2.6)], 0.13, rb);
    for (const zl of LINES) {
      polyline(B, E.hotPipe, [V(X(12.35), 2.4, zl - 2.3), V(X(22.25), 2.4, zl - 2.3), V(X(22.25), 10.9, zl - 2.3), V(X(22.25), 10.9, zl - 1.2)], 0.11, rb);
      polyline(B, E.hotPipe, [V(X(12.7), 2.8, zl - 2.6), V(X(21.85), 2.8, zl - 2.6), V(X(21.85), 11.3, zl - 2.6), V(X(21.85), 11.3, zl - 1.2)], 0.11, rb);
    }
    for (const x of [X(10.0), X(16.0)]) boxR(B, M.steelDark, x - 0.08, x + 0.08, 0, 2.3, zH1 + 0.15 - 0.08, zH1 + 0.15 + 0.08, rb);
  }

  // =====================================================================================================
  // the two heater lines
  // =====================================================================================================
  const flameMats = [];
  const flameOrigins = [];
  for (const zl of LINES) {
    const zp = zl + 0.7, sOut = zl < ZC ? -1 : 1, sIn = -sOut;
    // fuel feed: dump hopper + screw SC-1 in the pit, bucket elevator, chute, day hopper, screw SC-2, ram feeder
    boxR(B, M.grating, X(3.3), X(5.9), -0.06, 0, zp - 1.2, zp + 1.2, rb, { cast: false });
    hopper(B, E.feed, X(4.6), zp, 2.5, 2.3, lv.feedPit + 0.6, -0.08, rb);
    boxR(B, E.feed, X(3.4), X(7.2), lv.feedPit + 0.1, lv.feedPit + 0.75, zp - 0.35, zp + 0.35, rb);
    boxR(B, E.feed, X(6.8), X(8.2), lv.sump, 16.4, zp - 0.45, zp + 0.45, rb);
    boxR(B, E.feed, X(6.6), X(8.6), 16.4, 17.5, zp - 0.6, zp + 0.6, rb);
    boxR(B, E.motor, X(7.0), X(7.9), 16.6, 17.2, zp + 0.6, zp + 1.2, rb);
    beam(B, E.feed, V(X(8.5), 16.6, zp), V(X(10.4), 11.25, zl + 0.2), 0.45, 0.45, rb);
    boxR(B, M.msPaint, X(9.1), X(12.1), 7.5, 11.0, zl - 1.5, zl + 1.5, rb);
    hopper(B, M.msPaint, X(10.6), zl, 3.0, 3.0, 5.95, 7.5, rb);
    legs(B, M.steelDark, X(9.1), X(12.1), zl - 1.5, zl + 1.5, lv.feedPit, 7.5, rb);
    deck(B, M, X(8.9), X(12.3), zl - 1.7, zl + 1.7, 11.05, rb);
    rail(B, M.yellow, X(8.9), zl + sIn * 1.7, X(12.3), zl + sIn * 1.7, 11.05, rb);
    cyl(B, E.feed, X(11.75), 5.75, zl, 0.3, 5.7, 'x', rb);
    boxR(B, E.feed, X(14.3), X(14.9), 2.7, 5.75, zl - 0.3, zl + 0.3, rb);
    boxR(B, E.casing, X(12.85), X(16.2), -1.0, 1.6, zl - 0.8, zl + 0.8, rb);
    boxR(B, E.feed, X(13.9), X(15.3), 1.6, 2.7, zl - 0.6, zl + 0.6, rb);
    boxR(B, E.casing, X(12.9), X(13.8), 0.4, 1.4, zl - 0.55, zl + 0.55, rb);   // hydraulic ram
    // furnace (reciprocating grate) with fire door on the side facing the open bay; ash hopper below
    boxR(B, E.casing, X(16.2), X(22.4), -1.0, 1.0, zl - 2.1, zl + 2.1, rb);
    hopper(B, E.casing, X(18.2), zl, 3.2, 3.0, lv.pit + 0.65, -1.0, rb);
    legs(B, M.steelDark, X(16.4), X(22.2), zl - 1.9, zl + 1.9, lv.pit, -1.0, rb, 0.3);
    const fm = makeMat({ color: '#7C2D12', emissive: '#F59E0B', emissiveIntensity: 1.2 });
    flameMats.push(fm);
    for (const x of [X(17.6), X(20.4)]) {
      const door = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), fm);
      door.position.set(x, 0.0, zl + sIn * 2.12);
      door.rotation.y = sIn > 0 ? 0 : Math.PI;
      root.add(door);
      boxR(B, M.steelDark, x - 0.6, x + 0.6, -0.6, 0.6, zl + sIn * 2.1, zl + sIn * 2.16, rb, { cast: false });
    }
    flameOrigins.push(V(X(19), 0.5, zl));
    // heater coil vessel (E1) with its flue box on top, the convective down-pass and the air preheater
    cyl(B, E.shell, X(20.6), 5.65, zl, 1.7, 9.3, 'y', rb, 1.7, 28);
    for (let y = 2.0; y < 10.3; y += 2.0) cyl(B, M.steelDark, X(20.6), y, zl, 1.75, 0.12, 'y', rb, 1.75, 28);
    boxR(B, E.casing, X(19.3), X(22.4), 10.3, 12.3, zl - 1.3, zl + 1.3, rb);
    cyl(B, E.motor, X(20.0), 12.8, zl, 0.55, 1.0, 'y', rb);    // combustion-air fan on the top box
    boxR(B, E.convective, X(22.4), X(24.8), 1.0, 12.3, zl - 1.3, zl + 1.3, rb);
    boxR(B, E.casing, X(24.8), X(25.3), 1.2, 2.6, zl - 0.7, zl + 0.7, rb);
    boxR(B, M.msPaint, X(25.3), X(28.3), 1.0, 8.5, zl - 1.5, zl + 1.5, rb);
    hopper(B, M.msPaint, X(26.8), zl, 2.6, 2.6, -0.6, 1.0, rb);
    legs(B, M.steelDark, X(25.4), X(28.2), zl - 1.4, zl + 1.4, lv.pit, 1.0, rb);
    // platforms around the heater at +4.6 / +7.6 / +10.3 with stairs on the outer side
    for (const y of [4.6, 7.6]) {
      deck(B, M, X(18.6), X(25.3), zl - 2.6, zl + 2.6, y, rb);
      rail(B, M.yellow, X(18.6), zl + sIn * 2.6, X(25.3), zl + sIn * 2.6, y, rb);
      rail(B, M.yellow, X(25.3), zl - 2.6, X(25.3), zl + 2.6, y, rb);
    }
    legs(B, M.steelDark, X(18.6), X(25.3), zl - 2.6, zl + 2.6, lv.deck, 7.6, rb, 0.2);
    deck(B, M, X(19.1), X(24.9), zl - 1.8, zl + 1.8, 12.3, rb);
    stair(B, M, V(X(25.4), lv.deck, zl + sOut * 3.1), V(X(21.2), 4.6, zl + sOut * 3.1), 0.9, rb);
    stair(B, M, V(X(21.4), 4.6, zl + sOut * 4.05), V(X(24.6), 7.6, zl + sOut * 4.05), 0.9, rb);
    boxR(B, M.grating, X(21.0), X(21.6), 4.55, 4.6, zl + sOut * 2.6, zl + sOut * 4.5, rb, { cast: false });
    // flue: APH → multicyclone (E9, north of the line) → bag filter (E3) → fans (E4) → common flue
    const zm = zl - 4.8, zb = zl - 2.4, zf = zl - 0.6;
    const D = 0.9;
    beam(B, E.casing, V(X(26.8), 8.5, zl), V(X(26.8), 9.85, zl), D, D, rb);
    beam(B, E.casing, V(X(26.35), 9.85, zl), V(X(32.75), 9.85, zl), D, D, rb);
    beam(B, E.casing, V(X(32.3), 9.85, zl + D / 2), V(X(32.3), 9.85, zm - D / 2), D, D, rb);
    beam(B, E.casing, V(X(32.3), 10.3, zm), V(X(32.3), 6.0, zm), D, D, rb);
    boxR(B, M.msPaint, X(31.3), X(33.3), 3.6, 6.0, zm - 1.0, zm + 1.0, rb);
    hopper(B, M.msPaint, X(32.3), zm, 2.0, 2.0, 1.6, 3.6, rb);
    legs(B, M.steelDark, X(31.4), X(33.2), zm - 0.9, zm + 0.9, lv.pit, 3.6, rb, 0.18);
    beam(B, E.casing, V(X(33.3), 4.9, zm), V(X(34.8), 4.9, zm), D, D, rb);
    boxR(B, M.msPaint, X(34.8), X(39.5), 3.0, 8.0, zb - 3.2, zb + 3.2, rb);
    boxR(B, M.steelDark, X(35.2), X(39.1), 8.0, 8.6, zb - 2.9, zb + 2.9, rb);
    for (const s of [-1, 1]) hopper(B, M.msPaint, X(37.15), zb + s * 1.6, 4.4, 3.0, 0.5, 3.0, rb);
    legs(B, M.steelDark, X(35.0), X(39.3), zb - 3.0, zb + 3.0, lv.pit, 3.0, rb, 0.26);
    deck(B, M, X(34.6), X(39.7), zb - 3.4, zb + 3.4, 8.65, rb);
    rail(B, M.yellow, X(34.6), zb - 3.4, X(39.7), zb - 3.4, 8.65, rb);
    rail(B, M.yellow, X(34.6), zb + 3.4, X(39.7), zb + 3.4, 8.65, rb);
    beam(B, M.steelDark, V(X(34.2), lv.pit, zb + 3.6), V(X(34.2), 8.65, zb + 3.6), 0.5, 0.06, rb);   // cage ladder
    // bag filter → ID fan (E10) by grid 12; E4 twin units on stands over the ash conveyor
    const zi = zl + 2.3;
    beam(B, E.casing, V(X(39.5), 6.5, zl + 0.3), V(X(46.65 + D / 2), 6.5, zl + 0.3), D, D, rb);
    beam(B, E.casing, V(X(46.65), 6.5, zl + 0.3 - D / 2), V(X(46.65), 6.5, zi + D / 2), D, D, rb);
    beam(B, E.casing, V(X(46.65), 6.5 + D / 2, zi), V(X(46.65), lv.pit + 2.4, zi), D, D, rb);
    boxR(B, M.msPaint, X(45.9), X(47.4), lv.pit, lv.pit + 2.4, zl + 0.9, zl + 3.7, rb);
    cyl(B, M.msPaint, X(46.65), lv.pit + 1.2, zl + 1.9, 1.05, 1.0, 'x', rb, 1.05, 24);
    boxR(B, E.motor, X(47.4), X(48.0), lv.pit + 0.6, lv.pit + 1.6, zl + 1.5, zl + 2.3, rb);
    for (const o of [41.6, 43.5]) {
      cyl(B, M.msPaint, X(o), 0.0, zf, 0.85, 2.0, 'y', rb, 0.85, 24);
      cyl(B, M.msPaint, X(o), -1.4, zf, 0.2, 0.8, 'y', rb, 0.85, 24);
      legs(B, M.steelDark, X(o) - 0.75, X(o) + 0.75, zf - 0.75, zf + 0.75, lv.pit, -1.0, rb, 0.16);
      boxR(B, E.motor, X(o) - 0.3, X(o) + 0.3, 1.0, 1.6, zf - 0.3, zf + 0.3, rb);
    }
  }
  // common flue (both fan sets) along row C, through the east wall to the chimney in the ash yard
  const zFlue = gz('A', 12.6), chim = V(X12 + 4.55, 0, gz('A', 7.66));
  for (const zl of LINES) beam(B, E.casing, V(X(46.65), -1.0, zl + 2.3), V(X(46.65), -1.0, zFlue), 1.1, 1.1, rb);
  beam(B, E.casing, V(X(46.1), -1.0, zFlue), V(chim.x + 0.55, -1.0, zFlue), 1.1, 1.1, rb);
  beam(B, E.casing, V(chim.x, -1.0, zFlue + 0.55), V(chim.x, -1.0, chim.z + 0.9), 1.1, 1.1, rb);
  boxR(B, M.steelDark, chim.x - 0.2, chim.x + 0.2, lv.yard, -1.55, zFlue - 0.2, zFlue + 0.2, rb);
  // chimney (height assumed: +32 m above FFL) with platforms, ladder and aviation bands
  const CH_TOP = 32;
  boxR(B, M.concrete, chim.x - 1.6, chim.x + 1.6, lv.yard, lv.yard + 0.6, chim.z - 1.6, chim.z + 1.6, -1);
  cyl(B, E.chimney, chim.x, (lv.yard + 0.6 + CH_TOP) / 2, chim.z, 1.15, CH_TOP - lv.yard - 0.6, 'y', rb, 0.85, 24);
  for (const y of [CH_TOP - 1.6, CH_TOP - 3.4]) cyl(B, E.red, chim.x, y, chim.z, 0.92, 0.8, 'y', rb, 0.9, 24);
  for (const y of [CH_TOP - 1.0]) cyl(B, M.steelDark, chim.x, y, chim.z, 1.5, 0.12, 'y', rb, 1.5, 24);
  cyl(B, M.steelDark, chim.x, 12.0, chim.z, 1.6, 0.12, 'y', rb, 1.6, 24);
  beam(B, M.steelDark, V(chim.x + 1.25, lv.yard + 0.6, chim.z), V(chim.x + 0.95, CH_TOP - 1.0, chim.z), 0.5, 0.06, rb);

  // =====================================================================================================
  // ash handling: drag-chain conveyors on the pit floor → bucket elevator at grid 12 → silo in the ash yard
  // =====================================================================================================
  const cv = (a, b) => beam(B, E.conveyor, a, b, 0.7, 0.5, rb);
  const yC = lv.pit + 0.25;
  cv(V(X(17.8), yC, gz('A', 4.4)), V(X(17.8), yC, gz('A', 21.0)));        // under the furnace grates
  cv(V(X(26.8), yC, gz('A', 4.9)), V(X(26.8), yC, gz('A', 20.8)));        // air-preheater hoppers
  cv(V(X(37.15), yC, gz('A', 1.4)), V(X(37.15), yC, gz('A', 18.8)));      // multicyclone + bag-filter hoppers
  for (const zl of LINES) cv(V(X(32.3), yC, zl - 4.8), V(X(37.15), yC, zl - 4.8));
  cv(V(X(37.15), yC, LINES[0] - 0.6), V(X(44.4), yC, LINES[0] - 0.6));
  cv(V(X(17.4), yC, gz('A', 12.4)), V(X(37.5), yC, gz('A', 12.4)));       // collector along row C
  cv(V(X(37.15), yC, gz('A', 18.4)), V(X12 + 1.0, lv.pit + 0.9, gz('A', 18.4)));   // rising to the ash elevator
  const ash = V(X12 + 1.7, 0, gz('A', 18.4)), silo = V(X12 + 6.94, 0, gz('A', 18.5));
  boxR(B, M.concrete, X12 + 0.2, X12 + 3.2, lv.yard, -3.04, ash.z - 2.0, ash.z + 2.0, -1);
  boxR(B, E.conveyor, ash.x - 0.7, ash.x + 0.7, -3.04, 15.5, ash.z - 0.45, ash.z + 0.45, rb);
  boxR(B, E.conveyor, ash.x - 0.9, ash.x + 0.9, 15.5, 16.6, ash.z - 0.6, ash.z + 0.6, rb);
  boxR(B, E.motor, ash.x - 0.4, ash.x + 0.4, 15.7, 16.3, ash.z + 0.6, ash.z + 1.2, rb);
  beam(B, E.conveyor, V(ash.x + 0.9, 15.8, ash.z), V(silo.x, 7.8, silo.z), 0.4, 0.4, rb);
  // silo Ø5.2 on a four-post frame: shell +3.2 → +7.2, cone to +0.6, conditioner screw at -1.5, top platform +7.4
  const sh = 2.95;
  legs(B, M.steelDark, silo.x - sh, silo.x + sh, silo.z - sh, silo.z + sh, lv.yard, 7.4, rb, 0.4);
  for (const y of [-1.9, 3.2]) for (const s of [-1, 1]) {
    beam(B, M.steelDark, V(silo.x - sh, y, silo.z + s * sh), V(silo.x + sh, y, silo.z + s * sh), 0.25, 0.35, rb);
    beam(B, M.steelDark, V(silo.x + s * sh, y, silo.z - sh), V(silo.x + s * sh, y, silo.z + sh), 0.25, 0.35, rb);
  }
  for (const s of [-1, 1]) {
    beam(B, M.steelDark, V(silo.x - sh, lv.yard + 0.3, silo.z + s * sh), V(silo.x + sh, -1.9, silo.z + s * sh), 0.12, 0.14, rb);
    beam(B, M.steelDark, V(silo.x + sh, lv.yard + 0.3, silo.z + s * sh), V(silo.x - sh, -1.9, silo.z + s * sh), 0.12, 0.14, rb);
  }
  cyl(B, M.steel, silo.x, 5.2, silo.z, 2.6, 4.0, 'y', rb, 2.6, 32);
  cyl(B, M.steel, silo.x, 1.9, silo.z, 0.35, 2.6, 'y', rb, 2.6, 32);
  B.mesh(new THREE.ConeGeometry(2.65, 0.5, 32), M.steel, [silo.x, 7.45, silo.z], [0, 0, 0], [1, 1, 1], rb);
  boxR(B, M.yellow, silo.x - 0.35, silo.x + 0.35, -0.7, 0.6, silo.z - 0.35, silo.z + 0.35, rb);
  boxR(B, E.conveyor, silo.x - 1.6, X12 + 11.2, -1.8, -1.2, silo.z - 0.4, silo.z + 0.4, rb);   // ash conditioner
  boxR(B, E.conveyor, X12 + 10.6, X12 + 11.2, -2.6, -1.8, silo.z - 0.35, silo.z + 0.35, rb);
  deck(B, M, silo.x - sh - 0.4, X12 + 11.6, silo.z + 0.45, silo.z + sh + 1.3, -1.9, rb);
  deck(B, M, silo.x - sh - 0.4, silo.x + sh + 0.4, silo.z - sh - 0.4, silo.z + sh + 0.4, 7.4, rb);
  for (const [x0, z0, x1, z1] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) {
    const e = sh + 0.4;
    rail(B, M.yellow, silo.x + x0 * e, silo.z + z0 * e, silo.x + x1 * e, silo.z + z1 * e, 7.4, rb);
  }
  stair(B, M, V(silo.x + 2.7, lv.yard, silo.z + sh + 0.75), V(silo.x - 1.8, -1.9, silo.z + sh + 0.75), 1.0, rb);
  beam(B, M.steelDark, V(silo.x + sh + 0.3, -1.9, silo.z + 1.5), V(silo.x + sh + 0.3, 7.4, silo.z + 1.5), 0.5, 0.06, rb);
  ashTruck(B, M, X12 + 8.6, lv.yard, silo.z, rb);

  // =====================================================================================================
  // fuel store contents: agro-waste piles (rice husk, soya husk, briquettes) and a wheel loader
  // =====================================================================================================
  for (const [px, pz, sx, sz, mat] of [[X01 + 4.6, gz('A', 7.0), 1.15, 1.05, M.biomass], [X01 + 5.0, gz('A', 15.0), 1.1, 1.25, M.biomassGreen], [X01 + 5.6, gz('A', 24.0), 1.1, 0.95, M.biomass], [X01 + 10.8, gz('A', 22.5), 0.75, 0.8, M.biomassGreen]]) {
    B.mesh(new THREE.IcosahedronGeometry(4.0, 1), mat, [px, 0, pz], [0, px, 0], [sx, 0.62, sz], rf);
  }
  wheelLoader(B, M, X04 - 3.6, gz('A', 8.6), rf);

  // =====================================================================================================
  // outline for the cut-away, roofs for the rooftop solar, plume, animation
  // =====================================================================================================
  const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color('#38BDF8').multiplyScalar(2.5), transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const outline = new THREE.Group();
  for (const [x0, x1, z0, z1, h, rr, rz] of [[X04 - OUT, X12 + OUT, ZA - OUT, ZE + OUT, eave, ridge, ZC], [X01 - OUT, X04, ZA - OUT, ZF + OUT, fe, fr, ZC]]) {
    const p = (x, y, z) => V(x, y, z);
    const pts = [
      p(x0, 0, z0), p(x1, 0, z0), p(x1, 0, z0), p(x1, 0, z1), p(x1, 0, z1), p(x0, 0, z1), p(x0, 0, z1), p(x0, 0, z0),
      p(x0, h, z0), p(x1, h, z0), p(x1, h, z1), p(x0, h, z1), p(x0, rr, rz), p(x1, rr, rz),
      p(x0, h, z0), p(x0, rr, rz), p(x0, rr, rz), p(x0, h, z1), p(x1, h, z0), p(x1, rr, rz), p(x1, rr, rz), p(x1, h, z1),
    ];
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) pts.push(p(x, 0, z), p(x, h, z));
    outline.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
  }
  outline.visible = false;
  root.add(outline);

  const roofs = [
    { name: 'Boiler house', key: 'boilerCutaway', panels: boilerPanels() },
    { name: 'Fuel storage', key: 'boilerCutaway', panels: fuelPanels() },
  ];
  // portrait modules on both boiler-house slopes, between the lighting strips and clear of the monitor
  function boilerPanels() {
    const out = [];
    const cp = Math.cos(pitch), step = (MODULE.L + 0.03) * cp, r0 = 2.3;
    const cuts = [X04 + 0.4, ...STRIPS.flatMap((o) => [X(o) - 0.75, X(o) + 0.75]), X12 - 0.4];
    for (const sl of [1, -1]) for (let k = 0; r0 + (k + 1) * step <= half - 0.3; k++) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(sl * pitch, 0, 0)).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2));
      const d = r0 + (k + 0.5) * step;
      for (let i = 0; i < cuts.length; i += 2) {
        const [a, b] = [cuts[i], cuts[i + 1]];
        const n = Math.floor((b - a + 0.02) / (MODULE.W + 0.02));
        const start = (a + b) / 2 - (n * (MODULE.W + 0.02) - 0.02) / 2 + MODULE.W / 2;
        for (let j = 0; j < n; j++) out.push({ m: new THREE.Matrix4().compose(V(start + j * (MODULE.W + 0.02), roofTopB(d) + 0.12, ZC + sl * d), q, V(1, 1, 1)), row: k, end: 0 });
      }
    }
    return out;
  }
  function fuelPanels() {
    const out = [];
    for (const [s, hs, p] of [[-1, halfN, pN], [1, halfS, pS]]) {
      const step = (MODULE.L + 0.03) * Math.cos(p), r0 = 0.45;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(s * p, 0, 0)).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2));
      const a = X01 + 0.2, b = X04 - 0.5;
      const n = Math.floor((b - a + 0.02) / (MODULE.W + 0.02));
      const start = (a + b) / 2 - (n * (MODULE.W + 0.02) - 0.02) / 2 + MODULE.W / 2;
      for (let k = 0; r0 + (k + 1) * step <= hs - 0.2; k++) {
        const d = r0 + (k + 0.5) * step, z = ZC + s * d;
        for (let j = 0; j < n; j++) out.push({ m: new THREE.Matrix4().compose(V(start + j * (MODULE.W + 0.02), fuelRoofH(z) + 0.32, z), q, V(1, 1, 1)), row: k, end: 0 });
      }
    }
    return out;
  }

  const stackPlume = plume(root, V(chim.x, CH_TOP + 0.5, chim.z), 80, { color: '#CBD5E1', size: 2.6, opacity: 0.28, life: 7, rise: 2.6, spread: 4, drift: [1.6, -0.6] });
  const envMats = Object.values(env);
  let transparentNow = false, castNow = true;
  return {
    roofs,
    anchors: {
      boilerHouse: V(BOILER.x, ridge + 2, BOILER.z), heaters: V(X(20.6), 6, ZC), chimney: V(chim.x, CH_TOP, chim.z),
      ashSilo: V(silo.x, 8, silo.z), fuelStore: V(FUEL.x, fr + 1, FUEL.z),
    },
    update(t, s) {
      const glow = s.utilityGlow;
      flameMats.forEach((m, i) => { m.emissiveIntensity = 0.6 + glow * (1.8 + 0.5 * Math.sin(t * 7.3 + i * 2) + 0.3 * Math.sin(t * 13.1 + i)); });
      stackPlume(t, 0.55 + 0.45 * glow);
      // cut-away: fade the cladding, roof and louvres (frames, floors and equipment stay)
      const c = s.boilerCutaway ?? 0;
      const op = 1 - 0.94 * c, transparent = op < 0.999;
      for (const m of envMats) {
        m.opacity = op;
        if (transparent !== transparentNow) { m.transparent = transparent; m.depthWrite = !transparent; m.needsUpdate = true; }
      }
      transparentNow = transparent;
      envGroup.visible = c < 0.985;
      lineMat.opacity = 0.85 * Math.sin(Math.min(1, c) * Math.PI / 2);
      outline.visible = c > 0.01;
      const cast = c < 0.5;
      if (cast !== castNow) { envGroup.traverse((o) => { if (o.isMesh) o.castShadow = cast; }); castNow = cast; return true; }
      return false;
    },
  };
}

// Tipper truck for the ash bay, cab toward +X (the material-exit gate).
function ashTruck(B, M, x, y, z, rise) {
  const bx = (x0, x1, y0, y1, w, mat) => boxR(B, mat, x + x0, x + x1, y + y0, y + y1, z - w / 2, z + w / 2, rise);
  bx(-3.4, 3.6, 0.7, 1.0, 1.0, M.carDark);
  bx(-3.4, 1.2, 1.0, 2.6, 2.4, M.yellow);
  bx(-3.3, 1.1, 1.05, 2.45, 2.1, M.biomass);
  bx(1.5, 3.6, 0.9, 3.0, 2.4, M.car);
  boxR(B, M.glass, x + 3.6, x + 3.64, y + 2.0, y + 2.8, z - 1.0, z + 1.0, rise, { cast: false });
  for (const wx of [-2.4, -1.2, 2.7]) for (const s of [-1, 1]) cyl(B, M.carDark, x + wx, y + 0.5, z + s * 1.05, 0.5, 0.4, 'z', rise, 0.5, 14);
}

// Wheel loader (front loader) moving agro-waste to the feed pits, bucket toward +X.
function wheelLoader(B, M, x, z, rise) {
  const bx = (x0, x1, y0, y1, w, mat) => boxR(B, mat, x + x0, x + x1, y0, y1, z - w / 2, z + w / 2, rise);
  bx(-2.2, 0.6, 0.6, 1.7, 2.0, M.yellow);
  bx(-1.6, -0.2, 1.7, 3.1, 1.5, M.yellow);
  bx(-1.5, -0.3, 2.1, 2.9, 1.52, M.glass);
  bx(0.6, 1.8, 0.7, 1.4, 1.8, M.yellow);
  beam(B, M.carDark, V(x + 1.0, 1.4, z), V(x + 2.6, 0.9, z), 1.4, 0.25, rise);
  bx(2.4, 3.3, 0.15, 1.2, 2.5, M.steelDark);
  for (const wx of [-1.5, 1.0]) for (const s of [-1, 1]) cyl(B, M.carDark, x + wx, 0.65, z + s * 1.0, 0.65, 0.5, 'z', rise, 0.65, 14);
}
