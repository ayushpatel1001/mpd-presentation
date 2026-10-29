// Plant 2 finishing bay: double-belt flaker, pelletiser (rotoformer + steel belt),
// product crusher and tray casting. All motion is a closed-form function of t.
import * as THREE from 'three';
import { makeMat } from './materials.js';
import { hash } from '../lib/util.js';

const FLAKER = { x: 26.0, z0: -14.6, z1: -4.6, y: 1.45, w: 1.5 };
const PELLET = { x: 33.4, z0: -14.2, z1: -5.0, y: 1.15, w: 1.3 };
const BELT_SPEED = 0.55;    // m/s
const PELLET_SPEED = 0.42;

function beltTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#9AA8B6'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#7C8A99';
  for (let i = 0; i < 64; i += 16) g.fillRect(0, i, 64, 3);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const SHEET_FRAG = /* glsl */`
uniform float uTime; uniform float uRun;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
void main(){
  float u = vUv.y;                         // 0 at feed, 1 at breaker
  vec3 hot = vec3(5.5, 2.3, 0.35);
  vec3 cool = vec3(0.93, 0.80, 0.52);
  float k = smoothstep(0.0, 0.75, u);
  vec3 c = mix(hot, cool, k);
  float streak = h(vec2(floor(vUv.x*40.0), floor((u - uTime*0.055)*90.0)));
  c *= 0.92 + 0.12*streak;
  float edge = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
  float fill = step(u, uRun);
  gl_FragColor = vec4(c * edge, edge * fill);
}`;

export function buildFinishing(world, M) {
  const root = new THREE.Group();
  world.scene.add(root);
  const L = FLAKER.z1 - FLAKER.z0;
  const zc = (FLAKER.z0 + FLAKER.z1) / 2;
  const frameMat = makeMat({ color: '#00529B', metalness: 0.35, roughness: 0.45 });
  const steel = makeMat({ color: '#C3CED9', metalness: 0.8, roughness: 0.3 });
  const dark = makeMat({ color: '#334155', metalness: 0.5, roughness: 0.5 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.castShadow = true; m.receiveShadow = true;
    root.add(m); return m;
  };

  // ---- double-belt flaker
  const beltTex = beltTexture();
  beltTex.repeat.set(1, L / 1.2);
  const beltMat = makeMat({ color: '#B8C4D0', map: beltTex, metalness: 0.8, roughness: 0.25 });
  const upperTex = beltTex.clone();
  upperTex.repeat.set(1, L / 1.2);
  const upperMat = makeMat({ color: '#B8C4D0', map: upperTex, metalness: 0.8, roughness: 0.25, transparent: true, opacity: 0.35, depthWrite: false });
  add(new THREE.BoxGeometry(FLAKER.w, 0.06, L), beltMat, FLAKER.x, FLAKER.y, zc);
  // upper belt is translucent so the resin sheet between the belts stays visible
  add(new THREE.BoxGeometry(FLAKER.w, 0.05, L * 0.82), upperMat, FLAKER.x, FLAKER.y + 0.32, zc - L * 0.06);
  for (const side of [-1, 1]) {
    add(new THREE.BoxGeometry(0.12, 0.5, L + 0.8), frameMat, FLAKER.x + side * (FLAKER.w / 2 + 0.1), FLAKER.y + 0.05, zc);
    for (let k = 0; k <= 5; k++) add(new THREE.BoxGeometry(0.14, FLAKER.y, 0.14), dark, FLAKER.x + side * (FLAKER.w / 2 + 0.1), FLAKER.y / 2, FLAKER.z0 + (k / 5) * L);
  }
  const drums = [];
  for (const [zz, yy] of [[FLAKER.z0, FLAKER.y], [FLAKER.z1, FLAKER.y], [FLAKER.z0 + 0.4, FLAKER.y + 0.32], [FLAKER.z1 - L * 0.12, FLAKER.y + 0.32]]) {
    drums.push(add(new THREE.CylinderGeometry(0.28, 0.28, FLAKER.w + 0.1, 20), steel, FLAKER.x, yy, zz, 0, 0, Math.PI / 2));
  }
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(FLAKER.w * 0.9, L), new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){ vUv = vec2(uv.x, 1.0 - uv.y); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: SHEET_FRAG, transparent: true, uniforms: { uTime: { value: 0 }, uRun: { value: 1 } },
  }));
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.set(FLAKER.x, FLAKER.y + 0.045, zc);
  root.add(sheet);
  // feed nozzle + cooling spray manifold
  add(new THREE.BoxGeometry(FLAKER.w * 0.9, 0.25, 0.3), frameMat, FLAKER.x, FLAKER.y + 0.75, FLAKER.z0 + 0.15);
  for (let k = 0; k < 6; k++) add(new THREE.CylinderGeometry(0.03, 0.03, FLAKER.w, 6), dark, FLAKER.x, FLAKER.y - 0.35, FLAKER.z0 + 1 + k * 1.5, 0, 0, Math.PI / 2);
  // breaker roll with teeth
  const breaker = new THREE.Group();
  breaker.position.set(FLAKER.x, FLAKER.y - 0.15, FLAKER.z1 + 0.55);
  breaker.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, FLAKER.w, 16), steel).rotateZ(Math.PI / 2));
  for (let k = 0; k < 18; k++) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.06), dark);
    const a = (k % 6) / 6 * Math.PI * 2;
    tooth.position.set(-FLAKER.w / 2 + 0.15 + (k / 18) * (FLAKER.w - 0.3), Math.cos(a) * 0.24, Math.sin(a) * 0.24);
    tooth.rotation.x = a;
    breaker.add(tooth);
  }
  root.add(breaker);
  // hopper + packing
  const hz = FLAKER.z1 + 1.1;
  add(new THREE.CylinderGeometry(0.9, 0.25, 1.0, 4, 1, true), dark, FLAKER.x, 0.95, hz, 0, Math.PI / 4, 0).material.side = THREE.DoubleSide;
  add(new THREE.BoxGeometry(1.6, 0.4, 1.6), frameMat, FLAKER.x, 0.2, hz);
  const bagMat = makeMat({ color: '#E8EEF5', roughness: 0.85 });
  const bagBlue = makeMat({ color: '#00529B', roughness: 0.8 });
  for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) for (let l = 0; l < 2; l++)
    add(new THREE.BoxGeometry(0.55, 0.22, 0.8), (i + k + l) % 2 ? bagMat : bagBlue, FLAKER.x - 1.9 + k * 0.6, 0.2 + i * 0.23, hz + 0.6 + l * 0.85);
  add(new THREE.BoxGeometry(1.4, 0.14, 1.9), makeMat({ color: '#8B5E34', roughness: 0.9 }), FLAKER.x - 1.6, 0.07, hz + 1.0);

  // flakes
  const NF = 260;
  const flakeGeo = new THREE.BoxGeometry(0.11, 0.015, 0.08);
  const flakes = new THREE.InstancedMesh(flakeGeo, makeMat({ color: '#F1E2B8', roughness: 0.6, emissive: '#FBBF24', emissiveIntensity: 0.15 }), NF);
  flakes.frustumCulled = false;
  root.add(flakes);

  // ---- pelletiser: rotoformer drum over a steel belt
  const PL = PELLET.z1 - PELLET.z0, pz = (PELLET.z0 + PELLET.z1) / 2;
  const pbTex = beltTexture();
  pbTex.repeat.set(1, PL / 1.2);
  add(new THREE.BoxGeometry(PELLET.w, 0.06, PL), makeMat({ color: '#B8C4D0', map: pbTex, metalness: 0.85, roughness: 0.22 }), PELLET.x, PELLET.y, pz);
  for (const side of [-1, 1]) {
    add(new THREE.BoxGeometry(0.1, 0.35, PL + 0.6), makeMat({ color: '#2E7D32', metalness: 0.3, roughness: 0.5 }), PELLET.x + side * (PELLET.w / 2 + 0.08), PELLET.y, pz);
    for (let k = 0; k <= 4; k++) add(new THREE.BoxGeometry(0.12, PELLET.y, 0.12), dark, PELLET.x + side * (PELLET.w / 2 + 0.08), PELLET.y / 2, PELLET.z0 + (k / 4) * PL);
  }
  const drum = add(new THREE.CylinderGeometry(0.32, 0.32, PELLET.w * 0.95, 24), makeMat({ color: '#D7DEE6', metalness: 0.85, roughness: 0.25, emissive: '#F59E0B', emissiveIntensity: 0.25 }), PELLET.x, PELLET.y + 0.38, PELLET.z0 + 0.5, 0, 0, Math.PI / 2);
  add(new THREE.BoxGeometry(PELLET.w, 0.5, 0.5), makeMat({ color: '#2E7D32', metalness: 0.3, roughness: 0.5 }), PELLET.x, PELLET.y + 0.95, PELLET.z0 + 0.5);
  add(new THREE.BoxGeometry(1.3, 0.9, 1.1), dark, PELLET.x, 0.45, PELLET.z1 + 0.9);
  const COLS = 5, ROWS = Math.floor(PL / 0.2);
  const NP = COLS * ROWS;
  const pellets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), makeMat({ color: '#ffffff', roughness: 0.4, metalness: 0.0 }), NP);
  pellets.frustumCulled = false;
  root.add(pellets);
  const hotC = new THREE.Color('#FDBA74').multiplyScalar(2.6), coolC = new THREE.Color('#F5E6B8');
  const tmpC = new THREE.Color();
  for (let i = 0; i < NP; i++) pellets.setColorAt(i, coolC);

  // ---- crusher and tray casting
  add(new THREE.BoxGeometry(2.0, 1.6, 1.6), makeMat({ color: '#00529B', metalness: 0.35, roughness: 0.45 }), 29.6, 0.8, -3.0);
  add(new THREE.CylinderGeometry(0.85, 0.3, 0.9, 4, 1, true), dark, 29.6, 2.05, -3.0, 0, Math.PI / 4, 0).material.side = THREE.DoubleSide;
  const trayMat = makeMat({ color: '#94A3B8', metalness: 0.7, roughness: 0.35 });
  const resinTray = makeMat({ color: '#B45309', emissive: '#F59E0B', emissiveIntensity: 0.35, roughness: 0.3 });
  for (let rck = 0; rck < 2; rck++) {
    for (let lvl = 0; lvl < 6; lvl++) {
      const xx = 34.6 + rck * 1.6, yy = 0.25 + lvl * 0.32;
      add(new THREE.BoxGeometry(1.2, 0.05, 0.9), trayMat, xx, yy, -2.8);
      add(new THREE.BoxGeometry(1.1, 0.04, 0.8), resinTray, xx, yy + 0.04, -2.8);
    }
    for (const dx of [-0.6, 0.6]) for (const dz of [-0.45, 0.45]) add(new THREE.BoxGeometry(0.05, 2.0, 0.05), dark, 34.6 + rck * 1.6 + dx, 1.0, -2.8 + dz);
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s1 = new THREE.Vector3(), v = new THREE.Vector3();
  const anchors = {
    flakerFeed: new THREE.Vector3(FLAKER.x, FLAKER.y + 0.8, FLAKER.z0 + 0.2),
    flakerBreaker: new THREE.Vector3(FLAKER.x, FLAKER.y, FLAKER.z1 + 0.6),
    pelletiser: new THREE.Vector3(PELLET.x, PELLET.y + 0.5, PELLET.z0 + 0.6),
  };

  return {
    anchors,
    update(t, s) {
      const run = s.finishingRun;
      const travel = t * BELT_SPEED * run;
      beltTex.offset.y = travel / 1.2;
      upperTex.offset.y = travel / 1.2;
      for (const d of drums) d.rotation.x = -travel / 0.28;
      sheet.material.uniforms.uTime.value = t * run;
      sheet.material.uniforms.uRun.value = run > 0.01 ? 1 : 0;
      breaker.rotation.x = -t * 6 * run;
      // flakes: spawn at the breaker, fly out and fall into the hopper
      for (let i = 0; i < NF; i++) {
        const life = 1.15 + hash(i * 1.7) * 0.4;
        const u = (t / life + hash(i * 3.3)) % 1;
        const tt = u * life;
        const x0 = FLAKER.x + (hash(i * 5.1) - 0.5) * FLAKER.w * 0.85;
        const vz = 0.55 + hash(i * 2.9) * 0.6, vy = 0.4 + hash(i * 8.2) * 0.5;
        const y = FLAKER.y - 0.05 + vy * tt - 4.9 * tt * tt;
        const z = FLAKER.z1 + 0.45 + vz * tt;
        const visible = run > 0.2 && y > 0.6;
        v.set(x0 + (hash(i * 4.4) - 0.5) * 0.3 * tt, Math.max(y, 0.6), Math.min(z, hz + 0.5));
        e.set(tt * 9 * hash(i), tt * 7, tt * 11 * hash(i * 2.2));
        q.setFromEuler(e);
        const sc = visible ? 0.8 + hash(i * 9.9) * 0.6 : 0.0001;
        m4.compose(v, q, s1.set(sc, sc, sc));
        flakes.setMatrixAt(i, m4);
      }
      flakes.instanceMatrix.needsUpdate = true;
      // pellets: deposited by the drum, travel on the belt, cool from glowing amber to pale yellow
      drum.rotation.x = -t * PELLET_SPEED / 0.32 * run;
      const ptravel = t * PELLET_SPEED * run;
      const pitch = PL / ROWS;
      const q0 = new THREE.Quaternion();
      for (let r = 0; r < ROWS; r++) {
        const zr = ((r * pitch + ptravel) % PL);
        for (let c = 0; c < COLS; c++) {
          const i = r * COLS + c;
          const x = PELLET.x - PELLET.w / 2 + 0.16 + c * (PELLET.w - 0.32) / (COLS - 1);
          const zz = PELLET.z0 + 0.5 + zr;
          const show = run > 0.05 && zz < PELLET.z1 - 0.05;
          v.set(x, PELLET.y + 0.03, Math.min(zz, PELLET.z1));
          const sc = show ? 1 : 0.0001;
          m4.compose(v, q0, s1.set(sc, sc * 0.8, sc));
          pellets.setMatrixAt(i, m4);
          const k = Math.min(1, zr / (PL * 0.7));
          tmpC.copy(hotC).lerp(coolC, k);
          pellets.setColorAt(i, tmpC);
        }
      }
      pellets.instanceMatrix.needsUpdate = true;
      pellets.instanceColor.needsUpdate = true;
    },
  };
}
