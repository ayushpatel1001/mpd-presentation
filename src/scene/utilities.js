// Utilities & EHS block: thermic fluid heaters (agro-waste fired), steam generator, stacks,
// agro-waste silo + bag filters, biomass yard, 2,200 TR cooling tower, N2 generator, ETP/STP.
import * as THREE from 'three';
import { makeMat } from './materials.js';
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

  // biomass fuel yard
  const rf = riseDelay(FUEL.x, FUEL.z);
  B.box(M.concrete, FUEL.x, 0.06, FUEL.z, FUEL.w, 0.12, FUEL.d, -1, { cast: false });
  for (const [px, pz, s, mat] of [[FUEL.x - 2.5, FUEL.z - 8, 1, M.biomass], [FUEL.x + 2.5, FUEL.z + 1, 1.25, M.biomassGreen], [FUEL.x - 1.5, FUEL.z + 9, 0.9, M.biomass]]) {
    B.mesh(new THREE.IcosahedronGeometry(4.2, 1), mat, [px, 0, pz], [0, px, 0], [s * 1.1, s * 0.55, s * 1.5], rf);
  }
  B.box(M.yellow, FUEL.x + 4.5, 1.1, FUEL.z - 4, 2.2, 1.8, 3.6, rf);
  B.box(M.steelDark, FUEL.x + 4.5, 0.9, FUEL.z - 6.4, 2.4, 0.5, 0.9, rf);

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

  // ETP / STP: clarifiers, aeration basins, sludge beds, control room
  const re = riseDelay(ETP.x, ETP.z);
  B.box(M.concrete, ETP.x, 0.06, ETP.z, ETP.w, 0.12, ETP.d, -1, { cast: false });
  const waterMat = makeMat({ color: '#0C4A5E', emissive: '#10B981', emissiveIntensity: 0.25, roughness: 0.1, metalness: 0.2 });
  const ripples = [];
  for (const [cx, cz] of [[ETP.x - 4.5, ETP.z - 6.5], [ETP.x + 4.5, ETP.z - 6.5]]) {
    B.mesh(new THREE.CylinderGeometry(3.6, 3.6, 2.2, 32, 1, true), M.concreteLight, [cx, 1.1, cz], [0, 0, 0], [1, 1, 1], re);
    const water = new THREE.Mesh(new THREE.CircleGeometry(3.5, 32), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(cx, 1.9, cz);
    root.add(water);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.25, 0.6), M.yellow);
    bridge.position.set(cx, 2.4, cz);
    root.add(bridge);
    ripples.push(bridge);
  }
  for (const bz of [ETP.z + 2.5, ETP.z + 7.5]) {
    B.box(M.concreteLight, ETP.x - 3, 0.9, bz, 11, 1.8, 4.2, re);
    const basin = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 3.6), waterMat);
    basin.rotation.x = -Math.PI / 2;
    basin.position.set(ETP.x - 3, 1.82, bz);
    root.add(basin);
  }
  for (let k = 0; k < 3; k++) B.box(M.biomass, ETP.x + 6.5, 0.2, ETP.z + 1 + k * 3.2, 4.5, 0.3, 2.6, re, { cast: false });
  B.box(M.wall, ETP.x + 6.5, 1.8, ETP.z + 10, 5, 3.6, 3.2, re);
  B.box(M.roof, ETP.x + 6.5, 3.75, ETP.z + 10, 5.4, 0.3, 3.6, re);

  // DG sets (2 × 500 kVA) next to the substation
  for (const dz of [-2, 2]) B.box(M.msPaint, 52.5, 1.3, -32 + dz * 1.6, 6, 2.6, 2.4, riseDelay(52.5, -32));

  // plumes
  const stackPlumes = [z - 6.0, z + 0.5].map((hz) => plume(root, new THREE.Vector3(x + 17, 30.5, hz), 70, { color: '#CBD5E1', size: 2.4, opacity: 0.28, life: 7, rise: 2.6, spread: 4, drift: [1.6, -0.6] }));
  const towerPlumes = [COOLING.z - 4, COOLING.z + 4].map((fz) => plume(root, new THREE.Vector3(COOLING.x, COOLING.h + 2.6, fz), 60, { color: '#E2E8F0', size: 2.5, opacity: 0.24, life: 4.5, rise: 2.2, spread: 3.2, drift: [0.8, -0.4] }));

  return {
    anchors: {
      boiler: new THREE.Vector3(x, 13, z),
      heaters: new THREE.Vector3(x - 8, 4.2, z - 2.5),
      silo: new THREE.Vector3(sx, 12, sz),
      coolingTower: new THREE.Vector3(COOLING.x, COOLING.h + 3, COOLING.z),
      n2: new THREE.Vector3(N2GEN.x, 4.5, N2GEN.z),
      etp: new THREE.Vector3(ETP.x, 3, ETP.z),
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
