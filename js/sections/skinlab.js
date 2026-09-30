// #skinlab — 由内而外 · 肌肤变化实验室
// One master timeline (① 治疗前 → ⑥ 肌肤表面) drives two procedural, deterministic WebGL engines:
//   SkinFX.Histology  (js/fx/histology.js)    — H&E / dark-field skin cross-section
//   SkinFX.Surface    (js/fx/skin-surface.js) — macro skin surface with raking light
// The engines are classic scripts injected from init(); this module owns time, easing and UI.
// Everything drawn is a SIMULATION (模拟示意). Collagen readouts interpolate DATA.charts.collagen
// (values read off the brochure chart, ≈ 估读 · DA p.4 · 实验猪切片研究). Device/biology facts cite IFU/DA pages inline.

const LABEL = '模拟示意 · 基于彩页组织学与临床资料的原理可视化，不代表个体实际效果';
const MAX_DPR = 1.5;
const LAST = 5; // milestones 0..5

// ---- stage copy (titles fixed by the brief; quotes verbatim from the cited pages) ----
const STAGES = [
  {
    short: '治疗前', title: '治疗前', sub: '基线',
    desc: '真皮胶原束排列疏松，束间可见较宽的白色间隙；皮肤表面可见表情纹沟槽。',
    quote: '利用射频热效应减轻面部轻、中度皮肤皱纹。', src: '使用说明书 第 4 页 · 适用范围', // src: IFU p.4
  },
  {
    short: '射频传送', title: '射频传送', sub: '治疗中',
    desc: '6.78 MHz 单极电容耦合射频：电流自治疗头下行，经组织流向中性电极片，真皮升温；制冷剂冷却电极非患者侧，以传导方式冷却表皮。',
    quote: '用于传送射频能量以选择性加热组织，同时以传导方式冷却表皮', src: '使用说明书 第 10 页', // src: IFU p.10
  },
  {
    short: '即刻收缩', title: '即刻：胶原收缩（原理示意）', sub: '治疗后即刻',
    desc: '射频停止后完成治疗后冷却；受热的胶原束即刻收紧、变直，束间间隙收窄。',
    quote: '', src: '一般射频热效应原理 · 非本产品实测数据',
  },
  {
    short: '第 4 周', title: '第 4 周：胶原新生', sub: '治疗后',
    desc: '修复反应启动，新生胶原逐步填充束间间隙，胶原束更致密。',
    quote: '胶原蛋白含量显著增加（H&E ×200）', src: '彩页 第 4 页 · 实验猪切片研究', // src: DA p.4
  },
  {
    short: '第 12 周', title: '第 12 周：胶原重塑', sub: '治疗后',
    desc: '胶原持续重塑：Ⅰ 型粗束更致密有序，Ⅲ 型细纤维增多。',
    quote: 'Ⅰ 型和 Ⅲ 型胶原同步提升', src: '彩页 第 4 页 · 实验猪切片研究', // src: DA p.4
    hint: '试试「暗场荧光」并突出 Ⅰ 型 / Ⅲ 型胶原',
  },
  {
    short: '肌肤表面', title: '肌肤表面：皱纹形态变化', sub: '治疗后',
    desc: '切片回到 ×2 对比真皮厚度；表面表情纹沟槽变浅、边缘更柔和。',
    quote: '减轻面部轻、中度皮肤皱纹', src: '彩页 第 1 页 · 使用说明书 第 4 页', // src: DA p.1, IFU p.4
    hint: '彩页 ×2 切片：“胶原蛋白厚度明显增加”',
  },
];
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥'];
// every RF shot = 治疗前冷却 → 射频传送 → 治疗后冷却 (IFU p.15) — placed on the master timeline (T units)
const PULSE = [[0.3, 0.6, 'cool'], [0.6, 1.3, 'rf'], [1.3, 1.85, 'cool']];

/* ------------------------------------------------------------------ helpers */
/** write a style only when it changed (no redundant style invalidation in the frame loop) */
function css(el, prop, v) { const c = el.__slc || (el.__slc = {}); if (c[prop] !== v) { c[prop] = v; el.style[prop] = v; } }
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt);
/** piecewise curve through [T, value] keys, smoothstep between keys, flat outside */
function curve(keys) {
  const n = keys.length;
  return (T) => {
    if (T <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < n - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (T <= b[0]) return a[1] + (b[1] - a[1]) * sstep(a[0], b[0], T);
    }
    return keys[n - 1][1];
  };
}
// master-timeline choreography (T = 0..5, milestone k at T = k)
const CV = {
  cool: curve([[0.3, 0], [0.62, 0.72], [1.3, 0.72], [1.85, 0]]),                 // pre-cool → (during RF) → post-cool
  current: curve([[0.6, 0], [0.92, 1], [1.22, 1], [1.42, 0]]),                   // RF on
  heat: curve([[0.62, 0], [1.0, 0.9], [1.25, 0.95], [2.0, 0.2], [2.7, 0]]),      // dermal heating, then residual
  contr: curve([[0.95, 0], [2.0, 1], [2.6, 0.6], [3.0, 0.22], [4.0, 0]]),        // immediate contraction (原理示意)
  week: curve([[2.0, 0], [3.0, 4], [4.0, 12]]),
  mag: curve([[1.4, 0], [2.0, 1], [4.2, 1], [4.9, 0]]),                          // auto microscope: ×2 → ×200 → ×2
  hSplit: curve([[0.12, 0], [0.9, 1]]),
  sHeat: curve([[0.62, 0], [1.0, 0.82], [1.25, 0.88], [2.0, 0.2], [2.6, 0]]),
  wrinkle: curve([[2.2, 1], [3.0, 0.8], [4.0, 0.6], [5.0, 0.4]]),
  texture: curve([[2.2, 1], [5.0, 0.88]]),
  sSplit: curve([[2.25, 0], [3.0, 1]]),
  tilt: curve([[4.1, 0.15], [5.0, 0.3]]),
  elev: curve([[4.1, 0.2], [5.0, 0.15]]),
};
const TIP_ON = [0.28, 2.25];

// scroll ↔ timeline: each milestone owns a plateau of ±H in scroll units (u = 0..5)
const PLATEAU = 0.17;
function uToT(u) {
  u = clamp(u, 0, LAST);
  const k = Math.min(LAST - 1, Math.floor(u)), f = u - k;
  return k + sstep(PLATEAU, 1 - PLATEAU, f);
}
function tToU(T) {
  T = clamp(T, 0, LAST);
  const k = Math.round(T);
  if (Math.abs(T - k) < 1e-4) return k;
  const b = Math.floor(T), g = T - b;
  // invert smoothstep (monotone) by bisection — only runs on user drags
  let lo = 0, hi = 1;
  for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (m * m * (3 - 2 * m) < g) lo = m; else hi = m; }
  return b + PLATEAU + (lo + hi) / 2 * (1 - 2 * PLATEAU);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const prev = document.querySelector(`script[data-skinfx="${src}"]`);
    if (prev) {
      if (prev.dataset.loaded) return resolve();
      prev.addEventListener('load', () => resolve(), { once: true });
      prev.addEventListener('error', () => reject(new Error('failed ' + src)), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = src; s.async = false; s.dataset.skinfx = src;
    s.onload = () => { s.dataset.loaded = '1'; resolve(); };
    s.onerror = () => reject(new Error('failed ' + src));
    document.head.appendChild(s);
  });
}

/* ------------------------------------------------------------------ module */
export default {
  id: 'skinlab',
  nav: '肌肤实验室',
  async init(root, ctx) {
    const { gsap, ScrollTrigger, data } = ctx;
    const reduced = !!ctx.reduced;
    const Cg = data.charts.collagen; // { weeks:[0,4,12], type1:[…], type3:[…] } ≈ 估读 (DA p.4)

    // collagen ratio vs week: smooth saturating fit that passes exactly through the chart points
    function ratioFn(r) {
      const W = Cg.weeks;
      if (W.length === 3 && W[0] === 0 && Math.abs(W[2] - 3 * W[1]) < 1e-9 && r[2] > r[1] && r[1] > r[0]) {
        const R = (r[2] - 1) / (r[1] - 1), x = (-1 + Math.sqrt(4 * R - 3)) / 2;
        const A = (r[1] - 1) / (1 - x), k = -Math.log(x) / W[1];
        return (w) => 1 + A * (1 - Math.exp(-k * clamp(w, 0, W[2])));
      }
      return (w) => { // linear fallback
        if (w <= W[0]) return r[0];
        for (let i = 0; i < W.length - 1; i++) if (w <= W[i + 1]) return r[i] + (r[i + 1] - r[i]) * (w - W[i]) / (W[i + 1] - W[i]);
        return r[r.length - 1];
      };
    }
    const rI = ratioFn(Cg.type1), rIII = ratioFn(Cg.type3);
    const RMAX = Math.max(Cg.type1[2], Cg.type3[2]);

    /* ---------------- DOM ---------------- */
    const chartSvg = buildChart();
    root.innerHTML = `
      <div class="wrap">
        <header class="sec-head">
          <span class="eyebrow">SKIN LAB · 由内而外</span>
          <h2 class="h1 sl-h" data-reveal aria-label="由内而外 · 肌肤变化实验室"><span class="sl-h__k" aria-hidden="true">由内而外<i></i></span><span class="grad-text" aria-hidden="true">肌肤变化实验室</span></h2>
          <p class="lead" data-reveal>拖动时间轴，看一发射频在皮肤里如何展开：6.78 MHz 电流下行、真皮升温与表皮冷却，胶原即刻收缩，第 4 / 12 周胶原新生与重塑，直到皮肤表面的皱纹形态变化。组织切片与皮肤表面两个实时渲染视图同步联动。</p>
          <p class="sl-sim-head" data-reveal><i aria-hidden="true"></i>${LABEL}</p>
        </header>
      </div>

      <div class="sl-stage">
        <div class="sl-bg" aria-hidden="true"><i class="sl-bg__heat"></i><i class="sl-bg__cool"></i><i class="sl-bg__grow"></i></div>
        <div class="wrap wrap--wide sl-frame">
          <div class="sl-top">
            <div class="sl-cap" aria-live="polite">
              <div class="sl-cap__n"><b class="num">01</b><span class="num">/ 06</span></div>
              <div class="sl-cap__txt">
                <h3 class="sl-cap__t"><span class="sl-cap__title">治疗前</span><span class="sl-cap__sub">基线</span></h3>
                <p class="sl-cap__d"></p>
                <p class="sl-sr sl-cap__sr"></p>
              </div>
            </div>
            <div class="sl-chips" role="group" aria-label="图层开关">
              <button type="button" class="sl-chip" data-chip="thermal" aria-pressed="false"><i class="sl-chip__ic sl-chip__ic--heat"></i>热成像</button>
              <button type="button" class="sl-chip" data-chip="current" aria-pressed="false"><i class="sl-chip__ic sl-chip__ic--cur"></i>电流路径</button>
              <button type="button" class="sl-chip" data-chip="hl1" aria-pressed="false"><i class="sl-chip__ic sl-chip__ic--t1"></i>突出 Ⅰ 型胶原</button>
              <button type="button" class="sl-chip" data-chip="hl3" aria-pressed="false"><i class="sl-chip__ic sl-chip__ic--t3"></i>突出 Ⅲ 型胶原</button>
            </div>
          </div>

          <div class="sl-views" data-reveal="scale">
            <figure class="sl-view sl-view--histo">
              <canvas class="sl-cv sl-cv--histo" role="img" aria-label="程序化皮肤组织横截面模拟（H&E 染色风格）：随时间轴显示射频加热、表皮冷却、胶原收缩与第 4、12 周胶原新生（模拟示意）"></canvas>
              <div class="sl-load" aria-hidden="true"><i></i></div>
              <div class="sl-layers" aria-hidden="true">
                <span class="sl-ly sl-ly--x2" data-ly="epi">表皮</span>
                <span class="sl-ly sl-ly--x2" data-ly="derm">真皮层</span>
                <span class="sl-ly sl-ly--x2 sl-ly--pre" data-ly="dermPre">真皮层</span>
                <span class="sl-ly sl-ly--x2" data-ly="sub">皮下组织</span>
                <span class="sl-ly sl-ly--x200" data-ly="epi2">表皮</span>
                <span class="sl-ly sl-ly--x200" data-ly="pap">真皮乳头层</span>
                <span class="sl-ly sl-ly--x200" data-ly="ret">真皮网状层</span>
                <i class="sl-brk sl-brk--now"></i><i class="sl-brk sl-brk--pre"></i>
              </div>
              <div class="sl-hud sl-hud--tl">
                <span class="sl-pill sl-pill--sim" title="${LABEL}">模拟示意</span>
                <span class="sl-pill sl-pill--mode">H&amp;E · 横截面</span>
                <span class="sl-mag num" aria-live="off">×2</span>
              </div>
              <div class="sl-hud sl-hud--tr">
                <div class="sl-seg" role="group" aria-label="染色方式">
                  <button type="button" data-stain="1" aria-pressed="true">明场 H&amp;E</button>
                  <button type="button" data-stain="0" aria-pressed="false">暗场荧光</button>
                </div>
                <div class="sl-seg" role="group" aria-label="放大倍率">
                  <button type="button" data-mag="auto" aria-pressed="true">自动</button>
                  <button type="button" data-mag="0" aria-pressed="false">×2</button>
                  <button type="button" data-mag="1" aria-pressed="false">×200</button>
                </div>
              </div>
              <div class="sl-legend" aria-hidden="true">
                <span>相对温度</span><i class="sl-legend__bar"></i><span class="sl-legend__lh"><em>低</em><em>高</em></span>
                <span class="sl-legend__cool"><i></i>表皮冷却</span>
              </div>
              <div class="sl-scale" aria-hidden="true"><i class="sl-scale__bar"></i><span class="sl-scale__t num">500 µm</span></div>
              <div class="sl-rf" aria-hidden="true"><i class="sl-rf__dot"></i><span class="sl-rf__t">射频传送</span><svg class="sl-rf__w" viewBox="0 0 96 16" preserveAspectRatio="none"><path d="M0 8 Q 6 0 12 8 T 24 8 T 36 8 T 48 8 T 60 8 T 72 8 T 84 8 T 96 8 T 108 8 T 120 8"/></svg><b class="num">${data.specs.rfFreq.split(' ±')[0]}</b></div>
              <span class="sl-side sl-side--l" aria-hidden="true">治疗前</span>
              <span class="sl-side sl-side--r" aria-hidden="true">当前阶段</span>
              <div class="sl-split" role="slider" tabindex="0" aria-label="组织切片对比分割线：左侧治疗前，右侧当前阶段" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" aria-valuetext="治疗前 50%，当前阶段 50%"><span class="sl-split__knob"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6"/></svg></span></div>
            </figure>

            <div class="sl-col">
              <figure class="sl-view sl-view--surf">
                <canvas class="sl-cv sl-cv--surf" role="img" aria-label="程序化皮肤表面微观模拟：射频阶段显示治疗头热区与冷却，第 4 周至第 12 周后表情纹沟槽逐步变浅（模拟示意，不代表个体实际效果）"></canvas>
                <div class="sl-load" aria-hidden="true"><i></i></div>
                <div class="sl-hud sl-hud--tl">
                  <span class="sl-pill sl-pill--sim" title="${LABEL}">模拟示意</span>
                  <span class="sl-pill sl-pill--smode">皮肤表面 · 微观</span>
                </div>
                <div class="sl-hud sl-hud--tr">
                  <span class="sl-dial" aria-hidden="true"><i></i></span>
                  <span class="sl-pill sl-pill--light">掠射光 · 跟随指针</span>
                </div>
                <span class="sl-side sl-side--l" aria-hidden="true">治疗前</span>
                <span class="sl-side sl-side--r" aria-hidden="true">当前阶段</span>
                <div class="sl-split" role="slider" tabindex="0" aria-label="皮肤表面对比分割线：左侧治疗前，右侧当前阶段" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" aria-valuetext="治疗前 50%，当前阶段 50%"><span class="sl-split__knob"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6"/></svg></span></div>
              </figure>

              <div class="sl-read">
                <div class="sl-read__row">
                  <div class="sl-stat sl-stat--wk">
                    <span class="sl-stat__k">周数</span>
                    <span class="sl-stat__v"><b class="num sl-wk">0</b><small>周</small></span>
                    <span class="sl-stat__s sl-wk-sub">基线</span>
                  </div>
                  <div class="sl-stat sl-stat--t1">
                    <span class="sl-stat__k"><i></i>Ⅰ 型胶原</span>
                    <span class="sl-stat__v"><small>≈</small><b class="num sl-r1">1.00</b><small>×</small></span>
                    <span class="sl-bar"><i class="sl-bar1"></i></span>
                  </div>
                  <div class="sl-stat sl-stat--t3">
                    <span class="sl-stat__k"><i></i>Ⅲ 型胶原</span>
                    <span class="sl-stat__v"><small>≈</small><b class="num sl-r3">1.00</b><small>×</small></span>
                    <span class="sl-bar"><i class="sl-bar3"></i></span>
                  </div>
                </div>
                <div class="sl-chart">${chartSvg}</div>
                <p class="sl-read__note">胶原相对含量（以第 0 周为 1）· <b>据彩页图表估读</b><span class="sl-interp" hidden>，区间为插值</span> · 实验猪切片研究（彩页 第 4 页）</p>
              </div>

              <blockquote class="sl-quote">
                <p class="sl-quote__q"></p>
                <footer class="sl-quote__src tag-src"></footer>
              </blockquote>
            </div>
          </div>

          <div class="sl-rail">
            <button type="button" class="sl-rail__nav sl-prev" aria-label="上一阶段"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
            <div class="sl-rail__track">
              <div class="sl-rail__line"><i class="sl-rail__fill"></i></div>
              <div class="sl-rail__pulse" aria-hidden="true">
                ${PULSE.map(([a, b, k], i) => `<i class="sl-pz sl-pz--${k}" style="left:${(a / LAST) * 100}%;width:${((b - a) / LAST) * 100}%"><em>${data.pulsePhases[i]}</em></i>`).join('')}
              </div>
              ${STAGES.map((s, k) => `<button type="button" class="sl-rail__m" data-k="${k}" style="left:${(k / LAST) * 100}%" aria-label="跳到 ${CIRCLED[k]} ${s.short}"><i></i><span><b>${CIRCLED[k]}</b>${s.short}</span></button>`).join('')}
              <div class="sl-rail__kw"><div class="sl-rail__knob" role="slider" tabindex="0" aria-label="时间轴" aria-valuemin="1" aria-valuemax="6" aria-valuenow="1" aria-valuetext="① 治疗前"><i></i></div></div>
            </div>
            <button type="button" class="sl-rail__nav sl-next" aria-label="下一阶段"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
          </div>

          <div class="sl-foot">
            <p class="sl-sim"><i aria-hidden="true"></i><span>${LABEL}</span></p>
            <div class="sl-links">
              <a class="sl-link" href="#collagen">查看真实组织切片与案例 <span aria-hidden="true">→</span></a>
              <a class="sl-link sl-link--2" href="#results">案例效果 <span aria-hidden="true">→</span></a>
            </div>
          </div>
        </div>
      </div>
      <div class="wrap wrap--wide sl-after">
        <p class="sl-foot__note disclaimer">${data.disclaimers.sim} 胶原比值据彩页图表估读（实验猪切片研究），曲线为平滑插值；切片与皮肤表面均为程序化生成，并非真实样本或患者照片。</p>
      </div>`;

    const $ = (s, el = root) => el.querySelector(s);
    const $$ = (s, el = root) => [...el.querySelectorAll(s)];
    const stage = $('.sl-stage');
    const viewH = $('.sl-view--histo'), viewS = $('.sl-view--surf');
    const cvH = $('.sl-cv--histo'), cvS = $('.sl-cv--surf');

    /* ---------------- state ---------------- */
    const S = {
      T: 0, Tt: 0,                  // displayed / target timeline position (0..5)
      k: -1,                        // caption milestone index
      stain: 1, stainT: 1,          // 1 = H&E, 0 = dark-field
      magMode: 'auto', mag: 0,
      thermal: false,
      curOverride: null,            // null = follow the story; true/false = user, cleared when the milestone changes
      cur: 0,
      hl: 0, hlT: 0, hlAmt: 0,
      splitH: 0.5, splitS: 0.5,
      light: 2.05, lightT: 2.05, elevP: 0.2, elevPT: 0.2, pointerAt: -99,
      time: 0, frame: 0,
      dragRail: false,
    };

    /* ---------------- captions & readouts ---------------- */
    const capN = $('.sl-cap__n b'), capTitle = $('.sl-cap__title'), capSub = $('.sl-cap__sub'), capD = $('.sl-cap__d');
    const quoteQ = $('.sl-quote__q'), quoteSrc = $('.sl-quote__src'), quoteEl = $('.sl-quote');
    const wkEl = $('.sl-wk'), wkSub = $('.sl-wk-sub'), r1El = $('.sl-r1'), r3El = $('.sl-r3'), bar1 = $('.sl-bar1'), bar3 = $('.sl-bar3');
    const interpEl = $('.sl-interp');
    const chartCur = $('.sl-chart .c-cur'), chartDot1 = $('.sl-chart .c-d1'), chartDot3 = $('.sl-chart .c-d3');
    const magEl = $('.sl-mag'), modePill = $('.sl-pill--mode'), smodePill = $('.sl-pill--smode');
    const legend = $('.sl-legend'), legendCool = $('.sl-legend__cool');
    const railFill = $('.sl-rail__fill'), railKnob = $('.sl-rail__knob'), railKW = $('.sl-rail__kw'), railMs = $$('.sl-rail__m'), railTrack = $('.sl-rail__track');
    const pz = $$('.sl-pz');
    const prevBtn = $('.sl-prev'), nextBtn = $('.sl-next');
    const dialDot = $('.sl-dial i');
    const rfBadge = $('.sl-rf'), rfT = $('.sl-rf__t');
    let rfPhase = -1;
    const bgHeat = $('.sl-bg__heat'), bgCool = $('.sl-bg__cool'), bgGrow = $('.sl-bg__grow');
    let bgKey = '';
    const chips = Object.fromEntries($$('.sl-chip').map((b) => [b.dataset.chip, b]));

    function setCaption(k) {
      const s = STAGES[k];
      capN.textContent = String(k + 1).padStart(2, '0');
      capTitle.textContent = s.title;
      capSub.textContent = s.sub;
      capD.innerHTML = s.desc + (s.hint ? `<span class="sl-cap__hint">${s.hint}</span>` : '');
      if (s.quote) { quoteQ.textContent = `“${s.quote}”`; quoteEl.classList.remove('is-plain'); }
      else { quoteQ.textContent = '原理示意：胶原受热即刻收缩属一般射频热效应原理，说明书与彩页未给出组织温度数值。'; quoteEl.classList.add('is-plain'); }
      quoteSrc.textContent = '来源：' + s.src;
      const wk = [0, 0, 0, 4, 12, 12][k];
      $('.sl-cap__sr').textContent = k >= 3 ? `第 ${wk} 周，Ⅰ 型胶原约 ${rI(wk).toFixed(2)} 倍，Ⅲ 型胶原约 ${rIII(wk).toFixed(2)} 倍（据彩页图表估读，模拟示意）。` : '';
      railMs.forEach((b, i) => { b.classList.toggle('is-on', i === k); b.setAttribute('aria-current', i === k ? 'step' : 'false'); });
      railKnob.setAttribute('aria-valuenow', String(k + 1));
      prevBtn.setAttribute('aria-disabled', String(k === 0));
      nextBtn.setAttribute('aria-disabled', String(k === LAST));
      railKnob.setAttribute('aria-valuetext', `${CIRCLED[k]} ${s.title}`);
      root.dataset.stage = String(k);
      // restart the caption micro-animation
      if (!reduced) { const c = $('.sl-cap'); c.classList.remove('is-in'); void c.offsetWidth; c.classList.add('is-in'); }
    }

    let lastWk = -1, lastR1 = '', lastR3 = '', lastMag = '', lastInterp = null, lastCx = '';
    function updateReadouts(week, mag) {
      const wr = Math.round(week);
      if (wr !== lastWk) { lastWk = wr; wkEl.textContent = String(wr); }
      const k = Math.round(S.T);
      const sub = k === 0 ? '基线' : k === 1 ? '射频传送中' : week < 0.5 ? '治疗后即刻' : '治疗后';
      if (wkSub.textContent !== sub) wkSub.textContent = sub;
      const a = rI(wr), b = rIII(wr);  // text + bars follow the displayed whole week
      const sa = a.toFixed(2), sb = b.toFixed(2);
      if (sa !== lastR1) { lastR1 = sa; r1El.textContent = sa; bar1.style.transform = `scaleX(${((a - 1) / (RMAX - 1)) * 0.85 + 0.15})`; }
      if (sb !== lastR3) { lastR3 = sb; r3El.textContent = sb; bar3.style.transform = `scaleX(${((b - 1) / (RMAX - 1)) * 0.85 + 0.15})`; }
      const onPoint = Cg.weeks.includes(wr);
      if (onPoint !== lastInterp) { lastInterp = onPoint; interpEl.hidden = onPoint; }
      // chart cursor
      const cx = CH.x(week).toFixed(1);
      if (cx !== lastCx) {
        lastCx = cx;
        chartCur.setAttribute('transform', `translate(${cx} 0)`);
        chartDot1.setAttribute('cy', CH.y(rI(week)).toFixed(1));
        chartDot3.setAttribute('cy', CH.y(rIII(week)).toFixed(1));
      }
      const m = '×' + Math.round(Math.exp(Math.log(2) + (Math.log(200) - Math.log(2)) * mag));
      if (m !== lastMag) { lastMag = m; magEl.textContent = m; }
    }

    /* ---------------- chips / segs ---------------- */
    function syncChips(storyCur) {
      const curOn = S.curOverride ?? storyCur;
      chips.current.setAttribute('aria-pressed', String(!!curOn));
      chips.thermal.setAttribute('aria-pressed', String(S.thermal));
      chips.hl1.setAttribute('aria-pressed', String(S.hlT === 1));
      chips.hl3.setAttribute('aria-pressed', String(S.hlT === 3));
      root.classList.toggle('sl-thermal', S.thermal);
      root.dataset.hl = String(S.hlT);
    }
    chips.thermal.addEventListener('click', () => { S.thermal = !S.thermal; syncChips(storyCurOn()); kick(); });
    chips.current.addEventListener('click', () => { S.curOverride = !(S.curOverride ?? storyCurOn()); syncChips(storyCurOn()); kick(); });
    chips.hl1.addEventListener('click', () => { S.hlT = S.hlT === 1 ? 0 : 1; syncChips(storyCurOn()); kick(); });
    chips.hl3.addEventListener('click', () => { S.hlT = S.hlT === 3 ? 0 : 3; syncChips(storyCurOn()); kick(); });
    const storyCurOn = () => Math.round(S.Tt) === 1;

    $$('[data-stain]').forEach((b) => b.addEventListener('click', () => {
      S.stainT = +b.dataset.stain;
      $$('[data-stain]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      kick();
    }));
    $$('[data-mag]').forEach((b) => b.addEventListener('click', () => {
      S.magMode = b.dataset.mag === 'auto' ? 'auto' : +b.dataset.mag;
      $$('[data-mag]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      kick();
    }));

    /* ---------------- split handles ---------------- */
    const splits = [
      { view: viewH, el: $('.sl-split', viewH), key: 'splitH', vis: 0, pos: 1, w: 1, h: 1, sideL: $('.sl-side--l', viewH), sideR: $('.sl-side--r', viewH) },
      { view: viewS, el: $('.sl-split', viewS), key: 'splitS', vis: 0, pos: 1, w: 1, h: 1, sideL: $('.sl-side--l', viewS), sideR: $('.sl-side--r', viewS) },
    ];
    for (const sp of splits) {
      let grab = 0; // pointer offset from the divider at grab time → the divider never jumps under the finger
      const setFrom = (clientX) => {
        const r = sp.view.getBoundingClientRect();
        S[sp.key] = clamp((clientX - grab - r.left) / r.width, 0.04, 0.96);
        kick();
      };
      sp.el.addEventListener('pointerdown', (e) => {
        if (sp.vis < 0.5 || e.button > 0) return;
        if (e.pointerType === 'mouse') e.preventDefault(); // touch: leave vertical page scroll alone (touch-action: pan-y)
        const r = sp.view.getBoundingClientRect();
        grab = clamp(e.clientX - (r.left + sp.pos * r.width), -24, 24);
        sp.el.setPointerCapture(e.pointerId);
        sp.el.classList.add('is-drag');
      });
      sp.el.addEventListener('pointermove', (e) => { if (sp.el.hasPointerCapture(e.pointerId)) setFrom(e.clientX); });
      const end = (e) => { if (sp.el.hasPointerCapture?.(e.pointerId)) sp.el.releasePointerCapture(e.pointerId); sp.el.classList.remove('is-drag'); };
      sp.el.addEventListener('pointerup', end);
      sp.el.addEventListener('pointercancel', end);
      sp.el.addEventListener('keydown', (e) => {
        const step = e.shiftKey || e.key === 'PageUp' || e.key === 'PageDown' ? 0.1 : 0.02;
        let v = S[sp.key];
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'PageDown') v -= step;
        else if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'PageUp') v += step;
        else if (e.key === 'Home') v = 0.04;
        else if (e.key === 'End') v = 0.96;
        else return;
        e.preventDefault();
        S[sp.key] = clamp(v, 0.04, 0.96);
        kick();
      });
    }
    function placeSplit(sp, vis, pos) {
      const shown = vis > 0.02;
      if (sp.vis !== vis) {
        sp.vis = vis;
        sp.el.style.opacity = String(sstep(0.35, 1, vis));
        sp.el.style.pointerEvents = vis > 0.5 ? 'auto' : 'none';
        sp.el.tabIndex = vis > 0.5 ? 0 : -1;
        if (vis <= 0.5 && document.activeElement === sp.el) railKnob.focus({ preventScroll: true }); // never aria-hide a focused control; keep keyboard users on the timeline
        sp.el.setAttribute('aria-hidden', String(vis <= 0.5));
        sp.sideL.style.opacity = sp.sideR.style.opacity = String(sstep(0.5, 1, vis));
      }
      sp.pos = pos;
      if (!shown) return;
      const x = pos * sp.w;
      css(sp.el, 'transform', `translate3d(${x.toFixed(1)}px,0,0)`);
      css(sp.sideL, 'transform', `translate3d(${Math.max(8, x - 12).toFixed(1)}px,0,0) translateX(-100%)`);
      css(sp.sideR, 'transform', `translate3d(${Math.min(sp.w - 8, x + 12).toFixed(1)}px,0,0)`);
      const pct = Math.round(pos * 100);
      if (sp.el.getAttribute('aria-valuenow') !== String(pct)) {
        sp.el.setAttribute('aria-valuenow', String(pct));
        sp.el.setAttribute('aria-valuetext', `治疗前 ${pct}%，当前阶段 ${100 - pct}%`);
      }
    }

    /* ---------------- surface light follows the pointer ---------------- */
    viewS.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = viewS.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = (r.top + r.height / 2) - e.clientY;
      S.lightT = Math.atan2(dy, dx);
      const d = Math.min(1, Math.hypot(dx / (r.width / 2), dy / (r.height / 2)));
      S.elevPT = lerp(0.55, 0.06, d);   // farther from centre → lower, more raking light
      S.pointerAt = S.time;
      kick();
    });
    viewS.addEventListener('pointerleave', () => { S.pointerAt = S.time - 1.5; });

    /* ---------------- master timeline: rail, stepper, scroll ---------------- */
    let pinST = null;
    function goTo(T, { smooth = true } = {}) {
      T = clamp(T, 0, LAST);
      if (pinST) {
        const y = pinST.start + (pinST.end - pinST.start) * (tToU(T) / LAST);
        if (ctx.lenis) ctx.lenis.scrollTo(y, smooth ? { duration: 1.1 } : { immediate: true, force: true });
        else window.scrollTo({ top: y, behavior: smooth && !reduced ? 'smooth' : 'auto' });
        if (!smooth) S.Tt = T;
      } else {
        S.Tt = T;
      }
      kick();
    }
    // consecutive steps (keys / prev-next) accumulate while a smooth scroll to the previous target is still running
    let navT = null, navAt = 0;
    const navBase = () => (navT != null && performance.now() - navAt < 1300 && Math.abs(S.Tt - navT) > 0.02 ? navT : Math.round(S.Tt));
    const step = (n) => { navT = clamp(n, 0, LAST); navAt = performance.now(); goTo(navT); };
    railMs.forEach((b) => b.addEventListener('click', () => step(+b.dataset.k)));
    prevBtn.addEventListener('click', () => step(navBase() - 1));
    nextBtn.addEventListener('click', () => step(navBase() + 1));
    railKnob.addEventListener('keydown', (e) => {
      const k = navBase();
      let n = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'PageUp') n = k + 1;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'PageDown') n = k - 1;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = LAST;
      if (n == null) return;
      e.preventDefault();
      step(n);
    });
    // drag the knob / track (snaps to the nearest milestone on release).
    // Mouse: grabs immediately. Touch / pen: the track is `touch-action: pan-y`, so a vertical swipe keeps scrolling
    // the page (the rail is sticky at the bottom on phones); a drag starts only on a clear horizontal move, a tap jumps
    // to the nearest stage.
    let railW = 1, railL = 0, railPtr = null;
    const railFrom = (clientX) => clamp((clientX - railL) / railW) * LAST;
    const railGrab = (e) => {
      railPtr.drag = true;
      try { railTrack.setPointerCapture(e.pointerId); } catch (_) { /* pointer already gone */ }
      S.dragRail = true; root.classList.add('sl-dragging');
      goTo(railFrom(e.clientX), { smooth: false });
    };
    railTrack.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || e.target.closest('.sl-rail__m')) return;
      const r = railTrack.getBoundingClientRect(); railW = r.width || 1; railL = r.left;
      railPtr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, drag: false };
      if (e.pointerType === 'mouse') { e.preventDefault(); railKnob.focus({ preventScroll: true }); railGrab(e); }
    });
    railTrack.addEventListener('pointermove', (e) => {
      if (!railPtr || e.pointerId !== railPtr.id) return;
      if (!railPtr.drag) {
        const dx = Math.abs(e.clientX - railPtr.x0), dy = Math.abs(e.clientY - railPtr.y0);
        if (dx > 6 && dx > dy * 1.2) railGrab(e);
        return;
      }
      goTo(railFrom(e.clientX), { smooth: false });
    });
    const railEnd = (e) => {
      if (!railPtr || e.pointerId !== railPtr.id) return;
      const p = railPtr; railPtr = null;
      if (railTrack.hasPointerCapture?.(e.pointerId)) railTrack.releasePointerCapture(e.pointerId);
      if (p.drag) {
        S.dragRail = false; root.classList.remove('sl-dragging');
        step(Math.round(S.Tt));
      } else if (e.type === 'pointerup' && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 10) {
        step(Math.round(railFrom(e.clientX)));
      }
    };
    railTrack.addEventListener('pointerup', railEnd);
    railTrack.addEventListener('pointercancel', railEnd);

    const mm = gsap.matchMedia();
    mm.add('(min-width: 1000px) and (min-height: 700px)', () => {
      if (reduced) return undefined;
      root.classList.add('sl-pinned');
      pinST = ScrollTrigger.create({
        trigger: stage, start: 'top top', end: '+=260%', pin: true, pinSpacing: true, anticipatePin: 1,
        // declaring refreshPriority switches ScrollTrigger to sort every trigger by its on-page position before each
        // refresh; without it, pins that other sections re-create in their own matchMedia (hero, mechanism) after a
        // resize/rotation land after ours in refresh order and this pin's start/end go stale (overlapping content)
        refreshPriority: 0,
        onUpdate: (self) => { if (!S.dragRail) S.Tt = uToT(self.progress * LAST); kick(); },
      });
      return () => { pinST?.kill(); pinST = null; root.classList.remove('sl-pinned'); };
    });

    /* ---------------- per-frame parameter objects (reused, never reallocated) ---------------- */
    const hBefore = { week: 0, contraction: 0, heat: 0, cool: 0, current: 0 };
    const HP = {
      time: 0, week: 0, heat: 0, cool: 0, current: 0, contraction: 0, stain: 1, highlight: 0, highlightAmount: 0,
      magnification: 0, split: -1, before: hBefore, scaleBar: false, splitHandle: false, isotherms: false,
      zoom: 1, pan: { x: 0, y: 0 },
      grain: 0.75, vignette: 1, chroma: 1, dof: 1,
    };
    const tip = { x: 0.5, y: 0.52, r: 0.3 };
    const sBefore = { wrinkle: 1, texture: 1 };
    const SP = {
      time: 0, wrinkle: 1, texture: 1, heat: 0, cool: 0, tip: null, split: -1, before: sBefore,
      light: 2.05, elevation: 0.2, tilt: 0.15, zoom: 1, mode: 'photo', exposure: 1, grain: 0.8, vignette: 1,
    };
    const sig = new Float64Array(24);   // change detection → idle frames are throttled
    const sigS = new Float64Array(10), sigSPrev = new Float64Array(10).fill(NaN);
    let pending = false;

    /* ---------------- sizes (cached; no layout reads in the loop) ---------------- */
    const VS = { hw: 1, hh: 1, sw: 1, sh: 1 };
    let fxH = null, fxS = null, dead = false;
    // layout sizes from the observer entries (unaffected by reveal transforms, unlike getBoundingClientRect)
    const ro = new ResizeObserver((entries) => {
      for (const en of entries) {
        const r = en.contentRect;
        if (en.target === viewH) { VS.hw = r.width; VS.hh = r.height; } else { VS.sw = r.width; VS.sh = r.height; }
      }
      const a = { width: VS.hw, height: VS.hh }, b = { width: VS.sw, height: VS.sh };
      splits[0].w = a.width; splits[0].h = a.height; splits[1].w = b.width; splits[1].h = b.height;
      splits[0].vis = splits[1].vis = -1; // force a re-place
      if (fxH) fxH.resize(Math.max(2, a.width), Math.max(2, a.height));
      if (fxS) fxS.resize(Math.max(2, b.width), Math.max(2, b.height));
      sig.fill(NaN); sigSPrev.fill(NaN);
      kick();
    });
    ro.observe(viewH); ro.observe(viewS);

    /* ---------------- engines (loaded now, created when the section approaches) ---------------- */
    // not awaited: ~125 KB of engine code must not hold up the init of every later section (boot() is sequential)
    let enginesOK = false, L0 = null;
    const enginesLoaded = Promise.all([
      window.SkinFX?.Histology ? null : loadScript('js/fx/histology.js'),
      window.SkinFX?.Surface ? null : loadScript('js/fx/skin-surface.js'),
    ]).then(() => {
      enginesOK = !!(window.SkinFX?.Histology && window.SkinFX?.Surface);
      if (enginesOK && window.SkinFX.Histology.layers) { L0 = window.SkinFX.Histology.layers(0); LYc = L0; }
    }, (err) => { console.warn('[skinlab] engine scripts unavailable', err); });

    function fallback() {
      dead = true;
      root.classList.add('sl-nogl');
      const msg = `<div class="sl-nogl-msg"><p><b>此浏览器暂不支持实时 WebGL 模拟</b></p><p class="small">可直接查看彩页中的真实 H&amp;E 组织切片与临床案例照片。</p><p><a class="sl-link" href="#collagen">查看真实组织切片与案例 →</a></p></div>`;
      viewH.insertAdjacentHTML('beforeend', msg);
      viewS.insertAdjacentHTML('beforeend', '<div class="sl-nogl-msg sl-nogl-msg--s"><p class="small">皮肤表面实时模拟需要 WebGL</p></div>');
    }

    let dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const GOV = { n: 0, acc: 0, skip: 45, done: false }; // adaptive resolution (see frame())
    function createEngines() {
      if (fxH || dead) return;
      if (!enginesOK) { fallback(); return; }
      try {
        fxH = window.SkinFX.Histology.create(cvH, { seed: 8, dpr, maxTissuePixels: 1.0e6 });
        fxS = window.SkinFX.Surface.create(cvS, { seed: 2, dpr });
      } catch (err) { console.warn('[skinlab] engine init failed', err); }
      if (!fxH || !fxS) { fxH?.dispose(); fxS?.dispose(); fxH = fxS = null; fallback(); return; }
      fxH.resize(Math.max(2, VS.hw), Math.max(2, VS.hh));
      fxS.resize(Math.max(2, VS.sw), Math.max(2, VS.sh));
      root.classList.add('sl-ready');
      sig.fill(NaN); sigSPrev.fill(NaN);
      GOV.n = 0; GOV.acc = 0; GOV.skip = 45;
      kick();
    }
    /** one-shot quality step for slow GPUs: rebuild both engines at 1× (same canvases, same contexts) */
    function degrade() {
      if (dead || dpr <= 1) return false;
      fxH?.dispose(); fxS?.dispose(); fxH = fxS = null;
      dpr = 1;
      createEngines();
      return !!fxH;
    }
    // create just before the section scrolls in (shader compile off the critical path)
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); enginesLoaded.then(createEngines); } }, { rootMargin: '120% 0px' });
    io.observe(root);
    // GPU context loss: hide the (black) canvas behind the loader, re-render as soon as the engine has re-initialised
    for (const [cv, view] of [[cvH, viewH], [cvS, viewS]]) {
      cv.addEventListener('webglcontextlost', () => view.classList.add('is-lost'));
      cv.addEventListener('webglcontextrestored', () => { view.classList.remove('is-lost'); sig.fill(NaN); sigSPrev.fill(NaN); kick(); });
    }

    /* ---------------- layer labels (tissue-anchored DOM, via worldToCss) ---------------- */
    const LY = Object.fromEntries($$('.sl-ly').map((e) => [e.dataset.ly, e]));
    const brkNow = $('.sl-brk--now'), brkPre = $('.sl-brk--pre');
    const wpt = { x: 0, y: 0 };
    let lyWeek = -1, LYc = null;
    function placeLabel(el, yMm, alpha) {
      if (alpha < 0.01) { css(el, 'opacity', '0'); return; }
      fxH.worldToCss(0, yMm, wpt);
      const y = wpt.y;
      const a = y < 30 || y > VS.hh - (VS.hw < 720 ? 104 : 34) ? 0 : alpha; // keep clear of the bottom controls on narrow views
      css(el, 'opacity', a.toFixed(2));
      css(el, 'transform', `translate3d(0,${y.toFixed(1)}px,0) translateY(-50%)`);
    }
    function placeBracket(el, y0Mm, y1Mm, alpha) {
      if (alpha < 0.01) { css(el, 'opacity', '0'); return; }
      fxH.worldToCss(0, y0Mm, wpt); const a = wpt.y;
      fxH.worldToCss(0, y1Mm, wpt); const b = Math.min(wpt.y, VS.hh - 4);
      css(el, 'opacity', alpha.toFixed(2));
      css(el, 'transform', `translate3d(0,${a.toFixed(1)}px,0)`);
      css(el, 'height', `${Math.max(0, b - a).toFixed(1)}px`);
    }
    // scale bar in DOM (css px per mm measured through worldToCss of the frame just drawn)
    const SCALE_UM = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
    const scBar = $('.sl-scale__bar'), scT = $('.sl-scale__t');
    let scKey = '';
    function updateScale() {
      fxH.worldToCss(0, 0, wpt); const x0 = wpt.x;
      fxH.worldToCss(1, 0, wpt); const ppm = wpt.x - x0;
      if (!(ppm > 0)) return;
      const target = clamp(0.15 * VS.hw, 70, 200) / ppm * 1000;
      let um = SCALE_UM[0];
      for (let i = 0; i < SCALE_UM.length; i++) if (SCALE_UM[i] <= target) um = SCALE_UM[i];
      const w = (um / 1000) * ppm;
      css(scBar, 'width', `${w.toFixed(1)}px`);
      const lbl = um >= 1000 ? `${um / 1000} mm` : `${um} µm`;
      if (lbl !== scKey) { scKey = lbl; scT.textContent = lbl; }
    }
    function updateLayers(week, mag, splitVis) {
      if (!L0 || !fxH) return;
      if (Math.abs(week - lyWeek) > 0.02) { lyWeek = week; LYc = window.SkinFX.Histology.layers(week); }
      const a2 = 1 - sstep(0.12, 0.4, mag), a200 = sstep(0.6, 0.9, mag);
      placeLabel(LY.epi, LYc.epidermis, a2);
      placeLabel(LY.derm, (LYc.junction + LYc.dermisBase) * 0.5, a2);
      placeLabel(LY.sub, LYc.dermisBase + 0.28, a2);
      placeLabel(LY.epi2, 0.035, a200);
      placeLabel(LY.pap, LYc.papillary, a200);
      placeLabel(LY.ret, 0.3, a200);
      const aPre = a2 * sstep(0.5, 1, splitVis) * sstep(0.2, 1.5, week);
      placeBracket(brkNow, LYc.junction, LYc.dermisBase, a2);
      placeBracket(brkPre, L0.junction, L0.dermisBase, aPre);
      placeLabel(LY.dermPre, (L0.junction + L0.dermisBase) * 0.5, aPre);
    }

    /* ---------------- frame ---------------- */
    let loopCtl = null;
    function kick() {
      // reduced motion / no loop: render one frame on demand
      if (reduced && !pending) { pending = true; requestAnimationFrame(() => { pending = false; frame(1); }); }
    }

    function frame(dt) {
      const snap = reduced || S.snapNext;
      S.snapNext = false;
      if (!reduced) S.time += dt;
      // timeline
      S.T = snap ? S.Tt : damp(S.T, S.Tt, S.dragRail ? 14 : 5.5, dt);
      if (Math.abs(S.T - S.Tt) < 1e-4) S.T = S.Tt;
      const T = S.T;
      const k = clamp(Math.round(T), 0, LAST);
      if (k !== S.k) { S.k = k; S.curOverride = null; setCaption(k); syncChips(k === 1); }

      // stain / highlight / magnification transitions
      S.stain = snap ? S.stainT : (S.stain < S.stainT ? Math.min(S.stainT, S.stain + dt / 1.6) : Math.max(S.stainT, S.stain - dt / 1.6));
      if (S.hl !== S.hlT) { S.hlAmt = snap ? 0 : Math.max(0, S.hlAmt - dt * 3); if (S.hlAmt === 0) S.hl = S.hlT; }
      else if (S.hl !== 0) S.hlAmt = snap ? 1 : Math.min(1, S.hlAmt + dt * 2);
      const magT = S.magMode === 'auto' ? CV.mag(T) : S.magMode;
      S.mag = snap ? magT : damp(S.mag, magT, S.magMode === 'auto' ? 9 : 4.5, dt);
      if (Math.abs(S.mag - magT) < 2e-4) S.mag = magT;

      // story values
      const week = CV.week(T);
      const heat = CV.heat(T), cool = CV.cool(T), contr = CV.contr(T);
      const storyCur = CV.current(T);
      const curT = S.curOverride === false ? 0 : S.curOverride === true ? Math.max(storyCur, 0.6) : storyCur;
      S.cur = snap ? curT : damp(S.cur, curT, 7, dt);
      if (Math.abs(S.cur - curT) < 1e-3) S.cur = curT;
      const hVis = CV.hSplit(T), sVis = CV.sSplit(T);

      // surface light: pointer, else a slow deterministic drift
      const idle = S.time - S.pointerAt > 2.2;
      if (idle && !reduced) { S.lightT = 2.05 + 0.42 * Math.sin(S.time * 0.21); S.elevPT = 0.2 + 0.05 * Math.sin(S.time * 0.13 + 1); }
      S.light = snap ? S.lightT : dampAngle(S.light, S.lightT, idle ? 1.2 : 6, dt);
      S.elevP = snap ? S.elevPT : damp(S.elevP, S.elevPT, idle ? 1.2 : 6, dt);

      // ---- histology params ----
      HP.time = S.time;
      HP.week = week;
      HP.heat = heat * (S.thermal ? 1 : 0.92);
      HP.cool = cool;
      HP.current = S.cur;
      HP.contraction = contr;
      HP.stain = S.stain;
      HP.highlight = S.hl;
      HP.highlightAmount = S.hl ? S.hlAmt : 0;
      HP.magnification = S.mag;
      // close-up framing: a slightly wider ×200 field (≈ the brochure micrograph's field of view);
      // engine zoom is about the view centre, so pan back down to keep ~12 % headroom above the
      // stratum corneum (clear of the view chrome) and give the dermis the rest of the frame
      HP.zoom = 1 - 0.2 * S.mag;
      HP.pan.y = 0.045 * S.mag;
      HP.split = hVis > 0.001 ? lerp(1, S.splitH, hVis) : -1;
      HP.isotherms = S.thermal;
      // ---- surface params ----
      const tipOn = T > TIP_ON[0] && T < TIP_ON[1];
      SP.time = S.time;
      SP.wrinkle = CV.wrinkle(T);
      SP.texture = CV.texture(T);
      SP.heat = CV.sHeat(T);
      SP.cool = cool * (tipOn ? 1 : 0);
      SP.tip = tipOn ? tip : null;
      SP.split = sVis > 0.001 ? lerp(1, S.splitS, sVis) : -1;
      SP.light = S.light;
      SP.elevation = clamp(S.elevP + (CV.elev(T) - 0.2), 0, 1);
      SP.tilt = CV.tilt(T);
      SP.mode = S.thermal ? 'thermal' : 'photo';

      // ---- DOM (cheap writes only) ----
      placeSplit(splits[0], hVis, HP.split < 0 ? 1 : HP.split);
      placeSplit(splits[1], sVis, SP.split < 0 ? 1 : SP.split);
      updateReadouts(week, S.mag);
      const fill = T / LAST;
      css(railFill, 'transform', `scaleX(${fill.toFixed(4)})`);
      css(railKW, 'transform', `translate3d(${(fill * 100).toFixed(3)}%,0,0)`);
      for (let i = 0; i < railMs.length; i++) railMs[i].classList.toggle('is-done', i <= T + 1e-3);
      for (let i = 0; i < pz.length; i++) pz[i].classList.toggle('is-on', T >= PULSE[i][0] && T < PULSE[i][1]);
      const showLegend = heat > 0.04 || S.thermal;
      css(legend, 'opacity', showLegend ? '1' : '0');
      css(legendCool, 'opacity', cool > 0.05 ? '1' : '0.25');
      // live pulse-phase badge (IFU p.15: 治疗前冷却 → 射频传送 → 治疗后冷却)
      let ph = -1;
      for (let i = 0; i < PULSE.length; i++) if (T >= PULSE[i][0] && T < PULSE[i][1]) ph = i;
      if (ph !== rfPhase) { rfPhase = ph; if (ph >= 0) rfT.textContent = data.pulsePhases[ph]; rfBadge.dataset.ph = ph < 0 ? '' : PULSE[ph][2]; }
      css(rfBadge, 'opacity', ph < 0 ? '0' : '1');
      const bk = `${(heat * 0.95).toFixed(2)}|${(cool * 0.8).toFixed(2)}|${(sstep(0, 12, week) * 0.9).toFixed(2)}`;
      if (bk !== bgKey) { bgKey = bk; const [a, b, c] = bk.split('|'); bgHeat.style.opacity = a; bgCool.style.opacity = b; bgGrow.style.opacity = c; }
      css(dialDot, 'transform', `rotate(${(-S.light * 180 / Math.PI).toFixed(1)}deg)`);
      const dark = S.stain < 0.5;
      if (root.classList.contains('sl-df') !== dark) {
        root.classList.toggle('sl-df', dark);
        modePill.textContent = dark ? '暗场荧光 · 示意' : 'H&E · 横截面';
      }
      const sm = S.thermal ? '热成像 · 示意' : '皮肤表面 · 微观';
      if (smodePill.textContent !== sm) smodePill.textContent = sm;

      if (!fxH || !fxS) return;

      // ---- render (idle frames throttled: only grain would change) ----
      S.frame++;
      const liveH = HP.heat > 0.003 || HP.cool > 0.003 || HP.current > 0.003;
      sig[0] = HP.week; sig[1] = HP.heat; sig[2] = HP.cool; sig[3] = HP.current; sig[4] = HP.contraction; sig[5] = HP.stain;
      sig[6] = HP.highlight; sig[7] = HP.highlightAmount; sig[8] = HP.magnification; sig[9] = HP.split; sig[10] = HP.isotherms ? 1 : 0;
      let chH = false;
      for (let i = 0; i < 11; i++) if (sig[i] !== sig[12 + i]) { chH = true; sig[12 + i] = sig[i]; }
      if (chH || (liveH && !reduced) || (!reduced && S.frame % 3 === 0)) fxH.render(HP);
      updateScale();
      updateLayers(week, S.mag, hVis); // after render: worldToCss reads the view of the frame just drawn

      sigS[0] = SP.wrinkle; sigS[1] = SP.texture; sigS[2] = SP.heat; sigS[3] = SP.cool; sigS[4] = SP.tip ? 1 : 0; sigS[5] = SP.split;
      sigS[6] = SP.light; sigS[7] = SP.elevation; sigS[8] = SP.tilt; sigS[9] = S.thermal ? 1 : 0;
      let chS = false;
      for (let i = 0; i < 10; i++) if (sigSPrev[i] !== sigS[i]) { chS = true; sigSPrev[i] = sigS[i]; }
      const liveS = SP.heat > 0.003 || SP.cool > 0.003;
      if (chS || (liveS && !reduced) || (!reduced && S.frame % 3 === 1)) fxS.render(SP);

      // adaptive resolution: while the cross-section is changing (scrub / transitions), a loop that sustains
      // < ~33 fps for ~120 such frames drops both engines to 1× once (hi-dpi screens only; dpr is capped at 1.5)
      if (chH && !GOV.done && !reduced && dpr > 1) {
        if (GOV.skip > 0) GOV.skip--;
        else if (dt > 0) {
          GOV.acc += dt;
          if (++GOV.n >= 120) {
            if (GOV.acc / GOV.n > 0.03) { GOV.done = true; degrade(); }
            GOV.n = 0; GOV.acc = 0;
          }
        }
      }
    }
    function dampAngle(a, b, rate, dt) {
      let d = b - a;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      return b - d * Math.exp(-rate * dt);
    }

    /* ---------------- loop (visible-only, paused in hidden tabs) ---------------- */
    setCaption(0);
    syncChips(false);
    if (!reduced) {
      loopCtl = ctx.lib.visibleLoop(stage, (dt) => frame(dt));
      let wasRunning = false;
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { wasRunning = loopCtl.running; loopCtl.stop(); }
        else if (wasRunning) loopCtl.start();
      });
    } else {
      kick();
    }

    // QA hook (non-enumerable): jump the timeline / toggle views from automated screenshots
    Object.defineProperty(root, '__sl', {
      value: {
        S, HP, SP,
        go: (T, smooth = false) => goTo(T, { smooth }),
        jump: (T) => { goTo(T, { smooth: false }); S.Tt = clamp(T, 0, LAST); S.snapNext = true; if (!reduced) frame(0); },
        set: (o) => { Object.assign(S, o); kick(); },
        get engines() { return { fxH, fxS }; },
        get dpr() { return dpr; },
        degrade,
      },
    });

    /* ---------------- chart (built once) ---------------- */
    function buildChart() {
      const W = 420, H = 78, P = { l: 6, r: 6, t: 8, b: 16 };
      const x = (w) => P.l + (w / 12) * (W - P.l - P.r);
      const y = (v) => P.t + (1 - (v - 1) / (RMAX + 0.08 - 1)) * (H - P.t - P.b);
      CH.x = x; CH.y = y;
      const path = (fn) => { let d = ''; for (let i = 0; i <= 48; i++) { const w = (i / 48) * 12; d += (i ? 'L' : 'M') + x(w).toFixed(1) + ' ' + y(fn(w)).toFixed(1); } return d; };
      const pts = (arr, cls) => Cg.weeks.map((w, i) => `<circle class="${cls}" cx="${x(w).toFixed(1)}" cy="${y(arr[i]).toFixed(1)}" r="2.2"/>`).join('');
      return `<svg class="viz sl-chart__svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="胶原相对含量曲线（据彩页图表估读）：Ⅰ 型第 4 周约 ${Cg.type1[1]}、第 12 周约 ${Cg.type1[2]}；Ⅲ 型第 4 周约 ${Cg.type3[1]}、第 12 周约 ${Cg.type3[2]}">
        <line class="c-base" x1="${P.l}" x2="${W - P.r}" y1="${y(1).toFixed(1)}" y2="${y(1).toFixed(1)}"/>
        ${Cg.weeks.map((w) => `<line class="c-grid" x1="${x(w).toFixed(1)}" x2="${x(w).toFixed(1)}" y1="${P.t}" y2="${H - P.b}"/><text class="c-lbl" x="${x(w).toFixed(1)}" y="${H - 3}" text-anchor="${w === 0 ? 'start' : w === 12 ? 'end' : 'middle'}">${w === 0 ? '0 周' : w + ' 周'}</text>`).join('')}
        <path class="c-l3" d="${path(rIII)}"/><path class="c-l1" d="${path(rI)}"/>
        ${pts(Cg.type3, 'c-p3')}${pts(Cg.type1, 'c-p1')}
        <g class="c-cur"><line x1="0" x2="0" y1="${P.t - 4}" y2="${H - P.b}"/><circle class="c-d1" cx="0" cy="${y(1).toFixed(1)}" r="3.4"/><circle class="c-d3" cx="0" cy="${y(1).toFixed(1)}" r="3.4"/></g>
      </svg>`;
    }
  },
};
const CH = { x: (w) => w, y: (v) => v };
