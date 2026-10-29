// Site layout transcribed from drawing PP-A-DR-SP-001-2525 R2 (site plan, 28.10.2026).
// Survey grid → world: X = E − 85, Z = 95 − N (metres). Plan numbers in comments.

export const BOUNDARY = [
  [-85.0, -65.94],   // N 160.94 / E 0.00
  [46.68, -91.53],   // N 186.53 / E 131.68  (30 m road frontage, CW-1 134.15 m)
  [85.45, 76.40],    // N 18.60  / E 170.45  (24 m road frontage, 172.36 m)
  [-76.32, 95.0],    // N 0.00   / E 8.68
];

// x, z = centre; w = size along X (east), d = along Z (south); h = height
export const BUILDINGS = [
  { id: 'elec', label: 'Electrical substation', no: '16', x: 48.6, z: -22.6, w: 6.55, d: 11.5, h: 5.5, roof: 'roof', style: 'plain' },
  { id: 'canteen', label: 'Canteen', no: '24', x: -70.8, z: -49.8, w: 16.5, d: 8.0, h: 5, roof: 'roof', style: 'office' },
  { id: 'admin', label: 'Admin', no: '04', x: 37.7, z: -62.4, w: 12.23, d: 8.73, h: 8, roof: 'roofP1', style: 'office' },
  { id: 'sec1', label: 'Security', no: '01', x: -63.7, z: -62.9, w: 7.85, d: 5.46, h: 3.6, roof: 'roof', style: 'plain' },
  { id: 'sec2', label: 'Security', no: '02', x: 12.6, z: -80.9, w: 5.0, d: 4.5, h: 3.6, roof: 'roof', style: 'plain' },
  { id: 'locker', label: 'Locker room', no: '28', x: -76.0, z: -58.5, w: 4.35, d: 10.59, h: 3.6, roof: 'roof', style: 'plain' },
  { id: 'filling', label: 'Filling station', no: '21', x: -60.5, z: 3.6, w: 9.5, d: 10.0, h: 6, roof: 'roof', style: 'canopy' },
];

// Warehouse-1 (11) from PP-A-WH-101-2525 R0 (older issue, adopted for now): grids A→E 30.0 c/c (30.23 o/o),
// 01→11 61.35 c/c (61.58 o/o). The drawing is 5 m wider than the site plan's 25.23 m, so the shed keeps its
// east wall on the plan line and grows west towards road R2 (docks stop 0.1 m short of the road edge).
export const WAREHOUSE1 = { id: 'wh1', x: -26.2, z: -17.6, w: 30.23, d: 61.58 };
// Warehouse-2 (19): no drawing yet — assumed PEB shed on the site-plan footprint, ridge running east–west
// (w = span along Z, d = length along X).
export const WAREHOUSE2 = { id: 'wh2', x: -25.2, z: 35.8, w: 23.5, d: 39.5 };
export const WAREHOUSE_KEEPOUT = [{ x: -32.3, z: -17.6, w: 42.6, d: 62.4 }, { x: -25.2, z: 35.8, w: 40.5, d: 25.5 }];

// Plant 1 from PP-A-DR-PB1-102/104/301 (R0): grids 04→01 across (15.23 c/c), A→H along (33.0 c/c)
export const PLANT1 = { id: 'p1', x: 6.1, z: -17.6, w: 15.46, d: 33.23, h: 17.6 };   // 08: eaves +16.0, ridge ≈ +17.6
export const PLANT2 = { id: 'p2', x: 29.5, z: -25.3, w: 15.5, d: 47.83, h: 17.6 };   // 07 (same PEB envelope as Plant 1)
export const BLENDER = { id: 'blender', x: 52.9, z: 1.4, w: 16.2, d: 26.5, h: 12 };  // 09
// QA & QC / control room (05) — detailed model in qaqc.js; footprint incl. emergency stair + entrance canopy
export const QAQC = { x: 6.1, z: -44.0, w: 15.46, d: 9.0 };
export const QAQC_KEEPOUT = { x: 7.3, z: -44.1, w: 20.1, d: 10.6 };
export const DAYTANK = { x: 17.5, z: 10.2, w: 34.23, d: 9.25 };                      // 10
export const FG_FARM = { x: -65.9, z: -21.5, w: 19.3, d: 41.68 };                    // 13
export const RM_FARM = { x: -63.2, z: 28.2, w: 12.9, d: 38.86 };                     // 12
export const PESO = { x: -48.5, z: 70.1, w: 45.22, d: 27.66, pit: { x0: -58, x1: -25, z0: 61, z1: 83, depth: 5.2 } }; // 14
export const ETP = { x: -11.4, z: 69.0, w: 20, d: 23.5 };                            // 20
export const FUEL = { x: 10.4, z: 65.2, w: 15.23, d: 29.18 };                        // 23
export const BOILER = { x: 42.0, z: 61.4, w: 47.95, d: 23.6 };                       // boiler area
export const COOLING = { x: 57.9, z: 32.0, w: 12, d: 16, h: 8.5 };                   // 22 (2,200 TR)
export const FUTURE = { x: 23.0, z: 32.0, w: 49.25, d: 16 };                         // 26, 788 m² reserved
export const N2GEN = { x: 46.0, z: -40.0, w: 6, d: 8 };
export const TRANSFORMER = { x: 37.7, z: -79.8, w: 14, d: 14 };                      // 03 six-pole structure
export const UG_WATER = { x: -1.6, z: -68.4, w: 36.9, d: 13.9, ry: 0.192 };          // 06
export const PARKING = { x: -34.3, z: -65.6, w: 22, d: 12, ry: 0.192 };              // 27
export const WEIGHBRIDGE = { x: -53.0, z: -40.6, w: 3.5, d: 18 };                    // 18

// Internal roads [x0, z0, x1, z1, width] (axis-aligned)
export const ROADS = [
  [-51, -54, 52, -54, 6],      // north ring road
  [-48, -54, -48, 50.8, 6],    // west road
  [-6.5, -54, -6.5, 17.8, 6],  // WH-1 / Plant 1
  [18.4, -54, 18.4, 17.8, 5],  // Plant 1 / Plant 2 (clear of the QA/QC emergency stair)
  [41.5, -54, 41.5, 17.8, 6],  // east of Plant 2
  [-51, 17.8, 72, 17.8, 6],    // middle road → material exit
  [-51, 50.8, 2, 50.8, 6],     // south-west road
  [2, 44, 78, 44, 6],          // south-east road → material exit
  [2, 44, 2, 50.8, 6],
  [-51, -72.5, -51, -54, 9],   // entry gate 2 (9 m)
  [23.5, -87, 23.5, -54, 6],   // entry gate 1
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

// Blenders (slide 9): 5 SS polyester (160 KL), 6 MS alkyd P1 (210 KL), 1 MS alkyd P2 (10 KL)
export const BLENDERS = [
  ...Array.from({ length: 5 }, () => ({ kl: 32, ss: true })),
  ...Array.from({ length: 6 }, () => ({ kl: 35, ss: false })),
  { kl: 10, ss: false },
];

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
