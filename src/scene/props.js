// Small batched props shared by the warehouses and plants: counterbalance forklift, jumbo bag (FIBC),
// pallets and a container truck. Each takes a base Matrix4 (origin on the ground, facing local +X).
import * as THREE from 'three';

export function placeAt(x, y, z, ry = 0) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
}

const tmp = new THREE.Matrix4();
function part(B, mat, base, geo, x, y, z, rot = [0, 0, 0], rise = -1, opts) {
  tmp.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(1, 1, 1));
  B.add(geo, mat, base.clone().multiply(tmp), rise, opts);
}
const box = (B, mat, base, x, y, z, w, h, d, rise, opts) => part(B, mat, base, new THREE.BoxGeometry(w, h, d), x, y, z, [0, 0, 0], rise, opts);

// Counterbalance forklift, forks toward +X. `forkH` = fork height above ground.
export function forklift(B, M, base, rise = -1, forkH = 0.15) {
  box(B, M.yellow, base, -0.05, 0.75, 0, 1.8, 0.9, 1.1, rise);                 // chassis
  box(B, M.carDark, base, -1.0, 0.8, 0, 0.45, 1.0, 1.12, rise);                 // counterweight
  box(B, M.carDark, base, -0.35, 1.35, 0, 0.45, 0.35, 0.5, rise);               // seat
  for (const x of [-0.75, 0.35]) for (const z of [-0.5, 0.5]) box(B, M.carDark, base, x, 1.7, z, 0.06, 0.9, 0.06, rise);
  box(B, M.carDark, base, -0.2, 2.17, 0, 1.2, 0.06, 1.1, rise);                 // overhead guard
  for (const z of [-0.33, 0.33]) box(B, M.carDark, base, 0.95, 1.3, z, 0.1, 2.4, 0.1, rise);   // mast
  box(B, M.carDark, base, 0.95, 2.45, 0, 0.1, 0.1, 0.76, rise);
  box(B, M.steelDark, base, 1.05, forkH + 0.4, 0, 0.06, 0.8, 0.85, rise);       // fork carriage
  for (const z of [-0.28, 0.28]) box(B, M.steelDark, base, 1.6, forkH, z, 1.1, 0.05, 0.12, rise);
  const wheel = new THREE.CylinderGeometry(0.28, 0.28, 0.22, 12);
  for (const x of [-0.65, 0.6]) for (const z of [-0.55, 0.55]) part(B, M.carDark, base, wheel, x, 0.28, z, [Math.PI / 2, 0, 0], rise);
}

// Static jumbo bag (FIBC, ~1 t) with lifting loops; origin at its bottom centre.
export function fibc(B, M, base, rise = -1, h = 1.15, mat = M.bag) {
  box(B, mat, base, 0, h / 2, 0, 1.0, h, 1.0, rise);
  part(B, mat, base, new THREE.CylinderGeometry(0.16, 0.22, 0.18, 10), 0, h + 0.09, 0, [0, 0, 0], rise);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(B, M.yellow, base, sx * 0.42, h + 0.1, sz * 0.42, 0.05, 0.22, 0.05, rise, { cast: false });
}

// Wooden pallet 1.0 × 1.2 (top deck at 0.15); origin at its bottom centre.
export function pallet(B, mat, base, rise = -1) {
  box(B, mat, base, 0, 0.13, 0, 1.0, 0.04, 1.2, rise);
  for (const x of [-0.42, 0, 0.42]) box(B, mat, base, x, 0.055, 0, 0.12, 0.11, 1.2, rise);
}

// Container truck: rear of the trailer at the origin, cab toward +X; deck at dock height (1.2 m).
export function truck(B, M, base, rise = -1, boxMat = M.bagBlue) {
  box(B, M.carDark, base, 4.6, 0.85, 0, 9.0, 0.3, 2.1, rise);                    // chassis
  box(B, boxMat, base, 3.6, 2.5, 0, 7.2, 2.6, 2.5, rise);                         // container
  box(B, M.steelDark, base, 0.02, 2.5, 0, 0.06, 2.5, 2.4, rise, { cast: false }); // rear doors
  box(B, M.car, base, 8.35, 1.95, 0, 1.9, 2.5, 2.45, rise);                       // cab
  box(B, M.glass, base, 9.31, 2.55, 0, 0.04, 0.9, 2.1, rise, { cast: false });    // windscreen
  const wheel = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 14);
  for (const x of [1.2, 2.3, 8.2]) for (const z of [-1.05, 1.05]) part(B, M.carDark, base, wheel, x, 0.5, z, [Math.PI / 2, 0, 0], rise);
}

// Straight pipe between two world points, and a polyline of them with ball elbows.
export function tube(B, mat, a, b, r, rise = -1) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  B.add(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 10), mat, new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)), rise);
}
export function polyline(B, mat, pts, r, rise = -1) {
  for (let i = 0; i < pts.length - 1; i++) tube(B, mat, pts[i], pts[i + 1], r, rise);
  for (let i = 1; i < pts.length - 1; i++) B.mesh(new THREE.SphereGeometry(r * 1.25, 10, 8), mat, pts[i].toArray(), [0, 0, 0], [1, 1, 1], rise);
}
