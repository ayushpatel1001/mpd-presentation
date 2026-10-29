// Shared pre-engineered building (PEB) envelope used by the plants and warehouses:
// portal frames, gable roof (optional monitor / skylights / turbo vents), ribbed metal cladding
// over a masonry base, window and vent rows, gutters, end doors, shutters, docks, stairs and lift.
import * as THREE from 'three';
import { Batcher, patchRise, makeMat } from './materials.js';
import { riseDelay } from './site.js';

export function ribTexture(base, rib, vertical) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 32, 32);
  g.fillStyle = rib;
  if (vertical) { g.fillRect(0, 0, 5, 32); g.fillRect(16, 0, 2, 32); } else { g.fillRect(0, 0, 32, 5); g.fillRect(0, 16, 32, 2); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Box whose UVs are in metres / pitch so ribbed textures keep a constant rib spacing on any size.
export function ribbedBox(w, h, d, pitch = 0.8) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const scale = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * scale[f][0] / pitch, uv.getY(i) * scale[f][1] / pitch);
  }
  return g;
}

// Local building frame: x across the span (0..W), y along the ridge (0..D), h up.
// rotY = 0 → ridge runs north–south (P.w along X); rotY = π/2 → ridge runs east–west (P.w along Z).
export function frameOf(P, rotY = 0) {
  const W = P.w - 0.23, D = P.d - 0.23;
  const c = Math.cos(rotY), s = Math.sin(rotY);
  const R = (x, y) => [x * c - y * s, -x * s - y * c];          // local (x, y) → world (dx, dz)
  const [cx, cz] = R(W / 2, D / 2);
  const O = new THREE.Vector3(P.x - cx, 0, P.z - cz);
  const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  const swap = Math.abs(s) > 0.5;
  const world = (x, h, y) => { const [dx, dz] = R(x, y); return new THREE.Vector3(O.x + dx, h, O.z + dz); };
  return {
    W, D, rotY, qy,
    world,
    local(xw, zw) { const dx = xw - O.x, dz = zw - O.z; return [dx * c - dz * s, -dx * s - dz * c]; },
    box(B, mat, x0, y0, x1, y1, h0, h1, rise, opts) {
      const xa = Math.min(x0, x1), xb = Math.max(x0, x1), ya = Math.min(y0, y1), yb = Math.max(y0, y1);
      const p = world((xa + xb) / 2, (h0 + h1) / 2, (ya + yb) / 2);
      B.box(mat, p.x, p.y, p.z, swap ? yb - ya : xb - xa, h1 - h0, swap ? xb - xa : yb - ya, rise, opts);
    },
    matrix(x, h, y, rot = [0, 0, 0], scale = [1, 1, 1]) {
      const q = qy.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)));
      return new THREE.Matrix4().compose(world(x, h, y), q, new THREE.Vector3(...scale));
    },
    mesh(B, geo, mat, x, h, y, rot = [0, 0, 0], rise = -1, opts) { B.add(geo, mat, this.matrix(x, h, y, rot), rise, opts); },
  };
}

// opts: rotY, eave, ridge, baseH, windowRows, ventRows, gableRows, monitor, skylights (y list), turbo,
//       roofColor, roofRib, stripe, frameLines, stairs, stairLevels, lift, liftTop, shutters, docks, endDoors
export function pebEnvelope(root, M, P, opts) {
  const F = frameOf(P, opts.rotY || 0);
  const { W, D } = F;
  const rise = riseDelay(P.x, P.z);
  const eave = opts.eave, ridge = opts.ridge;
  const half = W / 2, pitch = Math.atan2(ridge - eave, half);
  const mk = (m) => patchRise(m);
  const ribV = ribTexture('#DCE3EA', '#B9C4D0', true);
  const ribR = ribTexture(opts.roofColor, opts.roofRib, false);
  const mats = {
    base: mk(makeMat({ color: '#C9D2DC', roughness: 0.9 })),
    clad: mk(makeMat({ color: '#FFFFFF', map: ribV, roughness: 0.6 })),
    roof: mk(makeMat({ color: '#FFFFFF', map: ribR, roughness: 0.5, metalness: 0.3 })),
    frame: mk(makeMat({ color: '#5B6B7D', roughness: 0.5, metalness: 0.5 })),
    trim: mk(makeMat({ color: '#94A3B8', roughness: 0.5, metalness: 0.4 })),
    glass: mk(makeMat({ color: '#4C87B2', emissive: '#0E3A5A', emissiveIntensity: 0.45, roughness: 0.15, metalness: 0.3 })),
    louver: mk(makeMat({ color: '#334155', roughness: 0.6, metalness: 0.3 })),
    door: mk(makeMat({ color: '#64748B', roughness: 0.5, metalness: 0.5 })),
    stripe: mk(makeMat({ color: opts.stripe, emissive: opts.stripe, emissiveIntensity: 1.3 })),
    stair: mk(makeMat({ color: '#94A3B8', roughness: 0.6, metalness: 0.4 })),
    sky: mk(makeMat({ color: '#E0F2FE', emissive: '#7DD3FC', emissiveIntensity: 0.25, roughness: 0.2 })),
  };
  const SB = new Batcher();
  const t = 0.23;
  const baseH = opts.baseH;
  // masonry base, ribbed cladding above, trim band between them
  for (const [x0, y0, x1, y1] of [[-t / 2, -t / 2, W + t / 2, t / 2], [-t / 2, D - t / 2, W + t / 2, D + t / 2], [-t / 2, -t / 2, t / 2, D + t / 2], [W - t / 2, -t / 2, W + t / 2, D + t / 2]]) {
    F.box(SB, mats.base, x0, y0, x1, y1, 0, baseH, rise);
    const w = x1 - x0, d = y1 - y0, h = eave - baseH;
    F.mesh(SB, ribbedBox(w, h, d), mats.clad, (x0 + x1) / 2, baseH + h / 2, (y0 + y1) / 2, [0, 0, 0], rise);
    F.box(SB, mats.trim, x0 - 0.05, y0 - 0.05, x1 + 0.05, y1 + 0.05, baseH - 0.08, baseH + 0.08, rise, { cast: false });
  }
  if (opts.stripe) for (const x of [-t / 2 - 0.04, W + t / 2]) F.box(SB, mats.stripe, x, 0, x + 0.04, D, eave - 0.9, eave - 0.45, rise, { cast: false });
  // gable triangles
  const tri = new THREE.Shape([new THREE.Vector2(-half - t / 2, 0), new THREE.Vector2(half + t / 2, 0), new THREE.Vector2(0, ridge - eave)]);
  const gable = new THREE.ExtrudeGeometry(tri, { depth: t, bevelEnabled: false });
  gable.translate(0, 0, -t / 2);
  for (const y of [0, D]) F.mesh(SB, gable, mats.base, half, eave, y, [0, 0, 0], rise);
  // roof slopes, gutters, optional monitor, skylight strips and turbo ventilators
  const slope = Math.hypot(half, ridge - eave) + 0.55;
  for (const s of [-1, 1]) {
    const cx = half + s * (half / 2 - 0.25), cy = (eave + ridge) / 2 + 0.12;
    F.mesh(SB, ribbedBox(slope, 0.14, D + 0.9, 0.6), mats.roof, cx, cy, D / 2, [0, 0, -s * pitch], rise);
    F.box(SB, mats.trim, s < 0 ? -0.75 : W + 0.45, -0.45, s < 0 ? -0.45 : W + 0.75, D + 0.45, eave - 0.25, eave + 0.05, rise);
    // polycarbonate lighting strips across the slope, from beside the turbo vents to near the eave
    const sl0 = 2.4, sl1 = slope - 0.9, sc = (sl0 + sl1) / 2 - slope / 2;
    for (const y of opts.skylights || []) {
      F.mesh(SB, new THREE.BoxGeometry(sl1 - sl0, 0.05, 0.4), mats.sky, cx + s * sc * Math.cos(pitch), cy + 0.09 - sc * Math.sin(pitch), y, [0, 0, -s * pitch], rise, { cast: false });
    }
  }
  if (opts.monitor) {
    const mL = D * 0.82;
    F.box(SB, mats.louver, half - 0.85, D / 2 - mL / 2, half + 0.85, D / 2 + mL / 2, ridge - 0.05, ridge + 0.65, rise);
    for (const s of [-1, 1]) F.mesh(SB, ribbedBox(1.4, 0.1, mL + 0.3, 0.6), mats.roof, half + s * 0.62, ridge + 0.82, D / 2, [0, 0, -s * 0.3], rise);
  } else {
    F.box(SB, mats.trim, half - 0.3, -0.45, half + 0.3, D + 0.45, ridge + 0.12, ridge + 0.3, rise);   // ridge cap
  }
  if (opts.turbo) {
    const ys = Array.isArray(opts.turbo) ? opts.turbo : Array.from({ length: Math.floor((D - 5) / 6.5) + 1 }, (_, i) => 3 + i * 6.5);
    for (const y of ys) for (const s of [-1, 1]) {
      const x = half + s * 1.5, h = ridge - (ridge - eave) * (1.5 / half) + 0.2;
      F.mesh(SB, new THREE.CylinderGeometry(0.3, 0.3, 0.35, 12), mats.trim, x, h + 0.17, y, [0, 0, 0], rise);
      F.mesh(SB, new THREE.SphereGeometry(0.34, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mats.trim, x, h + 0.35, y, [0, 0, 0], rise);
    }
  }
  // portal frames: columns on both long walls + rafters, downpipes outside
  for (const y of opts.frameLines) {
    for (const x of [0.25, W - 0.25]) F.box(SB, mats.frame, x - 0.2, y - 0.15, x + 0.2, y + 0.15, 0, eave, rise);
    for (const s of [-1, 1]) F.mesh(SB, new THREE.BoxGeometry(half / Math.cos(pitch), 0.55, 0.22), mats.frame, half + s * half / 2, (eave + ridge) / 2 - 0.45, y, [0, 0, -s * pitch], rise);
    for (const x of [-t / 2 - 0.05, W + t / 2 - 0.02]) F.box(SB, mats.trim, x, y - 0.06, x + 0.07, y + 0.06, 0.2, eave - 0.3, rise, { cast: false });
  }
  // windows and vents per bay on the long walls (skipped where a dock or shutter sits)
  const blocked = [...(opts.docks || []).map((d) => [d.side, d.y]), ...(opts.shutters || []).filter((s) => s.side).map((s) => [s.side, (s.y0 + s.y1) / 2])];
  const win = (x, y0w, y1w, h0, h1, mat) => {
    const out = x < W / 2 ? -1 : 1, xf = x < W / 2 ? -t / 2 : W + t / 2;
    F.box(SB, mats.trim, xf, y0w - 0.07, xf + out * 0.05, y1w + 0.07, h0 - 0.07, h1 + 0.07, rise, { cast: false });
    F.box(SB, mat, xf, y0w, xf + out * 0.08, y1w, h0, h1, rise, { cast: false });
    if (mat === mats.glass) F.box(SB, mats.trim, xf, (y0w + y1w) / 2 - 0.025, xf + out * 0.1, (y0w + y1w) / 2 + 0.025, h0, h1, rise, { cast: false });
  };
  const fl = opts.frameLines;
  for (let i = 0; i < fl.length - 1; i++) {
    const yc = (fl[i] + fl[i + 1]) / 2;
    for (const [side, x] of [['W', 0], ['E', W]]) {
      const hit = blocked.some(([s, y]) => s === side && Math.abs(y - yc) < 3.2);
      for (const [h0, h1] of opts.windowRows) if (!hit || h0 > 5.5) win(x, yc - 0.75, yc + 0.75, h0, h1, mats.glass);
      for (const [h0, h1] of opts.ventRows) win(x, yc - 0.6, yc + 0.6, h0, h1, mats.louver);
    }
  }
  // end walls: double doors, gable windows/vents
  for (const y of [0, D]) {
    const out = y === 0 ? -1 : 1, yf = y === 0 ? -t / 2 : D + t / 2;
    if (opts.endDoors !== false) {
      F.box(SB, mats.door, half - 0.8, yf, half + 0.8, yf + out * 0.06, 0, 2.5, rise, { cast: false });
      F.box(SB, mats.trim, half - 0.02, yf, half + 0.02, yf + out * 0.08, 0, 2.5, rise, { cast: false });
    }
    for (const xc of [half - 2.6, half + 2.6]) {
      for (const [h0, h1, kind] of opts.gableRows || []) {
        const wdt = kind === 'glass' ? 0.75 : 0.6;
        F.box(SB, kind === 'glass' ? mats.glass : mats.louver, xc - wdt, yf, xc + wdt, yf + out * 0.08, h0, h1, rise, { cast: false });
      }
    }
  }
  // rolling shutters: { side: 'W'|'E'|'S'|'N', y0, y1 (or x0, x1 on end walls), h }
  const shutter = (x0, y0, x1, y1, h0, h1) => {
    F.box(SB, mats.door, x0, y0, x1, y1, h0, h1, rise, { cast: false });
    const horiz = Math.abs(x1 - x0) > Math.abs(y1 - y0);
    for (let h = h0 + 0.3; h < h1; h += 0.3) F.box(SB, mats.trim, x0 - (horiz ? 0 : 0.01), y0 - (horiz ? 0.01 : 0), x1 + (horiz ? 0 : 0.01), y1 + (horiz ? 0.01 : 0), h, h + 0.04, rise, { cast: false });
  };
  for (const s of opts.shutters || []) {
    if (s.side === 'W') shutter(-t / 2 - 0.06, s.y0, -t / 2, s.y1, 0, s.h);
    else if (s.side === 'E') shutter(W + t / 2, s.y0, W + t / 2 + 0.06, s.y1, 0, s.h);
    else if (s.side === 'S') shutter(s.x0, -t / 2 - 0.06, s.x1, -t / 2, 0, s.h);
    else if (s.side === 'N') shutter(s.x0, D + t / 2, s.x1, D + t / 2 + 0.06, 0, s.h);
  }
  // truck docks: raised platform, canopy, shutter
  for (const d of opts.docks || []) {
    const out = d.side === 'W' ? -1 : 1, xf = d.side === 'W' ? -t / 2 : W + t / 2, depth = d.depth || 3.8;
    const xa = xf, xb = xf + out * depth;
    F.box(SB, mats.base, xa, d.y - 2.35, xb, d.y + 2.35, 0, 1.2, rise);
    F.box(SB, mats.louver, xb - out * 0.25, d.y - 1.0, xb, d.y + 1.0, 0.2, 1.2, rise, { cast: false });     // bumper / leveller lip
    F.box(SB, mats.roof, xa, d.y - 2.5, xb + out * 0.4, d.y + 2.5, 5.4, 5.55, rise);
    for (const yy of [d.y - 2.35, d.y + 2.35]) F.box(SB, mats.frame, xb - out * 0.12, yy - 0.1, xb + out * 0.08, yy + 0.1, 1.2, 5.4, rise);
    shutter(xf, d.y - 2.0, xf + out * 0.06, d.y + 2.0, 0, 5.0);
  }
  // stairs and goods lift (fade with the envelope)
  for (const [x0, y0, x1, y1] of opts.stairs || []) {
    const nW = x1 - x0, lv = opts.stairLevels;
    for (let k = 0; k < lv.length - 1; k++) {
      const h0 = lv[k], h1 = lv[k + 1];
      const h2 = (h1 - h0) / 2, run = y1 - y0 - 1.2;
      const len = Math.hypot(run, h2), ang = Math.atan2(h2, run);
      F.mesh(SB, new THREE.BoxGeometry(nW / 2 - 0.1, 0.12, len), mats.stair, x0 + nW / 4, h0 + h2 / 2, y0 + run / 2, [ang, 0, 0], rise);
      F.box(SB, mats.stair, x0, y1 - 1.2, x1, y1, h0 + h2 - 0.1, h0 + h2, rise);
      F.mesh(SB, new THREE.BoxGeometry(nW / 2 - 0.1, 0.12, len), mats.stair, x0 + 3 * nW / 4, h0 + h2 * 1.5, y0 + run / 2, [-ang, 0, 0], rise);
    }
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) F.box(SB, mats.frame, x - 0.08, y - 0.08, x + 0.08, y + 0.08, 0, lv[lv.length - 1] + 1.1, rise);
  }
  if (opts.lift) {
    const [x0, y0, x1, y1] = opts.lift;
    F.box(SB, mats.base, x0, y0, x1, y1, 0, opts.liftTop, rise);
    F.box(SB, mats.door, x0 + 0.6, y1, x1 - 0.6, y1 + 0.05, 0.2, 2.6, rise, { cast: false });
  }
  const group = new THREE.Group();
  root.add(group);
  SB.build(group);
  // holographic outline for cutaway shots
  const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color('#38BDF8').multiplyScalar(2.5), transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const outline = new THREE.Group();
  const eb = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, eave, D)), lineMat);
  eb.position.copy(F.world(W / 2, eave / 2, D / 2));
  eb.quaternion.copy(F.qy);
  outline.add(eb);
  const p = [F.world(0, eave, 0), F.world(half, ridge, 0), F.world(W, eave, 0), F.world(0, eave, D), F.world(half, ridge, D), F.world(W, eave, D)];
  outline.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([p[0], p[1], p[1], p[2], p[3], p[4], p[4], p[5], p[1], p[4]]), lineMat));
  root.add(outline);

  const list = Object.values(mats);
  let transparentNow = false, castNow = true;
  return {
    F, half, pitch, eave, ridge, group, skylights: opts.skylights || [],
    // roof surface height (top of sheeting) at local x
    roofTop: (x) => eave + (ridge - eave) * (1 - Math.abs(x - half) / half) + 0.12 + 0.08,
    // returns true when shadow casting changed (shadow map must be refreshed)
    setCutaway(c) {
      const op = 1 - 0.94 * c;
      const transparent = op < 0.999;
      for (const m of list) {
        m.opacity = op;
        if (transparent !== transparentNow) { m.transparent = transparent; m.depthWrite = !transparent; m.needsUpdate = true; }
      }
      transparentNow = transparent;
      group.visible = c < 0.985;
      lineMat.opacity = 0.85 * Math.sin(Math.min(1, c) * Math.PI / 2);
      outline.visible = c > 0.01;
      const cast = c < 0.5;
      if (cast !== castNow) { group.traverse((o) => { if (o.isMesh) o.castShadow = cast; }); castNow = cast; return true; }
      return false;
    },
  };
}
