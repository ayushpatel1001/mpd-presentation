// Static site: ground, site pad, boundary, roads, generic buildings, trees, parking and frontage roads.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Batcher, withRise, patchRise, riseDepthMaterial } from './materials.js';
import { BOUNDARY, BUILDINGS, ROADS, PESO, UG_WATER, PARKING, WEIGHBRIDGE, TRANSFORMER, FUTURE, insideBoundary,
  PLANT1, PLANT2, BLENDER, FG_FARM, RM_FARM, ETP, FUEL, BOILER, COOLING, N2GEN, DAYTANK, QAQC_KEEPOUT, WAREHOUSE_KEEPOUT } from './layout.js';
import { rng } from '../lib/util.js';

const SITE_C = new THREE.Vector2(-3, 2);
export function riseDelay(x, z, jitter = 0) {
  const d = Math.hypot(x - SITE_C.x, z - SITE_C.y);
  return Math.min(0.72, d / 150) + jitter * 0.06;
}

function gridTexture(renderer, base, line) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = line; g.globalAlpha = 0.55; g.lineWidth = 2;
  g.strokeRect(0, 0, 128, 128);
  g.globalAlpha = 0.18; g.lineWidth = 1;
  g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 128); g.moveTo(0, 64); g.lineTo(128, 64); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildSite(world, M, tokens) {
  const { scene, renderer } = world;
  const root = new THREE.Group();
  scene.add(root);
  const B = new Batcher();
  const R = rng(7);

  // ---- ground (with a hole over the PESO pit so the x-ray view can see below)
  const pit = PESO.pit;
  const groundShape = new THREE.Shape([new THREE.Vector2(-2500, -2500), new THREE.Vector2(2500, -2500), new THREE.Vector2(2500, 2500), new THREE.Vector2(-2500, 2500)]);
  groundShape.holes.push(rectPath(pit.x0, pit.z0, pit.x1, pit.z1));
  const groundMat = M.ground.clone();
  groundMat.map = gridTexture(renderer, tokens.color.scene.ground, tokens.color.scene.groundGrid);
  groundMat.map.repeat.set(1 / 10, 1 / 10);
  const ground = new THREE.Mesh(new THREE.ShapeGeometry(groundShape), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  ground.receiveShadow = true;
  root.add(ground);

  // ---- site pad
  const padShape = new THREE.Shape(BOUNDARY.map(([x, z]) => new THREE.Vector2(x, -z)));
  padShape.holes.push(rectPath(pit.x0, pit.z0, pit.x1, pit.z1));
  const pad = new THREE.Mesh(new THREE.ShapeGeometry(padShape), M.pad);
  pad.rotation.x = -Math.PI / 2;
  pad.receiveShadow = true;
  root.add(pad);

  // ---- boundary wall with a glowing cap; gaps at gates and material exits
  const gaps = [[-51, -72.5], [23.5, -87.0], [72.0, 17.8], [78.0, 44.0]];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = BOUNDARY[i], [bx, bz] = BOUNDARY[(i + 1) % 4];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(len / 4);
    for (let k = 0; k < n; k++) {
      const u0 = k / n, u1 = (k + 1) / n;
      const mx = ax + (bx - ax) * (u0 + u1) / 2, mz = az + (bz - az) * (u0 + u1) / 2;
      if (gaps.some(([gx, gz]) => Math.hypot(mx - gx, mz - gz) < 5)) continue;
      const ry = -Math.atan2(bz - az, bx - ax);
      const seg = len / n;
      B.box(M.concreteLight, mx, 1.0, mz, seg, 2.0, 0.3, riseDelay(mx, mz), {}, ry);
      B.box(M.glowCyan, mx, 2.06, mz, seg, 0.08, 0.34, riseDelay(mx, mz), { cast: false, receive: false }, ry);
    }
  }

  // ---- roads, curbs, markings
  for (const [x0, z0, x1, z1, w] of ROADS) {
    const horiz = z0 === z1;
    const len = horiz ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const [sx, sz] = horiz ? [len + w, w] : [w, len + w];
    B.box(M.road, cx, 0.03, cz, sx, 0.06, sz, -1, { cast: false });
    const dash = 3, gap = 3.5;
    for (let s = -len / 2 + 2; s < len / 2 - 2; s += dash + gap) {
      const px = horiz ? cx + s + dash / 2 : cx, pz = horiz ? cz : cz + s + dash / 2;
      B.box(M.marking, px, 0.07, pz, horiz ? dash : 0.16, 0.02, horiz ? 0.16 : dash, -1, { cast: false });
    }
  }

  // ---- frontage roads outside the boundary (30 m to the north, 24 m to the east)
  frontageRoad(B, M, BOUNDARY[0], BOUNDARY[1], 30, 19);
  frontageRoad(B, M, BOUNDARY[1], BOUNDARY[2], 24, 16);

  // ---- generic buildings
  for (const b of BUILDINGS) building(B, M, b);
  // flat pads: UG water tank, parking, weighbridge, transformer yard, future plant ghost
  B.box(M.concrete, UG_WATER.x, 0.12, UG_WATER.z, UG_WATER.w, 0.24, UG_WATER.d, -1, { cast: false }, UG_WATER.ry);
  for (let i = 0; i < 4; i++) {
    const off = (i - 1.5) * 8;
    const mx = UG_WATER.x + off * Math.cos(UG_WATER.ry), mz = UG_WATER.z - off * Math.sin(UG_WATER.ry);
    B.box(M.steelDark, mx, 0.5, mz, 1.2, 0.8, 1.2, riseDelay(mx, mz));
  }
  B.box(M.concrete, PARKING.x, 0.08, PARKING.z, PARKING.w, 0.16, PARKING.d, -1, { cast: false }, PARKING.ry);
  for (let i = 0; i < 8; i++) {
    const off = -9 + i * 2.6;
    const mx = PARKING.x + off * Math.cos(PARKING.ry), mz = PARKING.z - off * Math.sin(PARKING.ry) + 2.6;
    B.box(i % 3 === 0 ? M.carDark : M.car, mx, 0.75, mz, 1.8, 1.3, 4.3, riseDelay(mx, mz, R()), {}, PARKING.ry);
  }
  B.box(M.concreteLight, WEIGHBRIDGE.x, 0.16, WEIGHBRIDGE.z, WEIGHBRIDGE.w, 0.3, WEIGHBRIDGE.d, -1, { cast: false });
  transformerYard(B, M, TRANSFORMER);
  futurePlant(root, B, M, tokens);

  // ---- landscaping: lawns on every open patch of the site, a double green belt along the boundary
  // (tall Ashoka-style columns against the wall, broadleaf canopy inside), shade trees and shrubs in
  // the open areas, and soya fields + farm trees around the site
  const keepOut = [
    ...BUILDINGS, ...WAREHOUSE_KEEPOUT, QAQC_KEEPOUT, PLANT1, PLANT2, BLENDER, FG_FARM, RM_FARM, ETP, FUEL, BOILER, COOLING, N2GEN, DAYTANK, FUTURE,
    { x: PESO.x, z: PESO.z, w: PESO.w, d: PESO.d }, UG_WATER, PARKING, WEIGHBRIDGE, TRANSFORMER,
  ];
  const roadBoxes = ROADS.map(([x0, z0, x1, z1, w]) => ({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0) + w, d: Math.abs(z1 - z0) + w }));
  const trees = [];   // [x, z, scale, kind]  kind: 'broad' | 'ashoka' | 'shrub'
  const LAWN = 3;
  for (let x = -88; x < 90; x += LAWN) {
    for (let z = -94; z < 97; z += LAWN) {
      const cx = x + LAWN / 2, cz = z + LAWN / 2;
      if (!insideBoundary(cx, cz, 0.8) || blocked(cx, cz, keepOut, roadBoxes, 1.0)) continue;
      B.box(M.lawn, cx, 0.025, cz, LAWN, 0.05, LAWN, riseDelay(cx, cz), { cast: false });
      // scattered shade trees and shrubs on the larger lawns, clear of buildings and roads
      const r = R();
      if (r < 0.07 && !blocked(cx, cz, keepOut, roadBoxes, 3.5)) trees.push([cx + (R() - 0.5) * 2, cz + (R() - 0.5) * 2, 0.8 + R() * 0.45, 'broad']);
      else if (r < 0.16 && !blocked(cx, cz, keepOut, roadBoxes, 1.8)) trees.push([cx + (R() - 0.5) * 2, cz + (R() - 0.5) * 2, 0.7 + R() * 0.5, 'shrub']);
    }
  }
  for (let i = 0; i < 4; i++) {
    const [ax, az] = BOUNDARY[i], [bx, bz] = BOUNDARY[(i + 1) % 4];
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len, nz = (bx - ax) / len; // inward normal (boundary is CCW in x/z)
    for (let s = 3; s < len - 3; s += 3.6) {
      const x = ax + (bx - ax) * (s / len) + nx * 2.2, z = az + (bz - az) * (s / len) + nz * 2.2;
      if (!blocked(x, z, keepOut, roadBoxes, 1.2)) trees.push([x, z, 0.9 + R() * 0.3, 'ashoka']);
    }
    for (let s = 5; s < len - 5; s += 5.5) {
      const x = ax + (bx - ax) * (s / len) + nx * 6.0, z = az + (bz - az) * (s / len) + nz * 6.0;
      if (!blocked(x, z, keepOut, roadBoxes, 2.0)) trees.push([x, z, 0.85 + R() * 0.4, 'broad']);
    }
  }
  for (const [cx, cz, n] of [[-72, -40, 8], [30, -70, 9], [52, -62, 6], [-30, 55, 8], [66, 10, 6], [-5, 30, 5]]) {
    for (let k = 0; k < n; k++) {
      const x = cx + (R() - 0.5) * 16, z = cz + (R() - 0.5) * 12;
      if (insideBoundary(x, z, 2.5) && !blocked(x, z, keepOut, roadBoxes, 1.5)) trees.push([x, z, 0.85 + R() * 0.5, 'broad']);
    }
  }
  // soya fields and farm trees outside the boundary, kept off the frontage roads
  const fieldMats = [soyaField(renderer, '#5E9B35', '#4C8429'), soyaField(renderer, '#7CB342', '#689F38'), soyaField(renderer, '#8DB54A', '#A3C25E')];
  for (let gx = -300; gx <= 300; gx += 75) {
    for (let gz = -300; gz <= 300; gz += 75) {
      const w = 58 + R() * 12, d = 58 + R() * 12, x = gx + (R() - 0.5) * 6, z = gz + (R() - 0.5) * 6;
      const corners = [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x - w / 2, z + d / 2], [x + w / 2, z + d / 2], [x, z]];
      if (corners.some(([px, pz]) => insideBoundary(px, pz, -8) || onFrontage(px, pz, 6))) continue;
      if (R() < 0.15) continue;   // a few fallow plots keep the patchwork natural
      const field = new THREE.Mesh(new THREE.PlaneGeometry(w, d), fieldMats[Math.floor(R() * 3)]);
      field.rotation.x = -Math.PI / 2;
      if (R() < 0.5) field.rotation.z = Math.PI / 2;
      field.position.set(x, -0.05, z);
      field.receiveShadow = true;
      root.add(field);
      // farm trees along one field edge
      for (let k = 0; k < 4; k++) {
        const tx = x - w / 2 + R() * w, tz = z + d / 2 + 4;
        if (!insideBoundary(tx, tz, -6) && !onFrontage(tx, tz, 4)) trees.push([tx, tz, 1.0 + R() * 0.6, 'broad']);
      }
    }
  }
  for (let k = 0; k < 260; k++) {
    const x = (R() - 0.5) * 560, z = (R() - 0.5) * 560;
    if (insideBoundary(x, z, -12) || onFrontage(x, z, 4)) continue;
    trees.push([x, z, 0.95 + R() * 0.75, R() < 0.8 ? 'broad' : 'ashoka']);
  }
  instancedTrees(root, M, trees);

  B.build(root);

  return {
    root,
  };
}

function rectPath(x0, z0, x1, z1) {
  return new THREE.Path([new THREE.Vector2(x0, -z0), new THREE.Vector2(x0, -z1), new THREE.Vector2(x1, -z1), new THREE.Vector2(x1, -z0)]);
}

function blocked(x, z, boxes, roads, m) {
  for (const b of [...boxes, ...roads]) if (Math.abs(x - b.x) < b.w / 2 + m && Math.abs(z - b.z) < b.d / 2 + m) return true;
  return false;
}

function frontageRoad(B, M, a, b, width, offset) {
  const [ax, az] = a, [bx, bz] = b;
  const len = Math.hypot(bx - ax, bz - az);
  const ux = (bx - ax) / len, uz = (bz - az) / len;
  const nx = uz, nz = -ux; // outward normal
  const cx = (ax + bx) / 2 + nx * offset, cz = (az + bz) / 2 + nz * offset;
  const ry = -Math.atan2(bz - az, bx - ax);
  const L = len + 260;
  B.box(M.road, cx, -0.02, cz, L, 0.06, width, -1, { cast: false }, ry);
  for (const side of [-1, 1]) B.box(M.curb, cx + nx * side * width / 2, 0.02, cz + nz * side * width / 2, L, 0.14, 0.35, -1, { cast: false }, ry);
  for (let s = -L / 2; s < L / 2; s += 8) {
    for (const lane of [-width / 4, width / 4]) {
      B.box(M.marking, cx + ux * s + nx * lane, 0.03, cz + uz * s + nz * lane, 3.2, 0.02, 0.18, -1, { cast: false }, ry);
    }
  }
}

export function building(B, M, b) {
  const rise = riseDelay(b.x, b.z);
  const { x, z, w, d, h } = b;
  const wallMat = b.style === 'shed' ? M.wallDark : M.wall;
  if (b.style === 'canopy') {
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(M.steelDark, x + px * (w / 2 - 0.4), h / 2, z + pz * (d / 2 - 0.4), 0.4, h, 0.4, rise);
    B.box(M[b.roof], x, h, z, w + 1, 0.4, d + 1, rise);
    B.box(M.concreteLight, x, 0.1, z, w, 0.2, d, -1, { cast: false });
    return;
  }
  B.box(wallMat, x, h / 2, z, w, h, d, rise);
  if (b.style === 'shed') {
    const alongZ = d >= w;
    const span = alongZ ? w : d, len = alongZ ? d : w;
    const pitch = 0.12;
    for (const side of [-1, 1]) {
      const geo = new THREE.BoxGeometry(alongZ ? span / 2 + 0.4 : len + 0.6, 0.35, alongZ ? len + 0.6 : span / 2 + 0.4);
      const pos = alongZ ? [x + side * span / 4, h + 0.35 + Math.sin(pitch) * span / 4, z] : [x, h + 0.35 + Math.sin(pitch) * span / 4, z + side * span / 4];
      const rot = alongZ ? [0, 0, -side * pitch] : [side * pitch, 0, 0];
      B.mesh(geo, M[b.roof], pos, rot, [1, 1, 1], rise);
    }
    // dock doors along the long side facing the nearest road
    const n = Math.floor((d >= w ? d : w) / 10);
    for (let k = 0; k < n; k++) {
      const s = -((d >= w ? d : w) / 2) + 5 + k * 10;
      if (d >= w) B.box(M.concrete, x + w / 2 + 0.05, 2.5, z + s, 0.1, 5, 4, rise);
      else B.box(M.concrete, x + s, 2.5, z - d / 2 - 0.05, 4, 5, 0.1, rise);
    }
    return;
  }
  B.box(M[b.roof], x, h + 0.2, z, w + 0.5, 0.4, d + 0.5, rise);
  // glazing bands
  const floors = Math.max(1, Math.round(h / 4));
  for (let f = 0; f < floors; f++) {
    const y = 2 + f * (h / floors);
    B.box(M.glass, x, y, z + d / 2 + 0.03, w * 0.86, 1.1, 0.06, rise, { cast: false });
    B.box(M.glass, x, y, z - d / 2 - 0.03, w * 0.86, 1.1, 0.06, rise, { cast: false });
    B.box(M.glass, x + w / 2 + 0.03, y, z, 0.06, 1.1, d * 0.8, rise, { cast: false });
    B.box(M.glass, x - w / 2 - 0.03, y, z, 0.06, 1.1, d * 0.8, rise, { cast: false });
  }
  if (b.style === 'office' && w > 8) {
    B.box(M.steelDark, x - w / 4, h + 1.0, z, 2.2, 1.2, 1.6, rise);
    B.box(M.steelDark, x + w / 5, h + 0.9, z + d / 5, 1.6, 1.0, 1.6, rise);
  }
}

function transformerYard(B, M, y) {
  const r = riseDelay(y.x, y.z);
  B.box(M.concreteLight, y.x, 0.1, y.z, y.w, 0.2, y.d, -1, { cast: false });
  for (const dx of [-3, 3]) {
    B.box(M.steelDark, y.x + dx, 1.4, y.z + 2, 2.4, 2.8, 2.0, r);
    for (let f = -1; f <= 1; f += 0.5) B.box(M.steelDark, y.x + dx + f, 1.4, y.z + 3.1, 0.12, 2.2, 0.4, r);
  }
  for (let i = 0; i < 6; i++) B.box(M.pipe, y.x - 5 + i * 2, 5, y.z - 4, 0.25, 10, 0.25, r);
  B.box(M.pipe, y.x, 9.5, y.z - 4, 11, 0.2, 0.2, r);
}

function futurePlant(root, B, M, tokens) {
  // reserved pad with a dashed glowing outline
  B.box(M.concrete, FUTURE.x, 0.05, FUTURE.z, FUTURE.w, 0.1, FUTURE.d, -1, { cast: false });
  const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [FUTURE.x + a * FUTURE.w / 2, FUTURE.z + b * FUTURE.d / 2]);
  for (let i = 0; i < 4; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % 4];
    const len = Math.hypot(bx - ax, bz - az);
    for (let s = 0; s < len - 1; s += 3) {
      const u = (s + 0.9) / len;
      const horiz = az === bz;
      B.box(M.glowCyan, ax + (bx - ax) * u, 0.13, az + (bz - az) * u, horiz ? 1.8 : 0.18, 0.05, horiz ? 0.18 : 1.8, -1, { cast: false, receive: false });
    }
  }
}

// Low-poly trees with per-instance greens: broadleaf (neem / mango-like clustered crown), tall Ashoka
// columns for the boundary belt, and round shrubs. One instanced mesh per part keeps it cheap.
const GREENS = ['#2E7D32', '#388E3C', '#43A047', '#2F6B2A', '#4C8C2B', '#5A9E3A', '#3B7A3A'];
function crownGeometry() {
  const parts = [[0, 4.0, 0, 2.1], [1.2, 3.5, 0.5, 1.5], [-1.1, 3.6, -0.4, 1.6], [0.2, 3.3, -1.2, 1.4], [-0.3, 5.0, 0.3, 1.5]];
  return mergeGeometries(parts.map(([x, y, z, r]) => new THREE.IcosahedronGeometry(r, 1).translate(x, y, z)), false);
}
function ashokaGeometry() {
  const tiers = [[0, 3.4, 1.35, 3.2], [0, 5.6, 1.05, 2.8], [0, 7.6, 0.7, 2.4]];
  return mergeGeometries(tiers.map(([x, y, r, h]) => new THREE.ConeGeometry(r, h, 7).translate(x, y, 0)), false);
}
function shrubGeometry() {
  return mergeGeometries([[0, 0.55, 0, 0.75], [0.6, 0.45, 0.2, 0.55], [-0.5, 0.45, -0.25, 0.6]]
    .map(([x, y, z, r]) => new THREE.IcosahedronGeometry(r, 1).translate(x, y, z)), false);
}

function instancedTrees(root, M, trees) {
  const R = rng(19);
  const trunk = new THREE.CylinderGeometry(0.16, 0.26, 2.6, 6).translate(0, 1.3, 0);
  const kinds = {
    broad: { crown: crownGeometry(), trunk },
    ashoka: { crown: ashokaGeometry(), trunk: new THREE.CylinderGeometry(0.12, 0.18, 2.0, 6).translate(0, 1.0, 0) },
    shrub: { crown: shrubGeometry(), trunk: null },
  };
  const depth = riseDepthMaterial();
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (const [kind, { crown, trunk: trunkGeo }] of Object.entries(kinds)) {
    const list = trees.filter((tr) => tr[3] === kind);
    if (!list.length) continue;
    const mats = list.map(([x, z, s]) => m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6.28, 0)),
      new THREE.Vector3(s * (0.9 + R() * 0.2), s, s * (0.9 + R() * 0.2))).clone());
    const rises = new Float32Array(list.map(([x, z]) => Math.min(0.8, riseDelay(x, z) + 0.05)));
    const parts = [[crown, M.foliage, true]];
    if (trunkGeo) parts.push([trunkGeo, M.trunk, false]);
    for (const [geo0, mat, tinted] of parts) {
      const geo = withRise(geo0.clone(), 0);
      geo.setAttribute('aRise', new THREE.InstancedBufferAttribute(rises, 1));
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      mats.forEach((mm, i) => {
        im.setMatrixAt(i, mm);
        if (tinted) im.setColorAt(i, col.set(GREENS[Math.floor(R() * GREENS.length)]).offsetHSL(0, 0, (R() - 0.5) * 0.06));
      });
      im.castShadow = kind !== 'shrub'; im.receiveShadow = true;
      im.customDepthMaterial = depth;
      im.frustumCulled = false;
      root.add(im);
    }
  }
}

function soyaField(renderer, a, b) {
  // crop rows: alternating stripes with a little noise so the fields read as planted rows from the air
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, 256, 256);
  g.fillStyle = b;
  for (let y = 0; y < 256; y += 16) g.fillRect(0, y, 256, 7);
  const R = rng(a.length + parseInt(a.slice(1), 16) % 997);   // deterministic: every render worker gets the same texture
  for (let i = 0; i < 900; i++) { g.globalAlpha = 0.12; g.fillStyle = i % 2 ? '#2E5E1E' : '#B5D07A'; g.fillRect(R() * 256, R() * 256, 3, 3); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshLambertMaterial({ map: t });
}

function onFrontage(x, z, margin) {
  // the 30 m north and 24 m east frontage roads (see frontageRoad)
  for (const [a, b, width, offset] of [[BOUNDARY[0], BOUNDARY[1], 30, 19], [BOUNDARY[1], BOUNDARY[2], 24, 16]]) {
    const [ax, az] = a, [bx, bz] = b;
    const len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    const along = (x - (ax + bx) / 2) * ux + (z - (az + bz) / 2) * uz;
    const across = (x - (ax + bx) / 2) * uz - (z - (az + bz) / 2) * ux;   // outward normal is (uz, -ux)
    if (Math.abs(along) < (len + 260) / 2 + margin && Math.abs(across - offset) < width / 2 + margin) return true;
  }
  return false;
}
