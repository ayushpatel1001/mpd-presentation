// Boots the scene + HUD and exposes window.renderFrame(t) for deterministic frame capture.
import * as THREE from 'three';
import { createWorld } from './scene/world.js';
import { createMaterials, Batcher, riseUniform } from './scene/materials.js';
import { buildSite } from './scene/site.js';
import { buildPlants } from './scene/process.js';
import { buildFinishing } from './scene/finishing.js';
import { buildTanks } from './scene/tanks.js';
import { buildUtilities } from './scene/utilities.js';
import { buildFlows } from './scene/flows.js';
import { buildQaqc } from './scene/qaqc.js';
import { buildWarehouses } from './scene/warehouse.js';
import { buildSolar, siteRoofs, MODULE } from './scene/solar.js';
import { drawModelLabels } from './hud/modelLabels.js';
import { createRig } from './scene/camera.js';
import { createHud } from './hud/hud.js';
import { keyframes } from './lib/util.js';

const FONTS = [['Inter', 400], ['Inter', 500], ['Inter', 600], ['Inter', 700], ['Inter', 800], ['Inter', 900],
  ['Montserrat', 600], ['Montserrat', 700], ['Montserrat', 800], ['Montserrat', 900], ['JetBrains Mono', 500], ['JetBrains Mono', 700]];

function orbitCam({ target, radius, elev, azim, fov = 34, aperture = 0 }) {
  const el = (elev * Math.PI) / 180, az = (azim * Math.PI) / 180;
  const tg = new THREE.Vector3(...target);
  const position = tg.clone().add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(radius));
  return { target: tg, position, radius, fov, aperture, shot: 'preview' };
}

function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

async function boot() {
  const [tokens, timeline] = await Promise.all([
    fetch('/data/style_tokens.json').then((r) => r.json()),
    fetch('/data/timeline.resolved.json').then((r) => r.json()),
  ]);
  await Promise.all(FONTS.map(async ([fam, w]) => {
    const f = new FontFace(fam, `url(/assets/fonts/${fam.replace(' ', '')}-${w}.ttf)`, { weight: String(w) });
    await f.load();
    document.fonts.add(f);
  }));
  await document.fonts.ready;
  const logo = await loadImage('/assets/brand/mpd_logo.jpg');
  const plan = await new THREE.TextureLoader().loadAsync('/assets/reference/site_plan_layout.png');
  plan.anisotropy = 8;

  // ?scale=0.5 renders the 3D layer at lower resolution for quick draft renders
  const scale = Number(new URLSearchParams(location.search).get('scale'));
  const world = createWorld(document.getElementById('gl'), tokens, scale ? { renderScale: scale } : undefined);
  const M = createMaterials(tokens);
  const B = new Batcher();
  const site = buildSite(world, M, tokens, plan);
  const plants = buildPlants(world, M, B);
  const finishing = buildFinishing(world, M);
  const tanks = buildTanks(world, M, B, tokens);
  const utilities = buildUtilities(world, M, B);
  const flows = buildFlows(world, M, B, tokens);
  const qaqc = buildQaqc(world, M);
  const warehouses = buildWarehouses(world, M);
  const solar = buildSolar(world, M, siteRoofs({ ...plants.envs, ...warehouses.envs, fuel: utilities.fuelShed }), B);
  window.__model = { solar: { modules: solar.count, kwp: solar.kwp, candidates: solar.available, perRoof: solar.perRoof }, storage: warehouses.storage };
  const statics = new THREE.Group();
  world.scene.add(statics);
  B.build(statics);
  const anchors = { ...plants.anchors, ...finishing.anchors, ...tanks.anchors, ...utilities.anchors, ...qaqc.anchors, ...warehouses.anchors };
  anchors.solarWh1 = anchors.wh1.clone().add(new THREE.Vector3(-7, 0, -12));
  const st = warehouses.storage, fmt = (n) => n.toLocaleString('en-IN');
  const labels = [];
  labels.push(
    { anchor: 'wh1', offset: [70, -170], title: 'WAREHOUSE-1 · MOBILE COMPACT RACKING',
      lines: [`${fmt(st.wh1.pallets)} pallet positions ≈ ${fmt(st.wh1.tonnes)} t`, `7 mobile units: ${fmt(st.wh1.byKg[500])} × 500 kg · static row: ${fmt(st.wh1.byKg[1000])} × 1 t`] },
    { anchor: 'wh2', offset: [70, -150], title: 'WAREHOUSE-2 · MOBILE COMPACT RACKING',
      lines: [`${fmt(st.wh2.pallets)} pallet positions ≈ ${fmt(st.wh2.tonnes)} t`, `6 mobile units × 10 bays × 6 levels · 500 kg`] },
    { anchor: 'solarWh1', offset: [-80, -150], color: '#F59E0B', title: `${(solar.kwp / 1000).toFixed(2)} MWp ROOFTOP SOLAR`,
      lines: [`${fmt(solar.count)} × ${MODULE.wp} Wp modules on every roof`] },
    { anchor: 'depalletiser', offset: [-70, -150], title: 'DEPALLETISER → JUMBO-BAG FILLING',
      lines: ['25 kg bags → 1 t FIBC for fast reactor charging'] },
    { anchor: 'p1Hoist', offset: [70, -120], title: 'EOT CRANE · JUMBO BAG TO REACTOR',
      lines: ['hoist through the cut-out → discharger on MEZZ-2 → P1-R-101'] },
  );
  // the same storage call-outs anchored on the racks for cut-away views
  for (const k of ['wh1', 'wh2']) labels.push({ ...labels.find((l) => l.anchor === k), anchor: `${k}Racks` });
  const hudCtx = document.getElementById('hud').getContext('2d');
  const rig = createRig(timeline.camera);
  const hud = createHud(document.getElementById('hud'), tokens, timeline, { logo });
  const states = timeline.sceneStates;
  let shadowsReady = false;
  const v = new THREE.Vector3();

  window.renderFrame = (t, opts = {}) => {
    const S = {};
    for (const [k, kf] of Object.entries(states)) S[k] = keyframes(kf, t);
    Object.assign(S, opts.states);   // preview overrides, e.g. { plant1Cutaway: 1 }
    riseUniform.value = S.buildingsRise;
    site.update(t, S);
    finishing.update(t, S);
    utilities.update(t, S);
    flows.update(t, S, states);
    const c1 = plants.update(t, S);
    const c2 = tanks.update(t, S);
    const c3 = qaqc.update(t, S.qaCutaway ?? 0);
    const c4 = warehouses.update(t, S);
    solar.update(t, S);

    // opts.cam overrides the timeline camera for model previews: { target, radius, elev, azim, fov, aperture }
    const cam = opts.cam ? orbitCam(opts.cam) : rig(t);
    const camera = world.camera;
    camera.position.copy(cam.position);
    camera.fov = cam.fov;
    // near plane scales with orbit radius: ~10x more depth precision on the high aerials (no z-fighting on
    // road markings and pads) while close interior shots keep a 0.3 m near plane
    camera.near = Math.min(4, Math.max(0.3, cam.radius / 110));
    camera.updateProjectionMatrix();
    camera.lookAt(cam.target);
    camera.updateMatrixWorld();
    world.scene.fog.density = 0.45 / (cam.radius + 150);

    const rising = S.buildingsRise > 0.0005 && S.buildingsRise < 0.9995;
    if (!shadowsReady || rising || c1 || c2 || c3 || c4 || opts.states) world.renderer.shadowMap.needsUpdate = true;
    shadowsReady = true;

    if (!opts.hudOnly) world.render({
      focus: camera.position.distanceTo(cam.target), aperture: cam.aperture,
      dim: Math.max(S.siteDim, S.cardsBackdrop * 0.5), fade: S.fadeToBlack, time: t, exposure: 1.12, bloom: 0.85,
    });

    const screen = {};
    for (const [k, p] of Object.entries(anchors)) {
      v.copy(p).project(camera);
      screen[k] = { x: (v.x + 1) / 2 * 1920, y: (1 - v.y) / 2 * 1080, visible: v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.02 && Math.abs(v.y) < 1.02 };
    }
    hud.setHideText(!!opts.hideText);
    const manifest = opts.noHud ? hud.clear() : hud.draw(t, { anchors: screen, fade: S.fadeToBlack });
    if ((S.modelLabels ?? 0) > 0.5) drawModelLabels(hudCtx, labels.filter((l) => !opts.labels || opts.labels.includes(l.anchor)), screen, tokens);
    return { manifest, shot: cam.shot };
  };
  window.__debug = { world, hud, THREE };
  window.ready = true;
}

boot().catch((e) => { window.bootError = String(e && e.stack ? e.stack : e); console.error(e); });
