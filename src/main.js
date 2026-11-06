// MPD Ujjain plant: interactive 3D model viewer (orbit / pan / zoom + cutaways, layers and pipe flows).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { tokens } from './scene/tokens.js';
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
import { PLANT1, PLANT2, BLENDER, QAQC, FG_FARM, PESO, BOILER } from './scene/layout.js';
import { smooth } from './lib/util.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString('en-IN');

// ---- UI model: every control drives one or more scene "state" channels (0..1) that are eased toward their target
const CUTAWAYS = [
  ['plant1Cutaway', 'Plant 1 — liquid resins'], ['plant2Cutaway', 'Plant 2 — solid & specialty'], ['wh1Cutaway', 'Warehouse-1'],
  ['wh2Cutaway', 'Warehouse-2'], ['qaCutaway', 'QA / QC building'], ['blenderCutaway', 'Blender house'], ['pesoXray', 'PESO tank pit (x-ray)'],
];
const LAYERS = [['solarPanels', 'Rooftop solar'], ['running', 'Equipment running'], ['utilityGlow', 'Utilities glow']];
const FLOWS = [
  ['flowThermic', 'Thermic oil', 'thermicOil'], ['flowCooling', 'Cooling water', 'coolingWater'], ['flowNitrogen', 'Nitrogen', 'nitrogen'],
  ['flowEffluent', 'Effluent', 'effluent'], ['flowResin', 'Resin', 'resin'], ['flowSolvent', 'Solvent', 'solvent'],
];
const target = {};
const cur = {};
for (const [k] of [...CUTAWAYS, ...LAYERS, ...FLOWS]) { target[k] = 0; cur[k] = 0; }
for (const k of ['solarPanels', 'running', 'utilityGlow']) { target[k] = 1; cur[k] = 1; }

// camera presets: [label, target, radius, elevation°, azimuth°, cutaways to open]
const VIEWS = [
  ['Aerial', [-3, 0, 2], 235, 38, -32, []],
  ['Top plan', [-3, 0, 2], 250, 86, 0, []],
  ['Plant 1', [PLANT1.x, 8, PLANT1.z], 62, 28, -40, ['plant1Cutaway']],
  ['Plant 2', [PLANT2.x, 8, PLANT2.z], 70, 30, -35, ['plant2Cutaway']],
  ['Warehouses', [-26, 4, 8], 135, 40, -58, ['wh1Cutaway', 'wh2Cutaway']],
  ['QA / QC', [QAQC.x, 7, QAQC.z], 38, 22, 150, ['qaCutaway']],
  ['Blender + FG', [BLENDER.x - 10, 4, BLENDER.z], 105, 32, 40, ['blenderCutaway']],
  ['Tank farms', [FG_FARM.x, 4, 3], 120, 34, -100, []],
  ['Utilities', [BOILER.x - 10, 4, 52], 100, 32, 20, []],
  ['PESO pit', [PESO.x, -1, PESO.z - 4], 85, 40, -20, ['pesoXray']],
];

function applyView(v, camState) {
  const [, tg, radius, elev, azim, open] = v;
  for (const [k] of CUTAWAYS) target[k] = open.includes(k) ? 1 : 0;
  for (const el of document.querySelectorAll('#cutaways input')) el.checked = target[el.dataset.k] > 0.5;
  const el = (elev * Math.PI) / 180, az = (azim * Math.PI) / 180;
  const to = new THREE.Vector3(...tg);
  const pos = to.clone().add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(radius));
  camState.fly = { t: 0, dur: 1.6, fromPos: camState.camera.position.clone(), fromTgt: camState.controls.target.clone(), toPos: pos, toTgt: to };
}

async function boot() {
  const canvas = $('gl');
  const world = createWorld(canvas, tokens);
  const M = createMaterials(tokens);
  const B = new Batcher();
  const site = buildSite(world, M, tokens);
  const plants = buildPlants(world, M, B);
  const finishing = buildFinishing(world, M);
  const tanks = buildTanks(world, M, B, tokens);
  const utilities = buildUtilities(world, M, B);
  const flows = buildFlows(world, M, B, tokens);
  const qaqc = buildQaqc(world, M);
  const warehouses = buildWarehouses(world, M);
  const solar = buildSolar(world, M, siteRoofs({ ...plants.envs, ...warehouses.envs, fuel: utilities.fuelShed }), B);
  const statics = new THREE.Group();
  world.scene.add(statics);
  B.build(statics);

  // ---- camera + controls
  const camera = world.camera;
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.495;   // stay above ground
  controls.minDistance = 6;
  controls.maxDistance = 520;
  controls.screenSpacePanning = false;
  const camState = { camera, controls, fly: null };
  applyView(VIEWS[0], camState);
  camera.position.copy(camState.fly.toPos);
  controls.target.copy(camState.fly.toTgt);
  camState.fly = null;
  controls.update();

  // double-click / double-tap: re-centre the orbit on the surface point under the cursor
  const ray = new THREE.Raycaster();
  canvas.addEventListener('dblclick', (e) => {
    const nd = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(nd, camera);
    const hit = ray.intersectObject(statics, true)[0];
    const p = hit ? hit.point : (() => { const q = new THREE.Vector3(); return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), q) && q; })();
    if (!p) return;
    camState.fly = { t: 0, dur: 1.0, fromPos: camera.position.clone(), fromTgt: controls.target.clone(),
      toPos: camera.position.clone().add(p.clone().sub(controls.target)), toTgt: p.clone() };
  });

  // ---- sizing
  const pr = () => Math.min(window.devicePixelRatio || 1, 2);
  const onResize = () => { world.resize(innerWidth, innerHeight, pr()); shadowDirty = true; };
  let shadowDirty = true;
  onResize();
  addEventListener('resize', onResize);

  // ---- UI
  const mk = (parent, key, label, color) => {
    const l = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.dataset.k = key; cb.checked = target[key] > 0.5;
    cb.addEventListener('change', () => { target[key] = cb.checked ? 1 : 0; shadowDirty = true; });
    l.append(cb);
    if (color) { const d = document.createElement('i'); d.style.background = color; l.append(d); }
    l.append(label);
    parent.append(l);
  };
  VIEWS.forEach((v) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = v[0];
    b.addEventListener('click', () => applyView(v, camState));
    $('views').append(b);
  });
  CUTAWAYS.forEach(([k, l]) => mk($('cutaways'), k, l));
  LAYERS.forEach(([k, l]) => mk($('layers'), k, l));
  FLOWS.forEach(([k, l, c]) => mk($('flows'), k, l, tokens.color.flow[c]));
  let buildT = 1;   // 0..1 greenfield build-up animation
  $('replay').addEventListener('click', () => { buildT = 0; });
  $('collapse').addEventListener('click', () => $('panel').classList.toggle('min'));
  const st = warehouses.storage;
  $('info').textContent = `${(solar.kwp / 1000).toFixed(2)} MWp rooftop solar · ${fmt(solar.count)} × ${MODULE.wp} Wp · storage ${fmt(st.wh1.pallets + st.wh2.pallets)} pallets ≈ ${fmt(Math.round(st.wh1.tonnes + st.wh2.tonnes))} t`;

  // ---- frame loop
  const clock = new THREE.Clock();
  let t = 0, shadowAcc = 0;
  const S = {};
  const frame = () => {
    const dt = Math.min(0.1, clock.getDelta());
    t += dt;
    // ease every state channel toward its target
    let moving = false;
    for (const k of Object.keys(target)) {
      const d = target[k] - cur[k];
      if (Math.abs(d) > 1e-4) { cur[k] += Math.sign(d) * Math.min(Math.abs(d), dt / 0.9); moving = true; } else cur[k] = target[k];
      S[k] = smooth(cur[k]);
    }
    if (buildT < 1) { buildT = Math.min(1, buildT + dt / 7); moving = true; }
    riseUniform.value = buildT;
    const run = S.running;
    Object.assign(S, {
      buildingsRise: smooth(buildT), finishingRun: run, heroReactorHeat: run, heroReactorFill: 0.12 + 0.66 * run,
      tankGradeColors: 1, pesoFill: 0.85,
    });
    finishing.update(t, S);
    utilities.update(t, S);
    flows.update(t, S);
    const changed = [plants.update(t, S), tanks.update(t, S), qaqc.update(t, S.qaCutaway), warehouses.update(t, S)].some(Boolean);
    solar.update(t, S);

    // camera fly-to
    const f = camState.fly;
    if (f) {
      f.t = Math.min(1, f.t + dt / f.dur);
      const k = smooth(f.t);
      camera.position.lerpVectors(f.fromPos, f.toPos, k);
      controls.target.lerpVectors(f.fromTgt, f.toTgt, k);
      if (f.t >= 1) camState.fly = null;
    }
    controls.update();
    const dist = camera.position.distanceTo(controls.target);
    camera.near = Math.min(4, Math.max(0.3, dist / 110));
    camera.updateProjectionMatrix();
    world.scene.fog.density = 0.45 / (dist + 150);

    // shadows are re-rendered when geometry changes and ~10×/s while machinery moves (cranes, agitators)
    shadowAcc += dt;
    if (shadowDirty || changed || moving || shadowAcc > 0.1) { world.renderer.shadowMap.needsUpdate = true; shadowDirty = false; shadowAcc = 0; }
    world.render(t);
    requestAnimationFrame(frame);
  };

  $('status').classList.add('hidden');
  for (const id of ['panel', 'collapse', 'info']) $(id).classList.add('ready');
  window.__model = { solar: { modules: solar.count, kwp: solar.kwp }, storage: warehouses.storage };
  window.__viewer = { world, camera, controls, target, applyView: (i) => applyView(VIEWS[i], camState), VIEWS };
  window.ready = true;
  requestAnimationFrame(frame);
}

boot().catch((e) => {
  window.bootError = String(e && e.stack ? e.stack : e);
  console.error(e);
  $('status').textContent = `Failed to load: ${e && e.message ? e.message : e}`;
});
