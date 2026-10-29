// Shared materials, the "rise" vertex patch used for the greenfield build-up,
// and a batcher that merges static geometry per material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const riseUniform = { value: 1 };

const RISE_GLSL = /* glsl */`
attribute float aRise;
uniform float uRise;
float riseScale(){
  if (aRise < 0.0) return 1.0;
  float s = clamp((uRise - aRise) / 0.26, 0.0, 1.0);
  float c1 = 1.70158; float c3 = c1 + 1.0;
  return s <= 0.0 ? 0.0 : 1.0 + c3*pow(s-1.0, 3.0) + c1*pow(s-1.0, 2.0);
}`;

// Scales geometry height by a per-vertex delay so buildings pop up out of the site plan.
export function patchRise(material) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    prev?.(shader, r);
    shader.uniforms.uRise = riseUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + RISE_GLSL)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.y *= riseScale();');
  };
  material.customProgramCacheKey = () => 'rise';
  return material;
}

export function riseDepthMaterial() {
  return patchRise(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
}

// Cheap shading for SwiftShader: Lambert for matte surfaces, Phong + a tiny cube env map
// for metals. Accepts MeshStandardMaterial-style params (metalness/roughness).
let ENV = null;
function envCube() {
  if (ENV) return ENV;
  const face = (top, mid, bottom) => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 64);
    grd.addColorStop(0, top); grd.addColorStop(0.5, mid); grd.addColorStop(1, bottom);
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    return c;
  };
  const side = () => face('#8DB8E0', '#E6F0F8', '#1A2533');
  ENV = new THREE.CubeTexture([side(), side(), face('#B8D8F5', '#B8D8F5', '#B8D8F5'), face('#121A24', '#121A24', '#121A24'), side(), side()]);
  ENV.colorSpace = THREE.SRGBColorSpace;
  ENV.needsUpdate = true;
  return ENV;
}

export function makeMat(p = {}) {
  const base = {
    color: p.color ?? 0xffffff, map: p.map ?? null, emissive: p.emissive ?? 0x000000, emissiveMap: p.emissiveMap ?? null,
    emissiveIntensity: p.emissiveIntensity ?? 1, transparent: !!p.transparent, opacity: p.opacity ?? 1,
    side: p.side ?? THREE.FrontSide, flatShading: !!p.flatShading,
  };
  if ('depthWrite' in p) base.depthWrite = p.depthWrite;
  if (p.clippingPlanes) Object.assign(base, { clippingPlanes: p.clippingPlanes, clipIntersection: !!p.clipIntersection, clipShadows: !!p.clipShadows });
  const metal = p.metalness ?? 0, rough = p.roughness ?? 0.8;
  if (metal >= 0.3 || rough < 0.3) {
    const c = new THREE.Color(base.color);
    return new THREE.MeshPhongMaterial({
      ...base, color: c.clone().multiplyScalar(1 - 0.3 * metal),
      specular: new THREE.Color(0x202020).lerp(c, metal * 0.7), shininess: 10 + (1 - rough) * 80,
      envMap: envCube(), combine: THREE.MixOperation, reflectivity: 0.1 + 0.4 * metal * (1 - rough),
    });
  }
  return new THREE.MeshLambertMaterial(base);
}
const std = makeMat;

export function createMaterials(tokens) {
  const S = tokens.color.scene, B = tokens.color.brand, F = tokens.color.flow;
  const m = {
    ground: std({ color: S.ground, roughness: 0.95, metalness: 0 }),
    pad: std({ color: S.sitePad, roughness: 0.9, metalness: 0 }),
    road: std({ color: S.road, roughness: 0.85, metalness: 0 }),
    marking: std({ color: S.roadMarking, emissive: S.roadMarking, emissiveIntensity: 0.35, roughness: 0.6 }),
    curb: std({ color: '#A8AFB8', roughness: 0.8 }),
    wall: std({ color: S.buildingWall, roughness: 0.78, metalness: 0.05 }),
    wallDark: std({ color: '#8C9DB0', roughness: 0.75, metalness: 0.1 }),
    roof: std({ color: '#3E5670', roughness: 0.6, metalness: 0.3 }),
    roofP1: std({ color: B.mpdDeepBlue, roughness: 0.5, metalness: 0.25 }),
    roofP2: std({ color: B.ecoGreen, roughness: 0.5, metalness: 0.25 }),
    glass: std({ color: '#0B2A44', emissive: B.greenfieldCyan, emissiveIntensity: 0.55, roughness: 0.2, metalness: 0.4 }),
    concrete: std({ color: '#A3ABB4', roughness: 0.9 }),
    concreteLight: std({ color: '#BCC3CB', roughness: 0.9 }),
    steel: std({ color: S.tankShell, roughness: 0.3, metalness: 0.75 }),
    steelDark: std({ color: '#5B6B7D', roughness: 0.45, metalness: 0.6 }),
    msPaint: std({ color: '#6E86A0', roughness: 0.55, metalness: 0.35 }),
    pipe: std({ color: '#8FA3B8', roughness: 0.4, metalness: 0.65 }),
    grating: std({ color: '#3A4D63', roughness: 0.7, metalness: 0.4, transparent: true, opacity: 0.55, depthWrite: false }),
    yellow: std({ color: B.solarYellow, roughness: 0.5, metalness: 0.2 }),
    tree: std({ color: S.tree, roughness: 0.9, flatShading: true }),
    treeDark: std({ color: '#1F5E2A', roughness: 0.9, flatShading: true }),
    trunk: std({ color: '#4A3B2A', roughness: 0.9 }),
    grass: std({ color: '#6B8A3E', roughness: 1.0 }),
    biomass: std({ color: '#6B5A2E', roughness: 1.0, flatShading: true }),
    biomassGreen: std({ color: '#4E6B2C', roughness: 1.0, flatShading: true }),
    water: std({ color: '#0C3F52', emissive: '#0E7490', emissiveIntensity: 0.35, roughness: 0.12, metalness: 0.3 }),
    car: std({ color: '#CBD5E1', roughness: 0.35, metalness: 0.5 }),
    carDark: std({ color: '#334155', roughness: 0.35, metalness: 0.5 }),
    bag: std({ color: '#E8EEF5', roughness: 0.8 }),
    bagBlue: std({ color: B.mpdDeepBlue, roughness: 0.8 }),
    wood: std({ color: '#A57F4F', roughness: 0.9 }),
    statusGreen: std({ color: '#16A34A', emissive: '#22C55E', emissiveIntensity: 2.2 }),
    statusCyan: std({ color: B.greenfieldCyan, emissive: B.greenfieldCyan, emissiveIntensity: 2.0 }),
    glowCyan: new THREE.MeshBasicMaterial({ color: new THREE.Color(B.greenfieldCyan).multiplyScalar(2.2), toneMapped: false }),
    flame: std({ color: '#7C2D12', emissive: F.thermicOil, emissiveIntensity: 2.4 }),
  };
  for (const k of ['wall', 'wallDark', 'roof', 'roofP1', 'roofP2', 'glass', 'concrete', 'concreteLight', 'steel', 'steelDark', 'msPaint', 'pipe', 'yellow', 'tree', 'treeDark', 'trunk', 'biomass', 'biomassGreen', 'car', 'carDark', 'water', 'statusGreen', 'statusCyan', 'flame', 'bag', 'bagBlue', 'wood'])
    patchRise(m[k]);
  return m;
}

// Collects static geometry (already positioned) per material and merges it into few meshes.
export class Batcher {
  constructor() { this.groups = new Map(); }

  add(geometry, material, matrix, rise = -1, { cast = true, receive = true } = {}) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(matrix);
    const n = g.attributes.position.count;
    g.setAttribute('aRise', new THREE.BufferAttribute(new Float32Array(n).fill(rise), 1));
    const key = material.uuid + (cast ? 'c' : '') + (receive ? 'r' : '');
    if (!this.groups.has(key)) this.groups.set(key, { material, cast, receive, geoms: [] });
    this.groups.get(key).geoms.push(g);
  }

  box(material, x, y, z, w, h, d, rise = -1, opts = {}, ry = 0) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mtx = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
    this.add(geo, material, mtx, rise, opts);
  }

  mesh(geometry, material, position, rotation = [0, 0, 0], scale = [1, 1, 1], rise = -1, opts = {}) {
    const mtx = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
    this.add(geometry, material, mtx, rise, opts);
  }

  build(parent) {
    const depth = riseDepthMaterial();
    for (const { material, cast, receive, geoms } of this.groups.values()) {
      const merged = mergeGeometries(geoms, false);
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      mesh.customDepthMaterial = depth;
      mesh.frustumCulled = false;
      parent.add(mesh);
    }
    this.groups.clear();
  }
}

// Gives a standalone (non-batched) geometry a constant rise delay attribute.
export function withRise(geometry, rise = -1) {
  geometry.setAttribute('aRise', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(rise), 1));
  return geometry;
}
