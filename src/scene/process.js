// Plant 1 / Plant 2 reactor buildings: frame, floors, reactors (sized by volume),
// fading shells, and the hero cutaway reactor used in Act 2.
import * as THREE from 'three';
import { Batcher, patchRise, riseDepthMaterial, makeMat } from './materials.js';
import { riseDelay } from './site.js';
import { PLANT1, PLANT2, P1_REACTORS, P2_REACTORS } from './layout.js';
import { deg, hash } from '../lib/util.js';

const BODY_BOTTOM = 4.2;   // bottom tangent line of every reactor (m)
const MEZZ = [5.5, 10.5];  // floor levels (G+2)

export function reactorDims(kl) {
  const d = 2.6 * Math.cbrt(kl / 16);
  return { d, R: d / 2, hs: d, head: d / 4 };
}

function reactorProfile(R, hs, head) {
  const pts = [];
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * R, head - Math.cos(a) * head)); }
  pts.push(new THREE.Vector2(R, head + hs));
  for (let i = 1; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * R, head + hs + Math.sin(a) * head)); }
  pts[pts.length - 1].x = 0.001;
  pts[0].x = 0.001;
  return pts;
}

// Adds a static reactor (vessel, drive, lugs, outlet, condenser) to a batcher.
function addReactor(B, M, r, condSide) {
  const { R, hs, head } = reactorDims(r.kl);
  const y0 = BODY_BOTTOM - head;
  const shell = new THREE.LatheGeometry(reactorProfile(R, hs, head), 24);
  B.mesh(shell, M.steel, [r.x, y0, r.z]);
  const top = BODY_BOTTOM + hs + head;
  B.mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.55, 12), M.steelDark, [r.x, top + 0.25, r.z]);
  B.box(M.msPaint, r.x, top + 0.95, r.z, 0.5, 0.9, 0.55);
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    B.box(M.steelDark, r.x + Math.sin(a) * (R + 0.15), MEZZ[0] + 0.15, r.z + Math.cos(a) * (R + 0.15), 0.35, 0.3, 0.35);
  }
  B.mesh(new THREE.CylinderGeometry(0.09, 0.09, y0 - 2.6, 8), M.pipe, [r.x, (y0 + 2.6) / 2, r.z]);
  // condenser + vapour line
  const cx = r.x + condSide * (R + 0.9);
  B.mesh(new THREE.CylinderGeometry(0.34, 0.34, 2.6, 14), M.steel, [cx, MEZZ[1] + 1.4, r.z]);
  B.mesh(new THREE.CylinderGeometry(0.08, 0.08, MEZZ[1] + 2.9 - top, 8), M.pipe, [r.x + condSide * 0.4, (MEZZ[1] + 2.9 + top) / 2, r.z]);
  B.box(M.pipe, (cx + r.x + condSide * 0.4) / 2, MEZZ[1] + 2.9, r.z, Math.abs(cx - r.x - condSide * 0.4) + 0.16, 0.16, 0.16);
  B.mesh(new THREE.SphereGeometry(0.09, 8, 6), M.statusGreen, [r.x + 0.3, top + 1.5, r.z], [0, 0, 0], [1, 1, 1], -1, { cast: false });
}

// Interior structure that stays visible in cutaway: central walkway beams, handrails, slab.
function plantFrame(B, M, P) {
  const { x, z, w, d } = P;
  const dz = P.floorD ?? d, fz = P.floorZ ?? z;
  for (const y of MEZZ) {
    B.box(M.steelDark, x, y - 0.2, fz, 0.25, 0.3, dz - 0.6);
    B.box(M.yellow, x, y + 1.05, fz, 0.06, 0.06, dz - 1.2, -1, { cast: false });
  }
  B.box(M.concreteLight, x, 0.1, z, w, 0.2, d, -1, { cast: false });
}

// Perimeter columns and edge beams belong to the envelope so they fade for interior shots.
function perimeterFrame(SB, mat, P, rise) {
  const { x, z, w, d, h } = P;
  const nx = Math.round(w / 5.2), nz = Math.round(d / 5.5);
  for (let i = 0; i <= nx; i++) for (let k = 0; k <= nz; k++) {
    if (!(i === 0 || i === nx || k === 0 || k === nz)) continue;
    SB.box(mat, x - w / 2 + 0.35 + (i * (w - 0.7)) / nx, h / 2, z - d / 2 + 0.35 + (k * (d - 0.7)) / nz, 0.4, h, 0.4, rise);
  }
  for (const y of MEZZ) {
    SB.box(mat, x, y - 0.2, z - d / 2 + 0.35, w - 0.4, 0.35, 0.3, rise);
    SB.box(mat, x, y - 0.2, z + d / 2 - 0.35, w - 0.4, 0.35, 0.3, rise);
    SB.box(mat, x - w / 2 + 0.35, y - 0.2, z, 0.3, 0.35, d - 0.4, rise);
    SB.box(mat, x + w / 2 - 0.35, y - 0.2, z, 0.3, 0.35, d - 0.4, rise);
  }
}

function stripeTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 64);
  grd.addColorStop(0, '#000'); grd.addColorStop(0.45, '#fff'); grd.addColorStop(0.55, '#fff'); grd.addColorStop(1, '#000');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 3);
  return t;
}

// Building envelope that fades away for the interior shots.
function plantShell(root, M, P, roofColor, stripeColor) {
  const rise = riseDelay(P.x, P.z);
  const mk = (base) => {
    const m = base.clone();
    patchRise(m);
    return m;
  };
  const mats = { wall: mk(M.wall), roof: mk(M[roofColor]), glass: mk(M.glass), stripe: mk(M.statusCyan), frame: mk(M.steelDark) };
  mats.stripe.color.set(stripeColor); mats.stripe.emissive.set(stripeColor); mats.stripe.emissiveIntensity = 1.4;
  const SB = new Batcher();
  const { x, z, w, d, h } = P;
  const t = 0.25;
  perimeterFrame(SB, mats.frame, P, rise);
  SB.box(mats.wall, x, h / 2, z - d / 2, w, h, t, rise);
  SB.box(mats.wall, x, h / 2, z + d / 2, w, h, t, rise);
  SB.box(mats.wall, x - w / 2, h / 2, z, t, h, d, rise);
  SB.box(mats.wall, x + w / 2, h / 2, z, t, h, d, rise);
  SB.box(mats.roof, x, h + 0.2, z, w + 0.6, 0.4, d + 0.6, rise);
  SB.box(mats.roof, x, h + 1.1, z, w * 0.35, 1.4, d * 0.8, rise);
  for (const y of [2.6, MEZZ[0] + 2.4, MEZZ[1] + 2.4]) {
    SB.box(mats.glass, x, y, z + d / 2 + 0.15, w * 0.88, 1.3, 0.06, rise, { cast: false });
    SB.box(mats.glass, x, y, z - d / 2 - 0.15, w * 0.88, 1.3, 0.06, rise, { cast: false });
    SB.box(mats.glass, x - w / 2 - 0.15, y, z, 0.06, 1.3, d * 0.9, rise, { cast: false });
    SB.box(mats.glass, x + w / 2 + 0.15, y, z, 0.06, 1.3, d * 0.9, rise, { cast: false });
  }
  for (const s of [-1, 1]) {
    SB.box(mats.stripe, x, h - 1.2, z + s * (d / 2 + 0.16), w + 0.1, 0.5, 0.06, rise, { cast: false });
    SB.box(mats.stripe, x + s * (w / 2 + 0.16), h - 1.2, z, 0.06, 0.5, d + 0.1, rise, { cast: false });
  }
  // stair tower on the north-east corner
  SB.box(mats.wall, x + w / 2 - 1.8, (h + 2.5) / 2, z - d / 2 - 1.6, 3.4, h + 2.5, 3.2, rise);
  const group = new THREE.Group();
  root.add(group);
  SB.build(group);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), new THREE.LineBasicMaterial({ color: new THREE.Color('#38BDF8').multiplyScalar(2.5), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  edges.position.set(x, h / 2, z);
  root.add(edges);
  const floorsGlow = [];
  const fd = P.floorD ?? d, fzc = P.floorZ ?? z;
  for (const y of MEZZ) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.6, fd - 0.6), M.grating.clone());
    f.material.opacity = 0.2;
    f.rotation.x = -Math.PI / 2;
    f.position.set(x, y, fzc);
    f.renderOrder = 2;
    root.add(f);
    floorsGlow.push(f);
  }
  let transparentNow = false, castNow = true;
  return {
    group, mats, edges,
    // returns true when shadow casting changed (shadow map must be refreshed)
    setCutaway(c) {
      const op = 1 - 0.94 * c;
      const transparent = op < 0.999;
      for (const m of Object.values(mats)) {
        m.opacity = op;
        if (transparent !== transparentNow) { m.transparent = transparent; m.depthWrite = !transparent; m.needsUpdate = true; }
      }
      transparentNow = transparent;
      group.visible = c < 0.985;
      edges.material.opacity = 0.85 * Math.sin(Math.min(1, c) * Math.PI / 2);
      edges.visible = c > 0.01;
      const cast = c < 0.5;
      let changed = false;
      if (cast !== castNow) { group.traverse((o) => { if (o.isMesh) o.castShadow = cast; }); castNow = cast; changed = true; }
      for (const f of floorsGlow) f.visible = c > 0.02;
      return changed;
    },
  };
}

function wedgePlanes(cx, cz, centerAz, width) {
  const a1 = deg(centerAz - width / 2), a2 = deg(centerAz + width / 2);
  const dir = (a) => new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
  const p0 = new THREE.Vector3(cx, 0, cz);
  const n1 = dir(a1 - Math.PI / 2), n2 = dir(a2 + Math.PI / 2);
  return [new THREE.Plane(n1, -n1.dot(p0)), new THREE.Plane(n2, -n2.dot(p0))];
}

function heroReactor(root, M, r) {
  const { R, hs, head } = reactorDims(r.kl);
  const y0 = BODY_BOTTOM - head;
  const CUT_AZ = -22, CUT_W = 115;
  const planes = wedgePlanes(r.x, r.z, CUT_AZ, CUT_W);
  const g = new THREE.Group();
  root.add(g);

  const shellMat = makeMat({ color: '#C9D4DF', metalness: 0.75, roughness: 0.28, side: THREE.DoubleSide, clippingPlanes: planes, clipIntersection: true, clipShadows: true });
  const shell = new THREE.Mesh(new THREE.LatheGeometry(reactorProfile(R, hs, head), 48), shellMat);
  shell.position.set(r.x, y0, r.z);
  shell.castShadow = true; shell.receiveShadow = true;
  g.add(shell);
  // insulation/inner skin so the cut reads as a thick wall
  const innerMat = makeMat({ color: '#4B5D72', metalness: 0.3, roughness: 0.7, side: THREE.BackSide, clippingPlanes: planes, clipIntersection: true });
  const inner = new THREE.Mesh(new THREE.LatheGeometry(reactorProfile(R * 0.965, hs, head * 0.96), 48), innerMat);
  inner.position.set(r.x, y0 + head * 0.04, r.z);
  g.add(inner);
  // glowing cut edges
  const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#F59E0B').multiplyScalar(2.2), toneMapped: false });
  for (const a of [deg(CUT_AZ - CUT_W / 2), deg(CUT_AZ + CUT_W / 2)]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.05, hs + head * 1.4, 0.05), edgeMat);
    e.position.set(r.x + Math.sin(a) * R * 0.98, BODY_BOTTOM + hs / 2, r.z + Math.cos(a) * R * 0.98);
    g.add(e);
  }

  // thermic-fluid jacket with upward-moving bands
  const stripes = stripeTexture();
  const jacketMat = makeMat({ color: '#3B4A5C', metalness: 0.6, roughness: 0.4, emissive: '#F59E0B', emissiveMap: stripes, emissiveIntensity: 0, side: THREE.DoubleSide, clippingPlanes: planes, clipIntersection: true });
  const jacket = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.07, R * 1.07, hs * 0.8, 48, 1, true), jacketMat);
  jacket.position.set(r.x, BODY_BOTTOM + hs * 0.4, r.z);
  g.add(jacket);

  // liquid charge
  const liquidMat = makeMat({ color: '#92400E', emissive: '#F59E0B', emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.86 });
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.94, R * 0.94, 1, 40), liquidMat);
  g.add(liquid);
  const surfMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#FBBF24').multiplyScalar(1.6), transparent: true, opacity: 0.9, toneMapped: false });
  const surface = new THREE.Mesh(new THREE.CircleGeometry(R * 0.94, 40), surfMat);
  surface.rotation.x = -Math.PI / 2;
  g.add(surface);
  const liquidBottom = BODY_BOTTOM - head * 0.55;

  // agitator: shaft + two pitched-blade impellers
  const agitator = new THREE.Group();
  agitator.position.set(r.x, 0, r.z);
  const steel = makeMat({ color: '#D7DEE6', metalness: 0.85, roughness: 0.25 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, hs + head * 1.8, 10), steel);
  shaft.position.y = BODY_BOTTOM + hs / 2 + head * 0.3;
  agitator.add(shaft);
  for (const [yy, span] of [[BODY_BOTTOM - head * 0.25, R * 0.62], [BODY_BOTTOM + hs * 0.45, R * 0.5]]) {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.18, 10), steel);
    hub.position.y = yy;
    agitator.add(hub);
    for (let k = 0; k < 4; k++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(span, 0.04, 0.22), steel);
      const a = k * Math.PI / 2;
      blade.position.set(Math.cos(a) * span / 2, yy, -Math.sin(a) * span / 2);
      blade.rotation.set(0, a, deg(30));
      agitator.add(blade);
    }
  }
  g.add(agitator);
  const drive = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.6, 16), makeMat({ color: '#5B6B7D', metalness: 0.6, roughness: 0.4 }));
  drive.position.set(r.x, BODY_BOTTOM + hs + head + 0.28, r.z);
  g.add(drive);
  const motor = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.95, 0.6), makeMat({ color: '#00529B', metalness: 0.3, roughness: 0.5 }));
  motor.position.set(r.x, BODY_BOTTOM + hs + head + 1.05, r.z);
  g.add(motor);

  // bubbles in the batch
  const NB = 46;
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FDE68A').multiplyScalar(2.0), toneMapped: false }), NB);
  bubbles.frustumCulled = false;
  g.add(bubbles);

  // glass reflux condenser with tube bundle, vapour (up) and condensate (down)
  const cx = r.x - (R + 0.95), cy0 = BODY_BOTTOM + hs + head + 0.45, ch = 2.6;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, ch, 32, 1, true), makeMat({ color: '#A5D8FF', metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.set(cx, cy0 + ch / 2, r.z);
  g.add(glass);
  for (const yy of [cy0, cy0 + ch]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 24), steel);
    cap.position.set(cx, yy, r.z);
    g.add(cap);
  }
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, ch, 6), steel);
    tube.position.set(cx + Math.cos(a) * 0.24 * (k ? 1 : 0), cy0 + ch / 2, r.z + Math.sin(a) * 0.24 * (k ? 1 : 0));
    g.add(tube);
  }
  const vline = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(r.x - 0.45, BODY_BOTTOM + hs + head * 0.8, r.z), new THREE.Vector3(r.x - 0.6, cy0 + ch + 0.6, r.z),
    new THREE.Vector3(cx, cy0 + ch + 0.6, r.z), new THREE.Vector3(cx, cy0 + ch, r.z)], false, 'catmullrom', 0.1), 24, 0.09, 8), makeMat({ color: '#8FA3B8', metalness: 0.7, roughness: 0.35 }));
  g.add(vline);
  const NV = 40;
  const vapour = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color('#E0F2FE').multiplyScalar(1.6), transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false }), NV);
  vapour.frustumCulled = false;
  g.add(vapour);
  const droplets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 6, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color('#38BDF8').multiplyScalar(2.0), toneMapped: false }), 24);
  droplets.frustumCulled = false;
  g.add(droplets);

  // thermic oil feed lines to the jacket
  const hot = makeMat({ color: '#7C2D12', emissive: '#F59E0B', emissiveIntensity: 0 });
  for (const [a, yy] of [[deg(150), BODY_BOTTOM + 0.2], [deg(200), BODY_BOTTOM + hs * 0.75]]) {
    const p0 = new THREE.Vector3(r.x + Math.sin(a) * R * 1.07, yy, r.z + Math.cos(a) * R * 1.07);
    const p1 = new THREE.Vector3(r.x + Math.sin(a) * (R + 1.3), yy, r.z + Math.cos(a) * (R + 1.3));
    const p2 = new THREE.Vector3(p1.x, 0.4, p1.z);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p0, p1, p2], false, 'catmullrom', 0.05), 16, 0.07, 8), hot);
    g.add(tube);
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
  const anchors = {
    heroReactor: new THREE.Vector3(r.x + Math.sin(deg(CUT_AZ + 30)) * R, BODY_BOTTOM + hs * 0.55, r.z + Math.cos(deg(CUT_AZ + 30)) * R),
    heroJacket: new THREE.Vector3(r.x + Math.sin(deg(-78)) * R * 1.08, BODY_BOTTOM + hs * 0.25, r.z + Math.cos(deg(-78)) * R * 1.08),
    heroCondenser: new THREE.Vector3(cx, cy0 + ch * 0.55, r.z),
  };

  return {
    anchors,
    update(t, s) {
      const level = s.heroReactorFill;
      const hLiquid = (BODY_BOTTOM + hs * level) - liquidBottom;
      liquid.scale.y = hLiquid;
      liquid.position.set(r.x, liquidBottom + hLiquid / 2, r.z);
      surface.position.set(r.x, liquidBottom + hLiquid + 0.005, r.z);
      const heat = s.heroReactorHeat;
      liquidMat.emissiveIntensity = 0.35 + 0.55 * heat;
      jacketMat.emissiveIntensity = heat * (1.1 + 0.25 * Math.sin(t * 2.4));
      stripes.offset.y = -t * 0.35;
      hot.emissiveIntensity = heat * 1.6;
      agitator.rotation.y = t * 2.6 * (0.3 + 0.7 * Math.min(1, heat + 0.3));
      for (let i = 0; i < NB; i++) {
        const ph = hash(i * 3.1), sp = 0.45 + hash(i * 7.7) * 0.5;
        const u = ((t * sp * 0.35 + ph) % 1);
        const rr = R * 0.82 * Math.sqrt(hash(i * 1.3)), a = hash(i * 5.9) * 6.283 + t * 0.6;
        const y = liquidBottom + 0.15 + u * (hLiquid - 0.2);
        v.set(r.x + Math.cos(a) * rr, y, r.z + Math.sin(a) * rr);
        const sc = heat > 0.05 ? (0.5 + hash(i) * 0.8) * Math.min(1, heat * 2) : 0.0001;
        m4.compose(v, q, s1.set(sc, sc, sc));
        bubbles.setMatrixAt(i, m4);
      }
      bubbles.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < NV; i++) {
        const u = ((t * (0.25 + hash(i * 2.3) * 0.2) + hash(i * 9.1)) % 1);
        const a = hash(i * 4.4) * 6.283, rr = 0.33 * Math.sqrt(hash(i * 6.2));
        v.set(cx + Math.cos(a) * rr, cy0 + 0.1 + u * (ch - 0.2), r.z + Math.sin(a) * rr);
        const sc = heat * Math.sin(u * Math.PI) * 1.1 + 0.0001;
        m4.compose(v, q, s1.set(sc, sc, sc));
        vapour.setMatrixAt(i, m4);
      }
      vapour.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < 24; i++) {
        const u = ((t * (0.55 + hash(i * 8.3) * 0.3) + hash(i * 1.9)) % 1);
        const a = (i / 24) * 6.283;
        v.set(cx + Math.cos(a) * 0.24, cy0 + ch - 0.1 - u * (ch - 0.2), r.z + Math.sin(a) * 0.24);
        const sc = heat * 0.9 + 0.0001;
        m4.compose(v, q, s1.set(sc, sc * 1.6, sc));
        droplets.setMatrixAt(i, m4);
      }
      droplets.instanceMatrix.needsUpdate = true;
    },
  };
}

export function buildPlants(world, M, B) {
  const root = new THREE.Group();
  world.scene.add(root);
  const P2 = { ...PLANT2, floorZ: (-49.2 - 16.5) / 2, floorD: 49.2 - 16.5 };
  plantFrame(B, M, PLANT1);
  plantFrame(B, M, P2);
  let hero = null;
  for (const r of P1_REACTORS) {
    if (r.hero) hero = heroReactor(root, M, r);
    else addReactor(B, M, r, r.x < PLANT1.x ? -1 : 1);
  }
  for (const r of P2_REACTORS) addReactor(B, M, r, r.x < PLANT2.x ? -1 : 1);
  // P2 feed from the south powder-polyester reactor down to the flaker head
  const feedMat = makeMat({ color: '#78350F', emissive: '#F59E0B', emissiveIntensity: 1.2 });
  const feed = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(25.6, 2.6, -20.5), new THREE.Vector3(25.6, 2.2, -18.0), new THREE.Vector3(26.0, 3.1, -15.6), new THREE.Vector3(26.0, 2.55, -14.4)], false, 'catmullrom', 0.2), 32, 0.11, 8), feedMat);
  root.add(feed);

  const shell1 = plantShell(root, M, PLANT1, 'roofP1', '#00A3E0');
  const shell2 = plantShell(root, M, P2, 'roofP2', '#4ADE80');

  const top = (P) => new THREE.Vector3(P.x, P.h + 1.5, P.z);
  return {
    anchors: { ...hero.anchors, plant1: top(PLANT1), plant2: top(PLANT2) },
    update(t, s) {
      hero.update(t, s);
      feedMat.emissiveIntensity = 0.4 + 1.2 * s.finishingRun;
      const c1 = shell1.setCutaway(s.plant1Cutaway);
      const c2 = shell2.setCutaway(s.plant2Cutaway);
      return c1 || c2;
    },
  };
}
