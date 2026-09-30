// YM3D · stage — shared Three.js foundation for the YOUMAGIC website AND the HyperFrames video.
//
// Contract for every YM3D module:
//   • ES module, NO imports. THREE is always passed in (dependency injection), so the same file
//     works with the site's import map ('three' → vendor/three.module.min.js, r170) and inside
//     HyperFrames sub-compositions (`import * as THREE from './assets/js/three/three.module.min.js'`).
//   • createX(THREE, opts) → { object3d, update(params), dispose() }.
//   • update(params) is a PURE function of params (incl. params.t in seconds): no clocks,
//     no Math.random (use rng(seed)), no internal animation loops. The caller drives time
//     (website: rAF / scroll; video: GSAP timeline onUpdate → tl.time()).
//   • Brand palette below; physically based materials; ACES filmic; sRGB output.

export const BRAND = {
  ink: 0x07070c, violet: 0x8a5cf0, violetDeep: 0x3b1f6e, green: 0x1f7a57, jade: 0x2bae7e,
  mint: 0x43e6a8, cool: 0x7fd4ff, silver: 0xd9dce1, navy: 0x1e222d, gold: 0xc9a45a,
  heat: [0x0b1030, 0x2a1548, 0x6a2a8c, 0xb8307a, 0xf0603f, 0xffc45e, 0xfff4d6],
  lv: { low: 0x3fbf7f, mid: 0xf2a44b, high: 0xe27ab8, max: 0xb0283e },
};

/* ---------- deterministic helpers ---------- */
export function rng(seed = 1) { // mulberry32
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const ease = {
  linear: (t) => clamp(t),
  inOut: (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
  out: (t) => 1 - Math.pow(1 - clamp(t), 3),
  expoOut: (t) => { t = clamp(t); return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); },
  backOut: (t) => { t = clamp(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
/** progress of t inside [a,b] eased */
export const seg = (t, a, b, e = ease.inOut) => e(clamp((t - a) / Math.max(1e-6, b - a)));
export function heatColor(THREE, x, out = new THREE.Color()) {
  const s = BRAND.heat; x = clamp(x) * (s.length - 1);
  const i = Math.min(s.length - 2, Math.floor(x)), f = x - i;
  const a = new THREE.Color(s[i]), b = new THREE.Color(s[i + 1]);
  return out.copy(a).lerp(b, f);
}

/* ---------- procedural studio environment (no files, deterministic) ---------- */
export function studioEnvironment(THREE, renderer, { warm = 0.0, violet = 0.35 } = {}) {
  const env = new THREE.Scene();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x0b0b12, side: THREE.BackSide }));
  box.scale.set(20, 12, 20); env.add(box);
  const panel = (w, h, color, intensity, pos, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos); if (rot) m.rotation.set(...rot); env.add(m); return m;
  };
  panel(8, 3, 0xffffff, 6, [0, 5.8, 0], [Math.PI / 2, 0, 0]);          // big softbox overhead
  panel(3, 6, 0xffffff, 3.2, [-9.8, 1, 0], [0, Math.PI / 2, 0]);       // left strip
  panel(3, 6, new THREE.Color(0xffffff).lerp(new THREE.Color(BRAND.violet), violet).getHex(), 3.0, [9.8, 1, -2], [0, -Math.PI / 2, 0]); // right, violet-tinted
  panel(10, 2, new THREE.Color(0xffffff).lerp(new THREE.Color(0xffd7a8), warm).getHex(), 1.6, [0, 1.5, -9.8]); // back
  panel(6, 1, BRAND.mint, 0.9, [-4, -2, 9.8], [0, Math.PI, 0]);          // low mint kicker
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.035);
  pmrem.dispose();
  env.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
  return rt.texture;
}

/* ---------- radial glow texture (for additive halos / sprites) ---------- */
export function glowTexture(THREE, size = 256, stops = [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

/* ---------- stage: renderer + scene + camera + lights ---------- */
/**
 * createStage(THREE, canvas, { width, height, dpr=1, transparent=false, background=BRAND.ink,
 *   exposure=1.0, fov=32, preserveDrawingBuffer=false, envViolet=0.35 })
 * → { renderer, scene, camera, env, lights, setSize(w,h), render(), dispose(), orbit(params) }
 * orbit({ target:[x,y,z], radius, azimuth, elevation, roll=0, fov? }) places the camera deterministically.
 */
export function createStage(THREE, canvas, opts = {}) {
  const o = { width: 1280, height: 720, dpr: 1, transparent: false, background: BRAND.ink, exposure: 1.0, fov: 32, preserveDrawingBuffer: false, envViolet: 0.35, ...opts };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: o.transparent, preserveDrawingBuffer: o.preserveDrawingBuffer, powerPreference: 'high-performance' });
  renderer.setPixelRatio(o.dpr);
  renderer.setSize(o.width, o.height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = o.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (o.transparent) renderer.setClearColor(0x000000, 0); else renderer.setClearColor(o.background, 1);

  const scene = new THREE.Scene();
  const env = studioEnvironment(THREE, renderer, { violet: o.envViolet });
  scene.environment = env;
  if (!o.transparent) scene.background = new THREE.Color(o.background);

  const camera = new THREE.PerspectiveCamera(o.fov, o.width / o.height, 0.01, 200);
  camera.position.set(0, 1.2, 6);

  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(4, 6, 5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 0.5; key.shadow.camera.far = 30; key.shadow.bias = -0.0004;
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
  const rim = new THREE.DirectionalLight(BRAND.violet, 1.6); rim.position.set(-5, 3, -4);
  const fill = new THREE.HemisphereLight(0xdfe6ff, 0x140c24, 0.35);
  scene.add(key, rim, fill);

  const _t = new THREE.Vector3();
  const stage = {
    renderer, scene, camera, env, lights: { key, rim, fill },
    setSize(w, h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); },
    orbit({ target = [0, 0, 0], radius = 6, azimuth = 0, elevation = 0.2, roll = 0, fov } = {}) {
      if (fov && fov !== camera.fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
      _t.set(...target);
      camera.position.set(_t.x + radius * Math.cos(elevation) * Math.sin(azimuth), _t.y + radius * Math.sin(elevation), _t.z + radius * Math.cos(elevation) * Math.cos(azimuth));
      camera.up.set(Math.sin(roll), Math.cos(roll), 0);
      camera.lookAt(_t);
    },
    render() { renderer.render(scene, camera); },
    dispose() { env.dispose(); renderer.dispose(); },
  };
  return stage;
}
