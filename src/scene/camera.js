// Interprets beat_grid camera shots. Each shot interpolates target / radius / elevation /
// azimuth / fov / aperture with its easing; radius interpolates in log space so dolly speed
// feels constant. `blendIn` cross-fades from the previous shot's end state.
import * as THREE from 'three';
import { ease, lerp, smooth, deg } from '../lib/util.js';

function evalShot(shot, t) {
  const u = Math.min(1, Math.max(0, (t - shot.start) / (shot.end - shot.start)));
  const e = (ease[shot.ease] || ease.inOutSine)(u);
  const [t0, t1] = shot.target;
  return {
    target: new THREE.Vector3(lerp(t0[0], t1[0], e), lerp(t0[1], t1[1], e), lerp(t0[2], t1[2], e)),
    radius: shot.radius[0] * Math.pow(shot.radius[1] / shot.radius[0], e),
    elev: lerp(shot.elev[0], shot.elev[1], e),
    azim: lerp(shot.azim[0], shot.azim[1], e),
    fov: lerp(shot.fov[0], shot.fov[1], e),
    aperture: lerp(shot.aperture[0], shot.aperture[1], e),
  };
}

function mix(a, b, k) {
  return {
    target: a.target.clone().lerp(b.target, k),
    radius: a.radius * Math.pow(b.radius / a.radius, k),
    elev: lerp(a.elev, b.elev, k), azim: lerp(a.azim, b.azim, k),
    fov: lerp(a.fov, b.fov, k), aperture: lerp(a.aperture, b.aperture, k),
  };
}

export function createRig(shots) {
  return function cameraAt(t) {
    let i = shots.findIndex((s) => t >= s.start && t < s.end);
    if (i < 0) i = t < shots[0].start ? 0 : shots.length - 1;
    const shot = shots[i];
    let st = evalShot(shot, t);
    if (i > 0 && shot.blendIn && t - shot.start < shot.blendIn) {
      const prev = evalShot(shots[i - 1], shots[i - 1].end);
      st = mix(prev, st, smooth((t - shot.start) / shot.blendIn));
    }
    const el = deg(st.elev), az = deg(st.azim);
    const pos = st.target.clone().add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(st.radius));
    return { ...st, position: pos, shot: shot.id };
  };
}
