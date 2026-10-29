// QA & QC / control-room building (site plan item 05), modelled from drawings
// PP-A-DR-QC-101/102/103 (GF/FF/SF plans), QC-201 (elevations) and QC-301 (sections), rev R2 21.10.2026.
//
// Local frame: u runs east from grid A, v runs north from grid 01 (metres, grid centre lines).
// Grids  A 0 · B 3.29 · C 9.29 · D 15.23      01 0 · 1A 3.6 · 02 4.915 · 2A 6.52 · 03 8.77
// Levels (FFL ±0 is 300 mm above finished ground): GF 0 · FF +4.5 · SF +9.0 · terrace +13.5 ·
//        stair cabin +16.6 · parapets 900 mm · window sill +1.0 / lintel +2.5 per floor.
import * as THREE from 'three';
import { Batcher, patchRise, makeMat } from './materials.js';
import { riseDelay } from './site.js';
import { QAQC } from './layout.js';

const CX = QAQC.x, CZ = QAQC.z;            // footprint centre on the site plan
const AX = CX - 15.23 / 2, Z01 = CZ + 8.77 / 2;
const PL = 0.3;                             // plinth: FFL above site grade
const U = { A: 0, B: 3.29, C: 9.29, D: 15.23 };
const V = { '01': 0, '1A': 3.6, '02': 4.915, '2A': 6.52, '03': 8.77 };
const FLOORS = [0, 4.5, 9.0];
const TERR = 13.5, CABIN = 16.6, PARAPET = 0.9;
const T = 0.23, HT = T / 2;                 // wall thickness
const WIN_U = [4.53, 7.66, 10.5, 13.64];    // W 1500×1500 centres on the north and south faces

// local (u, v, y) box → world box on a batcher
function lbox(B, mat, u0, v0, u1, v1, y0, y1, rise, opts) {
  const ua = Math.min(u0, u1), ub = Math.max(u0, u1), va = Math.min(v0, v1), vb = Math.max(v0, v1);
  B.box(mat, AX + (ua + ub) / 2, PL + (y0 + y1) / 2, Z01 - (va + vb) / 2, ub - ua, y1 - y0, vb - va, rise, opts);
}

function gradientTexture(top, bottom) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, top); grd.addColorStop(1, bottom);
  g.fillStyle = grd; g.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Window on an exterior face. face: 'S' | 'N' | 'W' | 'E'; c = centre along the face; y0/y1 = sill/lintel.
function windowOn(B, mats, face, c, w, y0, y1, rise) {
  const out = { S: [-HT, -1], N: [V['03'] + HT, 1], W: [-HT, -1], E: [U.D + HT, 1] }[face];
  const [plane, dir] = out;
  const alongU = face === 'S' || face === 'N';
  const put = (mat, along0, along1, ya, yb, d0, d1) => {
    const a0 = plane + dir * d0, a1 = plane + dir * d1;
    if (alongU) lbox(B, mat, along0, a0, along1, a1, ya, yb, rise, { cast: false });
    else lbox(B, mat, a0, along0, a1, along1, ya, yb, rise, { cast: false });
  };
  put(mats.frame, c - w / 2 - 0.06, c + w / 2 + 0.06, y0 - 0.06, y1 + 0.06, 0, 0.05);
  put(mats.glass, c - w / 2, c + w / 2, y0, y1, 0, 0.07);
  put(mats.frame, c - 0.025, c + 0.025, y0, y1, 0, 0.09);
  put(mats.sill, c - w / 2 - 0.12, c + w / 2 + 0.12, y0 - 0.1, y0 - 0.02, 0, 0.16);
}

// Straight stair flight with treads: from (u, v0, y0) rising to y1 at v1, width along u.
function flight(B, mat, treadMat, u0, u1, v0, v1, y0, y1, rise, n) {
  const run = v1 - v0, h = y1 - y0;
  for (let i = 0; i < n; i++) {
    const va = v0 + (run * i) / n, vb = v0 + (run * (i + 1)) / n;
    const y = y0 + (h * (i + 1)) / n;
    lbox(B, treadMat, u0, va, u1, vb, y - 0.05, y, rise);
  }
  // stringers
  const len = Math.hypot(run, h), ang = Math.atan2(h, Math.abs(run));
  for (const u of [u0, u1]) {
    const geo = new THREE.BoxGeometry(0.08, 0.28, len);
    const x = AX + u, z = Z01 - (v0 + v1) / 2, y = PL + (y0 + y1) / 2 - 0.12;
    B.mesh(geo, mat, [x, y, z], [Math.sign(run) * ang, 0, 0], [1, 1, 1], rise);
  }
}

export function buildQaqc(world, M) {
  const root = new THREE.Group();
  world.scene.add(root);
  const rise = riseDelay(CX, CZ);

  // ---------------------------------------------------------------- materials
  const fade = (m) => patchRise(m);
  const shellMats = {
    panel: fade(makeMat({ color: '#E3E9EF', roughness: 0.85 })),
    frame: fade(makeMat({ color: '#9AA9BB', roughness: 0.7 })),
    sill: fade(makeMat({ color: '#C3CED9', roughness: 0.8 })),
    glass: fade(makeMat({ color: '#4C87B2', emissive: '#0E3A5A', emissiveIntensity: 0.45, roughness: 0.15, metalness: 0.3 })),
    curtain: fade(makeMat({ color: '#FFFFFF', map: gradientTexture('#2E6E8E', '#A9DAF0'), emissive: '#0B3550', emissiveIntensity: 0.35, roughness: 0.1, transparent: true, opacity: 0.62, depthWrite: false })),
    mullion: fade(makeMat({ color: '#334155', roughness: 0.5, metalness: 0.4 })),
    coping: fade(makeMat({ color: '#8C9DB0', roughness: 0.7 })),
    door: fade(makeMat({ color: '#1E3A52', emissive: '#0E3A5A', emissiveIntensity: 0.3, roughness: 0.2, metalness: 0.3 })),
    louver: fade(makeMat({ color: '#475569', roughness: 0.6, metalness: 0.3 })),
  };
  const mats = {
    concrete: M.concreteLight, steel: M.steelDark, pipe: M.pipe,
    slab: patchRise(makeMat({ color: '#B4C1CF', roughness: 0.9 })),
    partition: patchRise(makeMat({ color: '#D5DEE8', roughness: 0.9 })),
    benchTop: patchRise(makeMat({ color: '#F1F5F9', roughness: 0.6 })),
    benchBase: patchRise(makeMat({ color: '#64748B', roughness: 0.7 })),
    tread: patchRise(makeMat({ color: '#94A3B8', roughness: 0.6, metalness: 0.4 })),
    equip: patchRise(makeMat({ color: '#CBD5E1', roughness: 0.4, metalness: 0.4 })),
    dark: patchRise(makeMat({ color: '#1E293B', roughness: 0.5, metalness: 0.3 })),
    screen: patchRise(makeMat({ color: '#0B2545', emissive: '#38BDF8', emissiveIntensity: 1.6 })),
    hood: patchRise(makeMat({ color: '#FDE68A', emissive: '#FBBF24', emissiveIntensity: 0.9 })),
    uv: patchRise(makeMat({ color: '#7C3AED', emissive: '#A78BFA', emissiveIntensity: 1.4 })),
    led: patchRise(makeMat({ color: '#16A34A', emissive: '#22C55E', emissiveIntensity: 2.0 })),
    mesh: patchRise(makeMat({ color: '#94A3B8', roughness: 0.6, metalness: 0.3, transparent: true, opacity: 0.3, depthWrite: false })),
  };

  const SB = new Batcher();   // envelope: fades in cutaway
  const CB = new Batcher();   // always visible: base, main stair (seen through the curtain wall), emergency stair
  const RB = new Batcher();   // rooms: slabs, partitions, benches, equipment (shown in cutaway)

  // ---------------------------------------------------------------- base, entrance, steps
  lbox(CB, mats.concrete, -0.45, -0.45, U.D + 0.45, V['03'] + 0.45, -PL, 0, -1, { cast: false });
  lbox(CB, mats.concrete, -1.9, 5.2, -0.45, 7.6, -PL, -0.15, -1, { cast: false });   // entrance steps (west)
  lbox(CB, mats.concrete, -1.35, 5.2, -0.45, 7.6, -0.15, 0, -1, { cast: false });

  // ---------------------------------------------------------------- envelope
  const W0 = -HT, W1 = U.D + HT, S0 = -HT, N1 = V['03'] + HT;
  // A–B bay rises to the stair cabin; B–D block stops at the terrace
  lbox(SB, shellMats.panel, W0, S0, W1, S0 + T, 0, TERR, rise);                       // south wall (B–D)
  lbox(SB, shellMats.panel, W0, N1 - T, W1, N1, 0, TERR, rise);                       // north wall
  lbox(SB, shellMats.panel, W1 - T, S0, W1, N1, 0, TERR, rise);                       // east wall
  lbox(SB, shellMats.panel, W0, S0, W0 + T, N1, 0, CABIN, rise);                      // west wall (full height)
  lbox(SB, shellMats.panel, U.B - HT, S0, U.B + HT, N1, TERR, CABIN, rise);           // cabin east wall above terrace
  lbox(SB, shellMats.panel, W0, N1 - T, U.B + HT, N1, TERR, CABIN, rise);             // cabin north wall
  lbox(SB, shellMats.panel, W0, S0, U.B + HT, S0 + T, 0, 2.27, rise);                 // south A–B below curtain wall
  lbox(SB, shellMats.panel, W0, S0, U.B + HT, S0 + T, 15.93, CABIN, rise);            // band above curtain wall
  // terrace + cabin roof slabs, parapets with coping
  lbox(SB, shellMats.frame, U.B, S0, W1, N1, TERR - 0.2, TERR, rise);
  lbox(SB, shellMats.frame, W0, S0, U.B + HT, N1, CABIN - 0.2, CABIN, rise);
  const parapet = (u0, v0, u1, v1, y) => {
    lbox(SB, shellMats.panel, u0, v0, u1, v1, y, y + PARAPET, rise);
    lbox(SB, shellMats.coping, u0 - 0.04, v0 - 0.04, u1 + 0.04, v1 + 0.04, y + PARAPET, y + PARAPET + 0.06, rise);
  };
  parapet(U.B, S0, W1, S0 + 0.15, TERR);
  parapet(U.B, N1 - 0.15, W1, N1, TERR);
  parapet(W1 - 0.15, S0, W1, N1, TERR);
  parapet(W0, S0, U.B + HT, S0 + 0.15, CABIN);
  parapet(W0, N1 - 0.15, U.B + HT, N1, CABIN);
  parapet(W0, S0, W0 + 0.15, N1, CABIN);
  parapet(U.B - 0.05, S0, U.B + HT, N1, CABIN);

  // RCC frame expressed on the facades: columns at grid lines, slab bands at each floor
  const colTop = (u) => (u <= U.B ? CABIN + PARAPET : TERR + PARAPET);
  for (const u of [U.A, U.B, U.C, U.D]) for (const v of [V['01'], V['03']]) {
    lbox(SB, shellMats.frame, u - 0.23, v - 0.22, u + 0.23, v + 0.22, 0, colTop(u), rise);
  }
  for (const v of [V['02']]) for (const u of [U.A, U.D]) lbox(SB, shellMats.frame, u - 0.22, v - 0.23, u + 0.22, v + 0.23, 0, colTop(u), rise);
  for (const y of [FLOORS[1], FLOORS[2], TERR]) {
    lbox(SB, shellMats.frame, W0 - 0.08, S0 - 0.08, W1 + 0.08, S0 + 0.05, y - 0.3, y + 0.15, rise);
    lbox(SB, shellMats.frame, W0 - 0.08, N1 - 0.05, W1 + 0.08, N1 + 0.08, y - 0.3, y + 0.15, rise);
    lbox(SB, shellMats.frame, W1 - 0.05, S0, W1 + 0.08, N1, y - 0.3, y + 0.15, rise);
    lbox(SB, shellMats.frame, W0 - 0.08, S0, W0 + 0.05, N1, y - 0.3, y + 0.15, rise);
  }
  lbox(SB, shellMats.frame, W0 - 0.08, S0 - 0.08, U.B + HT + 0.08, N1 + 0.08, CABIN - 0.3, CABIN + 0.1, rise);

  // windows: W 1500×1500 (sill +1.0, lintel +2.5) ×4 per floor on north and south faces
  for (const f of FLOORS) for (const u of WIN_U) {
    windowOn(SB, shellMats, 'S', u, 1.5, f + 1.0, f + 2.5, rise);
    windowOn(SB, shellMats, 'N', u, 1.5, f + 1.0, f + 2.5, rise);
  }
  // east face: control-room / lab windows (v≈2.1) and windows opening onto the emergency stair (v≈6.3)
  for (const f of FLOORS) {
    windowOn(SB, shellMats, 'E', 2.1, 1.5, f + 1.0, f + 2.5, rise);
    windowOn(SB, shellMats, 'E', 6.3, 1.5, f + 1.0, f + 2.5, rise);
    lbox(SB, shellMats.door, U.D + HT, 3.95, U.D + HT + 0.06, 4.75, f, f + 2.5, rise, { cast: false });   // ED door
  }
  // west face: W1 900×1500 at FF/SF landings, cabin window, entrance doors + canopy, chajjas
  for (const f of [FLOORS[1], FLOORS[2]]) {
    windowOn(SB, shellMats, 'W', 5.9, 0.9, f + 1.0, f + 2.5, rise);
    lbox(SB, shellMats.frame, W0 - 0.65, 5.15, W0, 6.65, f + 2.55, f + 2.67, rise);
  }
  windowOn(SB, shellMats, 'W', 5.9, 0.9, 14.4, 15.9, rise);
  lbox(SB, shellMats.door, W0 - 0.06, 5.5, W0, 7.3, 0, 2.5, rise, { cast: false });
  lbox(SB, shellMats.mullion, W0 - 0.08, 6.38, W0, 6.42, 0, 2.5, rise, { cast: false });
  lbox(SB, shellMats.frame, W0 - 1.35, 4.75, W0, 8.95, 2.5, 2.68, rise);                 // entrance canopy at lintel
  // north face: toilet ventilators V 600×600 (sill +1.9) and the shaft grille
  for (const f of [...FLOORS, TERR]) windowOn(SB, shellMats, 'N', 0.72, 0.6, f + 1.9, f + 2.5, rise);
  for (let y = 0.4; y < CABIN - 0.4; y += 0.32) lbox(SB, shellMats.louver, 1.62, N1, 3.1, N1 + 0.07, y, y + 0.12, rise, { cast: false });
  // terrace door from the stair cabin
  lbox(SB, shellMats.door, U.B + HT, 1.6, U.B + HT + 0.06, 2.6, TERR, TERR + 2.5, rise, { cast: false });

  // glass curtain wall on the A–B bay south face (+2.27 … +15.93) with mullion grid
  const cw0 = 0.18, cw1 = U.B - 0.18, cy0 = 2.27, cy1 = 15.93;
  lbox(SB, shellMats.curtain, cw0, S0 - 0.08, cw1, S0 - 0.02, cy0, cy1, rise, { cast: false });
  for (let k = 0; k <= 3; k++) lbox(SB, shellMats.mullion, cw0 + (k * (cw1 - cw0)) / 3 - 0.03, S0 - 0.12, cw0 + (k * (cw1 - cw0)) / 3 + 0.03, S0 - 0.02, cy0, cy1, rise, { cast: false });
  for (let k = 0; k <= 13; k++) { const y = cy0 + (k * (cy1 - cy0)) / 13; lbox(SB, shellMats.mullion, cw0, S0 - 0.12, cw1, S0 - 0.02, y - 0.03, y + 0.03, rise, { cast: false }); }

  // terrace: lab fume-hood exhaust stack (section 1-1) and rainwater spouts
  lbox(SB, shellMats.frame, 6.4, 6.7, 7.4, 7.6, TERR, 16.4, rise);
  lbox(SB, shellMats.coping, 6.25, 6.55, 7.55, 7.75, 16.4, 16.55, rise);
  for (const u of [5.0, 12.0]) lbox(SB, shellMats.mullion, u, S0 - 0.35, u + 0.12, S0, TERR + 0.1, TERR + 0.25, rise);

  // ---------------------------------------------------------------- emergency stair (east, grids 1A–03)
  const E0 = U.D + HT, E1 = E0 + 2.0, ES0 = V['1A'], ES1 = 9.25, EROOF = 11.7;
  for (const [u, v] of [[E0 + 0.1, ES0 + 0.1], [E1 - 0.1, ES0 + 0.1], [E0 + 0.1, ES1 - 0.1], [E1 - 0.1, ES1 - 0.1]]) lbox(CB, mats.steel, u - 0.1, v - 0.1, u + 0.1, v + 0.1, -PL, EROOF, rise);
  lbox(CB, shellMats.frame, E0 - 0.05, ES0 - 0.1, E1 + 0.1, ES1 + 0.1, EROOF, EROOF + 0.2, rise);
  const um = (E0 + E1) / 2;
  for (const base of [0, 4.5]) {
    flight(CB, mats.steel, mats.tread, E0 + 0.05, um - 0.02, 4.9, 8.55, base, base + 2.25, rise, 13);
    lbox(CB, mats.tread, E0 + 0.05, 8.55, E1 - 0.05, ES1 - 0.05, base + 2.2, base + 2.25, rise);
    flight(CB, mats.steel, mats.tread, um + 0.02, E1 - 0.05, 8.55, 4.9, base + 2.25, base + 4.5, rise, 13);
    lbox(CB, mats.tread, E0 + 0.05, ES0 + 0.05, E1 - 0.05, 4.9, base + 4.45, base + 4.5, rise);
  }
  for (const y of [1.0, 2.25 + 1.0, 4.5 + 1.0, 6.75 + 1.0, 9.0 + 1.0]) lbox(CB, M.yellow, E1 - 0.04, ES0, E1, ES1, y, y + 0.05, rise, { cast: false });
  lbox(CB, mats.mesh, E1 - 0.02, ES0, E1 + 0.02, ES1, 0.2, EROOF - 0.1, rise, { cast: false });
  lbox(CB, mats.mesh, E0, ES1 - 0.02, E1, ES1 + 0.02, 0.2, EROOF - 0.1, rise, { cast: false });

  // ---------------------------------------------------------------- main stair (A–B bay) — seen through the curtain wall
  for (const base of [0, 4.5, 9.0]) {
    flight(CB, mats.steel, mats.tread, 1.75, 3.1, 4.4, 0.95, base, base + 2.25, rise, 13);
    lbox(CB, mats.slab, 0.15, 0.12, 3.15, 0.95, base + 2.1, base + 2.25, rise);
    flight(CB, mats.steel, mats.tread, 0.15, 1.55, 0.95, 4.4, base + 2.25, base + 4.5, rise, 13);
    lbox(CB, M.yellow, 1.6, 0.95, 1.7, 4.4, base + 1.0, base + 3.4, rise, { cast: false });   // central handrail screen
  }

  // ---------------------------------------------------------------- rooms (cutaway)
  // slabs at FF and SF with the stair well left open; lift core runs full height
  for (const f of [FLOORS[1], FLOORS[2]]) {
    lbox(RB, mats.slab, U.B, 0, U.D, V['03'], f - 0.2, f, rise);
    lbox(RB, mats.slab, 0, 4.4, U.B, V['03'], f - 0.2, f, rise);
  }
  lbox(RB, mats.concrete, 1.64, 6.42, 3.12, 7.94, 0, CABIN, rise);
  const H = 3.05, PT = 0.12;
  const wall = (f, u0, v0, u1, v1) => lbox(RB, mats.partition, u0 - (u0 === u1 ? PT / 2 : 0), v0 - (v0 === v1 ? PT / 2 : 0), u1 + (u0 === u1 ? PT / 2 : 0), v1 + (v0 === v1 ? PT / 2 : 0), f, f + H, rise);
  const bench = (f, u0, v0, u1, v1, h = 0.9) => {
    lbox(RB, mats.benchBase, u0 + 0.04, v0 + 0.04, u1 - 0.04, v1 - 0.04, f, f + h - 0.05, rise);
    lbox(RB, mats.benchTop, u0, v0, u1, v1, f + h - 0.05, f + h, rise);
  };
  const box = (f, mat, u0, v0, u1, v1, y0, y1) => lbox(RB, mat, u0, v0, u1, v1, f + y0, f + y1, rise);

  // common core on every floor: toilet/lift partitions
  for (const f of FLOORS) {
    wall(f, 0, 6.3, 0.9, 6.3); wall(f, 1.5, 6.3, U.B, 6.3);
    wall(f, 1.44, 6.3, 1.44, V['03']);
    wall(f, U.B, 0, U.B, 4.4);
  }

  // GF — central control room, pantry, engineers / shift office, server & UPS room
  const g = FLOORS[0];
  wall(g, U.B, 6.35, 4.2, 6.35); wall(g, 5.1, 6.35, 6.0, 6.35); wall(g, 6.9, 6.35, 11.24, 6.35);
  wall(g, 5.8, 6.35, 5.8, V['03']); wall(g, 11.24, 4.9, 11.24, V['03']);
  wall(g, U.B, 4.9, 9.85, 4.9); wall(g, 10.75, 4.9, 11.6, 4.9); wall(g, 12.5, 4.9, U.D, 4.9);
  bench(g, 3.45, 8.05, 5.65, 8.65);                                                    // pantry counter
  for (let k = 0; k < 4; k++) {                                                        // engineers' desks
    const u = 6.3 + k * 1.2;
    bench(g, u, 7.6, u + 1.0, 8.4, 0.75);
    box(g, mats.screen, u + 0.3, 8.15, u + 0.75, 8.2, 0.78, 1.15);
  }
  for (let k = 0; k < 4; k++) {                                                        // server / UPS racks
    const u = 11.8 + k * 0.85;
    box(g, mats.dark, u, 7.5, u + 0.65, 8.55, 0, 2.1);
    box(g, mats.led, u + 0.08, 7.48, u + 0.57, 7.5, 0.4, 1.9);
  }
  for (let k = 0; k < 6; k++) box(g, mats.screen, 4.4 + k * 1.75, 4.72, 5.95 + k * 1.75, 4.8, 1.1, 2.6);   // DCS video wall
  for (let k = 0; k < 3; k++) {                                                        // operator consoles
    const u = 5.2 + k * 3.1;
    bench(g, u, 2.2, u + 2.7, 3.0, 0.78);
    for (let s = 0; s < 3; s++) box(g, mats.screen, u + 0.2 + s * 0.85, 2.85, u + 0.85 + s * 0.85, 2.9, 0.8, 1.25);
    for (let s = 0; s < 2; s++) box(g, mats.dark, u + 0.6 + s * 1.2, 1.5, u + 1.1 + s * 1.2, 2.0, 0, 0.9);
  }

  // FF — paint & coating physical test lab, powder coating & extruder, environmental / weathering,
  //      QC work station, doc room, QC office, viscosity & application lab
  const ff = FLOORS[1];
  wall(ff, U.B, 5.0, 7.4, 5.0); wall(ff, 8.3, 5.0, 9.5, 5.0); wall(ff, 10.4, 5.0, 12.6, 5.0); wall(ff, 13.5, 5.0, U.D, 5.0);
  wall(ff, 8.97, 5.0, 8.97, V['03']); wall(ff, 12.31, 5.0, 12.31, V['03']);
  wall(ff, U.B, 3.77, 6.9, 3.77); wall(ff, 7.8, 3.77, 9.6, 3.77); wall(ff, 10.5, 3.77, 14.0, 3.77); wall(ff, 14.9, 3.77, U.D, 3.77);
  wall(ff, U.B, 1.9, 7.4, 1.9); wall(ff, 4.5, 0, 4.5, 1.9); wall(ff, 7.4, 0, 7.4, 3.77);
  bench(ff, 3.75, 8.0, 7.6, 8.75); bench(ff, 4.6, 6.0, 7.6, 7.5); bench(ff, 8.2, 5.3, 8.95, 8.75);
  for (let k = 0; k < 4; k++) box(ff, mats.equip, 4.0 + k * 0.9, 8.15, 4.6 + k * 0.9, 8.6, 0.9, 1.35);
  box(ff, mats.equip, 9.3, 7.3, 11.0, 8.6, 0, 2.4); box(ff, mats.hood, 9.45, 7.28, 10.85, 7.3, 0.9, 2.1);   // powder booth
  box(ff, mats.steel, 9.4, 5.6, 11.4, 6.3, 0, 1.1); box(ff, mats.equip, 9.5, 5.65, 10.0, 6.25, 1.1, 1.8);  // extruder
  bench(ff, 11.55, 5.3, 12.29, 8.75);
  box(ff, mats.equip, 12.6, 7.3, 13.9, 8.6, 0, 2.0); box(ff, mats.uv, 12.75, 7.28, 13.75, 7.3, 0.8, 1.7);  // weathering chamber
  bench(ff, 14.48, 5.6, 15.2, 8.2);
  bench(ff, 3.45, 2.1, 7.2, 2.8); for (let k = 0; k < 4; k++) box(ff, mats.screen, 3.7 + k * 0.9, 2.65, 4.3 + k * 0.9, 2.7, 0.9, 1.25);
  for (let k = 0; k < 3; k++) box(ff, mats.dark, 3.4, 0.2 + k * 0.55, 3.8, 0.6 + k * 0.55, 0, 2.0);         // document shelving
  bench(ff, 5.0, 0.3, 6.6, 1.0, 0.75);
  bench(ff, 9.6, 1.4, 13.2, 2.9); bench(ff, 7.5, 0.1, 15.2, 0.85); bench(ff, 14.48, 0.85, 15.2, 2.6);
  for (let k = 0; k < 6; k++) box(ff, mats.equip, 8.0 + k * 1.1, 0.25, 8.55 + k * 1.1, 0.7, 0.9, 1.3 + (k % 2) * 0.2);

  // SF — glassware, wet chemistry (fume hoods), application area, QC chemical room, instrument room, sample room
  const sf = FLOORS[2];
  wall(sf, U.B, 5.0, 5.2, 5.0); wall(sf, 6.1, 5.0, 9.4, 5.0); wall(sf, 10.3, 5.0, 11.2, 5.0); wall(sf, 12.1, 5.0, 13.0, 5.0); wall(sf, 13.9, 5.0, U.D, 5.0);
  wall(sf, 4.8, 6.4, 4.8, V['03']); wall(sf, U.B, 6.4, 4.8, 6.4); wall(sf, 10.5, 5.0, 10.5, V['03']); wall(sf, 12.77, 5.0, 12.77, V['03']);
  wall(sf, U.B, 3.77, 4.6, 3.77); wall(sf, 5.5, 3.77, 10.4, 3.77); wall(sf, 11.3, 3.77, U.D, 3.77);
  wall(sf, 11.7, 0, 11.7, 3.77);
  for (let k = 0; k < 3; k++) {                                                        // fume hoods
    const u = 5.2 + k * 1.6;
    box(sf, mats.equip, u, 7.9, u + 1.45, 8.72, 0, 2.35);
    box(sf, mats.hood, u + 0.12, 7.88, u + 1.33, 7.9, 0.95, 1.85);
  }
  bench(sf, 5.0, 5.3, 10.3, 6.1); bench(sf, 3.45, 7.9, 4.75, 8.7);
  bench(sf, 10.65, 8.0, 12.6, 8.72); bench(sf, 12.9, 8.0, 15.15, 8.72); bench(sf, 14.45, 5.3, 15.15, 8.0);
  for (let k = 0; k < 5; k++) box(sf, mats.equip, 10.8 + k * 0.85, 8.1, 11.35 + k * 0.85, 8.6, 0.9, 1.3);
  bench(sf, 6.3, 1.8, 9.9, 3.3); bench(sf, 3.45, 0.1, 11.6, 1.0); bench(sf, 3.45, 1.0, 4.35, 3.6);
  for (let k = 0; k < 7; k++) box(sf, k % 3 === 0 ? mats.dark : mats.equip, 4.6 + k * 1.0, 0.25, 5.3 + k * 1.0, 0.85, 0.9, 1.35 + (k % 3) * 0.15);
  for (let k = 0; k < 3; k++) box(sf, mats.screen, 6.6 + k * 1.1, 2.4, 7.3 + k * 1.1, 2.45, 0.92, 1.3);
  for (let k = 0; k < 3; k++) box(sf, mats.dark, 12.1 + k * 1.0, 0.25, 12.8 + k * 1.0, 0.75, 0, 2.1);       // sample racks
  for (let k = 0; k < 2; k++) box(sf, mats.dark, 14.6, 1.2 + k * 1.1, 15.1, 2.0 + k * 1.1, 0, 2.1);

  // ---------------------------------------------------------------- assemble
  const shell = new THREE.Group(), core = new THREE.Group(), rooms = new THREE.Group();
  root.add(shell, core, rooms);
  SB.build(shell); CB.build(core); RB.build(rooms);
  rooms.visible = false;
  const outline = new THREE.Group();
  const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color('#38BDF8').multiplyScalar(2.5), transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  for (const [u0, u1, y1] of [[U.B, W1, TERR + PARAPET], [W0, U.B + HT, CABIN + PARAPET]]) {
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(u1 - u0, y1, N1 - S0)), lineMat);
    e.position.set(AX + (u0 + u1) / 2, PL + y1 / 2, Z01 - (S0 + N1) / 2);
    outline.add(e);
  }
  root.add(outline);

  let transparentNow = false, castNow = true;
  const shellList = Object.values(shellMats);
  const baseOpacity = new Map(shellList.map((m) => [m, m.opacity]));
  return {
    anchors: {
      qaqc: new THREE.Vector3(AX + 7.6, PL + CABIN + 1.5, Z01 - 4.4),
      controlRoom: new THREE.Vector3(AX + 9.0, PL + 1.5, Z01 - 2.4),
      wetLab: new THREE.Vector3(AX + 7.5, PL + 9.0 + 1.6, Z01 - 7.5),
    },
    // c = 0 → closed building, 1 → envelope ghosted to reveal every floor; returns true if shadow casting changed
    update(t, c = 0) {
      const transparent = c > 0.001;
      for (const m of shellList) {
        m.opacity = baseOpacity.get(m) * (1 - 0.94 * c);
        if (m !== shellMats.curtain && transparent !== transparentNow) { m.transparent = transparent; m.depthWrite = !transparent; m.needsUpdate = true; }
      }
      transparentNow = transparent;
      shell.visible = c < 0.985;
      rooms.visible = c > 0.01;
      lineMat.opacity = 0.85 * Math.min(1, c * 1.5);
      outline.visible = c > 0.01;
      const cast = c < 0.5;
      if (cast !== castNow) { shell.traverse((o) => { if (o.isMesh) o.castShadow = cast; }); castNow = cast; return true; }
      return false;
    },
  };
}
