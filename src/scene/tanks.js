// Tank farms (FG / RM / day tanks), blender building and the underground PESO solvent farm.
import * as THREE from 'three';
import { Batcher, patchRise, makeMat } from './materials.js';
import { riseDelay } from './site.js';
import { FG_FARM, RM_FARM, DAYTANK, BLENDER, PESO, FG_TANKS, BLENDERS } from './layout.js';

function tankDims(kl, ratio = 1.45) {
  // vertical tank with h = ratio·d
  const d = Math.cbrt((4 * kl) / (Math.PI * ratio));
  return { d, h: d * ratio };
}

function verticalTank(B, M, x, z, kl, mat, rise, ratio) {
  const { d, h } = tankDims(kl, ratio);
  B.mesh(new THREE.CylinderGeometry(d / 2, d / 2, h, 22), mat, [x, h / 2 + 0.3, z], [0, 0, 0], [1, 1, 1], rise);
  B.mesh(new THREE.ConeGeometry(d / 2 + 0.05, d * 0.12, 22), mat, [x, h + 0.3 + d * 0.06, z], [0, 0, 0], [1, 1, 1], rise);
  B.mesh(new THREE.CylinderGeometry(d / 2 + 0.25, d / 2 + 0.25, 0.3, 22), M.concrete, [x, 0.15, z], [0, 0, 0], [1, 1, 1], rise);
  B.box(M.yellow, x + d / 2 + 0.08, h / 2 + 0.4, z, 0.06, h, 0.35, rise, { cast: false });
  return { d, h };
}

const XRAY_FRAG = /* glsl */`
uniform float uXray; uniform float uTime; uniform vec3 uPad; uniform vec3 uGrid;
varying vec2 vUv; varying vec3 vWorld;
void main(){
  vec2 g = abs(fract(vWorld.xz / 2.5) - 0.5);
  float line = 1.0 - smoothstep(0.0, 0.05, min(g.x, g.y));
  float sd = (vUv.x - fract(uTime*0.22)) * 18.0;
  float scan = exp(-sd * sd);
  vec3 c = uPad * (1.0 - 0.6*uXray) + uGrid * (line * (0.05 + 1.5*uXray) + scan * uXray * 0.9);
  float a = mix(1.0, 0.22 + 0.35*line, uXray);
  gl_FragColor = vec4(c, a);
}`;

export function buildTanks(world, M, B, tokens) {
  const root = new THREE.Group();
  world.scene.add(root);

  // ---- finished-goods tank farm: 3 columns × 8 rows, 22 grade-dedicated tanks
  const dike = (F) => {
    const r = riseDelay(F.x, F.z);
    B.box(M.concrete, F.x, 0.06, F.z, F.w, 0.12, F.d, -1, { cast: false });
    B.box(M.concreteLight, F.x, 0.6, F.z - F.d / 2, F.w, 1.2, 0.3, r);
    B.box(M.concreteLight, F.x, 0.6, F.z + F.d / 2, F.w, 1.2, 0.3, r);
    B.box(M.concreteLight, F.x - F.w / 2, 0.6, F.z, 0.3, 1.2, F.d, r);
    B.box(M.concreteLight, F.x + F.w / 2, 0.6, F.z, 0.3, 1.2, F.d, r);
  };
  dike(FG_FARM);
  const fgBands = [];
  const slots = [];
  for (let row = 0; row < 8; row++) for (let col = 0; col < 3; col++) slots.push([FG_FARM.x + (col - 1) * 6.2, FG_FARM.z - FG_FARM.d / 2 + 2.8 + row * 5.15]);
  let si = 0;
  const bandMats = {};
  for (const grp of FG_TANKS) {
    for (let k = 0; k < grp.n; k++) {
      const [x, z] = slots[si++];
      const r = riseDelay(x, z, (si % 5) / 5);
      const { d, h } = verticalTank(B, M, x, z, grp.kl, M.steel, r, grp.kl > 50 ? 1.25 : 1.45);
      if (!bandMats[grp.service]) {
        bandMats[grp.service] = makeMat({ color: grp.color, emissive: grp.color, emissiveIntensity: 0, roughness: 0.4 });
      }
      const band = new THREE.Mesh(new THREE.CylinderGeometry(d / 2 + 0.04, d / 2 + 0.04, 0.55, 22, 1, true), bandMats[grp.service]);
      band.position.set(x, h * 0.72 + 0.3, z);
      root.add(band);
      fgBands.push(band);
    }
  }
  // pump manifold along the dike
  B.box(M.pipe, FG_FARM.x + FG_FARM.w / 2 + 0.9, 0.9, FG_FARM.z, 0.3, 0.3, FG_FARM.d - 2);

  // ---- raw-material tank farm: 2 × 7
  dike(RM_FARM);
  for (let row = 0; row < 7; row++) for (let col = 0; col < 2; col++) {
    const x = RM_FARM.x + (col - 0.5) * 6.0, z = RM_FARM.z - RM_FARM.d / 2 + 2.9 + row * 5.45;
    verticalTank(B, M, x, z, 48, row % 3 === 0 ? M.msPaint : M.steel, riseDelay(x, z, (row + col) / 9), 1.35);
  }

  // ---- day tank farm: 2 × 9 small tanks with colour-coded caps
  B.box(M.concrete, DAYTANK.x, 0.06, DAYTANK.z, DAYTANK.w, 0.12, DAYTANK.d, -1, { cast: false });
  const capCols = ['#22C55E', '#EF4444', '#A855F7', '#22C55E', '#EF4444', '#EF4444', '#A855F7', '#00A3E0', '#22C55E'];
  const capMats = capCols.map((c) => patchRise(makeMat({ color: c, emissive: c, emissiveIntensity: 0.25, roughness: 0.5 })));
  for (let i = 0; i < 9; i++) for (let row = 0; row < 2; row++) {
    const x = DAYTANK.x - DAYTANK.w / 2 + 2.2 + i * 3.7, z = DAYTANK.z + (row - 0.5) * 4.2;
    const r = riseDelay(x, z, i / 9);
    B.mesh(new THREE.CylinderGeometry(0.95, 0.95, 3.2, 16), M.steel, [x, 1.9, z], [0, 0, 0], [1, 1, 1], r);
    B.mesh(new THREE.CylinderGeometry(0.97, 0.97, 0.35, 16), capMats[i], [x, 3.6, z], [0, 0, 0], [1, 1, 1], r);
  }

  // ---- blender building: frame + 12 blenders, fading shell
  const BB = BLENDER;
  B.box(M.concreteLight, BB.x, 0.1, BB.z, BB.w, 0.2, BB.d, -1, { cast: false });
  for (const sx of [-1, 1]) for (let k = 0; k <= 5; k++) B.box(M.steelDark, BB.x + sx * (BB.w / 2 - 0.4), BB.h / 2, BB.z - BB.d / 2 + 0.4 + k * (BB.d - 0.8) / 5, 0.35, BB.h, 0.35);
  BLENDERS.forEach((bl, i) => {
    const col = i < 6 ? 0 : 1, row = i % 6;
    const x = BB.x - 1.2 + (col === 0 ? -3.0 : 3.0), z = BB.z - BB.d / 2 + 2.6 + row * 4.25;
    const d = bl.kl >= 30 ? 3.2 : 2.2, h = bl.kl >= 30 ? 4.2 : 2.6;
    B.mesh(new THREE.CylinderGeometry(d / 2, d / 2, h, 20), bl.ss ? M.steel : M.msPaint, [x, 1.2 + h / 2, z]);
    B.mesh(new THREE.SphereGeometry(d / 2, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), bl.ss ? M.steel : M.msPaint, [x, 1.2 + h, z], [0, 0, 0], [1, 0.35, 1]);
    B.box(M.msPaint, x, 1.2 + h + d * 0.17 + 0.5, z, 0.5, 0.8, 0.5);
    for (const lx of [-1, 1]) B.box(M.steelDark, x + lx * d * 0.35, 0.6, z, 0.15, 1.2, 0.15);
  });
  // filtration area on the west side (sparkler filters)
  for (let k = 0; k < 4; k++) B.mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.2, 12), M.steel, [BB.x + BB.w / 2 - 1.6, 0.8, BB.z - 6 + k * 2.6]);
  const shellMats = { wall: patchRise(M.wall.clone()), roof: patchRise(M.roof.clone()), glass: patchRise(M.glass.clone()) };
  const SB = new Batcher();
  const r0 = riseDelay(BB.x, BB.z);
  SB.box(shellMats.wall, BB.x, BB.h / 2, BB.z - BB.d / 2, BB.w, BB.h, 0.25, r0);
  SB.box(shellMats.wall, BB.x, BB.h / 2, BB.z + BB.d / 2, BB.w, BB.h, 0.25, r0);
  SB.box(shellMats.wall, BB.x - BB.w / 2, BB.h / 2, BB.z, 0.25, BB.h, BB.d, r0);
  SB.box(shellMats.wall, BB.x + BB.w / 2, BB.h / 2, BB.z, 0.25, BB.h, BB.d, r0);
  SB.box(shellMats.roof, BB.x, BB.h + 0.2, BB.z, BB.w + 0.5, 0.4, BB.d + 0.5, r0);
  for (const y of [3, 8]) {
    SB.box(shellMats.glass, BB.x - BB.w / 2 - 0.14, y, BB.z, 0.06, 1.2, BB.d * 0.9, r0, { cast: false });
    SB.box(shellMats.glass, BB.x + BB.w / 2 + 0.14, y, BB.z, 0.06, 1.2, BB.d * 0.9, r0, { cast: false });
  }
  const shellGroup = new THREE.Group();
  root.add(shellGroup);
  SB.build(shellGroup);
  let shellTransparent = false, shellCast = true;

  // ---- PESO underground solvent farm
  const pit = PESO.pit;
  const pw = pit.x1 - pit.x0, pd = pit.z1 - pit.z0, py = -pit.depth / 2;
  const pitMat = makeMat({ color: '#3A4B5E', roughness: 0.95, side: THREE.BackSide });
  const pitBox = new THREE.Mesh(new THREE.BoxGeometry(pw, pit.depth, pd), pitMat);
  pitBox.position.set((pit.x0 + pit.x1) / 2, py, (pit.z0 + pit.z1) / 2);
  pitBox.receiveShadow = true;
  root.add(pitBox);
  // sand bed
  const sand = new THREE.Mesh(new THREE.BoxGeometry(pw - 0.4, 0.6, pd - 0.4), makeMat({ color: '#6B5B3E', roughness: 1 }));
  sand.position.set((pit.x0 + pit.x1) / 2, -pit.depth + 0.3, (pit.z0 + pit.z1) / 2);
  root.add(sand);
  const pesoShell = makeMat({ color: '#C3CED9', metalness: 0.7, roughness: 0.3, transparent: true, opacity: 1 });
  const solventMat = makeMat({ color: '#0E7490', emissive: tokens.color.flow.solvent, emissiveIntensity: 0.9, roughness: 0.2, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const fillPlanes = [];
  const pesoTanks = [];
  const L = 8.5, TR = 1.4;
  const xs = [-53.6, -49.4, -45.2, -38.8, -34.4, -30.0];
  for (const x of xs) for (const z of [66.7, 77.0]) {
    const g = new THREE.Group();
    g.position.set(x, -2.75, z);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(TR, TR, L, 28), pesoShell);
    body.rotation.x = Math.PI / 2;
    g.add(body);
    for (const s of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(TR, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), pesoShell);
      cap.scale.set(1, 0.3, 1);
      cap.rotation.x = s * Math.PI / 2;
      cap.position.z = s * L / 2;
      g.add(cap);
    }
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    fillPlanes.push(plane);
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(TR * 0.94, TR * 0.94, L * 0.97, 28), solventMat.clone());
    liquid.material.clippingPlanes = [plane];
    liquid.rotation.x = Math.PI / 2;
    g.add(liquid);
    // manhole + vent above grade
    B.mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.7, 12), M.steelDark, [x, 0.35, z - 2]);
    B.mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), M.pipe, [x + 0.6, 1.6, z + 2.5]);
    B.mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 8), M.yellow, [x + 0.6, 3.25, z + 2.5]);
    root.add(g);
    pesoTanks.push(g);
  }
  // pump house + unloading bay on the west part of the PESO area
  B.box(M.wall, -66.5, 2.2, 66, 7, 4.4, 7, riseDelay(-66.5, 66));
  B.box(M.roof, -66.5, 4.6, 66, 7.6, 0.4, 7.6, riseDelay(-66.5, 66));
  B.box(M.concrete, -66.5, 0.06, 77, 9, 0.12, 9, -1, { cast: false });
  const xrayMat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; varying vec3 vWorld; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: XRAY_FRAG, transparent: true, side: THREE.DoubleSide,
    uniforms: { uXray: { value: 0 }, uTime: { value: 0 }, uPad: { value: new THREE.Color(tokens.color.scene.sitePad) }, uGrid: { value: new THREE.Color('#38BDF8') } },
  });
  const xray = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), xrayMat);
  xray.rotation.x = -Math.PI / 2;
  xray.position.set((pit.x0 + pit.x1) / 2, 0.02, (pit.z0 + pit.z1) / 2);
  xray.renderOrder = 3;
  root.add(xray);
  const pitEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(pw, pit.depth, pd)), new THREE.LineBasicMaterial({ color: new THREE.Color('#22D3EE').multiplyScalar(2.2), transparent: true, opacity: 0, toneMapped: false }));
  pitEdges.position.copy(pitBox.position);
  root.add(pitEdges);

  return {
    anchors: {
      fgTankFarm: new THREE.Vector3(FG_FARM.x, 9, FG_FARM.z),
      rmTankFarm: new THREE.Vector3(RM_FARM.x, 8, RM_FARM.z),
      peso: new THREE.Vector3(PESO.x, 1.5, PESO.z),
      pesoTanks: new THREE.Vector3(-41.6, -1.6, 66.7),
      blender: new THREE.Vector3(BB.x, BB.h + 1, BB.z),
      dayTank: new THREE.Vector3(DAYTANK.x, 4.5, DAYTANK.z),
    },
    update(t, s) {
      // grade colours on FG tank bands
      for (const m of Object.values(bandMats)) m.emissiveIntensity = 0.15 + 1.6 * s.tankGradeColors;
      // blender shell
      const c = s.blenderCutaway, op = 1 - 0.94 * c, tr = op < 0.999;
      for (const m of Object.values(shellMats)) {
        m.opacity = op;
        if (tr !== shellTransparent) { m.transparent = tr; m.depthWrite = !tr; m.needsUpdate = true; }
      }
      shellTransparent = tr;
      shellGroup.visible = c < 0.985;
      let changed = false;
      const cast = c < 0.5;
      if (cast !== shellCast) { shellGroup.traverse((o) => { if (o.isMesh) o.castShadow = cast; }); shellCast = cast; changed = true; }
      // PESO x-ray
      const x = s.pesoXray;
      xrayMat.uniforms.uXray.value = x;
      xrayMat.uniforms.uTime.value = t;
      xrayMat.depthWrite = x < 0.01;
      pitEdges.material.opacity = x * 0.9;
      pitEdges.visible = x > 0.01;
      const showUnder = x > 0.01;
      for (const g of pesoTanks) g.visible = showUnder;
      pitBox.visible = sand.visible = showUnder;
      pesoShell.opacity = 1 - 0.62 * x;
      pesoShell.depthWrite = pesoShell.opacity > 0.99;
      const level = -2.75 - TR + 2 * TR * s.pesoFill;
      fillPlanes.forEach((p, i) => { p.constant = level + Math.sin(t * 1.3 + i) * 0.02; });
      return changed;
    },
  };
}
