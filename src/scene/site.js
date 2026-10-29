// Static site: ground, site pad, boundary, roads, generic buildings, trees, parking,
// frontage roads and the blueprint overlay the plant "rises" out of.
import * as THREE from 'three';
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

  // ---- trees: green belt along the boundary + clusters
  const keepOut = [
    ...BUILDINGS, ...WAREHOUSE_KEEPOUT, QAQC_KEEPOUT, PLANT1, PLANT2, BLENDER, FG_FARM, RM_FARM, ETP, FUEL, BOILER, COOLING, N2GEN, DAYTANK, FUTURE,
    { x: PESO.x, z: PESO.z, w: PESO.w, d: PESO.d }, UG_WATER, PARKING, WEIGHBRIDGE, TRANSFORMER,
  ];
  const roadBoxes = ROADS.map(([x0, z0, x1, z1, w]) => ({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.abs(x1 - x0) + w, d: Math.abs(z1 - z0) + w }));
  const trees = [];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = BOUNDARY[i], [bx, bz] = BOUNDARY[(i + 1) % 4];
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len, nz = (bx - ax) / len; // inward normal (boundary is CCW in x/z)
    for (let s = 4; s < len - 4; s += 6.5) {
      const x = ax + (bx - ax) * (s / len) + nx * 3.4, z = az + (bz - az) * (s / len) + nz * 3.4;
      if (!blocked(x, z, keepOut, roadBoxes, 1.5)) trees.push([x, z, 0.85 + R() * 0.4]);
    }
  }
  for (const [cx, cz, n] of [[-72, -40, 5], [30, -70, 6], [52, -62, 4], [-30, 55, 5], [66, 10, 4], [-5, 30, 3]]) {
    for (let k = 0; k < n; k++) {
      const x = cx + (R() - 0.5) * 14, z = cz + (R() - 0.5) * 10;
      if (insideBoundary(x, z, 2.5) && !blocked(x, z, keepOut, roadBoxes, 1.5)) trees.push([x, z, 0.8 + R() * 0.5]);
    }
  }
  // sparse trees outside the site for context
  for (let k = 0; k < 140; k++) {
    const x = (R() - 0.5) * 520, z = (R() - 0.5) * 520;
    if (insideBoundary(x, z, -40)) continue;
    trees.push([x, z, 0.9 + R() * 0.7]);
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

function instancedTrees(root, M, trees) {
  const foliage = withRise(new THREE.ConeGeometry(1.9, 4.6, 7), 0);
  foliage.translate(0, 3.6, 0);
  const crown2 = withRise(new THREE.IcosahedronGeometry(1.7, 0), 0);
  crown2.translate(0, 3.2, 0);
  const trunk = new THREE.CylinderGeometry(0.18, 0.24, 1.6, 6);
  trunk.translate(0, 0.8, 0);
  const groups = [[foliage, M.tree, trees.filter((_, i) => i % 3 !== 0)], [crown2, M.treeDark, trees.filter((_, i) => i % 3 === 0)]];
  const depth = riseDepthMaterial();
  for (const [geo, mat, list] of groups) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    const rises = new Float32Array(list.length);
    const m4 = new THREE.Matrix4();
    list.forEach(([x, z, s], i) => {
      m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (x * 7 + z) % 6.28, 0)), new THREE.Vector3(s, s, s));
      im.setMatrixAt(i, m4);
      rises[i] = Math.min(0.8, riseDelay(x, z) + 0.05);
    });
    geo.setAttribute('aRise', new THREE.InstancedBufferAttribute(rises, 1));
    im.castShadow = true; im.receiveShadow = true;
    im.customDepthMaterial = depth;
    im.frustumCulled = false;
    root.add(im);
    const tr = new THREE.InstancedMesh(trunk, M.trunk, list.length);
    list.forEach(([x, z, s], i) => { m4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); tr.setMatrixAt(i, m4); });
    tr.frustumCulled = false;
    root.add(tr);
  }
}
