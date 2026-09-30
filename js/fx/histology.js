/*!
 * SkinFX.Histology — procedural, animated H&E cross-section of skin (YOUMAGIC)
 * ---------------------------------------------------------------------------
 * 模拟示意 · 基于彩页组织学与临床资料的原理可视化，不代表个体实际效果
 * (SIMULATION ONLY — a principle visualisation modelled on the brochure's pig-skin
 *  H&E photos ×2 / ×200 and its collagen-ratio chart. Not a real specimen.)
 *
 * Plain classic script (no modules, no deps). Attaches window.SkinFX.Histology.
 * Raw WebGL2 with a WebGL1 fallback (same GLSL ES 1.00 shaders; WebGL1 only
 * loses the mip-based depth-of-field / dark-field bloom). Two passes:
 *   A) tissue pass   -> RGBA8 FBO (rgb = stained tissue, a = "conductivity"
 *                       map used by heat / current), rendered at a capped pixel
 *                       budget (and never finer than the ~0.55 µm optical floor)
 *                       and SKIPPED automatically when nothing that affects the
 *                       tissue changed (heat/cool/current/time are then ~free).
 *                       Collagen = two-level warped Voronoi: fascicles with a
 *                       shared orientation → bundle pieces with fibrillar
 *                       texture, crisp lens-shaped clefts and fibroblast nuclei
 *                       seated in the clefts; epidermis = SDF band + conical rete
 *                       ridges with basal (columnar) → granular (flattened)
 *                       nuclei; vessels, capillary loops, plexus cords,
 *                       follicles, gland coils, adipocytes + fibrous septa.
 *   B) optics pass   -> microscope look (field-curvature/section DoF via mips,
 *                       lateral chromatic softness, bright-field vignette or
 *                       dark-field bloom + ACES), RF heat (brand heat scale,
 *                       isotherms), cooling front, RF current streamlines from
 *                       the tip electrode, split divider, scale bar with label.
 * Fully deterministic: the image depends ONLY on create() options and render()
 * params (seeded hash noise, no clocks, no RNG, no internal loops).
 *
 * World model (mm, y = depth below the nominal skin surface, pig-skin scale):
 *   stratum corneum ~15 µm basket-weave · epidermis ~75 µm + rete ridges to
 *   ~0.2 mm · papillary dermis (loose, Type Ⅲ-rich, cellular, capillaries) ·
 *   reticular dermis (wavy eosinophilic Type Ⅰ bundles with clefts, fibroblasts,
 *   vessels, follicles, gland coils) · subcutis at ~1.95 mm (adipocytes, septa).
 *
 * API
 *   var fx = SkinFX.Histology.create(canvas, {
 *     seed: 1,                   // integer; picks the specimen
 *     dpr: devicePixelRatio,     // capped at 2
 *     preserveDrawingBuffer: false,
 *     maxTissuePixels: 1.2e6,    // pixel budget of the tissue pass (quality/speed)
 *   });                          // -> null when WebGL is unavailable
 *   fx.resize(cssW, cssH);       // canvas pixel size = css × dpr (capped). No CSS.
 *   fx.render(params);           // one frame; call from YOUR rAF / timeline
 *   fx.dispose();
 *   fx.webgl2 (bool) · fx.canvas
 *   fx.worldToCss(xMm, yMm[, out]) -> {x, y} css px of a world point (last frame)
 *   SkinFX.Histology.ratios(week) -> {typeI, typeIII}  (brochure curve, smooth)
 *   SkinFX.Histology.layers(week) -> nominal layer depths in mm (for labels)
 *
 * render(params) — every field optional:
 *   time           s. Only drives heat shimmer, current flow, cooling-front
 *                  ripple and grain frame. Never read from a clock.          [0]
 *   week           0..12 regeneration timeline. Collagen density follows the
 *                  brochure ratio curve Type Ⅰ 1.00→1.42→1.61, Type Ⅲ
 *                  1.00→1.38→1.49 at weeks 0/4/12 (smooth saturating fit through
 *                  those points): bundles denser, more homogeneous/organised,
 *                  clefts narrower, more fibroblast activity, more fine fibres,
 *                  dermis thicker.                                            [0]
 *   heat           0..1 RF delivery. Brand heat scale (--heat-0..6) blended over
 *                  the stain, concentrated in the mid/deep dermis under the tip
 *                  and along fibrous septa of the subcutis; isotherm contours. [0]
 *   cool           0..1 cryogen cooling front (#7fd4ff) descending from the
 *                  surface under the tip; suppresses heat above it.           [0]
 *   current        0..1 RF current streamlines (violet→mint) diverging from the
 *                  tip electrode at top centre towards the bottom (return
 *                  electrode), pulses flowing with time; tip electrode drawn. [0]
 *   contraction    0..1 immediate thermal effect (原理示意): bundles tighten
 *                  laterally toward the tip axis, straighten, clefts close,
 *                  brief eosinophilic brightening.                           [0]
 *   stain          1 = realistic H&E bright-field, 0 = stylised dark-field
 *                  fluorescence on #07070c (Type Ⅰ violet-pink, Type Ⅲ mint,
 *                  nuclei blue). Values in between "develop" across the
 *                  section as an organic front with a soft glowing edge
 *                  (animate 1→0 for the transition; it is attached to the
 *                  tissue, not the screen).                                   [1]
 *   highlight      0 none | 1 emphasise Type Ⅰ thick bundles | 3 emphasise Type
 *                  Ⅲ fine reticular fibres (others fade).                      [0]
 *   highlightAmount 0..1 fade of the highlight (for transitions).             [1]
 *   magnification  0 = ×2 full-thickness overview … 1 = ×200 close-up of the
 *                  papillary / upper reticular dermis (log-smooth morph).     [0]
 *   split          -1 off | 0..1 compare: left of the divider (canvas x
 *                  fraction) uses params.before, right uses the main params. [-1]
 *   before         {week, contraction, heat?, cool?, current?} for the left
 *                  side (heat/cool/current default to the main values). [{0,0}]
 *   pan            {x, y} view offset in view-heights (+x right, +y deeper). [0,0]
 *   zoom           extra zoom factor on top of magnification (about centre).  [1]
 *   scaleBar       draw the scale bar + µm/mm label (bottom-left).         [true]
 *   splitHandle    draw the round handle on the divider.                   [true]
 *   isotherms      draw isotherm contours when heat > 0.                   [true]
 *   grain, vignette, chroma, dof   0..1 microscope look amounts.           [1]
 *
 * The caller must show the label “模拟示意 · 基于彩页组织学与临床资料的原理可视化，
 * 不代表个体实际效果” next to anything rendered by this engine
 * (SkinFX.Histology.disclaimer holds the string).
 *
 * Performance (Apple M4, Chrome, 1440×900 css, measured GPU throughput): a
 * frame that re-renders the tissue (week / magnification / contraction / stain /
 * split / pan changing) costs ~2.6–3.9 ms at dpr 1 and ~3.8–5.0 ms at dpr 2
 * (worst case ≈ magnification 0.5); frames where only time / heat / cool /
 * current change reuse the cached tissue and cost ~0.4 ms at dpr 2. Lower
 * opts.maxTissuePixels (default 1.2e6) for slower GPUs. (QA realism pass: the
 * fibril / frayed-cleft detail and the continuous surface folds add ~0.4 ms to a
 * tissue re-render — timer-query A/B, headless Chrome on Metal, 1440×900.)
 * At magnification → 1 the frame tracks the local skin surface (JS twin of
 * surfaceBase) so the stratum corneum stays in view for every seed / pan.
 */
(function (root) {
  'use strict';
  if (!root) return;
  var SkinFX = (root.SkinFX = root.SkinFX || {});

  /* ------------------------------------------------------------------ data */
  // src: 彩页 p.4 胶原蛋白相对含量曲线 (values read off the chart, approximate)
  var RI4 = 1.42, RI12 = 1.61, RIII4 = 1.38, RIII12 = 1.49;
  // r(w) = 1 + A (1 - e^{-k w}) passes exactly through (0,1), (4,r4), (12,r12)
  function fitSat(r4, r12) {
    var R = (r12 - 1) / (r4 - 1);
    var x = (-1 + Math.sqrt(4 * R - 3)) / 2;
    return { A: (r4 - 1) / (1 - x), k: -Math.log(x) / 4 };
  }
  var FI = fitSat(RI4, RI12), FIII = fitSat(RIII4, RIII12);
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function ratioI(w) { w = clamp(w, 0, 12); return 1 + FI.A * (1 - Math.exp(-FI.k * w)); }
  function ratioIII(w) { w = clamp(w, 0, 12); return 1 + FIII.A * (1 - Math.exp(-FIII.k * w)); }
  function progI(w) { return (ratioI(w) - 1) / (RI12 - 1); }     // 0..1
  function progIII(w) { return (ratioIII(w) - 1) / (RIII12 - 1); } // 0..1

  /* ------------------------------------------------------------ view model */
  var VIEW_H_OVER = 3.45;   // mm visible height at ×2
  var VIEW_H_CLOSE = 0.40;  // mm visible height at ×200
  var TOP_OVER = 0.11;      // fraction of the view above the surface at ×2
  var TOP_CLOSE = 0.085;    // … at ×200
  var DERMIS_T = 1.95;      // nominal dermis thickness at week 0 (mm)
  var DERMIS_GROW = 0.22;   // visual thickening at week 12 (fraction)

  // JS twin of the GLSL surfaceBase(): lets the close-up frame follow the local skin surface
  function jfract(v) { return v - Math.floor(v); }
  function jhash11(p) { p = jfract(p * 0.1031); p *= p + 33.33; p *= p + p; return jfract(p); }
  function jvnoise1(x) { var i = Math.floor(x), f = x - i; f = f * f * (3 - 2 * f); return (jhash11(i) + (jhash11(i + 1) - jhash11(i)) * f) * 2 - 1; }
  function surfaceBaseJS(x) { return 0.05 * jvnoise1(x * 1.3 + 1.7) + 0.013 * jvnoise1(x * 3.4) + 0.006 * jvnoise1(x * 9.0 + 7.1); }

  function computeView(mag, zoom, panX, panY, aspect, out, seedX) {
    var lh = Math.log(VIEW_H_OVER) + (Math.log(VIEW_H_CLOSE) - Math.log(VIEW_H_OVER)) * mag;
    var vh = Math.exp(lh);
    var top = TOP_OVER + (TOP_CLOSE - TOP_OVER) * mag;
    // at high magnification the frame tracks the local surface height (±50 µm) so the stratum
    // corneum stays in frame instead of drifting off the top edge for some seeds / pans
    var cy = -top * vh + vh * 0.5 + (seedX == null ? 0 : surfaceBaseJS(seedX + panX * vh / zoom) * clamp01(mag * 1.4));
    vh = vh / zoom;
    out[0] = panX * vh;
    out[1] = cy + panY * vh;
    out[2] = vh * aspect;
    out[3] = vh;
  }

  /* ------------------------------------------------------------ glyphs 5×7 */
  var GLYPH_ROWS = {
    '0': [14, 17, 19, 21, 25, 17, 14], '1': [4, 12, 4, 4, 4, 4, 14],
    '2': [14, 17, 1, 2, 4, 8, 31], '3': [31, 2, 4, 2, 1, 17, 14],
    '4': [2, 6, 10, 18, 31, 2, 2], '5': [31, 16, 30, 1, 1, 17, 14],
    '6': [6, 8, 16, 30, 17, 17, 14], '7': [31, 1, 2, 4, 8, 8, 8],
    '8': [14, 17, 17, 14, 17, 17, 14], '9': [14, 17, 17, 15, 1, 2, 12],
    'u': [0, 0, 18, 18, 18, 29, 16], 'm': [0, 0, 26, 21, 21, 21, 21], ' ': [0, 0, 0, 0, 0, 0, 0]
  };
  function packGlyph(r) {
    return [r[0] * 32768 + r[1] * 1024 + r[2] * 32 + r[3], r[4] * 1024 + r[5] * 32 + r[6]];
  }
  var GLYPH_DIGIT = [], GLYPH_U = packGlyph(GLYPH_ROWS.u), GLYPH_M = packGlyph(GLYPH_ROWS.m), GLYPH_SP = packGlyph(GLYPH_ROWS[' ']);
  for (var gi = 0; gi < 10; gi++) GLYPH_DIGIT.push(packGlyph(GLYPH_ROWS[String(gi)]));
  var BAR_STEPS_UM = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];

  function seedOffset(seed, out) {
    function h(n) {
      n = (n ^ 61) ^ (n >>> 16); n = Math.imul(n, 9); n ^= n >>> 4;
      n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296;
    }
    var s = Math.floor(num(seed, 1)) | 0;
    out[0] = 3 + h(s * 2 + 11) * 34;
    out[1] = 3 + h(s * 2 + 12) * 34;
  }

  /* =============================================================== GLSL === */
  var VERT = 'attribute vec2 aPos;\nvoid main(){ gl_Position = vec4(aPos, 0.0, 1.0); }\n';

  var COMMON = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
#define PI 3.14159265
#define ELEC_A 1.0
uniform vec2 uSeed;
uniform float uStain;  // 1 = H&E bright-field, 0 = dark-field fluorescence

float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec4 hash42(vec2 p){ vec4 p4 = fract(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099)); p4 += dot(p4, p4.wzxy + 33.33); return fract((p4.xxyz + p4.yzzw) * p4.zywx); }
vec4 hash41(float p){ vec4 p4 = fract(vec4(p) * vec4(0.1031, 0.1030, 0.0973, 0.1099)); p4 += dot(p4, p4.wzxy + 33.33); return fract((p4.xxyz + p4.yzzw) * p4.zywx); }

float vnoise1(float x){ float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash11(i), hash11(i + 1.0), f) * 2.0 - 1.0; }

float gnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 ga = hash22(i) * 2.0 - 1.0;
  vec2 gb = hash22(i + vec2(1.0, 0.0)) * 2.0 - 1.0;
  vec2 gc = hash22(i + vec2(0.0, 1.0)) * 2.0 - 1.0;
  vec2 gd = hash22(i + vec2(1.0, 1.0)) * 2.0 - 1.0;
  float va = dot(ga, f);
  float vb = dot(gb, f - vec2(1.0, 0.0));
  float vc = dot(gc, f - vec2(0.0, 1.0));
  float vd = dot(gd, f - vec2(1.0, 1.0));
  return mix(mix(va, vb, u.x), mix(vc, vd, u.x), u.y);
}

// gradient noise + analytic derivatives (x: value, yz: d/dp) — used for curl warps
vec3 gnoised(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  vec2 ga = hash22(i) * 2.0 - 1.0;
  vec2 gb = hash22(i + vec2(1.0, 0.0)) * 2.0 - 1.0;
  vec2 gc = hash22(i + vec2(0.0, 1.0)) * 2.0 - 1.0;
  vec2 gd = hash22(i + vec2(1.0, 1.0)) * 2.0 - 1.0;
  float va = dot(ga, f);
  float vb = dot(gb, f - vec2(1.0, 0.0));
  float vc = dot(gc, f - vec2(0.0, 1.0));
  float vd = dot(gd, f - vec2(1.0, 1.0));
  float k4 = va - vb - vc + vd;
  float v = va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * k4;
  vec2 d = ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd) + du * (u.yx * k4 + vec2(vb, vc) - va);
  return vec3(v, d);
}

// H&E <-> dark-field: intermediate stain values "develop" across the section as an organic
// front attached to the tissue (same field in both passes, so the seam is pixel-exact)
float stainMask(vec2 p, float viewH){
  if (uStain >= 1.0) return 1.0;
  if (uStain <= 0.0) return 0.0;
  vec2 q = p / viewH;
  float f = clamp(0.5 + 0.6 * gnoise(q * 1.7 + 91.0) + 0.22 * gnoise(q * 5.0 + 17.0) + 0.08 * gnoise(q * 14.0 + 5.0), 0.0, 1.0);
  float w = 0.06;
  return smoothstep(f - w, f + w, uStain * (1.0 + 2.0 * w) - w);
}

// low-frequency part of the surface (what a flat electrode rests on)
float surfaceBase(float x){
  return 0.05 * vnoise1(x * 1.3 + 1.7) + 0.013 * vnoise1(x * 3.4) + 0.006 * vnoise1(x * 9.0 + 7.1);
}
// skin surface (world y of the top of the viable epidermis) at seeded x
float surfaceY(float x){
  float s = surfaceBase(x) + 0.0022 * vnoise1(x * 31.0 + 2.3);
  // narrow furrow + a broad rounded valley leading into it -> domed hills in between
  // (neighbour cells are summed so the broad valleys stay continuous across cell borders)
  float c0 = floor(x / 1.05);
  for (int k = -1; k <= 1; k++) {
    float c = c0 + float(k);
    float h = hash11(c * 1.37 + 11.0);
    if (h > 0.36) {
      float cx = (c + 0.25 + 0.5 * hash11(c * 2.11 + 5.0)) * 1.05;
      float dx = (x - cx) / (0.03 + 0.035 * h);
      float bx = (x - cx) / (0.2 + 0.14 * h);
      float dep = 0.04 + 0.26 * (h - 0.36);
      s += dep * (exp(-dx * dx) / (1.0 + 2.0 * abs(dx)) + 0.8 * exp(-bx * bx));
    }
  }
  return s;
}
// dermis thickness (mm) at seeded x; grow = Type I progress 0..1
float dermisThickness(float x, float grow){
  float t = ${DERMIS_T.toFixed(3)} + 0.12 * vnoise1(x * 0.9 + 3.0) + 0.05 * vnoise1(x * 3.1 + 1.0);
  return t * (1.0 + ${DERMIS_GROW.toFixed(3)} * grow);
}
// lateral spread of the RF field under the tip (world x, depth d)
float lateralEnv(float x, float d){
  float ex = max(abs(x) - 0.7 * ELEC_A, 0.0) / (0.35 + 0.65 * max(d, 0.0));
  return 1.0 / (1.0 + 1.6 * ex * ex);
}
// volumetric RF heating profile (before tissue conductivity / cooling)
float thermalEnv(vec2 p, float ys, float yd){
  float d = p.y - ys;
  float z = d / max(yd - ys, 0.3);
  float prof = 0.30 + 0.70 * exp(-(z - 0.66) * (z - 0.66) / 0.20);
  prof = max(prof, 0.62 * (1.0 - smoothstep(1.2, 2.4, z)) * step(1.0, z));
  return prof * lateralEnv(p.x, d) * smoothstep(-0.02, 0.0, d);
}
`;

  /* ---------------------------------------------------- tissue pass (A) */
  var FRAG_TISSUE = COMMON + `
uniform vec2 uRes;
uniform vec2 uCenter;
uniform vec2 uView;
uniform float uSplit;
uniform vec4 uSideA;   // main:   gI, gIII, contraction, grow
uniform vec4 uSideB;   // before: gI, gIII, contraction, grow
uniform vec2 uHL;      // highlight Type I, Type III
float gStainM = 1.0;   // per-pixel stain mix (set in main)
float gLod = 0.0;      // 0 at ×200 … 1 at ×2 (low-magnification look; set in main)

// H&E palette calibrated on the brochure micrographs (k-means of DA p.4 photos)
const vec3 HE_BG      = vec3(0.984, 0.955, 0.980);
const vec3 HE_CLEFT   = vec3(0.980, 0.948, 0.976);
const vec3 HE_B_PALE  = vec3(0.925, 0.785, 0.890);
const vec3 HE_B_DENSE = vec3(0.810, 0.570, 0.750);
const vec3 HE_B_HOT   = vec3(0.905, 0.500, 0.780);
const vec3 HE_PAP     = vec3(0.955, 0.880, 0.945);
const vec3 HE_FINE    = vec3(0.820, 0.590, 0.800);
const vec3 HE_NUC     = vec3(0.225, 0.145, 0.415);
const vec3 HE_EPI_TOP = vec3(0.735, 0.560, 0.780);
const vec3 HE_EPI_BAS = vec3(0.400, 0.250, 0.540);
const vec3 HE_GRAN    = vec3(0.420, 0.255, 0.575);
const vec3 HE_SC      = vec3(0.820, 0.500, 0.745);
const vec3 HE_RBC     = vec3(0.860, 0.320, 0.420);
const vec3 HE_PLASMA  = vec3(0.950, 0.870, 0.925);
const vec3 HE_WALL    = vec3(0.790, 0.600, 0.790);
const vec3 HE_LUMEN   = vec3(0.982, 0.962, 0.976);
const vec3 HE_FAT     = vec3(0.985, 0.964, 0.979);
const vec3 HE_FATB    = vec3(0.860, 0.715, 0.850);
const vec3 HE_ORS     = vec3(0.540, 0.380, 0.680);
const vec3 HE_IRS     = vec3(0.880, 0.520, 0.760);
const vec3 HE_SHAFT   = vec3(0.920, 0.820, 0.740);
const vec3 HE_GLAND   = vec3(0.560, 0.400, 0.700);

const vec3 DF_BG   = vec3(0.027, 0.027, 0.047);
const vec3 DF_I    = vec3(0.760, 0.370, 0.920);
const vec3 DF_III  = vec3(0.263, 0.902, 0.659);
const vec3 DF_NUC  = vec3(0.420, 0.720, 1.000);
const vec3 DF_EPI  = vec3(0.140, 0.080, 0.280);
const vec3 DF_SC   = vec3(0.420, 0.170, 0.420);
const vec3 DF_RBC  = vec3(0.760, 0.200, 0.500);
const vec3 DF_WALL = vec3(0.330, 0.200, 0.560);

// coverage of a line |n| < t (noise units) for a pixel footprint w (noise units)
float lineCov(float an, float t, float w){
  w = max(w, 1e-6);
  float c;
  if (w < 2.0 * t) c = clamp((t - an) / w + 0.5, 0.0, 1.0);
  else c = (2.0 * t / w) * clamp(1.0 - an / w, 0.0, 1.0);
  return mix(c, min(3.6 * t, 1.0), smoothstep(0.2, 0.55, w));
}
// anti-aliased ellipse coverage; d local offset (mm), r semi-axes (mm)
float ellCov(vec2 d, vec2 r, float px){
  float k0 = length(d / r);
  float k1 = length(d / (r * r));
  float dist = (k1 > 1e-7) ? k0 * (k0 - 1.0) / k1 : -min(r.x, r.y);
  float att = (r.x * r.y) / (max(r.x, 0.5 * px) * max(r.y, 0.5 * px));
  return clamp(0.5 - dist / px, 0.0, 1.0) * att;
}
float discCov(float dist, float r, float px){
  float att = r * r / (max(r, 0.5 * px) * max(r, 0.5 * px));
  return clamp(0.5 - (dist - r) / px, 0.0, 1.0) * att;
}
vec2 rot2(vec2 v, float a){ float c = cos(a); float s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float sdUnevenCapsule(vec2 p, float r1, float r2, float h){
  p.x = abs(p.x);
  float b = (r1 - r2) / h;
  float a = sqrt(1.0 - b * b);
  float k = dot(p, vec2(-b, a));
  if (k < 0.0) return length(p) - r1;
  if (k > a * h) return length(p - vec2(0.0, h)) - r2;
  return dot(p, vec2(a, b)) - r1;
}

/* ---- epidermis: base band + rete ridges (signed distance, <0 inside) ---- */
float epiSDF(float x, float y, float ys){
  float base = ys + 0.072 + 0.010 * vnoise1(x * 8.0 + 3.0);
  float d = y - base;
  float W = 0.082;
  float ci = floor(x / W);
  float dm = 1e3;
  for (int k = -1; k <= 1; k++) {
    float c = ci + float(k);
    vec4 h = hash41(c + 17.0);
    if (h.w > 0.2) {
      float cx = (c + 0.5 + (h.x - 0.5) * 0.7) * W;
      float depth = (0.025 + 0.12 * h.y * (0.55 + 0.45 * h.y)) * (1.0 - 0.35 * gLod);
      float r1 = 0.02 + 0.018 * h.z;
      float r2 = r1 * (0.32 + 0.25 * h.x);
      vec2 lp = vec2(x - cx, y - base + 0.012);
      lp = rot2(lp, (h.z - 0.5) * 0.5);
      lp.x += (h.w - 0.54) * 1.5 * lp.y * lp.y + 0.003 * sin(lp.y * 110.0 + h.y * 6.2831);
      dm = min(dm, sdUnevenCapsule(lp, r1, r2, depth + 0.012));
    }
  }
  float sd = smin(d, dm, 0.024);
  // cellular raggedness of the dermal-epidermal junction
  sd += 0.0017 * gnoise(vec2(x, y) * 190.0) + 0.0024 * gnoise(vec2(x, y) * 70.0 + 5.0);
  return sd;
}

void epidermisShade(vec2 p, vec2 pn, float ys, float sdE, float px, out vec3 he, out vec3 df){
  float ds = p.y - ys;
  float db = -sdE;
  float basal = 1.0 - smoothstep(0.005, 0.016, db);
  float gran = exp(-pow((ds - 0.009) / 0.005, 2.0));
  float deep = smoothstep(0.008, 0.07, ds);
  vec3 cyto = mix(HE_EPI_TOP, HE_EPI_BAS, clamp(max(0.6 * basal, 0.6 * deep), 0.0, 1.0));
  cyto = mix(cyto, HE_GRAN, gran * 0.5);
  float det = 1.0 - smoothstep(0.0024, 0.0048, px);
  float meanN = (0.28 + 0.26 * basal) * (1.0 - 0.3 * gran) * smoothstep(0.002, 0.010, ds);
  float nuc = meanN;
  float memb = 0.0;
  vec3 ncol = HE_NUC;
  float tex = 0.0;
  float vesF = 0.0;
  if (det > 0.001) {
    vec2 tg = vec2(1.0, 0.0);
    if (basal > 0.02) {
      float e = 0.0025;
      vec2 gr = vec2(epiSDF(pn.x + e, p.y, ys) - sdE, epiSDF(pn.x, p.y + e, ys) - sdE);
      vec2 nrm = gr / max(length(gr), 1e-6);
      vec2 tb = vec2(nrm.y, -nrm.x);
      if (tb.x < 0.0) tb = -tb;
      tg = normalize(mix(tg, tb, smoothstep(0.1, 0.7, basal)) + vec2(1e-4, 0.0));
    }
    vec2 tn = vec2(-tg.y, tg.x);
    float CS = 0.0102;
    vec2 g = pn / CS;
    vec2 gi = floor(g); vec2 gf = fract(g);
    float sq = mix(0.45, 1.0, smoothstep(0.006, 0.035, ds));
    float n = 0.0; float d1 = 9.0; float d2 = 9.0; float rad = 1.0; float ves = 0.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 o = vec2(float(i), float(j));
        vec4 h = hash42(gi + o + 311.0);
        vec2 c = o + 0.05 + 0.9 * h.xy;
        vec2 dd = (gf - c) * CS;
        float dl = dot(dd, dd);
        if (dl < d1) { d2 = d1; d1 = dl; } else if (dl < d2) { d2 = dl; }
        float r = (0.0024 + 0.0017 * h.z) * (0.85 + 0.3 * fract(h.w * 13.7)) * mix(0.86, 1.0, max(basal, 1.0 - deep));
        vec2 rr = vec2(r * mix(1.12 / sqrt(sq), 0.68, basal), r * mix(0.9 * sq, 1.55, basal));
        vec2 loc = vec2(dot(dd, tg), dot(dd, tn));
        float cv = ellCov(loc, rr, px) * step(0.07, h.w) * (0.62 + 0.38 * fract(h.w * 7.31));
        if (cv > n) { n = cv; rad = length(loc / rr); ves = step(0.25, h.z) * (1.0 - basal) * (0.6 + 0.4 * deep); }
      }
    }
    memb = (1.0 - smoothstep(0.0, 0.0012, (sqrt(d2) - sqrt(d1)) * 0.5)) * (1.0 - basal) * (1.0 - gran) * det;
    tex = gnoise(pn * 900.0) * det;
    float rim = smoothstep(0.2, 0.9, rad);
    ncol = mix(vec3(0.42, 0.29, 0.60), HE_NUC, max(rim, 1.0 - ves * 0.7)) * (1.0 + 0.16 * tex);
    nuc = mix(meanN, n, det);
    vesF = ves;
  }
  he = cyto * (1.0 + 0.05 * tex) + vec3(0.045, 0.035, 0.035) * memb;
  he = mix(he, clamp(ncol, 0.0, 1.0), nuc * 0.92);
  df = DF_EPI * (0.8 + 0.6 * gran + 0.3 * basal) + vec3(0.22, 0.42, 0.95) * nuc * 0.34 * (1.2 - 0.5 * vesF) + DF_SC * memb * 0.12;
}

/* ---- stratum corneum (above the surface): basket-weave lamellae ---- */
float stratumCorneum(vec2 p, vec2 pn, float ys, float scT, float px, out vec3 he, out vec3 df){
  float t = (ys - p.y) / scT;               // 0 at the granular layer, 1 at the nominal top
  float lift = smoothstep(-0.15, 0.45, gnoise(vec2(pn.x * 14.0, 7.0)));
  float topT = 1.0 + 0.6 * lift;
  float band = clamp(0.5 + (ys - p.y) / px, 0.0, 1.0) * clamp(0.5 + (p.y - (ys - scT * topT)) / px, 0.0, 1.0);
  if (band <= 0.0) { he = HE_BG; df = DF_BG; return 0.0; }
  // independent, wandering keratin lamellae (basket-weave)
  float lam = 0.0;
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float tk = (fk + 0.6) / 4.0 * (1.0 + 0.55 * lift * fk / 3.0)
             + 0.10 * gnoise(vec2(pn.x * 26.0, fk * 5.1)) + 0.05 * gnoise(vec2(pn.x * 70.0, fk * 3.3));
    float hwk = scT * (0.07 + 0.05 * gnoise(vec2(pn.x * 40.0, fk * 9.7) ) + 0.03 * (3.0 - fk));
    float dl = abs(t - tk) * scT;
    float seg = 1.0 - smoothstep(0.05, 0.3, gnoise(vec2(pn.x * 48.0, fk * 13.7))) * step(0.5, fk);
    lam = max(lam, clamp(0.5 - (dl - max(hwk, 0.0005)) / px, 0.0, 1.0) * seg);
  }
  float comp = 1.0 - smoothstep(0.0, 0.22, t);
  float cov = max(lam, comp * 0.92);
  float avg = 0.6 - 0.2 * t;
  cov = mix(cov, avg, smoothstep(0.0014, 0.004, px));
  he = mix(vec3(0.93, 0.78, 0.90), HE_SC, 0.62 + 0.38 * comp);
  df = DF_SC * (0.7 + 0.5 * comp);
  return cov * band;
}

/* ---- dermal vessel: irregular lumen, wall, RBC cluster, nuclei, perivascular halo ---- */
vec4 vessel(vec2 pn, float px, out float endo, out float plasma){
  endo = 0.0; plasma = 0.0;
  vec2 cs = vec2(0.24, 0.17);
  vec2 gc = floor(pn / cs);
  vec4 h = hash42(gc + 500.0);
  if (h.w > 0.40) return vec4(0.0);
  vec2 c = (gc + 0.3 + 0.4 * h.xy) * cs;
  float r = 0.006 + 0.022 * h.z * h.z;
  vec2 dd = pn - c;
  float ext = 2.6 * r + 0.016;
  if (dot(dd, dd) > ext * ext) return vec4(0.0);
  dd = rot2(dd, h.y * 6.2831);
  float asp = 0.45 + 0.55 * h.x;
  vec2 du = dd;
  dd.y /= asp;
  float dist = length(dd);
  dist += r * 0.2 * gnoise(dd / r * 1.2 + h.xy * 50.0);
  float wt = 0.0022 + 0.22 * r;
  float lumen = clamp(0.5 - (dist - r) / px, 0.0, 1.0);
  float wall = max(clamp(0.5 - (dist - r - wt) / px, 0.0, 1.0) - lumen, 0.0);
  float halo = 1.0 - smoothstep(r + wt, 2.3 * r + 0.014, dist);
  float rbc = 0.0;
  if (r > 0.0075) {
    vec2 side = (hash22(gc + 33.0) - 0.5) * r * 0.9;
    for (int k = 0; k < 6; k++) {
      vec2 hk = hash22(gc + vec2(float(k) * 7.3, 91.0));
      vec2 off = (side + (hk - 0.5) * 0.9 * r) * vec2(1.0, asp);
      float dr = length(du - off);
      rbc = max(rbc, discCov(dr, 0.0034, px) * (0.78 + 0.22 * smoothstep(0.0, 0.0028, dr)));
    }
    rbc *= lumen;
  }
  plasma = lumen * (0.25 + 0.45 * h.z);
  for (int k = 0; k < 3; k++) {
    float th = h.x * 6.2831 + float(k) * 2.1;
    vec2 nrm = vec2(cos(th), sin(th));
    vec2 dn = dd - nrm * (r + wt * (k == 2 ? 0.7 : 0.3));
    vec2 ln = vec2(dot(dn, vec2(-nrm.y, nrm.x)), dot(dn, nrm));
    endo = max(endo, ellCov(ln, vec2(0.0048, 0.0014), px));
  }
  return vec4(lumen, wall, rbc, halo);
}

/* ---- papillary capillaries (small, mostly filled with RBCs) ---- */
vec3 capillary(vec2 pn, float px, float papW, out float endo, out float plasma){
  endo = 0.0; plasma = 0.0;
  vec2 cs = vec2(0.05, 0.042);
  vec2 gc = floor(pn / cs);
  vec4 h = hash42(gc + 610.0);
  if (h.w > 0.36 * papW) return vec3(0.0);
  vec2 c = (gc + 0.25 + 0.5 * h.xy) * cs;
  vec2 dd = rot2(pn - c, h.x * 6.2831);
  dd.y /= 0.35 + 0.5 * h.y;
  float r = 0.0022 + 0.0022 * h.z;
  float dist = length(dd) + r * 0.15 * gnoise(dd / r + h.zw * 40.0);
  float lumen = discCov(dist, r, px);
  float wall = max(discCov(dist, r + 0.0028, px) - lumen, 0.0);
  float rbc = (h.x > 0.3) ? lumen * (0.85 + 0.15 * smoothstep(0.0, r, length(dd - (h.zw - 0.5) * r * 0.5))) : 0.0;
  plasma = lumen * 0.5;
  vec2 nrm = vec2(cos(h.z * 6.2831), sin(h.z * 6.2831));
  vec2 dn = dd - nrm * (r + 0.0012);
  endo = ellCov(vec2(dot(dn, vec2(-nrm.y, nrm.x)), dot(dn, nrm)), vec2(0.0036, 0.0016), px);
  return vec3(lumen, wall, rbc);
}

/* ---- fibroblast nuclei aligned with the bundles (two jittered grids) ---- */
float fibroNuc(vec2 a, float px, float papW, float gI, float boost, float clus){
  float nuc = 0.0;
  float stream = smoothstep(-0.15, 0.35, gnoise(a * vec2(5.0, 12.0) + 333.0));
  for (int g = 0; g < 3; g++) {
    vec2 cs = (g < 2) ? vec2(0.042, 0.019) : vec2(0.021, 0.013);
    vec2 off = float(g) * vec2(0.5, 0.37);
    vec2 gc = floor(a / cs + off);
    vec4 h = hash42(gc + 300.0 + float(g) * 57.0);
    float prob = (g < 2) ? (mix(0.02, 0.5, papW) + 0.22 * gI * papW) * (0.35 + 1.1 * stream) + boost + 0.45 * clus
                         : clus * (0.55 + 0.35 * gI);
    if (h.w < prob) {
      vec2 c = (gc - off + vec2(0.22 + 0.56 * h.x, 0.28 + 0.44 * h.y)) * cs;
      vec2 dd = rot2(a - c, -((h.z - 0.5) * 0.6 + max(papW, clus) * (h.x - 0.5) * 2.4));
      dd.y += (h.x - 0.5) * 30.0 * dd.x * dd.x;
      vec2 rr = mix(vec2(0.0044 + 0.0026 * h.z, 0.0014 + 0.0006 * h.x), vec2(0.0032 + 0.0012 * h.z, 0.0021 + 0.0006 * h.y), max(papW, clus));
      if (g == 2) rr *= 0.9;
      rr.y *= 1.0 + 0.45 * gI;
      nuc = max(nuc, ellCov(dd, rr, px) * (0.75 + 0.25 * h.y));
    }
  }
  return nuc;
}

/* ---- collagen bundle pieces: warped anisotropic Voronoi.
   Clefts sit on (non-merged) piece borders; fibroblast nuclei sit in the clefts. ---- */
float bundles(vec2 a, float px, float gI, float envC, float papW, float z,
              out float tone, out float fang, out float nucE, out float rimD, out vec2 aro){
  // level 1: fascicles — irregular regions whose bundles share an orientation
  vec2 L1 = vec2(0.17, 0.095);
  vec2 s1 = a / L1;
  vec2 m1 = floor(s1); vec2 g1 = fract(s1);
  float e1 = 9.0; float e2 = 9.0; vec2 q1 = vec2(0.0); vec2 q2 = vec2(1.0); vec2 fid = vec2(0.0); vec2 fid2 = vec2(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 r = g + 0.1 + 0.8 * hash22(m1 + g + 4321.0) - g1;
      float dd = dot(r, r);
      if (dd < e1) { e2 = e1; q2 = q1; fid2 = fid; e1 = dd; q1 = r; fid = m1 + g; }
      else if (dd < e2) { e2 = dd; q2 = r; fid2 = m1 + g; }
    }
  }
  vec2 dq = q2 - q1;
  vec2 nq = dq / max(length(dq), 1e-5);
  float bdF = dot(0.5 * (q1 + q2), nq) / length(nq / L1);
  vec4 fh = hash42(fid + 999.0);
  float thAmp = mix(1.05, 0.4, smoothstep(0.12, 0.6, z)) * (1.0 - 0.35 * gI);
  float th = (fh.x - 0.5) * 2.0 * thAmp;
  vec2 cW = (s1 + q1) * L1;
  vec2 ar = rot2(a - cW, -th) + cW + fh.yz * 3.0;
  aro = ar;
  // level 2: bundle pieces inside the fascicle frame
  float SX = mix(2.4, 4.2, fh.w);
  float CELL = 0.019 * mix(0.8, 1.35, fract(fh.z * 7.13));
  vec2 s = vec2(ar.x / SX, ar.y) / CELL;
  vec2 n = floor(s); vec2 f = fract(s);
  vec2 pts[9]; vec2 ids[9];
  float d1 = 1e9; vec2 r1 = vec2(0.0); vec2 id1 = vec2(0.0);
  for (int k = 0; k < 9; k++) {
    vec2 g = vec2(float(k - (k / 3) * 3) - 1.0, float(k / 3) - 1.0);
    vec2 id = n + g;
    vec2 r = g + 0.06 + 0.88 * hash22(id + 1234.0) - f;
    pts[k] = r; ids[k] = id;
    float d = dot(r, r);
    if (d < d1) { d1 = d; r1 = r; id1 = id; }
  }
  float pMerge = clamp(0.14 + 0.52 * gI + 0.35 * envC + 0.1 * papW, 0.0, 0.92);
  float wK = (1.3 - 0.72 * gI) * (1.0 - 0.45 * envC);
  float nProb = mix(0.16, 0.30, papW) + 0.16 * gI;
  float cleft = 0.0; float nuc = 0.0; float rim = 1e3;
  float kk = 0.0016; float S = 0.0; float hwC = 0.0; float dC = 1e3;
  for (int k = 0; k < 9; k++) {
    vec2 r = pts[k];
    vec2 dr = r - r1;
    float L2 = dot(dr, dr);
    vec2 nn = dr * inversesqrt(max(L2, 1e-12));
    float dw = dot(0.5 * (r1 + r), nn) * CELL / length(vec2(nn.x / SX, nn.y));
    if (L2 > 1e-6 && dw < 0.016 + px) {
      vec2 id = ids[k];
      float ph = hash12(id1 + id + (id1 * id) * 0.0131 + 77.0);
      float ph2 = fract(ph * 97.13);
      float ph3 = fract(ph * 31.71);
      float hwE = (0.0008 + 0.0065 * ph2 * ph2 * ph2 + 0.0016 * ph2) * wK;
      float tpos = abs(dot(0.5 * (r1 + r), vec2(-nn.y, nn.x)));
      hwE *= mix(1.0, smoothstep(0.62, 0.12, tpos), 0.35 + 0.6 * gI);
      if (ph > pMerge) {
        float e = dw - hwE;
        S += exp(-max(e, -0.004) / kk);
        if (e < dC) { dC = e; hwC = hwE; }
      }
      if (ph3 < nProb && dw < 0.012) {
        vec2 tv = vec2(-nn.y, nn.x);
        vec2 cr = 0.5 * (r1 + r) + tv * (fract(ph * 7.77) - 0.5) * 0.7;
        vec2 dW = vec2(cr.x * SX, cr.y) * CELL;
        vec2 tW = normalize(vec2(tv.x * SX, tv.y));
        vec2 loc = vec2(dot(-dW, tW), dot(-dW, vec2(-tW.y, tW.x)));
        loc.y += (ph2 - 0.5) * 40.0 * loc.x * loc.x;
        vec2 rr = vec2(0.0042 + 0.0032 * fract(ph * 5.3), 0.0013 + 0.0007 * fract(ph * 3.1)) * vec2(1.0, 1.0 + 0.45 * gI);
        nuc = max(nuc, ellCov(loc, rr, px) * (0.75 + 0.25 * fract(ph * 13.1)));
      }
    }
  }
  // fascicle border cleft
  float pf = hash12(fid + fid2 + (fid * fid2) * 0.0173 + 11.0);
  if (pf > pMerge * 0.7) {
    float hwF = (0.0012 + 0.003 * fract(pf * 41.3)) * wK;
    float e = bdF - hwF;
    S += exp(-max(e, -0.004) / kk);
    if (e < dC) { dC = e; hwC = hwF; }
  }
  float eff = (S > 0.0) ? -kk * log(S) : 1e3;
  if (px < 0.003) eff += 0.0011 * gnoise(a * vec2(60.0, 520.0) + 41.0) * (1.0 - smoothstep(0.0015, 0.003, px));
  cleft = clamp(0.5 - eff / px, 0.0, 1.0) * min(1.0, 2.0 * max(hwC, 0.0002) / px);
  rim = eff;
  tone = clamp((hash12(id1 + 55.0) * 2.0 - 1.0) * 0.8 + (fh.w - 0.5) * 0.9, -1.0, 1.0);
  fang = (hash12(id1 + 66.0) - 0.5) * 0.5;
  nucE = nuc;
  rimD = rim;
  return cleft;
}

/* ---- dermis ---- */
void dermisShade(vec2 p, vec2 pn, float ys, float yd, float sdE, float px, vec4 st,
                 out vec3 he, out vec3 df, out float cond, out float wI, out float wIII){
  float gI = st.x; float gIII = st.y; float contr = st.z;
  float d = p.y - ys;
  float z = d / max(yd - ys, 0.3);
  float papW = 1.0 - smoothstep(0.025, 0.09, sdE);
  float lat = lateralEnv(p.x, d);
  float envC = contr * lat * (0.6 + 0.4 * smoothstep(0.1, 0.6, z)) * (1.0 - smoothstep(1.0, 1.3, z)) * (1.0 - 0.35 * papW);

  // bundle space: contraction pulls toward the tip axis; warp = waviness / interweave
  vec2 q = pn;
  float org = clamp(0.35 * gI, 0.0, 0.85);
  // curl warps (one noise+derivative call each): large interweave, bundle waviness, fine kinks
  vec2 wA = vec2(gnoise(q * vec2(4.0, 6.0)), gnoise(q * vec2(4.0, 6.0) + vec2(19.1, 7.3)));
  vec3 nB = gnoised(q * vec2(13.0, 16.0) + 3.7);
  vec2 wB = vec2(nB.z, -nB.y) * 0.32;
  vec2 a = q + (wA * 0.075 + wB * 0.024) * (1.0 - org);
  if (px < 0.003) { vec3 nC = gnoised(q * vec2(34.0, 40.0) + 5.3); a += vec2(nC.z, -nC.y) * 0.32 * 0.0075 * (1.0 - org) * (1.0 - smoothstep(0.002, 0.003, px)); }

  float tone; float fang; float nucE; float rimD; vec2 ar;
  float cleft = bundles(a, px, gI, envC, papW, z, tone, fang, nucE, rimD, ar);
  float toneA = (1.0 - smoothstep(0.004, 0.012, px)) * (1.0 - 0.55 * gI - 0.4 * envC);
  float streak = gnoise(a * vec2(1.8, 9.0) + 90.0);
  vec2 af = rot2(ar, fang);
  float fib = 0.0;
  if (px < 0.0035) {
    fib = gnoise(af * vec2(16.0, 260.0) + 5.0) * 0.7;
    if (px < 0.0015) fib += gnoise(af * vec2(45.0, 520.0) + 8.0) * 0.4 * (1.0 - smoothstep(0.0008, 0.0015, px));
    fib *= 1.0 - smoothstep(0.0012, 0.0035, px);
  }
  float crimp = 0.0;
  if (px < 0.0014) crimp = gnoise(af * vec2(160.0, 90.0) + 3.0) * (1.0 - smoothstep(0.0008, 0.0014, px));
  // eosinophilic fibrils: thin darker threads running along the bundle (visible at ×100+)
  float fibril = 0.0;
  if (px < 0.0022) fibril = (1.0 - smoothstep(0.0, 0.16, abs(gnoise(af * vec2(7.0, 150.0) + 21.0)))) * (1.0 - smoothstep(0.0011, 0.0022, px));
  float rim = (1.0 - smoothstep(0.0, 0.004, rimD)) * (1.0 - cleft);
  float homo = 1.0 - 0.18 * gI - 0.35 * envC;
  float lowMag = smoothstep(0.0015, 0.004, px);
  float fstreak = 0.0;
  if (px > 0.0015) fstreak = gnoise(a * vec2(2.6, 42.0) + 140.0) * lowMag;
  float dens = 0.44 + 0.16 * streak + 0.22 * tone * toneA + (fib * 0.8 + crimp * 0.18 * (1.0 - envC)) * homo + 0.45 * fstreak + 0.26 * gI + 0.20 * envC;
  dens += 0.38 * fibril * (1.0 - 0.4 * envC);
  dens = clamp(dens, 0.0, 1.15);
  // ×2: bundles and clefts average out into the pale, finely fibrous look of the overview photos
  float lm = gLod;
  cleft *= 1.0 - 0.6 * lm;
  dens = mix(dens, 0.32 + 0.35 * fstreak + 0.12 * gI, lm * 0.7);
  vec3 bundle = mix(HE_B_PALE, HE_B_DENSE, dens);
  bundle *= 1.0 - 0.11 * rim;
  bundle = mix(bundle, HE_B_HOT, 0.32 * envC);

  // papillary: loose, open matrix
  float pOpen = max(cleft, 0.42 - 0.2 * gIII);
  vec3 pap = mix(mix(HE_B_PALE, HE_B_DENSE, 0.25 + 0.2 * gIII + 0.25 * fib), HE_PAP, pOpen);

  // fine Type III fibres: short wispy segments in two orientations
  float fineMean = 0.12 * (1.0 + 0.4 * gIII);
  float fine = fineMean;
  if (px < 0.0017) {
    float G = 0.8;
    vec2 b = pn + wB * 0.012 + wA * 0.02;
    float fq = 140.0;
    float fa = gnoise(b * vec2(35.0, fq) + 120.0);
    float fb = gnoise(rot2(b, 1.0) * vec2(35.0, fq) + 150.0);
    float fw = 0.0005 * (1.0 + 0.4 * gIII);
    float gA = smoothstep(-0.1, 0.25, gnoise(b * 30.0 + 170.0));
    float gB = smoothstep(-0.1, 0.25, gnoise(b * 30.0 + 190.0));
    fine = max(lineCov(abs(fa), fw * G * fq, px * G * fq) * gA, lineCov(abs(fb), fw * G * fq, px * G * fq) * gB);
    fine = mix(fine, fineMean, smoothstep(0.0011, 0.0017, px));
  }
  float fineAmt = mix(0.55 * cleft, 0.8, papW) * (0.6 + 0.4 * gIII);

  vec3 ret = mix(bundle, HE_CLEFT, cleft);
  he = mix(ret, pap, papW);
  wIII = fine * fineAmt;
  he = mix(he, HE_FINE, wIII * 0.7);
  float fibM = clamp(0.55 + 1.1 * fib + 0.3 * tone * toneA + 0.9 * fstreak + 0.25 * crimp + 0.15 * streak, 0.05, 1.4);
  wI = (1.0 - mix(cleft, pOpen, papW)) * (0.3 + 0.7 * fibM * fibM) * (0.75 + 0.25 * clamp(dens, 0.0, 1.0));
  cond = mix(0.86, 0.80, cleft);

  // fluorescence brightness tracks the brochure ratio curve (Type I ×1.61, Type III ×1.49 at 12 w)
  float kI = 0.40 * (1.0 + 0.62 * gI) * (1.0 + 0.5 * envC);
  float kIII = 0.75 * (1.0 + 0.49 * gIII);
  df = DF_BG + DF_I * wI * kI * (1.0 - 0.55 * papW) + DF_III * wIII * kIII;
  df += vec3(0.95, 0.85, 1.0) * envC * wI * 0.12;

  // vessels + perivascular cellularity
  float clus = smoothstep(0.12, 0.42, gnoise(q * vec2(13.0, 15.0) + 444.0)) * (1.0 - smoothstep(0.14, 0.34, d)) * smoothstep(0.0, 0.03, sdE);
  // cellular cords of the dermal vascular plexus (more active along the regeneration timeline)
  float cordN = gnoise(q * vec2(3.5, 22.0) + 520.0);
  float cordG = smoothstep(0.26 - 0.16 * gI, 0.48 - 0.16 * gI, gnoise(q * vec2(2.2, 4.5) + 540.0));
  float cord = (1.0 - smoothstep(0.1, 0.2, abs(cordN))) * cordG * smoothstep(0.12, 0.3, d);
  clus = max(max(clus, cord), papW * 0.45);
  float endo; float plasma;
  vec4 v = vessel(pn, px, endo, plasma);
  float cendo; float cplasma;
  vec3 cap = capillary(pn, px, max(papW, clus), cendo, cplasma);
  float halo = v.w;
  he = mix(he, HE_PAP, halo * 0.4 * (1.0 - papW));
  he = mix(he, vec3(0.87, 0.76, 0.89), cord * 0.35);
  he = mix(he, vec3(0.60, 0.50, 0.78), cord * (0.14 + 0.1 * gI) * lm * (0.6 + 0.4 * smoothstep(-0.2, 0.4, gnoise(pn * 90.0 + 13.0))));
  wI *= 1.0 - 0.4 * cord;
  wI *= 1.0 - 0.5 * halo;
  float nuc = fibroNuc(a, px, papW, gI, 0.3 * halo + 0.06 * gIII, clus);
  nuc = max(nuc, nucE * (1.0 - 0.6 * papW));
  nuc = max(nuc, max(endo, cendo));
  float wall = max(v.y, cap.y);
  float lumen = max(v.x, cap.x);
  float rbc = max(v.z, cap.z);
  he = mix(he, HE_WALL, wall);
  he = mix(he, mix(HE_LUMEN, HE_PLASMA, max(plasma, cplasma)), lumen);
  he = mix(he, HE_RBC, rbc);
  he = mix(he, HE_NUC * 1.12, nuc * 0.9);
  float occl = max(lumen, wall);
  wI *= 1.0 - occl; wIII *= 1.0 - occl;
  df = mix(df, DF_BG + DF_WALL * 0.55, wall);
  df = mix(df, DF_BG, lumen * (1.0 - rbc));
  df = mix(df, DF_RBC * 0.8, rbc);
  df = mix(df, DF_NUC * 0.72, nuc * 0.9);
  cond = mix(cond, 1.0, max(lumen, wall));
}

/* ---- subcutis: adipocytes + fibrous septa ---- */
void fatShade(vec2 p, vec2 pn, float px, float gI, out vec3 he, out vec3 df, out float cond, out float wI){
  float CS = 0.085;
  vec2 x = pn / CS;
  vec2 n = floor(x); vec2 f = fract(x);
  float F1 = 8.0; float F2 = 8.0;
  vec2 r1 = vec2(0.0); vec2 r2 = vec2(1.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = 0.12 + 0.76 * hash22(n + g + 700.0);
      vec2 r = g + o - f;
      float dd = dot(r, r);
      if (dd < F1) { F2 = F1; r2 = r1; F1 = dd; r1 = r; }
      else if (dd < F2) { F2 = dd; r2 = r; }
    }
  }
  vec2 dr = r2 - r1;
  float bd = abs(dot(0.5 * (r1 + r2), dr / max(length(dr), 1e-5))) * CS;
  float wob = gnoise(pn * 420.0) * 0.0006;
  float bw = 0.0009;
  float bor = clamp(0.5 - (bd + wob - bw) / px, 0.0, 1.0) * min(1.0, 2.0 * bw / px);
  float ns = gnoise(pn * vec2(1.6, 2.6) + 700.0) + 0.1 * gnoise(pn * vec2(9.0, 12.0) + 730.0);
  float sep = lineCov(abs(ns), 0.0034 * 2.0, px * 2.0);
  float sep2 = lineCov(abs(gnoise(pn * vec2(4.0, 6.0) + 760.0)), 0.0014 * 4.8, px * 4.8) * smoothstep(0.0, 0.3, gnoise(pn * 3.0 + 777.0)) * 0.8;
  sep = max(sep, sep2);
  float fib = gnoise(pn * vec2(40.0, 170.0) + 780.0) * (1.0 - smoothstep(0.001, 0.003, px));
  he = mix(HE_FAT, HE_FATB, bor);
  he = mix(he, mix(HE_B_PALE, HE_B_DENSE, 0.55 + 0.3 * fib), sep);
  df = DF_BG + DF_WALL * bor * 0.35 + DF_I * sep * 0.52 * (1.0 + 0.62 * gI) * (1.0 + 0.6 * fib);
  cond = mix(mix(0.10, 0.34, bor), 1.0, sep);
  wI = sep;
}

/* ---- hair follicle cross-section ---- */
float follicle(vec2 p, vec2 pn, float px, out vec3 fhe, out vec3 fdf){
  fhe = HE_BG; fdf = DF_BG;
  float FW = 1.3;
  float c = floor(pn.x / FW);
  vec4 h = hash41(c + 71.0);
  if (h.w > 0.75) return 0.0;
  float cx = (c + 0.3 + 0.4 * h.x) * FW;
  float cy = surfaceY(cx) + 0.30 + 0.42 * h.y;
  float R = 0.075 + 0.045 * h.z;
  vec2 dd = vec2(pn.x - cx, p.y - cy);
  dd.y /= 0.8 + 0.35 * h.x;
  float r = length(dd);
  if (r > 1.15 * R + px) return 0.0;
  float rn = (r + R * 0.06 * gnoise(dd / R * 3.0 + h.xy * 20.0) + R * 0.02 * gnoise(dd / R * 9.0)) / R;
  float e = 0.5 * max(px, 0.0012) / R;
  float nz = gnoise(dd / R * 2.5 + h.zw * 30.0);
  float s0 = smoothstep(0.22 - e, 0.22 + e, rn + 0.05 * nz);
  float s1 = smoothstep(0.30 - e, 0.30 + e, rn - 0.04 * nz);
  float s2 = smoothstep(0.45 - e, 0.45 + e, rn + 0.06 * nz);
  float s3 = smoothstep(0.82 - e, 0.82 + e, rn - 0.05 * nz);
  float s4 = smoothstep(0.87 + 0.04 * h.x - e, 0.87 + 0.04 * h.x + e, rn + 0.04 * nz);
  float s5 = smoothstep(1.06 - e, 1.06 + e, rn);
  float nuc = 0.35;
  if (px < 0.004) {
    vec2 g = pn / 0.009;
    vec4 hn = hash42(floor(g) + 911.0);
    nuc = mix(discCov(length((fract(g) - 0.25 - 0.5 * hn.xy) * 0.009), 0.0028, px) * step(0.25, hn.w), 0.35, smoothstep(0.0025, 0.004, px));
  }
  vec3 ors = mix(HE_ORS, HE_NUC, nuc * 0.85);
  fhe = mix(HE_SHAFT, HE_LUMEN, step(0.45, h.y));
  fhe = mix(fhe, HE_LUMEN, s0);
  fhe = mix(fhe, HE_IRS, s1);
  fhe = mix(fhe, ors, s2);
  fhe = mix(fhe, HE_LUMEN, s3 * 0.45);
  fhe = mix(fhe, mix(HE_B_PALE, HE_B_DENSE, 0.45), s4);
  fdf = vec3(0.22, 0.14, 0.10);
  fdf = mix(fdf, DF_BG, s0);
  fdf = mix(fdf, DF_SC * 1.2, s1);
  fdf = mix(fdf, DF_EPI * 1.4 + DF_NUC * nuc * 0.5, s2);
  fdf = mix(fdf, DF_BG, s3);
  fdf = mix(fdf, DF_BG + DF_I * 0.7, s4);
  return 1.0 - s5;
}

/* ---- sweat-gland coil cluster in the deep dermis ---- */
float glands(vec2 p, vec2 pn, float px, out vec3 ghe, out vec3 gdf){
  ghe = HE_BG; gdf = DF_BG;
  float GW = 0.8;
  float c = floor(pn.x / GW);
  vec4 h = hash41(c + 131.0);
  if (h.w > 0.6) return 0.0;
  vec2 cc = vec2((c + 0.25 + 0.5 * h.x) * GW, surfaceY((c + 0.5) * GW) + 1.05 + 0.6 * h.y);
  vec2 dd = vec2(pn.x - cc.x, p.y - cc.y);
  if (dot(dd, dd) > 0.01) return 0.0;
  float ring = 0.0; float lum = 0.0;
  for (int k = 0; k < 7; k++) {
    vec2 hk = hash22(vec2(c * 3.1 + float(k) * 1.7, 17.0));
    vec2 tc = (hk - 0.5) * vec2(0.12, 0.07);
    float tr = 0.008 + 0.006 * hash11(c * 7.0 + float(k));
    float dt = length(dd - tc);
    ring = max(ring, discCov(dt, tr, px));
    lum = max(lum, discCov(dt, tr * 0.38, px));
  }
  float sp = (px < 0.004) ? mix(smoothstep(0.1, 0.3, gnoise(pn * 520.0)), 0.3, smoothstep(0.0025, 0.004, px)) : 0.3;
  ghe = mix(mix(HE_GLAND, HE_NUC, sp * 0.7), HE_LUMEN, lum);
  gdf = mix(DF_WALL * 0.8 + DF_NUC * sp * 0.35, DF_BG, lum);
  return ring * 0.92;
}

vec4 finalize(vec3 he, vec3 df, float cond, float wI, float wIII, vec2 pn, float tissue){
  // stain unevenness (section thickness / staining gradients)
  if (tissue > 0.0) {
    float sv = 1.0 + (0.07 * gnoise(pn * 1.1 + 17.0) + 0.04 * gnoise(pn * 6.0 + 27.0)) * tissue;
    he = 1.0 - (1.0 - he) * sv;
  }
  float hI = uHL.x; float hIII = uHL.y; float hAny = max(hI, hIII);
  float lum = dot(he, vec3(0.299, 0.587, 0.114));
  vec3 faded = mix(mix(vec3(lum), he, 0.45), HE_BG, 0.6);
  vec3 h2 = mix(he, faded, hAny * 0.9 * tissue);
  h2 = mix(h2, mix(he, vec3(0.560, 0.330, 0.900), 0.6), hI * clamp(wI * 1.2, 0.0, 1.0));
  h2 = mix(h2, vec3(0.130, 0.640, 0.450), hIII * clamp(wIII * 1.3, 0.0, 0.9));
  vec3 d2 = DF_BG + (df - DF_BG) * (1.0 - 0.75 * hAny);
  d2 += DF_I * wI * 0.62 * hI + DF_III * wIII * 1.0 * hIII;
  // low-magnification condenser paleness (the ×2 photos are much paler than ×200)
  h2 = mix(h2, HE_BG, 0.48 * smoothstep(0.6, 2.9, uView.y) * tissue * mix(0.5, 1.0, smoothstep(0.55, 0.78, lum)));
  // the empty slide background cross-fades uniformly; only the tissue "develops"
  float sm = mix(smoothstep(0.3, 0.7, uStain), gStainM, smoothstep(0.0, 0.1, cond));
  return vec4(mix(d2, h2, sm), cond);
}

vec4 shade(vec2 p0, float px, vec4 st){
  // immediate thermal contraction (原理示意): the heated dermis pulls in laterally toward the
  // tip axis — a smooth deformation, so every bundle keeps its identity while it tightens
  vec2 p = p0;
  if (st.z > 0.0) {
    float d0 = p0.y - surfaceY(p0.x + uSeed.x);
    float z0 = d0 / ${DERMIS_T.toFixed(3)};
    float k = st.z * lateralEnv(p0.x, d0) * (0.55 + 0.45 * smoothstep(0.05, 0.5, z0))
            * smoothstep(-0.02, 0.08, d0) * (1.0 - smoothstep(1.1, 1.6, z0));
    p.x = p0.x * (1.0 + 0.12 * k);
    p.y = p0.y - 0.035 * k * d0;
  }
  vec2 pn = p + uSeed;
  float xs = pn.x;
  float ys = surfaceY(xs);
  float scT = 0.015 + 0.005 * vnoise1(xs * 23.0 + 5.0);
  vec3 he = HE_BG; vec3 df = DF_BG; float cond = 0.0; float wI = 0.0; float wIII = 0.0;
  float tissue = 0.0;
  if (p.y > ys - scT * 1.6 - 2.0 * px) {
    vec3 sHe; vec3 sDf;
    float sA = stratumCorneum(p, pn, ys, scT, px, sHe, sDf);
    he = mix(he, sHe, sA); df = mix(df, sDf, sA); cond = 0.2 * sA; tissue = sA;
    float below = clamp(0.5 + (p.y - ys) / px, 0.0, 1.0);
    if (below > 0.0) {
      vec3 tHe = HE_BG; vec3 tDf = DF_BG; float tC = 0.8; float tI = 0.0; float tIII = 0.0;
      float yd = surfaceBase(xs) + 0.05 + dermisThickness(xs, st.w);   // the fat boundary does not follow surface furrows
      float dz = p.y - ys;
      float sdE = (dz < 0.30) ? epiSDF(xs, p.y, ys) : dz - 0.2;
      if (sdE > -1.5 * px) {
        float fatTop = yd + 0.05 * gnoise(pn * vec2(3.0, 5.0) + 900.0) + 0.018 * gnoise(pn * vec2(10.0, 14.0) + 950.0);
        float fatCov = clamp(0.5 + (p.y - fatTop) / px, 0.0, 1.0);
        if (fatCov < 1.0) dermisShade(p, pn, ys, yd, sdE, px, st, tHe, tDf, tC, tI, tIII);
        if (fatCov > 0.0) {
          vec3 fHe; vec3 fDf; float fC; float fI;
          fatShade(p, pn, px, st.x, fHe, fDf, fC, fI);
          tHe = mix(tHe, fHe, fatCov); tDf = mix(tDf, fDf, fatCov); tC = mix(tC, fC, fatCov);
          tI = mix(tI, fI, fatCov); tIII *= 1.0 - fatCov;
        }
        if (dz > 0.15 && dz < 1.3) {
          vec3 oHe; vec3 oDf;
          float oa = follicle(p, pn, px, oHe, oDf);
          if (oa > 0.0) { tHe = mix(tHe, oHe, oa); tDf = mix(tDf, oDf, oa); tC = mix(tC, 0.75, oa); tI *= 1.0 - oa; tIII *= 1.0 - oa; }
        }
        if (dz > 0.8 && dz < 2.1) {
          vec3 gHe; vec3 gDf;
          float ga = glands(p, pn, px, gHe, gDf);
          if (ga > 0.0) { tHe = mix(tHe, gHe, ga); tDf = mix(tDf, gDf, ga); tC = mix(tC, 0.8, ga); tI *= 1.0 - ga; tIII *= 1.0 - ga; }
        }
      }
      float eCov = clamp(0.5 - sdE / (px * (1.0 + 1.2 * gLod)), 0.0, 1.0);
      if (eCov > 0.0) {
        vec3 eHe; vec3 eDf;
        epidermisShade(p, pn, ys, sdE, px, eHe, eDf);
        tHe = mix(tHe, eHe, eCov); tDf = mix(tDf, eDf, eCov); tC = mix(tC, 0.78, eCov);
        tI *= 1.0 - eCov; tIII *= 1.0 - eCov;
      }
      he = mix(he, tHe, below); df = mix(df, tDf, below); cond = mix(cond, tC, below);
      wI = tI * below; wIII = tIII * below; tissue = max(tissue, below);
    }
  }
  return finalize(he, df, cond, wI, wIII, pn, tissue);
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = uCenter + vec2(uv.x - 0.5, 0.5 - uv.y) * uView;
  // pixel footprint, floored by the optical resolution (soft micrograph edges)
  float px = max(max(uView.x / uRes.x, uView.y / uRes.y), 0.00055);
  vec4 st = (uSplit >= 0.0 && uv.x < uSplit) ? uSideB : uSideA;
  gStainM = stainMask(p, uView.y);
  gLod = smoothstep(0.0022, 0.0055, px);
  gl_FragColor = shade(p, px, st);
}
`;

  /* ---------------------------------------------------- optics pass (B) */
  var FRAG_COMPOSITE = COMMON + `
uniform sampler2D uTex;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform vec2 uView;
uniform float uSplit;
uniform vec4 uFxA;     // heat, cool, current, grow (main)
uniform vec4 uFxB;     // heat, cool, current, grow (before)
uniform float uTime;
uniform float uUi;     // device px per css px
uniform float uMag;
uniform vec4 uLook;    // vignette, grain, chroma, dof
uniform vec4 uBar;     // x0, y0, length, thickness (device px, origin bottom-left)
uniform vec2 uGlyph[8];
uniform vec3 uText;    // glyph count, glyph pixel size, scale bar on
uniform vec4 uFlags;   // split handle, isotherms, mipmaps, -
uniform vec4 uTexRect; // uv scale (x, y) and max uv (z, w) of the tissue sub-rect

vec2 tuv(vec2 u){ return min(clamp(u, 0.0, 1.0) * uTexRect.xy, uTexRect.zw); }

const vec3 H0 = vec3(0.043, 0.063, 0.188);
const vec3 H1 = vec3(0.165, 0.082, 0.282);
const vec3 H2 = vec3(0.416, 0.165, 0.549);
const vec3 H3 = vec3(0.722, 0.188, 0.478);
const vec3 H4 = vec3(0.941, 0.376, 0.247);
const vec3 H5 = vec3(1.000, 0.769, 0.369);
const vec3 H6 = vec3(1.000, 0.957, 0.839);
const vec3 COOL   = vec3(0.498, 0.831, 1.000);
const vec3 VIOLET = vec3(0.541, 0.361, 0.941);
const vec3 VIODK  = vec3(0.415, 0.247, 0.816);
const vec3 MINT   = vec3(0.263, 0.902, 0.659);
const vec3 JADE   = vec3(0.110, 0.600, 0.430);
const vec3 DFBG   = vec3(0.027, 0.027, 0.047);

vec3 heatLUT(float t){
  t = clamp(t, 0.0, 1.0) * 6.0;
  if (t < 1.0) return mix(H0, H1, t);
  if (t < 2.0) return mix(H1, H2, t - 1.0);
  if (t < 3.0) return mix(H2, H3, t - 2.0);
  if (t < 4.0) return mix(H3, H4, t - 3.0);
  if (t < 5.0) return mix(H4, H5, t - 4.0);
  return mix(H5, H6, t - 5.0);
}
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

float coolProfile(float depth, float x, float cool){
  float dc = 0.035 + 0.30 * cool;
  float lat = 1.0 - smoothstep(ELEC_A - 0.05, ELEC_A + 0.3, abs(x));
  return cool * lat * (1.0 - smoothstep(dc * 0.72, dc * 1.2, depth)) * step(-0.03, depth);
}
// smooth (structure-free) temperature field, used for isotherms
float smoothT(vec2 p, vec4 fx){
  float xs = p.x + uSeed.x;
  float ys = surfaceY(xs);
  float yd = surfaceBase(xs) + 0.05 + dermisThickness(xs, fx.w);
  return fx.x * thermalEnv(p, ys, yd) * (1.0 - 0.92 * coolProfile(p.y - ys, p.x, fx.y));
}
float glyphBit(vec2 g, float row, float col){
  float v = row < 4.0 ? g.x : g.y;
  float sh = row < 4.0 ? (3.0 - row) * 5.0 + (4.0 - col) : (6.0 - row) * 5.0 + (4.0 - col);
  return mod(floor(v / exp2(sh)), 2.0);
}

void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / uRes;
  vec2 p = uCenter + vec2(uv.x - 0.5, 0.5 - uv.y) * uView;
  float px = uView.y / uRes.y;
  float ui = uUi;
  bool leftSide = (uSplit >= 0.0) && (uv.x < uSplit);
  vec4 fx = leftSide ? uFxB : uFxA;
  vec2 pn = p + uSeed;
  float ys = surfaceY(pn.x);
  float yd = surfaceBase(pn.x) + 0.05 + dermisThickness(pn.x, fx.w);
  float depth = p.y - ys;

  /* microscope optics */
  vec2 cc = uv - 0.5;
  float asp = uRes.x / uRes.y;
  float rv = length(cc * vec2(asp, 1.0)) / length(vec2(0.5 * asp, 0.5));
  float bias = 0.0;
  if (uFlags.z > 0.5) {
    float fn = gnoise(pn * 4.5 + 300.0);
    bias = uLook.w * (uMag * uMag * 1.5 * smoothstep(0.05, 0.45, fn) + 0.9 * rv * rv);
  }
  vec2 caUv = cc * vec2(asp, 1.0) * (2.2 * ui * uLook.z) / uRes;
  vec4 tg = texture2D(uTex, tuv(uv), bias);
  float tr = texture2D(uTex, tuv(uv + caUv), bias).r;
  float tb = texture2D(uTex, tuv(uv - caUv), bias).b;
  vec3 col = vec3(tr, tg.g, tb);
  float cond = tg.a;
  if (px < 0.0012) {
    float mt = gnoise(pn * 1700.0) * 0.6 + gnoise(pn * 3100.0 + 7.0) * 0.4;
    float amp = (1.0 - smoothstep(0.0004, 0.0012, px)) * smoothstep(0.05, 0.3, cond);
    col *= 1.0 + mt * amp * (0.05 + 0.14 * (1.0 - dot(col, vec3(0.299, 0.587, 0.114))));
  }
  vec3 bf = col;
  vec3 dk = col;
  if (uStain < 0.999 && uFlags.z > 0.5) {
    vec3 bl = texture2D(uTex, tuv(uv), 2.5).rgb * 0.55 + texture2D(uTex, tuv(uv), 4.5).rgb * 0.45;
    dk += max(bl - DFBG, 0.0) * 0.55;
  }

  float heat = fx.x; float cool = fx.y; float cur = fx.z;
  float coolP = coolProfile(depth, p.x, cool);

  /* RF heat */
  if (heat > 0.001) {
    float env = thermalEnv(p, ys, yd);
    float cc = min(cond, 0.92);
    float cw = 1.6 * cc * cc * cc;
    float shimmer = 1.0 + 0.10 * gnoise(pn * vec2(7.0, 10.0) / max(uView.y, 0.4) * 3.45 + vec2(0.0, -uTime * 0.6))
                        + 0.04 * sin(uTime * 2.3 + p.x * 3.0 / uView.y);
    float T = clamp(heat * env * cw * (1.0 - 0.92 * coolP) * shimmer, 0.0, 1.0);
    vec3 hc = heatLUT(T);
    vec3 LW = vec3(0.299, 0.587, 0.114);
    float lum = dot(col, LW);
    // bright-field: translucent thermal map (brand scale from violet up) keeping the stain's structure
    vec3 hb = heatLUT(0.3 + 0.7 * T);
    float a = smoothstep(0.06, 0.55, T) * 0.84;
    float sL = clamp((lum - 0.5) * 2.1, 0.0, 1.0);   // stain structure survives under the thermal map
    bf = mix(bf, hb * (0.36 + 0.78 * sL), a);
    bf += hb * hb * 0.10 * smoothstep(0.45, 0.95, T);  // faint glow at the hottest core
    // dark-field: emissive heat whose brightness follows the fluorescent fibres
    float fibL = clamp(lum * 2.4, 0.0, 1.0);
    float ad = smoothstep(0.05, 0.5, T);
    dk = dk * (1.0 - 0.9 * ad) + heatLUT(T * 0.8) * T * (0.1 + 1.25 * fibL) * smoothstep(0.02, 0.2, cond);
    if (uFlags.y > 0.5 && depth > 0.0) {
      float e = px;
      float t0 = smoothT(p, fx) * 5.0;
      float tx = smoothT(p + vec2(e, 0.0), fx) * 5.0;
      float ty = smoothT(p + vec2(0.0, e), fx) * 5.0;
      float g = length(vec2(tx - t0, ty - t0)) + 1e-5;
      float dl = abs(fract(t0 + 0.5) - 0.5) / g;
      float dash = smoothstep(0.35, 0.45, fract((fc.x + fc.y) / (9.0 * ui)));
      float iso = (1.0 - smoothstep(0.35 * ui, 1.1 * ui, dl)) * smoothstep(0.6, 1.0, t0) * heat * smoothstep(0.1, 0.25, T) * dash;
      vec3 ic = heatLUT(floor(t0 + 0.5) / 5.0 + 0.1);
      bf = mix(bf, mix(ic, vec3(1.0), 0.35), iso * 0.4);
      dk += ic * iso * 0.3;
    }
  }

  /* cryogen cooling front */
  if (cool > 0.001) {
    float dc = 0.035 + 0.30 * cool;
    float front = dc + 0.004 * sin(p.x * 14.0 + uTime * 1.3) + 0.003 * gnoise(vec2(pn.x * 25.0, uTime * 0.4));
    float lat = 1.0 - smoothstep(ELEC_A - 0.05, ELEC_A + 0.3, abs(p.x));
    float inside = cool * lat * (1.0 - smoothstep(front * 0.55, front + 2.0 * px, depth)) * smoothstep(-0.03, -0.01, depth);
    float dpx = abs(depth - front) / px;
    float line = cool * lat * exp(-dpx * dpx / (1.6 * ui * ui)) * step(0.0, depth);
    float glow = cool * lat * exp(-dpx / (9.0 * ui)) * step(0.0, depth);
    float mist = 0.85 + 0.15 * gnoise(pn * vec2(18.0, 36.0) / max(uView.y, 0.4) * 3.45 + vec2(uTime * 0.25, 0.0));
    bf = mix(bf, bf * vec3(0.80, 0.93, 1.05) + vec3(0.03, 0.07, 0.11), inside * 0.9 * mist);
    bf = mix(bf, COOL * 0.9, clamp(line * 0.8 + glow * 0.18, 0.0, 1.0));
    dk += COOL * (inside * 0.10 * mist + line * 0.9 + glow * 0.22);
  }

  /* RF current streamlines (strip electrode -> elliptic coordinates) */
  if (cur > 0.001) {
    float A = ELEC_A;
    vec2 z = vec2(p.x, max(p.y + 0.012, 1e-5));
    float r1 = length(z + vec2(A, 0.0));
    float r2 = length(z - vec2(A, 0.0));
    float ch = max((r1 + r2) / (2.0 * A), 1.0);
    float cv = clamp((r1 - r2) / (2.0 * A), -1.0, 1.0);
    float u = log(ch + sqrt(ch * ch - 1.0));
    float v = acos(cv);
    float shu = 0.5 * (exp(u) - exp(-u));
    float sv = sin(v);
    float hmet = A * sqrt(shu * shu + sv * sv) + 1e-6;
    float N = 22.0;
    float s = v / PI * N;
    float li = floor(s);
    float dpx = abs(fract(s) - 0.5) * (PI / N) * hmet / px;
    float spacing = (PI / N) * hmet / px;
    float core = exp(-dpx * dpx / (1.1 * ui * ui));
    float glow = exp(-dpx / (7.0 * ui));
    float D = A * shu;
    float ph = hash11(li * 3.7 + 1.0);
    float fl = fract(D / (0.30 * uView.y) - uTime * (0.55 + 0.3 * ph) + ph);
    float pulse = exp(-fl * 5.0) * smoothstep(0.0, 0.03, fl);
    float vis = smoothstep(0.1, 0.4, sv) * smoothstep(3.0 * ui, 8.0 * ui, spacing) * smoothstep(-0.012, 0.0, depth);
    float tm = smoothstep(0.0, 0.15, cond) * mix(0.4, 1.0, smoothstep(0.2, 0.85, cond));
    float I = cur * vis * tm * (core * (0.24 + 1.1 * pulse) + glow * (0.06 + 0.45 * pulse));
    float gd = smoothstep(0.0, 0.95, D / uView.y);
    vec3 lcB = mix(VIODK, JADE, gd);
    vec3 lcD = mix(VIOLET, MINT, gd);
    bf = mix(bf, mix(lcB, vec3(1.0), 0.3 * pulse * core), clamp(I, 0.0, 1.0) * 0.82);
    dk += lcD * I * 0.75 + vec3(1.0) * core * pulse * cur * vis * tm * 0.1;
    // tip electrode resting on the stratum corneum
    float eb = surfaceBase(pn.x) - 0.016;
    float th = 9.0 * ui * px;
    float rr = 0.45 * th;
    vec2 q = abs(vec2(p.x, p.y - (eb - 0.5 * th))) - vec2(A, 0.5 * th) + rr;
    float sd = (length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rr) / px;
    float fill = clamp(0.5 - sd, 0.0, 1.0);
    float eg = exp(-max(sd, 0.0) / (10.0 * ui)) * (1.0 - fill);
    float ea = smoothstep(0.0, 0.35, cur);
    float yin = clamp((eb - p.y) / th, 0.0, 1.0);          // 0 at the skin contact, 1 at the top
    float edgeLit = 1.0 - smoothstep(0.0, 0.3, yin);
    vec3 barB = mix(mix(vec3(0.30, 0.28, 0.38), vec3(0.62, 0.60, 0.70), smoothstep(0.55, 0.95, yin)), VIOLET, 0.25 + 0.6 * edgeLit);
    bf = mix(bf, barB, fill * ea);
    bf = mix(bf, VIOLET, eg * ea * 0.35);
    dk = mix(dk, mix(vec3(0.16, 0.14, 0.24), VIOLET * 1.4 + vec3(0.3), edgeLit), fill * ea);
    dk += VIOLET * eg * ea * 0.7;
    // return path glow at the bottom of the frame
    float rg = smoothstep(0.80, 1.0, 1.0 - uv.y) * cur;
    bf = mix(bf, JADE, rg * 0.10);
    dk += MINT * rg * 0.06;
  }

  float sm = mix(smoothstep(0.3, 0.7, uStain), stainMask(p, uView.y), smoothstep(0.0, 0.1, cond));
  vec3 outc = mix(aces(dk * 1.08), clamp(bf, 0.0, 1.0), sm);
  float front = sm * (1.0 - sm) * 4.0;
  front *= front;
  outc += mix(VIOLET, MINT, 0.6 + 0.4 * front) * front * front * 0.4 * smoothstep(0.02, 0.25, cond);

  /* vignette, illumination, grain */
  float illum = 1.0 + 0.018 * gnoise(uv * vec2(asp, 1.0) * 1.7 + 11.0);
  float vig = mix(1.0 - uLook.x * 0.55 * pow(rv, 2.0), (1.0 - uLook.x * 0.08 * pow(rv, 2.4)) * illum, sm);
  outc *= vig;
  float fr = floor(uTime * 24.0);
  float gr = hash12(fc + vec2(mod(fr, 97.0) * 13.7, mod(fr, 89.0) * 7.3)) - 0.5;
  float lumO = dot(outc, vec3(0.299, 0.587, 0.114));
  outc += gr * uLook.y * mix(0.02 * (0.35 + lumO), 0.018, sm);

  /* split divider */
  if (uSplit >= 0.0) {
    float xsP = uSplit * uRes.x;
    float dx = abs(fc.x - xsP);
    float lineA = 1.0 - smoothstep(0.55 * ui, 1.3 * ui, dx);
    float sh = exp(-dx / (5.0 * ui)) * (1.0 - lineA);
    outc *= 1.0 - sh * mix(0.25, 0.18, uStain);
    outc += VIOLET * sh * 0.35 * (1.0 - uStain);
    outc = mix(outc, vec3(1.0), lineA);
    if (uFlags.x > 0.5) {
      vec2 lq = (fc - vec2(xsP, 0.5 * uRes.y)) / ui;
      float dd = length(lq);
      float disk = 1.0 - smoothstep(14.5, 15.5, dd);
      float ring = (1.0 - smoothstep(14.5, 15.5, dd)) * smoothstep(12.8, 13.8, dd);
      float halo = exp(-max(dd - 15.0, 0.0) / 6.0) * (1.0 - disk);
      outc *= 1.0 - halo * 0.25;
      vec3 knob = mix(vec3(0.10, 0.09, 0.15), vec3(1.0), uStain);
      vec3 ink = mix(vec3(1.0), vec3(0.20, 0.15, 0.30), uStain);
      outc = mix(outc, knob, disk * 0.94);
      outc = mix(outc, mix(VIOLET, vec3(0.55, 0.40, 0.85), uStain), ring);
      float ax = abs(lq.x);
      float tri = (1.0 - smoothstep(-0.5, 0.5, abs(lq.y) - (8.5 - ax) * 0.85)) * step(3.5, ax) * step(ax, 8.5);
      outc = mix(outc, ink, tri * disk);
    }
  }

  /* scale bar + label */
  if (uText.z > 0.5) {
    vec2 q = fc - uBar.xy;
    float L = uBar.z; float T = uBar.w;
    vec3 ink = mix(vec3(0.93, 0.92, 0.97), vec3(0.11, 0.08, 0.15), uStain);
    vec3 paper = mix(vec3(0.03, 0.03, 0.05), vec3(1.0), uStain);
    float gp = uText.y;
    float tw = uText.x * 6.0 * gp;
    // soft plate for legibility
    vec2 pc = vec2(q.x - (L + 10.0 * ui + tw) * 0.5, q.y - T * 0.5);
    vec2 ph = vec2((L + 10.0 * ui + tw) * 0.5 + 9.0 * ui, max(T, 7.0 * gp) * 0.5 + 7.0 * ui);
    vec2 dq = abs(pc) - ph;
    float plate = 1.0 - smoothstep(-6.0 * ui, 0.0, length(max(dq + 6.0 * ui, 0.0)) - 6.0 * ui + min(max(dq.x, dq.y), 0.0) + 6.0 * ui);
    outc = mix(outc, paper, plate * mix(0.45, 0.55, uStain));
    if (q.x > -1.0 && q.x < L + 1.0 && q.y > -1.0 && q.y < T + 1.0) {
      float seg = floor(clamp(q.x, 0.0, L - 0.001) / L * 5.0);
      vec3 fillc = mod(seg, 2.0) < 0.5 ? ink : paper;
      float inner = step(0.0, q.x) * step(q.x, L) * step(0.0, q.y) * step(q.y, T);
      float edge = inner * (1.0 - step(ui, q.x) * step(q.x, L - ui) * step(ui, q.y) * step(q.y, T - ui));
      outc = mix(outc, fillc, inner);
      outc = mix(outc, ink, edge);
    }
    vec2 lq = fc - vec2(uBar.x + L + 10.0 * ui, uBar.y + 0.5 * T - 3.5 * gp);
    if (lq.x >= 0.0 && lq.y >= 0.0 && lq.x < tw && lq.y < 7.0 * gp) {
      float ci = floor(lq.x / (6.0 * gp));
      float cx = floor(mod(lq.x, 6.0 * gp) / gp);
      float cy = 6.0 - floor(lq.y / gp);
      vec2 g = vec2(0.0);
      for (int i = 0; i < 8; i++) { if (float(i) == ci) g = uGlyph[i]; }
      if (cx < 5.0) {
        float bit = glyphBit(g, cy, cx);
        vec2 cell = mod(lq, gp) / gp - 0.5;
        float dot_ = 1.0 - smoothstep(0.42, 0.62, max(abs(cell.x), abs(cell.y)));
        outc = mix(outc, ink, bit * dot_);
      }
    }
  }
  gl_FragColor = vec4(clamp(outc, 0.0, 1.0), 1.0);
}
`;

  /* =============================================================== engine */
  function compile(gl, type, src, label) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      var log = gl.getShaderInfoLog(sh);
      var lines = src.split('\n');
      var m = /ERROR: \d+:(\d+)/.exec(log || '');
      var ctx = '';
      if (m) { var ln = +m[1]; ctx = lines.slice(Math.max(0, ln - 3), ln + 2).map(function (l, i) { return (ln - 2 + i) + ': ' + l; }).join('\n'); }
      console.warn('[SkinFX.Histology] ' + label + ' shader error:\n' + log + '\n' + ctx);
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }
  function link(gl, fsSrc, label, names) {
    var vs = compile(gl, gl.VERTEX_SHADER, VERT, label + '/vs');
    var fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc, label);
    if (!vs || !fs) return null;
    var pr = gl.createProgram();
    gl.attachShader(pr, vs); gl.attachShader(pr, fs);
    gl.bindAttribLocation(pr, 0, 'aPos');
    gl.linkProgram(pr);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS) && !gl.isContextLost()) {
      console.warn('[SkinFX.Histology] link error (' + label + '): ' + gl.getProgramInfoLog(pr));
      return null;
    }
    var loc = {};
    for (var i = 0; i < names.length; i++) loc[names[i]] = gl.getUniformLocation(pr, names[i]);
    return { prog: pr, loc: loc };
  }

  var U_TISSUE = ['uRes', 'uCenter', 'uView', 'uSeed', 'uSplit', 'uSideA', 'uSideB', 'uStain', 'uHL'];
  var U_COMP = ['uTex', 'uRes', 'uCenter', 'uView', 'uSeed', 'uSplit', 'uFxA', 'uFxB', 'uTime', 'uStain', 'uUi',
    'uMag', 'uLook', 'uBar', 'uGlyph', 'uText', 'uFlags', 'uTexRect'];
  var PX_FLOOR = 0.00055; // mm — optical resolution floor used by the tissue shader
  var EMPTY = {};

  function create(canvas, opts) {
    if (!canvas || !canvas.getContext) return null;
    opts = opts || {};
    var attrs = {
      alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false,
      preserveDrawingBuffer: !!opts.preserveDrawingBuffer, powerPreference: 'high-performance'
    };
    var gl = null, isGL2 = false;
    try { gl = canvas.getContext('webgl2', attrs); isGL2 = !!gl; } catch (e) { gl = null; }
    if (!gl) {
      try { gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs); } catch (e2) { gl = null; }
    }
    if (!gl) return null;

    var dpr = clamp(num(opts.dpr, (root.devicePixelRatio || 1)), 0.5, 2);
    var maxTissuePx = clamp(num(opts.maxTissuePixels, 1.2e6), 1.5e5, 8.3e6);
    var seedOff = new Float32Array(2);
    seedOffset(opts.seed, seedOff);

    var P1 = null, P2 = null, vbo = null, tex = null, fbo = null;
    var tw = 0, th = 0;              // tissue target size
    var rw = 0, rh = 0;              // tissue sub-rect used by the last frame
    var cw = 0, ch = 0;              // canvas size the target was built for
    var lost = false, disposed = false;
    var cssW = 0, cssH = 0;
    var view = new Float64Array(4);  // cx, cy, vw, vh (mm)
    var key = new Float64Array(20), prevKey = new Float64Array(20);
    var dirty = true;
    var glyphBuf = new Float32Array(16);
    var ui = dpr;

    function init() {
      P1 = link(gl, FRAG_TISSUE, 'tissue', U_TISSUE);
      P2 = link(gl, FRAG_COMPOSITE, 'composite', U_COMP);
      if (!P1 || !P2) return false;
      vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      tex = null; fbo = null; tw = th = 0; cw = ch = 0; dirty = true;
      return true;
    }
    function freeTarget() {
      if (tex) gl.deleteTexture(tex);
      if (fbo) gl.deleteFramebuffer(fbo);
      tex = null; fbo = null;
    }
    function ensureTarget(W, H) {
      if (tex && cw === W && ch === H) return;
      var s = Math.min(1, Math.sqrt(maxTissuePx / (W * H)));
      var w1 = Math.max(1, Math.round(W * s)), h1 = Math.max(1, Math.round(H * s));
      freeTarget();
      tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w1, h1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, isGL2 ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      if (isGL2) gl.generateMipmap(gl.TEXTURE_2D);
      fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      tw = w1; th = h1; cw = W; ch = H; dirty = true;
    }

    function onLost(e) { e.preventDefault(); lost = true; }
    function onRestored() { lost = false; if (!disposed) init(); }
    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);

    if (!init()) return null;

    function resize(w, h) {
      if (w == null || h == null) { w = canvas.clientWidth || canvas.width / dpr; h = canvas.clientHeight || canvas.height / dpr; }
      cssW = Math.max(1, w); cssH = Math.max(1, h);
      var W = Math.max(1, Math.round(cssW * dpr)), H = Math.max(1, Math.round(cssH * dpr));
      var s = Math.min(1, 4096 / Math.max(W, H), Math.sqrt(8.3e6 / (W * H)));
      W = Math.max(1, Math.round(W * s)); H = Math.max(1, Math.round(H * s));
      if (canvas.width !== W) canvas.width = W;
      if (canvas.height !== H) canvas.height = H;
      ui = W / cssW;
      dirty = true;
    }
    if (canvas.clientWidth && canvas.clientHeight) resize(canvas.clientWidth, canvas.clientHeight);
    else { cssW = canvas.width / dpr; cssH = canvas.height / dpr; ui = dpr; }

    function render(P) {
      if (disposed || lost || !P1) return;
      P = P || EMPTY;
      var W = canvas.width, H = canvas.height;
      if (W < 2 || H < 2) return;
      if (!cssW || Math.abs(W / ui - cssW) > 1) { ui = dpr; cssW = W / ui; cssH = H / ui; }
      ensureTarget(W, H);

      var time = num(P.time, 0);
      var week = clamp(num(P.week, 0), 0, 12);
      var heat = clamp01(num(P.heat, 0)), cool = clamp01(num(P.cool, 0)), cur = clamp01(num(P.current, 0));
      var contr = clamp01(num(P.contraction, 0));
      var stain = clamp01(num(P.stain, 1));
      var hl = num(P.highlight, 0), hlAmt = clamp01(num(P.highlightAmount, 1));
      var hlI = hl === 1 ? hlAmt : 0, hlIII = hl === 3 ? hlAmt : 0;
      var mag = clamp01(num(P.magnification, 0));
      var split = (typeof P.split === 'number' && P.split >= 0) ? clamp01(P.split) : -1;
      var pan = P.pan || EMPTY;
      var zoom = Math.max(0.05, num(P.zoom, 1));
      var B = P.before || EMPTY;
      var bWeek = clamp(num(B.week, 0), 0, 12), bContr = clamp01(num(B.contraction, 0));
      var bHeat = clamp01(num(B.heat, heat)), bCool = clamp01(num(B.cool, cool)), bCur = clamp01(num(B.current, cur));
      var gIa = progI(week), gIIIa = progIII(week), gIb = progI(bWeek), gIIIb = progIII(bWeek);

      computeView(mag, zoom, num(pan.x, 0), num(pan.y, 0), W / H, view, seedOff[0]);
      // never rasterise the tissue finer than its optical resolution floor (sub-rect of the target)
      var h1 = Math.max(1, Math.min(th, Math.ceil(view[3] / PX_FLOOR)));
      var w1 = Math.max(1, Math.min(tw, Math.round(h1 * W / H)));
      rw = w1; rh = h1;

      /* ---- pass A (only when the tissue changed) ---- */
      key[0] = w1; key[1] = h1; key[2] = view[0]; key[3] = view[1]; key[4] = view[2]; key[5] = view[3];
      key[6] = split; key[7] = stain; key[8] = hlI; key[9] = hlIII; key[10] = gIa; key[11] = gIIIa;
      key[12] = contr; key[13] = gIb; key[14] = gIIIb; key[15] = bContr; key[16] = seedOff[0]; key[17] = seedOff[1];
      key[18] = 0; key[19] = 0;
      if (!dirty) {
        for (var i = 0; i < 20; i++) { if (key[i] !== prevKey[i]) { dirty = true; break; } }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      if (dirty) {
        var L = P1.loc;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        if (w1 < tw || h1 < th) {
          gl.viewport(0, 0, tw, th);
          gl.clearColor(0.027 + 0.957 * stain, 0.027 + 0.928 * stain, 0.047 + 0.933 * stain, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
        gl.viewport(0, 0, w1, h1);
        gl.useProgram(P1.prog);
        gl.uniform2f(L.uRes, w1, h1);
        gl.uniform2f(L.uCenter, view[0], view[1]);
        gl.uniform2f(L.uView, view[2], view[3]);
        gl.uniform2f(L.uSeed, seedOff[0], seedOff[1]);
        gl.uniform1f(L.uSplit, split);
        gl.uniform4f(L.uSideA, gIa, gIIIa, contr, gIa);
        gl.uniform4f(L.uSideB, gIb, gIIIb, bContr, gIb);
        gl.uniform1f(L.uStain, stain);
        gl.uniform2f(L.uHL, hlI, hlIII);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (isGL2) { gl.bindTexture(gl.TEXTURE_2D, tex); gl.generateMipmap(gl.TEXTURE_2D); }
        for (var k = 0; k < 20; k++) prevKey[k] = key[k];
        dirty = false;
      }

      /* ---- scale bar label ---- */
      var showBar = P.scaleBar !== false;
      var nGlyph = 0, barLen = 0;
      if (showBar) {
        var pxPerMm = W / view[2];
        var target = clamp(0.15 * W, 80 * ui, 220 * ui) / pxPerMm * 1000; // µm
        var um = BAR_STEPS_UM[0];
        for (var s = 0; s < BAR_STEPS_UM.length; s++) if (BAR_STEPS_UM[s] <= target) um = BAR_STEPS_UM[s];
        barLen = um / 1000 * pxPerMm;
        var val = um >= 1000 ? um / 1000 : um;
        var digits = val >= 1000 ? 4 : val >= 100 ? 3 : val >= 10 ? 2 : 1;
        var div = Math.pow(10, digits - 1);
        for (var dI = 0; dI < digits; dI++) {
          var dg = Math.floor(val / div) % 10; div /= 10;
          glyphBuf[nGlyph * 2] = GLYPH_DIGIT[dg][0]; glyphBuf[nGlyph * 2 + 1] = GLYPH_DIGIT[dg][1]; nGlyph++;
        }
        glyphBuf[nGlyph * 2] = GLYPH_SP[0]; glyphBuf[nGlyph * 2 + 1] = GLYPH_SP[1]; nGlyph++;
        var pre = um < 1000 ? GLYPH_U : GLYPH_M; // "µm" below 1000 µm, else "mm" (was "1 m")
        glyphBuf[nGlyph * 2] = pre[0]; glyphBuf[nGlyph * 2 + 1] = pre[1]; nGlyph++;
        glyphBuf[nGlyph * 2] = GLYPH_M[0]; glyphBuf[nGlyph * 2 + 1] = GLYPH_M[1]; nGlyph++;
      }

      /* ---- pass B ---- */
      var C = P2.loc;
      gl.viewport(0, 0, W, H);
      gl.useProgram(P2.prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(C.uTex, 0);
      gl.uniform2f(C.uRes, W, H);
      gl.uniform2f(C.uCenter, view[0], view[1]);
      gl.uniform2f(C.uView, view[2], view[3]);
      gl.uniform2f(C.uSeed, seedOff[0], seedOff[1]);
      gl.uniform1f(C.uSplit, split);
      gl.uniform4f(C.uFxA, heat, cool, cur, gIa);
      gl.uniform4f(C.uFxB, bHeat, bCool, bCur, gIb);
      gl.uniform1f(C.uTime, time);
      gl.uniform1f(C.uStain, stain);
      gl.uniform1f(C.uUi, ui);
      gl.uniform1f(C.uMag, mag);
      gl.uniform4f(C.uLook, clamp01(num(P.vignette, 1)), clamp01(num(P.grain, 1)), clamp01(num(P.chroma, 1)), clamp01(num(P.dof, 1)));
      var gp = Math.max(2, Math.round(1.6 * ui));
      gl.uniform4f(C.uBar, Math.round(24 * ui), Math.round(22 * ui), barLen, Math.max(3, Math.round(4 * ui)));
      gl.uniform2fv(C.uGlyph, glyphBuf);
      gl.uniform3f(C.uText, nGlyph, gp, showBar ? 1 : 0);
      gl.uniform4f(C.uFlags, P.splitHandle === false ? 0 : 1, P.isotherms === false ? 0 : 1, isGL2 ? 1 : 0, 0);
      gl.uniform4f(C.uTexRect, w1 / tw, h1 / th, (w1 - 0.5) / tw, (h1 - 0.5) / th);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function worldToCss(x, y, out) {
      out = out || {};
      out.x = ((x - view[0]) / view[2] + 0.5) * (canvas.width / ui);
      out.y = ((y - view[1]) / view[3] + 0.5) * (canvas.height / ui);
      return out;
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener('webglcontextlost', onLost, false);
      canvas.removeEventListener('webglcontextrestored', onRestored, false);
      if (!gl.isContextLost()) {
        freeTarget();
        if (vbo) gl.deleteBuffer(vbo);
        if (P1) gl.deleteProgram(P1.prog);
        if (P2) gl.deleteProgram(P2.prog);
      }
      P1 = P2 = null; vbo = null;
    }

    return {
      canvas: canvas,
      webgl2: isGL2,
      render: render,
      resize: resize,
      dispose: dispose,
      worldToCss: worldToCss,
      info: function () { return { webgl2: isGL2, width: canvas.width, height: canvas.height, tissueWidth: rw, tissueHeight: rh, view: [view[0], view[1], view[2], view[3]] }; }
    };
  }

  SkinFX.Histology = {
    version: '1.0.0',
    create: create,
    /** brochure collagen ratio curve (smooth fit through the chart values) */
    ratios: function (week) { return { typeI: ratioI(num(week, 0)), typeIII: ratioIII(num(week, 0)) }; },
    /** nominal layer depths (mm below the surface) for placing DOM labels */
    layers: function (week) {
      var g = progI(num(week, 0)), dt = DERMIS_T * (1 + DERMIS_GROW * g);
      return { stratumCorneum: -0.012, epidermis: 0.03, junction: 0.07, papillary: 0.13, reticular: 0.2 + dt * 0.35, dermisBase: dt + 0.05, subcutis: dt + 0.3 };
    },
    disclaimer: '模拟示意 · 基于彩页组织学与临床资料的原理可视化，不代表个体实际效果'
  };
})(typeof window !== 'undefined' ? window : this);
