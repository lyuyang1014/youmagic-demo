// #impedance — AI 能量匹配技术
// src: DA p.2 (标题与原文“AI 智能匹配阻抗网络，补偿能量输出更精准有效”)
//      IFU p.5  输出功率误差不大于设定值的 ±20%
//      IFU p.7  治疗仪持续监测输出功率、输出能量、脉冲时间和阻抗测量值
//      IFU p.25 E603 阻抗异常 · 请检查回路是否良好连接
//      IFU p.30 射频能量 6.78 MHz ± 3%；阻抗测量 75–350 Ω ± 20%
//      IFU p.31 额定负载 100–250 Ω；图12 负载与功率关系（data.loadCurve）
//      IFU p.32 图13 能量设置与功率关系（0.5 → 25 W … 8 → 175 W，每 0.5 档 +10 W）
// 3D: 图12 is a YM3D createLoadCurve3D scene (one WebGL context via mount3D); the impedance cursor, its intro sweep
// and the live-demo shots drive `ohm`. Readouts stay in the DOM.

import * as THREE from 'three';
import * as S3 from '../ym3d/stage.mjs';
import { mount3D } from '../ym3d/host.mjs';
import { createLoadCurve3D, projectAnchor } from '../ym3d/dataviz.mjs';
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

/* host.mjs work-around (library issue, reported by integration QA): when a mount goes far off-screen the host calls
   renderer.forceContextLoss() and on the way back rebuilds on the SAME canvas, whose context is still lost → createStage
   throws ("reading 'precision'") and the fallback fires for good. Each build therefore renders into a fresh sibling canvas
   under the host's own canvas, which stays on top (context-less, transparent) as the pointer / drag layer. */
const freshStageLib = (YM) => ({
  ...YM,
  createStage(THREE_, canvas, opts) {
    canvas.__ymRC?.remove();
    const c = document.createElement('canvas');
    c.className = 'ym3d-rc';
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
    canvas.parentNode.insertBefore(c, canvas);
    canvas.__ymRC = c;
    return YM.createStage(THREE_, c, opts);
  },
});

/** YM3D fx/halo materials use AdditiveBlending with alpha = 1, which also ADDS alpha: on a transparent stage every
    glow quad becomes an opaque dark square. Re-map them to add colour only (alpha untouched). */
function additiveKeepsAlpha(THREE, root) {
  root.traverse((o) => {
    for (const m of [].concat(o.material || [])) {
      if (m.blending !== THREE.AdditiveBlending) continue;
      Object.assign(m, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
      m.needsUpdate = true;
    }
  });
}

const C = { mint: '#43e6a8', violet: '#8a5cf0', lilac: '#b79bff', warn: '#f0603f', text: '#eceaf4', t2: '#a9a6ba', t3: '#6f6c82', line: 'rgba(255,255,255,0.08)', line2: 'rgba(255,255,255,0.16)' };
const R_REF = 150;           // 对比示意：恒压输出在 150 Ω 时与设定功率相等（假设）
const PERIOD = 1.35;         // s per simulated shot (slowed for readability)
const RF_ON = [0.16, 0.66];  // fraction of the shot cycle with RF on (pre-cool → RF → post-cool)
const TAU = Math.PI * 2;
const onceVisible = (el, fn, threshold = 0.2) => { const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { threshold }); io.observe(el); };
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const withA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const mono = (s) => `${s}px "JetBrains Mono", ui-monospace, monospace`;
const sans = (s, w = 400) => `${w} ${s}px "Noto Sans SC", "PingFang SC", system-ui, sans-serif`;

export default {
  id: 'impedance',
  nav: 'AI 能量匹配',
  async init(root, ctx) {
    const { gsap, ScrollTrigger, lib, data, reduced } = ctx;
    const LC = data.loadCurve;
    const PSET = { full: 175, half: 95 };
    const S = { mode: 'full', cmp: false, playing: !reduced, R: 162, cursor: 180, shot: 0, lv: 12 };
    const fullAt = (r) => interp(LC.load, LC.full, r);
    const halfAt = (r) => interp(LC.load, LC.half, r);
    const matchedAt = (r) => (S.mode === 'full' ? fullAt(r) : halfAt(r));
    const cvAt = (r) => (PSET[S.mode] * R_REF) / r; // P = V²/R with V² = Pset·R_REF

    root.innerHTML = `
      <div class="wrap imp">
        <header class="sec-head">
          <span class="eyebrow" data-reveal>07 · AI ENERGY MATCHING</span>
          <h2 class="h1" data-reveal>AI 能量匹配技术</h2>
          <p class="lead" data-reveal><em class="imp-em">AI 智能匹配阻抗网络</em>，补偿能量输出更精准有效。</p>
          <p class="imp-sub" data-reveal>治疗仪持续监测<b>输出功率</b>、<b>输出能量</b>、<b>脉冲时间</b>和<b>阻抗测量值</b>。在额定负载 100–250 Ω 范围内，全功率输出保持在 175 W。<span class="tag-src">说明书 第 7、31 页</span></p>
        </header>

        <div class="imp-bar" data-reveal>
          <div class="seg" role="group" aria-label="功率模式（图12 两条曲线）">
            <button type="button" data-mode="full" aria-pressed="true">全功率 175 W</button>
            <button type="button" data-mode="half" aria-pressed="false">半功率 95 W</button>
          </div>
          <button type="button" class="btn imp-cmp" aria-pressed="false"><i class="imp-cmp__sw" aria-hidden="true"></i>对比：未匹配 恒压输出<span class="imp-tag">原理示意</span></button>
          <button type="button" class="btn imp-play" aria-pressed="${S.playing}"><span class="imp-play__i" aria-hidden="true"></span><span class="imp-play__t">${S.playing ? '暂停' : '播放'}</span></button>
          <span class="imp-count mono" aria-live="off">SHOT <b>000</b></span>
        </div>

        <div class="imp-main">
          <figure class="imp-chart imp-chart--3d card" data-reveal>
            <figcaption class="imp-chart__cap">
              <span class="imp-chart__t">负载与功率关系 <small class="imp-chart__3d">3D</small></span>
              <span class="tag-src">说明书 第 31 页 图12</span>
            </figcaption>
            <div class="imp-3d" tabindex="0" role="slider" aria-label="负载游标（三维负载与功率关系图）：左右方向键移动" aria-valuemin="75" aria-valuemax="350" aria-valuenow="180">
              <div class="imp-lbls" aria-hidden="true">
                <span class="imp-lb imp-lb--mk" data-a="marker"></span>
                <span class="imp-lb imp-lb--band" data-a="band">额定负载 100–250 Ω · 全功率 175 W</span>
                <span class="imp-lb imp-lb--half" data-a="half">半功率 95 W</span>
                <span class="imp-lb imp-lb--cmp" data-a="cmp">恒压 P = V² / R<em>原理示意</em></span>
              </div>
              <button type="button" class="imp-follow" aria-pressed="true"><i aria-hidden="true"></i><span>游标跟随实时阻抗</span></button>
            </div>
            <div class="imp-read" aria-live="polite">
              <div class="imp-read__i"><span class="imp-read__k">负载</span><span class="imp-read__v num" data-c="r">180</span><span class="imp-read__u">Ω</span><span class="imp-read__s" data-c="rs"></span></div>
              <div class="imp-read__i"><span class="imp-read__k"><i class="sw sw--full"></i>全功率</span><span class="imp-read__v num" data-c="f">175</span><span class="imp-read__u">W</span></div>
              <div class="imp-read__i"><span class="imp-read__k"><i class="sw sw--half"></i>半功率</span><span class="imp-read__v num" data-c="h">95</span><span class="imp-read__u">W</span></div>
              <div class="imp-read__i imp-read__i--cmp"><span class="imp-read__k"><i class="sw sw--cmp"></i>恒压（示意）</span><span class="imp-read__v num" data-c="g">—</span><span class="imp-read__u">W</span></div>
            </div>
            <p class="micro imp-hint">在图中左右拖动（或聚焦后用 ← →）移动负载游标；拖动图外区域可旋转视角。数据点之间为线性连接，“≈” 表示插值读数；每个亮点是实时演示中的一发（原理示意）。</p>
          </figure>

          <div class="imp-live card" data-reveal>
            <div class="imp-live__head"><span class="imp-dot" aria-hidden="true"></span>实时匹配演示<span class="imp-tag">原理示意</span></div>
            <div class="imp-live__grid">
              <div class="imp-io imp-io--in">
                <div class="imp-k">组织阻抗 · 本发</div>
                <div class="imp-big num"><span data-r>—</span><small>Ω</small></div>
                <div class="imp-tissue"><canvas aria-hidden="true"></canvas></div>
                <span class="micro imp-tissue__cap">每一发接触的组织状态不同（示意）</span>
                <div class="imp-meter" aria-hidden="true">
                  <div class="imp-meter__band"></div><div class="imp-meter__mk"></div>
                  <span class="imp-meter__l mono">75</span><span class="imp-meter__m mono">100–250 Ω</span><span class="imp-meter__r mono">350</span>
                </div>
              </div>
              <div class="imp-net" aria-hidden="true">
                <svg viewBox="0 0 80 200" class="imp-net__svg"></svg>
                <span class="micro">AI 匹配<br>阻抗网络</span>
              </div>
              <div class="imp-io imp-io--out">
                <div class="imp-k">输出功率 · 设定 <b data-set>175</b> W</div>
                <div class="imp-big num imp-big--out"><span data-w>175</span><small>W</small></div>
                <div class="imp-gauge"><canvas aria-hidden="true"></canvas></div>
                <div class="imp-lock"><span class="imp-lock__i" aria-hidden="true"></span><span>输出稳定于设定功率</span></div>
                <div class="imp-ghost"><i aria-hidden="true"></i>未匹配 恒压（示意）：<b data-g>—</b> W</div>
              </div>
            </div>
            <div class="imp-scope">
              <canvas aria-hidden="true"></canvas>
              <div class="imp-scope__lg legend">
                <span><i style="background:${C.lilac}"></i>阻抗 Ω（逐发变化）</span>
                <span><i style="background:${C.mint}"></i>输出功率 W（射频脉冲）</span>
                <span class="imp-lg-cmp"><i style="background:${C.warn}"></i>未匹配 恒压（示意）</span>
              </div>
            </div>
          </div>

        </div>

        <div class="imp-row2">
          <figure class="imp-lv card" data-reveal>
            <figcaption class="imp-chart__cap">
              <span class="imp-chart__t">能量设置与功率关系</span>
              <span class="tag-src">说明书 第 32 页 图13</span>
            </figcaption>
            <div class="imp-lv__read" aria-live="polite">
              <div><span class="imp-read__k">能量强度</span><span class="imp-lv__big num" data-l="lv">6.0</span></div>
              <div class="imp-lv__arrow" aria-hidden="true">→</div>
              <div><span class="imp-read__k">输出功率</span><span class="imp-lv__big num" data-l="w">135</span><span class="imp-read__u">W</span></div>
              <div class="imp-lv__step"><span class="mono">+10 W</span><span class="micro">每 0.5 档</span></div>
            </div>
            <svg class="imp-lvsvg viz" viewBox="0 0 640 300" role="img" aria-label="能量强度 0.5 至 8，输出功率 25 W 至 175 W，线性，每 0.5 档增加 10 W"></svg>
            <label class="imp-scrub">
              <span class="visually-hidden">能量强度</span>
              <input class="range" type="range" min="0" max="15" step="1" value="${S.lv - 1}" aria-label="能量强度" />
            </label>
          </figure>

          <div class="imp-specs">
            <div class="imp-spec card" data-reveal><div class="imp-spec__v num">6.78<small>MHz</small></div><div class="imp-spec__k">射频频率 ± 3%</div><span class="tag-src">说明书 第 30 页</span></div>
            <div class="imp-spec card" data-reveal><div class="imp-spec__v num">75–350<small>Ω</small></div><div class="imp-spec__k">阻抗测量范围 ± 20%</div><span class="tag-src">说明书 第 30 页</span></div>
            <div class="imp-spec card" data-reveal><div class="imp-spec__v num">100–250<small>Ω</small></div><div class="imp-spec__k">各输出模式额定负载范围</div><span class="tag-src">说明书 第 31 页</span></div>
            <div class="imp-spec card" data-reveal><div class="imp-spec__v num">≤ ±20<small>%</small></div><div class="imp-spec__k">输出功率误差（相对设定值）</div><span class="tag-src">说明书 第 5 页</span></div>
            <div class="imp-spec imp-spec--wide imp-why card" data-reveal>
              <div class="imp-spec__k">为什么要做阻抗匹配？<span class="imp-tag">原理示意</span></div>
              <p>不同部位、皮肤含水量与接触状态都会让组织阻抗逐发变化。若输出电压保持不变，输出功率将按 <span class="mono">P = V² / R</span> 随阻抗起伏；说明书图12 显示，在额定负载 100–250 Ω 内，全功率输出保持在 175 W。</p>
            </div>
            <div class="imp-spec imp-spec--wide card" data-reveal>
              <div class="imp-spec__k">持续监测</div>
              <ul class="imp-mon">${['输出功率', '输出能量', '脉冲时间', '阻抗测量值'].map((x) => `<li><i aria-hidden="true"></i>${x}</li>`).join('')}</ul>
              <p class="micro">阻抗异常时触摸屏显示故障代码 <b class="mono">E603</b>（请检查回路是否良好连接）。<span class="tag-src">说明书 第 7、25 页</span></p>
            </div>
          </div>
        </div>

        <p class="note">图12、图13 曲线数值取自使用说明书；“未匹配 恒压输出”曲线按 P = V² / R 绘制（假设 150 Ω 时与设定功率相等），仅用于对比说明阻抗补偿的意义，并非任何实际设备数据。实时演示中的阻抗数值为随机生成的原理示意。</p>
        <p class="disclaimer">${data.disclaimers.sim}</p>
      </div>`;

    const $ = (s) => root.querySelector(s);
    const S_ = (tag, a, p) => lib.svg(tag, a, p);
    const el = {
      r: $('[data-r]'), w: $('[data-w]'), set: $('[data-set]'), g: $('[data-g]'), count: $('.imp-count b'),
      meterMk: $('.imp-meter__mk'), live: $('.imp-live'), ghost: $('.imp-ghost'),
      seg: [...root.querySelectorAll('.imp-bar .seg button')], cmp: $('.imp-cmp'), play: $('.imp-play'),
      rd: { r: $('[data-c="r"]'), rs: $('[data-c="rs"]'), f: $('[data-c="f"]'), h: $('[data-c="h"]'), g: $('[data-c="g"]') },
    };

    /* =============== 图12 — 3D load curve (YM3D createLoadCurve3D · one WebGL context via mount3D) ===============
       The impedance cursor (drag / keys / intro sweep) and — while “跟随实时阻抗” is on — every live-demo shot drive
       the component's `ohm`. Each shot also drops a bead onto the matched curve (原理示意); with 对比 on, a dashed
       P = V²/R curve (假设 150 Ω 时与设定功率相等) and the per-shot error are drawn beside it. */
    const stageEl = $('.imp-3d'), followBtn = $('.imp-follow');
    const LBL = [...stageEl.querySelectorAll('.imp-lb')].map((n) => ({ el: n, a: n.dataset.a, out: {}, on: false }));
    const WD = 3.8, HC = 1.9, WMAX = 200, YCAP = 214, NB = 12; // createLoadCurve3D defaults (width, height, wMax)
    const X3 = (r) => -WD / 2 + ((r - LC.load[0]) / (LC.load[LC.load.length - 1] - LC.load[0])) * WD, Y3 = (w) => (w / WMAX) * HC;
    const V3 = { rev: reduced ? 1 : 0, revT: reduced ? 1 : 0, cam: reduced ? 1 : 0, camT: reduced ? 1 : 0, px: 0, py: 0, az: 0, el: 0, cmpA: 0, cmpRev: 1, swept: reduced, sig: '', w: 0, h: 0 };
    const beads = []; // { R, pm, pc, cmp, t0 }
    S.follow = true; S.cursorF = S.cursor;

    function fmtP(r, arr) {
      const v = interp(LC.load, arr, r);
      const i = LC.load.findIndex((x) => x >= r);
      const exact = LC.load.includes(r) || (i > 0 && arr[i] === arr[i - 1]);
      return (exact ? '' : '≈') + Math.round(v);
    }
    function setCursor(r, fromUser) {
      S.cursorF = cl(r, 75, 350);
      r = Math.round(S.cursorF);
      S.cursor = r;
      const pc = cvAt(r), inBand = r >= 100 && r <= 250;
      stageEl.setAttribute('aria-valuenow', String(r));
      stageEl.setAttribute('aria-valuetext', `${r} 欧姆，全功率 ${fmtP(r, LC.full)} 瓦，半功率 ${fmtP(r, LC.half)} 瓦`);
      el.rd.r.textContent = r;
      el.rd.rs.textContent = inBand ? '额定负载内' : '额定负载外';
      el.rd.rs.classList.toggle('is-out', !inBand);
      el.rd.f.textContent = fmtP(r, LC.full);
      el.rd.h.textContent = fmtP(r, LC.half);
      el.rd.g.textContent = Math.round(pc);
      if (fromUser) { root.style.setProperty('--imp-cur', '1'); if (S.follow) setFollow(false); curTw?.kill(); }
    }
    let curTw = null;
    const tweenCursor = (r) => {
      curTw?.kill();
      if (reduced) { setCursor(r); return; }
      const o = { r: S.cursorF };
      curTw = gsap.to(o, { r, duration: 0.7, ease: 'power3.inOut', onUpdate: () => setCursor(o.r) });
    };
    function setFollow(on) {
      S.follow = on;
      followBtn.setAttribute('aria-pressed', String(on));
      if (on && hist.length) tweenCursor(hist[hist.length - 1].R);
    }
    followBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    followBtn.addEventListener('click', () => setFollow(!S.follow));

    // live-demo shot → bead on the curve (+ follow)
    function chartShot(r) {
      beads.push({ R: r, pm: matchedAt(r), pc: cvAt(r), cmp: S.cmp, half: S.mode === 'half', t0: performance.now() / 1000 });
      while (beads.length > NB) beads.shift();
      if (S.follow && V3.swept) tweenCursor(r);
    }

    /* ---- pointer: drag inside the chart moves the cursor; drag outside orbits ---- */
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), zPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hitP = new THREE.Vector3();
    const planeX = (e) => {
      const st = m3?.stage; if (!st) return null;
      const r = stageEl.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
      ray.setFromCamera(ndc, st.camera);
      return ray.ray.intersectPlane(zPlane, hitP) ? hitP : null;
    };
    const inChart = (p) => p && p.x > -WD / 2 - 0.3 && p.x < WD / 2 + 0.3 && p.y > -0.2 && p.y < HC + 0.5;
    const ohmAt = (p) => 75 + ((p.x + WD / 2) / WD) * 275;
    let drag = null;
    stageEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const p = planeX(e);
      drag = { mode: inChart(p) ? 'cursor' : 'orbit', x: e.clientX, y: e.clientY };
      try { stageEl.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ }
      if (drag.mode === 'cursor') { setCursor(ohmAt(p), true); stageEl.focus({ preventScroll: true }); }
      stageEl.classList.add(drag.mode === 'cursor' ? 'is-cur' : 'is-orbit');
    });
    stageEl.addEventListener('pointermove', (e) => {
      const r = stageEl.getBoundingClientRect();
      V3.pxT = ((e.clientX - r.left) / r.width) * 2 - 1; V3.pyT = -(((e.clientY - r.top) / r.height) * 2 - 1);
      if (!drag) { stageEl.classList.toggle('is-over', inChart(planeX(e))); return; }
      if (drag.mode === 'cursor') { const p = planeX(e); if (p) setCursor(ohmAt(p), true); }
      else { V3.az = cl(V3.az - (e.clientX - drag.x) * 0.0045, -1.1, 1.1); V3.el = cl(V3.el + (e.clientY - drag.y) * 0.0035, -0.25, 0.6); drag.x = e.clientX; drag.y = e.clientY; }
    });
    const endDrag = () => { drag = null; stageEl.classList.remove('is-cur', 'is-orbit'); };
    stageEl.addEventListener('pointerup', endDrag); stageEl.addEventListener('pointercancel', endDrag);
    stageEl.addEventListener('pointerleave', () => { V3.pxT = 0; V3.pyT = 0; });
    stageEl.addEventListener('keydown', (e) => {
      const d = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -25, PageUp: 25 }[e.key];
      if (e.key === 'Home') { setCursor(75, true); e.preventDefault(); }
      else if (e.key === 'End') { setCursor(350, true); e.preventDefault(); }
      else if (d) { setCursor(S.cursor + d, true); e.preventDefault(); }
    });

    /* ---- the scene ---- */
    let m3 = null;
    const I0 = { target: [-0.2, 0.55, 0], radius: 9.4, azimuth: -1.05, elevation: 0.62 };
    const oc = { target: [0, 0, 0], radius: 1, azimuth: 0, elevation: 0 };
    const _c = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
    function build3(stage) {
      const comp = createLoadCurve3D(THREE, { load: LC.load, full: LC.full, half: LC.half, rated: [100, 250] });
      stage.scene.add(comp.object3d);
      const k = stage.lights.key; Object.assign(k.shadow.camera, { left: -3.4, right: 3.4, top: 3.4, bottom: -3.4 }); k.shadow.camera.updateProjectionMatrix();
      const extra = new THREE.Group(); stage.scene.add(extra);
      // 对比：恒压 P = V²/R (dashed tube, clipped at the top of the chart box)
      const mkCmp = (pset) => {
        const r0 = Math.max(75, (pset * R_REF) / YCAP), pts = [];
        for (let i = 0; i <= 90; i++) { const r = r0 + ((350 - r0) * i) / 90; pts.push(new THREE.Vector3(X3(r), Y3((pset * R_REF) / r), 0.2)); }
        const u = { uRev: { value: 1 }, uOp: { value: 1 } };
        const mat = new THREE.ShaderMaterial({
          uniforms: u, transparent: true, depthWrite: false, toneMapped: false,
          vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'uniform float uRev; uniform float uOp; varying vec2 vUv; void main(){ if (vUv.x > uRev || fract(vUv.x * 44.0) > 0.56) discard; gl_FragColor = vec4(1.0, 0.47, 0.32, uOp); }',
        });
        const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, 0.014, 8, false), mat);
        mesh.renderOrder = 8; mesh.visible = false; extra.add(mesh);
        return { mesh, u, r0, top: new THREE.Vector3(X3(r0), Y3((pset * R_REF) / r0), 0.2) };
      };
      const cmp = { full: mkCmp(PSET.full), half: mkCmp(PSET.half) };
      const ringGeo = new THREE.TorusGeometry(0.08, 0.009, 8, 56);
      const cmpRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff7a55, toneMapped: false, transparent: true })); extra.add(cmpRing);
      const cmpStem = new THREE.Mesh(new THREE.BoxGeometry(0.008, 1, 0.008), new THREE.MeshBasicMaterial({ color: 0xff7a55, toneMapped: false, transparent: true, opacity: 0.55 })); extra.add(cmpStem);
      // 半功率 marker (the component's marker always rides the full-power curve)
      const halfDot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), new THREE.MeshBasicMaterial({ color: 0xd9ccff, toneMapped: false })); extra.add(halfDot);
      const halfRing = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.007, 8, 64), new THREE.MeshBasicMaterial({ color: 0xb79bff, toneMapped: false, transparent: true })); extra.add(halfRing);
      // shot beads: glowing points + cores; compare error stems
      const bPos = new Float32Array(NB * 2 * 3), bCol = new Float32Array(NB * 2 * 3);
      const bGeo = new THREE.BufferGeometry();
      bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3).setUsage(THREE.DynamicDrawUsage));
      bGeo.setAttribute('color', new THREE.BufferAttribute(bCol, 3).setUsage(THREE.DynamicDrawUsage));
      const glowTex = S3.glowTexture(THREE, 128);
      const bPts = new THREE.Points(bGeo, new THREE.PointsMaterial({ size: 0.56, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, sizeAttenuation: true }));
      bPts.frustumCulled = false; bPts.renderOrder = 9; extra.add(bPts);
      const cores = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 18, 12), new THREE.MeshBasicMaterial({ toneMapped: false }), NB * 2);
      cores.frustumCulled = false; extra.add(cores);
      for (let i = 0; i < NB * 2; i++) cores.setColorAt(i, _c.set(0xffffff));
      const errs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.007, 1, 0.007), new THREE.MeshBasicMaterial({ color: 0xff7a55, toneMapped: false, transparent: true, opacity: 0.6 }), NB);
      errs.frustumCulled = false; extra.add(errs);
      additiveKeepsAlpha(THREE, comp.object3d); additiveKeepsAlpha(THREE, extra);
      V3.sig = '';
      return { comp, extra, cmp, cmpRing, cmpStem, halfDot, halfRing, bPts, bPos, bCol, cores, errs, glowTex };
    }
    const mint3 = new THREE.Color(C.mint), lilac3 = new THREE.Color(C.lilac), warn3 = new THREE.Color(0xff7a55);
    function frame3(s, stage, t, dt) {
      const cv = stage.renderer.domElement, w = cv.clientWidth, h = cv.clientHeight;
      const now = performance.now() / 1000;
      if (reduced) { // a single still per state change
        const sg = `${w}x${h}|${S.cursorF.toFixed(2)}|${S.mode}|${S.cmp}|${beads.length}:${beads.length ? beads[beads.length - 1].t0 : 0}|${V3.az.toFixed(3)},${V3.el.toFixed(3)}`;
        if (sg === V3.sig) return; V3.sig = sg;
      }
      const k4 = reduced ? 1 : 1 - Math.exp(-dt * 4);
      V3.rev += (V3.revT - V3.rev) * k4; V3.cam += (V3.camT - V3.cam) * (reduced ? 1 : 1 - Math.exp(-dt * 3));
      if (!V3.swept && V3.rev > 0.985) { V3.swept = true; if (!root.style.getPropertyValue('--imp-cur')) sweepCursor(); }
      const rv = V3.rev, { comp } = s, half = S.mode === 'half';
      comp.update({ t: reduced ? 0 : t, reveal: rv, ohm: S.cursorF, half: half ? 1 : 0.55, band: 1, cursor: 1, labels: 1 });

      // compare curve + ghost marker
      V3.cmpA += ((S.cmp ? 1 : 0) - V3.cmpA) * (reduced ? 1 : 1 - Math.exp(-dt * 6));
      if (S.cmp && V3.cmpRev < 1) V3.cmpRev = reduced ? 1 : Math.min(1, V3.cmpRev + dt / 1.1);
      const cmpOn = V3.cmpA > 0.01 && rv > 0.95;
      for (const key of ['full', 'half']) { const c = s.cmp[key]; c.mesh.visible = cmpOn && (key === 'half') === half; c.u.uOp.value = V3.cmpA; c.u.uRev.value = V3.cmpRev; }
      const pc = cvAt(S.cursorF), yc = Y3(Math.min(pc, YCAP)), xc = X3(S.cursorF), pm = matchedAt(S.cursorF);
      s.cmpRing.visible = s.cmpStem.visible = cmpOn;
      s.cmpRing.position.set(xc, yc, 0.2); s.cmpRing.material.opacity = V3.cmpA;
      s.cmpStem.position.set(xc, (yc + Y3(pm)) / 2, 0.2); s.cmpStem.scale.set(1, Math.max(1e-3, Math.abs(yc - Y3(pm))), 1); s.cmpStem.material.opacity = 0.55 * V3.cmpA;
      // half marker
      s.halfDot.visible = s.halfRing.visible = half && rv > 0.9;
      s.halfDot.position.set(xc, Y3(interp(LC.load, LC.half, S.cursorF)), 0); s.halfRing.position.copy(s.halfDot.position);
      s.halfRing.rotation.z = t * 1.2; s.halfRing.material.opacity = 0.9;

      // beads (live shots)
      let ei = 0;
      for (let i = 0; i < NB * 2; i++) { _m.makeScale(0, 0, 0); s.cores.setMatrixAt(i, _m); s.bPos[i * 3 + 1] = -99; s.bCol[i * 3] = s.bCol[i * 3 + 1] = s.bCol[i * 3 + 2] = 0; }
      beads.forEach((b, i) => {
        const age = reduced ? 1 : now - b.t0;
        const drop = S3.ease.out(cl(age / 0.45)), fade = 1 - cl((age - 4.2) / 3.2);
        if (fade <= 0) return;
        const x = X3(b.R), y = Y3(b.pm) + (1 - drop) * 0.55, a = fade * (0.35 + 0.65 * drop);
        const col = b.half ? lilac3 : mint3;
        s.bPos.set([x, y, 0.15], i * 3); s.bCol.set([col.r * a * 1.5, col.g * a * 1.5, col.b * a * 1.5], i * 3);
        _s.setScalar(a); _p.set(x, y, 0.15); _m.compose(_p, _q, _s); s.cores.setMatrixAt(i, _m); s.cores.setColorAt(i, _c.copy(col).lerp(new THREE.Color(1, 1, 1), 0.5));
        if (b.cmp && S.cmp) {
          const yg = Y3(Math.min(b.pc, YCAP)), j = NB + i;
          s.bPos.set([x, yg, 0.2], j * 3); s.bCol.set([warn3.r * a * 0.8, warn3.g * a * 0.8, warn3.b * a * 0.8], j * 3);
          _s.setScalar(a * 0.8); _p.set(x, yg, 0.2); _m.compose(_p, _q, _s); s.cores.setMatrixAt(j, _m); s.cores.setColorAt(j, warn3);
          _s.set(1, Math.max(1e-3, Math.abs(yg - y)), 1); _p.set(x, (yg + y) / 2, 0.17); _m.compose(_p, _q, _s); s.errs.setMatrixAt(ei++, _m);
        }
      });
      for (let i = ei; i < NB; i++) { _m.makeScale(0, 0, 0); s.errs.setMatrixAt(i, _m); }
      s.errs.instanceMatrix.needsUpdate = true; s.cores.instanceMatrix.needsUpdate = true; if (s.cores.instanceColor) s.cores.instanceColor.needsUpdate = true;
      s.bPts.geometry.attributes.position.needsUpdate = true; s.bPts.geometry.attributes.color.needsUpdate = true;

      // camera: scroll intro → comp.view, + pointer parallax + drag orbit (springs back)
      const asp = w / Math.max(1, h), narrow = asp < 1.2, fit = narrow ? Math.pow(1.5 / asp, 0.6) : Math.max(0.92, Math.pow(1.5 / asp, 0.9));
      const kc = S3.ease.inOut(V3.cam), vw = comp.view;
      for (let i = 0; i < 3; i++) oc.target[i] = I0.target[i] + (vw.target[i] - I0.target[i]) * kc;
      oc.radius = (I0.radius + (vw.radius - I0.radius) * kc) * fit;
      if (!reduced) {
        const kp = 1 - Math.exp(-dt * 3);
        V3.px += ((V3.pxT || 0) - V3.px) * kp; V3.py += ((V3.pyT || 0) - V3.py) * kp;
        if (!drag || drag.mode !== 'orbit') { const d = Math.exp(-dt * 0.8); V3.az *= d; V3.el *= d; }
      }
      oc.azimuth = I0.azimuth + ((narrow ? -0.26 : vw.azimuth) - I0.azimuth) * kc + V3.az + V3.px * 0.06 + (reduced ? 0 : 0.03 * Math.sin(t * 0.2));
      oc.elevation = cl(I0.elevation + (vw.elevation - I0.elevation) * kc + V3.el - V3.py * 0.03, -0.1, 1.1);
      stage.orbit(oc);
      stage.render();

      // DOM labels stuck to the 3D chart
      const cam = stage.camera, r = Math.round(S.cursorF), inBand = r >= 100 && r <= 250;
      for (const l of LBL) {
        let src = null, on = rv > 0.97, ax = -0.5, ay = -1, dx = 0, dy = -10;
        if (l.a === 'marker') {
          const html = half ? `${r} Ω → <b>${fmtP(r, LC.half)} W</b>${w < 480 ? '' : ' · 半功率'}` : `${r} Ω → <b>${fmtP(r, LC.full)} W</b>${w < 480 ? '' : inBand ? ' · 额定负载内' : ' · 额定负载外'}`;
          if (html !== l.html) { l.html = html; l.el.innerHTML = html; l.el.classList.toggle('is-out', !inBand && !half); }
          src = half ? _p.copy(s.halfDot.position).setY(s.halfDot.position.y + 0.16) : comp.anchors.marker;
        } else if (l.a === 'band') { src = _p.set(X3(175), 0.08, -0.42); on = on && w >= 480; }
        else if (l.a === 'half') { src = comp.anchors.half; on = on && !half; ax = -1; ay = -0.5; dx = -10; dy = 0; }
        else if (l.a === 'cmp') { src = _p.set(X3(318), Y3((PSET[S.mode] * R_REF) / 318), 0.2); on = on && S.cmp && V3.cmpRev > 0.95; ax = -1; ay = 0; dx = 0; dy = 10; }
        const o = projectAnchor(THREE, src, cam, w, h, l.out);
        const vis = on && o.visible && o.x > 4 && o.x < w - 4 && o.y > 4 && o.y < h - 4;
        if (vis !== l.on) { l.on = vis; l.el.classList.toggle('is-on', vis); }
        if (vis) {
          if (ax === -0.5 && o.x < w * 0.16) ax = 0; else if (ax === -0.5 && o.x > w * 0.84) ax = -1;
          l.el.style.transform = `translate3d(${(o.x + dx).toFixed(1)}px, ${(o.y + dy).toFixed(1)}px, 0) translate(${ax * 100}%, ${ay * 100}%)`;
        }
      }
    }
    const fontsOK = Promise.all(['600 40px Montserrat', '500 40px Montserrat'].map((f) => document.fonts?.load(f))).catch(() => {});
    fontsOK.then(() => {
      m3 = mount3D(stageEl, {
        THREE, stageLib: precompileLib(freshStageLib(S3)), dpr: 1.5, stageOpts: { fov: 30, transparent: true, exposure: 1.05 },
        build: build3, frame: frame3,
        dispose(s) { s?.comp?.dispose(); s?.glowTex?.dispose(); s?.extra?.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); },
        fallback(c) { c.classList.add('is-nogl'); },
      });
    });
    if (!reduced) {
      ScrollTrigger.create({ trigger: stageEl, start: 'top 92%', end: 'top 30%', onUpdate: (st) => { V3.revT = Math.max(V3.revT, st.progress); V3.camT = st.progress; }, onLeave: () => { V3.revT = 1; V3.camT = 1; }, onEnterBack: () => { V3.camT = 1; } });
    }

    /* =============== mode / compare / play =============== */
    function applyMode() {
      el.seg.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === S.mode)));
      root.classList.toggle('imp--half', S.mode === 'half');
      el.set.textContent = PSET[S.mode];
      tweenNum(el.w, PSET[S.mode]);
      setCursor(S.cursorF);
      still();
    }
    function applyCmp() {
      el.cmp.setAttribute('aria-pressed', String(S.cmp));
      root.classList.toggle('imp--cmp', S.cmp);
      if (S.cmp) V3.cmpRev = reduced ? 1 : 0; // the 3D P = V²/R curve draws in
      still();
    }
    el.seg.forEach((b) => b.addEventListener('click', () => { S.mode = b.dataset.mode; applyMode(); }));
    el.cmp.addEventListener('click', () => { S.cmp = !S.cmp; applyCmp(); });
    el.play.addEventListener('click', () => {
      S.playing = !S.playing;
      if (S.playing) ensureLoop(); else still();
      el.play.setAttribute('aria-pressed', String(S.playing));
      el.play.querySelector('.imp-play__t').textContent = S.playing ? '暂停' : '播放';
    });
    const numT = new WeakMap();
    function tweenNum(node, v, dec = 0) {
      if (reduced) { node.textContent = v.toFixed(dec); return; }
      const o = numT.get(node) || { v: parseFloat(node.textContent) || 0 };
      numT.set(node, o);
      gsap.to(o, { v, duration: 0.45, ease: 'power3.out', overwrite: true, onUpdate: () => (node.textContent = o.v.toFixed(dec)) });
    }

    /* =============== network svg =============== */
    const net = $('.imp-net__svg');
    const layers = [[60, 140], [40, 100, 160], [70, 130], [100]];
    const nx = [10, 32, 54, 74];
    const edges = [];
    for (let a = 0; a < layers.length - 1; a++) for (const y1 of layers[a]) for (const y2 of layers[a + 1]) {
      edges.push(S_('path', { d: `M${nx[a]} ${y1}C${nx[a] + 10} ${y1} ${nx[a + 1] - 10} ${y2} ${nx[a + 1]} ${y2}`, class: 'imp-e', style: `--d:${a * 0.12}s` }, net));
    }
    const nodesSvg = [];
    layers.forEach((ys, a) => ys.forEach((y) => nodesSvg.push(S_('circle', { cx: nx[a], cy: y, r: a === 3 ? 4.5 : 3.4, class: 'imp-n', style: `--d:${a * 0.12}s` }, net))));
    function netPulse() {
      if (reduced) return;
      net.classList.remove('is-pulse'); void net.getBBox(); net.classList.add('is-pulse');
    }

    /* =============== live canvases =============== */
    const tissueCv = $('.imp-tissue canvas'), gaugeCv = $('.imp-gauge canvas'), scopeCv = $('.imp-scope canvas');
    let fT = null, fG = null, fS = null;
    const fit = () => { fT = lib.fitCanvas(tissueCv); fG = lib.fitCanvas(gaugeCv); fS = lib.fitCanvas(scopeCv); };
    fit();
    const hist = [];      // {R, t0}
    let simT = 0, phase = 0, prevR = S.R, rBlend = 1, ghostNeedle = PSET.full, needle = PSET.full;
    const nextR = () => {
      // bounded random walk inside the rated load range (原理示意)
      let r = S.R + (Math.random() - 0.5) * 90;
      if (Math.random() < 0.18) r = 110 + Math.random() * 130;
      return cl(r, 104, 246);
    };
    function newShot() {
      prevR = S.R; S.R = nextR(); rBlend = 0; S.shot++;
      hist.push({ R: S.R, t0: simT });
      while (hist.length > 12) hist.shift();
      tweenNum(el.r, S.R);
      el.count.textContent = String(S.shot % 1000).padStart(3, '0');
      const pos = (S.R - 75) / (350 - 75);
      el.meterMk.style.left = `${(pos * 100).toFixed(1)}%`;
      el.g.textContent = Math.round(cvAt(S.R));
      netPulse();
      chartShot(S.R);
    }

    const cells = Array.from({ length: 46 }, (_, i) => ({ x: hash(i * 1.7), y: hash(i * 2.9 + 4), r: 0.07 + 0.05 * hash(i * 5.3) }));
    function drawTissue(t) {
      const { cssW: w, cssH: h, dpr } = fT; if (w < 2) return;
      const c = tissueCv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
      const k = cl((S.R - 100) / 150), kp = cl((prevR - 100) / 150), b = cl(rBlend);
      const mix = kp + (k - kp) * b;
      const s = S.shot, sp = s - 1;
      const col = (m) => { const a = [127, 212, 255], v = [160, 124, 255]; return a.map((x, i) => Math.round(x + (v[i] - x) * m)); };
      const [r0, g0, b0] = col(mix);
      // tip plate (top)
      const inRF = phase >= RF_ON[0] && phase < RF_ON[1];
      c.fillStyle = inRF ? withA(C.mint, 0.9) : 'rgba(255,196,94,0.55)';
      if (inRF) { c.shadowColor = C.mint; c.shadowBlur = 14; }
      c.fillRect(w * 0.18, 0, w * 0.64, 4); c.shadowBlur = 0;
      cells.forEach((cc, i) => {
        const jx = (hash(i + s * 7.1) - hash(i + sp * 7.1)) * b + hash(i + sp * 7.1);
        const jy = (hash(i * 3 + s * 3.3) - hash(i * 3 + sp * 3.3)) * b + hash(i * 3 + sp * 3.3);
        const x = (cc.x + (jx - 0.5) * 0.06) * w;
        const y = 8 + (cc.y + (jy - 0.5) * 0.06) * (h - 10);
        const rr = cc.r * w * (0.8 + 0.4 * ((hash(i + s) - hash(i + sp)) * b + hash(i + sp))) * (0.85 + 0.3 * (1 - mix));
        const gr = c.createRadialGradient(x, y, 0, x, y, rr);
        gr.addColorStop(0, `rgba(${r0},${g0},${b0},${0.28 + (inRF ? 0.12 : 0)})`);
        gr.addColorStop(0.7, `rgba(${r0},${g0},${b0},0.08)`);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = gr; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.fill();
        c.strokeStyle = `rgba(${r0},${g0},${b0},0.22)`; c.lineWidth = 0.8; c.beginPath(); c.arc(x, y, rr * 0.62, 0, TAU); c.stroke();
      });
      if (inRF) {
        // current lines from the tip into tissue
        const u = (phase - RF_ON[0]) / (RF_ON[1] - RF_ON[0]);
        for (let i = 0; i < 9; i++) {
          const x = w * (0.22 + 0.07 * i);
          const len = h * (0.35 + 0.5 * hash(i + s));
          const yy = ((simT * 90 + i * 23) % len); // simT only advances while playing → frozen when paused
          c.fillStyle = withA(C.mint, 0.5 * (1 - yy / len) * Math.sin(Math.PI * u));
          c.fillRect(x, 6 + yy, 1.4, 6);
        }
      }
    }
    function drawGauge() {
      const { cssW: w, cssH: h, dpr } = fG; if (w < 2) return;
      const c = gaugeCv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h - 12, R = Math.min(w * 0.42, h - 34), MAX = 350;
      const ang = (p) => Math.PI + (cl(p, 0, MAX) / MAX) * Math.PI;
      c.lineCap = 'round';
      c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 8; c.beginPath(); c.arc(cx, cy, R, Math.PI, TAU); c.stroke();
      // tolerance band ±20% around setpoint (IFU p.5)
      const set = PSET[S.mode];
      c.strokeStyle = withA(C.mint, 0.18); c.lineWidth = 8; c.lineCap = 'butt';
      c.beginPath(); c.arc(cx, cy, R, ang(set * 0.8), ang(set * 1.2)); c.stroke();
      c.lineCap = 'round';
      c.strokeStyle = withA(C.mint, 0.85); c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, R, Math.PI, ang(needle)); c.stroke();
      for (let p = 0; p <= MAX; p += 50) {
        const a = ang(p), major = p % 100 === 0 || p === 350;
        c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(cx + Math.cos(a) * (R - 12), cy + Math.sin(a) * (R - 12)); c.lineTo(cx + Math.cos(a) * (R - (major ? 20 : 16)), cy + Math.sin(a) * (R - (major ? 20 : 16))); c.stroke();
        if (major && p !== 350) { c.font = mono(9); c.fillStyle = C.t3; c.textAlign = 'center'; c.fillText(String(p), cx + Math.cos(a) * (R - 31), cy + Math.sin(a) * (R - 31) + 3); }
      }
      if (S.cmp) {
        const a = ang(ghostNeedle);
        c.setLineDash([4, 4]); c.strokeStyle = C.warn; c.lineWidth = 2;
        c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86); c.stroke(); c.setLineDash([]);
      }
      const a = ang(needle);
      c.strokeStyle = '#fff'; c.lineWidth = 2.6; c.shadowColor = C.mint; c.shadowBlur = 14;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9); c.stroke(); c.shadowBlur = 0;
      c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, 4.5, 0, TAU); c.fill();
      c.font = mono(9); c.fillStyle = withA(C.mint, 0.8); c.textAlign = 'center';
      c.fillText('±20%', cx + Math.cos(ang(set)) * (R + 12), cy + Math.sin(ang(set)) * (R + 12) + 3);
    }
    function drawScope() {
      const { cssW: w, cssH: h, dpr } = fS; if (w < 2) return;
      const c = scopeCv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
      const L = 46, Rr = w - 10, win = 7.5 * PERIOD;
      const tx = (tt) => Rr - ((simT - tt) / win) * (Rr - L);
      const mid = h * 0.46;
      // lanes
      const lr = { t: 10, b: mid - 10 }, lp = { t: mid + 6, b: h - 16 };
      const yR = (r) => lr.b - ((r - 75) / (275 - 75)) * (lr.b - lr.t);
      const pMax = PSET[S.mode] * 1.55; // setpoint at ~65% of the lane; unmatched ghost pulses (≤ ~1.45×) still fit
      const yP = (p) => lp.b - (cl(p, 0, pMax) / pMax) * (lp.b - lp.t);
      c.fillStyle = 'rgba(183,155,255,0.06)'; c.fillRect(L, yR(250), Rr - L, yR(100) - yR(250));
      c.strokeStyle = C.line; c.lineWidth = 1; c.beginPath();
      c.moveTo(L, yP(0) + 0.5); c.lineTo(Rr, yP(0) + 0.5); c.moveTo(L, mid + 0.5); c.lineTo(Rr, mid + 0.5); c.stroke();
      c.font = mono(9); c.fillStyle = C.t3; c.textAlign = 'right';
      c.fillText('250 Ω', L - 6, yR(250) + 3); c.fillText('100 Ω', L - 6, yR(100) + 3);
      c.fillText(`${PSET[S.mode]} W`, L - 6, yP(PSET[S.mode]) + 3); c.fillText('0', L - 6, yP(0) + 3);
      c.setLineDash([2, 3]); c.strokeStyle = withA(C.mint, 0.25); c.beginPath(); c.moveTo(L, yP(PSET[S.mode])); c.lineTo(Rr, yP(PSET[S.mode])); c.stroke(); c.setLineDash([]);
      c.save(); c.beginPath(); c.rect(L, 0, Rr - L, h); c.clip();
      // impedance steps
      c.strokeStyle = C.lilac; c.lineWidth = 1.6; c.beginPath();
      hist.forEach((s, i) => {
        const x0 = tx(s.t0), x1 = i < hist.length - 1 ? tx(hist[i + 1].t0) : tx(simT);
        const y = yR(s.R);
        if (i === 0) c.moveTo(x0, y); else c.lineTo(x0, y);
        c.lineTo(x1, y);
      });
      c.stroke();
      hist.forEach((s) => { c.fillStyle = C.lilac; c.beginPath(); c.arc(tx(s.t0), yR(s.R), 2.2, 0, TAU); c.fill(); });
      // power pulses
      hist.forEach((s) => {
        const a = s.t0 + RF_ON[0] * PERIOD, b = Math.min(simT, s.t0 + RF_ON[1] * PERIOD);
        if (b <= a) return;
        const x0 = tx(a), x1 = tx(b);
        const pm = S.mode === 'full' ? fullAt(s.R) : halfAt(s.R);
        c.fillStyle = withA(C.mint, 0.22); c.fillRect(x0, yP(pm), x1 - x0, yP(0) - yP(pm));
        c.strokeStyle = C.mint; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x0, yP(0)); c.lineTo(x0, yP(pm)); c.lineTo(x1, yP(pm)); c.lineTo(x1, yP(0)); c.stroke();
        if (S.cmp) {
          const pc = cvAt(s.R);
          c.setLineDash([3, 3]); c.strokeStyle = C.warn; c.lineWidth = 1.4;
          c.beginPath(); c.moveTo(x0 + 2, yP(0)); c.lineTo(x0 + 2, yP(pc)); c.lineTo(x1 - 2, yP(pc)); c.lineTo(x1 - 2, yP(0)); c.stroke(); c.setLineDash([]);
        }
      });
      c.restore();
      c.strokeStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.moveTo(Rr + 0.5, 6); c.lineTo(Rr + 0.5, h - 12); c.stroke();
      c.font = sans(10); c.textAlign = 'left';
      c.fillStyle = 'rgba(7,7,12,0.7)'; c.fillRect(L + 2, lr.t - 1, 30, 15); c.fillRect(L + 2, lp.t - 1, 30, 15);
      c.fillStyle = C.lilac; c.fillText('阻抗', L + 6, lr.t + 10); c.fillStyle = C.mint; c.fillText('功率', L + 6, lp.t + 10);
    }

    function frame(dt, t) {
      if (S.playing) {
        simT += dt; phase += dt / PERIOD;
        if (phase >= 1) { phase -= 1; newShot(); }
      }
      if (dt === 0) { rBlend = 1; needle = PSET[S.mode]; ghostNeedle = cvAt(S.R); } // static redraw → end state
      rBlend = Math.min(1, rBlend + dt * 2.5);
      needle += (PSET[S.mode] - needle) * Math.min(1, dt * 6);
      ghostNeedle += (cvAt(S.R) - ghostNeedle) * Math.min(1, dt * 5);
      drawTissue(t); drawGauge(); drawScope();
    }
    // reduced motion: no rAF loop until the visitor explicitly presses 播放; static redraws on every state change
    let loopCtl = null;
    const ensureLoop = () => { if (!loopCtl) loopCtl = lib.visibleLoop($('.imp-main'), frame); };
    const still = () => { if (!loopCtl) frame(0, 0); };
    lib.onResize(() => { fit(); still(); });
    document.fonts?.ready.then(() => { fit(); still(); });

    // seed a few shots so the scope isn't empty on first view
    for (let i = 0; i < 6; i++) hist.push({ R: (S.R = nextR()), t0: i * PERIOD });
    phase = 0.3; simT = 5 * PERIOD + phase * PERIOD; // the 6th seeded shot is the one in progress
    el.r.textContent = Math.round(S.R);
    el.meterMk.style.left = `${(((S.R - 75) / 275) * 100).toFixed(1)}%`;
    el.g.textContent = Math.round(cvAt(S.R));

    frame(0, 0);
    if (!reduced) ensureLoop(); // pauses off-screen; shots advance only while playing

    setCursor(S.cursor);
    applyMode();

    // intro sweep of the 3D cursor across 75–350 Ω once the chart has built (then it follows the live shots)
    function sweepCursor() {
      const o = { r: S.cursorF };
      curTw?.kill();
      curTw = gsap.timeline({ onComplete: () => { if (S.follow) setFollow(true); } })
        .to(o, { r: 80, duration: 1.2, ease: 'power2.inOut', onUpdate: () => setCursor(o.r) })
        .to(o, { r: 340, duration: 2.2, ease: 'power2.inOut', onUpdate: () => setCursor(o.r) })
        .to(o, { r: 180, duration: 1.2, ease: 'power2.inOut', onUpdate: () => setCursor(o.r) });
    }

    /* =============== 图13 level → power =============== */
    const lvSvg = $('.imp-lvsvg');
    const LV = lib.LEVELS;
    const H13 = { l: 46, r: 18, t: 30, b: 40, W: 640, H: 300 };
    const lx = (i) => H13.l + (i / 15) * (H13.W - H13.l - H13.r);
    const ly = (p) => H13.H - H13.b - (p / 200) * (H13.H - H13.t - H13.b);
    const gA = S_('g', { class: 'axis' }, lvSvg);
    for (let p = 0; p <= 200; p += 40) {
      S_('line', { x1: H13.l, x2: H13.W - H13.r, y1: ly(p), y2: ly(p), class: 'gridline' }, gA);
      S_('text', { x: H13.l - 8, y: ly(p) + 4, 'text-anchor': 'end' }, gA).textContent = p;
    }
    LV.forEach((lv, i) => { if (i % 2 === 1 || i === 0) S_('text', { x: lx(i), y: H13.H - H13.b + 18, 'text-anchor': 'middle', class: i === 0 ? 'imp-x0' : '' }, gA).textContent = lv % 1 ? lv : lv.toFixed(0); });
    S_('text', { x: H13.l - 8, y: H13.t - 14, 'text-anchor': 'start', class: 'imp-axlab imp-axlab--y' }, gA).textContent = '输出功率 (W)';
    S_('text', { x: H13.W - H13.r, y: H13.H - 6, 'text-anchor': 'end', class: 'imp-axlab imp-axlab--x' }, gA).textContent = '能量强度';
    const bars = LV.map((lv, i) => S_('rect', { x: lx(i) - 7, width: 14, y: ly(lib.levelPower(lv)), height: ly(0) - ly(lib.levelPower(lv)), rx: 3, class: 'imp-lvbar' }, lvSvg));
    const lvLine = S_('polyline', { points: LV.map((lv, i) => `${lx(i)},${ly(lib.levelPower(lv))}`).join(' '), class: 'imp-lvline' }, lvSvg);
    const lvDots = LV.map((lv, i) => S_('circle', { cx: lx(i), cy: ly(lib.levelPower(lv)), r: 3.2, class: 'imp-lvdot' }, lvSvg));
    const lvLabs = LV.map((lv, i) => {
      const tt = S_('text', { x: lx(i), y: ly(lib.levelPower(lv)) - 10, 'text-anchor': 'middle', class: `imp-lvlab${lv % 1 ? ' imp-lvlab--half' : ''}` }, lvSvg);
      tt.textContent = lib.levelPower(lv); return tt;
    });
    const riser = S_('path', { class: 'imp-riser', d: '' }, lvSvg);
    const riserT = S_('text', { class: 'imp-riser-t', 'text-anchor': 'start' }, lvSvg);
    const lvMk = S_('g', { class: 'imp-lvmk' }, lvSvg);
    S_('line', { x1: 0, x2: 0, y1: 0, y2: 0, class: 'imp-lvmk__l' }, lvMk);
    S_('line', { class: 'imp-lvmk__h' }, lvMk);
    S_('circle', { r: 8, class: 'imp-lvmk__halo' }, lvMk);
    S_('circle', { r: 5, class: 'imp-lvmk__c' }, lvMk);
    const range = $('.imp-scrub input');
    const lvRead = { lv: $('[data-l="lv"]'), w: $('[data-l="w"]') };
    const mk = { i: S.lv - 1 };
    function placeLv(fi) {
      const i0 = Math.floor(fi), f = fi - i0, i1 = Math.min(15, i0 + 1);
      const p = lib.levelPower(LV[i0]) + (lib.levelPower(LV[i1]) - lib.levelPower(LV[i0])) * f;
      const x = lx(fi), y = ly(p);
      const [l, hl, halo, c] = lvMk.children;
      l.setAttribute('x1', x); l.setAttribute('x2', x); l.setAttribute('y1', y); l.setAttribute('y2', ly(0));
      hl.setAttribute('x1', H13.l); hl.setAttribute('x2', x); hl.setAttribute('y1', y); hl.setAttribute('y2', y);
      halo.setAttribute('cx', x); halo.setAttribute('cy', y); c.setAttribute('cx', x); c.setAttribute('cy', y);
    }
    function setLv(i, animate = true) {
      i = cl(Math.round(i), 0, 15);
      S.lv = i + 1;
      range.value = String(i);
      range.style.setProperty('--p', `${(i / 15) * 100}%`);
      bars.forEach((b, j) => b.classList.toggle('is-on', j <= i));
      lvDots.forEach((d, j) => d.classList.toggle('is-cur', j === i));
      lvLabs.forEach((d, j) => d.classList.toggle('is-cur', j === i));
      lvRead.lv.textContent = LV[i].toFixed(1);
      tweenNum(lvRead.w, lib.levelPower(LV[i]));
      if (i > 0) {
        const xa = lx(i - 1), xb = lx(i), ya = ly(lib.levelPower(LV[i - 1])), yb = ly(lib.levelPower(LV[i]));
        riser.setAttribute('d', `M${xa} ${ya}H${xb}V${yb}`);
        riserT.setAttribute('x', xb + 8); riserT.setAttribute('y', (ya + yb) / 2 + 4);
        riserT.textContent = '+10 W';
      } else { riser.setAttribute('d', ''); riserT.textContent = ''; }
      if (animate && !reduced) gsap.to(mk, { i, duration: 0.5, ease: 'power3.out', overwrite: true, onUpdate: () => placeLv(mk.i) });
      else { mk.i = i; placeLv(i); }
    }
    range.addEventListener('input', () => setLv(+range.value));
    let lvDrag = false;
    const lvFromEvt = (e) => {
      const pt = lvSvg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(lvSvg.getScreenCTM().inverse());
      return ((p.x - H13.l) / (H13.W - H13.l - H13.r)) * 15;
    };
    lvSvg.addEventListener('pointerdown', (e) => { lvDrag = true; lvSvg.setPointerCapture(e.pointerId); setLv(lvFromEvt(e)); });
    lvSvg.addEventListener('pointermove', (e) => { if (lvDrag) setLv(lvFromEvt(e)); });
    lvSvg.addEventListener('pointerup', () => (lvDrag = false));
    lvSvg.addEventListener('pointercancel', () => (lvDrag = false));
    setLv(S.lv - 1, false);
    // keep SVG text at a constant on-screen size (viewBox is scaled on narrow screens)
    function scaleSvgText() {
      const k2 = H13.W / Math.max(1, lvSvg.getBoundingClientRect().width);
      lvSvg.style.setProperty('--k', k2.toFixed(3));
      lvSvg.classList.toggle('is-narrow', k2 > 1.4);
    }
    scaleSvgText();
    lib.onResize(scaleSvgText);
    if (!reduced) {
      const len = polyLen(lvLine);
      lvLine.style.strokeDasharray = `${len}`; lvLine.style.strokeDashoffset = `${len}`;
      gsap.set(bars, { scaleY: 0, transformOrigin: '50% 100%' });
      gsap.set(lvLabs, { opacity: 0 });
      onceVisible(lvSvg, () => {
        {
          gsap.timeline()
            .to(bars, { scaleY: 1, duration: 0.7, stagger: 0.04, ease: 'expo.out' })
            .to(lvLine, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' }, 0.1)
            .to(lvLabs, { opacity: 1, duration: 0.3, stagger: 0.03 }, 0.5)
            .add(() => { const o = { i: 0 }; gsap.fromTo(o, { i: 0 }, { i: 11, duration: 1.6, ease: 'power2.inOut', onUpdate: () => setLv(o.i, false) }); }, 0.6);
        }
      }, 0.3);
    }
  },
};

function interp(xs, ys, x) {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) { const f = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[i - 1] + (ys[i] - ys[i - 1]) * f; }
  }
  return ys[ys.length - 1];
}
function polyLen(pl) {
  const p = pl.getAttribute('points').trim().split(/\s+/).map((s) => s.split(',').map(Number));
  let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return L;
}
