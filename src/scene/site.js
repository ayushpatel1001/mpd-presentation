// Static site: ground, site pad, boundary, roads, generic buildings, trees, parking,
// frontage roads and the blueprint overlay the plant "rises" out of.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Batcher, withRise, patchRise, riseDepthMaterial } from './materials.js';
import { BOUNDARY, BUILDINGS, ROADS, GATES, PESO, BOILER_HOLE, ASH_YARD_KEEPOUT, PARK_NORTH, WEIGHBRIDGE, TRANSFORMER, insideBoundary,
  PLANT1, PLANT2, BLENDER, FG_FARM, RM_FARM, ETP, FUEL, BOILER, COOLING, N2GEN, DAYTANK, QAQC_KEEPOUT, WAREHOUSE_KEEPOUT, FUTURE_EXP,
  TANKER_PARK, CAR_PARK, BIKE_STAND, TANKERS, FIRE_TANKS, FIRE_TANK } from './layout.js';
import { tanker, placeAt } from './props.js';
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

const BLUEPRINT_FRAG = /* glsl */`
uniform sampler2D tPlan; uniform float uOpacity; uniform vec3 uColor; uniform float uScan;
varying vec2 vUv;
void main(){
  float l = texture2D(tPlan, vUv).r;
  float line = smoothstep(0.92, 0.35, l);
  float sd = (vUv.y - uScan) * 40.0;
  float scan = exp(-sd * sd);
  float a = clamp(line * 0.85 + scan * 0.35 * line + scan * 0.06, 0.0, 1.0);
  gl_FragColor = vec4(uColor * (1.0 + scan * 0.8), a * uOpacity);
}`;

export function buildSite(world, M, tokens, planTexture) {
  const { scene, renderer } = world;
  const root = new THREE.Group();
  scene.add(root);
  const B = new Batcher();
  const R = rng(7);

  // ---- ground (with holes over the PESO pit, so the x-ray view can see below, and the sunken boiler area / ash yard)
  const pit = PESO.pit;
  const groundShape = new THREE.Shape([new THREE.Vector2(-2500, -2500), new THREE.Vector2(2500, -2500), new THREE.Vector2(2500, 2500), new THREE.Vector2(-2500, 2500)]);
  groundShape.holes.push(rectPath(pit.x0, pit.z0, pit.x1, pit.z1), polyPath(BOILER_HOLE));
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
  padShape.holes.push(rectPath(pit.x0, pit.z0, pit.x1, pit.z1), polyPath(BOILER_HOLE));
  const pad = new THREE.Mesh(new THREE.ShapeGeometry(padShape), M.pad);
  pad.rotation.x = -Math.PI / 2;
  pad.receiveShadow = true;
  root.add(pad);

  // ---- blueprint overlay (site plan drawing)
  const blueprint = new THREE.Mesh(new THREE.PlaneGeometry(213.74, 205.67), new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: BLUEPRINT_FRAG, transparent: true, depthWrite: false,
    uniforms: { tPlan: { value: planTexture }, uOpacity: { value: 1 }, uColor: { value: new THREE.Color(tokens.color.scene.blueprint) }, uScan: { value: 0 } },
  }));
  blueprint.rotation.x = -Math.PI / 2;
  blueprint.position.set(-5.94, 0.12, -1.51);
  blueprint.renderOrder = 5;
  root.add(blueprint);

  // ---- boundary wall with a glowing cap; gaps at the gates (gate 3 stands 1.2 m inside, on the ash-yard wall)
  const gaps = GATES.map((G) => [G.x + (G.closed ? -1.2 * Math.sin(G.ry) : 0), G.z + (G.closed ? -1.2 * Math.cos(G.ry) : 0), G.open / 2 + 1.0]);
  for (let i = 0; i < 4; i++) {
    const [ax, az] = BOUNDARY[i], [bx, bz] = BOUNDARY[(i + 1) % 4];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(len / 4);
    for (let k = 0; k < n; k++) {
      const u0 = k / n, u1 = (k + 1) / n;
      const mx = ax + (bx - ax) * (u0 + u1) / 2, mz = az + (bz - az) * (u0 + u1) / 2;
      if (gaps.some(([gx, gz, gr]) => Math.hypot(mx - gx, mz - gz) < gr)) continue;
      const ry = -Math.atan2(bz - az, bx - ax);
      const seg = len / n;
      B.box(M.concreteLight, mx, 1.0, mz, seg, 2.0, 0.3, riseDelay(mx, mz), {}, ry);
      B.box(M.glowCyan, mx, 2.06, mz, seg, 0.08, 0.34, riseDelay(mx, mz), { cast: false, receive: false }, ry);
    }
  }

  // ---- roads, curbs, markings
  for (const [x0, z0, x1, z1, w, noMark] of ROADS) {
    const horiz = z0 === z1;
    const len = horiz ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const [sx, sz] = horiz ? [len + w, w] : [w, len + w];
    B.box(M.road, cx, noMark ? 0.028 : 0.03, cz, sx, 0.06, sz, -1, { cast: false });
    if (noMark) continue;
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
  // car park on the former UG tank footprint, with tree islands (trees are added with the landscaping below)
  const parkTrees = carParkNorth(B, M, R);
  // tanker yard (27) and the car park south of the UG tank: paver pads; tankers parked / queued as drawn
  const paver = patchRise(M.concrete.clone());
  paver.color.set('#B7B2A6');
  for (const P of [TANKER_PARK, CAR_PARK]) {
    const g = new THREE.ShapeGeometry(new THREE.Shape(P.poly.map(([x, z]) => new THREE.Vector2(x, -z))));
    B.mesh(g, paver, [0, 0.07, 0], [-Math.PI / 2, 0, 0], [1, 1, 1], -1, { cast: false });
  }
  CAR_PARK.cars.forEach(([x, z], i) => car(localFrame(B, x, z), M, 0, 0, [M.carDark, M.car, M.bagBlue][i % 3], riseDelay(x, z, R())));
  for (const [x, z, head] of TANKERS) tanker(B, M, placeAt(x, 0, z, head === 'S' ? -Math.PI / 2 : Math.PI / 2), riseDelay(x, z) + 0.05);
  weighbridge(B, M, WEIGHBRIDGE);
  bikeStand(B, M, R);
  transformerYard(B, M, TRANSFORMER);

  // ---- landscaping: lawns on every open patch of the site, a double green belt along the boundary
  // (tall Ashoka-style columns against the wall, broadleaf canopy inside), shade trees and shrubs in
  // the open areas, and soya fields + farm trees around the site
  const keepOut = [
    ...BUILDINGS, ...WAREHOUSE_KEEPOUT, QAQC_KEEPOUT, PLANT1, PLANT2, BLENDER, FG_FARM, RM_FARM, ETP, FUEL, BOILER, ASH_YARD_KEEPOUT, COOLING, N2GEN, DAYTANK, ...FUTURE_EXP.keepout,
    { x: PESO.x, z: PESO.z, w: PESO.w, d: PESO.d }, PARK_NORTH, TANKER_PARK, CAR_PARK, WEIGHBRIDGE, TRANSFORMER,
    ...BIKE_STAND.map((b) => ({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, w: b.x1 - b.x0, d: b.z1 - b.z0 })),
    ...FIRE_TANKS.map((t) => ({ x: t.x, z: t.z, w: FIRE_TANK.d + 1, d: FIRE_TANK.d + 1 })),
    ...GATES.filter((G) => G.wings).map((G) => ({ x: G.x + 3.5 * Math.sin(G.ry), z: G.z + 3.5 * Math.cos(G.ry), w: G.open + 17, d: 9 })),   // gate aprons, wing walls
  ];
  const roadBoxes = ROADS.map(([x0, z0, x1, z1, w]) => ({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0) + w, d: Math.abs(z1 - z0) + w }));
  const trees = [...parkTrees];   // [x, z, scale, kind]  kind: 'broad' | 'ashoka' | 'shrub'
  futureExpansion(root, B, M);
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
    update(t, s) {
      blueprint.material.uniforms.uOpacity.value = s.blueprint;
      blueprint.visible = s.blueprint > 0.002;
      blueprint.material.uniforms.uScan.value = ((t * 0.18) % 1.4) - 0.2;
    },
  };
}

// Area for future expansion: empty lawn with "FUTURE EXPANSION" marked on the grass.
function futureExpansion(root, B, M) {
  const A = FUTURE_EXP;
  const rise = riseDelay(A.x, A.z);
  for (const p of A.parts) B.box(M.lawn, (p.x0 + p.x1) / 2, 0.03, (p.z0 + p.z1) / 2, p.x1 - p.x0, 0.06, p.z1 - p.z0, rise, { cast: false });
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.82)'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 190px system-ui, sans-serif';
  g.fillText('FUTURE EXPANSION', 1024, 136);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const text = new THREE.Mesh(new THREE.PlaneGeometry(72, 9), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  text.rotation.x = -Math.PI / 2;
  text.position.set(3, 0.08, 31.5);   // along the band both parts of the area share
  text.renderOrder = 2;
  root.add(text);
}

function rectPath(x0, z0, x1, z1) {
  return new THREE.Path([new THREE.Vector2(x0, -z0), new THREE.Vector2(x0, -z1), new THREE.Vector2(x1, -z1), new THREE.Vector2(x1, -z0)]);
}

function polyPath(pts) {
  return new THREE.Path(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
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

// Box helper in a rotated local frame (centre cx, cz; rotation ry about Y, same convention as Batcher.box)
function localFrame(B, cx, cz, ry = 0) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return (mat, lx, y, lz, w, h, d, rise, opts) => B.box(mat, cx + lx * c + lz * s, y, cz - lx * s + lz * c, w, h, d, rise, opts, ry);
}

export function building(B, M, b) {
  const rise = riseDelay(b.x, b.z);
  const { x, z, w, d, h } = b;
  const L = localFrame(B, x, z, b.ry || 0);
  const wallMat = b.style === 'shed' ? M.wallDark : M.wall;
  if (b.style === 'canopy') {
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) L(M.steelDark, px * (w / 2 - 0.4), h / 2, pz * (d / 2 - 0.4), 0.4, h, 0.4, rise);
    L(M[b.roof], 0, h, 0, w + 1, 0.4, d + 1, rise);
    L(M.concreteLight, 0, 0.1, 0, w, 0.2, d, -1, { cast: false });
    return;
  }
  L(wallMat, 0, h / 2, 0, w, h, d, rise);
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
  L(M[b.roof], 0, h + 0.2, 0, w + 0.5, 0.4, d + 0.5, rise);
  // glazing bands
  const floors = Math.max(1, Math.round(h / 4));
  for (let f = 0; f < floors; f++) {
    const y = 2 + f * (h / floors);
    L(M.glass, 0, y, d / 2 + 0.03, w * 0.86, 1.1, 0.06, rise, { cast: false });
    L(M.glass, 0, y, -d / 2 - 0.03, w * 0.86, 1.1, 0.06, rise, { cast: false });
    L(M.glass, w / 2 + 0.03, y, 0, 0.06, 1.1, d * 0.8, rise, { cast: false });
    L(M.glass, -w / 2 - 0.03, y, 0, 0.06, 1.1, d * 0.8, rise, { cast: false });
  }
  if (b.style === 'office' && w > 8) {
    L(M.steelDark, -w / 4, h + 1.0, 0, 2.2, 1.2, 1.6, rise);
    L(M.steelDark, w / 5, h + 0.9, d / 5, 1.6, 1.0, 1.6, rise);
  }
}

// Six-pole structure, transformer and HT panel (03) in a fenced yard set square to the north boundary
function transformerYard(B, M, y) {
  const r = riseDelay(y.x, y.z);
  const L = localFrame(B, y.x, y.z, y.ry || 0);
  L(M.concreteLight, 0, 0.1, 0, y.w, 0.2, y.d, -1, { cast: false });
  L(M.concrete, -2.4, 0.4, 1.0, 4.2, 0.4, 3.6, r);                         // transformer plinth
  L(M.steelDark, -2.4, 1.9, 1.0, 2.8, 2.6, 2.2, r);                        // transformer
  for (let f = -1.2; f <= 1.2; f += 0.4) L(M.steelDark, -2.4 + f, 1.7, 2.25, 0.1, 2.0, 0.35, r);   // radiator fins
  for (const dx of [-0.8, 0, 0.8]) L(M.pipe, -2.4 + dx, 3.6, 1.0, 0.18, 0.8, 0.18, r);            // bushings
  for (let i = 0; i < 6; i++) L(M.pipe, -5.5 + i * 2.2, 5, -5.0, 0.28, 10, 0.28, r);               // six-pole structure
  for (const yy of [7.0, 9.5]) L(M.steelDark, 0, yy, -5.0, 12.0, 0.2, 0.2, r);
  L(M.msPaint, 4.2, 1.2, 3.8, 1.2, 2.2, 3.4, r);                           // HT panel
  // chain-link fence with a gate on the road side
  const e = [y.w / 2 - 0.2, y.d / 2 - 0.2];
  for (const s of [-1, 1]) {
    L(M.grating, 0, 1.1, s * e[1], y.w - 0.4, 2.2, 0.04, r, { cast: false });
    L(M.grating, s * e[0], 1.1, 0, 0.04, 2.2, y.d - 0.4, r, { cast: false });
    for (let k = -3; k <= 3; k++) {
      L(M.steelDark, k * (e[0] / 3), 1.15, s * e[1], 0.08, 2.3, 0.08, r);
      L(M.steelDark, s * e[0], 1.15, k * (e[1] / 3), 0.08, 2.3, 0.08, r);
    }
  }
}

// Hatchback / sedan, long axis along local z, in a localFrame L
function car(L, M, lx, lz, body, r) {
  L(body, lx, 0.62, lz, 1.8, 0.75, 4.3, r);
  L(M.glass, lx, 1.2, lz + 0.15, 1.62, 0.44, 2.2, r);                 // glasshouse
  L(body, lx, 1.45, lz + 0.25, 1.64, 0.06, 1.7, r);                   // roof
  for (const dx of [-0.82, 0.82]) for (const dz of [-1.3, 1.3]) L(M.carDark, lx + dx, 0.32, lz + dz, 0.2, 0.64, 0.64, r, { cast: false });
}

// Car park on the former UG tank footprint (set square to the boundary): a north row of 90° bays the full length,
// a south row on the west half (the east half faces the existing stepped car row), a one-way aisle between them,
// tree islands every five bays and a planted bed at each end. Returns the island trees.
function carParkNorth(B, M, R) {
  const P = PARK_NORTH, L = localFrame(B, P.x, P.z, P.ry), r = riseDelay(P.x, P.z);
  const hw = P.w / 2, hd = P.d / 2, BAY = 2.5, DEPTH = 5.0;
  const paint = patchRise(M.concreteLight.clone());
  paint.color.set('#F1F5F9');
  const world = (lx, lz) => [P.x + lx * Math.cos(P.ry) + lz * Math.sin(P.ry), P.z - lx * Math.sin(P.ry) + lz * Math.cos(P.ry)];
  L(M.road, 0, 0.05, 0, P.w, 0.06, P.d, -1, { cast: false });
  const out = [];
  const bodies = [M.carDark, M.car, M.bagBlue, M.car, M.wallDark];
  const row = (x0, x1, z0, sideNorth) => {
    const n = Math.floor((x1 - x0) / BAY);
    for (let i = 0; i < n; i++) {
      const lx = x0 + (i + 0.5) * BAY, lz = z0 + DEPTH / 2;
      if (i % 5 === 2) {   // tree island
        L(M.concreteLight, lx, 0.12, lz, BAY - 0.2, 0.2, DEPTH - 0.4, r, { cast: false });
        L(M.lawn, lx, 0.23, lz, BAY - 0.5, 0.04, DEPTH - 0.7, r, { cast: false });
        const [wx, wz] = world(lx, lz);
        out.push([wx, wz, 0.75 + R() * 0.25, 'broad']);
        continue;
      }
      L(paint, lx - BAY / 2, 0.085, lz, 0.12, 0.02, DEPTH, -1, { cast: false });
      if (R() < 0.78) car(L, M, lx, lz + (sideNorth ? 0.2 : -0.2), bodies[Math.floor(R() * bodies.length)], riseDelay(...world(lx, lz), R()));
    }
    L(paint, x0 + n * BAY, 0.085, z0 + DEPTH / 2, 0.12, 0.02, DEPTH, -1, { cast: false });
  };
  // planted beds at both ends (with trees), then the bay rows between them
  // (the east bed stops at the aisle: the existing stepped car row runs into the south-east corner)
  for (const [a, b, z0, z1] of [[-hw, -hw + 3.2, -hd, hd], [hw - 2.6, hw, -hd, -hd + DEPTH + 1.0]]) {
    L(M.concreteLight, (a + b) / 2, 0.12, (z0 + z1) / 2, b - a, 0.2, z1 - z0, r, { cast: false });
    L(M.lawn, (a + b) / 2, 0.23, (z0 + z1) / 2, b - a - 0.3, 0.04, z1 - z0 - 0.3, r, { cast: false });
    for (let lz = z0 + 3.4; lz < z1 - 1.0; lz += 4.6) out.push([...world((a + b) / 2, lz), 0.8 + R() * 0.3, R() < 0.7 ? 'broad' : 'ashoka']);
  }
  row(-hw + 3.4, hw - 2.8, -hd, true);
  row(-hw + 3.4, 1.0, hd - DEPTH, false);
  // aisle arrows
  for (const lx of [-10, 0, 10]) L(paint, lx, 0.085, -hd + DEPTH + 1.95, 2.2, 0.02, 0.18, -1, { cast: false });
  return out;
}

// Pit-type weighbridge (17): steel deck flush with the lane, kerb guides and approach plates
function weighbridge(B, M, w) {
  const r = riseDelay(w.x, w.z);
  B.box(M.concrete, w.x, 0.07, w.z, w.w + 0.8, 0.06, w.d + 0.8, -1, { cast: false });
  B.box(M.steelDark, w.x, 0.11, w.z, w.w, 0.04, w.d, -1, { cast: false });
  for (let k = 1; k < 6; k++) B.box(M.pipe, w.x, 0.135, w.z - w.d / 2 + (k * w.d) / 6, w.w - 0.2, 0.01, 0.08, -1, { cast: false });
  for (const s of [-1, 1]) {
    B.box(M.yellow, w.x + s * (w.w / 2 + 0.25), 0.25, w.z, 0.2, 0.4, w.d, r);
    for (let k = 0; k < 7; k++) B.box(M.carDark, w.x + s * (w.w / 2 + 0.25), 0.25, w.z - w.d / 2 + 1.3 + k * 2.6, 0.21, 0.41, 1.0, r, { cast: false });
  }
  B.box(M.statusGreen, w.x + w.w / 2 + 0.6, 1.6, w.z - w.d / 2 + 0.6, 0.15, 0.5, 0.3, r, { cast: false });   // traffic lights
  B.box(M.steelDark, w.x + w.w / 2 + 0.6, 0.7, w.z - w.d / 2 + 0.6, 0.08, 1.4, 0.08, r);
}

// Two-wheeler stand (28): paved bays under a sheet canopy with parked bikes
function bikeStand(B, M, R) {
  const bodyMats = [M.carDark, M.bagBlue, M.car, M.carDark];
  for (const s of BIKE_STAND) {
    const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2, w = s.x1 - s.x0, d = s.z1 - s.z0;
    const r = riseDelay(cx, cz);
    B.box(M.concreteLight, cx, 0.06, cz, w, 0.12, d, -1, { cast: false });
    for (let x = s.x0 + 0.3; x <= s.x1 - 0.2; x += (w - 0.5) / Math.max(1, Math.round(w / 4))) for (const z of [s.z0 + 0.25, s.z1 - 0.25]) B.box(M.steelDark, x, 1.3, z, 0.1, 2.6, 0.1, r);
    B.box(M.roof, cx, 2.65, cz, w + 0.4, 0.1, d + 0.4, r);
    const lines = d > 3 ? [s.z0 + 1.05, s.z1 - 1.05] : [cz];
    for (const zl of lines) for (let x = s.x0 + 0.5; x < s.x1 - 0.3; x += 0.9) {
      if (R() < 0.3) continue;
      const m = bodyMats[Math.floor(R() * bodyMats.length)];
      B.box(m, x, 0.62, zl, 0.32, 0.5, 1.6, r);
      B.box(M.carDark, x, 0.95, zl + 0.15, 0.26, 0.12, 0.6, r, { cast: false });
      for (const dz of [-0.62, 0.62]) B.box(M.carDark, x, 0.33, zl + dz, 0.12, 0.6, 0.6, r, { cast: false });
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
