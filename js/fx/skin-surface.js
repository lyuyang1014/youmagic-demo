/*!
 * SkinFX.Surface — procedural macro close-up of facial skin (YOUMAGIC)
 * ---------------------------------------------------------------------------
 * 模拟示意 · 基于彩页组织学与临床资料的原理可视化，不代表个体实际效果
 * (SIMULATION ONLY — a principle visualisation, not a photo of any person.)
 *
 * Plain classic script (no modules, no deps). Attaches window.SkinFX.Surface.
 * Raw WebGL2; falls back to WebGL1 (no mip chain -> no DoF / soft cavity / SSS
 * normal blur, otherwise identical); create() returns null without WebGL.
 *
 * Pipeline (all passes are one full-screen triangle; targets are RGBA8 laid out
 * in the camera's plane-projected space so 1 texel ~ 1 screen pixel):
 *   A1 static   micro relief: glyphic rhomboid network (anisotropic Voronoi
 *               plateaus + two families of primary furrows), pits, two pore
 *               layers, keratin micro-relief, vellus hairs  (view changes only)
 *   A2 material half-res pigment map: melanin, erythema, mottling, lentigines
 *   A3 combine  macro undulation + expression wrinkles + texture*micro -> packed
 *               16-bit height + mip chain       (wrinkle/texture/split changes)
 *   B  shade    parallax-occlusion trace (tilt), cone-traced soft self-shadow on
 *               the mip chain, per-channel blurred normals + wrap diffuse (SSS),
 *               reddish penumbra transmission, cavity AO from mip differences,
 *               dual-lobe sebum GGX + Fresnel + stratum-corneum glints, vellus
 *               hair glints and shadows, RF heat glow (brand heat scale), cryogen
 *               glaze/rime/frost glints, gold tip footprint, split divider,
 *               mip-based DoF, ACES filmic, vignette, plum shadow lift, grain.
 * Fully deterministic: the image depends ONLY on create() options + render()
 * params (seeded hash noise, no clocks, no RNG, no internal loops). Passes A1-A3
 * are cached and skipped when their inputs are unchanged.
 * GPU cost measured on Apple M4 (Chrome/ANGLE-Metal, timer queries) at a
 * 1440x900 px canvas: shade-only frame ~1.4 ms, wrinkle animating ~2.3 ms,
 * camera moving ~3.9 ms. Cost scales with pixel count.
 *
 * API
 *   var fx = SkinFX.Surface.create(canvas, {
 *     seed: 1,                     // pattern seed (wrinkle layout, pores, ...)
 *     dpr: min(devicePixelRatio, 1.25), // capped at 2; total pixels capped ~3.7 MP
 *     preserveDrawingBuffer: false,     // true for toDataURL / video capture
 *     heightScale: auto,           // height-pass resolution vs canvas; default
 *                                  //   1.25/dpr clamped 0.4..1 (full res at dpr<=1.25)
 *     forceWebGL1: false           // testing only: exercise the WebGL1 fallback
 *   });
 *   // -> null when WebGL is unavailable (show a static fallback instead)
 *   fx.resize(cssW, cssH);   // canvas pixel size = css * dpr (capped). Does not touch CSS.
 *   fx.render(params);       // draw one frame; call from YOUR rAF / timeline
 *   fx.dispose();
 *   fx.webgl2 (bool), fx.canvas, fx.gl
 *
 * render(params) — every field optional:
 *   time       seconds. Only drives subtle life: grain frame, key-light
 *              breathing, RF ripple + heat shimmer, frost twinkle.      [0]
 *   wrinkle    0..1  depth of the 2–4 expression furrows (forehead-style,
 *              curved: broad soft valley + narrow crease + bunched shoulders;
 *              lowering it flattens the crease first). 1 = 治疗前 deep furrows,
 *              ~0.35 = softened after treatment. Fine lines/pores always stay. [1]
 *   texture    0..1  fine-line (glyphic rhomboid network) / pore / microrelief
 *              strength. Lower = slightly finer, never flat.               [1]
 *   heat       0..1  RF delivery: warm glow from beneath (brand heat scale
 *              --heat-0..6), strongest just below the surface, leaking through
 *              furrows/pores, with a gentle "6.78 MHz-inspired" ripple.    [0]
 *   cool       0..1  cryogen cooling: cool blue sheen, faint frost crystals,
 *              suppresses surface heat under the tip footprint.            [0]
 *   tip        null | {x, y, r}  treatment-tip footprint (rounded square, gold
 *              edge) where heat/cool concentrate. x,y = canvas UV (0..1, origin
 *              top-left) of the reference view (tilt 0, zoom 1, pan 0); the
 *              footprint is glued to the skin so it follows zoom/pan/tilt.
 *              r = half side as a fraction of canvas height (default 0.3).
 *              With tip=null heat/cool cover the whole frame.            [null]
 *   split      -1 (off) | 0..1  compare mode: pixels left of split (canvas
 *              x fraction) use params.before, right side the main params;
 *              draws a crisp divider with a glowing handle.              [-1]
 *   before     {wrinkle, texture} for the left side in split mode. [{1, 1}]
 *   light      key-light azimuth in radians, on the skin plane: 0 = from the
 *              right, PI/2 = from the top of the frame (counter-clockwise). [2.05]
 *   elevation  0..1  key-light height: 0 = grazing/raking (~7°), 1 = ~77°. [0.2]
 *   tilt       0..1  camera tilt (0 = straight down, 1 ≈ 50°), parallax-
 *              occlusion traced, soft depth of field at the far edge.    [0.15]
 *   zoom       0.5..2  (canvas height ≈ 18 mm of skin at zoom 1)            [1]
 *   pan        {x, y} camera offset in fractions of canvas height
 *              (+x right, +y down).                                  [{0, 0}]
 *   mode       'photo' | 'thermal'  thermal = stylised thermal-camera palette
 *              of the same heightfield (for the mechanism story).     ['photo']
 *   extras:    exposure (1), grain 0..1 (1), vignette 0..1 (1)
 *
 * Compliance: every surface this renders is a simulation. Present it with the
 * label “模拟示意 · 基于彩页组织学与临床资料的原理可视化，不代表个体实际效果”.
 */
(function (root) {
  'use strict';
  var SkinFX = (root.SkinFX = root.SkinFX || {});

  // ---- scene constants ------------------------------------------------------
  var VIEW_MM = 18.0;                 // canvas height in mm at zoom 1, tilt 0
  var TAN_F = Math.tan((13.0 * Math.PI) / 180); // half vertical FOV
  var MAX_TILT = 0.88;                // rad (~50°)
  var MARGIN = 0.12;                  // FBO over-scan (NDC fraction)
  var RELIEF = 1.0;                   // height exaggeration
  var MAX_DPR = 2;
  var DEFAULT_DPR = 1.25;             // default = min(devicePixelRatio, 1.25)
  var MAX_PIXELS = 2560 * 1440;

  var DEFAULTS = {
    time: 0, wrinkle: 1, texture: 1, heat: 0, cool: 0, tip: null, split: -1,
    before: { wrinkle: 1, texture: 1 }, light: 2.05, elevation: 0.2, tilt: 0.15,
    zoom: 1, pan: { x: 0, y: 0 }, mode: 'photo', exposure: 1, grain: 1, vignette: 1
  };

  // ---- GLSL -----------------------------------------------------------------
  var GLSL_COMMON = [
    '#define H_MIN -1.0',
    '#define H_RANGE 1.5',
    '#define M_MIN -0.16',
    '#define M_RANGE 0.2',
    'uniform vec3 uCamPos; uniform vec3 uCamR; uniform vec3 uCamU; uniform vec3 uCamF;',
    'uniform vec2 uTan; uniform float uMargin; uniform vec2 uSeedOff; uniform float uSeedK;',
    'float hash11(float p){ p = fract(p*0.1031); p *= p + 33.33; p *= p + p; return fract(p); }',
    'float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }',
    'vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz)*p3.zy); }',
    'float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0 - 2.0*f);',
    '  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y); }',
    'float noise1(float x){ float i = floor(x); float f = fract(x); float u = f*f*(3.0 - 2.0*f); return mix(hash11(i), hash11(i + 1.0), u); }',
    'float hs(float n){ return hash11(n*1.618 + uSeedK); }',
    // ray through canvas NDC (unnormalised)
    'vec3 rayAt(vec2 ndc){ return uCamF + ndc.x*uTan.x*uCamR + ndc.y*uTan.y*uCamU; }',
    'vec2 fboNdc(vec2 uv){ return (uv*2.0 - 1.0)*(1.0 + uMargin); }',
    'vec2 planeXY(vec2 uv){ vec3 r = rayAt(fboNdc(uv)); return uCamPos.xy + r.xy*(-uCamPos.z/r.z); }',
    'vec2 uvOf(vec2 xy){ vec3 d = vec3(xy, 0.0) - uCamPos; float z = dot(d, uCamF);',
    '  vec2 n = vec2(dot(d, uCamR)/(z*uTan.x), dot(d, uCamU)/(z*uTan.y)); return n/(1.0 + uMargin)*0.5 + 0.5; }'
  ].join('\n');

  // ---------------- pass A1: static micro-relief (camera-dependent only) ----------------
  // R,G = 16-bit packed micro height (glyphic network, pits, pores, keratin relief),
  // B = pore mask, A = vellus-hair coverage. Recomputed only when the view changes.
  var FS_STATIC = [
    'uniform vec2 uFbo; uniform float uPixAng;',
    // one family of long, straight-ish primary skin furrows (glyphic lines)
    'float furrowProf(float d, float w){ float p = 1.0 - smoothstep(0.0, 2.3*w, d); return 0.7*p*p + 0.3*exp(-d/(0.5*w)); }',
    'float family(vec2 xw, float ang, float sp, float fid, float w, float fp){',
    '  float ca = cos(ang); float sa = sin(ang);',
    '  vec2 r = vec2(ca*xw.x + sa*xw.y, -sa*xw.x + ca*xw.y);',
    '  float yi = r.y/sp; float i0 = floor(yi);',
    '  float we = max(w, fp*1.2); float aa = w/we;',
    '  float best = 0.0;',
    '  for (int k = 0; k < 2; k++){',
    '    float idx = i0 + float(k);',
    '    float hh = hash11(idx*1.731 + fid*57.13 + uSeedK);',
    '    float pos = (idx + (hh - 0.5)*0.6)*sp;',
    '    float d = abs(r.y - pos + 0.18*sp*(noise1(r.x/(sp*0.9) + hh*37.0) - 0.5));',
    '    float pres = smoothstep(0.42, 0.66, noise1(r.x/(sp*0.75) + hh*91.0));',
    '    float dep = mix(0.45, 1.0, fract(hh*13.7))*pres;',
    '    best = max(best, dep*furrowProf(d, we)*aa);',
    '  }',
    '  return best;',
    '}',
    // Voronoi: x = distance to cell edge, y = cell hash, z = edge-pair hash, w = vertex proximity
    'vec4 vorA(vec2 x){',
    '  vec2 n = floor(x); vec2 f = fract(x);',
    '  vec2 mr = vec2(0.0); vec2 mr2 = vec2(0.0); vec2 mg = vec2(0.0); vec2 mg2 = vec2(0.0);',
    '  float md = 8.0; float md2 = 8.0; float md3 = 8.0;',
    '  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){',
    '    vec2 g = vec2(float(i), float(j));',
    '    vec2 r = g + hash22(n + g)*0.8 + 0.1 - f;',
    '    float d = dot(r, r);',
    '    if (d < md){ md3 = md2; md2 = md; mr2 = mr; mg2 = mg; md = d; mr = r; mg = g; }',
    '    else if (d < md2){ md3 = md2; md2 = d; mr2 = r; mg2 = g; }',
    '    else if (d < md3){ md3 = d; }',
    '  }',
    '  float e = dot(0.5*(mr + mr2), normalize(mr2 - mr + 1e-5));',
    '  return vec4(e, hash12(n + mg), hash12(2.0*n + mg + mg2 + 0.37), sqrt(md3) - sqrt(md));',
    '}',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy/uFbo;',
    '  vec2 ndc = fboNdc(uv);',
    '  vec3 rd = rayAt(ndc); float t = -uCamPos.z/rd.z;',
    '  vec2 x = uCamPos.xy + rd.xy*t;',
    '  float cosI = -rd.z/length(rd);',
    '  float fp = t*length(rd)*uPixAng/sqrt(max(cosI, 0.2));',
    '  vec2 xs = x + uSeedOff;',
    '  float h = 0.0;',
    // glyphic network: puffy polygonal plateaus (anisotropic Voronoi) crossed by
    // two families of straight primary lines -> rhomboid pattern; pits at crossings
    '  vec2 wv = vec2(vnoise(xs*0.7), vnoise(xs*0.7 + 19.7)) - 0.5;',
    '  vec2 xw = xs + wv*0.16;',
    '  const float ang = 0.06;',
    '  float ca = cos(ang); float sa = sin(ang);',
    '  vec2 xa = vec2(ca*xw.x + sa*xw.y, -sa*xw.x + ca*xw.y)*vec2(0.74, 1.0);',
    '  vec4 va = vorA(xa/0.34 + 3.1);',
    '  float ea = va.x*0.34;',
    '  float wa = 0.04; float wae = max(wa, fp*1.3);',
    '  float fa = 1.0 - smoothstep(0.0, 2.4*wae, ea); fa = fa*fa*mix(0.18, 1.0, va.z*sqrt(va.z))*(wa/wae);',
    '  float f1 = family(xw, ang + 0.78, 1.15, 1.0, 0.055, fp);',
    '  float f2 = family(xw, ang - 0.74, 1.2, 2.0, 0.055, fp);',
    '  float netVar = 0.3 + 0.7*smoothstep(0.15, 0.85, vnoise(xs*0.3 + 4.4));',
    // primary lines dominate; the secondary polygonal net is shallower and fades in and out
    // (a uniform, deep net reads as crocodile leather / cracked clay rather than skin)
    '  float fur = max(max(f1, f2)*0.8, fa*0.48*netVar) + 0.16*min(f1 + f2, fa);',
    '  float dome = 1.0 - exp(-ea/0.07);',
    '  float pit = (1.0 - smoothstep(0.0, 0.2, va.w))*smoothstep(0.45, 0.7, vnoise(xs*2.3 + 1.7));',
    '  h += -0.034*fur + 0.0045*dome + 0.004*(va.y - 0.5)*dome - 0.02*pit*(wa/wae);',
    // vellus / keratin micro relief
    '  float fadeM = clamp((0.09/fp - 1.4)/2.0, 0.0, 1.0);',
    '  h += fadeM*0.0048*(vnoise(xs*11.0 + 0.5) + 0.5*vnoise(xs*23.0 + 3.0) - 0.75);',
    // mesoscale cobblestone relief (0.25-1 mm) — survives small canvases and gives the soft
    // orange-peel texture skin shows under raking light (instead of smooth putty)
    '  h += 0.009*(vnoise(xs*2.1 + 7.7) + 0.55*vnoise(xs*4.4 + 1.3) - 0.775);',
    // pores (layer A also roots the vellus hairs)
    '  float pmask = 0.0;',
    '  const float PC = 0.72;',
    '  vec2 pg = xs/PC; vec2 pc = floor(pg); vec2 pf = pg - pc;',
    '  {',
    '    float on = step(hash12(pc + 41.7), 0.5);',
    '    vec2 pp = 0.22 + 0.56*hash22(pc + 13.1);',
    '    float pr = mix(0.028, 0.055, hash12(pc + 7.7));',
    '    float pre = max(pr, fp*1.1); float aa = (pr/pre)*(pr/pre);',
    '    float q = length(pf - pp)*PC/pre;',
    '    float fun = 1.0 - smoothstep(0.0, 1.0, q);',
    '    h += on*0.04*aa*(-fun*fun + 0.08*exp(-(q - 1.3)*(q - 1.3)*9.0));',
    '    pmask = max(pmask, on*(1.0 - smoothstep(0.1, 0.9, q))*sqrt(aa)*0.7);',
    '  }',
    '  {',
    '    vec2 xr = vec2(0.8776*xs.x + 0.4794*xs.y, -0.4794*xs.x + 0.8776*xs.y)/1.17 + 3.7;',
    '    vec2 c2 = floor(xr); vec2 f2c = xr - c2;',
    '    float on = step(hash12(c2 + 5.1), 0.32);',
    '    vec2 pp = 0.25 + 0.5*hash22(c2 + 2.3);',
    '    float pr = mix(0.05, 0.1, hash12(c2 + 9.4));',
    '    float pre = max(pr, fp*1.1); float aa = (pr/pre)*(pr/pre);',
    '    float pa = hash12(c2 + 6.6)*3.14159; vec2 pv = (f2c - pp)*1.17; pv = vec2(cos(pa)*pv.x + sin(pa)*pv.y, (-sin(pa)*pv.x + cos(pa)*pv.y)*1.45);',
    '    float q = length(pv)/pre;',
    '    float fun = 1.0 - smoothstep(0.0, 1.0, q);',
    '    h += on*0.06*aa*(-pow(fun, 1.6) + 0.1*exp(-(q - 1.25)*(q - 1.25)*8.0));',
    '    pmask = max(pmask, on*(1.0 - smoothstep(0.15, 0.95, q))*sqrt(aa));',
    '  }',
    // vellus hairs growing out of pore layer A
    '  float hair = 0.0;',
    '  float hang = -2.0 + 0.5*(vnoise(xs*0.05 + 11.0) - 0.5);',
    // hairs point down/left (angle -2 +/- 0.55 rad) and are shorter than a cell, so only
    // roots in this cell or the cells right/above can reach this texel -> 2x2 search
    '  for (int j = 0; j <= 1; j++) for (int i = 0; i <= 1; i++){',
    '    vec2 cc = pc + vec2(float(i), float(j));',
    '    if (hash12(cc + 91.3) < 0.5 && hash12(cc + 41.7) < 0.5){',
    '      vec2 root = (cc + 0.22 + 0.56*hash22(cc + 13.1))*PC;',
    '      float a = hang + (hash12(cc + 5.3) - 0.5)*0.6;',
    '      vec2 dir = vec2(cos(a), sin(a)); vec2 nr = vec2(-dir.y, dir.x);',
    '      float len = mix(0.28, 0.66, hash12(cc + 2.9));',
    '      vec2 rel = xs - root;',
    '      float tt = clamp(dot(rel, dir)/len, 0.0, 1.0);',
    '      float bend = (hash12(cc + 8.1) - 0.5)*0.15*len;',
    '      float dd = length(rel - dir*tt*len - nr*bend*tt*tt);',
    '      float wdt = mix(0.0055, 0.002, tt); float we = max(wdt, fp*0.6);',
    '      float cov = (wdt/we)*(1.0 - smoothstep(we*0.5, we*1.3, dd))*smoothstep(0.0, 0.12, tt);',
    '      hair = max(hair, cov*(1.0 - 0.5*tt)*0.8);',
    '    }',
    '  }',
    '  float v = clamp((h - M_MIN)/M_RANGE, 0.0, 1.0)*255.0*0.99998;',
    '  float hi = floor(v);',
    '  gl_FragColor = vec4(hi/255.0, v - hi, pmask, hair);',
    '}'
  ].join('\n');


  // ---------------- pass A2: pigment map (half res, camera-dependent only) ----------------
  var FS_MATERIAL = [
    'uniform vec2 uFbo;',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy/uFbo;',
    '  vec3 rd = rayAt(fboNdc(uv)); vec2 S = uCamPos.xy + rd.xy*(-uCamPos.z/rd.z) + uSeedOff;',
    '  float mel = vnoise(S*0.085)*0.65 + vnoise(S*0.19 + 7.1)*0.35;',
    '  float red = vnoise(S*0.12 + 31.0)*0.65 + vnoise(S*0.3 + 3.3)*0.35;',
    '  float mot = vnoise(S*1.3 + 4.0);',
    '  vec2 fc = floor(S/2.6); vec2 ff = S/2.6 - fc; float on = step(hash12(fc + 3.3), 0.22);',
    '  vec2 fpnt = 0.25 + 0.5*hash22(fc + 8.8); float frr = mix(0.05, 0.16, hash12(fc + 1.9));',
    '  float fk = on*(1.0 - smoothstep(frr*0.4, frr, length(ff - fpnt)*(0.9 + 0.2*vnoise(S*6.0))));',
    '  gl_FragColor = vec4(mel, red, mot, fk);',
    '}'
  ].join('\n');

  // ---------------- pass A3: combine (wrinkle / texture / split dependent) ----------------
  // total height = macro undulation + expression wrinkles + texture * micro relief
  var FS_COMBINE = [
    'uniform sampler2D uStatic; uniform vec2 uFbo; uniform vec2 uWT; uniform vec2 uWTb; uniform float uSplitNdc;',
    '#define SP 5.6',
    // cross-section of an expression wrinkle (dermatology-style): a broad, soft valley
    // (w = valley half-width) with a narrow rounded crease at its floor, flanked by gently
    // bunched shoulders. cr scales the crease: softening flattens the crease first, so the
    // line turns from a crisp fold into a shallow shading band instead of a knife cut.
    'float lineProfile(float d, float D, float w, float up, float cr){',
    '  float u = d/w; float au = abs(u);',
    '  float valley = exp(-u*u*1.15);',
    '  float c = d/(0.2*w);',
    '  float crease = exp(-1.5*(sqrt(c*c + 0.07) - 0.2646));',
    '  float sh = exp(-(au - 1.45)*(au - 1.45)*1.9)*(d > 0.0 ? up : 2.0 - up);',
    '  return D*(-0.52*valley - 0.48*cr*crease + 0.14*sh);',
    '}',
    'float majorLine(float i, vec2 x, float wr, float arch){',
    '  float h1 = hs(i*1.13 + 0.1); float h2 = hs(i*2.71 + 0.7); float h3 = hs(i*3.17 + 1.3); float h4 = hs(i*5.03 + 2.9);',
    '  float yc = i*SP + (h1 - 0.5)*1.1 - arch + 0.5*sin(x.x*0.10 + h2*6.283)',
    '           + 1.0*(noise1(x.x*0.13 + h3*97.0) - 0.5) + 0.26*(noise1(x.x*0.62 + h4*57.0) - 0.5);',
    '  float hb = hs(i*11.3 + 6.1); float gx = (hs(i*13.7 + 7.7) - 0.5)*22.0;',
    '  float hasGap = step(hb, 0.42);',
    '  yc += hasGap*(x.x > gx ? 0.28 : -0.28);',
    '  float d = x.y - yc;',
    '  if (abs(d) > 3.6) return 0.0;',
    '  float xs = -9.0 - hs(i*7.19 + 4.1)*24.0; float xe = 9.0 + hs(i*9.37 + 5.3)*24.0;',
    '  float ext = smoothstep(xs, xs + 8.0, x.x)*(1.0 - smoothstep(xe - 8.0, xe, x.x));',
    '  float gap = mix(1.0, smoothstep(0.5, 2.6, abs(x.x - gx)), hasGap);',
    '  float strength = mix(0.55, 1.0, hs(i*15.1 + 8.9));',
    '  float along = 0.5 + 0.5*noise1(x.x*0.11 + hb*71.0);',
    '  float D = 0.33*strength*along*ext*gap*pow(wr, 0.8);',
    // valley half-width 0.5-0.85 mm; a softened line gets a little broader, never narrower
    '  float w = (0.52 + 0.22*noise1(x.x*0.21 + h1*33.0))*mix(1.18, 1.0, wr)*mix(0.85, 1.1, strength);',
    '  float cr = mix(0.28, 1.0, wr*wr)*(0.75 + 0.25*noise1(x.x*0.5 + h4*13.0));',
    '  float av = abs(d)/w; float sat = exp(-(av - 2.3)*(av - 2.3)*7.0)*(0.6 + 0.4*sign(d));',
    '  sat *= smoothstep(0.45, 0.75, noise1(x.x*0.9 + h2*41.0 + step(0.0, d)*17.0));',
    '  return lineProfile(d, D, w, 1.35, cr) - 0.05*D*sat*wr;',
    '}',
    'float minorLine(float j, vec2 x, float wr, float arch){',
    '  float k1 = hs(j*17.3 + 0.3); if (k1 > 0.62) return 0.0;',
    '  float yc = (j + 0.5)*SP + (hs(j*19.1 + 1.1) - 0.5)*1.8 - arch + 0.7*(noise1(x.x*0.17 + k1*61.0) - 0.5) + 0.2*(noise1(x.x*0.8 + k1*23.0) - 0.5);',
    '  float d = x.y - yc; if (abs(d) > 1.6) return 0.0;',
    '  float cx = (hs(j*23.3 + 2.2) - 0.5)*26.0; float hl = 3.0 + hs(j*29.7 + 3.3)*7.0;',
    '  float ext = 1.0 - smoothstep(hl*0.45, hl, abs(x.x - cx));',
    '  float D = 0.09*ext*pow(wr, 1.6)*(0.55 + 0.45*noise1(x.x*0.3 + k1*11.0));',
    '  return lineProfile(d, D, 0.3*mix(1.15, 1.0, wr), 1.0, mix(0.3, 1.0, wr));',
    '}',
    'float wrinkles(vec2 x, float wr){',
    '  if (wr < 0.001) return 0.0;',
    '  float arch = 0.0032*x.x*x.x;',
    '  float yy = (x.y + arch)/SP;',
    '  float i0 = floor(yy + 0.5);',
    '  float h = majorLine(i0 - 1.0, x, wr, arch) + majorLine(i0, x, wr, arch) + majorLine(i0 + 1.0, x, wr, arch);',
    '  float j0 = floor(yy);',
    '  h += minorLine(j0, x, wr, arch) + minorLine(j0 + (fract(yy) < 0.5 ? -1.0 : 1.0), x, wr, arch);',
    '  return h;',
    '}',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy/uFbo;',
    '  vec2 ndc = fboNdc(uv);',
    '  vec3 rd = rayAt(ndc); vec2 x = uCamPos.xy + rd.xy*(-uCamPos.z/rd.z);',
    '  vec2 xs = x + uSeedOff;',
    '  vec2 wt = ndc.x < uSplitNdc ? uWTb : uWT;',
    '  vec4 st = texture2D(uStatic, uv);',
    '  float micro = M_MIN + M_RANGE*(st.r + st.g/255.0);',
    '  float h = (vnoise(xs*0.10)*0.6 + vnoise(xs*0.23 + 5.2)*0.28 + vnoise(xs*0.55 + 9.1)*0.12 - 0.5)*0.42;',
    '  h += wrinkles(x, wt.x);',
    '  h += micro*mix(0.36, 0.82, wt.y);',
    '  float v = clamp((h - H_MIN)/H_RANGE, 0.0, 1.0)*255.0*0.99998;',
    '  float hi = floor(v);',
    '  gl_FragColor = vec4(hi/255.0, v - hi, st.b, st.a);',
    '}'
  ].join('\n');

  // ---------------- pass B: shading ----------------
  var FS_SHADE = [
    'uniform sampler2D uH; uniform sampler2D uMat;',
    'uniform vec2 uRes; uniform vec2 uFbo;',
    'uniform float uRelief; uniform float uSteps; uniform float uHTop; uniform float uHBot;',
    'uniform vec3 uL; uniform float uKeyI;',
    'uniform float uTime; uniform float uHeat; uniform float uCool; uniform float uMode;',
    'uniform float uExposure; uniform float uGrain; uniform float uVig;',
    'uniform vec4 uTip; uniform vec2 uCenter;',
    'uniform float uSplitPx; uniform float uDpr; uniform float uFocus; uniform float uDof; uniform float uMaxLod; uniform float uPixAng;',
    'float Hs(vec2 uv, float l){ vec4 s = TEXLOD(uH, uv, l); return (H_MIN + H_RANGE*(s.r + s.g/255.0))*uRelief; }',
    'float Hxy(vec2 xy, float l){ return Hs(uvOf(xy), l); }',
    'vec3 heatLUT(float t){',
    '  t = clamp(t, 0.0, 1.0)*6.0;',
    '  vec3 c = mix(vec3(0.043, 0.063, 0.188), vec3(0.165, 0.082, 0.282), clamp(t, 0.0, 1.0));',
    '  c = mix(c, vec3(0.416, 0.165, 0.549), clamp(t - 1.0, 0.0, 1.0));',
    '  c = mix(c, vec3(0.722, 0.188, 0.478), clamp(t - 2.0, 0.0, 1.0));',
    '  c = mix(c, vec3(0.941, 0.376, 0.247), clamp(t - 3.0, 0.0, 1.0));',
    '  c = mix(c, vec3(1.0, 0.769, 0.369), clamp(t - 4.0, 0.0, 1.0));',
    '  c = mix(c, vec3(1.0, 0.957, 0.839), clamp(t - 5.0, 0.0, 1.0));',
    '  return c;',
    '}',
    'float sdRBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }',
    'vec3 nrmFrom(float dhu, float dhv, vec2 a, vec2 b){',
    '  float det = a.x*b.y - a.y*b.x;',
    '  vec2 g = vec2(dhu*b.y - dhv*a.y, a.x*dhv - b.x*dhu)/det;',
    '  return normalize(vec3(-g, 1.0));',
    '}',
    'vec3 normalAt(vec2 uv, float l, vec2 ja, vec2 jb){',
    '  float s = exp2(l);',
    '  vec2 du = vec2(s/uFbo.x, 0.0); vec2 dv = vec2(0.0, s/uFbo.y);',
    '  float hl = Hs(uv - du, l); float hr = Hs(uv + du, l); float hd = Hs(uv - dv, l); float hu = Hs(uv + dv, l);',
    '  return nrmFrom(hr - hl, hu - hd, ja*s, jb*s);',
    '}',
    'float ggx(float nh, float a){ float a2 = a*a; float d = nh*nh*(a2 - 1.0) + 1.0; return a2/(3.14159*d*d); }',
    'void main(){',
    '  vec2 frag = gl_FragCoord.xy;',
    '  vec2 suv = frag/uRes;',
    '  vec2 ndc = suv*2.0 - 1.0;',
    '  float aspect = uRes.x/uRes.y;',
    '  float heatK = uHeat;',
    // heat shimmer: tiny refraction wobble of warm air (time-driven, deterministic)
    '  if (heatK > 0.001){',
    '    ndc += heatK*0.0011*vec2(sin(ndc.y*23.0 + uTime*2.9 + sin(ndc.x*5.0 + uTime*0.7)*2.0), cos(ndc.x*19.0 - uTime*2.3 + sin(ndc.y*4.0)*2.0));',
    '  }',
    '  vec3 rd = normalize(rayAt(ndc));',
    // ---- trace heightfield (parallax occlusion) ----
    '  vec3 P;',
    '  if (uSteps < 0.5){',
    '    float t = -uCamPos.z/rd.z; P = uCamPos + rd*t;',
    '    for (int k = 0; k < 2; k++){ float hh = Hxy(P.xy, 0.0); t = (hh - uCamPos.z)/rd.z; P = uCamPos + rd*t; }',
    '  } else {',
    '    float t0 = (uHTop - uCamPos.z)/rd.z; float t1 = (uHBot - uCamPos.z)/rd.z;',
    '    float dt = (t1 - t0)/uSteps; float t = t0;',
    '    vec3 Q = uCamPos + rd*t; float prevD = Q.z - Hxy(Q.xy, 0.0);',
    '    for (int k = 0; k < 40; k++){',
    '      if (float(k) >= uSteps) break;',
    '      t += dt; Q = uCamPos + rd*t;',
    '      float dd = Q.z - Hxy(Q.xy, 0.0);',
    '      if (dd < 0.0){ t = t - dt + dt*prevD/(prevD - dd);',
    '        Q = uCamPos + rd*t; float d2 = Q.z - Hxy(Q.xy, 0.0);',
    '        if (d2 < 0.0){ t -= dt*0.5*abs(d2)/(abs(d2) + abs(prevD)); } break; }',
    '      prevD = dd;',
    '    }',
    '    P = uCamPos + rd*t;',
    '  }',
    '  vec2 uv = uvOf(P.xy);',
    '  float zc = dot(P - uCamPos, uCamF);',
    '  float fp = zc*uPixAng/sqrt(max(-rd.z, 0.15));',
    '  float L0 = min(uDof*clamp((abs(zc - uFocus)/zc - 0.04)*6.0, 0.0, 1.0)*1.7, uMaxLod);',
    '  vec4 c0 = TEXLOD(uH, uv, L0);',
    '  float h0 = (H_MIN + H_RANGE*(c0.r + c0.g/255.0))*uRelief;',
    '  float pore = c0.b; float hairA = c0.a;',
    // Jacobian of plane position per FBO texel
    '  vec2 ex = vec2(1.0/uFbo.x, 0.0); vec2 ey = vec2(0.0, 1.0/uFbo.y);',
    '  vec2 ja = planeXY(uv + ex) - planeXY(uv - ex); vec2 jb = planeXY(uv + ey) - planeXY(uv - ey);',
    '  vec3 Ns = normalAt(uv, L0, ja, jb);',
    '  vec3 Nb = normalAt(uv, min(L0 + 2.0, uMaxLod), ja, jb);',
    // cavity / ambient occlusion from mip differences
    '  float hb1 = Hs(uv, min(L0 + 2.5, uMaxLod)); float hb2 = Hs(uv, min(L0 + 5.0, uMaxLod));',
    '  float ao = clamp(1.0 - 5.5*max(hb1 - h0, 0.0), 0.0, 1.0)*clamp(1.0 - 1.5*max(hb2 - h0, 0.0), 0.0, 1.0);',
    '  ao = mix(ao, 1.0, 0.1);',
    // ---- key light soft shadow (cone-traced on the mip chain) ----
    '  vec3 L = uL;',
    '  vec2 ldir = normalize(L.xy + 1e-5); float tanE = L.z/max(length(L.xy), 1e-3);',
    '  float res = 1.0; float resF = 1.0; float dist = 0.022;',
    '  float hStart = h0 + 0.0015*uRelief;',
    '  for (int i = 0; i < 9; i++){',
    '    float lod = clamp(log2(max(dist*0.28/fp, 1.0)) + L0, 0.0, uMaxLod);',
    '    float hq = Hxy(P.xy + ldir*dist, lod);',
    '    float cl = (hStart + dist*tanE - hq)/dist;',
    '    if (dist < 0.16) resF = min(resF, cl); else res = min(res, cl);',
    '    dist *= 1.72;',
    '  }',
    '  float shadowC = smoothstep(-0.07, 0.07, res);',
    '  float shadowF = smoothstep(-0.1, 0.1, resF);',
    '  float shadow = shadowC*shadowF;',
    // ---- skin albedo (procedural pigment, linear) ----
    '  vec2 S = P.xy + uSeedOff;',
    '  vec4 mat = texture2D(uMat, uv);',
    '  float mel = mat.r; float red = mat.g; float mot = mat.b;',
    '  vec3 alb = vec3(0.59, 0.352, 0.276);',
    '  alb *= mix(vec3(1.07, 1.06, 1.06), vec3(0.78, 0.67, 0.6), smoothstep(0.2, 0.85, mel)*0.85);',
    '  alb *= mix(vec3(1.0), vec3(0.93, 0.88, 0.87), smoothstep(0.35, 0.75, mot)*0.8);',
    '  alb *= mix(vec3(1.0), vec3(1.05, 0.84, 0.85), smoothstep(0.38, 0.85, red)*0.85);',
    // fine capillary blush (1-3 mm blotches): living skin is never one flat tone
    '  alb *= mix(vec3(1.0), vec3(1.03, 0.9, 0.9), smoothstep(0.45, 0.9, vnoise(S*0.55 + 61.0))*0.55);',
    '  alb *= mix(vec3(1.0), vec3(0.8, 0.7, 0.66), mat.a*0.55);',
    // tip masks
    '  float mH = 1.0; float mC = 1.0; float sdT = 1e3; float rip = 0.0; vec2 rc = uCenter;',
    '  if (uTip.w > 0.5){',
    '    sdT = sdRBox(P.xy - uTip.xy, vec2(uTip.z), uTip.z*0.2);',
    '    mH = 1.0 - smoothstep(-0.35*uTip.z, 0.3*uTip.z, sdT);',
    '    mC = 1.0 - smoothstep(-0.03*uTip.z, 0.05*uTip.z, sdT);',
    '    rc = uTip.xy;',
    '  } else { mH = 0.82 + 0.18*vnoise(S*0.08 + 2.0); }',
    '  vec2 rp = P.xy - rc; vec2 rp4 = rp*rp*rp*rp;',
    '  float rr = pow(rp4.x + rp4.y, 0.25);',
    '  rip = 0.5 + 0.5*sin(rr*3.4 - uTime*2.6);',
    '  float core = uTip.w > 0.5 ? 1.0 - smoothstep(0.0, uTip.z*1.15, rr) : 0.6;',
    '  float rip2 = 0.5 + 0.5*sin(rr*17.0 - uTime*9.1 + 1.3*sin(S.x*1.3 + uTime*0.9));',
    '  float heatT = heatK*mH;',
    '  float coolK = uCool*mC;',
    // RF erythema (transient) — subtle warmth of the skin under the tip
    '  alb *= mix(vec3(1.0), vec3(1.05, 0.88, 0.88), heatT*0.45);',
    '  alb *= mix(vec3(1.0), vec3(0.72, 0.6, 0.56), pore*0.5);',
    '  alb *= mix(vec3(1.0), vec3(0.93, 0.86, 0.84), (1.0 - ao)*0.5);',
    // ---- lighting ----
    '  vec3 V = -rd;',
    '  float breathe = 1.0 + 0.012*sin(uTime*1.3);',
    '  float pool = 0.5 + 0.75*smoothstep(-15.0, 12.0, dot(P.xy - uCenter, ldir)) - 0.08*smoothstep(4.0, 16.0, length(P.xy - uCenter));',
    '  vec3 keyC = vec3(1.0, 0.95, 0.88)*uKeyI*breathe*pool;',
    '  vec3 Nr = normalize(mix(Ns, Nb, 0.9)); vec3 Ng = normalize(mix(Ns, Nb, 0.62)); vec3 Nbl = normalize(mix(Ns, Nb, 0.45));',
    '  vec3 ndl = vec3(dot(Nr, L), dot(Ng, L), dot(Nbl, L));',
    '  vec3 wrap = vec3(0.45, 0.24, 0.16);',
    '  vec3 diff = clamp((ndl + wrap)/((1.0 + wrap)*(1.0 + wrap)), 0.0, 1.0);',
    '  vec3 sh3 = pow(vec3(shadowC), vec3(0.8, 0.98, 1.06))*mix(vec3(1.0), vec3(shadowF), vec3(0.28, 0.46, 0.58));',
    '  vec3 col = alb*diff*sh3*keyC;',
    // red transmission bleeding into shadowed areas (subsurface)
    '  col += alb*vec3(1.0, 0.55, 0.45)*0.04*uKeyI*(1.0 - shadow)*clamp(ndl.r + 0.5, 0.0, 1.0)*(0.35 + 0.65*ao);',
    // cool fill from the opposite side + sky ambient
    '  vec3 Lf = normalize(vec3(-L.xy, 0.9));',
    '  col += alb*clamp((dot(Nb, Lf) + 0.3)/1.3, 0.0, 1.0)*vec3(0.62, 0.68, 0.85)*0.16*ao;',
    '  col += alb*(0.55 + 0.45*Nb.z)*vec3(0.55, 0.52, 0.56)*0.12*ao*ao;',
    // sebum specular (two lobes + fresnel)
    '  vec3 Hh = normalize(L + V);',
    '  float nh = max(dot(Ns, Hh), 0.0); float nl = max(dot(Ns, L), 0.0); float nv = max(dot(Ns, V), 0.05); float vh = max(dot(V, Hh), 0.0);',
    '  float F = 0.04 + 0.96*pow(1.0 - vh, 5.0);',
    '  float oil = smoothstep(0.3, 0.8, vnoise(S*0.13 + 17.0));',
    '  float kv = 0.25; float G = (nl/(nl*(1.0 - kv) + kv))*(nv/(nv*(1.0 - kv) + kv));',
    // stratum-corneum micro facets: jittered normal for the tight lobe -> sparse glints
    '  vec2 gc = floor(S/0.035); float gfade = clamp((0.035/fp - 1.2)/1.5, 0.0, 1.0);',
    '  vec2 gj = (hash22(gc + 3.9) - 0.5)*0.9*gfade;',
    '  vec3 Ng2 = normalize(Ns + vec3(gj, 0.0));',
    '  float nh2 = max(dot(Ng2, Hh), 0.0);',
    '  float spec = (ggx(nh, 0.42)*0.8 + ggx(nh2, 0.12)*0.5*(0.35 + 0.65*oil))*G*F/(4.0*nv*max(nl, 0.05) + 1e-3)*nl*5.0;',
    '  spec *= shadow*ao*ao*(1.0 - pore*0.8)*mix(0.7, 1.35, oil);',
    '  vec3 specC = mix(vec3(1.0, 0.97, 0.93), vec3(0.62, 0.86, 1.0), coolK*0.8);',
    '  col += specC*spec*keyC;',
    // soft studio-softbox reflection (overhead, slightly behind the key): the thin sebum film
    // picks it up on plateau tops and slopes facing it -> moist sheen instead of matte clay
    '  vec3 Rr = reflect(-V, Ns);',
    '  vec3 boxD = normalize(vec3(ldir*0.5, 1.0));',
    '  float box = smoothstep(0.955, 0.997, dot(Rr, boxD));',
    '  float Fv = 0.04 + 0.96*pow(1.0 - nv, 5.0);',
    '  col += specC*box*Fv*(0.5 + 1.0*oil)*ao*1.6*(1.0 - pore*0.8);',
    // vellus hairs (translucent, Kajiya-Kay glint) + their tiny cast shadows
    '  float hsh = TEXLOD(uH, uvOf(P.xy - ldir*(0.045/max(tanE, 0.12))), L0).a;',
    '  col *= 1.0 - 0.3*hsh*(1.0 - hairA);',
    '  {',
    '    vec3 T = normalize(vec3(cos(-2.0), sin(-2.0), 0.35));',
    '    float th = dot(T, Hh); float kk = pow(sqrt(max(1.0 - th*th, 0.0)), 70.0);',
    '    float hd = 0.5 + 0.5*sqrt(max(1.0 - dot(T, L)*dot(T, L), 0.0));',
    '    vec3 hc = vec3(0.86, 0.72, 0.56)*hd*keyC*0.55 + vec3(1.0, 0.94, 0.86)*kk*keyC*0.35 + vec3(0.8, 0.45, 0.3)*0.06;',
    '    col = mix(col, hc, hairA*0.6);',
    '  }',
    // ---- RF heat: glow from beneath, leaking through the thinner furrows ----
    '  if (heatK > 0.001){',
    '    float thin = clamp(1.0 - ao, 0.0, 1.0);',
    '    float surf = mix(1.0, 0.28, coolK);',
    // backlit ember: the epidermis stops reading as a pale reflector and becomes a warm
    // diffuser over the heated dermis (plateau under the tip, hotter core, soft diffusion
    // halo past the edge); the relief stays legible because the glow is shaded by it
    '    float T = heatT*(0.7 + 0.3*core)*(1.0 + 0.05*(rip - 0.5));',
    '    float Ts = max(T - 0.25*coolK*heatT, 0.0);',
    '    float relief = clamp(0.62 + 0.55*(ndl.g - 0.25), 0.35, 1.2)*(0.5 + 0.5*ao);',
    '    vec3 gDeep = pow(heatLUT(0.26 + 0.7*T), vec3(2.2));',
    '    vec3 gSurf = pow(heatLUT(0.36 + 0.64*Ts), vec3(2.2));',
    '    col *= 1.0 - 0.6*smoothstep(0.0, 0.85, T);',
    '    col += gDeep*pow(T, 1.2)*1.05*relief;',
    '    col += gSurf*pow(Ts, 1.3)*(1.6*thin + 0.7*pore)*surf*1.5;',
    '  }',
    // ---- cryogen: cool sheen, rime in the furrows, pinpoint frost glints ----
    '  if (coolK > 0.001){',
    '    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));',
    // cooled epidermis: a cool cast on the reflected light only where no ember shows through
    // (cyan over the orange glow would read as milky lilac plastic)
    '    float coolTint = coolK*(1.0 - 0.85*smoothstep(0.05, 0.5, heatT));',
    '    col = mix(col, lum*vec3(0.92, 0.98, 1.06), coolTint*0.03);',
    '    col *= mix(vec3(1.0), vec3(0.985, 1.0, 1.02), coolTint);',
    '    float fres = pow(1.0 - max(dot(Nb, V), 0.0), 2.0);',
    '    float gloss = pow(max(dot(Ns, Hh), 0.0), 24.0)*shadow;',
    '    col += vec3(0.3, 0.62, 1.0)*(0.01 + 0.4*fres)*coolK*0.12*uKeyI + vec3(0.55, 0.85, 1.0)*gloss*coolK*0.32*uKeyI;',
    '    if (uTip.w > 0.5) col += vec3(0.16, 0.6, 1.0)*(exp(-abs(sdT)/(0.06*uTip.z))*0.12 + exp(-abs(sdT)/(fp*uDpr*3.0))*0.5)*step(sdT, 0.0)*coolK*uKeyI;',
    '    vec2 fg = S/0.11; vec2 fc = floor(fg); vec2 ff = fg - fc; float best = 8.0; float best2 = 8.0; vec2 bid = vec2(0.0); vec2 bro = vec2(0.0);',
    '    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){',
    '      vec2 g = vec2(float(i), float(j)); vec2 r = g + hash22(fc + g + 1.7) - ff; float d = dot(r, r);',
    '      if (d < best){ best2 = best; best = d; bid = fc + g; bro = r; } else if (d < best2){ best2 = d; } }',
    '    float facet = smoothstep(0.0, 0.25, sqrt(best2) - sqrt(best));',
    '    float rime = coolK*smoothstep(0.35, 0.7, 1.0 - ao)*(0.45 + 0.55*vnoise(S*3.0 + 2.0));',
    '    vec3 ice = vec3(0.8, 0.9, 1.0)*(0.5 + 0.42*uKeyI*diff.b)*(0.8 + 0.2*facet);',
    '    col = mix(col, ice, rime*0.22);',
    '    vec2 hv = hash22(bid + 9.9);',
    '    vec3 fn = normalize(vec3((hv - 0.5)*1.2 + 0.1*vec2(sin(uTime*0.9 + hv.x*6.28), cos(uTime*0.7 + hv.y*6.28)), 1.0));',
    '    float pr = max(0.12, fp*0.9/0.11);',
    '    vec2 ar = abs(bro)/pr;',
    '    float star = exp(-dot(ar, ar)*1.5) + 0.5*exp(-(ar.x*ar.x*30.0 + ar.y*2.0)) + 0.5*exp(-(ar.y*ar.y*30.0 + ar.x*2.0));',
    '    float sp = pow(max(dot(fn, Hh), 0.0), 160.0)*step(hash12(bid + 4.4), 0.14)*(0.12/pr)*(0.12/pr);',
    // frost glints are pinpoints: fade them out once a glint cell (0.11 mm) nears the pixel
    // footprint, otherwise the blurred glints turn into a milky haze over the whole footprint
    '    float glintFade = clamp(0.028/fp - 0.35, 0.0, 1.0);',
    '    col += vec3(0.85, 0.95, 1.0)*star*sp*coolK*uKeyI*12.0*(0.4 + 0.6*shadow)*(0.35 + 0.65*rime/max(coolK, 1e-3))*glintFade;',
    '  }',
    // ---- treatment tip footprint (gold edge) ----
    '  float pxmm = fp*uDpr;',
    '  if (uTip.w > 0.5){',
    '    float ad = abs(sdT);',
    '    float lw = 0.55*pxmm;',
    '    float edge = 1.0 - smoothstep(lw, lw + fp*1.2, ad);',
    '    float glowE = exp(-ad/(pxmm*9.0));',
    '    col *= 1.0 - 0.08*smoothstep(-pxmm*10.0, 0.0, sdT)*step(sdT, 0.0);',
    '    vec3 rimC = mix(vec3(1.0, 0.83, 0.62), vec3(0.72, 0.9, 1.0), clamp(coolK*1.2 - heatT*0.35, 0.0, 1.0));',
    '    vec3 glowC = mix(vec3(1.0, 0.55, 0.3), vec3(0.45, 0.8, 1.0), clamp(coolK*1.2 - heatT*0.35, 0.0, 1.0));',
    '    if (uMode < 0.5) col = mix(col, rimC*1.45, edge*0.72) + glowC*glowE*(0.05 + 0.08*max(heatT, coolK));',
    '  }',
    '  vec3 outc;',
    '  if (uMode < 0.5){',
    '    col *= uExposure*1.0;',
    '    outc = clamp((col*(2.51*col + 0.03))/(col*(2.43*col + 0.59) + 0.14), 0.0, 1.0);',
    '    outc = pow(outc, vec3(1.0/2.2));',
    '  } else {',
    // ---- thermal camera palette of the same heightfield ----
    '    float rel = clamp((dot(Nb, L) + 0.35)/1.35, 0.0, 1.0)*mix(0.6, 1.0, shadow);',
    '    float thin = 1.0 - ao;',
    '    float T0 = 0.1 + 0.2*rel - 0.1*thin;',
    '    float hot0 = heatT*(0.62 + 0.22*core);',
    '    float hot = hot0 + heatT*(0.03*(rip - 0.5)*2.0 + 0.015*(rip2 - 0.5)*2.0);',
    '    float Tsm = hot*(1.0 - 0.28*coolK) - 0.16*coolK*(1.0 - heatT);',
    '    float Tiso = hot0*(1.0 - 0.28*coolK);',
    '    float T = clamp(T0 + Tsm + 0.2*hot*thin, 0.0, 1.0);',
    '    outc = heatLUT(T);',
    '    outc *= 0.82 + 0.3*clamp(dot(Ns, L)*1.2 + 0.2, 0.0, 1.0);',
    '    outc = mix(outc, vec3(0.5, 0.83, 1.0)*0.55, coolK*(1.0 - heatT)*0.35);',
    '#ifdef HAS_DERIV',
    '    float fw = max(fwidth(Tiso), 1e-4);',
    '    float iso = abs(fract(Tiso*10.0 + 0.5) - 0.5)/10.0;',
    '    outc += vec3(1.0, 0.96, 0.9)*(1.0 - smoothstep(0.0, fw*1.5, iso))*0.14*smoothstep(0.08, 0.2, Tiso);',
    '#endif',
    '    if (uTip.w > 0.5){ float ad = abs(sdT); float edge = 1.0 - smoothstep(0.6*pxmm, 0.6*pxmm + fp*1.2, ad);',
    '      outc = mix(outc, vec3(0.5, 0.83, 1.0), edge*0.85) + vec3(0.5, 0.83, 1.0)*exp(-ad/(pxmm*8.0))*0.06; }',
    '  }',
    // ---- camera finish: vignette, split tone, grain ----
    '  vec2 vv = (suv - 0.5)*vec2(aspect, 1.0);',
    '  float vig = 1.0 - uVig*0.42*smoothstep(0.3, 1.15, length(vv)*1.15);',
    '  outc *= vig;',
    '  float luma = dot(outc, vec3(0.2126, 0.7152, 0.0722));',
    '  outc += vec3(0.012, 0.005, 0.02)*(1.0 - luma)*(1.0 - luma)*uVig;',
    '  float fr = floor(uTime*24.0);',
    '  float gn = hash12(frag + vec2(mod(fr*17.31, 311.0), mod(fr*7.77, 293.0))) + hash12(frag*1.31 + 5.7 + mod(fr, 97.0)) - 1.0;',
    '  outc += gn*0.022*uGrain*(0.35 + 0.65*(1.0 - abs(luma*2.0 - 1.0)));',
    // ---- split divider ----
    '  if (uSplitPx >= 0.0){',
    '    float dx = abs(frag.x - uSplitPx);',
    '    vec2 hc = vec2(uSplitPx, uRes.y*0.5);',
    '    vec2 hp = (frag - hc)/uDpr;',
    '    float dh = length(hp);',
    '    float R = 17.0;',
    '    float disc = 1.0 - smoothstep(R - 0.8, R + 0.8, dh);',
    '    float ring = 1.0 - smoothstep(0.6, 1.5, abs(dh - R));',
    '    float line = (1.0 - smoothstep(0.55*uDpr, 1.35*uDpr, dx))*(1.0 - disc);',
    '    float glow = exp(-dx/(9.0*uDpr))*0.16 + exp(-max(dh - R, 0.0)/10.0)*0.22;',
    '    outc = mix(outc, outc*0.35 + vec3(0.03, 0.02, 0.06), disc*0.75);',
    '    outc += vec3(0.26, 0.9, 0.66)*glow*0.5 + vec3(0.54, 0.36, 0.94)*glow*0.35;',
    '    float ax = abs(hp.x);',
    '    float arrow = 1.0 - smoothstep(-0.6, 0.6, max(abs(hp.y) - (10.5 - ax)*0.72, 4.5 - ax));',
    '    outc = mix(outc, vec3(1.0), clamp(max(line, ring) + arrow*disc, 0.0, 1.0)*0.92);',
    '  }',
    '  gl_FragColor = vec4(clamp(outc, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  // ---- helpers ----------------------------------------------------------------
  function num(v, d) { return typeof v === 'number' && v === v ? v : d; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function create(canvas, opts) {
    opts = opts || {};
    if (!canvas || !canvas.getContext) return null;
    var attrs = {
      alpha: false, depth: false, stencil: false, antialias: false, premultipliedAlpha: false,
      preserveDrawingBuffer: !!opts.preserveDrawingBuffer, powerPreference: 'high-performance'
    };
    var gl = null, gl2 = false;
    if (!opts.forceWebGL1) {
      try { gl = canvas.getContext('webgl2', attrs); gl2 = !!gl; } catch (e) { gl = null; }
    }
    if (!gl) {
      try { gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs); } catch (e2) { gl = null; }
    }
    if (!gl) return null;

    var seed = Math.floor(num(opts.seed, 1));
    var seedOffX = ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1 * 400.0;
    var seedOffY = ((Math.sin(seed * 78.233) * 12543.1127) % 1 + 1) % 1 * 400.0;
    var seedK = ((seed * 0.6180339887) % 1) * 997.0;
    var dprOpt = opts.dpr;
    var hsOpt = opts.heightScale;

    // programs, uniforms, targets
    var P_ST = null, P_MT = null, P_CB = null, P_SH = null, vbo = null;
    var U_ST = {}, U_MT = {}, U_CB = {}, U_SH = {};
    var tSt = null, fSt = null, tMt = null, fMt = null, tH = null, fH = null;
    var fw = 0, fh = 0, mw = 0, mh = 0, maxLod = 0, derivOK = gl2, lost = false;
    var viewKey = new Float64Array(10), viewCur = new Float64Array(10);
    var geoKey = new Float64Array(6), geoCur = new Float64Array(6);
    var viewValid = false, geoValid = false;

    function prelude(isFrag) {
      if (gl2) {
        return '#version 300 es\nprecision highp float;\n' + (isFrag
          ? 'out vec4 fragColor_;\n#define gl_FragColor fragColor_\n#define texture2D texture\n#define TEXLOD(s,uv,l) textureLod(s,uv,l)\n#define HAS_DERIV 1\n'
          : '#define attribute in\n');
      }
      var s = '';
      if (isFrag && derivOK) s += '#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIV 1\n';
      s += '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
      if (isFrag) s += '#define TEXLOD(s,uv,l) texture2D(s,uv)\n';
      return s;
    }
    function compile(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) {
        var log = gl.getShaderInfoLog(sh);
        gl.deleteShader(sh);
        throw new Error('SkinFX.Surface shader: ' + log);
      }
      return sh;
    }
    function program(fsBody) {
      var vs = compile(gl.VERTEX_SHADER, prelude(false) + 'attribute vec2 aPos;\nvoid main(){ gl_Position = vec4(aPos, 0.0, 1.0); }');
      var fs = compile(gl.FRAGMENT_SHADER, prelude(true) + GLSL_COMMON + '\n' + fsBody);
      var p = gl.createProgram();
      gl.attachShader(p, vs); gl.attachShader(p, fs);
      gl.bindAttribLocation(p, 0, 'aPos');
      gl.linkProgram(p);
      gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) {
        throw new Error('SkinFX.Surface link: ' + gl.getProgramInfoLog(p));
      }
      return p;
    }
    function locs(p, names, out) {
      for (var i = 0; i < names.length; i++) out[names[i]] = gl.getUniformLocation(p, names[i]);
    }
    var COMMON_U = ['uCamPos', 'uCamR', 'uCamU', 'uCamF', 'uTan', 'uMargin', 'uSeedOff', 'uSeedK'];

    function target(filter) {
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter === gl.NEAREST ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    function attach(fb, t, w, h, mips) {
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      if (mips) gl.generateMipmap(gl.TEXTURE_2D);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    function init() {
      if (!gl2) derivOK = !!gl.getExtension('OES_standard_derivatives');
      P_ST = program(FS_STATIC);
      P_MT = program(FS_MATERIAL);
      P_CB = program(FS_COMBINE);
      P_SH = program(FS_SHADE);
      locs(P_ST, COMMON_U.concat(['uFbo', 'uPixAng']), U_ST);
      locs(P_MT, COMMON_U.concat(['uFbo']), U_MT);
      locs(P_CB, COMMON_U.concat(['uStatic', 'uFbo', 'uWT', 'uWTb', 'uSplitNdc']), U_CB);
      locs(P_SH, COMMON_U.concat(['uH', 'uMat', 'uRes', 'uFbo', 'uRelief', 'uSteps', 'uHTop', 'uHBot', 'uL', 'uKeyI',
        'uTime', 'uHeat', 'uCool', 'uMode', 'uExposure', 'uGrain', 'uVig', 'uTip', 'uCenter', 'uSplitPx', 'uDpr',
        'uFocus', 'uDof', 'uMaxLod', 'uPixAng']), U_SH);
      vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      tSt = target(gl.NEAREST); fSt = gl.createFramebuffer();
      tMt = target(gl.LINEAR); fMt = gl.createFramebuffer();
      tH = target(gl2 ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR); fH = gl.createFramebuffer();
      fw = fh = 0;
      viewValid = geoValid = false;
    }

    function allocTargets(w, h) {
      if (w === fw && h === fh) return;
      fw = w; fh = h;
      mw = Math.max(2, Math.round(w / 2)); mh = Math.max(2, Math.round(h / 2));
      attach(fSt, tSt, w, h, false);
      attach(fMt, tMt, mw, mh, false);
      attach(fH, tH, w, h, gl2);
      maxLod = gl2 ? Math.floor(Math.log(Math.max(w, h)) / Math.LN2) : 0;
      viewValid = geoValid = false;
    }

    var state = { dpr: clamp(num(dprOpt, Math.min(root.devicePixelRatio || 1, DEFAULT_DPR)), 0.5, MAX_DPR) };

    function resize(cssW, cssH) {
      var dpr = clamp(num(dprOpt, Math.min(root.devicePixelRatio || 1, DEFAULT_DPR)), 0.5, MAX_DPR);
      var cw = num(cssW, canvas.clientWidth || 300), ch = num(cssH, canvas.clientHeight || 150);
      var w = Math.max(1, Math.round(cw * dpr));
      var h = Math.max(1, Math.round(ch * dpr));
      if (w * h > MAX_PIXELS) { var k = Math.sqrt(MAX_PIXELS / (w * h)); w = Math.round(w * k); h = Math.round(h * k); }
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      state.dpr = w / Math.max(1, cw);
      viewValid = geoValid = false;
    }

    function onLost(e) { e.preventDefault(); lost = true; }
    function onRestored() {
      lost = false;
      try { init(); } catch (err) { lost = true; if (root.console) console.warn(err); }
    }
    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);

    try { init(); } catch (err) {
      if (root.console) console.warn(err);
      canvas.removeEventListener('webglcontextlost', onLost, false);
      canvas.removeEventListener('webglcontextrestored', onRestored, false);
      return null;
    }

    var EMPTY = {};
    var camPos = new Float64Array(3), camF = new Float64Array(3), camU = new Float64Array(3);
    var tanXv = 1;
    function setCommon(U) {
      gl.uniform3f(U.uCamPos, camPos[0], camPos[1], camPos[2]);
      gl.uniform3f(U.uCamR, 1, 0, 0);
      gl.uniform3f(U.uCamU, 0, camU[1], camU[2]);
      gl.uniform3f(U.uCamF, 0, camF[1], camF[2]);
      gl.uniform2f(U.uTan, tanXv, TAN_F);
      gl.uniform1f(U.uMargin, MARGIN);
      gl.uniform2f(U.uSeedOff, seedOffX, seedOffY);
      gl.uniform1f(U.uSeedK, seedK);
    }
    function changed(key, cur, n) {
      for (var i = 0; i < n; i++) if (key[i] !== cur[i]) { for (var j = 0; j < n; j++) key[j] = cur[j]; return true; }
      return false;
    }

    function render(p) {
      if (lost || !gl) return;
      p = p || EMPTY;
      if (canvas.width < 2 || canvas.height < 2) return;
      var W = canvas.width, H = canvas.height;
      var hsc = clamp(num(hsOpt, 1.25 / state.dpr), 0.4, 1);
      allocTargets(Math.max(2, Math.round(W * (1 + MARGIN) * hsc)), Math.max(2, Math.round(H * (1 + MARGIN) * hsc)));

      var D = DEFAULTS;
      var time = num(p.time, 0);
      var wr = clamp(num(p.wrinkle, D.wrinkle), 0, 1);
      var tx = clamp(num(p.texture, D.texture), 0, 1);
      var bf = p.before || D.before;
      var bwr = clamp(num(bf.wrinkle, 1), 0, 1), btx = clamp(num(bf.texture, 1), 0, 1);
      var heat = clamp(num(p.heat, 0), 0, 1), cool = clamp(num(p.cool, 0), 0, 1);
      var split = num(p.split, -1);
      var splitOn = split >= 0 && split <= 1;
      var az = num(p.light, D.light);
      var el = clamp(num(p.elevation, D.elevation), 0, 1);
      var tilt = clamp(num(p.tilt, D.tilt), 0, 1);
      var zoom = clamp(num(p.zoom, 1), 0.5, 2);
      var pan = p.pan || D.pan;
      var panX = num(pan.x, 0), panY = num(pan.y, 0);
      var thermal = p.mode === 'thermal' ? 1 : 0;
      var aspect = W / H;

      // camera (mm, skin plane z = 0, y up)
      var th = tilt * MAX_TILT, sn = Math.sin(th), cs = Math.cos(th);
      var dist = (VIEW_MM * 0.5) / (zoom * TAN_F);
      var tgx = panX * VIEW_MM, tgy = -panY * VIEW_MM;
      camF[0] = 0; camF[1] = sn; camF[2] = -cs;
      camU[0] = 0; camU[1] = cs; camU[2] = sn;
      camPos[0] = tgx; camPos[1] = tgy - dist * sn; camPos[2] = dist * cs;
      tanXv = TAN_F * aspect;

      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);

      // ---- A1/A2: static micro relief + pigment (only when the view changes) ----
      viewCur[0] = fw; viewCur[1] = fh; viewCur[2] = tilt; viewCur[3] = zoom; viewCur[4] = panX;
      viewCur[5] = panY; viewCur[6] = W; viewCur[7] = H;
      var viewDirty = changed(viewKey, viewCur, 8) || !viewValid;
      if (viewDirty) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fSt);
        gl.viewport(0, 0, fw, fh);
        gl.useProgram(P_ST);
        setCommon(U_ST);
        gl.uniform2f(U_ST.uFbo, fw, fh);
        gl.uniform1f(U_ST.uPixAng, (2 * TAN_F * (1 + MARGIN)) / fh);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fMt);
        gl.viewport(0, 0, mw, mh);
        gl.useProgram(P_MT);
        setCommon(U_MT);
        gl.uniform2f(U_MT.uFbo, mw, mh);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        viewValid = true;
      }

      // ---- A3: combine macro + wrinkles + texture (when wrinkle/texture/split change) ----
      geoCur[0] = wr; geoCur[1] = tx; geoCur[2] = splitOn ? bwr : -1; geoCur[3] = splitOn ? btx : -1;
      geoCur[4] = splitOn ? split : -1;
      if (changed(geoKey, geoCur, 5) || viewDirty || !geoValid) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fH);
        gl.viewport(0, 0, fw, fh);
        gl.useProgram(P_CB);
        setCommon(U_CB);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tSt);
        gl.uniform1i(U_CB.uStatic, 0);
        gl.uniform2f(U_CB.uFbo, fw, fh);
        gl.uniform2f(U_CB.uWT, wr, tx);
        gl.uniform2f(U_CB.uWTb, splitOn ? bwr : wr, splitOn ? btx : tx);
        gl.uniform1f(U_CB.uSplitNdc, splitOn ? split * 2 - 1 : -9);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (gl2) { gl.bindTexture(gl.TEXTURE_2D, tH); gl.generateMipmap(gl.TEXTURE_2D); }
        geoValid = true;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      // ---- B: shade ----
      gl.viewport(0, 0, W, H);
      gl.useProgram(P_SH);
      setCommon(U_SH);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tH);
      gl.uniform1i(U_SH.uH, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, tMt);
      gl.uniform1i(U_SH.uMat, 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform2f(U_SH.uRes, W, H);
      gl.uniform2f(U_SH.uFbo, fw, fh);
      gl.uniform1f(U_SH.uRelief, RELIEF);
      gl.uniform1f(U_SH.uSteps, tilt > 0.04 ? Math.round(6 + tilt * 20) : 0);
      gl.uniform1f(U_SH.uHTop, 0.3 * RELIEF);
      gl.uniform1f(U_SH.uHBot, -0.8 * RELIEF);
      var ea = 0.12 + el * 1.23, ce = Math.cos(ea); // 7° (raking) .. 77°
      gl.uniform3f(U_SH.uL, Math.cos(az) * ce, Math.sin(az) * ce, Math.sin(ea));
      gl.uniform1f(U_SH.uKeyI, (2.1 / (0.3 + Math.sin(ea))) * 0.62);
      gl.uniform1f(U_SH.uTime, time);
      gl.uniform1f(U_SH.uHeat, heat);
      gl.uniform1f(U_SH.uCool, cool);
      gl.uniform1f(U_SH.uMode, thermal);
      gl.uniform1f(U_SH.uExposure, num(p.exposure, 1));
      gl.uniform1f(U_SH.uGrain, clamp(num(p.grain, 1), 0, 2));
      gl.uniform1f(U_SH.uVig, clamp(num(p.vignette, 1), 0, 2));
      var tip = p.tip;
      if (tip && typeof tip === 'object') {
        gl.uniform4f(U_SH.uTip, (num(tip.x, 0.5) - 0.5) * aspect * VIEW_MM, (0.5 - num(tip.y, 0.5)) * VIEW_MM,
          Math.max(0.01, num(tip.r, 0.3)) * VIEW_MM, 1);
      } else {
        gl.uniform4f(U_SH.uTip, 0, 0, 1, 0);
      }
      gl.uniform2f(U_SH.uCenter, tgx, tgy);
      gl.uniform1f(U_SH.uSplitPx, splitOn ? split * W : -1);
      gl.uniform1f(U_SH.uDpr, state.dpr);
      gl.uniform1f(U_SH.uFocus, dist * (1 - 0.12 * tilt));
      gl.uniform1f(U_SH.uDof, gl2 ? clamp(tilt * 1.4, 0, 1) : 0);
      gl.uniform1f(U_SH.uMaxLod, maxLod);
      gl.uniform1f(U_SH.uPixAng, (2 * TAN_F) / H);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function dispose() {
      canvas.removeEventListener('webglcontextlost', onLost, false);
      canvas.removeEventListener('webglcontextrestored', onRestored, false);
      if (!gl) return;
      if (!gl.isContextLost()) {
        gl.deleteProgram(P_ST); gl.deleteProgram(P_MT); gl.deleteProgram(P_CB); gl.deleteProgram(P_SH);
        gl.deleteBuffer(vbo);
        gl.deleteTexture(tSt); gl.deleteTexture(tMt); gl.deleteTexture(tH);
        gl.deleteFramebuffer(fSt); gl.deleteFramebuffer(fMt); gl.deleteFramebuffer(fH);
      }
      P_ST = P_MT = P_CB = P_SH = vbo = tSt = tMt = tH = fSt = fMt = fH = null;
      lost = true;
    }

    // initial size from layout if the caller hasn't sized the canvas yet
    if (canvas.clientWidth && canvas.clientHeight && canvas.width === 300 && canvas.height === 150) {
      resize(canvas.clientWidth, canvas.clientHeight);
    }

    return { render: render, resize: resize, dispose: dispose, canvas: canvas, webgl2: gl2, gl: gl };
  }

  SkinFX.Surface = {
    create: create,
    defaults: DEFAULTS,
    label: '模拟示意 · 基于彩页组织学与临床资料的原理可视化，不代表个体实际效果',
    version: '1.0.0'
  };
})(typeof window !== 'undefined' ? window : this);
