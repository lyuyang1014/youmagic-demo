// YM3D · gate — design-lineage transition: 清华园二校门 (Tsinghua old gate) → YM5-G1 console.
//   The console's stadium tower with its violet-lit recessed front and round screen was inspired by the
//   gate's semicircular arched doorway. This component tells that story in 3D: a white stylised 二校门
//   stands on the stage → Tsinghua purple (清华紫 #660874) light floods the doorway → the arch outline
//   ignites, lifts off the stone and morphs (matched arc-length resampling) into the console's stadium
//   rim light + round screen ring, while the stone dissolves in purple embers → the real createDevice()
//   model materialises inside the glowing outline (stone-white → brushed silver) and the purple settles
//   into the brand violet. 纯设计灵感示意 — no endorsement text other than the gate's own plaque 清華園.
//
// Contract (README.md): ES module, NO imports, THREE (r170) injected; update(params) is a pure,
// deterministic function of params (no clocks / Math.random / rAF), no per-frame allocation.
// Units: metres, +Y up, gate façade faces +Z, origin = floor centre of the doorway — the SAME frame as
// createDevice() (device origin = floor centre under the tower), so a device at the origin stands in the
// doorway and its front rim lies in the gate's façade plane.
//
// ─────────────────────────────── createGateMorph(THREE, opts) ───────────────────────────────
// opts (all optional):
//   tsinghuaPurple 0x660874   official Tsinghua purple (light / glow hue of the first half)
//   deviceViolet   0x8a5cf0   brand violet the glow shifts to as the morph completes
//   rimViolet      0x6a4896   device rim-strip colour (edge glow while the device materialises)
//   deviceDims     createDevice(...).dims — morph target (rim stadium + screen ring) is computed from it;
//                  omitted → built-in copy of device.mjs DIM (identical numbers)
//   deviceTransform { position:[x,y,z], rotationY:0, scale:1 } where the device stands, in gate-local space
//                  (default: origin — in the doorway). Use placeDevice(device.object3d) to apply it.
//   detail 'high'|'low' ('high') · castShadow true · lights true (3 purple lights, intensity 0 until purple>0)
//   haze true · embers 1400 (0 = off) · portal true (purple backlight behind the doorway + streaky light hood
//   spilling out of it) · floorGlow true (purple light pool on the floor in front of the doorway)
//   plaqueFont  CSS font-family list for 清華園 (default Kaiti SC / STKaiti / BiauKai / KaiTi … serif)
// → { object3d, update(params), dispose(), anchor(name,out?), anchorNames, view, views, cameraAt(u,out?),
//     sequence(u,out?), deviceBlend(params,out?), devicePlacement, placeDevice(obj), bindDevice(device),
//     unbindDevice(), curves, parts, dims:{gate, device} }
//
// update(params) — every field optional; NaN/±Infinity → default:
//   u        0..1   convenience: the whole cinematic sequence (fills purple/morph/reveal via sequence(u));
//                   explicit purple/morph/reveal/ignite still override. Camera is NOT moved (use cameraAt(u)).
//   t        s      subtle life: haze drift, energy flow along the outline, ember swirl, glints          0
//   purple   0..1   清华紫 light floods: lights, grazing emissive on the stone, doorway backlight, haze    0
//   ignite   0..1   outline draw-on from the arch crown down both jambs (default: seg(purple,.2,.9))
//   morph    0..1   outline detaches, arc-length-matched morph arch → stadium rim + lunette → screen
//                   ring; stone noise-dissolves outward from the doorway with glowing purple edges and
//                   embers that stream into the new outline (pacing calibrated so equal morph steps burn
//                   ≈ equal façade area); hue shifts 清华紫 → brand violet                               0
//   reveal   0..1   handoff: device materialises (if bindDevice was called) as a clean violet scan — the
//                   panel fills in from the glowing rim, the shell builds front → back through a stone-white
//                   band that cools to brushed silver, the base and casters ground it last; the outline
//                   fades into the device's own rim light                                                 0
//
// Host composition (see fx3d/gate.html):
//   const device = createDevice(THREE, {}); scene.add(device.object3d);
//   const gate = createGateMorph(THREE, { deviceDims: device.dims }); scene.add(gate.object3d);
//   gate.placeDevice(device.object3d);
//   gate.bindDevice(device);            // optional: scan-in shader on the device's own materials
//   per frame: const s = gate.sequence(u, s0); s.t = t; gate.update(s);      // (s0: a reused object)
//              const b = gate.deviceBlend(s, b0); device.object3d.visible = b.visible;
//              device.update({ t, rimGlow: b.rimGlow, screen: b.screen });  // keep turntable 0 / explode 0 / float 0
//              key.intensity = KEY * b.stageKey; rim.intensity = RIM * b.stageRim;  // host lights (both 1 at reveal 1)
//              stage.orbit(gate.cameraAt(u, c0));
//   Without bindDevice, fade the device yourself with b.opacity (transparent materials).
//   deviceBlend(p) → { visible, reveal, opacity, rimGlow, screen, stageKey, stageRim }: stageKey / stageRim are multipliers
//   for the host's own white key and violet rim light — white stone under a violet rim reads lavender and a full white
//   key mixed into the 清华紫 wash reads dusty pink, so the opening wants a brighter key with the rim almost off, the key
//   dips while the purple owns the stage, and both return to exactly 1 as the console lands (the device's normal look).
//   bindDevice patches the device's own built-in materials (onBeforeCompile, chained) + shadow depth material;
//   at reveal = 1 nothing is discarded or tinted (the device looks exactly as without the gate); call
//   unbindDevice() once the handoff is over to drop the extra shader cost; dispose() also restores everything.
//   Keep the device at turntable 0 / explode 0 / float 0 during the handoff (the target is its rest pose).
//
// anchors (world space, after update): deviceOrigin, archCrown, archCenter, keystone, plaque, threshold,
//   portal, rimTop (morph target top), screenCenter (morph target screen centre), gateTop
// curves: { rim, screen } each { count, source, target, current } (Float32Array xyz, gate-local; `current`
//   is the live morphing loop after update), clockwise from top centre, matched point-for-point.
// cameraAt(u) → { target:[x,y,z], radius, azimuth, elevation, fov:30 } wide gate → push into the arch →
//   frontal during the morph → settle on the device hero view (device.mjs suggested orbit).

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const seg = (t, a, b, e = easeInOut) => e(clamp((t - a) / Math.max(1e-6, b - a)));
const bell = (t, a, m, b) => (t <= a || t >= b ? 0 : t < m ? smooth((t - a) / (m - a)) : 1 - smooth((t - m) / (b - m)));
function rng(seed = 1) { // mulberry32 (identical to stage.mjs)
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const fin = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

export const TSINGHUA_PURPLE = 0x660874;

/* ═══════════════════════════════ dimensions ═══════════════════════════════ */
// device.mjs DIM (only the numbers the morph target needs) — overridden by opts.deviceDims
const DEV_DEFAULT = { R: 0.16, yTop: 1.125, yBot: 0.33, lipW: 0.014, fil: 0.004, D: 0.42, recess: 0.026, H: 1.285 };
function deviceDims(d) {
  const o = { ...DEV_DEFAULT, ...(d || {}) };
  if (o.zf === undefined) o.zf = o.D / 2;
  if (o.zP === undefined) o.zP = o.zf - o.recess;
  if (o.Rs === undefined) o.Rs = o.R - o.lipW - 0.0045;
  o.rimR = o.R - o.lipW - 0.5 * o.fil;   // centre of the violet rim-light wall (between lip and panel)
  o.rimZ = o.zP + 0.008;                  // mid-depth of the recess
  o.ringR = o.Rs + 0.0004; o.ringZ = o.zP + 0.0045; // screen bezel ring (torus in device.mjs)
  return o;
}
// the gate, scaled so its doorway (threshold → crown) spans the console's front panel height
const GD = (() => {
  // proportions measured off the gate's line art (assets/img/tsinghua-gate.webp) in units of the arch radius:
  // paired columns hug a narrow rusticated strip beside the arch, plaque band sits on the archivolt, side
  // blocks step up to narrow top blocks; total ≈ 4.6 r wide × 5.3 r tall.
  const g = { r: 0.35, yS: 0.92, yThr: 0.07, zF: 0.215, zB: -0.255, bay: 0.44, wall: 0.8 };
  g.crown = g.yS + g.r; g.zc = (g.zF + g.zB) / 2;
  g.colX = [0.505, 0.655]; g.colR = 0.058; g.pier = g.zF + 0.025; g.colZ = g.pier + g.colR + 0.02;
  g.ped = [0.425, 0.735, 0.17]; g.yPed = 0.245; g.yCol0 = 0.26; g.yCol1 = 1.365; g.yAbac = 1.39;
  g.yArch = 1.44; g.yFrieze = 1.51; g.yCorn = 1.55; g.top = 1.88;
  g.av = 0.06; // archivolt band width
  return g;
})();

/* ═══════════════════════════════ small utilities ═══════════════════════════════ */
function registry() {
  const geos = new Set(), mats = new Set(), texs = new Set();
  return {
    g(x) { geos.add(x); return x; }, m(x) { mats.add(x); return x; }, t(x) { texs.add(x); return x; },
    dispose() { geos.forEach((x) => x.dispose()); mats.forEach((x) => x.dispose()); texs.forEach((x) => x.dispose()); geos.clear(); mats.clear(); texs.clear(); },
  };
}
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasTex(THREE, reg, c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return reg.t(t); }
// monotone cubic (no overshoot) through [x, y] pairs
function pchip(pairs) {
  const xs = pairs.map((p) => p[0]), ys = pairs.map((p) => p[1]), n = xs.length, h = [], d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; d[i] = (ys[i + 1] - ys[i]) / h[i]; }
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
  };
}

/* ─── geometry assembly: everything becomes non-indexed position+normal, merged per material ─── */
// aoRef.v = art-directed cavity occlusion baked per part (recessed necks / friezes read darker, like the real gate)
function geoBag(THREE, aoRef = { v: 1 }) {
  const list = [];
  const strip = (g) => { const n = g.index ? g.toNonIndexed() : g; if (n !== g) g.dispose(); for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); if (!n.attributes.normal) n.computeVertexNormals(); return n; };
  return {
    list,
    add(g) { const n = strip(g); n.userData.ao = aoRef.v; list.push(n); return n; },
    merge() {
      let count = 0; for (const g of list) count += g.attributes.position.count;
      const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), ao = new Float32Array(count); let o = 0;
      for (const g of list) { const c = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); ao.fill(g.userData.ao ?? 1, o, o + c); o += c; g.dispose(); }
      list.length = 0;
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('aAo', new THREE.BufferAttribute(ao, 1));
      out.computeBoundingSphere(); out.computeBoundingBox();
      return out;
    },
  };
}
// mirror a non-indexed geometry through the plane z = zc (or x = 0), fixing winding
function mirrored(THREE, g, axis, c = 0) {
  const n = g.clone(), p = n.attributes.position.array, q = n.attributes.normal.array, k = axis === 'x' ? 0 : 2;
  n.userData = { ...g.userData };
  for (let i = 0; i < p.length; i += 3) { p[i + k] = 2 * c - p[i + k]; q[i + k] = -q[i + k]; }
  for (let i = 0; i < p.length; i += 9) for (let j = 0; j < 3; j++) { // swap v1 <-> v2
    let t = p[i + 3 + j]; p[i + 3 + j] = p[i + 6 + j]; p[i + 6 + j] = t;
    t = q[i + 3 + j]; q[i + 3 + j] = q[i + 6 + j]; q[i + 6 + j] = t;
  }
  return n;
}

/* ═══════════════════════════════ shader snippets ═══════════════════════════════ */
const GLSL_NOISE = /* glsl */`
float ymH(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float ymN(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(ymH(i), ymH(i + vec3(1,0,0)), f.x), mix(ymH(i + vec3(0,1,0)), ymH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(ymH(i + vec3(0,0,1)), ymH(i + vec3(1,0,1)), f.x), mix(ymH(i + vec3(0,1,1)), ymH(i + vec3(1,1,1)), f.x), f.y), f.z); }
float ymFbm(vec3 p){ float a = 0.5, s = 0.0; for (int k = 0; k < 4; k++) { s += a * ymN(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s / 0.9375; }
`;
// gate dissolve field (gate-local p): doorway outline first, outward, + fbm breakup
const GLSL_GATE = /* glsl */`
uniform vec4 uArch;   // r, ySpring, yThreshold, zFront
uniform vec2 uZ;      // zBack, zCentre
uniform float uD;     // dissolve front (-0.05 .. 1.05)
float ymArchDist(vec2 p){
  float ax = abs(p.x);
  if (p.y > uArch.y) return abs(length(vec2(ax, p.y - uArch.y)) - uArch.x);
  if (ax < uArch.x) return min(uArch.x - ax, max(uArch.z - p.y, 0.0)); // doorway floor + steps: the threshold is part of the loop
  // near the ground the sideways distance counts less: the base steps / plinths burn with the columns instead of
  // outliving them as floating floor slabs (continuous: factor 1 from threshold + 0.3 up, same as the arch branch)
  float kb = mix(0.55, 1.0, smoothstep(uArch.z - 0.02, uArch.z + 0.3, p.y));
  return length(vec2((ax - uArch.x) * kb, max(uArch.z - p.y, 0.0)));
}
float ymGateField(vec3 p){
  float g = clamp(ymArchDist(p.xy) / 1.05, 0.0, 1.0);
  float back = clamp((uArch.w - p.z) / 0.9, 0.0, 1.0) * 0.06;
  // broad burn lobes (low frequency) + a little crisp detail on the edge — no hairline icicles
  return g * 0.74 + back + 0.16 * ymFbm(p * 3.4 + 2.0) + 0.045 * ymN(p * 19.0);
}
`;

/* ═══════════════════════════════ textures ═══════════════════════════════ */
function glowTex(THREE, reg, size = 256, stops = [[0, 1], [0.22, 0.42], [0.55, 0.1], [1, 0]]) {
  const c = makeCanvas(size, size), g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, a] of stops) gr.addColorStop(o, `rgba(255,255,255,${a})`);
  g.fillStyle = gr; g.fillRect(0, 0, size, size); return canvasTex(THREE, reg, c);
}
function flareTex(THREE, reg) { // soft core + anamorphic streak
  const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
  let gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.08, 'rgba(255,255,255,0.8)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  // soft anamorphic streak: an elliptical gaussian-ish falloff (a hard 3 px bar read as a render bug)
  g.save(); g.translate(S / 2, S / 2); g.scale(1, 0.05);
  gr = g.createRadialGradient(0, 0, 0, 0, 0, S / 2); gr.addColorStop(0, 'rgba(255,255,255,0.34)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.07)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(-S / 2, -S / 2 / 0.05, S, S / 0.05); g.restore();
  return canvasTex(THREE, reg, c);
}
function smokeTex(THREE, reg, seed = 7) { // deterministic soft cloud puff
  const S = 128, c = makeCanvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), r = rng(seed);
  const G = 9, grid = []; for (let i = 0; i < G * G; i++) grid.push(r());
  const vn = (x, y, f) => { x *= f; y *= f; const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    const at = (i, j) => grid[((j % G + G) % G) * G + ((i % G + G) % G)];
    return lerp(lerp(at(xi, yi), at(xi + 1, yi), sx), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), sx), sy); };
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const u = i / S, v = j / S, d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const n = 0.55 * vn(u, v, 3) + 0.3 * vn(u, v, 6) + 0.15 * vn(u, v, 9);
    const a = Math.max(0, 1 - d) ** 1.6 * clamp(n * 1.5 - 0.2);
    const o = (j * S + i) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = Math.round(255 * a);
  }
  g.putImageData(img, 0, 0); return canvasTex(THREE, reg, c);
}
function plaqueTex(THREE, reg, font) {
  const W = 1024, H = 194, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  // faint weathering so the field reads as stone, not paper
  const r = rng(29); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(90,80,70,${0.018 + 0.03 * r()})`; const s = 1 + r() * 3; g.fillRect(r() * W, r() * H, s, s); }
  // 清華園 is written right-to-left on the gate: left→right the plaque reads 園 華 清
  const chars = ['園', '華', '清'], xs = [0.2, 0.5, 0.8];
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold 142px ${font}`;
  chars.forEach((ch, i) => {
    const x = xs[i] * W, y = H * 0.53;
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillText(ch, x + 3, y + 3);      // lower lip of the carving catches light
    g.fillStyle = 'rgba(40,34,30,0.55)'; g.fillText(ch, x - 2, y - 2);       // upper wall in shadow
    g.fillStyle = '#26211d'; g.fillText(ch, x, y);                              // ink-filled carving
  });
  // mask for the faint purple sheen inside the carving
  const e = makeCanvas(W, H), ge = e.getContext('2d'); ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  ge.textAlign = 'center'; ge.textBaseline = 'middle'; ge.font = g.font; ge.fillStyle = '#fff';
  chars.forEach((ch, i) => ge.fillText(ch, xs[i] * W, H * 0.53));
  return { map: canvasTex(THREE, reg, c), emap: canvasTex(THREE, reg, e) };
}

/* ═══════════════════════════════ matched outline loops ═══════════════════════════════ */
// Each loop = list of [source segment, target segment] pairs, walked clockwise from the top centre.
// Segments are parametric f(t) → [x, y]; both sides of a pair share t, so features map to features
// (crown → screen top, jambs → straights, threshold → bottom arc, springing chord → lower screen half).
function arcSeg(cx, cy, r, a0, a1) { return { f: (t) => { const a = a0 + (a1 - a0) * t; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }, L: Math.abs(a1 - a0) * r }; }
function lineSeg(x0, y0, x1, y1) { return { f: (t) => [lerp(x0, x1, t), lerp(y0, y1, t)], L: Math.hypot(x1 - x0, y1 - y0) }; }
function chordSeg(r, y) { return { f: (t) => [r * Math.cos(-Math.PI * t), y], L: 2 * r }; } // cos-parametrised → bows into a half circle
function sampleLoop(pairs, N, zs, zt, tgtM, THREE) {
  const Ls = pairs.map(([s, t]) => s.L + t.L), tot = Ls.reduce((a, b) => a + b, 0);
  const counts = Ls.map((l) => Math.max(4, Math.round(N * l / tot)));
  const n = counts.reduce((a, b) => a + b, 0);
  const src = new Float32Array(n * 3), tgt = new Float32Array(n * 3), v = new THREE.Vector3();
  let k = 0;
  pairs.forEach(([s, t], i) => {
    for (let j = 0; j < counts[i]; j++) {
      const u = j / counts[i], a = s.f(u), b = t.f(u);
      src[k * 3] = a[0]; src[k * 3 + 1] = a[1]; src[k * 3 + 2] = zs;
      v.set(b[0], b[1], zt).applyMatrix4(tgtM); tgt[k * 3] = v.x; tgt[k * 3 + 1] = v.y; tgt[k * 3 + 2] = v.z;
      k++;
    }
  });
  return { count: n, source: src, target: tgt, current: new Float32Array(src) };
}

/* ─── closed glowing tube: one geometry, several shells (core / halo / bloom) via uRad ─── */
function loopTube(THREE, reg, N, RS) {
  const V = (N + 1) * RS, geo = new THREE.BufferGeometry();
  const aC = new Float32Array(V * 3), nor = new Float32Array(V * 3), aS = new Float32Array(V), pos = new Float32Array(V * 3);
  for (let i = 0; i <= N; i++) for (let j = 0; j < RS; j++) aS[i * RS + j] = i / N;
  const idx = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < RS; j++) {
    const a = i * RS + j, b = (i + 1) * RS + j, c = (i + 1) * RS + ((j + 1) % RS), d = i * RS + ((j + 1) % RS);
    idx.push(a, b, d, b, c, d);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); // unused by the shader (bounds only)
  geo.setAttribute('aC', new THREE.BufferAttribute(aC, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
  geo.setIndex(idx); reg.g(geo);
  const cs = new Float32Array(RS), sn = new Float32Array(RS); for (let j = 0; j < RS; j++) { cs[j] = Math.cos(j / RS * TAU); sn[j] = Math.sin(j / RS * TAU); }
  return {
    geometry: geo,
    set(P) { // P: Float32Array N*3 (closed loop)
      for (let i = 0; i <= N; i++) {
        const ii = i % N, ip = (ii + 1) % N, im = (ii - 1 + N) % N;
        let tx = P[ip * 3] - P[im * 3], ty = P[ip * 3 + 1] - P[im * 3 + 1], tz = P[ip * 3 + 2] - P[im * 3 + 2];
        const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
        // n1 = T × Z (in-plane normal), n2 = n1 × T
        let ax = ty, ay = -tx, az = 0; const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
        const bx = ay * tz - az * ty, by = az * tx - ax * tz, bz = ax * ty - ay * tx;
        for (let j = 0; j < RS; j++) {
          const o = (i * RS + j) * 3, c = cs[j], s = sn[j];
          aC[o] = P[ii * 3]; aC[o + 1] = P[ii * 3 + 1]; aC[o + 2] = P[ii * 3 + 2];
          nor[o] = c * ax + s * bx; nor[o + 1] = c * ay + s * by; nor[o + 2] = c * az + s * bz;
        }
      }
      geo.attributes.aC.needsUpdate = true; geo.attributes.normal.needsUpdate = true;
    },
  };
}
function tubeMat(THREE, reg, { pow = 1.0, core = false }) {
  return reg.m(new THREE.ShaderMaterial({
    uniforms: { uRad: { value: 0.004 }, uCol: { value: new THREE.Color() }, uI: { value: 0 }, uPow: { value: pow }, uDraw: { value: 1 }, uDir: { value: 0 }, uT: { value: 0 }, uFlow: { value: 0 }, uCore: { value: core ? 1 : 0 } },
    vertexShader: /* glsl */`
      attribute vec3 aC; attribute float aS; uniform float uRad;
      varying vec3 vN; varying vec3 vV; varying float vS;
      void main(){ vec3 p = aC + normal * uRad; vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vS = aS; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCol; uniform float uI; uniform float uPow; uniform float uDraw; uniform float uDir; uniform float uT; uniform float uFlow; uniform float uCore;
      varying vec3 vN; varying vec3 vV; varying float vS;
      void main(){
        float d = 2.0 * min(vS, 1.0 - vS); if (uDir > 0.5) d = 1.0 - d;       // 0 at the drawing origin
        float vis = 1.0 - smoothstep(uDraw - 0.015, uDraw + 0.001, d);
        if (vis <= 0.001 || uI <= 0.0) discard;
        float f = abs(dot(normalize(vN), normalize(vV)));
        float a = uCore > 0.5 ? mix(0.55, 1.0, f) : pow(f, uPow);
        float flow = 1.0 + uFlow * pow(0.5 + 0.5 * sin(vS * 6.2831853 * 5.0 - uT * 2.4), 10.0);
        float head = uDraw < 0.999 ? exp(-abs(d - uDraw) * 60.0) * 2.5 : 0.0;
        gl_FragColor = vec4(uCol * uI * a * vis * (flow + head), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
}

/* ═══════════════════════════════ pure helpers (also exported) ═══════════════════════════════ */
const CAM_KEYS = [ // u, tx, ty, tz, radius, azimuth, elevation
  // opens low and slightly below the lintel, looking up like the classic photographs of 二校门 (monumental),
  // rises to a frontal eye line through the arch during the morph, then settles on the device hero angle
  [0.00, 0, 1.00, 0.10, 7.0, -0.46, -0.05],
  [0.16, 0, 0.99, 0.10, 6.45, -0.33, -0.032],
  [0.32, 0, 0.96, 0.12, 5.75, -0.17, -0.004],
  [0.48, 0, 0.90, 0.14, 5.15, -0.07, 0.028],
  [0.62, 0, 0.80, 0.14, 4.65, -0.04, 0.058],
  [0.80, 0, 0.70, 0.08, 4.2, -0.27, 0.11],
  [1.00, 0, 0.64, 0.00, 3.9, -0.55, 0.16],
];
const CAM_F = [1, 2, 3, 4, 5, 6].map((c) => pchip(CAM_KEYS.map((k) => [k[0], k[c]])));
/** camera for the cinematic sequence (pure). out is reused if given. */
export function gateCameraAt(u, out) {
  u = clamp(fin(u) ?? 0);
  const o = out || { target: [0, 0, 0] };
  o.target = o.target || [0, 0, 0];
  o.target[0] = CAM_F[0](u); o.target[1] = CAM_F[1](u); o.target[2] = CAM_F[2](u);
  o.radius = CAM_F[3](u); o.azimuth = CAM_F[4](u); o.elevation = CAM_F[5](u); o.fov = 30; o.roll = 0;
  return o;
}
/** sequence(u) → { u, purple, ignite, morph, reveal } (pure). */
export function gateSequence(u, out) {
  u = clamp(fin(u) ?? 0);
  const o = out || {};
  o.u = u;
  o.purple = seg(u, 0.04, 0.24) * (1 - 0.6 * seg(u, 0.8, 1));
  o.ignite = seg(u, 0.1, 0.28, smooth);
  o.morph = seg(u, 0.27, 0.71, smooth);
  o.reveal = seg(u, 0.6, 0.93, smooth);
  return o;
}
/** suggestion for the host's device while it materialises (pure):
 *  { visible, reveal, opacity, rimGlow, screen, stageKey, stageRim } — stageKey / stageRim multiply the host's white key
 *  and violet rim intensities (1 at reveal = 1). */
export function gateDeviceBlend(params = {}, out) {
  const r = clamp(fin(params.reveal) ?? 0), o = out || {};
  o.visible = r > 0.001;
  o.reveal = r;
  o.opacity = seg(r, 0.0, 0.55, smooth);                            // for hosts that don't bindDevice()
  o.rimGlow = seg(r, 0.05, 0.4) * lerp(1.0, 0.62, seg(r, 0.55, 1)); // rim flares as the outline hands over, settles
  o.screen = 'logo';
  // host-light suggestions (multipliers for the host's own white key and violet rim light; both exactly 1 at reveal = 1,
  // so the settled frame is the host's normal device lighting). A violet rim on white stone reads lavender and a full
  // white key mixed into the 清华紫 wash reads candy-pink: open on a brighter white key with the violet rim nearly off,
  // dim the key while the purple owns the stage, bring both back as the console materialises.
  const pu = clamp(fin(params.purple) ?? 0);
  o.stageKey = lerp(1.18, 1, r) * (1 - 0.72 * pu * (1 - seg(r, 0.1, 0.9, smooth)));
  o.stageRim = lerp(0.12, 1, seg(r, 0.05, 0.85, smooth));
  return o;
}

/* ═══════════════════════════════ createGateMorph ═══════════════════════════════ */
export function createGateMorph(THREE, opts = {}) {
  const o = {
    tsinghuaPurple: TSINGHUA_PURPLE, deviceViolet: 0x8a5cf0, rimViolet: 0x6a4896, deviceDims: null, deviceTransform: null,
    detail: 'high', castShadow: true, lights: true, haze: true, embers: 1400, portal: true, floorGlow: true,
    plaqueFont: '"Kaiti SC","STKaiti","BiauKaiTC","BiauKai","KaiTi","楷体","Songti SC","STSong","SimSun","Noto Serif SC",serif',
    ...opts,
  };
  const hi = o.detail !== 'low';
  const reg = registry(), g = GD, D = deviceDims(o.deviceDims);
  const root = new THREE.Group(); root.name = 'TsinghuaGateMorph';
  const colTP = new THREE.Color(o.tsinghuaPurple), colDV = new THREE.Color(o.deviceViolet), colRV = new THREE.Color(o.rimViolet);
  const WHITE = new THREE.Color(1, 1, 1);

  /* ── device placement (gate-local) ── */
  const dt = o.deviceTransform || {};
  const devPos = new THREE.Vector3(...(dt.position || [0, 0, 0])), devQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dt.rotationY || 0);
  const devS = new THREE.Vector3().setScalar(dt.scale || 1), devM = new THREE.Matrix4().compose(devPos, devQ, devS);
  const devicePlacement = { position: devPos, quaternion: devQ, scale: devS, matrix: devM };

  /* ═════════ stone model ═════════ */
  const AO = { v: 1 }; // baked cavity occlusion for the parts added next (1 = open, lower = recessed)
  const bag = geoBag(THREE, AO), front = geoBag(THREE, AO); // `front` parts get mirrored to the back façade
  const box = (b, x0, x1, y0, y1, z0, z1) => { const q = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); q.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return b.add(q); };
  const boxS = (x0, x1, y0, y1, zf) => box(bag, x0, x1, y0, y1, 2 * g.zc - zf, zf);            // symmetric front/back
  const boxSX = (x0, x1, y0, y1, zf) => { boxS(x0, x1, y0, y1, zf); boxS(-x1, -x0, y0, y1, zf); }; // + mirrored in x
  const bevelBox = (b, x0, x1, y0, y1, z0, z1, e) => {
    const s = new THREE.Shape(); s.moveTo(x0 + e, y0 + e); s.lineTo(x1 - e, y0 + e); s.lineTo(x1 - e, y1 - e); s.lineTo(x0 + e, y1 - e); s.lineTo(x0 + e, y0 + e);
    const q = new THREE.ExtrudeGeometry(s, { depth: Math.max(1e-4, z1 - z0 - 2 * e), bevelEnabled: true, bevelThickness: e, bevelSize: e, bevelSegments: 1, curveSegments: 4 });
    q.translate(0, 0, z0 + e); return b.add(q);
  };
  const extrude = (b, shape, z0, z1, e = 0, segs = hi ? 64 : 32) => {
    const q = new THREE.ExtrudeGeometry(shape, { depth: Math.max(1e-4, z1 - z0 - 2 * e), bevelEnabled: e > 0, bevelThickness: e, bevelSize: e, bevelSegments: 1, curveSegments: segs });
    q.translate(0, 0, z0 + e); return b.add(q);
  };

  // base steps (symmetric)
  const pedF = g.colZ + g.ped[2] / 2;
  boxS(-0.96, 0.96, 0, 0.035, pedF + 0.17);
  boxS(-0.9, 0.9, 0.035, g.yThr, pedF + 0.09);
  // main wall: U-shaped (doorway notched out), full depth → the passage (jambs + barrel vault) comes for free
  {
    const s2 = new THREE.Shape(), r = g.r, W = g.wall;
    s2.moveTo(-W, g.yThr); s2.lineTo(-r, g.yThr); s2.lineTo(-r, g.yS); s2.absarc(0, g.yS, r, Math.PI, 0, true);
    s2.lineTo(r, g.yThr); s2.lineTo(W, g.yThr); s2.lineTo(W, g.yCorn + 0.01); s2.lineTo(-W, g.yCorn + 0.01); s2.lineTo(-W, g.yThr);
    extrude(bag, s2, g.zB, g.zF, 0, hi ? 72 : 36);
  }
  // column-zone piers (project from the wall) and the outer wing pilasters
  AO.v = 0.86; boxSX(g.bay, 0.745, g.yThr, g.yAbac, g.pier); AO.v = 1;   // wall behind the column pairs sits in their shade
  boxSX(0.745, g.wall, g.yThr, g.yAbac, g.pier - 0.012);
  // plinth course along the base of the rusticated strip
  for (const sx of [-1, 1]) { const a = sx < 0 ? -g.bay : g.r, b2 = sx < 0 ? -g.r : g.bay; bevelBox(front, a, b2, g.yThr, 0.2, g.zF - 0.01, g.zF + 0.014, 0.004); }
  // rusticated strips (horizontal blocks with V-joints), impost, archivolt, keystone
  {
    const h = 0.062, gap = 0.009;
    for (let y = 0.212; y + h <= g.yS - 0.03 + 1e-6; y += h + gap)
      for (const sx of [-1, 1]) { const a = sx < 0 ? -g.bay - 0.004 : g.r, b2 = sx < 0 ? -g.r : g.bay + 0.004; bevelBox(front, a, b2, y, y + h, g.zF - 0.01, g.zF + 0.012, 0.0045); }
    for (const sx of [-1, 1]) { const a = sx < 0 ? -g.bay - 0.006 : g.r - 0.004, b2 = sx < 0 ? -g.r + 0.004 : g.bay + 0.006; bevelBox(front, a, b2, g.yS - 0.03, g.yS + 0.004, g.zF - 0.01, g.zF + 0.022, 0.004); }
    const ring = (r0, r1) => { const q = new THREE.Shape(); q.absarc(0, g.yS, r1, 0, Math.PI, false); q.lineTo(-r0, g.yS); q.absarc(0, g.yS, r0, Math.PI, 0, true); q.lineTo(r1, g.yS); return q; };
    extrude(front, ring(g.r - 0.002, g.r + g.av), g.zF - 0.01, g.zF + 0.016, 0.004);
    extrude(front, ring(g.r + g.av, g.r + g.av + 0.014), g.zF - 0.01, g.zF + 0.007, 0.002);
    extrude(front, ring(g.r - 0.004, g.r + 0.012), g.zF - 0.01, g.zF + 0.022, 0.003); // inner roll moulding
    const k = new THREE.Shape(), y0 = g.crown - 0.012, y1 = 1.402;
    k.moveTo(-0.032, y0); k.lineTo(0.032, y0); k.lineTo(0.047, y1); k.lineTo(-0.047, y1); k.lineTo(-0.032, y0);
    extrude(front, k, g.zF - 0.01, g.zF + 0.034, 0.005, 4);
  }
  // string course under the plaque band, plaque frame
  bevelBox(front, -g.bay - 0.01, g.bay + 0.01, 1.39, 1.405, g.zF - 0.01, g.zF + 0.016, 0.004);
  {
    const q = new THREE.Shape(); q.moveTo(-0.285, 1.418); q.lineTo(0.285, 1.418); q.lineTo(0.285, 1.548); q.lineTo(-0.285, 1.548); q.lineTo(-0.285, 1.418);
    const hole = new THREE.Path(); hole.moveTo(-0.262, 1.436); hole.lineTo(-0.262, 1.53); hole.lineTo(0.262, 1.53); hole.lineTo(0.262, 1.436); hole.lineTo(-0.262, 1.436);
    q.holes.push(hole); extrude(bag, q, g.zF - 0.01, g.zF + 0.016, 0.004, 4);
  }
  // shared pedestal per column pair + Tuscan columns (entasis lathe) + abacus, front and back
  {
    const R0 = g.colR, y0c = g.yCol0;
    const prof = [[0.0001, y0c], [0.07, y0c], [0.073, y0c + 0.007], [0.074, y0c + 0.017], [0.071, y0c + 0.026], [0.066, y0c + 0.031],
      [0.062, y0c + 0.035], [0.06, y0c + 0.044]];
    const ys = y0c + 0.044, ye = g.yCol1 - 0.06, n = 12;
    for (let i = 1; i <= n; i++) { const t = i / n, y = lerp(ys, ye, t); const rr = t < 0.33 ? R0 + 0.001 * Math.sin(t / 0.33 * Math.PI / 2) : lerp(R0 + 0.001, 0.049, Math.pow((t - 0.33) / 0.67, 1.3)); prof.push([rr, y]); }
    const yc = g.yCol1;
    prof.push([0.053, yc - 0.057], [0.055, yc - 0.05], [0.053, yc - 0.043], [0.049, yc - 0.04], [0.049, yc - 0.028], [0.053, yc - 0.025], [0.06, yc - 0.018], [0.066, yc - 0.01], [0.069, yc], [0.0001, yc]);
    const lathe = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), hi ? 40 : 24);
    const colNI = lathe.toNonIndexed(); lathe.dispose();
    const [p0, p1, pd] = g.ped, zc0 = g.colZ;
    for (const sx of [-1, 1]) {
      const X = (v) => sx * v, lo = Math.min(X(p0), X(p1)), hi2 = Math.max(X(p0), X(p1));
      bevelBox(front, lo - 0.012, hi2 + 0.012, g.yThr, g.yThr + 0.035, zc0 - pd / 2 - 0.012, zc0 + pd / 2 + 0.012, 0.004);
      box(front, lo, hi2, g.yThr + 0.035, g.yPed - 0.02, zc0 - pd / 2, zc0 + pd / 2);
      bevelBox(front, lo - 0.012, hi2 + 0.012, g.yPed - 0.02, g.yPed, zc0 - pd / 2 - 0.012, zc0 + pd / 2 + 0.012, 0.004);
      for (const x of g.colX) {
        const c = colNI.clone(); c.translate(sx * x, 0, zc0); front.add(c);
        box(front, sx * x - 0.074, sx * x + 0.074, g.yPed, g.yCol0, zc0 - 0.074, zc0 + 0.074);
        bevelBox(front, sx * x - 0.076, sx * x + 0.076, g.yCol1, g.yAbac, zc0 - 0.076, zc0 + 0.076, 0.003);
      }
    }
    colNI.dispose();
  }
  // side blocks over each column pair: entablature, shadowed neck, broad projecting slab, attic, cap, top block
  const zE = g.colZ + 0.078;
  boxSX(0.42, 0.75, g.yAbac, g.yArch, zE);
  boxSX(0.42, 0.75, g.yArch, g.yArch + 0.01, zE + 0.008);
  AO.v = 0.86; boxSX(0.425, 0.745, g.yArch + 0.01, g.yFrieze, zE - 0.004); AO.v = 1;
  boxSX(0.415, 0.755, g.yFrieze, g.yFrieze + 0.02, zE + 0.012);
  boxSX(0.405, 0.765, g.yFrieze + 0.02, g.yCorn, zE + 0.028);
  // recessed neck → the gate's signature dark band under the side cornices (tsinghua-gate.webp: ≈ 1/3 of the
  // capital block's height, in deep shadow) — taller, deeper and darker than a hairline so it reads at wide shots
  const dN = 0.015;
  AO.v = 0.16; boxSX(0.43, 0.74, g.yCorn, 1.585 + dN, zE - 0.038); AO.v = 1;
  boxSX(0.33, 0.8, 1.585 + dN, 1.605 + dN, zE + 0.03);              // broad slab (projecting)
  boxSX(0.335, 0.795, 1.605 + dN, 1.64 + dN, zE + 0.045);
  boxSX(0.33, 0.8, 1.64 + dN, 1.655 + dN, zE + 0.035);
  AO.v = 0.9; boxSX(0.37, 0.76, 1.655 + dN, 1.72 + dN, zE - 0.01); AO.v = 1;  // attic
  boxSX(0.35, 0.78, 1.72 + dN, 1.735 + dN, zE + 0.005);             // cap
  boxSX(0.355, 0.775, 1.735 + dN, 1.76 + dN, zE + 0.015);
  boxSX(0.38, 0.585, 1.76 + dN, 1.845 + dN, zE - 0.03);             // narrow top block over the inner column
  boxSX(0.37, 0.595, 1.845 + dN, g.top, zE - 0.02);
  for (const sx of [-1, 1]) { // raised panel frame on each attic face
    const x0 = sx < 0 ? -0.72 : 0.41, x1 = sx < 0 ? -0.41 : 0.72, zf = zE - 0.01;
    for (const [a, b2, c, d] of [[x0, x1, 1.668, 1.678], [x0, x1, 1.697, 1.707], [x0, x0 + 0.01, 1.678, 1.697], [x1 - 0.01, x1, 1.678, 1.697]]) box(front, a, b2, c + dN, d + dN, zf - 0.01, zf + 0.012);
  }
  // central cornice over the plaque band, set-back attic, coping
  boxS(-0.42, 0.42, g.yCorn, g.yCorn + 0.025, g.zF + 0.02);
  boxS(-0.42, 0.42, g.yCorn + 0.025, g.yCorn + 0.06, g.zF + 0.04);
  boxS(-0.42, 0.42, g.yCorn + 0.06, 1.65, g.zF + 0.055);
  // low central attic: on the real gate the centre tops out around the side slabs, so the stepped side blocks
  // stand clearly above it (the 二校门 silhouette) instead of the top reading as one continuous box
  AO.v = 0.9; boxS(-0.4, 0.4, 1.65, 1.695, g.zF - 0.01); AO.v = 1;
  boxS(-0.415, 0.415, 1.695, 1.72, g.zF + 0.012);
  boxS(-0.26, 0.26, 1.72, 1.733, g.zF - 0.005);
  // back façade = mirror of the carved front parts (except the plaque)
  const frontGeos = front.list.slice(); front.list.length = 0;
  for (const q of frontGeos) { bag.list.push(q); bag.list.push(mirrored(THREE, q, 'z', g.zc)); }
  const stoneGeo = reg.g(bag.merge());

  /* ── stone material: ivory, fbm grain + micro bump, fake AO, purple wash, dissolve with glowing edge ── */
  const U = {
    uArch: { value: new THREE.Vector4(g.r, g.yS, g.yThr, g.zF) }, uZ: { value: new THREE.Vector2(g.zB, g.zc) }, uD: { value: -1 },
    uEdgeCol: { value: new THREE.Color() }, uPurple: { value: 0 }, uPurpleCol: { value: new THREE.Color() }, uLine: { value: 0 }, uT: { value: 0 },
    uPlaqueGlow: { value: 0 },
  };
  const stoneVert = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aAo; varying vec3 vYmP; varying vec3 vYmN; varying float vYmAo;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vYmP = position; vYmN = normal; vYmAo = aAo;');
  };
  const patchStone = (mat, key) => {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      stoneVert(sh);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vYmP; varying vec3 vYmN; varying float vYmAo;
        uniform vec3 uEdgeCol; uniform float uPurple; uniform vec3 uPurpleCol; uniform float uLine; uniform float uT; uniform float uPlaqueGlow;
        float ymDD = 1.0;
        ${GLSL_NOISE}
        ${GLSL_GATE}`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        { ymDD = ymGateField(vYmP) - uD; if (ymDD < 0.0) discard; }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
        { vec3 p = vYmP; float gr = ymFbm(p * 34.0), st = ymFbm(p * 3.1 + 4.0);
          float alb = (0.93 + 0.085 * gr) * (0.965 + 0.06 * st) * mix(0.84, 1.0, smoothstep(0.0, 0.5, p.y));
          float ao = mix(0.62, 1.0, smoothstep(uArch.z - 0.02, uArch.z + 0.26, p.y) * 0.8 + 0.2 * step(0.5, vYmN.y));
          float ax = abs(p.x), inside = step(ax, uArch.x + 0.004) * step(p.y, uArch.y + sqrt(max(0.0, uArch.x * uArch.x - ax * ax)) + 0.004) * step(p.z, uArch.w + 0.004) * step(uZ.x - 0.004, p.z);
          float depth = min(uArch.w - p.z, p.z - uZ.x);
          ao *= mix(1.0, mix(0.42, 0.95, smoothstep(0.0, 0.16, depth)), inside);
          ao *= mix(1.0, 0.62, smoothstep(-0.5, -0.9, vYmN.y)) * vYmAo;
          float heat = 1.0 - smoothstep(0.0, 0.09, ymDD);                 // stone about to go scorches to a purple-black
          diffuseColor.rgb *= alb * ao * mix(1.0, 0.1, heat * heat);
          // under the 清华紫 wash the ivory reads cool-violet instead of dusty pink (warm key × purple = muddy mauve)
          diffuseColor.rgb *= mix(vec3(1.0), vec3(0.8, 0.72, 1.0), 0.7 * uPurple);
          if (!gl_FrontFacing) diffuseColor.rgb *= 0.04; }`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float hgt = ymFbm(vYmP * 80.0) * 0.0009 + ymN(vYmP * 260.0) * 0.00018;
          vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition), R1 = cross(sy, normal), R2 = cross(normal, sx);
          float det = dot(sx, R1) * faceDirection; vec2 dh = vec2(dFdx(hgt), dFdy(hgt));
          vec3 grad = sign(det) * (dh.x * R1 + dh.y * R2); normal = normalize(abs(det) * normal - grad); }`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec3 p = vYmP; vec3 V = normalize(vViewPosition); float ax = abs(p.x);
          float inside = step(ax, uArch.x + 0.004) * step(p.y, uArch.y + sqrt(max(0.0, uArch.x * uArch.x - ax * ax)) + 0.004) * step(p.z, uArch.w + 0.004) * step(uZ.x - 0.004, p.z);
          float depth = clamp((uArch.w - p.z) / (uArch.w - uZ.x), 0.0, 1.0);
          vec3 pc = uPurpleCol;
          totalEmissiveRadiance += pc * uPurple * inside * (0.55 + 1.1 * depth) * 1.4;                         // light pours out of the doorway
          float fr = pow(1.0 - abs(dot(normal, V)), 3.0);
          totalEmissiveRadiance += pc * uPurple * (0.22 * fr + 0.02 * smoothstep(0.0, 2.2, p.y));             // grazing sheen
          float dl = ymArchDist(p.xy), onFace = smoothstep(uArch.w - 0.03, uArch.w + 0.005, abs(p.z - uZ.y) + uZ.y);
          totalEmissiveRadiance += pc * uLine * exp(-dl / 0.05) * onFace * 2.2;                                // the ignited outline lights its moulding
          // burning dissolve front: scorched halo → 清华紫 glow band → thin white-hot core line
          float heat = 1.0 - smoothstep(0.0, 0.09, ymDD), glow = 1.0 - smoothstep(0.0, 0.022, ymDD), core = 1.0 - smoothstep(0.0, 0.006, ymDD);
          totalEmissiveRadiance += uEdgeCol * (0.22 * heat * heat + 1.5 * glow * glow) + mix(uEdgeCol * 2.6, vec3(1.15, 0.95, 1.3), 0.6) * core * 2.0;
          // the inside of the solid (visible only through the burn) glows like a cross-section filled with light,
          // instead of showing paper-thin white box walls
          if (!gl_FrontFacing) totalEmissiveRadiance += uEdgeCol * (0.05 + 0.9 * glow * glow);
          ${key === 'plaque' ? 'totalEmissiveRadiance += pc * uPlaqueGlow * texture2D(uEmap, vMapUv).r * 1.6;' : ''}
        }`);
      if (key === 'plaque') sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uEmap;');
    };
    mat.customProgramCacheKey = () => 'ym3d-gate-stone-' + key;
    return mat;
  };
  const stoneMat = reg.m(patchStone(new THREE.MeshStandardMaterial({ color: 0xf7f4ee, roughness: 0.8, metalness: 0, envMapIntensity: 0.42, side: THREE.DoubleSide }), 'stone'));
  const depthMat = reg.m(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
  depthMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U); stoneVert(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vYmP; varying vec3 vYmN;\n${GLSL_NOISE}\n${GLSL_GATE}`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n if (ymGateField(vYmP) < uD) discard;');
  };
  depthMat.customProgramCacheKey = () => 'ym3d-gate-depth';
  const stone = new THREE.Mesh(stoneGeo, stoneMat); stone.name = 'gateStone';
  stone.castShadow = o.castShadow; stone.receiveShadow = true; stone.customDepthMaterial = depthMat; root.add(stone);

  // plaque 清華園 (front only)
  const pt = plaqueTex(THREE, reg, o.plaqueFont);
  const plaqueMat = reg.m(patchStone(new THREE.MeshStandardMaterial({ color: 0xf7f4ee, map: pt.map, roughness: 0.78, metalness: 0, envMapIntensity: 0.42 }), 'plaque'));
  const _pobc = plaqueMat.onBeforeCompile; plaqueMat.onBeforeCompile = (sh, r) => { sh.uniforms.uEmap = { value: pt.emap }; _pobc(sh, r); };
  const plaqueGeo = reg.g(new THREE.PlaneGeometry(0.53, 0.1)); plaqueGeo.translate(0, 1.483, g.zF + 0.0035);
  plaqueGeo.setAttribute('aAo', new THREE.BufferAttribute(new Float32Array(plaqueGeo.attributes.position.count).fill(1), 1));
  const plaque = new THREE.Mesh(plaqueGeo, plaqueMat); plaque.name = 'plaque'; plaque.receiveShadow = true; root.add(plaque);

  /* ═════════ light & atmosphere ═════════ */
  const tGlow = glowTex(THREE, reg), tFlare = flareTex(THREE, reg), tSmoke = smokeTex(THREE, reg, 7);
  const additive = (map, color = 0xffffff, extra = {}) => reg.m(new THREE.MeshBasicMaterial({ map, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: true, ...extra }));
  // additive glow card that fades out toward the floor (no hard line where it meets the ground)
  // bb = true: camera-facing card whose centre is pushed `uPush` metres straight behind its anchor along the view ray,
  // so the glow always sits centred behind the doorway / the device, whatever the host camera (a fixed plane behind
  // the gate slid off-centre into a smudge beside the device at the hero azimuth) and never intersects either
  const glowCard = (map, bb = false) => reg.m(new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, uCol: { value: new THREE.Color() }, uFloorY: { value: 0 }, uPush: { value: 1 } },
    vertexShader: bb ? `uniform float uPush; varying vec2 vUv; varying float vY;
      void main(){ vUv = uv; vec3 a = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 c = a + normalize(a - cameraPosition) * uPush;
        float sx = length(modelMatrix[0].xyz), sy = length(modelMatrix[1].xyz);
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 wp = c + right * position.x * sx + up * position.y * sy; vY = wp.y; gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`
      : 'varying vec2 vUv; varying float vY; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vY = wp.y; gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: `uniform sampler2D map; uniform vec3 uCol; uniform float uFloorY; varying vec2 vUv; varying float vY;
      void main(){ float a = texture2D(map, vUv).a * smoothstep(uFloorY, uFloorY + 0.55, vY); gl_FragColor = vec4(uCol * a, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  // doorway backlight "portal" (only seen through the arch until the stone is gone, then a halo behind the device)
  let portal = null, portalCore = null;
  if (o.portal) {
    portal = new THREE.Mesh(reg.g(new THREE.PlaneGeometry(2.8, 3.0)), glowCard(tGlow, true)); portal.position.set(0, 0.95, 0); portal.renderOrder = 1; portal.frustumCulled = false; root.add(portal);
    portalCore = new THREE.Mesh(reg.g(new THREE.PlaneGeometry(0.95, 1.6)), glowCard(tGlow)); portalCore.position.set(0, 0.78, g.zB - 0.12); portalCore.renderOrder = 1; root.add(portalCore);
  }
  // volumetric light spilling out of the doorway: an arch-shaped hood of streaky additive light, fading forward
  let beam = null;
  if (o.portal) {
    const pts = [], n = hi ? 96 : 56;
    for (let i = 0; i <= n; i++) { const t = i / n; // jamb → arch → jamb (no threshold: the floor takes that light)
      const L1 = g.yS - g.yThr, L2 = Math.PI * g.r, s = t * (2 * L1 + L2);
      if (s < L1) pts.push([-g.r, g.yThr + s]); else if (s < L1 + L2) { const a = Math.PI - (s - L1) / g.r; pts.push([g.r * Math.cos(a), g.yS + g.r * Math.sin(a)]); } else pts.push([g.r, g.yS - (s - L1 - L2)]);
    }
    const M = 10, pos = new Float32Array((n + 1) * (M + 1) * 3), uv = new Float32Array((n + 1) * (M + 1) * 2), idx = [];
    for (let j = 0; j <= M; j++) { const v = j / M, k = 1 + 0.55 * v, z = g.zF + 0.01 + 1.5 * v;
      for (let i = 0; i <= n; i++) { const q = j * (n + 1) + i, [x, y] = pts[i]; pos[q * 3] = x * k; pos[q * 3 + 1] = g.yThr + (y - g.yThr) * (1 + 0.25 * v) - 0.02 * v; pos[q * 3 + 2] = z; uv[q * 2] = i / n; uv[q * 2 + 1] = v; } }
    for (let j = 0; j < M; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b2 = a + n + 1; idx.push(a, b2, a + 1, b2, b2 + 1, a + 1); }
    const bg = reg.g(new THREE.BufferGeometry()); bg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); bg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); bg.setIndex(idx);
    beam = new THREE.Mesh(bg, reg.m(new THREE.ShaderMaterial({
      uniforms: { uCol: { value: new THREE.Color() }, uI: { value: 0 }, uT: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 uCol; uniform float uI; uniform float uT; varying vec2 vUv;
        float h1(float x){ return fract(sin(x * 127.1) * 43758.5453); }
        float n1(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
        void main(){ float s = 0.55 * n1(vUv.x * 46.0 + uT * 0.35) + 0.45 * n1(vUv.x * 13.0 - uT * 0.2);
          float a = pow(1.0 - vUv.y, 2.2) * smoothstep(0.0, 0.08, vUv.y) * (0.35 + 0.9 * s * s) * uI;
          a *= smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
          gl_FragColor = vec4(uCol * a, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    })));
    beam.renderOrder = 3; beam.name = 'doorwayBeam'; root.add(beam);
  }
  let pool = null;
  if (o.floorGlow) {
    const pg = reg.g(new THREE.PlaneGeometry(1.5, 2.6)); pg.rotateX(-Math.PI / 2);
    pool = new THREE.Mesh(pg, additive(tGlow)); pool.position.set(0, 0.004, g.zF + 0.75); pool.renderOrder = 1; root.add(pool);
  }
  // haze puffs — ONE draw call of camera-facing quads (vertex-shader billboards). Unlike sprites they fade out
  // toward the floor, so no hard line where a puff meets the ground; drift is a pure function of uT.
  let haze = null;
  if (o.haze) {
    const r = rng(17);
    const spots = [[0, 0.62, g.zB - 0.3, 2.2], [0, 1.05, g.zB - 0.15, 1.8], [-0.42, 0.42, g.zF + 0.9, 1.2], [0.46, 0.4, g.zF + 1.0, 1.3], [0, 0.35, g.zF + 1.45, 1.7],
      [-1.2, 0.62, g.zF + 0.35, 1.5], [1.25, 0.7, g.zF + 0.3, 1.5], [0, 1.95, g.zc - 0.3, 2.4], [-0.62, 1.3, g.zB - 0.45, 1.6], [0.72, 1.22, g.zB - 0.5, 1.6], [0.05, 0.9, g.zF + 0.75, 1.0]];
    const N = spots.length, cen = new Float32Array(N * 12), cor = new Float32Array(N * 8), prm = new Float32Array(N * 16), idx = [];
    const C = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
    spots.forEach(([x, y, z, sz], i) => {
      const ph = r() * TAU, spd = 0.6 + 0.8 * r(), rot = (r() - 0.5) * 0.3;
      for (let k = 0; k < 4; k++) { const q = i * 4 + k; cen.set([x, y, z], q * 3); cor.set(C[k], q * 2); prm.set([sz, ph, spd, rot], q * 4); }
      idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    });
    const hg = reg.g(new THREE.BufferGeometry());
    hg.setAttribute('position', new THREE.BufferAttribute(cen.slice(), 3)); // bounds only
    hg.setAttribute('aCen', new THREE.BufferAttribute(cen, 3)); hg.setAttribute('aCor', new THREE.BufferAttribute(cor, 2)); hg.setAttribute('aP', new THREE.BufferAttribute(prm, 4)); hg.setIndex(idx);
    haze = new THREE.Mesh(hg, reg.m(new THREE.ShaderMaterial({
      uniforms: { map: { value: tSmoke }, uCol: { value: new THREE.Color() }, uI: { value: 0 }, uT: { value: 0 }, uFloorY: { value: 0 } },
      vertexShader: /* glsl */`
        attribute vec3 aCen; attribute vec2 aCor; attribute vec4 aP; uniform float uT;
        varying vec2 vUv; varying float vY; varying float vA; varying float vS;
        void main(){
          float ph = aP.y + uT * 0.07 * aP.z;
          vec3 c = aCen + vec3(0.07 * sin(ph), 0.03 * sin(ph * 1.3 + 1.0), 0.04 * cos(ph * 0.8));
          vec3 wc = (modelMatrix * vec4(c, 1.0)).xyz;
          float rt = aP.w + uT * 0.012 * aP.z, cs = cos(rt), sn = sin(rt);
          vec2 q = aCor * vec2(aP.x, aP.x * 0.8);
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 wp = wc + right * q.x + up * q.y;
          vUv = mat2(cs, sn, -sn, cs) * aCor + 0.5; vY = wp.y; vS = aP.x; vA = 0.26 + 0.08 * sin(ph * 2.1);
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D map; uniform vec3 uCol; uniform float uI; uniform float uFloorY;
        varying vec2 vUv; varying float vY; varying float vA; varying float vS;
        void main(){
          vec2 uv = clamp(vUv, 0.0, 1.0);
          float a = texture2D(map, uv).a * vA * uI * smoothstep(uFloorY, uFloorY + 0.22 * vS, vY);
          if (a <= 0.0005) discard;
          gl_FragColor = vec4(uCol * a, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    })));
    haze.frustumCulled = false; haze.renderOrder = 2; haze.name = 'haze'; root.add(haze);
  }
  // lights: purple in the passage, grazing spot from low front-left, back rim (no shadows)
  const lights = {};
  if (o.lights) {
    lights.passage = new THREE.PointLight(0xffffff, 0, 0, 2); lights.passage.position.set(0, 0.95, g.zc - 0.05); root.add(lights.passage);
    lights.graze = new THREE.SpotLight(0xffffff, 0, 0, 0.42, 0.85, 2); lights.graze.position.set(-2.3, 1.15, 1.05); lights.graze.target.position.set(0.6, 1.2, 0.1); root.add(lights.graze, lights.graze.target);
    lights.back = new THREE.SpotLight(0xffffff, 0, 0, 0.5, 1.0, 2); lights.back.position.set(0.5, 2.9, -2.4); lights.back.target.position.set(0, 1.3, 0); root.add(lights.back, lights.back.target);
  }

  /* ═════════ the outline: matched loops arch → device ═════════ */
  const NA = hi ? 360 : 220, NB = hi ? 260 : 160, RS = hi ? 12 : 8;
  const rr = D.rimR, zS = g.zF + 0.024, zSB = g.zF + 0.026;
  const loopA = sampleLoop([
    [arcSeg(0, g.yS, g.r, Math.PI / 2, 0), arcSeg(0, D.yTop, rr, Math.PI / 2, 0)],
    [lineSeg(g.r, g.yS, g.r, g.yThr), lineSeg(rr, D.yTop, rr, D.yBot)],
    [chordSeg(g.r, g.yThr), arcSeg(0, D.yBot, rr, 0, -Math.PI)],
    [lineSeg(-g.r, g.yThr, -g.r, g.yS), lineSeg(-rr, D.yBot, -rr, D.yTop)],
    [arcSeg(0, g.yS, g.r, Math.PI, Math.PI / 2), arcSeg(0, D.yTop, rr, Math.PI, Math.PI / 2)],
  ], NA, zS, D.rimZ, devM, THREE);
  const loopB = sampleLoop([
    [arcSeg(0, g.yS, g.r - 0.012, Math.PI / 2, 0), arcSeg(0, D.yTop, D.ringR, Math.PI / 2, 0)],
    [chordSeg(g.r - 0.012, g.yS - 0.012), arcSeg(0, D.yTop, D.ringR, 0, -Math.PI)],
    [arcSeg(0, g.yS, g.r - 0.012, Math.PI, Math.PI / 2), arcSeg(0, D.yTop, D.ringR, Math.PI, Math.PI / 2)],
  ], NB, zSB, D.ringZ, devM, THREE);
  // per-point stagger weights (crown leads, threshold follows)
  const weights = (L) => { const w = new Float32Array(L.count); for (let i = 0; i < L.count; i++) w[i] = 1 - clamp((L.source[i * 3 + 1] - g.yThr) / (g.crown - g.yThr)); return w; };
  const wA = weights(loopA), wB = weights(loopB);
  const tubeA = loopTube(THREE, reg, loopA.count, RS), tubeB = loopTube(THREE, reg, loopB.count, RS);
  const shells = [];
  const shell = (tube, name, core, pow, order) => { const m = new THREE.Mesh(tube.geometry, tubeMat(THREE, reg, { pow, core })); m.name = name; m.frustumCulled = false; m.renderOrder = order; root.add(m); shells.push(m); return m; };
  const A = { core: shell(tubeA, 'outlineCore', true, 1, 6), halo: shell(tubeA, 'outlineHalo', false, 1.4, 5), bloom: shell(tubeA, 'outlineBloom', false, 2.4, 4) };
  const B = { core: shell(tubeB, 'screenCore', true, 1, 6), halo: shell(tubeB, 'screenHalo', false, 1.4, 5), bloom: shell(tubeB, 'screenBloom', false, 2.4, 4) };
  // the lunette ring draws like the arch (from the crown down), then its springing chord closes from both ends
  // flares riding the ignition heads + a crown burst + a lock-on flash at the device's screen ring
  const flareMat = () => reg.m(new THREE.SpriteMaterial({ map: tFlare, color: 0xffffff, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  const flares = [0, 1, 2].map(() => { const s = new THREE.Sprite(flareMat()); s.renderOrder = 8; s.visible = false; root.add(s); return s; });

  /* ── embers: seeded on the façade, born when the dissolve front passes, stream into the new outline ── */
  // Dissolve pacing: dzOf(x) is the quantile of the dissolve field over the stone's camera-visible area (every face,
  // weighted by how much it faces the sequence camera), from below the field minimum (no scorch at morph 0) to past
  // its maximum — equal steps of `morph` burn roughly equal visible area, and the far cornice blocks go last but
  // gradually (the earlier front-face-only sample stopped at 90 % and left the corners to a ~0.03 u pop).
  let embers = null, dzOf = null, dzEnd = 1;
  {
    const n = Math.max(1024, o.embers | 0), r = rng(41), P = stoneGeo.attributes.position.array, Nn = stoneGeo.attributes.normal.array, tri = P.length / 9;
    const cum = new Float32Array(tri); let tot = 0;
    for (let i = 0; i < tri; i++) {
      const a = i * 9, nz = (Nn[a + 2] + Nn[a + 5] + Nn[a + 8]) / 3, cz = (P[a + 2] + P[a + 5] + P[a + 8]) / 3;
      const ux = P[a + 3] - P[a], uy = P[a + 4] - P[a + 1], uz = P[a + 5] - P[a + 2], vx = P[a + 6] - P[a], vy = P[a + 7] - P[a + 1], vz = P[a + 8] - P[a + 2];
      const area = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
      tot += nz > 0.3 && cz > g.zc ? area : 0; cum[i] = tot;
    }
    const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), aB = new Float32Array(n * 4), tgt = new Float32Array(n * 3);
    const archD = (x, y) => { const ax = Math.abs(x); if (y > g.yS) return Math.abs(Math.hypot(ax, y - g.yS) - g.r); if (ax < g.r) return Math.min(g.r - ax, Math.max(g.yThr - y, 0));
      const kb = lerp(0.55, 1, smooth((y - (g.yThr - 0.02)) / 0.32)); return Math.hypot((ax - g.r) * kb, Math.max(g.yThr - y, 0)); }; // = ymArchDist
    for (let k = 0; k < n; k++) {
      const pick = r() * tot; let lo = 0, hi2 = tri - 1; while (lo < hi2) { const mid = (lo + hi2) >> 1; if (cum[mid] < pick) lo = mid + 1; else hi2 = mid; }
      let u = r(), v = r(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
      const a = lo * 9;
      for (let c = 0; c < 3; c++) pos[k * 3 + c] = P[a + c] + u * (P[a + 3 + c] - P[a + c]) + v * (P[a + 6 + c] - P[a + c]);
      const x = pos[k * 3], y = pos[k * 3 + 1];
      const birth = clamp(archD(x, y) / 1.05) * 0.74 + 0.16 * (0.3 + 0.4 * r()) + 0.045 * r() - 0.01;
      vel[k * 3] = (x >= 0 ? 1 : -1) * (0.04 + 0.1 * r()); vel[k * 3 + 1] = 0.05 + 0.2 * r(); vel[k * 3 + 2] = 0.1 + 0.25 * r();
      aB[k * 4] = birth; aB[k * 4 + 1] = r(); aB[k * 4 + 2] = 0.01 + 0.02 * Math.pow(r(), 2); aB[k * 4 + 3] = r();
      // target: the device rim point at the same angle around the panel centre
      const ang = Math.atan2(y - 0.72, x); let s = ((Math.PI / 2 - ang) / TAU) % 1; if (s < 0) s += 1;
      const ti = Math.min(loopA.count - 1, Math.floor(s * loopA.count));
      tgt[k * 3] = loopA.target[ti * 3]; tgt[k * 3 + 1] = loopA.target[ti * 3 + 1]; tgt[k * 3 + 2] = loopA.target[ti * 3 + 2];
    }
    const fld = (x, y, z) => clamp(archD(x, y) / 1.05) * 0.74 + clamp((g.zF - z) / 0.9) * 0.06;
    let fMax = 0;
    for (let i = 0; i < P.length; i += 3) fMax = Math.max(fMax, fld(P[i], P[i + 1], P[i + 2]));
    const d0 = -0.12, d1 = fMax + 0.16 * 0.9 + 0.045 + 0.01;
    const vcum = new Float32Array(tri); let vt = 0;
    for (let i = 0; i < tri; i++) {
      const a = i * 9, nx = (Nn[a] + Nn[a + 3] + Nn[a + 6]) / 3, ny = (Nn[a + 1] + Nn[a + 4] + Nn[a + 7]) / 3, nz = (Nn[a + 2] + Nn[a + 5] + Nn[a + 8]) / 3;
      const ux = P[a + 3] - P[a], uy = P[a + 4] - P[a + 1], uz = P[a + 5] - P[a + 2], vx = P[a + 6] - P[a], vy = P[a + 7] - P[a + 1], vz = P[a + 8] - P[a + 2];
      vt += 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) * Math.max(0, 0.93 * nz + 0.2 * ny - 0.3 * nx); vcum[i] = vt;
    }
    const rq = rng(43), M = 4096, fs = new Float32Array(M);
    for (let k = 0; k < M; k++) {
      const pick = rq() * vt; let lo = 0, hi2 = tri - 1; while (lo < hi2) { const mid = (lo + hi2) >> 1; if (vcum[mid] < pick) lo = mid + 1; else hi2 = mid; }
      let u = rq(), v = rq(); if (u + v > 1) { u = 1 - u; v = 1 - v; } const a = lo * 9, q = [0, 0, 0];
      for (let c = 0; c < 3; c++) q[c] = P[a + c] + u * (P[a + 3 + c] - P[a + c]) + v * (P[a + 6 + c] - P[a + c]);
      fs[k] = fld(q[0], q[1], q[2]) + 0.16 * (0.3 + 0.4 * rq()) + 0.045 * rq();   // ≈ the shader's noise terms
    }
    fs.sort();
    const KN = 40, kx = [0], ky = [d0];
    for (let k = 1; k < KN; k++) { kx.push(0.02 + 0.93 * k / KN); ky.push(fs[Math.min(M - 1, Math.round(k / KN * (M - 1)))]); }
    kx.push(1); ky.push(d1);
    dzOf = (x) => { x = clamp(x); let i = 0; while (i < kx.length - 2 && x > kx[i + 1]) i++; return lerp(ky[i], ky[i + 1], clamp((x - kx[i]) / (kx[i + 1] - kx[i]))); };
    dzEnd = d1;
    if (o.embers > 0) {
    const eg = reg.g(new THREE.BufferGeometry());
    eg.setDrawRange(0, o.embers | 0);
    eg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); eg.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    eg.setAttribute('aB', new THREE.BufferAttribute(aB, 4)); eg.setAttribute('aTgt', new THREE.BufferAttribute(tgt, 3));
    const em = reg.m(new THREE.ShaderMaterial({
      uniforms: { uD: { value: -1 }, uT: U.uT, uLife: { value: 0.26 }, uPx: { value: 540 }, uCol: { value: new THREE.Color() }, uI: { value: 1 } },
      vertexShader: /* glsl */`
        attribute vec3 aVel; attribute vec4 aB; attribute vec3 aTgt;
        uniform float uD; uniform float uT; uniform float uLife; uniform float uPx;
        varying float vA; varying float vHot;
        void main(){
          float age = (uD - aB.x) / uLife; vA = 0.0; vHot = 0.0; vec3 p = position;
          if (age > 0.0 && age < 1.0) {
            float s = aB.y * 40.0;
            p += aVel * age * 0.55 + vec3(sin(uT * 1.7 + s), cos(uT * 1.3 + s * 0.7), sin(uT * 1.1 + s * 1.3)) * 0.02 * age;
            p.y += 0.1 * age * age;
            float k = smoothstep(0.3, 1.0, age); k = k * k;
            p = mix(p, aTgt, k * (0.55 + 0.45 * aB.w));
            vA = sin(3.14159 * pow(age, 0.6)); vHot = 1.0 - smoothstep(0.0, 0.25, age);
          }
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = vA > 0.0 ? max(1.0, aB.z * uPx * projectionMatrix[1][1] / max(0.05, -mv.z)) : 0.0;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uCol; uniform float uI; varying float vA; varying float vHot;
        void main(){ if (vA <= 0.0) discard; float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a *= a;
          gl_FragColor = vec4(mix(uCol * 3.0, vec3(2.4), 0.12 + 0.5 * vHot) * a * vA * uI, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    embers = new THREE.Points(eg, em); embers.frustumCulled = false; embers.renderOrder = 7; embers.name = 'embers';
    const _v2 = new THREE.Vector2();
    embers.onBeforeRender = (renderer) => { renderer.getDrawingBufferSize(_v2); em.uniforms.uPx.value = _v2.y / 2; };
    root.add(embers);
    }
  }

  /* ═════════ anchors ═════════ */
  const anchors = {};
  const addA = (name, x, y, z) => { const a = new THREE.Object3D(); a.name = 'anchor:' + name; a.position.set(x, y, z); root.add(a); anchors[name] = a; return a; };
  addA('deviceOrigin', devPos.x, devPos.y, devPos.z);
  addA('archCrown', 0, g.crown, g.zF); addA('archCenter', 0, g.yS, g.zF); addA('keystone', 0, 1.34, g.zF + 0.04);
  addA('plaque', 0, 1.483, g.zF + 0.02); addA('threshold', 0, g.yThr, g.zF); addA('portal', 0, 0.8, g.zB - 0.45); addA('gateTop', 0, g.top, g.zc);
  { const v = new THREE.Vector3(0, D.yTop + D.rimR, D.rimZ).applyMatrix4(devM); addA('rimTop', v.x, v.y, v.z);
    v.set(0, D.yTop, D.ringZ).applyMatrix4(devM); addA('screenCenter', v.x, v.y, v.z); }

  /* ═════════ device binding (dissolve-in on the device's own materials) ═════════ */
  const RU = { uR: { value: 2 }, uDevInv: { value: new THREE.Matrix4() }, uRim: { value: new THREE.Vector4(D.rimR, D.yTop, D.yBot, D.zf) }, uZP: { value: D.zP }, uShR: { value: D.R }, uREdge: { value: new THREE.Color() } };
  const GLSL_REVEAL = /* glsl */`
    uniform float uR; uniform mat4 uDevInv; uniform vec4 uRim; uniform float uZP; uniform float uShR; uniform vec3 uREdge; varying vec3 vYmW;
    float ymRevealK = 0.0; float ymRevealEdge = 0.0; float ymRevealLine = 0.0;
    ${GLSL_NOISE}
    float ymDevField(vec3 q){
      float yc = clamp(q.y, uRim.z, uRim.y);
      float dr = abs(length(vec2(q.x, q.y - yc)) - uRim.x);
      float fz = clamp((uRim.w + 0.035 - q.z) / 0.62, 0.0, 1.0);
      float low = clamp((uRim.z - uRim.x - 0.005 - q.y) / 0.16, 0.0, 1.0);    // base + casters ground it last
      float front = clamp((q.z - uZP - 0.003) / 0.05, 0.0, 1.0);             // bracket / handpieces / cables after the panel
      float outside = clamp((abs(q.x) - uShR - 0.004) / 0.02, 0.0, 1.0) * (1.0 - low); // side handles ride in with the shell, not ahead of it
      return 0.14 * clamp(dr / 0.3, 0.0, 1.0) + 0.13 * front + 0.26 * outside + 0.78 * fz * (1.0 - 0.5 * low) + 0.32 * low;
    }`;
  const bound = new Map(); let revealDepth = null, boundRoot = null; const depthSaved = new Map();
  const revealVert = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vYmW;')
      .replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 ymWP = vec4(transformed, 1.0);
        #ifdef USE_BATCHING
          ymWP = batchingMatrix * ymWP;
        #endif
        #ifdef USE_INSTANCING
          ymWP = instanceMatrix * ymWP;
        #endif
        vYmW = (modelMatrix * ymWP).xyz; }`);
  };
  const revealFrag = (sh, full) => {
    let f = sh.fragmentShader.replace('#include <common>', `#include <common>\n${GLSL_REVEAL}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      { vec3 q = (uDevInv * vec4(vYmW, 1.0)).xyz; float fs = ymDevField(q);
        float age = uR - (fs + 0.07 * ymFbm(q * 5.0)); if (age < 0.0) discard;   // clean scan front with a slight breakup
        ymRevealEdge = 1.0 - smoothstep(0.0, 0.022, age); ymRevealLine = 1.0 - smoothstep(0.0, 0.006, age);
        ymRevealK = 1.0 - smoothstep(0.0, 0.2, uR - fs - 0.035); }`);
    if (full) {
      f = f.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.88, 0.84), ymRevealK * 0.8 * smoothstep(0.08, 0.45, dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))));')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.85, ymRevealK);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor = mix(metalnessFactor, 0.0, ymRevealK);')
        .replace('#include <opaque_fragment>', 'outgoingLight += uREdge * ymRevealEdge * ymRevealEdge * 3.0 + mix(uREdge, vec3(1.0), 0.5) * ymRevealLine * 5.0;\n#include <opaque_fragment>');
    }
    sh.fragmentShader = f;
  };
  function patchReveal(mat) {
    if (!mat || bound.has(mat) || mat.isShaderMaterial || mat.isRawShaderMaterial || mat.isPointsMaterial || mat.isSpriteMaterial || mat.isLineBasicMaterial) return;
    const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
    bound.set(mat, { prev, prevKey });
    const key = prevKey.call(mat);
    mat.onBeforeCompile = (sh, r) => { prev.call(mat, sh, r); Object.assign(sh.uniforms, RU); revealVert(sh); revealFrag(sh, true); };
    mat.customProgramCacheKey = () => key + '|ym3d-gate-reveal';
    mat.needsUpdate = true;
  }
  function bindDevice(dev) {
    unbindDevice();
    boundRoot = dev && dev.object3d ? dev.object3d : dev;
    if (!boundRoot) return;
    if (!revealDepth) {
      revealDepth = reg.m(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
      revealDepth.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, RU); revealVert(sh); revealFrag(sh, false); };
      revealDepth.customProgramCacheKey = () => 'ym3d-gate-reveal-depth';
    }
    boundRoot.traverse((m) => {
      if (!m.material) return;
      (Array.isArray(m.material) ? m.material : [m.material]).forEach(patchReveal);
      if (m.isMesh && m.castShadow) { depthSaved.set(m, m.customDepthMaterial); m.customDepthMaterial = revealDepth; }
    });
  }
  function unbindDevice() {
    for (const [mat, s] of bound) { mat.onBeforeCompile = s.prev; mat.customProgramCacheKey = s.prevKey; mat.needsUpdate = true; }
    bound.clear();
    for (const [m, d] of depthSaved) m.customDepthMaterial = d;
    depthSaved.clear(); boundRoot = null;
  }
  const _pm = new THREE.Matrix4(), _pp = new THREE.Vector3(), _pq = new THREE.Quaternion(), _ps = new THREE.Vector3();
  function placeDevice(obj) {
    root.updateWorldMatrix(true, false);
    _pm.multiplyMatrices(root.matrixWorld, devM);
    if (obj.parent) { obj.parent.updateWorldMatrix(true, false); _pm.premultiply(_pinv.copy(obj.parent.matrixWorld).invert()); }
    _pm.decompose(_pp, _pq, _ps); obj.position.copy(_pp); obj.quaternion.copy(_pq); obj.scale.copy(_ps); obj.updateMatrixWorld(true);
    return obj;
  }
  const _pinv = new THREE.Matrix4();

  /* ═════════ update ═════════ */
  const _seq = {}, _col = new THREE.Color(), _col2 = new THREE.Color(), _v = new THREE.Vector3();
  const flow = (L, cur, w, m, stagger, lift, fromZ) => {
    const S = L.source, T = L.target, n = L.count;
    for (let i = 0; i < n; i++) {
      const mi = easeInOut(clamp(m * (1 + stagger) - stagger * w[i])), k = i * 3;
      cur[k] = lerp(S[k], T[k], mi); cur[k + 1] = lerp(S[k + 1], T[k + 1], mi);
      cur[k + 2] = lerp(S[k + 2], T[k + 2], mi) + lift * Math.sin(Math.PI * mi) + fromZ * (1 - mi);
    }
  };
  const setShell = (sh, rad, col, I, draw, t, fl) => { const u = sh.material.uniforms; u.uRad.value = rad; u.uCol.value.copy(col); u.uI.value = I; u.uDraw.value = draw; u.uT.value = t; u.uFlow.value = fl; sh.visible = I > 1e-4; };

  function update(params = {}) {
    const u = fin(params.u);
    const base = u !== undefined ? gateSequence(u, _seq) : null;
    const t = fin(params.t) ?? 0;
    const purple = clamp(fin(params.purple) ?? (base ? base.purple : 0));
    const morph = clamp(fin(params.morph) ?? (base ? base.morph : 0));
    const reveal = clamp(fin(params.reveal) ?? (base ? base.reveal : 0));
    const ignite = clamp(fin(params.ignite) ?? (base ? base.ignite : seg(purple, 0.2, 0.9, smooth)));
    U.uT.value = t;

    // hue: 清华紫 → brand violet as the morph completes
    const hueK = seg(morph, 0.45, 1.0, smooth);
    const pc = _col.copy(colTP).lerp(colDV, hueK);
    U.uPurpleCol.value.copy(pc); U.uPurple.value = purple;
    // the white studio fill (env) would lift the 清华紫 wash into pastel lilac: the stone's env response dims as the purple
    // takes the stage (deep saturated mid-tones, white only in the hottest grazing highlights)
    stoneMat.envMapIntensity = plaqueMat.envMapIntensity = 0.42 * (1 - 0.85 * purple);
    // dissolve front: linear sweep of the field (morph is already eased by the sequence)
    const dz = dzOf(seg(morph, 0.03, 0.9, (x) => x));
    U.uD.value = dz;
    U.uEdgeCol.value.copy(pc).multiplyScalar(1.5);
    U.uLine.value = ignite * (1 - seg(morph, 0.0, 0.25)) * (0.5 + 0.5 * purple);
    U.uPlaqueGlow.value = purple * 0.25 * (1 - seg(morph, 0, 0.3));
    const stoneOn = dz < dzEnd - 1e-4;
    stone.visible = stoneOn; plaque.visible = stoneOn;
    root.updateWorldMatrix(true, false);
    const floorY = root.matrixWorld.elements[13];

    // lights (façade-grazing, doorway, back rim) — fade toward the device reveal
    const Lk = purple * (1 - 0.6 * reveal);
    if (lights.passage) {
      lights.passage.color.copy(pc); lights.passage.intensity = 1.6 * Lk * (1 - 0.7 * seg(morph, 0.2, 0.9));
      lights.graze.color.copy(pc); lights.graze.intensity = 18 * Lk * (1 - 0.5 * seg(morph, 0.3, 1));
      lights.back.color.copy(pc); lights.back.intensity = 22 * Lk * (1 - 0.6 * seg(morph, 0.4, 1));
    }
    // atmosphere
    if (portal) {
      const k = purple * (1 - 0.5 * seg(morph, 0.2, 1)) * (1 - 0.3 * seg(reveal, 0.3, 1, smooth));
      // anchor: the doorway centre → the console's panel centre as it materialises (billboard, centred behind it)
      const rk = seg(reveal, 0.0, 0.8, smooth);
      portal.position.set(lerp(0, devPos.x, rk), lerp(0.95, devPos.y + 0.74 * devS.y, rk), lerp(0, devPos.z, rk)); portal.scale.setScalar(lerp(1, 0.82, rk));
      portal.material.uniforms.uCol.value.copy(pc).multiplyScalar(0.9 * k); portal.material.uniforms.uFloorY.value = floorY; portal.visible = k > 1e-4;
      // doorway core: saturated (no white lift → stays 清华紫, not pastel lilac); gone before the outline is a stadium,
      // otherwise it fills the new outline and reads as a solid capsule
      const kc = 1.25 * k * (1 - seg(morph, 0.05, 0.5));
      portalCore.material.uniforms.uCol.value.copy(pc).multiplyScalar(kc); portalCore.material.uniforms.uFloorY.value = floorY; portalCore.visible = kc > 1e-4;
    }
    if (beam) { const k = purple * (1 - seg(morph, 0.0, 0.35)); beam.material.uniforms.uCol.value.copy(pc); beam.material.uniforms.uI.value = 0.7 * k; beam.material.uniforms.uT.value = t; beam.visible = k > 1e-4; }
    if (pool) { const k = purple * (1 - 0.6 * seg(morph, 0.2, 1)) * (1 - 0.5 * reveal); pool.material.color.copy(pc).multiplyScalar(0.3 * k); pool.visible = k > 1e-4; }
    if (haze) {
      const k = purple * (1 - 0.72 * seg(morph, 0.35, 0.95, smooth)) * (1 - 0.5 * reveal), hu = haze.material.uniforms;
      hu.uCol.value.copy(pc); hu.uI.value = k; hu.uT.value = t; hu.uFloorY.value = floorY; haze.visible = k > 1e-4;
    }

    // outline morph
    const lift = 0.07 * (1 - reveal);
    flow(loopA, loopA.current, wA, morph, 0.14, lift, 0);
    flow(loopB, loopB.current, wB, morph, 0.2, lift * 0.8, 0.0);
    tubeA.set(loopA.current); tubeB.set(loopB.current);
    const lockPulse = bell(reveal, 0.0, 0.1, 0.4);
    const fade = 1 - seg(reveal, 0.45, 0.95, smooth);
    const IA = (ignite > 0 ? 1 : 0) * (0.4 + 0.6 * purple) * fade * (1 + 0.5 * lockPulse);
    const drawB = seg(morph, 0.0, 0.26, smooth);
    const IB = (drawB > 0 ? 1 : 0) * (0.4 + 0.6 * purple) * fade * (1 + 0.5 * lockPulse) * 0.8;
    const shrink = lerp(1, 0.62, seg(morph, 0.2, 0.9));
    const coreCol = _col2.copy(pc).lerp(WHITE, 0.5);
    const fl = 0.8 * purple;
    setShell(A.core, 0.0026 * shrink, coreCol, IA * 2.2, ignite * 1.02, t, fl);
    setShell(A.halo, 0.011 * shrink, pc, IA * 1.7, ignite * 1.02, t, fl);
    setShell(A.bloom, 0.045 * shrink, pc, IA * 0.45, ignite * 1.02, t, fl);
    setShell(B.core, 0.002 * shrink, coreCol, IB * 2.0, drawB * 1.02, t, fl);
    setShell(B.halo, 0.009 * shrink, pc, IB * 1.5, drawB * 1.02, t, fl);
    setShell(B.bloom, 0.036 * shrink, pc, IB * 0.35, drawB * 1.02, t, fl);

    // flares: two ignition heads, crown burst, lock-on flash
    {
      const n = loopA.count, cur = loopA.current, head = ignite * 0.5 * n, ok = ignite > 0.001 && ignite < 0.999 && IA > 0;
      const iR = Math.min(n - 1, Math.round(head)), iL = (n - Math.round(head)) % n;
      // heads fade in / out at both ends (they used to vanish at 35 % opacity the frame the heads met at the threshold)
      const fk = ok ? (0.8 * bell(ignite, 0, 0.12, 1.0) + 0.35) * smooth(ignite / 0.04) * (1 - smooth((ignite - 0.88) / 0.11)) : 0, fs = 0.14;
      flares[0].position.set(cur[iR * 3], cur[iR * 3 + 1], cur[iR * 3 + 2] + 0.01); flares[1].position.set(cur[iL * 3], cur[iL * 3 + 1], cur[iL * 3 + 2] + 0.01);
      for (let fi = 0; fi < 2; fi++) { const f = flares[fi]; f.visible = ok; f.material.color.copy(pc).lerp(WHITE, 0.45); f.material.opacity = fk; f.scale.set(fs * 2.2, fs, 1); }
      const crown = bell(ignite, 0.0, 0.08, 0.5) * 0.9 + lockPulse * 0.8;
      if (lockPulse > 0) flares[2].position.set(loopA.current[0], loopA.current[1], loopA.current[2] + 0.02);
      else flares[2].position.set(cur[0], cur[1], cur[2] + 0.01);
      flares[2].visible = crown > 1e-3; flares[2].material.color.copy(pc).lerp(WHITE, 0.5); flares[2].material.opacity = Math.min(1, crown);
      const cs = 0.26 + 0.2 * lockPulse; flares[2].scale.set(cs * lerp(2.4, 1.5, lockPulse), cs, 1); // lock-on: no frame-wide streak line
    }

    // embers
    if (embers) { embers.material.uniforms.uCol.value.copy(pc); embers.material.uniforms.uI.value = 1;
      const de = dz + 0.34 * seg(morph, 0.86, 1.0, (x) => x); embers.material.uniforms.uD.value = de; // keep ageing after the stone is gone → none left frozen
      embers.visible = de > -0.03 && de < dzEnd + 0.33; }

    // device reveal uniforms
    RU.uR.value = lerp(-0.04, 1.26, reveal); // max field ≈ 0.99 + 0.235 tint band → fully clear at reveal = 1
    RU.uREdge.value.copy(colRV).lerp(colDV, 0.5).multiplyScalar(1.4);
    RU.uDevInv.value.multiplyMatrices(root.matrixWorld, devM).invert();
  }
  update({});

  const view = { target: [0, 0.97, 0.1], radius: 6.7, azimuth: -0.28, elevation: 0.04, fov: 30 };
  const views = { wide: gateCameraAt(0), arch: gateCameraAt(0.52), device: gateCameraAt(1) };
  return {
    object3d: root, update, view, views, dims: { gate: GD, device: D },
    cameraAt: gateCameraAt, sequence: gateSequence, deviceBlend: gateDeviceBlend,
    devicePlacement, placeDevice, bindDevice, unbindDevice,
    curves: { rim: loopA, screen: loopB },
    parts: { stone, plaque, portal, portalCore, pool, haze, lights, outline: A, screenRing: B, flares, embers },
    anchorNames: Object.keys(anchors),
    anchor(name, out = new THREE.Vector3()) { const a = anchors[name]; if (!a) return null; a.updateWorldMatrix(true, false); return out.setFromMatrixPosition(a.matrixWorld); },
    dispose() { unbindDevice(); root.removeFromParent(); reg.dispose(); },
  };
}
