// Utilities & EHS block: 2,200 TR cooling tower, N2 generator, fire water tanks, 50 KLD ETP
// (the boiler house and fuel store are in boiler.js).
import * as THREE from 'three';
import { makeMat } from './materials.js';
import { riseDelay } from './site.js';
import { COOLING, N2GEN, ETP, FIRE_TANKS, FIRE_TANK, BUILDINGS } from './layout.js';
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
export function plume(root, origin, n, opts) {
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

  // N2 generator skid (assumed position): compressor, receiver and two PSA columns in a row along Z
  const rn = riseDelay(N2GEN.x, N2GEN.z);
  B.box(M.concreteLight, N2GEN.x, 0.15, N2GEN.z, N2GEN.w, 0.3, N2GEN.d, -1, { cast: false });
  const psaMat = makeMat({ color: '#7DD3FC', metalness: 0.3, roughness: 0.4 });
  B.box(M.msPaint, N2GEN.x, 1.1, N2GEN.z + 2.3, 2.4, 1.6, 2.2, rn);                                   // compressor
  B.mesh(new THREE.CylinderGeometry(0.7, 0.7, 3.6, 18), M.steel, [N2GEN.x, 2.1, N2GEN.z - 0.1], [0, 0, 0], [1, 1, 1], rn);   // receiver
  for (const dx of [-0.6, 0.6]) B.mesh(new THREE.CylinderGeometry(0.42, 0.42, 3.2, 16), psaMat, [N2GEN.x + dx, 1.9, N2GEN.z - 2.6], [0, 0, 0], [1, 1, 1], rn);

  // fire water: two above-ground steel tanks Ø8.74 (height assumed) with suction lines to the fire pump room
  const fireMat = makeMat({ color: '#B91C1C', roughness: 0.5, metalness: 0.2 });
  const pumpRoom = BUILDINGS.find((b) => b.id === 'firepump');
  for (const t of FIRE_TANKS) {
    const r = riseDelay(t.x, t.z), R = FIRE_TANK.d / 2, H = FIRE_TANK.h;
    B.mesh(new THREE.CylinderGeometry(R + 0.4, R + 0.5, 0.4, 32), M.concrete, [t.x, 0.2, t.z], [0, 0, 0], [1, 1, 1], -1);
    B.mesh(new THREE.CylinderGeometry(R, R, H, 32), M.steel, [t.x, 0.4 + H / 2, t.z], [0, 0, 0], [1, 1, 1], r);
    B.mesh(new THREE.ConeGeometry(R + 0.1, 0.9, 32), M.steel, [t.x, 0.4 + H + 0.45, t.z], [0, 0, 0], [1, 1, 1], r);
    for (const y of [H * 0.62, H * 0.62 + 0.9]) B.mesh(new THREE.CylinderGeometry(R + 0.02, R + 0.02, 0.45, 32, 1, true), fireMat, [t.x, 0.4 + y, t.z], [0, 0, 0], [1, 1, 1], r, { cast: false });
    B.box(M.steelDark, t.x - R - 0.25, 0.4 + H / 2 + 0.5, t.z, 0.5, H + 1.0, 0.06, r);               // cage ladder
    B.box(M.yellow, t.x, 0.4 + H + 0.95, t.z, 1.2, 0.08, 1.2, r, { cast: false });                     // roof manway
    // suction line from the tank bottom to the pump room
    const y = 0.9, px = pumpRoom.x - pumpRoom.w / 2 + 1.0, pz = pumpRoom.z + pumpRoom.d / 2;
    const a = new THREE.Vector3(t.x - R * 0.7, y, t.z - R * 0.7);
    for (const [p0, p1] of [[a, new THREE.Vector3(px, y, a.z)], [new THREE.Vector3(px, y, a.z), new THREE.Vector3(px, y, pz)]]) {
      const len = p0.distanceTo(p1);
      if (len < 0.05) continue;
      B.mesh(new THREE.CylinderGeometry(0.15, 0.15, len, 10), fireMat, p0.clone().add(p1).multiplyScalar(0.5).toArray(), p0.x === p1.x ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2], [1, 1, 1], r);
    }
  }

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
  const towerPlumes = [COOLING.z - 4, COOLING.z + 4].map((fz) => plume(root, new THREE.Vector3(COOLING.x, COOLING.h + 2.6, fz), 60, { color: '#E2E8F0', size: 2.5, opacity: 0.24, life: 4.5, rise: 2.2, spread: 3.2, drift: [0.8, -0.4] }));

  return {
    anchors: {
      coolingTower: new THREE.Vector3(COOLING.x, COOLING.h + 3, COOLING.z),
      n2: new THREE.Vector3(N2GEN.x, 4.5, N2GEN.z),
      etp: new THREE.Vector3(ETP.x + 2.5, 3.2, ETP.z - 4.5),
    },
    update(t, s) {
      const glow = s.utilityGlow;
      for (const f of fans) f.rotation.y = t * 2.2;
      ripples.forEach((b, i) => { b.rotation.y = t * 0.12 + i; });
      waterMat.emissiveIntensity = 0.25 + 0.35 * glow;
      const plumeOn = 0.55 + 0.45 * glow;
      for (const p of towerPlumes) p(t, plumeOn);
    },
  };
}
