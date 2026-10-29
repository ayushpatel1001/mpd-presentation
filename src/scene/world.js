// Renderer, lights, sky/ground and the post-processing chain.
// Scene renders into a linear HDR target with a depth texture, then:
//   bright-pass + blur at 1/4 res (glow on emissive energy lines)
//   composite: depth-of-field gather, bloom, ACES tone map, grade, vignette, grain
//   FXAA to the canvas.
import * as THREE from 'three';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

const FS_VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BRIGHT_FRAG = /* glsl */`
uniform sampler2D tColor; uniform vec2 uTexel; uniform float uThreshold;
varying vec2 vUv;
void main(){
  vec3 c = texture2D(tColor, vUv + uTexel*vec2(-1.0,-1.0)).rgb + texture2D(tColor, vUv + uTexel*vec2(1.0,-1.0)).rgb
         + texture2D(tColor, vUv + uTexel*vec2(-1.0, 1.0)).rgb + texture2D(tColor, vUv + uTexel*vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = max(l - uThreshold, 0.0);
  k = k*k / (k + 0.35);
  gl_FragColor = vec4(c * k / max(l, 1e-4), 1.0);
}`;

const BLUR_FRAG = /* glsl */`
uniform sampler2D tInput; uniform vec2 uDir;
varying vec2 vUv;
void main(){
  vec3 s = texture2D(tInput, vUv).rgb * 0.2270270270;
  s += (texture2D(tInput, vUv + uDir*1.3846153846).rgb + texture2D(tInput, vUv - uDir*1.3846153846).rgb) * 0.3162162162;
  s += (texture2D(tInput, vUv + uDir*3.2307692308).rgb + texture2D(tInput, vUv - uDir*3.2307692308).rgb) * 0.0702702703;
  gl_FragColor = vec4(s, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */`
uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tBloom;
uniform vec2 uRes; uniform float uNear; uniform float uFar; uniform float uFocus; uniform float uAperture;
uniform float uBloom; uniform float uExposure; uniform float uDim; uniform vec3 uDimColor;
uniform float uFade; uniform float uTime; uniform float uVignette;
varying vec2 vUv;

float linZ(vec2 uv){ float d = texture2D(tDepth, uv).x; return uNear*uFar / (uFar - d*(uFar-uNear)); }
float coc(float z){ return clamp(uAperture * 12.5 * abs(z - uFocus) / max(z, 1e-3), 0.0, 11.0); }

vec3 RRTAndODTFit(vec3 v){ vec3 a = v*(v+0.0245786)-0.000090537; vec3 b = v*(0.983729*v+0.4329510)+0.238081; return a/b; }
vec3 aces(vec3 color){
  const mat3 ACESInputMat = mat3(vec3(0.59719,0.07600,0.02840), vec3(0.35458,0.90834,0.13383), vec3(0.04823,0.01566,0.83777));
  const mat3 ACESOutputMat = mat3(vec3(1.60475,-0.10208,-0.00327), vec3(-0.53108,1.10813,-0.07276), vec3(-0.07367,-0.00605,1.07602));
  color *= 1.0/0.6; color = ACESInputMat*color; color = RRTAndODTFit(color); color = ACESOutputMat*color;
  return clamp(color, 0.0, 1.0);
}
vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(vec3(0.0031308), c)); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }

void main(){
  vec3 col = texture2D(tColor, vUv).rgb;
  if (uAperture > 0.01) {
    float cc = coc(linZ(vUv));
    if (cc > 0.75) {
      vec3 acc = col; float wsum = 1.0;
      for (int i = 0; i < 12; i++) {
        float fi = float(i) + 0.5;
        float r = sqrt(fi / 12.0);
        float a = fi * 2.39996323;
        vec2 uv2 = vUv + vec2(cos(a), sin(a)) * r * cc / uRes;
        float cs = coc(linZ(uv2));
        float w = clamp(cs - r*cc + 1.0, 0.0, 1.0);
        acc += texture2D(tColor, uv2).rgb * w; wsum += w;
      }
      col = acc / wsum;
    }
  }
  col += texture2D(tBloom, vUv).rgb * uBloom;
  col = toSRGB(aces(col * uExposure));
  col = mix(col, uDimColor, uDim);
  vec2 q = (vUv - 0.5) * vec2(1.0, 0.72);
  col *= mix(1.0 - uVignette, 1.0, smoothstep(0.78, 0.18, length(q)*1.35));
  col += (hash12(vUv*uRes + fract(uTime)*137.0) - 0.5) * 0.010;
  col *= 1.0 - uFade;
  gl_FragColor = vec4(col, 1.0);
}`;

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const SKY_FRAG = /* glsl */`
uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uGlow;
varying vec3 vDir;
void main(){
  float h = clamp(vDir.y, -0.2, 1.0);
  vec3 c = mix(uHorizon, uTop, smoothstep(0.0, 0.55, h));
  c += uGlow * exp(-abs(h - 0.02) * 22.0) * 0.6;
  gl_FragColor = vec4(c, 1.0);
}`;

function fsPass(frag, uniforms) {
  const mat = new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  return { scene, mat, uniforms };
}

export function createWorld(canvas, tokens, { renderScale = 1600 / 1920 } = {}) {
  const OW = tokens.canvas.width, OH = tokens.canvas.height;
  // the 3D layer renders below output resolution and is upscaled in the FXAA pass; the HUD stays native
  const W = Math.round(OW * renderScale), H = Math.round(OH * renderScale);
  const C = tokens.color.scene;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(OW, OH, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.localClippingEnabled = true;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(new THREE.Color(C.fog), 0.002);

  const camera = new THREE.PerspectiveCamera(34, W / H, 0.5, 4000);

  // sky dome
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(C.skyTop) }, uHorizon: { value: new THREE.Color(C.skyHorizon) }, uGlow: { value: new THREE.Color('#1B5E8C') } },
  }));
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  // lights: cool sky fill, warm key from the south-east, cool rim from the north-west
  scene.add(new THREE.HemisphereLight(0xb4d4f5, 0x26303d, 1.7));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  const sunDir = new THREE.Vector3(0.612, 0.707, 0.354).normalize();
  sun.position.copy(sunDir).multiplyScalar(320);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -135, right: 135, top: 135, bottom: -135, near: 10, far: 700 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.35;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0x7fb4ff, 0.55);
  rim.position.set(-200, 160, -220);
  scene.add(rim);

  // render targets
  const rtScene = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(W, H), minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const rtLdr = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const bw = W / 4, bh = H / 4;
  const rtBloomA = new THREE.WebGLRenderTarget(bw, bh, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const rtBloomB = rtBloomA.clone();

  const bright = fsPass(BRIGHT_FRAG, { tColor: { value: rtScene.texture }, uTexel: { value: new THREE.Vector2(1 / W, 1 / H) }, uThreshold: { value: 0.85 } });
  const blur = fsPass(BLUR_FRAG, { tInput: { value: null }, uDir: { value: new THREE.Vector2() } });
  const comp = fsPass(COMPOSITE_FRAG, {
    tColor: { value: rtScene.texture }, tDepth: { value: rtScene.depthTexture }, tBloom: { value: rtBloomA.texture },
    uRes: { value: new THREE.Vector2(W, H) }, uNear: { value: camera.near }, uFar: { value: camera.far },
    uFocus: { value: 50 }, uAperture: { value: 0 }, uBloom: { value: 0.9 }, uExposure: { value: 1.0 },
    uDim: { value: 0 }, uDimColor: { value: new THREE.Color('#050D18') }, uFade: { value: 0 }, uTime: { value: 0 }, uVignette: { value: 0.32 },
  });
  const fxaa = fsPass(FXAAShader.fragmentShader, THREE.UniformsUtils.clone(FXAAShader.uniforms));
  fxaa.mat.vertexShader = FS_VERT;
  fxaa.uniforms.tDiffuse.value = rtLdr.texture;
  fxaa.uniforms.resolution.value.set(1 / W, 1 / H);
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function render(post) {
    renderer.setRenderTarget(rtScene);
    renderer.render(scene, camera);
    // glow
    renderer.setRenderTarget(rtBloomA);
    renderer.render(bright.scene, fsCam);
    for (const [src, dst, dx, dy] of [[rtBloomA, rtBloomB, 2 / bw, 0], [rtBloomB, rtBloomA, 0, 2 / bh], [rtBloomA, rtBloomB, 4 / bw, 0], [rtBloomB, rtBloomA, 0, 4 / bh]]) {
      blur.uniforms.tInput.value = src.texture;
      blur.uniforms.uDir.value.set(dx, dy);
      renderer.setRenderTarget(dst);
      renderer.render(blur.scene, fsCam);
    }
    const u = comp.uniforms;
    u.uNear.value = camera.near; u.uFar.value = camera.far;
    u.uFocus.value = post.focus; u.uAperture.value = post.aperture; u.uBloom.value = post.bloom ?? 0.9;
    u.uExposure.value = post.exposure ?? 1.0; u.uDim.value = post.dim ?? 0; u.uFade.value = post.fade ?? 0; u.uTime.value = post.time ?? 0;
    renderer.setRenderTarget(rtLdr);
    renderer.render(comp.scene, fsCam);
    renderer.setRenderTarget(null);
    renderer.render(fxaa.scene, fsCam);
  }

  return { renderer, scene, camera, sun, render, W, H };
}
