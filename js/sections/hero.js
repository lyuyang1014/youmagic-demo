// HERO — cinematic opener.
// Layers (back → front): CSS-3D corridor of outlined words · ONE WebGL canvas (mount3D) that draws
//   ① the RF field (source/sink field lines, equipotential rings, dust) as a screen-blended background pass,
//   ② the procedural YM5 console (ym3d/device.mjs) standing in the corridor: slow turntable sweep, mouse
//      parallax, drag-to-rotate, violet rim light, contact + key-light shadow and a planar floor reflection,
//      touchscreen 'logo' → 'treatment' (IFU 图8 reference values), holstered handpiece glows / frosts in the
//      IFU three-phase rhythm (治疗前冷却 → 射频传送 → 治疗后冷却, IFU p.15 §7.6)
// · copy. Scroll-out (pinned on desktop): the camera dollies onto the touchscreen while the corridor flies through.
import * as THREE from 'three';
import * as S from '../ym3d/stage.mjs';
import { mount3D } from '../ym3d/host.mjs';
import { createDevice } from '../ym3d/device.mjs';
// Integration QA — scroll jank: the first frame of a freshly built view compiled every shader synchronously
// (≈100–220 ms freeze mid-scroll). Views are built well before they enter the viewport, so start a parallel
// (KHR_parallel_shader_compile) compile right after build(); by the first on-screen frame the programs are ready.
const precompileLib = (lib) => ({
  ...lib,
  createStage(T, canvas, opts) {
    const st = lib.createStage(T, canvas, opts);
    queueMicrotask(() => { try { st.renderer.compileAsync(st.scene, st.camera).catch(() => {}); } catch (e) { /* lost context */ } });
    return st;
  },
});

// host.mjs workaround (library issue): mount3D rebuilds on the SAME canvas after destroy() called
// forceContextLoss(), so the second build fails ("WebGL unavailable", lost context) and the fallback fires.
// Re-mount on a fresh canvas right after each far-away dispose; pointer listeners live on the container.
function mountFresh(container, opts) {
  const h = { m: null, get canvas() { return h.m?.canvas; }, get state() { return h.m?.state; }, invalidate() { h.m?.invalidate(); } };
  const make = () => {
    const m = mount3D(container, {
      ...opts,
      dispose(s) { opts.dispose?.(s); setTimeout(() => { if (h.m === m) { m.destroy(); make(); } }, 0); },
    });
    h.m = m;
  };
  make();
  return h;
}

const IMG = 'assets/img/device.webp'; // no-WebGL fallback + layout box for the 3D console
const IMG_W = 496;
const IMG_H = 1186;

// giant outlined words of the corridor (brochure cover motif — compliant wording only)
const BACK_ROWS = [
  ['HIGH ENERGY', 'g', 150],
  ['MONOPOLAR RF', 'v', 170],
  ['6.78 MHz', 'g', 130],
  ['SINCE 1995', 'v', 160],
  ['YOUMAGIC', 'g', 140],
];
const FLOOR_WORDS = ['YOUMAGIC', 'MONOPOLAR RF', '6.78 MHz'];

// pulse rhythm used by the field (seconds) — purely illustrative timing
const CYCLE = 5.2;
const PH = { pre: [0.0, 0.8], rf: [0.8, 2.1], post: [2.1, 2.9] };

// 3D framing
const DEV_H = 1.285; // console height (IFU 1285 mm)
const FOV = 24;
const EL = 0.1; // camera elevation (rad)
const TT_BASE = -0.42; // resting 3/4 view (handpiece side towards the viewer)

const FIELD_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform vec2 uSrc;
uniform vec2 uSnk;
uniform float uTime;
uniform float uIntro;
uniform float uOut;
uniform float uPx;
uniform float uRF;
uniform float uCool;
uniform float uBurst;
uniform float uGain;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  vec2 px = vUv * uRes;
  float S = min(uRes.x, uRes.y);
  vec2 q = px / S;
  vec2 wv = vec2(noise(q * 2.0 + vec2(uTime * 0.035, 1.7)), noise(q * 2.0 + vec2(4.3, -uTime * 0.03))) - 0.5;
  vec2 p = px + wv * S * 0.045;

  vec2 a = (p - uSrc) / S;
  vec2 b = (p - uSnk) / S;
  float ra2 = dot(a, a) + 1e-6;
  float rb2 = dot(b, b) + 1e-6;
  float ra = sqrt(ra2);
  float rb = sqrt(rb2);
  float psi = atan(a.y, a.x) - atan(b.y, b.x);       // stream function → field lines
  float phi = 0.5 * log(ra2 / rb2);                   // potential → equipotential rings
  float gm = length(a / ra2 - b / rb2) / S + 1e-6;   // |grad| per pixel (same for psi and phi)

  float spd = uTime * (1.0 + uOut * 2.5);
  float lw = 0.55 * uPx;

  // field lines + energy packets travelling source → sink
  const float N = 32.0;
  float k = N / 6.2831853;
  float fl = psi * k;
  float f = fract(fl);
  float spacing = 1.0 / (k * gm);
  float d = min(f, 1.0 - f) * spacing;
  float line = (1.0 - smoothstep(lw, lw + 1.25 * uPx, d)) * smoothstep(2.0 * uPx, 7.0 * uPx, spacing);
  float lid = mod(floor(fl + 0.5), N);
  float h = hash(vec2(lid, 7.0));
  float pk = pow(0.5 + 0.5 * cos(phi * 2.2 - spd * (0.9 + h * 0.8) + h * 6.2831), 16.0);
  float lineI = line * (0.09 + 0.75 * pk * (0.5 + uRF));

  // equipotential rings expanding from the source
  const float M = 2.6;
  float spR = 1.0 / (M * gm);
  float fr = fract(phi * M - spd * 0.35);
  float dr = min(fr, 1.0 - fr) * spR;
  float ring = (1.0 - smoothstep(lw, lw + 1.6 * uPx, dr)) * smoothstep(3.0 * uPx, 12.0 * uPx, spR);
  ring *= 1.0 - smoothstep(-2.2, 0.3, phi);
  float ringI = ring * (0.16 + 0.5 * uRF + 0.4 * uCool);

  float glow = exp(-ra * 10.0) * (0.3 + 0.7 * uRF) + exp(-ra * 2.4) * 0.1;
  float sinkGlow = exp(-rb * 16.0) * 0.28;

  vec3 violet = vec3(0.541, 0.361, 0.941);
  vec3 mint = vec3(0.263, 0.902, 0.659);
  vec3 cool = vec3(0.498, 0.831, 1.0);
  vec3 lc = mix(violet, mint, smoothstep(-1.5, 1.8, phi));
  vec3 rc = mix(mix(vec3(0.86, 0.82, 1.0), violet, 0.45), cool, uCool);
  // click-fired pulse: one bright wavefront expanding from the source
  float bR = uBurst * 1.5;
  float bw = (ra - bR) * S / (14.0 * uPx);
  float burst = step(0.0001, uBurst) * exp(-bw * bw) * pow(1.0 - uBurst, 1.4);
  vec3 col = lc * lineI + rc * ringI + mix(violet, cool, uCool * 0.6) * glow + mint * sinkGlow + vec3(0.78, 0.7, 1.0) * burst * 0.85;

  vec2 uv = vUv - 0.5;
  float vig = 1.0 - smoothstep(0.32, 0.92, length(uv * vec2(1.0, 1.2)));
  // top / bottom veil (the field now sits above the DOM veil, in the same canvas as the console)
  float veil = mix(0.22, 1.0, smoothstep(1.0, 0.64, vUv.y)) * mix(0.4, 1.0, smoothstep(0.0, 0.22, vUv.y));
  col *= vig * veil * uIntro * (1.0 - 0.85 * uOut) * uGain;
  col += (hash(px + fract(uTime)) - 0.5) / 255.0;
  col = max(col, 0.0);
  // premultiplied "screen": out = c + (1 - max(c)) · corridor
  gl_FragColor = vec4(col, max(col.r, max(col.g, col.b)));
}`;

const DUST_VERT = /* glsl */ `
attribute vec4 aSeed;
attribute vec3 aColor;
uniform float uTime;
uniform float uPx;
uniform float uIntro;
uniform float uRF;
varying vec3 vColor;
varying float vA;
void main() {
  vec3 p = position;
  float t = uTime * (0.04 + aSeed.w * 0.05) * 6.2831;
  p.x += sin(t + aSeed.x * 6.2831) * 0.35;
  p.z += cos(t * 0.7 + aSeed.y * 6.2831) * 0.35;
  p.y = mod(p.y + uTime * (0.05 + aSeed.z * 0.11) + 4.0, 8.0) - 4.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (0.7 + aSeed.w * 2.1) * uPx * (8.0 / -mv.z);
  float edge = 1.0 - smoothstep(3.2, 4.0, abs(p.y));
  float tw = 0.55 + 0.45 * sin(uTime * (0.8 + aSeed.x * 2.0) + aSeed.y * 20.0);
  vA = edge * tw * uIntro * (0.75 + 0.5 * uRF);
  vColor = aColor;
}`;
const DUST_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = 1.0 - smoothstep(0.0, 0.5, d);
  vec3 c = vColor * a * a * vA;
  gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
}`;

// planar floor reflection: samples the mirrored-console render target in screen space
const REFL_VERT = /* glsl */ `
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const REFL_FRAG = /* glsl */ `
uniform sampler2D tRefl;
uniform vec2 uRes;
uniform float uStrength;
varying vec3 vW;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 o = vec2(1.5) / uRes;
  vec4 c = texture2D(tRefl, uv) * 0.4
    + (texture2D(tRefl, uv + vec2(o.x, 0.0)) + texture2D(tRefl, uv - vec2(o.x, 0.0))
    +  texture2D(tRefl, uv + vec2(0.0, o.y)) + texture2D(tRefl, uv - vec2(0.0, o.y))) * 0.15;
  float r = length(vW.xz * vec2(1.0, 1.35));
  float fade = (1.0 - smoothstep(0.12, 1.45, r)) * uStrength;
  gl_FragColor = vec4(c.rgb * fade, c.a * fade);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
// violet pool of light on the corridor floor (premultiplied additive)
const POOL_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uColor2;
uniform float uI;
varying vec2 vUv;
void main() {
  vec2 d = (vUv - 0.5) * 2.0;
  float r2 = dot(d, d);
  float g = exp(-r2 * 5.5) * 0.85 + exp(-r2 * 1.6) * 0.25;
  vec3 c = mix(uColor2, uColor, exp(-r2 * 3.0)) * g * uI;
  gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
}`;

export default {
  id: 'hero',
  async init(root, ctx) {
    const { gsap, ScrollTrigger, lib, data, reduced } = ctx;
    const P = data.product;
    const isTouch = window.matchMedia('(hover: none)').matches;

    // src: 6.78 MHz ± 3% (IFU p.30) · 25–175 W, 0.5–8 档 (IFU p.9–10, p.32 表) · 4.0 cm², 900 发 (IFU p.11) · 212 例 (IFU p.32)
    const SPECS = [
      { to: 6.78, dec: 2, u: 'MHz', k: '射频工作频率 · ±3%', href: '#mechanism', viz: 'wave' },
      { to: 175, from: 25, pre: '25–', dec: 0, u: 'W', k: '输出功率 · 0.5–8 档可调', href: '#console', viz: 'bars' },
      { to: 4.0, dec: 1, u: 'cm²', k: '一次性治疗头端 · 900 发', href: '#protocol', viz: 'tip' },
      { to: data.study.n, dec: 0, u: '例', k: '多中心随机对照临床', href: '#clinical', viz: 'dots' },
    ];

    const rowHTML = ([w, c, dur], i) => {
      const seg = `<span>${w}</span><span>${w}</span><span>${w}</span>`;
      return `<div class="hero__row hero__row--${c}${i % 2 ? ' is-rev' : ''}" style="--dur:${dur}s">${seg}${seg}</div>`;
    };
    const vizHTML = (v) => {
      if (v === 'wave') return `<svg class="hero__viz hero__viz--wave" viewBox="0 0 48 22" aria-hidden="true"><path d="M0 11 ${Array.from({ length: 8 }, (_, i) => `Q ${i * 6 + 3} ${i % 2 ? 19 : 3} ${i * 6 + 6} 11`).join(' ')}"/></svg>`;
      if (v === 'bars') return `<svg class="hero__viz hero__viz--bars" viewBox="0 0 48 22" aria-hidden="true">${Array.from({ length: 16 }, (_, i) => `<rect x="${i * 3}" y="${20 - (i + 1) * 1.15}" width="1.6" height="${(i + 1) * 1.15}" rx=".4" style="--i:${i}"/>`).join('')}</svg>`;
      if (v === 'tip') return `<svg class="hero__viz hero__viz--tip" viewBox="0 0 48 22" aria-hidden="true"><rect x="15" y="1" width="20" height="20" rx="2.5"/><path d="M25 1v20M15 11h20"/></svg>`;
      return `<svg class="hero__viz hero__viz--dots" viewBox="0 0 48 22" aria-hidden="true">${[0, 1, 2, 3].map((i) => `<circle cx="${7 + i * 11.3}" cy="11" r="3.2" style="--i:${i}"/>`).join('')}</svg>`;
    };
    const fmt = (s, v) => (s.pre || '') + v.toFixed(s.dec);
    // indication in the fixed IFU wording (IFU p.4), incl. “经培训合格后使用”
    const indication = P.indication.replace(/^本产品/, '').replace('使用，', '使用，<br class="hero__br">');
    // src: mandatory notice for devices whose registration documents list contraindications (广告法 第十六条; KB §11.2-3)
    const CONTRA_NOTE = '禁忌内容或者注意事项详见说明书。';
    const hint = reduced ? '' : isTouch ? ' · 左右拖动旋转主机 · 轻点场景触发一次脉冲' : ' · 拖动主机旋转 · 移动光标场线偏转 · 点击触发一次脉冲';

    root.innerHTML = `
<div class="hero__stage">
  <div class="hero__room" aria-hidden="true">
    <div class="hero__box">
      <div class="hero__face hero__face--ceil"><i class="hero__softbox"></i></div>
      <div class="hero__face hero__face--left"></div>
      <div class="hero__face hero__face--right"></div>
      <div class="hero__face hero__face--floor">${FLOOR_WORDS.map((w, i) => `<span class="hero__fword" style="--d:${-i * 14}s">${w}</span>`).join('')}</div>
      <div class="hero__face hero__face--back"><div class="hero__rows">${BACK_ROWS.map(rowHTML).join('')}</div></div>
    </div>
  </div>
  <div class="hero__veil" aria-hidden="true"></div>

  <figure class="hero__device">
    <img class="hero__img" src="${IMG}" alt="YOUMAGIC YM5 射频皮肤治疗仪主机" width="${IMG_W}" height="${IMG_H}" decoding="async" fetchpriority="high">
  </figure>
  <div class="hero__3d" role="img" aria-label="YOUMAGIC YM5 射频皮肤治疗仪主机（三维模型）"></div>

  <header class="hero__top">
    <p class="hero__eyebrow mono"><span>${P.tech}</span><i></i><span>${P.techEn.toUpperCase()}</span></p>
    <h1 class="hero__mark" aria-label="${P.brand} ${P.tech}"><span class="hero__word">${P.wordmark}</span><sup>®</sup></h1>
  </header>

  <div class="hero__left">
    <p class="hero__tag"><span>${P.indicationShort}</span></p>
    <p class="hero__lead"><b>${P.name}</b><span>单极电容耦合射频</span><br>${indication}</p>
    <div class="hero__ctas">
      <a class="btn btn--primary" href="#mechanism">探索作用机制<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></a>
      <a class="btn" href="#clinical">查看临床数据</a>
    </div>
    <p class="hero__reg"><span class="chip"><i></i>${P.regNo}</span><span class="micro">第三类医疗器械 · ${P.name}</span></p>
    <p class="hero__pro micro">${data.disclaimers.pro}<br>${CONTRA_NOTE}</p>
  </div>

  <ul class="hero__specs" aria-label="关键参数">
    ${SPECS.map((s) => `<li class="hero__spec"><a href="${s.href}">
      <span class="hero__spec-v num"><b>${fmt(s, s.to)}</b><span class="hero__spec-u">${s.u}</span></span>
      ${vizHTML(s.viz)}
      <span class="hero__spec-k">${s.k}</span>
    </a></li>`).join('')}
    <li class="hero__src tag-src">来源：使用说明书 第 1、11、30、32 页</li>
  </ul>

  <div class="hero__foot">
    <a class="hero__cue" href="#heritage" aria-label="向下滚动"><span class="hero__cue-line"><i></i></span><span class="mono">SCROLL</span></a>
    <div class="hero__hud">
      <div class="hero__phases" aria-hidden="true">${data.pulsePhases.map((p, i) => `<span data-ph="${['pre', 'rf', 'post'][i]}">${p}</span>`).join('<b></b>')}</div>
      <p class="micro">原理示意 · 射频场与脉冲时序的艺术化呈现 · 主机为三维渲染（屏幕读数取自说明书 图8）${hint}</p>
      <p class="micro">${data.disclaimers.sim}</p>
    </div>
  </div>
</div>`;

    const $ = (s) => root.querySelector(s);
    const stage = $('.hero__stage');
    const room = $('.hero__room');
    const box = $('.hero__box');
    const device = $('.hero__device');
    const host = $('.hero__3d');
    const top = $('.hero__top');
    const left = $('.hero__left');
    const specs = $('.hero__specs');
    const foot = $('.hero__foot');
    const phases = [...root.querySelectorAll('.hero__phases span')];
    const specVals = [...root.querySelectorAll('.hero__spec-v b')];

    /* ---------- shared animated state (tweened by GSAP, read by the CSS loop and the 3D frame) ---------- */
    const st = {
      room: reduced ? 1 : 0, // corridor intro 0→1
      field: reduced ? 1 : 0, // field intro
      rise: reduced ? 0 : 1, // console reveal 1→0 (exposure ramp + spin-in + dolly)
      rim: reduced ? 1 : 0, // violet rim light flicker-on
      sweep: -1, // intro light sweep across the shell (−1 = off, 0…1)
      screenAt: reduced ? 0 : Infinity, // time the touchscreen switches logo → treatment
      out: 0, // scroll-out 0→1
      mx: 0, my: 0, tx: 0, ty: 0, // mouse (−1…1), smoothed
      mouse: false, px: 0, py: 0, // mouse in stage px
      kickAt: -1, // time of the last click-fired pulse
      rf: reduced ? 0.6 : 0, cool: 0, burst: 0, // current pulse envelope
    };
    let desktop = window.matchMedia('(min-width: 1024px)').matches;
    let tNow = reduced ? 4 : 0;

    /* ---------- layout (CSS room box) ---------- */
    const layout = () => {
      desktop = window.matchMedia('(min-width: 1024px)').matches;
      const W = room.clientWidth || window.innerWidth;
      const H = room.clientHeight || window.innerHeight;
      const pp = Math.max(900, H * 1.9);
      const rd = H * 1.45;
      const kb = pp / (pp + rd); // projected scale of the back wall
      const rw = (W * (W > H ? 0.74 : 0.86)) / kb;
      const rh = (H * 0.68) / kb;
      room.style.setProperty('--pp', pp.toFixed(0) + 'px');
      box.style.setProperty('--rw', rw.toFixed(0) + 'px');
      box.style.setProperty('--rh', rh.toFixed(0) + 'px');
      box.style.setProperty('--rd', rd.toFixed(0) + 'px');
      fitDirty = true;
      m3?.invalidate();
      apply(0);
    };

    /* ---------- per-frame DOM composition (corridor + copy parallax) ---------- */
    const apply = (dt) => {
      const o = st.out;
      const e = 1 - Math.exp(-dt * 3.2);
      st.mx += (st.tx - st.mx) * e;
      st.my += (st.ty - st.my) * e;
      // corridor: fly-in on load, fly-through on scroll, mouse parallax
      const z = -520 * (1 - st.room) + o * 760;
      box.style.transform = `translate3d(0,0,${z.toFixed(1)}px) rotateY(${(st.mx * 2.4).toFixed(3)}deg) rotateX(${(-st.my * 1.5).toFixed(3)}deg)`;
      room.style.opacity = (st.room * (1 - o * 0.75)).toFixed(3);
      host.style.opacity = (1 - lib.smooth(lib.clamp((o - 0.55) / 0.4))).toFixed(3);
      // copy parallax + dissolve
      top.style.transform = `translate3d(${(-st.mx * 6).toFixed(1)}px,${(-o * 90).toFixed(1)}px,0)`;
      top.style.opacity = Math.max(0, 1 - o * 1.7).toFixed(3);
      if (desktop) {
        left.style.transform = `translate3d(${(-st.mx * 10 - o * 60).toFixed(1)}px,calc(-38% + ${(-o * 40).toFixed(1)}px),0)`;
        specs.style.transform = `translate3d(${(-st.mx * 10 + o * 60).toFixed(1)}px,calc(-44% + ${(-o * 40).toFixed(1)}px),0)`;
        left.style.opacity = specs.style.opacity = foot.style.opacity = Math.max(0, 1 - o * 1.8).toFixed(3);
      } else {
        left.style.transform = specs.style.transform = '';
        left.style.opacity = specs.style.opacity = foot.style.opacity = '';
      }
    };

    // pulse envelope in the IFU three-phase order (illustrative timing)
    const env = (t) => {
      const c = t % CYCLE;
      const bump = ([a, b], r = 0.25) => lib.smooth(lib.clamp((c - a) / r)) * (1 - lib.smooth(lib.clamp((c - (b - r)) / r)));
      const ph = c < PH.pre[1] ? 'pre' : c < PH.rf[1] ? 'rf' : c < PH.post[1] ? 'post' : '';
      return { rf: bump(PH.rf, 0.35), cool: Math.max(bump(PH.pre), bump(PH.post)), ph };
    };

    let lastPh = '';
    const draw = (dt, t) => {
      tNow = t;
      apply(dt);
      const E = reduced ? { rf: 0.6, cool: 0, ph: '' } : env(t);
      // a click fires an extra RF pulse (wavefront + brighter packets)
      let burst = 0;
      if (st.kickAt >= 0) {
        const k = (t - st.kickAt) / 1.8;
        if (k >= 1) st.kickAt = -1;
        else { burst = k; E.rf = Math.max(E.rf, 1 - k); E.ph = 'rf'; }
      }
      st.rf = E.rf; st.cool = E.cool; st.burst = burst; st.ph = E.ph;
      if (E.ph !== lastPh) { lastPh = E.ph; phases.forEach((p) => p.classList.toggle('is-on', p.dataset.ph === E.ph)); }
      if (reduced) m3?.invalidate();
    };

    /* ================= WebGL: field + console (one context via mount3D) ================= */
    const small = !desktop || isTouch;
    let fitDirty = true;
    const fit = { r: 5, ox: 0, oy: 0, w: 0, h: 0, rect: { x: 0, y: 0, w: 1, h: 1 } };
    const drag = { on: false, id: -1, x: 0, moved: 0, az: 0, v: 0, idle: 99 };
    const _v = new THREE.Vector3(), _v2 = new THREE.Vector2(), _src = new THREE.Vector3();
    const snk = { x: 0, y: 0, init: false };
    let stillKey = '';

    // screen: brochure / IFU 图8 reference state (data.screenRef) — values straight from the source
    const R = data.screenRef;
    const SV = (status) => ({ level: R.level, cooling: R.cooling, pulse: R.pulse, shots: R.shots, shotsTotal: R.total, energyKJ: R.energyKJ, ohm: R.ohm, watt: R.watt, density: R.density, status });
    const SVS = { ready: SV('ready'), firing: SV('firing'), done: SV('done') };

    const proj = (cam, w, h, x, y, z) => { _v.set(x, y, z).project(cam); return { x: (_v.x * 0.5 + 0.5) * w, y: (-_v.y * 0.5 + 0.5) * h }; };
    function computeFit(stg, w, h) {
      const cam = stg.camera;
      const hr = host.getBoundingClientRect(), dr = device.getBoundingClientRect();
      const rect = { x: dr.left - hr.left, y: dr.top - hr.top, w: dr.width, h: dr.height };
      cam.clearViewOffset();
      let r = (h * DEV_H) / (2 * Math.tan((FOV * Math.PI) / 360) * Math.max(40, rect.h));
      for (let k = 0; k < 3; k++) {
        stg.orbit({ target: [0, DEV_H / 2, 0], radius: r, azimuth: 0, elevation: EL, fov: FOV });
        cam.updateMatrixWorld();
        const yb = proj(cam, w, h, 0, 0, 0.3).y, yt = proj(cam, w, h, 0, DEV_H, -0.1).y;
        r *= (yb - yt) / Math.max(40, rect.h * 0.97);
      }
      stg.orbit({ target: [0, DEV_H / 2, 0], radius: r, azimuth: 0, elevation: EL, fov: FOV });
      cam.updateMatrixWorld();
      const yb = proj(cam, w, h, 0, 0, 0.3).y, yt = proj(cam, w, h, 0, DEV_H, -0.1).y, cx = proj(cam, w, h, 0, DEV_H / 2, 0).x;
      Object.assign(fit, { r, ox: cx - (rect.x + rect.w / 2), oy: (yb + yt) / 2 - (rect.y + rect.h * 0.505), w, h, rect });
      fitDirty = false;
    }

    function build(stg) {
      const R3 = stg.renderer;
      R3.autoClear = false;
      R3.shadowMap.autoUpdate = false;
      stg.camera.near = 0.05; stg.camera.far = 60; stg.camera.updateProjectionMatrix();
      const { key, rim, fill } = stg.lights;
      // tight shadow frustum around the console; violet rim from behind-left, cool fill
      key.intensity = 2.0; key.position.set(2.4, 4.4, 3.4); key.target.position.set(0, 0.6, 0); stg.scene.add(key.target);
      Object.assign(key.shadow.camera, { left: -1.3, right: 1.3, top: 1.7, bottom: -0.7, near: 1, far: 12 });
      key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048); key.shadow.radius = 4; key.shadow.camera.updateProjectionMatrix();
      rim.intensity = 2.4; rim.position.set(-3.2, 2.6, -3.4);
      fill.intensity = 0.3;
      const rimR = new THREE.PointLight(S.BRAND.violet, 5, 6, 1.6); rimR.position.set(1.8, 1.6, -1.4); stg.scene.add(rimR);
      const sweepL = new THREE.PointLight(0xffffff, 0, 5, 2); sweepL.position.set(1.5, 1.0, 1.2); stg.scene.add(sweepL);

      // background passes: field (full-screen) + dust (own camera)
      const bufW = Math.max(2, R3.domElement.width), bufH = Math.max(2, R3.domElement.height);
      const dpr = R3.getPixelRatio();
      const fieldScene = new THREE.Scene();
      const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const U = {
        uRes: { value: new THREE.Vector2(bufW, bufH) }, uSrc: { value: new THREE.Vector2() }, uSnk: { value: new THREE.Vector2() },
        uTime: { value: 0 }, uIntro: { value: 0 }, uOut: { value: 0 }, uPx: { value: dpr }, uRF: { value: 0 }, uCool: { value: 0 }, uBurst: { value: 0 },
        uGain: { value: 0.78 },
      };
      const fieldMat = new THREE.ShaderMaterial({
        uniforms: U,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: FIELD_FRAG, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
      });
      const fieldQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fieldMat); fieldQuad.frustumCulled = false;
      fieldScene.add(fieldQuad);

      const dustScene = new THREE.Scene();
      const dustCam = new THREE.PerspectiveCamera(40, bufW / bufH, 0.1, 60);
      dustCam.position.set(0, 0, 8);
      const n = small ? 520 : 1400;
      const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4), col = new Float32Array(n * 3);
      const pal = [[0.54, 0.36, 0.94], [0.26, 0.9, 0.66], [0.85, 0.85, 1.0], [0.42, 0.25, 0.82]];
      const rnd = S.rng(1995);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = (rnd() - 0.5) * 14;
        pos[i * 3 + 1] = (rnd() - 0.5) * 8;
        pos[i * 3 + 2] = -6 + rnd() * 9;
        for (let j = 0; j < 4; j++) seed[i * 4 + j] = rnd();
        const r = rnd();
        const c = pal[r < 0.45 ? 0 : r < 0.75 ? 1 : r < 0.88 ? 2 : 3];
        const b = 0.35 + rnd() * 0.45;
        col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b;
      }
      const dg = new THREE.BufferGeometry();
      dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      dg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
      dg.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
      const DU = { uTime: { value: 0 }, uPx: { value: dpr }, uIntro: { value: 0 }, uRF: { value: 0 } };
      const additive = { transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor };
      const dustMat = new THREE.ShaderMaterial({ uniforms: DU, vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, ...additive });
      const dust = new THREE.Points(dg, dustMat); dust.frustumCulled = false;
      dustScene.add(dust);

      // the console
      const dev = createDevice(THREE, { screenRes: small ? 768 : 1024, detail: 'high' });
      stg.scene.add(dev.object3d);

      // floor: key-light shadow catcher, planar reflection, violet light pool
      const floorG = new THREE.Group(); stg.scene.add(floorG);
      const shadowMat = new THREE.ShadowMaterial({ color: 0x05040a, opacity: 0.42, depthWrite: false });
      const shadowFloor = new THREE.Mesh(new THREE.CircleGeometry(2.2, 64).rotateX(-Math.PI / 2), shadowMat);
      shadowFloor.receiveShadow = true; shadowFloor.renderOrder = -3; floorG.add(shadowFloor);
      const rt = new THREE.WebGLRenderTarget(Math.max(2, bufW >> 1), Math.max(2, bufH >> 1), { type: THREE.HalfFloatType, depthBuffer: true });
      const RU = { tRefl: { value: rt.texture }, uRes: { value: new THREE.Vector2(bufW, bufH) }, uStrength: { value: 0.5 } };
      const reflMat = new THREE.ShaderMaterial({
        uniforms: RU, vertexShader: REFL_VERT, fragmentShader: REFL_FRAG, transparent: true, depthWrite: false,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      });
      const reflFloor = new THREE.Mesh(new THREE.CircleGeometry(1.6, 64).rotateX(-Math.PI / 2), reflMat);
      reflFloor.position.y = 0.0008; reflFloor.renderOrder = -2; floorG.add(reflFloor);
      const PU = { uColor: { value: new THREE.Color(0xa47dff) }, uColor2: { value: new THREE.Color(S.BRAND.jade) }, uI: { value: 0 } };
      const poolMat = new THREE.ShaderMaterial({ uniforms: PU, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: POOL_FRAG, ...additive, depthTest: true });
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7).rotateX(-Math.PI / 2), poolMat);
      pool.position.set(0, 0.0005, 0.08); pool.renderOrder = -4; floorG.add(pool);

      root.classList.add('is-3d');
      fitDirty = true; stillKey = '';
      queueMicrotask(() => { for (const [sc, cm] of [[fieldScene, ortho], [dustScene, dustCam]]) { try { stg.renderer.compileAsync(sc, cm).catch(() => {}); } catch (e) { /* lost */ } } }); // extra passes
      return { dev, fieldScene, ortho, U, fieldMat, dustScene, dustCam, DU, dustMat, dg, rt, RU, reflMat, floorG, shadowMat, poolMat, PU, rimR, sweepL };
    }

    function frame(s, stg, _t, dt) {
      const R3 = stg.renderer;
      R3.getSize(_v2);
      const w = _v2.x, h = _v2.y;
      if (fitDirty || w !== fit.w || h !== fit.h) computeFit(stg, w, h);
      // reduced motion: one still (re-rendered only when size / layout changes)
      if (reduced) { const k = `${w}x${h}|${fit.r.toFixed(3)}`; if (k === stillKey) return; stillKey = k; }
      const t = tNow;
      const bufW = R3.domElement.width, bufH = R3.domElement.height;
      if (s.U.uRes.value.x !== bufW || s.U.uRes.value.y !== bufH) {
        s.U.uRes.value.set(bufW, bufH); s.RU.uRes.value.set(bufW, bufH);
        s.rt.setSize(Math.max(2, bufW >> 1), Math.max(2, bufH >> 1));
        s.dustCam.aspect = bufW / bufH; s.dustCam.updateProjectionMatrix();
        s.U.uPx.value = s.DU.uPx.value = R3.getPixelRatio();
      }

      /* --- console pose --- */
      const o = st.out, rise = st.rise, riseE = rise * rise * (3 - 2 * rise);
      if (!drag.on) {
        drag.idle += dt;
        drag.az += drag.v * dt; drag.v *= Math.exp(-dt * 3.5);
        if (drag.idle > 2.6) { const home = Math.round(drag.az / (Math.PI * 2)) * Math.PI * 2; drag.az += (home - drag.az) * (1 - Math.exp(-dt * 1.1)); }
      }
      const sweep = reduced ? 0 : 0.36 * Math.sin(t * 0.26) + 0.08 * Math.sin(t * 0.61 + 1.3);
      const tt = lib.lerp(TT_BASE + sweep + drag.az + riseE * 2.2, -0.12 + drag.az * 0.3, lib.smooth(lib.clamp(o * 1.3)));
      const scr = t >= st.screenAt || o > 0.05 ? 'treatment' : 'logo';
      const sv = st.burst > 0 || st.rf > 0.35 ? SVS.firing : st.cool > 0.2 ? SVS.ready : SVS.done;
      const rimG = lib.clamp(st.rim * (0.62 + 0.3 * st.rf));
      s.dev.update({
        t, turntable: tt, screen: scr, screenValues: sv, rimGlow: rimG, float: 0,
        electrodeGlow: reduced ? 0 : Math.min(1, st.rf * 0.9 + st.burst * 0.6), cooling: reduced ? 0 : st.cool * 0.85,
      });
      R3.toneMappingExposure = 0.04 + 0.96 * (1 - riseE);
      s.rimR.intensity = (3.5 + 3 * st.rf) * st.rim;
      if (st.sweep >= 0 && st.sweep <= 1) { s.sweepL.intensity = 9 * Math.sin(Math.PI * st.sweep); s.sweepL.position.set(lib.lerp(1.6, -1.6, st.sweep), lib.lerp(1.3, 0.7, st.sweep), 1.0); }
      else s.sweepL.intensity = 0;
      s.PU.uI.value = (0.34 + 0.24 * st.rf + 0.14 * st.burst) * st.rim * (1 - riseE) * (1 - o * 0.6);
      s.RU.uStrength.value = 0.5 * (1 - riseE);
      s.shadowMat.opacity = 0.42 * (1 - riseE);

      /* --- camera: fitted framing + parallax, scroll-out dolly onto the touchscreen --- */
      const k = lib.smooth(lib.clamp(o / 0.85));
      const az = st.mx * 0.09 + (reduced ? 0 : 0.02 * Math.sin(t * 0.17));
      const el = EL - st.my * 0.045 + k * 0.02;
      const ty = lib.lerp(DEV_H / 2, 1.1, k);
      const rad = fit.r * (1 + riseE * 0.28) * lib.lerp(1, 0.42, k);
      stg.orbit({ target: [0, ty, 0], radius: rad, azimuth: az, elevation: el, fov: FOV });
      stg.camera.setViewOffset(w, h, fit.ox * (1 - k), fit.oy * (1 - k), w, h);
      stg.camera.updateMatrixWorld();

      /* --- field: source = projected electrode of the holstered handpiece; sink = cursor or a slow orbit --- */
      s.dev.anchor('electrode', _src).project(stg.camera);
      const sx = (_src.x * 0.5 + 0.5) * w, sy = (-_src.y * 0.5 + 0.5) * h;
      let kx, ky;
      if (st.mouse) { kx = st.px; ky = st.py; } else { kx = w * (0.5 + 0.62 * Math.cos(t * 0.11)); ky = h * (1.28 + 0.12 * Math.sin(t * 0.17)); }
      const e = !snk.init ? 1 : 1 - Math.exp(-dt * 2.4);
      snk.x += (kx - snk.x) * e; snk.y += (ky - snk.y) * e; snk.init = true;
      const px = bufW / w;
      const U = s.U;
      U.uTime.value = t; U.uIntro.value = st.field; U.uOut.value = o; U.uRF.value = st.rf; U.uCool.value = st.cool; U.uBurst.value = st.burst;
      U.uSrc.value.set(sx * px, (h - sy) * px); U.uSnk.value.set(snk.x * px, (h - snk.y) * px);
      s.DU.uTime.value = t; s.DU.uIntro.value = st.field * (1 - o * 0.6); s.DU.uRF.value = st.rf;
      s.dustCam.position.set(st.mx * 0.5, -st.my * 0.3, 8 - o * 3.5); s.dustCam.lookAt(0, 0, 0);

      /* --- passes --- */
      R3.setRenderTarget(null);
      R3.setClearColor(0x000000, 0);
      R3.clear(true, true, false);
      R3.render(s.fieldScene, s.ortho);
      R3.render(s.dustScene, s.dustCam);
      if (s.RU.uStrength.value > 0.005 && k < 0.98) {
        // mirrored console → half-res target (planar reflection); floor props hidden
        s.floorG.visible = false;
        s.dev.object3d.scale.y = -1;
        R3.setRenderTarget(s.rt); R3.setClearColor(0x000000, 0); R3.clear(true, true, false);
        R3.render(stg.scene, stg.camera);
        R3.setRenderTarget(null);
        s.dev.object3d.scale.y = 1;
        s.floorG.visible = true;
      }
      R3.clearDepth();
      R3.shadowMap.needsUpdate = true;
      R3.render(stg.scene, stg.camera);
    }

    function dispose(s) {
      if (!s) return;
      s.dev.dispose();
      s.rt.dispose();
      for (const m of [s.fieldMat, s.dustMat, s.reflMat, s.shadowMat, s.poolMat]) m.dispose();
      s.dg.dispose();
      s.fieldScene.traverse((x) => x.geometry?.dispose?.());
      s.floorG.traverse((x) => x.geometry?.dispose?.());
    }

    const m3 = mountFresh(host, {
      THREE, stageLib: precompileLib(S), dpr: small ? 1.25 : 1.5,
      stageOpts: { fov: FOV, transparent: true, exposure: 1.0, envViolet: 0.6 },
      build, frame, dispose,
      fallback: () => root.classList.add('no-gl'),
    });

    /* ---------- drag-to-rotate (only when the press lands on the console) ---------- */
    const onDevice = (ev) => {
      const r = host.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, f = fit.rect;
      return st.out < 0.3 && x > f.x - f.w * 0.25 && x < f.x + f.w * 1.25 && y > f.y - 10 && y < f.y + f.h + 20;
    };
    if (!reduced) {
      const cv = host; // events bubble from the (replaceable) canvas
      cv.addEventListener('pointerdown', (ev) => {
        if (!onDevice(ev)) return;
        drag.on = true; drag.id = ev.pointerId; drag.x = ev.clientX; drag.moved = 0; drag.v = 0; drag.idle = 0;
        cv.setPointerCapture?.(ev.pointerId); cv.style.cursor = 'grabbing';
      });
      cv.addEventListener('pointermove', (ev) => {
        if (drag.on && ev.pointerId === drag.id) {
          const dx = ev.clientX - drag.x; drag.x = ev.clientX; drag.moved += Math.abs(dx);
          drag.az += dx * 0.0085; drag.v = dx * 0.0085 * 60; drag.idle = 0;
        } else if (ev.pointerType === 'mouse') cv.style.cursor = onDevice(ev) ? 'grab' : '';
      });
      const up = (ev) => { if (!drag.on || ev.pointerId !== drag.id) return; drag.on = false; drag.idle = 0; cv.style.cursor = ''; };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    }

    const loop = reduced ? null : lib.visibleLoop(stage, draw);
    // CSS loops (corridor marquee, floor words, spec glyphs, scroll cue) pause with the loop off-screen
    lib.whenVisible(stage, () => root.classList.remove('is-off'), () => root.classList.add('is-off'), '15% 0px');

    /* ---------- mouse ---------- */
    if (!isTouch && !reduced) {
      stage.addEventListener('pointermove', (ev) => {
        if (ev.pointerType !== 'mouse') return;
        const r = stage.getBoundingClientRect();
        st.tx = ((ev.clientX - r.left) / r.width - 0.5) * 2;
        st.ty = ((ev.clientY - r.top) / r.height - 0.5) * 2;
        const cr = host.getBoundingClientRect();
        st.px = ev.clientX - cr.left; st.py = ev.clientY - cr.top; st.mouse = true;
      });
      stage.addEventListener('pointerleave', () => { st.tx = st.ty = 0; st.mouse = false; });
    }
    if (!reduced) {
      stage.addEventListener('click', (ev) => {
        if (ev.target.closest('a, button')) return;
        if (drag.moved > 6) { drag.moved = 0; return; } // that was a rotate, not a tap
        st.kickAt = tNow;
      });
    }

    /* ---------- scroll-out (pinned dissolve on desktop) ---------- */
    if (!reduced) {
      const mm = gsap.matchMedia();
      mm.add('(min-width: 1024px)', () => {
        ScrollTrigger.create({
          trigger: root, start: 'top top', end: '+=75%', pin: true, pinSpacing: true, scrub: true,
          onUpdate: (s) => { st.out = s.progress; if (!loop?.running) apply(0); },
        });
        return () => { st.out = 0; };
      });
      mm.add('(max-width: 1023px)', () => {
        ScrollTrigger.create({
          trigger: root, start: 'top top', end: () => '+=' + window.innerHeight,
          onUpdate: (s) => { st.out = s.progress * 0.9; },
        });
        return () => { st.out = 0; };
      });
    }

    lib.onResize(layout);
    layout();

    /* ---------- load choreography ---------- */
    const staggerEls = [...left.children, ...specs.children, ...foot.children];
    if (reduced) {
      draw(0, 4);
      return;
    }
    gsap.set(top.querySelector('.hero__eyebrow'), { opacity: 0, letterSpacing: '0.6em' });
    gsap.set(top.querySelector('.hero__mark'), { opacity: 0 });
    gsap.set(top.querySelector('.hero__mark sup'), { opacity: 0 });
    gsap.set(staggerEls, { opacity: 0, y: 24 });
    gsap.set($('.hero__tag span'), { clipPath: 'inset(0 100% 0 0)' });

    let started = false;
    const intro = () => {
      if (started) return;
      started = true;
      const mark = top.querySelector('.hero__mark');
      const word = top.querySelector('.hero__word');
      // split the wordmark into masked glyphs (manual split: no dependency on font-load timing)
      word.innerHTML = [...word.textContent].map((c) => `<span class="hero__cm"><span class="hero__c">${c}</span></span>`).join('');
      const chars = word.querySelectorAll('.hero__c');
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.to(st, { room: 1, duration: 2.6, ease: 'power3.out' }, 0)
        .to(st, { field: 1, duration: 2.4, ease: 'power2.inOut' }, 0.35)
        .set(mark, { opacity: 1 }, 0.3)
        .from(chars, { yPercent: 115, duration: 1.5, stagger: 0.055 }, 0.3)
        .to(mark.querySelector('sup'), { opacity: 1, duration: 0.8, ease: 'power2.out' }, 1.05)
        .to(top.querySelector('.hero__eyebrow'), { opacity: 1, letterSpacing: '0.32em', duration: 1.6 }, 0.5)
        // console: lights come up while it spins into its 3/4 pose and the camera settles
        .to(st, { rise: 0, duration: 2.6, ease: 'power3.out' }, 0.5)
        // violet rim strip flickers on like a neon tube, then holds
        .to(st, { rim: 1, duration: 0.25, ease: 'none', repeat: 3, yoyo: true }, 0.95)
        .to(st, { rim: 1, duration: 0.6 }, 1.95)
        .fromTo(st, { sweep: 0 }, { sweep: 1, duration: 1.9, ease: 'power2.inOut', immediateRender: false, onComplete: () => { st.sweep = -1; } }, 1.5)
        .add(() => { st.screenAt = tNow + 2.4; }, 2.2)
        .to(staggerEls, { opacity: 1, y: 0, duration: 1.2, stagger: 0.06 }, 1.1)
        .to($('.hero__tag span'), { clipPath: 'inset(0 0% 0 0)', duration: 1.2, ease: 'power3.inOut' }, 1.15)
        .add(() => {
          SPECS.forEach((s, i) => {
            const o = { v: s.from ?? 0 };
            gsap.to(o, { v: s.to, duration: 1.8, delay: i * 0.12, ease: 'power3.out', onUpdate: () => { specVals[i].textContent = fmt(s, o.v); } });
          });
        }, 1.3);
    };
    SPECS.forEach((s, i) => { specVals[i].textContent = fmt(s, s.from ?? 0); });

    const loader = document.querySelector('.loader');
    if (!loader || loader.classList.contains('is-done')) requestAnimationFrame(intro);
    else {
      const mo = new MutationObserver(() => { if (loader.classList.contains('is-done')) { mo.disconnect(); intro(); } });
      mo.observe(loader, { attributes: true, attributeFilter: ['class'] });
      // last-resort fallback only: boot can legitimately take >10 s on slow devices/networks, and an
      // earlier timer would play the whole intro hidden behind the loader
      setTimeout(() => { mo.disconnect(); intro(); }, 30000);
    }
  },
};
