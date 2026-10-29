// Colour-coded energy / product flows along pipe-rack routes. Each route is a physical steel
// pipe plus an additive glow tube that reveals along its length and carries moving pulses.
import * as THREE from 'three';
import { keyframes, keyframesMax, clamp } from '../lib/util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// [id, colour key, state key, reveal range within the state, points]
const ROUTES = [
  ['thermic_trunk', 'thermicOil', 'flowThermic', [0, 0.7], [V(34, 3.8, 55.4), V(34, 6.9, 55.4), V(34, 6.9, 44.6), V(18.8, 6.9, 44.6), V(18.8, 6.9, -24)]],
  ['thermic_p1', 'thermicOil', 'flowThermic', [0.6, 1], [V(18.8, 6.9, -16), V(8, 6.9, -16), V(8, 5.0, -16)]],
  ['thermic_p2', 'thermicOil', 'flowThermic', [0.66, 1], [V(18.8, 6.9, -24), V(29.5, 6.9, -24), V(29.5, 5.0, -24)]],
  ['cooling_trunk', 'coolingWater', 'flowCooling', [0, 0.72], [V(55, 3, 23.6), V(55, 6.3, 23.6), V(55, 6.3, 19.4), V(17.2, 6.3, 19.4), V(17.2, 6.3, -30)]],
  ['cooling_p1', 'coolingWater', 'flowCooling', [0.62, 1], [V(17.2, 6.3, -10), V(9, 6.3, -10), V(9, 5.2, -10)]],
  ['cooling_p2', 'coolingWater', 'flowCooling', [0.7, 1], [V(17.2, 6.3, -30), V(26, 6.3, -30), V(26, 5.2, -30)]],
  ['n2_trunk', 'nitrogen', 'flowNitrogen', [0, 0.85], [V(46, 3.8, -41), V(46, 7.6, -41), V(18, 7.6, -41), V(18, 7.6, -28), V(6, 7.6, -28), V(6, 6.2, -28)]],
  ['n2_p2', 'nitrogen', 'flowNitrogen', [0.45, 1], [V(33.4, 7.6, -41), V(33.4, 6.4, -41)]],
  ['eff_p1', 'effluent', 'flowEffluent', [0, 1], [V(6, 0.3, -0.6), V(6, 0.3, 22.5), V(-2.5, 0.3, 22.5), V(-2.5, 0.3, 56), V(-6, 0.3, 60)]],
  ['eff_p2', 'effluent', 'flowEffluent', [0, 0.6], [V(30, 0.3, -1.0), V(30, 0.3, 22.5), V(6, 0.3, 22.5)]],
  ['resin_p1', 'resin', 'flowResin', [0, 0.45], [V(12, 5.0, -1.5), V(12, 6.6, -1.5), V(12, 6.6, 16.6), V(47, 6.6, 16.6)]],
  ['resin_p2', 'resin', 'flowResin', [0.05, 0.4], [V(31, 5.0, -1.6), V(31, 6.6, -1.6), V(31, 6.6, 16.6)]],
  ['resin_bl', 'resin', 'flowResin', [0.4, 0.55], [V(47, 6.6, 16.6), V(50, 6.6, 16.6), V(50, 6.6, 12), V(50, 4.5, 12)]],
  ['resin_fg', 'resin', 'flowResin', [0.5, 1], [V(45.5, 5.0, 10), V(45.5, 6.0, 16.0), V(-48.6, 6.0, 16.0), V(-48.6, 6.0, -20), V(-55.5, 6.0, -20), V(-55.5, 3.0, -20)]],
  // solvent enters Plant 1 through the south end along the centre aisle (keeps the Act 2 hero shot clear)
  ['solvent', 'solvent', 'flowSolvent', [0, 1], [V(-35, 0.8, 61.2), V(-35, 6.0, 61.2), V(-35, 6.0, 53.0), V(-4.4, 6.0, 53.0), V(-4.4, 6.0, 20.2), V(8.0, 6.0, 20.2), V(8.0, 6.0, -2.5), V(8.0, 4.0, -2.5)]],
];

const FLOW_FRAG = /* glsl */`
uniform vec3 uColor; uniform float uTime; uniform float uReveal; uniform float uIntensity; uniform float uLen;
varying vec2 vUv;
void main(){
  float x = vUv.x;
  if (x > uReveal || uIntensity <= 0.001) discard;
  float s = x * uLen;
  float d = fract((s - uTime * 7.0) / 7.0);
  float pulse = smoothstep(0.0, 0.1, d) * smoothstep(0.55, 0.1, d);
  float head = exp(-pow((uReveal - x) * uLen / 2.5, 2.0)) * step(uReveal, 0.999);
  float a = (0.32 + 1.25 * pulse + 3.0 * head) * uIntensity;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

function roundedPath(points, radius = 1.2) {
  const path = new THREE.CurvePath();
  let prev = points[0].clone();
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (i < points.length - 1) {
      const n = points[i + 1];
      const r = Math.min(radius, p.distanceTo(prev) / 2.1, p.distanceTo(n) / 2.1);
      const a = p.clone().add(prev.clone().sub(p).normalize().multiplyScalar(r));
      const b = p.clone().add(n.clone().sub(p).normalize().multiplyScalar(r));
      if (a.distanceTo(prev) > 1e-3) path.add(new THREE.LineCurve3(prev.clone(), a));
      path.add(new THREE.QuadraticBezierCurve3(a, p.clone(), b));
      prev = b;
    } else {
      path.add(new THREE.LineCurve3(prev.clone(), p.clone()));
    }
  }
  return path;
}

export function buildFlows(world, M, B, tokens) {
  const root = new THREE.Group();
  world.scene.add(root);
  const flows = [];
  for (const [id, colorKey, state, range, pts] of ROUTES) {
    const path = roundedPath(pts);
    const len = path.getLength();
    const seg = Math.max(16, Math.round(len * 1.5));
    B.add(new THREE.TubeGeometry(path, seg, 0.13, 6, false), M.pipe, new THREE.Matrix4(), -1, { cast: false });
    const mat = new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: FLOW_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(tokens.color.flow[colorKey]).multiplyScalar(1.6) }, uTime: { value: 0 }, uReveal: { value: 0 }, uIntensity: { value: 0 }, uLen: { value: len } },
    });
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, seg, 0.3, 8, false), mat);
    mesh.renderOrder = 4;
    mesh.frustumCulled = false;
    root.add(mesh);
    flows.push({ id, state, range, mat, mesh });
  }
  // pipe-rack posts with cross beams
  const racks = [
    { from: V(18, 0, -46), to: V(18, 0, 2), y: 7.9 },
    { from: V(18, 0, 22), to: V(18, 0, 44.6), y: 7.9 },
    { from: V(-46, 0, 21.4), to: V(54, 0, 21.4), y: 7.0, cross: 'z' },
    { from: V(20, 0, 47.3), to: V(34, 0, 47.3), y: 7.6, cross: 'z' },
    { from: V(-4.4, 0, 25), to: V(-4.4, 0, 50), y: 6.6 },
    { from: V(8, 0, 1), to: V(8, 0, 17), y: 6.6 },
  ];
  for (const r of racks) {
    const L = r.from.distanceTo(r.to);
    const n = Math.max(2, Math.round(L / 9));
    for (let k = 0; k <= n; k++) {
      const p = r.from.clone().lerp(r.to, k / n);
      B.box(M.steelDark, p.x, r.y / 2, p.z, 0.3, r.y, 0.3, -1);
      if (r.cross === 'z') B.box(M.steelDark, p.x, 5.7, p.z - 2.6, 0.25, 0.25, 5.4, -1);
      else B.box(M.steelDark, p.x, 5.7, p.z, 2.8, 0.25, 0.25, -1);
    }
  }
  return {
    update(t, s, states) {
      const dim = s.flowsGlobalDim;
      for (const f of flows) {
        const kf = states[f.state];
        const reached = keyframesMax(kf, t);
        const now = keyframes(kf, t);
        const [a, b] = f.range;
        const reveal = clamp((reached - a) / (b - a));
        const intensity = reached > 0 ? (now / Math.max(reached, 1e-3)) : 0;
        f.mat.uniforms.uReveal.value = reveal;
        f.mat.uniforms.uIntensity.value = reveal > 0 ? intensity * dim : 0;
        f.mat.uniforms.uTime.value = t;
        f.mesh.visible = reveal > 0.001 && intensity * dim > 0.001;
      }
    },
  };
}
