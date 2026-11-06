// Site layout transcribed from drawing PP-A-DR-SP-001-2525 R1 (site layout plan, "VU Final Layout Drawing water tank"):
// positions measured from the drawing's vector geometry, registered on the four surveyed boundary corners.
// Survey grid → world: X = E − 85, Z = 95 − N (metres). Plan numbers in comments.

export const BOUNDARY = [
  [-85.0, -65.94],   // N 160.94 / E 0.00
  [46.68, -91.53],   // N 186.53 / E 131.68  (30 m road frontage, CW-1 134.15 m)
  [85.45, 76.40],    // N 18.60  / E 170.45  (24 m road frontage, 172.36 m)
  [-76.32, 95.0],    // N 0.00   / E 8.68
];

// x, z = centre; w = size along X (east), d = along Z (south); h = height; ry = rotation (rad)
export const BUILDINGS = [
  { id: 'elec', label: 'Panel room', no: '16', x: 49.19, z: -22.94, w: 6.55, d: 11.5, h: 5.5, roof: 'roof', style: 'plain' },
  { id: 'canteen', label: 'Canteen', no: '24', x: -70.57, z: -50.25, w: 16.5, d: 8.0, h: 5, roof: 'roof', style: 'office' },
  { id: 'admin', label: 'Admin', no: '04', x: 37.24, z: -62.63, w: 12.23, d: 8.73, h: 8, roof: 'roofP1', style: 'office' },
  { id: 'sec1', label: 'Time office / security', no: '01', x: -58.35, z: -64.85, w: 7.85, d: 5.5, h: 3.6, roof: 'roof', style: 'plain' },
  { id: 'locker', label: 'Locker room', no: '01', x: -64.3, z: -62.3, w: 4.35, d: 10.59, h: 3.6, roof: 'roof', style: 'plain' },
  { id: 'sec2', label: 'Security', no: '02', x: 13.4, z: -78.95, w: 5.0, d: 4.5, h: 3.6, roof: 'roof', style: 'plain', ry: 0.2 },
  { id: 'toilet', label: 'Toilet block', no: '25', x: -82.7, z: -53.97, w: 3.0, d: 6.0, h: 3.2, roof: 'roof', style: 'plain' },
  { id: 'wbcabin', label: 'Weighbridge cabin', no: '18', x: -57.4, z: -46.7, w: 2.77, d: 5.27, h: 3.2, roof: 'roof', style: 'plain' },
  { id: 'firepump', label: 'Fire pump room', no: 'FW', x: 50.0, z: -58.05, w: 5.5, d: 11.0, h: 4.2, roof: 'roof', style: 'plain' },
  { id: 'filling', label: 'Filling station', no: '21', x: -60.84, z: 3.41, w: 9.5, d: 10.0, h: 6, roof: 'roof', style: 'canopy' },
];

// Warehouse-1 (11) from PP-A-WH-101-2525 R0 (older issue, adopted for now): grids A→E 30.0 c/c (30.23 o/o),
// 01→11 61.35 c/c (61.58 o/o). The site plan draws the shed 25.23 m wide with its 4.5 m dock platforms inside a
// 30 m envelope, so the shed keeps its east wall on the plan line and the docks stop at the edge of road R2.
export const WAREHOUSE1 = { id: 'wh1', x: -26.06, z: -18.2, w: 30.23, d: 61.58 };
export const WAREHOUSE_KEEPOUT = [{ x: -27.0, z: -18.2, w: 32.6, d: 62.4 }];
// Area for future expansion: the plot freed by Warehouse-2 plus the band between the plants / day tanks and the boiler
// house (formerly the 788 m² reserved pad, 26). L-shaped, bounded by the roads; empty lawn for now.
const FX_PARTS = [{ x0: -46.6, x1: -1.3, z0: 22.4, z1: 48.4 }, { x0: -1.3, x1: 51.6, z0: 22.4, z1: 40.9 }];
export const FUTURE_EXP = {
  x: 3.0, z: 33.0, parts: FX_PARTS,
  keepout: FX_PARTS.map((p) => ({ x: (p.x0 + p.x1) / 2, z: (p.z0 + p.z1) / 2, w: p.x1 - p.x0, d: p.z1 - p.z0 })),
};

// Plant 1 from PP-A-DR-PB1-102/104/301 (R0): grids 04→01 across (15.23 c/c), A→H along (33.0 c/c)
export const PLANT1 = { id: 'p1', x: 6.65, z: -17.66, w: 15.46, d: 33.23, h: 17.6 };  // 08: eaves +16.0, ridge ≈ +17.6
export const PLANT2 = { id: 'p2', x: 29.5, z: -25.3, w: 15.5, d: 47.83, h: 17.6 };   // 07 (same PEB envelope as Plant 1)
// Blender area (09): open-air pad like the day tanks — 11.27 × 26.56 plus a 4.96 × 15.23 extension to the east
export const BLENDER = { id: 'blender', x: 51.55, z: 0.91, w: 11.27, d: 26.56, annex: { x: 59.79, z: 6.58, w: 4.96, d: 15.23 },
  filtration: { x0: 46.05, x1: 51.05, z0: 3.95, z1: 13.95 }, walkway: { x0: 55.36, x1: 56.95, z0: -12.3, z1: 14.0 } };
// QA & QC / control room (05) — detailed model in qaqc.js; footprint incl. emergency stair + entrance canopy
export const QAQC = { x: 6.65, z: -44.4, w: 15.46, d: 9.0 };
export const QAQC_KEEPOUT = { x: 7.85, z: -44.5, w: 20.1, d: 10.6 };
export const DAYTANK = { x: 17.92, z: 9.56, w: 35.35, d: 9.4 };                      // 10
export const FG_FARM = { x: -65.5, z: -22.46, w: 19.3, d: 41.68 };                   // 13
export const RM_FARM = { x: -62.4, z: 27.85, w: 12.9, d: 38.86 };                    // 12
export const PESO = { x: -48.38, z: 70.13, w: 45.22, d: 27.66, pit: { x0: -58, x1: -25, z0: 61, z1: 83, depth: 5.2 } }; // 14
export const ETP = { x: -10.77, z: 68.06, w: 20, d: 23.5 };                          // 20
// Boiler house: fuel storage area (23) + boiler area (15) from PP-A-DR-UT-101 / 102 / 301-2525 R2 (22.10.2026), placed
// where the site plan draws it. Grids 01→04 (fuel store, 14.696 c/c) and 04→12 (boiler area, 48.251 c/c) run
// west → east; rows A→F (fuel store, 28.95) and A→E (boiler area, 23.464) north → south, row A shared.
// FFL ±0 = RL 99.10 (road RL 98.80).
const BH_GX = [0, 4.348, 10.348, 14.696, 21.348, 27.29, 34.001, 40.001, 45.474, 50.947, 56.947, 62.947];
const BH_GZ = { A: 0, B: 6.5, C: 11.732, D: 16.964, E: 23.464, F: 28.95 };
const BH_X0 = 3.32, BH_Z0 = 49.15, BH_OUT = 0.17;    // grid 01 / row A in world; outer face of the walls
export const BH = {
  gx: (n, off = 0) => BH_X0 + BH_GX[n - 1] + off,     // grid 01..12 → world X
  gz: (r, off = 0) => BH_Z0 + BH_GZ[r] + off,          // row A..F → world Z
  // levels (m): boiler pit RL 96.40, fuel-feed pits, +300 heater platforms, ash-silo yard RL 93.70,
  // dado / canopy, fuel store eave (truss btm) and ridge, boiler area eave (truss btm +19.25) and ridge
  lv: { pit: -2.7, feedPit: -1.945, sump: -3.153, deck: 0.3, yard: -5.4, dado: 2.5, canopy: 5.0,
    fuelEave: 7.0, fuelRidge: 9.25, eave: 19.25, ridge: 21.4 },
};
const outerBox = (x0, x1, z0, z1) => ({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 });
export const FUEL = outerBox(BH.gx(1) - BH_OUT, BH.gx(4) + BH_OUT, BH.gz('A') - BH_OUT, BH.gz('F') + BH_OUT);   // 23
export const BOILER = outerBox(BH.gx(4) - BH_OUT, BH.gx(12) + BH_OUT, BH.gz('A') - BH_OUT, BH.gz('E') + BH_OUT); // 15
// ash-silo yard east of grid 12, sunk to LVL -5.40; its east side follows the site boundary (1.2 m inside)
const eastBoundaryX = (z) => 46.68 + ((z + 91.53) / (76.40 + 91.53)) * (85.45 - 46.68);
export const ASH_YARD = { x0: BH.gx(12) + BH_OUT, z0: BH.gz('A', 3.9), z1: BH.gz('A', 25.0), east: (z) => eastBoundaryX(z) - 1.2 };
export const ASH_YARD_KEEPOUT = outerBox(ASH_YARD.x0, ASH_YARD.east(ASH_YARD.z1) + 1.0, ASH_YARD.z0, ASH_YARD.z1);
// hole cut in the ground / site pad over the sunken boiler area and the ash-silo yard (outer faces of the walls)
const [HX0, HX1, HZ0, HZ1] = [BH.gx(4) - BH_OUT, BH.gx(12) + BH_OUT, BH.gz('A') - BH_OUT, BH.gz('E') + BH_OUT];
export const BOILER_HOLE = [
  [HX0, HZ0], [HX1, HZ0], [HX1, ASH_YARD.z0], [ASH_YARD.east(ASH_YARD.z0), ASH_YARD.z0],
  [ASH_YARD.east(ASH_YARD.z1), ASH_YARD.z1], [HX1, ASH_YARD.z1], [HX1, HZ1], [HX0, HZ1],
];
export const COOLING = { x: 58.57, z: 31.74, w: 12, d: 16, h: 8.5 };                  // 22 (2,200 TR)
// Fire water: two above-ground tanks Ø8.74 (the drawing's third tank, which ran into the road, is dropped and the
// fire pump room — drawn outside the boundary — takes its place; see BUILDINGS 'firepump')
export const FIRE_TANKS = [{ x: 51.37, z: -47.54 }, { x: 50.5, z: -36.83 }];
export const FIRE_TANK = { d: 8.74, h: 7.0 };                                           // height assumed
// N2 generator skid (not on the drawing — assumed; between the admin block and the fire pump room)
export const N2GEN = { x: 45.4, z: -62.5, w: 3.4, d: 7.5 };
export const TRANSFORMER = { x: 41.47, z: -82.06, w: 14.7, d: 16.0, ry: 0.273 };       // 03 six-pole structure, TR & HT panel
// Former UG water tank (06) footprint, now a landscaped car park (the fire water is held in the two above-ground tanks)
export const PARK_NORTH = { x: -1.84, z: -68.2, w: 36.9, d: 13.9, ry: 0.192 };
// Tanker parking (27): paver yard between entry gate 2 and the UG tank, its north edge following the boundary
export const TANKER_PARK = { poly: [[-45.2, -73.0], [-21.8, -77.6], [-21.8, -59.0], [-45.2, -59.0]], x: -33.5, z: -67.5, w: 23.4, d: 18.6 };
// Car parking south of the UG tank (6 bays, stepped along the tank wall)
export const CAR_PARK = { poly: [[0, -62.6], [19.9, -66.4], [19.9, -56.6], [0, -56.6]], x: 10.0, z: -61.0, w: 19.9, d: 9.8,
  cars: [[1.7, -61.3], [4.6, -61.4], [7.6, -62.2], [10.5, -62.4], [13.6, -63.7], [16.5, -63.8]] };
// Two-wheeler stand (28) beside the gatehouse
export const BIKE_STAND = [{ x0: -82.3, x1: -70.5, z0: -65.2, z1: -61.0 }, { x0: -84.4, x1: -70.0, z0: -59.0, z1: -57.1 }];
export const WEIGHBRIDGE = { x: -52.2, z: -42.75, w: 3.4, d: 18.06 };                  // 17, 18.06 m platform
// Road tankers as drawn: [x, z of the rear, heading] — heading 'S' = cab to the south (+Z), 'N' = cab to the north
export const TANKERS = [
  [-41.2, -71.8, 'S'], [-36.2, -71.8, 'S'], [-31.1, -71.8, 'S'], [-26.0, -71.8, 'S'],   // parked in yard 27
  [-52.2, -16.0, 'N'], [-52.2, -0.5, 'N'],                                              // queued for the weighbridge
  [-52.45, 13.2, 'S'], [-52.45, 31.4, 'S'],                                             // along road R2, south
];

// Internal roads [x0, z0, x1, z1, width, noMarking] (axis-aligned, centre lines measured from the kerbs)
export const ROADS = [
  [-46.1, -53.4, 41.45, -53.4, 6],     // north ring road (ends at the road east of Plant 2)
  [-46.1, -53.4, -46.1, 18.95, 6.5],   // road R2 west of Warehouse-1
  [-52.0, -53.4, -52.0, 18.95, 5.1, true],   // weighbridge / tanker lane beside R2
  [-50.7, 18.95, -50.7, 51.8, 7.5],    // road R2 south part (7.5 m)
  [-6.1, -53.4, -6.1, 18.95, 6.5],     // WH-1 / Plant 1
  [18.1, -53.4, 18.1, 18.95, 5],       // Plant 1 / Plant 2 (clear of the QA/QC emergency stair)
  [41.45, -53.4, 41.45, 18.95, 6],     // east of Plant 2
  [-50.7, 18.95, 68.5, 18.95, 6.5],    // middle road (ends at the east boundary wall)
  [-50.7, 51.8, 2, 51.8, 6],           // south-west road
  [2, 44.35, 74.0, 44.35, 6],          // south-east road (ends at the east boundary wall)
  [2, 44.35, 2, 51.8, 6],
  [-49.9, -72.5, -49.9, -53.4, 9],     // entry gate 2 (9 m, sliding gate)
  [22.85, -87, 22.85, -53.4, 6],       // entry gate 1
];
// Gates out of the site, as on the drawing: entry gates 1 and 2 on the 30 m road (north boundary) and the material
// exit from the sunken ash-silo yard through the east boundary. The two internal roads that run to the east boundary
// end at the wall (stone pitching outside) — they are not gates.
// Each gate: centre on its wall line (x, z), ry (local x along the wall, local z into the site), clear opening, base level.
const onNorth = (x) => {
  const [[ax, az], [bx, bz]] = BOUNDARY;
  return { x, z: az + ((x - ax) / (bx - ax)) * (bz - az), ry: -Math.atan2(bz - az, bx - ax) };
};
const onYardEast = (z) => {
  const z0 = ASH_YARD.z0, z1 = ASH_YARD.z1;
  return { x: ASH_YARD.east(z), z, ry: -Math.atan2(z1 - z0, ASH_YARD.east(z1) - ASH_YARD.east(z0)) };
};
export const GATES = [
  { id: 'g1', no: 1, role: 'MAIN ENTRY', ...onNorth(22.85), open: 8.0, wings: true },
  { id: 'g2', no: 2, role: 'TANKER & MATERIAL ENTRY', ...onNorth(-49.9), open: 10.0, wings: true },
  { id: 'g3', no: 3, role: 'MATERIAL EXIT', ...onYardEast(BH.gz('A', 18.4)), open: 6.0, base: BH.lv.yard, closed: true },
];

// Plant 1 equipment, drawing coordinates: x east of grid 04, y north of grid A (m).
// World: X = PLANT1.x − 15.23/2 + x,  Z = PLANT1.z + 33.0/2 − y.
export const p1World = (x, y) => [PLANT1.x - 15.23 / 2 + x, PLANT1.z + 33.0 / 2 - y];
// Reactors P1-R-101…110 (MEZZ-1/2 plans); service allocation from the capabilities deck (slide 3)
const P1R = [
  ['P1-R-101', 4.0, 26.0, 16, 'polyester'], ['P1-R-102', 4.0, 21.4, 16, 'polyester'], ['P1-R-103', 4.0, 16.3, 16, 'polyester'],
  ['P1-R-104', 4.0, 11.1, 16, 'polyester'], ['P1-R-105', 4.0, 6.3, 16, 'polyester', true],
  ['P1-R-110', 11.2, 26.0, 16, 'alkyd'], ['P1-R-109', 11.2, 21.4, 16, 'alkyd'], ['P1-R-108', 11.2, 15.9, 16, 'alkyd'],
  ['P1-R-107', 11.2, 11.1, 10, 'alkyd'], ['P1-R-106', 11.2, 6.3, 6, 'epoxy'],
];
export const P1_REACTORS = P1R.map(([tag, px, py, kl, line, hero]) => {
  const [x, z] = p1World(px, py);
  // charging silo sits ~1.8 m north of each reactor (MEZZ-2 plan)
  const [sx, sz] = p1World(px + 0.2, py + 1.8);
  return { tag, x, z, kl, line, hero: !!hero, silo: { x: sx, z: sz } };
});
// Collection tanks P1-CLT-101…110 (4 t, supported at +3.40) and receivers P1-REC-101…110 (2 t, at +7.50)
export const P1_CLT = [24.9, 22.6, 18.1, 13.1, 8.1].flatMap((y) => [p1World(1.94, y), p1World(13.36, y)]);
export const P1_REC = [[2.3, 28.3], [2.3, 23.8], [2.3, 18.8], [2.3, 13.5], [2.3, 8.7],
  [12.9, 28.2], [12.9, 24.3], [12.9, 18.9], [12.9, 13.7], [12.9, 8.8]].map(([x, y]) => p1World(x, y));
// Openings / cores in plan (drawing coords): x0, y0, x1, y1
export const P1_CORES = {
  stairSW: [0.4, 0.4, 3.8, 3.9], stairNE: [9.6, 29.1, 14.8, 32.6], lift: [11.1, 0.1, 13.9, 3.9], cutout: [2.5, 29.1, 5.5, 32.6],
};
export const PLANT_LEVELS = { mezz1: 3.4, support: 5.0, mezz2: 7.5, top: 11.5, crane: 14.0, eave: 16.0, ridge: 17.6 };

export const P2_REACTORS = [
  { x: 25.6, z: -45.5, kl: 10, line: 'polyamide' }, { x: 25.6, z: -40.5, kl: 10, line: 'polyamide' },
  { x: 25.6, z: -35.5, kl: 10, line: 'polyamide' }, { x: 25.6, z: -30.5, kl: 10, line: 'polyamide' },
  { x: 25.6, z: -25.5, kl: 10, line: 'powder' }, { x: 25.6, z: -20.5, kl: 10, line: 'powder' },
  { x: 33.4, z: -45.5, kl: 10, line: 'powder' }, { x: 33.4, z: -40.5, kl: 6, line: 'acrylic' },
  { x: 33.4, z: -35.5, kl: 6, line: 'acrylic' }, { x: 33.4, z: -30.5, kl: 4, line: 'acrylic' },
  { x: 33.4, z: -25.5, kl: 16, line: 'phenolic' }, { x: 33.4, z: -20.5, kl: 2, line: 'rnd' },
];

// Finished-goods tanks (slide 9): service, count, KL each → 22 tanks, ~1,045 KL
export const FG_TANKS = [
  { service: 'polyester', n: 6, kl: 80, color: '#00A3E0' },
  { service: 'alkyd', n: 6, kl: 56.7, color: '#F59E0B' },
  { service: 'general', n: 2, kl: 42.5, color: '#38BDF8' },
  { service: 'polyamide', n: 3, kl: 20, color: '#4ADE80' },
  { service: 'smalllot', n: 3, kl: 20, color: '#A78BFA' },
  { service: 'cardanol', n: 2, kl: 10, color: '#FB923C' },
];

// Blenders BL-01…12 as drawn in the blender area (09): [tag, x, z, KL, Ø]. BL-01…05 are the SS polyester blenders
// (160 KL, matching the capabilities deck, slide 9); BL-06…12 MS alkyd.
export const BLENDERS = [
  ['BL-01', 53.44, 10.49, 50, 3.7], ['BL-02', 53.44, 5.87, 50, 3.7], ['BL-03', 53.54, 1.64, 20, 2.8],
  ['BL-04', 53.54, -2.08, 20, 2.8], ['BL-05', 53.54, -5.9, 20, 2.8], ['BL-06', 53.54, -9.64, 25, 2.9],
  ['BL-07', 58.82, 10.49, 25, 2.9], ['BL-08', 58.82, 5.87, 25, 2.9], ['BL-09', 48.05, 1.9, 25, 2.9],
  ['BL-10', 48.67, -2.92, 25, 2.9], ['BL-11', 48.6, -7.6, 25, 2.9], ['BL-12', 48.49, -10.67, 10, 1.9],
].map(([tag, x, z, kl, d], i) => ({ tag, x, z, kl, d, ss: i < 5 }));

export function insideBoundary(x, z, margin = 0) {
  // convex quad test with inward margin
  const P = BOUNDARY;
  for (let i = 0; i < 4; i++) {
    const [ax, az] = P[i], [bx, bz] = P[(i + 1) % 4];
    const ex = bx - ax, ez = bz - az;
    const len = Math.hypot(ex, ez);
    const cross = (ex * (z - az) - ez * (x - ax)) / len;
    if (cross < margin) return false;
  }
  return true;
}
