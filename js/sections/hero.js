// HERO — cinematic opener.
// Layers (back → front): CSS-3D corridor of outlined words · WebGL RF field (source/sink field lines,
// equipotential rings, dust) · device on a lit floor · copy.  The field pulses in the IFU three-phase
// rhythm (治疗前冷却 → 射频传送 → 治疗后冷却, IFU p.15 §7.6) and bends toward the cursor.

const IMG = 'assets/img/device.webp';
const IMG_W = 496;
const IMG_H = 1186;
const TIP = [0.5, 0.318]; // handpiece head inside device.webp (normalised) → field source

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
  col *= vig * uIntro * (1.0 - 0.85 * uOut);
  col += (hash(px + fract(uTime)) - 0.5) / 255.0;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
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
  gl_FragColor = vec4(vColor * a * a * vA, 1.0);
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
  <canvas class="hero__gl" aria-hidden="true"></canvas>
  <div class="hero__veil" aria-hidden="true"></div>

  <figure class="hero__device">
    <div class="hero__halo" aria-hidden="true"></div>
    <div class="hero__refl" aria-hidden="true"><img src="${IMG}" alt="" width="${IMG_W}" height="${IMG_H}" decoding="async"></div>
    <div class="hero__float">
      <img class="hero__img" src="${IMG}" alt="YOUMAGIC YM5 射频皮肤治疗仪主机" width="${IMG_W}" height="${IMG_H}" decoding="async" fetchpriority="high">
      <span class="hero__sheen" aria-hidden="true"></span>
    </div>
  </figure>

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
      <p class="micro">原理示意 · 射频场与脉冲时序的艺术化呈现${reduced ? '' : isTouch ? ' · 轻点场景触发一次脉冲' : ' · 移动光标场线偏转 · 点击触发一次脉冲'}</p>
      <p class="micro">${data.disclaimers.sim}</p>
    </div>
  </div>
</div>`;

    const $ = (s) => root.querySelector(s);
    const stage = $('.hero__stage');
    const room = $('.hero__room');
    const box = $('.hero__box');
    const canvas = $('.hero__gl');
    const device = $('.hero__device');
    const floatEl = $('.hero__float');
    const refl = $('.hero__refl img');
    const halo = $('.hero__halo');
    const top = $('.hero__top');
    const left = $('.hero__left');
    const specs = $('.hero__specs');
    const foot = $('.hero__foot');
    const phases = [...root.querySelectorAll('.hero__phases span')];
    const specVals = [...root.querySelectorAll('.hero__spec-v b')];

    /* ---------- shared animated state (tweened by GSAP, applied in one loop) ---------- */
    const st = {
      room: reduced ? 1 : 0, // corridor intro 0→1
      field: reduced ? 1 : 0, // WebGL intro
      rise: reduced ? 0 : 1, // device rise 1→0
      out: 0, // scroll-out 0→1
      mx: 0, my: 0, tx: 0, ty: 0, // mouse (−1…1), smoothed
      mouse: false, px: 0, py: 0, // mouse in stage px
      kickAt: -1, // time of the last click-fired pulse
      snkX: 0, snkY: 0,
    };
    let desktop = window.matchMedia('(min-width: 1024px)').matches;

    /* ---------- layout (room box + field source) ---------- */
    let geo = { W: 1, H: 1, dev: null };
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
      const cr = canvas.getBoundingClientRect();
      const dr = device.getBoundingClientRect();
      geo = { W: cr.width, H: cr.height, dev: { x: dr.left - cr.left, y: dr.top - cr.top, w: dr.width, h: dr.height } };
      gl?.resize(cr.width, cr.height);
      apply(0);
    };

    /* ---------- WebGL field (lazy, never blocks other sections) ---------- */
    let gl = null;
    const glReady = initGL(canvas, isTouch || !desktop).then((g) => { gl = g; layout(); if (reduced) draw(0, 4); }).catch(() => { root.classList.add('no-gl'); });

    /* ---------- per-frame composition ---------- */
    let lastPh = '';
    const apply = (dt) => {
      const o = st.out;
      const e = 1 - Math.exp(-dt * 3.2);
      st.mx += (st.tx - st.mx) * e;
      st.my += (st.ty - st.my) * e;
      // corridor: fly-in on load, fly-through on scroll, mouse parallax
      const z = -520 * (1 - st.room) + o * 760;
      box.style.transform = `translate3d(0,0,${z.toFixed(1)}px) rotateY(${(st.mx * 2.4).toFixed(3)}deg) rotateX(${(-st.my * 1.5).toFixed(3)}deg)`;
      room.style.opacity = (st.room * (1 - o * 0.75)).toFixed(3);
      // device: float + parallax + rise + scroll drift
      const bob = reduced ? 0 : Math.sin(tNow * 0.9) * 5;
      const dx = st.mx * 12;
      const dy = bob + st.rise * 140 - o * (desktop ? 120 : 60) + st.my * 5;
      const sc = 1 + o * (desktop ? 0.28 : 0.12);
      floatEl.style.transform = `translate3d(${dx.toFixed(2)}px,${dy.toFixed(2)}px,0) scale(${sc.toFixed(4)})`;
      refl.style.transform = `translate3d(${dx.toFixed(2)}px,${(-dy * 0.9).toFixed(2)}px,0) scaleY(-1)`;
      device.style.opacity = ((1 - st.rise) * (1 - lib.smooth(lib.clamp((o - 0.2) / 0.55)))).toFixed(3);
      halo.style.transform = `translateX(calc(-50% + ${dx.toFixed(1)}px)) scale(${(1 - bob * 0.012).toFixed(3)})`;
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

    let tNow = 0;
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
      if (E.ph !== lastPh) { lastPh = E.ph; phases.forEach((p) => p.classList.toggle('is-on', p.dataset.ph === E.ph)); }
      if (!gl || !geo.dev) return;
      // field source = handpiece head on the (moving) device image
      const d = geo.dev;
      const sc = 1 + st.out * (desktop ? 0.28 : 0.12);
      const bob = reduced ? 0 : Math.sin(t * 0.9) * 5;
      const cx = d.x + d.w / 2 + st.mx * 12;
      const by = d.y + d.h + bob + st.rise * 140 - st.out * (desktop ? 120 : 60) + st.my * 5; // transform-origin is centre
      const cy = by - d.h / 2;
      const sx = cx + (TIP[0] - 0.5) * d.w * sc;
      const sy = cy + (TIP[1] - 0.5) * d.h * sc;
      // sink: cursor (return path) or a slow orbit below the frame
      let kx, ky;
      if (st.mouse) { kx = st.px; ky = st.py; }
      else { kx = geo.W * (0.5 + 0.62 * Math.cos(t * 0.11)); ky = geo.H * (1.28 + 0.12 * Math.sin(t * 0.17)); }
      const e = st.snkX === 0 && st.snkY === 0 ? 1 : 1 - Math.exp(-dt * 2.4);
      st.snkX += (kx - st.snkX) * e;
      st.snkY += (ky - st.snkY) * e;
      gl.render(t, {
        src: [sx, geo.H - sy], snk: [st.snkX, geo.H - st.snkY],
        intro: st.field, out: st.out, rf: E.rf, cool: E.cool, burst, mx: st.mx, my: st.my,
      });
    };

    const loop = reduced ? null : lib.visibleLoop(stage, draw);
    // CSS loops (corridor marquee, floor words, spec glyphs, scroll cue) pause with the WebGL loop off-screen
    lib.whenVisible(stage, () => root.classList.remove('is-off'), () => root.classList.add('is-off'), '15% 0px');

    /* ---------- mouse ---------- */
    if (!isTouch && !reduced) {
      stage.addEventListener('pointermove', (ev) => {
        if (ev.pointerType !== 'mouse') return;
        const r = stage.getBoundingClientRect();
        st.tx = ((ev.clientX - r.left) / r.width - 0.5) * 2;
        st.ty = ((ev.clientY - r.top) / r.height - 0.5) * 2;
        const cr = canvas.getBoundingClientRect();
        st.px = ev.clientX - cr.left; st.py = ev.clientY - cr.top; st.mouse = true;
      });
      stage.addEventListener('pointerleave', () => { st.tx = st.ty = 0; st.mouse = false; });
    }
    if (!reduced) {
      stage.addEventListener('click', (ev) => {
        if (ev.target.closest('a, button')) return;
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
    const imgEl = $('.hero__img');
    if (!imgEl.complete) imgEl.addEventListener('load', () => { layout(); ScrollTrigger.refresh(); }, { once: true });
    layout();

    /* ---------- load choreography ---------- */
    const staggerEls = [...left.children, ...specs.children, ...foot.children];
    if (reduced) {
      draw(0, 4);
      glReady.then(() => draw(0, 4));
      return;
    }
    gsap.set(top.querySelector('.hero__eyebrow'), { opacity: 0, letterSpacing: '0.6em' });
    gsap.set(top.querySelector('.hero__mark'), { opacity: 0 });
    gsap.set(top.querySelector('.hero__mark sup'), { opacity: 0 });
    gsap.set(staggerEls, { opacity: 0, y: 24 });
    gsap.set($('.hero__tag span'), { clipPath: 'inset(0 100% 0 0)' });
    gsap.set(halo, { opacity: 0 });

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
        .to(st, { rise: 0, duration: 2.0, ease: 'expo.out' }, 0.55)
        .to(halo, { opacity: 1, duration: 0.25, ease: 'none', repeat: 3, yoyo: true }, 0.95)
        .to(halo, { opacity: 1, duration: 0.6 }, 1.95)
        .fromTo($('.hero__sheen'), { backgroundPosition: '130% 0' }, { backgroundPosition: '-30% 0', duration: 1.8, ease: 'power2.inOut' }, 1.5)
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

/* ================= WebGL: RF field + dust ================= */
async function initGL(canvas, light) {
  const THREE = await import('three');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false, powerPreference: 'high-performance', stencil: false, depth: false });
  renderer.setClearColor(0x000000, 1);
  renderer.autoClear = false;
  const dpr = Math.min(window.devicePixelRatio || 1, light ? 1.25 : 1.5);
  renderer.setPixelRatio(dpr);

  // full-screen field quad
  const fieldScene = new THREE.Scene();
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const U = {
    uRes: { value: new THREE.Vector2(1, 1) }, uSrc: { value: new THREE.Vector2() }, uSnk: { value: new THREE.Vector2() },
    uTime: { value: 0 }, uIntro: { value: 0 }, uOut: { value: 0 }, uPx: { value: dpr }, uRF: { value: 0 }, uCool: { value: 0 }, uBurst: { value: 0 },
  };
  const fieldMat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: FIELD_FRAG,
    depthTest: false, depthWrite: false,
  });
  fieldScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fieldMat));

  // dust
  const dustScene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
  cam.position.set(0, 0, 8);
  const n = light ? 520 : 1400;
  const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4), col = new Float32Array(n * 3);
  const pal = [[0.54, 0.36, 0.94], [0.26, 0.9, 0.66], [0.85, 0.85, 1.0], [0.42, 0.25, 0.82]];
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 14;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
    pos[i * 3 + 2] = -6 + Math.random() * 9;
    for (let j = 0; j < 4; j++) seed[i * 4 + j] = Math.random();
    const r = Math.random();
    const c = pal[r < 0.45 ? 0 : r < 0.75 ? 1 : r < 0.88 ? 2 : 3];
    const b = 0.35 + Math.random() * 0.45;
    col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const DU = { uTime: { value: 0 }, uPx: { value: dpr }, uIntro: { value: 0 }, uRF: { value: 0 } };
  const dustMat = new THREE.ShaderMaterial({
    uniforms: DU, vertexShader: DUST_VERT, fragmentShader: DUST_FRAG,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, dustMat);
  pts.frustumCulled = false;
  dustScene.add(pts);

  let W = 1, H = 1;
  return {
    resize(w, h) {
      W = Math.max(1, w); H = Math.max(1, h);
      renderer.setSize(W, H, false);
      U.uRes.value.set(W * dpr, H * dpr);
      cam.aspect = W / H;
      cam.updateProjectionMatrix();
    },
    render(t, s) {
      U.uTime.value = t; U.uIntro.value = s.intro; U.uOut.value = s.out; U.uRF.value = s.rf; U.uCool.value = s.cool; U.uBurst.value = s.burst;
      U.uSrc.value.set(s.src[0] * dpr, s.src[1] * dpr);
      U.uSnk.value.set(s.snk[0] * dpr, s.snk[1] * dpr);
      DU.uTime.value = t; DU.uIntro.value = s.intro * (1 - s.out * 0.6); DU.uRF.value = s.rf;
      cam.position.x = s.mx * 0.5;
      cam.position.y = -s.my * 0.3;
      cam.position.z = 8 - s.out * 3.5;
      cam.lookAt(0, 0, 0);
      renderer.clear();
      renderer.render(fieldScene, ortho);
      renderer.render(dustScene, cam);
    },
  };
}
