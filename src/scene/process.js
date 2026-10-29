// Plant 1 / Plant 2 process buildings.
// Plant 1 follows drawings PP-A-DR-PB1-102 (MEZZ-1 +3.40), PB1-104 (MEZZ-2 +7.50) and PB1-301 (sections):
// PEB portal frames with a gable + monitor roof (eaves +16.0), metal-sheet cladding over a masonry base,
// decks at +3.40 / +7.50 / +11.50, reactor lugs at +5.00, receivers CLT (+3.40) and REC (+7.50),
// charging silos above each reactor, vapour columns to horizontal condensers at the top deck and a
// 3 t EOT crane on runway girders at +14.00. Plant 2 shares the envelope and deck levels.
import * as THREE from 'three';
import { Batcher, makeMat } from './materials.js';
import { pebEnvelope } from './peb.js';
import { riseDelay } from './site.js';
import { forklift, fibc, pallet, placeAt, tube, polyline } from './props.js';
import { PLANT1, PLANT2, P1_REACTORS, P2_REACTORS, P1_CLT, P1_REC, P1_CORES, PLANT_LEVELS as LV } from './layout.js';
import { deg, hash } from '../lib/util.js';

const BODY_BOTTOM = 3.0;   // bottom tangent line of every reactor; lugs bear on the +5.00 support frame

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

// ---------------------------------------------------------------------------- textures
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

// ---------------------------------------------------------------------------- PEB envelope
// Section 1-1: masonry to +3.40, windows at +1.0 / +5.3 / +11.9, vents at +3.8 / +9.7, monitor on the ridge.
const PLANT_ENV = {
  eave: LV.eave, ridge: LV.ridge, baseH: LV.mezz1, monitor: true,
  windowRows: [[1.0, 2.5], [5.3, 6.8], [11.9, 13.4]], ventRows: [[3.8, 4.4], [9.7, 10.3]],
  gableRows: [[11.9, 13.4, 'glass'], [9.7, 10.3, 'louver']],
  stairLevels: [0, LV.mezz1, LV.mezz2, LV.top], liftTop: LV.top + 3.0,
};

// ---------------------------------------------------------------------------- decks + equipment
// Grating deck: rectangle with circular openings around vessels and rectangular openings (stairs, cutout).
function deck(B, M, F, level, rect, holes, rects) {
  const [x0, y0, x1, y1] = rect;
  const shape = new THREE.Shape([new THREE.Vector2(x0, y0), new THREE.Vector2(x1, y0), new THREE.Vector2(x1, y1), new THREE.Vector2(x0, y1)]);
  for (const [hx, hy, r] of holes) { const p = new THREE.Path(); p.absarc(hx, hy, r, 0, Math.PI * 2, true); shape.holes.push(p); }
  for (const [a, b, c, d] of rects) shape.holes.push(new THREE.Path([new THREE.Vector2(a, b), new THREE.Vector2(a, d), new THREE.Vector2(c, d), new THREE.Vector2(c, b)]));
  const geo = new THREE.ShapeGeometry(shape, 20);
  geo.rotateX(Math.PI / 2);   // shape y → +z; F.mesh maps local +y to −Z, so flip below
  geo.scale(1, 1, -1);
  F.mesh(B, geo, M.deckMat, 0, level, 0, [0, 0, 0], -1, { cast: false });
  F.box(B, M.steelDark, x0, y0, x1, y0 + 0.2, level - 0.35, level, -1);
  F.box(B, M.steelDark, x0, y1 - 0.2, x1, y1, level - 0.35, level, -1);
  F.box(B, M.steelDark, (x0 + x1) / 2 - 0.1, y0, (x0 + x1) / 2 + 0.1, y1, level - 0.3, level, -1);
  // handrails along the central aisle
  for (const x of [(x0 + x1) / 2 - 2.0, (x0 + x1) / 2 + 2.0]) {
    F.box(B, M.yellow, x - 0.03, y0 + 0.5, x + 0.03, y1 - 0.5, level + 1.0, level + 1.06, -1, { cast: false });
    for (let y = y0 + 0.5; y <= y1 - 0.5; y += 2.0) F.box(B, M.yellow, x - 0.03, y - 0.03, x + 0.03, y + 0.03, level, level + 1.06, -1, { cast: false });
  }
}

function addReactor(B, M, r, condSide, withColumn) {
  const { R, hs, head } = reactorDims(r.kl);
  const y0 = BODY_BOTTOM - head;
  B.mesh(new THREE.LatheGeometry(reactorProfile(R, hs, head), 24), M.steel, [r.x, y0, r.z]);
  const top = BODY_BOTTOM + hs + head;
  B.mesh(new THREE.CylinderGeometry(R * 1.04, R * 1.04, hs * 0.75, 24, 1, true), M.steelDark, [r.x, BODY_BOTTOM + hs * 0.38, r.z]);   // jacket
  B.mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.55, 12), M.steelDark, [r.x, top + 0.25, r.z]);
  B.box(M.msPaint, r.x, top + 0.95, r.z, 0.5, 0.9, 0.55);
  B.mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.25, 12), M.steelDark, [r.x + 0.55, top - 0.1, r.z - 0.3]);           // manhole
  // support frame at +5.00 with four lugs
  for (const s of [-1, 1]) {
    B.box(M.steelDark, r.x + s * (R + 0.25), LV.support - 0.15, r.z, 0.25, 0.3, 2 * R + 0.8);
    B.box(M.steelDark, r.x, LV.support - 0.15, r.z + s * (R + 0.25), 2 * R + 0.8, 0.3, 0.25);
  }
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    B.box(M.steelDark, r.x + Math.sin(a) * (R + 0.12), LV.support + 0.15, r.z + Math.cos(a) * (R + 0.12), 0.35, 0.3, 0.35);
  }
  // bottom outlet + valve
  B.mesh(new THREE.CylinderGeometry(0.09, 0.09, y0 - 0.9, 8), M.pipe, [r.x, (y0 + 0.9) / 2, r.z]);
  B.box(M.yellow, r.x, 1.2, r.z, 0.3, 0.22, 0.3);
  B.mesh(new THREE.SphereGeometry(0.09, 8, 6), M.statusGreen, [r.x + 0.3, top + 1.5, r.z], [0, 0, 0], [1, 1, 1], -1, { cast: false });
  if (!withColumn) return;
  // vapour column up to a horizontal shell-and-tube condenser on the +11.50 deck (section 1-1)
  const cx = r.x + condSide * (R * 0.55);
  B.mesh(new THREE.CylinderGeometry(0.24, 0.24, LV.top + 0.6 - top, 14), M.steel, [cx, (LV.top + 0.6 + top) / 2, r.z]);
  B.mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.8, 18), M.steel, [cx, LV.top + 0.95, r.z + 0.3], [Math.PI / 2, 0, 0]);
  for (const s of [-1, 1]) {
    B.mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 18), M.steelDark, [cx, LV.top + 0.95, r.z + 0.3 + s * 1.4], [Math.PI / 2, 0, 0]);
    B.box(M.steelDark, cx, LV.top + 0.3, r.z + 0.3 + s * 0.9, 0.7, 0.6, 0.18);
  }
  B.mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8), M.pipe, [cx + condSide * 0.5, LV.top + 1.6, r.z + 0.9]);
}

function vessel(B, M, x, z, d, h, base, legs = 4) {
  B.mesh(new THREE.CylinderGeometry(d / 2, d / 2, h, 18), M.steel, [x, base + 0.25 + h / 2, z]);
  B.mesh(new THREE.SphereGeometry(d / 2, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.steel, [x, base + 0.25 + h, z], [0, 0, 0], [1, 0.35, 1]);
  for (let k = 0; k < legs; k++) {
    const a = (k / legs) * Math.PI * 2 + Math.PI / 4;
    B.box(M.steelDark, x + Math.sin(a) * d * 0.42, base + 0.15, z + Math.cos(a) * d * 0.42, 0.12, 0.3, 0.12);
  }
}

function silo(B, M, s, reactorTop, rx, rz) {
  const r = 1.12;
  B.mesh(new THREE.CylinderGeometry(r, r, 2.1, 22), M.steel, [s.x, LV.top + 1.45, s.z]);
  B.mesh(new THREE.ConeGeometry(r + 0.04, 0.4, 22), M.steel, [s.x, LV.top + 2.7, s.z]);
  B.mesh(new THREE.CylinderGeometry(r, 0.22, 1.7, 22, 1, true), M.steel, [s.x, LV.top - 0.45, s.z]);
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    B.box(M.steelDark, s.x + Math.sin(a) * r, LV.top + 0.3, s.z + Math.cos(a) * r, 0.15, 0.6, 0.15);
  }
  // rotary valve + charging chute down to the reactor manhole
  B.box(M.yellow, s.x, LV.top - 1.45, s.z, 0.4, 0.3, 0.4);
  const p0 = new THREE.Vector3(s.x, LV.top - 1.6, s.z), p1 = new THREE.Vector3(rx + 0.55, reactorTop + 0.1, rz - 0.3);
  const len = p0.distanceTo(p1);
  const chute = new THREE.CylinderGeometry(0.11, 0.11, len, 8);
  chute.translate(0, -len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), p1.clone().sub(p0).normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  B.mesh(chute, M.pipe, [p0.x, p0.y, p0.z], [e.x, e.y, e.z]);
}

// Jumbo bag (FIBC): woven body with four lifting loops; origin at the bottom centre.
export function jumboBag(mat, loopMat, size = 1.0, h = 1.15) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(size, h, size, 1, 1, 1), mat);
  body.position.y = h / 2;
  body.castShadow = true;
  g.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.18, 10), mat);
  top.position.y = h + 0.09;
  g.add(top);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 4, 10, Math.PI), loopMat);
    loop.position.set(sx * (size / 2 - 0.08), h, sz * (size / 2 - 0.08));
    loop.rotation.y = Math.PI / 4 * (sx * sz);
    g.add(loop);
  }
  g.userData.body = body;
  return g;
}

// 3 t EOT crane on runway girders at +14.00. With `cycle`, the hoist carries jumbo bags from the floor under
// the hoisting cut-out up through the decks and across to the bag discharger (36 s loop, a pure function of t).
function crane(root, M, F, W, D, yAt, cycle) {
  const g = new THREE.Group();
  const yellow = makeMat({ color: '#F59E0B', roughness: 0.5, metalness: 0.3 });
  const dark = makeMat({ color: '#1E293B', roughness: 0.6 });
  const add = (geo, mat, x, h, y, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.copy(F.world(x, h, y)); m.castShadow = true; parent.add(m); return m; };
  for (const x of [0.75, W - 0.75]) add(new THREE.BoxGeometry(0.35, 0.65, D - 0.6), M.steelDark, x, LV.crane - 0.32, D / 2);   // runway girders
  add(new THREE.BoxGeometry(W - 1.2, 0.75, 0.6), yellow, W / 2, LV.crane + 0.4, yAt);                                      // bridge girder
  for (const x of [0.75, W - 0.75]) add(new THREE.BoxGeometry(0.6, 0.45, 2.2), yellow, x, LV.crane + 0.2, yAt);          // end trucks
  const trolley = add(new THREE.BoxGeometry(1.4, 0.6, 1.1), yellow, W * 0.38, LV.crane + 0.95, yAt);                       // hoist trolley
  const rope = add(new THREE.CylinderGeometry(0.025, 0.025, 1, 4), dark, W * 0.38, LV.crane - 1.1, yAt);
  const hook = add(new THREE.BoxGeometry(0.35, 0.5, 0.25), yellow, W * 0.38, LV.crane - 2.7, yAt);                         // hook block
  root.add(g);
  const ropeTop = LV.crane + 0.65;
  const place = (x, hookH) => {
    trolley.position.copy(F.world(x, LV.crane + 0.95, yAt));
    hook.position.copy(F.world(x, hookH, yAt));
    rope.position.copy(F.world(x, (ropeTop + hookH) / 2, yAt));
    rope.scale.y = ropeTop - hookH;
  };
  place(W * 0.38, LV.crane - 2.7);
  if (!cycle) return { update() {} };

  const bag = jumboBag(makeMat({ color: '#E8EEF5', roughness: 0.9 }), makeMat({ color: '#F59E0B', roughness: 0.7 }));
  g.add(bag);
  const slings = add(new THREE.ConeGeometry(0.62, 0.55, 4, 1, true), dark, 0, 0, yAt);
  slings.rotation.y = Math.PI / 4;
  const { x0, x1, floor, top, rest, period, speed = 1, phase = 0 } = cycle;
  const anchor = new THREE.Vector3();
  const ease = (u) => u * u * (3 - 2 * u);
  const seg = (u, a, b) => ease(Math.min(1, Math.max(0, (u - a) / (b - a))));
  return {
    anchor,
    update(t) {
      const u = (((t * speed + phase) % period) + period) % period;
      const lift = seg(u, 2.5, 10) - seg(u, 33, 35.5);               // floor → transfer height, later back down empty
      const lower = seg(u, 14, 16.5) - seg(u, 27, 29);               // onto the discharger and back up
      const x = x0 + (x1 - x0) * (seg(u, 10, 14) - seg(u, 29, 33));
      const empty = seg(u, 17, 27);                                    // bag sags as it discharges (bottom held by the spout)
      const bottom = floor + (top - floor) * lift - (top - rest) * lower;
      const sy = 1 - 0.7 * empty;
      const loopsH = bottom + 1.15 * sy + 0.15, hookH = loopsH + 0.8;
      place(x, hookH);
      bag.position.copy(F.world(x, bottom, yAt));
      bag.scale.set(1 + 0.06 * empty, sy, 1 + 0.06 * empty);
      slings.position.copy(F.world(x, (loopsH + hookH - 0.25) / 2, yAt));
      anchor.copy(F.world(x, bottom + 0.6, yAt));
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
  // insulation / inner skin so the cut reads as a thick wall
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
  const surface = new THREE.Mesh(new THREE.CircleGeometry(R * 0.94, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FBBF24').multiplyScalar(1.6), transparent: true, opacity: 0.9, toneMapped: false }));
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
  // support beam at +5.00 on the far (east) side only, so nothing crosses the cut opening
  const frameMat = makeMat({ color: '#5B6B7D', metalness: 0.5, roughness: 0.5 });
  for (const s of [1]) {
    const bx = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 2 * R + 0.8), frameMat);
    bx.position.set(r.x + s * (R + 0.25), LV.support - 0.15, r.z);
    g.add(bx);
  }
  // bubbles in the batch
  const NB = 46;
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FDE68A').multiplyScalar(2.0), toneMapped: false }), NB);
  bubbles.frustumCulled = false;
  g.add(bubbles);
  // glass reflux condenser just above the reactor, with tube bundle, vapour (up) and condensate (down)
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
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(r.x - 0.45, BODY_BOTTOM + hs + head * 0.8, r.z), new THREE.Vector3(r.x - 0.6, cy0 + ch + 0.6, r.z),
    new THREE.Vector3(cx, cy0 + ch + 0.6, r.z), new THREE.Vector3(cx, cy0 + ch, r.z)], false, 'catmullrom', 0.1), 24, 0.09, 8), makeMat({ color: '#8FA3B8', metalness: 0.7, roughness: 0.35 })));
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
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p0, p1, p2], false, 'catmullrom', 0.05), 16, 0.07, 8), hot));
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
  return {
    group: g,
    anchors: {
      heroReactor: new THREE.Vector3(r.x + Math.sin(deg(CUT_AZ + 30)) * R, BODY_BOTTOM + hs * 0.55, r.z + Math.cos(deg(CUT_AZ + 30)) * R),
      heroJacket: new THREE.Vector3(r.x + Math.sin(deg(-78)) * R * 1.08, BODY_BOTTOM + hs * 0.25, r.z + Math.cos(deg(-78)) * R * 1.08),
      heroCondenser: new THREE.Vector3(cx, cy0 + ch * 0.55, r.z),
    },
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
        v.set(r.x + Math.cos(a) * rr, liquidBottom + 0.15 + u * (hLiquid - 0.2), r.z + Math.sin(a) * rr);
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

// ---------------------------------------------------------------------------- assembly
export function buildPlants(world, M, OB) {
  const root = new THREE.Group();
  world.scene.add(root);
  const deckMat = makeMat({ color: '#4A5F78', roughness: 0.7, metalness: 0.4, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
  const KM = { ...M, deckMat };

  // ---- Plant 1 (drawings PB1-102/104/301)
  const env1 = pebEnvelope(root, M, PLANT1, {
    ...PLANT_ENV, roofColor: '#00529B', roofRib: '#003F7A', stripe: '#00A3E0', frameLines: [0, 4, 9, 14, 19, 24, 29, 33],
    stairs: [P1_CORES.stairSW, P1_CORES.stairNE], lift: P1_CORES.lift,
    shutters: [{ side: 'W', y0: 29.6, y1: 32.6, h: 4.0 }],                    // RS 3000×4000, west wall, G–H bay
  });
  const F1 = env1.F;
  const inner1 = new THREE.Group();
  root.add(inner1);
  const IB1 = new Batcher();
  F1.box(IB1, M.concreteLight, 0, 0, F1.W, F1.D, 0, 0.2, -1, { cast: false });
  const reactorHoles = P1_REACTORS.map((r) => [...F1.local(r.x, r.z), reactorDims(r.kl).R + 0.35]);
  const cores = [P1_CORES.stairSW, P1_CORES.stairNE, P1_CORES.lift, P1_CORES.cutout];
  // the top deck's hoisting opening is extended east (assumed) so the crane rope can travel to the bag discharger
  const SLOT = [P1_CORES.cutout[0], P1_CORES.cutout[1], 9.0, P1_CORES.cutout[3]];
  const full = [0.15, 0.15, F1.W - 0.15, F1.D - 0.15];
  deck(IB1, KM, F1, LV.mezz1, full, reactorHoles, cores);
  deck(IB1, KM, F1, LV.mezz2, full, reactorHoles.map(([a, b]) => [a, b, 0.75]), cores);
  deck(IB1, KM, F1, LV.top, full, P1_REACTORS.map((r) => [...F1.local(r.silo.x, r.silo.z), 1.0]), [...cores.slice(0, 3), SLOT]);
  for (const lvl of [LV.mezz1, LV.mezz2, LV.top]) {                           // cutout railing (MEZZ-2 plan)
    const [a, b, c, d] = lvl === LV.top ? SLOT : P1_CORES.cutout;
    F1.box(IB1, M.yellow, a, b - 0.05, c, b, lvl + 1.0, lvl + 1.06, -1, { cast: false });
    F1.box(IB1, M.yellow, c, b, c + 0.05, d, lvl + 1.0, lvl + 1.06, -1, { cast: false });
  }
  // jumbo-bag discharger on MEZZ-2 beside the hoisting cut-out: frame, bag massagers, hopper, rotary valve,
  // screw conveyor under the deck to P1-R-101's charging manhole
  const DX = 7.6, DY = 30.85, BAG_REST = LV.mezz2 + 0.95;
  for (const px of [DX - 0.75, DX + 0.75]) for (const py of [DY - 0.75, DY + 0.75]) F1.box(IB1, M.yellow, px - 0.06, py - 0.06, px + 0.06, py + 0.06, LV.mezz2, LV.mezz2 + 2.6, -1);
  for (const py of [DY - 0.75, DY + 0.75]) F1.box(IB1, M.yellow, DX - 0.81, py - 0.06, DX + 0.81, py + 0.06, LV.mezz2 + 2.5, LV.mezz2 + 2.6, -1);
  for (const px of [DX - 0.75, DX + 0.75]) F1.box(IB1, M.steelDark, px - 0.1, DY - 0.45, px + 0.1, DY + 0.45, LV.mezz2 + 1.1, LV.mezz2 + 1.5, -1);
  F1.mesh(IB1, new THREE.ConeGeometry(0.95, 0.75, 4, 1, true), M.steel, DX, LV.mezz2 + 0.55, DY, [Math.PI, Math.PI / 4, 0]);
  F1.box(IB1, M.steel, DX - 0.67, DY - 0.67, DX + 0.67, DY + 0.67, BAG_REST - 0.08, BAG_REST);
  F1.box(IB1, M.yellow, DX - 0.2, DY - 0.2, DX + 0.2, DY + 0.2, LV.mezz2 - 0.5, LV.mezz2 - 0.1);
  const r101 = P1_REACTORS.find((r) => r.tag === 'P1-R-101');
  const r101Top = BODY_BOTTOM + reactorDims(r101.kl).hs + reactorDims(r101.kl).head;
  tube(IB1, M.steel, F1.world(DX, LV.mezz2 - 0.5, DY), new THREE.Vector3(r101.x + 0.4, r101Top + 0.35, r101.z - 0.55), 0.13);
  // lean-phase conveying line from Warehouse-1 (enters the west wall at +7.0) up to a header feeding the west silos
  const LX = 1.4, LH = 13.3, entry = F1.local(-1.63, -20.425)[1];
  polyline(IB1, M.pipe, [[-0.2, 7.0, entry], [LX, 7.0, entry], [LX, LH, entry]].map(([x, h, y]) => F1.world(x, h, y)), 0.09);
  const westSilos = P1_REACTORS.filter((r) => r.x < PLANT1.x).map((r) => F1.local(r.silo.x, r.silo.z));
  const ys = westSilos.map(([, y]) => y);
  tube(IB1, M.pipe, F1.world(LX, LH, Math.min(...ys)), F1.world(LX, LH, Math.max(...ys)), 0.09);
  for (const [sx, sy] of westSilos) tube(IB1, M.pipe, F1.world(LX, LH, sy), F1.world(sx - 1.1, LH, sy), 0.07);
  let hero = null;
  for (const r of P1_REACTORS) {
    const { hs, head } = reactorDims(r.kl);
    if (r.hero) hero = heroReactor(root, M, r);
    else addReactor(IB1, M, r, r.x < PLANT1.x ? -1 : 1, true);
    silo(IB1, M, r.silo, BODY_BOTTOM + hs + head, r.x, r.z);
  }
  for (const [x, z] of P1_CLT) vessel(IB1, M, x, z, 1.5, 1.9, LV.mezz1);
  for (const [x, z] of P1_REC) vessel(IB1, M, x, z, 1.2, 1.4, LV.mezz2);
  IB1.build(inner1);
  // 36 s cycle played 1.6× fast; phase puts the lift at 42.3 s, inside the film's crane shot
  const crane1 = crane(inner1, M, F1, F1.W, F1.D, DY, { x0: 4.0, x1: DX, floor: 0.2, top: 9.9, rest: BAG_REST, period: 36, speed: 1.6, phase: 6.82 });
  // jumbo bags arriving from Warehouse-1: one waiting at the west shutter, one on a forklift on road R3
  const rb = riseDelay(-4, -28) + 0.05;
  pallet(OB, M.wood, placeAt(-3.3, 0, -32.2), rb);
  fibc(OB, M, placeAt(-3.3, 0.15, -32.2), rb);
  forklift(OB, M, placeAt(-6.5, 0, -21.0, Math.PI / 2), rb, 0.3);
  pallet(OB, M.wood, placeAt(-6.5, 0.25, -22.65, Math.PI / 2), rb);
  fibc(OB, M, placeAt(-6.5, 0.4, -22.65), rb);

  // ---- Plant 2: same envelope; decks over the reactor rows, double-height finishing bay to the south
  const p2Frames = Array.from({ length: 11 }, (_, i) => (i * (PLANT2.d - 0.23)) / 10);
  const env2 = pebEnvelope(root, M, PLANT2, {
    ...PLANT_ENV, roofColor: '#2E7D32', roofRib: '#1F5E23', stripe: '#4ADE80', frameLines: p2Frames,
    stairs: [[0.4, 44.0, 3.8, 47.4]],
    shutters: [{ side: 'S', x0: PLANT2.w / 2 - 2.2, x1: PLANT2.w / 2 + 2.2, h: 4.5 }],   // dispatch shutter at the finishing bay
  });
  const F2 = env2.F;
  const inner2 = new THREE.Group();
  root.add(inner2);
  const IB2 = new Batcher();
  F2.box(IB2, M.concreteLight, 0, 0, F2.W, F2.D, 0, 0.2, -1, { cast: false });
  const holes2 = P2_REACTORS.map((r) => [...F2.local(r.x, r.z), reactorDims(r.kl).R + 0.35]);
  const bayEnd = F2.local(0, -16.5)[1];
  for (const lvl of [LV.mezz1, LV.mezz2, LV.top]) {
    deck(IB2, KM, F2, lvl, [0.15, bayEnd, F2.W - 0.15, F2.D - 0.15], lvl === LV.mezz1 ? holes2 : holes2.map(([a, b]) => [a, b, 0.75]), [[0.4, 44.0, 3.8, 47.4]]);
  }
  for (const r of P2_REACTORS) addReactor(IB2, M, r, r.x < PLANT2.x ? -1 : 1, true);
  IB2.build(inner2);
  crane(inner2, M, F2, F2.W, F2.D, 30);

  // P2 feed from the south powder-polyester reactor down to the flaker head
  const feedMat = makeMat({ color: '#78350F', emissive: '#F59E0B', emissiveIntensity: 1.2 });
  const feed = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(25.6, 2.0, -20.5), new THREE.Vector3(25.6, 2.0, -18.0), new THREE.Vector3(26.0, 3.1, -15.6), new THREE.Vector3(26.0, 2.55, -14.4)], false, 'catmullrom', 0.2), 32, 0.11, 8), feedMat);
  root.add(feed);

  const top = (P) => new THREE.Vector3(P.x, LV.ridge + 1.5, P.z);
  return {
    envs: { p1: env1, p2: env2 },
    anchors: {
      ...hero.anchors, plant1: top(PLANT1), plant2: top(PLANT2),
      p1Crane: F1.world(F1.W * 0.38, LV.crane + 1.2, DY),
      p1Silo: new THREE.Vector3(P1_REACTORS[0].silo.x, LV.top + 2.0, P1_REACTORS[0].silo.z),
      p1Hoist: F1.world(5.8, LV.crane + 1.0, DY),
      p1Discharger: F1.world(DX, BAG_REST + 1.6, DY),
      jumboBag: crane1.anchor,
    },
    update(t, s) {
      hero.update(t, s);
      crane1.update(t);
      feedMat.emissiveIntensity = 0.4 + 1.2 * s.finishingRun;
      inner1.visible = s.plant1Cutaway > 0.01;
      inner2.visible = s.plant2Cutaway > 0.01;
      // interior pieces outside the batched groups only show while their building is opened up
      hero.group.visible = inner1.visible;
      feed.visible = inner2.visible;
      const c1 = env1.setCutaway(s.plant1Cutaway);
      const c2 = env2.setCutaway(s.plant2Cutaway);
      return c1 || c2;
    },
  };
}
