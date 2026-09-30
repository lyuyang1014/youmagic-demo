// YM3D · dataviz — 3D data / feature objects for the YOUMAGIC website AND the HyperFrames video.
//
// Contract (see README.md): ES module, NO imports, THREE (r170) injected. Every factory is
//   createX(THREE, opts) → { object3d, update(params), dispose(), anchors, ...extras }
// update(params) is a PURE function of params (incl. params.t seconds): no clocks, no Math.random,
// no rAF loops, no allocation. Geometry / materials / textures are built once in createX.
// The tiny helpers below (rng, ease, seg, glow profile, BRAND) mirror stage.mjs 1:1 — they are
// copied rather than imported because the module contract forbids import statements.
//
// Label anchors: every component exposes `anchors` = { name: THREE.Object3D } (children of object3d,
// repositioned inside update). Use projectAnchors(THREE, anchors, camera, w, h) → { name: {x,y,z,visible} }
// in CSS pixels to place DOM labels. In-scene text (axis ticks) uses canvas textures; set
// opts.fontFamily and create components after `document.fonts.ready` for identical output.
//
// Exports
//   createEnergyMatrix3D  IFU energy output table as a 3D bar field (16 levels × 9 pulse times)
//   createPulseTrain3D    one treatment shot: pre-cool block · N×100 ms pulse slabs · post-cool block + temperature ribbons
//   createLoadCurve3D     IFU 图12 load curve as an extruded glowing ribbon in a 3D chart box
//   createDigits3D        extruded, bevelled geometric numerals on 3D drums (rise / slot-machine roll)
//   createShieldRings3D   7 nested glowing rings + shells (multi-layer safety), explode → stacked tower
//   createLock54          holographic "5+4" authentication (5 pentagon nodes + 4 verification rings + scan)
//   createParticleNumber  seeded particles assembling into a number / glyph string
//   createMedallions      4 brushed-metal coins carrying images on their enamel faces
//   createStudioFloor     optional shadow-catching floor disc that fades into the stage background
//   projectAnchors / projectAnchor, glyphOutlines, ENERGY (the lib.js energy model, verbatim rules)
// Full per-component opts / params are documented above each factory.

export const BRAND = {
  ink: 0x07070c, violet: 0x8a5cf0, violetDeep: 0x3b1f6e, green: 0x1f7a57, jade: 0x2bae7e,
  mint: 0x43e6a8, cool: 0x7fd4ff, silver: 0xd9dce1, navy: 0x1e222d, gold: 0xc9a45a,
  heat: [0x0b1030, 0x2a1548, 0x6a2a8c, 0xb8307a, 0xf0603f, 0xffc45e, 0xfff4d6],
  lv: { low: 0x3fbf7f, mid: 0xf2a44b, high: 0xe27ab8, max: 0xb0283e },
};
const FONT = '"Montserrat","PingFang SC","Hiragino Sans GB","Noto Sans SC","Microsoft YaHei",Arial,sans-serif';
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/* ---------- deterministic helpers (mirrors stage.mjs) ---------- */
function rng(seed = 1) { // mulberry32
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const ease = {
  linear: (t) => clamp(t),
  inOut: (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
  out: (t) => 1 - Math.pow(1 - clamp(t), 3),
  expoOut: (t) => { t = clamp(t); return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); },
  backOut: (t) => { t = clamp(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
const backOut = (t, s = 1.2) => { t = clamp(t); const c3 = s + 1; return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
const seg = (t, a, b, e = ease.inOut) => e(clamp((t - a) / Math.max(1e-6, b - a)));
/** update() hardening: copy params into a reused scratch object, turning NaN / ±Infinity numbers into
    undefined so every default applies (a NaN from a timeline tween must never blank a component). */
/** creation-time guard: canvas labels drawn before the web font loads silently fall back → frames differ
    between runs (video!). Warn once so the host awaits document.fonts.load(...) first. */
let _fontWarned = false;
function fontGuard(stack) {
  if (_fontWarned || typeof document === 'undefined' || !document.fonts || !document.fonts.check) return;
  const fam = String(stack).split(',')[0].trim();
  try {
    if (!document.fonts.check(`600 20px ${fam}`)) {
      _fontWarned = true;
      console.warn(`[YM3D dataviz] ${fam} is not loaded yet: in-scene labels will use a fallback font. Await document.fonts.load('600 40px ${fam}') before creating components.`);
    }
  } catch (e) { /* ignore */ }
}
function finiteParams(src, dst) {
  for (const k in dst) dst[k] = undefined;
  if (src) for (const k in src) { const v = src[k]; dst[k] = typeof v === 'number' && !Number.isFinite(v) ? undefined : v; }
  return dst;
}
function heatColor(THREE, x, out = new THREE.Color()) {
  const s = BRAND.heat; x = clamp(x) * (s.length - 1);
  const i = Math.min(s.length - 2, Math.floor(x)), f = x - i;
  return out.setHex(s[i]).lerp(_tmpColor(THREE).setHex(s[i + 1]), f);
}
let _tc = null; const _tmpColor = (THREE) => (_tc || (_tc = new THREE.Color()));

/* ---------- the IFU energy model (identical rules to website/js/lib.js) ---------- */
export const ENERGY = (() => {
  const LEVELS = Array.from({ length: 16 }, (_, i) => (i + 1) * 0.5);
  const PULSES = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5];
  const TIP_AREA = 4.0;
  const levelPower = (lv) => 15 + 20 * lv;
  const r1 = (v) => Math.round(v * 10 + 1e-9) / 10;
  const density = (lv, p) => r1((levelPower(lv) * p) / TIP_AREA);
  const MIN_PULSE = { 0.5: 1.0, 1: 0.9, 1.5: 0.8 };
  const isAllowed = (lv, p) => p + 1e-9 >= (MIN_PULSE[lv] ?? 0.7) && density(lv, p) <= 38.8 + 1e-9;
  const BANDS = [
    { key: 'low', label: '低', min: 6.3, max: 16.3, hex: 0x3fbf7f },
    { key: 'mid', label: '中', min: 16.4, max: 23.8, hex: 0xf2a44b },
    { key: 'high', label: '较高', min: 23.9, max: 31.3, hex: 0xe27ab8 },
    { key: 'max', label: '高', min: 31.4, max: 38.8, hex: 0xb0283e },
  ];
  const bandIndex = (e) => { const i = BANDS.findIndex((b) => e <= b.max + 1e-9); return i < 0 ? 3 : i; };
  return { LEVELS, PULSES, TIP_AREA, MAX: 38.8, levelPower, density, isAllowed, BANDS, bandIndex };
})();

/* ---------- small three helpers ---------- */
const GLSL_OUT = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n';
function fxMat(THREE, uniforms, vertexShader, fragmentShader, extra = {}) {
  return new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, ...extra });
}
/** scale image-based lighting of one material (scene.environmentIntensity overrides envMapIntensity
    when the env comes from scene.environment, so this is done in the shader) */
function envScale(mat, k, key) {
  const prev = mat.onBeforeCompile, kk = k.toFixed(3);
  mat.onBeforeCompile = (s, r) => {
    prev.call(mat, s, r);
    s.fragmentShader = s.fragmentShader.replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
      radiance *= ${kk}; iblIrradiance *= ${kk};
      #ifdef USE_CLEARCOAT
        clearcoatRadiance *= ${kk};
      #endif`);
  };
  const prevKey = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => prevKey() + '|env' + key + kk;
  return mat;
}
function roundRectShape(THREE, w, h, r, cx = 0, cy = 0) {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4);
  const s = new THREE.Shape(), x = cx - w / 2, y = cy - h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, 1.5 * Math.PI, false);
  return s;
}
/** port of BufferGeometryUtils.toCreasedNormals (non-indexed result, smooth below creaseAngle) */
function creased(THREE, geometry, creaseAngle = 35 * DEG) {
  const creaseDot = Math.cos(creaseAngle), hm = 1e4;
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = g.attributes.position;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const key = (v) => `${Math.round(v.x * hm)},${Math.round(v.y * hm)},${Math.round(v.z * hm)}`;
  const map = new Map(), faceN = [];
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    e1.subVectors(c, b); e2.subVectors(a, b);
    const n = new THREE.Vector3().crossVectors(e1, e2).normalize(); faceN.push(n);
    for (const v of [a, b, c]) { const k = key(v); let l = map.get(k); if (!l) map.set(k, (l = [])); l.push(n); }
  }
  const arr = new Float32Array(pos.count * 3), acc = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    const n = faceN[i / 3];
    for (let j = 0; j < 3; j++) {
      a.fromBufferAttribute(pos, i + j); acc.set(0, 0, 0);
      for (const o of map.get(key(a))) if (n.dot(o) > creaseDot) acc.add(o);
      acc.normalize(); arr[(i + j) * 3] = acc.x; arr[(i + j) * 3 + 1] = acc.y; arr[(i + j) * 3 + 2] = acc.z;
    }
  }
  g.setAttribute('normal', new THREE.BufferAttribute(arr, 3));
  return g;
}
/** merge non-indexed geometries (position/normal/uv) */
function mergeGeos(THREE, geos) {
  const list = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const hasUv = list.every((g) => g.attributes.uv);
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = hasUv ? new Float32Array(n * 2) : null;
  let o = 0;
  for (const g of list) {
    if (!g.attributes.normal) g.computeVertexNormals();
    P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3);
    if (U) U.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  if (U) out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  for (const g of geos) g.dispose(); for (const g of list) g.dispose();
  return out;
}
/** rounded box (all edges rounded), centred, w×h×d along x/y/z */
function roundedBoxGeo(THREE, w, h, d, r = 0.02, corner = null, segs = 3) {
  r = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  const cr = corner ?? r;
  const shape = roundRectShape(THREE, w - 2 * r, h - 2 * r, Math.max(1e-4, cr - r * 0.6));
  const g = new THREE.ExtrudeGeometry(shape, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: segs, curveSegments: 6 });
  g.translate(0, 0, -(d - 2 * r) / 2);
  return creased(THREE, g, 40 * DEG);
}
function canvasTexture(THREE, w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}
function disposeTree(root, keep = new Set()) {
  const seen = new Set(keep);
  const tex = (v) => { if (v && v.isTexture && !seen.has(v)) { seen.add(v); v.dispose(); } };
  root.traverse((o) => {
    if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
    const mats = [].concat(o.material || [], o.customDepthMaterial || []);
    for (const m of mats) {
      if (seen.has(m)) continue; seen.add(m);
      for (const k of Object.keys(m)) tex(m[k]);
      if (m.uniforms) for (const k of Object.keys(m.uniforms)) tex(m.uniforms[k].value);
      m.dispose();
    }
    if (o.isInstancedMesh) o.dispose?.();
  });
}
function mkAnchor(THREE, parent, name, anchors) { const o = new THREE.Object3D(); o.name = 'anchor:' + name; parent.add(o); anchors[name] = o; return o; }

/* ---------- additive billboard halos (instanced, one draw call) ---------- */
function createHalos(THREE, count, { sharp = 7.0, soft = 2.2 } = {}) {
  const mat = fxMat(THREE, { uOpacity: { value: 1 } }, /* glsl */`
    varying vec2 vUv; varying vec3 vCol;
    void main(){
      vUv = uv;
      #ifdef USE_INSTANCING_COLOR
        vCol = instanceColor;
      #else
        vCol = vec3(1.0);
      #endif
      vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float s = length(instanceMatrix[0].xyz) * length(modelMatrix[0].xyz);
      c.xy += position.xy * s;
      gl_Position = projectionMatrix * c;
    }`, /* glsl */`
    uniform float uOpacity; varying vec2 vUv; varying vec3 vCol;
    void main(){
      float d = length(vUv - 0.5) * 2.0;
      float a = exp(-d * d * ${sharp.toFixed(2)}) * 0.85 + exp(-d * d * ${soft.toFixed(2)}) * 0.28;
      a *= smoothstep(1.0, 0.72, d);
      gl_FragColor = vec4(vCol * a * uOpacity, 1.0);
      ${GLSL_OUT}
    }`);
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, count);
  mesh.frustumCulled = false; mesh.renderOrder = 20;
  const m4 = new THREE.Matrix4(), col = new THREE.Color(0, 0, 0);
  for (let i = 0; i < count; i++) { m4.makeScale(0, 0, 0); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, col); }
  return {
    mesh,
    set(i, x, y, z, size, color, intensity = 1) {
      if (!(intensity > 1e-4) || !(size > 1e-5)) { m4.makeScale(0, 0, 0); mesh.setMatrixAt(i, m4); return; }
      m4.makeScale(size, size, size); m4.setPosition(x, y, z); mesh.setMatrixAt(i, m4);
      col.copy(color).multiplyScalar(intensity); mesh.setColorAt(i, col);
    },
    hide(i) { m4.makeScale(0, 0, 0); mesh.setMatrixAt(i, m4); },
    commit() { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; },
  };
}
/** point-size scale uniform updater (pixels per world unit at distance 1) */
function pointScaleHook(THREE, mat) {
  const v2 = new THREE.Vector2();
  return (renderer, scene, camera) => { renderer.getDrawingBufferSize(v2); mat.uniforms.uScale.value = v2.y * 0.5 * camera.projectionMatrix.elements[5]; };
}

/* ---------- anchors → screen ---------- */
let _pv = null;
export function projectAnchor(THREE, obj, camera, width, height, out = {}) {
  const v = _pv || (_pv = new THREE.Vector3());
  if (obj.isObject3D) obj.getWorldPosition(v); else v.copy(obj);
  camera.updateMatrixWorld();
  v.project(camera);
  out.x = (v.x * 0.5 + 0.5) * width; out.y = (-v.y * 0.5 + 0.5) * height; out.z = v.z;
  out.visible = v.z > -1 && v.z < 1 && v.x > -1.2 && v.x < 1.2 && v.y > -1.2 && v.y < 1.2 && (obj.userData?.visible ?? true);
  return out;
}
export function projectAnchors(THREE, anchors, camera, width, height) {
  const out = {};
  for (const k of Object.keys(anchors)) out[k] = projectAnchor(THREE, anchors[k], camera, width, height, {});
  return out;
}

/* =====================================================================================
   GLYPHS — a geometric, Montserrat-like numeral set drawn from centre-line strokes.
   Each glyph = strokes (offset to outlines, mitred, split at sharp joins) + filled polys.
   Parts are extruded separately and rendered as a union (overlaps are hidden by depth).
   Unit: cap height 1, baseline y = 0. Supported: 0-9 . - + × % / space
   ===================================================================================== */
const G_W = 0.15;
function arcPts(cx, cy, rx, ry, a0, a1, stepDeg = 3.5) {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / (stepDeg * DEG)));
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
  return pts;
}
function cat(...lists) {
  const out = [];
  for (const l of lists) for (const p of l) { const q = out[out.length - 1]; if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-6) out.push(p); }
  return out;
}
/** angle of the tangent point on circle (c,r) from which a cw (or ccw) traversal heads straight to P */
function tangentAngle(cx, cy, r, px, py, cw) {
  const dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy), phi = Math.atan2(dy, dx), b = Math.acos(clamp(r / d, -1, 1));
  for (const a of [phi + b, phi - b]) {
    const tx = cx + r * Math.cos(a), ty = cy + r * Math.sin(a);
    const ux = cw ? Math.sin(a) : -Math.sin(a), uy = cw ? -Math.cos(a) : Math.cos(a);
    if ((px - tx) * ux + (py - ty) * uy > 0) return a;
  }
  return phi;
}
const GLYPH_DEFS = (() => {
  const hw = G_W / 2;
  const S = (pts, o = {}) => ({ type: 'stroke', pts, w: o.w ?? G_W, closed: !!o.closed, cap0: o.cap0 || null, cap1: o.cap1 || null });
  const ring = (cx, cy, rx, ry, w = G_W) => S(arcPts(cx, cy, rx, ry, 0, TAU, 3).slice(0, -1), { closed: true, w });
  const flip = (parts) => parts.map((p) => ({ ...p, pts: p.pts.map(([x, y]) => [0.62 - x, 1 - y]) }));
  const d = {};
  d['0'] = { adv: 0.68, cx: 0.31, parts: [ring(0.31, 0.5, 0.31 - hw, 0.5 - hw)] };
  d['1'] = { adv: 0.68, cx: 0.31, parts: [S([[0.41, 0], [0.41, 1]]), S([[0.41, 0.925], [0.155, 0.772]])] };
  {
    const cx = 0.30, cy = 0.695, r = 0.23, C = [0.09, hw];
    const aE = tangentAngle(cx, cy, r, C[0], C[1], true);
    d['2'] = { adv: 0.68, cx: 0.31, parts: [S(cat(arcPts(cx, cy, r, r, 160 * DEG, aE), [C, [0.60, hw]]))] };
  }
  {
    const cx = 0.305, cy = 0.32, r = 0.245, a0 = 100 * DEG;
    const Sp = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
    d['3'] = { adv: 0.68, cx: 0.31, parts: [S(cat([[0.07, 1 - hw], [0.545, 1 - hw], Sp], arcPts(cx, cy, r, r, a0, -150 * DEG)))] };
  }
  d['4'] = { adv: 0.68, cx: 0.31, parts: [S([[0.45, 0], [0.45, 0.96], [0.07, 0.30], [0.40, 0.30]]), S([[0.40, 0.30], [0.60, 0.30]])] };
  {
    const cx = 0.30, cy = 0.33, r = 0.255, a0 = 125 * DEG;
    const Sp = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
    d['5'] = { adv: 0.68, cx: 0.31, parts: [S(cat([[0.555, 1 - hw], [0.14, 1 - hw], Sp], arcPts(cx, cy, r, r, a0, -145 * DEG)))] };
  }
  {
    const cx = 0.31, cy = 0.315, r = 0.24, P = [0.47, 1.0];
    const aT = tangentAngle(cx, cy, r, P[0], P[1], true);
    const T = [cx + r * Math.cos(aT), cy + r * Math.sin(aT)];
    d['6'] = { adv: 0.68, cx: 0.31, parts: [ring(cx, cy, r, r), S([T, P], { cap1: 'h' })] };
    d['9'] = { adv: 0.68, cx: 0.31, parts: flip(d['6'].parts) };
  }
  d['7'] = { adv: 0.68, cx: 0.31, parts: [S([[0.06, 1 - hw], [0.565, 1 - hw], [0.2, 0]], { cap1: 'h' })] };
  d['8'] = { adv: 0.68, cx: 0.31, parts: [ring(0.31, 0.735, 0.19, 0.19), ring(0.31, 0.29, 0.215, 0.215)] };
  d['.'] = { adv: 0.30, cx: 0.15, parts: [{ type: 'poly', pts: arcPts(0.15, 0.092, 0.092, 0.092, 0, TAU, 6).slice(0, -1) }] };
  d['-'] = { adv: 0.48, cx: 0.24, parts: [S([[0.07, 0.40], [0.41, 0.40]])] };
  d['+'] = { adv: 0.62, cx: 0.31, parts: [S([[0.07, 0.43], [0.55, 0.43]]), S([[0.31, 0.19], [0.31, 0.67]])] };
  d['×'] = { adv: 0.60, cx: 0.30, parts: [S([[0.12, 0.25], [0.48, 0.61]], { w: 0.12 }), S([[0.12, 0.61], [0.48, 0.25]], { w: 0.12 })] };
  d['%'] = { adv: 0.88, cx: 0.41, parts: [ring(0.19, 0.785, 0.135, 0.135, 0.11), ring(0.63, 0.215, 0.135, 0.135, 0.11), S([[0.67, 1.0], [0.15, 0.0]], { w: 0.11, cap0: 'h', cap1: 'h' })] };
  d['/'] = { adv: 0.48, cx: 0.24, parts: [S([[0.41, 1.0], [0.07, 0.0]], { cap0: 'h', cap1: 'h' })] };
  d[' '] = { adv: 0.30, cx: 0.15, parts: [] };
  d['x'] = d['×']; d['*'] = d['×'];
  return d;
})();
const polyArea = (p) => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return a / 2; };
function splitSharp(pts, limit) {
  const out = []; let cur = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    cur.push(pts[i]);
    if (i < pts.length - 1) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      let d1x = b[0] - a[0], d1y = b[1] - a[1], d2x = c[0] - b[0], d2y = c[1] - b[1];
      const l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y); d1x /= l1; d1y /= l1; d2x /= l2; d2y /= l2;
      const interior = Math.acos(clamp(-(d1x * d2x + d1y * d2y), -1, 1));
      if (1 / Math.max(1e-6, Math.sin(interior / 2)) > limit) { out.push(cur); cur = [b]; }
    }
  }
  out.push(cur);
  return out;
}
function offsetPolyline(pts, hw, closed) {
  const n = pts.length, L = [], R = [];
  const dirAt = (i) => { const a = pts[i], b = pts[(i + 1) % n]; const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
  const segs = closed ? n : n - 1, D = []; for (let i = 0; i < segs; i++) D.push(dirAt(i));
  for (let i = 0; i < n; i++) {
    const dp = closed ? D[(i - 1 + n) % n] : D[Math.max(0, i - 1)], dn = closed ? D[i] : D[Math.min(segs - 1, i)];
    const np = [-dp[1], dp[0]], nn = [-dn[1], dn[0]];
    let mx = np[0] + nn[0], my = np[1] + nn[1]; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
    const k = hw / Math.max(0.2, mx * nn[0] + my * nn[1]);
    const p = pts[i]; L.push([p[0] + mx * k, p[1] + my * k]); R.push([p[0] - mx * k, p[1] - my * k]);
  }
  return { L, R, D };
}
function capCut(P, p, d, mode) { // slide P along d until it meets the horizontal / vertical line through p
  if (mode === 'h' && Math.abs(d[1]) > 1e-4) { const s = (p[1] - P[1]) / d[1]; return [P[0] + d[0] * s, p[1]]; }
  if (mode === 'v' && Math.abs(d[0]) > 1e-4) { const s = (p[0] - P[0]) / d[0]; return [p[0], P[1] + d[1] * s]; }
  return P;
}
/** glyph parts → list of { outer:[[x,y]], holes:[[[x,y]]] } polygons (unit cap height, glyph box coords) */
function glyphPolys(ch) {
  const def = GLYPH_DEFS[ch] || GLYPH_DEFS[' '];
  const polys = [];
  for (const part of def.parts) {
    if (part.type === 'poly') { polys.push({ outer: part.pts, holes: [] }); continue; }
    const hw = part.w / 2;
    if (part.closed) {
      const { L, R } = offsetPolyline(part.pts, hw, true);
      const aL = Math.abs(polyArea(L)), aR = Math.abs(polyArea(R));
      polys.push(aL > aR ? { outer: L, holes: [R] } : { outer: R, holes: [L] });
      continue;
    }
    const subs = splitSharp(part.pts, 2.45);
    subs.forEach((sp, si) => {
      const { L, R, D } = offsetPolyline(sp, hw, false);
      const c0 = si === 0 ? part.cap0 : null, c1 = si === subs.length - 1 ? part.cap1 : null;
      if (c0) { L[0] = capCut(L[0], sp[0], D[0], c0); R[0] = capCut(R[0], sp[0], D[0], c0); }
      const e = sp.length - 1, de = D[D.length - 1];
      if (c1) { L[e] = capCut(L[e], sp[e], de, c1); R[e] = capCut(R[e], sp[e], de, c1); }
      polys.push({ outer: L.concat(R.slice().reverse()), holes: [] });
    });
  }
  return { adv: def.adv, cx: def.cx, polys };
}
/** public: outlines of a string laid out left→right (unit cap height), for 2D/particle use */
export function glyphOutlines(text, { tracking = 0.04 } = {}) {
  const out = []; let x = 0;
  for (const ch of String(text)) {
    const g = glyphPolys(ch);
    const dx = x + g.adv / 2 - g.cx;
    for (const p of g.polys) out.push({ outer: p.outer.map(([a, b]) => [a + dx, b]), holes: p.holes.map((h) => h.map(([a, b]) => [a + dx, b])) });
    x += g.adv + tracking;
  }
  return { polys: out, width: Math.max(0, x - tracking) };
}
/** extruded, bevelled glyph geometry centred on (0, 0.5·size, 0) → returned centred at origin */
function glyphGeometry(THREE, ch, { size = 1, depth = 0.2, bevel = 0.022 } = {}) {
  const g = glyphPolys(ch);
  if (!g.polys.length) return null;
  const bt = bevel * 1.25, bs = bevel;
  const parts = g.polys.map(({ outer, holes }) => {
    const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    const eg = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, depth - 2 * bt), bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelOffset: -bs, bevelSegments: 4, curveSegments: 4 });
    eg.translate(-g.cx, -0.5, -(depth - 2 * bt) / 2);
    return eg;
  });
  const merged = creased(THREE, mergeGeos(THREE, parts), 38 * DEG);
  merged.scale(size, size, size);
  merged.computeBoundingSphere(); merged.computeBoundingBox();
  return merged;
}
function pointInPoly(x, y, p) {
  let ins = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

/* =====================================================================================
   createStudioFloor(THREE, { radius=9, y=0, color=0x15151c, fade=0.62 })
   → { object3d, update({ y }), dispose() }  — dark matte (Lambert) disc catching shadows, edges fade into the background.
   ===================================================================================== */
export function createStudioFloor(THREE, opts = {}) {
  const o = { radius: 9, y: 0, color: 0x15151c, fade: 0.62, ...opts };
  const alpha = canvasTexture(THREE, 512, 512, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, '#fff'); gr.addColorStop(1 - o.fade, '#fff'); gr.addColorStop(1, '#000');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  alpha.colorSpace = THREE.NoColorSpace;
  const mat = new THREE.MeshLambertMaterial({ color: o.color, alphaMap: alpha, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(o.radius, 96), mat);
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = o.y; mesh.receiveShadow = true; mesh.renderOrder = -1;
  return { object3d: mesh, anchors: {}, update({ y } = {}) { if (y !== undefined) mesh.position.y = y; }, dispose() { disposeTree(mesh); } };
}

/* =====================================================================================
   1 · createEnergyMatrix3D(THREE, opts) — the IFU energy output table as a 3D bar field.
   x = 功率档位 0.5 … 8 (left → right), z = 脉冲时间 0.7 s (front) … 1.5 s (back),
   bar height ∝ energy density J/cm² = (15+20·lv)·t/4 (rounded 0.1), colour = IFU band.
   Blank (restricted) cells = hatched glass stubs. Recommended zone (中/较高) = mint outline + light fence.
   opts:
     pitch=0.225      cell spacing (world units)          bar=0.172   bar footprint
     maxHeight=1.45   bar height of 38.8 J/cm² (linear)   labels=true engraved ticks on plate + J/cm² back wall
     values=true      build per-bar value decals            fontFamily  canvas font stack
   update(params):
     reveal=1         0..1 bars rise in a diagonal wave from the (0.5 · 0.7 s) corner (exact heights at 1)
     locks            0..1 restricted stubs drop in (default: follows reveal, after the bars)
     highlight=null   {lv, p}: focus a cell — crosshair strips, beacon ring, anchor 'highlight'
     pulseHighlight=0 0..1 breathing amplitude of the highlight glow (driven by t)
     focus            0..1 dim non-focused cells (default 0.75 with band, 0.55 with highlight, else 0)
     band=null        'low'|'mid'|'high'|'max'|0..3 — emphasise one IFU band
     zone=1           0..1 recommended-zone (中/较高) outline + fence + floor tint
     values=0         0..1 density numbers printed on bar tops
     labels=1         0..1 plate / wall text opacity
     glow=1           bar self-illumination multiplier
     t=0              seconds (fence shimmer, highlight breathing)
   extras: cells[{i,j,lv,p,density,band,bandKey,allowed}], cellTop(lv,p,target?) → local Vector3,
           view (suggested stage.orbit params)
   anchors: highlight, max, zone, locked, axisLevel, axisPulse, axisEnergy, origin
   ===================================================================================== */
export function createEnergyMatrix3D(THREE, opts = {}) {
  const o = { pitch: 0.225, bar: 0.172, maxHeight: 1.45, labels: true, values: true, fontFamily: FONT, ...opts };
  if (o.labels) fontGuard(o.fontFamily);
  const { LEVELS, PULSES, density, isAllowed, BANDS, bandIndex, MAX } = ENERGY;
  const NX = LEVELS.length, NZ = PULSES.length, P = o.pitch;
  const W = NX * P, D = NZ * P;
  const cx = (i) => (i - (NX - 1) / 2) * P;
  const cz = (j) => (j - (NZ - 1) / 2) * P; // 0.7 s at the back, 1.5 s at the front
  const hOf = (e) => (o.maxHeight * e) / MAX;
  const root = new THREE.Group(); root.name = 'EnergyMatrix3D';
  const anchors = {};
  const bandCol = BANDS.map((b) => new THREE.Color(b.hex));

  const cells = [];
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
    const lv = LEVELS[i], p = PULSES[j], e = density(lv, p), allowed = isAllowed(lv, p);
    const band = allowed ? bandIndex(e) : -1;
    cells.push({ i, j, lv, p, density: e, allowed, band, bandKey: allowed ? BANDS[band].key : null });
  }
  const cellAt = (i, j) => cells[i * NZ + j];
  const allowed = cells.filter((c) => c.allowed), locked = cells.filter((c) => !c.allowed);
  allowed.forEach((c, k) => (c.k = k)); locked.forEach((c, k) => (c.k = k));
  const inZone = (c) => c.allowed && (c.band === 1 || c.band === 2);

  /* ---- plate ---- */
  const mL = 0.66, mR = 0.2, mF = 0.52, mB = 0.2;
  const plateW = W + mL + mR, plateD = D + mB + mF, pcx = (mR - mL) / 2, pcz = (mF - mB) / 2, T = 0.1;
  const plateGeo = roundedBoxGeo(THREE, plateW, plateD, T, 0.03, 0.12); plateGeo.rotateX(-Math.PI / 2); plateGeo.translate(pcx, -T / 2, pcz);
  const plate = new THREE.Mesh(plateGeo, envScale(new THREE.MeshPhysicalMaterial({ color: 0x0f0f17, metalness: 0.5, roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.14 }), 0.22, 'plate'));
  plate.receiveShadow = true; root.add(plate);
  // violet under-glow edge
  const edgeGeo = roundedBoxGeo(THREE, plateW + 0.012, plateD + 0.012, 0.012, 0.005, 0.125); edgeGeo.rotateX(-Math.PI / 2); edgeGeo.translate(pcx, -T + 0.004, pcz);
  const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(BRAND.violet).multiplyScalar(1.4), toneMapped: false });
  root.add(new THREE.Mesh(edgeGeo, edgeMat));

  const ppu = 400, cw = Math.round(plateW * ppu), ch = Math.round(plateD * ppu);
  const X = (x) => (x - (pcx - plateW / 2)) * ppu, Z = (z) => (z - (pcz - plateD / 2)) * ppu;
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const plateTex = canvasTexture(THREE, cw, ch, (g) => {
    g.clearRect(0, 0, cw, ch);
    const s = (o.bar + 0.026) * ppu;
    for (const c of cells) {
      const x = X(cx(c.i)) - s / 2, y = Z(cz(c.j)) - s / 2;
      rr(g, x, y, s, s, 0.035 * ppu);
      g.fillStyle = c.allowed ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.015)'; g.fill();
      g.lineWidth = 2; g.strokeStyle = 'rgba(190,200,255,0.13)'; g.stroke();
    }
    if (!o.labels) return;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `600 ${0.075 * ppu}px ${o.fontFamily}`; g.fillStyle = 'rgba(236,238,250,0.92)';
    LEVELS.forEach((lv, i) => g.fillText(lv.toFixed(1), X(cx(i)), Z(D / 2 + 0.15)));
    g.strokeStyle = 'rgba(236,238,250,0.35)'; g.lineWidth = 2;
    LEVELS.forEach((lv, i) => { g.beginPath(); g.moveTo(X(cx(i)), Z(D / 2 + 0.035)); g.lineTo(X(cx(i)), Z(D / 2 + 0.085)); g.stroke(); });
    g.font = `600 ${0.088 * ppu}px ${o.fontFamily}`; g.fillStyle = 'rgba(222,226,246,0.86)'; // axis titles ≥ tick size
    g.fillText('功率档位  POWER LEVEL', X(0), Z(D / 2 + 0.36));
    g.textAlign = 'right'; g.font = `600 ${0.075 * ppu}px ${o.fontFamily}`; g.fillStyle = 'rgba(236,238,250,0.92)';
    PULSES.forEach((p, j) => g.fillText(p.toFixed(1) + ' s', X(-W / 2 - 0.07), Z(cz(j))));
    g.save(); g.translate(X(-W / 2 - 0.52), Z(0)); g.rotate(Math.PI / 2); g.textAlign = 'center';
    g.font = `600 ${0.088 * ppu}px ${o.fontFamily}`; g.fillStyle = 'rgba(222,226,246,0.86)'; g.fillText('脉冲时间  PULSE', 0, 0); g.restore();
  });
  const overlayMat = new THREE.MeshBasicMaterial({ map: plateTex, transparent: true, depthWrite: false, toneMapped: false });
  const overlayGeo = new THREE.PlaneGeometry(plateW, plateD); overlayGeo.rotateX(-Math.PI / 2); overlayGeo.translate(pcx, 0.002, pcz);
  const overlay = new THREE.Mesh(overlayGeo, overlayMat); overlay.renderOrder = 1; root.add(overlay);

  /* ---- back wall with J/cm² reference lines ---- */
  const wallW = W + 0.1, wallH = o.maxHeight + 0.24, wz = -D / 2 - mB + 0.02, wppu = 360;
  const wallTex = canvasTexture(THREE, Math.round((wallW + 0.7) * wppu), Math.round(wallH * wppu), (g, w, h) => {
    const x0 = 0.7 * wppu, Y = (e) => h - hOf(e) * wppu;
    const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(138,92,240,0.10)'); gr.addColorStop(1, 'rgba(138,92,240,0.0)');
    g.fillStyle = gr; g.fillRect(x0, 0, w - x0, h);
    if (!o.labels) return;
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (const e of [10, 20, 30]) {
      g.strokeStyle = 'rgba(210,214,240,0.22)'; g.lineWidth = 2; g.setLineDash([]);
      g.beginPath(); g.moveTo(x0, Y(e)); g.lineTo(w, Y(e)); g.stroke();
      g.font = `600 ${0.07 * wppu}px ${o.fontFamily}`; g.fillStyle = 'rgba(230,232,248,0.85)'; g.fillText(String(e), x0 - 0.05 * wppu, Y(e));
    }
    g.strokeStyle = 'rgba(226,122,184,0.75)'; g.lineWidth = 3; g.setLineDash([14, 10]);
    g.beginPath(); g.moveTo(x0, Y(MAX)); g.lineTo(w, Y(MAX)); g.stroke(); g.setLineDash([]);
    g.font = `700 ${0.07 * wppu}px ${o.fontFamily}`; g.fillStyle = 'rgba(255,190,225,0.95)'; g.fillText('38.8', x0 - 0.05 * wppu, Y(MAX));
    g.textAlign = 'left'; g.font = `500 ${0.062 * wppu}px ${o.fontFamily}`; g.fillStyle = 'rgba(210,214,240,0.75)';
    g.fillText('能量密度 J/cm²', x0 + 0.04 * wppu, 0.07 * wppu);
  });
  const wallMat = new THREE.MeshBasicMaterial({ map: wallTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const wallGeo = new THREE.PlaneGeometry(wallW + 0.7, wallH); wallGeo.translate(-0.35, wallH / 2, wz);
  const wall = new THREE.Mesh(wallGeo, wallMat); wall.renderOrder = 2; root.add(wall);

  /* ---- bars (one InstancedMesh; height via per-instance attribute keeps bevels crisp) ---- */
  const barGeo = roundedBoxGeo(THREE, o.bar, o.bar, 1, 0.022, 0.04); barGeo.rotateX(-Math.PI / 2); barGeo.translate(0, 0.5, 0);
  const NA = allowed.length;
  const aH = new THREE.InstancedBufferAttribute(new Float32Array(NA), 1); aH.setUsage(THREE.DynamicDrawUsage);
  const aGlow = new THREE.InstancedBufferAttribute(new Float32Array(NA), 1); aGlow.setUsage(THREE.DynamicDrawUsage);
  barGeo.setAttribute('aH', aH); barGeo.setAttribute('aGlow', aGlow);
  const U = { uGlow: { value: 1 } };
  const stretchGLSL = `
    float hh = max(aH, 0.08);
    transformed.y += step(0.5, transformed.y) * (hh - 1.0);
    transformed.y *= clamp(aH / 0.08, 0.0, 1.0);`;
  const barMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.26, metalness: 0.04, clearcoat: 1, clearcoatRoughness: 0.07 });
  barMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aH; attribute float aGlow; varying float vHy; varying float vGl;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${stretchGLSL}\n vHy = transformed.y / hh; vGl = aGlow;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uGlow; varying float vHy; varying float vGl;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        vec3 vd = normalize(vViewPosition);
        float fr = pow(1.0 - clamp(abs(dot(normal, vd)), 0.0, 1.0), 2.4);
        float gy = clamp(vHy, 0.0, 1.0);
        float g = uGlow * (1.0 + vGl);
        totalEmissiveRadiance += vColor * g * (0.07 + 0.5 * pow(gy, 2.2) + 0.32 * fr);
        totalEmissiveRadiance += vColor * vGl * 0.35;
      }`);
  };
  barMat.customProgramCacheKey = () => 'ym3d-matrix-bar';
  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depthMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aH;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${stretchGLSL}`);
  };
  depthMat.customProgramCacheKey = () => 'ym3d-matrix-bar-depth';
  const bars = new THREE.InstancedMesh(barGeo, barMat, NA);
  bars.customDepthMaterial = depthMat; bars.castShadow = true; bars.receiveShadow = true; bars.frustumCulled = false;
  const m4 = new THREE.Matrix4(), col = new THREE.Color(), v3 = new THREE.Vector3();
  allowed.forEach((c, k) => { m4.makeTranslation(cx(c.i), -0.02, cz(c.j)); bars.setMatrixAt(k, m4); bars.setColorAt(k, bandCol[c.band]); });
  root.add(bars);

  /* ---- restricted cells: hatched glass stubs ---- */
  const stubGeo = roundedBoxGeo(THREE, o.bar, o.bar, 0.055, 0.014, 0.04); stubGeo.rotateX(-Math.PI / 2); stubGeo.translate(0, 0.0275, 0);
  const SU = { uLock: { value: 1 }, uHatch: { value: new THREE.Color(0xff8fb6) } };
  const stubMat = new THREE.MeshPhysicalMaterial({ color: 0xc4c8de, roughness: 0.18, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.1, transparent: true, depthWrite: false });
  stubMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, SU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vHatch;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vHatch = (instanceMatrix * vec4(transformed, 1.0)).xz;
        #else
          vHatch = transformed.xz;
        #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uLock; uniform vec3 uHatch; varying vec2 vHatch;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        float s = fract((vHatch.x - vHatch.y) * 26.0);
        float ln = smoothstep(0.0, 0.1, s) * (1.0 - smoothstep(0.34, 0.46, s));
        diffuseColor.a *= uLock * mix(0.22, 0.85, ln);
        totalEmissiveRadiance += uHatch * vColor * ln * 0.42 * uLock;
      }`);
  };
  stubMat.customProgramCacheKey = () => 'ym3d-matrix-stub';
  const stubs = new THREE.InstancedMesh(stubGeo, stubMat, locked.length);
  stubs.frustumCulled = false; stubs.renderOrder = 3;
  locked.forEach((c, k) => { m4.makeTranslation(cx(c.i), 0, cz(c.j)); stubs.setMatrixAt(k, m4); stubs.setColorAt(k, col.setRGB(1, 1, 1)); });
  root.add(stubs);

  /* ---- recommended zone: tint, outline strips, light fence ---- */
  const zone = new THREE.Group(); root.add(zone);
  const zoneTex = canvasTexture(THREE, cw, ch, (g) => {
    const s = P * ppu;
    g.fillStyle = 'rgba(67,230,168,0.20)';
    for (const c of cells) if (inZone(c)) g.fillRect(X(cx(c.i)) - s / 2 - 0.5, Z(cz(c.j)) - s / 2 - 0.5, s + 1, s + 1);
  });
  const zoneTint = new THREE.Mesh(overlayGeo.clone(), new THREE.MeshBasicMaterial({ map: zoneTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  zoneTint.position.y = 0.003; zoneTint.renderOrder = 1; zone.add(zoneTint);
  const stripParts = [], fenceParts = [], FH = 0.34;
  for (const c of cells) {
    if (!inZone(c)) continue;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = c.i + di, nj = c.j + dj, alongZ = di !== 0;
      const x = cx(c.i) + (di * P) / 2, z = cz(c.j) + ((cz(c.j + 1) - cz(c.j)) * dj) / 2;
      const n = ni >= 0 && ni < NX && nj >= 0 && nj < NZ ? cellAt(ni, nj) : null;
      if (n && inZone(n)) continue;
      const b = new THREE.BoxGeometry(alongZ ? 0.018 : P + 0.018, 0.014, alongZ ? P + 0.018 : 0.018); b.translate(x, 0.008, z); stripParts.push(b);
      const f = new THREE.PlaneGeometry(P, FH); if (alongZ) f.rotateY(Math.PI / 2); f.translate(x, FH / 2, z); fenceParts.push(f);
    }
  }
  const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(BRAND.mint).multiplyScalar(1.3), transparent: true, toneMapped: false });
  zone.add(new THREE.Mesh(mergeGeos(THREE, stripParts), stripMat));
  const fenceU = { uCol: { value: new THREE.Color(BRAND.mint) }, uOpacity: { value: 1 }, uTime: { value: 0 } };
  const fenceMat = fxMat(THREE, fenceU, `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`, `
    uniform vec3 uCol; uniform float uOpacity; uniform float uTime; varying vec2 vUv;
    void main(){
      float a = pow(1.0 - vUv.y, 2.0) * 0.6;
      a += smoothstep(0.93, 1.0, fract(vUv.y * 3.0 - uTime * 0.45)) * (1.0 - vUv.y) * 0.22;
      gl_FragColor = vec4(uCol * a * uOpacity, 1.0);
      ${GLSL_OUT}
    }`);
  const fence = new THREE.Mesh(mergeGeos(THREE, fenceParts), fenceMat); fence.renderOrder = 5; zone.add(fence);

  /* ---- highlight: crosshair strips, beacon, ring, halos ---- */
  const hlGroup = new THREE.Group(); root.add(hlGroup);
  const stripU = (axis) => ({ uCol: { value: new THREE.Color(0xcfc4ff) }, uOpacity: { value: 0 }, uAxis: { value: axis } });
  const stripShader = [`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`, `
    uniform vec3 uCol; uniform float uOpacity; uniform float uAxis; varying vec2 vUv;
    void main(){
      float across = uAxis < 0.5 ? vUv.y : vUv.x, along = uAxis < 0.5 ? vUv.x : vUv.y;
      // thin laser line + faint soft skirt (a full-cell-wide band lit the glass stubs like random white tiles)
      float d = abs(across - 0.5);
      float a = (1.0 - smoothstep(0.0, 0.07, d)) * 0.9 + (1.0 - smoothstep(0.0, 0.5, d)) * 0.12;
      a *= smoothstep(0.0, 0.12, along) * smoothstep(1.0, 0.88, along);
      gl_FragColor = vec4(uCol * a * uOpacity * 0.5, 1.0);
      ${GLSL_OUT}
    }`];
  const rowU = stripU(0), colU = stripU(1);
  const rowGeo = new THREE.PlaneGeometry(W + 0.2, P); rowGeo.rotateX(-Math.PI / 2);
  const colGeo = new THREE.PlaneGeometry(P, D + 0.2); colGeo.rotateX(-Math.PI / 2);
  const rowStrip = new THREE.Mesh(rowGeo, fxMat(THREE, rowU, ...stripShader)); rowStrip.position.y = 0.003; rowStrip.renderOrder = 4;
  const colStrip = new THREE.Mesh(colGeo, fxMat(THREE, colU, ...stripShader)); colStrip.position.y = 0.003; colStrip.renderOrder = 4;
  hlGroup.add(rowStrip, colStrip);
  const beamU = { uCol: { value: new THREE.Color(1, 1, 1) }, uOpacity: { value: 0 } };
  const beamGeo = new THREE.CylinderGeometry(0.005, 0.005, 1, 8, 1, true); beamGeo.translate(0, 0.5, 0);
  const beam = new THREE.Mesh(beamGeo, fxMat(THREE, beamU, `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    `uniform vec3 uCol; uniform float uOpacity; varying vec2 vUv; void main(){ float a = pow(1.0 - vUv.y, 1.6); gl_FragColor = vec4(uCol * a * uOpacity, 1.0); ${GLSL_OUT} }`));
  beam.renderOrder = 6; hlGroup.add(beam);
  const ringGeo = new THREE.TorusGeometry(0.15, 0.0065, 8, 72); ringGeo.rotateX(Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, toneMapped: false, depthWrite: false });
  const ring = new THREE.Mesh(ringGeo, ringMat); ring.renderOrder = 6; hlGroup.add(ring);
  const halos = createHalos(THREE, 2); root.add(halos.mesh);

  /* ---- per-bar value decals ---- */
  let decals = null, decalAlpha = null;
  if (o.values) {
    const AC = 16, AR = Math.ceil(NA / AC);
    const atlas = canvasTexture(THREE, AC * 128, AR * 64, (g) => {
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 40px ${o.fontFamily}`; g.lineJoin = 'round';
      allowed.forEach((c, k) => {
        const x = (k % AC) * 128 + 64, y = Math.floor(k / AC) * 64 + 33, s = c.density.toFixed(1);
        g.lineWidth = 7; g.strokeStyle = 'rgba(8,8,14,0.72)'; g.strokeText(s, x, y);
        g.fillStyle = '#ffffff'; g.fillText(s, x, y);
      });
    });
    const dGeo = new THREE.PlaneGeometry(o.bar * 0.94, o.bar * 0.47); dGeo.rotateX(-Math.PI / 2);
    const aCell = new Float32Array(NA * 2); allowed.forEach((c, k) => { aCell[k * 2] = (k % AC) / AC; aCell[k * 2 + 1] = 1 - (Math.floor(k / AC) + 1) / AR; });
    dGeo.setAttribute('aCell', new THREE.InstancedBufferAttribute(aCell, 2));
    decalAlpha = new THREE.InstancedBufferAttribute(new Float32Array(NA), 1); decalAlpha.setUsage(THREE.DynamicDrawUsage);
    dGeo.setAttribute('aAlpha', decalAlpha);
    const dMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: atlas }, uCell: { value: new THREE.Vector2(1 / AC, 1 / AR) } },
      vertexShader: `attribute vec2 aCell; attribute float aAlpha; uniform vec2 uCell; varying vec2 vUv; varying float vA;
        void main(){ vUv = aCell + uv * uCell; vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D uMap; varying vec2 vUv; varying float vA;
        void main(){ vec4 c = texture2D(uMap, vUv); gl_FragColor = vec4(c.rgb, c.a * vA); if (gl_FragColor.a < 0.004) discard; ${GLSL_OUT} }`,
      transparent: true, depthWrite: false, toneMapped: false,
    });
    decals = new THREE.InstancedMesh(dGeo, dMat, NA); decals.frustumCulled = false; decals.renderOrder = 7; root.add(decals);
  }

  /* ---- anchors ---- */
  for (const n of ['highlight', 'max', 'zone', 'locked', 'axisLevel', 'axisPulse', 'axisEnergy', 'origin']) mkAnchor(THREE, root, n, anchors);
  const cMax = allowed.find((c) => c.density === MAX);
  anchors.max.position.set(cx(cMax.i), hOf(MAX) + 0.1, cz(cMax.j));
  const zc = cells.filter(inZone); anchors.zone.position.set(zc.reduce((s, c) => s + cx(c.i), 0) / zc.length, hOf(24) + 0.3, zc.reduce((s, c) => s + cz(c.j), 0) / zc.length);
  const lk = locked.filter((c) => c.lv > 2); anchors.locked.position.set(lk.reduce((s, c) => s + cx(c.i), 0) / lk.length, 0.12, lk.reduce((s, c) => s + cz(c.j), 0) / lk.length);
  anchors.axisLevel.position.set(0, 0, D / 2 + 0.36); // front edge anchors.axisPulse.position.set(-W / 2 - 0.52, 0, 0);
  anchors.axisEnergy.position.set(-W / 2 - 0.2, o.maxHeight + 0.2, wz); anchors.origin.position.set(cx(0), 0, cz(0));

  const bandSel = (b) => (b == null ? -1 : typeof b === 'number' ? b : BANDS.findIndex((x) => x.key === b));
  const snap = (v, arr) => arr.reduce((best, x) => (Math.abs(x - v) < Math.abs(best - v) ? x : best), arr[0]);
  const hCur = new Float32Array(NA);
  const white = new THREE.Color(1, 1, 1);

  const _pp = {}; function update(params = {}) { params = finiteParams(params, _pp);
    const t = params.t ?? 0, reveal = clamp(params.reveal ?? 1), zoneA = clamp(params.zone ?? 1), labelsA = clamp(params.labels ?? 1);
    const locks = clamp(params.locks ?? (reveal - 0.55) / 0.45);
    const hlp = params.highlight;
    const hl = hlp ? cellAt(LEVELS.indexOf(snap(hlp.lv, LEVELS)), PULSES.indexOf(snap(hlp.p, PULSES))) : null;
    const bsel = bandSel(params.band);
    const focus = clamp(params.focus ?? (bsel >= 0 ? 0.75 : hl ? 0.55 : 0));
    const breathe = clamp(params.pulseHighlight ?? 0) * (0.5 + 0.5 * Math.sin(t * TAU * 1.4));
    U.uGlow.value = params.glow ?? 1;
    overlayMat.opacity = 0.35 + 0.65 * labelsA; wallMat.opacity = labelsA * smooth(reveal * 2);

    for (const c of allowed) {
      const k = c.k, delay = (c.i / (NX - 1)) * 0.62 + ((NZ - 1 - c.j) / (NZ - 1)) * 0.38;
      const g = backOut((reveal - 0.5 * delay) / 0.5, 1.05);
      const h = hOf(c.density) * g; hCur[k] = h;
      aH.array[k] = g > 0.0005 ? h + 0.02 : 0;
      let emph = 1, glow = 0;
      if (hl) { const on = c === hl, line = c.i === hl.i || c.j === hl.j; emph = on ? 1 : line ? 1 - focus * 0.35 : 1 - focus * 0.72; if (on) glow = 0.9 + breathe * 1.1; }
      if (bsel >= 0) { if (c.band === bsel) glow += 0.18; else emph *= 1 - focus * 0.92; }
      aGlow.array[k] = glow;
      col.copy(bandCol[c.band]).multiplyScalar(emph); bars.setColorAt(k, col);
      if (decals) {
        m4.makeTranslation(cx(c.i), h + 0.004, cz(c.j)); decals.setMatrixAt(k, m4);
        decalAlpha.array[k] = clamp(params.values ?? 0) * smooth((g - 0.85) / 0.15) * (hl && c !== hl ? 1 - focus * 0.6 : 1);
      }
    }
    aH.needsUpdate = true; aGlow.needsUpdate = true; bars.instanceColor.needsUpdate = true;
    if (decals) { decals.instanceMatrix.needsUpdate = true; decalAlpha.needsUpdate = true; decals.visible = (params.values ?? 0) > 0.001; }

    SU.uLock.value = smooth(locks * 1.6);
    for (const c of locked) {
      const k = c.k, d = seg(locks, (c.k / locked.length) * 0.45, (c.k / locked.length) * 0.45 + 0.55, ease.linear);
      const y = (1 - backOut(d, 0.9)) * 0.55, s = d > 0 ? 1 : 0;
      m4.makeScale(s, s, s); m4.setPosition(cx(c.i), y, cz(c.j)); stubs.setMatrixAt(k, m4);
      stubs.setColorAt(k, c === hl ? col.setRGB(2.2 + breathe * 1.5, 1.2, 1.6) : white);
    }
    stubs.instanceMatrix.needsUpdate = true; stubs.instanceColor.needsUpdate = true;
    stubs.visible = locks > 0.001;

    const zv = zoneA * smooth((reveal - 0.6) / 0.4);
    zone.visible = zv > 0.001; stripMat.opacity = zv; zoneTint.material.opacity = zv; fenceU.uOpacity.value = zv; fenceU.uTime.value = t;

    hlGroup.visible = !!hl && reveal > 0.05;
    halos.hide(0); halos.hide(1);
    if (hl) {
      const x = cx(hl.i), z = cz(hl.j), top = hl.allowed ? hCur[hl.k] : 0.055;
      const hc = hl.allowed ? bandCol[hl.band] : col.setRGB(1, 0.45, 0.62);
      rowStrip.position.z = z; colStrip.position.x = x;
      rowU.uOpacity.value = colU.uOpacity.value = smooth(reveal) * (0.8 + breathe * 0.4);
      beam.position.set(x, top + 0.01, z); beam.scale.set(1, 0.42, 1); beamU.uOpacity.value = 0.9 + breathe; beamU.uCol.value.copy(hc).lerp(white, 0.5);
      ring.position.set(x, top + 0.012, z); const rs = 1 + breathe * 0.15; ring.scale.set(rs, 1, rs); ringMat.color.copy(hc).lerp(white, 0.55).multiplyScalar(1.6); ringMat.opacity = 0.95;
      halos.set(0, x, top + 0.02, z, 0.55 + breathe * 0.2, hc, 0.9 + breathe * 0.8);
      anchors.highlight.position.set(x, top + 0.2, z);
    }
    halos.commit();
    anchors.highlight.userData.visible = !!hl && reveal > 0.05;
    anchors.zone.userData.visible = zv > 0.5; anchors.locked.userData.visible = locks > 0.5; anchors.max.userData.visible = reveal > 0.9;
  }
  const cellTop = (lv, p, target = new THREE.Vector3()) => {
    const i = LEVELS.indexOf(snap(lv, LEVELS)), j = PULSES.indexOf(snap(p, PULSES)), c = cellAt(i, j);
    return target.set(cx(i), c.allowed ? hOf(c.density) : 0.055, cz(j));
  };
  update({});
  return {
    object3d: root, anchors, cells, cellTop, update,
    view: { target: [0.05, 0.3, 0.1], radius: 7.7, azimuth: -0.72, elevation: 0.68 },
    dispose() { disposeTree(root); },
  };
}

/* =====================================================================================
   2 · createPulseTrain3D(THREE, opts) — one treatment shot as physical objects.
   pre-cooling ice block · N glowing 100 ms pulse slabs (violet → mint) · post-cooling ice block,
   plus two 3D temperature ribbons: dermis (rises smoothly, heat colours) and epidermis (held low, cool).
   The train is always centred; it lengthens / shortens with `pulses` (fractional → the next slab grows in).
   opts:
     pitch=0.16 (x per 100 ms)   slab=[w,h,d]=[0.07,0.78,0.72]   block=[w,h,d]=[0.6,0.8,0.8]   gap=0.14
     tempScale=0.8 (ribbon y per unit temperature rise)   labels=true (phase names on the rail)   fontFamily
     phaseNames=['治疗前冷却','射频传送','治疗后冷却']
   update(params):
     pulses=11   7..15, fractional allowed        reveal=1   0..1 build-in (rail → blocks → slabs → ribbons)
     flow=1      0..1 playhead through the shot (0 = before pre-cooling, 1 = post-cooling done);
                 slabs fire as it passes, ribbons are drawn up to it, blocks frost while active
     ribbons=1   0..1 ribbon visibility            labels=1   rail text opacity           t=0 seconds
   The ribbons are 原理示意 (schematic): dermis ΔT = 1.25·(1−e^(−n/9)) with a per-pulse step, epidermis
   pulled down by pre-cooling and held low during RF.
   anchors: pre, post, rf, head, dermis, epidermis, pulseUnit, pulseFirst, pulseLast
   ===================================================================================== */
export function createPulseTrain3D(THREE, opts = {}) {
  const o = { pitch: 0.16, slab: [0.07, 0.78, 0.72], block: [0.6, 0.8, 0.8], gap: 0.14, tempScale: 0.8, labels: true, fontFamily: FONT, phaseNames: ['治疗前冷却', '射频传送', '治疗后冷却'], ...opts };
  if (o.labels) fontGuard(o.fontFamily);
  const [sw, sh, sd] = o.slab, [bw, bh, bd] = o.block, NMAX = 15;
  const root = new THREE.Group(); root.name = 'PulseTrain3D';
  const anchors = {};
  const layout = (N, L = {}) => {
    const total = bw + o.gap + N * o.pitch + o.gap + bw, x0 = -total / 2;
    L.N = N; L.total = total; L.x0 = x0; L.x1 = x0 + total; L.pre = x0 + bw / 2; L.post = x0 + total - bw / 2; L.rf0 = x0 + bw + o.gap; L.rf1 = x0 + bw + o.gap + N * o.pitch;
    return L;
  };
  const LL = {};
  const violet = new THREE.Color(BRAND.violet), mint = new THREE.Color(BRAND.mint), cool = new THREE.Color(BRAND.cool), white = new THREE.Color(1, 1, 1);
  const m4 = new THREE.Matrix4(), col = new THREE.Color(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();

  /* rail */
  const railZ = 0.16, railD = 1.36;
  const rail = new THREE.Mesh(roundedBoxGeo(THREE, 1, 0.06, railD, 0.012, 0.03), new THREE.MeshPhysicalMaterial({ color: 0x14141e, metalness: 0.75, roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
  rail.position.set(0, -0.03, railZ); rail.receiveShadow = true; root.add(rail);
  const railLine = new THREE.Mesh(new THREE.BoxGeometry(1, 0.006, 0.006), new THREE.MeshBasicMaterial({ color: new THREE.Color(BRAND.violet).multiplyScalar(1.5), toneMapped: false }));
  railLine.position.set(0, -0.012, railZ + railD / 2 + 0.002); root.add(railLine);
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.008, 0.004, 0.09), new THREE.MeshBasicMaterial({ color: 0xd8dcf0, toneMapped: false }), NMAX + 1);
  ticks.frustumCulled = false; root.add(ticks);

  /* slabs */
  const slabGeo = roundedBoxGeo(THREE, sw, sh, sd, 0.012, 0.02); slabGeo.translate(0, sh / 2, 0);
  const aGl = new THREE.InstancedBufferAttribute(new Float32Array(NMAX), 1); aGl.setUsage(THREE.DynamicDrawUsage); slabGeo.setAttribute('aGlow', aGl);
  const slabMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.22, metalness: 0.0, clearcoat: 0.35, clearcoatRoughness: 0.1 });
  slabMat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGlow; varying float vGl; varying float vHy;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n vGl = aGlow; vHy = position.y / ${sh.toFixed(4)};`);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGl; varying float vHy;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        vec3 vd = normalize(vViewPosition);
        float fr = pow(1.0 - clamp(abs(dot(normal, vd)), 0.0, 1.0), 2.0);
        float core = 1.0 - pow(abs(clamp(vHy, 0.0, 1.0) * 2.0 - 1.0), 3.0);
        totalEmissiveRadiance += vColor * (vGl * (0.25 + 0.9 * core) + fr * (0.12 + 0.5 * vGl));
        diffuseColor.rgb *= 0.12;
      }`);
  };
  slabMat.customProgramCacheKey = () => 'ym3d-pulse-slab';
  const slabs = new THREE.InstancedMesh(slabGeo, slabMat, NMAX);
  slabs.castShadow = true; slabs.frustumCulled = false;
  for (let k = 0; k < NMAX; k++) slabs.setColorAt(k, violet);
  root.add(slabs);

  /* cooling blocks: frosted ice shell (alpha-blended — no transmission pass, keeps renders deterministic) around a soft cold core */
  const blockGeo = roundedBoxGeo(THREE, bw, bh, bd, 0.07, 0.1); blockGeo.translate(0, bh / 2 + 0.005, 0);
  const coreGeo = new THREE.SphereGeometry(0.5, 40, 28); coreGeo.scale(bw * 0.78, bh * 0.78, bd * 0.78); coreGeo.translate(0, bh / 2 + 0.005, 0);
  const mkBlock = () => {
    const u = { uFrost: { value: 0.5 }, uTime: { value: 0 } };
    const m = new THREE.MeshPhysicalMaterial({ color: 0xcfe9ff, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, transparent: true, depthWrite: false });
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, u);
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\n vOP = position;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
        uniform float uFrost; uniform float uTime; varying vec3 vOP;
        float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          float fn = vn(vOP * 14.0) * 0.6 + vn(vOP * 38.0) * 0.4;
          roughnessFactor = clamp(roughnessFactor + (fn - 0.5) * 0.5, 0.06, 1.0);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          {
            float cr = pow(vn(vOP * 34.0 + 3.1), 14.0) * 2.2;
            vec3 vd = normalize(vViewPosition);
            float fr = pow(1.0 - clamp(abs(dot(normal, vd)), 0.0, 1.0), 2.0);
            totalEmissiveRadiance += vec3(0.5, 0.82, 1.0) * uFrost * (cr * 0.5 + fr * 0.55 + 0.07);
            diffuseColor.a = clamp(0.2 + fr * 0.55 + (fn - 0.5) * 0.12 + cr * 0.3, 0.0, 1.0);
          }`);
    };
    m.customProgramCacheKey = () => 'ym3d-pulse-frost';
    const g = new THREE.Group();
    const block = new THREE.Mesh(blockGeo, m); block.castShadow = true; block.renderOrder = 2;
    const cu = { uCol: { value: new THREE.Color(BRAND.cool) } };
    const core = new THREE.Mesh(coreGeo, fxMat(THREE, cu, `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      `uniform vec3 uCol; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(normalize(vN), vV)), 2.6); gl_FragColor = vec4(uCol * f, 1.0); ${GLSL_OUT} }`, { side: THREE.FrontSide }));
    core.renderOrder = 1;
    g.add(core, block);
    return { g, u, coreMat: { color: cu.uCol.value } };
  };
  const pre = mkBlock(), post = mkBlock(); root.add(pre.g, post.g);

  /* sparkles (frost glints) on both blocks */
  const SP = 160, spPos = new Float32Array(SP * 3), spRnd = new Float32Array(SP * 2);
  { const r = rng(21); for (let k = 0; k < SP; k++) { const face = Math.floor(r() * 5); let x = (r() - 0.5) * bw, y = r() * bh, z = (r() - 0.5) * bd; if (face === 0) x = (r() < 0.5 ? -1 : 1) * (bw / 2 + 0.004); else if (face === 1) z = (r() < 0.5 ? -1 : 1) * (bd / 2 + 0.004); else if (face === 2) y = bh + 0.009; spPos.set([x, y + 0.005, z], k * 3); spRnd.set([r(), r()], k * 2); } }
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3)); spGeo.setAttribute('aR', new THREE.BufferAttribute(spRnd, 2));
  const spU = { uTime: { value: 0 }, uScale: { value: 800 }, uA: { value: 1 }, uOff: { value: new THREE.Vector2() }, uAct: { value: new THREE.Vector2() } };
  const spMat = fxMat(THREE, spU, `
    attribute vec2 aR; uniform float uTime, uScale, uA; uniform vec2 uOff, uAct; varying float vA;
    void main(){
      bool second = aR.x > 0.5;
      vec3 p = position; p.x += second ? uOff.y : uOff.x;
      float act = second ? uAct.y : uAct.x;
      float tw = pow(0.5 + 0.5 * sin(uTime * (2.0 + aR.y * 5.0) + aR.x * 60.0), 10.0);
      vA = tw * act * uA;
      vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = (0.02 + 0.03 * aR.y) * uScale / -mv.z;
    }`, `varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c) * 2.0;
      float a = max(0.0, 1.0 - d); a = a * a + max(0.0, 1.0 - abs(c.x) * 18.0) * max(0.0, 1.0 - abs(c.y) * 2.2) * 0.6 + max(0.0, 1.0 - abs(c.y) * 18.0) * max(0.0, 1.0 - abs(c.x) * 2.2) * 0.6;
      gl_FragColor = vec4(vec3(0.75, 0.92, 1.0) * a * vA, 1.0); ${GLSL_OUT} }`);
  const sparks = new THREE.Points(spGeo, spMat); sparks.frustumCulled = false; sparks.onBeforeRender = pointScaleHook(THREE, spMat); root.add(sparks);

  /* scan sheet at the playhead */
  const scanU = { uCol: { value: new THREE.Color(0xcdbfff) }, uOpacity: { value: 0 } };
  const scanH = sh + 0.4, scanGeo = new THREE.PlaneGeometry(railD - 0.1, scanH); scanGeo.rotateY(Math.PI / 2); scanGeo.translate(0, scanH / 2, railZ);
  const scan = new THREE.Mesh(scanGeo, fxMat(THREE, scanU, `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    `uniform vec3 uCol; uniform float uOpacity; varying vec2 vUv; void main(){ float a = (1.0 - vUv.y) * smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x) * 0.22;
      a += smoothstep(0.985, 1.0, 1.0 - abs(vUv.x - 0.5) * 2.0) * 0.0; gl_FragColor = vec4(uCol * a * uOpacity, 1.0); ${GLSL_OUT} }`));
  scan.renderOrder = 9; root.add(scan);

  /* temperature ribbons (CPU-filled, preallocated) */
  const M = 220, TH = 0.03, WZ = 0.15;
  const mkRibbon = (z) => {
    const pos = new Float32Array(M * 8 * 3), nor = new Float32Array(M * 8 * 3), colA = new Float32Array(M * 8 * 3), aU = new Float32Array(M * 8);
    const idx = [];
    for (let k = 0; k < M; k++) for (let j = 0; j < 8; j++) aU[k * 8 + j] = k / (M - 1);
    for (let k = 0; k < M - 1; k++) {
      const a = k * 8, b = (k + 1) * 8; // 0 TF,1 TB,2 BF,3 BB,4 TF,5 BF,6 TB,7 BB
      idx.push(a + 0, b + 0, a + 1, a + 1, b + 0, b + 1);
      idx.push(a + 2, a + 3, b + 2, a + 3, b + 3, b + 2);
      idx.push(a + 5, b + 5, a + 4, a + 4, b + 5, b + 4);
      idx.push(a + 7, a + 6, b + 7, a + 6, b + 6, b + 7);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(colA, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aU', new THREE.BufferAttribute(aU, 1));
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 4);
    return { g, pos, nor, colA, z, ys: new Float32Array(M), xs: new Float32Array(M) };
  };
  const RU = { uHead: { value: 1 }, uA: { value: 1 } };
  const ribMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1, transparent: true });
  ribMat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, RU);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aU; varying float vU;').replace('#include <begin_vertex>', '#include <begin_vertex>\n vU = aU;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uHead; uniform float uA; varying float vU;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n if (vU > uHead + 0.0005) discard;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vColor * (0.5 + 1.6 * exp(-(uHead - vU) * 70.0));
        diffuseColor.a *= uA;`);
  };
  ribMat.customProgramCacheKey = () => 'ym3d-pulse-ribbon';
  const dermis = mkRibbon(-0.17), epi = mkRibbon(0.2);
  const dermisMesh = new THREE.Mesh(dermis.g, ribMat), epiMesh = new THREE.Mesh(epi.g, ribMat);
  dermisMesh.frustumCulled = epiMesh.frustumCulled = false; dermisMesh.castShadow = true; epiMesh.castShadow = true;
  root.add(dermisMesh, epiMesh);
  // curtain under the dermis ribbon (3D area)
  const cPos = new Float32Array(M * 2 * 3), cCol = new Float32Array(M * 2 * 3), cV = new Float32Array(M * 2), cU = new Float32Array(M * 2), cIdx = [];
  for (let k = 0; k < M; k++) { cV[k * 2] = 1; cV[k * 2 + 1] = 0; cU[k * 2] = cU[k * 2 + 1] = k / (M - 1); }
  for (let k = 0; k < M - 1; k++) { const a = k * 2, b = a + 2; cIdx.push(a, a + 1, b, b, a + 1, b + 1); }
  const cGeo = new THREE.BufferGeometry();
  cGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3).setUsage(THREE.DynamicDrawUsage));
  cGeo.setAttribute('color', new THREE.BufferAttribute(cCol, 3).setUsage(THREE.DynamicDrawUsage));
  cGeo.setAttribute('aV', new THREE.BufferAttribute(cV, 1)); cGeo.setAttribute('aU', new THREE.BufferAttribute(cU, 1)); cGeo.setIndex(cIdx);
  const curtainU = { uHead: RU.uHead, uOpacity: { value: 1 } };
  const curtain = new THREE.Mesh(cGeo, fxMat(THREE, curtainU, `attribute float aV; attribute float aU; attribute vec3 color; varying float vV; varying float vU; varying vec3 vC;
      void main(){ vV = aV; vU = aU; vC = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    `uniform float uHead; uniform float uOpacity; varying float vV; varying float vU; varying vec3 vC;
      void main(){ if (vU > uHead) discard; float a = pow(vV, 1.8) * 0.34 + smoothstep(0.93, 1.0, fract(vU * 60.0)) * vV * 0.1; gl_FragColor = vec4(vC * a * uOpacity, 1.0); ${GLSL_OUT} }`));
  curtain.frustumCulled = false; curtain.renderOrder = 6; root.add(curtain);
  // baselines (dashed) + head beads + drop lines
  const baseU = { uCol: { value: new THREE.Color(0xb8bedc) }, uOpacity: { value: 0.5 }, uLen: { value: 3 } };
  const baseMat = fxMat(THREE, baseU, `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    `uniform vec3 uCol; uniform float uOpacity; uniform float uLen; varying vec2 vUv; void main(){ float d = step(0.45, fract(vUv.x * uLen * 14.0)); gl_FragColor = vec4(uCol * d * uOpacity * 0.5, 1.0); ${GLSL_OUT} }`);
  const baseGeo = new THREE.PlaneGeometry(1, 0.008);
  const baseD = new THREE.Mesh(baseGeo, baseMat), baseE = new THREE.Mesh(baseGeo, baseMat); root.add(baseD, baseE);
  const beadGeo = new THREE.SphereGeometry(0.03, 20, 14);
  const beadDM = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), beadEM = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const beadD = new THREE.Mesh(beadGeo, beadDM), beadE = new THREE.Mesh(beadGeo, beadEM); root.add(beadD, beadE);
  const halos = createHalos(THREE, NMAX + 4 + 12); root.add(halos.mesh);
  const mistR = Array.from({ length: 12 }, (_, k) => rng(100 + k)());

  /* phase labels on the rail shelf */
  const labelMeshes = [];
  if (o.labels) {
    o.phaseNames.forEach((txt) => {
      const tex = canvasTexture(THREE, 512, 96, (g, w, h) => { g.clearRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `600 44px ${o.fontFamily}`; g.fillStyle = 'rgba(232,236,250,0.9)'; g.fillText(txt, w / 2, h / 2); });
      const geo = new THREE.PlaneGeometry(0.72, 0.135); geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
      m.position.set(0, 0.002, railZ + railD / 2 - 0.2); m.renderOrder = 2; root.add(m); labelMeshes.push(m);
    });
  }
  for (const n of ['pre', 'post', 'rf', 'head', 'dermis', 'epidermis', 'pulseUnit', 'pulseFirst', 'pulseLast']) mkAnchor(THREE, root, n, anchors);

  /* temperature model (schematic, normalised) */
  const Rd = 1.25, tau = 9, Ce = 0.3;
  const stepN = (n, N) => { const f = Math.floor(n); const st = n >= N ? N : f + smooth(clamp((n - f) * 1.6)); return n + (st - n) * 0.3; };
  const temps = (x, L, out) => {
    const { x0, rf0, rf1, x1, N } = L;
    const preS = clamp((x - x0) / Math.max(1e-6, rf0 - x0)), n = clamp((x - rf0) / o.pitch, 0, N), postS = clamp((x - rf1) / Math.max(1e-6, x1 - rf1));
    const Eend = -Ce + 0.07 * (1 - Math.exp(-N / 4));
    const Dend = Rd * (1 - Math.exp(-N / tau));
    if (x < rf0) { out[0] = 0; out[1] = (-Ce * (1 - Math.exp(-preS * 3))) / (1 - Math.exp(-3)); }
    else if (x <= rf1) { const ns = stepN(n, N); out[0] = Rd * (1 - Math.exp(-ns / tau)); out[1] = -Ce + 0.07 * (1 - Math.exp(-n / 4)) + 0.01 * Math.sin(Math.PI * (n % 1)); }
    else { out[0] = Dend * (1 - 0.2 * Math.pow(postS, 1.2)); out[1] = Eend - 0.07 * smooth(postS); }
    return out;
  };
  const tmp = [0, 0], cA = new THREE.Color(), cB = new THREE.Color();
  const dermisColor = (d, out) => heatColor(THREE, 0.34 + 0.6 * clamp(d / 1.15), out);
  const epiColor = (e, out) => out.copy(cool).lerp(mint, clamp(1 + e / Ce) * 0.6).multiplyScalar(1.0);

  function fillRibbon(R, L, which, base) {
    const { pos, nor, colA } = R;
    for (let k = 0; k < M; k++) { const x = L.x0 + (k / (M - 1)) * L.total; R.xs[k] = x; temps(x, L, tmp); R.ys[k] = base + tmp[which] * o.tempScale; }
    const wr = (k, j, px, py, pz, nx, ny, nz) => { const b = (k * 8 + j) * 3; pos[b] = px; pos[b + 1] = py; pos[b + 2] = pz; nor[b] = nx; nor[b + 1] = ny; nor[b + 2] = nz; colA[b] = cA.r; colA[b + 1] = cA.g; colA[b + 2] = cA.b; };
    const zf = R.z + WZ / 2, zb = R.z - WZ / 2, hy = TH / 2;
    for (let k = 0; k < M; k++) {
      const x = R.xs[k], y = R.ys[k];
      const k0 = Math.max(0, k - 1), k1 = Math.min(M - 1, k + 1);
      let tx = R.xs[k1] - R.xs[k0], ty = R.ys[k1] - R.ys[k0]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const nx = -ty, ny = tx;
      const tfx = x + nx * hy, tfy = y + ny * hy, bfx = x - nx * hy, bfy = y - ny * hy;
      temps(x, L, tmp); if (which === 0) dermisColor(tmp[0], cA); else epiColor(tmp[1], cA);
      wr(k, 0, tfx, tfy, zf, nx, ny, 0); wr(k, 1, tfx, tfy, zb, nx, ny, 0); wr(k, 2, bfx, bfy, zf, -nx, -ny, 0); wr(k, 3, bfx, bfy, zb, -nx, -ny, 0);
      wr(k, 4, tfx, tfy, zf, 0, 0, 1); wr(k, 5, bfx, bfy, zf, 0, 0, 1); wr(k, 6, tfx, tfy, zb, 0, 0, -1); wr(k, 7, bfx, bfy, zb, 0, 0, -1);
      if (which === 0) {
        const b = k * 6; cPos[b] = x; cPos[b + 1] = bfy; cPos[b + 2] = R.z; cPos[b + 3] = x; cPos[b + 4] = base; cPos[b + 5] = R.z;
        cCol[b] = cA.r; cCol[b + 1] = cA.g; cCol[b + 2] = cA.b; cCol[b + 3] = cA.r; cCol[b + 4] = cA.g; cCol[b + 5] = cA.b;
      }
    }
    R.g.attributes.position.needsUpdate = true; R.g.attributes.normal.needsUpdate = true; R.g.attributes.color.needsUpdate = true;
  }
  const ribbonAt = (R, u) => { const f = clamp(u) * (M - 1), k = Math.min(M - 2, Math.floor(f)), a = f - k; return lerp(R.ys[k], R.ys[k + 1], a); };

  const _pp = {}; function update(params = {}) { params = finiteParams(params, _pp);
    const t = params.t ?? 0, N = clamp(params.pulses ?? 11, 7, 15), reveal = clamp(params.reveal ?? 1), flow = clamp(params.flow ?? 1);
    const ribA = clamp(params.ribbons ?? 1) * seg(reveal, 0.7, 1.0), labA = clamp(params.labels ?? 1) * seg(reveal, 0.2, 0.6);
    const L = layout(N, LL), head = L.x0 + flow * L.total, base = sh + 0.46;
    const railS = seg(reveal, 0, 0.35, ease.out);
    rail.scale.set((L.total + 0.3) * Math.max(railS, 1e-3), 1, 1); railLine.scale.set((L.total + 0.3) * Math.max(railS, 1e-3), 1, 1);
    rail.visible = railLine.visible = railS > 0.001;
    // blocks
    const bS = seg(reveal, 0.12, 0.45, (x) => backOut(x, 1.3));
    const actPre = flow >= 1 ? 0.55 : smooth((head - L.x0) / (bw * 0.5)) * (1 - 0.65 * smooth((head - L.rf0) / (o.pitch * 3)));
    const actPost = flow >= 1 ? 0.55 : smooth((head - L.rf1 - o.gap) / (bw * 0.5));
    for (let bi = 0; bi < 2; bi++) {
      const b = bi ? post : pre, x = bi ? L.post : L.pre, a = bi ? actPost : actPre;
      b.g.position.x = x; b.g.scale.setScalar(Math.max(1e-3, bS)); b.g.visible = bS > 0.001;
      b.u.uFrost.value = 0.25 + a; b.u.uTime.value = t;
      b.coreMat.color.copy(cool).multiplyScalar(0.12 + 0.75 * a);
    }
    spU.uTime.value = t; spU.uA.value = bS; spU.uOff.value.set(L.pre, L.post); spU.uAct.value.set(0.25 + actPre, 0.25 + actPost);
    // slabs + ticks
    const Nc = Math.ceil(N - 1e-6);
    for (let k = 0; k < NMAX; k++) {
      const x = L.rf0 + (k + 0.5) * o.pitch;
      const exist = clamp(N - k), pop = seg(reveal, 0.3 + (k / NMAX) * 0.45, 0.42 + (k / NMAX) * 0.45, (v) => backOut(v, 1.5));
      const s = exist * pop;
      q.identity(); s3.set(Math.max(1e-3, s), Math.max(1e-3, s), Math.max(1e-3, s)); v3.set(x, 0, 0);
      m4.compose(v3, q, s3); if (s <= 0.001) m4.makeScale(0, 0, 0); slabs.setMatrixAt(k, m4);
      col.copy(violet).lerp(mint, Nc > 1 ? clamp(k / (N - 1)) : 0); slabs.setColorAt(k, col);
      const passed = head - x;
      const fired = passed >= 0 ? 0.6 + 2.6 * Math.exp(-passed / 0.22) : 0.035;
      aGl.array[k] = fired * s;
      if (s > 0.01 && passed >= 0) halos.set(k, x, sh * 0.5, 0, 0.95, col, 0.1 + 0.9 * Math.exp(-passed / 0.25)); else halos.hide(k);
      m4.makeTranslation(x - o.pitch / 2, 0.002, railZ + railD / 2 - 0.37); ticks.setMatrixAt(k, k <= N && railS > 0.99 ? m4 : m4.makeScale(0, 0, 0));
    }
    m4.makeTranslation(L.rf1, 0.002, railZ + railD / 2 - 0.37); ticks.setMatrixAt(NMAX, railS > 0.99 ? m4 : m4.makeScale(0, 0, 0));
    slabs.instanceMatrix.needsUpdate = true; slabs.instanceColor.needsUpdate = true; aGl.needsUpdate = true; ticks.instanceMatrix.needsUpdate = true;
    // scan sheet
    scan.visible = flow > 0 && flow < 1; scan.position.x = head; scanU.uOpacity.value = 1;
    // ribbons
    fillRibbon(dermis, L, 0, base); fillRibbon(epi, L, 1, base);
    cGeo.attributes.position.needsUpdate = true; cGeo.attributes.color.needsUpdate = true;
    RU.uHead.value = flow; RU.uA.value = ribA; curtainU.uOpacity.value = ribA;
    dermisMesh.visible = epiMesh.visible = curtain.visible = ribA > 0.001;
    baseD.visible = baseE.visible = ribA > 0.001;
    baseD.scale.set(L.total, 1, 1); baseD.position.set(0, base, dermis.z); baseE.scale.set(L.total, 1, 1); baseE.position.set(0, base, epi.z);
    baseU.uLen.value = L.total; baseU.uOpacity.value = ribA;
    const yD = ribbonAt(dermis, flow), yE = ribbonAt(epi, flow);
    temps(head, L, tmp);
    dermisColor(tmp[0], cA); epiColor(tmp[1], cB);
    beadD.position.set(head, yD, dermis.z); beadE.position.set(head, yE, epi.z);
    beadDM.color.copy(cA).lerp(white, 0.4).multiplyScalar(1.6); beadEM.color.copy(cB).lerp(white, 0.4).multiplyScalar(1.6);
    beadD.visible = beadE.visible = ribA > 0.01;
    halos.set(NMAX, head, yD, dermis.z, 0.5, cA, 0.9 * ribA); halos.set(NMAX + 1, head, yE, epi.z, 0.45, cB, 0.8 * ribA);
    // mist puffs below active blocks
    for (let k = 0; k < 12; k++) {
      const b = k < 6 ? 0 : 1, a = b ? actPost : actPre, x = b ? L.post : L.pre, ph = (t * 0.22 + (k % 6) / 6) % 1;
      const r = mistR[k], dx = (((k % 6) / 5) - 0.5) * bw * 0.9;
      halos.set(NMAX + 2 + k, x + dx * (1 + ph * 0.4), 0.06 + ph * 0.12, bd / 2 * (0.6 + r * 0.5), 0.35 + ph * 0.5, cool, Math.sin(Math.PI * ph) * 0.22 * a * bS);
    }
    halos.commit();
    // labels
    for (let i = 0; i < labelMeshes.length; i++) { const m = labelMeshes[i]; m.position.x = i === 0 ? L.pre : i === 1 ? (L.rf0 + L.rf1) / 2 : L.post; m.material.opacity = labA; m.visible = labA > 0.001; }
    // anchors
    anchors.pre.position.set(L.pre, bh + 0.12, 0); anchors.post.position.set(L.post, bh + 0.12, 0);
    anchors.rf.position.set((L.rf0 + L.rf1) / 2, sh + 0.08, 0); anchors.head.position.set(head, sh + 0.45, railZ);
    anchors.dermis.position.set(head, yD + 0.12, dermis.z); anchors.epidermis.position.set(head, yE - 0.12, epi.z);
    anchors.pulseUnit.position.set(L.rf0 + o.pitch / 2, 0, railZ + railD / 2 - 0.3);
    anchors.pulseFirst.position.set(L.rf0 + o.pitch / 2, sh + 0.05, 0); anchors.pulseLast.position.set(L.rf0 + (Nc - 0.5) * o.pitch, sh + 0.05, 0);
    const vis = reveal > 0.5; anchors.pre.userData.visible = anchors.post.userData.visible = anchors.rf.userData.visible = anchors.pulseUnit.userData.visible = anchors.pulseFirst.userData.visible = anchors.pulseLast.userData.visible = vis;
    anchors.dermis.userData.visible = anchors.epidermis.userData.visible = ribA > 0.5 && flow > 0.02; anchors.head.userData.visible = flow > 0 && flow < 1;
  }
  update({});
  return { object3d: root, anchors, update, layout, view: { target: [0, 0.78, 0.05], radius: 6.1, azimuth: -0.36, elevation: 0.3 }, dispose() { disposeTree(root); } };
}

/* =====================================================================================
   3 · createLoadCurve3D(THREE, opts) — IFU 图12 output power vs load impedance in a 3D chart box.
   x = 75 … 350 Ω, y = W. Full-power curve 140/175/175/175/175/150/130 W (glowing extruded tape
   + light curtain), half-power 95 W flat, rated load 100–250 Ω as a translucent volume, a moving
   impedance cursor plane with a locked power marker.
   opts: width=3.8, height=1.9 (y of wMax), depth=1.0, wMax=200, labels=true, fontFamily,
         load / full / half arrays (default data.js loadCurve), rated=[100,250]
   update(params):
     reveal=1  0..1 box → band volume rises → curves draw left→right → cursor appears
     ohm=175   cursor impedance (75..350)          half=1  0..1 half-power curve visibility
     band=1    0..1 rated-band volume              cursor=1  0..1 cursor/marker visibility
     labels=1  0..1 axis text                      t=0 seconds (energy packets flow along the tape)
   extras: powerAt(ohm, 'full'|'half') → W (piecewise-linear, as plotted)
   anchors: marker, band, full, half, xAxis, yAxis, cursorBase
   ===================================================================================== */
export function createLoadCurve3D(THREE, opts = {}) {
  const o = { width: 3.8, height: 1.9, depth: 1.0, wMax: 200, labels: true, fontFamily: FONT, load: [75, 100, 150, 200, 250, 300, 350], full: [140, 175, 175, 175, 175, 150, 130], half: [95, 95, 95, 95, 95, 95, 95], rated: [100, 250], ...opts };
  if (o.labels) fontGuard(o.fontFamily);
  const Wd = o.width, H = o.height, Dp = o.depth, lo = o.load[0], hi = o.load[o.load.length - 1];
  const X = (ohm) => -Wd / 2 + ((ohm - lo) / (hi - lo)) * Wd, Y = (w) => (w / o.wMax) * H;
  const root = new THREE.Group(); root.name = 'LoadCurve3D';
  const anchors = {};
  const powerAt = (ohm, which = 'full') => {
    const arr = o[which], L = o.load; ohm = clamp(ohm, lo, hi);
    for (let i = 0; i < L.length - 1; i++) if (ohm <= L[i + 1]) return lerp(arr[i], arr[i + 1], (ohm - L[i]) / (L[i + 1] - L[i]));
    return arr[arr.length - 1];
  };
  const mint = new THREE.Color(BRAND.mint), violet = new THREE.Color(BRAND.violet), jade = new THREE.Color(BRAND.jade), amber = new THREE.Color(BRAND.lv.mid), white = new THREE.Color(1, 1, 1), cool = new THREE.Color(BRAND.cool);

  /* floor slab + engraved grid */
  const fx0 = -Wd / 2 - 0.5, fx1 = Wd / 2 + 0.22, fz0 = -Dp / 2 - 0.06, fz1 = Dp / 2 + 0.5, FW = fx1 - fx0, FD = fz1 - fz0, FT = 0.07;
  const floorGeo = roundedBoxGeo(THREE, FW, FD, FT, 0.025, 0.1); floorGeo.rotateX(-Math.PI / 2); floorGeo.translate((fx0 + fx1) / 2, -FT / 2, (fz0 + fz1) / 2);
  const floor = new THREE.Mesh(floorGeo, envScale(new THREE.MeshPhysicalMaterial({ color: 0x11111a, metalness: 0.5, roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.14 }), 0.3, 'loadfloor'));
  floor.receiveShadow = true; root.add(floor);
  const ppu = 360;
  const fTex = canvasTexture(THREE, Math.round(FW * ppu), Math.round(FD * ppu), (g, w, h) => {
    const PX = (x) => (x - fx0) * ppu, PZ = (z) => (z - fz0) * ppu;
    g.clearRect(0, 0, w, h);
    for (let r = lo; r <= hi + 1e-6; r += 25) { const major = r % 50 === 0 || r === lo; g.strokeStyle = major ? 'rgba(200,206,240,0.2)' : 'rgba(200,206,240,0.08)'; g.lineWidth = major ? 2 : 1.5; g.beginPath(); g.moveTo(PX(X(r)), PZ(-Dp / 2)); g.lineTo(PX(X(r)), PZ(Dp / 2 + 0.06)); g.stroke(); }
    for (let z = -Dp / 2; z <= Dp / 2 + 1e-6; z += Dp / 4) { g.strokeStyle = 'rgba(200,206,240,0.08)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(PX(-Wd / 2), PZ(z)); g.lineTo(PX(Wd / 2), PZ(z)); g.stroke(); }
    if (!o.labels) return;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `600 ${0.078 * ppu}px ${o.fontFamily}`; g.fillStyle = 'rgba(236,238,250,0.92)';
    for (const r of o.load) g.fillText(String(r), PX(X(r)), PZ(Dp / 2 + 0.16));
    g.font = `600 ${0.09 * ppu}px ${o.fontFamily}`; g.fillStyle = 'rgba(222,226,246,0.86)'; g.fillText('负载阻抗  LOAD  (Ω)', PX(0), PZ(Dp / 2 + 0.36));
  });
  const fOverGeo = new THREE.PlaneGeometry(FW, FD); fOverGeo.rotateX(-Math.PI / 2); fOverGeo.translate((fx0 + fx1) / 2, 0.0015, (fz0 + fz1) / 2);
  const fOverMat = new THREE.MeshBasicMaterial({ map: fTex, transparent: true, depthWrite: false, toneMapped: false });
  const fOver = new THREE.Mesh(fOverGeo, fOverMat); fOver.renderOrder = 1; root.add(fOver);

  /* back wall grid */
  const wx0 = -Wd / 2 - 0.62, wx1 = Wd / 2 + 0.05, WW = wx1 - wx0, WH = H + 0.2, wz = -Dp / 2;
  const wTex = canvasTexture(THREE, Math.round(WW * ppu), Math.round(WH * ppu), (g, w, h) => {
    const PX = (x) => (x - wx0) * ppu, PY = (y) => h - y * ppu;
    const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(138,92,240,0.12)'); gr.addColorStop(1, 'rgba(138,92,240,0.0)');
    g.fillStyle = gr; g.fillRect(PX(-Wd / 2), 0, PX(Wd / 2) - PX(-Wd / 2), h);
    for (let wv = 0; wv <= o.wMax + 1e-6; wv += 25) { const major = wv % 50 === 0; g.strokeStyle = major ? 'rgba(200,206,240,0.22)' : 'rgba(200,206,240,0.08)'; g.lineWidth = major ? 2 : 1.5; g.beginPath(); g.moveTo(PX(-Wd / 2), PY(Y(wv))); g.lineTo(PX(Wd / 2), PY(Y(wv))); g.stroke(); }
    for (const r of o.load) { g.strokeStyle = 'rgba(200,206,240,0.08)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(PX(X(r)), PY(0)); g.lineTo(PX(X(r)), PY(H)); g.stroke(); }
    if (!o.labels) return;
    g.textAlign = 'right'; g.textBaseline = 'middle'; g.font = `600 ${0.078 * ppu}px ${o.fontFamily}`; g.fillStyle = 'rgba(236,238,250,0.92)';
    for (let wv = 50; wv <= o.wMax; wv += 50) g.fillText(String(wv), PX(-Wd / 2 - 0.06), PY(Y(wv)));
    g.fillText('0', PX(-Wd / 2 - 0.06), PY(0.03));
    g.textAlign = 'left'; g.font = `600 ${0.086 * ppu}px ${o.fontFamily}`; g.fillStyle = 'rgba(222,226,246,0.86)'; g.fillText('输出功率  W', PX(-Wd / 2 - 0.58), PY(H + 0.1));
  });
  const wGeo = new THREE.PlaneGeometry(WW, WH); wGeo.translate((wx0 + wx1) / 2, WH / 2, wz);
  const wMat = new THREE.MeshBasicMaterial({ map: wTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const wall = new THREE.Mesh(wGeo, wMat); wall.renderOrder = 1; root.add(wall);

  /* rated band volume */
  const bx0 = X(o.rated[0]), bx1 = X(o.rated[1]), bH = Y(o.wMax) + 0.04;
  const bandGeo = new THREE.BoxGeometry(bx1 - bx0, bH, Dp); bandGeo.translate((bx0 + bx1) / 2, bH / 2 + 0.004, 0);
  const bandU = { uCol: { value: new THREE.Color(0x9f86ff) }, uCol2: { value: new THREE.Color(BRAND.mint) }, uOpacity: { value: 1 }, uLit: { value: 0 } };
  const bandMesh = new THREE.Mesh(bandGeo, fxMat(THREE, bandU, `varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`, `
    uniform vec3 uCol; uniform vec3 uCol2; uniform float uOpacity; uniform float uLit; varying vec2 vUv; varying vec3 vP;
    void main(){
      vec2 e = abs(vUv * 2.0 - 1.0);
      float edge = smoothstep(0.975, 1.0, max(e.x, e.y));
      float fill = 0.012 + 0.02 * pow(1.0 - vUv.y, 2.0);
      vec3 c = mix(uCol, uCol2, uLit * 0.5);
      gl_FragColor = vec4(c * (fill + edge * 0.28) * uOpacity * (1.0 + uLit * 0.6), 1.0);
      ${GLSL_OUT}
    }`));
  bandMesh.renderOrder = 3; root.add(bandMesh);

  /* curve tapes */
  const buildTape = (vals, th, wz, cA, cB, samplesPerSeg = 40) => {
    const pts = o.load.map((r, i) => [X(r), Y(vals[i])]);
    const S = []; for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < samplesPerSeg; k++) { const a = k / samplesPerSeg; S.push([lerp(pts[i][0], pts[i + 1][0], a), lerp(pts[i][1], pts[i + 1][1], a), i, k === 0]); }
    S.push([...pts[pts.length - 1], pts.length - 2, true]);
    const n = S.length, { L, R } = offsetPolyline(S.map((s) => [s[0], s[1]]), th / 2, false);
    // normals per sample: miter direction
    const pos = [], nor = [], colr = [], aU = [], aS = [], idx = [];
    let arc = 0; const c = new THREE.Color();
    for (let k = 0; k < n; k++) {
      if (k > 0) arc += Math.hypot(S[k][0] - S[k - 1][0], S[k][1] - S[k - 1][1]);
      const mx = L[k][0] - S[k][0], my = L[k][1] - S[k][1], ml = Math.hypot(mx, my) || 1;
      const up = [mx / ml, my / ml];
      const V = [[L[k][0], L[k][1], wz / 2], [L[k][0], L[k][1], -wz / 2], [R[k][0], R[k][1], wz / 2], [R[k][0], R[k][1], -wz / 2]];
      const vs = [V[0], V[1], V[2], V[3], V[0], V[2], V[1], V[3]];
      const ns = [[up[0], up[1], 0], [up[0], up[1], 0], [-up[0], -up[1], 0], [-up[0], -up[1], 0], [0, 0, 1], [0, 0, 1], [0, 0, -1], [0, 0, -1]];
      const u = (S[k][0] + Wd / 2) / Wd; c.copy(cA).lerp(cB, u);
      for (let j = 0; j < 8; j++) { pos.push(...vs[j]); nor.push(...ns[j]); colr.push(c.r, c.g, c.b); aU.push(u); aS.push(arc); }
    }
    for (let k = 0; k < n - 1; k++) {
      const a = k * 8, b = (k + 1) * 8;
      idx.push(a + 0, b + 0, a + 1, a + 1, b + 0, b + 1, a + 2, a + 3, b + 2, a + 3, b + 3, b + 2, a + 5, b + 5, a + 4, a + 4, b + 5, b + 4, a + 7, a + 6, b + 7, a + 6, b + 6, b + 7);
    }
    // end caps
    for (const [k, sgn] of [[0, -1], [n - 1, 1]]) {
      const base = pos.length / 3, a = k * 8;
      const P4 = [0, 1, 2, 3].map((j) => pos.slice((a + j) * 3, (a + j) * 3 + 3));
      for (const p of P4) { pos.push(...p); nor.push(sgn, 0, 0); colr.push(...colr.slice(a * 3, a * 3 + 3)); aU.push(aU[a]); aS.push(aS[a]); }
      if (sgn > 0) idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3); else idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); g.setAttribute('aU', new THREE.Float32BufferAttribute(aU, 1)); g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1));
    g.setIndex(idx);
    // curtain under the tape
    const cp = [], cc = [], cu = [], cv = [], ci = [];
    for (let k = 0; k < n; k++) { const u = (S[k][0] + Wd / 2) / Wd; c.copy(cA).lerp(cB, u); cp.push(S[k][0], R[k][1], 0, S[k][0], 0, 0); cc.push(c.r, c.g, c.b, c.r, c.g, c.b); cu.push(u, u); cv.push(1, 0); }
    for (let k = 0; k < n - 1; k++) { const a = k * 2, b = a + 2; ci.push(a, a + 1, b, b, a + 1, b + 1); }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); cg.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
    cg.setAttribute('aU', new THREE.Float32BufferAttribute(cu, 1)); cg.setAttribute('aV', new THREE.Float32BufferAttribute(cv, 1)); cg.setIndex(ci);
    return { g, cg, pts };
  };
  const mkTapeMat = (key, glow) => {
    const u = { uReveal: { value: 1 }, uTime: { value: 0 }, uA: { value: 1 } };
    const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.1, clearcoat: 0.35, clearcoatRoughness: 0.2, transparent: true });
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, u);
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aU; attribute float aS; varying float vU; varying float vS;').replace('#include <begin_vertex>', '#include <begin_vertex>\n vU = aU; vS = aS;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uReveal; uniform float uTime; uniform float uA; varying float vU; varying float vS;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n if (vU > uReveal + 0.0001) discard;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          {
            float pk = smoothstep(0.86, 1.0, fract(vS * 2.4 - uTime * 0.9));
            totalEmissiveRadiance += vColor * (${glow.toFixed(2)} + pk * 2.2 * ${glow.toFixed(2)} + 2.0 * exp(-(uReveal - vU) * 90.0) * step(uReveal, 0.999));
            diffuseColor.a *= uA;
            diffuseColor.rgb *= 0.45;
          }`);
    };
    m.customProgramCacheKey = () => 'ym3d-load-tape-' + key;
    return { m, u };
  };
  const full = buildTape(o.full, 0.046, 0.24, mint, violet), half = buildTape(o.half, 0.03, 0.16, cool, new THREE.Color(0x7f9cff));
  const fullM = mkTapeMat('full', 0.3), halfM = mkTapeMat('half', 0.18);
  const fullMesh = new THREE.Mesh(full.g, fullM.m), halfMesh = new THREE.Mesh(half.g, halfM.m);
  fullMesh.castShadow = halfMesh.castShadow = true; root.add(fullMesh, halfMesh);
  const curtainShader = [`attribute float aU; attribute float aV; attribute vec3 color; varying float vU; varying float vV; varying vec3 vC;
      void main(){ vU = aU; vV = aV; vC = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    `uniform float uReveal; uniform float uOpacity; varying float vU; varying float vV; varying vec3 vC;
      void main(){ if (vU > uReveal) discard; float a = pow(vV, 2.4) * 0.15; gl_FragColor = vec4(vC * a * uOpacity, 1.0); ${GLSL_OUT} }`];
  const fullCU = { uReveal: fullM.u.uReveal, uOpacity: { value: 1 } }, halfCU = { uReveal: halfM.u.uReveal, uOpacity: { value: 0.45 } };
  const fullCurtain = new THREE.Mesh(full.cg, fxMat(THREE, fullCU, ...curtainShader)), halfCurtain = new THREE.Mesh(half.cg, fxMat(THREE, halfCU, ...curtainShader));
  fullCurtain.renderOrder = halfCurtain.renderOrder = 4; root.add(fullCurtain);
  // data point markers
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.032, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), o.load.length * 2);
  dots.frustumCulled = false; root.add(dots);

  /* cursor plane + locked marker */
  const cH = H + 0.28, curGeo = new THREE.PlaneGeometry(Dp + 0.12, cH); curGeo.rotateY(Math.PI / 2); curGeo.translate(0, cH / 2, 0);
  const curU = { uCol: { value: new THREE.Color(0xd8ceff) }, uOpacity: { value: 1 }, uTime: { value: 0 } };
  const cursor = new THREE.Mesh(curGeo, fxMat(THREE, curU, `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`, `
    uniform vec3 uCol; uniform float uOpacity; uniform float uTime; varying vec2 vUv;
    void main(){
      vec2 e = abs(vUv * 2.0 - 1.0);
      float edge = smoothstep(0.975, 1.0, e.x) * 0.8 + smoothstep(0.99, 1.0, e.y) * 0.4;
      float fill = 0.045 * (1.0 - vUv.y * 0.7);
      float sl = smoothstep(0.965, 1.0, fract(vUv.y * 12.0 - uTime * 0.6)) * 0.07;
      float centre = exp(-pow((vUv.x - 0.5) * 40.0, 2.0)) * 0.35;
      gl_FragColor = vec4(uCol * (fill + edge + sl + centre) * (1.0 - vUv.y * 0.5) * uOpacity, 1.0);
      ${GLSL_OUT}
    }`));
  cursor.renderOrder = 6; root.add(cursor);
  const markMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.05, 28, 20), markMat); root.add(marker);
  const lockRingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true });
  const lockRing = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.007, 8, 72), lockRingMat); root.add(lockRing);
  const lockRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.004, 8, 72, Math.PI * 1.5), lockRingMat); root.add(lockRing2);
  const guideU = { uCol: { value: new THREE.Color(1, 1, 1) }, uOpacity: { value: 1 }, uLen: { value: 1 } };
  const guideGeo = new THREE.PlaneGeometry(1, 0.01); guideGeo.translate(0.5, 0, 0);
  const guide = new THREE.Mesh(guideGeo, fxMat(THREE, guideU, `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    `uniform vec3 uCol; uniform float uOpacity; uniform float uLen; varying vec2 vUv; void main(){ float d = step(0.5, fract(vUv.x * uLen * 16.0)); gl_FragColor = vec4(uCol * d * uOpacity * 0.8, 1.0); ${GLSL_OUT} }`));
  guide.renderOrder = 7; root.add(guide);
  const halos = createHalos(THREE, 3); root.add(halos.mesh);
  for (const n of ['marker', 'band', 'full', 'half', 'xAxis', 'yAxis', 'cursorBase']) mkAnchor(THREE, root, n, anchors);
  anchors.band.position.set((bx0 + bx1) / 2, bH + 0.08, 0);
  anchors.full.position.set(X(hi) + 0.08, Y(o.full[o.full.length - 1]) + 0.1, 0); anchors.half.position.set(X(hi) + 0.08, Y(o.half[o.half.length - 1]) + 0.08, 0);
  anchors.xAxis.position.set(0, 0, Dp / 2 + 0.36); anchors.yAxis.position.set(-Wd / 2 - 0.3, H + 0.1, wz);
  const m4 = new THREE.Matrix4(), cc = new THREE.Color();

  const _pp = {}; function update(params = {}) { params = finiteParams(params, _pp);
    const t = params.t ?? 0, reveal = clamp(params.reveal ?? 1), ohm = clamp(params.ohm ?? 175, lo, hi);
    const labA = clamp(params.labels ?? 1), halfA = clamp(params.half ?? 1), bandA = clamp(params.band ?? 1) * seg(reveal, 0.15, 0.45), curA = clamp(params.cursor ?? 1) * seg(reveal, 0.85, 1);
    const box = seg(reveal, 0, 0.25);
    fOverMat.opacity = box * (0.4 + 0.6 * labA); wMat.opacity = box * (0.35 + 0.65 * labA);
    floor.visible = fOver.visible = wall.visible = box > 0.001;
    const bs = seg(reveal, 0.15, 0.5, ease.out);
    bandMesh.scale.set(1, Math.max(1e-3, bs), 1); bandMesh.visible = bandA > 0.001; bandU.uOpacity.value = bandA;
    const inBand = ohm >= o.rated[0] - 1e-6 && ohm <= o.rated[1] + 1e-6;
    bandU.uLit.value = inBand ? curA : 0;
    const cr = seg(reveal, 0.3, 0.95, ease.inOut);
    fullM.u.uReveal.value = cr; halfM.u.uReveal.value = cr; fullM.u.uTime.value = halfM.u.uTime.value = t;
    halfM.u.uA.value = halfA; halfCU.uOpacity.value = 0.45 * halfA; halfMesh.visible = halfCurtain.visible = halfA > 0.001 && cr > 0.0005;
    fullMesh.visible = fullCurtain.visible = cr > 0.0005;
    let di = 0;
    for (const [pts, a, sz] of [[full.pts, 1, 1], [half.pts, halfA, 0.75]]) for (const p of pts) {
      const u = (p[0] + Wd / 2) / Wd, s = a * sz * smooth((cr - u) / 0.04 + 1) * (cr > 0.001 && cr >= u - 1e-4 ? 1 : 0);
      m4.makeScale(s, s, s); m4.setPosition(p[0], p[1], 0); dots.setMatrixAt(di++, m4);
    }
    dots.instanceMatrix.needsUpdate = true;
    const x = X(ohm), pw = powerAt(ohm, 'full'), y = Y(pw);
    cursor.visible = marker.visible = lockRing.visible = lockRing2.visible = guide.visible = curA > 0.001;
    cursor.position.x = x; curU.uOpacity.value = curA; curU.uTime.value = t;
    cc.copy(inBand ? mint : amber);
    markMat.color.copy(cc).lerp(white, 0.35).multiplyScalar(1.5);
    marker.position.set(x, y, 0); marker.scale.setScalar(Math.max(1e-3, curA));
    lockRing.position.set(x, y, 0.001); lockRing2.position.copy(lockRing.position);
    lockRing2.rotation.z = t * 1.2; lockRing.scale.setScalar(Math.max(1e-3, curA * (inBand ? 1 : 1.25)));
    lockRingMat.color.copy(cc).multiplyScalar(1.4); lockRingMat.opacity = curA * (inBand ? 1 : 0.55);
    guide.position.set(-Wd / 2, y, 0); guide.scale.set(Math.max(1e-3, x + Wd / 2), 1, 1); guideU.uLen.value = x + Wd / 2; guideU.uOpacity.value = curA; guideU.uCol.value.copy(cc).lerp(white, 0.5);
    halos.set(0, x, y, 0, 0.55, cc, 0.9 * curA); halos.set(1, -Wd / 2, y, 0, 0.1, cc, 0.6 * curA);
    const headU = cr; const hx = -Wd / 2 + headU * Wd;
    halos.set(2, hx, Y(powerAt(lerp(lo, hi, headU))), 0, 0.55, violet, cr > 0 && cr < 0.999 ? 1 : 0);
    halos.commit();
    anchors.marker.position.set(x, y + 0.2, 0); anchors.cursorBase.position.set(x, 0, Dp / 2 + 0.12);
    anchors.marker.userData.visible = anchors.cursorBase.userData.visible = curA > 0.01;
    anchors.marker.userData.power = pw; anchors.marker.userData.locked = inBand;
    anchors.band.userData.visible = bandA > 0.5; anchors.half.userData.visible = halfA * cr > 0.5; anchors.full.userData.visible = cr > 0.99;
    anchors.xAxis.userData.visible = anchors.yAxis.userData.visible = box > 0.5;
  }
  update({});
  return { object3d: root, anchors, update, powerAt, view: { target: [-0.1, 0.8, 0], radius: 7.2, azimuth: -0.42, elevation: 0.26 }, dispose() { disposeTree(root); } };
}

/* =====================================================================================
   4 · createDigits3D(THREE, opts) — extruded, bevelled geometric numerals on 3D drums.
   Glyphs: 0-9 . - + × % /  (x and * map to ×). Each character slot is a drum; digits roll like
   a slot machine / odometer (neighbouring digits ride the drum surface and fade out).
   opts:
     size=1 (cap height)   depth=0.24 (×size)   bevel=0.022 (×size)   tracking=0.035 (×size)
     material='brand'|'chrome'|'gold'|'glass' (smoked glass: opaque, iridescent, fresnel-lit)   colors=[jade, steel, violet] (brand gradient, left→right)
     maxChars=8   align='center'|'left'|'right'   drumRadius=1.35 (×size)   spins=1 (extra turns per roll)
     stagger=0.14 (per-slot delay fraction)   castShadow=true   text='0' (used when params.text omitted)
   update(params):
     text        string to show (right-aligned against rollFrom when rolling)
     reveal=1    0..1 per-digit rise (glyphs stand up from lying-back, staggered left→right)
     rollFrom    null | string/number: roll each slot from this string to `text`
     roll        0..1 roll progress (default: reveal when rollFrom set). Reels stop left→right.
     glint=null  0..1 position of a specular light sweep across the text (null = off)
     float=0     amplitude of a gentle bob driven by t      t=0 seconds
   extras: measure(text) → width (world units)
   anchors: center, top, bottom, left, right
   ===================================================================================== */
export function createDigits3D(THREE, opts = {}) {
  const o = { size: 1, depth: 0.24, bevel: 0.022, material: 'brand', maxChars: 8, align: 'center', tracking: 0.035, drumRadius: 1.35, spins: 1, stagger: 0.14, colors: [0x2bae7e, 0x5d86c0, 0x8a5cf0], castShadow: true, text: '0', ...opts };
  const S = o.size, R = o.drumRadius * S;
  const CHARS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '-', '+', '×', '%', '/'];
  const norm = (c) => (c === 'x' || c === '*' ? '×' : CHARS.includes(c) ? c : ' ');
  const isDigit = (c) => c >= '0' && c <= '9';
  const advOf = (c) => (c === '\0' ? 0 : (GLYPH_DEFS[c] || GLYPH_DEFS[' ']).adv * S);
  const geos = {}; for (const c of CHARS) geos[c] = glyphGeometry(THREE, c, { size: S, depth: o.depth, bevel: o.bevel });
  const root = new THREE.Group(); root.name = 'Digits3D';
  const anchors = {};
  const C = o.colors.map((h) => new THREE.Color(h));
  const kind = o.material;
  const shared = {
    uX0: { value: 0 }, uX1: { value: 1 }, uGlintX: { value: -99 }, uGlint: { value: 0 }, uSize: { value: S },
    uC0: { value: C[0] }, uC1: { value: C[1] || C[0] }, uC2: { value: C[2] || C[1] || C[0] },
    uTint: { value: kind === 'brand' ? 1 : 0 }, uEmis: { value: kind === 'brand' ? 0.1 : kind === 'glass' ? 0.1 : 0 }, uRim: { value: kind === 'brand' ? 0.35 : kind === 'glass' ? 1.6 : 0.05 },
  };
  const makeMat = () => {
    let m;
    if (kind === 'glass') m = new THREE.MeshPhysicalMaterial({ color: 0x23203a, metalness: 0.05, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.55, iridescenceIOR: 1.3, specularIntensity: 1 }); // smoked glass: opaque + fresnel (no transmission pass → deterministic)
    else if (kind === 'chrome') m = new THREE.MeshPhysicalMaterial({ color: 0xeef0f5, metalness: 1, roughness: 0.08, clearcoat: 0.4 });
    else if (kind === 'gold') m = new THREE.MeshPhysicalMaterial({ color: BRAND.gold, metalness: 1, roughness: 0.2, clearcoat: 0.4 });
    else m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.6, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06 });
    const u = { uSlotX: { value: 0 } };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, shared, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uSlotX; uniform float uSize; varying vec2 vTP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n vTP = vec2(position.x + uSlotX, position.y + 0.5 * uSize);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform float uX0; uniform float uX1; uniform float uGlintX; uniform float uGlint; uniform float uSize; uniform float uEmis; uniform float uRim; uniform float uTint;
        uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; varying vec2 vTP;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
        float ymG = clamp((vTP.x - uX0) / max(uX1 - uX0, 1e-3), 0.0, 1.0);
        ymG = clamp(ymG * 0.82 + clamp(vTP.y / uSize, 0.0, 1.0) * 0.18, 0.0, 1.0);
        vec3 ymC = ymG < 0.5 ? mix(uC0, uC1, ymG * 2.0) : mix(uC1, uC2, ymG * 2.0 - 1.0);
        diffuseColor.rgb *= mix(vec3(1.0), ymC, uTint);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 vd = normalize(vViewPosition);
          float fr = pow(1.0 - clamp(abs(dot(normal, vd)), 0.0, 1.0), 3.0);
          totalEmissiveRadiance += ymC * (uEmis + fr * uRim);
          float gl = exp(-pow((vTP.x + vTP.y * 0.45 - uGlintX) / (0.16 * uSize), 2.0)) * uGlint;
          totalEmissiveRadiance += vec3(1.0, 0.98, 1.0) * gl * 1.1;
        }`);
    };
    m.customProgramCacheKey = () => 'ym3d-digits-' + kind;
    return { m, u };
  };
  const slots = [];
  for (let s = 0; s < o.maxChars; s++) {
    const g = new THREE.Group(); root.add(g);
    const { m, u } = makeMat(), meshes = {};
    for (const c of CHARS) { const mesh = new THREE.Mesh(geos[c], m); mesh.castShadow = o.castShadow; mesh.receiveShadow = false; mesh.visible = false; g.add(mesh); meshes[c] = mesh; }
    slots.push({ g, m, u, meshes });
  }
  for (const n of ['center', 'top', 'bottom', 'left', 'right']) mkAnchor(THREE, root, n, anchors);
  const xsA = new Float32Array(o.maxChars), xsB = new Float32Array(o.maxChars), A = new Array(o.maxChars), B = new Array(o.maxChars);
  const layoutInto = (chars, n, out) => {
    let x = 0;
    for (let i = 0; i < n; i++) { const a = advOf(chars[i]); out[i] = x + a / 2; x += a + (a > 0 ? o.tracking * S : 0); }
    const w = Math.max(0, x - o.tracking * S), off = o.align === 'left' ? 0 : o.align === 'right' ? -w : -w / 2;
    for (let i = 0; i < n; i++) out[i] += off;
    return w;
  };
  const offOf = (w) => (o.align === 'left' ? 0 : o.align === 'right' ? -w : -w / 2);
  const fill = (str, n, out) => { const cs = Array.from(String(str)).map(norm).slice(0, o.maxChars); const pad = n - cs.length; for (let i = 0; i < n; i++) out[i] = i < pad ? '\0' : cs[i - pad]; return cs.length; };
  const measure = (text) => { const cs = Array.from(String(text)).map(norm); let x = 0; cs.forEach((c) => (x += advOf(c) + o.tracking * S)); return Math.max(0, x - o.tracking * S); };
  const place = (mesh, y, z, rx, s) => { mesh.visible = s > 1e-3; mesh.position.set(0, y, z); mesh.rotation.set(rx, 0, 0); mesh.scale.setScalar(Math.max(1e-3, s)); };
  const A40 = 33 * DEG; // neighbours sit at 36° → hidden at rest
  const showDrum = (slot, v, yOff, rx, sc) => {
    for (let d = 0; d < 10; d++) {
      const w = ((((d - v) % 10) + 15) % 10) - 5, a = w * 36 * DEG;
      const mesh = slot.meshes[String(d)];
      if (Math.abs(a) >= A40) { mesh.visible = false; continue; }
      const f = Math.pow(clamp(1 - Math.abs(a) / A40), 0.75);
      place(mesh, -R * Math.sin(a) + yOff, R * Math.cos(a) - R, a + rx, sc * f);
    }
  };

  const _pp = {}; function update(params = {}) { params = finiteParams(params, _pp);
    const t = params.t ?? 0, text = params.text ?? o.text;
    const hasRoll = params.rollFrom != null;
    const nTo = Array.from(String(text)).slice(0, o.maxChars).length, nFrom = hasRoll ? Array.from(String(params.rollFrom)).slice(0, o.maxChars).length : 0;
    const n = Math.max(nTo, nFrom);
    fill(text, n, B); if (hasRoll) fill(params.rollFrom, n, A);
    const wB = layoutInto(B, n, xsB), wA = hasRoll ? layoutInto(A, n, xsA) : wB;
    const rollP = hasRoll ? clamp(params.roll ?? params.reveal ?? 1) : 1;
    const appear = hasRoll ? (params.roll != null ? clamp(params.reveal ?? 1) : 1) : clamp(params.reveal ?? 1);
    const lk = ease.inOut(rollP), W = lerp(wA, wB, lk), x0 = lerp(offOf(wA), offOf(wB), lk);
    shared.uX0.value = x0; shared.uX1.value = x0 + W;
    shared.uGlint.value = params.glint == null ? 0 : 1;
    shared.uGlintX.value = x0 - 0.8 * S + clamp(params.glint ?? 0) * (W + 1.6 * S);
    const st = n > 1 ? Math.min(o.stagger, 0.6 / (n - 1)) : 0, span = 1 - (n - 1) * st;
    const flt = (params.float ?? 0) * S;
    for (let s = 0; s < o.maxChars; s++) {
      const slot = slots[s];
      for (const c of CHARS) slot.meshes[c].visible = false;
      if (s >= n) { slot.g.visible = false; continue; }
      slot.g.visible = true;
      const x = hasRoll ? lerp(xsA[s], xsB[s], lk) : xsB[s];
      slot.g.position.set(x, S / 2 + flt * Math.sin(t * 1.3 + s * 0.7), 0); slot.u.uSlotX.value = x;
      const r = clamp((appear - s * st) / span), e = ease.out(r);
      const yOff = -(1 - e) * 0.8 * S, rx = -(1 - e) * 1.25, sc = r <= 0 ? 0 : lerp(0.35, 1, backOut(r, 1.4));
      const b = B[s];
      if (!hasRoll) {
        if (isDigit(b)) showDrum(slot, +b, yOff, rx, sc);
        else if (b !== '\0' && b !== ' ') place(slot.meshes[b], yOff, 0, rx, sc);
        continue;
      }
      const rs = ease.inOut(clamp((rollP - s * st) / span)), a = A[s];
      if (isDigit(a) && isDigit(b)) {
        const v = +a + ((((+b - +a) % 10) + 10) % 10 + 10 * o.spins) * rs;
        showDrum(slot, v, yOff, rx, sc);
      } else {
        const c = rs < 0.5 ? a : b, k = rs < 0.5 ? 1 - rs * 2 : (rs - 0.5) * 2;
        if (c !== '\0' && c !== ' ') {
          if (isDigit(c)) showDrum(slot, +c, yOff, rx + (1 - k) * (rs < 0.5 ? -0.9 : 0.9), sc * k);
          else place(slot.meshes[c], yOff, 0, rx + (1 - k) * (rs < 0.5 ? -0.9 : 0.9), sc * k);
        }
      }
    }
    const cxm = x0 + W / 2;
    anchors.center.position.set(cxm, S / 2, 0); anchors.top.position.set(cxm, S * 1.2, 0); anchors.bottom.position.set(cxm, -0.18 * S, 0);
    anchors.left.position.set(x0 - 0.12 * S, S / 2, 0); anchors.right.position.set(x0 + W + 0.12 * S, S / 2, 0);
    for (const k of ['center', 'top', 'bottom', 'left', 'right']) anchors[k].userData.visible = appear > 0.5 && n > 0;
  }
  update({});
  return { object3d: root, anchors, update, measure, view: { target: [0, 0.5 * S, 0], radius: 7.5 * S, azimuth: 0.25, elevation: 0.12 }, dispose() { disposeTree(root); } };
}

/* =====================================================================================
   7 · createParticleNumber(THREE, opts) — N seeded particles assemble into a glyph string.
   opts: text='212', count=7000, size=1.4 (cap height), depth=0.16, seed=7, scatter=2.6 (cloud radius),
         pointSize=0.026 (world), edge=0.35 (fraction of particles on outlines — crisp edges),
         colors=[mint, violet] (left→right), points=null (Float32Array xyz targets overrides text)
   update(params): assemble 0..1 (0 = drifting cloud, 1 = number; per-particle staggered, swirling path),
                   t seconds (drift, breathing, twinkle), opacity=1
   anchors: center, top
   ===================================================================================== */
export function createParticleNumber(THREE, opts = {}) {
  const o = { text: '212', count: 7000, size: 1.4, depth: 0.16, seed: 7, scatter: 2.6, pointSize: 0.026, edge: 0.35, colors: [BRAND.mint, BRAND.violet], points: null, ...opts };
  const r = rng(o.seed), N = o.count;
  const target = new Float32Array(N * 3), scat = new Float32Array(N * 3), rnd = new Float32Array(N * 4);
  let width = 1;
  if (o.points) { for (let i = 0; i < N; i++) { const k = (i % (o.points.length / 3)) * 3; target[i * 3] = o.points[k]; target[i * 3 + 1] = o.points[k + 1]; target[i * 3 + 2] = o.points[k + 2]; } width = 2; }
  else {
    const { polys, width: w } = glyphOutlines(o.text, { tracking: 0.07 }); width = w * o.size;
    const inside = (x, y) => polys.some((p) => pointInPoly(x, y, p.outer) && !p.holes.some((h) => pointInPoly(x, y, h)));
    const edges = []; let tot = 0;
    for (const p of polys) for (const ring of [p.outer, ...p.holes]) for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); edges.push([a, b, tot, l]); tot += l; }
    const nEdge = Math.round(N * o.edge);
    for (let i = 0; i < N; i++) {
      let x, y;
      if (i < nEdge) {
        const d = r() * tot; let lo = 0, hi = edges.length - 1;
        while (lo < hi) { const m = (lo + hi + 1) >> 1; if (edges[m][2] <= d) lo = m; else hi = m - 1; }
        const [a, b, s0, l] = edges[lo], f = (d - s0) / (l || 1); x = lerp(a[0], b[0], f); y = lerp(a[1], b[1], f);
      } else { let k = 0; do { x = r() * w; y = r(); k++; } while (!inside(x, y) && k < 200); }
      target[i * 3] = (x - w / 2) * o.size; target[i * 3 + 1] = (y - 0.5) * o.size; target[i * 3 + 2] = (r() - 0.5) * o.depth * o.size * (i < nEdge ? 0.7 : 1);
    }
  }
  for (let i = 0; i < N; i++) {
    const u = r() * 2 - 1, ph = r() * TAU, rad = o.scatter * (0.3 + 0.7 * Math.cbrt(r())), sq = Math.sqrt(1 - u * u);
    scat[i * 3] = rad * sq * Math.cos(ph); scat[i * 3 + 1] = rad * u * 0.55; scat[i * 3 + 2] = rad * sq * Math.sin(ph) * 0.8;
    rnd[i * 4] = r(); rnd[i * 4 + 1] = r(); rnd[i * 4 + 2] = r(); rnd[i * 4 + 3] = r();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(target, 3)); geo.setAttribute('aScatter', new THREE.BufferAttribute(scat, 3)); geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), o.scatter * 1.3);
  const U = { uAssemble: { value: 1 }, uTime: { value: 0 }, uScale: { value: 800 }, uSize: { value: o.pointSize }, uWidth: { value: width }, uA: { value: new THREE.Color(o.colors[0]) }, uB: { value: new THREE.Color(o.colors[1]) }, uOpacity: { value: 1 } };
  const mat = fxMat(THREE, U, `
    attribute vec3 aScatter; attribute vec4 aRand;
    uniform float uAssemble, uTime, uScale, uSize, uWidth; uniform vec3 uA, uB;
    varying vec3 vCol; varying float vAl;
    void main(){
      float d = aRand.x * 0.42;
      float k = clamp((uAssemble - d) / 0.58, 0.0, 1.0);
      k = k * k * (3.0 - 2.0 * k);
      float ang = uTime * (0.08 + 0.12 * aRand.y) + aRand.z * 6.2831853;
      vec3 s = aScatter + 0.18 * vec3(sin(ang * 1.3), cos(ang), sin(ang * 0.7 + 1.0));
      vec3 tg = position + 0.005 * vec3(sin(uTime * 2.1 + aRand.w * 40.0), cos(uTime * 1.7 + aRand.y * 30.0), sin(uTime * 1.3 + aRand.z * 20.0));
      vec3 p = mix(s, tg, k);
      float sw = (1.0 - k) * (1.4 + aRand.y * 1.2);
      float cs = cos(sw), sn = sin(sw);
      p.xz = mat2(cs, -sn, sn, cs) * p.xz;
      p.y += sin(k * 3.14159) * (aRand.w - 0.5) * 0.6;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = uSize * mix(1.1 + 1.5 * aRand.w, 1.0 + 0.5 * aRand.w, k) * uScale / -mv.z;
      float gx = clamp(position.x / max(uWidth, 1e-3) + 0.5, 0.0, 1.0);
      vCol = mix(mix(uA, uB, gx), mix(uB, vec3(0.75, 0.8, 1.0), 0.3), (1.0 - k) * 0.6);
      vAl = mix(0.16 + 0.26 * aRand.y, 1.0, k) * (0.72 + 0.28 * sin(uTime * 3.0 + aRand.z * 50.0));
    }`, `
    uniform float uOpacity; varying vec3 vCol; varying float vAl;
    void main(){
      float d = length(gl_PointCoord - 0.5) * 2.0;
      float a = smoothstep(1.0, 0.0, d); a = a * a * 1.3;
      gl_FragColor = vec4(vCol * a * vAl * uOpacity, 1.0);
      ${GLSL_OUT}
    }`);
  const points = new THREE.Points(geo, mat); points.onBeforeRender = pointScaleHook(THREE, mat);
  const root = new THREE.Group(); root.name = 'ParticleNumber'; root.add(points);
  const anchors = {}; mkAnchor(THREE, root, 'center', anchors); mkAnchor(THREE, root, 'top', anchors);
  anchors.top.position.set(0, o.size * 0.62, 0);
  const _pp = {}; function update(params = {}) { params = finiteParams(params, _pp); U.uAssemble.value = clamp(params.assemble ?? 1); U.uTime.value = params.t ?? 0; U.uOpacity.value = params.opacity ?? 1; anchors.center.userData.visible = anchors.top.userData.visible = U.uAssemble.value > 0.85; }
  update({});
  return { object3d: root, anchors, update, view: { target: [0, 0, 0], radius: 6.5, azimuth: 0.2, elevation: 0.1 }, dispose() { disposeTree(root); } };
}

/* =====================================================================================
   5 · createShieldRings3D(THREE, opts) — 7 nested glowing rings + fresnel shells (layered safety).
   Nested = gyroscope of rings around a glowing core; explode → the rings lay flat as a stacked tower
   (inner ring on top, outer at the bottom) so each layer can carry a DOM label.
   opts: count=7, r0=0.42 (inner radius), dr=0.185 (radius step), tube=0.016, gap=0.34 (stack spacing),
         colors (array of hex per ring, default mint → cool → violet), core=true, shells=true
   update(params):
     active=count   number (fractional) of lit rings, lighting from the inside out (ring i level = active − i)
     levels=null    explicit array of 0..1 per ring (overrides active)
     focus=null     ring index to emphasise (others dim)
     explode=0      0 nested gyroscope … 1 stacked tower          t=0 seconds (ring spin / precession)
   anchors: ring0 … ring{n−1} (outer-right point of each ring), core
   ===================================================================================== */
export function createShieldRings3D(THREE, opts = {}) {
  const o = { count: 7, r0: 0.42, dr: 0.185, tube: 0.016, gap: 0.34, colors: null, core: true, shells: true, ...opts };
  const n = o.count;
  const mint = new THREE.Color(BRAND.mint), cool = new THREE.Color(BRAND.cool), violet = new THREE.Color(BRAND.violet);
  const cols = o.colors ? o.colors.map((h) => new THREE.Color(h)) : Array.from({ length: n }, (_, i) => { const f = n > 1 ? i / (n - 1) : 0; return f < 0.5 ? mint.clone().lerp(cool, f * 2) : cool.clone().lerp(violet, f * 2 - 1); });
  const root = new THREE.Group(); root.name = 'ShieldRings3D';
  const anchors = {};
  const vtx = `varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
  const rings = [];
  const halos = createHalos(THREE, 2 + n); root.add(halos.mesh);
  for (let i = 0; i < n; i++) {
    const R = o.r0 + i * o.dr, g = new THREE.Group(); root.add(g);
    const metal = new THREE.MeshPhysicalMaterial({ color: 0xd9dce1, metalness: 1, roughness: 0.26, clearcoat: 0.5, clearcoatRoughness: 0.2, emissive: 0x000000 });
    const torus = new THREE.Mesh(new THREE.TorusGeometry(R, o.tube, 14, 220), metal); torus.castShadow = true; g.add(torus);
    const trU = { uCol: { value: new THREE.Color() }, uOpacity: { value: 1 }, uR0: { value: R - o.tube * 3.8 }, uR1: { value: R - o.tube * 1.5 }, uSeg: { value: 18 + i * 8 } };
    const track = new THREE.Mesh(new THREE.RingGeometry(R - o.tube * 3.8, R - o.tube * 1.5, 256, 1), fxMat(THREE, trU, vtx, `
      uniform vec3 uCol; uniform float uOpacity; uniform float uR0; uniform float uR1; uniform float uSeg; varying vec3 vP;
      void main(){ float a = atan(vP.y, vP.x) / 6.2831853 + 0.5; float dash = step(0.3, fract(a * uSeg));
        float rr = (length(vP.xy) - uR0) / (uR1 - uR0); float e = smoothstep(0.0, 0.35, rr) * smoothstep(1.0, 0.65, rr);
        gl_FragColor = vec4(uCol * (0.2 + 0.8 * dash) * e * uOpacity, 1.0); ${GLSL_OUT} }`));
    track.renderOrder = 5; g.add(track);
    const glU = { uCol: { value: new THREE.Color() }, uR: { value: R } };
    const glow = new THREE.Mesh(new THREE.RingGeometry(R - 0.13, R + 0.13, 256, 1), fxMat(THREE, glU, vtx, `
      uniform vec3 uCol; uniform float uR; varying vec3 vP;
      void main(){ float d = length(vP.xy) - uR; float a = exp(-pow(d / 0.018, 2.0)) * 0.35 + exp(-pow(d / 0.06, 2.0)) * 0.08; gl_FragColor = vec4(uCol * a, 1.0); ${GLSL_OUT} }`));
    glow.renderOrder = 4; g.add(glow);
    let shU = null, shell = null;
    if (o.shells) {
      shU = { uCol: { value: new THREE.Color() }, uOpacity: { value: 0 }, uR: { value: R } };
      shell = new THREE.Mesh(new THREE.SphereGeometry(R - 0.006, 72, 48), fxMat(THREE, shU, vtx, `
        uniform vec3 uCol; uniform float uOpacity; uniform float uR; varying vec3 vP; varying vec3 vN; varying vec3 vV;
        vec2 hexd(vec2 p){ vec2 q = vec2(p.x * 1.1547, p.y + p.x * 0.57735); vec2 pi = floor(q), pf = fract(q);
          float v = mod(pi.x + pi.y, 3.0); float ca = step(1.0, v), cb = step(2.0, v); vec2 ma = step(pf.xy, pf.yx);
          float e = dot(ma, 1.0 - pf.yx + ca * (pf.x + pf.y - 1.0) + cb * (pf.yx - 2.0 * pf.xy));
          return vec2(e, 0.0); }
        void main(){
          float fr = pow(1.0 - abs(dot(vN, vV)), 2.6);
          vec3 p = normalize(vP);
          vec2 sp = vec2(atan(p.z, p.x) * uR * 7.0, asin(clamp(p.y, -1.0, 1.0)) * uR * 7.0);
          float h = hexd(sp).x; float line = smoothstep(0.08, 0.0, h);
          float a = fr * (0.55 + 0.45 * line) + line * 0.05;
          gl_FragColor = vec4(uCol * a * uOpacity, 1.0); ${GLSL_OUT} }`));
      shell.renderOrder = 3; g.add(shell);
    }
    const plU = { uCol: { value: new THREE.Color() }, uOpacity: { value: 0 }, uR: { value: R } };
    const plate = new THREE.Mesh(new THREE.CircleGeometry(R - 0.02, 128), fxMat(THREE, plU, vtx, `
      uniform vec3 uCol; uniform float uOpacity; uniform float uR; varying vec3 vP;
      void main(){ float r = length(vP.xy) / uR; float a = 0.04 + smoothstep(0.55, 1.0, r) * 0.22 + smoothstep(0.02, 0.0, abs(fract(r * 6.0) - 0.5) - 0.47) * 0.05; gl_FragColor = vec4(uCol * a * uOpacity, 1.0); ${GLSL_OUT} }`));
    plate.renderOrder = 2; g.add(plate);
    rings.push({ R, g, metal, trU, glU, shU, shell, plU, plate });
    mkAnchor(THREE, root, 'ring' + i, anchors);
  }
  let core = null, coreMat = null;
  if (o.core) {
    coreMat = new THREE.MeshPhysicalMaterial({ color: 0x0c2a22, metalness: 0.2, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, emissive: new THREE.Color(BRAND.mint), emissiveIntensity: 0.5 });
    core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 48, 32), coreMat); core.castShadow = true; root.add(core);
  }
  mkAnchor(THREE, root, 'core', anchors);
  const e = new THREE.Euler(), qN = new THREE.Quaternion(), qE = new THREE.Quaternion(), qS = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), nrm = new THREE.Vector3(), px = new THREE.Vector3(), c = new THREE.Color();
  qE.setFromEuler(e.set(-Math.PI / 2, 0, 0));

  const _pp = {}; function update(params = {}) { params = finiteParams(params, _pp);
    const t = params.t ?? 0, ex = ease.inOut(clamp(params.explode ?? 0)), active = params.active ?? n, focus = params.focus;
    for (let i = 0; i < n; i++) {
      const rg = rings[i], sgn = i % 2 ? -1 : 1;
      let lv = params.levels ? clamp(params.levels[i] ?? 0) : clamp(active - i);
      if (focus != null && focus >= 0) lv *= i === focus ? 1.25 : 0.35;
      const flash = Math.sin(Math.PI * clamp(params.levels ? 0 : active - i)) * 0.9;
      qN.setFromEuler(e.set(sgn * (1.22 - i * 0.155), i * 0.9 + sgn * t * (0.16 + 0.04 * i), 0, 'YXZ'));
      qS.setFromAxisAngle(Z, sgn * t * (0.35 + 0.05 * i));
      rg.g.quaternion.copy(qN).slerp(qE, ex).multiply(qS);
      rg.g.position.set(0, ex * ((n - 1) / 2 - i) * o.gap, 0);
      const cc = cols[i];
      rg.metal.emissive.copy(cc).multiplyScalar(lv * 0.3 + flash * 0.3);
      rg.trU.uCol.value.copy(cc).multiplyScalar(0.06 + 1.1 * lv + flash);
      rg.glU.uCol.value.copy(cc).multiplyScalar(lv * 0.6 + flash * 0.8);
      if (rg.shU) { rg.shU.uCol.value.copy(cc); rg.shU.uOpacity.value = (lv * 0.07 + flash * 0.3) * (1 - ex); rg.shell.visible = rg.shU.uOpacity.value > 0.002; }
      rg.plU.uCol.value.copy(cc); rg.plU.uOpacity.value = ex * (0.2 + 0.8 * lv); rg.plate.visible = ex > 0.002;
      // anchor: rightmost point of the ring
      nrm.copy(Z).applyQuaternion(rg.g.quaternion);
      px.set(1, 0, 0).addScaledVector(nrm, -nrm.x); if (px.lengthSq() < 1e-6) px.set(0, 1, 0);
      px.normalize().multiplyScalar(rg.R + 0.03).add(rg.g.position);
      anchors['ring' + i].position.copy(px); anchors['ring' + i].userData.level = lv;
      halos.set(2 + i, px.x, px.y, px.z, 0.22, cc, flash * 0.9);
    }
    if (core) {
      const cs = Math.max(1e-3, 1 - ex);
      core.scale.setScalar(cs); core.visible = cs > 0.01;
      coreMat.emissiveIntensity = 0.45 + 0.15 * Math.sin(t * 2.2);
      halos.set(0, 0, 0, 0, 1.1 * cs, c.copy(cols[0]), 0.7 * cs); halos.set(1, 0, 0, 0, 0.45 * cs, c.setRGB(1, 1, 1), 0.5 * cs);
    }
    halos.commit();
    anchors.core.position.set(0, 0.28 * (1 - ex) + ex * ((n - 1) / 2 * o.gap + 0.3), 0);
  }
  update({});
  return { object3d: root, anchors, update, view: { target: [0, 0, 0], radius: 7.2, azimuth: 0.35, elevation: 0.3 }, dispose() { disposeTree(root); } };
}

/* =====================================================================================
   6 · createLock54(THREE, opts) — holographic "5+4" authentication around the disposable tip.
   5 nodes on an outer pentagon ring (五端激活: light one by one, draw the pentagon, beam to the core)
   + 4 concentric tilted verification rings (四维验真: each fills its arc then snaps flat)
   + radar sweep and a face scan-line while scanning. verified → mint, check mark, shock ring.
   opts: ringRadii=[0.58,0.7,0.82,0.94], ringWidth=0.04, outer=1.32, tip=true
   update(params):
     progress 0..1  (0–0.47 nodes 1→5 · 0.5–0.96 rings 1→4)     verified 0..1 (align, mint, check)
     t seconds      (sweep, scan-line, gyro wobble, data particles)
   anchors: node0…node4, ring0…ring3, tip, check
   ===================================================================================== */
function strokeGeometry(THREE, pts, w, depth, bevel) {
  const subs = splitSharp(pts, 2.45), parts = [];
  for (const sp of subs) {
    const { L, R } = offsetPolyline(sp, w / 2, false), outer = L.concat(R.slice().reverse());
    const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
    const eg = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 3 });
    eg.translate(0, 0, -(depth - 2 * bevel) / 2); parts.push(eg);
  }
  return creased(THREE, mergeGeos(THREE, parts), 38 * DEG);
}
export function createLock54(THREE, opts = {}) {
  const o = { ringRadii: [0.58, 0.7, 0.82, 0.94], ringWidth: 0.04, outer: 1.32, tip: true, ...opts };
  const root = new THREE.Group(); root.name = 'Lock54';
  const anchors = {};
  const mint = new THREE.Color(BRAND.mint), violet = new THREE.Color(BRAND.violet), cool = new THREE.Color(BRAND.cool), white = new THREE.Color(1, 1, 1);
  const vtx = `varying vec3 vP; varying vec2 vUv; void main(){ vP = position; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

  /* the disposable tip YM5-TP4-900: black body, gold frame, amber electrode face */
  const tipG = new THREE.Group(); root.add(tipG);
  let faceMat = null, scanLine = null, scanU = null;
  if (o.tip) {
    const body = new THREE.Mesh(roundedBoxGeo(THREE, 0.46, 0.46, 0.34, 0.06, 0.12), new THREE.MeshPhysicalMaterial({ color: 0x0c0c11, roughness: 0.3, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.06 }));
    body.castShadow = true; tipG.add(body);
    const fr = roundRectShape(THREE, 0.41, 0.41, 0.075); fr.holes.push(roundRectShape(THREE, 0.315, 0.315, 0.035));
    const frGeo = new THREE.ExtrudeGeometry(fr, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelOffset: -0.006, bevelSegments: 3, curveSegments: 8 });
    frGeo.translate(0, 0, 0.165);
    tipG.add(new THREE.Mesh(creased(THREE, frGeo, 40 * DEG), new THREE.MeshPhysicalMaterial({ color: 0xe0ac52, metalness: 1, roughness: 0.22, clearcoat: 0.4 })));
    const faceTex = canvasTexture(THREE, 256, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#7a4a18'); gr.addColorStop(0.5, '#a8671f'); gr.addColorStop(1, '#5a3410');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,214,150,0.55)'; g.lineWidth = 2;
      for (let y = 28; y < h - 20; y += 14) { g.beginPath(); g.moveTo(26, y); g.lineTo(w - 26, y); g.stroke(); }
      g.strokeStyle = 'rgba(255,230,180,0.8)'; g.lineWidth = 4; g.strokeRect(18, 18, w - 36, h - 36);
    });
    faceMat = new THREE.MeshPhysicalMaterial({ map: faceTex, roughness: 0.28, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: 0 });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.315, 0.315), faceMat); face.position.z = 0.172; tipG.add(face);
    scanU = { uCol: { value: new THREE.Color(0xbfe9ff) }, uOpacity: { value: 0 } };
    scanLine = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.05), fxMat(THREE, scanU, vtx, `uniform vec3 uCol; uniform float uOpacity; varying vec2 vUv;
      void main(){ float a = exp(-pow((vUv.y - 0.5) * 7.0, 2.0)) * smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x); gl_FragColor = vec4(uCol * a * uOpacity, 1.0); ${GLSL_OUT} }`));
    scanLine.position.z = 0.2; scanLine.renderOrder = 9; tipG.add(scanLine);
  }

  /* holo layer */
  const holo = new THREE.Group(); root.add(holo);
  const ringU = [], ringG = [];
  o.ringRadii.forEach((R, j) => {
    const g = new THREE.Group(); holo.add(g); ringG.push(g);
    const u = { uColA: { value: new THREE.Color() }, uColB: { value: new THREE.Color() }, uFill: { value: 0 }, uOpacity: { value: 1 }, uSeg: { value: 36 + j * 12 }, uR0: { value: R - o.ringWidth / 2 }, uR1: { value: R + o.ringWidth / 2 }, uTime: { value: 0 } };
    ringU.push(u);
    g.add(new THREE.Mesh(new THREE.RingGeometry(R - o.ringWidth / 2, R + o.ringWidth / 2, 256, 1), fxMat(THREE, u, vtx, `
      uniform vec3 uColA; uniform vec3 uColB; uniform float uFill; uniform float uOpacity; uniform float uSeg; uniform float uR0; uniform float uR1; uniform float uTime; varying vec3 vP;
      void main(){
        float r = length(vP.xy); float a01 = fract(0.25 - atan(vP.y, vP.x) / 6.2831853);
        float rr = (r - uR0) / (uR1 - uR0);
        float edge = smoothstep(0.0, 0.12, rr) * smoothstep(1.0, 0.88, rr);
        float rim = smoothstep(0.25, 0.0, rr) + smoothstep(0.75, 1.0, rr);
        float seg = step(0.22, fract(a01 * uSeg));
        float filled = step(a01, uFill);
        float head = exp(-pow((a01 - uFill) * 70.0, 2.0)) * step(0.001, uFill) * step(uFill, 0.999);
        float scan = 0.85 + 0.15 * sin(r * 260.0 - uTime * 5.0);
        vec3 col = mix(uColA, uColB, filled);
        float alpha = (0.16 * seg + filled * (0.75 * seg + 0.25) + rim * 0.25) * edge * scan + head * 1.8;
        gl_FragColor = vec4(col * alpha * uOpacity, 1.0); ${GLSL_OUT}
      }`)));
  });
  const outerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  holo.add(new THREE.Mesh(new THREE.TorusGeometry(o.outer, 0.006, 8, 256), outerMat));
  const tickU = { uCol: { value: new THREE.Color() }, uR0: { value: o.outer + 0.05 }, uR1: { value: o.outer + 0.12 } };
  const ticksM = new THREE.Mesh(new THREE.RingGeometry(o.outer + 0.05, o.outer + 0.12, 360, 1), fxMat(THREE, tickU, vtx, `
    uniform vec3 uCol; uniform float uR0; uniform float uR1; varying vec3 vP;
    void main(){ float a = atan(vP.y, vP.x) / 6.2831853 * 72.0; float f = abs(fract(a) - 0.5); float t = smoothstep(0.08, 0.02, 0.5 - f);
      float rr = (length(vP.xy) - uR0) / (uR1 - uR0); float major = step(0.5 - 0.5 / 6.0, abs(fract(a / 6.0) - 0.5)) ;
      float len = mix(0.45, 1.0, major); float on = t * step(rr, len);
      gl_FragColor = vec4(uCol * on * 0.8, 1.0); ${GLSL_OUT} }`));
  holo.add(ticksM);
  // nodes
  const nodeGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 6); nodeGeo.rotateX(Math.PI / 2);
  const nodeMat = new THREE.MeshPhysicalMaterial({ color: 0x3a3a4c, metalness: 0.9, roughness: 0.25, clearcoat: 1 });
  nodeMat.onBeforeCompile = (s) => { s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor * 0.55;'); };
  nodeMat.customProgramCacheKey = () => 'ym3d-lock-node';
  const nodes = new THREE.InstancedMesh(nodeGeo, nodeMat, 5); nodes.castShadow = true; nodes.frustumCulled = false; holo.add(nodes);
  const nodePos = Array.from({ length: 5 }, (_, k) => { const a = Math.PI / 2 - (k * TAU) / 5; return new THREE.Vector3(Math.cos(a) * o.outer, Math.sin(a) * o.outer, 0); });
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  nodePos.forEach((p, k) => { m4.makeTranslation(p.x, p.y, p.z); nodes.setMatrixAt(k, m4); nodes.setColorAt(k, violet); });
  // edges + spokes
  const lineGeo = new THREE.BoxGeometry(1, 0.011, 0.011); lineGeo.translate(0.5, 0, 0);
  const lineMat = fxMat(THREE, {}, `varying vec3 vC; void main(){
      #ifdef USE_INSTANCING_COLOR
        vC = instanceColor;
      #else
        vC = vec3(1.0);
      #endif
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`, `varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 1.0); ${GLSL_OUT} }`);
  const lines = new THREE.InstancedMesh(lineGeo, lineMat, 10); lines.frustumCulled = false; lines.renderOrder = 6;
  for (let k = 0; k < 10; k++) { lines.setColorAt(k, col.setRGB(0, 0, 0)); m4.makeScale(0, 0, 0); lines.setMatrixAt(k, m4); }
  holo.add(lines);
  // radar sweep
  const swU = { uCol: { value: new THREE.Color() }, uOpacity: { value: 0 } };
  const sweep = new THREE.Mesh(new THREE.CircleGeometry(o.outer - 0.04, 64, 0, 1.1), fxMat(THREE, swU, vtx, `
    uniform vec3 uCol; uniform float uOpacity; varying vec3 vP;
    void main(){ float a = clamp(atan(vP.y, vP.x) / 1.1, 0.0, 1.0); float r = length(vP.xy);
      float al = pow(a, 3.0) * 0.28 * smoothstep(0.3, 0.6, r) + smoothstep(0.985, 1.0, a) * 0.5 * smoothstep(0.2, 0.5, r);
      gl_FragColor = vec4(uCol * al * uOpacity, 1.0); ${GLSL_OUT} }`));
  sweep.renderOrder = 3; holo.add(sweep);
  // shock ring
  const shU = { uCol: { value: new THREE.Color(BRAND.mint) }, uOpacity: { value: 0 } };
  const shock = new THREE.Mesh(new THREE.RingGeometry(0.94, 1.0, 160, 1), fxMat(THREE, shU, vtx, `uniform vec3 uCol; uniform float uOpacity; varying vec2 vUv; void main(){ gl_FragColor = vec4(uCol * uOpacity, 1.0); ${GLSL_OUT} }`));
  shock.renderOrder = 8; holo.add(shock);
  // check mark
  const checkMat = new THREE.MeshPhysicalMaterial({ color: BRAND.mint, emissive: BRAND.mint, emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.2, clearcoat: 1 });
  const check = new THREE.Mesh(strokeGeometry(THREE, [[-0.13, 0.0], [-0.035, -0.095], [0.15, 0.11]], 0.055, 0.05, 0.01), checkMat);
  check.castShadow = true; root.add(check);
  const halos = createHalos(THREE, 5 + 10 + 2); root.add(halos.mesh);
  for (let k = 0; k < 5; k++) mkAnchor(THREE, root, 'node' + k, anchors);
  for (let j = 0; j < 4; j++) mkAnchor(THREE, root, 'ring' + j, anchors);
  mkAnchor(THREE, root, 'tip', anchors); mkAnchor(THREE, root, 'check', anchors);
  nodePos.forEach((p, k) => anchors['node' + k].position.copy(p).multiplyScalar(1.13));
  const e = new THREE.Euler(), v3 = new THREE.Vector3(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), cA = new THREE.Color(), cB = new THREE.Color(), act = new Float32Array(5);

  const _pp = {}; function update(params = {}) { params = finiteParams(params, _pp);
    const t = params.t ?? 0, pr = clamp(params.progress ?? 1), vf = clamp(params.verified ?? 0), ve = ease.inOut(vf);
    const holoCol = cA.copy(violet).lerp(cool, 0.35).lerp(mint, ve);
    for (let k = 0; k < 5; k++) act[k] = seg(pr, 0.03 + k * 0.085, 0.1 + k * 0.085, ease.out);
    const scanning = pr > 0 && vf < 1 ? (1 - ve) * smooth(pr * 12) : 0;
    // nodes
    for (let k = 0; k < 5; k++) {
      const a = act[k];
      col.copy(violet).multiplyScalar(0.35).lerp(cB.copy(mint).lerp(white, 0.15).multiplyScalar(2.2), a); nodes.setColorAt(k, col);
      const s = 1 + 0.25 * Math.sin(Math.PI * a);
      m4.makeScale(s, s, s); m4.setPosition(nodePos[k]); nodes.setMatrixAt(k, m4);
      halos.set(k, nodePos[k].x, nodePos[k].y, 0.04, 0.42, mint, a * (0.8 + 0.2 * Math.sin(t * 3 + k)));
    }
    nodes.instanceColor.needsUpdate = true; nodes.instanceMatrix.needsUpdate = true;
    // pentagon edges (k → k+1) and spokes (node → ring)
    for (let k = 0; k < 5; k++) {
      const a = nodePos[k], b = nodePos[(k + 1) % 5];
      const pe = k < 4 ? act[k + 1] : seg(pr, 0.44, 0.5);
      v3.subVectors(b, a); const len = v3.length(), ang = Math.atan2(v3.y, v3.x);
      q.setFromEuler(e.set(0, 0, ang)); s3.set(Math.max(1e-4, len * pe), 1, 1);
      m4.compose(a, q, s3); lines.setMatrixAt(k, pe > 0.001 ? m4 : m4.makeScale(0, 0, 0));
      lines.setColorAt(k, col.copy(holoCol).multiplyScalar(0.95 * pe));
      const sp = act[k], sLen = o.outer - 0.08 - (o.ringRadii[3] + 0.06);
      q.setFromEuler(e.set(0, 0, Math.atan2(-a.y, -a.x))); v3.copy(a).multiplyScalar((o.outer - 0.08) / o.outer); s3.set(Math.max(1e-4, sLen * sp), 1, 1);
      m4.compose(v3, q, s3); lines.setMatrixAt(5 + k, sp > 0.001 ? m4 : m4.makeScale(0, 0, 0));
      lines.setColorAt(5 + k, col.copy(holoCol).multiplyScalar(0.9 * sp * (1 - 0.5 * ve)));
      // data particles travelling inward along the spoke
      for (let m = 0; m < 2; m++) {
        const f = (t * 0.8 + m * 0.5 + k * 0.13) % 1, rr = lerp(o.outer - 0.1, o.ringRadii[3] + 0.06, f);
        halos.set(5 + k * 2 + m, (a.x / o.outer) * rr, (a.y / o.outer) * rr, 0.02, 0.16, mint, sp * Math.sin(Math.PI * f) * (1 - ve) * 0.9);
      }
    }
    lines.instanceMatrix.needsUpdate = true; lines.instanceColor.needsUpdate = true;
    // verification rings
    o.ringRadii.forEach((R, j) => {
      const v = seg(pr, 0.5 + j * 0.115, 0.6 + j * 0.115, ease.inOut), u = ringU[j];
      const flat = Math.max(ease.inOut(v), ve);
      const sgn = j % 2 ? -1 : 1;
      ringG[j].rotation.set((1 - flat) * sgn * (0.95 - j * 0.12) + (1 - flat) * 0.08 * Math.sin(t * 0.9 + j), (1 - flat) * (0.7 - j * 0.25) * -sgn + (1 - flat) * 0.08 * Math.cos(t * 0.7 + j), sgn * t * (0.25 + 0.06 * j) * (1 - ve));
      u.uFill.value = v; u.uTime.value = t; u.uOpacity.value = 1;
      u.uColA.value.copy(violet).lerp(cool, 0.3).multiplyScalar(0.8).lerp(mint, ve);
      u.uColB.value.copy(cool).lerp(mint, 0.35 + 0.65 * ve).multiplyScalar(1.3);
      v3.set(Math.cos(-35 * DEG) * (R + 0.05), Math.sin(-35 * DEG) * (R + 0.05), 0).applyEuler(ringG[j].rotation);
      anchors['ring' + j].position.copy(v3); anchors['ring' + j].userData.level = v;
    });
    outerMat.color.copy(holoCol).multiplyScalar(1.2 + 0.6 * ve);
    tickU.uCol.value.copy(holoCol).multiplyScalar(0.8);
    sweep.visible = scanning > 0.001; sweep.rotation.z = t * 2.2; swU.uOpacity.value = scanning; swU.uCol.value.copy(cool).lerp(violet, 0.3);
    // shock + check
    const sk = seg(vf, 0.1, 0.95, ease.out);
    shock.visible = vf > 0.01 && vf < 0.999; shock.scale.setScalar(0.4 + sk * 1.35); shU.uOpacity.value = Math.pow(1 - sk, 1.5) * 1.2;
    const ck = seg(vf, 0.3, 0.85, (x) => backOut(x, 1.6));
    check.visible = ck > 0.001; check.scale.setScalar(Math.max(1e-3, ck * 1.35)); check.position.set(0, 0, 0.3 + (1 - ck) * 0.2); check.rotation.set(0, (1 - ck) * -1.2, 0);
    halos.set(15, 0, 0, 0.3, 0.9, mint, ck * 0.7); halos.set(16, 0, 0, 0, 1.6, holoCol, 0.25 + 0.2 * ve);
    // tip
    tipG.rotation.set(0.12 * Math.sin(t * 0.4), 0.28 * Math.sin(t * 0.33), 0);
    if (faceMat) faceMat.emissiveIntensity = 0.05 + scanning * 0.35 + ve * 0.15;
    if (scanLine) { const tri = Math.abs(((t * 0.55) % 1) * 2 - 1); scanLine.position.y = lerp(-0.17, 0.17, tri); scanU.uOpacity.value = scanning * 1.3; scanLine.visible = scanning > 0.001; }
    halos.commit();
    anchors.tip.position.set(0, 0.36, 0.2); anchors.check.position.set(0.24, 0.16, 0.3); anchors.check.userData.visible = ck > 0.5;
  }
  update({});
  return { object3d: root, anchors, update, view: { target: [0, 0, 0], radius: 6.4, azimuth: 0.42, elevation: 0.22 }, dispose() { disposeTree(root); } };
}

/* =====================================================================================
   8 · createMedallions(THREE, opts) — brushed-metal coins with image faces (clinical centres).
   COMPLIANCE: hospital / university seals used as endorsement are not allowed in the PUBLIC site or video
   (审查办法第十一条, 知识库 §11.1). Professional edition only, after brand + legal sign-off; otherwise feed neutral
   textures (e.g. city names or "多中心临床试验" icons).
   opts: textures=[] (THREE.Texture | HTMLImageElement | HTMLCanvasElement | ImageBitmap; loaded
         BEFORE creation — host-owned Textures are not disposed), count (default textures.length || 4),
         radius=0.5, thickness=0.11, spacing=1.3, curve=0.12 (concave arc depth), faceScale=1.04 (crop zoom),
         rimColor=silver, accent=violet (inner glow ring)
   update(params): reveal 0..1 (coins spin in from edge-on, staggered), focus=null (index brought forward),
                   glint=null (0..1 light sweep, default derived from t), t seconds (float / sway)
   anchors: coin0… (label point under each coin), coinTop0…
   ===================================================================================== */
export function createMedallions(THREE, opts = {}) {
  const o = { textures: [], count: null, radius: 0.5, thickness: 0.13, spacing: 1.3, curve: 0.12, faceScale: 1.04, rimColor: 0xd9dce1, accent: BRAND.violet, ...opts };
  const n = o.count ?? (o.textures.length || 4);
  const root = new THREE.Group(); root.name = 'Medallions';
  const anchors = {}, keep = new Set();
  const Rr = o.radius, T = o.thickness, b = 0.032, faceR = Rr - 0.092, faceZ = T / 2 - 0.034;
  // lathe profile (x = radius, y = axis), revolved and turned to face +z
  const prof = [];
  prof.push(new THREE.Vector2(0.0005, -T / 2));
  for (let k = 0; k <= 6; k++) { const a = -Math.PI / 2 + (k / 6) * (Math.PI / 2); prof.push(new THREE.Vector2(Rr - b + b * Math.cos(a), -T / 2 + b + b * Math.sin(a))); }
  for (let k = 0; k <= 6; k++) { const a = (k / 6) * (Math.PI / 2); prof.push(new THREE.Vector2(Rr - b + b * Math.cos(a), T / 2 - b + b * Math.sin(a))); }
  prof.push(new THREE.Vector2(Rr - 0.066, T / 2), new THREE.Vector2(Rr - 0.074, T / 2 - 0.006), new THREE.Vector2(faceR + 0.006, faceZ + 0.004), new THREE.Vector2(faceR, faceZ), new THREE.Vector2(0.0005, faceZ));
  const lathe = new THREE.LatheGeometry(prof, 160); lathe.rotateX(Math.PI / 2);
  const coinGeo = creased(THREE, lathe, 32 * DEG);
  const rimMat = new THREE.MeshPhysicalMaterial({ color: o.rimColor, metalness: 1, roughness: 0.24, anisotropy: 0.9, clearcoat: 0.4, clearcoatRoughness: 0.12 });
  const accentMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(o.accent).multiplyScalar(1.5), toneMapped: false });
  const accentGeo = new THREE.TorusGeometry(faceR + 0.006, 0.0045, 8, 160); accentGeo.translate(0, 0, faceZ + 0.003);
  const coins = [];
  const toTex = (src, i) => {
    if (src && src.isTexture) { keep.add(src); return src; }
    if (src) { const tx = new THREE.Texture(src); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; tx.needsUpdate = true; return tx; }
    return canvasTexture(THREE, 256, 256, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); gr.addColorStop(0, '#2a2f48'); gr.addColorStop(1, '#0d0f18'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#cfd4ea'; g.font = `600 96px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), w / 2, h / 2); });
  };
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group(); root.add(g);
    const coin = new THREE.Mesh(coinGeo, rimMat); coin.castShadow = true; coin.receiveShadow = true; g.add(coin);
    const map = toTex(o.textures[i], i);
    const img = map.image || {}, ar = img.width && img.height ? img.width / img.height : 1;
    const fg = new THREE.CircleGeometry(faceR, 96); const uv = fg.attributes.uv;
    for (let k = 0; k < uv.count; k++) { let u = uv.getX(k), v = uv.getY(k); u = 0.5 + (u - 0.5) / o.faceScale; v = 0.5 + (v - 0.5) / o.faceScale; if (ar > 1) u = 0.5 + (u - 0.5) / ar; else v = 0.5 + (v - 0.5) * ar; uv.setXY(k, u, v); }
    fg.translate(0, 0, faceZ + 0.0012);
    const fu = { uGlint: { value: -1 } };
    const fm = new THREE.MeshPhysicalMaterial({ map, roughness: 0.42, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.04, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.1 });
    fm.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, fu);
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uGlint;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(1.0) * exp(-pow((vMapUv.x + (1.0 - vMapUv.y) - uGlint) * 6.0, 2.0)) * 0.22;');
    };
    fm.customProgramCacheKey = () => 'ym3d-medal-face';
    const face = new THREE.Mesh(fg, fm); face.receiveShadow = true; g.add(face);
    g.add(new THREE.Mesh(accentGeo, accentMat));
    coins.push({ g, fm, fu });
    mkAnchor(THREE, root, 'coin' + i, anchors); mkAnchor(THREE, root, 'coinTop' + i, anchors);
  }
  const _pp = {}; function update(params = {}) { params = finiteParams(params, _pp);
    const t = params.t ?? 0, reveal = clamp(params.reveal ?? 1), focus = params.focus;
    for (let i = 0; i < n; i++) {
      const c = coins[i], k = i - (n - 1) / 2;
      const r = seg(reveal, i * 0.12, i * 0.12 + 0.56, ease.linear), e = ease.out(r);
      const f = focus != null && focus >= 0 ? (i === focus ? 1 : -1) : 0;
      const x = k * o.spacing, z = o.curve * k * k + (f > 0 ? 0.3 : 0), y = -(1 - e) * 0.5 + 0.025 * Math.sin(t * 1.1 + i * 1.4);
      c.g.position.set(x, y, z);
      c.g.rotation.set(0.04 * Math.sin(t * 0.8 + i), -k * 0.16 - (1 - e) * Math.PI * 1.5 + 0.07 * Math.sin(t * 0.6 + i * 1.1), 0);
      const s = r <= 0 ? 1e-3 : lerp(0.55, 1, backOut(r, 1.3)) * (f > 0 ? 1.12 : f < 0 ? 0.94 : 1);
      c.g.scale.setScalar(s); c.g.visible = r > 0;
      c.fm.emissiveIntensity = f < 0 ? 0.03 : 0.1;
      const gl = params.glint != null ? params.glint : ((t * 0.28 + i * 0.13) % 1.6) / 1.6;
      c.fu.uGlint.value = lerp(-0.4, 2.4, gl);
      anchors['coin' + i].position.set(x, y - Rr * s - 0.16, z); anchors['coinTop' + i].position.set(x, y + Rr * s + 0.12, z);
      anchors['coin' + i].userData.visible = anchors['coinTop' + i].userData.visible = r > 0.6;
    }
  }
  update({});
  return { object3d: root, anchors, update, view: { target: [0, 0, 0.2], radius: 6.2, azimuth: 0.08, elevation: 0.16 }, dispose() { disposeTree(root, keep); } };
}
