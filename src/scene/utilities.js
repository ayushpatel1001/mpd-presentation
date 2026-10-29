// Utilities & EHS block: thermic fluid heaters (agro-waste fired), steam generator, stacks,
// agro-waste silo + bag filters, covered agro-waste fuel shed, 2,200 TR cooling tower, N2 generator, 50 KLD ETP.
import * as THREE from 'three';
import { makeMat, patchRise } from './materials.js';
import { frameOf, ribTexture, ribbedBox } from './peb.js';
import { riseDelay } from './site.js';
import { BOILER, FUEL, COOLING, N2GEN, ETP } from './layout.js';
import { hash } from '../lib/util.js';

function softSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Rising plume as point sprites; positions are a function of t only.
function plume(root, origin, n, opts) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: softSprite(), color: opts.color, size: opts.size, sizeAttenuation: true, transparent: true, opacity: opts.opacity, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  root.add(pts);
  return (t, strength) => {
    for (let i = 0; i < n; i++) {
      const life = opts.life * (0.8 + hash(i * 3.7) * 0.4);
      const u = ((t / life) + hash(i * 1.9)) % 1;
      const tt = u * life;
      pos[i * 3] = origin.x + (hash(i * 5.3) - 0.5) * opts.spread * (0.3 + u) + opts.drift[0] * tt;
      pos[i * 3 + 1] = origin.y + opts.rise * tt;
      pos[i * 3 + 2] = origin.z + (hash(i * 8.1) - 0.5) * opts.spread * (0.3 + u) + opts.drift[1] * tt;
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = opts.opacity * strength;
    pts.visible = strength > 0.01;
  };
}

export function buildUtilities(world, M, B) {
  const root = new THREE.Group();
  world.scene.add(root);
  const rb = riseDelay(BOILER.x, BOILER.z);
  const { x, z, w, d } = BOILER;

  // boiler house: open shed on columns
  B.box(M.concreteLight, x, 0.1, z, w, 0.2, d, -1, { cast: false });
  for (let i = 0; i <= 6; i++) for (const sz of [-1, 1]) B.box(M.steelDark, x - w / 2 + 1 + i * (w - 2) / 6, 5.5, z + sz * (d / 2 - 0.6), 0.45, 11, 0.45, rb);
  for (let i = 0; i < 6; i++) B.box(M.steelDark, x - w / 2 + 2 + i * 4.6, 11.2, z, 0.3, 0.45, d, rb);
  B.box(M.roof, x + 8, 11.2, z, 14, 0.4, d + 0.6, rb);
  B.box(M.wallDark, x - w / 2 + 0.2, 5.5, z, 0.3, 11, d, rb);

  // two thermic fluid heaters + thermic-heated steam generator
  const heaterMat = makeMat({ color: '#475569', metalness: 0.55, roughness: 0.45 });
  const flameMats = [];
  const heaters = [];
  for (const [hz, L, Rr] of [[z - 6.0, 9, 1.6], [z + 0.5, 9, 1.6], [z + 7.0, 6, 1.2]]) {
    const hx = x - 8;
    B.mesh(new THREE.CylinderGeometry(Rr, Rr, L, 24), heaterMat, [hx, Rr + 0.6, hz], [0, 0, Math.PI / 2], [1, 1, 1], rb);
    B.box(M.steelDark, hx, 0.4, hz, L - 1, 0.8, Rr * 1.6, rb);
    const fm = makeMat({ color: '#7C2D12', emissive: '#F59E0B', emissiveIntensity: 0.6 });
    flameMats.push(fm);
    const door = new THREE.Mesh(new THREE.CircleGeometry(Rr * 0.55, 20), fm);
    door.position.set(hx - L / 2 - 0.02, Rr + 0.6, hz);
    door.rotation.y = -Math.PI / 2;
    root.add(door);
    // feed hopper above the furnace
    B.mesh(new THREE.CylinderGeometry(0.9, 0.35, 1.6, 4), M.steelDark, [hx - L / 2 + 1.2, 2 * Rr + 1.6, hz], [0, Math.PI / 4, 0], [1, 1, 1], rb);
    heaters.push(new THREE.Vector3(hx, Rr + 0.6, hz));
  }
  // flue ducts to bag filters, then to stacks
  for (const hz of [z - 6.0, z + 0.5]) {
    B.box(M.steelDark, x + 3.5, 5.6, hz, 14, 0.9, 0.9, rb);
    // bag filter
    B.box(M.msPaint, x + 11, 4.2, hz, 3.2, 4.2, 3.2, rb);
    B.mesh(new THREE.ConeGeometry(2.2, 2.0, 4), M.msPaint, [x + 11, 1.3, hz], [Math.PI, Math.PI / 4, 0], [1, 1, 1], rb);
    // stack
    B.mesh(new THREE.CylinderGeometry(0.75, 0.95, 30, 18), M.steel, [x + 17, 15, hz], [0, 0, 0], [1, 1, 1], rb);
    B.mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.6, 18), M.yellow, [x + 17, 26, hz], [0, 0, 0], [1, 1, 1], rb);
  }
  // ash handling conveyor
  B.box(M.steelDark, x + 2, 1.0, z + d / 2 - 2.2, 20, 0.35, 0.8, rb);
  // agro-waste silo with front-loader charging
  const sx = x - w / 2 + 4.5, sz = z - d / 2 + 4.5;
  B.mesh(new THREE.CylinderGeometry(2.6, 2.6, 13, 24), M.steel, [sx, 7.5, sz], [0, 0, 0], [1, 1, 1], rb);
  B.mesh(new THREE.ConeGeometry(2.7, 1.6, 24), M.steel, [sx, 14.8, sz], [0, 0, 0], [1, 1, 1], rb);
  B.mesh(new THREE.ConeGeometry(2.6, 1.0, 24), M.steel, [sx, 0.5, sz], [Math.PI, 0, 0], [1, 1, 1], rb);
  for (const [lx, lz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) B.box(M.steelDark, sx + lx, 0.6, sz + lz, 0.3, 1.2, 0.3, rb);
  B.box(M.steelDark, (sx + x - 8) / 2, 9.0, sz, Math.abs(x - 8 - sx), 0.6, 0.9, rb);

  // agro-waste fuel shed over the fuel yard
  const shed = fuelShed(B, M);

  // cooling tower: 2 fan cells
  const rc = riseDelay(COOLING.x, COOLING.z);
  B.box(M.wallDark, COOLING.x, COOLING.h / 2, COOLING.z, COOLING.w, COOLING.h, COOLING.d, rc);
  for (let k = 0; k < 6; k++) B.box(M.concrete, COOLING.x + COOLING.w / 2 + 0.03, 1.2 + k * 0.6, COOLING.z, 0.06, 0.28, COOLING.d * 0.9, rc, { cast: false });
  B.box(M.concrete, COOLING.x, 0.5, COOLING.z, COOLING.w + 1.6, 1.0, COOLING.d + 1.6, rc);
  const fans = [];
  const fanMat = makeMat({ color: '#1E293B', metalness: 0.4, roughness: 0.5 });
  for (const fz of [COOLING.z - 4, COOLING.z + 4]) {
    B.mesh(new THREE.CylinderGeometry(2.6, 2.9, 2.2, 28, 1, true), M.steel, [COOLING.x, COOLING.h + 1.1, fz], [0, 0, 0], [1, 1, 1], rc);
    const fan = new THREE.Group();
    fan.position.set(COOLING.x, COOLING.h + 1.4, fz);
    for (let b = 0; b < 6; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.05, 0.42), fanMat);
      blade.position.x = 1.2;
      const holder = new THREE.Group();
      holder.rotation.y = (b / 6) * Math.PI * 2;
      blade.rotation.x = 0.25;
      holder.add(blade);
      fan.add(holder);
    }
    fan.add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.4, 12), M.steelDark));
    root.add(fan);
    fans.push(fan);
  }

  // N2 generator skid: two PSA columns, receiver, compressor
  const rn = riseDelay(N2GEN.x, N2GEN.z);
  B.box(M.concreteLight, N2GEN.x, 0.15, N2GEN.z, N2GEN.w, 0.3, N2GEN.d, -1, { cast: false });
  const psaMat = makeMat({ color: '#7DD3FC', metalness: 0.3, roughness: 0.4 });
  for (const dx of [-1.2, 0]) B.mesh(new THREE.CylinderGeometry(0.45, 0.45, 3.4, 16), psaMat, [N2GEN.x + dx, 2.0, N2GEN.z - 2], [0, 0, 0], [1, 1, 1], rn);
  B.mesh(new THREE.CylinderGeometry(0.75, 0.75, 3.8, 18), M.steel, [N2GEN.x + 1.6, 2.2, N2GEN.z - 1.5], [0, 0, 0], [1, 1, 1], rn);
  B.box(M.msPaint, N2GEN.x, 1.0, N2GEN.z + 2.2, 3.0, 1.6, 2.2, rn);

  // 50 KLD ETP: oil & grease trap + equalisation, flash mixer / primary settler, MBBR aeration, secondary
  // clarifier, pressure sand + activated carbon filters, treated-water tank, filter press, sludge drying beds
  const re = riseDelay(ETP.x, ETP.z);
  B.box(M.concrete, ETP.x, 0.06, ETP.z, ETP.w, 0.12, ETP.d, -1, { cast: false });
  const waterMat = makeMat({ color: '#0C4A5E', emissive: '#10B981', emissiveIntensity: 0.25, roughness: 0.1, metalness: 0.2 });
  const ripples = [];
  const basin = (cx, cz, w, d, h) => {
    for (const [ox, oz, bw, bd] of [[0, -d / 2, w, 0.25], [0, d / 2, w, 0.25], [-w / 2, 0, 0.25, d], [w / 2, 0, 0.25, d]]) B.box(M.concreteLight, cx + ox, h / 2, cz + oz, bw, h, bd, re);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.25, d - 0.25), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(cx, h - 0.25, cz);
    root.add(water);
  };
  basin(ETP.x + 5.5, ETP.z - 7.5, 6.5, 4.2, 2.4);                 // collection + equalisation
  basin(ETP.x + 5.5, ETP.z - 1.5, 6.5, 4.6, 3.0);                 // MBBR aeration
  B.box(M.pipe, ETP.x + 5.5, 3.1, ETP.z - 1.5, 6.0, 0.12, 0.12, re);   // air header
  for (const [cx, cz] of [[ETP.x - 1.0, ETP.z - 7.5], [ETP.x - 1.0, ETP.z - 1.5]]) {   // primary + secondary clarifiers
    B.mesh(new THREE.CylinderGeometry(1.7, 1.7, 2.8, 28, 1, true), M.concreteLight, [cx, 1.4, cz], [0, 0, 0], [1, 1, 1], re);
    const water = new THREE.Mesh(new THREE.CircleGeometry(1.62, 28), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(cx, 2.55, cz);
    root.add(water);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.18, 0.45), M.yellow);
    bridge.position.set(cx, 2.95, cz);
    root.add(bridge);
    ripples.push(bridge);
  }
  B.box(M.steel, ETP.x - 1.0, 1.4, ETP.z - 4.6, 1.2, 2.8, 1.2, re);                        // flash mixer / flocculator
  for (const [k, cz] of [[0, ETP.z + 1.8], [1, ETP.z + 3.2]]) {                             // PSF + ACF
    B.mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.0, 16), k ? M.msPaint : M.steel, [ETP.x - 6.0, 1.4, cz], [0, 0, 0], [1, 1, 1], re);
    B.mesh(new THREE.SphereGeometry(0.55, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), k ? M.msPaint : M.steel, [ETP.x - 6.0, 2.4, cz], [0, 0, 0], [1, 1, 0.5], re);
  }
  B.mesh(new THREE.CylinderGeometry(1.6, 1.6, 3.0, 24), M.bagBlue, [ETP.x - 6.0, 1.6, ETP.z - 4.0], [0, 0, 0], [1, 1, 1], re);   // treated-water tank
  B.mesh(new THREE.ConeGeometry(1.65, 0.4, 24), M.bagBlue, [ETP.x - 6.0, 3.3, ETP.z - 4.0], [0, 0, 0], [1, 1, 1], re);
  for (const [a0, a1] of [[[ETP.x + 2.2, 1.8, ETP.z - 7.5], [ETP.x + 0.7, 1.8, ETP.z - 7.5]], [[ETP.x - 1.0, 1.0, ETP.z - 5.8], [ETP.x - 1.0, 1.0, ETP.z - 3.2]],
    [[ETP.x + 0.7, 1.8, ETP.z - 1.5], [ETP.x + 2.2, 1.8, ETP.z - 1.5]], [[ETP.x - 2.7, 1.0, ETP.z - 1.5], [ETP.x - 6.0, 1.0, ETP.z - 1.5]]]) {
    const pa = new THREE.Vector3(...a0), pb = new THREE.Vector3(...a1);
    B.mesh(new THREE.CylinderGeometry(0.09, 0.09, pa.distanceTo(pb), 8), M.pipe, pa.clone().add(pb).multiplyScalar(0.5).toArray(), pa.x === pb.x ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2], [1, 1, 1], re);
  }
  for (let k = 0; k < 3; k++) {                                                              // sludge drying beds
    B.box(M.concreteLight, ETP.x + 5.0, 0.35, ETP.z + 3.6 + k * 2.9, 6.0, 0.7, 2.6, re);
    B.box(M.biomass, ETP.x + 5.0, 0.62, ETP.z + 3.6 + k * 2.9, 5.6, 0.12, 2.2, re, { cast: false });
  }
  B.box(M.msPaint, ETP.x + 0.8, 0.8, ETP.z + 6.5, 2.6, 1.3, 1.2, re);                         // filter press
  B.box(M.wall, ETP.x - 6.0, 1.8, ETP.z + 8.0, 5, 3.6, 3.2, re);                              // ETP control room + lab
  B.box(M.roof, ETP.x - 6.0, 3.75, ETP.z + 8.0, 5.4, 0.3, 3.6, re);

  // plumes
  const stackPlumes = [z - 6.0, z + 0.5].map((hz) => plume(root, new THREE.Vector3(x + 17, 30.5, hz), 70, { color: '#CBD5E1', size: 2.4, opacity: 0.28, life: 7, rise: 2.6, spread: 4, drift: [1.6, -0.6] }));
  const towerPlumes = [COOLING.z - 4, COOLING.z + 4].map((fz) => plume(root, new THREE.Vector3(COOLING.x, COOLING.h + 2.6, fz), 60, { color: '#E2E8F0', size: 2.5, opacity: 0.24, life: 4.5, rise: 2.2, spread: 3.2, drift: [0.8, -0.4] }));

  return {
    fuelShed: shed,
    anchors: {
      boiler: new THREE.Vector3(x, 13, z),
      heaters: new THREE.Vector3(x - 8, 4.2, z - 2.5),
      silo: new THREE.Vector3(sx, 12, sz),
      coolingTower: new THREE.Vector3(COOLING.x, COOLING.h + 3, COOLING.z),
      n2: new THREE.Vector3(N2GEN.x, 4.5, N2GEN.z),
      etp: new THREE.Vector3(ETP.x + 2.5, 3.2, ETP.z - 4.5),
      fuelShed: new THREE.Vector3(FUEL.x, 9.5, FUEL.z),
    },
    update(t, s) {
      const glow = s.utilityGlow;
      flameMats.forEach((m, i) => { m.emissiveIntensity = 0.5 + glow * (1.8 + 0.5 * Math.sin(t * 7.3 + i * 2) + 0.3 * Math.sin(t * 13.1 + i)); });
      for (const f of fans) f.rotation.y = t * 2.2;
      ripples.forEach((b, i) => { b.rotation.y = t * 0.12 + i; });
      waterMat.emissiveIntensity = 0.25 + 0.35 * glow;
      const plumeOn = 0.55 + 0.45 * glow;
      for (const p of stackPlumes) p(t, plumeOn);
      for (const p of towerPlumes) p(t, plumeOn);
    },
  };
}

// Agro-waste fuel shed (site plan item 23): open-fronted portal-frame shed over the fuel yard with RCC bunker
// walls on the west side and south end; open to the east (front loader to the boiler-house silo) and the north
// (truck tipping). Returns the roof geometry so the rooftop solar can use it.
function fuelShed(B, M) {
  const F = frameOf(FUEL);
  const W = F.W, D = F.D, eave = 8.0, ridge = 9.4, half = W / 2, pitch = Math.atan2(ridge - eave, half);
  const rise = riseDelay(FUEL.x, FUEL.z);
  const roofMat = patchRise(makeMat({ color: '#FFFFFF', map: ribTexture('#5B7088', '#4A5D73', false), roughness: 0.5, metalness: 0.3 }));
  B.box(M.concrete, FUEL.x, 0.06, FUEL.z, FUEL.w, 0.12, FUEL.d, -1, { cast: false });
  const frames = Array.from({ length: 6 }, (_, i) => (i * D) / 5);
  for (const y of frames) {
    for (const x of [0.2, W - 0.2]) F.box(B, M.steelDark, x - 0.2, y - 0.15, x + 0.2, y + 0.15, 0, eave, rise);
    for (const s of [-1, 1]) F.mesh(B, new THREE.BoxGeometry(half / Math.cos(pitch), 0.5, 0.2), M.steelDark, half + s * half / 2, (eave + ridge) / 2 - 0.4, y, [0, 0, -s * pitch], rise);
  }
  for (const x of [0.2, W - 0.2]) F.box(B, M.steelDark, x - 0.12, 0, x + 0.12, D, eave - 0.35, eave, rise);      // eave beams
  const slope = Math.hypot(half, ridge - eave) + 0.55;
  for (const s of [-1, 1]) {
    F.mesh(B, ribbedBox(slope, 0.14, D + 0.9, 0.6), roofMat, half + s * (half / 2 - 0.25), (eave + ridge) / 2 + 0.12, D / 2, [0, 0, -s * pitch], rise);
    F.box(B, M.pipe, s < 0 ? -0.7 : W + 0.4, -0.45, s < 0 ? -0.4 : W + 0.7, D + 0.45, eave - 0.25, eave + 0.05, rise);   // gutters
  }
  F.box(B, M.pipe, half - 0.3, -0.45, half + 0.3, D + 0.45, ridge + 0.12, ridge + 0.3, rise);                  // ridge cap
  F.box(B, M.concreteLight, -0.15, 0, 0.25, D, 0, 3.2, rise);                                                   // bunker walls
  F.box(B, M.concreteLight, -0.15, -0.15, W, 0.25, 0, 3.2, rise);
  for (let k = 1; k < 4; k++) F.box(B, M.concreteLight, 0.25, (k * D) / 4 - 0.15, 4.5, (k * D) / 4 + 0.15, 0, 2.4, rise);   // bay dividers
  // agro-waste piles (rice husk, soya husk, mustard stalk briquettes) and the front loader
  for (const [px, pz, sc, mat] of [[FUEL.x - 2.8, FUEL.z - 8.5, 1, M.biomass], [FUEL.x - 2.2, FUEL.z + 0.5, 1.15, M.biomassGreen], [FUEL.x - 2.6, FUEL.z + 8.8, 0.95, M.biomass]]) {
    B.mesh(new THREE.IcosahedronGeometry(4.0, 1), mat, [px, 0, pz], [0, px, 0], [sc * 1.0, sc * 0.6, sc * 1.4], rise);
  }
  B.box(M.yellow, FUEL.x + 4.5, 1.1, FUEL.z - 4, 2.2, 1.8, 3.6, rise);
  B.box(M.steelDark, FUEL.x + 4.5, 0.9, FUEL.z - 6.4, 2.4, 0.5, 0.9, rise);
  return { F, half, pitch, eave, ridge, skylights: [], roofTop: (x) => eave + (ridge - eave) * (1 - Math.abs(x - half) / half) + 0.2 };
}
