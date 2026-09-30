// YM3D · skincube — 3D cut-away block of facial skin (premium medical-3D look) that shows the
// YOUMAGIC mechanism (monopolar RF current → dermal heat, surface cooling, immediate collagen
// contraction) and the skin changes over 12 weeks (neocollagenesis, softened wrinkles).
// 原理示意 simulation — the host must show the 模拟示意 label next to it (see README · Compliance).
// Compliance (知识库 §2/§11): the heat field stays in the superficial/mid skin (IFU "皮肤浅中层产热"; septal
// conduction only reaches the top of the subcutis); do NOT label the bottom strip "SMAS" as a target, and never
// print depths (mm) or temperatures (°C) next to this block. The demo labels it 肌肉层 / Muscle.
//
// Contract: ES module, NO imports. THREE (r170) is injected. update(params) is a pure function of
// params (no clocks, no Math.random, no per-frame allocation) → same params = same pixels.
//
// ─── Units & layout ─────────────────────────────────────────────────────────────────────────────
//   1 world unit = 1 cm horizontally. Footprint x,z ∈ [-2, 2] (4 × 4 cm). Skin surface at y ≈ 0,
//   block bottom at y = -2.32. Layer thickness is an ILLUSTRATION scale (vertically exaggerated
//   ≈×10, like every medical 3D section): stratum corneum 0.024 · epidermis ≈0.11–0.20 (rete
//   ridges) · papillary dermis → ≈-0.36 · reticular dermis → ≈-1.1 (-1.22 at week 12, dermis
//   thickens) · subcutis (fat lobules + fibrous septa) → -2.02 · SMAS/muscle strip → -2.32.
//   The electrode tip (4.0 cm² ⇒ 2 × 2) sits on the top centre; neutral pad below the block.
//   Camera suggestions (fov 30): overview stage.orbit({ target:[0,-0.85,0], radius:14.5, azimuth:0.62,
//   elevation:0.40 }); RF close-up { target:[0,-0.75,0], radius:11.5, azimuth:0.72, elevation:0.32 };
//   notch macro { target:[0,-0.64,0], radius:6–8.5, azimuth:0.78, elevation:0.2 }; wrinkles from above
//   { target:[0,-0.6,0], radius:11.5, azimuth:0.35, elevation:0.78 }.
//   Front (+z) and right (+x) faces are the "hero" cut faces; the cutaway notch opens the
//   front-right quadrant (x > xc, z > zc) of the epidermis + dermis down to the subcutis.
//
// ─── createSkinCube(THREE, opts) → { object3d, update(params), dispose(), anchor(name, out?),
//                                   anchors, refreshFace(), layers(week), ratios(week), groups } ─────
//   opts.lib         stage.mjs namespace (import * as YM from './stage.mjs'); BRAND.heat (heat scale)
//                    and rng are taken from it. Optional — an identical internal fallback is used.
//   opts.seed        integer specimen seed (fibre layout, mist) [7]
//   opts.smas        include the SMAS / muscle strip at the bottom [true]
//   opts.tip         Object3D to use as the treatment tip (e.g. from device.mjs). Its origin must be
//                    the electrode-face centre, +y up, units cm (face ≈ 2 × 2). Default: built-in
//                    black cap + gold electrode + short silver handpiece stub.
//   opts.handle      built-in tip: include the silver handpiece stub [true]
//   opts.pad         show the neutral (return) electrode pad [true]
//   opts.padPosition [x,y,z] pad centre in tissue coords [[0.35,-3.35,0.55]]
//   opts.faceCanvas  HTMLCanvasElement (e.g. SkinFX.Histology output, created with
//                    preserveDrawingBuffer:true) mapped onto the FRONT cut face (z = +2).
//                    Call refreshFace() after re-rendering that canvas (re-uploads + regenerates mipmaps).
//   opts.faceCanvasRange {yTop, yBottom}: tissue y of the canvas top / bottom edge. The default
//                    matches Histology at magnification 0 (surface at 11 % of the height,
//                    dermis base at ≈69 %): {yTop:0.209, yBottom:-1.688}.
//   opts.fibres      {typeI, typeIII} base (week-0) instance counts [{typeI:280, typeIII:420}]
//   opts.fibreRadial   {typeI, typeIII} (or one number for both) sides of each fibre tube [{typeI:6, typeIII:5}]
//   opts.fibreSegments {typeI, typeIII} (or one number) segments along each fibre [{typeI:36, typeIII:24}]
//                    Defaults = the real-time budget (website). Macro close-ups that fill the frame with
//                    fibres opt in, e.g. radial {12, 10} + segments {96, 64} (round tubes and ends, smooth
//                    Type Ⅰ helix / Type Ⅲ crimp; ≈4× the fibre triangles, still one draw call per type).
//   opts.collagen    {weeks:[0,4,12], type1:[1,1.42,1.61], type3:[1,1.38,1.49]} (data.charts.collagen)
//   opts.mist        cooling mist sprite count [84]
//
// ─── update(params) — all optional ─────────────────────────────────────────────────────────────
//   t            seconds; drives current pulses, heat shimmer, mist drift, frost twinkle   [0]
//   tip          0..1 tip presence (0 = lifted out of view & hidden)                         [1]
//   tipPress     0..1 (0 = hovering 0.45 above the skin, 0.6 = touching, 1 = pressed: the
//                skin under the electrode is dented 0.045 with a soft bulge ring)          [0]
//   current      0..1 RF current: glowing flow tubes from the electrode, diverging through the
//                dermis & septa, leaving the block bottom and converging on the neutral pad
//                (monopolar return path). Faint inside tissue, bright in the open/notch.   [0]
//   heat         0..1 dermal heat: nested isothermal shells (brand heat scale) under the tip in
//                the mid/deep dermis + heat map & isotherm lines on every cut face + septal
//                heat in the subcutis + sub-surface glow. Suppressed near the cooled surface
//                (reverse thermal gradient).                                                 [0]
//   cool         0..1 cryogen cooling: frost + cool-blue tint spreading on the skin around the
//                tip, drifting mist, descending cool front in the epidermis on the cut faces. [0]
//   contraction  0..1 immediate thermal effect (原理示意): fibres near the heated zone shorten,
//                thicken, straighten and are pulled toward the tip axis; clefts close.       [0]
//   week         0..12 neocollagenesis: Type Ⅰ/Ⅲ fibre count follows the collagen ratio curve
//                (1.00/1.42/1.61 and 1.00/1.38/1.49 at 0/4/12 w, smooth saturating fit);
//                bundles thicker & more organised, dermis thicker, denser section texture.   [0]
//   wrinkle      0..1 expression-wrinkle depth (1 = as-is, 0.3 = softened; never fully flat)  [1]
//   cutaway      0..1 opens the front-right notch (xc = zc = 2 − 2·cutaway; 1 = through the tip
//                axis). Inside the notch the dermal matrix is "dissolved" so the 3D collagen
//                scaffold and the heat shells stand free on the fat floor.                  [0]
//   fibreFill    0..1 how far the free-standing collagen scaffold fills the notch: 0 = fibres only
//                protrude ≈0.3 from the notch walls (leaves room to see heat / walls), 1 = fills it [0.25]
//   xray         0..1 dermis cut faces become translucent (fibres visible through them)       [0]
//   explode      0..1 layers separate vertically (epidermis/tip up, subcutis/muscle/pad down) [0]
//   rotate       radians, turntable rotation about y                                          [0]
//   pad          0..1 neutral-pad presence (0 = slid away & hidden, e.g. for collagen-only shots) [1]
//   stainMode    'he' (natural / H&E-inspired colours) | 'darkfield' (stylised fluorescence on
//                ink). `stain` (number, 1 = he, 0 = darkfield) overrides it for transitions.  ['he']
//   highlight    0 none | 1 emphasise Type Ⅰ | 3 emphasise Type Ⅲ ; highlightAmount 0..1 [0, 1]
//   faceMix      0..1 blend of opts.faceCanvas on the front face                              [1]
//
// anchor(name, out?) → THREE.Vector3 in WORLD space (call after update; uses matrixWorld):
//   'surface','epidermis','dermis','papillary','reticular','subcutis','smas','heatCore','tip',
//   'tipTop','pad','typeI','typeIII','cool','wrinkle','notch','current'. `anchors` lists them.
//   Layer anchors sit on the front-left vertical edge (x=-2, z=+2) of each layer.
//
// Performance (Apple M-series, headless Chrome/Metal, whole demo scene): ≈10–11 ms/frame at
// 1440×900 dpr 1, ≈20 ms at dpr 2 (2880×1800) → cap dpr at ~1.5 for 60 fps. ~15 draw calls,
// ≤1.1k fibre instances at week 12. Cost is per-pixel procedural shading of the cut faces.
// No postprocessing; glow = additive meshes + emissive. Programs compile on the first render (~1 s).
// Anti-aliasing: the procedural cell / furrow / lamination patterns are band-limited with screen-space
// derivatives (fade to their mean below a few pixels per cell); for full-frame macro video shots
// additionally supersample the stage (createStage dpr 1.5–2 on a 1× canvas).
// Extras: groups {epidermis, dermis, subcutis, smas, pad, tip} (explode offsets are applied to them).

const FALLBACK_HEAT = [0x0b1030, 0x2a1548, 0x6a2a8c, 0xb8307a, 0xf0603f, 0xffc45e, 0xfff4d6]; // = stage.mjs BRAND.heat
function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

/* collagen ratio: r(w) = 1 + A(1 − e^{−kw}) through (0,1), (4,r4), (12,r12) — same fit as SkinFX.Histology */
function fitSat(r4, r12) { const R = (r12 - 1) / (r4 - 1); const x = (-1 + Math.sqrt(Math.max(1e-6, 4 * R - 3))) / 2; return { A: (r4 - 1) / (1 - x), k: -Math.log(x) / 4 }; }

/* ════════════════════════════════════════ GLSL: shared ════════════════════════════════════════ */
const GLSL_COMMON = /* glsl */`
uniform float uT, uWrinkle, uDent, uTipOn, uHeat, uCool, uCoolDepth, uCurrent, uContract;
uniform float uG1, uG3, uStain, uXray, uSmas, uHi1, uHi3;
uniform vec2 uNotch;      // (xc, zc) of this mesh (2,2 = closed)
uniform vec2 uNotchG;     // global notch (for fibres / shells)
uniform vec2 uTipC;
uniform vec3 uHeatC, uHeatR;
uniform vec3 uRamp[7];

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec3 hash33(vec3 p3){ p3 = fract(p3 * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
float vnoise3(vec3 p){ vec3 i = floor(p), f = fract(p); vec3 u = f*f*(3.-2.*f);
  return mix(mix(mix(hash13(i), hash13(i+vec3(1,0,0)), u.x), mix(hash13(i+vec3(0,1,0)), hash13(i+vec3(1,1,0)), u.x), u.y),
             mix(mix(hash13(i+vec3(0,0,1)), hash13(i+vec3(1,0,1)), u.x), mix(hash13(i+vec3(0,1,1)), hash13(i+vec3(1,1,1)), u.x), u.y), u.z); }
float fbm2(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a*vnoise(p); p = p*2.07 + vec2(3.1, 1.7); a *= .5; } return s; }
float fbm3(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a*vnoise3(p); p = p*2.03 + vec3(1.7, 9.2, 3.1); a *= .5; } return s; }
float fbm3b(vec3 p){ return 0.667*vnoise3(p) + 0.333*vnoise3(p*2.03 + vec3(1.7, 9.2, 3.1)); }
// 2D / 3D Voronoi → (F1, F2, cell hash)
vec3 voro2(vec2 p){ vec2 i = floor(p), f = fract(p); float F1 = 8., F2 = 8., id = 0.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){ vec2 g = vec2(float(x), float(y)); vec2 r = g + hash22(i+g) - f; float d = dot(r, r);
    if (d < F1){ F2 = F1; F1 = d; id = hash12(i + g + 7.7); } else if (d < F2) F2 = d; }
  return vec3(sqrt(F1), sqrt(F2), id); }
vec3 voro3(vec3 p){ vec3 i = floor(p), f = fract(p); float F1 = 8., F2 = 8., id = 0.;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){ vec3 g = vec3(float(x), float(y), float(z)); vec3 r = g + hash33(i+g) - f; float d = dot(r, r);
    if (d < F1){ F2 = F1; F1 = d; id = hash13(i + g + 3.3); } else if (d < F2) F2 = d; }
  return vec3(sqrt(F1), sqrt(F2), id); }
vec3 ramp(float x){ x = clamp(x, 0., 1.) * 6.; int i = int(min(floor(x), 5.)); return mix(uRamp[i], uRamp[i+1], x - float(i)); }
// heat overlay colour: upper part of the brand heat scale so it never reads as tissue pink/violet
vec3 heatCol(float h){ return ramp(0.48 + 0.52*clamp(h, 0., 1.)); }

/* ── skin surface & layer boundaries (tissue coords, cm) ── */
float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
float tipSDF(vec2 xz){ return rbox(xz - uTipC, vec2(1.0), 0.22); }
float wline(vec2 p, float z0, float ph, float x0, float x1){
  float zc = z0 + 0.07*sin(p.x*1.1 + ph) + 0.025*sin(p.x*2.9 + ph*1.7);
  float d = p.y - zc;
  float w = mix(0.095, 0.05, clamp(uWrinkle, 0., 1.));
  float fade = smoothstep(x0 - 0.5, x0 + 0.5, p.x) * (1. - smoothstep(x1 - 0.5, x1 + 0.5, p.x));
  float dv = 0.72 + 0.28*sin(p.x*0.9 + ph*3.);
  return (-exp(-d*d/(w*w)) + 0.2*exp(-d*d/(w*w*7.))) * fade * dv;
}
float wrinkleSum(vec2 p){
  float a = 0.068 * max(uWrinkle, 0.12);
  return a * (wline(p, -1.32, 0.4, -3., 3.) + 0.92*wline(p, -0.16, 1.9, -3., 3.) + 0.8*wline(p, 1.05, 3.1, -2.4, 1.6));
}
float macroS(vec2 p){
  float base = 0.012*(vnoise(p*0.8 + 3.1) - .5) + 0.006*(vnoise(p*2.2 + 1.3) - .5);
  float d = tipSDF(p);
  float under = (1. - smoothstep(-0.06, 0.10, d)) * uDent;
  float s = mix(base + wrinkleSum(p), -0.045, under);
  s += 0.010 * uDent * smoothstep(-0.02, 0.07, d) * exp(-max(d, 0.) * 5.5);
  return s;
}
float rete(vec2 p){ vec3 v = voro2(p*5.6 + vec2(17.3, 4.1)); float r = 1. - smoothstep(0., 0.34, v.y - v.x); return r*r*(3. - 2.*r); }
float papDome(vec2 p){ vec3 v = voro2(p*5.6 + vec2(17.3, 4.1)); return v.x; }  // distance to papilla centre
float lobDome(vec2 p){ vec3 v = voro2(p*1.9 + vec2(5.2, 1.9)); return 1. - smoothstep(0., 0.62, v.x); }
float yJunction(vec2 p, float s){ return 0.9*s - 0.105 - (0.062 + 0.03*uG1) * rete(p); }
float yPapBase(vec2 p, float s){ return 0.8*s - 0.345 - 0.06*uG1 + 0.025*(vnoise(p*3.1 + 2.) - .5); }
float yDermBase(vec2 p, float s){ return 0.35*s - 1.10 - 0.12*uG1 + 0.07*lobDome(p); }
float ySubBase(vec2 p){ return mix(-2.32, -2.02 + 0.022*(vnoise(p*1.3 + 8.) - .5), uSmas); }
float boundaryY(float k, vec2 p){
  if (k < 0.5) return macroS(p);
  if (k < 1.5) return yJunction(p, macroS(p));
  if (k < 2.5) return yDermBase(p, macroS(p));
  if (k < 3.5) return ySubBase(p);
  return -2.32;
}

/* ── RF heat field (0..1) & cooling ── */
float heatLobe(vec3 p){ vec3 d = (p - uHeatC) / uHeatR; return exp(-dot(d, d) * 1.35); }
float coolProt(vec3 p){ float depth = -p.y; return smoothstep(0.04, 0.30 + 0.28*uCool, depth); }
float heatField(vec3 p){
  float h = heatLobe(p);
  h *= 0.9 + 0.2*vnoise3(p*vec3(3., 6., 3.) + vec3(0., uT*0.45, uT*0.2));
  h *= mix(1., coolProt(p), 0.5 + 0.5*uCool);
  return clamp(h * uHeat, 0., 1.);
}
// septal conduction into the subcutis (RF prefers the low-impedance fibrous septa)
float heatSeptal(vec3 p){
  vec2 d = (p.xz - uTipC) / 1.2;
  return uHeat * exp(-dot(d, d) * 1.2) * exp(-max(0., -1.05 - p.y) / 0.22) * 0.6;
}
float coolField(vec3 p, float depth){
  float d = tipSDF(p.xz);
  float lat = 1. - smoothstep(0.0, 0.18 + 0.6*uCool, d);
  return uCool * lat * (1. - smoothstep(uCoolDepth - 0.05, uCoolDepth + 0.015, depth));
}
float coolFront(vec3 p, float depth){
  float d = tipSDF(p.xz);
  float lat = 1. - smoothstep(0.0, 0.18 + 0.6*uCool, d);
  float e = (depth - uCoolDepth) / 0.012;
  return uCool * lat * exp(-e*e);
}
#ifdef YM_FRAG
vec3 bumpN(vec3 surf_pos, vec3 surf_norm, float h, float scale){
  vec3 sx = dFdx(surf_pos), sy = dFdy(surf_pos);
  vec3 R1 = cross(sy, surf_norm), R2 = cross(surf_norm, sx);
  float det = dot(sx, R1);
  vec2 dH = vec2(dFdx(h), dFdy(h)) * scale;
  vec3 g = sign(det) * (dH.x * R1 + dH.y * R2);
  return normalize(abs(det) * surf_norm - g);
}
#endif
`;

/* ═════════════════════════════ GLSL: tissue slabs (walls + caps) & skin ═════════════════════════════ */
// aW = (kind, wallId, s): kind 0 = wall (position.y = 0 top … 1 bottom), 1 = top cap, 2 = bottom cap.
const GLSL_TISSUE_VERT_DECL = /* glsl */`
attribute vec3 aW;
varying vec3 vTP; varying vec3 vTN; varying float vKind; varying float vWallId;
`;
const GLSL_TISSUE_VERT_MAIN = /* glsl */`
  vec3 tp; vec3 tn;
  float kind = aW.x; vKind = kind; vWallId = aW.y;
  if (kind < 0.5) {
    float id = aW.y, s = aW.z, xc = uNotch.x, zc = uNotch.y; vec2 xz;
    if (id < 0.5)      { xz = vec2(-2. + (xc + 2.)*s, 2.);   tn = vec3(0., 0., 1.); }
    else if (id < 1.5) { xz = vec2(2., zc - (zc + 2.)*s);    tn = vec3(1., 0., 0.); }
    else if (id < 2.5) { xz = vec2(2. - 4.*s, -2.);          tn = vec3(0., 0., -1.); }
    else if (id < 3.5) { xz = vec2(-2., -2. + 4.*s);         tn = vec3(-1., 0., 0.); }
    else if (id < 4.5) { xz = vec2(xc, 2. - (2. - zc)*s);    tn = vec3(1., 0., 0.); }
    else               { xz = vec2(xc + (2. - xc)*s, zc);    tn = vec3(0., 0., 1.); }
    float yt = boundaryY(float(SLAB), xz), yb = boundaryY(float(SLAB) + 1., xz);
    tp = vec3(xz.x, mix(yt, yb, position.y), xz.y);
  } else {
    float k = float(SLAB) + (kind < 1.5 ? 0. : 1.);
    vec2 xz = position.xz; float e = 0.012;
    float y = boundaryY(k, xz);
    float dx = boundaryY(k, xz + vec2(e, 0.)) - boundaryY(k, xz - vec2(e, 0.));
    float dz = boundaryY(k, xz + vec2(0., e)) - boundaryY(k, xz - vec2(0., e));
    tn = normalize(vec3(-dx/(2.*e), 1., -dz/(2.*e)));
    if (kind > 1.5) tn = -tn;
    tp = vec3(xz.x, y, xz.y);
  }
  vTP = tp; vTN = tn;
  vec3 objectNormal = tn;
`;

const GLSL_TISSUE_FRAG_DECL = /* glsl */`
varying vec3 vTP; varying vec3 vTN; varying float vKind; varying float vWallId;
uniform sampler2D uFaceTex; uniform vec4 uFaceMap; uniform float uFaceMix;
float tRough; float tHgt; vec3 tEmi;
`;

// per-slab shading. Inputs: p (tissue pos), S (surface height above p.xz), depth = S - p.y, u (along-wall coord)
const GLSL_TISSUE_FRAG_MAIN = /* glsl */`
  vec3 p = vTP;
  if (vKind > 0.5 && p.x > uNotch.x && p.z > uNotch.y) discard;
#if SLAB == 1
  if (!gl_FrontFacing && uXray < 0.001) discard;
#endif
  float S = macroS(p.xz);
  float depth = S - p.y;
  float u = abs(vTN.x) > 0.5 ? p.z : p.x;
  float isWall = 1. - step(0.5, vKind);
  vec3 heCol = vec3(0.8); vec3 dfCol = vec3(0.03); vec3 dfEmi = vec3(0.); vec3 emi = vec3(0.);
  tRough = 0.5; tHgt = 0.; float alpha = 1.;
  float heatMask = 0.; float h = 0.;
#if SLAB == 0
  float J = yJunction(p.xz, S);
  float dJ = p.y - J;
  float fwD = fwidth(depth);
  float sc = 1. - smoothstep(0.018 - fwD, 0.028 + fwD, depth);
  float basal = 1. - smoothstep(0.006, 0.032, dJ);
  vec3 cq = p * vec3(34., 34. * mix(2.4, 1.0, smoothstep(0.02, 0.09, depth)), 34.);
  vec3 cv = voro3(cq);
  // band-limit the keratinocyte pattern: cell pitches per pixel → fade cells (and their relief) to the mean
  // once they shrink below a few pixels (grazing cut faces / wide shots alias into barcode streaks otherwise)
  float cDet = 1. - smoothstep(0.22, 0.6, max(length(dFdx(cq)), length(dFdy(cq))));
  float ce = cv.y - cv.x;
  float cellEdge = mix(0.18, 1. - smoothstep(0.0, 0.12 + fwidth(ce)*1.5, ce), cDet);
  float nuc = mix(0.06, 1. - smoothstep(0.10, 0.17 + fwidth(cv.x), cv.x), cDet);
  float lph = depth*540.;
  float lam = mix(0.5, 0.5 + 0.5*sin(lph + fbm2(vec2(u*9., depth*40.))*5.), 1. - smoothstep(1.0, 2.6, fwidth(lph)));
  heCol = mix(vec3(0.90, 0.66, 0.58), vec3(0.58, 0.36, 0.32), basal*0.85);
  heCol *= 0.92 + 0.08*mix(0.5, cv.z, cDet);
  heCol = mix(heCol, heCol*0.8, cellEdge*0.5);
  heCol = mix(heCol, vec3(0.44, 0.25, 0.42), nuc*0.5*(1. - sc)*(1. - basal*0.5));
  heCol = mix(heCol, vec3(0.94, 0.84, 0.75)*(0.93 + 0.07*lam), sc);
  dfCol = vec3(0.035, 0.025, 0.05);
  dfEmi = vec3(0.45, 0.26, 0.9) * (0.08 + 0.3*cellEdge + 0.9*basal) * (1. - sc) + vec3(0.6, 0.55, 0.75)*sc*0.22;
  tRough = mix(0.40, 0.52, sc);
  tHgt = -cellEdge*0.0025 + nuc*0.001 - lam*sc*0.0012;
#elif SLAB == 1
  float J = yJunction(p.xz, S);
  float yP = yPapBase(p.xz, S);
  float pap = smoothstep(yP - 0.03, yP + 0.03, p.y);
  float cw = uContract * smoothstep(0.08, 0.6, heatLobe(p));
  vec3 q = p; q.xz = uTipC + (q.xz - uTipC) * (1. + 0.14*cw);
  vec3 qa = q * vec3(2.3, 10.5, 2.3);
  qa.xz += vec2(fbm3b(qa*0.4), fbm3b(qa*0.4 + 5.2)) * 1.5;
  qa.y += (fbm3b(qa*vec3(0.55, 0.2, 0.55) + 2.) - .5) * 2.4 * (1. - 0.4*uG1) * (1. - 0.6*cw);
  float n = fbm3(qa);
  float cleftW = 0.06 * (1. - 0.45*uG1) * (1. - 0.75*cw);
  float cleft = 1. - smoothstep(0.0, cleftW + fwidth(n)*0.8, abs(n - 0.5));
  float n2 = fbm3b(qa*1.7 + 9.);
  cleft = max(cleft, 0.7 * (1. - smoothstep(0.0, cleftW*0.6 + fwidth(n2)*0.8, abs(n2 - 0.5))));
  float fib = vnoise3(qa * vec3(2.6, 6.5, 2.6));
  float np = 0.5, pfib = 0.;
  if (pap > 0.001) { np = fbm3b(q * vec3(9., 22., 9.)); pfib = 1. - smoothstep(0.0, 0.07 + fwidth(np), abs(np - 0.5)); }
  vec3 cs = vec3(0.11, 0.04, 0.11); vec3 ci = floor(q / cs); vec3 rr = hash33(ci);
  vec3 cp = (ci + 0.2 + 0.6*rr) * cs; vec3 dd = (q - cp) / vec3(0.024, 0.0065, 0.024);
  float nuc = step(rr.x, 0.28 + 0.32*uG1 + 0.25*pap) * (1. - smoothstep(0.6, 1.0, length(dd)));
  float capil = (1. - smoothstep(0.022, 0.034, papDome(p.xz))) * (1. - smoothstep(0.02, 0.10, J - p.y));
  float ves = 0., vesW = 0.;
  if (isWall > 0.5) {
    for (int k = 0; k < 2; k++) {
      float fk = float(k);
      float cell = k == 0 ? 0.42 : 0.62;
      float yv = k == 0 ? yP - 0.02 : yDermBase(p.xz, S) + 0.11;
      float uu = u + fk*0.37*cell + vWallId*0.71;
      float ui = floor(uu / cell);
      vec3 hr = hash33(vec3(ui, fk*7.1, vWallId*3.3 + 1.));
      if (hr.x < 0.62) {
        float uc = (ui + 0.25 + 0.5*hr.y) * cell;
        vec2 e = vec2(uu - uc, p.y - (yv + (hr.z - .5)*0.05)) / vec2(0.026 + 0.02*hr.z, 0.020 + 0.014*hr.z);
        float r = length(e);
        ves = max(ves, 1. - smoothstep(0.72, 0.86, r));
        vesW = max(vesW, (1. - smoothstep(0.9, 1.3, r)) * smoothstep(0.72, 0.86, r));
      }
    }
  }
  vec3 cB = mix(vec3(0.88, 0.50, 0.60), vec3(0.90, 0.44, 0.60), uG1);
  heCol = cB * (0.86 + 0.18*fib);
  heCol = mix(heCol, vec3(0.98, 0.88, 0.88), cleft * (1. - pap));
  vec3 papCol = vec3(0.98, 0.82, 0.80) * (0.95 + 0.07*np);
  papCol = mix(papCol, vec3(0.92, 0.58, 0.68), pfib*0.5);
  heCol = mix(heCol, papCol, pap);
  heCol = mix(heCol, vec3(0.40, 0.22, 0.50), nuc*0.8);
  heCol = mix(heCol, vec3(0.72, 0.12, 0.16), capil*0.85);
  heCol = mix(heCol, vec3(0.86, 0.46, 0.52), vesW);
  heCol = mix(heCol, vec3(0.45, 0.04, 0.07) * (0.8 + 0.4*vnoise(vec2(u, p.y)*120.)), ves);
  heCol *= 1. + 0.12*cw;
  float w1 = 1. + 0.6*uHi1 - 0.8*uHi3, w3 = 1. + 0.6*uHi3 - 0.8*uHi1;
  dfCol = vec3(0.03, 0.022, 0.045);
  dfEmi = vec3(0.80, 0.30, 0.72) * (1. - cleft) * (0.22 + 0.5*fib) * (1. - pap) * (0.8 + 0.5*uG1) * w1
        + vec3(0.22, 0.88, 0.62) * (pfib*0.9 + 0.1) * pap * (0.7 + 0.6*uG3) * w3
        + vec3(0.25, 0.35, 1.0) * nuc * 0.6 + vec3(0.9, 0.2, 0.3) * (ves*0.3 + capil*0.5);
  tRough = 0.36 + 0.1*pap;
  tHgt = (1. - cleft)*0.004 + fib*0.0015 - ves*0.004 + nuc*0.001;
  h = heatField(p); heatMask = 1.;
  alpha = 1. - uXray * (0.80 + 0.16*cleft);
#elif SLAB == 2
  vec3 c = voro3(p * 6.8 + vec3(3.1, 7.7, 1.3));
  float ce = c.y - c.x; float aaw = fwidth(ce);
  float mem = 1. - smoothstep(0.0, 0.045 + aaw*1.5, ce);
  vec3 L = voro3(p * vec3(1.9, 2.5, 1.9) + vec3(11., 2., 5.));
  float le = L.y - L.x; float sept = 1. - smoothstep(0.012, 0.05 + fwidth(le)*1.5, le);
  // adipocyte globules: rounded shoulders from the membrane (border distance, C1 — no hard crease) + a soft crown
  float pil = smoothstep(0.0, 0.5, ce);
  float dome = pil * (2. - pil);
  float crown = 1. - smoothstep(0.0, 0.55, c.x);
  vec3 fat = mix(vec3(0.97, 0.74, 0.28), vec3(1.0, 0.86, 0.46), c.z) * (0.78 + 0.16*dome + 0.08*crown);
  heCol = mix(fat, vec3(0.97, 0.88, 0.64), mem*mix(0.6, 0.3, step(0.5, vKind)));
  heCol *= mix(1.0, 0.8, step(0.5, vKind));
  float sv = step(0.86, hash13(floor(p*vec3(14., 14., 14.)))) * sept;
  heCol = mix(heCol, vec3(0.93, 0.80, 0.78) * (0.9 + 0.1*vnoise3(p*60.)), sept);
  heCol = mix(heCol, vec3(0.62, 0.10, 0.12), sv*0.8);
  dfCol = vec3(0.03, 0.028, 0.02);
  dfEmi = vec3(0.55, 0.65, 0.45)*mem*0.3*(1. - sept) + vec3(0.62, 0.35, 0.95)*sept*0.7 + vec3(0.9, 0.75, 0.3)*0.035*dome;
  tRough = mix(mix(0.46, 0.22, dome), 0.55, sept);
  tHgt = dome*0.0075 + crown*0.0025 - sept*0.006;
  emi = vec3(0.30, 0.17, 0.03) * 0.06 * dome * (1. - sept) * uStain;   // faint lipid translucency (H&E look)
  h = max(heatField(p)*0.55, heatSeptal(p) * (0.25 + 0.75*sept)); heatMask = 0.5 + sept;
#else
  float dm = ySubBase(p.xz) - p.y;
  float fascia = 1. - smoothstep(0.05, 0.075, dm) * uSmas;
  vec3 fv = voro3(vec3(p.x*1.2, p.y*16., p.z*16.));
  float fe = 1. - smoothstep(0.0, 0.06, fv.y - fv.x);
  float stri = 0.5 + 0.5*sin(p.x*260. + fv.z*6.);
  vec3 mus = mix(vec3(0.56, 0.13, 0.12), vec3(0.66, 0.18, 0.15), fv.z) * (0.9 + 0.1*stri);
  mus = mix(mus, vec3(0.80, 0.62, 0.58), fe*0.55);
  vec3 fas = mix(vec3(0.86, 0.78, 0.76), vec3(0.94, 0.90, 0.88), vnoise3(vec3(p.x*3., p.y*60., p.z*30.))) * (0.9 + 0.1*vnoise3(vec3(p.x*40., p.y*200., p.z*4.)));
  heCol = mix(mus, fas, fascia);
  dfCol = vec3(0.03, 0.02, 0.025);
  dfEmi = vec3(0.9, 0.25, 0.3)*0.12*(1. - fascia)*(0.6 + 0.4*stri) + vec3(0.6, 0.6, 0.8)*fascia*0.25 + fe*vec3(0.5, 0.3, 0.6)*0.2;
  tRough = mix(0.45, 0.3, fascia);
  tHgt = -fe*0.004 + stri*0.0008;
#endif
  heCol = pow(max(heCol, 0.), vec3(2.2)); dfCol = pow(max(dfCol, 0.), vec3(2.2)); dfEmi = pow(max(dfEmi, 0.), vec3(2.2)) * 2.2;
  // histology canvas on the front face (epidermis + dermis only; fades out at the dermis base)
#if SLAB < 2
  if (uFaceMap.w > 0.5 && isWall > 0.5 && vWallId < 0.5) {
    float hU = uFaceMap.x - uFaceMap.y;
    vec2 fuv = vec2(0.5 + p.x / (hU * uFaceMap.z), (uFaceMap.x - p.y) / hU);
    fuv.x = 1. - abs(1. - mod(fuv.x, 2.));
    float fm = uFaceMix * step(0.0, fuv.y) * (1. - smoothstep(0.93, 1.0, fuv.y)) * step(0.004, depth);
    fm *= smoothstep(yDermBase(p.xz, S) + 0.01, yDermBase(p.xz, S) + 0.09, p.y);
    vec3 fc = pow(texture2D(uFaceTex, vec2(fuv.x, 1. - clamp(fuv.y, 0., 1.))).rgb, vec3(1.3));
    heCol = mix(heCol, fc, fm); dfCol = mix(dfCol, fc*0.3, fm); dfEmi = mix(dfEmi, fc*0.5, fm);
    tHgt *= 1. - fm*0.7;
  }
#endif
  vec3 alb = mix(dfCol, heCol, uStain);
  emi += dfEmi * (1. - uStain);
  // cheap ambient occlusion inside the cutaway notch (inner corner + floor)
  if (uNotchG.x < 1.99) {
    float ao = 1.;
    if (isWall > 0.5 && vWallId > 3.5) {
      float dc = vWallId < 4.5 ? p.z - uNotchG.y : p.x - uNotchG.x;
      ao = mix(0.55, 1., smoothstep(0., 0.45, dc));
      ao *= mix(0.62, 1., smoothstep(0., 0.3, p.y - yDermBase(p.xz, S)));
    }
#if SLAB == 2
    if (vKind > 0.5 && vKind < 1.5 && p.x > uNotchG.x && p.z > uNotchG.y) ao = mix(0.5, 1., smoothstep(0., 0.55, min(p.x - uNotchG.x, p.z - uNotchG.y)));
#endif
    alb *= ao;
  }
  // RF heat: brand heat scale + isotherms + sub-surface glow
  if (uHeat > 0.001) {
    float fw = fwidth(h) * 1.2 + 1e-4;
    float iso = 0.;
    for (int i = 0; i < 4; i++) { float l = 0.2 + 0.2*float(i); iso += (1. - smoothstep(0., fw, abs(h - l))) * step(l, uHeat); }
    float hm = smoothstep(0.04, 0.6, h);
    alb = mix(alb, alb*0.35, hm*0.75*min(heatMask, 1.));
    emi += heatCol(h) * smoothstep(0.03, 0.9, h) * 2.0 * heatMask + heatCol(min(h + 0.1, 1.)) * iso * 1.1 * step(0.9, heatMask);
    if (isWall > 0.5) {
      float hs = heatField(p - vTN*0.22)*0.55 + heatField(p - vTN*0.55)*0.3;
      emi += heatCol(hs) * hs * 0.8;
    }
  }
#if SLAB < 2
  if (uCool > 0.001) {
    float cf = coolField(p, depth), cfr = coolFront(p, depth);
    alb = mix(alb, vec3(0.45, 0.66, 0.95), cf*0.55);
    emi += vec3(0.25, 0.62, 1.0) * (cf*0.35 + cfr*2.2);
  }
#endif
  diffuseColor.rgb = alb;
  diffuseColor.a = alpha;
  tEmi = emi;
`;

// skin surface (top cap of the epidermis) — micro relief, pores, wrinkles, frost
const GLSL_SKIN_FRAG_MAIN = /* glsl */`
  vec3 p = vTP; vec2 xz = p.xz;
  if (p.x > uNotch.x && p.z > uNotch.y) discard;
  // micro-relief furrows, band-limited: edges widen by the pixel footprint (area-preserving) and the
  // pattern fades to its mean once cells shrink below a few pixels (grazing / wide views)
  vec2 q1 = xz * vec2(10.5, 13.5) + vec2(3.3, 1.1), q2 = xz * vec2(24., 30.) + vec2(7.1, 2.9);
  vec3 m1 = voro2(q1);
  float e1 = m1.y - m1.x, w1 = fwidth(e1)*0.6;
  float fur1 = mix(0.12, 1. - smoothstep(-w1, 0.085 + w1, e1), 1. - smoothstep(0.25, 0.7, max(length(dFdx(q1)), length(dFdy(q1)))));
  vec3 m2 = voro2(q2);
  float e2 = m2.y - m2.x, w2 = fwidth(e2)*0.6;
  float fur2 = mix(0.1, 1. - smoothstep(-w2, 0.07 + w2, e2), 1. - smoothstep(0.25, 0.7, max(length(dFdx(q2)), length(dFdy(q2)))));
  vec3 pv = voro2(xz * 4.6 + vec2(9.1, 4.4));
  float wpv = fwidth(pv.x)*0.5;
  float pore = (1. - smoothstep(0.012 - wpv, 0.022 + wpv, pv.x)) * step(0.35, pv.z);
  float fold = clamp(-wrinkleSum(xz) / 0.035, 0., 1.);
  float mott = fbm2(xz * 2.6);
  vec3 skin = vec3(0.76, 0.52, 0.42);
  skin = mix(skin, vec3(0.82, 0.50, 0.46), smoothstep(0.45, 0.75, mott) * 0.5);
  skin *= 0.95 + 0.07*fbm2(xz*9.);
  skin *= 1. - 0.10*fur1 - 0.05*fur2;
  skin = mix(skin, vec3(0.50, 0.32, 0.28), pore*0.7);
  skin *= 1. - 0.22*fold;
  tHgt = ((1. - m1.x)*0.35 - fur1*0.9 - fur2*0.4 - pore*1.6) * 0.0032;
  tRough = 0.46 + 0.14*fur1 + 0.2*pore;
  vec3 emi = vec3(0.);
  // cryogen frost around the tip
  float d = tipSDF(xz);
  float R = 0.1 + 1.0*uCool;
  float fr = uCool * (1. - smoothstep(R*0.55, R, max(d, 0.)));
  float frost = fr * smoothstep(0.35, 0.7, fbm2(xz * 7.) + fr*0.35);
  vec3 fc2 = voro2(xz * 16. + 3.);
  float cryst = 1. - smoothstep(0.0, 0.05, fc2.y - fc2.x);
  skin = mix(skin, mix(vec3(0.60, 0.72, 0.86), vec3(0.82, 0.92, 1.0), cryst), frost*0.6);
  skin = mix(skin, skin * vec3(0.86, 0.92, 1.05), fr*0.6);
  tRough = mix(tRough, mix(0.62, 0.3, cryst), frost);
  vec3 sv = voro2(xz * 55.);
  float sparkle = step(0.9, sv.z) * (1. - smoothstep(0.0, 0.12, sv.x)) * (0.5 + 0.5*sin(uT*5. + sv.z*60.));
  emi += vec3(0.6, 0.85, 1.0) * sparkle * frost * 1.6 + vec3(0.2, 0.55, 1.0) * (fr * 0.10 + frost * cryst * 0.25);
  tHgt += frost * (0.3 + 0.8*sparkle + 0.8*cryst) * 0.003;
  // deep heat faintly shining through (suppressed by cooling → reverse gradient)
  if (uHeat > 0.001) { float hs = heatField(p - vec3(0., 0.26, 0.)); emi += heatCol(hs) * hs * 0.45; }
  skin *= mix(0.4, 1.0, uStain);
  diffuseColor.rgb = pow(skin, vec3(2.2));
  tEmi = emi;
`;

/* ═════════════════════════════ GLSL: collagen fibres (InstancedMesh) ═════════════════════════════ */
// geometry attr aF = (u 0..1 along, strand k, ring angle θ). Per instance: aP = (len, rad, crimpAmp, crimpFreq),
// aQ = (phase, glow, tint, heatW)
const GLSL_FIBRE_VERT_DECL = /* glsl */`
attribute vec3 aF; attribute vec4 aP; attribute vec4 aQ;
uniform float uCrimpK; uniform float uFill;
varying vec3 vFT; varying float vFGlow; varying float vFTint; varying float vFAlong;
vec3 fPos;
`;
const GLSL_FIBRE_VERT_MAIN = /* glsl */`
  float fu = aF.x, fk = aF.y, th = aF.z;
  float L = aP.x, R = aP.y;
  float along = fu * L;
  float cr = aP.z * uCrimpK;
  vec3 cen = vec3(along - 0.5*L, cr*sin(along*aP.w + aQ.x), cr*0.45*cos(along*aP.w*0.73 + aQ.x*1.7));
  float taper = mix(0.06, 1., sqrt(smoothstep(0., 0.06, fu) * (1. - smoothstep(0.94, 1., fu))));
  vec3 rn = vec3(0., cos(th), sin(th));
#if FTYPE == 1
  float tw = along / 0.30 * 6.2831853 + fk * 2.0943951 + aQ.x;
  fPos = cen + vec3(0., cos(tw), sin(tw)) * R * 0.58 + rn * R * 0.52 * taper;
#else
  fPos = cen + rn * R * taper;
#endif
  vec3 objectNormal = rn;
  vFT = (instanceMatrix * vec4(fPos, 1.)).xyz;
  vFGlow = aQ.y; vFTint = aQ.z; vFAlong = along;
`;
const GLSL_FIBRE_FRAG_DECL = /* glsl */`
varying vec3 vFT; varying float vFGlow; varying float vFTint; varying float vFAlong;
uniform float uFill;
float tRough; vec3 tEmi;
`;
const GLSL_FIBRE_FRAG_MAIN = /* glsl */`
  vec3 p = vFT;
  if (abs(p.x) > 1.985 || abs(p.z) > 1.985) discard;
  if (p.y > -0.125 + 0.9*min(0., macroS(p.xz)) || p.y < -1.07 - 0.12*uG1) discard;
  // cutaway notch: the dissolved-matrix scaffold only extends uFill from the section walls
  if (p.x > uNotchG.x && p.z > uNotchG.y && min(p.x - uNotchG.x, p.z - uNotchG.y) > uFill + 0.4) discard;
#if FTYPE == 1
  vec3 base = mix(vec3(0.70, 0.30, 0.66), vec3(0.86, 0.40, 0.66), vFTint);
  float hi = clamp(1. + 0.45*uHi1 - 0.8*uHi3, 0.15, 1.6);
#else
  vec3 base = mix(vec3(0.30, 0.86, 0.64), vec3(0.50, 0.95, 0.76), vFTint);
  float hi = clamp(1. + 0.45*uHi3 - 0.8*uHi1, 0.15, 1.6);
#endif
  float band = 0.5 + 0.5*sin(vFAlong * 150.);
  base = pow(base, vec3(2.2));
  diffuseColor.rgb = base * hi * (0.9 + 0.1*band);
  float h = uHeat > 0.001 ? heatField(p) : 0.;
  float hk = smoothstep(0.06, 0.8, h);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.25, hk);
  tEmi = base * hi * (0.05*uStain + 0.45*(1. - uStain)) + base * vFGlow * 0.9 + heatCol(h) * hk * 2.6;
  tRough = 0.30 + 0.12*band;
`;

/* ═══════════════════════ GLSL: heat shells, current tubes, mist, contact ring ═══════════════════════ */
const GLSL_SHELL = {
  vert: /* glsl */`
uniform vec3 uS; uniform vec3 uC;
varying vec3 vTP; varying vec3 vN; varying vec3 vV;
void main(){
  vTP = uC + position * uS;
  vec4 wp = modelMatrix * vec4(position, 1.);
  vN = normalize((modelMatrix * vec4(normal / (uS*uS), 0.)).xyz);
  vV = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
  frag: /* glsl */`
uniform float uLevel; uniform float uGain;
varying vec3 vTP; varying vec3 vN; varying vec3 vV;
void main(){
  vec3 p = vTP;
  if (abs(p.x) > 1.99 || abs(p.z) > 1.99) discard;
  float S = macroS(p.xz);
  if (p.y > yJunction(p.xz, S) - 0.01 || p.y < yDermBase(p.xz, S) + 0.005) discard;
  float h = heatField(p);
  float a = smoothstep(uLevel*0.72, uLevel*1.02, h);
  float f = 1. - abs(dot(normalize(vN), normalize(vV)));
  float I = (0.035 + 0.55*pow(f, 3.0)) * a * uGain;
  float rip = 0.85 + 0.15*sin(p.y*90. + p.x*20. - uT*3.);
  gl_FragColor = vec4(heatCol(uLevel + 0.08) * I * rip, 1.);
}`,
};

const GLSL_CURRENT = {
  vert: /* glsl */`
attribute float aLane; attribute float aHalo;
uniform vec4 uOff; uniform float uOffPad; uniform float uPadY;
varying float vU; varying float vLane; varying float vHalo; varying vec3 vN; varying vec3 vV;
float exOff(float y){
  float o = mix(uOffPad, uOff.w, smoothstep(uPadY + 0.1, -2.32, y));
  o = mix(o, uOff.z, smoothstep(-2.06, -1.98, y));
  o = mix(o, uOff.y, smoothstep(-1.20, -1.12, y));
  o = mix(o, uOff.x, smoothstep(-0.17, -0.12, y));
  return o;
}
void main(){
  vec3 pos = position; pos.y += exOff(position.y);
  vU = uv.x; vLane = aLane; vHalo = aHalo;
  vec4 wp = modelMatrix * vec4(pos, 1.);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
  frag: /* glsl */`
uniform float uT; uniform float uCurrent; uniform float uReach; uniform float uGain;
varying float vU; varying float vLane; varying float vHalo; varying vec3 vN; varying vec3 vV;
void main(){
  float u = vU;
  if (u > uReach) discard;
  float ph = fract(u*7.0 - uT*1.15 + vLane*0.618);
  float pulse = pow(smoothstep(0.0, 0.5, ph) * (1. - smoothstep(0.5, 0.6, ph)), 1.6);
  float dens = mix(1.0, 0.38, smoothstep(0.0, 0.55, u)) + 0.3*smoothstep(0.88, 1.0, u);
  vec3 col = mix(vec3(0.50, 0.24, 1.0), vec3(0.16, 0.92, 0.58), smoothstep(0.25, 0.95, u));
  col = mix(col, vec3(0.85, 0.8, 1.0), pulse*0.2*(1. - vHalo));
  float f = abs(dot(normalize(vN), normalize(vV)));
  float edge = vHalo > 0.5 ? 0.09 * f * f : (0.42 + 0.3*f);
  float tipFade = smoothstep(uReach, uReach - 0.06, u);
  float I = uCurrent * (0.16 + 1.0*pulse) * dens * edge * tipFade * uGain;
  gl_FragColor = vec4(col * I, 1.);
}`,
};

const GLSL_MIST = {
  vert: /* glsl */`
attribute float aSeed; attribute float aAng;
uniform float uT; uniform float uCool; uniform vec2 uTipC;
varying vec2 vUv; varying float vA; varying float vS;
void main(){
  float life = fract(uT*0.30 + aSeed);
  vec2 dir = vec2(cos(aAng), sin(aAng));
  vec2 rp = dir / max(abs(dir.x), abs(dir.y)) * 1.1;
  float sp = 1. + (0.35 + 0.35*fract(aSeed*7.3)) * life;
  sp = 1. + (0.45 + 0.55*fract(aSeed*7.3)) * life;
  vec3 c = vec3(uTipC.x + rp.x*sp, 0.02 + (0.05 + 0.12*fract(aSeed*3.1))*life, uTipC.y + rp.y*sp);
  float size = mix(0.2, 0.75, life) * (0.7 + 0.6*fract(aSeed*13.7));
  vec4 mv = modelViewMatrix * vec4(c, 1.);
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;
  vUv = uv; vS = aSeed;
  vA = sin(3.14159*life) * smoothstep(0.0, 0.25, uCool) * (0.45 + 0.55*uCool);
}`,
  frag: /* glsl */`
uniform float uT;
varying vec2 vUv; varying float vA; varying float vS;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n21(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main(){
  vec2 d = vUv - 0.5;
  float r = dot(d, d) * 4.;
  float puff = exp(-r * 3.2) * (0.45 + 0.55*n21(vUv*4. + vS*40. + uT*0.4)) * (1. - smoothstep(0.7, 1.0, r));
  gl_FragColor = vec4(vec3(0.42, 0.74, 1.0) * puff * vA * 0.2, 1.);
}`,
};

const GLSL_RING = {
  vert: /* glsl */`
varying vec2 vXZ;
void main(){ vXZ = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  frag: /* glsl */`
uniform float uT; uniform float uCurrent; uniform float uCool; uniform float uOn;
varying vec2 vXZ;
float rb(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
void main(){
  float d = rb(vXZ, vec2(1.0), 0.22);
  float ringC = exp(-pow(max(d, 0.) / 0.035, 2.)) * step(-0.01, d);
  float haloC = exp(-max(d, 0.) / 0.18) * step(-0.01, d);
  float ang = atan(vXZ.y, vXZ.x);
  float flick = 0.75 + 0.25*sin(ang*9. + uT*7.);
  vec3 cur = vec3(0.62, 0.45, 1.0) * (ringC*1.4 + haloC*0.35) * uCurrent * flick;
  vec3 col = vec3(0.45, 0.80, 1.0) * (ringC*0.9 + haloC*0.5) * uCool;
  gl_FragColor = vec4((cur + col) * uOn, 1.);
}`,
};

/* ═══════════════════════════════════════════ factory ═══════════════════════════════════════════ */
export function createSkinCube(THREE, opts = {}) {
  const lib = opts.lib || {};
  const heatStops = (lib.BRAND && lib.BRAND.heat) || FALLBACK_HEAT;
  const mkRng = lib.rng || mulberry;
  const seed = opts.seed ?? 7;
  const smas = opts.smas !== false;
  const coll = opts.collagen || { weeks: [0, 4, 12], type1: [1, 1.42, 1.61], type3: [1, 1.38, 1.49] };
  const FI = fitSat(coll.type1[1], coll.type1[2]), FIII = fitSat(coll.type3[1], coll.type3[2]);
  const ratioI = (w) => 1 + FI.A * (1 - Math.exp(-FI.k * clamp(w, 0, 12)));
  const ratioIII = (w) => 1 + FIII.A * (1 - Math.exp(-FIII.k * clamp(w, 0, 12)));
  const padPos = opts.padPosition || [0.35, -3.35, 0.55];
  const geos = [], mats = [], texs = [];
  const G = (g) => (geos.push(g), g), M = (m) => (mats.push(m), m);

  const root = new THREE.Group(); root.name = 'YM3D.skincube';
  const gEpi = new THREE.Group(), gDer = new THREE.Group(), gSub = new THREE.Group(), gMus = new THREE.Group(), gPad = new THREE.Group();
  gEpi.name = 'epidermis'; gDer.name = 'dermis'; gSub.name = 'subcutis'; gMus.name = 'smas'; gPad.name = 'pad';
  root.add(gEpi, gDer, gSub, gMus, gPad);

  const V2 = (x, y) => new THREE.Vector2(x, y), V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const U = {
    uT: { value: 0 }, uWrinkle: { value: 1 }, uDent: { value: 0 }, uTipOn: { value: 1 }, uHeat: { value: 0 }, uCool: { value: 0 },
    uCoolDepth: { value: 0.035 }, uCurrent: { value: 0 }, uContract: { value: 0 }, uG1: { value: 0 }, uG3: { value: 0 },
    uStain: { value: 1 }, uXray: { value: 0 }, uSmas: { value: smas ? 1 : 0 }, uHi1: { value: 0 }, uHi3: { value: 0 },
    uNotchG: { value: V2(2, 2) }, uTipC: { value: V2(0, 0) }, uHeatC: { value: V3(0, -0.64, 0) }, uHeatR: { value: V3(1.32, 0.42, 1.32) },
    uRamp: { value: heatStops.map((h) => { const c = new THREE.Color(h); return V3(c.r, c.g, c.b); }) },
  };
  const notchOpen = U.uNotchG, notchClosed = { value: V2(2, 2) };

  // front-face histology canvas
  let faceTex = null;
  const faceU = { uFaceTex: { value: null }, uFaceMap: { value: new THREE.Vector4(0.209, -1.688, 1, 0) }, uFaceMix: { value: 1 } };
  if (opts.faceCanvas) {
    faceTex = new THREE.CanvasTexture(opts.faceCanvas); faceTex.colorSpace = THREE.SRGBColorSpace;
    // mipmapped + anisotropic: the cut face is often seen at a grazing angle (three clamps anisotropy to the GPU max)
    faceTex.minFilter = THREE.LinearMipmapLinearFilter; faceTex.generateMipmaps = true; faceTex.anisotropy = 8; texs.push(faceTex);
    const r = opts.faceCanvasRange || { yTop: 0.209, yBottom: -1.688 };
    faceU.uFaceTex.value = faceTex;
    faceU.uFaceMap.value.set(r.yTop, r.yBottom, (opts.faceCanvas.width || 16) / Math.max(1, opts.faceCanvas.height || 9), 1);
  }

  /* ---------- shader patching ---------- */
  function patchPhysical(m, key, v, f, extra = {}) {
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U, extra);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + GLSL_COMMON + v.decl)
        .replace('#include <beginnormal_vertex>', v.main)
        .replace('#include <begin_vertex>', 'vec3 transformed = ' + v.pos + ';');
      let fs = '#define YM_FRAG\n' + sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + GLSL_COMMON + f.decl)
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + f.main)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = tRough;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += tEmi;');
      if (f.bump) fs = fs.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = bumpN(-vViewPosition, normal, tHgt, 1.0);');
      sh.fragmentShader = fs;
    };
    m.customProgramCacheKey = () => key;
    return m;
  }
  const tissueV = { decl: GLSL_TISSUE_VERT_DECL, main: GLSL_TISSUE_VERT_MAIN, pos: 'tp' };

  /* ---------- geometry builders ---------- */
  function slabGeometry(capTop, capBot, segs = 256) {
    const pos = [], aw = [], idx = []; let base = 0;
    for (let id = 0; id < 6; id++) {
      for (let i = 0; i <= segs; i++) { const s = i / segs; pos.push(0, 0, 0, 0, 1, 0); aw.push(0, id, s, 0, id, s); }
      for (let i = 0; i < segs; i++) { const a = base + 2 * i, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, c, b, d); }
      base += 2 * (segs + 1);
    }
    const cap = (kind, n) => {
      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { pos.push(-2 + 4 * i / n, 0, -2 + 4 * j / n); aw.push(kind, 0, 0); }
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const a = base + j * (n + 1) + i, c = a + 1, b = a + (n + 1), d = b + 1;
        if (kind === 1) idx.push(a, b, c, c, b, d); else idx.push(a, c, b, c, d, b);
      }
      base += (n + 1) * (n + 1);
    };
    if (capTop) cap(1, capTop); if (capBot) cap(2, capBot);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aW', new THREE.Float32BufferAttribute(aw, 3));
    g.setIndex(new THREE.Uint32BufferAttribute(new Uint32Array(idx), 1));
    return G(g);
  }
  function capGeometry(n) { // skin top only
    const pos = [], aw = [], idx = [];
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { pos.push(-2 + 4 * i / n, 0, -2 + 4 * j / n); aw.push(1, 0, 0); }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, c = a + 1, b = a + (n + 1), d = b + 1; idx.push(a, b, c, c, b, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aW', new THREE.Float32BufferAttribute(aw, 3));
    g.setIndex(new THREE.Uint32BufferAttribute(new Uint32Array(idx), 1));
    return G(g);
  }

  /* ---------- tissue slabs ---------- */
  const slabMats = [];
  const slabSpec = [
    { slab: 0, group: gEpi, top: 0, bot: 200, notch: true, clearcoat: 0.25 },
    { slab: 1, group: gDer, top: 200, bot: 120, notch: true, clearcoat: 0.35 },
    { slab: 2, group: gSub, top: 120, bot: 24, notch: false, clearcoat: 0.22 },
    { slab: 3, group: gMus, top: 24, bot: 16, notch: false, clearcoat: 0.3 },
  ];
  const slabMeshes = [];
  for (const s of slabSpec) {
    if (s.slab === 3 && !smas) continue;
    const m = M(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0, clearcoat: s.clearcoat, clearcoatRoughness: 0.32 }));
    m.defines = { ...m.defines, SLAB: s.slab };
    if (s.slab === 1) { m.transparent = true; m.side = THREE.DoubleSide; }
    patchPhysical(m, 'ym-skin-slab' + s.slab, tissueV, { decl: GLSL_TISSUE_FRAG_DECL, main: GLSL_TISSUE_FRAG_MAIN, bump: true }, { uNotch: s.notch ? notchOpen : notchClosed, ...faceU });
    const mesh = new THREE.Mesh(slabGeometry(s.top, s.bot), m);
    mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.renderOrder = s.slab === 1 ? 1 : 0;
    s.group.add(mesh); slabMats[s.slab] = m; slabMeshes.push(mesh);
  }
  // skin surface
  const skinMat = M(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.42, sheen: 0.3, sheenColor: new THREE.Color(1.0, 0.62, 0.52), sheenRoughness: 0.5 }));
  skinMat.defines = { ...skinMat.defines, SLAB: 0 };
  patchPhysical(skinMat, 'ym-skin-top', tissueV, { decl: GLSL_TISSUE_FRAG_DECL, main: GLSL_SKIN_FRAG_MAIN, bump: true }, { uNotch: notchOpen, ...faceU });
  const skin = new THREE.Mesh(capGeometry(256), skinMat);
  skin.frustumCulled = false; skin.receiveShadow = true; gEpi.add(skin);

  /* ---------- collagen fibres ---------- */
  const fillU = { value: 0.35 };
  const fcount = opts.fibres || {};
  const base1 = Math.max(1, Math.round(fcount.typeI ?? 280)), base3 = Math.max(1, Math.round(fcount.typeIII ?? 420));
  const max1 = Math.ceil(base1 * coll.type1[2]) + 1, max3 = Math.ceil(base3 * coll.type3[2]) + 1;
  // tessellation: defaults (radial 6/5, along 36/24) are the real-time budget; macro shots opt in to more
  const tess = (o, key, d) => { const v = typeof o === 'number' ? o : (o && o[key]); return Math.round(clamp(num(v, d), 3, 256)); };
  function fibreGeometry(type) {
    const key = type === 1 ? 'typeI' : 'typeIII';
    const segL = tess(opts.fibreSegments, key, type === 1 ? 36 : 24), rad = tess(opts.fibreRadial, key, type === 1 ? 6 : 5), strands = type === 1 ? 3 : 1;
    const aF = [], pos = [], idx = []; let base = 0;
    for (let k = 0; k < strands; k++) {
      for (let i = 0; i <= segL; i++) for (let j = 0; j <= rad; j++) { aF.push(i / segL, k, (j / rad) * Math.PI * 2); pos.push(i / segL, 0, 0); }
      for (let i = 0; i < segL; i++) for (let j = 0; j < rad; j++) { const a = base + i * (rad + 1) + j, b = a + rad + 1, c = a + 1, d = b + 1; idx.push(a, c, b, c, d, b); }
      base += (segL + 1) * (rad + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aF', new THREE.Float32BufferAttribute(aF, 3));
    g.setIndex(idx);
    return G(g);
  }
  function makeFibres(type, n) {
    const R = mkRng(seed * 977 + type * 131);
    const d = { n, x: new Float32Array(n), z: new Float32Array(n), f: new Float32Array(n), phr: new Float32Array(n), pho: new Float32Array(n),
      thr: new Float32Array(n), tho: new Float32Array(n), len: new Float32Array(n), rad: new Float32Array(n), ca: new Float32Array(n),
      cf: new Float32Array(n), ph: new Float32Array(n), tint: new Float32Array(n), pap: new Uint8Array(n) };
    // stratified xz (jittered grid, shuffled) so any prefix of the list is spatially uniform
    const side = Math.ceil(Math.sqrt(n)), cells = [];
    for (let i = 0; i < side * side; i++) cells.push(i);
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = cells[i]; cells[i] = cells[j]; cells[j] = t; }
    for (let i = 0; i < n; i++) {
      const c = cells[i], cx = c % side, cz = Math.floor(c / side);
      d.x[i] = -2.15 + 4.3 * (cx + R()) / side; d.z[i] = -2.15 + 4.3 * (cz + R()) / side;
      d.f[i] = R(); d.ph[i] = R() * 6.2832; d.tint[i] = R();
      if (type === 1) {
        // reticular dermis: interlaced sheets (basket weave) parallel to the surface
        const sheet = Math.floor(d.f[i] * 6) % 2;
        d.pho[i] = (sheet ? 0.1 + Math.PI / 2 : 0.1) + (R() - 0.5) * 0.22;
        d.phr[i] = d.pho[i] + (R() - 0.5) * 2.2;
        d.thr[i] = (R() - 0.5) * 0.5; d.tho[i] = (R() - 0.5) * 0.08;
        d.len[i] = 1.2 + R() * 1.2; d.rad[i] = 0.019 + R() * 0.011;
        d.ca[i] = 0.010 + R() * 0.014; d.cf[i] = 6.2832 / (0.38 + R() * 0.26);
      } else {
        d.pap[i] = R() < 0.68 ? 1 : 0;
        d.phr[i] = R() * Math.PI; d.pho[i] = d.phr[i] * 0.5 + 0.06;
        d.thr[i] = (R() - 0.5) * 1.6; d.tho[i] = (R() - 0.5) * 0.5;
        d.len[i] = 0.3 + R() * 0.45; d.rad[i] = 0.0065 + R() * 0.003;
        d.ca[i] = 0.008 + R() * 0.01; d.cf[i] = 6.2832 / (0.16 + R() * 0.12);
      }
      // nearest equivalent of the organised orientation (fibre direction is symmetric mod π)
      while (d.pho[i] - d.phr[i] > Math.PI / 2) d.pho[i] -= Math.PI;
      while (d.pho[i] - d.phr[i] < -Math.PI / 2) d.pho[i] += Math.PI;
    }
    const mat = M(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.25, side: THREE.DoubleSide }));
    mat.defines = { ...mat.defines, FTYPE: type };
    const crimpU = { uCrimpK: { value: 1 }, uFill: fillU };
    patchPhysical(mat, 'ym-skin-fibre' + type, { decl: GLSL_FIBRE_VERT_DECL, main: GLSL_FIBRE_VERT_MAIN, pos: 'fPos' }, { decl: GLSL_FIBRE_FRAG_DECL, main: GLSL_FIBRE_FRAG_MAIN, bump: false }, { uNotch: notchOpen, ...crimpU });
    const geo = fibreGeometry(type);
    const aP = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4), aQ = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    aP.setUsage(THREE.DynamicDrawUsage); aQ.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aP', aP); geo.setAttribute('aQ', aQ);
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
    gDer.add(mesh);
    return { type, d, mesh, aP, aQ, crimpU };
  }
  const fib1 = makeFibres(1, max1), fib3 = makeFibres(3, max3);

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YZX'), _p = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
  const heatLobeJS = (x, y, z) => { const dx = x / 1.32, dy = (y + 0.64) / 0.42, dz = z / 1.32; return Math.exp(-(dx * dx + dy * dy + dz * dz) * 1.35); };
  function layoutFibres(F, count, g, contraction, xc, fill) {
    const d = F.d, P = F.aP.array, Q = F.aQ.array, n = Math.min(d.n, Math.ceil(count));
    const yPap = -0.345 - 0.06 * g, yBase = -1.10 - 0.12 * g + 0.03;
    const org = F.type === 1 ? 0.35 + 0.6 * g : 0.15 + 0.5 * g;
    for (let i = 0; i < n; i++) {
      let y;
      if (F.type === 1) y = lerp(yPap - 0.03, yBase + 0.04, d.f[i]);
      else y = d.pap[i] ? lerp(-0.15, yPap, d.f[i]) : lerp(yPap, yBase + 0.05, d.f[i]);
      let x = d.x[i], z = d.z[i];
      const w = sstep(0.08, 0.6, heatLobeJS(x, y, z)) * contraction;
      x *= 1 - 0.24 * w; z *= 1 - 0.24 * w; y += (-0.64 - y) * 0.18 * w;
      let appear = clamp(count - i);            // newest fibre grows in smoothly
      if (x > xc && z > xc && Math.min(x - xc, z - xc) > fill) appear = 0; // free-standing only near the notch walls
      const isNew = i >= (F.type === 1 ? base1 : base3) ? 1 : 0;
      const thick = F.type === 1 ? 1 + 0.28 * g : 1 + 0.2 * g;
      _e.set(0, lerp(d.phr[i], d.pho[i], org), lerp(d.thr[i], d.tho[i], org) * (1 - 0.5 * w));
      _q.setFromEuler(_e); _p.set(x, y, z);
      _m.compose(_p, _q, _one); _m.toArray(F.mesh.instanceMatrix.array, i * 16);
      P[i * 4] = d.len[i] * (1 - 0.42 * w) * (0.35 + 0.65 * appear);
      P[i * 4 + 1] = d.rad[i] * thick * (1 + 0.55 * w) * appear;
      P[i * 4 + 2] = d.ca[i] * (1 - 0.85 * w) * (1 - 0.25 * g);
      P[i * 4 + 3] = d.cf[i] * (1 + 0.5 * w);
      Q[i * 4] = d.ph[i]; Q[i * 4 + 1] = 0.5 * w + 0.16 * isNew; Q[i * 4 + 2] = d.tint[i]; Q[i * 4 + 3] = w;
    }
    F.mesh.count = n;
    F.mesh.instanceMatrix.needsUpdate = true; F.aP.needsUpdate = true; F.aQ.needsUpdate = true;
  }

  /* ---------- heat: nested isothermal shells (additive, fresnel) ---------- */
  const shellLevels = [0.18, 0.36, 0.54, 0.72, 0.88];
  const shellGeo = G(new THREE.SphereGeometry(1, 72, 36));
  const shellC = { value: V3(0, -0.64, 0) };
  const shells = shellLevels.map((l) => {
    const mat = M(new THREE.ShaderMaterial({
      uniforms: { ...U, uS: { value: V3(1, 1, 1) }, uC: shellC, uLevel: { value: l }, uGain: { value: 1 } },
      vertexShader: GLSL_SHELL.vert, fragmentShader: '#define YM_FRAG\n' + GLSL_COMMON + GLSL_SHELL.frag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    const mesh = new THREE.Mesh(shellGeo, mat);
    mesh.renderOrder = 5; mesh.frustumCulled = false; mesh.visible = false; gDer.add(mesh);
    return mesh;
  });

  /* ---------- RF current: flow tubes electrode → dermis/septa → neutral pad ---------- */
  const curU = { uT: U.uT, uCurrent: { value: 0 }, uReach: { value: 0 }, uOff: { value: new THREE.Vector4() }, uOffPad: { value: 0 }, uPadY: { value: padPos[1] } };
  const curGeo = (() => {
    const R = mkRng(seed * 31 + 5), NL = 20, parts = [];
    const cl = (v) => clamp(v, -1.9, 1.9);
    for (let i = 0; i < NL; i++) {
      const gx = (i % 5) / 4 - 0.5, gz = Math.floor(i / 5) / 3 - 0.5;
      const sx = gx * 1.6 + (R() - 0.5) * 0.12, sz = gz * 1.6 + (R() - 0.5) * 0.12;
      const j = () => (R() - 0.5) * 0.26;
      const bx = cl(sx * 1.8 + j() * 0.5), bz = cl(sz * 1.8 + j() * 0.5);
      const px = padPos[0] + gx * 3.0 + j() * 0.3, pz = padPos[2] + gz * 1.7 + j() * 0.3;
      const pts = [
        [sx, -0.03, sz], [sx * 1.02, -0.14, sz * 1.02],
        [cl(sx * 1.18 + j()), -0.42, cl(sz * 1.18 + j())], [cl(sx * 1.42 + j()), -0.80, cl(sz * 1.42 + j())],
        [cl(sx * 1.62 + j()), -1.25, cl(sz * 1.62 + j())], [cl(sx * 1.74 + j()), -1.78, cl(sz * 1.74 + j())],
        [bx, -2.32, bz], [lerp(bx, px, 0.45), lerp(-2.32, padPos[1] + 0.1, 0.55), lerp(bz, pz, 0.45)], [px, padPos[1] + 0.1, pz],
      ].map((p) => V3(p[0], p[1], p[2]));
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      for (const halo of [0, 1]) parts.push({ g: new THREE.TubeGeometry(curve, 160, halo ? 0.05 : 0.016, halo ? 8 : 6, false), lane: i, halo });
    }
    let nv = 0, ni = 0; for (const p of parts) { nv += p.g.attributes.position.count; ni += p.g.index.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), lane = new Float32Array(nv), halo = new Float32Array(nv), idx = new Uint32Array(ni);
    let ov = 0, oi = 0;
    for (const p of parts) {
      const a = p.g.attributes, c = a.position.count;
      pos.set(a.position.array, ov * 3); nor.set(a.normal.array, ov * 3); uv.set(a.uv.array, ov * 2);
      lane.fill(p.lane, ov, ov + c); halo.fill(p.halo, ov, ov + c);
      const ix = p.g.index.array; for (let k = 0; k < ix.length; k++) idx[oi + k] = ix[k] + ov;
      ov += c; oi += ix.length; p.g.dispose();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('aLane', new THREE.BufferAttribute(lane, 1));
    g.setAttribute('aHalo', new THREE.BufferAttribute(halo, 1)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    return G(g);
  })();
  const curMat = (gain, depthFunc) => M(new THREE.ShaderMaterial({
    uniforms: { ...curU, uGain: { value: gain } }, vertexShader: GLSL_CURRENT.vert, fragmentShader: GLSL_CURRENT.frag,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, depthFunc,
  }));
  const curVis = new THREE.Mesh(curGeo, curMat(1.0, THREE.LessEqualDepth));
  const curHid = new THREE.Mesh(curGeo, curMat(0.30, THREE.GreaterDepth));
  for (const m of [curVis, curHid]) { m.frustumCulled = false; m.renderOrder = 6; m.visible = false; root.add(m); }

  /* ---------- cooling mist + tip contact ring ---------- */
  const mistN = opts.mist ?? 84;
  const mistGeo = G(new THREE.InstancedBufferGeometry());
  { const pg = new THREE.PlaneGeometry(1, 1); mistGeo.index = pg.index; mistGeo.setAttribute('position', pg.attributes.position); mistGeo.setAttribute('uv', pg.attributes.uv);
    const R = mkRng(seed * 7 + 99), sd = new Float32Array(mistN), an = new Float32Array(mistN);
    for (let i = 0; i < mistN; i++) { sd[i] = (i + R()) / mistN; an[i] = R() * Math.PI * 2; }
    for (let i = mistN - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = sd[i]; sd[i] = sd[j]; sd[j] = t; }
    mistGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(sd, 1)); mistGeo.setAttribute('aAng', new THREE.InstancedBufferAttribute(an, 1));
    mistGeo.instanceCount = mistN; }
  const mist = new THREE.Mesh(mistGeo, M(new THREE.ShaderMaterial({
    uniforms: { uT: U.uT, uCool: U.uCool, uTipC: U.uTipC }, vertexShader: GLSL_MIST.vert, fragmentShader: GLSL_MIST.frag,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })));
  mist.frustumCulled = false; mist.renderOrder = 7; mist.visible = false; gEpi.add(mist);
  const ringU = { uT: U.uT, uCurrent: U.uCurrent, uCool: U.uCool, uOn: { value: 0 } };
  const ringGeo = G(new THREE.PlaneGeometry(3.6, 3.6)); ringGeo.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, M(new THREE.ShaderMaterial({ uniforms: ringU, vertexShader: GLSL_RING.vert, fragmentShader: GLSL_RING.frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  ring.position.y = 0.014; ring.renderOrder = 7; ring.frustumCulled = false; ring.visible = false; gEpi.add(ring);

  /* ---------- treatment tip ---------- */
  const rrect = (w, h, r) => { const s = new THREE.Shape(), a = w / 2, b = h / 2;
    s.moveTo(-a + r, -b); s.lineTo(a - r, -b); s.quadraticCurveTo(a, -b, a, -b + r); s.lineTo(a, b - r); s.quadraticCurveTo(a, b, a - r, b);
    s.lineTo(-a + r, b); s.quadraticCurveTo(-a, b, -a, b - r); s.lineTo(-a, -b + r); s.quadraticCurveTo(-a, -b, -a + r, -b); return s; };
  const tipHolder = new THREE.Group(); tipHolder.name = 'tip'; gEpi.add(tipHolder);
  let goldMat = null;
  if (opts.tip) tipHolder.add(opts.tip);
  else {
    goldMat = M(new THREE.MeshPhysicalMaterial({ color: 0xd9b464, metalness: 1, roughness: 0.26, clearcoat: 0.4, clearcoatRoughness: 0.2 }));
    const capMat = M(new THREE.MeshPhysicalMaterial({ color: 0x141518, metalness: 0, roughness: 0.38, clearcoat: 0.75, clearcoatRoughness: 0.2 }));
    const winMat = M(new THREE.MeshPhysicalMaterial({ color: 0x2a2116, metalness: 0.3, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }));
    const eg = G(new THREE.ExtrudeGeometry(rrect(2.02, 2.02, 0.24), { depth: 0.075, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.014, bevelSegments: 2, curveSegments: 10 }));
    eg.rotateX(-Math.PI / 2); eg.translate(0, 0.012, 0);
    const electrode = new THREE.Mesh(eg, goldMat); electrode.castShadow = true;
    const wg = G(new THREE.ShapeGeometry(rrect(1.58, 1.58, 0.14), 8)); wg.rotateX(Math.PI / 2); wg.translate(0, -0.002, 0);
    const win = new THREE.Mesh(wg, winMat);
    // cap: superellipse loft (square-ish at the electrode → round at the neck)
    const ringN = 96, rows = 34, cp = [], ci = [];
    for (let r = 0; r <= rows; r++) {
      // square sleeve (slight taper) → rounded shoulder that closes onto the handle collar
      const v = r / rows, sh = sstep(0.72, 1.0, v);
      const y = 0.1 + Math.min(v, 0.78) / 0.78 * 0.6 + sh * 0.1;
      const n = lerp(lerp(8, 5.5, v), 2.1, sh);
      const half = lerp(1.1 - 0.12 * v + 0.012 * Math.sin(v * Math.PI), 0.8, sh) - 0.03 * (1 - sstep(0, 0.06, v));
      for (let a = 0; a <= ringN; a++) {
        const th = (a / ringN) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
        cp.push(half * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), y, half * Math.sign(s) * Math.pow(Math.abs(s), 2 / n));
      }
    }
    for (let r = 0; r < rows; r++) for (let a = 0; a < ringN; a++) { const i0 = r * (ringN + 1) + a, i1 = i0 + ringN + 1; ci.push(i0, i1, i0 + 1, i1, i1 + 1, i0 + 1); }
    const cg = G(new THREE.BufferGeometry()); cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); cg.setIndex(ci); cg.computeVertexNormals();
    const cap = new THREE.Mesh(cg, capMat); cap.castShadow = true;
    const lip = new THREE.Mesh(G(new THREE.ExtrudeGeometry(rrect(2.0, 2.0, 0.26), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 10 })), capMat);
    lip.geometry.rotateX(-Math.PI / 2); lip.position.y = 0.085; lip.castShadow = true;
    tipHolder.add(electrode, win, cap, lip);
    if (opts.handle !== false) {
      const silver = M(new THREE.MeshPhysicalMaterial({ color: 0xdadde3, metalness: 0.55, roughness: 0.36, clearcoat: 0.5, clearcoatRoughness: 0.16, envMapIntensity: 1.4 }));
      const navy = M(new THREE.MeshPhysicalMaterial({ color: 0x1e222d, metalness: 0.2, roughness: 0.42, clearcoat: 0.6 }));
      const prof = [[0.001, 0.74], [0.79, 0.74], [0.84, 1.02], [0.91, 1.62], [0.92, 2.07], [0.84, 2.67], [0.74, 3.17], [0.76, 3.67], [0.85, 4.32], [0.87, 5.4]].map((p) => new THREE.Vector2(p[0], p[1]));
      const handle = new THREE.Mesh(G(new THREE.LatheGeometry(prof, 120)), silver); handle.castShadow = true;
      const seam = new THREE.Mesh(G(new THREE.TorusGeometry(0.80, 0.018, 8, 96)), navy); seam.rotation.x = Math.PI / 2; seam.position.y = 0.78;
      const btn = new THREE.Mesh(G(new THREE.SphereGeometry(1, 32, 16)), navy);
      // 使能按钮: long slim dark pill like the real YM5-H1 (not a round "eye")
      btn.scale.set(0.105, 0.6, 0.045); btn.position.set(Math.sin(0.62) * 0.905, 2.2, Math.cos(0.62) * 0.905); btn.rotation.set(-0.05, 0.62, 0, 'YXZ');
      tipHolder.add(handle, seam, btn);
    }
  }

  /* ---------- neutral (return) electrode pad ---------- */
  let foilMat = null;
  if (opts.pad !== false) {
    const foamMat = M(new THREE.MeshPhysicalMaterial({ color: 0xe4e6ea, roughness: 0.78, metalness: 0, sheen: 0.4, sheenColor: new THREE.Color(0xffffff) }));
    foilMat = M(new THREE.MeshPhysicalMaterial({ color: 0xb4bfce, roughness: 0.32, metalness: 0.75, clearcoat: 0.6, clearcoatRoughness: 0.2, emissive: 0x000000 }));
    const cableMat = M(new THREE.MeshPhysicalMaterial({ color: 0x3a3f4a, roughness: 0.45, metalness: 0, clearcoat: 0.4 }));
    const foam = new THREE.Mesh(G(new THREE.ExtrudeGeometry(rrect(4.4, 2.9, 0.4), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.03, bevelSegments: 3, curveSegments: 12 })), foamMat);
    foam.geometry.rotateX(-Math.PI / 2); foam.receiveShadow = true;
    const foil = new THREE.Mesh(G(new THREE.ExtrudeGeometry(rrect(3.7, 2.25, 0.28), { depth: 0.02, bevelEnabled: false, curveSegments: 12 })), foilMat);
    foil.geometry.rotateX(-Math.PI / 2); foil.position.y = 0.075; foil.receiveShadow = true;
    const tab = new THREE.Mesh(G(new THREE.BoxGeometry(0.55, 0.05, 0.6)), foamMat); tab.position.set(2.45, 0.03, 0);
    const cable = new THREE.Mesh(G(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(2.6, 0.05, 0), V3(3.3, 0.03, 0.2), V3(4.1, -0.02, 0.9), V3(5.2, -0.06, 2.2)]), 48, 0.05, 10, false)), cableMat);
    const shadowMat = M(new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'varying vec2 vP; void main(){ vec2 q = abs(vP) - vec2(1.7); float d = length(max(q,0.)) + min(max(q.x,q.y),0.); gl_FragColor = vec4(0.,0.,0., 0.42*exp(-max(d,0.)*2.2)*smoothstep(-1.8,0.,d)*0.6 + 0.25*exp(-max(d,0.)*2.2)); }' }));
    const sg = G(new THREE.PlaneGeometry(6, 6)); sg.rotateX(-Math.PI / 2);
    const blob = new THREE.Mesh(sg, shadowMat); blob.position.set(-padPos[0], 0.1, -padPos[2]); blob.renderOrder = 2;
    gPad.add(foam, foil, tab, cable, blob);
    gPad.position.set(padPos[0], padPos[1], padPos[2]);
  }

  /* ---------- update (pure function of params) ---------- */
  const off = { epi: 0, der: 0, sub: 0, mus: 0, pad: 0 };
  const lastFib = new Float64Array([NaN, NaN, NaN, NaN]);
  const state = { xc: 2, week: 0, g1: 0 };
  function update(params = {}) {
    const t = num(params.t, 0);
    const tipOn = clamp(num(params.tip, 1)), press = clamp(num(params.tipPress, 0));
    const current = clamp(num(params.current, 0)), heat = clamp(num(params.heat, 0)), cool = clamp(num(params.cool, 0));
    const contraction = clamp(num(params.contraction, 0)), week = clamp(num(params.week, 0), 0, 12);
    const wrinkle = clamp(num(params.wrinkle, 1)), cut = clamp(num(params.cutaway, 0)), xray = clamp(num(params.xray, 0));
    const ex = clamp(num(params.explode, 0));
    const stain = typeof params.stain === 'number' && isFinite(params.stain) ? clamp(params.stain) : (params.stainMode === 'darkfield' ? 0 : 1);
    const hl = num(params.highlight, 0) | 0, hla = clamp(num(params.highlightAmount, 1));
    const r1 = ratioI(week), r3 = ratioIII(week);
    const g1 = (r1 - 1) / (coll.type1[2] - 1), g3 = (r3 - 1) / (coll.type3[2] - 1);

    U.uT.value = t; U.uWrinkle.value = wrinkle; U.uHeat.value = heat; U.uCool.value = cool; U.uCoolDepth.value = 0.035 + 0.30 * cool;
    U.uCurrent.value = current; U.uContract.value = contraction; U.uG1.value = g1; U.uG3.value = g3; U.uStain.value = stain; U.uXray.value = xray;
    U.uHi1.value = hl === 1 ? hla : 0; U.uHi3.value = hl === 3 ? hla : 0;
    faceU.uFaceMix.value = clamp(num(params.faceMix, 1));

    // tip: hover → touch (press 0.6) → dent (press 1); tip 0 lifts it out
    const touch = sstep(0, 0.6, press), dent = sstep(0.6, 1, press) * sstep(0.85, 1, tipOn);
    U.uDent.value = dent; U.uTipOn.value = tipOn;
    tipHolder.position.set(0, 0.45 * (1 - touch) - 0.045 * dent + Math.pow(1 - tipOn, 1.5) * 6.5, 0);
    tipHolder.visible = tipOn > 0.01;
    ringU.uOn.value = touch * sstep(0.85, 1, tipOn);
    ring.visible = ringU.uOn.value > 0.001 && (current > 0.001 || cool > 0.001);
    if (goldMat) goldMat.emissive.setRGB(0.95 * current * 0.5 + 0.25 * cool, 0.55 * current * 0.5 + 0.55 * cool, 0.9 * current * 0.5 + 0.9 * cool).multiplyScalar(0.35 * touch);

    // explode
    off.epi = 0.85 * ex; off.der = 0.25 * ex; off.sub = -0.42 * ex; off.mus = -0.95 * ex; off.pad = -1.45 * ex;
    gEpi.position.y = off.epi; gDer.position.y = off.der; gSub.position.y = off.sub; gMus.position.y = off.mus;
    const padV = clamp(num(params.pad, 1));
    gPad.position.y = padPos[1] + off.pad - (1 - padV) * 1.2;
    gPad.visible = opts.pad !== false && padV > 0.01;
    curU.uOff.value.set(off.epi, off.der, off.sub, smas ? off.mus : off.sub); curU.uOffPad.value = off.pad;

    // notch
    const xc = 2 - 2 * cut; U.uNotchG.value.set(xc, xc); state.xc = xc;
    if (slabMats[1]) slabMats[1].depthWrite = xray < 0.01;

    // collagen fibres (only recomputed when their inputs change)
    const ff = clamp(num(params.fibreFill, 0.25)); fillU.value = 0.3 + 2.7 * ff * ff;
    if (lastFib[0] !== week || lastFib[1] !== contraction || lastFib[2] !== xc || lastFib[3] !== fillU.value) {
      lastFib[0] = week; lastFib[1] = contraction; lastFib[2] = xc; lastFib[3] = fillU.value;
      layoutFibres(fib1, base1 * r1, g1, contraction, xc, fillU.value);
      layoutFibres(fib3, base3 * r3, g3, contraction, xc, fillU.value);
    }
    fib1.crimpU.uCrimpK.value = 1; fib3.crimpU.uCrimpK.value = 1;

    // heat shells
    const hmax = heat * 1.06;
    shellC.value.set(0, -0.64, 0);
    for (let k = 0; k < shells.length; k++) {
      const sh = shells[k], l = shellLevels[k];
      if (hmax > l * 1.01) {
        const r = Math.sqrt(Math.log(hmax / l) / 1.35);
        sh.visible = true; sh.position.set(0, -0.64, 0); sh.scale.set(1.32 * r, 0.42 * r, 1.32 * r);
        sh.material.uniforms.uS.value.copy(sh.scale); sh.material.uniforms.uGain.value = sstep(0, 0.35, heat) * (k === 0 ? 0.8 : 1);
      } else sh.visible = false;
    }

    // current
    curU.uCurrent.value = current; curU.uReach.value = clamp(current * 2.4) * 1.03;
    curVis.visible = curHid.visible = current > 0.001;
    if (foilMat) foilMat.emissive.setRGB(0.25, 0.85, 0.62).multiplyScalar(0.35 * current * sstep(0.85, 1.0, curU.uReach.value));

    mist.visible = cool > 0.001 && tipOn > 0.5;
    root.rotation.y = num(params.rotate, 0);
    state.week = week; state.g1 = g1;
  }

  /* ---------- anchors (world space) ---------- */
  const anchors = ['surface', 'epidermis', 'dermis', 'papillary', 'reticular', 'subcutis', 'smas', 'heatCore', 'tip', 'tipTop', 'pad', 'typeI', 'typeIII', 'cool', 'wrinkle', 'notch', 'current'];
  function anchor(name, out = new THREE.Vector3()) {
    root.updateWorldMatrix(true, true);
    const g1 = state.g1, yD = -1.1 - 0.12 * g1;
    let grp = root;
    switch (name) {
      case 'surface': out.set(-1.25, 0.0, 1.25); grp = gEpi; break;
      case 'epidermis': out.set(-2, -0.075, 2); grp = gEpi; break;
      case 'dermis': out.set(-2, (-0.2 + yD) / 2, 2); grp = gDer; break;
      case 'papillary': out.set(-2, -0.25 - 0.03 * g1, 2); grp = gDer; break;
      case 'reticular': out.set(-2, (-0.36 + yD) / 2 - 0.1, 2); grp = gDer; break;
      case 'subcutis': out.set(-2, (yD + (smas ? -2.02 : -2.32)) / 2, 2); grp = gSub; break;
      case 'smas': out.set(-2, -2.17, 2); grp = smas ? gMus : gSub; break;
      case 'heatCore': out.set(0, -0.64, 0); grp = gDer; break;
      case 'tip': out.set(0, 0, 0); grp = tipHolder; break;
      case 'tipTop': out.set(0.8, 0.5, 0.8); grp = tipHolder; break;
      case 'pad': out.set(0, 0.1, 0); grp = gPad; break;
      case 'typeI': out.set(Math.max(state.xc, 0) * 0.5 + 1.0, -0.78 - 0.06 * g1, Math.max(state.xc, 0) * 0.5 + 1.0); grp = gDer; break;
      case 'typeIII': out.set(Math.max(state.xc, 0) * 0.5 + 1.0, -0.26, Math.max(state.xc, 0) * 0.5 + 1.2); grp = gDer; break;
      case 'cool': out.set(0.0, 0.03, 1.25); grp = gEpi; break;
      case 'wrinkle': out.set(-1.55, -0.03, -0.12); grp = gEpi; break;
      case 'notch': out.set(state.xc, -0.62, state.xc); grp = gDer; break;
      case 'current': out.set(padPos[0] * 0.6, lerp(-2.32, padPos[1], 0.5) + (off.mus + off.pad) / 2, padPos[2] * 0.6 + 0.5); grp = root; break;
      default: out.set(0, 0, 0);
    }
    return grp.localToWorld(out);
  }

  function dispose() {
    for (const g of geos) g.dispose();
    for (const m of mats) m.dispose();
    for (const t of texs) t.dispose();
    root.removeFromParent();
  }

  update({});
  return {
    object3d: root, update, dispose, anchor, anchors,
    refreshFace() { if (faceTex) faceTex.needsUpdate = true; },
    ratios: (w) => ({ typeI: ratioI(w), typeIII: ratioIII(w) }),
    layers: (w = 0) => { const g = (ratioI(w) - 1) / (coll.type1[2] - 1); return { surface: 0, junction: -0.14, papillary: -0.345 - 0.06 * g, dermisBase: -1.1 - 0.12 * g, subcutisBase: smas ? -2.02 : -2.32, bottom: -2.32 }; },
    groups: { epidermis: gEpi, dermis: gDer, subcutis: gSub, smas: gMus, pad: gPad, tip: tipHolder },
  };
}
